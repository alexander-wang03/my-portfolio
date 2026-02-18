import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import type Time from '../engine/Utils/Time'
import type Controls from './Controls'
import type Terrain from './Terrain'
import type { GUI } from 'dat.gui'

export interface PhysicsOptions {
    time: Time
    controls: Controls
    terrain: Terrain
    debug?: GUI
    config: { debug: boolean; touch: boolean }
}

export default class Physics {
    time: Time
    controls: Controls
    terrain: Terrain
    debug?: GUI
    config: PhysicsOptions['config']

    world!: RAPIER.World
    chassisBody!: RAPIER.RigidBody
    vehicleController!: RAPIER.DynamicRayCastVehicleController

    // Debug visuals
    debugContainer: THREE.Object3D
    private chassisMesh!: THREE.Mesh
    private wheelDebugMeshes: THREE.Mesh[] = []

    // Vehicle state
    steering = 0
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
        suspensionRestLength: 0.3,
        suspensionStiffness: 24,
        suspensionDamping: 4.0,
        suspensionCompression: 2.5,
        suspensionTravel: 0.4,
        frictionSlip: 3.0,
        maxEngineForce: 70,
        maxEngineForceBoost: 110,
        maxSpeed: 16,
        maxSteeringAngle: Math.PI * 0.2,
        steeringSpeed: 0.04,
        brakeForce: 8,
    }

    // Upside-down detection
    private upsideDownState: 'watching' | 'pending' | 'turning' = 'watching'
    private upsideDownTimeout: number | null = null

    constructor(options: PhysicsOptions) {
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
        const gravity = { x: 0, y: -3.72, z: 0 }
        this.world = new RAPIER.World(gravity)
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

            if (this.controls.actions.up) {
                // All-wheel drive — spread force across 4 wheels to prevent wheelies
                const perWheel = maxForce * 0.5
                for (let i = 0; i < 4; i++) {
                    this.vehicleController.setWheelEngineForce(i, perWheel)
                }
            } else if (this.controls.actions.down) {
                const perWheel = -maxForce * 0.3
                for (let i = 0; i < 4; i++) {
                    this.vehicleController.setWheelEngineForce(i, perWheel)
                }
            } else {
                for (let i = 0; i < 4; i++) {
                    this.vehicleController.setWheelEngineForce(i, 0)
                }
            }

            // --- Brake ---
            const brakeForce = this.controls.actions.brake ? this.options.brakeForce : 0
            for (let i = 0; i < 4; i++) {
                this.vehicleController.setWheelBrake(i, brakeForce)
            }

            // --- Step physics (sub-step for stability on steep terrain) ---
            const subSteps = 4
            const subDt = dt / subSteps
            for (let s = 0; s < subSteps; s++) {
                this.world.timestep = subDt
                this.vehicleController.updateVehicle(subDt)
                this.world.step()
            }

            // --- Read chassis transform ---
            const pos = this.chassisBody.translation()
            const rot = this.chassisBody.rotation()
            this.chassisPosition.set(pos.x, pos.y, pos.z)
            this.chassisQuaternion.set(rot.x, rot.y, rot.z, rot.w)

            // Forward speed + acceleration tracking
            const vel = this.chassisBody.linvel()
            const currentVel = new THREE.Vector3(vel.x, vel.y, vel.z)
            const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.chassisQuaternion)
            this.forwardSpeed = currentVel.dot(forward)

            if (dt > 0) {
                this.acceleration.copy(currentVel).sub(this.prevVelocity).divideScalar(dt)
            }
            this.prevVelocity.copy(currentVel)

            // --- Natural slowdown when not accelerating ---
            if (!this.controls.actions.up && !this.controls.actions.down && !this.controls.actions.brake) {
                const linvel = this.chassisBody.linvel()
                const speed = Math.sqrt(linvel.x * linvel.x + linvel.z * linvel.z)
                if (speed > 0.1) {
                    const damping = 0.97
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

    resetVehicle(): void {
        const spawnHeight = this.terrain.getHeightAt(0, 0) + 3
        this.chassisBody.setTranslation({ x: 0, y: spawnHeight, z: 0 }, true)
        this.chassisBody.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true)
        this.chassisBody.setLinvel({ x: 0, y: 0, z: 0 }, true)
        this.chassisBody.setAngvel({ x: 0, y: 0, z: 0 }, true)
        this.steering = 0
    }
}
