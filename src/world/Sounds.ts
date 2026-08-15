import { Howl, Howler } from 'howler'
import gsap from 'gsap'
import type Time from '../engine/Utils/Time'
import type Physics from './Physics'
import type { ImpactMaterial } from './Physics'

/** Contacts resolve in clusters, so collapse them into one audible hit. */
const MIN_IMPACT_INTERVAL = 0.06

/** Milliseconds between horns. Holding the key repeats keydown, so it needs one. */
const HORN_COOLDOWN = 350

const lerp = (range: [number, number], t: number) => range[0] + (range[1] - range[0]) * t

/**
 * Recorded impact samples, from folio-2019 (MIT, (c) 2019 Bruno Simon).
 *
 * Its playback shape is worth keeping: several takes per material picked at
 * random, plus a randomised playback rate, so repeated hits never sound
 * mechanically identical. Volume is squared before use, which makes soft hits
 * fall away much faster than a linear ramp and matches how impacts actually
 * behave.
 */
interface ImpactSample {
    sources: string[]
    volume: [number, number]
    /** Playback rate is randomised in this range, re-pitching each take. */
    rate: [number, number]
}

/**
 * Anything played from a set of takes at a strength, which is more than just
 * collisions — a landing and a skid want the same treatment.
 */
type SampleName = ImpactMaterial | 'landing' | 'screech'

const SAMPLES: Partial<Record<SampleName, ImpactSample>> = {
    // The rover was the last thing still synthesised, and the sampled engine
    // loop is far louder than the oscillator it replaced — a 60-96 Hz thump
    // simply disappeared underneath it. These sit well clear of the engine.
    default: {
        sources: [1, 3, 4, 5].map((n) => `/sounds/car-hits/car-hit-${n}.mp3`),
        volume: [0.35, 0.9],
        rate: [0.8, 1.1],
    },
    // Landing, using the same takes pitched down and held back. Ground contact
    // is the one impact that happens whether or not you did anything, so it
    // stays the quietest — a thump under the engine, not a crash over it.
    terrain: {
        sources: [1, 3, 4, 5].map((n) => `/sounds/car-hits/car-hit-${n}.mp3`),
        volume: [0.2, 0.55],
        rate: [0.7, 0.9],
    },
    // folio's bowling pin, pitched down — playback rate is the only pitch
    // control a sample has, and it stretches the sound as it lowers it, so
    // the floor stays off zero to keep hits from turning into drones
    letter: {
        sources: ['/sounds/bowling/pin-1.mp3'],
        volume: [0.35, 1],
        rate: [0.1, 0.45],
    },
    // folio's brick, which is what its own intro letters use.
    //
    // Near natural speed on purpose. Unlike the pin — a true transient with
    // 90% of its energy inside 5ms — the bricks spread theirs over ~150ms, so
    // folio's 0.5 rate stretched that to ~300ms. The result has no attack, and
    // a hit with no attack reads as arriving late rather than as a soft hit.
    block: {
        sources: [1, 2, 4, 6, 7, 8].map((n) => `/sounds/bricks/brick-${n}.mp3`),
        volume: [0.2, 0.85],
        rate: [0.85, 1.15],
    },
    // The suspension taking a drop. Same takes as an impact but pitched right
    // down, which turns the crack of a collision into the thump of a spring
    // bottoming out — it should read as weight landing, not as damage.
    landing: {
        sources: [1, 3, 4, 5].map((n) => `/sounds/car-hits/car-hit-${n}.mp3`),
        // Floors here are high because volume is squared and these two rarely
        // reach full strength: a measured landing averages 0.3 and a measured
        // slide 0.5, which off a 0.25 floor is a gain of 0.17 — inaudible
        // under the engine. Set from the strengths that actually occur.
        volume: [0.45, 0.9],
        rate: [0.5, 0.65],
    },
    // folio's screech, normalised — it shipped peaking at -14 dBFS, which is
    // well under the engine it has to cut through
    screech: {
        sources: ['/sounds/screeches/screech-1.mp3'],
        volume: [0.5, 0.85],
        rate: [0.9, 1.1],
    },
}

/**
 * When the tyres are judged to be sliding.
 *
 * Measured as a slip *angle* — sideways speed as a fraction of forward speed —
 * rather than an absolute sideways speed. It is the ratio that makes a slide a
 * slide: 3 units/s sideways is a lurid drift at walking pace and barely a
 * twitch at full speed, so any fixed figure is wrong at one end or the other.
 */
const SCREECH = {
    /** Below this there is no grip worth losing. */
    minSpeed: 6,
    /**
     * tan of the slip angle. These are measured, not guessed: `frictionSlip`
     * is 10, which is a lot of grip, and a full-lock corner at speed tops out
     * around 0.17 — under 10 degrees. An earlier 0.25 was simply unreachable,
     * so the screech never once played.
     *
     * 0.15 covers the hardest third of a full-lock corner and nothing gentler.
     * Dropping to 0.10 would catch 97% of all cornering, which is a rover that
     * screeches its way around every bend.
     */
    minSlip: 0.15,
    fullSlip: 0.17,
    /** The sample is only 0.32s, so this paces a long slide into repeats. */
    cooldown: 800,
}

/**
 * Engine model, lifted from folio-2019.
 *
 * The trick is that it is ONE seamless loop recorded at a constant RPM, with
 * playback rate and volume driven by how hard the rover is working. folio ships
 * a full multi-sample set — idle, low/med/high on and off, maxRPM, startup —
 * and loads exactly one 9 KB file of it. A layered RPM system is not what makes
 * this sound good; the eased rev level is.
 */
const ENGINE = {
    src: '/sounds/engine/loop.mp3',
    /** How much plain speed contributes to the rev level. */
    speedWeight: 0.85,
    /** Extra revs while accelerating, so pulling away sounds like effort. */
    accelerationWeight: 0.25,
    accelerationScale: 12,
    /** Revs climb fast and fall away slowly, the way a real throttle behaves. */
    easeUp: 0.3,
    easeDown: 0.12,
    rate: [0.55, 1.5] as [number, number],
    volume: [0.25, 0.9] as [number, number],
}

/** One-shot cues, keyed by name. Fixed level, one take, no strength. */
const CUES = {
    reveal: '/sounds/reveal/reveal-1.mp3',
    ui: '/sounds/ui/area-1.mp3',
    horn: '/sounds/car-horns/car-horn-1.mp3',
}

/**
 * Build a player that complains rather than failing silently.
 *
 * Howler swallows a 404 and simply never plays, which is indistinguishable
 * from a volume or trigger bug — worth guarding while these files are being
 * swapped for your own.
 */
function loadHowl(src: string, extra: { loop?: boolean; volume?: number } = {}): Howl {
    return new Howl({
        src: [src],
        preload: true,
        ...extra,
        onloaderror: () => {
            console.warn(
                `[Sounds] could not load "${src}". Paths are relative to static/, ` +
                `so static/sounds/foo.mp3 is referenced as /sounds/foo.mp3.`,
            )
        },
    })
}

export interface SoundsOptions {
    time: Time
    physics: Physics
}

export default class Sounds {
    private time: Time
    private physics: Physics
    private ctx: AudioContext | null = null
    private masterGain: GainNode | null = null
    private engine: Howl | null = null
    private engineProgress = 0
    /**
     * 0-1 ambience level, ramped by `fadeIn`. Public so gsap can tween it;
     * read once per tick by `update`.
     */
    ambience = 0
    private windSource: AudioBufferSourceNode | null = null
    private windGain: GainNode | null = null
    muted = false
    private started = false
    private lastImpactAt = 0
    private lastScreechAt = 0
    private lastHornAt = 0
    /** Loaded sample players, keyed by material. */
    private howls = new Map<SampleName, Howl[]>()
    private cues = new Map<keyof typeof CUES, Howl>()

    constructor(options: SoundsOptions) {
        this.time = options.time
        this.physics = options.physics

        this.setMuteKey()
        this.setVisibility()
        this.loadSamples()

        // Start audio on first user interaction (autoplay policy)
        const start = () => {
            if (this.started) return
            this.started = true
            this.initAudio()
            this.startEngine()
            window.removeEventListener('click', start)
            window.removeEventListener('keydown', start)
            window.removeEventListener('touchstart', start)
        }
        window.addEventListener('click', start)
        window.addEventListener('keydown', start)
        window.addEventListener('touchstart', start)

        this.physics.on('impact', (...args: unknown[]) => {
            this.playImpact(args[0] as number, args[1] as ImpactMaterial)
        })

        this.physics.on('land', (...args: unknown[]) => {
            this.playLanding(args[0] as number)
        })

        this.time.on('tick', () => this.update())
    }

    private initAudio(): void {
        this.ctx = new AudioContext()
        this.masterGain = this.ctx.createGain()
        this.masterGain.gain.value = 1.0
        this.masterGain.connect(this.ctx.destination)

        this.setupWind()
    }

    private setupWind(): void {
        if (!this.ctx || !this.masterGain) return

        // Create noise buffer for wind
        const bufferSize = this.ctx.sampleRate * 2
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
        const data = buffer.getChannelData(0)
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.5
        }

        this.windGain = this.ctx.createGain()
        this.windGain.gain.value = 0.02
        this.windGain.connect(this.masterGain)

        // Band-pass filter for wind character
        const filter = this.ctx.createBiquadFilter()
        filter.type = 'bandpass'
        filter.frequency.value = 300
        filter.Q.value = 0.5

        this.windSource = this.ctx.createBufferSource()
        this.windSource.buffer = buffer
        this.windSource.loop = true
        this.windSource.connect(filter)
        filter.connect(this.windGain)
        this.windSource.start()
    }

    private loadSamples(): void {
        for (const [name, sample] of Object.entries(SAMPLES)) {
            this.howls.set(
                name as SampleName,
                sample.sources.map((src) => loadHowl(src)),
            )
        }

        for (const [cue, src] of Object.entries(CUES)) {
            this.cues.set(cue as keyof typeof CUES, loadHowl(src))
        }
    }

    /**
     * Play a recorded hit.
     *
     * Every `ImpactMaterial` has samples, so the guard below is only reached if
     * one is added to `Physics` without a matching entry in `SAMPLES` — in
     * which case that material is silent, which is the point of the warning.
     */
    private playSample(strength: number, name: SampleName): void {
        const sample = SAMPLES[name]
        const players = this.howls.get(name)

        if (!sample || !players?.length) {
            console.warn(`[Sounds] no samples named "${name}"`)
            return
        }

        // A different take each time, so repeated hits do not sound looped
        const howl = players[Math.floor(Math.random() * players.length)]

        // Squared, like folio: soft hits drop away far faster than linearly
        howl.volume(Math.pow(lerp(sample.volume, strength), 2))
        howl.rate(lerp(sample.rate, Math.random()))
        howl.play()
    }

    /** A hit, played from that material's recorded samples. */
    playImpact(strength: number, material: ImpactMaterial = 'default'): void {
        if (!this.claimImpactSlot()) return
        this.playSample(strength, material)
    }

    /**
     * The suspension taking a landing.
     *
     * Kept out of the shared impact slot on purpose. Landing hard often
     * registers a chassis contact in the same frame, and sharing meant the
     * contact claimed the slot first and the landing was dropped — the
     * suspension going quiet exactly when it was working hardest. Physics
     * already rate-limits these, so nothing here needs to.
     */
    playLanding(strength: number): void {
        if (this.muted) return
        this.playSample(strength, 'landing')
    }

    /**
     * One knock's worth of the shared impact budget.
     *
     * Contacts resolve in clusters — several in the same frame, from the same
     * event — and playing them all turns one collision into a rattle.
     */
    private claimImpactSlot(): boolean {
        if (this.muted) return false

        // Howler runs its own context, so this has to work before the wind's
        // has been created
        const now = this.ctx ? this.ctx.currentTime : performance.now() / 1000

        if (now - this.lastImpactAt < MIN_IMPACT_INTERVAL) return false
        this.lastImpactAt = now

        return true
    }

    /**
     * Tyres letting go, judged from the slip angle each frame.
     *
     * Driven from here rather than from an event because a slide is a state,
     * not a moment — there is nothing for physics to fire. The cooldown is
     * what turns that continuous state back into discrete chirps.
     */
    private updateScreech(): void {
        if (this.muted) return
        if (!this.physics.wheelGrounded.some(Boolean)) return

        const forward = Math.abs(this.physics.forwardSpeed)
        if (forward < SCREECH.minSpeed) return

        const slip = Math.abs(this.physics.lateralSpeed) / forward
        if (slip < SCREECH.minSlip) return

        if (this.time.elapsed - this.lastScreechAt < SCREECH.cooldown) return
        this.lastScreechAt = this.time.elapsed

        const strength = Math.min(
            (slip - SCREECH.minSlip) / (SCREECH.fullSlip - SCREECH.minSlip),
            1,
        )
        this.playSample(strength, 'screech')
    }

    /**
     * The horn.
     *
     * Rate-limited here as well as at the key, since the key is not the only
     * way in — touch controls could reach it too.
     */
    playHorn(): void {
        if (this.time.elapsed - this.lastHornAt < HORN_COOLDOWN) return
        this.lastHornAt = this.time.elapsed

        this.play('horn')
    }

    /**
     * Ramp the ambience up as the world reveals itself.
     *
     * Ambience only — deliberately not `Howler.volume`, which is global. This
     * runs on the click that enters the world, so a global ramp muted the very
     * sounds that click is supposed to produce: the reveal cue fired 0.4s in,
     * at 20% of a two-second ramp, and the rover's landing thump not much
     * later. Anything one-shot now plays at its own level immediately, and
     * only the engine and wind fade up underneath it.
     */
    fadeIn(duration = 2): void {
        if (this.muted) return

        gsap.to(this, { ambience: 1, duration, ease: 'none' })

        if (!this.ctx || !this.masterGain) return

        const now = this.ctx.currentTime
        this.masterGain.gain.cancelScheduledValues(now)
        this.masterGain.gain.setValueAtTime(0, now)
        this.masterGain.gain.linearRampToValueAtTime(1, now + duration)
    }

    private update(): void {
        this.updateScreech()

        if (!this.engine) return

        const speedRatio = Math.min(
            Math.abs(this.physics.forwardSpeed) / this.physics.options.maxSpeed,
            1,
        )
        // Clamped, because a collision spikes acceleration far past anything
        // the throttle produces and would blip the revs on every bump
        const accelerationRatio = Math.min(
            this.physics.acceleration.length() / ENGINE.accelerationScale,
            1,
        )

        const target = Math.min(
            speedRatio * ENGINE.speedWeight + accelerationRatio * ENGINE.accelerationWeight,
            1,
        )

        const ease = target > this.engineProgress ? ENGINE.easeUp : ENGINE.easeDown
        this.engineProgress += (target - this.engineProgress) * ease

        this.engine.rate(lerp(ENGINE.rate, this.engineProgress))
        // The engine carries the fade that used to be applied globally
        this.engine.volume(lerp(ENGINE.volume, this.engineProgress) * this.ambience)
    }

    /** Start the looping engine. Howler unlocks itself on first interaction. */
    private startEngine(): void {
        if (this.engine) return

        this.engine = loadHowl(ENGINE.src, { loop: true, volume: 0 })
        this.engine.play()
    }

    /** One-shot cue: the world revealing, or an area being activated. */
    play(cue: keyof typeof CUES, volume = 1): void {
        if (this.muted) return

        const howl = this.cues.get(cue)
        if (!howl) return

        howl.volume(volume)
        howl.play()
    }

    private setMuteKey(): void {
        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyM') {
                this.muted = !this.muted
                Howler.mute(this.muted)
                if (this.masterGain) {
                    this.masterGain.gain.value = this.muted ? 0 : 1.0
                }
            }
        })
    }

    private setVisibility(): void {
        document.addEventListener('visibilitychange', () => {
            Howler.mute(document.hidden || this.muted)

            if (!this.masterGain) return
            if (document.hidden) {
                this.masterGain.gain.value = 0
            } else if (!this.muted) {
                this.masterGain.gain.value = 1.0
            }
        })
    }
}
