import * as THREE from 'three'
import * as dat from 'dat.gui'
import RAPIER from '@dimforge/rapier3d-compat'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
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

const BlurShader = {
    uniforms: {
        tDiffuse: { value: null as THREE.Texture | null },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uStrength: { value: new THREE.Vector2(1, 0) },
    },
    vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: /* glsl */ `
        #define M_PI 3.1415926535897932384626433832795

        uniform sampler2D tDiffuse;
        uniform vec2 uResolution;
        uniform vec2 uStrength;
        varying vec2 vUv;

        vec4 blur9(sampler2D image, vec2 uv, vec2 resolution, vec2 direction) {
            vec4 color = vec4(0.0);
            vec2 off1 = vec2(1.3846153846) * direction;
            vec2 off2 = vec2(3.2307692308) * direction;
            color += texture2D(image, uv) * 0.2270270270;
            color += texture2D(image, uv + (off1 / resolution)) * 0.3162162162;
            color += texture2D(image, uv - (off1 / resolution)) * 0.3162162162;
            color += texture2D(image, uv + (off2 / resolution)) * 0.0702702703;
            color += texture2D(image, uv - (off2 / resolution)) * 0.0702702703;
            return color;
        }

        void main() {
            vec4 diffuseColor = texture2D(tDiffuse, vUv);
            vec4 blurColor = blur9(tDiffuse, vUv, uResolution, uStrength);
            float blurStrength = 1.0 - sin(vUv.y * M_PI);
            gl_FragColor = mix(diffuseColor, blurColor, blurStrength);
        }
    `,
}

const GlowShader = {
    uniforms: {
        tDiffuse: { value: null as THREE.Texture | null },
        uPosition: { value: new THREE.Vector2(0, 0.25) },
        uRadius: { value: 0.7 },
        uColor: { value: new THREE.Color(0xffcfe0) },
        uAlpha: { value: 0.55 },
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
        uniform vec2 uPosition;
        uniform float uRadius;
        uniform vec3 uColor;
        uniform float uAlpha;
        varying vec2 vUv;

        void main() {
            vec4 diffuseColor = texture2D(tDiffuse, vUv);
            float glowStrength = distance(vUv, uPosition) / uRadius;
            glowStrength = 1.0 - glowStrength;
            glowStrength *= uAlpha;
            glowStrength = clamp(glowStrength, 0.0, 1.0);
            vec3 color = mix(diffuseColor.rgb, uColor, glowStrength);
            gl_FragColor = vec4(color, 1.0);
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
        this.composer = new EffectComposer(this.renderer)

        const renderPass = new RenderPass(this.scene, this.camera.instance)
        this.composer.addPass(renderPass)

        // Horizontal blur pass (tilt-shift: stronger at top/bottom)
        const blurPassH = new ShaderPass(BlurShader)
        blurPassH.uniforms.uResolution.value.set(
            this.sizes.viewport.width,
            this.sizes.viewport.height,
        )
        blurPassH.uniforms.uStrength.value.set(1, 0)
        this.composer.addPass(blurPassH)

        // Vertical blur pass
        const blurPassV = new ShaderPass(BlurShader)
        blurPassV.uniforms.uResolution.value.set(
            this.sizes.viewport.width,
            this.sizes.viewport.height,
        )
        blurPassV.uniforms.uStrength.value.set(0, 1)
        this.composer.addPass(blurPassV)

        // Glow overlay (warm pink radial glow)
        const glowPass = new ShaderPass(GlowShader)
        this.composer.addPass(glowPass)

        const outputPass = new OutputPass()
        this.composer.addPass(outputPass)

        this.sizes.on('resize', () => {
            this.composer.setSize(this.sizes.viewport.width, this.sizes.viewport.height)
            this.composer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
            blurPassH.uniforms.uResolution.value.set(
                this.sizes.viewport.width,
                this.sizes.viewport.height,
            )
            blurPassV.uniforms.uResolution.value.set(
                this.sizes.viewport.width,
                this.sizes.viewport.height,
            )
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
