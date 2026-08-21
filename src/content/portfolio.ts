/**
 * Every piece of portfolio copy lives here.
 *
 * Each section renders this twice — once as canvas-texture sign boards out in
 * the world, once as HTML in the side panel — so keeping it in one place means
 * a copy edit is a single edit.
 */

/**
 * Where the site lives, with no trailing slash.
 *
 * Single-sourced because four different things have to agree on it: the
 * canonical link, the Open Graph and Twitter tags, sitemap.xml and the
 * Sitemap line in robots.txt. They are generated from here at build time —
 * a stale URL in any one of them is the kind of thing nobody notices.
 */
export const SITE_URL = 'https://alexanderwang.io'

export const FULL_NAME = 'ALEXANDER WANG'
/** Short form, built as physical block letters at spawn. */
export const BLOCK_LETTERS_NAME = 'ALEX WANG'
export const TAGLINE = 'My World'
export const RESUME_URL = '/CV.pdf'

export interface Project {
    title: string
    description: string
    url: string
}

export const PROJECTS: Project[] = [
    {
        title: 'TARS-AI',
        description: 'Co-founded an open-source robotics community recreating the robot TARS from Interstellar — 1000+ members.',
        url: 'https://github.com/TARS-AI-Community/TARS-AI',
    },
    {
        title: 'BoreasLane',
        description: 'First publicly available 3D winter condition lane dataset for autonomous vehicles.',
        url: 'https://www.trailab.utias.utoronto.ca/',
    },
    {
        title: 'aUToronto',
        description: 'C++ multi-sensor fusion for autonomous vehicle state estimation — back-to-back 1st place at SAE AutoDrive.',
        url: 'https://www.autodrive.utoronto.ca/',
    },
    {
        title: 'SynthBoard',
        description: 'Audio synthesizer with 4x4 button interface, RGB LEDs, and 8 knobs for real-time waveform manipulation.',
        url: 'https://github.com/alexander-wang03/SynthBoard',
    },
]

export interface Experience {
    company: string
    role: string
    years: string
    description: string
}

export const EXPERIENCES: Experience[] = [
    {
        company: 'SpaceX',
        role: 'Software Engineering Intern',
        years: 'May 2025 – Aug 2025',
        description: 'Designed PLC-based controller architecture for Hardware-in-the-Loop test systems, reducing downtime by 87%.',
    },
    {
        company: 'General Motors',
        role: 'Software & Controls Intern',
        years: 'May 2024 – Apr 2025',
        description: 'Developed thermal control system software and automated SIL testing pipeline for EV propulsion.',
    },
    {
        company: 'aUToronto',
        role: 'State Estimation Lead',
        years: 'Sep 2023 – Jun 2025',
        description: 'Led autonomous vehicle team to back-to-back 1st place finishes at SAE AutoDrive Challenge.',
    },
    {
        company: 'TRAIL Lab',
        role: 'AI Researcher',
        years: 'May 2024 – Present',
        description: 'Developing Bayesian 3D lane detection and 3D hierarchical scene graphs for VLA models.',
    },
]

export interface ContactLink {
    label: string
    /** Short glyph drawn on the in-world sign board. */
    icon: string
    url: string
    color: string
}

export const CONTACT_LINKS: ContactLink[] = [
    { label: 'GitHub', icon: 'GH', url: 'https://github.com/alexander-wang03', color: '#ffffff' },
    { label: 'LinkedIn', icon: 'LI', url: 'https://www.linkedin.com/in/alexander-wang03/', color: '#0a66c2' },
    { label: 'Email', icon: '@', url: 'mailto:alexshuaiwang@gmail.com', color: '#ff9043' },
]

export const ABOUT = {
    heading: 'About Me',
    /** Shown on the in-world board. */
    tagline: "Engineer, pilot, and creator. I love building robots and getting them in people's hands.",
    subtitle: 'UofT Engineering Science — Robotics',
    intro: "Hi, I'm Alex. I'm an engineer, pilot, and creator with over 4 years of experience. I love building robots and getting them in people's hands.",
    current: {
        heading: 'Currently',
        body: 'AI Researcher at <strong>TRAIL Lab</strong>, University of Toronto',
    },
    education: {
        heading: 'Education',
        lines: ['University of Toronto', 'Engineering Science — Robotics (AI Minor)'],
    },
}
