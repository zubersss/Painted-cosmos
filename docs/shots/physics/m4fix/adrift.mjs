// What is adrift in the air at a place in fair weather (Node, PILOT's Sim with PHYSICS, 30 Hz, standing): leaves, spores, dust in the buffers.
// node adrift.mjs <root> <body> <place|spawn> <clock> [secs=60]
const [root, body, place, clockS, secsS = '60'] = process.argv.slice(2);
const { Sim } = await import(root + '/src/core/sim.js');
const surface = await import(root + '/src/world/surface.js');
const obstacles = await import(root + '/src/world/obstacles.js');
const P = await import(root + '/src/physics/index.js');
const { Pad, play } = await import(root + '/tests/helpers.mjs');
const ss = (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z);
const d0 = place === 'spawn' ? surface.getSurface(body).getSpawn() : surface.getStandPure(body, place).unitDir;
const physics = P.createPhysics({ sampleSurface: ss, timeBudget: false });
const sim = new Sim({ sampleSurface: ss, getSpawn: (id) => surface.getSurface(id).getSpawn(), sampleObstacles: (id, d, r) => obstacles.sampleObstaclesPure(id, d.x, d.y, d.z, r), physics, body });
sim.t = +clockS; sim.teleport({ body, dir: [d0.x, d0.y, d0.z] });
const pad = new Pad(); play(sim, pad, 10, { fps: 30 });
const B = physics.particles, kinds = ['leaves', 'spores', 'dust', 'spray'], sum = {}, max = {}, born = {}; let n = 0; const seen = {};
for (const k of kinds) { sum[k] = 0; max[k] = 0; born[k] = 0; seen[k] = new Set(); }
play(sim, pad, +secsS, { fps: 30, each: () => { n++; for (const k of kinds) { const b = B[k]; if (!b) continue; sum[k] += b.count; max[k] = Math.max(max[k], b.count); for (let i = 0; i < b.count; i++) if (b.age[i] < 1 / 29) born[k]++; } } });
console.log(`${body} ${place} clock ${clockS} (${physics.here.weather.kind}, wind ${physics.here.air.speed.toFixed(1)} m/s), ${secsS} s standing: ` + kinds.map((k) => `${k}: ${(sum[k] / n).toFixed(1)} in the air on average (most ${max[k]}), ${(born[k] / +secsS).toFixed(2)} born a second`).join('; ') + `; here.blown.leaves ${physics.here.blown ? physics.here.blown.leaves : '-'}`);
