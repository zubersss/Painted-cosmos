// Stepping out of the ship (PAINTER on PILOT, item 1): at every world's spawn and biome stands the ship is
// set down by the landing assist, E steps out; what the first settled frame holds: the share of the frame
// the hull covers (its spheres projected: body, canopy, fin, wings), whether the hull lies between the lens
// and the figure, how far the boom is. Usage: ROOT=<tree> node stepout.mjs [bodies] [-v]
const R = process.env.ROOT;
const { Sim } = await import(R + '/src/core/sim.js');
const { S } = await import(R + '/src/core/state.js');
const { Pad, play, len, dot, norm, sub } = await import(R + '/tests/helpers.mjs');
const { add, scale, cross, qRotate, V } = await import(R + '/src/core/vec.js');
const surface = await import(R + '/src/world/surface.js');
const obstacles = await import(R + '/src/world/obstacles.js');
const { createPhysics } = await import(R + '/src/physics/index.js');
const { BODIES } = await import(R + '/src/data/bodies.js');
const looks = await import(R + '/src/data/looks.js');
const ss = (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z);
const obs = (id, d, r) => obstacles.sampleObstaclesPure(id, d.x, d.y, d.z, r);
const bodies = (process.argv[2] && !process.argv[2].startsWith('-') ? process.argv[2] : Object.keys(BODIES).join(',')).split(','), verbose = process.argv.includes('-v');
const HULL = [[0, 1.3, -3.3, 1.2], [0, 1.45, -1.3, 1.6], [0, 1.3, 1.0, 1.6], [0, 1.6, 3.2, 1.4], [0, 2.5, 4.0, 0.9], [-2.4, 1.5, 1.0, 1.0], [2.4, 1.5, 1.0, 1.0], [-3.3, 1.6, 1.25, 0.7], [3.3, 1.6, 1.25, 0.7]];
function frame(sim) {
  const pose = sim.camPose, p = pose.p, dir = qRotate(pose.q, V(0, 0, -1)), sh = sim.sh;
  const shape = HULL.map((h) => ({ p: add(sh.p, qRotate(sh.q, V(h[0], h[1], h[2]))), radius: h[3] }));
  const up = norm(p), right = norm(cross(dir, up)), top = cross(right, dir), th = Math.tan((58 * Math.PI) / 360), tw = th * 16 / 9;
  const discs = []; let inside = false;
  for (const h of shape) { const v = sub(h.p, p), d = dot(v, dir); if (d < 0.3) { if (len(v) < h.radius) inside = true; continue; } discs.push({ x: dot(v, right) / d, y: dot(v, top) / d, r: h.radius / d }); }
  let hit = 0, low = 0; const NX = 32, NY = 18;
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const x = ((i + 0.5) / NX * 2 - 1) * tw, y = ((j + 0.5) / NY * 2 - 1) * th; for (const c of discs) if ((x - c.x) ** 2 + (y - c.y) ** 2 < c.r * c.r) { hit++; if (j < NY / 2) low++; break; } }
  const chest = add(sim.ex.p, scale(norm(sim.ex.p), 1.2)), seg = sub(chest, p), sl = len(seg), sd = scale(seg, 1 / sl);
  let hidden = false;
  for (const h of shape) { const q = sub(h.p, p), t = Math.max(0, Math.min(sl, dot(q, sd))); if (len(sub(q, scale(sd, t))) < h.radius) hidden = true; }
  return { cover: inside ? 1 : hit / (NX * NY), lower: low / (NX * NY / 2), hidden, boom: len(sub(p, add(sim.ex.p, scale(norm(sim.ex.p), 2.05)))), fromShip: len(sub(sim.ex.p, sh.p)) };
}
let n = 0, bad = 0, worst = 0, sum = 0, hiddenN = 0, shortN = 0;
for (const body of bodies) {
  const places = [{ name: 'spawn', dir: null }];
  for (const b of looks.getLook(body).biomes) { try { const st = surface.getStandPure(body, b.id); if (st && st.unitDir) places.push({ name: b.id, dir: st.unitDir }); } catch { /* none */ } }
  for (const pl of places) {
    const physics = createPhysics({ sampleSurface: ss, timeBudget: false });
    const sim = new Sim({ sampleSurface: ss, getSpawn: (id) => surface.getSurface(id).getSpawn(), sampleObstacles: obs, physics, body });
    const pad = new Pad();
    const o = { body, ship: true, altitude: 30 }; if (pl.dir) o.dir = [pl.dir.x, pl.dir.y, pl.dir.z];
    sim.teleport(o); play(sim, pad, 1);
    pad.tap('KeyE'); play(sim, pad, 90, { until: () => sim.sm.state === S.LANDED });
    if (sim.sm.state !== S.LANDED) { console.log(`${body} ${pl.name}: did not land (${sim.sm.state}, ${sim.notice && sim.notice.text})`); continue; }
    play(sim, pad, 2);
    pad.tap('KeyE'); play(sim, pad, 6, { until: () => sim.sm.state === S.ON_FOOT });
    const first = frame(sim);
    play(sim, pad, 2.5);
    const f = frame(sim);
    n++; sum += f.cover; worst = Math.max(worst, f.cover); if (f.cover > 1 / 6) bad++; if (f.hidden) hiddenN++; if (f.boom < 4) shortN++;
    if (verbose || f.cover > 1 / 6 || f.hidden) console.log(`${body.padEnd(8)} ${pl.name.padEnd(22)} hull ${(f.cover * 100).toFixed(0).padStart(3)} % of the frame (lower half ${(f.lower * 100).toFixed(0)} %; at the first frame on foot ${(first.cover * 100).toFixed(0)} %) ${f.hidden ? 'BETWEEN LENS AND FIGURE' : ''} boom ${f.boom.toFixed(1)} m, ${f.fromShip.toFixed(1)} m from the ship, slope ${(sim.ex.slope * 57.3).toFixed(0)} deg, mode ${sim.ex.mode}`);
  }
}
console.log(`${n} landings: hull over a sixth of the frame at ${bad}, between lens and figure at ${hiddenN}, boom under 4 m at ${shortN}; mean cover ${(100 * sum / n).toFixed(1)} %, worst ${(100 * worst).toFixed(0)} %`);
