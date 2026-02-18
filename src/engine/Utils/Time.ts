import EventEmitter from './EventEmitter'

export default class Time extends EventEmitter {
    start: number
    current: number
    elapsed: number
    delta: number
    private ticker: number

    constructor() {
        super()

        this.start = Date.now()
        this.current = this.start
        this.elapsed = 0
        this.delta = 16
        this.ticker = 0

        this.tick = this.tick.bind(this)
        this.tick()
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

    stop(): void {
        window.cancelAnimationFrame(this.ticker)
    }
}
