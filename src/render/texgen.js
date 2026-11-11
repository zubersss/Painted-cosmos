// Painted Cosmos: procedural texture data (pure JS, no three). OWNER: PAINTER.
// Everything a wash, a stroke or the paper needs is generated here once at start-up into plain
// typed arrays, so the shaders only ever do cheap texture fetches (no per-pixel fbm).
// All patterns tile seamlessly.

import { mulberry32 } from '../world/noise.js';

// Periodic gradient noise: lattice period (px, py, pz) in cells. Returns about [-1, 1].
function makePeriodic(seed) {
  const rnd = mulberry32(seed);
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; const t = p[i]; p[i] = p[j]; p[j] = t; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const GX = [1, -1, 1, -1, 1, -1, 1, -1, 0, 0, 0, 0, 1, 0, -1, 0];
  const GY = [1, 1, -1, -1, 0, 0, 0, 0, 1, -1, 1, -1, 1, -1, 1, -1];
  const GZ = [0, 0, 0, 0, 1, 1, -1, -1, 1, 1, -1, -1, 0, 1, 0, -1];
  function g(ix, iy, iz, x, y, z) {
    const h = perm[perm[perm[ix] + iy] + iz] & 15;
    return GX[h] * x + GY[h] * y + GZ[h] * z;
  }
  return function n3p(x, y, z, px, py, pz) {
    const fx = Math.floor(x), fy = Math.floor(y), fz = Math.floor(z);
    const x0 = ((fx % px) + px) % px, y0 = ((fy % py) + py) % py, z0 = ((fz % pz) + pz) % pz;
    const x1 = (x0 + 1) % px, y1 = (y0 + 1) % py, z1 = (z0 + 1) % pz;
    x -= fx; y -= fy; z -= fz;
    const u = x * x * x * (x * (x * 6 - 15) + 10), v = y * y * y * (y * (y * 6 - 15) + 10), w = z * z * z * (z * (z * 6 - 15) + 10);
    const a = g(x0, y0, z0, x, y, z), b = g(x1, y0, z0, x - 1, y, z);
    const c = g(x0, y1, z0, x, y - 1, z), d = g(x1, y1, z0, x - 1, y - 1, z);
    const e = g(x0, y0, z1, x, y, z - 1), f = g(x1, y0, z1, x - 1, y, z - 1);
    const gg = g(x0, y1, z1, x, y - 1, z - 1), hh = g(x1, y1, z1, x - 1, y - 1, z - 1);
    const ab = a + u * (b - a), cd = c + u * (d - c), ef = e + u * (f - e), gh = gg + u * (hh - gg);
    const abcd = ab + v * (cd - ab), efgh = ef + v * (gh - ef);
    return (abcd + w * (efgh - abcd)) * 1.05;
  };
}

function to8(v) { v = v * 255; return v < 0 ? 0 : v > 255 ? 255 : v | 0; }

// 3D tiling noise, RGBA8, size^3.
//  R: soft wash turbulence (3 octaves from 4 cells)     G: the same, decorrelated
//  B: finer breakup (from 8 cells)                       A: billowy "cauliflower" field
export function genNoise3D(size = 64) {
  const n = makePeriodic(1337), m = makePeriodic(4242);
  const data = new Uint8Array(size * size * size * 4);
  let k = 0;
  const inv = 1 / size;
  for (let z = 0; z < size; z++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x * inv, v = y * inv, w = z * inv;
        const r = n(u * 4, v * 4, w * 4, 4, 4, 4) * 0.58 + n(u * 8 + 3.3, v * 8, w * 8, 8, 8, 8) * 0.28 + n(u * 16, v * 16 + 1.7, w * 16, 16, 16, 16) * 0.14;
        const g = m(u * 4 + 0.5, v * 4, w * 4, 4, 4, 4) * 0.58 + m(u * 8, v * 8 + 5.1, w * 8, 8, 8, 8) * 0.28 + m(u * 16, v * 16, w * 16 + 2.9, 16, 16, 16) * 0.14;
        const b = n(u * 8 + 9.5, v * 8 + 2.5, w * 8, 8, 8, 8) * 0.6 + m(u * 16 + 4.5, v * 16, w * 16, 16, 16, 16) * 0.4;
        const a = 1 - Math.abs(m(u * 4, v * 4 + 7.5, w * 4 + 1.5, 4, 4, 4)) * 1.5 - Math.abs(n(u * 8, v * 8, w * 8 + 6.5, 8, 8, 8)) * 0.5;
        data[k++] = to8(0.5 + r * 0.72); data[k++] = to8(0.5 + g * 0.72); data[k++] = to8(0.5 + b * 0.62); data[k++] = to8(a * 0.9 + 0.1);
      }
    }
  }
  return data;
}

// 2D tiling stroke atlas, RGBA8, size^2 (one tile).
//  R: dry-brush streaks running along u (broken, fibrous)
//  G: dabs / stipple: scattered soft blobs of varied size (leafy brush touches)
//  B: fine isotropic grain
//  A: cellular distance field (crackle, backrun edges)
export function genStrokes(size = 256) {
  const n = makePeriodic(777), m = makePeriodic(999);
  const data = new Uint8Array(size * size * 4);
  const rnd = mulberry32(2024);
  // dabs
  const dabs = new Float32Array(size * size);
  const count = 260;
  for (let i = 0; i < count; i++) {
    const cx = rnd() * size, cy = rnd() * size;
    const rx = (3 + rnd() * rnd() * 16) * (size / 256), ry = rx * (0.45 + rnd() * 0.5);
    const ang = rnd() * Math.PI, ca = Math.cos(ang), sa = Math.sin(ang);
    const s = 0.55 + rnd() * 0.45;
    const R = Math.ceil(Math.max(rx, ry)) + 1;
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const px = dx * ca + dy * sa, py = -dx * sa + dy * ca;
        const d = Math.sqrt((px * px) / (rx * rx) + (py * py) / (ry * ry));
        if (d >= 1) continue;
        const X = (((Math.round(cx) + dx) % size) + size) % size, Y = (((Math.round(cy) + dy) % size) + size) % size;
        const v = s * (1 - d * d);
        if (v > dabs[Y * size + X]) dabs[Y * size + X] = v;
      }
    }
  }
  // cells: scattered points of uneven spacing (a jittered grid with a quarter of its points
  // left out), so the polygons differ in size and never read as a honeycomb
  const cells = 11;
  const cp = [];
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) cp.push(rnd() < 0.26 ? null : [(i + 0.02 + rnd() * 0.96) / cells, (j + 0.02 + rnd() * 0.96) / cells]);
  let k = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      // streaks: long along u, thin across v
      let st = n(u * 3, v * 40, 0.5, 3, 40, 4) * 0.55 + n(u * 6 + 2.1, v * 90, 1.5, 6, 90, 4) * 0.30 + m(u * 12, v * 28, 2.5, 12, 28, 4) * 0.25;
      st = 0.5 + st * 0.95;
      const gr = 0.5 + (n(u * 16, v * 16, 3.5, 16, 16, 4) * 0.55 + m(u * 40, v * 40, 4.5, 40, 40, 4) * 0.45) * 0.8;
      // nearest cell points (tiling), on coordinates bent by a slow noise so no edge is straight
      const uw = u + n(u * 5 + 0.5, v * 5, 7.5, 5, 5, 4) * 0.022 + m(u * 13, v * 13 + 0.5, 8.5, 13, 13, 4) * 0.008;
      const vw = v + m(u * 5, v * 5 + 0.5, 9.5, 5, 5, 4) * 0.022 + n(u * 13 + 0.5, v * 13, 10.5, 13, 13, 4) * 0.008;
      const ci = Math.floor(uw * cells), cj = Math.floor(vw * cells);
      let d1 = 9, d2 = 9;
      for (let oj = -2; oj <= 2; oj++) for (let oi = -2; oi <= 2; oi++) {
        const ii = (((ci + oi) % cells) + cells) % cells, jj = (((cj + oj) % cells) + cells) % cells;
        const c = cp[jj * cells + ii];
        if (!c) continue;
        let dx = Math.abs(c[0] - uw), dy = Math.abs(c[1] - vw);
        dx -= Math.floor(dx); dy -= Math.floor(dy);
        if (dx > 0.5) dx = 1 - dx; if (dy > 0.5) dy = 1 - dy;
        const d = Math.sqrt(dx * dx + dy * dy) * cells;
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
      }
      data[k++] = to8(st); data[k++] = to8(dabs[y * size + x]); data[k++] = to8(gr); data[k++] = to8((d2 - d1) * 1.2);
    }
  }
  return data;
}

// Paper, RGBA8, size^2 (one tile, 1 texel = 1 pixel at 1080p).
//  R: cold-press height (bumps + fibres + fine tooth)   G: slow blotches (uneven sizing)
//  B, A: a smooth vector field used to wobble edges
export function genPaper(size = 512) {
  const n = makePeriodic(31415), m = makePeriodic(27182);
  const data = new Uint8Array(size * size * 4);
  const L = 128, lo = new Float32Array(L * L * 3);
  for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
    const u = x / L, v = y / L;
    lo[(y * L + x) * 3] = n(u * 5, v * 5, 0.5, 5, 5, 4) * 0.6 + m(u * 11, v * 11, 1.5, 11, 11, 4) * 0.4;
    lo[(y * L + x) * 3 + 1] = m(u * 6 + 0.5, v * 6, 2.5, 6, 6, 4) * 0.7 + n(u * 13, v * 13, 3.5, 13, 13, 4) * 0.3;
    lo[(y * L + x) * 3 + 2] = n(u * 6, v * 6 + 0.5, 4.5, 6, 6, 4) * 0.7 + m(u * 13, v * 13, 5.5, 13, 13, 4) * 0.3;
  }
  function lof(u, v, c) {
    const fx = u * L, fy = v * L, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const X0 = x0 % L, X1 = (x0 + 1) % L, Y0 = y0 % L, Y1 = (y0 + 1) % L;
    const a = lo[(Y0 * L + X0) * 3 + c], b = lo[(Y0 * L + X1) * 3 + c], cc = lo[(Y1 * L + X0) * 3 + c], d = lo[(Y1 * L + X1) * 3 + c];
    return (a + (b - a) * tx) + ((cc + (d - cc) * tx) - (a + (b - a) * tx)) * ty;
  }
  let k = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      // cold-press: rounded bumps about 5 px across, with finer tooth and a few long fibres
      // pressed hills with isolated pits between them (pigment settles in the pits)
      const b1 = n(u * 100, v * 100, 0.5, 100, 100, 4) + 0.45 * m(u * 180, v * 180, 6.5, 180, 180, 4);
      const pit = Math.min(1, Math.max(0, (b1 - 0.12) / 0.5));
      const bumps = 0.62 - pit * pit * (3 - 2 * pit) * 1.1;
      const tooth = m(u * 230, v * 230, 1.5, 230, 230, 4);
      const fib = Math.pow(Math.max(0, 1 - Math.abs(n(u * 14, v * 120, 2.5, 14, 120, 4)) * 3.2), 3) * 0.5
        + Math.pow(Math.max(0, 1 - Math.abs(m(u * 110, v * 12, 3.5, 110, 12, 4)) * 3.2), 3) * 0.5;
      const h = 0.5 + (bumps - 0.35) * 0.48 + tooth * 0.14 + fib * 0.20 + lof(u, v, 0) * 0.10;
      data[k++] = to8(h); data[k++] = to8(0.5 + lof(u, v, 0) * 0.85); data[k++] = to8(0.5 + lof(u, v, 1) * 0.85); data[k++] = to8(0.5 + lof(u, v, 2) * 0.85);
    }
  }
  return data;
}
