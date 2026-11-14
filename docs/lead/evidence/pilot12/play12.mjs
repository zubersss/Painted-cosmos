// PILOT 12, M4 critique, the play for the PHYSICS section, in the game with the HUD, quality 0, real keys and mouse
// (the debug door only to go to a place and set the clock): the first storm at the spawn and the wet bank east of it,
// swimming off Earth's coast, the run at the sea cliff, low flight and the ship's handling on Earth and Mars, the ship
// hovering hands off at Neptune's storm coast, night at quality 0 (for PAINTER's section).
// node play12.mjs --root <tree> --out <dir> [--only storm,swim,cliff,lowfly,squall,night] [--query quality=0]
import fs from 'node:fs';
import path from 'node:path';
const args = process.argv.slice(2);
const root = args[args.indexOf('--root') + 1];
const { RAD, MOUSE_FOOT, MOUSE_SHIP, parseArgs, startRun, finish } = await import(root + '/tests/browser.mjs');
const opt = parseArgs({ out: '/home/user/.pc-scratch/pilot/m4/play', w: 960, h: 540, query: 'quality=0', only: '' });
opt.query += '&dynres=0&pointerlock=0&fresh=1&save=0&audio=0&card=0';
const only = opt.only ? opt.only.split(',') : null;
const want = (k) => !only || only.includes(k);
const run = await startRun(opt);
const { page, check, info, shot, look, gameWait, until, log } = run;
const summary = { query: opt.query, beats: [], traces: {} };
let n = 0;
async function beat(name, extra = {}) {
  await page.evaluate(() => window.__pc.hold(true));
  const i = await info();
  const file = await shot(String(++n).padStart(2, '0') + '-' + name);
  await page.evaluate(() => window.__pc.hold(false));
  const b = { n, name, file: path.basename(file), state: i.state, body: i.body, biome: i.mood && i.mood.biomeId, prompt: i.prompt, notice: i.notice, t: +i.t.toFixed(1), ...extra };
  summary.beats.push(b);
  log(`  beat ${n} ${name}: ${i.state} t ${b.t} prompt "${i.prompt || ''}" notice "${i.notice || ''}" ${JSON.stringify(extra)}`);
  fs.writeFileSync(path.join(opt.out, 'play.json'), JSON.stringify(summary, null, 1));
  return i;
}
const settle = () => page.evaluate(() => window.__pc.settle(6));
const go = async (o) => { await page.evaluate((x) => window.__pc.teleport(x), o); await settle(); };
const sect = async (name, f) => { if (!want(name)) return; log('SECTION ' + name); try { await f(); } catch (e) { run.fails.push(name + ': ' + (e && e.stack ? e.stack : e)); log('  EXCEPTION in ' + name + ': ' + (e && e.message)); try { await page.evaluate(() => window.__pc.hold(false)); } catch { /* gone */ } } };
const spawnDir = (b) => page.evaluate((b) => { const d = window.__pc.world.getSpawn(b).unitDir; return [d.x, d.y, d.z]; }, b);
const stand = (b, bi) => page.evaluate(([b, bi]) => { const a = window.__pc.world.findBiome(b, bi); return [a.unitDir.x, a.unitDir.y, a.unitDir.z]; }, [b, bi]);
const wx = () => page.evaluate(() => { const h = window.__pc.physics && window.__pc.physics.here; return h ? { kind: h.weather.kind, wind: +h.air.speed.toFixed(1), rain: +h.weather.precipitation.rate.toFixed(1) } : null; });
// every 0.5 s of game time for `secs`: what f(info) returns
async function trace(name, secs, f) {
  const rows = []; let i = await info(); const t0 = i.t; let next = 0;
  while (i.t - t0 < secs) { if (i.t - t0 >= next) { rows.push({ t: +(i.t - t0).toFixed(2), ...f(i) }); next += 0.5; } await run.sleep(25); i = await info(); }
  summary.traces[name] = rows; fs.writeFileSync(path.join(opt.out, 'play.json'), JSON.stringify(summary, null, 1));
  return rows;
}
const R = (p) => Math.hypot(p.x, p.y, p.z);

await sect('storm', async () => {
  const sp = await spawnDir('earth');
  await page.evaluate(() => window.__pc.setClock(232));
  await go({ body: 'earth', dir: sp, heading: 90 });
  await gameWait(3);
  await beat('storm-spawn', { wx: await wx() });
  const p0 = (await info()).explorer.p;
  await page.keyboard.down('KeyW');
  const rows = await trace('storm-walk-east', 12, (i) => ({ made: +Math.hypot(i.explorer.p.x - p0.x, i.explorer.p.y - p0.y, i.explorer.p.z - p0.z).toFixed(1), pace: +i.explorer.speed.toFixed(2), slope: +(i.explorer.slope * 57.3).toFixed(0), mode: i.explorer.mode }));
  await beat('storm-wet-bank-W-held', { wx: await wx(), last: rows.slice(-4) });
  await page.keyboard.down('ShiftLeft');
  const rows2 = await trace('storm-run-on', 4, (i) => ({ made: +Math.hypot(i.explorer.p.x - p0.x, i.explorer.p.y - p0.y, i.explorer.p.z - p0.z).toFixed(1), pace: +i.explorer.speed.toFixed(2), slope: +(i.explorer.slope * 57.3).toFixed(0), mode: i.explorer.mode }));
  await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW');
  await beat('storm-after-shift', { last: rows2.slice(-3) });
  // the same walk in fair weather, for the pair
  await page.evaluate(() => window.__pc.setClock(30));
  await go({ body: 'earth', dir: sp, heading: 90 });
  await gameWait(1);
  const q0 = (await info()).explorer.p;
  await page.keyboard.down('KeyW');
  const rows3 = await trace('fair-walk-east', 12, (i) => ({ made: +Math.hypot(i.explorer.p.x - q0.x, i.explorer.p.y - q0.y, i.explorer.p.z - q0.z).toFixed(1), pace: +i.explorer.speed.toFixed(2), slope: +(i.explorer.slope * 57.3).toFixed(0), mode: i.explorer.mode }));
  await page.keyboard.up('KeyW');
  await beat('fair-same-bank', { wx: await wx(), last: rows3.slice(-4) });
});

await sect('swim', async () => {
  const st = await stand('earth', 'sea_coast');
  await page.evaluate(() => window.__pc.setClock(600));
  // PHYSICS' Node bearing of the nearest deep water from the stand: 120 degrees, 24 m
  await go({ body: 'earth', dir: st, heading: 120, hour: 11 });
  await gameWait(1);
  await beat('coast-facing-the-sea', { wx: await wx() });
  await page.keyboard.down('KeyW');
  await trace('walk-in', 9, (i) => ({ pace: +i.explorer.speed.toFixed(2), depth: +i.explorer.liquidDepth.toFixed(2), mode: i.explorer.mode, grounded: i.explorer.grounded }));
  await beat('wading-in');
  await trace('swim-out', 8, (i) => ({ pace: +i.explorer.speed.toFixed(2), depth: +i.explorer.liquidDepth.toFixed(2), mode: i.explorer.mode, vUp: +i.explorer.vUp.toFixed(2) }));
  await beat('swimming');
  await page.keyboard.up('KeyW');
  await trace('let-go', 4, (i) => ({ pace: +i.explorer.speed.toFixed(2), depth: +i.explorer.liquidDepth.toFixed(2), vUp: +i.explorer.vUp.toFixed(2) }));
  await beat('afloat-still');
  await page.keyboard.down('Space'); await gameWait(1.2);
  await beat('jet-out-of-the-water');
  await page.keyboard.up('Space');
  await until((x) => x.explorer.liquidDepth > 0.8, 15);
  await gameWait(0.3);
  await beat('back-in-the-water');
});

await sect('cliff', async () => {
  const st = await stand('earth', 'sea_coast');
  await page.evaluate(() => window.__pc.setClock(600));
  await go({ body: 'earth', dir: st, heading: 0, hour: 11 });
  const r0 = R((await info()).explorer.p);
  await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW');
  const rows = await trace('cliff-run', 9, (i) => ({ up: +(R(i.explorer.p) - r0).toFixed(1), pace: +i.explorer.speed.toFixed(2), vUp: +i.explorer.vUp.toFixed(2), slope: +(i.explorer.slope * 57.3).toFixed(0), grounded: i.explorer.grounded, mode: i.explorer.mode }));
  await beat('cliff-run-9s', { climbed: rows[rows.length - 1].up });
  await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
  log('  cliff: ' + JSON.stringify(rows.filter((_, k) => k % 3 === 0)));
});

await sect('lowfly', async () => {
  for (const [body, biome] of [['earth', 'alpine_meadow'], ['mars', 'rust_canyons']]) {
    const st = await stand(body, biome);
    await page.evaluate(() => window.__pc.setClock(30));
    await page.evaluate(([b, u]) => window.__pc.teleport({ body: b, dir: u, ship: true, altitude: 25, heading: 0, throttle: 0, hour: 10 }), [body, st]);
    await settle(); await gameWait(1);
    await beat(`hover-${body}`, { wx: await wx() });
    await page.keyboard.down('KeyW');
    const rows = await trace(`throttle-up-${body}`, 6, (i) => ({ v: +i.ship.speed.toFixed(1), alt: +i.ship.altGround.toFixed(1), thr: +i.ship.throttle.toFixed(2) }));
    await page.keyboard.up('KeyW');
    await beat(`low-flight-${body}`, { v: rows[rows.length - 1].v, alt: rows[rows.length - 1].alt });
    await page.keyboard.down('KeyA');
    const rows2 = await trace(`turn-${body}`, 3, (i) => ({ v: +i.ship.speed.toFixed(1), alt: +i.ship.altGround.toFixed(1) }));
    await page.keyboard.up('KeyA');
    await beat(`turning-${body}`, { v: rows2[rows2.length - 1].v });
    await page.keyboard.down('KeyX');
    const rows3 = await trace(`brake-${body}`, 5, (i) => ({ v: +i.ship.speed.toFixed(1), alt: +i.ship.altGround.toFixed(1) }));
    await page.keyboard.up('KeyX');
    await page.keyboard.down('KeyS'); await gameWait(1.5); await page.keyboard.up('KeyS');
    let i = await until((x) => x.ship.canLand, 20);
    await beat(`before-landing-${body}`, { canLand: i.ship.canLand });
    await page.keyboard.press('KeyE');
    const rows4 = await trace(`landing-${body}`, 8, (i) => ({ v: +i.ship.speed.toFixed(1), alt: +i.ship.altGround.toFixed(1), vUp: +i.ship.vUp.toFixed(2), state: i.state }));
    i = await until((x) => x.state === 'LANDED', 20);
    await beat(`landed-${body}`, { state: i.state });
  }
});

await sect('squall', async () => {
  const st = await stand('neptune', 'storm_seas');
  await page.evaluate(() => window.__pc.setClock(203));
  await page.evaluate((u) => window.__pc.teleport({ body: 'neptune', dir: u, ship: true, altitude: 30, heading: 0, throttle: 0, hour: 11 }), st);
  await settle();
  await beat('squall-hover-start', { wx: await wx() });
  const rows = [];
  for (let k = 0; k < 6; k++) {
    const part = await trace('squall-' + k, 2, (i) => ({ alt: +i.ship.altGround.toFixed(1), v: +i.ship.speed.toFixed(1), vUp: +i.ship.vUp.toFixed(1) }));
    rows.push(...part);
    await beat('squall-hover-' + (k + 1) * 2 + 's', { wx: await wx(), last: part[part.length - 1] });
  }
  log('  squall: ' + JSON.stringify(rows.filter((_, k) => k % 2 === 0)));
});

await sect('night', async () => {
  for (const [b, h] of [['earth', 0], ['mars', 0], ['moon', 0]]) {
    await page.evaluate(() => window.__pc.setClock(40));
    await go({ body: b, hour: h });
    await gameWait(1);
    await beat('night-' + b + '-q0', { hour: h });
  }
});

summary.errors = await page.evaluate(() => window.__pc.errors);
summary.fallback = await page.evaluate(() => window.__pc.info().fallback);
await finish(run, opt, summary);
