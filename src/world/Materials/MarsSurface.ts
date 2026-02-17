import * as THREE from 'three'
import vertexShader from '../../shaders/terrain/vertex.glsl'
import fragmentShader from '../../shaders/terrain/fragment.glsl'

export interface MarsSurfaceOptions {
    heightMap: THREE.DataTexture
    terrainSize: number
    heightScale: number
    sunDirection?: THREE.Vector3
}

export default class MarsSurface {
    material: THREE.ShaderMaterial

    constructor(options: MarsSurfaceOptions) {
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
                // Mars regolith palette: rusty red-orange with dark brown valleys and sandy ridges
                uBaseColor: { value: new THREE.Color(0.72, 0.38, 0.20) },
                uCraterColor: { value: new THREE.Color(0.25, 0.12, 0.08) },
                uHighlightColor: { value: new THREE.Color(0.85, 0.65, 0.45) },
            },
        })
    }
}
