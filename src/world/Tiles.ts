import * as THREE from 'three'
import type Terrain from './Terrain'
import { createMatcapMaterial, loadMatcapTexture } from './Materials/Matcap'

export interface TilesOptions {
    terrain: Terrain
}

interface TilePath {
    start: { x: number; z: number }
    end: { x: number; z: number }
}

export default class Tiles {
    container: THREE.Object3D

    constructor(options: TilesOptions) {
        this.container = new THREE.Object3D()
        this.createPaths(options)
    }

    private createPaths(options: TilesOptions): void {
        const paths: TilePath[] = [
            // Hub (0,0) → Projects (25, 0)
            { start: { x: 3, z: 0 }, end: { x: 22, z: 0 } },
            // Hub (0,0) → Experience (0, -25)
            { start: { x: 0, z: -3 }, end: { x: 0, z: -22 } },
            // Hub (0,0) → Skills (-25, 0)
            { start: { x: -3, z: 0 }, end: { x: -22, z: 0 } },
            // Hub (0,0) → Contact (0, 25)
            { start: { x: 0, z: 11 }, end: { x: 0, z: 22 } },
        ]

        const metalTex = loadMatcapTexture('metal')
        const tileMat = createMatcapMaterial({
            matcapTexture: metalTex,
            color: new THREE.Color('#d4a574'),
            indirect: 0,
        })

        const tileSize = 0.3
        const interDistance = 2.5

        // Diamond shape for tiles
        const shape = new THREE.Shape()
        shape.moveTo(0, tileSize)
        shape.lineTo(tileSize * 0.6, 0)
        shape.lineTo(0, -tileSize)
        shape.lineTo(-tileSize * 0.6, 0)
        shape.closePath()
        const tileGeo = new THREE.ExtrudeGeometry(shape, {
            depth: 0.04,
            bevelEnabled: false,
        })
        tileGeo.rotateX(-Math.PI / 2) // Lay flat (Y-up)

        for (const path of paths) {
            const dx = path.end.x - path.start.x
            const dz = path.end.z - path.start.z
            const dist = Math.sqrt(dx * dx + dz * dz)
            const count = Math.floor(dist / interDistance)

            if (count <= 0) continue

            const dirX = dx / dist
            const dirZ = dz / dist
            const angle = Math.atan2(dirX, dirZ)

            // Tangent for zigzag
            const tanX = -dirZ * 0.4
            const tanZ = dirX * 0.4

            for (let i = 0; i <= count; i++) {
                const t = i / count
                const baseX = path.start.x + dx * t
                const baseZ = path.start.z + dz * t

                // Alternating tangent offset for visual interest
                const sign = i % 2 === 0 ? 1 : -1
                const tx = baseX + tanX * sign + (Math.random() - 0.5) * 0.3
                const tz = baseZ + tanZ * sign + (Math.random() - 0.5) * 0.3

                const terrainY = options.terrain.getHeightAt(tx, tz)

                const tile = new THREE.Mesh(tileGeo, tileMat)
                tile.position.set(tx, terrainY + 0.02, tz)
                tile.rotation.y = angle + (Math.random() - 0.5) * 0.3
                this.container.add(tile)
            }
        }
    }
}
