// Scripted headless trip: Earth to Mars to Saturn in one sitting, no reload, with real key and
// mouse events. Lift off, choose the world on the map, point at its marker, pulse, descend,
// land, step out; twice. Then reload the page and check the game continues from its save.
//
// Usage: node tests/trip.mjs [--out dir] [--keep] [--w 640 --h 360] [--query "..."] [--root dir]
// Default query runs Pilot's stub visuals with PHYSICS wired in.
import { RAD, MOUSE_FOOT, parseArgs, startRun, finish } from './browser.mjs';

const opt = parseArgs({ out: '/home/user/.pc-scratch/pilot/trip', w: 640, h: 360, query: 'stub=render,world,art' });
opt.query += '&dynres=0&pointerlock=0&card=0&fresh=1';
const run = await startRun(opt);
const { page, check, info, shot, look, gameWait, until, holdPitch, aimShipAt, log } = run;
const summary = { legs: [], timings: {} };
const alt = (x) => (x.ship.altitude == null ? 1e9 : x.ship.altitude);

async function chooseOnMap(id, shotName, keepAs) {
  await page.keyboard.press('KeyM');
  await gameWait(0.3);
  const spot = await page.evaluate((b) => {
    const m = window.__pc.map, s = m.spots().find((x) => x.id === b), r = m.canvas.getBoundingClientRect();
    return { open: m.open, x: r.left + (s.x / 680) * r.width, y: r.top + (s.y / 400) * r.height };
  }, id);
  check(spot.open, 'M opens the map');
  await page.mouse.click(spot.x, spot.y);
  await gameWait(0.3);
  if (shotName) await shot(shotName, keepAs);
  const i = await info();
  check(i.target && i.target.id === id, `clicking ${id} on the map sets the course (${i.target ? Math.round(i.target.distance / 1000) + ' km' : 'none'})`);
  await page.keyboard.press('KeyM');
  await gameWait(0.2);
  check((await info()).mapOpen === false, 'M closes the map');
  return i.target;
}

async function leg(to, n) {
  let i = await info();
  const from = i.body;
  log(`LEG ${n}: ${from} -> ${to}`);
  // ---- to the ship, up, out ----------------------------------------------------------------
  if (i.state === 'ON_FOOT') {
    await look((i.shipBearingDeg * RAD) / MOUSE_FOOT, 0);
    await page.keyboard.down('KeyW');
    i = await until((x) => x.canBoard, 40, async (x) => { if (Math.abs(x.shipBearingDeg) > 4) await look((x.shipBearingDeg * RAD) / MOUSE_FOOT * 0.6, 0); });
    await page.keyboard.up('KeyW');
    await page.keyboard.press('KeyE');
    i = await until((x) => x.state === 'LANDED', 6);
  }
  check(i.state === 'LANDED', 'in the ship on ' + from);
  await page.keyboard.press('Space');
  i = await until((x) => x.state === 'ATMOSPHERE' && !x.ship.liftoff, 8);
  await page.keyboard.down('KeyW');
  await gameWait(1.9);
  await page.keyboard.up('KeyW');
  i = await until((x) => x.state === 'SPACE', 180, holdPitch(50));
  check(i.state === 'SPACE', 'reached space above ' + from);
  i = await until((x) => alt(x) > x.ship.spaceAlt * 3, 120, holdPitch(50));
  // ---- choose, aim, pulse ---------------------------------------------------------------------
  const target = await chooseOnMap(to, n === 1 ? 'm2-map' : null, 'm2-map');
  const a = await aimShipAt(to, 3);
  i = await info();
  check(Math.abs(a.yawDeg) < 6 && Math.abs(a.pitchDeg) < 6, `nose on ${to} (off by ${a.yawDeg.toFixed(1)}, ${a.pitchDeg.toFixed(1)} deg)`);
  check(i.prompt === 'Pulse to ' + target.name, 'prompt: ' + i.prompt);
  const mark = (i.marks || []).find((m) => m.kind === 'target');
  check(!!mark && Math.abs(mark.x - run.cx) < run.W * 0.12 && Math.abs(mark.y - run.cy) < run.H * 0.2, 'the target marker is on screen near the nose: ' + JSON.stringify(mark));
  if (n === 1) await shot('m2-target', 'm2-target');
  const t0 = i.t, d0 = target.distance;
  await page.keyboard.press('KeyF');
  await gameWait(0.4);
  i = await info();
  check(i.state === 'PULSE', 'F engages the pulse drive' + (i.notice ? ' (' + i.notice + ')' : ''));
  let vMax = 0, shotPulse = false;
  i = await until((x) => x.state === 'SPACE', 400, async (x) => {
    vMax = Math.max(vMax, x.ship.speed);
    if (!shotPulse && x.ship.speed > 6000 && n === 1) { shotPulse = true; await shot('m2-pulse', 'm2-pulse'); }
  });
  check(i.state === 'SPACE', 'the drive lets go by itself');
  const d1 = i.target ? i.target.distance : (await page.evaluate((b) => window.__pc.aimAt(b), to)).distance;
  check(d1 < 20e3, `arrived: ${to} is ${(d1 / 1000).toFixed(1)} km away (was ${Math.round(d0 / 1000)} km)`);
  check(vMax > 3000, 'pulse speed reached ' + Math.round(vMax) + ' m/s');
  const legInfo = { from, to, km: Math.round(d0 / 1000), pulseSeconds: +(i.t - t0).toFixed(1), vMax: Math.round(vMax) };
  await gameWait(8);
  i = await info();
  check(i.frame === to + ':orbit', 'flying in the frame of ' + to + ': ' + i.frame);
  if (n === 1) await shot('m2-arrival');
  // ---- down ----------------------------------------------------------------------------------------
  await until((x) => x.ship.pitchDeg < -50, 20, holdPitch(-58));
  await page.keyboard.down('KeyW');
  await gameWait(1.3);
  await page.keyboard.up('KeyW');
  i = await until((x) => x.state === 'ATMOSPHERE', 300, holdPitch(-58));
  check(i.state === 'ATMOSPHERE', 'entered the atmosphere of ' + to);
  i = await until((x) => x.ship.altGround < 170, 300, holdPitch(-32));
  await page.keyboard.down('KeyS');
  i = await until((x) => x.ship.throttle < 0.3, 8, holdPitch(-10));
  await page.keyboard.up('KeyS');
  i = await until((x) => x.ship.canLand, 240, async (x) => {
    await holdPitch(x.ship.altGround > 110 ? -18 : -7)(x);
    if (x.ship.throttle < 0.18) { await page.keyboard.down('KeyW'); await run.sleep(120); await page.keyboard.up('KeyW'); }
  });
  check(i.ship.canLand, 'landing prompt over ' + to);
  await page.keyboard.press('KeyE');
  i = await until((x) => x.state === 'LANDED', 90);
  check(i.state === 'LANDED', 'landed on ' + to);
  check(i.ship.bounces === 0, 'no bumps');
  await gameWait(1);
  await page.keyboard.press('KeyE');
  i = await until((x) => x.state === 'ON_FOOT', 6);
  await page.keyboard.down('KeyW');
  await gameWait(2);
  await page.keyboard.up('KeyW');
  i = await info();
  check(i.state === 'ON_FOOT' && i.body === to, `standing on ${to} (${i.mood.biomeId})`);
  check(Array.isArray(i.visited[to]) && i.visited[to].length >= 1, 'the sketchbook has ' + to + ': ' + JSON.stringify(i.visited[to]));
  await shot(n === 1 ? 'm2-mars' : 'm2-saturn', n === 1 ? 'm2-mars' : 'm2-saturn');
  legInfo.arrivedAt = +i.t.toFixed(0);
  summary.legs.push(legInfo);
  log('  leg done:', JSON.stringify(legInfo));
}

try {
  let i = await info();
  summary.using = i.using;
  log('ready. providers:', JSON.stringify(i.using));
  check(i.state === 'ON_FOOT' && i.body === 'earth', 'starts on foot on Earth');
  await page.mouse.click(run.cx, run.cy);
  await leg('mars', 1);
  await leg('saturn', 2);
  i = await info();
  check(JSON.stringify(Object.keys(i.visited).sort()) === JSON.stringify(['earth', 'mars', 'saturn']), 'three worlds in the sketchbook: ' + Object.keys(i.visited).join(', '));
  summary.timings.gameSeconds = +i.t.toFixed(0);
  const frames0 = i.frames;
  // ---- the frame read-out ---------------------------------------------------------------------------
  await page.keyboard.press('Backquote');
  await gameWait(0.6);
  i = await info();
  check(i.stats.shown && i.stats.tris > 0 && i.stats.calls > 0, `frame read-out: ${i.stats.frameMs} ms, ${i.stats.tris} triangles, ${i.stats.calls} calls`);
  await shot('m2-stats', 'm2-stats');
  await page.keyboard.press('Backquote');
  // ---- save: reload and continue --------------------------------------------------------------------
  await gameWait(1);
  const saved = await page.evaluate(() => { try { return JSON.parse(window.__pc.storage.getItem('painted-cosmos.save')); } catch { return null; } });
  check(saved && saved.bodyId === 'saturn' && saved.state === 'ON_FOOT', 'autosave wrote the visit to Saturn');
  check(i.frames > frames0 - 1, 'one sitting: the page was never reloaded during the trip');
  // (The painted pipeline in software GL can take over 30 s to load: no default time limit.)
  await page.goto(run.baseUrl + '/index.html?' + opt.query.replace('&fresh=1', ''), { timeout: 600000, waitUntil: 'commit' });
  await page.waitForFunction('window.__pcReady === true', null, { timeout: 300000, polling: 200 });
  i = await info();
  check(i.body === 'saturn' && i.state === 'ON_FOOT', 'after a reload the game continues on Saturn: ' + i.body + ' ' + i.state);
  check(Object.keys(i.visited).length === 3, 'the sketchbook survived the reload');
  check(i.explorer.grounded, 'standing on the ground after loading');
} catch (e) {
  run.fails.push('exception: ' + (e && e.stack ? e.stack : e));
  try { await shot('zz-failure'); } catch { /* ignore */ }
}
await finish(run, opt, summary);
