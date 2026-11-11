# Painted Cosmos

A calm exploration game for desktop browsers: walk, use the jetpack, board your ship, climb
through the atmosphere into space with no loading screen, and land again. Every frame is meant
to look like a watercolour landscape on cold-press paper.

Status: milestone 1 (vertical slice). See `docs/notes/` for what is done and what is not.

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
| E | land when the prompt shows; step out when landed |
| V | cockpit / chase view |

The ship hovers when you let go, levels itself, and will not let you crash.

## URL parameters

| Parameter | Meaning |
| --- | --- |
| `stub=1` | run on Pilot's grey stub world and plain renderer (also `stub=render,world,art`) |
| `real=1` | try Painter's modules even if they are not flagged ready (also `real=world`, ...) |
| `body=mars` `time=18` | start on another body, at another local hour |
| `dynres=0` `scale=0.75` `quality=1` | pin the dynamic resolution controller |
| `pointerlock=0` | never capture the pointer; drag to look |

## Checks

    node --test tests/*.test.mjs     # pure logic: orbits, frames, state machine, explorer,
                                     # cameras, flight, landing, dynamic resolution, the loop
    node tests/playthrough.mjs       # the whole loop in headless Chromium with real key and
                                     # mouse events; fails on any console error

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
