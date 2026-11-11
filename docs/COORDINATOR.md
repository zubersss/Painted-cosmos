# COORDINATOR NOTES (the shared memory)

Owner: the coordinator. PAINTER and PILOT read this; they do not edit it. To change anything
here, write the request in your notes file and report it; the coordinator records the outcome.

## A. How this build is set up (and why)

- **Mode: parallel subagents in one session, one shared branch.** No GitHub repository for
  this game was attached when the session began, so the brief's fallback applied: the roles run
  as subagents sharing one branch and one working tree.
- **UPDATE 2026-11-11: there are now THREE workers.** The owner asked for a third role,
  **PHYSICS**, devoted to how everything moves (section F below). This replaces the brief's
  "exactly two". PAINTER and PILOT keep their ownership and milestones unchanged.
- **Repository:** `/home/user/painted-cosmos`. Shared work branch: **`cosmos`**. `main` holds the
  bootstrap commit and receives the finished game at M4.
  **UPDATE 2026-11-10: a remote now exists**, `origin` = `https://github.com/zubersss/painted-cosmos`
  (the owner created it for this game). `tools/commit.sh` now pushes `cosmos` after every commit,
  so keep using it exactly as before and commit often; nothing else changes. Both roles stay on
  the one shared branch in the one working tree. At M4, Pilot opens the one pull request
  `cosmos` -> `main` (the owner has given permission to merge it).
- **All roles work in the same working tree.** You see each other's files the moment they are
  saved, including half-written ones. Rules that keep this safe:
  1. Commit with `tools/commit.sh painter "msg"`, `tools/commit.sh pilot "msg"` or
     `tools/commit.sh physics "msg"`. It stages and
     commits only your own paths. Never `git add -A`, `git add .`, `git commit -a`, `git stash`,
     `git reset --hard`, `git checkout -- <path>`, `git clean`, rebase, or amend.
  2. Never create, edit, move, or delete a file outside your ownership list, not even to fix an
     obvious bug. Write it in your notes ("Needs from the other") and work around it.
  3. The sync loop here is: commit; read the other's notes file; answer in yours; run their
     latest work with yours. To test against the other role's last *committed* state instead of
     a file they are in the middle of editing: `tools/export-head.sh <dir>` then
     `node tools/shot.mjs /index.html out.jpg --root <dir>`.
  4. Scratch files (trial screenshots, logs, experiments) go in your own scratch directory
     outside the repo, never in the repo: `/home/user/.pc-scratch/painter/` or
     `/home/user/.pc-scratch/pilot/`, `/home/user/.pc-scratch/physics/`.
  5. Do not start further agents or threads. Only the owner adds workers.
- **Extra ownership (not named in the brief):**
  PILOT also owns `/docs/lead/**` (section G), `/.nojekyll`, `/.gitignore`, `/package.json` (dev only, if wanted),
  `/docs/shots/pilot/**`. PAINTER also owns `/docs/shots/painter/**`.
  PHYSICS owns `/src/physics/**`, `/physics-lab.html`, `/docs/notes/physics.md`,
  `/docs/shots/physics/**`.
  The coordinator owns `/docs/BRIEF.md`, `/docs/COORDINATOR.md`, `/tools/**`.
- **Bootstrap done by the coordinator (one time, so neither role waits):**
  `vendor/three/` (Three.js r187, pinned: `three.module.js` + `three.core.js` + LICENSE; owned
  by PILOT from now on), `src/data/bodies.js` (seed values; owned by PILOT from now on),
  `.nojekyll`, `.gitignore`, `tools/`.
- **Three.js import convention:** bare specifier through an import map, identical in
  `index.html` and `gallery.html`:
  `<script type="importmap">{"imports":{"three":"./vendor/three/three.module.js"}}</script>`
  then `import * as THREE from 'three'`. Keep pure logic (noise, biome selection, orbital math,
  state machine, save) in modules that do not import `three`, so Node can unit-test them
  directly. The unminified r187 source for reference (not in the repo):
  `/tmp/claude-0/-home-user/645a0309-74d1-52b7-8168-956c427ce528/scratchpad/npm/package/`
  (`build/`, `src/`, `examples/jsm/`).

## B. Tools (verified working in this sandbox)

- `node tools/shot.mjs <page?query> <out.png|out.jpg> [--w 960 --h 540] [--ready "expr"]
  [--wait ms] [--eval "js"] [--shots N --every ms] [--root dir] [--shot-timeout ms]`: headless Chromium (Playwright,
  pre-installed; do not install another) with software WebGL2, own static server on a free port,
  prints console errors, page errors, failed and external requests, exits 1 if any.
  It waits for `window.__pcReady === true` by default: **both pages set `window.__pcReady = true`
  once a complete frame has been painted** (shaders compiled, first terrain LOD settled).
  For longer scripted play-throughs, import `openPage` and `GL_ARGS` from `tools/shot.mjs` in
  your own Playwright script.
- Measured in this sandbox: WebGL2 yes, `EXT_clip_control` yes (reversed depth active),
  float and half-float render targets yes, 8 draw buffers, max texture 8192.
  Software GL is slow: use 960x540 or smaller for checks and close browsers when done. There are
  4 CPU cores shared by both roles. **Frame-rate on a real GPU cannot be measured here**; report
  GPU-cost reasoning and software timings as such, never as a verified 60 fps.
- `node tools/serve.mjs 8080`: plain static server for manual runs.
- Evidence screenshots worth keeping go in `docs/shots/<role>/` as `.jpg`, at most about 12
  files per role in total, overwritten in place as the work improves (stable file names such as
  `earth-forest-noon.jpg`). The other role and the coordinator study these.

## C. Contract clarifications (coordinator defaults)

These fill gaps in section 4 so that code written in parallel fits on first contact. All are
additive or clarifying. The domain owner may overrule one by writing it in their notes
(look: Painter; feel, performance, architecture: Pilot); the coordinator then updates this file.

1. **Units and frames.** 1 unit = 1 metre. Each body root's local frame has +Y as the north
   pole. `unitDir` (argument) and `normal` (result) of `sampleSurface` are in **body-local**
   space. `radius` is the distance in metres from the body centre to the **solid ground** along
   `unitDir`. `slope` is the angle in radians between `normal` and `unitDir`. `biomeWeights` is
   `{ biomeId: weight }` summing to 1; `biomeId` is the heaviest.
   Additive field: `liquidRadius` (radius of the liquid surface along `unitDir`, or 0 when there
   is none); `isLiquid` is true when `liquidRadius > radius`. Pilot uses these for wading.
2. **`sampleSurface` is a pure, deterministic function** of `(bodyId, unitDir)`. It works for
   every body at any time (not only the active one), agrees with the rendered terrain at its
   finest LOD, and is cheap enough for about 30 calls per frame.
3. **Floating origin.** Pilot keeps the camera near the scene origin and sets every body
   root's `position` and `quaternion` each frame (orbit and spin). Painter never assumes a body
   sits at the origin. Anything "anchored in world space" (wash variation, stroke texture) must
   be anchored in **body-local** coordinates, otherwise it swims when the origin shifts or the
   planet spins.
4. **The sun.** Additive: `world.sun` is an `Object3D` created by Painter (the painted sun) and
   positioned by Pilot each frame, like a body root. Painter derives the light direction for
   each body from `world.sun.position - bodyRoot.position`. Pilot adds no lights to the scene.
5. **Time of day.** In the game, day and night come from the body's real spin (Pilot rotates the
   root), so Pilot normally does not call `setTime`. `setTime(bodyId, hours)` forces the local
   solar time at the camera for that body (for the gallery and for tests); `setTime(bodyId, null)`
   releases it. `setMood.timeOfDay` is the local solar time in hours at the camera on the active
   body, 0-24: 6 sunrise, 12 noon, 18 sunset. All other `setMood` numbers are 0-1.
6. **Per-frame call order (Pilot):** position `world.sun` and body roots, update the camera;
   `world.update(dt, camera.position, activeBodyId)` with `camera.position` in scene coordinates
   and `activeBodyId` the dominant body (or null in deep space); `painter.setMood(...)`;
   `painter.render(scene, camera, dt)`.
7. **Renderer and depth.** Pilot creates the `WebGLRenderer` and the camera. Additive: Painter
   exports `RENDERER_OPTIONS` from `src/render/index.js` and Pilot spreads it into the
   constructor. Starting value:
   `{ antialias: false, alpha: false, powerPreference: 'high-performance',
      reversedDepthBuffer: true, logarithmicDepthBuffer: true }`.
   In r187 this uses reversed-Z when `EXT_clip_control` exists and falls back to a logarithmic
   depth buffer when it does not. Therefore: every custom `ShaderMaterial` includes Three's
   `logdepthbuf_*` chunks (they compile to nothing when unused); render targets that carry depth
   use a 32-bit float depth texture; and Painter's post passes never read the hardware depth
   buffer, they read a linear view depth that Painter's own scene pass writes. Pilot sets camera
   `near`/`far` (it may vary them with altitude) and Painter's renderer works with whatever it
   is given. Depth strategy is Pilot's call; if Pilot changes it, the note goes in Pilot's
   Decisions first.
8. **Resolution.** `painter.resize(w, h)` takes the output drawing-buffer size in physical
   pixels; Painter sizes the renderer and its targets. Additive:
   `painter.setRenderScale(s)` (about 0.5 to 1) scales the internal scene resolution only; the
   paper composite always runs at output resolution so the grain stays crisp and fixed to the
   screen. Pilot's dynamic-resolution controller drives `setRenderScale` and `setQuality`
   (0 low, 1 medium, 2 high).
9. **Foreign objects.** `painter.render` must cope with any `Object3D` in the scene, including
   ones with built-in Three materials (Pilot's stub sphere, markers, debug shapes), and paint
   them acceptably rather than crash or leave holes. Additive: Painter exports a small material
   factory (for example `makeWashMaterial({ color, ... })`) for Pilot's incidental 3D objects.
10. **Models.** Explorer: about 1.8 m tall, origin at the feet, facing -Z, +Y up. Ship: about
    9 m long, origin at the centre of the landing-gear contact plane, nose toward -Z, +Y up;
    `object3D.userData.seat` (local eye position of the pilot) and `object3D.userData.hatch`
    (local point where the explorer boards). Pilot adds them to the scene and places them.
    `animate(state, dt)` ignores unknown fields and defaults missing ones. Starting shapes:
    explorer `{ mode: 'idle'|'walk'|'jet'|'fall'|'wade'|'sit', speed, jet01, lookPitch }`;
    ship `{ mode: 'landed'|'hover'|'fly'|'pulse', throttle01, gear01, canopy01 }`.
11. **Spawn and vistas.** Additive: `world.getSpawn(bodyId) -> { unitDir }` returns a good first
    landing spot (for earth: a clearing by the stream in the temperate forest, with room for the
    ship). Painter paints the in-world vista markers; Pilot does detection, HUD, and sketchbook.
    Additive: `world.setVistaFound(bodyId, vistaId, found)` so a found vista can look different.
12. **UI theme.** Pilot links `./src/art/ui.css` from `index.html` and calls Painter's theme
    installer once it exists. Class prefix `pc-`; starting set: `pc-panel`, `pc-button`,
    `pc-title`, `pc-label`, `pc-icon`, `pc-hud`. Until the theme exists Pilot styles the same
    class names with a plain fallback of its own under `src/ui/`. How hand-lettered text is
    produced (a stroke font drawn in code, since no external fonts or assets are allowed) is
    Painter's design; settle the text helper's signature in notes before M3.
13. **Debug hooks for headless checks.** `gallery.html` takes URL parameters for deterministic
    frames (suggested: `?body=earth&biome=<id>&time=12&quality=1&cam=<preset>`). `index.html`
    takes `?stub=1` (force stubs) and exposes a small `window.__pc` debug object (state, teleport,
    time control) for scripted play-throughs.

## D. Reporting

Each role works one milestone at a time and ends its run with a report to the coordinator:
what is done and how it was verified (name the screenshot files), what is not done or not
verified, needs for the other role, contract changes, and the next step. The coordinator relays,
records outcomes below, and resumes the role at once. A role that finishes early does not wait:
it goes on to the next milestone's work.

## F. The third role: PHYSICS (added by the owner on 2026-11-11)

The owner's words: "Make 1 more agent that focuses on the physics of the game from the wind the
grass trees sand how you interact with them how they move displace around you and around each
other just focusing on the physics aspect from acceleration of the ship to running try to get
the physics to be as realistic as possible with the weather as well from how rain behaves to
storms and snow and weather on the other planets hyperfocus on making the physics for this
agent's role".

**Division of labour.** PHYSICS decides how things move: the physical models and their
constants (forces, masses, drag, friction, stiffness, fall speeds, wind and weather behaviour).
PILOT still decides how input becomes commands, the assist layer (auto-level, landing assist,
cushioning), the cameras, the state machine, the frame budget, and the architecture. PAINTER
still decides how every bit of it is drawn. PHYSICS never draws game visuals and never edits
another role's files: it ships models, fields, and buffers; PILOT and PAINTER wire them into
their own files.

**Tie-breaks (extends section 5 of the brief).** Look: Painter. Control feel, performance,
architecture: Pilot. Physical behaviour: Physics. Where a realistic model would make the player
fight the controls, keep the realistic model and add or strengthen an assist on top of it,
rather than faking the physics underneath. Still stuck after one exchange: the coordinator.

**C14. Physics contract (starting shape; PHYSICS owns the final API and documents it at the top
of `docs/notes/physics.md`).** Everything in `src/physics/**` is pure logic with no `three` and
no DOM, on the same plain `{x,y,z}` vectors as `src/core/vec.js`, in **body-local** coordinates,
metres and seconds, deterministic for a given seed and time, allocation-free in hot loops.
- `src/physics/index.js`: `createPhysics({ sampleSurface, seed }) -> physics`.
  `physics.update(dt, frame)` once per frame, called by Pilot (and by Painter in the gallery),
  with `frame = { bodyId, time, focus (body-local point the simulation centres on), sunDir,
  disturbers: [{ kind: 'explorer'|'ship'|'jet'|'downwash', p, v, radius, strength }] }`.
  `physics.setQuality(0|1|2)`.
- Environment queries (cheap, callable many times per frame):
  `physics.air(bodyId, p) -> { density, wind: {x,y,z}, gust01, temperature }`,
  `physics.weather(bodyId, p) -> { kind, intensity01, precipitation, wetness01, snowDepth,
  visibility01, lightning }`,
  `physics.ground(bodyId, unitDir) -> { material, friction, restitution, sink, drag }`.
- Dynamics models for Pilot's controllers (pure step functions in the style of
  `stepExplorer` / `stepFlight`): explorer body (traction, acceleration, slopes, wading, wind
  load, jetpack) and ship body (thrust, drag, gravity, hover, landing gear, turbulence, pulse
  acceleration). Pilot calls them from `src/player` and `src/ship` and keeps its assists on top.
- Fields and buffers for Painter (typed arrays; Painter wraps them in textures and attributes):
  a wind-and-disturbance field around `focus` for flora, with a GLSL chunk (exported as a
  string) that bends a plant from that field so the shader and the CPU model agree; a ground
  deformation field (footprints, trails, landing marks, drifts); particle buffers per kind
  (rain, snow, dust, sand, ash, spores, leaves, spray) with positions, velocities, sizes, ages.
- Additive hook: `world.setPhysics(physics)` (Painter implements, Pilot calls once after
  creating both), so the world reads the fields in `world.update`.
- Budget: all of physics within about 2 ms of CPU per frame at quality 1 on a laptop; Pilot
  polices it.
- Tests live next to the code (`src/physics/**/*.test.mjs`, run with
  `node --test src/physics/`); Pilot adds that command to "every check".
- Timing: PAINTER and PILOT finish M1 as planned and start wiring physics in during M2.

## G. Lead developer: PILOT (added by the owner on 2026-11-11)

The owner's words: "Make pilot also a lead developer that keeps check of the work of the others
and makes sure we're on the right track and double checks stuff to make sure it looks good and
works well using reference for games that already do exist that have good physics and weather
and everything my game would need, if a lead doesn't exist already". No lead existed (the
coordinator is a switchboard and tie-breaker, not a reviewer of the work), so PILOT is now also
the LEAD DEVELOPER. PILOT's own role and milestones are unchanged.

**The lead's files** (owned by PILOT): `/docs/lead/**`.
- `docs/lead/REFERENCES.md`: what good looks like. For each system the game needs (on-foot
  movement, jetpack, ship flight and landing, ground-to-space transition, wind in foliage, plants
  parting around the player, sand and snow deformation, rain, storms, snow, weather transitions,
  other-planet weather, water, day and night, stable painterly rendering, minimal HUD, ambience),
  one to three existing games widely held to do it well, the specific observable behaviours that
  make it good (timings, magnitudes, what the player sees and feels), and a concrete acceptance
  check for our game derived from each.
- `docs/lead/REVIEW.md`: dated reviews per role, each finding with its evidence (a screenshot
  file, a test, a measurement) and the reference check it fails, sorted into MUST FIX (blocks
  the milestone), SHOULD FIX, and GOOD (keep).
- `docs/lead/TRACK.md`: the path to the brief's "Done means", as a checklist with status, how
  each item was verified and by whom, risks, and what is off track.

**Rules.**
1. References are for behaviour and technique only. Nothing from any existing game is copied:
   no names, characters, ships, art, music, levels, UI, or look. The look is judged against the
   art bible (a watercolor painting), never against another game's style.
2. The lead verifies; it does not take anyone's word. It re-runs the other roles' tests, opens
   their pages (`gallery.html`, `physics-lab.html`) headless, studies their evidence shots, and
   plays the integrated build.
3. The lead never edits another role's files. It says what is wrong and why, with evidence; the
   owner of the domain decides how to fix it. Tie-breaks are unchanged (look: Painter; physical
   behaviour: Physics; control feel, performance, architecture: Pilot). A disagreement gets one
   exchange in notes, then the coordinator decides.
4. PAINTER and PHYSICS read `docs/lead/REVIEW.md` and `REFERENCES.md` at every sync and answer
   each MUST FIX in their own notes ("fixed in <commit>" or "disagree, because ...").
5. A role's milestone is done only when the lead's MUST FIX list for it is empty or the
   coordinator has waived an item.
6. The lead's own domain (controls, flight, UI, audio, integration) is reviewed by the other two
   in their notes and by the coordinator at each milestone.

## E. Settled outcomes (log)

- 2026-11-10: bootstrap as described in A. Branch for both roles: `cosmos`.
- 2026-11-10: the owner created `zubersss/painted-cosmos`; attached as `origin`; `main` and `cosmos`
  pushed; `tools/commit.sh` pushes after each commit. The two roles keep sharing one branch
  (they were already mid-work in one tree; splitting now would only add merge work).
  GitHub Pages is to be served from `main` after the M4 merge.
- 2026-11-10: the owner switched GitHub Pages on, serving `main` at the root. It shows nothing
  playable until the M4 merge. Address: `https://zubersss.github.io/Painted-cosmos/`.
- 2026-11-11: the owner added a third worker, PHYSICS (section F). Ownership: `src/physics/**`,
  `physics-lab.html`, its notes and shots. Tie-break added: physical behaviour goes to Physics;
  realism is kept and made forgiving with assists, not faked. Same branch, same tree, same rules.
- 2026-11-11: the owner made PILOT the lead developer as well (section G): reference benchmarks
  from existing games, verified reviews of the other roles, a track sheet, milestone sign-off.
- 2026-11-11: **M1, PILOT's half: met** (walk, jetpack, board, lift off to space, land, step out;
  70 unit tests; scripted play-through passes on the stubs and inside PAINTER's forest with no
  console errors). **PAINTER's half: open**, three MUST FIX in `docs/lead/REVIEW.md` review 1.
  The coordinator looked at the frames itself and upholds all three (see next lines).
- 2026-11-11: **Frame budget (PILOT's call, performance; upheld):** in the densest view at most
  600 k triangles and 350 draw calls at quality 1, 300 k at quality 0, 1.2 M at quality 2;
  `world.update` at most 5 ms a frame, `physics.update` at most 2 ms a frame, both as a worst
  frame, not an average. Measured by PILOT's frame-cost probe.
- 2026-11-11: **Look findings upheld by the coordinator** (PAINTER decides how): crowns must be
  a few washes, not specks; trunks and the brook bank must not be ruler-straight; trees must not
  stand in rows; distance bands inside the wood must fade lighter and cooler; space grain must
  not read as black pepper.
- 2026-11-11: additive contract changes, all in use: `spaceAltitude(body)` and `soiRadius(body)`
  exported from `src/data/bodies.js` (Moon and Pluto: 420 m); terrain stays below
  `radius + 0.8 * spaceAltitude(body)`; `setMood.biomeId` (the heaviest biome); `world.busy`
  (pending build jobs; readiness), `world.setBuildBudget(ms)`, `world.getLighting()`,
  `world.sampleObstacles` (trunks and boulders as cylinders).
  Requested, not yet delivered: canopy height under a point (PAINTER -> PILOT, for the ship's
  cushion); the table of which PILOT constants each PHYSICS constant replaces (PHYSICS -> PILOT).
- 2026-11-11: `tools/shot.mjs` has `--shot-timeout ms` (default 180000) and reports a failed
  screenshot as a problem instead of dying.
- 2026-11-11: debug query parameters in the game (PILOT): `stub=1`, `dynres=0`, `scale=`,
  `quality=`, `pointerlock=0` (drag to look; use it in every headless run).
- 2026-11-11: **PHYSICS stage P1 accepted** (`b0ad22b`; the coordinator re-ran
  `node --test src/physics/`: 125 pass). INTEGRATION: ready. Wiring steps for PILOT and PAINTER
  and the replacement tables are in `docs/notes/physics.md`. `physics.warmUp()` is called while
  loading; `physics.stats.msMax` polices the 2 ms worst-frame budget.
- 2026-11-11: **Ruling on reference checks that contradict real physics** (R-FOOT-1, -3, -4, -5,
  R-JET-1, R-SHIP-2, R-PART-4 as answered in the PHYSICS notes). Physical behaviour is
  PHYSICS's call and the owner asked for realism, so the model stays. The lead rewrites each
  such check in `REFERENCES.md` as either the real behaviour (sand shortens braking and costs
  top speed; a jet wash reaches the ground from 40 m) or a named assist target that PILOT
  meets with PHYSICS's assist forces (`assistAccel`, `carve01`, `descentLimit`, `jetMaxRise`,
  `airControl`, `setWindScale`). Feel is PILOT's call: PILOT chooses the assist levels.
  Hard limits that stay whatever the physics says: the player is never trapped, never knocked
  off their feet for good, and the ship is never uncontrollable (no fail state, brief section 1).
- 2026-11-11: additive contract: `sampleSurface` results may carry `canopy01` (closed-canopy
  fraction at that point, 0 in a glade) and `canopyHeight` (m). PAINTER provides them; PHYSICS
  (wind shelter) and PILOT (ship cushion) read them. Plants carry a height and a stiffness per
  kit for the flora chunk (`uPlantHeight`, `uStiff`).
- 2026-11-11: **PAINTER reports M1 with the three MUST FIX answered** (`b2bfcae`, notes at
  `6a31de3`): by its own probe 496 to 543 k triangles and 287 to 307 draw calls at quality 1
  (was 4.23 M and 699); crowns as a few washes; leaning, broken trunks and a wandering bank;
  trees in clumps; `canopy01` / `canopyHeight` on `sampleSurface`; `FLORA_PHYS` (plant height
  and stiffness per kit) exported from `src/world/florakit.js`. The coordinator looked at the
  new frames and agrees the three are fixed as far as still frames show. **M1 closes when the
  lead's review 2 confirms the cost with its own probe in the integrated game.** PAINTER starts
  M2 meanwhile (nobody waits).
- 2026-11-11: look is judged at 960x540 or more with quality 1 or higher; cost is measured at
  whatever size is fastest (PAINTER's request, upheld: at 150x84 internal pixels no painting
  survives).
- 2026-11-11: M2 order for PAINTER (coordinator): mars and saturn first (the M2 trip is earth,
  mars, saturn), then the other five planets, then the remaining earth biomes; the frame budget
  holds on every planet. Real explorer and ship models: first item of M3 at the latest.
  Evidence shots for M2: up to 45 for PAINTER, 960x540 jpg.
- 2026-11-11: **M1 is met.** Lead review 2 (`bc425a4`) closed PAINTER's three MUST FIX with its
  own measurements in the integrated game: 564 k triangles and 334 draw calls standing at the
  spawn at quality 1 (was 4.36 M and 887), 289 k at quality 0, 708 k at quality 2; brushed
  crowns and wandering trunks and bank at 960x540. PILOT's half was met earlier; PHYSICS P1
  accepted. Open SHOULD FIX carried into M2/M3: `world.update` worst frames 4 to 12 ms (budget
  5), shade as dark green instead of a cool glaze, flat foreground meadow, far trunks in a line.
- 2026-11-11: M2 so far: PILOT has pulse drive, markers, planet map, save, physics wiring,
  canopy-aware cushion, pointer-lock fallback and a frame read-out (` key or `?stats=1`);
  PAINTER has data-driven biomes, liquids and flora kits for every body; PHYSICS has loose
  particles, dust devils, giants' storm tracks, ground marks and wind waves (151 tests).
- 2026-11-11: **the container restarted once.** The working tree survived; the coordinator
  snapshotted every role's uncommitted files (`61c8104`, `ee4c336`, `e292f19`) and resumed the
  three agents. Background processes (servers, running tests) do not survive a restart: after
  one, check `git status` and `git log`, re-run whatever was in flight, and keep committing often.
- 2026-11-11: **PAINTER reports M2, first pass** (`a7d553b`): all eight planets with 4+ biomes
  driven from `looks.js`, liquids per biome, tall kits (fungus, crystal, reeds, spire, kelp,
  frozen wave), Saturn's rings as geometry, cloud decks and limb haze from orbit, PHYSICS's
  flora field wired (`?physics=1` in the gallery), violet shade glaze. Its own probe puts every
  body inside the budget at quality 1 (355 k to 567 k triangles). `sampleObstacles` returns
  everything within a radius clamped to 60 m, unsorted. Proposed for M3: `painter.setMarks(...)`.
- 2026-11-11: **Coordinator finding on that pass (the coordinator looked at all 41 frames):**
  the palettes differ, the landscapes mostly do not. Many biomes are the same rolling plain
  with scattered rocks and do not show the feature the brief names (no canyon, dunes, craters,
  terraces, mesas, sea cliffs, snow peaks, sinkholes; lava and acid not visible). Tall kits
  (crystals, spires, frozen waves, kelp) show facets and continuous ink outlines and read as
  low-poly, against the art bible ("not low-poly", "no visible facets", silhouettes never
  ruler-straight). **PAINTER's M2 is not accepted yet: a second pass on landforms and on
  faceted kits comes before M3.** How is PAINTER's call; that each biome shows its named
  feature is the brief's requirement and the coordinator holds it.
- 2026-11-11: **PHYSICS stage P2 accepted** (`0f56a40`; the coordinator re-ran the tests: 158
  pass). Every world has its own weather with a lab preset (`physics-lab.html?planet=...`); all
  particle kinds filled (ballistic in vacuum); ground rims, filled prints, pad prints, scour;
  canopy wakes and crown coupling; wind waves with `physics.water` (GLSL + JS twin); lava and
  cloud-froth liquids; `cmd.brake`; lift-off on the gear; every biome id mapped, with a test.
  Shader against JS: max 2.5 mm on a 2 m tip. Worst reproducible frame 0.29 to 0.51 ms.
  Default seed is now 18 (a thunderstorm crosses the Earth spawn at 10:40 to 13:20).
- 2026-11-11: rulings on PHYSICS's questions. (1) Ground words: `ochre_basins` stays dust and
  `nitrogen_dunes` stays snow (physical behaviour is PHYSICS's call). (2) Cloud seas carry the
  explorer as a light froth, so nobody is stranded (no fail state); PAINTER and PILOT may ask
  for a different depth, not for sinking. (3) `fog01`, `dust01`, `haze01` and
  `precipitation.intensity01` changed meaning in P2; read the notes before using them.
- 2026-11-11: **Division of labour for drawing the physics** (coordinator; PAINTER is the
  bottleneck and nothing of the weather is in the picture yet). PHYSICS builds optional draw
  kits under `src/physics/three/`: three.js geometry, attribute layout and per-frame updates
  for rain, snow, loose particles, ground marks and the water surface, each taking a material
  factory. PAINTER supplies the materials (its wash chunks, its MRT outputs), decides the look,
  adds the objects under the body roots in `world.update`, and may replace any kit with its own.
  The pure core of `src/physics` stays three-free; only `src/physics/three/` imports three.
- 2026-11-11: **PILOT's M2 accepted** (`f9f5ab2`; the coordinator re-ran
  `node --test tests/*.test.mjs`: 92 pass). Pulse drive with self-braking, targets, markers,
  planet map (M), save, frame read-out (` key or `?stats=1`), pointer-lock fallback; PHYSICS
  fully wired (bodies, gear, lift-off, brake, friction sites, default seed 18); ship rides above
  the canopy; 39 of 40 landings on ten bodies (one honest refusal at a Jupiter ledge); the
  earth, mars, saturn trip passes in the painted worlds at 960x540 quality 1 (459 km in 70.7 s,
  888 km in 94.9 s) with a reload that continues from the save. New query parameters:
  `?stats`, `?fresh`, `?save`, `?stub=physics`.
  **M2 as a whole closes when PAINTER's second pass lands and the lead's review 4 has no MUST
  FIX**; landings and the trip are re-run after that pass.
- 2026-11-11: PILOT's conditions for PHYSICS's draw kits (architecture, upheld): the pure core
  stays three-free; body-local placement; at most 60 k triangles and 12 draw calls for all kits
  together; draw order is PAINTER's.
- 2026-11-11: **M4 tooling found.** `gh` GraphQL commands (`gh pr create`, `gh pr list`) are
  blocked in this sandbox, but the REST API works and the session has push and admin rights:
  open the pull request with `gh api repos/zubersss/painted-cosmos/pulls -f title=... -f
  head=cosmos -f base=main -f body=...` and merge it with `gh api -X PUT
  repos/zubersss/painted-cosmos/pulls/<n>/merge -f merge_method=merge`. Only at M4, only once.
- 2026-11-11: **PAINTER's M2 second pass came back incomplete** (`0291097`): by its own count 17
  of 33 biome frames show their named feature, 11 partly, 5 not at all (`saturn-gold_islands`,
  `mercury-shadow_craters`, `jupiter-hanging_gardens`, `neptune-ice_spires`,
  `earth-desert_canyon`). Not re-probed for cost; `world.busy` fix untested; orbit frames not
  opened. The coordinator's own look agrees and adds: ground strokes smear into long radial
  streaks near the camera on several bodies, and Mars' frost cracks read as hexagonal tiles.
- 2026-11-11: **PAINTER agent replaced, same role.** The first PAINTER agent reported that it
  was at the limit of its working context and asked for a fresh run. A fresh PAINTER agent takes
  over the role with the same ownership and rules, starting from `docs/BRIEF.md` (sections 6 and
  7 are now stored there too), this file, `docs/notes/painter.md` and the code. Still three
  workers; the old PAINTER agent is retired and must not be resumed.
- 2026-11-11: PAINTER's material contract for PHYSICS's draw kits is in `docs/notes/painter.md`
  (two opaque targets, `pcWrite`, PAINTER's chunks, a vertex chunk giving `pcKitPosition()`).
- 2026-11-11: **PHYSICS stage P3 accepted** (`ea6efdc`; the coordinator re-ran the tests: 175
  pass). Draw kits under `src/physics/three/` fit PAINTER's material contract (a vertex chunk
  with `pcKitPosition()` and two varyings per kind, opaque with `discard`; at most 12 draw
  calls and 31 k triangles with every buffer full; `kits.update(bodyRoot, camera, heightPx)`).
  Rain shelter and drips, a sea that no longer tiles from the air, a wake field. Worst
  reproducible `physics.update` frame 0.38 to 0.92 ms. The integrated game was played in the
  browser on Earth, Mars and Neptune (seven findings in its notes). Not done: a branch rate in
  trees; shader agreement inside PAINTER's `PROP_VERT`; kits with PAINTER's real chunks.
  Water uniforms changed type to vec4 (groups and wakes added); nothing had wired them.
- 2026-11-11: **P4 plan (coordinator):** so that PHYSICS does not wait for PAINTER, it proves
  the kits, the flora chunk and the water chunk inside the real painted pipeline in its own
  lab, using only PAINTER's public exports (`createPainter`, `createWorld`, `makeWashMaterial`,
  `RENDERER_OPTIONS`), and hands PAINTER a material factory that is known to work, with frames.
  How rain is drawn (a thin streak in an opaque pass will alias and crawl) is PAINTER's
  decision; PHYSICS prototypes the options there and shows them. PAINTER's first M3 item is
  wiring the kits (weather in the picture), then the real explorer and ship.
- 2026-11-11: **PHYSICS stage P4 accepted as reported** (`c5f8088`, 175 tests). The lab runs
  inside the real painted pipeline (`physics-lab.html?painted=1`, source
  `src/physics/three/painted-lab.js`, public exports only) with a reference
  `makeKitMaterial(kind, info)` that works with PAINTER's chunks, both targets and the post
  pass. Honest verdicts on its six painted frames: rain reads (as broad strokes) and footprints
  read; snow, the Mars dust storm and Neptune's sea fail; grass parting unjudged. Measured: the
  post pass erases marks under about 3 internal pixels, so thin or stippled rain only adds
  shimmer; **broad strokes are the only rain that is there**. Storm kit cost 0.1 to 0.2 ms,
  4 to 5 draw calls, 3.2 k triangles. Not done: agreement inside `PROP_VERT`, branch rate, drifts.
- 2026-11-11: **Finding (PHYSICS, upheld by the coordinator after looking at the frames): kits
  alone cannot paint weather.** A storm with a sunny sky is not a storm. PAINTER's sky, haze,
  sheet, ground wash and liquid material must read `physics.here.weather` and the wave chunk.
  Six gaps in PAINTER's contract are listed in `docs/notes/physics.md` (uniform constructor for
  `FRAG_PARS`, chunks re-exported from `index.js`, a way to glaze instead of bringing ink, the
  3 px floor of the post pass, the wave chunk on PAINTER's liquid, weather in sky and haze).
  This is PAINTER's first M3 block: weather in the picture.
- 2026-11-11: **PHYSICS stage P5, first step** (`a4214d6`; the coordinator re-ran the tests: 178
  pass): `src/physics/sky.js`, `physics.here.sky` and `physics.sky(weather?, out?)`: eleven
  numbers from 0 to 1 that a painter needs (`cloud`, `overcast`, `haze`, `fog`, `dust`, `wet`,
  `snow`, `rain`, `snowfall`, `storm`, `flash`), continuous in time (only `flash` moves more
  than 0.1 in a second). PAINTER reads these instead of `physics.here.weather`; PILOT may pass
  them through `setMood` as an additive field. The rest of P5 is not done.
- 2026-11-11: **PHYSICS agent replaced, same role.** The first PHYSICS agent reported that it
  was at the limit of its working context and asked to be replaced; its notes open with a
  hand-over section. A fresh PHYSICS agent takes over with the same ownership and rules. Still
  three workers; the old PHYSICS agent is retired and must not be resumed.
- 2026-11-11: PAINTER now exports `makePaintUniforms` and the scene chunks publicly for kits
  built outside its tree (`ebd9b4d`): gaps 1 and 2 of PHYSICS's list.
- 2026-11-11: **PILOT's M3 half is in place** (`08cc1f1`; the coordinator re-ran
  `node --test tests/*.test.mjs`: 93 pass): vistas found within 14 m with a chime and a save,
  sketchbook (B), procedural audio (wind, rain, thunder on its delay, ship, jetpack, footsteps,
  a pad per planet, UI sounds; `?audio=0`), title and help card (H), read-outs on paper slips,
  a look hint, start at tier 1 and scale 0.75 and climb, per-world flight pace from air
  density, `setMood.sky` (PHYSICS's eleven numbers), `tests/m3check.mjs`, and `tests/tour.mjs`
  (every biome of every body in the integrated game at 960x540, quality 1; sheets in
  `docs/lead/evidence/tour-<body>.jpg`; one body per process). Not verified: nobody has heard
  the audio; most tour frames were "(unsettled)" because `world.busy` did not reach 0; painted
  browser runs not repeated after M3; HUD and markers still the fallback look.
- 2026-11-11: **PILOT agent replaced, same role (lead duty included).** The first PILOT agent
  reported that it was at the limit of its working context; `docs/notes/pilot.md` opens with a
  handover and the lead files stand alone. A fresh PILOT takes over with the same ownership
  and rules. Still three workers; the old PILOT agent is retired and must not be resumed.
  All three roles are now on their second agent.
- 2026-11-11: **PHYSICS stage P5, items 1 to 3 accepted** (`5acf86a`; the coordinator re-ran the
  tests: 191 pass). (1) Every particle carries `mat` and every mark its material (index into
  `physics.data.MATERIAL_IDS`, 15 names), passed to kits as `vPcMat`. (2) The sea for PAINTER's
  liquid: `physics.glsl.water` gives height, slope, crest direction, `crest01`, `foam01`, surf
  and the normal through `uPhysWaterSea`; JS twin `physics.fields.water.sample(p)`; chunk
  against twin 0.06 mm in GL; the patch kit is off by default. (3) Kits survive the post pass:
  size floor in PAINTER's internal pixels with thinning that keeps cover, snow shown in a 9 m
  cell round the eye, dust sized from the dust in the air; `kits.update` takes
  `painter.info.internalHeight`. Painted-lab verdicts by PHYSICS, shared by the coordinator:
  snow reads as a flurry on a sunny meadow and dust as a dry-brush band under a clear sky;
  **neither is a storm until PAINTER's sky, haze and ground read `setMood.sky`.** Not done:
  silhouette agreement test in `PROP_VERT`, branch rate in trees, drifts, crawl of the snow cell.
- 2026-11-11: PHYSICS's integration order for PAINTER (its notes, "For PAINTER"): section E
  (sky, haze, ground wash read `setMood.sky`), section D (wave chunk in the liquid material),
  section C (lift `makeKitMaterial`, a 16-colour palette per biome indexed by `vPcMat`), then
  grass blades visible near the eye (the push field is live; the meadow shows no blades to
  part). Also asked: a region id the post pass keeps crisp (splash rings are erased).
- 2026-11-11: **The second PHYSICS agent also reached its context limit after one stage and is
  replaced by a third in the same role.** Fresh agents are told to budget their reading.
- 2026-11-11: **Ruling: the painted UI theme moves to PILOT** (the coordinator; PAINTER is the
  critical path and carries M2, weather in the picture, the real models, space and the art
  pass). PILOT builds the theme under `src/ui/**` to art-bible rule 8, all generated in code:
  torn-paper panels, ink-and-wash icons, hand-lettered type, painted planet markers, cursor,
  loading. Look stays PAINTER's call: PAINTER reviews the theme and PILOT changes what it asks.
  `src/art/ui.css` and `painter.setMarks` are no longer owed by PAINTER (it may still offer
  them). Palette and paper constants come from PAINTER's public data (`src/data/looks.js`).
- 2026-11-11: **PAINTER's M2, third pass (second PAINTER agent, `334eb16`): the coordinator lifts
  its finding.** The coordinator opened all eight contact sheets: the named landforms are there
  (Earth's snow massif over the alpine meadow, banded canyon with a butte, sea-cliff headland;
  Mars' strata; Jupiter's banded globe with the Great Red Spot, vine curtains, a table island in
  the cloud sea; Saturn's islands in cloud with the ring arc; Mercury's crater bowl; Venus'
  terraces, lava and fogged mesas; Uranus' teal pool; Neptune's stacks), the radial ground
  streaks and hex-tile cracks are gone, and the frames read as watercolours. PAINTER's own
  count: 28 of 33 yes, 5 partly (`mars-dry_riverbeds`, `jupiter-lightning_plains`,
  `uranus-ice_shelves`, `uranus-frozen_waves`, `neptune-aurora_tundra`; three of those wait
  for weather and sky effects). Its probe: every planet inside the budget at quality 0, 1 and 2
  (Earth's wetland at the edge at quality 0); `world.busy` tested reaching 0; 19 world tests.
  Still weak, for the M3 art pass: bare foregrounds, flat facets on Mercury's crystals and
  Neptune's kelp, grey-green distant cliffs on warm planets, hard cast shadows in the autumn
  wood in the game, the toy explorer and ship.
  **M2 closes when the lead's review 4 (in the game: cost, landings, trip, tour) has no MUST FIX.**
- 2026-11-11: additive contract from that pass: `world.findBiome(bodyId, biomeId)` returns
  `{ unitDir, yaw, pitch }` (the stand: where to arrive in a biome); the first vista of each
  biome carries `yaw` and `pitch`; `world.sampleObstacles(..., soft)` can list bushes; spawns
  moved on every body except Earth (Jupiter spawns on a sky-island); when the smoothed frame
  time is above 80 ms `world.update` may take up to 30 % of the frame for building (4 ms at
  real frame rates).
- 2026-11-11: **the second PAINTER agent reported being past two thirds of its capacity and is
  replaced by a third in the same role** (stopped by the coordinator so that two PAINTERs never
  write at once). M3 for PAINTER starts with weather in the picture.
- 2026-11-11: **PHYSICS stage P6 accepted** (third PHYSICS agent, `b146000`; the coordinator
  re-ran the tests: 208 pass; PILOT's 102 pass on it). (1) Crawl measured mark by mark at 60 Hz
  and removed: blizzard pops 11.7 a second to 0, dust-storm billows 7.6 to 0, rain strokes
  vanishing whole 85.8 to 0.8; particles carry `left` and fade; snow lives in its own 8 m box
  round the eye (`frame.eye` in `physics.update`). (2) Two real bugs fixed: particles were
  published on the tangent plane of the frame's anchor (rain ended up to 18 m above the ground
  380 m from where a session began), and weather entered over the sea bed (no rain over deep
  water). (3) Branch sway (`pcPhysBranch`, no new texture) and drifts (`physics.fields.drift`:
  snow and sand gather in the lee and in hollows, scoured from windward faces). (4) The game
  played on six worlds: the bodies obey the models; what is physically off is in the assists
  (one turn rate of 42 deg/s on every world, cruise speeds bunched, feet never leaving the
  ground, every jetpack fall ending at 7 m/s, an empty first second of throttle). Five optional
  one-line levers for PILOT are in its notes (`eye`, `carveAccel`, `speedScale` with `brake`,
  `assistAccel` by gravity, `softFallSpeed` 4). Worst frame 0.36 to 1.01 ms. Not done: the
  silhouette test in `PROP_VERT`; flake tumble and dust-tuft shape.
- 2026-11-11: the third PHYSICS agent has about a quarter of its context left. **The PHYSICS
  role pauses until PAINTER's weather block is reported**; a fresh PHYSICS agent then tunes the
  marks, waves, branches and drifts against the painted picture and re-flies PILOT's levers.
- 2026-11-11: coordinator's recommendation on the levers (feel is PILOT's call): take them. The
  brief gives every planet its own "gravity feel" and the owner asked for realism; today every
  world but Venus flies and walks the same.
- 2026-11-11: **Weather is in the picture: PAINTER's M3 block 1 accepted** (third PAINTER agent,
  `9d9caf1`, notes `b243609`). The coordinator opened the storm, blizzard, dust-storm and gale
  frames (`docs/shots/painter/wx-*.jpg`): sky, haze, light and sheet follow the sky numbers in
  each world's own pigment; ground and flora take wet and fresh snow; the liquid takes PHYSICS's
  wave chunk; PHYSICS's kits are drawn with PAINTER's materials; near grass leans away from the
  explorer (one clump) and lies over under the ship's wash. Cost with weather on stays inside
  the budget (551 k triangles, 301 calls in the storm at the Earth spawn; kits 5 calls, 3.4 k).
  The blizzard frame is the best of them. Open: rain is opaque pale sticks that cross (no
  glaze); grass is sparse tufts, not a sward; lightning never seen; branches, drifts and the
  instanced kits not wired; crawl of the kits through the post pass not measured; granulation
  in dark washes (storm skies, dark sea, space) still reads as black pepper at 960x540.
- 2026-11-11: additive contract from that block: `world.setPhysics(physics, opts?)` builds and
  draws PHYSICS's kits itself (**PILOT must not create kits**; `{ kits: false }` turns them
  off; `world.kits` has the counts); `world.setWeather(sky | null)` forces the sky numbers;
  `world.setFreshSnow(x)`; the world reads `physics.here.sky` directly (`setMood.sky` still
  supplies `flash`); region ids 6 (small crisp marks) and 7 (things in the air);
  `src/render/kitmat.js`.
- 2026-11-11: **Ruling on snow** (PAINTER asked). Upheld as PAINTER draws it: only fresh snow is
  laid over the painted ground (it gathers while snow falls and melts after), never more than
  PHYSICS's cover. Standing snow belongs to the terrain PAINTER has already painted. PHYSICS is
  asked to split its number: a fresh-snow cover from recent snowfall, separate from standing
  cover, and to keep standing cover consistent with the painted ground of each biome (a green
  alpine meadow in fair weather is not under standing snow). Also asked of PHYSICS: falling
  rain or snow implies a closed sky in the sky numbers (the blizzard had `cloud` 0.46).
- 2026-11-11: the third PAINTER agent is at about 85 to 90 % of its context and is replaced by
  a fourth; the PHYSICS role resumes with a fourth agent to tune against the picture.
- 2026-11-11: **Lead review 4 (second PILOT agent, `99bce4a`)**, run in the game on a clean
  export of PAINTER's `334eb16`: 114 tour frames over ten bodies at 960x540, quality 1, every
  frame settled (`world.busy` 0 in 0.1 to 58 s), no console errors; 27 of 33 biomes show the
  brief's landform clearly, 6 partly, none missing; cost inside the budget on every body
  (Neptune's kelp 359 k, was 727 k) except one view; contract test 8 of 8 (39 of 40 landings,
  one spoken refusal; the trip); landing survey 235 of 240 from a hover; the painted trip passes
  47 checks (459 km in 69 s, 887 km in 94.9 s, reload from the save). One MUST FIX for PAINTER:
  the vista `earth-temperate_forest-1` submits 645 k triangles and 352 draw calls at quality 1
  (budget 600 k / 350). The coordinator re-ran PILOT's tests (102 pass) and opened the Jupiter
  tour sheet and the theme frames.
- 2026-11-11: **M2 is closed.** The coordinator waives the one MUST FIX as a gate for M2 (a
  7.5 % overrun in one view) and **carries it into M3 as a MUST FIX**: with weather, the real
  models and the near-ground layer in, the densest view of every body must be inside 600 k
  triangles and 350 draw calls at quality 1, measured by the lead in the game. Also MUST in M3
  (lead): the pepper in dark washes and space.
- 2026-11-11: `R-WX-1` reworded by the lead from measurements: sky numbers may move 8 %/s on
  Earth-like worlds and 15 %/s on the ice giants; PAINTER eases what it shows over 2 s or more.
- 2026-11-11: PILOT's block (second agent): painted UI theme first pass in `src/ui/` (generated
  paper with torn edges, a 76-glyph stroke font drawn in code, ink keycaps, icons, brushed ring
  markers, cursor, loading dabs; awaits PAINTER's look review; frames `docs/shots/pilot/ui-*.jpg`),
  sketchbook with a small sketch of the painted frame per landscape and view, touchdown on the
  legs, rain audio by `sky.rain` and shelter, footsteps by ground material, gamepad mapping,
  `tests/audiocheck.mjs` (22 situations, no clipping, peak -5.3 dBFS), all five PHYSICS levers,
  `__pc.flash(frames)`. Additive: `Sim.teleport({ heading, lookPitch, firstPerson })`,
  `getSpawn` may carry `yaw` / `pitch`, storage key `painted-cosmos.sketches`.
  The second PILOT agent is at its context limit and is replaced by a third.
- 2026-11-11: **PAINTER M3 block 2 (fourth agent, code `6bb6c91`, notes `afd9eef`)**. In: the
  real explorer and ship (`src/art/models.js`; one mesh and one draw call each, were 8 and 17;
  C10 kept; `userData.pcCaster` makes the world lay their shade), the near-ground stroke layer
  (`src/world/nearground.js`; one instanced draw call, at most 6400 strokes; trodden blades lie
  over and stay down, the ship's wash lays a disc), rain as a glaze (a blended pass after the
  abstraction pass, `GLAZES` in `src/render/shared.js`), soft settling instead of pits in dark
  washes (sheet pass), sky numbers eased with a 0.9 s time constant, `setBuildBudget(ms,
  { fixed: true })`, a look review of the UI theme in PAINTER's notes. Cost in the gallery at
  quality 1: Earth spawn 516 k / 280, forest easel 546 k / 299; in the game, third person at
  the spawn, 527 k / 285 (paid for by earlier tree hand-over, `TRIM` in `src/world/flora.js`).
  **Not re-measured in the game at the lead's vista**: the two MUST items (cost, pepper) stay
  open until the lead measures them. Not done: branch sway and drift wiring, lightning looked
  at, the lead's SHOULD FIX list.
  The coordinator opened `models-game`, `models-forest`, `wx-earth-storm` at full size and
  `models-cockpit`, `models-mars`, `models-poses`, `wx-jupiter-storm`, `wx-grass-part`,
  `wx-grass-wash` on a sheet. Verdict: the explorer, the ship and the cockpit read as painted
  things and are accepted; the rain glaze is accepted. **Coordinator finding (look, agrees
  with the lead's review 5 item 5)**: on Earth's lawn the near strokes are small dark
  hard-edged triangles, evenly spread: they read as teeth, the most digital thing in the
  frame. Wanted: brush flicks (curved, tapering, in loose tufts, most of them close to the
  ground's own value, a few darker accents), none on fresh snow.
- 2026-11-11: **Lead review 5 (third PILOT agent, `caa25f3`, at `62d3529`; not a gate)**:
  weather set of twelve frames in the game, cost at three tiers on every body
  (`tests/cost.mjs`), `tests/all.mjs` (every check, one table). Open MUST FIX: PAINTER two
  (cost: the forest vista 614 k at quality 1 and 306 k at quality 0, the storm at the spawn
  after dark 606 k; pepper, worst in Neptune's sky), PHYSICS one (storms bring no wind;
  PHYSICS reports it done in P7). PILOT's own: the camera in a thicket slides into the eyes,
  low boulders are walked over, README complete.
- 2026-11-11: the fourth PAINTER agent is at about 85 % of its context and is replaced by a
  fifth. **PAINTER's order for M3 block 3** (coordinator): (1) close the two MUST items at
  the lead's own measure (`node tests/cost.mjs --places "earth:vista:earth-temperate_forest-1"`,
  the storm after dark; pepper in Neptune's sky, in space and in a pulse frame); (2) day-night
  and space art pass, pulse streaks from `speed01` (the brief's M3 list); (3) the near strokes
  as brush flicks and none on snow, the white fringe in the lightning frame, puddles as soft
  pale sky; (4) as capacity allows, the rest of review 5's SHOULD FIX list, then branch sway
  and drifts. A repaint of the weakest biome per planet moves to M4's critique swap.
