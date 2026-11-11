// Scripted check of the M3 pieces in a real browser: careful starting tier, the look hint, the
// sketchbook, the help card, a vista found on foot (and saved), and the procedural audio.
// Usage: node tests/m3check.mjs [--query "stub=render,world,art"] [--root dir] [--keep]
import { RAD, MOUSE_FOOT, parseArgs, startRun, finish } from './browser.mjs';

const opt = parseArgs({ out: '/home/user/.pc-scratch/pilot/m3', w: 640, h: 360, query: 'stub=render,world,art' });
opt.query += '&pointerlock=0&fresh=1';                       // dynamic resolution and the start card stay on
const run = await startRun(opt);
const { page, check, info, shot, look, gameWait, until } = run;
try {
  let i = await info();
  check(i.quality === 1 && i.scale <= 0.76, `starts carefully: tier ${i.quality}, render scale ${i.scale}`);
  let ui = await page.evaluate(() => ({ card: window.__pc.game.hud.startShown, sub: document.querySelector('.pc-sub').textContent, audio: window.__pc.audio.state }));
  check(ui.card, 'the title card is up: "' + ui.sub + '"');
  check(ui.audio === 'off', 'no sound before the first gesture');
  await shot('m3-title', 'm3-title');
  await page.mouse.click(run.cx, run.cy);
  await gameWait(0.6);
  ui = await page.evaluate(() => ({ card: window.__pc.game.hud.startShown, hint: document.querySelector('.pc-hint').className + '|' + document.querySelector('.pc-hint').textContent }));
  check(!ui.card, 'a click starts the game');
  check(/pc-on/.test(ui.hint) && /drag to look/.test(ui.hint), 'the look hint is on screen: ' + ui.hint.split('|')[1]);
  await look(60, 0);
  await gameWait(0.4);
  ui = await page.evaluate(() => document.querySelector('.pc-hint').className);
  check(!/pc-on/.test(ui), 'and goes away once you have looked around');
  i = await info();
  check(i.audio && i.audio.ready && i.audio.state === 'running', 'audio runs after the first gesture: ' + JSON.stringify(i.audio && i.audio.state));
  // Walk: wind bed and footsteps are mixed from the world; values are finite and in range.
  await page.keyboard.down('KeyW');
  await gameWait(2.5);
  await page.keyboard.up('KeyW');
  i = await info();
  const mix = i.audio.mix;
  check(mix && Object.values(mix).every((v) => typeof v !== 'number' || (Number.isFinite(v) && v >= 0 && v < 1)), 'the mix is sane: ' + JSON.stringify(mix));
  // Sketchbook and help.
  await page.keyboard.press('KeyB');
  await gameWait(0.3);
  i = await info();
  check(i.bookOpen, 'B opens the sketchbook');
  const text = await page.evaluate(() => document.querySelector('.pc-book').textContent);
  check(/Earth/.test(text) && /not yet visited/.test(text) && /view/.test(text), 'it lists the worlds, the landscapes and the views');
  await shot('m3-sketchbook', 'm3-sketchbook');
  await page.keyboard.press('KeyB');
  await gameWait(0.2);
  check(!(await info()).bookOpen, 'B closes it');
  await page.keyboard.press('KeyH');
  await gameWait(0.3);
  check(await page.evaluate(() => window.__pc.game.hud.startShown), 'H shows the help card');
  await page.keyboard.press('KeyH');
  await gameWait(0.2);
  // A vista: stand 30 m from one, walk to it.
  const v = await page.evaluate(() => {
    const sim = window.__pc.sim, list = sim.vistasOf(sim.bodyId);
    if (!list.length) return null;
    const d = list[0].dir, R = 4000, k = 30 / R;
    window.__pc.teleport({ body: sim.bodyId, dir: [d.x + k, d.y, d.z - k * 0.3] });
    return { name: list[0].name, n: list.length };
  });
  if (v) {
    await gameWait(0.5);
    i = await page.evaluate(() => window.__pc.sim.nearestVista());
    check(i && i.distance < 60, `a view is ${Math.round(i.distance)} m away: ${i.name}`);
    await look((i.bearingDeg * RAD) / MOUSE_FOOT, 0);
    await page.keyboard.down('KeyW');
    i = await until((x) => (x.vistas.earth || []).length > 0, 40, async () => {
      const n = await page.evaluate(() => window.__pc.sim.nearestVista());
      if (n && n.distance < 60 && Math.abs(n.bearingDeg) > 6) await look((n.bearingDeg * RAD) / MOUSE_FOOT * 0.6, 0);
    });
    await page.keyboard.up('KeyW');
    check((i.vistas.earth || []).length === 1, 'walking up to the view finds it');
    check(/sketchbook/.test(i.notice || ''), 'and says so: "' + i.notice + '"');
    await shot('m3-vista');
    await gameWait(1.5);
    const saved = await page.evaluate(() => { try { return JSON.parse(window.__pc.storage.getItem('painted-cosmos.save')); } catch { return null; } });
    check(saved && saved.vistas && (saved.vistas.earth || []).length === 1, 'the found view is in the save');
  } else check(false, 'the world has vistas');
} catch (e) { run.fails.push('exception: ' + (e && e.stack ? e.stack : e)); }
await finish(run, opt, {});
