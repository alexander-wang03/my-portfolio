type Callback = (...args: unknown[]) => unknown

interface ResolvedName {
    original: string
    value: string
    namespace: string
}

export default class EventEmitter {
    private callbacks: Record<string, Record<string, Callback[]>>

    constructor() {
        this.callbacks = { base: {} }
    }

    on(names: string, callback: Callback): this | false {
        if (!names || !callback) {
            console.warn('EventEmitter: wrong names or callback')
            return false
        }

        for (const rawName of this.resolveNames(names)) {
            const name = this.resolveName(rawName)

            if (!this.callbacks[name.namespace]) {
                this.callbacks[name.namespace] = {}
            }
            if (!this.callbacks[name.namespace][name.value]) {
                this.callbacks[name.namespace][name.value] = []
            }

            this.callbacks[name.namespace][name.value].push(callback)
        }

        return this
    }

    off(names: string): this | false {
        if (!names) {
            console.warn('EventEmitter: wrong name')
            return false
        }

        for (const rawName of this.resolveNames(names)) {
            const name = this.resolveName(rawName)

            if (name.namespace !== 'base' && name.value === '') {
                delete this.callbacks[name.namespace]
            } else if (name.namespace === 'base') {
                for (const ns in this.callbacks) {
                    if (this.callbacks[ns]?.[name.value]) {
                        delete this.callbacks[ns][name.value]
                        if (Object.keys(this.callbacks[ns]).length === 0) {
                            delete this.callbacks[ns]
                        }
                    }
                }
            } else if (this.callbacks[name.namespace]?.[name.value]) {
                delete this.callbacks[name.namespace][name.value]
                if (Object.keys(this.callbacks[name.namespace]).length === 0) {
                    delete this.callbacks[name.namespace]
                }
            }
        }

        return this
    }

    trigger(name: string, args: unknown[] = []): unknown {
        if (!name) {
            console.warn('EventEmitter: wrong name')
            return false
        }

        const resolved = this.resolveName(this.resolveNames(name)[0])
        let finalResult: unknown = null

        if (resolved.namespace === 'base') {
            for (const ns in this.callbacks) {
                if (this.callbacks[ns]?.[resolved.value]) {
                    for (const callback of this.callbacks[ns][resolved.value]) {
                        const result = callback(...args)
                        if (finalResult === null) finalResult = result
                    }
                }
            }
        } else if (this.callbacks[resolved.namespace]?.[resolved.value]) {
            for (const callback of this.callbacks[resolved.namespace][resolved.value]) {
                const result = callback(...args)
                if (finalResult === null) finalResult = result
            }
        }

        return finalResult
    }

    private resolveNames(names: string): string[] {
        return names
            .replace(/[^a-zA-Z0-9 ,/.]/g, '')
            .replace(/[,/]+/g, ' ')
            .split(' ')
    }

    private resolveName(name: string): ResolvedName {
        const parts = name.split('.')
        return {
            original: name,
            value: parts[0],
            namespace: parts.length > 1 && parts[1] !== '' ? parts[1] : 'base',
        }
    }
}
