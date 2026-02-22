import * as THREE from 'three'
import type Zones from '../Zones'
import type Terrain from '../Terrain'
import type Camera from '../../engine/Camera'
import type SectionOverlay from '../../ui/SectionOverlay'
import type Shadows from '../Shadows'
import { createMatcapMaterial, loadMatcapTexture } from '../Materials/Matcap'

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
        const metalTex = loadMatcapTexture('metal')
        const pillarMat = createMatcapMaterial({
            matcapTexture: metalTex,
            color: new THREE.Color('#808080'),
            indirect: 0,
        })

        const px = options.x
        const pz = options.z
        const terrainY = options.terrain.getHeightAt(px, pz)

        // Pillar
        const pillarHeight = 1.6
        const pillar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.05, 0.05, pillarHeight, 8),
            pillarMat,
        )

        // Billboard with tagline
        const boardWidth = 4.0
        const boardHeight = 1.4
        const boardGeo = new THREE.PlaneGeometry(boardWidth, boardHeight)

        const canvas = document.createElement('canvas')
        canvas.width = 512
        canvas.height = 192
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = '#1a0e08'
        ctx.fillRect(0, 0, 512, 192)

        // Title
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillText('About Me', 256, 15)

        // Tagline (wrapped)
        ctx.fillStyle = '#fccf92'
        ctx.font = '18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        const tagline = "Engineer, pilot, and creator. I love building robots and getting them in people's hands."
        const words = tagline.split(' ')
        let line = ''
        let y = 65
        for (const word of words) {
            const test = line + word + ' '
            if (ctx.measureText(test).width > 440 && line.length > 0) {
                ctx.fillText(line.trim(), 256, y)
                line = word + ' '
                y += 24
            } else {
                line = test
            }
        }
        if (line.trim()) ctx.fillText(line.trim(), 256, y)

        // Subtitle
        ctx.fillStyle = '#d4a574'
        ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        ctx.fillText('UofT Engineering Science — Robotics', 256, 150)

        const texture = new THREE.CanvasTexture(canvas)
        texture.needsUpdate = true

        const boardMat = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.DoubleSide,
        })
        const board = new THREE.Mesh(boardGeo, boardMat)
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
            data: { cameraAngle: 'about' },
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
        return `
            <h2>About Me</h2>
            <div class="project-card">
                <p>Hi, I'm Alex. I'm an engineer, pilot, and creator with over 4 years of experience. I love building robots and getting them in people's hands.</p>
            </div>
            <div class="project-card">
                <h3>Currently</h3>
                <p>AI Researcher at <strong>TRAIL Lab</strong>, University of Toronto</p>
            </div>
            <div class="project-card">
                <h3>Education</h3>
                <p>University of Toronto</p>
                <p>Engineering Science — Robotics (AI Minor)</p>
            </div>
        `
    }
}
