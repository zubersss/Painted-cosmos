# Painted Cosmos

A calm exploration game for desktop browsers that looks like a watercolour landscape come to
life. Walk through a forest, lift on a jetpack, board your ship, climb through the sky into
space without a loading screen, fly to every planet of a small solar system, land anywhere and
walk out. There are views to find and a sketchbook that fills as you go. There is no combat
and nothing can go wrong: the ship will not let you crash and the explorer cannot be hurt.

## Play

**In the browser:** <https://zubersss.github.io/Painted-cosmos/> (GitHub Pages, served from the
`main` branch). A desktop browser with WebGL 2 is needed (a current Chrome, Edge, Firefox or
Safari 16.4 or newer; the page says so in a sentence if yours cannot run it); a keyboard and
mouse, or a gamepad.

**From a copy of this repository:** the game is plain ES modules with no build step and makes
no network requests once loaded. Serve the folder with any static server and open it:

    node tools/serve.mjs 8080      # then open http://127.0.0.1:8080/

(Opening `index.html` straight from the disk does not work: browsers do not load modules from
`file:` addresses.)

**The first minute.** The title card is also the loading screen: it prepares the paper,
mixes the colours (every shader the journey needs is compiled here, so that nothing stalls
later) and says "click to begin" when the first view is painted. Click. You stand in a clearing in Earth's forest, the ship a few
steps away. Walk to it with `W A S D`, press `E` to board, hold `Space` to lift off, push the
throttle with `W` and point the nose at the sky. Above the air, press `M`, choose a world,
point at its marker and press `F`. Near a world the drive lets go by itself; fly down, and
press `E` when the prompt says you can land. A world you have not walked on yet shows "a place
to land" (a small ring on the ground, or an arrow at the edge of the picture when it lies round
the curve): the spot its first view was painted from. You may land anywhere else.
`H` shows the controls again at any time.

## Controls

The walking and flying keys are read by where they sit, the action keys by the letter on
them: on an AZERTY keyboard you walk with `Z Q S D` and open the map with the key marked `M`;
on Dvorak or Colemak, `E`, `F`, `X` and the rest are the keys with those letters. Chrome and
Edge tell the game your layout, and the help card and the prompts then name your keys.

On foot

| Key | Action |
| --- | --- |
| W A S D | walk |
| Shift | run |
| C | stroll: a true walk (1.7 m/s) in place of the usual easy lope (4.2 m/s); C again for the pace. A gamepad stick tilted a little strolls too |
| Space | jump; hold to fire the jetpack (it refills on the ground and in water, and slowly while falling: you cannot hover for ever, on any world). Afloat, Space does not hop: held, the jetpack lifts you out. From a stand the legs fold for an eighth of a second first; from a run, half that |
| mouse | look (click the picture to capture the pointer; or hold the left button and drag) |
| mouse wheel | camera closer / farther (a touchpad swipe moves it a little at a time) |
| V | first person / third person |
| E | board the ship when you are next to it; at a view you have found, stand at its easel |

In the ship

| Key | Action |
| --- | --- |
| Space | lift off; in flight: rise |
| C | sink (settle onto the ground to land) |
| W / S | throttle up / down (it stays where you leave it) |
| A / D | turn |
| mouse | point the nose |
| X | brake |
| F | pulse drive (in space): point at a world's marker and press F; F again drops out |
| M | the map: click a world, or use the arrow keys, to set a course; M or Enter closes it |
| E | land when the prompt shows (pressed at speed, the ship first slows down with its own brakes, then sets down; Space or W lets it go); step out when landed |
| V | cockpit / chase view |

The ship hovers when you let go, levels itself, rides above the tree tops, and will not let
you crash. The pulse drive brakes by itself and lets go in front of the world ahead.

Anywhere

| Key | Action |
| --- | --- |
| B | the sketchbook: a page per world with the sketches drawn there, of every landscape walked and every view drawn from its easel (arrow keys turn the pages) |
| H | the help card (these controls) |
| ` (backquote) | the frame read-out (explained under "Is it fast enough on my machine?") |
| Esc | releases the mouse (click the picture to capture it again; if the browser says "too soon", click once more); closes the map or the sketchbook |

A gamepad works too (standard layout): left stick walks (in the ship: turn and throttle), right stick looks
(points the nose), A is Space, B is C, X is E, Y is V, LB brakes, RB is the pulse drive, the
triggers are the throttle in the ship (the right one runs on foot), Back opens the map, Start
the help card, d-pad up the sketchbook (left and right turn its pages, down closes it).
A device the browser does not report in the standard layout (a flight stick, pedals, a pad it
cannot map) is not used, and the game says so once. Browsers do not let a gamepad start
sound: click or press a key once (the game reminds you). Not tried with a real pad: the
mapping is tested with a simulated one.

The game saves itself when you land, when you step out, and every 20 seconds on foot, and
continues from there on the next visit. Add `?fresh=1` to the address to start again on Earth.

Opening the map or the sketchbook lets go of the mouse, so that you can click on the page; a
click on the picture captures it again. If the browser keeps refusing to capture the mouse (three
times in a row, not just after Esc), or reports nonsense while it does (twice), the game says
so and you look around by holding the left button and dragging.

Each world has views to find. On foot, within 150 m of one not yet drawn, a small ring (or an
arrow at the picture's edge) says "a view". Walk up to it and it is found; press `E` there to
stand at its easel: you are walked to the spot and turned the way the picture was painted, and
the page is drawn. Every landscape gets a sketch the first time you walk into it. A sketch is
drawn in washes and pencil from the picture on the screen, without you in it.

A day is not even: the world you stand on turns slowly while its sun is near the horizon and
quickly through the night, so dusk and dawn last about five minutes each on Earth and the
night about as long. A new game begins at eight in the morning. All sound
is made in code (wind that follows the real wind, rain, thunder, the ship, the jetpack,
footsteps, a quiet pad per planet); `?audio=0` turns it off. It starts with your first click
or key press (browsers allow no sound before one) and goes quiet while the tab is hidden.

## Is it fast enough on my machine?

The target is 60 frames a second at 1080p on a laptop's built-in graphics, and never under 30.
**Nobody has measured that on a real machine yet** (see "Never verified on real hardware"
below), so the game looks after itself and gives you the means to check.

**It picks the best your machine can hold.** The game starts at the best picture it has: the
high quality tier at full resolution. It gives some of that up only when the measured frame
time asks for it, and quickly: under 30 frames a second it sheds resolution at once (down to
half) and, if even that could not reach 30, a quality tier in the same move, so a slow machine
is not left at a crawl (within about two seconds it is on a setting it can hold). A little
over budget, the resolution steps down after half a second. It climbs back carefully: one
small step of resolution after a few steady seconds, a quality tier only after twelve seconds
at full resolution; a step that does not hold is taken back and tried again less often. It
does not judge frames while the first view is loading, and one slow frame (a hitch) moves it
only a little: it sheds load when slow frames keep coming. **A frame-rate cap is not load:**
on a 50 Hz screen, or with Chrome's Energy Saver or Safari's Low Power Mode holding the page
to 30 frames a second, giving up picture would not make the game any faster; when shedding
two fifths of the picture leaves the frame time where it was, the game takes the best picture
back and treats that rate as its target (the read-out then says `capped at 30 fps`). A
machine held back by its processor rather than its graphics keeps the best picture for the
same reason. The physical models (rain, snow, falling leaves, the samples of the ground)
follow the tier too, so a lower tier eases the processor as well.

**The size of the picture.** The game draws at the window's size, at up to 1.5 pixels per
point on a high-density screen, and at most about 2560x1440 (3.7 million pixels): a 1080p
screen and a Retina laptop keep every pixel, a 4K monitor is painted at about 1440p and
enlarged by the browser.

**The quality tiers.** There is no triangle budget: the high tier is the painting as it is
meant to be seen, and the lower tiers exist so that a weaker machine still plays.

| Tier | What it draws |
| --- | --- |
| 2, high (the start) | full resolution; full-detail trees to 90 m and simpler trees to 600 m; undergrowth to 110 m; the sward in three rings (to 17, 66 and 240 m); the finest terrain; the pencil underdrawing |
| 1, medium | 0.8 of the resolution; full trees to about 54 m, simpler ones to 360 m; undergrowth to 66 m; two rings of sward (12 and 40 m); coarser terrain |
| 0, low | 0.62 of the resolution; no full-detail trees, simpler ones to about 170 m; half the undergrowth; one ring of strokes to 11 m at half density; a four-sector brush; no pencil line |

The paper and the washes are the same in every tier; a lower tier has fewer things in it, is
painted on a smaller sheet (the share of the resolution in the table) and, at tier 0, with a
simpler brush and no pencil line. The controller's render scale is separate and multiplies
with it: at 0.50 the picture is painted at half size and enlarged, which softens it a little.

**To pin a tier yourself**, add `?quality=2` (or `1`, or `0`) to the address: the tier then
stays and only the resolution adapts. `?quality=0&scale=0.5&dynres=0` pins both.

**The read-out.** Press the backquote key `` ` `` (or add `?stats=1` to the address). It shows
five lines:

| Line | What it says | What to look for |
| --- | --- | --- |
| `frame` | the average frame time in milliseconds, the worst frame of the last ninety, frames a second | 16.7 ms is 60 frames a second; 33 ms is 30 |
| `scene` | triangles and draw calls of the whole frame (every pass) | information only: there is no budget |
| `render scale`, `quality tier` | what the game has settled on; `(pinned)` if the address fixed them; `capped at N fps` when it found the screen or the browser holding the frame rate | 1.00 and tier 2 on a machine that copes |
| `world`, `physics` | milliseconds a frame spent building the landscape and stepping the physical models, with their worst recent frame | a few milliseconds each; a long `world` worst is a hitch while new ground is built |
| `weather` | what the weather's own marks cost (rain, snow, dust, ripples: "kits"), and what the sky is doing | `fair`, or for example `overcast 0.94  rain 0.92  storm 0.84  wet 0.96` |

If `frame` sits above 17 ms with the scale at 0.50 and the tier at 0, the machine cannot hold
60 frames a second in that view.

## Never verified on real hardware

Everything in this game was built and tested in a sandbox with a software renderer and
scripted input. These things have never been checked on a real machine by anyone:

- **Frame rate on a real GPU.** The logic that steps the tier and the resolution down and up
  is unit-tested against model machines, but no frame time has been measured on any graphics
  card. The read-out above is there so that you can.
- **A real mouse under pointer lock.** Mouse look is tested with synthetic events (fast
  turns at 20 to 60 frames a second among them). If the browser will not capture the mouse
  (or reports nonsense while it does), the game says so and falls back to holding the left
  button and dragging; that fallback is tested.
- **A real gamepad, other keyboard layouts.** The standard mapping is tested with a simulated
  pad only; AZERTY, Dvorak and Colemak with simulated key events.
- **Safari and Firefox.** Only Chromium was run here: the rule that sound starts on a click,
  frame-rate caps and a change of screen scale are written to the browsers' documented
  behaviour, not observed in them.
- **How it sounds.** Every sound is made in code and its levels are measured (no clipping, no
  clicks, peak about -5 dB), but nobody has listened to it. `?audio=0` turns it off.

## URL parameters

| Parameter | Meaning |
| --- | --- |
| `stub=1` | run on Pilot's grey stub world and plain renderer (also `stub=render,world,art`) |
| `real=1` | try Painter's modules even if they are not flagged ready (also `real=world`, ...) |
| `body=mars` `time=18` | start on another body, at another local hour |
| `clock=even` | every world turns at its own even rate (the game slows dusk and dawn and hurries the night) |
| `quality=1` | pin the quality tier (0, 1 or 2); the resolution still adapts |
| `scale=0.75` | the render scale the game starts at |
| `dynres=0` | switch the controller off: tier and scale stay where the address put them |
| `pointerlock=0` | never capture the pointer; drag to look |
| `stats=1` | show the frame read-out from the start |
| `audio=0` | silence |
| `kits=0` / `weather=fair` | no weather marks (rain, snow, dust) / a clear sky, always |
| `card=0` | no title card (for captures) |
| `fresh=1` / `save=0` | forget the saved game / never save |
| `stub=physics` | turn the physical models off (the explorer and ship then move by simple rules) |

## Checks

    node tests/all.mjs --export      # every check below, in order, on a clean export of the
                                     # last commit; prints one pass or fail table
    node tests/all.mjs --list        # what the steps are (--only a,b and --skip a,b choose)

The steps, which can also be run by hand:

    node --test tests/*.test.mjs     # pure logic: orbits, frames, state machine, explorer,
                                     # cameras, flight, landing, pulse drive, save, the loop,
                                     # the Earth-Mars-Saturn trip, the contract with the worlds
    node --test src/physics/         # the physical models (Physics)
    node --test src/world/*.test.mjs # terrain and biomes (Painter)
    node tests/playthrough.mjs       # walk, jetpack, board, orbit, land, step out in headless
                                     # Chromium with real key and mouse events
    node tests/trip.mjs              # Earth to Mars to Saturn in one sitting, then a reload
                                     # that continues from the save
    node tests/m3check.mjs           # title card, look hint, sketchbook and its sketches, a view found
    node tests/lockcheck.mjs         # pointer lock and the drag-to-look fallback
    node tests/audiocheck.mjs        # the sound, measured: every situation rendered through the game's
                                     # own audio graph and checked for level, clipping, DC, clicks

Every browser run fails on any console error, failed request, or request to another server.
For looking, not passing: `node tests/tour.mjs --bodies earth` (every biome and view of a body
at 960x540, fair weather held, contact sheet in `docs/lead/evidence/tour-<body>.jpg`) and
`node tests/weather.mjs` (the storm, the blizzard, the dust storm and the storm sea, in
`docs/lead/evidence/weather.jpg`). Both are slow in software rendering.

## Layout

    index.html, src/main.js      boot
    src/core/                    simulation (pure), presenter, providers, stubs
    src/player/, src/ship/       explorer, cameras, flight (pure, unit-tested)
    src/ui/                      the painted interface: HUD, map, sketchbook; paper, ink and hand
                                 lettering made in code (paint.js, lettering.js, theme.css)
    src/audio/                   all sound, made in code
    src/data/bodies.js           physical data per body
    src/render, src/world, src/art   the painted pipeline, worlds and models (Painter)
    src/physics                  physical models (Physics)
    vendor/three                 Three.js r187, pinned
    docs/                        brief, coordinator notes, each role's notes and screenshots
