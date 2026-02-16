import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import EventEmitter from './EventEmitter'

export interface ResourceDefinition {
    name: string
    source: string
}

interface LoaderEntry {
    extensions: string[]
    action: (resource: ResourceDefinition) => void
}

export default class Loader extends EventEmitter {
    private loaders: LoaderEntry[]
    toLoad: number
    loaded: number
    items: Record<string, HTMLImageElement | GLTF>

    constructor() {
        super()

        this.loaders = []
        this.toLoad = 0
        this.loaded = 0
        this.items = {}

        this.setLoaders()
    }

    private setLoaders(): void {
        // Images
        this.loaders.push({
            extensions: ['jpg', 'png', 'webp'],
            action: (resource) => {
                const image = new Image()
                image.addEventListener('load', () => this.fileLoadEnd(resource, image))
                image.addEventListener('error', () => this.fileLoadEnd(resource, image))
                image.src = resource.source
            },
        })

        // Draco
        const dracoLoader = new DRACOLoader()
        dracoLoader.setDecoderPath('draco/')
        dracoLoader.setDecoderConfig({ type: 'js' })

        // GLTF
        const gltfLoader = new GLTFLoader()
        gltfLoader.setDRACOLoader(dracoLoader)

        this.loaders.push({
            extensions: ['glb', 'gltf'],
            action: (resource) => {
                gltfLoader.load(resource.source, (data) => {
                    this.fileLoadEnd(resource, data)
                })
            },
        })
    }

    load(resources: ResourceDefinition[]): void {
        for (const resource of resources) {
            this.toLoad++
            const extensionMatch = resource.source.match(/\.([a-z]+)$/)

            if (extensionMatch?.[1]) {
                const extension = extensionMatch[1]
                const loader = this.loaders.find((l) =>
                    l.extensions.includes(extension)
                )

                if (loader) {
                    loader.action(resource)
                } else {
                    console.warn(`No loader found for ${resource.source}`)
                }
            } else {
                console.warn(`No extension found for ${resource.source}`)
            }
        }
    }

    private fileLoadEnd(resource: ResourceDefinition, data: HTMLImageElement | GLTF): void {
        this.loaded++
        this.items[resource.name] = data

        this.trigger('fileEnd', [resource, data])

        if (this.loaded === this.toLoad) {
            this.trigger('end')
        }
    }
}
