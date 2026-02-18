import { Euler, type Object3D } from 'three'
import type Time from '../engine/Utils/Time'
import Terrain from './Terrain'

export interface ShadowAddOptions {
    sizeX: number
    sizeZ: number
    alpha?: number
    shape?: 'ellipse' | 'box'
}

interface ShadowItem {
    reference: Object3D
    alpha: number
    sizeX: number
    sizeZ: number
    shape: 'ellipse' | 'box'
}

export interface ShadowsOptions {
    time: Time
    terrain: Terrain
}

export default class Shadows {
    items: ShadowItem[] = []
    private terrain: Terrain

    constructor(options: ShadowsOptions) {
        this.terrain = options.terrain

        options.time.on('tick', () => {
            this.update()
        })
    }

    add(reference: Object3D, options: ShadowAddOptions): void {
        this.items.push({
            reference,
            alpha: options.alpha ?? 0.6,
            sizeX: options.sizeX,
            sizeZ: options.sizeZ,
            shape: options.shape ?? 'ellipse',
        })
    }

    private update(): void {
        const data = this.terrain.objShadowData
        const count = Math.min(this.items.length, Terrain.MAX_OBJ_SHADOWS)
        this.terrain.objectShadowUniforms.uObjShadowCount.value = count

        for (let i = 0; i < count; i++) {
            const item = this.items[i]
            const refPos = item.reference.position

            const terrainY = this.terrain.getHeightAt(refPos.x, refPos.z)
            const heightAbove = refPos.y - terrainY

            // Texel 0: posX, posZ, halfSizeX, halfSizeZ (shadow directly below object)
            const base0 = i * 2 * 4
            data[base0 + 0] = refPos.x
            data[base0 + 1] = refPos.z
            data[base0 + 2] = item.sizeX * 0.5
            data[base0 + 3] = item.sizeZ * 0.5

            // Texel 1: angle, alpha, shape (0=ellipse, 1=box), unused
            const base1 = (i * 2 + 1) * 4
            const euler = _euler.setFromQuaternion(item.reference.quaternion, 'YXZ')
            const maxHeight = 5
            const heightFade = 1 - Math.min(heightAbove / maxHeight, 1)

            data[base1 + 0] = euler.y
            data[base1 + 1] = item.alpha * heightFade * heightFade
            data[base1 + 2] = item.shape === 'box' ? 1.0 : 0.0
            data[base1 + 3] = 0
        }

        this.terrain.objShadowTexture.needsUpdate = true
    }
}

// Reusable Euler to avoid allocation per frame
const _euler = new Euler()
