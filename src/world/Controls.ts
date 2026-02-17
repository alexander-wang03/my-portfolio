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
    }

    private setKeyboard(): void {
        const keyDown = (event: KeyboardEvent) => {
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
