// The game loads and runs with no console error and no fall-back; a few scripted moments, one frame of each kept.
// node loadcheck.mjs <root> <outdir> [quality=0] [w=480] [h=270] [scenes=spawn]
// scenes (comma list): spawn | walk | storm:<clock> | place:<body>:<biome>:<clock>:<hour> | ship:<body>:<biome>:<clock>:<alt>
import fs from 'node:fs';
import path from 'node:path';
const [root, out, quality = '0', w = '480', h = '270', scenesS = 'spawn'] = process.argv.slice(2);
const { openPage } = await import(path.resolve(root, 'tools/shot.mjs'));
fs.mkdirSync(out, { recursive: true });
const t0 = Date.now(); const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(0).padStart(4) + ' s', ...a);
const { page, problems, close } = await openPage({ pagePath: `/index.html?quality=${quality}&save=0&card=0&audio=0&pointerlock=0&dynres=0`, w: +w, h: +h, root });
try {
  await page.waitForFunction('window.__pcReady === true', null, { timeout: 1500000, polling: 500 });
  log('ready');
  await page.mouse.click(+w / 2, +h / 2); await page.waitForTimeout(300);
  await page.evaluate(() => { const pc = window.__pc; pc.hold(true); pc.game.started = true; });
  const info = async () => page.evaluate(() => { const i = window.__pc.info(); const ph = window.__pc.physics; const h = ph && ph.here; return { fallback: i.fallback, using: i.using, errors: window.__pc.errors, t: i.t, mode: i.mode, weather: h && h.weather ? h.weather.kind : null, wind: h && h.air ? h.air.speed : null, quality: i.quality }; });
  const shot = async (name) => { const f = path.join(out, name + '.jpg'); await page.screenshot({ path: f, type: 'jpeg', quality: 86, timeout: 600000 }); log('shot', f); };
  for (const sc of scenesS.split(',')) {
    const a = sc.split(':');
    if (a[0] === 'spawn') { await page.evaluate(() => window.__pc.step(1 / 30, 20)); await shot('spawn'); }
    else if (a[0] === 'walk') {
      await page.keyboard.down('KeyW'); await page.evaluate(() => window.__pc.step(1 / 30, 90)); await page.keyboard.up('KeyW'); await shot('walk');
    } else if (a[0] === 'storm') {
      await page.evaluate((t) => { const pc = window.__pc; pc.setClock(t); pc.step(1 / 30, 30); }, +a[1]); await shot('clock-' + a[1]);
    } else if (a[0] === 'place') {
      await page.evaluate(async ([body, biome, clock, hour]) => {
        const pc = window.__pc; if (clock !== '') pc.setClock(+clock);
        const surf = await import('/src/world/surface.js'); const d = biome === 'spawn' ? surf.getSurface(body).getSpawn() : surf.getStandPure(body, biome).unitDir;
        pc.teleport({ body, dir: [d.x, d.y, d.z], ...(hour !== '' && hour != null ? { hour: +hour } : {}) }); pc.step(1 / 30, 30);
      }, [a[1], a[2], a[3] || '', a[4] || '']);
      // (the frame loop is held: the world builds only while frames are stepped)
      await page.evaluate(() => { const pc = window.__pc; let ok = 0; for (let i = 0; i < 240 && ok < 6; i++) { pc.step(1 / 240, 1); ok = pc.info().settled ? ok + 1 : 0; } pc.step(1 / 30, 10); });
      await shot(`place-${a[1]}-${a[2]}-${a[3] || 'now'}`);
    } else if (a[0] === 'ship') {
      const r = await page.evaluate(async ([body, biome, clock, alt]) => {
        const pc = window.__pc; if (clock !== '') pc.setClock(+clock);
        const surf = await import('/src/world/surface.js'); const d = biome === 'spawn' ? surf.getSurface(body).getSpawn() : surf.getStandPure(body, biome).unitDir;
        pc.teleport({ body, dir: [d.x, d.y, d.z], ship: true, altitude: +alt, throttle: 0, heading: 0 });
        const p0 = { ...pc.sim.sh.p }; let lo = 1e9, hi = -1e9, gmax = 0, pv = { ...pc.sim.sh.v }, rock = 0;
        for (let i = 0; i < 300; i++) {
          pc.step(1 / 30, 1); const s = pc.sim.sh; lo = Math.min(lo, s.altGround); hi = Math.max(hi, s.altGround);
          gmax = Math.max(gmax, Math.hypot(s.v.x - pv.x, s.v.y - pv.y, s.v.z - pv.z) * 30 / 9.81); pv = { ...s.v };
          const b = s.phys && s.phys.buffetAngle; if (b) rock = Math.max(rock, Math.hypot(b.pitch, b.roll, b.yaw) * 57.3);
        }
        const s = pc.sim.sh; return { moved: Math.hypot(s.p.x - p0.x, s.p.y - p0.y, s.p.z - p0.z), lo, hi, gmax, rock, wind: pc.physics.here.air.speed, weather: pc.physics.here.weather.kind };
      }, [a[1], a[2], a[3] || '', a[4] || '30']);
      log('ship hands off 10 s:', JSON.stringify(r));
      await shot(`ship-${a[1]}-${a[2]}-${a[3] || 'now'}`);
    }
    log(sc, JSON.stringify(await info()));
  }
  const i = await info();
  const bad = [];
  if (problems.length) bad.push(...problems);
  if (i.errors && i.errors.length) bad.push(...i.errors.map((e) => 'game error: ' + e));
  if (!Array.isArray(i.fallback) || i.fallback.length) bad.push('fallback: ' + JSON.stringify(i.fallback));
  console.log(bad.length ? 'PROBLEMS:\n' + bad.join('\n') : `OK: no console error, no game error, fallback empty (quality ${i.quality}, using ${JSON.stringify(i.using)})`);
  process.exitCode = bad.length ? 1 : 0;
} catch (e) { console.log('FAILED: ' + (e.stack || e.message)); console.log(problems.join('\n')); process.exitCode = 1; } finally { await close(); }
