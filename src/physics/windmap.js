// Painted Cosmos physics: THE WIND MAP OF A WHOLE WORLD. OWNER: PHYSICS (group D, the WIND lane). Pure (no three, no DOM).
// docs/lead/WEATHER-DESIGN.md sections 5 and 9.1. Behind wx2.js WX2.windmap: with it off nothing here runs.
//
// Until now the wind felt the land only inside the 256 m grid round the player (air.js AirGrid: shelter from higher
// ground upwind, the slope's speed-up, the wakes of trees). Beyond it there was no land at all: no wind funnelled down a
// valley, no gust in a pass, no calm in a big lee, no air running up the sunny slopes by day or draining down them at
// night, no breeze off a lake, and NO VERTICAL MOTION ANYWHERE - so nothing could say "air is forced up here, so cloud
// forms here", and no storm could be born where the land makes storms. This is that, for the whole planet, coarse.
//
// TWO PARTS.
//  1. THE LAND, read once per world (static): on a cube-sphere grid of WINDMAP.N texels a face edge (32: 196 m on
//     Earth's 4 km), the land's height (the liquid's level where it stands over the ground), smoothed at about 400 m
//     (H1) and 1.2 km (H2); the relief (h - H2: ridges and peaks +, valleys and basins -); the slope at 400 m; the
//     valley axis and how confined the valley is; passes (saddles); the share under water; how readily the ground
//     heats (rock and meadow more, a wood less, water least, snow little); and the world's CONVECTION SITES: the peaks,
//     ridges and hot basins where storms are born (weather.js uses them). Sampled in slices of WINDMAP.staticMs a frame
//     (24,576 sampleSurface calls on Earth: 192 ms on the build machine, warm), then analysed in one go.
//  2. THE WIND, every WINDMAP.period seconds (dynamic, in slices so no frame pays for it all): the large-scale wind
//     (wind.js windLarge, on a coarser lattice and interpolated), then the land's own:
//       over and round   speed-up on crests, shelter in the lee of higher ground upwind (Winstral's Sx at 400 m),
//       channelled       in a confined valley the cross-valley part is taken out and the along-valley part sped up,
//       gap jets         through a pass that lies along the wind,
//       thermal          anabatic up the slope by day in proportion to the sun and the ground's heating, katabatic
//                        down it at night, the lake and sea breeze across the shore (onshore by day, offshore at night),
//     and what the air does UP: LIFT (m/s at cloud base: the wind forced up the slope, plus thermals over sunny ground,
//     plus convergence) and the TRIGGER (0..1: how readily convection starts here now: lift, the afternoon's built-up
//     heat and moisture). And the wind ALOFT, what clouds drift with; aloft minus the 10 m wind is the shear that leans
//     a tower.
//
// THE SUN. The physics is handed the sun's body-local direction each frame (core/orbits.js sunDirLocal, a function of the
// game clock). The hour at a texel is the hour a player standing there sees (core/orbits.js sunHourAt, copied below and
// held equal by windmap.test.mjs): this world's clock is a real sun on a spinning body, so the afternoon arrives at
// different places at different times.
//
// The map is a field ON THE PLANET: every texel's vectors are along that texel's own east (Y x up) and north (up x east).
import { BODIES } from '../data/bodies.js';
import { windLarge, WINDS } from './wind.js';
import { coverAt } from './ground.js';
import { clamp, clamp01, smoothstep } from './util.js';

export const WINDMAP = Object.freeze({
  N: 32,                 // texels a face edge (6 x 32 x 32 = 6,144 on every world: 196 m on Earth)
  lat: 16,               // the large-scale wind's lattice a face edge (it is smooth over a third of the planet)
  sub: 2,                // land samples a texel each way (2 x 2)
  staticMs: 2,           // ms of land sampling a frame at most, when the caller times it
  staticBatch: 96,       // texels a frame when the caller does not (the tests: bit-exact)
  period: 2,             // s for a full refresh of the wind (MEASURED on the build machine: about 2.7 ms a full refresh when
                         // warm, so about 0.05 ms a frame at 30 a second; the wind it follows changes over minutes)
  smooth1: 4,            // 3 x 3 passes for H1 (sigma about 1.6 texels = 320 m on Earth)
  smooth2: 34,           // ... and on from H1 for H2 (sigma about 4.9 texels = 960 m)
  // over and round (Jackson and Hunt 1975: a fractional speed-up of about 2 H / L on a hill; Winstral's Sx for shelter)
  crestGain: 0.55,       // + on a crest whose relief is crestRelief and up
  crestRelief: 220,      // m
  leeLoss: 0.75,         // the deepest lee keeps 1 - this
  leeSteps: [200, 400, 650, 950],   // m upwind where the land is looked at for shelter
  bearings: 16,          // the shelter is worked out once looking upwind along this many bearings, and interpolated
  shelterMin: 0.2, shelterMax: 1.6,
  // channelled
  confineRelief: 80,     // m of valley depth (negative relief) at which a valley confines fully ...
  confineAniso: 0.35,    // ... when it is this anisotropic (|l1| - |l2|) / (|l1| + |l2|) and up
  alongGain: 0.3,        // the along-valley part is sped up by this at full confinement
  gapGain: 0.6,          // a pass lying along the wind
  // thermal (m/s; capped)
  anabatic: 14,          // m/s per unit slope at full sun on fully heating ground (10 degrees: about 2.5 m/s)
  anabaticMax: 3,
  katabatic: 10,         // m/s per unit slope on a clear night
  katabaticMax: 2,
  breezeDay: 3.0,        // m/s across a shore at full sun ...
  breezeNight: 1.0,      // ... and back at night
  breezeScale: 600,      // m: the shore's water share is felt over this
  // lift (m/s at cloud base)
  thermalLift: 0.9,      // over fully heating ground at full sun, against ground that heats as little as heatNeutral ...
  thermalPlain: 0.5,     // ... a plain gives this share of it; an elevated heat source (a peak, a ridge: relief 300 m and up)
                         // gives 1.3 of it: the slopes heat the air AT the height of the summits, where the air around is colder
  heatNeutral: 0.3,      // ... so water and snow, which heat less than that, SINK by day (the sea breeze's other half)
  convLift: 150,         // m/s of lift per (1/s) of convergence
  // the trigger
  triggerLift: [0.5, 1.8],     // m/s of lift from nothing to full: sunshine on a plain alone does not set a storm going
  heatHours: [9.5, 14.5, 17.0, 19.5],   // the afternoon's built-up heat rises from the first to the second hour, falls from the third to the fourth
  // aloft: what clouds drift with (air.js aloftFactor at the cloud base, and a tenth of the land's own terms)
  cloudBase: 350,        // m above the land at which the aloft wind is taken
  aloftGain: 1.2,        // (air.js AIR.aloftGain)
  aloftLand: 0.1,
  // the world's convection sites
  sitesMax: 128,         // (W3.2: 64, the great peaks only; the range's front over the wood had none: weather.js stormswing)
  siteSpacing: 450,      // m between two sites at least
  siteMin: 0.12,         // a site scores at least this
});

// ---- the cube sphere (the same mapping as src/world/cubesphere.js, which the physics may not import; held equal by
// windmap.test.mjs) ----------------------------------------------------------------------------------------------------
export const FACES = [
  { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
];
const QP = Math.PI / 4;
export function faceToDir(face, u, v, out) {
  const f = FACES[face];
  const a = Math.tan(u * QP), b = Math.tan(v * QP);
  const x = f.n[0] + a * f.u[0] + b * f.v[0], y = f.n[1] + a * f.u[1] + b * f.v[1], z = f.n[2] + a * f.u[2] + b * f.v[2];
  const il = 1 / Math.sqrt(x * x + y * y + z * z);
  out[0] = x * il; out[1] = y * il; out[2] = z * il;
  return out;
}
export function dirToFace(x, y, z, out) {
  const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
  let face;
  if (ax >= ay && ax >= az) face = x > 0 ? 0 : 1;
  else if (ay >= az) face = y > 0 ? 2 : 3;
  else face = z > 0 ? 4 : 5;
  const f = FACES[face];
  const d = x * f.n[0] + y * f.n[1] + z * f.n[2];
  const a = (x * f.u[0] + y * f.u[1] + z * f.u[2]) / d, b = (x * f.v[0] + y * f.v[1] + z * f.v[2]) / d;
  out.face = face; out.u = Math.atan(a) / QP; out.v = Math.atan(b) / QP;
  return out;
}
// texel index of a unit direction (the nearest texel's centre), and its texel coordinates
const _fc = { face: 0, u: 0, v: 0 };
export function texelOf(N, x, y, z) {
  dirToFace(x, y, z, _fc);
  const i = clamp(Math.floor((_fc.u + 1) * 0.5 * N), 0, N - 1), j = clamp(Math.floor((_fc.v + 1) * 0.5 * N), 0, N - 1);
  return (_fc.face * N + j) * N + i;
}

// The world's hour at body-local unit direction d for a sun at body-local s (core/orbits.js sunHourAt, PILOT's; copied
// because the physics may not import core/; windmap.test.mjs holds the two equal).
export function sunHourAt(s, d) {
  let ex = d.z, ez = -d.x;
  const el = Math.hypot(ex, ez);
  if (el < 1e-6) { ex = 1; ez = 0; } else { ex /= el; ez /= el; }
  const se = s.x * ex + s.z * ez, e = s.x * d.x + s.y * d.y + s.z * d.z;
  let h = 12 + (Math.atan2(-se, e) * 12) / Math.PI;
  h %= 24;
  if (h < 0) h += 24;
  return h;
}

// How much of the afternoon's heat has built up at hour h (0..1): convection needs the ground warmed through, so it
// waits for the late morning and peaks through the afternoon, whatever the sun's height at that moment.
export function heatBuilt(h) {
  const H = WINDMAP.heatHours;
  return smoothstep(H[0], H[1], h) * (1 - smoothstep(H[2], H[3], h));
}

// How readily a ground heats under the sun (0..1.1), from what coverAt says of it: a closed wood shades its own floor and
// spends the sun on water; wet ground spends it evaporating; a dusty dry ground is the hottest; snow throws the sun back.
export function groundHeat(cov, water01) {
  let h = 1.0 - 0.45 * clamp01(cov.canopy01 || 0) - 0.35 * clamp01((cov.moist || 1) - 1) + 0.15 * clamp01(cov.dustSource || 0);
  if ((cov.snowBase || 0) > 0.03) h = Math.min(h, 0.25);
  h = h * (1 - water01) + 0.1 * water01;
  return clamp(h, 0.05, 1.1);
}

// ---- the map -------------------------------------------------------------------------------------------------------
const _d = [0, 0, 0], _w = new Float64Array(4), _cov = {}, _hp = { x: 0, y: 1, z: 0 };

export class WindMap {
  constructor(seed = 18) {
    const N = WINDMAP.N, T = 6 * N * N;
    this.seed = seed;
    this.N = N; this.count = T;
    this.bodyId = null;
    // per texel: the centre (body-local unit), its east and north
    this.cx = new Float32Array(T); this.cy = new Float32Array(T); this.cz = new Float32Array(T);
    this.ex = new Float32Array(T); this.ez = new Float32Array(T);
    this.nx = new Float32Array(T); this.ny = new Float32Array(T); this.nz = new Float32Array(T);
    // the eight neighbours (E, W, N, S, NE, NW, SE, SW) and where each lies in this texel's tangent plane (m)
    this.nb = new Int32Array(T * 8); this.nbE = new Float32Array(T * 8); this.nbN = new Float32Array(T * 8);
    // least-squares weights that turn the nine values (centre, then the eight) into the slope along east and north
    this.gwE = new Float32Array(T * 9); this.gwN = new Float32Array(T * 9);
    // THE LAND (static)
    const F = () => new Float32Array(T);
    this.land = {
      ready: false, progress: 0,
      h: F(), H1: F(), H2: F(), relief: F(), gradE: F(), gradN: F(),
      axisE: F(), axisN: F(), aniso: F(), confine: F(), saddle: F(),
      water: F(), heat: F(), moist: F(), W1: F(), wgE: F(), wgN: F(),
    };
    this.sites = [];
    // the land's shelter angle (Winstral's Sx, radians) looking UPWIND toward each of WINDMAP.bearings bearings (east = 0,
    // then counter-clockwise toward north), worked out once with the land so the refresh only interpolates it
    this.sxB = new Float32Array(T * WINDMAP.bearings);
    // THE WIND (dynamic)
    this.e10 = F(); this.n10 = F(); this.aloftE = F(); this.aloftN = F();
    this.lift = F(); this.trigger = F(); this.shelter = F().fill(1);
    this.shelterLee = F().fill(1);                       // the shelter's lee part alone (what the near grid, which has its own crest, takes)
    this.ux3 = F(); this.uy3 = F(); this.uz3 = F();      // the 10 m wind body-local (for the convergence)
    this.conv = F();                                     // convergence last refresh (1/s)
    this.shade = F();                                    // cloud cover over the texel, handed in by the cloud map (0 until then)
    this.ready = false;                                  // a full refresh has been made since the land was read
    this.version = 0;                                    // + 1 at every full refresh
    this.t = 0;                                          // the game time of the last full refresh
    // the large-scale wind's lattice: (lat + 1)^2 nodes a face, body-local vectors
    const L = WINDMAP.lat + 1;
    this.latW = new Float32Array(6 * L * L * 3);
    this._cursor = 0; this._staticCursor = 0; this._cycleLand = false;
    this._sun = { x: 0, y: 1, z: 0 }; this._hasSun = false;
    this._frame();
  }

  // the texels' centres, frames, neighbours and slope weights: the same on every world (the grid is in unit directions)
  _frame() {
    const N = this.N, T = this.count, a = (Math.PI / 2) / N;
    const dir = [0, 0, 0];
    for (let f = 0; f < 6; f++) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = (f * N + j) * N + i;
      faceToDir(f, (i + 0.5) / N * 2 - 1, (j + 0.5) / N * 2 - 1, dir);
      this.cx[k] = dir[0]; this.cy[k] = dir[1]; this.cz[k] = dir[2];
      let ex = dir[2], ez = -dir[0];
      const el = Math.hypot(ex, ez);
      if (el < 1e-9) { ex = 1; ez = 0; } else { ex /= el; ez /= el; }
      this.ex[k] = ex; this.ez[k] = ez;
      this.nx[k] = dir[1] * ez; this.ny[k] = dir[2] * ex - dir[0] * ez; this.nz[k] = -dir[1] * ex;
    }
    const OFF = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    for (let k = 0; k < T; k++) {
      const cx = this.cx[k], cy = this.cy[k], cz = this.cz[k];
      for (let m = 0; m < 8; m++) {
        const de = OFF[m][0] * a, dn = OFF[m][1] * a;
        let x = cx + de * this.ex[k] + dn * this.nx[k], y = cy + dn * this.ny[k], z = cz + de * this.ez[k] + dn * this.nz[k];
        const l = Math.hypot(x, y, z); x /= l; y /= l; z /= l;
        let q = texelOf(N, x, y, z);
        if (q === k) {      // (at a cube corner a step can land back in the same texel: take the next one out)
          x = cx + 2 * de * this.ex[k] + 2 * dn * this.nx[k]; y = cy + 2 * dn * this.ny[k]; z = cz + 2 * de * this.ez[k] + 2 * dn * this.nz[k];
          const l2 = Math.hypot(x, y, z); q = texelOf(N, x / l2, y / l2, z / l2);
        }
        this.nb[k * 8 + m] = q;
        // where its centre lies in this texel's tangent plane, in unit-sphere units (times the radius when used)
        this.nbE[k * 8 + m] = this.cx[q] * this.ex[k] + this.cz[q] * this.ez[k];
        this.nbN[k * 8 + m] = this.cx[q] * this.nx[k] + this.cy[q] * this.ny[k] + this.cz[q] * this.nz[k];
      }
      this._slopeWeights(k);
    }
  }

  // Least squares of F = a + b e + c n + d e^2 / 2 + f e n + g n^2 / 2 over the centre and its eight neighbours: the rows
  // of the pseudo-inverse that give b and c, so the slope of ANY field is nine multiplies (unit-sphere units: divide by R).
  _slopeWeights(k) {
    const M = new Float64Array(36), P = [];
    const pts = [[0, 0]];
    for (let m = 0; m < 8; m++) pts.push([this.nbE[k * 8 + m], this.nbN[k * 8 + m]]);
    for (const [e, n] of pts) P.push([1, e, n, 0.5 * e * e, e * n, 0.5 * n * n]);
    for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) { let s = 0; for (const row of P) s += row[r] * row[c]; M[r * 6 + c] = s; }
    const inv = invert6(M);
    if (!inv) { for (let q = 0; q < 9; q++) { this.gwE[k * 9 + q] = 0; this.gwN[k * 9 + q] = 0; } return; }
    for (let q = 0; q < 9; q++) {
      let sb = 0, sc = 0;
      for (let c = 0; c < 6; c++) { sb += inv[1 * 6 + c] * P[q][c]; sc += inv[2 * 6 + c] * P[q][c]; }
      this.gwE[k * 9 + q] = sb; this.gwN[k * 9 + q] = sc;
    }
    // (the Hessian's rows are taken where they are needed: _hessian)
  }

  // the slope of a field at texel k along its east and north (per metre on a world of radius R)
  slope(F, k, R, o) {
    let se = this.gwE[k * 9] * F[k], sn = this.gwN[k * 9] * F[k];
    for (let m = 0; m < 8; m++) { const v = F[this.nb[k * 8 + m]]; se += this.gwE[k * 9 + 1 + m] * v; sn += this.gwN[k * 9 + 1 + m] * v; }
    o[0] = se / R; o[1] = sn / R;
    return o;
  }

  // ---- THE LAND --------------------------------------------------------------------------------------------------
  // Read the land of a world: all at once (tests, a warm-up) when budget is Infinity, else in slices. sample(dir) is
  // sampleSurface bound to the body (a {x,y,z} unit direction in, the surface sample out). clock: a ms clock or null.
  // Returns true once the land is read.
  readLand(bodyId, sample, clock = null, budgetMs = WINDMAP.staticMs, batch = WINDMAP.staticBatch) {
    if (bodyId !== this.bodyId) this._reset(bodyId);
    const L = this.land;
    if (L.ready) return true;
    const N = this.N, T = this.count, S = WINDMAP.sub, R = BODIES[bodyId].radius;
    const t0 = clock ? clock() : 0;
    const dir = { x: 0, y: 0, z: 0 }, d3 = [0, 0, 0];
    let k = this._staticCursor, n = 0;
    for (; k < T; k++) {
      if (clock ? (n > 0 && clock() - t0 > budgetMs) : n >= batch) break;
      const f = Math.floor(k / (N * N)), j = Math.floor(k / N) % N, i = k % N;
      let hs = 0, wet = 0, heat = 0, moist = 0;
      for (let b = 0; b < S; b++) for (let a = 0; a < S; a++) {
        faceToDir(f, (i + (a + 0.5) / S) / N * 2 - 1, (j + (b + 0.5) / S) / N * 2 - 1, d3);
        dir.x = d3[0]; dir.y = d3[1]; dir.z = d3[2];
        const s = sample(dir);
        const lr = s.liquidRadius || 0, under = lr > s.radius ? 1 : 0;
        hs += Math.max(s.radius, lr) - R;
        wet += under;
        coverAt(bodyId, s, _cov);
        heat += groundHeat(_cov, under);
        moist += _cov.moist == null ? 1 : _cov.moist;
      }
      const q = S * S;
      L.h[k] = hs / q; L.water[k] = wet / q; L.heat[k] = heat / q; L.moist[k] = moist / q;
      n++;
    }
    this._staticCursor = k;
    L.progress = k / T;
    if (k < T) return false;
    this._analyse(R);
    L.ready = true;
    return true;
  }

  _reset(bodyId) {
    this.bodyId = bodyId;
    this.land.ready = false; this.land.progress = 0; this._staticCursor = 0;
    this.sites = [];
    this.ready = false; this._cursor = 0; this.version = 0;
    this.shelter.fill(1); this.shelterLee.fill(1); this.lift.fill(0); this.trigger.fill(0); this.conv.fill(0); this.shade.fill(0);
    this.e10.fill(0); this.n10.fill(0); this.aloftE.fill(0); this.aloftN.fill(0);
  }

  // passes of a 3 x 3 binomial blur on the sphere (the neighbour table crosses the cube's seams), src -> dst
  _smooth(src, dst, passes) {
    const T = this.count, nb = this.nb;
    if (passes <= 0) { dst.set(src); return dst; }
    let a = new Float32Array(src), b = new Float32Array(T);
    for (let p = 0; p < passes; p++) {
      for (let k = 0; k < T; k++) {
        const o = k * 8;
        b[k] = (4 * a[k] + 2 * (a[nb[o]] + a[nb[o + 1]] + a[nb[o + 2]] + a[nb[o + 3]]) + a[nb[o + 4]] + a[nb[o + 5]] + a[nb[o + 6]] + a[nb[o + 7]]) / 16;
      }
      const t = a; a = b; b = t;
    }
    dst.set(a);
    return dst;
  }

  _analyse(R) {
    const L = this.land, T = this.count, W = WINDMAP;
    this._smooth(L.h, L.H1, W.smooth1);
    this._smooth(L.H1, L.H2, W.smooth2);
    this._smooth(L.water, L.W1, Math.round(W.smooth1 * (W.breezeScale / 320) ** 2));
    const g = [0, 0];
    for (let k = 0; k < T; k++) {
      L.relief[k] = L.h[k] - L.H2[k];
      this.slope(L.H1, k, R, g); L.gradE[k] = g[0]; L.gradN[k] = g[1];
      this.slope(L.W1, k, R, g); L.wgE[k] = g[0]; L.wgN[k] = g[1];
    }
    // the Hessian of H1 by differences of its slope: the valley axis (the direction it curves least), how anisotropic, saddles
    const gE = L.gradE, gN = L.gradN, h1 = [0, 0], h2 = [0, 0];
    for (let k = 0; k < T; k++) {
      this.slope(gE, k, R, h1); this.slope(gN, k, R, h2);
      const hee = h1[0], hen = 0.5 * (h1[1] + h2[0]), hnn = h2[1];
      // eigen of [[hee, hen], [hen, hnn]]
      const tr = 0.5 * (hee + hnn), dd = Math.sqrt(Math.max(0, 0.25 * (hee - hnn) * (hee - hnn) + hen * hen));
      const l1 = tr + dd, l2 = tr - dd;                                   // l1 >= l2
      const small = Math.abs(l1) < Math.abs(l2) ? l1 : l2;               // the axis curves least
      let ae = hen, an = small - hee;                                     // eigenvector of `small`
      if (Math.abs(ae) + Math.abs(an) < 1e-12) { ae = small === l1 ? (hee >= hnn ? 1 : 0) : (hee >= hnn ? 0 : 1); an = 1 - ae; }
      const al = Math.hypot(ae, an) || 1; ae /= al; an /= al;
      L.axisE[k] = ae; L.axisN[k] = an;
      const aniso = (Math.abs(l1) + Math.abs(l2)) > 1e-12 ? Math.abs(Math.abs(l1) - Math.abs(l2)) / (Math.abs(l1) + Math.abs(l2)) : 0;
      L.aniso[k] = aniso;
      L.confine[k] = clamp01(-L.relief[k] / W.confineRelief) * smoothstep(0, W.confineAniso, aniso);
      // a pass: curved up across it and down along it, at the depth of the ridgeline's notch
      // (and flat there: the foot of a cone curves the same two ways, but its ground falls away; a pass is level along its axis)
      L.saddle[k] = l1 > 0 && l2 < 0 ? clamp01(Math.sqrt(-l1 * l2) * 9e3) * smoothstep(-40, 40, L.relief[k] + 60) * (1 - smoothstep(0.03, 0.09, Math.hypot(L.gradE[k], L.gradN[k]))) : 0;
    }
    this._shelterTable(R);
    this._findSites(R);
  }

  _shelterTable(R) {
    const L = this.land, T = this.count, W = WINDMAP;
    for (let k = 0; k < T; k++) {
      const ex = this.ex[k], ez = this.ez[k], nx = this.nx[k], ny = this.ny[k], nz = this.nz[k];
      const NB = W.bearings;
      for (let m = 0; m < NB; m++) {
        const be = Math.cos(m * 2 * Math.PI / NB), bn = Math.sin(m * 2 * Math.PI / NB);   // the bearing looked along (upwind)
        let sx = -1;
        for (const dd of W.leeSteps) {
          const a = dd / R;
          let x = this.cx[k] + a * (be * ex + bn * nx), y = this.cy[k] + a * (bn * ny), z = this.cz[k] + a * (be * ez + bn * nz);
          const l = Math.hypot(x, y, z);
          const q = texelOf(this.N, x / l, y / l, z / l);
          const e = Math.atan2(L.H1[q] - L.h[k], dd);
          if (e > sx) sx = e;
        }
        this.sxB[k * NB + m] = sx;
      }
    }
  }

  _findSites(R) {
    const L = this.land, T = this.count, W = WINDMAP;
    const score = new Float32Array(T);
    for (let k = 0; k < T; k++) {
      if (L.water[k] > 0.5) continue;
      const slope = Math.hypot(L.gradE[k], L.gradN[k]);
      // (a lesser hill grows lesser storms, and fewer of them, but it grows them: the range's great peaks do not take every
      //  site, so a wood under a line of low hills sees storms born over its own hills too)
      const peak = Math.sqrt(smoothstep(20, 650, L.relief[k])) * L.heat[k] * (0.6 + 0.4 * smoothstep(0.04, 0.3, slope));
      const basin = smoothstep(30, 120, -L.relief[k]) * smoothstep(0.85, 1.05, L.heat[k]) * (1 - smoothstep(0.3, 0.8, L.moist[k]));
      score[k] = Math.max(peak, basin * 0.8);
    }
    const order = Array.from({ length: T }, (_, k) => k).sort((a, b) => score[b] - score[a]);
    const sites = [], top = score[order[0]] || 1;
    const minDot = Math.cos(W.siteSpacing / R);
    for (const k of order) {
      if (score[k] < W.siteMin || sites.length >= W.sitesMax) break;
      const x = this.cx[k], y = this.cy[k], z = this.cz[k];
      let ok = true;
      for (const s of sites) if (s.x * x + s.y * y + s.z * z > minDot) { ok = false; break; }
      if (!ok) continue;
      const kind = L.relief[k] < 0 ? 'basin' : L.aniso[k] > 0.6 ? 'ridge' : 'peak';
      sites.push({ x, y, z, w: score[k] / top, kind, k });
    }
    this.sites = sites;
  }

  // ---- THE WIND ----------------------------------------------------------------------------------------------------
  // One frame's slice of the refresh. sunDir: body-local unit toward the sun, or null (no thermal terms, no sun).
  // Call every frame after readLand; dt drives the slice so a full refresh takes WINDMAP.period whatever the frame rate.
  step(dt, bodyId, t, sunDir) {
    if (bodyId !== this.bodyId) this._reset(bodyId);
    if (sunDir) { this._sun.x = sunDir.x; this._sun.y = sunDir.y; this._sun.z = sunDir.z; this._hasSun = true; } else this._hasSun = false;
    const L1 = WINDMAP.lat + 1, nLat = 6 * L1 * L1, total = nLat + this.count;
    let n = Math.ceil(total * Math.max(0, dt) / WINDMAP.period);
    if (!this.ready) n = Math.max(n, Math.ceil(total / 8));        // the first refresh is made quickly
    this._run(bodyId, t, n);
  }
  // A whole refresh now (tests, a warm-up, an arrival).
  refresh(bodyId, t, sunDir) {
    if (bodyId !== this.bodyId) this._reset(bodyId);
    if (sunDir) { this._sun.x = sunDir.x; this._sun.y = sunDir.y; this._sun.z = sunDir.z; this._hasSun = true; } else this._hasSun = false;
    const L1 = WINDMAP.lat + 1;
    this._cursor = 0;
    this._run(bodyId, t, 6 * L1 * L1 + this.count);
  }

  _run(bodyId, t, n) {
    const L1 = WINDMAP.lat + 1, nLat = 6 * L1 * L1, total = nLat + this.count;
    for (let q = 0; q < n; q++) {
      const c = this._cursor;
      if (c === 0) this._cycleLand = this.land.ready;
      if (c < nLat) this._latticeNode(bodyId, t, c);
      else this._texel(bodyId, t, c - nLat);
      this._cursor = c + 1;
      if (this._cursor >= total) {
        this._cursor = 0; this.version++; this.t = t;
        if (this._cycleLand) this.ready = true;
        this._convergence(BODIES[bodyId].radius);
      }
    }
  }

  _latticeNode(bodyId, t, c) {
    const L1 = WINDMAP.lat + 1, f = Math.floor(c / (L1 * L1)), j = Math.floor(c / L1) % L1, i = c % L1;
    faceToDir(f, i / WINDMAP.lat * 2 - 1, j / WINDMAP.lat * 2 - 1, _d);
    windLarge(bodyId, _d[0], _d[1], _d[2], t, this.seed, _w);
    this.latW[c * 3] = _w[0]; this.latW[c * 3 + 1] = _w[1]; this.latW[c * 3 + 2] = _w[2];
  }

  // the large-scale wind at texel k, body-local, interpolated on its face's lattice
  _large(k, o) {
    const N = this.N, L1 = WINDMAP.lat + 1, f = Math.floor(k / (N * N)), j = Math.floor(k / N) % N, i = k % N;
    const x = (i + 0.5) / N * WINDMAP.lat, y = (j + 0.5) / N * WINDMAP.lat;
    const i0 = Math.min(WINDMAP.lat - 1, Math.floor(x)), j0 = Math.min(WINDMAP.lat - 1, Math.floor(y)), fx = x - i0, fy = y - j0;
    const b = f * L1 * L1, W = this.latW;
    for (let a = 0; a < 3; a++) {
      const v00 = W[(b + j0 * L1 + i0) * 3 + a], v10 = W[(b + j0 * L1 + i0 + 1) * 3 + a], v01 = W[(b + (j0 + 1) * L1 + i0) * 3 + a], v11 = W[(b + (j0 + 1) * L1 + i0 + 1) * 3 + a];
      o[a] = (v00 * (1 - fx) + v10 * fx) * (1 - fy) + (v01 * (1 - fx) + v11 * fx) * fy;
    }
    return o;
  }

  _texel(bodyId, t, k) {
    const L = this.land, W = WINDMAP, R = BODIES[bodyId].radius;
    const ex = this.ex[k], ez = this.ez[k], nx = this.nx[k], ny = this.ny[k], nz = this.nz[k];
    this._large(k, _d);
    // project onto the texel's tangent plane (the lattice's vector belongs to a place a little way off)
    const u0e = _d[0] * ex + _d[2] * ez, u0n = _d[0] * nx + _d[1] * ny + _d[2] * nz;
    let ue = u0e, un = u0n, s = 1, sLee = 1;
    if (L.ready) {
      const sp0 = Math.hypot(u0e, u0n);
      // over and round: the crest's speed-up, the lee of higher land upwind
      if (sp0 > 0.05) {
        // (the shelter angle looking upwind, interpolated between the two nearest bearings of the table)
        const NB = W.bearings;
        let ph = Math.atan2(-u0n, -u0e) * (NB / (2 * Math.PI)); if (ph < 0) ph += NB;
        const m0 = Math.floor(ph) % NB, m1 = (m0 + 1) % NB, fm = ph - Math.floor(ph);
        const sx = this.sxB[k * NB + m0] * (1 - fm) + this.sxB[k * NB + m1] * fm;
        sLee = 1 - W.leeLoss * smoothstep(0.03, 0.28, sx);
        s = sLee + W.crestGain * smoothstep(0, W.crestRelief, L.relief[k]) * (1 - smoothstep(0.0, 0.15, sx));
        // channelled down a confined valley; a gap jet through a pass that lies along the wind
        const c = L.confine[k], ae = L.axisE[k], an = L.axisN[k];
        const ua = ue * ae + un * an, uc = -ue * an + un * ae;
        const along = ua * (1 + W.alongGain * c), across = uc * (1 - c);
        ue = along * ae - across * an; un = along * an + across * ae;
        if (L.saddle[k] > 0) { const g = 1 + W.gapGain * L.saddle[k] * Math.abs(ua) / sp0; ue *= g; un *= g; }
      }
      s = clamp(s, W.shelterMin, W.shelterMax);
      ue *= s; un *= s;
      // thermal
      if (this._hasSun) {
        const sun = this._sun, cx = this.cx[k], cy = this.cy[k], cz = this.cz[k];
        const up = sun.x * cx + sun.y * cy + sun.z * cz;
        const day = clamp01(up / 0.6), night = 1 - smoothstep(-0.15, 0.05, up);
        const ge = L.gradE[k], gn = L.gradN[k];
        let ae2 = W.anabatic * day * L.heat[k] * ge, an2 = W.anabatic * day * L.heat[k] * gn;
        let l = Math.hypot(ae2, an2); if (l > W.anabaticMax) { ae2 *= W.anabaticMax / l; an2 *= W.anabaticMax / l; }
        let ke = -W.katabatic * night * ge, kn = -W.katabatic * night * gn;
        l = Math.hypot(ke, kn); if (l > W.katabaticMax) { ke *= W.katabaticMax / l; kn *= W.katabaticMax / l; }
        // the breeze blows from the water toward the land by day (down the water share's slope), back at night
        const bk = (W.breezeDay * day - W.breezeNight * night) * W.breezeScale;
        let be = -L.wgE[k] * bk, bn = -L.wgN[k] * bk;
        l = Math.hypot(be, bn); const bm = Math.max(W.breezeDay, W.breezeNight); if (l > bm) { be *= bm / l; bn *= bm / l; }
        if (thermalOn()) { ue += ae2 + ke + be; un += an2 + kn + bn; }
      }
    }
    this.e10[k] = ue; this.n10[k] = un; this.shelter[k] = s; this.shelterLee[k] = clamp(sLee, W.shelterMin, W.shelterMax);
    this.ux3[k] = ue * ex + un * nx; this.uy3[k] = un * ny; this.uz3[k] = ue * ez + un * nz;
    // what the air does up
    let lift = 0, trig = 0;
    if (L.ready) {
      lift = ue * L.gradE[k] + un * L.gradN[k];                                  // forced up the slope
      if (this._hasSun) {
        const sun = this._sun, up = sun.x * this.cx[k] + sun.y * this.cy[k] + sun.z * this.cz[k];
        lift += W.thermalLift * clamp01(up / 0.6) * (L.heat[k] - W.heatNeutral) / (1 - W.heatNeutral) * (1 - clamp01(this.shade[k]))
          * (W.thermalPlain + (1.3 - W.thermalPlain) * smoothstep(0, 300, L.relief[k]));
        _hp.x = this.cx[k]; _hp.y = this.cy[k]; _hp.z = this.cz[k];
        const hour = sunHourAt(sun, _hp);
        lift += W.convLift * this.conv[k];
        trig = smoothstep(W.triggerLift[0], W.triggerLift[1], lift) * heatBuilt(hour) * clamp01(L.moist[k] / 0.9) * (1 - L.water[k]);
      } else lift += W.convLift * this.conv[k];
    }
    this.lift[k] = lift; this.trigger[k] = trig;
    // aloft: the large-scale wind made stronger with height, and a tenth of what the land did to it
    const atm = BODIES[bodyId].atmosphereHeight || 0;
    const fa = atm > 60 ? 1 + W.aloftGain * smoothstep(60, Math.max(atm * 0.6, 61), W.cloudBase) : 1;
    this.aloftE[k] = u0e * fa + W.aloftLand * (ue - u0e);
    this.aloftN[k] = u0n * fa + W.aloftLand * (un - u0n);
  }

  // convergence (- divergence of the 10 m wind) at every texel, from this refresh's winds, used by the next
  _convergence(R) {
    const T = this.count;
    for (let k = 0; k < T; k++) {
      // the wind's east and north components in THIS texel's frame, at the nine points
      const ex = this.ex[k], ez = this.ez[k], nx = this.nx[k], ny = this.ny[k], nz = this.nz[k];
      let dE = 0, dN = 0;
      const pts = 9;
      for (let q = 0; q < pts; q++) {
        const p = q === 0 ? k : this.nb[k * 8 + q - 1];
        const we = this.ux3[p] * ex + this.uz3[p] * ez, wn = this.ux3[p] * nx + this.uy3[p] * ny + this.uz3[p] * nz;
        dE += this.gwE[k * 9 + q] * we; dN += this.gwN[k * 9 + q] * wn;
      }
      this.conv[k] = -(dE + dN) / R;
    }
  }

  // ---- reading ---------------------------------------------------------------------------------------------------
  // Bilinear read at body-local unit direction (ux,uy,uz). Fills out: e10, n10 (m/s along THE QUERY POINT's own east and
  // north: the texels' frames are within a few degrees of it), aloftE, aloftN, lift, trigger, shelter. Returns out.
  at(ux, uy, uz, out) {
    const N = this.N;
    dirToFace(ux, uy, uz, _fc);
    const x = clamp((_fc.u + 1) * 0.5 * N - 0.5, 0, N - 1), y = clamp((_fc.v + 1) * 0.5 * N - 0.5, 0, N - 1);
    const i0 = Math.min(N - 2, Math.floor(x)), j0 = Math.min(N - 2, Math.floor(y)), fx = x - i0, fy = y - j0;
    const b = _fc.face * N * N;
    const k00 = b + j0 * N + i0, k10 = k00 + 1, k01 = k00 + N, k11 = k01 + 1;
    const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
    const B = (A) => A[k00] * w00 + A[k10] * w10 + A[k01] * w01 + A[k11] * w11;
    // vectors: through body-local, then onto the query point's own frame (exact at any texel's orientation)
    let ex = uz, ez = -ux; const el = Math.hypot(ex, ez); if (el < 1e-9) { ex = 1; ez = 0; } else { ex /= el; ez /= el; }
    const nx = uy * ez, ny = uz * ex - ux * ez, nz = -uy * ex;
    const vx = B(this.ux3), vy = B(this.uy3), vz = B(this.uz3);
    out.e10 = vx * ex + vz * ez; out.n10 = vx * nx + vy * ny + vz * nz;
    let ax = 0, ay = 0, az = 0;
    for (const [kk, w] of [[k00, w00], [k10, w10], [k01, w01], [k11, w11]]) {
      ax += w * (this.aloftE[kk] * this.ex[kk] + this.aloftN[kk] * this.nx[kk]);
      ay += w * (this.aloftN[kk] * this.ny[kk]);
      az += w * (this.aloftE[kk] * this.ez[kk] + this.aloftN[kk] * this.nz[kk]);
    }
    out.aloftE = ax * ex + az * ez; out.aloftN = ax * nx + ay * ny + az * nz;
    out.lift = B(this.lift); out.trigger = B(this.trigger); out.shelter = B(this.shelter);
    return out;
  }
  // The 10 m wind at body-local unit direction as a body-local vector o[0..2] (m/s), o[3] its speed.
  vecAt(ux, uy, uz, o) {
    const N = this.N;
    dirToFace(ux, uy, uz, _fc);
    const x = clamp((_fc.u + 1) * 0.5 * N - 0.5, 0, N - 1), y = clamp((_fc.v + 1) * 0.5 * N - 0.5, 0, N - 1);
    const i0 = Math.min(N - 2, Math.floor(x)), j0 = Math.min(N - 2, Math.floor(y)), fx = x - i0, fy = y - j0;
    const b = _fc.face * N * N, k00 = b + j0 * N + i0, k10 = k00 + 1, k01 = k00 + N, k11 = k01 + 1;
    const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
    let x3 = this.ux3[k00] * w00 + this.ux3[k10] * w10 + this.ux3[k01] * w01 + this.ux3[k11] * w11;
    let y3 = this.uy3[k00] * w00 + this.uy3[k10] * w10 + this.uy3[k01] * w01 + this.uy3[k11] * w11;
    let z3 = this.uz3[k00] * w00 + this.uz3[k10] * w10 + this.uz3[k01] * w01 + this.uz3[k11] * w11;
    const dn = x3 * ux + y3 * uy + z3 * uz;           // (onto the tangent plane at the query point)
    x3 -= dn * ux; y3 -= dn * uy; z3 -= dn * uz;
    o[0] = x3; o[1] = y3; o[2] = z3; o[3] = Math.hypot(x3, y3, z3);
    return o;
  }
  // The same wind for the NEAR grid (air.js, ?nearmap=1): the map's crest speed-up taken back out, because the near grid
  // lays its own speed-up and shelter from the ground under each of its nodes; the lee of land beyond its own reach, the
  // valley's channelling, the gap jets and the thermal winds stay. Body-local o[0..2], o[3] its speed.
  nearVecAt(ux, uy, uz, o) {
    this.vecAt(ux, uy, uz, o);
    const N = this.N;
    dirToFace(ux, uy, uz, _fc);
    const x = clamp((_fc.u + 1) * 0.5 * N - 0.5, 0, N - 1), y = clamp((_fc.v + 1) * 0.5 * N - 0.5, 0, N - 1);
    const i0 = Math.min(N - 2, Math.floor(x)), j0 = Math.min(N - 2, Math.floor(y)), fx = x - i0, fy = y - j0;
    const b = _fc.face * N * N, k00 = b + j0 * N + i0, k10 = k00 + 1, k01 = k00 + N, k11 = k01 + 1;
    const r = (k) => this.shelterLee[k] / Math.max(1e-3, this.shelter[k]);
    const f = (r(k00) * (1 - fx) + r(k10) * fx) * (1 - fy) + (r(k01) * (1 - fx) + r(k11) * fx) * fy;
    o[0] *= f; o[1] *= f; o[2] *= f; o[3] *= f;
    return o;
  }
  // The texel index of a body-local unit direction (for readers that keep per-texel state of their own).
  texel(ux, uy, uz) { return texelOf(this.N, ux, uy, uz); }
}

let _thermal = true;
function thermalOn() { return _thermal; }
// (set by physics/index.js from wx2.js WX2.thermal; a function so the hot loop does not import the switch module)
export function setThermal(on) { _thermal = !!on; }

// Gauss-Jordan inverse of a 6 x 6 (row-major), or null when singular.
function invert6(M) {
  const n = 6, A = new Float64Array(72);
  for (let r = 0; r < n; r++) { for (let c = 0; c < n; c++) A[r * 12 + c] = M[r * n + c]; A[r * 12 + n + r] = 1; }
  for (let c = 0; c < n; c++) {
    let p = c, best = Math.abs(A[c * 12 + c]);
    for (let r = c + 1; r < n; r++) { const v = Math.abs(A[r * 12 + c]); if (v > best) { best = v; p = r; } }
    if (best < 1e-14) return null;
    if (p !== c) for (let q = 0; q < 12; q++) { const tt = A[c * 12 + q]; A[c * 12 + q] = A[p * 12 + q]; A[p * 12 + q] = tt; }
    const iv = 1 / A[c * 12 + c];
    for (let q = 0; q < 12; q++) A[c * 12 + q] *= iv;
    for (let r = 0; r < n; r++) if (r !== c) { const fct = A[r * 12 + c]; if (fct !== 0) for (let q = 0; q < 12; q++) A[r * 12 + q] -= fct * A[c * 12 + q]; }
  }
  const out = new Float64Array(36);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) out[r * n + c] = A[r * 12 + n + c];
  return out;
}

// for the tests and the lab: the large-scale wind with nothing of the land, at a texel (body-local)
export function windLargeAt(bodyId, ux, uy, uz, t, seed, o) { return windLarge(bodyId, ux, uy, uz, t, seed, o); }
export { WINDS };
