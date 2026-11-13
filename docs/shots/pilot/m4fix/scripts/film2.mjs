// PILOT's fix round (M4): scenes of the real game (index.html from <root>), one browser, real keys and
// mouse, the game's clock held and stepped; sheets of frames with the numbers of each instant.
// Usage: node film.mjs <root> <outdir> <scene,scene,...>   env: W H Q (default 640 360 0), CARD=1 keeps the title card
import fs from 'node:fs';
import path from 'node:path';
const [root, outDir, scenesArg] = process.argv.slice(2);
const { openPage } = await import(path.join(root, 'tools/shot.mjs'));
const { settleWorld, fallbackProblem } = await import(path.join(root, 'tests/browser.mjs'));
const scenes = (scenesArg || '').split(',').filter(Boolean);
fs.mkdirSync(outDir, { recursive: true });
const W = Number(process.env.W || 640), H = Number(process.env.H || 360), Q = Number(process.env.Q || 0);
const RAD = Math.PI / 180, MOUSE_FOOT = 0.0023, MOUSE_SHIP = 0.0017;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const query = `dynres=0&pointerlock=0&fresh=1&save=0&audio=0&quality=${Q}` + (process.env.CARD === '1' ? '' : '&card=0') + (process.env.QUERY ? '&' + process.env.QUERY : '');
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
const PROBE = `(() => { const pc = window.__pc, i = pc.info(), sim = pc.sim, ex = sim.ex, sh = sim.sh, r2 = (v) => v == null ? null : +(+v).toFixed(2);
  const up = (p) => { const l = Math.hypot(p.x, p.y, p.z); return { x: p.x / l, y: p.y / l, z: p.z / l }; };
  const gnd = (p) => { const s = sim.sampler(sim.bodyId)(up(p)); return Math.hypot(p.x, p.y, p.z) - s.radius; };
  const shB = sim.shFrame.kind === 'body' && sim.shFrame.rotating;
  return { t: r2(i.t), st: i.state, exV: r2(ex.speed), exAlt: r2(ex.altitude), mode: ex.mode, fuel: r2(ex.fuel),
    shV: r2(sh.speed), hAG: r2(sh.altGround), shH: shB ? r2(Math.hypot(sh.p.x, sh.p.y, sh.p.z) - sim.sampler(sim.shFrame.id)(up(sh.p)).radius) : null, shVUp: r2(i.ship.vUp), thr: r2(sh.throttle), lift: sh.liftoff ? 1 : 0, land: i.ship.landing,
    prompt: i.prompt, notice: i.notice, cam: r2(i.cameraClearance), view: i.view, hour: r2(i.mood && i.mood.timeOfDay), marks: i.marks }; })()`;
// keep `frames` frames, `every` steps of `dt` apart; whole-page pictures (the HUD with them) when hud is set
async function film(name, { frames, every = 1, dt = 1 / 30, tile = [320, 180], cols = 4, steer = null, until = null, hud = false }) {
  const t0 = Date.now();
  const rows = [], shots = [];
  await page.evaluate((O) => {
    const rows = Math.ceil(O.frames / O.cols);
    const S = window.__sheet = { c: document.createElement('canvas'), tw: O.tile[0], th: O.tile[1], cols: O.cols, n: 0 };
    S.c.width = S.tw * O.cols; S.c.height = S.th * rows; const g = S.c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, S.c.width, S.c.height);
  }, { frames, tile, cols });
  const keep = `((d) => { window.__pc.step(d, 1); const S = window.__sheet, gl = document.getElementById('pc-canvas') || document.querySelector('canvas'), g = S.c.getContext('2d');
    const x = (S.n % S.cols) * S.tw, y = Math.floor(S.n / S.cols) * S.th; g.drawImage(gl, 0, 0, gl.width, gl.height, x, y, S.tw, S.th);
    const p = ${PROBE}; const s = S.n + ' ' + p.t.toFixed(1) + 's'; g.font = '10px monospace'; g.textBaseline = 'top'; g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(x, y, s.length * 6 + 4, 12); g.fillStyle = '#000'; g.fillText(s, x + 2, y + 1);
    S.n++; return p; })(${dt})`;
  for (let i = 0; i < frames; i++) {
    for (let k = 0; k < every - 1; k++) {
      if (steer) await steer(await info());
      await page.evaluate((d) => window.__pc.step(d, 1), dt);
    }
    if (steer) await steer(await info());
    const p = await page.evaluate(keep);
    rows.push(p);
    if (hud) { const f = path.join(outDir, `${name}-${String(i).padStart(2, '0')}.jpg`); await page.screenshot({ path: f, type: 'jpeg', quality: 84, timeout: 300000 }); shots.push(f); }
    if (until && until(p)) break;
  }
  const res = await page.evaluate(() => ({ url: window.__sheet.c.toDataURL('image/jpeg', 0.86), w: window.__sheet.c.width, h: window.__sheet.c.height }));
  const base = path.join(outDir, name);
  fs.writeFileSync(base + '.jpg', Buffer.from(res.url.split(',')[1], 'base64'));
  fs.writeFileSync(base + '.json', JSON.stringify({ name, dt, every, rows }) + '\n');
  log(`${name}: ${rows.length} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s, sheet ${res.w}x${res.h}`);
  for (const r of rows) console.log('   ' + JSON.stringify({ ...r, marks: undefined }));
  return rows;
}
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
const shot = async (name) => { await page.evaluate(() => window.__pc.step(1 / 30, 1)); await page.screenshot({ path: path.join(outDir, name + '.jpg'), type: 'jpeg', quality: 86, timeout: 300000 }); log('shot ' + name); };
const holdPitch = (deg, gain = 0.35) => async (i) => { const e = deg - i.ship.pitchDeg; if (Math.abs(e) > 1.5) await drag(0, -Math.max(-80, Math.min(80, (e * RAD / MOUSE_SHIP) * gain))); };
const press = (k) => page.keyboard.down(k), release = (k) => page.keyboard.up(k);
const tap = async (k) => { await page.keyboard.down(k); await page.keyboard.up(k); };
const settle = async () => { await page.evaluate(() => window.__pc.hold(false)); const st = await settleWorld(page, { calm: 6, maxFrames: 240, maxSeconds: 900 }).catch(() => null); await page.evaluate(() => window.__pc.hold(true)); return st; };
const tp = async (o) => { await page.evaluate((x) => { window.__pc.teleport(x); }, o); await settle(); };
async function toShipAndBoard() {
  let i = await info();
  await drag((i.shipBearingDeg || 0) * RAD / MOUSE_FOOT, 0);
  await press('KeyW');
  i = await run(40, { dt: 0.1, until: (j) => j.canBoard, steer: async (j) => { if (j.shipBearingDeg != null && Math.abs(j.shipBearingDeg) > 4) await drag(j.shipBearingDeg * RAD / MOUSE_FOOT * 0.5, 0); } });
  await release('KeyW');
  await tap('KeyE');
  await run(4, { dt: 0.1, until: (j) => j.state === 'LANDED' });
  await run(1, { dt: 0.1 });
}
const S = {
  // PHYSICS on PILOT 1: the first lift-off of the game, among the birches at the spawn
  async liftoff() {
    await page.evaluate(() => window.__pc.setClock(14.8));
    await toShipAndBoard();
    await shot('liftoff-00-seated');
    await tap('Space');
    await film('liftoff', { frames: 20, every: 15, dt: 1 / 30, cols: 5, tile: [256, 144] });
  },
  // PHYSICS on PILOT 2 and 4: E at full speed low over the wood, to the ground (the landing's chase camera among the crowns)
  async landfast() {
    await press('KeyW');
    await run(9, { dt: 0.1, steer: holdPitch(0) });
    await release('KeyW');
    log('before E', JSON.stringify(await page.evaluate(PROBE)));
    await shot('landfast-00-prompt');
    await tap('KeyE');
    await film('landfast', { frames: 30, every: 15, dt: 1 / 30, cols: 6, tile: [256, 144], until: (p) => p.st === 'LANDED' });
    await run(1.5, { dt: 0.1 });
    await shot('landfast-99-landed');
  },
  // PHYSICS on PILOT 3: low flight, nose down, full throttle, from over the wood
  async low() {
    await tap('Space');
    await run(8, { dt: 0.1 });
    await press('KeyW');
    await run(6, { dt: 0.1, steer: holdPitch(0) });
    await release('KeyW');
    await film('low', { frames: 30, every: 10, dt: 1 / 30, cols: 6, tile: [256, 144], steer: async (i) => holdPitch(i.ship.altGround > 12 ? -12 : 0)(i) });
  },
};
try {
  await page.waitForFunction('window.__pcReady === true', null, { timeout: 1800000, polling: 500 });
  const fb = await fallbackProblem(page, query); if (fb) throw new Error('FALLBACK: ' + fb);
  if (process.env.CARD === '1') { await page.waitForFunction('window.__pc.game.canStart !== false', null, { timeout: 900000, polling: 500 }); await page.screenshot({ path: path.join(outDir, 'title.jpg'), type: 'jpeg', quality: 86, timeout: 600000 }); await page.mouse.click(cx, cy); }
  log('settled', JSON.stringify(await settle()));
  await run(0.5, { dt: 0.1 });
  const extra = process.env.SCENES ? await import(path.resolve(process.env.SCENES)) : null;
  const ctx = { page, info, drag, film, run, shot, holdPitch, press, release, tap, settle, tp, toShipAndBoard, log, PROBE, W, H, RAD, MOUSE_FOOT, MOUSE_SHIP, outDir, cx, cy };
  for (const s of scenes) {
    log('--- scene', s);
    if (S[s]) await S[s](); else if (extra && extra.default[s]) await extra.default[s](ctx); else throw new Error('no scene ' + s);
  }
} catch (e) { problems.push('SCRIPT: ' + (e && e.stack || e)); }
const errs = await page.evaluate(() => (window.__pc ? window.__pc.errors : ['no __pc'])).catch(() => ['page gone']);
await close();
log('game errors:', JSON.stringify(errs), ' problems:', problems.length ? JSON.stringify(problems.slice(0, 6)) : 'none');
process.exit(problems.length || errs.length ? 1 : 0);
