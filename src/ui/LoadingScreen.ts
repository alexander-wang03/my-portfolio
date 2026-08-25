import gsap from 'gsap'
import EventEmitter from '../engine/Utils/EventEmitter'

/**
 * Drives the loading screen that is already in the page.
 *
 * The markup is injected into index.html at build time (`content/loading.ts`)
 * rather than built here. Built here it could not appear until this bundle had
 * downloaded and parsed, which is precisely the wait it exists to cover — the
 * visitor got a blank page for the whole download and the loading screen only
 * afterwards, with nothing left to load.
 */
export default class LoadingScreen extends EventEmitter {
    element: HTMLElement
    private progressFill: HTMLElement
    private progressBar: HTMLElement
    private promptButton: HTMLButtonElement
    private ready = false

    constructor() {
        super()

        const element = document.querySelector<HTMLElement>('.loading-screen')
        const progressBar = element?.querySelector<HTMLElement>('.loading-progress')
        const progressFill = element?.querySelector<HTMLElement>('.loading-progress-fill')
        const promptButton = element?.querySelector<HTMLButtonElement>('.loading-prompt')

        if (!element || !progressBar || !progressFill || !promptButton) {
            // Thrown rather than patched over: Application is constructed inside
            // a try/catch that drops to the readable fallback, which is a better
            // outcome than a world nobody can see past a broken overlay
            throw new Error(
                '[LoadingScreen] markup missing from the page. It is injected ' +
                'into index.html by the portfolio-fallback-content plugin, ' +
                'which replaces the <!--loading-screen--> comment.',
            )
        }

        this.element = element
        this.progressBar = progressBar
        this.progressFill = progressFill
        this.promptButton = promptButton

        // On the overlay, not the button. Clicking anywhere dismisses, as it
        // always has — and a keyboard press on the button emits a click that
        // bubbles up to here, so Enter and Space arrive by the same route with
        // no second handler to keep in step.
        this.element.addEventListener('click', () => {
            if (!this.ready) return
            this.hide()
        })
    }

    setProgress(value: number): void {
        // Also covers the case where the download was never measurable — in
        // dev, or without PerformanceObserver — and the bar is still sweeping
        this.progressBar.classList.remove('loading-progress--indeterminate')
        this.progressFill.style.width = `${Math.min(value * 100, 100)}%`
    }

    setReady(): void {
        this.ready = true
        this.progressFill.style.width = '100%'
        this.promptButton.textContent = 'Click to Explore'
        this.promptButton.classList.add('loading-prompt-ready')
        this.promptButton.disabled = false
        gsap.to(this.progressBar, { opacity: 0, duration: 0.5 })

        // Hand focus to the way in, so Enter works without hunting for it.
        // Only from a standing start: if the visitor has already tabbed
        // somewhere — the skip link is the one other stop — leave them there.
        const active = document.activeElement
        if (!active || active === document.body) this.promptButton.focus()
    }

    /**
     * Say so, rather than loading forever.
     *
     * A bar that simply stops is indistinguishable from a slow connection, so
     * it can hide a bug for as long as someone is willing to wait. The skip
     * link is still the way out, and it is the first thing Tab reaches.
     */
    setFailed(): void {
        this.ready = false
        this.progressBar.classList.remove('loading-progress--indeterminate')
        this.progressFill.style.background = '#ff6b5e'
        this.promptButton.textContent = 'Could not load — see the console'
        this.promptButton.disabled = true
    }

    private hide(): void {
        this.ready = false

        // Start the reveal on the click rather than after the fade — waiting
        // leaves the player staring at a terrain whose objects are all still
        // buried, then popping them in at once.
        this.trigger('start')

        // Stop the fading overlay swallowing clicks meant for the world
        this.element.style.pointerEvents = 'none'

        gsap.to(this.element, {
            opacity: 0,
            duration: 0.8,
            ease: 'power2.inOut',
            onComplete: () => {
                this.element.remove()
            },
        })
    }
}
