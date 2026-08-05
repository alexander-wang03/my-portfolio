import * as THREE from 'three'
import { Font } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import fontData from 'three/examples/fonts/helvetiker_bold.typeface.json'
import type Objects from '../Objects'
import type Terrain from '../Terrain'
import { createMatcapMaterial } from '../Materials/Matcap'
import { BLOCK_LETTERS_NAME } from '../../content/portfolio'

export interface BlockLettersOptions {
    objects: Objects
    terrain: Terrain
    x: number
    z: number
}

// A matcap *is* the shading, so its luminance range is the object's contrast.
// `metal` spans 0.20-0.98 against 0.57-0.92 for `white`, which is why the
// extrusion reads here and went flat with any of the matte matcaps.
const LETTER_MATCAP = 'metal' as const
const LETTER_TINT = '#ffffff'

/** Uniform gap between adjacent letters, and the extra gap a space adds. */
const TRACKING = 0.55
const WORD_GAP = 1.35

interface Glyph {
    geo: TextGeometry
    width: number
    halfHeight: number
}

export default class BlockLetters {
    container: THREE.Object3D

    constructor(options: BlockLettersOptions) {
        this.container = new THREE.Object3D()
        this.createLetters(options)
    }

    private createLetters(options: BlockLettersOptions): void {
        const font = new Font(fontData as any)

        const text = BLOCK_LETTERS_NAME
        const letterSize = 1.6
        const letterDepth = 0.8

        // Measure every glyph before laying any out, so each letter can advance
        // by its own width. Advancing by a fixed step instead leaves a gap of
        // (step - glyphWidth), which varies with the glyph: a narrow N opens a
        // hole before the next letter while a wide W nearly touches it.
        const glyphs: (Glyph | null)[] = [...text].map((char) => {
            if (char === ' ') return null

            const geo = new TextGeometry(char, {
                font,
                size: letterSize,
                depth: letterDepth,
                curveSegments: 4,
                bevelEnabled: false,
            })

            geo.computeBoundingBox()
            const bbox = geo.boundingBox!

            // Center the geometry so the physics body aligns with the visual
            geo.translate(
                -(bbox.max.x + bbox.min.x) / 2,
                -(bbox.max.y + bbox.min.y) / 2,
                -(bbox.max.z + bbox.min.z) / 2,
            )

            return {
                geo,
                width: bbox.max.x - bbox.min.x,
                halfHeight: (bbox.max.y - bbox.min.y) / 2,
            }
        })

        const advance = (glyph: Glyph | null) =>
            glyph ? glyph.width + TRACKING : WORD_GAP

        // The tracking trailing the final letter is not part of the visible width
        const totalWidth = glyphs.reduce((sum, glyph) => sum + advance(glyph), 0) - TRACKING

        let xOffset = -totalWidth / 2

        for (const glyph of glyphs) {
            if (glyph) {
                const px = options.x + xOffset + glyph.width / 2
                const pz = options.z - 8 // Behind the rover spawn
                const terrainY = options.terrain.getHeightAt(px, pz)
                const py = terrainY + glyph.halfHeight + 0.3 // Sit above ground

                const mesh = new THREE.Mesh(
                    glyph.geo,
                    createMatcapMaterial({
                        matcap: LETTER_MATCAP,
                        color: new THREE.Color(LETTER_TINT),
                        indirect: 0,
                    }),
                )

                options.objects.add({
                    mesh,
                    position: new THREE.Vector3(px, py, pz),
                    mass: 3.0,
                    restitution: 0.2,
                    useConvexHull: true,
                    flatBase: true,
                    // Track the glyph rather than a fixed size, so neighbouring
                    // shadows do not bleed into each other at this spacing
                    shadow: { sizeX: glyph.width * 1.2, sizeZ: 1.2 },
                })
            }

            xOffset += advance(glyph)
        }
    }
}
