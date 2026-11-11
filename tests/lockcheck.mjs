// Pointer-lock fallback, checked in the one place it can be provoked on demand: headless
// Chromium grants the lock but then reports meaningless mouse deltas for scripted events.
// The game must notice, drop the lock, say so on screen, and carry on with drag-look.
// Usage: node tests/lockcheck.mjs [--query "stub=1"] [--root dir]
import { parseArgs, startRun, finish } from './browser.mjs';

const opt = parseArgs({ out: '/home/user/.pc-scratch/pilot/lock', w: 640, h: 360, query: 'stub=1' });
opt.query += '&dynres=0&card=0&fresh=1';                 // note: no pointerlock=0 here
const run = await startRun(opt);
const { page, check, info, shot, gameWait } = run;
const state = () => page.evaluate(() => ({
  locked: window.__pc.game.input.locked, use: window.__pc.game.input.usePointerLock,
  pitch: window.__pc.sim.footCam.pitch, notice: window.__pc.info().uiNotice,
}));
try {
  let s = await state();
  check(s.use === true && s.locked === false, 'starts wanting pointer lock, not yet locked');
  await page.mouse.click(run.cx, run.cy);
  await gameWait(0.3);
  s = await state();
  check(s.locked === true, 'the browser granted the lock');
  const pitch0 = s.pitch;
  // A few ordinary drags: under the lock these arrive as window-sized jumps that undo themselves.
  for (let i = 0; i < 4; i++) {
    await page.mouse.move(run.cx, run.cy); await page.mouse.down();
    await page.mouse.move(run.cx + 30, run.cy - 20, { steps: 3 }); await page.mouse.up();
    await gameWait(0.15);
  }
  s = await state();
  check(s.use === false && s.locked === false, 'the game stopped trusting the lock and released it');
  check(/drag to look/.test(s.notice || ''), 'and says so on screen: "' + s.notice + '"');
  check(Math.abs(s.pitch - pitch0) < 0.5, 'the nonsense did not throw the view about: pitch moved ' + (s.pitch - pitch0).toFixed(3) + ' rad');
  await shot('lock-fallback');
  // Drag-look now works and is exact: 40 px up is 0.092 rad of pitch.
  const p1 = (await state()).pitch;
  await page.mouse.move(run.cx, run.cy); await page.mouse.down();
  await page.mouse.move(run.cx, run.cy - 40, { steps: 4 }); await page.mouse.up();
  await gameWait(0.2);
  s = await state();
  check(Math.abs((s.pitch - p1) - 40 * 0.0023) < 0.01, 'drag-look: 40 px up turned the view ' + (s.pitch - p1).toFixed(3) + ' rad');
} catch (e) { run.fails.push('exception: ' + (e && e.stack ? e.stack : e)); }
await finish(run, opt, {});
