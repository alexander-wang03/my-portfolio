import * as THREE from 'three'
import StarField from './Particles/StarField'

export default class Environment {
    container: THREE.Object3D
    sunLight: THREE.DirectionalLight
    ambientLight: THREE.AmbientLight
    starField: StarField

    constructor() {
        this.container = new THREE.Object3D()

        // Sun — primary directional light (harsh, thin atmosphere)
        this.sunLight = new THREE.DirectionalLight(0xfff5e6, 2.0)
        this.sunLight.position.set(50, 70, 30)
        this.container.add(this.sunLight)

        // Dim ambient (scattered light from thin Mars atmosphere)
        this.ambientLight = new THREE.AmbientLight(0x2a1a0e, 0.2)
        this.container.add(this.ambientLight)

        // Star field
        this.starField = new StarField({ count: 5000, radius: 120 })
        this.container.add(this.starField.container)
    }
}
