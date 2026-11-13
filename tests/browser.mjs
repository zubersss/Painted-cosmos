// Shared helpers for the scripted browser runs (real key and mouse events, game-time waits).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPage } from '../tools/shot.mjs';

export const RAD = Math.PI / 180;
export const MOUSE_FOOT = 0.0023, MOUSE_SHIP = 0.0017;       // rad per pixel (src/core/sim.js FEEL)
export const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function parseArgs(defaults) {
  const opt = { ...defaults };
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--keep') opt.keep = true;
    else if (a[i].startsWith('--')) opt[a[i].slice(2)] = a[++i];
  }
  return opt;
}

// The real game must never fall back to PILOT's stubs without saying so (a broken import made
// every real module fall back once, and every Node test still passed). Returns a sentence
// naming what fell back, or null. A module the run forced to its stub (?stub=...) is not a
// fall-back; the game lists the ones it tried and could not load (info().fallback).
export async function fallbackProblem(page, query = '') {
  const r = await page.evaluate(() => {
    const pc = window.__pc, i = pc && pc.info ? pc.info() : null;
    return i ? { using: i.using || {}, fallback: i.fallback } : null;
  });
  if (!r) return 'the game did not start (no window.__pc.info)';
  if (Array.isArray(r.fallback)) return r.fallback.length ? 'the real game fell back to the stub for ' + r.fallback.join('; ') : null;
  // An older game without info().fallback: any stub among the real modules, unless asked for.
  if (/(^|&)stub=/.test(query)) return null;
  const stubs = ['render', 'world', 'art', 'physics'].filter((k) => r.using[k] === 'stub');
  return stubs.length ? 'the real game is running PILOT\'s stub for ' + stubs.join(', ') : null;
}

export async function startRun(opt) {
  const W = Number(opt.w), H = Number(opt.h);
  fs.mkdirSync(opt.out, { recursive: true });
  const keepDir = path.join(repo, 'docs/shots/pilot');
  const { page, problems, close, baseUrl } = await openPage({ pagePath: '/index.html?' + opt.query, w: W, h: H, root: opt.root });
  const cx = W / 2, cy = H / 2;
  const fails = [];
  const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
  const check = (ok, msg) => { if (!ok) { fails.push(msg); log('  FAIL:', msg); } else log('  ok:', msg); return ok; };
  const info = () => page.evaluate(() => window.__pc.info());
  const sleep = (ms) => page.waitForTimeout(ms);
  async function shot(name, keepAs) {
    const file = path.join(opt.out, name + '.jpg');
    await page.screenshot({ path: file, type: 'jpeg', quality: 86, timeout: 300000 });
    if (opt.keep && keepAs) fs.copyFileSync(file, path.join(keepDir, keepAs + '.jpg'));
    return file;
  }
  // Mouse travel of (dx, dy) pixels: press, drag, release, in short strokes.
  async function look(dx, dy) {
    let rx = dx, ry = dy;
    for (let n = 0; n < 40 && (Math.abs(rx) > 0.5 || Math.abs(ry) > 0.5); n++) {
      const sx = Math.max(-140, Math.min(140, rx)), sy = Math.max(-90, Math.min(90, ry));
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx + sx, cy + sy, { steps: 3 });
      await page.mouse.up();
      rx -= sx; ry -= sy;
    }
  }
  async function gameWait(seconds) {
    const t0 = (await info()).t, w0 = Date.now();
    while ((await info()).t - t0 < seconds && Date.now() - w0 < seconds * 40000 + 20000) await sleep(30);
  }
  async function until(pred, seconds, steer, tickMs = 90) {
    let i = await info();
    const t0 = i.t, w0 = Date.now();
    while (!pred(i)) {
      if (i.t - t0 > seconds || Date.now() - w0 > seconds * 40000 + 20000) return { ...i, timedOut: true };
      if (steer) await steer(i);
      await sleep(tickMs);
      i = await info();
    }
    return i;
  }
  const holdPitch = (deg, gain = 0.35) => async (i) => {
    const err = deg - i.ship.pitchDeg;
    if (Math.abs(err) > 1.5) await look(0, -Math.max(-80, Math.min(80, (err * RAD / MOUSE_SHIP) * gain)));
  };
  // Put the nose on a body by mouse, like following its marker.
  async function aimShipAt(id, tol = 3, tries = 90) {
    let a = null;
    for (let n = 0; n < tries; n++) {
      a = await page.evaluate((b) => window.__pc.aimAt(b), id);
      if (Math.abs(a.yawDeg) < tol && Math.abs(a.pitchDeg) < tol) break;
      await look(Math.max(-110, Math.min(110, (a.yawDeg * RAD / MOUSE_SHIP) * 0.4)), -Math.max(-70, Math.min(70, (a.pitchDeg * RAD / MOUSE_SHIP) * 0.4)));
      await gameWait(0.25);
    }
    return a;
  }
  await page.waitForFunction('window.__pcReady === true', null, { timeout: 1800000, polling: 200 });
  const fb = await fallbackProblem(page, opt.query);
  check(!fb, fb || 'every module the run asked for is the real one: ' + JSON.stringify((await info()).using));
  return { page, problems, close, baseUrl, fails, log, check, info, sleep, shot, look, gameWait, until, holdPitch, aimShipAt, cx, cy, W, H };
}

// Wait until the world has had nothing left to build for `calm` frames in a row. Counted in
// game frames as well as in seconds: in software rendering a top-tier frame takes five to nine
// seconds, and a slow machine must not read as a slow game. Gives up after maxFrames frames
// (or maxSeconds, the safety net). Returns { ok, frames, seconds }.
export async function settleWorld(page, { calm = 10, maxFrames = 300, maxSeconds = 3600 } = {}) {
  const t0 = Date.now();
  const r = await page.evaluate(([calmN, maxF, maxS]) => new Promise((resolve) => {
    const pc = window.__pc, f0 = pc.game.frameCount, w0 = performance.now();
    let done = false;
    pc.settle(calmN).then(() => { if (!done) { done = true; resolve({ ok: true, frames: pc.game.frameCount - f0 }); } });
    const watch = () => {
      if (done) return;
      const fr = pc.game.frameCount - f0;
      if (fr > maxF || performance.now() - w0 > maxS * 1000) { done = true; resolve({ ok: false, frames: fr }); } else setTimeout(watch, 500);
    };
    watch();
  }), [calm, maxFrames, maxSeconds]);
  return { ...r, seconds: Math.round((Date.now() - t0) / 100) / 10 };
}

export async function finish(run, opt, summary) {
  await run.close();
  run.check(run.problems.length === 0, 'no console errors, page errors, failed or external requests' + (run.problems.length ? ': ' + [...new Set(run.problems)].slice(0, 6).join(' | ') : ''));
  summary.fails = run.fails;
  fs.writeFileSync(path.join(opt.out, 'summary.json'), JSON.stringify(summary, null, 2));
  run.log(run.fails.length ? `FAILED (${run.fails.length})` : 'PASSED', JSON.stringify(summary.timings || {}));
  for (const f of run.fails) console.log('  - ' + f);
  process.exit(run.fails.length ? 1 : 0);
}
