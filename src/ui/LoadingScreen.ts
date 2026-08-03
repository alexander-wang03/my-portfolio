import gsap from 'gsap'
import EventEmitter from '../engine/Utils/EventEmitter'
import { FULL_NAME, TAGLINE } from '../content/portfolio'

export default class LoadingScreen extends EventEmitter {
    element: HTMLDivElement
    private progressFill: HTMLDivElement
    private progressBar: HTMLDivElement
    private promptText: HTMLParagraphElement
    private ready = false

    constructor() {
        super()

        this.element = document.createElement('div')
        this.element.className = 'loading-screen'

        const title = document.createElement('h1')
        title.className = 'loading-title'
        title.textContent = FULL_NAME
        this.element.appendChild(title)

        const subtitle = document.createElement('p')
        subtitle.className = 'loading-subtitle'
        subtitle.textContent = TAGLINE
        this.element.appendChild(subtitle)

        this.progressBar = document.createElement('div')
        this.progressBar.className = 'loading-progress'
        this.progressFill = document.createElement('div')
        this.progressFill.className = 'loading-progress-fill'
        this.progressBar.appendChild(this.progressFill)
        this.element.appendChild(this.progressBar)

        this.promptText = document.createElement('p')
        this.promptText.className = 'loading-prompt'
        this.promptText.textContent = 'Loading...'
        this.element.appendChild(this.promptText)

        document.body.appendChild(this.element)

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
