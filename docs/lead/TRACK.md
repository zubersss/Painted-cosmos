# TRACK: the path to "Done means"

Owner: PILOT as lead developer. Updated at every sync. Status words: DONE (verified, by whom
and how), PART (works, with the stated gap), TODO, RISK.
A role's milestone is done only when `docs/lead/REVIEW.md` has no open MUST FIX for it.

Last update: 2026-11-11, after review 1 (commit `19f72ce`).

## Milestone 1: vertical slice

| Item | Owner | Status | Verified how, by whom |
| --- | --- | --- | --- |
| Walk, run, jump, jetpack with recharging fuel | Pilot | DONE on stubs and in the real world | Pilot: `tests/explorer.test.mjs`, `tests/loop.test.mjs`, `node tests/playthrough.mjs` |
| Third person default, V first person, cameras never clip terrain | Pilot | DONE for ground, liquid and the ship's hull; trees are not collided with | Pilot: camera tests (clearance never below 0.45 m over 90 s on steep stub terrain) |
| Board with E, lift-off sequence | Pilot | DONE | Pilot: loop test, play-through |
| Climb to orbit with no loading screen | Pilot | DONE on stubs; in the real world see REVIEW | Pilot: play-through (17.8 s ground to space, no state reload) |
| Descend, landing assist with prompt, soft bounce, step out | Pilot | DONE | Pilot: `tests/flight.test.mjs` (touchdown under 1.8 m/s; never inside terrain in 10 min of careless flying), play-through |
| State machine with the seven states | Pilot | DONE | Pilot: `tests/state.test.mjs` |
| Floating origin, orbits, spin, sun, depth | Pilot | DONE | Pilot: `tests/orbits.test.mjs`; screenshots from 0.08 m near plane to orbit |
| Watercolour pipeline | Painter | PART: the sheet is convincing; the cost is not (REVIEW 1, Painter MUST FIX 1) | Lead: gallery captures, frame-cost probe |
| Earth temperate forest passes the freeze-frame test | Painter | PART: birch and pine forest, brook and canopy are in; three MUST FIX open (triangle budget, stippled foliage, ruler-straight trunks and bank) | Lead: `docs/lead/evidence/painter-19f72ce-*.jpg` |
| Merge both ways: the slice plays inside the painted forest | Pilot | DONE: Painter's render, world and art are the default since `15e77f9`; the scripted loop passes inside the real world | Lead: `node tests/playthrough.mjs --query "scale=0.5&quality=0"` on a clean export; `docs/shots/pilot/real-0*.jpg` |
| Physics models (added by the owner on 2026-11-11) | Physics | Ahead of plan: API facade, atmosphere, wind, weather, ground, explorer and ship bodies, fields, 72 tests; no lab page or shots yet; wiring is M2 | Lead: `node --test src/physics/`, 600-frame timing run |

**M1 verdict.** Pilot's half: met. Painter's half: not yet (three MUST FIX). Physics: no M1 gate.

## Milestone 2: the system

| Item | Owner | Status |
| --- | --- | --- |
| All eight planets with 4+ biomes each, and their look from orbit | Painter | TODO (placeholders exist for all ten bodies) |
| Full solar-system flight, pulse drive | Pilot | TODO (frames and SOI logic exist and are tested; no pulse yet) |
| Landing anywhere (including liquid) | Pilot | PART (assist lands on slopes up to 35 deg and floats on liquid; untested on Painter's other bodies) |
| Planet map | Pilot | TODO |
| Save to localStorage | Pilot | TODO |
| Physics wired in: `createPhysics`, air, ground, weather into the controllers; `world.setPhysics` | Pilot + Physics + Painter | TODO |
| Earth to Mars to Saturn in one sitting with no reload | all | TODO |

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
5. **Trees and rocks have no collision yet.** Painter delivered `world.sampleObstacles`; Pilot
   wires it first thing in M2 (explorer, cameras, landing sites).
6. **Pointer lock is untested** (headless reports nonsense deltas under lock). First thing to
   try when a person opens the game.
