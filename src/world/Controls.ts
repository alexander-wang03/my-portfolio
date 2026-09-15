import EventEmitter from '../engine/Utils/EventEmitter'
import type Camera from '../engine/Camera'
import type Time from '../engine/Utils/Time'

export interface ControlsOptions {
    config: { debug: boolean; touch: boolean }
    camera: Camera
    time: Time
}

export interface Actions {
    up: boolean
    right: boolean
    down: boolean
    left: boolean
    brake: boolean
    boost: boolean
}

/**
 * Whether to build the on-screen joystick and buttons.
 *
 * Asked as a negative on purpose: show them UNLESS the device has a pointer
 * that is both fine and able to hover. That pair means a mouse or a trackpad,
 * and nothing else does.
 *
 * The obvious phrasing, `(pointer: coarse)`, is what this replaced, and it is
 * wrong in both directions. It used to be `'ontouchstart' in window ||
 * navigator.maxTouchPoints > 0`, which is a question about the hardware rather
 * than about the visitor and is true of every touchscreen laptop - those
 * people drive with a keyboard and were getting a joystick parked over the
 * world. (`setTouch` also calls `camera.pan.disable()`, but that costs nothing
 * either way: `pan.enabled` starts false and `pan.enable()` is never called
 * from anywhere, so camera panning has never been on.) But asking only for a
 * coarse primary pointer has the opposite
 * failure: a phone or tablet that reports a stylus as its primary pointer
 * answers `(pointer: fine)` and would lose its controls entirely, with no way
 * to drive at all.
 *
 * `hover` is the discriminator that holds in both cases. A finger and a stylus
 * cannot hover; a mouse and a trackpad can.
 *
 *   phone / tablet          coarse, hover: none   -> shown
 *   phone with a stylus     fine,   hover: none   -> shown
 *   laptop, touchscreen     fine,   hover: hover  -> hidden
 *   tablet with a mouse     fine,   hover: hover  -> hidden
 *
 * Read once, at construction. A visitor who docks or undocks a keyboard
 * mid-session keeps whatever they started with until they reload, which is a
 * fair trade for not making the whole control scheme swappable.
 *
 * `main.css` mirrors this exact query - keep the two in step.
 */
function wantsTouchControls(): boolean {
    return !(window.matchMedia?.('(pointer: fine) and (hover: hover)').matches ?? false)
}

export default class Controls extends EventEmitter {
    config: ControlsOptions['config']
    camera: Camera
    time: Time
    actions: Actions
    enabled = false
    /** True when the on-screen joystick and buttons were created. */
    hasTouchControls = false

    /**
     * Where the joystick is pointing, as a world-space bearing in radians, or
     * null when it is not held.
     *
     * Screen-relative rather than vehicle-relative on purpose: pushing the
     * stick towards a corner of the screen should send the rover to that
     * corner, without the player having to work out which way the rover is
     * currently facing and translate. Physics turns this into a steering angle.
     */
    desiredHeading: number | null = null

    /** 0-1 stick deflection, so a small push is a gentle throttle. */
    stickThrottle = 0

    constructor(options: ControlsOptions) {
        super()

        this.config = options.config
        this.camera = options.camera
        this.time = options.time

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

        if (wantsTouchControls()) {
            this.hasTouchControls = true
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
                case 'KeyH':
                    // On the press, unlike reset — a horn that waits for the
                    // key to come back up does not feel like a button at all.
                    // Held keys repeat, so the repeats have to be dropped.
                    if (!event.repeat) this.trigger('action', ['horn'])
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
        container.setAttribute('aria-hidden', 'true')

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

        const hornBtn = document.createElement('button')
        hornBtn.className = 'touch-btn touch-horn'
        hornBtn.textContent = 'HORN'
        container.appendChild(hornBtn)

        // Parked away from the driving cluster: it teleports the rover, so it
        // is the one control that must not be caught by a stray thumb
        const resetBtn = document.createElement('button')
        resetBtn.className = 'touch-btn touch-reset'
        resetBtn.textContent = 'RESET'
        container.appendChild(resetBtn)

        // The container is aria-hidden — it describes touch gestures, which are
        // not something assistive tech can carry out — so its buttons must not
        // be in the tab order, or focus lands on a control nothing can announce.
        // These also exist on any touch-capable laptop, where that tab order is
        // real. `inert` would be the usual fix but would block the very touches
        // they exist for; keyboard users have the actual keys.
        for (const btn of [brakeBtn, boostBtn, hornBtn, resetBtn]) btn.tabIndex = -1

        document.body.appendChild(container)

        // --- Joystick touch handling ---
        let joystickTouchId: number | null = null

        /**
         * Where the stick is and how far it throws, in viewport pixels.
         *
         * Measured rather than assumed, and re-measured on every move rather
         * than once per touch. The element moves while a thumb is on it: the
         * credits bar publishes `--credits-clearance`, the controls lift clear
         * of it, and that can happen mid-drag — at the 7s handover, or on a
         * rotation, or when the font finishes loading and the line reflows.
         *
         * With the centre cached from touchstart, any such shift is read as
         * the thumb having moved that far instead. An 80px lift against a
         * throw of ~40px pegs the stick to full deflection in a direction
         * nobody pushed, and it stays there until the finger lifts.
         *
         * One `getBoundingClientRect` per touchmove, on one element.
         */
        const stick = { x: 0, y: 0, maxRadius: 1 }

        const measureStick = (): void => {
            const rect = base.getBoundingClientRect()
            stick.x = rect.left + rect.width / 2
            stick.y = rect.top + rect.height / 2
            // Derived, never hardcoded. This was a literal 50 while the base
            // was sized in CSS, so the two could disagree — and did: the knob
            // travelled past the ring and sat on bare terrain. The throw is
            // whatever leaves the knob flush inside the ring.
            stick.maxRadius = Math.max(1, rect.width / 2 - knob.offsetWidth / 2)
        }

        /**
         * Dead zone as a distance, not a fraction.
         *
         * A fraction of the throw means the dead zone shrinks with the stick,
         * so the smaller landscape joystick would be twitchier than the
         * portrait one for no reason a thumb can perceive. Roughly the
         * diameter of a resting fingertip's wobble.
         */
        const DEAD_RADIUS = 12

        joystick.addEventListener('touchstart', (e) => {
            if (!this.enabled) return
            e.preventDefault()
            e.stopPropagation()
            const touch = e.changedTouches[0]
            joystickTouchId = touch.identifier
            measureStick()
        }, { passive: false })

        const onJoystickMove = (e: TouchEvent) => {
            if (!this.enabled) return
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i]
                if (touch.identifier !== joystickTouchId) continue

                e.preventDefault()

                // Re-read before every sample: see `measureStick`
                measureStick()

                let dx = touch.clientX - stick.x
                let dy = touch.clientY - stick.y

                const dist = Math.sqrt(dx * dx + dy * dy)
                if (dist > stick.maxRadius) {
                    dx = (dx / dist) * stick.maxRadius
                    dy = (dy / dist) * stick.maxRadius
                }

                knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`

                const nx = dx / stick.maxRadius
                const ny = dy / stick.maxRadius
                const deflection = Math.min(Math.sqrt(nx * nx + ny * ny), 1)

                // Capped: `deflection` can never exceed 1, so an unbounded
                // ratio would make the whole stick dead rather than just its
                // centre if the ring ever measured smaller than DEAD_RADIUS -
                // which is what a hidden or not-yet-laid-out element reports.
                if (deflection < Math.min(0.6, DEAD_RADIUS / stick.maxRadius)) {
                    this.desiredHeading = null
                    this.stickThrottle = 0
                    this.actions.up = false
                    continue
                }

                // The camera sits at `angle.value` looking back at its target,
                // so the direction it faces, flattened, is that offset negated.
                // Screen-right is that forward crossed with world up, which for
                // a y-up right-handed frame is (-fz, 0, fx).
                const offset = this.camera.angle.value
                const flat = Math.hypot(offset.x, offset.z) || 1
                const fx = -offset.x / flat
                const fz = -offset.z / flat
                const rx = -fz
                const rz = fx

                // Screen y grows downward, so pushing up is -ny
                const worldX = rx * nx + fx * -ny
                const worldZ = rz * nx + fz * -ny

                this.desiredHeading = Math.atan2(worldX, worldZ)
                this.stickThrottle = deflection
                this.actions.up = true
            }
        }

        const onJoystickEnd = (e: TouchEvent) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier !== joystickTouchId) continue
                joystickTouchId = null
                knob.style.transform = 'translate(-50%, -50%)'
                this.desiredHeading = null
                this.stickThrottle = 0
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
            }, { passive: false })

            const release = () => {
                this.actions[action] = false
            }
            btn.addEventListener('touchend', release)
            btn.addEventListener('touchcancel', release)
        }

        /**
         * Buttons that fire once rather than being held.
         *
         * Horn and reset are events, not states — there is no `actions` flag
         * to set and clear, so they cannot go through `bindButton`, and the
         * lit state has to be driven from here for the same reason: nothing in
         * the tick loop knows they happened.
         */
        const bindTrigger = (btn: HTMLElement, action: string) => {
            btn.addEventListener('touchstart', (e) => {
                if (!this.enabled) return
                e.preventDefault()
                e.stopPropagation()

                this.trigger('action', [action])

                btn.classList.add('active')
                window.setTimeout(() => btn.classList.remove('active'), 150)
            }, { passive: false })
        }

        bindButton(brakeBtn, 'brake')
        bindButton(boostBtn, 'boost')
        bindTrigger(hornBtn, 'horn')
        bindTrigger(resetBtn, 'reset')

        // Light the buttons from the action state rather than from the touch
        // handlers, so the keyboard (Shift / Space) lights them up too — these
        // buttons are also on screen for any touch-capable laptop.
        this.time.on('tick', () => {
            brakeBtn.classList.toggle('active', this.actions.brake)
            boostBtn.classList.toggle('active', this.actions.boost)
        })
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
            this.desiredHeading = null
            this.stickThrottle = 0
        })
    }
}
