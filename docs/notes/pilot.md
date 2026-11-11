# PILOT notes

Branch: `cosmos` (shared with PAINTER and PHYSICS, one working tree). Commits: `tools/commit.sh pilot`.

## Handover (read this first if you are a fresh PILOT)

Kept current by the second PILOT agent (2026-11-11, the run after M3). Everything below is true
at the commit that contains this section.

**How to work here.** Read `docs/COORDINATOR.md` (sections A to G and the log in E), then this
file, then `docs/lead/TRACK.md` and `docs/lead/REVIEW.md`. One shared branch (`cosmos`), one
working tree, three roles. Commit only with `tools/commit.sh pilot "msg"` (it pushes). Never
edit `src/render`, `src/world`, `src/art`, `src/physics`, `gallery.html`, `physics-lab.html`,
`tools/`, or the other roles' notes. Scratch files go in `/home/user/.pc-scratch/pilot/`.
You are also the LEAD: `docs/lead/REFERENCES.md` (checks), `REVIEW.md` (dated reviews with
evidence you ran yourself), `TRACK.md` (the path to done). Read long files by section, keep
command output short: two PILOT agents' worth of context has gone into this role already.

**The code in one paragraph.** `src/core/sim.js` is the whole game as pure logic (no three, no
DOM): state machine (`state.js`), explorer (`src/player/explorer.js`), cameras
(`src/player/camera.js`), ship (`src/ship/flight.js`), pulse (`src/ship/pulse.js`), frames and
floating origin (`frames.js`), orbits (`orbits.js`), save (`save.js`), the sketchbook's
pictures (`sketches.js`). `src/core/game.js` presents it with three (places roots, models,
camera; markers, HUD, audio, map, sketchbook, sketch capture). `src/core/providers.js`
switches between my stubs (`src/core/stubs/`) and the real modules; `src/main.js` boots.
`src/ui/` is the HUD (`hud.js`), the map, the sketchbook (`book.js`) and the look
(`fallback.css`). `src/audio/audio.js` is all sound. Tests in `tests/` run the pure simulation
in Node and the real page in headless Chromium; `window.__pc` is the debug door (`info()`,
`teleport()`, `settle()`).

**Every check** (run all of them before claiming anything; numbers from this run are under
"Ground truth"):
`node --test tests/*.test.mjs` (98), `node --test src/physics/`, `node --test src/world/*.test.mjs`,
`node tests/playthrough.mjs` (add `--query "stub=render,world,art&fresh=1"` for PHYSICS on,
`--query "scale=0.5&quality=0&fresh=1" --w 400 --h 225` run from a clean export for the painted
world), `node tests/trip.mjs` (painted: `--query "scale=0.5&quality=0" --w 400 --h 225`; do
NOT add `fresh=1`, the script does), `node tests/m3check.mjs`, `node tests/lockcheck.mjs`,
`node tests/audiocheck.mjs` (the sound, measured), `node tests/tour.mjs --bodies <one body>`
(one body per process; `--sheets <dir>` to keep trial sheets out of `docs/lead/evidence`).
Test other roles' committed state from a clean export: `tools/export-head.sh <dir>`, then run
the scripts inside `<dir>` (they serve the directory they live in). Software GL paints the
forest at one to three frames a second: the scripts wait in game time, so slow is fine, but
two browser runs at once on this machine make each other flaky.

**Unfinished, and where each item starts.**
1. *Review 4* (lead), when the coordinator says PAINTER has reported: what to measure is
   written at the top of `docs/lead/REVIEW.md` ("Review 4: what will be measured"). The tour
   is ready for it. M2 as a whole closes when review 4 has no MUST FIX.
2. *The painted UI theme is PILOT's now* (coordinator ruling, 2026-11-11): art-bible rule 8,
   built under `src/ui/**`, all in code: torn paper panels with grain, ink-and-wash icons,
   hand-lettered type (a stroke font, not a system italic), painted planet markers, a painted
   cursor and loading state, the sketchbook pages. Legible on paper and on indigo; no shimmer.
   Colours from `src/data/looks.js`. Evidence frames go in `docs/shots/pilot/`; PAINTER reviews
   the look in its notes and I change what it asks. State of it: see "Status".
3. *Touchdown on the legs*: the landing assist still sets the hull on the floor and then hands
   it to the gear (`stepLanding` in `flight.js`, `Sim.stepParked`). The complete recipe is in
   `docs/notes/physics.md` ("Open on your side"). Plan: in `Sim.step` (LANDING), when
   `stepLanding` reports the hull about 1 m up over a dry site, switch to
   `physics.ship.gear(sh, { lift01: 1, hold: up * -0.6 })` until `sh.phys.contacts > 0`, then
   dispatch touchdown with `sh.lift01 = 1` (`stepParked` already fades it over 1.5 s). Afloat
   and without PHYSICS keep today's path. Re-run `tests/contract.test.mjs` (40 landings).
4. *Gamepad* ("if cheap" in the brief): not started. Plan: a pure `src/core/gamepad.js` that
   turns `navigator.getGamepads()[0]` into the same axes, held keys and edges `Input` already
   gives (left stick WASD, right stick look, A Space, B C, X E, Y V, LB X, RB F, triggers
   throttle in the ship and run on foot, Back M, Start H, d-pad up B), polled in `Input.take`.
5. *Pulse profile*: swap my spooled acceleration (`src/ship/pulse.js`) for PHYSICS'
   `planSpeedChange` once the painted pulse effect exists to judge it against.
6. *M4*: critique swap, every check, one pull request `cosmos` -> `main` through the REST API
   (the exact `gh api` calls are in `docs/COORDINATOR.md` section E), then GitHub Pages from
   `main`. `index.html` uses only relative URLs; keep it so. Not before the coordinator says.
7. *Never verified here*: frame rate on a real GPU (the ` read-out exists for the owner),
   pointer lock with a real hand (the fallback is proven by `tests/lockcheck.mjs`), and how
   the sound actually sounds (it is measured, not heard).

## Status

**This run (second PILOT agent): ground truth re-established; the coordinator's four review
items answered; the painted UI theme taken over.** M1 met. M2: my half accepted, the whole
open until review 4. M3: my half in place and extended (below). I am also the LEAD DEVELOPER:
`docs/lead/REFERENCES.md`, `REVIEW.md`, `TRACK.md`.

### Ground truth (every check, run by me on clean exports; 2026-11-11)

| Check | Tree | Result |
| --- | --- | --- |
| `node --test tests/*.test.mjs` | export of `e17a917` | 93 pass (98 now, with the sketch store's five) |
| `node --test src/physics/` | same | 190 pass |
| `node --test src/world/*.test.mjs` | same | 17 pass |
| `node tests/playthrough.mjs` (stubs, kinematic) | same | PASSED, 37 checks |
| the same with PHYSICS (`stub=render,world,art&fresh=1`) | same | PASSED, 37 checks |
| the same in the painted world (400x225, `scale=0.5&quality=0`) | same | PASSED, 37 checks, no console errors |
| `node tests/trip.mjs` (stub visuals, PHYSICS) | same | PASSED, 47 checks (Earth, Mars, Saturn, reload from the save) |
| the trip in the painted world (400x225) | same | 45 of 47: Earth to Mars to Saturn flown, landed and walked (460 km in 68 s, 888 km in 95.2 s; `honey_mist`), autosave written. The two failures were mine: I passed `fresh=1` in the query, so the reload at the end forgot the save. The script now strips it. |
| the painted trip again | export of `a46647f` | FAILED on Saturn: E was pressed as the prompt went out over rough ground (two frames a second, two browsers running), nothing happened, and the script flew on. Not a landing fault (see the survey below), but a real paper cut: fixed in the game (the prompt has hysteresis, E without it says why) and in the script (it presses E like a player, again if needed). Not yet re-run after the fix. |
| `node tests/m3check.mjs` | export of `e17a917`; working tree after the sketchbook | PASSED, 17 checks; 26 checks now |
| `node tests/lockcheck.mjs` | export of `e17a917` | PASSED, 7 checks |
| `node tests/audiocheck.mjs` | working tree | PASSED (table under "Audio, measured") |
| landing survey (scratch `run2/landsurvey.mjs`: 24 spots a body, PHYSICS on, PAINTER's committed world) | export of `a46647f` | 235 of 240 land from a 55 m hover (3 "too steep" on alpine and lilac mountains, 2 "no level ground" at a crater and a storm wall, all said on screen); median 6.2 s, touchdown 1.12 m/s |
| `node tests/tour.mjs --bodies earth` (painted, 960x540, quality 1) | export of `a46647f` | every biome frame NOT SETTLED after 90 s (`world.busy` 267 to 412; `world.update` worst 56 to 84 ms on a loaded machine). PAINTER's `world.busy` fix is not in its committed state yet: for review 4. |

### What this run added (answers to the coordinator's review of my domain)

- **The tour stands where the game sends the player** (`tests/tour.mjs`). For every body:
  each biome on dry, gentle ground of that biome (the world's own place for it, checked
  against `sampleSurface`, moved to the nearest standable spot within 400 m if it is not one,
  and the sheet says so); each vista of `world.getVistas` on its own spot, facing the
  painter's yaw and pitch when the world gives them (a vista that is the same place and
  heading as a biome frame shares the frame); one frame from orbit. Every frame waits for
  `world.busy === 0` for ten frames in a row (limit `--settle`, default 120 s); the sheet's
  header and each caption say in capitals when a frame did NOT settle, when the explorer is
  standing in liquid, when a vista is on a slope or was not counted as found, and each
  caption carries triangles, draw calls and the worst `world.update` of the last 90 frames.
  A `.json` with the same numbers lies beside each sheet. `Sim.teleport` takes `heading`,
  `lookPitch`, `firstPerson`; the read-out and `info().stats` carry `world.update`'s worst
  frame. Verified on the stub (5 frames, sheet read) and on the painted Earth (running).
- **The sketchbook is a sketchbook.** When a landscape is first walked (2.5 s in, once the
  world has settled) or a view is found, the frame that has just been painted is kept as a
  192x108 JPEG (`Game.captureSketch`, read from the canvas right after `painter.render`).
  It appears at once on a slip of paper at the top right with its name and "page 7 of 124",
  with a pencil sound; B opens the book at the world you are on: a tab per world with its
  count, a page with a sketch for every landscape walked and view found and an empty dashed
  frame, named, for each one still to find; arrow keys turn the pages. Pictures live beside
  the save in their own key (`painted-cosmos.sketches`, `src/core/sketches.js`), so a full
  storage can cost a picture but never the player's place: 16 000 characters at most each,
  1.5 M in all (about 1 MB when all 124 pages are drawn), oldest dropped first, every storage
  call inside try/catch, `?fresh=1` clears them, `?save=0` keeps them in memory. A page with
  no picture (an older save, a full storage) is drawn the next time the explorer stands
  there. Verified: `tests/sketches.test.mjs` (5), `m3check` (sketch is 192x108 with real
  variation, shown, stored, in the book, kept across a reload).
- **The title card** is the loading screen now: the card sits on the bare sheet from the first
  moment with "preparing the paper..." as its own status line, which becomes "click to begin";
  ink on nearly opaque paper; fitted to the window by its measured size. Verified by frames
  at 960x540 (loading) and 640x360 (ready). Nothing overlaps.
- **Audio, measured** (`tests/audiocheck.mjs`): see the table below. What the numbers found
  and what changed: footsteps were 20 dB under the bed (inaudible); the parked ship hummed
  louder than a calm morning; 88 % of the ship's energy was under 120 Hz (small speakers
  would carry none of it); the jetpack was quieter than a breeze; the pad peaked at -49 dBFS;
  noise loops had a half-second dip every 5 to 7 s. All retuned; loops are seamless
  (equal-power cross-fade, 11 and 17 s); nothing clips, no DC, no clicks, peak -5.3 dBFS.
- **Rain follows PHYSICS**: `sky.rain` (liquid only; snow is silent), brighter in a wood
  (`cover.canopy01`), far off with the hull drumming when standing under the ship or sitting
  in it, drips while the wood drains (`particles.system.dripping`), thunder on the
  count-down crossing zero at `thunder01`'s loudness, footsteps by `st.phys.material`.
- **Landing**: the prompt keeps 15 m and 10 m/s of hysteresis so it does not flicker over
  rough ground; E without the prompt says "Come down below 90 m to land" or "Slow down to
  land" instead of nothing.

### Audio, measured (OfflineAudioContext through the game's graph; 44.1 kHz; last 8 s)

| situation | peak dBFS | RMS dBFS | note |
| --- | --- | --- | --- |
| calm morning on foot | -26.3 | -38.6 | the bed |
| wind 12 m/s, gusting | -12.5 | -26.1 | |
| gale 22 m/s | -8.4 | -21.3 | |
| heavy rain, open ground | -7.3 | -19.9 | level steady within 0.9 dB (no loop dip) |
| heavy rain in a wood | -10.5 | -23.0 | brighter (centroid 5.4 kHz against 1.9) |
| heavy rain, under the hull | -12.6 | -25.6 | 5.7 dB quieter, lower (1.2 kHz) |
| the wood dripping | -19.7 | -37.5 | drips 6.6 dB over the bed's peaks |
| thunderstorm | -5.4 | -18.5 | thunder at 8 s |
| walking (grass, rock, snow) | -19 to -21 | -37 | steps 5 to 9 dB over the bed's peaks |
| jetpack | -12.2 | -24.5 | |
| ship parked | -29.2 | -40.9 | was -31 |
| ship, full throttle | -9.6 | -20.5 | 23 % under 120 Hz (was 64 %) |
| ship in space | -11.5 | -21.8 | |
| pulse drive | -8.0 | -17.8 | |
| the Moon, standing | silent | silent | no air, no sound |
| the pad at its fullest | -21.4 | -30.4 | was -49 |
| interface sounds | -18.6 | | paper, brush, found, land, bounce |
| everything at once | -5.3 | -16.9 | under the -3 dBFS limit of R-AUD-3 |

No clipped samples, DC under 6e-5, largest sample step within 3.8 x the 99.9th percentile
(no clicks) in every situation, including hard cuts between situations. Every gain change is
`setTargetAtTime` or a ramp from zero (read in the code and measured). Not verified: how it
sounds to an ear. The levels are now defensible; whether the timbres please is still unknown.

What M3 added earlier (first PILOT agent):
- **Vistas**: walking within 14 m of a vista's spot on foot finds it: a line on screen, a
  three-note chime, `world.setVistaFound(body, id, true)`, and an immediate save.
- **Audio** (`src/audio/audio.js`, WebAudio, no files): wind bed from `physics.here.air`,
  rain, thunder, the ship, the jetpack, footsteps, a pad per planet that breathes over about
  100 s, paper and brush sounds. Starts on the first click or key. `?audio=0` is silence.
- **Help**: H shows the title card again as the help card.
- **HUD legibility**: read-outs, gauges, notices and marker labels on slips of paper.
- **Looking around**: until the player has looked once, a line at the top says how.
- **Weak GPUs**: the game starts at quality 1 and render scale 0.75 and climbs.

What M2 added:
- **Pulse drive** (`src/ship/pulse.js`): F in space. Accelerates at 400 m/s2 along the nose,
  brakes by itself, and lets go at cruise speed on the "arrival sphere" of whatever is ahead
  (centre distance = radius + max(3 x spaceAltitude, 1.2 x radius): the planet then spans about
  55 degrees). It will not enter any body's sphere or the sun's, refuses to start toward the
  planet you are orbiting, and draws the nose onto the chosen target at 0.6 rad/s. Earth to
  Mars (461 km): 68 s, peak 12.6 km/s. Mars to Saturn (887 km): 96 s, peak 17.5 km/s.
- **Targets and markers**: the body nearest the nose (within 15 degrees) becomes the target; a
  target chosen on the map stays chosen. In flight each world is ringed where it is in the sky;
  the target shows name, distance and pulse time, or an arrow at the edge when off screen.
- **Planet map** (`src/ui/map.js`, M): click a world or use the arrow keys to set a course.
- **Save** (`src/core/save.js`): localStorage, every access inside try/catch. Written on
  touchdown, on stepping out and every 20 s on foot (never in the air, never in flight).
  `?fresh=1` forgets it, `?save=0` never writes.
- **PHYSICS wired in** (COORDINATOR C14, PHYSICS' guide): see Decisions 10.
- **Trees**: solid for the explorer and the camera boom; landing sites keep 6 m clear of them;
  the flying ship rides above the canopy.
- **Pointer-lock fallback**: if the lock is refused or reports nonsense, the game drops the
  lock, says "hold the left button and drag to look" on screen, and carries on.
- **Frame read-out**: the ` key or `?stats=1`: frame ms, worst recent frame, fps, triangles,
  draw calls, render scale, quality tier, `world.update` ms (and its worst), `physics.update`.

### Verified (how), first PILOT agent's record
M3 (latest first):
- `node --test tests/*.test.mjs`: 93 pass (adds: a vista found once, listed in the sketchbook
  and restored from a save).
- `node tests/m3check.mjs` (real browser, stub visuals, PHYSICS on): PASSED, 17 checks: starts
  at tier 1 and reduced scale, title card, no sound before the first gesture, the look hint
  appears and goes after the first look, audio context running with a sane mix, B and H
  panels, a vista found by walking to it, announced and saved.
- With all M3 code and the last flight changes (per-world pace, settling on C):
  `node tests/playthrough.mjs` (kinematic) PASSED; the same with PHYSICS PASSED;
  `node tests/trip.mjs` (Earth, Mars, Saturn, reload from save) PASSED.
- `node tests/tour.mjs` on a clean export (PAINTER's state at `19e9599`, before the fresh
  PAINTER's pass): contact sheets for all ten bodies in `docs/lead/evidence/tour-<body>.jpg`,
  42 frames, no console errors on any body. Most frames are marked "(unsettled)":
  `world.busy` did not return to 0 within 60 to 75 s after a teleport. In one long process the
  browser refused a capture after about 40 minutes (twice, on Mercury and on the Moon); run
  alone, both bodies capture fine, so the tour is now run one body per process.
- Not verified: nobody has *heard* the audio; the tour sheets have not been judged yet (that
  is review 4, after the fresh PAINTER reports).

M2 and before:
- `node --test tests/*.test.mjs`: 92 pass. Beyond M1's set: pulse advice and speed profile; the
  Earth-Mars-Saturn trip in the pure simulation on stubs (lift off, map target, aim, pulse,
  land, step out, twice); the same trip on PAINTER's real worlds with PHYSICS and the real
  obstacles (lands in `dry_riverbeds` and `crystal_reeds`); save round trip, bad saves, a
  storage that throws; the M1 loop, a full-throttle dive on three bodies, the landing gear and
  the start/stop assist through PHYSICS' models; trunk collision and a low pass over the real
  forest (hull above every tree top).
- Landing anywhere: `tests/contract.test.mjs` sets the ship down at the spawn and at three
  other places on **each of the ten bodies** (40 landings in 28 biomes on PAINTER's real
  worlds, PHYSICS on; three of them afloat on Jupiter's and Neptune's liquid), checks a soft
  touchdown, that the parked ship stays put and upright on its gear, and that the explorer
  steps out and walks.
- `node --test src/physics/` and `node --test src/world/*.test.mjs`: run by me at each sync
  (PAINTER 12 pass; PHYSICS 125 pass at `b0ad22b`, 7 of 154 failing in its uncommitted P2
  working tree after the restart: its to fix, reported in REVIEW 3).
- `node tests/playthrough.mjs --keep` (stub world, kinematic): PASSED, 37 checks.
- `node tests/playthrough.mjs --query "stub=render,world,art&fresh=1"` (stub visuals, PHYSICS
  on): PASSED, 37 checks.
- `node tests/trip.mjs --keep` (stub visuals, PHYSICS on, real key and mouse events): PASSED.
  Earth to Mars to Saturn in one page load: map click, marker, pulse (461 km in 67.6 s, 888 km
  in 95.4 s), landing, sketchbook, frame read-out, then a reload that continues on Saturn from
  the save. 400 s of game time.
- The same trip **inside the painted worlds** (`--query "scale=0.5&quality=0" --w 400 --h 225
  --root <clean export of the fix commit>`; PAINTER's render, world and art, PHYSICS on):
  PASSED, no console errors. Landed in `dry_riverbeds` on Mars and `crystal_reeds` on Saturn;
  the reload continued on Saturn. `docs/shots/pilot/real-03-mars.jpg` is from this run.
- The M1 loop inside the painted forest with PHYSICS and the canopy cushion (clean export of
  `ee4c336`, `scale=0.5&quality=0`, 400x225): PASSED, 37 checks. After lift-off the read-out
  says 3.7 m, not 9: height is now measured from the floor the ship rides on, and in the
  clearing that is PAINTER's canopy field.
- The M1 loop on stubs with PHYSICS and its field brake (`cmd.brake`): PASSED, 37 checks.
- The painted trip at 960x540 and quality 1 (the coordinator's evidence request): see
  "Painted trip at 960x540" at the end of this section.
- `node tests/lockcheck.mjs`: PASSED. Headless Chromium grants pointer lock and then reports
  nonsense; the game fell back to drag-look, said so, and the view moved 0.14 rad at most.
- Evidence: `docs/shots/pilot/01-on-foot`, `02-jetpack`, `10-land-prompt` (M1 loop on stubs),
  `real-01-on-foot`, `real-02-orbit`, `real-03-mars` (painted worlds), `m2-map`, `m2-target`,
  `m2-pulse`, `m2-mars`, `m2-saturn`, `m2-stats` (the trip on stubs) (.jpg).

**Painted trip at 960x540, quality 1** (the coordinator's evidence request; clean export of
`b716e22`, PAINTER's render, world and art, PHYSICS on): Earth to Mars to Saturn in one page
load, every check passed through both legs (map click, marker, pulse 459 km in 70.7 s and
888 km in 94.9 s, landed and stepped out in `dry_riverbeds` and `honey_mist`, sketchbook,
frame read-out: 404 k triangles and 212 draw calls on Saturn, autosave). The last step, the
reload that continues from the save, hit Playwright's 30 s navigation limit (the painted page
takes longer than that to load at two seconds a frame in software GL); the script now allows
for it, and the same reload-and-continue check passed in the painted world at 400x225.
A first attempt at 960x540 failed on Saturn's approach with the older script (the throttle
overshoot at 2 fps described above). The six `m2-*.jpg` frames in `docs/shots/pilot/` are from
the passing run.

After PHYSICS' P2 requests and the feel changes (gear lift-off, default seed, throttle, carve,
gentler fall, landing assist and walls): `node --test tests/*.test.mjs` 92 pass;
`node tests/playthrough.mjs --query "stub=render,world,art&fresh=1"` PASSED (hover 9.8 m after
the gear lift-off); `node tests/trip.mjs` on stubs with PHYSICS PASSED (354 s of game time).
Not re-run after those last changes: the painted-world browser runs (they take 15 to 40
minutes each); the Node tests fly the same trip and the 40 landings on the real worlds.

### Not verified / not done
- Real-GPU frame rate: cannot be measured here. The read-out exists so the owner can read it.
- PAINTER is doing a second pass on every planet's landforms: the landings, arrival points and
  the trip must be re-run when it lands (`node --test tests/contract.test.mjs` does the first
  two in seconds). On its current working tree: 39 of 40 landings, and one honest refusal at a
  ledge on Jupiter ("No level ground here").
- Pointer lock with a real hand: the fallback is proven, the happy path is not.
- The painted trip in a browser at watchable quality: software GL paints a few frames a
  second, so the scripted runs use a small window and low internal resolution.
- Planet markers are DOM rings with the fallback look, not painted marks.
- Touchdown is still my assist setting the hull on the floor and then handing it to the gear
  (not PHYSICS' last-metre descent on the legs).
- Audio, sketchbook screen, vistas, title screen, painted HUD: M3.

### What I saw playing the slice in the painted world
- It works on first contact: spawn in the clearing by the brook at 09:30, the ship 16 m away,
  walk, jetpack over the trees, board, climb out through a sky that turns to indigo wash,
  the planet as a painted ball below, back down, land, step out. One flag flip to integrate.
- Ugly or clunky, blunt list (details and evidence in `docs/lead/REVIEW.md`): the forest costs
  4.4 M triangles a frame; foliage is stippled rather than brushed; trunks and the brook bank
  are ruler-straight; the foreground is one flat wash; I walk and fly straight through trees;
  (fixed for the explorer, the camera and landing sites since; the flying ship still passes
  through crowns); my HUD ink needed a halo to survive space.
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

10. **How PHYSICS is wired** (its guide in `docs/notes/physics.md`; the mapping I chose):
    - One `createPhysics({ sampleSurface, seed: 1 })`; `warmUp` behind the loading sheet;
      `physics.update(dt, { bodyId, time, focus, sunDir, disturbers })` once a frame in
      `Sim.frame`, before `world.update`; `world.setPhysics(physics)` once. `?stub=physics`
      turns it all off and the kinematic rules below take over (they are also what every
      M1 test still runs against).
    - Explorer: keys become `cmd = { wish (4.2 or 7.4 m/s along the wished direction), jump,
      jet, jetMaxRise, assistAccel: 4, descentLimit }`; `stepExplorerBody` does the rest.
      My numbers that are now only fallbacks: `groundAccel`, `airAccel`, `jetAirAccel`,
      `maxSlope`, `slideSlope`, `slideSpeed`, `stepDown`, the wading factors. Kept as assists:
      the climb governor (8.5 m/s, raised up to 17 m/s in light gravity), the descent brake
      (24 m/s terminal, easing to 7 m/s over the last metres), `assistAccel` 4 m/s2 for
      starting and stopping, fuel rules, facing.
    - Ship in the air and accelerating in space: my steering, speed envelope and assists make
      a target velocity; `stepShipBody(st, { target, tau, hover: true, boost, carve01 })`
      flies it, with `carve01 = smoothstep(40, 120, speed)` (PHYSICS' suggestion: mass at low
      speed, on the nose at high speed). Cushion, pull-up and flare shape the *target*; when the hull sinks faster than
      the cushion allows, `tau` drops to 0.22 s so the computer closes the error at once.
      The cushion now also plans with a deceleration (6.5 m/s2) at any height, because a hull
      with mass needs room to stop.
    - In vacuum X or throttling down brakes with the drive field: PHYSICS' `cmd.brake: 1`
      (up to 160 m/s2, only ever slowing), which replaced my own special case. In air the
      brake is off and the ship stops on its thrusters.
    - Parked ship: `stepShipGear` (legs settle the hull, then sleep). Landing sites: friction
      (`tan(slope) < 0.8 x ground friction`) instead of `landMaxSlope`. Afloat: my own rest.
    - Lift-off: PHYSICS' gear (the legs unload over 1.2 s, the feet leave), then its body
      with my vertical target. Afloat or without PHYSICS: my 2.8 s rise.
    - The landing assist's glide and descent and the pulse drive are still mine. The assist
      now treats a wall met while gliding as a wall, not a touchdown: it sets down there if
      the ground is level, and otherwise hands the ship back hovering and says so.
11. **Pulse drive is a field, not thrust.** 400 m/s2 would be 40 g; the fiction is the same
    field that carries the hull's weight in hover. Its speed profile is mine (smoothly spooled
    acceleration, braking curve to the arrival sphere); PHYSICS' jerk-limited planner
    (`planSpeedChange`) is the natural replacement and I will swap it in when the painted
    pulse effect exists to judge it against.

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
(X brake: 0.45 x); throttle 0.8 /s; nose follows the mouse at 7.5 /s up to 1.6 rad/s; bank
0.55 rad per rad/s up to 0.62 rad; lift-off 2.8 s to a 9 m hover; landing glide 14 m/s,
descent 13 m/s easing to 1.1 m/s at touchdown, refuses sites steeper than 35 deg.
Measured: ground to space in 18.2 s at full throttle and 48 deg (19 to 25 s in the painted
world, where the script flies it at lower frame rates); boarding 1.25 s; stepping out 0.95 s;
landing assist from the prompt to wheels down about 8 s, touching at 1.1 m/s.

Mouse: 0.0023 rad/px on foot, 0.0017 rad/px in the ship.

Pulse (`src/ship/pulse.js` PULSE): top speed 30 km/s, 400 m/s2, spool 0.9 s, lets go at
820 m/s, steering at 0.3 x, target assist 0.6 rad/s, aim cone 15 degrees. Default boom is now
6.4 m (was 5.6) while the explorer is a placeholder (PAINTER's request).

## Needs from the other

### From PAINTER
(Written to be read cold by the fresh PAINTER. The contract is `docs/COORDINATOR.md` C1 to C14;
this is what the game consumes today and what is open.)

What I call, every frame, in this order: place `world.sun` and every root in `world.bodies`
(the camera is always at the scene origin; never use `camera.position` as a place on a
planet); `physics.update`; `world.update(dt, camera.position, activeBodyId)`;
`painter.setMood({ bodyId, biomeWeights, biomeId, timeOfDay, altitude01, inSpace01, speed01, sky })`
(`sky` is additive since 2026-11-11: PHYSICS' `physics.here.sky`, eleven numbers from 0 to 1:
`cloud`, `overcast`, `haze`, `fog`, `dust`, `wet`, `snow`, `rain`, `snowfall`, `storm`, `flash`;
`null` in space or with physics off);
`painter.render(scene, camera, dt)`. Once: `world.setPhysics(physics)`. Also used:
`sampleSurface` (I read `radius`, `normal`, `slope`, `liquidRadius`, `biomeId`, `biomeWeights`,
`canopyHeight`), `getSpawn`, `sampleObstacles(bodyId, dir, radius)` (radius 45 m or less),
`getVistas`, `setVistaFound`, `getBiomes`, `findBiome`, `busy`, `setBuildBudget`,
`createExplorer` / `createShip` with `userData.seat` and `userData.hatch`.

Open, most important first:
1. **Cost on every planet** (REVIEW 3, MUST FIX 1): Neptune's spawn measured 727 k triangles at
   quality 1 against a budget of 600 k and 350 draw calls (300 k at quality 0, 1.2 M at
   quality 2). Measure in the integrated game with the read-out (` key, or
   `index.html?stats=1&quality=1&dynres=0`), not only in the gallery.
2. **`world.busy` must reach 0** when the view is built, also after the camera has moved to
   another body. It is my readiness signal (`window.__pcReady`, `__pc.settle()`), and the tour
   waits on it: a frame that never settles is captured after 75 s and marked "(unsettled)".
3. **`world.update` inside 5 ms a frame** while building (REVIEW 3 measured 8.5 to 9.4 ms on
   Mercury, Mars and Neptune right after arrival).
4. **Terrain ceiling**: keep walkable ground below `radius + 0.8 x spaceAltitude(body)`
   (`src/data/bodies.js`; `tests/contract.test.mjs` checks it). Tell me if a body needs more.
5. **Liquid edges**: where a biome's liquid ends against a neighbour without one, the liquid
   surface must come down to the ground, not stop as a wall. The landing assist now treats a
   wall as a wall, but an explorer wading into one is in trouble.
6. **When landforms change, spawns may move**: `getSpawn(body)` must stay dry, with a slope
   under 20 degrees and room for a 9 m ship 16 m away (also checked by the contract test).
7a. **Vistas, yaw and pitch**: seen in your working tree and used already: the tour faces
    `yaw` (from local north toward east) and `pitch` of a vista or of `findBiome`'s easel when
    they are there. Thank you; keep them.
7. **Vistas**: I find one when the explorer is within 14 m of `unitDir` on foot. Put them where
   a walker can stand (not on a cliff face or under liquid), and paint the marker so it can be
   seen from about 100 m. `setVistaFound(body, id, true)` is called at once and again after a
   load.
8. (Withdrawn: painted markers are PILOT's now, by the coordinator's ruling of 2026-11-11.)
9. **Pulse**: in PULSE `setMood.speed01` is 1 and the ship's `animate` mode is `'pulse'`:
   streak and soften the far washes.
10. (Withdrawn, same ruling: the painted UI theme is built under `src/ui/`.) In its place:
    **please review the theme's look** from the frames in `docs/shots/pilot/ui-*.jpg` and say
    in your notes what to change; look is your call and I change what you ask.
11. **Real models**: the cockpit view puts the camera at `userData.seat` looking along -Z with
    a 0.12 m near plane; `animate` receives explorer `{ mode: 'idle'|'walk'|'jet'|'fall'|'wade',
    speed, jet01, lookPitch }` (the "walk" is a 4.2 m/s jog) and ship `{ mode: 'landed'|'hover'|
    'fly'|'pulse', throttle01, gear01, canopy01 }`.

### From PHYSICS
(Written to be read cold by the fresh PHYSICS.)

What I call: `createPhysics({ sampleSurface })` (your default seed), `warmUp` while loading,
`physics.update(dt, { bodyId, time, focus, sunDir, disturbers })` once a frame before
`world.update`, `world.setPhysics(physics)` once; `bindEnv` for the explorer and the ship;
`stepExplorerBody` with `{ wish, jump, jet, jetMaxRise, assistAccel: 4, descentLimit }`;
`stepShipBody` with `{ target, tau, hover: true, boost, carve01: smoothstep(20, 70, speed),
brake: 1 in vacuum, 0 in air }`; `stepShipGear` for the parked ship and for the first half of
lift-off (`lift01` rising over 1.2 s, `hold = up x 4.2 x lift01`, hand over at `contacts === 0`);
`physics.ground(...).friction` to accept landing sites; `physics.here` for audio;
`physics.here.sky` passed on to PAINTER as `setMood({ ..., sky })`.

Answered (so you need not ask again):
- **Per-world flight envelope**: taken. My commanded speeds scale with the fourth root of how
  thin the body's air is against Earth's, from your `ATMOSPHERES[id].rho0`
  (`env.speedScale` in `Sim.flightEnv`, used in `stepFlight`): Mars and airless bodies 1.6 x,
  Jupiter 1.25 x, Earth 1, Venus 0.75 x; it fades out above the space altitude.
- **Slow descent on C**: fixed. Settling by hand now lands under the hull unless that ground
  cannot hold the ship (`here` in `findLandingSite`).
- First second of throttle (now 0.8/s), speed lost in a turn (carve ramp 20 to 70 m/s), exact
  hover (your `buffetAngle` on the drawn hull), the jetpack fall (descent brake gathers it in
  earlier): all in "Answers to the other".

Open:
1. The last metre of a landing on the legs is not wired (Handover item 4).
2. `stepShipBody` and `stepExplorerBody` move `st.p` in place; I keep the starting point by
   value. Keep that documented.
3. Under load in the browser the read-out shows a worst `physics.update` frame of about 5 ms
   (0.3 to 0.6 ms average). It wants one look on a quiet machine.
4. Draw kits: my four conditions (pure core stays three-free; body-local placement; at most
   60 k triangles and 12 draw calls; draw order is PAINTER's) are upheld by the coordinator.

### From the COORDINATOR
Nothing open. (`--shot-timeout` arrived in `1087406`; thank you.)

## Answers to the other

- PAINTER asked: **which near/far do I run?** On foot `near 0.08`, cockpit `0.12`, chase camera
  `0.35` rising to `4` with clear air (about 330 m up); `far` is 1.2 x the far side of the
  farthest body: about 1.67e6 m from Earth today, up to about 2.9e6 at Pluto. Reversed depth is
  on wherever `EXT_clip_control` exists (I pass exactly one of the two depth options so three
  does not warn).
- PAINTER asked: **do I call `setTime`?** Never in play. Day and night are the real spin; Earth's
  spin phase is set at boot so the spawn is at 09:30. `setMood.timeOfDay` is the true local
  solar time at the camera; you can ignore it, as you say.
- PAINTER: `sampleObstacles` received, thank you, and wired the same day (commit after
  `19f72ce`): the explorer slides round trunks and boulders (cylinders of `radius` up to
  `height`), the camera boom stops in front of trunks taller than its pivot, and the landing
  assist scores sites by how many obstacles stand within 6 m. I query it once a frame with a
  9 m radius on foot and once per landing with 80 m. For the flying ship I would like one more
  number: the canopy height under a point (`canopyHeight` in your ground data, or a
  `height` I can treat as a floor), so the cushion can ride over the trees instead of through.
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
- PHYSICS (your review of my wiring at `0467427`: warmUp missing, carve01, gear unused): all
  three are in now (`warmUp` at boot, `carve01: 1`, `stepShipGear` for the parked ship).
- PHYSICS (your critique of my domain), point by point:
  1. "26 m/s2 is 2.7 g, the explorer starts and stops like a cursor." Agreed, and gone: with
     you wired in the legs are yours (9 m/s2, 1600 W, friction from the ground). I kept a
     named 4 m/s2 of `assistAccel` because 0.6 s and 1.2 m to stop felt like wading; with it
     the start is under 0.5 s and the stop under 1 s (`tests/physics.test.mjs`). Ice and mud
     stay as bad as you make them.
  2. "The ship's velocity is a low-pass of a wish, every planet flies the same, landing is a
     snap." Agreed for the air: it now flies through `stepShipBody` with gravity, drag, wind
     and spool, and stands on `stepShipGear`. Not agreed for one thing: braking in vacuum on
     14 m/s2 of retro thrust means over a minute to stop, and a ship that will not stop is a
     ship the player fights. I brake with the drive field there (Decisions 10). If you give
     `stepShipBody` a `brake` command with a named field deceleration I will use yours.
  3. "4.2 m/s is a jog." True, and deliberate: the planets are 4 km across and the pace is
     the pace of the game, not of a hike. I keep 4.2 and 7.4 as commands and will ask PAINTER
     to animate the lower one as a jog. The checks that assumed a walking body are rewritten
     in `REFERENCES.md` ("revised").
- PHYSICS (P2 requests): both done. `createPhysics` is called without a seed (your default
  18: weather at the real spawn). Lift-off goes through the gear exactly as in your step 5:
  `wakeShip`, `stepShipGear` with `lift01` rising over 1.2 s and `hold = up x 4.2 x lift01`
  until `contacts === 0`, then `stepShipBody` with a vertical target that eases off toward the
  9 m hover (`Sim.stepGearLiftoff`, `flight.js`). Tested on Earth, the Moon and Jupiter.
- PHYSICS (your P2 critique of my domain):
  1. "The first second of throttle is dead." Fair: 0.55/s meant a quarter throttle after half
     a second. Now 0.8/s.
  2. "A 90 degree turn at cruise costs 37% of speed." That was the carve ramp I took from you
     (40 to 120 m/s). Now 20 to 70 m/s: mass at hover and landing speeds, on the nose from
     70 m/s up, so the turn costs heading, not speed.
  3. "Hover is so exact the air seems absent." The hull now shows your `buffetAngle` (drawn
     attitude only, capped at 7 degrees; the flight path stays calm on purpose: R-SHIP-8).
  4. "A jetpack hop ends in a 16 m/s fall caught at the last moment." Agreed. The descent
     brake now gathers the fall in from higher up (7 m/s plus 0.45 m/s per metre of height,
     was 0.9), so the same hop comes down at about 11 m/s and eases to 7.
- PHYSICS (P3 findings from playing the game):
  1. "Every world cruises at 46 m/s near the ground." Taken: the commanded envelope now scales
     with the fourth root of how thin the body's air is against Earth's (`env.speedScale`, from
     your `ATMOSPHERES[id].rho0`): Mars and the airless bodies 1.6 x (74 m/s at the ground),
     Jupiter 1.25 x, Earth 1, Venus 0.75 x (and your drag holds it lower still). Gravity is
     already yours in the climb. The assists are unchanged, so it stays forgiving.
  2. "Coming down on C takes 14 to 16 s from 18 m." It was the assist: once C had brought the
     hull to 2.8 m it chose the flattest site within 45 m, climbed back to 6 m and glided
     there. When the pilot settles by hand the assist now stays under the hull unless that
     ground cannot hold the ship (`here` in `findLandingSite`).
  3. `seed: 1` and the gear lift-off: both done in `af6ea97`.
- PHYSICS and PAINTER (architecture of the draw kits under `src/physics/three/`): fine by me,
  on four conditions. (1) Nothing in `src/physics/*.js` or its tests may import the kits: the
  pure core must keep running in Node. (2) Every kit object hangs under the body root, or is
  placed from `physics.fields.frame` each frame; nothing may sit at a fixed scene position,
  because the scene origin is the camera and moves every frame. (3) Budget: the kits together
  stay under 60 k triangles and 12 draw calls at quality 1 (they count toward the 600 k / 350
  the coordinator upheld), update buffers in place, and allocate nothing per frame. (4) Draw
  order is PAINTER's: the kits take its material factory and never set `renderOrder`,
  `depthTest` or blending themselves.
- COORDINATOR (rulings): cloud seas carrying the explorer as froth: agreed, no change wanted
  (the ship floats on them too). The 5 %/s visibility check and snow squalls: for review 4.
- PAINTER (via the coordinator): `painter.setMarks(...)` for painted markers in M3: yes; I
  will hand it `[{ id, x, y, r, label, sub, kind }]` each frame and drop my DOM rings.
  `sampleObstacles` clamped to 60 m, unsorted: noted, my queries stay at 45 m or less.
- PAINTER (via the coordinator): the default boom is 6.4 m until the real explorer exists.
  `speed01` and `altitude01`: nothing needed before M3. Your three MUST FIX are closed in
  `docs/lead/REVIEW.md`, review 2, with my own measurements: M1 is met.

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
