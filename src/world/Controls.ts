import EventEmitter from '../engine/Utils/EventEmitter'
import type Camera from '../engine/Camera'

export interface ControlsOptions {
    config: { debug: boolean; touch: boolean }
    camera: Camera
}

export interface Actions {
    up: boolean
    right: boolean
    down: boolean
    left: boolean
    brake: boolean
    boost: boolean
}

export default class Controls extends EventEmitter {
    config: ControlsOptions['config']
    camera: Camera
    actions: Actions
    enabled = false

    constructor(options: ControlsOptions) {
        super()

        this.config = options.config
        this.camera = options.camera

        this.actions = {
            up: false,
            right: false,
            down: false,
            left: false,
            brake: false,
            boost: false,
        }

        this.setKeyboard()
        this.setVisibilityReset()

        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            this.setTouch()
        }
    }

    private setKeyboard(): void {
        const keyDown = (event: KeyboardEvent) => {
            if (!this.enabled) return

            switch (event.code) {
                case 'ArrowUp':
                case 'KeyW':
                    this.camera.pan.reset()
                    this.actions.up = true
                    break
                case 'ArrowRight':
                case 'KeyD':
                    this.actions.right = true
                    break
                case 'ArrowDown':
                case 'KeyS':
                    this.camera.pan.reset()
                    this.actions.down = true
                    break
                case 'ArrowLeft':
                case 'KeyA':
                    this.actions.left = true
                    break
                case 'ControlLeft':
                case 'ControlRight':
                case 'Space':
                    this.actions.brake = true
                    break
                case 'ShiftLeft':
                case 'ShiftRight':
                    this.actions.boost = true
                    break
            }
        }

        const keyUp = (event: KeyboardEvent) => {
            if (!this.enabled) return

            switch (event.code) {
                case 'ArrowUp':
                case 'KeyW':
                    this.actions.up = false
                    break
                case 'ArrowRight':
                case 'KeyD':
                    this.actions.right = false
                    break
                case 'ArrowDown':
                case 'KeyS':
                    this.actions.down = false
                    break
                case 'ArrowLeft':
                case 'KeyA':
                    this.actions.left = false
                    break
                case 'ControlLeft':
                case 'ControlRight':
                case 'Space':
                    this.actions.brake = false
                    break
                case 'ShiftLeft':
                case 'ShiftRight':
                    this.actions.boost = false
                    break
                case 'KeyR':
                    this.trigger('action', ['reset'])
                    break
            }
        }

        document.addEventListener('keydown', keyDown)
        document.addEventListener('keyup', keyUp)
    }

    private setTouch(): void {
        // Disable camera pan on touch devices (joystick replaces it)
        this.camera.pan.disable()

        const container = document.createElement('div')
        container.className = 'touch-controls'

        // --- Virtual joystick (left side) ---
        const joystick = document.createElement('div')
        joystick.className = 'touch-joystick'
        const base = document.createElement('div')
        base.className = 'touch-joystick-base'
        const knob = document.createElement('div')
        knob.className = 'touch-joystick-knob'
        base.appendChild(knob)
        joystick.appendChild(base)
        container.appendChild(joystick)

        // --- Buttons (right side) ---
        const brakeBtn = document.createElement('button')
        brakeBtn.className = 'touch-btn touch-brake'
        brakeBtn.textContent = 'BRAKE'
        container.appendChild(brakeBtn)

        const boostBtn = document.createElement('button')
        boostBtn.className = 'touch-btn touch-boost'
        boostBtn.textContent = 'BOOST'
        container.appendChild(boostBtn)

        document.body.appendChild(container)

        // --- Joystick touch handling ---
        let joystickTouchId: number | null = null
        const center = { x: 0, y: 0 }
        const maxRadius = 50
        const deadzone = 0.25

        joystick.addEventListener('touchstart', (e) => {
            if (!this.enabled) return
            e.preventDefault()
            e.stopPropagation()
            const touch = e.changedTouches[0]
            joystickTouchId = touch.identifier
            const rect = base.getBoundingClientRect()
            center.x = rect.left + rect.width / 2
            center.y = rect.top + rect.height / 2
        }, { passive: false })

        const onJoystickMove = (e: TouchEvent) => {
            if (!this.enabled) return
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i]
                if (touch.identifier !== joystickTouchId) continue

                e.preventDefault()
                let dx = touch.clientX - center.x
                let dy = touch.clientY - center.y

                const dist = Math.sqrt(dx * dx + dy * dy)
                if (dist > maxRadius) {
                    dx = (dx / dist) * maxRadius
                    dy = (dy / dist) * maxRadius
                }

                knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`

                const nx = dx / maxRadius
                const ny = dy / maxRadius

                this.actions.left = nx < -deadzone
                this.actions.right = nx > deadzone
                this.actions.up = ny < -deadzone
                this.actions.down = ny > deadzone
            }
        }

        const onJoystickEnd = (e: TouchEvent) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier !== joystickTouchId) continue
                joystickTouchId = null
                knob.style.transform = 'translate(-50%, -50%)'
                this.actions.left = false
                this.actions.right = false
                this.actions.up = false
                this.actions.down = false
            }
        }

        window.addEventListener('touchmove', onJoystickMove, { passive: false })
        window.addEventListener('touchend', onJoystickEnd)
        window.addEventListener('touchcancel', onJoystickEnd)

        // --- Button handling ---
        const bindButton = (btn: HTMLElement, action: keyof Actions) => {
            btn.addEventListener('touchstart', (e) => {
                if (!this.enabled) return
                e.preventDefault()
                e.stopPropagation()
                this.actions[action] = true
                btn.classList.add('active')
            }, { passive: false })

            const release = () => {
                this.actions[action] = false
                btn.classList.remove('active')
            }
            btn.addEventListener('touchend', release)
            btn.addEventListener('touchcancel', release)
        }

        bindButton(brakeBtn, 'brake')
        bindButton(boostBtn, 'boost')
    }

    private setVisibilityReset(): void {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) return
            this.actions.up = false
            this.actions.right = false
            this.actions.down = false
            this.actions.left = false
            this.actions.brake = false
            this.actions.boost = false
        })
    }
}
