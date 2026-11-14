// The world's own arrival on every body: how far the explorer was stepped, the room round the feet,
// the turn of the view, and what lies on the boom. Root as argv[2].
const root = (process.argv[2] || new URL('../../../../', import.meta.url).pathname).replace(/\/$/, '');
const { Sim } = await import(root + '/src/core/sim.js');
const surface = await import(root + '/src/world/surface.js');
const obstacles = await import(root + '/src/world/obstacles.js');
const { BODY_IDS } = await import(root + '/src/data/bodies.js');
const ss = (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z);
const so = (id, d, r) => obstacles.sampleObstaclesPure(id, d.x, d.y, d.z, r);
for (const id of BODY_IDS) {
  const sim = new Sim({ sampleSurface: ss, getSpawn: (b) => surface.getSurface(b).getSpawn(), sampleObstacles: so, body: id });
  const sp = surface.getSurface(id).getSpawn(), R = Math.hypot(sim.ex.p.x, sim.ex.p.y, sim.ex.p.z);
  const l = Math.hypot(sp.x, sp.y, sp.z), u = { x: sim.ex.p.x / R, y: sim.ex.p.y / R, z: sim.ex.p.z / R };
  const moved = Math.hypot(u.x - sp.x / l, u.y - sp.y / l, u.z - sp.z / l) * R;
  const obs = so(id, u, 12);
  let room = Infinity; for (const o of obs) room = Math.min(room, Math.hypot(o.unitDir.x - u.x, o.unitDir.y - u.y, o.unitDir.z - u.z) * R - o.radius);
  const toShip = { x: sim.sh.p.x - sim.ex.p.x, y: sim.sh.p.y - sim.ex.p.y, z: sim.sh.p.z - sim.ex.p.z };
  const vf = sim.footCam.viewFwd, ts = Math.hypot(toShip.x, toShip.y, toShip.z);
  const ang = Math.acos(Math.max(-1, Math.min(1, (vf.x * toShip.x + vf.y * toShip.y + vf.z * toShip.z) / ts))) ;
  console.log(id.padEnd(8), 'moved', moved.toFixed(1), 'm; room', room === Infinity ? 'clear' : room.toFixed(2), 'm; ship', ts.toFixed(1), 'm at', ang.toFixed(2), 'rad from the view; biome', ss(id, u).biomeId, '; slope', (ss(id, u).slope * 57.3).toFixed(0));
}
