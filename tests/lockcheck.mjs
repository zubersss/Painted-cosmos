// Pointer-lock fallback, checked in the one place it can be provoked on demand: headless
// Chromium grants the lock but then reports meaningless mouse deltas for scripted events.
// The game must notice, drop the lock, say so on screen, and carry on with drag-look.
// Usage: node tests/lockcheck.mjs [--query "stub=1"] [--root dir]
import { parseArgs, startRun, finish } from './browser.mjs';

const opt = parseArgs({ out: '/home/user/.pc-scratch/pilot/lock', w: 640, h: 360, query: 'stub=1' });
opt.query += '&dynres=0&card=0&fresh=1';                 // note: no pointerlock=0 here
const run = await startRun(opt);
const { page, check, info, shot, gameWait, sleep } = run;
const state = () => page.evaluate(() => ({
  locked: window.__pc.game.input.locked, use: window.__pc.game.input.usePointerLock,
  trips: window.__pc.game.input._trips || 0, lockEl: !!document.pointerLockElement,
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
  // The game lets go of the lock for the session (it once tried it again at the next click,
  // and the nonsense came back with it: M4's blind play-test).
  for (let i = 0; i < 12; i++) {
    await page.mouse.move(run.cx, run.cy); await page.mouse.down();
    await page.mouse.move(run.cx + 30, run.cy - 20, { steps: 3 }); await page.mouse.up();
    await gameWait(0.15);
    s = await state();
    if (s.use === false) break;
  }
  s = await state();
  check(s.use === false && s.locked === false, 'the game stopped trusting the lock and released it');
  for (let i = 0; i < 3; i++) { await page.mouse.click(run.cx, run.cy); await gameWait(0.1); }
  s = await state();
  check(s.use === false && s.locked === false && !s.lockEl, 'three more clicks: the lock is not taken again (pointerLockElement ' + s.lockEl + ')');
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
  // A click some fifteen seconds after the trip tries the lock once more (a real browser that
  // glitched once is not left dragging for the visit: the pre-ship verifier's R4); here the
  // nonsense comes back with it, and the second trip is for the session.
  const wait = await page.evaluate(() => Math.max(0, window.__pc.game.input._retryAt - performance.now()));
  await sleep(wait + 300);
  await page.mouse.click(run.cx, run.cy);
  await gameWait(0.3);
  s = await state();
  check(s.use === true && s.locked === true && s.trips === 1, `${(wait / 1000).toFixed(1)} s later a click tries the lock once more (locked ${s.locked})`);
  for (let i = 0; i < 12; i++) {
    await page.mouse.move(run.cx, run.cy); await page.mouse.down();
    await page.mouse.move(run.cx + 30, run.cy - 20, { steps: 3 }); await page.mouse.up();
    await gameWait(0.15);
    s = await state();
    if (s.use === false) break;
  }
  s = await state();
  check(s.use === false && s.locked === false && s.trips === 2, 'the nonsense again: the lock let go for the session (trips ' + s.trips + ')');
  check(/in this browser/.test(s.notice || ''), 'and the screen says so: "' + s.notice + '"');
  await sleep(16000);
  for (let i = 0; i < 3; i++) { await page.mouse.click(run.cx, run.cy); await gameWait(0.1); }
  s = await state();
  check(s.use === false && s.locked === false && !s.lockEl, 'three clicks 16 s later: the lock is not taken again (pointerLockElement ' + s.lockEl + ')');
  const p2 = (await state()).pitch;
  await page.mouse.move(run.cx, run.cy); await page.mouse.down();
  await page.mouse.move(run.cx, run.cy - 40, { steps: 4 }); await page.mouse.up();
  await gameWait(0.2);
  s = await state();
  check(Math.abs((s.pitch - p2) - 40 * 0.0023) < 0.01, 'drag-look after the second trip: 40 px up turned the view ' + (s.pitch - p2).toFixed(3) + ' rad');
} catch (e) { run.fails.push('exception: ' + (e && e.stack ? e.stack : e)); }
await finish(run, opt, {});
