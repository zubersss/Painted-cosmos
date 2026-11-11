# TRACK: the path to "Done means"

Owner: PILOT as lead developer. Updated at every sync. Status words: DONE (verified, by whom
and how), PART (works, with the stated gap), TODO, RISK.
A role's milestone is done only when `docs/lead/REVIEW.md` has no open MUST FIX for it.

Last update: 2026-11-11, after review 3 (commit `22a10c3`).

## Milestone 1: vertical slice

| Item | Owner | Status | Verified how, by whom |
| --- | --- | --- | --- |
| Walk, run, jump, jetpack with recharging fuel | Pilot | DONE on stubs and in the real world | Pilot: `tests/explorer.test.mjs`, `tests/loop.test.mjs`, `node tests/playthrough.mjs` |
| Third person default, V first person, cameras never clip terrain | Pilot | DONE for ground, liquid, the ship's hull and tree trunks | Pilot: camera tests (clearance never below 0.45 m over 90 s on steep stub terrain); trunk test |
| Board with E, lift-off sequence | Pilot | DONE | Pilot: loop test, play-through |
| Climb to orbit with no loading screen | Pilot | DONE on stubs; in the real world see REVIEW | Pilot: play-through (17.8 s ground to space, no state reload) |
| Descend, landing assist with prompt, soft bounce, step out | Pilot | DONE | Pilot: `tests/flight.test.mjs` (touchdown under 1.8 m/s; never inside terrain in 10 min of careless flying), play-through |
| State machine with the seven states | Pilot | DONE | Pilot: `tests/state.test.mjs` |
| Floating origin, orbits, spin, sun, depth | Pilot | DONE | Pilot: `tests/orbits.test.mjs`; screenshots from 0.08 m near plane to orbit |
| Watercolour pipeline | Painter | PART: the sheet is convincing; the cost is not (REVIEW 1, Painter MUST FIX 1) | Lead: gallery captures, frame-cost probe |
| Earth temperate forest passes the freeze-frame test | Painter | PART: birch and pine forest, brook and canopy are in; three MUST FIX open (triangle budget, stippled foliage, ruler-straight trunks and bank) | Lead: `docs/lead/evidence/painter-19f72ce-*.jpg` |
| Merge both ways: the slice plays inside the painted forest | Pilot | DONE: Painter's render, world and art are the default since `15e77f9`; the scripted loop passes inside the real world | Lead: `node tests/playthrough.mjs --query "scale=0.5&quality=0"` on a clean export of `7c7a0ac` (forest and collision in): 37 checks pass; `docs/shots/pilot/real-0*.jpg` |
| Physics models (added by the owner on 2026-11-11) | Physics | Ahead of plan: API facade, atmosphere, wind, weather, ground, explorer and ship bodies, fields, 72 tests; no lab page or shots yet; wiring is M2 | Lead: `node --test src/physics/`, 600-frame timing run |

**M1 verdict (review 2).** Pilot's half: met. Painter's half: met (the three MUST FIX are closed
with the lead's own measurements: 564 k triangles and 334 draw calls at the spawn at quality 1,
brushed crowns, wandering trunks and bank at 960x540). Physics: P1 accepted by the coordinator.

## Milestone 2: the system

| Item | Owner | Status | Verified how, by whom |
| --- | --- | --- | --- |
| Full solar-system flight: frames, spheres of influence, moving bodies | Pilot | DONE | Pilot: `tests/orbits.test.mjs`, `tests/pulse.test.mjs` |
| Pulse drive between planets, with markers | Pilot | DONE (markers are DOM rings, not painted) | Pilot: `tests/pulse.test.mjs`, `node tests/trip.mjs` |
| Landing anywhere | Pilot | DONE: 40 landings on all ten bodies (28 biomes, three afloat), slopes by ground friction, clear of trees | Pilot: `tests/contract.test.mjs` on Painter's real worlds with Physics |
| Planet map | Pilot | DONE (fallback look) | Pilot: `node tests/trip.mjs` (click sets the course) |
| Save to localStorage in try/catch | Pilot | DONE | Pilot: `tests/save.test.mjs`; the trip reloads and continues |
| Physics wired in (`createPhysics`, update, env, `world.setPhysics`, gear) | Pilot + Physics | DONE on Pilot's side; the world reading the fields is Painter's | Pilot: `tests/physics.test.mjs`; play-through and trip with physics on |
| Ship never flies through tree crowns | Pilot | DONE | Pilot: `tests/contract.test.mjs` (low pass over the real forest) |
| Pointer-lock fallback, said on screen | Pilot | DONE for refusal and nonsense deltas; the happy path needs a real hand | Pilot: `node tests/lockcheck.mjs` |
| Frame read-out for the owner | Pilot | DONE (` key, `?stats=1`, README) | Pilot: the trip checks it shows numbers |
| All eight planets with 4+ biomes each, and their look from orbit | Painter | PART: data-driven biomes, liquids and flora kits on every body (`ff51af7`); one MUST FIX open (Neptune's spawn is 727 k triangles, REVIEW 3) | Lead: per-body frame cost, 40 landings, Painter's shots |
| Weather, particles, ground marks, plants reacting, in the picture | Physics + Painter | PART: fields are fed every frame; Painter wired the flora field in `1e1801e` (not yet reviewed in the game); weather, particles and marks are not drawn yet | Lead: `node --test src/physics/` (158), lab shots |
| Earth to Mars to Saturn in one sitting with no reload | all | DONE on stubs and in the painted worlds as they are (see Pilot's notes for the runs) | Pilot: `node tests/trip.mjs`, `tests/contract.test.mjs` |

## Milestone 3: the painting comes alive

| Item | Owner | Status |
| --- | --- | --- |
| Motion: wind, water, weather, day-night; space washes; art pass on weakest biomes | Painter (+ Physics fields) | TODO |
| Painted UI theme (`src/art/ui.css`, hand lettering) | Painter | TODO (Pilot runs a plain paper fallback) |
| HUD, sketchbook and vistas, title screen, help card | Pilot | PART (prompt line, two gauges, start card with the controls) |
| Audio, all procedural | Pilot | TODO |
| Performance tiers and dynamic resolution | Pilot | PART (controller built and unit-tested; never run on a real GPU) |

## Milestone 4: critique swap and ship

TODO. Pull request `cosmos` -> `main`; GitHub Pages serves `main`
(`https://zubersss.github.io/Painted-cosmos/`), so every URL in `index.html` must stay relative.

## "Done means" checklist (the brief)

| Requirement | Status |
| --- | --- |
| A new player can open index.html and start on Earth in the forest | DONE: spawn in the clearing by the brook, the ship 16 m away (`docs/shots/pilot/real-01-on-foot.jpg`) |
| Walk, jetpack, board, reach space | DONE (Pilot) |
| Land on all eight planets, different biomes on each | TODO |
| Every frame passes the freeze-frame test | TODO: see REVIEW |
| No console errors | DONE for the M1 loop (play-through fails on any) |
| Frame-rate target holds (60 fps at 1080p on an integrated GPU, never under 30) | RISK: unmeasurable here |
| README lists the controls | DONE |

## Risks and what is off track

1. **Frame rate: the largest risk in the project.** It cannot be measured in this sandbox,
   but the forest submits 4.4 M triangles and 887 draw calls a frame at quality 1, on top of a
   multi-target scene pass and four full-screen passes. That will not hold 60 fps at 1080p on
   an integrated GPU. A budget is set in REVIEW 1 (600 k triangles, 350 calls at quality 1).
   Dynamic resolution and tiers exist but only cut pixels, not triangles. Someone must run the
   game on real hardware before M4; until then every claim about 60 fps is reasoning.
2. **Hitches while moving.** Terrain and flora are built on the main thread in time slices; in
   software GL the frame time during a walk rises sharply. Needs a measurement of build time
   per frame (`R-SPACE-1`).
3. **Three roles, one working tree.** Mid-edit files from one role can break another role's
   run. Mitigation in place: checks run against `tools/export-head.sh`.
4. **Scope added mid-flight** (physics, weather, deformation). M2 now carries wiring work for
   Pilot that the original plan did not have. The frame budget has to absorb about 2 ms of CPU.
5. **The flying ship passes through tree crowns.** The explorer, the camera boom and landing
   sites respect `world.sampleObstacles`; the ship's ground cushion does not know the canopy.
6. **Pointer lock is untested** (headless reports nonsense deltas under lock). First thing to
   try when a person opens the game.
