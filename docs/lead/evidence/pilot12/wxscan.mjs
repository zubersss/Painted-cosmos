// The weather at a stand over the game clock (Node): node wxscan.mjs <root> <body> <place|spawn> [to=6000] [step=30]
const [root, body, place, to = '6000', step = '30'] = process.argv.slice(2);
const { Sim } = await import(root + '/src/core/sim.js');
const surface = await import(root + '/src/world/surface.js');
const obstacles = await import(root + '/src/world/obstacles.js');
const P = await import(root + '/src/physics/index.js');
const { Pad, play } = await import(root + '/tests/helpers.mjs');
const ss = (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z);
const d = place === 'spawn' ? surface.getSurface(body).getSpawn() : surface.getStandPure(body, place).unitDir;
const physics = P.createPhysics({ sampleSurface: ss });
const sim = new Sim({ sampleSurface: ss, getSpawn: (id) => surface.getSurface(id).getSpawn(), sampleObstacles: (id, dd, r) => obstacles.sampleObstaclesPure(id, dd.x, dd.y, dd.z, r), physics, body });
const pad = new Pad(); let last = '', rows = [];
for (let t = 0; t <= +to; t += +step) {
  sim.t = t; sim.teleport({ body, dir: [d.x, d.y, d.z] }); play(sim, pad, 0.2, { fps: 30 });
  const h = physics.here, w = {}; physics.water(body, sim.ex.p, w);
  const k = `${h.weather.kind}`;
  rows.push({ t, kind: k, i: h.weather.intensity01, wind: h.air.speed, gust: h.air.gust01, rain: h.weather.precipitation.rate, hs: w.present ? w.significant : 0 });
}
// print runs of the same kind, with the peak wind and rain in each
let i = 0;
while (i < rows.length) {
  let j = i; while (j + 1 < rows.length && rows[j + 1].kind === rows[i].kind) j++;
  const seg = rows.slice(i, j + 1), pk = seg.reduce((a, b) => (b.wind > a.wind ? b : a));
  console.log(`${String(rows[i].t).padStart(5)}..${String(rows[j].t).padEnd(5)} ${rows[i].kind.padEnd(14)} peak wind ${pk.wind.toFixed(1)} m/s at ${pk.t}, peak rain ${Math.max(...seg.map((r) => r.rain)).toFixed(1)}, peak Hs ${Math.max(...seg.map((r) => r.hs)).toFixed(2)} m`);
  i = j + 1;
}
