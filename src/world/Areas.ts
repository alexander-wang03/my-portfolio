import * as THREE from 'three'
import type Time from '../engine/Utils/Time'
import type Physics from './Physics'
import type Camera from '../engine/Camera'
import type Terrain from './Terrain'
import Area, { type AreaOptions } from './Area'

export interface AreasOptions {
    time: Time
    physics: Physics
    camera: Camera
    terrain: Terrain
    renderer: THREE.WebGLRenderer
}

export default class Areas {
    container: THREE.Object3D
    items: Area[]
    private raycaster: THREE.Raycaster
    private mouse: THREE.Vector2
    private camera: Camera
    private terrain: Terrain
    private domElement: HTMLElement
    private currentArea: Area | null
    private needsUpdate: boolean

    constructor(options: AreasOptions) {
        this.container = new THREE.Object3D()
        this.items = []
        this.raycaster = new THREE.Raycaster()
        this.mouse = new THREE.Vector2()
        this.camera = options.camera
        this.terrain = options.terrain
        this.domElement = options.renderer.domElement
        this.currentArea = null
        this.needsUpdate = false

        this.setupMouse(options.renderer)

        options.time.on('tick', () => {
            // Raycaster hover detection
            if (this.needsUpdate) {
                this.updateRaycast()
                this.needsUpdate = false
            }

            // Car proximity test
            const pos = options.physics.chassisPosition
            for (const area of this.items) {
                if (!area.testCar) continue
                if (this.currentArea === area) continue
                const isIn = area.testPosition(pos.x, pos.z)
                if (isIn && !area.isIn) area.in()
                else if (!isIn && area.isIn) area.out()
            }
        })
    }

    add(options: Omit<AreaOptions, 'terrain'>): Area {
        const area = new Area({ ...options, terrain: this.terrain })
        this.items.push(area)
        this.container.add(area.container)
        return area
    }

    private setupMouse(renderer: THREE.WebGLRenderer): void {
        window.addEventListener('mousemove', (e) => {
            this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1
            this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1
            this.needsUpdate = true
        })

        window.addEventListener('mousedown', () => {
            if (this.currentArea) this.currentArea.interact()
        })

        renderer.domElement.addEventListener('touchstart', (e) => {
            this.mouse.x = (e.changedTouches[0].clientX / window.innerWidth) * 2 - 1
            this.mouse.y = -(e.changedTouches[0].clientY / window.innerHeight) * 2 + 1
            this.needsUpdate = true
            setTimeout(() => {
                if (this.currentArea) this.currentArea.interact()
            }, 50)
        })
    }

    private updateRaycast(): void {
        this.raycaster.setFromCamera(this.mouse, this.camera.instance)
        const mouseMeshes = this.items.map((a) => a.mouseMesh)
        const intersects = this.raycaster.intersectObjects(mouseMeshes)

        if (intersects.length) {
            const area = this.items.find((a) => a.mouseMesh === intersects[0].object)
            if (area && area !== this.currentArea) {
                if (this.currentArea) {
                    this.currentArea.out()
                }
                this.currentArea = area
                area.in()
            }
            this.domElement.classList.add('has-cursor-pointer')
        } else if (this.currentArea) {
            this.currentArea.out()
            this.currentArea = null
            this.domElement.classList.remove('has-cursor-pointer')
        }
    }
}
