# PHYSICS notes

Branch: `cosmos` (shared with PAINTER and PILOT, one working tree). Commits: `tools/commit.sh physics`.
Owner of: `src/physics/**`, `physics-lab.html`, `docs/notes/physics.md`, `docs/shots/physics/**`.

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
                     dropSize (m), frozen01, hail01, reachesGround01 (Venus virga) },
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
    friction (static), kinetic, foothold (extra holding traction on slopes), restitution,
    sink (m), drag (walking resistance as a fraction of normal force), repose (rad), dust (0..1),
    z0 (m), imprint (0..1), density, grain, liquidDepth (m), wetness01, snowDepth, temperature,
    canopy01, canopyHeight, moist, fog, dustSource }

physics.water(bodyId, p, out?) ->                         // the liquid surface and its wind waves
  { present, height (elevation at p now, m), significant (Hs, m), period (s), length (m), speed (m/s),
    steepness, whitecap01, dir:{x,y,z} (body-local, the way the waves run) }

physics.features.devils // dust devils near the focus: array with .count; each { p (body-local foot), x, z (grid),
                        //   radius (m), height (m), speed (swirl, m/s), up (m/s), spin (+1/-1), strength 0..1, age, life, id }
physics.here            // { bodyId, air, weather, cover, groundHeight } at the focus, refreshed by update(): free to read
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
              //   uPhysWake Float32Array(64) (16 x: x, z, age s, amplitude m), uPhysWakeG }, refreshed every update
  .heightAt(p) -> m               // CPU twin of pcPhysWaterHeight (waves, sets and wakes): a floating thing rides the painted sea
  .field      // WaterField: height (Hs), period, length, speed, steepness, whitecap01, dir, level, present,
              //   addWake(x, z, amplitude), wakeAt(x, z)
physics.glsl.water              // pcPhysWater(p) -> vec3(height, dh/deast, dh/dnorth); pcPhysWaterHeight(p); pcPhysWake(grid).
                                //   `#define PC_PHYS_NO_WAKE` leaves the wakes out (far water).
                                //   Shares the frame uniforms with the flora chunk (guarded: include both freely)

// draw kits (the only folder that imports three; optional; see "For PAINTER", C)
import { createPhysicsKits, createWeatherKit, createMarksKit, createWaterKit, DRAW, PARTICLE_GLSL, SHAPE_GLSL } from './src/physics/three/index.js';
const kits = createPhysicsKits(physics, { makeMaterial(kind, info), weather?: { draw?, expand?: 'cpu' | 'gpu', kinds?, rings? } | false, marks?, water? });
kits.update(bodyRoot, camera, viewportHeightPx);   kits.objects;   kits.stats { ms, drawCalls, vertices, triangles };   kits.dispose()

physics.fields.deform
  .depth  Float32Array(64*64)     // m pressed into the ground, 0.5 m cells (trail trough); .uniforms.uPhysDeformMap
  .marks  { data: Float32Array(256*14), capacity, head, total, origin, stride: 14 (MARK_STRIDE) }
          // per mark: x,y,z (rel. origin), dirx,diry,dirz, length, width, depth, kind, born, life, rim (m, raised edge), spare
          // kind (MARK): 0 left foot, 1 right foot, 2 gear pad, 3 hull, 4 scour (the dish a jet or the thrusters blow)
  .depthAt(x, z)                  // m, at a grid position

physics.particles.rain / .snow / .hail / .dust / .sand / .ash / .spores / .leaves / .spray
  // { count, capacity, pos Float32Array(3n) (relative to .origin, body-local axes), vel (3n), size (n), age (n), origin, species }
  // rain, snow: the weather. hail: storm cores (bounces). dust: kicked up, storms, devils, ambient haze. sand: saltation,
  // kicks, scour. leaves / spores / ash: the biome's own, on the wind. spray: wading, thruster wash over liquid.
  // In vacuum the same kinds fly as clean parabolas (no drag, no drift).
physics.particles.events        // ring: { data Float32Array(256*8), head, total, origin }: x,y,z, kind (0 splash, 1 ripple, 2 settle, 3 bounce), strength, time, size, 0
```

Reference data and helpers: `physics.data.{ATMOSPHERES, LIQUIDS, WINDS, REGIMES, MATERIALS, BIOMES, SPECIES}`,
`physics.util.{airDensity, airTemperature, gravityAt, fallSpeed, terminalVelocity, cellsAt, saltationThreshold,
holdAngle, iceFriction, treeFrequency, stemFrequency, PlantSim, liquidOf, liquidAt(bodyId, surface), BIOME_LIQUID}`;
tuning tables exported from `index.js`: `WEATHER, WIND, AIR, GROUND, FLORA, PARTICLES, LOOSE, KICK, DEVILS, DEFORM,
MARK, MARK_STRIDE, EVENT, WATER, QUALITY, DEFAULT_SEED`, and `windSea(U, fetch, g, rhoAir, rhoLiquid, depth)`.

## Status

INTEGRATION: ready and wired (PILOT `a9c02bc`, PAINTER `1e1801e`). The API is stable; P2 and P3 only added to it,
with one change of type: the water uniforms are vec4 now (four trains; nobody had wired them).
The tree is committed green: `node --test src/physics/` **175 pass** at the commit that carries this note.

Stage P1 to P3: done, accepted. **Stage P4** so far: the lab runs inside the real painted
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
  mesh is the GLSL surface, the red dots the JS twin), `draw-kits.jpg`, `meadow-gale-walk.jpg`,
  and the six `painted-*.jpg` of P4 (the older debug shots of rain, snow, the jetpack, the
  terrain wind and the ship were retired to stay at twelve files).

### Not done or not verified
- Nobody draws my particles, marks, waves or weather yet (PAINTER's M3): I have only seen them
  in my own lab, as dots and lines. How they read as paint is unknown.
- The flora chunk inside `PROP_VERT`: agreement not measured there; parting around the
  explorer and thruster wash not seen in the game by anyone.
- Rain does not know about roofs: it falls through a closed canopy and through the ship
  (`R-RAIN-5`). A tree has two response rates, not three (`R-WIND-4`: no separate branch rate).
- Wakes behind a swimmer or a low-flying ship are events (rings, spray), not a displacement of
  the wave field.
- Real-GPU cost of the textures is unmeasured (software GL only).
- The cloud seas: I made them a light froth that carries a trimmed suit (see Decisions 16);
  nobody has walked into one in the game.

## For PILOT: wiring, in order

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

## For PAINTER: everything you need, on its own (current at the commit that carries this note)

Written to be read cold. `physics` is the object PILOT made with `createPhysics` and hands you
through `world.setPhysics(physics)`; `physics.update` has already run when `world.update` is
called (in the gallery you call `physics.update(dt, { bodyId, time, focus, sunDir })` yourself).
Everything of mine is in **body-local** coordinates (C3). Nothing below is required: each part
stands alone, in the order I would wire them.

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

### B. Weather for the sky and the sheet: `physics.here.weather`, every frame, free
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

### C. Rain, snow, dust, marks, water: the draw kits (`src/physics/three/`)
They follow your material contract (your notes, "For PHYSICS: what a draw kit's material must
do"): one opaque pass, no blending, holes by `discard`. Each kit hands your factory a
**vertex chunk that defines `vec3 pcKitPosition()`** plus two varyings.

```js
import { createPhysicsKits, SHAPE_GLSL } from '../physics/three/index.js';   // the only folder of mine that imports three
const kits = createPhysicsKits(physics, { makeMaterial });                   // once
// every frame, after physics.update and after PILOT has placed the body roots:
kits.update(bodyRootOf(physics.here.bodyId), camera, renderHeightInPixels);
```
`makeMaterial(kind, info)` is yours. This one is **proven in your real pipeline** (your chunks,
both render targets, your post pass; `physics-lab.html?painted=1`, source in
`src/physics/three/painted-lab.js`, function `makeKitMaterial`; frames `painted-*.jpg`). Lift
it as it stands:
```js
import { makeWashMaterial, bindBodyUniforms } from '../render/index.js';
import { VERT_PARS, VERT_END, FRAG_PARS } from '../render/chunks.js';
import { SHAPE_GLSL } from '../physics/three/index.js';
function makeKitMaterial(kind, info) {
  const base = makeWashMaterial({ color: INK[kind], unlit: true });      // the uniform set FRAG_PARS needs
  const m = new THREE.ShaderMaterial({
    uniforms: { ...base.uniforms, ...info.uniforms },
    vertexShader: `${VERT_PARS}\n${info.vertexChunk}\nvarying vec3 vView;
      void main() { vec4 mv = modelViewMatrix * vec4(pcKitPosition(), 1.0); vView = mv.xyz;
        gl_Position = projectionMatrix * mv; ${VERT_END} }`,
    fragmentShader: `${FRAG_PARS}\n${SHAPE_GLSL}\nuniform vec3 uColor;
      varying vec2 vPcUv; varying vec4 vPcData; varying vec3 vView;
      void main() {
        #include <logdepthbuf_fragment>
        ${FRAG[kind] || FRAG[info.shape]}      // cuts the hole (discard), sets vec3 c and float w
        c = pcAtmos(pcTone(c, 2.0), pcFogAmount(length(vView)));
        pcWrite(c, w, vec3(0.0, 0.0, 1.0), -vView.z, ${info.region.toFixed(1)});
      }`,
    side: THREE.DoubleSide, polygonOffset: info.shape === 'mark' || info.shape === 'ring',
    polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  m.userData.pcPainted = true;
  return m;                 // then, once: bindBodyUniforms(m, world.bodyUniforms(bodyId))
}
```
`FRAG` is one line of GLSL a shape (the lab's are in `painted-lab.js`: a tapering stroke, a
round dab, a ragged puff cut from `uNoise3D`, a ring, a print thinned through `uNoise3D`).
**Three things the painted frames taught, which change the defaults for your pipeline:**
1. Your post pass erases anything under about three internal pixels. Thin rain (1.2 px), rings
   and 1.6 px flakes are simply gone. Give every kind `minPx` 3 or more
   (`weather: { draw: { rain: { width: 0.07, exposure: 0.14, minPx: 3 }, snow: { size: 0.06,
   minPx: 3.5 }, ... } }`; the lab's set is `DRAW_PAINTED`).
2. Rain that reads is **a few broad strokes** (one drop in six, 7 cm wide, 140 ms exposure,
   wetness 0.95), not many thin ones. Section "The lab inside the painted pipeline" has the
   four options side by side with numbers.
3. An opaque kit has to bring its own ink, and a fixed ink is wrong on ground it does not
   know: kicked dust is a brown blot on the forest floor. See "missing" in that section.
- `pcKitPosition()` returns the vertex in the mesh's own coordinates: body-local axes, metres,
  relative to the mesh, which the kit parents under the body root you pass and places at a
  body-local point (C3). Multiply by `modelViewMatrix` as for any mesh.
- `vPcUv`: 0..1 across the quad. `vPcData`: per kind, below (also in `info.data`).
- `info.region`: my suggestion for your region id (2.x rain, hail, spray, snow, rings; 1.x
  marks, dust, sand, ash; 4.x leaves, spores). Yours to change.
- Nothing needs blending: particles are born small, grow in, and shrink to nothing at the
  edge of the simulated volume (24 m); shapes inside a quad are cut with `discard`.
- Budget (PILOT's conditions): at most 12 draw calls for all kits (one per kind that has
  anything in the air, rings, marks, water) and, with every buffer full at the highest
  quality, 31 k triangles; typical: a downpour 3 calls and 7 k vertices, fair weather 0-2
  calls. The kits set no `renderOrder`: draw order is yours. Meshes are not frustum-culled.
  CPU per frame: 0.10 ms for a downpour (1100 drops plus rings), 0.05 ms instanced, marks
  0.07 ms only when one is added (else nothing), water 0.05 ms. `kits.stats`,
  `kits.weather.stats` etc. give `ms`, `drawCalls`, `vertices`, `triangles`.
- A material that ignores the chunk and uses `position` (your `makeWashMaterial({ color,
  unlit: true, side: DoubleSide })`) also works with the default (cpu) kits: that is the
  fastest way to see rain in the picture at all.

The kinds, and what `vPcUv` / `vPcData` mean:
1. **Streaks: `rain`, `hail`, `sand`, `spray`**. A quad per particle; `vPcUv.x` across,
   `vPcUv.y` 0 at the head (where the drop is) to 1 at the tail (where it was one exposure
   ago *relative to the camera*: run and the rain slants at you). `vPcData.x` a shade
   1 - vary .. 1 that stays with the particle. A stroke: `if (abs(vPcUv.x - 0.5) * 2.0 >
   1.0 - 0.75 * vPcUv.y) discard;`. Defaults (`DRAW` in `three/expand.js`): rain 12 mm wide,
   40 ms exposure, never under 1.2 px. Yours to change: `createPhysicsKits(physics, {
   makeMaterial, weather: { draw: { rain: { width: 0.02, exposure: 0.06 } } } })`.
2. **Dabs: `snow`, `dust`, `ash`, `spores`, `leaves`**. Quads facing the picture plane; a
   round dab is `if (length(vPcUv - 0.5) > 0.5) discard;`. Dust grows with age (a puff
   spreads), leaves and ash turn. Sizes are brush marks, not grains (snow 3.5 cm, leaves
   7.5 cm, dust 16 cm growing 30 cm/s, never under 1.6 px).
3. **Instanced variant** (`weather: { expand: 'gpu' }`): one quad, instanced; the instance
   attributes are my arrays themselves (no copy, nothing built on the CPU). Same
   `pcKitPosition()`, same varyings, plus `vPcData` = (shade, age s, grain size m, speed m/s);
   needs `info.uniforms` in the material (the kit keeps them current). Take this one for the
   final rain; take the cpu one today.
4. **`ring`**: the splash of a drop, the ripple it leaves on liquid, the puff where a flake
   settles, a hailstone's bounce: flat on the ground, growing with age. `vPcData` = (kind 0
   splash / 1 ripple / 2 settle / 3 bounce, strength 0..1, age 0..1, drop size m).
   `SHAPE_GLSL`: `pcPhysRingCover(vPcUv, vPcData.z)` is a circle that widens and thins;
   `discard` under about 0.2. Rain also lands on the ship's hull (splashes up there, none
   under it) and is thinned under closed canopy; after rain the wood drips big slow drops.
5. **`mark`** (`kits.marks`): footprints, the ship's three gear pads, scour dishes: a quad
   laid on the ground (follows the slope near the focus), 15 mm above it: give the material
   `polygonOffset`. `vPcUv.x` across, `.y` along the direction of travel; `vPcData` = (depth
   m, rim height m, kind 0/1 feet, 2 pad, 4 scour dish, fade 1..0 over its life).
   `SHAPE_GLSL`: `pcPhysMarkCover(vPcUv, vPcData.z)` (a boot's outline or a disc) and
   `pcPhysMarkRim(...)` (the raised edge on sand, snow and dust: paint it lighter). Fade
   without blending: `discard` against a hash of `gl_FragCoord` (the lab's stand-in does).
   Snow and blowing sand fill prints; `fade` already says so.
6. **`water`** (`kits.water`): a 60 m patch (41 x 41 vertices) that follows the focus and
   rides my waves, with `normal`. You already draw liquid everywhere, so prefer D below and
   pass `water: false`; the patch is the reference of what the chunk computes.

What the kits do not draw: lightning (B), dust devils as columns (`physics.features.devils`:
foot `p`, `radius`, `height`, `strength`; their dust and sand are in the particle kits), the sky.

### D. Water: waves and wakes in your own liquid material
- Paste `physics.glsl.water` into the vertex stage of `makeWaterMaterial` and lift each
  vertex along the local up by `pcPhysWater(bodyLocalPosition).x`; `.yz` is the slope along
  the frame's east and north, for the normal. Far water: `#define PC_PHYS_NO_WAKE` first.
- Uniforms, from `physics.fields.water.uniforms` every frame (**changed in P3**: four trains,
  groups, wakes): `uPhysWaterDir` vec2, `uPhysWaterK` vec4, `uPhysWaterAmp` vec4,
  `uPhysWaterPhase` vec4, `uPhysWaterGroup` vec4, `uPhysWake` vec4[16] (a Float32Array(64):
  give it to three as it is), `uPhysWakeG` float; plus the frame uniforms it shares with the
  flora chunk (`uPhysAnchor, uPhysEast, uPhysNorth, uPhysUp`: guarded, include both chunks
  freely).
- What you get: a wind sea whose height, length and direction follow the wind, the fetch of
  the biome and the world's gravity and air (Neptune's methane runs higher than water);
  short crests and sets of bigger waves (no ruled lines from the air); rings behind a swimmer
  and under the ship's thrusters. `physics.water(bodyId, p).whitecap01` for foam,
  `.significant` (m) for how rough it reads from afar; `physics.fields.water.heightAt(p)` is
  the same surface in JS (the explorer floats on it).
- Liquids by place: lava in `lava_rivers` (barely any waves: 2.6 times water's density),
  cloud froth in `gold_islands` and `sky_islands` (billows high and slow).

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
18. **PAINTER's `phys: { ground }` is a family, my table keeps the finer word**: rock may stay
    glass or crystal. A test compares every override; two disagreements are on record (below).

## Needs from the others

### From PAINTER
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
(`waterLift`, `waterN`, `waterStep`), `expand=gpu`, `kits=0`, `quality`, `scale`, `hud=1`,
`freeze=1`. `window.__lab`: `info()`, `stability(dtMs, pairs, hideKits)`, `setRain(mode)`.
Example: `node tools/shot.mjs "/physics-lab.html?painted=1&body=earth&find=thunderstorm&walk=2&pre=12" out.png --w 960 --h 540 --timeout 400000 --shot-timeout 240000`.

**Frames at 960x540 (768x432 internal), quality 1, each opened and judged against the art bible:**

| Frame | What is in it | Verdict |
|---|---|---|
| `painted-storm-forest.jpg` | Earth forest, thunderstorm 17.5 mm/h, 1370 drops, broad strokes | **Reads as rain**, as pale slanted strokes among the trees; thin on the open grass (pale on pale); sheltered under the crowns as it should be. The sun is out and the ground is dry in the picture: the sky and the wash know nothing of the storm. No splash rings (erased by the post pass). |
| `painted-rain-options.jpg` | the four ways to draw rain, same storm | thin: **invisible** (1270 drops, none survive the post pass). cover: invisible. broad: visible, reads. blend (own pass after the painting): faint hairlines, and it draws over the paper border. |
| `painted-snow.jpg` | Earth alpine meadow, blizzard, 1380 flakes at 6 cm, visibility 0.18 | **Fails.** A dozen white dots against the dark hill; white on a light wash is nothing. No snow on the ground, no closing in. Snow cannot be done by a particle kit alone: it is `snowDepth` on the ground wash and `visibility01` in the air first, flakes last. The footprints read. |
| `painted-mars-dust.jpg` | Mars dunes, dust storm, visibility 0.10, 206 puffs, 509 sand grains | Puffs cut from your noise are acceptable dry-brush marks; **as a storm it fails**: fifteen separate blots in a clear sky. A dust storm is `dust01` in your haze, with these as accents. Footprints read well. |
| `painted-marks.jpg` | Earth desert, a walked circle, the ship landed and left | **Footprints read**: small dark dabs, right size, stable. Pad prints are small dark ovals, acceptable. Scour dishes had to be reduced to a faint ring: dozens overlap and an opaque kit piles them into a dark patch. Kicked dust shows as ochre patches: tolerable here, a brown blot on forest litter. |
| `painted-neptune-sea.jpg` | Neptune's sea, Hs 0.75 m, my patch lifted 0.8 m over your liquid, a hull hovering | **Fails as a sea.** A flat wash; the waves show only as the wavy far edge of the patch; spray under the hull reads. My patch fights your flat liquid surface (where it dips below yours you see yours), and my three-tone shading did not survive. This needs the wave chunk in your water material, not a second surface. |
| (not kept) grass parting | meadow and forest floor, an explorer walking a circle | **Cannot be judged**: where I looked there are three tufts of grass in view; nothing to part. The push field is live; it needs a meadow with blades. |

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
1. No public way to make the uniform set `FRAG_PARS` needs. I take it from
   `makeWashMaterial(...).uniforms`, which is public and works; export `baseUniforms` or bless that.
2. `VERT_PARS`, `VERT_END`, `FRAG_PARS` are named by the contract but live in
   `src/render/chunks.js`, not in `index.js`. Re-export them.
3. **An opaque pass cannot glaze.** Rain as a darker veil, dust as haze, a print as "the
   ground, darker", a wet patch: all want to tint what is already there. A kit can only lay
   its own ink over it, and the ink is wrong wherever the ground is not what the ink assumed.
   What would fix it: the local ground wash available to a kit's fragment (a function in
   `FRAG_PARS`, or a uniform colour per biome), or one multiplying pass after the scene pass.
4. The post pass erases marks under about 3 px, with no way to ask it not to: no splash
   rings, no fine rain, no snowflakes. Say what the least mark is, or give a region id that
   is kept crisp.
5. No way to move your liquid surface: `makeWaterMaterial` is not public and the world takes
   no wave chunk. A second surface over yours cannot work (frame above).
6. Nothing in the sky or the haze reads `physics.here.weather`: storms under the sun.

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

## Next stage (P4), in order
1. Whatever PAINTER's first drawn rain, marks and waves show to be wrong (sizes, counts,
   exposure, lifetimes): tune against the picture, not the lab. Sit with the new PAINTER on
   the kit factory until one kind is in the game.
2. Shader agreement measured inside `PROP_VERT`; real-GPU cost of the fields and kits.
3. A third (branch) rate in the trees, once the fields are on half-float (it costs a texture).
4. Drifts: snow and sand piling in the lee (the wake field already knows where the lee is).
5. Let the ship's cruise near the ground be what the engines and the air give, with PILOT.
