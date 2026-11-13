// Every stand and spawn of every body (Node, PILOT's Sim with PHYSICS, 30 Hz): Shift+W 12 s from the stand in eight headings.
// Per place: the height gained on ground steeper than 50 degrees (worst heading and sum), the mean pace, the slowest second,
// seconds under 3 m/s, the highest the feet get over the ground, the most the body rises after leaving the ground
// (thrown), steps at a wall (phys.wall), NaN. node survey.mjs <root> [body ...]
const [root, ...only] = process.argv.slice(2);
const { Sim } = await import(root + '/src/core/sim.js');
const surface = await import(root + '/src/world/surface.js');
const obstacles = await import(root + '/src/world/obstacles.js');
const P = await import(root + '/src/physics/index.js');
const { BIOMES } = await import(root + '/src/physics/ground.js');
const { Pad, play } = await import(root + '/tests/helpers.mjs');
const V = await import(root + '/src/core/vec.js');
const ss = (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z);
const bodies = ['mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'].filter((b) => !only.length || only.includes(b));
for (const body of bodies) {
  const places = ['spawn'];
  for (const id of Object.keys(BIOMES)) { try { const st = surface.getStandPure(body, id); if (st && st.unitDir) places.push(id); } catch (e) {} }
  for (const place of places) {
    const o = { steepWorst: 0, steepSum: 0, mean: 0, slowest: 1e9, under3: 0, feet: 0, thrown: 0, wall: 0, nan: 0, top: 0 };
    for (let h = 0; h < 360; h += 45) {
      const physics = P.createPhysics({ sampleSurface: ss, seed: 1 });
      const sim = new Sim({ sampleSurface: ss, getSpawn: (id) => surface.getSurface(id).getSpawn(), sampleObstacles: (id, d, r) => obstacles.sampleObstaclesPure(id, d.x, d.y, d.z, r), physics, body });
      sim.t = 30;
      const d = place === 'spawn' ? null : surface.getStandPure(body, place).unitDir;
      sim.teleport(d ? { body, dir: [d.x, d.y, d.z], heading: h, hour: 11 } : { body, heading: h, hour: 11 });
      const pad = new Pad(); play(sim, pad, 1, { fps: 30 }); pad.press('KeyW'); pad.press('ShiftLeft');
      const r00 = V.len(sim.ex.p);
      const vs = []; let steep = 0, prevR = null, rel = 0, was = true;
      play(sim, pad, 12, { fps: 30, each: () => {
        const up = V.norm(sim.ex.p), v = sim.ex.v, vu = V.dot(v, up), r = V.len(sim.ex.p), g = ss(body, up);
        const hv = Math.hypot(v.x - up.x * vu, v.y - up.y * vu, v.z - up.z * vu); vs.push(hv);
        if (!Number.isFinite(r + hv)) o.nan++;
        if (prevR != null && sim.ex.grounded && g.slope * 57.3 > 50 && r > prevR) steep += r - prevR; prevR = r;
        o.feet = Math.max(o.feet, r - Math.max(g.radius, g.liquidRadius || 0)); o.top = Math.max(o.top, r - r00);
        if (!sim.ex.grounded) { if (was) rel = r; o.thrown = Math.max(o.thrown, r - rel); }
        was = sim.ex.grounded;
        if (sim.ex.phys && sim.ex.phys.wall) o.wall++;
        if (vs.length > 60 && hv < 3) o.under3++;
      } });
      const run = vs.slice(60); o.mean += run.reduce((a, b) => a + b, 0) / run.length / 8;
      for (let i = 0; i + 30 <= run.length; i++) o.slowest = Math.min(o.slowest, run.slice(i, i + 30).reduce((a, b) => a + b, 0) / 30);
      o.steepWorst = Math.max(o.steepWorst, steep); o.steepSum += steep;
    }
    console.log(`${body} ${place}: steep ${o.steepWorst.toFixed(1)} (sum ${o.steepSum.toFixed(1)}) top ${o.top.toFixed(1)} mean ${o.mean.toFixed(2)} slowest ${o.slowest.toFixed(2)} under3 ${(o.under3 / 30).toFixed(1)} feet ${o.feet.toFixed(2)} thrown ${o.thrown.toFixed(2)} wall ${o.wall} nan ${o.nan}`);
  }
}
