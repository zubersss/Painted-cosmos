// P25: the whole game played in the real game (index.html, a clean export), one browser, real keys and mouse, the game's
// clock held and stepped (what a player at 30 frames a second gets), sheets of frames kept along the way with the numbers
// of each instant. Usage: node play.mjs <root> <outdir> [part,...]   parts: earth, flight, trip, mars (default all, in order)
import fs from 'node:fs';
import path from 'node:path';
const [root, outDir, partsArg] = process.argv.slice(2);
const { openPage } = await import(path.join(root, 'tools/shot.mjs'));
const { settleWorld, fallbackProblem } = await import(path.join(root, 'tests/browser.mjs'));
const parts = (partsArg || 'earth,flight,trip,mars').split(',');
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

try {
  // ---- the title card, as a new player meets it ----
  await page.waitForFunction('window.__pcReady === true', null, { timeout: 900000, polling: 500 });
  const fb = await fallbackProblem(page, query); if (fb) throw new Error('FALLBACK: ' + fb);
  await page.waitForFunction('window.__pc.game.canStart !== false', null, { timeout: 900000, polling: 500 }).catch(() => problems.push('the card never said click to begin'));
  await shot('00-title');
  await page.mouse.click(cx, cy);
  const st = await settleWorld(page, { calm: 6, maxFrames: 200, maxSeconds: 900 }).catch(() => null);
  log('settled', JSON.stringify(st));
  await page.evaluate(() => { window.__pc.hold(true); });
  await run(0.5, { dt: 0.1 });
  await shot('01-spawn');
  log('spawn', JSON.stringify(await page.evaluate(PROBE)));
  if (parts.includes('earth')) {
    // walk from a stand, then run, from behind (the gait against the ground); then a stop
    await press('KeyW');
    await film('02-walk', { frames: 12, every: 2, dt: 1 / 30, crop: [0.2, 0.15, 0.6, 0.8], tile: [192, 144], cols: 6 });
    await press('ShiftLeft');
    await film('03-run', { frames: 18, every: 2, dt: 1 / 30, crop: [0.2, 0.15, 0.6, 0.8], tile: [192, 144], cols: 6 });
    await release('ShiftLeft'); await release('KeyW');
    await film('04-stop', { frames: 6, every: 3, dt: 1 / 30, crop: [0.2, 0.15, 0.6, 0.8], tile: [192, 144], cols: 6 });
    // the jetpack: hold Space 4 s, then let go and fall
    await press('Space');
    await film('05-jet', { frames: 12, every: 10, dt: 1 / 30, crop: [0, 0, 1, 1], tile: [256, 144], cols: 4 });
    await release('Space');
    await film('06-fall', { frames: 12, every: 12, dt: 1 / 30, crop: [0, 0, 1, 1], tile: [256, 144], cols: 4, until: (p) => p.exAlt < 0.05 });
  }
  if (parts.includes('flight')) {
    // to the ship: face it, walk until the prompt, E
    let i = await info();
    await drag((i.shipBearingDeg || 0) * RAD / MOUSE_FOOT, 0);
    await press('KeyW');
    i = await run(40, { dt: 0.1, until: (j) => j.canBoard, steer: async (j) => { if (j.shipBearingDeg != null && Math.abs(j.shipBearingDeg) > 4) await drag(j.shipBearingDeg * RAD / MOUSE_FOOT * 0.5, 0); } });
    await release('KeyW');
    log('at the ship', JSON.stringify({ canBoard: i.canBoard, prompt: i.prompt, d: i.shipDistance }));
    await shot('07-prompt-board');
    await tap('KeyE');
    await film('08-board', { frames: 8, every: 6, dt: 1 / 30, tile: [256, 144], cols: 4 });
    await run(1, { dt: 0.1 });
    await shot('09-seated');
    // lift-off
    await tap('Space');
    await film('10-liftoff', { frames: 12, every: 5, dt: 1 / 30 * 3, tile: [256, 144], cols: 4 });
    // full throttle, nose level then down to skim: 16 s, a frame each 0.5 s
    await press('KeyW');
    await film('11-throttle', { frames: 8, every: 5, dt: 0.1, tile: [256, 144], cols: 4, steer: async (j) => { if (j.ship.throttle >= 0.999) await release('KeyW'); await holdPitch(0)(j); } });
    await release('KeyW');
    await film('12-low', { frames: 24, every: 5, dt: 0.1, tile: [256, 144], cols: 4, steer: async (j) => holdPitch(j.ship.altGround > 12 ? -12 : 0)(j) });
    // a hard turn and the brake
    await film('13-turn', { frames: 8, every: 5, dt: 0.1, tile: [256, 144], cols: 4, steer: async (j) => { await drag(60, 0); await holdPitch(0)(j); } });
    await press('KeyX');
    await film('14-brake', { frames: 6, every: 5, dt: 0.1, tile: [256, 144], cols: 3, steer: holdPitch(0) });
    await release('KeyX');
    // a landing near here: throttle down, sink with C until the prompt, E
    await press('KeyC');
    i = await run(30, { dt: 0.1, until: (j) => j.ship.canLand, steer: async (j) => { if (j.ship.throttle > 0.02) await press('KeyS'); else await release('KeyS'); await holdPitch(-4)(j); } });
    await release('KeyC'); await release('KeyS');
    log('land prompt', JSON.stringify({ canLand: i.ship.canLand, prompt: i.prompt, hAG: i.ship.altGround }));
    await shot('15-prompt-land');
    await tap('KeyE');
    await film('16-landing', { frames: 12, every: 4, dt: 0.1, tile: [256, 144], cols: 4, until: (p) => p.st === 'LANDED' });
    await run(1.5, { dt: 0.1 });
    await shot('17-landed');
  }
  if (parts.includes('trip')) {
    let i = await info();
    if (i.state !== 'LANDED') throw new Error('not landed for the trip: ' + i.state);
    await tap('Space'); await run(6, { dt: 0.1 });
    await press('KeyW');
    await film('18-climb', { frames: 12, every: 5, dt: 0.25, tile: [256, 144], cols: 4, steer: holdPitch(55), until: (p) => p.st === 'SPACE' });
    await run(40, { dt: 0.25, steer: holdPitch(55), until: (j) => j.ship.altitude > 3 * (j.ship.spaceAlt || 1e9) });
    await release('KeyW');
    await shot('19-space');
    await tap('KeyM'); await run(0.5, { dt: 0.1 }); await shot('20-map');
    // choose Mars on the map with the arrow keys until the target is Mars, then close
    for (let k = 0; k < 10; k++) { i = await info(); if (i.target && i.target.id === 'mars') break; await tap('ArrowRight'); await run(0.2, { dt: 0.1 }); }
    await shot('21-map-mars');
    await tap('KeyM'); await run(0.3, { dt: 0.1 });
    i = await info(); log('target', JSON.stringify(i.target));
    for (let n = 0; n < 60; n++) { const a = await page.evaluate(() => window.__pc.aimAt('mars')); if (Math.abs(a.yawDeg) < 3 && Math.abs(a.pitchDeg) < 3) break; await drag(Math.max(-110, Math.min(110, a.yawDeg * RAD / MOUSE_SHIP * 0.4)), -Math.max(-70, Math.min(70, a.pitchDeg * RAD / MOUSE_SHIP * 0.4))); await run(0.25, { dt: 0.25 }); }
    await shot('22-aimed');
    await tap('KeyF');
    await page.evaluate(() => window.__pc.setTimeScale(4));
    await film('23-pulse', { frames: 12, every: 6, dt: 1.0, tile: [256, 144], cols: 4, until: (p) => p.st === 'SPACE' && p.t > 0 });
    i = await run(400, { dt: 1.0, until: (j) => j.state === 'SPACE' });
    await shot('24-arrival');
    await page.evaluate(() => window.__pc.setTimeScale(1));
  }
  if (parts.includes('mars')) {
    let i = await info();
    if (i.state !== 'SPACE') log('not in space for Mars: ' + i.state);
    await run(10, { dt: 0.25 });
    await press('KeyW'); await run(1.5, { dt: 0.1 }); await release('KeyW');
    await film('25-descent', { frames: 12, every: 4, dt: 0.25, tile: [256, 144], cols: 4, steer: holdPitch(-60), until: (p) => p.st === 'ATMOSPHERE' });
    i = await run(240, { dt: 0.25, steer: holdPitch(-35), until: (j) => j.ship.altGround < 170 });
    await press('KeyS');
    i = await run(240, { dt: 0.25, until: (j) => j.ship.canLand, steer: async (j) => { await holdPitch(j.ship.altGround > 110 ? -18 : -7)(j); if (j.ship.throttle < 0.25) await release('KeyS'); } });
    await release('KeyS');
    await shot('26-mars-prompt');
    await tap('KeyE');
    await film('27-mars-landing', { frames: 12, every: 4, dt: 0.1, tile: [256, 144], cols: 4, until: (p) => p.st === 'LANDED' });
    await run(1.5, { dt: 0.1 });
    await tap('KeyE'); await run(2, { dt: 0.1 });
    await shot('28-mars-out');
    await press('KeyW'); await press('ShiftLeft');
    await film('29-mars-run', { frames: 18, every: 2, dt: 1 / 30, crop: [0.2, 0.15, 0.6, 0.8], tile: [192, 144], cols: 6 });
    await release('ShiftLeft'); await release('KeyW');
    await press('Space');
    await film('30-mars-jet', { frames: 8, every: 10, dt: 1 / 30, tile: [256, 144], cols: 4 });
    await release('Space');
    await film('31-mars-fall', { frames: 12, every: 15, dt: 1 / 30, tile: [256, 144], cols: 4, until: (p) => p.exAlt < 0.05 });
  }
} catch (e) { problems.push('PLAY FAILED: ' + String(e.stack || e.message).split('\n').slice(0, 3).join(' | ')); }
const errs = await page.evaluate(() => (window.__pc && window.__pc.errors) || []).catch(() => []);
await close();
log('problems', JSON.stringify([...new Set(problems)].slice(0, 12)), 'game errors', JSON.stringify(errs.slice(0, 5)));
