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

let application: Application | null = null

/**
 * Switch to the plain-HTML version of the portfolio.
 *
 * Used both as a failure path (no WebGL) and as a deliberate choice via the
 * skip link. Removing `has-js` un-hides the fallback markup injected at build
 * time; the 3D world is torn down rather than left running unseen.
 */
function showFallback(): void {
    application?.stop()
    application = null

    document.documentElement.classList.remove('has-js')
    document.querySelector('canvas.js-canvas')?.remove()
    document.querySelector('.loading-screen')?.remove()
    document.querySelector('.touch-controls')?.remove()
}

document.querySelector('.skip-link')?.addEventListener('click', () => {
    showFallback()
})

const canvas = document.querySelector('canvas.js-canvas') as HTMLCanvasElement | null

if (!canvas || !supportsWebGL()) {
    showFallback()
} else {
    try {
        application = new Application({ canvas })
    } catch (error) {
        console.error('Could not start the 3D world', error)
        showFallback()
    }
}
