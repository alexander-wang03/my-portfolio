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
import Zones from './Zones'
import Areas from './Areas'
import Objects from './Objects'
import IntroSection from './Sections/IntroSection'
import ProjectsSection from './Sections/ProjectsSection'
import SectionOverlay from '../ui/SectionOverlay'

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
    zones!: Zones
    areas!: Areas
    objects!: Objects
    overlay!: SectionOverlay

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

    async init(onProgress?: (value: number) => void): Promise<void> {
        this.setTerrain()
        onProgress?.(0.3)
        this.setEnvironment()
        this.setControls()
        this.setPhysics()
        onProgress?.(0.5)
        this.setZones()
        this.setAreas()
        this.setObjects()
        this.setOverlay()
        this.setSections()
        onProgress?.(0.8)
        this.setRover()
        this.setDust()
        onProgress?.(1.0)
    }

    private setTerrain(): void {
        this.terrain = new Terrain({
            size: 200,
            segments: 16,
            heightScale: 12,
        })
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

        this.container.add(this.physics.debugContainer)

        this.time.on('tick', () => {
            this.camera.target.copy(this.physics.chassisPosition)
        })
    }

    private setZones(): void {
        this.zones = new Zones({
            time: this.time,
            physics: this.physics,
            config: this.config,
        })
        this.container.add(this.zones.container)
    }

    private setAreas(): void {
        this.areas = new Areas({
            time: this.time,
            physics: this.physics,
            camera: this.camera,
            renderer: this.renderer,
        })
        this.container.add(this.areas.container)
    }

    private setObjects(): void {
        this.objects = new Objects({
            time: this.time,
            physics: this.physics,
        })
        this.container.add(this.objects.container)
    }

    private setOverlay(): void {
        this.overlay = new SectionOverlay()
    }

    private setSections(): void {
        // Intro section — near spawn
        const intro = new IntroSection({
            objects: this.objects,
            terrain: this.terrain,
            x: 0,
            z: 0,
        })
        this.container.add(intro.container)

        // Projects section — offset to the side
        const projects = new ProjectsSection({
            objects: this.objects,
            zones: this.zones,
            areas: this.areas,
            terrain: this.terrain,
            camera: this.camera,
            overlay: this.overlay,
            x: 25,
            z: 0,
        })
        this.container.add(projects.container)
    }

    private setRover(): void {
        this.rover = new Rover({
            time: this.time,
            physics: this.physics,
            terrain: this.terrain,
        })
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
