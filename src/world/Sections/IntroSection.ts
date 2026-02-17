import * as THREE from 'three'
import type Objects from '../Objects'
import type Terrain from '../Terrain'
import { createMatcapMaterial, loadMatcapTexture } from '../Materials/Matcap'

export interface IntroSectionOptions {
    objects: Objects
    terrain: Terrain
    x: number
    z: number
}

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
    ctx.font = `bold ${opts.fontSize ?? 64}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, width / 2, height / 2)

    const texture = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true
    return texture
}

export default class IntroSection {
    container: THREE.Object3D

    constructor(options: IntroSectionOptions) {
        this.container = new THREE.Object3D()

        this.createSign(options)
        this.createPushableBlocks(options)
    }

    private createSign(options: IntroSectionOptions): void {
        const metalTex = loadMatcapTexture('metal')

        const signX = options.x
        const signZ = options.z + 8
        const terrainY = options.terrain.getHeightAt(signX, signZ)

        // Board
        const boardWidth = 4
        const boardHeight = 1.2
        const boardDepth = 0.12
        const boardGeo = new THREE.BoxGeometry(boardWidth, boardHeight, boardDepth)

        const nameTexture = createTextTexture('ALEX WANG', 1024, 256, {
            fontSize: 140,
            color: '#ffffff',
            bg: '#1a0e08',
        })

        const boardMat = new THREE.MeshBasicMaterial({
            map: nameTexture,
        })

        const boardMesh = new THREE.Mesh(boardGeo, boardMat)

        // Pillars
        const pillarHeight = 2.0
        const pillarMat = createMatcapMaterial({
            matcapTexture: metalTex,
            color: new THREE.Color('#d0d0d8'),
            indirect: 0,
        })

        const pillarGeo = new THREE.BoxGeometry(0.12, pillarHeight, 0.12)
        const leftPillar = new THREE.Mesh(pillarGeo, pillarMat)
        leftPillar.position.set(-boardWidth / 2 + 0.15, -boardHeight / 2 - pillarHeight / 2 + 0.05, 0)
        const rightPillar = new THREE.Mesh(pillarGeo, pillarMat)
        rightPillar.position.set(boardWidth / 2 - 0.15, -boardHeight / 2 - pillarHeight / 2 + 0.05, 0)

        // Group them so the whole sign is one mesh for physics
        const signGroup = new THREE.Group()
        signGroup.add(boardMesh, leftPillar, rightPillar)

        const signY = terrainY + pillarHeight + boardHeight / 2

        signGroup.position.set(signX, signY, signZ)
        this.container.add(signGroup)
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

            // Scatter around the sign in a semi-circle
            const angle = ((i / colors.length) * Math.PI) - Math.PI / 2
            const radius = 2.5 + Math.random() * 1.5
            const bx = options.x + Math.cos(angle) * radius
            const bz = options.z + 8 + Math.sin(angle) * radius
            const by = options.terrain.getHeightAt(bx, bz) + blockSize / 2 + 0.5

            options.objects.add({
                mesh,
                position: new THREE.Vector3(bx, by, bz),
                mass: 1.5,
                restitution: 0.3,
            })
        }
    }
}
