# PILOT notes

Branch: `cosmos` (shared with PAINTER and PHYSICS, one working tree). Commits: `tools/commit.sh pilot`.

## Handover (read this first if you are a fresh PILOT)

Kept current by the fifth PILOT agent (2026-11-11, part 1 of its order: what nobody had
checked, the motion instrument, the first ten minutes; three relays from the coordinator
folded in). Everything below is true at the commit that contains this section.

**How to work here.** Read `docs/COORDINATOR.md` (section A, section G, the end of the log in
E), then this section, then `docs/lead/TRACK.md` and the newest block of
`docs/lead/REVIEW.md`. One shared branch (`cosmos`), one working tree, three roles. Commit only
with `tools/commit.sh pilot "msg"` (it pushes). Never edit `src/render`, `src/world`,
`src/art`, `src/physics`, `gallery.html`, `physics-lab.html`, `tools/`, or the other roles'
notes. Scratch files go in `/home/user/.pc-scratch/pilot/` (this run: `run5/`).
You are also the LEAD: `docs/lead/REFERENCES.md` (checks), `REVIEW.md` (dated findings with
evidence you ran yourself), `TRACK.md` (the path to done). Read long files by section and keep
command output short: four PILOT agents' worth of context has gone into this role.

**Things that cost me time.**
- The head is rarely clean: the coordinator's "WIP snapshot" commits put the other roles'
  half-written files into it. `tests/cleantree.sh <dir> <painter-commit> <pilot-commit>
  <physics-commit>` builds a clean tree from each role's own last commit (find them with `git
  log --format='%h %an: %s' -12`); run every browser check inside it (`cd <dir>; node
  tests/...`). Say in every finding what it was measured on.
- **One frame at the top tier takes 5 to 15 s here** (1.4 M triangles, software rendering, a
  load of 15 to 18 with two other agents rendering). The game's clock advances 0.25 s a frame
  at most, so a top-tier run plays at about a sixtieth of real time: 30 frames are 5 to 7
  minutes, the eight motion scenes took 55, and a whole flight to another world at the top
  tier does not finish in hours. Mechanics at `quality=0&scale=0.5`, 400x225 (a leg of the
  grand tour takes 4 minutes); the look at the top tier in short, fixed-step runs.
- Never run two browsers at once (yours or another role's makes both flaky); waiting is
  `until grep -q EXIT log; do sleep 10; done` in the foreground (10 minutes at most a call).
- A canvas is only readable in the task that drew it: step and grab in ONE `page.evaluate`
  (my first motion frames came back black).
- `sampleObstaclesPure` lists boulders (`kind: 'rock'`) only for a radius of 30 m or less.

**The code in one paragraph.** `src/core/sim.js` is the whole game as pure logic (no three, no
DOM): state machine (`state.js`), explorer (`src/player/explorer.js`: the built-in step, the
command to PHYSICS' body model, obstacles), cameras (`src/player/camera.js`), ship
(`src/ship/flight.js`), pulse (`src/ship/pulse.js`; `sim.pulse.dest` is where a pulse is
bound), frames and floating origin (`frames.js`), orbits, save, the sketchbook's pictures.
`src/core/game.js` presents it with three (roots, models, camera; markers, HUD, audio, map,
sketchbook; the read-out). `src/core/providers.js` switches between my stubs and the real
modules; `src/main.js` boots and runs the loop. `src/ui/` is the HUD, the map, the sketchbook
and the look; `src/audio/audio.js` is all sound (now also a hiss of blown sand and snow and a
wash of surf from PHYSICS' `here.blown`). `window.__pc` is the debug door: `info()`,
`teleport()`, `settle()`, `setClock(t)`, `setHour(h)`, `setTimeScale(k)`, `flash(frames)`, and
new: **`hold(true)` stops the frame loop and `step(dt, n)` runs n frames of exactly dt
seconds** (tests drive the clock; nothing depends on the machine's pace).

**Every check.** One command: `node tests/all.mjs --export` (a clean export of the last
commit: use it only when the head is clean, else build the tree with `tests/cleantree.sh` and run
`node tests/all.mjs` inside it; three unit suites, the static rules, eight browser runs, one
table; a unit file that fails in the full run gets two tries alone; 42 minutes on
2026-11-11). The lead's instruments, for looking and measuring rather than passing, all run
inside a clean tree, one at a time:
- `node tests/tour.mjs --bodies <one body>` every biome and vista, fair weather held, sheets
  in `docs/lead/evidence`; **top tier by default now**; `--quality 1` for coverage; `--first
  1` shoots only the spawn and the first vista (review 6's top-tier pass); settle is counted
  in frames (`--settle-frames 300`), seconds are only the safety net.
- `node tests/weather.mjs` the weather set (twelve frames; top tier by default now; `--only`).
- `node tests/motion.mjs` **the picture in motion** (new): eight scenes of consecutive frames
  at a fixed step, a sheet and numbers each (`docs/lead/evidence/motion-<scene>.jpg`,
  `motion.json`; `--only still,turn`; what each number means is in its header; 55 minutes for
  all eight at the top tier). The in-page part is `tests/motionlib.mjs`: any page with a
  canvas can use it (its header says how; PHYSICS was told).
- `node tests/boulderrun.mjs --body moon --biome crater_fields` a run across a boulder field
  in the game with real keys at 30 steps a second (new; 6 minutes at quality 0).
- `node tests/grandtour.mjs` all planets in one sitting; `--bodies moon,pluto --from earth`
  flew the other two; **`--beats 1`** saves a frame with the HUD and the screen's words at
  every beat and records the camera through every change of state (`<out>/beats.json`).
- `node tests/cost.mjs` triangles and draw calls (reports only).

**The rule that governs quality (the owner, 2026-11-11): there is no triangle budget.** The
game starts at tier 2 and full resolution; `src/core/dynres.js` steps down when the measured
frame time asks. `?quality=N` pins the tier; `?dynres=0` pins both. The look is judged at the
top tier; mechanics runs may pin a low tier (say which).

**What part 1 of this run did** (details in "Fifth agent, part 1" below; findings in REVIEW,
"Before review 6").
1. Every check on `da6d42d`: ALL 13 PASSED.
2. The Moon and Pluto landed on in the browser (ten bodies is the full set); fixed "Moon is
   in the way" at arrival at the Moon.
3. The Moon boulder run in the game: no boulder lifts the feet more than 0.16 m; one run off a
   crater rim sails 2.4 s (for PHYSICS).
4. The motion set, first measurements (REVIEW has the table and nine findings).
5. The first ten minutes at the top tier (the opening) and at quality 0 (the whole leg):
   three things fixed (the prompt across the legs, "Land here" at lift-off, a word about the
   map), no camera cut anywhere; PHYSICS' questions on feel answered from the game.
6. From the relays: settle counted in frames; README says what each tier draws; sound for
   `here.blown`; `tour --first`; two tries alone for a failed unit file.

**Unfinished, and where each item starts.**
1. *Part 2, lead review 6* (only on the coordinator's message; the coordinator's plan):
   build a clean tree; `node tests/all.mjs`; the tour **at tier 1 for coverage** (`node
   tests/tour.mjs --bodies <body> --quality 1`, body by body: settles, console errors, the
   landform present) and **at the top tier for the spawn and the first vista of each body**
   (`--first 1`: about six minutes a place); `node tests/weather.mjs` (top tier; the dust and
   gust-front frames will have changed: PAINTER's glaze now reads PHYSICS' veils);
   `node tests/motion.mjs` (re-shoot all eight; compare with the table in REVIEW);
   `node tests/boulderrun.mjs` on the Moon, Mars (`--body mars --biome rust_canyons`) and
   Earth (`--body earth --biome desert_canyon`); how long each spawn takes to settle, in
   frames and seconds (the tour's json has both); then judge against the art bible and the
   checks, write review 6 above the "Before review 6" block, update TRACK.
   **Re-run because `sampleObstacles` changed in PAINTER's block 5** (Pluto has tall spires,
   more boulders on Venus, Mercury, Pluto, Uranus, a 15 m clearing at every spawn that is not
   a forest): `node tests/grandtour.mjs` (all eight) and `--bodies moon,pluto --from earth`,
   `tests/trip.mjs`, the contract and walk tests (inside `all.mjs`); say what changed.
2. *Open findings of mine* (REVIEW, "Before review 6", items 10 to 14: crowns between the
   lens and the figure, the quiet first view, the 66 s first pulse, the HUD at 400 px, the
   unheard sound): none is a MUST FIX yet. The measure
   for boulders should read "never thrown up more than 0.3 m and no boulder lifts the feet
   more than 0.3 m" unless PHYSICS rules that a crater rim must be held.
3. *The UI*: at 400 px wide the sketch slip runs off the right edge; PAINTER has still not
   reviewed the look of the HUD.
4. *Walking into a trunk*, *flight pace per world*, *pulse profile*: as the fourth agent left
   them (see "Fourth agent, part 1" below).
5. *M4*, when the coordinator says so and not before: `node tests/all.mjs` must print ALL
   PASSED on the final clean head; then one pull request `cosmos` -> `main` through the REST
   API (the exact `gh api` calls are in `docs/COORDINATOR.md` section E), merge, GitHub Pages
   from `main`. The final message to the owner is described at the end of section 5 of the
   brief; the README already says how to play.
6. *Never verified here*: frame rate on a real GPU (the ` read-out exists for the owner; the
   controller has only met model machines and software rendering), a real mouse under
   pointer lock, a real gamepad, how the sound sounds (levels are measured: the two new
   voices pass the sound check, nobody has heard them), and the picture at 60 frames a
   second (the motion set measures frames, it does not watch them).

## Fifth agent, part 1 (record, newest last)

1. **Every check on the head, 2026-11-11.** `node tests/all.mjs` inside a clean export of
   `da6d42d` (the last commit before the coordinator's two "WIP snapshot" commits; it holds
   PAINTER's `573c10d`, PHYSICS' `9b708e2`, my `1235328`): **ALL 13 PASSED** in 42 minutes
   (unit 114, physics 230, world 19, static, play-stub 37 checks, play-physics 37, trip-stub
   47, m3 29, lock 7, audio, painted-play 37, painted-trip 47, painted-m3 29; the painted
   steps at quality 0, scale 0.5, 400x225). First full run since the legs, the new frame-rate
   controller and PAINTER's block 3 and first push. Nothing relaxed. Log:
   `/home/user/.pc-scratch/pilot/run5/all.log`.
2. **The Moon and Pluto flown: ten bodies landed on is the full set.** `node
   tests/grandtour.mjs --bodies moon,pluto --from earth` inside a clean tree (`da6d42d` with
   my files of `b36435a`; quality 0, scale 0.5, 400x225): PASSED, 7 minutes, 316 s of play.
   Earth to the Moon 30 km, 9.2 s of pulse, landed on the first E in `rilles`, walked 11.4 m;
   the Moon to Pluto 1382 km, 120 s of pulse, 21969 m/s at most, landed on the first E in
   `nitrogen_dunes`, walked 12 m; no bounce, no refusal, no console error. Frames
   `docs/shots/pilot/grandtour-moon.jpg`, `-pluto.jpg` (both opened: the explorer on grey
   regolith under a starred sky, and on pale dunes under a violet sky, the ship behind);
   the two legs are added to `docs/lead/evidence/grandtour.json`.
   **Found and fixed (mine):** arriving at the Moon the screen said "Moon is in the way: steer
   round it and pulse again". The Moon's own frame reaches out to where the drive lets go;
   inside it the course is dropped and the nose picks a new one, and the words at arrival
   compared against that. The pulse now remembers where it was bound (`pulse.dest`);
   `tests/pulse.test.mjs` flies to the Moon and to Mars and wants "<World> ahead" (it fails
   with the fix taken out: checked). 115 unit tests.
3. **The Moon boulder run, in the game.** `node tests/boulderrun.mjs --body moon --biome
   crater_fields` (new; real Shift+W and mouse, the clock driven at 30 steps a second through
   `window.__pc.hold/step`; clean tree PAINTER `23dea80`, PHYSICS `9b708e2`, mine `3858d3f`;
   quality 0, scale 0.5, 400x225: mechanics, not the picture). The start is the densest place
   within 320 m of the stand: 63 low boulders within 28 m, the tallest 1.09 m. Four headings,
   12 s each:
   | heading | metres | pace m/s | feet over the ground | thrown up | in the air |
   | --- | --- | --- | --- | --- | --- |
   | 0 | 70.9 | 5.90 | 0 | 0 | 0 frames |
   | 90 | 71.8 | 5.98 | 0.162 m | 0.047 m | 29 frames (0.77 s at most) |
   | 180 | 68.3 | 5.69 | 0.077 m | 0.007 m | 1 frame |
   | 270 | 78.6 | 6.55 | **3.722 m** | 0.049 m | 86 frames (2.43 s) |
   Top speed 7.4 m/s, mean pace 6.0 m/s, never stopped. **No boulder lifts the feet more than
   0.16 m and nothing throws the body up (0.05 m at most above where the feet left the
   ground).** The 3.7 m is not a boulder: at 7.4 s the run goes over a crater rim onto a 36
   degree wall, the ground falls 6.7 m away under a 6.8 m/s run in the Moon's gravity and the
   body sails for 2.4 s without rising (nearest boulder 3.9 m off). The measure as written
   ("never more than 0.3 m off the ground without a jump") is not met there; whether a run
   should hold a crater rim is PHYSICS' call (REVIEW). The same site replayed in the pure
   simulation (scratch `run5/trace.mjs`, headings a few degrees off the browser's): at 90 a
   step off the far side of a 0.72 m boulder (the ground under the feet drops 0.67 m in one
   frame) is followed by +1.06 m/s upward: 0.29 m of rise, feet 0.53 m over the falling
   ground, 1.4 s in the air; at 180 a run off a 50 degree wall, 1.5 m over ground that fell
   3.4 m. Frame `docs/shots/pilot/boulderrun-moon.jpg` (opened: the explorer at a run on the
   pale ground at night, the "Crater Fields" slip up; the slip runs off the right edge at
   400 px, known); record `docs/lead/evidence/boulderrun-moon.json`.
   The same run found a console error that the unit tests cannot: `pc-cloudshell` failed to
   compile on `23dea80` ("'uStorm': redefinition": the shared chunk's `uniform float uStorm`
   of the quality push against the cloud shell's `uniform vec4 uStorm`). PAINTER found it too
   and fixed it in `cf2058a`.
4. **The motion set** (`tests/motion.mjs`, `tests/motionlib.mjs`; the debug door's `hold` and
   `step`). Eight scenes at the top tier, 960x540, 30 steps a second, each a sheet in
   `docs/lead/evidence/motion-<scene>.jpg` and a row in `motion.json`. The table and the
   findings are in REVIEW ("Before review 6"); in short: the same instant paints the same
   picture (0 change), standing in the wind 0.30 % a frame with sky, paper and ground wash
   still, nothing sticks to the screen in a turn; for PAINTER: arrival is a pop (the canopy,
   575 k triangles, in one frame) and then a second of pops, tiers change in one frame, a
   near poppy is a flat disc; for PHYSICS: splash rings are white line ellipses. Shot twice
   for still, turn, walk and storm (PHYSICS `9b708e2`, then `bf73de5` after its wind fixes:
   the storm's pops went from 3 to 1; the older frames and sheets are in scratch
   `run5/motion-9b708e2/`). Every sheet opened. Scratch helpers: `run5/stuckmap.mjs` (where
   fine detail stays on the screen, block by block), `run5/strip.mjs` (the same crop of
   several frames, stacked), `run5/trace.mjs` (the Moon run replayed in the pure simulation).
5. **From the coordinator's relays.** Settle is counted in game frames (`settleWorld` in
   `tests/browser.mjs`: 300 frames at most, an hour as the safety net; tour, weather set, cost
   and motion set use it and record both); the tour and the weather set default to the top
   tier; `tour --first 1`; README's tier table carries PAINTER's lines; `all.mjs` gives a
   failed unit file two tries alone (it already covered all three suites); nothing of mine
   reached into `world._near`. Sound for PHYSICS' `here.blown` (my call: yes): a dry hiss for
   sand or snow (band-passed noise at 4.6 or 6.4 kHz, level 0.07 at full, eased over 0.6 s,
   0.3 of it inside the ship) and a wash for surf and spume (low-passed noise breathing about
   once in eight seconds, level 0.17, eased over 0.9 s); `tests/audiocheck.mjs` has "blown
   sand in a gale" (peak -10.7 dBFS) and "a breaking sea in a gale" (-6.6 dBFS) and
   "everything at once" stays at -5.6 dBFS: PASSED (no clipping, no clicks, no DC). Nobody
   has heard them.
6. **The first ten minutes** (`grandtour --bodies mars --beats 1`). Top tier, 960x540: only
   the opening (title, the card lifting, first view, three seconds later, walking, jetpack),
   stopped after 25 minutes: a top-tier frame takes about 15 s here. Quality 0: the whole
   leg, 26 beats, 202 s of play, PASSED. Findings and fixes are in REVIEW ("The first ten
   minutes"); fixed: the prompt lay across the explorer's legs (HUD class `pc-foot3`:
   prompt, gauge and notice go under the feet on foot in third person), "Land here" three
   seconds after lift-off (`_offClear`, `_offT` in `Sim.view`; test in `pulse.test.mjs`), no
   word about the map on reaching space (one line, once: `_saidMap`). Camera: no cut through
   thirteen changes of state (1.7 degrees a frame at most, 8 in the boarding blend). Frames
   `docs/shots/pilot/first10-*.jpg`, record `docs/lead/evidence/first10.json`.
7. **PHYSICS' P11 relay.** Measured in my `Sim` on the real ground (scratch `run5/feel.mjs`):
   the run reaches 7.48 m/s at 1.23 s and stops in 0.77 s over 2.49 m; the jetpack climbs at
   8.4 m/s at most (my cap), 2.5 s of Space is an apex of 22.7 m, the whole tank 54 m,
   touch-down 4.0 m/s; the ship comes down the last 2.2 m in 1.5 s with no stall (and in the
   browser: `motion.mjs --only landing`, heights in `motion.json`). The explorer model gets
   `hip`, `clamber01`, `grounded` in `animate` (PAINTER's figure does not read them yet).
   The wind's sound is eased over 0.4 s already. All eight motion rows were shot before P11:
   re-shoot at review 6.

## Status

### Fourth agent, part 1 (2026-11-11; everything run by me; software GL; frames opened where said)

**1. The weather set on the new storm times** (export of `8d2905b`: PAINTER at `139be13`,
PHYSICS at `de6ee88`; quality 1, 960x540; sheet `docs/lead/evidence/weather.jpg`, opened).
Twelve frames, no console errors. PHYSICS' sky numbers at the spawn, stateless, every 20 s
(scratch `run4/sky.mjs`): fair to 120 s (cloud 0.2 to 0.55, overcast under 0.16), drizzle at
140 s, thunderstorm 160 to 300 s (rain 0.9 and overcast 0.99 from 200 to 260 s), drizzle at
320 s, clear from 340 s with the ground drying (wet 0.63 at 340 s, 0.05 at 480 s).
*What a player who stands at the spawn for six minutes sees*: a sunny wood at ten in the
morning, blue sky with a little cloud, the explorer's shadow on the lawn, the ship 16 m off;
the same and clearer two minutes in (11:18); at 11:54 a slate-dark cloud bank has come over
the tree tops while the lawn is still lit, and the first slanted strokes of rain are in the
air; by 13:00 the sky is indigo, the rain is a soft slanted glaze, the wood has gone dark
and wet, with lightning lifting the open sky to paper; at 15:12 it is a clear warm
afternoon over wet ground. The whole storm is in daylight. Found in the frames (for
PAINTER, SHOULD FIX): in `earth-arrives` a far world shows as an orange-red dot *in front of*
the storm cloud (top left: the dab for a world a few pixels across is not veiled by a
closing sky); two green flecks lie on the blizzard's snow.

**2. All eight planets in one browser sitting** (`node tests/grandtour.mjs` on a clean export
of `5e62268` (my commit with the wind share and the thin-air words); painted world, quality 0, render scale 0.5, 400x225,
tier pinned; frames `docs/shots/pilot/grandtour.jpg`, opened; record
`docs/lead/evidence/grandtour.json`). From the title card with real key and mouse events:
click, walk (W), jetpack (Space, 1.6 s), walk to the ship, E, Space, climb to space, M and a
click on the map, nose on the marker, F, ride the drive, come down, E on the prompt, E to step
out, walk three seconds, a frame. **8 of 8 landed in one sitting: 31.6 minutes, 1659 s of
play, no reload, no console error, no bump, every landing began on the first E.**

| Leg | km | pulse s | top m/s | pulses | E presses | bumps | stood on | walked m | game s / wall s | barred |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| earth to mercury | 152 | 35.8 | 6946 | 1 | 1 | 0 | ochre_basins (walk), 17.7 h | 12.4 | 125 / 182 | - |
| mercury to venus | 180 | 38.5 | 7492 | 1 | 1 | 0 | fungal_towers (idle), 17.2 h | 12.6 | 194 / 255 | - |
| venus to mars | 350 | 59.5 | 10612 | 2 | 1 | 0 | dry_riverbeds (walk), 15.6 h | 12 | 204 / 245 | Venus ahead (345 km still to go) |
| mars to jupiter | 395 | 60.8 | 11425 | 1 | 1 | 0 | storm_wall (idle), 15.4 h | 13 | 145 / 160 | - |
| jupiter to saturn | 1078 | 104.6 | 19254 | 1 | 1 | 0 | honey_mist (idle), 12.8 h | 12.7 | 231 / 253 | - |
| saturn to uranus | 1089 | 105.4 | 19377 | 1 | 1 | 0 | pearl_fog (idle), 16.8 h | 12.3 | 223 / 247 | - |
| uranus to neptune | 1732 | 134.4 | 24580 | 1 | 1 | 0 | storm_seas (wade), 11.3 h | 8.1 | 245 / 278 | - |
| neptune to earth | 790 | 88.4 | 16430 | 1 | 1 | 0 | desert_canyon (idle), 23.8 h | 13.3 | 187 / 234 | - |

What stopped or could stop a player: (a) Venus to Mars: the pulse let go after three seconds
saying "Venus ahead" (Mars lay through the arrival sphere of the world just left; the script
then pulsed off to one side and aimed again, as a player would have to work out). The word
is now "Venus is in the way: steer round it and pulse again" (the Sun too, which said
nothing). No leg was refused at F ("Too close to X: turn away from it first" was never met
in this run; it will be when the course lies more than about 105 degrees from straight up).
(b) On Neptune the ship set down at the shore and the three seconds of walking went into the
sea (wading, 8.1 m): fine, noted. (c) At 400 px wide the sketch slip runs off the right edge
of the screen ("B opens the sketchbo"): to be looked at at real sizes with the UI frames.
(d) The run's one failed check was the script's own (it wanted Mercury's orbit frame eight
seconds after arrival; a small world's ground frame reaches that high): relaxed to accept
either frame of the world, because both are the world's own. Not flown: the Moon and Pluto
(`--bodies moon,pluto --from earth` flies them).

**3. The two guards have tests** (`tests/guards.test.mjs`): sink held while flying on says
"Slow down to land" within 6 s and lands once X has slowed the ship (kinematic and with
PHYSICS); on a 16 and a 37 degree slope, creeping uphill, the sink stalls at 6.6 to 7 m and
a landing begins within 1.7 s; Mars and the Moon make 80 and 85 m/s at 30 m (pace 1.7) and
stop in under 150 m, Mars makes over 200 m/s at 250 m, Earth's pace is 1, Venus' 0.75. With
the guards taken out (a scratch copy) all four fail.

**4. The suit's share of the wind** (Neptune's storm coast at 150 s, 13.8 m/s at the walker;
scratch `run4/windshare.mjs`, pure simulation on the real ground). Before: every heading
4.20 m/s on level ground; a 2.5 s jetpack hop rises 17 m into 35 to 40 m/s air and was
carried **298 m** from level ground (over a cliff into the sea, 42 m/s at most) and 46 to
86 m elsewhere. PHYSICS' 25 m was not a full burn. Now: off the ground the suit holds off
whatever wind is beyond 12 m/s (`cmd.shelter01 = 1 - (12 / wind)^2`, 0 in a breeze): the
hop is carried 8.6 m on level ground and 9.1 m at the stand; in Earth's thunderstorm 5 m as
before. On the ground nothing is cancelled and a little of the wind shows in the pace
(`windPace` 1.2 % per m/s along the walk, between 0.75 and 1.1): 4.50 m/s downwind, 4.20
across, 3.59 upwind on Neptune; never under 3.15 m/s in any gale. Unit test in
`tests/explorer.test.mjs`.

**5. A word when the air limits the ship** (`Sim.thinAirWord`, `slowWord`; no tone, the
ordinary notice slip): once per visit, coming in under 250 m faster than 57 m/s: "Thin air on
Mars: the ship runs fast and turns wide. Hold X to slow it" ("No air on the Moon: ..."); when
the nose has led the flight path by more than 29 degrees for 1.5 s (at most once a minute):
"Thin air: the ship turns wide at this speed. Ease off (S) and it turns tighter"; and E at
speed says "Slow down to land: the air is thin here, hold X". Earth, Venus and the giants
say nothing new. Seen in the browser on Mercury during the grand tour.

**6. The UI frames** replaced (export of `f6d0a29`, top tier, full resolution, 960x540, no
console errors; the eight frames opened as one sheet): the title card and the help card on
torn paper over the home forest; the wood on foot; the sketchbook with the first sketch on
Earth's page; the ship over the forest with "Earth 32 m up 44 m/s", "E Land here" and the
throttle; the cockpit with its three dials under the cowl and the slips moved to the top; the
cockpit in space with the stars and a marker on Mars; the map with every world named. The
Earth spawn loaded and settled in 29 s at the top tier at that commit (before PAINTER's
quality push). Found there and fixed: with the nose on the target the marker's label lay on
the prompt "Pulse to Mars" in the cockpit; the label is now written above the ring there
(checked in the browser: label at 130 to 169 px, prompt at 182 to 220 px of 360; the
`ui-space.jpg` in the repository is from before the fix and shows the overlap).

**The owner's instruction** (no triangle budget): controller, tests, README, lead files, as
the handover says. On model machines (`tests/dynres.test.mjs`): 13 fps at the top tier is
above 30 fps after 0.14 s and settles on tier 1; a machine that cannot hold anything is at
the floor after 1.8 s (2.8 s when every frame is over 250 ms, as in software rendering); a
machine a little over budget settles on scale 0.815 at tier 2 with one failed try upward
every 4, 8, 16, 32 ... seconds. Never run on a real GPU.

**Checked at the end of part 1**: `node tests/all.mjs --export --only unit,static,m3,painted-m3`
on `fd677b5`: ALL 4 PASSED (unit 114, the static rules, m3 29 checks on stubs and 29 in the
painted world with the controller free: "starts at the best: tier 2, render scale 1", then
by itself "tier 1, render scale 0.5" within seconds in software rendering). **Not run since
my changes to `sim.js`, `explorer.js`, `game.js`, `hud.js` and since PHYSICS' legs**: the
play-through, the trip, pointer lock, sound, and their painted versions (part 2 runs every
check). The grand tour ran on `5e62268`, before the step round a trunk, the landing word,
the pulse word, the label above the ring and the legs.

**From the coordinator's relays**: `mood.pulse01` (0 at cruise, 1 from 6 km/s of pulse,
falling as the drive brakes; additive); PAINTER's faint drags at a plain full cruise: keep
them; boulders (above); trunks (above); the landing word; `all.mjs` re-runs a failed unit
file alone once and says so in the table.


**This run (third PILOT agent): weather in the game reviewed (review 5), my review-4 items
answered, the painted theme's second pass, milestone 4 prepared.** M1 and M2 closed. M3: my
half done; three MUST FIX open for the others (two PAINTER, one PHYSICS; `REVIEW.md`).

### This run in numbers (everything run by me; browser runs on clean exports, software GL)

| What | On | Result |
| --- | --- | --- |
| `node tests/all.mjs --export` (every check) | export of `db22516` | 12 of 13 steps pass: unit 105, PHYSICS 215, PAINTER 19, static rules, play-through on stubs 37 checks, with PHYSICS 37, trip on stubs 47, m3 28, pointer lock 7, sound, **play-through in the painted world 37, the trip in the painted world 47**. The thirteenth (m3 in the painted world, 27 of 28) failed on my own step: it pinned the tier that the check then reads; fixed. Run again on the export of `d149255` (PAINTER's block 2, PHYSICS' P7.5, the boom, the stalled-sink guard and the gentler low pace all in): **ALL 13 PASSED** (unit 105, PHYSICS 222, PAINTER 19, static, play-through 37 on stubs, with PHYSICS and in the painted world, the trip 47 on stubs and in the painted world, m3 28 on stubs and in the painted world, pointer lock 7, sound), 33 minutes. |
| The weather set, `node tests/weather.mjs` | export of `62d3529` | 12 frames, no console errors; storm at the Earth spawn as the game gives it (19:48) 606 k triangles, 315 draw calls; the same at 11:00 582 k, 302; before and after 579 k, 299; kits 5 calls, 3.3 k triangles; blizzard 470 k, 234; Mars dust storm 219 k, 108; Neptune's sea 379 k, 206 |
| Cost at three tiers, `node tests/cost.mjs` | export of `83c604c` | 36 measurements, no console errors; one view over: `earth-temperate_forest-1` 306 k (quality 0), 614 k / 341 (quality 1), 818 k (quality 2); the rest 145 k to 283 k, 291 k to 549 k, 324 k to 756 k |
| A run from the spawn, eight headings, 25 s each (pure simulation, real ground, obstacles, physics) | export of `62d3529` with my `sim.js` and `src/player` | before: Mars 5 m in one heading, Mercury 5 m in one; after: Mars 170 to 179 m, Mercury 144 to 163 m, Earth 106 (a 41 degree slope) to 174 m, Venus 123 to 130 m (thick air), the giants 130 to 195 m |
| Unit tests | working tree | 105 pass (two more camera and two more obstacle tests) |

### After the coordinator's two relays (same run; all on `0de3fb4` unless said)

- Re-measured for the addendum to review 5: the vista 611 k / 339 (quality 1) and 304 k
  (quality 0), still over; the storm after dark 550 k / 300; pepper gone from the washes
  (storm sky, Neptune, night, space, pulse); storms windy (10 to 23 m/s above the wood, 12 to
  25 in the blizzard, 10 to 20 in Mars' dust storm). In the browser, with real keys, through
  the storm at the spawn: walk 3.5 to 4.0 m/s in every heading, a hop carried 4 m, the ship
  hands-off moves 0.5 m in 15 s and lands in 9 s with sink held; no console errors.
- PAINTER's six points on the interface taken (`pencilRing`, a veil of paper behind an open
  panel, dry-brush orbits, `pc-torn-b/-c`, `pc-rag-b/-c`); `.pc-cockpit` moves the read-out
  and the gauge to the top and the prompt above the cowl; `CAMERA.boom` 5.2 m.
- PHYSICS' re-fly: a stalled sink lands (`Sim._sink`: sink held, under 14 m, no descent for
  1.5 s, slower than 5 m/s; faster, the screen says "Slow down to land"); `env.speedScale`
  is 1.7 at most under 60 m and the full value above 400 m; the wall-clock assertions in
  `tests/physics.test.mjs` and `tests/contract.test.mjs` only assert with `PC_TIMING=1`.
- Not done: the tour on the current head; PHYSICS' Moon hover was not reproduced (guarded).

### What this run added

- **Weather in the game** (handover item 1a): the read-out has a `weather` line (the kits' draw
  calls and triangles from `world.kits.stats`, and what the sky is doing); `__pc.info().weather`;
  `?kits=0`, `?weather=fair`, `__pc.setClock(t)`. The tour holds fair weather and no marks
  (`--weather 1` leaves the weather on). `tests/weather.mjs` is the weather set; lightning is
  seen with `__pc.flash()`. Findings: review 5.
- **The camera's answer to a thicket**: `CAMERA.boomTight` 2.3 m, `boomEye` 1.3 m; between
  them the view slides from the squeezed third-person pose into the explorer's eyes (eased:
  9 /s in, 5 /s out), and `explorerVisible()` hides the explorer past 30 %. Stepping out of the
  ship, the view turns along the hull until the boom is free (`boomRoom`, `Sim.cameraSolids`).
- **Nothing stalls a run**: `EXPLORER.scramble` 1.3 m (lower obstacles are a smooth rise in the
  explorer's ground, through `env.sample`, so both movement models see them);
  `collideObstacles(st, list, r, { moving, dt })` starts a detour round the thinner of two
  obstacles after a quarter of a second wedged with the key held.
- **Painted theme, second pass** (`src/ui/paint.js`, `theme.css`, `map.js`): filters
  `pc-wash` (a small wash: uneven edge, granulation), `pc-stroke` and `pc-brush` (the body and
  the dry tail of one broad stroke); `pencilFrame(w, h, seed)` and `pencilRule(seed)` as CSS
  images; keys are a pale wash under a pen outline; the map's orbits are three or four pencil
  strokes each and its worlds dabs with pooled edges; the gauge fill is a wash.
- **Milestone 4 prepared**: `tests/all.mjs`, `tests/cost.mjs`, the README, TRACK's "Done means"
  line by line, the critique below ("Critique swap").

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
| the same in the painted world (400x225, `scale=0.5&quality=0`) | same, and again on the export of `5d411f2` (theme, legs, gamepad in) | PASSED both times, 37 checks, no console errors; ground to space 18 s; touchdown through the legs at 1.14 m/s |
| `node tests/trip.mjs` (stub visuals, PHYSICS) | same | PASSED, 47 checks (Earth, Mars, Saturn, reload from the save) |
| the trip in the painted world (400x225) | same | 45 of 47: Earth to Mars to Saturn flown, landed and walked (460 km in 68 s, 888 km in 95.2 s; `honey_mist`), autosave written. The two failures were mine: I passed `fresh=1` in the query, so the reload at the end forgot the save. The script now strips it. |
| the painted trip again | export of `a46647f` | FAILED on Saturn: E was pressed as the prompt went out over rough ground (two frames a second, two browsers running), nothing happened, and the script flew on. Not a landing fault (see the survey below), but a real paper cut: fixed in the game (the prompt has hysteresis, E without it says why) and in the script (it presses E like a player, again if needed). |
| the painted trip, after those fixes, the legs and the theme | export of `5d411f2` | **PASSED, 47 checks**, no console errors: Earth to Mars (459 km in 69 s, landed and walked in `rust_canyons`), Mars to Saturn (887 km in 94.9 s, `honey_mist`), both touchdowns on the legs, read-out 178 k triangles and 94 calls on Saturn at quality 0, and the reload continued on Saturn from the save |
| `node tests/m3check.mjs` | export of `e17a917`; working tree after the sketchbook | PASSED, 17 checks; 26 checks now |
| `node tests/lockcheck.mjs` | export of `e17a917` | PASSED, 7 checks |
| `node tests/audiocheck.mjs` | working tree | PASSED (table under "Audio, measured") |
| landing survey (scratch `run2/landsurvey.mjs`: 24 spots a body, PHYSICS on, PAINTER's committed world) | export of `a46647f` | 235 of 240 land from a 55 m hover (3 "too steep" on alpine and lilac mountains, 2 "no level ground" at a crater and a storm wall, all said on screen); median 6.2 s, touchdown 1.12 m/s |
| `node tests/tour.mjs --bodies earth` (painted, 960x540, quality 1) | export of `a46647f` | every biome frame NOT SETTLED after 90 s (`world.busy` 267 to 412; `world.update` worst 56 to 84 ms on a loaded machine). PAINTER's `world.busy` fix is not in its committed state yet: for review 4. |

After PHYSICS' five levers went in (working tree at the commit that carries this line):
`node --test tests/*.test.mjs` 102 pass; `node tests/trip.mjs` (stub visuals, PHYSICS on)
PASSED: Earth to Mars 461 km in 67.9 s, Mars to Saturn 889 km in 95.4 s, 347 s of game time,
Mars flown at its new pace; `node tests/playthrough.mjs` with PHYSICS PASSED (touchdown on the
legs at 0.78 m/s, ground to space 17.2 s). `node tests/m3check.mjs` in the painted world at
960x540, quality 1 (export of `5d411f2`): PASSED, 29 checks (the sketch of the painted forest,
the book, the vista walked to and sketched, the simulated gamepad, the reload). Review 4's own
runs (contract test, surveys, the tour of ten bodies, cost, space, weather rates) are in
`docs/lead/REVIEW.md`.

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
- **Touchdown on the legs** (Handover item 4 of the first agent, PHYSICS' recipe): the
  assist brings the hull to 1.0 m over a dry site, then `physics.ship.gear` lets it down at
  0.6 m/s on a weightless lift until a foot touches; the state becomes LANDED there and the
  lift fades over 1.5 s while the legs take the weight (`Sim.beginLandingGear`,
  `stepLandingGear`, `LEGS` in `sim.js`; `stepLanding` returns `'gear'`). No foot starts in
  the ground (the hull is lifted clear of a bank first). Afloat and without PHYSICS the old
  path stays. Verified: `tests/physics.test.mjs` on Earth, the Moon and Jupiter (sink 1.5 m/s
  or less, three feet down, asleep within 5 s, legs inside their travel, upright, step out);
  40 landings in the contract test; survey 235 of 240 as before (median 6.4 s); the browser
  play-through with PHYSICS touched down at 0.80 m/s.
- **Gamepad** (`src/core/gamepad.js`, pure; polled in `Input.take`): left stick walks (analog;
  in the ship turn and throttle), right stick looks, A Space, B C, X E, Y V, LB X, RB F,
  triggers throttle in the ship and RT runs on foot, L3 run, Back M, Start H, d-pad up B,
  left and right turn pages, down closes. `Input.axis` is analog now. Verified:
  `tests/gamepad.test.mjs` (3) and `m3check` with a simulated pad (walked 5.7 m at 4.2 m/s,
  opened and closed the sketchbook). Never tried with a real pad.
- **The painted interface** (coordinator's ruling: mine now). Everything the player reads is
  painted in code: panels and slips are torn cold-press paper (a 192 px tile of mottled,
  toothed paper generated on a canvas; edges torn by an SVG turbulence displacement on the
  slip's backing, so the lettering stays crisp); all text is hand lettering from a stroke
  font drawn in code (76 glyphs, each a few pen strokes; curves through the points; a fixed
  wobble per letter and place, so nothing shimmers); keys are ink keycaps; gauges are a wash
  in a pencilled bar with an ink-and-wash icon; planet markers are one pull of a brush
  (paper-white over a thin ink line) with the name on a slip; the cursor is a brush-tip
  cross; loading is three dabs laid two a second. Colours come from `src/data/looks.js`
  (`PAPER`, indigo, sepia, burnt sienna). The frame read-out stays plain type (an instrument).
  The stylesheet is `src/ui/theme.css` (`fallback.css` is gone). Verified: six frames at
  960x540 in `docs/shots/pilot/` (`ui-title`, `ui-foot`, `ui-book`, `ui-flight`, `ui-space`,
  `ui-map`), read at full size: legible on a pale wash and on indigo; `m3check`, play-through
  and lock check pass with it. Not verified: PAINTER has not reviewed the look; no frame
  over the painted world at 960x540 yet (see "Ground truth" for the run in progress).

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

12. **The interface is painted in the DOM, not in the scene** (since the coordinator's ruling
    that the theme is mine): torn paper, lettering and rings are SVG and CSS over the canvas,
    generated in code at start-up, static. It costs the renderer nothing, cannot shimmer, and
    stays crisp at any render scale. The price: HUD paper does not share the frame's own
    grain. If PAINTER wants HUD marks inside the painting it can still offer a hook; nothing
    is waiting on one.
13. **Sketches are kept beside the save, not in it** (`painted-cosmos.sketches`): the save
    stays a few hundred bytes and can never fail because a picture did not fit.
14. **Touchdown belongs to the legs** (with PHYSICS, on dry ground): the assist stops a metre
    up; LANDED begins at the first foot's contact, so the player can step out while the hull
    is still settling.

15. **PHYSICS' five levers of P6, all taken** (coordinator's recommendation; feel is my call
    and I agree: the brief gives every planet its own gravity feel). `eye` in
    `physics.update`; the carve assist bounded (`carveAccel` 40 m/s2: thin-air worlds turn
    wide at their speed); pace `clamp((1.225 / rho0)^0.4, 0.75, 3)` (Neptune 50, Saturn 52,
    Uranus 58, Jupiter 62, Earth 46, Venus 35, Mars and airless worlds 138 m/s near the
    ground) with 15 % of the field brake on X where the air is too thin to stop the ship;
    suit assist `4 * clamp(g / 9, 0.45, 1)`; falls end at 4 m/s. The hard limits stand: never
    trapped, never uncontrollable. Verified so far: 102 unit tests (the 40 landings and the
    trip on the real worlds among them) and the browser runs listed under "Ground truth".
    PHYSICS will fly them again and send numbers; change them if a world fights the player.

### Tuning numbers (feel target: unhurried, weightless, generous)

Landing on the legs (`LEGS` in `src/core/sim.js`): hand-over 1.0 m above the ground, sink
0.6 m/s, lift fading over 1.5 s. Landing prompt: below 90 m and 75 m/s, kept up to 105 m and
85 m/s once shown. Gamepad (`PAD` in `src/core/gamepad.js`): dead zone 0.16, look 1050 px/s
(about 2.4 rad/s on foot) with a 1.7 power curve. Sketch: 192x108 JPEG at 0.72, 2.5 s after
entering a landscape, 0.5 s after finding a view. Sound: master 0.75 into a compressor at
-14 dB, 4:1 (`src/audio/audio.js`; the measured table is under "Audio, measured").

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

## Contract additions made in this run (all additive)

Third PILOT agent:
- URL: `kits=0` (the world is handed PHYSICS with `{ kits: false }`), `weather=fair`
  (`world.setWeather({})` at boot).
- `window.__pc.setClock(seconds)`; `__pc.info().weather = { kits: { calls, tris } | null, sky }`;
  `__pc.info()` is otherwise unchanged. The read-out has a fifth line.
- `collideObstacles(st, obstacles, bodyRadius, help)`: obstacles no taller than
  `EXPLORER.scramble` (1.3 m) are no longer pushed out of: they are ground (`scrambleSample`).
  PAINTER: a boulder's `height` in `sampleObstacles` therefore decides whether it is walked
  over or round. PHYSICS: `env.sample` now returns ground that includes those rises.
- `Sim.cameraSolids(p, obstacles?)`, `boomRoom(...)`, `footCam.tight01`.

Second PILOT agent:

- `physics.update(dt, { ..., eye })`: the camera, body-local (PHYSICS' lever 1).
- `Sim.teleport({ heading, lookPitch, firstPerson })` (degrees) and `window.__pc.flash(frames)`.
- `world.getSpawn(body)` may carry `yaw` (and `pitch`), radians from north toward east: the
  game then arrives facing that way. Nobody sends it yet; `findBiome` and vistas already do.
- `info().stats.worldWorstMs` / `worldPeakMs`; `info().sketches`; the save has a sibling key
  `painted-cosmos.sketches`.
- `Input.axis` is analog (-1..1) when a gamepad is connected.
- The stylesheet is `src/ui/theme.css`; `src/art/ui.css` and `painter.setMarks` are not needed.

## Needs from the other

### Before review 6 (fifth PILOT agent, 2026-11-11; evidence in `docs/lead/REVIEW.md`, "Before review 6")

From PAINTER:
1. Arrival: the canopy appears in one frame and the ground in pieces for a second
   (`motion-fill.jpg`): a wash-in, or nothing shown until the near field is whole.
2. Tier changes in one frame (walk, flight, one dab in a turn); a near poppy is a flat
   hard-edged disc; one crown re-deals its dabs in a single frame.
3. Leaves between the lens and the figure when jetpacking among trees (`first10-jetpack.jpg`):
   thin them near the lens, or give me a crown radius in `sampleObstacles` (additive).
4. Read `hip` (m, negative while the legs are folded), `clamber01` and `grounded` in the
   explorer's `animate` for the landing crouch (I pass them now), and a crouch before a jump.

From PHYSICS:
1. Splash rings are thin white line ellipses that appear whole in one frame (`motion-storm.jpg`).
2. Rule on the crater rim: a run sails 2.4 s off a 36 degree wall on the Moon
   (`boulderrun-moon.json`); and the +1.06 m/s after a step off a 0.72 m boulder (`run5/trace.mjs`).
3. Your ship-descent stall is not in the game's landing (heights per frame in `motion.json`,
   scene `landing`); if your lab still shows it, it is the lab's ship or ground effect.


### After review 5 (third PILOT agent; details and evidence in `docs/lead/REVIEW.md`)

From PAINTER (state after the addendum, on `0de3fb4`):
1. The one MUST FIX left: `earth-temperate_forest-1` at 611 k (quality 1) and 304 k (quality 0).
2. Stars in space (there are none) and the pulse streaks; the border's hard dots in dark
   scenes; the white specks round the crowns in the lightning frame; near strokes on snow and
   as spikes on Saturn; puddles; Neptune's sea under cloud.
3. Two second-site vistas with a wall in front of the easel: `mercury-crystal_gardens-2`,
   `uranus-frozen_waves-2`.
4. A second look at the interface after your six points (`docs/shots/pilot/ui-*.jpg`, re-shot).
5. Is the cockpit right with the slips at the top (`docs/lead/evidence/space-recheck.jpg`,
   first frame)? The boom is 5.2 m, as you suggested.

From PHYSICS (P1 is closed; P2, P3, P4, P6 are with your fifth agent):
1. Thank you for the wind; walked and flown, it is safe.
2. The first storm of the default seed before about 400 s, so that it falls in daylight (P2).
3. Neptune's `storm_seas`: a storm sky and a swell that can be seen (P3).
4. Wind on the explorer (P6): at 33 m/s a walk downwind makes 0.6 m/s, upwind 3.5, across 2.9,
   and a 2.5 s jetpack hop is carried 85 m. If the model is right as it is, give me a lever in
   the command (`cmd.shelter01`, 0 to 1: how much of the wind the suit cancels) and I will set
   it; feel is my call, the physics is yours.
5. Note: low obstacles are now part of `env.sample`'s ground (a rise of up to 1.3 m over
   `radius + 0.7` m). Say if your contact model minds.


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
1. **Review 4, MUST FIX 1** (`docs/lead/REVIEW.md`): the vista `earth-temperate_forest-1`
   submits 645 k triangles and 352 draw calls for the world alone at quality 1 (budget 600 k,
   350, with room for the real explorer and ship). The item says how to see it in the game.
   The SHOULD FIX list there (thicket vistas, three orbit views, pepper in dark washes, dunes,
   a pin for the build slice) is yours to order.
2. (Done, thank you: `world.busy` reached 0 in all 114 tour frames of review 4.)
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
1. (Done: the last metre of a landing is on your legs; `tests/physics.test.mjs`.)
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

### Critique swap (third PILOT agent, as a player; blunt, for M4)

What I played: the scripted play-through and the Earth, Mars, Saturn trip in the painted
world, and three sets of frames from the game itself at 960x540 (weather, cost, and a
"player's eye" set on `0de3fb4`: night on foot, low flight in chase and from the cockpit,
orbit, space, the pulse, Saturn at dusk; scratch `run3/player/`). Nobody, me included, has
seen any of it move at more than three frames a second. That is the first line of any honest
critique of this game: its look in motion and its feel at 60 Hz are unjudged.

**PAINTER's domain (the look).** What holds: on foot by day it is a watercolour, and with the
real explorer and ship in the frame it is the first time a third-person shot has no grey
capsule in it; the night at the spawn is a real indigo night, readable, not black; low flight
over the forest (soft dabs for crowns, the far ridge lost in paper) is the best new frame;
space is soft indigo and violet with no hard specks left in the wash. What is weak, in the
order a player meets it:
1. *The near-ground strokes read as teeth.* Dark triangles a metre apart on Earth's lawn, on
   Saturn's plain, on Mercury; green ones on top of fresh snow. They are under the explorer's
   feet in every frame now, so they are the first thing seen. Either a sward or nothing.
2. *Space is empty.* No stars at all in the frames I took, no salt, no nebula edge, and the
   pulse drive is a still picture with "3115 m/s" in the corner: the fastest moment in the
   game is the one where nothing moves. The sun is a soft glow, which is right.
3. *The frame's edge.* The ragged border is a row of hard dark dots in every dark scene
   (storm, night, space): the most digital line in the picture, all the way round it.
4. *Weather marks.* Rain was chalk sticks at `62d3529` (a glaze has gone in since); the
   lightning frame has white dust round the crowns; puddles read as holes; the dust storm has
   nothing in the air near the eye; Neptune's sea ignores its storm sky.
5. *From orbit* Earth's cloud is hard-edged white patches; Mercury and Neptune were glass
   balls at review 4 and I have not seen them since.
6. *Straight edges*: crystals, frozen waves and dune crests are cut paper; two vistas have a
   wall a metre in front of the easel.
7. *Nothing arrives*: I cannot say whether detail fades in or pops, because nobody can see it
   move. PAINTER's own crawl numbers are pairs of frames.

**PHYSICS' domain (how it moves).** What holds: each world has its own weight under the feet
and under the ship (numbers, per world, re-flown by PHYSICS after every lever); the ship lands
on its legs; storms now bring wind (16 to 23 m/s above the wood, 25 in the blizzard) and the
suit keeps the explorer on its feet in it; nothing I ran cost more than a millisecond or two.
What is weak:
1. *Measured, never watched.* Every claim is a number from Node at 60 Hz. Grass that parts,
   branches that sway, flakes that tumble, a wake on water: I have seen none of them move and
   in stills I cannot find most of them. PHYSICS cannot either. The owner will be the first.
2. *The first storm comes after dark*, and the storm coast of Neptune has a cloudless sky.
   The weather is physically reasoned and dramatically mistimed.
3. *Neptune's coast is a wind tunnel*: 33 m/s at head height whenever one visits, a walk
   downwind at 0.6 m/s, a hop thrown 85 m (a boundary layer is promised). A calm game should
   not have a place where walking is a fight.
4. *Names and pictures disagree*: the read-out says "mist" over a clear dusk at the spawn,
   "blizzard" over a light snowfall at its tail, "dust" in a wet wood.
5. *The assists hide the physics*: feet down 100 % of the time, falls ended at 4 m/s, turns
   carved by a field. That is my doing and I stand by it for feel; but it means the "realism"
   the owner asked for is mostly visible in the read-out, the sound and the weather, not in
   what the body does.

**My own domain, as the other two would say it** (so that it is said): the camera had been
0.8 m behind a helmet at every step out of the ship since M1 and nobody noticed; a run could
be stopped dead by a knee-high rock until today; the interface was flat navy boxes one pass
ago; and four things about this game have still never met real hardware.


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
