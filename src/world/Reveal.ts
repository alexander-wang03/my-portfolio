import type * as THREE from 'three'

/**
 * Reveal registry for the intro animation.
 *
 * World drives the progress values; materials register themselves wherever
 * they happen to be created, so nothing has to be threaded through the
 * constructor chain.
 *
 * Two mechanisms, because the world has two kinds of surface:
 *  - Matcap materials animate in their own vertex shader — a wave travelling
 *    outward from the centre lifts each object out of the ground.
 *  - Flat materials (canvas-texture sign boards) have no such shader, so they
 *    fade their opacity in instead.
 */

interface FadeEntry {
    material: THREE.Material
    /** Materials whose texture carries alpha must never flip back to opaque. */
    alwaysTransparent: boolean
}

const shaderMaterials: THREE.ShaderMaterial[] = []
const fadeMaterials: FadeEntry[] = []

let revealProgress = 0
let fadeProgress = 0

/** Register a material whose shader implements a `uRevealProgress` uniform. */
export function registerRevealShader(material: THREE.ShaderMaterial): void {
    material.uniforms.uRevealProgress.value = revealProgress
    shaderMaterials.push(material)
}

/** Register a flat material that should fade in with the reveal. */
export function registerRevealFade(
    material: THREE.Material,
    options: { alwaysTransparent?: boolean } = {},
): void {
    const entry: FadeEntry = {
        material,
        alwaysTransparent: options.alwaysTransparent ?? false,
    }

    fadeMaterials.push(entry)
    applyFade(entry, fadeProgress)
}

export function setRevealProgress(value: number): void {
    revealProgress = value

    for (const material of shaderMaterials) {
        material.uniforms.uRevealProgress.value = value
    }
}

export function setRevealFade(value: number): void {
    fadeProgress = value

    for (const entry of fadeMaterials) {
        applyFade(entry, value)
    }
}

function applyFade(entry: FadeEntry, value: number): void {
    const material = entry.material
    material.opacity = value

    // A fully transparent material still writes depth, which would punch an
    // invisible hole in whatever is behind it — skip drawing it entirely.
    material.visible = value > 0.001

    // Back to opaque once revealed, so boards sort as ordinary geometry again.
    const shouldBeTransparent = entry.alwaysTransparent || value < 1
    if (material.transparent !== shouldBeTransparent) {
        material.transparent = shouldBeTransparent
        material.needsUpdate = true
    }
}
