# Credits

Third-party assets used in this site, and the terms they come under.

The short form of this also appears on the site itself, in the footer of
`src/index.html` — both licences below require attribution to travel with the
work, not just with the source repository.

---

## Mars Rover Character — the rover model

**"Mars Rover Character"** by **BrentNoll**, licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

- Source: <https://sketchfab.com/3d-models/mars-rover-character-9cbf5d8c68e140b28916739705520901>
- Published 26 July 2017 · 2.6k triangles, 2.1k vertices
- File: `static/models/rover/mars_rover_character.glb`

Changes made: re-scaled to the physics vehicle's wheel radius, wheels detached
onto their own pivots so they steer and spin, and the PBR materials swapped for
matcaps with a white-balance correction (see `src/world/Rover.ts`).

CC BY permits this — including commercial use — as long as credit is given, the
licence is linked, and changes are noted.

---

## folio-2019 — matcap textures and impact sounds

**[folio-2019](https://github.com/brunosimon/folio-2019)** by **Bruno Simon**,
MIT licensed.

- `static/models/matcaps/*.png` — all 14 matcaps
- `static/sounds/bricks/`, `static/sounds/bowling/`, `static/sounds/car-hits/`
  — impact samples
- `static/sounds/screeches/`, `static/sounds/car-horns/`, `static/sounds/reveal/`,
  `static/sounds/ui/` — tyre screech, horn, intro cue and UI blip

Changes made: several were re-encoded at a higher level. They shipped peaking
between -19 and -11 dBFS, which put them under the engine loop they have to be
heard over.

```
MIT License

Copyright (c) 2019 Bruno SIMON

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Everything else

Terrain, block letters, rocks, sign boards, dust, shaders and the engine loop
are original to this project.
