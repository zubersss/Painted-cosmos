// PILOT 12, M4 critique: the look as a new player meets it, in order, at the top tier (quality 2,
// 960x540), with the HUD as the player has it. Real keys and mouse for the play; the debug door only
// to go to a place, to set the clock and the hour, and to hold the frame while it is captured.
// node look.mjs --root <clean tree> --out <dir> [--only title,foot,ship,climb,ui,hours,storm,sea,gale] [--query quality=2]
import fs from 'node:fs';
import path from 'node:path';
const args = process.argv.slice(2);
const root = args[args.indexOf('--root') + 1];
const { RAD, MOUSE_FOOT, parseArgs, startRun, finish, settleWorld } = await import(root + '/tests/browser.mjs');
const opt = parseArgs({ out: '/home/user/.pc-scratch/pilot/m4/look', w: 960, h: 540, query: 'quality=2', only: '' });
opt.query += '&dynres=0&pointerlock=0&fresh=1&save=0&audio=0' + (opt.card === '0' ? '&card=0' : '');
const only = opt.only ? opt.only.split(',') : null;
const lite = String(opt.lite || '0') === '1';      // --lite 1: the frames that are judged at the top tier only (a top-tier frame takes seconds here)
const want = (k) => (!only || only.includes(k)) && !(lite && k === 'ui');
// (tests/browser.mjs startRun gives the game five minutes to be ready; at the top tier on this machine, with two other
// roles rendering, the load alone takes longer: the same helpers here, with half an hour)
async function startRunLong(opt) {
  const { openPage } = await import(root + '/tools/shot.mjs');
  const { fallbackProblem } = await import(root + '/tests/browser.mjs');
  const W = Number(opt.w), H = Number(opt.h);
  fs.mkdirSync(opt.out, { recursive: true });
  const { page, problems, close, baseUrl } = await openPage({ pagePath: '/index.html?' + opt.query, w: W, h: H, root: opt.root });
  const cx = W / 2, cy = H / 2, fails = [];
  const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
  const check = (ok, msg) => { if (!ok) { fails.push(msg); log('  FAIL:', msg); } else log('  ok:', msg); return ok; };
  const info = () => page.evaluate(() => window.__pc.info());
  const sleep = (ms) => page.waitForTimeout(ms);
  async function shot(name) { const file = path.join(opt.out, name + '.jpg'); await page.screenshot({ path: file, type: 'jpeg', quality: 86, timeout: 600000 }); return file; }
  async function look(dx, dy) {
    let rx = dx, ry = dy;
    for (let n = 0; n < 40 && (Math.abs(rx) > 0.5 || Math.abs(ry) > 0.5); n++) {
      const sx = Math.max(-140, Math.min(140, rx)), sy = Math.max(-90, Math.min(90, ry));
      await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + sx, cy + sy, { steps: 3 }); await page.mouse.up();
      rx -= sx; ry -= sy;
    }
  }
  async function gameWait(seconds) { const t0 = (await info()).t, w0 = Date.now(); while ((await info()).t - t0 < seconds && Date.now() - w0 < seconds * 60000 + 30000) await sleep(30); }
  async function until(pred, seconds, steer, tickMs = 90) {
    let i = await info(); const t0 = i.t, w0 = Date.now();
    while (!pred(i)) { if (i.t - t0 > seconds || Date.now() - w0 > seconds * 60000 + 30000) return { ...i, timedOut: true }; if (steer) await steer(i); await sleep(tickMs); i = await info(); }
    return i;
  }
  await page.waitForFunction('window.__pcReady === true', null, { timeout: 1800000, polling: 300 });
  const fb = await fallbackProblem(page, opt.query);
  check(!fb, fb || 'every module the run asked for is the real one: ' + JSON.stringify((await info()).using));
  return { page, problems, close, baseUrl, fails, log, check, info, sleep, shot, look, gameWait, until, cx, cy, W, H };
}
const run = await (String(opt.long || '0') === '1' ? startRunLong(opt) : startRun(opt));
const { page, check, info, shot, look, gameWait, until, log } = run;
const summary = { query: opt.query, beats: [] };
let n = 0;
async function beat(name, extra = {}) {
  await page.evaluate(() => window.__pc.hold(true));
  const i = await info();
  const file = await shot(String(++n).padStart(2, '0') + '-' + name);
  await page.evaluate(() => window.__pc.hold(false));
  const b = { n, name, file: path.basename(file), state: i.state, body: i.body, biome: i.mood && i.mood.biomeId, prompt: i.prompt, notice: i.notice, t: +i.t.toFixed(1), tris: i.stats && i.stats.tris, calls: i.stats && i.stats.calls, busy: await page.evaluate(() => window.__pc.world.busy), ...extra };
  summary.beats.push(b);
  log(`  beat ${n} ${name}: ${i.state} t ${b.t} biome ${b.biome} busy ${b.busy} prompt "${i.prompt || ''}" notice "${i.notice || ''}" ${JSON.stringify(extra)}`);
  fs.writeFileSync(path.join(opt.out, 'look.json'), JSON.stringify(summary, null, 1));
  return i;
}
const settle = async () => { const r = await settleWorld(page, { maxFrames: 300, maxSeconds: 1500 }); if (!r.ok) log('  (not settled after ' + r.frames + ' frames)'); return r; };
const go = async (o) => { await page.evaluate((x) => window.__pc.teleport(x), o); return settle(); };
const sect = async (name, f) => { if (!want(name)) return; log('SECTION ' + name); try { await f(); } catch (e) { run.fails.push(name + ': ' + (e && e.stack ? e.stack : e)); log('  EXCEPTION in ' + name + ': ' + (e && e.message)); try { await page.evaluate(() => window.__pc.hold(false)); } catch { /* gone */ } } };
const SECT = {};
const spawnDir = (b) => page.evaluate((b) => { const d = window.__pc.world.getSpawn(b).unitDir; return [d.x, d.y, d.z]; }, b);
// (no frame read-out: the picture as the player has it)

SECT.title = async () => {
  if (lite) { await settle(); await beat('first-view'); return; }
  const card = await page.evaluate(() => window.__pc.game.hud.startShown);
  if (card) {
    await page.waitForFunction(() => window.__pc.game.canStart !== false, null, { timeout: 900000, polling: 300 });
    await settle();
    await beat('title');
    await page.mouse.click(run.cx, run.cy);
    await gameWait(0.6);
  }
  await settle();
  await beat('first-view');
  if (!lite) {
    await page.keyboard.press('KeyH'); await gameWait(0.5);
    await beat('help-card');
    await page.keyboard.press('KeyH'); await gameWait(0.5);
  }
};

SECT.foot = async () => {
  if (lite) await settle();
  await page.keyboard.down('KeyW');
  await gameWait(2.6);
  await beat('walking');
  if (!lite) {
    await page.keyboard.down('ShiftLeft');
    await gameWait(1.6);
    await beat('running');
    await page.keyboard.up('ShiftLeft');
  }
  await page.keyboard.up('KeyW');
  await gameWait(1.2);
  let top = 0;
  await page.keyboard.down('Space');
  await until(() => false, 1.7, (x) => { top = Math.max(top, x.explorer.altitude); });
  await beat('jetpack', { top: +top.toFixed(1) });
  await until(() => false, 1.2, (x) => { top = Math.max(top, x.explorer.altitude); });
  await beat('jetpack-high', { top: +top.toFixed(1) });
  await page.keyboard.up('Space');
  await gameWait(0.8);
  if (!lite) await beat('falling', { top: +top.toFixed(1) });
  if (lite) return;
  await until((x) => x.explorer.grounded, 25);
  await settle();
};

SECT.ship = async () => {
  if (lite) {
    const sp = await spawnDir('earth');
    await page.evaluate(() => window.__pc.setClock(40));
    await go({ body: 'earth', dir: sp, ship: true, altitude: 30, heading: 60, throttle: 0, hour: 10.5 });
    await gameWait(0.5);
    await beat('hover-over-the-wood', { altGround: (await info()).ship.altGround });
    await page.keyboard.down('KeyW'); await gameWait(1.5); await page.keyboard.up('KeyW');
    await gameWait(3);
    const j = await info();
    await beat('low-flight', { altGround: j.ship.altGround, speed: j.ship.speed });
    await page.keyboard.press('KeyV'); await gameWait(0.7);
    await beat('cockpit');
    await page.keyboard.press('KeyV'); await gameWait(0.5);
    return;
  }
  let i = await info();
  await look((i.shipBearingDeg * RAD) / MOUSE_FOOT, 0);
  await page.keyboard.down('KeyW');
  let slow = 0;
  i = await until((x) => x.canBoard, 90, async (x) => {
    if (Math.abs(x.shipBearingDeg) > 4) await look((x.shipBearingDeg * RAD) / MOUSE_FOOT * 0.6, 0);
    slow = x.explorer.speed < 0.6 ? slow + 1 : 0;
    if (slow >= 6) { slow = 0; await page.keyboard.down('Space'); await run.sleep(500); await page.keyboard.up('Space'); }
  });
  await page.keyboard.up('KeyW');
  await settle();
  await beat('at-the-ship', { canBoard: !!i.canBoard, shipDistance: i.shipDistance });
  await page.keyboard.press('KeyE');
  await gameWait(0.5);
  if (!lite) await beat('climbing-in');
  await until((x) => x.state === 'LANDED', 10);
  await settle();
  await beat('in-the-ship');
  await page.keyboard.press('Space');
  await gameWait(0.9);
  if (!lite) await beat('lifting-off');
  i = await until((x) => x.state === 'ATMOSPHERE' && !x.ship.liftoff, 14);
  await beat('airborne', { altGround: i.ship && i.ship.altGround });
  await page.keyboard.down('KeyW'); await gameWait(1.5); await page.keyboard.up('KeyW');
  await gameWait(3);
  i = await info();
  await beat('low-flight', { altGround: i.ship && i.ship.altGround, speed: i.ship && i.ship.speed });
  await page.keyboard.press('KeyV'); await gameWait(0.7);
  await beat('cockpit');
  await page.keyboard.press('KeyV'); await gameWait(0.5);
};

SECT.climb = async () => {
  const sp = await spawnDir('earth');
  await page.evaluate(() => window.__pc.setClock(40));
  // (Earth is 4 km in radius and its air ends 800 m up: the climb is short)
  for (const [alt, pitch] of lite ? [[300, 22]] : [[120, 10], [300, 22], [600, 32]]) {
    await page.evaluate(() => window.__pc.setClock(40));
    await go({ body: 'earth', dir: sp, ship: true, altitude: alt, heading: 60, pitchDeg: pitch, throttle: 0, hour: 10.5 });
    await gameWait(0.6);
    await beat('climb-' + alt + 'm');
  }
  const sa = (await info()).ship.spaceAlt;
  await page.evaluate(() => window.__pc.setClock(40));
  await go({ body: 'earth', dir: sp, ship: true, altitude: sa * 0.95, heading: 60, pitchDeg: 30, throttle: 0, hour: 10.5 });
  await gameWait(0.6);
  await beat('edge-of-the-air', { spaceAlt: sa });
  await page.evaluate(() => window.__pc.setClock(40));
  await go({ body: 'earth', dir: sp, ship: true, altitude: sa * 1.6, heading: 60, pitchDeg: -25, throttle: 0, hour: 10.5 });
  await gameWait(0.6);
  await beat('just-in-space-looking-down', { spaceAlt: sa });
  // coming back down: the wood from 350 m with the nose down, as a descent shows it
  await page.evaluate(() => window.__pc.setClock(40));
  await go({ body: 'earth', dir: sp, ship: true, altitude: 350, heading: 60, pitchDeg: -30, throttle: 0, hour: 10.5 });
  await gameWait(0.6);
  await beat('descent-350m');
};

SECT.ui = async () => {
  const sp = await spawnDir('earth');
  await go({ body: 'earth', dir: sp, ship: true, altitude: 60000, hour: 10.5 });
  await page.keyboard.press('KeyM'); await gameWait(0.6);
  await beat('map');
  await page.keyboard.press('KeyM'); await gameWait(0.4);
  await page.evaluate(() => window.__pc.setClock(40));
  await go({ body: 'earth', hour: 10.5 });
  await page.keyboard.press('KeyB'); await gameWait(0.6);
  await beat('sketchbook');
  await page.keyboard.press('KeyB'); await gameWait(0.4);
};

SECT.hours = async () => {
  for (const [h, name] of lite ? [[0, 'night'], [18.1, 'dusk']] : [[0, 'night'], [6.2, 'dawn'], [18.1, 'dusk']]) {
    await page.evaluate(() => window.__pc.setClock(40));
    await go({ body: 'earth', hour: h });
    await gameWait(0.8);
    await beat(name + '-earth-spawn', { hour: h });
  }
  if (lite) return;
  // night in first person, looking up a little: the sky a player sees at night
  await page.evaluate(() => window.__pc.setClock(40));
  const sp = await spawnDir('earth');
  await go({ body: 'earth', dir: sp, hour: 0, heading: 200, lookPitch: 18, firstPerson: true });
  await gameWait(0.6);
  await beat('night-earth-sky', { hour: 0 });
};

SECT.storm = async () => {
  await page.evaluate((l) => window.__pc.setClock(l ? 231 : 226), lite);
  await go({ body: 'earth' });
  await page.waitForFunction(() => window.__pc.sim.t >= 240, null, { timeout: 900000, polling: 250 });
  await beat('storm-earth-spawn');
  // ten minutes into a new game: the wet, misty wood PHYSICS leaves after its first storm (the hour as the clock has it)
  await page.evaluate((l) => window.__pc.setClock(l ? 595 : 588), lite);
  await go({ body: 'earth' });
  await page.waitForFunction(() => window.__pc.sim.t >= 600, null, { timeout: 900000, polling: 250 });
  await beat('ten-minutes-in-mist');
  // fifteen minutes in: the night a new player actually meets (the game's day is 25 minutes and begins at 9:30), in PHYSICS' mist
  await page.evaluate((l) => window.__pc.setClock(l ? 895 : 888), lite);
  await go({ body: 'earth' });
  await page.waitForFunction(() => window.__pc.sim.t >= 900, null, { timeout: 900000, polling: 250 });
  await beat('fifteen-minutes-in-night');
  if (lite) return;
  await page.evaluate(() => window.__pc.setClock(226));
  await go({ body: 'earth' });
  await page.waitForFunction(() => window.__pc.sim.t >= 240, null, { timeout: 900000, polling: 250 });
  await page.keyboard.down('KeyW'); await gameWait(1.5);
  await beat('storm-earth-walking');
  await page.keyboard.up('KeyW');
  await page.evaluate(() => window.__pc.setClock(228));
  await go({ body: 'earth', hour: 22 });
  await page.waitForFunction(() => window.__pc.sim.t >= 240, null, { timeout: 900000, polling: 250 });
  await beat('storm-earth-night', { hour: 22 });
};

SECT.sea = async () => {
  await page.evaluate(() => window.__pc.setClock(40));
  const st = await page.evaluate(() => { const a = window.__pc.world.findBiome('earth', 'sea_coast'); return { d: [a.unitDir.x, a.unitDir.y, a.unitDir.z], yaw: a.yaw == null ? null : a.yaw * 180 / Math.PI, pitch: a.pitch == null ? null : a.pitch * 180 / Math.PI }; });
  await go({ body: 'earth', dir: st.d, hour: 10.5, heading: st.yaw == null ? undefined : st.yaw, lookPitch: st.pitch == null ? undefined : st.pitch, firstPerson: false });
  await gameWait(0.6);
  await beat('coast-stand');
  // the nearest water 1.6 to 3 m deep within 150 m: stand in it, face away from the shore, swim
  const wet = await page.evaluate((u0) => {
    const u = { x: u0[0], y: u0[1], z: u0[2] }, sm = window.__pc.sim.sampler('earth'), R = sm(u).radius;
    const e = { x: u.z, y: 0, z: -u.x }, el = Math.hypot(e.x, e.z); e.x /= el; e.z /= el;
    const nn = { x: u.y * e.z - u.z * e.y, y: u.z * e.x - u.x * e.z, z: u.x * e.y - u.y * e.x };
    for (let r = 6; r <= 150; r += 4) for (let a = 0; a < 24; a++) {
      const c = Math.cos(a / 24 * 6.283), s2 = Math.sin(a / 24 * 6.283);
      const p = { x: u.x + (e.x * c + nn.x * s2) * r / R, y: u.y + (e.y * c + nn.y * s2) * r / R, z: u.z + (e.z * c + nn.z * s2) * r / R };
      const l = Math.hypot(p.x, p.y, p.z), q = sm({ x: p.x / l, y: p.y / l, z: p.z / l }), dep = q.liquidRadius - q.radius;
      if (q.isLiquid && dep > 1.6 && dep < 3.2) return { dir: [p.x / l, p.y / l, p.z / l], r, bearing: Math.atan2(c, s2) * 180 / Math.PI, depth: dep };
    }
    return null;
  }, st.d);
  log('  water: ' + JSON.stringify(wet));
  if (wet) {
    await go({ body: 'earth', dir: wet.dir, hour: 10.5, heading: wet.bearing, lookPitch: -8, firstPerson: false });
    await page.keyboard.down('KeyW'); await gameWait(2.2);
    const i = await info();
    await beat('swimming', { depth: i.explorer.liquidDepth, mode: i.explorer.mode, speed: i.explorer.speed });
    await page.keyboard.up('KeyW');
    if (!lite) { await gameWait(1.0); await beat('floating', { depth: (await info()).explorer.liquidDepth }); }
  }
};

SECT.gale = async () => {
  await page.evaluate((l) => window.__pc.setClock(l ? 143 : 138), lite);
  const st = await page.evaluate(() => { const a = window.__pc.world.findBiome('neptune', 'storm_seas'); return { d: [a.unitDir.x, a.unitDir.y, a.unitDir.z], yaw: a.yaw == null ? null : a.yaw * 180 / Math.PI, pitch: a.pitch == null ? null : a.pitch * 180 / Math.PI }; });
  await go({ body: 'neptune', dir: st.d, hour: 11, heading: st.yaw == null ? undefined : st.yaw, lookPitch: st.pitch == null ? undefined : st.pitch, firstPerson: false });
  await page.waitForFunction(() => window.__pc.sim.t >= 150, null, { timeout: 900000, polling: 250 });
  const m = await page.evaluate(() => { const h = window.__pc.physics && window.__pc.physics.here; return h && h.wind ? Math.hypot(h.wind.x || 0, h.wind.y || 0, h.wind.z || 0) : null; });
  await beat('neptune-gale', { wind: m });
};

for (const name of (only || ['title', 'foot', 'ship', 'climb', 'ui', 'hours', 'storm', 'sea', 'gale'])) if (SECT[name]) await sect(name, SECT[name]);
summary.errors = await page.evaluate(() => window.__pc.errors);
summary.fallback = await page.evaluate(() => window.__pc.info().fallback);
await finish(run, opt, summary);
