// The landing's chase camera among crowns (Node, the real world): hover the ship `alt` m over a
// place, press E, run to LANDED and 3 s on; every frame, where the camera is against the trees.
// A crown is modelled as a cylinder round the trunk from 0.3 h to 1.05 h, radius max(2, 0.36 h) (camera.js CAMERA).
// node landcam.mjs <root> [body=earth] [place=spawn|lat,lon] [alt=8] [label]
const [root, body = 'earth', place = 'spawn', altS = '8', label = ''] = process.argv.slice(2);
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
let dir;
if (place === 'spawn') { const d = surface.getSurface(body).getSpawn(); dir = [d.x, d.y, d.z]; }
else if (place.includes(',')) { const [la, lo] = place.split(',').map(Number); const a = la * Math.PI / 180, o = lo * Math.PI / 180; dir = [Math.cos(a) * Math.sin(o), Math.sin(a), Math.cos(a) * Math.cos(o)]; }
else { const d = surface.getStandPure(body, place).unitDir; dir = [d.x, d.y, d.z]; }
sim.teleport({ body, dir, ship: true, altitude: +altS, throttle: 0 });
sim.sh.v = { x: 0, y: 0, z: 0 };
const pad = new Pad();
play(sim, pad, 0.5);
pad.tap('KeyE');
const rows = [];
let landedAt = null;
const crownOf = (o) => o.radius >= 0.9 ? { r: o.radius + 0.3, lo: 0, hi: o.height * 1.05 } : ({ r: Math.max(2, 0.32 * o.height), lo: 0.3 * o.height, hi: 1.05 * o.height });
play(sim, pad, 60, { fps: 30, each: () => {}, until: () => {
  const st = sim.sm.state, c = sim.camPose.p, up = V.norm(c), s = ss(body, up), hg = V.len(c) - s.radius;
  const trees = sim.obstaclesNear(body, c, 30).filter((o) => o.height > 3);
  let inside = 0, nearest = 1e9;
  for (const o of trees) {
    const base = V.scale(o.unitDir, ss(body, o.unitDir).radius);
    const d = V.sub(c, base), along = V.len(c) - V.len(base);
    const horiz = Math.sqrt(Math.max(0, V.len(d) ** 2 - along ** 2));
    const k = crownOf(o);
    const out = Math.max(horiz - k.r, k.lo - along, along - k.hi);    // < 0 inside
    nearest = Math.min(nearest, out);
    if (out < 0) inside++;
  }
  const shipD = V.len(V.sub(c, sim.sh.p));
  rows.push({ st, alt: +sim.sh.altGround.toFixed(2), hg: +hg.toFixed(2), canopyH: +(s.canopyHeight || 0).toFixed(1), canopy01: +(s.canopy01 || 0).toFixed(2), inside, nearest: +nearest.toFixed(2), boom: +shipD.toFixed(2), room: sim.shipCam.room == null ? null : +sim.shipCam.room.toFixed(2) });
  if (st === 'LANDED' && landedAt == null) landedAt = rows.length;
  return landedAt != null && rows.length > landedAt + 90;
} });
const inCrown = rows.filter((r) => r.inside > 0).length;
let jump = 0; for (let i = 1; i < rows.length; i++) jump = Math.max(jump, Math.abs(rows[i].boom - rows[i - 1].boom));
console.log(label, body, place, 'frames', rows.length, 'landed at', landedAt, 'frames with the camera in a crown', inCrown, 'boom', Math.min(...rows.map((r) => r.boom)).toFixed(1), '..', Math.max(...rows.map((r) => r.boom)).toFixed(1), 'largest boom step a frame', jump.toFixed(2), 'nearest crown (min)', Math.min(...rows.map((r) => r.nearest)).toFixed(2));
if (process.env.ALL) rows.forEach((r, i) => r.inside && console.log("   in", i, JSON.stringify(r)));
for (let i = 0; i < rows.length; i += Math.max(1, Math.floor(rows.length / 14))) console.log('  ', i, JSON.stringify(rows[i]));
