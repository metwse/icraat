const url = { backend: '/api' }

const minuteIntegerToString = duration => {
    let _duration = (duration + '').split('.')
    if (!_duration[1]) _duration[1] = '00'
    _duration[1] = (_duration[1] * 3/5 / 10 ** (_duration[1].length - 2) + '').split('.')[0]
    while (_duration[1].length < 2) _duration[1] = '0' + _duration[1]
    _duration[1] = _duration[1].substring(0, 2)
    return _duration.join('.')
} 

class IcraatError extends Error {
    static ERRORS = {
        100: ['Bad request', 400],
        101: ['Unauthorized', 401],
        102: ['Forbidden', 403],
        103: ['Not found', 404],
        104: ['$1', 429],
        105: ['Wrong mime', 400],
        106: ['Missing param $1: $2', 400],
        107: ['Invalid payload scheme, $1: $2', 400]
    }

    constructor(code, message, details) {
        super()
        if (typeof code == 'number') this.code = code, this.msg = message, this.details = details
        else this.code = code.code, this.msg = code.message, this.details = code.details, this.ready = true
    }

    get name() {
        var message
        if (this.ready) message = this.msg
        else {
            message = metw.Error.ERRORS[this.code][0]
            if (this.msg?.forEach) this.msg.forEach((m, i) => message = message.replace(`$${i + 1}`, m))
        }
        return `Error: ${message} [${this.code}]` + (this.details ? `\n${JSON.stringify(this.details)}` : '')
    }
}


class Session {
    static PLURAL_MAPPINGS = {
        'exam': 'exams', 'lesson': 'lessons', 'publisher': 'publishers',
        'exam.category': 'exams.categories'
    }

    constructor() {
        this.cache = {
            'exams': {}, 'lessons': {}, 'publishers': {},
            'exams.categories': {}
        }
    }

    request(path, opt) {
        return new Promise(async resolve => {
            var ok, raw,
                json = await fetch(url.backend + path, Object.assign(opt ?? {}, {
                    body: opt?.json ? JSON.stringify(opt.json) : opt?.body,
                    headers: Object.assign(opt?.headers || {}, {
                        ...(this.token ? { 'Auth': this.token } : {}),
                        ...(opt?.json ? { 'Content-Type': 'application/json' } : {})
                    }),
                    method: opt?.method || (opt?.json ? 'POST' : 'GET')
                })).then(res => { raw = res, ok = res.ok; return res.json() })
            resolve([json, ok, raw])
        })
    }

    async get(param, id) {
        const mapped = Session.PLURAL_MAPPINGS[param]
        if (this.cache[mapped][id]) return this.cache[mapped][id]
        var [data, ok] = await this.request(`/${mapped.replace(/\./, '/')}/${id}`)
        if (!ok) throw IcraatError(data)
        data = eval(`new ${param.replace(/((\W\w)|^\w)/g, (W, w) => w.toUpperCase())}(data, this)`)
        if (data.format) await data.format()
        this.cache[mapped][id] = data
        return data
    }

    async bulkGet(query, justCache) {
        var requests = [{}]
        for (let key of Object.keys(query)) {
            requests[0][key] = []
            for (let i of query[key]) if (!this.cache[key][i]) requests[0][key].push(i)
            if (!requests[0][key].length) delete requests[0][key]
            else {
                requests[0][key] = Array.from(new Set(requests[0][key]))
                let i = 1
                while (requests[0][key].length > 500) {
                    if (!requests[i]) requests[i] = {}
                    requests[i][key] = requests[0][key].splice(500, 500)
                    i++
                }
            }
        }
        if (Object.keys(requests[0]).length && Object.keys(requests[0]).every(key => requests[0][key].length)) {
            var data = {}
            for (let request of requests) {
                const [_data, ok] = await this.request(`/bulk`, { json: request })
                if (!ok) throw IcraatError(_data)
                Object.assign(data, _data)
            }
            var request2 = {}
            for (let key of Object.keys(data)) 
                for (let dataKey of Object.keys(data[key])) {
                    let item = eval(`new ${Object.fromEntries(Object.entries(Session.PLURAL_MAPPINGS).map(v => v.reverse()))[key].replace(/((\W\w)|^\w)/g, (w) => w.toUpperCase())}(data[key][dataKey], this)`)
                    this.cache[key][item.id] = item
                    if (item.format) {
                        let req = await item.format(true)
                        if (req) {
                            for (let reqKey of Object.keys(req)) {
                                if (!request2[reqKey]) request2[reqKey] = []
                                request2[reqKey] = request2[reqKey].concat(req[reqKey])
                            }
                        }
                    }
                }
            await this.bulkGet(request2, true)
            await Promise.all(Object.keys(data).map(key => data[key].map(({ id }) => this.cache[key][id].format && this.cache[key][id].format())).flat())
                    
        }
        if (justCache) return
        for (let key of Object.keys(query)) for (let i = 0; i < query[key].length; i++) query[key][i] = this.cache[key][query[key][i]]
        return query
    }
    
    async dashboard() {
        var [data] = await this.request('/dashboard')
        return (await this.bulkGet(data)).exams
    }

    async dashboardFilters() {
        var [data] = await this.request('/dashboard/filters')
        data = await this.bulkGet(data)
        return { publishers: data.publishers, 'exams.categories': data['exams.categories'] }
    }

    async search(param, text, opt) {
        const mapped = Session.PLURAL_MAPPINGS[param] ?? param
        var [data, ok] = await this.request(`/${mapped.replace(/\./, '/')}/search?q=${text}&filter=${opt?.filter}`)
        if (!ok) throw IcraatError(data)
        return (await this.bulkGet({ [mapped]: data }))[mapped]
    }
}

class Exam {
    static Category = class {
        constructor({ id, name, question_count, schema }, session) {
            this.id = id, this.name = name
            this.questionCount = question_count, this.schema = schema
            this._session = session
        }

        async format(req) {
            if (!this.schema.every(v => typeof v[0] == 'number')) return false
            if (req) return { lessons: this.schema.map(v => v[0]) }
            const schema = await this._session.bulkGet({ lessons: this.schema.map(v => v[0]) })
            this.schema = this.schema.map((i, index) => [schema.lessons[index], i[1]])
        }
    }

    constructor({ id, publisher, publisher_id, category, category_id, net, nets, duration, timestamp, name }, session) {
        this.id = id, this.name = name
        this.net = parseFloat(net)
        this.stats = nets.map(lesson => lesson.map(net => parseFloat(net))).map(([net, total, wrong, blank]) => { return { net, total, wrong, blank, true: total - wrong - blank } })

        this.duration = minuteIntegerToString(duration)
	this._duration = duration

        this.timestamp = new Date(timestamp)
        if (publisher) this.publisher = publisher
        else this.publisherId = publisher_id
        if (category) this.category = category
        else this.categoryId = category_id
        this._session = session
    }

    async format(req) {
        if (req) return { ...(this.publisher ? {} : { publishers: [this.publisherId] }), ...(this.category ? {} : { 'exams.categories': [this.categoryId] }) }
        if (!this.publisher) this.publisher = await this._session.get('publisher', this.publisherId)
        if (!this.category) {
	    this.category = await this._session.get('exam.category', this.categoryId)
	}
    }

    get fullName() { return `${this.publisher.name} ${this.category.name} - ${this.name}` }
    get shortName() { return `${this.publisher.name.match(/([A-Z0-9]+)/g).join('')}: ${this.category.name.match(/([A-Z0-9]+)/g).join('')}. ${this.name}` }
    get totalTrue() { return this.stats.map(v => v.true).reduce((a, b) => a + b) }
    get totalWrong() { return this.stats.map(v => v.wrong).reduce((a, b) => a + b) }
    get totalBlank() { return this.stats.map(v => v.blank).reduce((a, b) => a + b) }
    get questionCount() { return this.stats.map(v => v.total).reduce((a, b) => a + b) }
    get durationPerQuestion() { return (this._duration * 60 / this.questionCount).toFixed(2) }
}


class Lesson {
    constructor({ id, name }, session) {
        this.id = id, this.name = name
        this._session = session
    }
}


class Publisher {
    constructor({ id, name }, session) {
        this.id = id, this.name = name
        this._session = session
    }
}


window.icraat = { Session, Error: IcraatError }
