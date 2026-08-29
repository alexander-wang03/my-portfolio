import type * as THREE from 'three'
import type Time from '../engine/Utils/Time'
import type { QualitySettings } from '../engine/Quality'

export interface PerfMonitorOptions {
    time: Time
    renderer: THREE.WebGLRenderer
    quality: QualitySettings
}

/** How many frames the rolling window holds. ~2s at 60fps, ~4s at 30. */
const WINDOW = 120

/** Milliseconds between redraws of the text. */
const REDRAW_INTERVAL = 250

/** Where the dragged position is kept between reloads. */
const POSITION_KEY = 'perf-monitor-position'

/**
 * Frame-time readout for `#debug`.
 *
 * The quality tiers in `Quality.ts` were reasoned about rather than measured —
 * chosen from what *ought* to be expensive, with no way to check the guess on
 * a real phone. This is that way.
 *
 * It reports the 1% low as well as the average, because averages hide exactly
 * the problem worth finding: a scene that averages a comfortable 55fps while
 * hitching to 20 several times a second feels far worse than its average, and
 * the hitches are what the tiers exist to prevent.
 */
export default class PerfMonitor {
    private element: HTMLElement
    private frames: number[] = []
    private lastRedraw = 0
    private counters = new Map<string, number>()
    private dragging = false
    private x = 0
    private y = 0

    constructor(private options: PerfMonitorOptions) {
        this.element = document.createElement('div')
        this.element.className = 'perf-monitor'
        // Chrome for the developer, not content — never announce it
        this.element.setAttribute('aria-hidden', 'true')
        document.body.appendChild(this.element)

        this.options.time.on('tick', () => this.update())

        this.restorePosition()
        this.setDragging()

        // Rotating a phone can leave it off-screen entirely
        window.addEventListener('resize', () => this.moveTo(this.x, this.y))
    }

    /**
     * Let it be dragged anywhere.
     *
     * Every fixed corner is the wrong one on a phone: the top left collides
     * with dat.gui, which pins itself to the top right at a width wider than
     * the screen, and the bottom is where the joystick and buttons live. Rather
     * than keep choosing, it goes where it is put, and stays there across
     * reloads so a position only has to be chosen once.
     *
     * Pointer events rather than touch events, so the same code serves a
     * finger and a mouse.
     */
    private setDragging(): void {
        let grabX = 0
        let grabY = 0

        this.element.addEventListener('pointerdown', (event) => {
            event.preventDefault()
            this.element.setPointerCapture(event.pointerId)
            const box = this.element.getBoundingClientRect()
            grabX = event.clientX - box.left
            grabY = event.clientY - box.top
            this.dragging = true
        })

        this.element.addEventListener('pointermove', (event) => {
            if (!this.dragging) return
            this.moveTo(event.clientX - grabX, event.clientY - grabY)
        })

        const drop = (event: PointerEvent) => {
            if (!this.dragging) return
            this.dragging = false
            this.element.releasePointerCapture(event.pointerId)
            try {
                localStorage.setItem(POSITION_KEY, JSON.stringify({ x: this.x, y: this.y }))
            } catch {
                // Private browsing, or storage full. Not worth a word.
            }
        }
        this.element.addEventListener('pointerup', drop)
        this.element.addEventListener('pointercancel', drop)
    }

    /** Clamped, so it can never be dragged or rotated out of reach. */
    private moveTo(x: number, y: number): void {
        const box = this.element.getBoundingClientRect()
        this.x = Math.max(0, Math.min(x, window.innerWidth - box.width))
        this.y = Math.max(0, Math.min(y, window.innerHeight - box.height))
        this.element.style.left = `${this.x}px`
        this.element.style.top = `${this.y}px`
    }

    private restorePosition(): void {
        try {
            const saved = localStorage.getItem(POSITION_KEY)
            if (!saved) return
            const { x, y } = JSON.parse(saved)
            if (typeof x === 'number' && typeof y === 'number') this.moveTo(x, y)
        } catch {
            // A corrupt value just means it opens where it always did
        }
    }

    /**
     * Count something that happens, for the readout.
     *
     * Exists so the panel can answer "is this not firing, or firing and not
     * being heard?" — the question that separates a physics problem from an
     * audio one, and which took several rounds of guessing to settle once.
     */
    count(name: string): void {
        this.counters.set(name, (this.counters.get(name) ?? 0) + 1)
    }

    private update(): void {
        const { time, renderer, quality } = this.options

        this.frames.push(time.delta)
        if (this.frames.length > WINDOW) this.frames.shift()

        if (time.elapsed - this.lastRedraw < REDRAW_INTERVAL) return
        this.lastRedraw = time.elapsed

        const sorted = [...this.frames].sort((a, b) => a - b)
        const mean = this.frames.reduce((sum, n) => sum + n, 0) / this.frames.length
        // The worst 1% of frames — the hitches an average hides
        const low = sorted[Math.floor(sorted.length * 0.99)] ?? mean

        const info = renderer.info.render
        const counters = [...this.counters]
            .map(([name, n]) => `${name} ${n}`)
            .join('   ')

        this.element.textContent = [
            `${(1000 / mean).toFixed(0)} fps   ${mean.toFixed(1)} ms`,
            `1% low  ${(1000 / low).toFixed(0)} fps   ${low.toFixed(1)} ms`,
            `${quality.tier}  dpr ${renderer.getPixelRatio().toFixed(2)}/${window.devicePixelRatio}`,
            `${info.calls} draws   ${(info.triangles / 1000).toFixed(0)}k tris`,
            `${window.innerWidth}x${window.innerHeight}   shadows ${quality.maxObjectShadows}  blur ${quality.blur ? 'on' : 'off'}`,
            counters,
        ].filter(Boolean).join('\n')
    }
}
