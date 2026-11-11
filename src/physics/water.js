// Painted Cosmos physics: the surface of liquid: wind waves. OWNER: PHYSICS. Pure (no three, no DOM).
//
// Wind blowing over water raises waves; how high depends on the wind speed, on how far the wind
// has had to work on them (the fetch) and on gravity. The fetch-limited growth curves of the
// Shore Protection Manual (1984; JONSWAP data) are used:
//   g Hs / U^2 = 0.0016 (g F / U^2)^(1/2)      significant height
//   g Tp / U   = 0.2857 (g F / U^2)^(1/3)      peak period
// capped at the fully developed sea (Pierson and Moskowitz 1964): Hs = 0.2433 U^2 / g and
// Tp = 8.134 U / g. So a brook 14 m wide only ever ripples, a sea coast under a gale gets real
// waves, and the same gale raises higher, slower waves under weak gravity.
// On other worlds the wind's grip on the liquid scales with the density ratio air / liquid
// (wave energy grows with rho_air / rho_liquid), which makes Neptune's methane sea rougher than
// water would be under the same wind.
// Waves feel the bottom: the length shortens where the depth is under half a wavelength, and a
// wave breaks when it is about 0.55 of the depth high.
//
// What is delivered: the sea state at the focus, smoothed (a sea takes time to rise and fall),
// as three wave trains that PAINTER can draw and the JS twin can evaluate, so that a floating
// explorer rides the same waves that are painted.
import { clamp01, smoothstep, TAU } from './util.js';

export const WATER = Object.freeze({
  growTime: 25,                    // game s for the sea to follow a change of wind
  turnTime: 40,                    // game s for the wave direction to follow the wind
  // the three trains: length as a multiple of the peak wavelength, share of the amplitude,
  // direction offset from the wind (rad)
  lengths: [1, 0.62, 1.55], shares: [0.55, 0.32, 0.25], spread: [0, 0.42, -0.35],
  breakRatio: 0.55,                // highest wave as a fraction of the depth
  earthRatio: 1.225 / 999,         // air to water density, the reference the curves were measured in
});

// Fetch (m) by biome: how far the wind can work on the liquid there. Game scale.
export const FETCH = {
  sea_coast: 2500, storm_seas: 2500, misty_wetland: 40, temperate_forest: 14, autumn_woodland: 14,
  acid_terraces: 250, lava_rivers: 20, teal_sinkholes: 60, kelp_forests: 400, 'stub-shore': 1200, 'stub-lowland': 300,
  default: 80,
};
export function fetchOf(biomeId) { return FETCH[biomeId] != null ? FETCH[biomeId] : FETCH.default; }

// The wind sea raised by a wind U (m/s at 10 m) over a fetch F (m) under gravity g, with the
// densities of the air and the liquid, in liquid `depth` metres deep (Infinity = deep).
// Fills o: height (significant, m), period (s), length (m), speed (phase, m/s), steepness,
// whitecap01.
export function windSea(U, F, g, rhoAir, rhoLiq, depth, o = {}) {
  if (!(U > 0.05) || !(g > 0) || !(rhoAir > 0) || !(rhoLiq > 0) || !(F > 0)) { o.height = 0; o.period = 0; o.length = 0; o.speed = 0; o.steepness = 0; o.whitecap01 = 0; return o; }
  const k = Math.sqrt((rhoAir / rhoLiq) / WATER.earthRatio);
  let H = 0.0016 * U * Math.sqrt(F / g) * k;
  const Hfd = 0.2433 * U * U / g * k;
  if (H > Hfd) H = Hfd;
  let T = 0.2857 * Math.cbrt(U * F) / Math.pow(g, 2 / 3);
  const Tfd = 8.134 * U / g;
  if (T > Tfd) T = Tfd;
  // wavelength: deep water g T^2 / 2 pi, shortened over a shallow bottom (Fenton and McKee 1990)
  const L0 = g * T * T / TAU;
  let L = L0;
  if (depth < L0) L = L0 * Math.pow(Math.tanh(Math.pow(TAU * depth / L0, 0.75)), 2 / 3);
  if (depth < 1e8 && H > WATER.breakRatio * depth) H = WATER.breakRatio * Math.max(0, depth);
  // no wave is steeper than about 1 in 7
  if (L > 0 && H > L / 7) H = L / 7;
  o.height = H; o.period = T; o.length = L; o.speed = T > 0 ? L / T : 0;
  o.steepness = L > 0 ? H / L : 0;
  o.whitecap01 = smoothstep(0.035, 0.075, o.steepness);
  return o;
}

const _t = {};

export class WaterField {
  constructor() {
    this.height = 0;               // significant wave height at the focus now (m), smoothed
    this.period = 0; this.length = 0; this.speed = 0; this.steepness = 0; this.whitecap01 = 0;
    this.dir = new Float64Array(2); this.dir[0] = 1;      // wave direction (frame axes), smoothed
    this.phase = new Float64Array(3);
    this.k = new Float64Array(3);                           // wavenumbers (rad/m)
    this.amp = new Float64Array(3);                         // amplitudes (m)
    this.omega = new Float64Array(3);
    this.level = -1e9;             // liquid surface near the focus (radius - frame.r0), -1e9 when dry
    this.present = false;
    this.frameVersion = -1;
    this.uniforms = { uPhysWaterDir: [1, 0], uPhysWaterK: [0, 0, 0], uPhysWaterAmp: [0, 0, 0], uPhysWaterPhase: [0, 0, 0] };
  }

  // The frame re-anchored at old grid position (X, Z): keep the waves where they are.
  rebase(frame, X, Z) {
    this.frameVersion = frame.version;
    for (let i = 0; i < 3; i++) {
      const a = WATER.spread[i], ex = this.dir[0] * Math.cos(a) - this.dir[1] * Math.sin(a), ez = this.dir[0] * Math.sin(a) + this.dir[1] * Math.cos(a);
      this.phase[i] -= this.k[i] * (ex * X + ez * Z);
    }
  }

  // Advance. we, wn: reference wind at the focus (frame axes, m/s). level: liquid surface near
  // the focus or -1e9. depth: liquid depth there (m). fetch: m. g, rhoAir, rhoLiq as windSea.
  update(dt, frame, we, wn, level, depth, fetch, g, rhoAir, rhoLiq) {
    if (this.frameVersion !== frame.version) { this.frameVersion = frame.version; this.height = 0; this.phase.fill(0); }
    this.level = level; this.present = level > -1e8;
    const U = Math.hypot(we, wn);
    windSea(this.present ? U : 0, fetch, g, rhoAir, rhoLiq, depth > 0 ? depth : 1e9, _t);
    const h = dt > 0.25 ? 0.25 : dt;
    const kh = 1 - Math.exp(-h / WATER.growTime);
    this.height += (_t.height - this.height) * kh;
    if (this.height < 1e-5) this.height = 0;
    // period and length follow the same sea; do not let them collapse when the wind drops
    if (_t.length > 0) { this.period += (_t.period - this.period) * kh; this.length += (_t.length - this.length) * kh; }
    this.speed = this.period > 0 ? this.length / this.period : 0;
    this.steepness = this.length > 0 ? this.height / this.length : 0;
    this.whitecap01 = smoothstep(0.035, 0.075, this.steepness);
    if (U > 0.3) {
      const kd = 1 - Math.exp(-h / WATER.turnTime);
      const d0 = this.dir[0] + (we / U - this.dir[0]) * kd, d1 = this.dir[1] + (wn / U - this.dir[1]) * kd, l = Math.hypot(d0, d1) || 1;
      this.dir[0] = d0 / l; this.dir[1] = d1 / l;
    }
    for (let i = 0; i < 3; i++) {
      const L = this.length * WATER.lengths[i];
      const k = L > 0.02 ? TAU / L : 0;
      // deep-water dispersion for each train: omega^2 = g k (longer waves travel faster)
      const om = Math.sqrt(g * k);
      // keep the phase of each crest where it is when the wavenumber drifts: phase is integrated
      this.k[i] = k; this.omega[i] = om;
      this.amp[i] = 0.5 * this.height * WATER.shares[i];
      this.phase[i] = (this.phase[i] + om * h) % (TAU * 4096);
    }
    const u = this.uniforms;
    u.uPhysWaterDir[0] = this.dir[0]; u.uPhysWaterDir[1] = this.dir[1];
    for (let i = 0; i < 3; i++) { u.uPhysWaterK[i] = this.k[i]; u.uPhysWaterAmp[i] = this.amp[i]; u.uPhysWaterPhase[i] = this.phase[i] % TAU; }
  }

  // Elevation of the surface above its still level at grid position (x, z), metres.
  // The JS twin of pcPhysWaterHeight in WATER_GLSL.
  heightAt(x, z) {
    let s = 0;
    for (let i = 0; i < 3; i++) {
      if (this.amp[i] === 0) continue;
      const a = WATER.spread[i], ex = this.dir[0] * Math.cos(a) - this.dir[1] * Math.sin(a), ez = this.dir[0] * Math.sin(a) + this.dir[1] * Math.cos(a);
      s += this.amp[i] * Math.sin(this.k[i] * (ex * x + ez * z) - this.phase[i]);
    }
    return s;
  }
}

const f = (x) => (Number.isInteger(x) ? x.toFixed(1) : String(x));
const rot = (i) => `vec2(d.x * ${f(Math.cos(WATER.spread[i]))} - d.y * ${f(Math.sin(WATER.spread[i]))}, d.x * ${f(Math.sin(WATER.spread[i]))} + d.y * ${f(Math.cos(WATER.spread[i]))})`;

// GLSL twin. Shares the frame uniforms with FLORA_GLSL (guarded, so both may be included).
export const WATER_GLSL = /* glsl */`
// ---- Painted Cosmos physics: wind waves (generated from src/physics/water.js) ----
#ifndef PC_PHYS_FRAME
#define PC_PHYS_FRAME
uniform vec3 uPhysAnchor;      // body-local anchor of the field frame (m)
uniform vec3 uPhysEast;        // unit axes of the frame, body-local
uniform vec3 uPhysNorth;
uniform vec3 uPhysUp;
vec2 pcPhysGrid(vec3 p) { vec3 d = p - uPhysAnchor; return vec2(dot(d, uPhysEast), dot(d, uPhysNorth)); }
#endif
uniform vec2 uPhysWaterDir;    // wave direction (frame axes)
uniform vec3 uPhysWaterK;      // wavenumbers of the three trains (rad/m)
uniform vec3 uPhysWaterAmp;    // amplitudes (m)
uniform vec3 uPhysWaterPhase;  // phases (rad)

// Elevation (m) of the liquid surface above its still level at a body-local point, and its
// slope along the frame's east and north axes: xyz = (height, dh/deast, dh/dnorth).
vec3 pcPhysWater(vec3 p) {
  vec2 g = pcPhysGrid(p);
  vec2 d = uPhysWaterDir;
  vec2 d0 = ${rot(0)}, d1 = ${rot(1)}, d2 = ${rot(2)};
  vec3 a = vec3(uPhysWaterK.x * dot(d0, g) - uPhysWaterPhase.x, uPhysWaterK.y * dot(d1, g) - uPhysWaterPhase.y, uPhysWaterK.z * dot(d2, g) - uPhysWaterPhase.z);
  vec3 s = sin(a) * uPhysWaterAmp, c = cos(a) * uPhysWaterAmp * uPhysWaterK;
  return vec3(s.x + s.y + s.z, c.x * d0.x + c.y * d1.x + c.z * d2.x, c.x * d0.y + c.y * d1.y + c.z * d2.y);
}
float pcPhysWaterHeight(vec3 p) { return pcPhysWater(p).x; }
`;
export { clamp01 };
