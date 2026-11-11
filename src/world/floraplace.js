// Painted Cosmos: where the flora grows (pure JS, no three). OWNER: PAINTER.
// Deterministic placement on jittered grids inside cube-sphere cells. The same cell always
// yields the same plants, independent of LOD or of the order in which cells are built.
import { faceToDir } from './cubesphere.js';
import { makeSample, NOLQ } from './surface.js';
import { hash3i } from './noise.js';

// kinds
export const K_BIRCH = 0, K_PINE = 1, K_BIRCH_AUTUMN = 2;
export const U_GRASS = 0, U_FERN = 1, U_BUSH = 2, U_ROCK = 3, U_FLOWER = 4, U_STONE = 5, U_REED = 6;

const STRIDE = 12;   // x y z (body-local position), scale, yaw, kind, variant, seed, hue, value, canopy, lean
export const INST_STRIDE = STRIDE;

let _s = null;
const _d = [0, 0, 0];

function cellSeed(face, level, ix, iy, salt) {
  return ((hash3i(ix, iy, face * 31 + level, salt) * 4294967296) | 0);
}

// Trees of one chunk. Returns { count, data } with STRIDE floats per tree.
export function placeTrees(S, face, level, ix, iy, grid) {
  if (!_s || _s.w.length < S.nB) _s = makeSample(S.nB);
  const s = _s, R = S.R;
  const span = 2 / (1 << level), u0 = -1 + ix * span, v0 = -1 + iy * span;
  const seed = cellSeed(face, level, ix, iy, 911);
  const out = [];
  for (let b = 0; b < grid; b++) {
    for (let a = 0; a < grid; a++) {
      const r1 = hash3i(a, b, 1, seed), r2 = hash3i(a, b, 2, seed), r3 = hash3i(a, b, 3, seed), r4 = hash3i(a, b, 4, seed), r5 = hash3i(a, b, 5, seed);
      faceToDir(face, u0 + span * (a + 0.12 + 0.76 * r1) / grid, v0 + span * (b + 0.12 + 0.76 * r2) / grid, _d);
      S.sample(_d[0], _d[1], _d[2], s, true);
      if (r3 >= s.trees) continue;
      if (s.lq !== NOLQ && s.lq > s.h - 0.15) continue;
      const bi = S.biomes[s.top];
      if (bi.terrain !== 'forest') continue;
      const birch = r4 < s.birch;
      const kind = birch ? (bi.autumn ? K_BIRCH_AUTUMN : K_BIRCH) : K_PINE;
      const rr = R + s.h - 0.12;
      // trees at the edge of a glade or the stream grow a little larger and lean toward the light
      const scale = (birch ? 0.78 : 0.82) + 0.5 * r5 * r5 + 0.12 * s.glade;
      out.push(_d[0] * rr, _d[1] * rr, _d[2] * rr, scale, r1 * 6.2831853, kind, (r2 * 3) | 0, r3 / Math.max(1e-3, s.trees),
        (r5 - 0.5) * 2, (r4 - 0.5) * 2 * 0.6, s.canopy, birch ? 0.03 + 0.07 * r2 : 0.015 * r2);
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
      S.sample(_d[0], _d[1], _d[2], s, true);
      const bi = S.biomes[s.top];
      if (bi.terrain !== 'forest') continue;
      const inWater = s.lq !== NOLQ && s.lq > s.h;
      let kind = -1, scale = 1, sink = 0.03;
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
      out.push(_d[0] * rr, _d[1] * rr, _d[2] * rr, scale, r2 * 6.2831853, kind, (r1 * 3) | 0, hash3i(a, b, 6, seed),
        (r5 - 0.5) * 2 + (s.glade - 0.5) * 0.8, (r4 - 0.5) * 2 * 0.6, s.canopy, 0.1 * r1);
    }
  }
  return { count: out.length / STRIDE, data: new Float32Array(out) };
}
