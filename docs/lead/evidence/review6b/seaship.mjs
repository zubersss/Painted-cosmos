// A ship landed on the real sea with PHYSICS (Node): find deep water near a coast stand, hover the
// ship 12 m over it, press E, wait for LANDED, then ride 40 s and report the heave and the pitch.
// node seaship.mjs <root> <body> <biome> [clock seconds]
const [root = new URL('../../../../', import.meta.url).pathname.replace(/\/$/, ''), body = 'earth', biome = 'sea_coast', clock = '0'] = process.argv.slice(2);
const { Sim } = await import(root + '/src/core/sim.js');
const surface = await import(root + '/src/world/surface.js');
const obstacles = await import(root + '/src/world/obstacles.js');
const P = await import(root + '/src/physics/index.js');
const { Pad, play } = await import(root + '/tests/helpers.mjs');
const V = await import(root + '/src/core/vec.js');
const ss = (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z);
const physics = P.createPhysics({ sampleSurface: ss, seed: 1 });
const sim = new Sim({ sampleSurface: ss, getSpawn: (id) => surface.getSurface(id).getSpawn(), sampleObstacles: (id, d, r) => obstacles.sampleObstaclesPure(id, d.x, d.y, d.z, r), physics, body });
sim.t = +clock;
const st = surface.getStandPure(body, biome).unitDir, R = ss(body, st).radius;
let ex = st.z, ez = -st.x; const el = Math.hypot(ex, ez); ex /= el; ez /= el; const e = { x: ex, y: 0, z: ez };
const n = { x: st.y * e.z - st.z * e.y, y: st.z * e.x - st.x * e.z, z: st.x * e.y - st.y * e.x };
let best = null;
for (let r = 60; r <= 900 && !best; r += 30) for (let i = 0; i < 24; i++) {
  const a = i / 24 * Math.PI * 2, d = V.norm({ x: st.x + (e.x * Math.cos(a) + n.x * Math.sin(a)) * r / R, y: st.y + (e.y * Math.cos(a) + n.y * Math.sin(a)) * r / R, z: st.z + (e.z * Math.cos(a) + n.z * Math.sin(a)) * r / R });
  const s = ss(body, d); if (s.liquidRadius - s.radius > 12) { best = d; break; }
}
if (!best) { console.log('no deep water'); process.exit(1); }
sim.teleport({ body, dir: [best.x, best.y, best.z], ship: true, altitude: 12, hour: 11 });
const pad = new Pad();
play(sim, pad, 2);
pad.tap('KeyE');
play(sim, pad, 40, { until: () => sim.sm.state === 'LANDED' });
console.log(body, biome, 'state', sim.sm.state, 'onLiquid', sim.sh.onLiquid, 'depth', (ss(body, best).liquidRadius - ss(body, best).radius).toFixed(0), 'm');
const w = physics.water(body, sim.sh.p);
console.log('  sea here: Hs', (w.significant || 0).toFixed(2), 'm, period', (w.period || 0).toFixed(1), 's, length', (w.length || 0).toFixed(0), 'm');
const up = V.norm(sim.sh.p), r0 = sim.sh.float ? V.len(sim.sh.float.p0) : V.len(sim.sh.p);
let hz = -1e9, lz = 1e9, hp = -1e9, lp = 1e9, hr = -1e9, lr = 1e9, sumz2 = 0, k = 0, jump = 0, prevZ = null;
play(sim, pad, 40, { each: () => {
  const z = V.len(sim.sh.p) - r0, F = sim.sh.float; if (!F) return;
  hz = Math.max(hz, z); lz = Math.min(lz, z); hp = Math.max(hp, F.pitch); lp = Math.min(lp, F.pitch); hr = Math.max(hr, F.roll); lr = Math.min(lr, F.roll); sumz2 += z * z; k++;
  if (prevZ != null) jump = Math.max(jump, Math.abs(z - prevZ)); prevZ = z;
} });
console.log('  afloat 40 s:', k ? `heave ${lz.toFixed(2)}..${hz.toFixed(2)} m (sd ${Math.sqrt(sumz2 / k).toFixed(2)}), pitch ${(lp * 57.3).toFixed(1)}..${(hp * 57.3).toFixed(1)} deg, roll ${(lr * 57.3).toFixed(1)}..${(hr * 57.3).toFixed(1)} deg, largest step in a frame ${(jump * 100).toFixed(1)} cm` : 'never afloat', 'state', sim.sm.state);
