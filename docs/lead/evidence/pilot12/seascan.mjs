// The sea a swimmer is in, over the game clock (Node, Sim with PHYSICS, the game's weather seed): a point `off`
// metres out from a coast stand along the bearing of its nearest deep water; at each clock the explorer is put
// there, the game runs 3 s, and PHYSICS' own sea state at the swimmer is read (significant height, period,
// whitecaps), with the wind. node seascan.mjs <root> <body> <place> <off> <from> <to> <step>
const [root, body, place, offS, from, to, step] = process.argv.slice(2);
const { Sim } = await import(root + '/src/core/sim.js');
const surface = await import(root + '/src/world/surface.js');
const obstacles = await import(root + '/src/world/obstacles.js');
const P = await import(root + '/src/physics/index.js');
const { Pad, play } = await import(root + '/tests/helpers.mjs');
const V = await import(root + '/src/core/vec.js');
const ss = (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z);
const st = surface.getStandPure(body, place).unitDir, R0 = ss(body, st).radius;
const up = V.norm(st), east = V.norm(V.cross({ x: 0, y: 1, z: 0 }, up)), north = V.cross(up, east);
let water = null;
for (let r = 6; r <= 300 && !water; r += 3) for (let a = 0; a < 360; a += 15) {
  const c = Math.cos(a * Math.PI / 180), s = Math.sin(a * Math.PI / 180);
  const d = V.norm(V.add(up, V.scale(V.add(V.scale(north, c), V.scale(east, s)), r / R0)));
  const q = ss(body, d); if (q.isLiquid && q.liquidRadius - q.radius > 2) { water = { a, r }; break; }
}
const c = Math.cos(water.a * Math.PI / 180), s = Math.sin(water.a * Math.PI / 180);
const out = V.norm(V.add(up, V.scale(V.add(V.scale(north, c), V.scale(east, s)), (water.r + +offS) / R0)));
const q0 = ss(body, out);
console.log(`# ${body} ${place}: ${water.r + +offS} m out on bearing ${water.a}: ${q0.isLiquid ? (q0.liquidRadius - q0.radius).toFixed(1) + ' m deep' : 'NOT WATER'}`);
const physics = P.createPhysics({ sampleSurface: ss });
const sim = new Sim({ sampleSurface: ss, getSpawn: (id) => surface.getSurface(id).getSpawn(), sampleObstacles: (id, d, r) => obstacles.sampleObstaclesPure(id, d.x, d.y, d.z, r), physics, body });
const pad = new Pad(); const rows = [];
for (let t = +from; t <= +to; t += +step) {
  sim.t = t; sim.teleport({ body, dir: [out.x, out.y, out.z] }); play(sim, pad, 3, { fps: 30 });
  const h = physics.here, w = {}; physics.water(body, sim.ex.p, w);
  rows.push({ t, kind: h.weather.kind, wind: h.air.speed, hs: w.present ? w.significant : NaN, per: w.period || 0, wc: w.whitecap01 || 0 });
}
for (const r of rows) console.log(`  ${String(r.t).padStart(5)}  ${r.kind.padEnd(13)} wind ${r.wind.toFixed(1).padStart(5)} m/s  Hs ${r.hs.toFixed(2)} m  period ${r.per.toFixed(1)} s  whitecaps ${(r.wc * 100).toFixed(0)} %`);
const hs = rows.map((r) => r.hs).filter((x) => x === x);
console.log(`  Hs over ${rows.length} clocks: least ${Math.min(...hs).toFixed(2)}, most ${Math.max(...hs).toFixed(2)} m; wind most ${Math.max(...rows.map((r) => r.wind)).toFixed(1)} m/s`);
