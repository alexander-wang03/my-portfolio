import * as THREE from 'three'
import vertexShader from '../../shaders/matcap/vertex.glsl'
import fragmentShader from '../../shaders/matcap/fragment.glsl'
import { registerRevealShader } from '../Reveal'

/**
 * The matcaps in `static/models/matcaps`. All are soft and matte except
 * `metal` (high-contrast chrome with a specular hotspot) and `gold` (glossy
 * warm) — reach for those two only where something really is polished metal,
 * or everything ends up looking like the same shiny plastic.
 */
export type MatcapName =
    | 'beige' | 'black' | 'blue' | 'brown' | 'emeraldGreen' | 'gold' | 'gray'
    | 'green' | 'metal' | 'orange' | 'purple' | 'red' | 'white' | 'yellow'

export interface MatcapOptions {
    matcap: MatcapName
    /**
     * Optional tint, multiplied into the matcap. Leave unset when the matcap
     * already carries the colour — tinting a coloured matcap with the same
     * colour squares it and goes muddy.
     */
    color?: THREE.Color
    edgeFade?: number // 0 = no fade, > 0 = terrain half-size for edge fade
    indirect?: number // 0 = no indirect glow, 1 = full (default 1)
    /**
     * Whether this object rises out of the ground during the intro reveal.
     * Set false for anything that arrives another way — the rover drops in
     * from above, and burying it would hide the entire fall.
     */
    reveal?: boolean
}

const INDIRECT_DEFAULTS = {
    /** Peak mix toward the bounce colour — matches folio's ~0.25 at ground level. */
    strength: 0.25,
    angleStrength: 1.5,
    angleOffset: 0.6,
    anglePower: 1.0,
    color: new THREE.Color(0xd04500), // burnt orange
}

export function createMatcapMaterial(options: MatcapOptions): THREE.ShaderMaterial {
    const edgeFade = options.edgeFade ?? 0
    const indirect = options.indirect ?? 1

    const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        lights: false,
        transparent: edgeFade > 0,
        depthWrite: true,
        uniforms: {
            diffuse: { value: options.color ?? new THREE.Color(1, 1, 1) },
            opacity: { value: 1.0 },
            matcap: { value: loadMatcapTexture(options.matcap) },
            // 1 is the shader's "fully surfaced" state, so opting out just
            // pins it there rather than needing a branch in the shader
            uRevealProgress: { value: options.reveal === false ? 1 : 0 },
            uIndirectStrength: { value: INDIRECT_DEFAULTS.strength * indirect },
            uIndirectAngleStrength: { value: INDIRECT_DEFAULTS.angleStrength },
            uIndirectAngleOffset: { value: INDIRECT_DEFAULTS.angleOffset },
            uIndirectAnglePower: { value: INDIRECT_DEFAULTS.anglePower },
            uIndirectColor: { value: INDIRECT_DEFAULTS.color.clone() },
            uEdgeFade: { value: edgeFade },
        },
    })

    if (options.reveal !== false) {
        registerRevealShader(material)
    }

    return material
}

const textureLoader = new THREE.TextureLoader()
const textureCache = new Map<string, THREE.Texture>()

function loadMatcapTexture(name: MatcapName): THREE.Texture {
    if (textureCache.has(name)) return textureCache.get(name)!

    const texture = textureLoader.load(`/models/matcaps/${name}.png`)
    textureCache.set(name, texture)
    return texture
}
