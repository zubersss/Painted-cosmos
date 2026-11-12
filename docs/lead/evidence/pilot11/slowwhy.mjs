// Where a run is slow, why (Node): Shift+W 12 s from a stand in one heading; every 0.5 s the pace,
// the slope under the feet (deg), the rise of the ground over the next 3 m along the run, the nearest
// boulder and trunk (m), and PHYSICS' read (st.phys.ahead / hold) when present.
const [root, body, place, heading] = process.argv.slice(2);
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
const pad = new Pad(); play(sim, pad, 1, { fps: 30 }); pad.press('KeyW'); pad.press('ShiftLeft');
let k = 0;
play(sim, pad, 12, { fps: 30, each: () => {
  if (++k % 15) return;
  const p = sim.ex.p, up = V.norm(p), g = ss(body, up), R = g.radius;
  const v = sim.ex.v, vu = V.dot(v, up), hv = V.sub(v, V.scale(up, vu)), sp = V.len(hv);
  const dir = sp > 0.1 ? V.scale(hv, 1 / sp) : sim.ex.fwd;
  const ahead = ss(body, V.norm(V.add(up, V.scale(dir, 3 / R)))).radius - R;
  let rock = 99, tree = 99;
  for (const o of sim.obstaclesNear(body, p, 8)) { const dd = V.len(V.sub(o.unitDir, up)) * R - o.radius; if (o.height < 2) rock = Math.min(rock, dd); else tree = Math.min(tree, dd); }
  const B = sim.ex.phys || {};
  console.log((k / 30).toFixed(1), 'r', (V.len(p) - 0).toFixed(2), 'ground', (R).toFixed(2), 'pace', sp.toFixed(2), 'slope', (g.slope * 57.3).toFixed(0), 'rise3m', ahead.toFixed(2), 'rock', rock.toFixed(1), 'tree', tree.toFixed(1), 'gait', B.gait, 'hold', B.hold != null ? (+B.hold).toFixed(2) : '-', 'ahead', B.ahead ? JSON.stringify(B.ahead).slice(0, 60) : '-');
} });
