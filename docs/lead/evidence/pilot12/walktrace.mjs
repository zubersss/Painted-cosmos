// A walk every half second (Node, Sim with PHYSICS, 30 Hz, the game's weather seed): pace, slope, the
// ground PHYSICS reads under the feet, liquid, the body's state. node walktrace.mjs <root> <body> <place|spawn> <clock> <heading> [secs=8] [keys=KeyW]
const [root, body, place, clockS, hdS, secsS = '8', keysS = 'KeyW'] = process.argv.slice(2);
const { Sim } = await import(root + '/src/core/sim.js');
const surface = await import(root + '/src/world/surface.js');
const obstacles = await import(root + '/src/world/obstacles.js');
const P = await import(root + '/src/physics/index.js');
const { Pad, play } = await import(root + '/tests/helpers.mjs');
const V = await import(root + '/src/core/vec.js');
const ss = (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z);
const d0 = place === 'spawn' ? null : surface.getStandPure(body, place).unitDir;
const physics = P.createPhysics({ sampleSurface: ss });
const sim = new Sim({ sampleSurface: ss, getSpawn: (id) => surface.getSurface(id).getSpawn(), sampleObstacles: (id, d, r) => obstacles.sampleObstaclesPure(id, d.x, d.y, d.z, r), physics, body });
sim.t = +clockS; sim.teleport(d0 ? { body, dir: [d0.x, d0.y, d0.z], heading: +hdS } : { body, heading: +hdS });
const pad = new Pad(); play(sim, pad, 1, { fps: 30 }); for (const k of keysS.split(',')) pad.press(k);
let n = 0; const p0 = { ...sim.ex.p }; const G = {};
play(sim, pad, +secsS, { fps: 30, each: (t) => {
  if (++n % 15 !== 0) return;
  const u = V.norm(sim.ex.p), s = ss(body, u), g = physics.ground(body, u, G), B = sim.ex.phys || {};
  const near = sim.obstaclesNear ? sim.obstaclesNear(body, sim.ex.p, 3) : [];
  console.log(`  ${t.toFixed(1).padStart(4)} s  ${V.len(V.sub(sim.ex.p, p0)).toFixed(1).padStart(5)} m  pace ${sim.ex.speed.toFixed(2)}  slope ${(s.slope * 57.3).toFixed(0).padStart(2)}  ${String(g.material || g.kind || '?').padEnd(8)} friction ${(g.friction || 0).toFixed(2)} wet ${(g.wetness01 || 0).toFixed(2)}  depth ${sim.ex.liquidDepth.toFixed(2)}  ${sim.ex.mode} gait ${B.gait} grounded ${sim.ex.grounded}  biome ${s.biomeId}  things within 3 m ${near.length}${near.length ? ' (' + near.map((o) => (o.kind || '?') + ' r' + (o.radius || 0).toFixed(1) + ' h' + (o.height || 0).toFixed(1)).join(', ') + ')' : ''}`);
} });
