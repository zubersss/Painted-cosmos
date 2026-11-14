// The first storm's arrival at Earth's spawn, every 5 s of the game clock running by itself (Node, PHYSICS, the game's seed):
// the weather's name, the rain, the wind at the walker, and the sky numbers PAINTER is handed (overcast, rain, wet, storm, fog).
const [root, from = '100', to = '420', body = 'earth', place = 'spawn'] = process.argv.slice(2);
const { Sim } = await import(root + '/src/core/sim.js');
const surface = await import(root + '/src/world/surface.js');
const obstacles = await import(root + '/src/world/obstacles.js');
const P = await import(root + '/src/physics/index.js');
const { Pad, play } = await import(root + '/tests/helpers.mjs');
const ss = (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z);
const d = place === 'spawn' ? surface.getSurface(body).getSpawn() : surface.getStandPure(body, place).unitDir;
const physics = P.createPhysics({ sampleSurface: ss });
const sim = new Sim({ sampleSurface: ss, getSpawn: (id) => surface.getSurface(id).getSpawn(), sampleObstacles: (id, dd, r) => obstacles.sampleObstaclesPure(id, dd.x, dd.y, dd.z, r), physics, body });
sim.t = +from - 20; sim.teleport({ body, dir: [d.x, d.y, d.z] }); const pad = new Pad(); play(sim, pad, 20, { fps: 10 });
for (let t = +from; t <= +to; t += 10) {
  const h = physics.here, s = h.sky || {};
  console.log(`  ${String(Math.round(sim.t)).padStart(4)} s  ${h.weather.kind.padEnd(13)} rain ${h.weather.precipitation.rate.toFixed(1).padStart(5)} mm/h  wind ${h.air.speed.toFixed(1).padStart(5)} m/s  overcast ${(s.overcast || 0).toFixed(2)} rain ${(s.rain || 0).toFixed(2)} wet ${(s.wet || 0).toFixed(2)} storm ${(s.storm || 0).toFixed(2)} fog ${(s.fog || 0).toFixed(2)} haze ${(s.haze || 0).toFixed(2)} cloud ${(s.cloud || 0).toFixed(2)}`);
  play(sim, pad, 10, { fps: 10 });
}
