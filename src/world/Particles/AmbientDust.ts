import * as THREE from 'three'
import type Time from '../../engine/Utils/Time'
import type Physics from '../Physics'

const PARTICLE_COUNT = 120
const SPREAD = 40       // radius around rover
const HEIGHT_MIN = 0.5
const HEIGHT_MAX = 12
const DRIFT_SPEED = 0.15

export default class AmbientDust {
    container: THREE.Object3D

    private positions: Float32Array
    private sizes: Float32Array
    private alphas: Float32Array
    private offsets: Float32Array // per-particle phase offsets for variety
    private geometry: THREE.BufferGeometry

    constructor(options: { time: Time; physics: Physics }) {
        this.container = new THREE.Object3D()

        this.positions = new Float32Array(PARTICLE_COUNT * 3)
        this.sizes = new Float32Array(PARTICLE_COUNT)
        this.alphas = new Float32Array(PARTICLE_COUNT)
        this.offsets = new Float32Array(PARTICLE_COUNT * 3)

        // Initialize particles in a sphere around origin
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const i3 = i * 3
            const angle = Math.random() * Math.PI * 2
            const dist = Math.sqrt(Math.random()) * SPREAD
            this.positions[i3] = Math.cos(angle) * dist
            this.positions[i3 + 1] = HEIGHT_MIN + Math.random() * (HEIGHT_MAX - HEIGHT_MIN)
            this.positions[i3 + 2] = Math.sin(angle) * dist

            this.sizes[i] = 0.8 + Math.random() * 1.6
            this.alphas[i] = 0.1 + Math.random() * 0.3

            // Random drift direction per particle
            this.offsets[i3] = (Math.random() - 0.5) * 2
            this.offsets[i3 + 1] = (Math.random() - 0.5) * 0.5
            this.offsets[i3 + 2] = (Math.random() - 0.5) * 2
        }

        this.geometry = new THREE.BufferGeometry()
        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
        this.geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1))
        this.geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1))

        const material = new THREE.ShaderMaterial({
            vertexShader: /* glsl */ `
                attribute float aSize;
                attribute float aAlpha;
                varying float vAlpha;
                void main() {
                    vAlpha = aAlpha;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = aSize * (150.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: /* glsl */ `
                varying float vAlpha;
                void main() {
                    float dist = length(gl_PointCoord - vec2(0.5));
                    if (dist > 0.5) discard;
                    float alpha = vAlpha * smoothstep(0.5, 0.1, dist);
                    // Warm dusty orange motes
                    gl_FragColor = vec4(0.85, 0.6, 0.4, alpha);
                }
            `,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        })

        const points = new THREE.Points(this.geometry, material)
        points.frustumCulled = false
        this.container.add(points)

        let elapsed = 0
        options.time.on('tick', () => {
            const dt = Math.min(options.time.delta / 1000, 1 / 30)
            elapsed += dt

            const cx = options.physics.chassisPosition.x
            const cz = options.physics.chassisPosition.z

            const posAttr = this.geometry.attributes.position as THREE.BufferAttribute

            for (let i = 0; i < PARTICLE_COUNT; i++) {
                const i3 = i * 3

                // Slow drift using per-particle offset + global wind
                const windX = Math.sin(elapsed * 0.3 + this.offsets[i3] * 5) * DRIFT_SPEED
                const windY = Math.sin(elapsed * 0.2 + this.offsets[i3 + 1] * 8) * DRIFT_SPEED * 0.3
                const windZ = Math.cos(elapsed * 0.25 + this.offsets[i3 + 2] * 5) * DRIFT_SPEED

                this.positions[i3] += windX * dt + this.offsets[i3] * dt * 0.05
                this.positions[i3 + 1] += windY * dt
                this.positions[i3 + 2] += windZ * dt + this.offsets[i3 + 2] * dt * 0.05

                // Wrap particles to stay near rover
                const dx = this.positions[i3] - cx
                const dz = this.positions[i3 + 2] - cz
                if (dx > SPREAD) this.positions[i3] -= SPREAD * 2
                if (dx < -SPREAD) this.positions[i3] += SPREAD * 2
                if (dz > SPREAD) this.positions[i3 + 2] -= SPREAD * 2
                if (dz < -SPREAD) this.positions[i3 + 2] += SPREAD * 2

                // Wrap vertically
                if (this.positions[i3 + 1] > HEIGHT_MAX) this.positions[i3 + 1] = HEIGHT_MIN
                if (this.positions[i3 + 1] < HEIGHT_MIN) this.positions[i3 + 1] = HEIGHT_MAX
            }

            posAttr.needsUpdate = true
        })
    }
}
