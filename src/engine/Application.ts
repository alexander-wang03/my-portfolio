import * as THREE from 'three'
import * as dat from 'dat.gui'
import RAPIER from '@dimforge/rapier3d-compat'
import Sizes from './Utils/Sizes'
import Time from './Utils/Time'
import Resources from './Resources'
import Camera from './Camera'
import World from '../world/World'

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
    world!: World

    constructor(options: ApplicationOptions) {
        this.canvas = options.canvas

        this.time = new Time()
        this.sizes = new Sizes()
        this.resources = new Resources()

        this.setConfig()
        this.setDebug()
        this.setRenderer()
        this.setCamera()

        // RAPIER must be initialized (WASM) before creating the World
        this.initPhysicsAndWorld()

        this.setRenderLoop()
    }

    private async initPhysicsAndWorld(): Promise<void> {
        await RAPIER.init()
        this.setWorld()
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

    private setWorld(): void {
        this.world = new World({
            config: this.config,
            debug: this.debug,
            resources: this.resources,
            time: this.time,
            sizes: this.sizes,
            camera: this.camera,
            scene: this.scene,
            renderer: this.renderer,
        })
        this.scene.add(this.world.container)
    }

    private setRenderLoop(): void {
        this.time.on('tick', () => {
            this.renderer.render(this.scene, this.camera.instance)
        })
    }
}
