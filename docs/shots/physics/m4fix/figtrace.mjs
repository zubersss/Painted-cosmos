// What the drawn figure is handed in a gale (Node, PILOT's Sim with PHYSICS, 30 Hz): standing, then W; every tenth of a second
// the wind at the walker, the lean (deg), the crouch, the air past the body. node figtrace.mjs <root> <body> <place> <clock> [secs=8] [verbose=0]
const [root, body, place, clockS, secsS = '8', verbose = '0'] = process.argv.slice(2);
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
const pad = new Pad(); play(sim, pad, 4, { fps: 30 });
const D = 180 / Math.PI; let k = 0; const rows = [];
play(sim, pad, +secsS, { fps: 30, each: () => { if (k++ % 3 === 0) { const B = sim.ex.phys; rows.push({ w: physics.here.air.speed, lean: Math.hypot(B.leanV.x, B.leanV.y, B.leanV.z) * D, hk: B.hunker01, rw: B.relWindSpeed, lx: B.leanV.x, ly: B.leanV.y, lz: B.leanV.z }); } } });
const rng = (f) => { let lo = 1e9, hi = -1e9, jump = 0, p = null; for (const r of rows) { const v = f(r); lo = Math.min(lo, v); hi = Math.max(hi, v); if (p != null) jump = Math.max(jump, Math.abs(v - p)); p = v; } return `${lo.toFixed(2)} to ${hi.toFixed(2)} (largest change in a tenth of a second ${jump.toFixed(2)})`; };
let turn = 0; for (let i = 1; i < rows.length; i++) { const a = rows[i - 1], b = rows[i], la = Math.hypot(a.lx, a.ly, a.lz), lb = Math.hypot(b.lx, b.ly, b.lz); if (la > 1e-6 && lb > 1e-6) turn = Math.max(turn, Math.acos(Math.max(-1, Math.min(1, (a.lx * b.lx + a.ly * b.ly + a.lz * b.lz) / (la * lb)))) * D); }
console.log(`${body} ${place} clock ${clockS}, standing ${secsS} s: wind at the walker ${rng((r) => r.w)} m/s; the lean handed to the figure ${rng((r) => r.lean)} deg, its direction turning ${turn.toFixed(1)} deg in a tenth of a second at most; the crouch ${rng((r) => r.hk)}; the air past the body ${rng((r) => r.rw)} m/s`);
if (+verbose) console.log(rows.map((r) => `${r.w.toFixed(0)}/${r.lean.toFixed(0)}/${r.hk.toFixed(2)}`).join(' '));
