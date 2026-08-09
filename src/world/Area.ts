import * as THREE from 'three'
import gsap from 'gsap'
import EventEmitter from '../engine/Utils/EventEmitter'
import type Terrain from './Terrain'

export interface AreaOptions {
    terrain: Terrain
    position: { x: number; z: number }
    halfExtents: { x: number; z: number }
    testCar?: boolean
    active?: boolean
}

const BORDER_THICKNESS = 0.25
const FENCE_HEIGHT = 0.9
const BORDER_COLOR = new THREE.Color('#ffe9d2')
// Near-white: an orange fence on orange terrain had almost no contrast
const FENCE_COLOR = new THREE.Color('#fff2e2')

/**
 * A plane draped over the terrain, so a decal drawn on it follows the ground
 * instead of slicing through a rise.
 */
function createDrapedPlane(
    terrain: Terrain,
    center: { x: number; z: number },
    halfExtents: { x: number; z: number },
): THREE.PlaneGeometry {
    const geometry = new THREE.PlaneGeometry(halfExtents.x * 2, halfExtents.z * 2, 12, 12)
    geometry.rotateX(-Math.PI / 2)

    const position = geometry.attributes.position
    for (let i = 0; i < position.count; i++) {
        const y = terrain.getSurfaceHeightAt(center.x + position.getX(i), center.z + position.getZ(i))
        position.setY(i, y + 0.02)
    }
    position.needsUpdate = true
    geometry.computeBoundingSphere()

    return geometry
}

/**
 * A wall standing on the area's perimeter. Its base is sampled against the
 * terrain per column so it sits flush on sloping ground.
 */
function createDrapedFence(
    terrain: Terrain,
    center: { x: number; z: number },
    halfExtents: { x: number; z: number },
    segmentsPerEdge = 8,
): THREE.BufferGeometry {
    const corners = [
        [-halfExtents.x, -halfExtents.z],
        [halfExtents.x, -halfExtents.z],
        [halfExtents.x, halfExtents.z],
        [-halfExtents.x, halfExtents.z],
    ]

    // Walk the perimeter, subdividing each edge
    const path: [number, number][] = []
    for (let c = 0; c < 4; c++) {
        const [x0, z0] = corners[c]
        const [x1, z1] = corners[(c + 1) % 4]
        for (let s = 0; s < segmentsPerEdge; s++) {
            const t = s / segmentsPerEdge
            path.push([x0 + (x1 - x0) * t, z0 + (z1 - z0) * t])
        }
    }

    const positions: number[] = []
    const uvs: number[] = []
    const indices: number[] = []

    for (let i = 0; i < path.length; i++) {
        const [x, z] = path[i]
        const groundY = terrain.getSurfaceHeightAt(center.x + x, center.z + z)
        const u = i / path.length

        positions.push(x, groundY, z)
        positions.push(x, groundY + FENCE_HEIGHT, z)
        uvs.push(u, 0, u, 1)
    }

    for (let i = 0; i < path.length; i++) {
        const a = i * 2
        const b = ((i + 1) % path.length) * 2
        indices.push(a, b, a + 1, b, b + 1, a + 1)
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geometry.setIndex(indices)
    geometry.computeBoundingSphere()

    return geometry
}

export default class Area extends EventEmitter {
    position: { x: number; z: number }
    halfExtents: { x: number; z: number }
    testCar: boolean
    active: boolean
    isIn: boolean
    container: THREE.Object3D
    mouseMesh: THREE.Mesh

    private borderMaterial: THREE.ShaderMaterial
    private fenceMaterial: THREE.ShaderMaterial
    private fence: THREE.Mesh

    constructor(options: AreaOptions) {
        super()
        this.position = options.position
        this.halfExtents = options.halfExtents
        this.testCar = options.testCar ?? true
        this.active = options.active ?? true
        this.isIn = false

        this.container = new THREE.Object3D()
        this.container.position.set(this.position.x, 0, this.position.z)

        // Invisible mesh for raycasting (horizontal plane)
        this.mouseMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(this.halfExtents.x * 2, this.halfExtents.z * 2),
            new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }),
        )
        this.mouseMesh.rotation.x = -Math.PI / 2
        // Sit on the ground, not at y=0. The container is at y=0 while the
        // terrain here is 2-3 units up, and since the raycast only tests these
        // meshes the terrain never blocks it — so the ray sailed past the sign
        // and struck this plane several units further downrange. The clickable
        // patch ended up nowhere near the sign it belongs to.
        this.mouseMesh.position.y =
            options.terrain.getSurfaceHeightAt(this.position.x, this.position.z) + 0.1
        this.container.add(this.mouseMesh)

        this.borderMaterial = this.createBorderMaterial()
        this.fenceMaterial = this.createFenceMaterial()

        const border = new THREE.Mesh(
            createDrapedPlane(options.terrain, this.position, this.halfExtents),
            this.borderMaterial,
        )
        this.container.add(border)

        this.fence = new THREE.Mesh(
            createDrapedFence(options.terrain, this.position, this.halfExtents),
            this.fenceMaterial,
        )
        // Parked below the ground, where the terrain hides it, until entered
        this.fence.position.y = -FENCE_HEIGHT
        this.container.add(this.fence)
    }

    private createBorderMaterial(): THREE.ShaderMaterial {
        return new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            uniforms: {
                uHalfExtents: { value: new THREE.Vector2(this.halfExtents.x, this.halfExtents.z) },
                uThickness: { value: BORDER_THICKNESS },
                uColor: { value: BORDER_COLOR.clone() },
                uAlpha: { value: 0 },
            },
            vertexShader: /* glsl */ `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: /* glsl */ `
                uniform vec2 uHalfExtents;
                uniform float uThickness;
                uniform vec3 uColor;
                uniform float uAlpha;
                varying vec2 vUv;

                void main() {
                    if (uAlpha < 0.001) discard;

                    // Signed distance to the inner rectangle: negative inside,
                    // rising to uThickness at the outer edge
                    vec2 p = (vUv - 0.5) * uHalfExtents * 2.0;
                    vec2 q = abs(p) - (uHalfExtents - uThickness);
                    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);

                    float band = smoothstep(0.0, uThickness * 0.35, d)
                               * (1.0 - smoothstep(uThickness * 0.65, uThickness, d));
                    if (band < 0.01) discard;

                    gl_FragColor = vec4(uColor, band * uAlpha);
                }
            `,
        })
    }

    private createFenceMaterial(): THREE.ShaderMaterial {
        return new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            uniforms: {
                uColor: { value: FENCE_COLOR.clone() },
                uAlpha: { value: 0 },
            },
            vertexShader: /* glsl */ `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: /* glsl */ `
                uniform vec3 uColor;
                uniform float uAlpha;
                varying vec2 vUv;

                void main() {
                    if (uAlpha < 0.001) discard;

                    // Solid at the base, fading out toward the top
                    float fade = pow(1.0 - vUv.y, 1.6);

                    // Vertical ticks around the perimeter, so movement reads
                    float ticks = 0.75 + 0.25 * step(0.35, fract(vUv.x * 48.0));

                    gl_FragColor = vec4(uColor, fade * ticks * uAlpha);
                }
            `,
        })
    }

    in(): void {
        if (this.isIn) return
        this.isIn = true
        if (!this.active) return

        gsap.killTweensOf(this.fence.position)
        gsap.to(this.borderMaterial.uniforms.uAlpha, { value: 0.65, duration: 0.3 })
        gsap.to(this.fenceMaterial.uniforms.uAlpha, { value: 0.5, duration: 0.3 })
        gsap.to(this.fence.position, { y: 0, duration: 0.35, ease: 'back.out(3)' })

        this.trigger('in')
    }

    out(): void {
        if (!this.isIn) return
        this.isIn = false

        gsap.killTweensOf(this.fence.position)
        gsap.to(this.borderMaterial.uniforms.uAlpha, { value: 0, duration: 0.3 })
        gsap.to(this.fenceMaterial.uniforms.uAlpha, { value: 0, duration: 0.3 })
        gsap.to(this.fence.position, { y: -FENCE_HEIGHT, duration: 0.3, ease: 'power2.in' })

        this.trigger('out')
    }

    interact(): void {
        if (!this.active) return

        // Flash, then settle back to the hover state
        gsap.fromTo(this.borderMaterial.uniforms.uAlpha, { value: 1 }, { value: 0.65, duration: 0.8 })
        gsap.fromTo(this.fenceMaterial.uniforms.uAlpha, { value: 1 }, { value: 0.5, duration: 0.8 })

        gsap.killTweensOf(this.fence.position)
        gsap.fromTo(
            this.fence.position,
            { y: -FENCE_HEIGHT * 0.35 },
            { y: 0, duration: 0.45, ease: 'back.out(4)' },
        )

        this.trigger('interact')
    }

    testPosition(x: number, z: number): boolean {
        return (
            x > this.position.x - this.halfExtents.x &&
            x < this.position.x + this.halfExtents.x &&
            z > this.position.z - this.halfExtents.z &&
            z < this.position.z + this.halfExtents.z
        )
    }
}
