import * as THREE from 'three'
import vertexShader from '../../shaders/terrain/vertex.glsl'
import fragmentShader from '../../shaders/terrain/fragment.glsl'

export interface LunarSurfaceOptions {
    heightMap: THREE.DataTexture
    terrainSize: number
    heightScale: number
    sunDirection?: THREE.Vector3
}

export default class LunarSurface {
    material: THREE.ShaderMaterial

    constructor(options: LunarSurfaceOptions) {
        this.material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            transparent: true,
            depthWrite: true,
            uniforms: {
                uHeightMap: { value: options.heightMap },
                uHeightScale: { value: options.heightScale },
                uTerrainSize: { value: options.terrainSize },
                uSunDirection: {
                    value: options.sunDirection ?? new THREE.Vector3(0.5, 0.7, 0.3).normalize(),
                },
                // Wider contrast between dark crater floors and bright rims
                uBaseColor: { value: new THREE.Color(0.38, 0.37, 0.36) },
                uCraterColor: { value: new THREE.Color(0.12, 0.12, 0.13) },
                uHighlightColor: { value: new THREE.Color(0.62, 0.60, 0.58) },
            },
        })
    }
}
