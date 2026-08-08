import * as THREE from 'three'
import type Objects from '../Objects'
import type Zones from '../Zones'
import type Areas from '../Areas'
import type Terrain from '../Terrain'
import type Camera from '../../engine/Camera'
import type SectionOverlay from '../../ui/SectionOverlay'
import type Shadows from '../Shadows'
import { createMatcapMaterial, type MatcapName } from '../Materials/Matcap'
import {
    BOARD_BACKGROUND,
    BOARD_FONT,
    createBoardMaterial,
    createCanvasTexture,
} from '../Materials/SignBoard'
import { EXPERIENCES, RESUME_URL } from '../../content/portfolio'

export interface ExperienceSectionOptions {
    objects: Objects
    zones: Zones
    areas: Areas
    terrain: Terrain
    shadows: Shadows
    camera: Camera
    overlay: SectionOverlay
    x: number
    z: number
}

const SPACING = 5

export default class ExperienceSection {
    container: THREE.Object3D

    constructor(options: ExperienceSectionOptions) {
        this.container = new THREE.Object3D()

        this.createMilestones(options)
        this.createZone(options)
        this.createPushableProps(options)
    }

    private createMilestones(options: ExperienceSectionOptions): void {
        const pillarMat = createMatcapMaterial({ matcap: 'gray' })

        const startOffset = -((EXPERIENCES.length - 1) * SPACING) / 2

        for (let i = 0; i < EXPERIENCES.length; i++) {
            const exp = EXPERIENCES[i]
            const px = options.x + startOffset + i * SPACING
            const pz = options.z
            const terrainY = options.terrain.getHeightAt(px, pz)

            const pillarHeight = 1.8
            const pillar = new THREE.Mesh(
                new THREE.CylinderGeometry(0.05, 0.05, pillarHeight, 8),
                pillarMat,
            )

            const boardWidth = 3.0
            const boardHeight = 0.9

            // Company name over the dates
            const labelTexture = createCanvasTexture(512, 128, (ctx) => {
                ctx.fillStyle = BOARD_BACKGROUND
                ctx.fillRect(0, 0, 512, 128)
                ctx.textAlign = 'center'
                ctx.textBaseline = 'top'

                ctx.fillStyle = '#ffffff'
                ctx.font = `bold 40px ${BOARD_FONT}`
                ctx.fillText(exp.company, 256, 15)

                ctx.fillStyle = '#fccf92'
                ctx.font = `28px ${BOARD_FONT}`
                ctx.fillText(exp.years, 256, 70)
            })

            const board = new THREE.Mesh(
                new THREE.PlaneGeometry(boardWidth, boardHeight),
                createBoardMaterial(labelTexture),
            )
            board.position.y = pillarHeight / 2 + boardHeight / 2 + 0.05

            const signGroup = new THREE.Group()
            signGroup.add(pillar, board)

            signGroup.position.set(px, terrainY + pillarHeight / 2, pz)
            this.container.add(signGroup)

            options.shadows.add(signGroup, { sizeX: boardWidth * 0.8, sizeZ: 0.4, shape: 'box' })
        }
    }

    private createZone(options: ExperienceSectionOptions): void {
        const totalWidth = (EXPERIENCES.length - 1) * SPACING + 8
        const zone = options.zones.add({
            position: { x: options.x, z: options.z },
            halfExtents: { x: totalWidth / 2 + 3, z: 8 },
            data: { cameraAngle: 'experience', section: 'experience' },
        })

        zone.on('in', () => {
            options.camera.angle.set('experience')
            options.overlay.show(this.buildOverlayHTML())
        })

        zone.on('out', () => {
            options.camera.angle.set('default')
            options.overlay.hide()
        })
    }

    private createPushableProps(options: ExperienceSectionOptions): void {
        // The only genuinely colourful things in the world, so they should read
        // as toys. Tinting each with a saturated version of its own hue deepens
        // it — the one case where multiplying like with like is what you want.
        //
        // Every shape here is convex and low-poly on purpose: `useConvexHull`
        // then produces a collider identical to the mesh, so they collide
        // exactly as they look, and the facets suit the art direction. A smooth
        // sphere would roll like a faceted one and give the game away.
        const props: { geometry: THREE.BufferGeometry; matcap: MatcapName; tint?: string }[] = [
            { geometry: new THREE.BoxGeometry(0.52, 0.52, 0.52), matcap: 'orange', tint: '#ff8c1a' },
            { geometry: new THREE.IcosahedronGeometry(0.34, 0), matcap: 'yellow', tint: '#ffc61a' },
            { geometry: new THREE.CylinderGeometry(0.26, 0.26, 0.56, 8), matcap: 'red', tint: '#ff3b26' },
            { geometry: new THREE.ConeGeometry(0.33, 0.62, 7), matcap: 'emeraldGreen' },
            { geometry: new THREE.OctahedronGeometry(0.37, 0), matcap: 'blue' },
            { geometry: new THREE.DodecahedronGeometry(0.33, 0), matcap: 'purple' },
        ]

        for (let i = 0; i < props.length; i++) {
            const prop = props[i]

            const mesh = new THREE.Mesh(
                prop.geometry,
                createMatcapMaterial({
                    matcap: prop.matcap,
                    color: prop.tint ? new THREE.Color(prop.tint) : undefined,
                }),
            )

            // Ring angles of 0, 60, ... 300 keep every prop off the +Z axis,
            // which is where a #experience link drops the rover in. Radius is
            // deterministic for the same reason — with Math.random() a prop
            // wandered onto the landing spot on some reloads.
            const angle = (i / props.length) * Math.PI * 2
            const radius = 4.6 + (i % 2) * 0.4
            const px = options.x + Math.cos(angle) * radius
            const pz = options.z + Math.sin(angle) * radius

            // Each shape sits on its own base, so measure rather than assume
            prop.geometry.computeBoundingBox()
            const bounds = prop.geometry.boundingBox!
            const halfHeight = (bounds.max.y - bounds.min.y) / 2
            const footprint = Math.max(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z)

            options.objects.add({
                mesh,
                position: new THREE.Vector3(
                    px,
                    options.terrain.getHeightAt(px, pz) + halfHeight + 0.4,
                    pz,
                ),
                // Light for their size, to match the high brick sound — they
                // should skitter when nudged rather than shove back
                mass: 0.4,
                restitution: 0.3,
                useConvexHull: true,
                impactSound: 'block',
                shadow: { sizeX: footprint * 1.25, sizeZ: footprint * 1.25 },
            })
        }
    }

    private buildOverlayHTML(): string {
        let html = '<h2>Experience</h2>'
        html += `<div class="project-card"><a href="${RESUME_URL}" target="_blank" rel="noopener">View Resume &rarr;</a></div>`
        for (const exp of EXPERIENCES) {
            html += `
                <div class="project-card">
                    <h3>${exp.company}</h3>
                    <p class="card-subtitle">${exp.role} &middot; ${exp.years}</p>
                    <p>${exp.description}</p>
                </div>
            `
        }
        return html
    }
}
