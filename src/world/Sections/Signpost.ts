import * as THREE from 'three'
import type Terrain from '../Terrain'
import type Shadows from '../Shadows'
import { createMatcapMaterial } from '../Materials/Matcap'
import {
    BOARD_BACKGROUND,
    BOARD_FONT,
    createBoardMesh,
    createCanvasTexture,
} from '../Materials/SignBoard'

/**
 * A four-armed signpost at spawn, each arm pointing at a section.
 *
 * The sections sit 25 units out on the four compass points, which is far
 * enough that none of them is on screen from spawn. Without this the only way
 * to learn the world has anything in it is to drive off in a direction and
 * find out — and three of the four times, the answer is nothing yet.
 *
 * Arms point by being physically rotated, not by drawing an arrow on the
 * board. A drawn arrow would be wrong half the time: the label is printed on
 * both faces of each arm, and the two faces look opposite ways, so an arrow
 * pointing outward on one is pointing back at the post on the other. The cone
 * on the end of each arm is a real object and reads correctly from anywhere.
 */

export interface Destination {
    label: string
    x: number
    z: number
}

export interface SignpostOptions {
    terrain: Terrain
    shadows: Shadows
    x: number
    z: number
    destinations: Destination[]
}

const POST_HEIGHT = 2.7
const POST_RADIUS = 0.07

const ARM_LENGTH = 1.7
const ARM_HEIGHT = 0.42
/** Where the inner end of an arm sits, so it overlaps the post rather than floating. */
const ARM_INSET = 0.1
/** Height of the topmost arm; the rest hang below it. */
const ARM_TOP = 2.35
const ARM_SPACING = 0.52

export default class Signpost {
    container: THREE.Object3D

    constructor(options: SignpostOptions) {
        this.container = new THREE.Object3D()

        const terrainY = options.terrain.getHeightAt(options.x, options.z)
        this.container.position.set(options.x, terrainY, options.z)

        const metal = createMatcapMaterial({ matcap: 'gray' })

        const post = new THREE.Mesh(
            new THREE.CylinderGeometry(POST_RADIUS, POST_RADIUS, POST_HEIGHT, 8),
            metal,
        )
        post.position.y = POST_HEIGHT / 2
        this.container.add(post)

        options.destinations.forEach((destination, index) => {
            this.container.add(
                this.createArm(options, destination, ARM_TOP - index * ARM_SPACING, metal),
            )
        })

        options.shadows.add(this.container, {
            sizeX: ARM_LENGTH * 1.6,
            sizeZ: ARM_LENGTH * 1.6,
            alpha: 0.45,
        })
    }

    private createArm(
        options: SignpostOptions,
        destination: Destination,
        height: number,
        metal: THREE.Material,
    ): THREE.Object3D {
        const dx = destination.x - options.x
        const dz = destination.z - options.z
        const distance = Math.hypot(dx, dz)

        const texture = createCanvasTexture(384, 96, (ctx) => {
            ctx.fillStyle = BOARD_BACKGROUND
            ctx.fillRect(0, 0, 384, 96)
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'

            ctx.fillStyle = '#ffffff'
            ctx.font = `bold 34px ${BOARD_FONT}`
            ctx.fillText(destination.label.toUpperCase(), 192, 36)

            ctx.fillStyle = '#d4a574'
            ctx.font = `22px ${BOARD_FONT}`
            ctx.fillText(`${Math.round(distance)} m`, 192, 70)
        })

        const arm = new THREE.Object3D()

        const board = createBoardMesh(ARM_LENGTH, ARM_HEIGHT, texture)
        // The board's long axis is its local X, so the whole arm is rotated
        // rather than the board: a rotation about Y by `a` sends local +X to
        // (cos a, 0, -sin a), so `a = atan2(-dz, dx)` points it at the section
        // and leaves the printed faces square to the direction of travel.
        board.position.x = ARM_LENGTH / 2 - ARM_INSET
        arm.add(board)

        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.34, 6), metal)
        tip.position.x = ARM_LENGTH - ARM_INSET + 0.17
        // Cones point up their own +Y; -90° about Z lays this one along +X,
        // which is the direction the arm has just been aimed in.
        tip.rotation.z = -Math.PI / 2
        arm.add(tip)

        arm.position.y = height
        arm.rotation.y = Math.atan2(-dz, dx)

        return arm
    }
}
