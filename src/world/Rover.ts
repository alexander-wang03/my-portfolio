import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type Time from '../engine/Utils/Time'
import type Physics from './Physics'

export interface RoverOptions {
    time: Time
    physics: Physics
}

export default class Rover {
    time: Time
    physics: Physics
    container: THREE.Object3D

    private model: THREE.Group | null = null

    constructor(options: RoverOptions) {
        this.time = options.time
        this.physics = options.physics
        this.container = new THREE.Object3D()
    }

    async load(): Promise<void> {
        const loader = new GLTFLoader()
        const gltf = await loader.loadAsync('/models/rover/perseverance.glb')

        const scene = gltf.scene

        // Scale model to match physics chassis dimensions
        const bbox = new THREE.Box3().setFromObject(scene)
        const size = new THREE.Vector3()
        bbox.getSize(size)

        const targetWidth = this.physics.options.chassisHalfWidth * 2
        const targetDepth = this.physics.options.chassisHalfDepth * 2
        const scaleFactor = Math.min(targetWidth / size.x, targetDepth / size.z)
        scene.scale.setScalar(scaleFactor)

        // Re-compute after scaling and center the model at origin
        bbox.setFromObject(scene)
        const center = new THREE.Vector3()
        bbox.getCenter(center)
        scene.position.sub(center)

        // Wrap in a group so centering offset doesn't conflict with tick sync
        this.model = new THREE.Group()
        this.model.add(scene)
        this.container.add(this.model)

        this.setTick()
    }

    private setTick(): void {
        this.time.on('tick', () => {
            if (!this.model) return

            this.model.position.copy(this.physics.chassisPosition)
            this.model.quaternion.copy(this.physics.chassisQuaternion)
        })
    }
}
