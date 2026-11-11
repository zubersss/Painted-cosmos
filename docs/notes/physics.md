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
physics.setQuality(0 | 1 | 2);
physics.warmUp({ bodyId, time, focus });   // once while loading: fills ground caches, compiles hot loops (about 20-60 ms)

// once per frame (PILOT in the game, PAINTER in the gallery), BEFORE world.update:
physics.update(dt, {
  bodyId,        // body the camera is on, or null in deep space (the near field then sleeps)
  time,          // seconds on the simulation clock (sim.t). Weather and wind are functions of it.
  focus,         // {x,y,z} body-local point the near field centres on (explorer feet, or the ship)
  sunDir,        // {x,y,z} body-local unit vector toward the sun (optional: day/night temperature, dawn mist)
  disturbers,    // [{ kind:'explorer'|'ship'|'jet'|'downwash', p, v, radius, strength, grounded? }]
});              //   explorer/ship: strength 1; jet/downwash: strength = thrust in newtons
                 //   build them with physics.explorer.disturbers(st, out) / physics.ship.disturbers(st, out)
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
    intensity01,
    precipitation: { type: 'none'|'drizzle'|'rain'|'snow'|'ice'|'acid'|'frost', species (key of data.SPECIES),
                     rate (mm/h water equivalent), intensity01, fallSpeed (m/s, this body's gravity and air),
                     dropSize (m), frozen01, hail01, reachesGround01 (Venus virga) },
    wetness01, snowDepth (m),
    visibility (m, real scale), visibility01 (multiply your clear-day fog distance by this),
    cloud01 (0 once you are above the deck), cloudBelow01, fog01, dust01, haze01, storm01,
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

physics.here            // { bodyId, air, weather, cover, groundHeight } at the focus, refreshed by update(): free to read
physics.setWindScale(bodyId, scale)   // how far a body's real wind is scaled down (data.WINDS[body].scale)
physics.stats           // { ms, msAvg, msMax (worst frame after warm-up), msGround, msAir, msWeather, msFlora,
                        //   msParticles, samples (sampleSurface calls this frame), particles, pushCells, reanchors }
```

### Dynamics (pure step functions; PILOT keeps input mapping and assists on top)

```js
import { stepExplorerBody, EXPLORER_BODY, stepShipBody, stepShipGear, wakeShip, SHIP_BODY } from './src/physics/index.js';
const env = physics.bindEnv(bodyId, env);   // adds env.air, env.ground, env.liquid, env.gravity and env.radius if missing

stepExplorerBody(st, cmd, dt, env, T = EXPLORER_BODY)       // == physics.explorer.step
//  st:  { p, v, grounded }  (PILOT's explorer state; st.phys is added on first use)
//  cmd: { wish:{x,y,z} m/s horizontal, jump:bool, jet:0..1, jetMaxRise?: m/s, descentLimit?: m/s,
//         airControl?: 0..1, assistAccel?: m/s2 }
//  env: { sample(unitDir), gravity, air?(p,out,height), ground?(surface,out), liquid? }
//  st.phys: { slip01, scramble01, sink, submerged01, windAccel, lean, support, impact, material, friction,
//             dust, jetThrottle, jetUse, speedGround }

stepShipBody(st, cmd, dt, env, T = SHIP_BODY)               // == physics.ship.step   (flight: translation only)
//  st:  { p, v, q }   cmd: { target:{x,y,z} m/s | null, tau: s, hover?: bool, boost?: bool, carve01?: 0..1 }
//  env: { up | null, gravity, radius, altGround?, air?, time? }
//  st.phys: { thrust, lift01, buffet, buffetAngle:{pitch,roll}, q, airspeed, gLoad, heat01,
//             downwash:{thrust,speed,q,radius}, groundEffect }

stepShipGear(st, { lift01, hold? }, dt, env, T = SHIP_BODY) // == physics.ship.gear   (rigid body on 3 legs; moves p, v AND q)
//  env: { sample(unitDir), gravity, ground? }
//  st.phys: { contacts, asleep, legLoad[3] (N), legCompress[3] (m), legContact[3], w (rad/s) }

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
  .plantDisplace(h, H, be, bn, out) -> { e, n, up }
physics.glsl.flora              // GLSL (ES 3.00): pcPhysBend(root, stiff01) -> vec4, pcPhysDisplace(rel, up, H, bend) -> vec3,
                                //   pcPhysWind(p) -> vec4, pcPhysGrid(p) -> vec2

physics.fields.deform
  .depth  Float32Array(64*64)     // m pressed into the ground, 0.5 m cells (trail trough); .uniforms.uPhysDeformMap
  .marks  { data: Float32Array(256*12), capacity, head, total, origin, stride: 12 }
          // per mark: x,y,z (rel. origin), dirx,diry,dirz, length, width, depth, kind (0 left foot, 1 right foot), born, life

physics.particles.rain / .snow / .hail / .dust / .sand / .ash / .spores / .leaves / .spray
  // { count, capacity, pos Float32Array(3n) (relative to .origin, body-local axes), vel (3n), size (n), age (n), origin, species }
physics.particles.events        // ring: { data Float32Array(256*8), head, total, origin }: x,y,z, kind (0 splash, 1 ripple, 2 settle), strength, time, size, 0
```

Reference data and helpers: `physics.data.{ATMOSPHERES, WINDS, REGIMES, MATERIALS, BIOMES, SPECIES}`,
`physics.util.{airDensity, airTemperature, gravityAt, fallSpeed, terminalVelocity, cellsAt, saltationThreshold,
holdAngle, iceFriction, treeFrequency, stemFrequency, PlantSim}`.

## Status

INTEGRATION: ready (commit `af0783c` or later). The API above is stable; changes from here are additive.

Stage P1 (foundations) is done:

| Part | State | File |
|---|---|---|
| Atmosphere per body, fall speeds | real, tested | `atmosphere.js` |
| Wind: bands, eddies, travelling gusts, height profile, canopy, terrain shelter | real, tested | `wind.js`, `air.js` |
| Weather cells, kinds, lightning, gust fronts, wetness, snow depth, visibility | Earth full; other bodies' regimes sketched with their own air, gravity and species | `weather.js` |
| Ground materials and contact | real, tested, all 46 biome ids mapped | `ground.js` |
| Explorer body | real, tested | `explorer.js` |
| Ship body: flight, gear, pulse profile | real, tested | `ship.js` |
| Flora wind-and-disturbance field + GLSL chunk + CPU twin | first version, tested, compiles and matches in the lab | `flora.js`, `flora.glsl.js` |
| Rain and snow particles, splash events | first version, tested | `particles.js` |
| Footprints (marks + trail depth) | first version, tested | `deform.js` |
| Dust, sand, ash, spores, leaves, spray, hail | buffers exist, **empty** (next stage) | `particles.js` |
| Water (waves, wakes) | **not started** | |

### Verified, and how
- `node --test src/physics/`: **125 tests, 0 failures** (also `node --test "src/physics/*.test.mjs"`).
  They pin: raindrop terminal speeds against Gunn and Kinzer (within 6 %) and against their own
  force balance; Stokes law; per-planet fall speeds; density profile; wind continuity in space
  (under 0.12 m/s per metre), across the poles, in time and across gust-cycle boundaries; gusts
  travelling with the wind; determinism; weather continuity; lightning schedule and thunder
  delay; wetness build-up and drying; snow; each body's regime; ground materials; the explorer
  (rest stays at rest, traction-limited start and stop, slope hold angle, power-limited climb,
  terminal fall on Earth and Venus, vacuum energy conservation, jump height by gravity, landing
  impulse, jetpack, wading and floating, 60 Hz against 20 Hz, extreme inputs); the ship (top
  speed formula, spool, hover, wind hold, turbulence, implicit drag at any step, gear settle and
  sleep at 60 and 20 Hz on level and sloping ground, rebounds that only shrink, pulse S-curve);
  the oscillator (exact at any step, never gains energy); the flora field; particles; footprints;
  the facade (shape, all ten bodies, determinism, budget, re-anchoring, deep space, NaN).
- Timing (Node 22, this sandbox, 4 cores shared with the other two workers): `physics.update`
  at quality 1 **0.20 ms mean / 0.24 ms p95 walking; 0.31 / 0.80 ms at 46 m/s; 0.38 / 0.70 ms
  at 160 m/s** on PILOT's stub; **0.17 ms mean on PAINTER's real Earth**.
  Worst frame: the test repeats a 300-frame run four times after `warmUp()` and gives each
  frame its best time; the worst of those is **0.22 ms**. Single measurements of 20-35 ms do
  occur on this loaded machine about once in 1200 frames; they never recur at the same frame,
  and a `--trace-gc` run shows only minor collections (0.2-0.4 ms, about one every 14 frames),
  so they are the scheduler, not physics. Without `warmUp()` the first frames cost 5-10 ms
  (engine compile plus a burst of surface samples): that is the 6.8 ms frame the lead measured.
- Allocation: no objects or arrays are created per frame. About 100 kB of short-lived boxed
  numbers per frame remain (doubles returned from calls the engine does not inline); the three
  worst sources (string seed keys, object-field outputs in the 1024-cell loop, hash calls
  inside the noise) were removed in this stage.
- `physics-lab.html` in headless Chromium, no console errors in any scene. Evidence in
  `docs/shots/physics/`: `meadow-gale-walk.jpg` (grass bent by wind, parted by the explorer,
  footprints in snow), `meadow-jetpack.jpg` (plume blowing grass radially), `rain-earth.jpg`,
  `thunderstorm-earth.jpg`, `snow-earth.jpg`, `explorer-sand-prints.jpg`, `wind-terrain.jpg`,
  `ship-liftoff-hover-land.jpg` (four frames: lift-off, hover with downwash, descent, asleep on
  its gear), `storm-neptune-methane.jpg`, `meadow-mars-gale.jpg`, `globe-earth.jpg`,
  `globe-jupiter.jpg`. In every flora shot the red dots are plant tips computed by the JS model
  and the green plants are drawn by the GLSL chunk from the same textures: they coincide.

### Not done or not verified
- Not wired into the game: nothing in `src/player`, `src/ship`, `src/world` calls physics yet.
- The GLSL chunk has only been compiled and run in the lab's own shader, not inside PAINTER's
  `PROP_VERT`. Shader-against-JS agreement is judged by eye (dots on tips), not measured.
- Other bodies' weather is a sketch: the right air, gravity, species and cell kinds, but no
  Mars dust devils, no hail particles, no Jupiter band-following storm tracks.
- Real-GPU cost of the three float textures and the 12 texel fetches per plant vertex is
  unmeasured (software GL only). `PC_PHYS_LINEAR` halves the fetches where float filtering exists.
- The ship gear model samples the ground under each foot once per call; it has not been run
  on PAINTER's bumpiest terrain, only on planes, cones and PILOT's stub.

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
5. **Lift-off and landing.** Lift-off: `wakeShip(st)`, then `stepShipGear(st, { lift01 }, dt, env)`
   with `lift01` rising 0 to 1 over a second (the legs unload and extend), then `stepShipBody`
   with a vertical target. Landing: your assist flies `target` down to about 1 m at 1-1.5 m/s,
   then `stepShipGear(st, { lift01: 1, hold: up * -0.6 }, ...)` until `st.phys.contacts > 0`,
   then fade `lift01` to 0 over 1.5 s; touchdown is `contacts === 3 && lift01 === 0`; in LANDED
   keep calling `stepShipGear` (it returns at once when `st.phys.asleep`). The lab's ship scene
   does exactly this (`driveShip` in `physics-lab.html`).
6. **Landing sites.** Replace `landMaxSlope` with friction: a site holds the ship when
   `Math.tan(slope) < 0.8 * physics.ground(bodyId, dir, out, surface).friction`. On warm ice
   that is 3 degrees; on rock 34.
7. Add `node --test src/physics/` to "every check". `src/physics/package.json` is a dev-only
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

## For PAINTER: wiring, in order

1. **Read from `world.setPhysics(physics)`** in `world.update`. `physics.update` has already
   run that frame (PILOT calls it first; in the gallery you call it yourself with
   `{ bodyId, time, focus: camera ground point, sunDir }`).
2. **Three textures**, created once, re-uploaded when the version changes:
   ```js
   const F = physics.fields.flora;
   const mk = (arr, n) => { const t = new THREE.DataTexture(arr, n, n, THREE.RGBAFormat, THREE.FloatType);
     t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; };   // the chunk filters by hand
   const tBend = mk(F.bend, F.size), tWind = mk(F.wind, F.size), tPush = mk(F.push, F.nearSize);
   // per frame:
   if (F.version !== lastV) { tBend.needsUpdate = tWind.needsUpdate = true; lastV = F.version; }   // every update
   if (F.pushVersion !== lastP) { tPush.needsUpdate = true; lastP = F.pushVersion; }               // only while plants are being pushed
   for (const k in F.uniforms) uniforms[k].value.fromArray(F.uniforms[k]);                          // Vector3 / Vector4
   ```
   Row j is north, column i is east, texel centres at cell centres. Where
   `OES_texture_float_linear` exists you may `#define PC_PHYS_LINEAR` and use `LinearFilter` +
   `ClampToEdgeWrapping` (one fetch instead of four). Half-float works too.
3. **The shader.** Put `${physics.glsl.flora}` (or `import { FLORA_GLSL } from '../physics/index.js'`)
   above `main()` in `PROP_VERT`, delete `pcSway` and the `lp += pcSway(...)` line, and after
   `vec3 wp = (im * vec4(lp * vis, 1.0)).xyz;` add:
   ```glsl
   vec3 rootB = io + uOrigin;                         // body-local root of this plant
   vec4 pb = pcPhysBend(rootB, uStiff);               // xy bend (rad, east/north), z flatten01, w shake01
   wp = io + pcPhysDisplace(wp - io, normalize(rootB), uPlantHeight * length(im[1].xyz), pb.xy);
   ```
   `uStiff`: 0 for grass, ferns, flowers; about 0.35 for bushes; 1 for trees (per material).
   `uPlantHeight`: the model's height in metres before the instance scale. The stem curls like
   a tip-loaded cantilever and keeps its length; the root does not move; a crown rides on its
   trunk. `pb.w` (shake) is there for a leaf flutter of your own; `pcPhysWind(rootB).w` is the
   turbulence in m/s if you want flutter to follow gustiness. The chunk uses `texelFetch`, so
   the material must compile as GLSL ES 3.00 (three's default on WebGL2). Note `flat` is a
   reserved word there (it bit me).
4. **Weather for the sky and the sheet**: `physics.here.weather` every frame: `cloud01` (cloud
   cover), `visibility01` (multiply your clear-day fog distance), `wetness01` (darker, wetter
   ground washes), `snowDepth` (m), `fog01` / `dust01` / `haze01` (tints), `storm01`,
   `lightning.flash01` (bare paper showing through, 3-4 strokes in a quarter second),
   `precipitation.intensity01`. For a storm seen from afar: `physics.util.cellsAt(bodyId)` ->
   `[{ x, y, z (unit centre), r (m), w (strength), kindId }]`.
5. **Particles**: for `rain` and `snow`, draw `count` marks; `pos` is relative to `origin`
   (put the object at `origin` under the body root); `vel` gives the streak (a 40 ms exposure
   is `vel * 0.04`); `size` is the diameter in metres. `physics.particles.events` holds the
   last 256 splashes, ripples and settles with their time.
6. **Footprints**: `physics.fields.deform.marks` (crisp, one per step) and `.depth` (the trough).

## Lab: `physics-lab.html` URL parameters

`scene=` `flora` (default) | `wind` | `rain` | `snow` | `storm` | `explorer` | `ship` | `globe`;
`body=` any body id; `world=` `flat` | `hills` | `slope` (`&slope=14` degrees) | `stub` (PILOT's) |
`real` (PAINTER's); `ground=` a biome id for the synthetic worlds; `find=` `gale` | `calm` |
`rain` | `snow` | `thunderstorm` | `dust` | any `weather().kind`; `t=` start time (s); `speed=`;
`seed=`; `quality=`; `fixed=1` (advance 1/30 s per rendered frame) with `fast=N` (N of those
per frame); `jet=0`, `walk=0` or `walk=<m/s>`, `explorer=0`, `flora=0|1`, `trees=<density>`,
`arrows=0`, `grass=<height m>`, `sea=<depth m>`, `wind=<m/s>` (steady wind on the bodies only);
camera `yaw=`, `pitch=`, `dist=`. `window.__lab.info()` returns the state for `--eval`.
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
13. **Default seed 14** gives a fair first seven minutes at Earth's home forest and at the stub
    spawn, cloud at about twelve minutes and the first shower just after (a test pins this).

## Needs from the others

### From PAINTER
1. **Canopy at a point.** Today I only know the biome, so the whole temperate forest is
   "75 % closed canopy, 14 m": the spawn clearing and the glades are as still as the deep wood
   (0.7 m/s at 2 m in a 5 m/s breeze). Two additive fields on the `sampleSurface` result fix
   it and are already read if present: `canopy01` (closed-canopy fraction, 0 in a glade) and
   `canopyHeight` (m). PILOT asked for the same height for the ship's cushion.
2. If a biome's ground is not what my table guesses (`physics.data.BIOMES[id].ground`, e.g.
   `temperate_forest: 'litter'`, `sea_coast: 'grass'` with a sand shore), say so; or add
   `phys: { ground }` to the biome in `looks.js` and I will read it.
3. Plant heights and stiffness per kit (grass 0.3-0.6 m, fern, bush, birch, pine) so
   `uPlantHeight` and `uStiff` are the plant's own.
### From PILOT
1. The wiring above. Until then nothing of this is in the game.
2. `disturbers` every frame, `sunDir`, and `warmUp` during loading.
3. Decide `carve01` and `assistAccel` (feel is yours). My advice: `carve01: 1` in flight, and
   try the explorer with `assistAccel: 0` first.

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
- Not yet: R-DEF-2 (rims), R-DEF-3 (snow filling prints), R-DEF-4 (ship marks), R-RAIN-4
  (puddles), R-RAIN-5 (shelter under the ship), R-WIND-4 (a third, branch rate), R-WATER-2/3,
  R-PLANET-2's ballistic dust (no dust particles yet), R-PLANET-3 in full.

### To PILOT ("From PHYSICS" in your notes)
1. Table: above. 2. Worst frame: above. 3. `bindEnv` needs nothing your explorer env lacks;
for the ship add `altGround`.

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

## Ideas and critique

Blunt, as asked. All of it is about motion; none of it is about look or structure.

- (to PILOT, explorer) It accelerates like a cursor: 26 m/s2 is 2.7 g, walking speed in 0.16 s,
  a dead stop from a 27 km/h run in 0.28 s on any surface, wet rock and ice included. There
  is no momentum to feel, so there is nothing for sand, snow or rain to change.
- (to PILOT, explorer) Falling hits an invisible ceiling at 24 m/s and the jetpack hits one at
  8.5 m/s by overwriting the velocity; both show as a kink the instant they engage. The slide
  on steep ground is a constant 5 m/s: it reads as a conveyor belt.
- (to PILOT, explorer) `stepDown` 0.5 m glues the feet to the ground on every world. On Pluto
  (g 1.4) a run over rolling ground should bound; today it tracks the terrain like a train.
- (to PILOT, ship) The velocity is a low-pass filter of a wish, so the craft has no mass:
  46 m/s2 off the mark at the ground, 441 m/s2 (45 g) in space, a full stop in half that with
  X. Lift-off is a position curve and landing ends in `p = floor` and a slerp to the rest
  attitude: no weight comes onto the legs, nothing compresses, nothing settles.
- (to PILOT, ship) There is no gravity, drag or wind on the ship at all, so Venus, Mars and
  the Moon fly identically. That is the cheapest place to get "each planet feels different".
- (to PAINTER, flora) `pcSway` is two sines of global time with a hashed phase: every plant
  on the planet sways at exactly 0.18 Hz and 0.43 Hz with the same amplitude, grass and pine
  alike, along its own instance axes (so the sway direction is the plant's yaw, not the
  wind's), and neighbours are uncorrelated. That is metronomes and noise at once, the two
  things art bible point 7 rules out. The field gives direction, gusts that cross the meadow,
  and frequency by size.
- (to PAINTER, sky) Clouds drift with `uTime * const` on fixed axes. `physics.here.air.wind`
  (or `physics.air` at cloud height: it is faster aloft, and on Venus twelve times faster) would
  make the clouds, the rain slant and the grass agree, which is R-WIND-1.
- (to both) The game "walks" at 4.2 m/s, three times a walking pace. Most references about
  feet (stride, wading, wind, stopping) are true at 1.4 m/s and false at 4.2. Either the walk
  is slower and Shift is the jog, or the checks should be read as being about a jog.
- (self) The forest floor is physically calm (0.7 m/s at 2 m under a closed canopy), which is
  right and may be dull to look at. Glades and the crowns carry the motion once PAINTER's
  canopy field is in.
- (idea) Thunder: `lightning.thunderIn` counts down to the bang at the speed of sound of that
  air (340 m/s on Earth, 1210 on Jupiter, none on the Moon). Cheap, and it makes distance audible.
- (idea) `st.phys.lean` for the explorer model and `legCompress` for the ship's legs are
  animation data that cost nothing.

## Next stage (P2), in order
1. Kicked dust, blown sand (saltation above the threshold), ash, spores, leaves, spray, hail:
   the empty particle kinds, with ballistic arcs on airless bodies.
2. Ground: displaced rims, snow filling prints, ship pad prints and scour ring, angle-of-repose
   relaxation, drifts.
3. A third (branch) response in the flora field; rain shelter under canopy and under the ship.
4. Water: wind-driven wave parameters, wakes and ripples as events.
5. Other-planet weather in depth (Mars dust devils, Jupiter storm tracks along the bands).
