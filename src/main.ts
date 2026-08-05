import Application from './engine/Application'

function supportsWebGL(): boolean {
    try {
        const probe = document.createElement('canvas')
        return Boolean(
            window.WebGLRenderingContext &&
            (probe.getContext('webgl2') || probe.getContext('webgl')),
        )
    } catch {
        return false
    }
}

/**
 * Drop back to the plain-HTML version rather than leaving a blank page.
 * Removing `has-js` un-hides the fallback markup injected at build time.
 */
function showFallback(): void {
    document.documentElement.classList.remove('has-js')
    document.querySelector('canvas.js-canvas')?.remove()
    document.querySelector('.loading-screen')?.remove()
}

const canvas = document.querySelector('canvas.js-canvas') as HTMLCanvasElement | null

if (!canvas || !supportsWebGL()) {
    showFallback()
} else {
    try {
        new Application({ canvas })
    } catch (error) {
        console.error('Could not start the 3D world', error)
        showFallback()
    }
}
