// Many forest landings (Node, the real world): N spots round a body's spawn where the canopy is
// closed (canopy01 > 0.4), hover 25 m, press E, run to LANDED + 3 s; count frames with the chase
// camera in a crown (camera.js's model, written out here so the head can be measured too) and the
// largest boom change in a frame. node landsurvey.mjs <root> [body=earth] [N=16]
const [root, body = 'earth', N = '16'] = process.argv.slice(2);
const { Sim } = await import(root + '/src/core/sim.js');
const surface = await import(root + '/src/world/surface.js');
const obstacles = await import(root + '/src/world/obstacles.js');
const P = await import(root + '/src/physics/index.js');
const { Pad, play } = await import(root + '/tests/helpers.mjs');
const V = await import(root + '/src/core/vec.js');
const ss = (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z);
const sp = surface.getSurface(body).getSpawn(), R = ss(body, sp).radius;
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const spots = [];
for (let n = 0; spots.length < +N && n < 5000; n++) {
  const d = V.norm({ x: sp.x + (rnd() - 0.5) * 1200 / R, y: sp.y + (rnd() - 0.5) * 1200 / R, z: sp.z + (rnd() - 0.5) * 1200 / R });
  const s = ss(body, d); if ((s.canopy01 || 0) > 0.4 && !s.isLiquid && s.slope < 0.3) spots.push(d);
}
const crown = (o, c) => {
  const base = V.scale(o.unitDir, ss(body, o.unitDir).radius), d = V.sub(c, base), along = V.len(c) - V.len(base);
  const horiz = Math.sqrt(Math.max(0, V.len(d) ** 2 - along ** 2));
  const k = o.radius >= 0.9 ? { r: o.radius + 0.3, lo: 0, hi: o.height * 1.05 } : { r: Math.max(2, 0.32 * o.height), lo: 0.3 * o.height, hi: 1.05 * o.height };
  return Math.max(horiz - k.r, k.lo - along, along - k.hi);
};
let tot = 0, totIn = 0, worstStep = 0, landed = 0, deep = 0, low = 0, lowIn = 0;
for (const d of spots) {
  const physics = P.createPhysics({ sampleSurface: ss, seed: 1 });
  const sim = new Sim({ sampleSurface: ss, getSpawn: (id) => surface.getSurface(id).getSpawn(), sampleObstacles: (id, u, r) => obstacles.sampleObstaclesPure(id, u.x, u.y, u.z, r), physics, body });
  sim.t = 30;
  sim.teleport({ body, dir: [d.x, d.y, d.z], ship: true, altitude: 25, throttle: 0 }); sim.sh.v = { x: 0, y: 0, z: 0 };
  const pad = new Pad(); play(sim, pad, 0.5); pad.tap('KeyE');
  let n = 0, nin = 0, prev = null, at = null, worst = 0;
  play(sim, pad, 60, { fps: 30, until: () => {
    const c = sim.camPose.p; n++;
    const trees = sim.obstaclesNear(body, c, 25).filter((o) => o.height > 4);
    let m = 1e9; for (const o of trees) m = Math.min(m, crown(o, c));
    const lowNow = sim.sm.state === 'LANDED' || sim.sh.altGround < 3; if (lowNow) low++;
    if (m < 0) { nin++; worst = Math.min(worst, m); if (lowNow) lowIn++; }
    const b = V.len(V.sub(c, sim.sh.p)); if (prev != null) worstStep = Math.max(worstStep, Math.abs(b - prev)); prev = b;
    if (sim.sm.state === 'LANDED' && at == null) at = n;
    return at != null && n > at + 90;
  } });
  if (process.env.EACH) console.log("  spot", spots.indexOf(d), "frames", n, "in", nin, "worst", worst.toFixed(2), "boom now", prev.toFixed(1), "room", sim.shipCam.room, "short", sim.shipCam.short);
  if (at != null) landed++;
  tot += n; totIn += nin; deep = Math.min(deep, worst);
}
console.log(root.split('/').pop(), body, 'spots', spots.length, 'landed', landed, 'frames', tot, 'in a crown', totIn, '(of which in the last 3 m and landed', lowIn, 'of', low + ')', 'deepest', deep.toFixed(2), 'm, largest boom step a frame', worstStep.toFixed(2));
