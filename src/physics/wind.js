// Painted Cosmos physics: the wind on a sphere. OWNER: PHYSICS. Pure (no three, no DOM).
//
// Three layers, all deterministic functions of (body, position, time):
//   1. Prevailing wind by latitude: alternating zonal bands with the meridional return flow of
//      the circulation cells (Earth: trade easterlies, calm horse latitudes, westerlies).
//   2. Synoptic variation: slow eddies a fraction of the planet wide that speed the wind up,
//      slow it down and swing it round over minutes.
//   3. Gusts: a turbulence pattern that TRAVELS with the wind (Taylor's frozen-turbulence
//      hypothesis: eddies are carried past a point faster than they change), so a gust can be
//      seen coming across a field. Its strength is the turbulence intensity of the ground it
//      crosses, I = 1 / ln(z / z0), times the mean speed: turbulence grows with the wind.
// Terrain shelter, canopy and height above ground are applied on top by the caller (air.js),
// because they need the ground.
//
// Wind vectors are body-local, tangent to the sphere, metres per second, at the standard
// reference: 10 m above open ground (roughness length z0 = 0.03 m).
import { BODIES } from '../data/bodies.js';
import { noise3, noise3q, hash1, clamp, smoothstep, hashString } from './util.js';

// real: the real prevailing wind speed (m/s).  scale: the game divides it by this.  U = real / scale
// is the prevailing speed used (filled in below).  bands: half-waves of the zonal jet between
// equator and pole.  eq: +1 when the equatorial jet blows the way the planet spins (toward local
// east), -1 against.  merid: meridional flow as a fraction of U.  eddy: synoptic eddy speed as a
// fraction of U.
// GAME SCALE: `scale` is the ONE place where the giants' winds are tamed. Their real jets are
// 150-580 m/s; nobody could stand in that, so they are divided by 11-26 and keep their real
// ORDER (Neptune windiest, then Uranus, Saturn, Jupiter), band structure and direction. Earth,
// Mars, Venus and Pluto are real near-surface values, scale 1 (Earth 5-6 m/s mean at 10 m;
// Viking landers 2-7 m/s; Venera 0.3-1 m/s). PILOT may retune a body with setWindScale().
export const WINDS = {
  mercury: { real: 0, scale: 1, bands: 1, eq: 1, merid: 0, eddy: 0 },
  moon: { real: 0, scale: 1, bands: 1, eq: 1, merid: 0, eddy: 0 },
  venus: { real: 0.8, scale: 1, bands: 1, eq: 1, merid: 0.15, eddy: 0.3 },      // slow super-rotation at the ground
  earth: { real: 5.5, scale: 1, bands: 3, eq: -1, merid: 0.3, eddy: 0.45 },
  mars: { real: 6, scale: 1, bands: 2, eq: -1, merid: 0.35, eddy: 0.5 },
  jupiter: { real: 150, scale: 10.7, bands: 11, eq: 1, merid: 0.05, eddy: 0.25 },   // many sharp jets
  saturn: { real: 400, scale: 25, bands: 7, eq: 1, merid: 0.05, eddy: 0.22 },       // broad fast equatorial jet
  uranus: { real: 250, scale: 13.9, bands: 2, eq: -1, merid: 0.08, eddy: 0.25 },    // retrograde at the equator
  neptune: { real: 580, scale: 26.4, bands: 2, eq: -1, merid: 0.1, eddy: 0.35 },
  pluto: { real: 1.5, scale: 1, bands: 1, eq: -1, merid: 0.3, eddy: 0.4 },
};
for (const id in WINDS) WINDS[id].U = WINDS[id].real / WINDS[id].scale;
// Change how far a body's real wind is scaled down (1 = the real thing). Affects the prevailing
// wind, gusts and the drift of weather cells from the next query on.
export function setWindScale(bodyId, scale) {
  const W = WINDS[bodyId];
  if (!W || !(scale > 0)) return;
  W.scale = scale; W.U = W.real / scale;
}

export const WIND = Object.freeze({
  refHeight: 10,          // m: height the reference wind is defined at
  refRoughness: 0.03,     // m: roughness length of open grassland
  blendHeight: 60,        // m: above this the wind no longer feels the local surface
  eddyScale: 0.38,        // synoptic eddy size as a fraction of the body radius
  eddyPeriod: 420,        // s: time for an eddy to change
  gustLength: 90,         // m: lattice of the large gusts (the integral scale of turbulence)
  gustLength2: 34,        // m: second octave
  // (P11) the inertial range. Until P11 the pattern stopped at the second octave: in an 11 m/s wind 5 % of
  // its variance lay at periods under 4 s where a mast at 10 m has 22 % (Kaimal et al. 1972: f S / u*^2 =
  // 105 n / (1 + 33 n)^(5/3), n = f z / U, which falls as f^(-5/3)), and it had a quarter too much at 15 to
  // 60 s. Two more octaves carry it down to eddies of about 10 m; the weights follow the variance Kaimal's
  // spectrum holds in each octave's band of wavelengths at 10 m and were then fitted to its shares by
  // period (wind.test.mjs holds them: within 0.07 of Kaimal's in every band from 10 minutes to 1 s at
  // 5, 11 and 20 m/s). What is smaller is the plants' own (flora.js: honami waves and flutter).
  // The two fine octaves are a SEPARATE level (gustFineAt): eddies of 10 to 30 m cannot be carried by the
  // 16 m wind grid, so the grid's fields (what rain, snow and dust ride in) hold the two large octaves
  // only, and the fine level is added where the place is known exactly: at a point query (airAt: a mast,
  // the explorer, the ship) and, node by node, for the plants (a tree is an oscillator: it is the eddies
  // arriving at its own frequency that make it sway rather than lean).
  gustLength3: 13,        // m: third octave
  gustLength4: 5,         // m: fourth octave
  gustWeights: Object.freeze([0.6, 0.42, 0.36, 0.3]),
  gustNorm: 1.16,         // scales the sum so that sigma(u) / U = I (measured: spectrum check in wind.test.mjs)
  gustMax: 1.45,          // the level is clamped at this (3.3 sigma; it was 1 = 2.1 sigma until P11, which cut the
                          // tops off the gusts: the 3 s gust over the 10 minute mean came out at 1.36 where open
                          // country gives 1.4 to 1.6)
  // (P12) ACROSS the wind. Until P12 the turbulence was along the wind only: the speed gusted and the
  // direction never moved, so flags, grass and rain all pointed one way like a ruler. A mast measures a
  // lateral part about three quarters of the longitudinal one (sigma_v = 1.9 u*, sigma_u = 2.4 u*:
  // Panofsky and Dutton 1984; Kaimal's spectra integrate to 0.75), and it is made of smaller eddies:
  // f S_v / u*^2 = 17 n / (1 + 9.5 n)^(5/3) peaks at 3.5 times the frequency of the longitudinal one.
  // The same four octaves, the same carrying, their own seeds, and weights fitted to the lateral
  // spectrum's shares by period (wind.test.mjs): gustCrossAt (the two large octaves, in the grid's fields:
  // what rain and leaves ride in swings with them) and gustCrossFineAt (the two fine ones, added at a
  // point). The level times I * gustGain * crossRatio is the lateral speed as a fraction of the mean wind:
  // over grass at 10 m the direction wanders 7 degrees rms, 20 degrees and more in the largest swings.
  crossWeights: Object.freeze([0.36, 0.5, 0.56, 0.55]),
  crossNorm: 1.10,         // scales the sum so that sigma(v) / sigma(u) is crossRatio (measured: wind.test.mjs)
  crossRatio: 0.78,
  gustCycle: 96,          // s: re-seeding period of the travelling pattern (two phases blended)
  gustGain: 2.3,          // gust = mean * (1 + I * gustGain * level): level 1 is about 1.4 x the mean over grass
  minFactor: 0.25,        // a lull never drops below this fraction of the mean
});

// (the last lookup is remembered: building a string key on every call would allocate)
const seeds = {};
let _sb = null, _ss = NaN, _sv = 0;
function seedOf(bodyId, seed) {
  if (bodyId === _sb && seed === _ss) return _sv;
  const k = bodyId + ':' + seed;
  _sb = bodyId; _ss = seed;
  return (_sv = seeds[k] || (seeds[k] = hashString('wind-' + k) | 0));
}

// Zonal (east) and meridional (north) prevailing wind at sin(latitude) = sy. o[0] = east, o[1] = north.
export function prevailing(bodyId, sy, o) {
  const W = WINDS[bodyId];
  if (!W || W.U === 0) { o[0] = 0; o[1] = 0; return o; }
  const lat = Math.asin(clamp(sy, -1, 1));
  const polar = 1 - smoothstep(0.94, 0.999, Math.abs(sy));     // vectors must vanish at the pole
  o[0] = W.eq * W.U * Math.cos(W.bands * lat) * polar;
  o[1] = -W.merid * W.U * Math.sin(2 * W.bands * lat) * polar;
  return o;
}

const _pv = new Float64Array(2);

// The large-scale wind (layers 1 and 2) at body-local unit direction (ux,uy,uz), time t.
// Writes o[0..2] = wind vector (body-local, tangent), o[3] = speed. Smooth everywhere.
export function windLarge(bodyId, ux, uy, uz, t, seed, o) {
  const W = WINDS[bodyId];
  if (!W || W.U === 0) { o[0] = o[1] = o[2] = o[3] = 0; return o; }
  prevailing(bodyId, uy, _pv);
  // east = Y x up, north = up x east
  let ex = uz, ez = -ux;
  const el = Math.hypot(ex, ez);
  if (el > 1e-9) { ex /= el; ez /= el; } else { ex = 1; ez = 0; }
  const nx = uy * ez, ny = uz * ex - ux * ez, nz = -uy * ex;
  let wx = ex * _pv[0] + nx * _pv[1], wy = ny * _pv[1], wz = ez * _pv[0] + nz * _pv[1];
  // synoptic eddies: a smooth 3D noise vector, projected onto the tangent plane (no pole trouble)
  const s = seedOf(bodyId, seed);
  const f = 1 / WIND.eddyScale, tt = t / WIND.eddyPeriod;
  const qx = ux * f + tt * 0.31, qy = uy * f - tt * 0.17, qz = uz * f + tt * 0.23;
  let e1 = noise3(qx, qy, qz, s), e2 = noise3(qx + 31.7, qy - 12.2, qz + 5.9, s + 1), e3 = noise3(qx - 17.3, qy + 44.1, qz - 23.4, s + 2);
  const d = e1 * ux + e2 * uy + e3 * uz;
  e1 -= d * ux; e2 -= d * uy; e3 -= d * uz;
  const ek = W.eddy * W.U * 1.6;
  const m = 1 + 0.45 * noise3(qx * 0.7 + 9.1, qy * 0.7 + 3.3, qz * 0.7 - 6.6, s + 3);
  wx = wx * m + e1 * ek; wy = wy * m + e2 * ek; wz = wz * m + e3 * ek;
  o[0] = wx; o[1] = wy; o[2] = wz; o[3] = Math.hypot(wx, wy, wz);
  return o;
}

// Travelling gust level at body-local point (px,py,pz) in metres, carried by wind (wx,wy,wz).
// Returns -gustMax..gustMax (0 = the mean wind, +1 a strong gust, -1 a deep lull; beyond 1 the rare extremes).
// Two copies of the pattern, half a cycle apart, are advected for at most one cycle each and
// cross-faded, so the pattern travels for ever without shearing itself to noise.
// This form is exact only while the wind is steady: each copy sits at p - w * tau with tau up to
// half a cycle (48 s), so a wind that changes at 1 m/s2 moves the pattern at up to 48 m/s through
// the air it is supposed to ride in (P10: the gusts raced whenever a storm's front came through).
// Callers whose wind changes keep the displacement of each copy as state and use gustLevelAt
// (the wind grid does: AirGrid, air.js); a caller with no state passes a wind that changes
// slowly (airAt's far field passes the synoptic wind without the storm's own).
export function gustLevel(bodyId, px, py, pz, wx, wy, wz, t, seed) {
  const T = WIND.gustCycle, a = t / T;
  const t1 = (a - Math.floor(a) - 0.5) * T, t2 = (a + 0.5 - Math.floor(a + 0.5) - 0.5) * T;
  return gustLevelAt(bodyId, px, py, pz, wx * t1, wy * t1, wz * t1, wx * t2, wy * t2, wz * t2, t, seed);
}

// The same pattern with the displacement of each copy given (m, body-local): copy 1 has been
// carried (ax,ay,az) and copy 2 (bx,by,bz) since the middle of its cycle. A caller that adds
// wind * dt to both every step, and starts a copy again at -wind * gustCycle / 2 when its cycle
// begins (its weight is zero at that moment), has a pattern that moves at exactly the wind's
// speed however the wind changes. gustPhase gives the cycle numbers.
export function gustLevelAt(bodyId, px, py, pz, ax, ay, az, bx, by, bz, t, seed) {
  const s = seedOf(bodyId, seed) + 101;
  const T = WIND.gustCycle;
  const a = t / T, c1 = Math.floor(a), f1 = a - c1;
  const b = a + 0.5, c2 = Math.floor(b);
  const w1 = 1 - Math.abs(2 * f1 - 1), w2 = 1 - w1;
  const k1 = 1 / WIND.gustLength, k2 = 1 / WIND.gustLength2;
  const W = WIND.gustWeights;
  let g = 0;
  if (w1 > 0.001) {
    const o = hash1(c1, s) * 977;
    const x = px - ax, y = py - ay, z = pz - az;
    g += w1 * (noise3(x * k1 + o, y * k1, z * k1 - o, s) * W[0] + noise3(x * k2 - o, y * k2 + o, z * k2, s + 7) * W[1]);
  }
  if (w2 > 0.001) {
    const o = hash1(c2, s + 55) * 977;
    const x = px - bx, y = py - by, z = pz - bz;
    g += w2 * (noise3(x * k1 + o, y * k1, z * k1 - o, s + 3) * W[0] + noise3(x * k2 - o, y * k2 + o, z * k2, s + 11) * W[1]);
  }
  // blending two independent patterns lowers the variance; put it back
  g /= Math.sqrt(w1 * w1 + w2 * w2);
  return clamp(g * WIND.gustNorm, -WIND.gustMax, WIND.gustMax);
}

// (P11) The fine level: the third and fourth octaves (eddies of roughly 10 to 30 m), carried exactly as
// gustLevelAt carries the large ones (same arguments). ADD it to gustLevelAt's level and clamp the sum to
// +-WIND.gustMax: that sum is what a mast measures. Unclamped here (about +-0.6).
export function gustFineAt(bodyId, px, py, pz, ax, ay, az, bx, by, bz, t, seed) {
  const s = seedOf(bodyId, seed) + 101;
  const T = WIND.gustCycle;
  const a = t / T, c1 = Math.floor(a), f1 = a - c1;
  const c2 = Math.floor(a + 0.5);
  const w1 = 1 - Math.abs(2 * f1 - 1), w2 = 1 - w1;
  const k3 = 1 / WIND.gustLength3, k4 = 1 / WIND.gustLength4;
  const W = WIND.gustWeights;
  let g = 0;
  if (w1 > 0.001) {
    const o = hash1(c1, s) * 977;
    const x = px - ax, y = py - ay, z = pz - az;
    g += w1 * (noise3(x * k3 + o, y * k3 - o, z * k3, s + 17) * W[2] + noise3(x * k4, y * k4 + o, z * k4 - o, s + 23) * W[3]);
  }
  if (w2 > 0.001) {
    const o = hash1(c2, s + 55) * 977;
    const x = px - bx, y = py - by, z = pz - bz;
    g += w2 * (noise3(x * k3 + o, y * k3 - o, z * k3, s + 19) * W[2] + noise3(x * k4, y * k4 + o, z * k4 - o, s + 29) * W[3]);
  }
  return g / Math.sqrt(w1 * w1 + w2 * w2) * WIND.gustNorm;
}
// (P12) The lateral level: the two large octaves, carried exactly as gustLevelAt carries the longitudinal
// ones (same arguments), from their own seeds. Unclamped; add gustCrossFineAt and clamp the sum to
// +-WIND.gustMax for what a vane on a mast measures.
export function gustCrossAt(bodyId, px, py, pz, ax, ay, az, bx, by, bz, t, seed) {
  const s = seedOf(bodyId, seed) + 311;
  const T = WIND.gustCycle;
  const a = t / T, c1 = Math.floor(a), f1 = a - c1;
  const c2 = Math.floor(a + 0.5);
  const w1 = 1 - Math.abs(2 * f1 - 1), w2 = 1 - w1;
  const k1 = 1 / WIND.gustLength, k2 = 1 / WIND.gustLength2;
  const W = WIND.crossWeights;
  let g = 0;
  if (w1 > 0.001) {
    const o = hash1(c1, s) * 977;
    const x = px - ax, y = py - ay, z = pz - az;
    g += w1 * (noise3(x * k1 - o, y * k1 + o, z * k1, s) * W[0] + noise3(x * k2, y * k2 - o, z * k2 + o, s + 7) * W[1]);
  }
  if (w2 > 0.001) {
    const o = hash1(c2, s + 55) * 977;
    const x = px - bx, y = py - by, z = pz - bz;
    g += w2 * (noise3(x * k1 - o, y * k1 + o, z * k1, s + 3) * W[0] + noise3(x * k2, y * k2 - o, z * k2 + o, s + 11) * W[1]);
  }
  return g / Math.sqrt(w1 * w1 + w2 * w2) * WIND.crossNorm;
}
// ... and its two fine octaves.
export function gustCrossFineAt(bodyId, px, py, pz, ax, ay, az, bx, by, bz, t, seed) {
  const s = seedOf(bodyId, seed) + 311;
  const T = WIND.gustCycle;
  const a = t / T, c1 = Math.floor(a), f1 = a - c1;
  const c2 = Math.floor(a + 0.5);
  const w1 = 1 - Math.abs(2 * f1 - 1), w2 = 1 - w1;
  const k3 = 1 / WIND.gustLength3, k4 = 1 / WIND.gustLength4;
  const W = WIND.crossWeights;
  let g = 0;
  if (w1 > 0.001) {
    const o = hash1(c1, s) * 977;
    const x = px - ax, y = py - ay, z = pz - az;
    g += w1 * (noise3(x * k3, y * k3 + o, z * k3 - o, s + 17) * W[2] + noise3(x * k4 + o, y * k4, z * k4 - o, s + 23) * W[3]);
  }
  if (w2 > 0.001) {
    const o = hash1(c2, s + 55) * 977;
    const x = px - bx, y = py - by, z = pz - bz;
    g += w2 * (noise3(x * k3, y * k3 + o, z * k3 - o, s + 19) * W[2] + noise3(x * k4 + o, y * k4, z * k4 - o, s + 29) * W[3]);
  }
  return g / Math.sqrt(w1 * w1 + w2 * w2) * WIND.crossNorm;
}
// The large lateral octaves in a steady wind (wx,wy,wz), as gustLevel is to gustLevelAt.
export function gustCross(bodyId, px, py, pz, wx, wy, wz, t, seed) {
  const T = WIND.gustCycle, a = t / T;
  const t1 = (a - Math.floor(a) - 0.5) * T, t2 = (a + 0.5 - Math.floor(a + 0.5) - 0.5) * T;
  return gustCrossAt(bodyId, px, py, pz, wx * t1, wy * t1, wz * t1, wx * t2, wy * t2, wz * t2, t, seed);
}
// The whole lateral level a vane on a mast would measure in a steady wind (wx,wy,wz), clamped.
export function gustCrossFull(bodyId, px, py, pz, wx, wy, wz, t, seed) {
  const T = WIND.gustCycle, a = t / T;
  const t1 = (a - Math.floor(a) - 0.5) * T, t2 = (a + 0.5 - Math.floor(a + 0.5) - 0.5) * T;
  return clamp(gustCrossAt(bodyId, px, py, pz, wx * t1, wy * t1, wz * t1, wx * t2, wy * t2, wz * t2, t, seed)
    + gustCrossFineAt(bodyId, px, py, pz, wx * t1, wy * t1, wz * t1, wx * t2, wy * t2, wz * t2, t, seed), -WIND.gustMax, WIND.gustMax);
}

// The whole level a mast would measure in a steady wind (wx,wy,wz): large gusts and fine eddies, clamped.
export function gustLevelFull(bodyId, px, py, pz, wx, wy, wz, t, seed) {
  const T = WIND.gustCycle, a = t / T;
  const t1 = (a - Math.floor(a) - 0.5) * T, t2 = (a + 0.5 - Math.floor(a + 0.5) - 0.5) * T;
  return clamp(gustLevelAt(bodyId, px, py, pz, wx * t1, wy * t1, wz * t1, wx * t2, wy * t2, wz * t2, t, seed)
    + gustFineAt(bodyId, px, py, pz, wx * t1, wy * t1, wz * t1, wx * t2, wy * t2, wz * t2, t, seed), -WIND.gustMax, WIND.gustMax);
}

// (P18) THE SUB-SECOND EDDIES. The pattern's finest octave is a 5 m lattice: in a 5 m/s wind nothing in it changed faster
// than about a second, and a mast's wind under one second was 0.1 to 0.2 % of the variance where Kaimal's spectrum puts 4
// to 10 % at 10 m and 10 to 25 % at 2 m (the spectrum shifts to higher frequencies near the ground: n = f z / U(z)). Three
// more octaves of eddies, 3.5, 1.4 and 0.55 m, are added at a POINT (airAt: the explorer, the ship, here.air), carried with the
// pattern (frozen turbulence: deterministic, and coherent over less than a metre), each weighted by the variance Kaimal
// et al. (1972) put in its band of wavelengths at the point's own height z, of sigma_u = I U10 (the surface layer's
// sigma_u does not change with height; I carries the roughness): along the wind f S / u*^2 = 105 n / (1 + 33 n)^(5/3),
// across it 17 n / (1 + 9.5 n)^(5/3), whose shares above n are (1 + 33 n)^(-2/3) and (1 + 9.5 n)^(-2/3). Bands (m of
// wavelength): 6 to 2.4, 2.4 to 0.95, 0.95 to 0.38. What feels them is a RECEIVER (optional): a body D across averages
// eddies smaller than itself (Davenport's aerodynamic admittance, chi^2 = 1 / (1 + (2 D / lambda)^(4/3)): the explorer,
// half a metre, feels them; the ship's 8 m hull hardly any), and an octave whose eddies the receiver meets more than 15 to
// 25 times a second (the wind's speed relative to it over the lattice) fades out: a 60 Hz step would alias them.
export const GUST_SUB = Object.freeze({
  lengths: [8.7, 3.5, 1.4, 0.55],  // m: the lattices
  edges: [15, 6, 2.4, 0.95, 0.38], // m: their bands of wavelength. The first band (15 to 6 m) the pattern's fine octaves already
                                   // hold as Kaimal has it at 10 m: its octave carries only what the spectrum at a lower height
                                   // wants there beyond that (nothing at 10 m and above). The rest the pattern hardly holds.
  norm: 1.5, normV: 2.2,           // variance gains: a lattice of value noise spreads part of its variance below its band (measured:
                                   // wind.test.mjs, the share under 1 s against Kaimal at 1, 2 and 10 m, 4 to 16 m/s, z0 0.03 and 0.3)
  fadeHz: [15, 25],                // the octave fades out as U10 / length passes these
  noiseSigma: 0.3947,              // sigma of one octave of noise3 (measured over 2e5 points)
  minHeight: 0.5,                  // m: the height Kaimal is read at is never lower (z over the canopy's displacement)
  minShare: 0.15,                  // the point's mean wind over the 10 m reference, never taken lower (under a canopy)
});
const kaimalU = (n) => Math.pow(1 + 33 * n, -2 / 3), kaimalV = (n) => Math.pow(1 + 9.5 * n, -2 / 3);
// (the pattern's share of the first band at 10 m, along and across: what the first octave does not carry again)
const SUB10U = kaimalU(10 / GUST_SUB.edges[0]) - kaimalU(10 / GUST_SUB.edges[1]), SUB10V = kaimalV(10 / GUST_SUB.edges[0]) - kaimalV(10 / GUST_SUB.edges[1]);
const _ku = new Float64Array(GUST_SUB.edges.length), _kv = new Float64Array(GUST_SUB.edges.length);
// The sub-second levels at body-local point (px,py,pz), carried as gustLevelAt's copies (gs: their six displacements),
// for a point z m over the ground (or the canopy's displacement) whose mean wind is fz of the 10 m wind U10 (m/s).
// D (m): the receiver's size (0: a point); Ue (m/s): the speed it meets the air at (default U10: standing).
// o[0]: along the wind, o[1]: across it, in the level's units for this point (add them to the pattern's levels before
// the clamp: airAt multiplies by (I + gustiness) * gustGain, the 10 m intensity, so they are divided here by fz and
// gustGain: what they add to the wind is U10 (I + ...) times Kaimal's share); o[2], o[3]: the shares of sigma_u^2 and
// sigma_v^2 they carry (for the turbulence the point reports).
export function gustSubAt(bodyId, px, py, pz, gs, t, seed, z, fz, U10, o, D = 0, Ue = U10) {
  const G = GUST_SUB, E = G.edges, zz = z > G.minHeight ? z : G.minHeight, f = fz > G.minShare ? fz : G.minShare;
  const s = seedOf(bodyId, seed) + 501;
  const T = WIND.gustCycle, a = t / T, c1 = Math.floor(a), f1 = a - c1, c2 = Math.floor(a + 0.5);
  const w1 = 1 - Math.abs(2 * f1 - 1), w2 = 1 - w1, den = Math.sqrt(w1 * w1 + w2 * w2);
  // Kaimal's shares above each edge (n = f z / U(z) with f = U10 / wavelength), once
  for (let e = 0; e < E.length; e++) { const n = zz / (E[e] * f); _ku[e] = kaimalU(n); _kv[e] = kaimalV(n); }
  const o1 = w1 > 0.001 ? hash1(c1, s) * 977 : 0, o2 = w2 > 0.001 ? hash1(c2, s + 55) * 977 : 0;
  const ax = px - gs[0], ay = py - gs[1], az = pz - gs[2], bx = px - gs[3], by = py - gs[4], bz = pz - gs[5];
  let su = 0, sv = 0, vu = 0, vv = 0;
  for (let k = 0; k < G.lengths.length; k++) {
    const L = G.lengths[k], hz = Ue / L, fade = (1 - smoothstep(G.fadeHz[0], G.fadeHz[1], hz)) / Math.sqrt(1 + Math.pow(2 * D / L, 4 / 3));
    if (!(fade > 1e-3)) continue;
    let eu = _ku[k] - _ku[k + 1], ev = _kv[k] - _kv[k + 1];
    // (the first band: the pattern at this point holds f^2 of what Kaimal has there at 10 m; only the excess)
    if (k === 0) { eu -= f * f * SUB10U; ev -= f * f * SUB10V; eu = eu > 0 ? eu : 0; ev = ev > 0 ? ev : 0; }
    eu *= fade * fade * G.norm; ev *= fade * fade * G.normV;
    vu += eu; vv += ev;
    const kk = 1 / L, wu = Math.sqrt(eu) / G.noiseSigma, wv = Math.sqrt(ev) / G.noiseSigma, sk = s + 31 + 7 * k, q1 = o1 + 17.3 * k, q2 = o2 + 17.3 * k;
    let gu = 0, gv = 0;
    if (w1 > 0.001) {
      gu += w1 * noise3(ax * kk + q1, ay * kk - q1, az * kk, sk);
      gv += w1 * noise3(ax * kk - q1, ay * kk, az * kk + q1, sk + 1);
    }
    if (w2 > 0.001) {
      gu += w2 * noise3(bx * kk + q2, by * kk - q2, bz * kk, sk + 2);
      gv += w2 * noise3(bx * kk - q2, by * kk, bz * kk + q2, sk + 3);
    }
    su += wu * gu / den; sv += wv * gv / den;
  }
  const k0 = 1 / (f * WIND.gustGain);
  o[0] = su * k0; o[1] = sv * k0; o[2] = vu; o[3] = vv;
  return o;
}

// (P18) For the bound on how fast the wind at a point may change (air.test.mjs): the largest amplitude (level units) of each
// sub-second octave at height z, share fz, for a point at rest, no fade (an upper bound), into out[k]
export function gustSubAmplitudes(z, fz, out) {
  const G = GUST_SUB, E = G.edges, zz = z > G.minHeight ? z : G.minHeight, f = fz > G.minShare ? fz : G.minShare;
  for (let k = 0; k < G.lengths.length; k++) {
    let eu = kaimalU(zz / (E[k] * f)) - kaimalU(zz / (E[k + 1] * f));
    if (k === 0) { eu -= f * f * SUB10U; eu = eu > 0 ? eu : 0; }
    out[k] = Math.sqrt(eu * G.norm) / G.noiseSigma / (f * WIND.gustGain);
  }
  return out;
}

// (P18) The three levels at many places at once, for the wind grid: for each of the n points P[3k..3k+2] (body-local, m),
// carried as the copies' displacements gs[0..5] say (gustLevelAt's arguments), writes outL[k] = gustLevelAt (clamped),
// outC[k] = gustCrossAt and outF[k] = gustFineAt, EXACTLY (the same arithmetic in the same order, the cycle's numbers worked
// out once instead of per point). Called per node with twelve numbers each, the three functions boxed every number they
// were handed and every answer: 385 KB of garbage a frame. Through the arrays and noise3q nothing is boxed.
const _nq = new Float64Array(5);
export function gustNodes(bodyId, P, n, gs, t, seed, outL, outC, outF) {
  const s = seedOf(bodyId, seed) + 101, sc = seedOf(bodyId, seed) + 311;
  const T = WIND.gustCycle;
  const a = t / T, c1 = Math.floor(a), f1 = a - c1;
  const c2 = Math.floor(a + 0.5);
  const w1 = 1 - Math.abs(2 * f1 - 1), w2 = 1 - w1, on1 = w1 > 0.001, on2 = w2 > 0.001;
  const k1 = 1 / WIND.gustLength, k2 = 1 / WIND.gustLength2, k3 = 1 / WIND.gustLength3, k4 = 1 / WIND.gustLength4;
  const W = WIND.gustWeights, X = WIND.crossWeights, W0 = W[0], W1 = W[1], W2 = W[2], W3 = W[3], X0 = X[0], X1 = X[1];
  const o1 = on1 ? hash1(c1, s) * 977 : 0, o2 = on2 ? hash1(c2, s + 55) * 977 : 0;
  const p1 = on1 ? hash1(c1, sc) * 977 : 0, p2 = on2 ? hash1(c2, sc + 55) * 977 : 0;
  const den = Math.sqrt(w1 * w1 + w2 * w2), q = _nq;
  const ax = gs[0], ay = gs[1], az = gs[2], bx = gs[3], by = gs[4], bz = gs[5];
  for (let k = 0; k < n; k++) {
    const px = P[3 * k], py = P[3 * k + 1], pz = P[3 * k + 2];
    let gl = 0, gc = 0, gf = 0;
    if (on1) {
      const x = px - ax, y = py - ay, z = pz - az;
      q[0] = x * k1 + o1; q[1] = y * k1; q[2] = z * k1 - o1; q[4] = s; noise3q(q); const l0 = q[3];
      q[0] = x * k2 - o1; q[1] = y * k2 + o1; q[2] = z * k2; q[4] = s + 7; noise3q(q); const l1 = q[3];
      gl += w1 * (l0 * W0 + l1 * W1);
      q[0] = x * k1 - p1; q[1] = y * k1 + p1; q[2] = z * k1; q[4] = sc; noise3q(q); const c0 = q[3];
      q[0] = x * k2; q[1] = y * k2 - p1; q[2] = z * k2 + p1; q[4] = sc + 7; noise3q(q); const cc1 = q[3];
      gc += w1 * (c0 * X0 + cc1 * X1);
      q[0] = x * k3 + o1; q[1] = y * k3 - o1; q[2] = z * k3; q[4] = s + 17; noise3q(q); const f0 = q[3];
      q[0] = x * k4; q[1] = y * k4 + o1; q[2] = z * k4 - o1; q[4] = s + 23; noise3q(q); const ff1 = q[3];
      gf += w1 * (f0 * W2 + ff1 * W3);
    }
    if (on2) {
      const x = px - bx, y = py - by, z = pz - bz;
      q[0] = x * k1 + o2; q[1] = y * k1; q[2] = z * k1 - o2; q[4] = s + 3; noise3q(q); const l0 = q[3];
      q[0] = x * k2 - o2; q[1] = y * k2 + o2; q[2] = z * k2; q[4] = s + 11; noise3q(q); const l1 = q[3];
      gl += w2 * (l0 * W0 + l1 * W1);
      q[0] = x * k1 - p2; q[1] = y * k1 + p2; q[2] = z * k1; q[4] = sc + 3; noise3q(q); const c0 = q[3];
      q[0] = x * k2; q[1] = y * k2 - p2; q[2] = z * k2 + p2; q[4] = sc + 11; noise3q(q); const cc1 = q[3];
      gc += w2 * (c0 * X0 + cc1 * X1);
      q[0] = x * k3 + o2; q[1] = y * k3 - o2; q[2] = z * k3; q[4] = s + 19; noise3q(q); const f0 = q[3];
      q[0] = x * k4; q[1] = y * k4 + o2; q[2] = z * k4 - o2; q[4] = s + 29; noise3q(q); const ff1 = q[3];
      gf += w2 * (f0 * W2 + ff1 * W3);
    }
    gl /= den;
    const gn = gl * WIND.gustNorm;
    outL[k] = gn < -WIND.gustMax ? -WIND.gustMax : gn > WIND.gustMax ? WIND.gustMax : gn;
    outC[k] = gc / den * WIND.crossNorm;
    outF[k] = gf / den * WIND.gustNorm;
  }
}

// Cycle bookkeeping of the two copies at time t: o[0], o[1] = the cycle number of copy 1 and 2
// (a copy starts again when its number changes), o[2], o[3] = seconds since the middle of its cycle
// (-gustCycle / 2 .. +gustCycle / 2: what a steady wind is multiplied by).
export function gustPhase(t, o) {
  const T = WIND.gustCycle, a = t / T, c1 = Math.floor(a), c2 = Math.floor(a + 0.5);
  o[0] = c1; o[1] = c2; o[2] = (a - c1 - 0.5) * T; o[3] = (a + 0.5 - c2 - 0.5) * T;
  return o;
}

// Turbulence intensity at height z over roughness z0 with displacement d: I = 1 / ln((z - d) / z0)
// (neutral surface layer; about 0.17 at 10 m over grass, 0.1 over water, 0.4 over forest).
export function turbulenceIntensity(z, z0, d = 0) {
  const h = Math.max(z - d, z0 * 3);
  return clamp(1 / Math.log(h / z0), 0.05, 0.5);
}

// Mean wind speed at height z above the ground as a fraction of the reference wind (10 m, open
// ground). Log law above the canopy, matched at the blending height; exponential decay inside a
// canopy of height hc and density c01 (Inoue 1963: u = u_h exp(a (z / hc - 1)), a about 2.5),
// which is why the forest floor is calm while the crowns move.
export function heightFactor(z, z0, hc = 0, c01 = 0) {
  const zb = WIND.blendHeight;
  const top = Math.log(zb / WIND.refRoughness) / Math.log(WIND.refHeight / WIND.refRoughness);   // 1.31
  if (z >= zb) return top;
  const zz = z < 0 ? 0 : z;
  const zo = z0 > 1e-5 ? z0 : 1e-5;
  // open ground: log law
  const open = Math.log(Math.max(zz, zo * 3) / zo) / Math.log(zb / zo);
  if (!(hc > 0) || !(c01 > 0)) return top * open;
  // closed canopy: displaced log law above it, exponential decay inside it
  const d = 0.65 * hc;                            // displacement height
  const zr = Math.max(zo, Math.min(1, 0.1 * hc)); // roughness of the canopy top (1 m for a forest)
  const lnb = Math.log((zb - d) / zr);
  let closed;
  if (zz >= hc) closed = Math.log(Math.max(zz - d, zr * 3) / zr) / lnb;
  else closed = Math.log(Math.max(hc - d, zr * 3) / zr) / lnb * Math.exp(2.5 * (zz / hc - 1));
  // a thin canopy lets part of the open-ground profile through
  const c = c01 > 1 ? 1 : c01;
  return top * (closed * c + open * (1 - c));
}

// Roughness length of open liquid under the wind (Charnock 1955): the waves the wind raises are
// the roughness it feels, z0 = a u*^2 / g, with a = 0.018 for young, fetch-limited seas; never
// smoother than the viscous limit of a glassy surface (0.0002 m). u* is the friction velocity of
// the log profile through the 10 m wind, u* = k U10 / ln(10 / z0): solved by iteration (it
// converges in three rounds). Earth's sea in its 5 m/s breeze: 0.0002 m; in a 22 m/s gale under
// Neptune's gravity 0.002 m, in 40 m/s 0.008 m. So a storm sea leaves about two thirds of the
// wind aloft at head height where a boulder beach (z0 0.3 m) leaves a third.
export function seaRoughness(U10, g) {
  const u = U10 > 0 ? U10 : 0, gg = g > 0.1 ? g : 0.1;
  let z0 = 0.0002;
  for (let i = 0; i < 4; i++) {
    const us = 0.4 * u / Math.log(WIND.refHeight / z0);
    z0 = Math.min(0.05, Math.max(0.0002, 0.018 * us * us / gg));
  }
  return z0;
}

// Speed-up or shelter from the ground itself, from the surface normal alone (no extra samples).
// `lee` = dot(horizontal part of the normal, wind direction): positive on a lee slope (the ground
// falls away downwind), negative on a windward slope. Flow separates on lee slopes steeper than
// about 17 degrees and speeds up on the way to a crest (Jackson and Hunt 1975: fractional
// speed-up about 2 H / L on a ridge).
export function slopeFactor(lee) {
  return 1 - 0.8 * smoothstep(0.08, 0.5, lee) + 0.4 * smoothstep(0.05, 0.45, -lee);
}

// Shelter from higher ground upwind: `sx` is the largest elevation angle (radians) to the
// terrain within shelter distance upwind (Winstral's Sx parameter). Negative values mean the
// ground drops away upwind (an exposed crest).
export function shelterFactor(sx) {
  return 1 - 0.85 * smoothstep(0.04, 0.32, sx) + 0.3 * smoothstep(0.02, 0.2, -sx);
}

// (P15, moved here in P16) The lee of trees with height: behind a forest edge or a dense belt the quiet zone lies under
// half to two thirds of its height, and at its top the speed is lost by a third to a quarter of what is lost near the
// ground (Heisler and DeWalle 1988; Wang and Takle 1996). wakeAt(wk, wkH, z): the wind left at height z (m) in the lee of
// trees of height wkH that leave wk of it near the ground: whole up to WAKE.full of their height, gone at WAKE.top.
// One shape for the particles' air, profileAt and the crowns. It lives here (not in air.js, which re-exports it and
// carries the same numbers as AIR.wakeFull, AIR.wakeTop) so that flora.js can take it without importing air.js, which
// imports flora.js: that cycle put FLORA in its temporal dead zone when the browser entered through flora.glsl.js (6d5c02a).
export const WAKE = Object.freeze({ full: 0.5, top: 1.5 });
export function wakeAt(wk, wkH, z) {
  if (!(wk < 1) || !(wkH > 0)) return 1;
  return 1 - (1 - wk) * (1 - smoothstep(wkH * WAKE.full, wkH * WAKE.top, z));
}

export function hasAir(bodyId) {
  const W = WINDS[bodyId];
  return !!W && W.U > 0 && (BODIES[bodyId].atmosphereHeight || 0) > 0;
}
