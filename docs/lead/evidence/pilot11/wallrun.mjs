// Running up walls (Node, Sim with PHYSICS, 30 Hz): Shift+W 12 s from a stand in eight headings; the
// steepest ground stood on (deg), the fastest climb held over a second while grounded (m/s up), and the
// height gained on ground steeper than 50 degrees. node wallrun.mjs <root> <body> <place|spawn>
const [root, body, place] = process.argv.slice(2);
const { Sim } = await import(root + '/src/core/sim.js');
const surface = await import(root + '/src/world/surface.js');
const obstacles = await import(root + '/src/world/obstacles.js');
const P = await import(root + '/src/physics/index.js');
const { Pad, play } = await import(root + '/tests/helpers.mjs');
const V = await import(root + '/src/core/vec.js');
const ss = (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z);
const out = [];
for (let h = 0; h < 360; h += 45) {
  const physics = P.createPhysics({ sampleSurface: ss, seed: 1 });
  const sim = new Sim({ sampleSurface: ss, getSpawn: (id) => surface.getSurface(id).getSpawn(), sampleObstacles: (id, d, r) => obstacles.sampleObstaclesPure(id, d.x, d.y, d.z, r), physics, body });
  sim.t = 30;
  const d = place === 'spawn' ? null : surface.getStandPure(body, place).unitDir;
  sim.teleport(d ? { body, dir: [d.x, d.y, d.z], heading: h, hour: 11 } : { body, heading: h, hour: 11 });
  const pad = new Pad(); play(sim, pad, 1, { fps: 30 }); pad.press('KeyW'); pad.press('ShiftLeft');
  const rs = [], gs = [], sl = []; let steepGain = 0, prevR = null;
  play(sim, pad, 12, { fps: 30, each: () => {
    const r = V.len(sim.ex.p), g = ss(body, V.norm(sim.ex.p)); rs.push(r); gs.push(sim.ex.grounded); sl.push(g.slope * 57.3);
    if (prevR != null && sim.ex.grounded && g.slope * 57.3 > 50 && r > prevR) steepGain += r - prevR; prevR = r;
  } });
  let best = 0, at = 0; for (let i = 30; i < rs.length; i++) { let ok = true; for (let j = i - 30; j <= i; j++) if (!gs[j]) { ok = false; break; } if (ok && rs[i] - rs[i - 30] > best) { best = rs[i] - rs[i - 30]; at = sl[i]; } }
  out.push(`h${h}: steepest ${Math.max(...sl).toFixed(0)}, climb ${best.toFixed(1)} m/s (on ${at.toFixed(0)} deg), up ${steepGain.toFixed(1)} m on >50 deg`);
}
console.log(body, place, '|', out.join(' | '));
