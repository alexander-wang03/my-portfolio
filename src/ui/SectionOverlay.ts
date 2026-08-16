export default class SectionOverlay {
    private element: HTMLDivElement
    private _visible: boolean

    constructor() {
        this.element = document.createElement('div')
        this.element.className = 'section-overlay'
        document.body.appendChild(this.element)

        this._visible = false
        this.setReachable(false)
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
        this.setReachable(true)
    }

    hide(): void {
        this.element.classList.remove('visible')
        this._visible = false
        this.setReachable(false)
    }

    /**
     * Keep the panel's reach in step with whether it is on screen.
     *
     * The panel hides by sliding to `right: -380px`, which moves it out of
     * sight and leaves it fully in the tab order. Tabbing through the page
     * therefore landed on the résumé, GitHub, LinkedIn and project links of
     * whichever section was last open, invisibly and with no focus indicator
     * anywhere on screen. `aria-hidden` on top of that is the specific
     * combination axe reports as a serious violation — focus can enter a
     * subtree that screen readers are told to ignore, so the user is moved
     * somewhere nothing can describe.
     *
     * `inert` fixes both halves at once: it drops the subtree from the tab
     * order and from the accessibility tree.
     *
     * Toggled rather than left on permanently, so an open panel is genuinely
     * reachable. `aria-hidden` was originally justified as avoiding a double
     * announcement with the plain-HTML fallback, but that fallback is
     * `display: none` whenever JavaScript is running, so there was never a
     * second copy to collide with.
     */
    private setReachable(reachable: boolean): void {
        this.element.inert = !reachable
        // Belt and braces for Safari before 15.5 and Firefox before 112, which
        // ignore `inert` entirely and would otherwise keep the old behaviour
        this.element.setAttribute('aria-hidden', String(!reachable))
    }
}
