/**
 * Shows the on-screen asset credits when the world appears, then retires them
 * a few seconds later.
 *
 * Retiring is a collapse rather than a removal, deliberately: CC BY and MIT
 * both require the attribution to stay with the work, so the full line has to
 * remain reachable. It shrinks to a "Credits" tag that brings it back on hover
 * or focus — the rest is in `main.css` under `.credits--retired`.
 *
 * The markup lives in `index.html` rather than being built here, so the only
 * thing this file controls is when it is on screen.
 */

import { prefersReducedMotion } from '../engine/Config'

/** Long enough to read the line at a glance before it steps aside. */
const RETIRE_DELAY = 7000

/**
 * How long the line takes to fade out, matching the `.credits-text` transition
 * in `main.css`.
 *
 * The handover has to be two steps rather than one class doing both: the tag
 * appears by switching `display`, which happens in a single frame, so firing
 * it with the fade meant it sat there labelling text that was still visibly on
 * its way out.
 */
const FADE_DURATION = 500

let started = false

/**
 * Fade the credits in, then retire them.
 *
 * Called when the world is revealed rather than on load, for both halves of
 * the problem: the loading screen covers the viewport until the visitor clicks
 * through, so credits shown before that flash briefly before it is built and
 * then expire behind it — seen for a moment, and never when it counts.
 */
export function revealCredits(delay = RETIRE_DELAY): void {
    const element = document.querySelector('.credits')
    if (!element || started) return
    started = true

    element.classList.add('credits--shown')

    // Nothing to wait out when the fade has been turned off
    const fade = prefersReducedMotion() ? 0 : FADE_DURATION

    window.setTimeout(() => {
        element.classList.add('credits--fading')

        window.setTimeout(() => {
            // Dropped as the tag arrives, so the hover-to-restore rules do not
            // have to out-specify a lingering "stay hidden"
            element.classList.remove('credits--fading')
            element.classList.add('credits--retired')
        }, fade)
    }, delay)
}
