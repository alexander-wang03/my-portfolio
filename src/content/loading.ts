import { escapeHtml } from './html'
import { FULL_NAME, TAGLINE } from './portfolio'

/**
 * The loading screen as real markup, injected into index.html at build time.
 *
 * It used to be built by `LoadingScreen` in JS, which meant it could not
 * appear until the application bundle had downloaded and parsed — the one
 * thing it exists to cover. On a slow connection that left a blank page for
 * the entire download, and a blank page is what people leave.
 *
 * Rendered here rather than written into index.html by hand so the title and
 * tagline still come from `portfolio.ts`, the same as everywhere else.
 *
 * Runs in the Vite config (Node), so it must stay free of browser imports.
 */
export function renderLoadingHtml(): string {
    return `
    <div class="loading-screen">
        <!-- Deliberately not a heading. It repeats the page title as decoration,
             and a second h1 competes with the real one in the readable version
             below — visible to the outline and to screen readers now that this
             screen is no longer aria-hidden. -->
        <p class="loading-title">${escapeHtml(FULL_NAME)}</p>
        <p class="loading-subtitle">${escapeHtml(TAGLINE)}</p>
        <div class="loading-progress loading-progress--indeterminate">
            <div class="loading-progress-fill"></div>
        </div>
        <button class="loading-prompt" type="button" disabled>Loading&hellip;</button>
    </div>`
}
