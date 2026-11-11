// Scripted check of the M3 pieces in a real browser: best tier first and shed by itself, the look hint, the
// sketchbook, the help card, a vista found on foot (and saved), and the procedural audio.
// Usage: node tests/m3check.mjs [--query "stub=render,world,art"] [--root dir] [--keep]
import { RAD, MOUSE_FOOT, parseArgs, startRun, finish } from './browser.mjs';

const opt = parseArgs({ out: '/home/user/.pc-scratch/pilot/m3', w: 640, h: 360, query: 'stub=render,world,art' });
opt.query += '&pointerlock=0&fresh=1';                       // dynamic resolution and the start card stay on
const run = await startRun(opt);
const { page, check, info, shot, look, gameWait, until } = run;
try {
  let i = await info();
  // The game starts at the best picture and comes down only when the frame time asks. Here
  // (software rendering, seconds per frame at the top tier) it must have come down by itself.
  const dyn = await page.evaluate(() => ({ ...window.__pc.dyn.start }));
  check(dyn.quality === 2 && dyn.scale === 1, `starts at the best: tier ${dyn.quality}, render scale ${dyn.scale}`);
  const down = await page.waitForFunction(() => { const d = window.__pc.dyn; return !d.enabled || d.quality < 2 || d.scale < 0.9 || window.__pc.fps >= 40; }, null, { timeout: 240000, polling: 500 }).then(() => true, () => false);
  i = await info();
  check(down, `a slow machine is not left at the top: tier ${i.quality}, render scale ${i.scale}, ${i.fps} frames a second after ${i.frames} frames`);
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
  // The sketchbook's reward: the first landscape is sketched a few seconds after the game begins.
  i = await until((x) => x.sketches && x.sketches.count >= 1, 25);
  check(i.sketches && i.sketches.count === 1 && /^b:earth:/.test(i.sketches.keys[0]), 'the first landscape walked gets a sketch: ' + JSON.stringify(i.sketches && i.sketches.keys));
  ui = await page.evaluate(() => ({ on: window.__pc.game.hud.sketchShown, title: document.querySelector('.pc-newsketch b').textContent, sub: document.querySelector('.pc-newsketch span').textContent }));
  check(ui.on && ui.title && /page 1 of \d+/.test(ui.sub), `and the new page is shown as it is made: "${ui.title}" (${ui.sub.replace(/\s+/g, ' ')})`);
  await run.sleep(900);                                        // the slip fades in
  await shot('m3-newsketch', 'm3-newsketch');
  const px = await page.evaluate(async () => {
    const sk = window.__pc.sketches, url = sk.get(Object.keys(sk.items)[0]);
    const img = new Image(); img.src = url; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let lo = 255, hi = 0;
    for (let k = 0; k < d.length; k += 4) { const l = (d[k] + d[k + 1] + d[k + 2]) / 3; if (l < lo) lo = l; if (l > hi) hi = l; }
    return { w: img.width, h: img.height, lo: Math.round(lo), hi: Math.round(hi), chars: url.length };
  });
  check(px.w === 192 && px.h === 108 && px.hi - px.lo > 25 && px.chars < 16000, `the sketch is a real picture of the frame: ${px.w}x${px.h}, luminance ${px.lo} to ${px.hi}, ${px.chars} characters`);
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
  let text = await page.evaluate(() => document.querySelector('.pc-book').textContent);
  check(/Earth/.test(text) && /Neptune/.test(text) && /landscape/.test(text) && /views/.test(text) && /pages drawn/.test(text), 'it has a page per world, with its landscapes and views');
  const pics = await page.evaluate(() => ({ imgs: document.querySelectorAll('.pc-book img').length, empty: document.querySelectorAll('.pc-book .pc-sketch:not(.pc-on)').length, page: window.__pc.book.page }));
  check(pics.page === 'earth' && pics.imgs === 1 && pics.empty >= 1, `it opens at the world you are on, with the sketch on its page and empty frames for what is left: ${pics.imgs} sketch, ${pics.empty} empty`);
  await shot('m3-sketchbook', 'm3-sketchbook');
  await page.keyboard.press('ArrowRight');
  await gameWait(0.3);
  text = await page.evaluate(() => window.__pc.book.page + ': ' + document.querySelector('.pc-book-sub').textContent);
  check(/^moon: not yet visited/.test(text), 'the arrow keys turn the page: ' + text);
  await page.keyboard.press('KeyB');
  await gameWait(0.2);
  check(!(await info()).bookOpen, 'B closes it');
  // A gamepad (simulated: the browser's API answered by a fake standard pad).
  await page.evaluate(() => {
    const b = () => Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
    window.__pad = { connected: true, mapping: 'standard', axes: [0, -1, 0.6, 0], buttons: b() };
    navigator.getGamepads = () => [window.__pad];
  });
  const before = await info();
  await gameWait(1.6);
  i = await info();
  const walked = Math.hypot(i.explorer.p.x - before.explorer.p.x, i.explorer.p.y - before.explorer.p.y, i.explorer.p.z - before.explorer.p.z);
  check(i.explorer.speed > 2.5 && walked > 3, `gamepad: the left stick walks (${i.explorer.speed.toFixed(1)} m/s, ${walked.toFixed(1)} m), the right stick looks`);
  await page.evaluate(() => { window.__pad.axes = [0, 0, 0, 0]; window.__pad.buttons[12] = { pressed: true, value: 1 }; });
  await gameWait(0.3);
  check((await info()).bookOpen, 'gamepad: d-pad up opens the sketchbook');
  await page.evaluate(() => { window.__pad.buttons[12] = { pressed: false, value: 0 }; window.__pad.buttons[13] = { pressed: true, value: 1 }; });
  await gameWait(0.3);
  check(!(await info()).bookOpen, 'gamepad: d-pad down closes it');
  await page.evaluate(() => { navigator.getGamepads = () => []; });
  await gameWait(0.3);
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
    // The view gets its sketch too, and both pictures are kept beside the save.
    i = await until((x) => x.sketches && x.sketches.keys.some((k) => k.startsWith('v:earth:')), 15);
    check(i.sketches.keys.some((k) => k.startsWith('v:earth:')), 'the view found is sketched: ' + JSON.stringify(i.sketches.keys));
    await shot('m3-vista-sketch');
    const kept = await page.evaluate(() => { try { return Object.keys(JSON.parse(window.__pc.storage.getItem('painted-cosmos.sketches')).items); } catch { return []; } });
    check(kept.length === i.sketches.count && i.sketches.saved, `the sketches are stored beside the save: ${kept.length} pictures, ${i.sketches.chars} characters`);
    // A reload keeps the pictures.
    await page.goto(run.baseUrl + '/index.html?' + opt.query.replace(/&?fresh=1/g, '') + '&card=0', { timeout: 600000, waitUntil: 'commit' });
    await page.waitForFunction('window.__pcReady === true', null, { timeout: 600000, polling: 300 });
    i = await info();
    check(i.sketches && i.sketches.count === kept.length, 'after a reload the sketchbook still has its pictures: ' + (i.sketches && i.sketches.count));
  } else check(false, 'the world has vistas');
} catch (e) { run.fails.push('exception: ' + (e && e.stack ? e.stack : e)); }
await finish(run, opt, {});
