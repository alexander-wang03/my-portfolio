import * as THREE from 'three'
import type Time from '../engine/Utils/Time'
import type Physics from './Physics'
import Zone, { type ZoneOptions } from './Zone'

export interface ZonesOptions {
    time: Time
    physics: Physics
    config: { debug: boolean }
}

export default class Zones {
    container: THREE.Object3D
    items: Zone[]

    constructor(options: ZonesOptions) {
        this.container = new THREE.Object3D()
        this.container.visible = options.config.debug
        this.items = []

        options.time.on('tick', () => {
            const pos = options.physics.chassisPosition
            for (const zone of this.items) {
                zone.test(pos.x, pos.z)
            }
        })
    }

    add(options: ZoneOptions): Zone {
        const zone = new Zone(options)
        if (this.container.visible) zone.mesh.visible = true
        this.container.add(zone.mesh)
        this.items.push(zone)
        return zone
    }
}
