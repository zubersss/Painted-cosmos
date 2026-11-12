// Where the ship waits at every spawn and biome stand (teleport to the place, as the tour does):
// the lowest of five hull points (middle, 4.5 m fore, aft, port, starboard) above a liquid's still
// level ("dry" when there is no liquid there), and how many stands put it under 1.2 m (in the surf).
// node berth.mjs [root]
const root = (process.argv[2] || new URL('../../../../', import.meta.url).pathname).replace(/\/$/, '');
const { Sim } = await import(root + '/src/core/sim.js');
const surface = await import(root + '/src/world/surface.js');
const obstacles = await import(root + '/src/world/obstacles.js');
const { getLook } = await import(root + '/src/data/looks.js');
const { BODY_IDS } = await import(root + '/src/data/bodies.js');
const ss = (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z);
let wetCount = 0, total = 0; const rows = [];
for (const id of BODY_IDS) {
  const sim = new Sim({ sampleSurface: ss, getSpawn: (b) => surface.getSurface(b).getSpawn(), sampleObstacles: (b, d, r) => obstacles.sampleObstaclesPure(b, d.x, d.y, d.z, r), body: id });
  const places = [['spawn', null]];
  for (const b of getLook(id).biomes || []) { const st = surface.getStandPure(id, b.id); if (st && st.unitDir) places.push([b.id, st.unitDir]); }
  for (const [name, u] of places) {
    sim.teleport(u ? { body: id, dir: [u.x, u.y, u.z] } : { body: id });
    const R = Math.hypot(sim.sh.p.x, sim.sh.p.y, sim.sh.p.z), d = { x: sim.sh.p.x / R, y: sim.sh.p.y / R, z: sim.sh.p.z / R };
    let ex = d.z, ez = -d.x; const el = Math.hypot(ex, ez) || 1; ex /= el; ez /= el;
    const n = { x: d.y * ez, y: d.z * ex - d.x * ez, z: -d.y * ex };
    let low = Infinity;
    for (const [a, b] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = 4.5 / R, q = { x: d.x + (ex * a + n.x * b) * k, y: d.y + n.y * b * k, z: d.z + (ez * a + n.z * b) * k }, ql = Math.hypot(q.x, q.y, q.z);
      const s = ss(id, { x: q.x / ql, y: q.y / ql, z: q.z / ql });
      if (s.liquidRadius > 0) low = Math.min(low, s.radius - s.liquidRadius);
    }
    total++; if (low < 1.2) { wetCount++; rows.push(`${id}/${name} ${low.toFixed(2)} m`); }
  }
}
console.log(`ship berths at ${total} places; ${wetCount} stand less than 1.2 m over a liquid's still level:`, rows.join(', ') || 'none');
