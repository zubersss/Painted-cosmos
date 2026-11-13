// The real ground, one heading, step by step (Node, PILOT's Sim with PHYSICS): Shift+W from a stand.
// node cliff.mjs <root> <body> <place|spawn> <heading> [secs=12] [fps=30] [every=1] [from=0 s] [explorer.js to use instead]
const [root, body, place, heading, secs = '12', fps = '30', every = '1', from = '0'] = process.argv.slice(2);
const { Sim } = await import(root + '/src/core/sim.js');
const surface = await import(root + '/src/world/surface.js');
const obstacles = await import(root + '/src/world/obstacles.js');
const P = await import(root + '/src/physics/index.js');
const { Pad, play } = await import(root + '/tests/helpers.mjs');
const V = await import(root + '/src/core/vec.js');
const ss = (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z);
const physics = P.createPhysics({ sampleSurface: ss, seed: 1 });
const sim = new Sim({ sampleSurface: ss, getSpawn: (id) => surface.getSurface(id).getSpawn(), sampleObstacles: (id, d, r) => obstacles.sampleObstaclesPure(id, d.x, d.y, d.z, r), physics, body });
sim.t = 30;
const d = place === 'spawn' ? null : surface.getStandPure(body, place).unitDir;
sim.teleport(d ? { body, dir: [d.x, d.y, d.z], heading: +heading, hour: 11 } : { body, heading: +heading, hour: 11 });
const pad = new Pad(); play(sim, pad, 1, { fps: +fps }); pad.press('KeyW'); pad.press('ShiftLeft');
let k = 0; const r0 = V.len(sim.ex.p); let steep = 0, prevR = null;
play(sim, pad, +secs, { fps: +fps, each: () => {
  k++;
  const p = sim.ex.p, up = V.norm(p), g = ss(body, up), R = g.radius, r = V.len(p);
  if (prevR != null && sim.ex.grounded && g.slope * 57.3 > 50 && r > prevR) steep += r - prevR; prevR = r;
  if (k % +every || k / +fps < +from) return;
  const v = sim.ex.v, vu = V.dot(v, up), hv = V.sub(v, V.scale(up, vu)), sp = V.len(hv);
  const dir = sp > 0.1 ? V.scale(hv, 1 / sp) : sim.ex.fwd;
  const a1 = ss(body, V.norm(V.add(up, V.scale(dir, 1.2 / R)))).radius - R;
  const B = sim.ex.phys || {};
  console.log((k / +fps).toFixed(3), 'up', (r - r0).toFixed(2), 'feet', (r - R).toFixed(2), 'gnd', sim.ex.grounded ? 1 : 0, 'vh', sp.toFixed(2), 'vu', vu.toFixed(2), 'slope', (g.slope * 57.3).toFixed(0), 'rise1.2', a1.toFixed(2), 'hip', (B.hip || 0).toFixed(2), 'hipV', (B.hipV || 0).toFixed(2), 'trend', (B.trend || 0).toFixed(2), 'base', B.base ? (B.base - r).toFixed(2) : '-', 'grip', B.grip, 'slip', (B.slip01 || 0).toFixed(2), 'brace', (B.brace || 0).toFixed(2), 'cap', B.paceCap > 1e8 ? '-' : B.paceCap.toFixed(2), 'ah', B.paceAhead > 1e8 ? '-' : B.paceAhead.toFixed(2), 'cr', !(B.paceCrest < 1e8) ? '-' : B.paceCrest.toFixed(2), 'way', B.way && B.way.ok ? B.way.lo.toFixed(1) + '..' + B.way.hi.toFixed(1) : '-', B.material, 'mu', (B.friction || 0).toFixed(2), 'gait', B.gait, 'pw', B.paceWall < 1e8 ? B.paceWall.toFixed(2) : '-', 'wall', B.wall);
} });
console.log('up on >50 deg', steep.toFixed(2));
