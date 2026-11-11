// The motion set: the lead's instrument for the picture IN MOTION (brief, art bible 7:
// "It must never shimmer or swim ... Moving should feel like the painting calmly repainting
// itself"; REFERENCES R-PAINT-2, 3, 4, 6). Every other look judgement in this project is a
// still. This one takes a short run of CONSECUTIVE game frames in the integrated game, with
// the game's clock driven by the test at a fixed step (window.__pc.hold / step: the result
// does not depend on how fast this machine draws), and measures what changes between them.
//
// Scenes (third person as the player sees it, HUD hidden, top tier unless --quality says so):
//   still-frozen  Earth spawn, standing, time scale 0: the same instant painted again and
//                 again. Anything that changes is driven by the wall clock or by chance.
//   still         Earth spawn, standing, the clock running: only what the wind moves may move
//                 (R-PAINT-3: mean change between consecutive frames under 0.5 %).
//   turn          a slow turn of the camera with the mouse held (3 px a frame, about 12
//                 degrees a second; R-PAINT-4: no interior region changes luminance by more
//                 than 3 % between consecutive frames) and the shower-door measure (R-PAINT-2).
//   walk          W held through the home forest.
//   flight        the ship low over the wood (about 40 m up, 35 m/s).
//   pulse         the pulse drive from high above Earth towards another world.
//   storm         the first thunderstorm at the Earth spawn (clock 240 s), standing.
//
// Measures, on luminance at half size (0..1 of the displayed value):
//   change        mean |difference| between consecutive frames, in % of full scale, and the
//                 share of pixels that change by more than 3 %.
//   followed      the picture is cut in 16 px blocks (32 px on screen); each block of frame n
//                 is looked for in frame n+1 within 8 px (16 on screen). What is left after the
//                 best match is change that motion does not explain: the "residual". The
//                 change of a block's mean luminance after the match is R-PAINT-4's number.
//   pops          a block whose residual in one pair of frames is more than three times its
//                 own median over the run plus 2 % (and over 4 %): something appeared, vanished
//                 or changed at once there. Listed with the frame, the place and the change in
//                 the triangle count, and shown before and after on the sheet.
//   stuck         (turn only) fine and broad detail of frame n against frame n+3: how well it
//                 matches where the world has moved to ("with the world"), where it was on the
//                 screen ("on the screen"), and how well the frame matches ITSELF shifted by
//                 that much ("by chance"). Detail that belongs to the screen scores high "on
//                 the screen" and above "by chance"; paper grain may, strokes and washes may not.
//
// Writes docs/lead/evidence/motion-<scene>.jpg (first and last frame, the mean change, the
// largest single change, the pops before and after) and motion.json. Console errors fail it.
// What it cannot say: the frame rate, and how streaming looks on a real machine (in software
// rendering each frame takes seconds, so the builder gets far more time per simulated second
// than it will at 60 frames a second: pops from late building are UNDERSTATED here).
//
// Usage: node tests/motion.mjs [--root dir] [--only still,turn] [--quality 2] [--hz 30]
//                              [--out dir] [--sheets dir] [--w 960 --h 540] [--label text]
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { parseArgs, repo, settleWorld } from './browser.mjs';
import { openPage } from '../tools/shot.mjs';
import { BODIES } from '../src/data/bodies.js';

const opt = parseArgs({ out: '/home/user/.pc-scratch/pilot/motion', w: 960, h: 540, quality: 2, only: '', label: '', hz: 30 });
const W = Number(opt.w), H = Number(opt.h), DT = 1 / Number(opt.hz);
const sheets = opt.sheets || path.join(repo, 'docs/lead/evidence');
fs.mkdirSync(opt.out, { recursive: true });
fs.mkdirSync(sheets, { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
let label = opt.label;
if (!label) {
  try { label = 'commit ' + execSync('git rev-parse --short HEAD', { cwd: repo, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() + (opt.root ? ' (clean export)' : ' (working tree)'); }
  catch { label = opt.root ? 'a clean export' : 'the working tree'; }
}

// Where to look (PAINTER, quality push, top tier): the sward is drawn in three rings, to 17,
// 66 and 240 m; trees change tier at 90, 190, 420 and 600 m. A walk sweeps the ring edges over
// the ground ahead; the low flight crosses the tree tiers; `fill` is an arrival, before the
// land is painted.
const SCENES = [
  { id: 'still-frozen', what: 'Earth spawn, standing, the clock stopped (time scale 0): the same instant painted again', place: 'spawn', t: 30, frames: 6, freeze: true },
  { id: 'still', what: 'Earth spawn, standing still, the clock running', place: 'spawn', stay: true, t: 30, frames: 30 },
  { id: 'turn', what: 'Earth spawn, a slow turn of the camera (mouse held, 3 px a frame)', place: 'spawn', stay: true, t: 30, frames: 40, mouse: 3, stuck: true },
  { id: 'walk', what: 'walking through the home forest (W held)', place: 'spawn', stay: true, t: 30, frames: 48, keys: ['KeyW'], lead: 12 },
  { id: 'storm', what: 'the first thunderstorm at the Earth spawn (clock 240 s), standing still', place: 'spawn', stay: true, t: 240, pre: 4, frames: 30 },
  { id: 'flight', what: 'the ship low over the wood', place: 'spawn', t: 30, frames: 48, ship: { altitude: 40, speed: 35, throttle: 0.5 }, lead: 6 },
  { id: 'fill', what: 'arriving on foot 600 m east of the spawn: the first frames, while the land is still being painted', place: 'east', t: 30, frames: 30, noSettle: true },
  { id: 'pulse', what: 'the pulse drive, from high above Earth', frames: 30, pulse: ['mars', 'venus', 'jupiter', 'saturn', 'mercury'] },
];
const WANT = SCENES.filter((s) => !opt.only || String(opt.only).split(',').includes(s.id));

const query = `dynres=0&pointerlock=0&card=0&fresh=1&save=0&audio=0&stats=1&quality=${opt.quality}`;
const { page, browser, problems, close } = await openPage({ pagePath: '/index.html?' + query, w: W, h: H, root: opt.root });
let rows = [];
try { rows = JSON.parse(fs.readFileSync(path.join(sheets, 'motion.json'), 'utf8')).scenes.filter((r) => !WANT.some((s) => s.id === r.id)); } catch { rows = []; }
const order = (r) => SCENES.findIndex((s) => s.id === r.id);
const save = () => { rows.sort((a, b) => order(a) - order(b)); fs.writeFileSync(path.join(sheets, 'motion.json'), JSON.stringify({ label, size: `${W}x${H}`, quality: Number(opt.quality), stepHz: Number(opt.hz), scenes: rows }, null, 1)); };
let failed = false;
let here = 'spawn';                 // a fresh game stands at the Earth spawn

const step = (n = 1) => page.evaluate(([dt, k]) => window.__pc.step(dt, k), [DT, n]);
const grab = () => page.evaluate(() => window.__motion.grab());
const info = () => page.evaluate(() => window.__pc.info());

try {
  await page.waitForFunction('window.__pcReady === true', null, { timeout: 900000, polling: 300 });
  log('ready', JSON.stringify(await page.evaluate(() => window.__pc.info().using)), label);
  await page.evaluate(() => { document.getElementById('pc-hud').style.visibility = 'hidden'; });
  await page.evaluate(installInPage, [W, H]);
  for (const s of WANT) {
    const t0 = Date.now();
    log(`${s.id}: ${s.what}`);
    // Place and clock; the world is painted with the clock stopped (the loop runs by itself
    // here, nothing moves and nothing is measured).
    await page.evaluate(() => { const pc = window.__pc; pc.hold(false); pc.setTimeScale(0); window.__motion.reset(); });
    const note = [];
    if (s.place === 'spawn' && s.stay && here === 'spawn') {
      // The scene before left the explorer standing at (or a few steps from) the spawn.
      await page.evaluate((s) => window.__pc.setClock(s.t - (s.pre || 0)), s);
    } else if (s.place === 'spawn' || s.place === 'east') {
      if (s.noSettle) await page.evaluate(() => window.__pc.hold(true));   // not one frame before the measured ones
      await page.evaluate((s) => {
        const pc = window.__pc, d0 = pc.world.getSpawn('earth').unitDir;
        let d = [d0.x, d0.y, d0.z];
        if (s.place === 'east') {
          // 600 m along the surface, eastwards (about the pole): land nobody has painted yet.
          const a = 600 / s.R, c = Math.cos(a), n = Math.sin(a);
          d = [d0.x * c + d0.z * n, d0.y, d0.z * c - d0.x * n];
        }
        pc.setClock(s.t - (s.pre || 0));
        pc.teleport(s.ship ? { body: 'earth', dir: d, ship: true, altitude: s.ship.altitude, throttle: s.ship.throttle } : { body: 'earth', dir: d, firstPerson: false });
      }, { ...s, R: BODIES.earth.radius });
    } else if (s.pulse) {
      await page.evaluate((alt) => {
        const pc = window.__pc, d = pc.world.getSpawn('earth').unitDir;
        pc.teleport({ body: 'earth', dir: [d.x, d.y, d.z], ship: true, altitude: alt });
      }, BODIES.earth.radius * 3);
    }
    here = s.ship || s.pulse || s.place !== 'spawn' ? 'elsewhere' : 'spawn';
    const st = s.noSettle ? { ok: true, frames: 0, seconds: 0 } : await settleWorld(page);
    const settled = st.ok ? st.seconds : null;
    if (!st.ok) note.push(`the world did not settle in ${st.frames} frames`);
    await page.evaluate((fr) => { const pc = window.__pc; pc.hold(true); pc.setTimeScale(fr ? 0 : 1); }, !!s.freeze);
    await page.waitForTimeout(300);
    // Run up to the moment in coarse steps (the sky eases, the marks fill the air): not measured.
    if (s.pre) await page.evaluate(([dt, k]) => window.__pc.step(dt, k), [0.2, Math.round(s.pre / 0.2)]);

    // The action, with real keys and a real mouse; then the frames, one fixed step each.
    if (s.ship) {
      await page.evaluate((sp) => {
        const sim = window.__pc.sim, q = sim.sh.q;
        // the nose: q applied to (0, 0, -1)
        const x = q.x, y = q.y, z = q.z, w = q.w, vx = 0, vy = 0, vz = -1;
        const tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx);
        const f = { x: vx + w * tx + (y * tz - z * ty), y: vy + w * ty + (z * tx - x * tz), z: vz + w * tz + (x * ty - y * tx) };
        sim.sh.v = { x: f.x * sp.speed, y: f.y * sp.speed, z: f.z * sp.speed };
        sim.sh.throttle = sp.throttle;
      }, s.ship);
    }
    if (s.pulse) {
      let on = null;
      for (const target of s.pulse) {
        await page.evaluate((b) => window.__pc.sim.setTarget(b), target);
        let a = null;
        for (let n = 0; n < 60; n++) {
          a = await page.evaluate((b) => window.__pc.aimAt(b), target);
          if (Math.abs(a.yawDeg) < 2.5 && Math.abs(a.pitchDeg) < 2.5) break;
          const k = 0.45 / 0.0017 * Math.PI / 180;
          await drag(Math.max(-120, Math.min(120, a.yawDeg * k)), -Math.max(-80, Math.min(80, a.pitchDeg * k)));
          await step(8);
        }
        await page.keyboard.press('KeyF');
        await step(8);
        const i = await info();
        if (i.state === 'PULSE') { on = target; break; }
        note.push(`${target}: the drive said "${i.notice || 'nothing'}"`);
      }
      if (!on) throw new Error('the pulse drive never engaged: ' + note.join('; '));
      note.push('pulse towards ' + on);
      await step(45);                               // a second and a half of spooling up, not measured
    }
    for (const k of s.keys || []) await page.keyboard.down(k);
    if (s.mouse) { await page.mouse.move(W / 2 - 90, H / 2); await page.mouse.down(); }
    if (s.lead) await step(s.lead);
    let mx = W / 2 - 90;
    for (let f = 0; f < s.frames; f++) {
      if (s.mouse) { mx += s.mouse; await page.mouse.move(mx, H / 2); }
      await step(1);
      await grab();
    }
    if (s.mouse) await page.mouse.up();
    for (const k of s.keys || []) await page.keyboard.up(k);
    if (s.pulse) { await page.keyboard.press('KeyF'); await step(2); }

    const res = await page.evaluate((o) => window.__motion.analyse(o), { stuck: !!s.stuck });
    const urls = await page.evaluate(() => window.__motion.frames.map((f) => f.url));
    const dir = path.join(opt.out, s.id);
    fs.mkdirSync(dir, { recursive: true });
    urls.forEach((u, i) => fs.writeFileSync(path.join(dir, `f${String(i).padStart(2, '0')}.jpg`), Buffer.from(u.split(',')[1], 'base64')));
    const row = { id: s.id, what: s.what, frames: s.frames, settledSeconds: settled, settledFrames: st.frames, seconds: 0, note, ...res.summary, pairs: res.pairs, pops: res.pops, meta: res.meta };
    await writeSheet(s, row, urls, res);
    row.seconds = Math.round((Date.now() - t0) / 1000);
    rows.push(row);
    save();
    const m = res.summary;
    log(`  change ${m.change.mean} % mean, ${m.change.max} % worst pair; residual ${m.residual.mean} % (p99 ${m.residual.p99}); block mean change p99 ${m.blockMean.p99} %, max ${m.blockMean.max} %, over 3 %: ${m.blockMean.over3} of ${m.blockMean.of}; pops ${m.pops.blocks} blocks in ${m.pops.pairs} of ${s.frames - 1} pairs; ${row.seconds} s`);
    if (m.stuck) log('  stuck:', JSON.stringify(m.stuck));
  }
} catch (e) { failed = true; log('exception:', e && e.stack ? e.stack : e); }
await close();
if (problems.length) { failed = true; log('PROBLEMS:', [...new Set(problems)].slice(0, 8).join(' | ')); }
log(failed ? 'MOTION SET FAILED' : 'MOTION SET DONE', rows.length, 'scenes');
process.exit(failed ? 1 : 0);

// Mouse travel with the button held, in short strokes (pointer lock is off in this run).
async function drag(dx, dy) {
  await page.mouse.move(W / 2, H / 2);
  await page.mouse.down();
  await page.mouse.move(W / 2 + dx, H / 2 + dy, { steps: 3 });
  await page.mouse.up();
}

async function writeSheet(s, row, urls, res) {
  const esc = (x) => String(x).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const m = row;
  const first = row.meta[0], last = row.meta[row.meta.length - 1];
  const line1 = `<b>${esc(s.id)}</b>: ${esc(s.what)}. ${s.frames} consecutive frames, one step of 1/${opt.hz} s each, ${esc(label)}, ${W}x${H}, quality ${opt.quality}.`
    + ` Clock ${first.t} to ${last.t} s; camera turned ${m.camera.turnDeg} degrees (${m.camera.degPerSecond} a second), moved ${m.camera.moved} m (${m.camera.metresPerSecond} m/s); triangles ${Math.round(m.tris.min / 1000)} k to ${Math.round(m.tris.max / 1000)} k.`
    + (row.note.length ? ' ' + esc(row.note.join('; ')) + '.' : '');
  const line2 = `Change between consecutive frames: mean ${m.change.mean} %, worst pair ${m.change.max} % (frames ${m.change.worstPair} to ${m.change.worstPair + 1}); pixels changing by more than 3 %: ${m.change.pixels3} % on average; picture that never changes by 0.5 %: ${m.change.stillShare} %.`
    + ` After following the motion: residual ${m.residual.mean} % mean, ${m.residual.p99} % at the 99th block in a hundred; block mean luminance changes ${m.blockMean.p99} % (99th), ${m.blockMean.max} % at most, ${m.blockMean.over3} of ${m.blockMean.of} over 3 %.`
    + ` Pops: ${m.pops.blocks} blocks in ${m.pops.pairs} of ${s.frames - 1} pairs.`
    + (m.stuck ? ` Detail three frames apart (shift ${m.stuck.shiftPx} px on screen): broad detail matches ${m.stuck.broad.world} with the world, ${m.stuck.broad.screen} on the screen, ${m.stuck.broad.chance} by chance; fine detail ${m.stuck.fine.world}, ${m.stuck.fine.screen}, ${m.stuck.fine.chance}.` : '');
  const big = (u, cap) => `<figure><img src="${u}" style="width:632px"><figcaption>${cap}</figcaption></figure>`;
  const Z = 2, C = 128;
  const crop = (u, x, y) => `<div style="width:${C * Z}px;height:${C * Z}px;background:url(${u}) ${-x * Z}px ${-y * Z}px / ${W * Z}px ${H * Z}px no-repeat;display:inline-block"></div>`;
  const pops = row.pops.slice(0, 6).map((p) => {
    const x = Math.max(0, Math.min(W - C, p.x + 16 - C / 2)), y = Math.max(0, Math.min(H - C, p.y + 16 - C / 2));
    return `<figure style="display:inline-block;margin:0 6px 6px 0">${crop(urls[p.pair], x, y)}${crop(urls[p.pair + 1], x, y)}<figcaption>frames ${p.pair} and ${p.pair + 1} at (${p.x}, ${p.y}): ${p.blocks} blocks, residual ${p.residual} % (its median ${p.median} %), triangles ${p.dTris >= 0 ? '+' : ''}${p.dTris}</figcaption></figure>`;
  }).join('');
  const html = `<body style="margin:0;background:#f4efe4;font:italic 14px Georgia,serif;color:#2c3350;width:1290px"><header>${line1}<br>${line2}</header>`
    + `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px">`
    + big(urls[0], 'the first frame') + big(urls[urls.length - 1], 'the last frame')
    + big(res.changeMap, 'mean change between consecutive frames, times ten (white: 10 % of full scale)') + big(res.worstDiff, `the largest single change, frames ${m.change.worstPair} to ${m.change.worstPair + 1}, times eight`)
    + `</div><div style="padding:0 8px 8px">${pops || 'no pops'}</div>`
    + `<style>header{padding:10px 10px 0;font-size:15px}figure{margin:0}img{display:block}figcaption{padding:2px 2px 6px;font-size:12px}</style></body>`;
  const out = path.join(sheets, `motion-${s.id}.jpg`);
  const sheet = await browser.newPage({ viewport: { width: 1290, height: 200 }, deviceScaleFactor: 1 });
  await sheet.setContent(html);
  await sheet.screenshot({ path: out, type: 'jpeg', quality: 80, fullPage: true });
  await sheet.close();
  log('  wrote', out);
}

// Runs in the page: keeps the frames and measures them.
function installInPage([FW, FH]) {
  const gl = document.getElementById('pc-canvas');
  const aw = FW >> 1, ah = FH >> 1, N = aw * ah;
  const full = document.createElement('canvas'); full.width = FW; full.height = FH;
  const fx = full.getContext('2d', { willReadFrequently: true });
  const half = document.createElement('canvas'); half.width = aw; half.height = ah;
  const hx = half.getContext('2d', { willReadFrequently: true });
  hx.imageSmoothingQuality = 'high';
  const M = { frames: [] };
  M.reset = () => { M.frames = []; };
  // Call right after a frame is painted: the picture is still in the canvas.
  M.grab = () => {
    fx.drawImage(gl, 0, 0, FW, FH);
    hx.drawImage(full, 0, 0, aw, ah);
    const d = hx.getImageData(0, 0, aw, ah).data, L = new Float32Array(N);
    for (let i = 0, j = 0; i < N; i++, j += 4) L[i] = (0.2126 * d[j] + 0.7152 * d[j + 1] + 0.0722 * d[j + 2]) / 255;
    const pc = window.__pc, sim = pc.sim, st = pc.game.stats, e = pc.camera.matrixWorld.elements;
    const onFoot = sim.sm.state === 'ON_FOOT', p = onFoot ? sim.ex.p : sim.sh.p;
    M.frames.push({
      L, url: full.toDataURL('image/jpeg', 0.9),
      meta: { t: +sim.t.toFixed(3), state: sim.sm.state, tris: st.tris, calls: st.calls, busy: pc.world.busy == null ? null : pc.world.busy, dir: [-e[8], -e[9], -e[10]], p: [p.x, p.y, p.z], speed: onFoot ? sim.ex.speed : sim.sh.speed },
    });
    return M.frames.length;
  };
  const boxBlur = (src, r) => {
    const tmp = new Float32Array(N), out = new Float32Array(N), k = 1 / (2 * r + 1);
    for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) { let s = 0; for (let i = -r; i <= r; i++) s += src[y * aw + Math.max(0, Math.min(aw - 1, x + i))]; tmp[y * aw + x] = s * k; }
    for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) { let s = 0; for (let i = -r; i <= r; i++) s += tmp[Math.max(0, Math.min(ah - 1, y + i)) * aw + x]; out[y * aw + x] = s * k; }
    return out;
  };
  const soft = (src, r) => boxBlur(boxBlur(src, r), r);
  // Normalised correlation of A against B moved by (dx, dy), over a region that every shift keeps.
  const MX = 44, MY = 8;
  const corr = (A, B, dx, dy, stepPx = 1) => {
    let ab = 0, aa = 0, bb = 0;
    for (let y = MY; y < ah - MY; y += stepPx) for (let x = MX; x < aw - MX; x += stepPx) { const a = A[y * aw + x], b = B[(y + dy) * aw + x + dx]; ab += a * b; aa += a * a; bb += b * b; }
    return ab / (Math.sqrt(aa * bb) || 1);
  };
  const r2 = (x) => Math.round(x * 100) / 100, r3 = (x) => Math.round(x * 1000) / 1000;
  const pct = (arr, q) => { const a = Array.from(arr).sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor(q * a.length))] : 0; };
  const toUrl = (vals, gain) => {
    const img = hx.createImageData(aw, ah);
    for (let i = 0, j = 0; i < N; i++, j += 4) { const v = Math.min(255, vals[i] * gain * 255); img.data[j] = img.data[j + 1] = img.data[j + 2] = v; img.data[j + 3] = 255; }
    hx.putImageData(img, 0, 0);
    return half.toDataURL('image/jpeg', 0.85);
  };

  M.analyse = (o = {}) => {
    const F = M.frames, n = F.length, B = 16, S = 8, bw = Math.floor(aw / B), bh = Math.floor(ah / B), nb = bw * bh;
    const meanChange = new Float32Array(N), everMax = new Float32Array(N);
    const pairs = [], resid = [], allResid = [], allDm = [];
    let worst = -1, worstPair = 0;
    for (let k = 0; k + 1 < n; k++) {
      const a = F[k].L, b = F[k + 1].L;
      let sum = 0, ch = 0;
      const band = [0, 0, 0];
      for (let i = 0; i < N; i++) { const d = Math.abs(b[i] - a[i]); sum += d; if (d > 0.03) ch++; meanChange[i] += d; if (d > everMax[i]) everMax[i] = d; band[Math.min(2, Math.floor((i / aw) / (ah / 3)))] += d; }
      const r = new Float32Array(nb), sx = [], sy = [];
      let over3 = 0, dmMax = 0;
      for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
        const x0 = bx * B, y0 = by * B;
        let zero = 0, ma = 0;
        for (let y = 0; y < B; y++) { const ia = (y0 + y) * aw + x0; for (let x = 0; x < B; x++) { zero += Math.abs(b[ia + x] - a[ia + x]); ma += a[ia + x]; } }
        ma /= B * B;
        let tex = 0;
        for (let y = 0; y < B; y++) { const ia = (y0 + y) * aw + x0; for (let x = 0; x < B; x++) tex += Math.abs(a[ia + x] - ma); }
        tex /= B * B;
        let best = zero, bdx = 0, bdy = 0;
        for (let dy = -S; dy <= S; dy++) {
          const y1 = y0 + dy; if (y1 < 0 || y1 + B > ah) continue;
          for (let dx = -S; dx <= S; dx++) {
            const x1 = x0 + dx; if (x1 < 0 || x1 + B > aw || (dx === 0 && dy === 0)) continue;
            let sad = 0;
            const lim = best * 0.97;                 // a near tie stays with "did not move"
            for (let y = 0; y < B && sad < lim; y++) { const ia = (y0 + y) * aw + x0, ib = (y1 + y) * aw + x1; for (let x = 0; x < B; x++) sad += Math.abs(b[ib + x] - a[ia + x]); }
            if (sad < lim) { best = sad; bdx = dx; bdy = dy; }
          }
        }
        let mb = 0;
        for (let y = 0; y < B; y++) { const ib = (y0 + bdy + y) * aw + x0 + bdx; for (let x = 0; x < B; x++) mb += b[ib + x]; }
        mb /= B * B;
        const bi = by * bw + bx, dm = Math.abs(mb - ma);
        r[bi] = best / (B * B);
        allResid.push(r[bi]); allDm.push(dm);
        if (dm > 0.03) over3++;
        if (dm > dmMax) dmMax = dm;
        if (tex > 0.02) { sx.push(bdx); sy.push(bdy); }
      }
      resid.push(r);
      const mad = sum / N;
      if (mad > worst) { worst = mad; worstPair = k; }
      const A = F[k].meta, Bm = F[k + 1].meta;
      const dot = Math.max(-1, Math.min(1, A.dir[0] * Bm.dir[0] + A.dir[1] * Bm.dir[1] + A.dir[2] * Bm.dir[2]));
      pairs.push({
        change: r3(mad * 100), pixels3: r2((ch / N) * 100), top: r3((band[0] / (N / 3)) * 100), middle: r3((band[1] / (N / 3)) * 100), bottom: r3((band[2] / (N / 3)) * 100),
        residual: r3((r.reduce((s, v) => s + v, 0) / nb) * 100), blockMeanMax: r2(dmMax * 100), over3,
        shift: [sx.length ? pct(sx, 0.5) * 2 : 0, sy.length ? pct(sy, 0.5) * 2 : 0],
        turnDeg: r3((Math.acos(dot) * 180) / Math.PI), moved: r3(Math.hypot(Bm.p[0] - A.p[0], Bm.p[1] - A.p[1], Bm.p[2] - A.p[2])), dTris: Bm.tris - A.tris, busy: Bm.busy,
      });
    }
    // Pops: a block far above its own usual residual, in one pair of frames.
    const med = new Float32Array(nb);
    for (let bi = 0; bi < nb; bi++) med[bi] = pct(resid.map((r) => r[bi]), 0.5);
    const hits = [];
    let popBlocks = 0;
    const popPairs = new Set();
    for (let k = 0; k < resid.length; k++) for (let bi = 0; bi < nb; bi++) {
      const v = resid[k][bi];
      if (v > 0.04 && v > 3 * med[bi] + 0.02) { hits.push({ k, bx: bi % bw, by: Math.floor(bi / bw), v, m: med[bi] }); popBlocks++; popPairs.add(k); }
    }
    hits.sort((p, q) => (q.v - q.m) - (p.v - p.m));
    const pops = [];
    for (const h of hits) {
      const near = pops.find((p) => p.pair === h.k && Math.abs(p.bx - h.bx) <= 3 && Math.abs(p.by - h.by) <= 3);
      if (near) { near.blocks++; continue; }
      if (pops.length < 12) pops.push({ pair: h.k, bx: h.bx, by: h.by, x: h.bx * B * 2, y: h.by * B * 2, blocks: 1, residual: r2(h.v * 100), median: r2(h.m * 100), dTris: pairs[h.k].dTris });
    }
    let still = 0;
    for (let i = 0; i < N; i++) if (everMax[i] < 0.005) still++;
    const mean = (f) => pairs.reduce((s, p) => s + f(p), 0) / (pairs.length || 1);
    const m0 = F[0].meta, m1 = F[n - 1].meta, secs = m1.t - m0.t;
    const turn = pairs.reduce((s, p) => s + p.turnDeg, 0), moved = pairs.reduce((s, p) => s + p.moved, 0);
    const tris = F.map((f) => f.meta.tris);
    const summary = {
      change: { mean: r3(mean((p) => p.change)), max: r3(worst * 100), worstPair, pixels3: r2(mean((p) => p.pixels3)), stillShare: r2((still / N) * 100), top: r3(mean((p) => p.top)), middle: r3(mean((p) => p.middle)), bottom: r3(mean((p) => p.bottom)), pairsOverHalf: pairs.filter((p) => p.change > 0.5).length },
      residual: { mean: r3(mean((p) => p.residual)), p99: r3(pct(allResid, 0.99) * 100) },
      blockMean: { p99: r2(pct(allDm, 0.99) * 100), max: r2(Math.max(0, ...allDm) * 100), over3: allDm.filter((v) => v > 0.03).length, of: allDm.length },
      pops: { blocks: popBlocks, pairs: popPairs.size },
      camera: { turnDeg: r2(turn), degPerSecond: secs ? r2(turn / secs) : 0, moved: r2(moved), metresPerSecond: secs ? r2(moved / secs) : 0 },
      tris: { min: Math.min(...tris), max: Math.max(...tris), jumps: pairs.filter((p) => Math.abs(p.dTris) > 2000).length },
    };
    if (o.stuck && n > 6) {
      // Fine detail: what a 3 px blur takes away. Broad detail: between a 3 px and an 11 px blur.
      const lag = 3, picks = [];
      for (let k = 1; k + lag < n; k += Math.max(1, Math.floor((n - lag) / 6))) picks.push(k);
      const acc = { shift: [], fw: [], fs: [], fc: [], bw: [], bs: [], bc: [] };
      for (const k of picks) {
        const a = F[k].L, b = F[k + lag].L, a1 = soft(a, 1), b1 = soft(b, 1), a5 = soft(a, 5), b5 = soft(b, 5);
        const fa = new Float32Array(N), fb = new Float32Array(N), ca = new Float32Array(N), cb = new Float32Array(N);
        for (let i = 0; i < N; i++) { fa[i] = a[i] - a1[i]; fb[i] = b[i] - b1[i]; ca[i] = a1[i] - a5[i]; cb[i] = b1[i] - b5[i]; }
        let best = -2, gx = 0, gy = 0;
        for (let dy = -6; dy <= 6; dy++) for (let dx = -40; dx <= 40; dx++) { const c = corr(ca, cb, dx, dy, 2); if (c > best) { best = c; gx = dx; gy = dy; } }
        let fbest = -2;
        for (let dy = gy - 1; dy <= gy + 1; dy++) for (let dx = gx - 1; dx <= gx + 1; dx++) { if (Math.abs(dy) > MY || Math.abs(dx) > MX) continue; const c = corr(fa, fb, dx, dy); if (c > fbest) fbest = c; }
        acc.shift.push(Math.hypot(gx, gy) * 2);
        acc.bw.push(corr(ca, cb, gx, gy)); acc.bs.push(corr(ca, cb, 0, 0)); acc.bc.push(corr(ca, ca, gx, gy));
        acc.fw.push(fbest); acc.fs.push(corr(fa, fb, 0, 0)); acc.fc.push(corr(fa, fa, gx, gy));
      }
      const av = (x) => r2(x.reduce((s, v) => s + v, 0) / (x.length || 1));
      summary.stuck = { lagFrames: lag, pairs: picks.length, shiftPx: av(acc.shift), broad: { world: av(acc.bw), screen: av(acc.bs), chance: av(acc.bc) }, fine: { world: av(acc.fw), screen: av(acc.fs), chance: av(acc.fc) } };
    }
    for (let i = 0; i < N; i++) meanChange[i] /= pairs.length || 1;
    const wd = new Float32Array(N), wa = F[worstPair].L, wb = F[Math.min(n - 1, worstPair + 1)].L;
    for (let i = 0; i < N; i++) wd[i] = Math.abs(wb[i] - wa[i]);
    return { summary, pairs, pops, meta: F.map((f) => ({ t: f.meta.t, state: f.meta.state, tris: f.meta.tris, calls: f.meta.calls, busy: f.meta.busy, speed: r2(f.meta.speed || 0) })), changeMap: toUrl(meanChange, 10), worstDiff: toUrl(wd, 8) };
  };
  window.__motion = M;
}
