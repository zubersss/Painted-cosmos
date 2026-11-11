# TRACK: the path to "Done means"

Owner: PILOT as lead developer. Updated at every sync. Status words: DONE (verified, by whom
and how), PART (works, with the stated gap), TODO, RISK.
A role's milestone is done only when `docs/lead/REVIEW.md` has no open MUST FIX for it (the
coordinator can waive an item).

Last update: 2026-11-11, by the second PILOT agent, after re-running every check (results in
`docs/notes/pilot.md`, "Ground truth"). All three roles are on their second or third agent.

## Where we are in one paragraph

M1 is met. M2 is met on Pilot's and Physics' side and OPEN on Painter's: the planets exist and
can be landed on everywhere, but many biomes did not show the landform the brief names and
several things read as digital; a fresh Painter is on a third pass, and M2 closes when review 4
(what it measures is at the top of `REVIEW.md`) has no MUST FIX. M3 is under way in parallel:
Pilot's half is in place (and since 2026-11-11 Pilot also builds the painted UI theme);
Painter's half (weather in the picture, real explorer and ship, space, art pass) has not
started; Physics has delivered everything the picture needs to show weather. M4 has not
started. The two things nobody has been able to check are the frame rate on a real GPU and how
the game sounds.

## Milestone 1: vertical slice: MET

| Item | Owner | Status | Verified how, by whom |
| --- | --- | --- | --- |
| Walk, run, jump, jetpack with recharging fuel | Pilot | DONE | Lead: `tests/explorer.test.mjs`, `tests/loop.test.mjs`, `node tests/playthrough.mjs` (37 checks; re-run 2026-11-11 on stubs, with Physics, and in the painted world) |
| Third person default, V first person, cameras never clip | Pilot | DONE for ground, liquid, hull and trunks | Lead: camera tests; the play-through checks the clearance every stage |
| Board with E, lift-off, climb to orbit with no loading screen, land, step out | Pilot | DONE | Lead: play-through in the painted world, no console errors |
| State machine with the seven states; floating origin, orbits, spin, sun, depth | Pilot | DONE | Lead: `tests/state.test.mjs`, `tests/orbits.test.mjs` |
| Watercolour pipeline; Earth's temperate forest passes the freeze-frame test | Painter | DONE (review 2: 564 k triangles, 334 calls at the spawn; brushed crowns; wandering trunks and bank) | Lead: frame-cost probe in the integrated game, gallery frames at 960x540 |
| The slice plays inside the painted forest | Pilot | DONE | Lead: play-through on a clean export |
| Physics models, P1 | Physics | DONE (accepted by the coordinator) | Lead: `node --test src/physics/` |

## Milestone 2: the system: OPEN (Painter's planets; review 4)

| Item | Owner | Status | Verified how, by whom |
| --- | --- | --- | --- |
| Full solar-system flight, pulse drive, markers | Pilot | DONE (markers are DOM rings until the painted theme) | Lead: `tests/pulse.test.mjs`, `node tests/trip.mjs` (47 checks) |
| Landing anywhere | Pilot | DONE: 40 of 40 scripted landings on ten bodies in the contract test; a wider survey of 240 spots lands 235, and the 5 refusals say why on screen | Lead: `tests/contract.test.mjs`; survey in Pilot's notes |
| Planet map, save | Pilot | DONE (fallback look) | Lead: the trip (click sets the course; a reload continues from the save) |
| Physics wired in | Pilot + Physics | DONE on Pilot's side | Lead: `tests/physics.test.mjs`; play-through and trip with Physics on |
| Frame read-out for the owner | Pilot | DONE (` key, `?stats=1`; now with the worst `world.update` frame) | Lead: the trip checks it shows numbers |
| All eight planets with 4+ biomes each | Painter | PART: every body has 4+ biomes with their own palette, liquid and kits and can be walked; the named landform is missing or weak in many (the coordinator's and Painter's own tables); third pass in progress | Lead: review 4 will judge every tour sheet |
| How each planet looks from orbit | Painter | PART: orbit frames exist; not reviewed since the first pass. The tour now takes one orbit frame per body | Lead: review 4 |
| Frame budget on every planet (600 k triangles, 350 calls at quality 1) | Painter | PART: review 3 found Neptune's spawn at 727 k; not re-measured since | Lead: review 4 (the tour records cost per frame) |
| `world.busy` drains; `world.update` inside 5 ms | Painter | OPEN: on the committed state of 2026-11-11 no Earth biome frame settled within 90 s (busy 267 to 412) | Lead: `node tests/tour.mjs --bodies earth` on a clean export |
| Earth to Mars to Saturn in one sitting with no reload | all | DONE on stubs; in the painted worlds the flight, both landings and the autosave passed on 2026-11-11; the reload step must be re-run (script fault, fixed) | Lead: `node tests/trip.mjs` in the painted world |

## Milestone 3: the painting comes alive: UNDER WAY

| Item | Owner | Status | Verified how, by whom |
| --- | --- | --- | --- |
| Sketchbook and vistas | Pilot | DONE: views found on foot; a sketch of the painted frame for every landscape walked and view found, shown as it is made, kept beside the save; a page per world with empty frames for what is left | Lead: `tests/sketches.test.mjs`, `node tests/m3check.mjs` (26 checks) |
| Audio, all procedural | Pilot | DONE and measured: 22 situations rendered through the game's graph; no clipping, no DC, no clicks, peak -5.3 dBFS; rain follows what falls and what it falls on; footsteps by ground. Nobody has heard it | Lead: `node tests/audiocheck.mjs` |
| Title screen, help card | Pilot | DONE: the title card is the loading screen; legible; H shows it again | Lead: frames at 960x540 and 640x360, `m3check` |
| HUD | Pilot | PART: prompt, gauges, read-out, notice, markers, look hint, sketch slip, all legible on paper slips; the painted theme is being built | Lead: evidence frames |
| Painted UI theme (art bible 8): torn paper, ink icons, hand lettering, painted markers, cursor, loading | Pilot (moved from Painter by the coordinator, 2026-11-11) | see Pilot's notes for its state; look to be reviewed by Painter | Lead: frames in `docs/shots/pilot/` |
| Performance tiers and dynamic resolution | Pilot | PART: controller unit-tested; starts at tier 1 and scale 0.75 and climbs; never run on a real GPU | Lead: `tests/dynres.test.mjs`, `m3check` |
| Touchdown on the landing legs | Pilot + Physics | TODO: recipe complete in Physics' notes; plan in Pilot's handover | |
| Gamepad ("if cheap") | Pilot | TODO: plan in Pilot's handover | |
| Freeze-frame tour of every biome and every vista on every body | Lead | DONE as an instrument: `node tests/tour.mjs` writes `docs/lead/evidence/tour-<body>.jpg` and `.json`; says on the sheet what did not settle, who stands in liquid, what each frame cost | Lead: sheets |
| Weather in the picture: sky, haze, ground and water reading `setMood.sky`, then Physics' draw kits | Painter (+ Physics kits) | TODO: Painter's first M3 block. Physics side is ready: eleven sky numbers, kits inside the budget, ink per ground material, the sea as a chunk | Lead: Physics' tests (190) and lab frames |
| Motion (wind, water, day-night), space washes, art pass on the weakest biome of every planet | Painter | TODO | |
| Real explorer and ship models | Painter | TODO (placeholders in every frame today) | |

## Milestone 4: critique swap and ship: NOT STARTED

Each role plays the whole game and writes a blunt critique of the others' domains; the worst
issues are fixed; every check is run; Pilot opens one pull request `cosmos` -> `main` through
the REST API (`docs/COORDINATOR.md` section E has the commands) and merges it; GitHub Pages
serves `main` (`https://zubersss.github.io/Painted-cosmos/`), so every URL in `index.html`
stays relative. Only when the coordinator says so, and only once.

## "Done means" checklist (the brief)

| Requirement | Status |
| --- | --- |
| A new player can open index.html and start on Earth in the forest | DONE (title card, then the clearing by the brook, the ship 16 m away) |
| Walk, jetpack, board, reach space | DONE: scripted in the painted world, no console errors |
| Land on all eight planets | DONE as mechanics (landing survey, contract test); the trip lands on Mars and Saturn in the painted worlds |
| Find different biomes on each | PART: the biomes exist and the sketchbook counts them; whether each shows what the brief names is review 4 |
| Every frame along the way passes the freeze-frame test | TODO: the home forest passed (review 2); the other 40 biomes, the vistas, orbit, space, night, weather and the interface have not. The tour is the instrument; review 4 is the first full judgement |
| No console errors | DONE for every scripted run so far (they fail on any) |
| The frame-rate target holds (60 fps at 1080p on an integrated GPU, never under 30) | RISK: cannot be measured here. Triangle and draw-call budgets are set and policed; dynamic resolution and three tiers exist; the read-out is there for the owner |
| The README lists the controls | DONE (to be extended when the gamepad and the theme land) |

## Risks and what is off track

1. **Painter is the critical path.** M2's planets, then all of M3's picture work (weather,
   models, space, art pass) sit with one role that has already used up one agent. The
   coordinator has moved the UI theme to Pilot for that reason. If review 4 again finds
   biomes without their landform, the honest options are a waiver per biome or fewer, better
   biomes; that is the coordinator's call.
2. **Frame rate is unmeasured.** Every claim about 60 fps is reasoning from triangle counts
   and pass counts. Someone must open the game on a real integrated GPU before M4 and read
   the ` read-out; until then this stays the largest risk in the project.
3. **`world.busy` and build hitches.** The readiness signal does not drain in Painter's
   committed state, so frames are captured unsettled and the title card may wait on a 900
   frame fallback; `world.update` worst frames were 8.5 to 9.4 ms in review 3 (budget 5).
4. **Nothing of the weather is in the picture.** Physics simulates a thunderstorm over the
   spawn late in the first morning; the player hears it (rain, thunder) and sees a sunny day.
5. **Nobody has heard the sound or held a real mouse to it.** Measured levels and a proven
   pointer-lock fallback are substitutes, not the thing itself.
6. **Agents run out of context.** Notes and lead files are kept able to stand alone; every
   role's notes open with a handover.
