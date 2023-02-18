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
                <span class="date">DATE<span>
            </div>
            <div class="actions">
                <button class="view" onclick="app.redirect('/sonuç/${exam.id}')">
                    <svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"></path>
                    </svg>
                </button>
                <div class="select"></div>
            </div>`
        this.querySelector('.category').innerText = exam.category.name
        this.querySelector('.publisher').innerText = exam.publisher.name
        this.querySelector('.name').innerText = exam.name
        this.querySelector('.date').innerText = new Intl.DateTimeFormat(navigator.language, { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).format(exam.timestamp)
        this.querySelector('.select').onclick = ({ target }) => {
            const element = target.closest('i-exam')
            element.checked = !element.checked
            if (this.oncheck) this.oncheck(this)
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
                const data = await eval('session').dashboard.examsSearch('exams', query ?? '', { filter: `${filter?.['publishers'].map(v => v.id) ?? ''};${filter?.['exams.categories'].map(v => v.id) ?? ''}` })
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
        this.clickToRemove = this.getAttribute('clicktoremove') !== null 
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
