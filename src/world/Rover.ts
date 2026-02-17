import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type Time from '../engine/Utils/Time'
import type Physics from './Physics'
import type Terrain from './Terrain'

export interface RoverOptions {
    time: Time
    physics: Physics
    terrain: Terrain
}

export default class Rover {
    time: Time
    physics: Physics
    terrain: Terrain
    container: THREE.Object3D

    private model: THREE.Group | null = null
    private shadow!: THREE.Mesh

    constructor(options: RoverOptions) {
        this.time = options.time
        this.physics = options.physics
        this.terrain = options.terrain
        this.container = new THREE.Object3D()

        this.createShadow()
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

    private createShadow(): void {
        // Procedural elliptical gradient texture
        const res = 64
        const data = new Uint8Array(res * res * 4)
        const o = this.physics.options

        for (let y = 0; y < res; y++) {
            for (let x = 0; x < res; x++) {
                const dx = (x / (res - 1) - 0.5) * 2
                const dy = (y / (res - 1) - 0.5) * 2
                // Elliptical distance (wider along X for lateral wheels)
                const dist = Math.sqrt(dx * dx * 0.8 + dy * dy * 1.2)
                const alpha = Math.max(0, 1 - dist)
                const smooth = alpha * alpha * (3 - 2 * alpha)

                const idx = (y * res + x) * 4
                // Slightly warm shadow to blend with Mars surface
                data[idx] = 10
                data[idx + 1] = 5
                data[idx + 2] = 2
                data[idx + 3] = Math.floor(smooth * 200)
            }
        }

        const texture = new THREE.DataTexture(data, res, res, THREE.RGBAFormat)
        texture.needsUpdate = true

        // Shadow plane sized to cover chassis + wheels with penumbra
        const shadowWidth = (o.chassisHalfWidth + o.wheelRadius) * 2 + 0.4
        const shadowDepth = (o.chassisHalfDepth + o.wheelRadius) * 2 + 0.4
        const geometry = new THREE.PlaneGeometry(shadowWidth, shadowDepth)
        geometry.rotateX(-Math.PI / 2)

        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
        })

        this.shadow = new THREE.Mesh(geometry, material)
        this.shadow.renderOrder = -1
        this.container.add(this.shadow)
    }

    private setTick(): void {
        this.time.on('tick', () => {
            if (!this.model) return

            this.model.position.copy(this.physics.chassisPosition)
            this.model.quaternion.copy(this.physics.chassisQuaternion)

            // Shadow follows rover on terrain surface
            const pos = this.physics.chassisPosition
            const terrainY = this.terrain.getHeightAt(pos.x, pos.z)
            this.shadow.position.set(pos.x, terrainY + 0.05, pos.z)

            // Rotate shadow to match rover heading (Y-axis only)
            const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.physics.chassisQuaternion)
            this.shadow.rotation.y = Math.atan2(forward.x, forward.z)

            // Fade shadow based on height above ground (airborne → faint)
            const heightAboveGround = pos.y - terrainY
            const shadowOpacity = THREE.MathUtils.clamp(1.0 - (heightAboveGround - 1.0) / 3.0, 0, 1)
            ;(this.shadow.material as THREE.MeshBasicMaterial).opacity = shadowOpacity * 0.55
        })
    }
}
