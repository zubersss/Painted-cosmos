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
// SIXTH FORM (2026-11-17): two more rows about the shadow pass, which is a third of a frame's triangles at a phone's
// size (the trees drawn again from the sun, into a square 2048 wide): the square half as wide, and the trees out of it.
// The header also says how the depth is kept (reversed or logarithmic: with the second, nothing hidden is skipped), the
// script's own time a frame (the CPU's share) and the draw calls and triangles of a frame.

import { BUILD } from './build.js';

export function attachBench(pc) {
  const el = document.createElement('pre');
  el.id = 'pc-bench';
  el.style.cssText = 'position:fixed;left:0;top:0;right:0;margin:0;padding:6px 10px;z-index:99999;background:rgba(18,20,34,.94);color:#fff;' +
    'font:10.5px/1.3 ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap;pointer-events:none';
  document.body.appendChild(el);
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
  pc.game.frame = (dt) => {
    const t = performance.now();
    try { return frame0(dt); } finally { acc.ms += performance.now() - t; acc.n++; }
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
  const calm = async () => {
    await wait(400);
    const t0 = performance.now();
    for (;;) {
      const st = stats(await sample(500));
      if (st.n >= 4 && st.worst < Math.max(1.9 * st.mid, st.mid + 18)) return true;
      if (performance.now() - t0 > 8000) return false;
    }
  };
  let sunOut = null;      // whether the shadow map was drawn while the first row was measured
  const head = (r0) => {
    let gpu = '?';
    try { const gl = R.getContext(), e = gl.getExtension('WEBGL_debug_renderer_info'); if (e) gpu = String(gl.getParameter(e.UNMASKED_RENDERER_WEBGL)); } catch { /* not told */ }
    const i = P.info || {}, c = R.domElement;
    const sun = sunOut == null ? '' : sunOut ? 'sun out (shadows drawn)' : 'sun not out (no shadows drawn)';
    return 'PAINTED COSMOS SPEED TEST 6, ' + BUILD + ': photograph this screen and send it\n' +
      gpu.slice(0, 64) + ' | depth ' + (i.depth || '?') + ' | ' + sun + '\n' +
      'picture ' + (i.internalWidth || c.width) + 'x' + (i.internalHeight || c.height) + ' | screen ' + window.innerWidth + 'x' + window.innerHeight + ' @' + (window.devicePixelRatio || 1).toFixed(2) +
      ' | tier ' + i.quality + ' | edges ' + (P.aaMode ? P.aaMode() : '?') + ' | paint ' + (P.lite ? 'lighter' : 'full') +
      (r0 ? ' | script ' + r0.script.toFixed(1) + ' ms, ' + Math.round(r0.calls) + ' calls, ' + Math.round(r0.tris / 1000) + 'k triangles a frame' : '');
  };
  const run = async () => {
    el.textContent = 'speed test: waiting for the first view...';
    while (!window.__pcReady) await wait(250);
    if (pc.settle) await Promise.race([pc.settle(12), wait(20000)]);
    await wait(2500);
    const hasB = typeof P._bench === 'function', lite0 = !!P.lite;
    const B = (o) => hasB && P._bench(o);
    const farMeshes = (fn) => pc.scene.traverse((o) => { if (o.isMesh && o.material && /^pc-prop-far/.test(o.material.name || '')) fn(o); });
    const treeMeshes = (fn) => pc.scene.traverse((o) => { if (o.isMesh && o.material && /^pc-prop-(tall|far)/.test(o.material.name || '')) fn(o); });
    const flora = () => (pc.world && pc.world._flora) || null;
    // (the far trees' form swapped while the test runs, world/flora.js setFarCards: the two forms are then timed in the
    // same minute, on a phone as warm for the one as for the other)
    const cards0 = !!(flora() && flora().species && flora().species.some((sp) => sp.cardFar));
    const swapFar = async (on) => {
      const f = flora();
      if (!f || !f.setFarCards || f.setFarCards(on) == null) return;
      await wait(400);
      if (pc.settle) await Promise.race([pc.settle(12), wait(20000)]);
    };
    const AS = 'as set';
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
      ['no near trees', () => show(/^pc-prop-tall/, false), () => show(/^pc-prop-tall/, true)],
      ['no trees', () => show(/^pc-prop-(tall|far)/, false), () => show(/^pc-prop-(tall|far)/, true)],
      ['no small plants', () => show(/^pc-prop-(?!tall|far)/, false), () => show(/^pc-prop-(?!tall|far)/, true)],
      [AS, null, null],
      // the light and the paint (each settles first: its shaders are built again)
      ['no shadows at all', () => B({ shadow: false }), () => B({ shadow: true })],
      ['shadows drawn half as fine', () => B({ shadowSize: 1024 }), () => B({ shadowSize: 0 })],
      ['trees cast no shadow', () => treeMeshes((o) => o.layers.disable(2)), () => treeMeshes((o) => o.layers.enable(2))],
      ['no light in the air', () => B({ shaft: false }), () => B({ shaft: true })],
      [lite0 ? 'the full paint' : 'the lighter paint', () => B({ lite: !lite0 }), () => B({ lite: lite0 })],
      [AS + ', last', null, null],
    ];
    const rows = [];
    let r0 = null, base = null;
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
      if (!r0) r0 = r;
      const isBase = name.startsWith(AS);
      // (each question is set against the "as set" row before it: the phone warms through the run)
      const d = base && !isBase ? r.mean - base.mean : null;
      rows.push(String(k + 1).padStart(2) + ' ' + (name + ' ').padEnd(27, '.') + ' ' + r.mean.toFixed(1).padStart(5) + ' ms = ' + r.fps.toFixed(1).padStart(5) + ' a second' +
        (d == null ? '          ' : '  ' + ((d >= 0 ? '+' : '') + d.toFixed(1)).padStart(6) + ' ms') + '  (middle ' + r.mid.toFixed(0) + ', longest ' + r.worst.toFixed(0) + ', script ' + r.script.toFixed(1) + (ok ? '' : ', NOT SETTLED') + ')');
      if (isBase) base = r;
    }
    el.textContent = head(r0) + '\n' + rows.join('\n') + '\ndone. (+ / - ms: against the "as set" row before it)';
    pc.bench = rows;
  };
  run().catch((e) => { el.textContent = 'speed test failed: ' + ((e && e.message) || e); });
}
