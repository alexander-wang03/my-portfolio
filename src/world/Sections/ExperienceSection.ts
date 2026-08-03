import * as THREE from 'three'
import type Objects from '../Objects'
import type Zones from '../Zones'
import type Areas from '../Areas'
import type Terrain from '../Terrain'
import type Camera from '../../engine/Camera'
import type SectionOverlay from '../../ui/SectionOverlay'
import type Shadows from '../Shadows'
import { createMatcapMaterial, loadMatcapTexture } from '../Materials/Matcap'
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
        const metalTex = loadMatcapTexture('metal')
        const pillarMat = createMatcapMaterial({
            matcapTexture: metalTex,
            color: new THREE.Color('#808080'),
            indirect: 0,
        })

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
            data: { cameraAngle: 'experience' },
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
        const metalTex = loadMatcapTexture('metal')
        const blockSize = 0.35
        const blockGeo = new THREE.BoxGeometry(blockSize, blockSize, blockSize)

        const colors = ['#ff9043', '#fccf92', '#f5aa58', '#d4a574']

        for (let i = 0; i < colors.length; i++) {
            const mat = createMatcapMaterial({
                matcapTexture: metalTex,
                color: new THREE.Color(colors[i]),
                indirect: 0,
            })

            const mesh = new THREE.Mesh(blockGeo, mat)
            const angle = (i / colors.length) * Math.PI * 2
            const radius = 3 + Math.random()
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
