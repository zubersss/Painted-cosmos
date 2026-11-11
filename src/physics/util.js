// Painted Cosmos physics: small numeric helpers. OWNER: PHYSICS. Pure (no three, no DOM).
// Everything here is allocation-free so it can sit inside hot loops.

export const TAU = Math.PI * 2;
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const mix = (a, b, t) => a + (b - a) * t;
export function smoothstep(a, b, x) {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}
// Fraction to move this step for an exponential approach at `rate` per second (frame-rate free).
export const damp = (rate, dt) => 1 - Math.exp(-rate * dt);
export const finite = (x, fallback = 0) => (Number.isFinite(x) ? x : fallback);

// ---- hashing --------------------------------------------------------------------------------
export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
// Integer lattice hash -> [0, 1).
export function hash3(ix, iy, iz, seed) {
  let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263) ^ Math.imul(iz | 0, 2147483647) ^ Math.imul(seed | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export const hash2 = (a, b, seed) => hash3(a, b, 77, seed);
export const hash1 = (a, seed) => hash3(a, 13, 77, seed);

// Small seeded generator (mulberry32) for particle respawns: deterministic for a given seed.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- value noise, C1 continuous (quintic fade), -1..1 ----------------------------------------
// Value noise is enough here: every use is a slowly varying field (gusts, synoptic variation),
// and it costs 8 hashes with no tables.
export function noise3(x, y, z, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  let fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  fy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  fz = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
  const a = hash3(ix, iy, iz, seed), b = hash3(ix + 1, iy, iz, seed);
  const c = hash3(ix, iy + 1, iz, seed), d = hash3(ix + 1, iy + 1, iz, seed);
  const e = hash3(ix, iy, iz + 1, seed), f = hash3(ix + 1, iy, iz + 1, seed);
  const g = hash3(ix, iy + 1, iz + 1, seed), h = hash3(ix + 1, iy + 1, iz + 1, seed);
  const x0 = a + (b - a) * fx, x1 = c + (d - c) * fx, x2 = e + (f - e) * fx, x3 = g + (h - g) * fx;
  const y0 = x0 + (x1 - x0) * fy, y1 = x2 + (x3 - x2) * fy;
  return (y0 + (y1 - y0) * fz) * 2 - 1;
}
// Two octaves, -1..1.
export function noise3b(x, y, z, seed) {
  return (noise3(x, y, z, seed) + 0.5 * noise3(x * 2.03 + 11.3, y * 2.03 - 4.1, z * 2.03 + 7.7, seed + 19)) / 1.5;
}

// ---- local frame on a sphere -----------------------------------------------------------------
// East and north unit vectors at the unit direction (ux,uy,uz); +Y is the north pole (C1).
// Writes 6 numbers into `o` at offset `i`: east xyz, north xyz. At the poles east is +X.
export function eastNorth(ux, uy, uz, o, i = 0) {
  let ex = uz, ez = -ux;                 // Y x up = (uz, 0, -ux)
  const l = Math.hypot(ex, ez);
  if (l < 1e-9) { ex = 1; ez = 0; } else { ex /= l; ez /= l; }
  o[i] = ex; o[i + 1] = 0; o[i + 2] = ez;
  // north = up x east
  o[i + 3] = uy * ez - uz * 0;
  o[i + 4] = uz * ex - ux * ez;
  o[i + 5] = ux * 0 - uy * ex;
  return o;
}

// ---- damped oscillator, exact step ------------------------------------------------------------
// x'' + 2 z w x' + w^2 x = w^2 target, with `target` held constant over the step.
// The closed-form solution is used instead of an Euler step, so it is unconditionally stable and
// exact at any dt (60 Hz, 20 Hz, or a 0.25 s hitch): no explosion, no energy gain.
// State is s[i] (position) and s[i+1] (velocity).
export function oscStep(s, i, target, w, z, dt) {
  const x0 = s[i] - target, v0 = s[i + 1];
  let x, v;
  if (z < 0.9999) {
    const wd = w * Math.sqrt(1 - z * z);
    const e = Math.exp(-z * w * dt);
    const c = Math.cos(wd * dt), sn = Math.sin(wd * dt);
    const B = (v0 + z * w * x0) / wd;
    x = e * (x0 * c + B * sn);
    v = e * (v0 * c - (x0 * w * w + z * w * v0) / wd * sn);
  } else if (z < 1.0001) {
    const e = Math.exp(-w * dt);
    const B = v0 + w * x0;
    x = e * (x0 + B * dt);
    v = e * (v0 - w * B * dt);
  } else {
    const q = w * Math.sqrt(z * z - 1);
    const r1 = -z * w + q, r2 = -z * w - q;
    const A = (v0 - r2 * x0) / (r1 - r2), B = x0 - A;
    const e1 = Math.exp(r1 * dt), e2 = Math.exp(r2 * dt);
    x = A * e1 + B * e2;
    v = A * r1 * e1 + B * r2 * e2;
  }
  s[i] = x + target;
  s[i + 1] = v;
}
