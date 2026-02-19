import * as THREE from 'three'
import type Objects from '../Objects'
import type Zones from '../Zones'
import type Terrain from '../Terrain'
import type Camera from '../../engine/Camera'
import type SectionOverlay from '../../ui/SectionOverlay'
import type Shadows from '../Shadows'
import { createMatcapMaterial, loadMatcapTexture } from '../Materials/Matcap'
import BlockLetters from './BlockLetters'

export interface IntroSectionOptions {
    objects: Objects
    zones: Zones
    terrain: Terrain
    shadows: Shadows
    camera: Camera
    overlay: SectionOverlay
    x: number
    z: number
}

export default class IntroSection {
    container: THREE.Object3D

    constructor(options: IntroSectionOptions) {
        this.container = new THREE.Object3D()

        const blockLetters = new BlockLetters(options)
        this.container.add(blockLetters.container)

        this.createPushableBlocks(options)
        this.createAboutSign(options)
        this.createZone(options)
    }

    private createPushableBlocks(options: IntroSectionOptions): void {
        const metalTex = loadMatcapTexture('metal')
        const blockSize = 0.4
        const blockGeo = new THREE.BoxGeometry(blockSize, blockSize, blockSize)

        const colors = ['#ffffff', '#ffdd40', '#ff3030', '#d0d0d8', '#555560', '#ff9043']

        for (let i = 0; i < colors.length; i++) {
            const mat = createMatcapMaterial({
                matcapTexture: metalTex,
                color: new THREE.Color(colors[i]),
                indirect: 0,
            })

            const mesh = new THREE.Mesh(blockGeo, mat)

            // Scatter around the letters in a semi-circle
            const angle = ((i / colors.length) * Math.PI) - Math.PI / 2
            const radius = 2.5 + Math.random() * 1.5
            const bx = options.x + Math.cos(angle) * radius
            const bz = options.z - 8 + Math.sin(angle) * radius
            const by = options.terrain.getHeightAt(bx, bz) + blockSize / 2 + 0.5

            options.objects.add({
                mesh,
                position: new THREE.Vector3(bx, by, bz),
                mass: 1.5,
                restitution: 0.3,
                shadow: { sizeX: 0.5, sizeZ: 0.5 },
            })
        }
    }

    private createAboutSign(options: IntroSectionOptions): void {
        const metalTex = loadMatcapTexture('metal')
        const pillarMat = createMatcapMaterial({
            matcapTexture: metalTex,
            color: new THREE.Color('#808080'),
            indirect: 0,
        })

        const px = options.x + 6
        const pz = options.z + 4
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

    private createZone(options: IntroSectionOptions): void {
        const zone = options.zones.add({
            position: { x: options.x, z: options.z - 2 },
            halfExtents: { x: 10, z: 10 },
            data: { cameraAngle: 'intro' },
        })

        zone.on('in', () => {
            options.camera.angle.set('intro')
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
