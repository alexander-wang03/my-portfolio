import type Zones from './Zones'
import type Physics from './Physics'

export interface RouterOptions {
    zones: Zones
    physics: Physics
}

/**
 * Makes each section addressable as a URL fragment.
 *
 * Without this the only shareable link is the front door, and a visitor has to
 * drive to find anything. Zones already know when the rover enters them and
 * Physics can already teleport it, so routing is mostly wiring the two to the
 * address bar.
 */

/** Land this far in front of a section's signs, rather than on top of them. */
const ARRIVAL_OFFSET_Z = 3

// Drop height is shared with the intro, so arriving always looks the same

const SECTION_LABELS: Record<string, string> = {
    projects: 'Projects',
    experience: 'Experience',
    about: 'About',
    contact: 'Contact',
}

function readHash(): string {
    return window.location.hash.replace(/^#/, '').toLowerCase()
}

export default class Router {
    private physics: Physics
    private targets = new Map<string, { x: number; z: number }>()
    private baseTitle = document.title

    /**
     * `#debug` is read at startup to open the dat.GUI panel, so if the visitor
     * arrived with it we never touch the fragment again — overwriting it with
     * a section name would silently disable debug on the next reload.
     */
    private readonly frozen: boolean

    constructor(options: RouterOptions) {
        this.physics = options.physics
        this.frozen = readHash() === 'debug'

        for (const zone of options.zones.items) {
            const section = zone.data.section
            if (typeof section !== 'string') continue

            this.targets.set(section, {
                x: zone.position.x,
                z: zone.position.z + ARRIVAL_OFFSET_Z,
            })

            zone.on('in', () => this.onEnter(section))
            zone.on('out', () => this.onLeave())
        }

        // Fires on manual edits and back/forward, but not on our own
        // replaceState calls — so entering a zone cannot loop back into a jump
        window.addEventListener('hashchange', () => this.onHashChange())
    }

    /** Where the rover should start, when the URL names a section. */
    initialSpawn(): { x: number; z: number } | null {
        return this.targets.get(readHash()) ?? null
    }

    private onEnter(section: string): void {
        this.write(`#${section}`)

        const label = SECTION_LABELS[section]
        if (label) document.title = `${label} — ${this.baseTitle}`
    }

    private onLeave(): void {
        this.write('')
        document.title = this.baseTitle
    }

    private onHashChange(): void {
        const target = this.targets.get(readHash())
        if (target) {
            // No hold here — mid-session the jump should feel immediate
            this.physics.dropIn(target.x, target.z, 0)
        }
    }

    /** replaceState, so driving around does not fill up the back button. */
    private write(fragment: string): void {
        if (this.frozen) return

        const url = `${window.location.pathname}${window.location.search}${fragment}`
        window.history.replaceState(null, '', url)
    }
}
