// Painted Cosmos: solid things standing on the ground (pure JS, no three). OWNER: PAINTER.
// Trees and boulders are not part of sampleSurface; this gives the game their trunks and
// stones near a point so it can collide with them. It shares the placement cells (and their
// cache) with the flora renderer, so what you bump into is exactly what is painted.
import { placeTrees, placeUnder, INST_STRIDE, U_ROCK, U_BUSH } from './floraplace.js';
import { getSurface } from './surface.js';
import { dirToFace } from './cubesphere.js';

export const TREE_LEVEL = 7, UNDER_LEVEL = 8, TREE_GRID = 9, UNDER_GRID = 17;

const caches = { t: new Map(), u: new Map() };
function cell(kind, S, face, ix, iy) {
  const c = caches[kind], key = S.id + ':' + face + ':' + ix + ':' + iy;
  let v = c.get(key);
  if (v) { c.delete(key); c.set(key, v); return v; }     // refresh LRU order
  v = kind === 't' ? placeTrees(S, face, TREE_LEVEL, ix, iy, TREE_GRID) : placeUnder(S, face, UNDER_LEVEL, ix, iy, UNDER_GRID);
  c.set(key, v);
  if (c.size > (kind === 't' ? 1400 : 700)) c.delete(c.keys().next().value);      // (the tiers reach farther now: more cells are alive at once)
  return v;
}
export function treeCell(S, face, ix, iy) { return cell('t', S, face, ix, iy); }
export function hasCell(kind, S, face, ix, iy) { return caches[kind].has(S.id + ':' + face + ':' + ix + ':' + iy); }
export function underCell(S, face, ix, iy) { return cell('u', S, face, ix, iy); }

const _f = {};
function cellsAround(S, x, y, z, radius, level, out) {
  // the cells touched by a disc: test the centre and eight points on its rim
  const R = S.R, n = 1 << level;
  let ux, uy, uz;
  if (Math.abs(y) < 0.9) { ux = -z; uy = 0; uz = x; } else { ux = 0; uy = z; uz = -y; }
  let l = 1 / Math.hypot(ux, uy, uz); ux *= l; uy *= l; uz *= l;
  const vx = y * uz - z * uy, vy = z * ux - x * uz, vz = x * uy - y * ux;
  out.length = 0;
  const seen = new Set();
  for (let k = 0; k < 9; k++) {
    const a = k * Math.PI / 4, r = k === 8 ? 0 : radius / R;
    let px = x + (ux * Math.cos(a) + vx * Math.sin(a)) * r, py = y + (uy * Math.cos(a) + vy * Math.sin(a)) * r, pz = z + (uz * Math.cos(a) + vz * Math.sin(a)) * r;
    l = 1 / Math.hypot(px, py, pz);
    dirToFace(px * l, py * l, pz * l, _f);
    const ix = Math.min(n - 1, Math.max(0, Math.floor((_f.u + 1) * 0.5 * n))), iy = Math.min(n - 1, Math.max(0, Math.floor((_f.v + 1) * 0.5 * n)));
    const key = _f.face * 1e8 + ix * 1e4 + iy;
    if (!seen.has(key)) { seen.add(key); out.push(_f.face, ix, iy); }
  }
  return out;
}

const _cells = [];
// -> [{ unitDir: {x,y,z}, radius (m), height (m), kind: 'tree' | 'rock' }] within `radius` metres
// soft === true also lists bushes (kind 'bush'): nothing to collide with, but in the way of a view
export function sampleObstaclesPure(bodyId, dx, dy, dz, radius, soft) {
  const S = getSurface(bodyId);
  const res = [];
  if (!S.hasFlora && !S.biomes.some((b) => b.small)) return res;
  const specs = (S.look.flora && S.look.flora.tall) || [];
  const il = 1 / Math.hypot(dx, dy, dz), x = dx * il, y = dy * il, z = dz * il;
  const rad = Math.min(60, Math.max(0.5, radius || 3));
  const R = S.R, r2 = (rad / R) * (rad / R) * 1.02;
  const add = (data, o, r, h, kind) => {
    const px = data[o], py = data[o + 1], pz = data[o + 2], pl = 1 / Math.hypot(px, py, pz);
    const ex = px * pl - x, ey = py * pl - y, ez = pz * pl - z;
    if (ex * ex + ey * ey + ez * ez > r2) return;
    res.push({ unitDir: { x: px * pl, y: py * pl, z: pz * pl }, radius: r, height: h, kind });
  };
  cellsAround(S, x, y, z, rad, TREE_LEVEL, _cells);
  for (let i = 0; i < _cells.length; i += 3) {
    const t = treeCell(S, _cells[i], _cells[i + 1], _cells[i + 2]);
    for (let k = 0; k < t.count; k++) {
      const o = k * INST_STRIDE, sc = t.data[o + 3], sp = specs[t.data[o + 5]], ob = (sp && sp.obs) || [0.3, 10], ks = (sp && sp.scale) || 1;
      if (sp && sp.noObs) continue;                  // trailing plants: nothing to bump into
      add(t.data, o, ob[0] * sc / ks, ob[1] * sc / ks, 'tree');
    }
  }
  if (rad <= 30) {
    cellsAround(S, x, y, z, rad, UNDER_LEVEL, _cells);
    for (let i = 0; i < _cells.length; i += 3) {
      const t = underCell(S, _cells[i], _cells[i + 1], _cells[i + 2]);
      for (let k = 0; k < t.count; k++) {
        const o = k * INST_STRIDE;
        if (soft && t.data[o + 5] === U_BUSH) { add(t.data, o, 0.9 * t.data[o + 3], 1.3 * t.data[o + 3], 'bush'); continue; }
        if (t.data[o + 5] !== U_ROCK) continue;
        const sc = t.data[o + 3];
        if (sc < 0.7) continue;                       // small stones are stepped over
        // (the drawn boulder: a blob 0.78 of its scale high, sunk 0.2 to 0.25 of it: its top stands
        // 0.53 to 0.58 of the scale over the ground beside it; the largest is about 1.2 m)
        add(t.data, o, 0.62 * sc, 0.58 * sc, 'rock');
      }
    }
  }
  return res;
}
