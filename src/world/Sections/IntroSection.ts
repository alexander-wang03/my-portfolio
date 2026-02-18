import * as THREE from 'three'
import type Objects from '../Objects'
import type Terrain from '../Terrain'
import { createMatcapMaterial, loadMatcapTexture } from '../Materials/Matcap'
import BlockLetters from './BlockLetters'

export interface IntroSectionOptions {
    objects: Objects
    terrain: Terrain
    x: number
    z: number
}

export default class IntroSection {
    container: THREE.Object3D

    constructor(options: IntroSectionOptions) {
        this.container = new THREE.Object3D()

        const blockLetters = new BlockLetters(options)
        this.container.add(blockLetters.container)

        this.createPushableBlocks(options)
    }

    private createPushableBlocks(options: IntroSectionOptions): void {
        const metalTex = loadMatcapTexture('metal')
        const blockSize = 0.4
        const blockGeo = new THREE.BoxGeometry(blockSize, blockSize, blockSize)

        const colors = ['#ffffff', '#ffdd40', '#ff3030', '#d0d0d8', '#555560', '#ff9043']

        for (let i = 0; i < colors.length; i++) {
            const mat = createMatcapMaterial({
                matcapTexture: metalTex,
                color: new THREE.Color(colors[i]),
                indirect: 0,
            })

            const mesh = new THREE.Mesh(blockGeo, mat)

            // Scatter around the letters in a semi-circle
            const angle = ((i / colors.length) * Math.PI) - Math.PI / 2
            const radius = 2.5 + Math.random() * 1.5
            const bx = options.x + Math.cos(angle) * radius
            const bz = options.z - 8 + Math.sin(angle) * radius
            const by = options.terrain.getHeightAt(bx, bz) + blockSize / 2 + 0.5

            options.objects.add({
                mesh,
                position: new THREE.Vector3(bx, by, bz),
                mass: 1.5,
                restitution: 0.3,
                shadow: { sizeX: 0.5, sizeZ: 0.5 },
            })
        }
    }
}
