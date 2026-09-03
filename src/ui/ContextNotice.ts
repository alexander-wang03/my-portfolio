/**
 * The message shown when the browser takes the WebGL context away.
 *
 * A lost context is not an error anyone sees: Three.js stops drawing, the
 * canvas keeps displaying whatever was in it, and the page looks frozen rather
 * than broken. On a phone this is the ordinary consequence of switching apps
 * under memory pressure, so it is worth saying out loud.
 *
 * Built in JS rather than shipped in `index.html` because, unlike the loading
 * screen, this cannot appear before the bundle has run — nothing can lose a
 * context that was never created. There is no flash to avoid.
 */
export default class ContextNotice {
    private element: HTMLElement | null = null

    show(): void {
        if (this.element) return

        const notice = document.createElement('div')
        notice.className = 'context-notice'
        // `status` rather than `alert`: this is a state the page has entered,
        // not something demanding immediate action, and `alert` interrupts
        // whatever a screen reader is currently saying.
        notice.setAttribute('role', 'status')
        notice.setAttribute('aria-live', 'polite')

        const title = document.createElement('p')
        title.className = 'context-notice-title'
        title.textContent = 'Graphics paused'

        const body = document.createElement('p')
        body.className = 'context-notice-body'
        body.textContent =
            'The browser reclaimed the 3D view, usually to free memory. ' +
            'Waiting for it to come back…'

        notice.append(title, body)
        document.body.append(notice)
        this.element = notice
    }

    hide(): void {
        this.element?.remove()
        this.element = null
    }
}
