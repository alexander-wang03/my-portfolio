import * as THREE from 'three'
import type Objects from '../Objects'
import type Terrain from '../Terrain'
import BlockLetters from './BlockLetters'
import Instructions from './Instructions'

export interface IntroSectionOptions {
    objects: Objects
    terrain: Terrain
    /** Show the touch control legend rather than the keyboard one. */
    touch: boolean
    x: number
    z: number
}

export default class IntroSection {
    container: THREE.Object3D

    constructor(options: IntroSectionOptions) {
        this.container = new THREE.Object3D()

        const blockLetters = new BlockLetters(options)
        this.container.add(blockLetters.container)

        // In front of the spawn point, between the rover and the default camera
        const instructions = new Instructions({
            terrain: options.terrain,
            touch: options.touch,
            x: options.x,
            z: options.z + 7,
        })
        this.container.add(instructions.container)
    }
}
