import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import type Time from '../engine/Utils/Time'
import type Physics from './Physics'
import type Shadows from './Shadows'

export interface ObjectAddOptions {
    mesh: THREE.Object3D
    position: THREE.Vector3
    rotation?: THREE.Euler
    mass: number
    colliderDesc?: RAPIER.ColliderDesc
    restitution?: number
    useConvexHull?: boolean
    shadow?: { sizeX: number; sizeZ: number; shape?: 'ellipse' | 'box' }
    startAsleep?: boolean
}

export interface PhysicsObject {
    mesh: THREE.Object3D
    body: RAPIER.RigidBody
}

export default class Objects {
    container: THREE.Object3D
    items: PhysicsObject[]
    private physics: Physics
    private shadows?: Shadows

    constructor(options: { time: Time; physics: Physics; shadows?: Shadows }) {
        this.container = new THREE.Object3D()
        this.items = []
        this.physics = options.physics
        this.shadows = options.shadows

        // Sync dynamic objects each tick
        options.time.on('tick', () => {
            for (const item of this.items) {
                if (item.body.isDynamic()) {
                    const pos = item.body.translation()
                    const rot = item.body.rotation()
                    item.mesh.position.set(pos.x, pos.y, pos.z)
                    item.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w)
                }
            }
        })
    }

    add(options: ObjectAddOptions): PhysicsObject {
        const mesh = options.mesh
        mesh.position.copy(options.position)
        if (options.rotation) mesh.rotation.copy(options.rotation)
        this.container.add(mesh)

        // Create rigid body
        const bodyDesc = options.mass > 0
            ? RAPIER.RigidBodyDesc.dynamic().setTranslation(
                  options.position.x,
                  options.position.y,
                  options.position.z,
              )
            : RAPIER.RigidBodyDesc.fixed().setTranslation(
                  options.position.x,
                  options.position.y,
                  options.position.z,
              )

        if (options.rotation) {
            const quat = new THREE.Quaternion().setFromEuler(options.rotation)
            bodyDesc.setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
        }

        const body = this.physics.world.createRigidBody(bodyDesc)

        // Create collider
        let colliderDesc = options.colliderDesc
        if (!colliderDesc) {
            if (options.useConvexHull && mesh instanceof THREE.Mesh && mesh.geometry) {
                // Convex hull from geometry vertices — fits organic shapes much better
                const points = new Float32Array(mesh.geometry.attributes.position.array)
                const hull = RAPIER.ColliderDesc.convexHull(points)
                colliderDesc = hull ?? this.cuboidFromGeometry(mesh)
            } else if (mesh instanceof THREE.Mesh && mesh.geometry) {
                // Cuboid from geometry bounds (ignores mesh rotation, avoids inflated AABB)
                colliderDesc = this.cuboidFromGeometry(mesh)
            } else {
                const box = new THREE.Box3().setFromObject(mesh)
                const size = box.getSize(new THREE.Vector3())
                colliderDesc = RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
            }
        }

        if (options.mass > 0) colliderDesc.setMass(options.mass)
        if (options.restitution != null) colliderDesc.setRestitution(options.restitution)

        this.physics.world.createCollider(colliderDesc, body)

        if (options.startAsleep) {
            body.sleep()
        }

        const item: PhysicsObject = { mesh, body }
        this.items.push(item)

        if (options.shadow && this.shadows) {
            this.shadows.add(mesh, options.shadow)
        }

        return item
    }

    private cuboidFromGeometry(mesh: THREE.Mesh): RAPIER.ColliderDesc {
        mesh.geometry.computeBoundingBox()
        const size = mesh.geometry.boundingBox!.getSize(new THREE.Vector3())
        return RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
    }
}
