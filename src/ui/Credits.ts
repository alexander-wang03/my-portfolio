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

/** Breathing room between the top of the credits and anything lifted above it. */
const LIFT_GAP = 12

let started = false

/**
 * Publish how much of the bottom edge the credits are occupying, as
 * `--credits-clearance`.
 *
 * The touch controls read it to get out of the way. It is expressed as a
 * distance from the bottom of the viewport rather than as an offset to apply,
 * so the decision about what that means stays in CSS: each control asks for
 * `max(its own resting position, the clearance)` and therefore only moves if
 * the credits actually reach it. Nothing here needs to know where the controls
 * are, and the controls can be rearranged without touching this file.
 *
 * Measured rather than assumed because the height is genuinely unpredictable —
 * it depends on viewport width, orientation and whether the system font has
 * loaded yet, and the same text wraps to one line on a laptop and three on a
 * phone.
 */
function publishClearance(element: Element): void {
    // `--fading` counts as gone, not as present. It is added at the start of
    // the fade, and the whole point is that the controls travel back down with
    // the line rather than waiting for it to vanish and then dropping.
    const showing =
        element.classList.contains('credits--shown') &&
        !element.classList.contains('credits--fading') &&
        !element.classList.contains('credits--retired')

    // A retired line is not gone, it is one tap away: `.credits--retired:hover`
    // and `:focus-within` bring the full attribution back, and the tag is a
    // real button, so tapping it on a phone focuses it. Without this the line
    // reappears at full width underneath the controls - which is the exact
    // collision this whole mechanism exists to prevent, just later.
    const restored =
        element.classList.contains('credits--retired') &&
        element.matches(':hover, :focus-within')

    const expanded = showing || restored

    const text = element.querySelector('.credits-text')
    let clearance = 0

    if (expanded && text) {
        const box = text.getBoundingClientRect()
        // Distance from the bottom of the viewport to the top of the line.
        // `bottom` is used rather than the element's CSS offset so this stays
        // correct whatever the stylesheet does with it.
        clearance = window.innerHeight - box.top + LIFT_GAP
    }

    document.documentElement.style.setProperty(
        '--credits-clearance',
        `${Math.max(0, Math.round(clearance))}px`,
    )
}

/**
 * Keep the clearance honest as things move.
 *
 * A `ResizeObserver` rather than a resize listener: rotating the phone is only
 * one of the ways this changes shape. The web font arriving, or the text
 * reflowing from three lines to two, produces no resize event at all.
 */
function watchClearance(element: Element): void {
    const text = element.querySelector('.credits-text')
    if (!text || typeof ResizeObserver === 'undefined') {
        window.addEventListener('resize', () => publishClearance(element))
        return
    }

    new ResizeObserver(() => publishClearance(element)).observe(text)

    // The observer only fires on a size change, and bringing a retired line
    // back is a change of opacity and pointer-events - same box, same size.
    for (const event of ['pointerenter', 'pointerleave', 'focusin', 'focusout', 'click']) {
        element.addEventListener(event, () => {
            // After the event has been applied, so :hover / :focus-within
            // reflect the state this is being asked about
            requestAnimationFrame(() => publishClearance(element))
        })
    }
}

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

    // After a frame, so the line has been laid out at its real width. Measured
    // in the same frame it is revealed, it is still whatever the previous
    // layout said — usually zero.
    requestAnimationFrame(() => publishClearance(element))
    watchClearance(element)

    // Nothing to wait out when the fade has been turned off
    const fade = prefersReducedMotion() ? 0 : FADE_DURATION

    window.setTimeout(() => {
        element.classList.add('credits--fading')

        // Released as the line starts fading rather than after it, so the
        // controls glide back down alongside it instead of waiting for it to
        // finish and then dropping on their own.
        publishClearance(element)

        window.setTimeout(() => {
            // Dropped as the tag arrives, so the hover-to-restore rules do not
            // have to out-specify a lingering "stay hidden"
            element.classList.remove('credits--fading')
            element.classList.add('credits--retired')
            publishClearance(element)
        }, fade)
    }, delay)
}
