# Mars Rover Portfolio

An interactive portfolio you explore by driving a rover across Mars. Built with
Three.js and Rapier, inspired by [Bruno Simon's folio-2019](https://github.com/brunosimon/folio-2019).

**Live:** <https://www.alexanderwang.io>

## Running it

```bash
npm install
npm run dev      # dev server with HMR
npm run build    # typecheck, then build to dist/
npm run preview  # serve the production build
```

## Controls

| | |
|---|---|
| `W` `A` `S` `D` / arrows | drive |
| `Shift` | boost |
| `Space` / `Ctrl` | brake |
| `H` | horn |
| `R` | reset to spawn |
| `M` | mute |
| scroll / pinch | zoom |
| drag | pan |

Touch devices get an on-screen joystick and boost/brake buttons instead.

## URL fragments

Each section is addressable — `#projects`, `#experience`, `#about`, `#contact`
land the rover in front of that section's signs, and driving into a section
updates the address bar. `#debug` opens a dat.gui panel and is left alone by the
router.

## Layout

```
src/
  engine/     Application, Camera, renderer, render loop, quality detection
  world/      Terrain, Physics, Rover, Zones, Sounds, Areas, Router
    Sections/   the four content areas built in 3D
    Materials/  matcap and sign-board materials
    Particles/  dust
  ui/         loading screen, section panel, credits
  content/    portfolio copy, plus the build-time HTML renderers
  shaders/    GLSL for terrain, matcaps, floor, dust
  style/      main.css
static/       models, matcaps, sounds, CV, favicons — served from /
design/       source art that should not be served (the OG screenshot)
```

Anything in `static/` is published, referenced or not. `design/` exists for
files that are kept but must not get a public URL — `og-source.png` is the
full screenshot `og-image.png` was cropped from, worth having when the link
preview needs regenerating and not worth serving.

## Notes

A few things that are less obvious than they look:

- **The terrain is procedural**, generated from value noise in `Terrain.ts`, not
  loaded from a mesh. Rapier's heightfield wants its data **column-major**.
- **The scene has no lights.** Everything is matcap-shaded, which is why the
  imported rover model has its PBR materials replaced on load.
- **Shadows are computed in the terrain fragment shader** as SDFs, rather than
  with shadow maps.
- **The content exists twice** — as canvas sign boards in the world, and as
  plain HTML injected into `index.html` at build time from the same source in
  `content/portfolio.ts`. Crawlers, link previews, screen readers and anyone
  without WebGL get the readable version; a skip link reaches it deliberately.
- **The loading screen is static markup**, injected at build time. Built in JS
  it could not appear until the bundle it exists to cover had downloaded.
- **Rapier is imported through `src/engine/rapier.ts`, not directly.** Its wasm
  hookup module is side-effect-only and gets tree-shaken out of a production
  build, leaving an unassigned `let wasm;` and a runtime failure. That file
  holds it in place — see the comment there before changing any import.
- **`robots.txt` and `sitemap.xml` are generated at build time**, not kept in
  `static/`. They, the canonical link and the Open Graph URLs all derive from
  `SITE_URL` in `content/portfolio.ts`, so there is one address to change.
  That constant must name the host that answers **200**, not the one that
  redirects to it — the apex 308s to `www`, so it is the `www` form.
  Their `lastmod` dates come from **git, not from `mtime`**: git does not
  record mtimes, so on a build server every file is stamped with the moment it
  was checked out, and every deploy claimed both pages had just changed. A
  shallow clone cannot answer the question either — it reports its boundary
  commit for everything older — so that case is detected and `lastmod` is left
  out rather than guessed. `VERCEL_DEEP_CLONE=1` restores it.
- **`vercel.json` sets cache headers**, which JSON cannot explain in place:
  - `/assets/*` is `immutable` for a year. Vite puts a content hash in each of
    those filenames, so the contents behind one can never change — a new build
    produces new names. Vercel's default of `max-age=0, must-revalidate` spent
    a round trip per file per visit re-checking things that are unchangeable
    by construction, and the largest of them is Rapier's 1.4 MB wasm.
  - Everything under `models/`, `sounds/` and `icons/` keeps its name across
    builds, so it gets an hour of freshness and a day of
    `stale-while-revalidate` instead: a returning visitor gets the cached copy
    immediately while a fresh one is fetched behind them. Replacing a model
    can therefore be one load late, and then corrects itself.
  - `index.html` is deliberately left on Vercel's default. It carries the
    hashed filenames, so caching it is what would actually go stale.
  - `CV.pdf` is left on the default too — a résumé gets replaced, and it
    should be the new one the moment it is.
- **CI runs the same command Vercel does** (`.github/workflows/ci.yml`), so a
  typecheck failure surfaces on the commit rather than as a rejected deploy. It
  also asserts the build-time SEO files were emitted — nothing else notices if
  that Vite plugin stops running, since they are generated rather than
  committed.
- **Analytics is Vercel Web Analytics**, loaded from this site's own origin
  rather than a third-party domain. No cookies, no cross-site tracking. It has
  to be switched on for the project in the Vercel dashboard; until it is, the
  script 404s and nothing is recorded.
- `prefers-reduced-motion` is honoured throughout, and quality scales down on
  low-power devices.

## Credits

Third-party assets and their licences are listed in [CREDITS.md](CREDITS.md) —
the rover model is CC BY, and the matcaps and impact sounds come from
folio-2019 under MIT.
