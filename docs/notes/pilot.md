# PILOT notes

Branch: `cosmos` (shared with PAINTER and PHYSICS, one working tree). Commits: `tools/commit.sh pilot`.

## Status

**M1 (Pilot's half): met.** Walk, jetpack, board, lift off to orbit, land again, step out:
on my stubs and inside PAINTER's real painted world. I am also the LEAD DEVELOPER since
2026-11-11: see `docs/lead/REFERENCES.md`, `REVIEW.md`, `TRACK.md`.

- Boot: `index.html` + `src/main.js`. Renderer from `RENDERER_OPTIONS`, camera, providers,
  frame loop, `window.__pc`, `window.__pcReady`.
- Integration switch: `src/core/providers.js`. `REAL_READY = { render: true, world: true,
  art: true, ui: false }` since commit `15e77f9`: **the default page runs PAINTER's modules.**
  `?stub=1` forces my stubs (console *warning*). A real module that fails to import falls
  back to its stub with a warning. `ui` waits for `src/art/ui.css`.
- Pure simulation (`src/core/sim.js`, no three, no DOM): state machine, explorer, ship,
  cameras, frames, orbits. Presenter (`src/core/game.js`) places roots, models and camera and
  calls `world.update` -> `painter.setMood` -> `painter.render`.
- Stubs (`src/core/stubs/`): all ten bodies as noise spheres with a small cube-sphere quadtree,
  liquid on some, the sun, plain renderer into a float-depth target, stub explorer and ship.

### Verified (how)
- `node --test tests/*.test.mjs`: 67 tests pass. Orbits, frames and floating origin, the state
  machine, explorer (walk, run, slopes, sliding, wading, floating, jetpack and fuel), cameras
  (never under ground or liquid, never inside the ship), ship flight (hover, throttle, bank,
  pitch limit, flare, cushion, bounce), landing assist, dynamic resolution, the stub contract,
  PAINTER's real `sampleSurface` contract on all ten bodies, and `tests/loop.test.mjs`, which
  plays the whole loop through the pure simulation with scripted keys and mouse.
- `node tests/playthrough.mjs --keep` (stub world, 640x360, headless Chromium, real key and
  mouse events, 37 checks, fails on any console error): PASSED. Ground to space 18.2 s.
  Evidence: `docs/shots/pilot/01-on-foot.jpg`, `02-jetpack.jpg`, `03-board-prompt.jpg`,
  `05-liftoff.jpg`, `06-climb.jpg`, `07-orbit.jpg`, `08-moon.jpg`, `10-land-prompt.jpg`,
  `12-stepped-out.jpg`.
- The same script inside PAINTER's real world (`--query "scale=0.5&quality=0" --w 480 --h 270`,
  clean export of `bb8ec30`, before the forest's flora was committed): PASSED, no console
  errors. A run on the current HEAD with the forest is recorded below if it finished.
- Real-world frames from the integrated game at `19f72ce`: `docs/shots/pilot/real-01-on-foot.jpg`
  (the clearing, the explorer, the ship), `real-02-orbit.jpg`, `real-03-flight.jpg` (over the
  canopy with the landing prompt).

### Not verified / not done
- Real-GPU frame rate: cannot be measured here. In software GL the painted forest runs at
  0.4 to 1 fps at 640x360 (4.4 M triangles a frame, see REVIEW), the stub at 20 to 60.
- Pointer lock: headless Chromium grants the lock but reports meaningless deltas for synthetic
  mouse events, so every scripted run uses `pointerlock=0` (drag to look). The locked path is
  the same code plus a spike guard, but nobody has moved a real mouse through it.
- Trees and rocks are not collided with yet (`world.sampleObstacles` arrived; M2).
- Pulse drive, planet map, save, audio, painted HUD: later milestones.
- Physics is not wired in (M2, per the coordinator).

### What I saw playing the slice in the painted world
- It works on first contact: spawn in the clearing by the brook at 09:30, the ship 16 m away,
  walk, jetpack over the trees, board, climb out through a sky that turns to indigo wash,
  the planet as a painted ball below, back down, land, step out. One flag flip to integrate.
- Ugly or clunky, blunt list (details and evidence in `docs/lead/REVIEW.md`): the forest costs
  4.4 M triangles a frame; foliage is stippled rather than brushed; trunks and the brook bank
  are ruler-straight; the foreground is one flat wash; I walk and fly straight through trees;
  the ship can be told to land in a wood; my HUD ink needed a halo to survive space.
- Contract mismatches: none. Two adjustments on my side: `spaceAltitude` raised to 420 m on
  the Moon and Pluto (their mountains reach 267 m and 245 m), and readiness reads
  `world.busy`.

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
   exports). `spaceAltitude = max(atmosphereHeight, 0.2 * radius)` unless the body sets its
   own: earth 800 m, mars 600 m, mercury 440 m, jupiter 1400 m; **moon and pluto 420 m**
   (overrides, because their painted mountains reach 250 m and more). `soiRadius = 4 * radius`.
   Inside a body's sphere of influence the ship's "up" is away from the body; it eases to the
   ecliptic's up only in the outer third.
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
Measured: ground to space in 18.2 s at full throttle and 48 deg (19 to 25 s in the painted
world, where the script flies it at lower frame rates); boarding 1.25 s; stepping out 0.95 s;
landing assist from the prompt to wheels down about 8 s, touching at 1.1 m/s.

Mouse: 0.0023 rad/px on foot, 0.0017 rad/px in the ship.

## Needs from the other

### From PAINTER
1. **Read `docs/lead/REVIEW.md`, review 1.** Three MUST FIX items for your M1: the triangle
   budget (600 k and 350 draw calls at quality 1), stippled foliage, ruler-straight trunks and
   bank. Answer each in your notes.
2. **Terrain ceiling.** Keep all walkable ground (floating islands included) below
   `radius + 0.8 * spaceAltitude(body)` (`import { spaceAltitude } from src/data/bodies.js`).
   `tests/contract.test.mjs` checks it. If a body needs more, tell me and I raise it.
3. **Models (C10).** The cockpit view puts the camera exactly at `userData.seat` looking along
   -Z with a 0.12 m near plane: whatever is in front of that point is what the player sees.
   When the real ship arrives, give it a canopy frame that looks right from there.
4. **`animate(state, dt)`** receives: explorer `{ mode: 'idle'|'walk'|'jet'|'fall'|'wade', speed,
   jet01, lookPitch }`; ship `{ mode: 'landed'|'hover'|'fly'|'pulse', throttle01, gear01,
   canopy01 }`. During boarding the explorer walks to the hatch (mode 'walk') while `canopy01`
   rises to 1 and falls back; then I set the explorer's `visible = false`.
5. **`src/art/ui.css`** and the text helper when you get to them (M3). Class names in use:
   `pc-hud`, `pc-panel`, `pc-button`, `pc-title`, `pc-label`, plus mine: `pc-prompt`,
   `pc-gauge`, `pc-readout`, `pc-reticle`, `pc-start`, `pc-help`, state class `pc-on`.

### From PHYSICS
1. The table promised in COORDINATOR section F: each of your constants, which of my `EXPLORER`
   / `SHIP` numbers it replaces, and which assist you expect me to keep on top.
2. Keep the worst frame of `physics.update` under 2 ms (I measured one of 6.8 ms in 600).
3. `stepExplorerBody` and `stepShipBody` take `env`; so do mine. In M2 I will call yours from
   inside `stepExplorer` and `stepFlight` behind the same `env`, so tell me if `bindEnv` needs
   anything my `env` does not carry (`sample`, `gravity`, and for the ship `up`, `altitude`,
   `spaceAlt`, `hasBody`).

### From the COORDINATOR
- `tools/shot.mjs` has no way to lengthen the screenshot timeout (Playwright's 30 s default);
  the painted forest in software GL can take longer than that for one frame and the tool then
  dies with an unhandled error. A `--shot-timeout ms` option would help all three roles. I
  work around it with `tests/capture.mjs`.

## Answers to the other

- PAINTER asked: **which near/far do I run?** On foot `near 0.08`, cockpit `0.12`, chase camera
  `0.35` rising to `4` with clear air (about 330 m up); `far` is 1.2 x the far side of the
  farthest body: about 1.67e6 m from Earth today, up to about 2.9e6 at Pluto. Reversed depth is
  on wherever `EXT_clip_control` exists (I pass exactly one of the two depth options so three
  does not warn).
- PAINTER asked: **do I call `setTime`?** Never in play. Day and night are the real spin; Earth's
  spin phase is set at boot so the spawn is at 09:30. `setMood.timeOfDay` is the true local
  solar time at the camera; you can ignore it, as you say.
- PAINTER: `sampleObstacles` received, thank you. I will collide the explorer with trunks and
  boulders, keep the cameras out of them, and make the landing assist avoid them in M2.
- PAINTER: your shapes match the contract as I consume it. I pass `sampleSurface` a
  `THREE.Vector3` and copy the result at once, so you may return scratch objects. I call
  `root.updateWorldMatrix(false, false)` on every root and on the sun before `world.update`,
  and `camera.updateMatrixWorld()`; children are left to you and the renderer.
- PAINTER: `setMood` fields every frame: `bodyId` (the body whose frame the camera is in, or
  `null` in deep space), `biomeWeights` (from `sampleSurface` under the camera, `{}` above
  twice the space altitude), `biomeId` (additive, the heaviest), `timeOfDay` (hours),
  `altitude01` (camera height over base radius / spaceAltitude, clamped), `inSpace01`
  (smoothstep from 0.75 to 1.6 x spaceAltitude; 1 in deep space), `speed01` (ship speed / 750,
  or walking speed / 40).
- PAINTER (your idea): agreed, the controller drives `setRenderScale` first and only drops a
  tier after 3 s pinned at the minimum scale (`src/core/dynres.js`).
- PHYSICS: API read. Your density profile reproducing my speed envelope is exactly right.
  Integration is mine from M2; `env` stays the single doorway.
- COORDINATOR: sections F and G read. Lead files are in `docs/lead/`.

## Ideas and critique

- (to PAINTER) The stub shows how much a moving ground texture helps the feel of speed: please
  make sure the wash variation is readable under the explorer's feet at walking speed, or the
  walk will feel like sliding.
- (to PAINTER) From orbit at 5 km the whole globe fits the frame with FOV 62. That frame is
  where "how each planet looks from orbit" will be judged; the terminator crosses the disc.
- (self) The climb from ground to space takes about 18 s. If the painted atmosphere transition
  deserves longer, I will slow `speedAtmoTop` rather than thicken the atmosphere.
- (to PAINTER) The explorer placeholder's hat is charming; keep a silhouette that readable.
- (to PHYSICS) A plain 2D canvas in `physics-lab.html` that plots the wind field, a gust front
  and a footprint trail would let the rest of us see your work without the painter in the loop.
