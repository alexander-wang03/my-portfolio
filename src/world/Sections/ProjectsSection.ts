import * as THREE from 'three'
import type Zones from '../Zones'
import type Areas from '../Areas'
import type Terrain from '../Terrain'
import type Camera from '../../engine/Camera'
import type SectionOverlay from '../../ui/SectionOverlay'
import { createMatcapMaterial, loadMatcapTexture } from '../Materials/Matcap'

interface Project {
    title: string
    description: string
    url: string
}

export interface ProjectsSectionOptions {
    zones: Zones
    areas: Areas
    terrain: Terrain
    camera: Camera
    overlay: SectionOverlay
    x: number
    z: number
}

const PROJECTS: Project[] = [
    {
        title: 'Project Alpha',
        description: 'A web application for interactive data visualization with real-time updates.',
        url: '#',
    },
    {
        title: 'Project Beta',
        description: 'Mobile-first design system with reusable components and accessibility built in.',
        url: '#',
    },
    {
        title: 'Project Gamma',
        description: 'Real-time collaboration tool enabling seamless team communication.',
        url: '#',
    },
    {
        title: 'Project Delta',
        description: 'AI-powered analytics dashboard for business intelligence insights.',
        url: '#',
    },
]

/** Utility: render text onto a CanvasTexture */
function createTextTexture(
    text: string,
    width: number,
    height: number,
    opts: { fontSize?: number; color?: string; bg?: string } = {},
): THREE.CanvasTexture {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!

    if (opts.bg) {
        ctx.fillStyle = opts.bg
        ctx.fillRect(0, 0, width, height)
    }

    ctx.fillStyle = opts.color ?? '#ffffff'
    ctx.font = `bold ${opts.fontSize ?? 48}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, width / 2, height / 2)

    const texture = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true
    return texture
}

export default class ProjectsSection {
    container: THREE.Object3D

    constructor(options: ProjectsSectionOptions) {
        this.container = new THREE.Object3D()

        this.createSignposts(options)
        this.createZone(options)
        this.createAreas(options)
    }

    private createSignposts(options: ProjectsSectionOptions): void {
        const metalTex = loadMatcapTexture('metal')
        const boardMat = createMatcapMaterial({
            matcapTexture: metalTex,
            color: new THREE.Color('#d0d0d8'),
            indirect: 0,
        })
        const pillarMat = createMatcapMaterial({
            matcapTexture: metalTex,
            color: new THREE.Color('#808080'),
            indirect: 0,
        })

        const spacing = 4.5
        const startOffset = -((PROJECTS.length - 1) * spacing) / 2

        for (let i = 0; i < PROJECTS.length; i++) {
            const project = PROJECTS[i]
            const px = options.x + startOffset + i * spacing
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
            const boardGeo = new THREE.PlaneGeometry(boardWidth, boardHeight)
            const nameTexture = createTextTexture(project.title, 512, 128, {
                fontSize: 56,
                color: '#ffffff',
                bg: '#1a0e08',
            })
            const boardFaceMat = new THREE.MeshBasicMaterial({
                map: nameTexture,
                side: THREE.DoubleSide,
            })
            const board = new THREE.Mesh(boardGeo, boardFaceMat)
            board.position.y = pillarHeight / 2 + boardHeight / 2 + 0.05

            const signGroup = new THREE.Group()
            signGroup.add(pillar, board)

            signGroup.position.set(px, terrainY + pillarHeight / 2, pz)
            this.container.add(signGroup)
        }
    }

    private createZone(options: ProjectsSectionOptions): void {
        const totalWidth = (PROJECTS.length - 1) * 4.5 + 6
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
        const spacing = 4.5
        const startOffset = -((PROJECTS.length - 1) * spacing) / 2

        for (let i = 0; i < PROJECTS.length; i++) {
            const project = PROJECTS[i]
            const ax = options.x + startOffset + i * spacing
            const az = options.z

            const area = options.areas.add({
                position: { x: ax, z: az },
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
                    <a href="${project.url}" target="_blank" rel="noopener">Visit &rarr;</a>
                </div>
            `
        }
        return html
    }
}
