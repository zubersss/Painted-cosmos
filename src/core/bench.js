// Painted Cosmos: a speed test for a real device. OWNER: PILOT.
//
// `?bench=1` (with whatever else the address says: look=oil, quality, preset, body, time). A cloud session has no
// graphics card: how fast the game draws on the owner's own phone or desktop cannot be measured there, only guessed
// from software drawing. This asks the device itself. Once the first view is whole it stands still and draws the same
// view ten ways, a few seconds each (as set; then without the light in the air, the shadows, the plants, the near
// grass, the water, the ground; then the picture at half size; then the middle and the low tier), counts the pictures
// a second of each, and leaves the table on the screen to be photographed and sent. Nothing is saved or sent anywhere.
// The resolution controller is off while it runs (main.js), so every row is drawn at the settings it names.

export function attachBench(pc) {
  const el = document.createElement('pre');
  el.id = 'pc-bench';
  el.style.cssText = 'position:fixed;left:0;top:0;right:0;margin:0;padding:8px 12px;z-index:99999;background:rgba(18,20,34,.93);color:#fff;' +
    'font:12px/1.38 ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap;pointer-events:none';
  document.body.appendChild(el);
  const P = pc.painter;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const mats = (re) => { const s = new Set(); pc.scene.traverse((o) => { const m = o.material; if (m && m.name && re.test(m.name)) s.add(m); }); return s; };
  const show = (re, on) => { for (const m of mats(re)) m.visible = on; };
  // the pictures a second over `ms`, by the browser's own frame clock, and the longest wait between two
  const measure = (ms) => new Promise((resolve) => {
    let n = 0, t0 = 0, last = 0, worst = 0;
    const f = (t) => {
      if (!t0) { t0 = t; last = t; } else { n++; worst = Math.max(worst, t - last); last = t; }
      if (t - t0 >= ms) resolve({ fps: (n * 1000) / (t - t0), worst }); else requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });
  const head = () => {
    let gpu = '?';
    try { const gl = pc.renderer.getContext(), e = gl.getExtension('WEBGL_debug_renderer_info'); if (e) gpu = String(gl.getParameter(e.UNMASKED_RENDERER_WEBGL)); } catch { /* not told */ }
    const i = P.info || {}, c = pc.renderer.domElement;
    return 'PAINTED COSMOS SPEED TEST: photograph this screen and send it\n' +
      gpu.slice(0, 70) + '\npicture ' + (i.internalWidth || c.width) + ' x ' + (i.internalHeight || c.height) + ' | screen ' + window.innerWidth + ' x ' + window.innerHeight +
      ' @' + (window.devicePixelRatio || 1).toFixed(2) + ' | tier ' + i.quality + ' | edges ' + (P.aaMode ? P.aaMode() : '?') + ' | ' + location.search.slice(1, 90);
  };
  const run = async () => {
    el.textContent = 'speed test: waiting for the first view...';
    while (!window.__pcReady) await wait(250);
    if (pc.settle) await Promise.race([pc.settle(12), wait(20000)]);
    await wait(2500);
    const tier0 = (P.info && P.info.quality) | 0, hasB = typeof P._bench === 'function';
    const steps = [
      ['as set', null, null, 1200],
      ['no light in the air', () => hasB && P._bench({ shaft: false }), () => hasB && P._bench({ shaft: true }), 1200],
      ['no shadows at all', () => hasB && P._bench({ shadow: false }), () => hasB && P._bench({ shadow: true }), 1200],
      ['no trees or plants', () => show(/^pc-prop/, false), () => show(/^pc-prop/, true), 1200],
      ['no near grass', () => show(/^pc-near/, false), () => show(/^pc-near/, true), 1200],
      ['no water', () => show(/^pc-water/, false), () => show(/^pc-water/, true), 1200],
      ['no ground', () => show(/^pc-terrain/, false), () => show(/^pc-terrain/, true), 1200],
      ['picture at half size', () => P.setRenderScale && P.setRenderScale(0.5), () => P.setRenderScale && P.setRenderScale(1), 1500],
      ['middle tier', () => P.setQuality(1), () => P.setQuality(tier0), 3500],
      ['low tier', () => P.setQuality(0), () => P.setQuality(tier0), 3500],
    ];
    const rows = [];
    for (let k = 0; k < steps.length; k++) {
      const [name, on, off, settle] = steps[k];
      el.textContent = head() + '\n' + rows.join('\n') + '\n... ' + (k + 1) + ' of ' + steps.length + ': ' + name;
      if (on) on();
      await wait(settle);
      const r = await measure(3000);
      if (off) off();
      rows.push(String(k + 1).padStart(2) + ' ' + (name + ' ').padEnd(24, '.') + ' ' + r.fps.toFixed(1).padStart(5) + ' a second  = ' + Math.round(1000 / Math.max(r.fps, 1e-3)) + ' ms each  (longest ' + Math.round(r.worst) + ' ms)');
    }
    el.textContent = head() + '\n' + rows.join('\n') + '\ndone.';
    pc.bench = rows;
  };
  run().catch((e) => { el.textContent = 'speed test failed: ' + ((e && e.message) || e); });
}
