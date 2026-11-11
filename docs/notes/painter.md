# PAINTER notes

Branch: `cosmos` (shared with PILOT and PHYSICS, one working tree). Commits: `tools/commit.sh painter`.

## Status

INTEGRATION: ready (commit `b2bfcae` and later; render, world and art are all usable)

M1 (Painter's half): the temperate forest is built and the three MUST FIX of lead review 1 are
answered below with numbers and frames. Waiting on the lead's re-review.

- `src/render/index.js`: `createPainter(renderer)`, `RENDERER_OPTIONS`, `makeWashMaterial`,
  `setRenderScale`, `setQuality`, `setMood`. Works.
- `src/world/index.js`: `createWorld(scene)`: ten bodies (earth detailed; the other nine are
  placeholders with 4 biomes each), `world.sun`, `update`, `sampleSurface` (with `liquidRadius`,
  `canopyHeight`, `canopy01`), `sampleObstacles`, `getSpawn`, `getVistas`, `setTime`,
  `setVistaFound`, `busy`, `setBuildBudget`, `getLighting`, `setPhysics` (stores it; not read yet).
- Earth's temperate forest: birch and pine in clumps, undergrowth (grass, ferns, reeds, bushes,
  poppies, stones), a brook with mirrored reflections, dappled light, day / dawn / dusk / night.
- `src/art/models.js`: explorer and ship are still **placeholder shapes** (contract-correct
  sizes, `seat`, `hatch`, `animate`; a windscreen hoop and cowl are visible from the seat).
- `gallery.html`: free-fly camera, pickers, URL parameters (below).

Not done / rough: autumn woodland and the four other earth biomes are placeholders; the other
nine bodies are noise spheres with palettes; space is a first-pass wash (the grain reads as
pepper there, lead finding 8); painted UI theme not started; no weather; flora sway is still my
two-sine placeholder (PHYSICS' field goes in during M2/M3).

## Answers to lead review 1 (at `19f72ce`)

**MUST FIX 1, frame cost: fixed in `b2bfcae`.** Measured with a probe like yours
(`renderer.info` summed over one whole painted frame, gallery at 480x270, standing at the spawn):

| view | quality 0 | quality 1 | quality 2 | budget (q0 / q1 / q2) |
| --- | --- | --- | --- | --- |
| `cam=trees` triangles | 281 k | 519 k | 672 k | 300 k / 600 k / 1.2 M |
| `cam=trees` draw calls | 183 | 287 | 356 | - / 350 / - |
| `cam=stream` | 291 k, 188 | 496 k, 301 | - | |
| `cam=jet` (30 m up) | - | 543 k, 307 | - | |

Before: 4.23 M triangles and 699 calls in the same probe. What changed:
- Every tree is submitted once, in the tier its own distance puts it in (tiers are assigned on
  the CPU into dynamic instance buffers; nothing is drawn collapsed). Near tree about 650
  triangles (to 52 m x quality scale), mid tree about 180 (to 128 m), far tree **26 triangles**
  (one shared form for every species, tapered in the shader for pines; beyond 300 m one tree in
  three is kept and drawn half again as large). Far trees are batched in 98 m cells, one draw
  call a cell for all species.
- Undergrowth: one mesh per kind, rare kinds batched in 49 m cells, short-range grass submitted
  only from the cells that can show it; the low tier leaves out bushes.
- Terrain: split factor 0.75 / 1.12 / 1.25 by quality; brook water dropped from coarse patches.
- `world.update` now has one shared time slice: terrain patches are resumable jobs (they stop
  mid-patch when the slice is used), big flora cells are assembled a quarter at a time.
  Measured from Node driving the same code (no browser; machine load average 9 at the time):
  walking 5 m/s avg 0.37 ms, p99 5.3, max 8.3 (4 of 900 frames over 5.5 ms); running avg 0.40,
  max 5.6; flying 46 m/s at 120 m avg 0.76, p99 5.3, max 9.4. In the browser on this shared
  box single frames still show 20 to 50 ms stalls in stages that do no work (pre-emption), so I
  cannot prove a hard 5 ms worst case here. **Not verified on a real GPU or an idle machine.**

**MUST FIX 2, stippled foliage: fixed in `b2bfcae`.** Crowns are now a few large overlapping
washes: 6 to 7 blobs near, 2 mid, 1 far, each wash at its own value, with a few dark touches.
The dab pattern that breaks the edges and modulates the tone is now sized on the sheet, not in
the world: two octaves cross-faded by distance, anchored to the tree, so a crown at 60 m gets
dabs eight times larger than one at 7 m (AB 4: far things are fewer, larger strokes). Paper
grain no longer shrinks below about 3 px at small viewports (it was 1 px pepper at 480x270).
Frames: `earth-forest-trees-noon.jpg`, `earth-forest-stream-noon.jpg`, `earth-forest-jet-noon.jpg`.

**MUST FIX 3, ruler-straight lines: fixed in `b2bfcae`.** Trunks: each variant leans and
S-bends with ring-to-ring kinks, girth varies per tree (0.82 to 1.22) and along the trunk, the
instance lean is up to 9 degrees for birch, the silhouette is nibbled by a noise that runs up
the trunk (the stroke thins and swells), and soft grey washes drift up the pale bark so it is
never one even white. The brook's waterline now wanders (two octaves of bank noise, about
+-1.5 m), so the bank is coves and points. Trees are placed in clumps with gaps (two
candidates per cell thinned by a clump field; birches gather in groves) instead of a jittered
grid, which also answers SHOULD FIX 6.

SHOULD FIX, short answers:
- 4 (no depth in the wood): visibility at ground level 250 -> 185 m, and haze is per tree, so
  each trunk sits in one flat distance band. Visible in `earth-forest-trees-noon.jpg`.
- 5 (flat foreground): partly. The ground now has dark brush flicks, drifts of green and warm
  earth, more dry brush in glades. Still the weakest part of the picture; see critique below.
- 7 (night, dusk): night light is now a dim even moonlight (nothing near black) and the trunks
  take the glaze; dusk and dawn tint local washes and the sheet. Frames `...-stream-night.jpg`,
  `...-stream-dusk.jpg`, `...-trees-dawn.jpg`. Good enough to stop building on the old one; a
  real art pass is M3.
- 8 (space grain, planet rim): agreed, M2/M3. Not touched.
- 9 (build hitches): see MUST FIX 1.
- 10 (`sampleSurface` cost): unchanged except one fuller sample for `canopy01`/`canopyHeight`
  on bodies that have flora; about 6 microseconds a call in Node here.

## How to use my modules

```js
import { createPainter, RENDERER_OPTIONS, makeWashMaterial } from './src/render/index.js';
import { createWorld } from './src/world/index.js';
import { createExplorer, createShip } from './src/art/models.js';
```
- `world.busy`: pending build jobs (terrain + flora), 0 when nothing is left to build for the
  current camera. `world.setBuildBudget(ms)`: the time slice for building inside `update`
  (default 5; use about 50 for a loading screen).
- `world.getLighting()` -> `{ bodyId, sunElevation, hours, dayness, altitude, space01 }`.
- `world.sampleSurface(bodyId, unitDir)` adds `liquidRadius`, `canopyHeight` (metres; the
  tallest thing likely to stand there, 0 on open ground: fly above `radius + canopyHeight`) and
  `canopy01` (closed-canopy fraction, 0 in a glade; for PHYSICS' wind shelter).
- `world.sampleObstacles(bodyId, unitDir, radius)` -> `[{ unitDir, radius, height, kind }]`:
  trunks and boulders within `radius` metres (max 60). Same placement data as the painted flora.
- Foreign objects are painted with a wash stand-in (Mesh, Line, Points, Sprite).
- Quality tiers also scale flora ranges (0.42 / 0.82 / 1.0) and the terrain split factor.

## Gallery URL parameters (C13)

`gallery.html?body=earth&biome=temperate_forest&time=12&quality=1&cam=stream&ui=0&t=0`

- `cam`: `stream` (on the bank, looking along the water), `trees`, `canopy` (looking up), `jet`
  (30 m up), `high` (420 m), `orbit`
- `t=0` freezes wind and drift (deterministic frames; two runs give identical pixels);
  `ui=0` hides the panel
- `view=1..5`: scene colour, wetness, normal + depth, regions, abstraction
- `dx, dy, dz` (metres right / up / forward), `yaw`, `pitch` (degrees) nudge the preset camera
- `scale`, `fov`, `models=1` (explorer and ship), `look=pooling:1,granulation:1,wobble:2.6,graphite:0.55,border:1,abstraction:1,bleed:0.8`
- `window.__pcReady` is set once terrain and flora have settled and three frames are painted.

Evidence frames (`docs/shots/painter/`, regenerated at `b2bfcae`; all `ui=0&t=0`, 960x540,
quality 1 unless noted):
`earth-forest-stream-noon.jpg` (`quality=2`, 1280x720), `earth-forest-trees-noon.jpg`
(`cam=trees`), `earth-forest-canopy-noon.jpg` (`cam=canopy`), `earth-forest-jet-noon.jpg`
(`cam=jet`), `earth-forest-stream-dusk.jpg` (`time=18.2`), `earth-forest-trees-dawn.jpg`
(`cam=trees&time=6.7`), `earth-forest-stream-night.jpg` (`time=23`), `earth-high-noon.jpg`
(`cam=high`), `models-in-forest.jpg` (`cam=trees&models=1`), `stability-a.jpg` /
`stability-b.jpg` (`cam=trees&yaw=20` and the same with `dx=0.01`).

## Decisions

- **Colour model.** Every scene colour is the transmittance of a wash over paper: (1,1,1) is
  bare paper. Layering multiplies. The sheet pass multiplies by the paper colour (#F4EFE4).
- **Pipeline**: scene MRT (colour + wetness, normal + log depth + region) at internal
  resolution -> half-res prep (mean colour and luma variance; wetness-weighted colour;
  mipmapped) -> abstraction (8-sector Kuwahara read from mips, about 9 fetches; wet-in-wet
  bleed) -> sheet at output resolution (paper wobble, pigment pooling, granulation in the
  paper's pits, graphite, ragged border, paper) -> a half-res copy of the painting and depth
  kept for next frame's water reflections. Paper grain, wobble and border are the only
  screen-anchored things.
- **In the materials**: 4 soft value steps, cool glaze shadows, pigment-density turbulence,
  dry brush, banded aerial perspective, dappled light, all in body-local space from a mipmapped
  3D noise texture and a triplanar stroke atlas generated in code at start-up.
- **Dappled light without shadow maps**: a leaf-shadow pattern projected along the sun in
  body-local space, shared by ground, trunks and foliage.
- **Water** mirrors the painting itself: a 12-step march through last frame's depth, broken by
  world-anchored ripples, with a painted sky / tree-line fallback, bed colour in the shallows
  and bare-paper glints.
- **Terrain**: cube-sphere quadtree, 32x32 patches, geomorph to the parent mesh, skirts,
  resumable generation. Height, biome weights, ground wash and flora density come from one pure
  function (`src/world/surface.js`).
- **Biomes**: hand-placed sites per body, warped Voronoi, about 280 m blends. Liquid keeps its
  true level; a berm closes it off at the edge of its biome group.
- **The brook**: zero contour of a warped noise field divided by its gradient (about 5 m wide),
  always in a valley, with a wandering waterline. `getSpawn('earth')` picks a flat spot about
  12 m from a narrow stretch and clears an 11 m glade for the ship.
- **Time of day**: light keys blend by the real sun elevation at the camera (rose when the sun
  is in the east, gold in the west). `setTime(bodyId, h)` forces it for the gallery.

## Needs from the other

- PILOT (lead): please re-run your frame-cost probe and the play-through at `b2bfcae` or later
  and re-review the three MUST FIX. If your probe still shows a `world.update` frame over 5 ms
  on an idle machine, tell me which stage (`world._prof` holds the longest time each stage has
  taken: `terrain`, `wanted`, `build`, `retier`).
- PILOT: `setMood` values are stored; nothing reads `speed01` / `altitude01` yet (pulse-drive
  and entry looks are M3). Tell me if you want any of them to change the picture sooner.
- PHYSICS: none blocking.

## Answers to the other

- PILOT need 1 (terrain ceiling): tested for all ten bodies in `src/world/surface.test.mjs`
  (max height under `0.8 * spaceAltitude`).
- PILOT need 4 (models): `hatch` is on the ground 2.3 m left of the centre line; `seat` is at
  (0, 1.75, -1.3). From the seat you now see a windscreen hoop, two rails and the cowl; the hull
  itself is culled from inside. Real ship and cockpit: M3.
- PILOT need 6 (trees): `world.sampleObstacles` (above); strokes within about 1.5 m of the eye
  part (noise-dithered) so a trunk never fills the screen; `canopyHeight` for the ship.
- PILOT critique (ground readable underfoot): the ground wash carries dabs, flicks and dry
  brush at 2 m and 8 m scales anchored to the planet; it should read as moving at a walk.
- PHYSICS (C14) 1: `canopy01` and `canopyHeight` are on `sampleSurface` (commit `b2bfcae`).
- PHYSICS 2: plant heights and stiffness are exported as `FLORA_PHYS` from
  `src/world/florakit.js`: grass 0.5 m / 0, reed 1.4 / 0.05, fern 0.6 / 0.05, flower 0.58 / 0,
  bush 1.3 / 0.35, birch 13 / 1, pine 18 / 1 (model height before instance scale, stiffness).
- PHYSICS 3: your ground table matches what I paint for earth (`temperate_forest: 'litter'` is
  right: grass over leaf and needle litter, mud at the brook). No `phys` overrides needed yet;
  I will add `phys: { ground }` in `looks.js` when M2 biomes differ.
- PHYSICS wiring: the sway is one function, `pcSway` in `PROP_VERT`
  (`src/render/materials.js`), called on one line; that is where `pcPhysBend` /
  `pcPhysDisplace` go. I will apply your chunk to grass, ferns, reeds, flowers, bushes and the
  near tree tier only; mid and far trees take the low-resolution wind. Planned with M2.

## Ideas and critique

- (self, blunt) Weakest things in the forest today: the open foreground is still mostly one
  wash with hatch-like flicks all running the same way (the triplanar axis); far pines right at
  the tier switch are paler than their neighbours; poppies are flat discs; granulation in dark
  passages and at night still reads as specks; the explorer and ship look like toys.
- (to PILOT) Review 1 measured the game at `scale=0.5&quality=0` on a 480x270 canvas: about
  150x84 internal pixels. No painting survives that; please judge look at 960x540 or more with
  `quality>=1`, and cost at whatever is fastest.
- (to PILOT) The third-person camera sits 5.6 m behind the explorer; at that distance the
  placeholder explorer is a few dozen pixels and reads as a toy. Until the real model exists a
  slightly longer boom would hide it better.
- (to PHYSICS) If the flora chunk costs 12 fetches per vertex, grass (6 blades, 36 vertices a
  tuft) is fine but please give me a per-instance variant too (evaluate the field once at the
  root, pass the bend to every vertex); with `PC_PHYS_LINEAR` that is 3 fetches a plant.

## Tests

- `node --test src/world/*.test.mjs`: 12 tests of pure logic (noise, cube-sphere, biome
  coverage, `sampleSurface` purity, spawn, liquid, vistas, patch edges, mesh / sample agreement,
  terrain ceiling, flora determinism, obstacles).
