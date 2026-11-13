// Frames of the real game at a stand, the clock held and stepped (one browser). Takes, as JSON on argv[6]:
// [{ name, body, place, clock, hour, pre (s run before the first frame), n (frames), every (s between frames), js (run in the page first), keys: [..] held }]
// node film.mjs <root> <out> <quality> <w> <h> '<takes json>'
import fs from 'node:fs';
import path from 'node:path';
const [root, out, quality, w, h, takesS] = process.argv.slice(2);
const { openPage } = await import(path.resolve(root, 'tools/shot.mjs'));
fs.mkdirSync(out, { recursive: true });
const takes = JSON.parse(takesS);
const t0 = Date.now(); const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(0).padStart(4) + ' s', ...a);
const { page, problems, close } = await openPage({ pagePath: `/index.html?quality=${quality}&save=0&card=0&audio=0&pointerlock=0&dynres=0`, w: +w, h: +h, root });
try {
  await page.waitForFunction('window.__pcReady === true', null, { timeout: 2400000, polling: 500 });
  log('ready');
  await page.mouse.click(+w / 2, +h / 2); await page.waitForTimeout(300);
  await page.evaluate(() => { const pc = window.__pc; pc.hold(true); pc.game.started = true; if (pc.game.hud && pc.game.hud.root) pc.game.hud.root.style.display = 'none'; });
  for (const T of takes) {
    await page.evaluate(async (T) => {
      const pc = window.__pc; if (T.clock != null) pc.setClock(T.clock);
      if (T.body) { const surf = await import('/src/world/surface.js'); const d = !T.place || T.place === 'spawn' ? surf.getSurface(T.body).getSpawn() : surf.getStandPure(T.body, T.place).unitDir; pc.teleport({ body: T.body, dir: [d.x, d.y, d.z], ...(T.hour != null ? { hour: T.hour } : {}), ...(T.heading != null ? { heading: T.heading } : {}), ...(T.lookPitch != null ? { lookPitch: T.lookPitch } : {}), ...(T.firstPerson != null ? { firstPerson: T.firstPerson } : {}) }); }
      if (T.js) (0, eval)(T.js);
      pc.step(1 / 30, 2);
    }, T);
    for (const k of T.keys || []) await page.keyboard.down(k);
    await page.evaluate((s) => window.__pc.step(1 / 15, Math.max(1, Math.round(s * 15))), T.pre || 1);
    await page.evaluate(() => window.__pc.settle(6)).catch(() => {});
    const probe = [];
    for (let i = 0; i < T.n; i++) {
      if (i) await page.evaluate((s) => window.__pc.step(1 / 15, Math.max(1, Math.round(s * 15))), T.every);
      const f = path.join(out, `${T.name}-${String(i).padStart(2, '0')}.png`);
      await page.screenshot({ path: f, type: 'png', timeout: 900000 });
      probe.push(await page.evaluate(() => { const pc = window.__pc, h = pc.physics.here; return { t: pc.sim.t, weather: h.weather.kind, wind: +h.air.speed.toFixed(2), rain: +(h.weather.precipitation.rate || 0).toFixed(1) }; }));
    }
    for (const k of T.keys || []) await page.keyboard.up(k);
    fs.writeFileSync(path.join(out, T.name + '.json'), JSON.stringify(probe));
    log(T.name, JSON.stringify(probe[0]), '..', JSON.stringify(probe[probe.length - 1]));
  }
  const i = await page.evaluate(() => { const i = window.__pc.info(); return { fallback: i.fallback, errors: window.__pc.errors, quality: i.quality }; });
  const bad = [...problems, ...(i.errors || []).map((e) => 'game error: ' + e)]; if (!Array.isArray(i.fallback) || i.fallback.length) bad.push('fallback: ' + JSON.stringify(i.fallback));
  console.log(bad.length ? 'PROBLEMS:\n' + bad.join('\n') : `OK: no console error, no game error, fallback empty (quality ${i.quality})`);
  process.exitCode = bad.length ? 1 : 0;
} catch (e) { console.log('FAILED: ' + (e.stack || e.message)); console.log(problems.join('\n')); process.exitCode = 1; } finally { await close(); }
