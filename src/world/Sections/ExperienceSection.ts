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
        this.createPushableBlocks(options)
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

    private createPushableBlocks(options: ExperienceSectionOptions): void {
        const blockSize = 0.35
        const blockGeo = new THREE.BoxGeometry(blockSize, blockSize, blockSize)

        // The only genuinely colourful props in the world, so they should read
        // as toys. Tinting each with a saturated version of its own hue
        // deepens it — the one case where multiplying like with like is what
        // you want. `beige` was a pale non-colour; emerald is the only cool
        // note on an orange planet and pops hardest against it.
        const blocks: { matcap: MatcapName; tint?: string }[] = [
            { matcap: 'orange', tint: '#ff8c1a' },
            { matcap: 'yellow', tint: '#ffc61a' },
            { matcap: 'red', tint: '#ff3b26' },
            { matcap: 'emeraldGreen' },
        ]

        for (let i = 0; i < blocks.length; i++) {
            const mat = createMatcapMaterial({
                matcap: blocks[i].matcap,
                color: blocks[i].tint ? new THREE.Color(blocks[i].tint) : undefined,
            })

            const mesh = new THREE.Mesh(blockGeo, mat)

            // Offset by half a step so no block sits on the +Z axis, which is
            // where a #experience link drops the rover in. The radius is
            // deterministic for the same reason — with Math.random() a block
            // wandered onto the landing spot on some reloads.
            const angle = ((i + 0.5) / blocks.length) * Math.PI * 2
            const radius = 3.4 + (i % 2) * 0.5
            const bx = options.x + Math.cos(angle) * radius
            const bz = options.z + Math.sin(angle) * radius
            const by = options.terrain.getHeightAt(bx, bz) + blockSize / 2 + 0.5

            options.objects.add({
                mesh,
                position: new THREE.Vector3(bx, by, bz),
                mass: 1.0,
                restitution: 0.3,
                shadow: { sizeX: 0.45, sizeZ: 0.45 },
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
