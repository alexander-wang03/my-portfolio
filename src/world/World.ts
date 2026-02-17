import * as THREE from 'three'
import type Time from '../engine/Utils/Time'
import type Sizes from '../engine/Utils/Sizes'
import type Resources from '../engine/Resources'
import type Camera from '../engine/Camera'
import type { GUI } from 'dat.gui'
import Terrain from './Terrain'
import Environment from './Environment'
import Controls from './Controls'
import Physics from './Physics'
import Rover from './Rover'
import DustParticles from './Particles/DustParticles'

export interface WorldOptions {
    config: { debug: boolean; touch: boolean }
    debug?: GUI
    resources: Resources
    time: Time
    sizes: Sizes
    camera: Camera
    scene: THREE.Scene
    renderer: THREE.WebGLRenderer
}

export default class World {
    config: WorldOptions['config']
    debug?: GUI
    resources: Resources
    time: Time
    sizes: Sizes
    camera: Camera
    scene: THREE.Scene
    renderer: THREE.WebGLRenderer

    container: THREE.Object3D
    terrain!: Terrain
    environment!: Environment
    controls!: Controls
    physics!: Physics
    rover!: Rover
    dust!: DustParticles

    constructor(options: WorldOptions) {
        this.config = options.config
        this.debug = options.debug
        this.resources = options.resources
        this.time = options.time
        this.sizes = options.sizes
        this.camera = options.camera
        this.scene = options.scene
        this.renderer = options.renderer

        this.container = new THREE.Object3D()
        this.container.matrixAutoUpdate = false
    }

    async init(): Promise<void> {
        await this.setTerrain()
        this.setEnvironment()
        this.setControls()
        this.setPhysics()
        await this.setRover()
        this.setDust()
    }

    private async setTerrain(): Promise<void> {
        this.terrain = await Terrain.fromSTL(
            '/models/terrain/curiosity-landing-site.stl',
            200,
            256,
            new THREE.Vector3(0.5, 0.7, 0.3).normalize(),
        )
        this.container.add(this.terrain.container)
    }

    private setEnvironment(): void {
        this.environment = new Environment()
        this.container.add(this.environment.container)
    }

    private setControls(): void {
        this.controls = new Controls({
            config: this.config,
            camera: this.camera,
        })
    }

    private setPhysics(): void {
        this.physics = new Physics({
            time: this.time,
            controls: this.controls,
            terrain: this.terrain,
            debug: this.debug,
            config: this.config,
        })

        // Add debug wireframes to scene (only visible in debug mode)
        this.container.add(this.physics.debugContainer)

        // Camera follows the rover chassis
        this.time.on('tick', () => {
            this.camera.target.copy(this.physics.chassisPosition)
        })
    }

    private async setRover(): Promise<void> {
        this.rover = new Rover({
            time: this.time,
            physics: this.physics,
        })
        await this.rover.load()
        this.container.add(this.rover.container)
    }

    private setDust(): void {
        this.dust = new DustParticles({
            time: this.time,
            physics: this.physics,
        })
        this.container.add(this.dust.container)
    }
}
