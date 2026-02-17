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
        const armMat = createMatcapMaterial({ matcapTexture: metalTex, color: new THREE.Color('#c0c0c0'), indirect: 0 })

        this.bodyGroup = new THREE.Group()

        const bodyWidth = o.chassisHalfWidth * 2 * 0.85
        const bodyHeight = o.chassisHalfHeight * 1.0
        const bodyDepth = o.chassisHalfDepth * 2 * 0.8

        // === Main chassis box ===
        const body = new THREE.Mesh(
            new THREE.BoxGeometry(bodyWidth, bodyHeight, bodyDepth),
            bodyMat,
        )
        body.position.y = o.chassisHalfHeight * 0.3
        this.bodyGroup.add(body)

        // === Equipment deck (gold thermal blanket) ===
        const deckHeight = bodyHeight * 0.25
        const deck = new THREE.Mesh(
            new THREE.BoxGeometry(bodyWidth * 0.9, deckHeight, bodyDepth * 0.7),
            deckMat,
        )
        deck.position.y = body.position.y + bodyHeight / 2 + deckHeight / 2
        this.bodyGroup.add(deck)

        const deckTop = deck.position.y + deckHeight / 2

        // === Remote Sensing Mast (RSM) — tall with rectangular camera head ===
        const mastHeight = 0.7
        const mast = new THREE.Mesh(
            new THREE.BoxGeometry(0.05, mastHeight, 0.05),
            mastMat,
        )
        mast.position.set(0, deckTop + mastHeight / 2, bodyDepth * 0.2)
        this.bodyGroup.add(mast)

        // Mast head — rectangular block with stereo cameras
        const headWidth = 0.2
        const headHeight = 0.07
        const headDepth = 0.1
        const mastHead = new THREE.Mesh(
            new THREE.BoxGeometry(headWidth, headHeight, headDepth),
            mastMat,
        )
        const headY = mast.position.y + mastHeight / 2 + headHeight / 2
        mastHead.position.set(0, headY, mast.position.z)
        this.bodyGroup.add(mastHead)

        // Stereo camera "eyes"
        const eyeGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.03, 6)
        eyeGeo.rotateX(Math.PI / 2)
        for (const side of [-1, 1]) {
            const eye = new THREE.Mesh(eyeGeo, wheelMat)
            eye.position.set(side * 0.055, headY, mast.position.z + headDepth / 2 + 0.01)
            this.bodyGroup.add(eye)
        }

        // === High-Gain Antenna (HGA) — circular dish on arm ===
        const dishArmHeight = 0.2
        const dishArm = new THREE.Mesh(
            new THREE.CylinderGeometry(0.015, 0.015, dishArmHeight, 4),
            mastMat,
        )
        dishArm.position.set(-bodyWidth * 0.3, deckTop + dishArmHeight / 2, -bodyDepth * 0.15)
        this.bodyGroup.add(dishArm)

        const dishRadius = 0.13
        const dish = new THREE.Mesh(
            new THREE.CylinderGeometry(dishRadius, dishRadius, 0.015, 12),
            bodyMat,
        )
        dish.position.set(dishArm.position.x, deckTop + dishArmHeight + 0.01, dishArm.position.z)
        dish.rotation.x = -0.2
        dish.rotation.z = 0.15
        this.bodyGroup.add(dish)

        // === Robot Arm (simplified 2-segment, semi-folded) ===
        const armThick = 0.035
        const arm1Len = 0.3
        const arm1 = new THREE.Mesh(
            new THREE.BoxGeometry(armThick, armThick, arm1Len),
            armMat,
        )
        const armBaseY = body.position.y + bodyHeight * 0.15
        arm1.position.set(bodyWidth * 0.2, armBaseY, bodyDepth / 2 + arm1Len / 2)
        this.bodyGroup.add(arm1)

        const arm2Len = 0.2
        const arm2 = new THREE.Mesh(
            new THREE.BoxGeometry(armThick, armThick, arm2Len),
            armMat,
        )
        arm2.position.set(arm1.position.x, armBaseY - 0.06, arm1.position.z + arm1Len / 2 + arm2Len / 2 - 0.02)
        arm2.rotation.x = 0.15
        this.bodyGroup.add(arm2)

        // Arm turret / sample drill
        const turret = new THREE.Mesh(
            new THREE.BoxGeometry(0.05, 0.05, 0.05),
            mastMat,
        )
        turret.position.set(arm2.position.x, arm2.position.y - 0.02, arm2.position.z + arm2Len / 2 + 0.02)
        this.bodyGroup.add(turret)

        // === RTG (Radioisotope Thermoelectric Generator) at rear ===
        const rtgRadius = 0.055
        const rtgLen = 0.28
        const rtg = new THREE.Mesh(
            new THREE.CylinderGeometry(rtgRadius, rtgRadius * 0.8, rtgLen, 8),
            antennaMat,
        )
        rtg.rotation.x = Math.PI / 2
        rtg.position.set(0, body.position.y + bodyHeight * 0.25, -bodyDepth / 2 - rtgLen / 2 + 0.05)
        this.bodyGroup.add(rtg)

        // RTG fin (vertical heat-dissipation fin)
        const fin = new THREE.Mesh(
            new THREE.BoxGeometry(0.015, 0.1, rtgLen * 0.7),
            antennaMat,
        )
        fin.position.copy(rtg.position)
        this.bodyGroup.add(fin)

        // === Suspension Arms (rocker-bogie inspired) ===
        const wheelY = -o.suspensionRestLength
        const bodyBottom = body.position.y - bodyHeight / 2

        for (const side of [-1, 1]) {
            for (const wheelZ of [o.wheelFrontZ, o.wheelBackZ]) {
                const sx = side * bodyWidth / 2
                const sy = bodyBottom
                const sz = 0
                const ex = side * o.wheelOffsetX
                const ey = wheelY
                const ez = wheelZ

                const dx = ex - sx, dy = ey - sy, dz = ez - sz
                const len = Math.sqrt(dx * dx + dy * dy + dz * dz)

                const arm = new THREE.Mesh(
                    new THREE.BoxGeometry(0.03, 0.04, len),
                    armMat,
                )
                arm.position.set((sx + ex) / 2, (sy + ey) / 2, (sz + ez) / 2)

                const dir = new THREE.Vector3(dx, dy, dz).normalize()
                arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir)

                this.bodyGroup.add(arm)
            }
        }

        // === UHF Antenna (spring physics) ===
        this.antennaPivot = new THREE.Object3D()
        this.antennaPivot.position.set(
            bodyWidth * 0.3,
            deckTop,
            -bodyDepth * 0.2,
        )

        const uhfAntenna = new THREE.Mesh(
            new THREE.CylinderGeometry(0.01, 0.01, 0.4, 4),
            antennaMat,
        )
        uhfAntenna.position.y = 0.2

        const uhfTip = new THREE.Mesh(
            new THREE.SphereGeometry(0.025, 6, 4),
            antennaMat,
        )
        uhfTip.position.y = 0.4

        this.antennaPivot.add(uhfAntenna, uhfTip)
        this.bodyGroup.add(this.antennaPivot)

        this.container.add(this.bodyGroup)

        // === Wheels (synced individually to physics) ===
        const wheelGeo = new THREE.CylinderGeometry(
            o.wheelRadius, o.wheelRadius,
            o.wheelHalfWidth * 2, 12,
        )
        wheelGeo.rotateZ(Math.PI / 2)

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
