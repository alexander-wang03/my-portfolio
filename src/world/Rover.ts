import * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type Time from '../engine/Utils/Time'
import type Physics from './Physics'
import type Terrain from './Terrain'
import { createMatcapMaterial, loadMatcapTexture } from './Materials/Matcap'

export interface RoverOptions {
    time: Time
    physics: Physics
    terrain: Terrain
    /** Null when the model failed to load — a stand-in body is built instead. */
    model: GLTF | null
}

/**
 * Measurements taken from mars_rover_character.glb itself.
 *
 * The model is "Mars Rover Character" by BrentNoll, licensed CC BY 4.0:
 * https://sketchfab.com/3d-models/mars-rover-character-9cbf5d8c68e140b28916739705520901
 *
 * The licence requires credit and a note of what was changed, both of which
 * live in CREDITS.md and in the site's own footer. The changes are here: it is
 * re-scaled, its wheels are detached onto pivots so they steer and spin, and
 * its PBR materials are replaced by white-balanced matcaps.
 *
 * Sketchfab re-exported this from FBX, which renamed every node to `Object_N`
 * and threw the original names away — so the wheels cannot be found by name.
 * They are identified by shape instead: four parts sharing one bounding box,
 * round in two axes and thin in the third. These numbers are what that search
 * matches against, and everything else derives from them.
 */
export const ROVER_MODEL = {
    path: '/models/rover/mars_rover_character.glb',
    /** Wheel bounding box in model units: round across x/y, thin in z. */
    wheelDiameter: 31.26,
    wheelWidth: 18.68,
    /** Model-space height of the wheel centres, and of the ground they rest on. */
    wheelCentreY: -74.8,
    /** The model points along -X. World forward is +Z, hence the quarter turn. */
    yaw: Math.PI / 2,
    /**
     * Wheel centres in model space, measured. Front is the narrow pair — the
     * mast sits above it.
     */
    frontZ: 44.2,
    backZ: -22.4,
    frontHalfTrack: 28.2,
    backHalfTrack: 40.7,
}

/**
 * Target wheel radius in world units. Everything scales from this, since the
 * wheel sets ride height and therefore how the rover sits and drives.
 * `Physics.options` is derived from the same figure — keep them in step.
 */
const WHEEL_RADIUS = 0.264
const SCALE = WHEEL_RADIUS / (ROVER_MODEL.wheelDiameter / 2)

/**
 * How imported base colours are remapped for a scene with no lights.
 *
 * Two thirds of this model's materials are near-black (0.01-0.03) because they
 * were authored for a lit PBR renderer where metalness and specular do the
 * work. Multiplied into a matcap they render as a flat silhouette, so they
 * have to be lifted — but lifting alone is what produced the colour cast:
 * (0.02, 0.03, 0.03) scaled 14x to reach the floor becomes visibly teal, and
 * (0.02, 0.02, 0.03) scaled 18x becomes blue. Those differences are
 * quantisation noise in a value the author intended as "black", not a hue
 * worth preserving, so trust in the source hue falls off with its brightness.
 */
const TINT = {
    /** Luminance floor for dark materials. */
    minLuminance: 0.38,
    /** Above this luminance, a low-chroma colour is pulled toward white. */
    whitenAbove: 0.45,
    /** Only near-neutral colours get whitened — gold should stay gold. */
    whitenBelowChroma: 0.25,
    whitenAmount: 0.6,
    /**
     * Multiplied over everything at the end. The model reads warm — cream and
     * sage where it wants to read white — so this leans the whole palette cool.
     * Blue exceeds 1 deliberately; it is a multiplier, not a colour.
     */
    cast: new THREE.Color(0.94, 0.97, 1.07),
}

/**
 * Correction applied to the albedo, after the texture is sampled.
 *
 * The cast is baked into the model's own images, not its base colours — the
 * body texture averages (212, 208, 189) and the arm texture (219, 225, 188),
 * so the livery's "white" is really olive cream. Every textured material has a
 * base colour of pure white, so there is nothing to tint: the only place to
 * reach it is in the shader.
 */
const CORRECTION = {
    /** Lifts blue to bring the olive average back to neutral. */
    balance: new THREE.Vector3(1.0, 1.0, 1.13),
    /** Brightness lift, so the body's cream 212 reads as white rather than beige. */
    gain: 1.12,
    /** Applied to colours that have real chroma — the livery red. */
    saturation: 1.4,
    /**
     * Applied to colours that have almost none — the body white.
     *
     * Below 1, so their residual tint is pulled *out* rather than amplified.
     * A single saturation figure cannot do both jobs: raising it to make the
     * red pop was simultaneously exaggerating the white's leftover cast, which
     * is why the body stayed off-white however the balance was tuned.
     */
    neutralise: 0.25,
    /** Chroma below this counts as neutral; three times it counts as colour. */
    neutralChroma: 0.06,
    /**
     * How far the matcap sample is pulled to grayscale before the multiply.
     *
     * The metal matcap is not neutral chrome: it averages (173, 153, 144) — a
     * warm brown everywhere but its dead centre. Correcting the albedo to
     * perfect white and then multiplying it by that image paints the cast
     * straight back on, which is why the body kept reading green-yellow no
     * matter how the albedo was balanced. 1 keeps the chrome's contrast but
     * none of its hue.
     */
    matcapNeutralise: 1.0,
    /**
     * Brightness lift on the matcap sample. Its bright zone peaks around 211,
     * so even a pure-white albedo could only ever render at ~83% — whites had
     * no way to pop. Chosen so panels facing the camera land near-white;
     * the specular hotspot clips to pure white, which chrome should.
     */
    matcapGain: 1.6,
}

const WHITE = new THREE.Color(1, 1, 1)
const luminance = (c: THREE.Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b
const chroma = (c: THREE.Color) => Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b)

export default class Rover {
    time: Time
    physics: Physics
    terrain: Terrain
    container: THREE.Object3D
    /** Shadow multiplier, driven by the reveal animation. */
    revealAlpha = 0

    private bodyGroup = new THREE.Object3D()
    private wheelPivots: THREE.Object3D[] = []

    constructor(options: RoverOptions) {
        this.time = options.time
        this.physics = options.physics
        this.terrain = options.terrain
        this.container = new THREE.Object3D()

        // Set shadow dimensions from physics (half-extents for box SDF)
        const o = this.physics.options
        this.terrain.shadowUniforms.uShadowSize.value.set(
            (o.chassisHalfWidth + 0.1) * 0.67,
            (o.chassisHalfDepth + 0.1) * 0.67,
        )

        this.container.add(this.bodyGroup)

        if (options.model) this.buildFromModel(options.model)
        else this.buildPlaceholder()

        this.setTick()
    }

    private buildFromModel(gltf: GLTF): void {
        const scene = gltf.scene
        scene.updateMatrixWorld(true)

        const wheels = this.findWheels(scene)
        for (const wheel of wheels) this.detachWheel(wheel)

        this.convertMaterials(scene)

        // Sit the model so its wheel centres line up with where the suspension
        // holds the physics wheels, rather than with the chassis origin
        const inner = new THREE.Object3D()
        inner.rotation.y = ROVER_MODEL.yaw
        inner.scale.setScalar(SCALE)
        inner.position.y =
            -this.physics.options.suspensionRestLength - ROVER_MODEL.wheelCentreY * SCALE

        inner.add(scene)
        this.bodyGroup.add(inner)
    }

    /**
     * Four parts sharing one bounding box, round in two axes and thin in the
     * third. Measured before any transform is applied, so model space and
     * world space still agree.
     */
    private findWheels(scene: THREE.Object3D): THREE.Mesh[] {
        const box = new THREE.Box3()
        const size = new THREE.Vector3()
        const matches: THREE.Mesh[] = []

        const near = (value: number, target: number) => Math.abs(value - target) < 1

        scene.traverse((node) => {
            if (!(node instanceof THREE.Mesh)) return

            box.setFromObject(node)
            box.getSize(size)

            if (
                near(size.x, ROVER_MODEL.wheelDiameter) &&
                near(size.y, ROVER_MODEL.wheelDiameter) &&
                near(size.z, ROVER_MODEL.wheelWidth)
            ) {
                matches.push(node)
            }
        })

        if (matches.length !== 4) {
            console.warn(
                `[Rover] expected 4 wheels in the model, matched ${matches.length}. ` +
                `They will stay attached to the body and will not turn.`,
            )
            return []
        }

        return matches
    }

    /**
     * Move a wheel out of the model and onto its own pivot, centred so it
     * spins about its axle rather than swinging around the model origin.
     */
    private detachWheel(mesh: THREE.Mesh): void {
        const centre = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3())
        const worldMatrix = mesh.matrixWorld.clone()

        mesh.removeFromParent()

        // Bake the parent chain into the mesh, then shift its own centre to the
        // origin — the parent chain is about to be replaced by the pivot
        worldMatrix.decompose(mesh.position, mesh.quaternion, mesh.scale)
        mesh.position.sub(centre)

        const oriented = new THREE.Object3D()
        oriented.rotation.y = ROVER_MODEL.yaw
        oriented.scale.setScalar(SCALE)
        oriented.add(mesh)

        const pivot = new THREE.Object3D()
        pivot.add(oriented)

        this.wheelPivots.push(pivot)
        this.container.add(pivot)
    }

    /**
     * Swap the imported PBR materials for matcaps.
     *
     * Not a style preference — `Environment` adds no lights whatsoever, so a
     * MeshStandardMaterial here renders black. MeshMatcapMaterial needs no
     * lighting and keeps the model's own colours and textures.
     */
    private convertMaterials(scene: THREE.Object3D): void {
        const matcap = loadMatcapTexture('metal')
        const converted = new Map<THREE.Material, THREE.MeshMatcapMaterial>()

        scene.traverse((node) => {
            if (!(node instanceof THREE.Mesh)) return

            const source = node.material as THREE.MeshStandardMaterial
            let replacement = converted.get(source)

            if (!replacement) {
                const tint = source.color?.clone() ?? WHITE.clone()
                const level = luminance(tint)

                if (level < TINT.minLuminance) {
                    // Lift to the floor, then discard the hue in proportion to
                    // how far it had to be lifted — a colour that needed 14x
                    // was black, and its hue is rounding error
                    const trust = level / TINT.minLuminance
                    tint.multiplyScalar(TINT.minLuminance / Math.max(level, 1e-4))
                    tint.lerp(new THREE.Color().setScalar(TINT.minLuminance), 1 - trust)
                } else if (
                    level > TINT.whitenAbove &&
                    chroma(tint) < TINT.whitenBelowChroma
                ) {
                    // Cream and sage are meant to read as white; gold is not,
                    // and its chroma keeps it out of this branch
                    tint.lerp(WHITE, TINT.whitenAmount)
                }

                tint.multiply(TINT.cast)

                replacement = new THREE.MeshMatcapMaterial({
                    matcap,
                    color: tint,
                    map: source.map ?? null,
                })
                this.applyCorrection(replacement)
                converted.set(source, replacement)
            }

            node.material = replacement
        })
    }

    /**
     * White-balance and saturate the albedo inside the shader.
     *
     * `material.color` cannot do this: it is a plain multiply, so it can shift
     * the whole image but never pull the red livery away from the olive it
     * sits on. Patching after `<map_fragment>` reaches the sampled texture,
     * while leaving the matcap shading that follows it untouched.
     */
    private applyCorrection(material: THREE.MeshMatcapMaterial): void {
        material.onBeforeCompile = (shader) => {
            shader.uniforms.uBalance = { value: CORRECTION.balance }
            shader.uniforms.uGain = { value: CORRECTION.gain }
            shader.uniforms.uSaturation = { value: CORRECTION.saturation }
            shader.uniforms.uNeutralise = { value: CORRECTION.neutralise }
            shader.uniforms.uNeutralChroma = { value: CORRECTION.neutralChroma }
            shader.uniforms.uMatcapNeutralise = { value: CORRECTION.matcapNeutralise }
            shader.uniforms.uMatcapGain = { value: CORRECTION.matcapGain }

            shader.fragmentShader = shader.fragmentShader
                .replace(
                    '#include <common>',
                    `#include <common>
                    uniform vec3 uBalance;
                    uniform float uGain;
                    uniform float uSaturation;
                    uniform float uNeutralise;
                    uniform float uNeutralChroma;
                    uniform float uMatcapNeutralise;
                    uniform float uMatcapGain;`,
                )
                .replace(
                    'vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;',
                    `float matcapLuma = dot(matcapColor.rgb, vec3(0.2126, 0.7152, 0.0722));
                    matcapColor.rgb =
                        mix(matcapColor.rgb, vec3(matcapLuma), uMatcapNeutralise) * uMatcapGain;
                    vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;`,
                )
                .replace(
                    '#include <map_fragment>',
                    `#include <map_fragment>
                    diffuseColor.rgb *= uBalance * uGain;

                    float correctedLuma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
                    float correctedChroma =
                        max(max(diffuseColor.r, diffuseColor.g), diffuseColor.b) -
                        min(min(diffuseColor.r, diffuseColor.g), diffuseColor.b);

                    // Saturate what is genuinely coloured, neutralise what is
                    // only faintly tinted — one figure cannot serve both
                    float colourful = smoothstep(uNeutralChroma, uNeutralChroma * 3.0, correctedChroma);
                    float amount = mix(uNeutralise, uSaturation, colourful);

                    diffuseColor.rgb = mix(vec3(correctedLuma), diffuseColor.rgb, amount);`,
                )
        }
    }

    /** Stand-in so a failed model load leaves something to drive, not nothing. */
    private buildPlaceholder(): void {
        const o = this.physics.options

        const body = new THREE.Mesh(
            new THREE.BoxGeometry(o.chassisHalfWidth * 2, o.chassisHalfHeight * 2, o.chassisHalfDepth * 2),
            createMatcapMaterial({ matcap: 'metal', indirect: 0, reveal: false }),
        )
        this.bodyGroup.add(body)

        const wheelGeometry = new THREE.CylinderGeometry(o.wheelRadius, o.wheelRadius, 0.24, 12)
        wheelGeometry.rotateZ(Math.PI / 2)
        const wheelMaterial = createMatcapMaterial({
            matcap: 'metal',
            color: new THREE.Color('#555560'),
            indirect: 0,
            reveal: false,
        })

        for (let i = 0; i < 4; i++) {
            const pivot = new THREE.Object3D()
            pivot.add(new THREE.Mesh(wheelGeometry, wheelMaterial))
            this.wheelPivots.push(pivot)
            this.container.add(pivot)
        }
    }

    private setTick(): void {
        const steerQuat = new THREE.Quaternion()
        const spinQuat = new THREE.Quaternion()
        const yAxis = new THREE.Vector3(0, 1, 0)
        const xAxis = new THREE.Vector3(1, 0, 0)
        const forwardVec = new THREE.Vector3()

        this.time.on('tick', () => {
            this.bodyGroup.position.copy(this.physics.chassisPosition)
            this.bodyGroup.quaternion.copy(this.physics.chassisQuaternion)

            for (let i = 0; i < this.wheelPivots.length; i++) {
                const pivot = this.wheelPivots[i]

                pivot.position.copy(this.physics.wheelWorldPositions[i])
                pivot.quaternion.copy(this.physics.chassisQuaternion)

                // Front wheels only
                if (i < 2) {
                    steerQuat.setFromAxisAngle(yAxis, this.physics.steering)
                    pivot.quaternion.multiply(steerQuat)
                }

                spinQuat.setFromAxisAngle(xAxis, this.physics.wheelSpinAngles[i])
                pivot.quaternion.multiply(spinQuat)
            }

            // === Update terrain-projected shadow ===
            const pos = this.physics.chassisPosition
            const terrainY = this.terrain.getHeightAt(pos.x, pos.z)

            forwardVec.set(0, 0, 1).applyQuaternion(this.physics.chassisQuaternion)
            const heading = Math.atan2(forwardVec.x, forwardVec.z)

            this.terrain.shadowUniforms.uShadowPos.value.set(pos.x, 0, pos.z)
            this.terrain.shadowUniforms.uShadowAngle.value = heading

            const heightAboveGround = pos.y - terrainY
            const shadowAlpha = THREE.MathUtils.clamp(1.0 - (heightAboveGround - 1.0) / 3.0, 0, 1)
            this.terrain.shadowUniforms.uShadowAlpha.value = shadowAlpha * 0.7 * this.revealAlpha
        })
    }
}
