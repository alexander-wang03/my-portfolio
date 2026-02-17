import * as THREE from 'three'
import gsap from 'gsap'
import EventEmitter from '../engine/Utils/EventEmitter'

export interface AreaOptions {
    position: { x: number; z: number }
    halfExtents: { x: number; z: number }
    testCar?: boolean
    active?: boolean
}

export default class Area extends EventEmitter {
    position: { x: number; z: number }
    halfExtents: { x: number; z: number }
    testCar: boolean
    active: boolean
    isIn: boolean
    container: THREE.Object3D
    mouseMesh: THREE.Mesh
    private borderMat: THREE.LineBasicMaterial

    constructor(options: AreaOptions) {
        super()
        this.position = options.position
        this.halfExtents = options.halfExtents
        this.testCar = options.testCar ?? true
        this.active = options.active ?? true
        this.isIn = false

        this.container = new THREE.Object3D()
        this.container.position.set(this.position.x, 0, this.position.z)

        // Invisible mesh for raycasting (horizontal plane)
        this.mouseMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(this.halfExtents.x * 2, this.halfExtents.z * 2),
            new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }),
        )
        this.mouseMesh.rotation.x = -Math.PI / 2
        this.mouseMesh.position.y = 0.1
        this.container.add(this.mouseMesh)

        // Border outline (rectangle at ground level)
        const w = this.halfExtents.x
        const h = this.halfExtents.z
        const points = [
            new THREE.Vector3(-w, 0.05, -h),
            new THREE.Vector3(w, 0.05, -h),
            new THREE.Vector3(w, 0.05, h),
            new THREE.Vector3(-w, 0.05, h),
        ]
        const geometry = new THREE.BufferGeometry().setFromPoints(points)
        this.borderMat = new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0,
        })
        const border = new THREE.LineLoop(geometry, this.borderMat)
        this.container.add(border)
    }

    in(): void {
        if (this.isIn) return
        this.isIn = true
        if (!this.active) return
        gsap.to(this.borderMat, { opacity: 0.5, duration: 0.3 })
        this.trigger('in')
    }

    out(): void {
        if (!this.isIn) return
        this.isIn = false
        gsap.to(this.borderMat, { opacity: 0, duration: 0.3 })
        this.trigger('out')
    }

    interact(): void {
        if (!this.active) return
        gsap.fromTo(this.borderMat, { opacity: 1 }, { opacity: 0.5, duration: 0.5 })
        this.trigger('interact')
    }

    testPosition(x: number, z: number): boolean {
        return (
            x > this.position.x - this.halfExtents.x &&
            x < this.position.x + this.halfExtents.x &&
            z > this.position.z - this.halfExtents.z &&
            z < this.position.z + this.halfExtents.z
        )
    }
}
