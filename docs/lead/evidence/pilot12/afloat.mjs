// A swimmer in open water (Node, Sim with PHYSICS, 30 Hz, the game's weather seed): put `off` metres out from a coast
// stand over deep water at a clock; hands off 12 s, then W 12 s: PHYSICS' sea state there, how the feet rise and fall
// against the still level, the fastest rise and fall, the largest vertical acceleration, the drift, the pace.
// node afloat.mjs <root> <body> <place> <off> <clock>
const [root, body, place, offS, clockS] = process.argv.slice(2);
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
const physics = P.createPhysics({ sampleSurface: ss });
const sim = new Sim({ sampleSurface: ss, getSpawn: (id) => surface.getSurface(id).getSpawn(), sampleObstacles: (id, d, r) => obstacles.sampleObstaclesPure(id, d.x, d.y, d.z, r), physics, body });
sim.t = +clockS; sim.teleport({ body, dir: [out.x, out.y, out.z], heading: water.a }); const pad = new Pad(); play(sim, pad, 4, { fps: 30 });
// (the teleport stands the explorer on the sea bed: let it come up and ride for 10 s before anything is measured)
play(sim, pad, 60, { fps: 30, until: () => V.len(sim.ex.p) - ss(body, V.norm(sim.ex.p)).liquidRadius > -1.7 }); play(sim, pad, 10, { fps: 30 });
const w = {}; physics.water(body, sim.ex.p, w); const h = physics.here;
console.log(`# ${body} ${place}, ${water.r + +offS} m out, clock ${clockS}: ${h.weather.kind}, wind ${h.air.speed.toFixed(1)} m/s; PHYSICS' sea: Hs ${w.significant.toFixed(2)} m, period ${w.period.toFixed(1)} s, length ${w.length.toFixed(1)} m, steepness ${(w.steepness || 0).toFixed(2)}, whitecaps ${((w.whitecap01 || 0) * 100).toFixed(0)} %`);
for (const [name, keys] of [['hands off', []], ['W', ['KeyW']]]) {
  pad.releaseAll(); for (const k of keys) pad.press(k);
  const p0 = { ...sim.ex.p }; let lo = 1e9, hi = -1e9, vu = 0, vd = 0, amax = 0, pv = null, sw = 0, n = 0, sub = 0, head = 0;
  play(sim, pad, 12, { fps: 30, each: () => {
    const u = V.norm(sim.ex.p), q = ss(body, u), z = V.len(sim.ex.p) - q.liquidRadius; lo = Math.min(lo, z); hi = Math.max(hi, z);
    const v = V.dot(sim.ex.v, u); vu = Math.max(vu, v); vd = Math.min(vd, v); if (pv != null) amax = Math.max(amax, Math.abs(v - pv) * 30); pv = v;
    n++; if (sim.ex.swimming) sw++;
    // the wave's own height at the swimmer now, and so how far the head (1.8 m over the feet) is under the surface
    physics.water(body, sim.ex.p, w); const surf = (w.height || 0); if (z + 1.8 < surf) head++;
    sub += (sim.ex.phys && sim.ex.phys.submerged01) || 0;
  } });
  const dv = V.sub(sim.ex.p, p0), u0 = V.norm(p0), hz = V.len(V.sub(dv, V.scale(u0, V.dot(dv, u0))));
  console.log(`  ${name.padEnd(9)} 12 s: feet ${lo.toFixed(2)} .. ${hi.toFixed(2)} m against the still level (a range of ${(hi - lo).toFixed(2)} m); rising up to ${vu.toFixed(1)}, falling ${(-vd).toFixed(1)} m/s; largest vertical acceleration ${(amax / 9.81).toFixed(1)} g; moved ${hz.toFixed(1)} m (${(hz / 12).toFixed(2)} m/s); afloat ${(100 * sw / n).toFixed(0)} % of it; mean submerged ${(sub / n).toFixed(2)}; head under the wave ${(100 * head / n).toFixed(0)} % of it`);
}
