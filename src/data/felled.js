// Painted Cosmos: the trees the explorer's wind has felled (the powers, the wind knife; docs/POWERS.md).
// OWNER: PAINTER / PILOT. Pure (no three, no page): the tests load it in Node.
//
// One small list, read by both sides of the game:
//   the play code fells a tree (core/powers.js) and keeps the list in the saved game (core/save.js);
//   the world lays a felled tree down where it stood (world/flora.js) and takes its trunk out of what the explorer
//   and the ship bump into (world/obstacles.js).
// A tree is named by its own place in the placement data (world/floraplace.js: the same three numbers wherever that
// tree is listed: its near patch, its far patch, the obstacles), so nothing has to be searched to know it again.
// With nothing ever felled the list is empty, and every reader makes one comparison (FELLED.size) and nothing else.

export const FELL = Object.freeze({
  time: 1.5,          // s: how long a tree takes to fall
  angle: 1.5,         // rad: how far it turns about its foot (a little short of lying flat: its crown rests on the ground)
  max: 400,           // trees kept (the oldest is forgotten first: it stands again)
});

const M = new Map();
// version: goes up with every change (the trees' renderer compares it); size: how many are felled
export const FELLED = { version: 0, get size() { return M.size; } };

const keyOf = (bodyId, x, y, z) => bodyId + '|' + x + '|' + y + '|' + z;

// Fells the tree that stands at (x, y, z) on a body (its place in the placement data, body-local), to fall along
// (dx, dy, dz). wait (s): how long before it begins to fall (the blade is still on its way).
// Returns the record, or null when that tree is already felled.
export function fellTree(bodyId, x, y, z, dx, dy, dz, wait = 0) {
  const k = keyOf(bodyId, x, y, z);
  if (M.has(k)) return null;
  const l = Math.hypot(dx, dy, dz) || 1;
  const F = { bodyId, x, y, z, dx: dx / l, dy: dy / l, dz: dz / l, f: -Math.max(0, wait) / FELL.time };
  M.set(k, F);
  if (M.size > FELL.max) M.delete(M.keys().next().value);
  FELLED.version++;
  return F;
}

// The record of the tree at that place, or null. f: how far its fall has gone (below 0: not begun; 1: it lies).
export function felledAt(bodyId, x, y, z) { return M.size ? M.get(keyOf(bodyId, x, y, z)) || null : null; }

// The felled trees of one body that are still falling, into `out`.
export function fallingOn(bodyId, out = []) {
  out.length = 0;
  for (const F of M.values()) if (F.bodyId === bodyId && F.f < 1) out.push(F);
  return out;
}

// How a felled tree is turned from standing: a turn about the level line across its fall, through its foot.
// (ux, uy, uz): up at the tree (unit); F: its record. Fills out[0..3] with the quaternion x, y, z, w.
export function fallTurn(ux, uy, uz, F, out) {
  // the fall's own direction, level at the tree
  const k = F.dx * ux + F.dy * uy + F.dz * uz;
  let fx = F.dx - ux * k, fy = F.dy - uy * k, fz = F.dz - uz * k;
  const fl = Math.hypot(fx, fy, fz);
  if (fl < 1e-6) { out[0] = 0; out[1] = 0; out[2] = 0; out[3] = 1; return out; }
  fx /= fl; fy /= fl; fz /= fl;
  // the axis: up x fall (a turn about it carries "up" toward the fall)
  const ax = uy * fz - uz * fy, ay = uz * fx - ux * fz, az = ux * fy - uy * fx;
  const p = F.f <= 0 ? 0 : F.f >= 1 ? 1 : F.f;
  const a = FELL.angle * p * p;                    // it goes over slowly and comes down fast
  const s = Math.sin(a * 0.5);
  out[0] = ax * s; out[1] = ay * s; out[2] = az * s; out[3] = Math.cos(a * 0.5);
  return out;
}

// For the saved game: the list as plain rows, and back. A tree that comes back from a save lies (f = 1).
export function felledRows() { return [...M.values()].map((F) => [F.bodyId, F.x, F.y, F.z, +F.dx.toFixed(4), +F.dy.toFixed(4), +F.dz.toFixed(4)]); }
export function felledLoad(rows) {
  M.clear();
  if (Array.isArray(rows)) {
    for (const r of rows.slice(-FELL.max)) {
      if (!Array.isArray(r) || typeof r[0] !== 'string') continue;
      let ok = true; for (let i = 1; i < 7; i++) if (typeof r[i] !== 'number' || !Number.isFinite(r[i])) ok = false;
      if (!ok) continue;
      M.set(keyOf(r[0], r[1], r[2], r[3]), { bodyId: r[0], x: r[1], y: r[2], z: r[3], dx: r[4], dy: r[5], dz: r[6], f: 1 });
    }
  }
  FELLED.version++;
}
