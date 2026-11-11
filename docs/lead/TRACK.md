# TRACK: the path to "Done means"

Owner: PILOT as lead developer. Updated at every sync. Status words: DONE (verified, by whom
and how), PART (works, with the stated gap), TODO, RISK.
A role's milestone is done only when `docs/lead/REVIEW.md` has no open MUST FIX for it (the
coordinator can waive an item).

Last update: 2026-11-11, by the second PILOT agent, after re-running every check (results in
`docs/notes/pilot.md`, "Ground truth"). All three roles are on their second or third agent.

## Where we are in one paragraph

M1 is met. M2: review 4 (2026-11-11, `REVIEW.md`) found every named biome in the game, every
frame settled, landings and the trip intact, and **one small MUST FIX left for Painter**:
Earth's first vista submits 645 k triangles against a budget of 600 k. Fixed or waived by the
coordinator, M2 is closed. M3 is under way in parallel:
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

## Milestone 2: the system: ONE MUST FIX LEFT (review 4, item 1: Earth's first vista, 645 k triangles)

| Item | Owner | Status | Verified how, by whom |
| --- | --- | --- | --- |
| Full solar-system flight, pulse drive, markers | Pilot | DONE (markers are brushed ink rings with lettered names since the painted theme) | Lead: `tests/pulse.test.mjs`, `node tests/trip.mjs` (47 checks) |
| Landing anywhere | Pilot | DONE: 40 of 40 scripted landings on ten bodies in the contract test; a wider survey of 240 spots lands 235, and the 5 refusals say why on screen | Lead: `tests/contract.test.mjs`; survey in Pilot's notes |
| Planet map, save | Pilot | DONE (painted theme) | Lead: the trip (click sets the course; a reload continues from the save) |
| Physics wired in | Pilot + Physics | DONE on Pilot's side | Lead: `tests/physics.test.mjs`; play-through and trip with Physics on |
| Frame read-out for the owner | Pilot | DONE (` key, `?stats=1`; now with the worst `world.update` frame) | Lead: the trip checks it shows numbers |
| All eight planets with 4+ biomes each | Painter | DONE: by the lead's reading of the tour sheets 27 of 33 biomes show the brief's landform clearly, 6 partly, none missing | Lead: review 4, `docs/lead/evidence/tour-<body>.jpg` (114 frames) |
| How each planet looks from orbit | Painter | PART: five of eight read as painted globes; Mercury and Neptune as glass balls, Earth's cloud hard-edged (SHOULD FIX) | Lead: the orbit frame of each tour sheet |
| Frame budget on every planet (600 k triangles, 350 calls at quality 1) | Painter | **MUST FIX**: Earth's vista `temperate_forest-1` is at 645 k / 352 for the world alone; every other body is inside (347 k to 545 k); Mercury's `crystal_gardens-2` is at 344 calls before the models | Lead: review 4 (tour counters, then five frames again by hand) |
| `world.busy` drains; `world.update` inside 5 ms | Painter | `busy`: DONE (114 of 114 tour frames settled in 0.1 to 58 s). `world.update`: cannot be measured in software GL since the builder takes 30 % of a slow frame; a pin is asked for | Lead: review 4 |
| Earth to Mars to Saturn in one sitting with no reload | all | DONE: on stubs, in the pure simulation on the reported worlds, and in the painted game in a browser (47 checks, both touchdowns on the legs, reload from the save) on the export of `5d411f2`; not re-run in the browser on `334eb16` itself | Lead: `node tests/trip.mjs`, `tests/contract.test.mjs` |

## Milestone 3: the painting comes alive: UNDER WAY

| Item | Owner | Status | Verified how, by whom |
| --- | --- | --- | --- |
| Sketchbook and vistas | Pilot | DONE: views found on foot; a sketch of the painted frame for every landscape walked and view found, shown as it is made, kept beside the save; a page per world with empty frames for what is left | Lead: `tests/sketches.test.mjs`, `node tests/m3check.mjs` (26 checks) |
| Audio, all procedural | Pilot | DONE and measured: 22 situations rendered through the game's graph; no clipping, no DC, no clicks, peak -5.3 dBFS; rain follows what falls and what it falls on; footsteps by ground. Nobody has heard it | Lead: `node tests/audiocheck.mjs` |
| Title screen, help card | Pilot | DONE: the title card is the loading screen; legible; H shows it again | Lead: frames at 960x540 and 640x360, `m3check` |
| HUD | Pilot | DONE in the painted theme (see the next row): prompt, gauges, read-out, notice, markers, look hint, sketch slip; legible on a pale wash and on indigo | Lead: `ui-flight.jpg`, `ui-space.jpg` |
| Painted UI theme (art bible 8): torn paper, ink icons, hand lettering, painted markers, cursor, loading | Pilot (moved from Painter by the coordinator, 2026-11-11) | PART: first pass in and used everywhere (title and help card, HUD slips, prompt, gauges, markers, map, sketchbook): generated cold-press paper with torn edges, a stroke font drawn in code, ink keycaps and rings, brush-tip cursor, loading dabs; static, so no shimmer; the frame read-out stays plain type on purpose. Waiting for Painter's review of the look | Lead: `docs/shots/pilot/ui-*.jpg` (six frames at 960x540), `m3check`, play-through |
| Performance tiers and dynamic resolution | Pilot | PART: controller unit-tested; starts at tier 1 and scale 0.75 and climbs; never run on a real GPU | Lead: `tests/dynres.test.mjs`, `m3check` |
| Touchdown on the landing legs | Pilot + Physics | DONE: the assist hands the hull to the gear a metre up; 0.6 m/s sink, three feet down, asleep within 5 s on Earth, the Moon and Jupiter; 40 landings and the 240-spot survey unchanged | Lead: `tests/physics.test.mjs`, `tests/contract.test.mjs`, play-through with Physics (0.80 m/s) |
| Gamepad ("if cheap") | Pilot | DONE with a simulated pad (never a real one): standard layout, analog sticks, the same keys | Lead: `tests/gamepad.test.mjs`, `m3check` |
| Freeze-frame tour of every biome and every vista on every body | Lead | DONE as an instrument: `node tests/tour.mjs` writes `docs/lead/evidence/tour-<body>.jpg` and `.json`; says on the sheet what did not settle, who stands in liquid, what each frame cost | Lead: sheets |
| Weather in the picture: sky, haze, ground and water reading `setMood.sky`, then Physics' draw kits | Painter (+ Physics kits) | PART, not yet reviewed by the lead: Painter reports its first M3 block in (`9d9caf1`: the world draws the kits itself, sky and ground read the weather; the coordinator saw the gallery frames: the blizzard is strong, rain reads as crossing sticks). Next lead job: the weather set in the game (storm at the Earth spawn with the game's counters, a blizzard, a Mars dust storm, a gale on Neptune's sea) and lightning by `__pc.flash()` | Lead: to do |
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
| Find different biomes on each | DONE as far as M2 goes: 33 biomes on the eight planets, each showing its landform clearly (27) or partly (6); the sketchbook counts them |
| Every frame along the way passes the freeze-frame test | PART: on foot in daylight most frames now read as watercolours (review 4); still digital: peppered dark washes and space, three orbit views, straight-edged crystals and dunes, the placeholder explorer and ship in every third-person frame; night, weather and the interface have not been judged by anyone but their makers |
| No console errors | DONE for every scripted run so far (they fail on any) |
| The frame-rate target holds (60 fps at 1080p on an integrated GPU, never under 30) | RISK: cannot be measured here. Triangle and draw-call budgets are set and policed; dynamic resolution and three tiers exist; the read-out is there for the owner |
| The README lists the controls | DONE (keyboard, mouse and gamepad) |

## Risks and what is off track

1. **Painter is the critical path.** M2's planets, then all of M3's picture work (weather,
   models, space, art pass) sit with one role that has already used up one agent. The
   coordinator has moved the UI theme to Pilot for that reason. If review 4 again finds
   biomes without their landform, the honest options are a waiver per biome or fewer, better
   biomes; that is the coordinator's call.
2. **Frame rate is unmeasured.** Every claim about 60 fps is reasoning from triangle counts
   and pass counts. Someone must open the game on a real integrated GPU before M4 and read
   the ` read-out; until then this stays the largest risk in the project.
3. **Build hitches are unmeasured.** `world.busy` drains now, but the worst `world.update`
   frame cannot be read in software GL (the builder takes 30 % of a slow frame by design);
   a pin for the slice is asked for in review 4.
4. **Weather is in the picture but unreviewed in the game**, and it adds cost on top of a
   showcase view that is already over its budget.
5. **Nobody has heard the sound or held a real mouse to it.** Measured levels and a proven
   pointer-lock fallback are substitutes, not the thing itself.
6. **Agents run out of context.** Notes and lead files are kept able to stand alone; every
   role's notes open with a handover.
