// the ship hovering 20 m up in Neptune's squall (storm_seas stand, clock 222), step by step every 0.1 s
const R = process.env.ROOT;
const { Sim } = await import(R + '/src/core/sim.js');
const { Pad, play, len, dot, norm, sub } = await import(R + '/tests/helpers.mjs');
const surface = await import(R + '/src/world/surface.js');
const obstacles = await import(R + '/src/world/obstacles.js');
const { createPhysics } = await import(R + '/src/physics/index.js');
const ss = (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z);
const obs = (id, d, r) => obstacles.sampleObstaclesPure(id, d.x, d.y, d.z, r);
const body = process.argv[2] || 'neptune', biome = process.argv[3] || 'storm_seas', T = Number(process.argv[4] || 222), alt = Number(process.argv[5] || 20);
const physics = createPhysics({ sampleSurface: ss });
const sim = new Sim({ sampleSurface: ss, getSpawn: (id) => surface.getSurface(id).getSpawn(), sampleObstacles: obs, physics, body });
const pad = new Pad(); sim.t = T;
const d = surface.getStandPure(body, biome).unitDir;
sim.teleport({ body, dir: [d.x, d.y, d.z], hour: 11, ship: true, altitude: alt, heading: 90 });
let lastV = null, n = 0; const f2 = (x) => (+x).toFixed(2);
play(sim, pad, 20, { fps: 60, each: () => {
  const v = sim.sh.v, up = norm(sim.sh.p); let a = 0, aUp = 0;
  if (lastV) { const dv = sub(v, lastV); a = len(dv) * 60; aUp = dot(dv, up) * 60; }
  lastV = { ...v };
  const b = (sim.sh.phys && sim.sh.phys.buffetAngle) || {};
  if (n++ % 6 === 0 || a > 40) console.log(`${f2(sim.t)} ${sim.sm.state} hAG ${f2(sim.sh.altGround)} v ${f2(sim.sh.speed)} vUp ${f2(dot(v, up))} |a| ${f2(a)} aUp ${f2(aUp)} wind ${f2(physics.here && physics.here.air ? physics.here.air.speed : 0)} buffet p/r/y ${f2((b.pitch || 0) * 57.3)}/${f2((b.roll || 0) * 57.3)}/${f2((b.yaw || 0) * 57.3)} bounces ${sim.sh.bounces}`);
} });
