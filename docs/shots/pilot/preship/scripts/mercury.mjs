// Mercury's spawn: Shift+W from the spawn in 8 headings on the real world, PHYSICS on; the slowest
// speed after the first second and the largest one-frame loss of speed, and the mean pace.
const ROOT = process.env.ROOT || '/home/user/painted-cosmos';
const surface = await import(ROOT + '/src/world/surface.js');
const obstacles = await import(ROOT + '/src/world/obstacles.js');
const P = await import(ROOT + '/src/physics/index.js');
const { Sim, FEEL } = await import(ROOT + '/src/core/sim.js');
const H = await import(ROOT + '/tests/helpers.mjs');
const body = process.argv[2] || 'mercury';
for (let hd = 0; hd < 360; hd += 45) {
  const physics = P.createPhysics({ sampleSurface: (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z), seed: 1 });
  if (physics.setTimeBudget) physics.setTimeBudget(false);
  const sim = new Sim({ sampleSurface: (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z), getSpawn: (id) => surface.getSurface(id).getSpawn(),
    sampleObstacles: (id, d, r) => obstacles.sampleObstaclesPure(id, d.x, d.y, d.z, r), physics });
  const pad = new H.Pad();
  sim.teleport({ body, heading: hd });
  H.play(sim, pad, 1);
  pad.press('KeyW'); pad.press('ShiftLeft');
  let slow = Infinity, drop = 0, sum = 0, n = 0, prev = null, t = 0;
  const p0 = { ...sim.ex.p };
  H.play(sim, pad, 8, { fps: 60, each: () => { t += 1 / 60; const v = sim.ex.speed; if (t > 1) { slow = Math.min(slow, v); sum += v; n++; } if (prev != null) drop = Math.max(drop, prev - v); prev = v; } });
  console.log(`${body} heading ${hd}: mean ${(sum / n).toFixed(2)} m/s, slowest after 1 s ${slow.toFixed(2)}, worst one-frame loss ${drop.toFixed(2)} m/s, ${H.len(H.sub(sim.ex.p, p0)).toFixed(1)} m in 8 s`);
}
