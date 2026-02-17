import * as THREE from 'three'
import * as dat from 'dat.gui'
import RAPIER from '@dimforge/rapier3d-compat'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import Sizes from './Utils/Sizes'
import Time from './Utils/Time'
import Resources from './Resources'
import Camera from './Camera'
import World from '../world/World'
import LoadingScreen from '../ui/LoadingScreen'

export interface ApplicationOptions {
    canvas: HTMLCanvasElement
}

const VignetteShader = {
    uniforms: {
        tDiffuse: { value: null as THREE.Texture | null },
        offset: { value: 1.0 },
        darkness: { value: 1.2 },
    },
    vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform float offset;
        uniform float darkness;
        varying vec2 vUv;
        void main() {
            vec4 texel = texture2D(tDiffuse, vUv);
            vec2 uv = (vUv - vec2(0.5)) * vec2(offset);
            texel.rgb *= mix(1.0, 1.0 - darkness, dot(uv, uv));
            gl_FragColor = texel;
        }
    `,
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
    composer!: EffectComposer
    loadingScreen: LoadingScreen

    constructor(options: ApplicationOptions) {
        this.canvas = options.canvas

        this.time = new Time()
        this.sizes = new Sizes()
        this.resources = new Resources()

        this.setConfig()
        this.setDebug()
        this.setRenderer()
        this.setCamera()
        this.setPostProcessing()

        this.loadingScreen = new LoadingScreen()
        this.loadingScreen.on('start', () => this.onStart())

        this.initPhysicsAndWorld()
        this.setRenderLoop()
    }

    private async initPhysicsAndWorld(): Promise<void> {
        this.loadingScreen.setProgress(0.1)
        await RAPIER.init()
        this.loadingScreen.setProgress(0.3)
        await this.setWorld()
        this.loadingScreen.setReady()
    }

    private onStart(): void {
        this.camera.reveal()
        this.world.controls.enabled = true
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

    private setPostProcessing(): void {
        const resolution = new THREE.Vector2(
            this.sizes.viewport.width,
            this.sizes.viewport.height,
        )

        this.composer = new EffectComposer(this.renderer)

        const renderPass = new RenderPass(this.scene, this.camera.instance)
        this.composer.addPass(renderPass)

        const bloomPass = new UnrealBloomPass(resolution, 0.25, 0.5, 0.85)
        this.composer.addPass(bloomPass)

        const vignettePass = new ShaderPass(VignetteShader)
        this.composer.addPass(vignettePass)

        const outputPass = new OutputPass()
        this.composer.addPass(outputPass)

        this.sizes.on('resize', () => {
            this.composer.setSize(this.sizes.viewport.width, this.sizes.viewport.height)
            this.composer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        })
    }

    private async setWorld(): Promise<void> {
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
        await this.world.init((progress) => {
            this.loadingScreen.setProgress(0.3 + progress * 0.7)
        })
    }

    private setRenderLoop(): void {
        this.time.on('tick', () => {
            this.composer.render()
        })
    }
}
