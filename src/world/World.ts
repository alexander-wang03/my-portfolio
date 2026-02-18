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
import AmbientDust from './Particles/AmbientDust'
import Zones from './Zones'
import Areas from './Areas'
import Objects from './Objects'
import Walls from './Walls'
import Tiles from './Tiles'
import Rocks from './Rocks'
import Shadows from './Shadows'
import Sounds from './Sounds'
import IntroSection from './Sections/IntroSection'
import ProjectsSection from './Sections/ProjectsSection'
import ExperienceSection from './Sections/ExperienceSection'
import SkillsSection from './Sections/SkillsSection'
import ContactSection from './Sections/ContactSection'
import SectionOverlay from '../ui/SectionOverlay'
import HUD from '../ui/HUD'

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
    ambientDust!: AmbientDust
    zones!: Zones
    areas!: Areas
    objects!: Objects
    overlay!: SectionOverlay
    walls!: Walls
    tiles!: Tiles
    rocks!: Rocks
    shadows!: Shadows
    sounds!: Sounds
    hud!: HUD

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
        this.setShadows()
        this.setObjects()
        this.setWalls()
        this.setTiles()
        this.setRocks()
        this.setOverlay()
        this.setHUD()
        this.setSections()
        onProgress?.(0.8)
        this.setRover()
        this.setDust()
        this.setAmbientDust()
        this.setSounds()
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

    private setShadows(): void {
        this.shadows = new Shadows({
            time: this.time,
            terrain: this.terrain,
        })
        this.container.add(this.shadows.container)
    }

    private setObjects(): void {
        this.objects = new Objects({
            time: this.time,
            physics: this.physics,
            shadows: this.shadows,
        })
        this.container.add(this.objects.container)
    }

    private setWalls(): void {
        this.walls = new Walls({
            objects: this.objects,
            terrain: this.terrain,
        })
        this.container.add(this.walls.container)
    }

    private setTiles(): void {
        this.tiles = new Tiles({
            terrain: this.terrain,
        })
        this.container.add(this.tiles.container)
    }

    private setRocks(): void {
        this.rocks = new Rocks({
            terrain: this.terrain,
            objects: this.objects,
        })
        this.container.add(this.rocks.container)
    }

    private setOverlay(): void {
        this.overlay = new SectionOverlay()
    }

    private setHUD(): void {
        this.hud = new HUD()
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

        // Projects section — east
        const projects = new ProjectsSection({
            zones: this.zones,
            areas: this.areas,
            terrain: this.terrain,
            camera: this.camera,
            overlay: this.overlay,
            x: 25,
            z: 0,
        })
        this.container.add(projects.container)

        // Experience section — south
        const experience = new ExperienceSection({
            objects: this.objects,
            zones: this.zones,
            areas: this.areas,
            terrain: this.terrain,
            camera: this.camera,
            overlay: this.overlay,
            x: 0,
            z: -25,
        })
        this.container.add(experience.container)

        // Skills section — west
        const skills = new SkillsSection({
            objects: this.objects,
            zones: this.zones,
            terrain: this.terrain,
            camera: this.camera,
            overlay: this.overlay,
            x: -25,
            z: 0,
        })
        this.container.add(skills.container)

        // Contact section — north (past intro sign)
        const contact = new ContactSection({
            zones: this.zones,
            areas: this.areas,
            terrain: this.terrain,
            camera: this.camera,
            overlay: this.overlay,
            x: 0,
            z: 25,
        })
        this.container.add(contact.container)

        // Wire HUD to zone events for section name display
        const sectionZones = [
            { name: 'Projects', x: 25, z: 0 },
            { name: 'Experience', x: 0, z: -25 },
            { name: 'Skills', x: -25, z: 0 },
            { name: 'Contact', x: 0, z: 25 },
        ]

        for (const sz of sectionZones) {
            // Find matching zone by position
            for (const zone of this.zones.items) {
                const dx = Math.abs(zone.position.x - sz.x)
                const dz = Math.abs(zone.position.z - sz.z)
                if (dx < 1 && dz < 1) {
                    zone.on('in', () => this.hud.showSection(sz.name))
                    zone.on('out', () => this.hud.hideSection())
                    break
                }
            }
        }
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

    private setAmbientDust(): void {
        this.ambientDust = new AmbientDust({
            time: this.time,
            physics: this.physics,
        })
        this.container.add(this.ambientDust.container)
    }

    private setSounds(): void {
        this.sounds = new Sounds({
            time: this.time,
            physics: this.physics,
        })
    }
}
