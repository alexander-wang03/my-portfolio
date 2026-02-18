import * as THREE from 'three'
import vertexShader from '../../shaders/matcap/vertex.glsl'
import fragmentShader from '../../shaders/matcap/fragment.glsl'

export interface MatcapOptions {
    matcapTexture: THREE.Texture
    color?: THREE.Color
    edgeFade?: number // 0 = no fade, > 0 = terrain half-size for edge fade
    indirect?: number // 0 = no indirect glow, 1 = full (default 1)
}

const INDIRECT_DEFAULTS = {
    distanceAmplitude: 1.75,
    distanceStrength: 0.5,
    distancePower: 2.0,
    angleStrength: 1.5,
    angleOffset: 0.6,
    anglePower: 1.0,
    color: new THREE.Color(0xd04500), // burnt orange
}

export function createMatcapMaterial(options: MatcapOptions): THREE.ShaderMaterial {
    const edgeFade = options.edgeFade ?? 0
    const indirect = options.indirect ?? 1

    return new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        lights: false,
        transparent: edgeFade > 0,
        depthWrite: true,
        uniforms: {
            diffuse: { value: options.color ?? new THREE.Color(1, 1, 1) },
            opacity: { value: 1.0 },
            matcap: { value: options.matcapTexture },
            uIndirectDistanceAmplitude: { value: INDIRECT_DEFAULTS.distanceAmplitude },
            uIndirectDistanceStrength: { value: INDIRECT_DEFAULTS.distanceStrength * indirect },
            uIndirectDistancePower: { value: INDIRECT_DEFAULTS.distancePower },
            uIndirectAngleStrength: { value: INDIRECT_DEFAULTS.angleStrength * indirect },
            uIndirectAngleOffset: { value: INDIRECT_DEFAULTS.angleOffset },
            uIndirectAnglePower: { value: INDIRECT_DEFAULTS.anglePower },
            uIndirectColor: { value: INDIRECT_DEFAULTS.color.clone() },
            uEdgeFade: { value: edgeFade },
        },
    })
}

const textureLoader = new THREE.TextureLoader()
const textureCache = new Map<string, THREE.Texture>()

export function loadMatcapTexture(name: string): THREE.Texture {
    if (textureCache.has(name)) return textureCache.get(name)!

    const texture = textureLoader.load(`/models/matcaps/${name}.png`)
    textureCache.set(name, texture)
    return texture
}
