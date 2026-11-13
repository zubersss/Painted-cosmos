import { getSurface, getVistasPure } from '/home/user/painted-cosmos/src/world/surface.js';
import { BODIES } from '/home/user/painted-cosmos/src/data/bodies.js';
for (const id of Object.keys(BODIES)) {
  if (!BODIES[id].radius || id === 'sun') continue;
  let S; try { S = getSurface(id); } catch (e) { continue; }
  const sp = S.getSpawn(); const l = Math.hypot(sp.x, sp.y, sp.z);
  const vs = getVistasPure(id);
  let best = Infinity, name = '';
  for (const v of vs) { const d = v.unitDir; const ang = Math.acos(Math.max(-1, Math.min(1, (d.x * sp.x + d.y * sp.y + d.z * sp.z) / l / Math.hypot(d.x, d.y, d.z)))); const m = ang * BODIES[id].radius; if (m < best) { best = m; name = v.name; } }
  console.log(id.padEnd(8), 'vistas', vs.length, 'nearest to the spawn', (best / 1000).toFixed(2), 'km', name);
}
