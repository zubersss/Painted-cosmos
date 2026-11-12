// P25: the whole game played in the real game (index.html, a clean export), one browser, real keys and mouse, the game's
// clock held and stepped (what a player at 30 frames a second gets), sheets of frames kept along the way with the numbers
// of each instant. Usage: node play.mjs <root> <outdir> [part,...]   parts: earth, flight, trip, mars (default all, in order)
import fs from 'node:fs';
import path from 'node:path';
const [root, outDir, partsArg] = process.argv.slice(2);
const { openPage } = await import(path.join(root, 'tools/shot.mjs'));
const { settleWorld, fallbackProblem } = await import(path.join(root, 'tests/browser.mjs'));

fs.mkdirSync(outDir, { recursive: true });
const W = Number(process.env.W || 640), H = Number(process.env.H || 360), Q = Number(process.env.Q || 1);
const RAD = Math.PI / 180, MOUSE_FOOT = 0.0023, MOUSE_SHIP = 0.0017;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const query = `dynres=0&pointerlock=0&fresh=1&save=0&audio=0&quality=${Q}`;
const { page, problems, close } = await openPage({ pagePath: '/index.html?' + query, w: W, h: H, root });
const info = () => page.evaluate(() => window.__pc.info());
const cx = W / 2, cy = H / 2;
async function drag(dx, dy) {
  let rx = dx, ry = dy;
  for (let n = 0; n < 20 && (Math.abs(rx) > 0.5 || Math.abs(ry) > 0.5); n++) {
    const sx = Math.max(-140, Math.min(140, rx)), sy = Math.max(-90, Math.min(90, ry));
    await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + sx, cy + sy, { steps: 2 }); await page.mouse.up();
    rx -= sx; ry -= sy;
  }
}
// numbers of an instant, read in the page
const PROBE = `(() => { const pc = window.__pc, i = pc.info(), ex = pc.sim.ex, sh = pc.sim.sh, B = ex.phys || {}, r2 = (v) => v == null ? null : +(+v).toFixed(2);
  const h = pc.physics && pc.physics.here ? pc.physics.here : null;
  return { t: r2(i.t), st: i.state, body: i.body, biome: i.mood && i.mood.biome, exV: r2(ex.speed), exAlt: r2(ex.altitude), vUp: r2(i.explorer.vUp), fuel: r2(ex.fuel), mode: ex.mode, gait: B.gait, swim: ex.swimming ? 1 : 0,
    shV: r2(sh.speed), hAG: r2(sh.altGround), pitch: r2(i.ship.pitchDeg), thr: r2(sh.throttle), shVUp: r2(i.ship.vUp), prompt: i.prompt, notice: i.notice, cam: r2(i.cameraClearance), view: i.view,
    wind: h && h.air ? r2(h.air.speed) : null, wx: h && h.weather ? h.weather.kind : null }; })()`;
// keep `frames` frames, `every` steps of `dt` apart; steer (Node, per step) optional
async function film(name, { frames, every = 1, dt = 1 / 30, crop = [0, 0, 1, 1], tile = null, cols = 4, steer = null, until = null }) {
  const t0 = Date.now();
  await page.evaluate((O) => {
    const gl = document.getElementById('pc-canvas') || document.querySelector('canvas');
    const c = O.crop, sw = Math.round(c[2] * gl.width), sh = Math.round(c[3] * gl.height);
    const tw = O.tile ? O.tile[0] : sw, th = O.tile ? O.tile[1] : sh, rows = Math.ceil(O.frames / O.cols);
    const S = window.__sheet = { c: document.createElement('canvas'), tw, th, cols: O.cols, crop: O.crop, n: 0, nums: [] };
    S.c.width = tw * O.cols; S.c.height = th * rows; const g = S.c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, S.c.width, S.c.height);
  }, { frames, crop, tile, cols });
  const keep = `((d) => { window.__pc.step(d, 1); const S = window.__sheet, pc = window.__pc, gl = document.getElementById('pc-canvas') || document.querySelector('canvas'), g = S.c.getContext('2d');
    const c = S.crop, sx = Math.round(c[0] * gl.width), sy = Math.round(c[1] * gl.height), sw = Math.round(c[2] * gl.width), sh = Math.round(c[3] * gl.height);
    const x = (S.n % S.cols) * S.tw, y = Math.floor(S.n / S.cols) * S.th; g.drawImage(gl, sx, sy, sw, sh, x, y, S.tw, S.th);
    const p = ${PROBE}; const s = S.n + ' ' + p.t.toFixed(1) + 's'; g.font = '10px monospace'; g.textBaseline = 'top'; g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(x, y, s.length * 6 + 4, 12); g.fillStyle = '#000'; g.fillText(s, x + 2, y + 1);
    S.nums.push(p); S.n++; return p; })(${dt})`;
  const rows = [];
  for (let i = 0; i < frames; i++) {
    for (let k = 0; k < every - 1; k++) {
      if (steer) await steer(await info());
      await page.evaluate((d) => window.__pc.step(d, 1), dt);
    }
    if (steer) await steer(await info());
    const p = await page.evaluate(keep);
    rows.push(p);
    if (until && until(p)) break;
  }
  const res = await page.evaluate(() => ({ url: window.__sheet.c.toDataURL('image/jpeg', 0.86), w: window.__sheet.c.width, h: window.__sheet.c.height }));
  const base = path.join(outDir, name);
  fs.writeFileSync(base + '.jpg', Buffer.from(res.url.split(',')[1], 'base64'));
  fs.writeFileSync(base + '.json', JSON.stringify({ name, dt, every, rows }) + '\n');
  log(`${name}: ${rows.length} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s, sheet ${res.w}x${res.h}`);
  for (const r of rows) console.log('   ' + JSON.stringify(r));
  return rows;
}
// run steps without keeping frames (each still drawn), optional steer, until(info)
async function run(seconds, { dt = 0.1, steer = null, until = null } = {}) {
  const n = Math.round(seconds / dt); let i = null;
  for (let k = 0; k < n; k++) {
    if (steer || until) i = await info();
    if (until && until(i)) return i;
    if (steer) await steer(i);
    await page.evaluate((d) => window.__pc.step(d, 1), dt);
  }
  return info();
}
const shot = async (name) => { await page.screenshot({ path: path.join(outDir, name + '.jpg'), type: 'jpeg', quality: 86, timeout: 300000 }); log('shot ' + name); };
const holdPitch = (deg, gain = 0.35) => async (i) => { const e = deg - i.ship.pitchDeg; if (Math.abs(e) > 1.5) await drag(0, -Math.max(-80, Math.min(80, (e * RAD / MOUSE_SHIP) * gain))); };
const press = (k) => page.keyboard.down(k), release = (k) => page.keyboard.up(k);
const tap = async (k) => { await page.keyboard.down(k); await page.keyboard.up(k); };


const scene = async (name, setup) => {
  await page.evaluate(() => { window.__pc.hold(false); window.__pc.setTimeScale(0); });
  const r = await page.evaluate(setup);
  log(name, 'placed', JSON.stringify(r));
  const st = await settleWorld(page, { calm: 6, maxFrames: 300, maxSeconds: 900 }).catch(() => null);
  log(name, 'settled', JSON.stringify(st));
  await page.evaluate(() => { window.__pc.hold(true); window.__pc.setTimeScale(1); });
};
// a coast: march out from the stand to the waterline; stand `back` m short of it on the beach, facing the sea
const COAST = (body, biome, T, back) => `(() => { const pc = window.__pc, w = pc.world, at0 = w.findBiome('${body}', '${biome}'), d0 = at0.unitDir || at0;
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
  pc.setClock(${T}); pc.teleport({ body: '${body}', dir: [q.x, q.y, q.z], hour: 11, heading, lookPitch: -8, firstPerson: false });
  return { waterline: hi, heading }; })()`;
const STAND = (body, biome, T, heading, pitch, hour = 11) => `(() => { const pc = window.__pc, at0 = pc.world.findBiome('${body}', '${biome}'), d = at0.unitDir || at0;
  pc.setClock(${T}); pc.teleport({ body: '${body}', dir: [d.x, d.y, d.z], hour: ${hour}, heading: ${heading}, lookPitch: ${pitch}, firstPerson: false }); return { ok: 1 }; })()`;
const SPAWN = (T, heading, pitch) => `(() => { const pc = window.__pc, d = pc.world.getSpawn('earth').unitDir; pc.setClock(${T}); pc.teleport({ body: 'earth', dir: [d.x, d.y, d.z], hour: 12.3, heading: ${heading}, lookPitch: ${pitch}, firstPerson: false }); return { ok: 1 }; })()`;
const which = (partsArg || 'sea,dunes,reeds,trees').split(',');
try {
  await page.waitForFunction('window.__pcReady === true', null, { timeout: 900000, polling: 500 });
  const fb = await fallbackProblem(page, query); if (fb) throw new Error('FALLBACK: ' + fb);
  await page.mouse.click(cx, cy);
  if (which.includes('sea')) {
    // Earth's coast in its storm (13 m/s from the E): walk from 5 m up the beach into the sea, 6 frames a second for 8 s
    await scene('sea', COAST('earth', 'sea_coast', 8835, 5));
    await run(1, { dt: 0.1 });
    await shot('40-sea-start');
    await press('KeyW');
    await film('41-sea-walkin', { frames: 30, every: 5, dt: 1 / 30, tile: [256, 144], cols: 6 });
    await film('42-sea-swim', { frames: 12, every: 10, dt: 1 / 30, tile: [256, 144], cols: 6 });
    await release('KeyW');
    await shot('43-sea-swim');
  }
  if (which.includes('dunes')) {
    // Mars' dunes in a dust storm (19 m/s at 2 m at clock 810): stand, then run with the wind behind
    await scene('dunes', STAND('mars', 'dust_dunes', 810, 0, -6));
    await run(1, { dt: 0.1 });
    await shot('44-dunes');
    await film('45-dunes-stand', { frames: 12, every: 2, dt: 1 / 30, tile: [256, 144], cols: 6 });
    await press('KeyW'); await press('ShiftLeft');
    await film('46-dunes-run', { frames: 18, every: 3, dt: 1 / 30, tile: [256, 144], cols: 6 });
    await release('ShiftLeft'); await release('KeyW');
  }
  if (which.includes('reeds')) {
    // Saturn's crystal reeds at 24 m/s (clock 0): standing among them, 15 frames a second
    await scene('reeds', STAND('saturn', 'crystal_reeds', 2, 0, -4));
    await run(0.5, { dt: 0.1 });
    await shot('47-reeds');
    await film('48-reeds', { frames: 12, every: 2, dt: 1 / 30, tile: [256, 144], cols: 6 });
  }
  if (which.includes('trees')) {
    // Earth's spawn in its first storm (165 s): the birches, 15 frames a second, and the grass at the feet
    await scene('trees', SPAWN(162, 0, 14));
    await run(0.5, { dt: 0.1 });
    await shot('49-storm-trees');
    await film('50-storm-trees', { frames: 12, every: 2, dt: 1 / 30, tile: [256, 144], cols: 6 });
  }
} catch (e) { problems.push('PLAY FAILED: ' + String(e.stack || e.message).split('\n').slice(0, 3).join(' | ')); }
const errs = await page.evaluate(() => (window.__pc && window.__pc.errors) || []).catch(() => []);
await close();
log('problems', JSON.stringify([...new Set(problems)].slice(0, 12)), 'game errors', JSON.stringify(errs.slice(0, 5)));
