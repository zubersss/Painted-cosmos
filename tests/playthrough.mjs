// Scripted headless play-through of the M1 loop in a real browser (software WebGL2), driven by
// real key and mouse events:
//   on foot -> jetpack -> board -> lift off -> reach space -> return -> land -> step out
// It reads window.__pc.info() to steer (like a player reading the screen) and never calls into
// the game to move anything. Fails on any console error, page error, failed or external request.
//
// Usage: node tests/playthrough.mjs [--out dir] [--keep] [--w 640 --h 360] [--query "stub=1"]
//                                   [--root dir] [--fast]
//   --keep  also write the curated evidence set to docs/shots/pilot/ (stable names)
//   --fast  use time acceleration during the long legs (climb, descent)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPage } from '../tools/shot.mjs';

const args = process.argv.slice(2);
const opt = { out: '/home/user/.pc-scratch/pilot/play', w: 640, h: 360, query: 'stub=1' };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--keep') opt.keep = true;
  else if (a === '--fast') opt.fast = true;
  else if (a.startsWith('--')) opt[a.slice(2)] = args[++i];
}
const W = Number(opt.w), H = Number(opt.h);
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const keepDir = path.join(repo, 'docs/shots/pilot');
fs.mkdirSync(opt.out, { recursive: true });

const RAD = Math.PI / 180;
const MOUSE_FOOT = 0.0023, MOUSE_SHIP = 0.0017;      // rad per pixel (src/core/sim.js FEEL)
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const fails = [];
const check = (ok, msg) => { if (!ok) { fails.push(msg); log('  FAIL:', msg); } else log('  ok:', msg); };

const query = opt.query + (opt.query.includes('dynres') ? '' : '&dynres=0') + '&pointerlock=0';
const { page, problems, close } = await openPage({ pagePath: '/index.html?' + query, w: W, h: H, root: opt.root });
const info = () => page.evaluate(() => window.__pc.info());
const sleep = (ms) => page.waitForTimeout(ms);
const cx = W / 2, cy = H / 2;
const summary = { stages: [], timings: {} };

async function shot(name, keepAs) {
  const file = path.join(opt.out, name + '.jpg');
  await page.screenshot({ path: file, type: 'jpeg', quality: 86 });
  if (opt.keep && keepAs) fs.copyFileSync(file, path.join(keepDir, keepAs + '.jpg'));
  return file;
}
// Move the view by (dx, dy) pixels of mouse travel: press, drag, release, in short strokes.
async function look(dx, dy) {
  let rx = dx, ry = dy;
  for (let n = 0; n < 40 && (Math.abs(rx) > 0.5 || Math.abs(ry) > 0.5); n++) {
    const sx = Math.max(-140, Math.min(140, rx)), sy = Math.max(-90, Math.min(90, ry));
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + sx, cy + sy, { steps: 3 });
    await page.mouse.up();
    rx -= sx; ry -= sy;
  }
}
// Poll until pred(info) is true. `steer(info)` may act every tick. Returns the last info.
async function until(pred, timeoutMs, steer, tickMs = 90) {
  const t0 = Date.now();
  let i = await info();
  while (!pred(i)) {
    if (Date.now() - t0 > timeoutMs) return { ...i, timedOut: true };
    if (steer) await steer(i);
    await sleep(tickMs);
    i = await info();
  }
  return i;
}
const holdPitch = (deg, gain = 0.35) => async (i) => {
  const err = deg - i.ship.pitchDeg;
  if (Math.abs(err) > 1.5) await look(0, -Math.max(-80, Math.min(80, (err * RAD / MOUSE_SHIP) * gain)));
};
const stage = (name, i) => { summary.stages.push({ name, state: i.state, t: +i.t.toFixed(1) }); log('STAGE', name, '-', i.state, 'frame', i.frame, 'fps', i.fps); };
const timeScale = (k) => page.evaluate((v) => window.__pc.setTimeScale(v), opt.fast ? k : 1);

try {
  await page.waitForFunction('window.__pcReady === true', null, { timeout: 120000, polling: 200 });
  let i = await info();
  log('ready. providers:', JSON.stringify(i.using), 'fps', i.fps);
  summary.using = i.using;
  check(i.state === 'ON_FOOT' && i.body === 'earth', 'starts on foot on Earth');
  check(Math.abs(i.mood.timeOfDay - 9.5) < 0.2, 'local time is a clear morning: ' + i.mood.timeOfDay.toFixed(2));
  await shot('00-start');

  // ---- walk ------------------------------------------------------------------------------------
  await page.mouse.click(cx, cy);                 // "click to begin"
  const p0 = i.explorer.p;
  await page.keyboard.down('KeyW');
  await sleep(2500);
  await shot('01-on-foot', '01-on-foot');
  await page.keyboard.up('KeyW');
  i = await info();
  const walked = Math.hypot(i.explorer.p.x - p0.x, i.explorer.p.y - p0.y, i.explorer.p.z - p0.z);
  check(walked > 6 && walked < 14, `walked ${walked.toFixed(1)} m in 2.5 s`);
  check(i.explorer.grounded, 'feet on the ground');
  stage('walk', i);

  // ---- look around, first person and back ---------------------------------------------------------
  await page.keyboard.press('KeyV');
  await sleep(300);
  i = await info();
  check(i.explorer.firstPerson === true, 'V switches to first person');
  await look(160, -30);
  await shot('01b-first-person');
  await page.keyboard.press('KeyV');
  await sleep(300);
  check((await info()).explorer.firstPerson === false, 'V switches back to third person');

  // ---- jetpack ---------------------------------------------------------------------------------------
  await page.keyboard.down('Space');
  await sleep(2300);
  i = await info();
  await shot('02-jetpack', '02-jetpack');
  check(i.explorer.mode === 'jet' && i.explorer.altitude > 7, `jetpack lifted the explorer ${i.explorer.altitude.toFixed(1)} m`);
  check(i.explorer.fuel < 0.65, 'fuel is draining: ' + i.explorer.fuel.toFixed(2));
  await page.keyboard.up('Space');
  i = await until((x) => x.explorer.grounded, 15000);
  check(i.explorer.grounded, 'landed softly after the jetpack');
  i = await until((x) => x.explorer.fuel >= 0.999, 8000);
  check(i.explorer.fuel >= 0.999, 'fuel recharged on the ground');
  stage('jetpack', i);

  // ---- walk to the ship and board ----------------------------------------------------------------------
  i = await info();
  await look((i.shipBearingDeg * RAD) / MOUSE_FOOT, 0);
  await sleep(200);
  i = await info();
  check(Math.abs(i.shipBearingDeg) < 6, 'turned to face the ship: ' + i.shipBearingDeg.toFixed(1) + ' deg');
  await page.keyboard.down('KeyW');
  i = await until((x) => x.canBoard, 25000, async (x) => {
    if (Math.abs(x.shipBearingDeg) > 4) await look((x.shipBearingDeg * RAD) / MOUSE_FOOT * 0.6, 0);
  });
  await page.keyboard.up('KeyW');
  await sleep(350);
  i = await info();
  check(i.canBoard && i.prompt === 'Board ship', 'board prompt shows next to the ship');
  await shot('03-board-prompt', '03-board-prompt');
  await page.keyboard.press('KeyE');
  i = await until((x) => x.state === 'LANDED', 6000);
  check(i.state === 'LANDED', 'boarded with E');
  check(/Lift off/.test(i.prompt || ''), 'lift-off prompt shows');
  await sleep(600);
  await shot('04-in-ship', '04-in-ship');
  stage('board', i);

  // ---- lift off ----------------------------------------------------------------------------------------
  await page.keyboard.press('Space');
  await sleep(1400);
  i = await info();
  check(i.state === 'ATMOSPHERE' && i.ship.liftoff, 'lift-off sequence running');
  await shot('05-liftoff', '05-liftoff');
  i = await until((x) => !x.ship.liftoff, 8000);
  await sleep(1200);
  i = await info();
  check(Math.abs(i.ship.altGround - 9) < 2 && i.ship.speed < 1, `hovering at ${i.ship.altGround.toFixed(1)} m, ${i.ship.speed.toFixed(2)} m/s`);
  stage('liftoff', i);

  // ---- climb to space, no loading screen ---------------------------------------------------------------
  const tClimb0 = (await info()).t;
  await page.keyboard.down('KeyW');
  await sleep(1900);
  await page.keyboard.up('KeyW');                 // throttle is persistent
  let shotClimb = false;
  i = await until((x) => x.state === 'SPACE', 120000, async (x) => {
    await holdPitch(48)(x);
    if (!shotClimb && (x.ship.altitude || 0) > 330) { shotClimb = true; await shot('06-climb', '06-climb'); }
  });
  check(i.state === 'SPACE', 'reached space');
  check(i.frame === 'earth:orbit', 'flying in the orbit frame: ' + i.frame);
  check(i.ship.bounces === 0, 'no bumps on the way up');
  summary.timings.groundToSpace = +(i.t - tClimb0).toFixed(1);
  log('  ground to space took', summary.timings.groundToSpace, 's of game time');
  stage('space', i);
  await timeScale(3);
  i = await until((x) => (x.ship.altitude || 0) > 5200, 90000, holdPitch(48));
  await timeScale(1);
  await page.keyboard.down('KeyX');
  i = await until((x) => x.ship.speed < 4, 30000);
  await page.keyboard.up('KeyX');
  check(i.ship.speed < 4, 'X brings the ship to rest in space');
  check(i.mood.inSpace01 > 0.99, 'mood says space: inSpace01 ' + i.mood.inSpace01.toFixed(2));

  // Look down at the planet from orbit, then find the moon (another world).
  const alt = (x) => (x.ship.altitude == null ? 1e9 : x.ship.altitude);
  i = await until((x) => Math.abs(x.ship.pitchDeg + 62) < 3, 20000, holdPitch(-62));
  await sleep(900);
  await shot('07-orbit', '07-orbit');
  const alt0 = alt(await info());
  i = await until((x) => Math.abs(x.ship.pitchDeg) < 3, 20000, holdPitch(0));
  let a = null;
  for (let n = 0; n < 80; n++) {
    a = await page.evaluate(() => window.__pc.aimAt('moon'));
    if (Math.abs(a.yawDeg) < 3 && Math.abs(a.pitchDeg) < 3) break;
    await look(Math.max(-110, Math.min(110, (a.yawDeg * RAD / MOUSE_SHIP) * 0.4)), -Math.max(-70, Math.min(70, (a.pitchDeg * RAD / MOUSE_SHIP) * 0.4)));
    await sleep(250);
  }
  i = await info();
  const moonHigh = Math.abs(i.ship.pitchDeg) > 72;       // beyond the pitch limit: cannot be centred
  check(Math.abs(a.yawDeg) < 6 && (moonHigh || Math.abs(a.pitchDeg) < 6), `the moon is ahead (off by ${a.yawDeg.toFixed(1)}, ${a.pitchDeg.toFixed(1)} deg), ${(a.distance / 1000).toFixed(1)} km away`);
  await sleep(700);
  await shot('08-moon', '08-moon');
  i = await info();
  check(i.frame === 'earth:orbit' && Math.abs(alt(i) - alt0) < 60, 'a parked ship stays with its planet');
  stage('orbit', i);

  // ---- back down --------------------------------------------------------------------------------------------
  i = await until((x) => x.ship.pitchDeg < -50, 20000, holdPitch(-58));
  await page.keyboard.down('KeyW');
  await sleep(1100);
  await page.keyboard.up('KeyW');
  await timeScale(3);
  i = await until((x) => alt(x) < 1500, 120000, holdPitch(-58));
  await timeScale(1);
  let shotEntry = false;
  i = await until((x) => x.state === 'ATMOSPHERE', 120000, async (x) => {
    await holdPitch(-45)(x);
    if (!shotEntry && alt(x) < 1050) { shotEntry = true; await shot('09-entry', '09-entry'); }
  });
  check(i.state === 'ATMOSPHERE' && i.frame === 'earth:ground', 'entered the atmosphere');
  stage('entry', i);
  i = await until((x) => x.ship.altGround < 170, 120000, holdPitch(-32));
  await page.keyboard.down('KeyS');
  i = await until((x) => x.ship.throttle < 0.3, 8000, holdPitch(-10));
  await page.keyboard.up('KeyS');
  i = await until((x) => x.ship.canLand, 60000, holdPitch(-8));
  check(i.ship.canLand && i.prompt === 'Land here', 'landing prompt shows');
  check(i.ship.bounces === 0, 'never touched the ground on the way down');
  await shot('10-land-prompt', '10-land-prompt');

  // ---- landing assist -----------------------------------------------------------------------------------------
  await page.keyboard.press('KeyE');
  await sleep(300);
  i = await info();
  check(i.state === 'LANDING', 'E starts the landing assist');
  let touch = 99;
  i = await until((x) => x.state === 'LANDED', 60000, async (x) => { touch = x.ship.speed; });
  check(i.state === 'LANDED', 'landed');
  check(touch < 3, `soft touchdown (${touch.toFixed(2)} m/s just before)`);
  await sleep(1500);
  i = await info();
  check(i.ship.speed === 0 && i.ship.gear01 > 0.9, 'at rest, gear down');
  await shot('11-landed', '11-landed');
  stage('landed', i);

  // ---- step out ------------------------------------------------------------------------------------------------
  await page.keyboard.press('KeyE');
  i = await until((x) => x.state === 'ON_FOOT', 6000);
  check(i.state === 'ON_FOOT', 'stepped out with E');
  await sleep(900);
  i = await info();
  check(i.explorer.grounded || i.explorer.mode === 'wade', 'standing beside the ship');
  check(i.shipDistance < 9, 'next to the ship: ' + i.shipDistance.toFixed(1) + ' m');
  const p1 = i.explorer.p;
  await page.keyboard.down('KeyS');
  await sleep(1500);
  await page.keyboard.up('KeyS');
  i = await info();
  check(Math.hypot(i.explorer.p.x - p1.x, i.explorer.p.y - p1.y, i.explorer.p.z - p1.z) > 3, 'walking again');
  await shot('12-stepped-out', '12-stepped-out');
  stage('stepped-out', i);

  const want = ['ON_FOOT', 'BOARDING', 'LANDED', 'ATMOSPHERE', 'SPACE', 'ATMOSPHERE', 'LANDING', 'LANDED', 'BOARDING', 'ON_FOOT'];
  check(JSON.stringify(i.history.slice(-want.length)) === JSON.stringify(want), 'state history: ' + i.history.slice(-want.length).join(' > '));
  const pageErrors = await page.evaluate(() => window.__pc.errors);
  check(pageErrors.length === 0, 'no window errors');
  summary.fps = i.fps;
} catch (e) {
  fails.push('exception: ' + (e && e.stack ? e.stack : e));
  try { await shot('zz-failure'); } catch { /* ignore */ }
}

await close();
check(problems.length === 0, 'no console errors, page errors, failed or external requests' + (problems.length ? ': ' + [...new Set(problems)].slice(0, 6).join(' | ') : ''));
summary.fails = fails;
fs.writeFileSync(path.join(opt.out, 'summary.json'), JSON.stringify(summary, null, 2));
log(fails.length ? `PLAY-THROUGH FAILED (${fails.length})` : 'PLAY-THROUGH PASSED', JSON.stringify(summary.timings));
for (const f of fails) console.log('  - ' + f);
process.exit(fails.length ? 1 : 0);
