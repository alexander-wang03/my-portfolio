import * as THREE from 'three'
import floorVertexShader from '../shaders/floor/vertex.glsl'
import floorFragmentShader from '../shaders/floor/fragment.glsl'

export default class Environment {
    container: THREE.Object3D
    floor: THREE.Mesh

    constructor() {
        this.container = new THREE.Object3D()

        // No lights — matcap materials handle all shading

        // Background gradient floor (folio-2019 style: fullscreen at far plane)
        this.floor = this.createFloor()
        this.container.add(this.floor)
    }

    private createFloor(): THREE.Mesh {
        // Warm orange gradient matching folio-2019 palette
        const topLeft = new THREE.Color('#f5883c')
        const topRight = new THREE.Color('#ff9043')
        const bottomRight = new THREE.Color('#fccf92')
        const bottomLeft = new THREE.Color('#f5aa58')

        const data = new Uint8Array([
            Math.round(bottomLeft.r * 255), Math.round(bottomLeft.g * 255), Math.round(bottomLeft.b * 255), 255,
            Math.round(bottomRight.r * 255), Math.round(bottomRight.g * 255), Math.round(bottomRight.b * 255), 255,
            Math.round(topLeft.r * 255), Math.round(topLeft.g * 255), Math.round(topLeft.b * 255), 255,
            Math.round(topRight.r * 255), Math.round(topRight.g * 255), Math.round(topRight.b * 255), 255,
        ])

        const backgroundTexture = new THREE.DataTexture(data, 2, 2, THREE.RGBAFormat)
        backgroundTexture.magFilter = THREE.LinearFilter
        backgroundTexture.needsUpdate = true

        const material = new THREE.ShaderMaterial({
            vertexShader: floorVertexShader,
            fragmentShader: floorFragmentShader,
            uniforms: {
                tBackground: { value: backgroundTexture },
            },
            depthWrite: false,
        })

        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2, 1, 1), material)
        mesh.frustumCulled = false
        mesh.matrixAutoUpdate = false
        mesh.updateMatrix()
        return mesh
    }
}
