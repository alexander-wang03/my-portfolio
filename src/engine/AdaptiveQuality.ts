import type * as THREE from 'three'
import type { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import type { Pass } from 'three/examples/jsm/postprocessing/Pass.js'
import type Shadows from '../world/Shadows'
import type Time from './Utils/Time'
import type { QualitySettings } from './Quality'

export interface AdaptiveQualityOptions {
    time: Time
    renderer: THREE.WebGLRenderer
    composer: EffectComposer
    quality: QualitySettings
    blurPasses: Pass[]
    shadows: Shadows
}

/** Median frame time at or under this counts as holding 60fps. */
const HOLD_BUDGET = 19

/** Above this (~38fps) the device is struggling and wants a step down. */
const STRUGGLE_BUDGET = 26

/** Milliseconds of frames gathered before each decision. */
const SAMPLE_WINDOW = 1500

/** Frames straight after a change are unrepresentative; ignore this long. */
const SETTLE_TIME = 600

interface Rung {
    pixelRatio: number
    blur: boolean
    shadowItems: number
    shadowDistance: number
}

/**
 * Quality settings in one order, cheapest first.
 *
 * A single ladder rather than three independent dials, because three dials
 * cannot be measured independently: frame time only says whether the whole
 * frame fits, so changing one thing at a time and re-measuring is the only way
 * to attribute the cost. Walking one list keeps every step attributable.
 *
 * The order is what to spend headroom on next. Resolution first, up to the
 * point where a phone screen stops obviously benefiting, then the tilt-shift
 * blur, which is the most visible single effect here, and shadow range last —
 * it is the least noticeable per frame spent.
 */
const LADDER: Rung[] = [
    { pixelRatio: 1.00, blur: false, shadowItems: 48, shadowDistance: 26 },
    { pixelRatio: 1.25, blur: false, shadowItems: 48, shadowDistance: 26 },
    { pixelRatio: 1.50, blur: false, shadowItems: 48, shadowDistance: 26 },
    { pixelRatio: 1.75, blur: false, shadowItems: 48, shadowDistance: 26 },
    { pixelRatio: 1.75, blur: true, shadowItems: 48, shadowDistance: 26 },
    { pixelRatio: 2.00, blur: true, shadowItems: 48, shadowDistance: 26 },
    { pixelRatio: 2.00, blur: true, shadowItems: 128, shadowDistance: 45 },
]

/**
 * Finds the quality a device can actually hold, by trying and measuring.
 *
 * `detectQuality` has to choose before a single frame has been drawn, and its
 * only real signal is whether the pointer is coarse — so every touchscreen is
 * treated as weak. A flagship phone was being held to a quarter of its
 * screen's pixels with the blur switched off, while a laptop reporting a pixel
 * ratio of 1 was handed a cap it could never use.
 *
 * Headroom cannot be read directly: vsync pins a device with plenty to spare
 * at the same frame time as one with none. So it probes — take a step up,
 * measure, and keep it only if the frame time still holds. Once a probe fails
 * it stops for good, which is what stops it hunting between two rungs for the
 * rest of the session.
 */
export default class AdaptiveQuality {
    private frames: number[] = []
    private windowStart = 0
    private settleUntil = 0
    private running = false
    private finished = false
    /** Set once a step up has been rejected; from then on it only comes down. */
    private probeFailed = false
    private rung: number

    constructor(private options: AdaptiveQualityOptions) {
        this.rung = this.startingRung()
        this.options.time.on('tick', () => this.update())
    }

    /** Which rung the startup guess corresponds to: the best it allows. */
    private startingRung(): number {
        const { quality } = this.options

        const allowed = LADDER.filter((rung) =>
            rung.pixelRatio <= quality.maxPixelRatio &&
            (!rung.blur || quality.blur) &&
            rung.shadowItems <= quality.maxObjectShadows,
        )

        return Math.max(0, LADDER.indexOf(allowed[allowed.length - 1] ?? LADDER[0]))
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

    /** The rung in force, for the debug readout. */
    get current(): Rung {
        return LADDER[this.rung]
    }

    private apply(): void {
        const { renderer, composer, blurPasses, shadows } = this.options
        const rung = LADDER[this.rung]

        // Never ask for more pixels than the screen actually has
        const ratio = Math.min(rung.pixelRatio, window.devicePixelRatio)
        renderer.setPixelRatio(ratio)
        composer.setPixelRatio(ratio)

        for (const pass of blurPasses) pass.enabled = rung.blur
        shadows.setLimits(rung.shadowItems, rung.shadowDistance)
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
        if (median > STRUGGLE_BUDGET && this.rung > 0) {
            this.rung--
            this.apply()
            // Coming down means the last step up was too ambitious, or the
            // guess was over its head to begin with. Either way, stop reaching.
            this.probeFailed = true
            return
        }

        if (this.probeFailed) {
            this.finished = true
            return
        }

        if (median <= HOLD_BUDGET && this.rung < LADDER.length - 1) {
            this.rung++
            this.apply()
            return
        }

        // Holding, and either at the top of the ladder or in the dead band
        // between the two budgets. Nothing left worth changing.
        this.finished = true
    }
}
