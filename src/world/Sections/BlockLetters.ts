import * as THREE from 'three'
import { Font } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import fontData from 'three/examples/fonts/helvetiker_bold.typeface.json'
import type Objects from '../Objects'
import type Terrain from '../Terrain'
import { createMatcapMaterial, loadMatcapTexture } from '../Materials/Matcap'

export interface BlockLettersOptions {
    objects: Objects
    terrain: Terrain
    x: number
    z: number
}

const LETTER_COLOR = '#ffffff'

export default class BlockLetters {
    container: THREE.Object3D

    constructor(options: BlockLettersOptions) {
        this.container = new THREE.Object3D()
        this.createLetters(options)
    }

    private createLetters(options: BlockLettersOptions): void {
        const font = new Font(fontData as any)
        const metalTex = loadMatcapTexture('metal')

        const text = 'ALEX WANG'
        const letterSize = 0.8
        const letterDepth = 0.4
        const spacing = 1.1 // spacing between letter origins

        // Compute total width for centering
        const totalLetters = text.replace(/ /g, '').length
        const totalSpaces = (text.match(/ /g) || []).length
        const totalWidth = totalLetters * spacing + totalSpaces * spacing * 0.6

        let xOffset = -totalWidth / 2

        for (let i = 0; i < text.length; i++) {
            const char = text[i]

            if (char === ' ') {
                xOffset += spacing * 0.6
                continue
            }

            const geo = new TextGeometry(char, {
                font,
                size: letterSize,
                depth: letterDepth,
                curveSegments: 4,
                bevelEnabled: false,
            })

            // Center the geometry so physics body aligns with visual
            geo.computeBoundingBox()
            const bbox = geo.boundingBox!
            const cx = (bbox.max.x + bbox.min.x) / 2
            const cy = (bbox.max.y + bbox.min.y) / 2
            const cz = (bbox.max.z + bbox.min.z) / 2
            const halfHeight = (bbox.max.y - bbox.min.y) / 2
            const halfWidth = (bbox.max.x - bbox.min.x) / 2
            geo.translate(-cx, -cy, -cz)

            const mat = createMatcapMaterial({
                matcapTexture: metalTex,
                color: new THREE.Color(LETTER_COLOR),
                indirect: 0,
            })

            const mesh = new THREE.Mesh(geo, mat)

            const px = options.x + xOffset + halfWidth
            const pz = options.z - 8 // Behind the rover spawn
            const terrainY = options.terrain.getHeightAt(px, pz)
            const py = terrainY + halfHeight + 0.3 // Sit above ground

            options.objects.add({
                mesh,
                position: new THREE.Vector3(px, py, pz),
                mass: 1.5,
                restitution: 0.2,
                useConvexHull: true,
                shadow: { sizeX: 0.8, sizeZ: 0.5 },
                startAsleep: true,
            })

            xOffset += spacing
        }
    }
}
