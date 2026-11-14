// Touch, in a browser (W3.1 and W3.2 of the sharp-smooth plan): headless Chromium under
// Playwright's phone and tablet profiles (an iOS or Android user agent, a coarse pointer, touch
// points, the device's pixel ratio), fingers put down with CDP's Input.dispatchTouchEvent, as
// many at once as a hand has. Not iOS Safari, not a real phone: what a finger does to the game.
//
//   node tests/touch.mjs                      --part input on the three profiles (stubs, PHYSICS on)
//   node tests/touch.mjs --part input --devices iphone14,pixel7,ipadpro11
//   node tests/touch.mjs --part loop          the whole loop by touch only (iPhone 14, stubs)
//   node tests/touch.mjs --part loop --painted  the same in the painted world at q0, 400x225
//   [--root DIR] [--out DIR] [--query "..."] [--keep]
//
// part input (W3.1's acceptance): a tap starts the game with no compatibility mouse event and
// no pointer lock; a 120 px drag turns the view 30 degrees or more with no pointercancel; the
// stick held 2.5 s walks 5 m or more; JUMP jumps 0.5 m or more, held 2 s the jetpack climbs 5 m
// or more; the stick and the look work together; a pinch moves the camera and leaves the page
// unzoomed (visualViewport.scale 1); in the ship a drag pitches the nose, stick X turns it and
// stick Y moves the throttle.
// Every run fails on a console error, a page error, a failed or external request, or a real
// module that fell back to its stub.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { GL_ARGS } from '../tools/shot.mjs';
import { startServer } from '../tools/serve.mjs';
import { fallbackProblem } from './browser.mjs';

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
  for (const t of ['pointerdown','pointerup','pointercancel','mousedown','mouseup','mousemove','click','dblclick','contextmenu','touchstart','touchend','touchcancel','gesturestart'])
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
class Fingers {
  constructor(cdp) { this.cdp = cdp; this.on = new Map(); }
  pts() { return [...this.on.entries()].map(([id, p]) => ({ x: p.x, y: p.y, id, radiusX: 4, radiusY: 4, force: 1 })); }
  send(type, touchPoints) { return this.cdp.send('Input.dispatchTouchEvent', { type, touchPoints }); }
  async down(id, x, y) { this.on.set(id, { x, y }); await this.send('touchStart', this.pts()); }
  async move(id, x, y) { this.on.set(id, { x, y }); await this.send('touchMove', this.pts()); }
  async up(id) { const p = this.on.get(id); if (!p) return; this.on.delete(id); await this.send('touchEnd', [{ x: p.x, y: p.y, id }]); }
  async drag(id, x0, y0, x1, y1, { steps = 12, stepMs = 30, lift = true } = {}) {
    await this.down(id, x0, y0);
    for (let i = 1; i <= steps; i++) { await this.move(id, x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps); await new Promise((r) => setTimeout(r, stepMs)); }
    if (lift) await this.up(id);
  }
  async tap(x, y, id = 90) { await this.down(id, x, y); await new Promise((r) => setTimeout(r, 50)); await this.up(id); }
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

const summary = { part, root, runs: [] };
try {
  if (part === 'input') {
    for (const d of val('devices', 'iphone14,pixel7,ipadpro11,desktop').split(',')) summary.runs.push(d === 'desktop' ? await partDesktop() : await partInput(d));
  } else {
    console.error('unknown part: ' + part);
    process.exit(2);
  }
} catch (e) { fails.push('exception: ' + (e && e.stack ? e.stack : e)); }
summary.fails = fails;
summary.seconds = Math.round((Date.now() - t0) / 1000);
fs.writeFileSync(path.join(out, `summary-${part}.json`), JSON.stringify(summary, null, 1));
log(fails.length ? `FAILED (${fails.length})` : 'PASSED', `${summary.seconds} s`);
for (const f of fails) console.log('  - ' + f);
process.exit(fails.length ? 1 : 0);
