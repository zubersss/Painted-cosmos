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

// TENTH FORM (2026-11-24, the trees lane, T0 of docs/lead/TREES-DESIGN.md on r2): THE NEAR TREES' 52 ms SPLIT, AND
// THE AIR. The v37 table says the near trees are 51.8 ms of an 89 ms frame and cannot say whether the wood, the leaves,
// the wind in the vertex shader, the two-sided drawing or the order of drawing carries it. Six rows cut it there, each
// with machinery that is already in the game (leaves only, wood only, the bark one flat colour, no wind, one-sided, drawn
// after the ground); one asks whether turning alpha-to-coverage on for every plant (it is, in the oil look, though the
// phone draws with one sample) stops the phone skipping hidden pixels; one times the far tree of two crossed cards
// (?fartree=blob) in the same minute as the tree of flat pieces, which prices a far quad's pixels against a mesh's
// triangles. And THE AIR: no row had ever timed a frame from the air. The pin is lifted 150 m (30 degrees down) and
// 400 m (45 degrees down) over the same spot and a few questions are asked there.
//   ?bench=1      the whole table (these rows included)
//   ?bench=trees  the tree questions only, on foot and in the air: shorter, so the phone is cooler for each row
//   ?bench=air    the air table (FV7 of docs/lead/FARVIEW-DESIGN.md): 400 m up and 45 degrees down, or ?bench=air,150
//                 for another height; the questions every air lane waits on.
//   ?bench=foot   the frame ON FOOT at the landing, the parts that are not the trees (the owner's 33 ms, 24 Nov): the
//                 near grass and flowers (whole, half of their marks, one flat colour: what a blade and a pixel of the
//                 sward cost, for the denser flora to come), the small plants, the ground, the shadows, the light in
//                 the air, then the trees for scale, and the water's own views last.

import { BUILD } from './build.js';
import { MAX_PIXELS } from './preset.js';   // (the ceiling on the 'every pixel the screen has' row)
import { WX2 } from '../physics/wx2.js';     // (group D's switches: its rows run only while its pieces are on)

export function attachBench(pc) {
  // which table (tenth form): '1' the whole of it, 'trees' the tree questions, 'air' or 'air,<metres>' the air table
  const MODE_B = String(new URLSearchParams(location.search).get('bench') || '1').toLowerCase();
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
  // (a tree drawn by two programs, ?trees2=, carries an ARRAY of materials, wood then leaves: both are counted)
  const mats = (re) => { const s = new Set(); pc.scene.traverse((o) => { for (const m of [].concat(o.material || [])) if (m && m.name && re.test(m.name)) s.add(m); }); return s; };
  const mname = (o) => { const m = Array.isArray(o.material) ? o.material[0] : o.material; return (m && m.name) || ''; };
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
    return { t: S.t, p: { ...S.ex.p }, v: { ...S.ex.v }, fwd: { ...S.ex.fwd }, view: { ...S.footCam.viewFwd }, pitch: S.footCam.pitch, boom: S.footCam.boom, flying: !!S.ex.flying };
  };
  const putBack = () => {
    const S = pc.sim, k = pin;
    if (!k || !S || !S.ex) return;
    S.t = k.t;
    S.ex.p = { ...k.p }; S.ex.v = { ...k.v }; S.ex.fwd = { ...k.fwd };
    S.footCam.viewFwd = { ...k.view }; S.footCam.pitch = k.pitch; S.footCam.boom = k.boom;
    // (held in the air: the wanderer hovers, hands off, where the pin is; on foot whatever it was doing)
    S.ex.flying = k.flying;
  };
  // THE AIR (tenth form). The pin on foot, kept, and the pin lifted `h` metres straight up from it with the view
  // `deg` degrees down along the same heading: the explorer hovering there, held as the walk is held. The land under
  // it, the far trees and the ground's patches are built again for the height before anything is timed.
  let foot = null;
  const lift = async (h, deg) => {
    const S = pc.sim;
    if (!foot) foot = pin;
    if (!S || !foot) return false;
    const p = foot.p, r = Math.hypot(p.x, p.y, p.z) || 1, k = (r + h) / r;
    pin = { ...foot, p: { x: p.x * k, y: p.y * k, z: p.z * k }, v: { x: 0, y: 0, z: 0 }, pitch: -deg * Math.PI / 180, flying: true };
    putBack();
    await wait(600);
    if (pc.settle) await Promise.race([pc.settle(12), wait(40000)]);
    return true;
  };
  const land = async () => {
    if (!foot) return;
    pin = foot; putBack();
    await wait(600);
    if (pc.settle) await Promise.race([pc.settle(12), wait(40000)]);
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
  // THE THREE TABLES, IN PLAIN WORDS (the coordinator, 24 Nov: the owner runs them on waking, one after another). Each
  // address is this very page with only the table changed, so whatever else the owner's link carried is kept.
  const GUIDE = (() => {
    const at = (m) => { const q = new URLSearchParams(location.search); q.set('look', 'oil'); q.set('bench', m); return location.origin + location.pathname + '?' + q.toString(); };
    const which = MODE_B === 'trees' ? 1 : MODE_B === 'air' || MODE_B.startsWith('air,') ? 2 : MODE_B === 'foot' ? 3 : 0;
    return 'THREE SPEED TESTS, one after another. For each: open its address, lay the phone down and do not touch it until the\n'
      + 'table says "done" at the bottom, press Copy the table, and paste it into the chat. Then open the next one.\n'
      + '  1 the trees:             ' + at('trees') + '\n'
      + '  2 the view from the air: ' + at('air') + '\n'
      + '  3 on foot:               ' + at('foot') + '\n'
      + (which ? 'THIS IS TEST ' + which + ' OF 3.' : 'THIS IS THE WHOLE TABLE (not one of the three).') + '\n\n';
  })();
  let MK = 1;             // how much sharper each way the questions are asked (1: not capped, asked as drawn)
  let capMs = 0;          // the frame interval the device is held at, if it is held at one
  const head = (r0) => {
    let gpu = '?';
    try { const gl = R.getContext(), e = gl.getExtension('WEBGL_debug_renderer_info'); if (e) gpu = String(gl.getParameter(e.UNMASKED_RENDERER_WEBGL)); } catch { /* not told */ }
    const i = P.info || {}, c = R.domElement;
    const sun = sunOut == null ? '' : sunOut ? 'sun out (shadows drawn)' : 'sun not out (no shadows drawn)';
    return GUIDE + 'PAINTED COSMOS SPEED TEST 10' + (MODE_B === '1' ? '' : ' (' + MODE_B + ')') + ', ' + BUILD + ': press Copy the table at the bottom, then paste it\n' +
      gpu.slice(0, 64) + ' | depth ' + (i.depth || '?') + ' | ' + sun + '\n' +
      'picture ' + (i.internalWidth || c.width) + 'x' + (i.internalHeight || c.height) + ' | screen ' + window.innerWidth + 'x' + window.innerHeight + ' @' + (window.devicePixelRatio || 1).toFixed(2) + (pin ? ' | held still' : ' | NOT HELD') +
      ' | tier ' + i.quality + ' | edges ' + (P.aaMode ? P.aaMode() : '?') + ' | paint ' + (P.lite ? 'lighter' : 'full') +
      (r0 ? ' | script ' + r0.script.toFixed(1) + ' ms, ' + Math.round(r0.calls) + ' calls, ' + Math.round(r0.tris / 1000) + 'k triangles a frame' : '') +
      (MK > 1 ? '\nTHE QUESTIONS BELOW WERE ASKED WITH THE PICTURE ' + MK.toFixed(2) + ' TIMES AS SHARP EACH WAY, because at the\n'
        + 'size this device draws it is held at ' + (1000 / Math.max(capMs, 1e-3)).toFixed(0) + ' a second and NOTHING could be told apart: every row read -0.0 ms.\n'
        + 'So the + / - below are real costs, but of a picture ' + (MK * MK).toFixed(1) + ' times the one it draws. Rows 24 on are back at that size.' : '');
  };
  const run = async () => {
    el.textContent = GUIDE + 'speed test: waiting for the first view...';
    // (MK and capMs are filled by the probe below, before the rows; head() reads them.)
    while (!window.__pcReady) await wait(250);
    if (pc.settle) await Promise.race([pc.settle(12), wait(20000)]);
    await wait(2500);
    pin = takePin();                 // from here the game is held still (above)
    if (pc.settle) await Promise.race([pc.settle(12), wait(20000)]);
    const hasB = typeof P._bench === 'function', lite0 = !!P.lite;
    const B = (o) => hasB && P._bench(o);
    const farMeshes = (fn) => pc.scene.traverse((o) => { if (o.isMesh && o.material && /^pc-prop-far/.test(mname(o))) fn(o); });
    const treeMeshes = (fn) => pc.scene.traverse((o) => { if (o.isMesh && o.material && /^pc-prop-(tall|far)/.test(mname(o))) fn(o); });
    const flora = () => (pc.world && pc.world._flora) || null;
    // (the flora lane, 2026-11-24, docs/lead/FLORA-DESIGN.md 4.4) THE NEAR GRASS: the rings of painted marks round the eye
    // (world/nearground.js), one material each, all named pc-near. They are in no other row: 'no small plants' takes the
    // PROP undergrowth only, and the plants' flat modes do not reach the near grass's shader.
    const nearRings = (fn) => { const n = pc.world && pc.world._near; if (n && n.rings) for (const r of n.rings) fn(r); };
    // (the far trees' form swapped while the test runs, world/flora.js setFarCards: the two forms are then timed in the
    // same minute, on a phone as warm for the one as for the other)
    const cards0 = !!(flora() && flora().species && flora().species.some((sp) => sp.cardFar));
    // (the trees' two short programs, and the trees of clusters, swapped in while the test runs, world/flora.js
    // setTrees2: the trees' patches are built again, so each is timed in the same minute as the trees it replaces)
    const t2a = (flora() && flora().trees2) || '', t2d = !!(flora() && flora().treeDepth);
    const swapT2 = async (mode, depth) => {
      const f = flora();
      if (!f || !f.setTrees2 || f.setTrees2(mode, depth == null ? t2d : depth) == null) return;
      await wait(400);
      if (pc.settle) await Promise.race([pc.settle(12), wait(20000)]);
    };
    // (?treesway=whole: the near trees bend whole, as the middle ones do, without the crown's branch-by-branch sway;
    //  world/flora.js setTreeSway, the trees' patches built again. With the two short programs only.)
    const sw0 = !!(flora() && flora().swayWhole);
    // (?pines: the tall pines' and spruces' needles kept a few pixels across at range, world/flora.js setNeedles: a
    //  uniform, nothing rebuilt; with no needle kind in the world the row times the same frame twice)
    const nd0 = !!(flora() && flora().needles);
    const swapNeedles = async (on) => { const f = flora(); if (f && f.setNeedles) f.setNeedles(on); await wait(400); };
    const swapSway = async (whole) => {
      const f = flora();
      if (!f || !f.setTreeSway || f.setTreeSway(whole) == null) return;
      await wait(400);
      if (pc.settle) await Promise.race([pc.settle(12), wait(20000)]);
    };
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
    // (the trees-near lane's rows, in the full table and in ?bench=trees: the near and middle trees drawn by two short
    //  programs, wood and leaves, with no hair twigs (T2, ?trees2=1); the leaves as clusters on cards (?trees2=cards);
    //  the cards laid in depth first (T5). Each against the "as set" row above it, built afresh while the test runs.)
    const T2ROWS = [
      [t2a ? 'trees in one program as before' : 'trees: two short programs', () => swapT2(t2a ? '' : 'split'), () => swapT2(t2a)],
      ['near trees as clusters', () => swapT2('cards-near', false), () => swapT2(t2a)],
      ['middle trees as clusters', () => swapT2('cards-mid', false), () => swapT2(t2a)],
      ['clusters with a depth pass first', () => swapT2('cards', true), () => swapT2(t2a)],
      [sw0 ? 'near trees: branch sway as before' : 'near trees bend whole (no branch sway)', () => swapSway(!sw0), () => swapSway(sw0)],
      [nd0 ? 'pines: needles as thin as before' : 'pines: needles kept wide at range', () => swapNeedles(!nd0), () => swapNeedles(nd0)],
    ];
    // ---- THE TENTH FORM'S HANDLES (see the top of this file) ----------------------------------------------------
    const tallMats = () => mats(/^pc-prop-tall/);
    const tallMeshes = (fn) => pc.scene.traverse((o) => { if (o.isMesh && o.material && /^pc-prop-tall/.test(mname(o))) fn(o); });
    const nearPart = (v) => () => { const f = flora(); if (f) f.benchNear = v; };
    // (no wind in the near trees' vertex shader: their own uPhysOn is 0 while the rest of the world's stays as it is.
    //  The uniform is shared by every plant, so the near trees are given one of their own for the row and handed the
    //  shared one back after it.)
    const noWind = (on) => {
      for (const m of tallMats()) {
        const U = m.uniforms;
        if (!U || !U.uPhysOn) continue;
        if (on) { if (!m.userData.benchPhys) m.userData.benchPhys = U.uPhysOn; U.uPhysOn = { value: 0 }; }
        else if (m.userData.benchPhys) { U.uPhysOn = m.userData.benchPhys; m.userData.benchPhys = null; }
        m.uniformsNeedUpdate = true;
      }
    };
    // (one-sided: the back faces of every wood tube and every leaf card turned away are not drawn -- the leaves seen
    //  from behind go with them, which the row's name says; the programs are built again, and calm() waits)
    const oneSide = (on) => {
      for (const m of tallMats()) {
        if (on) { if (m.userData.benchSide == null) m.userData.benchSide = m.side; m.side = 0; }
        else if (m.userData.benchSide != null) { m.side = m.userData.benchSide; m.userData.benchSide = null; }
        m.needsUpdate = true;
      }
    };
    const farWind = (on) => {
      for (const m of mats(/^pc-prop-far-impostor/)) {
        const U = m.uniforms;
        if (!U || !U.uPhysOn) continue;
        if (!on) { if (!m.userData.benchPhys) m.userData.benchPhys = U.uPhysOn; U.uPhysOn = { value: 0 }; }
        else if (m.userData.benchPhys) { U.uPhysOn = m.userData.benchPhys; m.userData.benchPhys = null; }
        m.uniformsNeedUpdate = true;
      }
    };
    const a2c = (on) => { for (const m of mats(/^pc-prop-/)) { if (on) { if (m.userData.benchA2C != null) { m.alphaToCoverage = m.userData.benchA2C; m.userData.benchA2C = null; } } else { if (m.userData.benchA2C == null) m.userData.benchA2C = m.alphaToCoverage; m.alphaToCoverage = false; } } };
    const farForm = async (form) => {
      const f = flora();
      if (!f || !f.setFarForm || f.setFarForm(form) == null) return;
      await wait(400);
      if (pc.settle) await Promise.race([pc.settle(12), wait(30000)]);
    };
    let hand0 = null;
    const handTo = (n, m) => { const f = flora(); if (!f || !f.setHandover) return; if (!hand0) hand0 = [f.t0 * 0.30, f.t1 * 0.30]; f.setHandover(n, m); };
    const handBack = () => { const f = flora(); if (!f || !f.setHandover || !hand0) return; f.setHandover(hand0[0], hand0[1]); hand0 = null; };
    const form0 = (() => { const f = flora(); return f ? (f.farForm || (f.impWant || f.impOn ? 'impostor' : cards0 ? 'cards' : 'lump')) : 'cards'; })();
    // the rows themselves: [label, on, off]
    const shw0 = (() => { const f = flora(); return f ? !!f.shadowWhole : true; })();      // (the shadow pass's whole-draw setting as the run starts: shWhole)
    const T0 = {
      leaves: ['near trees: leaves only', nearPart('leaves'), nearPart(null)],
      wood: ['near trees: wood only', nearPart('wood'), nearPart(null)],
      bark: ['near bark one flat colour', () => B({ flat: 7 }), () => B({ flat: 0 })],
      wind: ['near trees: no wind in shader', () => noWind(true), () => noWind(false)],
      side: ['near trees one-sided', () => oneSide(true), () => oneSide(false)],
      order: ['near trees after the ground', () => tallMeshes((o) => { o.renderOrder = 6; }), () => tallMeshes((o) => { o.renderOrder = 0; })],
      a2c: ['plants without alpha-to-cov', () => a2c(false), () => a2c(true)],
      blob: ['far trees as crossed cards', () => farForm('blob'), () => farForm(form0)],
      // (T1: the far trees as painted impostors, two triangles a tree, swapped in the same minute; render/impostor.js.
      //  If the run was started with ?fartree=impostor this row asks the other way: the tree of flat pieces.)
      imp: form0 === 'impostor' ? ['far trees of flat pieces', () => farForm('cards'), () => farForm(form0)] : ['far trees as impostors', () => farForm('impostor'), () => farForm(form0)],
      // (T4, the hand-over at the phone's scale: the middle tree to the far one at 45 m instead of 57; the design's
      //  full target, 18 m and 45 m; and the far package as ?fartree=impostor ships it, the impostors from 45 m)
      mid45: ['middle trees only to 45 m', () => handTo(27, 45), () => handBack()],
      hand: ['trees hand over at 18 / 45 m', () => handTo(18, 45), () => handBack()],
      pack: ['impostors from 45 m', async () => { handTo(27, 45); if (form0 !== 'impostor') await farForm('impostor'); }, async () => { handBack(); if (form0 !== 'impostor') await farForm(form0); }],
      // (the far wood in the wind, ?farwind=1: the far impostors' own uPhysOn set to 0 for the row, as 'no wind in shader')
      farStill: ['far trees still in the wind', () => farWind(false), () => farWind(true)],
      // (with the impostors the far trees read no shadow map: what do shadows cost from the air without the far cards?)
      noSh: ['no shadows at all', () => B({ shadow: false }), () => B({ shadow: true })],
      noFar: ['no far trees', () => show(/^pc-prop-far/, false), () => show(/^pc-prop-far/, true)],
      farFlat: ['far trees one flat colour', () => B({ flat: 3 }), () => B({ flat: 0 })],
      noNear: ['no near trees', () => show(/^pc-prop-tall/, false), () => show(/^pc-prop-tall/, true)],
      // (T6, the shadow pass: a split tree (?trees2) one draw there, the default, against one a material, ?shwhole=0;
      //  the row asks the other way from how the run started; flora.setShadowWhole)
      shWhole: [shw0 ? 'split trees by part in shadow pass' : 'split trees whole in shadow pass',
        () => { const f = flora(); if (f && f.setShadowWhole) f.setShadowWhole(!shw0); }, () => { const f = flora(); if (f && f.setShadowWhole) f.setShadowWhole(shw0); }],
    };
    const r = (row, tag) => [row[0] + tag, row[1], row[2]];
    // THE AIR ROWS: an "as set" that lifts the pin (it is the base the questions after it are set against), the
    // questions, and an "as set" back on foot that puts it down again. (The air's "as set" rows are a different picture,
    // so, like the water views', they are kept out of the check that the "as set" rows agree: `alone`.)
    const airAt = (h, deg, qs) => [[AS + ', ' + h + ' m up, ' + deg + ' deg down', () => lift(h, deg), null, { alone: true }]].concat(qs.map((q) => r(q, ' (' + h + ' m up)')));
    const onFoot = [AS + ', back on foot', () => land(), null];
    const ground = (on) => show(/^pc-terrain/, on);
    // ---- THE WATER VIEWS (docs/lead/WATER-DESIGN.md, section 6) -------------------------------------------------------
    // The view this test is held at, the landing, has NO WATER in it: 0.0 % of its pixels, measured 24 Nov in a copy of
    // that view (936 x 372). So no row taken there can measure the water, and v37's "no water drawn -0.6 ms" was noise.
    // Two places on Earth are held instead for the water's rows: the landing brook's BANK, looking upstream (water about a
    // fifth of the picture in the painter's copy of it), and a sea SHORE at the waterline, looking out (about three
    // quarters). The explorer is put there and held there exactly as it is held at the landing (`pin`), the world is let
    // build round it, and each water row is set against ITS view's own "as set" row. Its "as set" rows are not counted in
    // the check that the landing's agree with each other: a different picture is not a disagreement. A water lane adds
    // its own rows from its own file (world/waterhooks.js WATER_BENCH). Worlds other than Earth: no water rows.
    const landing = pin;
    const WV = {
      bank: { dir: [0.196307, 0.620916, 0.758899], e: 0, n: 0, yaw: 20, pitch: -0.12, find: true },
      shore: { dir: [0.19461, 0.62161, 0.75877], e: -1720, n: -1202, yaw: 185, pitch: -0.10 },
    };
    const frameAt = (u) => {      // east = (0, 1, 0) x up, north = up x east: the frame sim.js and the gallery use
      let ex = u[2], ey = 0, ez = -u[0]; const el = Math.hypot(ex, ey, ez) || 1; ex /= el; ey /= el; ez /= el;
      return { e: [ex, ey, ez], n: [u[1] * ez - u[2] * ey, u[2] * ex - u[0] * ez, u[0] * ey - u[1] * ex] };
    };
    const goView = async (name) => {
      const S = pc.sim;
      if (!S || !landing) return;
      if (!name) pin = landing;
      else {
        const v = WV[name], R0 = 4000, l0 = Math.hypot(...v.dir), u = v.dir.map((a) => a / l0), F = frameAt(u);
        const sm = S.sampler(S.bodyId), at = (b, B, e, nn) => { const q = [0, 1, 2].map((i) => b[i] + (B.e[i] * e + B.n[i] * nn) / R0); const ql = Math.hypot(...q); return q.map((a) => a / ql); };
        const wetAt = (q) => { const s2 = sm({ x: q[0], y: q[1], z: q[2] }); return s2.liquidRadius > s2.radius; };
        let d = at(u, F, v.e, v.n), yaw = v.yaw;
        // (the BANK is wherever the nearest water to that spot is: the rivers move with ?rivers=tree. Walk out from it to the
        //  nearest water, stand two metres back from its edge, and look the way the water runs longest, as the painter's
        //  gallery stands on a bank)
        if (v.find) {
          let bestR = 1e9, bestA = 0;
          for (let a = 0; a < 48; a++) {
            const an = (a / 48) * Math.PI * 2;
            for (let rr = 2; rr < 320 && rr < bestR; rr += rr < 60 ? 1.5 : 4) if (wetAt(at(u, F, v.e + Math.sin(an) * rr, v.n + Math.cos(an) * rr))) { bestR = rr; bestA = an; break; }
          }
          if (bestR < 1e9) {
            const r0 = Math.max(0, bestR - 2);
            d = at(u, F, v.e + Math.sin(bestA) * r0, v.n + Math.cos(bestA) * r0);
            const B = frameAt(d);
            let bs = -1;
            for (let a = 0; a < 48; a++) {
              const an = (a / 48) * Math.PI * 2;
              let sc = 0;
              for (let rr = 4; rr < 70; rr += 3) if (wetAt(at(d, B, Math.sin(an) * rr, Math.cos(an) * rr))) sc += 1 + rr * 0.02;
              if (sc > bs) { bs = sc; yaw = an * 180 / Math.PI + 6; }
            }
          }
        }
        const g = sm({ x: d[0], y: d[1], z: d[2] }), r = Math.max(g.radius, g.liquidRadius || 0);
        const G = frameAt(d), cy = Math.cos(yaw * Math.PI / 180), sy = Math.sin(yaw * Math.PI / 180);
        const f = { x: G.n[0] * cy + G.e[0] * sy, y: G.n[1] * cy + G.e[1] * sy, z: G.n[2] * cy + G.e[2] * sy };
        pin = { t: landing.t, p: { x: d[0] * r, y: d[1] * r, z: d[2] * r }, v: { x: 0, y: 0, z: 0 }, fwd: { ...f }, view: { ...f }, pitch: v.pitch, boom: landing.boom, flying: false };
      }
      putBack();
      await wait(600);
      if (pc.settle) await Promise.race([pc.settle(12), wait(30000)]);
      // (a move of two kilometres is taken by the world for an ARRIVAL, and the picture is veiled until the land is laid
      //  (world/index.js, render/shared.js SHEET.laid): a row timed under the veil would time the veil. Wait for it.)
      try {
        const SHEET = (await import('../render/shared.js')).SHEET, t0 = performance.now();
        while (SHEET.laid < 1 && performance.now() - t0 < 40000) await wait(250);
      } catch { /* no painter's sheet: nothing to wait for */ }
    };
    const waterRows = [];
    if (pc.sim && pc.sim.bodyId === 'earth') {
      let extra = [];
      try { extra = (await import('../world/waterhooks.js')).WATER_BENCH || []; } catch { extra = []; }
      for (const view of ['bank', 'shore']) {
        waterRows.push([AS + ', ' + view + ' view', () => goView(view), null, { alone: true }]);
        waterRows.push([view + ' view: no water drawn', () => show(/^pc-water/, false), () => show(/^pc-water/, true)]);
        for (const r of extra) if (r && r.view === view) waterRows.push([view + ' view: ' + r.name, r.on, r.off]);
      }
    }
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
    // THE NEAR GRASS AND FLOWERS (the pc-near rings, world/nearground.js): in no row until 24 Nov, though the header has
    // named them since the second form. Whole; half of their marks, folded away by number in the vertex shader before
    // any is rasterised (materials.js NEAR_VERT uNearCut), so the gap to 'as set' is half the marks' whole cost; and
    // every mark kept but painted one flat colour (shared.js uOilL.y 8), so that gap is the sward's paint a pixel.
    const nearCut = (k) => { for (const m of mats(/^pc-near$/)) if (m.uniforms && m.uniforms.uNearCut) m.uniforms.uNearCut.value = k; };
    const GRASS = [
      ['no near grass or flowers', () => show(/^pc-near$/, false), () => show(/^pc-near$/, true)],
      ['near grass: half its marks', () => nearCut(0.5), () => nearCut(0)],
      ['near grass one flat colour', () => B({ flat: 8 }), () => B({ flat: 0 })],
    ];
    const WX0 = { ...WX2 };      // (group D: its switches as the address set them, put back after each of its rows)
    const holdStorm = (on) => { const P = pc.sim && pc.sim.physics; if (P && P.forceWeather) P.forceWeather(on ? { kind: 'storm' } : null); };
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
      // (TENTH FORM, 2026-11-24: the near trees' 51.8 ms split six ways, and the depth questions; see the top)
      T0.leaves, T0.wood, T0.bark, T0.wind, T0.side, T0.order, T0.a2c,
      [AS, null, null],
      T0.blob, T0.imp, T0.mid45, T0.hand, T0.pack,
      // (2026-11-23, after speed test 9: the near trees are 62.7 ms of a 101 ms frame and NOTHING in that table says
      //  why. These three rows split it. "hand over at half the distance" is not a diagnostic -- it IS the change
      //  that would be made, so the device measures the fix and not a guess. "half their leaves" drives the leaf
      //  thinning that is already built (flora.js uLeafLod); "no near leaves" leaves the trunks and branches alone,
      //  so the gap between it and "no near trees" is what the WOOD of a tree costs against its FOLIAGE.)
      ['near trees hand over at half the distance', () => { const f = flora(); if (f) { f.benchTreeK = 0.5; f.lastScale = -1; } },
        () => { const f = flora(); if (f) { f.benchTreeK = null; f.lastScale = -1; } }],
      ['near trees at a third of the distance', () => { const f = flora(); if (f) { f.benchTreeK = 0.33; f.lastScale = -1; } },
        () => { const f = flora(); if (f) { f.benchTreeK = null; f.lastScale = -1; } }],
      // (2026-11-24, the trees to 30 a second, docs/lead/TREES-DESIGN.md on r2: the near and middle trees drawn by
      //  two short programs, wood and leaves, with no hair twigs (T2, ?trees2=1); the near tree's leaves as clusters
      //  on cards (?trees2=cards). Each against the "as set" row above, built afresh while the test runs.)
      ...T2ROWS,
      ['no trees', () => show(/^pc-prop-(tall|far)/, false), () => show(/^pc-prop-(tall|far)/, true)],
      ['no small plants', () => show(/^pc-prop-(?!tall|far)/, false), () => show(/^pc-prop-(?!tall|far)/, true)],
      // (the flora lane) what the near grass costs (all of it: GRASS's first row), and its finest ring alone. Its material's own `visible` is
      // the switch: the ring's update moves its mesh, never this.
      ['near grass: the blades only (the fine ring and the carpet)', () => nearRings((r) => { r.material.visible = r.cfg.name === 'fine' || !!r.cfg.carpet; }),
        () => nearRings((r) => { r.material.visible = true; })],
      // (G2, FLORA-DESIGN.md 6.2) the carpet of blades near the feet, which four times the near blades are bought with
      ['no carpet of near blades', () => nearRings((r) => { if (r.cfg.carpet) r.material.visible = false; }), () => nearRings((r) => { r.material.visible = true; })],
      // (F2, FLORA-DESIGN.md 7.2) the flowers' heads near the eye (their stalks stay: they are blades to the shader)
      ['no flower heads', () => nearRings((r) => { r.material.uniforms.uNearK.value.z = 1; }), () => nearRings((r) => { r.material.uniforms.uNearK.value.z = 0; })],
      // (G1, FLORA-DESIGN.md 6.1) the marks outside the picture shaded whole again, as before the cull: what the cull saves
      ['grass not culled off-screen', () => nearRings((r) => { r.__k = r.material.uniforms.uNearK.value.x; r.material.uniforms.uNearK.value.x = 0; }),
        () => nearRings((r) => { r.material.uniforms.uNearK.value.x = r.__k == null ? 1 : r.__k; })],
      ...GRASS,
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
      // (GROUP D, THE SECOND WEATHER: docs/lead/WEATHER-DESIGN.md section 7. Asked only while its pieces are switched on
      //  (?wx2=1, ?windmap=1 ...): with them off the rows would time the same frame twice and say nothing.)
      ...(WX2.windmap ? [
        [AS, null, null],
        // the far field the plants read beyond the bend field (physics flora.js FAR): one lookup for one lookup, so ~0
        ['weather: no far wind on plants', () => { WX2.farwind = false; }, () => { WX2.farwind = WX0.farwind; }],
        // the whole wind map's refresh stopped: read the script time against the row before (about 0.14 ms derived)
        ['weather: wind map frozen', () => { WX2.freeze = true; }, () => { WX2.freeze = false; }],
      ] : []),
      // (group D: a STORM HELD OVERHEAD, physics.forceWeather, so the worst case is timed whatever the weather of the
      //  moment: the sky, the rain, the wind of a thunderstorm. "storm: no rain drawn" is the same storm with the rain's
      //  marks hidden: the gap between the two rows is what the falling rain costs.)
      ...(WX2.cloudmap ? [
        [AS, null, null],
        ['weather: a storm held overhead', () => holdStorm(true), () => holdStorm(false)],
        ['storm: no rain drawn', () => { holdStorm(true); show(/^pc-kit-rain/, false); }, () => { show(/^pc-kit-rain/, true); holdStorm(false); }],
      ] : []),
      // (group D: the rain shafts under distant storms and the lightning bolts, world/storms.js. Not with the storm held
      //  overhead: a shaft is not drawn round the eye, so the row means something only with a storm in sight, about
      //  1 to 7 km away -- the weather of the moment, as the table is run. Derived for the phone: about 0.2 ms a storm in view.)
      ...((WX2.rainshaft || WX2.bolts) ? [
        ['storm: no rain shafts or bolts', () => show(/^pc-storm-/, false), () => show(/^pc-storm-/, true)],
      ] : []),
      // (TENTH FORM) THE AIR: no row had ever timed it. The same spot, from 150 m and 400 m up.
      ...airAt(150, 30, [T0.noFar, T0.blob, T0.imp]),
      ...airAt(400, 45, [T0.noFar, T0.imp]),
      onFoot,
      // (the water's rows come LAST, after the final as-set row: see THE WATER'S ROWS LAST below)
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
      // (THE WATER'S ROWS LAST, at the device's own size: they move the explorer two kilometres, and the world must build
      //  round it there, so everything above is in the table whatever happens at the shore. Each wait has its own limit --
      //  the world settled in 30 s, the arrival veil in 40 s, a steady picture in 8 s (40 s while nothing is drawn) -- so a
      //  view costs at most about two minutes and the test cannot hang on it.)
      ...waterRows,
    ];
    // ?bench=trees: the tree questions alone, on foot and from the air (a shorter run: each row on a cooler phone)
    const treeSteps = [
      [AS, null, null],
      T0.leaves, T0.wood, T0.bark, T0.wind,
      [AS, null, null],
      T0.side, T0.order, T0.a2c, T0.noNear,
      [AS, null, null],
      ...T2ROWS, T0.shWhole,
      [AS, null, null],
      T0.blob, T0.imp, T0.noFar, T0.farFlat, T0.farStill,
      [AS, null, null],
      T0.mid45, T0.hand, T0.pack,
      ...airAt(150, 30, [T0.noFar, T0.blob, T0.imp, T0.farFlat, T0.a2c, T0.farStill]),
      ...airAt(400, 45, [T0.noFar, T0.blob, T0.imp, T0.noSh]),
      onFoot,
      [AS + ', last', null, null],
    ];
    // ?bench=air[,h]: the air table (FV7, docs/lead/FARVIEW-DESIGN.md on r2), held h metres up (400 if not said),
    // 45 degrees down. The other air lanes' switches (canopy, the far water, the meadow, the rock, the air's top)
    // join here as rows when they exist.
    const airH = (() => { const m = /^air,(\d+)/.exec(MODE_B); const h = m ? +m[1] : 400; return Math.max(30, Math.min(1500, h)); })();
    const airSteps = [
      [AS + ', on foot', null, null],
      ...airAt(airH, 45, [
        ['no ground drawn', () => ground(false), () => ground(true)],
        ['ground one flat colour', () => B({ flat: 1 }), () => B({ flat: 0 })],
        T0.noFar, T0.farFlat, T0.blob, T0.imp,
        ['no water drawn', () => show(/^pc-water/, false), () => show(/^pc-water/, true)],
        // (the far view's canopy painted into the ground, FV2: render/farground.js; the same picture as ?canopy=0)
        ['canopy painted off (FV2)', async () => { try { (await import('../render/farground.js')).CANOPY_BENCH.off = true; } catch { /* none */ } },
          async () => { try { (await import('../render/farground.js')).CANOPY_BENCH.off = false; } catch { /* none */ } }],
        // (the ground's short uniform list, world/terrain.js UPLIST, the far-view lane: off = three re-sends the ground
        //  material's whole uniform list every patch, as before 24 Nov; derived 1 to 2 ms of main-thread time on the phone)
        ['ground uniforms re-sent whole every patch', async () => { try { (await import('../world/terrain.js')).UPLIST.on = false; } catch { /* none */ } },
          async () => { try { (await import('../world/terrain.js')).UPLIST.on = true; } catch { /* none */ } }],
        T0.a2c,
        ['no shadows at all', () => B({ shadow: false }), () => B({ shadow: true })],
      ]),
      ...(airH < 1000 ? airAt(1000, 45, [T0.noFar, T0.imp]) : []),
      onFoot,
      [AS + ', last', null, null],
    ];
    // ?bench=foot: the frame on foot at the landing without the trees' questions (the owner's 33 ms, 24 Nov). With the
    // two short programs and the impostors as the default trees the frame is expected near 22 ms (derived, never
    // measured), so these rows are asked off the cap, where they can be read: each against the "as set" row before it.
    const footSteps = [
      [AS, null, null],
      ...GRASS,
      [AS, null, null],
      ['no small plants', () => show(/^pc-prop-(?!tall|far)/, false), () => show(/^pc-prop-(?!tall|far)/, true)],
      ['no ground drawn', () => ground(false), () => ground(true)],
      ['ground one flat colour', () => B({ flat: 1 }), () => B({ flat: 0 })],
      [AS, null, null],
      ['no shadows at all', () => B({ shadow: false }), () => B({ shadow: true })],
      ['trees cast no shadow', () => treeMeshes((o) => o.layers.disable(2)), () => treeMeshes((o) => o.layers.enable(2))],
      ['no light in the air', () => B({ shaft: false }), () => B({ shaft: true })],
      [lite0 ? 'the full paint' : 'the lighter paint', () => B({ lite: !lite0 }), () => B({ lite: lite0 })],
      [AS, null, null],
      ['no near trees', () => show(/^pc-prop-tall/, false), () => show(/^pc-prop-tall/, true)],
      T0.bark, T0.noFar,
      ['no trees', () => show(/^pc-prop-(tall|far)/, false), () => show(/^pc-prop-(tall|far)/, true)],
      [AS + ', last', null, null],
      ...waterRows,
    ];
    if (MODE_B === 'trees') steps.splice(0, steps.length, ...treeSteps);
    else if (MODE_B === 'foot') steps.splice(0, steps.length, ...footSteps);
    else if (MODE_B === 'air' || MODE_B.startsWith('air,')) steps.splice(0, steps.length, ...airSteps);
    const rows = [];
    let r0 = null, base = null;
    const bases = [];      // (2026-11-19) every "as set" row, so the table can say when it disagrees with itself
    for (let k = 0; k < steps.length; k++) {
      const [name, on, off, opt] = steps[k];
      el.textContent = head(r0) + '\n' + rows.join('\n') + '\n... ' + (k + 1) + ' of ' + steps.length + ': ' + name;
      if (on) await on();
      const ok = await calm();
      const f0 = P._shadow ? P._shadow.frames : -1;
      const r = stats(await sample(2400));
      r.fps = 1000 / Math.max(r.mean, 1e-3);
      if (k === 0 && P._shadow) sunOut = P._shadow.frames > f0;
      if (off) { await off(); if (name.startsWith('far trees as') || name.startsWith('far trees of') || /program|clusters|depth pass/.test(name)) await calm(); }
      // (a row that left the ground is put down again if the table ends up there; see airAt)
      // (2026-11-19) The header quotes the first row THAT WAS REALLY DRAWING. It used to quote the first row
      // whatever it was, and at v22 that row drew nothing, so the header described the whole game as "script
      // 0.0 ms, 0 calls, 0k triangles a frame".
      if (!r0 && r.calls >= DRAWS) r0 = r;
      const isBase = name.startsWith(AS);
      // (each question is set against the "as set" row before it: the phone warms through the run)
      const d = base && !isBase ? r.mean - base.mean : null;
      rows.push(String(k + 1).padStart(2) + ' ' + (name + ' ').padEnd(27, '.') + ' ' + r.mean.toFixed(1).padStart(5) + ' ms = ' + r.fps.toFixed(1).padStart(5) + ' a second' +
        (d == null ? '          ' : '  ' + ((d >= 0 ? '+' : '') + d.toFixed(1)).padStart(6) + ' ms') + '  (middle ' + r.mid.toFixed(0) + ', longest ' + r.worst.toFixed(0) + ', script ' + r.script.toFixed(1) + ', ' + Math.round(r.tris / 1000) + 'k tri' + (r.calls < DRAWS ? ', NOTHING DRAWN' : ok ? '' : ', NOT SETTLED') + ')');
      if (isBase) { base = r; if (!(opt && opt.alone)) bases.push(r.mean); }
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
    // the explorer back at the landing, if the water's rows or the air's took it away
    if (waterRows.length) await goView(null);
    if (foot && pin !== foot) await land();
    // the picture is the phone's own again (it was held through the run: see sharpen above)
    if (pc.game && typeof pc.game.holdPictureSize === 'function') pc.game.holdPictureSize(0, 0);
    el.textContent = head(r0) + '\n' + rows.join('\n') + '\ndone. (+ / - ms: against the "as set" row before it)' + warn;
    pc.bench = rows;
  };
  run().catch((e) => { el.textContent = GUIDE + 'speed test failed: ' + ((e && e.message) || e); });
}
