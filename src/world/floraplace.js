// Painted Cosmos: where the flora grows (pure JS, no three). OWNER: PAINTER.
// Deterministic placement on jittered grids inside cube-sphere cells. The same cell always
// yields the same plants, independent of LOD or of the order in which cells are built.
import { faceToDir } from './cubesphere.js';
import { makeSample, NOLQ } from './surface.js';
import { hash3i, smoothstep, clamp } from './noise.js';

// kinds
export const K_BIRCH = 0, K_PINE = 1, K_BIRCH_AUTUMN = 2;
export const U_GRASS = 0, U_FERN = 1, U_BUSH = 2, U_ROCK = 3, U_FLOWER = 4, U_STONE = 5, U_REED = 6, U_SHARD = 7;
const SMALL = [['grass', U_GRASS], ['fern', U_FERN], ['bush', U_BUSH], ['rock', U_ROCK], ['flower', U_FLOWER], ['reed', U_REED], ['shard', U_SHARD]];

const STRIDE = 12;   // x y z (body-local position), scale, yaw, kind, variant, seed, hue, value, canopy, lean
export const INST_STRIDE = STRIDE;

let _s = null;
const _d = [0, 0, 0];

function cellSeed(face, level, ix, iy, salt) {
  return ((hash3i(ix, iy, face * 31 + level, salt) * 4294967296) | 0);
}

// Trees of one chunk. Returns { count, data } with STRIDE floats per tree.
// Two candidates per grid cell, thinned by a clump field, so trunks gather in groups with
// irregular gaps between them instead of standing in rows.
export function placeTrees(S, face, level, ix, iy, grid) {
  if (!_s || _s.w.length < S.nB) _s = makeSample(S.nB);
  const s = _s, R = S.R;
  const span = 2 / (1 << level), u0 = -1 + ix * span, v0 = -1 + iy * span;
  const seed = cellSeed(face, level, ix, iy, 911);
  const n3 = S.nC.n3, fc = R / 17, fd = R / 52;
  const out = [];
  for (let b = 0; b < grid; b++) {
    for (let a = 0; a < grid; a++) {
      for (let c = 0; c < 2; c++) {
        const k = c * 7;
        const r1 = hash3i(a, b, 1 + k, seed), r2 = hash3i(a, b, 2 + k, seed), r3 = hash3i(a, b, 3 + k, seed), r4 = hash3i(a, b, 4 + k, seed), r5 = hash3i(a, b, 5 + k, seed);
        faceToDir(face, u0 + span * (a + r1) / grid, v0 + span * (b + r2) / grid, _d);
        const x = _d[0], y = _d[1], z = _d[2];
        const clump = smoothstep(-0.30, 0.22, n3(x * fc + 3.3, y * fc - 8.1, z * fc + 1.7) + 0.45 * n3(x * fd - 5.0, y * fd, z * fd + 9.0));
        if (r3 >= 0.62 * (0.14 + 0.86 * clump)) continue;
        S.sample(x, y, z, s, true);
        if (r3 >= 0.62 * (0.14 + 0.86 * clump) * s.trees) continue;
        const bi = S.biomes[s.top];
        if (!bi.tall) continue;
        if (!bi.tallWet && s.lq !== NOLQ && s.lq > s.h - 0.15) continue;
        // each species keeps to its own groups: the choice follows the clump field too
        const grove = n3(x * fd + 21.0, y * fd + 4.0, z * fd - 13.0);
        const birch = r4 < clamp(s.birch + grove * 0.55, bi.tall[0] === bi.tall[1] ? 1 : 0.04, bi.tall[0] === bi.tall[1] ? 1 : 0.97);
        const kind = birch ? bi.tall[0] : bi.tall[1];
        const spec = S.look.flora.tall[kind];
        const rr = R + s.h - 0.12;
        const scale = ((birch ? 0.74 : 0.80) + 0.56 * r5 * r5 + 0.12 * s.glade) * (spec.scale || 1);
        out.push(x * rr, y * rr, z * rr, scale, r1 * 6.2831853, kind, (r2 * 3) | 0, hash3i(a, b, 6 + k, seed),
          (r5 - 0.5) * 2, (r4 - 0.5) * 2 * 0.6, s.canopy, birch ? 0.02 + 0.15 * r2 * r2 : 0.02 * r2);
      }
    }
  }
  // hanging gardens: a third candidate per cell, kept only on the lip of a cliff and turned to
  // face out over the drop
  if (S.hangs) {
    const w = _s.w;
    for (let b = 0; b < grid; b++) {
      for (let a = 0; a < grid * 3; a++) {
        const r1 = hash3i(a, b, 21, seed), r2 = hash3i(a, b, 22, seed), r3 = hash3i(a, b, 23, seed), r5 = hash3i(a, b, 25, seed);
        faceToDir(face, u0 + span * (a + r1) / (grid * 3), v0 + span * (b + r2) / grid, _d);
        const x = _d[0], y = _d[1], z = _d[2];
        const bi = S.biomes[S.biomeWeights(x, y, z, w)];
        if (!bi.hang || r3 >= bi.hang.d) continue;
        S.sample(x, y, z, s, true);
        if (s.lip < 0.5) continue;
        // the kit's local axes on the ground (as THREE's setFromUnitVectors(Y, up) lays them)
        const k1 = 1 / (1 + y), ax = y + z * z * k1, ay = -x, az = -x * z * k1, bx = -x * z * k1, by = -z, bz = y + x * x * k1;
        const e = 3 / R;
        const gx = S.heightAt(x + ax * e, y + ay * e, z + az * e) - S.heightAt(x - ax * e, y - ay * e, z - az * e);
        const gz = S.heightAt(x + bx * e, y + by * e, z + bz * e) - S.heightAt(x - bx * e, y - by * e, z - bz * e);
        const rr = R + s.h + 0.2;
        out.push(x * rr, y * rr, z * rr, (0.8 + 0.6 * r5) * (S.look.flora.tall[bi.hang.kit].scale || 1), Math.atan2(-gx, -gz), bi.hang.kit, (r2 * 3) | 0, hash3i(a, b, 26, seed),
          (r5 - 0.5) * 2, (r1 - 0.5) * 1.2, 0, 0);
      }
    }
  }
  return { count: out.length / STRIDE, data: new Float32Array(out) };
}

// Undergrowth of one small cell: grass tufts, ferns, bushes, rocks, flowers, stream stones.
export function placeUnder(S, face, level, ix, iy, grid) {
  if (!_s || _s.w.length < S.nB) _s = makeSample(S.nB);
  const s = _s, R = S.R;
  const span = 2 / (1 << level), u0 = -1 + ix * span, v0 = -1 + iy * span;
  const seed = cellSeed(face, level, ix, iy, 577);
  const out = [];
  for (let b = 0; b < grid; b++) {
    for (let a = 0; a < grid; a++) {
      const r1 = hash3i(a, b, 1, seed), r2 = hash3i(a, b, 2, seed), r3 = hash3i(a, b, 3, seed), r4 = hash3i(a, b, 4, seed), r5 = hash3i(a, b, 5, seed);
      faceToDir(face, u0 + span * (a + 0.05 + 0.9 * r1) / grid, v0 + span * (b + 0.05 + 0.9 * r2) / grid, _d);
      // cheap rejections first (most candidates grow nothing): the biome alone often decides
      const top0 = S.biomeWeights(_d[0], _d[1], _d[2], s.w), b0 = S.biomes[top0];
      let clump = 1;
      if (b0.terrain !== 'forest') {
        if (!b0.small || r4 >= S.smallSum[top0]) continue;
        const fq = R / 21;
        clump = 0.10 + 0.90 * smoothstep(-0.22, 0.24, S.nC.n3(_d[0] * fq + 2.0, _d[1] * fq - 5.0, _d[2] * fq + 9.0));
        if (r3 >= clump) continue;
      }
      S.sample(_d[0], _d[1], _d[2], s, true);
      const bi = S.biomes[s.top];
      const inWater = s.lq !== NOLQ && s.lq > s.h;
      let kind = -1, scale = 1, sink = 0.03;
      if (bi.terrain !== 'forest') {
        // other biomes: a table of densities per kind
        if (!bi.small || inWater) continue;
        if (r3 >= s.under * clump) continue;
        let acc = 0;
        for (let q = 0; q < SMALL.length; q++) {
          const dn = bi.small[SMALL[q][0]];
          if (!dn) continue;
          acc += dn;
          if (r4 < acc) { kind = SMALL[q][1]; break; }
        }
        if (kind < 0) continue;
        scale = kind === U_ROCK ? 0.4 + 1.6 * r5 * r5 : kind === U_SHARD ? 0.6 + 1.6 * r5 * r5 : 0.65 + 0.8 * r5;
        sink = kind === U_ROCK ? 0.2 * scale : 0.04;
        const rr = R + s.h - sink;
        out.push(_d[0] * rr, _d[1] * rr, _d[2] * rr, scale, r2 * 6.2831853, kind, (r1 * 3) | 0, hash3i(a, b, 6, seed), (r5 - 0.5) * 2, (r3 - 0.5) * 1.2, s.canopy, 0.1 * r1);
        continue;
      }
      const edge = s.lq !== NOLQ ? s.lq - s.h : -9;   // > 0 under water
      if (edge > -0.30 && edge < 0.16 && r3 < 0.34 && r4 < 0.62 + 0.3 * Math.sin(r1 * 40)) {
        // reeds crowd the water's edge in clumps
        kind = U_REED; scale = 0.7 + 0.7 * r5; sink = 0.02;
      } else if (inWater) {
        // a few stones break the surface of the stream
        if (r3 < 0.045 && s.lq - s.h < 0.5) { kind = U_STONE; scale = 0.4 + 0.7 * r5; sink = 0.1; }
      } else if (s.rock > 0.35 && r3 < 0.10) { kind = U_ROCK; scale = 0.6 + 1.5 * r5 * r5; sink = 0.25 * scale; }
      else if (s.s < 7 && r3 < 0.010) { kind = U_ROCK; scale = 0.3 + 0.6 * r5; sink = 0.12; }       // bank boulders
      else if (r3 < s.under * 0.62) {
        const damp = s.s < 16 ? 1 - s.s / 16 : 0;
        if (r4 < 0.10 + 0.22 * damp) { kind = U_FERN; scale = 0.7 + 0.7 * r5; }
        else if (r4 < 0.135 + 0.22 * damp && s.trees > 0.25) { kind = U_BUSH; scale = 0.6 + 0.9 * r5; sink = 0.1; }
        else if (r4 > 0.955 - 0.05 * s.glade) { kind = U_FLOWER; scale = 0.7 + 0.6 * r5; }
        else { kind = U_GRASS; scale = 0.65 + 0.8 * r5 + 0.25 * s.glade; }
      }
      if (kind < 0) continue;
      const rr = R + s.h - sink;
      const reed = kind === U_REED;
      out.push(_d[0] * rr, _d[1] * rr, _d[2] * rr, scale, r2 * 6.2831853, kind, (r1 * 3) | 0, hash3i(a, b, 6, seed),
        reed ? -0.2 - 0.8 * r5 : (r5 - 0.5) * 2 + (s.glade - 0.5) * 0.8, reed ? 0.5 + 0.8 * r4 : (r4 - 0.5) * 2 * 0.6, s.canopy, 0.1 * r1);
    }
  }
  return { count: out.length / STRIDE, data: new Float32Array(out) };
}
