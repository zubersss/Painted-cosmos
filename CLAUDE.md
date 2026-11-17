# Painted Cosmos: start here

This game is worked on by Claude sessions from two accounts, one at a time. Nothing from an
earlier chat carries over; the state of the work is in this repository.

At the start of every session, before anything else:

1. `git fetch origin && git checkout r2` (the working branch; `main` is the live game and only
   changes through pull requests the owner asks to merge).
2. Read `docs/HANDOVER.md` in full, then the last three sections of `docs/COORDINATOR.md`.
3. Act as the project's coordinator as the handover describes. If the owner just says
   "continue", do what section 3 of the handover says is next.

Always:

- Only one session works at a time. Before you stop, or when usage runs low, commit and push
  everything and update section 3 ("State right now") of `docs/HANDOVER.md`.
- Log every new instruction from the owner in `docs/COORDINATOR.md` and in section 2 of
  `docs/HANDOVER.md`, so the next session (on either account) knows it.
- Merge into `main` only when the owner asks in that session.
- Never use or look for the owner's other projects, past chats or memories.

---

# What a new session needs to know about the code

(Added 2026-11-16 at the owner's request, so that a session need not read the whole codebase.
The rules above come first. This part is a map; the state of the work is always in
`docs/HANDOVER.md` section 3.)

## What the game is made with

- **3D, drawn with Three.js** (release r187, WebGL 2), kept in `vendor/three/`. No other
  library. The whole solar system is real 3D: planets are spheres you walk on, fly over and leave.
- **Plain JavaScript modules, no build step, no packages to install.** `index.html` loads
  `src/main.js` through an import map; nothing is fetched from the network once loaded.
- The picture is made by the game's own shaders (GLSL written inside the JavaScript files),
  not by Three.js' stock materials: every surface is painted by `src/render/materials.js`.
- The interface (prompts, map, sketchbook, touch buttons) is plain HTML and CSS over the canvas.
- Sound is made in code with the Web Audio API. Saves go to the browser's local storage.

## How to run and check it

    node tools/serve.mjs 8080          # then open http://127.0.0.1:8080/
    node --test tests/*.test.mjs       # the game's unit tests (262)
    node --test src/world/*.test.mjs   # the world and painter tests (47)
    node --test src/physics/           # the physics tests (342)
    node tests/all.mjs --export        # everything, on a clean copy of the last commit: 17 steps,
                                       # about an hour, scripted play-throughs in a headless browser

- Useful addresses: `/?body=mars&time=14` (where and when to start), `/?quality=2` (top
  tier), `/gallery.html?body=earth&biome=autumn_woodland&time=15.4` (the painter's gallery: a
  free camera over any world; it loads in seconds where the game takes minutes). The full list
  of parameters is at the top of `src/main.js` and `src/art/gallery.js`.
- **The new look** (live on `main` since 2026-11-16): add `look=oil` to any address. Without it
  the game is exactly the watercolour game.
- **The elemental powers** (live on `main` since 2026-11-17, wind only): add `powers=1`. Without
  it nothing of the powers is loaded. `bench=1` (with `look=oil`) is the speed test for a real
  device: it leaves a table on the screen to be photographed.
- **In a cloud session there is no graphics card.** The browser draws in software: the first
  picture after a page loads takes 4 to 10 minutes (shaders compiling), each one after that 10
  to 60 seconds. Run ONE browser at a time. A background process is stopped after two hours.
  Speed on a real graphics card, and how anything looks in motion, cannot be judged there: only
  the owner's own device can.
- `tools/lab.mjs` (on `look-proto`) keeps one headless page open and takes stills from it; its
  header says how.

## Branches

| Branch | What it is |
| --- | --- |
| `main` | The live game (GitHub Pages serves it). Changes only through pull requests the owner asks to merge. |
| `r2` | Where a session starts. The logs, the handover, the references' notes; also half-done "release 2" work as WIP snapshots (not finished, not verified). |
| `look-proto` | Where the look's next change is made ready for a pull request: `main` plus whatever is waiting (see the handover). |
| `powers` | Where the elemental powers were built; merged into `main` on 2026-11-17 and kept for their further work. |
| `cosmos` | Frozen copy of release 1. Do not work on it. |

## How the code is laid out

Four "roles" own the folders (the split is enforced by `tools/commit.sh`):

| Folder | Role | What is in it |
| --- | --- | --- |
| `src/core/` | PILOT | The game itself. `game.js` (the frame loop's top), `sim.js` (the big state of play: walking, boarding, flying, landing), `state.js` (the states and their prompts), `input.js` / `touch.js` / `gamepad.js`, `save.js`, `orbits.js` (where the planets are), `dynres.js` (steps quality down when frames are slow), `providers.js` (swaps real modules for simple stand-ins in `stubs/` for tests), `powers.js` (the elemental powers, the player's side: the hands, the aim, the abilities; loaded only with `?powers=1`), `bench.js` (the speed test), `build.js` (the version shown on the screen: change it and `build.txt` with every pull request). |
| `src/player/` | PILOT | `explorer.js` (how the figure moves; on `look-proto` also the flight), `camera.js`, `figure.js` (what the figure's model is told to do). |
| `src/ship/` | PILOT | `flight.js` (the ship), `pulse.js` (travel between worlds). |
| `src/ui/` | PILOT | `hud.js` (prompts, gauges, touch buttons, help), `map.js`, `book.js` (the sketchbook), `theme.css`, `powers.js` (the powers' touch button, its list of words, the aim's ring). |
| `src/audio/` | PILOT | `audio.js`: every sound, made in code. |
| `src/render/` | PAINTER | How things are drawn. `materials.js` (every surface's shader: ground, water, plants, figures), `chunks.js` (shader pieces they share: light, air, strokes), `post.js` (the passes after the scene), `shared.js` (uniforms and switches every material shares), `index.js` (the painter: one frame), `texgen.js` (textures made at start-up). On `look-proto` also `shadow.js` (cast shadows) and `dabtex.js` (the leaf dabs laid once). |
| `src/world/` | PAINTER | The planets. `surface.js` (the shape and colours of the land at any point), `terrain.js` / `patchgen.js` / `cubesphere.js` (the ground's mesh), `flora.js` (which plants are drawn where and at what detail), `florakit.js` (the plants' shapes), `floraplace.js` (where plants stand), `sky.js`, `orbit.js` (worlds seen from space), `index.js` (the world's own frame: light, weather, air). |
| `src/art/` | PAINTER | `models.js` (the explorer and the ship, built in code), `gallery.js` (the gallery page). |
| `src/data/` | PAINTER / PILOT | `bodies.js` (the planets' sizes and orbits), `looks/<world>.js` (each world's colours, plants and places: pure data), `looks.js` (gathers them), `mode.js` (the switches that data and play code read: the oil look, the powers), `felled.js` (the trees the wind knife has felled: shared by the play code, the saved game and the world). |
| `src/physics/` | PHYSICS | Wind, weather, water, the explorer's body, the ship's body, plants bending. Self-contained, with its own tests beside each file. `powers.js`: the wind the explorer makes, a short list of shapes of moving air that the air, the plants, the loose things and the rain all ask. |
| `tests/` | PILOT | Unit tests (`*.test.mjs`) and scripted browser runs (`playthrough.mjs`, `trip.mjs`, `touch.mjs`, `stations.mjs` for sharpness and flicker, `all.mjs` runs everything). |
| `tools/` | COORDINATOR | `serve.mjs`, `commit.sh`, `export-head.sh`, `lab.mjs`. |
| `docs/` | | `HANDOVER.md` (start here), `COORDINATOR.md` (the log of every instruction and decision), `POWERS.md` (the elemental powers: the design for all four, wind as built, what is not built), `references/README.md` (what the owner's reference pictures show and what is taken from each), `notes/painter.md`, `pilot.md`, `physics.md` (each role's working notes), `lead/` (plans and reviews). |

## The new look in one paragraph (branch `look-proto`)

`?look=oil` paints the same worlds in opaque paint with brush strokes laid on the surfaces
themselves, after the owner's reference clip. It is a compile-time switch: `LOOK.oil` in
`src/render/shared.js` sets the define `PC_OIL` in every painted material, and everything of
the look sits behind `#ifdef PC_OIL`, `LOOK.oil` or `MODE.oil`, so the watercolour game is
untouched without the flag. The file-by-file account, what the owner has decided about it, and
what is still wrong are in `docs/notes/painter.md` on that branch ("Hand-over of THE OIL
LOOK"). Read that before touching the look.

## The elemental powers in one paragraph

`?powers=1` gives the explorer the wind: seven abilities (gust, gather, quicken, still, whirl,
part water, knife), cast where the view looks. The player's wind is a short list of plain shapes
of moving air (`src/physics/powers.js`) handed to the systems that already took the dust devils'
wind, so the world's own leaves, dust, spray, plants and cloak answer it; nothing is drawn for
every pixel. It is seen as white strokes of air laid by the falling leaves' own painter. Without
the flag no module of the powers is loaded. Water, earth and fire are only described
(`docs/POWERS.md`): the owner said not to start their code. Anything the owner will touch on the
phone is pressed here with real touch events before it is called seen (a still made by calling
the code proves the picture, not the hand).

## Conventions

- **Commits:** `[painter]`, `[pilot]`, `[physics]` or `[coordinator]` first, then what was done
  and what was SEEN or measured. The session's own instructions say which attribution lines end
  a commit message; no model names anywhere else (not in code, not in pull requests).
- **Say only what is true of the work:** "built" is not "seen". Nothing about the picture is
  called done until it has been looked at in a still; the log says which of the two it is.
- **The live game must not change by accident:** anything new goes behind a switch, and the
  three test suites above must pass before a push.
- **The repository is public:** other people's pictures and video are never committed; what a
  reference shows is written down in `docs/references/README.md`. The owner's email address
  and other personal details go nowhere.
- **Shaders:** they are text inside JavaScript template strings: no backtick in a shader
  comment; a function must be defined above its first use; a mistake shows only when a browser
  compiles it, so render after every shader change. Never take a screen derivative (`dFdx`) of
  a planet-sized coordinate such as `vBody`: use the eye-relative ones (`vRel`, `vRelO`).
- **The look's own rules** (owner's instructions, `docs/HANDOVER.md` section 2): no blur and no
  grain; strokes small, with no outlines; colours that pop without losing detail; the desktop
  sets the look and the phone follows with cheaper settings.
- **Plain words.** The owner is not a programmer: explain in plain language, say plainly when
  something is not good or not known, and tell them when something is needed from them. Give
  them links as plain addresses on their own lines (they read on a phone).
- **A result is read only from this run's own files.** A log left by an earlier run of the same
  name has been read as today's once (2026-11-17): check a log's time and its own last line.
- **The build machine draws in software and has been wrong twice about why the phone is slow.**
  For speed on a device, ask the device (`bench=1`); for script time this machine is a fair
  stand-in.
