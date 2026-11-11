# PHYSICS notes

Branch: `cosmos` (shared with PAINTER and PILOT, one working tree). Commits: `tools/commit.sh physics`.
Owner of: `src/physics/**`, `physics-lab.html`, `docs/notes/physics.md`, `docs/shots/physics/**`.

## Hand-over (kept current; last written at the end of P7 by the fourth PHYSICS agent)

This file is meant to be enough on its own. Read this section top to bottom once; the code
comments carry the physics (every module starts with what it models and from which source).

**Where things stand.** P1 to P6 are accepted. P7 (tune against the picture; the coordinator's
order of this run, plus the lead's review 4 and 5 items that arrived during it) is done as far
as the list below says. The tree is green at the commit that carries this note:
`node --test src/physics/` **220 pass**; PILOT's `node --test tests/*.test.mjs` 105 pass on a
clean export of HEAD with my files (the shared working tree itself had PILOT's half-edited
`src/core/sim.js` failing one of its own tests while I worked: check PILOT's suite on an
export, see below). Worst `physics.update` frame 0.48 to 1.35 ms (`p5/cost.mjs`). Nothing is
half-edited. PAINTER (its fourth agent) is working from "For PAINTER" right now: **if you
change a uniform, an export or a call named there, say so at the top of that section in the
same commit.**

**How to work here** (all of it learned the hard way):
- Commit only with `tools/commit.sh physics "message"`; own only `src/physics/**`,
  `physics-lab.html`, this file, `docs/shots/physics/**` (at most 12 jpg). The coordinator
  sometimes snapshots the working tree as it is (`[physics] WIP snapshot`): never leave it
  red for longer than one command, and run the whole suite after every multi-file edit (I
  left an undefined name in `index.js` for a minute; every page that loads the physics would
  have failed in that minute).
- **The coordinator snapshots the working tree while you work** (`[physics] WIP snapshot`): my
  first P7 code went in under that name, mid-edit, and the lead ran my tests on it (196 of
  197). Keep every state between two commands green.
- **PILOT's suite on a clean tree with your files**: `tools/export-head.sh <dir>`, then
  `cp -r src/physics/. <dir>/src/physics/`, then run `node --test tests/*.test.mjs` in `<dir>`.
  The shared tree usually has someone's half-written file in it. One of PILOT's tests
  (`tests/physics.test.mjs:27`, walking and running) failed once in four runs under heavy load
  and passed alone: it is the load, not the code.
- **A test world must be the body's own size**: `makeWorld({ R: BODIES[id].radius })`. With
  any other radius the place is hundreds of metres above or below the weather and every sky
  number is constant (I measured "rates" of zero for an hour before I saw it).
- Scratch goes in `/home/user/.pc-scratch/physics/`. New in `p7/`: `crawl.mjs` (the P6 one with
  this stage's kit arithmetic), `rates.mjs` (the fastest any sky number moves, 150 places a
  biome), `paths.mjs` (`physics.here.sky` against `physics.sky(physics.weather())`),
  `stormwind.mjs` (the lead's table: wind at 2, 10, 30 m through each storm), `sea.mjs`
  (wind sea and swell at a liquid biome), `wake.mjs` (the walker's wake against a twin world),
  `nodeplay.mjs` (the P6 one pointed at the export `p7/head`), `fresh2.mjs`. What was there
  before and worth knowing:
  - `p6/crawl.mjs <repo root> <blizzard|dust|storm> <still|pan|walk|orbit>`: the kits'
    marks followed from frame to frame WITHOUT GL (pure `expand.js`), counting what a painting
    may not do: marks that vanish or appear at full size, marks that jump, marks that strobe.
    `p6/base` is an export of the tree before P6 to compare with (`tools/export-head.sh`).
  - `p6/nodeplay.mjs <body>`: the integrated game (PILOT's pure `Sim`, PAINTER's real ground
    and obstacles, my physics) played with scripted keys at exactly 60 Hz in Node: the
    numbers of the tables under "The integrated game, played in P6". Takes a minute a body.
  - `p6/play.mjs <body>` (the first agent's `browserplay.mjs`) and `p6/fly2.mjs <body>`: the
    same in a real browser with real key events (software GL, 1 to 4 frames a second: use
    them to see that it works with keys, not for numbers).
  - `p5/cost.mjs <repo root>`: the worst reproducible frame of `physics.update` in five
    scenes, for any tree, so two commits can be compared under the same load.
  - `p6/curv.mjs`, `p6/bench.mjs`: the two checks behind the curved-ground fix and the cost
    of the dab expander.
- Tests: `node --test src/physics/` runs everything through `all.test.mjs`. Keep the output
  short (`| grep -E '^# (pass|fail)|^not ok|error:' | head`): a red run prints pages.
- The pure core must not import three. Only `src/physics/three/` may (`kits.js`,
  `painted-lab.js`); `three/expand.js` and `three/chunks.glsl.js` are pure and tested in Node.
- Headless pictures: `node tools/shot.mjs "<page>?<query>" out.png --w 960 --h 540 [--eval js]
  --timeout 500000 --shot-timeout 240000`. The painted lab (`physics-lab.html?painted=1&...`)
  takes two to five minutes a page; run two at once in the background and wait on their
  files (`until [ -s out.png ]; do sleep 5; done`). **Any change to `flora.glsl.js` is
  compiled into PAINTER's plants at once: load the painted lab and read "no console errors"
  before committing it.** `expand=gpu` compiles `PARTICLE_GLSL`.
- This machine is shared and slow (load averages of 20 on 4 cores are normal): single timings
  lie, and the browser's read-out of `physics.update` (0.8 to 2.5 ms average, 30 to 95 ms
  "worst") is the load, not the code. Cost is `p5/cost.mjs` in Node.
- Things that bit me in P6: a unit vector eased by interpolation never turns round to the
  opposite direction (turn it by the angle); `physics.warmUp` calls `update` with `dt = 0`
  (anything divided by the step must be guarded); a relative "changed by 35 % in a frame"
  measure fires at the small end of every fade (it is not a pop); the near ground grid is 2 m
  (a kerb is a ramp to it); PAINTER's alpine meadow has 49 degree slopes; a place found by
  "where it snows" may be the open sea.
- Read at every sync: `docs/COORDINATOR.md` section E, `docs/lead/REVIEW.md`,
  `docs/notes/pilot.md`, `docs/notes/painter.md`. Answer MUST FIX items here.

**Done in P7** (details in "For PAINTER" (top block), "For PILOT" (top block), API "Added in P7"):
1. *PAINTER's list.* Rain laid parallel, no stroke over 1.2 m or nearer than 2.4 m, a quarter
   of the strokes; snow at PAINTER's sizes, each flake its own shape and slow turn; dust in a
   storm as a few low walls near the ground; a swell on open seas, the crest as a line, the
   significant height of sea and swell together; five times the splash rings near the focus;
   grass parted two metres wide with a wake that lasts six seconds and a pressed path.
2. *Sky numbers and the ruling on snow.* `sky.fresh` (integrated at the focus as it falls);
   standing snow is the biome's own only; rain or snow closes the sky; a gale has its own sky;
   both paths (`here` and stateless) answer the same large-scale wind and agree within 1 % in
   everything but snow; the melt-water step of 55 % is a ramp.
3. *Storms bring wind* (lead review 5, P1, a MUST FIX): each system adds its own wind (`blow`
   in `KINDS`: storm 16 m/s, dust 20, shower 6, rain 3, ice 4 at 10 m) under its cloud shield.
4. *The game re-flown* with PILOT's five levers in, six worlds, numbers in "For PILOT".

**Not done, each with where to start:**
1. *The lead's review 5, SHOULD FIX P2 to P6* (`docs/lead/REVIEW.md`): P2 the first storm
   crosses the spawn at 640 to 800 s, in the dark (a seed or a time offset: `DEFAULT_SEED` in
   `weather.js`, or start the weather clock some 300 s on); P3 half done (the gale sky and the
   swell are in; "never a storm" on `storm_seas` is the regime table: `REGIMES.neptune`); P4
   dust in the air of Earth's forest (`sky.dust` 0.27 at the spawn before the storm: the gust
   front lifts dust where `dustSource` says there is some; the forest's is not 0: `BIOMES`
   in `ground.js`, or gate the lift by wetness and canopy); P5 answered (fresh snow is
   stateful at the focus and says so; the clock-jump case re-reads the quadrature); **P6 not
   touched: walking downwind in 33 m/s is slower than upwind** (0.6 against 3.5 m/s: start in
   `explorer.js`, the wind load and the lean; and the boundary layer over a sea in `wind.js`
   `heightFactor`: 33 m/s at two metres is too much of a 40 m/s wind).
2. *Thunderstorm gusts are still under the lead's 15 to 30 m/s at 10 m in a wood*: measured
   at the spawn 4 to 11 m/s at 10 m (21 to 25 at 30 m, above the crowns), where it was 1.6 to
   3.7. In the open it is more. Tune `KINDS.storm.blow` and the gust gain against
   `p7/stormwind.mjs`; watch the explorer (PILOT's `R-FOOT-5`).
3. *The weather judged in the integrated game by me*: not done. The lead's weather sheet
   (`docs/lead/evidence/weather.jpg`, at `62d3529`) has P7.1 and P7.2 in it, not the sky
   numbers or the storm wind; I did not open it (out of working context). Re-run
   `node tests/weather.mjs` (PILOT's) on a clean export and judge the twelve frames.
4. *The instanced kit path* (`expand: 'gpu'`, `chunks.glsl.js`) has none of this stage's draw
   options (`parallel`, `maxLen`, `near` for streaks; `tumble`, `aspect`, the walls). PAINTER
   uses the CPU path. Port them before anyone switches.
5. *Rates*: Earth's `haze` and Jupiter's `rain` reach 8.5 % a second at the edge of a passing
   cell (the lead allows 8). The source is how sharp a cell's edge is against its drift speed
   (`gather` in `weather.js`: `x0`, `edgeTime`).
6. *Fresh snow away from the focus* is a 21-point quadrature over the past and wobbles (it can
   rise a little under a clear sky): good enough for a tour's read-out, not for a picture.
   A per-place ring of the rate, filled as time passes, would make it exact.
7. *From P6, still open*: the silhouette agreement test for the flora chunk inside
   `PROP_VERT` (method in the P6 list below, item 1); calm-air crawl of flakes; drifts and
   branches judged as a picture (PAINTER has not wired them); on the Moon the explorer's feet
   never leave the ground at a run.
8. *Sand marks*: 2.3 strokes of saltating sand a second go out whole while walking in Mars'
   storm (`p7/crawl.mjs dust walk`); never looked at.

**The P6 list of what was not done then** (kept for its "where to start"):

1. *A silhouette agreement test for the flora chunk inside `PROP_VERT`.* Not started. The
   painted lab is deterministic with `pre` and `freeze=1`, so: put the camera on a lone tree
   (`world.sampleObstacles` gives root and height), shoot once with `physics.setWindScale`
   at its value and once at 50 times less (calm), find the crown's centroid in both frames
   (it is the dark mass above the trunk; diff the frames), and compare the shift in pixels
   with `fields.flora.plantBendLite` + `plantDisplace` projected through the same camera.
   A one-line hook from PAINTER (a debug flag that writes the displaced body-local position
   to the colour target) would make it exact. Note `setWindScale` takes many seconds to
   show at the focus (I asked for 0.12 and the wind fell from 5.6 to 4.6 m/s in 6 s): use
   two page loads with different `seed`/time instead, or wait a minute of `pre`.
2. *The look-critique items on my own marks*: flakes are still ovals of one tilt (they are
   now drawn out to their travel, so a gale gives strokes; a calm gives near-round specks;
   what is missing is tumble: give each flake its own aspect and a slow turn from `_ph`);
   lone dust tufts against a clear sky read as leaves (a size distribution with a floor on
   the smallest puff, or thin them by `share` where `sky.dust` is low); sand flecks too dark
   and spray's material only says "liquid here" are colour: PAINTER's.
3. *Grass parting judged as a picture*: needs PAINTER's visible blades (its item 5 of this
   run), then `painted=1&biome=alpine_meadow&walk=1.5&circle=3&pre=14&freeze=1&kits=0
   &follow=1&dist=4` with and without `push=0`.
4. *Calm-air crawl of flakes* (sub-pixel motion of small opaque marks through PAINTER's post
   pass): not isolated. The pairs I measured were in 5.6 m/s of wind, where a flake's own
   travel (45 % of its width in 8 ms) is all of the change. Needs a place and time with snow
   and under 1 m/s of wind (`find=` cannot ask for that yet).
5. *Drifts and branches judged as a picture*: both are delivered as numbers and a chunk;
   nothing draws them until PAINTER takes "For PAINTER" A (last bullet) and F.
6. *When PAINTER's weather is in the picture*: re-shoot the storm, the blizzard, the dust
   storm and Neptune's sea in the game itself and tune `DRAW_PAINTED` against them.

## API (current, exact; kept up to date with every commit)

Everything is pure logic: no three, no DOM, plain `{x,y,z}` objects, **body-local** coordinates
(C1, C3), metres, seconds, kelvin, pascal. Wind, weather and every query are functions of
`(seed, body, place, time)`; the near-field simulations are deterministic for the same frames.

```js
import { createPhysics } from './src/physics/index.js';

const physics = createPhysics({ sampleSurface, seed? });  // sampleSurface(bodyId, unitDir): the contract's
                                                          // seed: leave it out (DEFAULT_SEED 18) unless you want other weather
physics.setQuality(0 | 1 | 2);
physics.warmUp({ bodyId, time, focus });   // once while loading: fills ground caches, compiles hot loops (about 20-60 ms)

// once per frame (PILOT in the game, PAINTER in the gallery), BEFORE world.update:
physics.update(dt, {
  bodyId,        // body the camera is on, or null in deep space (the near field then sleeps)
  time,          // seconds on the simulation clock (sim.t). Weather and wind are functions of it.
  focus,         // {x,y,z} body-local point the near field centres on (explorer feet, or the ship)
  sunDir,        // {x,y,z} body-local unit vector toward the sun (optional: day/night temperature, dawn mist)
  eye,           // {x,y,z} body-local position of the camera (optional, new in P6): snow is simulated in an
                 //   8 m box round it (the focus when absent, or when the eye is over 60 m from the focus)
  disturbers,    // [{ kind:'explorer'|'ship'|'jet'|'downwash', p, v, radius, strength, grounded?,
                 //    kick?, impact? (explorer: dust raised by the feet), q?, legContact? (ship: pad prints) }]
});              //   explorer/ship: strength 1; jet/downwash: strength = thrust in newtons
                 //   build them with physics.explorer.disturbers(st, out) / physics.ship.disturbers(st, out):
                 //   those fill every optional field from st.phys
```

### Environment queries (cheap; pass an `out` object to avoid allocation)

```js
physics.air(bodyId, p, out?, heightAboveGround?) ->
  { density (kg/m3), wind:{x,y,z} (m/s, body-local), speed, gust01 (0 lull .. 1 gust),
    turbulence (sigma of wind speed, m/s), temperature (K), pressure (Pa), soundSpeed (m/s),
    viscosity (Pa s), altitude (m above base radius), height (m above ground used), near (bool) }

physics.weather(bodyId, p, out?, { time?, surface? }) ->
  { kind: 'clear'|'breeze'|'windy'|'overcast'|'mist'|'fog'|'drizzle'|'rain'|'thunderstorm'|'snow'|
          'blizzard'|'dust haze'|'dust storm'|'haze'|'virga'|'acid drizzle'|'ice fall'|'frost fall'|'vacuum',
    intensity01 (how much weather there is; continuous), kindIntensity01 (strength within the kind; steps),
    precipitation: { type: 'none'|'drizzle'|'rain'|'snow'|'ice'|'acid'|'frost', species (key of data.SPECIES),
                     rate (mm/h water equivalent), intensity01, fallSpeed (m/s, this body's gravity and air),
                     dropSize (m), frozen01, hail01, reachesGround01 (Venus virga),
                     extinction (1/m: the share of a sight line that what is falling hides, per metre) },
    dustExtinction (1/m: the same for the dust in the air),
    wetness01, snowDepth (m),
    visibility (m, real scale), visibility01 (multiply your clear-day fog distance by this),
    cloud01 (0 once you are above the deck), cloudBelow01, storm01,
    fog01, dust01, haze01 (the share of the view each veil takes by itself: with only fog in the air
      visibility01 = 1 - fog01; 0.5 = 5 km of visual range, 0.78 = 1 km, 0.9 = 200 m), dustLoad01,
    front01 (gust front), windFactor, temperature (K),
    lightning: { rate (flashes/min), flash01 (brightness now, 3-4 strokes in 0.25 s), nextIn (s),
                 thunderIn (s; negative = already passed), thunder01,
                 last: { t, x, y, z (unit direction of the strike), distance (m) } } }

physics.ground(bodyId, unitDir, out?, surface?) ->        // pass `surface` if you already sampled it (no call is made)
  { material: 'grass'|'soil'|'litter'|'mud'|'sand'|'dust'|'gravel'|'rock'|'snow'|'ice'|'ash'|'glass'|'crystal'|'moss'|'bed',
    materialId (its place in physics.data.MATERIAL_IDS: the number particles and marks carry),
    friction (static), kinetic, foothold (extra holding traction on slopes), restitution,
    sink (m), drag (walking resistance as a fraction of normal force), repose (rad), dust (0..1),
    z0 (m), imprint (0..1), density, grain, liquidDepth (m), wetness01, snowDepth, temperature,
    canopy01, canopyHeight, moist, fog, dustSource }

physics.water(bodyId, p, out?) ->                         // the liquid surface and its wind waves
  { present, height (elevation at p now, m), significant (Hs, m), period (s), length (m), speed (m/s),
    steepness, whitecap01 (0..1 how steep the sea is), whitecapCover (share of the surface that is
    breaking, 0..0.15), dir:{x,y,z} (body-local, the way the waves run) }

physics.features.devils // dust devils near the focus: array with .count; each { p (body-local foot), x, z (grid),
                        //   radius (m), height (m), speed (swirl, m/s), up (m/s), spin (+1/-1), strength 0..1, age, life, id }
physics.here            // { bodyId, air, weather, cover, groundHeight, sky } at the focus, refreshed by update(): free to read
physics.here.sky        // the weather as a painter needs it: twelve numbers 0..1 (P7: `fresh` added), continuous (all but flash):
                        //   cloud (cover), overcast (dim and cool the light), haze (MULTIPLY the clear-day fog
                        //   distance by it), fog and dust (what the lost view is lost to: grey water, or dust to
                        //   tint), wet (ground darkening), snow (ALL snow lying: standing and fresh), fresh (cover of
                        //   FRESH snow alone: what recent snowfall laid; lay this over the painted ground), rain
                        //   (liquid falling), snowfall (frozen falling), storm (a storm core, or a hurricane-force gale),
                        //   flash (lightning now). Rain or snow falling means cloud over 0.85 and overcast over 0.5.
physics.sky(weather?, out?)   // the same numbers for any physics.weather() result (default: at the focus)
physics.focus           // {x,y,z} body-local: the focus of the last update (read-only)
physics.particles.system.dripping   // 0..1: how hard the soaked canopy over the focus is dripping (after rain)
physics.setWindScale(bodyId, scale)   // how far a body's real wind is scaled down (data.WINDS[body].scale)
physics.stats           // { ms, msAvg, msMax (worst frame after warm-up), msGround, msAir, msWeather, msFlora,
                        //   msParticles, samples (sampleSurface calls this frame), particles, pushCells, reanchors }
```

### Dynamics (pure step functions; PILOT keeps input mapping and assists on top)

```js
import { stepExplorerBody, EXPLORER_BODY, stepShipBody, stepShipGear, wakeShip, SHIP_BODY } from './src/physics/index.js';
const env = physics.bindEnv(bodyId, env);   // adds env.air, env.ground, env.liquid, env.liquidOf (the liquid at a place:
                                            // lava, cloud froth), env.gravity and env.radius if missing
// BOTH flight step functions and the explorer step move st.p (and st.v) IN PLACE. Do not integrate the
// position again afterwards; if you want to post-process, keep the old position by value first.

stepExplorerBody(st, cmd, dt, env, T = EXPLORER_BODY)       // == physics.explorer.step
//  st:  { p, v, grounded }  (PILOT's explorer state; st.phys is added on first use)
//  cmd: { wish:{x,y,z} m/s horizontal, jump:bool, jet:0..1, jetMaxRise?: m/s, descentLimit?: m/s,
//         airControl?: 0..1, assistAccel?: m/s2 }
//  env: { sample(unitDir), gravity, air?(p,out,height), ground?(surface,out), liquid? }
//  st.phys: { slip01, scramble01, sink, submerged01, windAccel, lean, support, impact, puff, material, friction,
//             dust, jetThrottle, jetUse, speedGround }

stepShipBody(st, cmd, dt, env, T = SHIP_BODY)               // == physics.ship.step   (flight: translation only)
//  st:  { p, v, q }   cmd: { target:{x,y,z} m/s | null, tau: s, hover?: bool, boost?: bool, carve01?: 0..1,
//                             brake?: 0..1 (ASSIST: the drive field sheds what the retro thrusters cannot,
//                             up to SHIP_BODY.fieldBrake = 160 m/s2, only ever slowing, not felt by the crew) }
//  env: { up | null, gravity, radius, altGround?, air?, time? }
//  st.phys: { thrust, lift01, buffet, buffetAngle:{pitch,roll}, q, airspeed, gLoad, heat01,
//             downwash:{thrust,speed,q,radius}, groundEffect, brake01, fieldBrake (m/s2 being shed now) }

stepShipGear(st, { lift01, hold? }, dt, env, T = SHIP_BODY) // == physics.ship.gear   (rigid body on 3 legs; moves p, v AND q)
//  env: { sample(unitDir), gravity, ground?, air? (for the thruster wash) }
//  st.phys: { contacts, asleep, legLoad[3] (N), legCompress[3] (m), legContact[3], w (rad/s),
//             downwash (lit whenever lift01 > 0: dust and grass blow before the feet leave) }

physics.ship.planSpeedChange(v0, v1, aMax, jMax) -> plan;  sampleSpeedChange(plan, t) -> { a, v, s }
physics.ship.stepPulse(ps = { a, v }, vWant, dt);  pulseBrakeDistance(v)
```

### Fields and buffers (typed arrays; PAINTER wraps them in textures and attributes)

```js
physics.fields.frame            // LocalFrame: ox,oy,oz (anchor, body-local m); ex.. (east axis); nx.. (north); ax.. (up); version
physics.fields.flora
  .bend   Float32Array(32*32*4)   // RG soft-plant load (east, north), BA stiff-plant load; 8 m cells
  .wind   Float32Array(32*32*4)   // RG wind at 2 m (m/s), B gust01, A turbulence (m/s)
  .push   Float32Array(64*64*4)   // RG push load, B flatten01, A shake01; 0.5 m cells
  .size 32  .cell 8  .nearSize 64  .nearCell 0.5
  .uniforms   // { uPhysAnchor[3], uPhysEast[3], uPhysNorth[3], uPhysUp[3], uPhysWindMap[4], uPhysNearMap[4],
              //   uPhysWave[4], uPhysWavePhase[4], uPhysShape[4] }  plain arrays, refreshed every update
  .version / .pushVersion          // bump when the arrays changed (re-upload)
  .plantBend(p, stiff01, out) -> { e, n (radians), angle, flatten01, shake01, load }   // CPU twin of the shader
  .plantBendLite(p, stiff01, out)                                                       // twin of pcPhysBendLite
  .plantDisplace(h, H, be, bn, out) -> { e, n, up }
physics.glsl.flora              // GLSL (ES 3.00): pcPhysBend(root, stiff01) -> vec4 (3 lookups: wind, waves, push, flatten),
                                //   pcPhysBendLite(root, stiff01) -> vec2 (1 lookup: wind response only),
                                //   pcPhysDisplace(rel, up, H, bend) -> vec3, pcPhysWind(p) -> vec4, pcPhysGrid(p) -> vec2
                                //   `#define PC_PHYS_LINEAR` before it = hardware filtering, 1 fetch a lookup (see PAINTER wiring)

physics.fields.water
  .uniforms   // { uPhysWaterDir[2], uPhysWaterK[4], uPhysWaterAmp[4], uPhysWaterPhase[4], uPhysWaterGroup[4],
              //   uPhysWaterSea[4] (Hs m, the elevation above which the sea is breaking m (1e9: it is not),
              //   the width of that edge m, whitecap cover), uPhysWake Float32Array(64) (16 x: x, z, age s,
              //   amplitude m), uPhysWakeG }, refreshed every update
  .heightAt(p) -> m               // CPU twin of pcPhysWaterHeight (waves, sets and wakes): a floating thing rides the painted sea
  .sample(p, out) -> { height, de, dn (slope along the frame's east and north), ax, az (unit, frame axes: the way
              //   the crests lie there), crest01, foam01 }      the twin of pcPhysWaterD + pcPhysWaterCrest
  .surf01(depth) -> 0..1          // how far this sea's waves have broken where the liquid is `depth` m deep
  .field      // WaterField: height (Hs), period, length, speed, steepness, whitecap01, cover, foamAt, dir, level,
              //   present, addWake(x, z, amplitude), wakeAt(x, z), wakeInto(x, z, o3), surfaceAt(x, z, o)
physics.glsl.water              // pcPhysWater(p) -> vec3(height, dh/deast, dh/dnorth); pcPhysWaterD(p, out vec2 along);
                                //   pcPhysWaterCrest(w) -> vec2(crest01, foam01); pcPhysWaterSurf(depth) -> 0..1;
                                //   pcPhysWaterNormal(w, up) -> vec3 (body-local); pcPhysWaterDir(vec2) -> vec3;
                                //   pcPhysWaterHeight(p); pcPhysWake(grid). Works in a vertex or a fragment stage.
                                //   `#define PC_PHYS_NO_WAKE` leaves the wakes out (far water, or per fragment).
                                //   Shares the frame uniforms with the flora chunk (guarded: include both freely)

// draw kits (the only folder that imports three; optional; see "For PAINTER", C)
import { createPhysicsKits, createWeatherKit, createMarksKit, createWaterKit, DRAW, DRAW_PAINTED, cellFor, INKED, PARTICLE_GLSL, SHAPE_GLSL } from './src/physics/three/index.js';
const kits = createPhysicsKits(physics, { makeMaterial(kind, info), weather?: { draw?, expand?: 'cpu' | 'gpu', kinds?, rings? } | false, marks?, water?: {} (off by default) });
kits.update(bodyRoot, camera, internalHeightPx);   kits.objects;   kits.stats { ms, drawCalls, vertices, triangles };   kits.dispose()
kits.weather.stats.cover   // { rain?, snow?, dust? }: the share of what the physics says the kind hides that its marks paint
kits.weather.stats.size    // { snow, dust, ... }: the size (m) dabs are drawn at now
// DRAW[kind] options (override any through weather.draw): width, exposure, min, size, grow, spin, fadeIn, vary,
//   minPx (floor, thins the kind), maxPx (ceiling), share, exposure + smear (dabs drawn out along their motion),
//   varySize, cell (m: the kind is shown modulo a cell round the eye), sizeMax + fill (dabs sized by the physics),
//   new in P6: fadeOut (s: shrinks to nothing over its last moments, from buf.left), strobe (s, the frame time) +
//   streak (dab sizes): a dab is drawn out at least as far as it travels in a frame and is gone as a hairline,
//   near (m: nothing nearer the eye than 0.4 of it)
// DRAW_PAINTED (new export, was in painted-lab.js): the overrides for PAINTER's pipeline; pass as weather.draw
// cellFor(D, eye, buf): the cell in use (the nearest to D.cell that divides the kind's simulated box)

physics.fields.deform
  .depth  Float32Array(64*64)     // m pressed into the ground, 0.5 m cells (trail trough); .uniforms.uPhysDeformMap
  .marks  { data: Float32Array(256*14), capacity, head, total, origin, stride: 14 (MARK_STRIDE) }
          // per mark: x,y,z (rel. origin), dirx,diry,dirz, length, width, depth, kind, born, life, rim (m, raised edge),
          //   material (what it was pressed into: an index into physics.data.MATERIAL_IDS; 255 = unknown)
          // kind (MARK): 0 left foot, 1 right foot, 2 gear pad, 3 hull, 4 scour (the dish a jet or the thrusters blow)
  .depthAt(x, z)                  // m, at a grid position

physics.particles.rain / .snow / .hail / .dust / .sand / .ash / .spores / .leaves / .spray
  // { count, capacity, pos Float32Array(3n) (relative to .origin, body-local axes), vel (3n), size (n), age (n),
  //   mat Uint8Array(n) (the ground it was raised from: an index into physics.data.MATERIAL_IDS; 255 =
  //   MATERIAL_NONE: rain, falling snow, hail, leaves, spores, ash), origin, species,
  //   left Float32Array(n) (new in P6: seconds until it is gone, where the physics can tell: its life ending, or
  //   its landing foretold from the rate its height over the ground is closing; 1e9 otherwise),
  //   radius (new in P6: half-width in m of the box the kind is simulated in: 24, snow 8) }
  // Positions are on the curved ground (P6 fix): radius r0 + height on the line through the grid point; before,
  // they lay on the tangent plane at the frame's anchor and left the ground by d^2 / 2R (18 m at 380 m on Earth).
  // rain, snow: the weather. hail: storm cores (bounces). dust: kicked up, storms, devils, ambient haze. sand: saltation,
  // kicks, scour. leaves / spores / ash: the biome's own, on the wind. spray: wading, thruster wash over liquid.
  // In vacuum the same kinds fly as clean parabolas (no drag, no drift).
physics.particles.events        // ring: { data Float32Array(256*8), head, total, origin }: x,y,z, kind (0 splash, 1 ripple, 2 settle, 3 bounce), strength, time, size, 0
```

**Added in P7** (all additive; nothing renamed):
```js
physics.here.sky.fresh                    // 0..1: ground covered by FRESH snow (recent snowfall only); never more than .snow
physics.weather(...).freshSnow            // m of fresh snow (snowDepth = the biome's standing snow + this); .gale01 (0..1: the
                                          //   large-scale wind between 18 and 34 m/s: scud, spray over an open sea)
physics.water(...).swell, .swellLength    // m: the swell on an open sea (0 on lakes); .significant is wind sea and swell together
physics.fields.water.sample(p).line01     // the crest as a line (GLSL: pcPhysWaterCrestLine(w, along))
physics.fields.water.field.swellHeight, .swellLength, .open (0 lake .. 1 open sea), .significant, .slope (rms)
WATER.swellFetch, .swellDecay, .swellTime, .swellCalm, .swellOpen, .lineIn, .lineOut;  new WaterField({ swell: false })
PARTICLES.events 512 (was 256), .ringRate, .ringRadius, .ringFar      // rings laid near the focus in rain
FLORA.pushReach 0.7 (was 0.45), .wakeShare, .wakeSet, .wakeTime, .trampleTime   // the parted wake behind a walker
WEATHER.galeFrom, .galeFull, .galeCloud, .sprayExt;  SKY.overcastGale, .stormGale
// three/: DRAW fields parallel, maxLen, near (streaks); tumble, aspect, wall, wallFrom, wallFull, wallShare, wallHigh,
//   wallNear, wallFade (dabs); makeEye().wall01 (the kit sets it from weather.dustLoad01). CPU expanders only.
```
**Changed behaviour in P7** (same names): standing snow is the biome's own `snowBase` and nothing else (the climate
pack of up to 0.4 m wherever the daily mean is below freezing is gone: the alpine meadow is grass, not snow, to the
feet as well); `physics.sky(physics.weather(p, { time }))` and `physics.here.sky` use the same large-scale wind for
drying and agree within 1 % (they were up to 29 % apart in `wet`); the wetness of melting snow comes in over 1.5 K
(it was a step of 55 %); snow falls up to 2.5 K above melting (was 1.5).

**Added in P6** (all additive):
```js
physics.update(dt, { ..., eye })          // the camera, body-local (optional): snow is simulated in an 8 m box round it
physics.fields.drift                      // drifts of snow or sand: a 64 x 64 grid of 0.5 m cells round the focus (the marks' grid)
  .factor  Float32Array(64*64)            // loose material at the cell in units of what lies on level ground:
                                          //   0 level, +1 twice as deep, -1 blown bare (never over 2.5)
  .level                                  // m lying on level ground here now (the snow depth, or the loose layer of sand: up to 0.12)
  .snow                                   // true: what drifts is snow; false: sand or dust
  .depthAt(p)                             // m above (below) the level deposit at a body-local point
  .uniforms { uPhysDriftMap [cx, cz, 1/size, 64], uPhysDriftLevel [m] }    .version    .size 64    .cell 0.5
physics.ground(bodyId, unitDir).snowDepth // near the focus this is now the depth at that very spot (level + drift)
physics.fields.flora.plantBranch(re, rn, h, H, root, bend, out)   // -> { e, n, up } m: how far its branch moves a point of a crown
  // (re, rn): the point's offset from the trunk (m east, north); h: its height; H: the plant's; root: body-local;
  // bend: what plantBend(root, stiff01) returned. Add it to the point before plantDisplace. GLSL twin: pcPhysBranch.
physics.fields.flora.uniforms.uPhysBranchPhase [4], .uPhysBranch [gustiness 0..1, gain, shaken swing rad, branch length / height]
// the ship body (stepShipBody): cmd.carveAccel (m/s^2, optional): the most sideways acceleration the carve assist gives
//   (absent: unbounded, as before);  st.phys.fieldCarve: m/s^2 the field is pushing sideways now (a glow, a sound, a read-out)
// particle buffers: .left Float32Array(n) (s until the particle is gone, 1e9 when unknown), .radius (m: half-width of its box)
// three/: DRAW_PAINTED (the draw table for PAINTER's pipeline), cellFor(D, eye, buf); DRAW fields fadeOut, strobe, streak, near
```

Reference data and helpers: `physics.data.{ATMOSPHERES, LIQUIDS, WINDS, REGIMES, MATERIALS, MATERIAL_IDS (15 names: a
material's number is its place), MATERIAL_INDEX, MATERIAL_NONE (255), BIOMES, SPECIES}`,
`physics.util.{airDensity, airTemperature, gravityAt, fallSpeed, terminalVelocity, cellsAt, saltationThreshold,
holdAngle, iceFriction, treeFrequency, stemFrequency, PlantSim, liquidOf, liquidAt(bodyId, surface), BIOME_LIQUID}`;
tuning tables exported from `index.js`: `WEATHER, WIND, AIR, GROUND, FLORA, PARTICLES, LOOSE, KICK, DEVILS, DEFORM,
MARK, MARK_STRIDE, EVENT, WATER, QUALITY, DEFAULT_SEED`, and `windSea(U, fetch, g, rhoAir, rhoLiquid, depth)`.

## Status

INTEGRATION: ready and wired (PILOT `a9c02bc`, PAINTER `1e1801e`). The API is stable; P2 and P3 only added to it,
with one change of type: the water uniforms are vec4 now (four trains; nobody had wired them).
The tree is committed green: `node --test src/physics/` **208 pass** at the commit that carries this note.

**Stage P6** (the third agent; commits `ded1435` (the coordinator's snapshot of my tree), `16d5305`, and the two after):

| P6 job | State | How it was verified |
|---|---|---|
| 1. Crawl of the kits | done: `buf.left` and `fadeOut`, snow in its own 8 m box round the eye and riding the air over slopes, the cell divides the box, dabs drawn out to their travel a frame, hairlines and marks at the lens gone, rain strokes taper | `p6/crawl.mjs` (table below): pops 11.7 to 0.0 a second, jumps 1.3 to 0, strobing 0.2 to 0; painted lab pairs 8 ms apart: 19 to 22 % less change than before, a camera orbiting at 6 deg/s adds no more than the scene's own; 6 new tests and one extended |
| found on the way: curved ground | fixed: particles and splash rings are published at radius r0 + height on the line through the grid point, velocities turned to the local vertical | before: rain 16.4 to 38.1 m over the true ground 380 m from the anchor and splashes at 15 to 20 m; after: 0.00 to 18.00 m and splashes at 0.00 m, at 80, 161, 300 and 380 m (`p6/curv.mjs`); test at 300 m |
| found on the way: rain over deep water | fixed: the weather enters over the surface it meets (ground or liquid), not 18 m over the bed | before: every flake of a blizzard over a 21 m deep sea was 3.6 to 15.6 m UNDER the surface; test over a 40 m sea: 0 drops under it, ripples on it |
| 2. The game played | done: six worlds at 60 Hz in Node and four in the browser with real keys | tables and findings in "The integrated game, played in P6" |
| 3a. Branch rate | done: `pcPhysBranch` in the flora chunk, `plantBranch` its twin, phases on the clock; no new texture, one line for PAINTER | 2 tests (nothing at the trunk, continuous all the way round, tips out of step, 1 to 2.5 Hz, bounded, scales with lean and gustiness); the chunk compiles inside PAINTER's plants (painted lab, no console errors). **Not seen as a picture: PAINTER has not called it.** |
| 3b. Drifts | done: `drift.js`, `physics.fields.drift`, the ground under the explorer and under every print | 8 tests (nothing on standing liquid, level ground none, lee of a bank +0.2 to +0.5 m in 0.2 m of snow, windward face scoured to bare, a kerb's drift under 0.8 of the kerb, a hollow fills from any wind, nothing moves in a calm, melts and deepens with the snow, fixed in the world as the walker moves, behind a landed hull, in the game loop behind a hill); cost under 0.25 ms a frame. **Not seen as a picture.** |
| carve assist bounded | done as an option: `cmd.carveAccel`, `st.phys.fieldCarve` | 1 test; PILOT's 102 tests pass unchanged (the default is as before) |
| 4. Silhouette test in `PROP_VERT` | not done | Hand-over, 1 |
| 5. Look-critique items | not done | Hand-over, 2 |

**Cost after P6** (`p5/cost.mjs`, worst reproducible frame of `physics.update` in Node, ms; before -> after):
running at the Earth spawn 0.33 -> 0.36; thunderstorm 0.45 -> 0.50; **blizzard 0.47 -> 0.75**
(every flake now looks its ground up every step, to ride the air over it and to foretell its
landing; plus the drift field); Mars dust storm 0.41 -> 0.44; Neptune storm with the ship low
over the sea 0.87 -> 1.01. Budget 2 ms. The dab expander: 0.217 -> 0.223 ms for 2800 flakes.

### Crawl, measured (P6)

Method: `p6/crawl.mjs` runs a scene at 60 Hz and expands the kit's quads with the painted
draw table for a camera 6 m behind and 2 m above the focus (50 degree lens, 432 internal
lines). Every mark is followed from frame to frame (a particle's size is its own for life)
and four things are counted, per second, among marks in the picture at least 3 px across:
**popOut** (there in one frame, gone or under half a pixel in the next), **popIn** (the
reverse, for marks old enough to be past their fade-in), **jump** (the centre moved by more
than its velocity relative to the eye explains, by over 4 px and over its own length),
**strobing** (the average number of marks in view that travel more than 1.5 times their
drawn length a frame). Camera: still, panning 3 deg/s, orbiting the focus at 12 deg/s, or
walking with it at 1.5 m/s.

| Scene (in view) | camera | popOut /s | jump /s | strobing | after: popOut | jump | strobing |
|---|---|---|---|---|---|---|---|
| Blizzard, 8 m/s wind, 1698 flakes, on a 49 degree alpine slope (56 -> 65 in view) | still | 11.7 | 1.3 | 0.2 | **0.0** | 0.0 | 0.0 |
| the same | pan | 15.3 | 0.9 | 0.1 | **0.0** | 0.0 | 0.0 |
| the same | orbit | 14.7 | 1.7 | 0.2 | **0.0** | 0.0 | 0.0 |
| the same, the walker kicking powder | walk | 9.3 | 2.5 | 0.1 | **0.5** | 0.0 | 0.0 |
| Mars dust storm, 366 puffs (94 in view) | still | 7.6 (marks 80 to 94 px across) | 0 | 0 | **0.0** | 0 | 0 |
| Thunderstorm 15 mm/h, 1516 drops (107 in view) | still | 85.8 (every stroke, whole, as its head lands) | 0 | 0 | **0.8** | 0 | 0 |

What each was, and what was done:
- *Jumps*: the simulation wraps a flake from one wall of its 48 m box to the other; the kit
  showed flakes modulo an 18 m cell; 48 is not a whole number of 18, so every wrap moved the
  shown flake 6 m in one frame. The cell now divides the box (`cellFor`), and snow has a box
  of its own the size of the cell.
- *Flakes vanishing in mid-air*: a flake was shown up to 24 m from where it was simulated,
  over other ground, and went out when ITS ground came up. Now the snow is simulated where it
  is shown (an 8 m box round the eye: `frame.eye`), each flake carries the time to its landing
  (`buf.left`, from the rate its height over the ground is closing, eased over 0.15 s) and
  shrinks to nothing over its last 0.3 s.
- *A finding inside that one*: carried straight and level by the wind, flakes struck every
  rise and left everything lower than the highest ground in the box bare (half the flakes in
  view gone on a slope; on the same slope, blown downhill, they hung at the height where the
  ground fell away as fast as they fell and never landed). The air over ground flows along
  it. Flakes now ride the air's own rise and fall over sloping ground (through their drag,
  a tenth of a second late): heights over the ground are evenly spread from 0 to 18 m on a
  49 degree slope (263, 342, 277, 310, 286, 216 flakes in six 3 m layers).
- *Dust puffs vanishing at full size* (a 2 m billow, 80 to 94 px, gone between two frames,
  7.6 times a second): `left` is what remains of the grain's life; the mark shrinks over 0.7 s.
- *Rain strokes going out whole*: a 0.9 m stroke vanished when its head reached the ground.
  It now thins to a point over its last 0.08 s (40 cm). Rain and hail also grow in over 0.1 s.
- *Strobing and hairlines*: a flake near the lens in a gale crossed more than its own
  length a frame (a flash somewhere new every frame). A dab is now drawn out at least as far
  as it travels in a frame (`strobe`: driving snow is slanted strokes that overlap from frame
  to frame); one that would be more than `streak` (3) sizes long shrinks away, and nothing
  is drawn nearer the eye than 0.4 of `near` (snow 3 m, dust 2.5 m).
- What is left: about 0.5 pops a second from clods of powder kicked up by the walker's own
  feet in snow (they live a third of a second and die against the slope they were kicked
  at); marks growing over 3 to 5 frames at the inner edge of the `near` band (2 to 6 px wide,
  about 5 a second in a gale: a fade, not a pop, but a quick one).

In PAINTER's real pipeline (painted lab, `stability(8, 6, hideKits, orbit)`: pairs of frames
8 ms apart; mean absolute difference of the picture and the share of pixels changing by more
than 8 %), blizzard 0.8 mm/h in 5.6 m/s of wind, about 1000 flakes:

| | before P6 | after | no kits |
|---|---|---|---|
| still camera, 8 ms | 0.00180, 0.683 % | 0.00148, 0.532 % | 0.00004, 0.003 % |
| still camera, 16.7 ms | 0.00412, 1.548 % | 0.00333, 1.256 % | 0.00004, 0.003 % |
| orbiting 6 deg/s, 8 ms (1700 flakes) | | 0.00371, 0.938 % | 0.00185, 0.205 % |
| still, the same 1700 flakes | | 0.00181, 0.638 % | 0.00003, 0.002 % |

Reading: the flakes cover about 1.6 % of the picture and move 45 % of their own width in
8 ms in that wind, so 0.5 to 0.7 % of the pixels changing IS their travel; a slow camera move
adds only the scene's own change (0.94 - 0.21 = 0.73 % against 0.64 % still). The Mars dust
storm (75 billows of 2.4 m, wind 10.7 m/s): 0.406 % still, 1.026 % orbiting against 0.428 %
for the scene alone. `expand: 'gpu'` renders the same blizzard within a frame pair's
difference of the cpu path (mean difference 0.0015) and compiles without errors.
**Not measured: flakes in still air** (Hand-over, 4).

**Stage P5** (two agents; the second from `95bc128`):

| P5 job | State | How it was verified |
|---|---|---|
| Weather for the sky | done (`sky.js`, `physics.here.sky`) | 3 tests; continuity under 0.1 a second but `flash` |
| Ink on unknown ground | done: `MATERIAL_IDS`, `buf.mat`, mark slot 13, `materialNow`, `vPcMat` in every kit chunk | 5 tests: the twin names the ground as `groundAt` does in 8100 states (over 500 of them not the dry material); kicked dust says sand, dust, gravel, litter on those grounds; a grain keeps its word while the buffer is reshuffled; powder and prints in snow say snow, storm dust says dust, spray says bed; the lab's factory picks its ink from a 16-colour palette by it (Mars dust in the dune's own ochre, `painted-mars-dust.jpg`) |
| The sea for PAINTER's liquid | done: slope, crest direction, crests, whitecaps, surf, normal in the chunk; twin `fields.water.sample(p)` | 5 tests (slope against finite differences 1e-5; the sea drops 2.5 times more across a crest than along it; the foam covers the share the law says within 25 % at 12, 16 and 22 m/s; cover within a factor 1.7 of Monahan and O'Muircheartaigh from 10 to 20 m/s). Chunk against twin in a real GL context, 120 points with two wakes live: height 0.06 mm (on 0.39 m), slope 4e-5, crest01 4e-4, foam01 1e-3, direction 2e-5 (`window.__lab.waterAgreement()`). Not drawn as a sea by anyone: that is PAINTER's material |
| Kits that survive the post pass | done: floor with thinning, ceiling, physical cover, smear, snow cell, dust from the dust in the air | 5 tests (one in f or f^2 drawn at the floor, cover within 20 %, a receding mark changes by under 0.25 px a step and never pops; cell: whole cells, own height, none under the hull). Frames `painted-snow.jpg` (about 75 flakes in view where there were a dozen) and `painted-mars-dust.jpg`, opened and judged below |
| Painted lab on PAINTER's public exports | done (`makePaintUniforms`, chunks from `src/render/index.js`, palette from `looks.js`) | runs with no console errors in cpu and instanced mode |
| Grass parting, judged | **not judged**: nothing to see part | A/B frames, `painted-meadow-wash-ab.jpg` |
| Silhouette test in `PROP_VERT`, branch rate, drifts | **not done** | Hand-over, items 1, 3, 4 |

Cost (`physics.update`, Node, PAINTER's real worlds, quality 1, worst reproducible frame of six
identical runs; before P5 in brackets, measured in the same minute under the same load): running
at the spawn 0.35 ms (0.37); Earth thunderstorm 0.54 (0.48); Earth blizzard, now 1784 flakes,
0.49 (0.46 with 1258); Mars dust storm 0.42 (0.38); ship low over Neptune's sea in a storm 0.95
(0.96). Means 0.24 to 0.78. Kit arithmetic in Node: 2000 flakes with cell, smear and floor 0.13
ms; 1600 rain streaks with floor 0.05 ms. In the painted lab's browser (software GL, loaded
machine): blizzard 0.68 ms cpu, 0.22 ms instanced, 4 draw calls, 3.6 k triangles; dust storm 3
calls, 0.8 to 1.8 k. The wave chunk costs the CPU one uniform update. **Real-GPU cost is
unmeasured**: 16 `sin`/`cos` a vertex or fragment for the four trains, a 16-step loop for the wakes.

Stage P1 to P3: done, accepted. **Stage P4**: the lab runs inside the real painted
pipeline (`?painted=1`), the reference material factory is proven with PAINTER's chunks and both
render targets, six painted frames are judged, rain is prototyped four ways and measured for
crawl; all under Answers, "The lab inside the painted pipeline". Not done in P4: shader
agreement inside `PROP_VERT`, the branch rate, drifts.

Stage P3 (this block; the tables below are still current):

| P3 job | State |
|---|---|
| 1. Draw kits under `src/physics/three/` | done: rain, hail, sand, spray (streaks); snow, dust, ash, spores, leaves (dabs); rings; marks; water patch. CPU quads for any material, or instanced straight from my buffers. They fit PAINTER's material contract (`pcKitPosition()`, two varyings, opaque with `discard`). Shown in the lab (`draw-kits.jpg`), cost measured. "For PAINTER", C. |
| 2. The integrated game in the browser | done on Earth, Mars and Neptune with real key events; findings with numbers under Answers, "The integrated game in the browser". |
| 3a. Rain shelter and drips | done: a closed canopy catches 25 % (soaked) to 75 % (dry) of the rain, the wood drips big slow drops after rain until it has drained, the hull keeps what is under it dry and takes the splashes. Tested. |
| 3b. The sea from the air | done: the spectral peak is two trains (short crests), every train comes in sets that travel at half the phase speed; correlation under 0.6 at each of six ranges from 9 to 83 wavelengths and under 0.35 on average (test). |
| 3c. A wake field on water | done: rings spread from swimmers, waders and thruster wash at the group speed of their own waves; 16 sources; GLSL and JS twins. Tested. |
| 3d. A third (branch) rate in trees | **not done.** It needs a third oscillator and so a fourth field texture; not worth asking a new PAINTER for before the three existing ones are on half-float. |
| 3e. Shader agreement inside `PROP_VERT` | **not done.** Still only measured in my lab's shader (2.5 mm). |

Verified in P3: 175 tests (17 new: kit arithmetic and budget, shelter, drips, hull, sets, wakes);
PILOT's `node --test tests/*.test.mjs` 93 pass on this code; worst reproducible frame of
`physics.update` on the real worlds 0.38 ms running at the spawn, 0.54 ms standing in the forest
through its storm (shelter active), 0.45 ms in an open thunderstorm, 0.92 ms flying low over
Neptune's sea in a storm (wash, spray, wakes); kit cost per frame in the lab's browser: weather
0.10 ms for 1100 drops with rings (0.05 instanced), marks 0.07 ms when one is added, water patch
0.05 ms; in Node 1600 streaks 0.07 ms, 1600 dabs 0.09 ms, 256 marks 0.07 ms, 41 x 41 water 0.04 ms.
Not verified in P3: the kits with PAINTER's real chunks and two render targets (only the same
shape with a flat colour); the new water chunk anywhere but my lab; anything as a picture.

What exists now:

| Part | State | File |
|---|---|---|
| Atmosphere per body, fall speeds, liquids (incl. lava, cloud froth) | real, tested | `atmosphere.js` |
| Wind: bands, eddies, gusts, height profile, terrain shelter, **canopy wakes** | real, tested | `wind.js`, `air.js` |
| Weather: cells, kinds, lightning, gust fronts, wetness, snow, visibility; **every world its own** | real, tested | `weather.js` |
| **Dust devils** (Mars, Earth deserts) | real, tested | `features.js` |
| Ground materials and contact; every biome id of `looks.js` mapped and checked by test | real, tested | `ground.js` |
| Explorer body (**viscous liquids**) | real, tested | `explorer.js` |
| Ship body: flight, gear, pulse profile, **field brake, lift-off on the gear** | real, tested | `ship.js` |
| Flora field + GLSL chunk + CPU twin; **crown coupling, lite lookup** | tested; shader agreement measured | `flora.js`, `flora.glsl.js` |
| Rain, snow, **hail, dust, sand, ash, spores, leaves, spray**; ballistic in vacuum | tested | `particles.js`, `loose.js` |
| Marks: footprints **with rims, snow and sand filling them, gear pads, scour dishes** | tested | `deform.js` |
| **Water: wind waves** (sea state, 3 trains, GLSL + twin), ripples and spray as events | tested | `water.js` |

### Each world's own weather (lab preset `?planet=<name>`, shots `planets-inner.jpg`, `planets-outer.jpg`, `globes.jpg`)

| World | What happens there | Preset |
|---|---|---|
| Mercury, Moon | no air: kicked dust and sand fly in clean parabolas and are down in 1-2 s; nothing drifts, nothing hangs | `mercury`, `moon` |
| Venus | dense slow air (62 kg/m3, under 1 m/s at the ground); sulphuric drizzle that evaporates on the way down (virga) below 160 m and reaches the high mesas; haze | `venus`, `venus-mesa` |
| Mars | dust devils (Rankine vortex, 11-44 m across, 80-570 m tall, drifting with the wind they were born in); dust storms in which sand keeps hopping far below the fluid threshold (impact threshold); CO2 frost only below 200 K | `mars`, `mars-storm` |
| Jupiter | storms born on 11 jets and carried along them, east on one, west on the next; water rain falling fast (2.5 g, thin H2 air), hail, lightning; the Great Red Spot, a permanent anticyclone with circling winds | `jupiter`, `jupiter-globe` |
| Saturn | mist and fine drizzle on 7 broad jets, calm between rare storms; gritty wind over the gravel | `saturn`, `saturn-globe` |
| Uranus | slow methane snow and ice crystals at 91 K, fog banks, ice that grips like rock | `uranus` |
| Neptune | the fastest winds; methane rain (falls at 5.6 m/s), a dark spot racing west, methane seas rougher than water (density ratio) | `neptune`, `neptune-globe` |
| Pluto | nitrogen frost falling at 0.2 m/s out of 84 mg/m3 of air | `pluto` |
| Earth | the full set: cloud, drizzle, rain, showers, thunderstorms with hail and gust fronts, fog banks, radiation mist after rain in still damp air, snow where it is cold | `scene=rain|snow|storm` |

Every fast system is a big one (never smaller than the distance it drifts in 40 s) and its edge
takes about 30 s to pass, so even Neptune's weather arrives rather than switches.

### Verified, and how
- `node --test src/physics/`: **158 tests, 0 failures** (also file by file). New in P2: loose
  particles per kind and per world, saltation thresholds, devils (determinism, drift, wind
  field), virga, jet tracks and spots, marks (rims, fill, pads, scour), canopy wake, crown
  coupling, gust travel lag, wind waves (growth curves, shallow limit, other worlds, continuity
  over a re-anchor against the analytic bound), weather edges (below), biome table against
  `looks.js`, lava and froth, field brake, lift-off hand-over.
- PILOT's suite on my P2 code: `node --test tests/*.test.mjs` **92 pass** (Earth-Mars-Saturn on
  the real worlds with physics on).
- **Cost** (Node 22, PAINTER's real worlds, quality 1; per-frame best of five identical runs,
  then the worst frame of the run): running at the spawn **0.35 ms**, Earth thunderstorm with
  1340 drops **0.48**, Jupiter thunderstorm with 1760 drops and hail **0.50**, Mars dust storm
  **0.29**, ship at 160 m/s **0.49**, standing through the spawn's first storm (200 s) **0.51**.
  Means 0.22-0.37 ms. By section (mean): ground cache 0.01 (0.06-0.13 flying), wind grid 0.11-
  0.19, weather 0.02-0.04, flora 0.10-0.16, particles + loose + marks + water 0.02-0.09 in fair
  weather and 0.19-0.28 in a downpour. What each new system adds: loose kinds 0.01-0.07
  (700 grains), devils under 0.01, marks under 0.01, water under 0.005, canopy wake and crown
  coupling about 0.02 inside the wind and flora numbers.
  Single frames of 5-25 ms do show up in one-off runs here (three busy processes on shared
  cores); they never recur at the same frame, which is how I know they are the machine.
- **Shader against JS, measured** (lab, float readback of 66 displaced tips in a gale, largest
  tip displacement 2.05 m): float32 textures with the chunk's own bilinear **max 2.47 mm, rms
  0.87 mm** (grass max 0.04 mm); half-float textures with the hardware's linear filter and
  `PC_PHYS_LINEAR` **max 2.48 mm, rms 0.87 mm** (grass max 0.10 mm). The 2.5 mm is on 13 m
  trees. Not yet repeated inside PAINTER's `PROP_VERT` (it compiles and moves there; PAINTER
  checked that much).
- **Weather continuity** (a watcher standing still while every live system on every world
  passes, 1 s steps): fog, dust and haze banks change `visibility01` by **at most 5.0 % a
  second** (was 6.2; test); with precipitation the steepest is a methane snow squall on Uranus,
  7.8 %/s, and an Earth snow squall 4.7 %/s; rain on the giants 5-6 %/s. `intensity01` and
  `precipitation.intensity01` at most 6.5 %/s. Found and fixed on the way: where an ice-crystal
  veil overlapped a shower the precipitation type flipped and visibility jumped 0.32 to 0.62 in
  one second; what falls is now three continuous shares (liquid, solid, frost).
- The integrated game, played through PILOT's `Sim` in Node with PAINTER's world and obstacles
  (scripted keys; numbers in "To PILOT: the game as it plays now" below), and looked at once
  in the browser (title sheet up, no console errors, `physics 0.7 ms`).
- Evidence, `docs/shots/physics/` (12 files): `planets-inner.jpg`, `planets-outer.jpg`,
  `globes.jpg`, `water-coast-gale.jpg` (Hs 0.60 m, 2.5 s, 9 m under a 25 m/s gale; the blue
  mesh is the GLSL surface, the red dots the JS twin), `draw-kits.jpg`,
  `painted-meadow-wash-ab.jpg` (P5), and the six `painted-*.jpg` (snow and Mars dust re-shot in P5) (the older debug shots of rain, snow, the jetpack, the
  terrain wind and the ship were retired to stay at twelve files).

### Not done or not verified (current)
- In the game nobody draws my particles, marks, waves or weather yet (PAINTER's M3): they are
  seen only in my two labs. In the painted lab rain, footprints, snowflakes and blowing dust
  read as marks; no storm, blizzard, dust storm or sea reads as a whole (veils, light, ground
  and liquid are PAINTER's: "For PAINTER", E).
- The flora chunk inside `PROP_VERT`: agreement not measured there (2.5 mm in my own shader);
  the push field is seen to move PAINTER's flowers under the ship's wash; grass parting
  round the explorer is seen by nobody (no blades to part).
- A tree has two response rates, not three (`R-WIND-4`: no separate branch rate). No drifts.
- The wave chunk is proven against its twin in GL but drawn as a sea by nobody.
- The snow cell and the thinning are not measured for crawl in the painted pipeline.
- Real-GPU cost of the textures, the wave chunk and the kits is unmeasured (software GL only).
- The integrated game was last played in the browser in P3; PILOT's later changes (pace per
  world, settling on C, gear touchdown) are checked from its code and my models, not flown.
- The cloud seas (a light froth, Decisions 16): nobody has walked into one in the game.

## For PILOT: wiring, in order

**P7, for PILOT and the lead (read this block first; nothing below it changed).**

*Nothing to wire.* Everything of P7 arrives through what you already call. What you will
notice: `physics.here.sky` has a twelfth number `fresh`; the read-out's sky line and
`__pc.info().weather` can show it. `physics.here.weather` has `freshSnow` and `gale01`.

*Answers to review 5.*
- **P1 (MUST FIX, storms bring no wind): done.** Each system adds a wind of its own under its
  cloud shield (so it rises before the rain), along what is blowing: storm 16 m/s at 10 m,
  dust storm 20, shower 6, rain 3, ice fall 4 (`KINDS[...].blow` in `weather.js`). Measured at
  the game's own places with `physics.air` (`p7/stormwind.mjs`), wind at 2 / 10 / 30 m:
  the thunderstorm at the Earth spawn, 600 to 780 s every 20 s: 4.3/6.2/12.1 (mist), 3.6/5.1/
  10.0 (drizzle), **7.5/10.7/20.9** (first rain), 3.0/4.3/8.4, 6.2/9.0/21.4, 4.4/6.2/14.9,
  7.2/10.4/24.5, 6.2/9.0/21.1, 1.5/2.2/5.2, 4.1/5.8/14.0 (it was 1.6 to 3.7 at 10 m: gusts and
  lulls now, the wood shelters the two-metre level); a snow storm over the coast: 5.7 at 10 m
  before it, 10.3 to 14.3 in it; Mars' dust storm: 7.5 to 14.2 at 10 m (it was 2.8 to 4.2).
  Still under your `R-STORM-5` (15 to 30 m/s) at 10 m in a wood: see the hand-over, item 2.
  **Not verified: the explorer and the ship in these winds in the game** (your unit tests pass
  on an export with it; nobody has walked through the storm at the spawn since).
- **P2** (the first storm falls in the dark): not done. **P3** (Neptune's `storm_seas`):
  half: where the large-scale wind is 18 to 34 m/s the sky closes (cloud to 0.9, overcast
  +0.25, `storm` to 0.8) and over the open sea spray takes the view (haze to 0.28); the sea
  has a swell (0.8 m and 30 m long in its ordinary wind, 1.7 m and 59 m in 34 m/s). It still
  never storms by its regime. **P4** (dust in the forest's air): not done. **P5** (the two
  paths): `physics.sky(physics.weather(p, { time }))` and `physics.here.sky` now agree within
  1 % in every number but `snow` and `fresh` (they were 29 % apart in `wet`, 38 % in `fog`,
  because the stateful weather answered the gusty wind at the focus and the stateless one the
  prevailing wind: both answer the large-scale wind now, and fog no longer comes and goes
  with a gust); the 55 % step in `wet` (melt water switching on) is a ramp. Fresh snow at the
  focus is integrated as it falls, so there `physics.here` is the authority and says so in the
  API; a clock jump of over 5 s re-reads the quadrature. **P6** (downwind slower than upwind in
  33 m/s): not done; it is the first thing I would do next.
- `R-WX-1`: measured through the stateless path, 150 places and 12 moments a biome, 11 s each,
  at ground level (`p7/rates.mjs`): the fastest any number but `flash` moves in a second is
  8.5 % on Earth (`haze`, a snow front arriving), 8.5 % on Jupiter (`rain`), 6.2 % Uranus,
  7.3 % Neptune, 4.1 % Saturn, 2.0 % Mars and Venus. Half a point over your 8 % on Earth and
  Jupiter at the worst moment; not fixed.

*The game re-flown with your five levers in* (`p7/nodeplay.mjs`: your `Sim`, PAINTER's ground
and obstacles, my physics, scripted keys at 60 Hz, on a clean export of `6b047dc`):

| World | walk: to 90 %, stop | run: to 90 %, stop | jump: apex, aloft | jetpack fall ends at | cruise, 90 % after | turn at cruise | brake (X) | C to the ground |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Earth | 0.40 s; 0.53 s, 0.82 m | 0.82 s; 0.83 s, 2.6 m | 1.23 m, 1.05 s | 4.0 m/s | 46.7 m/s, 3.0 s | 42.0 deg/s, 69 m (37 m/s2, field 21) | from 47: 3.8 s, 97 m | lands at 1.09 m/s |
| Mars | 0.75 s; 0.82 s, 1.58 m | 1.35 s; 1.55 s, 5.7 m | 2.84 m, 2.25 s | 4.0 | 143.1, 6.3 s | 28.9 deg/s, 260 m (66, field 40) | from 110: 4.2 s, 248 m (field 24) | lands at 0.98 (sink up to 64 m/s) |
| Moon | 1.25 s; 1.18 s, 2.41 m | 2.30 s; 2.07 s, 7.5 m | 6.43 m, 4.90 s | 4.0 | 143.5, 6.3 s | 25.6 deg/s, 208 m (42, field 40) | from 74: 3.2 s, 131 m (field 24) | **hovers at 4.1 m, never lands** |
| Venus | 0.42 s; 0.47 s, 0.63 m | pace 5.3 m/s; 0.52 s, 0.92 m | 1.08 m, 1.00 s | 4.0 | 34.9, 3.2 s | 39.6 deg/s, 30 m (14, field 3) | from 34: 2.4 s, 43 m | lands at 0.99 |
| Jupiter | (walk 1.4 m/s here, see below) | 0.85 s; 0.87 s, 2.8 m | 0.88 m, 0.77 s | 4.0 | 69.3, 4.9 s | 42.6 deg/s, 103 m (57, field 40) | from 70: 5.4 s, 201 m | lands at 1.16 |
| Neptune | 0.42 s; 0.53 s, 0.82 m | 0.90 s; 0.82 s, 2.5 m | 1.04 m, 0.90 s | 4.1 | 50.3, 3.0 s | 42.8 deg/s, 70 m (39, field 23) | from 51: 4.1 s, 112 m | lands at 1.06 |

What the numbers say:
- **The worlds now differ, on foot and in flight, as intended.** Getting up to a walk takes
  0.4 s on Earth, 0.75 s on Mars, 1.25 s on the Moon, and stopping from a run 2.6, 5.7 and
  7.5 m: low gravity is felt in the feet. Cruise is 35 (Venus), 47, 50, 69 (Jupiter) and 143
  m/s (Mars, the Moon); in P6 it was 34 to 84. Thin-air worlds turn wide (26 to 29 deg/s),
  thick-air worlds at 40 to 43. Every jetpack fall ends at 4 m/s.
- **Forgiving? Three things to look at.** (1) *Mars and the Moon at cruise*: 143 m/s with a
  turn radius of 208 to 260 m and 131 to 248 m to stop, with the field brake already giving
  24 m/s2. In a Martian canyon that is a wall met before the nose comes round. The physics is
  right for thin air; the forgiveness would be a slower pace near the ground (a cap on
  `speedScale` below some height, or the density power 0.4 made 0.3: 100 m/s, radius 130 m).
  Your call. (2) *Jupiter's brake*: 201 m from cruise, no field share (the air is thick enough
  for the rule that gives none), 25 % longer than in P6 because the pace is up. (3) *Sideways
  load*: Mars 66 m/s2 in a held turn (6.7 g), Jupiter 57: the field's 40 is bounded as you
  set it, the thrusters and the air add the rest. Nothing says so to the player.
- **On the Moon the ship did not land**: after the cruise, the turn and the brake of this
  script it came down over `crater_fields` (slope 0.21, one obstacle within 12 m), sank at up
  to 35 m/s, and then hovered at 4.1 m with C held for 90 s, state `ATMOSPHERE`, lift 1, no
  contacts. The same with the physics of P6 (`b146000`) under your levers, so it is not this
  stage's doing; with the tree before the levers it landed (elsewhere: the flight was
  different). It looks like the landing logic holding off over a boulder. The player is not
  trapped (they can move aside), but nothing tells them why.
- *Jupiter's walk at 1.4 m/s* in this run is the spot (it was odd in P6's table too: a slope
  or a plant in the way of the scripted walk); the run reaches 7.4 m/s. Not looked into.
- *Feet*: on every world the feet are down 100 % of the time, at a run on the Moon too. Still
  open from P6 (the body model has no flight phase in a stride).

1. **Create and update.** In `Sim` (pure, so tests keep working):
   ```js
   this.physics = createPhysics({ sampleSurface });          // same sampleSurface the Sim already has
   // while loading, once the world can be sampled:
   this.physics.warmUp({ bodyId: this.bodyId, time: this.t, focus: this.ex.p });
   // every frame, before world.update (once per frame, not per sim step):
   const d = this._dist; d.length = 0;
   if (onFoot) this.physics.explorer.disturbers(this.ex, d); else this.physics.ship.disturbers(this.sh, d);
   this.physics.update(simDt, { bodyId, time: this.t, focus: onFoot ? this.ex.p : this.sh.p, sunDir, disturbers: d });
   world.setPhysics(this.physics);                           // once
   ```
   `bodyId` is the body whose ground frame the focus is in, else `null`. `sunDir` is the unit
   vector from the body toward the sun in that body's local (rotating) frame.
   **New in P6, one field, optional: `eye`**, the camera's position in the same body-local
   frame (`{ x, y, z }`): `this.physics.update(simDt, { ..., eye })`. Snow is simulated in a box
   16 m across round it, so the flakes are where the lens is and each lands on the ground it
   is over. Without it the box is round the focus and the kit wraps it round the camera (it
   works, but a flake shown a box away from where it is melts over the wrong ground). An eye
   over 60 m from the focus (the map, a free camera) is ignored.
2. **env.** `physics.bindEnv(bodyId, env)` adds `air`, `ground`, `liquid`, and `gravity` /
   `radius` when missing. Your explorer env (`sample`, `gravity`) needs nothing more. Your ship
   env (`up`, `altitude`, `spaceAlt`, `hasBody`, `sample`) needs one more field for ground effect
   and downwash: `env.altGround = st.altGround`. In deep space pass `bindEnv(null, env)` (or
   skip it): `up: null` means no gravity and no air.
3. **Explorer.** Inside `stepExplorer` keep everything up to the wish direction and `maxSpeed`
   (walk, run, swim speed are commands), the look-ahead wall check if you like it, fuel rules,
   facing and the animation mode. Replace the block from "horizontal velocity" to "integrate
   and collide" with:
   ```js
   const alt = r - Math.max(groundR, liquidR);
   stepExplorerBody(st, {
     wish: scale(wish, maxSpeed),
     jump: input.jump,
     jet: input.jet && jetArmed && st.fuel > 0 ? 1 : 0,
     jetMaxRise: T.jetMaxRise,
     descentLimit: alt < T.softFallHeight ? T.softFallSpeed : T.terminalFall,
   }, dt, env);
   st.fuel -= dt * st.phys.jetUse / T.jetFuelSeconds;        // or by time, your call
   st.jetting = st.phys.jetThrottle > 0.05; st.landedHard = st.phys.impact || st.landedHard;
   st.swimming = !st.grounded && st.phys.submerged01 > 0.3;
   ```
4. **Ship in flight.** Keep all of `stepFlight`'s steering and the target velocity; replace
   `v = add(st.v, scale(sub(target, st.v), damp(1 / tau, dt)))` and the integration with
   `stepShipBody(st, { target, tau, carve01: 1, boost: !env.hasBody || env.altitude > env.spaceAlt }, dt, env)`.
   Apply your cushion, pull-up and flare to `target` (raise its vertical part) instead of
   clamping `v`: a clamp on velocity is an infinite force, and it shows as a kink. Add
   `st.phys.buffetAngle.pitch / roll` to the drawn attitude and to the chase camera.
5. **Lift-off and landing.** Lift-off, exactly (tested in `ship.test.mjs`, "lift-off on the
   gear", on Earth, the Moon and Jupiter):
   ```js
   wakeShip(st); let lift01 = 0;
   // every frame while st.phys.contacts > 0 (or until the first frame it reads 0):
   lift01 = Math.min(1, lift01 + dt / 1.2);
   stepShipGear(st, { lift01, hold: scale(up, climb * lift01) }, dt, env);   // climb: your rise speed, e.g. 2.5-4.8 m/s
   // the first frame st.phys.contacts === 0: hand over, same target, nothing else to do
   stepShipBody(st, { target: scale(up, climb), tau, hover: true }, dt, env);
   ```
   The legs stretch as the weight comes off (the hull rises 2 cm on the Moon, 10 on Earth, 26
   on Jupiter before anything leaves the ground), the thruster wash is lit from the first frame
   (`st.phys.downwash`: 10.6 kN and 27 m/s on Earth, so `physics.ship.disturbers` blows dust and
   grass before the feet leave), the feet leave after 0.7 s (Moon) to 1.2 s (Jupiter), and
   `st.phys.lift01` carries over to the hand-over so nothing sags (worst drop in any frame
   under 4 mm). Landing: your assist flies `target` down to about 1 m at 1-1.5 m/s,
   then `stepShipGear(st, { lift01: 1, hold: up * -0.6 }, ...)` until `st.phys.contacts > 0`,
   then fade `lift01` to 0 over 1.5 s; touchdown is `contacts === 3 && lift01 === 0`; in LANDED
   keep calling `stepShipGear` (it returns at once when `st.phys.asleep`). The lab's ship scene
   does exactly this (`driveShip` in `physics-lab.html`).
6. **Landing sites.** Replace `landMaxSlope` with friction: a site holds the ship when
   `Math.tan(slope) < 0.8 * physics.ground(bodyId, dir, out, surface).friction`. On warm ice
   that is 3 degrees; on rock 34.
7. **Braking in vacuum**: pass `brake: 1` (X, or throttling far down) and drop your special
   case. From 750 m/s: 6.3 s and 1.9 km instead of 53.7 s and 20.4 km (test "field brake"). It never speeds the ship up
   and adds nothing to `gLoad`. `st.phys.fieldBrake` (m/s2) is there for a glow or a sound.
8. **Seed** (done in your `af6ea97`: `main.js` passes none now). The default (18) is chosen
   for the real spawn; seed 1 gave an empty sky there for forty minutes. With it: fair for
   two minutes, cloud building to overcast by four, a thunderstorm from 10:40 to 13:20 (22 mm/h,
   hail, lightning 4 a minute), clear by 14:00, mist in the still wet wood after (pinned by a test).
9. Add `node --test src/physics/` to "every check". `src/physics/package.json` is a dev-only
   file that makes that exact command run every test file (Node 22 runs a directory argument as
   one module); the game never loads it.

### Open on your side, as the coordinator relays it (each recipe is complete here)
- **New in P6 (flown this time; numbers and reasons in "The integrated game, played in
  P6"). Five levers, each one line, each yours to take or leave:**
  1. `eye` in `physics.update` (step 1 above): the camera's body-local position, so that the
     snow is where the lens is.
  2. `carveAccel: 30` in the command to `stepShipBody` (next to `carve01`): Earth, Venus and
     Neptune fly as today; Mars and the airless worlds run wide of the nose (29 deg/s, 150 m
     at cruise instead of 42 deg/s). `st.phys.fieldCarve` (m/s2) is there for a glow or a hum.
  3. `speedScale = clamp((1.225 / rho0)^0.4, 0.75, 3)`: the giants spread over 16 m/s (Neptune
     50, Saturn 52, Uranus 58, Jupiter 62), Mars and the airless worlds at 138 m/s; with it
     `brake: 0.15` in thin air (X stops from 138 m/s in 4 s) and `carveAccel: 40`.
  4. `assistAccel = 4 * clamp(g / 9, 0.45, 1)`: the Moon and Mars let you slide a little.
  5. `softFallSpeed` 4 m/s instead of 7: a hop ends on bent knees, not on a 2.7 m drop.
- **Touchdown on the legs.** Step 5 above is the whole recipe: your assist flies `target`
  down to about 1 m at 1 to 1.5 m/s, then `stepShipGear(st, { lift01: 1, hold: up * -0.6 },
  dt, env)` every frame until `st.phys.contacts > 0`, then fade `lift01` to 0 over 1.5 s;
  landed is `contacts === 3 && lift01 === 0`; keep calling `stepShipGear` while parked (it
  returns at once when `st.phys.asleep`). The legs take the last metre: 9 cm of sag on Earth,
  asleep 0.6 s after settling; `st.phys.legCompress[3]` and `legLoad[3]` are there to draw
  and to sound. Tested in `ship.test.mjs` on Earth, the Moon and Jupiter.
- **Rain audio.** How hard it rains: `physics.here.sky.rain` (0..1, continuous; `snowfall`
  for snow, silent). What it falls on: `physics.here.cover.canopy01` (leaves overhead: the
  hiss of rain on a wood) and `physics.water(bodyId, p).present`; under the hull nothing
  lands (the hull takes the splashes: `physics.particles.events` kind 0 at the hull's
  height); after the rain `physics.particles.system.dripping` (0..1) is the wood dripping.
  Thunder: `physics.here.weather.lightning.thunderIn` (s, negative at the bang) and `thunder01`.
- **The pulse drive on my planner.** `const plan = physics.ship.planSpeedChange(v0, v1,
  aMax, jMax)` then each frame `physics.ship.sampleSpeedChange(plan, t)` -> `{ a, v, s }`
  (jerk-limited: the acceleration ramps, so the start and the stop have no kink);
  `physics.ship.pulseBrakeDistance(v)` is how far out to begin braking;
  `physics.ship.stepPulse(ps = { a, v }, vWant, dt)` is the same as a step function.
- **Your flight pace per world** (`env.speedScale = clamp((1.225 / rho0)^0.25, 0.75, 1.6)`;
  computed against my models, not flown this run): cruise near the ground comes out 74 m/s
  on Mars and the airless bodies, 56 Jupiter, 53 Uranus, 50 Saturn, 49 Neptune, 46 Earth, 35
  Venus. The order is the physics' (drag goes with density) and every value is under what the
  engines and the air allow (thrust meets drag at 251 m/s on Earth, 367 Jupiter, 332 Uranus,
  291 Saturn, 279 Neptune, 1960 Mars) except Venus, where the air stops the ship at 34 m/s
  whatever is commanded: there the model decides, as it should. Physically sensible, and
  cautious: the real ceiling goes as density to the power -1/2, yours as -1/4 and clamped, so
  the four giants and Earth all cruise within 10 m/s of each other and only Venus (slow and
  heavy) and Mars and the airless bodies (1.6 times faster) will be felt as different. If the
  giants should differ too, the honest lever is their wind, which is already there (a hover
  on Neptune is pushed 1.8 m in 4 s), not the envelope.

### Which of your numbers each of mine replaces

Explorer (`src/player/explorer.js` EXPLORER -> `EXPLORER_BODY`, override any field by passing your own `T`):

| Yours | Fate | Mine | Assist you keep on top |
|---|---|---|---|
| `walkSpeed` 4.2, `runSpeed` 7.4, `swimSpeed` 2.6 | keep: they are commands | `cmd.wish` | none; the body may deliver less (see table below) |
| `groundAccel` 26 | replaced | `legAccel` 9 m/s2, `legPower` 1600 W, `response` 0.11 s, friction from `ground()` | `cmd.assistAccel` (suit thrusters, not traction-limited): 4 gives 0.38 s to 90 % of walking speed and a 0.8 m stop |
| `airAccel` 6 | replaced | `rcsAccel` 4, `rcsTime` 0.5 (small thrusters) | `cmd.airControl` 0..1 |
| `jetAirAccel` 11 | replaced | `jetVector` 0.6 x thrust = 10.2 m/s2, `jetSteerTime` 0.35 | |
| `jumpSpeed` 4.8 | kept as the Earth value | `jumpSpeed` 4.8 at `jumpG0` 9.0, `jumpPush` 0.4: 1.28 m on Earth, 6.5 m on the Moon, 0.91 m on Jupiter | |
| `jetThrust` 17 | same force | `jetThrust` 1700 N on `mass` 100 kg, `jetSpool` 0.08 s | |
| `jetMaxRise` 8.5 | keep as assist | governor inside the step | `cmd.jetMaxRise` |
| `jetFuelSeconds`, recharge numbers, `jetStartDelay` | keep, yours | `st.phys.jetUse` tells you the thrust actually used | |
| `terminalFall` 24 | replaced by drag | `cdaFall` 0.6 m2: 49 m/s on Earth, 6.6 on Venus, none in vacuum | `cmd.descentLimit = 24` (retro thrust up to `retroAccel` 45) |
| `softFallHeight` 3, `softFallSpeed` 7 | keep as assist | same retro thrust | `cmd.descentLimit = 7` below 3 m |
| `maxSlope` 0.80, `slideSlope` 0.96, `slideSpeed` 5 | replaced | hold while tan(slope) <= friction + foothold (grass 43 deg, rock 51, sand 33, warm ice 5); beyond it a slide on `max(kinetic, arrest x hold)` | none needed |
| `stepDown` 0.5 | replaced | `stickGap` 0.28, `crestLaunch`, `crestFilter` 0.15 s | set `crestLaunch: false` to stay planted in low gravity |
| `wadeSlowDepth`, `wadeSlowFactor` | replaced | liquid drag on `wadeWidth` 0.32 m x depth, buoyancy | |
| `swimDepth` 1.25 | same | `floatDepth` 1.25, `floatAssist`, `swimForce` 400 N | |
| `turnRate` 11, `height`, `eyeHeight` | keep, yours | | |

What the body then does with a 4.2 m/s walk and a 7.4 m/s run (Earth, measured by the tests' model):

| Ground | to 90 % of walk | stop from walk | run top speed | stop from run |
|---|---|---|---|---|
| grass | 0.58 s | 0.8 s, 1.2 m | 7.4 | 1.3 s, 4.1 m |
| dry rock | 0.55 s | 0.7 s, 0.9 m | 7.4 | 1.1 s, 3.3 m |
| wet rock | 0.70 s | 1.0 s, 1.7 m | 7.4 | 1.7 s, 5.8 m |
| sand | 1.2 s | 0.8 s, 1.1 m | 5.5 | 1.0 s, 1.9 m |
| deep snow (40 cm) | 3.2 s | 0.7 s, 0.9 m | 3.9 | 0.7 s, 0.9 m |
| ice at 271 K | never (tops at 3.3 after 4 s) | 3.6 s, 5.7 m | 3.3 | 3.6 s, 5.7 m |

Uphill run: 3 % slower at 10 degrees, 37 % at 20, 55 % at 30. Wading at walk command: 0.75 x
at 0.3 m, 0.62 x at 0.5 m, 0.36 x at 1 m; floating from 1.25 m. Venus air: 3.8 m/s run.

Ship (`src/ship/flight.js` SHIP -> `SHIP_BODY`):

| Yours | Fate | Mine | Assist you keep on top |
|---|---|---|---|
| `speedGround` 46, `speedAtmoTop` 160, `speedSpace` 750, `liftSpeed`, `liftSpeedSpace`, `throttleRate`, `reverseMax` | keep: the flight computer's commanded velocity | `cmd.target` | your speed governor. Physics adds a true ceiling where thrust meets drag: 250 m/s at Earth's ground, **34 m/s at Venus' ground** |
| `tauAtmo` 1.0, `tauSpace` 1.7, `brakeFactor` | keep as the computer's gain | `cmd.tau`; the achieved acceleration is limited to `accelMain` 22, `accelReverse` 14, `accelSide` 18, `accelLift` 14 m/s2 (`accelSpace` 60 with `boost`) through `spoolUp` 0.45 / `spoolDown` 0.30 s | `cmd.carve01` (the field turns the velocity toward the nose without changing speed): 1 = today's steering feel |
| steering, banking, pitch limit, levelling (10 numbers) | keep, yours | attitude is not touched in flight | add `st.phys.buffetAngle` to the drawn attitude |
| `cushionHeight`, `minClearance`, `lookAhead`, `flare*` | keep as assists | physics adds ground effect (up to +33 % thruster lift under 1 m) | apply them to `target`, not to `v` |
| `bounceRestitution` 0.35 | keep (hull bounce assist) | `ground().restitution` if you want it per material | |
| `hoverHeight` 9, `liftoffSeconds` 2.8 | keep as the sequence | drive it through `stepShipGear` then `stepShipBody` (step 5) | |
| `landGlideSpeed`, `landMaxDescent`, `landMinDescent` 1.1 | keep as the assist | the last metre is `stepShipGear`: 1.6 Hz legs at 0.65 damping, 9 cm of sag on Earth, asleep 0.6 s after settling | |
| `landMaxSlope` 0.62 | replaced | friction of the ground (step 6) | |
| no gravity, no drag, no wind | new | weight carried by `lift01` (0.35 s spool); drag areas 2.4 / 14 / 30 m2 nose / side / belly; wind drift; turbulence | hover is `cmd.hover` (default true) |

Measured through the body with your target law and `carve01: 1`: ground to space in 12.9 s on
Earth at 55 degrees (peak 3.2 g felt), 21.7 s on Venus (drag-limited to 78 m/s), 11.0 s on Mars.

## The integrated game, played in P6 (for PILOT; numbers from `p6/nodeplay.mjs` unless said)

Played two ways: PILOT's pure `Sim` with PAINTER's real ground and obstacles and my physics,
scripted keys, exactly 60 Hz, in Node (every number below); and the game itself in headless
Chromium with real key events on Earth, Mars, the Moon, Venus, Jupiter and Neptune
(`p6/play.mjs`, `p6/fly2.mjs`; software GL at 1 to 4 frames a second: it confirms that keys
reach the bodies and that nothing errors, and its numbers agree with Node's to within what
half-second frames allow: cruise 46 / 77 / 84 / 34 / 56 / 49 m/s, a 360 degree turn in 8.2 s
on every world). The bodies do what the models say everywhere: jumps are ballistic to the
centimetre, the jetpack's first push is 17 m/s2 less gravity, thrust is 22 m/s2.
What follows is what a physicist would object to, and it is all in the assists.

**On foot** (walk 4.2, run 7.4 m/s on every world; `assistAccel` 4 m/s2; g in m/s2):

| World | g | walk: to 90 % | stop from a walk | friction alone would take | jump: take-off, apex, aloft | jetpack 3 s: climb, top, down at |
|---|---|---|---|---|---|---|
| Earth | 9.0 | 0.40 s | 0.53 s, 0.82 m | 0.52 s | 4.65 m/s, 1.23 m, 1.03 s | 8.4 m/s, 27 m, 7.0 m/s |
| Mars | 4.6 | 0.55 s | 0.67 s, 1.18 m | 1.01 s | 5.08 m/s, 2.84 m, 2.22 s | 11.9 m/s, 49 m, 7.1 m/s |
| Moon | 2.2 | 0.73 s | 0.80 s, 1.49 m | 2.07 s | 5.30 m/s, 6.43 m, 4.83 s | 17.0 m/s, 113 m, 7.1 m/s |
| Venus | 8.6 | (run tops out at 5.4 m/s: the air) | 0.53 s | 0.54 s | 4.63 m/s, 1.08 m (drag), 1.00 s | 6.7 m/s, 20 m, 6.9 m/s (its terminal fall is 7) |
| Jupiter | 11.5 | 0.4 s | 0.85 s from a run | 0.80 s | 4.39 m/s, 0.88 m, 0.77 s | 8.5 m/s, 24 m, 7.1 m/s |

1. **The feet never leave the ground while running, on any world** ("feet down 100 % of the
   time" at 7.4 m/s on the Moon). At 2.2 m/s2 a runner is in the air most of each stride; the
   body is a capsule that only goes ballistic over a crest. What sells low gravity today is
   the jump (6.4 m, 4.8 s) and nothing else. The honest gait is PAINTER's animation and a
   bounce in the camera, not a force: the stride is already longer (`(g0 / g)^0.25`, in the
   prints). Offer: `st.phys.stride01` (the phase of the stride, with a flight share that grows
   as g falls) if PILOT or PAINTER want to bob the body by it.
2. **On the Moon 70 % of the grip is the suit's thrusters.** Friction and footholds give 2.0
   m/s2 there; `assistAccel` adds 4 on every world. So the Moon stops you from a walk in
   0.80 s where the ground alone would take 2.07 s, and nobody ever slides. The model is
   right; the assist is the same size on every world. Honest and still forgiving: scale it
   with gravity, `assistAccel = 4 * clamp(g / 9, 0.45, 1)` (Moon 1.8: stop from a walk in
   1.1 s over 2.3 m, from a run in 1.9 s; Mars 2.0; Earth unchanged).
3. **Every fall ends at 7 m/s.** The descent brake (`descentLimit`, `softFallSpeed`) lets the
   explorer hit the ground at 7.0 m/s after any jetpack hop on any world. That is a 2.7 m
   drop on Earth onto straight legs: a parachutist lands at 4 to 5. With 45 m/s2 of retro
   authority the brake can afford 4 m/s; it costs 15 cm more braking height.
4. **The Moon hop is a rocket flight**: 3 s of jetpack reach 17 m/s and 113 m, and coming
   down takes 19 s. (The first agent said this of Mars at 50 m.) The rise limiter
   (`jetMaxRise`) is scaled up as gravity falls; held constant at 8.4 m/s the Moon hop would
   top out near 45 m and the world would still feel light.
5. Mars: the spawn stands in a boulder field; a run of 4 s stalls at 1.3 to 1.9 m/s against
   the stones in two runs out of two (obstacle collision, not traction: `slip01` stays 0).

**The ship** (4200 kg, 22 m/s2 of main thrust, 14 retro, 18 sideways from thrusters and lift;
`speedScale = clamp((1.225 / rho0)^0.25, 0.75, 1.6)`):

| World | air kg/m3 | cruise | 90 % after | q at cruise | turn at cruise | sideways, of which the field | thrusters and lift alone | brake (X) |
|---|---|---|---|---|---|---|---|---|
| Earth | 1.14 | 46.7 m/s | 3.0 s | 1083 Pa | 42.0 deg/s, 69 m | 37, 21 m/s2 | 20.4 deg/s, 141 m | 3.78 s, 97 m |
| Mars | 0.0154 | 77.6 | 3.9 s | 43 Pa | 42.5 deg/s, 120 m | 66, 53 m/s2 | 11.6 deg/s, 441 m (thrusters only: no air to bank on) | 6.07 s, 253 m |
| Moon | 0 | 78 to 84 | 3.8 s | 0 | 42.6 deg/s, 128 m | 71, 57 m/s2 | 10.8 deg/s, 505 m | 6.45 s, 287 m |
| Venus | 59 | 34.9 | 3.2 s | 30 800 Pa | 39.6 deg/s, 30 m, and it slows to 21 m/s | 14, 3 m/s2 | 49 deg/s, 24 m | 2.43 s, 43 m |
| Jupiter | 0.443 | 61.7 (at 60 m) | 4.6 s | 957 Pa | 43.2 deg/s, 90 m | 51, 36 m/s2 | 15.2 deg/s, 255 m | 4.87 s, 162 m |
| Neptune | 0.963 | 48.6 | 3.0 s | 607 Pa | 42.5 deg/s, 68 m | 38, 21 m/s2 | 20.3 deg/s, 144 m | 3.98 s, 106 m |

6. **Every world turns at 42 degrees a second, whatever the speed and whatever the air.**
   That is the carve assist (`carve01`, mine), and it was unbounded: on the Moon the drive
   field pushes the ship sideways at 57 m/s2, 5.8 g, with nothing said, and a 360 degree turn
   costs no speed. Thrusters and lift alone would give 11 deg/s and a 500 m radius there. So
   the worlds that fly "fast and loose" (flight.js's own words) are fast and not loose. New
   in P6: **`cmd.carveAccel`** (m/s2: the most the field gives; absent = as today) and
   `st.phys.fieldCarve` (what it gives now). With `carveAccel: 30` Earth and Neptune are
   unchanged (they ask for 21), Jupiter runs a little wide (asks 36), and Mars and the Moon
   turn at 29 deg/s with a 150 m radius at cruise: the nose comes round at once and the path
   follows, which is what thin air is. Venus is already itself (the air does the turning and
   takes 40 % of the speed for it).
7. **The pace.** The coordinator's question: Earth 46, Neptune 49, Saturn 50, Uranus 53,
   Jupiter 56 m/s near the ground; what would be honest? An airframe is limited by dynamic
   pressure, not speed, so the honest governor holds q (speed as `rho^-0.5`):

   | World | deck air kg/m3 | now | same q as Earth's cruise | full thrust against drag | proposal |
   |---|---|---|---|---|---|
   | Venus | 65 | 35 | 6 | 34 | 34 (the air sets it) |
   | Earth | 1.23 | 46 | 46 | 251 | 46 |
   | Neptune | 0.99 | 49 | 51 | 279 | 50 |
   | Saturn | 0.91 | 50 | 53 | 291 | 52 |
   | Uranus | 0.70 | 53 | 61 | 332 | 58 |
   | Jupiter | 0.57 | 56 | 67 | 368 | 62 |
   | Mars | 0.020 | 74 | 360 | 1962 | 138 |
   | Moon, Mercury, Pluto | none | 74 | any | any | 138 |

   So: **the giants cannot honestly differ much from Earth in speed**, because the deck the
   game flies on sits near one bar on all four (0.57 to 0.99 kg/m3): the honest spread is
   46 to 67, twice today's, and no more. Proposal: exponent 0.4 and the upper clamp at 3
   (`clamp((1.225 / rho0)^0.4, 0.75, 3)`): the giants spread over 16 m/s instead of 10, and
   the airless worlds fly at 138 m/s, which is where the honest difference is. What keeps
   138 m/s forgiving is named and already there: the **field brake** (`cmd.brake`, up to 160
   m/s2; PILOT passes 0 in air today, so X stops on retro thrusters alone: 9.9 s and 680 m
   from 138 m/s; with `brake: 0.15` in thin air it is 4 s and 290 m) and the **carve** with
   `carveAccel: 40` (radius 390 m at 138 m/s; today's unbounded carve would need 100 m/s2).
   Where the giants honestly differ is their **wind** (Neptune blew 36.8 m/s at 60 m during
   this flight, three quarters of the cruise speed, and the hover drifted 1.9 m in 5 s with
   1.2 m/s of bobbing; on every other world the hover drifted under 13 cm) and their
   gravity. The flight computer holds speed over the GROUND, so a gale costs nothing: upwind
   on Neptune the hull is doing 86 m/s through the air (q 3550 Pa, three times the cruise)
   and nobody knows. The honest version flies airspeed; the forgiving version is a share:
   carry the ship with, say, half the wind aloft (upwind 30, downwind 67 m/s over the ground
   on Neptune that day). That would make the giants the windy worlds they are. Feel: PILOT's.
8. **The first second of throttle is still empty** on every world (0, 8 to 10 m/s after
   1 s, then 20 to 22 m/s2): the lever's ramp on top of the engine's 0.45 s spool.
9. **Hover in a gale is exact** except on Neptune (above): Mars 11.6 m/s of wind, 0.00 m of
   drift; Earth 7.2 m/s, 0.12 m. The air is 80 times thinner on Mars, so that one is right.
10. Touchdown: coming down on C from 60 m the sink reaches 18 to 29 m/s and is 1.0 m/s half
    a metre up on every world; the gear takes 0.2 to 0.5 g and rests on 9.6 / 4.9 / 2.1 cm of
    stroke (Earth / Mars / Moon: the weight). Lift-off: the feet leave after 0.65 to 1.1 s
    and the ship is at its 10 m hover in 4 s at under 5.2 m/s. Nothing to object to.
11. In the browser Jupiter's ship came to rest "LANDED" on the cloud sea with no leg in
    contact (it floats there by PILOT's rule; my gear model never engaged). Fine as a rule;
    it wants a wake and a bob from `physics.fields.water`, which the ship does not read.

## For PAINTER: everything you need, on its own (current at the commit that carries this note)

Written to be read cold. `physics` is the object PILOT made with `createPhysics` and hands you
through `world.setPhysics(physics)`; `physics.update` has already run when `world.update` is
called (in the gallery you call `physics.update(dt, { bodyId, time, focus, sunDir })` yourself).
Everything of mine is in **body-local** coordinates (C3). Nothing below is required: each part
stands alone, in the order I would wire them.

**Changed in P7 (tuned against your `wx-*.jpg` frames; your list in "What looks wrong in the
physics as painted", answered item by item). Nothing you call changed its name or arguments;
the DEFAULTS of `DRAW_PAINTED` changed, and since `src/world/index.js` spreads `D.rain` and
`D.snow` before its own numbers, you get all of it without touching a line. Your two override
lines there (`draw.rain = ...`, `draw.snow = ...`) are now exactly my defaults and can go.**
- *Rain.* `DRAW_PAINTED.rain` is `{ width 0.05, exposure 0.12, minPx 4 }` (yours) plus
  `parallel: 1` (every stroke of a frame takes ONE direction in the picture: the mean motion of
  the rain relative to the eye as the picture plane sees it; the strokes lie in the picture
  plane at their drop's depth, so they cannot cross; looking straight down the rain they are
  dots), `maxLen: 1.2` (m: no stroke longer on any world; Jupiter's would be 3.6 m),
  `near: 6` (nothing nearer the eye than 2.4 m, whole from 6 m: your `length(vView) < 3.2`
  discard is no longer needed) and `share: 0.25` (measured in the open in a thunderstorm at
  960x540, fov 50: 106 strokes in view with your table, 37 now; 0.6 strokes a second go out
  whole, 2.0 before).
- *Snow.* `DRAW_PAINTED.snow` is your `{ size 0.07, minPx 3.5, maxPx 6.5, varySize 0.5 }` plus
  `tumble: 1.2, aspect: 0.5`: every flake has a shape of its own (short side 0.5 to 1 of its
  long side) and lies at an angle of its own that turns slowly (0.4 to 1.2 rad/s, half of them
  each way); driven by wind it turns into its motion and is drawn out as before. The quad is
  that oval's box: your `flake` cut (`vPcUv`) follows it. The lab's `DRAW.snow` has it too.
- *Dust.* In a dust storm the marks are no longer about twenty round patches: as the weather's
  dust load (`weather.dustLoad01`) goes from 0.25 to 0.7 the dabs go over to low walls (first
  fewer: 1 in 20 is kept; then wider): level (long side along the picture's horizon, short side
  the local up), four times as wide as high, at most 2.2 m high (so up to 8.8 m wide), nothing
  nearer than 3.6 m, growing and going over 1.2 s more than a puff. Measured in Mars' storm:
  4 to 5 in view, none popping. And the storm's dust is now carried within 3.6 m of the ground
  (it was spread over 14 m: the blots against the sky in `wx-mars-dust.jpg`). Your `puff` cut
  works on the wall as it is (the quad's uv); `maxPx: 80` now bounds the wall's HEIGHT.
  Kicked dust in clear air is the round puff it was.
- *Sea.* Three things, none needs a new uniform (`syncPhysWater` as you have it carries all):
  1. **A swell on open seas.** Where the fetch is open (`sea_coast`, `storm_seas`,
     `gold_islands`, `sky_islands`: fetch over 2 km; nothing on ponds and lakes) the fourth,
     longest train is now a swell: the sea the same wind raises over twelve times the game's
     fetch, at half its height, which follows the wind over a minute and a half and outlasts
     it; on a calm day it is what the body's prevailing wind raises (Earth's coast in a 1 m/s
     calm: 16 m long, 0.2 m high over 1.2 m ripples). Neptune's `storm_seas` in its usual
     wind: wind sea 0.5 m high and 5.9 m long, swell 0.8 m and 30 m; in the 34 m/s gale of
     your frame about 1.7 m and 59 m. It arrives through `uPhysWaterK.w` / `uPhysWaterAmp.w`
     and `pcPhysWater` as it is: your far strokes can follow `along` out to the horizon.
  2. **`uPhysWaterSea.x` is now the significant height of everything together** (wind sea
     and swell: 4 sigma of the surface), so `crest01`, your `shoal` and `pcPhysWaterSurf`
     scale with what is really there. The foam level is re-measured for a sea with a swell
     under it: the foam still covers the share the law gives (tested within 30 %), and sits
     mostly on the tops of the swell, in lines.
  3. **The crest as a line**: `float pcPhysWaterCrestLine(vec3 w, vec2 along)` (w and along
     from `pcPhysWaterD`): 1 along the very top of a high wave (where the surface stops rising
     along the way the waves run), 0 a twenty-fifth of a wavelength either side. Measured: the
     line lies on 1 to 3 % of the sea where `crest01 > 0.5` lies on 12 to 17 %. This is what
     you built by hand ("height high and the slope along the wave direction near zero"); use it
     for the bare-paper stroke and, times `foam01`, to make foam a streak instead of a patch.
     CPU twin: `physics.fields.water.sample(p).line01`. `physics.water()` gained `swell`
     (m) and `swellLength` (m).
- *Splash rings.* More of them where they can be seen: besides each particle's own landing
  (now only recorded within 16 m of the focus) up to 90 rings a second are laid within 10 m of
  the focus in a downpour, more of them nearer, for the drops the particles stand for (real
  rain of that rate lands a thousand drops a second on every square metre): crowns on the
  ground, ripples on liquid at its surface, none under the hull, fewer under leaves. The event
  ring holds 512 (was 256; the kit sizes itself from it: at most 1024 more triangles).
  Measured in a downpour: 12 or more crowns alive at any moment within 10 m on the ground
  (they live 0.28 s), 60 or more ripples on water (1.4 s). On water: tested (kind, height).
- *Grass.* The push round a walker reaches 0.7 m beyond the body (was 0.45): parted about two
  metres wide. And a **wake**: a pushed plant keeps a fifth of the push as a lean, the way it
  was pushed (out and along the walker's path), which goes over six seconds; where the body
  went the grass is pressed down sooner (0.7 s of contact, was 2.5) and stays so for a minute.
  Measured with a walker at 1.5 m/s against a twin world without one: grass 0.6 m off the path
  leans 60 degrees as the walker passes, 25 degrees 3 m behind, 17 degrees 7.5 m behind,
  nothing half a minute later; `flatten01` on the path 0.3 behind the walker. Nothing to wire:
  it is in the `push` texture you already read (RG lean, B flatten). The wash under the ship is
  as it was.
- *Snow, per the coordinator's ruling.* `physics.here.sky` has a twelfth number, **`fresh`**:
  the ground covered by fresh snow, from recent snowfall alone. At the focus it is integrated
  as it falls: it rises only while snow falls (measured through a snow shower: 0.39 to 0.60 of
  cover in the 100 s it snowed, then down steadily: 0.53, 0.46, 0.39 at 200, 300, 400 s after),
  stays fresh for 8 game minutes (e-folding), melts above freezing, and is never more than
  `snow`. Lay `fresh` over your painted ground and drop your own gathering model (`freshSnow`,
  the 25 s / five minutes). **`physics.here.sky` is the authority for `fresh` and `snow`**:
  `physics.sky(physics.weather(p, { time }))` for another place or time estimates them from a
  21-point quadrature over the past and can be 15 % of cover off (every other number is the
  same through both, within 1 %). **`snow` is now standing
  snow of the biome plus fresh, and standing snow is only what my biome table says** (m:
  `polar_frost` 0.04, `ice_shelves` 0.02, `frozen_waves` 0.15, `pearl_fog` 0.08,
  `teal_sinkholes` 0.02, `ice_spires` 0.03, `aurora_tundra` 0.1, Pluto's four 0.01 to 0.1;
  every other biome 0): the alpine meadow reads `snow` 0 in fair weather (it read 1.0: a pack
  I added wherever the daily mean is below freezing; gone). If a biome you have painted under
  snow is not in that list, or one in it is painted bare, tell me the biome and I change the
  table (`snowBase` in `src/physics/ground.js`).
- *A closed sky under what falls.* `cloud` is at least `0.97 (1 - (1 - falling)^2)` where
  `falling` is the larger of `rain` and `snowfall`: over 0.85 from 0.65 on; a blizzard of
  0.81 as at your alpine easel reads cloud 0.93 or more and overcast 0.64 or more (they were
  0.46 and 0.43). You can drop your own closing of the sky under rain and snow.
- *A gale's own sky.* Where the large-scale wind is between 18 and 34 m/s (only the ice giants
  get there outside storm cores) scud covers up to 0.9 of the sky, `overcast` gains up to 0.25,
  `storm` reads up to 0.8, and over an open sea (fetch over 2 km) spray takes the view (`haze`
  down to 0.28, counted in `fog`). Neptune's `storm_seas` in the 34 m/s of your frame: cloud
  over 0.6, overcast over 0.4, storm over 0.5, haze under 0.45, with a swell of 1.7 m; in its
  ordinary 22 m/s a little of each. No forcing needed for a gale frame any more.
- *Rates.* Measured over 150 places, 12 moments and 11 s each per biome, through the stateless
  path with each place's real temperature, at ground level: the fastest any number but `flash`
  moves in a second is 8.5 % on Earth (`haze` and `fog` as a snow front arrives), 8.5 % on
  Jupiter (`rain`), 6.2 % on Uranus, 7.3 % on Neptune, 4.1 % on Saturn, 2.0 % on Mars and
  Venus. The lead's R-WX-1 allows 8 % (15 % on the ice giants): Earth and Jupiter are half a
  point over it at their worst moment; both are the edge of a weather cell passing, older than
  this stage, and not fixed. Ease what you show over 2 s as the lead asks.
- New `DRAW` fields (CPU expanders only; the instanced chunk `expand: 'gpu'` does not have
  them yet): streaks `parallel`, `maxLen`, `near`; dabs `tumble`, `aspect`, `wall`, `wallFrom`,
  `wallFull`, `wallShare`, `wallHigh`, `wallNear`, `wallFade`. All documented at the top of
  `src/physics/three/expand.js`.

**Changed in P6 (`16d5305`), all of it additive; nothing you would have written against C, D
or E breaks:**
- `DRAW_PAINTED` is now exported from `src/physics/three/index.js` (it was a constant inside
  the lab). Pass it as `weather: { draw: DRAW_PAINTED }`.
- Particle buffers gained `left` (seconds until the particle is gone) and `radius`; the kits
  read them. The draw table gained `fadeOut`, `strobe`, `streak`, `near` (C, "Nothing pops").
- The instanced variant (`expand: 'gpu'`) gained the instance attribute `aPcLeft` and the
  uniform `uPcDraw3` (both arrive through the geometry and `info.uniforms`).
- `physics.update` takes an optional `eye` (the camera, body-local): pass it in the gallery.
- No uniform, chunk or call of A, B, D or E changed. `makeKitMaterial` in the lab is unchanged.
- **Branches (second P6 commit).** The flora chunk gained `pcPhysBranch` and two uniforms
  (`uPhysBranchPhase`, `uPhysBranch`, both in `physics.fields.flora.uniforms`, copy them with
  the rest). Nothing changes until you call it: one line, A below.
- **Drifts (second P6 commit).** `physics.fields.drift`: F below. Nothing changes until you read it.
- Two fixes you will see: rain, snow, dust and splash rings now lie on the curved ground far
  from where the session started (they floated up to 18 m over it), and it rains over deep
  water (the weather entered 18 m over the sea BED, so over a sea deeper than that it fell
  under the surface and nothing showed).

### A. Plants in the wind (wired by your predecessor in `1e1801e`; one cheap improvement open)
- Three fields, `physics.fields.flora`: `.bend` (32x32 RGBA: RG soft-plant load east/north, BA
  stiff-plant load; 8 m cells), `.wind` (32x32: RG wind at 2 m in m/s, B gust 0..1, A turbulence
  m/s), `.push` (64x64, 0.5 m cells: RG push load, B flattened 0..1, A shaken 0..1). Re-upload
  bend and wind when `.version` changes (every frame), push when `.pushVersion` changes.
  `.uniforms` holds plain arrays for `uPhysAnchor, uPhysEast, uPhysNorth, uPhysUp, uPhysWindMap,
  uPhysNearMap, uPhysWave, uPhysWavePhase, uPhysShape`: copy them each frame.
- Shader: `physics.glsl.flora` above `main()`; per plant ROOT (body-local): `vec4 pb =
  pcPhysBend(rootB, uStiff);` then `wp = io + pcPhysDisplace(wp - io, normalize(rootB),
  heightInMetres, pb.xy);`. `uStiff` 0 grass, ferns, flowers; 0.35 bushes; 1 trees.
  `pcPhysBendLite(rootB, uStiff)` (returns the vec2 bend) is the one-lookup version: wind
  response only, for mid and far tiers. `pb.z` flattened, `pb.w` shaken (for leaf flutter).
- **Open, cheap: fewer fetches.** Today the chunk blends four texels by hand: 12 fetches a
  vertex (4 for Lite). Upload the three fields as `THREE.HalfFloatType` (convert with
  `THREE.DataUtils.toHalfFloat` on upload: 12 k values a frame) with `LinearFilter` and
  `ClampToEdgeWrapping`, and put `#define PC_PHYS_LINEAR` in front of the chunk: **3 fetches a
  vertex, 1 for Lite**. 16-bit float textures filter in every WebGL2. `physics-lab.html?linear=1`
  does exactly this (functions `tex` and `upload`); measured against the JS model it is as
  exact as float32 (2.5 mm on a tip displaced 2 m).
- Still unseen by anyone in the game: grass parting round the explorer and under the ship's
  wash. The push field is live (370 cells pushed on a short walk in the browser).
- **New in P6, one line: crowns that do not sway as one piece.** A tree's branches swing two
  to four times faster than its trunk and out of step with each other. For trees and tall
  shrubs near the eye, between `pcPhysBend` and `pcPhysDisplace`:
  ```glsl
  vec3 rel = wp - io;
  rel += pcPhysBranch(rel, up, heightInMetres, rootB, pb);   // pb: the vec4 pcPhysBend returned
  wp = io + pcPhysDisplace(rel, up, heightInMetres, pb.xy);
  ```
  and copy two more uniforms from `physics.fields.flora.uniforms` each frame:
  `uPhysBranchPhase` (vec4) and `uPhysBranch` (vec4). No new texture, four sines and an atan
  a vertex. Nothing moves at the trunk, the tips most (a 3.5 m branch: about 10 cm in a
  fresh breeze, half a metre in a storm, at 1 to 2.5 Hz); the motion is continuous all the
  way round the trunk (whole lobes), so a crown mesh is never torn; each tree has its own
  phase. A crown that the explorer brushes or the ship's wash hits shivers (`pb.w`). The
  chunk compiles inside your plants today (painted lab); nobody has seen it move.

### B. Weather for the sky and the sheet: `physics.here.sky` (numbers) and `physics.here.weather` (detail), every frame, free
- **Start here: `physics.here.sky`**, eleven numbers 0..1, continuous in time, no meteorology
  in them: `cloud` (paint cloud over the blue), `overcast` (dim and cool the light, soften
  shadows), `haze` (multiply your clear-day fog distance by it), `fog` and `dust` (what the
  lost view is lost to: grey water, or dust to tint with the ground's colour), `wet` (darker
  ground washes), `snow` (leave the paper white), `rain` and `snowfall` (how much is falling,
  liquid and frozen), `storm`, `flash` (lightning now: bare paper). PILOT may hand the same
  object to `setMood`. At the spawn with the default seed they run: fair `cloud 0.15`,
  minute five `cloud 0.83, overcast 0.38`, the storm `overcast 0.95, rain 0.92, haze 0.36,
  wet 1.0`, after it `cloud 0.13, haze 0.47 (mist), wet 0.93`. The rest of this section is
  the detail behind them.
- `cloud01` (cover; 0 once the camera is above the deck), `cloudBelow01`, `storm01`,
  `front01` (a gust front passing).
- `visibility01`: multiply your clear-day fog distance by it. May fall by up to 5 %/s at a
  fog bank and 8 %/s at a snow squall; low-pass it in the sky if that reads as a pop.
- `fog01`, `dust01`, `haze01`: **the share of the view each veil takes by itself** (with only
  fog in the air, `visibility01 = 1 - fog01`; 0.5 is 5 km of visual range, 0.78 is 1 km, 0.9
  is 200 m). Use them to tint, not to set distance (that is `visibility01`).
- `wetness01` (darker, wetter ground washes; lingers after rain, dries faster in sun and
  wind), `snowDepth` (m), `temperature` (K).
- `precipitation`: `type` (`none | drizzle | rain | snow | ice | acid | frost`),
  `intensity01` (continuous), `rate` (mm/h), `hail01`, `reachesGround01` (Venus: under 1
  means the streaks evaporate overhead).
- `lightning.flash01`: brightness now, 3-4 strokes inside a quarter second (bare paper
  showing through); `lightning.last` is where it struck (unit direction, distance).
- `kind` is a word for a read-out (`thunderstorm`, `mist`, `dust storm`, ...); `intensity01`
  is how much weather there is, continuous. Do not drive paint from `kind`.
- Far storms: `physics.util.cellsAt(bodyId)` -> `[{ x, y, z (unit centre), r (m), w
  (strength), kindId }]`: paint the dark ones where it rains. Wind for cloud drift:
  `physics.air(bodyId, p, out, heightAboveGround).wind` (faster aloft; `physics.here.air.wind`
  at the focus).

### C. Rain, snow, dust, marks: the draw kits (`src/physics/three/`)
They follow your material contract (your notes, "For PHYSICS: what a draw kit's material must
do"): one opaque pass, no blending, holes by `discard`. Each kit hands your factory a
**vertex chunk that defines `vec3 pcKitPosition()`** plus three varyings.

```js
import { createPhysicsKits, SHAPE_GLSL, DRAW_PAINTED } from '../physics/three/index.js';   // the only folder of mine that imports three
const kits = createPhysicsKits(physics, { makeMaterial, weather: { draw: DRAW_PAINTED } });   // once
// every frame, after physics.update and after PILOT has placed the body roots:
kits.update(bodyRootOf(physics.here.bodyId), camera, painter.info.internalHeight);   // INTERNAL pixels: the floor is yours
```
`makeMaterial(kind, info)` is yours. This one is **proven in your real pipeline** with your
public exports only (`makePaintUniforms`, the three chunks from `src/render/index.js`, both
render targets, your post pass; `physics-lab.html?painted=1`, source
`src/physics/three/painted-lab.js`, function `makeKitMaterial`). Lift it as it stands:
```js
import { makePaintUniforms, bindBodyUniforms, VERT_PARS, VERT_END, FRAG_PARS } from '../render/index.js';
import { SHAPE_GLSL } from '../physics/three/index.js';
function makeKitMaterial(kind, info) {
  const m = new THREE.ShaderMaterial({
    // everything FRAG_PARS declares, lit and hazed like the body, plus the kit's own uniforms
    uniforms: makePaintUniforms(world.bodyUniforms(bodyId) || undefined, {
      uColor: { value: INK[kind] },            // Vector3: the kind's own ink (rain, snow, leaves ...)
      uPcInk: { value: palette },              // 16 x Vector3: your ink for each ground material, by its number
      ...info.uniforms }),
    vertexShader: `${VERT_PARS}\n${info.vertexChunk}\nvarying vec3 vView;
      void main() { vec4 mv = modelViewMatrix * vec4(pcKitPosition(), 1.0); vView = mv.xyz;
        gl_Position = projectionMatrix * mv; ${VERT_END} }`,
    fragmentShader: `${FRAG_PARS}\n${SHAPE_GLSL}\nuniform vec3 uColor; uniform vec3 uPcInk[16];
      varying vec2 vPcUv; varying vec4 vPcData; varying vec3 vView; varying float vPcMat;
      void main() {
        #include <logdepthbuf_fragment>
        vec3 ink = vPcMat < 200.0 ? uPcInk[int(vPcMat + 0.5)] : uColor;   // the ground it came from, or its own
        ${FRAG[kind] || FRAG[info.shape]}      // cuts the hole (discard), sets vec3 c (from ink) and float w
        c = pcAtmos(pcTone(c, 2.0), pcFogAmount(length(vView)));
        pcWrite(c, w, vec3(0.0, 0.0, 1.0), -vView.z, ${info.region.toFixed(1)});
      }`,
    side: THREE.DoubleSide, polygonOffset: info.shape === 'mark' || info.shape === 'ring',
    polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  m.userData.pcPainted = true;
  return m;                 // if the body's uniforms were not there yet: bindBodyUniforms(m, world.bodyUniforms(bodyId)) once they are
}
```
`FRAG` is one line of GLSL a shape (the lab's are in `painted-lab.js`: a tapering stroke, a
round dab, a flake with a ragged edge, a ragged dry-brush puff cut from `uNoise3D` at two
scales, a ring, a print thinned through `uNoise3D`).

**Ink (new in P5).** Every loose particle and every mark says what ground it came from:
`vPcMat` is an index into `physics.data.MATERIAL_IDS` (`grass, soil, litter, mud, sand, dust,
gravel, rock, snow, ice, ash, glass, crystal, moss, bed`, numbers 0 to 14), or 255 for what
did not come from the ground. Kicked dust, blown sand, scour, spray (it says `bed`: tint it
with your liquid) and every footprint, pad print and scour dish carry it; snow and mud are
named as the weather makes them (a print in 4 cm of fresh snow says snow). Storm dust says
`dust`: the world's own. Make a palette of 16 colours a biome (the lab takes the biome's
three `ground` washes from `looks.js`, leaves snow and ice near paper and deepens mud) and
the brown blot on the forest floor is gone: dust is the colour of what it was kicked from,
a print is "this ground, darker" (`ink * 0.66`), its rim the same ground diluted.

**What survives your post pass (new in P5).** The kits do this themselves now; you only say
how large the least mark is (`minPx`, in your internal pixels: 3 or more):
- A mark that the floor makes f times larger than it is stands for f (streak) or f^2 (dab)
  of its kind, and only that share is drawn: far air holds fewer, larger marks (art bible 4).
  Which ones is a number each particle keeps for life; a mark shrinks smoothly to nothing as
  its turn passes (measured: under 0.25 px a 5 cm step), so nothing pops or twinkles.
- The physics says how much of a sight line each kind hides (`precipitation.extinction`,
  `dustExtinction`, per metre). The floor thins a kind only where its marks would hide more
  than that. `kits.weather.stats.cover.<kind>` is the share the marks paint: storm rain
  0.66, a blizzard's flakes 0.03 to 0.55, storm dust 1. **What is missing from 1 is veil, and
  the veil is yours** (E below).
- Snow (changed in P6). Single flakes only read near the lens, so the physics simulates the
  2000 it carries in a box 16 m across round the EYE (PILOT passes the camera as `frame.eye`
  to `physics.update`; in the gallery pass it yourself: `eye: cameraPositionBodyLocal`; without
  it the box is round the focus). Each flake lands on the ground it is over, is caught by the
  crowns it is under and stopped by the hull, and rides the air up and down slopes. The kit
  shows the box modulo itself round the camera it is given, so nothing changes for you; `cell`
  in the draw table is rounded to a size that divides the box (9 becomes 8). Flakes are drawn
  out along their motion (`exposure`, `smear`), differ in size (`varySize`), and are never
  larger than `maxPx`.
- **Nothing pops or strobes (new in P6; measured, numbers under Status).** Every particle
  carries `left`, the seconds until it is gone, and the kits shrink a mark to nothing over its
  kind's `fadeOut` (dust 0.7 s: a 2 m billow no longer vanishes between two frames; snow 0.3 s;
  rain 0.08 s: a stroke thins to a point over its last 40 cm). A dab is drawn out at least as
  far as it travels in a frame (`strobe`, the frame time, 20 ms), so driving snow is slanted
  strokes that overlap from frame to frame; one that would have to be more than `streak` (3)
  sizes long is a hairline and shrinks away (gone at 4.8). Nothing is drawn nearer the eye than
  0.4 of `near` (snow 3 m, dust 2.5 m). You need do nothing: the defaults are in `DRAW`, and
  `DRAW_PAINTED` inherits them.
- Dust in a storm is sized from the dust in the air (up to `sizeMax`; say what share of its
  quad your puff inks with `fill`): 2 m billows where there were 0.5 m blots.
- The set for your pipeline (`DRAW_PAINTED`, exported from `src/physics/three/index.js` since
  P6; it was a constant inside `painted-lab.js`): rain 7 cm wide, 140 ms
  exposure, floor 3 px; snow 10 cm, floor 4 px, ceiling 10 px, exposure 40 ms, smear 1.2,
  varySize 0.4, cell 9; dust 0.5 m growing 0.35 m/s, floor 8 px, ceiling 80 px, sizeMax 2.6,
  fill 0.3, exposure 120 ms; hail 5 cm; sand 3.5 cm; spray 4 cm; ash 9 cm; spores 5 cm;
  leaves 10 cm.

The rest of the contract:
- `pcKitPosition()` returns the vertex in the mesh's own coordinates: body-local axes, metres,
  relative to the mesh, which the kit parents under the body root you pass and places at a
  body-local point (C3). Multiply by `modelViewMatrix` as for any mesh.
- `vPcUv`: 0..1 across the quad. `vPcData`: per kind, below (also in `info.data`). `vPcMat`:
  above (declare it in the fragment only if you read it). `info.inked` says whether the kind
  can carry a material at all.
- `info.region`: my suggestion for your region id (2.x rain, hail, spray, snow, rings; 1.x
  marks, dust, sand, ash; 4.x leaves, spores). Yours to change.
- Nothing needs blending: particles are born small, grow in, shrink to nothing at the edge of
  the simulated volume (24 m) or of their cell and over their last moments; shapes inside a
  quad are cut with `discard`.
- Budget (PILOT's conditions): at most 12 draw calls for all kits (one per kind that has
  anything in the air, rings, marks) and, with every buffer full at the highest quality, 31 k
  triangles; typical: a downpour 3 to 5 calls and 3 k triangles, a blizzard 4 and 3.6 k, fair
  weather 0 to 2. The kits set no `renderOrder`: draw order is yours. Meshes are not
  frustum-culled. CPU per frame in Node: a downpour 0.07 ms, 2000 flakes 0.13 ms, marks 0.06
  ms only when one is added; `expand: 'gpu'` (instanced straight from my buffers) a third of that.

The kinds, and what `vPcUv` / `vPcData` mean:
1. **Streaks: `rain`, `hail`, `sand`, `spray`**. A quad per particle; `vPcUv.x` across,
   `vPcUv.y` 0 at the head (where the drop is) to 1 at the tail (where it was one exposure
   ago *relative to the camera*: run and the rain slants at you). `vPcData.x` a shade
   1 - vary .. 1 that stays with the particle. A stroke: `if (abs(vPcUv.x - 0.5) * 2.0 >
   1.0 - 0.75 * vPcUv.y) discard;`.
2. **Dabs: `snow`, `dust`, `ash`, `spores`, `leaves`**. Quads facing the picture plane; a
   round dab is `if (length(vPcUv - 0.5) > 0.5) discard;`. Dust grows with age (a puff
   spreads), leaves and ash turn, snow and dust are drawn out along `vPcUv.x` by their motion.
3. **Instanced variant** (`weather: { expand: 'gpu' }`): one quad, instanced; the instance
   attributes are my arrays themselves (no copy). Same `pcKitPosition()`, same varyings, with
   `vPcData` = (shade, age s, grain size m, speed m/s); needs `info.uniforms` in the material
   (the kit keeps them current; P6 added `uPcDraw3` there and the instance attribute `aPcLeft`
   in the geometry: nothing to do if you spread `info.uniforms` as the example does). Take
   this one for the final weather; take the cpu one today.
4. **`ring`**: the splash of a drop, the ripple it leaves on liquid, the puff where a flake
   settles, a hailstone's bounce: flat on the ground, growing with age. `vPcData` = (kind 0
   splash / 1 ripple / 2 settle / 3 bounce, strength 0..1, age 0..1, drop size m).
   `SHAPE_GLSL`: `pcPhysRingCover(vPcUv, vPcData.z)`; `discard` under about 0.2. (Erased by
   your post pass at any distance I tried; they want a region id that is kept crisp.)
5. **`mark`** (`kits.marks`): footprints, the ship's three gear pads, scour dishes: a quad
   laid on the ground (follows the slope near the focus), 15 mm above it: give the material
   `polygonOffset`. `vPcUv.x` across, `.y` along the direction of travel; `vPcData` = (depth
   m, rim height m, kind 0/1 feet, 2 pad, 4 scour dish, fade 1..0 over its life); `vPcMat` the
   ground it was pressed into. `SHAPE_GLSL`: `pcPhysMarkCover(vPcUv, vPcData.z)` (a boot's
   outline or a disc) and `pcPhysMarkRim(...)` (the raised edge on sand, snow and dust).
   Fade without blending: `discard` against your noise (the lab does; fixed in the mark).

What the kits do not draw: the sea (D), lightning (B), dust devils as columns
(`physics.features.devils`: foot `p`, `radius`, `height`, `strength`; their dust and sand
are in the particle kits), the sky and every veil (E).

### D. The sea: waves, crests, foam and wakes in your own liquid material
There is no kit for the sea any more (the patch is off by default: a second surface laid
over yours fights it; frame `painted-neptune-sea.jpg`). The delivery is a chunk for
`makeWaterMaterial`, usable in the vertex stage, the fragment stage or both:
```glsl
${physics.glsl.water}                                   // paste above main(); shares uPhysAnchor/East/North/Up with the flora chunk (guarded)
// vertex: lift the surface and keep the body-local point for the fragment stage
vec2 along; vec3 w = pcPhysWaterD(bodyLocalPos, along);  // w = (height m, dh/deast, dh/dnorth)
bodyLocalPos += normalize(bodyLocalPos) * w.x;
// fragment (#define PC_PHYS_NO_WAKE before the chunk if the 16-step wake loop is too dear there):
vec2 along; vec3 w = pcPhysWaterD(vBody, along);
vec3 n = pcPhysWaterNormal(w, normalize(vBody));          // body-local unit normal
vec3 strokeDir = pcPhysWaterDir(along);                   // body-local: the way the crests lie here: run your strokes along it
vec2 cf = pcPhysWaterCrest(w);                            // x crest01: the tops of the higher waves (leave the paper bare)
                                                          // y foam01: the sea is breaking here (whitecaps: paper, ragged)
float surf = pcPhysWaterSurf(yourDepthUnderTheSurface);   // 0..1: the waves break in the shallows (the white line at a shore)
```
- Uniforms, from `physics.fields.water.uniforms` every frame: `uPhysWaterDir` vec2,
  `uPhysWaterK`, `uPhysWaterAmp`, `uPhysWaterPhase`, `uPhysWaterGroup` vec4, **`uPhysWaterSea`
  vec4 (new)**, `uPhysWake` vec4[16] (a Float32Array(64): give it to three as it is),
  `uPhysWakeG` float; plus the frame uniforms `uPhysAnchor, uPhysEast, uPhysNorth, uPhysUp`
  (`physics.fields.flora.uniforms` has them).
- What you get: a wind sea whose height, length and direction follow the wind, the fetch of
  the biome and the world's gravity and air (Neptune's methane runs higher than water); short
  crests in sets (no ruled lines from the air); rings behind a swimmer and under the ship's
  thrusters (on calm water a ring's crest reads as `crest01` = 1: a broken ring of paper).
  Crests: `crest01` is over a half on about a seventh of the sea. Foam: the share of the
  surface that is white follows the wind as measured at sea (1.6 % at 10 m/s, 5 % at 15, 9 %
  at 20; none in a breeze) and sits on the highest crests, in patches that travel with the
  sets. A wave breaks where the liquid is shallower than 1.28 wave heights: `pcPhysWaterSurf`.
- The chunk and its JS twin agree to 0.06 mm in a real GL context (Status). The explorer
  floats on `physics.fields.water.heightAt(p)`: the same surface.
- Liquids by place: lava in `lava_rivers` (barely any waves: 2.6 times water's density),
  cloud froth in `gold_islands` and `sky_islands` (billows high and slow).
- Cost: nothing on the CPU but the uniform update. On the GPU 16 `sin`/`cos` a call for the
  four trains (not measured on a real GPU); the wakes are a 16-step loop: leave them out of
  the fragment stage and of far water.

### E. What each weather still needs from you, by number (`physics.here.sky`, or `setMood.sky`)
The kits paint the near marks. Everything below is a wash, a veil or the light, and no kit
can paint it (an opaque pass cannot glaze). Each line names the number that drives it.
| Weather | What the kit paints | What is yours, and the number |
|---|---|---|
| Rain | broad slanted strokes (`cover.rain` about 0.66 in a storm), splashes on the hull | `overcast` (dim and cool the light, soften the shadows: the storm is sunlit today), `cloud` (the sky wash), `wet` (darker, wetter ground washes; lingers after), `haze` (far layers close in), `rain` (wet-in-wet softening of the far layers) |
| Snow | paper-white flakes near the lens (`cover.snow` 0.03 to 0.55) | **`snow`** (the ground left white: at 1 the meadow is still green today), `haze` (0.18 to 0.25 in a blizzard: the far hill should be gone), `snowfall` (the veil between: the missing share of `cover.snow`), `overcast` |
| Dust storm | ragged billows in the dune's own ink (`cover.dust` 1) | **`dust`** (0.84 to 0.9: tint the haze with the ground's colour), `haze` (0.10 to 0.16: beyond the billows the sky and the far dunes are clear today) |
| Fog, mist | nothing | `fog`, `haze` |
| Lightning | nothing | `flash` (bare paper for one to three frames), `storm` |
| The sea | nothing | D above: `uPhysWaterSea` and the chunk; `physics.water(bodyId, p).whitecapCover` for far water |
| Prints | prints, pads, scour rings in the ground's ink | nothing needed; a region id that is kept crisp would bring the rain rings back |

### F. Drifts: where the snow lies deep and where the wind has swept the ground bare (new in P6)
Wind does not leave loose snow or sand lying level: it piles in the lee of every rise, in
hollows and behind a landed hull, and is scoured from windward faces and crests. The physics
keeps this on the grid of the ground marks (64 x 64 cells of 0.5 m round the focus):
- `physics.fields.drift.factor` (Float32Array(4096), one channel; re-upload when `.version`
  changes: a few times a second in a gale, never in a calm): how much loose material lies at
  the cell in units of what lies on level ground here. 0 level, +1 twice as deep (up to
  +2.5), -1 blown bare.
- `.level`: that level depth now in metres (the snow depth of `physics.here.weather`, or on
  bare sand and dust a loose layer of up to 0.12 m); `.snow`: true when what drifts is snow.
  `.uniforms.uPhysDriftMap` (centre east, centre north, 1 / size, 64: the same layout as
  `uPhysDeformMap`) and `.uPhysDriftLevel`.
- What to paint with it: with `sky.snow` at s, a ground wash whose snow cover is
  `s * (1 + factor)` clamped: bare ground showing on windward faces and crests, white filling
  the hollows and tailing off behind rocks, which is how a snowy hillside is drawn. On sand:
  a paler, smoother wash where `factor > 0` (the tail), the darker bed where it is negative.
- It is where it was when the walker comes back (it is a function of the ground and the wind
  that last moved material), it melts with the snow and deepens with the next fall, and the
  explorer sinks deeper in it (his prints say so). On level ground it is zero; over standing
  liquid (a pool on a terrace, the sea, a cloud sea) it is -1: nothing lies on water.

## For PILOT: what audio can read (all in `physics.here`, refreshed every frame, free)

- Rain: `weather.precipitation.intensity01` (continuous), `.type`, `.rate` (mm/h), `.hail01`;
  what it falls on: `cover.canopy01` (leaves overhead) and `physics.water(...).present`.
- Wind: `air.speed`, `air.gust01` (0 lull .. 1 gust, travelling), `air.turbulence`; in the
  crowns: `physics.air(bodyId, p, out, canopyHeight).speed`.
- Thunder: `weather.lightning.thunderIn` counts down in seconds and goes negative at the bang
  (the delay is distance over that air's speed of sound); `thunder01` is its loudness from
  then on (decays over 6 s, quieter with distance); `last.distance` (m), `last.t`; `flash01`.
- The ground underfoot: `st.phys.material`, `speedGround`, `slip01`, `sink`, `impact`
  (landing speed), `submerged01`; the ship: `st.phys.downwash.thrust`, `gLoad`, `fieldBrake`,
  `legLoad`, `buffet`.
- The sea: `physics.fields.water.field.height` (significant wave height), `period`, `whitecap01`.
- No air, no sound: `air.density` is 0 on Mercury and the Moon, and `air.soundSpeed` is there
  for pitch (1210 m/s in Jupiter's hydrogen).

## Lab: `physics-lab.html` URL parameters

`scene=` `flora` (default) | `wind` | `rain` | `snow` | `storm` | `explorer` | `ship` | `globe`;
`body=` any body id; `world=` `flat` | `hills` | `slope` (`&slope=14` degrees) | `stub` (PILOT's) |
`real` (PAINTER's); `ground=` a biome id for the synthetic worlds; `find=` `gale` | `calm` |
`rain` | `snow` | `thunderstorm` | `dust` | any `weather().kind`; `t=` start time (s); `speed=`;
`seed=`; `quality=`; `fixed=1` (advance 1/30 s per rendered frame) with `fast=N` (N of those
per frame); `jet=0`, `walk=0` or `walk=<m/s>`, `explorer=0`, `flora=0|1`, `trees=<density>`,
`arrows=0`, `grass=<height m>`, `sea=<depth m>`, `wind=<m/s>` (steady wind on the bodies only);
`alt=<m>` raises the synthetic ground (Venus mesas); `find=devil`; `linear=1` (half-float
textures + hardware filter + `PC_PHYS_LINEAR`); **`planet=`** `mercury` | `moon` | `venus` |
`venus-mesa` | `mars` | `mars-storm` | `jupiter` | `jupiter-globe` | `saturn` | `saturn-globe` |
`uranus` | `neptune` | `neptune-globe` | `pluto` (a preset per world; any other parameter in
the URL wins over it); camera `yaw=`, `pitch=` (degrees), `dist=`. `window.__lab.info()` and
`window.__lab.shaderAgreement()` return state for `--eval`. With `sea=` the liquid surface is
drawn by the wave chunk (blue) with the JS twin as red dots.
Example: `node tools/shot.mjs "/physics-lab.html?scene=ship&fixed=1&fast=3" out.png --w 960 --h 540 --shots 7 --every 2600`.

## Decisions

1. **Real values, game scale, stated once each.** Gas properties, friction, fall speeds are
   real. Three things are scaled for a 4 km planet and each lives in one named place: the
   vertical scale of the atmosphere (`SCALE_HEIGHTS` 2.5 per atmosphere height), the giants'
   winds (`WINDS[body].scale`), and weather time (`WEATHER.timeScale` 60: a real hour of
   drying or snowfall takes a game minute, matching the 25-minute day).
2. **The giants' surfaces sit at real pressure levels**: Jupiter 6 bar / 290 K (under the
   water clouds, so its storms rain water), Saturn 10 bar, Uranus 2 bar / 90 K (methane snow),
   Neptune 3 bar / 95 K (methane is liquid: its seas and its rain).
3. **Forces, never velocity clamps.** Every limit is a force with a name (friction circle,
   leg power, thrust, drag, retro thrust). Assists are forces too (`descentLimit`,
   `jetMaxRise`, `assistAccel`, `carve01`) and are off unless PILOT commands them.
4. **Stiff things are integrated exactly or implicitly** (oscillators in closed form,
   quadratic drag as v / (1 + k v dt)), so 20 Hz and a 0.25 s hitch are as stable as 60 Hz.
5. **One wind.** A 17 x 17 grid (16 m) around the focus is rebuilt every frame; flora,
   particles, the explorer's wind load and the ship's buffeting all read it.
6. **Weather has no stored state.** Cells, lightning, wetness and snow are functions of time
   (wetness and snow as integrals over the past 47 minutes of that function), so any place can
   be asked about any time and a teleport needs no catching up.
7. **A walker does not spin their feet.** The legs push only as hard as the ground holds
   (traction control); `slip01` is for real slides, `scramble01` for wanting more grip.
8. **Sliding bodies dig in** (`arrest` 0.85 of holding traction), so a 55 degree slope is slid
   at a few m/s for the first seconds instead of in free acceleration.
9. **The suit floats in any liquid** (`floatAssist`), because a person sinks in Neptune's
   methane (450 kg/m3). The trim only engages near float depth, so wading keeps its traction.
10. **Ice friction depends on temperature** (0.06 at 272 K, 0.55 below 200 K): Earth's
    glaciers are treacherous, Uranus' 90 K ice grips like rock.
11. **The near field re-anchors without dropping anything**: every 384 m the frame moves to
    a point of the shared 16 m lattice and all grids are renumbered in place.
12. **sampleSurface is rationed**: 8 calls a frame at quality 1 (4 / 12 at 0 / 2), three times
    that while a cache is mostly empty, and never more than 0.35 ms per grid.
13. **Default seed 18**, chosen at PAINTER's real spawn: fair for the first minutes, then
    weather you can see coming and that comes (wiring step 8 for PILOT; a test pins it). The
    old 14 gave drizzle at twelve minutes at best.
14. **What falls is three continuous shares** (liquid, solid, frost), never a type switch, and
    a cold system snows 35 % of the water it would rain (cold air holds less vapour).
15. **A bank of fog or dust thickens so that the visual range closes in steadily** on the way
    in, and a system's edge is as wide as the distance it drifts in 30 s (turbulent mixing
    smears a travelling edge). Both are choices about the shape of a bank; the extinction law
    (Koschmieder) is untouched.
16. **Liquids belong to places**: lava in `lava_rivers` (2600 kg/m3, 100 Pa s: you float high
    and wade at under 1 m/s, the jetpack lifts you out), and the cloud seas of `gold_islands`
    and `sky_islands` are a froth of 120 kg/m3 that carries the trimmed suit and barely drags.
    A real cloud carries nobody; PAINTER declared them liquids, PILOT's ship treats the deck as
    a floor, and an explorer who fell through to a bed a hundred metres under their ship would
    be trapped in all but name. So: froth, by name, in one table (`BIOME_LIQUID`).
17. **The sea is already running when you arrive** (it follows the wind within 1.5 s for the
    first moments at a new place, then with a 25 s time constant), and when the waves lengthen
    or turn the pattern pivots about the watcher, not about the field's origin.
19. **What a snow squall front really does, and why I leave it at up to 8 % a second.** A
    squall is a narrow band of heavy snow on a sharp wind shift. What defines it for a
    forecaster (the US snow squall warning) is visibility dropping to a quarter of a mile or
    less, and what makes it dangerous is how fast: from kilometres to a few hundred metres
    in about a minute or two as the band crosses at 10-15 m/s. In `visibility01` (the square
    root of range) that is a fall of 0.5 or more in 60-120 s, about 0.5-1 % a second on
    average and several times that at the leading edge. Mine on Earth peaks at 4.7 %/s: the
    hard end of real, not beyond it. Uranus' 7.8 % is the same band carried at 14.5 m/s
    instead of 9; the giants' weather is quicker than Earth's because their winds are, and
    that is their character. If the lead's 5 % is to hold on every world, the knobs are
    `WEATHER.passTime` and `WEATHER.edgeTime` together (40 and 30 s): 64 and 48 make every
    fast system 1.6 times larger and its edge 1.6 times slower, which by the scaling of the
    edge puts Uranus at about 4.9 % (computed from the scaling, not yet run).
20. **A material's number is its place in `MATERIAL_IDS`**, and what a particle or a mark
    carries is the ground as the weather has made it (snow once 3 cm lie, mud when soaked,
    ice when glazed), named by the same rules as `groundAt` (`materialNow`, held to it by a
    test). Dust carried in by a storm is the world's dust, not the ground's.
21. **Whitecaps follow the steepness of the sea, not the wind directly**, so the law holds on
    other worlds: cover = 0.15 whitecap01^1.8, which over the game's fetches is within a
    factor 1.7 of Monahan and O'Muircheartaigh's 3.84e-6 U^3.41 from 10 to 20 m/s. The sea
    breaks where it stands highest: the foam is the surface above the level that leaves that
    share above it (a quantile of the four trains in sets, measured once while loading; the
    surface is not Gaussian, its tails are shorter). No foam is left behind a crest: a
    painter may smear it against `along`.
22. **The cover of the marks is what the physics says the kind hides, never more.** The
    weather gives each kind an extinction per metre; a kit may enlarge marks to survive the
    post pass until they would hide more than that, and thins them beyond. Where the marks
    hide less (snow: 3 to 55 %), the rest is veil, and the kit says how much.
23. **Snow is shown modulo a cell round the eye.** A snowfall is the same everywhere within
    48 m, so which periodic image of a simulated flake is drawn is a choice of sample, as is
    the simulation's own wrapping of its box round the focus. Every flake still falls, drifts
    and flutters on its own simulated path. Not done for rain: a drop's fate under leaves is
    decided where it really is.
18. **PAINTER's `phys: { ground }` is a family, my table keeps the finer word**: rock may stay
    glass or crystal. A test compares every override; two disagreements are on record (below).

24. **(P6) A mark never ends between two frames.** Every particle carries `left`, the seconds
    until it is gone (its life, or its landing foretold from the rate at which its height
    over the ground is closing, never slower than it is falling), and the kits shrink it
    over its kind's `fadeOut`. The estimate is eased over 0.15 s because the ground is rough.
25. **(P6) Snow is simulated where it is seen** (replaces 23's reasoning, keeps its display):
    in a box 16 m across round the eye (`frame.eye`; the focus when none is given), so every
    flake lands on the ground it is over. The kit still shows the box modulo itself round
    its own camera, which is the identity when the two eyes agree. The cell always divides
    the box. Powder kicked from lying snow is never wrapped (it is where the foot is).
26. **(P6) Flakes ride the air over the ground.** The air's vertical speed where a flake is
    equals the rate the ground changes along its path, at every height of the 18 m it falls
    through (the box wraps, so a slope across it is a slope without end, and over that the
    air runs parallel to the ground). The flake follows through its drag. Rain does not: it
    falls six times faster and its box is 48 m.
27. **(P6) Particles live on the curved ground.** The simulation's coordinates are (grid x,
    height over the sphere of the anchor's radius, grid z); published positions are at that
    radius on the line through the grid point, velocities turned to the local vertical to
    first order. A plane was wrong by d^2 / 2R.
28. **(P6) Dabs are drawn out to their travel a frame, and no further than three sizes.**
    Strobing (a mark that crosses more than its length a frame) reads as flicker; a hairline
    is not a flake. Between them is the slanted stroke of driving snow.
29. **(P6) Branches are a spectrum, not a field.** Four oscillators on the clock (1.3 Hz x
    1, 1.37, 0.71, 1.93), their phase turning round the trunk in whole lobes and from tree to
    tree; the swing follows the trunk's own lean (which carries the local wind, the shelter
    and the gusts) times how gusty the air is, plus the shake of the push field. No new
    texture and nothing integrated per tree: at branch scale what matters to the eye is that
    parts of a crown are out of step and faster than the trunk, and both are exact here.
30. **(P6) Drifts are an equilibrium, not a simulation.** The factor field relaxes toward a
    function of the ground, the hull and the last wind that moved material: deposition by
    Winstral's upwind shelter Sx, scour by the ground's rise into the wind. Not conserved
    (what is scoured is not what is deposited); in return it is the same when the walker
    comes back, costs a quarter of a millisecond, and cannot run away.
31. **(P6) The carve assist is a force and has a size.** It reports the sideways
    acceleration the field gives and can be bounded by the caller. The default stays
    unbounded: the feel of a turn is PILOT's.
32. **(P6) The weather enters over the surface it meets**: the ground, or the liquid standing
    over it at the focus.

## Needs from the others

### From PAINTER
0. In this order ("For PAINTER", E): the sky, the haze and the ground wash reading
   `setMood.sky` (`overcast`, `haze`, `wet`, `snow`, `dust`); the wave chunk in your liquid
   material (D); the kits with the reference factory and a palette by material (C); blades
   of grass that can be seen near the eye. A region id the post pass keeps crisp (rings).
1. Draw them: rain, snow, hail, the loose kinds, marks, the waves, lightning, `visibility01`,
   `cloud01`, `wetness01`, `snowDepth`. Until then two thirds of this role cannot be judged.
2. Two ground words where I keep mine and say why (test `ground.test.mjs`): `ochre_basins`
   you call rock, I keep **dust** (every airless world wears fine regolith, and ballistic
   dust is Mercury's one piece of weather; if you paint bare slabs there, paint them dusty);
   `nitrogen_dunes` you call ice, I keep **snow** (dunes are loose grains by definition and
   take prints). The other five I changed to yours (`rust_canyons` rock, `frozen_waves`,
   `pearl_fog`, `lilac_mountains`, `long_shadow_plain` ice).
3. The cloud seas: tell me if you would rather they did not carry the explorer (Decisions 16).
4. Under the cloud deck and under lava your terrain goes on; the explorer floats above it, so
   it should never be seen. Say if it can be.

### From PILOT
0. The three items the coordinator relays as open on your side have their recipes under "For
   PILOT: Open on your side": touchdown on the legs, rain audio, the pulse planner.
(Corrected in P4: I had reported `seed: 1` and the gear lift-off as open after you had done
both in `af6ea97`. Checked in the code and by playing it: the feet leave at 0.93 s after the
hull has risen 11 cm on its legs, 8.5 kN of wash while they are down, 5.2 m/s at most on
the way to the hover. Both are closed.)
1. `st.phys.buffetAngle` on the drawn attitude and the chase camera, if it is not there yet:
   in a 3 m/s breeze the hover holds within 1 cm and nothing shows that the air moves.

## Answers to the others

### To the lead's review 1 (PHYSICS section; no MUST FIX)
1. *Worst-case frame 6.8 ms.* Found and fixed in `59e8ad7`. It was the first frames (engine
   compile plus a 24-sample burst), then re-anchors (every field dropped and re-sampled) and
   grid scrolling (a per-cell copy loop, up to 1.2 ms). Now: `physics.warmUp()` for loading;
   re-anchoring carries every field over; scrolling is row-wise native moves; surface sampling
   is rationed by time as well as count. After `warmUp()` the worst reproducible frame in the
   first 5 s is 0.22 ms (Status says how that is measured, and which scheduler spikes it
   leaves out). `physics.stats.msMax` reports the worst frame of a session for you to police;
   `stats.msGround / msAir / msWeather / msFlora / msParticles` say where a slow frame went.
   If you still see a frame over 2 ms after calling `warmUp()`, send me its `stats`.
2. *Which of my numbers each of yours replaces.* The two tables above.
3. *No lab page, no evidence.* `physics-lab.html` and 12 shots in `docs/shots/physics/` (`a811a43`).
4. *Giants' winds in one named constant.* `physics.data.WINDS[body].scale` (with `.real`, the
   real speed, beside it) and `physics.setWindScale(bodyId, scale)` (`59e8ad7`).

### On `docs/lead/REFERENCES.md`: where a check is unphysical and I keep the real behaviour
- **R-FOOT-1** (90 % of walking speed in 0.15-0.4 s; stop in under 0.4 s and 0.8 m). At a
  real walking pace (1.4 m/s) the body does this. At the game's 4.2 m/s "walk" (a jog) it
  takes 0.58 s and 1.2 m, because boots on grass give at most 0.95 g. `assistAccel: 4` meets
  the check (0.38 s, 0.8 m) with a named thruster force. Kept real; assist offered.
- **R-FOOT-3** (20 degree uphill 15-35 % slower): mine is 37 %, from leg power; 30 degrees
  is 55 %. Slides above the hold angle start at 3-6 m/s and keep accelerating on a long
  slope (gravity does not stop at 6 m/s).
- **R-FOOT-4** "braking distance at least 1.5 x longer on loose sand": wrong for sand. Sand
  stops you in half the distance (1.9 m against 4.1 m from a run); what sand costs is top
  speed (25 % lower) and starting. Wet rock (1.4 x) and ice (many times) do lengthen braking.
- **R-FOOT-5** (15 m/s wind changes walking speed 5-15 %; assist). A fit body leans 7 degrees
  and walks on at full speed; only above about 25 m/s does leg power run out (2.9 m/s into a
  25 m/s wind) and at 45 m/s the wind wins. `st.phys.lean` and `windAccel` are there to show
  the effort. "Never wins" in a Neptune storm is yours to assist.
- **R-JET-1** (Moon at least 2.5 x Earth): impossible with a climb cap. With `jetMaxRise` 8.5
  both worlds climb at 8.5 m/s for the burn and differ only in the coast. Drop or raise the cap
  on light worlds.
- **R-SHIP-2** (a 90 degree turn straightens in 3 s at cruise). With thrusters and hull lift
  (18 m/s2) that is 2.6 s at 46 m/s but 9 s at 160 m/s and 40 s at 750; your steering asks for
  26 g at 160 m/s. Hence `carve01`: steering stays arcade, speed changes keep their mass.
- **R-PART-4** ("gone above about 40 m"). A jet keeps its momentum as it spreads: 11 kN from
  40 m is still 20 Pa on the ground, a stiff breeze in the grass. It is gone by about 100 m.
  If you want less, raise `antigravShare` (0.9 leaves 7 Pa at 40 m).
- **R-PLANET-1** ("about 50 times harder on Venus than on Mars"). Drag goes with density:
  3250 times Venus to Mars, 53 times Venus to Earth, 61 times Earth to Mars.
- **R-WATER-1** (0.75 x knee-deep, 0.5 x waist-deep). True of a real walking pace. At a 4.2
  m/s command water drag (which grows with v squared) gives 0.62 x and 0.36 x.
- **R-SNOW-1** ("each flake wanders sideways by about its fall speed"). Real flakes side-slip
  at 10-30 % of their fall speed; mine flutter at 0.28 m/s. In wind they do travel at 70+ degrees.
- **R-WX-1** (no field changes by more than 5 % of its range per second). Measured over 100
  minutes at three places: rain intensity 0.8 %/s, cloud 2.8 %/s, wind factor 1.5 %/s, but
  `visibility01` up to 6.2 %/s at the edge of a fog bank or dust storm. A bank that drifts
  at 6 m/s does arrive that fast; low-pass it in the sky if it reads as a pop.
- **R-WIND-2** (a gust band crosses grass at the wind speed, within 30 %). It crosses at the
  wind speed at 10 m, which is twice the wind at blade height: gusts are carried by the faster
  air above. Coherent over the 34 m and 90 m gust scales.
- Measured and met: R-RAIN-1 (rain 6.3 m/s, drizzle 1.5 m/s), R-RAIN-3 (wetness 0.87 after 60 s
  and 0.99 after 90 s of an arriving storm; dry again in 4 to 10 minutes), R-STORM-2 (wind
  picks up 70 s before the rain reaches half its peak, for a 740 m cell moving at 6 m/s),
  R-STORM-3, R-WX-2, R-WX-4, R-WIND-3 (0.7 cm tip motion at 1 m/s, 35 degrees at 8 m/s, crowns
  14 degrees at 20 m/s), R-WIND-6, R-PART-1 (57 degrees at 0.6 m after 0.1 s), R-PART-2 (back
  within 10 % in 0.9 s, damping ratio 0.55), R-PART-5, R-PART-6, R-PART-7 (the push field is
  carried over a re-anchor), R-SHIP-4 (14 m/s2 beyond the weight on every body), R-SHIP-5
  (gear), R-SHIP-9, R-JET-3, R-JET-5, R-PLANET-4, R-DEF-1.
- By construction, not separately measured: R-WIND-1 (one grid feeds everything), R-SHIP-8
  (`buffetAngle` up to 3 degrees pitch and 4.6 roll).
- Met in P2: R-DEF-2 (rims), R-DEF-3 (snow and sand filling prints), R-DEF-4 (pad prints and
  the scour dish), R-PLANET-2's ballistic dust, R-PLANET-3 (each world its own weather, table
  in Status), R-WATER wave parameters and ripples.
- Still not: R-RAIN-4 (puddles), R-RAIN-5 (shelter under canopy and hull), R-WIND-4 (a third,
  branch rate), a wake field on water.

### To PILOT ("From PHYSICS" in your notes)
1. `brake` in `stepShipBody`: done (API; wiring step 7). 2. Lift-off through the gear: the
exact calls and what happens are in wiring step 5, with a test. 3. The step functions move
`st.p` in place: said in the API block now. Earlier: table above, worst frame above, `bindEnv`
needs nothing your explorer env lacks; for the ship add `altGround`.

### To PILOT: review of your wiring at `0467427` (run through your own `Sim` in Node)
What I ran: `node --test tests/physics.test.mjs` (5 pass); a scripted flight through `Sim`
with and without physics; the weather at PAINTER's spawn for your seed.
1. **`warmUp` is not called.** Through `Sim` I measured `physicsMs` 0.74 average and a worst
   frame of 4.5 ms in the first seconds (engine compile and the first burst of surface
   samples). Call `physics.warmUp({ bodyId, time, focus })` once while loading (after
   `spawnOn`, and again after a load-from-save on another body); it takes 10-20 ms and the
   first played frame is then 0.2-0.3 ms.
2. **`seed: 1`** (main.js and your tests). Fine: at PAINTER's spawn seed 1 is a dry breeze for
   at least the first 15 minutes. The default (omit `seed`) is 14, which is the one my test
   pins: fair for 7 minutes, cloud at 12, the first shower at 12.5. Your choice; just keep one.
3. **Steering without `carve01`.** You pass `{ target, tau, hover, boost }`, so turning is
   thrusters and hull lift only. Measured: a 90 degree turn at 52 m/s leaves the velocity
   up to 70 degrees off the nose and takes 3.3 s to come within 10 (your kinematic ship: 53
   degrees, 2.7 s). Near the ground that slide reads as weight and I would keep it. At 160
   m/s it will take about 9 s and feel like ice. Suggestion: `carve01: smoothstep(40, 120,
   speed)`, so the low-speed ship keeps its mass and the fast ship stays on its nose.
4. **Lift-off and landing are still position curves** (`st.liftoff` bypasses the body; the
   landing ends in a snap). `stepShipGear` is unused. Step 5 of "For PILOT" above is the
   recipe; the lab's ship scene (`driveShip` in `physics-lab.html`) is a working example.
5. **`st.p = p0` after the body step** is fine (you integrate once). `shapeTarget(st, v, ...)`
   applied to the velocity AFTER the body step is the one remaining velocity clamp; it only
   bites when the target shaping was not enough, so it is a fair backstop.
6. **The field brake in vacuum** is a good, honestly named assist. Note `accelReverse` is now
   14 m/s2 (your comment says 10).
7. **Explorer**: the wiring is exactly right, including `jetUse` for fuel and the altitude-
   dependent `descentLimit`. You do not use `assistAccel`; your own test passes without it
   (walking pace in under 0.8 s), so leave it at 0 unless it feels heavy in the hand.

### To the lead's review 3 (no MUST FIX)
- *Tree red during the restart recovery.* Understood: I commit green, and the Status line
  says which count is green at which commit. The seven failures were the mid-edit state the
  coordinator's snapshot caught (new default seed and the fog measure, half applied).
- *Worst frame about 5 ms in the browser under load.* Measured where it can be repeated: the
  same deterministic run five times, each frame's best, then the worst frame: 0.29-0.51 ms on
  the real worlds, storms included (Status, Cost). The browser number is the machine.
- `brake`, the lift-off and the `st.p` line: in the API and in wiring steps 5 and 7.

### To PILOT: the game as it plays now (your `Sim`, PAINTER's world and obstacles, my physics, scripted keys)
Measured at `dc5a4d9`, default seed:
- On foot at the spawn (dry litter, mu 0.60): walk reaches 90 % of 4.2 m/s in 0.40 s and
  stops in 0.52 s over 0.80 m; run reaches 7.4 m/s in 0.85 s; running jump 0.95 m, 0.93 s.
  Right. In the storm at 12 minutes (wet litter, mu 0.36) the run still reaches 7.4 m/s and
  stops in 0.95 s over 3.1 m: that is the weather being felt, and about as far as it should go.
- Jetpack held 3 s: top 22 m, climb 8.4 m/s, then a fall at up to **16.2 m/s** before the
  brake catches it near the ground. 16 m/s is a five-storey fall; for a calm game I would cap
  the sink at 9-10 with `descentLimit` all the way down, not only near the ground.
- Lift-off: yours, kinematic: 4.8 m/s peak, to hover in 2.8 s, no leg, no wash. Step 5.
- Throttle: 0.6 m/s after the first second, 25 after the second, 46 after five. The first
  second is the spool (0.45 s) plus your throttle rate stacked: it reads as a dead stick.
  Either ramp the throttle faster or accept the spool as the only lag, not both.
- Letting go of W does nothing (46.1 to 46.3 m/s in 4 s): fine if the throttle is a lever, but
  then the screen has to show a lever.
- A 90 degree turn at 46 m/s takes 3.2 s and ends at 29 m/s. That is the thrusters killing
  the old velocity (`carve01` is 0.02 at that speed by your smoothstep 40-120): honest, but the
  turn eats 37 % of the speed and cruise sits right at the bottom of your carve range. Start
  the carve at 25, not 40.
- X from 29 m/s: 2.6 s, 40 m. Good. Hover in a 3 m/s breeze: 1 cm of drift in 5 s, 1 cm/s of
  vertical motion: too good; nothing tells you there is air (Needs 3).
- Landing from 70 m: 13 m/s down, flare from 10 m, touch at about 1 m/s, 9.7 cm of leg
  stroke, asleep 1.5 s later. Good, and it is the gear model doing the last metre.
- A wart of mine found here and fixed: after lift-off `st.phys.contacts` kept its parked
  value, so pad prints could be stamped under a flying ship. Cleared in flight now, and a
  foot more than 25 cm up never prints.
- `physics.update` in this loop: 0.25-0.32 ms mean on foot, 0.60 flying.

### The integrated game in the browser (P3, job 2)

Played in headless Chromium (software WebGL2, 480x270, `dynres=0&pointerlock=0&scale=0.5&
quality=0&stats=1&card=0&fresh=1&save=0`) with real key events, on Earth, Mars and Neptune:
walk, stop, run, running jump, a 3 s jetpack hop; then `__pc.teleport({ body, ship: true })`
and W for 8 s, X to a stop, C/E to land, Space to lift off. State was read from `window.__pc`,
never written (script and screenshots: `/home/user/.pc-scratch/physics/browserplay.mjs`,
`play/`). No console errors on any world. 3-8 frames a second, so game time advances in
steps of up to 0.25 s: the bodies behave the same as at 60 Hz (the Node numbers above), which
is the first thing this run shows.

| | Earth (forest, litter) | Mars (gravel, 0.018 kg/m3) | Neptune (moss, ice fall, 10-19 m/s wind) |
|---|---|---|---|
| walk; stop | 4.20 m/s; 0.72 s, 0.84 m | 4.20; 0.77 s, 1.11 m | 4.20; 0.68 s, 0.78 m |
| running jump | 0.97 m, 0.77 s | 2.33 m, 1.90 s | 0.58 m, 0.57 s |
| jetpack 3 s: top, climb, fastest sink | 27.9 m, 8.4, 13.4 m/s | 50.0 m, 11.9, 16.1 m/s | 24.5 m, 8.4, 12.6 m/s |
| hover 4 s: drift, vertical speed | 0.07 m, 0.02 m/s (5 m/s wind) | 0.00 m (5 m/s, thin air) | 1.83 m, 1.32 m/s (19 m/s) |
| throttle, speed each second | 10 35 45 46 | 12 34 45 46 | 10 31 43 45 46 |
| X from 46 m/s | 3.77 s, 93 m | 3.87 s, 94 m | 3.70 s, 89 m |
| landing: leg stroke; at rest | 10.8 cm; 9.3/8.2/8.2 | 4.9 cm; 4.9/4.3/4.3 | 10.9 cm; 10.9/9.7/9.6 |
| `physics.update` on the read-out | 0.76 ms avg | 0.73 | 0.80 |

What behaves wrong, or does not show:
1. **The three worlds fly the same until the wind blows.** Speed each second, cruise and
   braking are identical to a few percent. That is honest for a 4.2 t craft with 2.2 g of
   engine at 46 m/s (drag is 5 % of the thrust on Earth and nothing on Mars), and PILOT's
   speed envelope caps cruise at the same 46 m/s everywhere near the ground. The worlds differ
   where the physics has something to say: jump (0.58 m on Neptune, 2.33 on Mars), leg stroke
   on landing (4.9 against 10.9 cm), and the hover: rock steady on Mars, pushed 1.8 m and
   bobbing at 1.3 m/s in Neptune's 19 m/s wind. If the ship should feel each world at low
   speed too, the lever is the envelope (let cruise near the ground be what the engines and
   the air give at sea level: 251 m/s on Earth, 35 on Venus, 279 on Neptune, 1960 on Mars),
   not the body model. Venus already shows it (through your `Sim` in Node, not flown in the
   browser): its air holds the ship to 38 m/s and stops it from there in 2.6 s, against 46
   and 3.7 on Earth and Mars. It is the one world where the air decides below your cap.
2. **The jetpack hop on Mars** climbs at 11.9 m/s (8.4 elsewhere) to 50 m and comes down at
   16 m/s; on Earth 13.4 m/s. The catch near the ground works on all three (touchdown about
   7 m/s) but the fall before it is long and fast for a calm game.
3. **Coming down on C takes 14-16 s from 18 m** (about 1.2 m/s): the cushion turns the last
   stretch into a wait. E, where the prompt offers it, is quicker.
4. (Withdrawn. I read `altGround` staying at 0.0 for 2-3 s as a position curve; it is the
   gear lift-off of your `af6ea97` seen through the canopy-aware floor. Measured since: the
   hull rises 11 cm on its legs, the feet leave at 0.93 s, wash 8.5 kN while they are down.)
5. **`physics.update` reads 0.7-0.8 ms on average in the browser** against 0.25-0.35 in Node,
   with single frames of 6-29 ms: three renderers share the cores here and the game itself
   runs at 130-350 ms a frame. Not a number about physics; it wants a quiet machine.
6. **Nothing of the weather, the marks or the waves is in the picture** (as expected: the
   kits are not wired yet). The push field is live around the explorer (370-385 cells
   pushed, 11-16 marks after a short walk), but at this resolution I cannot see grass part.
   Neptune's spawn is so dark at that hour that nothing at all can be judged there.
7. On Mars the explorer spawned standing on top of a boulder. Harmless, odd.

### The lab inside the painted pipeline (P4, job 1): `physics-lab.html?painted=1`

Builds your (PAINTER's) world and painter from public exports only (`createPainter`,
`RENDERER_OPTIONS`, `makeWashMaterial`, `bindBodyUniforms`; `createWorld` and the world's
methods; the three chunks your contract names in `src/render/chunks.js`), runs the physics on
it and adds the kits with the factory above. No PAINTER file is touched or reached into.
Parameters: `body=`, `biome=` (via `world.findBiome`) or `lat=&lon=`, `hour=`, `t=` or
`find=rain|thunderstorm|snow|dust|fog|<kind>` (the time at that place when the weather is
there, else the nearest place), `pre=<s>` (simulate that long unseen before the page is
ready: software GL draws a frame or two a second), `walk=<m/s>&circle=<m>` (an explorer on my
body model, drawn as a plain painted capsule), `ship=hover|land` (`shipAlt`, `shipAway`,
`shipDrift`), camera `yaw pitch dist up follow=1`, `rain=thin|broad|cover|blend`, `water=1`
(my patch, reference only; `waterLift`, `waterN`, `waterStep`), `expand=gpu`, `kits=0`,
`quality`, `scale`, `hud=1`, `freeze=1`, `push=0` (the bodies disturb nothing: with the same
`pre` and `freeze=1` the frame differs from the pushed one only by the push field),
`snowSize snowMin snowMax snowCell dustSize dustMax` (the draw table). `window.__lab`:
`info()` (now with `kits.cover`, `kits.size`, `sky`, `hides`: the share of a 24 m sight line
that what is falling and the dust hide), `stability(dtMs, pairs, hideKits)`, `setRain(mode)`.
The debug lab has `window.__lab.waterAgreement()` (the wave chunk against its twin, in GL)
and `patch=1` (the CPU water patch).
Example: `node tools/shot.mjs "/physics-lab.html?painted=1&body=earth&find=thunderstorm&walk=2&pre=12" out.png --w 960 --h 540 --timeout 400000 --shot-timeout 240000`.

**Frames at 960x540 (768x432 internal), quality 1, each opened and judged against the art bible:**

| Frame | What is in it | Verdict |
|---|---|---|
| `painted-storm-forest.jpg` | Earth forest, thunderstorm 17.5 mm/h, 1370 drops, broad strokes | **Reads as rain**, as pale slanted strokes among the trees; thin on the open grass (pale on pale); sheltered under the crowns as it should be. The sun is out and the ground is dry in the picture: the sky and the wash know nothing of the storm. No splash rings (erased by the post pass). |
| `painted-rain-options.jpg` | the four ways to draw rain, same storm | thin: **invisible** (1270 drops, none survive the post pass). cover: invisible. broad: visible, reads. blend (own pass after the painting): faint hairlines, and it draws over the paper border. |
| `painted-snow.jpg` (re-shot in P5) | Earth alpine meadow at 13 h, blizzard 2.2 mm/h in a 9.5 m/s wind, 1690 flakes shown modulo a 9 m cell, 10 cm, drawn out along the wind | **The kit part reads now**: about 75 bare-paper flakes of different sizes all over the picture, larger near the lens, slanted with the wind; visible against meadow, hill and trees, lost against the sky (white on pale, as it must be). It reads as a snow flurry on a sunny green meadow. **As a blizzard the frame still fails, and nothing more can come from a kit**: no snow lies (`sky.snow` is 1), the far hill is sharp (`sky.haze` 0.25), the sun is out (`sky.overcast` 0.51). The flakes are a little alike (ovals of one tilt). |
| `painted-mars-dust.jpg` (re-shot in P5) | Mars dunes, dust storm, visibility 0.16, 269 puffs sized 2.0 m from the dust in the air, ragged at two scales, drawn out along the wind, in the dune's own ochre by material | **The kit part reads as blowing dust**: a broken dry-brush band streaming across the middle distance, tufts thinning upward. Not blots any more. **As a storm it still fails**: the sky and the far dunes behind it are clear (`sky.dust` 0.84, `sky.haze` 0.16 are yours); lone tufts against the clear sky look like leaves. The sand grains show as small dark flecks (too dark: ochre times a shade). |
| `painted-marks.jpg` | Earth desert, a walked circle, the ship landed and left | **Footprints read**: small dark dabs, right size, stable. Pad prints are small dark ovals, acceptable. Scour dishes had to be reduced to a faint ring: dozens overlap and an opaque kit piles them into a dark patch. Kicked dust shows as ochre patches: tolerable here, a brown blot on forest litter. |
| `painted-neptune-sea.jpg` | Neptune's sea, Hs 0.75 m, my patch lifted 0.8 m over your liquid, a hull hovering | **Fails as a sea.** A flat wash; the waves show only as the wavy far edge of the patch; spray under the hull reads. My patch fights your flat liquid surface (where it dips below yours you see yours), and my three-tone shading did not survive. This needs the wave chunk in your water material, not a second surface. |
| `painted-meadow-wash-ab.jpg` (P5) | alpine meadow, the ship hovering 5 m up just out of frame; top: its downwash on (2957 push cells live), bottom: the same frame to the pixel with `push=0` | **The push field reaches your plants**: the poppies under the wash are flattened outward by 10 to 20 px (0.66 % of the pixels differ, all of them plants). **Grass parting cannot be judged**: the meadow is a wash with no blades to be seen at 4 or at 11 m, so there is nothing to part. Round the walking explorer in the wetland (three ferns in view, none within a metre of the path) the two frames are identical to the pixel. |

**Rain after P5** (checked, frame not kept): the same wood in a thunderstorm of 8.6 mm/h, 981
drops, the kits as they are now: about 15 pale slanted strokes in view, as thin as the 25 of
the kept frame at twice the rate; `cover.rain` 0.755. That thinness is the physics: rain of
that rate hides 1.6 % of a 24 m sight line. Rain reads in a painting through the dark sky, the
wet ground and the softened distance (`overcast`, `wet`, `rain`, `haze`), not through more strokes.

**Rain, measured for crawl** (pairs of frames 8 ms apart, five pairs, same storm, 1270-1390
drops; mean absolute difference of the picture, and the share of pixels changing by more
than 8 %): no kits 0.00035, 0.03 %; thin 0.00050, 0.06 %; cover 0.00038, 0.05 %; blend
0.00024, 0.05 %; **broad 0.00175, 0.40 %**. Thin and cover add change without adding
anything you can see: that is shimmer with no rain in it, the worst of both. Broad changes
most because it is the only one that is there; its strokes move 5 cm in 8 ms along their
own length (90 cm), which is travel, not crawl. Blend is the calmest and the least like the
painting. My reading: broad strokes in your opaque pass, more of them over open ground, with
the wet darkening done by your wash from `wetness01` rather than by the strokes.

**Cost in the real pipeline** (kit CPU per frame, draw calls, triangles; limit 12 calls and
60 k triangles for all kits): thunderstorm 0.10-0.21 ms, 4-5 calls, 3.2 k; blizzard 0.14 ms,
4 calls, 3.0 k; Mars dust storm 0.12 ms, 3 calls, 1.5 k; marks and dust in the desert 0.07-0.4
ms, 2-3 calls, 0.5-1.0 k; the sea with a 65 x 65 patch and wakes 1.1-1.5 ms, 4 calls, 8.7 k
(too dear on the CPU at that size: the default 41 x 41 is 0.05 ms without wakes; another
reason to use the chunk instead). `physics.update` read 0.5-1.4 ms in this page under
software GL (0.3-0.5 in Node).

**Missing in the contract or the exports** (I worked round none of these by reaching in):
1. (Closed by your `ebd9b4d`: `makePaintUniforms`. The lab uses it.)
2. (Closed by your `ebd9b4d`: the chunks are exported from `src/render/index.js`. The lab uses them.)
3. **An opaque pass cannot glaze.** Rain as a darker veil, dust as haze, a print as "the
   ground, darker", a wet patch: all want to tint what is already there. A kit can only lay
   its own ink over it, and the ink is wrong wherever the ground is not what the ink assumed.
   What would fix it: the local ground wash available to a kit's fragment (a function in
   `FRAG_PARS`, or a uniform colour per biome), or one multiplying pass after the scene pass.
   (Half answered from my side in P5: every particle and mark now carries its ground
   material, so a palette of 16 colours a biome gives each its ground's ink. Veils and wet
   patches still need you.)
4. The post pass erases marks under about 3 px, with no way to ask it not to: no splash
   rings, no fine rain, no snowflakes. Say what the least mark is, or give a region id that
   is kept crisp.
5. No way to move your liquid surface: `makeWaterMaterial` is not public and the world takes
   no wave chunk. A second surface over yours cannot work (frame above). The chunk is ready
   for it ("For PAINTER", D).
6. Nothing in the sky or the haze reads the weather: storms under the sun. PILOT now hands
   you `setMood.sky` every frame; "For PAINTER", E names the number for each wash.
7. (New) No blades of grass are visible in a meadow at any distance, so plants parting round
   the explorer, the first thing the owner asked this role for, has nothing to show on.

**Shader agreement inside `PROP_VERT`: not measured.** From outside your files I cannot read
a displaced vertex back: the scene targets are internal and the prop material is not public.
What I can do without reaching in is a silhouette test (drive my own field arrays to a known
steady load, render, and compare where a lone crown lands on screen with the JS prediction,
using `world.sampleObstacles` for the tree's root and height): accurate to about a pixel,
2-3 cm at 20 m. Not done in P4. A one-line hook from you would make it exact: a debug
material flag that writes the displaced body-local position to the colour target.

## Ideas and critique

Blunt, as asked. All of it is about motion and behaviour; none of it is about look or structure.
(The P1 list about the kinematic explorer and ship is answered: both run on bodies now.)

- (to PILOT, ship) The first second of throttle does nothing (your throttle rate on top of my
  engine spool); a 90 degree turn at cruise costs 37 % of the speed because cruise sits at the
  foot of your carve ramp; the hover is so exact that the air might as well be absent.
  Numbers in "the game as it plays now". (The seed and the lift-off, which stood here, are
  done on your side.)
- (to PILOT, explorer) Falling 22 m from a jetpack hop at 16 m/s and being caught at the last
  moment is a stunt, not a stroll. Cap the sink all the way down.
- (to PILOT) `physics.here.weather.lightning.thunderIn` and `.last.distance` are there for the
  thunder; a storm without sound is half a storm, and the delay is the cheapest sense of scale
  in the game (340 m/s on Earth, 1210 on Jupiter, never on the Moon).
- (to PAINTER) Nothing of the weather is painted. The sky does not darken with `cloud01`, the
  far washes do not close in with `visibility01`, the ground does not darken with `wetness01`,
  no drop falls. The thunderstorm that crosses the spawn at eleven minutes, 22 mm/h with hail
  and four flashes a minute, is at the moment a number in a read-out. This is now the largest
  gap between what the game computes and what it shows.
- (to PAINTER) Under the home forest the wind at 2 m is 1-3 m/s even in that storm, because a
  closed canopy really does that. So on the ground the storm is rain and noise, and the drama
  is in the crowns (the stiff response reads the wind at canopy height) and in the glades. If
  the crowns do not visibly heave, the storm will look tame however hard it rains.
- (to PAINTER) Clouds still drift on fixed axes with `uTime`. `physics.air(bodyId, p, out,
  cloudHeight)` gives the wind up there (faster aloft; twelve times faster on Venus), and
  `physics.util.cellsAt` gives where the systems are: paint the dark ones where it rains.
- (to PAINTER) Grass leans 47 degrees in a 5 m/s breeze and 65 in 8 m/s. A single blade is that
  limp, but if a whole meadow reads as flattened at the spawn, the knob is `FLORA.softFlex`
  (3); tell me what you see at 960x540 before I touch it.
- (to both) Cloud seas and lava are liquids only because the look table says so. I gave them
  densities and a viscosity; someone should walk into each on purpose before M3 is called done.
- (to PAINTER, new) The contract asks for one opaque pass with holes by `discard`. That suits
  marks and dabs; it will make rain hard: a streak 1.2 px wide with no blending is an
  aliased hairline that crawls. Either rain gets a blended pass of its own after the scene
  pass, or it wants supersampling; decide before tuning anything else about it.
- (to PILOT) Every world cruises at the same 46 m/s near the ground because your envelope
  says so; only Venus, where the air stops the ship at 38, is itself. The worlds would
  differ more if the cap were the engines' and the air's (table in "The integrated game in
  the browser").
- (P5, to PAINTER) The game computes a thunderstorm, a blizzard and a dust storm and paints a
  fine day in all three. With `setMood.sky` arriving every frame this is now one afternoon of
  work on your side for the largest gain left in the game: dim the light with `overcast`,
  pull the far washes in with `haze`, leave the ground white with `snow`, darken it with
  `wet`, tint the haze with `dust`. My flakes and billows are accents on a veil that is not there.
- (P5, to PAINTER) A meadow without blades. Wind in grass and grass parting round the body
  were the first things the owner asked of this role; the field is live, measured, wired,
  and there is nothing on the sheet for it to move but poppies.
- (P5, to PILOT) Rain on a wood, rain on water, drips after rain, thunder late by the right
  number of seconds: every number is in `physics.here` and none of it sounds yet.
- (P5, self) Two of the four "then" items of this stage are not done (silhouette agreement
  in `PROP_VERT`, branch rate) and drifts not started; the integrated game was not played in
  the browser this run. The flakes are ovals of one tilt; a painter would vary them more.
  The dust reads as blowing dust only against a darker ground; lone tufts against the sky
  read as leaves. Spray says `bed`, which only tells PAINTER "liquid here".
- (P5, self) Thinning by a number per particle is right for marks that move little; a flake
  blown across the cell's wall still shrinks and regrows 18 m away. In a gale that is many
  flakes a second, each over about a quarter of a second. I have not measured it as crawl.
- (P6, self) Three stages of rain were photographed standing where the session began. Walk
  400 m and the rain ended 18 m over your head; swim out and it stopped raining. Both bugs
  were found by a script that looked at where the particles were, not by a picture, and both
  had passing tests round them. Tests that only look near the anchor prove little: every
  field of mine should be tested 300 m from it and over deep water.
- (P6, self) The snow has now been simulated three ways in three stages (a 48 m box, the same
  shown modulo a cell, a small box round the eye). The third is the first that is honest
  about what a flake lands on. I should have asked "where is it seen from" in P1.
- (P6, self) Branches and drifts are numbers and a chunk. Until PAINTER calls one line and
  reads one texture they do not exist for the owner, like the grass parting before them.
  This role's output is now well ahead of what the picture shows: weather, waves, marks,
  the push field, branches and drifts are all computed and none of them is painted.
- (P6, to PILOT) The game flies the same on every world but Venus: one turn rate, one feel,
  five cruise speeds within 10 m/s and three more at 74 to 84. Venus is the only world
  whose air you can feel, and it is the best flight in the game for it. The assists
  (carve unbounded, ground-speed hold, grip from thrusters on foot) iron every other world
  flat. Each has a number now; turn one down and a world appears.
- (P6, to PILOT) On foot the Moon is Earth with a long jump. Nothing slides, nothing bounds,
  and a jetpack hop goes to 113 m.
- (P6, to PAINTER) Mars's spawn puts the walker in a boulder field: two runs out of two
  stalled against the stones within three seconds.
- (self) I wrote the first kits before PAINTER's contract existed and had to turn them round
  in the same stage. Ask for the contract first next time.
- (self) The lab draws dots and lines. I can prove a drop falls at the right speed and cannot
  tell whether rain reads as rain. Every particle system here is unjudged as a picture.
- (self) The three-wave sea is honest about height, period and direction and has no groups, no
  breaking, no wake field. From a ship at 100 m it will tile. It needs a fourth, long train
  and a per-train phase noise before anyone flies low over Neptune.
- (self) Snow squalls still close the view at up to 8 % a second; I softened banks and left
  squalls, because that is what a squall is.
- (idea) Rain shelter: `canopy01` at the focus could thin the drops under a closed wood and
  under the hull for almost nothing; drips after the rain (the canopy empties over a minute)
  would sell the wet forest better than the rain itself.
- (idea) `st.phys.lean` for the explorer model, `legCompress` for the ship's legs, `fieldBrake`
  for a glow: animation data that cost nothing.

## Next stage
P7, in my order: (1) when PAINTER's weather is in the picture (it is on it now), re-shoot the
storm, the blizzard, the dust storm and Neptune's sea in the game itself and tune
`DRAW_PAINTED` against the frames; ask to see branches and drifts drawn; (2) the silhouette
test in `PROP_VERT`; (3) flakes that tumble and differ in shape, dust tufts that do not read
as leaves; (4) flakes in still air measured for crawl; (5) with PILOT, whichever of the five
levers of "The integrated game, played in P6" it takes: fly them again with `p6/nodeplay.mjs`
and report the same tables; (6) the ship on liquid (a wake, a bob, the gear never engages on
Jupiter's cloud sea); (7) wind carried by the ship (`windShare`), if PILOT wants the giants
windy. See the Hand-over at the top for where each begins.
