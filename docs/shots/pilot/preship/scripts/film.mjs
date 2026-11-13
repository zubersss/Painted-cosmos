// PILOT preship films: node film.mjs <root> <outDir> <scene> [w h]
// Scenes: pulse-behind (Earth's orbit, Saturn's mark behind the ship, F), load (load and report).
import fs from 'node:fs';
import path from 'node:path';
const [root, out, scene = 'pulse-behind', W = 640, H = 360] = process.argv.slice(2);
const { openPage } = await import('/home/user/painted-cosmos/tools/shot.mjs');
fs.mkdirSync(out, { recursive: true });
const q = '/index.html?quality=0&scale=0.5&dynres=0&fresh=1&card=0&pointerlock=0&save=0&weather=fair';
const { page, problems, close } = await openPage({ pagePath: q, w: +W, h: +H, root });
const log = (s) => { console.log(s); fs.appendFileSync(path.join(out, 'log.txt'), s + '\n'); };
const t0 = Date.now();
try {
  await page.waitForFunction('window.__pcReady === true', null, { timeout: 600000, polling: 500 });
  log(`ready after ${((Date.now() - t0) / 1000).toFixed(0)} s; fallback ${JSON.stringify(await page.evaluate(() => window.__pc.info().fallback))}; errors ${JSON.stringify(await page.evaluate(() => window.__pc.errors))}`);
  const info = () => page.evaluate(() => window.__pc.info());
  let n = 0;
  const shot = async (name) => {
    const f = path.join(out, `${String(n++).padStart(2, '0')}-${name}.jpg`);
    await page.screenshot({ path: f, type: 'jpeg', quality: 85, timeout: 300000 });
    const i = await info();
    log(`${path.basename(f)}: t ${i.t.toFixed(1)} ${i.state} prompt "${i.prompt || ''}" notice "${i.notice || ''}" turning ${JSON.stringify(i.turning)} target ${i.target ? i.target.id + ' ' + (i.target.distance / 1000).toFixed(0) + ' km' : '-'} speed ${i.ship.speed.toFixed(0)}`);
  };
  const step = (dt, k) => page.evaluate(([dt, k]) => window.__pc.step(dt, k), [dt, k]);
  if (scene === 'pulse-behind') {
    await page.evaluate(() => window.__pc.hold(true));
    await page.evaluate(() => {
      const pc = window.__pc, sim = pc.sim;
      pc.teleport({ body: 'earth', lat: 10, lon: 30, ship: true, altitude: 2400 });
    });
    await step(1 / 30, 3);
    await page.evaluate(() => {
      const sim = window.__pc.sim;
      const P = sim.bodyInShipFrame('saturn'), p = sim.sh.p;
      const t = { x: P.x - p.x, y: P.y - p.y, z: P.z - p.z }; const L = Math.hypot(t.x, t.y, t.z); t.x /= L; t.y /= L; t.z /= L;
      // the nose straight away from Saturn, level with the ecliptic
      const f = { x: -t.x, y: -t.y, z: -t.z };
      const up = { x: 0, y: 1, z: 0 };
      const r = { x: f.y * up.z - f.z * up.y, y: f.z * up.x - f.x * up.z, z: f.x * up.y - f.y * up.x };
      const rl = Math.hypot(r.x, r.y, r.z); r.x /= rl; r.y /= rl; r.z /= rl;
      const u = { x: r.y * f.z - r.z * f.y, y: r.z * f.x - r.x * f.z, z: r.x * f.y - r.y * f.x };
      // quaternion from basis (right, up, back = -f)
      const b = { x: -f.x, y: -f.y, z: -f.z };
      const m00 = r.x, m01 = u.x, m02 = b.x, m10 = r.y, m11 = u.y, m12 = b.y, m20 = r.z, m21 = u.z, m22 = b.z;
      const tr = m00 + m11 + m22; let qx, qy, qz, qw;
      if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; qw = 0.25 * s; qx = (m21 - m12) / s; qy = (m02 - m20) / s; qz = (m10 - m01) / s; }
      else if (m00 > m11 && m00 > m22) { const s = Math.sqrt(1 + m00 - m11 - m22) * 2; qw = (m21 - m12) / s; qx = 0.25 * s; qy = (m01 + m10) / s; qz = (m02 + m20) / s; }
      else if (m11 > m22) { const s = Math.sqrt(1 + m11 - m00 - m22) * 2; qw = (m02 - m20) / s; qx = (m01 + m10) / s; qy = 0.25 * s; qz = (m12 + m21) / s; }
      else { const s = Math.sqrt(1 + m22 - m00 - m11) * 2; qw = (m10 - m01) / s; qx = (m02 + m20) / s; qy = (m12 + m21) / s; qz = 0.25 * s; }
      sim.sh.q = { x: qx, y: qy, z: qz, w: qw };
      sim.sh.v = { x: 0, y: 0, z: 0 };
      sim.setTarget('saturn');
    });
    await step(1 / 30, 45);
    await page.evaluate(() => window.__pc.settle(4));
    await shot('mark-behind');
    await page.keyboard.press('KeyF');
    for (let k = 0; k < 7; k++) { await step(1 / 30, k === 0 ? 8 : 18); await shot('turn-' + k); }
    let i = await info();
    for (let k = 0; k < 40 && i.state !== 'PULSE'; k++) { await step(1 / 30, 15); i = await info(); }
    await shot('pulse-begins');
    for (let k = 0; k < 3; k++) { await step(1 / 30, 300); await shot('pulse-' + k); }
    for (let k = 0; k < 400 && (await info()).state === 'PULSE'; k++) await step(1 / 30, 30);
    await step(1 / 30, 15);
    await shot('arrived');
  }
  if (scene === 'foot' || scene === 'arrow') {
    // The way back to the ship: from the spawn, walk away from the ship (W held, real keys), then
    // turn round to it; then the HUD in Earth's orbit at this size (the turn's notice over the
    // prompt), and the frame read-out with a notice on foot.
    await page.evaluate(() => window.__pc.hold(true));
    const i0 = await info();
    log(`spawn: ship ${i0.shipDistance.toFixed(1)} m, bearing ${i0.shipBearingDeg.toFixed(0)}`);
    // face away from the ship: drag the view by (bearing + 180) degrees
    const turnBy = async (deg) => {
      const px = (deg * Math.PI / 180) / 0.0023;
      await page.mouse.move(+W / 2, +H / 2); await page.mouse.down();
      const n = Math.max(1, Math.ceil(Math.abs(px) / 120));
      for (let k = 1; k <= n; k++) { await page.mouse.move(+W / 2 + (px * k) / n, +H / 2); await step(1 / 30, 1); }
      await page.mouse.up(); await step(1 / 30, 1);
      await page.mouse.move(+W / 2, +H / 2);
    };
    const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
    // (drags must not wrap round the window: in pieces of up to 120 px from the middle)
    const turnTo = async (deg) => { let left = deg; while (Math.abs(left) > 1) { const d = Math.max(-15, Math.min(15, left)); const b0 = (await info()).shipBearingDeg; await turnBy(d); const b1 = (await info()).shipBearingDeg; left -= wrap(b0 - b1); } };
    await turnTo(wrap(i0.shipBearingDeg + 180));
    await step(1 / 30, 10);
    await shot('facing-away-near');
    await page.keyboard.down('KeyW');
    for (let k = 0; k < 14; k++) await step(1 / 30, 30);
    await page.keyboard.up('KeyW');
    await step(1 / 30, 30);
    await shot('walked-away');
    if (scene === 'arrow') {
      await page.keyboard.press('KeyV'); await step(1 / 30, 15); await shot('walked-away-first-person');
      await page.keyboard.press('KeyV'); await step(1 / 30, 15);
      // a new page's slip and a notice on foot together
      await page.evaluate(() => { const g = window.__pc.game; const c = document.createElement('canvas'); c.width = 160; c.height = 90; const x = c.getContext('2d'); x.fillStyle = '#c9b48a'; x.fillRect(0, 0, 160, 90); g.hud.showSketch(c.toDataURL(), 'Temperate Forest', 'Earth  page 1 of 114', 30); window.__pc.sim.say('A view to find 3.0 km to the right: fly nearer, or walk', 30); });
      await step(1 / 30, 10);
      await new Promise((r) => setTimeout(r, 1500));
      await shot('sketch-slip-and-notice');
    }
    const i1 = scene === 'arrow' ? null : await info();
    if (scene !== 'arrow') {
    await turnTo(wrap(i1.shipBearingDeg - 60));
    await step(1 / 30, 15);
    await shot('ship-off-to-the-side');
    const i2 = await info();
    await turnTo(i2.shipBearingDeg);
    await step(1 / 30, 15);
    await shot('facing-the-ship');
    // stats on, a notice on foot
    await page.keyboard.press('Backquote');
    await page.evaluate(() => window.__pc.sim.say('A notice on foot, lettered at the top of the sheet', 30));
    await step(1 / 30, 10);
    await shot('stats-and-notice');
    await page.keyboard.press('Backquote');
    // Earth's orbit: the turn onto a course (notice and prompt together)
    await page.evaluate(() => { window.__pc.teleport({ body: 'earth', lat: 10, lon: 30, ship: true, altitude: 2400 }); });
    await step(1 / 30, 5);
    await page.evaluate(() => { const sim = window.__pc.sim; sim.setTarget('saturn'); const P = sim.bodyInShipFrame('saturn'), p = sim.sh.p; const t = { x: p.x - P.x, y: p.y - P.y, z: p.z - P.z }; const L = Math.hypot(t.x, t.y, t.z); const f = { x: t.x / L, y: t.y / L, z: t.z / L }; const yaw = Math.atan2(-f.x, -f.z), pitch = Math.asin(f.y); const cy = Math.cos(yaw / 2), sy = Math.sin(yaw / 2), cp = Math.cos(pitch / 2), sp = Math.sin(pitch / 2); sim.sh.q = { x: cy * sp, y: sy * cp, z: -sy * sp, w: cy * cp }; sim.sh.v = { x: 0, y: 0, z: 0 }; });
    await step(1 / 30, 20);
    await page.keyboard.press('KeyF');
    await step(1 / 30, 40);
    await shot('turn-notice-and-prompt');
    }
  }
  log('problems: ' + JSON.stringify(problems) + ' game errors: ' + JSON.stringify(await page.evaluate(() => window.__pc.errors)) + ' fallback: ' + JSON.stringify(await page.evaluate(() => window.__pc.info().fallback)));
} catch (e) { log('FAILED ' + e.message); }
await close();
log(`done in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
