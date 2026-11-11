# PHYSICS notes

Branch: `cosmos` (shared with PAINTER and PILOT, one working tree). Commits: `tools/commit.sh physics`.
Owner of: `src/physics/**`, `physics-lab.html`, `docs/notes/physics.md`, `docs/shots/physics/**`.

## API (current, exact; this section is kept up to date with every commit)

Everything is pure logic: no three, no DOM, plain `{x,y,z}` objects, **body-local** coordinates
(C1, C3), metres, seconds, kelvin, pascal. Deterministic for a given `seed` and `time`.

```js
import { createPhysics } from './src/physics/index.js';

const physics = createPhysics({ sampleSurface, seed });   // sampleSurface(bodyId, unitDir) = the contract's; seed optional
physics.setQuality(0 | 1 | 2);

// once per frame (PILOT in the game, PAINTER in the gallery), BEFORE world.update:
physics.update(dt, {
  bodyId,        // body the camera is on, or null in deep space (the near field then sleeps)
  time,          // seconds, the simulation clock (sim.t). Weather and wind are functions of it.
  focus,         // {x,y,z} body-local point the near field centres on (explorer feet, or the ship)
  sunDir,        // {x,y,z} body-local unit vector toward the sun (optional: day/night temperature, dawn mist)
  disturbers,    // [{ kind:'explorer'|'ship'|'jet'|'downwash', p, v, radius, strength, grounded? }]
});              //   explorer/ship: strength 1 (scale); jet/downwash: strength = thrust in newtons
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
    cloud01, fog01, dust01, haze01, storm01, front01 (gust front), windFactor, temperature (K),
    lightning: { rate (flashes/min), flash01 (brightness now), nextIn (s), thunderIn (s; negative = passed),
                 thunder01, last: { t, x, y, z (unit direction of the strike), distance (m) } } }

physics.ground(bodyId, unitDir, out?, surface?) ->        // pass `surface` if you already sampled it
  { material: 'grass'|'soil'|'litter'|'mud'|'sand'|'dust'|'gravel'|'rock'|'snow'|'ice'|'ash'|'glass'|'crystal'|'moss'|'bed',
    friction (static), kinetic, foothold (extra holding traction on slopes), restitution,
    sink (m), drag (walking resistance as a fraction of normal force), repose (rad), dust (0..1),
    z0 (m), imprint (0..1), density, grain, liquidDepth (m), wetness01, snowDepth, temperature,
    canopy01, canopyHeight, moist, fog, dustSource }

physics.here   // { bodyId, air, weather, cover, groundHeight } at the focus, refreshed by update(): free to read
```

### Dynamics (pure step functions; PILOT keeps input mapping and assists on top)

```js
import { stepExplorerBody, EXPLORER_BODY, stepShipBody, stepShipGear, SHIP_BODY } from './src/physics/index.js';
const env = physics.bindEnv(bodyId, { sample, gravity });   // adds env.air, env.ground, env.liquid, env.radius

stepExplorerBody(st, cmd, dt, env, T = EXPLORER_BODY)       // == physics.explorer.step
//  st:  { p, v, grounded }  (PILOT's explorer state; st.phys is added)
//  cmd: { wish:{x,y,z} m/s horizontal, jump:bool, jet:0..1, jetMaxRise?: m/s, descentLimit?: m/s, airControl?: 0..1 }
//  st.phys: { slip01, sink, submerged01, windAccel, support, impact, material, friction, dust,
//             jetThrottle, jetUse, speedGround }

stepShipBody(st, cmd, dt, env, T = SHIP_BODY)               // == physics.ship.step   (flight, translation)
//  st:  { p, v, q }   cmd: { target:{x,y,z} m/s | null, tau: s, hover: bool, boost: bool }
//  env: { up, gravity, radius, altGround, air, time }
//  st.phys: { thrust, lift01, buffet, buffetAngle:{pitch,roll}, q, airspeed, gLoad, heat01,
//             downwash:{thrust,speed,q,radius}, groundEffect }

stepShipGear(st, { lift01, hold? }, dt, env, T = SHIP_BODY) // == physics.ship.gear   (rigid body on 3 legs)
//  st.phys: { contacts, asleep, legLoad[3], legCompress[3], legContact[3], w }

physics.ship.planSpeedChange(v0, v1, aMax, jMax) / sampleSpeedChange(plan, t) / stepPulse(ps, vWant, dt)
```

### Fields and buffers (typed arrays; PAINTER wraps them in textures and attributes)

```js
physics.fields.frame            // LocalFrame: ox,oy,oz (anchor, body-local m), ex.. (east axis), nx.. (north), ax.. (up)
physics.fields.flora
  .bend   Float32Array(32*32*4)   // RG soft-plant load (east, north), BA stiff-plant load; 8 m cells
  .wind   Float32Array(32*32*4)   // RG wind at 2 m (m/s), B gust01, A turbulence (m/s)
  .push   Float32Array(64*64*4)   // RG push load, B flatten01, A shake01; 0.5 m cells
  .size 32  .cell 8  .nearSize 64  .nearCell 0.5
  .uniforms   // { uPhysAnchor, uPhysEast, uPhysNorth, uPhysUp, uPhysWindMap, uPhysNearMap, uPhysWave,
              //   uPhysWavePhase, uPhysShape }  plain arrays, refreshed every update
  .version / .pushVersion          // bump when the arrays changed (re-upload)
  .plantBend(p, stiff01, out) -> { e, n (radians), angle, flatten01, shake01, load }   // CPU twin of the shader
  .plantDisplace(h, H, be, bn, out) -> { e, n, up }
physics.glsl.flora              // GLSL string: pcPhysBend(root, stiff01), pcPhysDisplace(rel, up, H, bend), pcPhysWind(p)

physics.fields.deform
  .depth  Float32Array(64*64)     // m pressed into the ground, 0.5 m cells (trail trough)
  .marks  { data: Float32Array(256*12), capacity, head, total, origin, stride: 12 }
          // per mark: x,y,z (rel. origin), dirx,diry,dirz, length, width, depth, kind, born, life

physics.particles.rain / .snow / .hail / .dust / .sand / .ash / .spores / .leaves / .spray
  // { count, capacity, pos Float32Array(3n) (relative to .origin, body-local axes), vel (3n), size (n), age (n), origin }
physics.particles.events        // ring: { data Float32Array(256*8), head, total, origin }: x,y,z, kind, strength, time, size, 0
```

Reference data and helpers: `physics.data.{ATMOSPHERES, WINDS, REGIMES, MATERIALS, BIOMES, SPECIES}`,
`physics.util.{airDensity, airTemperature, gravityAt, fallSpeed, terminalVelocity, cellsAt, ...}`,
`physics.stats.{ms, msAvg, samples, particles, pushCells}`.

## Status

INTEGRATION: not yet (first commit: API surface present, models being tested). Flag follows.

## Decisions

(being written)

## Needs from the others

(being written)

## Answers to the others

(being written)

## Ideas and critique

(being written)
