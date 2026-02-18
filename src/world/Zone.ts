import * as THREE from 'three'
import EventEmitter from '../engine/Utils/EventEmitter'

export interface ZoneOptions {
    position: { x: number; z: number }
    halfExtents: { x: number; z: number }
    data?: Record<string, unknown>
}

export default class Zone extends EventEmitter {
    position: { x: number; z: number }
    halfExtents: { x: number; z: number }
    data: Record<string, unknown>
    isIn: boolean
    mesh: THREE.Mesh

    constructor(options: ZoneOptions) {
        super()
        this.position = options.position
        this.halfExtents = options.halfExtents
        this.data = options.data ?? {}
        this.isIn = false

        // Debug wireframe box
        this.mesh = new THREE.Mesh(
            new THREE.BoxGeometry(
                this.halfExtents.x * 2,
                3,
                this.halfExtents.z * 2,
            ),
            new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: true }),
        )
        this.mesh.position.set(this.position.x, 1.5, this.position.z)
        this.mesh.visible = false
    }

    test(x: number, z: number): void {
        const isIn =
            x > this.position.x - this.halfExtents.x &&
            x < this.position.x + this.halfExtents.x &&
            z > this.position.z - this.halfExtents.z &&
            z < this.position.z + this.halfExtents.z

        if (isIn && !this.isIn) {
            this.isIn = true
            this.trigger('in', [this.data])
        } else if (!isIn && this.isIn) {
            this.isIn = false
            this.trigger('out', [this.data])
        }
    }
}
