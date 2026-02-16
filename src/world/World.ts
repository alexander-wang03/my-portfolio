import * as THREE from 'three'
import type Time from '../engine/Utils/Time'
import type Sizes from '../engine/Utils/Sizes'
import type Resources from '../engine/Resources'
import type Camera from '../engine/Camera'
import type { GUI } from 'dat.gui'
import Terrain from './Terrain'
import Environment from './Environment'

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

        this.setTerrain()
        this.setEnvironment()
    }

    private setTerrain(): void {
        this.terrain = new Terrain({
            size: 200,
            segments: 256,
            heightScale: 8,
            sunDirection: new THREE.Vector3(0.5, 0.7, 0.3).normalize(),
        })
        this.container.add(this.terrain.container)
    }

    private setEnvironment(): void {
        this.environment = new Environment()
        this.container.add(this.environment.container)
    }
}
