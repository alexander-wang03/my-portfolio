import EventEmitter from './EventEmitter'

export default class Time extends EventEmitter {
    start: number
    current: number
    elapsed: number
    delta: number
    private ticker: number
    private running: boolean

    constructor() {
        super()

        this.start = Date.now()
        this.current = this.start
        this.elapsed = 0
        this.delta = 16
        this.ticker = 0
        this.running = false

        this.tick = this.tick.bind(this)
        this.play()
    }

    private tick(): void {
        this.ticker = window.requestAnimationFrame(this.tick)

        const current = Date.now()
        this.delta = current - this.current
        this.elapsed = current - this.start
        this.current = current

        if (this.delta > 60) {
            this.delta = 60
        }

        this.trigger('tick')
    }

    /**
     * Start ticking, or resume after `stop()`. Safe to call when already
     * running — a second `requestAnimationFrame` loop would double every
     * physics step and every animation on the page.
     *
     * `current` is reset before restarting because it still holds the
     * timestamp from before the pause, so the first frame back would report
     * the entire gap as one delta. The clamp below would cap it at 60ms, but a
     * clamped lie is still a lie: the world would lurch forward as though the
     * rover had kept driving while the context was gone.
     */
    play(): void {
        if (this.running) return

        this.running = true
        this.current = Date.now()
        this.tick()
    }

    stop(): void {
        this.running = false
        window.cancelAnimationFrame(this.ticker)
    }
}
