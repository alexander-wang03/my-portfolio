import type * as THREE from 'three'
import type { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import type Time from './Utils/Time'
import type { QualitySettings } from './Quality'

export interface AdaptiveResolutionOptions {
    time: Time
    renderer: THREE.WebGLRenderer
    composer: EffectComposer
    quality: QualitySettings
}

/** Median frame time at or under this counts as holding 60fps. */
const HOLD_BUDGET = 19

/** Above this (~38fps) the device is struggling and wants a step down. */
const STRUGGLE_BUDGET = 26

/** Milliseconds of frames gathered before each decision. */
const SAMPLE_WINDOW = 1500

/** Frames right after a resize are unrepresentative; ignore this long. */
const SETTLE_TIME = 600

const STEP = 0.25
const FLOOR = 1
/** Past this the cost stops buying visible sharpness on any screen. */
const CEILING = 2

/**
 * Corrects the pixel ratio against what the device can actually do.
 *
 * `detectQuality` has to guess before a single frame has been drawn, and its
 * only real signal is whether the pointer is coarse — so every touchscreen is
 * treated as weak. A flagship phone with a 3x screen was being held at 1.5,
 * which is a quarter of the pixels its display can show, while a laptop
 * reporting a pixel ratio of 1 was handed a cap of 2 that could never apply.
 *
 * Resolution is the right thing to adapt: cost scales with its square, making
 * it the largest lever, and it is the only setting that can be changed after
 * startup — shadow counts and the blur passes are wired into the composer and
 * the shadow buffer when those are built.
 *
 * Headroom cannot be measured directly, because vsync pins a device with
 * plenty to spare at the same frame time as one with none. So it probes: step
 * up, measure, and keep the step only if the frame time still holds. Once a
 * probe fails it stops for good, which is what keeps this from oscillating
 * between two ratios for the rest of the session.
 */
export default class AdaptiveResolution {
    private frames: number[] = []
    private windowStart = 0
    private settleUntil = 0
    private running = false
    private finished = false
    /** Set once a probe upward has been rejected; no further changes. */
    private settled = false

    constructor(private options: AdaptiveResolutionOptions) {
        this.options.time.on('tick', () => this.update())
    }

    /**
     * Begin measuring. Called once the world is on screen — frames during the
     * reveal are dominated by shader compilation and say nothing useful.
     */
    start(): void {
        this.running = true
        this.windowStart = this.options.time.elapsed
        this.settleUntil = this.options.time.elapsed + SETTLE_TIME
    }

    private get ratio(): number {
        return this.options.renderer.getPixelRatio()
    }

    private set ratio(value: number) {
        this.options.renderer.setPixelRatio(value)
        this.options.composer.setPixelRatio(value)
    }

    private update(): void {
        if (!this.running || this.finished) return

        const { time } = this.options
        if (time.elapsed < this.settleUntil) return

        this.frames.push(time.delta)
        if (time.elapsed - this.windowStart < SAMPLE_WINDOW) return

        const sorted = [...this.frames].sort((a, b) => a - b)
        const median = sorted[Math.floor(sorted.length / 2)] ?? HOLD_BUDGET

        this.frames = []
        this.windowStart = time.elapsed
        this.settleUntil = time.elapsed + SETTLE_TIME

        this.decide(median)
    }

    private decide(median: number): void {
        const cap = Math.min(window.devicePixelRatio, CEILING)

        if (median > STRUGGLE_BUDGET && this.ratio > FLOOR) {
            this.ratio = Math.max(FLOOR, this.ratio - STEP)
            // Dropping means the last step up was too ambitious, or the device
            // was over its head to begin with. Either way, stop reaching.
            this.settled = true
            return
        }

        if (this.settled) {
            this.finished = true
            return
        }

        if (median <= HOLD_BUDGET && this.ratio < cap) {
            this.ratio = Math.min(cap, this.ratio + STEP)
            return
        }

        // Holding, and either at the cap or in the dead band between the two
        // budgets. Nothing left worth changing.
        this.finished = true
    }
}
