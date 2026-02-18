import * as THREE from 'three'
import type Objects from '../Objects'
import type Zones from '../Zones'
import type Terrain from '../Terrain'
import type Camera from '../../engine/Camera'
import type SectionOverlay from '../../ui/SectionOverlay'
import { createMatcapMaterial, loadMatcapTexture } from '../Materials/Matcap'

interface Skill {
    name: string
    color: string
}

export interface SkillsSectionOptions {
    objects: Objects
    zones: Zones
    terrain: Terrain
    camera: Camera
    overlay: SectionOverlay
    x: number
    z: number
}

const SKILLS: Skill[] = [
    { name: 'TypeScript', color: '#3178c6' },
    { name: 'React', color: '#61dafb' },
    { name: 'Three.js', color: '#ffffff' },
    { name: 'Python', color: '#ffdd40' },
    { name: 'Node.js', color: '#68a063' },
    { name: 'AWS', color: '#ff9900' },
    { name: 'Docker', color: '#2496ed' },
    { name: 'Git', color: '#f05032' },
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

export default class SkillsSection {
    container: THREE.Object3D

    constructor(options: SkillsSectionOptions) {
        this.container = new THREE.Object3D()

        this.createSkillBlocks(options)
        this.createZone(options)
    }

    private createSkillBlocks(options: SkillsSectionOptions): void {
        const metalTex = loadMatcapTexture('metal')
        const blockSize = 0.5

        // Arrange in a 2-row grid: 4 columns × 2 rows
        const cols = 4
        const spacingX = 2.0
        const spacingZ = 2.5

        for (let i = 0; i < SKILLS.length; i++) {
            const skill = SKILLS[i]
            const col = i % cols
            const row = Math.floor(i / cols)

            const bx = options.x + (col - (cols - 1) / 2) * spacingX
            const bz = options.z + (row - 0.5) * spacingZ
            const terrainY = options.terrain.getHeightAt(bx, bz)

            // Create textured block
            const labelTex = createTextTexture(skill.name, 256, 256, {
                fontSize: 40,
                color: '#ffffff',
            })

            const colorMat = createMatcapMaterial({
                matcapTexture: metalTex,
                color: new THREE.Color(skill.color),
                indirect: 0,
            })

            const textMat = new THREE.MeshBasicMaterial({
                map: labelTex,
                transparent: true,
            })

            // Box with text on front face, matcap on others
            const geo = new THREE.BoxGeometry(blockSize, blockSize, blockSize)
            const mesh = new THREE.Mesh(geo, [
                colorMat,    // +X
                colorMat,    // -X
                colorMat,    // +Y
                colorMat,    // -Y
                textMat,     // +Z (front)
                textMat,     // -Z (back)
            ])

            options.objects.add({
                mesh,
                position: new THREE.Vector3(bx, terrainY + blockSize / 2 + 0.5, bz),
                mass: 1.0,
                restitution: 0.4,
                shadow: { sizeX: 0.6, sizeZ: 0.6 },
            })
        }
    }

    private createZone(options: SkillsSectionOptions): void {
        const zone = options.zones.add({
            position: { x: options.x, z: options.z },
            halfExtents: { x: 8, z: 6 },
            data: { cameraAngle: 'skills' },
        })

        zone.on('in', () => {
            options.camera.angle.set('skills')
            options.overlay.show(this.buildOverlayHTML())
        })

        zone.on('out', () => {
            options.camera.angle.set('default')
            options.overlay.hide()
        })
    }

    private buildOverlayHTML(): string {
        let html = '<h2>Skills</h2><div class="skills-grid">'
        for (const skill of SKILLS) {
            html += `
                <div class="skill-tag" style="border-color: ${skill.color}">
                    ${skill.name}
                </div>
            `
        }
        html += '</div>'
        return html
    }
}
