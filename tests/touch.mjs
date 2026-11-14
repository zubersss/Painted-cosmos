// Touch, in a browser (W3.1 and W3.2 of the sharp-smooth plan): headless Chromium under
// Playwright's phone and tablet profiles (an iOS or Android user agent, a coarse pointer, touch
// points, the device's pixel ratio), fingers put down with CDP's Input.dispatchTouchEvent, as
// many at once as a hand has. Not iOS Safari, not a real phone: what a finger does to the game.
//
//   node tests/touch.mjs                      --part input on the three profiles (stubs, PHYSICS on)
//   node tests/touch.mjs --part input --devices iphone14,pixel7,ipadpro11
//   node tests/touch.mjs --part loop          the whole loop by touch only (iPhone 14, stubs)
//   node tests/touch.mjs --part loop --painted  the same in the painted world at q0, 400x225
//   node tests/touch.mjs --part all           input, then the loop on stubs (tests/all.mjs step 'touch')
//   [--root DIR] [--out DIR] [--query "..."] [--keep]
//
// part input (W3.1's acceptance): a tap starts the game with no compatibility mouse event and
// no pointer lock; a 120 px drag turns the view 30 degrees or more with no pointercancel; the
// stick held 2.5 s walks 5 m or more; JUMP jumps 0.5 m or more, held 2 s the jetpack climbs 5 m
// or more; the stick and the look work together; a pinch moves the camera and leaves the page
// unzoomed (visualViewport.scale 1); in the ship a drag pitches the nose, stick X turns it and
// stick Y moves the throttle. And a desktop page (1280x720, no touch): no touch layer, the
// mouse's pointer lock as before.
// part loop (W3.2's acceptance): the whole loop by touch only: walk to the ship (the stick,
// steered by a second finger's look), board, lift off, climb above the air, the map, Mars, set
// course, pulse, descend, land and step out by the prompt slips, the tabs and the stick; the
// map, the book and the help card opened by their tabs and closed by their corners and by a tap
// outside; the book's pages turned by a swipe; the VIEW tab; the fade after 4 s. At each stage
// every control's hit area is measured (44 css px or more), and on a phone profile no control
// may lie in the subject box (x 30-70 %, y 55-100 %) while the picture is played.
// Every run fails on a console error, a page error, a failed or external request, or a real
// module that fell back to its stub.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { GL_ARGS } from '../tools/shot.mjs';
import { startServer } from '../tools/serve.mjs';
import { fallbackProblem } from './browser.mjs';
import { TOUCH, LOOK_GAIN } from '../src/core/touch.js';
import { namesAKey } from '../src/core/words.js';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (n) => argv.includes('--' + n);
const val = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const DEVICES = { iphone14: 'iPhone 14 landscape', pixel7: 'Pixel 7 landscape', ipadpro11: 'iPad Pro 11 landscape' };
const part = val('part', 'input');
const root = path.resolve(val('root', repo));
const out = path.resolve(val('out', '/home/user/.pc-scratch/pilot/touch'));
fs.mkdirSync(out, { recursive: true });
const DEG = 180 / Math.PI;
const t0 = Date.now();
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const fails = [];
const check = (ok, msg) => { if (!ok) { fails.push(msg); log('  FAIL:', msg); } else log('  ok:', msg); return ok; };

// Counts every input event the page sees (capture phase, before the game's handlers).
const COUNTER = `(() => {
  const c = window.__evc = {};
  for (const t of ['pointerdown','pointerup','pointercancel','mousedown','mouseup','mousemove','click','dblclick','contextmenu','touchstart','touchend','touchcancel','gesturestart','keydown'])
    document.addEventListener(t, (e) => { const k = t + (e.pointerType ? ':' + e.pointerType : ''); c[k] = (c[k] || 0) + 1; }, { capture: true, passive: true });
})();`;

async function open(deviceName, query, override = {}) {
  const srv = await startServer(0, root);
  const browser = await pw.chromium.launch({ args: GL_ARGS });
  const dev = deviceName === 'desktop' ? { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, ...override }
    : { ...pw.devices[DEVICES[deviceName] || deviceName], ...override };
  delete dev.defaultBrowserType;
  const ctx = await browser.newContext(dev);
  await ctx.addInitScript(COUNTER);
  const page = await ctx.newPage();
  page.setDefaultTimeout(1800000);
  const problems = [];
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console.error: ' + m.text()); });
  page.on('pageerror', (e) => problems.push('pageerror: ' + (e.stack || e.message)));
  page.on('requestfailed', (r) => problems.push('requestfailed: ' + r.url() + ' ' + (r.failure()?.errorText || '')));
  page.on('response', (r) => { if (r.status() >= 400) problems.push('http ' + r.status() + ': ' + r.url()); });
  page.on('request', (r) => { if (!r.url().startsWith(srv.url) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) problems.push('EXTERNAL REQUEST: ' + r.url()); });
  await page.goto(srv.url + '/index.html?' + query);
  await page.waitForFunction('window.__pcReady === true', null, { timeout: 1800000, polling: 300 });
  const cdp = await ctx.newCDPSession(page);
  const fingers = new Fingers(cdp);
  const info = () => page.evaluate(() => window.__pc.info());
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function gameWait(seconds) {
    const g0 = (await info()).t, w0 = Date.now();
    while ((await info()).t - g0 < seconds && Date.now() - w0 < seconds * 40000 + 20000) await sleep(40);
  }
  async function until(pred, seconds, steer, tickMs = 90) {
    let i = await info();
    const g0 = i.t, w0 = Date.now();
    while (!pred(i)) {
      if (i.t - g0 > seconds || Date.now() - w0 > seconds * 40000 + 20000) return { ...i, timedOut: true };
      if (steer) await steer(i);
      await sleep(tickMs);
      i = await info();
    }
    return i;
  }
  const close = async () => { try { await browser.close(); } catch { /* gone */ } srv.server.close(); };
  const size = await page.evaluate(() => ({ w: innerWidth, h: innerHeight, dpr: devicePixelRatio, coarse: matchMedia('(pointer: coarse)').matches, touchPoints: navigator.maxTouchPoints }));
  return { page, cdp, fingers, info, sleep, gameWait, until, close, problems, size, query };
}

// Fingers on the glass. CDP releases the fingers a touchEnd names (and all of them with none).
// Every event carries the time the finger did it, as a phone's touch screen stamps it: CDP waits
// for the page to take each event before it returns, so a tap's lift sent 50 ms after its press
// would otherwise be stamped a whole slow frame later (a 1 to 4 s "tap" at the painted world's
// pace in software rendering) and read as a hold.
class Fingers {
  constructor(cdp) { this.cdp = cdp; this.on = new Map(); }
  pts() { return [...this.on.entries()].map(([id, p]) => ({ x: p.x, y: p.y, id, radiusX: 4, radiusY: 4, force: 1 })); }
  send(type, touchPoints, timestamp = Date.now() / 1000) { return this.cdp.send('Input.dispatchTouchEvent', { type, touchPoints, timestamp }); }
  async down(id, x, y, ts) { this.on.set(id, { x, y }); await this.send('touchStart', this.pts(), ts); }
  async move(id, x, y, ts) { this.on.set(id, { x, y }); await this.send('touchMove', this.pts(), ts); }
  async up(id, ts) { const p = this.on.get(id); if (!p) return; this.on.delete(id); await this.send('touchEnd', [{ x: p.x, y: p.y, id }], ts); }
  async drag(id, x0, y0, x1, y1, { steps = 12, stepMs = 30, lift = true } = {}) {
    await this.down(id, x0, y0);
    for (let i = 1; i <= steps; i++) { await this.move(id, x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps); await new Promise((r) => setTimeout(r, stepMs)); }
    if (lift) await this.up(id);
  }
  // a tap: down, and up 50 ms later by the finger's clock, however long the page took
  async tap(x, y, id = 90) { const t = Date.now() / 1000; await this.down(id, x, y, t); await new Promise((r) => setTimeout(r, 50)); await this.up(id, t + 0.05); }
}

// ---- readings off the page -------------------------------------------------------------------
const footYaw = (page) => page.evaluate(() => { const s = window.__pc.sim; return { f: { ...s.footCam.viewFwd }, p: { ...s.ex.p }, boom: s.footCam.boom }; });
const shipPose = (page) => page.evaluate(() => {
  const s = window.__pc.sim, q = s.sh.q, p = s.sh.p;
  // the nose: (0, 0, -1) turned by the hull's quaternion
  const v = { x: 0, y: 0, z: -1 };
  const ix = q.w * v.x + q.y * v.z - q.z * v.y, iy = q.w * v.y + q.z * v.x - q.x * v.z, iz = q.w * v.z + q.x * v.y - q.y * v.x, iw = -q.x * v.x - q.y * v.y - q.z * v.z;
  const f = { x: ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y, y: iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z, z: iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x };
  return { f, p: { ...p }, throttle: s.sh.throttle, pitchDeg: window.__pc.info().ship.pitchDeg, state: s.sm.state };
});
const norm = (v) => { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; };
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const flat = (v, up) => norm({ x: v.x - up.x * dot(v, up), y: v.y - up.y * dot(v, up), z: v.z - up.z * dot(v, up) });
// signed turn from a to b about up, degrees (+ right, as the game's look: dx > 0 turns right)
function turnDeg(a, b, upv) {
  const up = norm(upv), fa = flat(a, up), fb = flat(b, up);
  return Math.atan2(dot(cross(fb, fa), up), dot(fa, fb)) * DEG;
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
// Every lettered string on the HUD that is laid out (display and visibility; a faded slip still
// holds its words), with its cap height on the screen: data-size (the size it was lettered at)
// times the svg's scale on the screen. sheet: the sheet it lies on (map, book, card) or hud.
const lettering = (page) => page.evaluate(() => {
  const out = [];
  for (const svg of document.querySelectorAll('.pc-hud svg.pc-ink')) {
    const r = svg.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    let e = svg, shown = true;
    while (e && e.id !== 'pc-hud') { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') { shown = false; break; } e = e.parentElement; }
    if (!shown) continue;
    const d = svg.querySelector('desc');
    // (a lettering without data-size, before W3.3: its words, no size)
    out.push({ t: d ? d.textContent : '', size: svg.dataset.size ? +(+svg.dataset.size * r.height / +svg.getAttribute('height')).toFixed(2) : null,
      sheet: svg.closest('.pc-map') ? 'map' : svg.closest('.pc-book') ? 'book' : svg.closest('.pc-start') ? 'card' : 'hud' });
  }
  return out;
});
const rectOf = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height } : null; }, sel);

// ---- part input: W3.1's acceptance on one profile ------------------------------------------------
async function partInput(device) {
  log(`=== ${device}: touch input (W3.1) ===`);
  const q = val('query', 'stub=render,world,art') + '&dynres=0&fresh=1&save=0&body=earth&time=11';
  const r = await open(device, q);
  const { page, fingers, info, gameWait, sleep, size } = r;
  const W = size.w, H = size.h;
  const rec = { device, size };
  try {
    log(`  ${W}x${H} css at ${size.dpr}, coarse pointer ${size.coarse}, ${size.touchPoints} touch points`);
    const fb = await fallbackProblem(page, q);
    check(!fb, fb || 'the modules asked for are the real ones (PHYSICS on the stubs)');
    let s = await page.evaluate(() => ({ started: window.__pc.game.started, touch: window.__pc.game.hud.touchShown, card: window.__pc.game.hud.startShown }));
    check(s.card && !s.started, 'the title card waits for a first touch');
    check(s.touch, 'a phone or a tablet: the touch controls are up from the start (coarse pointer and touch points)');
    // W3.3: the title card lies inside the top edge, and its words name no key and no mouse
    await sleep(700);
    const card = await page.evaluate(() => { const q = document.querySelector('.pc-start').getBoundingClientRect(); return { top: +q.top.toFixed(1), bottom: +q.bottom.toFixed(1) }; });
    rec.titleCard = card;
    check(card.top >= 8, `W3.3: the title card's top ${card.top} css px from the top edge (at least 8; -13 on the iPhone before)`);
    const tw = (await lettering(page)).filter((x) => x.sheet === 'card');
    const keyed = tw.filter((x) => namesAKey(x.t));
    rec.titleWords = tw.map((x) => x.t);
    check(tw.length >= 3 && keyed.length === 0, `W3.3: the title card by touch names no key and no mouse: ${JSON.stringify(tw.map((x) => x.t))}`);
    // 1. a tap starts the game: no compatibility mouse events, no pointer lock
    await page.evaluate(() => { for (const k in window.__evc) delete window.__evc[k]; });
    await fingers.tap(W * 0.62, H * 0.42);
    await gameWait(0.4);
    s = await page.evaluate(() => ({ started: window.__pc.game.started, card: window.__pc.game.hud.startShown, ev: { ...window.__evc }, lock: !!document.pointerLockElement, req: window.__pc.game.input._req }));
    const compat = (s.ev.mousedown || 0) + (s.ev.mouseup || 0) + (s.ev.click || 0);
    rec.tap = s.ev;
    check(s.started && !s.card, 'a tap starts the game');
    check(compat === 0, `with 0 compatibility mouse events (mousedown ${s.ev.mousedown || 0}, mouseup ${s.ev.mouseup || 0}, click ${s.ev.click || 0}; pointerdown:touch ${s.ev['pointerdown:touch'] || 0})`);
    check(!s.lock && s.req === 0, `and no pointer lock asked for (requests ${s.req}, locked ${s.lock})`);
    // 2. a 120 px drag on the right turns the view
    let a = await footYaw(page);
    await page.evaluate(() => { for (const k in window.__evc) delete window.__evc[k]; });
    await fingers.drag(1, W * 0.75, H * 0.4, W * 0.75 - 120, H * 0.4, { steps: 12, stepMs: 35 });
    await gameWait(0.3);
    let b = await footYaw(page);
    const turned = -turnDeg(a.f, b.f, a.p);
    const ev = await page.evaluate(() => ({ ...window.__evc }));
    rec.look = { deg: +turned.toFixed(2), cancel: ev['pointercancel:touch'] || 0 };
    check(Math.abs(turned) >= 30, `a 120 px drag turned the view ${turned.toFixed(1)} degrees (at least 30)`);
    check(!(ev['pointercancel:touch'] || 0) && !(ev.pointercancel || 0), `with 0 pointercancel events (${ev['pointercancel:touch'] || 0})`);
    // 3. the stick held 2.5 s walks
    const look = await info();
    check(look.state === 'ON_FOOT', 'on foot');
    const p0 = (await info()).explorer.p;
    await fingers.down(2, W * 0.16, H * 0.72);
    await fingers.move(2, W * 0.16, H * 0.72 - 25);
    await fingers.move(2, W * 0.16, H * 0.72 - 40);
    const g0 = (await info()).t;
    let vmax = 0;
    while ((await info()).t - g0 < 2.5) { await fingers.move(2, W * 0.16, H * 0.72 - 40); vmax = Math.max(vmax, (await info()).explorer.speed); await sleep(60); }
    await fingers.up(2);
    const i3 = await info();
    const walked = dist(p0, i3.explorer.p);
    rec.walk = { m: +walked.toFixed(2), vmax: +vmax.toFixed(2), gameS: +(i3.t - g0).toFixed(2) };
    check(walked >= 5, `the stick held ${(i3.t - g0).toFixed(1)} s (game time) walked ${walked.toFixed(1)} m (at least 5; top speed ${vmax.toFixed(2)} m/s)`);
    // run: at the rim for a quarter second
    await fingers.down(2, W * 0.16, H * 0.72);
    await fingers.move(2, W * 0.16, H * 0.72 - 70);
    const g1 = (await info()).t;
    let vrun = 0;
    while ((await info()).t - g1 < 2) { await fingers.move(2, W * 0.16, H * 0.72 - 70); vrun = Math.max(vrun, (await info()).explorer.speed); await sleep(60); }
    await fingers.up(2);
    rec.run = { vmax: +vrun.toFixed(2) };
    check(vrun > vmax + 1, `held at the rim it runs: ${vrun.toFixed(2)} m/s against ${vmax.toFixed(2)} walking`);
    await gameWait(1);
    // 4. JUMP: a tap jumps, a hold is the jetpack
    const jb = await rectOf(page, '.pc-tbtn-jump');
    check(!!jb && jb.w >= 44 && jb.h >= 44, 'the JUMP button is up: ' + JSON.stringify(jb));
    await page.evaluate(() => {
      const st = window.__jr = { max: 0, on: true };
      const f = () => { if (!st.on) return; const e = window.__pc.info().explorer; st.max = Math.max(st.max, e.altitude || 0); requestAnimationFrame(f); };
      f();
    });
    await fingers.tap(jb.x, jb.y);
    await gameWait(1.6);
    const jump = await page.evaluate(() => { window.__jr.on = false; return window.__jr.max; });
    rec.jump = +jump.toFixed(2);
    check(jump >= 0.5, `a tap on JUMP jumped ${jump.toFixed(2)} m (at least 0.5)`);
    await gameWait(1.2);
    await page.evaluate(() => { window.__jr = { max: 0, on: true }; const st = window.__jr; const f = () => { if (!st.on) return; st.max = Math.max(st.max, window.__pc.info().explorer.altitude || 0); requestAnimationFrame(f); }; f(); });
    await fingers.down(3, jb.x, jb.y);
    const g2 = (await info()).t;
    while ((await info()).t - g2 < 2) { await fingers.move(3, jb.x, jb.y); await sleep(60); }
    await fingers.up(3);
    await gameWait(0.3);
    const jet = await page.evaluate(() => { window.__jr.on = false; return window.__jr.max; });
    rec.jet = +jet.toFixed(2);
    check(jet >= 5, `JUMP held 2 s: the jetpack climbed ${jet.toFixed(1)} m (at least 5)`);
    await until(r, (x) => x.explorer.grounded, 20);
    await gameWait(1.5);
    // 5. stick and look together
    a = await footYaw(page);
    const p5 = (await info()).explorer.p;
    await fingers.down(4, W * 0.16, H * 0.72);
    await fingers.down(5, W * 0.72, H * 0.4);
    for (let k = 1; k <= 14; k++) {
      await fingers.move(4, W * 0.16, H * 0.72 - 40);
      await fingers.move(5, W * 0.72 + k * 6, H * 0.4);
      await sleep(80);
    }
    await gameWait(0.8);
    await fingers.move(4, W * 0.16, H * 0.72 - 40);
    await gameWait(0.6);
    await fingers.up(5); await fingers.up(4);
    b = await footYaw(page);
    const i5 = await info();
    const both = { m: dist(p5, i5.explorer.p), deg: -turnDeg(a.f, b.f, a.p) };
    rec.together = { m: +both.m.toFixed(2), deg: +both.deg.toFixed(1) };
    check(both.m > 2 && Math.abs(both.deg) > 10, `stick and look at once: walked ${both.m.toFixed(1)} m and turned ${both.deg.toFixed(1)} degrees`);
    // 6. a pinch moves the camera boom; the page does not zoom
    const boom0 = (await footYaw(page)).boom;
    await fingers.down(6, W * 0.62, H * 0.45);
    await fingers.down(7, W * 0.82, H * 0.45);
    for (let k = 1; k <= 10; k++) { await fingers.move(6, W * 0.62 + k * 4, H * 0.45); await fingers.move(7, W * 0.82 - k * 4, H * 0.45); await sleep(40); }
    await fingers.up(7); await fingers.up(6);
    await gameWait(0.4);
    const pin = await page.evaluate(() => ({ scale: window.visualViewport ? window.visualViewport.scale : 1, boom: window.__pc.sim.footCam.boom }));
    rec.pinch = { scale: pin.scale, boom0: +boom0.toFixed(2), boom: +pin.boom.toFixed(2) };
    check(pin.scale === 1, `a pinch leaves the page unzoomed: visualViewport.scale ${pin.scale}`);
    check(pin.boom > boom0 + 0.5, `and moves the camera: fingers together, the boom ${boom0.toFixed(2)} -> ${pin.boom.toFixed(2)} m`);
    // 7. in the ship: a drag pitches the nose, stick X turns, stick Y is the throttle
    await page.evaluate(() => window.__pc.teleport({ ship: true, altitude: 160, heading: 30 }));
    await gameWait(1.5);
    let sp = await shipPose(page);
    check(sp.state === 'ATMOSPHERE', 'in the ship, flying at 160 m');
    const pitch0 = sp.pitchDeg;
    await fingers.drag(8, W * 0.75, H * 0.5, W * 0.75, H * 0.5 - 90, { steps: 10, stepMs: 35 });
    await gameWait(1.2);
    sp = await shipPose(page);
    rec.shipPitch = { from: +pitch0.toFixed(1), to: +sp.pitchDeg.toFixed(1) };
    check(sp.pitchDeg - pitch0 > 5, `a drag up the right side lifted the nose ${pitch0.toFixed(1)} -> ${sp.pitchDeg.toFixed(1)} degrees`);
    await fingers.drag(8, W * 0.75, H * 0.4, W * 0.75, H * 0.4 + 90, { steps: 10, stepMs: 35 });
    await gameWait(1.2);
    let s0 = await shipPose(page);
    await fingers.down(9, W * 0.16, H * 0.62);
    await fingers.move(9, W * 0.16 + 60, H * 0.62);
    const g3 = (await info()).t;
    while ((await info()).t - g3 < 1.5) { await fingers.move(9, W * 0.16 + 60, H * 0.62); await sleep(60); }
    await fingers.up(9);
    let s1 = await shipPose(page);
    const yaw = turnDeg(s0.f, s1.f, s0.p);
    rec.shipYaw = +yaw.toFixed(1);
    check(yaw > 5, `stick to the right turned the ship ${yaw.toFixed(1)} degrees right`);
    s0 = await shipPose(page);
    await fingers.down(10, W * 0.16, H * 0.62);
    await fingers.move(10, W * 0.16, H * 0.62 - 60);
    const g4 = (await info()).t;
    while ((await info()).t - g4 < 1) { await fingers.move(10, W * 0.16, H * 0.62 - 60); await sleep(60); }
    await fingers.up(10);
    s1 = await shipPose(page);
    rec.throttle = { from: +s0.throttle.toFixed(2), to: +s1.throttle.toFixed(2) };
    check(s1.throttle > s0.throttle + 0.3, `stick up opened the throttle ${s0.throttle.toFixed(2)} -> ${s1.throttle.toFixed(2)}`);
    const lk = await page.evaluate(() => ({ lock: !!document.pointerLockElement, req: window.__pc.game.input._req, ev: { ...window.__evc } }));
    check(!lk.lock && lk.req === 0, `no pointer lock was asked for in the whole run (requests ${lk.req})`);
    if (flag('keep') || device === 'iphone14') await page.screenshot({ path: path.join(out, `input-${device}.jpg`), type: 'jpeg', quality: 85, timeout: 300000 });
  } catch (e) {
    fails.push(`${device}: exception: ` + (e && e.stack ? e.stack : e));
  }
  await r.close();
  check(r.problems.length === 0, `${device}: no console errors, page errors, failed or external requests` + (r.problems.length ? ': ' + [...new Set(r.problems)].slice(0, 5).join(' | ') : ''));
  return rec;
}

function until(r, pred, s) { return r.until(pred, s); }

// ---- the desktop: no touch layer, the mouse as before ---------------------------------------------
async function partDesktop() {
  log('=== desktop 1280x720 (no touch): the touch layer stays away ===');
  const q = val('query', 'stub=render,world,art') + '&dynres=0&fresh=1&save=0&body=earth&time=11';
  const r = await open('desktop', q);
  const { page, gameWait, size } = r;
  const rec = { device: 'desktop', size };
  try {
    check(!size.coarse && !size.touchPoints, `a desktop page: fine pointer, ${size.touchPoints} touch points`);
    await page.mouse.click(size.w / 2, size.h / 2);
    await gameWait(0.4);
    const s = await page.evaluate(() => {
      const ui = document.querySelector('.pc-touchui'), b = document.querySelector('.pc-tbtn-jump').getBoundingClientRect();
      return { started: window.__pc.game.started, shown: window.__pc.game.hud.touchShown, padShown: window.__pc.touch.shown, display: getComputedStyle(ui).display, jump: b.width, req: window.__pc.game.input._req, root: document.getElementById('pc-hud').className };
    });
    rec.state = s;
    check(s.started, 'a click starts the game');
    check(!s.shown && !s.padShown && s.display === 'none' && s.jump === 0, `no touch layer: hud ${s.shown}, pad ${s.padShown}, display ${s.display}, JUMP ${s.jump} px wide (root "${s.root}")`);
    check(s.req === 1, `the click asked for pointer lock, as before (requests ${s.req})`);
  } catch (e) { fails.push('desktop: exception: ' + (e && e.stack ? e.stack : e)); }
  await r.close();
  check(r.problems.length === 0, 'desktop: no console errors, page errors, failed or external requests' + (r.problems.length ? ': ' + [...new Set(r.problems)].slice(0, 5).join(' | ') : ''));
  return rec;
}

// ---- part loop: W3.2's acceptance, the whole loop by touch only ------------------------------------
// Walk to the ship, board, lift off, climb above the air, the map, Mars, set course, pulse,
// descend, land, step out; then the sketchbook and the help card, opened and closed by touch.
// Every control on the screen is measured at each stage (44 css px or more), and on a phone none
// lies in the subject box (x 30-70 %, y 55-100 %) while the picture is being played.
async function partLoop() {
  const painted = flag('painted');
  const device = painted ? 'iphone14' : val('device', 'iphone14');
  // The painted world at q0, 400 x 225 (the painted runs' size): the iPhone 14's profile (iOS user
  // agent, touch, a coarse pointer) on a window of that size.
  const override = painted ? { viewport: { width: 400, height: 225 }, screen: { width: 400, height: 225 }, deviceScaleFactor: 1 } : {};
  const q = val('query', painted ? 'scale=0.5&quality=0' : 'stub=render,world,art') + '&dynres=0&fresh=1&save=0';
  log(`=== the loop by touch: ${device}${painted ? ' at 400x225, the painted world at q0' : ', stubs with PHYSICS'} ===`);
  const r = await open(device, q, override);
  const { page, fingers, info, gameWait, sleep, size } = r;
  const W = size.w, H = size.h, phone = !painted && (device === 'iphone14' || device === 'pixel7');
  const rec = { device, painted, size, stages: {}, legs: {} };
  const LX = W * 0.5, LY = H * 0.42;                    // where a look drag starts: clear of every control
  const SX = W * 0.16, SY = H * 0.72;                   // where the left thumb comes down
  const PX_PER_RAD_SHIP = 1 / (LOOK_GAIN * 0.0017);     // css px of drag per radian of nose (FEEL.mouseShip)
  const PX_PER_RAD_FOOT = 1 / (LOOK_GAIN * TOUCH.mouseFoot);
  const tapAt = (p) => fingers.tap(p.x, p.y);
  const shot = async (name) => { try { await page.screenshot({ path: path.join(out, `loop-${device}${painted ? '-painted' : ''}-${name}.jpg`), type: 'jpeg', quality: 85, timeout: 300000 }); } catch (e) { log('  (no shot ' + name + ': ' + String(e.message).split('\n')[0] + ')'); } };
  async function look(dx, dy) {
    let rx = dx, ry = dy;
    for (let n = 0; n < 12 && (Math.abs(rx) > 1 || Math.abs(ry) > 1); n++) {
      const sx = Math.max(-110, Math.min(110, rx)), sy = Math.max(-70, Math.min(70, ry));
      await fingers.drag(20, LX, LY, LX + sx, LY + sy, { steps: 5, stepMs: 25 });
      rx -= sx; ry -= sy;
    }
  }
  const holdPitch = (deg, gain = 0.35) => async (i) => {
    const err = deg - i.ship.pitchDeg;
    if (Math.abs(err) > 1.5) await look(0, -Math.max(-70, Math.min(70, err / DEG * PX_PER_RAD_SHIP * gain)));
  };
  // the stick pushed (dx, dy) css px from where the thumb came down, for `seconds` of game time
  async function stick(dx, dy, seconds, steer) {
    await fingers.down(30, SX, SY);
    await fingers.move(30, SX + dx * 0.5, SY + dy * 0.5);
    await fingers.move(30, SX + dx, SY + dy);
    const g0 = (await info()).t;
    let i = await info();
    while (i.t - g0 < seconds) { await fingers.move(30, SX + dx, SY + dy); if (steer) await steer(i); await sleep(60); i = await info(); }
    await fingers.up(30);
  }
  const slip = (text) => page.evaluate((t) => {
    for (const b of document.querySelectorAll('.pc-prompt.pc-on .pc-button')) if (b.textContent.includes(t)) { const q = b.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2, w: q.width, h: q.height }; }
    return null;
  }, text);
  async function tapSlip(text, done, tries = 6) {
    for (let k = 0; k < tries; k++) {
      const s = await slip(text);
      if (s) { await tapAt(s); const i = await r.until(done, 3); if (!i.timedOut) return { ok: true, i, at: s }; }
      else await gameWait(0.4);
    }
    return { ok: false, i: await info() };
  }
  const tabAt = (code) => rectOf(page, `.pc-tab[data-code="${code}"]`);
  // W3.3: no string on the screen by touch names a key or the mouse (checked at every stage)
  rec.words = {};
  async function wordsCheck(stage) {
    const l = await lettering(page);
    const keyed = [...new Set(l.filter((x) => namesAKey(x.t)).map((x) => x.t))];
    rec.words[stage] = [...new Set(l.map((x) => x.t))];
    check(keyed.length === 0, `${stage}: ${rec.words[stage].length} strings on the screen, none names a key or the mouse` + (keyed.length ? ': ' + JSON.stringify(keyed) : ''));
    return l;
  }
  // W3.3: the smallest lettering of a sheet on the screen (11 css px or more)
  rec.lettering = {};
  async function letteringCheck(stage, sheet) {
    const l = (await lettering(page)).filter((x) => x.sheet === sheet);
    let sizes = l.map((x) => (x.size == null ? 0 : x.size));
    if (sheet === 'map') sizes = sizes.concat((await page.evaluate(() => window.__pc.map.labelSizes())).map((x) => x.size));
    const min = sizes.length ? Math.min(...sizes) : 0;
    rec.lettering[stage] = { min, n: sizes.length, smallest: l.filter((x) => x.size === min).map((x) => x.t).slice(0, 3) };
    check(sizes.length > 0 && min >= 11, `${stage}: the smallest lettering on the ${sheet} ${min.toFixed(2)} css px (at least 11; ${sizes.length} strings)`);
  }
  // every control on the screen now: its size, and (on a phone, in play) the subject box
  async function measure(stage, inPlay = true) {
    const m = await page.evaluate(() => {
      const list = [];
      for (const e of document.querySelectorAll('.pc-tbtn, .pc-tab, .pc-prompt .pc-button, .pc-close, .pc-map-go, .pc-book.pc-on .pc-book-tab')) {
        const q = e.getBoundingClientRect();
        if (q.width <= 0 || q.height <= 0 || getComputedStyle(e).visibility !== 'visible' || getComputedStyle(e).pointerEvents === 'none') continue;
        list.push({ what: (e.dataset.code || '') + ' ' + e.className.replace(/pc-/g, '').trim() + (e.textContent ? ' "' + e.textContent.trim().slice(0, 24) + '"' : ''), x0: Math.round(q.left), y0: Math.round(q.top), x1: Math.round(q.right), y1: Math.round(q.bottom), w: Math.round(q.width), h: Math.round(q.height) });
      }
      return list;
    });
    const small = m.filter((c) => c.w < 44 || c.h < 44);
    const box = { x0: W * 0.3, x1: W * 0.7, y0: H * 0.55, y1: H };
    const inBox = m.filter((c) => c.x0 < box.x1 && c.x1 > box.x0 && c.y0 < box.y1 && c.y1 > box.y0);
    rec.stages[stage] = m;
    check(m.length > 0 && small.length === 0, `${stage}: ${m.length} controls, every hit area 44 css px or more (smallest ${Math.min(...m.map((c) => Math.min(c.w, c.h)))} px)` + (small.length ? ': ' + JSON.stringify(small) : ''));
    if (phone && inPlay) check(inBox.length === 0, `${stage}: no control in the subject box (x 30-70 %, y 55-100 %)` + (inBox.length ? ': ' + JSON.stringify(inBox) : ''));
    await wordsCheck(stage);
    return m;
  }
  try {
    const fb = await fallbackProblem(page, q);
    check(!fb, fb || 'the modules asked for are the real ones');
    log(`  ${W}x${H} css at ${size.dpr}, coarse pointer ${size.coarse}`);
    await fingers.tap(LX, LY);
    await gameWait(0.5);
    let i = await info();
    check(await page.evaluate(() => window.__pc.game.started), 'a tap begins');
    await measure('on foot');
    // ---- the safe area: an iPhone held sideways keeps 47 px at each side (the notch, the rounded
    // corners) and 21 at the bottom (the home bar); every control keeps inside it (CDP's override
    // of env(safe-area-inset-*); a Chromium of this age has it)
    if (!painted) {
      const SA = { top: 0, left: 47, right: 47, bottom: 21 };
      const okSA = await r.cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: SA }).then(() => true, (e) => { log('  (no safe-area override here: ' + e.message + ')'); return false; });
      if (okSA) {
        await gameWait(0.3);
        const m = await measure('on foot, with an iPhone\'s safe area (47, 47, 21)');
        const out = m.filter((c) => c.x0 < SA.left || c.x1 > W - SA.right || c.y0 < SA.top || c.y1 > H - SA.bottom);
        check(out.length === 0, 'every control inside the safe area' + (out.length ? ': ' + JSON.stringify(out) : ''));
        await r.cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: {} });
        await gameWait(0.3);
      }
    }
    // ---- the fade: four seconds untouched, the controls go back to a third; a touch brings them up
    await gameWait(4.6);
    let fade = await page.evaluate(() => ({ idle: document.getElementById('pc-hud').classList.contains('pc-idle'), o: +getComputedStyle(document.querySelector('.pc-arc')).opacity }));
    check(fade.idle, 'four seconds untouched: the controls fade (opacity ' + fade.o + ' on its way to 0.35)');
    await fingers.tap(LX, LY);
    await gameWait(0.3);
    fade = await page.evaluate(() => document.getElementById('pc-hud').classList.contains('pc-idle'));
    check(!fade, 'a touch brings them back');
    // ---- the VIEW tab
    const fp0 = (await info()).explorer.firstPerson;
    await tapAt(await tabAt('KeyV'));
    await gameWait(0.4);
    check((await info()).explorer.firstPerson !== fp0, 'the VIEW tab changes the view (first person ' + !fp0 + ')');
    await tapAt(await tabAt('KeyV'));
    await gameWait(0.4);
    // ---- to the ship, by the stick, steered by the look
    i = await info();
    await look(i.shipBearingDeg / DEG * PX_PER_RAD_FOOT, 0);
    i = await info();
    const tw = i.t;
    await fingers.down(31, SX, SY); await fingers.move(31, SX, SY - 30); await fingers.move(31, SX, SY - 50);
    while (!i.canBoard && i.t - tw < 60) {
      await fingers.move(31, SX, SY - 50);
      if (Math.abs(i.shipBearingDeg) > 6) {
        // a second finger steers while the thumb stays on the stick
        const px = Math.max(-90, Math.min(90, i.shipBearingDeg / DEG * PX_PER_RAD_FOOT * 0.6));
        await fingers.drag(32, LX, LY, LX + px, LY, { steps: 4, stepMs: 20 });
      }
      await sleep(80);
      i = await info();
    }
    await fingers.up(31);
    check(i.canBoard, `walked to the ship by the stick in ${(i.t - tw).toFixed(1)} s (${i.shipDistance.toFixed(1)} m from it)`);
    await gameWait(0.4);
    await measure('at the ship ("Board ship")');
    let t = await tapSlip('Board ship', (x) => x.state === 'BOARDING' || x.state === 'LANDED');
    check(t.ok, 'a tap on the "Board ship" slip boards' + (t.at ? ` (slip ${Math.round(t.at.w)}x${Math.round(t.at.h)})` : ''));
    i = await r.until((x) => x.state === 'LANDED', 12);
    check(i.state === 'LANDED', 'seated in the ship');
    await gameWait(0.5);
    await measure('landed ("Lift off", "Step out")');
    await shot('landed');
    t = await tapSlip('Lift off', (x) => x.state === 'ATMOSPHERE');
    check(t.ok, 'a tap on "Lift off" lifts off');
    i = await r.until((x) => x.state === 'ATMOSPHERE' && !x.ship.liftoff, 10);
    await measure('flying (rise, sink, brake)');
    await shot('flying');
    // ---- above the air: throttle up by the stick, the nose up by a drag
    await stick(0, -55, 1.9);
    i = await r.until((x) => x.state === 'SPACE', 240, holdPitch(50));
    check(i.state === 'SPACE', `climbed above the air (${Math.round(i.ship.altitude)} m)`);
    i = await r.until((x) => (x.ship.altitude || 0) > x.ship.spaceAlt * 3, 150, holdPitch(50));
    // ---- the map: Mars, set course
    await tapAt(await tabAt('KeyM'));
    await gameWait(0.4);
    check((await info()).mapOpen, 'the MAP tab opens the map');
    await measure('the map open', false);
    await letteringCheck('the map open', 'map');
    // W3.3: Earth and the Moon are two places for a finger; a world is taken within 22 css px
    const em = await page.evaluate(() => ({ earth: window.__pc.map.spotOnScreen('earth'), moon: window.__pc.map.spotOnScreen('moon'), here: window.__pc.game.mapData().here }));
    const emd = Math.hypot(em.earth.x - em.moon.x, em.earth.y - em.moon.y);
    rec.earthMoon = +emd.toFixed(1);
    check(emd >= 44, `W3.3: Earth and the Moon ${emd.toFixed(1)} css px apart on the chart (8.5 on the iPhone before; at least 44, two hit circles of 22)`);
    if (em.here !== 'moon') {
      // a tap 18 css px off the Moon's dot, away from Earth, takes the Moon
      const ux = (em.moon.x - em.earth.x) / emd, uy = (em.moon.y - em.earth.y) / emd;
      await tapAt({ x: em.moon.x + ux * 18, y: em.moon.y + uy * 18 });
      await gameWait(0.4);
      const tm = await info();
      check(tm.target && tm.target.id === 'moon', 'W3.3: a tap 18 css px off the Moon\'s dot takes the Moon: ' + (tm.target ? tm.target.id : 'none'));
    }
    const spot = await page.evaluate(() => window.__pc.map.spotOnScreen('mars'));
    await tapAt(spot);
    await gameWait(0.4);
    i = await info();
    check(i.target && i.target.id === 'mars', 'a tap on Mars sets the course: ' + (i.target ? i.target.name + ', ' + Math.round(i.target.distance / 1000) + ' km' : 'none'));
    const go = await rectOf(page, '.pc-map.pc-has-course .pc-map-go');
    check(!!go && go.h >= 44, 'the "set course" slip is up: ' + JSON.stringify(go));
    await measure('the map, a course chosen', false);
    await shot('map');
    if (go) await tapAt(go);
    await gameWait(0.4);
    check(!(await info()).mapOpen, 'a tap on "set course" puts the map away');
    // the map's corner, and a tap outside it
    await tapAt(await tabAt('KeyM'));
    await gameWait(0.4);
    const mc = await rectOf(page, '.pc-map .pc-close');
    check((await info()).mapOpen && !!mc && mc.w >= 44 && mc.h >= 44, 'the map again; its close corner ' + JSON.stringify(mc));
    await tapAt(mc);
    await gameWait(0.4);
    check(!(await info()).mapOpen, 'its corner closes it');
    await tapAt(await tabAt('KeyM'));
    await gameWait(0.4);
    const mapBox = await page.evaluate(() => { const q = document.querySelector('.pc-map').getBoundingClientRect(); return { x0: q.left, x1: q.right, y0: q.top, y1: q.bottom }; });
    const outside = mapBox.x0 > 30 ? { x: mapBox.x0 / 2, y: H / 2 } : { x: W / 2, y: Math.max(4, mapBox.y0 / 2) };
    await tapAt(outside);
    await gameWait(0.4);
    check(!(await info()).mapOpen, `a tap outside the map (at ${Math.round(outside.x)}, ${Math.round(outside.y)}) closes it`);
    // ---- pulse
    i = await info();
    check(i.target && i.target.id === 'mars' && /Pulse to Mars|Stop turning/.test(i.prompt || ''), 'the prompt: ' + i.prompt);
    await measure('in space ("Pulse to Mars")');
    await shot('space');
    t = await tapSlip('Pulse to Mars', (x) => x.state === 'PULSE' || !!x.turning);
    check(t.ok, 'a tap on "Pulse to Mars" turns the ship onto the course and pulses');
    i = await r.until((x) => x.state === 'PULSE', 60);
    check(i.state === 'PULSE', 'in the pulse drive');
    await gameWait(1);
    await measure('the pulse ("Drop out of pulse")');
    const p0 = i.t;
    i = await r.until((x) => x.state === 'SPACE', 400);
    const dMars = i.target ? i.target.distance : (await page.evaluate(() => window.__pc.aimAt('mars'))).distance;
    check(i.state === 'SPACE' && dMars < 20e3, `arrived by Mars after ${(i.t - p0).toFixed(0)} s: ${(dMars / 1000).toFixed(1)} km away`);
    rec.legs.pulseSeconds = +(i.t - p0).toFixed(1);
    await gameWait(6);
    // ---- down: the nose down, throttle by the stick, into the air, to the landing prompt
    await r.until((x) => x.ship.pitchDeg < -50, 25, holdPitch(-58));
    await stick(0, -55, 1.3);
    i = await r.until((x) => x.state === 'ATMOSPHERE', 300, holdPitch(-58));
    check(i.state === 'ATMOSPHERE', 'entered the air of Mars');
    i = await r.until((x) => x.ship.altGround < 170, 300, holdPitch(-32));
    await stick(0, 55, 0.8, holdPitch(-10));
    i = await r.until((x) => x.ship.throttle < 0.3, 8, holdPitch(-10));
    i = await r.until((x) => x.ship.canLand, 240, async (x) => {
      await holdPitch(x.ship.altGround > 110 ? -18 : -7)(x);
      if (x.ship.throttle < 0.18) await stick(0, -55, 0.15);
    });
    check(i.ship.canLand, `the landing prompt over Mars (${Math.round(i.ship.altGround)} m up, ${Math.round(i.ship.speed)} m/s)`);
    await measure('over Mars ("Land here")');
    await shot('land-here');
    let landed = false;
    for (let k = 0; k < 8 && !landed; k++) {
      t = await tapSlip('Land here', (x) => x.state === 'LANDING' || x.state === 'LANDED' || x.prompt === 'Cancel landing', 3);
      i = t.i;
      if (i.state === 'ATMOSPHERE' && i.prompt === 'Cancel landing') i = await r.until((x) => x.state === 'LANDING' || x.state === 'LANDED' || x.prompt !== 'Cancel landing', 40);
      if (i.state === 'LANDING' || i.state === 'LANDED') { landed = true; break; }
      log('  (the tap did not start a landing: ' + (i.notice || 'no prompt then') + '; flying on)');
      if (/steep|level/i.test(i.notice || '')) await stick(0, -55, 4, holdPitch(0));
      i = await r.until((x) => x.ship.canLand, 120, async (x) => {
        await holdPitch(x.ship.altGround > 110 ? -18 : -7)(x);
        if (x.ship.throttle < 0.18) await stick(0, -55, 0.15);
        if (x.ship.speed > 60) await stick(0, 55, 0.2);
      });
    }
    i = await r.until((x) => x.state === 'LANDED', 90);
    check(i.state === 'LANDED' && i.body === 'mars', 'landed on Mars by touch');
    await gameWait(1);
    t = await tapSlip('Step out', (x) => x.state === 'BOARDING' || x.state === 'ON_FOOT');
    i = await r.until((x) => x.state === 'ON_FOOT', 10);
    check(t.ok && i.state === 'ON_FOOT' && i.body === 'mars', 'a tap on "Step out": standing on Mars');
    await gameWait(1);
    await measure('on foot on Mars');
    // ---- the sketchbook: open, swipe, corner, a tap outside
    await tapAt(await tabAt('KeyB'));
    await gameWait(0.4);
    let bk = await page.evaluate(() => ({ open: window.__pc.book.open, page: window.__pc.book.page }));
    check(bk.open, 'the SKETCHBOOK tab opens the book at ' + bk.page);
    await measure('the sketchbook open', false);
    await letteringCheck('the sketchbook open', 'book');
    const strip = await page.evaluate(() => { const q = document.querySelector('.pc-book-tabs').getBoundingClientRect(); return { h: Math.round(q.height), w: Math.round(q.width) }; });
    rec.bookStrip = strip;
    check(strip.h >= 40, `W3.3: the book's tab strip ${strip.h} css px tall (at least 40; 15 on the iPhone before)`);
    await shot('book');
    const bp = await page.evaluate(() => { const q = document.querySelector('.pc-book-page').getBoundingClientRect(); return { x0: q.left, x1: q.right, y: q.top + q.height * 0.5 }; });
    await fingers.drag(40, bp.x0 + (bp.x1 - bp.x0) * 0.75, bp.y, bp.x0 + (bp.x1 - bp.x0) * 0.25, bp.y, { steps: 8, stepMs: 25 });
    await gameWait(0.3);
    const bk2 = await page.evaluate(() => window.__pc.book.page);
    check(bk2 !== bk.page, `a swipe to the left turns the page: ${bk.page} -> ${bk2}`);
    await fingers.drag(40, bp.x0 + (bp.x1 - bp.x0) * 0.25, bp.y, bp.x0 + (bp.x1 - bp.x0) * 0.75, bp.y, { steps: 8, stepMs: 25 });
    await gameWait(0.3);
    check((await page.evaluate(() => window.__pc.book.page)) === bk.page, 'and back to the right');
    const bc = await rectOf(page, '.pc-book .pc-close');
    check(!!bc && bc.w >= 44 && bc.h >= 44, 'the book\'s close corner ' + JSON.stringify(bc));
    await tapAt(bc);
    await gameWait(0.4);
    check(!(await info()).bookOpen, 'its corner closes it');
    await tapAt(await tabAt('KeyB'));
    await gameWait(0.4);
    const bookBox = await page.evaluate(() => { const q = document.querySelector('.pc-book').getBoundingClientRect(); return { x0: q.left, x1: q.right, y0: q.top, y1: q.bottom }; });
    const out2 = bookBox.x0 > 30 ? { x: bookBox.x0 / 2, y: H / 2 } : { x: W / 2, y: Math.max(4, bookBox.y0 / 2) };
    check((await info()).bookOpen, 'the book again');
    await tapAt(out2);
    await gameWait(0.4);
    check(!(await info()).bookOpen, `a tap outside the book (at ${Math.round(out2.x)}, ${Math.round(out2.y)}) closes it`);
    // ---- the help card: a tap anywhere, its corner
    await tapAt(await tabAt('KeyH'));
    await gameWait(0.4);
    check(await page.evaluate(() => window.__pc.game.hud.startShown), 'the HELP tab shows the help card');
    await measure('the help card', false);
    await letteringCheck('the help card', 'card');
    const drawn = await page.evaluate(() => document.querySelectorAll('.pc-start .pc-help-touch svg.pc-icon').length);
    check(drawn >= 6, `W3.3: the help card draws the touch controls (${drawn} drawings)`);
    await shot('help');
    await tapAt({ x: W * 0.5, y: H * 0.5 });
    await gameWait(0.4);
    check(!(await page.evaluate(() => window.__pc.game.hud.startShown)), 'a tap on it puts it away');
    await tapAt(await tabAt('KeyH'));
    await gameWait(0.4);
    const hc = await rectOf(page, '.pc-start .pc-close');
    check(!!hc && hc.w >= 44 && hc.h >= 44, 'the help card again; its close corner ' + JSON.stringify(hc));
    await tapAt(hc);
    await gameWait(0.4);
    check(!(await page.evaluate(() => window.__pc.game.hud.startShown)), 'its corner puts it away');
    const ev = await page.evaluate(() => ({ ...window.__evc, lock: !!document.pointerLockElement, req: window.__pc.game.input._req }));
    rec.events = ev;
    check(!ev.lock && ev.req === 0, `the whole loop by touch: no pointer lock asked for (requests ${ev.req}), pointercancel ${ev['pointercancel:touch'] || 0}`);
    check(!(ev.keydown), 'and not one key pressed');
    i = await info();
    rec.legs.gameSeconds = +i.t.toFixed(0);
    await shot('end');
  } catch (e) {
    fails.push('loop: exception: ' + (e && e.stack ? e.stack : e));
    try { await page.screenshot({ path: path.join(out, 'loop-failure.jpg'), type: 'jpeg', quality: 85, timeout: 300000 }); } catch { /* gone */ }
  }
  await r.close();
  check(r.problems.length === 0, 'the loop: no console errors, page errors, failed or external requests' + (r.problems.length ? ': ' + [...new Set(r.problems)].slice(0, 5).join(' | ') : ''));
  return rec;
}

const summary = { part, root, runs: [] };
try {
  if (part === 'input' || part === 'all') {
    for (const d of val('devices', 'iphone14,pixel7,ipadpro11,desktop').split(',')) summary.runs.push(d === 'desktop' ? await partDesktop() : await partInput(d));
  }
  if (part === 'loop' || part === 'all') summary.runs.push(await partLoop());
  if (!['input', 'loop', 'all'].includes(part)) { console.error('unknown part: ' + part); process.exit(2); }
} catch (e) { fails.push('exception: ' + (e && e.stack ? e.stack : e)); }
summary.fails = fails;
summary.seconds = Math.round((Date.now() - t0) / 1000);
fs.writeFileSync(path.join(out, `summary-${part}.json`), JSON.stringify(summary, null, 1));
log(fails.length ? `FAILED (${fails.length})` : 'PASSED', `${summary.seconds} s`);
for (const f of fails) console.log('  - ' + f);
process.exit(fails.length ? 1 : 0);
