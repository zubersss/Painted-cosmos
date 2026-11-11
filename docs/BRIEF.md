# PAINTED COSMOS: SHARED BRIEF

Sections 1-5 below are the owner's brief, verbatim. Both sessions (PAINTER and PILOT) read
them from here. The coordinator's addendum (setup, contract clarifications, settled outcomes)
is in `docs/COORDINATOR.md`.

```
=== 1. THE GAME ===
A calm single-player exploration game in the spirit of No Man's Sky,
for desktop web browsers. You are an explorer on foot (third person by
default, V toggles first person) with a jetpack. Your ship waits
nearby. Walk up, press E to board, lift off, climb through the
atmosphere into space with no loading screen, fly to any planet in our
solar system, descend, land, step out, and explore. No combat, no
crafting, no fail state. The reward is wandering through paintings.
Light goals only: each planet has marked "vistas" to find, and a
sketchbook records every planet and biome you have visited.

=== 2. ART BIBLE (the look is the product) ===
The freeze-frame test: pause on any frame, anywhere, and it should pass
for a scan of a real watercolor landscape on cold-press paper.
Naturalistic and painterly, like a plein-air forest study. Not
cel-shaded, not cartoon, not low-poly, not "a 3D game with a filter on
top". Then it moves.

1. Paper is the light. The brightest values are bare paper (warm
   off-white, about #F4EFE4), never pure white. Nothing is pure black;
   darks are dense indigo and sepia mixes. Distance, fog, and the frame
   edges fade to bare paper, not grey. Leave a soft, ragged unpainted
   border around the screen.
2. Washes, not shading. Light falls in 3-4 soft value steps: wet, soft
   transitions inside a shape, crisp edges between shapes. No specular
   highlights, no PBR sheen, no hard shadows. Shadows are cool
   transparent glazes (violet-blue) laid over the local colour.
3. Pigment behaviour, all procedural in shaders:
   - Edge darkening: pigment pools just inside the border of each wash.
   - Granulation: pigment settles into the paper grain, strongest in
     darks and skies.
   - Turbulence: slow low-frequency density variation so no area is
     flat colour.
   - Wet-in-wet: neighbouring colours bloom into each other in soft
     areas (sky, water, far hills, foliage masses).
   - Backruns: occasional cauliflower blooms in skies and water.
   - Dry brush: broken strokes on rough things (bark, rock, grass tips)
     with paper sparkling through.
   - Use a pigment-density model such as C' = C - (C - C*C)(d - 1) so
     heavy pigment grows richer, not muddier.
4. The painter's hand. Silhouettes wobble slightly, never
   ruler-straight. Detail is simplified into brush-sized shapes (a
   Kuwahara-style abstraction pass or better). Far things are fewer,
   larger, softer strokes; near things get a few crisp accents. A
   faint, broken graphite underdrawing may show on major silhouettes.
5. Atmospheric perspective in stacked layers: each distance band is
   lighter, cooler, lower in contrast, and less detailed.
6. Limited palettes. Each biome mixes 5-7 named pigments (for example
   sap green, burnt sienna, ultramarine, raw umber, quinacridone gold)
   plus one accent. Harmony beats realism.
7. Stability. It must never shimmer or swim. Paper grain is fixed to
   the screen. Wash variation and stroke texture are anchored in world
   space. Wobble may "boil" gently at 6-8 fps at most. Moving should
   feel like the painting calmly repainting itself.
8. Everything is painted: explorer, ship, HUD, menus, map, text,
   cursor, loading. Torn-paper panels, ink-and-wash icons,
   hand-lettered type. Space is not black: deep indigo and Payne's grey
   washes, salt-crystal textures, spattered masking-fluid stars,
   wet-in-wet nebulae. The sun is bare paper with a warm halo.
9. Life. Wind through foliage masses, drifting cloud washes, water as
   horizontal reflected strokes with bare-paper glints, falling leaves,
   snow, ash, or spores by biome, birds as a few brush marks. A
   day-night cycle shifts the whole palette: rose dawn, clear noon,
   gold dusk, indigo night.
10. Geometry serves the painting. Soft organic forms. Foliage as
    layered stroke clusters, not leaves. No visible facets, no texture
    tiling, no pop-in: detail arrives as strokes fading in.
No external art assets. Every texture, brush stamp, paper, and model is
generated in code.

=== 3. THE WORLDS ===
Game-scale spherical planets you can walk all the way around (radius
roughly 2-5 km) in a compressed solar system in the real order.
Accuracy is not required; beauty and variety are. Every planet has its
own palette, sky, weather, gravity feel, and at least 4 clearly
different biomes spread across its surface, so travelling over one
planet moves you through different paintings. All planets are landable;
gas giants get imagined surfaces.
- mercury: cracked ochre basins, obsidian glass fields, twilight-band
  crystal gardens, frozen shadow craters.
- venus: sulphur-gold haze; fungal tower forests in amber cloud, lava
  rivers through basalt, acid-lake terraces, pale mesas above the fog.
- earth (the showcase, most detailed): temperate forest of birch and
  pine with dappled light and a stream (the reference painting for the
  whole game), alpine meadow and snow peaks, sea cliffs and coast,
  autumn woodland, desert canyon, misty wetland.
- mars: rust canyons, dust-storm dunes, polar frost fields, dry
  riverbeds with sparse red-leaf groves.
- jupiter: floating sky-islands in banded cream and orange cloud seas,
  storm-wall cliffs at the Great Red Spot, hanging gardens, lightning
  plains.
- saturn: pale gold sky-islands with ring arcs across the sky, crystal
  reed fields, ring-shadow twilight zones, honey mist valleys.
- uranus: mint and aqua ice shelves, frozen-wave forests, pearl fog
  flats, glowing teal sinkholes.
- neptune: ultramarine storm seas with basalt stacks, blue-violet kelp
  forests, wind-carved ice spires, aurora tundra.
- bonus if on schedule: moon (silver-grey minimal washes, Earth in the
  sky), pluto (pale heart glacier, lilac mountains, long shadows).

=== 4. TECH RULES AND CONTRACT ===
- Three.js on WebGL2, plain ES modules, no build step, no framework.
  Vendor a pinned Three.js into /vendor. Zero runtime network requests.
  index.html at the repo root must run from any static host (GitHub
  Pages from main). Include .nojekyll.
- 60 fps at 1080p on an integrated-GPU laptop, never below 30. Dynamic
  resolution and three quality tiers.
- Keyboard and mouse with pointer lock. Gamepad if cheap.
- Seamless ground to space: cube-sphere quadtree terrain LOD, gravity
  toward the planet centre, floating origin, a depth strategy that
  survives planetary scale. If seamless is not solid by M2, fall back
  to a cloud-layer transition that hides a swap. A working game beats
  an elegant broken one.
- Deterministic seeds: the same planet on every visit. Save to
  localStorage inside try/catch.

File ownership is absolute. Never edit the other session's files; ask
in notes.
PAINTER owns: /src/render/**, /src/world/**, /src/art/**,
  /src/data/looks.js, /gallery.html, /docs/notes/painter.md
PILOT owns: /index.html, /src/main.js, /src/core/**, /src/player/**,
  /src/ship/**, /src/space/**, /src/ui/**, /src/audio/**,
  /src/data/bodies.js, /vendor/**, /tests/**, /README.md,
  /docs/notes/pilot.md

Interfaces (Painter implements, Pilot consumes):
  src/render/index.js
    createPainter(renderer) -> { render(scene, camera, dt),
      resize(w, h), setQuality(0|1|2),
      setMood({ bodyId, biomeWeights, timeOfDay, altitude01,
                inSpace01, speed01 }) }
  src/world/index.js
    createWorld(scene) -> {
      bodies,   // Map<id, Object3D>; Pilot positions each root per frame
      update(dt, cameraPos, activeBodyId),   // LOD, flora, weather
      sampleSurface(bodyId, unitDir) ->
        { radius, normal, biomeId, biomeWeights, isLiquid, slope },
      getVistas(bodyId) -> [{ id, name, unitDir }],
      setTime(bodyId, hours) }
  src/art/models.js
    createExplorer(), createShip() -> { object3D, animate(state, dt) }
  src/art/ui.css plus paper and icon generators: the painted UI theme
    that Pilot's UI uses.
  src/data/looks.js (Painter): palette, sky, biomes per body.
  src/data/bodies.js (Pilot): radius, gravity, orbit, rotation,
    atmosphere height per body.
Body ids: mercury, venus, earth, moon, mars, jupiter, saturn, uranus,
neptune, pluto.

Neither session ever waits for the other. Pilot builds against its own
stub (a grey noise sphere and plain renderer behind these same
interfaces, in /src/core/stubs). Painter builds in gallery.html (a
free-fly camera with planet, biome, time-of-day, and quality pickers).
Integration is swapping the stub import for the real one.
Contract changes: additive changes need only a note. Breaking changes
need a request in your notes and a yes in theirs first.

=== 5. WORKING TOGETHER ===
- Each session works on its own branch and states the branch name in
  its first report.
- Sync loop, at every milestone and every few commits in between:
  commit and push; git fetch; merge the other session's branch into
  yours (ownership keeps this conflict-free); read their notes file;
  answer them in yours; run their latest work with yours.
- Notes file sections: Status / Decisions / Needs from the other /
  Answers to the other / Ideas and critique. Share ideas freely and
  bluntly. If Pilot sees something ugly or Painter feels something
  clunky, write it down; the owner of that domain decides.
- Tie-breaks: look goes to Painter; feel, performance, and architecture
  go to Pilot; still stuck after one exchange, the coordinator decides.
  Never me.
- Commit and push work in progress often; a cloud sandbox can reset.
- Verify before claiming anything is done. Unit-test pure logic (noise,
  biome selection, orbital math, state machine, save). Run the game in
  a headless browser if one is available (software WebGL is fine),
  catch console errors, capture screenshots, and judge them honestly
  against the art bible. If you could not verify something visually,
  say so plainly instead of implying you did.

Milestones:
M1 Vertical slice. Painter: Earth's temperate forest passes the
   freeze-frame test in the gallery. Pilot: walk, jetpack, board, lift
   off to orbit, and land again on the stub. Then merge both ways so
   the slice plays inside the real painted forest.
M2 The system. Painter: all eight planets with 4+ biomes each, plus how
   each looks from orbit. Pilot: full solar-system flight, pulse drive
   between planets, landing anywhere, planet map, save. Merge. Fly
   earth to mars to saturn in one sitting with no reload.
M3 The painting comes alive. Painter: motion (wind, water, weather,
   day-night), space washes, the painted UI theme, and an art pass on
   the weakest biome of every planet. Pilot: HUD, sketchbook and
   vistas, audio, performance tiers, title screen, help card.
M4 Critique swap and ship. Each session plays the whole game and writes
   a blunt critique of the other's domain. Fix the worst issues. Pilot
   merges Painter's final branch, runs every check, opens one pull
   request to main, and merges it if able (you have my permission);
   otherwise says it is ready for my one tap.

Done means: a new player can open index.html, start on Earth in the
forest, walk, use the jetpack, board the ship, reach space, land on all
eight planets, and find different biomes on each; every frame along the
way passes the freeze-frame test; no console errors; the frame-rate
target holds; the README lists the controls.
Final message to me: how to play it (GitHub Pages from main), the
controls, what is in, what is still weak, and what you would do next.
```

## Role sections (the owner's brief, verbatim)

Stored here by the coordinator so that a restarted or replaced agent can read its role from the
repository. The PHYSICS role and the lead-developer duty were added later by the owner: see
`docs/COORDINATOR.md` sections F and G.

```
=== 6. ROLE: PAINTER (art and worlds) ===
You own how everything looks. Depth before breadth: make one forest
frame pass the freeze-frame test before building anything else, because
the pipeline is the product.
1. Watercolor pipeline. A suggested shape: scene passes (colour, depth,
   normals, region ids) -> abstraction -> edge detection for pooling,
   wobble, and graphite -> pigment density (turbulence, granulation,
   paper height) -> masked wet-in-wet bleed -> paper composite and
   ragged border. Improve on this freely.
2. Materials: world-space triplanar stroke and wash textures,
   value-stepped lighting, glaze shadows.
3. Terrain and biomes for every body, with smooth biome blending and
   painterly LOD.
4. Flora and prop kits per biome, instanced, built from stroke
   clusters.
5. Skies, clouds, weather, atmosphere seen from the ground and from
   orbit, and space itself.
6. Explorer and ship models with simple animation hooks.
7. The painted UI theme.
Study your own screenshots the way a painting teacher would, and
repaint whatever looks digital.

=== 7. ROLE: PILOT (systems and play) ===
You own how everything feels and that it all runs. You are also the
integrator.
1. Core loop and state machine: ON_FOOT, BOARDING, LANDED, ATMOSPHERE,
   SPACE, PULSE, LANDING.
2. Scale: floating origin, body positions, slow orbits and rotation,
   sun direction handed to Painter.
3. Explorer: capsule against sampleSurface, slope limits, jetpack with
   recharging fuel, wading in liquid, third and first person cameras
   that never clip.
4. Ship: forgiving arcade flight. Auto-level, landing assist with a
   clear prompt, soft bounces instead of crashes, a lift-off sequence,
   atmosphere entry and pulse-drive moments expressed through setMood,
   target markers for planets.
5. UI built on Painter's theme: minimal HUD, planet map, sketchbook,
   title screen, help card.
6. Audio, all procedural WebAudio: wind and ambience per biome, soft
   pads per planet, brush and paper sounds for the UI.
7. Performance budget, dynamic resolution, save, tests, README, deploy
   readiness.
Feel target: unhurried, weightless, generous. The player should never
fight the controls.
```
