import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import gsap from 'gsap'
import type Time from './Utils/Time'
import type Sizes from './Utils/Sizes'
import type { GUI } from 'dat.gui'

export interface CameraOptions {
    time: Time
    sizes: Sizes
    renderer: THREE.WebGLRenderer
    debug?: GUI
    config: { debug: boolean; touch: boolean }
}

export default class Camera {
    private time: Time
    private sizes: Sizes
    private renderer: THREE.WebGLRenderer
    private debug?: GUI
    private debugFolder?: GUI

    container: THREE.Object3D
    instance!: THREE.PerspectiveCamera
    orbitControls!: OrbitControls

    target: THREE.Vector3
    targetEased: THREE.Vector3
    easing: number

    angle: {
        items: Record<string, THREE.Vector3>
        value: THREE.Vector3
        set: (name: string) => void
    }

    zoom: {
        easing: number
        minDistance: number
        amplitude: number
        value: number
        targetValue: number
        distance: number
        touch: { startDistance: number; startValue: number }
    }

    pan: {
        enabled: boolean
        active: boolean
        easing: number
        start: { x: number; y: number }
        value: { x: number; y: number }
        targetValue: { x: number; y: number }
        raycaster: THREE.Raycaster
        mouse: THREE.Vector2
        needsUpdate: boolean
        hitMesh: THREE.Mesh
        reset: () => void
        enable: () => void
        disable: () => void
        down: (x: number, y: number) => void
        move: (x: number, y: number) => void
        up: () => void
    }

    constructor(options: CameraOptions) {
        this.time = options.time
        this.sizes = options.sizes
        this.renderer = options.renderer
        this.debug = options.debug
        this.config = options.config

        this.container = new THREE.Object3D()
        this.container.matrixAutoUpdate = false

        this.target = new THREE.Vector3(0, 0, 0)
        this.targetEased = new THREE.Vector3(0, 0, 0)
        this.easing = 0.15

        if (this.debug) {
            this.debugFolder = this.debug.addFolder('camera')
        }

        // Initialize angle (Y-up: camera looks from above-behind)
        this.angle = {
            items: {
                default: new THREE.Vector3(1.135, 1.15, 1.45),
                projects: new THREE.Vector3(0.38, 1.63, 1.4),
                experience: new THREE.Vector3(-0.9, 1.5, 1.3),
                about: new THREE.Vector3(1.5, 1.3, -0.6),
                contact: new THREE.Vector3(0.6, 1.6, -1.2),
            },
            value: new THREE.Vector3(),
            set: () => {},
        }
        this.angle.value.copy(this.angle.items.default)
        this.angle.set = (name: string) => {
            const target = this.angle.items[name]
            if (target) {
                gsap.to(this.angle.value, { ...target, duration: 2, ease: 'power1.inOut' })
            }
        }

        // Initialize zoom
        this.zoom = {
            easing: 0.1,
            minDistance: 14,
            amplitude: 15,
            value: 0.5,
            targetValue: 0.5,
            distance: 14 + 15 * 0.5,
            touch: { startDistance: 0, startValue: 0 },
        }

        // Initialize pan (placeholder, filled in setPan)
        this.pan = {} as Camera['pan']

        this.setInstance()
        this.setZoom()
        this.setPan()
        this.setOrbitControls()
    }

    private config: { debug: boolean; touch: boolean }

    private setInstance(): void {
        this.instance = new THREE.PerspectiveCamera(
            40,
            this.sizes.viewport.width / this.sizes.viewport.height,
            1,
            200,
        )
        this.instance.up.set(0, 1, 0)
        this.instance.position.copy(this.angle.value)
        this.instance.lookAt(new THREE.Vector3())
        this.container.add(this.instance)

        this.sizes.on('resize', () => {
            this.instance.aspect = this.sizes.viewport.width / this.sizes.viewport.height
            this.instance.updateProjectionMatrix()
        })

        this.time.on('tick', () => {
            if (this.orbitControls?.enabled) return

            this.targetEased.x += (this.target.x - this.targetEased.x) * this.easing
            this.targetEased.y += (this.target.y - this.targetEased.y) * this.easing
            this.targetEased.z += (this.target.z - this.targetEased.z) * this.easing

            this.instance.position
                .copy(this.targetEased)
                .add(this.angle.value.clone().normalize().multiplyScalar(this.zoom.distance))

            this.instance.lookAt(this.targetEased)

            this.instance.position.x += this.pan.value.x
            this.instance.position.z += this.pan.value.y
        })
    }

    private setZoom(): void {
        document.addEventListener(
            'mousewheel',
            (event) => {
                const e = event as WheelEvent
                this.zoom.targetValue += e.deltaY * 0.001
                this.zoom.targetValue = Math.min(Math.max(this.zoom.targetValue, 0), 1)
            },
            { passive: true },
        )

        this.renderer.domElement.addEventListener('touchstart', (event) => {
            if (event.touches.length === 2) {
                this.zoom.touch.startDistance = Math.hypot(
                    event.touches[0].clientX - event.touches[1].clientX,
                    event.touches[0].clientY - event.touches[1].clientY,
                )
                this.zoom.touch.startValue = this.zoom.targetValue
            }
        })

        this.renderer.domElement.addEventListener('touchmove', (event) => {
            if (event.touches.length === 2) {
                event.preventDefault()
                const distance = Math.hypot(
                    event.touches[0].clientX - event.touches[1].clientX,
                    event.touches[0].clientY - event.touches[1].clientY,
                )
                const ratio = distance / this.zoom.touch.startDistance
                this.zoom.targetValue = this.zoom.touch.startValue - (ratio - 1)
                this.zoom.targetValue = Math.min(Math.max(this.zoom.targetValue, 0), 1)
            }
        })

        this.time.on('tick', () => {
            this.zoom.value += (this.zoom.targetValue - this.zoom.value) * this.zoom.easing
            this.zoom.distance = this.zoom.minDistance + this.zoom.amplitude * this.zoom.value
        })
    }

    private setPan(): void {
        this.pan = {
            enabled: false,
            active: false,
            easing: 0.1,
            start: { x: 0, y: 0 },
            value: { x: 0, y: 0 },
            targetValue: { x: 0, y: 0 },
            raycaster: new THREE.Raycaster(),
            mouse: new THREE.Vector2(),
            needsUpdate: false,
            hitMesh: new THREE.Mesh(
                new THREE.PlaneGeometry(500, 500, 1, 1),
                new THREE.MeshBasicMaterial({ visible: false }),
            ),
            reset: () => {
                this.pan.targetValue.x = 0
                this.pan.targetValue.y = 0
            },
            enable: () => {
                this.pan.enabled = true
                this.renderer.domElement.classList.add('has-cursor-grab')
            },
            disable: () => {
                this.pan.enabled = false
                this.renderer.domElement.classList.remove('has-cursor-grab')
            },
            down: (x: number, y: number) => {
                if (!this.pan.enabled) return
                this.renderer.domElement.classList.add('has-cursor-grabbing')
                this.pan.active = true
                this.pan.mouse.x = (x / this.sizes.viewport.width) * 2 - 1
                this.pan.mouse.y = -(y / this.sizes.viewport.height) * 2 + 1
                this.pan.raycaster.setFromCamera(this.pan.mouse, this.instance)
                const intersects = this.pan.raycaster.intersectObjects([this.pan.hitMesh])
                if (intersects.length) {
                    this.pan.start.x = intersects[0].point.x
                    this.pan.start.y = intersects[0].point.z
                }
            },
            move: (x: number, y: number) => {
                if (!this.pan.enabled || !this.pan.active) return
                this.pan.mouse.x = (x / this.sizes.viewport.width) * 2 - 1
                this.pan.mouse.y = -(y / this.sizes.viewport.height) * 2 + 1
                this.pan.needsUpdate = true
            },
            up: () => {
                this.pan.active = false
                this.renderer.domElement.classList.remove('has-cursor-grabbing')
            },
        }

        // Y-up: hit plane is horizontal (XZ)
        this.pan.hitMesh.rotation.x = -Math.PI / 2
        this.container.add(this.pan.hitMesh)

        // Mouse events
        window.addEventListener('mousedown', (e) => this.pan.down(e.clientX, e.clientY))
        window.addEventListener('mousemove', (e) => this.pan.move(e.clientX, e.clientY))
        window.addEventListener('mouseup', () => this.pan.up())

        // Touch events
        this.renderer.domElement.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                this.pan.down(e.touches[0].clientX, e.touches[0].clientY)
            }
        })
        this.renderer.domElement.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1) {
                this.pan.move(e.touches[0].clientX, e.touches[0].clientY)
            }
        })
        this.renderer.domElement.addEventListener('touchend', () => this.pan.up())

        // Update pan each tick
        this.time.on('tick', () => {
            if (this.pan.active && this.pan.needsUpdate) {
                this.pan.raycaster.setFromCamera(this.pan.mouse, this.instance)
                const intersects = this.pan.raycaster.intersectObjects([this.pan.hitMesh])
                if (intersects.length) {
                    this.pan.targetValue.x = -(intersects[0].point.x - this.pan.start.x)
                    this.pan.targetValue.y = -(intersects[0].point.z - this.pan.start.y)
                }
                this.pan.needsUpdate = false
            }

            this.pan.value.x += (this.pan.targetValue.x - this.pan.value.x) * this.pan.easing
            this.pan.value.y += (this.pan.targetValue.y - this.pan.value.y) * this.pan.easing
        })
    }

    private setOrbitControls(): void {
        this.orbitControls = new OrbitControls(this.instance, this.renderer.domElement)
        this.orbitControls.enabled = false
        this.orbitControls.zoomSpeed = 0.5

        if (this.debug && this.debugFolder) {
            this.debugFolder.add(this.orbitControls, 'enabled').name('orbitControlsEnabled')
        }
    }

    reveal(duration = 3): void {
        // Start camera zoomed far out, animate to default
        this.zoom.value = 1.0
        this.zoom.targetValue = 1.0
        this.zoom.distance = this.zoom.minDistance + this.zoom.amplitude

        gsap.to(this.zoom, {
            value: 0.5,
            targetValue: 0.5,
            duration,
            ease: 'power2.out',
        })
    }
}
