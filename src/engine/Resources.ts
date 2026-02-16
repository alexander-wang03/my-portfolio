import Loader, { type ResourceDefinition } from './Utils/Loader'
import EventEmitter from './Utils/EventEmitter'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'

export default class Resources extends EventEmitter {
    loader: Loader
    items: Record<string, HTMLImageElement | GLTF>
    toLoad: number
    loaded: number

    constructor() {
        super()

        this.loader = new Loader()
        this.items = {}
        this.toLoad = 0
        this.loaded = 0

        this.loader.on('fileEnd', (...args: unknown[]) => {
            const resource = args[0] as ResourceDefinition
            const data = args[1] as HTMLImageElement | GLTF
            this.items[resource.name] = data
            this.loaded++

            this.trigger('progress', [this.loaded / this.toLoad])

            if (this.loaded === this.toLoad) {
                this.trigger('ready')
            }
        })
    }

    load(resources: ResourceDefinition[]): void {
        this.toLoad = resources.length
        this.loaded = 0
        this.loader.load(resources)
    }
}
