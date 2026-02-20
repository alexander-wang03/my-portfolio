import type Time from '../engine/Utils/Time'
import type Physics from './Physics'

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

    playBeep(): void {
        if (!this.ctx || !this.masterGain || this.muted) return

        const osc = this.ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = 880

        const gain = this.ctx.createGain()
        gain.gain.value = 0.1
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15)

        osc.connect(gain)
        gain.connect(this.masterGain)
        osc.start()
        osc.stop(this.ctx.currentTime + 0.15)
    }

    playThud(): void {
        if (!this.ctx || !this.masterGain || this.muted) return

        const osc = this.ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = 60
        osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.1)

        const gain = this.ctx.createGain()
        gain.gain.value = 0.15
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2)

        osc.connect(gain)
        gain.connect(this.masterGain)
        osc.start()
        osc.stop(this.ctx.currentTime + 0.2)
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
