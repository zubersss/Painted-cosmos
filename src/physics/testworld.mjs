// Synthetic worlds for the physics tests: a smooth sphere with optional features behind the
// sampleSurface contract. (Not a test file; imported by *.test.mjs and by physics-lab.html.)
// (P16) Wall-clock asserts run only on request (PC_TIMING=1 node --test src/physics/), as in PILOT's tests: this machine
// is shared with other workers' browsers, and a busy minute fails a budget that a quiet one meets. Otherwise a miss is
// printed, not asserted. The limits themselves are unchanged.
// (P20) Under PC_TIMING every measurement is printed (`# timing ok: ...`), so one run reports them all.
export const timing = (ok, msg) => { if (process.env.PC_TIMING) { console.log('# timing ' + (ok ? 'ok' : 'MISSED') + ': ' + msg); if (!ok) throw new Error('timing: ' + msg); } else if (!ok) console.log('# (timing, not asserted without PC_TIMING=1: ' + msg + ')'); };
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
// (M4) ... and with Earth's weather clock as it stood from P8 to M4 (REGIMES.earth.epoch = 480: the first thunderstorm
// over the home forest from 160 to 320 s of the clock): the tests of the wind, the trees, the rain, the sea and the
// prints that stand in that storm, or were tuned on the weather found at their place and time, run on the weather
// they were written for. (In M4 the game's own clock moved, to REGIMES.earth.epoch = -1050: the first drops at 1670 s,
// the thunderstorm over the home forest from 1690 to 1850 s; weather.test.mjs holds that.) fn may be async.
export function epochP8(fn) {
  const e = _REG.earth.epoch; _REG.earth.epoch = 480;
  let r;
  try { r = fn(); } catch (err) { _REG.earth.epoch = e; throw err; }
  if (r && typeof r.then === 'function') return r.finally(() => { _REG.earth.epoch = e; });
  _REG.earth.epoch = e;
  return r;
}

// (P18) A world drawn on the tangent plane at unit direction C: f(u, v) -> the ground's height over the sea level (m;
// negative under the sea), where (u, v) are metres along the axes turned by `turn` (rad) from east toward north: +u is
// east turned by `turn`. The sea's surface lies at radius R everywhere f < 0. Biome `biome` (its fetch caps the gauge).
export function coastWorld(C, f, { R = 4000, biome = 'sea_coast', turn = 0 } = {}) {
  let ex = C.z, ez = -C.x; const el = Math.hypot(ex, ez) || 1; ex /= el; ez /= el;
  const E = { x: ex, y: 0, z: ez }, Nn = { x: C.y * ez, y: C.z * ex - C.x * ez, z: -C.y * ex };
  const ct = Math.cos(turn), st = Math.sin(turn);
  const uv = (d) => { const k = R / Math.max(1e-9, dot(d, C)); const e = dot(d, E) * k, n = dot(d, Nn) * k; return [e * ct + n * st, -e * st + n * ct]; };
  const sample = (dirIn) => {
    const d = norm(dirIn), [u, v] = uv(d), h = f(u, v);
    const eps = 0.5, hu = (f(u + eps, v) - f(u - eps, v)) / (2 * eps), hv = (f(u, v + eps) - f(u, v - eps)) / (2 * eps);
    const ge = hu * ct - hv * st, gn = hu * st + hv * ct;      // the gradient along east and north
    const n = norm({ x: d.x - E.x * ge - Nn.x * gn, y: d.y - E.y * ge - Nn.y * gn, z: d.z - E.z * ge - Nn.z * gn });
    return { radius: R + h, normal: n, slope: Math.acos(Math.min(1, dot(n, d))), liquidRadius: h < 0 ? R : 0, isLiquid: h < 0, biomeId: biome, biomeWeights: { [biome]: 1 } };
  };
  sample.at = (u, v) => { const e = u * ct - v * st, n = u * st + v * ct; return norm({ x: C.x * R + E.x * e + Nn.x * n, y: C.y * R + E.y * e + Nn.y * n, z: C.z * R + E.z * e + Nn.z * n }); };
  return sample;
}
