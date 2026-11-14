// journey.mjs: the game as a new player meets it, from the loading sheet to walking on Mars. Usage: node journey.mjs <root> <out>
import fs from 'node:fs';
import path from 'node:path';
import { start, RAD, MOUSE_FOOT, MOUSE_SHIP } from './plib.mjs';
const [root, out] = process.argv.slice(2);
let stage = 'boot';
const G = await start({
  root, out, w: 960, h: 540, query: 'dynres=0&pointerlock=0&fresh=1&save=0&audio=0&quality=2',
  onLoading: async ({ page, shotRaw, log }) => {
    // the loading sheet as it is met: a first frame at once, a second when the card says it is mixing the colours
    await page.waitForTimeout(1200);
    await shotRaw('a00-loading-a').catch((e) => log('loading-a failed', e.message.slice(0, 80)));
    log('loading text a:', JSON.stringify(await page.evaluate(() => ({ status: (document.querySelector('.pc-status') || {}).getAttribute ? document.querySelector('.pc-status').textContent : null, loading: document.getElementById('pc-loading').textContent, cls: document.getElementById('pc-hud').className })).catch(() => null)));
    await page.waitForFunction('window.__pc && window.__pc.warm && window.__pc.warm.started', null, { timeout: 1200000, polling: 500 }).catch(() => {});
    await page.waitForTimeout(600);
    await shotRaw('a00-loading-b').catch((e) => log('loading-b failed', e.message.slice(0, 80)));
  },
});
const { page, log, info, probe, drag, press, release, tap, run, shot, shotRaw, film, holdPitch, settle } = G;
const slipOn = () => page.evaluate(() => { const e = document.querySelector('.pc-newsketch'); return !!(e && e.classList.contains('pc-on')); });
try {
  // the HUD's slip for a new sketch stays five real seconds; a frame here takes longer than that to draw: its timer is stretched
  await page.evaluate(() => { const st = window.setTimeout; window.setTimeout = (f, ms, ...a) => st(f, ms === 5000 ? 240000 : ms, ...a); });
  fs.writeFileSync(path.join(out, 'cursor.txt'), await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--pc-cursor')));
  stage = 'title';
  await G.uiCalm();
  await shotRaw('a01-title'); log('title', JSON.stringify(await probe()));
  await page.mouse.click(G.cx, G.cy);
  await run(0.3);
  let started = await page.evaluate(() => window.__pc.game.started);
  log('started after the first click:', started);
  if (!started) { await page.mouse.click(G.cx, G.cy + 150); await run(0.3); log('started after a second click:', await page.evaluate(() => window.__pc.game.started)); }
  await shot('a02-first-view');
  stage = 'idle';
  await run(3.0);                                   // the first sketch is made here (drawn frames)
  await film('a03-idle', { frames: 6, every: 1, dt: 1 / 30, all: true });
  await drag(260, 0); await run(0.3);
  await shot('a04-looked');
  await drag(-260, 0); await run(0.3);
  stage = 'walk';
  await press('KeyW');
  await film('a05-walk', { frames: 8, every: 4, dt: 1 / 30 });
  await press('ShiftLeft');
  await film('a07-run', { frames: 6, every: 4, dt: 1 / 30 });
  await release('ShiftLeft'); await release('KeyW');
  await run(1.2);
  // the first page of the sketchbook is kept once the world has finished building where the explorer stands
  log('settle for the sketch', JSON.stringify(await settle()));
  let on = await slipOn();
  for (let k = 0; k < 150 && !on; k++) { await run(0.1, { dt: 0.1 }); on = await slipOn(); }
  log('slip on', on, JSON.stringify(await page.evaluate(() => window.__pc.info().sketches && { count: window.__pc.info().sketches.count, last: window.__pc.info().sketches.last })));
  await shot('a06-slip');
  stage = 'jet';
  await press('Space');
  await film('a08-jet', { frames: 6, every: 15, dt: 1 / 30, hud: true });
  await release('Space');
  await film('a09-fall', { frames: 8, every: 15, dt: 1 / 30, until: (p) => p.exAlt < 0.05 });
  await run(0.3, { dt: 1 / 30 });
  await shot('a09-landed');
  stage = 'cards';
  await run(1.5);
  await tap('KeyH'); await run(0.2); await shot('a10-help');
  await tap('KeyH'); await run(0.2);
  await tap('KeyB'); await run(0.2); await shot('a11-book-earth');
  await tap('ArrowRight'); await run(0.2); await shot('a11-book-next', { redraw: false });
  await tap('ArrowLeft'); await tap('ArrowLeft'); await run(0.2); await shot('a11-book-prev', { redraw: false });
  await tap('KeyB'); await run(0.2);
  await tap('KeyV'); await run(0.6); await shot('a12-first-person');
  await tap('KeyV'); await run(0.6);
  stage = 'to the ship';
  let i = await info();
  await drag((i.shipBearingDeg || 0) * RAD / MOUSE_FOOT, 0);
  await press('KeyW');
  i = await run(60, { dt: 0.1, until: (j) => j.canBoard, steer: async (j) => { if (j.shipBearingDeg != null && Math.abs(j.shipBearingDeg) > 4) await drag(j.shipBearingDeg * RAD / MOUSE_FOOT * 0.5, 0); } });
  await release('KeyW');
  log('at the ship', JSON.stringify({ canBoard: i.canBoard, prompt: i.prompt, d: i.shipDistance }));
  await run(0.5);
  await shot('a13-prompt-board');
  stage = 'board';
  await tap('KeyE');
  await film('a14-board', { frames: 8, every: 6, dt: 1 / 30 });
  await run(1.2);
  await shot('a15-seated');
  await tap('KeyV'); await run(0.6); await shot('a16-cockpit-landed');
  await tap('KeyV'); await run(0.6);
  await tap('KeyM'); await run(0.3); await shot('a17-map-ground');
  await tap('KeyM'); await run(0.3);
  stage = 'liftoff';
  await tap('Space');
  await film('a18-liftoff', { frames: 10, every: 10, dt: 1 / 30, hud: true });
  await press('KeyW');
  await film('a19-low', { frames: 8, every: 10, dt: 0.1, hud: true, steer: async (j) => { if (j.ship.throttle >= 0.999) await release('KeyW'); await holdPitch(-2)(j); } });
  await release('KeyW');
  await tap('KeyV'); await run(0.5); await shot('a19-low-cockpit');
  await tap('KeyV'); await run(0.5);
  stage = 'climb';
  await press('KeyW');
  await film('a20-climb', { frames: 10, every: 10, dt: 0.25, hud: true, steer: holdPitch(55), until: (p) => p.st === 'SPACE' });
  await run(60, { dt: 0.25, steer: holdPitch(55), until: (j) => j.ship.altitude > 3 * (j.ship.spaceAlt || 1e9) });
  await release('KeyW');
  await shot('a21-space');
  await tap('KeyV'); await run(0.5); await shot('a22-space-cockpit');
  await tap('KeyV'); await run(0.5);
  stage = 'map';
  await tap('KeyM'); await run(0.5); await shot('a23-map');
  for (let k = 0; k < 10; k++) { i = await info(); if (i.target && i.target.id === 'mars') break; await tap('ArrowRight'); await run(0.2); }
  await shot('a24-map-mars');
  await tap('KeyM'); await run(0.3);
  i = await info(); log('target', JSON.stringify(i.target));
  await shot('a25-off-target');
  for (let n = 0; n < 60; n++) { const a = await page.evaluate(() => window.__pc.aimAt('mars')); if (Math.abs(a.yawDeg) < 3 && Math.abs(a.pitchDeg) < 3) break; await drag(Math.max(-110, Math.min(110, a.yawDeg * RAD / MOUSE_SHIP * 0.4)), -Math.max(-70, Math.min(70, a.pitchDeg * RAD / MOUSE_SHIP * 0.4))); await run(0.25, { dt: 0.25 }); }
  await shot('a25-aimed');
  stage = 'pulse';
  await tap('KeyF');
  await film('a26-pulse-in', { frames: 8, every: 3, dt: 1 / 15, hud: true });
  await film('a26-pulse', { frames: 30, every: 24, dt: 0.25, hud: true, until: (p) => p.st === 'SPACE' });
  i = await run(600, { dt: 0.25, until: (j) => j.state === 'SPACE' });
  await film('a27-arrival', { frames: 3, every: 4, dt: 0.25, hud: true });
  stage = 'descent';
  await run(8, { dt: 0.25 });
  await press('KeyW'); await run(1.5, { dt: 0.1 }); await release('KeyW');
  await film('a28-descent', { frames: 10, every: 10, dt: 0.25, hud: true, steer: holdPitch(-60), until: (p) => p.st === 'ATMOSPHERE' });
  await film('a28-approach', { frames: 12, every: 16, dt: 0.25, hud: true, steer: holdPitch(-35), until: (p) => p.hAG < 170 });
  i = await run(300, { dt: 0.25, steer: holdPitch(-35), until: (j) => j.ship.altGround < 170 });
  await press('KeyS');
  i = await run(300, { dt: 0.25, until: (j) => j.ship.canLand, steer: async (j) => { await holdPitch(j.ship.altGround > 110 ? -18 : -7)(j); if (j.ship.throttle < 0.25) await release('KeyS'); } });
  await release('KeyS');
  await shot('a29-mars-prompt', { settleFirst: true });
  stage = 'landing';
  await tap('KeyE');
  await film('a30-landing', { frames: 10, every: 5, dt: 0.1, until: (p) => p.st === 'LANDED' });
  await run(1.5);
  await shot('a31-landed-mars', { settleFirst: true });
  await tap('KeyE');
  await film('a32-stepout', { frames: 8, every: 4, dt: 0.1 });
  await run(0.5);
  await shot('a33-mars-out', { settleFirst: true });
  stage = 'mars';
  await press('KeyW');
  await film('a34-mars-walk', { frames: 4, every: 8, dt: 1 / 30 });
  await run(1.5);
  await release('KeyW'); await run(1);
  log('settle for the sketch', JSON.stringify(await settle()));
  on = await slipOn();
  for (let k = 0; k < 150 && !on; k++) { await run(0.1, { dt: 0.1 }); on = await slipOn(); }
  await shot('a35-mars-slip');
  await tap('KeyB'); await run(0.2); await shot('a36-book-mars');
  await tap('KeyB'); await run(0.2);
  await press('Space');
  await film('a37-mars-jet', { frames: 4, every: 20, dt: 1 / 30, hud: true });
  await release('Space');
  stage = 'done';
} catch (e) { log('FAILED at stage', stage, String(e.stack || e.message).split('\n').slice(0, 4).join(' | ')); try { await shotRaw('zz-failed'); } catch { /* ignore */ } }
log('stage', stage);
await G.done();
