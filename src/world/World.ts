import * as THREE from 'three'
import gsap from 'gsap'
import type Time from '../engine/Utils/Time'
import type Sizes from '../engine/Utils/Sizes'
import type Camera from '../engine/Camera'
import type { GUI } from 'dat.gui'
import { setRevealFade, setRevealProgress } from './Reveal'
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
import AboutSection from './Sections/AboutSection'
import ContactSection from './Sections/ContactSection'

import SectionOverlay from '../ui/SectionOverlay'

export interface WorldOptions {
    config: { debug: boolean; touch: boolean }
    debug?: GUI
    time: Time
    sizes: Sizes
    camera: Camera
    scene: THREE.Scene
    renderer: THREE.WebGLRenderer
}

export interface Reveal {
    matcapsProgress: number
    fadeProgress: number
    go: () => void
}

export default class World {
    config: WorldOptions['config']
    debug?: GUI
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
    reveal!: Reveal

    /** Camera tracks the rover, except while it is dropping in on reveal. */
    private followRover = true
    /** Resume following anyway if the rover never reports a clean landing. */
    private followDeadline = 0

    constructor(options: WorldOptions) {
        this.config = options.config
        this.debug = options.debug
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
        this.setSections()
        onProgress?.(0.8)
        this.setRover()
        this.setDust()
        this.setAmbientDust()
        this.setSounds()
        this.setReveal()
        onProgress?.(1.0)
    }

    private setReveal(): void {
        this.reveal = {
            matcapsProgress: 0,
            fadeProgress: 0,
            go: () => {
                // The world rises out of the ground, then its shadows and
                // sign boards fade in behind it.
                gsap.to(this.reveal, { matcapsProgress: 1, duration: 3, ease: 'none' })
                gsap.to(this.reveal, { fadeProgress: 1, duration: 2.5, delay: 0.5 })

                // Hold the camera on the spot the rover will land on. Following
                // it through the air whips the camera up and back down again.
                this.followRover = false
                this.followDeadline = this.time.elapsed + 4000
                this.camera.target.set(0, this.terrain.getHeightAt(0, 0) + 0.5, 0)

                // Drop the rover in from higher than a normal respawn
                this.physics.resetVehicle(6)

                this.sounds.fadeIn()
            },
        }

        let previousMatcaps = -1
        let previousFade = -1

        this.time.on('tick', () => {
            if (this.reveal.matcapsProgress !== previousMatcaps) {
                setRevealProgress(this.reveal.matcapsProgress)
                previousMatcaps = this.reveal.matcapsProgress
            }

            if (this.reveal.fadeProgress !== previousFade) {
                setRevealFade(this.reveal.fadeProgress)
                this.shadows.alpha = this.reveal.fadeProgress
                this.rover.revealAlpha = this.reveal.fadeProgress
                previousFade = this.reveal.fadeProgress
            }
        })

        if (this.debug) {
            const folder = this.debug.addFolder('reveal')
            folder.add(this.reveal, 'matcapsProgress').step(0.001).min(0).max(1)
            folder.add(this.reveal, 'fadeProgress').step(0.001).min(0).max(1)
            folder.add(this.reveal, 'go').name('replay reveal')
        }
    }

    private setTerrain(): void {
        this.terrain = new Terrain({
            size: 200,
            segments: 16,
            heightScale: 6,
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
            time: this.time,
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
            if (!this.followRover) {
                const landed = this.physics.wheelGrounded.some(Boolean)
                if (!landed && this.time.elapsed < this.followDeadline) return
                this.followRover = true
            }

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
            terrain: this.terrain,
            renderer: this.renderer,
        })
        this.container.add(this.areas.container)
    }

    private setShadows(): void {
        this.shadows = new Shadows({
            time: this.time,
            terrain: this.terrain,
        })
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

    private setSections(): void {
        // Intro section — block letters near spawn
        const intro = new IntroSection({
            objects: this.objects,
            terrain: this.terrain,
            touch: this.controls.hasTouchControls,
            x: 0,
            z: 0,
        })
        this.container.add(intro.container)

        // Projects section — east
        const projects = new ProjectsSection({
            zones: this.zones,
            areas: this.areas,
            terrain: this.terrain,
            shadows: this.shadows,
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
            shadows: this.shadows,
            camera: this.camera,
            overlay: this.overlay,
            x: 0,
            z: -25,
        })
        this.container.add(experience.container)

        // About section — west
        const about = new AboutSection({
            zones: this.zones,
            terrain: this.terrain,
            shadows: this.shadows,
            camera: this.camera,
            overlay: this.overlay,
            x: -25,
            z: 0,
        })
        this.container.add(about.container)

        // Contact section — north (past intro sign)
        const contact = new ContactSection({
            zones: this.zones,
            areas: this.areas,
            terrain: this.terrain,
            shadows: this.shadows,
            camera: this.camera,
            overlay: this.overlay,
            x: 0,
            z: 25,
        })
        this.container.add(contact.container)
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
