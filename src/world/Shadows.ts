import * as THREE from 'three'
import type Time from '../engine/Utils/Time'
import type Terrain from './Terrain'
import vertexShader from '../shaders/shadow/vertex.glsl'
import fragmentShader from '../shaders/shadow/fragment.glsl'

export interface ShadowAddOptions {
    sizeX: number
    sizeZ: number
    alpha?: number
    offsetY?: number
}

interface ShadowItem {
    reference: THREE.Object3D
    mesh: THREE.Mesh
    material: THREE.ShaderMaterial
    offsetY: number
    alpha: number
    sizeX: number
    sizeZ: number
}

export interface ShadowsOptions {
    time: Time
    terrain: Terrain
}

export default class Shadows {
    container: THREE.Object3D
    items: ShadowItem[] = []
    private terrain: Terrain

    // Sun direction for shadow projection (normalized)
    private sun = new THREE.Vector3(1, -2, 1.5).normalize()

    constructor(options: ShadowsOptions) {
        this.container = new THREE.Object3D()
        this.terrain = options.terrain

        options.time.on('tick', () => {
            this.update()
        })
    }

    add(reference: THREE.Object3D, options: ShadowAddOptions): void {
        const material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: {
                uColor: { value: new THREE.Color('#1a0e08') },
                uAlpha: { value: options.alpha ?? 0.6 },
                uFadeRadius: { value: 0.35 },
            },
            transparent: true,
            depthWrite: false,
        })

        const geometry = new THREE.PlaneGeometry(1, 1)
        const mesh = new THREE.Mesh(geometry, material)
        mesh.rotation.x = -Math.PI / 2 // Lay flat on ground
        this.container.add(mesh)

        this.items.push({
            reference,
            mesh,
            material,
            offsetY: options.offsetY ?? 0.01,
            alpha: options.alpha ?? 0.6,
            sizeX: options.sizeX,
            sizeZ: options.sizeZ,
        })
    }

    private update(): void {
        for (const item of this.items) {
            const refPos = item.reference.position

            // Project shadow position: offset by sun direction scaled by object height above terrain
            const terrainY = this.terrain.getHeightAt(refPos.x, refPos.z)
            const heightAbove = refPos.y - terrainY

            // Shadow offset: project sun direction onto XZ plane, scaled by height
            const offsetX = -this.sun.x / this.sun.y * heightAbove
            const offsetZ = -this.sun.z / this.sun.y * heightAbove

            item.mesh.position.set(
                refPos.x + offsetX,
                terrainY + item.offsetY,
                refPos.z + offsetZ,
            )

            // Scale shadow (plane is 1x1, scale to desired size)
            item.mesh.scale.set(item.sizeX, item.sizeZ, 1)

            // Fade alpha based on height (shadow disappears when object is far from ground)
            const maxHeight = 5
            const heightFade = 1 - Math.min(heightAbove / maxHeight, 1)
            item.material.uniforms.uAlpha.value = item.alpha * heightFade * heightFade

            // Match reference Y-rotation
            const euler = new THREE.Euler()
            euler.setFromQuaternion(item.reference.quaternion, 'YXZ')
            item.mesh.rotation.set(-Math.PI / 2, 0, -euler.y)
        }
    }
}
