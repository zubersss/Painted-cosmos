// A hands-off hover, every half second (Node, Sim with PHYSICS, 60 Hz, the game's weather seed):
// height over the ground, speed over the ground, climb rate, the wind at the hull, the drawn hull's
// rock (PHYSICS' buffetAngle), the largest acceleration of the hull within the half second (g).
// node hovertrace.mjs <root> <body> <place|spawn> <clock> [alt=30] [secs=20]
const [root, body, place, clockS, altS = '30', secsS = '20'] = process.argv.slice(2);
const { Sim } = await import(root + '/src/core/sim.js');
const surface = await import(root + '/src/world/surface.js');
const obstacles = await import(root + '/src/world/obstacles.js');
const P = await import(root + '/src/physics/index.js');
const { Pad, play } = await import(root + '/tests/helpers.mjs');
const V = await import(root + '/src/core/vec.js');
const ss = (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z);
const d0 = place === 'spawn' ? surface.getSurface(body).getSpawn() : surface.getStandPure(body, place).unitDir;
const physics = P.createPhysics({ sampleSurface: ss });
const sim = new Sim({ sampleSurface: ss, getSpawn: (id) => surface.getSurface(id).getSpawn(), sampleObstacles: (id, d, r) => obstacles.sampleObstaclesPure(id, d.x, d.y, d.z, r), physics, body });
sim.t = +clockS; sim.teleport({ body, dir: [d0.x, d0.y, d0.z], ship: true, altitude: +altS, throttle: 0, heading: 0 });
const pad = new Pad(); play(sim, pad, 1); const R00 = ss(body, V.norm(sim.sh.p)).radius;
const DEG = 180 / Math.PI; let pv = { ...sim.sh.v }, amax = 0, bmax = 0, n = 0, gAll = 0, bAll = 0;
console.log(`# ${body} ${place} clock ${clockS}, hands off from ${altS} m: weather ${physics.here.weather.kind}`);
play(sim, pad, +secsS, { each: (t) => {
  const a = V.len(V.sub(sim.sh.v, pv)) * 60 / 9.81; pv = { ...sim.sh.v }; amax = Math.max(amax, a); gAll = Math.max(gAll, a);
  const b = sim.sh.phys && sim.sh.phys.buffetAngle, ba = b ? Math.hypot(b.pitch, b.roll, b.yaw) * DEG : 0; bmax = Math.max(bmax, ba); bAll = Math.max(bAll, ba);
  if (++n % 30 === 0) {
    const i = sim.info();
    console.log(`  ${(t + 1 / 60).toFixed(1).padStart(5)} s  ${sim.sh.altGround.toFixed(1).padStart(6)} m up  ${sim.sh.speed.toFixed(1).padStart(5)} m/s  climb ${i.ship.vUp.toFixed(1).padStart(6)} m/s  wind ${physics.here.air.speed.toFixed(0).padStart(4)} m/s (up ${V.dot(physics.here.air.wind, V.norm(sim.sh.p)).toFixed(0).padStart(4)}) ground ${(ss(body, V.norm(sim.sh.p)).radius - R00).toFixed(1).padStart(6)} m  rock ${bmax.toFixed(1).padStart(5)} deg  ${amax.toFixed(1).padStart(5)} g  ${i.state}${i.notice ? '  "' + i.notice + '"' : ''}`);
    amax = 0; bmax = 0;
  }
} });
console.log(`  worst: ${gAll.toFixed(1)} g in a frame, hull rock ${bAll.toFixed(1)} deg`);
