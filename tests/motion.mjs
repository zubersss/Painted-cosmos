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
//   landing       the last two metres of a landing (the ship's height at every frame is kept).
//   fill          an arrival: the first frames at a place nobody has painted yet.
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
//   stuck         (turn only) fine and broad detail of frame n against frame n+5: how well it
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
import { installInPage } from './motionlib.mjs';

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
  { id: 'landing', what: 'the last two metres of a landing at the Earth spawn (E pressed in a hover 8 m up)', place: 'spawn', t: 30, frames: 90, ship: { altitude: 8, speed: 0, throttle: 0 }, land: 2.2 },
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
// One frame of exactly DT and its picture, in one task: between two tasks the browser may
// present the canvas and clear it (the first trial's first frames came back black).
const stepGrab = () => page.evaluate((dt) => { window.__pc.step(dt, 1); return window.__motion.grab(); }, DT);
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
    if (s.land) {
      // E in a hover; the frames begin when the gear is `land` metres over the ground. Every
      // frame's height is in motion.json (meta[].alt): a descent that stalls shows there.
      await step(15);
      await page.keyboard.press('KeyE');
      let i = null;
      for (let n = 0; n < 150; n++) { await step(6); i = await info(); if (i.state === 'LANDED' || (i.state === 'LANDING' && i.ship.altGround < s.land)) break; }
      note.push(`the frames begin in ${i.state}${i.ship.landing ? ' (' + i.ship.landing + ')' : ''}, ${i.ship.altGround.toFixed(2)} m over the ground` + (i.notice ? `; the screen said "${i.notice}"` : ''));
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
      await stepGrab();
    }
    if (s.mouse) await page.mouse.up();
    for (const k of s.keys || []) await page.keyboard.up(k);
    if (s.pulse) { await page.keyboard.press('KeyF'); await step(2); }

    const res = await page.evaluate((o) => window.__motion.analyse(o), { stuck: !!s.stuck });
    const urls = await page.evaluate(() => window.__motion.frames.map((f) => f.url));
    const dir = path.join(opt.out, s.id);
    fs.mkdirSync(dir, { recursive: true });
    urls.forEach((u, i) => fs.writeFileSync(path.join(dir, `f${String(i).padStart(2, '0')}.jpg`), Buffer.from(u.split(',')[1], 'base64')));
    const row = { id: s.id, what: s.what, label, frames: s.frames, settledSeconds: settled, settledFrames: st.frames, seconds: 0, note, ...res.summary, pairs: res.pairs, popList: res.pops, meta: res.meta };
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
    + (m.stuck ? ` Detail ${m.stuck.lagFrames} frames apart (shift ${m.stuck.shiftPx} px on screen): broad detail matches ${m.stuck.broad.world} with the world, ${m.stuck.broad.screen} on the screen, ${m.stuck.broad.chance} by chance; fine detail ${m.stuck.fine.world}, ${m.stuck.fine.screen}, ${m.stuck.fine.chance}.` : '');
  const big = (u, cap) => `<figure><img src="${u}" style="width:632px"><figcaption>${cap}</figcaption></figure>`;
  const Z = 2, C = 128;
  const crop = (u, x, y) => `<div style="width:${C * Z}px;height:${C * Z}px;background:url(${u}) ${-x * Z}px ${-y * Z}px / ${W * Z}px ${H * Z}px no-repeat;display:inline-block"></div>`;
  const pops = row.popList.slice(0, 6).map((p) => {
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
