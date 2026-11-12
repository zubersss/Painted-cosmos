// sampleObstaclesPure(radius) against the union of many small queries tiling the same disc:
// how many trunks and boulders a large query misses (PAINTER's cellsAround tests 9 points only).
const root = (process.argv[2] || new URL('../../../../', import.meta.url).pathname).replace(/\/$/, '');
const surface = await import(root + '/src/world/surface.js');
const obstacles = await import(root + '/src/world/obstacles.js');
const { BODY_IDS } = await import(root + '/src/data/bodies.js');
const key = (o) => o.unitDir.x.toFixed(7) + ',' + o.unitDir.y.toFixed(7) + ',' + o.unitDir.z.toFixed(7);
for (const id of BODY_IDS) {
  const sp = surface.getSurface(id).getSpawn(); const l = Math.hypot(sp.x, sp.y, sp.z); const d = { x: sp.x / l, y: sp.y / l, z: sp.z / l };
  const R = surface.sampleSurfacePure(id, d.x, d.y, d.z).radius;
  let ex = d.z, ez = -d.x; const el = Math.hypot(ex, ez); ex /= el; ez /= el;
  const n = { x: d.y * ez, y: d.z * ex - d.x * ez, z: -d.y * ex };
  const row = [];
  for (const rad of [9, 20, 30, 45, 80]) {
    const big = obstacles.sampleObstaclesPure(id, d.x, d.y, d.z, rad);
    const all = new Map(), step = 5, small = rad > 30 ? 30 : rad;   // rocks are listed only by queries of 30 m or less
    for (let a = -rad; a <= rad; a += step) for (let b = -rad; b <= rad; b += step) {
      if (Math.hypot(a, b) > rad) continue;
      const q = { x: d.x + (ex * a + n.x * b) / R, y: d.y + (n.y * b) / R, z: d.z + (ez * a + n.z * b) / R }, ql = Math.hypot(q.x, q.y, q.z);
      for (const o of obstacles.sampleObstaclesPure(id, q.x / ql, q.y / ql, q.z / ql, 4)) {
        if (Math.hypot(o.unitDir.x - d.x, o.unitDir.y - d.y, o.unitDir.z - d.z) * R <= rad && (rad <= 30 || o.kind === 'tree')) all.set(key(o), o);
      }
    }
    row.push(`${rad} m: ${big.length}/${all.size}`);
  }
  console.log(id.padEnd(8), row.join('  '));
}
