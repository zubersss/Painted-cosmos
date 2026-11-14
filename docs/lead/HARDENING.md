<!-- Written by the coordinator's hardening-sweep workflow (run wf_790ce070-443: three finders, three adversarial verifiers, one synthesis; Opus at extra-high effort). Scratch files it names (candidate diffs, probes, simulations) are under /home/user/.pc-scratch/sweep/ in this container. -->

# Painted Cosmos: real-hardware sweep, synthesis

**Tree:** HEAD `59bfb1b`. The lenses ran on `3ed8d03` (glsl, gpu) and `fbd611f` (boot). The verifiers ran on `194171b` and `56c0333`. I re-checked every cited line against a clean export of `59bfb1b` (`/home/user/.pc-scratch/sweep/synth/root`), so **all file:line references below are HEAD's**. I also re-ran the dynres simulations on HEAD; the results did not change. No browser was run for this synthesis.

**Headline**
- **No blank-screen finding survived.** `module-fail-blank` was lowered to minor: it needs a browser the README does not support, or one failed request that a reload fixes.
- **22 findings survived verification. Merging two duplicate pairs leaves 20.** One of the 20 is already fixed in the tree (`branch-clock`, in `56c0333`). That leaves **19 open: 2 broken, 8 degraded, 9 minor.**
- **By owner:** PILOT has 17 open. PAINTER has 1 open, 1 already fixed, and 2 small hooks to add for PILOT's prewarm. **PHYSICS has none.**
- **Refuted:**
  - `deriv-after-discard`: Mesa 21.2 and later keep discarded pixels as helper lanes (`discard_is_demote`).
  - `undocumented-landing-cancel`: the behaviour is by design.
- **New in this synthesis:** a candidate patch for both dynres findings, tested in Node. It changes `src/core/dynres.js` only, and it lives in the scratch area, not the repo:
  - patch: `/home/user/.pc-scratch/sweep/synth/dynres-candidate.diff`
  - test cases: `/home/user/.pc-scratch/sweep/synth/dynres-sweep.test.mjs`
  - With the patch, the 10 existing dynres tests and the 5 new cases all pass. On HEAD, 4 of the 5 new cases fail. (Details in P4.)

## 1. Ranked survivors

Within each level, rows are ordered by how many players they hit.

| # | id | sev | owner | where (HEAD) | claim | fix |
|---|---|---|---|---|---|---|
| 1 | audio-not-started-in-gesture | **broken** | PILOT | core/game.js:69; audio/audio.js:75-80 | The AudioContext is created and resumed only from rAF, never inside a click or key handler. Safari is silent all session; a Chrome player using only a gamepad gets no sound. | Call `audio.start()` from a capture-phase pointerdown/keydown listener; call `resume()` only from a gesture. |
| 2 | pad-nonstandard-spin | **broken** | PILOT | core/input.js:136; core/gamepad.js:28-32, :43 | The first device with axes wins, whatever its mapping. A HOTAS throttle or wheel pedal resting at ±1 reads as a full right stick: the camera spins at 2.4 rad/s, the title card starts on its own, and the game cannot be played. | Use only `g.mapping === 'standard'` pads, or learn each axis's rest value and never let a non-standard pad set `active`. |
| 3 | no-shader-prewarm | degraded | PILOT (+PAINTER hooks) | main.js:195-200; world/index.js:143, :286; world/flora.js:454; render/post.js:296, :357 | Nothing calls compile or compileAsync. Sky glaze, wash, cloud shell, ring, 9 of the 12 kits, the 4-sector Kuwahara and other worlds' props are built on first draw mid-game. On ANGLE-D3D11 each one blocks for roughly 100 ms to 1 s, and each stall also triggers #4. | Warm everything behind the loading card: load the kits, build every body's dab and flora, `await renderer.compileAsync`, then draw each post material once. |
| 4 | dynres-overreacts-to-single-hitches | degraded | PILOT | core/dynres.js:81-85, :105-117; main.js:182-186 | One frame of 65-250 ms (a compile, `Flora._init` on arrival) fires the panic path. 100 ms gives scale 0.555 for about 49 s; 180-249 ms gives tier 1 for about 81 s. | Clamp each sample before it enters the EMA, and panic only when 3 of the last 5 frames are slow (candidate diff). |
| 5 | pointerlock-esc-cooldown | degraded | PILOT | core/input.js:45, :68, :74-80 | Any refused `requestPointerLock` turns pointer lock off for the session. Chrome refuses a request made within 1.25 s of the user pressing Esc, and the README tells players to press Esc. | On a refusal keep pointer lock on and say "click again". Fall back for good only after repeated refusals that did not follow an Esc. |
| 6 | **dynres-refresh-cap** (merges dynres-reads-refresh-cap-as-load + dynres-30hz-cap) | degraded | PILOT | core/dynres.js:25, :27, :93, :105-148; main.js:185-186 | The controller cannot tell a refresh or rAF cap from load. At 30/40/48/50 Hz (Chrome Energy Saver, Safari Low Power Mode, 50 Hz panels, 30 Hz TVs) an idle GPU ends at tier 0, scale 0.5 within 2-8 s and never comes back. | If shedding at least 40% of the picture leaves a steady interval unchanged, go back to where the descent started and use that interval as the budget (candidate diff). |
| 7 | no-clip-control-fallback-kills-early-z | degraded | PAINTER | main.js:40-43; render/chunks.js:12-21; materials.js:106, 349, 729, 1004, 1107, 1283; kitmat.js:140; world/orbit.js:43, 103; three.module.js:409 | Without EXT_clip_control (Firefox) every scene shader writes `gl_FragDepth`, which turns off early-Z and hierarchical Z. At the Earth spawn that shades about 2.9× the fragments (4.30 vs 1.48 per pixel). | Write log depth in the vertex shader (`gl_Position.z`) and drop the fragment write, except for materials that opt in. |
| 8 | keys-by-position-labels-qwerty | degraded | PILOT | core/input.js:31-35; core/game.js:70-71; ui/hud.js:48-53; core/state.js:128-136 | Bindings use `e.code`, labels use QWERTY letters. On AZERTY the key labelled M never opens the map. On Dvorak and Colemak the "E" and "F" prompts point at other keys. | Also match the action letters by `e.key`; build the labels from `navigator.keyboard.getLayoutMap()`. |
| 9 | pointerlock-flick-fallback | degraded | PILOT | core/input.js:50-56, :88-112 | The spike filter judges raw pixels per event and ignores elapsed time. At 30-40 fps a fast flick loses most of its turn, and three flicks (or brisk turns through hitches) drop pointer lock for good. | Scale the `big` and `spike` thresholds by the time since the previous mousemove; never make this fallback permanent. |
| 10 | **output-pixel-cap** (merges no-output-pixel-cap-sheet-pass-unscalable + no-1080p-output-cap) | degraded at 4K, minor on Retina | PILOT | main.js:79, :120-126; render/index.js:52, :56-61; render/post.js:373 | Output size is CSS size × min(DPR, 1.5) with no pixel cap, which contradicts main.js:79. The sheet pass (15 fetches per pixel) always runs at output size. An iGPU driving a 4K monitor at 150% is pinned at the floor picture. The two verifiers split on severity. | Cap the drawing buffer at about 2.3 MP in `resize()` and let CSS stretch it. |
| 11 | touchpad-wheel-zoom | minor | PILOT | core/input.js:69; core/sim.js:192 | Every wheel event counts as a full 0.8 m step, so one touchpad swipe slams the camera boom from 2.2 m to 14 m or back. | Add up `deltaY` (scaled by deltaMode) and divide by 120 per notch. |
| 12 | map-under-pointer-lock | minor | PILOT | core/game.js:210-221; ui/map.js:116, :125; ui/book.js:59 | The map and sketchbook open while the mouse is still captured: there is no cursor, so "click a world" does nothing until the player presses Esc. | Call `exitPointerLock()` when a panel opens. |
| 13 | physics-quality-never-follows-tier | minor | PILOT | main.js:131, :189; physics/index.js:72, :587; physics/particles.js:36 | PHYSICS stays at quality 1 all session. Tier 0 cannot shed particle CPU, and tier 2 never gets its storm counts. | Call `physics.setQuality` next to each `painter.setQuality`. |
| 14 | hidden-tab-audio-frozen | minor | PILOT | audio/audio.js; core/game.js:192, :360-390 | rAF stops in a hidden tab, so the mixer freezes at its last level: the jetpack hiss or ship drone keeps playing from a background tab. | On visibilitychange: when hidden, ramp the master gain to 0 and `ctx.suspend()`; resume when visible. |
| 15 | key-state-drops-or-sticks | minor | PILOT | core/input.js:31-36 | After a blur, a key that is still held is ignored (its repeat keydowns are dropped). A Cmd chord on macOS can leave W stuck down. | Add the key to `keys` on repeat keydowns too; clear `keys` on a Meta keyup. |
| 16 | dpr-change-not-tracked | minor | PILOT | main.js:120-129 | A DPR change with no CSS resize (window moved to a monitor with different scaling) keeps the old buffer size. Confirmed for Safari; Chrome not settled. | Add a `matchMedia` resolution listener that re-arms itself with the new DPR. |
| 17 | webgl-missing-message | minor | PILOT | main.js:44, :245-248 | With no WebGL2 (hardware acceleration off, blocklisted driver, VM) the player sees only a cryptic three.js error on the paper. | Probe for webgl2 first and print a plain sentence. |
| 18 | module-fail-blank | minor | PILOT | index.html:9-15; main.js:245-248 | Any failed static import (no import maps on Safari before 16.4, one 404) leaves a blank paper sheet with no message. | Add a classic inline script: check import-map support, add `onerror` on the module script, and show a message after a 15 s timer. |
| 19 | context-loss-unhandled | minor | PILOT | main.js:44, :174-209 | If the context is lost and never restored (TDR, Chrome blocking WebGL), the paper stays blank while the sound plays on, with no hint. | Listen for webglcontextlost/restored; show a "reload" message after 5 s. |
| 20 | branch-clock-uniform-never-bound | minor | PAINTER | render/shared.js:125-136, :148 | **Already fixed in the tree (since 56c0333):** `PHYS` now carries `uPhysBranchClock` (shared.js:135). | Confirm only (A3). |

## 2. Fix lists

### PILOT (in order)

The browser checks for P1, P7, P8, P13, P14 and P15 can share one Chromium run, one page after another, the way `/home/user/.pc-scratch/sweep/boot/work/probe.cjs` does. The boot and gpu harnesses use hard-coded `../root` paths. To use one, copy it into `/home/user/.pc-scratch/sweep/<label>/work/` next to a fresh `<label>/root` export of the fixed tree.

**P1 audio-not-started-in-gesture (broken).**
- **Where:** core/game.js:69 is the only caller and runs from rAF; audio/audio.js:75-80 creates and resumes the context; main.js:95 creates `audio`.
- **Fix, main.js after :95:**
  ```js
  const wake = () => audio.start(true);
  for (const t of ['pointerdown', 'keydown', 'touchend']) document.addEventListener(t, wake, { capture: true });
  ```
- **Fix, audio.js:75-76:** `function start(gesture)`, and call `ctx.resume()` only when `gesture` is set. The per-frame call at game.js:69 then cannot pile up a pending `resume()` promise every frame. Remove the listeners once `ctx.state === 'running'`.
- **Gamepad-only Chrome players:** gamepad input never counts as activation. While the context is suspended after start, show "click or press a key for sound".
- **Check:**
  - Launch Chromium with `--autoplay-policy=user-gesture-required`.
  - In an init script, wrap `AudioContext` and `resume` to log `!!window.event` and `navigator.userActivation.isActive` at each call.
  - Wait for `__pcReady`, then `page.mouse.click` on the canvas.
  - Expect: the context is constructed with `window.event` set (inside the handler), `state === 'running'`, and at most one `resume()` per gesture.
  - Repeat with a faked `navigator.getGamepads` pad and no click: expect no warning spam over 5 s.

**P2 pad-nonstandard-spin (broken).**
- **Where:** core/input.js:136; core/gamepad.js:28-32 (axes) and :43 (`active`).
- **Smallest fix, input.js:136:** add `&& g.mapping === 'standard'` to the pick condition. README.md:75 already promises the standard layout.
- **Better fix:** when there is no standard pad, record each axis's value at first sight, use an axis only after it has once returned within the dead zone of 0, and never let a non-standard pad set `active`.
- **Check:** add a case to tests/gamepad.test.mjs. Construct `Input` in Node with stubs (as `/home/user/.pc-scratch/sweep/boot/work/flick.mjs` does) and a `navigator.getGamepads` returning `[hotas {mapping:'', axes:[0,0,-1,0]}, xbox {mapping:'standard'}]`. Expect `input.pad` to read the Xbox pad, `lookX === 0`, and `used === false`. Then run `node --test tests/gamepad.test.mjs` (13/13 pass on HEAD today).

**P3 no-shader-prewarm (degraded). Needs PAINTER's A2 hooks.**
- **Where:** main.js:195-200 sets `__pcReady` once settled.
- **Fix:** on the first settle, start one async warm step and set ready only when it resolves. The card stays up meanwhile.
  ```js
  if (!warming) warming = (async () => {
    if (world.prewarm) await world.prewarm();                 // A2
    if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
    if (painter.prewarm) painter.prewarm();                   // A2
  })().catch(() => {}).then(() => { warmed = true; });
  if (warmed) { window.__pcReady = true; dyn.rest(); /* the rest of :200-205 */ }
  ```
- **What it costs:** load time on Windows grows by the compile time, which is the intent. ANGLE-D3D11 may still build output-layout variants at the first real draw, so optionally draw each newly compiled scene material once into the scene render target behind the card.
- **Check:** copy `/home/user/.pc-scratch/sweep/gpu/probe/probe.mjs` (it counts `linkProgram`) and point it at a fixed export. Expect 0 links after `__pcReady` through night, day, space, a storm with kits and a forced tier 0. SwiftShader cannot show stall times (see Gaps).

**P4 dynres-overreacts-to-single-hitches + dynres-refresh-cap (degraded ×2).**
- **What the candidate diff does** (`/home/user/.pc-scratch/sweep/synth/dynres-candidate.diff`, dynres.js only, +45 lines). It has three separable parts:
  - **(a) Hitches.** At :84-85, clamp the sample to `min(dt, max(2.5*ema, 50))` and weight it by the clamped value. At :105, panic only when the EMA is over the line *and* 3 of the last 5 raw frames are.
  - **(b) Quantized-vsync sawtooth.** A panic during a probe takes back only the probe step and doubles `probeBackoff`, as :119-123 already do.
  - **(c) Caps.** `budget()` uses the learned cap: high = max(18.6, 1.1×cap), panic = max(30, 1.8×cap). Each descent is tracked. If at least 40% of the picture has been shed and, 2.5 s on, the steady average has not moved (≥97% of where it was, jitter < 1.5 ms, ≤ 42 ms), the controller goes back to where the descent started and adopts that average as the cap. It forgets the cap after 3 s below 0.8×cap.
  - The main.js arrival `rest()` that the finding proposes is then optional.
- **Results, Node with the real controller** (scripts in `/home/user/.pc-scratch/sweep/synth/sim/`):

  | scenario | HEAD | with the diff |
  |---|---|---|
  | 30/40/48/50 Hz cap, idle GPU | tier 0, scale 0.5 for good | 1.0 / tier 2 by 2.8-3.1 s |
  | 30 fps cap from t = 60 s (Energy Saver) | tier 0 for good | restored at 62.8 s |
  | single hitch, 60-180 ms | up to tier 1 for 81 s | no change |
  | single hitch, 249 ms | tier 1 for 81 s | scale 0.92 for 8 s |
  | two 120 ms hitches 3 s apart | tier 1 | no change |
  | strict-quantized display | 86 changes / 300 s, mean scale 0.69 | 14 changes, mean 0.78 (0.8 holds) |
  | pipelined, storm, GPU-bound 40 ms | — | identical to HEAD |
  | 30 Hz cap + heavy GPU | 0.5 / tier 0, 0.1 s under 30 fps | 0.94 / tier 1, 1.9 s under 30 fps in 300 s (failed probes) |
  | rAF jitter ±0.3 to ±4 ms | — | caps still detected |

- **Behaviour change to accept:** a CPU-bound machine, whose steady interval does not move when shedding, now keeps the top picture instead of dropping to the floor for no gain. Do P8 with this, so that a tier drop really sheds the physics CPU.
- **Check:** in the fixed export run `cp /home/user/.pc-scratch/sweep/synth/dynres-sweep.test.mjs tests/ && node --test tests/dynres.test.mjs tests/dynres-sweep.test.mjs`. Optionally run `node /home/user/.pc-scratch/sweep/synth/sim/scen.mjs <export-root>`.

**P5 pointer lock: esc-cooldown, flick-fallback, map-under-lock (degraded, degraded, minor).** All three are in core/input.js and core/game.js.
- **Esc cooldown, input.js:45 and :68:** call a new `refused()` instead of `fallBack`.
  - If less than 1.5 s has passed since the user unlocked, set `message = 'Click again to capture the mouse'` and return.
  - Otherwise count the refusal, and call `fallBack(...)` only at the third.
  - Record the unlock time at input.js:66 (the `else if (was)` branch).
- **Flick, input.js:88-90 and :55:**
  - In the mousemove handler, compute `k = clamp((e.timeStamp - lastTs) / 16.7, 1, 8)`.
  - Use `big >= 120*k`, `spike >= 400*k`, and the `< 400*k` limit at :55.
  - Let a `finishOdd` fallback (:111) re-arm on the next mousedown once; make it permanent only on a second trip.
- **Map, game.js:210-221:** when a panel opens, `try { document.exitPointerLock(); } catch {}`.
- **Check:**
  - Copy `/home/user/.pc-scratch/sweep/boot/work/flick.mjs` next to the fixed export. At 30 fps, three 180-degree turns in 180 ms, 250 ms apart, should keep the lock and apply at least 90% of the 1366 px. 60 fps should be unchanged.
  - Add a unit case: an element whose `requestPointerLock` rejects once leaves `usePointerLock === true`.
  - `node tests/lockcheck.mjs --root <export>` (one browser run) must still fall back on the headless spike stream.

**P6 keys-by-position-labels-qwerty (degraded).**
- **Fix, input.js:30-35:**
  - Keep `e.code`.
  - When `e.key` is one Latin letter whose `'Key'+upper` is an action key (E V C X F M B H) and differs from `e.code`, also add that alias to `keys` and `edges`.
  - Remember the alias per code, so the keyup removes both.
- **Labels, hud.js:48-53 and state.js:128-136:** build them from `navigator.keyboard.getLayoutMap()` where it exists (Chromium only). The WASD row then reads "Z Q S D" on AZERTY.
- **Colemak:** the key labelled F sits on code KeyE, so it would fire both F and E. state.js:128-136 never prompts E and F in the same state; check that nothing else binds both.
- **Check:** a Node unit with a stub document. `{code:'Semicolon', key:'m'}` should give `edges` containing KeyM. `{code:'KeyW', key:'z'}` should give `keys` = {KeyW} only.

**P7 output-pixel-cap (degraded at 4K).**
- **Fix, main.js:121:**
  ```js
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(2.3e6 / Math.max(1, canvas.clientWidth * canvas.clientHeight)));
  ```
  1920×1080 at DPR 1 is unchanged; 4K at 150% gives about 2022×1137.
- **Owner's call:** dynres.js:6 says the paper composite stays at full resolution on purpose, so the owner should choose between that and main.js:79.
- **Check:** one page with viewport 2560×1440 and `deviceScaleFactor: 1.5`. Expect `canvas.width*canvas.height <= 2.3e6` and a screenshot that fills the window.

**P8 physics-quality-never-follows-tier (minor; do it with P4).**
- **Fix:** after main.js:131 add `if (physics && physics.setQuality) physics.setQuality(dyn.quality);`. After :189 add the same call with `r.quality`. Buffers are already allocated at quality-2 capacity (particles.js:95).
- **Check:** load `?quality=0` and read `__pc.physics.quality === 0`. On a default load expect 2.

**P9 touchpad-wheel-zoom.**
- **Fix, input.js:69:** `this.wheel += e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1) / 120;`. The only reader is sim.js:192, which keeps 0.8 m per notch.
- **Check:** a unit case. 30 events of `deltaY` 4 should move the boom by under 1 m; one 120 px notch should move it 0.8 m.

**P10 hidden-tab-audio-frozen.**
- **Fix:** add `pause()` and `resume()` to audio/audio.js. `pause()` ramps the master gain to 0 over 50 ms, then calls `ctx.suspend()`; `resume()` does `ctx.resume()` and ramps back. In main.js add a `document` `visibilitychange` listener that calls them.
- **Check:** in the page, define `document.hidden = true`, dispatch `visibilitychange`, and expect the context state to be `'suspended'`. Exposing a state getter on `__pc.audio` helps.

**P11 key-state-drops-or-sticks.**
- **Fix, input.js:33:** `this.keys.add(e.code); if (!e.repeat) { this.edges.add(e.code); this.used = true; }`. At :35, on a keyup with `e.key === 'Meta'`, call `this.keys.clear()`.
- **Check:** a unit case. Blur, then a repeat keydown of W, should leave KeyW held.

**P12 dpr-change-not-tracked.**
- **Fix, main.js:128:** add a `matchMedia(`(resolution: ${devicePixelRatio}dppx)`)` change listener (`once: true`) that calls `resize()` and re-arms itself.
- **Check:** cannot be provoked headless here; the verifier's CDP DPR override fired neither event. Review the code only.

**P13 webgl-missing-message.**
- **Fix, before main.js:44:** if `document.createElement('canvas').getContext('webgl2')` is null, set `loading.textContent` to "Painted Cosmos needs WebGL 2: turn on hardware acceleration in the browser settings, or use a current Chrome, Edge, Firefox or Safari." and return without throwing.
- **Check:** the `nogl2` case of probe.cjs. Expect that text and no console errors.

**P14 module-fail-blank.**
- **Fix, index.html:14-15:** add a classic inline script before the module script.
  - If `!(HTMLScriptElement.supports && HTMLScriptElement.supports('importmap'))`, write the "needs a current browser" text into `#pc-loading`.
  - Add `onerror` on the module script, a window `error` listener and a 15 s timer. If `window.__pc` is still unset, write "could not load the game: reload the page".
- **Check:** the `modfail` case of probe.cjs (book.js answered 404). Expect the message within 15 s.

**P15 context-loss-unhandled.**
- **Fix, after main.js:44:** on `webglcontextlost` on the canvas, show "the paper is being redrawn…". If `webglcontextrestored` has not arrived within 5 s, show "the graphics driver stopped: reload the page (your journey is saved)". Clear the message on restore.
- **Check:** the `lost` case of probe.cjs. Expect the message after `loseContext()`, and that it clears after `restoreContext()`.

### PAINTER (in order)

**A1 no-clip-control-fallback-kills-early-z (degraded).** three r187's `logdepthbuf_fragment` (three.module.js:409) writes `gl_FragDepth` unconditionally. Every scene fragment shader includes it (materials.js:106, 349, 729, 1004, 1107, 1283; kitmat.js:140; orbit.js:43, :103).
- **Fix, render/chunks.js:12 (VERT_PARS):** after `#include <logdepthbuf_pars_vertex>` add
  `#ifdef USE_LOGARITHMIC_DEPTH_BUFFER` / `uniform float logDepthBufFC;` / `#endif`.
- **Fix, chunks.js:16 (VERT_END):** after `#include <logdepthbuf_vertex>` add, inside the same `#ifdef`:
  `gl_Position.z = (log2(max(1e-6, 1.0 + gl_Position.w)) * logDepthBufFC - 1.0) * gl_Position.w;`
- **Fix, chunks.js:21 (FRAG_PARS):** after `#include <logdepthbuf_pars_fragment>` add
  `#if defined(USE_LOGARITHMIC_DEPTH_BUFFER) && !defined(PC_FRAG_LOGDEPTH)` / `#undef USE_LOGARITHMIC_DEPTH_BUFFER` / `#endif`.
- **Large near triangles:** set the `PC_FRAG_LOGDEPTH` define only on materials whose large triangles near the camera show poke-through: likely pc-water (materials.js:540) and pc-near (:1332). Give those materials a late `renderOrder`, because on some GPUs one depth-writing shader turns off hierarchical Z for the rest of the pass.
- **Check:**
  - Copy `/home/user/.pc-scratch/sweep/glsl/dump.mjs`, set `ROOT` to a fixed export, and run `node dump.mjs ldfix "" --noclip --steps /home/user/.pc-scratch/sweep/glsl/steps2.json`.
  - Every program should link with empty logs and no console messages.
  - `grep -l gl_FragDepth <out>/ldfix/src/*.frag` should list only the opted-in materials.
  - Compare the spawn and space screenshots with `/home/user/.pc-scratch/sweep/glsl/out/logdepth/00-ready.jpg` and `01-space-earth.jpg`. Add close shots of the explorer at the shoreline and of the ship on its pad: there should be no holes and no Z-fighting.
  - The early-Z gain itself cannot be measured on SwiftShader.

**A2 Prewarm hooks for P3.**
- **`world.prewarm()` in world/index.js:**
  - Keep the kits `import()` promise from :143 and await it.
  - Call `makeDab(st)` (:84) for every body whose dab is still missing (today they are made lazily at :286).
  - Call `st.flora._init()` (flora.js:71) for every body that has flora and is not `ready` (today this happens lazily at :454).
  - If keeping every world's flora in memory is too much, compile each body's prop materials against one tiny `InstancedMesh` instead, then dispose it.
- **`painter.prewarm()` in render/index.js and render/post.js:** draw `mAbs[4]`, `mAbs[8]`, `mSheet` and the prep and keep materials once into a 2×2 target. `mAbs[4]` is otherwise first drawn at tier 0 (post.js:357), when the machine is already under load.
- **Check:** as for P3.

**A3 branch-clock (already fixed).**
- shared.js:135 adds `uPhysBranchClock`. It came in the coordinator's snapshot `56c0333`, after the lens tested `3ed8d03`. Keep it when the WIP is finalised.
- **Check:** in a page, read `uniforms.uPhysBranchClock` on `pc-prop-tall-broadleaf0`. It should exist and change between two reads 10 s apart, as in the glsl lens's step `branchclock`.

### PHYSICS

No survivor needs a PHYSICS change. Two notes:
1. **With PILOT's P8, quality 2 becomes live at tier 2:** rain 3200, leaves 6000, 12 samples per frame (physics/index.js:38, particles.js:36). Please confirm that a storm at quality 2 stays inside your frame budget with your `PC_TIMING=1` timing tests on the fixed export.
2. **The lab's hand binding still works:** physics/three/painted-lab.js:176 and :574 bind `uPhysBranchClock` by hand. That stays correct now that `PHYS` has the key: the spread gives the lab its own Vector4, and :574 keeps updating it. Simplifying it is optional.

## 3. Gaps (never verified here; say so plainly)

**Needs real hardware or another engine (nothing here could settle it)**
1. **Frame rates.** No real frame rate was measured anywhere. Every UHD 620, Iris Xe or Vega 8 figure is an estimate from fetch counts. The brief's "60 fps at 1080p on an integrated GPU, never below 30" is **neither confirmed nor refuted**. That includes the 4K sheet-pass cost (P7) and the early-Z gain (A1).
2. **Shader compile times on real drivers.** Times on ANGLE-D3D11 (FXC), Metal and Mesa were not measured, so P3's stall sizes are typical ranges, not measurements. SwiftShader has no KHR_parallel_shader_compile, so the async path of `compileAsync` was never exercised.
3. **Real shader backends.** The real ANGLE backends (HLSL/FXC, MSL, native desktop GL) never compiled these shaders. Only ANGLE's ESSL front end and SwiftShader did. glslangValidator was fetched, but the permission classifier blocked running it. FXC-specific failures (loop or gradient limits) are therefore unchecked.
4. **Firefox was never run.** `/opt/pw-browsers` holds only `chromium-1243`, and Playwright's browser CDN is not a package registry. Firefox's current EXT_clip_control status, and so how many players take A1's path, is unconfirmed: bugzilla and web3dsurvey were unreachable. Firefox's Esc under pointer lock, its wheel deltas and its mousemove coalescing were also not run.
5. **Safari/WebKit was never run.** Not run: the audio gesture rule (P1), Low Power Mode rAF throttling (P4c), DPR changes without resize (P12), import maps below 16.4 (P14). Safari's EXT_clip_control status is also unknown; if it lacks the extension, A1 applies to every Safari player as well.
6. **Chrome browser-layer behaviour was read, not observed.** That covers the Esc re-lock pause of 1250 ms, the Energy Saver 30 fps cap, and the rule for when a gamepad is exposed. P4c's 1.5 ms jitter threshold is tuned on simulated jitter; check it on a real throttled laptop.
7. **Real input devices.** Not tested: standard pads, HOTAS or wheels, touchpad wheel-event rates, AZERTY/Dvorak/Colemak, IME, and the missing keyup with Cmd on macOS.
8. **Rare GPU events.** Not tested: context loss that is never restored (TDR) and moving between monitors with different DPR.
9. **Refuted from source, not hardware.** `deriv-after-discard` was refuted from Mesa 25.2.8 source, not by running on that driver. Old AMD stacks with Mesa before 21.2 (for example stock Debian 11) would still show wrong derivatives at discard edges.

**No lens covered it**
10. **The full new-player trip.** Opening the page, the forest, walking, jetpack, boarding, space and landing on all eight planets was **not run end to end in this sweep**.
    - Visited: Earth spawn, space above Earth, Saturn orbit, Jupiter atmosphere, Neptune shore, Mars dust storm, Earth blizzard, the Moon.
    - Never visited: Mercury, Venus and Uranus, and no landing anywhere but the Earth spawn.
    - The gpu lens stopped its per-planet program census after the Moon. The team's own tour (`e047e7b`) also left Neptune, Pluto and tier 1 unrun.
11. **Tiers 0 and 1** were never rendered in a browser; they were compared only statically (SECTORS=4 Kuwahara and uniform values).
12. **Missing float colour buffers.** What happens when EXT_color_buffer_float/half_float is missing was not run. The RGBA16F MRT targets have no fallback, so a blank screen is likely. That is a low risk on desktop WebGL2, but it is a 5-minute check here: hide both extensions in dump.mjs the way `--noclip` hides EXT_clip_control.
13. **CPU cost is unmeasured:**
    - Render submission (460 draws) with `uniformsNeedUpdate` forcing a full uniform re-upload on each draw (world/terrain.js:119, :139; world/flora.js:142; world/sky.js:398, :420; materials.js:1351). On a weak laptop CPU this may be the real limiter, and after P4c such a machine would keep the top tier rather than shed it.
    - Physics and kit CPU in a real storm: the forced `setWeather` spawns no particles.
    - Vertex cost of 1.44 M triangles with 12 texelFetch per grass vertex.
14. **Overdraw elsewhere.** Overdraw was measured only at the Earth spawn in third person.
15. **Lab page.** `physics-lab.html?painted=1` and its own shaders were not run.
16. **Swimming save.** Whether a save made while swimming restores on the seabed (save.js:83-85) was not checked.
17. **Unreported undefined behaviour (low risk).** Reversed smoothstep edges at kitmat.js:52, world/orbit.js:131, materials.js:410 and world/sky.js:158 are undefined per ESSL 3.00 §8.3, but no known desktop driver misbehaves. `atan(0,0)` can occur at a single pixel. Both are cheap to make well-defined if PAINTER wants to.
18. **Unit suite.** No lens ran the repo's unit suite on HEAD. I ran only tests/dynres.test.mjs and tests/gamepad.test.mjs: 13 of 13 pass on `59bfb1b`.

**Files from this synthesis** (all under /home/user/.pc-scratch/sweep/synth/):
- `root/` — clean export of 59bfb1b
- `dynres-candidate.diff` — the P4 candidate patch
- `dynres-sweep.test.mjs` — the 5 new dynres test cases
- `patched/` — the export with the candidate applied
- `sim/` — `capP.mjs`, `hitchP.mjs`, `quantP.mjs`, `pipeP.mjs`, `scen.mjs`, `jit.mjs`; the unpatched copies are `cap.mjs`, `hitch.mjs`, `quant.mjs`
