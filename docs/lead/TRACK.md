# TRACK: the path to "Done means"

Owner: PILOT as lead developer. Updated at every sync. Status words: DONE (verified, by whom
and how), PART (works, with the stated gap), TODO, RISK.
A role's milestone is done only when `docs/lead/REVIEW.md` has no open MUST FIX for it (the
coordinator can waive an item).

Last update: 2026-11-11, by the third PILOT agent, after review 5 (`REVIEW.md`). All three
roles are on their third or fourth agent.

## Where we are in one paragraph

M1 and M2 are closed. M3 is the live milestone and most of it is in: Pilot's half is done
(sketchbook, sound, title and help, HUD, the painted interface in its second pass, tiers,
gamepad, touchdown on the legs); weather is in the game (review 5: twelve frames in the game
itself, cost counted); the real explorer and ship are in every frame; a near-ground stroke
layer and a rain glaze are in. **No MUST FIX is open**: the one that was (review 5's addendum: Earth's first vista 11 k
triangles over a 600 k budget) is withdrawn by the owner's instruction of 2026-11-11: there
is no triangle budget; the game starts at the top tier and full resolution and the tiers and
dynamic resolution alone carry the frame-rate line. Closed at that re-measure: the pepper in the
dark washes and in space, the storm after dark (550 k), and Physics' storms without wind
(now 16 to 25 m/s; walked and flown in the browser).
M4 is prepared: one command runs every
check and prints a table (`node tests/all.mjs --export`), the README is complete for a new
player, the critique of the other two domains is in Pilot's notes. The two things nobody has
been able to check are still the frame rate on a real GPU and how the game sounds.

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

## Milestone 2: the system: CLOSED (the coordinator waived review 4's one MUST FIX as a gate and carried it into M3)

| Item | Owner | Status | Verified how, by whom |
| --- | --- | --- | --- |
| Full solar-system flight, pulse drive, markers | Pilot | DONE (markers are brushed ink rings with lettered names since the painted theme) | Lead: `tests/pulse.test.mjs`, `node tests/trip.mjs` (47 checks) |
| Landing anywhere | Pilot | DONE: 40 of 40 scripted landings on ten bodies in the contract test; a wider survey of 240 spots lands 235, and the 5 refusals say why on screen | Lead: `tests/contract.test.mjs`; survey in Pilot's notes |
| Planet map, save | Pilot | DONE (painted theme) | Lead: the trip (click sets the course; a reload continues from the save) |
| Physics wired in | Pilot + Physics | DONE on Pilot's side | Lead: `tests/physics.test.mjs`; play-through and trip with Physics on |
| Frame read-out for the owner | Pilot | DONE (` key, `?stats=1`; now with the worst `world.update` frame) | Lead: the trip checks it shows numbers |
| All eight planets with 4+ biomes each | Painter | DONE: by the lead's reading of the tour sheets 27 of 33 biomes show the brief's landform clearly, 6 partly, none missing | Lead: review 4, `docs/lead/evidence/tour-<body>.jpg` (114 frames) |
| How each planet looks from orbit | Painter | PART: five of eight read as painted globes; Mercury and Neptune as glass balls, Earth's cloud hard-edged (SHOULD FIX) | Lead: the orbit frame of each tour sheet |
| ~~Frame budget on every planet (600 k triangles, 350 calls at quality 1)~~ | Painter | Withdrawn by the owner's instruction, 2026-11-11 (no triangle budget) | Lead: reviews 4 and 5 |
| `world.busy` drains; `world.update` inside 5 ms | Painter | `busy`: DONE (114 of 114 tour frames settled in 0.1 to 58 s). `world.update`: cannot be measured in software GL since the builder takes 30 % of a slow frame; a pin is asked for | Lead: review 4 |
| Earth to Mars to Saturn in one sitting with no reload | all | DONE: on stubs, in the pure simulation on the real worlds, and in the painted game in a browser (47 checks, on the export of `db22516`, with the real models, weather and the near-ground layer in) | Lead: `node tests/trip.mjs`, `tests/contract.test.mjs`, `node tests/all.mjs --export` |

## Milestone 3: the painting comes alive: UNDER WAY

| Item | Owner | Status | Verified how, by whom |
| --- | --- | --- | --- |
| Sketchbook and vistas | Pilot | DONE: views found on foot; a sketch of the painted frame for every landscape walked and view found, shown as it is made, kept beside the save; a page per world with empty frames for what is left | Lead: `tests/sketches.test.mjs`, `node tests/m3check.mjs` (26 checks) |
| Audio, all procedural | Pilot | DONE and measured: 22 situations rendered through the game's graph; no clipping, no DC, no clicks, peak -5.3 dBFS; rain follows what falls and what it falls on; footsteps by ground. Nobody has heard it | Lead: `node tests/audiocheck.mjs` |
| Title screen, help card | Pilot | DONE: the title card is the loading screen; legible; H shows it again | Lead: frames at 960x540 and 640x360, `m3check` |
| HUD | Pilot | DONE in the painted theme (see the next row): prompt, gauges, read-out, notice, markers, look hint, sketch slip; legible on a pale wash and on indigo | Lead: `ui-flight.jpg`, `ui-space.jpg` |
| Painted UI theme (art bible 8): torn paper, ink icons, hand lettering, painted markers, cursor, loading | Pilot (moved from Painter by the coordinator, 2026-11-11) | DONE in a second pass, not yet looked at by Painter: paper with torn edges, a stroke font drawn in code, keys as ink-and-wash marks (a pale wash off register under a pen outline), the button and the open tab as one brush stroke with the words left as paper, sketches not yet made in loose pencil frames, rules drawn freehand, the map's orbits pencilled in strokes and its worlds as dabs of wash, brushed ring markers, brush-tip cursor, loading dabs; static, so no shimmer; the frame read-out stays plain type on purpose | Lead: `docs/shots/pilot/ui-*.jpg` (six frames at 960x540), `m3check`, play-through |
| Performance tiers and dynamic resolution | Pilot | DONE as logic, never run on a real GPU: the game starts at tier 2 and full resolution and steps down only when the measured frame time asks (under 30 fps: at once, a tier with it if the smallest picture could not reach 30; model machines at 13 fps at the top are above 30 fps in 0.2 s, hopeless ones at the floor within 3 s); up by single careful steps that back off when they do not hold (works behind a display refresh); loading is not judged; `?quality=` pins a tier | Lead: `tests/dynres.test.mjs` (8 tests on model machines) |
| Touchdown on the landing legs | Pilot + Physics | DONE: the assist hands the hull to the gear a metre up; 0.6 m/s sink, three feet down, asleep within 5 s on Earth, the Moon and Jupiter; 40 landings and the 240-spot survey unchanged | Lead: `tests/physics.test.mjs`, `tests/contract.test.mjs`, play-through with Physics (0.80 m/s) |
| Gamepad ("if cheap") | Pilot | DONE with a simulated pad (never a real one): standard layout, analog sticks, the same keys | Lead: `tests/gamepad.test.mjs`, `m3check` |
| Freeze-frame tour of every biome and every vista on every body | Lead | DONE as an instrument: `node tests/tour.mjs` writes `docs/lead/evidence/tour-<body>.jpg` and `.json`; says on the sheet what did not settle, who stands in liquid, what each frame cost | Lead: sheets |
| Weather in the game: sky, haze, light, wet ground, fresh snow, waves, Physics' marks drawn by the world | Painter + Physics | PART (review 5, in the game itself): the storm by day passes as a watercolour of a wet wood; the blizzard is the best frame; cost is small (kits 1 to 5 draw calls, at most 3.5 k triangles). Open: rain as pale opaque strokes (a glaze was committed after the review's frames), white specks round the crowns in the lightning frame, the near-ground layer drawn on top of fresh snow, puddles that read as holes, Neptune's sea untouched by its storm sky, a dust storm with nothing in the air near the eye. Physics' storm wind is in since (see below) | Lead: `docs/lead/evidence/weather.jpg`, `.json` (`node tests/weather.mjs`) |
| ~~Frame budget with weather, real models and the near-ground layer~~ | Painter | **Withdrawn by the owner's instruction, 2026-11-11**: no count of triangles or draw calls is a gate at any tier. `tests/cost.mjs` still reports what each view draws (last: the vista `temperate_forest-1` 611 k / 339 at quality 1 on `0de3fb4`; Painter reports 540 k / 305 after not drawing far worlds that cannot be seen) | Lead: `cost-recheck.json` |
| Pepper in dark washes and in space | Painter | DONE for the washes (addendum to review 5: storm sky, Neptune's sky, night, space, pulse, looked at 1:1). Left as SHOULD FIX: the ragged border's hard dots in dark scenes; no stars in space | Lead: `weather-recheck.jpg`, `space-recheck.jpg` |
| Storms bring their own wind | Physics | DONE (P7.4): thunderstorm 10 to 23 m/s above the wood, blizzard 12 to 25 at 10 m, dust storm 10 to 20; walked and flown in the browser through the storm at the spawn (walk 3.5 to 4.0 m/s in every heading, hop carried 4 m, ship lands) | Lead: Node on the export, `run3/stormwalk.mjs` in the browser |
| Real explorer and ship models | Painter | DONE as far as the lead has looked: in every third-person frame of review 5, one draw call each, a cast shade under both; not yet judged in motion or in the cockpit | Lead: `weather.jpg`, `cost.json` |
| Motion (wind, water, day-night), space washes, art pass on the weakest biome of every planet | Painter | PART: grass leans from the explorer and lies down under the ship, waves move, dusk and night are in the weather sheet; space washes and the art pass not started as far as the lead knows | |
| On foot nobody fights the ground | Pilot | DONE: boulders up to 1.3 m are walked over; wedged between two trunks the suit walks round one; a run from each spawn makes 100 m and more in 25 s in every heading on eight bodies except up a 41 degree slope | Lead: `tests/explorer.test.mjs`, scratch `run3/spawnrun.mjs` |
| The third-person camera in a thicket and at the ship | Pilot | DONE: a squeezed boom slides the view into the eyes; stepping out, the view turns along the hull | Lead: `tests/explorer.test.mjs`, `tests/loop.test.mjs`, frames at the three thicket vistas |

## Milestone 4: critique swap and ship: PREPARED, waiting for the coordinator's word

| Item | Owner | Status |
| --- | --- | --- |
| Every check, one command, one table | Pilot | DONE: `node tests/all.mjs --export` (a clean export of the last commit; three unit suites, the brief's static rules, eight scripted browser runs). Last run: export of `db22516`, 12 of 13 pass (the thirteenth was a fault in the step itself, fixed). Run again on the export of `d149255` (PAINTER's block 2, PHYSICS' P7.5, the boom, the stalled-sink guard and the gentler low pace all in): **ALL 13 PASSED** (unit 105, PHYSICS 222, PAINTER 19, static, play-through 37 on stubs, with PHYSICS and in the painted world, the trip 47 on stubs and in the painted world, m3 28 on stubs and in the painted world, pointer lock 7, sound), 33 minutes. |
| README for a new player | Pilot | DONE: where to play, the first minute, every control, the read-out line by line, what the tiers draw, what was never verified on real hardware; the static step of `all.mjs` fails if a control of the help card is missing from it |
| Blunt critique of the other two domains, as a player | each role | Pilot's is in `docs/notes/pilot.md` ("Critique swap"); Painter's and Physics' of the others are theirs to write |
| Fix the worst issues | all | TODO: the one MUST FIX above first, then each role's SHOULD FIX list (review 5 and its addendum) |
| One pull request `cosmos` -> `main` through the REST API, merged; GitHub Pages from `main` | Pilot | TODO, once, when the coordinator says so (`docs/COORDINATOR.md` section E has the commands). `index.html` has only relative URLs (checked by `all.mjs`) |

## "Done means" checklist (the brief), line by line

| Requirement | Status | Evidence (all run by the lead) |
| --- | --- | --- |
| A new player can open index.html | DONE | The title card is the loading screen and says "click to begin" when the first view is painted (`m3check`); relative URLs only, no build step, no asset files, Three.js from `./vendor` (`all.mjs`, step `static`); every browser run fails on a request that leaves the page's own server and none has |
| ...start on Earth in the forest | DONE | A fresh game stands in `temperate_forest` at the spawn, the ship 16 m away (play-through; first frame of `weather.jpg`) |
| ...walk, use the jetpack | DONE | `tests/explorer.test.mjs`, play-through in the painted world with real key events; nothing stalls a run any more (boulders are walked over) |
| ...board the ship, reach space | DONE | Play-through: board with E, lift off, climb above the air with no loading screen, come back, land on the legs, step out |
| ...land on all eight planets | DONE as mechanics, PART as play: 40 scripted landings on ten bodies in the pure simulation on the real terrain and a 240-spot survey (235 land, 5 refuse with a word on screen); in a browser the trip lands on Mars and Saturn. Nobody has flown to all eight in one browser sitting | `tests/contract.test.mjs`, `node tests/trip.mjs`, review 4 |
| ...and find different biomes on each | DONE | 33 biomes on the eight planets, each showing its landform clearly (27) or partly (6) on the tour sheets; the sketchbook counts them and keeps a sketch of each (`m3check`, review 4) |
| Every frame along the way passes the freeze-frame test | **PART** | On foot by day most frames read as watercolours (tour sheets, review 4), and so do the storm by day and the blizzard (review 5). Still digital: pepper in every dark wash and in space; rain strokes; the lightning frame's white specks; the near-ground flicks on snow and on lawns; three orbit views (Mercury, Neptune, Earth's cloud); straight-edged crystals and dunes; two vistas with a wall in front of the easel. Night was seen only in the weather sheet; flight and space have not been judged since review 4; nothing has been judged in motion by eye |
| No console errors | DONE for every scripted run | Tour (114 frames, review 4), weather set (12 frames), cost run (36 measurements), and the eight browser runs of `all.mjs` |
| The frame-rate target holds (60 fps at 1080p on an integrated GPU, never under 30) | **RISK, unmeasured** | Cannot be measured here. There is no triangle budget any more (the owner's instruction, 2026-11-11): the tiers and dynamic resolution carry this line on their own; the controller starts at the best picture, sheds load within a second or two when frames are slow and is unit-tested on model machines; the read-out is there for the owner. No frame time from any real GPU exists |
| The README lists the controls | DONE | `README.md`; `all.mjs` checks every key of the help card against it |

## Risks and what is off track

1. **Frame rate is unmeasured.** Every claim about 60 fps is reasoning from triangle counts
   and pass counts. Someone must open the game on a real integrated GPU and read the `
   read-out before the pull request; until then this is the largest risk in the project.
2. **Painter is still the critical path**: one MUST FIX (1.8 % in one view), then stars and
   the pulse in space, the art pass on the weakest biome of every planet, and the SHOULD FIX
   list of review 5, with one role on its fifth agent.
3. **Nothing has been judged in motion.** Every look judgement is a still; every feel
   judgement is a number from a 60 Hz simulation or a browser at one to three frames a
   second. The tour was last run on `ded1435` (review 4), before weather, models and the
   near-ground layer.
4. **The first storm a new player meets arrives after dark** (day length against the default
   seed). Cheap to move (Physics' seed, or the hour the game begins).
5. **Nobody has heard the sound, held a real mouse or a real pad to it.** Measured levels and
   a proven pointer-lock fallback are substitutes, not the thing itself.
6. **Build hitches are unmeasured**: the worst `world.update` frame cannot be read in software
   GL (the builder takes 30 % of a slow frame by design); a pin for the slice is still asked
   for (review 4, item 9).
7. **Agents run out of context.** Notes and lead files are kept able to stand alone; every
   role's notes open with a handover.
