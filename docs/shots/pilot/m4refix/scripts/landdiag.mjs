// film2's liftoff + landfast replayed without drawing, logging the landing camera among the crowns (the cameras' crown model)
const RADm = Math.PI / 180;
export default {
  async landdiag(c) {
    await c.page.evaluate(() => window.__pc.setClock(14.8));
    await c.toShipAndBoard();
    await c.tap('Space');
    await c.page.evaluate(() => { const pc = window.__pc, r = pc.game.painter.render; pc.game.painter.render = () => {}; for (let k = 0; k < 300; k++) pc.step(1 / 30, 1); pc.game.painter.render = r; });
    await c.press('KeyW');
    await c.run(9, { dt: 0.1, steer: c.holdPitch(0) });
    await c.release('KeyW');
    c.log('before E ' + JSON.stringify(await c.page.evaluate(c.PROBE)));
    await c.tap('KeyE');
    const rows = await c.page.evaluate(() => {
      const pc = window.__pc, sim = pc.sim, r = pc.game.painter.render, out = [];
      const V = (x, y, z) => ({ x, y, z }), add = (a, b) => V(a.x + b.x, a.y + b.y, a.z + b.z), sc = (a, s) => V(a.x * s, a.y * s, a.z * s), sub = (a, b) => V(a.x - b.x, a.y - b.y, a.z - b.z), len = (a) => Math.hypot(a.x, a.y, a.z), nrm = (a) => sc(a, 1 / len(a));
      const rot = (q, v) => { const ix = q.w * v.x + q.y * v.z - q.z * v.y, iy = q.w * v.y + q.z * v.x - q.x * v.z, iz = q.w * v.z + q.x * v.y - q.y * v.x, iw = -q.x * v.x - q.y * v.y - q.z * v.z; return V(ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y, iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z, iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x); };
      const cross = (a, b) => V(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
      pc.game.painter.render = () => {};
      try {
        for (let k = 0; k < 1500 && sim.sm.state !== 'LANDED'; k++) {
          pc.step(1 / 30, 1);
          if (k % 15) continue;
          const solid = sim.crownSolid(), pose = sim.camPose;
          if (!solid || !pose) { out.push({ t: +sim.t.toFixed(2), none: true, hAG: +sim.sh.altGround.toFixed(1) }); continue; }
          const p = pose.p, dir = rot(pose.q, V(0, 0, -1)), up = rot(pose.q, V(0, 1, 0)), right = cross(dir, up);
          const dShip = len(sub(sim.sh.p, p)), th = Math.tan(pose.fov * Math.PI / 360), tw = th * 16 / 9;
          let near = 0, mid = 0, far = 0, tot = 0, left = 0;
          for (let j = 0; j < 12; j++) for (let i = 0; i < 20; i++) {
            const x = ((i + 0.5) / 20 * 2 - 1) * tw, y = ((j + 0.5) / 12 * 2 - 1) * th, rr = nrm(add(add(dir, sc(right, x)), sc(up, y)));
            let s = 0.2, got = -1;
            for (let n = 0; n < 60 && s < dShip; n++) { const d = solid(add(p, sc(rr, s))); if (d < 0.05) { got = s; break; } s += Math.max(0.15, d); }
            tot++; if (got >= 0) { if (got < 3.6) near++; else if (got < 8) mid++; else far++; if (i < 10) left++; }
          }
          out.push({ t: +sim.t.toFixed(2), st: sim.sm.state, hAG: +sim.sh.altGround.toFixed(1), boom: +len(sub(p, sim.sh.p)).toFixed(2), lensCrown: +solid(p).toFixed(2), near: Math.round(100 * near / tot), mid: Math.round(100 * mid / tot), far: Math.round(100 * far / tot), leftHalf: Math.round(100 * left / tot), room: sim.shipCam.room && +sim.shipCam.room.toFixed(2) });
        }
      } finally { pc.game.painter.render = r; }
      return out;
    });
    for (const r of rows) c.log('land ' + JSON.stringify(r));
  },
};
