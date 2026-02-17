export default class SectionOverlay {
    private element: HTMLDivElement
    private _visible: boolean

    constructor() {
        this.element = document.createElement('div')
        this.element.className = 'section-overlay'
        document.body.appendChild(this.element)
        this._visible = false
    }

    get visible(): boolean {
        return this._visible
    }

    show(html: string): void {
        this.element.innerHTML = html
        // Force reflow before adding class for transition
        void this.element.offsetHeight
        this.element.classList.add('visible')
        this._visible = true
    }

    hide(): void {
        this.element.classList.remove('visible')
        this._visible = false
    }
}
