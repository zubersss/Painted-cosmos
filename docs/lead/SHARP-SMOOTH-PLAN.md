# THE PLAN: sharper, smoother, playable by touch

PILOT (lead developer), 2026-11-14, on `784183b` (branch `cosmos`, the same code as the live game).
It is built from three audits (sharpness: `/home/user/.pc-scratch/audit/sharp/`, performance and streaming:
`.../audit/perf/`, mobile: `.../audit/mobile/`) and from my own checks (`/home/user/.pc-scratch/audit/plan/NOTES.md`,
`.../plan/repro/NOTES-repro.txt`, with frames in `.../plan/repro/`). No repository file was edited.

## 0. The request, and the answer in one paragraph

The owner flew over the land and saw blobs. They want it a lot sharper and smoother, without losing quality, and
playable on a phone. They suggested loading only the parts of the map they are on.

**Why it is blurry.** The scene pass draws every tree, trunk and path (raw land Laplacian variance 521 at 150 m).
Then the watercolour "abstraction" brush paints over the picture with a brush that gets bigger with distance and fully
replaces every far pixel. From the ship all the ground is far, so all of it is repainted as 6-9 px blobs (Laplacian
variance 2). After that, the paper's edge wobble resamples the whole sheet half a pixel off. The low tiers make it
worse: they draw at as little as 0.31 of the screen's size and enlarge the result with a smoothing filter.

**What to do.** Turn the brush around: it fades out with distance instead of growing. Keep the wobble on edges only.
Clean up the patterns that alias, add anti-aliasing, and never draw below about 0.67 of the screen's size. Keep the
far trees at every tier.

**Why it is not smooth.** The world is built on the main thread, which hitches on arrivals and on phones. The game
also builds and submits things nobody can see (65 % of the triangles at 1 km).

**The owner's idea is right in spirit.** The game already streams by distance. What it does wrong is build and keep
what cannot be seen, and build it on the main thread. Fix those, and add touch controls with a proper phone preset.

## 1. What I checked myself

**Code read, all confirmed (NOTES.md):**
- The brush rule: `post.js` ABS_FRAG `far = smoothstep(3.6, 8.2, aux.z)` and `keep = (1-far)*0.30`. The radius is a
  fraction of the frame height, set every frame in `render/index.js`. The sectors are read from the half-resolution
  4x4-box prep.
- The wobble: `uPig.z` 2.6.
- `uBoil` is never written.
- The B-spline enlargement and its shake.
- `antialias:false`, and the scene MRT is single-sample with an unsampled `DepthTexture`.
- TIERS 0.62/0.80/1.00, dynres `minScale` 0.5, DPR cap 1.5.
- `flora.js`: `T_FAR` 600, `RANGE_SCALE` [0.28, 0.6, 1.0], undergrowth wanted only below 400 m, disposal only inside
  `_wanted`, the `Math.min(8, ...)` estimate cap.
- `world/index.js`: two forced `updateMatrixWorld(true)` calls.
- `uniformsNeedUpdate` set per patch.
- No touch or pointer handler anywhere in input; the viewport has no `viewport-fit` and no limit on scaling.

**Reproduced in my own headless Chromium on a clean export (one browser, closed afterwards):**
- **E_150_45:** 149.996 m above ground; raw land lapvar 520.75 and 522.62 (two placements); final land t1/t2
  0.04/0.25. This matches the sharpness audit exactly.
- **Post experiments on that held frame:**

  | Experiment | t1/t2 | lapvar |
  | --- | --- | --- |
  | Far brush off (keep 1 for far) | 0.67/1.03 | — |
  | Far brush off + wobble 0.3, no RCAS (my new experiment x26) | 1.15/1.14 | 609 |
  | Plus RCAS 0.5 (the audit's x23) | 1.30/1.16 | 1116 |

  **Correction to the sharpness audit:** RCAS is not needed at native resolution. It doubles the Laplacian energy,
  and at 3x zoom it darkens the stair-steps (`repro/E150_45_rcas_zoom3.png`, opened). RCAS belongs only to the
  enlargement step.
- **E_1000_90** (979 m): 441 calls and 669,283 triangles. Hiding the 303 undergrowth, bush and rock meshes gives 138
  calls and 233,607 triangles, with a maximum pixel difference of 2/255. Two renders with those meshes shown also
  differ by up to 2/255, because the water reflects the last frame. Reproduced exactly.
- **Node world bench** (the perf audit's script, my export, an unloaded machine, two runs):

  | Case | Max world.update | Allocation per frame |
  | --- | --- | --- |
  | Walking | 9.7-20.1 ms (0-1 frames over 16.7 ms) | 0.56 MB |
  | Running | 24.5 ms | 0.96 MB |
  | Ship at 150 m | 9.4 ms | 1.20 MB |
  | Arriving | 74.5-78.3 ms | 0.69 MB |

  **Correction to the perf audit:** its walking maxima (92-133 ms) were inflated by a loaded CPU, as it warned. On a
  free core the world builder hitches mainly on arrival. On a phone (about 4x slower) it hitches everywhere. So the
  worker pool is a phone and arrival item, and it comes after the sharpness work.

**Frames opened:** `sharp/sheets/BEFORE_AFTER_q2_remedy.jpg`, `FULL_REMEDY_crops_1to1.jpg`, `tiers_final.jpg`,
`mobile/frames/iphone14-land-sheet.jpg`, `repro/check_base.jpg`, `repro/E150_45_crops_1to1.png`,
`repro/E150_45_rcas_zoom3.png`. What they show:
- With the far brush off, every crown, trunk and the path are back.
- At 400 m and 1 km the leaf-shadow dapple then shows as dark camouflage blotches and rows of dashes. Prefiltering the
  procedural patterns is therefore a prerequisite, not an option.
- At tier 0 the forest seen from 150 m is a purple wash with no trees.

**New risks found in the code, which none of the audits named:**
1. **The region id breaks under MSAA.** The id is a float class in aux.w (0 sky, 1 ground, 2 water, 3 prop, 4 foliage,
   ...). An MSAA resolve averages samples, so a sky/foliage edge resolves to 2.0, which reads as **water**. Integer
   targets cannot be multisampled in WebGL2. The resolved aux is read by ABS, SHEET, `sky.js` and the glazes in
   `kitmat.js`. The MSAA item must therefore carry a decode rule.
2. **Log depth defeats early depth tests on some browsers.** three r187 uses reversed-Z only where `EXT_clip_control`
   exists. Elsewhere it falls back to a logarithmic depth buffer that writes `gl_FragDepth` in every fragment, which
   disables early depth rejection (and MSAA depth per sample). Which browsers that hits (Safari is likely) was not
   checked here. The read-out must name the depth mode.
3. **Module workers do not see the import map.** Worker code may import only relative paths, never `three`.
4. **The static rules forbid image files** under `src/` and `vendor/`. A web-app manifest therefore ships without
   icon files.
5. **`tests/all.mjs` pins `scale=0.5&quality=0` for its painted runs.** URL pins must keep working below any new floor.
6. **The painted-trip step is already flaky** (pilot notes, SHIPPED STATE). The fix is in history (`1c406e2`,
   `d874a8c`; test only). It goes first, so that "every check green" means something.

## 2. Lead rulings this plan rests on

1. **The brush:** no brush in the far field. Where a brush stays (near the eye), it is small, given in internal
   pixels, and capped. The palette, paper, washes, edge pooling, granulation and pencil all stay.
2. **The wobble:** the hand-drawn tremor stays on wash edges, silhouettes and the ragged border. The interior is not
   resampled (0.3 px).
3. **Sharpening:** RCAS only when the picture is enlarged; none at native resolution.
4. **Anti-aliasing is part of the tier:** MSAA 4x on the scene MRT at tiers 2 and 1 on desktop, a light post AA at
   tier 0, and post AA on phones until a real phone shows that MSAA holds. Depth becomes a renderbuffer, since nothing
   samples it. This needs coordinator ruling C7's wording changed: it asks for a 32-bit float depth texture, and a
   float renderbuffer gives the same precision.
5. **Resolution:** never draw below 0.67 of the output (0.75 on phones and tablets). Below that the controller sheds
   geometry (a tier), never resolution. URL pins still win, so the tests keep working. Tiers differ by what they draw,
   not by blur.
6. **Far trees:** the far canopy is drawn at every tier, out to 1.5-2 km.
7. **Streaming:** build only what can be seen. Dispose what cannot be seen, or what belongs to a world left behind.
   Build off the main thread.
8. **Touch:** a floating left stick, a look drag on the right, prompts that are buttons, and round paper buttons in
   the right-thumb arc. It never requests pointer lock.

## 3. Releases (each one ships on its own; owners work in parallel)

| Release | Content | Owner(s) | Depends on |
| --- | --- | --- | --- |
| R0 Gate | the measuring stick (station harness and baseline); painted-trip flake fixed; all.mjs covers coast and ghostfield | PILOT | none |
| R1 Sharp from the ship | prefilter, brush reversal and wobble, free wins (unseen undergrowth, matrices, uniforms), post savings, AA | PAINTER | R0 |
| R2 Touch | gesture guard and touch input, touch HUD, phone layouts and words, platform; the phone and tablet DPR and start tier | PILOT | R0 (independent of R1) |
| R3 Smooth | hitch caps and garbage in world building; physics garbage and spikes; sketch capture off the frame | PAINTER, PHYSICS, PILOT | R0 |
| R4 Every tier, every device | resolution floor and measured steps; phone floor and even pacing; far canopy at every tier; interpolating enlargement; new tier shares; physics phone tier | PILOT, PAINTER, PHYSICS | R1, R3 (savings pay for the floor) |
| R5 Off the main thread | worker pool; frustum-aware detail and disposal; shading cost; draw-call merging; physics in the worker; aerial perspective last | PAINTER, PHYSICS | R3 |

Rough effort, from the audits' estimates and mine:

| Release | Effort |
| --- | --- |
| R0 | 1 day |
| R1 | 3-4 days |
| R2 | 3-4 days |
| R3 | 2-3 days |
| R4 | 3 days |
| R5 | 5-7 days |

## 4. Workstreams and items, in order

Every item ends with these checks:
- the owner's unit suite;
- the station subset named in the item (section 5);
- `painted-play` and `painted-m3` for anything under `src/render` or `src/world`;
- at the end of each release: `node tests/all.mjs --export` in a clean tree (ALL PASSED), plus `coast.mjs`,
  `ghostfield.mjs` and the grand tour at quality 0.

"Station" means the fixed stations of section 5. t1 and t2 are the shares of the raw scene's own detail at 2-6 px and
6-16 px that reach the picture, measured over the land. Thresholds are at 1280x720 and at 1920x1080 unless a size is
named.

### PILOT · W1 Gate: the measuring stick and a green suite (R0)

1. **Station harness `tests/stations.mjs`.** Port the sharpness audit's harness (`live.mjs`, `inpage.js`,
   `stations.py`, `metrics.py`) to Node and in-page JavaScript.
   - Metrics are computed from `readPixels`, so there is no Python and no new dependency.
   - Always `__pc.hold(true)` before a post-only grab. Without it, a game frame overwrites the held scene: I hit this
     myself.
   - Stations: section 5. Outputs per station: the final frame (v0), raw (v1), depth (v3), regions (v4) and
     abstraction output (v5), plus a metrics JSON and a contact sheet.
   - Add the aliasing index A, the sub-pixel flicker index F, a halo share, the per-region palette (CIELAB) and the
     cost (draw calls, triangles, post taps).
   - Commit the baseline numbers of `784183b` as `tests/baselines/stations-784183b.json`, with JPEG sheets in
     `docs/shots/pilot/baseline/`.

   *Acceptance:*
   - Two runs agree to 2 decimals on every metric.
   - It reproduces E_150_45: raw land lapvar 520-525, final t1/t2 0.04/0.25, x26 1.15/1.14.
   - It reproduces E_1000_90: 441 calls and 669k triangles.

   *Risk:* SwiftShader is slow, about 2 min per station per tier. A full run takes about 2 h, so each item runs a
   subset.
2. **A green gate.**
   - Restore the test-only fixes from `1c406e2`/`d874a8c` (a per-leg bump count; on "Too steep" fly on 100-150 m).
   - Add steps `coast` (`src/physics/coast.mjs`) and `ghostfield` (`docs/lead/evidence/review7/ghostfield.mjs`) to
     `tests/all.mjs`, and later `touch` and `stations-quick` (E_foot, E_150_45 and E_1000_45 at q2, with the section 5
     thresholds).

   *Acceptance:*
   - painted-trip passes 3 times out of 3.
   - `node tests/all.mjs --export` prints ALL PASSED.

   *Risk:* low.

### PAINTER · W2 Sharp from the ship (R1)

1. **Prefilter the procedural marks by the pixel footprint.**
   - Files: `src/render/chunks.js` (`pcDappleL`, `pcLevel` step edges), `src/render/materials.js` (TERRAIN_FRAG's dab,
     flick, dry and crack thresholds; PROP_FRAG; NEAR_FRAG).
   - Method: footprint in metres = dist x 2tan(fov/2) / H, or `fwidth` of the world position. Each threshold's soft
     width grows by `fwidth(value)`. Each pattern's contrast eases to its mean shade as the footprint goes from 0.25
     to 1 times the pattern scale (4.1 m and 13 m for the dapple), so the average value, and with it the palette, is
     kept.

   *Acceptance:*
   - Raw alias index A at E_400_90, E_1000_45 and E_1000_90 at most 0.6 x baseline.
   - Raw land lapvar: E_1000_45 at most 150 (383 today), E_1000_90 at most 350 (1093 today).
   - Raw b3 within ±10 % and land mean colour ΔE76 at most 2.
   - E_foot and E_50_45: raw b1/b2 within ±5 %.
   - 1:1 crops at E_1000_45 show no rows of dashes (opened by the lead).
   - Under today's brush, final frames change by at most 1/255 on average, so this item ships alone.

   *Risk:* low. A far wash becomes an even tone where it used to be noise. It adds ALU only.
2. **Reverse the brush; wobble on edges only.**
   - Files: `src/render/post.js` (ABS_FRAG, SHEET_FRAG), `src/render/index.js` (uBrush).
   - `keep = mix(nearKeep, 1, far)`.
   - The radius is in internal pixels, at most about 1.5-2 px near and none far.
   - Skip the 8 sector taps and the rotation tap where keep is at least 0.995.
   - The night factor applies to the near brush only.
   - If a near brush wider than 1 px stays, take its statistics from a full-resolution prep (x25). Keep the
     half-resolution prep for the bleed and the pooling surround.
   - Wobble: 0.3 px in interiors, the full 2.6 px only where the sheet's own gradient, a class change or the border
     says there is an edge.
   - Gate: below 0.6 internal/output, which only a URL pin can reach after R4, keep today's brush. The tests' pinned
     q0/0.5 runs are then unchanged.

   *Acceptance (at q2):*
   - Every 150 m, 400 m and 1 km station on Earth, Mars and Saturn: land t2 at least 0.95 and t1 at least 0.9. Today
     t2 is 0.13-0.44 and t1 0.00-0.13; x26 reached 1.15/1.14.
   - E_foot and M_foot: t1 at least 0.6 and t2 at least 0.85 (0.31/0.72 and 0.34/0.71 today).
   - E_150_45 at night: t2 at least 0.9.
   - Everywhere: t1 at most 1.4 and halo share at most 0.5 %.
   - Palette: ΔE76 at most 3 per region.
   - Paper border strip: mean difference at most 2/255.
   - Abstraction reads per far pixel: 13 becomes at most 4 (counted in the shader).

   *Risk:*
   - The far field shows the scene's own stair-steps until item 5 lands. At 1x they read acceptably (opened). This is
     why item 1 must land first.
   - The distance is less "washy". That is the coordinator's ruling, and the tremor stays on silhouettes.
3. **Free wins: stop drawing and updating what shows nothing.**
   - Files: `src/world/flora.js`, `src/world/index.js`, `src/world/terrain.js`.
   - In `flora.js`: dispose or hide undergrowth and grass cells beyond their 3D range plus a margin, at every
     altitude, and pick wanted cells by 3D distance from the camera. On the CPU, skip an instanced mesh whose chunk's
     nearest point lies beyond its lod maximum.
   - In `world/index.js`: use `root.updateWorldMatrix(true,false)` for both forced calls.
   - In `terrain.js` and `flora.js`: upload only the per-patch uniforms instead of `uniformsNeedUpdate`.

   *Acceptance:*
   - E_1000_90: at most 160 calls and 260k triangles (my reproduction of hiding them: 138 calls and 233,607
     triangles, at most 2/255 different).
   - Ship at 150 m: 0 undergrowth draws (98 today).
   - Every station's final frame within 2/255.
   - Node profile: `updateMatrixWorld` at most 5 % of world.update (24.7 % today).
   - On a scripted descent from 1 km, the undergrowth is laid by 110 m, with laid cells at touchdown within 10 % of
     today.
   - `contract.test.mjs` and `src/world` tests green.

   *Risk:* low.
4. **Post savings with an identical picture.**
   - Files: `src/render/post.js`, `src/render/texgen.js`.
   - Bake the paper reads once per resize into one RGBA8 and one RG texture at output size (6 or more taps become 1-2).
   - Delete the backdrop pass and clear the aux attachment with `clearBufferfv` to (0,0,20,0). The 8-bit fallback
     gets its own packed value.
   - Run the 'keep' pass only in frames where water was drawn, and the frame after.

   *Acceptance:*
   - Every station's final frame within 1/255 of before.
   - Sheet reads per output pixel: 17 become at most 11 (counted).
   - Post reads in the cost model: at 1080p q2, 147 M become at most 115 M; on a phone at 1266x585, 52 M become at
     most 40 M.

   *Risk:* none expected; it is proven by frame differences.
5. **Anti-aliasing.**
   - Files: `src/render/post.js`, `src/render/index.js`, `src/render/shared.js`, plus the aux readers in
     `src/world/sky.js` and `src/render/kitmat.js`.
   - `rtScene` gets `samples: 4` at tiers 2 and 1 on desktop.
   - Depth becomes a renderbuffer, invalidated after the scene pass.
   - The class must survive the resolve: a decode rule in every aux reader, for example that a pixel whose class is
     mixed takes the class of its depth-nearest neighbour. PAINTER chooses the rule.
   - Tier 0 and phones: an FXAA-class pass at internal resolution on the abstraction output, about 9 taps.
   - `?aa=0|post|msaa` overrides for tests.

   *Acceptance:*
   - Raw A at E_150_45 at most 0.40 (0.447 today; 0.397 in the live MSAA patch), and at E_400_90 at most 0.85 x
     baseline.
   - Raw b1/b2 within 5 %.
   - Region view: pixels whose class is not among their 3x3 single-sample neighbours at most 0.05 %, and no water
     pixels on sky or foliage edges away from water.
   - Flicker index F at every air station at most 0.8 x the baseline raw scene's F.
   - Extra target memory at 1080p reported. If it is over 100 MB, pack aux into RGBA8 while MSAA is on.

   *Risk:*
   - Bandwidth and memory on integrated and mobile GPUs: not measurable here. MSAA belongs to the tier, so the
     controller drops it before it drops pixels.
   - Shader aliasing is item 1's job, not MSAA's.

### PILOT · W3 Playable by touch on a phone and a tablet (R2; in parallel with R1)

1. **Gesture guard and touch input.**
   - Files: `index.html`, `src/ui/theme.css`, `src/core/touch.js` (new), `src/core/input.js`, `tests/touch.mjs`
     (new), `tests/touch.test.mjs` (new).
   - Guard: viewport with `viewport-fit=cover`; `touch-action:none` on the canvas and the touch layer;
     `overscroll-behavior:none`; the WebKit user-select, touch-callout and tap-highlight properties off; a
     non-passive touchstart `preventDefault`, and Safari's gesturestart.
   - Pointer events filtered to `pointerType` 'touch', with `setPointerCapture` per finger.
   - A floating stick on the left 40 % of the screen: radius 56 css px, dead zone 8 px; held at the rim for 0.25 s it
     runs.
   - A relative drag look elsewhere: about 200° per screen width on foot, a similar gain for the nose. Pinch moves the
     camera boom.
   - It merges into `Input.take()` like the gamepad, so `sim.js` does not change.
   - No pointer lock for touch-originated events.
   - The touch layer shows on the first touch or when `(pointer: coarse)` matches, and hides on a key press or a real
     mouse move.

   *Acceptance (Playwright emulation with CDP touch, on iPhone 14 landscape, Pixel 7 landscape and iPad Pro 11
   landscape):*
   - A tap starts the game with 0 compatibility mouse events.
   - A 120 px drag turns the view at least 30° with 0 pointercancel events.
   - A stick held for 2.5 s walks at least 5 m.
   - Jump goes at least 0.5 m up; a 2 s hold on the jetpack at least 5 m.
   - Stick and look work together.
   - A pinch leaves `visualViewport.scale` at 1.
   - In the ship, a drag pitches the nose, stick X turns and stick Y moves the throttle.
   - `lockcheck`, `input.test.mjs` and `gamepad.test.mjs` unchanged and green.
   - For reference, the audit's live patch reached 39.5°, 15.3 m at 4.22 m/s, 18.5 m and scale 1.

   *Risk:* the feel (gain, dead zone, run threshold) needs a real phone.
2. **The touch HUD: prompts become buttons.**
   - Files: `src/ui/hud.js`, `theme.css`, `map.js`, `book.js`, `layout.js`, `src/core/game.js`, `src/core/state.js`
     (`promptFor` also returns an action id).
   - Prompt slips sit in the right-thumb arc, 48 px tall, and stack two high.
   - Buttons: JUMP/RISE 72 px, SINK 56 px, BRAKE 52 px. PULSE and LAND are slips.
   - Top-left tabs of 44x44 px: MAP, SKETCHBOOK, HELP/PAUSE, VIEW.
   - Each panel gets a close corner and closes on a tap outside it. The map gets a 'set course' slip; the book turns
     pages by swipe.
   - Controls fade to 35 % after 4 s unused. Everything is placed inside the safe area.

   *Acceptance:*
   - `tests/touch.mjs` plays the whole loop by touch only: walk to the ship, board, lift off, climb above the air,
     map, Mars, set course, pulse, descend, land, step out, then open and close the book and the help. It runs on
     iPhone 14 landscape on stubs and in the painted world at q0, 400x225.
   - Every hit area is at least 44 css px.
   - On phones, no control sits in the subject box (x 30-70 %, y 55-100 %).
   - The desktop HUD is unchanged (`layout.test.mjs`, m3check).

   *Risk:* thumbs over the figure; hybrid iPads.
3. **Phone layouts and words.**
   - Files: `src/ui/*`, `src/core/game.js`, `src/core/sim.js` (said strings), `src/core/input.js`,
     `tests/words.test.mjs` (new).
   - Map: the chart fills the viewport, names at least 11 px, world hit radius at least 22 css px, and Earth and the
     Moon told apart on touch.
   - Book: a tab strip at least 40 px tall.
   - Help: a drawing of the touch controls, closed by a tap anywhere.
   - Title card clamped inside the top edge.
   - On touch the read-out moves to the top left.
   - A short new-sketch slip on short screens.
   - One `name(code)` function for every string: key, button or pad name.

   *Acceptance:*
   - Title card top at least 8 css px on the iPhone 14 and Pixel 7 profiles (-13 today).
   - Smallest lettering in the map, book and help at least 11 css px.
   - No touch-mode string names a key or the mouse.
   - Desktop strings unchanged (snapshot).

   *Risk:* low.
4. **Platform.**
   - Files: `index.html`, `manifest.webmanifest` (new; relative URLs, no icon files), `src/main.js`,
     `src/player/camera.js`.
   - Request fullscreen on the first touch (Android and iPad) and try to lock landscape.
   - The `apple-mobile-web-app` metas, and a one-time "Add to Home Screen" hint on iOS.
   - A Screen Wake Lock while playing; `navigator.audioSession.type = 'playback'` where it exists.
   - Phone held upright: a painted "turn sideways" slip over the paused picture.
   - Tablet held upright: the vertical field of view derived from the aspect, so at least 60° stay across.

   *Acceptance:*
   - The static rules still pass.
   - No console error in any browser run, where unsupported calls fail silently.
   - iPad portrait: horizontal field of view at least 60°.
   - Phone portrait: the slip shows.

   *Risk:* iOS behaviour cannot be checked here.
5. **The phone and tablet preset, first part.** It ships with R2, so a phone does not start at tier 2 with a
   1.5 pixel ratio.
   - Files: `src/main.js`, `src/core/game.js` (stats).
   - Phone: coarse pointer and a short side under 500 css px. Device pixel ratio capped at 1.25, start at tier 1.
   - Tablet: coarse pointer and a short side of 500 css px or more. Ratio capped at 1.25 and at most 1.6 MP.
   - The read-out names the preset, the AA mode and the depth mode (reversed or logarithmic).

   *Acceptance:*
   - iPhone 14 landscape: buffer = css size x 1.25.
   - iPad Pro 11: at most 1.6 MP (2.24 MP today).
   - A desktop 1920x1080 window keeps 1920x1080.

   *Risk:* low.

### PAINTER · W4 Smooth: hitches, garbage and wasted work (R3)

1. **Hitch caps and garbage, still on the main thread.**
   - Files: `src/world/flora.js`, `nearground.js`, `surface.js`, `floraplace.js`, `obstacles.js`.
   - Remove the 8 ms cap on the cost estimate.
   - Split `_buildTrees` per tree cell.
   - Make the near relist incremental (only the strip of cells entering or leaving, in typed arrays).
   - Make surface sampling allocation-free (reused outputs, Float64Array scratch, no 3-argument `Math.hypot`).

   *Acceptance (Node world bench, unloaded machine, run alone, q2, 5 ms budget):*
   - Walk, run and ship at 150 m: max world.update at most 8 ms (9.7-20.1, 24.5 and 9.4 today, my measurements).
   - Arrive: max at most 25 ms (74.5-78.3 today).
   - Allocation walking at most 0.15 MB per frame (0.56 today); flying at most 0.3 MB (1.20 today).
   - At CPU 4x (the mobile audit's `measure.mjs`) at q1 walking: world.update p95 at most 8 ms and max at most 33 ms.
   - Samples bit-identical (`contract.test`, world tests).

   *Risk:* low to medium.

### PHYSICS · W5 Physics without spikes or garbage; a phone tier (R3, then R4)

1. **Re-measure the baseline unloaded first.** The perf audit's maxima came from a shared CPU, and my world bench
   showed how much that inflates.
   - Then make the field updates allocation-free: the flora field (72 KB per frame), `air` and `sampleWind`, the
     weather's `cellAt` and `gather`, the particle step, `loose._move`.
   - Spread field recentering and an arriving body's warm-up over several frames, or put them behind the arrival veil.
   - Files: `src/physics/index.js`, `flora.js`, `air.js`, `weather.js`, `particles.js`, `loose.js`.

   *Acceptance (simbench, unloaded, run alone):*
   - Garbage at most 150 KB per frame walking (448 today) and at most 250 KB flying.
   - Max `sim.frame` at most 16 ms walking and flying.
   - The first frames on Mars at most 33 ms, or inside the veil.
   - Storm physics mean at most 3 ms (5.07 ms in the page today).
   - Every `src/physics` test, `coast.mjs` and `ghostfield.mjs` green; determinism bit-identical.

   *Risk:* low to medium.
2. **A phone tier (R4).** `physics.setQuality` takes the device preset: fewer particles, smaller fields, and storm
   particles capped per tier.

   *Acceptance:*
   - `measure.mjs` at CPU 4x on the phone preset: sim plus physics mean at most 3 ms and p95 at most 6 ms (4-6 ms mean
     today).
   - Rain still visible in the storm frame (opened).
   - Tests green.

   *Risk:* low.
3. **Optional (R5, after W8.1):** weather particles and field updates in the worker.

   *Acceptance:*
   - Main-thread physics at most 1 ms mean in fair weather.
   - Determinism unchanged.

### PILOT · W6 Every tier sharp, sized for each device (R4)

1. **Resolution floor and measured steps.**
   - Files: `src/core/dynres.js`, `src/main.js`, `tests/dynres.test.mjs`, `tests/dynres-sweep.test.mjs`.
   - The controller works on internal = tier share x render scale, with a floor of 0.67 (0.75 on phones and tablets).
   - Below the floor it sheds a tier (geometry, then MSAA).
   - Step sizes come from the gain the first step actually bought (`descent.avg`), not from the assumption that cost
     goes with pixels.
   - Cap and CPU detection kept.
   - URL pins win.

   *Acceptance:*
   - No model machine ends below the floor without a pin.
   - A machine whose cost does not scale with pixels (output-resolution post passes, vertex load; the perf audit's
     `dynsim` cost model) is not driven to the floor.
   - Every existing dynres test green.
   - The model UHD 620-class laptop at 1080p settles at 0.70 linear or more after R1 and R3 (0.59 today).

   *Risk:* a weak GPU may miss 30 fps at the floor and then sheds tiers. A real-GPU sweep is needed (section 7).
2. **The phone and tablet preset, second part.**
   - The 0.75 floor.
   - Even pacing: draw on alternate frames for a steady 30 fps when 60 cannot hold at the floor and the lowest
     allowed tier. It returns to 60 after 3 s under 14 ms.

   *Acceptance:*
   - Pacing model test with a 20-28 ms frame cost: interval 33.3 ± 1 ms with a standard deviation under 2 ms.
   - `measure.mjs` at CPU 4x on the phone preset, after R3: JS p95 at most 16 ms (q1 walking 20.9 today).

   *Risk:* a 30 fps lock on 120 Hz phones. The read-out shows it.
3. **Sketch capture off the frame.**
   - Files: `src/core/game.js`, `src/core/sketches.js`, a new worker module.
   - Render the kept frame into a small target, read it back asynchronously (PBO plus `fenceSync`), and run
     `sketchHand` and the JPEG encode in a worker (`OffscreenCanvas.convertToBlob`). Fall back to today's path.

   *Acceptance:*
   - Main-thread time of one capture at most 4 ms (22 ms median plus two extra repaints today).
   - The sketch page within 2/255.
   - `sketchpage.test`, `sketches.test`, m3check and painted-m3 green.

   *Risk:* low.
4. **README.**
   - Play on phones and tablets.
   - A touch controls table.
   - The new tier table.
   - The read-out lines (preset, AA, depth).
   - "Never verified" extended to touch feel, phone GPUs and iOS.

   *Acceptance:* the static step passes (every key still named).

### PAINTER · W7 Every tier sharp: far canopy, enlargement, tier shares (R4)

1. **The far canopy at every tier, out to 1.5-2 km.**
   - Files: `flora.js`, `florakit.js`, `materials.js`.
   - Far forms (the 26-triangle form, or 2-triangle crossed billboards or impostors) from the same placement, no
     longer scaled by `RANGE_SCALE`. Only the near and middle tiers scale.
   - `markFade` pushed out to 900..2600 m and `mid` to 700..2000 m.
   - A pop-free hand-over.

   *Acceptance:*
   - Foliage share:

     | Station | Tier | Today | Target |
     | --- | --- | --- | --- |
     | E_150_45 | q0 | 0.01 | 0.20 or more |
     | E_150_45 | q1 | 0.20 | 0.25 or more |
     | E_150_45 | q2 | 0.31 | 0.31 or more |
     | E_400_90 | q2 | 0.08 | 0.20 or more |
     | E_400_90 | q1, q0 | 0.00 | 0.15 or more |
     | E_1000_45 | q2 | 0.00 | 0.05 or more |

   - Added cost at q0 at E_150_45 at most +40 draws and +200k triangles, paid by W2.3.
   - Pop index on a descent film (1 km to 50 m at 30 m/s): no frame step over 12/255 on more than 0.2 % of the frame
     beyond what the motion explains.
   - E_foot within 1/255.

   *Risk:* vertex work at q0; impostors must take the far form's colour.
2. **An interpolating enlargement.**
   - Files: `post.js`.
   - Catmull-Rom (9 bilinear taps) or FSR1 EASU, then RCAS 0.5 from the sheet's existing ±1-texel taps, only when the
     picture is enlarged.
   - Remove the B-spline and the shake.

   *Acceptance:*
   - At internal 0.75 of the output, E_foot and E_150_45: t1 against their own raw at least 0.8. Today, at the
     controller's pick, the B-spline gives 0.22 and 0.06.
   - Halo share at most 0.5 %.
   - At internal = output, the frames are identical.

   *Risk:* low.
3. **Tier shares (PILOT's policy, PAINTER's constants).**
   - File: `render/index.js`.
   - TIERS scale [0.75, 0.85, 1.0]; at q0 only a 1 px near brush.

   *Acceptance:*
   - q0 internal at least 0.75 of the output at render scale 1.
   - E_150_45 t2 against the q2 raw: at least 0.6 at q0 and 0.75 at q1 (0.12 and 0.18 today).
   - E_foot at q0: at least 0.5 (0.17 today).

   *Risk:* fill rate at q0, paid by W2.2-W2.4.

### PAINTER · W8 Building and streaming off the main thread (R5)

1. **Worker pool.**
   - Files: `src/world/worker.js` (new), `terrain.js`, `flora.js`, `nearground.js`, `patchgen.js`.
   - 2 workers on laptops, 1 on phones.
   - The workers run `patchgen.stepPatch`, `treeCell`/`underCell` with `floraplace`, and the near clumps. Results come
     back as transferables; the main thread wraps them under a budget.
   - Worker modules import only relative paths, never `three`, because the import map does not reach workers.
   - Falls back to the main thread where module workers are missing.

   *Acceptance:*
   - Arrive: main-thread max at most 8 ms and p99 at most 4 ms; at CPU 4x, max at most 16 ms.
   - Patches and cells bit-identical to main-thread builds (new test).
   - `arrival`, `busy`, `hollow` and `farfoot` tests green; the veil order unchanged.

   *Risk:* medium (ordering). Module workers need Safari 15+ and Firefox 114+.
2. **Streaming.**
   - Files: `terrain.js`, `flora.js`, `nearground.js`, `world/index.js`.
   - Terrain one level coarser outside the frustum, refined as the player turns.
   - Dispose a body's flora and release its near rings when it stops being the active body.
   - Flora radii from the camera's 3D distance.
   - Drop the CPU copies of uploaded static geometry.

   *Acceptance:*
   - Spawn: full-detail patches built at most 200 (303 today), drawn patches unchanged (105).
   - A scripted 180° turn: patches in view at their normal level within 0.5 s, with no pop in the frames.
   - Tour Earth, Mars, Saturn, Neptune, Earth: CPU geometry at most 50 MB at the end (72.6 MB today), and Earth's flora
     0 meshes while on Mars.

   *Risk:* medium; a pop on fast turns.
3. **Shading cost.**
   - Files: `flora.js`, `materials.js`, `chunks.js`.
   - Sort tree instances near to far in `_retier`.
   - Branch around noise reads whose weight is zero (`markFade`, `near`).
   - Read the dapple once.
   - Low-frequency fields from a 2D or unmipmapped texture.

   *Acceptance:*
   - Trees passing the depth test before discard at the spawn at q2: at most 1.3 per pixel (1.78 today).
   - Scene reads at most 75 per pixel (99 today).
   - Stations within 2/255.

   *Risk:* low to medium.
4. **Draw calls.**
   - One dynamic instance buffer per body, kind and tier.
   - Terrain batched (multi-draw where available).

   *Acceptance:*
   - Spawn q2 at most 250 calls (473 today); Mars canyon at most 180 (292 today).
   - Renderer JS per frame -50 % (unloaded profile).
   - Wash-in timings unchanged (`busy`, `nightwash` tests, arrival frames).

   *Risk:* medium.
5. **Aerial perspective (a look decision, last).**
   - Files: `world/index.js`, `chunks.js`.
   - Fog distance scaled by how much air the line of sight crosses; the haze toward the horizon stays.

   *Acceptance:*
   - E_400_90 raw bands +15 % or more.
   - Horizon band mean colour ΔE at most 2.
   - PAINTER's look sign-off.

## 5. The quality guard: keeping or gaining detail at the top tier

**Stations.** These are fixed, with exact teleport arguments in the harness. They are the sharpness audit's 21:
- E_foot;
- Earth at 50, 150, 400 and 1000 m, each at 45 and 90 degrees down, heading 0;
- M_foot, and Mars in rust_canyons at the same four heights and two angles, heading 250;
- Saturn at 150 m, 45 and 90 degrees, heading 15.

All at hour 11, `weather=fair`, `kits=0`, cockpit view, hull hidden, `__pc.hold(true)`. Added to them:
- E_foot at night (hour 23);
- E_150_45 at dusk (hour 18.6);
- E_150_45 under the storm, set the way `tests/weather.mjs` sets it;
- Neptune at 150 m, 45 degrees;
- E_foot and E_150_45 in iPhone 14 landscape emulation with the phone preset.

**Tiers and sizes.**
- q2 at 1280x720 and at 1920x1080.
- q1 and q0 at 1280x720.
- The controller's own pick is not used: it is SwiftShader's choice, not a real machine's.

**Recorded per station.**
- Lossless frames: v0 final, v1 raw scene, v3 depth, v4 regions, v5 abstraction output.
- Metrics over the land, the ground by distance band, and the foliage:
  - lapvar;
  - b1, b2, b3 (2-6, 6-16, 16-40 px);
  - t1, t2, t3 against the raw scene;
  - A, the aliasing index: the 1x frame against a 2x-supersampled render of the same view, box-filtered down, on v1
    and v5;
  - F, the flicker index: the high-band change over two frames with a 0.25 px pan, normalised;
  - the halo share: pixels overshooting their raw 3x3 range by more than 8/255;
  - region shares (foliage share);
  - mean CIELAB per region and the L* percentiles 10, 50 and 90.
- Cost: draw calls and triangles from `renderer.info`, and post taps per pixel from the shader counts.

**Baseline.** `784183b`, committed as numbers, with the frames kept as evidence.

**Rules for any change that touches rendering or the world.**
1. **Detail at the top tier may only go up.**
   - At every q2 station, final land t1 and t2 at least baseline - 0.02, and raw b2/b3 at least 0.95 x baseline: the
     scene is never drawn with less detail where it is seen.
   - The exception is a planned change to the raw b1 (the prefilter, W2.1), which must lower A.
2. **No false sharpness.**
   - t1 at most 1.4 and halo share at most 0.5 %.
   - A on v5 at most the baseline raw's A.
   - F at most 0.8 x the baseline raw's F at the air stations, once W2.5 has landed.
3. **Look.**
   - Mean colour per region within ΔE76 3 of the baseline final; L* percentiles within 3.
   - The paper border strip within 2/255 on average.
   - Night, dusk and storm stations within the same palette bounds.
4. **Cost.**
   - Draw calls and triangles per station at most baseline +10 %, unless the item states a budget (W7.1 does).
   - The post-tap model may not grow, except by an item's stated cost (W2.5, W7.2).
5. **Eyes.**
   - For every station, a before/after contact sheet and 1:1 crops of the land, opened by the lead before the item is
     accepted.
   - For each release, a descent film from 1 km to touchdown on Earth and on Mars (frames at 1000, 400, 150, 50 and
     10 m), opened.
   - An item that worsens any station is not accepted until it is explained and the owner of the look agrees in notes.

**When.**
- The subset named in the item runs with that item.
- The whole set runs at the end of each release.
- `stations-quick` runs inside `tests/all.mjs`.

**Smoothness numbers.** Each runs alone, on an unloaded machine, with its baseline taken the same way:
- the Node world bench and simbench (max, p95, p99, frames over 16.7 ms, MB per frame);
- `measure.mjs` under CPU 4x at the phone viewport;
- the dynres model sweeps.

**Checks kept green.**
- `tests/all.mjs`: 13 steps today, plus `coast`, `ghostfield`, `touch` and `stations-quick` as they come.
- The three unit suites.
- `src/physics/coast.mjs`, `docs/lead/evidence/review7/ghostfield.mjs`.
- The grand tour (q0, 400x225, every world).
- `tests/motion.mjs`, for the camera.

URL pins (`scale`, `quality`, `dynres=0`) keep their meaning, so the painted test runs are not changed by the floor.

## 6. What only the owner's devices can confirm (asked at each release; about five minutes)

Open `?stats=1` on the laptop and on the phone and tablet. Note the frame, preset, AA and depth lines at these spots:
- the Earth spawn;
- ship at 150 m over the forest;
- 1 km over the forest;
- Mars canyon;
- under a storm.

On the phone, also report:
- the feel of the stick and the look drag (too fast, too slow);
- whether a thumb ever covers the explorer;
- whether "Add to Home Screen" plays without the browser's bars;
- whether sound plays with the silent switch on.

## 7. Not possible here

- **Real hardware.**
  - No real GPU: every GPU cost is counted (draw calls, triangles, taps, fragments) or modelled, never timed.
  - No phone or tablet, and no Safari or WebKit: the iPhone and iPad profiles are Chromium with an iOS user agent.
  - So none of these can be measured here: frame rate on a laptop or a phone, the bandwidth and memory cost of MSAA
    on integrated and tile-based GPUs, thermal throttling, iOS tab memory limits, and shader compile time on iOS.
- **Browser behaviour.**
  - Untestable: Safari's gesture and zoom quirks, the iOS silent switch, Home Screen mode, fullscreen and orientation
    lock.
  - Not checked: which browsers lack `EXT_clip_control` and so fall back to logarithmic depth.
  - Not measured: Chrome's own GC pauses (only Node's V8 was measured).
  - Untestable: the worker pool's parallel speed-up on a real multi-core laptop, and module workers in Safari and
    Firefox.
- **Feel and motion.**
  - How the touch controls feel, and real pointer lock on phones.
  - Shimmer in real motion beyond the sub-pixel pan index.
  - The look at 1440p and on 4K or dense screens.
- **Taken from the audits, not repeated by me.**
  - Only fair weather at 11:00 was measured for sharpness. Night, dusk and storm are new stations to be baselined in
    W1.1.
  - The perf audit's GPU model and the mobile audit's frame-rate estimates are estimates.
- **My own reproductions.** They cover only E_150_45 (with four post variants), E_1000_90 (the unseen undergrowth)
  and the Node world bench.
