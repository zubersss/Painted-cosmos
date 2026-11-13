// Extra scenes for film.mjs (SCENES=<this file>): PILOT 14's fix round.
const landHere = async (c, o) => {
  await c.tp(o);
  await c.run(1, { dt: 0.1 });
  await c.tap('KeyE');
  await c.run(90, { dt: 0.1, until: (i) => i.state === 'LANDED' });
  await c.run(1.5, { dt: 0.1 });
};
const stepOut = async (c, name) => {
  await c.shot(name + '-0-landed');
  await c.tap('KeyE');
  await c.film(name, { frames: 12, every: 6, dt: 1 / 30, cols: 6, tile: [320, 180] });
  await c.run(1.3, { dt: 0.1 });
  await c.shot(name + '-9-out');
  c.log(name + ' sketches ' + JSON.stringify(await c.page.evaluate(() => { const i = window.__pc.info(); return { sk: i.sketches, inPic: window.__pc.sim.shipInPicture ? window.__pc.sim.shipInPicture() : null, hull: window.__pc.sim.hullInView ? window.__pc.sim.hullInView(1) : null }; })));
};
const RADm = Math.PI / 180;
const dom = (c) => c.page.evaluate(() => {
  const q = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { cls: e.className, text: (e.textContent || '').replace(/\s+/g, ' ').slice(0, 90), x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), op: getComputedStyle(e).opacity }; };
  return { hud: document.querySelector('.pc-hud').className, prompt: q('.pc-prompt'), notice: q('.pc-notice'), hint: q('.pc-hint'), slip: q('.pc-newsketch'), simPrompt: window.__pc.sim.promptNow, simNotice: window.__pc.sim.notice && window.__pc.sim.notice.text, offer: window.__pc.sim.easelOffer && window.__pc.sim.easelOffer.id };
});
// Steps simulated and not drawn (painter.render swapped for a stand-in meanwhile), for the long legs at the top tier.
const fastRun = (c, seconds, cond = null, dt = 1 / 30) => c.page.evaluate(({ n, dt, cond }) => {
  const pc = window.__pc, painter = pc.game.painter, real = painter.render;
  const done = () => { const i = pc.sim; return cond === 'offer' ? !!i.easelOffer : cond === 'hold' ? !!(i.easel && i.easel.phase === 'hold') : cond === 'noeasel' ? !i.easel : cond === 'landed' ? i.sm.state === 'LANDED' : cond === 'foot' ? i.sm.state === 'ON_FOOT' : false; };
  painter.render = () => {};
  let k = 0;
  try { for (; k < n && !done(); k++) pc.step(dt, 1); } finally { painter.render = real; }
  pc.step(dt, 1);
  return { steps: k, state: pc.sim.sm.state, t: +pc.sim.t.toFixed(1) };
}, { n: Math.round(seconds / dt), dt, cond });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export default {
  // the hero frames at the top tier (run with Q=2 W=960 H=540 CARD=1): the first frame, a view offered, the easel,
  // the new page's slip, the book; stepping out on Mars and its page
  async top(c) {
    await wait(1500);
    await c.shot('top-0-first');
    await c.page.evaluate(() => { const sim = window.__pc.sim, d = sim.vistasOf('earth')[0].dir, k = 17 / 4000; window.__pc.teleport({ body: 'earth', dir: [d.x + k, d.y, d.z - k * 0.3] }); });
    await c.settle();
    const n = await c.page.evaluate(() => window.__pc.sim.nearestVista());
    c.log('top: view ' + n.distance.toFixed(0) + ' m, bearing ' + n.bearingDeg.toFixed(0));
    await c.drag(n.bearingDeg * RADm / c.MOUSE_FOOT, 0);
    await c.press('KeyW');
    c.log('top: walk ' + JSON.stringify(await fastRun(c, 6, 'offer')));
    await c.release('KeyW');
    await fastRun(c, 0.8);
    await wait(1500);
    await c.shot('top-1-offer');
    await c.tap('KeyE');
    c.log('top: to the easel ' + JSON.stringify(await fastRun(c, 6, 'hold')));
    await c.shot('top-2-easel');
    c.log('top: held ' + JSON.stringify(await fastRun(c, 9, 'noeasel')));
    await fastRun(c, 0.5);
    await wait(1500);
    await c.shot('top-3-slip');
    await c.tap('KeyB'); await fastRun(c, 0.3);
    await wait(800);
    await c.shot('top-4-book-earth');
    await c.tap('KeyB'); await fastRun(c, 0.3);
    await c.tp({ body: 'mars', ship: true, altitude: 30 });
    await fastRun(c, 1);
    await c.tap('KeyE');
    c.log('top: landing ' + JSON.stringify(await fastRun(c, 90, 'landed', 1 / 20)));
    await fastRun(c, 1.5);
    await c.tap('KeyE');
    c.log('top: out ' + JSON.stringify(await fastRun(c, 6, 'foot')));
    await fastRun(c, 0.3);
    await wait(1200);
    await c.shot('top-5-stepped-out-mars');
    await c.press('KeyW'); await fastRun(c, 3); await c.release('KeyW');
    await fastRun(c, 5);
    await wait(1500);
    await c.shot('top-6-mars-slip');
    await c.tap('KeyB'); await fastRun(c, 0.3);
    await wait(800);
    await c.shot('top-7-book-mars');
    await c.tap('KeyB'); await fastRun(c, 0.3);
    c.log('top: sketches ' + JSON.stringify(await c.page.evaluate(() => { const i = window.__pc.info(); return { keys: i.sketches.keys, chars: i.sketches.chars }; })));
  },
  // PAINTER 9: from the seat, landed and in low flight with the prompt up
  async cockpit(c) {
    await c.toShipAndBoard();
    await c.tap('KeyV');
    await c.run(1, { dt: 0.1 });
    await wait(1200);
    await c.shot('cockpit-0-landed');
    await c.tap('Space');
    await c.run(9, { dt: 0.1 });
    await c.press('KeyW');
    await c.run(5, { dt: 0.1, steer: c.holdPitch(0) });
    await c.release('KeyW');
    await wait(1200);
    await c.shot('cockpit-1-flight');
    await c.page.evaluate(() => window.__pc.sim.say('Thin air on Mars: the ship runs fast and turns wide. Hold X to slow it', 8));
    await c.run(0.4, { dt: 0.1 });
    await wait(1200);
    await c.shot('cockpit-2-notice');
    await c.tap('KeyV');
  },
  // the sketches at the top tier, drawn from painted frames (the frames round each capture are drawn)
  async top2(c) {
    await c.page.evaluate(() => { const sim = window.__pc.sim, d = sim.vistasOf('earth')[0].dir, k = 17 / 4000; window.__pc.teleport({ body: 'earth', dir: [d.x + k, d.y, d.z - k * 0.3] }); });
    await c.settle();
    const n = await c.page.evaluate(() => window.__pc.sim.nearestVista());
    await c.drag(n.bearingDeg * RADm / c.MOUSE_FOOT, 0);
    await c.press('KeyW');
    await fastRun(c, 6, 'offer');
    await c.release('KeyW');
    await c.tap('KeyE');
    c.log('top2: to the easel ' + JSON.stringify(await fastRun(c, 6, 'hold')));
    await c.run(2.8, { dt: 0.1, until: (i) => !i.easel });
    await wait(1500);
    await c.shot('top2-0-slip');
    await c.tap('KeyB'); await fastRun(c, 0.3);
    await wait(800);
    await c.shot('top2-1-book-earth');
    await c.tap('KeyB'); await fastRun(c, 0.3);
    await c.tp({ body: 'mars', ship: true, altitude: 30 });
    await fastRun(c, 1);
    await c.tap('KeyE');
    await fastRun(c, 90, 'landed', 1 / 20);
    await fastRun(c, 1.5);
    await c.tap('KeyE');
    await fastRun(c, 6, 'foot');
    await c.run(4.5, { dt: 0.1, until: (i) => i.sketches && i.sketches.keys.some((k) => k.startsWith('b:mars')) });
    await c.press('KeyW'); await fastRun(c, 2.5); await c.release('KeyW');
    await fastRun(c, 1);
    await wait(1500);
    await c.shot('top2-2-mars-slip');
    await c.tap('KeyB'); await fastRun(c, 0.3);
    await wait(800);
    await c.shot('top2-3-book-mars');
    await c.tap('KeyB'); await fastRun(c, 0.3);
    c.log('top2: sketches ' + JSON.stringify(await c.page.evaluate(() => { const i = window.__pc.info(); return { keys: i.sketches.keys, chars: i.sketches.chars }; })));
  },
  // the offer at a found view: what the HUD holds
  async offer(c) {
    await c.page.evaluate(() => { const sim = window.__pc.sim, d = sim.vistasOf('earth')[0].dir, k = 30 / 4000; window.__pc.teleport({ body: 'earth', dir: [d.x + k, d.y, d.z - k * 0.3] }); });
    await c.settle();
    await c.run(0.5, { dt: 0.1 });
    const n = await c.page.evaluate(() => window.__pc.sim.nearestVista());
    await c.drag(n.bearingDeg * RADm / c.MOUSE_FOOT, 0);
    await c.press('KeyW');
    await c.run(40, { dt: 0.1, until: (i) => !!i.easelOffer, steer: async () => { const m = await c.page.evaluate(() => window.__pc.sim.nearestVista()); if (m && Math.abs(m.bearingDeg) > 5) await c.drag(m.bearingDeg * RADm / c.MOUSE_FOOT * 0.6, 0); } });
    await c.release('KeyW');
    c.log('offer dom at once ' + JSON.stringify(await dom(c)));
    await c.run(0.8, { dt: 0.1 });
    c.log('offer dom +0.8 ' + JSON.stringify(await dom(c)));
    await c.shot('offer-0');
    await new Promise((r) => setTimeout(r, 1500));
    await c.shot('offer-1-later');
    c.log('offer dom later ' + JSON.stringify(await dom(c)));
  },
  // PHYSICS on PILOT 4 / PAINTER 10: the jetpack up through the glade's crowns and down again, from the spawn
  async jet(c) {
    await c.page.evaluate(() => window.__pc.teleport({ body: 'earth' }));
    await c.settle();
    await c.run(0.5, { dt: 0.1 });
    await c.press('Space');
    await c.film('jet-up', { frames: 12, every: 8, dt: 1 / 30, cols: 6, tile: [320, 180] });
    await c.release('Space');
    await c.film('jet-down', { frames: 18, every: 8, dt: 1 / 30, cols: 6, tile: [320, 180], until: (p) => p.exAlt < 0.05 && p.exV < 0.5 && p.mode !== 'fall' && p.mode !== 'jet' });
    await c.shot('jet-9-landed');
  },
  // the jetpack from beside the ship, under the birches (where PAINTER and PHYSICS filmed the slabs)
  async jet2(c) {
    await c.page.evaluate(() => window.__pc.teleport({ body: 'earth' }));
    await c.settle();
    let i = await c.info();
    await c.drag((i.shipBearingDeg || 0) * RADm / c.MOUSE_FOOT, 0);
    await c.press('KeyW');
    await c.run(40, { dt: 0.1, until: (j) => j.canBoard, steer: async (j) => { if (j.shipBearingDeg != null && Math.abs(j.shipBearingDeg) > 4) await c.drag(j.shipBearingDeg * RADm / c.MOUSE_FOOT * 0.5, 0); } });
    await c.release('KeyW');
    await c.run(0.6, { dt: 0.1 });
    await c.press('Space');
    await c.film('jet2-up', { frames: 12, every: 8, dt: 1 / 30, cols: 6, tile: [320, 180] });
    await c.release('Space');
    await c.film('jet2-down', { frames: 18, every: 8, dt: 1 / 30, cols: 6, tile: [320, 180], until: (p) => p.exAlt < 0.05 && p.mode !== 'fall' && p.mode !== 'jet' });
    await c.shot('jet2-9-landed');
  },
  // PAINTER 6: the slips at night (on foot by the ship: the prompt) and by day, the same place
  async night(c) {
    await c.page.evaluate(() => window.__pc.setHour(13));
    await c.run(1.2, { dt: 0.1 });
    await new Promise((r) => setTimeout(r, 1200));
    await c.shot('night-0-day');
    await c.page.evaluate(() => window.__pc.setHour(23));
    await c.run(1.2, { dt: 0.1 });
    await new Promise((r) => setTimeout(r, 1200));
    await c.shot('night-1-night');
    c.log('night key ' + (await c.page.evaluate(() => document.querySelector('.pc-hud').style.getPropertyValue('--pc-key') + ' rate ' + window.__pc.sim.clockRate)));
    await c.page.evaluate(() => window.__pc.setHour(10));
    await c.run(1, { dt: 0.1 });
  },
  // PAINTER 5: the dusk under the uneven clock, at the spawn: from 16.6 h on, a frame every 25 s of play
  // (the frames between are simulated and not drawn: painter.render is swapped for a stand-in meanwhile)
  async dusk(c) {
    await c.page.evaluate(() => { window.__pc.teleport({ body: 'earth' }); });
    await c.settle();
    await c.page.evaluate(() => { window.__pc.setHour(16.6); });
    await c.run(1, { dt: 0.1 });
    const rows = [];
    await c.page.evaluate(() => {
      const S = window.__dusk = { c: document.createElement('canvas'), tw: 320, th: 180, cols: 6, n: 0 };
      S.c.width = S.tw * S.cols; S.c.height = S.th * 3; const g = S.c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, S.c.width, S.c.height);
    });
    for (let k = 0; k < 18; k++) {
      const r = await c.page.evaluate(() => {
        const pc = window.__pc, painter = pc.game.painter, real = painter.render;
        if (window.__dusk.n > 0) { painter.render = () => {}; for (let i = 0; i < 100; i++) pc.step(0.25, 1); painter.render = real; }
        pc.step(1 / 30, 1);
        const S = window.__dusk, gl = document.getElementById('pc-canvas') || document.querySelector('canvas'), g = S.c.getContext('2d');
        const x = (S.n % S.cols) * S.tw, y = Math.floor(S.n / S.cols) * S.th; g.drawImage(gl, 0, 0, gl.width, gl.height, x, y, S.tw, S.th);
        const sim = pc.sim, i = pc.info(), up = (() => { const p = sim.ex.p, l = Math.hypot(p.x, p.y, p.z); return { x: p.x / l, y: p.y / l, z: p.z / l }; })();
        const el = Math.asin(sim.eph.sunElevationSin('earth', sim.t, up)) * 180 / Math.PI;
        const s = S.n + '  ' + (S.n * 25) + ' s  ' + i.mood.timeOfDay.toFixed(2) + ' h  sun ' + el.toFixed(1) + ' deg';
        g.font = '11px monospace'; g.textBaseline = 'top'; g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(x, y, s.length * 6.7 + 4, 13); g.fillStyle = '#000'; g.fillText(s, x + 2, y + 1);
        S.n++;
        return { n: S.n - 1, t: +sim.t.toFixed(1), hour: +i.mood.timeOfDay.toFixed(2), sunDeg: +el.toFixed(1), rate: +sim.clockRate.toFixed(2) };
      });
      rows.push(r);
      c.log('dusk ' + JSON.stringify(r));
    }
    const res = await c.page.evaluate(() => window.__dusk.c.toDataURL('image/jpeg', 0.86));
    const fs = await import('node:fs'), path = await import('node:path');
    fs.writeFileSync(path.join(c.outDir, 'dusk.jpg'), Buffer.from(res.split(',')[1], 'base64'));
    fs.writeFileSync(path.join(c.outDir, 'dusk.json'), JSON.stringify(rows) + '\n');
  },
  // PHYSICS 5: a swimmer off Earth's coast: the view over them, a turn, Space (no hop), Space held (the jetpack)
  async swim(c) {
    const ok = await c.page.evaluate(() => {
      const pc = window.__pc, st = pc.world.findBiome ? pc.world.findBiome('earth', 'sea_coast') : null;
      if (!st) return null;
      const d = st.unitDir; pc.teleport({ body: 'earth', dir: [d.x, d.y, d.z] });
      // which way is the sea: the first of sixteen headings with deep liquid 70 m out
      const sim = pc.sim, p = sim.ex.p, R = Math.hypot(p.x, p.y, p.z), up = { x: p.x / R, y: p.y / R, z: p.z / R };
      const e = (() => { let x = up.z, z = -up.x; const l = Math.hypot(x, z) || 1; return { x: x / l, y: 0, z: z / l }; })();
      const n = { x: up.y * e.z - up.z * e.y, y: up.z * e.x - up.x * e.z, z: up.x * e.y - up.y * e.x };
      let best = null;
      for (let k = 0; k < 16; k++) {
        const a = k / 16 * Math.PI * 2, f = { x: n.x * Math.cos(a) + e.x * Math.sin(a), y: n.y * Math.cos(a) + e.y * Math.sin(a), z: n.z * Math.cos(a) + e.z * Math.sin(a) };
        let wet = 0;
        for (const m of [40, 70, 100]) { const q = { x: up.x + f.x * m / R, y: up.y + f.y * m / R, z: up.z + f.z * m / R }; const g = sim.sampler('earth')(q); if (g.liquidRadius > g.radius + 1.5) wet++; }
        if (!best || wet > best.wet) best = { wet, deg: a * 180 / Math.PI };
      }
      pc.teleport({ body: 'earth', dir: [d.x, d.y, d.z], heading: best.deg });
      return best;
    });
    c.log('swim: the sea lies ' + JSON.stringify(ok));
    if (!ok) return;
    await c.settle();
    await c.press('KeyW');
    await c.run(60, { dt: 0.1, until: (i) => i.explorer.mode === 'swim' });
    await c.run(4, { dt: 0.1 });
    await c.shot('swim-0-swimming');
    await c.press('KeyD');
    await c.film('swim-turn', { frames: 12, every: 8, dt: 1 / 30, cols: 6, tile: [320, 180] });
    await c.release('KeyD');
    await c.release('KeyW');
    await c.run(1, { dt: 0.1 });
    await c.tap('Space');
    await c.run(0.3, { dt: 1 / 30 });
    c.log('swim: after a tap of Space ' + JSON.stringify(await c.page.evaluate(() => { const i = window.__pc.info(); return { mode: i.explorer.mode, vUp: +i.explorer.vUp.toFixed(2) }; })));
    await c.press('Space');
    await c.film('swim-jet', { frames: 6, every: 8, dt: 1 / 30, cols: 6, tile: [320, 180] });
    await c.release('Space');
  },
  // PAINTER 7 and 15: the first frame after the click (the place's name), and the help card on H
  async first(c) {
    await new Promise((r) => setTimeout(r, 1500));
    await c.shot('first-0-after-click');
    await c.tap('KeyH'); await c.run(0.3, { dt: 0.1 });
    await new Promise((r) => setTimeout(r, 1200));
    await c.shot('first-1-help');
    await c.tap('KeyH'); await c.run(0.3, { dt: 0.1 });
  },
  // PAINTER 8 / PHYSICS 7: boarding from where the prompt first shows
  async board(c) {
    let i = await c.info();
    await c.drag((i.shipBearingDeg || 0) * RADm / c.MOUSE_FOOT, 0);
    await c.press('KeyW');
    await c.run(40, { dt: 0.1, until: (j) => j.canBoard, steer: async (j) => { if (j.shipBearingDeg != null && Math.abs(j.shipBearingDeg) > 4) await c.drag(j.shipBearingDeg * RADm / c.MOUSE_FOOT * 0.5, 0); } });
    await c.release('KeyW');
    await c.run(0.4, { dt: 0.1 });
    c.log('board from ' + (await c.info()).shipDistance.toFixed(1) + ' m');
    await c.tap('KeyE');
    await c.film('board', { frames: 12, every: 8, dt: 1 / 30, cols: 6, tile: [320, 180], until: (p) => p.st === 'LANDED' });
    await c.run(1, { dt: 0.1 });
  },
  // PAINTER on PILOT 3: the slips. In space: the worlds' names; aimed at Mars: its label and the ship; the pulse.
  async aim(c) {
    await c.tp({ body: 'earth', ship: true, altitude: 5000 });
    await c.run(1, { dt: 0.1 });
    await c.shot('aim-0-space');
    await c.page.evaluate(() => window.__pc.sim.setTarget('mars'));
    for (let k = 0; k < 60; k++) {
      const a = await c.page.evaluate(() => window.__pc.sim.aimAt('mars'));
      if (Math.abs(a.yawDeg) < 1.5 && Math.abs(a.pitchDeg) < 1.5) break;
      await c.drag(Math.max(-120, Math.min(120, a.yawDeg * RADm / c.MOUSE_SHIP * 0.5)), -Math.max(-80, Math.min(80, a.pitchDeg * RADm / c.MOUSE_SHIP * 0.5)));
      await c.run(0.3, { dt: 0.1 });
    }
    await c.run(1, { dt: 0.1 });
    await c.shot('aim-1-aimed');
    await c.tap('KeyF');
    await c.run(6, { dt: 0.1 });
    await c.shot('aim-2-pulse');
    c.log('aim marks ' + JSON.stringify((await c.info()).marks));
    await c.page.evaluate(() => window.__pc.sim.say('M opens the map: choose a world, point the nose at its mark, press F for the pulse drive', 8));
    await c.run(0.6, { dt: 0.1 });
    await c.shot('aim-3-long-notice');
  },
  // PAINTER on PILOT 4: a view. 30 m from Earth's first: the mark; walked up to: found and offered; E: to the easel.
  async vista(c) {
    await c.page.evaluate(() => { const sim = window.__pc.sim, d = sim.vistasOf('earth')[0].dir, k = 60 / 4000; window.__pc.teleport({ body: 'earth', dir: [d.x + k, d.y, d.z - k * 0.3] }); });
    await c.settle();
    await c.run(0.5, { dt: 0.1 });
    let n = await c.page.evaluate(() => window.__pc.sim.nearestVista());
    c.log('vista: ' + n.name + ' ' + n.distance.toFixed(0) + ' m, bearing ' + n.bearingDeg.toFixed(0));
    await c.shot('vista-0-far');
    await c.drag(n.bearingDeg * RADm / c.MOUSE_FOOT, 0);
    await c.run(0.5, { dt: 0.1 });
    await c.shot('vista-1-mark');
    await c.press('KeyW');
    await c.run(40, { dt: 0.1, until: (i) => !!i.easelOffer, steer: async () => { const m = await c.page.evaluate(() => window.__pc.sim.nearestVista()); if (m && Math.abs(m.bearingDeg) > 5) await c.drag(m.bearingDeg * RADm / c.MOUSE_FOOT * 0.6, 0); } });
    await c.release('KeyW');
    await c.run(0.6, { dt: 0.1 });
    await c.shot('vista-2-offer');
    await c.tap('KeyE');
    await c.film('vista-easel', { frames: 12, every: 10, dt: 1 / 30, cols: 6, tile: [320, 180] });
    await c.shot('vista-3-held');
    await c.run(3, { dt: 0.1 });
    await c.shot('vista-4-after');
    c.log('vista info ' + JSON.stringify(await c.page.evaluate(() => { const i = window.__pc.info(); return { easel: i.easel, offer: i.easelOffer, sk: i.sketches.keys, notice: i.notice, prompt: i.prompt }; })));
    await c.tap('KeyB'); await c.run(0.3, { dt: 0.1 });
    await c.shot('vista-5-book');
    await c.tap('ArrowRight'); await c.run(0.3, { dt: 0.1 });
    await c.shot('vista-6-book-moon');
    await c.tap('KeyB'); await c.run(0.3, { dt: 0.1 });
  },
  // PAINTER on PILOT 1: stepping out on Mars (the first step on a new world) and in Earth's wood
  async stepout_mars(c) { await landHere(c, { body: 'mars', ship: true, altitude: 30 }); await stepOut(c, 'stepout-mars'); },
  async stepout_wood(c) { await landHere(c, { body: 'earth', ship: true, altitude: 30 }); await stepOut(c, 'stepout-wood'); },
  // the page of the book for the place just stepped out on
  async book(c) {
    await c.run(4, { dt: 0.1 });
    await c.press('KeyW'); await c.run(3, { dt: 0.1 }); await c.release('KeyW');
    await c.run(1, { dt: 0.1 });
    await c.shot('book-0-slip');
    await c.tap('KeyB'); await c.run(0.3, { dt: 0.1 });
    await c.shot('book-1-open');
    await c.tap('KeyB'); await c.run(0.3, { dt: 0.1 });
  },
};
