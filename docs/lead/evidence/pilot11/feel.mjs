// How the explorer moves, as a player feels it (Node, PILOT's Sim with PHYSICS, 60 Hz): from a
// stand, W (and Shift) for some seconds then let go: time to 90 % of pace, the pace, the stop;
// a jump; the jetpack held; at a few places on several worlds.
// node feel.mjs <root> [clock]
const [root, clock = '30'] = process.argv.slice(2);
const { Sim } = await import(root + '/src/core/sim.js');
const surface = await import(root + '/src/world/surface.js');
const obstacles = await import(root + '/src/world/obstacles.js');
const P = await import(root + '/src/physics/index.js');
const { Pad, play } = await import(root + '/tests/helpers.mjs');
const V = await import(root + '/src/core/vec.js');
const ss = (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z);
function make(body, place, hour = 11) {
  const physics = P.createPhysics({ sampleSurface: ss, seed: 1 });
  const sim = new Sim({ sampleSurface: ss, getSpawn: (id) => surface.getSurface(id).getSpawn(), sampleObstacles: (id, d, r) => obstacles.sampleObstaclesPure(id, d.x, d.y, d.z, r), physics, body });
  sim.t = +clock;
  const d = place === 'spawn' ? null : surface.getStandPure(body, place).unitDir;
  sim.teleport(d ? { body, dir: [d.x, d.y, d.z], hour } : { body, hour });
  return sim;
}
const horiz = (sim) => { const up = V.norm(sim.ex.p), v = sim.ex.v, vu = V.dot(v, up); return Math.hypot(v.x - up.x * vu, v.y - up.y * vu, v.z - up.z * vu); };
function walk(body, place, keys, secs, label, heading = 0) {
  const sim = make(body, place);
  const pad = new Pad();
  play(sim, pad, 1.5);
  if (heading) { pad.dx += heading * Math.PI / 180 / 0.0023; play(sim, pad, 0.1); }
  const p0 = { ...sim.ex.p };
  for (const k of keys) pad.press(k);
  let t = 0, t90 = null, vmax = 0; const vs = [];
  play(sim, pad, secs, { each: (tt) => { t = tt; const v = horiz(sim); vs.push(v); vmax = Math.max(vmax, v); } });
  const pace = vs.slice(-60).reduce((a, b) => a + b, 0) / 60;
  for (let i = 0; i < vs.length; i++) if (vs[i] >= 0.9 * pace) { t90 = i / 60; break; }
  const dist = V.len(V.sub(sim.ex.p, p0));
  for (const k of keys) pad.release(k);
  const pStop = { ...sim.ex.p }; let tStop = null;
  play(sim, pad, 3, { each: (tt) => { if (tStop == null && horiz(sim) < 0.1) tStop = tt; } });
  const stopD = V.len(V.sub(sim.ex.p, pStop));
  const sd = Math.sqrt(vs.slice(-120).reduce((a, b) => a + (b - pace) ** 2, 0) / 120);
  console.log(`${label.padEnd(36)} pace ${pace.toFixed(2)} m/s (sd ${sd.toFixed(2)}), 90% in ${t90 == null ? '-' : t90.toFixed(2)} s, ${dist.toFixed(1)} m in ${secs} s; stops in ${tStop == null ? '>3' : tStop.toFixed(2)} s over ${stopD.toFixed(2)} m`);
}
function jump(body, place, label) {
  const sim = make(body, place); const pad = new Pad(); play(sim, pad, 1.5);
  const up = V.norm(sim.ex.p), r0 = V.len(sim.ex.p);
  pad.tap('Space'); let hmax = 0, air = 0, left = false;
  play(sim, pad, 6, { each: () => { const h = V.len(sim.ex.p) - r0; hmax = Math.max(hmax, h); if (!sim.ex.grounded) { air += 1 / 60; left = true; } }, until: () => left && sim.ex.grounded });
  const sim2 = make(body, place); const pad2 = new Pad(); play(sim2, pad2, 1.5);
  const r1 = V.len(sim2.ex.p); pad2.press('Space'); let h3 = 0, fuel0 = sim2.ex.fuel, tEmpty = null;
  play(sim2, pad2, 8, { each: (t) => { h3 = Math.max(h3, V.len(sim2.ex.p) - r1); if (tEmpty == null && sim2.ex.fuel <= 0.01) tEmpty = t; } });
  console.log(`${label.padEnd(36)} jump ${hmax.toFixed(2)} m high, ${air.toFixed(2)} s in the air; jetpack held 8 s: ${h3.toFixed(1)} m up, fuel ${fuel0.toFixed(2)} -> empty at ${tEmpty == null ? '-' : tEmpty.toFixed(1)} s`);
}
const places = [['earth', 'spawn'], ['earth', 'alpine_meadow'], ['moon', 'spawn'], ['moon', 'crater_fields'], ['mars', 'spawn'], ['mars', 'dust_dunes'], ['jupiter', 'spawn'], ['neptune', 'storm_seas'], ['pluto', 'spawn']];
for (const [b, p] of places) {
  try {
    walk(b, p, ['KeyW'], 6, `${b} ${p} W`);
    walk(b, p, ['KeyW', 'ShiftLeft'], 6, `${b} ${p} Shift+W`);
    walk(b, p, ['KeyW', 'ShiftLeft'], 6, `${b} ${p} Shift+W heading +120`, 120);
    jump(b, p, `${b} ${p}`);
  } catch (e) { console.log(b, p, 'ERROR', e.message); }
}
