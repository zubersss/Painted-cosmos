// The grand tour: every planet in one browser sitting, as a player flies it. From the title card,
// with real key and mouse events only: walk, jetpack, board, lift off, reach space; then for
// each world in turn: choose it on the map, point at its marker, pulse, come down, land, step
// out, walk a few metres, keep a small frame of the place. No page reload, no console error.
//
// What the script does when the screen says no is what the screen tells a player to do:
// "Too close to X: turn away from it first" -> turn the nose away from X, pulse for a moment,
// let go, aim again; "X ahead" (the drive let go in front of something that is not where we
// are going) -> pulse off to one side for a moment, aim again. Every such word is recorded.
//
// Software rendering makes one to three frames a second, so the default is a small picture at
// quality 0: this run proves the play, not the picture.
//
// Usage: node tests/grandtour.mjs [--root dir] [--out dir] [--keep]
//          [--bodies mercury,venus,mars,jupiter,saturn,uranus,neptune,earth]
//          [--from mars]        resume: stand on Mars (window.__pc.teleport, the one debug door
//                               this run uses) and fly on to the worlds after it in the list
//          [--minutes 180]      wall-clock limit for the whole run
//          [--w 400 --h 225] [--query "scale=0.5&quality=0"]
// Writes <out>/grandtour.json after every leg (a resumed run adds to it) and one frame per
// world, <out>/grandtour-<body>.jpg (with --keep also docs/shots/pilot/grandtour-<body>.jpg).
import fs from 'node:fs';
import path from 'node:path';
import { RAD, MOUSE_FOOT, MOUSE_SHIP, parseArgs, startRun, finish } from './browser.mjs';
import { BODIES } from '../src/data/bodies.js';
import { arrivalRadius } from '../src/ship/pulse.js';

const ORDER = 'mercury,venus,mars,jupiter,saturn,uranus,neptune,earth';
const opt = parseArgs({ out: '/home/user/.pc-scratch/pilot/grandtour', w: 400, h: 225, query: 'scale=0.5&quality=0', bodies: ORDER, from: '', minutes: 180 });
const list = String(opt.bodies).split(',').map((s) => s.trim()).filter(Boolean);
for (const b of list) if (!BODIES[b]) { console.error('unknown body: ' + b); process.exit(2); }
if (opt.from && !BODIES[opt.from]) { console.error('unknown body: ' + opt.from); process.exit(2); }
const todo = opt.from && list.includes(opt.from) ? list.slice(list.indexOf(opt.from) + 1) : list;
opt.query += '&dynres=0&pointerlock=0&fresh=1' + (opt.from ? '&card=0' : '');

const recFile = path.join(opt.out, 'grandtour.json');
let record = { legs: [], runs: [] };
if (opt.from) { try { record = JSON.parse(fs.readFileSync(recFile, 'utf8')); } catch { /* a first run */ } }
const saveRecord = () => fs.writeFileSync(recFile, JSON.stringify(record, null, 1));

const run = await startRun(opt);
const { page, check, info, shot, look, gameWait, until, holdPitch, aimShipAt, log } = run;
const summary = { legs: [], timings: {}, said: [] };
const alt = (x) => (x.ship.altitude == null ? 1e9 : x.ship.altitude);
const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const aim = (id) => page.evaluate((b) => window.__pc.aimAt(b), id);
const wall0 = Date.now();
const watchdog = setTimeout(async () => {
  run.fails.push(`the run passed its wall-clock limit of ${opt.minutes} minutes`);
  try { await shot('zz-timeout'); } catch { /* ignore */ }
  record.runs.push({ at: new Date().toISOString(), from: opt.from || 'title', done: summary.legs.map((l) => l.to), timedOut: true });
  saveRecord();
  await finish(run, opt, summary);
}, Number(opt.minutes) * 60000);

// Whatever the game says on its slip of paper while we fly: kept, once each per leg.
function heard(leg, i) { if (i && i.notice && !leg.said.includes(i.notice)) { leg.said.push(i.notice); log('  the screen says: "' + i.notice + '"'); } }

async function chooseOnMap(id) {
  await page.keyboard.press('KeyM');
  await gameWait(0.3);
  const spot = await page.evaluate((b) => {
    const m = window.__pc.map, s = m.spots().find((x) => x.id === b), r = m.canvas.getBoundingClientRect();
    return { open: m.open, x: r.left + (s.x / 680) * r.width, y: r.top + (s.y / 400) * r.height };
  }, id);
  check(spot.open, 'M opens the map');
  await page.mouse.click(spot.x, spot.y);
  await gameWait(0.3);
  const i = await info();
  check(i.target && i.target.id === id, `clicking ${id} on the map sets the course (${i.target ? Math.round(i.target.distance / 1000) + ' km' : 'none'})`);
  await page.keyboard.press('KeyM');
  await gameWait(0.2);
  check((await info()).mapOpen === false, 'M closes the map');
  return i.target;
}

// Turn the ship by mouse until `want(aimAt(id))` (degrees still to turn: yaw right +, pitch up +)
// is small, like following a marker.
async function steerBy(id, want, tol = 20, tries = 70) {
  for (let n = 0; n < tries; n++) {
    const e = want(await aim(id));
    if (Math.abs(e.yaw) < tol && Math.abs(e.pitch) < tol) return true;
    await look(Math.max(-110, Math.min(110, (e.yaw * RAD / MOUSE_SHIP) * 0.4)), -Math.max(-70, Math.min(70, (e.pitch * RAD / MOUSE_SHIP) * 0.4)));
    await gameWait(0.25);
  }
  return false;
}

// A moment of pulse in the direction the nose points, then let go (F again).
async function shortPulse(leg, seconds) {
  await page.keyboard.press('KeyF');
  await gameWait(0.4);
  let i = await info();
  heard(leg, i);
  if (i.state !== 'PULSE') return false;
  await gameWait(seconds);
  if ((await info()).state === 'PULSE') await page.keyboard.press('KeyF');
  i = await until((x) => x.state === 'SPACE', 60);
  return i.state === 'SPACE';
}

// Aim at the world, press F, ride the drive until it lets go; if the way is barred, do what
// the screen says and try again. Returns the info at arrival, or null.
async function pulseTo(to, from, leg) {
  const near = arrivalRadius(BODIES[to]) * 1.3;
  let side = 1;
  for (let attempt = 1; attempt <= 7; attempt++) {
    const a = await aimShipAt(to, 3);
    let i = await info();
    if (attempt === 1) {
      check(Math.abs(a.yawDeg) < 6 && Math.abs(a.pitchDeg) < 6, `nose on ${to} (off by ${a.yawDeg.toFixed(1)}, ${a.pitchDeg.toFixed(1)} deg)`);
      const mark = (i.marks || []).find((m) => m.kind === 'target');
      check(!!mark && Math.abs(mark.x - run.cx) < run.W * 0.12 && Math.abs(mark.y - run.cy) < run.H * 0.2, 'the target marker is on screen near the nose: ' + JSON.stringify(mark));
      leg.prompt = i.prompt;
    }
    await page.keyboard.press('KeyF');
    await gameWait(0.4);
    i = await info();
    heard(leg, i);
    if (i.state !== 'PULSE') {
      // Refused, and the screen says why. "Too close to X: turn away from it first".
      leg.refused.push(i.notice || 'nothing said');
      const m = /^Too close to (.+?):/.exec(i.notice || '') || /^(.+?) is right ahead/.exec(i.notice || '');
      const name = m ? m[1] : null;
      const blocker = name ? Object.keys(BODIES).find((b) => BODIES[b].name === name) : from;
      if (blocker && /^Too close/.test(i.notice || '')) {
        await steerBy(blocker, (x) => ({ yaw: wrap(x.yawDeg + 180), pitch: -x.pitchDeg }), 25);
        await shortPulse(leg, 2.5);
      } else {
        await steerBy(to, (x) => ({ yaw: wrap(x.yawDeg - 85 * side), pitch: x.pitchDeg }), 15);
        await shortPulse(leg, 3);
        side = -side;
      }
      continue;
    }
    const t0 = i.t;
    i = await until((x) => x.state === 'SPACE', 900, (x) => { leg.vMax = Math.max(leg.vMax, Math.round(x.ship.speed)); heard(leg, x); });
    heard(leg, i);
    leg.pulseSeconds = +((leg.pulseSeconds || 0) + (i.t - t0)).toFixed(1);
    if (i.state !== 'SPACE') { leg.problem = 'the pulse never let go'; return null; }
    const d = (await aim(to)).distance;
    if (d < near) { leg.pulses = attempt; leg.arrivedKm = +(d / 1000).toFixed(1); return i; }
    // The drive let go in front of something else ("X ahead"). Go round it.
    leg.barred.push(`${i.notice || 'let go'} (${Math.round(d / 1000)} km still to go)`);
    await steerBy(to, (x) => ({ yaw: wrap(x.yawDeg - 85 * side), pitch: x.pitchDeg }), 15);
    await shortPulse(leg, 3);
    side = -side;
  }
  leg.problem = 'seven tries at the pulse did not arrive';
  return null;
}

// Walk to the ship and climb in (E). A boulder in the way gets a jetpack hop.
async function board(leg) {
  let i = await info();
  if (i.state !== 'ON_FOOT') return i;
  await look((i.shipBearingDeg * RAD) / MOUSE_FOOT, 0);
  await page.keyboard.down('KeyW');
  let slow = 0;
  i = await until((x) => x.canBoard, 90, async (x) => {
    if (Math.abs(x.shipBearingDeg) > 4) await look((x.shipBearingDeg * RAD) / MOUSE_FOOT * 0.6, 0);
    slow = x.explorer.speed < 0.6 ? slow + 1 : 0;
    if (slow >= 6) { slow = 0; await page.keyboard.down('Space'); await run.sleep(500); await page.keyboard.up('Space'); }
  });
  await page.keyboard.up('KeyW');
  if (!i.canBoard) { leg.problem = `could not walk back to the ship (${i.shipDistance.toFixed(1)} m away)`; return i; }
  await page.keyboard.press('KeyE');
  return until((x) => x.state === 'LANDED', 8);
}

async function flyLeg(to, n) {
  let i = await info();
  const from = i.body;
  const leg = { n, from, to, said: [], refused: [], barred: [], vMax: 0, landTries: 0, wall0: Date.now(), t0: +i.t.toFixed(0) };
  log(`LEG ${n}: ${from} -> ${to}`);
  const fail = (why) => { leg.problem = leg.problem || why; check(false, `${from} -> ${to}: ${leg.problem}`); return leg; };
  // ---- to the ship, up, out -------------------------------------------------------------------
  i = await board(leg);
  if (!check(i.state === 'LANDED', 'in the ship on ' + from)) return fail('never got into the ship');
  await page.keyboard.press('Space');
  i = await until((x) => x.state === 'ATMOSPHERE' && !x.ship.liftoff, 12);
  if (!check(i.state === 'ATMOSPHERE', 'lifted off from ' + from)) return fail('the ship did not lift off: ' + (i.notice || i.state));
  await page.keyboard.down('KeyW');
  await gameWait(1.9);
  await page.keyboard.up('KeyW');
  i = await until((x) => x.state === 'SPACE', 400, async (x) => { heard(leg, x); await holdPitch(50)(x); });
  if (!check(i.state === 'SPACE', 'reached space above ' + from)) return fail('never reached space: ' + (i.notice || i.state));
  leg.spaceAt = +(i.t - leg.t0).toFixed(0);
  i = await until((x) => alt(x) > x.ship.spaceAlt * 3, 200, holdPitch(50));
  // ---- choose, aim, pulse ---------------------------------------------------------------------
  const target = await chooseOnMap(to);
  if (!target) return fail('the map did not set the course');
  leg.km = Math.round(target.distance / 1000);
  i = await pulseTo(to, from, leg);
  if (!check(!!i, `arrived at ${to}` + (i ? `: ${leg.arrivedKm} km away after ${leg.pulseSeconds} s of pulse, ${leg.vMax} m/s at most` + (leg.refused.length || leg.barred.length ? `; refused ${leg.refused.length}, barred ${leg.barred.length}` : '') : ''))) return fail('no arrival');
  await gameWait(8);
  i = await info();
  check(i.frame === to + ':orbit', 'flying in the frame of ' + to + ': ' + i.frame);
  // ---- down ---------------------------------------------------------------------------------------
  await until((x) => x.ship.pitchDeg < -50, 30, holdPitch(-58));
  await page.keyboard.down('KeyW');
  await gameWait(1.3);
  await page.keyboard.up('KeyW');
  i = await until((x) => x.state === 'ATMOSPHERE', 400, async (x) => { heard(leg, x); await holdPitch(-58)(x); });
  if (!check(i.state === 'ATMOSPHERE', 'entered the atmosphere of ' + to)) return fail('never entered the atmosphere: ' + i.state + ' at ' + Math.round(alt(i)) + ' m');
  i = await until((x) => x.ship.altGround < 170, 400, async (x) => { heard(leg, x); await holdPitch(-32)(x); });
  await page.keyboard.down('KeyS');
  i = await until((x) => x.ship.throttle < 0.3, 8, holdPitch(-10));
  await page.keyboard.up('KeyS');
  const approach = async (x) => {
    heard(leg, x);
    await holdPitch(x.ship.altGround > 110 ? -18 : -7)(x);
    if (x.ship.throttle < 0.18) { await page.keyboard.down('KeyW'); await run.sleep(120); await page.keyboard.up('KeyW'); }
    if (x.ship.speed > 60 && x.ship.altGround < 170) { await page.keyboard.down('KeyS'); await run.sleep(150); await page.keyboard.up('KeyS'); }
  };
  i = await until((x) => x.ship.canLand, 300, approach);
  if (!check(i.ship.canLand, 'landing prompt over ' + to)) return fail(`no landing prompt: ${Math.round(i.ship.altGround)} m up at ${Math.round(i.ship.speed)} m/s` + (i.notice ? `, "${i.notice}"` : ''));
  // Press E on the prompt, as a player does. If the ground says no ("Too steep to land here"),
  // fly on a little and ask again.
  for (leg.landTries = 1; leg.landTries <= 14; leg.landTries++) {
    await page.keyboard.press('KeyE');
    i = await until((x) => x.state === 'LANDING' || x.state === 'LANDED', 2.5);
    heard(leg, i);
    if (i.state === 'LANDING' || i.state === 'LANDED') break;
    log('  (E did not start a landing: ' + (i.notice || 'no prompt at that moment') + '; flying on)');
    await page.keyboard.down('KeyW'); await run.sleep(260); await page.keyboard.up('KeyW');
    await gameWait(3);
    i = await until((x) => x.ship.canLand, 150, approach);
  }
  i = await until((x) => x.state === 'LANDED', 120, (x) => heard(leg, x));
  if (!check(i.state === 'LANDED', `landed on ${to}` + (leg.landTries > 1 ? ` (asked ${leg.landTries} times)` : ''))) return fail('the landing never completed: ' + i.state + (i.ship.landing ? ' in phase ' + i.ship.landing : '') + (i.notice ? `, "${i.notice}"` : ''));
  leg.bounces = i.ship.bounces;
  await gameWait(1);
  // ---- out, and a few metres on foot ---------------------------------------------------------------
  await page.keyboard.press('KeyE');
  i = await until((x) => x.state === 'ON_FOOT', 8);
  if (!check(i.state === 'ON_FOOT', 'stepped out on ' + to)) return fail('could not step out: ' + i.state);
  const p0 = i.explorer.p;
  await page.keyboard.down('KeyW');
  await gameWait(3);
  await page.keyboard.up('KeyW');
  await gameWait(0.4);
  i = await info();
  leg.walked = +dist3(i.explorer.p, p0).toFixed(1);
  leg.biome = i.mood.biomeId;
  leg.mode = i.explorer.mode;
  leg.hour = +(+i.mood.timeOfDay).toFixed(1);
  check(i.state === 'ON_FOOT' && i.body === to, `standing on ${to} (${leg.biome}, ${leg.mode}, local time ${leg.hour})`);
  check(leg.walked >= 3, `walked ${leg.walked} m on ${to}`);
  check(Array.isArray(i.visited[to]) && i.visited[to].length >= 1, 'the sketchbook has ' + to + ': ' + JSON.stringify(i.visited[to]));
  // Turn round so the frame has the ship in it: this is the picture of having been there.
  if (i.shipBearingDeg != null) await look((i.shipBearingDeg * RAD) / MOUSE_FOOT, 0);
  await gameWait(0.5);
  await shot('grandtour-' + to, 'grandtour-' + to);
  leg.gameSeconds = +(i.t - leg.t0).toFixed(0);
  leg.wallSeconds = Math.round((Date.now() - leg.wall0) / 1000);
  delete leg.wall0;
  leg.landed = true;
  log('  leg done:', JSON.stringify(leg));
  return leg;
}

let reloads = 0;
page.on('framenavigated', (f) => { if (f === page.mainFrame()) reloads++; });
try {
  let i = await info();
  summary.using = i.using;
  log('ready. providers:', JSON.stringify(i.using), opt.from ? `resuming on ${opt.from}; to fly: ${todo.join(', ')}` : `to fly: ${todo.join(', ')}`);
  if (opt.from) {
    await page.evaluate((b) => { const pc = window.__pc, d = pc.world.getSpawn(b).unitDir; pc.teleport({ body: b, dir: [d.x, d.y, d.z] }); }, opt.from);
    await page.mouse.click(run.cx, run.cy);
    await gameWait(1);
    i = await info();
    check(i.state === 'ON_FOOT' && i.body === opt.from, 'resumed on foot on ' + opt.from + ' (teleported: not played)');
  } else {
    // ---- the opening, as a new player meets it --------------------------------------------------
    const card = await page.evaluate(() => window.__pc.game.hud.startShown);
    check(card, 'the title card is up');
    await page.waitForFunction(() => window.__pc.game.canStart !== false, null, { timeout: 600000, polling: 300 });
    await page.mouse.click(run.cx, run.cy);
    await gameWait(0.6);
    check(!(await page.evaluate(() => window.__pc.game.hud.startShown)), 'a click on the title starts the game');
    i = await info();
    check(i.state === 'ON_FOOT' && i.body === 'earth', `on foot on Earth (${i.mood.biomeId})`);
    const p0 = i.explorer.p;
    await page.keyboard.down('KeyW');
    await gameWait(3);
    await page.keyboard.up('KeyW');
    i = await info();
    check(dist3(i.explorer.p, p0) >= 4, `W walks: ${dist3(i.explorer.p, p0).toFixed(1)} m in 3 s`);
    const fuel0 = i.explorer.fuel;
    let top = 0;
    await page.keyboard.down('Space');
    await until(() => false, 1.6, (x) => { top = Math.max(top, x.explorer.altitude); });
    await page.keyboard.up('Space');
    i = await until((x) => { top = Math.max(top, x.explorer.altitude); return x.explorer.grounded; }, 20);
    check(top > 1.5 && i.explorer.fuel < fuel0 + 1e-6, `Space is the jetpack: ${top.toFixed(1)} m up, back on the ground`);
    await shot('grandtour-start');
  }
  let n = 0;
  for (const to of todo) {
    const leg = await flyLeg(to, ++n);
    summary.legs.push(leg);
    record.legs = record.legs.filter((l) => l.to !== to).concat([leg]);
    saveRecord();
    if (!leg.landed) { try { await shot('zz-stopped-at-' + to); } catch { /* ignore */ } break; }
  }
  i = await info();
  const landed = summary.legs.filter((l) => l.landed).map((l) => l.to);
  check(landed.length === todo.length, `landed on ${landed.length} of ${todo.length}: ${landed.join(', ') || 'none'}`);
  check(reloads === 0, 'one sitting: the page was never reloaded (' + reloads + ' navigations)');
  summary.timings.gameSeconds = +i.t.toFixed(0);
  summary.timings.wallMinutes = Math.round((Date.now() - wall0) / 6000) / 10;
  summary.said = [...new Set(summary.legs.flatMap((l) => l.said))];
  summary.visited = Object.keys(i.visited);
} catch (e) {
  run.fails.push('exception: ' + (e && e.stack ? e.stack : e));
  try { await shot('zz-failure'); } catch { /* ignore */ }
}
clearTimeout(watchdog);
record.runs.push({ at: new Date().toISOString(), from: opt.from || 'title', done: summary.legs.filter((l) => l.landed).map((l) => l.to), stoppedAt: (summary.legs.find((l) => !l.landed) || {}).to || null, problem: (summary.legs.find((l) => !l.landed) || {}).problem || null });
saveRecord();
await finish(run, opt, summary);
