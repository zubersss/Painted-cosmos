# Painted Cosmos

A calm exploration game for desktop browsers: walk, use the jetpack, board your ship, climb
through the atmosphere into space with no loading screen, and land again. Every frame is meant
to look like a watercolour landscape on cold-press paper.

Status: milestone 2 (the system: fly between worlds). See `docs/notes/` and `docs/lead/TRACK.md`
for what is done and what is not.

## Play

Open `index.html` from any static host (it is plain ES modules, no build step, no network
requests). Locally:

    node tools/serve.mjs 8080      # then open http://127.0.0.1:8080/

## Controls

On foot

| Key | Action |
| --- | --- |
| W A S D | walk |
| Shift | run |
| Space | jump; hold to fire the jetpack (it refills on the ground) |
| Mouse | look (click the picture to capture the pointer; or hold the left button and drag) |
| Mouse wheel | camera closer / farther |
| V | first person / third person |
| E | board the ship when you are next to it |

In the ship

| Key | Action |
| --- | --- |
| Space | lift off; in flight: rise |
| C | sink (settle onto the ground to land) |
| W / S | throttle up / down (it stays where you leave it) |
| A / D | turn |
| Mouse | point the nose |
| X | brake |
| F | pulse drive (in space): point at a world's marker and press F; F again drops out |
| M | the map: click a world, or use the arrow keys, to set a course; M or Enter closes it |
| E | land when the prompt shows; step out when landed |
| V | cockpit / chase view |

The ship hovers when you let go, levels itself, rides above the tree tops, and will not let
you crash. The pulse drive brakes by itself and lets go in front of the world ahead.

Anywhere

| Key | Action |
| --- | --- |
| ` (backquote) | frame read-out: frame time, triangles, draw calls, render scale, quality tier |

The game saves itself when you land, when you step out, and every 20 seconds on foot, and
continues from there on the next visit. Add `?fresh=1` to the address to start again on Earth.

If the browser will not capture the mouse (or reports nonsense while it does), the game says so
and you look around by holding the left button and dragging.

## Is it fast enough on my machine?

Press the backquote key (or open the page with `?stats=1`). The read-out shows the frame time in
milliseconds (16.7 is 60 frames a second), the worst recent frame, how many triangles and draw
calls the scene needs, the render scale the game has settled on (1.00 is full resolution) and
the quality tier (2 high, 0 low). If the frame time sits above 17 ms with the scale at 0.50 and
the tier at 0, the machine cannot hold 60 frames a second in that view.

## URL parameters

| Parameter | Meaning |
| --- | --- |
| `stub=1` | run on Pilot's grey stub world and plain renderer (also `stub=render,world,art`) |
| `real=1` | try Painter's modules even if they are not flagged ready (also `real=world`, ...) |
| `body=mars` `time=18` | start on another body, at another local hour |
| `dynres=0` `scale=0.75` `quality=1` | pin the dynamic resolution controller |
| `pointerlock=0` | never capture the pointer; drag to look |
| `stats=1` | show the frame read-out from the start |
| `fresh=1` / `save=0` | forget the saved game / never save |
| `stub=physics` | turn the physical models off (the explorer and ship then move by simple rules) |

## Checks

    node --test tests/*.test.mjs     # pure logic: orbits, frames, state machine, explorer,
                                     # cameras, flight, landing, pulse drive, save, the loop,
                                     # the Earth-Mars-Saturn trip, and the same through PHYSICS
    node --test src/physics/         # the physical models (PHYSICS)
    node --test src/world/*.test.mjs # terrain and biomes (Painter)
    node tests/playthrough.mjs       # the M1 loop in headless Chromium with real key and
                                     # mouse events; fails on any console error
    node tests/trip.mjs              # Earth to Mars to Saturn in one sitting, then a reload
                                     # that continues from the save
    node tests/lockcheck.mjs         # the pointer-lock fallback

## Layout

    index.html, src/main.js      boot
    src/core/                    simulation (pure), presenter, providers, stubs
    src/player/, src/ship/       explorer, cameras, flight (pure, unit-tested)
    src/ui/                      HUD
    src/data/bodies.js           physical data per body
    src/render, src/world, src/art   the painted pipeline, worlds and models (Painter)
    src/physics                  physical models (Physics)
    vendor/three                 Three.js r187, pinned
    docs/                        brief, coordinator notes, each role's notes and screenshots
