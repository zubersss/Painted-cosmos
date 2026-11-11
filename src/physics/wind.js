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
import { noise3, hash1, clamp, smoothstep, hashString } from './util.js';

// U: prevailing speed scale (m/s).  bands: half-waves of the zonal jet between equator and pole.
// eq: +1 when the equatorial jet blows the way the planet spins (toward local east), -1 against.
// merid: meridional flow as a fraction of U.  eddy: synoptic eddy speed as a fraction of U.
// GAME SCALE: the giants' real jets are 100-580 m/s; nobody could stand in that. Their speeds
// are divided by about 10-25 and keep their real ORDER (Neptune windiest, then Uranus, Saturn,
// Jupiter) and their real band structure and direction. Earth, Mars, Venus and Pluto are real
// near-surface values (Earth 5-6 m/s mean at 10 m; Viking landers 2-7 m/s; Venera 0.3-1 m/s).
export const WINDS = {
  mercury: { U: 0, bands: 1, eq: 1, merid: 0, eddy: 0 },
  moon: { U: 0, bands: 1, eq: 1, merid: 0, eddy: 0 },
  venus: { U: 0.8, bands: 1, eq: 1, merid: 0.15, eddy: 0.3 },      // slow super-rotation
  earth: { U: 5.5, bands: 3, eq: -1, merid: 0.3, eddy: 0.45 },
  mars: { U: 6, bands: 2, eq: -1, merid: 0.35, eddy: 0.5 },
  jupiter: { U: 14, bands: 11, eq: 1, merid: 0.05, eddy: 0.25 },   // many sharp jets
  saturn: { U: 16, bands: 7, eq: 1, merid: 0.05, eddy: 0.22 },     // broad fast equatorial jet
  uranus: { U: 18, bands: 2, eq: -1, merid: 0.08, eddy: 0.25 },    // retrograde at the equator
  neptune: { U: 22, bands: 2, eq: -1, merid: 0.1, eddy: 0.35 },
  pluto: { U: 1.5, bands: 1, eq: -1, merid: 0.3, eddy: 0.4 },
};

export const WIND = Object.freeze({
  refHeight: 10,          // m: height the reference wind is defined at
  refRoughness: 0.03,     // m: roughness length of open grassland
  blendHeight: 60,        // m: above this the wind no longer feels the local surface
  eddyScale: 0.38,        // synoptic eddy size as a fraction of the body radius
  eddyPeriod: 420,        // s: time for an eddy to change
  gustLength: 90,         // m: lattice of the large gusts (the integral scale of turbulence)
  gustLength2: 34,        // m: second octave
  gustCycle: 96,          // s: re-seeding period of the travelling pattern (two phases blended)
  gustGain: 2.3,          // peak gust = mean * (1 + I * gustGain): about 1.4 over grass
  minFactor: 0.25,        // a lull never drops below this fraction of the mean
});

const seeds = {};
function seedOf(bodyId, seed) {
  const k = bodyId + ':' + seed;
  return seeds[k] || (seeds[k] = hashString('wind-' + k) | 0);
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
// Returns -1..1 (0 = the mean wind, +1 a strong gust, -1 a deep lull).
// Two copies of the pattern, half a cycle apart, are advected for at most one cycle each and
// cross-faded, so the pattern travels for ever without shearing itself to noise.
export function gustLevel(bodyId, px, py, pz, wx, wy, wz, t, seed) {
  const s = seedOf(bodyId, seed) + 101;
  const T = WIND.gustCycle;
  const a = t / T, c1 = Math.floor(a), f1 = a - c1;
  const b = a + 0.5, c2 = Math.floor(b), f2 = b - c2;
  const w1 = 1 - Math.abs(2 * f1 - 1), w2 = 1 - w1;
  const k1 = 1 / WIND.gustLength, k2 = 1 / WIND.gustLength2;
  let g = 0;
  if (w1 > 0.001) {
    const tau = (f1 - 0.5) * T, o = hash1(c1, s) * 977;
    const x = px - wx * tau, y = py - wy * tau, z = pz - wz * tau;
    g += w1 * (noise3(x * k1 + o, y * k1, z * k1 - o, s) * 0.7 + noise3(x * k2 - o, y * k2 + o, z * k2, s + 7) * 0.42);
  }
  if (w2 > 0.001) {
    const tau = (f2 - 0.5) * T, o = hash1(c2, s + 55) * 977;
    const x = px - wx * tau, y = py - wy * tau, z = pz - wz * tau;
    g += w2 * (noise3(x * k1 + o, y * k1, z * k1 - o, s + 3) * 0.7 + noise3(x * k2 - o, y * k2 + o, z * k2, s + 11) * 0.42);
  }
  // blending two independent patterns lowers the variance; put it back
  g /= Math.sqrt(w1 * w1 + w2 * w2);
  return clamp(g * 1.35, -1, 1);
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

export function hasAir(bodyId) {
  const W = WINDS[bodyId];
  return !!W && W.U > 0 && (BODIES[bodyId].atmosphereHeight || 0) > 0;
}
