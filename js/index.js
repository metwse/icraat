const d = document
const session = eval('new icraat.Session()')
var r = root = d.getElementById('root')

const AsyncFunction = Object.getPrototypeOf(async () => { }).constructor

async function load(fn) {
    load._.style.display = 'block', mouse.disable()
    const res = await fn()
    load._.style.display = 'none'
    mouse.enable()
    return res
}
load._ = d.getElementById('load')

async function fetchStream(url, fetchInit) {
    return await fetch(url, fetchInit).then((res) => {
        var contentLenght = res.headers.get('Content-Length'), downloadLength = 0
        const reader = res.body.getReader()
        return new Response(new ReadableStream({
            start(controller) {
                return (pump = () => {
                    return reader.read().then(({ done, value }) => {
                        if (done) { controller.close(); return }
                        controller.enqueue(value); downloadLength += value.length
                        parseInt(downloadLength / contentLenght * 100)
                        return pump()
                    })
                })()
            }
        }))
    })
}

const mouse = {
    _state: true,
    _element: d.getElementById('disable-mouse'),
    set state(s) { this._state = s, this._element.style.display = ['none', 'block'][+!s] },
    get state() { return this._state },
    enable() { this.state = true },
    disable() { this.state = false }
}

const app = {
    location: {
        search: [],
        pathname: [],
        format() {
            return [this.pathname, this.search] = [location.pathname.slice(1).split('/').map(v => decodeURI(v)), new URLSearchParams(location.search)]
        }
    },
    template: {
        data: {},
        debug: localStorage.getItem('debug') == 'true',
        async render(name) {
            await load(async () => {
                var data = await fetchStream(`/pages/${name}.html`).then(res => res.text()), scripts = [[], '']
                var oldRoot = root
                r = root = d.createElement('div'), root.id = 'root', root.className = 'r root'
                data = data.replace(/<script(.*?)>([\S\s]*?)<\/script>/g, (_, attr, script) => {
                    var script_ = d.createElement('script')
                    attr.replace(/\s(\w+)\s*=\s*"(.*?)"/g, (_, key, value) => { script_.setAttribute(key, value); return '' })
                        .replace(/\s*=\s*/g, '=').split(' ').forEach(v => {
                            let k = v.split('=')
                            if (k[0]) script_.setAttribute(k[0], k[1] || k[0])
                        })
                    if (script_.getAttribute('init')) { scripts[1] += script + ';' }
                    else {
                        script_.innerHTML = this.debug ? script : `(() => {${script}})()`
                        scripts[0].push(script_)
                    }
                    return ''
                })
                await AsyncFunction(scripts[1])()
                root.innerHTML = data
                for (let script of scripts[0]) root.appendChild(script)
                oldRoot.parentElement.replaceChild(root, oldRoot)
                r = root = root
                return
            })
        }
    },
    async redirect(path, title) {
        history.pushState(null, title, path)
        this.history.push(r)
        await this.load()
    },
    history: [],
    async load() {
        this.location.format()
        switch (this.location.pathname[0]) {
            case '': return await this.template.render('homepage')
            case 'sınavlar': return await this.template.render('exams')
            case 'sınavlar-eski': return await this.template.render('exams-old')
            case 'sonuç': return await this.template.render('result')
            case 'analiz': return await this.template.render('analyze')
            default: return await this.template.render('404')
        }
    },
    back() {
        if (this.location.pathname[0] && !this.history.length) this.template.render('homepage'), history.replaceState(null, null, '/'), this.location.format()
	else history.back()
    }
}

onpopstate = async() => {
    if (app.history.onpopstate) {
        if (await app.history.onpopstate() === false) return history.pushState(null, null)
        app.history.onpopstate = null
    }
    if (!mouse.state) return history.pushState(null, null)
    const newRoot = app.history.pop()
    if (newRoot) { root.parentElement.replaceChild(newRoot, root); r = root = newRoot }
    else app.load()
}

onload = async () => {
    await app.load()
    var initialLoad = d.getElementById('initial-load')
    initialLoad.style.opacity = '0'
    setTimeout(() => initialLoad.remove(), 100)
}
