// plib.mjs: the PAINTER critic's play harness (M4). One browser, the real game (index.html of a clean export), real key
// and mouse events, the game's clock held and stepped by fixed steps. Frames that are not kept are simulated but not
// drawn (painter.render is swapped for a stand-in that only advances the shader clock, as the real one does), so a long
// journey fits a machine that draws a top-tier frame in seconds; every kept frame is drawn by the real painter.
import fs from 'node:fs';
import path from 'node:path';
export const RAD = Math.PI / 180, MOUSE_FOOT = 0.0023, MOUSE_SHIP = 0.0017;

export async function start({ root, out, w = 960, h = 540, query, waitReady = true, onLoading = null }) {
  const { openPage } = await import(path.join(root, 'tools/shot.mjs'));
  const { settleWorld, fallbackProblem } = await import(path.join(root, 'tests/browser.mjs'));
  fs.mkdirSync(out, { recursive: true });
  const t0 = Date.now();
  const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
  const { page, problems, close } = await openPage({ pagePath: '/index.html?' + query, w, h, root });
  const msgs = [];
  page.on('console', (m) => { if (m.type() === 'warning') msgs.push('warning: ' + m.text().slice(0, 300)); });
  const cx = w / 2, cy = h / 2;
  const info = () => page.evaluate(() => window.__pc.info());
  const shotRaw = async (name) => { const f = path.join(out, name + '.jpg'); await page.screenshot({ path: f, type: 'jpeg', quality: 90, timeout: 600000 }); return f; };
  if (onLoading) await onLoading({ page, shotRaw, log });
  if (waitReady) {
    await page.waitForFunction('window.__pcReady === true', null, { timeout: 2400000, polling: 500 });
    const fb = await fallbackProblem(page, query); if (fb) throw new Error('FALLBACK: ' + fb);
    log('ready after', ((Date.now() - t0) / 1000).toFixed(0), 's', JSON.stringify((await info()).using));
  }
  // the stand-in for painter.render and the numbers of an instant, installed in the page
  const install = () => page.evaluate(async () => {
    const pc = window.__pc; if (window.__crit) return true;
    const sh = await import(new URL('./src/render/shared.js', location.href).href);
    const P = pc.painter, real = P.render;
    const C = window.__crit = { skip: false, real, drawn: 0, skipped: 0 };
    P.render = function (scene, camera, dt) {
      if (C.skip) {
        // a sketch for the book is read from the canvas right after this frame: draw that one
        // (game.js updateSketches: at its due time once the world has nothing left to build here, or 8 s after it)
        const g = pc.game, want = g._sketchWant || {}, t = pc.sim.t; let need = false;
        const busy = typeof pc.world.busy === 'number' && pc.world.busy > 0;
        for (const k in want) if (t >= want[k].due && !(busy && t < want[k].due + 8)) need = true;
        if (!need) { if (dt > 0) sh.G.uTime.value += Math.min(dt, 0.1); C.skipped++; return; }
      }
      C.drawn++; return real.call(P, scene, camera, dt);
    };
    // wait for the GPU to finish what was drawn (a step returns when its commands are issued, not when they are done:
    // without this a run of drawn frames queues minutes of work and the next screenshot waits for all of it)
    const one = document.createElement('canvas'); one.width = one.height = 1; const g1 = one.getContext('2d', { willReadFrequently: true });
    C.sync = () => { const c = document.getElementById('pc-canvas') || document.querySelector('canvas'); g1.drawImage(c, 0, 0, 1, 1); return g1.getImageData(0, 0, 1, 1).data[0]; };
    C.stepSync = (dt) => { const d0 = C.drawn; pc.step(dt, 1); if (C.drawn !== d0) C.sync(); return C.drawn - d0; };
    C.probe = () => { const i = pc.info(), ex = pc.sim.ex, s = pc.sim.sh, B = ex.phys || {}, r2 = (v) => (v == null || !isFinite(v) ? null : +(+v).toFixed(2));
      const h = pc.physics && pc.physics.here ? pc.physics.here : null;
      return { t: r2(i.t), st: i.state, body: i.body, biome: ex.surface ? ex.surface.biomeId : null, hour: r2(i.mood && i.mood.timeOfDay), exV: r2(ex.speed), exAlt: r2(ex.altitude), vUp: r2(i.explorer.vUp), fuel: r2(ex.fuel), mode: ex.mode, gait: B.gait,
        depth: r2(ex.liquidDepth), fp: i.explorer.firstPerson ? 1 : 0, shV: r2(s.speed), hAG: r2(s.altGround), alt: r2(i.ship.altitude), pitch: r2(i.ship.pitchDeg), thr: r2(s.throttle), cockpit: i.ship.cockpit ? 1 : 0,
        prompt: i.prompt, notice: i.notice, ui: i.uiNotice, view: i.view, cam: r2(i.cameraClearance), inSpace: r2(i.mood && i.mood.inSpace01),
        wind: h && h.air ? r2(h.air.speed) : null, gust: h && h.air ? r2(h.air.gust01) : null, wx: h && h.weather ? h.weather.kind : null,
        sky: i.weather && i.weather.sky ? i.weather.sky : null, busy: pc.world.busy, errs: pc.errors.length, fb: i.fallback.length }; };
    return true;
  });
  if (waitReady) { await page.evaluate(() => window.__pc.hold(true)); await install(); await page.evaluate(() => window.__crit.sync()); }
  const probe = () => page.evaluate(() => window.__crit.probe());
  const skip = (on) => page.evaluate((v) => { window.__crit.skip = !!v; }, on);
  const hold = (on) => page.evaluate((v) => window.__pc.hold(v), on);
  async function drag(dx, dy) {
    let rx = dx, ry = dy;
    for (let n = 0; n < 30 && (Math.abs(rx) > 0.5 || Math.abs(ry) > 0.5); n++) {
      const sx = Math.max(-140, Math.min(140, rx)), sy = Math.max(-90, Math.min(90, ry));
      await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + sx, cy + sy, { steps: 2 }); await page.mouse.up();
      rx -= sx; ry -= sy;
    }
  }
  const press = (k) => page.keyboard.down(k), release = (k) => page.keyboard.up(k);
  const tap = async (k) => { await page.keyboard.down(k); await page.keyboard.up(k); };
  // step the clock without drawing: `seconds` of game time in steps of dt; steer(info) and until(info) run each step
  async function run(seconds, { dt = 0.1, steer = null, until = null } = {}) {
    await skip(true);
    const n = Math.max(1, Math.round(seconds / dt)); let i = null;
    for (let k = 0; k < n; k++) {
      if (steer || until) i = await info();
      if (until && until(i)) return i;
      if (steer) await steer(i);
      await page.evaluate((d) => window.__crit.stepSync(d), dt);
    }
    return info();
  }
  // draw the present instant for real (one small step so that the frame is the painter's own)
  const draw = async (dt = 1 / 120) => { await skip(false); await page.evaluate((d) => window.__crit.stepSync(d), dt); await skip(true); };
  // let the world finish what it is building here: the clock stands still, frames are not drawn
  async function settle({ calm = 6, maxFrames = 2500, maxSeconds = 900 } = {}) {
    await skip(true);
    await page.evaluate(() => { window.__pc.setTimeScale(0); window.__pc.hold(false); });
    const st = await settleWorld(page, { calm, maxFrames, maxSeconds }).catch((e) => ({ ok: false, err: String(e.message).slice(0, 80) }));
    await page.evaluate(() => { window.__pc.hold(true); window.__pc.setTimeScale(1); });
    return st;
  }
  // the HUD's fades run in real time: wait until every slip is fully in or out (two equal samples), 6 s at most
  async function uiCalm(maxMs = 6000) {
    const read = () => page.evaluate(() => [...document.querySelectorAll('.pc-start, .pc-prompt, .pc-hint, .pc-notice, .pc-readout, .pc-newsketch, .pc-gauge, .pc-reticle')].map((e) => getComputedStyle(e).opacity + '/' + getComputedStyle(e).bottom).join(' '));
    const w0 = Date.now(); let a = await read();
    for (;;) { await page.waitForTimeout(260); const b = await read(); const calm = a === b && b.split(' ').every((x) => { const o = +x.split('/')[0]; return o === 0 || o === 1 || o === 0.5; }); if (calm || Date.now() - w0 > maxMs) return calm; a = b; }
  }
  // a kept frame with the HUD as the player sees it (the page), drawn for real first
  async function shot(name, { settleFirst = false, redraw = true, note = '', uiWait = 1500 } = {}) {
    const w0 = Date.now();
    let st = null; if (settleFirst) st = await settle();
    if (redraw) await draw();
    if (uiWait) await uiCalm();
    const f = await shotRaw(name);
    const p = await probe();
    log(`shot ${name} (${((Date.now() - w0) / 1000).toFixed(0)} s${st ? ', settled ' + JSON.stringify(st) : ''}) ${note} ${JSON.stringify(p)}`);
    fs.appendFileSync(path.join(out, 'frames.jsonl'), JSON.stringify({ name, note, ...p }) + '\n');
    return p;
  }
  // a strip: `frames` kept frames, `every` steps of dt apart; the kept ones drawn for real and read from the canvas
  // (no HUD) unless hud: true (page screenshots). all: true draws every step (the shader clock and the wind then run
  // exactly as in play; needed where sub-second motion is judged).
  async function film(name, { frames, every = 1, dt = 1 / 30, steer = null, until = null, hud = false, all = false } = {}) {
    const w0 = Date.now(), rows = [];
    for (let i = 0; i < frames; i++) {
      await skip(!all);
      for (let k = 0; k < every - 1; k++) { if (steer) await steer(await info()); await page.evaluate((d) => window.__crit.stepSync(d), dt); }
      if (steer) await steer(await info());
      await skip(false);
      const fn = `${name}-${String(i).padStart(2, '0')}`;
      let p;
      if (hud) { await page.evaluate((d) => window.__crit.stepSync(d), dt); await uiCalm(); await shotRaw(fn); p = await probe(); }
      else {
        const r = await page.evaluate((d) => { window.__pc.step(d, 1); const c = document.getElementById('pc-canvas') || document.querySelector('canvas'); return { url: c.toDataURL('image/jpeg', 0.93), p: window.__crit.probe() }; }, dt);
        fs.writeFileSync(path.join(out, fn + '.jpg'), Buffer.from(r.url.split(',')[1], 'base64')); p = r.p;
      }
      rows.push(p);
      fs.appendFileSync(path.join(out, 'frames.jsonl'), JSON.stringify({ name: fn, ...p }) + '\n');
      if (until && until(p)) break;
    }
    await skip(true);
    fs.writeFileSync(path.join(out, name + '.json'), JSON.stringify({ name, dt, every, rows }, null, 0) + '\n');
    log(`film ${name}: ${rows.length} frames in ${((Date.now() - w0) / 1000).toFixed(0)} s; first ${JSON.stringify(rows[0])}; last ${JSON.stringify(rows[rows.length - 1])}`);
    return rows;
  }
  const holdPitch = (deg, gain = 0.35) => async (i) => { const e = deg - i.ship.pitchDeg; if (Math.abs(e) > 1.5) await drag(0, -Math.max(-80, Math.min(80, (e * RAD / MOUSE_SHIP) * gain))); };
  const done = async () => {
    const errs = await page.evaluate(() => (window.__pc && window.__pc.errors) || []).catch(() => ['page gone']);
    const fb = await page.evaluate(() => window.__pc.info().fallback).catch(() => null);
    const cnt = await page.evaluate(() => window.__crit ? { drawn: window.__crit.drawn, skipped: window.__crit.skipped } : null).catch(() => null);
    await close();
    log('END problems', JSON.stringify([...new Set(problems)].slice(0, 12)), 'warnings', JSON.stringify([...new Set(msgs)].slice(0, 6)), 'game errors', JSON.stringify(errs.slice(0, 5)), 'fallback', JSON.stringify(fb), 'frames', JSON.stringify(cnt), 'wall', ((Date.now() - t0) / 60000).toFixed(1), 'min');
  };
  return { page, problems, log, info, probe, skip, hold, uiCalm, drag, press, release, tap, run, draw, settle, shot, shotRaw, film, holdPitch, done, install, cx, cy, w, h, out, settleWorld };
}
