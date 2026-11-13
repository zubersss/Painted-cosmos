// The foot camera in Mars' rust canyons, on the real surface and obstacles: find spots at the foot of a
// steep wall, stand there facing the wall, run into it, and measure what the third-person view does.
// Usage: node canyon.mjs <tree root> [n spots]
import path from 'node:path';
const root = process.argv[2], N = +(process.argv[3] || 6);
const surface = await import(path.join(root, 'src/world/surface.js'));
const obstacles = await import(path.join(root, 'src/world/obstacles.js'));
const { Sim } = await import(path.join(root, 'src/core/sim.js'));
const { Pad, play } = await import(path.join(root, 'tests/helpers.mjs'));
const { BODIES } = await import(path.join(root, 'src/data/bodies.js'));
const R = BODIES.mars.radius;
const S = (d) => surface.sampleSurfacePure('mars', d.x, d.y, d.z);
const nrm = (v) => { const l = Math.hypot(v.x, v.y, v.z); return { x: v.x / l, y: v.y / l, z: v.z / l }; };
const st = surface.getStandPure('mars', 'rust_canyons');
const c = nrm(st.unitDir);
const east = nrm({ x: c.z, y: 0, z: -c.x }), north = { x: c.y * east.z - c.z * east.y, y: c.z * east.x - c.x * east.z, z: c.x * east.y - c.y * east.x };
const at = (e, n) => nrm({ x: c.x + (east.x * e + north.x * n) / R, y: c.y + (east.y * e + north.y * n) / R, z: c.z + (east.z * e + north.z * n) / R });
// spots: floor points with a wall rising > 10 m within 8 m
const spots = [];
for (let e = -1500; e <= 1500 && spots.length < 400; e += 24) for (let n = -1500; n <= 1500; n += 24) {
  const d = at(e, n), g = S(d);
  if (g.biomeId !== 'rust_canyons' || g.liquidRadius > g.radius) continue;
  let best = 0, bh = 0;
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, g2 = S(at(e + 8 * Math.cos(a), n + 8 * Math.sin(a))); const rise = g2.radius - g.radius; if (rise > best) { best = rise; bh = a; } }
  if (best > 10 && g.slope < 0.3) spots.push({ e, n, rise: best, a: bh });
}
console.log('spots at the foot of a wall rising > 10 m in 8 m:', spots.length);
const pick = spots.sort((a, b) => b.rise - a.rise).filter((_, i) => i % Math.max(1, Math.floor(spots.length / N)) === 0).slice(0, N);
for (const sp of pick) {
  for (const face of ['wall', 'away']) {
    const sim = new Sim({ sampleSurface: (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z), getSpawn: (id) => surface.getSurface(id).getSpawn(), sampleObstacles: (id, d, r) => obstacles.sampleObstaclesPure(id, d.x, d.y, d.z, r) });
    const pad = new Pad();
    const d = at(sp.e, sp.n);
    // heading: degrees from north toward east
    const hd = (90 - sp.a * 180 / Math.PI) + (face === 'away' ? 180 : 0);
    sim.teleport({ body: 'mars', dir: [d.x, d.y, d.z], heading: hd, hour: 12 });
    play(sim, pad, 1);
    pad.press('ShiftLeft'); pad.press('KeyW');
    let worst = 0, down60 = 0, n = 0, minClear = 1e9, eyeFrac = 0;
    play(sim, pad, 10, { each: () => {
      const P = sim.camPose; if (!P) return;
      const up = nrm(sim.ex.p);
      const fwd = { x: 0, y: 0, z: -1 }; // camera looks down -z in its own frame
      const q = P.q; // rotate (0,0,-1) by q
      const x = q.x, y = q.y, z = q.z, w = q.w;
      const dir = { x: -(2 * (x * z + w * y)), y: -(2 * (y * z - w * x)), z: -(1 - 2 * (x * x + y * y)) };
      const pitch = Math.asin(Math.max(-1, Math.min(1, dir.x * up.x + dir.y * up.y + dir.z * up.z))) * 180 / Math.PI;
      n++; if (pitch < worst) worst = pitch; if (pitch < -60) down60++;
      const cl = sim.info().cameraClearance; if (cl != null) minClear = Math.min(minClear, cl);
      if ((sim.footCam.tight01 || 0) > 0.5) eyeFrac++;
    } });
    pad.releaseAll();
    console.log(`(${sp.e},${sp.n}) rise ${sp.rise.toFixed(0)} m facing ${face}: camera pitch worst ${worst.toFixed(0)} deg, under -60 deg ${(100 * down60 / n).toFixed(0)} % of 10 s, lift ${sim.footCam.lift.toFixed(1)} m boom ${sim.footCam.boomNow.toFixed(1)} m, min clearance ${minClear.toFixed(2)}, in the eyes ${(100 * eyeFrac / n).toFixed(0)} %`);
  }
}
