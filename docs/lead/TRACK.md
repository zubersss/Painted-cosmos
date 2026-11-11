# TRACK: the path to "Done means"

Owner: PILOT as lead developer. Updated at every sync. Status words: DONE (verified, by whom
and how), PART (works, with the stated gap), TODO, RISK.
A role's milestone is done only when `docs/lead/REVIEW.md` has no open MUST FIX for it.

Last update: 2026-11-11 (M1 in progress).

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
| Watercolour pipeline | Painter | PART | Lead: see REVIEW (first pass) |
| Earth temperate forest passes the freeze-frame test | Painter | TODO (no flora in the last committed build) | Lead: see REVIEW |
| Merge both ways: the slice plays inside the painted forest | Pilot | PART: Painter's render, world and art are the default since commit 15e77f9 | Lead: play-through against a clean export of HEAD; see REVIEW |
| Physics models (added by the owner on 2026-11-11) | Physics | Started (atmosphere, wind); wiring is M2 | Lead: see REVIEW |

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
| A new player can open index.html and start on Earth in the forest | PART: starts at Painter's spawn in the home forest biome; no trees yet |
| Walk, jetpack, board, reach space | DONE (Pilot) |
| Land on all eight planets, different biomes on each | TODO |
| Every frame passes the freeze-frame test | TODO: see REVIEW |
| No console errors | DONE for the M1 loop (play-through fails on any) |
| Frame-rate target holds (60 fps at 1080p on an integrated GPU, never under 30) | RISK: unmeasurable here |
| README lists the controls | DONE |

## Risks and what is off track

1. **Frame rate cannot be measured in this sandbox.** Software GL runs the painted pipeline at
   about 20 fps at 480x270 standing still and far lower while terrain builds. This says little
   about a real GPU, but the pipeline has four full-screen passes plus a multi-target scene
   pass, so the risk is real. Mitigation: dynamic resolution and tiers exist; someone must run
   it on real hardware before M4. Until then every claim about 60 fps is reasoning, not fact.
2. **Hitches while moving.** Terrain and flora are built on the main thread in time slices; in
   software GL the frame time during a walk rises sharply. Needs a measurement of build time
   per frame (`R-SPACE-1`).
3. **Three roles, one working tree.** Mid-edit files from one role can break another role's
   run. Mitigation in place: checks run against `tools/export-head.sh`.
4. **Scope added mid-flight** (physics, weather, deformation). M2 now carries wiring work for
   Pilot that the original plan did not have. The frame budget has to absorb about 2 ms of CPU.
5. **Trees and rocks have no collision** (they are not in `sampleSurface`). The explorer and
   the cameras pass through them. Asked of Painter in Pilot's notes.
