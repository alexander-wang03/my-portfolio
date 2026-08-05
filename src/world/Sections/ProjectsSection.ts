import * as THREE from 'three'
import type Zones from '../Zones'
import type Areas from '../Areas'
import type Terrain from '../Terrain'
import type Camera from '../../engine/Camera'
import type SectionOverlay from '../../ui/SectionOverlay'
import type Shadows from '../Shadows'
import { createMatcapMaterial } from '../Materials/Matcap'
import { BOARD_BACKGROUND, createBoardMaterial, createTextTexture } from '../Materials/SignBoard'
import { PROJECTS } from '../../content/portfolio'

export interface ProjectsSectionOptions {
    zones: Zones
    areas: Areas
    terrain: Terrain
    shadows: Shadows
    camera: Camera
    overlay: SectionOverlay
    x: number
    z: number
}

const SPACING = 4.5

export default class ProjectsSection {
    container: THREE.Object3D

    constructor(options: ProjectsSectionOptions) {
        this.container = new THREE.Object3D()

        this.createSignposts(options)
        this.createZone(options)
        this.createAreas(options)
    }

    /** X position of the sign for project `index`, laid out around the centre. */
    private signX(options: ProjectsSectionOptions, index: number): number {
        const startOffset = -((PROJECTS.length - 1) * SPACING) / 2
        return options.x + startOffset + index * SPACING
    }

    private createSignposts(options: ProjectsSectionOptions): void {
        const pillarMat = createMatcapMaterial({ matcap: 'gray' })

        for (let i = 0; i < PROJECTS.length; i++) {
            const project = PROJECTS[i]
            const px = this.signX(options, i)
            const pz = options.z
            const terrainY = options.terrain.getHeightAt(px, pz)

            // Pillar (cylinder)
            const pillarHeight = 1.8
            const pillar = new THREE.Mesh(
                new THREE.CylinderGeometry(0.05, 0.05, pillarHeight, 8),
                pillarMat,
            )

            // Board with project name (flat plane, double-sided)
            const boardWidth = 2.5
            const boardHeight = 0.8
            const nameTexture = createTextTexture(project.title, 512, 128, {
                fontSize: 56,
                color: '#ffffff',
                bg: BOARD_BACKGROUND,
            })
            const board = new THREE.Mesh(
                new THREE.PlaneGeometry(boardWidth, boardHeight),
                createBoardMaterial(nameTexture),
            )
            board.position.y = pillarHeight / 2 + boardHeight / 2 + 0.05

            const signGroup = new THREE.Group()
            signGroup.add(pillar, board)

            signGroup.position.set(px, terrainY + pillarHeight / 2, pz)
            this.container.add(signGroup)

            options.shadows.add(signGroup, { sizeX: boardWidth * 0.8, sizeZ: 0.4, shape: 'box' })
        }
    }

    private createZone(options: ProjectsSectionOptions): void {
        const totalWidth = (PROJECTS.length - 1) * SPACING + 6
        const zone = options.zones.add({
            position: { x: options.x, z: options.z },
            halfExtents: { x: totalWidth / 2 + 3, z: 8 },
            data: { cameraAngle: 'projects' },
        })

        zone.on('in', () => {
            options.camera.angle.set('projects')
            options.overlay.show(this.buildOverlayHTML())
        })

        zone.on('out', () => {
            options.camera.angle.set('default')
            options.overlay.hide()
        })
    }

    private createAreas(options: ProjectsSectionOptions): void {
        for (let i = 0; i < PROJECTS.length; i++) {
            const project = PROJECTS[i]

            const area = options.areas.add({
                position: { x: this.signX(options, i), z: options.z },
                halfExtents: { x: 1.8, z: 1.8 },
                testCar: true,
                active: true,
            })

            area.on('interact', () => {
                if (project.url && project.url !== '#') {
                    window.open(project.url, '_blank')
                }
            })
        }
    }

    private buildOverlayHTML(): string {
        let html = '<h2>Projects</h2>'
        for (const project of PROJECTS) {
            html += `
                <div class="project-card">
                    <h3>${project.title}</h3>
                    <p>${project.description}</p>
                    <a href="${project.url}" target="_blank" rel="noopener">View Project &rarr;</a>
                </div>
            `
        }
        return html
    }
}
