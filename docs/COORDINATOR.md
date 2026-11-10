# COORDINATOR NOTES (the shared memory)

Owner: the coordinator. PAINTER and PILOT read this; they do not edit it. To change anything
here, write the request in your notes file and report it; the coordinator records the outcome.

## A. How this build is set up (and why)

- **Mode: two parallel subagents in one session, one shared branch.** No GitHub repository for
  this game was attached to the session, and the only reachable repositories are the owner's
  other projects, which the brief says to leave alone. Separate cloud threads would have had no
  shared remote to sync through, so the brief's fallback applies.
- **Repository:** `/home/user/painted-cosmos`. Shared work branch: **`cosmos`**. `main` holds the
  bootstrap commit and receives the finished game at M4.
  **UPDATE 2026-11-10: a remote now exists**, `origin` = `https://github.com/zubersss/painted-cosmos`
  (the owner created it for this game). `tools/commit.sh` now pushes `cosmos` after every commit,
  so keep using it exactly as before and commit often; nothing else changes. Both roles stay on
  the one shared branch in the one working tree. At M4, Pilot opens the one pull request
  `cosmos` -> `main` (the owner has given permission to merge it).
- **Both roles work in the same working tree.** You see each other's files the moment they are
  saved, including half-written ones. Rules that keep this safe:
  1. Commit with `tools/commit.sh painter "msg"` or `tools/commit.sh pilot "msg"`. It stages and
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
     `/home/user/.pc-scratch/pilot/`.
  5. Do not start further agents or threads. There are exactly two workers.
- **Extra ownership (not named in the brief):**
  PILOT also owns `/.nojekyll`, `/.gitignore`, `/package.json` (dev only, if wanted),
  `/docs/shots/pilot/**`. PAINTER also owns `/docs/shots/painter/**`.
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
  [--wait ms] [--eval "js"] [--shots N --every ms] [--root dir]`: headless Chromium (Playwright,
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

## E. Settled outcomes (log)

- 2026-11-10: bootstrap as described in A. Branch for both roles: `cosmos`.
- 2026-11-10: the owner created `zubersss/painted-cosmos`; attached as `origin`; `main` and `cosmos`
  pushed; `tools/commit.sh` pushes after each commit. The two roles keep sharing one branch
  (they were already mid-work in one tree; splitting now would only add merge work).
  GitHub Pages is to be served from `main` after the M4 merge.
- 2026-11-10: the owner switched GitHub Pages on, serving `main` at the root. It shows nothing
  playable until the M4 merge. Address: `https://zubersss.github.io/Painted-cosmos/`.
