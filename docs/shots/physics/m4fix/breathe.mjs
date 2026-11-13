// What PHYSICS hands the picture for grass and crowns at a place (Node, PILOT's Sim with PHYSICS, 30 Hz, standing):
// the bend of grass (plantBend, stiff01 0) and the lean of trunks (stiff01 1) at five points round the focus over 40 s.
// node breathe.mjs <root> <body> <place|spawn> <clock> [secs=40]
const [root, body, place, clockS, secsS = '40'] = process.argv.slice(2);
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
const pad = new Pad(); play(sim, pad, 8, { fps: 30 });
const F = physics.fields.flora.field, fr = physics.fields.frame, D = 180 / Math.PI;
const pts = [[6, 0], [0, 9], [-12, 4], [15, -10], [-5, -16]];
const g = pts.map(() => ({ lo: 99, hi: 0, sum: 0, n: 0, hist: [], jump: 0, over10: 0 })), tr = pts.map(() => ({ lo: 99, hi: -99, sum: 0, n: 0, hist: [], jump: 0 }));
let wlo = 99, whi = 0; const o = {};
play(sim, pad, +secsS, { fps: 30, each: () => {
  const fx = fr.lx(sim.ex.p.x, sim.ex.p.y, sim.ex.p.z), fz = fr.lz(sim.ex.p.x, sim.ex.p.y, sim.ex.p.z);
  const w = physics.here.air.speed; wlo = Math.min(wlo, w); whi = Math.max(whi, w);
  pts.forEach(([dx, dz], i) => {
    F.plantBend(fx + dx, fz + dz, 0, o); const a = o.angle * D, G = g[i];
    G.lo = Math.min(G.lo, a); G.hi = Math.max(G.hi, a); G.sum += a; G.n++; G.hist.push(a); if (a > 10) G.over10++;
    if (G.hist.length > 15) G.jump = Math.max(G.jump, Math.abs(a - G.hist[G.hist.length - 16]));
    F.plantBendLite(fx + dx, fz + dz, 1, o); const along = Math.hypot(o.e, o.n) * 1200, T = tr[i];      // cm at the top of a 12 m tree (the chord's lean x height)
    T.lo = Math.min(T.lo, along); T.hi = Math.max(T.hi, along); T.sum += along; T.n++; T.hist.push(along);
    if (T.hist.length > 30) T.jump = Math.max(T.jump, Math.abs(along - T.hist[T.hist.length - 31]));
  });
} });
const f = (x) => x.toFixed(1);
console.log(`${body} ${place} clock ${clockS} (${physics.here.weather.kind}), wind at the focus ${f(wlo)} to ${f(whi)} m/s, ${secsS} s:`);
console.log('  grass, bend in degrees (min / mean / max; the largest change in half a second; seconds over 10 degrees): ' + g.map((G) => `${f(G.lo)} / ${f(G.sum / G.n)} / ${f(G.hi)}; ${f(G.jump)}; ${f(G.over10 / 30)}`).join('  |  '));
console.log('  a 12 m tree, its top off the vertical in cm (min / mean / max; the largest change in a second): ' + tr.map((T) => `${f(T.lo)} / ${f(T.sum / T.n)} / ${f(T.hi)}; ${f(T.jump)}`).join('  |  '));
