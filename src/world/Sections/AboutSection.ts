import * as THREE from 'three'
import type Zones from '../Zones'
import type Terrain from '../Terrain'
import type Camera from '../../engine/Camera'
import type SectionOverlay from '../../ui/SectionOverlay'
import type Shadows from '../Shadows'
import { createMatcapMaterial } from '../Materials/Matcap'
import {
    BOARD_BACKGROUND,
    BOARD_FONT,
    createBoardMaterial,
    createCanvasTexture,
    fillWrappedText,
} from '../Materials/SignBoard'
import { ABOUT } from '../../content/portfolio'

export interface AboutSectionOptions {
    zones: Zones
    terrain: Terrain
    shadows: Shadows
    camera: Camera
    overlay: SectionOverlay
    x: number
    z: number
}

export default class AboutSection {
    container: THREE.Object3D

    constructor(options: AboutSectionOptions) {
        this.container = new THREE.Object3D()

        this.createAboutSign(options)
        this.createZone(options)
    }

    private createAboutSign(options: AboutSectionOptions): void {
        const pillarMat = createMatcapMaterial({ matcap: 'gray' })

        const px = options.x
        const pz = options.z
        const terrainY = options.terrain.getHeightAt(px, pz)

        // Pillar
        const pillarHeight = 1.6
        const pillar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.05, 0.05, pillarHeight, 8),
            pillarMat,
        )

        // Billboard: heading, wrapped tagline, subtitle
        const boardWidth = 4.0
        const boardHeight = 1.4
        const texture = createCanvasTexture(512, 192, (ctx) => {
            ctx.fillStyle = BOARD_BACKGROUND
            ctx.fillRect(0, 0, 512, 192)
            ctx.textAlign = 'center'
            ctx.textBaseline = 'top'

            ctx.fillStyle = '#ffffff'
            ctx.font = `bold 32px ${BOARD_FONT}`
            ctx.fillText(ABOUT.heading, 256, 15)

            ctx.fillStyle = '#fccf92'
            ctx.font = `18px ${BOARD_FONT}`
            fillWrappedText(ctx, ABOUT.tagline, 256, 65, 440, 24)

            ctx.fillStyle = '#d4a574'
            ctx.font = `16px ${BOARD_FONT}`
            ctx.fillText(ABOUT.subtitle, 256, 150)
        })

        const board = new THREE.Mesh(
            new THREE.PlaneGeometry(boardWidth, boardHeight),
            createBoardMaterial(texture),
        )
        board.position.y = pillarHeight / 2 + boardHeight / 2 + 0.05

        const signGroup = new THREE.Group()
        signGroup.add(pillar, board)
        signGroup.position.set(px, terrainY + pillarHeight / 2, pz)
        this.container.add(signGroup)

        options.shadows.add(signGroup, { sizeX: boardWidth * 0.8, sizeZ: 0.4, shape: 'box' })
    }

    private createZone(options: AboutSectionOptions): void {
        const zone = options.zones.add({
            position: { x: options.x, z: options.z },
            halfExtents: { x: 8, z: 6 },
            data: { cameraAngle: 'about', section: 'about' },
        })

        zone.on('in', () => {
            options.camera.angle.set('about')
            options.overlay.show(this.buildOverlayHTML())
        })

        zone.on('out', () => {
            options.camera.angle.set('default')
            options.overlay.hide()
        })
    }

    private buildOverlayHTML(): string {
        const education = ABOUT.education.lines.map((line) => `<p>${line}</p>`).join('')

        return `
            <h2>${ABOUT.heading}</h2>
            <div class="project-card">
                <p>${ABOUT.intro}</p>
            </div>
            <div class="project-card">
                <h3>${ABOUT.current.heading}</h3>
                <p>${ABOUT.current.body}</p>
            </div>
            <div class="project-card">
                <h3>${ABOUT.education.heading}</h3>
                ${education}
            </div>
        `
    }
}
