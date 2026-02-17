import * as THREE from 'three'
import type Time from '../engine/Utils/Time'
import type Physics from './Physics'
import type Terrain from './Terrain'
import { createMatcapMaterial, loadMatcapTexture } from './Materials/Matcap'

export interface RoverOptions {
    time: Time
    physics: Physics
    terrain: Terrain
}

export default class Rover {
    time: Time
    physics: Physics
    terrain: Terrain
    container: THREE.Object3D

    private bodyGroup!: THREE.Group
    private wheelMeshes: THREE.Mesh[] = []
    private antennaPivot!: THREE.Object3D

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

        this.buildRover()
        this.setTick()
    }

    private buildRover(): void {
        const o = this.physics.options
        const metalTex = loadMatcapTexture('metal')
        const bodyMat = createMatcapMaterial({ matcapTexture: metalTex, color: new THREE.Color('#ffffff'), indirect: 0 })
        const deckMat = createMatcapMaterial({ matcapTexture: metalTex, color: new THREE.Color('#ffdd40'), indirect: 0 })
        const mastMat = createMatcapMaterial({ matcapTexture: metalTex, color: new THREE.Color('#d0d0d8'), indirect: 0 })
        const wheelMat = createMatcapMaterial({ matcapTexture: metalTex, color: new THREE.Color('#555560'), indirect: 0 })
        const antennaMat = createMatcapMaterial({ matcapTexture: metalTex, color: new THREE.Color('#ff3030'), indirect: 0 })

        // === Body group (syncs with chassis rigid body) ===
        this.bodyGroup = new THREE.Group()

        // Main body box — white (like real rover chassis)
        const bodyWidth = o.chassisHalfWidth * 2 * 0.85
        const bodyHeight = o.chassisHalfHeight * 1.0
        const bodyDepth = o.chassisHalfDepth * 2 * 0.8
        const body = new THREE.Mesh(
            new THREE.BoxGeometry(bodyWidth, bodyHeight, bodyDepth),
            bodyMat,
        )
        body.position.y = o.chassisHalfHeight * 0.3
        this.bodyGroup.add(body)

        // Deck / equipment bay — gold (thermal blanket look)
        const deckHeight = bodyHeight * 0.25
        const deck = new THREE.Mesh(
            new THREE.BoxGeometry(bodyWidth * 0.9, deckHeight, bodyDepth * 0.7),
            deckMat,
        )
        deck.position.y = body.position.y + bodyHeight / 2 + deckHeight / 2
        this.bodyGroup.add(deck)

        // Camera mast — gray metal
        const mastHeight = 0.5
        const mast = new THREE.Mesh(
            new THREE.BoxGeometry(0.06, mastHeight, 0.06),
            mastMat,
        )
        mast.position.set(0, deck.position.y + deckHeight / 2 + mastHeight / 2, bodyDepth * 0.15)
        this.bodyGroup.add(mast)

        // Mast head (camera) — gray
        const mastHead = new THREE.Mesh(
            new THREE.SphereGeometry(0.08, 8, 6),
            mastMat,
        )
        mastHead.position.set(
            mast.position.x,
            mast.position.y + mastHeight / 2 + 0.08,
            mast.position.z,
        )
        this.bodyGroup.add(mastHead)

        // Antenna — on an Object3D pivot for spring physics
        this.antennaPivot = new THREE.Object3D()
        this.antennaPivot.position.set(
            -bodyWidth * 0.3,
            deck.position.y + deckHeight / 2,
            -bodyDepth * 0.25,
        )

        const antenna = new THREE.Mesh(
            new THREE.CylinderGeometry(0.015, 0.015, 0.6, 4),
            antennaMat,
        )
        antenna.position.y = 0.3

        const antennaTip = new THREE.Mesh(
            new THREE.SphereGeometry(0.04, 6, 4),
            antennaMat,
        )
        antennaTip.position.y = 0.6

        this.antennaPivot.add(antenna, antennaTip)
        this.bodyGroup.add(this.antennaPivot)

        this.container.add(this.bodyGroup)

        // === Wheels (separate meshes, synced individually to physics) ===
        const wheelGeo = new THREE.CylinderGeometry(
            o.wheelRadius, o.wheelRadius,
            o.wheelHalfWidth * 2, 12,
        )
        wheelGeo.rotateZ(Math.PI / 2) // align cylinder axis with X (lateral)

        for (let i = 0; i < 4; i++) {
            const wheel = new THREE.Mesh(wheelGeo, wheelMat)
            this.wheelMeshes.push(wheel)
            this.container.add(wheel)
        }
    }

    private setTick(): void {
        // Antenna spring state
        const antennaSpeed = new THREE.Vector2(0, 0)
        const antennaPos = new THREE.Vector2(0, 0)

        // Reusable objects to avoid per-frame allocation
        const steerQuat = new THREE.Quaternion()
        const spinQuat = new THREE.Quaternion()
        const yAxis = new THREE.Vector3(0, 1, 0)
        const xAxis = new THREE.Vector3(1, 0, 0)
        const forwardVec = new THREE.Vector3()

        this.time.on('tick', () => {
            // === Sync body to chassis ===
            this.bodyGroup.position.copy(this.physics.chassisPosition)
            this.bodyGroup.quaternion.copy(this.physics.chassisQuaternion)

            // === Sync each wheel independently ===
            for (let i = 0; i < 4; i++) {
                this.wheelMeshes[i].position.copy(this.physics.wheelWorldPositions[i])

                // Start with chassis orientation
                this.wheelMeshes[i].quaternion.copy(this.physics.chassisQuaternion)

                // Apply steering to front wheels (indices 0, 1)
                if (i < 2) {
                    steerQuat.setFromAxisAngle(yAxis, this.physics.steering)
                    this.wheelMeshes[i].quaternion.multiply(steerQuat)
                }

                // Apply wheel spin
                spinQuat.setFromAxisAngle(xAxis, this.physics.wheelSpinAngles[i])
                this.wheelMeshes[i].quaternion.multiply(spinQuat)
            }

            // === Update terrain-projected shadow ===
            const pos = this.physics.chassisPosition
            const terrainY = this.terrain.getHeightAt(pos.x, pos.z)

            forwardVec.set(0, 0, 1).applyQuaternion(this.physics.chassisQuaternion)
            const heading = Math.atan2(forwardVec.x, forwardVec.z)

            this.terrain.shadowUniforms.uShadowPos.value.set(pos.x, 0, pos.z)
            this.terrain.shadowUniforms.uShadowAngle.value = heading

            // Fade shadow based on height above ground
            const heightAboveGround = pos.y - terrainY
            const shadowAlpha = THREE.MathUtils.clamp(1.0 - (heightAboveGround - 1.0) / 3.0, 0, 1)
            this.terrain.shadowUniforms.uShadowAlpha.value = shadowAlpha * 0.7

            // === Antenna spring physics ===
            const accel = this.physics.acceleration
            const maxAccel = 2.0

            antennaSpeed.x -= THREE.MathUtils.clamp(accel.x, -maxAccel, maxAccel) * 0.5
            antennaSpeed.y -= THREE.MathUtils.clamp(accel.z, -maxAccel, maxAccel) * 0.5

            // Pull back to center
            antennaSpeed.x -= antennaPos.x * antennaPos.length() * 0.05
            antennaSpeed.y -= antennaPos.y * antennaPos.length() * 0.05

            // Damping
            antennaSpeed.multiplyScalar(1 - 0.12)

            antennaPos.add(antennaSpeed)

            // Apply rotation in local body space
            this.antennaPivot.rotation.x = antennaPos.y * 0.1
            this.antennaPivot.rotation.z = -antennaPos.x * 0.1
        })
    }
}
