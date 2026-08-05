import {
    ABOUT,
    CONTACT_LINKS,
    EXPERIENCES,
    FULL_NAME,
    PROJECTS,
    RESUME_URL,
    TAGLINE,
} from './portfolio'

/**
 * The portfolio as plain HTML, injected into index.html at build time.
 *
 * The 3D world puts every word of this on a canvas, where crawlers, link
 * previews, screen readers and anyone without WebGL see nothing at all. This
 * renders the same content — from the same source — into the served markup.
 *
 * Runs in the Vite config (Node), so it must stay free of browser and Three.js
 * imports; `portfolio.ts` is plain data and safe to pull in.
 */

const escape = (value: string): string =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')

export function renderFallbackHtml(): string {
    const projects = PROJECTS.map(
        (project) => `
            <li>
                <h3><a href="${escape(project.url)}">${escape(project.title)}</a></h3>
                <p>${escape(project.description)}</p>
            </li>`,
    ).join('')

    const experience = EXPERIENCES.map(
        (job) => `
            <li>
                <h3>${escape(job.company)}</h3>
                <p class="role">${escape(job.role)} &middot; ${escape(job.years)}</p>
                <p>${escape(job.description)}</p>
            </li>`,
    ).join('')

    const contact = CONTACT_LINKS.map(
        (link) => `<li><a href="${escape(link.url)}">${escape(link.label)}</a></li>`,
    ).join('')

    // ABOUT.current.body carries intentional markup, so it is not escaped
    return `
    <main class="fallback" id="fallback">
        <header>
            <h1>${escape(FULL_NAME)}</h1>
            <p class="tagline">${escape(ABOUT.subtitle)}</p>
        </header>

        <section>
            <h2>${escape(ABOUT.heading)}</h2>
            <p>${escape(ABOUT.intro)}</p>
            <p><strong>${escape(ABOUT.current.heading)}:</strong> ${ABOUT.current.body}</p>
            <p><strong>${escape(ABOUT.education.heading)}:</strong> ${ABOUT.education.lines.map(escape).join(', ')}</p>
        </section>

        <section>
            <h2>Experience</h2>
            <ul>${experience}</ul>
            <p><a href="${escape(RESUME_URL)}">Download r&eacute;sum&eacute; (PDF)</a></p>
        </section>

        <section>
            <h2>Projects</h2>
            <ul>${projects}</ul>
        </section>

        <section>
            <h2>Contact</h2>
            <ul class="contact">${contact}</ul>
        </section>

        <footer>
            <p>This site is normally an interactive 3D world &mdash; ${escape(TAGLINE)} &mdash;
            which needs JavaScript and WebGL. You are seeing the plain text version.</p>
        </footer>
    </main>`
}
