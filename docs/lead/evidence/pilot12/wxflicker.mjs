// How often the weather's name changes at a place (Node, PHYSICS with the game's seed): every `step` seconds of the
// game clock for `to` seconds: the kinds in order with how long each lasted, the number of changes, the wind's range
// while the kind was 'mist' or 'fog'. node wxflicker.mjs <root> <body> <place|spawn> <to> <step>
const [root, body, place, to, step] = process.argv.slice(2);
const { Sim } = await import(root + '/src/core/sim.js');
const surface = await import(root + '/src/world/surface.js');
const obstacles = await import(root + '/src/world/obstacles.js');
const P = await import(root + '/src/physics/index.js');
const { Pad, play } = await import(root + '/tests/helpers.mjs');
const ss = (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z);
const d = place === 'spawn' ? surface.getSurface(body).getSpawn() : surface.getStandPure(body, place).unitDir;
const physics = P.createPhysics({ sampleSurface: ss });
const sim = new Sim({ sampleSurface: ss, getSpawn: (id) => surface.getSurface(id).getSpawn(), sampleObstacles: (id, dd, r) => obstacles.sampleObstaclesPure(id, dd.x, dd.y, dd.z, r), physics, body });
sim.t = 0; sim.teleport({ body, dir: [d.x, d.y, d.z] });
const pad = new Pad(); const runs = []; let mistLo = 1e9, mistHi = 0, windLo = 1e9, windHi = 0; const fps = 1 / +step;
// the clock runs on by itself (no jumps): what a player standing there lives through
const N = Math.round(+to / +step);
for (let i = 0; i < N; i++) {
  play(sim, pad, +step, { fps: 10 });
  const h = physics.here, k = h.weather.kind, w = h.air.speed;
  windLo = Math.min(windLo, w); windHi = Math.max(windHi, w);
  if (k === 'mist' || k === 'fog') { mistLo = Math.min(mistLo, w); mistHi = Math.max(mistHi, w); }
  if (!runs.length || runs[runs.length - 1].k !== k) runs.push({ k, n: 1, t: sim.t }); else runs[runs.length - 1].n++;
}
console.log(`# ${body} ${place}, ${to} s standing there: ${runs.length - 1} changes of the weather's name (one every ${(+to / Math.max(1, runs.length - 1)).toFixed(0)} s); wind ${windLo.toFixed(0)} .. ${windHi.toFixed(0)} m/s${mistHi ? '; while it was called mist or fog the wind was ' + mistLo.toFixed(0) + ' .. ' + mistHi.toFixed(0) + ' m/s' : ''}`);
console.log('  ' + runs.map((r) => `${r.k} ${(r.n * +step).toFixed(0)} s`).join(', '));
