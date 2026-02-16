import * as THREE from 'three'
import StarField from './Particles/StarField'

export default class Environment {
    container: THREE.Object3D
    sunLight: THREE.DirectionalLight
    ambientLight: THREE.AmbientLight
    starField: StarField
    earth: THREE.Mesh

    constructor() {
        this.container = new THREE.Object3D()

        // Sun — primary directional light (harsh, no atmosphere to soften)
        this.sunLight = new THREE.DirectionalLight(0xfff5e6, 2.0)
        this.sunLight.position.set(50, 70, 30)
        this.container.add(this.sunLight)

        // Very dim ambient (reflected earthshine)
        this.ambientLight = new THREE.AmbientLight(0x1a1a2e, 0.15)
        this.container.add(this.ambientLight)

        // Star field — closer radius so they're visible at terrain edges
        this.starField = new StarField({ count: 5000, radius: 120 })
        this.container.add(this.starField.container)

        // Earth in the sky — positioned to be visible from the isometric camera
        // Camera looks from roughly (+x, +y, +z) toward origin,
        // so Earth needs to be in the upper part of that view (high Y, behind terrain)
        this.earth = this.createEarth()
        this.container.add(this.earth)
    }

    private createEarth(): THREE.Mesh {
        const geometry = new THREE.SphereGeometry(4, 32, 32)

        const material = new THREE.MeshBasicMaterial({
            color: 0x4488cc,
        })

        const earth = new THREE.Mesh(geometry, material)
        // Place at the horizon line — high up and behind the camera's viewing direction
        // so it appears above the terrain edge
        earth.position.set(-30, 45, -50)

        return earth
    }
}
