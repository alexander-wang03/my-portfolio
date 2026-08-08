import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import type Time from '../engine/Utils/Time'
import type Controls from './Controls'
import type Terrain from './Terrain'
import type { GUI } from 'dat.gui'
import EventEmitter from '../engine/Utils/EventEmitter'

/**
 * Height the rover drops in from, everywhere.
 *
 * Kept low deliberately: from 6 units it lands at ~12.5 m/s, which bottoms out
 * the 0.3 unit suspension travel, bounces the chassis off the ground and rolls
 * it onto its side. 3 units is still a visible fall at a survivable speed.
 */
export const DROP_IN_HEIGHT = 3

/**
 * Contact force below which no impact is reported, in newtons.
 *
 * The chassis rests on raycast wheels rather than its collider, so it only
 * touches anything when it genuinely hits it — but loose objects sit on the
 * terrain permanently, and without a floor here every crate would scrape
 * continuously.
 */
const IMPACT_THRESHOLD = 1400

/**
 * Ignore anything that would barely be audible anyway.
 *
 * Has to stay clear of the per-collider thresholds below, or events the
 * physics engine bothered to report get discarded here instead.
 */
const MIN_IMPACT_STRENGTH = 0.11

/**
 * Milliseconds before the same pair of colliders can report again.
 *
 * Long enough that resting, sliding and scraping collapse into one knock,
 * short enough that deliberately ramming something repeatedly still sounds
 * each time.
 */
const PAIR_IMPACT_COOLDOWN = 400

/** What was hit, so the sound can match the object rather than being generic. */
export type ImpactMaterial = 'default' | 'letter' | 'block'

/**
 * Force treated as a full-volume hit, per material. Anything harder clamps.
 *
 * These have to be per-material: a 1 kg crate cannot produce a meaningful
 * fraction of what the 60 kg rover does, so normalising everything against a
 * single rover-sized figure put light objects permanently under the audible
 * floor. Each value is roughly the hardest hit that object can deliver.
 */
const IMPACT_REFERENCE_FORCE: Record<ImpactMaterial, number> = {
    default: 9000, // the rover against terrain or scenery
    letter: 2200, // a 3 kg block letter
    block: 350, // a 0.4 kg prop
}

export interface PhysicsOptions {
    time: Time
    controls: Controls
    terrain: Terrain
    debug?: GUI
    config: { debug: boolean; touch: boolean }
}

export default class Physics extends EventEmitter {
    time: Time
    controls: Controls
    terrain: Terrain
    debug?: GUI
    config: PhysicsOptions['config']

    world!: RAPIER.World
    eventQueue!: RAPIER.EventQueue
    chassisBody!: RAPIER.RigidBody
    vehicleController!: RAPIER.DynamicRayCastVehicleController

    // Debug visuals
    debugContainer: THREE.Object3D
    private chassisMesh!: THREE.Mesh
    private wheelDebugMeshes: THREE.Mesh[] = []

    // Vehicle state
    steering = 0
    /** Eased 0–1 brake strength, so the brake comes on over a few frames. */
    private brakeRamp = 0
    forwardSpeed = 0
    chassisPosition = new THREE.Vector3()
    chassisQuaternion = new THREE.Quaternion()

    // Wheel state (exposed for Rover visuals + DustParticles)
    wheelWorldPositions: THREE.Vector3[] = [
        new THREE.Vector3(), new THREE.Vector3(),
        new THREE.Vector3(), new THREE.Vector3(),
    ]
    wheelGrounded: boolean[] = [false, false, false, false]
    wheelSpinAngles: number[] = [0, 0, 0, 0]

    // Acceleration tracking (for antenna spring physics)
    acceleration = new THREE.Vector3()
    private prevVelocity = new THREE.Vector3()

    // Vehicle tuning
    options = {
        chassisHalfWidth: 0.6,
        chassisHalfHeight: 0.35,
        chassisHalfDepth: 0.85,
        chassisMass: 60,
        wheelRadius: 0.22,
        wheelHalfWidth: 0.12,
        wheelFrontZ: 0.65,
        wheelBackZ: -0.55,
        wheelOffsetX: 0.55,
        suspensionRestLength: 0.25,
        suspensionStiffness: 50,
        suspensionDamping: 1.8,
        suspensionCompression: 1.5,
        suspensionTravel: 0.3,
        frictionSlip: 10,
        maxEngineForce: 210,
        maxEngineForceBoost: 330,
        maxSpeed: 21,
        maxSteeringAngle: Math.PI * 0.2,
        steeringSpeed: 0.04,
        brakeForce: 18,
        // Fraction of horizontal speed kept per frame at 60fps. Braking must
        // stay below coasting or the brake feels like it does nothing — but
        // not far below, or it stops dead. Time to shed 90% of speed:
        // coasting ~1.26s, braking ~0.94s.
        rollingDamping: 0.97,
        brakeDamping: 0.96,
        // Seconds for the brake to reach full strength. Applying it instantly
        // is most of what reads as "aggressive", regardless of the magnitude.
        brakeRampTime: 0.3,
    }

    /** Collider handle -> what it sounds like when struck. */
    private impactMaterials = new Map<number, ImpactMaterial>()
    /** Collider pair -> when it last reported, for `claimPairImpact`. */
    private pairImpactTimes = new Map<number, number>()

    // Upside-down detection
    private upsideDownState: 'watching' | 'pending' | 'turning' = 'watching'
    private upsideDownTimeout: number | null = null

    constructor(options: PhysicsOptions) {
        super()

        this.time = options.time
        this.controls = options.controls
        this.terrain = options.terrain
        this.debug = options.debug
        this.config = options.config

        this.debugContainer = new THREE.Object3D()

        this.setWorld()
        this.setTerrainCollider()
        this.setVehicle()
        this.setDebugVisuals()
        this.setTick()

        this.controls.on('action', (...args: unknown[]) => {
            if (args[0] === 'reset') this.resetVehicle()
        })
    }

    private setWorld(): void {
        const gravity = { x: 0, y: -13, z: 0 }
        this.world = new RAPIER.World(gravity)
        this.eventQueue = new RAPIER.EventQueue(true)
    }

    private setTerrainCollider(): void {
        const res = this.terrain.segments + 1
        const halfSize = this.terrain.size / 2
        const step = this.terrain.size / (res - 1)

        // Build heightfield by sampling getHeightAt at each grid position.
        // Rapier expects COLUMN-MAJOR order: heights[row + col * (nrows+1)]
        // where row index → Z axis, col index → X axis.
        const worldHeights = new Float32Array(res * res)
        for (let row = 0; row < res; row++) {
            for (let col = 0; col < res; col++) {
                const worldX = -halfSize + col * step
                const worldZ = -halfSize + row * step
                worldHeights[row + col * res] = this.terrain.getHeightAt(worldX, worldZ)
            }
        }

        const scale = new RAPIER.Vector3(
            this.terrain.size,
            1, // heights are already in world units
            this.terrain.size,
        )

        const heightFieldDesc = RAPIER.ColliderDesc.heightfield(
            res - 1, // nrows (Z subdivisions)
            res - 1, // ncols (X subdivisions)
            worldHeights,
            scale,
        )

        this.world.createCollider(heightFieldDesc)
    }

    private setVehicle(): void {
        const o = this.options

        // Spawn above the terrain center
        const spawnHeight = this.terrain.getHeightAt(0, 0) + 3

        // Create chassis rigid body with CCD to prevent tunneling on steep terrain
        const chassisDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(0, spawnHeight, 0)
            .setCanSleep(false)
            .setCcdEnabled(true)
        this.chassisBody = this.world.createRigidBody(chassisDesc)

        // Chassis collider (box)
        const chassisColliderDesc = RAPIER.ColliderDesc.cuboid(
            o.chassisHalfWidth,
            o.chassisHalfHeight,
            o.chassisHalfDepth,
        ).setMass(o.chassisMass)
            .setFriction(0.5)
            .setRestitution(0.1)
            .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
            .setContactForceEventThreshold(IMPACT_THRESHOLD)
        this.world.createCollider(chassisColliderDesc, this.chassisBody)

        // Create vehicle controller
        this.vehicleController = this.world.createVehicleController(this.chassisBody)
        this.vehicleController.indexUpAxis = 1 // Y-up
        this.vehicleController.setIndexForwardAxis = 2 // Z-forward

        // Wheel positions (Y-up world: X=lateral, Y=up, Z=forward)
        const suspDir = { x: 0, y: -1, z: 0 }
        const axle = { x: -1, y: 0, z: 0 }

        // Front-left
        this.vehicleController.addWheel(
            { x: -o.wheelOffsetX, y: 0, z: o.wheelFrontZ },
            suspDir, axle, o.suspensionRestLength, o.wheelRadius,
        )
        // Front-right
        this.vehicleController.addWheel(
            { x: o.wheelOffsetX, y: 0, z: o.wheelFrontZ },
            suspDir, axle, o.suspensionRestLength, o.wheelRadius,
        )
        // Back-left
        this.vehicleController.addWheel(
            { x: -o.wheelOffsetX, y: 0, z: o.wheelBackZ },
            suspDir, axle, o.suspensionRestLength, o.wheelRadius,
        )
        // Back-right
        this.vehicleController.addWheel(
            { x: o.wheelOffsetX, y: 0, z: o.wheelBackZ },
            suspDir, axle, o.suspensionRestLength, o.wheelRadius,
        )

        // Configure all wheels
        for (let i = 0; i < 4; i++) {
            this.vehicleController.setWheelSuspensionStiffness(i, o.suspensionStiffness)
            this.vehicleController.setWheelSuspensionCompression(i, o.suspensionCompression)
            this.vehicleController.setWheelSuspensionRelaxation(i, o.suspensionDamping)
            this.vehicleController.setWheelMaxSuspensionTravel(i, o.suspensionTravel)
            this.vehicleController.setWheelFrictionSlip(i, o.frictionSlip)
            this.vehicleController.setWheelMaxSuspensionForce(i, 10000)
        }
    }

    private setDebugVisuals(): void {
        if (!this.config.debug) return

        const o = this.options

        // Chassis wireframe
        const chassisGeo = new THREE.BoxGeometry(
            o.chassisHalfWidth * 2,
            o.chassisHalfHeight * 2,
            o.chassisHalfDepth * 2,
        )
        const wireframeMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true })
        this.chassisMesh = new THREE.Mesh(chassisGeo, wireframeMat)
        this.debugContainer.add(this.chassisMesh)

        // Wheel wireframes
        const wheelGeo = new THREE.CylinderGeometry(
            o.wheelRadius, o.wheelRadius, o.wheelHalfWidth * 2, 12,
        )
        wheelGeo.rotateZ(Math.PI / 2)
        const wheelMat = new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true })

        for (let i = 0; i < 4; i++) {
            const wheelMesh = new THREE.Mesh(wheelGeo, wheelMat)
            this.debugContainer.add(wheelMesh)
            this.wheelDebugMeshes.push(wheelMesh)
        }

    }

    private setTick(): void {
        this.time.on('tick', () => {
            const dt = Math.min(this.time.delta / 1000, 1 / 30)

            // --- Steering ---
            const steerSpeed = this.options.steeringSpeed
            if (this.controls.actions.right) {
                this.steering -= steerSpeed
            } else if (this.controls.actions.left) {
                this.steering += steerSpeed
            } else {
                // Return to center
                if (Math.abs(this.steering) > steerSpeed) {
                    this.steering -= steerSpeed * Math.sign(this.steering)
                } else {
                    this.steering = 0
                }
            }
            this.steering = Math.max(-this.options.maxSteeringAngle, Math.min(this.options.maxSteeringAngle, this.steering))

            // Apply steering to front wheels
            this.vehicleController.setWheelSteering(0, this.steering)
            this.vehicleController.setWheelSteering(1, this.steering)

            // --- Engine force (AWD with speed tapering to prevent wheelies) ---
            const baseForce = this.controls.actions.boost
                ? this.options.maxEngineForceBoost
                : this.options.maxEngineForce

            // Taper force as speed approaches max (prevents runaway acceleration)
            const speedRatio = Math.min(Math.abs(this.forwardSpeed) / this.options.maxSpeed, 1)
            const forceMult = 1 - speedRatio * speedRatio
            const maxForce = baseForce * forceMult

            // Ease the brake in and out rather than switching it, so it reads
            // as a pedal being pressed instead of a wall appearing
            const rampRate = dt / this.options.brakeRampTime
            this.brakeRamp = this.controls.actions.brake
                ? Math.min(1, this.brakeRamp + rampRate)
                : Math.max(0, this.brakeRamp - rampRate)

            // Braking progressively cuts the throttle, so holding both slows
            // the rover without the engine cutting out in a single frame
            const throttle = 1 - this.brakeRamp
            const driving = this.controls.actions.up || this.controls.actions.down

            if (this.controls.actions.up) {
                // All-wheel drive — spread force across 4 wheels
                const perWheel = maxForce * 0.5 * throttle
                for (let i = 0; i < 4; i++) {
                    this.vehicleController.setWheelEngineForce(i, perWheel)
                }
            } else if (this.controls.actions.down) {
                const perWheel = -maxForce * 0.3 * throttle
                for (let i = 0; i < 4; i++) {
                    this.vehicleController.setWheelEngineForce(i, perWheel)
                }
            } else {
                for (let i = 0; i < 4; i++) {
                    this.vehicleController.setWheelEngineForce(i, 0)
                }
            }

            // --- Brake ---
            const brakeForce = this.options.brakeForce * this.brakeRamp
            for (let i = 0; i < 4; i++) {
                this.vehicleController.setWheelBrake(i, brakeForce)
            }

            // --- Step physics (sub-step for stability on steep terrain) ---
            const subSteps = 4
            const subDt = dt / subSteps
            for (let s = 0; s < subSteps; s++) {
                this.world.timestep = subDt
                this.vehicleController.updateVehicle(subDt)
                this.world.step(this.eventQueue)
                this.reportImpacts()
            }

            // --- Read chassis transform ---
            const pos = this.chassisBody.translation()
            const rot = this.chassisBody.rotation()
            this.chassisPosition.set(pos.x, pos.y, pos.z)
            this.chassisQuaternion.set(rot.x, rot.y, rot.z, rot.w)

            // --- Anti-wheelie: clamp pitch angular velocity only ---
            const angvel = this.chassisBody.angvel()
            const localRight = new THREE.Vector3(1, 0, 0).applyQuaternion(this.chassisQuaternion)
            const pitchAngVel = localRight.x * angvel.x + localRight.y * angvel.y + localRight.z * angvel.z
            const maxPitch = 1.5
            if (Math.abs(pitchAngVel) > maxPitch) {
                const excess = pitchAngVel - Math.sign(pitchAngVel) * maxPitch
                this.chassisBody.setAngvel({
                    x: angvel.x - localRight.x * excess,
                    y: angvel.y - localRight.y * excess,
                    z: angvel.z - localRight.z * excess,
                }, true)
            }

            // Forward speed + acceleration tracking
            const vel = this.chassisBody.linvel()
            const currentVel = new THREE.Vector3(vel.x, vel.y, vel.z)
            const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.chassisQuaternion)
            this.forwardSpeed = currentVel.dot(forward)

            if (dt > 0) {
                this.acceleration.copy(currentVel).sub(this.prevVelocity).divideScalar(dt)
            }
            this.prevVelocity.copy(currentVel)

            // --- Slowdown when not driving ---
            // Braking used to be excluded from this block, which meant holding
            // the brake removed the rolling damping and shed speed *slower*
            // than simply letting go. Braking now damps harder than coasting.
            if (!driving || this.brakeRamp > 0) {
                const linvel = this.chassisBody.linvel()
                const speed = Math.sqrt(linvel.x * linvel.x + linvel.z * linvel.z)
                if (speed > 0.1) {
                    // Blend toward the braking figure as the pedal comes on
                    const perFrame = this.options.rollingDamping
                        + (this.options.brakeDamping - this.options.rollingDamping) * this.brakeRamp
                    // Framerate independent — the constants are tuned for 60fps
                    const damping = Math.pow(perFrame, dt * 60)
                    this.chassisBody.setLinvel(
                        { x: linvel.x * damping, y: linvel.y, z: linvel.z * damping },
                        true,
                    )
                }
            }

            // --- Upside-down detection ---
            this.checkUpsideDown()

            // --- Compute wheel world positions + state ---
            for (let i = 0; i < 4; i++) {
                const cp = this.vehicleController.wheelChassisConnectionPointCs(i)
                const suspLen = this.vehicleController.wheelSuspensionLength(i) ?? 0

                if (!cp) continue

                // Wheel center = connection point + suspension direction * suspLen
                const wheelLocalPos = new THREE.Vector3(
                    cp.x,
                    cp.y - suspLen,
                    cp.z,
                )
                this.wheelWorldPositions[i].copy(
                    wheelLocalPos.applyQuaternion(this.chassisQuaternion).add(this.chassisPosition),
                )
                this.wheelGrounded[i] = this.vehicleController.wheelIsInContact(i)
                this.wheelSpinAngles[i] = this.vehicleController.wheelRotation(i) ?? 0
            }

            // --- Update debug visuals ---
            if (this.chassisMesh) {
                this.chassisMesh.position.copy(this.chassisPosition)
                this.chassisMesh.quaternion.copy(this.chassisQuaternion)

                for (let i = 0; i < 4; i++) {
                    this.wheelDebugMeshes[i].position.copy(this.wheelWorldPositions[i])
                    this.wheelDebugMeshes[i].quaternion.copy(this.chassisQuaternion)
                    const spinQuat = new THREE.Quaternion().setFromAxisAngle(
                        new THREE.Vector3(1, 0, 0), this.wheelSpinAngles[i],
                    )
                    this.wheelDebugMeshes[i].quaternion.multiply(spinQuat)
                }

            }
        })
    }

    private checkUpsideDown(): void {
        const worldUp = new THREE.Vector3(0, 1, 0).applyQuaternion(this.chassisQuaternion)

        if (worldUp.y < 0.3) {
            if (this.upsideDownState === 'watching') {
                this.upsideDownState = 'pending'
                this.upsideDownTimeout = window.setTimeout(() => {
                    this.upsideDownState = 'turning'

                    // Teleport upright above current position
                    const pos = this.chassisBody.translation()
                    const terrainY = this.terrain.getHeightAt(pos.x, pos.z)
                    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.chassisQuaternion)
                    forward.y = 0
                    forward.normalize()
                    const angle = Math.atan2(forward.x, forward.z)
                    const uprightQuat = new THREE.Quaternion().setFromAxisAngle(
                        new THREE.Vector3(0, 1, 0), angle,
                    )

                    this.chassisBody.setTranslation({ x: pos.x, y: terrainY + 3, z: pos.z }, true)
                    this.chassisBody.setRotation(
                        { x: uprightQuat.x, y: uprightQuat.y, z: uprightQuat.z, w: uprightQuat.w },
                        true,
                    )
                    this.chassisBody.setLinvel({ x: 0, y: 0, z: 0 }, true)
                    this.chassisBody.setAngvel({ x: 0, y: 0, z: 0 }, true)

                    this.upsideDownState = 'watching'
                }, 3000)
            }
        } else {
            if (this.upsideDownState === 'pending' && this.upsideDownTimeout !== null) {
                this.upsideDownState = 'watching'
                window.clearTimeout(this.upsideDownTimeout)
                this.upsideDownTimeout = null
            }
        }
    }

    /**
     * Drop the rover in at a point on the map. Defaults to spawn; the reveal
     * uses a taller drop, and the router uses this to jump between sections.
     */
    resetVehicle(dropHeight = DROP_IN_HEIGHT, x = 0, z = 0): void {
        const spawnHeight = this.terrain.getHeightAt(x, z) + dropHeight
        const upright = this.slopeQuaternion(x, z)

        this.chassisBody.setTranslation({ x, y: spawnHeight, z }, true)
        this.chassisBody.setRotation(
            { x: upright.x, y: upright.y, z: upright.z, w: upright.w },
            true,
        )
        this.chassisBody.setLinvel({ x: 0, y: 0, z: 0 }, true)
        this.chassisBody.setAngvel({ x: 0, y: 0, z: 0 }, true)
        this.steering = 0
    }

    /**
     * Turn contact forces into `impact` events, loudest first.
     *
     * Reported as a 0-1 strength rather than raw newtons so listeners do not
     * have to know anything about the physics scale.
     */
    private reportImpacts(): void {
        this.eventQueue.drainContactForceEvents((event) => {
            const first = event.collider1()
            const second = event.collider2()

            // Only one side of a pair is ever tagged — the other is the rover
            // or the terrain, neither of which overrides the object's own sound
            const material =
                this.impactMaterials.get(first) ??
                this.impactMaterials.get(second) ??
                'default'

            // Must be normalised against what this object can actually produce
            const strength = Math.min(
                event.totalForceMagnitude() / IMPACT_REFERENCE_FORCE[material],
                1,
            )
            if (strength < MIN_IMPACT_STRENGTH) return

            // Checked after the strength test, so a contact too soft to be
            // heard cannot start the cooldown and mask a real hit behind it
            if (!this.claimPairImpact(first, second)) return

            this.trigger('impact', [strength, material])
        })
    }

    /**
     * Rate-limit a single pair of colliders, returning false while it is still
     * within its cooldown.
     *
     * Contact-force events repeat every substep for as long as two surfaces
     * stay touching — 240 a second at four substeps — and Rapier reports no
     * start or stop, so nothing here can tell "still resting against it" from
     * "hit it again". Treating each pair as one impact per cooldown turns a
     * scrape back into a knock.
     */
    private claimPairImpact(first: number, second: number): boolean {
        // Order-independent key, since the pair can be reported either way round
        const key = Math.min(first, second) * 1e6 + Math.max(first, second)

        const last = this.pairImpactTimes.get(key)
        if (last !== undefined && this.time.elapsed - last < PAIR_IMPACT_COOLDOWN) {
            return false
        }

        this.pairImpactTimes.set(key, this.time.elapsed)

        // Pairs that stopped touching never come back to clear themselves
        if (this.pairImpactTimes.size > 512) {
            for (const [pair, time] of this.pairImpactTimes) {
                if (this.time.elapsed - time > PAIR_IMPACT_COOLDOWN) {
                    this.pairImpactTimes.delete(pair)
                }
            }
        }

        return true
    }

    /** Tag a collider so impacts against it pick the right sound. */
    setImpactMaterial(collider: RAPIER.Collider, material: ImpactMaterial): void {
        this.impactMaterials.set(collider.handle, material)
    }

    /**
     * Park the rover in the air over a point, then let it fall.
     *
     * The hold matters on first load: the drop otherwise happens behind the
     * fading loading overlay and is over before anyone sees it.
     */
    dropIn(x = 0, z = 0, holdMs = 500): void {
        this.resetVehicle(DROP_IN_HEIGHT, x, z)

        this.chassisBody.setGravityScale(0, true)
        window.setTimeout(() => {
            this.chassisBody.setGravityScale(1, true)
        }, holdMs)
    }

    /**
     * Orientation that lays the rover flat against the ground at a point.
     *
     * Dropped axis-aligned onto a slope, one pair of wheels lands first and
     * the resulting torque can roll the rover onto its side before it settles
     * — even on the gentle 3-9 degree grades around the sections.
     */
    private slopeQuaternion(x: number, z: number): THREE.Quaternion {
        const step = 1
        const dx = this.terrain.getHeightAt(x - step, z) - this.terrain.getHeightAt(x + step, z)
        const dz = this.terrain.getHeightAt(x, z - step) - this.terrain.getHeightAt(x, z + step)

        const normal = new THREE.Vector3(dx, 2 * step, dz).normalize()
        return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal)
    }
}
