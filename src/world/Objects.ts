import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import type Time from '../engine/Utils/Time'
import type Physics from './Physics'
import type Shadows from './Shadows'
import type { ImpactMaterial } from './Physics'

export interface ObjectAddOptions {
    mesh: THREE.Object3D
    position: THREE.Vector3
    rotation?: THREE.Euler
    mass: number
    colliderDesc?: RAPIER.ColliderDesc
    restitution?: number
    useConvexHull?: boolean
    /** Give the convex hull a flat base — see `pointsWithFlatBase`. */
    flatBase?: boolean
    shadow?: { sizeX: number; sizeZ: number; shape?: 'ellipse' | 'box' }
    /** Voice used when this object is struck. Defaults to the generic thud. */
    impactSound?: ImpactMaterial
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
                const points = options.flatBase
                    ? this.pointsWithFlatBase(mesh.geometry)
                    : new Float32Array(mesh.geometry.attributes.position.array)
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

        if (options.mass > 0) {
            colliderDesc.setMass(options.mass)

            // Loose objects report their own impacts, so knocking a letter over
            // is audible. Static scenery does not need the flag — an event
            // fires when either side of the pair has it, and the rover does.
            //
            // Scaled to the object's own weight (mass * gravity is mass * 13),
            // so this sits at roughly 15x what it exerts just sitting there.
            // Lower than that and a prop tumbling across the faceted terrain
            // clears the bar on every facet edge, turning one roll into a
            // stream of strikes.
            colliderDesc
                .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
                .setContactForceEventThreshold(options.mass * 200)
        }
        if (options.restitution != null) colliderDesc.setRestitution(options.restitution)

        const collider = this.physics.world.createCollider(colliderDesc, body)

        if (options.impactSound) {
            this.physics.setImpactMaterial(collider, options.impactSound)
        }

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

    /**
     * Geometry vertices plus the four bottom corners of the bounding box, so
     * the resulting convex hull gains a flat rectangular base at the lowest
     * point of the shape.
     *
     * Glyphs with rounded feet (G, O, S) otherwise end in a curve, so the hull
     * touches the ground along a tangent line and rolls over on any incline —
     * while the flat-footed letters beside it stand fine. The silhouette above
     * the base is untouched.
     */
    private pointsWithFlatBase(geometry: THREE.BufferGeometry): Float32Array {
        geometry.computeBoundingBox()
        const bb = geometry.boundingBox!

        const source = geometry.attributes.position.array
        const points = new Float32Array(source.length + 4 * 3)
        points.set(source)

        const corners = [
            [bb.min.x, bb.min.y, bb.min.z],
            [bb.max.x, bb.min.y, bb.min.z],
            [bb.min.x, bb.min.y, bb.max.z],
            [bb.max.x, bb.min.y, bb.max.z],
        ]
        corners.forEach((corner, i) => points.set(corner, source.length + i * 3))

        return points
    }

    private cuboidFromGeometry(mesh: THREE.Mesh): RAPIER.ColliderDesc {
        mesh.geometry.computeBoundingBox()
        const size = mesh.geometry.boundingBox!.getSize(new THREE.Vector3())
        return RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
    }
}
