import * as THREE from 'three'
import type Objects from '../Objects'
import type Zones from '../Zones'
import type Areas from '../Areas'
import type Terrain from '../Terrain'
import type Camera from '../../engine/Camera'
import type SectionOverlay from '../../ui/SectionOverlay'
import type Shadows from '../Shadows'
import { createMatcapMaterial, loadMatcapTexture } from '../Materials/Matcap'

interface Experience {
    company: string
    role: string
    years: string
    description: string
}

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

const EXPERIENCES: Experience[] = [
    {
        company: 'SpaceX',
        role: 'Software Engineering Intern',
        years: 'May 2025 – Aug 2025',
        description: 'Designed PLC-based controller architecture for Hardware-in-the-Loop test systems, reducing downtime by 87%.',
    },
    {
        company: 'General Motors',
        role: 'Software & Controls Intern',
        years: 'May 2024 – Apr 2025',
        description: 'Developed thermal control system software and automated SIL testing pipeline for EV propulsion.',
    },
    {
        company: 'aUToronto',
        role: 'State Estimation Lead',
        years: 'Sep 2023 – Jun 2025',
        description: 'Led autonomous vehicle team to back-to-back 1st place finishes at SAE AutoDrive Challenge.',
    },
    {
        company: 'TRAIL Lab',
        role: 'AI Researcher',
        years: 'May 2024 – Present',
        description: 'Developing Bayesian 3D lane detection and 3D hierarchical scene graphs for VLA models.',
    },
]

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

        const spacing = 5
        const startOffset = -((EXPERIENCES.length - 1) * spacing) / 2

        for (let i = 0; i < EXPERIENCES.length; i++) {
            const exp = EXPERIENCES[i]
            const px = options.x + startOffset + i * spacing
            const pz = options.z
            const terrainY = options.terrain.getHeightAt(px, pz)

            const pillarHeight = 1.8
            const pillar = new THREE.Mesh(
                new THREE.CylinderGeometry(0.05, 0.05, pillarHeight, 8),
                pillarMat,
            )

            const boardWidth = 3.0
            const boardHeight = 0.9
            const boardGeo = new THREE.PlaneGeometry(boardWidth, boardHeight)

            const labelCanvas = document.createElement('canvas')
            labelCanvas.width = 512
            labelCanvas.height = 128
            const ctx = labelCanvas.getContext('2d')!
            ctx.fillStyle = '#1a0e08'
            ctx.fillRect(0, 0, 512, 128)
            ctx.fillStyle = '#ffffff'
            ctx.font = 'bold 40px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'top'
            ctx.fillText(exp.company, 256, 15)
            ctx.font = '28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            ctx.fillStyle = '#fccf92'
            ctx.fillText(exp.years, 256, 70)

            const nameTexture = new THREE.CanvasTexture(labelCanvas)
            nameTexture.needsUpdate = true

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

            options.shadows.add(signGroup, { sizeX: boardWidth * 0.8, sizeZ: 0.4, shape: 'box' })
        }
    }

    private createZone(options: ExperienceSectionOptions): void {
        const totalWidth = (EXPERIENCES.length - 1) * 5 + 8
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
