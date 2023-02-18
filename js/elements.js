customElements.define('icraat-exam', class extends HTMLElement {
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
            const element = target.closest('icraat-exam')
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