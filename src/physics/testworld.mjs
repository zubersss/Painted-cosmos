// Synthetic worlds for the physics tests: a smooth sphere with optional features behind the
// sampleSurface contract. (Not a test file; imported by *.test.mjs and by physics-lab.html.)
const norm = (a) => { const l = Math.hypot(a.x, a.y, a.z) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

// R: radius.  sea: radius of a liquid shell (0 = none).  biome: biome id everywhere.
// cone: { dir, radius (m), height (m) }  a hill with straight sides (slope = atan(height / radius)).
// bowl: { dir, radius, depth }.  bumps: { amp (m), length (m) }  rolling sinusoidal ground.
// stand: { dir, radius (m), canopy01, canopyHeight }  a round wood: samples carry canopy01 and
//        canopyHeight (PAINTER's additive fields), 0 outside it.
export function makeWorld({ R = 4000, sea = 0, biome = 'test', cone = null, bowl = null, bumps = null, stand = null } = {}) {
  const height = (d) => {
    let h = 0;
    if (cone) { const a = Math.acos(Math.min(1, dot(d, cone.dir))) * R; if (a < cone.radius) h += cone.height * (1 - a / cone.radius); }
    if (bowl) { const a = Math.acos(Math.min(1, dot(d, bowl.dir))) * R; if (a < bowl.radius) h -= bowl.depth * (1 - (a / bowl.radius) ** 2); }
    if (bumps) h += bumps.amp * Math.sin(d.x * R / bumps.length * 6.2831853) * Math.cos(d.z * R / bumps.length * 6.2831853);
    return h;
  };
  const sample = (dirIn) => {
    const d = norm(dirIn);
    const h = height(d);
    const a = norm(Math.abs(d.y) < 0.9 ? { x: -d.z, y: 0, z: d.x } : { x: 0, y: d.z, z: -d.y });
    const b = { x: d.y * a.z - d.z * a.y, y: d.z * a.x - d.x * a.z, z: d.x * a.y - d.y * a.x };
    const e = 0.2 / R;
    const at = (k, m) => height(norm({ x: d.x + (a.x * k + b.x * m) * e, y: d.y + (a.y * k + b.y * m) * e, z: d.z + (a.z * k + b.z * m) * e }));
    const ha = (at(1, 0) - at(-1, 0)) / (2 * e * R), hb = (at(0, 1) - at(0, -1)) / (2 * e * R);
    const n = norm({ x: d.x - a.x * ha - b.x * hb, y: d.y - a.y * ha - b.y * hb, z: d.z - a.z * ha - b.z * hb });
    const radius = R + h;
    const out = { radius, normal: n, slope: Math.acos(Math.min(1, dot(n, d))), liquidRadius: sea, isLiquid: sea > radius, biomeId: biome, biomeWeights: { [biome]: 1 } };
    if (stand) { const a = Math.acos(Math.min(1, dot(d, stand.dir))) * R; const inside = a < stand.radius; out.canopy01 = inside ? stand.canopy01 : 0; out.canopyHeight = inside ? stand.canopyHeight : 0; }
    return out;
  };
  sample.forBody = (bodyId, dir) => sample(dir);
  return sample;
}
export const V = (x = 0, y = 0, z = 0) => ({ x, y, z });
export { norm, dot };
export const len = (a) => Math.hypot(a.x, a.y, a.z);
// Point at arc distance `m` metres from unit direction d0 toward +x (east at the +z pole of view).
export function along(d0, m, R) {
  const a = m / R;
  return norm({ x: d0.x + a, y: d0.y, z: d0.z });
}

// Run a test with Earth's weather clock at its old start (REGIMES.earth.epoch = 0): for tests of a
// mechanism that look for "the first snowfall" or "the first storm" and were tuned on the systems
// found from there. The game's own opening weather is tested in weather.test.mjs with the epoch on.
import { REGIMES as _REG } from './weather.js';
export function epoch0(fn) {
  const e = _REG.earth.epoch; _REG.earth.epoch = 0;
  try { return fn(); } finally { _REG.earth.epoch = e; }
}
