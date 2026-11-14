// The jetpack held from a stand until the fuel runs out (Node, Sim with PHYSICS, 60 Hz): seconds, height, fuel left.
const [root] = process.argv.slice(2);
const { Sim } = await import(root + '/src/core/sim.js');
const surface = await import(root + '/src/world/surface.js');
const obstacles = await import(root + '/src/world/obstacles.js');
const P = await import(root + '/src/physics/index.js');
const { Pad, play } = await import(root + '/tests/helpers.mjs');
const V = await import(root + '/src/core/vec.js');
const ss = (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z);
for (const body of ['earth', 'moon', 'mars', 'pluto', 'jupiter', 'mercury']) {
  const physics = P.createPhysics({ sampleSurface: ss, seed: 1 });
  const sim = new Sim({ sampleSurface: ss, getSpawn: (id) => surface.getSurface(id).getSpawn(), sampleObstacles: (id, d, r) => obstacles.sampleObstaclesPure(id, d.x, d.y, d.z, r), physics, body });
  sim.t = 30; sim.teleport({ body, hour: 11 }); const pad = new Pad(); play(sim, pad, 1.5);
  const r0 = V.len(sim.ex.p); pad.press('Space'); let top = 0, tEmpty = null, f = [];
  play(sim, pad, 40, { each: (t) => { top = Math.max(top, V.len(sim.ex.p) - r0); if (tEmpty == null && sim.ex.fuel <= 0.01) tEmpty = t; if (Math.abs(t % 5) < 1 / 60) f.push(sim.ex.fuel.toFixed(2)); } });
  pad.release('Space'); let tDown = 0; play(sim, pad, 60, { each: (t) => { tDown = t; }, until: () => sim.ex.grounded });
  console.log(body.padEnd(8), 'held 40 s: top', top.toFixed(0), 'm, empty at', tEmpty == null ? 'never' : tEmpty.toFixed(1) + ' s', 'fuel every 5 s', f.join(' '), '; down again in', tDown.toFixed(1), 's');
}
