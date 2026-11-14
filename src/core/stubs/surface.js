// STUB terrain: a deterministic noise heightfield per body, behind the same sampleSurface
// contract Painter's real world implements. Pure (no three) so the explorer, the ship and the
// cameras can be unit-tested against it in Node. Not art: grey paper mock-ups only.
import { BODIES } from '../../data/bodies.js';

// ---- hashing and gradient-free value noise (cheap, deterministic, good enough) --------------
function hash3(ix, iy, iz, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(iz, 2147483647) ^ Math.imul(seed, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
export function noise3(x, y, z, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = fade(x - ix), fy = fade(y - iy), fz = fade(z - iz);
  const a = hash3(ix, iy, iz, seed), b = hash3(ix + 1, iy, iz, seed);
  const c = hash3(ix, iy + 1, iz, seed), d = hash3(ix + 1, iy + 1, iz, seed);
  const e = hash3(ix, iy, iz + 1, seed), f = hash3(ix + 1, iy, iz + 1, seed);
  const g = hash3(ix, iy + 1, iz + 1, seed), h = hash3(ix + 1, iy + 1, iz + 1, seed);
  const x0 = a + (b - a) * fx, x1 = c + (d - c) * fx, x2 = e + (f - e) * fx, x3 = g + (h - g) * fx;
  const y0 = x0 + (x1 - x0) * fy, y1 = x2 + (x3 - x2) * fy;
  return (y0 + (y1 - y0) * fz) * 2 - 1;        // -1..1
}
function fbm(x, y, z, seed, octaves, lacunarity = 2.07, gain = 0.5) {
  let amp = 1, sum = 0, norm = 0, f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise3(x * f, y * f, z * f, seed + i * 17);
    norm += amp; amp *= gain; f *= lacunarity;
  }
  return sum / norm;
}

// ---- per-body stub parameters --------------------------------------------------------------
function seedOf(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h | 0;
}
const WET = { earth: 0.0, venus: -0.35, neptune: 0.25, uranus: -0.2, jupiter: -0.5, saturn: -0.5 };
const PARAMS = {};
export function stubParams(id) {
  if (PARAMS[id]) return PARAMS[id];
  const b = BODIES[id];
  if (!b) throw new Error('unknown body id: ' + id);
  const R = b.radius;
  const p = {
    id, R, seed: seedOf(id),
    relief: R * 0.022,                  // metres: rolling land (about +-90 m on Earth)
    ridge: R * 0.04,                    // metres: mountain ranges (steep, tests the slope limits)
    // Sea level relative to the base radius, or null for dry bodies.
    seaLevel: id in WET ? WET[id] * R * 0.022 : null,
  };
  PARAMS[id] = p;
  return p;
}

// Height of the solid ground above the base radius, for a body-local unit direction.
export function stubHeight(id, x, y, z) {
  const P = stubParams(id);
  const s = P.seed;
  // Wavelengths are in body radii so every stub planet has the same kind of shapes.
  const cont = fbm(x * 1.3, y * 1.3, z * 1.3, s, 4);                        // continents
  const hills = fbm(x * 9, y * 9, z * 9, s + 101, 5);                       // hills, 450 m and down
  const fine = fbm(x * 150, y * 150, z * 150, s + 202, 3);                  // 27 m bumps and down
  const mask = Math.max(0, fbm(x * 2.6, y * 2.6, z * 2.6, s + 303, 3) * 1.6 + 0.1);
  const r = 1 - Math.abs(fbm(x * 7, y * 7, z * 7, s + 404, 4) * 2.2);       // ridges
  const ridge = Math.max(0, r) ** 2 * Math.min(1, mask * mask);
  return P.relief * (cont * 1.25 + hills * 0.55 + 0.18) + P.ridge * ridge + fine * 1.1;
}

const BIOMES = ['stub-lowland', 'stub-highland', 'stub-shore', 'stub-polar'];

// The contract's sampleSurface, for stubs. `unitDir` is any {x,y,z}; the result is a fresh
// plain object each call.
export function stubSurface(id, unitDir) {
  const P = stubParams(id);
  const l = Math.hypot(unitDir.x, unitDir.y, unitDir.z) || 1;
  const x = unitDir.x / l, y = unitDir.y / l, z = unitDir.z / l;
  const h = stubHeight(id, x, y, z);
  const radius = P.R + h;

  // Normal by central differences over about half a metre, in the tangent plane.
  let ax = -z, ay = 0, az = x;                       // tangent a = up x Y (east-ish)
  let al = Math.hypot(ax, az);
  if (al < 1e-6) { ax = 1; ay = 0; az = 0; al = 1; }
  ax /= al; az /= al;
  const bx = y * az - z * ay, by = z * ax - x * az, bz = x * ay - y * ax;   // b = up x a
  const e = 0.6 / P.R;                               // radians
  const ha1 = stubHeight(id, x + ax * e, y + ay * e, z + az * e);
  const ha0 = stubHeight(id, x - ax * e, y - ay * e, z - az * e);
  const hb1 = stubHeight(id, x + bx * e, y + by * e, z + bz * e);
  const hb0 = stubHeight(id, x - bx * e, y - by * e, z - bz * e);
  const step = 2 * e * radius;
  const ga = (ha1 - ha0) / step, gb = (hb1 - hb0) / step;   // slopes along a and b
  let nx = x - ax * ga - bx * gb, ny = y - ay * ga - by * gb, nz = z - az * ga - bz * gb;
  const nl = Math.hypot(nx, ny, nz);
  nx /= nl; ny /= nl; nz /= nl;
  const slope = Math.acos(Math.min(1, Math.max(-1, nx * x + ny * y + nz * z)));

  const liquidRadius = P.seaLevel === null ? 0 : P.R + P.seaLevel;
  const isLiquid = liquidRadius > radius;

  // Four mock biomes, smoothly blended, so biomeWeights is exercised.
  const above = P.seaLevel === null ? h : h - P.seaLevel;
  const polar = smooth(0.72, 0.9, Math.abs(y));
  const shore = P.seaLevel === null ? 0 : (1 - smooth(1, 9, Math.abs(above))) * (1 - polar);
  const high = smooth(P.relief * 0.5, P.relief * 1.4, above) * (1 - polar);
  const low = Math.max(0, 1 - polar - shore - high);
  const w = [low, high, shore, polar];
  const sum = w[0] + w[1] + w[2] + w[3] || 1;
  const biomeWeights = {};
  let bi = 0;
  for (let i = 0; i < 4; i++) {
    const v = w[i] / sum;
    if (v > 0) biomeWeights[BIOMES[i]] = v;
    if (w[i] > w[bi]) bi = i;
  }
  return {
    radius, normal: { x: nx, y: ny, z: nz }, biomeId: BIOMES[bi], biomeWeights,
    isLiquid, slope, liquidRadius,
  };
}
function smooth(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// A good first landing spot: flat, dry, a little above any sea, away from the poles.
// Deterministic; searched once per body and cached.
const SPAWNS = {};
export function stubSpawn(id) {
  if (SPAWNS[id]) return SPAWNS[id];
  const P = stubParams(id);
  let best = null;
  const N = 600, golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = (1 - (2 * (i + 0.5)) / N) * 0.55;            // stay within mid latitudes
    const rr = Math.sqrt(1 - y * y), th = i * golden + (P.seed % 100);
    const dir = { x: Math.cos(th) * rr, y, z: Math.sin(th) * rr };
    const s = stubSurface(id, dir);
    const above = s.radius - (s.liquidRadius || P.R - P.relief);
    if (s.isLiquid || above < 2.5) continue;
    // Flat here and flat 14 m away in four directions (room for the ship).
    let worst = s.slope;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = 14 / P.R;
      const d2 = { x: dir.x + dx * k, y: dir.y, z: dir.z + dz * k };
      const s2 = stubSurface(id, d2);
      worst = Math.max(worst, s2.slope, s2.isLiquid ? 1 : 0);
    }
    const score = worst * 10 + Math.abs(above - 12) * 0.02;
    if (!best || score < best.score) best = { score, dir };
  }
  const unitDir = best ? best.dir : { x: 0, y: 0, z: 1 };
  SPAWNS[id] = { unitDir };
  return SPAWNS[id];
}

export function stubVistas(id) {
  const P = stubParams(id);
  const out = [];
  for (let i = 0; i < 3; i++) {
    const a = hash3(i, 7, 13, P.seed) * Math.PI * 2;
    const y = hash3(i, 3, 5, P.seed) * 1.2 - 0.6;
    const rr = Math.sqrt(1 - y * y);
    out.push({ id: `${id}-stub-vista-${i + 1}`, name: `Stub vista ${i + 1}`, unitDir: { x: Math.cos(a) * rr, y, z: Math.sin(a) * rr } });
  }
  return out;
}
