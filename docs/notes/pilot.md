# PILOT notes

Branch: `cosmos` (shared with PAINTER and PHYSICS, one working tree). Commits: `tools/commit.sh pilot`.

## Hand-over, RELEASE 1, PILOT lane part 2: W3.1 (gesture guard, touch input) and W3.2 (touch HUD) (started 10:00 UTC 2026-11-14; kept current)

**Read this first.** Plan: `docs/lead/SHARP-SMOOTH-PLAN.md` section 4 "PILOT · W3". This part is W3.1 and W3.2; W3.3
(phone layouts and words), W3.4 (platform) and W3.5 (the phone preset) are part 3. First commit's parent: `0902c56`.
Scratch: `/home/user/.pc-scratch/pilot/r1/touch/`.

**State:** W3.1 DONE (`290780b`). W3.2 DONE (committed after `290780b`; its acceptance below). Still running when
W3.2 was committed (results added below when in): the loop on the Pixel 7 profile, the painted loop again on the
final code, m3check and lockcheck (the desktop unchanged), and the loop on a clean export of `290780b` (must fail).
Nothing else of PILOT's is half-done.

### W3.2 the touch HUD: prompts become buttons (DONE)

- **Files:** `src/core/state.js` (`promptFor` gives each prompt its action's `code`/`code2`: KeyE, Space, KeyF; the
  lettered `key` unchanged), `src/ui/hud.js` (on touch each prompt slip is a button that taps its code, no key
  lettered; the tabs MAP, SKETCHBOOK, HELP, VIEW in the top left, 44 css px square; the help card's close corner;
  the tabs and buttons are kept clear of the markers' labels), `src/ui/map.js` (close corner, a 'set course for
  <world>' slip under the chart that puts the map away, the sheet fitted with the slip on touch, the slip lettered at
  12 px or more on the screen), `src/ui/book.js` (close corner; a swipe of 48 css px or more across the page turns
  it, with the paper's sound), `src/ui/paint.js` (a map icon: a chart folded in three; `CLOSE_SVG`, a pencilled
  cross), `src/ui/theme.css` (the slips in the right thumb's arc 48 px tall, two high, over the round buttons; the
  tabs; the gauges at the top on touch; the hint and the foot notice under the tabs; the close corners 46 px on the
  screen whatever the sheet's scale; a short-window layout under 300 px tall: the buttons in one row, the gauges
  at the top right), `src/core/game.js` (a tap on the picture puts away an open map or book, or the help card),
  `src/main.js` (the sheets' corners press through the pad), `src/core/touch.js` (a tap is timed by the events' own
  time stamps, the activity by the page's clock), `tests/touch.mjs --part loop` (and `--painted`), `tests/all.mjs`
  steps `touch` and `painted-touch`, `README.md` (how to play by touch; what was never tried on a real phone).
- **How it plays:** on a touch screen the slips of the prompt ("Board ship", "Lift off" / "Step out", "Land here",
  "Cancel landing", "Pulse to Mars", "Stop turning", "Drop out of pulse") sit in the right thumb's arc over the round
  buttons, 48 css px tall, the first nearest the thumb, two at most (LANDED), lettered without a key; a tap on one
  is its key's press (a tap only: a slip that vanishes under the finger cannot leave Space held and the ship rising).
  The map's world is picked by a tap as before (the course is set by the pick); the 'set course for Mars' slip
  under the chart puts the map away. Each sheet has a pencilled close corner (46 css px on the screen at any scale)
  and goes away at a tap on the picture outside it; the help card goes at a tap anywhere on it. The controls (the
  buttons, the tabs, the stick's ring) fade to 35 % after 4 s untouched; the prompt slips do not fade. All placed
  with `env(safe-area-inset-*)`. Desktop: none of it shows (`.pc-touchui`, the corners and the slip are
  `display:none` without `.pc-touch`; the prompt keeps its key and its place).

- **Acceptance, measured** (`tests/touch.mjs`, CDP touch only: not one key pressed, no mouse event; on clean
  exports of `e87f6be` with the W3.2 files):
  - **The whole loop by touch, iPhone 14 landscape, stubs with PHYSICS: PASSED** (`--part all`, 1040 s with the
    input part): a tap begins; the VIEW tab changes the view; walked to the ship by the stick (a second finger
    steering by the look) in 2.6 s of game time; "Board ship" slip boards; "Lift off" lifts off; the stick's
    throttle and a nose-up drag climb above the air; the MAP tab opens the map, a tap on Mars sets the course (463
    km), "set course for Mars" puts it away; its corner and a tap outside it close it; "Pulse to Mars" turns the ship
    onto the course and pulses (68 s), arrives 6.9 km off; nose down and the stick's throttle into the air of Mars,
    to the landing prompt; "Land here" lands; "Step out": on foot on Mars; the SKETCHBOOK tab opens the book at Mars,
    a swipe left turns to Jupiter and right back, its corner and a tap outside close it; the HELP tab shows the help
    card, a tap on it puts it away, its corner too; no pointer lock asked for, 0 pointercancel, 0 keydown.
  - **The same loop in the painted world, q0, 400x225 (the iPhone 14 profile on a window of that size): PASSED**
    (`--part loop --painted`, 553 s; landed in Mars' dry riverbeds; no console error).
  - **Every hit area at least 44 css px:** at 13 stages (on foot; with an iPhone's safe area; at the ship; landed;
    flying; the map open; the map with a course; in space; the pulse; over Mars; on foot on Mars; the book open; the
    help card) every control measured: the smallest 44 px (the tabs), the round buttons 72/56/52, the slips 48 tall,
    the close corners 46 on the screen (at the sheets' 0.6 scale).
  - **On a phone, no control in the subject box** (x 30-70 %, y 55-100 %) at any of the 9 stages where the picture is
    played (iPhone 14; the Pixel 7 run below).
  - **The safe area** (CDP `Emulation.setSafeAreaInsetsOverride` 47 / 47 / 21, an iPhone held sideways): every
    control inside it.
  - **The fade:** 4.6 s untouched, the controls go to 0.35; a touch brings them back.
  - **W3.1's input part again on the W3.2 code** (`--part all`): all three profiles and the desktop page PASS (33.6
    degrees for 120 px, 9.0-9.7 m walked, jump 2.2-6.0 m, jetpack 22.6-23.4 m, scale 1, nose 14.9 degrees,
    throttle 0 -> 1).
  - **The desktop is unchanged:** the desktop page of `--part input` (no touch layer, pointer lock as before);
    `tests/layout.test.mjs` in the unit suite; m3check: see below.
  - Frames, OPENED: `docs/shots/pilot/r1/touch-w32-loop-iphone14.jpg` (landed with "Step out" over "Lift off" and
    RISE; flying, the controls faded, the read-out under the tabs; the map with "set course for Mars"; in space with
    "Pulse to Mars", BRAKE, SINK, RISE; over Mars with "Land here"; the help card with its corner),
    `touch-w32-painted-a.jpg`, `-b.jpg` (the painted world at 400x225, from the run before the read-out moved: the
    read-out lay against BRAKE there, which is why it moved). Numbers: `touch-w32-runs.json`.
  - Unit: `tests/touch.test.mjs` 11 (two new: a tap timed by its events' stamps; every prompt names its code),
    `tests/vista.test.mjs` updated (the prompt now carries `code`).
- **Checks** on a clean export of `e87f6be` with these files (PAINTER's uncommitted `src/world`, `src/render` left out):
  unit **227** (225 + 2), physics 325, world 30, coast PASS at both stands, ghostfield all zeros, static rules hold;
  the painted loop ran the real game with no console error and `fallback` empty.
- **Rulings (W3.2):** (1) "Every hit area at least 44 css px" is read as the touch controls this item adds (the
  round buttons, the slips, the tabs, the close corners, the 'set course' slip); the book's tab strip (15 css px
  tall on the iPhone) and the map's world radius are W3.3's, with their own numbers there. (2) The subject box (x
  30-70 %, y 55-100 %) is judged while the picture is played; with the map or the book open the sheet covers the
  picture (the 'set course' slip sits at the sheet's foot, in the box) and the touch HUD is hidden. (3) The help
  card's tab is HELP only: the game does not pause behind the card, as on the desktop (the world goes on there too).
  (4) The slips always stand 166 css px over the bottom (over BRAKE's place, even on foot): a slip 48 px tall then
  ends above 55 % of the height on the iPhone 14 (340 px) and the Pixel 7 (360 px), so no slip can reach the subject
  box whatever its width or the safe area's. (5) On touch the gauges go to the top middle (to the top right in a window
  under 300 px tall): at the bottom middle the throttle ran under SINK (frame opened in W3.1's run). (6) A tap on the
  picture is timed by the events' own time stamps (a real touch screen stamps them; a frame that runs long must not
  make a tap a hold), the last activity (the fade, a mouse event made up from a touch) by the page's clock; the test
  stamps its CDP events as a touch screen would (CDP waits for the page to take each event, so an unstamped lift is
  stamped a slow frame later: 1 to 7 s in the painted world here). (7) On touch the read-out moves to the top left under
  the tabs (W3.3 names it; done here because the short window's row of buttons ran into it at the lower left, and
  the lower left is the left thumb's).
- **Not done here (W3.3's, part 3):** the words on touch (the title card says "click to begin", the help card lists
  keys and "H closes this card", the map "click a world, or use the arrow keys", the book "arrow keys turn the page,
  B closes"); the map's world radius and names, the book's tab strip, the help drawing; the
  edge arrow of "the ship" can sit beside the "Board ship" slip at the right edge (seen in the frames).

### W3.1 the gesture guard and touch input (DONE)

- **Files:** `src/core/touch.js` (new: `TOUCH` constants, `TouchPad` the fingers as numbers, `attachTouch` the DOM
  wiring), `src/core/input.js` (`input.touch` merged in `take()`, `axis()`, `down()` the way the gamepad is; a mouse
  event made up from a touch never drags or asks for pointer lock: `fromTouch`), `index.html` (viewport
  `viewport-fit=cover`, `maximum-scale=1, user-scalable=no`), `src/ui/theme.css` (the guard: `touch-action:none` on
  html, body and the canvas, `overscroll-behavior:none`, user-select, touch-callout and tap-highlight off; the touch
  controls' look), `src/ui/hud.js` (the stick's ring and the round paper buttons JUMP/RISE 72 px, SINK 56, BRAKE 52,
  `bindTouch`, `setTouch`), `src/core/game.js` (`setTouch` each frame: which buttons, the fade, the stick; the hint
  says "drag on the right to look around" on touch), `src/main.js` (`attachTouch(input, canvas)`, `__pc.touch`),
  `tests/touch.test.mjs` (9 tests), `tests/touch.mjs` (browser, `--part input`).
- **How it works:** a finger on the left 40 % of the picture is a floating stick (centre where it lands, 56 px full,
  8 px dead zone, the centre follows a thumb past the rim; at the rim (0.92) for 0.25 s it runs on foot); elsewhere a
  relative drag looks (0.28 degrees per css px on foot, `LOOK_GAIN` = 2.12 mouse px per css px, so the nose turns at
  FEEL.mouseShip's rate, about 0.21 degrees per px); a second finger beside the look finger pinches the camera boom
  (60 px of spread = one wheel notch); a control (hud.js) presses a code while held (JUMP/RISE = Space, SINK = C,
  BRAKE = X) or taps it (W3.2's prompts and tabs: only the edge, so a slip that vanishes under the finger cannot leave
  a key held). Taps on the picture reach the game in `take().taps` (W3.2 closes panels with them). Shown on the
  first touch or from the start with `(pointer: coarse)` and touch points; hidden by a key press or a real mouse move
  (over 24 px, more than 1 s after a touch; a 0-movement hover move does not count). Without touch nothing shows and
  nothing changes (`.pc-touchui` is `display:none`).
- **Acceptance, measured** (`node tests/touch.mjs --part input`: Playwright's iPhone 14, Pixel 7 and iPad Pro 11
  landscape profiles, CDP touch, stubs with PHYSICS; and a desktop 1280x720 page). All three profiles PASS:
  a tap starts the game with **0** compatibility mouse events (mousedown, mouseup, click) and 0 pointer-lock
  requests; a 120 px drag turns the view **33.6 degrees** with **0** pointercancel; the stick held 2.5 s (2.9-3.2 s of
  game time by the time the finger lifts) walks **8.7-10.1 m** (2.8 m/s at 40 px deflection), held at the rim it runs
  at 7.2 m/s; JUMP tapped **1.9-2.4 m** up, held 2 s the jetpack **19.7-23.7 m**; stick and look at once **18.9-31.8 m**
  and 23.5 degrees; a pinch leaves `visualViewport.scale` **1** and moves the boom 5.20 -> 6.27 m; in the ship (160 m)
  a 90 px drag up lifts the nose **0 -> 14.9 degrees**, stick right turns it **87-100 degrees** in 1.5 s, stick up opens
  the throttle **0 -> 1.00**; no console error. Desktop: no touch layer (`display:none`, JUMP 0 px wide), a click
  asks for pointer lock as before. (The audit's live patch: 39.5 degrees, 15.3 m at 4.22 m/s, 18.5 m, scale 1.)
  The same script on a clean export of `0902c56` FAILS 9 checks (mousedown 1 and a pointer lock from the tap, 0.0
  degrees with a pointercancel, 0.0 m walked, no JUMP). Evidence: `docs/shots/pilot/r1/touch-w31-input.json` (every
  number, before and after), `touch-w31-iphone14-ship.jpg` (OPENED: the paper buttons rise/sink/brake in the right
  corner, the stick's resting ring at the left).
- **Unchanged and green:** `tests/input.test.mjs` + `tests/gamepad.test.mjs` 13 pass, `tests/lockcheck.mjs` PASSED.
- **Checks** on a clean export of `0902c56` with these files (PAINTER's uncommitted `src/render` left out): unit
  **225** (216 + touch 9), physics 325, world 30, coast PASS at both stands, ghostfield all zeros, static rules hold,
  lockcheck PASSED; the real game (q0, 640x360, desktop) loads with no console error, `fallback` empty, no touch layer.
- **Rulings (W3.1):** (1) the look gain is per css px, not per screen width: the plan's "about 200 degrees per screen
  width" and "120 px turns 30 degrees or more" disagree on the Pixel 7 (863 px: 28 degrees) and the iPad (1194 px:
  20 degrees); a thumb's travel is a physical distance and a css px is about the same size on a phone and a tablet,
  so 0.28 degrees per px (210 degrees across the iPhone 14). (2) The round buttons JUMP/RISE, SINK, BRAKE came with
  W3.1, not W3.2: W3.1's own acceptance (jump, jetpack) needs one. (3) `user-scalable=no, maximum-scale=1` are in the
  viewport besides `viewport-fit=cover` (Chrome on Android honours them; iOS ignores them, the gesture events and
  `touch-action` do it there). (4) In the ship the stick does not run (Shift is the run on foot only, as the pad's).
  (5) Playwright's profiles report `maxTouchPoints` 1: the coarse-pointer test asks for at least one.
- **For the feel (only a phone can tell):** gain 0.28 degrees per px, dead zone 8 px, rim 0.92 for 0.25 s, pinch 60 px a
  notch: all in `TOUCH` at the top of `src/core/touch.js`.

## Hand-over, RELEASE 1 of the sharp-smooth plan, PILOT lane part 1: W1 (the gate) (started 05:00 UTC 2026-11-14; kept current)

**Read this first.** The plan: `docs/lead/SHARP-SMOOTH-PLAN.md` (W1 = section 4 "PILOT · W1 Gate", the quality guard =
section 5). This part of the lane is W1 only (W1.1 the station harness, W1.2 a green gate); W3 (touch) comes next.
Scratch: `/home/user/.pc-scratch/pilot/r1/`. First commit's parent: `0efcc3b` (the coordinator's log; under it `56382c2`,
the coordinator's WIP snapshot of `tests/stationlib/metrics.mjs` and `png.mjs`, the port begun by the agent before the
04:59 restart, which this agent continued). Commits of this part: `419074c` (W1.2), `2355594` (W1.1 harness), `8811ca4`
(harness reproduces; baseline q2 1280x720), `7a41b0c`, `2df378d` (W1.2 proof), `64dda38` (two runs agree), and the
rest of the baseline after them.

**State at the end of this part (about 09:50 UTC): W1 DONE.** Nothing of PILOT's is half-done or uncommitted (PAINTER's
uncommitted `src/render` files in the shared tree are PAINTER's W2.2 work in progress).

- **W1.1 the station harness: DONE.** `tests/stations.mjs` + `tests/stationlib/` (inpage.js, stations.mjs, metrics.mjs,
  png.mjs) + `tests/stationmetrics.test.mjs` (8 tests). Reproduces the plan's numbers on a clean export of 784183b:
  E_150_45 raw land lapvar 520.9 (520-525), final t1/t2 0.04/0.25, x26 1.14/1.13 (1.15/1.14), raw A 0.447, E_1000_90 441
  calls / 669,283 triangles (table below). Two identical runs agree (518 numbers, 0 outside the rule; below). How to
  run a station set: the section "HOW TO RUN A STATION SET" below.
- **W1.1b the baseline: DONE.** `tests/baselines/stations-784183b.json`: q2 at 1280x720 (25 stations, with A, F, taps),
  q2 at 1920x1080, q1 and q0 at 1280x720 (24 stations each, with F and taps; q1/q0 also against the q2 raw, `vsRef`), and
  the iPhone 14 landscape profile (E_foot, E_150_45; today's behaviour: q2, DPR capped 1.5, buffer 1125x510; the phone
  preset of W3.5 does not exist yet). Sheets in `docs/shots/pilot/baseline/`, every one OPENED.
- **W1.2 a green gate: DONE.** `419074c`; painted-trip 3 of 3; `node tests/all.mjs --export` on `8811ca4` ALL 15 PASSED.

**Rulings of mine logged here (each explained where it is used below):** the harness pins the game clock at 120 s and
the wash clock at 100 (the clock study); the halo share's 0.5 % bound is read on the abstraction output, the final's
share is compared with its baseline (the paper alone puts 11-16 % of the land over the line); "two runs agree to two
decimals" is read as normalised measures within 0.005, magnitudes within 1 %, masks under 5000 pixels not judged; the
storm station uses tests/weather.mjs' forced storm sky at hour 11 with no rain marks; Neptune's station looks along
heading 0; W2.2's night station `E_150_45_night` (hour 23) was added last (PAINTER asked for it in its notes) and
baselined alone; the counted sheet reads are 16 an output pixel at native size (the audit's 17 counted the
enlargement branch's read); `1c406e2`'s game change (honest 'Land here') was not restored with the trip fixes.

**For whoever comes next (W3, touch, is the rest of this lane):** the plan's W1.2 also names later steps `touch` and
`stations-quick` for `tests/all.mjs`: `stations-quick` should run `node tests/stations.mjs --set quick` on the
export and judge it with the section 5 thresholds once W2 has landed (`--compare tests/baselines/stations-784183b.json
--strict` exits 1 on any flag; today every station flags the halo rule, which W2.2 is meant to fix). A quick set takes
about 15 min (10 min of page load).

### W1.1 reproduction (clean export of 784183b, q2 1280x720; `/home/user/.pc-scratch/pilot/r1/st-repro1/`, sheet and crops opened)

| Number | Plan / audit | This harness |
| --- | --- | --- |
| E_150_45 final land t1 / t2 / t3 | 0.04 / 0.25 / 0.68 | 0.04 / 0.25 / 0.68 |
| E_150_45 abstraction output t1 / t2 | 0.05 / 0.24-0.25 | 0.05 / 0.24 |
| E_150_45 x26 (far brush off, wobble 0.3) final land t1 / t2 | 1.15 / 1.14 | 1.14 / 1.13 |
| E_150_45 x21 (far brush off) / x23 (x26 + RCAS 0.5) | 0.67 / 1.03, 1.30 / 1.16 | 0.66 / 1.02, 1.29 / 1.15 |
| E_150_45 raw A (aliasing index) | 0.447 | 0.444 |
| E_150_45 cost | 450 calls, 910,623 triangles | 450, 910,623 |
| E_1000_90 cost | 441 calls, 669,283 triangles | 441, 669,283 |
| E_150_45 raw land lapvar | 520-525 | 555.9 with the game clock at 900 s; **520.9** with it at 120 s (the baseline run) |

The raw lapvar was the one miss of the first commit (`2355594`, game clock pinned at 900 s), now resolved (the clock
study below; the harness pins 120 s since `8811ca4`). The audit's harness did not hold the loop and left the game's
clocks where they were; this one pins the game clock, the painter's wash clock (100) and renders once before the
measured render. A pixel difference of this raw frame against the audit's
(same camera to the millimetre): crowns' edges everywhere (the trees sway with the clocks) and the stream (the water
reflects the frame before: here the same view, in the audit a frame of the game's own camera, since its loop ran
between grabs). The lead's two placements in one page differed by 0.4 % (520.75, 522.62).

**Clock study** (`/home/user/.pc-scratch/pilot/r1/bin/clockstudy.mjs`, log `clockstudy.log`; one page of 784183b, E_150_45,
raw land lapvar): the audit's way (no clock set, no warm render; the game clock at 14 s, as a fresh page stands) 521.0,
with a warm render 522.7; the wash clock at 0, 37, 100, 250, 523, 1000, 2000: 524.8, 524.9, 524.0, 524.5, 525.5, 525.8,
526.0 (1 %); the GAME clock at 120 s 522.0, 400 s 526.9, 900 s 554.5 (the wind and what sways with it move with the
game clock). Final t1/t2 0.043/0.25 in every case. Ruling: the harness pins the game clock at 120 s (early, as the
audit's stations were; deterministic) and the wash clock at 100. (The study's run was stopped by the shell's time limit
after the 400 s point; the 1500 s and 3000 s points were not taken. Its page was not held: the game clock crept about
1 s between grabs; the harness holds it.)

**Two runs agree** (W1.1 acceptance; `docs/shots/pilot/r1/two-runs-diff.txt`): `--set quick` (E_foot, E_150_45,
E_1000_45, with taps, flicker and alias) run twice on fresh pages of 784183b, compared with `--diff`: 518 numbers, 0
outside the rule: the normalised measures (t1-t3, shares, A, F, halo) within 0.0026 (rule: 0.005, half a unit of the
second decimal), cost identical, CIELAB within 0.5, the absolute magnitudes (lapvar, b1-b3) within 0.86 %. My reading
of "agree to 2 decimals on every metric", logged as a ruling: lapvar and the bands are magnitudes in the hundreds and
tens (two decimals of 190.7 would be 0.003 %), so they are held to 1 %; and a mask under 5000 pixels is not judged (at
E_foot the ground 30-150 m off is 771 pixels of stream bank where the water and the grass move from run to run: t1
there 0.310 / 0.316). What still moves between runs: the stream's water and single grass blades at E_foot (a pixel
difference: 1.8 % of pixels over 8/255; 0.4 % at E_150_45), state the game builds up in the real frames before
`__pcReady`, which no clock pin reaches. The quick run against the baseline run (where E_150_45 and E_1000_45 come
after eight other stations): 1 number outside, E_foot raw ground lapvar 1.04 %.

### W1.1b The baseline of 784183b: `tests/baselines/stations-784183b.json`

Measured with this harness on a clean export of `784183b` (the same game code as the live game and as HEAD before R1),
q2, 1280x720, all 24 stations, with taps, flicker and alias (run `/home/user/.pc-scratch/pilot/r1/base-q2-1280/`, 21 min
of stations after a 10 min load; no console error, fallback empty). Sheets, OPENED (every station's final and raw, and
1:1 crops of the land): `docs/shots/pilot/baseline/q2-1280x720-sheet.jpg`, `q2-1280x720-crops.jpg`; one line a station:
`q2-1280x720-summary.txt`. What they show: the raw scene has every crown, trunk and path; the final has blobs from
150 m up; at 1 km the raw ground is rows of dashes (the dapple aliasing W2.1 removes). The sharpness audit's summary
reproduced station by station within about 3 % in raw lapvar (E_foot 190.6 / 185.0, E_150_90 423.1 / 435.9, E_400_45
409.2 / 408.8, E_1000_90 1082.2 / 1086.0) and to two decimals in the final t1/t2 at all twenty.

| Station | raw land lapvar | final land t1 / t2 / t3 | halo % abs / final | A raw / abs | F raw / abs | calls / triangles | foliage share |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E_foot | 190.6 | 0.30 / 0.72 / 0.91 | 1.6 / 2.2 | 0.525 / 0.438 | 0.464 / 0.390 | 462 / 1456987 | 0.29 |
| E_50_45 | 237.5 | 0.22 / 0.60 / 0.88 | 4.2 / 4.3 | 0.421 / 0.272 | 0.407 / 0.265 | 509 / 1290599 | 0.46 |
| E_50_90 | 208.7 | 0.31 / 0.74 / 0.94 | 2.3 / 3.4 | 0.395 / 0.254 | 0.386 / 0.244 | 365 / 1021177 | 0.30 |
| E_150_45 | 520.9 | 0.04 / 0.25 / 0.68 | 11.6 / 11.3 | 0.447 / 0.251 | 0.417 / 0.211 | 450 / 910623 | 0.31 |
| E_150_90 | 423.1 | 0.08 / 0.33 / 0.71 | 12.2 / 11.5 | 0.386 / 0.226 | 0.347 / 0.191 | 492 / 1006015 | 0.24 |
| E_400_45 | 409.2 | 0.01 / 0.15 / 0.64 | 7.8 / 7.7 | 0.474 / 0.356 | 0.323 / 0.256 | 299 / 462758 | 0.03 |
| E_400_90 | 604.3 | 0.01 / 0.13 / 0.59 | 16.3 / 15.9 | 0.402 / 0.286 | 0.329 / 0.223 | 538 / 822388 | 0.08 |
| E_1000_45 | 372.6 | 0.01 / 0.37 / 0.79 | 3.4 / 3.6 | 0.630 / 0.322 | 0.344 / 0.223 | 97 / 164643 | 0.00 |
| E_1000_90 | 1082.2 | 0.00 / 0.14 / 0.73 | 3.0 / 3.2 | 0.533 / 0.459 | 0.367 / 0.276 | 441 / 669283 | 0.00 |
| M_foot | 38.2 | 0.34 / 0.71 / 0.88 | 1.1 / 2.8 | 0.472 / 0.361 | 0.423 / 0.290 | 292 / 452645 | 0.00 |
| M_50_45 | 48.8 | 0.26 / 0.57 / 0.84 | 0.6 / 1.1 | 0.423 / 0.330 | 0.443 / 0.354 | 253 / 398942 | 0.00 |
| M_50_90 | 53.3 | 0.38 / 0.74 / 0.93 | 0.4 / 1.2 | 0.436 / 0.342 | 0.381 / 0.307 | 149 / 257290 | 0.00 |
| M_150_45 | 19.2 | 0.13 / 0.44 / 0.71 | 2.2 / 2.9 | 0.284 / 0.181 | 0.312 / 0.178 | 272 / 377970 | 0.00 |
| M_150_90 | 26.3 | 0.11 / 0.33 / 0.63 | 0.8 / 1.0 | 0.381 / 0.299 | 0.363 / 0.298 | 237 / 343062 | 0.00 |
| M_400_45 | 15.7 | 0.09 / 0.29 / 0.68 | 3.2 / 3.6 | 0.215 / 0.204 | 0.139 / 0.182 | 205 / 289391 | 0.00 |
| M_400_90 | 10.8 | 0.13 / 0.34 / 0.61 | 2.7 / 3.2 | 0.235 / 0.195 | 0.191 / 0.198 | 291 / 405739 | 0.00 |
| M_1000_45 | 36.0 | 0.05 / 0.37 / 0.77 | 1.1 / 1.3 | 0.249 / 0.256 | 0.162 / 0.194 | 56 / 115591 | 0.00 |
| M_1000_90 | 33.7 | 0.04 / 0.23 / 0.67 | 1.6 / 1.8 | 0.232 / 0.288 | 0.144 / 0.217 | 180 / 373495 | 0.00 |
| S_150_45 | 38.8 | 0.06 / 0.30 / 0.68 | 3.3 / 3.9 | 0.336 / 0.212 | 0.376 / 0.217 | 302 / 512286 | 0.00 |
| S_150_90 | 38.5 | 0.07 / 0.34 / 0.70 | 0.7 / 1.1 | 0.427 / 0.325 | 0.441 / 0.335 | 371 / 724630 | 0.01 |
| E_foot_night | 144.3 | 0.18 / 0.44 / 0.58 | 2.4 / 1.0 | 0.558 / 0.503 | 0.485 / 0.432 | 490 / 1492056 | 0.29 |
| E_150_45_dusk | 281.1 | 0.03 / 0.15 / 0.44 | 11.1 / 7.6 | 0.448 / 0.257 | 0.407 / 0.232 | 451 / 910624 | 0.31 |
| E_150_45_storm | 97.4 | 0.03 / 0.20 / 0.54 | 6.1 / 5.0 | 0.417 / 0.237 | 0.468 / 0.261 | 450 / 910623 | 0.31 |
| N_150_45 | 103.6 | 0.05 / 0.26 / 0.63 | 2.6 / 3.1 | 0.454 / 0.282 | 0.501 / 0.291 | 311 / 703081 | 0.01 |

**E_150_45_night** (W2.2's night station, hour 23; added after the run above and baselined alone on a fresh page, run
`base-q2-1280-night/`, sheet `q2-1280x720-night-sheet.jpg`, OPENED: the raw scene has every crown, the final a dark blue
blur): raw land lapvar 446.8, final land t1/t2/t3 0.02/0.09/0.36 (W2.2's target t2 >= 0.9), halo abs/final 16.2/11.4 %,
A raw/abs 0.449/0.285, F raw/abs 0.397/0.238, 451 calls / 910,624 triangles.

**q2 at 1920x1080** (run `/home/user/.pc-scratch/pilot/r1/base-q2-1920/`, 21 min of stations after a 16 min load; no
console error, fallback empty; sheet `docs/shots/pilot/baseline/q2-1920x1080-sheet.jpg`, shrunk to 1000 px wide, OPENED;
`q2-1920x1080-summary.txt`): the brush is a fraction of the frame's height, so more pixels buy no detail from the air:
E_150_45 final land t1/t2 0.02/0.11 (0.04/0.25 at 720p), E_400_90 0.00/0.03, E_1000_90 0.00/0.03, E_foot 0.19/0.57,
M_150_45 0.07/0.27, S_150_45 0.02/0.17; the same draw calls and triangles as at 720p; post reads 63.2 M a frame (the
same reads per pixel). No A at this size (its reference would be 3840x2160).

**q1 and q0 at 1280x720** (runs `base-q1-1280/` and `base-q0-1280/`, 6 and 5 min of stations; no console error,
fallback empty; sheets `q1-1280x720-sheet.jpg`, `q0-1280x720-sheet.jpg`, shrunk, OPENED: at q0 the forest from 150 m
is the purple canopy wash with no trees, as the audit found). Internal size 1024x576 (q1) and 794x446 (q0), enlarged to
1280x720 by the sheet (22 reads an output pixel there: 16 + 6 in the enlargement branch). The finals are also measured
against the q2 run's raw scene (`node tests/stations.mjs --reref <run> --ref <q2 run>`, offline from the frames; key
`vsRef` in the baseline), the plan's tier measure. Final land t1/t2 against the q2 raw, foliage share, calls/triangles:

| Station | q1 | q0 |
| --- | --- | --- |
| E_foot | 0.20 / 0.58, 0.25, 315 / 735228 | 0.04 / 0.20, 0.17, 169 / 265350 |
| E_150_45 | 0.03 / 0.18, 0.20, 277 / 469046 | 0.02 / 0.13, 0.01, 136 / 160718 |
| E_400_90 | 0.01 / 0.09, 0.00, 297 / 432886 | 0.01 / 0.09, 0.00, 162 / 191310 |
| E_1000_45 | 0.01 / 0.37, 0.00, 76 / 127043 | 0.01 / 0.28, 0.00, 47 / 69913 |
| M_150_45 | 0.12 / 0.43, 0.00, 177 / 301942 | 0.10 / 0.41, 0.00, 79 / 139468 |

(The audit's tiers-all: E_150_45 t2 0.18 (q1) and 0.12 (q0), E_foot 0.53 and 0.17, M_150_45 0.43 and 0.40; costs at
E_150_45 277 / 469k and 136 / 161k: reproduced.)

**The phone profile** (`--device iphone14`: Playwright's iPhone 14 landscape, 750x340 css at DPR 3; run `base-phone/`;
sheet and crops `iphone14-sheet.jpg`, `iphone14-crops.jpg`, OPENED): today the game draws it at q2 with the DPR capped
at 1.5, a 1125x510 buffer; E_foot final land t1/t2 0.36/0.83, raw lapvar 231.7, 489 calls / 1,513,359 triangles; E_150_45
0.10/0.48, 663.6, 470 / 956,829; 17.5 M post reads a frame. W3.5's preset (DPR 1.25, tier 1) does not exist yet, so these
are the phone's "before".

Post reads counted (`--taps`), every station: prep 4 per half-size pixel, abstraction 13 per pixel (13 on far land),
keep 2 per half-size pixel, sheet 16 per output pixel: 28.1 M reads a frame at 1280x720. The halo share of today's
abstraction output is high where its brush is wide (11-16 % from 150-400 m up): the measure counts a blur's spread as
well as overshoot, so it means "no false sharpness" only where the output follows the raw scene (x26's: 0.02 %).
The 1000 m stations: the ship is above the edge of the air there (state SPACE, the world turns under it while the
world settles), so the ground under it is a few hundred metres from the 150 m stations' (E: autumn_woodland, 969 m up;
M: dry_riverbeds, 1004 m), as in the audit's runs; with the clocks pinned it is the same ground every run.

### W1.1 The station harness: HOW TO RUN A STATION SET (for PAINTER and whoever measures a picture)

One browser, one page, the loop held; numbers in Node. Always measure a CLEAN EXPORT, never the shared working tree:

    tools/export-head.sh /home/user/.pc-scratch/<role>/r1/after          # or: git archive <sha> | tar -x -C <dir>
    node tests/stations.mjs --root /home/user/.pc-scratch/<role>/r1/after --set quick --tier q2 --size 1280x720 \
         --taps --out /home/user/.pc-scratch/<role>/r1/st-after
    node tests/stations.mjs --compare tests/baselines/stations-784183b.json --with /home/user/.pc-scratch/<role>/r1/st-after
    node tests/stations.mjs --sheet <before-run-dir>,<after-run-dir> --labels before,after --out <dir>/before-after.jpg

- `--set`: `quick` (E_foot, E_150_45, E_1000_45), `audit` (the sharpness audit's twenty), `earth`, `air`, `all` (25),
  `phone` (with `--device iphone14`), station names or regular expressions, comma separated (`--set 'E_150_45,M_.*_90'`);
  the stations always run in the list's order. `--tier q2|q1|q0` (render scale 1), `--size WxH` (or `--device
  iphone14|pixel7|ipadpro11`, Playwright's landscape profiles).
- Extras: `--taps` (post passes' texture reads per pixel, counted in instrumented copies of their shaders, as they
  run: per pass, per frame, and the abstraction pass on far land), `--flicker` (F, one more render), `--alias` (A: two
  more renders at twice the size; slow), `--exp x21,x26,x23` (post experiments on the held scene, measured against the
  station's own raw scene; `--exp-abs` also keeps their v5).
- A run writes `run.json` (every number), `summary.txt` (one line a station, the audit's format plus halo, cost, A, F,
  taps), `frames/<station>_v<k>.png` (v0 final, v1 raw scene, v3 depth, v4 regions, v5 abstraction output; lossless),
  `sheet.jpg` (final | raw per station) and `crops.jpg` (1:1 crops of the land). OPEN the sheets and crops.
- `--compare` prints the guard's rules (plan section 5) per station: ok or FLAG (an item's own exceptions apply, e.g.
  W2.1's raw b1, W7.1's budget). `--baseline OUT.json --commit SHA --from DIR[,DIR]` collects runs into a baseline file.
  `--diff DIR_A,DIR_B` compares two runs number by number; `--reref DIR --ref Q2DIR` measures a lower tier's finals
  against the q2 run's raw scene (offline, from the frames). The baseline's frames (lossless) stay in
  `/home/user/.pc-scratch/pilot/r1/base-*/frames/` for a before/after `--sheet`.
- Timing on this machine (SwiftShader): the page loads in 4 to 6 min at q2 1280x720; a station takes about a minute
  plus the extras (see the run's `secs`). Free memory first (`free -m`); one browser of yours at a time.
- Determinism: the harness fixes the game clock (120 s) and the painter's wash clock (100) at every station, sets the
  hour again after the settle, and renders once before the measured render (the water reflects the frame before).
- Measures (tests/stationlib/metrics.mjs, a number-for-number port of the audit's metrics.py: on the audit's own frames
  of E_150_45 the largest difference over 144 numbers is 6e-5; tests/stationmetrics.test.mjs holds metrics.py's numbers
  on a synthetic set): lapvar, b1 b2 b3 (2-6, 6-16, 16-40 px), t1 t2 t3 (transfer of the raw scene's own detail) over
  the land, the ground, the ground by view distance (0-30, 30-150, 150-600, 600+ m), the foliage, the props; region
  shares; CIELAB mean and L* 10/50/90 per region (final and raw); the paper border strip's mean colour; cost (draw calls
  and triangles over every pass, renderer.info).
- HALO SHARE, a ruling of mine (the plan names the measure, not the view): pixels overshooting the raw scene's 3x3 range
  by more than 8/255 after the raw is carried to the output's tone (a straight line fitted on both blurred by 4 px).
  On the FINAL sheet the paper's grain, granulation and edge pooling alone put about 16 % of the land over the line at
  E_150_45 even with the far brush off (the lead's x26 frames: 16.6 %; its abstraction output: 0.02 %), so the plan's
  "halo share at most 0.5 %" is read on the abstraction output (`halo.abs`); the final's share is recorded and compared
  with its baseline, and an RCAS raises it (x23: 23 % against x26's 16.6 %).
- F (flicker): the projection is shifted by 0.25 px (nothing in the world moves), the fine-band change the shift does
  not explain over the fine band of the still frame. The run records `rawWrongWay` (the same with the sign flipped) as
  a check of the shift's direction: it must be larger. A: the same view at twice the size box-filtered down is the
  reference (the audit's alias.py); on the final the screen-space paper confounds it (the audit's note), so read A on
  v1 and v5.
- Post reads counted (`--taps`) at q2, native size: prep 4 per half-size pixel, abstraction 13 per pixel (far land 13),
  keep 2 per half-size pixel, sheet 16 per output pixel (the audit's static count said 17: one read is in the
  enlargement branch, not taken at native size).

### W1.2 A green gate (test-only; the game is not touched)

- `tests/trip.mjs` and `tests/loop.test.mjs` restored from `d874a8c` (the trip fixes were made in `97e5949`; `1c406e2` and
  `d874a8c` carry the same files): bumps counted per leg and by stretch (the ship's count runs from the page's start: one
  bump on the first leg failed the second leg's "no bumps" too); on "Too steep to land here" the script flies on as a
  player does (4 s at full throttle, nose level: 100 to 150 m) before coming down again (it pressed E on the same hover
  eight times over Saturn's honey_mist). The loop test's two messages say what is checked; assertions unchanged. NOT
  restored: `1c406e2`'s game change (sim.js, flight.js: the honest 'Land here' over steep ground) and its test
  `landprompt.test.mjs`: game code, not part of W1.2 (the plan says test-only); the shipped game still offers 'Land here'
  over 48 of 520 hover spots on honey_mist and then says 'Too steep'.
- `tests/all.mjs`: two new steps after the unit suites, `coast` (`src/physics/coast.mjs`; both stands must print
  "=>  PASS" and the exit code agree) and `ghostfield` (`docs/lead/evidence/review7/ghostfield.mjs`, which always exits 0:
  judged on its six JSON lines, radial speed while grounded, off the line, wrong material and steps in the air all 0;
  the worst step loss 0.26 / 0.52 m/s is printed, not judged). Both judges checked against made-up failing output (a
  stand NOT YET, a missing stand, one non-zero, a missing run: each FAIL). `--only coast,ghostfield` on the tree: 2 of 2
  stands PASS, 6 of 6 runs all zeros.
- Checks on a clean export of `0efcc3b` with these files: unit 208, physics 325, world 30, coast PASS at both stands,
  ghostfield all zeros.
- **painted-trip 3 of 3** (`node tests/all.mjs --export --only painted-trip`, one after another, 06:49-07:14 UTC, PAINTER's
  browser running beside it): run 1 on a clean export of `2355594` PASS (492 s, 50 checks), runs 2 and 3 on `8811ca4`
  PASS (470 s, 489 s, 50 checks each). Logs: `docs/shots/pilot/r1/painted-trip-run{1,2,3}.txt`. Said plainly: in none of
  the three did the ship bump or the game say "Too steep", so the two restored paths were not exercised by these runs
  (they guard against what failed the verifier's runs on `a539086` and `45629a7`).
- **`node tests/all.mjs --export` on `8811ca4`: ALL 15 PASSED** (07:13-07:59 UTC; unit 216, physics 325, world 30, coast
  2 of 2 stands, ghostfield 6 of 6 all zeros, static, play-stub 39, play-physics 39, trip-stub 50, m3 33, lock 14, audio,
  painted-play 39, painted-trip 50 (a fourth pass), painted-m3 33). Table: `docs/shots/pilot/r1/all-mjs-8811ca4.txt`.
  W1.2 is DONE. (`stations-quick` and `touch` steps: later, as the plan says; stations-quick takes the section 5
  thresholds once W2 has landed.)

## SHIPPED STATE (coordinator, 2026-11-14 ~02:00 UTC; read this first)

The owner chose to ship the last fully checked code rather than wait for the re-fix pass below. That pass (the
twenty-first and twenty-second PILOT agents: an honest "Land here" prompt over ground too steep to hold the ship, the
painted-trip script's per-leg bump count) was stopped half done. Its code is NOT in the shipped tree: `src/`, `tests/`,
`README.md`, `index.html` and `vendor/` were restored to `0bc7b64` (code of `3cfd184` with PAINTER's `0112e5e` and
`5fd389b`; `tests/all.mjs` ALL 13 PASSED on it in a clean tree, the twentieth agent's run). The half-done work is in
history for whoever comes next: snapshots `97e5949`, `1c406e2`, `d874a8c` (src/core/sim.js, src/ship/flight.js,
tests/landprompt.test.mjs, tests/trip.mjs, tests/loop.test.mjs, README.md). Known open, shipped: over Saturn's
honey_mist the game can offer "Land here" and then answer E with "Too steep to land here" (48 of 520 hover spots; fly on
100 to 150 m and it holds); `tests/all.mjs`' painted-trip step is flaky for that reason and because `tests/trip.mjs`
never resets the ship's bump count between legs.

## Hand-over, LAST FIX ROUND, RE-FIX pass (twenty-first PILOT agent; started about 01:15 UTC 2026-11-14; kept current)

**State:** in progress. The game's code is not touched in this pass; only the scripted trip and a test's wording.
(The owner's word relayed with the task, "use whatever it has now and continue with the rest", was said of the second
blind play-test, stopped with its goal met: `docs/COORDINATOR.md`, 22:10 UTC; read as: carry on with the round.) The
twentieth's hand-over just below holds for everything not named here. Scratch: `/home/user/.pc-scratch/pilot/last/refix/`.

The verifier did not accept only item (4), the canyon camera, and only because it was not fixed (it did not try it).
It is still left: see "Not fixed" below. It found no regression of the round, but `tests/all.mjs` not green: the
painted-trip step failed twice in three runs on `a539086` and the same way on `45629a7`.

### painted-trip (tests/trip.mjs), test only: in progress

Two faults of the script, neither of the game: (a) `ship.bounces` counts from the page's start and is never reset, so
one bump on the first leg failed the second leg's "no bumps" as well (the verifier's run 1: one bump on the way to
Mars, "no bumps" failed twice); now counted per leg, and the failure names the stretch it happened in (the climb, the
way to the air, the descent to the prompt, the landing). (b) Over Saturn's honey_mist the game said "Too steep to land
here" (with PHYSICS a site must be a slope the ground's friction holds; it looks up to 45 m round) and the script
pressed E on the same hover eight times, then waited 90 s: 7 checks failed (runs 2 and base). Now, on "Too steep", it
flies on as a player does (4 s at full throttle, nose level: 100 to 150 m) before coming down to try again.
`tests/loop.test.mjs`: the two messages that said "the page waits" for the ship now say what is checked (the hull is or
is not in the picture); the assertions are unchanged.

### Not fixed (as the twentieth left them)

- Item (4), the third-person camera jammed into Mars' canyon walls or staring down: not reproduced by the twentieth
  at five wall spots; the likely rule (the foot camera's lift cap) moves every slope's view. Not touched: nothing new
  about it came with this pass (the verifier did not try it), a blind change to the foot camera moves every world's
  view, and the game ships next.
- PAINTER's note: the foot camera's boom (and the landing camera) passes into crownless spires; PAINTER's `0112e5e`
  makes a spire hollow and soft with the eye inside. Not touched, same reason.
- The verifier's minor findings, left as they are: the course's world behind the ship gets the side arrow a little
  low even when high in the sky; the map's pre-selected (circled, not clicked) world gets no label in the air; the
  flattened grass under the parked ship as a darker strip on the first page; a place far round the curve ahead pointed
  at straight down (as on `45629a7`); `sim.shipInPicture()` now used only by tests (kept: the tests read it).

## Hand-over, LAST FIX ROUND (twentieth PILOT agent; started about 22:25 UTC 2026-11-13; kept current after every item)

**State at the end of the round (00:15 UTC 2026-11-14):** item 0 (the m3 regression) and items (1), (2), (3), (5) done,
committed and proven; item (4) not fixed (not reproduced); `node tests/all.mjs --export` on `3cfd184`: ALL 13 PASSED.
Nothing of PILOT's is half-done or uncommitted. Commits: `3066381`, `3cfd184`, `c1d36c9` (notes), and this hand-over.

Read this first; the nineteenth's hand-over just below holds for everything not named here. The task: the m3
regression first (tests/all.mjs failed on `45629a7`, steps m3 and painted-m3), then the second blind player's small
items (1) to (5) if small and safe, then `node tests/all.mjs` in a clean tree. Scratch:
`/home/user/.pc-scratch/pilot/last/` (scripts also in `docs/shots/pilot/last/scripts/`). First commit's parent: `e56a93f`
(the coordinator's log on top of `45629a7`).

### Item 0, the first page never came (m3, painted-m3): DONE

Cause: at the game's start the explorer stands 16 m from the parked ship with the hull in the middle of the first
view (hull over 4.2 % of the middle of the frame; `sim.shipInPicture()` true). `5ba725f` made a page wait for the
hull within 40 m (`EXIT.near`, was 14: so 16 m now counted) for up to `SKETCH_SLIP.shipWait` 45 s (was 30); a wanted
page lives only 40 s past its time (`updateSketches`: `t > w.due + 40` drops it and it is wanted afresh), so "45 s at
most" never ended: standing at the start, the first page never came. (The `levelView` on a thrown lock is not in it:
m3check runs with `pointerlock=0`.) Fix: `game.js captureSketch` paints the kept frame without the parked ship as
well as without the figure (their shade goes with them: the world lays shade only for what is visible), and the wait
for the hull is gone (`SKETCH_SLIP.shipWait` removed). README: "without you or the ship in it".
Test: `tests/sketchpage.test.mjs` (new, 2 tests, both fail on `45629a7`).
Proof (`docs/shots/pilot/last/`): `tests/m3check.mjs` (stubs) on a clean export of HEAD with these files PASSED (the
first page "b:earth:stub-lowland" about 5 s after the click; `m3-stub-after.log`; on `45629a7` it FAILED,
`m3-stub-before-45629a7.log`, the coordinator's); the painted variant (`--query fresh=1 --w 400 --h 225`) PASSED (the
first page "b:earth:temperate_forest" 15 s of real time after the click; `m3-painted-after.log`). In the real game at
quality 0, half scale, 960 x 540 (`scripts/firstpage.mjs`): on HEAD no page in 40 s of game time; with the fix the page
3.7 s of game time after the first look, the ship 16 m off in the middle of the view (`real-game-*-log.txt`); the screen
and the page side by side, opened: `first-page-without-the-ship.jpg` (the clearing and its birches, no hull, no
figure, no shade where the ship stood).

### Items (1), (2), (3), (5): DONE

(1) The first Space hold after boarding ignored. Cause: Space lifts off only on its press, in LANDED; at a few frames a
second the walk into the ship (1.5 to 3 s of game time, game time at most 0.25 s a frame) takes several seconds of
real time, and a press inside it was dropped. `sim.js`: Space pressed during the walk in (`transition.dir === 'in'`)
is kept (`_liftQueued`) and the ship lifts off as soon as the explorer is seated; Space held from the jetpack since
before E still does not lift off. Test: `tests/loop.test.mjs` new case (fails on `45629a7`: "hold: the ship lifts
off once the explorer is seated (state LANDED)"). In the real game (the same probe, quality 0, 960 x 540): Space held 1.5 s and let go
inside the walk in: on HEAD still LANDED 11.2 s of game time later; with the fix lifted off 3.0 s after the boarding began.
(2) Other worlds' labels under the edge of space. Cause: in the air the world nearest the nose became the target and
its label showed (Uranus over Venus, Jupiter over Mars). `game.js updateMarks`: under the edge of space (ATMOSPHERE,
LANDING) a world is marked only if it is the course chosen on the map (`sim.targetLocked`); above the air as before.
(5) "a place to land": the arrow down meant behind. `game.js edgeAngle`: a flight edge arrow for a point behind points
to the side it lies on (a little low, as on foot), and near dead behind (within about 14 degrees) keeps the side it had
(the label jumped sides as the nose swung); in front of the view as before (down for a place ahead and below). For the
place to land "behind" is judged OVER THE GROUND (second commit of this round): these worlds are 3 to 4 km round, and
the straight line to a place round the curve goes steeply down through the ground (the player's 6.6 km on Mars); a
place nearer over the ground than the ship is high (the ship over it, the nose raised) is pointed at down, the way to
it. (The first commit judged behind by the lens alone: with the nose raised over the place the arrow went to the side;
filmed, corrected.) For the course's world, behind the lens. Test for (2) and (5): `tests/flightmarks.test.mjs` (new,
3 tests, all fail on `45629a7`). Filmed in the real game (quality 0, 960 x 540, the ship teleported 150 m over Mars;
`docs/shots/pilot/last/flight-marks-before-after.jpg` and `.txt`, opened): the place 1.2 km behind and a little left:
before, an arrow at the lower left pointing down; after, at the left edge pointing left (3 km behind: left too); the
nose on Jupiter in the air with the ship over the place: before, "Jupiter 418 km 71 s" over the ship and the place's
arrow down; after, no Jupiter label, the place's arrow down. No console error, fallback `[]`.
(3) README: "a place to land" is "where a newcomer to that world stands, the landscape it opens with"; the views to find
are scattered, some near, some kilometres off, and stepping out a line says how far (measured in Node from each
world's spawn to its nearest view: Moon 0, Pluto 0.08, Neptune 0.19, Mars 0.27, Mercury 0.28, Uranus 0.45, Venus 2.0,
Earth 2.3, Jupiter 3.8, Saturn 5.5 km: `/home/user/.pc-scratch/pilot/last/sitevista.mjs`). The game is unchanged.

### Item (4), the third-person camera in Mars' slot canyon: NOT FIXED (not reproduced)

Probe `/home/user/.pc-scratch/pilot/last/probes/canyon.mjs` (the real Mars surface and obstacles in Node): 403 spots in
Rust Canyons at the foot of a wall rising more than 10 m within 8 m; at five of them (walls rising 15 to 57 m) the
explorer ran (Shift+W) 10 s into the wall and 10 s away from it: running into the wall the view never dipped below
-27 degrees (mostly -7), the lift stayed 0, the camera kept at least 1.15 m clear of the ground; with the wall at the
explorer's back it dipped to -56 degrees at worst while near it, never under -60. The player's "staring straight
down" (frame `085_mars_pitch.jpg`) matches the foot camera's lift cap (`camera.js updateFootCamera`: a rise behind
lifts the lens up to 0.9 x boom + 1 m, then the boom is pulled in toward 2.2 m: the lens over the head, looking down);
changing that rule moves every slope's view and the footcam tests' cases; without the player's spot (their log gives
only "400 to 510 m from the ship") I could not show a before/after, so it is left. The faceted slab in first person is
the terrain mesh close up (PAINTER's).

### Not fixed, and for whoever comes next

- Item (4), the canyon camera: above (not reproduced; the lift cap is the likely rule).
- PAINTER's note for PILOT (`docs/notes/painter.md`, this round's items 1 and 3): the foot camera's boom passes into
  tall props without crowns (Neptune's ice spires, 17 to 27 m; `camera.js CROWN_KITS` keeps the lens out of crowns
  only) and the landing camera too; PAINTER made a spire hollow and soft when the eye is inside it (`0112e5e`), so the
  frame no longer shows the hard polygons, but the boom itself still goes in. Not touched in this round (a camera rule
  for every world, the last round).
- Older, still standing: PAINTER's exact change for the Uranus view sketch's dark wash (`sketches.js sketchHand`, span
  floor 0.45; `docs/notes/painter.md`), not applied; the foot camera's thicket rule giving an eye view with no figure in
  Earth's wood; mouse pitch 0.8 in the air; the Neptune label on the ship not found.

### State of the tree and checks (this round)

Second code commit (the place-to-land arrow over the ground): checks on a clean export of `0a92d45` (PAINTER's last
fixes in) with it (`t2`): world 30, unit 208, physics 325, `coast.mjs` PASS at both stands, `ghostfield.mjs` all
zeros. First code commit `3066381`: checks on a clean export of `e56a93f` with its files (`t1`): world 25, unit 208 (202 + `sketchpage.test` 2,
`flightmarks.test` 3, the new `loop.test` case), physics 325, `coast.mjs` PASS at both stands, `ghostfield.mjs` all
zeros (worst step loss 0.26 / 0.52 as always); the painted game at quality 0 loads with no console error, fallback
`[]` (the probes). Commits: `3066381` (items 0, 1, 2, 3, 5), `3cfd184` (item 5 corrected: behind over the ground), and
the hand-over. `node tests/all.mjs --export` on `3066381`: ALL 13 PASSED (`docs/shots/pilot/last/all-mjs-3066381.txt`);
on `3cfd184` (with PAINTER's `0112e5e`, `5fd389b`; the code of the tree as it ships unless someone commits after):
**ALL 13 PASSED** (`docs/shots/pilot/last/all-mjs-3cfd184.txt`, `-table.json`): unit 208, physics-unit 325, world-unit
30, static, play-stub 39 checks, play-physics 39, trip-stub 50, m3 33, lock 14, audio, painted-play 39, painted-trip 50,
painted-m3 33. Not checkable here (all.mjs says so): a real GPU's frame rate, a real mouse under pointer lock, a real
gamepad, how the sound sounds. Not verified by me: the top tier (quality 2) in the game with this round's code (the
probes and films ran at quality 0); items (2) and (5) only by teleporting the ship over Mars, not in a full flight.
Scratch: `/home/user/.pc-scratch/pilot/last/` (`head/` and `all/export/` clean exports; the `t*` trees deleted).

## Hand-over, PRE-SHIP RE-FIX pass (nineteenth PILOT agent; started about 19:15 UTC 2026-11-13; kept current after every item)

Read this first; the eighteenth's hand-over just below holds for everything not named here. The verifier did not accept
item 1 of the round (the pulse) because of its regression R1, and found R2 to R4 (the task text of this pass lists
them). Scratch: `/home/user/.pc-scratch/pilot/preship/refix/` (`head/` a clean export of `22120b9`, `base/` of
`8c7d603`, `vp/` copies of the verifier's probes from `/home/user/.pc-scratch/verify/preship-pilot/probes/`,
`probes/` mine (also kept in `docs/shots/pilot/preship/refix/scripts/`), `film/` the real-game films, `g1` the grand
tour's clean export; the trees `t1`, `c1`, `c2` with my files were deleted after use). All four items are done and
committed; the grand tour's result is under "State of the tree" below.

### Done, with proof

1. **R1, the pulse into the chosen world or round it without end (and so item 1 of the round).** Cause as the verifier
   said: in a pulse the speed was planned along the nose only (`pulseAdvice`); with the nose on the tangent past the
   world just left or one between, the course's world was off the line of flight, the drive ran up toward 30 km/s, and
   once round it had less room than braking takes. `pulse.js courseAdvice` (and `brakeSpeed`, the braking curve
   pulled out of `pulseAdvice` unchanged): the speed is also held to the braking curve for the STRAIGHT distance to the
   course's world's arrival sphere, wherever that world lies; the straight distance is never longer than the way round,
   so the drive is always slow enough to let go at that sphere (inside it the curve allows only cruise speed, so an
   overshoot lets go too: no circling). `sim.js stepFlying` uses it for the pulse (bound to `ps.dest`). Proof
   (`docs/shots/pilot/preship/refix/`): the verifier's `course-time.mjs` on the tree: nose ahead 24 clocks x 90 pairs
   2160 of 2160 arrive, 0 into a world, 0 still pulsing (head: 98 into the world); nose behind 2160 of 2160; the first
   two hours 1080 of 1080 (head 46 bad) (`course-time-fixed.txt`); my `arrive.mjs` (first hours, 540 runs): fastest
   into the chosen world's sphere 715 m/s, never under the edge of its space, no other world within twice its edge of
   space (`arrive-fixed-first-hours.txt`); `recover.mjs` (Uranus -> Moon at clock 0): after 200 s the ship has long
   arrived, at rest 1.9 km from the Moon's centre (as every nose-on Moon arrival on `8c7d603`); Venus -> Earth at clock
   0.3 from 945 m (the real-game case): round Mercury (closest 5 to 10 km), in at cruise, "Earth ahead" said about 5 km up
   (4.2 km up a second and a half later; `venus-earth-fixed.txt`). Tests (`tests/course.test.mjs`, 3 new): every world to every other at clocks 0, 3000 and
   3600 s, nose ahead and behind (540 pulses: let go at the sphere at no more than 1.25 x cruise, never inside 0.9 of
   the sphere while pulsing, never under the edge of space after, "<World> ahead", no pulse longer than 2.5 x its ETA +
   30 s, never inside another world's edge of space): on `22120b9` 27 of 540 fail; Venus -> Earth as above: fails on
   `22120b9`. The verifier's `course-matrix.mjs` (11520 runs: 10 start worlds, 4 heights, still and moving, 4
   longitudes, 9 targets, mark behind / above / below / beside): no failure with a pulse (`22120b9`: 196, Venus ->
   Earth into Earth's air among them); its 1095 others are the probe's own "moving" pose that points the ship down
   into the air before F, the same 1095 as on `22120b9`; `climbF.mjs` (climb out of Earth, F with a course): 144 of 144
   arrive (`course-matrix-fixed.txt`).
2. **R2, F's hold on the course.** `sim.js`: `targetLocked` is `true` for a world chosen on the map (held until it is
   reached or the map changes it) and `'f'` for F's own hold, which ends with its turn or its pulse (`unlockCourse`: F
   stops the turn, A / D or the mouse stops it, the turn ends refused, the pilot drops out of a pulse); "<World> lies on
   your course: F goes on round it to Saturn" keeps the hold (it promises that). `save.js` saves only the map's hold.
   The course is again "the marker last pointed at" as README says. Proof: the verifier's `lockaim.mjs` on the tree
   (`lockaim-fixed.txt`): after F, F (a drop-out) the nose on Jupiter says "Pulse to Jupiter" and F pulses to it; after
   "Turn stopped" the nose on Mars says "Pulse to Mars". Test (course.test, new): the same, and a world chosen on the
   map still holds after a stopped turn; fails on `22120b9`.

Checks for 1 and 2 on a clean export of `db31c96` with these files (`c1`): world 25, unit 201, physics 325, `coast.mjs`
PASS at both stands, `ghostfield.mjs` all zeros (worst step loss 0.26 / 0.52 as always), `wallrun.mjs` earth sea_coast
0.2 m at most on ground over 50 degrees; the game at quality 0 loads with no console error, fallback `[]`.

3. **R3, a label that must show slid up to a whole picture from its ring.** `layout.js placeMust / nearest`: to keep off
   a slip (the prompt, the notice, the gauges, the read-out) a label that must show (a place to land, a view, the ship,
   the target) now moves at most `MARKS.reach` (40 px) from one of its four places, away from the ring AND across it
   (a label beside the ring nudged 4 px up between the ship and the prompt is the player's own frame); the nearest such
   place clear of everything wins; with none that near it lies on as little of a slip as a place within reach allows;
   off the SHIP it still slides as far as the hull takes (the M4 re-fix rule) and then at most 40 px more to keep off
   a slip. Proof (`docs/shots/pilot/preship/refix/layout-reach.txt`; the verifier's two probes and mine, which also
   measures how much of a label lies on a slip): the round's own frame (960 x 540): 0 of 3719 labels more than 60 px
   from the ring (head 314, worst 217 px), worst 29 px, 0 on a slip (base `8c7d603` 560 on a slip, 60 % of the label
   on average); the verifier's random scenes: 640 x 360 0 more than 60 px (head 458, worst 441), worst 55 px, 150 of
   2483 touch a slip with 4 % of the label on average and 20 % at worst (base 785, 34 %, 121 %); 960 x 540 and
   1280 x 720: 0 far, 0 on a slip. Test (layout.test, new): those four scenes, 1500 rings each: every label within 60
   px of its ring, off the ship, inside the picture, at most 25 % of it on a slip at 640 x 360 and none above; fails on
   `22120b9` ("960x540: the farthest label 207 px from its ring"). The other six layout tests pass unchanged.
4. **R4, one nonsense trip under the lock ended it for the visit.** `input.js`: after the lock's first trip (three
   undone jumps in 1.5 s) the game drags, and the clicks right after do not take the lock (that is what trapped the
   blind player: every click took it back, the nonsense with it); a click `LOCK_RETRY_MS` (15 s) later tries the lock
   once more; a second trip is for the session (as on `8c7d603`, but with the round's fixes that keep the drag working
   whatever the browser does with the lock: `locked` false on the fall-back, the lock's moves never pass for a drag, a
   late lock let go). Messages: "Mouse capture misbehaved: hold the left button and drag to look (a later click tries
   capture again)", then "Mouse capture is misbehaving in this browser: hold the left button and drag to look". README
   says so. Tests: input.test (rewritten case: five clicks after the trip drag 200 px and never ask; 15 s later a click
   asks and has the lock, a move under it turns the view; a second trip ends it, three later clicks never ask, the
   drags turn the view; fails on `22120b9`: "a later click may try it again"); `tests/lockcheck.mjs` extended and
   PASSED in headless Chromium with its real lock (`lockcheck-second-chance.txt`): the trip, three clicks not taken,
   drag 40 px = 0.092 rad, 10 s later a click takes the lock again, the nonsense trips it again, the lock is gone for
   the session, three clicks 16 s later not taken, the drag still 0.092 rad. Not measured: a real browser on a real
   mouse that glitches once (none here).

Checks for 3 and 4 on a clean export of `015bc21` with these files (`c2`): world 25, unit 202, physics 325, `coast.mjs`
PASS at both stands, `ghostfield.mjs` all zeros, `wallrun.mjs` 0.2 m at most over 50 degrees; lockcheck PASSED.

**R1 in the real game** (the verifier's `play.mjs venusEarth` on `c2`, quality 0, 640 x 360, real keys and a click on
the map; `docs/shots/pilot/preship/refix/venus-earth-real-game.jpg` and `-log.txt`, opened): clock 0.3, Venus 1 km
up, Earth chosen on the map, the nose on Earth, F: the pulse passes Mercury 4.4 to 5.3 km over its ground at 9.9 km/s,
brakes from 77 km out, lets go at 905 m/s 5.1 km over Earth with "Earth ahead", and coasts to 2.8 km up at 225 m/s
with Earth filling the picture (on `22120b9` it hit Earth's ground at 4.2 km/s). No console or game error, fallback `[]`.

**The pulse from Earth with the mark behind, filmed on the final code** (the verifier's `play.mjs earthF` on `c2`,
quality 0, 640 x 360, real M, a click on the map, F as the prompt says; `earth-mark-behind-real-game.jpg` and `-log.txt`,
opened): Saturn's mark behind the ship 2.6 km over Earth, "Pulse to Saturn"; F: "Turning onto the course for Saturn",
"F Stop turning", the arrow swings up the right edge and Saturn's ring comes to the nose in 3.8 s, the drive starts,
brakes from about 150 km and lets go "Saturn ahead" 5.2 km up at 784 m/s; Neptune's mark above: turned in 3 s,
"Neptune ahead" 4.6 km up; Jupiter's mark behind: turned in 3.8 s, "Jupiter ahead" 5.5 km up. No console or game
error, fallback `[]`. Seen in it, older than this round and not on this pass's list (the verifier's "not counted"
(a)): with the mark dead behind, its edge arrow and label sit at the bottom middle by the "Pulse to Saturn" prompt
(first tile), and with "Neptune ahead" up Jupiter's ring lies on the fading prompt (tenth tile).

### Not fixed (and why)

- **The verifier's "seen, older than this round, not counted"**: (a) the flight target's edge arrow at the bottom
  middle by the prompt with the mark dead behind, and a world's ring on the prompt (seen again in my Earth film,
  tiles 1 and 10); (b) the foot camera's thicket rule giving an eye view with no figure in Earth's wood. Not on this
  pass's list ("fix exactly these, and nothing else"); left for a later round. A cheap way for (a): in `game.js`
  `edgeY` / the edge arrow's place, lift an arrow pointing straight down above the prompt band as the place-to-land
  arrow already is (`layout.test` "an arrow pointing straight down rides at 0.69 of the picture's height").
- **The rest of the eighteenth's "Not fixed"** stands (Uranus' dark view sketch: PAINTER gave the exact change in
  `docs/notes/painter.md` lines 160-171 for `src/core/sketches.js sketchHand`, not applied in this pass; the Neptune label on
  the ship not found; mouse pitch 0.8 in the air).

### State of the tree and checks

My commits this pass: `015bc21` (R1, R2), `23e7c81` (R3, R4), `da7d587` (the films' evidence, this hand-over),
`5bad2dc` (the coordinator's WIP snapshot of two small edits to this hand-over), `37e7573` (the grand tour) and the
last one (this list). First commit's parent: `db31c96` (PAINTER's re-fix hand-over). Nothing of mine is
half-done in the working tree; PAINTER's uncommitted files there are not mine.

**`tests/grandtour.mjs` on a clean export of `23e7c81` (the code of this pass whole): PASSED**
(`docs/shots/pilot/preship/refix/grandtour/`: the log, `grandtour.json`, `summary.json`, a sheet of its nine frames at
400 x 225, opened): from the title card with real keys and mouse, 8 landings of 8 (Mercury, Venus, Mars, Jupiter,
Saturn, Uranus, Neptune, Earth) in one sitting, 27.4 minutes, 1552 s of game time; every leg one pulse, nothing
refused, nothing barred ("<World> ahead" each time; the drive let go 5.1 to 11.3 km from the world's centre, each
world's arrival sphere), every landing at the first try; no console error, page error, failed or outside request.
Seen in its frames, not this pass's: at Uranus the notice "A view to find 1.1 km behind to the right" and the new
page's slip take most of the small picture.

Not run in this pass: `node tests/all.mjs` whole, the top tier (quality 2) in the game, `tests/trip.mjs`,
`tests/playthrough.mjs`, `tests/m3check.mjs`, `tests/audiocheck.mjs`.

## Hand-over, PRE-SHIP fix round (eighteenth PILOT agent; started 15:50 UTC 2026-11-13; kept current after every item)

Read this first; the seventeenth's hand-over below holds for everything not named here. The task: the blind new
player's findings on `3d38bb2` (landed on 3 of 8 worlds), PILOT's list 1 to 6, then `tests/grandtour.mjs` once on a
clean export and a film of the pulse from Earth with the mark behind. Scratch: `/home/user/.pc-scratch/pilot/preship/`
(`mktree.sh <dir>`: a clean export of HEAD with my changed files over it; `checks.sh <root>`: world, unit, physics,
coast, ghostfield, wallrun; `head/` a clean export of `3d38bb2` for before/after; `probes/`, `film/`). My scripts kept
in `docs/shots/pilot/preship/scripts/`. First commit's parent: `8c7d603` (PAINTER's item 1, on top of the coordinator's
`1294633`).

### Done, with proof

1. **The pulse goes where the course says (BROKEN 1, CONFUSING 5).** `sim.js pressF / stepCourseTurn / course`,
   `pulse.js courseDir`, `PULSE.turnFirst / turnRate / turnAccel / turnDone / passMargin / blockMargin`. F with a
   course (a world chosen on the map, or the marker last aimed at: the one the prompt names) and the nose more than
   12 degrees off it first turns the ship onto the course in plain sight (0.7 rad/s at most, eased in and out, a half
   turn in about 5 s; the notice "Turning onto the course for Saturn", the prompt "F Stop turning"; F again, A / D or
   a deliberate mouse movement stops it), then pulses; within 12 degrees it pulses at once and the drive draws the
   nose on. The course goes along the tangent past any sphere (the world just left, a world between, the Sun) that
   lies across the straight line, at 1.18 x its radius, so the drive goes round Venus instead of stopping in front of
   it; the pulse steers by the world it was started for (`ps.dest`), not by whatever comes near the nose; F locks the
   course. In a pulse the ship no longer "follows the curve of the world" (flight.js: that rotation bent a pulse past
   Venus into its sphere). Should a pilot steer the drive into a world anyway, the screen says "Venus lies on your
   course: F goes on round it to Saturn". Choice logged: the drive steers round (not only a word), because a new player
   should not have to plan around worlds. Tests: `tests/course.test.mjs` (4): from Earth's orbit with the mark behind,
   above and beside the nose, a course to each of the 9 other worlds arrives (27 runs; each says "Turning onto the
   course" and "<World> ahead", never flies more than 2 km further away, a calm turn of 1.9 to 5 s); courseDir by
   itself; the turn stopped by F and by the mouse; a pulse to Saturn with Venus dead ahead goes round Venus and arrives
   with nothing said about Venus. All fail on `3d38bb2` (`course-head.txt`: the mark behind, F flew 468 -> 11828 km
   from Mars, 706 -> 11705 km from Saturn; above or beside: "Too close to Earth" or 878 -> 11738 km from Neptune;
   `course-after.txt`: every one arrives). Filmed in the real game (quality 0, 640 x 360, `docs/shots/pilot/preship/
   pulse-behind-earth.jpg` and `-log.txt`, opened): Saturn's mark behind the ship 2.6 km over Earth, "Pulse to
   Saturn"; F: the ship swings round over 4 s with the notice up, Saturn's ring comes to the nose, the drive starts,
   arrives "Saturn ahead" at 5.2 km up; no game error, fallback empty. `tests/grandtour.mjs` waits out the turn after
   F and follows "lies on your course" by pressing F again. `helpers.mjs flyTo` measures the distance to the world
   flown to (it read the target of the moment, which inside the world's frame is whatever lies near the nose).
   README: the first minute and the F line say what F does now; the first word above the air says "M opens the map:
   choose a world there, then press F to fly to it".

2. **Steering above the air, after re-boarding, and C (BROKEN 2, CONFUSING 6).** Cause of "the mark overhead stays an
   arrow, A / D swing it round the edge": the 78 degree pitch limit held as long as the world's up did (to 9.4 km over
   Venus; the air ends at 0.9 km), and A / D turned round the world's up, which with the nose overhead is a roll of the
   picture. `flight.js`: the pitch limit only in a world's air (altitude under the edge of space); the air's other ways
   (levelling to the horizon, A / D round the world's up, following the curve, a gentler pitch) fade out from the edge
   of space to 2.5 times its height (`SHIP.airTop`); A / D turn round the ship's own up as the nose points within about
   30 degrees of straight up or down; the mouse's pitch is 0.8 of itself in the air (`airPitchGain`; 0.6 and 0.75 were
   tried: the real-world trip in contract.test then fails one Mars landing, "No level ground here", the landing
   assist's glide meeting a slope: not touched); C sinks and Space rises at the lift's speed whatever the nose does.
   **The drag that did nothing after a re-boarding on Venus was not found in the game:** a new test steps out on Venus,
   boards again, climbs above the air and drags up, down, right and left 300 px: the nose turns 0.8 to 1.25 of what
   was asked each time, A turns it; the frames the player quotes (130, 132) are in deep space, where nothing in the sim
   limits the nose; the player's driver keeps the mouse where its last drag left it, so repeated upward drags walk it
   off the top of the page (see item 2's note below on what headless Chromium does with that). Tests:
   `tests/steer.test.mjs` (4): over Venus at 1.5, 2.7 and 6 km with Saturn overhead the mouse brings the nose within
   2 degrees of it and D then swings the nose 25+ degrees off it (head: stuck 12.1 degrees off); in the air the limit
   holds and a 120 px drag pitches 0.8 of itself (head 11.7 for 11.7); C held 12 s with the nose 20 degrees up at 225 m
   on Earth, Venus and Mars sinks 60+ m and never climbs 15 m (head: Venus 265 -> 282 m); re-boarding on Venus as
   above. The first three fail on `3d38bb2`.

   **Why the drag did nothing (frames 130 and 132): the player's harness, not the game.** Its driver keeps the mouse
   where the last drag left it, so repeated upward drags walk it off the top of the page; measured in headless
   Chromium (`docs/shots/pilot/preship/drag-off-page.txt`, `scripts/drag-off-page.mjs`): a drag that starts inside
   and leaves the page is delivered whole (10 moves, 400 px); one that starts off the page delivers nothing (no
   mousedown, no move). After the reload the player's click on the title card put the mouse back on the page.

Checks for 1 and 2 on a clean export of `1294633` with these files (`t1`): world 22, unit 192 (184 + 8 new), physics
325, `coast.mjs` PASS at both stands, `ghostfield.mjs` all zeros (worst step loss 0.26 / 0.52 as before), `wallrun.mjs`
earth sea_coast 0.2 m at most on ground over 50 degrees; the game at quality 0 loads with no game error, fallback empty.
Committed `b0710fe`.

3. **Pointer lock's fall-back (BROKEN 3).** `input.js`: once the lock has reported nonsense the game falls back to
   dragging FOR THE SESSION (the first fall-back used to re-arm the lock for the next click, and in headless Chromium
   every click took the lock again with the nonsense: dragging never turned the view); a lock that arrives after the
   fall-back is let go at once; moves count as lock moves only while the game still uses the lock (headless keeps
   the canvas as `pointerLockElement`); `input.thrown` makes the game level the view (`sim.levelView`). `save.js`:
   the view's pitch is saved and restored within `camera.js VIEW_PITCH` (26 degrees down to 17 up), so a view thrown
   straight up is not the next session's first view. Tests (input.test, rewritten and new; save.test new): the
   nonsense drops the lock for good, five later clicks never ask for it, the drags turn the view 200 px; a late lock
   is let go and the lock's deltas never pass for a drag; a view saved at 1.25, 1.2, -1.1, -1.15 rad comes back
   within the range (fails on `3d38bb2`: "saved at 1.25: the first view's pitch 1.20"; the input cases fail there
   too). `tests/lockcheck.mjs` (headless Chromium's real lock) rewritten to the rule and PASSED on `t2`: the lock
   dropped, three more clicks do not take it, drag-look 40 px = 0.092 rad. README says so.
4. **The way back to the ship (CONFUSING 4).** `sim.js shipMark` (`SHIP_MARK` 40 m), `game.js updateMarks`: on foot,
   with the ship parked on this world, farther than 40 m or out of the picture, a slip "the ship" with the distance:
   a ring over it in view, an arrow at the picture's edge out of it (behind or below the view the arrow goes to the
   side the ship lies on: straight down it lay on the figure's legs). Test (vista.test): beside the ship near, after
   a 9 s run 40+ m and shown; none in the ship. Filmed (`docs/shots/pilot/preship/foot-ship-mark-and-hud.jpg`,
   opened; quality 0, 640 x 360, Earth's spawn): facing away 16 m (arrow), walked off 72 m (arrow), turned 60 degrees
   ("the ship 72 m" at the right edge), facing it (a ring over it among the birches, the label over the ring); no game
   error, fallback empty. The side-arrow rule came after that film (its first two frames show the arrow on the legs);
   filmed after it (`foot-side-arrow-and-slip.jpg`, opened): facing away 16 m and 72 m, and in first person, the
   arrow at the left edge, a little low, off the figure. README says so.
5. **HUD overlaps (MINOR 11), README gaps, Mercury's column.** `theme.css`: the prompt, the notice and (on foot) the
   jetpack gauge are placed in pixels as well as shares of the window (`max(16%, calc(9.5% + 36px))` and so on): at
   640 x 360 the notice lay over the prompt and the prompt on the throttle (seen in the pulse film); with the frame
   read-out up (`pc-stats-on`) the hint and a notice on foot go under it. `layout.js`: a label that must show slides
   to a place clear of the slips before it lies on one ("a place to land 256 m" over "Land here" and the throttle);
   test in layout.test with the player's frame (fails on `3d38bb2`: the label on the prompt). Filmed: the turn's
   notice now over "F Stop turning", the throttle clear; the read-out with a notice on foot under it. Not found: the
   frame with the Neptune label on the ship (the player's Neptune frames show only edge arrows; the label-on-ship
   rule of the last pass holds there). Mercury: `explorer.js collideObstacles`, `EXPLORER.glance` 0.6: a run that
   meets one trunk or column glances off it, a share of the speed lost into it carrying on round it; test
   (explorer.test; fails on `3d38bb2`: 7.4 -> 0.0 m/s dead on); the real Mercury spawn with PHYSICS
   (`mercury-spawn-run.txt`): heading 0 slowest after the first second 0.79 -> 4.45 m/s, worst one-frame loss 6.61 ->
   2.24 m/s, the other seven headings identical to the digit. Seen in the grand tour's frames at 400 x 225: a notice on
   foot under the new page's slip in the top right corner; `hud.js` (`pc-sketching`) and `theme.css`: while the slip
   is up a notice on foot is lettered from the left (filmed, `foot-side-arrow-and-slip.jpg`, last tile: clear).
6. **Sketchbook captions and a word toward the nearest view (MINOR 12 in part, CONFUSING 7).** `game.js bookPages`: a
   view named as a landscape of its page is captioned "<name>, the view" (Uranus: "Pearl Fog Flats" twice); not seen
   in the game (game.js does not load in Node). `sim.js EXIT.near` 14 -> 40 m and `SKETCH_SLIP.shipWait` 30 -> 45 s:
   a landscape sketch waits while the hull lies in the middle of the frame within 40 m (Venus' sketch kept the ship);
   not filmed. `sim.js viewWord`: stepping out with no view within its mark's 150 m, the notice "A view to find 1.5
   km ahead to the left: fly nearer, or walk" (8 s); test (vista.test). Not done: the dark grey view sketch of Uranus'
   white fog (needs the frame it was drawn from; not looked into).

### Not fixed (and why)

- **The view sketch of Uranus' white fog drawn as a dark grey wash** (MINOR 12, part): not looked into (it needs the
  frame the sketch was drawn from; the sketch is drawn from the picture on the screen at the easel).
- **"The Neptune target's label sits on the ship"** (MINOR 11, part): not found in the player's frames (its Neptune
  frames 127, 128, 151-155 show the label beside an edge arrow, off the ship); the last pass's slide rule holds there.
- **A gentler mouse pitch in the air than 0.8**: 0.6, 0.7 and 0.75 each make the real-world trip in contract.test
  fail one Mars landing ("No level ground here": the landing assist's glide to a site 45 m away meets a slope at
  4 m and gives the ship back). That fragility of the landing assist is older than this round and not touched.
- **UGLY 8 and 9, MINOR 10** (the stair-stepped figure and ship at tier 0, the flat frames, the climb to space): the
  picture, PAINTER's (its items 2 to 4 of this round).

### For PAINTER (seen, not mine to change)

- Arriving at Saturn by pulse (chase view, 5.2 km up, 788 m/s, quality 0, 640 x 360), the left third of the picture
  is one flat paper-pale wash (the ring plane seen from inside it?): the last tile of
  `docs/shots/pilot/preship/pulse-behind-earth.jpg`, full frame `/home/user/.pc-scratch/pilot/preship/film/out1/12-arrived.jpg`.

### State of the tree and checks

My commits: `b0710fe` (items 1 and 2), `5ba725f` (items 3 to 6), and the last one (the slip rule, the grand tour's
evidence, this hand-over). Items 3 to 6 checked on a clean export of `25074de` with these files (`t2`, `t3`): world 24
(PAINTER's new test), unit 198, physics 325, `coast.mjs` PASS at both stands, `ghostfield.mjs` all zeros (worst step
loss 0.26 / 0.52 as always), `wallrun.mjs` earth sea_coast 0.2 m at most over 50 degrees; lockcheck PASSED; the game
at quality 0: no game error, fallback empty. The last commit's two files (hud.js, theme.css) checked on a clean
export of `4bbbae4` with them (`t4`): the same numbers; filmed in the game, no game error, fallback empty.

**`tests/grandtour.mjs` on a clean export of `5ba725f`: PASSED** (`docs/shots/pilot/preship/grandtour/`: the log,
`grandtour.json`, `summary.json`, a sheet of its nine frames, opened): from the title card with real keys and mouse,
8 landings of 8 (Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Earth) in one sitting, 30.4 minutes, 1578 s
of game time; every leg one pulse, nothing refused, nothing barred ("<World> ahead" each time); Saturn's landing
took three tries ("Too steep to land here", then "Setting down on level ground 70 m away"); no console error, page
error, failed or outside request. The harness aims at the marker before F, so no leg needed the turn onto the course
(that is item 1's own test and film).

Not run in this round: `node tests/all.mjs` whole, the top tier (quality 2) in the game, `tests/trip.mjs`,
`tests/playthrough.mjs`, `tests/m3check.mjs`, `tests/audiocheck.mjs`.

## Hand-over, M4 RE-FIX pass (seventeenth PILOT agent; started 12:24 UTC 2026-11-13; kept current after every item)

Read this first; the fourteenth's hand-over below holds for everything not named here. The verifier did not accept
four items of the fix round and found nine regressions (the task text of this pass lists them). The fifteenth agent
was cut off after eight minutes (nothing committed); its half-done edits came in with the coordinator's snapshot
`6e550ce` (`src/player/camera.js`, `src/core/sim.js`), with which 2 of 181 unit tests failed. The sixteenth only read.
Scratch: `/home/user/.pc-scratch/pilot/m4/s17/` (`t1`, `t2` clean exports with my files, `out1` .. `out5` the films,
`next/` and `*-patch.py` the changes as prepared, all applied now). My probes are kept in
`docs/shots/pilot/m4refix/scripts/` (glade, kits, whyhid, landcam, landdiag, easeltrace, wxclock, scenes17); the
verifier's are read from `/home/user/.pc-scratch/verify/pilot/probes/` (run with `ROOT=<tree>`). **All of this pass's
items are done or named under "Not fixed"; nothing is half-done in the working tree.**

### Done, with proof

1. **The foot camera's crown rule (verifier's MAJOR regressions 1 and 2, regression 3, PHYSICS 4, PAINTER 1).**
   Kept the snapshot `6e550ce` and finished it: `sim.js footCrowns` hands the crowns to the foot camera IN THE AIR
   ONLY (0.35 s off the ground and 2 m over it, not afloat): on the ground the view is as it was before the round,
   the figure always drawn. `camera.js footBoomAmongCrowns`: where a crown leaves no place for the lens a metre clear
   at `footBoomMin` 3 m or beyond (and while the head itself is in a crown) the boom is `footBoomMin`, never shorter
   (the first rule took it to 0 / 0.8 m: the explorer's eyes) and never longer (the crown between lens and figure all
   within PAINTER's 3.6 m, where it parts into dabs). `sim.js plantKit`, `camera.js CROWN_KITS / crownShape`: a plant
   carries a crown by its kit (broadleaf, conifer, fungus), so reeds, kelp, crystals, spires and waves are solid
   for themselves only (`kits.mjs`: Saturn's crystal reeds 30 of 30 no crown, Neptune's kelp 19 and 26 of 26, Earth's
   birches and pines all crowned, Venus' fungal towers a cap). Tests: `tests/footcam.test.mjs` rewritten to the new
   rule (into a crown: footBoomMin; a reed has no crown; the jetpack in a glade 12 m round: the lens never in a crown,
   boom cut 231 frames; 9.5 m round, no room: never under 3 m, the figure drawn in every frame).
   Proof: the verifier's `walkcam.mjs` on the tree, Earth: spawn 0 % hidden, 0 flips (head 40 %, 25); autumn woodland
   3 %, 4 flips (head 29 %, 23; dea95fb 3 %, 6): the 3 % is the parked ship passed 4.5 m away in the first 6 s and one
   trunk for 0.2 s (`whyhid.mjs`), both as on dea95fb (`docs/shots/pilot/m4refix/walkcam-earth.txt`). `spawnout.mjs`: stepping out of the
   ship where the game parks it, the figure in the first and the settled picture at all ten spawns, boom 4.5 to 5.2 m
   (`m4refix/spawnout.txt`; head: no figure at Earth, Saturn, Neptune). `stepout2.mjs -v` (52 assisted landings): boom
   under 4 m at 0, hull over a sixth of the frame at 1 (Venus' acid_terraces, 17 %), mean cover 3.9 %
   (`docs/shots/pilot/m4fix/stepout-after.txt` rewritten from this tree, all 52 lines; the old file predated the
   crown rule). Real game, quality 0, 640 x 360, the verifier's scenes (`s17/out1`, copied to `docs/shots/pilot/m4refix/`: walk-spawn, walk-autumn, stepout-earth-spawn(-settled), stepout-saturn, stepout-neptune, jet-by-ship-up/down, film1-log.txt; all opened): the first walk of a new
   game, W held 24 s from the spawn: figure not drawn in 0 of 720 steps (head 143); stepping out at Earth's spawn
   (`v-out`): 0 of 72 steps without the figure, settled boom 5.2 m, hull 6.9 % of the frame, the explorer in the lower
   middle (head: boom 1.6, tight 0.78, no figure); the jetpack beside the ship up and down (`jet2-up`, `jet2-down`):
   the figure in every frame; Earth's autumn woodland, W held 20 s: 0 of 600 steps (head 142); stepping out after an
   assisted landing at Saturn's and at Neptune's spawn: 0 of 72 steps each, settled boom 5.2 m, figure drawn (head:
   no figure at either). Game errors none, no fall-back. **Still there:** on the jetpack's way down beside the ship
   (`jet2-down` frames 12 to 14, about 0.8 s as the figure passes down through the birches' crown layer) broken leaf
   dabs over the left part of the frame, the figure clear in the middle; on the way up (`jet2-up` frames 3 to 5) the
   same, smaller. With no place a metre clear of every crown there is no lens position that shows no leaves; what is
   left is PAINTER's dissolve within 3.6 m.

2. **PHYSICS 8, the jetpack refills in mid-air; Pluto stayed up for ever** (verifier's regression 5).
   `explorer.js`: the tank refills on the ground or afloat only (`rechargeAirDelay`, `rechargeAirSeconds` and
   `airRecharge` are gone), as PHYSICS' critique offered ("if not, refill only on the ground or in water"). However
   slowly a falling tank refilled, a light world's coast was long enough to pay for the next burn. README's Space
   line says so. Test `M4 burn and coast` (explorer.test) rewritten: Jupiter, Earth, Mars, the Moon, Pluto, five
   strategies each (burn to 0.03 / 0.5 / 0.4 / 0.3 / 0.7, relight under 14 / 8 / 4 m): the tank never rises in the
   air and the explorer comes down; it fails on `51cdda2` (Jupiter: the tank rose in 114 steps). Proof, the
   verifier's `jet2.mjs` on the tree (`docs/shots/pilot/m4refix/jet2-burn-and-coast.txt`): Pluto burn to a half,
   relight under 8 m: down after 36 s (head: never in 1200 s); to 0.4 and 0.3: 39 s and 41 s; to 0.03 under 14 m:
   47 s; the Moon 26 s and 36 s; Earth 8 s; Mars 14 s. Checks on a clean export of `51cdda2` with these files:
   world 22, unit 181, physics 324, `coast.mjs` PASS at both stands, `ghostfield.mjs` all zeros.

3. **PAINTER 3, the target's label on the ship with the nose 3 to 8 degrees off** (verifier's regression 4).
   `src/ui/layout.js slide`: a label that must show and whose four places (under, over, right, left of the ring) all
   touch something is slid on away from the ring in 2 px steps to the nearest clear place, clear of everything first,
   then of the hard keep-outs (the ship) at least; it fell back to under the ring, on the ship. Test (layout.test,
   new): the verifier's frame (640 x 360, ship box x 229-411, y 173-265, the ring 10 px under the middle): the label
   just over the ship, over the ring; the ring anywhere on the ship box: off the ship, inside the picture, off a notice
   that is up; it fails on `1146112` with the verifier's own box (x 261-379, y 205-244). The verifier's random
   `layout.mjs` (`docs/shots/pilot/m4refix/layout-random.txt`, 4000 scenes a size): a label on the ship 459 / 591 /
   683 / 798 -> 0 at all four sizes, a name on another 17 / 15 / 14 / 23 -> 0, off the picture 8 / 2 / 3 / 0 -> 0;
   on a soft slip (the prompt, a notice) about 500 as before (a label that must show may lie on one: by design).
   Not yet seen in the real game (the verifier's `aimoff` scene is to be filmed with the next browser run).
   Checks on a clean export of `1146112` with these files: world 22, unit 182, physics 324, `coast.mjs` PASS at both
   stands, `ghostfield.mjs` all zeros.

4. **A swimmer asked to turn about swam backward for 5.8 s** (verifier's regression 6). `explorer.js swimTurn`: a
   swimmer's body turns through the angle itself at `swimTurnRate` x min(angle, 1) rad/s (eased over the last radian,
   never faster than 3.2 rad/s, no stall facing away); the land's eased blend of the two directions, kept for
   walkers, hardly turns from straight away. Test `M4 the re-fix: a swimmer asked to turn about` (explorer.test;
   fails on `5fd7a0a`: not round in 4 s). The verifier's `swimturn.mjs` (`m4refix/swimturn.txt`): S afloat 6.43 s,
   5.77 s backward -> 0.75 s, 0 s; D 0.27 -> 0.25 s; on land unchanged (1.83 s, as before the round).
5. **The easel's walk carried the explorer over cliffs** (verifier's regression 9). `sim.js easelWay`, `EASEL.steep /
   step / look`: the walk goes along the ground to the spot, or to a metre short of the first dry place steeper than
   40 degrees or the first rise or drop of more than 0.25 m in 0.25 m, and the picture is composed from there (under
   0.6 m: where the explorer stands); and the easel is not offered to an explorer standing on such a face (on
   Neptune's 78 degree face the explorer slides 32 m in 8 s whatever is pressed: `scripts/easeltrace2.mjs`). Test
   `M4 the re-fix: the walk to an easel stops a metre short of a cliff` (vista.test). The verifier's `easel.mjs`
   (`m4refix/easel.txt`): over a face steeper than 40 degrees 6 -> 0 of 288 approaches; no figure in the held picture
   10 -> 5; no offer 13 -> 14 (Jupiter's Lightning Plains from 90: the walker is on a 52 degree face). Not touched:
   the walk still goes through a trunk or a boulder in 8 approaches and into liquid in 8 (not on the list).
6. **The weather and motion films' clocks** moved by PHYSICS' +1530 s (`tests/weather.mjs` SHOTS and comments,
   `tests/motion.mjs` scene storm), exactly as PHYSICS listed. Checked in Node with PHYSICS' `weatherAt` at the spawn
   (`m4refix/weather-clocks.txt`, `scripts/wxclock.mjs`): at the old clocks a breeze everywhere; at the new ones
   earth-before 1650 fair (cloud 0.29), earth-arrives 1696 thunderstorm 6.1 mm/h, earth-storm 1770 22.3 mm/h,
   earth-flash 1774 21.8 mm/h, earth-after 1930 fair, the blizzard at 1720 snow 5.2 mm/h. Not filmed.
   Checks for 4 to 6 on a clean export of `5fd7a0a` with these files: world 22, unit 184, physics 324, `coast.mjs`
   PASS at both stands, `ghostfield.mjs` all zeros.

7. **Seen in the real game: the label off the ship** (item 3). The verifier's `aimoff` scene (quality 0, 640 x 360,
   chase view 5 km over Earth, Mars the target; `docs/shots/pilot/m4refix/aimoff-*.jpg` and `aimoff-log.txt`, opened):
   the nose on Mars, 2, 4 and 7 degrees over it, 5 right, 8 left, 3 under: the label off the ship's box every time
   (nose 4 degrees over: label y 133-172 over the ship's top at 173, the ship whole; the fix round's head had it at
   y 204-243 on the ship). Game errors none.

### Not fixed (and why)

- **The landing's chase camera beside a crown (PHYSICS 4's last part).** Filmed on this tree
  (`m4refix/landfast.jpg`, opened): as in the fix round, frames 20 to 22 (1.5 s of an 11 s landing) a flat crown over
  the left half of the picture as the ship goes down into the clearing. Measured in the real game
  (`m4refix/landdiag-log.txt`, the scene `scripts/landdiag.mjs`; rays from the lens through the cameras' crown model):
  the lens keeps its margin (1.44 m from the nearest crown) but that crown, 3.6 to 8 m ahead-left, covers 29 to 45 %
  of the picture from 11 m over the ground to 3 m. Tried and taken out again (the tree is as committed):
  (a) a clear line of sight to the ship: no effect, the crown is beside the line; (b) a larger margin in a landing
  (`landMargin` 2 to 5 m): in Node 45 -> 18 % at 2.5 m, in the real game no change at all (the boom target keeps a
  lens that has half the margin: 1.44 > 1.25), film identical; (c) the middle of the picture kept clear of crowns
  over the whole way down: no crown in the picture at all, but the boom comes in to its shortest (5.5 m) from 30 m
  up and the hull lies over the lower third of the picture for the whole landing
  (`m4refix/landfast-tried-picture-rule.jpg`, opened): a worse picture for a landscape painting than 1.5 s of a
  crown; (d) the same over the last 12 m only: the boom dollies in through the leaves at touchdown (Node: lens 0.78 m
  from a crown, 35 % of the picture within 3.6 m). What would serve: in a landing among trees, raise the lens over
  the crown tops and look down into the clearing (a new move of the chase camera; not attempted in this pass).
- **Assisted landings take about twice as long** (the verifier's regression 7: median 9.9 s for 4.7 s, 27.6 s at
  Jupiter's spawn): by design of the fix round (no 18 g stop, 6 m/s down near the ground); a known cost, unchanged.
- **The jetpack's way down through the crown layer** (item 1, still there): leaf dabs over the left of the frame for
  about 0.8 s, the figure clear.
- **Node walkcam, autumn woodland 3 %** (item 1): the parked ship passed at 4.5 m in the first 6 s and one trunk for
  0.2 s squeeze the boom into the eyes, as on `dea95fb` and every round before (the hull and trunk spheres, not the
  crown rule); in the real game's autumn walk 0 of 600 steps.
- **The easel's walk through a trunk or a boulder (8 of 288) and into liquid (8)**: not on this pass's list.

### State of the tree and checks

My commits in this pass: `51cdda2` (item 1, completes the snapshot `6e550ce`), `1146112` (item 2), `5fd7a0a`
(item 3), `246fce6` (items 4 to 6), and the one with this hand-over (notes and evidence only). Each code commit was
checked on a clean export of its parent with its files: world 22, unit 181 -> 182 -> 184 (three new tests, one
rewritten), physics 324, `coast.mjs` PASS at both stands, `ghostfield.mjs` all zeros. The game was played at
quality 0 in four browser runs on those trees (`s17/film1.log` .. `film5.log`): `game errors: []`, no problem,
`__pc.info().fallback` empty. Not done in this pass: the top tier (quality 2, 960 x 540), the painted play-through,
`tests/weather.mjs` and `tests/motion.mjs` themselves (their clocks were moved and checked in Node only).

## Hand-over, M4 fix round (fourteenth PILOT agent, the successor; started 05:11 UTC 2026-11-13; kept current after every item)

Read this first. The thirteenth agent was cut off at 05:08 UTC (container restart); its finished commit is `dea95fb`
(the figure's state, below), its half-done work was in the coordinator's snapshots `8418918` and `c03bce6`. I checked that
work, kept all of it (each change is proven below), and went on down the list. Scratch: `/home/user/.pc-scratch/pilot/m4/`
(`scripts/` the thirteenth's instruments: `shipfeel.mjs`, `survey.mjs`, `stepout.mjs`, `film.mjs`, `checks.sh`, `mktree.sh`;
`s14/` mine: `scenes.mjs` extra film scenes, `stepout2.mjs`, `clockdbg.mjs`, logs, `t0` a clean export of `21aa969`).
One browser at a time; a quality-0 film of 30 frames takes 3 to 4 minutes here with three roles rendering.

**State of the tree at `21aa969` (the snapshots, before my first commit), measured on a clean export:** unit 164, world 19,
physics 314, `coast.mjs` PASS at both stands, `ghostfield.mjs` all zeros; the game loads at quality 0 with no console
error and no fall-back (the film run `s14/film-a.log`: `game errors: [] problems: none`).

### Done, with proof

1. **PHYSICS 1, the 16 m jump at the end of a lift-off under trees** (`src/ship/flight.js`: the lift-off ends where free
   flight can take over, `liftoffClear` 3 m over the floor free flight uses, rising at `liftoffRise` 8 m/s; the clearance
   clamp never sets the hull on the crowns, only solid ground and liquid are hard). Proof: `shipfeel.mjs` in Node on the
   real Earth spawn, largest move of the hull beyond its own velocity 16.25 m -> 0.00 m, free flight after 5.9 s at
   25.8 m; tests `M4 lift-off under a canopy (no PHYSICS)` (flight.test) and `M4 lift-off under trees` (physics.test),
   both fail on `dea95fb` (15.60 m and 16.05 m in one step); filmed in the real game, `docs/shots/pilot/m4fix/liftoff.jpg`
   (20 frames 0.5 s apart from the first lift-off of a new game: one continuous rise through the birches; opened).
2. **PHYSICS 2, the landing assist** (`flight.js stepLanding`: the hull goes to the glide and the descent from its own
   velocity at no more than `landAccel` 8 m/s^2 level and `landAccelDown` 5 m/s^2 down, descent 6 m/s near the ground
   and 9 from high up (it was 13), a glide that can stop at the site; `sim.js`: E faster than `LAND_BEGIN_SPEED` 12 m/s
   first slows the ship with its own brakes, "Slowing down to land", Space or W lets it go; `state.js` the prompt).
   The prompt "Land here" is still offered at speed, on purpose: E always does something, and says what. Proof:
   `shipfeel.mjs`: E at 46 m/s largest change of velocity in one step 3.10 -> 0.23 m/s (18.9 g -> 1.4 g), descent
   12.98 -> 6.00 m/s; E at a hover 1.20 -> under 0.35 m/s; tests `M4 the landing assist changes the hull's velocity no
   faster than its thrusters can`, `M4 E at full speed`, `M4 E at a hover, and a landing abandoned among the trees` (all
   fail on `dea95fb`); filmed, `docs/shots/pilot/m4fix/landfast.jpg` with `landfast.json` (E at 46 m/s over the wood: 2.5 s
   of slowing, a 12 m glide, down at 6 to 7.7 m/s, touch at 1.1 m/s, 11 s in all; opened).
3. **PHYSICS 3, the ground assist** (`flight.js groundAssist / shapeTarget / boundAssist`: the look reaches as far as the
   hull needs to stop in, 143 m at 46 m/s where it was 37; a slope it cannot climb at this speed slows it, `vhCap`; what
   the assist adds to the hull's vertical speed in one step is bounded by its lift, `assistLift` 14 m/s^2 beyond the
   weight, more only in the last two metres and for a dive that could not otherwise be stopped above the ground;
   `camera.js`: the chase camera rides behind the hull's motion, `shipFollow / shipSettle / shipSlack`). Proof:
   `shipfeel.mjs` low flight nose down, largest step 8.55 -> 0.40 m/s, the 73.97 m/s climb -> 22.7 m/s; `survey.mjs`
   (careless low flight on all ten bodies, 80 s each, and a dive from 400 m): largest step 138.5 -> 1.76 m/s, bounces
   5 -> 0 in low flight; tests `M4 a steep slope at full throttle` and `M4 the chase camera rides behind the hull's
   motion` (fail on `dea95fb`); filmed, `docs/shots/pilot/m4fix/low.jpg`. Cost of the longer look: 0.45 -> 0.50 ms a step on
   Earth (`cost-flight.mjs`). **Known, left:** Pluto's dive (60 degrees down at full throttle from 400 m into a 55 to 61
   degree face at 73 m/s) ends in one soft bounce (before: a 72.6 m/s rewrite of the velocity in one frame, no bounce).
   Neptune's squall still throws a hovering ship (4 g steps: PHYSICS' wind, PILOT's critique of PHYSICS item 4).
4. **PHYSICS 4, the landing's chase camera in the wood, filmed** (`landfast.jpg`, frames 18 to 23: the lens is in no
   crown; a crown stands close on the left of the frame for about 1.5 s on the way down into the clearing).
5. **The landing site** (`flight.js findLandingSite`, `landFootprint` 4.5 m: the ground under all of the hull): test `M4
   the landing assist does not choose a shelf at the lip of a wall` (fails on `dea95fb`: 3.0 m from a 67 degree wall).

6. **PAINTER 1, stepping out** (`sim.js`: `exitSpot` walks the explorer up to 3.4 m clear of the ladder during the
   transition, `exitView` chooses the view for the picture by what the hull covers in the frame (`hullCover`: its
   spheres projected), never between lens and figure, never over a sixth of the frame, boom free, open ground ahead;
   `FEEL.exitSeconds` 0.95 -> 1.6; `view()` turns the blended camera onto the explorer through the middle of the move;
   `shipInPicture()` and `game.js updateSketches`: a page waits up to `SKETCH_SLIP.shipWait` 30 s while the hull lies in
   the middle of the frame within 14 m of the ship). Proof: `stepout2.mjs` in Node, the ship landed by the assist at
   every spawn and stand of the ten bodies (52 landings): hull over a sixth of the frame at 52 -> 1 (Venus'
   acid_terraces, 17 %: the terrace lets the explorer walk only one metre), between lens and figure 50 -> 0, mean cover
   34.4 % -> 3.9 % (`docs/shots/pilot/m4fix/stepout-before.txt`, `stepout-after.txt`); test `M4 stepping out` (loop.test;
   fails on `dea95fb`); frames from the real game, opened: `m4fix/stepout-mars-before.jpg` (the wing, the nacelle and
   the canopy over the lower right third, "Board ship" on the wing) against `stepout-mars-after.jpg` and the strips
   `stepout-mars-strip-after.jpg`, `stepout-wood-strip-after.jpg`; the book's Mars page: `book-mars-before.jpg` (the wing)
   against `book-mars-after.jpg` (the dry riverbed's trees).
7. **PAINTER 3, the slips** (`src/ui/layout.js`, new and pure: `layoutMarks` places every marker's label off the ship,
   off the slips that are up and off each other, the target first and then from the nose outward, a world with no room
   for its name keeps its ring; `wrapLettering`; `hud.js setMarks(list, view)`, `setNotice`, `setHint`, `showSketch` wrap
   to the window and the slip; `game.js`: the ship's screen box as a keep-out in the chase view, the figure's on foot,
   an edge arrow's lower half rides at 0.69 of the height (`edgeY`), over the notice, prompt and gauges; `theme.css`: on
   foot the notice lies at the top, not across the legs; the title card names the backquote key as a word). Proof:
   `tests/layout.test.mjs` (four tests); frames opened: PAINTER's own before frames
   (`docs/shots/painter/critique/pilot-20-aimed-label-over-ship.jpg`, `pilot-22`), against
   `m4fix/aim-aimed-after.jpg` (aimed at Mars: the label over the ring, the ship whole, Uranus named beside),
   `aim-long-notice-640.jpg` (the long notice in two lines inside a 640 px window; still crowded there: the read-out
   touches the prompt at that size).
8. **PAINTER 5, the clock** (`sim.js CLOCK, clockRate, stepClock`; `orbits.js turnBy, spinRate`: the world under the player
   turns at 0.4 of its rate while the sun is within 8 degrees of the horizon where they stand, three times as fast
   under 16 degrees below it, eased between and eased back to the body's own turning with height, 0.2 to 0.6 of the way
   to space, so a ship leaves a world that turns as the ephemeris says; a locked Moon's orbit turns with it; a new game
   starts at 8 h, `FEEL.startHour`). Proof: `tests/clock.test.mjs` (four); `clockdbg.mjs` at the real Earth spawn: the
   first sunset 8.8 -> 11.2 minutes in (7.4 with the old 9.5 h start), the sun under 8 degrees below the horizon
   14.8 -> 5.6 minutes of a day, the gold (12 to 0 degrees) 1.4 -> 3.8 minutes, the blue hour (0 to -8) 0.9 -> 2.7, the
   day (sun over 12 degrees) unchanged at 9.5 (`m4fix/clock-earth-spawn.txt`). In the real game, opened:
   `m4fix/dusk-strip-after.jpg` with `dusk-strip-after.json` (the spawn from 16.6 h, a frame every 25 s of play, the
   frames between simulated and not drawn): the sun at 12 degrees 35 s in, on the horizon at 260 s, 8.8 degrees
   under it at 435 s; from the last ochre (frame 14) to the night's blue (frame 17) 75 s and more, where PAINTER's
   sheet `docs/shots/painter/critique/pilot-35-dusk-sheet.jpg` has it in 35 s. (A storm of PHYSICS' own clock crosses
   the strip from 150 to 275 s.) The first frame of a new game at 8 h: `m4fix/first-frame-after-click.jpg`.
9. **PAINTER 4, a view is a picture** (`sim.js`: `vistaMark` the nearest view not yet drawn within `VISTA_MARK` 150 m,
   `easelOffer`, `beginEasel`, `stepEasel`, `EASEL`: found by walking up to it as before, then offered, "E Stand at the
   easel": the explorer walks to the easel's spot at 3.4 m/s while the view comes round to the heading and pitch the
   world gives for it (`getVistas` yaw, pitch), third person at the usual boom; held 1.8 s or until the page is drawn;
   then the controls are the player's. `game.js`: the page of a view is drawn only there (a view found and not stood
   at stays "seen, not yet drawn" in the book and keeps its mark); the mark on foot, "a view" with its distance, a ring
   or an edge arrow. `state.js` the prompt. Proof: `tests/vista.test.mjs` (three); frames opened: `m4fix/vista-mark.jpg`
   (55 m from Earth's first view: ring and label over the figure's head), `vista-easel-strip.jpg` (E: the walk along
   the stream and the view coming round, 12 frames a third of a second apart), `vista-after.jpg` (the composed
   picture, the new page's slip). `tests/m3check.mjs` now presses E at the found view (not yet re-run: see below).
10. **PAINTER 2, the sketchbook** (`sketches.js sketchHand`: the kept frame is redrawn as a sketch on its own pixels:
    three flat washes from the frame's own range of tone, most of the way to sepia and graphite, a pencil line on
    edges, lifted to white at a ragged edge, no rectangle; 256 x 144; `game.js captureSketch`: the figure is out of the
    kept frame (painted once more without it, kept, painted again: no gap on screen); `book.js`, `theme.css`: a page
    shows what has been drawn, large while it is little (420 px for one, 120 px for thirteen and more), no empty
    boxes, no names of what is not found, no fractions on the tabs, one pencilled line for what is left ("five more
    landscapes and seven more views on Earth"), the tally at the foot; the sheet has one size on every page). Proof:
    test `M4 a kept frame is drawn as a sketch` (sketches.test); `m4fix/sketch-hand-preview.jpg` (four real frames and
    their sketches on paper, offline; opened); frames opened: `book-mars-after.jpg`, `book-earth-after.jpg`,
    `slip-after.jpg`. PAINTER offered the treatment: its numbers are `SKETCH_HAND` (see "For PAINTER" below).
11. **PHYSICS 4, the foot camera among trees** (`camera.js footBoomAmongCrowns`, `sim.js footCrowns`: the boom is cut
    short of a crown, the lens keeps a metre from crowns and trunks). Proof: `tests/footcam.test.mjs` (two): on the
    jetpack in a glade ringed by 22 m birches the lens came 2.45 m inside a crown, now never nearer than 0.15 m
    outside. Filmed in the real game, opened: from the spawn's glade up and down, no frame with a crown at the lens
    (`m4fix/jet-glade-up-after.jpg`, `jet-glade-down-after.jpg`); from beside the ship under the birches, where
    PAINTER and PHYSICS filmed the slabs (`docs/shots/painter/critique/pilot-05-jetpack-sheet.jpg`: jet0, jet1, fall6,
    fall7, landed, leaf slabs over half the frame and more, across the figure): `jet-by-ship-up-after.jpg`,
    `jet-by-ship-down-after.jpg`: the figure is in sight in every frame; **still there**: while the figure itself
    passes through the crown layer, leaf masses stand over the left third of the frame for one or two frames a third
    of a second apart (up: frame 3; down: frames 13 to 15). With the head in a crown the boom is left alone: there is
    no view of that from outside. What a crown looks like from inside is PAINTER's (its item "crowns at the lens").
12. **PHYSICS 5, a swimmer's controls and camera** (`explorer.js`: Space does not hop a swimmer, held it lights the
    jetpack; a swimmer turns at `swimTurnRate` 3.2 /s, not 11; `camera.js swimLift`: the view rides 0.6 m higher over a
    swimmer, eased). Proof: test `M4 afloat` (explorer.test; fails on `dea95fb`: a 4.5 m/s hop). In the real game off
    Earth's sea coast, opened: `m4fix/swim-after.jpg`, `swim-turn-strip-after.jpg` (the swimmer low in the middle of
    the frame, the view over them and the sea all round; a tap of Space: 0.39 m/s, no hop; held: lifted out).
13. **PHYSICS 8, the jetpack refilling in the air** (`explorer.js airRecharge`: a tank takes 10 s to refill in the air
    on Earth, as before, and as much longer on a lighter world as its gravity is less). Proof: test `M4 burn and coast`
    (fails on `dea95fb`: on the Moon the explorer never comes down); README says so.
14. **PAINTER 8 / PHYSICS 7, boarding** (`sim.js beginBoarding`: the walk to the hatch at 3.6 m/s, 1.5 to 3 s, where it
    was 1.25 s from anywhere; the view is turned onto the explorer through the middle of the move, as in stepping out).

15. **PAINTER 6, the slips at night and in space** (`theme.css --pc-key`, `game.js updateHud`: the slips' paper is
    multiplied by a key, white by day, toward (158, 173, 219) at night by the world's hour and out in space; the map,
    the book and the card stay paper). Measured in the real game by the ship at the spawn: the prompt's paper
    (238, 231, 225) by day, (147, 160, 194) at 23 h, against a night picture of about (88, 105, 132) beside it
    (`m4fix/slip-day.jpg`, `slip-night.jpg`; opened). Lettering straight on the wash in space: not done.
16. **PAINTER 15, the place's name** (`game.js updateHud`): named for six seconds when the game begins (the click),
    on a new world and on stepping out; not on sitting down in the ship.
17. **PAINTER 7, the title card** (`hud.js`, `theme.css .pc-title-only`): until the game begins the card is the title
    alone, small, in the upper third: the name, the line under it, "click to begin", and two short lines of the keys
    a newcomer needs; the list of keys is the same card, whole, on H. Opened: `m4fix/title-after.jpg`,
    `help-card.jpg` (640 x 360: there the title slip is half the frame; at 1280 x 720 it is a third of the width).
18. **PILOT 12's own-side 5**: `tests/browser.mjs startRun` gives the game thirty minutes to load, not five.
19. **PAINTER 9, the cockpit's slips** (`theme.css .pc-cockpit`): the prompt and the notice are tucked onto the cowl
    (11 % and 20 % from the foot; they lay on the horizon at 39 % and 47 %). Opened: `m4fix/cockpit-before.jpg`
    against `cockpit-after.jpg` (in flight, a two-line notice and "Land here": the glass is clear) and
    `cockpit-landed-after.jpg`. **The eye point was tried and put back**: 0.25 m up and 0.3 m ahead takes the cowl
    out of the frame but brings the canopy's hoop across the upper third of the glass as a thick bar
    (`m4fix/cockpit-eye-tried.jpg`). `CAMERA.cockpitEye` (zero now) is the number to set once the hoop is redrawn.
20. **Seen at the top tier, 960 x 540** (quality 2, the long legs simulated and not drawn): `m4fix/title-top-tier.jpg`,
    `first-frame-top-tier.jpg` (8 h, the place named), `vista-offer-top-tier.jpg` (the notice at the top, the first
    page's slip in the corner, the mark, the prompt under the feet), `vista-easel-top-tier.jpg` (the composed
    picture), `stepout-mars-top-tier.jpg` (the plain and its trees, the explorer in the lower third, a wing tip at
    the left edge). That run showed one thing about instruments: a sketch captured while `painter.render` is
    swapped for a stand-in is an empty canvas (a brown blot on the page). The game never does that, but
    `sketchHand` now refuses a frame with nothing in it and the page is wanted again (test in sketches.test).
21. **No widow in a wrapped line** (`layout.js wrapLettering`): "A view for the sketchbook: / Temperate Forest".
22. **The figure's shade is out of the sketch too** (`game.js repaint`): the kept frame is painted through the world
    again (`world.update(0, ...)`, then the painter), so PAINTER's cast shade is laid for what can be seen; the hidden
    figure used to leave its shade on the ground, a dark smear in the middle of the page on a pale plain
    (`m4fix/book-mars-with-shade.jpg`, `book-mars-top-tier-with-shade.jpg` against `book-mars-after.jpg`; opened; the
    figure and its shade are back in the frame the player sees, `slip-after.jpg`).
23. **A view whose page could not be drawn while it was held** (the book opened over it) is offered again
    (`sim.js stepEasel`; test in vista.test).

### State of the tree

My commits, in order: `b289c21` (on `70aec16`; the body of the round), `7ee3620` (notes), `f7b757a` (the dusk and the
swimmer filmed, the browser helper's load limit), `52e74d1` (the cockpit's slips, the sketch's guard, the wrap, the
top-tier frames), `6cfab48` (the shade out of the sketch, the easel offered again), `da9a49f` (the browser tests
follow "slowing down to land"; the hand-over), and the one that carries this sentence (notes only). The
thirteenth's flight work came in with the coordinator's snapshots `8418918` and `c03bce6`; a third snapshot,
`e371a93` (07:00 UTC), swept two of my files while I worked: the easel offered again in `src/core/sim.js` and its
test in `tests/vista.test.mjs`, which `6cfab48` describes and completes.

Measured on a clean export of `e371a93` with PILOT's files of `6cfab48` (`s14/t11`): **unit 181, world 20,
physics 314**, `coast.mjs` PASS at both stands, `ghostfield.mjs` every counter zero (worst step loss 0.26 and 0.52
as before); the game loads at quality 0 with no console error and no fall-back (the film runs on that tree). The
last commit changes three browser tests only; on a clean export of `141997f` with it (`s14/t12`): unit 181, world 20.
In the browser on the stubs, on those last files, all PASSED: `tests/m3check.mjs` (title card, sketch, book, the
view found, offered, drawn from its easel, the controls given back, save and reload), `tests/playthrough.mjs` with
PHYSICS (walk, jetpack, board, space, land, step out), `tests/trip.mjs` (Earth, Mars, Saturn in one sitting,
reload). (`playthrough.mjs` asked for the landing assist 0.3 s after E; with E at speed the ship now slows first,
so it failed once on that line at `6cfab48`; it, `trip.mjs` and `grandtour.mjs` now wait for the slowing.)
**Never run in this round:** the painted play-through, trip and m3 (`tests/all.mjs` painted-*), the grand tour
(its landing step is changed and has not been run), the motion and weather sets, anything at 1080p.

### Not done (and why), for whoever comes next

- **The cockpit's eye point** (PAINTER 9: tried, put back, see 19), **the ship rolled on arrival** (PAINTER 12), **the
  map as ten dots** (13), **the cursor** (14), **the frame read-out's type** (16): not done; none is a FIX FOR SHIP.
- **The sky's change at the edge of the air** (PAINTER 17: blue at 490 m, starred indigo at 640 m): not PILOT's number.
  `mood.inSpace01` is `smoothstep(0.75, 1.6)` of the way to space: on Earth 0 at 600 m and 0.003 at 640 m. Whatever
  turns the sky between 490 and 640 m reads the height itself (`altitude01`, or the world's own eye height).
- **Mercury's spawn, heading 0** (the coordinator's relay: `collideObstacles` stops a run dead on a 2.2 m column,
  7.40 -> 0.79 m/s in one frame): not touched in this round.
- **The eleventh agent's Node instruments** (`docs/lead/evidence/pilot11/`) still seed PHYSICS with 1 and leave its
  time budget on; the thirteenth's and mine (`m4fix/scripts/`) make PHYSICS with `timeBudget: false` and no seed.
- **Hard turns at 6.5 g** (PHYSICS 9) and **the 2.2 g kick-off** (PHYSICS 10): left. Both are the feel of the arcade
  ship that every flight test and the tour were tuned on; changing `carve01` or `tauAtmo` in the last round would
  need the whole flight survey again.
- **Venus' acid_terraces step-out** (17 % of the frame is hull) and **Pluto's 60 degree dive** (one soft bounce).
- **A small window (640 x 360)**: the notice is wrapped, but the read-out, the prompt and a two-line notice touch.

### For PAINTER (from this round)

- **The sketch's hand** is `src/core/sketches.js` `SKETCH_HAND` (keep, washes, soft, lift, gamma, broad, pencil,
  pencilFrom, edge, rag) and the three inks `INK_DARK`, `INK_MID`, `PENCIL` there. It is PILOT's file; say what the
  numbers should be, or what else the hand should do, and PILOT sets them. The page multiplies the sketch onto its
  paper (`theme.css .pc-sketch-frame img`, `.pc-newsketch img`: `mix-blend-mode: multiply`).
- **Views**: PILOT now shows a mark within 150 m and takes the explorer to the easel on E, with `yaw` and `pitch` from
  `getVistas`. Second sites (`... II`) give no yaw: the view keeps the player's heading there. PAINTER's half of item 4
  is still open: a painted easel or cairn at each view, and a first view within 150 m of each spawn (Earth's is
  2418 m from its spawn, so a new player still meets no mark in a first sitting).
- **The first hour is 8 h now** (it was 9.5): the first view is lit by a lower sun.
- **The cockpit**: with the hoop as it is the eye cannot go forward (item 19 above). When the hoop is lighter or
  further out, name the eye point (metres up and ahead of the seat) and PILOT sets `CAMERA.cockpitEye`.
- **The clock**: dusk and dawn now last about five minutes each at Earth's spawn; the night about five and a half.
  **For every instrument that sets an hour and lets the clock run** (`tests/tour.mjs`, `weather.mjs`, PAINTER's and
  PHYSICS' harnesses): at night the world now turns three times as fast, so a held "22 h" drifts three times as far
  while the frames settle (at dusk and dawn it drifts less than half as far as before). Add `clock=even` to the
  query, or set `window.__pc.sim.unevenClock = false`, and every world turns evenly as before.

## For PAINTER (M4): the figure's state, as `animate(state, dt)` now receives it

Thirteenth PILOT agent (the M4 fixer), 2026-11-13. `src/player/figure.js` `figureArgs` passes PHYSICS' body state
(`docs/notes/physics.md`, "For PILOT and PAINTER: the figure's state, M4") to `explorerModel.animate(state, dt)` on
every frame on foot. **Everything is already in the figure's own axes** (forward = the way the figure faces, the
model's -Z; right = its right hand, +X; up = +Y): no world vectors, no projection on your side. All are plain finite
numbers, 0 when there is nothing to say. The old fields (mode, speed, jet01, lookPitch, hip, ride, clamber01, grounded,
stride, footDown, feet, surge, crouch01, gait) are unchanged.

| read | unit | what it is |
|---|---|---|
| `state.leanFwd` | rad | the lean into the wind, forward part: + tips the TOP of the body forward (toward -Z). A run in still air: about +0.03. |
| `state.leanRight` | rad | its sideways part: + tips the top of the body to the figure's right (+X). Neptune's squall: 0.40 to 0.57 rad in all. |
| `state.lean` | rad | its size, `hypot(leanFwd, leanRight)`. |
| `state.hunker01` | 0..1 | 0 upright .. 1 down on hands and knees in a gale (deeper than `hip` folds; `ride` already carries the fold). |
| `state.windFwd`, `state.windRight`, `state.windUp` | m/s | the air's velocity PAST the body (the wind less the body's own motion): cloth streams ALONG it. A run in still air is `windFwd` about -7.4 (the air goes backward past the runner); a wind from the figure's left is `windRight` positive. |
| `state.windSpeed` | m/s | its length. |
| `state.windLoad01` | 0..1 | its load on cloth: the square of the speed by the air's density, 1 = flat out (15 m/s in Earth's air; Mars' thin air hardly lifts a scarf at 20 m/s). |
| `state.gust01` | 0..1 | the gust of the moment (for the flap). 0 without PHYSICS. |
| `state.windBrace` | N | the suit's thrusters bracing against the wind (0..1700), if you draw them lit. |
| `state.mode === 'swim'` | | afloat and swimming (new mode; see the handshake below). `'wade'` is now only feet on the bed in liquid over the ankles. |
| `state.swim` | 0 or 1 | the same as a number: 1 afloat (feet off the bottom, a third of the body under). |
| `state.stroke` | 0..1 | the phase of the arms' cycle: drive the stroke from it (it never jumps; it keeps turning slowly while treading water). |
| `state.strokeRate` | 1/s | cycles a second: 0.625 treading water, about 1.1 at the swim's 2 m/s; 0 when not swimming. |
| `state.swimSpeed` | m/s | the pace made through the liquid. |
| `state.submerged01` | 0..1 | the share of the body under the liquid (0.69 floating: the waterline is at the chest; the figure's origin, its feet, is 1.25 m under the surface). |
| `state.arc` | 1, -1, 0 | 1 rising in the air, -1 falling, 0 on the ground or afloat. |
| `state.vUp` | m/s | vertical speed, + up. |
| `state.airTime` | s | since the feet left the ground into the air; 0 on the ground and afloat. |
| `state.altitude` | m | the feet over the solid ground (the last metre before a landing). |
| `state.wall` | 0, 1, 2 | 1 held at a wall's foot (hands on the rock), 2 riding up one on momentum. |
| `state.slip01` | 0..1 | sliding back. |

**The one handshake: `swims`.** Until your model has a swimmer, a `'swim'` mode would show as `'idle'` (a statue
gliding), so `src/core/game.js` hands a model that does not say it swims the `'wade'` it knows (with `state.swim` 1
beside it, exactly today's picture). When `animate` draws `'swim'`, return `{ object3D, animate, swims: true }` from
`createExplorer` and the mode arrives as `'swim'`. Nothing else to wire.

PHYSICS' suggestions for the pose (its critique, PAINTER items 1, 2, 5): tip the torso by `leanFwd` about the figure's
right axis and by `leanRight` about its forward axis; stream the scarf and flare the coat along (`windFwd`,
`windRight`, `windUp`) by `windLoad01`; crouch with `hunker01` beyond what `hip` gives; in `'swim'` lay the body near
level, waterline at the shoulders, and drive the arms from `stroke`; pose the air by `arc` (rising: arms in, legs
trailing; the present fall pose only when `arc` is -1 and `airTime` > 1 or `vUp` < -8).

Tests: `tests/figure.test.mjs`, the four that begin "M4" (the axes, a run's own wind and lean, the arc of a jump,
swim against wade, no NaN).

## Coordinator's relay for the M4 fixer (2026-11-13; read with the hand-over below)

PHYSICS 24 finished block P26 (commits `ee39533`, `a70d668`; hand-over at the top of `docs/notes/physics.md`, and
"For PILOT P26" there). For PILOT:

- **The cliff run is fixed** (the coordinator's own run of `docs/lead/evidence/pilot11/wallrun.mjs` on a clean export
  of `526883f`: Earth sea_coast 0.2 / 0.2 / 0.2 m where the head climbed 49-50 m; desert_canyon 1.1 / 0.2 m; Neptune
  storm_seas still drifts 5.9 m along a 53-58 degree face).
- **The figure's state** is documented in one place: `docs/notes/physics.md`, "For PILOT and PAINTER: the figure's
  state, M4". New, output only: `leanV`, `relWind`, `relWindSpeed`, `swim`, `stroke`, `strokeRate`, `swimSpeed`, `vUp`,
  `airTime`, `arc`; from the wall fix: `wall` (1 held at a wall's foot, 2 riding up on momentum), `paceWall`. PHYSICS
  asks for a `'swim'` mode on the model driven by `phys.swim` and `phys.stroke`.
- **Mercury's spawn, heading 0 (the check to 1.58 m/s)** is not PHYSICS': `collideObstacles` hits a 2.2 m column
  head-on, 7.40 -> 0.79 m/s in one frame with `phys.brace` 0. Steer round columns before the hit, or hand the columns
  to PHYSICS' way ahead.
- **Instruments:** make PHYSICS with `timeBudget: false` in `wallrun.mjs`, `runfield.mjs` and the like; with the budget
  on, a run that enters the water does not repeat to the digit (up to 0.38 m/s apart from the first wet step).

## Handover (read this first if you are a fresh PILOT)

**Twelfth agent, 2026-11-13, the M4 critic (read this first; the coordinator's relay above and the
tenth's hand-over below still hold).** Block: M4's critique swap, PILOT's side, as critic only (no
code). Result: `docs/lead/CRITIQUE.md`, whole: "PILOT on PAINTER" (14 items and a list of every
beat a new player meets with its frames), "PILOT on PHYSICS" (8 items: the eleventh's three kept,
five new), "Not verified", "PILOT's own side". Evidence: `docs/lead/evidence/pilot12/` (the top-tier
tour of all ten bodies in `tour/`: five by the eleventh agent on `8809fff`, five by me on a clean
export of `ca0b3db`; `look-top/` 18 top-tier frames; `look-q0/` and `play/`, `play-lowfly/`,
`play-cliff-fixed/` at quality 0 with their traces; the Node instruments with their output;
`tone.py` and `tones.txt`). Every frame named in the critique was opened. Commits: `90bb703`,
`cf7711c` (interims) and the one that carries this paragraph. The eleventh agent left no hand-over:
its commits are `b0e9aba` (the landing chase camera keeps out of crowns, `crownDistance`,
`shipBoomTarget`, `crownSolid`) and `904b6fe` (light worlds: the suit stops a run once the keys are
let go, `EXPLORER.assistStopMin`), and the first three items on PHYSICS.
**FIX FOR SHIP, PAINTER**: (1) night is the day under a dark blue veil (80 % of the frame within 7
steps of L* at the top tier), and it is more than half of a first half hour; (2) the first
thunderstorm is as dark as midnight with no rain to be seen, and the mist after it is the same
sheet; (3) Earth and Pluto are potatoes from orbit, Neptune a glass marble; (4) Jupiter's arrival is
a green Earth meadow under its sky; (5) Uranus' and Pluto's first views are one pale value with
confetti. **FIX FOR SHIP, PHYSICS**: (1) the cliff run: closed on Earth by `ee39533` (0.2 m where it
was 50; 0.7 m in the game), a 4 to 6 m scramble left at Neptune's storm coast; (2) rain stops a walk
dead on a 23 to 26 degree forest bank from 170 s to past 700 s of every new game (in the game: 2.5 s
at 0.04 m/s with W held, then 4.3 m/s up 33 wet degrees); (3) the run checked at rims (the
eleventh's); (4) Neptune's storm coast throws a hovering ship 107 to 186 m with 5 to 12 g while
Earth's storm does not move it; (5) the first storm comes at 140 s and the wood is in mist from 390
to 1440 s. Items 2, 4 and the swim were re-run in Node after PHYSICS' P26: unchanged.
**Next PILOT (the fix round)**, beside PHYSICS' and PAINTER's critiques of PILOT: the own-side list
at the end of `CRITIQUE.md`: (1) a new game's day: sunset at 7.5 minutes, sunrise at 24 (the day is
25 minutes and starts at 9:30): settle the first day with PHYSICS' first storm; (2) the title card
covers 58 % of the first frame with twenty key caps; (3) the boom collapses at Jupiter's Cream
Sky-Islands (0.2 m) and Uranus' Frozen-Wave Forest II (0.3 m), `pilot12/vistaframe.mjs`; (5)
`tests/browser.mjs` `startRun` gives the game five minutes to load and the top tier took nine and a
half here: give it thirty, as `tour.mjs` has; (8) the HUD's tags (#FFFBEF) are whiter than the paper
(#F4EFE4); (4) the Node instruments: no `seed: 1` (it is another weather than the game's) and
`timeBudget: false`.
**Cost me time**: one browser at a time and two other roles rendering: a top-tier load took 9.5
minutes and a frame 3 to 10 s, a quality-0 frame up to 5 s; `startRun`'s five minutes killed my
first top-tier run (my scripts' `--long 1` waits thirty); the tour's held fair weather shows
Neptune's storm coast as a pale calm the game never has (do not judge that coast from the tour);
`game.showStats = true` puts a read-out panel on every frame (my `look-q0/` frames carry it); a ship
teleported with throttle flies away while the world settles (hover, throttle 0, for a frame at a
height). My scripts: `pilot12/look.mjs` (the look in a new player's order; `--lite 1 --card 0 --long
1 --only foot,hours,storm,climb,sea,gale,ship` is the top-tier set) and `pilot12/play12.mjs` (the
play at quality 0 with traces). Scratch: `/home/user/.pc-scratch/pilot/m4/`.

**Tenth agent, 2026-11-12 (read this first; the ninth's and older below still hold for the code and
the commands).** Block: review 6's second half on the art-pass head, so milestone 3 can close. Result:
`docs/lead/REVIEW.md`, "Review 6 (second half)" (top), with **the M3 verdict: can close** (no MUST
FIX open), and TRACK (risk 11). Ran, one browser at a time, on a clean tree (PAINTER and PHYSICS as of
`5efc7f4`, PILOT `9c93e77`): `node tests/all.mjs` ALL 13 PASSED (54 min; the stub guard's first browser
run: every painted step real); the grand tour on `5efc7f4` PASSED 8 of 8 (39 min); the top-tier tour
of all ten bodies (`--first 1`; 30 frames settled, no console error; 8 of 10 arrivals pass); the
motion set (9 scenes) and the weather set; the tier-1 coverage tour last (REVIEW says how far it got).
Mine: `9c93e77` (ARTPASS wish 12: the hour is the world's clock, `Ephemeris.sunHour/setSunHour`;
Saturn's ring framed from orbit in `tour.mjs`; the world's own arrival steps off a boulder,
`clearArrival/clearView`; all.mjs time limits), `a0e3fb1` (the coordinator's P20 rulings: a landed
ship floats on the drawn sea, `stepAfloat`; the swim camera smoothed; boulderrun's classification),
`dc876f9` (Neptune's tilt -0.49, PAINTER agreed; ship berths out of the surf, `surfAt`), `a46b6ee`
(the coordinator's snapshot of my camera fix: the feet stay in the frame under a rise,
`CAMERA.feetInFrame`), `2af3e51` (PHYSICS 20: obstacles 16 m round the explorer), `ce7e69d`
(PAINTER 13's bug: a tidally locked body's orbit turns with its spin when its hour is set,
`Ephemeris.orbitShift`, saved). Unit 150.
**Next PILOT, in order**: (1) see in a browser what only Node has seen: a landing on Neptune's sea (the ship should
heave; `docs/lead/evidence/review6b/seaship.mjs` has the place), Earth's autumn_woodland stand (the
berth). Seen already (REVIEW 3c): Neptune's daylight arrival, the camera at the storm-seas vista, Earth
in the Moon's sky; (2) the landing's chase camera inside a crown
(REVIEW section 4, 372 pops): shorten the ship's boom where `canopyHeight` puts the camera among
crowns, eased, and re-film `node tests/motion.mjs --only landing`; (3) PAINTER 13's near-side Moon (`7a51d42`): unit, world, the Moon's places in Node, the Moon
boulder run (PASSED) and the top-tier Moon tour all pass on a clean tree with my `ce7e69d`; (4) when PAINTER fixes `obstacles.js` (For PAINTER 1), rerun
`docs/lead/evidence/review6b/obsmiss.mjs` and the landing survey. Scratch:
`/home/user/.pc-scratch/pilot/run10/` (`runall2.sh` = the browser queue; `tree/` the clean tree;
`scripts/` the Node probes; `judge.md` the per-body notes). **Cost me time**: a top-tier load takes 6 to
9 minutes here, so tour several bodies per process (`--bodies a,b,c`, as `runall2.sh` does); a frame of
the weather set took 7 to 13 minutes at a load of 12; the coordinator snapshots half-done files of
every role into "WIP snapshot" commits (mine too: `tools/commit.sh` then says "nothing to commit"),
so build test trees with `tests/cleantree.sh` from each role's last own commit; work only under
`/home/user/.pc-scratch/pilot/` (the session scratchpad is shared and was wiped once).

**Ninth agent, 2026-11-12 (the eighth's and seventh's below still
hold).** Block: a lead developer's code review of everything PHYSICS 15/16 and PAINTER 11
committed since `a671ca7`, Node and reading only (the art pass held the browsers). Result:
`docs/lead/REVIEW.md`, "Review 7 (code)" (top), and TRACK risk 10. Findings, all PHYSICS: (1)
MUST FIX, the explorer's ghost run (`explorer.js` `ghostCrosses`) overwrites the walker's `_dir`
and `_gnd`, so running through a boulder field off the x-z plane loses up to 2.2 m/s in a step and
gets 1.1 m/s radial; exact four-line fix given and checked on a copy (PHYSICS' explorer suite
passes with it); (2) SHOULD FIX, `SeaMap.rebase` leaves the published target in the old frame, so
the warp cold-starts and the crests slide about 15 m after every re-anchor (one-line fix,
checked); (3) SHOULD FIX before PAINTER wires the map, one-frame steps in the shown sea map at
fixed places when a build lands (0.24 m, 28 degrees). PAINTER 11: nothing to fix; its prewarm
hooks fit my caller, and `outputColorSpace` linear changes nothing PILOT owns. Mine (`33abe08`):
`src/player/explorer.js` passes the body's receiver to `env.air` (PHYSICS P18's ask). Unit 140,
PHYSICS explorer 36, static rules pass on a clean export of `98edfcd`. Evidence scripts:
`docs/lead/evidence/review7/ghostfield.mjs` and `seamap-seams.mjs` (pass the trees to compare;
rerun them on PHYSICS' fix). Scratch: `/home/user/.pc-scratch/pilot/run9/`. **Next PILOT**: when
PHYSICS answers, rerun both scripts on their commit; review 6's second half is still waiting for
the art pass to free the machine (the seventh agent's list below, unchanged).

**Eighth agent, 2026-11-11 (the seventh's below still holds for
review 6).** I did the hardening review's PILOT list (`docs/lead/HARDENING.md` section 2,
P1 to P15) and its gaps 12 and 16: record in "Eighth agent" below, asks in "For PAINTER (eighth
PILOT agent)" and "For PHYSICS (eighth PILOT agent)" under "Needs from the other". Commits
`932cd9d`, `b990e8b`, `085d5e1`. Unit suite now **140** (new: `tests/input.test.mjs` 8,
`tests/dynres-sweep.test.mjs` 5, one each in gamepad and save). What changed for the next
PILOT: the game waits behind the card for `prewarm()` (`window.__pc.warm` says what it did);
`__pcReady` comes a little later; sound starts only inside a gesture (the browser checks run
with autoplay allowed, so they do not notice); `Input` reads action keys by printed letter
(`bindingOf`), only standard pads, and its pointer-lock fallback re-arms once (lockcheck
expects that); the controller can learn a frame-rate cap (`dyn.capMs`); `info()`'s debug has
`gl` (`probeGL()`); main.js stops with a sentence when WebGL 2 or float targets are missing
(`window.__pcNoGL`). My browser instrument for all of it: `/home/user/.pc-scratch/pilot/run8/
probe.mjs <root> audio,pad,hotas,dpr,quality,nogl2,modfail,lost,prewarm,nofloat`. **Waiting
on the coordinator's word after the art pass** for the rest of review 6 (the seventh agent's
list below, unchanged). PAINTER's A2 hooks were in their working files, not committed, when I
tested my side against them: once committed, rerun `probe.mjs ... prewarm` on a clean tree
and land on another world after ready (no link expected).

**Seventh agent, 2026-11-11 (read this paragraph first; the fifth agent's handover below still
holds for the code, the commands and the timings).** Review 6 is half done and paused for the
owner's **art pass** (four agents by planet group, every world's look changing): run nothing
of the look until the coordinator says the pass has landed. What stands: review 6's first
half (the mechanics, the sixth agent's runs) and a partial top-tier tour (six bodies on
PAINTER `b022507`, Venus and Saturn on `ad17d2c`) with findings for PAINTER, in
`docs/lead/REVIEW.md`, "Review 6, the tour" (top). Mine this run (record in "Seventh agent"
below): the explorer steps with PHYSICS' gait (`src/player/figure.js`), footsteps on its
footfalls, the hull's yaw, a stroll on C, the jump's fold by gait; the sketch slip waits at an
arrival and is smaller; **the stub guard** (every browser check fails when the real game
falls back to a stub it did not ask for: `window.__pc.info().fallback`, `tests/browser.mjs`
`fallbackProblem`), never yet run in a browser. **What is left, in order, once the coordinator
says go**: (1) build a clean tree from each role's last own commit (`tests/cleantree.sh`), run
`node tests/all.mjs` inside it (the first browser run of the guard: every step should print
"every module the run asked for is the real one"); (2) the tour at the top tier, `--first 1`,
body by body, all ten (my runner: `/home/user/.pc-scratch/pilot/run7/tours.sh`, which waits
while `run7/pause` exists so a check can take the browser between bodies; about 20 minutes a
body at a load of 13; the tour now waits 30 minutes for the game to load); then `--quality 1`
for coverage of every biome and vista; judge against the art bible and compare with the
partial table in REVIEW; (3) review 6's second half: `node tests/motion.mjs` (all eight
scenes), `node tests/weather.mjs` (top tier), `node tests/boulderrun.mjs` on the Moon against
the ruled measure (no boulder lifts the feet more than 0.3 m, never thrown up more than
0.3 m without a jump), settle times from the tour's json; (4) PAINTER's stepping figure
(reads `feet`, `ride`, `stride`) seen in the game once it is committed: my scratch
`run7/gaitcheck.mjs <root> <out-prefix> [quality]` films stand, pace, stroll, run, jump.
Open items of mine are unchanged from the fifth agent's list below (10 to 14 in REVIEW's
"Before review 6"), plus: the slip's place at 1080p not yet seen in the painted game.

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

## Eighth agent (the hardening review's fixes; record, newest last)

Order: `docs/lead/HARDENING.md` section 2, P1 to P15, then gaps 12 and 16. Scratch:
`/home/user/.pc-scratch/pilot/run8/` (`mkwork.sh` = a fresh export of the head with my changed
files over it, in `run8/work`; `probe.mjs <root> <cases>` = my browser checks, one Chromium at a
time; `before/` = an export of `a671ca7`, the head before my first commit).

1. **P1, sound inside a gesture (was broken).** `main.js` listens (capture phase) for
   pointerdown, mousedown, keydown, touchend and click and calls `audio.start(true)`;
   `audio.start(gesture)` makes the context, or resumes it, only when `gesture` is set (a given
   `context`, the tests' OfflineAudioContext, needs none); `game.js` no longer starts sound from
   the frame loop. A pad-only player gets one line, "Click or press a key for sound". Checked in
   Chromium with `--autoplay-policy=user-gesture-required` (probe `audio`, `pad`): before any
   input the state is `off`; one click makes the context inside the `pointerdown` handler with
   `navigator.userActivation.isActive` true, and it runs; two key presses then make no second
   context and call no resume; no AudioContext warning. A standard pad holding A, no click, 5 s:
   no context, no resume, no warning, the line on screen.
2. **P2, non-standard pads (was broken).** `Input.pollPad` reads only `mapping === 'standard'`
   pads; any other device is ignored and said once ("A controller that is not a standard
   gamepad is connected: it is not used"). I chose the review's smallest fix over "learn each
   axis's rest": a trigger resting at -1 passes through 0 when pressed, and Chrome reports 0 on
   every axis before a device's first report, so a learned rest can be learned wrong; the README
   already promised the standard layout. Unit (`tests/gamepad.test.mjs`, 1 new: fails on the old
   file); browser (`hotas`): a throttle at -1 on axis 2 with the card up, 4 s: no turn, the card
   stays, the game does not start, the line once.
3. **P4 + P8, the frame-rate controller.** I adopted the review's candidate (`dynres.js`: a
   slow frame moves the average at most to 2.5x it or 50 ms; the panic needs 3 of the last 5
   frames over the line; a panic during a probe takes back only the probe; a refresh or rAF cap
   is learned when shedding 40 % of the picture leaves a steady interval within 3 %, forgotten
   after 3 s well under it) after reading it line by line, with three changes: the jitter guard
   is 2.5 ms, not 1.5 (it is the second guard: the first is that shedding did not move the
   interval, and for a CPU-bound machine or a cost that does not scale, restoring the best
   picture is right anyway); the budget object is cached (the candidate allocated one a frame);
   the read-out's render-scale line says `capped at N fps`. Its 5 tests are kept
   (`tests/dynres-sweep.test.mjs`); the review's scenarios (`sweep/synth/sim/scen.mjs`) give the
   candidate's exact results with my file, and `jit.mjs` finds the caps at +-0.3 to +-4 ms of
   jitter. P8: `physics.setQuality` beside each `painter.setQuality` (probe `quality`:
   `?quality=0`, `1`, none -> `__pc.physics.quality` 0, 1, 2).
4. **P3, the shader prewarm.** On the first settle `main.js` runs `prewarm()` behind the card
   ("mixing the colours"), and `__pcReady` waits for it: `world.prewarm()` and
   `painter.prewarm(scene, camera)` when PAINTER has them (their A2, in progress in PAINTER's
   working files as I write); else three's `compileAsync` of the whole scene graph with a 2x2
   render target bound (three keys a program by the bound target's colour space: compiled for
   the screen, every scene material would be compiled twice); then each program's
   `getUniforms()` to wait for the link. 90 s safety net. Real game, tier 0, 480x270, the same
   steps on both trees (night, day, a storm, fair, the ship at 300 m, space; the state log
   confirms ATMOSPHERE and SPACE were reached): **before** (`a671ca7`) 15 programs at ready, 23
   scene materials without one, `pc-sky-glaze` linked at night and `pc-wash` at day, in play;
   **after** 20 programs at ready (the warm step compiled 5 in 128 ms), none without one, and no
   program linked after ready. Space frame `run8/out/prewarm-space.jpg` (opened: the ship among
   painted stars, markers, the read-out).
5. **P5, pointer lock.** A refusal within 1.5 s of an unlock says "Click again to capture the
   mouse" and keeps trying; other refusals (one per request: the promise and the event both say
   it) fall back at the third. The flick filter: every delta over 120 px still goes through the
   hold-back test; the line for an impossible spike scales with the game's frame time (at most
   3x; `take(dt)` smooths it); a held delta is a flick if the next one follows it **or the one
   before led into it** (at 30 fps a flick's last frame is under 15 % of the one before, which
   the old rule called a lone jump). I first scaled every line by the time since the previous
   event, as the review proposed: lockcheck then failed (the headless stream's window-sized
   jumps arrive seconds apart on a slow page and passed as flicks; pitch thrown 1.37 rad). The
   recorded stream is now a unit test. Nonsense falls back once until the next click, then for
   good. The map and the sketchbook let go of the lock (`input.release()`). Measured (Node,
   the real handlers, one move and one `take()` a frame; three 180-degree flicks in 180 ms, 250
   ms apart): lock kept and 100 % of the turn at 20, 24, 30, 40 and 60 fps; the old file lost
   the lock at 20, 30 and 40 fps and applied 7, 13 and 89 %. `tests/lockcheck.mjs` updated for
   the one re-arm: PASSED (pitch moved 0.046 rad, drag-look 0.092 rad for 40 px).
6. **P6, keyboard layouts.** `bindingOf(code, key)`: walking keys (W A S D, Space, Shift,
   arrows, Tab, backquote) by position; the action keys E V C X F M B H by the letter printed on
   the key; anything else by position (so an action whose letter sits on a walking key, Dvorak's
   E on QWERTY's D, or is printed nowhere, a Cyrillic layout, keeps its QWERTY place). Each press
   is exactly one binding (the review's "add the alias too" would make Dvorak's X open the
   sketchbook as it brakes, and Colemak's F board as it pulses). `keyLabels(getLayoutMap())`
   relabels the help card and the prompts in Chromium ("Z Q S D" on AZERTY; Dvorak ", A O E"
   and "." for E); only characters the hand lettering can draw.
7. **P7** drawing buffer at most 3.7 MP (`OUTPUT_MAX_PIXELS`, the coordinator's ruling): probe
   `dpr`: 2560x1440 at DPR 1.5 -> 2564x1442 (3.70 MP), 1920x1080 at 1 -> 1920x1080, 1440x900 at 2
   -> 2160x1350. **P9** the wheel in notches of 120 px (lines x16, pages x100), at most 3 an
   event. **P10** `audio.pause()/resume()` on visibilitychange (probe: hidden -> `suspended`,
   shown -> `running`, the wind's gain coming back). **P11** repeats hold the key, a Meta keyup
   clears all. **P12** a `matchMedia` resolution watch that re-arms (code only: cannot be
   provoked headless). **P13** no WebGL 2 -> one sentence on the bare sheet, no console error
   (`run8/out/nogl2.jpg`, opened). **P14** a classic script in `index.html` (no import maps ->
   "needs a current browser"; the module script's `onerror` or an early error -> "could not be
   loaded: reload the page"; 15 s without `main.js` running -> "still loading..."): book.js
   answered 404 -> the message at once (`modfail.jpg`, opened). **P15** context lost -> "the
   paper is being redrawn", 5 s -> "the graphics driver stopped: reload the page (your journey is
   saved)", the sound paused; restored -> cleared, frames go on (`lost-late.jpg`,
   `lost-after.jpg`, opened). The bare sheet's plain messages are centred with side margins (at
   400 px they ran to the left edge).
8. **Gap 12, no float colour buffers.** Real game with EXT_color_buffer_float and
   EXT_color_buffer_half_float hidden (getExtension and getSupportedExtensions in an init
   script): three warns, every pass into PAINTER's half-float targets is an incomplete
   framebuffer (GL_INVALID_FRAMEBUFFER_OPERATION on clear and every draw), and the player sees a
   dark empty sheet inside the ragged border with the HUD on it (`run8/out/nofloat.jpg`,
   opened). Mine now: `probeGL()` reads the extensions, and with the real painter and no
   `painter.floatFallback === true` the sheet says "Painted Cosmos needs a graphics feature this
   browser or driver does not offer (float colour buffers in WebGL 2): try a current Chrome,
   Edge, Firefox or Safari, with hardware acceleration on." (probe: within 7 s, no console
   message). The fallback itself is PAINTER's: "For PAINTER (eighth PILOT agent)" below.
9. **Gap 16, a save made swimming.** It did restore on the bed (`restore` stood the feet on the
   ground radius under 6 m of water: 0.00 m above the bed in the new test on the old file).
   Now, in liquid deeper than `EXPLORER.swimDepth`, the explorer comes back afloat, feet 1.25 m
   under the surface, not grounded (`tests/save.test.mjs`, 1 new).
10. **The play still plays** (stubs, a clean export of `085d5e1` with my notes over it, `node
    tests/all.mjs --only static,play-stub,trip-stub`): static rules hold, play-stub 38 checks,
    trip-stub 50 checks (Earth, Mars, Saturn, the reload from the save), ALL 3 PASSED; also
    lockcheck and m3check (stubs) PASSED and audiocheck PASSED after the changes. The painted
    steps of `all.mjs` were not run (the art pass has the machine; review 6 runs them).
11. **README**: layouts, the touchpad, Esc and "click again", the map releasing the mouse, the
    pad (standard layout only, sound needs a click), sound starting on the first click and
    going quiet in a hidden tab, the loading card compiling shaders, hitches, frame-rate caps
    and `capped at N fps`, the 3.7 MP picture, physics following the tier, Safari and Firefox
    never run, the old-browser and no-WebGL sentences.

## Seventh agent (review 6, the tour; record, newest last)

1. **Review 6's first half put on record** from the sixth agent's draft (its runs, its
   commits; REVIEW, "Review 6, first half"), `c8745f0`.
2. **The sketch slip no longer covers the ship in the first view** (the coordinator saw it
   from a clean export of `20b6bb5`: "Temperate Forest / Earth / page 1 of 115" over the top
   right, where the ship stands 16 m off). At an arrival (the game's start, every step out of
   the ship) the page is still kept at once, but its slip waits until the explorer has walked
   4 m from where they stood or 25 s have passed (`SKETCH_SLIP` in `src/core/sketches.js`;
   `game.updateSketches`); the pencil sound comes with the slip. The slip is smaller and
   tucked into the corner (`right 4.5 %, top 5.5 %, width clamp(152px, 19vw, 172px)`; it
   was 23vw up to 204 px at 9.5 % / 6.5 %); 5 s on screen (was 6). `m3check` now checks that
   the slip waits and then shows once the explorer sets off: on stubs 30 checks PASSED
   (frame `docs/shots/pilot/slip-held.jpg`, opened: the slip in the corner, clear of the ship; its
   last line ran 10 px past the paper at 640 px, hence the minimum width).
3. **The explorer steps in the game** (PHYSICS P13 wired; code in the coordinator's backup
   `f86bd1b` of my files, tested before it was taken). `src/player/figure.js` (pure):
   `figureArgs` hands `explorerModel.animate` `hip: phys.ride` (so a figure that reads only
   `hip` folds its knees with the stride) and by name `ride`, `stride`, `footDown`, `feet`,
   `surge`, `crouch01`, `gait`, with the old fields; the camera stays on `st.p` (the view does
   not bob). `hullTrim` adds `buffetAngle.yaw` (rotateY, clamped 0.12 rad like pitch and roll)
   to the drawn hull. Footsteps come from `phys.footfall` each time `phys.steps` changes
   (`game.takeFootfall`), loud by force over weight (`footLoudness`: 0.69 strolling, 1.0 at the
   pace, 1.29 running, at most 1.25 in the mixer; a landing on both feet a little heavier);
   without PHYSICS' gait (stubs) the mixer keeps its own cadence. **Feel decisions**: (a) the
   fold before a jump stays 0.12 s from a stand or a walk (the anticipation reads) and is
   0.06 s from a run's stride (`EXPLORER.jumpCrouchRun`: a runner springs from the stride; a
   jump on the move should answer at once); (b) **a stroll**: C on foot toggles 1.7 m/s, a true
   walking gait on Earth (PHYSICS: walk under 2.0 m/s), Shift still runs; the 4.2 m/s pace
   stays the default (it is an easy lope by its gait, and the worlds are kilometres round); a
   gamepad stick tilted a little strolls by itself (the speed is proportional). Help card and
   README name C. Unit: `tests/figure.test.mjs` (6 tests: the hips ride 6 to 7 cm with the
   stride and `st.p` does not; cadence 3.0 a second at the pace; one footfall at a time; the
   stroll is gait 1 at 1.7 m/s; the feet leave 0.12 s after Space from a stand and 0.06 s
   from a run; the hull's trim); PILOT's suite 123 pass in a clean tree (PAINTER `b022507`,
   PHYSICS `2e6ce74`, my working files). **Seen once in a browser** (scratch
   `run7/gaitcheck.mjs`, quality 1, 640x360, the same tree with PAINTER's figure from the
   snapshot `6b900e6`, the one that reads `feet`; strip `docs/shots/pilot/gait-p13.jpg`, opened): standing
   still; at the pace the legs scissor, ride -0.126 to -0.057 m, gait 2, 4.23 m/s; strolling
   gait 1 at 1.71 m/s, ride -0.043 to 0; running 7.42 m/s, ride -0.096 to -0.042; the game's
   footstep hook took 1 to 2 footfalls in each third of a second of moving and none standing;
   no console error. In the air after a running jump PAINTER's snapshot figure lifts its arms
   straight out into a T (for PAINTER, REVIEW).
4. **The tour at the top tier, partial** (REVIEW, "Review 6, the tour"): Mercury, Earth, the
   Moon, Mars, Jupiter, Uranus on a clean tree of PAINTER `b022507`, PHYSICS `2e6ce74`, PILOT
   `5a5b691`, about 20 minutes a body; stopped at the coordinator's word for the art pass.
   Neptune's run timed out waiting for the game to load (10 minutes, under the art agents'
   load): the tour now waits 30. I stopped the sixth agent's orphaned runner (`run6/tours.sh`,
   pid 10058, still touring on `ad17d2c`) by pid when I started.
5. **The stub guard** (the coordinator's request after the import cycle of `6d5c02a` made
   every real module fall back while every Node test passed): `providers.js` lists each module
   it tried and could not load, `main.js` adds PHYSICS if it fails to start, `info().fallback`
   carries the list; `tests/browser.mjs` `fallbackProblem(page, query)` names it (a module
   forced with `?stub=` is not a fall-back; an older game is judged by `using` and the query).
   `startRun` checks it (m3check, trip, grandtour, lockcheck, boulderrun), so do playthrough,
   tour, motion, weather and cost (the instruments stop at once). `tests/fallback.test.mjs` (a
   stand-in page). Not run in a browser yet. `tools/shot.mjs` (the coordinator's) has no such
   check.

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
8. **Spot check after the last fixes** (clean tree PAINTER `4c2cf51`, PHYSICS `6d588d6`, mine
   with every fix above): `node tests/all.mjs --only unit,static,play-stub,trip-stub,m3`:
   ALL 5 PASSED (116 unit tests, 37, 47 and 29 checks). The three painted steps and the
   whole table were NOT run again after these fixes: review 6 runs the lot.

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

### For PAINTER (tenth PILOT agent, review 6 second half; 2026-11-12)

Details, evidence and the tour's frames in `docs/lead/REVIEW.md`, "Review 6 (second half)". Please
answer each in your notes.
1. **SHOULD FIX, `src/world/obstacles.js` `cellsAround`: a wide disc misses trunks and boulders.** It
   tests the disc's centre and eight points on its rim, so a cell lying between two rim points, or
   between the rim and the centre, is never read; the wider the disc, the more it misses, and the
   count FALLS as the radius grows (Pluto's spawn: 24 obstacles listed within 12 m, 22 within 16.5,
   18 within 20, 17 within 25). Against the union of 4 m queries tiling the same disc (`node
   docs/lead/evidence/review6b/obsmiss.mjs`): 80 m round Earth's spawn lists 260 of 536 trunks,
   Mercury's 15 of 126, Neptune's 88 of 202; 30 m round Pluto's 22 of 85 (rocks), Mercury's 18 of 36.
   PILOT asks 20 to 45 m for the canopy under a low ship and 80 m for the trunks round a landing
   site, so the ship can fly through and set down on painted trunks the query did not return (the
   contract tests use the same function, so they cannot see it). Fix: read every cell the disc's
   box touches (sample the disc on rings at most half the smallest cell's side apart, or take the
   face's u, v range of the disc and walk ix, iy), deduplicated as now. PILOT's new arrival code
   asks 4 m discs meanwhile.
2. **The spawn's boulders** (`surface.js` `getSpawn`, the clearings at :760 and :836-838): the
   clearing thins `trees` and canopy only, and only where the biome has tall flora; small kinds
   (rock, shard) are placed right up to the spawn. Mercury's and Pluto's spawns stood on a
   boulder (its edge 0.03 m from the feet). PILOT now steps the world's own arrival off it (4 m on
   Mercury, 5 on Pluto, 1 on Mars), but the "place to land" ring and the view you composed are at
   your point: let the spawn clear `small` rocks and shards within about 6 m (or choose the spawn
   off them), and PILOT's step will move nothing.
3. **Neptune's season: DONE in `dc876f9`** (you said yes through the coordinator). At t = 0
   Neptune's northern hemisphere is in winter, and every Neptune stand is north (lat 3 to 71): the
   spawn and `kelp_forests` (lat 71) never see the sun above 2 degrees, so the arrival and that
   biome are a lilac twilight at every hour, and the art pass tuned `kelp_forests` under a 2-degree
   sun. With `axialTilt` -0.49 for 0.49 (the other season, the same orbits) every Neptune place gets
   more sun and none less: the spawn 2 -> 36 degrees at noon, `aurora_tundra` 33 -> 67, `ice_spires`
   58 -> 88, `storm_seas` 70 -> 76 (`node docs/lead/evidence/review6b/season.mjs "" neptune`).
   Flipped; nothing for you to do but look at Neptune's frames again (not yet seen in a browser).
   (Earth stays: its alpine meadow at 65 S would lose its sun.)
5. **The ship at a coast stand** (your note 6): `dc876f9`, the arrival's berth counts a hull standing
   less than 1.2 m over a liquid's still level against the spot; 2 of 52 berths were in the water
   (Earth's autumn_woodland and misty_wetland stands), now 0; no composed spawn moved.
6. **From the tour and the motion set** (REVIEW, "Review 6 (second half)", sections 3, 4, 7): Pluto's
   and Mercury's arrivals fail on their boulders; night near-black; Mars from orbit; foliage specks;
   Saturn's walled vista; flat flower and leaf ellipses; Venus' flat lava; Uranus' single value
   range; boxy islands and stacks.
4. **The hour now means the same light everywhere** (ARTPASS wish 12, `9c93e77`): `teleport({hour})`,
   `__pc.setHour` and the mood's `timeOfDay` use your `lighting.hours` clock (6 and 18 on the
   horizon). Frames you take at "hour 10" from now on are about the same sun as before at most stands
   (within 4 degrees), but Uranus' polar-day stands get a lower sun (`ice_shelves` 69 -> 48 degrees:
   10 is now the early side of its circling sun) and Earth's spawn at 9.5 a higher one (21 -> 27).

### For PHYSICS (tenth PILOT agent; answers to P20; 2026-11-12)

1. `tests/boulderrun.mjs`: your two lines are in (a flight is a boulder's only where the ground fell by
   less than that boulder's height plus the limit; the rest are listed as "the ground fell away").
2. The ship landed on water (the coordinator's ruling): done in PILOT's ship, not in your gear.
   `Sim.stepAfloat` (src/core/sim.js): a parked ship with `sh.onLiquid` keeps its still pose from the
   landing and each step reads `env.waterLevel(q, depth)` (your bindEnv's, the drawn sea) on a 5 x 3
   grid over the hull (8 m x 4.4 m): the mean is the heave, the least-squares slopes along and across
   are the pitch and roll (at most 0.35 rad), taken up at 2.5/s. Measured in Node with your P20 on the
   real worlds: Earth's sea_coast (Hs 0.11 m) heave within 2 cm, pitch 0.4 degrees; Neptune's
   storm_seas (Hs 0.76 m) heave +-0.35 m (sd 0.20), pitch +-3.6, roll +-4.4 degrees, at most 1 cm a
   frame (scratch `run10/scripts/seaship.mjs`); a model 1 m swell of 60 m: heave 0.89 m, pitch 5.4
   degrees; 3 m chop of 0.5 m: 0.05 m (`tests/afloat.test.mjs`). So please do NOT move the gear's floor
   to `env.waterLevel`: afloat, the gear is not stepped (it never was: `stepParked` uses it only on
   dry ground), and LANDED needs nothing asleep. A save made afloat comes back afloat.
3. The camera's vertical follow while swimming is smoothed (0.45 s: a 5 s swell keeps 85 % of its
   height in the view, slaps under a second are let go; `Sim.footPose`).
4. P22's wiring ask: the explorer's obstacles are looked up 16 m round it (`2af3e51`). Checked against
   PAINTER's wide-disc fault first: at 652 places a 16 m query lists everything a 9 m one does.
5. **Your feel question, the slowing before crater rims (owner of feel's verdict): too heavy.** A mean
   pace on the Moon of 3.0 to 6.0 m/s, where it was 5.0 to 6.2, is a run braked to half speed at
   every rim, and the feel target is unhurried, weightless and generous: a short float off a rim at
   6 m/s in a sixth of Earth's gravity is the Moon's character, and the coordinator ruled the rim
   flights physics, not a fault (the 0.3 m rule is about boulders). Please brake for boulders as you
   do, but before a rim ease off by no more than about a fifth (keep the pace at 4.5 m/s or more) and
   let the runner leave the ground. Measured since in the game (`tests/boulderrun.mjs`, the Moon's new
   crater_fields field, clean tree PAINTER `7a51d42`, PHYSICS `b2aa445`, PILOT `ce7e69d`, quality 0, 30
   steps a second): PASSED, thrown 0 m, no boulder lifts the feet over 0.3 m, mean paces 4.55, 5.31,
   5.08 and 6.05 m/s in four headings (top 7.4), one rim flight (1.95 m over ground that fell 4.57 m).
   On that field the slowing is acceptable; where it takes the pace to 3 m/s (your site) it is too
   heavy. Not watched at 60 frames a second (nobody here can).

### For PHYSICS (ninth PILOT agent, review 7 (code); 2026-11-12)

Three findings in `docs/lead/REVIEW.md`, "Review 7 (code)", each with file:line, the measured
failure and the exact fix; please answer them in your notes ("fixed in <commit>" or "disagree,
because ..."). (1) MUST FIX: `explorer.js` `ghostCrosses` must not touch the walker's `_dir` and
`_gnd` (four lines: the ghost's own ground object, `_dir` saved and restored in a `finally`), and
call `P.ground(Q.surf, ...)` once per trial. (2) SHOULD FIX: `SeaMap.rebase` shifts the published
target too (one line). (3) SHOULD FIX before PAINTER wires the map: the shown map's one-frame
steps when a build lands (a continuously moving blend centre, new nodes eased from what is shown,
the outer level resampled after a re-anchor). Rerun `node docs/lead/evidence/review7/ghostfield.mjs
<before> <after>` and `seamap-seams.mjs <before> <after>` (trees as folders with `src/`) to show the
fix. Done on my side: the explorer's command passes `{ size: 0.5, velocity }` to `env.air`
(`33abe08`), as your P18 note asked.

### For PAINTER (ninth PILOT agent, review 7 (code); 2026-11-12)

Nothing to fix from PAINTER 11: the prewarm hooks fit `src/main.js`'s caller (the compile lands
inside your 30-update window; three's `compile()` walks invisible objects), and `outputColorSpace`
linear changes nothing PILOT reads (canvas, sketch capture, HUD). When you wire the sea map, wait
for PHYSICS' answer to review 7's finding 3, or the shown sea will step in single frames near the
inner level's edge.

### For PAINTER (eighth PILOT agent, the hardening review; 2026-11-11)

1. **A2, the prewarm hooks: my side is in (`src/main.js` `prewarm()`) and works with yours as
   they stand in your working files.** Call order, on the first settle, behind the card:
   `await world.prewarm()`, then `await painter.prewarm(scene, camera)` (when it exists I do not
   compile the scene myself), then every program's `getUniforms()` (waits for each link), and
   `__pcReady` once that is done and the view has settled again (or 300 frames on). Measured on
   the head (`932cd9d`) plus my files plus your working render/world/art files, real game, tier
   0, 480x270: steps world, painter, linked in 320 ms; 25 programs and 125 scene materials at
   ready, none without a program; no program linked after ready through night, day, a storm,
   fair, the ship at 300 m and space. Without your hooks my fallback compiles the scene with a
   2x2 target bound (your `renderer.outputColorSpace = LinearSRGB` makes that unnecessary, and
   harmless). Not checked by me: a landing on another world after ready (your hooks are meant to
   cover every world's flora: your check). **One more thing for A2:** a tier change (the
   controller dropping to tier 1 or 0 under load) changes defines (the 4-sector brush and the
   rest) and compiles at the worst moment, on a machine already struggling; if
   `painter.prewarm` laid each tier's post passes once (the review names `mAbs[4]`, `mAbs[8]`,
   `mSheet`), that stall would go too.
2. **Gap 12, no float colour buffers (low priority: rare on desktop WebGL 2).** With
   EXT_color_buffer_float and EXT_color_buffer_half_float hidden, every pass into your half-float
   attachments is an incomplete framebuffer (`post.js`: `rtScene.textures[1]` :264, `rtHalf`
   :268, `rtPrev` :276) and the sheet is dark and empty under the HUD (my
   `run8/out/nofloat.jpg`). I now stop with a plain sentence unless `painter.floatFallback ===
   true`. A fallback, if you want one: when `!renderer.extensions.has('EXT_color_buffer_float')
   && !renderer.extensions.has('EXT_color_buffer_half_float')`, make those three attachments
   `UnsignedByteType`, pack what needs the precision (the depth `mKeep` reads from `tAux.z` for
   the water's reflections) into two 8-bit channels, and set `floatFallback = true` on the
   painter object; the game then runs.
3. A1 (log depth written in the vertex shader when EXT_clip_control is missing) needs nothing
   from me.

### For PHYSICS (eighth PILOT agent)

1. **P8 is live:** `physics.setQuality(q)` now follows the controller's tier (at start and at
   every change; measured: `?quality=0`, `1`, none -> 0, 1, 2). The top tier therefore runs your
   quality 2 (rain 3200, leaves 6000, 12 samples a frame): the review asks you to confirm a storm
   at quality 2 stays inside your frame budget with your `PC_TIMING=1` tests.


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
