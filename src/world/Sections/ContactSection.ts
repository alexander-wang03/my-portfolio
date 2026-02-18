import * as THREE from 'three'
import type Zones from '../Zones'
import type Areas from '../Areas'
import type Terrain from '../Terrain'
import type Camera from '../../engine/Camera'
import type SectionOverlay from '../../ui/SectionOverlay'
import type Shadows from '../Shadows'
import { createMatcapMaterial, loadMatcapTexture } from '../Materials/Matcap'

interface ContactLink {
    label: string
    icon: string
    url: string
    color: string
}

export interface ContactSectionOptions {
    zones: Zones
    areas: Areas
    terrain: Terrain
    shadows: Shadows
    camera: Camera
    overlay: SectionOverlay
    x: number
    z: number
}

const LINKS: ContactLink[] = [
    { label: 'GitHub', icon: 'GH', url: 'https://github.com', color: '#ffffff' },
    { label: 'LinkedIn', icon: 'LI', url: 'https://linkedin.com', color: '#0a66c2' },
    { label: 'Email', icon: '@', url: 'mailto:hello@example.com', color: '#ff9043' },
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

export default class ContactSection {
    container: THREE.Object3D

    constructor(options: ContactSectionOptions) {
        this.container = new THREE.Object3D()

        this.createSignposts(options)
        this.createZone(options)
        this.createAreas(options)
    }

    private createSignposts(options: ContactSectionOptions): void {
        const metalTex = loadMatcapTexture('metal')
        const pillarMat = createMatcapMaterial({
            matcapTexture: metalTex,
            color: new THREE.Color('#808080'),
            indirect: 0,
        })

        const spacing = 4
        const startOffset = -((LINKS.length - 1) * spacing) / 2

        for (let i = 0; i < LINKS.length; i++) {
            const link = LINKS[i]
            const px = options.x + startOffset + i * spacing
            const pz = options.z
            const terrainY = options.terrain.getHeightAt(px, pz)

            const pillarHeight = 1.6
            const pillar = new THREE.Mesh(
                new THREE.CylinderGeometry(0.05, 0.05, pillarHeight, 8),
                pillarMat,
            )

            // Icon board (flat plane, double-sided)
            const iconTex = createTextTexture(link.icon, 256, 256, {
                fontSize: 100,
                color: link.color,
                bg: '#1a0e08',
            })
            const iconBoard = new THREE.Mesh(
                new THREE.PlaneGeometry(1.2, 1.2),
                new THREE.MeshBasicMaterial({ map: iconTex, side: THREE.DoubleSide }),
            )
            iconBoard.position.y = pillarHeight / 2 + 0.65

            // Label board below icon (flat plane, double-sided)
            const labelTex = createTextTexture(link.label, 256, 64, {
                fontSize: 36,
                color: '#ffffff',
                bg: '#1a0e08',
            })
            const labelBoard = new THREE.Mesh(
                new THREE.PlaneGeometry(1.8, 0.4),
                new THREE.MeshBasicMaterial({ map: labelTex, side: THREE.DoubleSide }),
            )
            labelBoard.position.y = pillarHeight / 2 + 0.05

            const signGroup = new THREE.Group()
            signGroup.add(pillar, iconBoard, labelBoard)

            signGroup.position.set(px, terrainY + pillarHeight / 2, pz)
            this.container.add(signGroup)

            options.shadows.add(signGroup, { sizeX: 1.5, sizeZ: 0.4, shape: 'box' })
        }
    }

    private createZone(options: ContactSectionOptions): void {
        const totalWidth = (LINKS.length - 1) * 4 + 6
        const zone = options.zones.add({
            position: { x: options.x, z: options.z },
            halfExtents: { x: totalWidth / 2 + 3, z: 7 },
            data: { cameraAngle: 'contact' },
        })

        zone.on('in', () => {
            options.camera.angle.set('contact')
            options.overlay.show(this.buildOverlayHTML())
        })

        zone.on('out', () => {
            options.camera.angle.set('default')
            options.overlay.hide()
        })
    }

    private createAreas(options: ContactSectionOptions): void {
        const spacing = 4
        const startOffset = -((LINKS.length - 1) * spacing) / 2

        for (let i = 0; i < LINKS.length; i++) {
            const link = LINKS[i]
            const ax = options.x + startOffset + i * spacing
            const az = options.z

            const area = options.areas.add({
                position: { x: ax, z: az },
                halfExtents: { x: 1.5, z: 1.5 },
                testCar: true,
                active: true,
            })

            area.on('interact', () => {
                if (link.url.startsWith('mailto:')) {
                    window.location.href = link.url
                } else {
                    window.open(link.url, '_blank')
                }
            })
        }
    }

    private buildOverlayHTML(): string {
        let html = '<h2>Contact</h2>'
        for (const link of LINKS) {
            html += `
                <div class="project-card contact-card">
                    <h3>${link.label}</h3>
                    <a href="${link.url}" ${link.url.startsWith('mailto:') ? '' : 'target="_blank" rel="noopener"'}>${link.label === 'Email' ? 'Send Email' : 'Visit'} &rarr;</a>
                </div>
            `
        }
        return html
    }
}
