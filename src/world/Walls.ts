import * as THREE from 'three'
import type Objects from './Objects'
import type Terrain from './Terrain'
import { createMatcapMaterial, loadMatcapTexture } from './Materials/Matcap'

export interface WallsOptions {
    objects: Objects
    terrain: Terrain
}

export default class Walls {
    container: THREE.Object3D

    constructor(options: WallsOptions) {
        this.container = new THREE.Object3D()
        this.createBoundary(options)
    }

    private createBoundary(options: WallsOptions): void {
        const metalTex = loadMatcapTexture('metal')
        const wallMat = createMatcapMaterial({
            matcapTexture: metalTex,
            color: new THREE.Color('#8b5e3c'),
            indirect: 0,
        })

        // Octagonal boundary at radius ~75
        const radius = 75
        const segments = 8
        const wallLength = 2 * radius * Math.sin(Math.PI / segments)
        const wallHeight = 3.0
        const wallDepth = 1.5

        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2
            const nextAngle = ((i + 1) / segments) * Math.PI * 2

            // Midpoint of the wall segment
            const mx = (Math.cos(angle) + Math.cos(nextAngle)) * 0.5 * radius
            const mz = (Math.sin(angle) + Math.sin(nextAngle)) * 0.5 * radius
            const terrainY = options.terrain.getHeightAt(mx, mz)

            // Wall rotation to face inward
            const wallAngle = (angle + nextAngle) / 2 + Math.PI / 2

            // Create wall with size variation for organic feel
            const heightVar = 0.5 + Math.random() * 0.5
            const geo = new THREE.BoxGeometry(wallLength * 1.05, wallHeight * heightVar, wallDepth)
            const mesh = new THREE.Mesh(geo, wallMat)

            options.objects.add({
                mesh,
                position: new THREE.Vector3(mx, terrainY + (wallHeight * heightVar) / 2, mz),
                rotation: new THREE.Euler(0, wallAngle, 0),
                mass: 0,
            })
        }
    }
}
