import { ABOUT, CONTACT_LINKS, PROJECTS, SITE_NAME, SITE_URL } from './portfolio'

/**
 * Schema.org data about the person whose site this is, as JSON-LD.
 *
 * This exists because of how the page is put together. The readable version of
 * the portfolio is `display: none` whenever JavaScript runs, and crawlers do
 * run it — so a rendered crawl sees a loading screen and little else. Whether
 * that actually costs anything is a question for Search Console rather than
 * guesswork, and nothing here changes that behaviour.
 *
 * What it does change is what a crawler can extract with no ambiguity at all.
 * Structured data is read from the markup, not from the rendered page, so
 * `display` never enters into it — and it states the things a search engine
 * would otherwise have to infer from prose: who this is, what they do, where
 * else they are, and what they have built.
 *
 * Runs in the Vite config (Node), so it must stay free of browser imports.
 */
export function renderStructuredData(): string {
    const sameAs = CONTACT_LINKS
        .filter((link) => link.url.startsWith('http'))
        .map((link) => link.url)

    const data = {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        description: ABOUT.tagline,
        jobTitle: 'Robotics and AI Engineer',
        alumniOf: {
            '@type': 'CollegeOrUniversity',
            name: 'University of Toronto',
        },
        sameAs,
        // Listed as work rather than as pages: these are things built, and
        // most of them live on someone else's domain
        subjectOf: PROJECTS.map((project) => ({
            '@type': 'CreativeWork',
            name: project.title,
            description: project.description,
            url: project.url,
        })),
    }

    return `<script type="application/ld+json">${JSON.stringify(data)}</script>`
}
