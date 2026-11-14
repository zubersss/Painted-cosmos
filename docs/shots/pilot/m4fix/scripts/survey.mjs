// Careless low flight on every body with PHYSICS and the real obstacles: full throttle, pushed down
// onto the floor (C) most of the time, turning; and a dive from 400 m. Per body: bounces, the
// largest change of velocity in one step, the lowest the hull came to the solid ground.
// Usage: ROOT=<tree> node survey.mjs [bodies] [seconds]
const R = process.env.ROOT;
const { Sim, FEEL } = await import(R + '/src/core/sim.js');
const { Pad, play, len, dot, norm, sub } = await import(R + '/tests/helpers.mjs');
const surface = await import(R + '/src/world/surface.js');
const obstacles = await import(R + '/src/world/obstacles.js');
const { createPhysics } = await import(R + '/src/physics/index.js');
const { BODIES } = await import(R + '/src/data/bodies.js');
const ss = (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z);
const obs = (id, d, r) => obstacles.sampleObstaclesPure(id, d.x, d.y, d.z, r);
const bodies = (process.argv[2] || Object.keys(BODIES).join(',')).split(','), secs = Number(process.argv[3] || 80);
const f2 = (x) => (+x).toFixed(2);
let tot = { bounces: 0, worst: 0 };
for (const body of bodies) {
  const physics = createPhysics({ sampleSurface: ss, timeBudget: false });
  const sim = new Sim({ sampleSurface: ss, getSpawn: (id) => surface.getSurface(id).getSpawn(), sampleObstacles: obs, physics, body });
  const pad = new Pad();
  sim.teleport({ body, ship: true, altitude: 30 });
  play(sim, pad, 0.5);
  pad.press('KeyW');
  let lastV = { ...sim.sh.v }, maxDv = 0, maxDvUp = 0, minHard = Infinity, maxUp = 0, tree = Infinity, vmaxSeen = 0, tMax = 0;
  const each = (t0) => (t) => {
    const sh = sim.sh, up = norm(sh.p), d = sub(sh.v, lastV), dv = len(d);
    if (dv > maxDv) { maxDv = dv; tMax = sim.t; }
    maxDvUp = Math.max(maxDvUp, Math.abs(dot(d, up)));
    lastV = { ...sh.v };
    const g = ss(body, up), hard = len(sh.p) - Math.max(g.radius, g.liquidRadius || 0);
    minHard = Math.min(minHard, hard); maxUp = Math.max(maxUp, Math.abs(dot(sh.v, up))); vmaxSeen = Math.max(vmaxSeen, sh.speed);
    for (const o of obs(body, up, 6)) { const gap = Math.acos(Math.min(1, dot(up, norm(o.unitDir)))) * len(sh.p); if (gap <= o.radius + 1.5) tree = Math.min(tree, len(sh.p) - g.radius - o.height); }
  };
  const legs = Math.round(secs / 8);
  for (let leg = 0; leg < legs; leg++) {
    const turn = leg % 2 ? 260 : -200;
    if (leg % 4 === 3) pad.release('KeyC'); else pad.press('KeyC');
    const e = each();
    play(sim, pad, 8, { each: (t) => { if (t < 0.5) pad.dx += turn / 30; e(t); } });
  }
  pad.release('KeyC'); pad.release('KeyW');
  const low = { b: sim.sh.bounces, maxDv, maxDvUp, minHard, tree, maxUp, vmaxSeen, tMax };
  // a dive: from 400 m, nose 60 degrees down, full throttle, 14 s
  sim.teleport({ body, ship: true, altitude: 400, pitchDeg: -60, throttle: 1 });
  lastV = { ...sim.sh.v }; maxDv = 0; maxDvUp = 0; minHard = Infinity; maxUp = 0; tree = Infinity; vmaxSeen = 0;
  const b0 = sim.sh.bounces; const e2 = each();
  play(sim, pad, 14, { each: (t) => { if (t > 0.1) e2(t); else lastV = { ...sim.sh.v }; } });
  console.log(`${body.padEnd(8)} low ${secs} s: bounces ${low.b}, largest step ${f2(low.maxDv)} m/s (vertical ${f2(low.maxDvUp)}) at ${f2(low.tMax)} s, lowest ${f2(low.minHard)} m over the ground, over a tree top ${low.tree === Infinity ? '-' : f2(low.tree)}, |vUp| max ${f2(low.maxUp)}, top speed ${f2(low.vmaxSeen)} | dive: bounces ${sim.sh.bounces - b0}, largest step ${f2(maxDv)} (vertical ${f2(maxDvUp)}), lowest ${f2(minHard)} m, speed after ${f2(sim.sh.speed)}`);
  tot.bounces += low.b + sim.sh.bounces - b0; tot.worst = Math.max(tot.worst, low.maxDv, maxDv);
}
console.log(`all: bounces ${tot.bounces}, largest step ${f2(tot.worst)} m/s`);
