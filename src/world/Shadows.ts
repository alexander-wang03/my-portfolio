import { Euler, MathUtils, type Object3D } from 'three'
import type Time from '../engine/Utils/Time'
import type Physics from './Physics'
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
    physics: Physics
    /** Quality cap on how many shadows reach the shader. */
    maxItems: number
    /** Shadows beyond this distance from the rover are dropped. */
    maxDistance: number
}

/** Re-sorting every frame is wasted work — almost every caster is static. */
const RESORT_INTERVAL = 10

/** Distance over which a shadow fades out rather than popping at the cut-off. */
const FADE_BAND = 6

export default class Shadows {
    items: ShadowItem[] = []
    /** Global multiplier, driven by the reveal animation. */
    alpha = 0

    private terrain: Terrain
    private physics: Physics
    private maxItems: number
    private maxDistance: number

    /** The nearest `maxItems` casters, refreshed periodically. */
    private visible: ShadowItem[] = []
    private framesUntilResort = 0

    constructor(options: ShadowsOptions) {
        this.terrain = options.terrain
        this.physics = options.physics
        this.maxItems = Math.min(options.maxItems, Terrain.MAX_OBJ_SHADOWS)
        this.maxDistance = options.maxDistance

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

    /**
     * Pick the shadows worth drawing.
     *
     * The terrain shader walks this list for every pixel of visible ground, so
     * the count is a direct multiplier on the most expensive shader in the
     * frame. Previously the list was simply truncated at 128 in registration
     * order, which both cost the most and silently dropped whichever casters
     * happened to be registered last.
     */
    private selectVisible(): void {
        const focus = this.physics.chassisPosition
        const cutoff = this.maxDistance * this.maxDistance

        const near: { item: ShadowItem; distanceSq: number }[] = []

        for (const item of this.items) {
            const dx = item.reference.position.x - focus.x
            const dz = item.reference.position.z - focus.z
            const distanceSq = dx * dx + dz * dz

            if (distanceSq <= cutoff) near.push({ item, distanceSq })
        }

        near.sort((a, b) => a.distanceSq - b.distanceSq)

        this.visible = near.slice(0, this.maxItems).map((entry) => entry.item)
    }

    private update(): void {
        if (this.framesUntilResort <= 0) {
            this.selectVisible()
            this.framesUntilResort = RESORT_INTERVAL
        }
        this.framesUntilResort--

        const data = this.terrain.objShadowData
        const focus = this.physics.chassisPosition
        const count = this.visible.length
        this.terrain.objectShadowUniforms.uObjShadowCount.value = count

        for (let i = 0; i < count; i++) {
            const item = this.visible[i]
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

            // Ease out at the cull boundary so driving away does not pop
            const distance = Math.hypot(refPos.x - focus.x, refPos.z - focus.z)
            const distanceFade = 1 - MathUtils.smoothstep(
                distance,
                this.maxDistance - FADE_BAND,
                this.maxDistance,
            )

            data[base1 + 0] = euler.y
            data[base1 + 1] = item.alpha * heightFade * heightFade * distanceFade * this.alpha
            data[base1 + 2] = item.shape === 'box' ? 1.0 : 0.0
            data[base1 + 3] = 0
        }

        this.terrain.objShadowTexture.needsUpdate = true
    }
}

// Reusable Euler to avoid allocation per frame
const _euler = new Euler()
