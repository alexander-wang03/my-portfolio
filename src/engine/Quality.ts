export interface QualitySettings {
    tier: 'high' | 'low'
    /** Pixel count scales with the square of this, so it is the biggest lever. */
    maxPixelRatio: number
    /** Cap on shadows fed to the terrain shader's per-pixel loop. */
    maxObjectShadows: number
    /** Shadows further than this from the rover are dropped entirely. */
    shadowDistance: number
    /** Tilt-shift blur — two full-screen passes, the costliest post effect. */
    blur: boolean
}

const HIGH: QualitySettings = {
    tier: 'high',
    maxPixelRatio: 2,
    maxObjectShadows: 128,
    shadowDistance: 45,
    blur: true,
}

const LOW: QualitySettings = {
    tier: 'low',
    maxPixelRatio: 1.5,
    maxObjectShadows: 48,
    shadowDistance: 26,
    blur: false,
}

/**
 * Pick a quality tier from what the device advertises.
 *
 * The terrain fragment shader loops over every object shadow with two texture
 * fetches per iteration, so its cost is (pixels x shadows) — which is exactly
 * the product that gets out of hand on a phone at 2x pixel ratio.
 *
 * `(pointer: coarse)` rather than `maxTouchPoints`, because a touchscreen
 * laptop driven by a trackpad reports a fine primary pointer and should stay
 * on the high tier.
 */
export function detectQuality(): QualitySettings {
    const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false
    const fewCores = (navigator.hardwareConcurrency ?? 8) <= 4

    return coarsePointer || fewCores ? LOW : HIGH
}
