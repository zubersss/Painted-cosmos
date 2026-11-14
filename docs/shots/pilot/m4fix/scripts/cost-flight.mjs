// ms per simulation step of low flight over Earth's wood (PILOT's Sim in Node, the real world and obstacles, no PHYSICS update cost excluded)
const R = process.env.ROOT;
const { Sim } = await import(R + '/src/core/sim.js');
const { Pad, play } = await import(R + '/tests/helpers.mjs');
const surface = await import(R + '/src/world/surface.js');
const obstacles = await import(R + '/src/world/obstacles.js');
const { createPhysics } = await import(R + '/src/physics/index.js');
const ss = (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z);
const obs = (id, d, r) => obstacles.sampleObstaclesPure(id, d.x, d.y, d.z, r);
for (const body of ['earth', 'mars']) {
  const physics = createPhysics({ sampleSurface: ss, timeBudget: false });
  const sim = new Sim({ sampleSurface: ss, getSpawn: (id) => surface.getSurface(id).getSpawn(), sampleObstacles: obs, physics, body });
  const pad = new Pad();
  sim.teleport({ body, ship: true, altitude: 30 }); play(sim, pad, 0.5); pad.press('KeyW'); pad.press('KeyC'); play(sim, pad, 5);
  // time only sim.step (flight), not physics.update
  const up0 = sim.updatePhysics; let phys = 0; sim.updatePhysics = function (dt) { const t = performance.now(); up0.call(this, dt); phys += performance.now() - t; };
  const t0 = performance.now(); const n = 60 * 30; play(sim, pad, 30);
  const all = performance.now() - t0;
  console.log(body, 'ms per step: flight and the rest', ((all - phys) / n).toFixed(3), ' physics.update', (phys / n).toFixed(3));
}
