// The spawn's weather through the game's first minutes, the clock running by itself (Node, PILOT's Sim with PHYSICS, the game's seed).
// node onset2.mjs <root> [epoch=keep] [to=1800] [every=30] [body=earth] [place=spawn]
const [root, epochS = 'keep', toS = '1800', everyS = '30', body = 'earth', place = 'spawn'] = process.argv.slice(2);
const { Sim } = await import(root + '/src/core/sim.js');
const surface = await import(root + '/src/world/surface.js');
const obstacles = await import(root + '/src/world/obstacles.js');
const P = await import(root + '/src/physics/index.js');
const W = await import(root + '/src/physics/weather.js');
const { Pad, play } = await import(root + '/tests/helpers.mjs');
const V = await import(root + '/src/core/vec.js');
if (epochS !== 'keep') W.REGIMES.earth.epoch = +epochS;
const ss = (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z);
const d = place === 'spawn' ? surface.getSurface(body).getSpawn() : surface.getStandPure(body, place).unitDir;
const physics = P.createPhysics({ sampleSurface: ss, timeBudget: false });
const sim = new Sim({ sampleSurface: ss, getSpawn: (id) => surface.getSurface(id).getSpawn(), sampleObstacles: (id, dd, r) => obstacles.sampleObstaclesPure(id, dd.x, dd.y, dd.z, r), physics, body });
const pad = new Pad(); play(sim, pad, 1, { fps: 10 });
console.log(`# ${body} ${place}, epoch ${W.REGIMES.earth.epoch}: every ${everyS} s of a new game left to itself`);
for (let t = 0; t <= +toS; t += +everyS) {
  const h = physics.here, s = h.sky || {}, i = sim.info ? sim.info() : {};
  const up = V.norm(sim.ex.p), sun = sim.sunDir ? sim.sunDir() : (physics.here.sunDir || null);
  const el = h.sun01 != null ? Math.asin(Math.max(-1, Math.min(1, h.sun01))) * 57.3 : (sun ? Math.asin(V.dot(up, sun)) * 57.3 : NaN);
  console.log(`  ${String(Math.round(sim.t)).padStart(5)} s (${(sim.t / 60).toFixed(1).padStart(4)} min) sun ${Number.isFinite(el) ? el.toFixed(0).padStart(4) : '   ?'}  ${h.weather.kind.padEnd(13)} rain ${h.weather.precipitation.rate.toFixed(1).padStart(5)} mm/h  wind ${h.air.speed.toFixed(1).padStart(5)}  cloud01 ${h.weather.cloud01.toFixed(2)} fog01 ${h.weather.fog01.toFixed(2)} wetness ${(h.ground && h.ground.wetness01 != null ? h.ground.wetness01 : NaN).toFixed(2)} | sky: overcast ${(s.overcast || 0).toFixed(2)} rain ${(s.rain || 0).toFixed(2)} wet ${(s.wet || 0).toFixed(2)} storm ${(s.storm || 0).toFixed(2)} fog ${(s.fog || 0).toFixed(2)} haze ${(s.haze || 0).toFixed(2)} cloud ${(s.cloud || 0).toFixed(2)}`);
  play(sim, pad, +everyS, { fps: 10 });
}
