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
// The header also says how the depth is kept (reversed or logarithmic: with the second, nothing hidden is skipped), the
// script's own time a frame (the CPU's share) and the draw calls and triangles of a frame.

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
  pc.game.frame = (dt) => {
    const auto = R.info.autoReset; R.info.autoReset = false; R.info.reset();
    const t = performance.now();
    try { return frame0(dt); } finally { acc.ms += performance.now() - t; acc.n++; acc.calls += R.info.render.calls; acc.tris += R.info.render.triangles; R.info.autoReset = auto; }
  };
  // the pictures a second over `ms`, by the browser's own frame clock, and the longest wait between two
  const measure = (ms) => new Promise((resolve) => {
    let n = 0, t0 = 0, last = 0, worst = 0;
    acc.ms = acc.n = acc.calls = acc.tris = 0;
    const f = (t) => {
      if (!t0) { t0 = t; last = t; } else { n++; worst = Math.max(worst, t - last); last = t; }
      if (t - t0 >= ms) resolve({ fps: (n * 1000) / (t - t0), worst, script: acc.n ? acc.ms / acc.n : 0, calls: acc.n ? acc.calls / acc.n : 0, tris: acc.n ? acc.tris / acc.n : 0 });
      else requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });
  let sunOut = null;      // whether the shadow map was drawn while the first row was measured
  const head = (r0) => {
    let gpu = '?';
    try { const gl = R.getContext(), e = gl.getExtension('WEBGL_debug_renderer_info'); if (e) gpu = String(gl.getParameter(e.UNMASKED_RENDERER_WEBGL)); } catch { /* not told */ }
    const i = P.info || {}, c = R.domElement;
    const sun = sunOut == null ? '' : sunOut ? 'sun out (shadows drawn)' : 'sun not out (no shadows drawn)';
    return 'PAINTED COSMOS SPEED TEST 2: photograph this screen and send it\n' +
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
    const tier0 = (P.info && P.info.quality) | 0, hasB = typeof P._bench === 'function', lite0 = !!P.lite;
    const B = (o) => hasB && P._bench(o);
    const steps = [
      ['as set', null, null, 1200],
      [lite0 ? 'the full paint' : 'the lighter paint', () => B({ lite: !lite0 }), () => B({ lite: lite0 }), 1200],
      ['ground one flat colour', () => B({ flat: 1 }), () => B({ flat: 0 }), 1000],
      ['plants one flat colour', () => B({ flat: 2 }), () => B({ flat: 0 }), 1000],
      ['no trees', () => show(/^pc-prop-(tall|far)/, false), () => show(/^pc-prop-(tall|far)/, true), 1000],
      ['no small plants', () => show(/^pc-prop-(?!tall|far)/, false), () => show(/^pc-prop-(?!tall|far)/, true), 1000],
      ['no near grass', () => show(/^pc-near/, false), () => show(/^pc-near/, true), 1000],
      ['no ground', () => show(/^pc-terrain/, false), () => show(/^pc-terrain/, true), 1000],
      ['no water', () => show(/^pc-water/, false), () => show(/^pc-water/, true), 1000],
      ['no light in the air', () => B({ shaft: false }), () => B({ shaft: true }), 1000],
      ['no shadows at all', () => B({ shadow: false }), () => B({ shadow: true }), 1000],
      ['picture at half size', () => P.setRenderScale && P.setRenderScale(0.5), () => P.setRenderScale && P.setRenderScale(1), 1500],
      ['low tier', () => P.setQuality(0), () => P.setQuality(tier0), 3500],
    ];
    const rows = [];
    let r0 = null;
    for (let k = 0; k < steps.length; k++) {
      const [name, on, off, settle] = steps[k];
      el.textContent = head(r0) + '\n' + rows.join('\n') + '\n... ' + (k + 1) + ' of ' + steps.length + ': ' + name;
      if (on) on();
      await wait(settle);
      const f0 = P._shadow ? P._shadow.frames : -1;
      const r = await measure(2600);
      if (k === 0 && P._shadow) sunOut = P._shadow.frames > f0;
      if (off) off();
      if (!r0) r0 = r;
      rows.push(String(k + 1).padStart(2) + ' ' + (name + ' ').padEnd(24, '.') + ' ' + r.fps.toFixed(1).padStart(5) + ' a second = ' + String(Math.round(1000 / Math.max(r.fps, 1e-3))).padStart(3) + ' ms  (longest ' + Math.round(r.worst) + ', script ' + r.script.toFixed(1) + ')');
    }
    el.textContent = head(r0) + '\n' + rows.join('\n') + '\ndone.';
    pc.bench = rows;
  };
  run().catch((e) => { el.textContent = 'speed test failed: ' + ((e && e.message) || e); });
}
