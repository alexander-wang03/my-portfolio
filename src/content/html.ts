/**
 * Shared by the build-time renderers in this folder.
 *
 * They run inside the Vite config (Node), so nothing here may reach for
 * browser or Three.js APIs.
 */
export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}
