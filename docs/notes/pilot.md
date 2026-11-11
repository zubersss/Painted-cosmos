# PILOT notes

Branch: `cosmos` (shared with PAINTER and PHYSICS, one working tree). Commits: `tools/commit.sh pilot`.

## Status

M1 (Pilot's half): **in progress, loop working on stubs** (see "Verified" below for what is proven).

- Boot: `index.html` + `src/main.js`. Renderer from `RENDERER_OPTIONS`, camera, providers,
  frame loop, `window.__pc`, `window.__pcReady`.
- Integration switch: `src/core/providers.js`. Flags `REAL_READY = { render, world, art, ui }`
  are all `false` today, so the default page runs on my stubs (with a console *warning*).
  `?real=1` (or `?real=world,render`) tries your modules ahead of the flag; `?stub=1` forces
  stubs. A real module that fails to import falls back to its stub with a warning.
- Pure simulation (`src/core/sim.js`, no three, no DOM): state machine, explorer, ship,
  cameras, frames, orbits. Presenter (`src/core/game.js`) places roots, models and camera and
  calls `world.update` -> `painter.setMood` -> `painter.render`.
- Stubs (`src/core/stubs/`): all ten bodies as noise spheres with a small cube-sphere quadtree,
  liquid on some, the sun, plain renderer into a float-depth target, stub explorer and ship.

### Verified
- `node --test tests/*.test.mjs`: 62 tests pass (orbits, frames and floating origin, state
  machine, explorer, cameras, ship flight, landing assist, dynamic resolution, stub contract,
  and `tests/loop.test.mjs`, which plays the whole loop through the pure simulation).
- `node tests/playthrough.mjs`: the same loop in headless Chromium with real key and mouse
  events. (Result and screenshots: see the end of this section once the run is recorded.)

### Not verified / not done
- Real-GPU frame rate: cannot be measured here. Software GL runs the stub at about 60 fps at
  960x540, which says nothing about the painted pipeline.
- Pointer lock in a real browser (headless uses the drag-look fallback).
- Pulse drive, planet map, save, audio, painted HUD: later milestones.

## Decisions

Architecture and feel are mine to decide (brief section 5); these are settled unless someone
objects in their notes.

1. **Floating origin = the camera.** Every frame the camera sits at exactly (0,0,0) in the
   scene and every body root, the sun, the ship and the explorer are positioned relative to it
   in doubles. `camera.position` is always zero; do not use it as "where am I on the planet".
   Use `root.worldToLocal(cameraPos)` (as PAINTER's world already does).
2. **Three flight frames** (`src/core/frames.js`): the ground frame (spins with the body) up to
   `spaceAltitude(body)`; the body-centred inertial frame up to `soiRadius(body)` (the planet
   turns beneath a parked ship but never leaves it behind); the sun's frame beyond. State
   changes follow the frame: ground frame = ATMOSPHERE, otherwise SPACE.
3. **`spaceAltitude(body)` and `soiRadius(body)` live in `src/data/bodies.js`** (additive
   exports). `spaceAltitude = max(atmosphereHeight, 0.2 * radius)`: earth 800 m, moon 280 m,
   mars 600 m, mercury 440 m, pluto 320 m, jupiter 1400 m. `soiRadius = 4 * radius`.
4. **Day and night come from real spin.** Earth's spin phase is set at boot so that the spawn
   point is at 09:30 local solar time. `setMood.timeOfDay` is the true local solar time at the
   camera. I never call `world.setTime` in play.
5. **Depth:** reversed-Z with float depth where `EXT_clip_control` exists (it does here), log
   depth otherwise, exactly C7. On top of that the near plane is 0.08 m on foot, 0.12 m in the
   cockpit, 0.35 m in the chase view growing to 4 m with clear air; far = 1.2 x the far side of
   the farthest body (about 1.7e6 to 2.9e6 m). `src/core/depth.js`.
6. **Fixed 60 Hz simulation steps**, up to 0.25 s of real time per frame, so the feel is the
   same at 20 fps and 144 fps (tested). `painter.render(scene, camera, dt)` gets the simulated
   time of that frame.
7. **Controls.** On foot: WASD, Shift run, Space jump (hold: jetpack), E board, V first/third
   person, wheel zooms the boom. Ship: mouse points the nose, W/S persistent throttle, A/D
   turn, Space/C rise and sink, X brake, E land (with the prompt) or step out, V cockpit/chase.
   Ctrl is never a game key (Ctrl+W closes the tab).
8. **The ship is an anti-gravity craft.** It hovers when you let go, levels its own wings,
   banks into turns, follows the curve of the planet, cannot loop near a planet (pitch limit
   78 deg), flares out of a dive near the ground, rides a cushion (never lower than 1.6 m in
   free flight), pulls up over rising terrain, and bounces softly if it still touches. Landing
   is E with a prompt below 90 m and 75 m/s, or simply sinking onto the ground with C.
   It will also land on liquid (it floats).
9. **Dynamic resolution** (`src/core/dynres.js`) drives `painter.setRenderScale` (0.5 to 1) and
   `painter.setQuality`. `?dynres=0&scale=1&quality=2` pins it for screenshots. In software GL
   it would always fall to the floor, so every headless check should pass `dynres=0`.

### Tuning numbers (feel target: unhurried, weightless, generous)

Explorer (`src/player/explorer.js` EXPLORER): walk 4.2 m/s, run 7.4 m/s, ground accel 26 m/s2,
air control 6 (11 while jetting), jump 4.8 m/s (about 1.3 m on Earth), jetpack thrust 17 m/s2
minus gravity, climb capped at 8.5 m/s, 4.2 s of fuel, refill 2.2 s on the ground, 10 s in the
air after a 0.9 s delay, terminal fall 24 m/s, last 3 m of a fall cushioned to 7 m/s, walkable
slope up to 46 deg, sliding above 55 deg, step-down 0.5 m, wading slows to half speed at 1 m
depth, floats when the liquid is deeper than 1.25 m (swim 2.6 m/s). No damage anywhere.

Cameras (`src/player/camera.js` CAMERA): FOV 58 on foot, 62 to 72 in the ship with speed; boom
5.6 m (wheel 2.2 to 14), pivot 2.05 m above the feet so the explorer sits in the lower third;
clearance 0.45 m above ground and liquid (lift first, pull in second); chase camera 15 to 21 m
behind and 3.6 m above, heading lag 4.5 /s, clearance 1.2 m.

Ship (`src/ship/flight.js` SHIP): 46 m/s at the ground rising to 160 m/s at the edge of space
and 750 m/s by 5 x the space altitude; velocity time constant 1.0 s in air, 1.7 s in space
(X brake: 0.45 x); throttle 0.55 /s; nose follows the mouse at 7.5 /s up to 1.6 rad/s; bank
0.55 rad per rad/s up to 0.62 rad; lift-off 2.8 s to a 9 m hover; landing glide 14 m/s,
descent 13 m/s easing to 1.1 m/s at touchdown, refuses sites steeper than 35 deg.
Measured: ground to space in about 17 s at full throttle and 55 deg; boarding 1.25 s; stepping
out 0.95 s.

Mouse: 0.0023 rad/px on foot, 0.0017 rad/px in the ship.

## Needs from the other

### From PAINTER
1. **Terrain ceiling.** Keep all walkable ground (floating islands included) below
   `radius + 0.8 * spaceAltitude(body)`. Above `spaceAltitude` the ship leaves the ground frame
   and stops sampling terrain. If a body needs taller terrain, say so and I will raise its
   `spaceAltitude` in `bodies.js`.
2. **Readiness.** I set `window.__pcReady` when `world.busy === 0` for two frames (your `busy`
   getter; thank you). Keep it meaning "nothing left to build for the current camera".
3. **`liquidRadius`** in `sampleSurface` (C1). Wading, floating, the camera's water clearance
   and landing on liquid all read it. Without it I treat everything as dry.
4. **Models (C10):** `userData.seat` and `userData.hatch` on the ship. The cockpit view puts
   the camera exactly at `seat` looking along -Z with a 0.12 m near plane: whatever is in front
   of that point is what the player sees. `hatch` should be on the ground beside the hull,
   2 to 3 m from the centre line; the explorer steps out there facing away from the ship.
5. **`animate(state, dt)`** receives: explorer `{ mode: 'idle'|'walk'|'jet'|'fall'|'wade', speed,
   jet01, lookPitch }`; ship `{ mode: 'landed'|'hover'|'fly'|'pulse', throttle01, gear01,
   canopy01 }`. During boarding the explorer walks to the hatch (mode 'walk') while `canopy01`
   rises to 1 and falls back; then the explorer model is hidden (`visible = false`).
6. **Trees and rocks are not in `sampleSurface`,** so the explorer and both cameras pass
   through them. For M1 that is acceptable; please fade or part strokes that are within about
   1 m of the camera so a trunk never fills the screen. If you can give me a cheap
   `world.sampleObstacles(bodyId, unitDir, radius) -> [{ unitDir, radius, height }]` later I
   will collide with trunks and boulders.
7. **Foreign objects.** My stub explorer and ship use `MeshLambertMaterial` and
   `MeshBasicMaterial`; later markers will too. Your `standInFor` covers that. I add no lights.

### From PHYSICS
Nothing yet. `stepExplorer(st, input, dt, env)` and `stepFlight(st, input, dt, env)` take
everything about the world through `env` (`env.sample`, `env.gravity`, and for the ship `up`,
`altitude`, `spaceAlt`), so your air, ground and weather can come in the same way in M2.

## Answers to the other

- PAINTER (from reading `src/world/index.js` and `src/render/index.js` mid-flight, no notes
  file yet): your shapes match the contract as I consume it. I pass `sampleSurface` a
  `THREE.Vector3` and copy `radius`, `normal.x/y/z`, `slope`, `liquidRadius`, `biomeId`,
  `biomeWeights` out at once, so you may return scratch objects. I call
  `root.updateWorldMatrix(false, false)` on every root and on the sun before `world.update`,
  and `camera.updateMatrixWorld()`; children are left to you and the renderer.
- PAINTER: `setMood` fields I send every frame: `bodyId` (the body whose frame the camera is
  in, or `null` in deep space), `biomeWeights` (from `sampleSurface` under the camera, `{}`
  above twice the space altitude), `biomeId` (additive, the heaviest), `timeOfDay` (hours),
  `altitude01` (camera height over base radius / spaceAltitude, clamped), `inSpace01`
  (smoothstep from 0.75 to 1.6 x spaceAltitude; 1 in deep space), `speed01` (ship speed / 750,
  or walking speed / 40).
- COORDINATOR / PHYSICS: section F and C14 read. Integration of `createPhysics` is mine from
  M2; I will keep `env` as the single doorway and police the 2 ms budget.

## Ideas and critique

- (to PAINTER) The stub shows how much a moving ground texture helps the feel of speed: please
  make sure the wash variation is readable under the explorer's feet at walking speed, or the
  walk will feel like sliding.
- (to PAINTER) From orbit at 5 km the whole globe fits the frame with FOV 62. That frame is
  where "how each planet looks from orbit" will be judged; the terminator crosses the disc.
- (self) The climb from ground to space takes about 17 s. If the painted atmosphere transition
  deserves longer, I will slow `speedAtmoTop` rather than thicken the atmosphere.
