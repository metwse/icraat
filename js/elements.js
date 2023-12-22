const d = document



//{{{ IcraatExam 
customElements.define('i-exam', class extends HTMLElement {
    constructor() {
        super()
        this._checked = false
    }

    attach(exam) {
        this.exam = exam
        this.innerHTML = `
            <div class="general">
                <div class="details">
                    <span class="category">CATEGORY</span> <span class="publisher">PUBLISHER</span>
                </div>
                <span class="name">NAME</span>
                <span class="date">DATE</span>
                <span class="username">USER</span>
            </div>
            <div class="actions">
                <div class="select"></div>
            </div>`
        this.querySelector('.category').innerText = exam.category.name
        this.querySelector('.publisher').innerText = exam.publisher.name
        this.querySelector('.username').innerText = `@${exam.user.name}`
        this.querySelector('.name').innerText = exam.name
        this.querySelector('.date').innerText = new Intl.DateTimeFormat(navigator.language, { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).format(exam.timestamp)
        this.onclick = () => {
            if (this.parentNode.classList.contains('select')) {
                this.checked = !this.checked
                if (this.oncheck) this.oncheck(this)
            }
            else app.redirect(`/sonuç/${exam.id}`)
        }
    }

    set checked(v) {
        if (v) this.classList.add('active')
        else this.classList.remove('active')
        this._checked = v
    }
    get checked() { return this._checked }
})
//}}}



//{{{ IcraatExams 
class IcraatExams extends HTMLElement {
    static List = class extends Array {
        constructor(listElement) {
            super()
            this.element = listElement
            this.onadd = this.onremove = this.onclear = null 
        }
        toggle(elem) { if (!this.includes(elem.exam)) this.add(elem); else this.remove(elem) }
        add({ exam }) { if (!this.includes(exam)) this.push(exam), this.onadd?.(exam) }
        remove({ exam }) { const index = this.indexOf(exam); if (index != -1) this.splice(index, 1), this.onremove?.(exam) }
        clear() { this.splice(0), this.onclear?.() }
        reset() { this.splice(0), this.onadd = this.onremove = this.onclear = null }
    }

    constructor() {
        super()
        this.mode = 'normal'
        this.random = {}
        this._checked = false
        this._lastSearch = [null, null]
    }
    
    concat(data) { for (let exam of data) this.push(exam) }
    push(exam) {
        let elem = document.createElement('i-exam')
        elem.attach(exam)
        elem.oncheck = () => this.select.list.toggle(elem)
        elem.checked = this.select.list.includes(exam)
        this.appendChild(elem)
    }

    select = {
        elem: this,
        list: new IcraatExams.List(this),
        start() {
            this.elem.mode = 'select'
            this.elem.classList.add('select')
            this.clear()
            return this.list 
        },
        clear() { this.list.clear(); for (let child of this.elem.children) if (child.tagName == 'I-EXAM') child.checked = false },
        deselect(exam) { for (let child of this.elem.children) if (child.exam == exam) child.checked = false, this.list.remove({ exam: child.exam }) },
        all(reverse) { for (let child of reverse ? Array.from(this.elem.children).reverse() : this.elem.children) if (child.tagName == 'I-EXAM') child.checked = true, this.list.add(child) },
        stop() {
            this.elem.mode = 'normal'
            this.elem.classList.remove('select')
        }
    }

    async search(query, filter, timeout) {
        var random = this.random.search = Math.random()
        await new Promise(res => {
            setTimeout(async () => {
                if (random != this.random.search) return res(false)
                this.innerHTML = '<i-loading></i-loading>', this.classList.add('loading')
                random = Math.random()
                this.random.search = random
                const data = await eval('session').search('exams', query ?? '', { filter: `${filter?.['publishers'].map(v => v.id) ?? ''};${filter?.['exams.categories'].map(v => v.id) ?? ''};${filter?.['users'].map(v => v.id) ?? ''}` })
                if (this.random.search == random) this.innerHTML = '', this.concat(data), this.classList.remove('loading')
                res(true)
            }, timeout)
        })
    }
}

customElements.define('i-exams', IcraatExams)
//}}}



//{{{ IcraatFancyList 
class IcraatFancyList extends HTMLElement {
    constructor() {
        super()
        this._schema = []
        this._list = []
        this.clickToRemove = this.getAttribute('i-clicktoremove') !== null 
        this.onremove = null
    }

    set schema(schema) {
        this._schema = []
        this._schema.push( { html: schema.replace(/([\s\S]*?){([\s\S]*?)}/g, (_, html, js) => {
            if (html) this._schema.push({ html })
            if (js) this._schema.push({ js })
            return ''
        }) })
    }
    
    get list() { return this._list.map(v => v.data) }
    concat(data) { for (let i of data) this.push(i) }
    concat2d(data) {
        for (let list of data) if (list.length) this.concat(list), this.hr()
        this.lastChild?.remove()
        if (this.firstChild?.tagName == 'HR') this.firstChild.remove()
    }
    hr() { this.appendChild(d.createElement('hr')) }
    push(data) {
        const elem = d.createElement('div')
        elem.innerHTML = this._schema.map(v => {
            if (v.html) return v.html
            return eval(v.js)
        }).join('')
        elem.onclick = () => { 
            if (this.clickToRemove) {
                this.remove(data), this.onremove?.(data)
                if (this.lastChild?.tagName == 'HR') this.lastChild.remove()
                if (this.firstChild?.tagName == 'HR') this.firstChild.remove()
            }
        }
        elem.data = data
        this.appendChild(elem)
        this._list.push(elem)
    }
    remove(data, by) { 
        for (let child of this.children) if (eval(`child.data${by ?? ''} == data`)) child.remove()
        this._list.remove(e => eval(`e.data${by} == data`))
    }
    clear() { this._list = [], this.innerHTML = '' }
}
customElements.define('i-fancylist', IcraatFancyList)
//}}}



//{{{ IcraatSearch
class IcraatSearch extends HTMLElement {
    constructor() {
        super()
        this.random = {}
        this.classList.add(this.type)

        switch (this.type) {
            // {{{ checkbox
            case 'checkbox':
                this.innerHTML = `
                    <div class="title">
                        <h4></h4>
                        <input placeholder="Ara" />
                    </div>
                    <i-loading></i-loading>
                    <ul class="checkbox-ul"></ul>`
                this.querySelector('h4').innerText = this.title
                
                this.list = []
                this.ul = this.querySelector('ul')
                this.concat = items => {
                    for (let item of items) {
                        let element = d.createElement('li')
                        element.onclick = () => {
                            if (element.classList.contains('active')) this.list.remove(item)
                            else this.list.push(item)
                            element.classList.toggle('active')
                        }
                        if (this.list.includes(item)) element.classList.add('active')
                        element.innerText = item.name
                        this.ul.appendChild(element)
                    }
                }
                this.search = async query => {
                    this.loading = true
                    this.ul.innerHTML = ''
                    const random = Math.random()
                    this.random.search = random
                    var data = await eval(this.searchfunction)(query)
                    if (this.random.search == random) this.classList.remove('loading'), this.concat(data)
                }
                this.querySelector('input').oninput = ({ target: { value } }) => {
                    clearTimeout(this.search.timeout)
                    this.search.timeout = setTimeout(() => this.search(value), 300)
                }
                break
            // }}}
            case 'single':
                this.innerHTML = `
                    <div class="title">
                        <h4></h4>
                        <span class="select">
                            <span class="text">Seç</span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z"/>
                            </svg>
                        </span>
                    </div>
                    <div class="search">
                        <div>
                            <div>
                                <input placeholder="Ara" />
                                <svg class="close" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </div>
                            <ul class="checkbox-ul"><i-loading></i-loading></ul>
                        </div>
                    </div>`
                this.value = null
                this.selected = this.querySelector('.title .select .text')

                this.querySelector('h4').innerText = this.title
                this.search = this.querySelector('.search')
                this.search.div = this.search.children[0]
                
                this.ul = this.querySelector('ul')
                this.concat = items => {
                    for (let item of items) {
                        let element = d.createElement('li')
                        if (this.value == item) element.classList.add('active')
                        element.onclick = () => {
                            for (let li of this.ul.children) li.classList.remove('active')
                            element.classList.add('active'), this.value = item
                            this.selected.innerText = item.name
                            if (this.oninput) this.oninput(item)
                            if (this.open) this.toggle()
                        }
                        element.innerText = item.name
                        this.ul.appendChild(element)
                    }
                }
                this.search.f = async query => {
                    this.loading = true
                    this.ul.innerHTML = '<i-loading></i-loading>'
                    const random = Math.random()
                    this.random.search = random
                    var data = await eval(this.searchfunction)(query)
                    this.ul.innerHTML = ''
                    if (this.random.search == random) this.concat(data)
                }
                this.querySelector('input').oninput = ({ target: { value } }) => {
                    clearTimeout(this.search.timeout)
                    this.search.timeout = setTimeout(() => this.search.f(value), 300)
                }

                this.querySelector('.title .select').onclick = () => this.toggle()
                this.toggle = async () => {
                    if (this.open) setTimeout(() => this.search.style.display = 'none', 300), this.search.style.setProperty('--x', -this.search.div.offsetWidth + 'px')
                    else { 
                        for (let i of d.getElementsByTagName('i-search')) if (i.type == 'single' && i.open) i.toggle()
                        this.search.style.display = 'block', requestAnimationFrame(() => this.search.style.setProperty('--x', '0'))
                        this.search.f('') 
                    }
                    this.open = !this.open
                }
                this.querySelector('.close').onclick = () => { if (this.open) this.toggle() }
                requestAnimationFrame(() => { this.open = true, this.toggle() })
                break

            default: this.innerHTML = 'invalid type'
        }
    }
    get type() { return this.getAttribute('i-type') }
    get title() { return this.getAttribute('i-title') }
    get searchfunction() { return this.getAttribute('i-searchfunction') }

    set loading(v) { 
        if (v) this.classList.add('loading')
        else this.classList.remove('loading')
    }

    async load(opt) {
    }
}
customElements.define('i-search', IcraatSearch)
