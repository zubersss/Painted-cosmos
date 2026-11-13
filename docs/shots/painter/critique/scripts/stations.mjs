// stations.mjs: weather, night, a vista, the sea, by the debug teleport (window.__pc.teleport / setClock / setHour), then
// played with real keys. Usage: node stations.mjs <root> <out> [part,part,...]
import fs from 'node:fs';
import path from 'node:path';
import { start, RAD, MOUSE_FOOT, MOUSE_SHIP } from './plib.mjs';
const [root, out, partsArg] = process.argv.slice(2);
const parts = (partsArg || 'calm,storm,night,vista,coast,landing,blizzard,neptune,dust,reeds').split(',');
const G = await start({ root, out, w: 960, h: 540, query: 'dynres=0&pointerlock=0&fresh=1&save=0&audio=0&quality=2' });
const { page, log, info, probe, drag, press, release, tap, run, shot, shotRaw, film, holdPitch, settle } = G;
const slipOn = () => page.evaluate(() => { const e = document.querySelector('.pc-newsketch'); return !!(e && e.classList.contains('pc-on')); });
const place = async (name, js) => {
  await page.evaluate(() => { window.__pc.hold(true); });
  const r = await page.evaluate(js);
  const st = await settle();
  log(name, 'placed', JSON.stringify(r), 'settled', JSON.stringify(st));
};
const SPAWN = (T, hour, heading, pitch) => `(() => { const pc = window.__pc, d = pc.world.getSpawn('earth').unitDir; pc.setClock(${T}); pc.teleport({ body: 'earth', dir: [d.x, d.y, d.z], hour: ${hour}${heading == null ? '' : ', heading: ' + heading + ', lookPitch: ' + pitch}, firstPerson: false }); return { t: pc.sim.t }; })()`;
const STAND = (body, biome, T, hour, heading, pitch) => `(() => { const pc = window.__pc, at0 = pc.world.findBiome('${body}', '${biome}'), d = at0.unitDir || at0, deg = (r) => r * 180 / Math.PI;
  pc.setClock(${T}); pc.teleport({ body: '${body}', dir: [d.x, d.y, d.z], hour: ${hour}, heading: ${heading == null ? 'deg(at0.yaw || 0)' : heading}, lookPitch: ${pitch == null ? -4 : pitch}, firstPerson: false }); return { yaw: deg(at0.yaw || 0) }; })()`;
// a coast: march out from the stand to the waterline; stand `back` m short of it on the beach, facing the sea (PHYSICS' critique script)
const COAST = (body, biome, T, back, hour = 11) => `(() => { const pc = window.__pc, w = pc.world, at0 = w.findBiome('${body}', '${biome}'), d0 = at0.unitDir || at0;
  const nrm = (v) => { const l = Math.hypot(v.x, v.y, v.z); return { x: v.x / l, y: v.y / l, z: v.z / l }; };
  const crs = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
  const d = nrm(d0), ref = Math.abs(d.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 }, e = nrm(crs(ref, d)), n = crs(d, e), R = w.sampleSurface('${body}', d).radius;
  const at = (E, N) => nrm({ x: d.x * R + e.x * E + n.x * N, y: d.y * R + e.y * E + n.y * N, z: d.z * R + e.z * E + n.z * N });
  const wet = (E, N) => { const s = w.sampleSurface('${body}', at(E, N)); return (s.liquidRadius || 0) - s.radius > 0; };
  const w0 = wet(0, 0); let hit = null;
  for (let r = 4; r <= 900 && !hit; r += 4) for (let k = 0; k < 32 && !hit; k++) { const a = k / 32 * 2 * Math.PI; if (wet(Math.cos(a) * r, Math.sin(a) * r) !== w0) hit = { a, r }; }
  let lo = hit.r - 4, hi = hit.r; for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2; if (wet(Math.cos(hit.a) * m, Math.sin(hit.a) * m) !== w0) hi = m; else lo = m; }
  const sg = w0 ? -1 : 1, rr = hi - sg * ${back}, q = at(Math.cos(hit.a) * rr, Math.sin(hit.a) * rr);
  const heading = Math.atan2(Math.cos(hit.a) * sg, Math.sin(hit.a) * sg) * 180 / Math.PI;
  pc.setClock(${T}); pc.teleport({ body: '${body}', dir: [q.x, q.y, q.z], hour: ${hour}, heading, lookPitch: -8, firstPerson: false });
  return { waterline: hi, heading }; })()`;
const part = async (name, fn) => { if (!parts.includes(name)) return; const w0 = Date.now(); try { await fn(); } catch (e) { log('PART FAILED', name, String(e.stack || e.message).split('\n').slice(0, 3).join(' | ')); try { await shotRaw('zz-failed-' + name); } catch { /* ignore */ } } log('part', name, 'took', ((Date.now() - w0) / 60000).toFixed(1), 'min'); };
try {
  await page.evaluate(() => { const st = window.setTimeout; window.setTimeout = (f, ms, ...a) => st(f, ms === 5000 ? 240000 : ms, ...a); });
  await page.mouse.click(G.cx, G.cy);
  await G.hold(true);
  await run(0.5);

  // ---- the spawn in fair weather (the first minute): is the painting alive? ----
  await part('calm', async () => {
    await place('calm', SPAWN(40, 9.9, null, null));
    await run(2);
    const started = await page.evaluate(() => window.__pc.game.started);
    await shot('b00-calm');
    await film('b00-calm-slow', { frames: 8, every: 15, dt: 1 / 30 });
    await drag(0, -230); await run(0.3);
    await film('b00-calm-crowns', { frames: 6, every: 15, dt: 1 / 30 });
    await drag(0, 230);
    await tap('Backquote'); await run(0.2); await shot('b00-stats'); await tap('Backquote'); await run(0.2);
  });

  // ---- the first thunderstorm at the spawn (PHYSICS' clock: drops from 140 s, heaviest 200 to 260 s, a new player's fourth minute) ----
  await part('storm', async () => {
    await place('storm', SPAWN(186, 12.2, null, null));
    await run(14, { dt: 0.1 });
    await shot('b01-storm');
    await film('b02-storm', { frames: 8, every: 1, dt: 1 / 30, all: true });
    await film('b03-storm-slow', { frames: 6, every: 12, dt: 1 / 30 });
    await press('KeyW');
    await film('b04-storm-walk', { frames: 6, every: 6, dt: 1 / 30 });
    await release('KeyW');
    await run(0.6);
    await page.evaluate(() => window.__pc.flash(3));
    await film('b05-flash', { frames: 3, every: 1, dt: 1 / 30, all: true });
    await drag(0, -230); await run(0.3);                       // look up into the crowns
    await film('b06-storm-crowns', { frames: 6, every: 1, dt: 1 / 30, all: true });
    await film('b07-storm-crowns-slow', { frames: 4, every: 12, dt: 1 / 30 });
    await drag(0, 230);
  });

  // ---- the day turning to night at the spawn as the game's clock drives it (a clear afternoon: the clock at 420 s) ----
  await part('night', async () => {
    await place('night', SPAWN(420, 16.6, null, null));
    await run(1);
    await film('b10-dusk', { frames: 14, every: 150, dt: 0.1, hud: true });       // 15 s of play between frames
    await shot('b11-night');
    await film('b12-night', { frames: 4, every: 1, dt: 1 / 30, all: true });
    let i = await info();
    await drag((i.shipBearingDeg || 0) * RAD / MOUSE_FOOT, 0);
    await press('KeyW');
    i = await run(60, { dt: 0.1, until: (j) => j.canBoard, steer: async (j) => { if (j.shipBearingDeg != null && Math.abs(j.shipBearingDeg) > 4) await drag(j.shipBearingDeg * RAD / MOUSE_FOOT * 0.5, 0); } });
    await release('KeyW'); await run(0.4);
    await shot('b13-night-prompt');
    await tap('KeyB'); await run(0.2); await shot('b14-night-book');
    await tap('KeyB'); await run(0.2);
    await tap('KeyV'); await run(0.6); await shot('b15-night-first-person');
    await tap('KeyV'); await run(0.6);
    await tap('KeyE'); await run(3.2);
    await shot('b16-night-seated');
    await tap('Space');
    await film('b17-night-liftoff', { frames: 5, every: 20, dt: 1 / 30, hud: true });
    await press('KeyW');
    await film('b18-night-climb', { frames: 5, every: 12, dt: 0.25, hud: true, steer: holdPitch(40) });
    await release('KeyW');
    await page.evaluate(SPAWN(420, 3.9, null, null)); await settle();
    await run(1);
    await film('b19-dawn', { frames: 12, every: 150, dt: 0.1, hud: true });
  });

  // ---- a view for the sketchbook: walk up to Earth's first vista ----
  await part('vista', async () => {
    await place('vista', `(() => { const pc = window.__pc, w = pc.world, vs = w.getVistas('earth'), v = vs.find((x) => /temperate/i.test(x.name)) || vs[0], sp = w.getSpawn('earth').unitDir;
      const nrm = (a) => { const l = Math.hypot(a.x, a.y, a.z); return { x: a.x / l, y: a.y / l, z: a.z / l }; };
      const d = nrm(v.unitDir), R = w.sampleSurface('earth', d).radius;
      let t = { x: sp.x - d.x, y: sp.y - d.y, z: sp.z - d.z }; const k = t.x * d.x + t.y * d.y + t.z * d.z; t = nrm({ x: t.x - d.x * k, y: t.y - d.y * k, z: t.z - d.z * k });
      const q = nrm({ x: d.x * R + t.x * 34, y: d.y * R + t.y * 34, z: d.z * R + t.z * 34 });
      pc.setClock(420); pc.teleport({ body: 'earth', dir: [q.x, q.y, q.z], hour: 10, firstPerson: false });
      const R0 = w.sampleSurface('earth', sp).radius, far = Math.acos(Math.min(1, d.x * sp.x + d.y * sp.y + d.z * sp.z)) * R0;
      const n = pc.sim.nearestVista(); return { vistas: vs.map((x) => x.name), chosen: v.name, metresFromSpawn: Math.round(far), near: n && { name: n.name, d: n.distance, bearing: n.bearingDeg } }; })()`);
    let n = await page.evaluate(() => { const v = window.__pc.sim.nearestVista(); return v && { d: v.distance, b: v.bearingDeg }; });
    await drag((n.b || 0) * RAD / MOUSE_FOOT, 0); await run(0.3);
    await shot('b20-vista-far', { settleFirst: true });
    await tap('KeyB'); await run(0.2); await shot('b20-book-hint'); await tap('KeyB'); await run(0.2);
    await press('KeyW');
    let i = await run(40, { dt: 0.1, until: (j) => /view/i.test(j.notice || ''), steer: async () => { const v = await page.evaluate(() => { const x = window.__pc.sim.nearestVista(); return x && { d: x.distance, b: x.bearingDeg }; }); if (v && Math.abs(v.b) > 5) await drag(v.b * RAD / MOUSE_FOOT * 0.5, 0); } });
    await release('KeyW'); await run(0.5);
    await shot('b21-vista-found');
    log('settle for the sketch', JSON.stringify(await settle()));
    let on = await slipOn();
    for (let k = 0; k < 150 && !on; k++) { await run(0.1, { dt: 0.1 }); on = await slipOn(); }
    log('slip on', on);
    await shot('b22-vista-slip');
    await tap('KeyB'); await run(0.2); await shot('b23-book-vista'); await tap('KeyB'); await run(0.2);
    await tap('KeyV'); await run(0.6); await shot('b24-vista-first-person', { settleFirst: true }); await tap('KeyV'); await run(0.6);
  });

  // ---- Earth's coast: the sea and the surf on a fair day, wading, swimming; then its storm ----
  await part('coast', async () => {
    await place('coast', COAST('earth', 'sea_coast', 600, 6));
    await run(1);
    await shot('b30-coast');
    await film('b31-sea', { frames: 6, every: 1, dt: 1 / 30, all: true });
    await film('b32-sea-slow', { frames: 6, every: 15, dt: 1 / 30 });
    await press('KeyW');
    await film('b33-wade', { frames: 12, every: 10, dt: 1 / 30 });
    let j = await run(20, { dt: 1 / 30, until: (x) => x.explorer.liquidDepth > 1.25 });
    log('swimming?', JSON.stringify({ depth: j.explorer.liquidDepth, mode: j.explorer.mode }));
    await film('b34-swim', { frames: 6, every: 12, dt: 1 / 30, hud: true });
    await release('KeyW');
    await film('b35-swim-still', { frames: 4, every: 10, dt: 1 / 30 });
    await tap('KeyV'); await run(0.6); await shot('b36-swim-first-person'); await tap('KeyV'); await run(0.6);
    await drag(430, 0); await run(0.4); await shot('b37-swim-looking-back');
    await place('coast-storm', COAST('earth', 'sea_coast', 8836, 6));
    await run(8);
    await shot('b38-coast-storm');
    await film('b39-storm-sea', { frames: 6, every: 1, dt: 1 / 30, all: true });
    await film('b39-storm-sea-slow', { frames: 6, every: 15, dt: 1 / 30 });
  });

  // ---- setting down in the wood by the spawn and stepping out (the chase camera among crowns; the first view on foot) ----
  await part('landing', async () => {
    await place('landing', `(() => { const pc = window.__pc, d = pc.world.getSpawn('earth').unitDir; pc.setClock(420); pc.teleport({ body: 'earth', dir: [d.x, d.y, d.z], hour: 10.5, ship: true, altitude: 28, heading: 40 }); return { t: pc.sim.t }; })()`);
    await run(1.5, { dt: 0.1 });
    await shot('b80-over-the-wood');
    await press('KeyC');
    let i = await run(30, { dt: 0.1, until: (x) => x.ship.canLand });
    await release('KeyC');
    log('land prompt', JSON.stringify({ canLand: i.ship.canLand, prompt: i.prompt, hAG: i.ship.altGround }));
    await shot('b81-land-prompt');
    await tap('KeyE');
    await film('b82-landing', { frames: 12, every: 5, dt: 0.1, until: (p) => p.st === 'LANDED' });
    await run(1.5);
    await shot('b83-landed');
    await tap('KeyE');
    await film('b84-stepout', { frames: 6, every: 4, dt: 0.1 });
    await run(0.6);
    await shot('b85-stepped-out', { settleFirst: true });
  });

  // ---- a blizzard on Earth's alpine meadow (120 to 220 s) ----
  await part('blizzard', async () => {
    await place('blizzard', `(() => { const pc = window.__pc; pc.setClock(160); pc.teleport({ body: 'earth', lat: 62.41, lon: 49.46, hour: 11, firstPerson: false }); return { t: pc.sim.t }; })()`);
    await run(28, { dt: 0.1 });
    await shot('b40-blizzard');
    await film('b41-snow', { frames: 6, every: 1, dt: 1 / 30, all: true });
    await film('b41-snow-slow', { frames: 4, every: 12, dt: 1 / 30 });
    await press('KeyW');
    await film('b42-snow-walk', { frames: 6, every: 8, dt: 1 / 30 });
    await release('KeyW'); await run(0.8);
    await drag(430, 0); await run(0.3); await shot('b43-snow-tracks');
  });

  // ---- Neptune's storm coast in its squall (75 m/s at 240 s): the figure in a gale, the ship in it ----
  await part('neptune', async () => {
    await place('neptune', STAND('neptune', 'storm_seas', 232, 11, null, -4));
    await run(6, { dt: 0.1 });
    await shot('b50-neptune', { uiWait: 1500 });
    await film('b51-gale', { frames: 8, every: 3, dt: 1 / 30 });
    await press('KeyW');
    await film('b52-gale-walk', { frames: 8, every: 5, dt: 1 / 30 });
    await release('KeyW');
    await film('b53-gale-sea', { frames: 6, every: 1, dt: 1 / 30, all: true });
    await place('neptune-ship', `(() => { const pc = window.__pc, at0 = pc.world.findBiome('neptune', 'storm_seas'), d = at0.unitDir || at0; pc.setClock(236); pc.teleport({ body: 'neptune', dir: [d.x, d.y, d.z], hour: 11, ship: true, altitude: 30 }); return { t: pc.sim.t }; })()`);
    await run(2, { dt: 0.1 });
    await film('b54-gale-ship', { frames: 8, every: 3, dt: 1 / 30, hud: true });
  });

  // ---- a dust storm on Mars' dunes (840 s) ----
  await part('dust', async () => {
    await place('dust', STAND('mars', 'dust_dunes', 828, 11, 0, -6));
    await run(12, { dt: 0.1 });
    await shot('b60-dust');
    await film('b61-dust', { frames: 6, every: 1, dt: 1 / 30, all: true });
    await film('b61-dust-slow', { frames: 4, every: 12, dt: 1 / 30 });
    await press('KeyW'); await press('ShiftLeft');
    await film('b62-dust-run', { frames: 6, every: 5, dt: 1 / 30 });
    await release('ShiftLeft'); await release('KeyW');
  });

  // ---- Saturn's crystal reeds in a 24 m/s wind (the clock at 0 to 10 s) ----
  await part('reeds', async () => {
    await place('reeds', STAND('saturn', 'crystal_reeds', 2, 11, 0, -4));
    await run(1, { dt: 0.1 });
    await shot('b70-reeds');
    await film('b71-reeds', { frames: 6, every: 1, dt: 1 / 30, all: true });
    await film('b71-reeds-slow', { frames: 6, every: 10, dt: 1 / 30 });
  });
} catch (e) { log('FAILED', String(e.stack || e.message).split('\n').slice(0, 4).join(' | ')); }
await G.done();
