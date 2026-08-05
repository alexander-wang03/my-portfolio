import * as THREE from 'three'
import type Zones from '../Zones'
import type Areas from '../Areas'
import type Terrain from '../Terrain'
import type Camera from '../../engine/Camera'
import type SectionOverlay from '../../ui/SectionOverlay'
import type Shadows from '../Shadows'
import { createMatcapMaterial } from '../Materials/Matcap'
import { BOARD_BACKGROUND, createBoardMaterial, createTextTexture } from '../Materials/SignBoard'
import { CONTACT_LINKS } from '../../content/portfolio'

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

const SPACING = 4

export default class ContactSection {
    container: THREE.Object3D

    constructor(options: ContactSectionOptions) {
        this.container = new THREE.Object3D()

        this.createSignposts(options)
        this.createZone(options)
        this.createAreas(options)
    }

    /** X position of the sign for link `index`, laid out around the centre. */
    private signX(options: ContactSectionOptions, index: number): number {
        const startOffset = -((CONTACT_LINKS.length - 1) * SPACING) / 2
        return options.x + startOffset + index * SPACING
    }

    private createSignposts(options: ContactSectionOptions): void {
        const pillarMat = createMatcapMaterial({ matcap: 'gray' })

        for (let i = 0; i < CONTACT_LINKS.length; i++) {
            const link = CONTACT_LINKS[i]
            const px = this.signX(options, i)
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
                bg: BOARD_BACKGROUND,
            })
            const iconBoard = new THREE.Mesh(
                new THREE.PlaneGeometry(1.2, 1.2),
                createBoardMaterial(iconTex),
            )
            iconBoard.position.y = pillarHeight / 2 + 0.65

            // Label board below icon (flat plane, double-sided)
            const labelTex = createTextTexture(link.label, 256, 64, {
                fontSize: 36,
                color: '#ffffff',
                bg: BOARD_BACKGROUND,
            })
            const labelBoard = new THREE.Mesh(
                new THREE.PlaneGeometry(1.8, 0.4),
                createBoardMaterial(labelTex),
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
        const totalWidth = (CONTACT_LINKS.length - 1) * SPACING + 6
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
        for (let i = 0; i < CONTACT_LINKS.length; i++) {
            const link = CONTACT_LINKS[i]

            const area = options.areas.add({
                position: { x: this.signX(options, i), z: options.z },
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
        for (const link of CONTACT_LINKS) {
            const isEmail = link.url.startsWith('mailto:')
            html += `
                <div class="project-card contact-card">
                    <h3>${link.label}</h3>
                    <a href="${link.url}" ${isEmail ? '' : 'target="_blank" rel="noopener"'}>${isEmail ? 'Send Email' : 'Visit'} &rarr;</a>
                </div>
            `
        }
        return html
    }
}
