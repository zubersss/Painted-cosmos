// the spawn meadow: walk from a stand (as the game's first seconds), count what physics emits near the boots, per kind,
// and the ground there (material, dust); and the disturbers (the explorer's kick)
const R = process.env.ROOT;
const { Sim, FEEL } = await import(R + '/src/core/sim.js');
const { Pad, play, len, norm } = await import(R + '/tests/helpers.mjs');
const surface = await import(R + '/src/world/surface.js');
const obstacles = await import(R + '/src/world/obstacles.js');
const { createPhysics } = await import(R + '/src/physics/index.js');
const ss = (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z);
const obs = (id, d, r) => obstacles.sampleObstaclesPure(id, d.x, d.y, d.z, r);
const physics = createPhysics({ sampleSurface: ss });
const sim = new Sim({ sampleSurface: ss, getSpawn: (id) => surface.getSurface(id).getSpawn(), sampleObstacles: obs, physics, body: 'earth' });
const pad = new Pad(); sim.t = Number(process.argv[2] || 14.8);
play(sim, pad, 1.0, { fps: 30 });
const P = physics.particles, kinds = Object.keys(P).filter((k) => P[k] && typeof P[k].count === 'number');
console.log('kinds', kinds.join(' '));
const cnt = () => Object.fromEntries(kinds.map((k) => [k, P[k].count]));
const g = physics.groundAt ? physics.groundAt('earth', sim.ex.p, {}) : null;
console.log('ground at the feet', g ? JSON.stringify({ material: g.material, dust: g.dust, wet: g.wet }) : '(no groundAt)');
console.log('here', JSON.stringify({ mat: sim.ex.phys && sim.ex.phys.material, blown: physics.here && physics.here.blown }));
let prev = cnt();
pad.press('KeyW');
play(sim, pad, 2.0, { fps: 30, each: (t) => {
  const c = cnt(), d = {}; for (const k of kinds) if (c[k] !== prev[k]) d[k] = c[k] - prev[k];
  const B = sim.ex.phys || {};
  if (Object.keys(d).length) console.log(t.toFixed(2), 'v', sim.ex.speed.toFixed(2), 'mat', B.material, 'impact', (B.impact || 0).toFixed(2), 'puff', (B.puff || 0).toFixed(2), 'slip', (B.slip01 || 0).toFixed(2), JSON.stringify(d));
  prev = c;
} });
