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
- 2026-11-11: **Frame budget (PILOT's call, performance; upheld; the triangle and draw-call
  parts were ABOLISHED BY THE OWNER later the same day, see the end of this section):** in the densest view at most
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
- 2026-11-11: **PHYSICS P7 accepted (fourth agent, `62d061a`; code `7a3df85`, `6b047dc`,
  `e2e2d75`)**. The coordinator re-ran on a clean export of the head: `node --test
  src/physics/` 220 pass; `node --test tests/*.test.mjs` 105 pass on the second run (the first
  run had 2 failures with two other agents rendering: load-flaky, see below). In: rain in one
  direction per frame, short, sparse (37 strokes in view in a thunderstorm, was 106); snow
  flakes with their own aspect and slow turn; dust as low walls in a storm; a swell on open
  seas and `pcPhysWaterCrestLine` / `line01` for the bare-paper crest stroke; denser splash
  rings; grass parted about 2 m wide with a wake that closes in 30 s; a twelfth sky number
  `sky.fresh` (fresh snow at the focus, integrated as it falls; `physics.here` is the
  authority for `fresh` and `snow`); standing snow is the biome's `snowBase` only; rain or
  snow closes the sky; a gale has its own sky; stateless and stateful sky agree within 1 %
  except snow; **storms bring their own wind** (lead review 5, P1: storm 16 m/s at 10 m, dust
  storm 20, shower 6, rain 3, ice fall 4). The game re-flown in Node with PILOT's levers on
  six worlds (table in PHYSICS's notes, "For PILOT").
  **Not verified by anyone**: P7.3 and P7.4 (sky, snow, storm wind) have never run in a
  browser; nobody has walked or hovered through the windy storm in the game. PHYSICS itself
  calls the storm wind the riskiest change of its run (two tests relaxed: hull shelter 0.25 to
  0.5, powder count 3 to 2).
  Open from review 5: P2 (first storm falls in the dark), P3 (Neptune's `storm_seas` never
  storms by regime), P4 (dust in the forest air), P6 (33 m/s at two metres on Neptune's
  coast; walking downwind slower than upwind).
- 2026-11-11: **Rulings (PHYSICS asked).** (1) `R-WX-1`: Jupiter and Saturn count with the
  giants (15 %/s). On the rocky worlds 8 %/s stands with one point of tolerance, because
  PAINTER now eases what it shows with a 0.9 s time constant; Earth's 8.5 % passes. (2)
  Process: a commit whose message begins "WIP snapshot" is a backup made by the coordinator
  for the stop hook, possibly mid-edit. **The lead never reviews or tests a WIP snapshot**;
  it reviews the last commit a role made itself. (3) Review 5, P6 (a wind the player cannot
  walk in): PHYSICS owns the model, so PHYSICS gives the wind a boundary layer over rough
  ground (10 to 15 m/s at two metres under 40 m/s aloft is what a log profile over a boulder
  beach gives) and fixes downwind being slower than upwind, which is a fault in any model;
  PILOT then sets how much the suit cancels (feel). Inside a wood the canopy's shelter is
  real: the lead's 15 to 30 m/s gust check for thunderstorms (`R-STORM-5`) is measured in the
  open at 10 m, not under trees.
- 2026-11-11: findings relayed to PILOT from PHYSICS's re-fly: over the Moon's
  `crater_fields` the ship hovered at 4.1 m with sink held for 90 s and never landed; cruise
  on Mars and the Moon is 143 m/s with a 208 to 260 m turn radius and 131 to 248 m to stop;
  two of PILOT's unit tests fail now and then under load (`tests/physics.test.mjs:27` once in
  four for PHYSICS, two of 105 once in two for the coordinator).
- 2026-11-11: PHYSICS P7 addendum (`c11ca37`, answering PAINTER's block 2 asks): the rain
  share follows the rain rate (`share x (0.6 + sky.rain)`, 0.16 in a drizzle to 0.40 in a
  downpour; PAINTER drops its 1.6 multiplier); grass pressed flat to 0.6 m from the explorer
  and half at 0.85 m (`FLORA.flatReach` 0.25 m; one test threshold loosened for it); the
  ship's legs have not moved. Not run in a browser. The fourth PHYSICS agent is out of
  context and is replaced by a fifth. **PHYSICS's order for P8** (coordinator): (1) run P7.3,
  P7.4 and the addendum in the painted lab and in PILOT's `Sim`, open the frames, fix what
  is wrong; (2) review 5 P6: downwind slower than upwind, and a boundary layer over rough
  ground; (3) P2: the first storm crosses the spawn in daylight at about 150 to 400 s; (4)
  P3 and P4: Neptune's `storm_seas` storms most of the time, no dust in the forest air; (5)
  as capacity allows, the instanced kit path, flake crawl, the silhouette request; (6) a
  blunt critique of the other two domains for M4's swap.
- 2026-11-11: **Lead review 5 addendum and PILOT's block (third agent, `e583f67`)**, measured
  in the game on a clean export of `0de3fb4`. The coordinator re-ran PILOT's unit tests on a
  clean export of the head (105 pass) and opened `weather-recheck.jpg`, `space-recheck.jpg`
  and the four `ui-*.jpg` frames.
  **One MUST FIX is open for M3 (PAINTER)**: the vista `earth-temperate_forest-1` is at 611 k
  triangles / 339 draw calls at quality 1 (600 k / 350) and 304 k at quality 0 (300 k).
  **Closed by the lead**: pepper in dark washes and space (storm sky, Neptune's sky, night,
  space and pulse, looked at 1:1); the storm at the Earth spawn after dark (550 k / 300, was
  606 k); PHYSICS P1 (storms bring wind: walked and flown in the browser with real keys:
  3.5 to 4.0 m/s in every heading, a 2.5 s hop carried 4 m, the ship lands in 9 s).
  `node tests/all.mjs --export` on `d149255`: all 13 steps pass in 33 minutes, no console
  errors (unit 105, PHYSICS 222, PAINTER 19, the play-through 37 checks, the trip 47 checks).
  In from PILOT: `tests/weather.mjs`, `tests/cost.mjs`, `tests/all.mjs`; the read-out's
  `weather` line; a camera that slides into the explorer's eyes when the boom is squeezed
  under 2.3 m; obstacles up to 1.3 m are walked over (`scrambleSample`; a boulder's `height`
  in `sampleObstacles` decides), a suit wedged between two tall ones walks round one (Mars'
  spawn 170 to 179 m in every heading, was 5 m in one); the UI theme's second pass with
  PAINTER's six points (keys as wash dabs in pencil rings, brush-stroke buttons, dry-brush
  orbits on the map, the picture stepping back to paper behind an open map or sketchbook);
  the cockpit HUD moved so the dials show; boom 5.2 m; a stalled sink lands or says "Slow
  down to land"; thin-air worlds fly at about 78 m/s under 60 m; wall-clock assertions only
  with `PC_TIMING=1`; `R-WX-1` and `R-STORM-5` reworded; README complete; TRACK's "Done
  means" line by line; a critique of both other domains in PILOT's notes.
  Coordinator's look verdict: the menus are accepted (torn paper, hand lettering, nothing
  reads as a web page). The lightning frame's white specks and the green flicks on the
  snowfield are confirmed in the lead's sheet. Space reads as a wash but has no stars and a
  border of hard dark dots.
  **Not verified**: the tour has not been re-run since `ded1435` (before weather, models and
  the near layer); nobody has flown to all eight planets in one browser sitting; nothing has
  been judged in motion; the new UI frames are on stubs.
  Additive: URL parameters `kits=0`, `weather=fair`; `__pc.setClock(t)`,
  `__pc.info().weather`; `collideObstacles(st, list, r, { moving, dt })`;
  `Sim.cameraSolids`, `boomRoom`, `footCam.tight01`; HUD root class `pc-cockpit`.
- 2026-11-11: PHYSICS P8 so far (fifth agent, commits `d149255` to `de6ee88`, not yet
  reported): boundary layer over rough ground (14 m/s at 2 m under 40 m/s at 60 m on the
  boulder shore); the first storm crosses the Earth spawn at **160 to 320 s of play** (noon
  to half past two; every Earth weather time is 480 s earlier than before); Neptune's storm
  coast under a thunderstorm about 70 % of the time; no dust from wet ground; aerodynamic
  damping so trees do not whip in a gust front.
- 2026-11-11: the third PILOT agent is at its context limit and is replaced by a fourth.
  **PILOT's order** (coordinator): (1) own items: the weather set on PHYSICS's new storm
  times, all eight planets in one browser sitting, tests for the two new guards, the suit's
  share of the wind, a word on screen when thin air limits the ship; (2) lead review 6 when
  PAINTER and PHYSICS report (the MUST FIX, the tour, every check), which gates M3; (3) M4.
- 2026-11-11: **PHYSICS P8 accepted (fifth agent, `7944d45`)**. The coordinator re-ran on a
  clean export of the head: `node --test src/physics/` 226 pass, `node --test
  tests/*.test.mjs` 105 pass; and opened the four painted-lab frames on a sheet (the storm
  forest reads as driving rain; the blizzard is a white-out; Mars reads as a dust storm by
  haze alone, the dust walls as a few pale blots; the Neptune frame predates the lab's rain
  fix). In: aerodynamic damping so trees do not whip upwind in a gust front (`FLORA.aeroDamp`,
  was up to 104 deg/s, now 10); a boundary layer by ground roughness (under 40 m/s at 60 m:
  14 m/s at 2 m over a boulder shore, 22 over grass, 28 over flat ice, 6.6 under a canopy);
  "downwind slower than upwind" on Neptune's coast was a 4.5 m cliff, not the wind (a test
  holds downwind >= upwind on level ground); **Earth's weather clock starts 480 s in**
  (`REGIMES.earth.epoch`): at the spawn fair to 120 s, first drops 140 s, thunderstorm 160
  to 320 s (noon to half past two), clear from 340 s (for `tests/weather.mjs`: before 60,
  storm 240, flash 244, after 390); storms of a place's own making where a biome's moisture
  is over 1.2 (Neptune's storm coast under a thunderstorm about 70 % of the time); only dry
  ground gives dust; `cmd.shelter01` (0 to 1, default 0: the share of the wind force on the
  explorer that the suit cancels; PILOT's lever). Additive API; behaviour changed without a
  call changing: Earth weather times, wind near rough ground, tree damping.
  **Open, found by PHYSICS and not fixed**: (1) with PILOT's "obstacles up to 1.3 m are
  ground", the point body is launched off a boulder (pure body over a 1.3 m bump: Earth run
  1.4 m up, Mars run 2.3 m, Moon run 5.9 m and 5.1 s in the air); (2) five mechanism tests
  still run at Earth's old weather start and fail at the new one, not looked into; (3) the
  gust pattern races when the mean wind changes fast (up to 52 m/s2 in one frame at 30 m);
  (4) a 2.5 s hop is carried 25 m on Neptune's coast (the lead's aim is 15 m; `shelter01`
  is the lever). The fifth PHYSICS agent is out of context and is replaced by a sixth.
- 2026-11-11: **Ruling: boulders, legs and launches** (physical behaviour is PHYSICS's,
  feel is PILOT's; both asked for a decision). The explorer has legs: over any ground
  feature shorter than a leg and a half (about 1.3 m) a walking or running body stays in
  contact, its legs taking up the rise and fall, as a person's do; it leaves the ground only
  by a jump, the jetpack, or a drop it cannot step down. PHYSICS builds that into the body
  (a named part of the model, not a fudge). PILOT keeps "low boulders are ground", makes the
  explorer clamber over them at no more than a walking pace, and until the legs are in
  measures a run across the Moon's and Mars' boulder fields in the game and turns the
  walk-over off there if it launches the explorer. Measure of done, for the lead: a run
  across a boulder field on Earth, Mars and the Moon never lifts the feet more than 0.3 m
  off the ground without a jump.
- 2026-11-11: **PHYSICS's order for P9** (coordinator): (1) legs (the ruling above), tested
  on Earth, Mars and the Moon over PILOT's real ground profile; (2) the five tests at the
  old weather start: stale probe or real fault, each one; (3) the racing gust pattern; (4)
  as capacity allows: spray off the sea in a gale, softer dust walls for PAINTER, the
  instanced kit path, flake crawl; the Neptune lab frame re-shot and opened.
- 2026-11-11: **OWNER'S INSTRUCTION: no triangle budget; the best possible quality.** In the
  owner's words: "Why is there a budget for triangles get rid of that your making the best
  possible quality gamd use your limits and try to pass then". This overrides PILOT's frame
  budget and every ruling of mine that rests on it. From now on:
  1. **No count of triangles or draw calls is a gate, a MUST FIX or a reason to trim**, for
     the scene at any tier or for PHYSICS's draw kits (the 600 k / 350, 300 k, 1.2 M and
     12 calls / 60 k figures are void). The M3 MUST FIX on the Earth forest vista is
     withdrawn. `tests/cost.mjs` reports numbers and fails only on a console error.
  2. **Quality is the aim and each role pushes past what it thought was its limit.** The top
     quality tier is authored for the best picture with no cap, and it is the tier the look
     is judged at. Anything that was thinned, shortened or handed over early to pay for the
     budget is restored where the fuller version is the better painting (PAINTER's `TRIM` of
     tree tiers, the 6400-stroke cap of the near ground, the density and draw distance of
     flora and props, the fineness of terrain, the internal resolution), and then taken
     further. A saving that costs the picture nothing (not drawing what cannot be seen) stays.
  3. **The game starts at the best tier and at full resolution** and steps down by itself
     only when the measured frame rate asks for it (the tiers and dynamic resolution stay, as
     the brief's "perf tiers": they are how a weak machine still plays, and they now carry
     the brief's frame-rate line on their own). PILOT owns that controller.
  4. What stays, because it is smoothness and not a triangle count: `world.update` and
     `physics.update` are still measured as worst frames (5 ms and 2 ms at real frame rates)
     and reported; a role that needs more for a better result says so and takes it.
  5. The cost to us: software rendering here is slower with fuller scenes. Mechanics may be
     checked at a lower tier; the look is judged at the top tier.
- 2026-11-11: **PAINTER M3 block 3 accepted (fifth agent; `e56d65e`, `139be13`, notes
  `1c567a9`, last code inside the snapshot `626b086`)**. The coordinator re-ran the 19 world
  tests on a clean export of the head (pass) and opened `night-earth`, `space-pulse`,
  `flash`, `space-deep` (sheet) and `flicks-lawn` (full size). In: a far world that cannot
  be seen is not drawn and one a few pixels across is a single washed ball (the lead's forest
  vista 614 k / 341 to 537 k / 305 without touching the picture; kept, it costs nothing);
  dark and saturated washes settle soft, the border of a dark wash is ragged in broad pieces
  (no dotted rim); **night as its own painting** (deep indigo masses, reserved paper lights);
  **space in layered washes with spattered stars; pulse streaks** as soft drags laid as a
  glaze (switched by the ship model's `mode: 'pulse'`); lightning lifts the open sky to paper
  with no fringe in the crowns; **near strokes as tufts of curved flicks** close to the
  ground's value, none under fresh snow (`sky.fresh`); puddles soft and pale (faint);
  Neptune's sea darkens under a closed sky. After the owner's instruction `TRIM` was restored
  to `[1, 1]`. Additive: reads `speed01`, `inSpace01`, `sky.fresh`; a boulder's `height` in
  `sampleObstacles` is 0.58 of its scale (its drawn top; the largest is about 1.2 m); gallery
  `odist=`, `chase=1`, `speed01=`. Coordinator's verdict: night, space, the pulse and the
  lightning frame pass the freeze-frame test; the lawn no longer has teeth but is now quiet
  to the point of flat at the boom's distance.
  Not done: the owner's quality push; PHYSICS's five picture critiques; white horses on
  Neptune; dust in the air near the explorer; two vistas in a thicket; Mercury and Neptune
  from orbit; Mars' dune crests; branch sway and drifts; PILOT's UI second look. Known
  flaws: a far world between 8 and 10 px swaps from ball to terrain in one frame and one
  behind a closing sky vanishes at overcast 0.6 without a fade; the stored frames of dawn,
  dusk, blizzard and storm were opened one commit early. Nothing judged in motion.
  The fifth PAINTER agent is out of context and is replaced by a sixth.
- 2026-11-11: **M3 has no MUST FIX open** (cost withdrawn by the owner; pepper and the storm
  wind closed by the lead). M3 closes on lead review 6: the tour and every check on the
  head, judged at the top tier, after PAINTER's quality push and PHYSICS's legs.
- 2026-11-11: **PAINTER's order for block 4, "the quality push"** (the owner's instruction
  made concrete by the coordinator): at the top tier, (1) a sward that is a sward, full trees
  as far as they still read, denser flora and props where a biome is sparse, finer near
  terrain, a finer brush at full resolution; before and after frames, keep what is the
  better painting; (2) PHYSICS's picture critiques (the storm's ground loses its sun, the
  blizzard needs figure and ground, dust as a soft glaze, a swell line and white horses on
  Neptune); (3) the far-world pop and fade; (4) the lead's remaining SHOULD FIX list.
- 2026-11-11: **PHYSICS P9 accepted (sixth agent; `9667015` legs, `f6d0a29`, `9b708e2`)**.
  The coordinator re-ran on a clean export of the head: `node --test src/physics/` 230 pass,
  `node --test tests/*.test.mjs` 114 pass; no test is pinned to the old weather start.
  **The explorer has legs** (`src/physics/explorer.js`): the mass rides at the hips on legs
  that fold 0.45 m and reach 0.28 m and level the hips with a 0.12 s time constant; a
  feature under the 0.73 m stroke passes under at any speed; over a taller one the body is
  braced and clambers at the pace its hips can be raised and lowered; a face over 1.35 m met
  in one step is a wall; with no hold or a drop beyond 1.35 m the feet leave the ground as
  before; ground steps over 0.15 m are split so 20 Hz behaves like 60 Hz. Measured: the pure
  body over the 1.3 m bump stays down on Earth, Mars and the Moon (was 1.4 to 5.9 m in the
  air); through PILOT's own wrapper over 62 boulders at most 0.26 m off the ground on the
  Moon at 20 to 60 Hz (the old body flew 1.1 m at 30 Hz); in PILOT's `Sim` on the real
  ground at most 0.26 m (Moon), 0.03 m (Mars), 0 m (Earth). **The lead's measure (0.3 m) is
  met by the body alone**; the walk-over stays on everywhere and PILOT needs no clamber
  limit of its own. Behaviour changed without a call changing: a run through a dense boulder
  field is about 4.1 m/s on Earth, 2.75 on Mars, 1.9 on the Moon (was about 7); a step down
  of up to 0.73 m is taken in contact; a wall over 1.35 m stops the body. Additive:
  `EXPLORER_BODY` leg constants, `st.phys.hip`, `hipV`, `clamber01`, `grip`, `brace`.
  PILOT must keep `scrambleSample` as it is (radius raised, the normal that of the ground
  underneath). **The five tests at the old weather start were all stale probes; none hid a
  fault**; each now probes a place found on the game's clock. Not started: the racing gust
  pattern, spray, softer dust walls, leaves as thin marks, the Neptune lab frame, the
  instanced kit path; the cost of the legs in the body step is not profiled. The sixth
  PHYSICS agent is out of context and is replaced by a seventh.
- 2026-11-11: **PHYSICS's order for P10** (coordinator): (1) the racing gust pattern in the
  first storm; (2) the owner's quality push on what PHYSICS hands the picture, rendered in
  the painted lab and opened: dust as many soft walls, leaves as thin tumbling marks, spray
  off a gale sea, a blizzard that drives; (3) the cost of the legs; (4) the instanced kit
  path.
- 2026-11-11: **PILOT part 1 accepted (fourth agent, `1235328`)**. The coordinator re-ran
  PILOT's unit tests on a clean export of the head (114 pass) and opened the grand tour sheet
  and the new weather sheet. In:
  **All eight planets in one browser sitting** (`tests/grandtour.mjs`; clean export of
  `5e62268`, painted world at quality 0, scale 0.5, 400x225): from the title card with real
  keys and mouse the run walked, used the jetpack, boarded, lifted off, reached space and
  landed and walked on Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune and Earth
  again: 8 of 8 in 31.6 minutes (1659 s of play), no reload, no console error; record
  `docs/lead/evidence/grandtour.json`, frames `docs/shots/pilot/grandtour.jpg`. Found and
  fixed on the way: the pulse from Venus to Mars let go after three seconds because Mars lay
  through Venus; the screen now says "Venus is in the way: steer round it and pulse again".
  The Moon and Pluto were not flown.
  **The weather set on the new storm times** (clean export of `8d2905b`, quality 1): a
  player at the spawn sees a sunny wood until about 11:18, a slate cloud bank and first
  slanted rain at 11:54, the storm at 13:00, a clear warm afternoon over wet ground at 15:12.
  **The owner's instruction on PILOT's side**: the game starts at tier 2 and full
  resolution; `src/core/dynres.js` rewritten (under 30 fps it sheds load at once, a tier with
  it when the smallest picture could not reach 30; it climbs in single steps that back off;
  it is not fed frames while the first view loads); `?quality=N` now PINS the tier (not
  additive); `tests/cost.mjs` only reports; README, REVIEW, TRACK, REFERENCES carry
  "withdrawn" marks.
  Also: tests for the two guards (`tests/guards.test.mjs`); the suit holds off wind beyond
  12 m/s when off the ground (`cmd.shelter01`; a 2.5 s hop on Neptune's coast is carried
  8.6 m, was 298 m at a full burn; on the ground nothing is cancelled and a little wind shows
  in the pace: 4.50 / 4.20 / 3.59 m/s downwind / across / upwind); calm notice slips when
  thin air limits the ship; "Setting down on level ground 12 m away"; a trunk or boulder met
  dead on is stepped round after 0.12 s (a 25 s walk through the home forest stops 0.1 s at
  most in eight headings); `mood.pulse01`; `all.mjs` re-runs a failed unit file alone once;
  eight UI frames over the real painted world at the top tier (`docs/shots/pilot/ui-*.jpg`;
  the Earth spawn settled in 29 s at the top tier before PAINTER's push). With PHYSICS's
  legs the feet lift 0.18 m at most on the Moon in the pure simulation; PILOT's own clamber
  limit and walk-over switch are out again.
  **Not verified**: the full `tests/all.mjs` has not run since the legs, the new controller
  and PAINTER's block 3; the grand tour was not re-flown after later changes; the weather
  set is at quality 1, not the top tier; the Moon boulder run not seen in a browser; real
  hardware as always. The fourth PILOT agent has about a fifth of its context left and is
  replaced by a fifth.
- 2026-11-11: coordinator's look at the weather sheet: the storm's arrival, height, flash,
  clearing, and the night storm and night flash all read as watercolours; the blizzard now
  has figure and ground. Flaws for PAINTER: in `earth-arrives` a far world shows as an orange
  dot in front of the storm cloud; Neptune's sea stays flat blue beyond the shore.
- 2026-11-11: **PAINTER block 4, "the quality push", accepted (sixth agent; `573c10d`,
  `aeff8a6`, `f1a395e`, notes `23dea80`)**. The coordinator re-ran on a clean export of the
  head: 19 world tests and PILOT's 115 pass; and opened `push-spawn-before`,
  `push-spawn-after` and `push-vista-after` at full size. In, at the top tier on Earth: the
  ground in three rings to 240 m (tufts of flicks, flowers on stalks in drifts, grass gone to
  seed, fallen leaves, twigs, stones and moss to 17 m; fan-brush clumps, ferns and drifts of
  colour to 66 m; broad touches to 240 m: about 77 k marks, was 6400); full-detail trees to
  90 m (was 52), middle tier to 190 m, far tiers to 420 and 600 m, undergrowth to 110 m,
  twice the bushes; clearer forest air. The spawn frame went from 733 k triangles / 360 draw
  calls to 1.36 M / 465, the forest vista from 0.74 M to 1.40 M / 489 (information, not a
  limit). Moon and Mars made richer (289 k to 429 k; 423 k to 715 k). Weather picture: under
  a storm nothing is lit; the snowfield stands in a cool glaze under a blue-grey veil; dust,
  ash and sand are soft glazes; swell strokes and white horses on the far sea; far worlds
  thin away between 8 and 12 px and are veiled by cloud before they are left out. Additive:
  reads `mood.pulse01`; body uniform `uStorm`; looks gain `under.flowers`, `under.litter`,
  biome `near: { flower, fern, litter }`; `world._near.mesh` is a group of three meshes;
  nothing added to `sampleObstacles`.
  **Coordinator's verdict: the Earth spawn is a meadow now and the forest vista is the best
  frame this project has made** (brook, stones, reeds, poppies, a wood with a middle
  storey); both are plainly the better painting. Weak: near flicks pair into small "V"s; the
  handwriting changes at about 17 m.
  **Not verified in a frame**: the blizzard with flakes, PHYSICS's dust wall under the new
  glaze, Neptune's sea in its own hurricane, the far-world fixes (the orange dot); Venus,
  Mercury, the giants and Pluto carry the new code and nobody has opened them. Not started:
  the brush at full resolution, the two vistas in a thicket, Mercury and Neptune from orbit,
  Mars' dune crests, branch sway and drifts, the explorer's face, the UI look review.
  **Cost to our tooling**: in software rendering the top-tier forest vista took about 416 s
  to settle after a teleport (78 s before) and the title 153 s (87 s); building itself grew
  about 10 %. PILOT's tools need longer settle time-outs at the top tier.
  Tier lines for the README: tier 2 full resolution, full trees to 90 m, simpler to 600 m,
  undergrowth to 110 m, three rings of sward; tier 1 0.8 of the resolution, full trees to
  54 m, simpler to 360 m, two rings; tier 0 0.62 of the resolution, no full-detail trees,
  simpler to 170 m, one ring at half density, a four-sector brush, no pencil line.
  The sixth PAINTER agent is out of context and is replaced by a seventh.
- 2026-11-11: **PAINTER's order for block 5** (coordinator): (1) the same push on Venus,
  Mercury, Jupiter, Saturn, Uranus, Neptune and Pluto, each opened before and after at the
  top tier; (2) the weather picture verified in the game under PHYSICS's own weather
  (blizzard, dust storm, Neptune's hurricane, the far world behind the storm cloud); (3) the
  "V" pairs and the change of handwriting at 17 m; the brush at full resolution; (4) the two
  vistas in a thicket, Mercury and Neptune from orbit, Mars' dune crests, branch sway and
  drifts, the explorer's face; the UI look review.
- 2026-11-11: **PHYSICS P10 accepted (seventh agent, head `bf73de5`; code in `d66f2ec` and
  inside the snapshots `f030411`, `c04262c`)**. The coordinator re-ran on a clean export of
  the head: `node --test src/physics/` 244 pass, `node --test tests/*.test.mjs` 115 pass; and
  opened the four stored painted frames and `painted-proposal.jpg` on sheets.
  **The wind near the player**: the 52 m/s2 frame was three faults, none of them the gust
  shape: the wake of the stand upwind switched stands in one frame when the wind veered
  (86 / 123 / 51 m/s2 at 2 / 10 / 30 m at the real spawn; 452 m/s2 for a walker in the
  forest), the gust pattern raced through the air by up to 30 m/s, and the storm's outflow
  hopped with the grid. Now 7.2 / 10.3 / 20.2 m/s2 at the spawn through the first storm and
  13 m/s2 for the walker; six tests in `air.test.mjs` hold it.
  **The weather marks**: dust fed as fast as the wind empties the box (470 marks, six in ten
  low veils 11:1, opacity and softness per vertex); blowing sand and snow leave the ground in
  streamers (snow on the ground is now blown by the wind); leaves are thin tumbling marks
  torn off with the fourth power of the wind; the sea makes its own spray (spume from 9 m/s,
  surf where the water is shallower than 1.3 wave heights); snow in wind is a level stroke in
  bands. The painted lab had drawn every mark twice since PAINTER wired the kits into the
  world; it now shows the game's picture alone (`kits=painter`) or PHYSICS's stand-in
  (`kits=lab`). Legs cost 22 to 37 us a step (median), p99 under 0.15 ms: nothing changed.
  `expand: 'gpu'` is unused and marked so. `physics.update` medians 0.67 to 1.30 ms on the
  loaded machine. Additive: `physics.here.blown { sand, snow, spume, surf }`, draw options
  and kit attributes (`aPcVeil`, `vPcData.y/.z/.w`). Tests changed: one tolerance widened
  with reason (a fluttering flake against a calm-air reference), the kit budget test only
  reports, three probes rewritten; nine added.
  **Coordinator's verdict on the frames, agreeing with PHYSICS's own**: in the game's
  picture the Mars dust storm is a hazy dune with nothing in the air and the leaves are a
  few specks; in PHYSICS's stand-in the dust is soft low veils at several depths with the
  explorer half veiled, plainly the better picture. The blizzard works in the game's picture
  (level white strokes over a blue snowfield). Spray has not been seen in any frame.
  Neptune's far sea is flat pale grey although PAINTER's gate is fully open on PHYSICS's
  numbers (Hs 2.77 m, whitecap cover 0.15 at 40 to 55 s at the `storm_seas` stand).
- 2026-11-11: **Ruling (look, after one exchange between the roles): the dust glaze and the
  leaves.** PAINTER's dust glaze reads PHYSICS's per-vertex opacity, softness and
  puff-or-streamer (`vPcData.y`, `.z`, `.w`) so that veils read as veils (the stand-in's
  eight-line shader in `src/physics/three/painted-lab.js` is the reference for the result,
  PAINTER's hand decides the stroke); leaves are laid so the pass that erases thin marks
  does not eat them; the skim of blowing sand and snow is given weight. This is item 2 of
  PAINTER's block 5 and is wanted before review 6.
- 2026-11-11: **PHYSICS's order for P11** (coordinator): everything PHYSICS moves has only
  ever been judged in stills or in Node. (1) Spray seen in a picture. (2) Filmstrips at a
  fixed step, in the painted lab with the game's kits, of each thing that moves (grass in a
  breeze and a gust and parting round the walker; a tree in the gust front; rain; snow
  bands and the ground skim; dust veils; leaves; waves and surf; the ship's downwash; the
  explorer walking, clambering and landing from a jump; the ship settling on its legs),
  opened, with a verdict each on jitter, popping, sliding, things frozen, pace; fix what is
  wrong. (3) The gust pattern's sharpness against what masts measure. (4) `physics.update`
  at the top tier.
- 2026-11-11: **PAINTER block 5 accepted (seventh agent; `cf2058a`, `84a6d93`, `59e3731`,
  `3af362b`, `c0e6d03`, notes `4c2cf51`)**. The coordinator re-ran on a clean export of the
  head: 19 world tests and PILOT's 115 pass; and opened the before and after pair of all
  seven worlds and the Mars dust frame on two sheets. In: a fault from block 4 fixed (the
  cloud shell of every banded world did not compile since `uStorm` was added; its uniform is
  now `uSpot`); on Venus, Mercury, Jupiter, Saturn, Uranus, Neptune and Pluto the ground has
  second and third washes in patches, crust and stones lie in drifts, tall growth is of all
  ages, non-forest spawns with tall growth have a 15 m clearing; the dust glaze reads
  PHYSICS's veil fields; leaves are a glaze; Neptune's sea is a deep body to the horizon
  under its storm (haze was swallowing it); no orange dot in `earth-arrives`; on Earth the
  tufts lean one way and the seam at 17 m is gone. Triangles at the spawns now 0.78 M
  (Uranus) to 1.63 M (Pluto); settle 137 to 283 s here (information).
  **Coordinator's verdict, world by world**: Neptune (from kelp straps across the lens to a
  clearing with tussocks at four depths and a flowered moss floor) and Mercury (from a wall
  of blades to a field to the horizon) are large gains; Jupiter is a green meadow now but
  nothing in the first view says "island in a sea of cloud"; Pluto is richer and busy;
  Uranus was the best and barely changed; **Venus is still a grey stony plain with no lava
  and no fungal tower in the first view, and Saturn is still the palest and emptiest, with
  no rings in its sky**. None is at the standard of the Earth forest vista. The dust veils
  are there but faint.
  Not seen: any second or third biome after the push; any world from orbit since the cloud
  shell was repaired; leaves, sand skim and blown snow blowing. Not started: the brush at
  full resolution, the two vistas in a thicket, Mercury and Neptune from orbit, Mars' dune
  crests, branch sway and drifts, the explorer's face, the UI look review.
  Contract: `sampleObstacles` returns more (spires on Pluto; more boulders on Venus,
  Mercury, Pluto, Uranus; obstacles near the Mercury, Neptune, Jupiter and Saturn spawns
  moved by the clearing). The world test "sampleSurface stays cheap on every body" is a
  wall-clock test with a 50 us limit and fails under load (57 us on Uranus beside renders;
  6 to 13 us alone). The seventh PAINTER agent is out of context and is replaced by an eighth.
- 2026-11-11: **Plan to the end** (coordinator). PAINTER's block 6 is the last art block
  before lead review 6: (1) each world's idea in its first view (Venus, Saturn, Jupiter
  first), (2) worlds from orbit, (3) the weather leftovers, (4) the brush, (5) the short
  list. Then review 6 (every check on the head; the tour at tier 1 for coverage and at the
  top tier for the spawn and first vista of each body; the motion set), M3 closes, M4's
  critique swap fixes the worst of what review 6 finds, and PILOT opens and merges the one
  pull request.
- 2026-11-11: **PHYSICS P11 accepted (eighth agent, head `6d588d6`; `2c6b25b`, `05856b9`)**.
  The coordinator re-ran on a clean export of the head: `node --test src/physics/` 245 of
  246 in the full run at a load of 13 (the known frame-budget timing test in
  `loose.test.mjs`; its file alone passes 20 of 20, twice); `node --test tests/*.test.mjs`
  115 pass; and opened the strips of grass in the storm and of the jump.
  **A filmstrip tool**: `node src/physics/three/film.mjs <subject>|all|list [--root <export>]
  [--out dir] [--quality 2]`: the painted lab with the game's kits, the clock stepped at a
  fixed rate, one sheet and one JSON of numbers per subject; 21 subjects defined, 15 strips
  stored in `docs/shots/physics/motion-*.jpg`.
  **Seen and fixed**: grass in a breeze was frozen (0.01 degrees in 0.8 s) and in a storm the
  whole meadow leaned as one sheet: blades now flutter on three trains of small eddies
  carried by the wind (2 to 7 degrees in a breeze; neighbours a metre apart at 58, 50 and
  30 to 45 degrees in the storm); trunks stood pinned at their limit in the storm: now as
  stiff as measured trees (3 degrees at 8 m/s, 12 at 20); a jump landed on straight legs and
  lost half its forward speed: the legs now fold 0.31 m and straighten in half a second and
  the speed is kept. Rain stays in the world when the camera turns; the blizzard's bands and
  skim are right.
  **The gust pattern against masts**: the earlier suspicion (twice too sharp) is refuted; at
  equal intensity the model was 0.6 of Kaimal's spectrum at one second, with a quarter too
  much variance at 15 to 60 s and clipped gust tops. Now four octaves: turbulence intensity
  0.173 to 0.179 (target 0.172), gust factor 1.37 to 1.44 (masts 1.4 to 1.6), shares by
  period within 0.07 of Kaimal from ten minutes to one second.
  `physics.update` medians at quality 2: 1.02 to 2.21 ms on the loaded machine.
  Behaviour changed without a call changing: `physics.air()` at a point changes up to three
  times as fast; trunks lean a third as far; grass near the eye flutters; a landing no
  longer brakes the walker and `st.phys.hip` runs negative for half a second after one;
  `uPhysWave.z`, `.w`, `uPhysWavePhase.w` are flutter phases.
  **Not seen or not done**: spray in a picture; a clamber; waves on a shore; seven of the
  fifteen strips judged from numbers only (tree after the fix, run, jetpack, the three ship
  strips, dust, leaves); the gust front not re-filmed. **Faults found, open**: the ship's
  descent stalls for a second between 1.3 and 1.0 m; the wind at the focus steps 0.4 m/s
  when the near field re-anchors; particles near a wood ride a wind 2 to 3 m/s faster than
  `physics.air` at their height; the wind's direction never wobbles; on Neptune's storm
  coast (yaw 236 from the `storm_seas` stand, 34 to 42 s) a pale rectangle with straight
  edges stands in the sky, the sea does not visibly heave at 2.77 m, the foam rim is frozen
  (PAINTER's); the run reaches 6.1 m/s where 7.4 is asked (PILOT's to judge).
  The eighth PHYSICS agent is out of context and is replaced by a ninth.
- 2026-11-11: **PHYSICS's order for P12, the last stage before review 6** (coordinator):
  (1) the four open faults (descent stall, re-anchor step, particles' wind near a wood,
  cross-wind turbulence); (2) the strips not yet opened, opened and judged, and the three
  subjects never seen (a clamber, waves on a shore, spray); (3) why Neptune's sea does not
  heave in the picture, with PAINTER told exactly what to change.
- 2026-11-11: **PILOT part 1 accepted (fifth agent, `54ba154`)**. The coordinator re-ran
  PILOT's unit tests on a clean export of the head (116 pass) and opened the motion sheets of
  the arrival and the walk. In:
  **Every check on the head**: `node tests/all.mjs` on a clean export of `da6d42d`: all 13
  steps pass in 42 minutes (unit 114, PHYSICS 230, world 19, static, eight browser runs;
  painted steps at quality 0). After PILOT's last fixes only five steps were re-run (pass).
  **The Moon and Pluto landed on** in a browser (`grandtour --bodies moon,pluto`): ten of ten
  bodies. Fixed on the way: arriving at the Moon said "Moon is in the way".
  **The Moon boulder run in the game** (`tests/boulderrun.mjs`, real keys, 63 low boulders
  within 28 m): no boulder lifts the feet more than 0.16 m; pace 5.7 to 6.6 m/s; a run over
  a crater rim onto a 36 degree wall sails 2.4 s over ground that fell 6.7 m away.
  **The motion instrument** (`tests/motion.mjs`, `tests/motionlib.mjs`; `__pc.hold(true)`,
  `__pc.step(dt, n)`): eight scenes at the top tier, 960x540, sheets in
  `docs/lead/evidence/motion-<scene>.jpg`, numbers in `motion.json`. What holds: standing
  still, the sky, the paper border and the ground wash do not move (0.30 % of the picture
  changes per frame, all of it crowns and grass); the same instant repainted is identical;
  in a slow turn detail stays with the world (no shower door); the pulse is steady.
  **Faults**: arriving at an unpainted place the whole canopy appears in one frame (+575 k
  triangles) and the ground arrives in pieces for the next second; tiers change in one frame
  (the triangle count jumps by more than 2000 in 10 of 47 walk frames, largest 50 k; two
  swaps visible in flight); a near poppy is a flat hard-edged disc; splash rings are thin
  white line ellipses. All strips predate PHYSICS P11 and must be re-shot for review 6.
  **The first ten minutes**: at the top tier only the opening was played (a frame takes
  about 15 s here); the whole leg to standing on Mars ran at quality 0 (26 beats, 202 s of
  play, passed). The sward is whole at "click to begin"; no camera cut through 13 changes
  of state. Fixed: the "Board ship" prompt lay across the explorer's legs; "Land here" was
  offered three seconds after lift-off; a note on the map at first space. Open: crowns
  between the lens and the figure hide the explorer when jetpacking among trees.
  PILOT's answers on feel, from the game: the run reaches 7.48 m/s at 1.23 s (good as it
  is); the jetpack is capped by PILOT's wrapper (2.5 s of Space is an apex of 22.7 m, the
  whole tank 54 m, touchdown at 4.0 m/s); no stall in the ship's last metres in the game.
  Also: settle counted in game frames; the tour and weather set default to the top tier;
  `tour --first 1`; `tests/cleantree.sh` (a clean tree from each role's own last commit);
  a hiss for blown sand and snow and a wash for surf from `physics.here.blown`. Additive:
  `__pc.hold`, `__pc.step`, `sim.pulse.dest`; the explorer's `animate` receives `hip`,
  `clamber01`, `grounded`; HUD class `pc-foot3`.
  Not verified: the full `all.mjs` and the grand tour, trip and survey since PAINTER's
  block 5 moved obstacles; the top tier beyond the opening; real hardware as always. The
  fifth PILOT agent is at its context limit; a sixth takes review 6.
- 2026-11-11: **Ruling (PILOT asked): the boulder measure.** A run that goes over a crater
  rim or any drop it cannot step down is a fall, as the ruling on legs already says. The
  measure for review 6 reads: no boulder lifts the feet more than 0.3 m, and the body is
  never thrown upward more than 0.3 m, without a jump.
- 2026-11-11: **PAINTER block 6 accepted (eighth agent; `5edf80c`, `ad17d2c`, some files in
  the snapshot `2f4a7b6`)**. The coordinator re-ran on a clean export of the head: 19 world
  tests and PILOT's 116 pass; and opened the before and after pair of Venus, Saturn and
  Jupiter. In: **each of the three says its world in one look**: Venus lands on the bank of
  a lava river with a grove of old fungal towers on the skyline and a basalt spire; Saturn
  has its rings as a great pale arc across the sky over a gold meadow; Jupiter stands on a
  bench between island cliffs under cream and orange belts running to a vanishing point.
  All three spawns moved (data in `src/data/looks.js`; Venus to a lava bank in the same
  biome, Saturn from latitude 12 to -31 on another gold island, Jupiter to a bench on the
  first island), each on levelled ground with a level berth for the ship 16 m off;
  `world.getSpawn` returns `yaw` and `pitch` for them. The cloud sea cannot be seen from a
  level landing on these small worlds (its horizon lies 12 degrees below eye level and the
  island's rim hides it), so the far deck is painted into the sky.
  The lead's motion faults, **in code and not seen in motion**: each tree washes in over
  0.55 s and a tree changing tier cross-fades; undergrowth cells wash in; near flowers have
  a lobed edge; splash rings are a soft broken glaze; strokes between the lens and the
  figure part; the explorer folds its knees by `hip`. `world.busy` stays above 0 for 0.65 s
  after the last arrival. Orbit: the limb thins in proportion to a world's air (Neptune's
  bright rim gone), one outline for Earth's cloud, a gold ring with its division; Mercury is
  still a dull grey ball and no body shows a dark side in the gallery's orbit view. Dust
  veil gain 1.5 to 2.6; rain strokes heavier. The timed world test asserts only with
  `PC_TIMING=1`.
  Coordinator's verdict: Venus is the largest single gain of the push; Saturn's arc works
  though the wash under it is muddy; Jupiter's sky says Jupiter and its ground says valley.
  Not done: the build order after a landing, the ground arriving in pieces, near strokes
  growing in; leaves, sand skim and blown snow seen blowing; Neptune's far sea, the pale
  rectangle in its sky, the sea's heave and the frozen foam rim; the track through grass;
  the brush; the two vistas in a thicket; Mars' dune crests; branch sway and drifts; the
  explorer's face; the UI look review. The eighth PAINTER agent is out of context and is
  replaced by a ninth.
- 2026-11-11: **Review 6 starts now** (coordinator), in two halves so that nobody waits:
  the sixth PILOT agent begins with what depends least on PHYSICS's last stage (the
  mechanics on the moved spawns and changed obstacles; the tour), and does the motion set,
  the weather set and every check when PHYSICS reports. PAINTER's ninth agent works on the
  known motion and weather faults meanwhile and takes review 6's findings as they come.
- 2026-11-11: **PHYSICS P12 accepted (ninth agent, head `a0630e4`; `3406da1`, `f0b58ea`,
  `40161ba`)**. The coordinator re-ran on a clean export of the head: `node --test
  src/physics/` 253 pass, `node --test tests/*.test.mjs` 117 pass; and opened the strips of
  the clamber and of the spray. Fixed, each held by a test:
  (1) **the ship's descent hung** above the gear because the thrusters' ground cushion
  cancelled the flight computer's whole velocity error; the computer now allows for the
  cushion (`SHIP_BODY.groundComp`) and the cushion fades with air density (none in a vacuum):
  1.6 to 1.0 m in 0.78 s (was 2.12 s). The game's own landing is unchanged (within 8 mm
  frame by frame in PILOT's `motion.mjs --only landing`); the hang came through the lab.
  (2) **the wind stepped when the near field re-anchored** (0.38 to 0.61 m/s in that frame):
  four geometric causes removed; now 0.007 to 0.009 m/s against 0.030 in any other frame.
  (3) **particles near a wood rode another wind** (up to 3.5 m/s off): every node of the
  wind grid has its own profile, used by `physics.air` and the particles alike; the largest
  difference is 0.39 m/s.
  (4) **cross-wind turbulence** on the same four octaves: lateral over along-wind intensity
  0.77 to 0.79, within 0.06 of Kaimal's lateral spectrum; the direction wanders 8 degrees
  rms over grass at 10 m.
  (5) **the kick after stepping off a boulder** (+0.9 to +1.5 m/s, over a second in the air
  on the Moon): now +0.2 to +0.35 m/s and 0.02 m of rise.
  Seen for the first time: a clamber (the figure shortens on the face, crosses the top at
  2.3 to 2.7 m/s, in contact throughout); spray (level pale dashes over the surf, 160
  growing to 580 drops; with rain shown it cannot be told from rain).
  **Findings from the strips**: the run has no bob at all (the hips move 0.01 m: the
  explorer glides); the jetpack descent is five seconds at one speed and reads as floating;
  the hovering hull hangs dead level in gusts; birches read as still in a 1.2 s window in
  the storm; 190 leaves in the air are a handful of one-pixel specks; dust puffs near the
  eye flicker for single frames; the gust front does not read as a wave in the sparse
  meadow; a run on the Moon is checked from 5.3 to 2.0 m/s in one frame at a 1 m boulder.
  **Neptune's coast, the cause found**: PHYSICS's chunk gives the right moving height
  (1.0 m at 60 m out, 1.3 to 1.5 m at 250 m); PAINTER's liquid vertex shader removes it:
  the carry distance is taken from the first, short wave train (flat from 64 m out), the
  shoal factor flattens the foreground, and the swash mask depends on still depth alone
  (frozen foam). PHYSICS added `pcPhysWaterLong` and `pcPhysWaterRunup` (a run-up of about
  9 m up and down a 0.07 beach over a 5.4 s period) for PAINTER to wire. The straight-edged
  pale forms in the sky are PAINTER's. Additive API; behaviour changed without a call
  changing is listed in PHYSICS's notes.
  The ninth PHYSICS agent is out of context and is replaced by a tenth.
- 2026-11-11: **PHYSICS's order for P13** (coordinator), while review 6 runs: (1) a gait:
  the hips rise and fall with each stride and the cadence follows speed and gravity, with
  footfall events, so the run no longer glides; a crouch before a jump; (2) the jetpack's
  descent, the hull in gusts and the hard check at a boulder on the Moon, each judged with
  PILOT's levers in mind; (3) trees and leaves that read in a storm; (4) the Earth shore
  seen; then review 6's findings as they come.
- 2026-11-11: **PHYSICS P13 accepted (tenth agent; `60423e0` gait, `d2d0006`, `52fd659`,
  `2e6ce74`)**. The coordinator re-ran on a clean export of the head: `node --test
  src/physics/` 262 pass, `node --test tests/*.test.mjs` 117 pass; and opened the walk strip
  (the stand-in figure plainly steps, two legs scissoring, the torso lower at mid-stance).
  **A gait**: the body PILOT tuned (`st.p`, `st.v`) is the stride's mean and is untouched
  (the same commands with two stride phases give the same place and velocity to the last
  digit). Within the stride: gait and step length by dynamic similarity (Froude number, leg
  0.9 m: a walk below 0.5, so under 2.0 m/s on Earth and 1.0 m/s on the Moon); the walk an
  inverted pendulum, the run a spring-mass with a ballistic flight under the planet's own
  gravity. Earth at 4.2 m/s: steps of 1.41 m, 3.0 a second, 36 % of the time in flight, a
  bob of 6.8 cm; the Moon at 4.2 m/s: 2.27 m, 1.85 a second, 61 % in flight. Footfalls with
  moment, place, foot and force. A crouch of 0.12 s before a jump (`cmd.jumpCrouch`; the
  feet leave 0.12 s after the command, height unchanged). PILOT's "walk" of 4.2 m/s is by
  its gait a run.
  **Three judgements**: the descent brake eases in (largest change of acceleration in a step
  9 to under 1.2 m/s2; the five seconds at one speed were the lab's limit, the game's is
  PILOT's wrapper); `buffetAngle` now carries the wind's moments on the hull against an
  attitude hold (roll 0.2 to 0.7 degrees in 6.5 to 10 m/s gusts, 0.9 to 4.8 in 14 to
  26 m/s; a new `.yaw`); at a boulder's face the legs take the body's speed up over a stride
  (2.2 m/s lost in one step before, 0.5 now, at 7.4 m/s on the Moon).
  **To wire, PILOT**: pass `phys.ride` (hip plus stride bob) where `hip` is passed, with
  `stride`, `footDown`, `feet`, `surge`, `crouch01`, `gait`; keep the camera on `st.p`;
  footsteps from `phys.footfall` when `phys.steps` changes; `rotateY(buf.yaw)` on the drawn
  hull. **To wire, PAINTER**: boots placed by `feet`, hips hung by `ride`, no walk cycle on
  its own clock, the swinging leg's knee folded; `pcPhysBranch` is called nowhere in
  `src/world` or `src/render`, so no branch moves in the game (the three lines are in
  PHYSICS's notes); leaves as dabs of at least 8 px.
  **Not done**: branches (their swing is tied to the trunk's lean, which P11 made stiff:
  7 cm at the tip where a gale gives 0.3 to 0.6 m); leaves (five to ten times the count in
  a gale); the Earth shore seen only before PAINTER wired the run-up (the water's edge does
  not move); the jetpack, hover and Moon clamber strips not re-filmed. The tenth PHYSICS
  agent is out of context and is replaced by an eleventh.
- 2026-11-11: **PHYSICS's order for P14** (coordinator): (1) branches driven by their own
  wind load, proved in a stand-in crown; leaves that can be seen in a gale; (2) the shore
  once PAINTER has wired the run-up; the three strips not re-filmed; then review 6's
  findings.
- 2026-11-11: **The owner switched the session's model** and asked to continue without
  redoing finished work. The three running agents (PILOT 6 in review 6, PAINTER 9 in block
  7, PHYSICS 11 in P14) were asked to finish the item in hand, commit, write a handover and
  report; their committed work stands. Every agent started from here runs on the new model
  at extra-high effort (the coordinator's reading of the owner's "extra"). Coordinator
  commits carry the new attribution line.
- 2026-11-11: **All three agents were stopped by the old model's usage limit** within a
  minute of each other, before any wrote a handover: PILOT 6 (review 6, first half),
  PAINTER 9 (block 7), PHYSICS 11 (P14). Their uncommitted files were already in the
  coordinator's backups (`6b900e6` PAINTER, `df35355` PHYSICS, `1186819` PILOT). The
  coordinator stopped their orphaned browser runs by process id and checked the head on a
  clean export: PHYSICS 263, world 19, PILOT 117 pass. Left behind and carried forward, not
  redone: PILOT 6's draft of review 6's first half (`/home/user/.pc-scratch/pilot/run6/
  review-mech.md`: survey 235/240, every spawn 10/10, painted trip PASS, grand tour 8/8 and
  Moon and Pluto 2/2, on the commits it names) and its top-tier tour sheets of Venus and
  Saturn; PAINTER 9's `b022507` (block 7 part 1: wash-in of ground, growth and near strokes,
  arrival held as paper then up over 1.3 s, water by PHYSICS's recipe with run-up, spray,
  leaves, rings, dust fade, walker's track; unverified) and its unfinished gait and branch
  wiring (the branch define is not switched on); PHYSICS 11's unfinished crown model
  (`pcPhysCrown`, `plantCrown`; tests pass; unjudged).
  Successors started on the new model at extra-high effort: PILOT 7 (record the first half,
  wire the gait, footfalls and hull yaw, the rest of the tour and the look; the second half
  of review 6 on the coordinator's message), PAINTER 10 (verify and finish block 7: motion,
  Neptune's coast, weather; the gait in the figure; branches on), PHYSICS 12 (judge, finish
  and prove the crown model and tell PAINTER what to wire; leaves; the shore; three strips).
- 2026-11-11: **PHYSICS P14 item 1 accepted (twelfth agent, `1a7ed8c`)**. The coordinator
  re-ran on a clean export of the head: `node --test src/physics/` 265 pass, `node --test
  tests/*.test.mjs` 123 pass; and opened the stand-in birch in the storm (the trunk leans
  about 8 degrees, the foliage masses change shape out of step with each other: a living
  crown, sheltered rather than violent). **Branches**: the eleventh agent's crown model had
  the right sizes but the wrong motion (tips at 0.2 to 0.8 Hz, three branches of a crown in
  step); now each branch also rings at its own frequency on four shared clock lines (0.72,
  1.01, 1.43, 2.02 Hz, uniform `uPhysBranchClock`), weighted by its own natural frequency
  and damping, with phases from its id and place; the eddy trains are only the slow part.
  A 3.5 m branch: 7 cm in a breeze at its own 1.03 Hz, 0.49 m in the storm's height, 0.61 m
  at the gust front; quick swings of neighbouring branches correlate -0.3 to 0.5. In the
  game's wood the crowns feel 11 to 18 m/s in the storm (tips stream 0.12 to 0.26 m); they
  may be sheltered up to twice too much (flagged, not changed). Lab `crown=`; strips
  `crown-breeze`, `crown-gust`, `crown-storm`. One test rewritten (the breeze check demanded
  the fault), one relaxed with reason (0.45 to 0.6, by construction of the new cap).
  **PAINTER must wire** (top of "For PAINTER" in PHYSICS's notes): `uPhysBranchClock` in
  `PHYS` in `src/render/shared.js`; per-vertex `aBranchId` and `aLeaf01` on tree geometry;
  `pcPhysCrown` (not `pcPhysBranch`) in the tree vertex shader. Nothing moves in the game
  until then. Not done: leaves, the shore, the three strips, the sheltering check. The
  twelfth PHYSICS agent stopped near the end of its context; a thirteenth takes the rest.

### 2026-11-11 OWNER'S INSTRUCTION: multi-agent workflows for the tough parts
The owner: "Use ultra code on extra high on opus when your working on tough parts that need it." Read as: the coordinator may run multi-agent workflows (finders, adversarial verifiers, synthesis) on Opus at extra-high effort for the hard problems. The three roles stay the only workers that change the game; a workflow's agents are read-only instruments (clean export, scratch under /home/user/.pc-scratch/sweep, one browser at a time on this 4-CPU box), and what they confirm goes to the owning role as a fix list.
First use: hardening sweep (run wf_790ce070-443), the failures SwiftShader cannot show: GLSL portability on real drivers (ANGLE/D3D11, Mesa, Metal, Firefox), the integrated-GPU frame time at 1080p from the top tier and whether dynres and tier stepping catch it, first-run robustness (no WebGL2, context loss, storage blocked, long tab hide, keyboard layouts, README vs bindings). Each finding is attacked by a verifier before it reaches a role. Planned second use: the M4 critique swap.

### 2026-11-11 PHYSICS P15 accepted (thirteenth agent); a broken head found and fixed; rulings
- P15 accepted: leaves from what the wood sheds with inflow from upwind, litter, tumble (6f9fdd8); the shore seen, run-up 0.5-1.9 m Earth breeze, 1.5-7.3 m Neptune (413b846); crowns not sheltered twice, one wake shape wakeAt (6d5c02a); three strips re-filmed (3199860); hand-over 3ed8d03. 268 physics tests pass on a clean export (coordinator's run).
- INCIDENT, reported by PAINTER 10: 6d5c02a made physics/flora.js import air.js while air.js read FLORA at load time (HF0). In the browser the entry order is flora.glsl.js -> flora.js -> air.js, so FLORA was in its temporal dead zone and EVERY real module fell back to PILOT's stub ("not usable yet ... using the stub"). Node tests import in another order and passed. Heads 6d5c02a, 1d036eb, 8de65de are broken in the browser. The coordinator made HF0 lazy (computed on first use); PHYSICS's pathspec commit 3199860 carried it. Proved: loading src/physics/flora.glsl.js alone in Node throws at 6d5c02a and every src/physics/*.js loads alone at 3ed8d03. The hardening sweep's exports were made after the fix (its shader dump has no stub warning).
- Guards ordered: PHYSICS adds a test that loads every physics module alone as the entry, in a fresh process (catches the class); PILOT makes the browser checks fail when the real game falls back to a stub. PILOT redoes only the tour sheets made from a broken head.
- RULING (fetch, physical behaviour = PHYSICS): yes, the sea state comes from the fetch measured upwind over the water that is there (capped by the biome's), and the depth limits it. Neptune's storm_seas coast faces a lagoon dry 160 m out; whether that coast should face open sea so the surf stays is a look and world decision for PAINTER.
- RULING (Moon run checked at the boulder face, 5.4 -> 2.1 m/s in 0.125 s): physical behaviour, so PHYSICS's. A face the explorer can step or clamber onto costs the energy of the climb, not the run; a face too high stops the body by contact, which is allowed. If the code lives in src/player, PHYSICS writes the exact change for PILOT.
- The coordinator edits a role's files only to unblock a broken head, and says so.

### 2026-11-11 PILOT 7 accepted; OWNER'S ORDER: the art pass as a multi-agent workflow
- PILOT 7 accepted: review 6 first half on record (c8745f0); explorer steps wired (7a8e0c6, code in f86bd1b); sketch slip waits for the explorer to set off; stub guard (88079f6: window.__pc.info().fallback, tests/browser.mjs fallbackProblem fails every browser instrument on a fall-back; unit 125); the tour stopped part-way for the art pass (e047e7b): six bodies at the top tier, three weakest first views Mercury, the Moon, Mars; nine findings for PAINTER in REVIEW "Review 6, the tour". Left for after the art pass: all.mjs on a clean tree, the top-tier tour of all ten bodies and the tier-1 coverage tour, motion and weather sets, the Moon boulder run, settle times.
- OWNER'S ORDER (verbatim intent): "ultracode. Run this task as a dynamic workflow with exactly 4 parallel subagents: an art pass across every planet and biome. Split into 4 subagents by planet group: (1) earth; (2) mercury, venus, mars; (3) jupiter, saturn; (4) uranus, neptune." Each edits only its own planets' files inside PAINTER's folders (split first if biomes share a file), never the shared watercolour pipeline, PILOT's or PHYSICS's files; brings every biome up to the freeze-frame test (palette, terrain shapes, flora, sky, weather, motion); before/after shots per biome, reverts what looks worse. Then cross-verification against the art bible, same-painter consistency across planets, fixes, a run with no console errors, commit, push, report.
- Done by the coordinator before the workflow: src/data/looks.js split into src/data/looks/common.js (paper, pigments, sky keys, B/P/PM helpers) and one file per body (src/data/looks/<body>.js); looks.js keeps the same exports and assembles LOOKS. Proved identical: JSON of LOOKS and the helpers' outputs byte-equal before and after (40730 bytes); every file loads alone in Node; world 19 and unit 123 pass on a clean export with the split. tools/commit.sh has a new role 'art' (src/data/looks, docs/shots/art), so PAINTER's commits no longer sweep the art pass's files.
- Choices logged: the Moon goes with group 1 (Earth's system) and Pluto with group 4 (the outer ice), so every landable body's biomes are covered; their files are separate. Fields the art agents may not touch: seed, seaLevel, phys (PHYSICS's input), sites (spawn, easels and tests depend on them). PAINTER 10 keeps to shared code during the pass. On this 4-CPU machine the workflow runtime runs at most two agents at once, so the four art agents run two at a time.

### 2026-11-11 PHYSICS P16 (fourteenth agent) reported; rulings
- Reported: the import cycle removed (wakeAt and WAKE in wind.js; air.js re-exports; lazy HF0 kept) and src/physics/load.test.mjs (every physics module loaded alone as the entry in a fresh process, plus no static import cycle among the 49 modules; fails on 6d5c02a, passes on the head) (dc4e3f5); the fetch measured over the real water by five radials (SPM 1984) with depth-limited growth, cached per place and compass sixteenth (dc4e3f5); the Moon run: the face brace no longer checks the run, the runner reads the ground ahead and slows within its grip to the pace it can cross at (af7f0aa). Physics 275, unit 125 (its runs). Strip motion-sea-out-neptune opened by the coordinator: a storm coast still (dark sky, a spout, rain, a white chop on the lagoon); the big surf is gone.
- RULING (the 0.3 m rule): kept. A runner slowing before a rock it must clamber is what a person does; no boulder launches the body without a jump. The look-ahead stays on.
- RULING (the coasts): the physics is right; the coasts must face their sea. Neptune's storm_seas stand faces a lagoon dry 120-170 m out with the storm winds from E/ENE; Earth's sea_coast stand faces a pool under 50 m with the wind offshore. After the art pass, PAINTER makes both coast biomes face open water (at least 2 km of fetch at about 20 m deep toward the storm wind, by the terrain recipe or the stand), so a storm's surf comes back by the physics. Not given to the art pass: sites and terrain topology are outside its remit and its base (8f23067) predates the fetch.
- PHYSICS's next agent is started when the hardening sweep reports, so it takes those findings with P13/P14's open items in one block (and the machine's CPU stays with the art pass meanwhile).
- P16 ACCEPTED: on a clean export of af7f0aa (coordinator's run) physics 275 pass, unit 125 pass.

### 2026-11-11 Hardening sweep reported (docs/lead/HARDENING.md)
- 7 agents (3 finders: GLSL portability, integrated-GPU cost, first-run robustness; 3 adversarial verifiers; 1 synthesis). 22 findings survived verification, 20 after merging duplicates, 19 open: 2 broken, 8 degraded, 9 minor. No blank-screen finding survived. Refuted: derivatives after discard (Mesa demotes), the landing cancel (by design). Already fixed in the tree: uPhysBranchClock bound (56c0333).
- Broken: audio never started inside a user gesture (Safari silent all session; gamepad-only Chrome silent); a non-standard pad (HOTAS, pedals resting at +-1) taken as the right stick spins the camera and starts the title card.
- Degraded: no shader prewarm (mid-game compile stalls on ANGLE-D3D11, each also fires the dynres panic); dynres over-reacts to single hitches; pointer lock lost for the session after Esc (Chrome's 1.25 s cooldown); dynres reads a refresh cap (Energy Saver, Low Power Mode, 50 Hz panels) as load and pins tier 0 for good; no EXT_clip_control (Firefox) means gl_FragDepth in every scene shader (no early-Z, about 2.9x fragments); keys by position but labels in QWERTY (AZERTY: M never opens the map); flick filter drops pointer lock at 30-40 fps; no output pixel cap (4K at 150 % pins the floor picture).
- Owners: PILOT 17 (fix list P1-P15 in HARDENING.md, with a Node-tested dynres candidate diff in scratch), PAINTER A1 (log depth written in the vertex shader) and A2 (prewarm hooks), PHYSICS none (one confirmation: a storm at quality 2 within budget once physics follows the tier).
- RULING (output pixel cap; performance = PILOT, the owner wants the best picture): cap the drawing buffer at 3.7 MP (about 2560x1440), not 2.3 MP: a 1080p screen and Retina laptops at DPR 1.5 keep every pixel, a 4K monitor draws at about 1440p and is stretched.
- Gaps stated plainly in HARDENING.md section 3: no real frame rate, no real driver compile times, no real ANGLE backends, no Firefox, no Safari, no real input devices, no context loss on hardware; never run end to end in the sweep.

### 2026-11-11 PAINTER block 7 accepted (tenth agent)
- Accepted: item 1 verified on clean exports at the top tier (motion walk pass, fill 0 pops from 498, whole arrival soft over 1.2 s, Neptune sea heaves and runs up; the pale straight-edged forms in Neptune's sky were far headlands lost in a near-white mist under a storm cloud, fixed in src/world/index.js: the mist takes the storm's grey and the low sky takes the mist; Mars dust storm veils the explorer, G.uAirNear) (194171b); item 2 the explorer steps by PHYSICS's feet (two-bone legs, ride, surge, stride; gallery gait=, stride=, grav=); item 3 branches wired (uPhysBranchClock in PHYS, aBranchId, aLeaf01, pcPhysCrown on near and mid tiers) (6bcfc73, 7509a6e). Coordinator opened crown-storm-after.jpg: the sky holes between foliage masses change shape frame to frame. Its final check: a clean export of 59bfb1b loads at the Earth spawn, every module real, no console error; world 19, unit 125.
- Weak and owned: white horses do not show (now explained: P16's fetch gives Hs 0.21 m at storm_seas; the coast fix after the art pass brings the surf back); the near headland's vertical end; the blizzard's ruled crest; the gallery run not re-filmed after the heel change; item 4 (the brush, two walled vistas, Mercury from orbit, Mars' dune crests, the explorer's face, the UI look review). Its questions on the meadow dust puff and a bobAt export went to PHYSICS 15.
- PAINTER 11 started on Opus extra-high: A2 prewarm hooks, A1 log depth in the vertex shader, then the coasts and the rest after the art pass.

### 2026-11-12 PILOT 8 and PHYSICS 15 (P17) accepted
- PILOT 8 accepted (932cd9d, b990e8b, 085d5e1, 64cfd5f): hardening P1-P15, gaps 12 and 16. Sound starts only inside a click, tap or key press; only standard-layout pads are read (chosen over learning rest values: a trigger passes through 0); the review's dynres candidate adopted with a 2.5 ms jitter limit and "capped at N fps" in the read-out; physics quality follows the tier (0, 1, 2 measured); prewarm behind the loading card (0 materials without a program at ready, 0 compiled after ready, with PAINTER's hooks 320 ms); pointer-lock refusals near a release ask for a click (the review's scale-everything proposal failed lockcheck, so only the spike limit scales; three 180-degree flicks keep the lock at 20-60 fps); keys by position for movement, by letter for actions; drawing buffer capped at 3.7 MP; P9-P15; no float colour buffers shows a sentence unless painter.floatFallback; a save while swimming comes back afloat. Not run: the painted steps of all.mjs (the art pass has the machine); review 6's second half waits for the art pass.
- PHYSICS 15 (P17) accepted (d186b65): quality 2 fits (worst storm, a run into a tall wood, 1.93 ms main-thread CPU for physics.update; Neptune coast 0.82, blizzard 1.50, Mars dust 1.27); cheaper than head through a de-optimisation (-0 from Math.round rebuilt FloraField's push step every other frame), split hot loops, a scratch ground query, cheaper maths; garbage halved; a boulder met off the middle of the path is ghost-run at trial paces so the runner eases to the fastest clean crossing (no brace and no hold at 0-0.55 m off on Moon, Mars, Earth; feet never leave the ground); no boot puff on a living sward or bare rock (KICK.stepDust); bobAt and strideBob exported for PAINTER's gait pose.
- Coordinator's check on a clean export of d186b65: physics 279 pass, unit 140 pass, every physics, art, world and play module loads alone (no TDZ).
- Open: P13/P14 items (sea one state round the focus; waves do not turn to the longest fetch; nothing under 1 s in the gust pattern; strips tree-gust, clamber-walk-moon and the storm frame unopened; the lab stand-in has no knee); the air grid's ~400 KB a frame of garbage; the changed suite not re-run under PC_TIMING=1. PHYSICS 16 started on Opus extra-high, Node only until the art pass releases the machine.
- Relayed to PAINTER 11: check a landing on another world after ready; warm each tier's post passes once; A1; low-priority 8-bit fallback for the float targets; gaitPose uses strideBob.
- OWNER (2026-11-12): asked why only 2 art agents run at once and why PHYSICS is code-only. Answered: the workflow runtime caps concurrent agents at CPUs - 2 = 2 on this 4-CPU machine (no GPU, so each headless browser renders WebGL on the CPU; load about 13; memory not a limit); PHYSICS code-only is the coordinator's priority rule. Owner: "continue as is". PHYSICS stays Node-only until the art pass ends.

### 2026-11-12 PHYSICS 16 (P18) accepted
- Accepted (c1c8e2c, 45338f0, f6eaa17, 5f480bf): a sea map (seamap.js): every node of two grids round the focus (16 m inner, 128 m outer to 2 km) has its own fetch (11 radials plus a 24-radial far rose), depth, wind sea, whitecaps and share of the swell; the wind sea turns toward its longest fetch and refracts and shoals near shore (a lagoon behind a barrier Hs 0.07 m beside an open shore 0.43 m in a 21 m/s gale); 0.06-0.17 ms a frame. Sub-second gusts (wind.js gustSubAt, Kaimal-weighted, scaled by local turbulence intensity, averaged over a receiver's size): under 1 s the wind went from 0.002 of its variance to 0.7-1.0 of Kaimal's share. The air grid's garbage 383 -> 39 KB a frame, bit-identical by checksum over 4.69 million numbers (the figures in 45338f0's message are wrong and corrected in the notes). The lab stand-in has a knee (Node geometry only). src/physics/coast.mjs reports fetch, depth, Hs, white % and wave direction at each coast stand with PASS / NOT YET.
- Coordinator's check on a clean export of 5f480bf: physics 288 pass, unit 140 pass, every module in src/physics, art, world, play, render and data loads alone; coast.mjs runs: Earth sea_coast NOT YET, Neptune storm_seas NOT YET (Hs 0.71 m 80 m out on 0.8 km of fetch; target 3.23 m, 15 % white over 2.5 km at 20 m).
- Not verified: the sea map's GLSL was never compiled (PAINTER wires it: two uniforms and a texture in shared.js, PC_PHYS_SEA_MAP, the local sea in the water shader; until then the picture is P16's); no picture of P18 was made; the strips tree-gust and clamber-walk-moon and the storm frame unfilmed; PC_TIMING not re-run (load 13-16 throughout).
- PHYSICS 17 is started when the art pass releases the machine (its remaining work needs a browser). Relayed to PAINTER 11: wire the sea map with the coast fix after the art pass, and run coast.mjs until PASS.

### 2026-11-12 PAINTER 11 accepted; RULING on Neptune's coast
- Accepted (90025a3, 46fcbf8, 8b058d7; parts carried by the coordinator's snapshots 0b76f2c, d874259, 5b083c1): A3 (uPhysBranchClock bound and moving); A2 prewarm hooks (world.prewarm, painter.prewarm with each tier's brush passes and the sheet; renderer.outputColorSpace linear so a compile outside the scene pass builds the drawn programs, pixels equal; 0 shaders compiled mid-game through day, night, storm, tier 0, ship, space and arrivals on six worlds; with PILOT's own caller 0 after ready landing on Mars, Mercury, the Moon, Pluto, Saturn); A1 (with EXT_clip_control hidden 37 programs link, no fragment shader writes gl_FragDepth, checked by following the #ifs; close shots without holes or z-fighting); gap 17 (reversed smoothstep edges and atan(0,0)); gap 12 (an 8-bit packed fallback; painter.floatFallback = true; float and 8-bit frames look the same, opened by the coordinator); gaitPose uses strideBob; the run re-filmed after the heel change; the explorer's face shaded (still an egg at 4 m, opened by the coordinator: slight).
- Coordinator's check on a clean export of 8b058d7: world 19, unit 140, physics 288, static rules, every module loads alone.
- Noted: the art pass's Earth broadleaf scale 1.25 failed world test 15 on two snapshots (a671ca7, 9b5c941); a later snapshot fixed it. The art pass's final head must pass the world tests.
- RULING (Neptune storm_seas, PAINTER asks: accept about 1.5 km of fetch, or open water toward the biome's edge; look = PAINTER, physics = PHYSICS, put to the coordinator): open the water. A storm coast is a vista the painting needs, and the surf must come from real fetch, not a raised number. PAINTER 12 opens water in the storm_seas coast terrain toward the biome's eastern edge, keeping the ice spires biome whole, and picks a beach facing it. The fetch clause of coast.mjs is the means; Hs and white at 80 m out are the ends: if 2 km cannot be had without breaking the next biome, the coordinator may accept less only on coast.mjs's measured Hs and white passing, with a frame opened. Earth sea_coast: the 2067 m beach 1.26 km south of the old stand, moved in src/art/easels.js STANDS (sites unchanged).
- PAINTER 12 starts when the art pass ends (the coast terrain and Neptune's look file are group 4's during the pass): sea map wiring, both coasts to PASS, the cliff walls (the headland's vertical end, the combed stripes behind Earth's pool), the blizzard's ruled crest, then item 4.
- OWNER (2026-11-12): asked how long the art pass will take (estimate given: about 10 h more, 8-13 h, finishing near 12:00 UTC) and whether it can go faster without losing quality (answered: only by moving the remaining stages to extra cloud sessions on other machines, saving about 3-4 h with the risk of stopping the workflow between stages). Owner: "continue as is". The workflow runs unchanged.

### 2026-11-12 PILOT 9 (lead review 7, code) accepted; PHYSICS 17 started on its findings
- Accepted (33abe08, d5bc467): Review 7 (code) in docs/lead/REVIEW.md with proving scripts in docs/lead/evidence/review7/. MUST FIX (PHYSICS): the off-path ghost run (explorer.js ghostCrosses) overwrites the walker's own scratch _dir and _gnd mid-step: off the x-z plane a run through boulders gains radial speed while grounded and strays off its line, and wrong materials are reported for footsteps, sink and dust. SHOULD FIX (PHYSICS): SeaMap.rebase leaves the published target in the old frame (crests slide 14-17 m after each re-anchor); the shown sea map jumps when a build lands after the focus moved (blend band in whole cells, new nodes snap, outer level snaps after a re-anchor). Nothing to fix in PAINTER 11. PILOT's explorer now asks the air as a 0.5 m receiver at its own velocity.
- Coordinator's check on a clean export of d5bc467: unit 140, physics 288; ghostfield.mjs reproduces finding 1 on the head: off the plane radial speed while grounded 0.74 m/s (Earth) and 0.58 m/s (Moon), 0.23 and 0.81 m off the line, 17 steps with the wrong material (11-17 even in the P17 test's plane).
- PHYSICS 17 started on Opus extra-high, Node only: the three findings, each proven with PILOT's scripts before and after. Its browser items (strips, PC_TIMING) go to a later agent once the art pass frees the machine.

### 2026-11-12 PHYSICS 17 (P19) accepted; art pass groups 1 and 2 done
- Accepted (976b954, 40f8f7d, b5db96b, 1f07803): review 7 finding 1 fixed structurally (the step's scratch is one set passed to every function; the walker and the ghost each own one; the reported material, friction, sink and dust are the ground where the step ends); 1b found while proving it: a close row of boulders made the ghost start in mid-air so every trial failed and the run crawled (Earth 0.50 -> 2.34 m/s, Moon 1.03 -> 1.74 m/s past the first boulder; a lone boulder unchanged in 72 runs); finding 2 (SeaMap.rebase moves the published target; crest slide after a re-anchor 14.6/17.1 m -> 2.2/2.0 m, typical 2.4 m); finding 3 (the blend band a rectangle with continuously moving edges, new uniform uPhysSeaBand; new nodes ease from what was shown; the outer level resampled after a re-anchor; steps over 0.02 m or 2.9 degrees 9 -> 0). The ghost's worst CPU in one frame 0.75 -> 0.15 ms.
- Coordinator's check on a clean export of 1f07803: unit 140, physics 291, world 19; ghostfield.mjs at all six places and both gravities: radial speed while grounded 0, off the line 0, wrong-material steps 0, steps in the air 0 (worst step loss 0.55/0.52 m/s, the legs taking a face at their limit, allowed by P13); seamap-seams.mjs: 0 steps over the limit, 0 on build frames, warp after re-anchors 2.21 and 1.95 m against 2.36 m typical.
- Open (P19 notes): a close row still hides the next face from high on the previous boulder (met braced, allowed); the re-anchor is a pure translation only near the anchor on a 4 km world; physics.water() switches to the far estimate beyond 1024 m (0.1 m step); no GLSL compiled. PAINTER's sea-map wiring must copy uPhysSeaBand too (For PAINTER, P19).
- Art pass: groups 1 (earth) and 2 (inner) returned; groups 3 (giants) and 4 (ice) running.

### 2026-11-12 The art pass returned (owner's order)
- Workflow wf_1e083b58-6f0 completed: 14 agents (4 painters by group, 4 cross-verifiers, 1 same-painter judge, fixers, 1 integrator), 13.4 h, 0 errors. Commit 5f12995 (plus moon.js and mars.js carried earlier by the coordinator's art snapshots). 36 of 42 biomes improved, 1 unchanged (venus/fungal_towers), 5 reverted to base (earth/sea_coast, earth/misty_wetland, saturn/crystal_reeds, uranus/frozen_waves, neptune/aurora_tundra). Every change is look data in src/data/looks/<body>.js; common.js and looks.js untouched; the art commits touched only src/data/looks/ and docs/shots/art/ (coordinator checked every [art] commit's files).
- The full report is saved as docs/lead/ARTPASS.md (integration report, judge, verdicts, fixers), with the contact sheet docs/shots/art/sheet.jpg and 42 before/after pairs.
- Coordinator's check on a clean export of 5f12995: world 19, unit 140, physics 291, static rules, every module loads alone; the contact sheet opened and read: one hand across the planets (paper light, a light key, granulated skies, small darks, few boulders a step below their ground).
- The art role is closed: src/data/looks/ and docs/shots/art/ go back to PAINTER (tools/commit.sh painter).
- The weakest biomes after the pass, as the integrator ranked them: earth/misty_wetland, venus/lava_rivers, mercury/crystal_gardens, neptune/aurora_tundra, uranus/frozen_waves, moon/rilles, earth/temperate_forest, saturn/gold_islands, pluto/long_shadow_plain, earth/sea_coast. Most causes are shared code (the shadow glaze swamping local colour, boulder shape, the night key, per-body skies, airless haze, stands and views, coast terrain), which the data-only pass could not touch; they go to PAINTER 12.
- Coordinator's browser check on a clean export of 5f12995 (own script, one sitting, top tier, 640x360): the spawn and then all ten bodies by teleport at hour 11, each settled (8.7-23.1 s), info().fallback empty on every body (render, world, art, physics real; ui stub by design), 0 console errors, 0 page errors, 0 failed or external requests, window.__pc.errors empty. Frames opened: every body renders. The Mercury arrival's saturated violet boulders are still in view (flagged to PAINTER 12 and PILOT 10).
- Reported to the owner: improved and weakest biomes (the art pass order is fulfilled).

### 2026-11-12 PHYSICS 18 (P20) accepted; incident: shared scratch; rulings
- Accepted (95f79cc, 38a3266, 22df990): PC_TIMING suite 291/291 at load 3.8-5.9 (q2 gale in a tall wood 1.39 ms CPU; Neptune loose frame 1.45 ms against 1.5, close); twelve strips filmed and opened (tree-gust, clamber walk/side/row on the Moon, grass and trees under a second in the game, the storm frame passes the freeze-frame test, Moon boulder runs, floating on Neptune and Earth); the Moon boulder run in the game: thrown up at most 0.172 m, no boulder lifts the feet more than 0.1 m (PILOT's boulderrun.mjs still fails three flights off 37-44 degree crater walls, replayed in Node with the boulders removed: the same flights, real physics); fixed: the near field's re-anchor on every world (Moon 30 m out 2.31 -> 0.29 m), the floating explorer rides the drawn sea (correlation 0.04 -> 0.945), the sea is there on arrival (8 s off a gale coast 0.16 -> 1.06 m), no rain rings on a sea above Hs 0.5 m.
- Coordinator's check on a clean export of 22df990: world 19, unit 142, physics 296, every module loads alone; coast.mjs PASS at both stands (Earth sea_coast, Neptune storm_seas) on the head.
- INCIDENT: subagents share the coordinator's scratchpad folder; PHYSICS 18's first export to <scratchpad>/exp wiped the coordinator's exp/art while the coordinator's ten-body visit ran. That visit's "all passed" is therefore not trusted; the coordinator re-runs it on 5f12995 from a private folder (/home/user/.pc-scratch/coordinator/). From now on every agent works only in /home/user/.pc-scratch/<role>/ and the coordinator in /home/user/.pc-scratch/coordinator/.
- RULING (the 0.3 m rule and crater walls; physical behaviour = PHYSICS): the rule is about boulders; a run at 6 m/s off a 37-44 degree crater wall on the Moon leaves the ground because no runner can follow an edge sharper than about 29 m radius at that pace in that gravity. Kept. PILOT changes boulderrun.mjs to count a flight against a boulder only where the ground did not fall away by more than the boulder's height plus the limit (PHYSICS's two lines).
- RULING (a ship landed on water; feel = PILOT, physical behaviour = PHYSICS): a hull at rest on water floats, so it heaves and pitches with the drawn sea, averaged over its size. PILOT implements in the ship with physics.water() and a receiver the hull's size; PHYSICS supplies the numbers if asked.
- Open, PHYSICS next: the hard brace at a face or concave slope the read-ahead misses (the legs take the whole speed, not only the part into the slope); the close row; rain rings on grass; the float strips re-filmed after the arrival fix. PAINTER: splash rings softer, airless dust drawn as a fan of grains, spray blots near the lens, Neptune's near-black cliff slab, Earth's combed headland stripes.
- Coordinator's ten-body visit RE-RUN on 5f12995 from a private folder (/home/user/.pc-scratch/coordinator/visit-5f12995, git archive of the commit; nothing else writes there): ready after 320 s at load 12 (a first try timed out at 300 s), then the spawn and all ten bodies settled (10-35 s each), info().fallback empty on every body, 0 console errors, 0 page errors, 0 failed or external requests, window.__pc.errors empty; frames opened, every body renders. The report to the owner stands.

### 2026-11-12 PAINTER 12 accepted; RULING: the Moon is tidally locked, Earth hangs fixed
- Accepted (c08dddb, 418ac5b, e866f6e, 994074a; parts in the coordinator's snapshots db64b86, 50414f0): PHYSICS's sea map wired and compiled (uPhysSeaBand too; every shader links, no console message); both coast stands PASS coast.mjs (Earth sea_coast: a new island beach 2.4 km north facing ESE, its own storm checked with coastReport; Neptune storm_seas: a new coast-terrain key t.open opens a reach 2.3 km long and 34 m deep toward the eastern edge, the ice spires biome untouched, the stand on a beach 390 m south facing east, the easel on the cliff top; no seed, seaLevel, phys or sites changed); Earth's cliff barcode gone; Neptune's stacks crowned and skirted, dark rock kept off black; boulders broken and cleaved, collision matching the drawing; no boulder or shard within 6 m of a landing (Mercury's violet crowd and Mars' lozenge gone); venus/lava_rivers stand on the bank looking up the river; moon/rilles stand on the rim; the night key floor (Mercury 23 h land L 8.4 -> 21-25); misty_wetland's sky pales; no halftone on near shallows; an aurora by day over Neptune's tundra; the blizzard crest broken; airless haze (small); PILOT's review 6b obstacle queries and arrival.mjs.
- Coordinator's check on a clean export of 994074a: world 19, unit 146, physics 296, every module loads alone; coast.mjs PASS at both stands. Frames opened: p12-coasts.jpg (the new Earth stand reads as an open-sea painting) and p12-neptune-aurora-storm.jpg (the aurora is faint green veils; the storm stack is grey now but still one big smooth flat-sided block, the storm sky carries ruled horizontal dashes, and white horses are scarce in that frame).
- Weak and owned (PAINTER 13): narrow headlands came out up to 23 m lower (Earth's easel lost its near hill), a regression; the autumn crowns and Mercury's crystals (leaf washes and the twilight dusk key, wish 4); Venus' lava reads as a leopard print; Neptune's storm stack and sky dashes; splash rings, lens spray and airless kicked dust never seen in a frame; Earth's storm not re-filmed after P20; item 4.
- RULING (the Moon facing Earth; PAINTER said it depends on the clock): it does not. In src/data/bodies.js the Moon's orbitPeriod equals its dayLength (3600 s) in the same sense, so it is tidally locked: the coordinator computed Earth's direction in the Moon's own frame over t = 0..10000 s and it stays at (-0.891, +-0.03, -0.453) (the 0.03 is libration from the axial tilt). Earth hangs fixed in the near side's sky. PAINTER 13 moves the Moon's arrival and stands to the near hemisphere so Earth stands in view, facing it; the coordinator authorises changing the Moon's sites for this (PILOT checks the tests that depend on them). Nothing in the clock changes.
- Neptune's season (axialTilt 0.49 flip, PILOT's file): PAINTER says yes for the look; PILOT decides on feel and architecture and implements if no objection.

### 2026-11-12 PHYSICS 19 (P21) accepted; rulings
- Accepted (3cd06dc, 243c187): the brace made physical (a missed face pushes along its own normal: the legs take only the speed into it, the soles hold the sideways push, the speed along the face is kept; a run onto a slope keeps v cos^2 within 2 %; the Moon crater rim case 6.95 -> 1.95 m/s became 6.95 -> 4.09 at worst); the legs' base no longer sinks between close boulders (Moon close row slowest 1.74 -> 2.38 m/s); no rain splash on grass, moss, litter, sand, dust, ash, gravel or snow, wet rock and mud unchanged (512/512/221 -> 0); float strips re-filmed and right (Neptune Hs 2.97-4.87 m 15 s after arriving); the floating explorer copies the shader's 0.06 m shallow lift; coast.mjs's target is now duration-limited (what the same wind history raises over 2.5 km of 20 m water by the game's growth law: Neptune 4.19 -> 2.96 m, Earth 0.68 -> 0.52 m).
- Coordinator's check on a clean export of 243c187: world 19, unit 147, physics 300, every module loads alone; coast.mjs PASS at both stands with the new targets (Neptune 3.51 m also cleared the old mark); ghostfield.mjs all zeros (worst step loss 0.39-0.47 m/s).
- RULING (coast.mjs target, Decision 56): accepted. A sea grows with how long the wind has blown as well as with fetch (duration-limited growth); a target the squall cannot raise is not physics. Both stands passed under the old target too, so no goal moved to rescue a failure.
- RULING (the close row; PHYSICS asks to redefine a clean crossing, which moves P16/P17's tested numbers): allowed. The tests guard what the player feels: speed lost per step, braces, feet on the ground, the 0.3 m rule and no flights off boulders. A new standard is kept only if those hold or improve across every measured case (single boulders, off-path, close and spread rows, Moon, Mars, Earth); P16/P17 tests may change their numbers where the notes say why.
- Open, PHYSICS 20: the arrival sea from the wind's history (a player arriving before a squall's peak sees 6.04 m where one who stood through it sees 3.51 m); the Moon boulder's hold over the top (7.15 -> 2.52 m/s in the game strip, the read-ahead held no pace); a 43 degree hill on Mars and Earth read as a face and run at 1.1-1.2 m/s; feet leave the ground over rim crests met at speed (a 0.31 m flight, 0.01 over the limit, where the ground falls away: allowed by the crater-wall ruling, but the walker should read crests); the close row standard; PC_TIMING when the load allows.

### 2026-11-12 PHYSICS 20 (P22) accepted
- Accepted (e20f900, a7e47c7, b2aa445): the Moon boulder's hold over the top gone (the explorer keeps the ground ahead as a row of samples and limits how fast the hips rise and fall: the strip case 7.15 -> 2.52 m/s on top became 7.40 m/s throughout, no brace, no hold; 23 of 24 field numbers better; feet off at most 0.21 -> 0.05 m); three read-ahead faults fixed; crests read (pace limit sqrt(2(g+grip) stroke)/(s1+s2) with a 0.92 margin; boulderrun replayed in Node: thrown up 0 in all eight headings, feet off in one of eight off a 56 degree wall falling 4.47 m; the cost is pace, 5.0-6.2 -> 3.0-6.0 m/s mean at the site); a 43 degree hill is a hill, not a face (slowest on it 1.07-1.26 -> 4.16-4.23 m/s); the close-row standard measured and kept (no new standard held in every case); the arrival sea from the last 360 s of wind (Neptune arriving before the peak 6.04 -> 3.69 m, standing through it 3.70 m).
- Coordinator's check on a clean export of b2aa445: world 19, unit 148, physics 305, every module loads alone; coast.mjs PASS at both stands; ghostfield.mjs all zeros (worst step loss 0.26 Earth, 0.52 Moon).
- For PILOT: src/core/sim.js obstaclesNear radius 9 -> 16 m (the read-ahead looks 12-13 m out at a lunar run). Relayed to PILOT 10.
- Open: the hold on the descent off a small rim (4.70 -> 1.98 m/s in the film); crests are read as sharp corners, so rounded brows slow the run more than they need to (feel: the slowing before crater rims may be heavy); three Moon row numbers slightly worse; PC_TIMING not run (load 9-14); game-float-earth and the grass strips not re-filmed. PHYSICS 21 started on these.

### 2026-11-12 PAINTER 13 accepted
- Accepted (d93944b, 7a51d42; parts in snapshots 97b6641, aaa0d8a, 67874a1): the headland regression fixed and the barcode's real cause found (the land stepped 10-20 m within a metre where the cliff line's wobble was high; an even ramp with a ledge, crags on the face only, the rise brought in over the land's first 2 m; steps over 8 m in a metre around the easel 104 -> 0; the near hill 41 m); the Moon's arrival and four stands on the near side facing Earth (Earth 14-20 degrees up; sites unchanged, every biome already reached the near side); Neptune's big stack stepped with a broken crown; the storm sky's ruled dashes were the rain (strokes now vary, taper and break); dark rock under a storm key dense indigo; white horses were a rendering problem (under the brush's 3 px, removed), now at least 3 px and broken along the crest, read from the water and the beach; splash rings faint and soft; lens spray wisps; airless dust a fan of dark flecks; autumn crowns in their own colour under half the cool glaze; Mercury's crystals catch light through their bodies (rose and lilac, not one ultramarine); Venus' lava crust in rafts and along the banks cut by lines of fire; a cooler twilight key (small).
- Coordinator's check on a clean export of 7a51d42: world 19, unit 148, physics 305, every module loads alone; coast.mjs PASS at both stands. Frames opened: p13-moon-arrival (Earth stands in the upper third over the arrival and the mare stand) and p13-neptune-stack (the stack stepped and crowned, the rain no longer ruled, surf at the beach).
- Found: Ephemeris.setSunHour spins a tidally locked body without turning its orbit, so booting on the Moon or any teleport with an hour moves Earth out of the Moon's sky (normal play from Earth does not). PILOT fixes it (orbitShift turned with the spin for a locked body, kept by save.js; exact code in painter.md "For PILOT (13)").
- For PHYSICS: at Neptune's storm stand the explorer once measured 141.4 m/s of wind, was blown 19 m and began climbing the cliff (clock 245 after a set to 222); at 237 and 247 the wind was 14.3 m/s. Relayed to PHYSICS 21.
- Weak: the stack's values barely change under the storm key; the rille reads as a pale shallow dip; some round crust spots on Venus; each near autumn crown one flat mass; Earth's white horses sparse; item 6 not done. PAINTER 14 started (finishing block).

### 2026-11-12 PHYSICS 21 (P23) accepted; RULING on knife edges; MILESTONE 3 CLOSED
- PHYSICS 21 accepted (f656310, feef4e0): the gale (Neptune's 141 m/s is a real output of the gust model, sigma/U about 0.4 on a 60-75 m/s squall; once the wind's push passes half the body's weight the walker gets low, reads the wind at 0.4 m, adds hands and knees, and the suit's thrusters push back what the soles cannot hold beyond 60 % of grip, up to the jetpack's 1700 N; blown 41 m up the cliff -> 0.00 m; walking out of the storm still works); the rounded-crest law measured (v^2 = (g + grip)(R + 2 stroke/turn^2)) but not shipped; PC_TIMING at load 7.97: 306 pass, every timing check ok (walk 0.756 ms, q2 gale 1.20 ms CPU, Neptune 1.42 ms); six strips filmed and opened (the gale strip opened by the coordinator: the explorer holds the waterline through the squall).
- Coordinator's check on a clean export of feef4e0: world 19, unit 150, physics 306, every module loads alone, coast.mjs PASS at both stands.
- RULING (knife edges at crater rims; feel = PILOT, physical behaviour = PHYSICS; PILOT's verdict "too heavy: keep 4.5 m/s or more and let the runner leave the ground" against the coordinator's instruction to keep contact wherever P22 measured it): PILOT's version. Replace P22's knife-edge pace law with "don't throw the runner up": the 0.3 m rule stays (thrown up 0 in every heading), and a runner may leave the ground where the ground truly falls away (the crater-wall ruling), which on the Moon is honest low-gravity physics. Measured by PHYSICS at the site: mean pace 4.25/4.88/2.96 -> 5.04/5.68/3.29 m/s, thrown up 0, flights of 2.2-4.3 m off 53-55 degree walls. PHYSICS 22 ships it with tests and checks the descent hold under it.
- MILESTONE 3 CLOSED. PILOT 10's review 6 (second half), docs/lead/REVIEW.md section 6: every M3 item MET (motion: wind, water, weather, day-night; space washes; painted UI theme; the art pass; HUD; sketchbook and vistas; audio measured; performance tiers as logic; title screen and help card); MUST FIX open: none. all.mjs 13 of 13 passed in a clean tree; the grand tour passed 8 of 8 in one sitting (a new player from the title card: walk, jetpack, board, space, land on all eight planets, every landing on the first E, no console error, 39 minutes); the top-tier tour of all ten bodies settled with no console error. SHOULD FIX carried to M4 (look, PAINTER): Pluto's and Mercury's arrival boulders, night at quality 0, Neptune's stacks, Mars from orbit, Saturn's walled vista, foliage edges in specks, flat flower ellipses, Venus' arrival, Uranus' one value range. Not measurable here: frame rate on an integrated GPU, sound as heard, real mouse and pad.
- M4 plan: PAINTER 14 finishes its block (first ten minutes, arrivals); then the critique swap (each role plays the whole game and writes a blunt critique of the others' domains), the worst issues fixed, then PILOT merges, runs every check, opens one PR cosmos -> main and merges it.

### 2026-11-12 PHYSICS 22 (P24) accepted
- Accepted (681e9d2, c4d2242): the knife-edge ruling shipped (wayCrest's knife-edge pace law v = sqrt(2 g legFold) x crestMargin / s1; mean pace at the boulderrun site 4.25/4.88/2.96 -> 5.04/5.68/3.29 m/s in headings 0/180/315, the other five unchanged; thrown up 0.000 in all eight headings; two flights off ground that falls away, 4.05 m off a 53 degree wall and 2.22 m off a 55 degree wall); new test 'P24 the knife edge' (the run reaches the edge above 3 m/s on the Moon, Mars and Earth, thrown up at most 0.15 m); motion-game-moon-boulder re-filmed and opened, the same as P23 (it meets no knife edge in 3 s).
- Coordinator's check on a clean export of c4d2242: world 19, unit 150, physics 307, every module loads alone, coast.mjs PASS at both stands, ghostfield.mjs all zeros.
- Not done (measured; risk too high for a finishing block): the descent hold off the small rim (now 3.84 -> 1.27 m/s; P21's hold on the way down caps the pace at about 1.2 m/s where the ground a look ahead is within a clamber; the fix lets the hold go where the ground truly falls away, which touches the hold that keeps contact over boulders); the edge pace (about 3.5 m/s on the Moon, not the law's 6.3); heading 315 without boulders 3.17 -> 2.68 m/s; the Moon rows. Left to the M4 critique swap to rank against everything else.

### 2026-11-12 PILOT 10 accepted; M4 begins: the critique swap
- PILOT 10 accepted (9c93e77, a0e3fb1, dc876f9, a46b6ee, 2af3e51, ce7e69d, c95bd4e, 6f79340, 7a510be): review 6 second half and M3's verdict (logged above); the world's own clock drives every hour PILOT sets; Saturn's whole ring from orbit; the arrival steps off boulders; a landed ship floats on the drawn sea; the swim camera smoothed; boulderrun reclassified per the ruling; Neptune's axialTilt -0.49 (spawn sun 2 -> 36 degrees; orbits unchanged); ship berths out of the surf; the third-person camera keeps the feet in frame under a rise; the 16 m obstacle look-up; a locked body's orbit turns with its spin (Earth stays within 2.3 degrees in the Moon's sky when an hour is set, was up to 178.5). Unit 150. Feel verdict on rim slowing: acceptable at 4.6-6.1 m/s, too heavy where it drops to 3 m/s (the knife-edge ruling, shipped in P24, answers the worst of it).
- Open for PILOT: the landing chase camera sits inside birch crowns as the ship sets down (372 pops in the landing motion set).
- M4 (the brief): "Each session plays the whole game and writes a blunt critique of the other's domain. Fix the worst issues. Pilot merges Painter's final branch, runs every check, opens one pull request to main, and merges it." With three roles, each critiques the other two: PILOT 11 (PAINTER's look and PHYSICS's behaviour) and PHYSICS 23 (PILOT's feel and PAINTER's motion) start now; PAINTER critiques PILOT's and PHYSICS's domains once PAINTER 14's finishing block ends. Critiques go to docs/lead/CRITIQUE.md (one section per critic). Then each owner fixes its worst items; then PILOT ships.

### 2026-11-12 PHYSICS 23 (P25) accepted: critique of PILOT and PAINTER; RULING on white water
- Accepted (bb2a427, 2f924cd): docs/lead/CRITIQUE-PHYSICS.md with 98 evidence files in docs/shots/physics/critique/ (two real-game runs from the title card and by teleport, no console or game error; Node replays for the numbers). FIX FOR SHIP, PHYSICS on PILOT: (1) the ship jumps 16 m up in one frame at the end of every lift-off under trees (the free-flight clamp puts the hull on the crowns), including the first lift-off; (2) the landing assist brakes 46 -> 14 m/s in 0.4 s (18 g), a slow E lurches at 4.4 g then drops at 13 m/s into the wood; (3) the ground assist rewrites the hull's velocity after PHYSICS moved it (one-frame jolts of 16-35 g; a 22 g climb at a 60 degree slope with the nose down), and the chase camera fixed to the hull shows every jolt; (4) cameras through crowns (the foot camera on the jetpack; the landing camera fixed in b0e9aba, not filmed); (5) swimming is an upright glide. FIX FOR SHIP, PHYSICS on PAINTER: (1) the figure ignores the wind (PHYSICS leans 23-33 degrees in Neptune's squall; the scarf and coat hang still; PILOT's figure.js must pass the lean on); (2) no swimming pose; (3) crowns from inside are flat green slabs; (4) the storm sea reads calm at quality 1; (5) the falling pose is used on the way up an arc. Own fix: no boot puff in the spawn glade (a forest floor is litter only under closed cover).
- Coordinator's check on a clean export of 2f924cd: world 19, unit 152, physics 308, every module loads alone.
- RULING (white water capped at 15 %; physical behaviour = PHYSICS, look = PAINTER): lift the cap. At hurricane force the sea is almost all foam and streaks (Beaufort 12), and a 75 m/s squall is beyond that; a whitecap law (Monahan-type, coverage rising with about U^3.4) saturating toward full coverage is the physics. PHYSICS changes it with coast.mjs's targets by the same law; PAINTER paints whatever fraction comes as broken foam, streaks and spray, never a flat white area, and judges it in an opened frame. In the fix round, low risk first.
- PHYSICS's top five on PILOT relayed to PILOT 11 for its own-side fixes now.

### 2026-11-13 Usage limit; OWNER: continue on the new model at extra-high effort, workflows for the hard parts
- PILOT 11 and PAINTER 14 were cut off by the account's weekly limit on the old model (2026-11-12, about 22:15 UTC); the container restarted afterwards. Nothing was lost: the working tree was clean and in sync (the coordinator's snapshots 45c5176, 8809fff, 76d8182 hold PAINTER 14's work; PILOT 11's commits b0e9aba, 904b6fe hold its camera fix, its partial critique docs/lead/CRITIQUE.md and its instruments in docs/lead/evidence/pilot11/).
- OWNER (2026-11-13): continue, with every agent on the newer model at extra-high effort, and multi-agent workflows for the hard parts. Successors are fresh agents (the cut-off ones are not resumed on the old model).
- Coordinator's check on a clean export of 76d8182 after the restart: world 19, unit 152, physics 308, every module loads alone, coast.mjs PASS at both stands.
- MUST FIX found by PILOT 11's critique and reproduced by the coordinator on the head (docs/lead/evidence/pilot11/wallrun.mjs, Earth sea_coast): THE EXPLORER RUNS UP CLIFFS. Shift+W into a 70-79 degree face climbs 49-50 m at 5.6-6.0 m/s in three of eight headings. A regression bisected by PILOT to PHYSICS P22 (e20f900, "the way, seen"); no physics test catches it. PHYSICS 24 starts on it now.
- Where M4 stands: PHYSICS's critique is in (CRITIQUE-PHYSICS.md); PILOT's is partial (three items on PHYSICS, nothing yet on PAINTER); PAINTER's is not written; PAINTER 14's finishing block has no hand-over.
- Plan (workflow "m4-critique-fix"): the two missing critiques finished in parallel; then a fix round per role on its FIX FOR SHIP items (each role edits only its own paths and commits with tools/commit.sh); each role's fixes checked by an independent, adversarial verifier on clean exports; what fails verification goes back to the fixer; last, an integration run (every check, a ten-body visit) and a blind new-player play-test. The ship step (PILOT runs every check, opens one PR cosmos -> main, merges) stays outside the workflow, on the coordinator's explicit message after its own verification.
- Started (2026-11-13 01:20 UTC): PHYSICS 24 on the cliff-run regression, the white-water cap, the sudden checks on arrival ground and the figure's state; and the workflow m4-critique-fix (run wf_6c419efc-378): critic:PILOT and critic:PAINTER in parallel, then per role fix -> independent adversarial verify -> re-fix, then an integration run (every check, a ten-body visit) and a blind new-player play-test. The workflow runtime runs two agents at a time on this machine. Each role edits only its own paths; verifiers, the integrator and the new player edit nothing.

### 2026-11-13 PHYSICS 24 (P26) accepted: the cliff run fixed, the white-water cap lifted
- Accepted (ee39533, a70d668, 4338242, 526883f). (1) MUST FIX closed: the explorer no longer runs up cliffs. Cause: since P22 the legs are "at work" at the foot of every rise, and the limbs' hold (no gravity along the face) was given to anything standing out of the ground, a cliff as much as a boulder. Fix: a wall (a facet steeper than the limbs scramble, any ground to 47 degrees, rock to 53.5 on Earth, 57 on Mars, 62 on the Moon, from which the ground goes on up more than a clamber) gives no hold and no step; a runner who sees one stops at its foot. Three new tests, each failing on the head. (2) The white-water cap lifted per the ruling: cover = max(the steepness law, 1 - exp(-whitecap01 x 3.84e-6 Ue^3.41)); Earth 15 m/s 5.2 % (as before), 30 m/s 33.5 %, 55 m/s 96.3 %; Neptune's squall 100 %; coast.mjs's targets by the same law. (3) The figure's state documented in one place and extended (leanV, relWind, swim, stroke, vUp, airTime, arc, wall). (4) Wading throws about five times the spray at a run.
- Coordinator's check on a clean export of 526883f: world 19, unit 152, physics 314, every module loads alone, coast.mjs PASS at both stands, ghostfield.mjs all zeros (worst step loss 0.26 / 0.52 as before), and PILOT's wallrun.mjs: Earth sea_coast 0.2 / 0.2 / 0.2 m gained on ground over 50 degrees (the head: 49.9 / 49.0 / 49.7), desert_canyon 1.1 / 0.2 m (30.7 / 24.4), every other heading 0.0. Both strips opened: motion-game-cliff-earth.jpg (the explorer stands at the foot of the face from the first second to the twelfth) and motion-game-gale-neptune-p26.jpg.
- Open, PAINTER: the lifted cap is in the numbers and not in the picture. With the field's white share at 100 %, Neptune's squall sea is the same dark indigo with a few white dashes (the strip opened; the coordinator agrees). Relayed to the PAINTER fixer at the top of docs/notes/painter.md.
- Open, PHYSICS (measured, not fixed; for the workflow's PHYSICS fixer): Pluto's spawn check (heading 135, 1.27 m/s: the crest law's stale trend at a summit; the tried fix throws the runner up 0.26 and 0.47 m at boulderrun heading 315, so it was not shipped); Neptune storm_seas still drifts 5.9 m along a 53-58 degree face (35.0 before); a 43 degree hill is still run at 6.15 m/s level on Earth where the legs' power gives 4.35; PILOT 12's new items (the rain stall on a wet bank, Neptune's storm throwing a hovering ship, first-storm timing, the swimming glide, weather names).
- Open, PILOT: Mercury's spawn check (heading 0, 1.58 m/s) is collideObstacles on a 2.2 m column, not PHYSICS'; the figure's state to pass to the model with a 'swim' mode; timeBudget: false in the Node instruments (with the budget on, a run that enters the water does not repeat to the digit). Relayed at the top of docs/notes/pilot.md.
- Noted: PHYSICS 24's four commits carry no attribution trailer (it read the no-model-name rule as forbidding it). Left as they are: rewriting pushed history under running agents is the greater risk.
- The workflow: critic:PAINTER finished (aaf28cf: docs/lead/CRITIQUE-PAINTER.md, 17 items on PILOT, 10 on PHYSICS, 71 evidence pictures, the whole game played at the top tier with no console error); critic:PILOT (the twelfth PILOT agent) is still writing (two interim commits 90bb703, cf7711c). The fix round starts when it returns.

### 2026-11-13 Container restart at 05:08 UTC; the workflow resumed
- The critique swap is complete: critic:PILOT returned (336070e: docs/lead/CRITIQUE.md whole, 'PILOT on PAINTER' 14 items and 'PILOT on PHYSICS', evidence in docs/lead/evidence/pilot12/); critic:PAINTER returned earlier (aaf28cf). With PHYSICS 23's CRITIQUE-PHYSICS.md, each role has critiqued the other two.
- The fix round began at 04:09 UTC (fix:PILOT, the thirteenth PILOT agent; fix:PAINTER, the sixteenth PAINTER agent). At 05:08 UTC the container restarted (cause not known; the second restart of the project) and stopped the workflow with both fixers an hour in. Nothing was lost: the working tree survived on disk; finished commits dea95fb (PILOT: PHYSICS' body state reaches the drawn figure) and b579366 (PAINTER: night in its own key); the work in progress is in the coordinator's snapshots 3f13484, 8418918 (before the restart) and 3def4e7, c03bce6 (after it).
- Resumed (05:20 UTC) as the same run (wf_6c419efc-378, task we0wclnde): the two critics' results come from the journal; the fixers are fresh successors, each told what its predecessor finished, which snapshot commits hold half-done edits (finish and prove, or revert), where its scratch is, and to commit each finished item at once and keep its hand-over current, since a restart can come at any time. The PHYSICS fixer is told PHYSICS 24 has finished and was verified.
- OWNER (2026-11-13, standing instruction, not to be acted on now): when the current model's usage runs out, switch over to the next model down at extra-high effort. For the coordinator this means: agents cut off by a usage limit are replaced by fresh successors started on that model at extra-high effort (the Agent tool's model and effort; in a workflow, the agent call's model option), with the same hand-over rules as after the last limit. The coordinator cannot change its own session's model: if the limit stops the coordinator too, the owner switches the session, and the workflow is then resumed from its journal.

### 2026-11-13 M4 fix round: where it stands at 12:20 UTC; second container restart (10:19 UTC)
- FIX ROUND, all three roles returned (results in the workflow's journal; a copy at /home/user/.pc-scratch/coordinator/m4-journal-results.json):
  - PILOT (fourteenth agent; b289c21, 7ee3620, f7b757a, 52e74d1, 6cfab48, da9a49f, 507486f): 19 items claimed, among them PHYSICS' body state to the drawn figure; the 16 m jump at the end of a lift-off under trees (16.25 -> 0.00 m); the landing assist (largest step 3.10 -> 0.23 m/s, descent 12.98 -> 6.00 m/s); the ground assist (8.55 -> 0.40 m/s); swimming; boarding (fastest turn 130 -> 65 degrees a second); the jetpack's refill; HUD wrapping; stepping out no longer frames the wing (hull over a sixth of the frame in 52 -> 1 of 52 landings); the sketchbook draws a kept frame as a sketch; a view is offered at an easel; the clock (first sunset 7.4 -> 11.2 minutes in, a new game starts at 8 h); slips keyed to night and space; the title card. Not fixed, named: 6.5 g turns (left as the ship's feel), the cockpit's eye point, Mercury's column, a 640 px HUD scale.
  - PAINTER (sixteenth and seventeenth agents; b579366, 608b687, 70aec16, 7d27bf4, e784574, a8437ca, 1aa9718): night in its own key; the storm and mist key with rain that can be seen; round worlds from orbit, Neptune's belts, Pluto's heart; Jupiter's arrival palette (in part); the figure (wind lean, swim pose, arc pose); crowns at the lens break into dabs; the storm sea shows the lifted white share (Neptune's squall a pale driven sea with streaks); Uranus' arrival (value spread 14.8 -> 25.9); the grey-violet band below space; the arrival veil no longer blanks the picture for a fast ship. Not fixed, named: Jupiter's first view has no island edge (needs a new spawn), Pluto's long shadows, crisp white horses on Earth's coast.
  - PHYSICS (twenty-fifth agent; 141997f, 33786a9, 9917fab, 9addf0b, a686a98; hand-over P27): rain no longer stops a walk dead on a bank; the first day is fair, the first storm at the second noon, no evening mist, the ground dries; the ship holds in Neptune's squall; the figure is handed the gust; snow strokes capped at the lens; a swimmer and a wader mark the water; weather names in a gale. Eleven new tests, each failing before its fix. Not fixed, named: the fair day's motion floor (built, measured, lost in the drawing: for PAINTER); the scramble at Neptune's storm coast (4.5 / 2.2 / 6.0 m); the checks at rims and boulder rows (Pluto's spawn); swimming as a stroke.
- VERIFY (independent, adversarial, on clean exports):
  - PAINTER: 8 of 9 hold; one fails with three regressions, two of them serious: THE WALK AND THE RUN WERE BROKEN (a variable in the leg's code hid the swim weight: ankles up to 0.7 m out of place on land) and TRUNKS NEAR THE EYE WERE CUT INTO FLOATING BLOCKS. RE-FIX (eighteenth PAINTER agent; 5de71a7, 91fd6bf, 7265ff0): all three fixed, with a new guard in src/world/figure.test.mjs that reads the ankles from the model; world 22, unit 181, physics 324.
  - PILOT: 15 of 19 hold; four fail and nine regressions, two MAJOR: the new crown rule for the foot camera cuts the third-person view into the explorer's eyes on every walk in a wood (figure not drawn in 143 of 720 steps of the first walk of a new game; 0 before the round) and on stepping out at Earth's, Saturn's and Neptune's spawns. Also: the target's label on the ship when the nose is 3 to 8 degrees off; Pluto's jetpack still never comes down with burn-and-coast (and the README says it cannot happen); a swimmer asked to turn about swims backward 5.8 s; assisted landings take twice as long (9.9 s for 4.7 s, by design); the easel's walk can carry the explorer over a cliff. The RE-FIX was eight minutes in when the container restarted.
  - PHYSICS: the verifier was 27 minutes in at the restart.
- SECOND RESTART (10:19:29 UTC; the session came back at 12:10): both agents' running commands were killed in the same second (exit 137), then nothing more was written. Most likely the machine ran out of memory (16 GB, no swap; a top-tier browser, two Node suites and a world-building instrument at once), and the kernel's killer took the session's own process. Not proven: the old container's logs are gone. Disk is not the cause (11 GB free of about 40).
- Measures: (1) a watchdog (/home/user/.pc-scratch/coordinator/memwatch.sh, started detached) logs memory every 15 s to /home/user/.pc-scratch/coordinator/mem.log, which survives a restart, and ends the largest browser process (else the largest Node process that is not the session) when under 1.3 GB is free; (2) every agent started from now on is told: one browser at a time and closed when its frames are taken, never two suites at once, free -m before a browser.
- Resumed at 12:17 UTC (the same run, task win73533w): from the journal come both critiques, the three fix rounds, verify:PAINTER, verify:PILOT and refix:PAINTER; started afresh are refix:PILOT (told of its predecessor's half-done edits in the coordinator's snapshot 6e550ce, with which 2 of 181 unit tests fail: finish and prove or revert; the foot camera's crown rule may be taken out if it cannot be made right) and verify:PHYSICS (may reuse its predecessor's exports and scripts).
- For the ship step (the final PILOT agent, after the workflow): move the weather and motion films' clocks by PHYSICS' +1530 s (tests/weather.mjs, tests/motion.mjs; neither is part of all.mjs); Mercury's column at the spawn; the README's line on the jetpack; then every check, one PR, merge.
- OWNER (2026-11-13 12:21 UTC): "Switch to opus 5.5 extra on ultracode for the rest of what's left." The owner switched the session's model; the coordinator stopped the running workflow (its two live agents, refix:PILOT and verify:PHYSICS, had run four minutes and only read) and resumed it on the new model at extra-high effort: the workflow's agents take the session's model, so every agent from here runs on it, and every finished agent's result still comes from the journal. The remaining work (the PILOT re-fix, the PHYSICS verify, the integration run, the blind play-test, and after the coordinator's own check the ship step) runs as workflows. The PILOT re-fix also moves the weather and motion films' clocks by PHYSICS' +1530 s.
- Note on the resume (12:25 UTC): the first resume on the new model also re-ran PAINTER's finished re-fix pass, because the workflow matches cached calls in call order and the PHYSICS verify (with a changed prompt) came first. Stopped within three minutes (nothing written); the script now takes a finished pass's result from the coordinator's args. Running now on the new model: refix:PILOT and verify:PHYSICS only.

### 2026-11-13 The M4 workflow finished (15:30 UTC); the blind play-test; a last fix round before ship
- RE-FIX on the new model: PILOT (seventeenth agent; 51cdda2, 1146112, 5fd7a0a, 246fce6, b1831e2, bafcfc7): both MAJOR regressions fixed (the foot camera's crown rule now in the air only, never under 3 m, crowns by plant kit: no eye view on walks; the explorer in frame on stepping out at every spawn); Pluto's jetpack now comes down; labels stay off the ship; a swimmer turns about in 0.75 s; the easel's walk stops short of cliffs; the films' weather clocks moved by +1530 s. Not fixed, named: the landing camera beside a crown for 1.5 s (four attempts reverted); assisted landings twice as long (by design). PHYSICS verify: 9 of 9 hold; one minor regression (descents on wet or soft slopes slowed by P27's short steps) fixed by the twenty-sixth PHYSICS agent (da44e1f, a new test).
- INTEGRATION on a clean export of 3d38bb2 (confirmed by the coordinator's own run on a clean export: world 22, unit 184, physics 325, coast.mjs PASS at both stands, ghostfield all zeros, wallrun 0.2 / 0.2 / 0.2 m): world 22, unit 184, physics 325; coast.mjs PASS at both stands; ghostfield all zeros; wallrun 0.2 / 0.2 / 0.2 and 1.1 / 0.2 m; every module loads alone; node tests/all.mjs ALL 13 PASSED in a clean tree (42 minutes); the ten-body visit clean (no console, page or request error, fallback empty, every arrival on foot and grounded).
- BLIND NEW PLAYER (README only, real keys and mouse at 960x540, 3 h 45 min, 0 console errors): started in Earth's forest, walked, ran, waded, jetpacked over the canopy, boarded, lifted off, reached space, used the map; LANDED ON ONLY 3 OF THE 8 OTHER WORLDS (Mars, Venus, Uranus). Broken for a new player: "F Pulse to Saturn" is offered while the mark is off-screen and F then flies along the nose, away (three times); in deep space after re-boarding on Venus the mouse no longer steered and the target above could not be brought ahead (25 minutes and a reload); pointer lock's drag fallback re-captured the pointer on every click and a pitched-up camera was saved. Confusing: no way to find the parked ship on foot; a pulse dropping out at a world in the way without a word. Ugly: stair-stepped figure and ship at tier 0 and half scale; Mars at night, Uranus' fog and Venus' haze nearly one flat colour. Best moment: dawn on Mars. The coordinator opened eight of its frames (the pulse prompt with Saturn's mark above, Mars by night and at dawn, Venus, Uranus at both tiers, the jetpack over the canopy) and agrees.
- RULING: "Done means" says a new player lands on all eight planets; the play-test shows that is not yet true for a new player, so the game does not ship yet. One more fix round, the last: workflow m4-preship (run wf_ab67bba1-148, task wxvcqc56v), on the new model at extra-high effort: PILOT (the pulse goes where the course says, with a test from Earth's orbit to every planet with the mark behind, above and beside; steering in deep space and after re-boarding; the pointer-lock fallback; a slip pointing to the parked ship; HUD overlaps; the README; Mercury's column; then the grand tour) and PAINTER (the column of leaf dabs in Earth's alpine_meadow sky at quality 2, found by the PHYSICS verifier; soft silhouettes at half scale; value structure in Uranus' fog, Mars' night and Venus' haze) in parallel; each verified adversarially and re-fixed once; then the integrator (every check, all.mjs, the grand tour, a top-tier ten-body visit with every frame opened) and a second blind player whose goal is all eight planets. After it the coordinator's own check, then the ship step.

### 2026-11-13 The pre-ship round; the second blind player; the last fixes (22:40 UTC)
- PRE-SHIP ROUND (workflow m4-preship, run wf_ab67bba1-148): PILOT (eighteenth and nineteenth agents; b0710fe, 5ba725f, 22120b9, 015bc21, 23e7c81, da7d587, 37e7573, 45629a7): the pulse goes where the course says (F turns the ship onto the course, then pulses; never into or round the chosen world); steering above the air; C sinks; pointer lock's fallback holds; a slip points to the parked ship; HUD overlaps; Mercury's column; the grand tour PASSED 8 of 8 twice. PAINTER (nineteenth and twentieth agents; 8c7d603, 25074de, 18c1e33, 4bbbae4, d9f0ea4, db31c96): the column of leaf dabs in Earth's alpine sky; soft silhouettes at half scale; value structure in Uranus' fog, Mars' night and Venus' haze. Both verified adversarially; the findings re-fixed once.
- INTEGRATOR on a clean export of 45629a7: world 25, unit 202, physics 325, coast.mjs PASS, ghostfield all zeros; the grand tour passed; the TOP-TIER ten-body visit clean (every world settled, no console, page or request error, fallback empty; the coordinator opened all ten frames: each a watercolour inside its paper border). BUT node tests/all.mjs FAILED two steps, m3 and painted-m3, on one check: "the first landscape walked gets a sketch: []". The coordinator reproduced it on the head and bisected it with tests/m3check.mjs on clean exports: b0710fe passes, 45629a7 fails; the change between is PILOT's 5ba725f (SKETCH_SLIP.shipWait 30 -> 45 s and a levelView when the lock is judged thrown). The pre-ship PILOT rounds had not run all.mjs.
- SECOND BLIND PLAYER (README only, real keys and mouse, 960x540, 0 console errors): LANDED ON AND WALKED ON ALL EIGHT PLANETS (Earth, then Mercury, Venus, Mars, Jupiter, Saturn, Neptune, Uranus) in about 1 h 35 min of play. "Done means"' landing item is met for a new player. It met: the first Space hold after boarding ignored once; other worlds' labels shown through Venus' atmosphere; about 15 minutes stuck in a slot canyon on Mars with the camera jammed into the walls; dark spires that seem to hang above Saturn's horizon; hard-edged dark-blue polygons at the frame corners on Neptune (a freeze-frame fail; the coordinator opened the frames and agrees); Uranus the dullest world. Best: the canyon on Mars, Jupiter's banded sky, Venus' mushroom forest.
- OWNER (22:10 UTC): "use whatever it has now and continue with the rest": the play-test was stopped after 1 h 40 min with the landing goal met; its log and frames are in /home/user/.pc-scratch/verify/player2/.
- LAST FIXES (workflow m4-last-fixes, run wf_382773db-47c, task wsxqrmx9n): PILOT fixes the failing m3 check first and must end with all.mjs ALL PASSED in a clean tree, then the player's small items if safe; PAINTER the Neptune polygons and Saturn's spires if safe; each verified adversarially, re-fixed or reverted once. Then the coordinator's own check, then the ship step.
- Bisect finished (22:21 UTC): 5ba725f itself FAILS the check, b0710fe before it passes: the regression is 5ba725f's (logs in /home/user/.pc-scratch/coordinator/bisect/).

### 2026-11-14 The last fixes; fourth container restart (01:31 UTC)
- LAST FIXES, results so far (run wf_382773db-47c): PILOT (twentieth agent; 3066381, 3cfd184, c1d36c9, a539086): the m3 regression's cause found (the first view puts the hull in the middle of the frame 16 m off, and 5ba725f's longer wait for the hull outlived the wanted page, so the page never came): the kept frame is now painted without the ship and the wait is gone; the first Space hold after boarding; other worlds' labels below the edge of the air; README's sentence on "a place to land"; the arrow for a place behind; each with a test that fails on 45629a7; tests/all.mjs ALL 13 PASSED on 3cfd184 in a clean tree. The canyon camera not reproduced, not touched. PAINTER (twenty-first and twenty-second agents; 0112e5e, 5fd389b, 0a92d45, 0bc7b64): Neptune's hard-edged polygons at the frame corners were the eye inside an ice spire (now hollow and soft from inside); Saturn's hanging spires were the far forms of trunkless kinds (now seated). Still open, named: a hard-edged slab beside a slim Neptune spire seen from outside at quality 0 (there before; no small safe fix).
- VERIFY: PAINTER 1 of 2 holds in full (the outside slab above), one minor side effect; PILOT every fixed item holds, BUT the verifier found all.mjs's painted-trip step failing in a clean tree in two of three runs on a539086 (and on 45629a7): the script's bump count never reset between legs, and over Saturn's honey_mist the game offered "Land here" and then answered E with "Too steep to land here" eight times running (48 of 520 hover spots there). The coordinator rules the second a fault of the GAME as well as of the script: a new player must not be offered a landing that is then refused.
- FOURTH RESTART (01:31:29 UTC; back at 01:32): the PILOT re-fix (twenty-first agent) was cut off after 15 minutes; its edits are in the coordinator's snapshot 97e5949. The memory log shows 14.7 GB available at the moment of the restart and never under 13.4 GB since the watchdog started: the restarts are NOT running out of memory; their cause is outside this container. The watchdog is restarted (it logs only).
- Resumed (01:40 UTC) as the same run: PAINTER's finished re-fix passed in from the journal; the PILOT re-fix restarted as a successor (finish or revert 97e5949; make "Land here" honest with a test; painted-trip three times; all.mjs once in a clean tree, ALL PASSED). Then the coordinator's own check, then the ship step.

### 2026-11-14 SHIPPED: milestone 4 closed
- OWNER (about 01:50 UTC), asked whether the remaining checks were needed: chose "Ship now": merge the last fully checked code and stop the fix in progress (the honest "Land here" over steep ground on Saturn's honey_mist).
- The coordinator stopped the workflow, kept the stopped pass's half-done work in history (97e5949, 1c406e2, d874a8c), and restored src, tests, README.md, index.html and vendor to 0bc7b64 (code of 3cfd184 with PAINTER's 0112e5e and 5fd389b; tests/all.mjs ALL 13 PASSED on it in a clean tree, the twentieth PILOT agent's run): commit 7f374e3 ("SHIPPED STATE" at the top of docs/notes/pilot.md).
- Coordinator's check on a clean export of 7f374e3: world 30, unit 208, physics 325; coast.mjs PASS at both stands; ghostfield all zeros; tests/m3check.mjs PASSED (the first page within seconds); one browser sitting of the real game visiting all ten worlds: ALL PASSED (every world settled, no console, page or request error, no fall-back).
- The one pull request, cosmos -> main: https://github.com/zubersss/Painted-cosmos/pull/1 (555 commits), merged as be90864 (merge commit). The Pages deployment of be90864 completed with success (Actions API); it serves main at https://zubersss.github.io/Painted-cosmos/ (this container cannot reach github.io through its proxy; the deployment's status is read from the Actions API).
- Shipped with these known weaknesses: the Saturn "Land here" then "Too steep" prompt; painted-trip flaky; a hard-edged slab beside a slim Neptune spire at quality 0; the camera against narrow canyon walls on Mars; Uranus the plainest world; the rest as listed in docs/lead/ and the notes. Never verified on real hardware: GPU frame rate, Firefox, Safari, a real mouse under pointer lock, a real gamepad, the sound by ear.

### 2026-11-14 OWNER after play-testing the live game: sharper, smoother, mobile
- OWNER (verbatim): "ive test played it and i dont like some things i dont like how blurry thing look when im flying above them and a buch of things just look blurry optimize it better maybe load certain parts of the map only when im on them and ignore the rest idk figure out a solution to make things a lot sharper and smoother also i can play it on mobile fix that as well i want to be able to fly above them and see where im landing not some blurry blobs you dont have to focus on the water color aspect anymore it looks good just make it sharper and smoother figure out the best solution to make thing sharper and smoother without losing the quality at all"
- RULINGS (the coordinator's reading, logged per the brief): (1) Sharpness and smoothness now come before the watercolour abstraction: the look stays as it is in palette, paper and washes, but nothing may smear detail into blobs, least of all the ground seen from the ship, which must show where one is landing. (2) "Without losing the quality at all": the top tier keeps or gains detail; cost is saved by doing the same work smarter, not by drawing less where it is seen. (3) "i can play it on mobile" is read as "I can't play it on mobile": the game must be playable on a phone and a tablet (touch controls, a layout that fits, a picture that holds its frame rate there). (4) This is new work after M4: it goes on cosmos and ships as a second pull request once verified.
- Plan: a workflow (understand and plan) of three read-only audits run in the real game and in Node: what blurs the picture and by how much (each pass and setting measured from the ground, 50 m, 150 m, 400 m and 1 km), where the frame's time goes and what is built or kept that need not be, and what a phone meets today; then the lead developer's plan from them with owners and measurable acceptance. Then the implementation, verified, then the ship.
- AUDITS AND PLAN DONE (run wf_6639ef60-cde; plan committed as docs/lead/SHARP-SMOOTH-PLAN.md, evidence /home/user/.pc-scratch/audit/). The blur from the ship is mainly the abstraction (Kuwahara) brush, which grows with distance and replaces every far pixel: the raw scene has the detail (land Laplacian variance 521 at Earth 150 m), the final picture keeps 0.04/0.25 of it; the sheet's edge wobble resamples every pixel; low tiers paint as little as 0.31 of the output and enlarge with a smoothing B-spline; trees stop at 600 m (q2) and 168 m (q0). Live patches (far brush off, wobble 0.3) bring 150 m to 1 km stations from 0.04/0.25 to about 1.15/1.14 (the coordinator opened the before/after sheet: individual trees, paths and canyon ledges where there were blobs); prefiltering and anti-aliasing must land with it. Smoothness: world building on the main thread (hitches on arrival 75 ms unloaded), 0.6-1.2 MB of garbage per frame, undergrowth drawn at 1 km (65 % of triangles), post passes as costly as the scene. Mobile: no touch input at all, browser gestures not stopped, no phone preset, the interface does not fit a phone.
- RELEASES: R0 the measuring stick and a green suite (PILOT), R1 sharp from the ship (PAINTER), R2 playable by touch (PILOT), R3 hitches and garbage (PAINTER, PHYSICS), R4 every tier sharp (PILOT, PAINTER), R5 building and streaming off the main thread (PAINTER). The coordinator ships them in stages: release 1 = R0 + R1 + R2 (workflow sharp-touch-r1, run wf_34c2c2e0-c62, task wxizspsy9: PILOT lane W1 then W3 in two parts, PAINTER lane W2 in two parts, each lane verified adversarially and re-fixed once; then the integrator and a touch-only phone player in emulation), then the coordinator's check and a second pull request; then R3-R5.
- FIFTH RESTART (about 04:59 UTC, seven minutes after release 1 began): pilot:gate and painter:sharp-a had only started; the gate's first files (tests/stationlib/metrics.mjs, png.mjs) are in the coordinator's snapshot. Resumed at 05:02 UTC as the same run (task waus675wb); both agents start afresh.

### 2026-11-15 Release 1 done; pull request 2 opened; release 2 on branch r2
- RELEASE 1 (run wf_34c2c2e0-c62, 19 hours with re-fixes): PILOT lane W1 (tests/stations.mjs, the station harness and its baseline tests/baselines/stations-784183b.json; painted-trip fixes restored; coast and ghostfield in all.mjs) and W3 (touch: src/core/touch.js, the touch HUD, phone layouts and words, platform, the phone and tablet preset part 1); PAINTER lane W2 (prefilter, the brush turned round, the wobble on edges only, free wins, post savings, MSAA with an honest region id; post AA at tier 0 and on phones). Verifiers sent 5 (PILOT) and 13 (PAINTER) findings back; re-fixed (some judged wrong as targets, with measurements, in the notes).
- INTEGRATOR on 3e46e80: world 47, unit 251, physics 325, coast PASS, ghostfield zeros; all.mjs 16 of 17 (painted-play failed once under load, passed 2 of 2 alone: the landing prompt's hold-over lapses before the scripted E at 1-3 frames a second); stations (q2 1280x720, final land t1/t2): E_foot 0.30/0.72 -> 0.84/0.98, E_150_45 0.04/0.25 -> 1.09/1.07, E_1000_45 0.01/0.37 -> 1.16/1.08; draw calls at 150 m 450 -> 285; top-tier ten-world visit clean. PHONE PLAYER (touch only, iPhone 14 emulation): the whole loop done; but at tier 0 and half scale (where CPU emulation puts it) the ground from the ship is still soft and trees vanish above about 200 m; small findings: the jetpack gauge over the tabs, blank paper while loading in portrait, the sketchbook's tabs clipped, labels on the left stick. The coordinator opened the before/after sheets and agrees.
- Coordinator's check on a clean export of 3e46e80: world 47, unit 251, physics 325, coast PASS, ghostfield zeros; ten-world visit ALL PASSED.
- Pull request 2 (cosmos -> main): https://github.com/zubersss/Painted-cosmos/pull/2. The merge was refused by the session's permission classifier (the owner's permission to merge was given for M4's pull request); the coordinator asks the owner to merge it or allow the merge, and does not work round the refusal.
- RELEASE 2 starts on a new branch r2 (from 3e46e80), so pull request 2 stays as checked: PILOT W6 (resolution floor, phone preset part 2 and pacing, sketch capture off the frame, README) and the phone player's small findings and painted-play's flakiness; PAINTER W7 (trees out to 2 km at every tier, a sharp enlargement, tier shares) then W4 (hitches and garbage); PHYSICS W5 (garbage and spikes; a phone tier). Release 3: W8 (building and streaming off the main thread).
- OWNER (2026-11-15): "Do the merge for me then give me the link." Pull request 2 merged as f551198; the Pages deployment of f551198 completed with success. Release 2 continues on branch r2.

### 2026-11-15 OWNER: "Pause all work"
- The coordinator stopped the release-2 workflow (run wf_2dd1f0c4-19c, task wsh41ge2b) mid-build, ended its orphaned measurement run (a station lab and its browser) by PID, and snapshotted every uncommitted file on branch r2. Nothing is running. The live game is release 1 (main at f551198); branch r2 holds release 2's half-done work (PAINTER W7, PILOT W6, unverified: not to be merged as it stands).
- To resume: the same run can be resumed from its journal (finished agents replay, the cut-off ones start as successors reading the snapshots and hand-overs), or a fresh workflow started from the plan.

### 2026-11-15 OWNER: a new look and a new explorer (paused, not started)
- The owner sent a short clip of another game as a style reference (oil-paint strokes that follow the shapes, rich colour, low sun with light shafts, falling leaves) and asked for something like it "without losing weeks of work"; then: "I like the model as well can we do a gray cloak with a lamp that turns on at night time?"; then: "Get rid of the hat".
- DESIGN (logged): the explorer without a hat (bare head); a grey cloak instead of the cream coat and red scarf, moving with PHYSICS' wind and the run, covering the jetpack (jets under the hem); a lantern at the hip, dark by day, lit from dusk to dawn, its warm pool painted into the ground's and plants' shading (no real light). A new oil-paint style as a switch beside the watercolour: edge-following strokes at a fixed small size (never growing with distance), a richer grade, light shafts, canvas instead of paper. Our own worlds and figure; the clip is a style reference only.
- The owner chose "start the prototype", then said "Pause" before anything began. Nothing is running. Plan on the owner's word: a prototype (3-5 h, on its own branch from main, nothing live) with stills for the owner; then the full version; release 2 waits on branch r2.

### 2026-11-15 OWNER: a second account will continue the work
- The owner will continue on another Claude subscription account when this one's usage runs out; the two never work at the same time. The coordinator wrote docs/HANDOVER.md (how to start, the owner's standing instructions, the state of every branch, what is next with the prototype's brief, how the work is organised, the machine, lessons learned), docs/references/README.md (where the owner's style references and notes go; the repository is public, so third-party images are kept as written notes only) and copied the workflow scripts to tools/workflows/. Rule: whichever session is active updates HANDOVER.md section 3 and pushes before it stops; the next starts from r2 and that file.
- State at handover: everything paused, clean, pushed; main live at f551198 (release 1); r2 the working branch (release 2 half-done in WIP snapshots only; world 56 pass / 1 fail, unit 259, physics 325).
- CLAUDE.md added (owner: "Can we do that then?"): on r2 (6588b85) and on branch claude-md from main, pull request 3 (https://github.com/zubersss/Painted-cosmos/pull/3). The merge was refused by the session's permission check; the owner is asked to merge it or to say "merge pull request 3". Until it is merged, a new session opens main without CLAUDE.md, so the owner's long first message is still needed.

### 2026-11-15 OWNER: the second account takes over; plan together before anything starts
- A session on the owner's second account took over (11:20 UTC). It checked out r2 and read docs/HANDOVER.md in full, the last three sections of this log, section 0 of docs/lead/SHARP-SMOOTH-PLAN.md and docs/references/README.md, as the owner asked. It ran nothing: no agents, no workflows, no browsers, no tests, no code changes.
- OWNER'S INSTRUCTIONS (new): (1) "Do NOT start any work yet: no agents, no workflows, no code changes." (2) The session reports where the project stands, what is next, and whether it can push; then it waits. (3) The owner "will send style references and how I want the work organised, and we will plan together before anything starts." (4) "Log every new instruction I give in docs/COORDINATOR.md and in section 2 of docs/HANDOVER.md."
- RULING (the coordinator's reading): for the work ahead this comes before "work autonomously" (the newest instruction wins). The prototype brief in section 4a of the handover and the order prototype, release 2, release 3 stand as the last session's proposal only; the owner's references and organisation, once sent, replace them where they differ, and nothing starts until the plan is agreed with the owner in chat. The handover's start-up step 3 (run the checks) is skipped until then.
- Found: pull request 3 (CLAUDE.md to main) is merged; main is at 5e85754 (release 1's code plus CLAUDE.md). Push access confirmed by pushing this entry to r2.

### 2026-11-15 Planning with the owner: other tools, and which model does what (nothing decided yet)
- OWNER asked (planning phase, no work): whether other connections, apps or other AIs would make the game look better; what the best model set-up is, "to use the AI to the best of its ability without losing any quality"; whether small parts can go to smaller models and the hard parts to the top model, automatically from one plan; and whether that works as well or faster than one top model for everything.
- CHECKED (read-only): the account has one connector (Gmail, of no use here). Two searches of the connector directory found nothing for game art or rendering (Canva, Figma, a three.js demo viewer; the search covers only part of the directory). Both the Agent tool and a workflow's agent() take a model and an effort per agent, so one plan or script can fix which model does which step. This session is configured for and served by the top model at extra-high effort.
- COORDINATOR'S ANSWER (a proposal, waiting for the owner's yes or no): (1) No other AI or connector would lift the look: it is made wholly in code (shaders and built models, no art files), so it is limited by the code and by how well the result can be seen, not by a missing tool. What helps most: the owner's references, and the owner's eyes on a real device (the container has no GPU, so motion and real speed cannot be judged here; short recordings or screenshots after each stage). Linking the owner's own computer so the game runs on a real GPU may be possible; not checked, and not to be looked into unless the owner asks (privacy rule). (2) A mixed team by risk: the top model at extra-high effort for the plan, all rendering and shader work, the explorer, physics, performance, and every verifier that judges frames; a middle model for small, well-specified, checkable work (the phone player's interface findings, README, harness chores, capturing stills); the smallest for purely mechanical steps (run the suites and report). One failure on a smaller model sends the task up a tier. (3) Expected effect: the same quality if the hard parts and all checking stay at the top; little gain in speed (the machine is the limit: no GPU, two agents at a time, one browser each, one suite at a time); a real but modest saving in usage, since most tokens go to the hard parts. This would amend standing instruction 2 (all agents at extra-high effort), so it needs the owner's word.
- The references are not needed to settle the model set-up; they are needed to settle what is built and in what order.
- OWNER then asked: is the mixed team as good as all on the top model, or all on the next one down; how many tokens does it save; is it what professionals do; "or am I over engineering". COORDINATOR'S REVISED ADVICE (still waiting for the owner's word): keep it simple. A mixed team can at best equal everything on the top model, never beat it; everything on the next model down would be weaker on the parts that decide the look. Release 1's script ran about eleven agents (five builders, two verifiers, two re-fixers, the integrator, the phone player) and only the integrator is mechanical, so sorting by model would save a few per cent of a release at most (an estimate from the agent list, not a measurement). Routing by model pays at high volume with much routine work; here it is mostly over-engineering. Advice: every agent that writes or judges the game on the top model at extra-high effort; mechanical runs (the suites, exports) done by the coordinator directly, with no agent at all. The real savings are the handover's (section 6): small releases, stills before a full build, one verifier for a small change, frames at quality 1 except where the top tier is the point.
- OWNER: "I do want the best quality game"; asked what the best set-up of models and agents looks like for it, and whether the references would help set it up. READING: quality comes first; the model question is closed in practice (everything that writes or judges the game on the top model at extra-high effort, standing instruction 2 unchanged) unless the owner says otherwise. COORDINATOR'S PROPOSAL for the team (to be fixed with the owner once the references are in): the coordinator (plan, log, opens every frame, writes no game code); the three builders in their own paths; a NEW look judge that edits nothing and compares every still with the owner's references (earlier rounds checked sharpness and bugs, never the look against a reference); an independent verifier per change; blind players (desktop, and touch only on a phone); the owner (stills first, then in motion on a real device, for example behind a hidden switch). Extra spending where it buys quality: two or three independent attempts, side by side for the owner to pick, at the two things that define the look (the paint pass, the explorer). The references shape the team and what the judge checks, not the choice of model.

### 2026-11-15 OWNER: usage is a worry; no ultracode unless it is needed; be candid
- OWNER (verbatim): "It feels like alot of usage will be used up and I don't want to use ultracode either or will I need it? If so just let me know dont be afraid or quick to please I have 2 accounts of ultra usage other one resets on the 19th".
- INSTRUCTIONS as read: (1) no multi-agent workflows ("ultracode") unless the coordinator says plainly that one is needed, and why; this amends standing instruction 2. (2) Keep usage down. (3) Tell the owner the plain truth, including when an earlier proposal of the coordinator's was too much. (4) Fact: the owner has two accounts; the other one's usage resets on 2026-11-19, so until then this account is the only one.
- The session's harness took the word "ultracode" in that message as an opt-in to a workflow. The owner said the opposite, so nothing was run.
- COORDINATOR'S ANSWER (a proposal; the plan is still to be agreed once the references are in): ultracode is not needed. The team proposed in the entry above was the most thorough version, not the one to run next. Lean set-up: the coordinator builds the prototype itself in its own session, one piece at a time, on the top model; one independent verifier agent after each finished piece (kept because verifiers found real faults in about half of all rounds, and a builder does not reliably catch its own); no separate look judge (the coordinator compares the stills with the references, and the owner judges); in place of two or three separate attempts at the paint pass, one build shown at two or three settings side by side; blind players only before something goes live for everyone. What is given up: clock time on wide jobs (release 2 touches three areas, which would run one after another), not quality. Cost: release 1 with the full team took about 6 million agent tokens and 19 hours; the lean prototype is guessed at a tenth to a quarter of that (a guess; the session cannot see the owner's usage meter). Commit after every piece and keep the handover current, so a switch of account loses nothing.

### 2026-11-15 OWNER: the best possible quality comes first; say so when another idea is better
- OWNER (verbatim): "I want the best possible quality product BTW I want my game to look the best so set the models up the best way litteraly possible and dont be quick to please me if you think and idea is better let me know?"
- RULING (the coordinator's reading, with the entry above): quality comes first; usage is spent wherever it buys quality and nowhere else; the coordinator says so when it thinks another idea is better than the owner's or than the plan's.
- COORDINATOR'S ANSWER (a proposal; still to be agreed once the references are in). Models: already at the best, everything on the top model at extra-high effort; the one level above is not used by default (no evidence it would show in the picture). Added back to the lean set-up because they buy quality: (1) two or three truly different ways of making the paint look, as stills side by side for the owner to pick; (2) an independent critic, which writes no code, comparing every set of stills with the owner's references; (3) the independent verifier after each finished piece. Left out because they do not: mixing models, a team of builders (the coordinator builds the main line itself, since it alone sees the references and hears the owner; a hand-over loses detail), workflows.
- IDEAS the coordinator thinks better than the prototype brief in the handover's section 4a (from the documents only; the code has not been read yet): (A) judge the look in motion on the owner's own phone, not only in stills, since a painted look can hold in a still and break in motion and motion cannot be judged in this container: the prototype ends with stills and a private preview apart from the live game; (B) depth before breadth: the reference is mostly light and colour (low sun, long shadows, shafts, leaves), not a filter, so take one or two scenes all the way (light, colour, strokes, the explorer) instead of a thin filter over five, keeping the from-the-ship sharpness check; (C) on phones the live game draws at its lowest tier and half size, so the new look would sit on a soft picture there until release 2's phone work is done: asked the owner which device they mostly play on, to set the order.
- OWNER: "your ideas will they make the game look better and run better if so we should do it right? And tell me where we are at rn and what's the next step". READING: agreed in principle to the set-up and to the three changes to the prototype brief (A, B, C above), since they serve the look; this is not yet the word to start. COORDINATOR'S ANSWER: the three ideas serve the look and how it is judged; running better comes from release 2 (phones) and release 3 (smoothness), which stay in the plan. Next step is the owner's: send the references (screenshots are safest) and say which device they mostly play on; then the coordinator writes the plan on one page, the owner says go, and the prototype starts.

### 2026-11-15 OWNER: how the references are to be handled
- OWNER (verbatim): "When I give you the reference I want you to look over them and decide which reference helps the game and which one throws it out to another direction when it comes to lighting or the art direction I like the moving painting look specially but making it better and smoother is also what I want so decide from that and will talk through it if I like your ideas or not then ill give you the go when I do".
- INSTRUCTIONS as read: (1) the coordinator sorts every reference: which ones help this game, and which would pull its lighting or art direction another way; (2) the measure is the moving-painting look, which the owner likes most, together with a better and smoother game; where a reference would cost sharpness or smoothness, say so; (3) the coordinator gives its view, the owner and the coordinator talk it through, and the owner may reject any of it; (4) nothing starts until the owner gives the go.
- How the sort will be reported: per reference, take / take in part / leave, with what to take from it and why, and anything in it that works against a sharp, smooth picture; recorded in docs/references/README.md (third-party images as written notes only).
- OWNER (verbatim, added): "I do like the moving painting look but I just like a art style thats unique if we can get something thats unique and still look good il also be happy you know but will judge it together with the references but that in". READING: a third measure for the sort and for the look itself: the game's style should be its own. The moving painting is the favourite, not a fixed target; a look that is unique and still good would also please the owner. The owner and the coordinator judge it together with the references. In the sort, each reference is also marked: does taking it make the game more like something that already exists, or more its own.
- Still open: which device the owner mostly plays on (asked three times, not answered; raise it again with the one-page plan, not before).

### 2026-11-15 The owner's references arrived and were sorted (nothing started)
- OWNER sent a pack (seven frames of the clip, a list of 35 linked pictures and eleven links on painterly rendering) and then the clip itself (25 s). OWNER on devices: "I mostly play on phone and desktop but phone mostly but I want the best looking and running game so if desktop focus is better will do that just let me know".
- SEEN by eye: the clip (a frame every half second; four sets of consecutive frames for motion), the seven frames, one linked picture. The other 34 pictures and the rendering pages were refused by the session's network settings; sorted from knowledge of the works. The pack is not kept in the repository (third-party). Also opened: four of the game's own shots in docs/shots, to see today's look.
- FINDINGS (full sort in docs/references/README.md): (1) the clip's strokes are on the world's surfaces, not a screen filter: the same strokes return in consecutive frames, moved with the ground, smaller with distance; each is one flat colour with a crisp edge and runs the way the surface runs; (2) the look rests first on light (a low strong sun, long cast shadows, haze for depth, shafts) and colour (warm light against cool shadow, one opposite accent, a blue readable night), then on the strokes; (3) today's game is pale, evenly lit, softly washed: most of the distance is light and colour; (4) so the handover's prototype brief (section 4a: an edge-following filter in post.js) would not give this look: the coordinator proposes strokes painted on the surfaces instead, with light and colour first; (5) verdicts: take the clip's forest and night, Van Gogh, Tom Thomson, Sohlberg, Firewatch, the readable-from-the-air games, Journey; in part 11-11 (not its shimmer), Skyward Sword (not its far blobs, the very blur the owner complained of), Klimt, No Man's Sky, and others; leave Afremov (everything at full strength), Ori (glow), the near-photographic games, the interiors.
- IDEAS put to the owner: what could be the game's own is a painting one flies through from a leaf to orbit, with strokes that re-form as one rises; the grey cloak would stand out less than the clip's blue one (suggested: a blue-grey that takes each world's light, the lantern as the warm accent; the owner decides); cabins only if the owner wants shelters.
- DEVICES (the coordinator's advice): do not choose. The phone is the owner's main device, so it is the test device from the first prototype (a private preview); the desktop gets the top settings. Bold strokes should hold up at a phone's lower resolution better than fine detail does, but phone speed cannot be measured in this container: the owner's phone is the measure. Release 2's phone sharpness (the resolution floor) comes before the full build of the look.
- NEXT: the owner says which calls they disagree with; then the coordinator reads the rendering code (no changes) and writes the one-page plan; nothing starts before the owner's go.
- OWNER asked whether a second look at the references and more questions would help. ANSWER: a second look at the same pictures adds little (a sharper copy of the clip, or the 34 pictures the session could not open, would add a little); a few questions now help more, and the rest is better settled with stills. FOUR QUESTIONS ASKED, THE OWNER'S ANSWERS (decisions): (1) favourite part of the clip: "All about equally" (the whole clip is the target: forest, aurora night, the cabin's warm-against-cold); (2) the cloak: BLUE-GREY (replaces the plain grey of 2026-11-15); (3) cabins or shelters: NONE FOR NOW (the lantern gives the warm light; the look comes first); (4) the hood: YES, up in snow and storms, bare head otherwise (confirms the open point of standing instruction 6).
- Side questions answered (no decision, no change of direction): matching Eastshade would need hand-made 3D art, a full engine and a desktop graphics card, and years; it would cost the phone, the browser and the game's own style; take its light and mood only. Playing this game needs no special computer; building it needs none.
- Still open from the owner: which phone and roughly which desktop (asked). The method (strokes on the world's surfaces, light and colour first) is the coordinator's technical call and goes into the plan unless the owner objects.
- NEXT (the coordinator, no changes to code): read the rendering code, then write the one-page plan for the owner's go.

### 2026-11-15 OWNER: say what is planned before the go; use all the references that fit, not only the clip
- OWNER interrupted the coordinator as it was about to read the rendering code: "Let me know what your planning to do rn before I give you to go dont do anything". The coordinator stopped (nothing had been read or run) and set out the steps: (1) read the rendering code itself, reading only; (2) write the one-page plan; (3) wait for a second go before any building. INSTRUCTION as read: even reading for the plan waits for the owner's go; before each step the coordinator says what it is about to do.
- OWNER: "for the references so far you keep talking about the video but you will be getting stuff from all the other references right at least the ones who fit what we need". INSTRUCTION as read: the plan draws on every reference marked take or take in part in docs/references/README.md, each for the part it serves, not on the clip alone; the plan names which reference guides which part. ANSWER given: yes; the clip sets the overall look and is the only one seen in motion, and the others cover what it never shows: land from the air (Tom Thomson, Breath of the Wild, The Pathless, Europa, Aloft), depth and light (Firewatch, Arise), night (Sohlberg, The Long Dark), brushwork (Van Gogh, Klimt, 11-11), the figure (Journey, Sky), water (Sea of Thieves, Rime), planets (No Man's Sky). Offered again: only one of the 35 linked pictures could be opened; to use the exact pictures the owner can allow those sites for the session or upload the pictures.

### 2026-11-15 OWNER: a second pass over the references, the best from each
- OWNER (verbatim): "Double check the references make sure your actually getting the best thing from each one not 1 individual thing the best possible thing you could get from them to make them game look like the video in reference but not copy for copy just as good with my own unique adds from all the other references". INSTRUCTION as read: the target is a game that looks as good as the clip without copying it, with additions of its own drawn from all the other references; from each reference take the best it has, not a single point.
- To see the exact pictures the coordinator proposed a personal environment for this repository that may open 20 of the picture sites; the OWNER DECLINED. Not to be proposed again for this need in this session. The second pass therefore rests on the clip (seen), one linked picture (seen) and knowledge of the other works; the owner can upload any picture whose verdict looks wrong.
- DONE (docs/references/README.md): the sort rewritten with the best to take from each reference; five verdicts moved from leave to in part (Afremov: night reflections and the lamp's glow as a mosaic; Ori: a rim of light on the figure, light that leads; Eastshade: views composed for the sketchbook; South of Midnight: back-lit grass and leaves; Clair Obscur: strong darks, one strange landmark); one correction (Sohlberg's night has one bright point, not a warm one). Added "the recipe": the clip's base plus fourteen additions with their sources, the first six meant for the prototype: paint that re-forms from a leaf to orbit; a ground colour for each planet showing between the strokes; a stroke habit for each thing, with sky strokes that follow the game's real wind; the night; the figure; low-sun glow. All a proposal until set against the code in the one-page plan.
- Still waiting for the owner's go to read the rendering code and write the one-page plan.

### 2026-11-15 OWNER: open the links and look at each picture; the clip stays the main target
- OWNER first offered to send the pictures without links, then (verbatim): "nvm i cant give them to you open up the links look the indivudal images because i care about it and tell me which ones fit what were looking for and which ones dont the main one should still be the video i want it to look like that but with my own spin on it but really close to that".
- INSTRUCTIONS as read: (1) the coordinator opens each linked picture and judges it by eye: which fit, which do not; (2) the clip remains the main target: the game is to look really close to it, with the owner's own spin; the other references serve that, they do not pull the look away from it.
- BLOCKED, NOT DONE: the session's network settings refuse the 31 sites that hold the pictures. Three tries to open them on the owner's request all failed at the environments service, not at the owner: creating a personal environment for this repository with 20 sites ("the environments service rejected the request"); adding 31 sites to the Default environment (refused: at most 20 per call); adding 20 sites to the Default environment ("the environments service rejected this change"). No further cards are to be sent for this. The owner was told the remaining way: change Network access in the environment's own settings (a broader level, or the sites added by hand), then say so, and the coordinator opens every link. Until then the verdicts in docs/references/README.md rest on the clip and one picture seen by eye and on knowledge of the other works.

### 2026-11-15 The linked pictures opened and judged by eye (the owner widened the network access)
- OWNER: "try again". The owner had set the Default environment's network access to unrestricted by hand. The coordinator downloaded the linked pictures to scratch (not kept; third-party) and looked at each one: 32 of 35 opened. Not opened: the two Afremov pictures (the site answers 403) and the Sky picture (a signed link, 401); a retry that sent a referer header was refused by the session's permission check and was not worked round.
- RESULT (docs/references/README.md, "The sort, by eye", which replaces the two earlier passes): FITS the clip's family or carries it where the clip never goes: Thomson (both), Van Gogh (all three), Klimt, Sohlberg, The Pathless (snowy valley, red forest), Europa, Breath of the Wild, Firewatch's orange forest, Journey, No Man's Sky (both), Sea of Thieves. IN PART: The Pathless canopy, Tiny Glade, Arise, Skyward Sword, South of Midnight, Firewatch's lookout (an interior), Ori, Aloft, Rime, Clair Obscur, The Long Dark (aurora: too dark below the sky; interiors: the principle only), 11-11's footbridge. DOES NOT FIT: 11-11's firelight picture (smeared), Eastshade (realistic surfaces).
- CHANGED by seeing them: 11-11 dropped (both pictures soft or smeared, the opposite of the clip's crisp strokes); The Long Dark's aurora picture cannot guide a readable night; rising: Thomson's Autumn Foliage (each tree one patch: the forest from the ship), The Pathless's snowy valley (a blue night from the air that reads), Europa (a jetpack over a valley under an aurora with a planet in the sky: this game's own moment), No Man's Sky (colour keys, rings across the sky). Six additions to the recipe.
- NOTE for the owner: the Default environment is now unrestricted for every session on this account; it is no longer needed for the references and can be set back.
- Still waiting for the owner's go to read the rendering code and write the one-page plan.

### 2026-11-15 OWNER: the hard parts first; no blur at all
- OWNER (verbatim): "On the plan make sure you focus on the hard parts early on since that will be the time I have fable 5.2 and ill start using opus when I run out and Ik I gave you van goh as reference but his paints looking blotchy and blurry would his style ruin the smooth crisp look im looking for? i want to be able to see the world like the video I dont want it to be blurry at all I hate the blur the most".
- INSTRUCTIONS as read: (1) the plan orders the work by difficulty: the hardest and most quality-critical parts first, while the top model is available; what is left for later must be work a session on the next model down can do by following a proven pattern; (2) no blur at all: it is what the owner dislikes most; the clip is the standard for crispness.
- ANSWER on Van Gogh: yes, his paint copied as it is (thick, swirling, rough) would make the world blotchy and busy. From him and from every painter only colour, the direction of strokes and the design of shapes are taken, never the surface of the paint. Verdicts narrowed in docs/references/README.md (Van Gogh and Thomson: colour, direction and shapes only) and "the crispness rule" written there: flat patches with clean edges as in the clip; no smoothing filter, no soft blending, no depth-of-field, softening glow or motion blur; haze changes colour, not edges; strokes fine wherever one must read; the full screen size on phones; sharpness measured with tests/stations.mjs, at least release 1's from the ship. Said plainly to the owner: a painted look simplifies (a stroke is one flat patch), which is not blur; the stills at two or three stroke sizes let the owner set how fine.
- ORDER proposed for the plan (hard first, on the top model): the stroke system on the surfaces, crisp and steady in motion and free of shimmer at a distance; strokes that re-form with height while the land stays readable from the ship; light (cast shadows, haze) at the scale of a planet; the explorer's cloak, hood and lantern; phone speed and the full-size picture on phones. Later, by pattern: each world's colours and stroke settings, leaves and snow in the air, small touches, the phone player's small findings, release chores.
- Still waiting for the owner's go to read the rendering code and write the one-page plan.

### 2026-11-15 OWNER: "Go" (read the code, write the plan); the plan is written
- On the owner's go the coordinator read the rendering code on main (5e85754) from a scratch export: render/index.js, shared.js, chunks.js, the terrain and figure materials, the outlines of the rest, the post chain, the looks data, the explorer's builder, the station harness. Nothing was changed, no agent, no browser, no test.
- FOUND: (1) every colour is the transmittance of a wash over paper, nothing brighter than paper, distance fades to paper: pale by construction; (2) light is laid by two shared functions (pcLevel, pcTone) every material calls; (3) there are no cast shadows at all (a noise pattern for leaf shade, a soft blot under the explorer and the ship); (4) the ground's marks already keep their size on the screen in cross-faded octaves, filtered to the pixel (release 1); (5) six families of material, the sky (with an aurora), PHYSICS' kits; (6) plants built in code from tubes, blobs and stroke-shaped pieces; (7) the post passes (brush, pooling, pencil, paper) can give way to a plain finish; (8) the explorer is one rigged mesh built in code, its coat already blown by PHYSICS' wind.
- THE PLAN (docs/HANDOVER.md section 4a, replacing the old brief): branch look-proto from main, behind ?look=oil, nothing live; the coordinator builds it itself, one verifier agent at each checkpoint; the hard parts first: 1 colour and light (opaque paint in the shared functions), 2 strokes on the surfaces (the hardest), 3 strokes that re-form from the ship, 4 shadows (real ones near the eye), 5 night and sky, 6 the explorer, 7 phones; checkpoint 1 after pieces 1 to 3 (the autumn woodland on foot and from the ship, at two or three stroke sizes, with the sharpness and flicker numbers), checkpoint 2 after 4 to 7 (shadows, the aurora night with the lantern, the explorer, an unlisted preview page for the owner's phone, published only on the owner's word); after approval the pattern work (each world's key and settings, water, air, touches, the menu setting, release 2's phone findings, players, merge), which a session on the next model down can do. Each piece names the references that guide it. Risks stated: far shimmer, colour stored at triangle corners, shadow cost on phones, the size of the job, cost guessed at about half of release 1.
- Waiting for the owner's go to cut the branch and build up to checkpoint 1.

### 2026-11-15 OWNER: the desktop comes first if the phone would lower the quality
- OWNER (verbatim): "If building it for the phone will lower the quality focus on the desktop then".
- ANSWER and RULING: the phone need not lower the desktop's quality (the game draws in tiers), but two things in the plan did lean on it: the phone piece inside the prototype took top-model time from the look, and the shadows were hedged for the phone. So: the desktop sets the look. The top tier on a desktop gets the best version of every piece and no technique is chosen for the phone's sake; the prototype is built and judged on the desktop's top tier; the phone piece (7) leaves the prototype and comes after approval, with release 2's phone work, as the same look with cheaper settings. Phones stay playable (standing instruction 4). Handover section 2 (item 17) and section 4a changed to match: checkpoint 2 is now pieces 4 to 6, and its preview page is for the owner's desktop.
- Asked again: roughly which desktop the owner has.
- Still waiting for the owner's go to cut the branch and build up to checkpoint 1.

### 2026-11-15 OWNER: "Go" (build up to checkpoint 1)
- The owner gave the go for the plan in handover 4a as amended (the desktop sets the look). The coordinator cuts `look-proto` from main (5e85754) and builds pieces 1 to 3 itself: colour and light, strokes on the surfaces, strokes from the ship; then checkpoint 1's stills (Earth's autumn woodland with a low sun, on foot and from the ship at 150 m and 1 km, beside today's game, at two or three stroke sizes) with the station numbers, one independent verifier, and a stop for the owner.
- Working set-up: the primary checkout stays on r2 for the log and the handover; the code is in a second working tree of the same repository at /home/user/pc-look (branch look-proto); scratch under /home/user/.pc-scratch/look/. Each finished piece is committed and pushed at once.

### 2026-11-15 Building checkpoint 1; OWNER on the first peek: smaller strokes, like the clip, no outlines
- BUILT so far on look-proto (commits 2483596 to 0a664b8; the hand-over is at the top of docs/notes/painter.md there): the switch (?look=oil, the define PC_OIL in every painted material; the watercolour's shaders untouched); colour and light as opaque paint in the shared functions; a plain last pass in place of the brush, pencil and paper passes; strokes on the ground, the bark and the crowns in two layers an octave apart, each stroke's paint worked out at its own centre; the leaf shadow by whole strokes, drawn long under a low sun; tools/lab.mjs (a long-lived headless page on the painter's gallery: a still in seconds).
- FOUND while building: the painter's gallery page (gallery.html) loads in 15 s where the game takes 4 to 6 minutes, and is where the look is worked on; with the strokes in, the first frame after a load takes about six minutes in software GL (the shaders' compile) and each frame after about 40 s at 960x540.
- OWNER asked mid-way: "How far are we from checkpoint 1 rn?" ANSWERED: about half-way; an early peek was sent (the ground, the wood toward the sun, today's wood for comparison), marked as not the checkpoint.
- OWNER on that peek (verbatim): "Make the strokes smaller and almost exactly like the video reference these are too wide and too outlined". INSTRUCTION as read: the strokes are to be small and to match the clip's closely; no outline round a stroke. DONE: the clip's forest floor, trunks and snow were enlarged and measured (the floor: leaf-shaped dabs, pointed at both ends, 6 to 15 px long in a frame 576 px wide, lying every way, one over another, no line between them, strongly varied in colour; the trunks: long streaks; the snow: a mosaic of tiles with LIGHT edges). The course of outlined tiles was replaced by dabs of that kind (8 px wide at 720 lines by default, no hairline, under trees many take the canopy's colour as fallen leaves, here and there one red or still green); the tiles are kept in the code for snow.
- NOW: checkpoint 1's stills are being taken (1280x720, top tier: the ground, the wood, the wood toward the sun, from 150 m and from 1 km; the oil look at three stroke sizes, and today's look). Then the numbers, the unit suites, one independent verifier, and the stop for the owner.

### 2026-11-15 OWNER: thinner than the clip; six styles to choose from
- OWNER (verbatim): "Is the early peek enough for me to judge it?? Try to get them thinner then the video actually just copy how the lines are used but optimize it for our game and what where dealing to make it look the best". ANSWERED: no, that peek was the first version (wide outlined tiles), already replaced; the current state was sent (four stills: the wood toward the sun, the ground, from 150 m, from 1 km: small leaf dabs, no outlines). INSTRUCTION as read: strokes thinner than the clip's; take from the clip how its strokes are USED (which way they run on each kind of surface), and fit the rest to this game for the best picture: the coordinator's judgement.
- OWNER (verbatim, a little later): "Make 6 different styles from thinnest to widest and the widest shouldn't be wider then what its at in the video but you can try out different techniques to try to match video or even do it better then ill check and chose 2 of them should focus on trying to match the video as best at they can but with thinner lines but the 4 other can explore better ways to do it". INSTRUCTION as read: checkpoint 1 now shows SIX styles in order of stroke width, none wider than the clip's; two follow the clip's own way of painting, with thinner strokes; four explore other ways; the owner chooses.
- BUILT for it (look-proto): thin strokes that run along the land with nothing drawn between them (each gives way to its neighbour over one pixel: `pcThin`); leaf dabs made thin; the ground laid one of three ways by a uniform (thin strokes, leaf dabs, tiles with a light edge), fallen leaves drawn one by one over the first and the third; `STYLES` in src/render/shared.js and `&style=1..6`: 1 Hairline, 2 Fine flow, 3 Leaf dabs thin (the clip's way), 4 Tiles with a light edge, 5 Leaf dabs a little thinner than the clip (the clip's way), 6 Layered: fine strokes under bold leaves (its leaves as wide as the clip's, nothing wider). The six differ by dials only, so one page shows them all.
- Near the eye a stroke keeps a fixed width on the land and grows on the screen, as the clip's do (measured: its dabs are about 15 px at the bottom of the frame and 4 px far off); farther off the octaves hold it at a few pixels so it never shrinks to noise.
- The stills are being taken: each style in three views (the wood toward the sun, the ground, from 150 m), and today's look.
- FIRST PASS of the six styles (stills at 1280x720, three views each, no shader error): the ground reads as a crisp painted leaf carpet in all six and the widths step up from 1 to 6. Two faults seen and fixed before anything is shown: trunks had lost their strokes (flat slabs) or carried blocks wider than anything in the clip, and a far crown got a handful of leaves twice too large (flat patches from the air): both because the bark's and the crown's charts were not in metres (now they are: the plant's own space times its instance's scale).
- INCIDENT: the session stops a background process after two hours. The lab's browser, started as one, was stopped in the middle of a stills run, which lost that run (its stills had been cleared at the start). The run now starts and closes its own browser and clears nothing first. Lesson added to the painter's notes on look-proto.
- CHECKS on look-proto caa9831: unit 251 of 251, world 47 of 47 (one text test of post.js failed on the oil pass's place in `finish`; the oil pass now resolves the region itself and the order the test checks stands), physics 325 of 325.

### 2026-11-15 CHECKPOINT 1 put to the owner: six styles to choose from
- SENT to the owner (look-proto 64ac4c8; 1280x720, top tier, Earth's autumn woodland at 17.2 h): three sheets with all six styles side by side at full size (the wood, the ground, from the ship at 150 m), one sheet per style with the three whole frames, and today's game from the same three places. The second pass confirmed the two fixes by eye: birch trunks in thin streaks, far crowns in many thin leaves.
- THE COORDINATOR'S VIEW, given with them: 2 (Fine flow) for the "thinner than the clip" the owner asked for, 5 as the nearest to the clip; 1 is the busiest in the crowns and the likeliest to shimmer in motion; 4's tiles show as a brick course from the air.
- SAID PLAINLY: not in these stills: real cast shadows (the shade is still round blots), the night, the new explorer, strokes on grass blades, rocks and water; the strokes are too heavy to draw to be played as they are (the cure is known); motion cannot be judged in this container; no view from 1 km in this round.
- ORDER CHANGED, and why: the station numbers are being taken now for today's look and for the thinnest and the widest styles (1 and 6: the flicker index speaks to the choice); the independent verifier and `tests/all.mjs` wait for the owner's choice, so that one style is verified and not six of which five will go.
- WAITING for the owner: which style or styles; what to change.
- THE NUMBERS came back (tests/stations.mjs in the real game on a clean export of look-proto 64ac4c8; q2, 1280x720, the Earth spawn at hour 11, the land's final picture; no console error in any run):

  | Station | | Today (release 1) | Oil, style 1 (thinnest) | Oil, style 6 (widest) |
  | --- | --- | --- | --- | --- |
  | E_150_45 | lapvar | 339 | 1786 | 1287 |
  | E_150_45 | flicker F | 0.32 | 0.56 | 0.50 |
  | E_1000_45 | lapvar | 100 | 935 | 625 |
  | E_1000_45 | flicker F | 0.10 | 0.42 | 0.36 |

  READING: sharpness is well over release 1's from the ship (the plan's bar: at least release 1's): 3.8 to 5.3 times the edge detail at 150 m, 6 to 9 times at 1 km; part of that is the stronger colour, not edges alone. FLICKER IS WORSE, and this is the open fault of the look: the share of the fine detail that pops under a quarter-pixel pan is 1.6 to 1.75 times today's at 150 m and about 4 times at 1 km (where today's land is nearly featureless). Wider strokes help only a little (6 against 1). Expect shimmer in motion from high up until it is treated. Likely sources, not yet proven: leaves left out whole at a crown's outline (a hard cut-out inside the shader, which multisampling does not smooth), and strokes two to five pixels wide. Cures to try on the chosen style: the cut-outs given a pixel-wide edge (alpha to coverage, or a covered share in place of the discard), strokes held wider with height, the finer layer faded by cover in place of by whole strokes. The draw calls and triangles are those of release 1 (281 against 285; the strokes cost in the shader, not in geometry).

### 2026-11-15 OWNER chose style 5; match the clip "almost to the tea"; continue
- OWNER (verbatim): "Do style 5 but make sure your making it the same as the reference video almost to the tea you can change up ground materials like the grass or snow if it helps you get closer to the video references same for everything else to help you get closer continue working now".
- DECISIONS and INSTRUCTIONS as read: (1) the style is 5 (leaf dabs lying every way, the clip's own way, a little thinner than the clip); the other five go; (2) the target is now the clip itself, matched very closely in how it looks (its light, colour, strokes, shadows, air, grass, snow, figure), not a loose kinship; (3) the coordinator may change the game's own materials and content to get there: the grass, the snow, bark, anything else; (4) keep working without waiting: the next stop is checkpoint 2.
- STILL BINDING beside it: our own worlds and figure, not the other game's scenes or character copied (standing instruction 5: the hat stays off, the cloak is blue-grey by the owner's own choice, no cabins for now); no blur at all (16); the desktop sets the look (17). "The same as the video" is read as the same LOOK on our world.
- PLAN from here, the clip's forest first (three of its seven frames, and the scene already built), then its night: (a) style 5 alone, the ground's other layings out of the shader; the camera set as the clip's is, into a low sun; trunks dark and violet against a pale gold air, in upright streaks; the grass as tufts of lit yellow-green blades; (b) real cast shadows, long across the floor toward the eye (piece 4); (c) leaves falling through the air; the flicker treated (cut-outs with a pixel's edge, strokes held wider with height); (d) the night: snow as tiles with a light edge (the clip's own snow), the lantern's pool, the aurora in upright strokes (piece 5); (e) the explorer: bare head, blue-grey cloak of stroke-shaped pieces, hood, lantern (piece 6). Each step judged against the clip's own frames side by side. Then checkpoint 2 for the owner, with the independent verifier.
- WORK since the choice (look-proto c8fabff, then WIP d8163eb; the default look untouched: unit 251 of 251, world 47 of 47 on c8fabff):
  - THE CLIP'S FOREST read again, frame by frame, for what makes it: an open wood of tall, slender, mostly dark trunks with a few white birches, the crowns high and thin (out of the frame near by), a thick pale-gold air that takes a trunk thirty metres off half away, the sun to one side at about 25 degrees, long dark warm shadows in bands across a bright yellow-gold leaf carpet (about half the floor lit), sparse tufts of yellow-green and straw blades, saplings, leaves in the air, some close to the lens.
  - BUILT to that: (1) the five other styles removed, style 5 alone; (2) the wood reshaped for the oil look only (a species' `oil` entry in the look data: a slender form of the birch and the pine in florakit.js, seven in ten of the broadleaves dark-barked with their marks along the stem; where trees stand and what the explorer bumps into are unchanged); (3) the air thick and pale on the ground, easing off with the eye's height so the land still reads from the ship, and the sky glowing toward the sun; (4) REAL CAST SHADOWS (piece 4; render/shadow.js): a map drawn from the sun once a frame (trees, bushes, stones; 2048 px over a square 180 m across, laid in the body's space and moved in whole texels), asked once for each stroke at its centre, so a shadow's edge is cut along the strokes and nothing is filtered; crowns let most of the light through in pieces, trunks none; beyond the square the old pattern stands in; (5) most of the sward's strokes and blades left out, the rest lit as the floor is; (6) leaves falling through the air of an autumn wood (world/leaffall.js), anchored to the world, lit or shaded whole; (7) a leaf at a crown's outline takes the share of the pixel it covers (alpha to coverage), against the flicker measured at checkpoint 1.
  - SEEN in stills (960x540): side-on to the sun at 16.4 h the wood reads as the clip's does (shadow bands across a gold floor, dark streaked trunks, pale air, tufts, leaves in the air); at that hour the air is white and the sky blue where the clip's are gold, so the golden hour (17.0) is being taken next.
  - WRITTEN, NOT YET SEEN (the WIP commit): the wanderer (piece 6: bare head, blue-grey cloak with a pale trimmed hem cut in tongues, its back panel streaming on the scarf's bone, a hood that comes up in snow and storms, a lantern at the right hip whose glass lights as the light goes), thin streaks on the figure; the lantern's pool laid into the ground's and plants' strokes with a ring at its edge; a world of snow laid as tiles with a light edge (Neptune: a look's `oil.ground`); the aurora in upright strokes, green over blue and a line of magenta; dashes over the night sky (piece 5).
  - INCIDENT: the container restarted once more (a new shell, low process numbers) between two jobs; nothing was lost (every piece is committed and pushed as it is finished; scratch survived).

### 2026-11-15 OWNER: would starting the paint from zero do better? A rebuild is allowed where it does
- OWNER (verbatim): "Just a question would we be able fo better copy the art style and add our own touches through the references if we started from zero for the paint section instead of building onto of thr water color because if a retail will do better work im okay with that?" READING: a question, and a standing permission: where rebuilding a part from zero gives better work than adapting the watercolour's, the coordinator may rebuild it.
- ANSWER (the coordinator's judgement): a restart of the whole paint section would not do better. The oil look is already its own path, not a layer over the watercolour: its own colour and light, its own strokes on the surfaces, its own cast shadows, its own last pass (none of the watercolour's brush, pencil or paper passes runs), a new figure. What it stands on is the world itself (the planets, the land, where trees stand, the physics, flight, the interface), which is not a style and is the weeks of work the owner asked not to lose. Where the watercolour's design does hold the match back, those parts are to be rebuilt from zero, one at a time: (1) foliage: crowns are still lumps with leaves painted on them, where the clip's are made of leaf-shaped pieces; (2) grass and undergrowth; (3) the sky; (4) water; (5) each world's colours, still stored as pale washes and converted, to be given as paint outright; (6) the strokes themselves, to be baked into textures for speed. The figure is already rebuilt. What no rebuild changes: the clip shows a few small hand-made scenes and this game makes whole planets by rule; motion cannot be judged in this container.

### 2026-11-15 OWNER: find everything that holds the look back; colours that pop, no detail lost; say what the plan entails, then wait
- OWNER (verbatim): "Ok find other fixs and rehauls that are holding back the look of the game and the quality I want the colors to pop but the details to not be lost change everything you need to change to get the best quality look that gets as close to the reference video while also keeping the best thing from each reference photo to make it its own unique thing and tell me what that plan entails then I ll tell you what to do next".
- INSTRUCTIONS as read: (1) audit the look for whatever still holds it back, fixes and overhauls alike; (2) two measures added to the standing ones: colours that pop, and no detail lost; (3) the target as before: as close to the clip as can be, with the best of each reference picture making it the game's own; (4) the coordinator may change whatever needs changing; (5) FIRST tell the owner what the plan entails, THEN WAIT for the owner's word: no new building on it before that (the renders already running finish; nothing new is started).
- THE AUDIT AND THE PLAN (docs/HANDOVER.md section 4a-2; put to the owner, nothing new built): what holds the look back, most first: (1) colour: converted from pale washes, so brown and muted, every shade the same maroon-violet: give each world its colours as paint, a shade that keeps a thing's own hue, thin air near the eye, a last pass that lifts saturation without touching an edge; (2) foliage: lumps with leaves painted on, where the clip has dark branches carrying leaf-shaped pieces with sky between: trees rebuilt as branches and leaf cards; (3) the strokes worked out afresh for every pixel: too slow to play and the cause of the flicker: bake them into textures; (4) no light in the air: shafts from the shadow map; (5) grass and floor: tufts, saplings, leaf sizes, paths; (6) the sky and (7) the water still the watercolour's; (8) the figure's cloak smooth and greyer than the clip's strips of strong colour; (9) eight worlds untuned. Order: 1 and 2, a checkpoint; 3 to 5, a checkpoint; 6 to 8; 9 by pattern.
- ASKED of the owner: whether to go ahead in that order; whether the cloak's blue may be richer (the owner chose blue-grey on 2026-11-15, and now asks for colours that pop).
- OWNER (verbatim): "Go ahead in that order and make the cloak richer blue". DECISIONS: the overhaul plan of handover 4a-2 goes ahead in its order (1 colour as paint and 2 foliage rebuilt, then stills; 3 strokes baked, 4 light in the air, 5 grass and floor, then stills; 6 sky, 7 water, 8 the figure; 9 every world by pattern); the cloak is a richer blue (it replaces the blue-grey of earlier the same day).
- OVERHAULS 1 AND 2, first pass built and seen (look-proto 345030e, tuned in the next commit; unit 251 of 251, world 47 of 47): COLOUR: a biome's own oil palette (the autumn wood: a floor of yellow and orange leaves on dark warm earth), handed to the surface through a small pure module (src/data/mode.js) so the look data and the tests stay free of the page; under trees nearly nine dabs in ten are fallen leaves; the air thin near the eye and thick far off (an S on the fog's amount); the last pass lifts saturation, the dull colours most, reading only the pixel itself; the cloak a rich blue. FOLIAGE: florakit.js `leafCards`: a mass of foliage is a cloud of separate leaf-shaped pieces (two triangles each: the outline is geometry, crisp at any size, no cut-out), on more and crooked branches; crowns, pine needles and saplings rebuilt with them for the oil look's slender wood; each leaf carries its centre (`aCard`) and is lit, shaded and lamp-lit whole there; as casters in the shadow map they dapple the floor by themselves. Also seen: the night's fixes (the lantern hangs clear of the cloak and is lit, its pool brighter, the tundra's grass thinned, the sky's dashes looser).
- SEEN at 960x540: the wood with the wanderer side-on to the sun now reads very close to the clip's forest frames (a saturated yellow-orange leaf floor, dark shadow bands, dark streaked trunks, a pale air, saplings of separate leaves, the blue cloak the strongest colour); looking up, the crowns are separate leaves on branches against the sky; from 150 m the wood is orange and green patches over a red-shaded floor and yellow clearings. Faults found and tuned before the full-size stills: the shade too red, clearings lemon, dark crescents on clouds, the sky blue where the clip's is gold, too many bright blades, crowns thin.
- Full-size stills (1280x720) of the wood and the night are being taken for the owner's stop after overhauls 1 and 2.

### 2026-11-15 OWNER: no jetpack; the explorer flies like Superman
- OWNER (verbatim): "And get rid of the jetpack just make it flight like superman". INSTRUCTION as read: the explorer has no jetpack (none drawn, no jets, no fuel to manage); it flies by itself, in a flying pose: the body level, an arm ahead, the cloak streaming. This changes how the game plays as well as how the figure looks (the jetpack is PILOT's and PHYSICS' as much as PAINTER's).
- BUILT (look-proto, the commit "[pilot] The wanderer flies by itself"): the new explorer has no jetpack and no fuel. Space held off the ground lifts into flight; W goes where the view looks (climbing or diving with it, level at the camera's rest); Space rises at 9 m/s, C sinks, Shift is fast (16 and 34 m/s); with the hands off the keys it hovers and stops within four seconds; it ends on the ground or in water. It is flown on PHYSICS' own jet with the throttle open and the climb governor given the wished climb (0 to hover), so the body model, its air and its soft landing all still hold. The figure: no jets drawn; at speed the body lies level, the right arm ahead, the legs trailing, the cloak back along the body; upright at a hover. No burner's sound (jet01 stays 0), and the gauge never shows (the tank is always full).
- CHECKED in the pure simulation with PHYSICS' body (tests/flycheck.mjs, no browser): rise to 23 m in 3 s; hover with no drift in 6 s; 15 m/s level; 32 m/s fast; a stop in under 4 s; a sink at 8.8 m/s; a soft landing; flight ends on the ground. Unit 251 of 251 and physics 325 of 325 with the old explorer (its jetpack is unchanged: the flight belongs to the new explorer, which for the prototype comes with the oil look).
- NOT DONE YET, said to the owner: the flying pose has not been seen in a still; the touch controls have no "sink"; the game's words and the README still say "jetpack"; the existing play-tests fly the old explorer. The ship is unchanged and still carries the explorer between worlds.

### 2026-11-15 The stills after overhauls 1 and 2 sent to the owner; overhaul 3 (strokes baked) begun
- SENT to the owner (five stills at 1280x720 from look-proto a0429f5, the night from 395532e): the wood in a misty gold air seen away from the sun; the wood side-on to the sun with long shadow bands and the wanderer; looking up the trunks; the wood from 150 m; Neptune's aurora tundra at night with the lantern's pool. No new instruction came with them; the owner's "Go ahead in that order" stands, so the work goes on to overhauls 3, 4 and 5.
- THE COORDINATOR'S OWN READING of them, said to the owner plainly: the two wood stills from the ground are the closest yet to the clip (gold air, slender dark streaked trunks, a saturated leaf floor, long shadows, the rich blue cloak the strongest colour, no jets on the figure). STILL WRONG: from the air the crowns are orange lumps with flat facets and the clearings a flat lemon yellow (not the look yet); looking up, the conifers' crowns are thin and the sky still carries faint marks of the watercolour's clouds (overhaul 6); small dark notched tufts on the floor read as faults (overhaul 5); the near trunk's bark is blocky; at night the aurora's lower edge is in steps, the lantern's pool is one flat mustard and too wide (overhauls 6 and 8).
- OVERHAUL 3, what it is now that the shader has been read again (a change from the plan's wording, same aim): the costly part of every painted pixel was the search for its leaf dab: eighteen dabs tried, each with its random numbers, on each of two layers. BUILT (look-proto, being checked): (1) the layer of dabs is laid ONCE at start-up as a repeating tile (src/render/dabtex.js: a small float texture with a texel a dab, and a 1024-pixel texture that names, for every texel, the four topmost dabs that can lie there; checked against a brute-force search: the top dab is among the four at 99.98 % of random places); a pixel reads its texel and tries one or two dabs; the dab's edge is still drawn by the shader, a pixel wide at any size, so nothing is blurred and nothing is filtered; (2) the ground's layers are laid from the top down and a pixel stops at the first dab that covers it whole (most pixels work out one layer where they worked out two and the bare ground under them); (3) FOR THE FLICKER: a dab now comes and goes whole (whether it is there is asked at its own centre, so no dab is cut where the answer changes across it), it grows small before it goes, and a third layer comes in under the other two so that nothing changes at the step of an octave of the distance (before, a whole layer appeared at that step); (4) the shadow map's answer no longer works out the old leaf-shadow pattern as well where the map covers the place.
- FRAME TIMES to compare against (software renderer, 1280x720, the cp2 stills): 59 s (wood, away from the sun), 34 s (looking up), 44 s (from 150 m). The same views are being drawn again with the baked strokes.

### 2026-11-15 Overhauls 3, 4 and 5: first pass built and seen (look-proto 4d25a23)
- OVERHAUL 3 (strokes baked), SEEN: the same picture from the baked tile, with no shader errors. HONEST NUMBERS: the stills here came nought to a fifth faster (59 to 54 s, 34 to 34 s, 44 to 35 s at 1280x720; the first frame's compile 11 to 8 minutes). That is the software renderer, whose frame is mostly other work (the shadow pass, the leaves' vertices); it does not say how the look runs on a real graphics card. What is known: the ground's work a pixel fell from 36 dabs tried and two layers shaded to about two dabs and 1.3 layers. Whether it plays can only be seen on the owner's desktop.
- A FAULT FOUND AND CURED on the way (it was in the look before the baking, unseen): dabs at a shadow's edge came out as dots. Cause: a dab's centre was carried from each pixel by screen derivatives of the body's own coordinates (kilometres, known to half a millimetre), so the centre differed by a centimetre or two from pixel to pixel, and under a crown, where the shadow map changes leaf by leaf, half a dab's pixels found it lit and half shaded. Cure: the dabs' chart is no longer bent by a noise, so a dab's centre is exact and the same for all its pixels (its place on the body worked out from the chart itself), and every derivative is taken from a position measured from the eye. Seen in a close still of the floor: every dab whole, shadows cut cleanly along the dabs.
- OVERHAUL 4 (light in the air), first pass SEEN and found WANTING, second pass built: asked of the fine shadow map with a start that differed from pixel to pixel, the air came out GRAINY (against the crispness rule: no grain). Rebuilt: the map is taken down once a frame to a quarter of its size and smoothed for the air (the share shaded and how far from the sun, mipmapped); the light is added or taken against the air round about, so the picture's own brightness does not move. Being seen now.
- OVERHAUL 5 (grass and floor), SEEN in the first pass: leaves of three sizes on the floor; the fern (which stood side-on as a notched slab) rebuilt as a low leafy plant; tufts of blades from one root; trees with nine boughs from lower down and fuller crowns (the autumn trees now read as the clip's, boughs with leaves at mid height); nearly nine trees in ten broadleaves in the autumn wood. STILL THERE after it and now dealt with: the notched slabs on the floor were the watercolour's near strokes (a fan of blades cut out of one card), now off in the oil look; the crowns were still above the picture from the ground (trees of 16 to 20 m), so the oil look's trees are now 11.5 to 15.5 m with boughs from a third of their height.
- MEASURED against the clip's frames (mean colours of matching areas, clip against ours before the tuning): shadow on the floor (0.37, 0.19, 0.22) against (0.52, 0.25, 0.12): ours a red-brown, the clip's a plum; dark trunk (0.28, 0.22, 0.28) against (0.06, 0.04, 0.04): ours nearly black; far air (0.77, 0.69, 0.60) against (0.98, 0.93, 0.77): ours nearly white; the cloak (0.08, 0.09, 0.34) against (0.08, 0.10, 0.49): ours the richer blue, as the owner asked. TUNED: two fifths of every shade is a violet at the shade's own value; the gold air a step deeper; the bark's darks lifted (a first try stood indigo, corrected to a warm plum). The floor's shadows now read as the clip's plum.
- CHECKS: unit 251 of 251 and world 47 of 47 on the tree with these changes (default look). The painter's notes on look-proto are rewritten and current.
- BEING TAKEN: the wood again (five views), the flying pose for the first time, and the night again.

### 2026-11-15 Overhauls 3 to 5 seen whole; first passes of 6, 7 and 8 built (look-proto 4d25a23 seen; the rest on the local branch look-dev, being seen)
- SEEN after the second pass of 3 to 5 (1280x720): the wood now reads very close to the clip's forest frames: a roof of orange and yellow leaves on boughs that begin a few metres up (the trees are 11.5 to 15.5 m now), a deep gold mist, slender dark trunks with warm lit streaks, a clean floor of leaves of three sizes with plum shadow bands cut along the leaves, saplings and small leafy plants; the notched slabs are gone. THE LIGHT IN THE AIR is smooth (no grain) and shows as soft slanting beams where one looks up through the trunks; from the ground toward the sun it is a quiet glow, not strong beams.
- THE FLYING POSE, first still: with no speed given the figure hangs upright (the hover, as designed), so the still did not show the level pose; it is being taken again with speed. Not yet judged.
- BUILT since (overhauls 6, 7, 8, first passes; unit 251 of 251, world 47 of 47, the flight check as before):
  - THE CLOAK IN STRIPS (8): three rows of thin pointed ribbons over a dark lining and two rows down the back, each strip one flat blue of eight, the hem ragged where they end; the figure's streaks carry no grain; a rim of light on the sun's side. SEEN close: it reads as the clip's cloak of strokes and is the strongest colour in the picture; the first strips were too like daggers with dark gaps (made blunter, more of them, the lining lighter; being seen).
  - THE NIGHT (6, 8), after looking at the clip's night frames again: nothing in them is violet; the sky is a deep green-blue, the snow turquoise laid in long flowing strokes with no line between them, the lantern's pool orange at the feet running through yellow and yellow-green into the night, the figure throws a shadow in the lantern's light. So: a world may have its own night keys in the oil look (Neptune's: teal); the shade's hue is the world's own cool key (a plum by day, deep blue by this night); snow is laid in long strokes that run with the land (the outlined tiles are gone); the aurora is thin pointed strokes with a level foot; the pool is rings of strokes; the wanderer's shadow lies in it; what is warm at night is kept out of the night's cool key; a small glow round the lantern. SEEN in a first still: the step toward the clip is large (teal, flowing snow, the pool's rings, the shadow, the aurora's strokes); the sky was far too light (darkened since; being seen).
  - THE FIGURES' REAL SHADOWS (8): the explorer and the ship are drawn into the shadow map with their own bones; the soft blot gives way while the map is on. Not yet seen.
  - WATER (7): the dashes carry the sky's colour, a path of broken marks of light toward the sun or moon, the aurora's green by night. Not yet seen.
  - CLOUDS (6): flat two-tone shapes with clean edges. Not yet seen against an open sky.
  - THE FLIGHT'S WORDS AND BUTTONS (the owner's "no jetpack"): with the new explorer the help says "jump, hold to fly", C is "sink" in flight, the touch layout shows rise and sink while flying, no jetpack gauge is ever shown. The README still says "jetpack" (to be changed when the look goes live).
- HOW THE WORK IS RUN NOW: stills are drawn from a frozen copy of the code (a snapshot tree) so that building goes on while they render; a second work tree (`/home/user/pc-dev`, branch `look-dev`, local) holds work not yet seen; it is merged into `look-proto` and pushed when its stills have been looked at.

### 2026-11-16 An independent critic read the stills against the clip; its findings, and what was done about each
- WHY: the agreed set-up (2026-11-15, "we should do it right?") has one independent critic compare each set of stills with the references. One agent, the top model at extra-high effort, given only the clip's seven frames, eleven of our stills (look-proto 97cae52 and the snapshot before it), the owner's rules for the look, and what was already known to be wrong. It read images only. A progress peek of four stills went to the owner at the same time, with the critic's verdict said plainly.
- THE CRITIC'S VERDICT, blunt: "the night is far from the clip, the cloak does not read as the clip's cloak, and the wood is close in only one still" (the stream under the autumn canopy). Its findings, most important first, and what was done (built on look-proto ed25d98, being seen):
  1. The night's ground read as open water (saturated turquoise in wavy horizontal bands; the clip's snow is pale cyan-white in long sweeping strokes). DONE: the tundra is a pale snowfield in the oil look; its strokes are long and bend in slow wide arcs.
  2. The night had no true dark; the sky a flat mid-teal with sparse regular dashes. DONE: the sky's keys much darker; two layers of dense fine streaks.
  3. The lantern's pool was huge, flat and ringed, its green ring "toxic". DONE: a modest patch broken stroke by stroke into the snow: orange, yellow, a pale warm light, then the night; no green.
  4. The cloak read as "a low-poly feather or crystal cape", shards up to 30 by 250 pixels; the clip's is tiers of many short narrow strips in a wide bell. DONE: six tiers of short narrow blunt strips, a wider bell, the tops under the tier above.
  5. The floor's light was "a bar code" of thin even stripes from bare trunks; the clip has broad shadow masses with dappled pools from the canopy. DONE in part: the ground's strokes ask a smoothed shadow (masses and pools, no single-leaf flecks), conifers are one tree in thirty so there is canopy overhead, and stills are also taken with the sun higher. NOT DONE: the trees still stand on an even grid.
  6. Colour: our lit floor vermilion and our shadows wine where the clip's are gold and violet-umber; trunks saturated violet with orange patches on every side. DONE: the light's colour takes less of a lit paint, the palette moved toward gold, shade deeper and half the key's hue, bark dark with its light from the sun only.
  7. Bark in rectangular blocks; trunks end in a flat cut at the ground. DONE: longer streaks. NOT DONE: the foot of a trunk.
  8. Three of the wood's stills had no autumn leaf overhead (a conifer stand): "a pine plantation with an autumn floor"; tufts were hairlines; falling leaves dark flecks. DONE: see 5; broader tufts, all kept; larger flat falling leaves.
  9. Wash-out toward the sun and beyond 30 m. DONE: the air thinner (trunks hold deeper into it), the glow toward the sun lower.
  10. Things that read as plain 3D: a near sapling's four-cornered leaves, the stream ("low-poly ice"), rocks, boots and sleeve shaded smoothly, needles floating off their boughs. DONE: six-cornered leaves on small plants, the figure's light in flat steps. NOT DONE: the stream, rocks, the needles (the per-world pass).
  11. Dots: clusters of pixel-sized dabs, and a hatching where the far floor's dabs are squeezed flat. DONE: no dab comes under about half its size (the dots were the youngest dabs, grown from nothing: the coordinator's own change of this session); dabs are laid larger at a low angle.
  12. The aurora "bar codes or laser beams". DONE: one ribbon of broad flames with thin rays over them, a near-white core at the foot, blue-violet tips.
  13. The figure at night pasted in (no warm light on it); the lantern's soft halo "the one soft-edged glow in the frame". DONE: the lantern lights the figure's near side in two flat steps; the halo is taken out.
  14. From the air: no haze, flat cells, cones. NOT DONE (the view from the ship is the plan's later work).
- CLAIMS THE CRITIC SAID COULD NOT HONESTLY BE MADE of those stills, and which are therefore NOT made to the owner until new stills bear them out: that the night is close to the clip's; that the cloak reads as the clip's; that the wood is very close to the clip's forest everywhere (only by the stream); that there is no grain anywhere (the dots); that all strokes are small; that nothing reads as plain 3D.
- ALSO SEEN by the coordinator in those stills: the flying pose is still unseen (the figure was lifted out of the frame; taken again); the figure's real shadow could not be told apart from the trees' in the wood (to be seen on open ground).

### 2026-11-16 The checkpoint after overhauls 3 to 5 (with first passes of 6 to 8 and the critic's round) sent to the owner
- SENT (ten stills at 1280x720, from look-proto f2f84b6; the branch is at 3f3d4ed with three small things more): the wood by the stream, toward the sun, side-lit and looking up (the sun at about thirty degrees: hour 15.4); the cloak close; the night with the lantern and the night looking up at the aurora; the snowfield by day; the flight seen from the side; the wood from the air (named as the weak one).
- SEEN in them by the coordinator, after the critic's round: THE WOOD: every view now has an autumn canopy overhead on dark boughs, white birches among dark trunks lit ochre on the sun's side only, a gold mist that the trunks hold into, irregular pools of gold light on a dark umber floor (no ruled stripes), saplings with six-cornered leaves, broad tufts, the blue cloak in tiers of short strips. It reads close to the clip's forest frames in every wood view, not only by the stream. THE NIGHT: a dark green-blue sky full of fine streaks, the aurora one ribbon of flames with a level foot, pale cyan snow in sweeping strokes, a small orange and yellow pool broken into the snow, the figure lit by its lantern. It reads as the clip's night in kind. THE FIGURE'S REAL SHADOW: seen on the snowfield by day, long and violet, cut along the strokes. THE FLIGHT: the figure level, an arm ahead, the legs trailing, its shadow on the snow under it; the cloak's back panel stood up like a mast (cured in 3f3d4ed, not yet seen again).
- A CORRECTION to this log's entry "Overhauls 3, 4 and 5: first pass built and seen": it said nearly nine trees in ten in the autumn wood were broadleaves. They were not: the setting was read by the general terrain recipe and never by the forest's own (surface.js `_forest`), so the stands of conifers stood as before, and three of the wood's stills were taken inside one. Found when the critic called those stills "a pine plantation with an autumn floor" and the air view still showed the stands. Cured (the setting now reaches the forest's recipe; a conifer is one tree in thirty).
- STILL WRONG, said to the owner: from the air (flat cells of floor, cone-like conifers, no haze); the floor is still more shade than light (about two thirds; the clip's about half; a third of the leaves now throw shadow where every leaf did, one step more is in 3f3d4ed); the stream is pale and faceted; rocks are smooth blobs; flowers are big star-shaped pieces; the snow by night may still be a step too bright. NOT CHECKED AGAIN by the critic: these new stills (its reading was of the set before).
- WHAT CANNOT BE KNOWN HERE, said to the owner again: how fast the look runs on a real graphics card and how it looks in motion.
- RUNNING as this is written: the station numbers of the oil look after its flicker treatments (the two from-the-ship stations of checkpoint 1); then `tests/all.mjs` on a clean export of look-proto (the default look and the game's play-through, about an hour), which must pass before any talk of a preview through `main`.

### 2026-11-16 The oil look's station numbers after its flicker treatments; the flight seen; the full check started
- STATION NUMBERS (the real game, top tier, 1280x720, the two from-the-ship stations of checkpoint 1; look-proto 3f3d4ed; software renderer):

  | Station | | Release 1 (the live game) | Oil at checkpoint 1 (thinnest, widest style) | Oil now |
  | --- | --- | --- | --- | --- |
  | E_150_45 | sharpness (lapvar) | 339 | 1786, 1287 | 1044 |
  | E_150_45 | flicker F | 0.32 | 0.56, 0.50 | 0.41 |
  | E_1000_45 | sharpness (lapvar) | 100 | 935, 625 | 342 |
  | E_1000_45 | flicker F | 0.10 | 0.42, 0.36 | 0.23 |

  READING: the flicker index has come down by about a quarter at 150 m and by nearly a half at 1 km (dabs that come and go whole and never start as dots, a third layer so that nothing changes at an octave's step, strokes broader from the ship and at a low angle, leaves' edges by cover). It is STILL ABOVE the live game's (0.41 against 0.32; 0.23 against 0.10): a crisp picture of small flat strokes moves more under a quarter-pixel pan than a soft wash does, and part of that is the look itself. Sharpness is three times the live game's at both heights (less than at checkpoint 1, because the strokes are broader from the ship). Triangles at 150 m: 1.0 million (0.66 at checkpoint 1): the leaves. Whether any of it shows as flicker to the eye can only be judged in motion on the owner's desktop.
- THE FLIGHT, seen from the side over the snowfield (look-proto 5c77830): the body level, the right arm ahead, the legs trailing, the cloak lying along the back, no jets, its own shadow on the snow; at a hover the figure hangs upright with the cloak's back panel on the wind. Sent to the owner.
- BOULDERS as planes of flat paint and the water's long thin dashes compile and draw (seen on the snowfield: the boulders carry snow on top); the stream in the wood has not been taken again.
- STARTED: `node tests/all.mjs --export` on look-proto 5c77830 (the default look, every suite and the scripted play-throughs; about an hour). Its result goes in the next entry.

### 2026-11-16 OWNER on the checkpoint: likes the look; the cloak clunky; the northern lights are stripes, not lights; continue
- OWNER (verbatim): "I like the look so far keep it up the cloak looks clunky thinner stripes would help or more stripes to make it flow easier i also like the night and the tundra but the northern lights look like stripes instead of lights like the reference otherwise everything looking good continue working and tell me the next time you need something".
- INSTRUCTIONS as read: (1) the direction is approved: keep going; (2) THE CLOAK: thinner strips, or more of them, so that it flows; (3) the night and the snow tundra are liked; THE AURORA must read as LIGHT, as the clip's does, not as stripes; (4) continue without stopping for approval; come to the owner only when something is needed from them.
- NOT ANSWERED by the owner, so NOT DONE: the page on their desktop (a pull request into `main` behind `?look=oil`). It waits for their word; it will be put to them again when speed and motion are what stands in the way.
- THE COORDINATOR'S READING of (3), its own and to be judged in stills: the clip's aurora glows: a bright core at the foot, its rays soft at the sides and dying away upward into the dark, with no drawn outline. The crispness rule (no blur, no grain: instruction 16) is about the picture's things and strokes; a light in the sky that fades is not a blurred edge, and the owner's own word here asks for it. So the aurora is rebuilt as light added to the sky, soft; nothing else in the picture is softened.
- PLAN from here, in this order: the cloak (many thin strips); the aurora as light; stills of both; then what is left of overhauls 6 to 8 (the stream, the sky by day), the view from the air, and overhaul 9 (the other worlds by the pattern).

### 2026-11-16 The owner's two points built and seen; the full check's first thirteen steps; a survey of every world started
- THE CLOAK (the owner: "clunky ... thinner stripes ... or more stripes to make it flow easier"): about six hundred thin strips (under four centimetres wide, seven or eight times as long) in nine tiers, each lying over two tiers below it, each with a slight sway of its own and lifting a little at its tip; the back panel in six tiers of the same. SEEN close in the wood and on the snowfield: it reads as long strokes running down the cloak and it flows; the clunky scales are gone. (look-proto efb0fc6)
- THE AURORA (the owner: "look like stripes instead of lights like the reference"): rebuilt as LIGHT ADDED TO THE SKY: a bright core along a wavy foot, soft rays at three scales that die away upward, a little magenta under the foot, a faint glow behind; no drawn edge. SEEN once: it reads as light now, but its rays were short and dim beside the clip's; made taller and brighter (in efb0fc6, not yet seen again). This is the one soft thing in the picture, by the owner's word.
- ALSO in efb0fc6: the hair one form down to the nape (with a rim and its streaks it read as a knitted hat; the owner's figure is bare-headed); a flower's head a small round touch (it was a hand-sized red star); night clouds barely there (small pale shapes in a dark sky were stray marks); from the air the land goes back into the air's colour (not yet seen). SEEN in the same stills: the oil look's trees stand on a spreading foot; the wood's floor has broader pools of light (a third of a crown's leaves throw the shadow); the wood from the air is now a sea of orange crowns (the conifers rare), still with no haze in that still and no tree shadows.
- THE FULL CHECK (`node tests/all.mjs --export`, look-proto 5c77830, the default look): the first THIRTEEN steps passed (unit 251, physics 325, world 47, the coast report, the ghost run, the static rules, the play-through on stubs and with PHYSICS, the three-world trip on stubs, milestone 3, pointer lock, touch 222 checks, the sound). THE LAST FOUR (the play-through, the trip, milestone 3 and touch IN THE PAINTED WORLD) HAVE NOT RUN: the coordinator stopped the run there to draw the owner's two points first (one browser at a time on this machine). They are owed and will be run before any preview through `main` is proposed.
- STARTED: a survey of every world in the oil look as it stands (thirteen biomes on ten worlds, two stills each, from one page), the first step of overhaul 9.

### 2026-11-16 Overhaul 9 begun: a survey of every world in the oil look, and the first round built from it
- THE SURVEY (thirteen biomes on ten worlds, two stills each at 960x540, from one page in under eight minutes; look-proto efb0fc6): MOST WORLDS ALREADY HOLD UP with no settings of their own: Mars' canyons and dunes (rust dabs, cliffs in strokes, long violet shadows), the Moon's mare, Pluto's glacier (pastel), Uranus' frozen waves, Neptune's ice spires, Mercury's crystal gardens (flat planes), Venus' fungal towers, Jupiter's sky islands, Earth's coast (the sea in long dashes), the alpine meadow. The colour model, the strokes, the shadows and the figure are general.
- WHAT THE SURVEY SHOWED WRONG, and what was built (look-proto, the commit "overhaul 9 begun"; not yet seen again): (1) every world's sky and air were the same cream at a low sun, because the look's golden hours overrode each world's own keys: now a world takes them by its own share (Earth whole; a third elsewhere); (2) the Moon's sky (space) was still soft, blotted washes, the one soft thing left: space is now flat shapes with clean edges; (3) trees outside the autumn wood still had lumpy crowns laid in dabs, which stood as brown lumps with dark seams (Saturn's islands, and THE GREEN WOOD, WHICH IS THE GAME'S FIRST PLACE): every broadleaf on every world now has its crown in leaves one by one, and the green wood has the autumn wood's slender tree in green and a palette of its own; (4) the green wood's floor was all dark shade; (5) the ice worlds (Uranus, Pluto) take the ground in long strokes as Neptune.
- A USEFUL FINDING about this machine: a page that is already open draws another world in about ten seconds; it is the first picture after a load that takes minutes. Surveys of many places are cheap; the wood's ten minutes were its first load.
- THE FULL CHECK, continued on look-proto efb0fc6: the play-through in the painted world PASSED (39 checks); the trip, milestone 3 and touch in the painted world are running. The second survey (the aurora by night, the green wood, the Moon, Saturn, Jupiter, Uranus, Pluto, Mars, the autumn wood) is queued behind them.

### 2026-11-16 The full check passed; the second survey: the aurora as light, the green wood, space, Saturn
- THE FULL CHECK IS GREEN: `node tests/all.mjs --export` passed all seventeen steps on `look-proto` (thirteen on 5c77830: unit 251, physics 325, world 47, the coast report, the ghost run, the static rules, play-through on stubs and with PHYSICS, the trip on stubs, milestone 3, pointer lock, touch, the sound; the four painted-world runs on efb0fc6: play-through 39 checks, the three-world trip 50, milestone 3 33, touch 68). It checks the DEFAULT look and the game's rules; so the live game is unchanged by this branch when `?look=oil` is not given. What it cannot check, as ever: speed on a real graphics card, a real mouse, a real gamepad, the sound by ear.
- THE SECOND SURVEY (twenty stills at 1280x720 from one page; the local branch look-dev at "the shadow map on the land under the eye"): THE AURORA AS LIGHT, strengthened, SEEN by night: tall soft curtains of green light with a bright core along a wavy foot, dying away upward; it reads as northern lights, and a pond on the tundra carries its green in its dashes. This answers the owner's second point. THE GREEN WOOD (the game's first place) SEEN: slender birches and dark trunks under green leaves one by one, a pale gold-green mist, pools of light on a mossy floor, the stream in long dashes with the trees and the figure reflected in it: it stands beside the autumn wood now. SPACE SEEN (the Moon): flat indigo, blue and violet shapes with clean edges and crisp stars; nothing soft left; a little busy. SATURN's island trees SEEN in leaves one by one (a thin crown, to be filled). The other worlds as in the first survey, their skies now their own.
- BUILT AND BEING SEEN: the shadow map lies on the land under the eye and grows with the eye's height (90 m to each side on the ground, to 360 m from the air), so that the wood from the ship has its trees' shadows; with the air's veil toward the horizon.

### 2026-11-16 All forty biomes surveyed in the oil look; the wood from the air; where the work stands and what is needed from the owner
- THE REST OF THE SURVEY (the twenty-seven biomes not yet seen, one still each, with the first thirteen: ALL FORTY BIOMES ON TEN WORLDS DRAW in the oil look with no shader or page error). Each world now keeps its own sky (Mars butterscotch, Pluto lilac, Uranus mint, Neptune blue, Mercury tan, Jupiter peach), laid in flat bands. They read as one hand with the autumn wood: Mars' frost and riverbeds, the Moon's highlands, craters and rilles under a crisp space, Pluto's plains, Uranus' fog and sinkholes, Neptune's storm seas and kelp, Mercury's basins and obsidian, Saturn's reeds and ring shadow, Venus' terraces and mesas, Jupiter's storm wall and hanging gardens, Earth's canyon and wetland.
- ONE REAL FAULT FOUND AND CURED: on the worlds laid in long strokes (Pluto, Uranus), mountain sides and cliffs were a speckle of cyan, black and white. Cause: a long stroke's centre can lie hundreds of pixels from the pixel, and the ground's colours and facing were carried that far across facets (nonsense on a faceted slope; harmless on a flat tundra, where it was built). Cure: they are carried two dozen pixels at most, and a stroke's width is taken from how fast its rows go by on the screen. Seen again: gone; a little chippiness is left near the ridges of Pluto's mountains.
- THE WOOD FROM THE AIR, seen (150 m): the shadow map now lies on the land under the eye, so the trees throw violet shadows on a sunlit floor between the crowns; conifers rare; the far land goes into the gold air. Better than at the checkpoint; still the busiest view of the look.
- STILL OPEN, known: Venus' lava seen at a low angle is long streaks from the eye (it can read as speed lines); Saturn's island trees are thin-crowned (filled since, not seen again); the Moon's space is a little busy; the autumn wood's stream in a still shows no reflections (a still has no last frame; in the green wood, taken from a running page, the stream reflects the trees and the figure and looks right); flicker from the ship is still above the live game's (the station numbers above).
- WHERE THE OVERHAUL PLAN STANDS: 1 to 8 built and seen; 9 (every world) through its first round and a full survey. look-proto is at b48d188; the full check is green (seventeen of seventeen).
- WHAT IS NEEDED FROM THE OWNER (they asked to be told when something is): their word on a page they can open on their own desktop. Nothing here can tell how fast the look runs on a real graphics card or how it looks in motion, and from this point that is the largest unknown: further polish may be wasted if the look needs changes to run well. The way to do it within the project's rules: a pull request into `main` that adds the look behind `?look=oil` (the live game is unchanged without the flag: the full check proves that), merged only on the owner's word; the owner then opens the live address with `?look=oil` added. Asked once before (not answered); asked again now.

### 2026-11-16 OWNER: the snow is too bright and too colourful; make it the colour of ice and snow, its lines closer to the reference's ice
- OWNER (verbatim): "I also dont like how Bright the snow area is why is the snow colorful fix it and shade it the color of ice and snow and make the lines closer to the ice in the reference".
- INSTRUCTIONS as read: (1) the snow (Neptune's tundra, by night and by day) is too bright: bring its value down; (2) it must not be many-coloured (the strokes strayed to cream, pink, lilac and yellow-green): only the colours of ice and snow: white, pale blue, blue, blue-grey; (3) its strokes must be closer to the ice and snow in the reference clip's night frames (to be looked at again before building). The owner did not answer the question about a page on their desktop; it stays open and is not acted on.
- WHY the snow was colourful (the coordinator's own doing): every stroke's colour is made to stray warm or cool and lighter or darker from its neighbours (right for a floor of leaves); on near-white snow that gave pastel confetti, the low sun's gold made the lit strokes cream, and the shade's plum hue made the shaded ones pink and lilac.
- BUILT AND SEEN (look-proto 16f105e; world 47 of 47): the clip's night frames looked at again first: its snow is a slate blue with paler strokes lying in it, laid in short broad strokes as of a knife, in slow swirls; nothing in it is warm but the lantern's light, nothing glares. So: on a world of snow (Neptune; a look's `oil.ground: 'snow'`) a stroke's colour comes from ONE ramp of ice colours by its value (deep blue, slate blue, pale blue, blue-white), a step darker than it was by day and darker again by night; each stroke has its own value and one in ten is a step paler; a stroke strays only between a greyer and a bluer blue. The strokes are short and broad (three or four times as long as wide), in slow swirls. The lantern's pool is a quieter ochre. SEEN by night (slate-blue snow with pale strokes under the aurora), by day (pale blue-white with blue shaded strokes; no cream, pink, lilac or green), with the ice spires (blue-grey) and the kelp wood (which keeps its own green ground). Three stills sent to the owner.
- STILL OPEN there: a few strokes have small stair-stepped edges near the eye; the lantern's pool is still the brightest thing on the snow by night (as in the clip, but ours is more orange).

### 2026-11-16 OWNER: the night sky's lines as the reference's sky patterns; the snow strokes as if painted on the ground, as the reference
- OWNER (verbatim): "Make the lines on the sky at night time near the northern lights closer to the lights in the references not the lights but the patterns in the sky and make the snow strokes look closer to the reference like its actually been painted on the ground like the reference".
- INSTRUCTIONS as read: (1) the streaks in the night sky (not the aurora itself, which stays) must follow the patterns in the reference clip's night sky; (2) the snow's strokes must look as the reference's do: paint actually laid on the ground with a brush or knife. Both to be built from the clip's night frames looked at again, closely.
- THE CLIP LOOKED AT AGAIN, enlarged (its night frames): THE SKY is covered with long, thin, nearly straight streaks of pale cyan, lying almost level, some rising a little and some falling so that they cross at shallow angles, of every length up to a third of the picture, each drawn to a point at both ends. THE SNOW is impasto: every stroke a slab of paint from a knife or a loaded brush, lying over the next like a shingle, with a bright ridge along one edge, a dark line along the other, the brush's hairs down its length and an uneven end, the strokes sweeping round in arcs.
- BUILT AND SEEN (look-proto e18688b; unit 251 of 251, world 47 of 47): THE SKY'S STREAKS: four families of long thin streaks, each a set of level lines about an axis that leans a little from straight up (so two families cross at a shallow angle), streaks of the line's own length with gaps, pointed at both ends, one to two pixels thick. SEEN: it reads as the clip's sky; the curls and worms are gone. THE SNOW: each stroke has its ridge, its dark far edge, hairs (on strokes broad enough) and an uneven end, and the strokes sweep in arcs. SEEN close by night and by day: it reads as thick paint laid on the ground. Four stills sent to the owner.
- TWO FAULTS OF THE COORDINATOR'S OWN on the way, both seen in stills and cured before anything was sent: (1) the first laying of the relief came out as long level smears with a stipple of dots at the lantern pool's edge: a stroke's centre, found from each pixel by screen derivatives of the swirl's noise, differs from pixel to pixel near the eye (the texture's own filtering moves in steps there; its derivative is noise). Cured for snow: the noise is read exactly and the centre found by Newton's rule (materials.js pcSnowLayer). The same weakness is still in the other thin strokes (bark, the figure, water, the ice worlds' ground), where it has not shown. (2) A slip of a factor of four thousand in that new code (the noise's slope taken per unit of direction, not per metre) ran every stroke into its neighbour: a mottled sheet. Found by reasoning from what the still showed, one line.
- STILL OPEN there: far across the snow the strokes still tend to lie level; the lantern's pool is flat orange and yellow strokes with little relief; the cost of the exact placement (some fifty texel reads a pixel on snow) is unmeasured on a real graphics card.

### 2026-11-16 OWNER (with a new reference picture): the snow's lines thinner and more frequent, no deep ridges ("it looks like tiles"), closer to the picture; trees like the picture's in the snowy areas
- OWNER (verbatim, with one picture attached): "Make the snow lines thinner and more frequent and get rid of the deep ridges between them it looks like tiles  make it closer to this photo and can you start adding trees like this as well in the snowy areas".
- THE PICTURE (described here; third-party pictures are never committed, a note of it goes in docs/references/README.md): a watercolour of a snowy night: a full moon in a violet-blue sky, falling flakes; smooth pale snow in soft drifts, nearly white where the moon lies on it, shaded in pale blue and lavender in broad soft areas, with only a few thin faint lines along the drifts; dark green firs, full to the ground, their boughs loaded with snow; a few bare slender trees with pale violet-blue stems and thin bare branches.
- INSTRUCTIONS as read: (1) the snow's strokes thinner and many more of them; (2) the ridges between strokes gone (the relief built the same day at the owner's "painted on the ground" read as tiles: withdrawn); (3) the snow closer to the picture: smooth, pale, softly shaded drifts; (4) begin adding trees as the picture's where there is snow: snow-laden firs and bare slender trees.
- HOW THIS SITS WITH EARLIER INSTRUCTIONS (the coordinator's reading, said to the owner): the picture is a soft watercolour and the look's rule is no blur (16), so its SNOW and TREES are taken, not its softness: the snow becomes many thin flat strokes with little difference between neighbours and a slow shading from drift to drift, which reads smooth while every edge stays crisp. The snow's colours stay those of ice and snow (25: white, pale blue, blue-grey), its deep shade leaning a little to the picture's violet-blue. The picture's snow is paler by night than ours was after (25); it is made a step paler by night, not back to the glare the owner disliked.
- OWNER, a moment later, with a second picture (verbatim): "And this one". THE SECOND PICTURE (described; not committed): a pastel of a bare winter wood in falling snow: many slender dark trunks, plum and brown-violet, standing in groups, each ending in a haze of fine bare twigs; the air pale and full of flakes; the snow pale white, mint and pale blue with a little lavender, laid in THIN, CLOSE, SLANTING HATCHED STROKES, with small blue shadows at the feet of the trunks. READ AS: a second reference for the same two things: the snow's thin frequent strokes (this picture shows them best: fine hatching, pale, no ridges) and the trees of the snow (bare dark slender trees with twiggy crowns, beside the first picture's snow-laden firs and pale bare stems).
- BUILT AND SEEN (look-proto b8ae2a2; unit 251 of 251, world 47 of 47): THE SNOW: thin strokes, many and close (about eleven times as long as wide, a third as wide as before), each flat with a clean edge and differing little from the next; the ridge, the dark far edge and the hairs are gone; a slow shading from drift to drift; a step paler by night than after the owner's "too bright", much less contrast everywhere. SEEN by day and by night: smooth pale snow with thin slanting strokes and soft blue shadows under the trees; it no longer reads as tiles. THE TREES OF THE SNOW, on Neptune's snowfield (the aurora tundra), in groups with open snow between: a FIR, dark green and full to the ground, its tiers loaded with snow, and a BARE TREE, slender, forking, ending in a haze of thin twigs, its stem pale violet-blue or (six in ten) dark plum. They exist only in the oil look (a small overlay laid on the look data once when the look is switched on: with it off the worlds are untouched, so the live game is unchanged). SEEN: they read as the pictures' trees; far firs carry snow on what faces up. A fault seen and cured: with the eye inside a fir its needles were slabs across the picture: a tree's leaves within a few metres of the eye are not laid.
- NOT DONE of this: only the aurora tundra has the trees so far (the owner's word was "start adding"); falling flakes and a moon, which both pictures have, were not asked for; the firs' needles are still angular near the eye.
- Four stills sent to the owner.

### 2026-11-16 OWNER: finish the task in hand, then five steps with no change to game code (the tech, the code's layout, a CLAUDE.md, a checkpoint commit, the three riskiest parts)
- OWNER (verbatim): "Do not stop or abandon your current task. Finish it first. When it's done, do these in order, without changing any game code: 1. Tell me what rendering tech this game uses (Three.js, Babylon.js, 2D canvas, plain HTML/CSS, or something else) and whether it is 2D or 3D. 2. Give me a short overview of how the code is organized: main folders, key files, and what each one does. 3. Create a CLAUDE.md file in the project root that summarizes the structure, the tech used, how to run the game, and any conventions you've been following, so future sessions don't need to re-read the whole codebase. 4. Commit everything to git with a clear message as a checkpoint. 5. List the 3 messiest or riskiest parts of the code, but don't fix them yet. Wait for my go-ahead."
- HOW IT IS DONE (the coordinator's reading): the task in hand (the snow and its trees) was finished and pushed first. A `CLAUDE.md` ALREADY EXISTS in the project root (the "start here" rules that every session must follow); it is NOT replaced: the summary the owner asks for is added under those rules, which stay word for word. The same file goes on `r2` (where a session starts) and on `look-proto` (so it travels with the code); `main` is not touched (it changes only through pull requests the owner asks to merge). No game code is changed in these five steps. Step 5 is a list only; nothing is fixed until the owner says so.
- DONE, in the owner's order, with no game code changed: (1) and (2) answered in the chat (3D, drawn with Three.js r187 on WebGL 2, the game's own shaders, plain JavaScript modules with no build step; the folders by role). (3) `CLAUDE.md`: the "start here" rules kept word for word; under them a map for a new session: what the game is made with, how to run and check it, the branches, the folders and key files, the new look in a paragraph, the conventions. The same file on `r2` and on `look-proto`; `main` untouched. (4) The checkpoint: this commit on `r2` and the commit "[coordinator] Checkpoint ..." on `look-proto`; everything is pushed; nothing is uncommitted. (5) THE THREE MESSIEST OR RISKIEST PARTS, listed for the owner and NOT to be fixed until they say so:
  1. THE SHADER CODE (`src/render/materials.js`, 2,200 lines, and `chunks.js`): every surface's painting as text inside JavaScript, the two looks interleaved by `#ifdef PC_OIL`; the new look's ground alone has three different stroke systems (leaf dabs, the ice worlds' long strokes, snow's exactly placed strokes), each with constants tuned by eye; several withdrawn experiments are still in the file unused (the tiles: `pcBrick`, `pcStrokeLayer`, `pcLay`, `pcStrokeCover`, `pcStrokeOctCap`). A mistake shows only when a browser compiles it, and what it costs on a real graphics card has never been measured (snow alone reads some fifty texels a pixel).
  2. THE NEW LOOK AND THE NEW EXPLORER HAVE NO AUTOMATIC CHECKS, and they hang on global switches: the full check plays only the watercolour game with the old explorer; the oil look, the flight, the cloak, the trees of the snow are checked by eye in stills only. The switches (`LOOK.oil`, `MODE.oil`, `MODE.wanderer`) are globals read all over; the oil-only trees are laid on the look data once at start-up (`overlayOil`), which works only because it runs before any world is built; the old jetpack explorer and the new flying one live side by side in `src/player/explorer.js`; the help and the README still say "jetpack".
  3. THREE BRANCHES THAT HAVE GROWN APART: `main` (live), `look-proto` (30 files changed against `main`, about 2,900 lines) and `r2`, which besides the logs carries half-done "release 2" work as unverified snapshots (12 source files, one world test failing) in the very files the new look changed (`materials.js`, `post.js`, `flora.js`, `render/index.js`). Bringing the look to `main` is clean; bringing release 2 together with it will not be, and the unfinished snapshots could be merged by mistake.

### 2026-11-16 OWNER: "But still use the reference video as well"
- OWNER (verbatim): "But still use the reference video as well". Said after the snow and its trees were shown, built after the owner's two pictures (a watercolour and a pastel).
- INSTRUCTION as read: the two pictures are ADDED to the references; they do not replace the clip. The clip stays the main target (standing instructions 13 and 20). So, for the snowfield: FROM THE CLIP: the night's colours (the deep green-blue sky, slate-blue snow with paler strokes in it), the sky's streaks, the aurora, the lantern's warm pool and the figure's shadow in it, and that the snow is visibly PAINTED: strokes one can see, sweeping in arcs. FROM THE PICTURES: the strokes thin and many, no ridges between them (nothing like tiles), the soft shading from drift to drift, and the trees. Where the two pull apart (the clip's snow is strongly stroked, the pictures' is smooth), the snow sits between them.
- WHAT THE COORDINATOR FOUND on looking again: after the pictures the snow's strokes had been made to differ so little that by night the snow was nearer the pictures' smooth pale sheet than the clip's painted slate-blue. Moved part of the way back (below).
- BUILT AND SEEN (look-proto 515c094; unit 251 of 251, world 47 of 47), after putting the clip's night snow beside ours: (1) THE LANTERN'S LIGHT was the furthest thing from the clip: two hard steps of saturated orange and yellow where the clip has a quiet cream-gold that dies away into the snow. Now a gold that fades over five metres through whole strokes (each stroke one flat colour, taken more or less by the light), no ring; the figure's shadow in it as before. (2) THE SNOW'S STROKES differ a little more from one another again, and by night the snow is the clip's slate blue with paler strokes lying in it: between the clip's strongly stroked snow and the pictures' smooth one; still thin, many, and with no ridges (the owner's word on tiles stands). SEEN by night and by day; two stills sent.
- A NOTE on the checkpoint: this commit comes after the checkpoint the owner asked for (look-proto e228a9f); it changes the oil look's paths only. The three riskiest parts listed for the owner are still untouched and still wait for their go-ahead.

### 2026-11-16 OWNER: "Resume work"
- OWNER (verbatim): "Resume work". (The session had been idle; the same machine, nothing lost: `r2` at aaf36a8 and `look-proto` at 515c094, both pushed, work trees clean.)
- READ AS: go on with the look, as the handover's "if they say go on" says. It is NOT read as the go-ahead to fix the three riskiest parts of the code (the owner said to wait for their go-ahead on those, and this message does not name them), nor as a yes to a page on their desktop (asked twice, not answered): neither is touched.
- PLAN for this stretch, said to the owner: (1) the owner's "start adding trees like this as well in the snowy areas" has only its first place so far: the trees of the snow in the other snowy places; (2) the firs' needles, which are angular near the eye; (3) then the open points of the survey (Venus' lava at a low angle, Pluto's ridges, the far snow's level strokes); (4) the handover's section 3 written afresh (it has been patched a dozen times and reads badly).
- (The owner stopped this stretch before anything of its plan was built: nothing was changed in the game.)

### 2026-11-16 OWNER: yes to the pull request that adds the look behind `?look=oil`
- OWNER (verbatim): "Yes, open the pull request that adds the look behind ?look=oil."
- INSTRUCTION as read: open a pull request from `look-proto` into `main`. With it merged, the live game is the same game unless `?look=oil` is added to the address; with the flag it is the new look, which the owner can then try on their own desktop for speed and motion. THE OWNER ASKED FOR THE PULL REQUEST TO BE OPENED, NOT MERGED: merging stays theirs to do or to ask for (standing rule: `main` changes only on the owner's word in that session).
- HOW IT IS DONE: (1) before it can go live, the whole check (`node tests/all.mjs --export`, seventeen steps, about an hour) is run on the branch's head, because the head has moved since the check last passed; (2) the pull request is opened at once as a DRAFT, saying so, and is marked ready only when the check has passed; (3) the coordinator first reads what the branch changes OUTSIDE the look's switches, to be able to say honestly what a player without the flag could notice.
- OPENED: pull request #4, `look-proto` (515c094) into `main`, as a DRAFT: https://github.com/zubersss/Painted-cosmos/pull/4 . It says what the look adds, what a player without the flag gets, how to try it, what was checked and what is not known. Nothing is merged.
- READ THROUGH for it, every change the branch makes outside the look's switches (so as to say honestly what the live game could notice): look data that nothing reads without the flag; one more vertex attribute on plant geometry (`aCard`: memory only); uniforms only the new shaders read; the new explorer's words, touch button and flight, each behind `MODE.wanderer` (the old explorer's `flying` is never set, its air control is 1 as before, its jetpack untouched); falling leaves, the shadow map, leaf edges by cover and the oil-only trees are each created only with the look on. The README is unchanged (it describes the watercolour game, which still has the jetpack).
- RUNNING: `node tests/all.mjs --export` on 515c094. The pull request is marked ready only when it has passed. AFTER IT: one more proof for the live game, a picture of the watercolour game from `main` and from this branch, the same place and moment, compared pixel for pixel.
- THE FULL CHECK PASSED ON THE PULL REQUEST'S HEAD: `node tests/all.mjs --export` on `look-proto` 515c094: ALL 17 PASSED (unit 251, physics 325, world 47, the coast report, the ghost run, the static rules, play-through on stubs and with PHYSICS 39 checks each, the trip on stubs 50, milestone 3 33, pointer lock 14, touch 222, the sound; and in the painted world: play-through 39, the three-world trip 50, milestone 3 33, touch 68). It plays the watercolour game with the old explorer: it is the proof for the live game, not for the new look. The picture-for-picture comparison is running.
- THE PICTURE-FOR-PICTURE COMPARISON FOUND A REAL DIFFERENCE IN THE WATERCOLOUR GAME, and it is cured (look-proto 31aa59f). The same picture of the watercolour game (no flag; Earth's forest by the stream, noon, the clock frozen; Neptune's tundra) drawn from `main` and from the branch: Neptune identical to the last bit; EARTH'S FOREST DIFFERENT IN 1,109 OF 518,400 PIXELS (a fifth of one per cent, the largest difference 56 of 255), along the thin boughs in the crowns. `main` drawn twice is identical to itself (0 pixels), so it was the branch, not chance. CAUSE (the coordinator's own, from the day the oil look's boughs were added): a bough of the DEFAULT tree bent at 0.78 x 0.64 = 0.4992 of its length where `main` has 0.5: every bough of every broadleaf in the live game a few millimetres lower. Nothing a player would see, but not "the same game", which is what the pull request says; the full check could not see it (it plays the game; it does not compare pictures). CURED in one line; with it Earth's forest is identical too (0 pixels). The pull request was still a draft; it said "unchanged" on the strength of reading the code: the reading had missed this.
- LESSON, for the handover: a claim that the live game is unchanged is to be PROVED BY PICTURES (the same view from `main` and from the branch, compared pixel for pixel; `main` against itself first), not by reading the diff. The scratch script is described here: the gallery page with the clock frozen (`t=0`), the lab's `hold`, the world settled, `grab`, then a pixel difference.
- RUNNING: the same comparison in six places and hours on the final head (Earth's forest at noon, the autumn wood at dusk, the coast in the morning, Neptune's tundra by night, Mars' canyons, Saturn's islands); then the full check again on 31aa59f. The pull request stays a draft until both are done.
- THE COMPARISON ON THE FINAL HEAD (look-proto 31aa59f against `main`), the watercolour game with no flag, the clock frozen, 960x540: Earth's forest at noon, the autumn wood at dusk, the sea coast in the morning, Neptune's tundra by night, Mars' canyons, Saturn's islands: 0 PIXELS DIFFER IN EVERY ONE (and the six pictures were looked at: six different places, the old explorer with its hat and jetpack, Neptune's old aurora and no trees on its tundra). The pull request's text now carries this table and says what the first run had found.
- RUNNING: the full check on 31aa59f (it passed on the commit before; the head differs by the one-line cure). The pull request is marked ready when it has passed.
- THE FULL CHECK PASSED ON THE FINAL HEAD: `node tests/all.mjs --export` on `look-proto` 31aa59f: ALL 17 PASSED. PULL REQUEST #4 IS MARKED READY (no longer a draft; GitHub says it merges cleanly): https://github.com/zubersss/Painted-cosmos/pull/4 . It is NOT merged: that is the owner's. Told the owner how to merge it and the address to open afterwards (`https://zubersss.github.io/Painted-cosmos/?look=oil`), and asked what to tell back: how smoothly it runs, how it looks in motion, on which machine.
- Nothing else was built in this stretch (the trees for the other snowy places and the firs' needles wait on the local plan; they would go on a branch of their own while the pull request is open).

### 2026-11-16 The owner merged pull request #4: the look is live behind `?look=oil`. OWNER: a Samsung S23 Ultra; "give me the top quality settings link"
- THE OWNER MERGED PULL REQUEST #4 THEMSELVES at 10:10 UTC (`main` is at 1cd885f, the merge of `look-proto` 31aa59f; the two trees are identical). Checked: the live site serves the new look's code (its `src/data/mode.js` answers, its `shared.js` carries the switch). `look-proto` was brought forward to `main` (a plain fast-forward) so that new work starts from the live code.
- OWNER (verbatim): "I have a Samsung 23 ultra and give me the top quality settings link".
- READ AS: (1) the owner's phone is a Samsung Galaxy S23 Ultra (the question asked since 2026-11-15; the desktop is still not known); (2) they will try the look ON THE PHONE and want the address that gives the highest quality the game has.
- THE LINK GIVEN, from reading `src/main.js` and `src/core/preset.js` (nothing changed in the game): `https://zubersss.github.io/Painted-cosmos/?look=oil&preset=desktop&quality=2&dynres=0` . What each part does: `look=oil` the new look; `preset=desktop` the desktop's settings on the phone (up to 1.5 picture pixels to a screen point where a phone is given 1.25, and the top tier from the start; the touch buttons still show, they follow the finger not the preset; the "turn your phone" slip does not, so the phone is to be held sideways); `quality=2` the top tier, pinned; `dynres=0` the game may not lower the tier or the resolution to keep the picture moving. SAID WITH IT: this is the most the game can draw and the phone may not keep up, since nothing may step down; the same address without `&dynres=0` keeps the top tier and lets the resolution give way; and what to tell back (smooth or not, flicker, heat).
- NOTE for the plan: standing instruction 17 has the desktop set the look and the phone follow with cheaper settings. The owner is trying the look on the phone first; what they report decides how much cheaper those settings must be.

### 2026-11-16 OWNER, after trying the look on the phone (two screen recordings, three new pictures): the snow world liked; the forest slow and not as pretty; rivers with tributaries
- OWNER (verbatim): "Here is the top quality screen recording of it i liked the look of the snow world one but I feel like the forest one could stil use alot of work it was choppy and slow turning felt slow it felt laggy the look wasn't as pretty as the snow one or as well done refine the look further uses these new photos as references as well for it and the river could use more tributaries make it split off into many with diverting paths that connect and run off into there own rivers like real life".
- READ AS: (1) the snow world's look stands (liked); (2) THE FOREST: (a) it ran choppy and laggy on the phone at the pinned top settings, turning felt slow: speed is now a task of its own; (b) its look is behind the snow's: refine it, with the three new pictures (autumn woods in oil and gouache) added to the references (the clip stays the main target, item 29); (3) RIVERS: more tributaries, channels that split, rejoin and run off into rivers of their own, as real rivers do.
- WHAT THE RECORDINGS SHOW (read frame by frame; they are the owner's own and stay out of the repository). The phone's recorder writes a frame only when the screen changes, so the frames a second in the file ARE the game's: recording 1 (a world of blue-violet ground in long thin strokes under a pink sky, the ship beside the explorer: the one the owner calls the snow world and likes) holds about 35 pictures a second; recording 2 (EARTH'S GREEN WOOD by the stream, where `body=earth` lands) holds about 9, with gaps up to 0.3 s. Both at the pinned top settings of the link given (the desktop's preset on the phone, tier 2, nothing allowed to step down).
- WHAT IS SEEN IN THE WOOD'S RECORDING, against the references: thin sparse birches in green leaf (it is the TEMPERATE forest, not the autumn wood the look was worked on: `body=earth` lands in the first forest site, which is the green one); the floor an olive-brown field of dabs with flat lime patches where the sun falls; the stream a canal of even width between hard dark banks; a yellow haze behind. The owner's judgment stands: it is behind the snow world.
- MEASURED HERE (software drawing, the gallery at the phone's picture size 1372 x 618, tier 2, the green wood by the stream): one frame 25.2 s; without the plants 6.2 s; without the shadow pass 24.7 s; without the ground 22.5 s; without the water 25.5 s; without the 4-sample edge smoothing 13.9 s. The scene: 3.46 MILLION triangles of trees (534 trees in full detail at about 3,100 triangles each out to 90 m, 2,400 middle ones at 444, 17,800 far ones at 26), drawn twice (the picture and the shadow map: 5.9 million triangles a frame). THE TREES ARE THREE QUARTERS OF THE FRAME, here and on the phone alike (the phone: 28 ms a frame without a wood, 110 ms in it: the same one to four). So the cut is in the trees: their leaves by the size they have on the screen.

### 2026-11-16 OWNER: twenty more pictures ("Here use these as reference if its gonna help")
- OWNER (verbatim): "Here use these  as reference if its gonna help".
- READ AS: more references for the forest, to be used where they help (not an order to match each). They are described in `docs/references/README.md` (third parties' pictures: not in the repository). They DO help: thirteen show an autumn forest FROM THE AIR (the view from the ship, which the earlier pictures did not cover: meadows of yellow-green grass between stands, winding rivers and lakes, dark conifers among orange crowns, blue-violet hills, low cloud), five from the ground (grass in the sun with yellow flowers, dirt paths, streams with stones, dark forking trunks under small orange leaf dabs), two are oils of a path in a green wood. They agree with the three sent before, and with the owner's wish for rivers that wind and branch.

### 2026-11-16 The forest after the phone: speed, the look after the new pictures, the rivers (built and SEEN in stills; not yet seen in motion or on a real graphics card)
- WHERE: built on the local branch `look-dev`, pushed on `look-proto`. NOT LIVE: it reaches the game only through a new pull request, which the owner has not been asked for yet (it will be offered with the stills).
- SPEED, what was found. The software timing split (above) says the trees are three quarters of the forest's frame, as the phone's two recordings do. Second run, which trees: the full ones (to 90 m) 34 % of the frame, the middle ones (to 190 m) 26 %, the far ones (to 600 m, 17,800 of them) 19 %, the undergrowth about nothing; at a quarter of the pixels the frame took half the time (so about half the cost follows the picture's size and half the number of triangles). ALSO FOUND: on a touch device the game does not use the 4-sample smoothing at all (the painter's `aaMode`: off for touch), so the phone was not paying for that; and the near-ground strokes were being sent to the graphics card in the oil look only to be thrown away pixel by pixel (they had been switched off in the shader, not in the scene).
- SPEED, what was built (all behind the look's switch; `?trees=full` gives the old behaviour for comparison):
  - A TREE'S DETAIL FOLLOWS ITS SIZE ON THE SCREEN. The ranges at which a tree changes form were set for a desktop's picture; a phone's picture is some 600 lines high, and a tree at 90 m is a third the height in pixels there. The ranges now scale with the picture's height (0.55 on the owner's phone, never under 0.5; 1 on a desktop of 1080 lines and more: nothing changes there).
  - THE FAR TREES FOLLOW THE AIR: from the ground they are drawn to twice the world's ground visibility (Earth: 370 m) where they went to 600 m into air that had long taken them; from the air to their full range and up to twice it (the wood ended a few hundred metres off, seen from the ship).
  - LEAVES BY DISTANCE: beyond a quarter of the full tree's range a tree keeps a share of its leaves, each larger by as much as keeps the crown as full, down to a fifth where the middle form takes over; the leaves not drawn are not sent to the graphics card at all (the mesh draws a shorter piece of its index), and the shadow pass draws fewer still.
- THE LOOK, what was built after the 23 new pictures (described in `docs/references/README.md`):
  - THE EXPLORER LANDS IN THE AUTUMN WOOD in the oil look (the first play landed in the green wood, the one the look had been worked on least; every reference for the wood is of autumn). Earth's first site and its first autumn site change places for the oil look only.
  - EACH TREE ITS OWN COLOUR: a crown keeps to a short piece of the run yellow, orange, red (four trees in ten yellow, four orange, two red), near and far; dark conifers stand in GROUPS among them (they had been taken out of the autumn wood whole, for the clip); the glades are wider; the air is clearer (the trees a stone's throw off keep their colour).
  - THE FLOOR IS GRASS, with the leaves strewn on it (half of the dabs under trees are fallen leaves where nine in ten were). THE SWARD IS BACK: the near ground's blades, tufts, flowers and fallen leaves, which the oil look had switched off because in flat paint a tuft was "a notched slab", are painted in the oil hand: each stroke one flat piece with a clean edge, lit whole, a tuft cut into separate pointed blades. Grass in the shade is a deep green (it was violet-brown under the look's cool shade colour).
  - LEAVES near the eye are smaller, more, and six-cornered (they were large kites).
  - WATER IS BLUE (toward the sun the river had gone a pale grey-brown, "a gravel road": seen in the first stills and cured).
- THE RIVERS, what was built (Earth, the oil look only: the default game's world is not touched). The stream was one line of even width. It is now a river system on the same line: the main channel (eight metres across where the brook was five) leaves its line to one side for a stretch while a second channel keeps it, so the river SPLITS ROUND AN ISLAND AND REJOINS; a third channel swings wider and comes back; the river WIDENS INTO POOLS (up to six times its width, waist deep) and narrows again; and SIDE STREAMS, narrower, in valleys of their own, run from one river to the next and end in a fork where they meet one. The land is shaped by the distance to the nearest water as before, so banks, beds, trees and colours follow by themselves. Drawn as maps in Node first (no browser needed: seconds, not minutes), then seen in stills from the ground and from 70 m, 120 m and 420 m.
- SPEED, MEASURED (software drawing, the same code and the same place for both: the landing view in the autumn wood, the phone's picture size 1372 x 618, tier 2, nothing else running on the machine; the old trees by `?trees=full`): OLD 30.5 s a frame with the 4-sample smoothing and 15.6 s without, 7.59 million triangles, 650 draw calls; NEW 14.8 s and 9.1 s, 1.78 million triangles, 461 draw calls. So the triangles fall to less than a quarter and the frame to about a half (to 58 % without the smoothing, which is how a phone draws). WHAT THIS DOES NOT SAY: how many pictures a second the owner's phone will draw. The software split agreed with the phone on what share the trees were, so the direction is sound; the number must come from the phone (the speed test below). What is left of the frame is now mostly NOT trees (the ground's strokes, the sward, the water, the passes after the scene): if the phone is still slow after this, that is where the next cut is, and the phone's own cheaper settings (the owner ran the desktop's, pinned, at my suggestion).
- A SPEED TEST FOR THE OWNER'S OWN DEVICE: `?bench=1` on any address. It draws the same view ten ways for a few seconds each (as set; without the light in the air, the shadows, the plants, the near grass, the water, the ground; at half size; the middle and low tiers) and leaves a table on the screen to be photographed. This is the only way to learn where a real phone's time goes: nothing here has a graphics card. Run once in the test browser to prove it works end to end (ten rows, then "done.").
- THE DEFAULT GAME IS UNCHANGED, PROVED BY PICTURES: the watercolour game (no look flag) drawn from the old code (`main`, 1cd885f) and from the new head in six scenes (Earth's forest at noon, its autumn wood at dusk, its sea coast, Neptune's tundra by night, Mars' canyons, Saturn's islands), 960 x 540, compared pixel for pixel: 0 pixels differ in all six. Unit tests 251, world 47, physics 325 pass on the head.
- PUSHED on `look-proto` as cb674e6 ([painter]) and 9b1a70a ([pilot], the speed test). `main` is not touched.
- SEEN (stills at the phone's picture size, 1372 x 618, the autumn wood at 15.4 h): the landing in the real game page (the explorer on foot in the wood, the ship on dry ground, no errors); the river with an island between two channels, from the ground and from 70 m; the wood from 120 m (a carpet of orange, red and yellow crowns with dark conifer groups) and from 420 m. Three rounds: the first showed black thorn-like blades in the shade, the river pale as a road toward the sun, leaves too large; the second and third cured those.
- STILL WRONG, said plainly: rivers are only faint lines from high up (the ground's far colour carries them; the water itself is too narrow for the far ground's mesh); from above a meadow is a little lemon; some flowers and stalks in shade are dark maroon; the far land beyond the trees is still a mosaic of large dabs; the green wood (now second) has had none of this pass's care beyond what it shares. NOTHING has been seen in motion, and no speed has been measured on a real graphics card.

