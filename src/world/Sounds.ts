import type Time from '../engine/Utils/Time'
import type Physics from './Physics'
import type { ImpactMaterial } from './Physics'

/** Contacts resolve in clusters, so collapse them into one audible hit. */
const MIN_IMPACT_INTERVAL = 0.06

interface ImpactVoice {
    /** Body pitch in Hz at the softest and hardest hit. */
    pitch: [number, number]
    /**
     * How far the pitch sags as the hit decays, as a fraction of where it
     * started. A big drop reads as heavy; near 1 holds the note and rings.
     */
    pitchDrop: number
    bodyGain: number
    bodyDecay: number
    /**
     * Low-pass cut-off in Hz for the transient, softest to hardest. This is
     * what makes a hit sound sharp — a band-pass reaching a few kHz reads as
     * a click rather than a thud, so everything here stays under ~1.2kHz.
     */
    cutoff: [number, number]
    noiseGain: number
    noiseDecay: number
}

const VOICES: Record<ImpactMaterial, ImpactVoice> = {
    // Rover against terrain, rock or scenery — heavy, sags away fast
    default: {
        pitch: [58, 96],
        pitchDrop: 0.55,
        bodyGain: 0.22,
        bodyDecay: 0.24,
        cutoff: [300, 700],
        noiseGain: 0.09,
        noiseDecay: 0.13,
    },
    // Block letters — pitched up into a hollow knock that holds and rings on,
    // which is what separates it from the rover's dull thud
    letter: {
        pitch: [125, 210],
        pitchDrop: 0.88,
        bodyGain: 0.26,
        bodyDecay: 0.42,
        cutoff: [500, 1000],
        noiseGain: 0.08,
        noiseDecay: 0.16,
    },
    // Small light crates — higher still and clipped short
    block: {
        pitch: [235, 390],
        pitchDrop: 0.78,
        bodyGain: 0.15,
        bodyDecay: 0.12,
        cutoff: [680, 1400],
        noiseGain: 0.07,
        noiseDecay: 0.07,
    },
}

const lerp = (range: [number, number], t: number) => range[0] + (range[1] - range[0]) * t

export interface SoundsOptions {
    time: Time
    physics: Physics
}

export default class Sounds {
    private time: Time
    private physics: Physics
    private ctx: AudioContext | null = null
    private masterGain: GainNode | null = null
    private engineOsc: OscillatorNode | null = null
    private engineGain: GainNode | null = null
    private windSource: AudioBufferSourceNode | null = null
    private windGain: GainNode | null = null
    muted = false
    private started = false
    private noiseBuffer: AudioBuffer | null = null
    private lastImpactAt = 0

    constructor(options: SoundsOptions) {
        this.time = options.time
        this.physics = options.physics

        this.setMuteKey()
        this.setVisibility()

        // Start audio on first user interaction (autoplay policy)
        const start = () => {
            if (this.started) return
            this.started = true
            this.initAudio()
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

        this.time.on('tick', () => this.update())
    }

    private initAudio(): void {
        this.ctx = new AudioContext()
        this.masterGain = this.ctx.createGain()
        this.masterGain.gain.value = 1.0
        this.masterGain.connect(this.ctx.destination)

        this.setupEngine()
        this.setupWind()
    }

    private setupEngine(): void {
        if (!this.ctx || !this.masterGain) return

        this.engineGain = this.ctx.createGain()
        this.engineGain.gain.value = 0
        this.engineGain.connect(this.masterGain)

        this.engineOsc = this.ctx.createOscillator()
        this.engineOsc.type = 'sawtooth'
        this.engineOsc.frequency.value = 40

        // Low-pass filter for a muffled engine sound
        const filter = this.ctx.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.value = 200
        filter.Q.value = 2

        this.engineOsc.connect(filter)
        filter.connect(this.engineGain)
        this.engineOsc.start()
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

    /**
     * A hit — a low body thump plus a short filtered-noise transient, both
     * scaled by how hard the contact was. Synthesised rather than sampled,
     * since this project ships no audio files.
     */
    playImpact(strength: number, material: ImpactMaterial = 'default'): void {
        if (!this.ctx || !this.masterGain || this.muted) return

        const now = this.ctx.currentTime

        // Too many contacts resolve on the same frame to play them all
        if (now - this.lastImpactAt < MIN_IMPACT_INTERVAL) return
        this.lastImpactAt = now

        const voice = VOICES[material] ?? VOICES.default

        // Body of the hit — pitch rises with force, then drops away
        const thump = this.ctx.createOscillator()
        thump.type = 'sine'
        const startPitch = lerp(voice.pitch, strength)
        thump.frequency.setValueAtTime(startPitch, now)
        thump.frequency.exponentialRampToValueAtTime(
            startPitch * voice.pitchDrop,
            now + voice.bodyDecay * 0.7,
        )

        const thumpGain = this.ctx.createGain()
        // Short ramp in rather than a step, which would click on its own
        thumpGain.gain.setValueAtTime(0.0001, now)
        thumpGain.gain.linearRampToValueAtTime(voice.bodyGain * strength, now + 0.008)
        thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + voice.bodyDecay)

        thump.connect(thumpGain)
        thumpGain.connect(this.masterGain)
        thump.start(now)
        thump.stop(now + voice.bodyDecay + 0.02)

        // Transient that gives the hit a surface. Low-passed, so harder hits
        // open up rather than turning into a click.
        const noise = this.ctx.createBufferSource()
        noise.buffer = this.impactNoise()

        const filter = this.ctx.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.value = lerp(voice.cutoff, strength)
        filter.Q.value = 0.4

        const noiseGain = this.ctx.createGain()
        noiseGain.gain.setValueAtTime(0.0001, now)
        noiseGain.gain.linearRampToValueAtTime(voice.noiseGain * strength, now + 0.006)
        noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + voice.noiseDecay)

        noise.connect(filter)
        filter.connect(noiseGain)
        noiseGain.connect(this.masterGain)
        noise.start(now)
        noise.stop(now + voice.noiseDecay + 0.02)
    }

    /** Short burst of white noise, built once and reused for every hit. */
    private impactNoise(): AudioBuffer {
        if (this.noiseBuffer) return this.noiseBuffer

        const ctx = this.ctx!
        const length = Math.floor(ctx.sampleRate * 0.12)
        const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
        const data = buffer.getChannelData(0)

        for (let i = 0; i < length; i++) {
            // Decay across the burst so it reads as a strike, not a hiss
            data[i] = (Math.random() * 2 - 1) * (1 - i / length)
        }

        this.noiseBuffer = buffer
        return buffer
    }

    /** Ramp the master volume up as the world reveals itself. */
    fadeIn(duration = 2): void {
        if (!this.ctx || !this.masterGain || this.muted) return

        const now = this.ctx.currentTime
        this.masterGain.gain.cancelScheduledValues(now)
        this.masterGain.gain.setValueAtTime(0, now)
        this.masterGain.gain.linearRampToValueAtTime(1, now + duration)
    }

    private update(): void {
        if (!this.ctx || !this.engineGain || !this.engineOsc) return

        const speed = Math.abs(this.physics.forwardSpeed)
        const maxSpeed = this.physics.options.maxSpeed

        // Engine pitch and volume scale with speed
        const speedRatio = Math.min(speed / maxSpeed, 1)
        const targetFreq = 40 + speedRatio * 80
        const targetVol = speedRatio * 0.35

        this.engineOsc.frequency.value += (targetFreq - this.engineOsc.frequency.value) * 0.1
        this.engineGain.gain.value += (targetVol - this.engineGain.gain.value) * 0.1
    }

    private setMuteKey(): void {
        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyM') {
                this.muted = !this.muted
                if (this.masterGain) {
                    this.masterGain.gain.value = this.muted ? 0 : 1.0
                }
            }
        })
    }

    private setVisibility(): void {
        document.addEventListener('visibilitychange', () => {
            if (!this.masterGain) return
            if (document.hidden) {
                this.masterGain.gain.value = 0
            } else if (!this.muted) {
                this.masterGain.gain.value = 1.0
            }
        })
    }
}
