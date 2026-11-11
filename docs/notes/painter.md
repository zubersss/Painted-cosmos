# PAINTER notes

Branch: `cosmos` (shared with PILOT and PHYSICS, one working tree). Commits: `tools/commit.sh painter`.
This file was rewritten by the second PAINTER agent (the first ran out of working context). The
first agent's record of M1 is kept at the end ("Earlier answers").

## Handover (read this first if you are a fresh PAINTER)

- **Where things stand**: M2's third pass is committed; every biome has its landform, an
  easel (the gallery view) and a stand (where the game arrives). What is weak is listed under
  "Weakest" below. M3 has not been started.
- **How to work here**: the machine is shared and slow (a 960x540 gallery frame takes 45 s
  to several minutes). Do not design landforms in the browser. Use a software preview: scan
  the surface function from Node (`getSurface(body).sample(x, y, z, o, true)` costs under a
  microsecond) and draw a small heightfield picture; `findVantage(body, biome, { search: true,
  top: 6 })` returns several candidate views to choose from by eye. My scratch tools did this
  (`/home/user/.pc-scratch/painter/pv.mjs` one preview, `pvs.mjs` a planet, `ez.mjs` candidate
  sheet, `mp.mjs` top-down map, `cost.mjs` frame cost, `arrive.mjs` build timing, `cmp.mjs`
  image difference, `ev3.sh` all evidence frames, `dump.mjs` rewrites `easels.js`); they are
  outside the repository and may be gone: each is under 100 lines to rewrite.
- **Rules that bit me**: scratch output must use absolute paths (a relative path lands in
  the repository); never change the easel search once frames are approved without re-rendering
  (that is why the easels are stored); run PILOT's tour from a clean export
  (`tools/export-head.sh dir`, then `cd dir && node tests/tour.mjs --bodies mars --root dir
  --out /home/user/.pc-scratch/painter/tour`) so its sheets do not land in PILOT's folder.
- **Next (M3, in the coordinator's order)**: 1. weather in the picture: sky, haze and sheet
  read `setMood.sky` (`painter.setMood` stores it; nothing reads it yet), then ground washes
  take `wet` and `snow`, then PHYSICS' wave chunk in the liquid material, then its kits with my
  materials (`makeKitMaterial` in its notes uses `makePaintUniforms` and the chunks); 2. real
  explorer and ship models; 3. motion and water, day-night pass, space washes; 4. repaint of
  the weakest biome of each planet (my list is under "Weakest"). The painted UI theme is
  PILOT's now (coordinator's ruling); I review its frames.

## Status

INTEGRATION: ready (latest `[painter]` commit; render, world and art usable on all ten bodies).

**M2, third pass: every biome of the eight planets now shows the feature the brief names, as
terrain in the surface function**; the per-biome table is below, with the frames I opened.
M1 stays closed. Moon and Pluto are untouched placeholders (they use the same recipes).

What changed in this pass (all in my files):

- **Landforms** (`src/world/surface.js`): new or rebuilt recipes: `canyon` (a plateau cut by a
  wandering network of gorges: dry floor, walls in steps with benches, buttes on the plateau),
  `mesa` (tables with cliffs all round and a talus skirt, two tiers), `terraced` (level treads
  ending in cliffs; with `pools` a rimmed pool on every tread, each at its own level), `wall`
  (one great escarpment in two lifts with folded buttresses), `spires` (wind-scoured ridges
  that the slim spire kit stands along), `dunes` (transverse dunes: long back, short slip
  face, smaller dunes on the backs, baked lee shade), `alpine` (flat meadow floors, sharp
  ridges whose crest height rises and falls, snow line), `coast` (cliffs at the shore, stacks
  in the shallows), `islands` (tables in a sea of water or cloud, islets, the rock fading into
  the cloud at its foot so the islands seem to float), craters on a cell grid laid over the
  cube-sphere faces (whole bowls of many sizes, flat floor, steep inner wall, rim, apron;
  frost in the bowls), ponds on flats. Cliff lips are rounded a little so the mesh shows no
  knife edge. Strata are painted in the shader from the height (`aColor.a`), strongest on
  steep faces. Fog lying in low ground (`t.fog`), lasting half-light (`twilight`) and a chosen
  hour (`hour`) are per biome.
- **Nothing stretched**: the terrain's brush marks no longer come from the triplanar stroke
  atlas (its streak channel smeared into long radial streaks). Marks are thresholds of the 3D
  noise, anchored to the planet, in two octaves cross-faded by distance so that a mark keeps
  about the same size on the sheet: soft dabs, a few crisp flecks (fewer on smooth sand and
  ice), dry-brush sparkle. Rocks likewise. Cracks: the cell pattern is now uneven (a quarter of
  the cells left out, coordinates bent), looked up through a warp, with lines that swell, thin
  and break off, at two sizes. Graphite outlines are fainter and more broken.
- **Kits**: hanging vines (a mound on the cliff lip and a curtain of strands falling down the
  face, placed on lips and turned to face out over the drop; not an obstacle), frozen waves as
  a swept profile (back, crest, curling lip, hollow), slim leaning ice spires, crystals that
  bow, tall things in groups with empty stretches (outside the woods), bushes and grass in each
  biome's own washes (`biome.under`).
- **From orbit**: banded worlds close into a full cloud deck seen from outside: belts along
  the latitude with weather-pushed edges, white streaks, and Jupiter's Great Red Spot standing
  over the first `storm_wall` site. Decks ride above the highest ground.
- **The easel** (`src/art/vantage.js`, `src/art/easels.js`): `cam=vista` no longer guesses. It
  scans the ground from candidate spots, keeps what is not hidden, and scores each view for
  what that kind of place should show (skyline, overlapping ridges, water with land beyond it,
  a wall, a hollow with its far side, a crest running into the picture, ring arcs in the sky,
  nothing standing in front of the lens). The spot chosen for each biome is kept in
  `easels.js`, so the evidence frames are reproducible.
- **Cost and readiness**: terrain and flora take turns at a frame's building slice; a flora
  step starts only if it is likely to fit; undergrowth placement rejects most candidates
  before sampling; steep ground is refined from further away (no rows of teeth on cliff
  lines), less so at quality 0; the low tier draws no full trees and 55 % of the undergrowth.
  `world.busy` draining after a change of body is now tested.

### Per biome: is the named feature in the frame?

Frames: `docs/shots/painter/<body>-<biome>.jpg` and `<body>-orbit.jpg`, 960x540, quality 1,
`gallery.html?ui=0&t=0&quality=1&body=..&biome=..&cam=vista` (orbit: `cam=orbit`; Jupiter's with
`&biome=storm_wall`). Each was rendered twice from the kept easels (the committed frame and a
second render compared with it by image difference: all 40 reproduce). **I opened every one of
the 40 at full size.** Verdicts are mine, as a painting teacher would give them.

| frame | what the brief names | in the frame? |
| --- | --- | --- |
| mercury-orbit | the planet by its washes | yes: grey disc, a dark glass region, ochre edge, pale crater dots |
| mercury-ochre_basins | cracked ochre basins | yes: wandering cracks in the near slab, a basin with low crater mounds |
| mercury-obsidian_fields | obsidian glass fields | yes: dark bowed blades on cracked grey ground |
| mercury-crystal_gardens | twilight-band crystal gardens | yes: violet crystals in a lasting dusk; crowded, one crystal too near the lens |
| mercury-shadow_craters | frozen shadow craters | yes: from the rim into a bowl, frost floor, far wall in blue shadow |
| venus-orbit | sulphur-gold haze | yes: gold disc with wandering orange belts |
| venus-fungal_towers | fungal towers in amber cloud | yes (busy, as the lead said; not repainted) |
| venus-lava_rivers | lava rivers through basalt | yes |
| venus-acid_terraces | acid-lake terraces | yes: a green lake among stepped yellow ground; the steps are soft |
| venus-pale_mesas | pale mesas above the fog | yes: a mesa's shadowed cliff, ghost mesas standing in sulphur fog |
| earth-orbit | the planet | yes |
| earth-autumn_woodland | autumn woodland | yes: birches, gold crowns, the brook mirroring them |
| earth-alpine_meadow | alpine meadow and snow peaks | yes: flowered meadow, pines, a snow massif |
| earth-sea_coast | sea cliffs and coast | yes: a cliff headland with trees on top, beach, sea |
| earth-desert_canyon | desert canyon | yes: banded walls both sides, a butte beyond |
| earth-misty_wetland | misty wetland | yes: pool, reeds, trees lost in mist; emptier than it should be |
| mars-orbit | the planet | yes: rust globe, pale cap, canyon traces |
| mars-rust_canyons | rust canyons | yes: stepped strata walls, a spire, boulders; the far wall goes grey in the haze |
| mars-dust_dunes | dust-storm dunes | yes: a crest running into the picture, lit backs and violet troughs, more dunes behind (painted at 16.2 h; at noon the forms are flatter) |
| mars-polar_frost | polar frost fields | yes, quietly: frost polygons drawn by hand, a low scarp, ice shards |
| mars-dry_riverbeds | dry riverbeds, red-leaf groves | yes for the groves; the bed is only a pale band |
| jupiter-orbit | banded cream and orange, the Red Spot | yes |
| jupiter-sky_islands | sky-islands in cloud seas | yes: a table island with trees, pillars and islands across the cloud sea |
| jupiter-storm_wall | storm-wall cliffs | yes: the wall above a red plain with spires, in storm light (the storm itself is weather, M3) |
| jupiter-hanging_gardens | hanging gardens | yes: curtains of vine falling down a cliff above a garden |
| jupiter-lightning_plains | lightning plains | partly: cracked plain, pits, glass shards, brooding light; no lightning yet |
| saturn-orbit | rings and gold belts | yes |
| saturn-gold_islands | gold sky-islands, ring arcs | yes: islands and islets in the cloud sea, the ring arc in the sky |
| saturn-crystal_reeds | crystal reed fields | yes |
| saturn-ring_shadow | ring-shadow twilight | yes: dim violet spires, the ring a pale streak |
| saturn-honey_mist | honey mist valleys | yes |
| uranus-orbit | mint and aqua | yes |
| uranus-ice_shelves | mint ice shelves | partly: cracked ice and one shelf cliff; the cliff is a rounded scarp, not a sharp table edge |
| uranus-frozen_waves | frozen-wave forests | partly: the waves still read as snow-capped mounds; one shows its curl |
| uranus-pearl_fog | pearl fog flats | yes: the ground and the shards go into the fog |
| uranus-teal_sinkholes | glowing teal sinkholes | yes: the pool inside its pit walls |
| neptune-orbit | ultramarine, storm streaks | yes |
| neptune-storm_seas | storm seas with basalt stacks | yes for sea and stacks; the sea is calm (weather, M3) |
| neptune-kelp_forests | blue-violet kelp forests | yes |
| neptune-ice_spires | wind-carved ice spires | yes: leaning needles in a row |
| neptune-aurora_tundra | aurora tundra | partly: tundra with ponds; no aurora (sky work, M3) |

Earth's home forest: `earth-forest-*.jpg` (the M1 set) regenerated with the new ground marks. Opened at full size: `earth-forest-trees-noon.jpg` (still passes: leaning birches, crowns as washes, the brook, a softer meadow). **Not opened after regeneration**: stream-noon, canopy, jet, dusk, dawn, night, high, models-in-forest, stability-a and -b.

By my count: 28 biomes yes, 5 partly (`lightning_plains`, `ice_shelves`, `frozen_waves`,
`aurora_tundra`, and the channel of `dry_riverbeds`), none missing; eight orbit views
recognisable.

### In the integrated game (PILOT's tour, on a clean export)

`node tests/tour.mjs --bodies <body> --root <export>` at 960x540, quality 1, third person. The
tour stands where `world.findBiome` says (now the biome's **stand**: level ground that shows
the biome whichever way one faces) and at every vista.
Run by me for all eight planets on exports of `0d8ce45` to `6d0a92e` (the stands and easels
did not change between them except Uranus' sinkhole stand, re-run on `ddb5758`). I opened the
biome frames of every planet (my own contact sheets of the tour's frames) and two vista frames
each of Jupiter and Saturn; **I did not open the other vista frames**.

- Every frame settled (5 to 62 s; before this pass they never did) and no run reported a
  console error. Jupiter's and Uranus' first runs ended "TOUR FAILED" only because the browser
  refused the final contact-sheet screenshot under load; their frames were captured.
- The game's own counters at the stands, quality 1 (budget 600 k, 350): Earth 302 to 573 k and
  181 to 336 calls (autumn woodland the heaviest), Venus 316 to 512 k, Jupiter 321 to 532 k,
  Saturn 294 to 402 k, Neptune 224 to 375 k, Mars 178 to 361 k, Mercury 196 to 358 k (309
  calls in the crystal gardens), Uranus 252 to 375 k. All inside.
- What the game frames show: Earth: forest by the brook, autumn birches (with long dark cast
  shadows across the ground: hard-edged, to soften), meadow under snow peaks, a sea inlet under
  cliffs, banded canyon walls and a butte, a misty pool. Mars: canyon floor between strata
  walls; dune swells (soft at 10 h); frost polygons (the ice shards read too violet in the
  game's light); red groves over a pale bed. Jupiter: island top with the cloud sea and other
  islands behind; the storm wall above the red plain; a vine-hung cliff over the garden;
  cracked plain with shards. Saturn: an island top facing another island's cliff, the ring in
  the sky; reeds; twilight spires; misty valley. Mercury: cracks; glass blades; crystals in
  dusk; a crater's far wall and rim. Venus: towers; lava; the acid lake; pale mesas in fog.
  Uranus: spires before a shelf; frozen swell (weak); fog; the glowing pool inside its pit (after the stand was moved down to it). Neptune: cliff, sea and a
  stack; kelp; leaning spires behind a ridge; tundra and a pond.
- Second-site vistas stood on cliffs in two Jupiter cases (44 and 68 degrees); they are now
  moved to standable ground (tested for every vista on all ten bodies).

### Frame cost

Gallery, 480x270, at each biome's easel, whole painted frame (`renderer.info` over one frame),
after settling. Budget: 600 k triangles and 350 draw calls at quality 1, 300 k at quality 0,
1.2 M at quality 2. Densest view of each planet:

| planet | quality 1 triangles | quality 1 draw calls | quality 0 | quality 2 |
| --- | --- | --- | --- | --- |
| mercury | 370 k (crystal_gardens) | 316 (crystal_gardens) | 195 k (crystal_gardens) | 415 k (crystal_gardens) |
| venus | 459 k (fungal_towers) | 233 (fungal_towers) | 274 k (fungal_towers) | 519 k (fungal_towers) |
| earth | 571 k (temperate_forest) | 315 (temperate_forest) | 394 k (misty_wetland) | 728 k (temperate_forest) |
| mars | 329 k (dry_riverbeds) | 219 (dry_riverbeds) | 210 k (dry_riverbeds) | 406 k (dry_riverbeds) |
| jupiter | 455 k (hanging_gardens) | 226 (sky_islands) | 296 k (hanging_gardens) | 513 k (hanging_gardens) |
| saturn | 381 k (gold_islands) | 229 (gold_islands) | 222 k (crystal_reeds) | 451 k (gold_islands) |
| uranus | 324 k (teal_sinkholes) | 183 (teal_sinkholes) | 165 k (pearl_fog) | 360 k (teal_sinkholes) |
| neptune | 404 k (aurora_tundra) | 269 (aurora_tundra) | 267 k (aurora_tundra) | 442 k (aurora_tundra) |

Every planet is inside the budget at quality 1 (worst: Earth's home forest, 571 k and 315
calls) and at quality 2 (worst 728 k). At quality 0 the first probe found two Earth views
over (wetland 394 k, alpine 312 k); the low tier was then trimmed (no full trees, half the
undergrowth, little extra refinement on cliffs, a coarser split) and re-measured: alpine
168 k, home forest 242 k, Jupiter's gardens 209 k, wetland 299 k (at the edge of the budget). The other planets' low
tier figures in the table are from before the trim (so they are upper bounds).
`sampleSurface`: 10 to 34 microseconds a call on the ten bodies in Node under load (budget 50;
tested). `world.update` while arriving: see the answer to the lead below.
### Not done, not verified, weakest (blunt)

- **Not verified on a real GPU**: frame rate, and `world.update` worst frames in wall-clock
  time (only counted work, in Node).
- **In the game the picture depends on PILOT's camera.** The stands help (each shows its
  biome in most directions) but the explorer looks toward the parked ship. Tour sheets I did
  not open are named above.
- Two easels stand on steep ground (`mercury/shadow_craters` on a crater rim at 34 degrees,
  `uranus/teal_sinkholes` at 26 degrees): fine for the gallery, awkward as vistas on foot.
- **Weakest biome of each planet, for the M3 repaint**: Mercury `ochre_basins` (the basin
  itself is hardly a hollow); Venus `acid_terraces` (soft steps) and `fungal_towers` (busy);
  Earth `misty_wetland` (empty) and the dark shadow patches in `autumn_woodland`; Mars
  `polar_frost` (quiet) and the bed of `dry_riverbeds`; Jupiter `lightning_plains`; Saturn
  `ring_shadow` (little relief); Uranus `frozen_waves` (mounds, not waves) and `ice_shelves`
  (rounded scarp); Neptune `aurora_tundra` (no aurora) and the calm `storm_seas`.
- Foregrounds are bare on most worlds; explorer and ship are still toys and are in every
  game frame; no weather, no night or dusk pass on the new worlds (frames are at noon, the
  dunes at 16.2 h); Moon and Pluto untouched.
- `jupiter-lightning_plains.jpg` was rendered just before crater rims were given rounded
  crests (its pits changed by centimetres); not re-rendered.
- The lead's review-3 SHOULD FIX 4 (Venus' towers) is not addressed.
- `world.update` deliberately takes up to 30 % of the frame when the smoothed frame time is
  above 80 ms (software rendering): PILOT's read-out will show "world worst" of 100 to 300 ms
  in headless runs. At real frame rates the slice is 4 ms. Say if you would rather have a
  switch.

## Contract changes in this pass (all additive)

- `world.findBiome(bodyId, biomeId)` -> `{ unitDir, yaw, pitch }`: now the **easel** of that
  biome (the dry, standable spot its picture was painted from) and the way the painter faced
  (`yaw` from local north toward east, `pitch`, radians; north = `up x (Y x up)`). Falls back
  to the biome's first site (yaw 0) on the Moon and Pluto.
- `world.getVistas(bodyId)`: the first vista of each biome (`<body>-<biome>-1`, same ids as
  before) is now that easel and carries `yaw` and `pitch`; second sites follow as before.
- `world.sampleObstacles(bodyId, unitDir, radius, soft)`: `soft === true` also lists bushes
  (`kind: 'bush'`); default unchanged. Hanging vines are never listed.
- `src/render/index.js` also exports `makePaintUniforms(bodyUniforms?, own?)` and the three
  scene chunks `VERT_PARS`, `VERT_END`, `FRAG_PARS` (for PHYSICS' kits).
- `looks.js` biome fields: `under` (own undergrowth washes), `twilight`, `hour`, `want`,
  `hang`, `t.fog`, `t.strata` and the recipe parameters; body fields `deck` (cloud deck from
  outside: height, belts, wobble, colours, streaks, storm) and `fine` (one more terrain level).
- Spawns moved on every body except Earth (the search now wants level, dry ground out to
  13 m); Jupiter has hand-placed sites now and its spawn stands on a sky-island. Every
  landform changed: PILOT's landings and the trip need re-running.
- Gallery: `cam=vista` uses the kept easel; without `time=` the biome's `hour` applies (only
  Mars' dunes name one: 16.2 h); `cam=orbit` over a banded world stands over the low latitudes;
  `cam=orbit&biome=storm_wall` centres Jupiter's Great Red Spot.

## Answers to the lead (review 3) and to PILOT's numbered needs

- **MUST FIX 1, Neptune's spawn 727 k**: fixed. Gallery, standing at the spawn: 318 k triangles and 174 draw calls at quality 1, 165 k at quality 0 (the lead measured 727 k in the game before; PILOT's tour now reads the game's own counters at each stand, below).
  Every view measured is in the table above; the densest is Earth's home forest.
- **SHOULD FIX 2, `world.busy` never drains after a change of body**: fixed and tested
  (`src/world/busy.test.mjs`: Earth, Mars, Neptune, Mercury, Earth again, then deep space; and a
  body left with work queued). A body that stops being the active one drops its queues on the
  next update.
- **SHOULD FIX 3, `world.update` 8.5 to 9.4 ms while building**: the cause was a full terrain
  slice plus a flora step in the same frame. They now take turns and a flora step starts only
  if it fits. Counted in work (surface samples, in Node, where machine load does not hide it)
  the heaviest frame of an arrival is about 4.2 ms at the 5 ms budget; wall-clock spikes above
  that remain on this shared machine (scavenges and pre-emption), so a real GPU run is still
  owed. The test asserts the counted figure.
- SHOULD FIX 4 (Venus' fungal towers too busy): not repainted in this pass.
- SHOULD FIX 5 (Neptune's storm sea is calm): the sea now has stacks standing in it; the storm
  is weather (M3).
- PILOT 4 (ceiling): tested for all ten bodies. PILOT 5 (liquid edges): unchanged mechanism
  (a berm closes each liquid at the edge of its group); pools on terraces switch level on a
  dry rim, never on a wall. PILOT 6 (spawns): tested dry, under 0.12 rad at the spot and under
  0.30 rad out to 12 m on the eight planets, Moon and Pluto. PILOT 7 (vistas): the first vista
  of each biome is a spot I stood on; markers are not painted yet (M3). PILOT 8 to 11: M3,
  nothing delivered yet.

## For PHYSICS (complete on its own)

Your six gaps:
1. *No public constructor for the uniforms `FRAG_PARS` needs*: `makePaintUniforms(bodyUniforms?,
   own?)` from `src/render/index.js` (commit `ebd9b4d`). Pass `world.bodyUniforms(bodyId)` to be
   lit and hazed like that body.
2. *Chunks not re-exported*: `VERT_PARS`, `VERT_END`, `FRAG_PARS` are exported from
   `src/render/index.js`.
3. *An opaque pass cannot glaze*: agreed, and it is mine to solve. Plan for M3: kits write the
   **change of pigment density** they cause rather than ink of their own. Ground marks go
   through the terrain itself (I take your ground-mark field as a texture around the focus and
   darken, lighten or wet my own wash in the terrain shader, so a print in litter is litter
   pressed down, not a brown blot). Airborne kinds (dust, spray) get one small blended target
   that the abstraction pass multiplies in. Your ground-material tag on every particle is what
   I need for the first; keep it.
4. *The 3 px floor of the post pass*: by design (art bible 4: detail becomes brush-sized
   shapes). Rain will be drawn as a few broad slanted strokes and a veil on the far bands,
   snow as soft dabs of bare paper, both at sizes that survive; your size floor is right.
5. *Waves*: yes. My liquid material will take your chunk (displacement, slope, crest, foam
   measure, wakes) as an include; it already has per-vertex liquid look (colour, mirror, glow,
   cloud) and reflects the previous frame.
6. *Nothing reads the weather*: first M3 block, in the coordinator's order: sky, haze and
   sheet from `setMood.sky` (`cloud`, `overcast`, `haze`, `fog`, `dust`, `flash`), then ground
   washes (`wet`, `snow`), then waves, then the kits.

Your earlier needs: (2) ground words: keep yours. (3) Cloud seas carrying the explorer as a
froth: fine with me. (4) Ground under a cloud sea lies 40 m below it and under lava about 3 m;
both liquids are opaque, so it is never seen from above; it would be seen by anything that
sank. New liquids in this pass: ponds on Neptune's tundra (`aurora_tundra`, shallow water) and a
pool on every tread of Venus' acid terraces, each at its own level. New ground you may want
words for: `polar_frost` is terraced ice scarps now; `ice_spires` low wind-scoured ridges;
`storm_wall` a great cliff with a talus skirt; biome ids are unchanged.

The material contract for a kit is unchanged: one opaque pass into two targets, holes by
`discard`; output 0 `vec4(wash, wetness)` (wash = transmittance over paper, 1 = bare paper),
output 1 `vec4(viewNormal.xy, log2(1 + viewDepth), regionId)` (0 sky, 1 ground, 2 liquid,
3 solid prop, 4 foliage, 5 characters); call `pcWrite(col, wet, nV, -viewPos.z, id)`; set
`material.userData.pcPainted = true`.

## How to use my modules

```js
import { createPainter, RENDERER_OPTIONS, makeWashMaterial, makePaintUniforms } from './src/render/index.js';
import { createWorld } from './src/world/index.js';
import { createExplorer, createShip } from './src/art/models.js';
```
- `world.busy`: pending build jobs (terrain + flora), 0 when nothing is left to build for the
  current camera. `world.setBuildBudget(ms)`: the building slice inside `update` (default 5).
- `world.getLighting()` -> `{ bodyId, sunElevation, hours, dayness, altitude, space01 }`.
- `world.sampleSurface` adds `liquidRadius`, `canopyHeight`, `canopy01`.
- `world.sampleObstacles(bodyId, unitDir, radius)` -> `[{ unitDir, radius, height, kind }]`,
  within `radius` metres (max 60), unsorted.
- Quality tiers scale flora ranges (0.42 / 0.82 / 1.0) and the terrain split factor; tier 0
  also draws no full trees and 55 % of the undergrowth.

## Gallery URL parameters (C13)

`gallery.html?body=earth&biome=temperate_forest&quality=1&cam=vista&ui=0&t=0`
- `cam`: `vista` (the kept easel of the biome), `stream`, `trees`, `canopy`, `jet` (30 m up),
  `high` (420 m), `orbit`; `time=` hours (default 12, or the biome's `hour`)
- `t=0` freezes wind and drift (deterministic frames); `ui=0` hides the panel
- `view=1..5`: scene colour, wetness, normal + depth, regions, abstraction
- `dx, dy, dz` (metres), `yaw`, `pitch` (degrees) nudge the camera; `scale`, `fov`, `models=1`,
  `physics=1`, `look=pooling:1,granulation:1,wobble:2.6,graphite:0.4,border:1,abstraction:1,bleed:0.8`
- `window.__pcReady` once terrain and flora have settled and three frames are painted;
  `window.__pcVantage` the easel in use.

## Decisions

- **Colour model**: every scene colour is the transmittance of a wash over paper; layering
  multiplies; the sheet pass multiplies by the paper colour.
- **Pipeline**: scene MRT -> half-res prep -> abstraction (mip Kuwahara, wet-in-wet bleed) ->
  sheet (wobble, pooling, granulation, graphite, ragged border, paper). Only the paper is
  anchored to the screen.
- **Marks are 3D** (this pass): anything laid on the ground or on rock comes from noise
  anchored to the planet in three dimensions; the 2D stroke atlas is kept for bark (along the
  trunk) and for the crack network (looked up through a warp).
- **Form may be baked**: slip faces, cliff faces, cut banks and the undersides of cliff lips
  carry a second, cooler wash in the vertex colour, so landforms read at noon as well as in
  raking light. Strata are computed in the shader from the height.
- **Terrain**: cube-sphere quadtree, 32 x 32 patches, geomorph, skirts, resumable generation;
  patches holding much relief for their size split from further away.
- **Biomes**: hand-placed sites (Earth, Mars, Saturn, Jupiter) or a jittered Fibonacci sphere,
  warped Voronoi, about 280 m blends; liquid keeps its true level inside its group.
- **The easel is data**: found by search, looked at, kept (`src/art/easels.js`); the same
  spots are the game's vistas.
- **Time of day**: light keys blend by the sun's elevation at the camera; a biome's `twilight`
  moves the day key toward dusk and night (ring shadow, storm wall, shadowed craters).

## Ideas and critique

- (self, blunt) The gallery frames are chosen views. In the game the explorer faces wherever
  the ship was parked, so a biome's picture depends on PILOT's camera; see "Needs".
- (self) Foregrounds are still the weak half of most frames: one broad wash with a few marks.
  The next thing to paint is near ground: stones, tufts, cast shadows of the tall kits.
- (self) Tall rock kits (spires, crystals, waves) are single smooth forms with one wash each;
  up close their tone steps are soft but they have no crevices. Frozen waves still read as
  mounds from behind.
- (self) Distant cliffs lose their local colour to the cool haze on the warm-skied planets
  (Jupiter's islands and storm wall go grey-green); the haze should lean toward each sky.
- (to PILOT) The third-person camera looks at the ship from wherever the explorer lands. A
  landscape wants the explorer small in the lower third and the land ahead: if the camera sat
  a little higher and looked past the explorer toward the open side, every arrival would be a
  better picture.
- (to PHYSICS) Grass at 47 degrees in a breeze is too much for a painting: a field that
  leans that far reads as flattened. I will scale the bend I draw (not your model) in M3.

## Tests

`node --test src/world/*.test.mjs`: 19 tests: the 12 of M1 (noise, cube-sphere, biome coverage,
`sampleSurface` purity, Earth spawn, liquid, vistas, patch edges, mesh and sample agreement,
ceiling, flora determinism, obstacles), and new: every planet's arrival place is level and
dry with room for the ship; `sampleSurface` under 0.05 ms a call on every body; every kept
easel stands on dry ground of its own biome and is that biome's first vista; every vista is a place a walker can stand; `world.busy`
reaches 0 at the spawn, after every change of body and in deep space; jobs of a body just left
are dropped at once; the heaviest frame of an arrival fits the building slice.

## Earlier answers (first PAINTER agent, M1; kept for the record)

- Lead review 1, MUST FIX 1 to 3 (frame cost, stippled foliage, ruler-straight lines): fixed in
  `b2bfcae`, closed by lead review 2. Every tree is submitted once in the tier its distance
  puts it in (near about 650 triangles, mid about 180, far 26); crowns are a few overlapping
  washes; trunks lean and bend; the brook's bank wanders; trees stand in clumps.
- PHYSICS wiring of the flora field: done in `1e1801e` (`world.setPhysics`; undergrowth uses
  the full bend, bushes and near trees the lite one). `FLORA_PHYS` (plant height and stiffness
  per kit) is exported from `src/world/florakit.js`.
- PILOT: `hatch` is on the ground 2.3 m left of the ship's centre line, `seat` at
  (0, 1.75, -1.3); `sampleObstacles` shares the placement cells with the painted flora.
