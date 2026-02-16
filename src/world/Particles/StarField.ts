import * as THREE from 'three'

export interface StarFieldOptions {
    count?: number
    radius?: number
}

export default class StarField {
    container: THREE.Object3D
    points: THREE.Points

    constructor(options: StarFieldOptions = {}) {
        const count = options.count ?? 3000
        const radius = options.radius ?? 150

        this.container = new THREE.Object3D()

        const positions = new Float32Array(count * 3)
        const sizes = new Float32Array(count)

        for (let i = 0; i < count; i++) {
            // Distribute on a sphere
            const theta = Math.random() * Math.PI * 2
            const phi = Math.acos(2 * Math.random() - 1)

            positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
            positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
            positions[i * 3 + 2] = radius * Math.cos(phi)

            // Vary star sizes
            sizes[i] = 0.5 + Math.random() * 1.5
        }

        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

        const material = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.4,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.9,
            depthWrite: false,
        })

        this.points = new THREE.Points(geometry, material)
        this.container.add(this.points)
    }
}
