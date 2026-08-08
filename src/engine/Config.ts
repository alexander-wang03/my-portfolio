export interface AppConfig {
    debug: boolean
    touch: boolean
    /**
     * The visitor has asked their OS to reduce motion.
     *
     * What matters here is motion the visitor did not ask for — the camera
     * swinging on its own is a vestibular trigger in a way that driving is
     * not, because driving is under their control and anticipated. So this
     * suppresses the intro sweep and the per-section camera moves, and leaves
     * the rover and the camera following it alone.
     */
    reducedMotion: boolean
}

export function prefersReducedMotion(): boolean {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}
