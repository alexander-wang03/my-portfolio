import type Application from './engine/Application'
import type { GUI } from 'dat.gui'

/**
 * Entry point, kept deliberately small.
 *
 * Everything heavy — Three.js, Rapier, the world — is imported on demand
 * below. Statically imported it all landed in this chunk, and the browser had
 * to download and parse ~1 MB before it could paint anything at all, including
 * the loading screen meant to cover that very wait.
 */

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
/** Set once the 3D world has been ruled out, so a late load does not start it. */
let abandoned = false

/**
 * Switch to the plain-HTML version of the portfolio.
 *
 * Used both as a failure path (no WebGL) and as a deliberate choice via the
 * skip link. Removing `has-js` un-hides the fallback markup injected at build
 * time; the 3D world is torn down rather than left running unseen.
 */
function showFallback(): void {
    abandoned = true
    application?.stop()
    application = null

    document.documentElement.classList.remove('has-js')
    document.querySelector('canvas.js-canvas')?.remove()
    document.querySelector('.loading-screen')?.remove()
    document.querySelector('.touch-controls')?.remove()
}

/**
 * dat.gui, and only for `#debug`.
 *
 * It is a production dependency purely because the panel is built at runtime,
 * so importing it normally shipped a debug tool to every visitor. Fetched here
 * instead, alongside the application rather than after it, so opening `#debug`
 * costs no extra round trip.
 */
async function loadDebugGui(): Promise<GUI | undefined> {
    if (window.location.hash !== '#debug') return undefined

    const dat = await import('dat.gui')
    return new dat.GUI({ width: 420 })
}

async function start(canvas: HTMLCanvasElement): Promise<void> {
    try {
        const [module, debug] = await Promise.all([
            import('./engine/Application'),
            loadDebugGui(),
        ])

        // The visitor took the skip link while this was still downloading
        if (abandoned) return

        application = new module.default({ canvas, debug })
    } catch (error) {
        console.error('Could not start the 3D world', error)
        showFallback()
    }
}

document.querySelector('.skip-link')?.addEventListener('click', () => {
    showFallback()
})

const canvas = document.querySelector('canvas.js-canvas') as HTMLCanvasElement | null

if (!canvas || !supportsWebGL()) {
    showFallback()
} else {
    void start(canvas)
}
