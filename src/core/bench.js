// Painted Cosmos: a speed test for a real device. OWNER: PILOT.
//
// `?bench=1` (with whatever else the address says: look=oil, quality, preset, body, time). A cloud session has no
// graphics card: how fast the game draws on the owner's own phone or desktop cannot be measured there, only guessed
// from software drawing. This asks the device itself. Once the first view is whole it stands still and draws the same
// view some fifteen ways, a few seconds each, counts the pictures a second of each, and leaves the table on the screen
// to be photographed and sent. Nothing is saved or sent anywhere. The resolution controller is off while it runs
// (main.js), so every row is drawn at the settings it names.
//
// The rows are questions (second form, after the first table from the owner's phone, 2026-11-16, which showed the ground's
// paint and the plants to carry the frame but not why):
//   the paint: the lighter paint against the full one; the ground one flat colour (what is left is the ground's shape,
//     not its paint); the plants one flat colour (what is left is their geometry);
//   what is drawn: without the trees, the small plants, the near grass, the ground, the water;
//   the light: without the light in the air, without shadows (the header says whether the sun was out at all);
//   the picture: at half size; the low tier.
// FIFTH FORM (2026-11-17, after the two tables of the fourth from the owner's phone). Those showed the far trees to be
// half the frame and their own paint not to be why, and they showed the test itself to be too rough for anything finer:
// the phone's frames come in steps of 8.3 ms, it warms through a run, and two rows were timed while their shaders were
// being built. So: a row is timed only when the picture has settled from its switch; each row gives its mean frame
// time, the middle one and the longest; "as set" is timed again before each group and every question is set against
// the one before it. The questions are about the far trees: their paint, their shapes, the shadow pass or the picture,
// first or last in the order of drawing, and the lump against the tree of flat pieces IN THE SAME RUN (the form is
// swapped while the test runs). Then the other plants, the light, the paint.
// EIGHTH FORM (2026-11-18): THREE ROWS THAT RAISE THE LOAD. The seventh form's first table came back reading 16.7 ms
// on eleven rows in a row - the phone's own 60-a-second cap, not the game - so those rows measured nothing but the
// screen. The last rows now draw the picture half again and twice as sharp (and twice as sharp with the full paint),
// which breaks the cap and shows what the game really costs, and how much room the owner's phone has to spare.
//
// SEVENTH FORM (2026-11-17): THE GAME IS HELD STILL while the rows are timed (the explorer, the view and the clock
// are put back after every frame). Two tables before this one could not be read: the explorer had drifted down a river
// and walked on, so each row saw its own picture, and the same row read between 28 and 52 ms.
// SIXTH FORM (2026-11-17): two more rows about the shadow pass, which is a third of a frame's triangles at a phone's
// size (the trees drawn again from the sun, into a square 2048 wide): the square half as wide, and the trees out of it.
// The header also says how the depth is kept (reversed or logarithmic: with the second, nothing hidden is skipped), the
// script's own time a frame (the CPU's share) and the draw calls and triangles of a frame.

import { BUILD } from './build.js';
import { MAX_PIXELS } from './preset.js';   // (the ceiling on the 'every pixel the screen has' row)

export function attachBench(pc) {
  const el = document.createElement('pre');
  el.id = 'pc-bench';
  // (2026-11-18, the owner: "Make the bench mark a copy and paste getting too big to screenshot". Twenty-six rows no
  //  longer fit on a phone's screen, and the panel could not even be SELECTED - it was laid over the game with
  //  pointer-events off so it would not eat touches. It takes touches now, its text can be selected, it scrolls when
  //  it is taller than the screen, and the button below puts the whole table on the clipboard in one press.)
  el.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;margin:0;padding:6px 10px 76px;z-index:99999;background:rgba(18,20,34,.94);color:#fff;' +
    'font:10.5px/1.3 ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap;overflow:auto;-webkit-overflow-scrolling:touch;' +
    'pointer-events:auto;user-select:text;-webkit-user-select:text;touch-action:pan-y';
  document.body.appendChild(el);
  // THE COPY BUTTON. Big enough for a thumb (a phone wants 44 px and this is 52), out of the way of the text, and it
  // says what happened: a clipboard can be refused (an insecure page, a browser that will not), and then it selects
  // the table instead so the owner can copy it by hand rather than being left with a button that did nothing.
  const copyBtn = document.createElement('button');
  copyBtn.id = 'pc-bench-copy';
  copyBtn.textContent = 'Copy the table';
  copyBtn.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:12px;z-index:100000;min-height:52px;padding:0 26px;' +
    'font:600 16px/1 system-ui,sans-serif;color:#fff;background:#2d6cdf;border:0;border-radius:26px;box-shadow:0 2px 10px rgba(0,0,0,.45);' +
    'pointer-events:auto;touch-action:manipulation;cursor:pointer';
  const selectTable = () => {
    try { const r = document.createRange(); r.selectNodeContents(el); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); return true; } catch { return false; }
  };
  copyBtn.addEventListener('click', async () => {
    const text = el.textContent || '';
    let ok = false;
    try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); ok = true; } } catch { ok = false; }
    if (!ok) {
      // the old way, which still works where the clipboard is refused
      try {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px;top:0';
        document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); document.body.removeChild(ta);
      } catch { ok = false; }
    }
    if (!ok) ok = selectTable() ? null : false;      // null: not copied, but the table is selected to copy by hand
    copyBtn.textContent = ok === true ? 'Copied - paste it to Claude' : ok === null ? 'Selected - now copy it' : 'Could not copy: select it by hand';
    copyBtn.style.background = ok === true ? '#1f8a4c' : '#b4521f';
    setTimeout(() => { copyBtn.textContent = 'Copy the table'; copyBtn.style.background = '#2d6cdf'; }, 4000);
  });
  document.body.appendChild(copyBtn);
  const P = pc.painter, R = pc.renderer;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const mats = (re) => { const s = new Set(); pc.scene.traverse((o) => { const m = o.material; if (m && m.name && re.test(m.name)) s.add(m); }); return s; };
  const show = (re, on) => { for (const m of mats(re)) m.visible = on; };
  // the script's own time and the frame's draw calls, taken round the game's frame while a row is measured
  const acc = { ms: 0, n: 0, calls: 0, tris: 0 };
  const frame0 = pc.game.frame.bind(pc.game);
  // (the renderer's own count starts afresh at each of a frame's passes: every pass is added up here)
  const render0 = R.render.bind(R);
  R.render = (sc, cam) => { render0(sc, cam); acc.calls += R.info.render.calls; acc.tris += R.info.render.triangles; };
  // THE GAME IS HELD STILL while the test runs (2026-11-17: two tables could not be read because the explorer drifted
  // down a river and walked on while the rows were timed, so every row saw a different picture). The frame is drawn as
  // always, and then the explorer, the view and the clock are put back where they were: nothing moves, nothing new is
  // built, the weather does not turn. `pin` is set once the first view has settled.
  let pin = null;
  const takePin = () => {
    const S = pc.sim;
    if (!S || !S.ex || !S.footCam) return null;
    return { t: S.t, p: { ...S.ex.p }, v: { ...S.ex.v }, fwd: { ...S.ex.fwd }, view: { ...S.footCam.viewFwd }, pitch: S.footCam.pitch, boom: S.footCam.boom };
  };
  const putBack = () => {
    const S = pc.sim, k = pin;
    if (!k || !S || !S.ex) return;
    S.t = k.t;
    S.ex.p = { ...k.p }; S.ex.v = { ...k.v }; S.ex.fwd = { ...k.fwd };
    S.footCam.viewFwd = { ...k.view }; S.footCam.pitch = k.pitch; S.footCam.boom = k.boom;
  };
  pc.game.frame = (dt) => {
    const t = performance.now();
    try { return frame0(dt); } finally { acc.ms += performance.now() - t; acc.n++; if (pin) putBack(); }
  };
  // One row's frames: the time between every two pictures over `ms`, by the browser's own frame clock.
  const sample = (ms) => new Promise((resolve) => {
    const dts = []; let t0 = 0, last = 0;
    acc.ms = acc.n = acc.calls = acc.tris = 0;
    const f = (t) => {
      if (!t0) { t0 = t; last = t; } else { dts.push(t - last); last = t; }
      if (t - t0 >= ms) resolve(dts); else requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });
  // (the mean, the middle one and the longest. This phone's frames come in steps of its screen's beat, 8.3 ms: the mean
  // tells two rows apart that the middle one cannot, and the middle one is not moved by one long frame)
  const stats = (dts) => {
    const s = dts.slice().sort((a, b) => a - b), n = s.length || 1;
    let sum = 0; for (const d of dts) sum += d;
    return { n: dts.length, mean: sum / n, mid: s[n >> 1] || 0, worst: s[n - 1] || 0, script: acc.n ? acc.ms / acc.n : 0, calls: acc.n ? acc.calls / acc.n : 0, tris: acc.n ? acc.tris / acc.n : 0 };
  };
  // After a switch the picture is given time to settle before it is timed: shaders are built again when the shadows
  // or the light in the air are switched (the fourth form timed those rows while they were being built: both read
  // slower than "as set"), and patches are laid again when the far trees are swapped. Calm: half a second in which no
  // frame is much longer than the middle one; eight seconds at most.
  // (2026-11-19, from the owner's own table at v22: FOUR ROWS WERE TIMED WHILE NOTHING WAS BEING DRAWN -- "script
  //  0.0 ms, 0 calls, 0k triangles" -- and none of them was marked NOT SETTLED, because this test only ever asked
  //  whether the frames were STEADY, and a scene that draws nothing is the steadiest thing there is. Those rows
  //  read 16.7 ms, the screen's own cap, and every row measured against them was nonsense: "far trees drawn first"
  //  came out 16.9 ms FASTER than the game and "far trees cast no shadow" 15.9 ms slower. A row that draws nothing
  //  is not a fast row, it is not a row at all.)
  const DRAWS = 20;            // draw calls below which the picture is not really being drawn
  const calm = async () => {
    await wait(400);
    const t0 = performance.now();
    for (;;) {
      const st = stats(await sample(500));
      if (st.n >= 4 && st.calls >= DRAWS && st.worst < Math.max(1.9 * st.mid, st.mid + 18)) return true;
      // A WOOD TAKES LONGER TO BUILD THAN A ROW TAKES TO SETTLE. Eight seconds is plenty for the picture to steady
      // after a switch, but not for the trees to exist at all at the start of a run -- and that is how four rows
      // came to be timed against an empty frame. While nothing is being drawn, wait far longer.
      const limit = st.calls >= DRAWS ? 8000 : 40000;
      if (performance.now() - t0 > limit) return false;
    }
  };
  let sunOut = null;      // whether the shadow map was drawn while the first row was measured
  // SEEING PAST THE DISPLAY'S CAP (the owner's table of 2026-11-19, v26). Their phone holds 60 a second with room
  // to spare, so every row of that table read "-0.0 ms" -- no far trees, no trees at all, no shadows, no plants,
  // the full paint, all the same 16.7 ms, because a display that waits for its refresh cannot show anything
  // faster and the test was asking questions it could not hear the answers to. A test that cannot tell two things
  // apart is worse than no test: it was read for three versions as "nothing costs anything".
  // So: before the rows, the test finds out whether this device is held at its refresh, and if it is, it draws the
  // picture sharper until the frame is clearly off the cap and asks every question THERE. The costs are then of a
  // bigger picture than the device draws -- the header says so plainly -- but they are real costs, and the order
  // and the size of them is what the questions are for.
  let MK = 1;             // how much sharper each way the questions are asked (1: not capped, asked as drawn)
  let capMs = 0;          // the frame interval the device is held at, if it is held at one
  const head = (r0) => {
    let gpu = '?';
    try { const gl = R.getContext(), e = gl.getExtension('WEBGL_debug_renderer_info'); if (e) gpu = String(gl.getParameter(e.UNMASKED_RENDERER_WEBGL)); } catch { /* not told */ }
    const i = P.info || {}, c = R.domElement;
    const sun = sunOut == null ? '' : sunOut ? 'sun out (shadows drawn)' : 'sun not out (no shadows drawn)';
    return 'PAINTED COSMOS SPEED TEST 9, ' + BUILD + ': press Copy the table at the bottom, then paste it\n' +
      gpu.slice(0, 64) + ' | depth ' + (i.depth || '?') + ' | ' + sun + '\n' +
      'picture ' + (i.internalWidth || c.width) + 'x' + (i.internalHeight || c.height) + ' | screen ' + window.innerWidth + 'x' + window.innerHeight + ' @' + (window.devicePixelRatio || 1).toFixed(2) + (pin ? ' | held still' : ' | NOT HELD') +
      ' | tier ' + i.quality + ' | edges ' + (P.aaMode ? P.aaMode() : '?') + ' | paint ' + (P.lite ? 'lighter' : 'full') +
      (r0 ? ' | script ' + r0.script.toFixed(1) + ' ms, ' + Math.round(r0.calls) + ' calls, ' + Math.round(r0.tris / 1000) + 'k triangles a frame' : '') +
      (MK > 1 ? '\nTHE QUESTIONS BELOW WERE ASKED WITH THE PICTURE ' + MK.toFixed(2) + ' TIMES AS SHARP EACH WAY, because at the\n'
        + 'size this device draws it is held at ' + (1000 / Math.max(capMs, 1e-3)).toFixed(0) + ' a second and NOTHING could be told apart: every row read -0.0 ms.\n'
        + 'So the + / - below are real costs, but of a picture ' + (MK * MK).toFixed(1) + ' times the one it draws. Rows 24 on are back at that size.' : '');
  };
  const run = async () => {
    el.textContent = 'speed test: waiting for the first view...';
    // (MK and capMs are filled by the probe below, before the rows; head() reads them.)
    while (!window.__pcReady) await wait(250);
    if (pc.settle) await Promise.race([pc.settle(12), wait(20000)]);
    await wait(2500);
    pin = takePin();                 // from here the game is held still (above)
    if (pc.settle) await Promise.race([pc.settle(12), wait(20000)]);
    const hasB = typeof P._bench === 'function', lite0 = !!P.lite;
    const B = (o) => hasB && P._bench(o);
    const farMeshes = (fn) => pc.scene.traverse((o) => { if (o.isMesh && o.material && /^pc-prop-far/.test(o.material.name || '')) fn(o); });
    const treeMeshes = (fn) => pc.scene.traverse((o) => { if (o.isMesh && o.material && /^pc-prop-(tall|far)/.test(o.material.name || '')) fn(o); });
    const flora = () => (pc.world && pc.world._flora) || null;
    // (the flora lane, 2026-11-24, docs/lead/FLORA-DESIGN.md 4.4) THE NEAR GRASS: the rings of painted marks round the eye
    // (world/nearground.js), one material each, all named pc-near. They are in no other row: 'no small plants' takes the
    // PROP undergrowth only, and the plants' flat modes do not reach the near grass's shader.
    const nearRings = (fn) => { const n = pc.world && pc.world._near; if (n && n.rings) for (const r of n.rings) fn(r); };
    // (the far trees' form swapped while the test runs, world/flora.js setFarCards: the two forms are then timed in the
    // same minute, on a phone as warm for the one as for the other)
    const cards0 = !!(flora() && flora().species && flora().species.some((sp) => sp.cardFar));
    const swapFar = async (on) => {
      const f = flora();
      if (!f || !f.setFarCards || f.setFarCards(on) == null) return;
      await wait(400);
      if (pc.settle) await Promise.race([pc.settle(12), wait(20000)]);
    };
    // (the eighth form) The picture drawn larger and shown in the same place on the screen: `k` times as many pixels
    // each way, so k x k times as many in all. This is what ?dpr= does for a whole run; here it is one row, so that the
    // sharper picture and the one the phone is given today are timed in the same minute on an equally warm phone.
    const canvas0 = { w: R.domElement.width, h: R.domElement.height };
    // How much sharper the picture would be if every pixel of the screen were drawn (the owner's question of
    // 2026-11-18: "Can the game draw for 3086 x 1440 pixels??"). The picture is canvas0.w pixels across a box of
    // clientWidth points, so it is drawn at canvas0.w / clientWidth pixels to the point today, and the screen has
    // devicePixelRatio of them. Held at 4 and at what preset.js allows, so a screen nobody has met cannot ask for
    // a picture no phone could hold.
    const kWhole = (() => {
      const css = R.domElement.clientWidth || canvas0.w, dev = window.devicePixelRatio || 1;
      const k = Math.max(1, Math.min(4, (dev * css) / Math.max(1, canvas0.w)));
      const px = canvas0.w * canvas0.h * k * k;
      return px > MAX_PIXELS ? Math.sqrt(MAX_PIXELS / Math.max(1, canvas0.w * canvas0.h)) : k;
    })();
    const sharpen = async (k) => {
      if (typeof P.resize !== 'function') return;
      const w = Math.max(2, Math.round(canvas0.w * k)), h = Math.max(2, Math.round(canvas0.h * k));
      // HELD, so that a resize the phone fires for its own reasons cannot put the picture back without the test
      // knowing. In the owner's v27 table the last eight rows were measured at a size the test did not know it was
      // at: they all read 16.7 ms -- the display's own floor -- whatever was asked of them, and one of them said
      // that the FULL paint was four milliseconds faster than the lighter one, which cannot be true.
      if (typeof pc.game === 'object' && pc.game && typeof pc.game.holdPictureSize === 'function') pc.game.holdPictureSize(w, h);
      else P.resize(w, h);
      await wait(400);
      if (pc.settle) await Promise.race([pc.settle(12), wait(20000)]);
    };
    const AS = 'as set';
    // ---- IS THIS DEVICE HELD AT ITS REFRESH? (see MK at the top of this file) ----------------------------------
    // Two questions, because one is not enough: a device that is really drawing shows a spread in its frame times
    // AND goes faster when it is given fewer pixels. One held at its refresh does neither, and nor does one whose
    // frame is all script. Either way the questions below must be asked somewhere the answers can be heard.
    {
      await calm();
      const a = stats(await sample(1400));
      capMs = a.mean;
      await sharpen(0.7);                          // half the pixels (0.7 of them each way)
      const b = stats(await sample(1200));
      await sharpen(1);
      const freed = (a.mean - b.mean) / Math.max(a.mean, 1e-3);
      // (a sample that caught almost no frames says nothing at all -- a machine drawing in software takes tens of
      //  seconds a frame -- and must not be read as "held at its refresh" and then asked to draw nine times the
      //  pixels. So: four frames in each sample, and a frame time that is a frame time.)
      if (a.n >= 4 && b.n >= 4 && capMs > 1 && capMs < 60 && freed < 0.07) {
        for (const k of [1.5, 2, 2.5, 3]) {
          if (k > kWhole + 1e-6) break;
          await sharpen(k);
          MK = k;
          const c = stats(await sample(1200));
          if (c.mean > capMs * 1.3) break;         // clearly off the line: ask everything here
        }
        if (MK <= 1) await sharpen(1);
      }
    }
    const steps = [
      [AS, null, null],
      // the far trees: their paint, their shapes, which pass, which place in the order of drawing, which form
      ['far trees one flat colour', () => B({ flat: 3 }), () => B({ flat: 0 })],
      ['no far trees', () => show(/^pc-prop-far/, false), () => show(/^pc-prop-far/, true)],
      ['far trees cast no shadow', () => farMeshes((o) => o.layers.disable(2)), () => farMeshes((o) => o.layers.enable(2))],
      ['far trees only as shadows', () => farMeshes((o) => o.layers.disable(0)), () => farMeshes((o) => o.layers.enable(0))],
      [AS, null, null],
      ['far trees drawn first', () => farMeshes((o) => { o.renderOrder = -5; }), () => farMeshes((o) => { o.renderOrder = 0; })],
      ['far trees drawn last', () => farMeshes((o) => { o.renderOrder = 9; }), () => farMeshes((o) => { o.renderOrder = 0; })],
      [cards0 ? 'far trees as lumps' : 'far trees of flat pieces', () => swapFar(!cards0), () => swapFar(cards0)],
      [AS, null, null],
      // the other plants
      ['plants one flat colour', () => B({ flat: 2 }), () => B({ flat: 0 })],
      // (NINTH FORM, 2026-11-18, after the owner's first table that measured anything: the plants' PAINT alone was
      //  11.7 ms of a 32.9 ms frame, the single biggest thing in it, and no row said where in the paint it went.
      //  These three cut the plant's own program at three places, each keeping every leaf and every branch where it
      //  is. Read as gaps: "written at once" against "one flat colour" is what the footprint, the noise read and the
      //  discards that break a crown up cost; "one flat colour" against "as set" is the paint proper; "a leaf's own
      //  colour" tells a leaf's paint from the crowns' strokes and the bark's; "no air on the plants" asks what the
      //  distance haze costs on every plant pixel.)
      ['plants written at once', () => B({ flat: 4 }), () => B({ flat: 0 })],
      ['a leaf in its own colour', () => B({ flat: 5 }), () => B({ flat: 0 })],
      ['no air laid on the plants', () => B({ flat: 6 }), () => B({ flat: 0 })],
      ['no near trees', () => show(/^pc-prop-tall/, false), () => show(/^pc-prop-tall/, true)],
      // (2026-11-23, after speed test 9: the near trees are 62.7 ms of a 101 ms frame and NOTHING in that table says
      //  why. These three rows split it. "hand over at half the distance" is not a diagnostic -- it IS the change
      //  that would be made, so the device measures the fix and not a guess. "half their leaves" drives the leaf
      //  thinning that is already built (flora.js uLeafLod); "no near leaves" leaves the trunks and branches alone,
      //  so the gap between it and "no near trees" is what the WOOD of a tree costs against its FOLIAGE.)
      ['near trees hand over at half the distance', () => { const f = flora(); if (f) { f.benchTreeK = 0.5; f.lastScale = -1; } },
        () => { const f = flora(); if (f) { f.benchTreeK = null; f.lastScale = -1; } }],
      ['near trees at a third of the distance', () => { const f = flora(); if (f) { f.benchTreeK = 0.33; f.lastScale = -1; } },
        () => { const f = flora(); if (f) { f.benchTreeK = null; f.lastScale = -1; } }],
      ['no trees', () => show(/^pc-prop-(tall|far)/, false), () => show(/^pc-prop-(tall|far)/, true)],
      ['no small plants', () => show(/^pc-prop-(?!tall|far)/, false), () => show(/^pc-prop-(?!tall|far)/, true)],
      // (the flora lane) what the near grass costs, all of it and its finest ring alone. Its material's own `visible` is
      // the switch: the ring's update moves its mesh, never this.
      ['no near grass', () => nearRings((r) => { r.material.visible = false; }), () => nearRings((r) => { r.material.visible = true; })],
      ['near grass: the blades only (the fine ring and the carpet)', () => nearRings((r) => { r.material.visible = r.cfg.name === 'fine' || !!r.cfg.carpet; }),
        () => nearRings((r) => { r.material.visible = true; })],
      // (G2, FLORA-DESIGN.md 6.2) the carpet of blades near the feet, which four times the near blades are bought with
      ['no carpet of near blades', () => nearRings((r) => { if (r.cfg.carpet) r.material.visible = false; }), () => nearRings((r) => { r.material.visible = true; })],
      // (G1, FLORA-DESIGN.md 6.1) the marks outside the picture shaded whole again, as before the cull: what the cull saves
      ['grass not culled off-screen', () => nearRings((r) => { r.__k = r.material.uniforms.uNearK.value.x; r.material.uniforms.uNearK.value.x = 0; }),
        () => nearRings((r) => { r.material.uniforms.uNearK.value.x = r.__k == null ? 1 : r.__k; })],
      // (2026-11-20) WHERE THE DRAW CALLS ARE. The table's header says 350 of them and 9.6 ms of script, and a draw
      // call costs a phone's processor something like twenty millionths of a second, so the two numbers are most
      // likely the same number. Counted in the painter's gallery on one frame of the autumn wood: 245 draws, of
      // which THE GROUND IS 61 AND THE WATER 39 -- a hundred of them, more than all the plants and trees together.
      // These two rows say what each is worth on a real device.
      ['no water drawn', () => show(/^pc-water/, false), () => show(/^pc-water/, true)],
      ['no ground drawn', () => show(/^pc-terrain/, false), () => show(/^pc-terrain/, true)],
      [AS, null, null],
      // the light and the paint (each settles first: its shaders are built again)
      ['no shadows at all', () => B({ shadow: false }), () => B({ shadow: true })],
      ['shadows drawn half as fine', () => B({ shadowSize: 1024 }), () => B({ shadowSize: 0 })],
      ['trees cast no shadow', () => treeMeshes((o) => o.layers.disable(2)), () => treeMeshes((o) => o.layers.enable(2))],
      ['no light in the air', () => B({ shaft: false }), () => B({ shaft: true })],
      [lite0 ? 'the full paint' : 'the lighter paint', () => B({ lite: !lite0 }), () => B({ lite: lite0 })],
      // (back to the size the device really draws, so the four rows below are measured from IT and not from
      //  whatever sharper size the questions above had to be asked at: see MK at the top of this file)
      [AS, () => sharpen(1), null],
      // (EIGHTH FORM, 2026-11-18) ROWS THAT MAKE THE GAME WORK HARDER, not easier. The owner's first believable table
      // read 16.7 ms = 60.0 a second on eleven rows running: that is the phone's own screen refusing to go faster, not
      // the game's speed, and under such a cap no row can be told from another. These rows raise the picture's
      // sharpness until the cap breaks, and what they then read is the game's real speed. They are last because they
      // are the dearest and a phone is warmest at the end.
      ['the picture half again as sharp', () => sharpen(1.5), () => sharpen(1)],
      ['the picture twice as sharp', () => sharpen(2), () => sharpen(1)],
      ['every pixel the screen has', () => sharpen(kWhole), () => sharpen(1)],
      ['every pixel, full paint', async () => { await sharpen(kWhole); B({ lite: !lite0 }); }, async () => { B({ lite: lite0 }); await sharpen(1); }],
      [AS + ', last', null, null],
    ];
    const rows = [];
    let r0 = null, base = null;
    const bases = [];      // (2026-11-19) every "as set" row, so the table can say when it disagrees with itself
    for (let k = 0; k < steps.length; k++) {
      const [name, on, off] = steps[k];
      el.textContent = head(r0) + '\n' + rows.join('\n') + '\n... ' + (k + 1) + ' of ' + steps.length + ': ' + name;
      if (on) await on();
      const ok = await calm();
      const f0 = P._shadow ? P._shadow.frames : -1;
      const r = stats(await sample(2400));
      r.fps = 1000 / Math.max(r.mean, 1e-3);
      if (k === 0 && P._shadow) sunOut = P._shadow.frames > f0;
      if (off) { await off(); if (name.startsWith('far trees as') || name.startsWith('far trees of')) await calm(); }
      // (2026-11-19) The header quotes the first row THAT WAS REALLY DRAWING. It used to quote the first row
      // whatever it was, and at v22 that row drew nothing, so the header described the whole game as "script
      // 0.0 ms, 0 calls, 0k triangles a frame".
      if (!r0 && r.calls >= DRAWS) r0 = r;
      const isBase = name.startsWith(AS);
      // (each question is set against the "as set" row before it: the phone warms through the run)
      const d = base && !isBase ? r.mean - base.mean : null;
      rows.push(String(k + 1).padStart(2) + ' ' + (name + ' ').padEnd(27, '.') + ' ' + r.mean.toFixed(1).padStart(5) + ' ms = ' + r.fps.toFixed(1).padStart(5) + ' a second' +
        (d == null ? '          ' : '  ' + ((d >= 0 ? '+' : '') + d.toFixed(1)).padStart(6) + ' ms') + '  (middle ' + r.mid.toFixed(0) + ', longest ' + r.worst.toFixed(0) + ', script ' + r.script.toFixed(1) + (r.calls < DRAWS ? ', NOTHING DRAWN' : ok ? '' : ', NOT SETTLED') + ')');
      if (isBase) { base = r; bases.push(r.mean); }
    }
    // DO THE BASELINES AGREE? Every + / - in this table is measured against the "as set" row before it, so if those
    // rows disagree with each other the whole table is noise however steady each row looked on its own. At v22 they
    // ran 16.7, 33.6, 31.6, 31.6, 33.5 and 50.3 ms, and the table was read as a threefold speed-up that was not
    // there. It says so itself now.
    let warn = '';
    if (bases.length >= 2) {
      const lo = Math.min(...bases), hi = Math.max(...bases);
      if (hi > lo * 1.25) warn = '\nTHIS RUN DOES NOT AGREE WITH ITSELF: the "as set" rows ran '
        + bases.map((b) => b.toFixed(1)).join(', ') + ' ms. Every + / - below is measured against one of those, so'
        + ' they cannot be trusted. Run it again without touching the phone, and wait for the wood to finish'
        + ' building before you start.';
    }
    // the picture is the phone's own again (it was held through the run: see sharpen above)
    if (pc.game && typeof pc.game.holdPictureSize === 'function') pc.game.holdPictureSize(0, 0);
    el.textContent = head(r0) + '\n' + rows.join('\n') + '\ndone. (+ / - ms: against the "as set" row before it)' + warn;
    pc.bench = rows;
  };
  run().catch((e) => { el.textContent = 'speed test failed: ' + ((e && e.message) || e); });
}
