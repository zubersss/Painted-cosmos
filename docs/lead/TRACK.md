# TRACK: the path to "Done means"

Owner: PILOT as lead developer. Updated at every sync. Status words: DONE (verified, by whom
and how), PART (works, with the stated gap), TODO, RISK.
A role's milestone is done only when `docs/lead/REVIEW.md` has no open MUST FIX for it (the
coordinator can waive an item).

Last update: 2026-11-12, by the tenth PILOT agent: review 6 (second half) on the art-pass head, and
milestone 3's verdict: **M3 can close** (no MUST FIX open; every item of the brief's M3 is in and
checked; what is left is look work for M4). All 13 checks pass in a clean tree; the grand tour lands on
all eight planets in one sitting; the top-tier tour of all ten bodies settles every frame with no
console error (8 of 10 arrivals pass); motion and weather re-measured (`docs/lead/REVIEW.md`, top).
Before that, the ninth PILOT agent: review 7 (code) of everything the other roles
committed since `a671ca7` (risk 10). Before that, the eighth PILOT agent: the hardening review's
PILOT fixes are in (risk 9). Before that, the seventh PILOT agent, during review 6: the first half (the
mechanics on the changed worlds, the sixth agent's runs) is on record; the top-tier tour was
stopped part-way (six bodies of ten, Venus and Saturn from the sixth agent's sheets) because
the owner started an art pass over every planet (four agents); the tour and the second half
run again on the new pictures. Earlier: the third PILOT agent after review 5.

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
All eight planets have been landed on in one browser sitting with real keys
(`tests/grandtour.mjs`, 2026-11-11). M4 is prepared: one command runs every
check and prints a table (`node tests/all.mjs --export`), the README is complete for a new
player, the critique of the other two domains is in Pilot's notes. The two things nobody has
been able to check are still the frame rate on a real GPU and how the game sounds.

## Milestone 1: vertical slice: MET

| Item | Owner | Status | Verified how, by whom |
| --- | --- | --- | --- |
| Walk, run, jump, jetpack with recharging fuel | Pilot | DONE; **the explorer steps** (2026-11-11, seventh PILOT agent): PHYSICS' gait reaches the figure (ride, stride, feet, footDown, surge, crouch01, gait; camera on the stride's mean), footsteps on its footfalls, a 0.12 s fold before a standing jump (0.06 s from a run), C strolls at 1.7 m/s (a walking gait); `tests/figure.test.mjs`; seen in a browser with PAINTER's snapshot figure; PAINTER's stepping figure is not committed yet | Lead: `tests/explorer.test.mjs`, `tests/loop.test.mjs`, `node tests/playthrough.mjs` (37 checks; re-run 2026-11-11 on stubs, with Physics, and in the painted world) |
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
| Landing anywhere | Pilot | DONE: 40 of 40 scripted landings on ten bodies in the contract test; a wider survey of 240 spots lands 235, and the 5 refusals say why on screen. **Re-run after the spawns moved** (review 6, first half, sixth PILOT agent, PAINTER `ad17d2c`): 235 of 240 again; at every spawn walk, board, fly, land, step out 10 of 10 | Lead: `tests/contract.test.mjs`; survey in Pilot's notes; REVIEW, review 6 first half |
| Planet map, save | Pilot | DONE (painted theme) | Lead: the trip (click sets the course; a reload continues from the save) |
| Physics wired in | Pilot + Physics | DONE on Pilot's side | Lead: `tests/physics.test.mjs`; play-through and trip with Physics on |
| Frame read-out for the owner | Pilot | DONE (` key, `?stats=1`; now with the worst `world.update` frame) | Lead: the trip checks it shows numbers |
| All eight planets with 4+ biomes each | Painter | DONE: by the lead's reading of the tour sheets 27 of 33 biomes show the brief's landform clearly, 6 partly, none missing | Lead: review 4, `docs/lead/evidence/tour-<body>.jpg` (114 frames) |
| How each planet looks from orbit | Painter | PART: five of eight read as painted globes; Mercury and Neptune as glass balls, Earth's cloud hard-edged (SHOULD FIX) | Lead: the orbit frame of each tour sheet |
| ~~Frame budget on every planet (600 k triangles, 350 calls at quality 1)~~ | Painter | Withdrawn by the owner's instruction, 2026-11-11 (no triangle budget) | Lead: reviews 4 and 5 |
| `world.busy` drains; `world.update` inside 5 ms | Painter | `busy`: DONE (114 of 114 tour frames settled in 0.1 to 58 s). `world.update`: cannot be measured in software GL since the builder takes 30 % of a slow frame; a pin is asked for | Lead: review 4 |
| Earth to Mars to Saturn in one sitting with no reload | all | DONE (re-run in the painted world on PAINTER `ad17d2c`, PHYSICS `f0b58ea`, review 6 first half: PASS, 47 checks): on stubs, in the pure simulation on the real worlds, and in the painted game in a browser (47 checks, on the export of `db22516`, with the real models, weather and the near-ground layer in) | Lead: `node tests/trip.mjs`, `tests/contract.test.mjs`, `node tests/all.mjs --export` |

## Milestone 3: the painting comes alive: CAN CLOSE (the lead's verdict, review 6 second half, 2026-11-12; the coordinator closes it)

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
| Freeze-frame tour of every biome and every vista on every body | Lead | DONE, run on all ten bodies at the top tier on the art-pass head (review 6 second half: 30 frames, every one settled in 9 to 54 game frames, no console error; arrivals pass on 8 of 10, Pluto's and Mercury's fail on their boulders; Saturn's ring framed whole from orbit since ARTPASS wish 12); the tier-1 coverage of every biome and vista on all ten bodies followed: 107 frames, every one settled, no console error, every vista counted where stood; the landform of all 42 biomes in its frame, four partly (the Moon's rilles, Neptune's aurora, Earth's misty wetland, Uranus' frozen waves); its worst frame a frozen wave at the lens on a Uranus vista (REVIEW 3b). As an instrument: `node tests/tour.mjs` writes `docs/lead/evidence/tour-<body>.jpg` and `.json`; says on the sheet what did not settle, who stands in liquid, what each frame cost; stops at once if the game fell back to a stub. Last used: review 6 at the top tier, spawn and first vista of six bodies (PAINTER `b022507`), stopped for the art pass; the tier-1 coverage of every biome has not been run since review 4 | Lead: sheets `docs/lead/evidence/tour-top-*.jpg` |
| Weather in the game: sky, haze, light, wet ground, fresh snow, waves, Physics' marks drawn by the world | Painter + Physics | PART (review 5, in the game itself): the storm by day passes as a watercolour of a wet wood; the blizzard is the best frame; cost is small (kits 1 to 5 draw calls, at most 3.5 k triangles). Open: rain as pale opaque strokes (a glaze was committed after the review's frames), white specks round the crowns in the lightning frame, the near-ground layer drawn on top of fresh snow, puddles that read as holes, Neptune's sea untouched by its storm sky, a dust storm with nothing in the air near the eye. Physics' storm wind is in since (see below) | Lead: `docs/lead/evidence/weather.jpg`, `.json` (`node tests/weather.mjs`) |
| ~~Frame budget with weather, real models and the near-ground layer~~ | Painter | **Withdrawn by the owner's instruction, 2026-11-11**: no count of triangles or draw calls is a gate at any tier. `tests/cost.mjs` still reports what each view draws (last: the vista `temperate_forest-1` 611 k / 339 at quality 1 on `0de3fb4`; Painter reports 540 k / 305 after not drawing far worlds that cannot be seen) | Lead: `cost-recheck.json` |
| Pepper in dark washes and in space | Painter | DONE for the washes (addendum to review 5: storm sky, Neptune's sky, night, space, pulse, looked at 1:1). Left as SHOULD FIX: the ragged border's hard dots in dark scenes; no stars in space | Lead: `weather-recheck.jpg`, `space-recheck.jpg` |
| Storms bring their own wind | Physics | DONE (P7.4): thunderstorm 10 to 23 m/s above the wood, blizzard 12 to 25 at 10 m, dust storm 10 to 20; walked and flown in the browser through the storm at the spawn (walk 3.5 to 4.0 m/s in every heading, hop carried 4 m, ship lands) | Lead: Node on the export, `run3/stormwalk.mjs` in the browser |
| Real explorer and ship models | Painter | DONE as far as the lead has looked: in every third-person frame of review 5, one draw call each, a cast shade under both; not yet judged in motion or in the cockpit | Lead: `weather.jpg`, `cost.json` |
| Motion (wind, water, day-night), space washes, art pass on the weakest biome of every planet | Painter | DONE for M3 (review 6 second half): standing in the wind 0.17 % of the picture changes a frame, the turn holds R-PAINT-4 in all but 21 of 18720 blocks, the arrival no longer pops (0, was 498), space is indigo washes with spattered stars and a paper sun; the owner's art pass improved 36 of 42 biomes on all ten bodies. Open for M4: night at quality 0 goes near-black (ARTPASS wish 3; at the top tier the 22:00 storm reads as an indigo night), boulders as lozenges (wish 1), the landing's chase camera in a crown (PILOT) | Lead: `motion-*.jpg`, `tour-top-*.jpg`, `docs/lead/ARTPASS.md` |
| On foot nobody fights the ground | Pilot | DONE: boulders up to 1.3 m are walked over; wedged between two trunks the suit walks round one; a run from each spawn makes 100 m and more in 25 s in every heading on eight bodies except up a 41 degree slope | Lead: `tests/explorer.test.mjs`, scratch `run3/spawnrun.mjs` |
| The third-person camera in a thicket and at the ship | Pilot | DONE: a squeezed boom slides the view into the eyes; stepping out, the view turns along the hull | Lead: `tests/explorer.test.mjs`, `tests/loop.test.mjs`, frames at the three thicket vistas |

## Milestone 4: critique swap and ship: PREPARED, waiting for the coordinator's word

| Item | Owner | Status |
| --- | --- | --- |
| Every check, one command, one table | Pilot | DONE: `node tests/all.mjs --export`; **since 2026-11-11 every browser step fails when the real game falls back to a stub it was not asked for** (`window.__pc.info().fallback`, `tests/browser.mjs` `fallbackProblem`; the import cycle of `6d5c02a` had hidden a broken head from every Node test); first run in a browser on 2026-11-12 (review 6 second half: every painted step printed "every module the run asked for is the real one"). **Latest: ALL 13 PASSED** in a clean tree (PAINTER and PHYSICS `5efc7f4`, PILOT `9c93e77`; unit 142, PHYSICS 291, PAINTER 19, static, play-through 38 x 3, trip 50 x 2, m3 31 x 2, pointer lock 9, sound), 54 minutes. Before that: export of `db22516`, 12 of 13 pass (the thirteenth was a fault in the step itself, fixed). Run again on the export of `d149255` (PAINTER's block 2, PHYSICS' P7.5, the boom, the stalled-sink guard and the gentler low pace all in): **ALL 13 PASSED** (unit 105, PHYSICS 222, PAINTER 19, static, play-through 37 on stubs, with PHYSICS and in the painted world, the trip 47 on stubs and in the painted world, m3 28 on stubs and in the painted world, pointer lock 7, sound), 33 minutes. |
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
| ...land on all eight planets | DONE, as mechanics and as play. **Re-run on the art-pass head** (review 6 second half, tenth PILOT agent, clean export of `5efc7f4`, 2026-11-12): PASSED, 8 of 8 on the first E, one pulse a leg, no bounce, no reload, no console error, 1659 s of play in 39.4 minutes (`docs/lead/evidence/grandtour.json`, `docs/shots/pilot/grandtour.jpg`, opened). Earlier: `node tests/grandtour.mjs` on a clean export of `5e62268` (2026-11-11): from the title card, with real key and mouse events, walk, jetpack, board, lift off, space, then pulse to, land on and walk on Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune and Earth again: 8 of 8 in one sitting (31.6 minutes, 1659 s of play), no reload, no console error, no bump, every landing on the first E. Painted world at quality 0, 400x225 (it proves the play, not the picture). One leg (Venus to Mars) was stopped short by the world just left and went round it; the screen's word for that is now clearer. **The Moon and Pluto too** (2026-11-11, `--bodies moon,pluto --from earth`, clean tree of `da6d42d` with PILOT's `b36435a`, same small picture): both landed on the first E and walked on, 7 minutes; ten bodies landed on in the browser is the full set. **Re-run after the spawns moved** (review 6, first half, by the sixth PILOT agent on a clean tree of PAINTER `ad17d2c`, PHYSICS `f0b58ea`, PILOT `54ba154`): the eight planets 8 of 8 on the first E, no console error, 1619 s of play; the Moon and Pluto 2 of 2. Also 40 scripted landings on ten bodies in the pure simulation and the 240-spot survey | `docs/lead/evidence/grandtour.json`, `docs/shots/pilot/grandtour.jpg` (opened), `tests/contract.test.mjs`, `node tests/trip.mjs` |
| ...and find different biomes on each | DONE | Review 6 second half (tier-1 coverage on the art-pass head): all 42 biomes of the ten bodies show their landform, 38 clearly and 4 partly (the Moon's rilles, Neptune's aurora tundra, Earth's misty wetland, Uranus' frozen waves). Earlier: 33 biomes on the eight planets, each showing its landform clearly (27) or partly (6) on the tour sheets; the sketchbook counts them and keeps a sketch of each (`m3check`, review 4) |
| Every frame along the way passes the freeze-frame test | **PART** | **Review 6 second half, top tier, all ten bodies on the art-pass head**: the arrivals of Earth, Mars, the Moon, Venus, Jupiter, Saturn, Uranus and Neptune pass; Pluto's and Mercury's fail on fields of smooth lozenge boulders; every vista passes but Saturn's (a trunk at the lens) and Neptune's stacks (boxes); night at quality 0 goes near-black (an indigo night at the top tier); Mars from orbit is not Mars; foliage edges break into specks on Mars, Saturn, Venus (REVIEW, top). Before that, review 6 at the top tier (partial, PAINTER `b022507`): the first views of Earth, Jupiter, Venus, Saturn and Uranus pass, the Moon's passes without saying Earth's moon, Mars's fails on pixel-specked shrubs, Mercury's fails outright; the vistas are the strongest frames; boulders are plastic lozenges on four worlds; Earth's far birches a picket fence (REVIEW, "Review 6, the tour"). The art pass now running will change all of it. Earlier: on foot by day most frames read as watercolours (tour sheets, review 4), and so do the storm by day and the blizzard (review 5). Still digital: pepper in every dark wash and in space; rain strokes; the lightning frame's white specks; the near-ground flicks on snow and on lawns; three orbit views (Mercury, Neptune, Earth's cloud); straight-edged crystals and dunes; two vistas with a wall in front of the easel. Night was seen only in the weather sheet; flight and space have not been judged since review 4. In motion (measured 2026-11-11, `tests/motion.mjs`, top tier): still frames hold (0.30 % change a frame in the wind, 0 with the clock stopped), no shower door in a turn; arrival at a new place pops (the canopy in one frame, then the ground for a second) and near flowers are flat discs |
| No console errors | DONE for every scripted run | Review 6 second half: all 13 checks, the grand tour, the top-tier tour (30 frames), the motion set (9 scenes), the weather set. Earlier: tour (114 frames, review 4), weather set (12 frames), cost run (36 measurements), and the eight browser runs of `all.mjs` |
| The frame-rate target holds (60 fps at 1080p on an integrated GPU, never under 30) | **RISK, unmeasured** | Cannot be measured here. There is no triangle budget any more (the owner's instruction, 2026-11-11): the tiers and dynamic resolution carry this line on their own; the controller starts at the best picture, sheds load within a second or two when frames are slow and is unit-tested on model machines; the read-out is there for the owner. No frame time from any real GPU exists |
| The README lists the controls | DONE | `README.md`; `all.mjs` checks every key of the help card against it |

## Risks and what is off track

1. **Frame rate is unmeasured.** Every claim about 60 fps is reasoning; and since the owner's
   instruction of 2026-11-11 the game starts at the top tier and full resolution and relies on
   a controller that has only met model machines and software rendering. Someone must open the game on a real integrated GPU and read the `
   read-out before the pull request; until then this is the largest risk in the project.
2. **Painter is still the critical path**: no MUST FIX is open (the budget one is withdrawn),
   but the owner's quality push (fuller ground, trees and distance at the top tier) lands on
   one role on its sixth agent, and every look judgement must be made again at the top tier
   after it. Software frames here get slower as the scenes get fuller.
3. **The picture in motion has been measured, not watched.** `tests/motion.mjs` (2026-11-11)
   takes consecutive frames at a fixed step and measures what changes: the same instant
   paints the same picture, standing in the wind 0.30 % of the picture changes a frame with
   sky, paper and ground still, nothing sticks to the screen in a turn; arrival is a pop and
   tiers change in one frame (REVIEW, "Before review 6"). Nobody has watched the game at 60
   frames a second; every feel judgement is still a number from a simulation or a browser
   at a frame every few seconds. The tour was last run on `ded1435` (review 4), before weather, models and the
   near-ground layer.
4. ~~The first storm a new player meets arrives after dark.~~ Closed: Physics moved Earth's
   weather clock (`1cbbcc6`); the storm crosses the spawn from 160 to 320 s of play, noon to
   half past two, and the weather set shows it arriving in daylight (`weather.jpg`).
5. **Nobody has heard the sound, held a real mouse or a real pad to it.** Measured levels and
   a proven pointer-lock fallback are substitutes, not the thing itself.
6. **Build hitches are unmeasured**: the worst `world.update` frame cannot be read in software
   GL (the builder takes 30 % of a slow frame by design); a pin for the slice is still asked
   for (review 4, item 9).
7. ~~The art pass changes every world's look at once.~~ Closed: it returned (`5f12995`) and
   review 6's second half was run on it (all 13 checks, the tours, motion, weather, settle times).
   The Moon boulder run was not re-run by the lead (PHYSICS 18 ran it in the game; its
   classification changed by the coordinator's ruling).
8. **Agents run out of context.** Notes and lead files are kept able to stand alone; every
   role's notes open with a handover.
9. **The hardening review (2026-11-11, `docs/lead/HARDENING.md`)**: PILOT's fifteen fixes are
   in (eighth PILOT agent, `932cd9d`, `b990e8b`, `085d5e1`; record in `docs/notes/pilot.md`,
   "Eighth agent"): sound now starts inside a gesture (Safari and pad-only players were silent),
   non-standard pads are ignored (they could spin the camera), shaders compile behind the card
   (0 compiles after ready in the real game, was 2 in a short run), the controller no longer
   pins tier 0 under a refresh cap or reacts to single hitches, pointer lock survives Esc and
   30 fps flicks, keys follow the keyboard's layout, the output is capped at 3.7 MP, plain
   sentences for no WebGL 2, no float targets, a failed load and a lost context. Open: PAINTER's
   A1 (no early-Z without EXT_clip_control) and the A2 hooks (in their working files, tested
   with mine), a float-target fallback (PAINTER, low); still never run on Safari, Firefox or real
   hardware. (Since: PAINTER's A1, A2 and the 8-bit fallback are committed and accepted; review 7
   read them against my caller and found nothing to fix.)
10. **Review 7 (code), 2026-11-12, ninth PILOT agent** (`docs/lead/REVIEW.md`, top): one MUST FIX
   for PHYSICS (the explorer's ghost run overwrites the walker's own up and ground: up to 2.2 m/s
   lost in a step and 1.1 m/s thrown radially running through a boulder field anywhere off the
   x-z plane; a four-line fix given and checked), two SHOULD FIX for PHYSICS in the sea map (the
   crests slide 15 m after every re-anchor, a one-line fix checked; one-frame steps of up to
   0.24 m and 28 degrees at fixed places when a build lands, to fix before PAINTER wires the map).
   Nothing to fix in PAINTER 11. PILOT's explorer now asks the air as the body feels it.
11. **Review 6 (second half), 2026-11-12, tenth PILOT agent** (`docs/lead/REVIEW.md`, top): no MUST
   FIX; M3 can close. Open for M4: PAINTER's `obstacles.js` misses trunks and boulders in wide discs
   (SHOULD FIX now: the ship's landing and canopy checks ask 20 to 80 m; 260 of 536 trunks listed at
   80 m on Earth), the boulder fields of Pluto's and Mercury's arrivals, the night key at quality 0, Mars from
   orbit, foliage specks; PILOT's chase camera inside a crown in a forest landing (372 pops in the
   motion set). PILOT changes not yet seen in a browser: the camera under a rise, Neptune's new
   season, berths out of the surf, the floating ship.
