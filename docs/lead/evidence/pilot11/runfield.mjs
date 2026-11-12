// A run across rough ground as a player does it (Node, PILOT's Sim with PHYSICS, 30 Hz): Shift+W
// for 12 s from a stand in eight headings: mean pace, the slowest second, seconds under 3 m/s,
// the highest the feet get over the ground, and how far it got.
// node runfield.mjs <root> <body> <place|spawn> [secs=12]
const [root, body = 'moon', place = 'crater_fields', secs = '12'] = process.argv.slice(2);
const { Sim, FEEL } = await import(root + '/src/core/sim.js');
const surface = await import(root + '/src/world/surface.js');
const obstacles = await import(root + '/src/world/obstacles.js');
const P = await import(root + '/src/physics/index.js');
const { Pad, play } = await import(root + '/tests/helpers.mjs');
const V = await import(root + '/src/core/vec.js');
const ss = (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z);
const rows = [];
for (let h = 0; h < 360; h += 45) {
  const physics = P.createPhysics({ sampleSurface: ss, seed: 1 });
  const sim = new Sim({ sampleSurface: ss, getSpawn: (id) => surface.getSurface(id).getSpawn(), sampleObstacles: (id, d, r) => obstacles.sampleObstaclesPure(id, d.x, d.y, d.z, r), physics, body });
  sim.t = 30;
  const d = place === 'spawn' ? null : surface.getStandPure(body, place).unitDir;
  sim.teleport(d ? { body, dir: [d.x, d.y, d.z], heading: h, hour: 11 } : { body, heading: h, hour: 11 });
  const pad = new Pad(); play(sim, pad, 1, { fps: 30 });
  const p0 = { ...sim.ex.p }; pad.press('KeyW'); pad.press('ShiftLeft');
  const vs = []; let feet = 0, slow = 0;
  play(sim, pad, +secs, { fps: 30, each: () => {
    const up = V.norm(sim.ex.p), v = sim.ex.v, vu = V.dot(v, up);
    const hv = Math.hypot(v.x - up.x * vu, v.y - up.y * vu, v.z - up.z * vu); vs.push(hv);
    const g = ss(body, up); feet = Math.max(feet, V.len(sim.ex.p) - Math.max(g.radius, g.liquidRadius || 0));
    if (vs.length > 60 && hv < 3) slow++;
  } });
  const run = vs.slice(60), mean = run.reduce((a, b) => a + b, 0) / run.length;
  let worst = 1e9; for (let i = 0; i + 30 <= run.length; i++) worst = Math.min(worst, run.slice(i, i + 30).reduce((a, b) => a + b, 0) / 30);
  rows.push({ h, mean: +mean.toFixed(2), slowestSecond: +worst.toFixed(2), secsUnder3: +(slow / 30).toFixed(1), feetUp: +feet.toFixed(2), metres: +V.len(V.sub(sim.ex.p, p0)).toFixed(1) });
}
console.log(body, place, JSON.stringify(rows));
const m = rows.reduce((a, r) => a + r.mean, 0) / rows.length;
console.log(`  mean of headings ${m.toFixed(2)} m/s; slowest second ${Math.min(...rows.map((r) => r.slowestSecond)).toFixed(2)} m/s; seconds under 3 m/s (after the first 2 s) ${rows.reduce((a, r) => a + r.secsUnder3, 0).toFixed(1)} of ${rows.length * (+secs - 2)}`);
