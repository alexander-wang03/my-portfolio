# Mars Rover Portfolio

An interactive portfolio you explore by driving a rover across Mars. Built with
Three.js and Rapier, inspired by [Bruno Simon's folio-2019](https://github.com/brunosimon/folio-2019).

**Live:** <https://alexanderwang.io>

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
```

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
- `prefers-reduced-motion` is honoured throughout, and quality scales down on
  low-power devices.

## Credits

Third-party assets and their licences are listed in [CREDITS.md](CREDITS.md) —
the rover model is CC BY, and the matcaps and impact sounds come from
folio-2019 under MIT.
