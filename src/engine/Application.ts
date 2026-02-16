import * as THREE from 'three'
import * as dat from 'dat.gui'
import Sizes from './Utils/Sizes'
import Time from './Utils/Time'
import Resources from './Resources'
import Camera from './Camera'

export interface ApplicationOptions {
    canvas: HTMLCanvasElement
}

export default class Application {
    canvas: HTMLCanvasElement
    time: Time
    sizes: Sizes
    resources: Resources
    config!: { debug: boolean; touch: boolean }
    debug?: dat.GUI
    scene!: THREE.Scene
    renderer!: THREE.WebGLRenderer
    camera!: Camera

    constructor(options: ApplicationOptions) {
        this.canvas = options.canvas

        this.time = new Time()
        this.sizes = new Sizes()
        this.resources = new Resources()

        this.setConfig()
        this.setDebug()
        this.setRenderer()
        this.setCamera()
        this.setTestCube()
        this.setRenderLoop()
    }

    private setConfig(): void {
        this.config = {
            debug: window.location.hash === '#debug',
            touch: false,
        }

        window.addEventListener(
            'touchstart',
            () => {
                this.config.touch = true
            },
            { once: true },
        )
    }

    private setDebug(): void {
        if (this.config.debug) {
            this.debug = new dat.GUI({ width: 420 })
        }
    }

    private setRenderer(): void {
        this.scene = new THREE.Scene()

        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            alpha: false,
            powerPreference: 'high-performance',
        })
        this.renderer.setClearColor(0x000000, 1)
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        this.renderer.setSize(this.sizes.viewport.width, this.sizes.viewport.height)

        this.sizes.on('resize', () => {
            this.renderer.setSize(this.sizes.viewport.width, this.sizes.viewport.height)
        })
    }

    private setCamera(): void {
        this.camera = new Camera({
            time: this.time,
            sizes: this.sizes,
            renderer: this.renderer,
            debug: this.debug,
            config: this.config,
        })

        this.scene.add(this.camera.container)
    }

    private setTestCube(): void {
        const geometry = new THREE.BoxGeometry(1, 1, 1)
        const material = new THREE.MeshNormalMaterial()
        const cube = new THREE.Mesh(geometry, material)
        cube.position.set(0, 0.5, 0)
        this.scene.add(cube)

        // Ground grid for reference
        const grid = new THREE.GridHelper(20, 20, 0x444444, 0x222222)
        this.scene.add(grid)

        // Ambient light so we can see things
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
        this.scene.add(ambientLight)
    }

    private setRenderLoop(): void {
        this.time.on('tick', () => {
            this.renderer.render(this.scene, this.camera.instance)
        })
    }
}
