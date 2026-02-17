import gsap from 'gsap'
import EventEmitter from '../engine/Utils/EventEmitter'

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
        title.textContent = 'ALEXANDER WANG'
        this.element.appendChild(title)

        const subtitle = document.createElement('p')
        subtitle.className = 'loading-subtitle'
        subtitle.textContent = 'Portfolio'
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
        gsap.to(this.element, {
            opacity: 0,
            duration: 1.5,
            ease: 'power2.inOut',
            onComplete: () => {
                this.element.remove()
                this.trigger('start')
            },
        })
    }
}
