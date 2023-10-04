const url = { backend: '/api' }

const minuteIntegerToString = window.minuteIntegerToString = duration => {
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
            message = IcraatError.ERRORS[this.code][0]
            if (this.msg?.forEach) this.msg.forEach((m, i) => message = message.replace(`$${i + 1}`, m))
        }
        return `Error: ${message} [${this.code}]` + (this.details ? `\n${JSON.stringify(this.details)}` : '')
    }
}


class Session {
    static PLURAL_MAPPINGS = {
        'exam': 'exams', 'lesson': 'lessons', 'publisher': 'publishers', 'book': 'books',
        'exam.category': 'exams.categories', 'user': 'users'
    }

    constructor() {
        this.cache = {
            'exams': {}, 'lessons': {}, 'publishers': {}, 'books': {}, 'users': {},
            'exams.categories': {}
        }
        this.eventListeners = {}
    }

    emit(event, args) {
        if (Array.isArray(this.eventListeners[event])) this.eventListeners[event].forEach(f => (typeof f == 'function') && f(args)) 
        if (typeof this[`on${event}`] == 'function') this[`on${event}`](args)
    }
    addEventLisener(event, f) {
        if (Array.isArray(this.eventListeners[event])) this.eventListeners[event] = []
        return this.eventListeners[event].push(f)
    }
    removeEventListener(event, id) {
        if (Array.isArray(this.eventListeners[event])) return
        this.eventListeners[event].id = null
    }

    request(path, opt) {
        return new Promise(async resolve => {
            await fetch(url.backend + path, Object.assign(opt ?? {}, {
                body: opt?.json ? JSON.stringify(opt.json) : opt?.body,
                headers: Object.assign(opt?.headers || {}, {
                    ...(this.token ? { 'Token': this.token } : {}),
                    ...(opt?.json ? { 'Content-Type': 'application/json' } : {})
                }),
                method: opt?.method || (opt?.json ? 'POST' : 'GET')
            })).then(async res => resolve([await res.json(), res.ok, res])).catch(e => this.emit('unexceptederror', e))
        })
    }

    async login(token) {
        this.token = token
        const [data, ok] = await this.request('/login')
        if (ok) this.user = new User(data, this), this.emit('login', this.user), this.cache.users[data.id] = this.user
        else this.token = null
        return ok
    }
    logout() { if (this.token) this.token = null, this.emit('logout', this.user), this.user = null }

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
    
    dashboard = {
        session: this,
        async all() {
            var [data] = await this.session.request('/dashboard')
            data.questions = new Questions(data.questions, this.session)
            data.exams = (await this.session.bulkGet({ ...data.exams, books: await data.questions.format(true) })).exams
            data.questions.format()
            return data
        },
        async exams() {
            var [data] = await this.session.request('/dashboard/exams')
            return (await this.session.bulkGet(data)).exams
        },
        async examsFilters() {
            var [data] = await this.session.request('/dashboard/exams/filters')
            data = await this.session.bulkGet(data)
            return { publishers: data.publishers, 'exams.categories': data['exams.categories'], users: data.users }
        }
    }

    new = {
        session: this,
        async exam(data) {
            return await this.session.request('/exams/new', {  method: 'post', json: data })
        }
    }

    async search(param, text, opt) {
        const mapped = Session.PLURAL_MAPPINGS[param] ?? param
        var [data, ok] = await this.request(`/${mapped.replace(/\./, '/')}/search?q=${text}&${opt?.filter ? 'filter=' : ''}${opt?.filter}`)
        if (!ok) throw IcraatError(data)
        return (await this.bulkGet({ [mapped]: data }))[mapped]
    }
}

class Questions {
    constructor(data, session){
        this.data = data.map(({ days_before, questions }) => ({
            daysBefore: days_before, 
            questions: questions ? questions.map(([ book_id, count, timestamp ]) => {
                const date = new Date(); date.setTime(timestamp * 1000)
                return { bookId: book_id, count, timestamp: date }
            }) : []
        }))
        this._session = session
    }

    async format(req) {
        const request = this.data.map(v => v.questions.map(q => q.bookId)).flat()
        if (req) return request
        const data = await this._session.bulkGet({ books: request })
        await Promise.all(this.data.map(v => v.questions.map(async q => { q.book = await this._session.get('book', q.bookId) })).flat())
    }
}

class Book {
    constructor({ id, publisher_id, name }, session) {
        this.id = id, this.name = name, this.publisherId = publisher_id
        this._session = session
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

    constructor({ id, publisher, publisher_id, category, category_id, user, user_id, net, nets, duration, timestamp, name }, session) {
        this.id = id, this.name = name
        this.net = parseFloat(net)
        this.stats = nets.map(lesson => lesson.map(net => parseFloat(net))).map(([net, total, wrong, blank]) => { return { net, total, wrong, blank, true: total - wrong - blank } })

        this.duration = minuteIntegerToString(duration)
        this._duration = +duration

        this.timestamp = new Date(timestamp)
        if (publisher) this.publisher = publisher
        else this.publisherId = publisher_id
        if (category) this.category = category
        else this.categoryId = category_id
        if (user) this.user = user
        else this.userId = user_id
        this._session = session
    }

    async format(req) {
        if (req) return { ...(this.publisher ? {} : { publishers: [this.publisherId] }), ...(this.user ? {} : { users: [this.userId] }), ...(this.category ? {} : { 'exams.categories': [this.categoryId] }) }
        if (!this.publisher) this.publisher = await this._session.get('publisher', this.publisherId)
        if (!this.category) this.category = await this._session.get('exam.category', this.categoryId)
        if (!this.user) this.user = await this._session.get('user', this.userId)
    }

    get fullName() { return `${this.publisher.name} ${this.category.name} - ${this.name}` }
    get shortName() { return `${(this.publisher.name.match(/([A-Z0-9ÖÇŞİĞÜ]+)/g) || ['']).join('')}: ${(this.category.name.match(/([A-Z0-9ÖÇŞİĞÜ]+)/g) || ['?']).join('')}. ${this.name}` }
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


class User {
    constructor({ id, name, flags }, session) {
        this.id = id, this.name = name, this.flags = flags
        this._session = session
    }
}


class Publisher {
    constructor({ id, name, flags }, session) {
        this.id = id, this.name = name, this.flags = flags
        this._session = session
    }
}


window.icraat = { Session, Error: IcraatError }
