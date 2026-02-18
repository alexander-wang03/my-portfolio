export interface HUDOptions {
    onMuteToggle?: () => boolean
}

export default class HUD {
    private sectionEl: HTMLDivElement
    private hintsEl: HTMLDivElement
    private currentSection = ''

    constructor() {
        // Section name indicator
        this.sectionEl = document.createElement('div')
        this.sectionEl.className = 'hud-section-name'
        document.body.appendChild(this.sectionEl)

        // Keyboard hints
        this.hintsEl = document.createElement('div')
        this.hintsEl.className = 'hud-hints'
        this.hintsEl.innerHTML = `
            <span>WASD / Arrows</span> Drive
            <span>Space</span> Brake
            <span>Shift</span> Boost
            <span>R</span> Reset
            <span>M</span> Mute
        `
        document.body.appendChild(this.hintsEl)

        // Fade out hints after 6 seconds or first keypress
        const hideHints = () => {
            this.hintsEl.classList.add('hidden')
            window.removeEventListener('keydown', hideHints)
        }
        setTimeout(hideHints, 6000)
        window.addEventListener('keydown', hideHints)
    }

    showSection(name: string): void {
        if (name === this.currentSection) return
        this.currentSection = name

        this.sectionEl.textContent = name
        this.sectionEl.classList.add('visible')
    }

    hideSection(): void {
        this.currentSection = ''
        this.sectionEl.classList.remove('visible')
    }
}
