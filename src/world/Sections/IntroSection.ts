import * as THREE from 'three'
import type Objects from '../Objects'
import type Terrain from '../Terrain'
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
    }
}
