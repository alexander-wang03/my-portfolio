import * as THREE from 'three'
import vertexShader from '../../shaders/dust/vertex.glsl'
import fragmentShader from '../../shaders/dust/fragment.glsl'
import type Time from '../../engine/Utils/Time'
import type Physics from '../Physics'

const MAX_PARTICLES = 200
const PARTICLE_LIFETIME = 2.5 // seconds
const EMIT_RATE = 3 // particles per wheel per frame (when moving)

export default class DustParticles {
    time: Time
    physics: Physics
    container: THREE.Object3D

    private geometry: THREE.BufferGeometry
    private positions: Float32Array
    private ages: Float32Array
    private maxAges: Float32Array
    private sizes: Float32Array
    private velocities: Float32Array // 3 components per particle
    private aliveCount = 0
    private nextSlot = 0

    constructor(options: { time: Time; physics: Physics }) {
        this.time = options.time
        this.physics = options.physics
        this.container = new THREE.Object3D()

        this.positions = new Float32Array(MAX_PARTICLES * 3)
        this.ages = new Float32Array(MAX_PARTICLES)
        this.maxAges = new Float32Array(MAX_PARTICLES)
        this.sizes = new Float32Array(MAX_PARTICLES)
        this.velocities = new Float32Array(MAX_PARTICLES * 3)

        // Initialize all particles as dead
        this.ages.fill(999)
        this.maxAges.fill(1)

        this.geometry = new THREE.BufferGeometry()
        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
        this.geometry.setAttribute('aAge', new THREE.BufferAttribute(this.ages, 1))
        this.geometry.setAttribute('aMaxAge', new THREE.BufferAttribute(this.maxAges, 1))
        this.geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1))

        const material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            transparent: true,
            depthWrite: false,
            blending: THREE.NormalBlending,
        })

        const points = new THREE.Points(this.geometry, material)
        points.frustumCulled = false
        this.container.add(points)

        this.setTick()
    }

    private emit(worldPos: THREE.Vector3): void {
        const i = this.nextSlot
        this.nextSlot = (this.nextSlot + 1) % MAX_PARTICLES

        const i3 = i * 3

        // Position: at wheel contact + small random offset
        this.positions[i3] = worldPos.x + (Math.random() - 0.5) * 0.3
        this.positions[i3 + 1] = worldPos.y
        this.positions[i3 + 2] = worldPos.z + (Math.random() - 0.5) * 0.3

        // Velocity: mostly upward (low gravity moon), slight random spread
        this.velocities[i3] = (Math.random() - 0.5) * 0.4
        this.velocities[i3 + 1] = 0.15 + Math.random() * 0.25 // slow rise
        this.velocities[i3 + 2] = (Math.random() - 0.5) * 0.4

        this.ages[i] = 0
        this.maxAges[i] = PARTICLE_LIFETIME * (0.7 + Math.random() * 0.6)
        this.sizes[i] = 3 + Math.random() * 4

        if (this.aliveCount < MAX_PARTICLES) this.aliveCount++
    }

    private setTick(): void {
        this.time.on('tick', () => {
            const dt = Math.min(this.time.delta / 1000, 1 / 30)
            const speed = Math.abs(this.physics.forwardSpeed)

            // Emit dust from grounded wheels when moving
            if (speed > 0.5) {
                const emitCount = Math.min(EMIT_RATE, Math.floor(speed / 2))
                for (let w = 0; w < 4; w++) {
                    if (!this.physics.wheelGrounded[w]) continue
                    for (let e = 0; e < emitCount; e++) {
                        this.emit(this.physics.wheelWorldPositions[w])
                    }
                }
            }

            // Update all particles
            for (let i = 0; i < MAX_PARTICLES; i++) {
                if (this.ages[i] >= this.maxAges[i]) continue

                this.ages[i] += dt
                const i3 = i * 3

                // Integrate velocity (very low gravity on dust particles)
                this.velocities[i3 + 1] -= 0.02 * dt // tiny downward pull
                this.positions[i3] += this.velocities[i3] * dt
                this.positions[i3 + 1] += this.velocities[i3 + 1] * dt
                this.positions[i3 + 2] += this.velocities[i3 + 2] * dt

                // Damping (air resistance in vacuum is zero, but looks better with slight slowdown)
                this.velocities[i3] *= 0.995
                this.velocities[i3 + 2] *= 0.995
            }

            // Update GPU buffers
            const posAttr = this.geometry.attributes.position as THREE.BufferAttribute
            const ageAttr = this.geometry.attributes.aAge as THREE.BufferAttribute
            posAttr.needsUpdate = true
            ageAttr.needsUpdate = true
        })
    }
}
