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

    constructor(private options: PerfMonitorOptions) {
        this.element = document.createElement('div')
        this.element.className = 'perf-monitor'
        // Chrome for the developer, not content — never announce it
        this.element.setAttribute('aria-hidden', 'true')
        document.body.appendChild(this.element)

        this.options.time.on('tick', () => this.update())
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
