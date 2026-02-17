import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import MarsSurface from './Materials/MarsSurface'

export interface TerrainOptions {
    size: number
    segments: number
    heightScale: number
    sunDirection?: THREE.Vector3
    heightData?: Float32Array // pre-computed normalized [0,1] heights
}

export default class Terrain {
    container: THREE.Object3D
    mesh!: THREE.Mesh
    heightData: Float32Array
    size: number
    segments: number
    heightScale: number
    heightMap!: THREE.DataTexture

    constructor(options: TerrainOptions) {
        this.container = new THREE.Object3D()
        this.size = options.size
        this.segments = options.segments
        this.heightScale = options.heightScale
        this.heightData = options.heightData ?? new Float32Array((this.segments + 1) * (this.segments + 1))

        if (!options.heightData) {
            this.generateHeightmap()
        }

        this.createDataTexture()
        this.createMesh(options.sunDirection)
    }

    /**
     * Load terrain from a binary STL file.
     * Converts Z-up (Blender) to Y-up (Three.js), scales to fit terrain size,
     * and samples the mesh onto a regular heightmap grid.
     */
    static async fromSTL(
        url: string,
        size: number,
        segments: number,
        sunDirection?: THREE.Vector3,
    ): Promise<Terrain> {
        const loader = new STLLoader()
        const stlGeom = await loader.loadAsync(url)

        // Convert from Z-up (Blender) to Y-up (Three.js)
        stlGeom.rotateX(-Math.PI / 2)

        stlGeom.computeBoundingBox()
        const bbox = stlGeom.boundingBox!
        const stlSize = new THREE.Vector3()
        bbox.getSize(stlSize)
        const stlCenter = new THREE.Vector3()
        bbox.getCenter(stlCenter)

        // Scale uniformly to fit terrain size
        const scale = size / Math.max(stlSize.x, stlSize.z)

        // Center and scale vertex positions
        const posArr = stlGeom.attributes.position.array as Float32Array
        const vertCount = posArr.length / 3
        for (let i = 0; i < vertCount; i++) {
            const i3 = i * 3
            posArr[i3] = (posArr[i3] - stlCenter.x) * scale
            posArr[i3 + 1] = (posArr[i3 + 1] - stlCenter.y) * scale
            posArr[i3 + 2] = (posArr[i3 + 2] - stlCenter.z) * scale
        }

        // Sample STL triangles onto regular heightmap grid
        const res = segments + 1
        const { heightData, heightScale } = Terrain.sampleSTLToGrid(posArr, size, res)

        return new Terrain({ size, segments, heightScale: heightScale * 0.5, sunDirection, heightData })
    }

    /**
     * Rasterize STL triangle mesh onto a regular grid using a spatial hash
     * and barycentric interpolation for height sampling.
     */
    private static sampleSTLToGrid(
        positions: Float32Array,
        terrainSize: number,
        res: number,
    ): { heightData: Float32Array; heightScale: number } {
        const triCount = positions.length / 9
        const halfSize = terrainSize / 2
        const step = terrainSize / (res - 1)

        // Build 2D spatial hash of triangles by their XZ bounding box
        const BUCKET_RES = 64
        const buckets: number[][] = []
        for (let i = 0; i < BUCKET_RES * BUCKET_RES; i++) buckets.push([])

        for (let t = 0; t < triCount; t++) {
            const base = t * 9
            const x0 = positions[base], z0 = positions[base + 2]
            const x1 = positions[base + 3], z1 = positions[base + 5]
            const x2 = positions[base + 6], z2 = positions[base + 8]

            const minX = Math.min(x0, x1, x2)
            const maxX = Math.max(x0, x1, x2)
            const minZ = Math.min(z0, z1, z2)
            const maxZ = Math.max(z0, z1, z2)

            const bMinX = Math.max(0, Math.floor((minX / terrainSize + 0.5) * BUCKET_RES))
            const bMaxX = Math.min(BUCKET_RES - 1, Math.floor((maxX / terrainSize + 0.5) * BUCKET_RES))
            const bMinZ = Math.max(0, Math.floor((minZ / terrainSize + 0.5) * BUCKET_RES))
            const bMaxZ = Math.min(BUCKET_RES - 1, Math.floor((maxZ / terrainSize + 0.5) * BUCKET_RES))

            for (let bz = bMinZ; bz <= bMaxZ; bz++) {
                for (let bx = bMinX; bx <= bMaxX; bx++) {
                    buckets[bz * BUCKET_RES + bx].push(t)
                }
            }
        }

        // Sample height at each grid point via barycentric interpolation
        const heightData = new Float32Array(res * res)
        const covered = new Uint8Array(res * res)
        let minH = Infinity
        let maxH = -Infinity

        for (let j = 0; j < res; j++) {
            for (let i = 0; i < res; i++) {
                const x = -halfSize + i * step
                const z = -halfSize + j * step

                const bx = Math.min(
                    BUCKET_RES - 1,
                    Math.max(0, Math.floor((x / terrainSize + 0.5) * BUCKET_RES)),
                )
                const bz = Math.min(
                    BUCKET_RES - 1,
                    Math.max(0, Math.floor((z / terrainSize + 0.5) * BUCKET_RES)),
                )

                const idx = j * res + i

                for (const t of buckets[bz * BUCKET_RES + bx]) {
                    const base = t * 9
                    const ax = positions[base], ay = positions[base + 1], az = positions[base + 2]
                    const bx2 = positions[base + 3], by = positions[base + 4], bz2 = positions[base + 5]
                    const cx = positions[base + 6], cy = positions[base + 7], cz = positions[base + 8]

                    // Barycentric coordinates in XZ plane
                    const v0x = cx - ax, v0z = cz - az
                    const v1x = bx2 - ax, v1z = bz2 - az
                    const v2x = x - ax, v2z = z - az

                    const dot00 = v0x * v0x + v0z * v0z
                    const dot01 = v0x * v1x + v0z * v1z
                    const dot02 = v0x * v2x + v0z * v2z
                    const dot11 = v1x * v1x + v1z * v1z
                    const dot12 = v1x * v2x + v1z * v2z

                    const denom = dot00 * dot11 - dot01 * dot01
                    if (Math.abs(denom) < 1e-10) continue // degenerate triangle

                    const inv = 1 / denom
                    const u = (dot11 * dot02 - dot01 * dot12) * inv
                    const v = (dot00 * dot12 - dot01 * dot02) * inv

                    if (u >= -0.001 && v >= -0.001 && u + v <= 1.001) {
                        const height = (1 - u - v) * ay + v * by + u * cy
                        heightData[idx] = height
                        covered[idx] = 1
                        if (height < minH) minH = height
                        if (height > maxH) maxH = height
                        break
                    }
                }
            }
        }

        // Gap-fill uncovered cells with iterative neighbor averaging
        let uncoveredCount = 0
        for (let i = 0; i < covered.length; i++) {
            if (!covered[i]) uncoveredCount++
        }

        if (uncoveredCount > 0) {
            for (let pass = 0; pass < 20 && uncoveredCount > 0; pass++) {
                const temp = new Float32Array(heightData)
                for (let j = 0; j < res; j++) {
                    for (let i = 0; i < res; i++) {
                        const idx = j * res + i
                        if (covered[idx]) continue

                        let sum = 0
                        let count = 0
                        for (let dj = -1; dj <= 1; dj++) {
                            for (let di = -1; di <= 1; di++) {
                                if (di === 0 && dj === 0) continue
                                const ni = i + di
                                const nj = j + dj
                                if (ni < 0 || ni >= res || nj < 0 || nj >= res) continue
                                if (covered[nj * res + ni]) {
                                    sum += heightData[nj * res + ni]
                                    count++
                                }
                            }
                        }
                        if (count > 0) {
                            temp[idx] = sum / count
                            covered[idx] = 1
                            uncoveredCount--
                        }
                    }
                }
                heightData.set(temp)
            }
        }

        // Fallback if STL had no usable coverage
        if (minH === Infinity) {
            return { heightData: new Float32Array(res * res), heightScale: 1 }
        }

        // Include gap-filled cells in min/max
        for (let i = 0; i < heightData.length; i++) {
            if (heightData[i] < minH) minH = heightData[i]
            if (heightData[i] > maxH) maxH = heightData[i]
        }

        // Normalize to [0, 1]
        const range = maxH - minH || 1
        for (let i = 0; i < heightData.length; i++) {
            heightData[i] = (heightData[i] - minH) / range
        }

        return { heightData, heightScale: range }
    }

    private createDataTexture(): void {
        const res = this.segments + 1
        const textureData = new Uint8Array(res * res)
        for (let i = 0; i < this.heightData.length; i++) {
            textureData[i] = Math.floor(this.heightData[i] * 255)
        }

        this.heightMap = new THREE.DataTexture(
            textureData,
            res,
            res,
            THREE.RedFormat,
        )
        this.heightMap.magFilter = THREE.LinearFilter
        this.heightMap.minFilter = THREE.LinearFilter
        this.heightMap.needsUpdate = true
    }

    private generateHeightmap(): void {
        const res = this.segments + 1

        let minH = Infinity
        let maxH = -Infinity

        // First pass: generate raw heights
        const rawHeights = new Float32Array(res * res)

        for (let j = 0; j < res; j++) {
            for (let i = 0; i < res; i++) {
                const x = i / res
                const y = j / res

                let height = 0

                // Large rolling hills (broad undulation)
                height += this.noise(x * 2.5, y * 2.5) * 0.5
                height += this.noise(x * 5 + 5.3, y * 5 + 2.7) * 0.3

                // Medium terrain features
                height += this.noise(x * 10 + 1.7, y * 10 + 8.3) * 0.15
                height += this.noise(x * 20 + 3.1, y * 20 + 6.9) * 0.08

                // Fine surface roughness
                height += this.noise(x * 40 + 7.2, y * 40 + 4.1) * 0.04
                height += this.noise(x * 80 + 2.9, y * 80 + 9.5) * 0.02

                // Large craters (prominent features)
                height += this.crater(x, y, 0.25, 0.30, 0.10, 0.15)
                height += this.crater(x, y, 0.60, 0.70, 0.14, 0.20)
                height += this.crater(x, y, 0.75, 0.25, 0.11, 0.16)
                height += this.crater(x, y, 0.15, 0.75, 0.09, 0.12)
                height += this.crater(x, y, 0.35, 0.85, 0.12, 0.18)

                // Medium craters
                height += this.crater(x, y, 0.40, 0.55, 0.06, 0.08)
                height += this.crater(x, y, 0.85, 0.50, 0.05, 0.07)
                height += this.crater(x, y, 0.50, 0.15, 0.05, 0.06)
                height += this.crater(x, y, 0.20, 0.50, 0.04, 0.05)
                height += this.crater(x, y, 0.70, 0.45, 0.045, 0.06)
                height += this.crater(x, y, 0.55, 0.40, 0.035, 0.04)

                // Small craters scattered (kept away from center spawn zone)
                for (let c = 0; c < 25; c++) {
                    const cx = this.hash(c * 2) * 0.85 + 0.075
                    const cy = this.hash(c * 2 + 1) * 0.85 + 0.075
                    const craterDistFromCenter = Math.sqrt((cx - 0.5) ** 2 + (cy - 0.5) ** 2)
                    if (craterDistFromCenter < 0.15) continue
                    const cr = 0.012 + this.hash(c * 2 + 50) * 0.03
                    const cd = cr * 1.2
                    height += this.crater(x, y, cx, cy, cr, cd)
                }

                // Flatten center area for rover starting zone (smooth Gaussian)
                const distFromCenter = Math.sqrt((x - 0.5) ** 2 + (y - 0.5) ** 2)
                const flattenFactor = Math.exp(-(distFromCenter * distFromCenter) / (2 * 0.05 * 0.05))
                height = height * (1 - flattenFactor * 0.8)

                rawHeights[j * res + i] = height

                if (height < minH) minH = height
                if (height > maxH) maxH = height
            }
        }

        // Second pass: normalize to 0-1 using actual range
        const range = maxH - minH || 1
        for (let i = 0; i < rawHeights.length; i++) {
            this.heightData[i] = (rawHeights[i] - minH) / range
        }

        // Third pass: light smooth at center to remove spike artifact only
        const centerI = Math.floor(res / 2)
        const centerJ = Math.floor(res / 2)
        const smoothRadius = Math.floor(res * 0.03)
        const smoothed = new Float32Array(this.heightData)
        for (let j = centerJ - smoothRadius; j <= centerJ + smoothRadius; j++) {
            for (let i = centerI - smoothRadius; i <= centerI + smoothRadius; i++) {
                if (i < 1 || i >= res - 1 || j < 1 || j >= res - 1) continue
                const di = i - centerI
                const dj = j - centerJ
                const dist = Math.sqrt(di * di + dj * dj) / smoothRadius
                if (dist > 1) continue

                // 3x3 average
                let sum = 0
                let count = 0
                for (let ddy = -1; ddy <= 1; ddy++) {
                    for (let ddx = -1; ddx <= 1; ddx++) {
                        sum += this.heightData[(j + ddy) * res + (i + ddx)]
                        count++
                    }
                }
                const avg = sum / count
                // Light blend: only 50% at dead center, tapering to 0
                const blend = (1 - dist) * 0.5
                smoothed[j * res + i] = this.heightData[j * res + i] * (1 - blend) + avg * blend
            }
        }
        this.heightData.set(smoothed)
    }

    private createMesh(sunDirection?: THREE.Vector3): void {
        const geometry = new THREE.PlaneGeometry(
            this.size,
            this.size,
            this.segments,
            this.segments,
        )

        // Rotate plane to be horizontal (XZ plane, Y-up)
        geometry.rotateX(-Math.PI / 2)

        // Bake heights directly into geometry vertex positions.
        // This guarantees the visual mesh exactly matches the physics heightfield,
        // since both read from the same Float32Array via getHeightAt().
        const posAttr = geometry.attributes.position
        for (let k = 0; k < posAttr.count; k++) {
            const x = posAttr.getX(k)
            const z = posAttr.getZ(k)
            posAttr.setY(k, this.getHeightAt(x, z))
        }
        posAttr.needsUpdate = true
        geometry.computeBoundingBox()
        geometry.computeBoundingSphere()

        const marsSurface = new MarsSurface({
            heightMap: this.heightMap,
            terrainSize: this.size,
            heightScale: this.heightScale,
            sunDirection,
        })

        this.mesh = new THREE.Mesh(geometry, marsSurface.material)
        this.container.add(this.mesh)
    }

    // Value noise with full 0-1 range
    private noise(x: number, y: number): number {
        const ix = Math.floor(x)
        const iy = Math.floor(y)
        const fx = x - ix
        const fy = y - iy

        // Quintic interpolation (smoother than cubic)
        const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10)
        const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10)

        const a = this.hash2d(ix, iy)
        const b = this.hash2d(ix + 1, iy)
        const c = this.hash2d(ix, iy + 1)
        const d = this.hash2d(ix + 1, iy + 1)

        return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy
    }

    // Full 0-1 range hash (offset inputs to avoid sin(0)=0 degeneracy)
    private hash2d(x: number, y: number): number {
        const n = Math.sin((x + 0.5) * 127.1 + (y + 0.7) * 311.7) * 43758.5453
        return n - Math.floor(n)
    }

    private hash(n: number): number {
        const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
        return x - Math.floor(x)
    }

    // Crater: circular depression with raised rim
    private crater(
        x: number,
        y: number,
        cx: number,
        cy: number,
        radius: number,
        depth: number,
    ): number {
        const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
        const normalizedDist = dist / radius

        if (normalizedDist > 2.5) return 0

        // Inner bowl (smooth parabolic depression)
        if (normalizedDist < 1.0) {
            const bowl = normalizedDist * normalizedDist
            return -depth * (1 - bowl)
        }

        // Outer rim (raised edge with gradual falloff)
        const rimDist = normalizedDist - 1.0
        const rim = Math.exp(-rimDist * rimDist * 5)
        return depth * 0.35 * rim
    }

    /** Get height at a world XZ coordinate (for placing objects later) */
    getHeightAt(worldX: number, worldZ: number): number {
        // Match the visual terrain UV convention:
        // PlaneGeometry rotated to XZ has u = X/size+0.5, v = 0.5 - Z/size
        // DataTexture (flipY=false): row j at v = j/(res-1)
        const u = (worldX / this.size) + 0.5
        const v = 0.5 - (worldZ / this.size)

        if (u < 0 || u > 1 || v < 0 || v > 1) return 0

        const res = this.segments + 1
        const ix = Math.min(Math.floor(u * (res - 1)), res - 2)
        const iy = Math.min(Math.floor(v * (res - 1)), res - 2)
        const fx = u * (res - 1) - ix
        const fy = v * (res - 1) - iy

        const h00 = this.heightData[iy * res + ix]
        const h10 = this.heightData[iy * res + ix + 1]
        const h01 = this.heightData[(iy + 1) * res + ix]
        const h11 = this.heightData[(iy + 1) * res + ix + 1]

        const h = h00 * (1 - fx) * (1 - fy) + h10 * fx * (1 - fy) +
                  h01 * (1 - fx) * fy + h11 * fx * fy

        return h * this.heightScale
    }
}
