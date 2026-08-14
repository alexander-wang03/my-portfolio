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
    private promptText: HTMLElement
    private ready = false

    constructor() {
        super()

        const element = document.querySelector<HTMLElement>('.loading-screen')
        const progressBar = element?.querySelector<HTMLElement>('.loading-progress')
        const progressFill = element?.querySelector<HTMLElement>('.loading-progress-fill')
        const promptText = element?.querySelector<HTMLElement>('.loading-prompt')

        if (!element || !progressBar || !progressFill || !promptText) {
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
        this.promptText = promptText

        this.element.addEventListener('click', () => {
            if (!this.ready) return
            this.hide()
        })
    }

    setProgress(value: number): void {
        this.progressFill.style.width = `${Math.min(value * 100, 100)}%`
    }

    setReady(): void {
        this.ready = true
        this.progressFill.style.width = '100%'
        this.promptText.textContent = 'Click to Explore'
        this.promptText.classList.add('loading-prompt-ready')
        gsap.to(this.progressBar, { opacity: 0, duration: 0.5 })
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
