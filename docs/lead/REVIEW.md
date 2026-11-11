# REVIEW: dated findings per role

Owner: PILOT as lead developer. Each finding has its evidence and the check it is measured
against (`R-...` ids are in `docs/lead/REFERENCES.md`; "AB n" is point n of the art bible).
MUST FIX blocks the milestone. Answer each MUST FIX in your own notes ("fixed in <commit>" or
"disagree, because ..."). I never edit your files; how to fix is your call.

Everything here was run by me, not taken from anyone's notes. Software GL only: frame rates
are relative, never a claim about a real GPU.

---

## Review 4: 2026-11-11, at commit `ded1435` (PAINTER's third pass `334eb16`; before its weather block)

The gate for M2 as a whole. Everything below was run by me on a clean export of `ded1435`,
one browser at a time, in software GL. The tour sheets and their numbers are in
`docs/lead/evidence/tour-<body>.jpg` and `.json` (960x540, quality 1, 10:00 local time, HUD
hidden; biome frames in first person from the world's stand, vistas in third person as the
player arrives, one frame from orbit). The plan this review follows is the next section.

**Verdict: M2 has one open MUST FIX for PAINTER, a small one (item 1). With it fixed or
waived by the coordinator, M2 is closed.** PHYSICS: no MUST FIX. PILOT: none known.

What I ran, and what came back:
- `node --test tests/contract.test.mjs`: 8 of 8. The contract holds on all ten bodies, the
  terrain stays under the ceiling, spawns are dry and gentle, 39 of 40 scripted landings set
  down (one honest "too steep" on Earth at -20, -60), and the Earth, Mars, Saturn trip flies in
  the pure simulation on the real worlds (lands in `rust_canyons` and `ring_shadow`).
  `node --test src/world/*.test.mjs`: 19 pass. `node --test tests/*.test.mjs`: 102 pass.
  `node --test src/physics/`: 196 of 197 on this export, which is a coordinator's snapshot of
  PHYSICS' files in mid-edit; its accepted P6 commit is later (not re-run by me).
- Landing survey, 24 spots a body: 235 of 240 from a hover (3 "too steep", 2 "no level
  ground", all said on screen); 232 of 240 entered at speed. No body has a biome that cannot
  be landed in.
- The tour of all ten bodies: 114 frames, **every one settled** (`world.busy` at 0 for ten
  frames) in 0.1 to 58 s, **no console errors**, every vista counted as found where the
  explorer was put, no place had to be moved off wet or steep ground, nobody stands in liquid.
- Cost in the game, the dearest frame of each body at quality 1 (budget 600 k triangles, 350
  draw calls):

  | body | triangles | draw calls | where |
  | --- | --- | --- | --- |
  | mercury | 409 k | 365 (344 without my placeholder models) | vista `crystal_gardens-2` |
  | venus | 545 k | 293 | vista `fungal_towers-2` |
  | **earth** | **652 k (645 k without the models)** | **368 (352)** | vista `temperate_forest-1` |
  | mars | 347 k | 240 | `rust_canyons`, `dry_riverbeds` |
  | jupiter | 535 k | 292 | vistas `hanging_gardens-2`, `sky_islands-1` |
  | saturn | 438 k | 260 | vistas `crystal_reeds-2`, `gold_islands-1` |
  | uranus | 375 k | 215 | vista `teal_sinkholes-1` |
  | neptune | 418 k | 261 | vistas `storm_seas-1`, `aurora_tundra-1` |
  | moon, pluto | 410 k, 318 k | 185, 189 | |

  The two bold numbers were measured again, five frames each, settled, with and without the
  explorer and ship (scratch `run2/remeasure.mjs`): identical every frame.
  Neptune's `kelp_forests` is 359 k (review 3: 727 k). Quality 0 and 2 were not measured in
  the game in this review (PAINTER's gallery: at most 299 k at quality 0).
- `world.update` worst frame: 42 to 511 ms on the tour. That is not a measurement of the 5 ms
  budget: in software GL a frame takes 300 to 1000 ms, and above 80 ms PAINTER's builder takes
  30 % of the frame on purpose. At real frame rates the slice is said to be 4 ms; nobody here
  can check that. See SHOULD FIX 9.
- Space and the pulse drive at 960x540, quality 1: `docs/shots/pilot/m2-pulse.jpg` (new).
- `R-WX-1`: measured, and reworded in `REFERENCES.md` (see PHYSICS below).

### PAINTER

MUST FIX (M2)

1. **Earth's first vista is over the frame budget.** Standing at the vista
   `earth-temperate_forest-1` (the easel of the home forest, the first view a new player will
   find) at quality 1, the game submits **645 k triangles and 352 draw calls for the world
   alone**, 652 k and 368 with the placeholder explorer and ship. The budget, upheld by the
   coordinator, is 600 k and 350 in the densest view, measured in the integrated game. To see
   it: `index.html?stats=1&quality=1&dynres=0`, then in the console
   `v = __pc.world.getVistas('earth')[0]; __pc.teleport({ body: 'earth', dir: [v.unitDir.x, v.unitDir.y, v.unitDir.z], heading: v.yaw * 57.2958 })`,
   wait for `world.busy === 0`, read the second line of the read-out. Wanted: 600 k or less
   and 350 or less there, with room for the real explorer and ship (my placeholders cost 7 k
   triangles and about 20 calls; Mercury's `crystal_gardens-2` is at 344 calls without them
   and will go over with them). Honest note for the coordinator: the overrun is 7.5 %, in one
   view, against a budget that is itself a stand-in for a frame rate nobody can measure here;
   a waiver would be defensible. I hold it because the budget only means something if the
   densest view of the showcase obeys it, and because the weather block has since added more.

SHOULD FIX (none blocks M2; several are M3's art pass in all but name)

2. **Three second-site vistas stand in a thicket**: `mercury-crystal_gardens-2` and
   `uranus-frozen_waves-2` (the third-person camera is jammed against a crystal or a wave and
   the frame is the back of a hat), `saturn-crystal_reeds-2` (reed stalks between the camera
   and the explorer). The easels are tested to stand on open, dry ground of their biome; the
   second sites need the same test plus a few metres clear of tall kits. (Mine as well: when
   the boom is squeezed under two metres the camera should go to first person. Noted.)
3. **From orbit, Mercury and Neptune read as glass balls**: a dark disc inside a bright rim
   line. `R-SPACE-5` wants a rim that fades to paper. Earth's cloud is hard-edged white
   patches with dashes round the limb. Venus, Mars, Jupiter, Saturn and Uranus read as painted
   globes; Saturn with its rings across the frame is the best orbit view in the game.
4. **Dark washes are peppered** (`m2-pulse.jpg`, Mercury's sky, Neptune's sea and sky): dense,
   hard, dark specks two to four pixels across are the first thing the eye meets in space.
   Art bible 3 wants granulation that settles into the paper's grain, 8 wants salt and
   spattered stars. Space is M3 by the brief, so this does not gate M2; in M3 it is a MUST.
   In the pulse frame nothing streaks or softens yet (`speed01` is 1 there).
5. **Mars' dunes at mid-morning** are flat tan planes divided by ruler-straight crest lines
   (art bible 4); they were painted for 16:12 and the player arrives at any hour.
   `dry_riverbeds` shows the grove and no bed.
6. **Uranus**: `ice_shelves` is a rounded scarp, `frozen_waves` are capped mounds (your own
   "partly"). The glowing sinkhole is the frame to bring them up to.
7. **Crystals and blades** (Mercury) keep straight edges and flat faces: they read as cut
   paper more than as washes. Venus' fungal towers are still the busiest frame (review 3,
   item 4), and Venus and Mars have dark, hard-edged blots lying on the foreground.
8. **Earth**: `misty_wetland` is nearly empty; `sea_coast` is a cove under cliffs more than a
   sea. Both show their feature; neither is yet a picture one would walk to.
9. **A way to pin the build slice**: accepted that above 80 ms a frame the builder takes 30 %
   of it (a machine that slow is unplayable anyway, and it catches up sooner). But it leaves
   me unable to measure the 5 ms worst frame at all in software GL. Please let
   `world.setBuildBudget(ms, { fixed: true })` (or a URL switch) hold the slice at its real
   value, so the read-out's "world worst" means something in a headless run.

GOOD
- **Every biome the brief names is there**, in the game, where the player is put: canyon
  walls and a butte on Earth, strata and spires on Mars, lava through basalt and a green acid
  lake on Venus, sky-islands in a cloud sea and vines down a cliff on Jupiter, the ring arc
  over Saturn's islands, the teal sinkhole, basalt stacks in an ultramarine sea, the crater
  bowl on Mercury. By my reading of the eight sheets: 27 of 33 clearly, 6 partly
  (`mars-dust_dunes` at this hour, `mars-dry_riverbeds`, `uranus-ice_shelves`,
  `uranus-frozen_waves`, `neptune-aurora_tundra`, `jupiter-lightning_plains`), none missing.
  The stretched ground streaks and the hexagon cracks of the second pass are gone.
- `world.busy` drains everywhere (review 3, item 2: closed). Neptune's spawn is inside the
  budget (review 3, MUST FIX 1: closed).
- The stands and easels: arriving in a biome now shows the biome. `findBiome` with `yaw` and
  `pitch` made the tour honest without any guessing on my side.
- 40 landings, a 240-spot survey and the trip survive a pass that changed every landform.

### PHYSICS

No MUST FIX.
- `R-WX-1`, the question left for this review: does 5 %/s stand for snow squalls? Measured
  through `physics.here.sky` at 2 Hz for half an hour at twelve places a body (scratch
  `run2/squall2.mjs`): on Earth a snow front moves haze 6.3 %/s and snowfall 5.1 %/s,
  everything else under 2.2 %/s; on Uranus nothing over 4.3 %/s; on Neptune rain 8 %/s at a
  storm front, a fog bank 14.6 %/s, overcast 6.2 %/s. So: no, not as a single number. The
  fronts are physical and stay. The check now reads 8 %/s on Earth-like worlds and 15 %/s on
  the ice giants, and PAINTER eases what it shows with a time constant of 2 s or more.
- SHOULD FIX: the stateless query disagrees with the state. `physics.sky(physics.weather(body,
  p, {}, { time }))` at a fixed place, stepping one second: `wet` jumps 55 % in a second on
  Uranus under "windy" and `snow` 10.7 % (scratch `run2/squall.mjs`), while `here.sky` at the
  same places moves 0.5 %. Anyone who reads weather away from the focus will see pops.
- SHOULD FIX (carried from review 3): one test was red in the snapshot `ded1435`.
- Taken from P6, all five levers (in my notes, Decisions 15); flown only by the unit tests
  and one scripted trip so far.

### PILOT (self-review)

- Found by this review in my own domain: the third-person camera has no answer to a thicket
  (item 2); the tour's sheet capture failed twice in a tired browser (fixed: the numbers are
  written first, the sheet is laid out in a fresh browser if need be); the landing prompt
  flickered over rough ground (fixed earlier in this run).
- The painted trip and play-through passed in the browser on the export of `5d411f2`, which
  had PAINTER's work in progress, not `334eb16`. On `ded1435` the browser has stood in every
  biome and at every vista without an error, and the trip passes in the pure simulation; the
  scripted browser trip on the reported commit itself was not re-run.

---

## Review 4: the plan it followed (written before PAINTER's third pass had reported)

Review 4 is the gate for M2 as a whole. It starts when the coordinator relays PAINTER's report,
and it is run on a clean export of that commit (`tools/export-head.sh`), one browser at a time.

1. **Contract and landings** (seconds): `node --test tests/contract.test.mjs` (the contract on
   every body, terrain ceiling, dry spawns, 40 landings, the real-world trip in the pure
   simulation), `node --test src/world/*.test.mjs`, `node --test src/physics/`. Then the
   landing survey (scratch `run2/landsurvey.mjs <export> 24`): 24 spots on every body, from a
   hover and at speed. Baseline before the pass: 235 of 240 land; every refusal says why.
   MUST FIX if a body has a biome nobody can land in, or a refusal without a word.
2. **Cost per body, in the integrated game**: the tour records triangles and draw calls for
   every biome frame and every vista frame at quality 1 (budget 600 k triangles, 350 calls;
   review 3 found Neptune's `kelp_forests` at 727 k). Quality 0 (300 k) and 2 (1.2 M) at each
   body's densest frame with `?quality=0|2&dynres=0&stats=1`. MUST FIX over budget.
3. **`world.busy`**: every tour frame must settle (ten frames in a row at 0) within 120 s in
   software GL; the sheet says which did not. Baseline on PAINTER's committed state of
   2026-11-11 (`a46647f` export): no Earth biome frame settled in 90 s (busy 267 to 412).
   MUST FIX if frames still do not settle: it is the readiness signal for the title card,
   for sketches and for every capture, and PAINTER's own test for it must pass.
4. **`world.update` worst frame**: the tour's caption carries the worst of the last 90 frames
   at each place (software GL on a shared machine: read as relative, and re-measured in Node
   through PAINTER's own profile where a number looks bad). Budget 5 ms. SHOULD FIX unless it
   is tens of milliseconds on arrival, which a player would feel as a hitch.
5. **The freeze-frame test, frame by frame**: `node tests/tour.mjs --bodies <b>` for all ten
   bodies at 960x540, quality 1: every biome (on dry ground of that biome), every vista
   (where the game sends the player, facing the painter's way), one frame from orbit. Each
   frame is judged against the art bible's ten points and against the brief's own words for
   that biome ("rust canyons", "floating sky-islands in banded cloud seas", ...). One line a
   frame in the review: does it show its named landform (yes / partly / no), what reads as
   digital (facets, ruler-straight edges, stretched streaks, tiling, pepper grain, flat
   washes, dark shade instead of a glaze), and whether the vista is a view worth walking to.
   MUST FIX: a biome whose named feature is not in its frame, a vista under liquid or on a
   cliff face, visible facets or streaks. The coordinator can waive single biomes.
6. **From orbit and in space**: the orbit frame of every body (distinct biome colours, soft
   terminator, rim that fades to paper, no seams: `R-SPACE-5`), and the dark specks in space
   seen in `docs/shots/pilot/m2-pulse.jpg` (art bible 1: nothing is black; 8: salt and
   spattered stars, not pepper). Re-shoot the pulse frame at 960x540 and look at it at full
   size. SHOULD FIX unless it reads as noise at a glance, then MUST.
7. **The trip and the loop in the painted worlds**: `node tests/playthrough.mjs` and
   `node tests/trip.mjs` on the export (400x225 for the run, 960x540 for the evidence frames).
   MUST FIX on any console error or a leg that cannot be flown.
8. **`R-WX-1` and snow squalls** (PHYSICS): does the 5 %/s limit on visibility stand? Measure
   `physics.here.sky` at 10 Hz through a squall front on Uranus or Neptune and through the
   Earth thunderstorm (`find=` in the lab gives the place and time): the largest change per
   second of `haze`, `fog`, `snowfall`. The check already allows fog banks and dust fronts to
   arrive faster; if a squall front does too, the check is reworded for precipitation fronts
   and PAINTER is asked to low-pass what it shows (a pop in the picture is the real fault).
9. **Not in review 4** (M3, listed so nobody builds on sand): weather in the picture, the real
   models, night and dusk as paintings, the interface theme (PILOT's; PAINTER reviews it).

Interim finding for PAINTER, measured during this run (no need to wait for review 4):
`world.busy` does not reach 0 on the committed state (item 3). If the fix is in your working
tree, say in your notes which commit carries it.

---

## Interim notes: 2026-11-11, second PILOT agent (not a milestone review)

What I ran is in `docs/notes/pilot.md` ("Ground truth"): every check on clean exports, the
painted play-through and trip, a landing survey of 240 spots, and the new tour on Earth.

### PAINTER (interim: your pass has not been reported, so nothing here is a verdict)

Seen on the tour sheet of Earth taken from your committed work-in-progress (export of
`a46647f`, 960x540, quality 1; the sheet is in my scratch, not in the repo, because it is not
your reported state):
- Better than the frames the coordinator turned down: `desert_canyon` now faces a banded wall
  with a mesa behind it, `alpine_meadow` has a mountain, `sea_coast` has cliffs round a cove,
  and the easels put the camera where the landform is. Keep going this way.
- **Nothing settled**: `world.busy` stood at 65 to 412 after 90 s in all eight frames on foot
  (it reached 0 in 7.6 s from orbit). This will be a MUST FIX in review 4 if it is still so.
- From orbit the globe is covered in hard-edged white patches with a ring of dashes round the
  limb: it reads as torn paper rather than cloud and rim. Look at it before you report.
- Cost was inside the budget in every frame (165 k to 420 k triangles, 118 to 244 calls), but
  on unsettled frames that proves little.

### PHYSICS

No MUST FIX. Used this run exactly as written in your notes: the touchdown recipe (the gear
takes the last metre: 0.6 m/s sink, three feet down and asleep within 5 s on Earth, the Moon
and Jupiter, `tests/physics.test.mjs`), `sky.rain`, `cover.canopy01`,
`particles.system.dripping`, `thunderIn` / `thunder01` and `st.phys.material` for the sound.
Your reading of the flight pace is right (the giants and Earth within 10 m/s): leave the
envelope, let the wind tell the giants apart; I will take a proposal when you have flown it.

### PILOT (self-review of this run; the other roles and the coordinator review this domain)

Added: the sketchbook's sketches, the measured and retuned sound, the painted interface
(paper, lettering, ink markers, cursor), touchdown on the legs, a gamepad, a tour that stands
where the game sends the player. Weak or unverified, bluntly:
- The interface theme is a first pass by someone who is not the painter. The lettering is
  neat rather than beautiful (one weight, no thick-and-thin), the paper slips cast a drop
  shadow that a real sheet on a painting would not, the icons are only four. PAINTER's call.
- The sound is measured, not heard. Timbres are still guesses (the ship is two oscillators).
- The gamepad has only met a simulated pad.
- The painted trip failed once on Saturn because E was pressed just as the prompt went out;
  fixed with hysteresis and a spoken reason; the re-run's result is in my notes.
- Sketches are 192x108: charming at thumbnail size, soft if ever shown larger.
- Planet markers and all HUD slips are DOM over the canvas: they do not get the painting's
  own paper grain or the ragged border treatment of the frame itself.

---

## Review 3: 2026-11-11, at commit `22a10c3` (Painter's `ff51af7` and `1e1801e`, Physics' P2 work in progress)

Short pass, during M2. What I ran:
- Frame cost standing at the spawn of every body in the integrated game (quality 1, 400x225,
  clean export of `ee4c336`; counters from the game's read-out).
- `tests/contract.test.mjs`: 40 landings (the spawn and three other places on each of the ten
  bodies) and the Earth-Mars-Saturn trip on Painter's real worlds with Physics on.
- `node --test src/physics/` on a clean export of `22a10c3`: 158 pass.
  `node --test src/world/*.test.mjs`: 12 pass.
- The scripted trip and the M1 loop inside the painted worlds (results in Pilot's notes).
- Looked at `docs/shots/painter/` (960x540): venus, neptune, mercury from orbit.

### PAINTER (M2 in progress)

MUST FIX (M2)

1. **Neptune's spawn is over budget: 727 k triangles at quality 1** (`kelp_forests`; budget
   600 k). Every other body is inside it:

   | body (biome at the spawn) | triangles | draw calls |
   | --- | --- | --- |
   | mercury (obsidian_fields) | 442 k | 296 |
   | venus (lava_rivers) | 312 k | 183 |
   | earth (temperate_forest) | 450 k | 266 |
   | moon (mare) | 333 k | 166 |
   | mars (dry_riverbeds) | 457 k | 247 |
   | jupiter (storm_wall) | 390 k | 206 |
   | saturn (gold_islands) | 394 k | 240 |
   | uranus (ice_shelves) | 334 k | 170 |
   | **neptune (kelp_forests)** | **727 k** | 295 |
   | pluto (lilac_mountains) | 443 k | 190 |

SHOULD FIX

2. **`world.busy` never drains after moving to another body.** After a teleport to each
   planet in turn it sat at 138 to 197 for 90 s and more (it reaches 0 on Earth at boot). If
   those are jobs for bodies the camera has left, they should be dropped; if they are for the
   body in view, something is starved. It is my readiness signal (`__pcReady`, `settle()`).
3. **`world.update` while building**: 8.5 ms on Mercury, 9.4 on Mars, 8.8 on Neptune, 6.3 on
   Earth (smoothed, right after arrival). Budget 5 ms a frame, upheld by the coordinator.
4. **Venus, fungal towers** (`docs/shots/painter/venus-fungal_towers.jpg`): the strongest idea
   so far, and the busiest frame: every stalk carries the same ruler-straight vertical hatch
   (AB 4), the orange foreground shapes are flat cut-outs with hard edges, and nothing recedes
   into the "amber cloud" the brief asks for (AB 5). Thin it: fewer, larger shapes far away.
5. **Neptune, storm seas**: a calm lake under a fair sky. Lovely, not a storm sea. With
   Physics' waves and weather now available this is the frame that should move most in M3.

GOOD

- Every body can be landed on and walked on, in every biome I tried: 40 of 40 landings,
  28 biomes, three of them afloat on Jupiter's and Neptune's liquid.
- Mars and Saturn arrived first, as planned, and the scripted trip plays through them.
- Space from orbit (`mercury-orbit.jpg`): the pepper of review 1 is gone; a soft wash with
  salt marks and a pale rim on the globe. Review 1 item 8 closed.
- `1e1801e` takes up review 2's items: violet shade glaze, wandering shores, and the Physics
  flora field is wired (not yet seen by me in the game: for review 4).

### PHYSICS (P2 in progress)

No MUST FIX.

- GOOD: asked for and delivered within the hour: `cmd.brake` (the drive field as a named
  brake, vacuum only by my choice; my special case is gone), a tested lift-off through the
  gear, a line about the step functions moving `st.p` in place. 158 tests pass on a clean
  export.
- SHOULD FIX: at one point during the restart recovery 7 of 154 tests failed in the working
  tree (uncommitted, mid-edit). Nothing wrong with that, but the other two roles run your
  tests from the same tree: commit green, or say in the notes when the tree is known red.
- SHOULD FIX: in the browser, under load, I still see a worst `physics.update` frame of about
  5 ms on the read-out (0.3 to 0.6 ms on average). Software GL and three busy processes make
  that number soft; it wants one look on a quiet machine.
- Open on my side, not yours: I do not yet call the gear lift-off (my sequence still sets the
  velocity for 2.8 s). First thing in M3 with the real ship model.

---

## Review 2: 2026-11-11, at commit `a9c02bc` (includes Painter's `b2bfcae` and `6a31de3`, Physics' `b0ad22b`)

What I ran:
- The same frame-cost probe as review 1, in the integrated game from a clean export
  (480x270, counters from the game's own read-out, `?stats=1`), at quality 0, 1 and 2.
- `gallery.html?...cam=trees&time=12&quality=1` at **960x540** (the coordinator's rule for
  judging look), `cam=stream` at 12 h and 0 h at 640x360.
- `node --test src/world/*.test.mjs`, `node --test src/physics/` (125 pass),
  `node --test tests/*.test.mjs` (91 pass; they fly Earth to Mars to Saturn on Painter's real
  worlds with Physics and the real obstacles, in the pure simulation).

### PAINTER: M1 is met

MUST FIX from review 1, all three **closed**:

1. **Frame cost: closed.** Measured in the integrated game:

   | view (quality 1) | triangles | draw calls | review 1 |
   | --- | --- | --- | --- |
   | standing at the spawn | 564 k | 334 | 4.36 M, 887 |
   | running | 529 k | 307 | 4.57 M, 848 |
   | flying at 120 m | 217 k | 143 | 1.47 M, 262 |
   | orbit at 5 km | 46 k | 41 | 43 k, 41 |

   Quality 0 at the spawn: 289 k, 206 calls. Quality 2: 708 k, 381 calls. All inside the budget
   (600 k / 350, 300 k, 1.2 M). Software GL at the same viewport went from 0.7 to about 3 fps.
2. **Stippled foliage: closed.** `docs/lead/evidence/painter-a9c02bc-gallery-trees-noon.jpg`
   (960x540): crowns are a few overlapping washes with darker accents; no pepper.
3. **Ruler-straight lines: closed.** Same frame: birches lean, taper and break into dry-brush
   marks; the bank of the brook wanders (`...-stream-noon.jpg`).

At 960x540 the home forest passes the freeze-frame test for me: I would take that frame for a
scan of a plein-air study.

SHOULD FIX (carried or new; none blocks)

4. **Build hitches, still.** `world.update` worst frames: 4 to 8 ms at quality 1 (flying
   8 ms), 12 ms running at quality 0. Budget 5 ms. Better than the 34 ms of review 1, not yet
   inside. The frame read-out now shows `world` ms live (` key).
5. **Shade is dark green, not a cool glaze.** The dappled patches on the clearing are the local
   colour darkened, with fairly hard edges. AB 2: shadows are cool transparent violet-blue
   glazes over the local colour.
6. **The foreground meadow** is still one broad wash with sparse marks (review 1 item 5): a
   few more grass-tip strokes near the eye, none far away.
7. **The far trunks** still stand in an even line like a fence in the `trees` frame (item 6).
8. Night (`...-stream-night.jpg`) is better: trunks take the glaze. Dusk and space unchanged
   from review 1 items 7 and 8; M3 scope.
9. `sampleObstacles` returns at most about 260 entries at large radii. Say in your notes
   whether they are the nearest ones; I keep my queries under 45 m meanwhile.

GOOD (new)

- `canopyHeight` on `sampleSurface`: wired into the ship's cushion the same hour; a low pass
  over the real forest keeps the hull above every tree top (`tests/contract.test.mjs`).
- Mars and Saturn placeholders already have distinct biomes to land in: the scripted trip
  ends in `dry_riverbeds` and `crystal_reeds`.

Answers to PAINTER's questions: the default boom is now 6.4 m (was 5.6) until the real
explorer exists. `speed01` and `altitude01`: nothing needed before M3; in M3 I would like
`speed01` near 1 (pulse) to soften and streak the far washes, and nothing from `altitude01`
that `inSpace01` does not already do.

### PHYSICS: P1 accepted by the coordinator; wiring done

- All of the wiring guide is in (commit after `a9c02bc`): `createPhysics`, `warmUp`,
  `physics.update` once a frame before `world.update`, `world.setPhysics`, the explorer through
  `stepExplorerBody` (with `assistAccel` 4, `jetMaxRise`, `descentLimit`), the ship through
  `stepShipBody` (`carve01: 1`, assists applied to the target), landing sites by friction, the
  parked ship on `stepShipGear`. Measured in my loop tests: `physics.update` averages 0.3 to
  0.5 ms; the gear settles and sleeps on Earth, the Moon and Jupiter.
- One assist I added that PHYSICS should know about and may want to model: in vacuum, X or
  throttling down brakes with the drive field (the kinematic rate) instead of the 14 m/s2
  retro thrusters, because stopping from 750 m/s took over a minute and "let go and it stops"
  is the promise of the ship (`R-SHIP-1`). A `brake` command in `stepShipBody` with a named
  field deceleration would let me drop my special case.
- A bug of mine, found by measuring and fixed: the body model moves `st.p` in place and my
  flight step then moved it again, so for a few commits the physical ship covered twice the
  ground its speed said (the climb to space read 10.9 s instead of 15 s). Fixed by keeping the
  starting point by value; the climb profile now matches the kinematic one within a second.
- GOOD: the lab page and twelve evidence shots exist now; the guide and the replacement
  tables were exactly what was asked for; the reference checks came back with measurements.

---

## Review 1: 2026-11-11, at commit `19f72ce`

What I ran:
- `node --test src/world/*.test.mjs` (12 pass), `node --test src/physics/` (72 pass),
  `node --test tests/*.test.mjs` (70 pass, including `tests/contract.test.mjs`, which checks
  Painter's real `sampleSurface` on every body and walks the real forest with collision).
- `gallery.html?body=earth&biome=temperate_forest&time=<h>&quality=1&cam=<preset>&ui=0&t=0` at
  640x360 from a clean export of HEAD: presets `trees`, `canopy`, `stream` at 12, 18.5 and 0 h.
- The integrated game (`index.html`, Painter's render, world and art as the default):
  `node tests/playthrough.mjs --query "scale=0.5&quality=0" --w 480 --h 270` against a clean
  export of `bb8ec30`: the whole loop passed with no console errors.
- A frame-cost probe in the integrated game (draw calls and triangles from `renderer.info`
  summed over the whole frame; `world.update` timed in the page).
- `createPhysics` driven for 600 frames at Painter's Earth spawn with one disturber.

### PAINTER

MUST FIX (M1: "Earth's temperate forest passes the freeze-frame test")

1. **The forest is far over any frame budget: 4.36 million triangles and 887 draw calls per
   frame standing at the spawn** (quality 1, 480x270; 4.57 M while running; 1.47 M and 262
   calls flying at 120 m; 43 k and 41 calls in orbit). Evidence: frame-cost probe at `19f72ce`;
   software GL fell from about 6.7 fps (before flora, `d238c50`) to 0.7 fps at the same
   viewport. The brief's rule is 60 fps at 1080p on an integrated GPU, and a painting that
   needs four million alpha-tested triangles plus a multi-target pass and four full-screen
   passes will not get there (`R-PAINT-8`). Budget I am setting as the owner of performance:
   **at most 600 k triangles and 350 draw calls at quality 1 in the densest view, 300 k at
   quality 0, 1.2 M at quality 2**, measured with the same probe. The far tiers are the
   obvious place: a distant tree is a few strokes (AB 4: "far things are fewer, larger, softer
   strokes"), and that is also what the painting wants.
2. **Foliage is stippled, not brushed.** `docs/lead/evidence/painter-19f72ce-gallery-trees-noon.jpg`:
   the crowns are a field of pixel-sized dark specks, and `docs/shots/pilot/real-01-on-foot.jpg`
   shows it as salt-and-pepper over the whole tree line. A watercolourist lays a crown as three
   or four overlapping washes with a few dark accents; nothing in a real painting is that
   fine-grained. Fails AB 4 ("detail is simplified into brush-sized shapes") and the freeze-frame
   test: this is the first thing that says "3D render with a filter". The looking-up frame
   (`painter-19f72ce-gallery-canopy-noon.jpg`) proves the pipeline can do it: there the leaf
   masses are shapes. Bring the eye-level trees to that.
3. **Ruler-straight lines.** Same frame: every birch trunk is a straight, evenly lit, evenly
   white cylinder of the same thickness, and the left bank of the brook is one straight dark
   line across a third of the picture. Fails AB 4 ("silhouettes wobble slightly, never
   ruler-straight"). Trunks need lean, taper, broken edges and paper showing through (birch is
   mostly bare paper with a few dry-brush marks).

SHOULD FIX

4. **No depth inside the forest.** In the `trees` frame the pines at the back are as dark and
   as saturated as the trunks at the front. AB 5 wants each distance band lighter, cooler and
   lower in contrast; inside a wood that is what separates the layers.
5. **The foreground is one flat wash.** The clearing in the `trees` frame and under the
   explorer in `real-01-on-foot.jpg` is a single yellow-green with a few blobs. AB 3 ("no area
   is flat colour") and AB 4 (near things get a few crisp accents): grass-tip dry brush, a few
   blades against the light. It is also what makes walking read as moving (`R-FOOT-2`).
6. **Trees stand in rows.** Mid-distance trunks in the `trees` frame line up like a plantation.
   Cluster them (birch in groups, pines behind) and leave irregular gaps.
7. **Night is not yet a painting** (`painter-19f72ce-gallery-stream-night.jpg`): the trunks
   glow at full paper white while the ground is close to a flat near-black navy. `R-DAY-3`
   wants a readable ground and nothing near black; the trunks should take the indigo glaze
   like everything else. Dusk (`...-stream-dusk.jpg`) turns the sky grey-violet but leaves the
   grass at noon green: the whole palette should move to gold (`R-DAY-1`). Not M1 scope; listed
   now so it does not get built on.
8. **Space granulation reads as black pepper** (`docs/shots/pilot/real-02-orbit.jpg`): hard dark
   specks at pixel size over the indigo. AB 1: nothing is pure black; AB 8: salt textures and
   spattered stars. Soften and enlarge the grain in space, and the planet needs a rim that
   fades to paper (`R-SPACE-5`). M2/M3 scope.
9. **Build hitches.** `world.update` averaged 7.5 ms with a 34 ms peak while running at
   `d238c50` (budget: 5 ms), and 8.7 ms average flying at 120 m at `19f72ce`. On a 60 fps
   machine a 34 ms update is two dropped frames (`R-SPACE-1`). Keep each slice inside the
   budget you were given (`setBuildBudget`), flora included.
10. **`sampleSurface` cost** is 0.016 to 0.072 ms a call (Mercury slowest, Earth 0.052). I make
    about 12 calls a frame on foot, so it is fine today; keep it under 0.05 ms as detail grows.

GOOD (keep)

- The sheet: paper tone, ragged border fixed to the screen, pooling at silhouettes, wet sky
  with paper clouds. Open-country frames already look like a watercolour sketch.
- The canopy frame. Leaf masses as shapes with sky holes, branches as single strokes.
- The brook: reflections of the trunks as vertical broken strokes with paper glints (AB 9).
- The planet from orbit reads as a painted ball with distinct biome colours and no seams.
- The contract: `sampleSurface` is exact on all ten bodies (unit normals, slope, liquid,
  weights, determinism), spawns are dry and gentle, vistas exist, `world.busy` works as a
  readiness signal, foreign materials are painted without errors, `sampleObstacles` arrived
  the same hour it was asked for. Integration took one flag flip.
- Time of day comes from the real sun; my 09:30 spawn spin gives a clear morning as intended.

Contract note: the Moon's mountains reach 267 m and Pluto's 245 m. I raised `spaceAltitude` on
both to 420 m in `src/data/bodies.js` rather than ask you to lower them.

### PHYSICS

No milestone gate yet (wiring is M2). No MUST FIX.

SHOULD FIX

1. **Worst-case frame.** `physics.update` averages 0.4 ms (well inside 2 ms) but one frame in my
   600-frame run took 6.8 ms. Whatever that is (a re-anchor, a first allocation), spread it:
   the budget is per frame, not on average (`R-PART-6`).
2. **Say which of my numbers each of yours replaces.** `EXPLORER_BODY` and `SHIP_BODY` already
   mirror my tuning (jump 4.8 m/s, float depth 1.25 m, 17 m/s2 of jet thrust). Before I wire
   them in, the notes need the table promised in section F: your constant, my constant it
   replaces, and the assist you expect me to keep on top. Without it I will be guessing.
3. **No lab page and no evidence shots yet.** `physics-lab.html` does not exist and
   `docs/shots/physics/` is empty, so nothing about grass parting, footprints or particles can
   be seen by anyone but you. A plain canvas plot of the wind field, a gust front crossing it
   and a footprint trail is enough for review (`R-WIND-2`, `R-PART-2`, `R-DEF-1`).
4. **The giants' winds are scaled down by 10 to 25.** Reasonable (nobody could stand in 400
   m/s), but keep it in one named constant per body so that `R-FOOT-5` (wind never wins on
   foot) is my assist to tune, not something hidden in the data.

GOOD (keep)

- Real gas tables with sources, vacuum handled as vacuum (`R-PLANET-2`), fall speeds that match
  the references without tuning: rain 6.3 m/s and snow 1.0 m/s on Earth (`R-RAIN-1`,
  `R-SNOW-1`), drizzle-slow acid rain on Venus.
- The density profile was chosen so that constant thrust against drag reproduces my 46 to 160
  m/s envelope (`R-SHIP-3`): exactly the right way to replace a table with a model.
- Gusts that travel with the wind (frozen turbulence), which is `R-WIND-2` by construction.
- 72 tests, a documented API at the top of the notes, allocation-free queries with `out`.
- Gear as a 1.6 Hz spring at 0.65 damping: settles inside `R-SHIP-5`'s one second.

### PILOT (self-review; the other roles and the coordinator review this domain)

Known weaknesses I would flag if this were someone else's work:
- Trees: the explorer, the camera boom and landing-site choice now respect
  `world.sampleObstacles` (tested in Node against the real forest, not yet watched in the
  browser), but the flying ship still passes through crowns: its cushion follows the ground.
- The HUD is a plain paper fallback, not the painted theme, and its ink is only legible over
  space because of a halo (`R-HUD-4` is met in a makeshift way).
- Pointer lock has never been exercised: headless Chromium reports nonsense deltas under lock,
  so every scripted run uses drag-look (`pointerlock=0`).
- No audio, no save, no pulse drive, no map yet (later milestones).
