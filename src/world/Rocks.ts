import * as THREE from 'three'
import type Terrain from './Terrain'
import type Objects from './Objects'
import { createMatcapMaterial, loadMatcapTexture } from './Materials/Matcap'

export interface RocksOptions {
    terrain: Terrain
    objects: Objects
}

/** Seeded pseudo-random for deterministic placement */
function seededRandom(seed: number): () => number {
    let s = seed
    return () => {
        s = (s * 16807 + 0) % 2147483647
        return (s - 1) / 2147483646
    }
}

/** Displace vertices of a geometry to create an organic rock shape */
function deformRock(geo: THREE.BufferGeometry, strength: number, rand: () => number): void {
    const pos = geo.attributes.position as THREE.BufferAttribute
    const normal = geo.attributes.normal as THREE.BufferAttribute

    // Build unique vertex map (icosahedron shares positions at seams)
    // We'll deform based on direction from center for consistency
    const offsets = new Map<string, number>()

    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i)
        const y = pos.getY(i)
        const z = pos.getZ(i)
        const key = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`

        let offset: number
        if (offsets.has(key)) {
            offset = offsets.get(key)!
        } else {
            // Combine multiple noise-like offsets for varied shape
            offset = (rand() - 0.5) * 2 * strength
            // Flatten bottom slightly (rocks sit on ground)
            if (y < -0.2) offset -= strength * 0.3
            offsets.set(key, offset)
        }

        const nx = normal.getX(i)
        const ny = normal.getY(i)
        const nz = normal.getZ(i)
        pos.setXYZ(i, x + nx * offset, y + ny * offset, z + nz * offset)
    }

    pos.needsUpdate = true
    geo.computeVertexNormals()
}

/** Create a flat slab rock geometry (Mars sedimentary rock) */
function createSlabGeometry(rand: () => number): THREE.BufferGeometry {
    const w = 0.8 + rand() * 0.6
    const h = 0.15 + rand() * 0.15
    const d = 0.6 + rand() * 0.5
    const geo = new THREE.BoxGeometry(w, h, d, 3, 2, 3)

    // Slightly deform edges for organic look
    const pos = geo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i)
        const y = pos.getY(i)
        const z = pos.getZ(i)
        pos.setXYZ(
            i,
            x + (rand() - 0.5) * 0.08,
            y + (rand() - 0.5) * 0.04,
            z + (rand() - 0.5) * 0.08,
        )
    }
    pos.needsUpdate = true
    geo.computeVertexNormals()
    return geo
}

/** Create a tall narrow pillar rock (Mars hoodoo/ventifact) */
function createPillarGeometry(rand: () => number): THREE.BufferGeometry {
    const radiusBottom = 0.2 + rand() * 0.15
    const radiusTop = 0.1 + rand() * 0.15
    const height = 0.8 + rand() * 1.0
    const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 7, 4)

    const pos = geo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i)
        const y = pos.getY(i)
        const z = pos.getZ(i)
        const dist = Math.sqrt(x * x + z * z)
        if (dist > 0.01) {
            const noiseScale = 0.12 + rand() * 0.08
            pos.setXYZ(
                i,
                x + (rand() - 0.5) * noiseScale,
                y + (rand() - 0.5) * 0.05,
                z + (rand() - 0.5) * noiseScale,
            )
        }
    }
    pos.needsUpdate = true
    geo.computeVertexNormals()
    return geo
}

// Section centers and spawn area to avoid placing rocks on top of
const EXCLUSION_ZONES = [
    { x: 0, z: 0, r: 8 },     // Intro/spawn
    { x: 25, z: 0, r: 12 },   // Projects
    { x: 0, z: -25, r: 12 },  // Experience
    { x: -25, z: 0, r: 10 },  // Skills
    { x: 0, z: 25, r: 10 },   // Contact
]

function isInExclusionZone(x: number, z: number): boolean {
    for (const zone of EXCLUSION_ZONES) {
        const dx = x - zone.x
        const dz = z - zone.z
        if (dx * dx + dz * dz < zone.r * zone.r) return true
    }
    return false
}

export default class Rocks {
    container: THREE.Object3D

    constructor(options: RocksOptions) {
        this.container = new THREE.Object3D()

        const metalTex = loadMatcapTexture('metal')
        const rand = seededRandom(42)

        // Mars rock color palette — dark browns, rust, dusty tan
        const rockColors = [
            '#5c3a24', // dark brown
            '#6b4430', // medium brown
            '#7a5038', // warm brown
            '#4a2e1c', // very dark brown
            '#8c6040', // sandy brown
            '#684030', // rust brown
        ]

        const makeMat = (colorIdx: number) => createMatcapMaterial({
            matcapTexture: metalTex,
            color: new THREE.Color(rockColors[colorIdx % rockColors.length]),
            indirect: 0,
        })

        // --- Large boulders (detail 2 icosahedron, heavily deformed) ---
        const largeCount = 18
        for (let i = 0; i < largeCount; i++) {
            const scale = 1.2 + rand() * 2.0
            const geo = new THREE.IcosahedronGeometry(1, 2)
            deformRock(geo, 0.25, rand)
            geo.scale(scale, scale * (0.5 + rand() * 0.5), scale)

            const mesh = new THREE.Mesh(geo, makeMat(i))

            // Place in a wide ring (15–70 from center)
            const angle = rand() * Math.PI * 2
            const dist = 15 + rand() * 55
            const rx = Math.cos(angle) * dist
            const rz = Math.sin(angle) * dist

            if (isInExclusionZone(rx, rz)) continue

            const terrainY = options.terrain.getHeightAt(rx, rz)

            // Static physics collider so rover bounces off
            options.objects.add({
                mesh,
                position: new THREE.Vector3(rx, terrainY + scale * 0.3, rz),
                rotation: new THREE.Euler(
                    (rand() - 0.5) * 0.3,
                    rand() * Math.PI * 2,
                    (rand() - 0.5) * 0.2,
                ),
                mass: 0,
                useConvexHull: true,
                shadow: { sizeX: scale * 2, sizeZ: scale * 2 },
            })
        }

        // --- Medium rocks (detail 1 icosahedron) ---
        const medCount = 40
        for (let i = 0; i < medCount; i++) {
            const scale = 0.4 + rand() * 0.8
            const geo = new THREE.IcosahedronGeometry(1, 1)
            deformRock(geo, 0.2, rand)
            geo.scale(scale, scale * (0.4 + rand() * 0.6), scale)

            const mesh = new THREE.Mesh(geo, makeMat(i))

            const angle = rand() * Math.PI * 2
            const dist = 5 + rand() * 70
            const rx = Math.cos(angle) * dist
            const rz = Math.sin(angle) * dist

            if (isInExclusionZone(rx, rz)) continue

            const terrainY = options.terrain.getHeightAt(rx, rz)

            options.objects.add({
                mesh,
                position: new THREE.Vector3(rx, terrainY + scale * 0.25, rz),
                rotation: new THREE.Euler(
                    (rand() - 0.5) * 0.4,
                    rand() * Math.PI * 2,
                    (rand() - 0.5) * 0.3,
                ),
                mass: 0,
                useConvexHull: true,
                shadow: { sizeX: scale * 1.5, sizeZ: scale * 1.5 },
            })
        }

        // --- Small pebbles (detail 0 icosahedron, no physics) ---
        const pebbleCount = 80
        const pebbleGeo = new THREE.IcosahedronGeometry(1, 0)
        for (let i = 0; i < pebbleCount; i++) {
            const scale = 0.08 + rand() * 0.2
            const clonedGeo = pebbleGeo.clone()
            deformRock(clonedGeo, 0.15, rand)
            clonedGeo.scale(scale, scale * (0.3 + rand() * 0.7), scale)

            const mesh = new THREE.Mesh(clonedGeo, makeMat(i))

            const angle = rand() * Math.PI * 2
            const dist = 3 + rand() * 72
            const rx = Math.cos(angle) * dist
            const rz = Math.sin(angle) * dist

            if (isInExclusionZone(rx, rz)) continue

            const terrainY = options.terrain.getHeightAt(rx, rz)
            mesh.position.set(rx, terrainY + scale * 0.2, rz)
            mesh.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI)
            this.container.add(mesh)
        }

        // --- Flat slabs (Mars sedimentary rock) ---
        const slabCount = 12
        for (let i = 0; i < slabCount; i++) {
            const geo = createSlabGeometry(rand)
            const scale = 0.8 + rand() * 1.5
            geo.scale(scale, scale, scale)

            const mesh = new THREE.Mesh(geo, makeMat(i + 3))

            const angle = rand() * Math.PI * 2
            const dist = 10 + rand() * 60
            const rx = Math.cos(angle) * dist
            const rz = Math.sin(angle) * dist

            if (isInExclusionZone(rx, rz)) continue

            const terrainY = options.terrain.getHeightAt(rx, rz)

            options.objects.add({
                mesh,
                position: new THREE.Vector3(rx, terrainY + 0.08 * scale, rz),
                rotation: new THREE.Euler(
                    (rand() - 0.5) * 0.1,
                    rand() * Math.PI * 2,
                    (rand() - 0.5) * 0.1,
                ),
                mass: 0,
                useConvexHull: true,
                shadow: { sizeX: scale * 1.8, sizeZ: scale * 1.2 },
            })
        }

        // --- Tall pillar rocks (ventifacts / hoodoos) ---
        const pillarCount = 8
        for (let i = 0; i < pillarCount; i++) {
            const geo = createPillarGeometry(rand)
            const scale = 1.0 + rand() * 1.5
            geo.scale(scale, scale, scale)

            const mesh = new THREE.Mesh(geo, makeMat(i + 1))

            const angle = rand() * Math.PI * 2
            const dist = 20 + rand() * 50
            const rx = Math.cos(angle) * dist
            const rz = Math.sin(angle) * dist

            if (isInExclusionZone(rx, rz)) continue

            const terrainY = options.terrain.getHeightAt(rx, rz)

            options.objects.add({
                mesh,
                position: new THREE.Vector3(rx, terrainY + 0.1, rz),
                rotation: new THREE.Euler(
                    (rand() - 0.5) * 0.15,
                    rand() * Math.PI * 2,
                    (rand() - 0.5) * 0.15,
                ),
                mass: 0,
                useConvexHull: true,
                shadow: { sizeX: scale * 1.2, sizeZ: scale * 1.2 },
            })
        }

        // --- Rock clusters (groups of 3-5 rocks together) ---
        const clusterCount = 10
        for (let c = 0; c < clusterCount; c++) {
            const clusterAngle = rand() * Math.PI * 2
            const clusterDist = 12 + rand() * 55
            const cx = Math.cos(clusterAngle) * clusterDist
            const cz = Math.sin(clusterAngle) * clusterDist

            if (isInExclusionZone(cx, cz)) continue

            const rocksInCluster = 3 + Math.floor(rand() * 3)
            for (let j = 0; j < rocksInCluster; j++) {
                const scale = 0.3 + rand() * 0.6
                const geo = new THREE.IcosahedronGeometry(1, 1)
                deformRock(geo, 0.22, rand)
                geo.scale(scale, scale * (0.4 + rand() * 0.6), scale)

                const mesh = new THREE.Mesh(geo, makeMat(c + j))

                const offsetAngle = rand() * Math.PI * 2
                const offsetDist = rand() * 2.5
                const rx = cx + Math.cos(offsetAngle) * offsetDist
                const rz = cz + Math.sin(offsetAngle) * offsetDist
                const terrainY = options.terrain.getHeightAt(rx, rz)

                options.objects.add({
                    mesh,
                    position: new THREE.Vector3(rx, terrainY + scale * 0.25, rz),
                    rotation: new THREE.Euler(
                        (rand() - 0.5) * 0.5,
                        rand() * Math.PI * 2,
                        (rand() - 0.5) * 0.4,
                    ),
                    mass: 0,
                    useConvexHull: true,
                    shadow: { sizeX: scale * 1.5, sizeZ: scale * 1.5 },
                })
            }
        }
    }
}
