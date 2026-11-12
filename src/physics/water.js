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
// as four wave trains (in sets, with wakes) that PAINTER can draw and the JS twin can evaluate, so that a floating
// explorer rides the same waves that are painted. For the painter's own liquid material the
// chunk (WATER_GLSL) and its twin (WaterField.surfaceAt) give, at any point:
//   height and slope        to lift the surface and tilt its normal
//   along                   the way the crests lie there (the direction a stroke should run)
//   crest01                 0 on the flanks and in the troughs, 1 on the tops of the higher waves
//   line01                  the crest as a line: 1 along the very top of a high wave (P7)
//   foam01                  where the sea is breaking now (whitecaps)
// Whitecaps: the share of the sea surface that is white grows steeply with the wind, about
// 3.84e-6 U^3.41 (Monahan and O'Muircheartaigh 1980): 1 % at 10 m/s, 4 % at 15, 10 % at 20.
// Here it follows the steepness of the sea (so it holds on other worlds too) through
// cover = foamMax whitecap01^foamPower, which is within a factor 1.5 of that law from 10 to
// 20 m/s over the game's fetches; and the sea breaks where it stands highest: the foam is
// the part of the surface above the level that leaves exactly that share above it.
// At a shore a wave breaks when it is 0.78 of the depth high (McCowan 1894): surf01.
import { clamp01, smoothstep, TAU } from './util.js';

export const WATER = Object.freeze({
  arriveTime: 1.5,                 // s of quick settling when the focus arrives somewhere new
  growTime: 25,                    // game s for the sea to follow a change of wind
  turnTime: 40,                    // game s for the wave direction to follow the wind
  // the four trains: length as a multiple of the peak wavelength, share of the amplitude,
  // direction offset from the wind (rad). The first two are the peak of the spectrum, split
  // into two trains a little apart in length and heading: their beat makes crests of finite
  // length (a short-crested sea), where one train alone would draw ruled lines to the horizon.
  trains: 4,
  lengths: [1, 0.87, 0.62, 1.55], shares: [0.4, 0.37, 0.29, 0.26], spread: [-0.11, 0.15, 0.46, -0.36],
  // Waves come in sets. Each train's height swells and fades in groups about `groupWaves`
  // wavelengths long that travel at the group velocity (half the phase speed in deep water),
  // along a line turned `groupTurn` from the train's own, so that sets are patches, not
  // stripes. This is also what keeps the sea from repeating like wallpaper seen from the air.
  group: 0.45, groupWaves: 7, groupTurn: 0.3,
  breakRatio: 0.55,                // highest wave as a fraction of the depth
  earthRatio: 1.225 / 999,         // air to water density, the reference the curves were measured in
  // wakes: what a body moving in or just over the liquid leaves behind. Each source is a ring
  // packet that spreads at the group speed of its own wavelength and dies away.
  wakes: 16,                       // sources kept
  wakeEvery: 0.6,                  // a source for every this many wavelengths travelled (or seconds, hovering)
  wakeLife: 3.2,                   // s x sqrt(wavelength in m): how long a packet lasts
  wakeWidth: 1.6,                  // wavelengths: width of the packet
  // crests and foam (see the header)
  crestLow: 0.12, crestHigh: 0.42, // elevation / Hs where a crest begins and where it is fully one (the top third .. the top 5 % of the sea)
  foamMax: 0.15, foamPower: 1.8,   // whitecap cover = foamMax whitecap01^foamPower (share of the surface)
  foamMin: 5e-4,                   // below this share the sea does not break at all
  foamEdge: 0.06,                  // x Hs: the width of the edge of a foam patch
  surfBreak: 0.78,                 // a wave breaks when it is this fraction of the depth high
  swashSetup: 0.35, swashSwing: 0.75,   // (P12) set-up and incident swash over slope x sqrt(H0 L0) (Stockdon et al. 2006)
  // Swell (P7). On an open sea the longest train is not part of the local wind sea: it is the
  // sea the same wind raised over the open water beyond the game's fetch (swellFetch times as
  // far), which has outrun it: longer (its period grows with the cube root of the fetch), and
  // lower than that sea was where it was raised (swellDecay: it has spread and lost its steep
  // short waves). It follows the wind slowly (swellTime) and outlasts it. A 10 m chop is under
  // the brush 60 m out; a 60 m swell is seen to the horizon.
  swellFetch: 12, swellDecay: 0.5, swellTime: 90,
  swellCalm: 0.8,                  // x the body's prevailing wind: the least wind the swell was raised by (it comes from elsewhere)
  swellOpen: [600, 2000],          // m of fetch: no swell on a pond or a lake; all of it on an open sea
  // the crest LINE: within this slope (in units of the sea's rms slope, along the way the waves run) of the very top
  // (on one train: 0 at the top, 1 a twenty-fifth of a wavelength either side of it)
  lineIn: 0.12, lineOut: 0.36,
  whiteSpeed: [0.9, 1.5],          // (P16) m/s of phase speed: no whitecaps on shorter waves (0.5 m long on Earth), all on longer (1.4 m)
});
// 4 sigma of the surface for unit Hs of the four standard trains (the sets add 1 + group^2 / 2 to each train's variance)
const VARG = 1 + 0.45 * 0.45 / 2;

// Fetch (m) by biome: how far the wind can work on the liquid there. Game scale.
export const FETCH = {
  sea_coast: 2500, storm_seas: 2500, misty_wetland: 40, temperate_forest: 14, autumn_woodland: 14,
  // (acid_terraces: since PAINTER's third pass the acid stands in pools on the treads, 30 to 40 m across, not in lakes)
  acid_terraces: 35, aurora_tundra: 30, lava_rivers: 20, teal_sinkholes: 60, kelp_forests: 400, gold_islands: 2500, sky_islands: 2500, 'stub-shore': 1200, 'stub-lowland': 300,
  default: 80,
};
export function fetchOf(biomeId) { return FETCH[biomeId] != null ? FETCH[biomeId] : FETCH.default; }

// (P16) THE FETCH, MEASURED. Until P16 the sea at the focus was raised over the biome's fetch (2500 m on a sea coast)
// whatever water was there: Neptune's storm coast faces a lagoon dry 160 m out and carried 2.8 m of surf. Now the
// fetch is measured upwind over the liquid the world has, from a water point near the focus, and the biome's fetch
// is only its cap (how far the open water runs beyond what is measured). Shore Protection Manual 1984 (3-VI): over
// an irregular shore the fetch is the arithmetic mean of radials over 24 degrees about the wind; each radial runs
// upwind until it meets dry ground (or the cap). The mean depth over the wet length of the radials is the depth the
// waves grew over (windSea limits them by it). Sparse and cached: steps of 16 m growing by a tenth of the distance gone
// (39 samples out to 2500 m, the shore placed to within 5 % of its distance: 2.5 % in the height), a few samples a
// frame, and a measurement holds for a water point within max(cell, a tenth of its fetch) and the same sector of the wind.
export const FETCH_GAUGE = Object.freeze({
  radials: [-12, -6, 0, 6, 12],   // degrees about the upwind direction (SPM 1984: 3-degree radials over +-12; five here)
  step0: 16,                      // m: the first and smallest step
  stepGrow: 0.1,                  // each step at least this share of the distance gone
  sectors: 16,                    // the wind's direction is taken to the nearest of this many (22.5 degrees)
  cell: 48,                       // m: a measurement holds for a water point within this (or a tenth of its fetch) ...
  keep: 24,                       // ... and this many measurements are kept (places and directions)
  minDepth: 1,                    // m: the water point is the nearest liquid at least this deep (else the deepest about)
});
const DEG = Math.PI / 180;

// The measurement itself. sample(unitDir) -> the world's surface ({ radius, liquidRadius }). Pure but for that call.
export class FetchGauge {
  constructor() {
    this.fetch = -1;          // the mean of the radials (m) the sea uses now; -1 while nothing is known here
    this.depth = 0;           // the mean depth over their wet length (m)
    this.radial = [];         // the last finished measurement's radials (m), for the lab
    this.ready = false;       // fetch is the finished measurement for the place and wind of the last update
    this.final = false;       // fetch is a finished measurement (of this place, or held from the last one while this is measured);
                              // false after reset() until one finishes: fetch is then what has been measured so far (a lower bound)
    this.samples = 0;         // sampleSurface calls made in the last update
    this.measured = 0;        // measurements finished so far
    this.kept = [];           // { body, x, y, z (unit), sector, fetch, depth, radial }
    this.job = null;
    this._q = { x: 0, y: 0, z: 1 };
  }
  // One frame. body: id; (px, py, pz): the water point (unit, body-local); (tx, ty, tz): a tangent there pointing
  // upwind (unit); R: the body's radius (m); cap: the biome's fetch (m); pointDepth: the liquid's depth at the point (m);
  // budget: sampleSurface calls allowed now; clock, ms: optional time ration (clock() in ms).
  update(body, px, py, pz, tx, ty, tz, R, cap, pointDepth, sample, budget, clock = null, ms = 0) {
    this.samples = 0;
    // the sector of the wind, in the local geographic frame (east = Y x up), so that it means the same after re-anchors
    let ex = pz, ez = -px; const el = Math.hypot(ex, ez);
    if (el < 1e-6) { ex = 1; ez = 0; } else { ex /= el; ez /= el; }
    const ey = 0, nx = py * ez - pz * ey, ny = pz * ex - px * ez, nz = px * ey - py * ex;
    const NS = FETCH_GAUGE.sectors, sector = ((Math.round(Math.atan2(tx * nx + ty * ny + tz * nz, tx * ex + tz * ez) / (2 * Math.PI) * NS) % NS) + NS) % NS;
    const capM = cap > 0 ? cap : 0;
    // a measurement already made here?
    for (let i = 0; i < this.kept.length; i++) {
      const m = this.kept[i];
      if (m.body !== body || m.sector !== sector || m.cap !== capM) continue;
      const d = R * Math.acos(Math.min(1, m.x * px + m.y * py + m.z * pz));
      if (d <= Math.max(FETCH_GAUGE.cell, 0.1 * m.fetch)) {
        if (i > 0) { this.kept.splice(i, 1); this.kept.unshift(m); }
        this.fetch = m.fetch; this.depth = m.depth; this.radial = m.radial; this.ready = true; this.final = true; this.job = null;
        return this;
      }
    }
    // measure: a job for this place and sector (a new one if the place or the wind has moved on)
    let J = this.job;
    if (!J || J.body !== body || J.sector !== sector || J.cap !== capM || R * Math.acos(Math.min(1, J.x * px + J.y * py + J.z * pz)) > FETCH_GAUGE.cell) {
      // the upwind direction of the sector, and the radials about it
      const a = sector / NS * 2 * Math.PI, ca = Math.cos(a), sa = Math.sin(a);
      const ux = ex * ca + nx * sa, uy = ny * sa, uz = ez * ca + nz * sa;
      const vx = py * uz - pz * uy, vy = pz * ux - px * uz, vz = px * uy - py * ux;   // up x upwind: 90 degrees to the left
      const n = FETCH_GAUGE.radials.length;
      J = this.job = { body, sector, cap: capM, x: px, y: py, z: pz, R, k: 0, r: new Float64Array(n), done: new Uint8Array(n), wet: new Float64Array(n), dsum: new Float64Array(n),
        b: FETCH_GAUGE.radials.map((deg) => { const c = Math.cos(deg * DEG), s = Math.sin(deg * DEG); return [ux * c + vx * s, uy * c + vy * s, uz * c + vz * s]; }), pointDepth: pointDepth > 0 ? pointDepth : 0 };
      if (!(capM > 0)) J.done.fill(1);
    }
    const n = J.b.length, q = this._q, t0 = clock ? clock() : 0;
    while (this.samples < budget && J.k < n) {
      if (clock && this.samples >= 2 && clock() - t0 > ms) break;
      const k = J.k;
      if (J.done[k]) { J.k++; continue; }
      const r0 = J.r[k], r1 = Math.min(J.cap, r0 + Math.max(FETCH_GAUGE.step0, FETCH_GAUGE.stepGrow * r0));
      const th = r1 / R, c = Math.cos(th), s = Math.sin(th), b = J.b[k];
      q.x = J.x * c + b[0] * s; q.y = J.y * c + b[1] * s; q.z = J.z * c + b[2] * s;
      const S = sample(q); this.samples++;
      const d = S ? (S.liquidRadius || 0) - S.radius : -1;
      if (d > 0) { J.dsum[k] += d * (r1 - r0); J.wet[k] += r1 - r0; J.r[k] = r1; if (r1 >= J.cap) J.done[k] = 1; }
      else { J.r[k] = 0.5 * (r0 + r1); J.done[k] = 1; }            // dry: the shore is taken half way (the depth is the wet steps')
    }
    // the mean of the radials (a lower bound while they are still running) and the mean depth over their wet length
    let f = 0, w = 0, ds = 0;
    for (let k = 0; k < n; k++) { f += J.r[k]; w += J.wet[k]; ds += J.dsum[k]; }
    const fetch = f / n, depth = w > 0 ? ds / w : J.pointDepth;
    if (J.k >= n) {
      const m = { body, sector, cap: capM, x: J.x, y: J.y, z: J.z, fetch, depth, radial: Array.from(J.r) };
      this.kept.unshift(m); if (this.kept.length > FETCH_GAUGE.keep) this.kept.pop();
      this.job = null; this.measured++;
      this.fetch = fetch; this.depth = depth; this.radial = m.radial; this.ready = true; this.final = true;
    } else {
      // not finished: the last finished measurement is held (the sea follows a change over WATER.growTime anyway);
      // with none since arriving, what has been measured so far (a lower bound that only grows)
      this.ready = false;
      if (!this.final) { this.fetch = fetch; this.depth = depth; }
    }
    return this;
  }
  // forget everything (a new body, or a jump)
  reset() { this.fetch = -1; this.depth = 0; this.radial = []; this.ready = false; this.final = false; this.job = null; }
}

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
  // (P16) Depth-limited growth (Shore Protection Manual 1984, eqs 3-39 and 3-40, Bretschneider's shallow-water curves):
  // over a bottom d metres down the waves grow more slowly and stop lower,
  //   g H / U^2 = 0.283 tanh(0.530 (g d / U^2)^(3/4)) tanh( 0.00565 (g F / U^2)^(1/2) / tanh(0.530 (g d / U^2)^(3/4)) )
  //   g T / U   = 7.54  tanh(0.833 (g d / U^2)^(3/8)) tanh( 0.0379  (g F / U^2)^(1/3) / tanh(0.833 (g d / U^2)^(3/8)) )
  // which in deep water are the laws above (0.283 x 0.00565 = 0.0016, 7.54 x 0.0379 = 0.2857). Applied as the ratio of
  // each to its own deep-water form, so deep water is exactly as before. Until P16 only the breaking cap (0.55 of the
  // depth) knew the bottom: 3.4 m of depth held 1.9 m of sea in any wind.
  if (depth > 0 && depth < 1e8) {
    const U2 = U * U, D = g * depth / U2, X = g * F / U2;
    const tH = Math.tanh(0.530 * Math.pow(D, 0.75)), aH = 0.00565 * Math.sqrt(X);
    const tT = Math.tanh(0.833 * Math.pow(D, 0.375)), aT = 0.0379 * Math.cbrt(X);
    if (tH < 1 && aH > 0) H *= tH * Math.tanh(aH / tH) / Math.tanh(aH);
    if (tT < 1 && aT > 0) T *= tT * Math.tanh(aT / tT) / Math.tanh(aT);
  }
  // wavelength: deep water g T^2 / 2 pi, shortened over a shallow bottom (Fenton and McKee 1990)
  const L0 = g * T * T / TAU;
  let L = L0;
  if (depth < L0) L = L0 * Math.pow(Math.tanh(Math.pow(TAU * depth / L0, 0.75)), 2 / 3);
  if (depth < 1e8 && H > WATER.breakRatio * depth) H = WATER.breakRatio * Math.max(0, depth);
  // no wave is steeper than about 1 in 7
  if (L > 0 && H > L / 7) H = L / 7;
  o.height = H; o.period = T; o.length = L; o.speed = T > 0 ? L / T : 0;
  o.steepness = L > 0 ? H / L : 0;
  o.whitecap01 = smoothstep(0.035, 0.075, o.steepness) * whiteScale(o.speed);
  return o;
}

// (P16) Whitecaps need waves big enough to trap air as they break. Waves under about a metre long (on Earth) break
// without entraining air: microscale breaking, a glint and a ruffle but no white (Banner and Phillips 1974; Jessup,
// Zappa and Yeh 1997). Taken by the phase speed (gravity-aware): none under WATER.whiteSpeed[0], all above [1]. Until
// the fetch was measured no sea at a coast was that short; a 20 m channel in a fresh breeze raises 2 cm ripples 0.2 m
// long whose steepness alone said 15 % white.
export function whiteScale(c) { return smoothstep(WATER.whiteSpeed[0], WATER.whiteSpeed[1], c); }
const _t = {}, _s = {};
const NT = 4;
// 4 sigma of the standard four trains for Hs = 1 (0.992: they were chosen to make it 1)
const STD4 = 4 * Math.sqrt(0.125 * WATER.shares.reduce((a, x) => a + x * x, 0) * VARG);
const COS = WATER.spread.map(Math.cos), SIN = WATER.spread.map(Math.sin);
const GCOS = WATER.spread.map((a) => Math.cos(a + WATER.groupTurn)), GSIN = WATER.spread.map((a) => Math.sin(a + WATER.groupTurn));
const GK = 1 / WATER.groupWaves;            // group wavenumber as a fraction of the train's
// wavelength of a wake from its amplitude: a swimmer's ripples are a metre long, a ship's a few
export const wakeLength = (amp) => 0.8 + 14 * amp;

// How high (in units of Hs) the surface must stand for only a share W of it to stand higher.
// The elevation of four trains in sets is not Gaussian (its tails are shorter), so the
// distribution is measured once, on first use: every phase of every train and of its groups
// taken evenly (a Kronecker sequence), sorted, and the upper quantiles tabulated against log W.
const QN = 25, QLO = -3.4, QHI = -0.4;         // log10 of the share: 0.04 % .. 40 %
// (P7) one row for each share of the surface's variance that the longest train holds: the standard four
// (0.15), and four seas with more and more swell under them (a sea that is mostly one long train has
// shorter tails still). Elevations in units of the significant height of the whole (4 sigma / STD4).
const QR = 5, R0 = WATER.shares[3] * WATER.shares[3] / WATER.shares.reduce((a, x) => a + x * x, 0), R1 = 0.95;
let _quant = null;
function quantiles() {
  if (_quant) return _quant;
  const N = 30000, v = new Float32Array(N), sh = WATER.shares, g = WATER.group;
  const al = [2, 3, 5, 7, 11, 13, 17, 19].map((p) => Math.sqrt(p) % 1);       // independent over the rationals
  const rest = 0.25 * (sh[0] * sh[0] + sh[1] * sh[1] + sh[2] * sh[2]);
  _quant = new Float32Array(QN * QR);
  for (let row = 0; row < QR; row++) {
    const r = R0 + (R1 - R0) * row / (QR - 1), a3 = Math.sqrt(r / (1 - r) * rest), unit = 4 * Math.sqrt(0.5 * VARG * (rest + a3 * a3)) / STD4;
    for (let n = 0; n < N; n++) {
      let h = 0;
      for (let i = 0; i < NT; i++) { const a = TAU * ((n + 1) * al[i] % 1), e = TAU * ((n + 1) * al[i + 4] % 1); h += (i === NT - 1 ? a3 : 0.5 * sh[i]) * (1 + g * Math.sin(e)) * Math.sin(a); }
      v[n] = h / unit;
    }
    v.sort();
    for (let k = 0; k < QN; k++) { const W = Math.pow(10, QLO + (QHI - QLO) * k / (QN - 1)); _quant[row * QN + k] = v[Math.min(N - 1, Math.max(0, Math.round(N * (1 - W))))]; }
  }
  return _quant;
}
// elevation / (significant height) above which a share `cover` of the sea surface stands.
// swell01 (optional): the share of the surface's variance that the longest train holds (a sea with a swell under it)
export function foamLevel(cover, swell01 = R0) {
  const q = quantiles();
  let t = (Math.log10(cover > 1e-9 ? cover : 1e-9) - QLO) / (QHI - QLO) * (QN - 1);
  t = t < 0 ? 0 : t > QN - 1 ? QN - 1 : t;
  const i = Math.min(QN - 2, t | 0);
  let rr = (swell01 - R0) / (R1 - R0) * (QR - 1); rr = rr < 0 ? 0 : rr > QR - 1 ? QR - 1 : rr;
  const j = Math.min(QR - 2, rr | 0), fj = rr - j, a = j * QN + i, b = a + QN;
  return (q[a] + (q[a + 1] - q[a]) * (t - i)) * (1 - fj) + (q[b] + (q[b + 1] - q[b]) * (t - i)) * fj;
}
// share of the sea surface that is white, from how steep the sea is (0..1, as windSea's whitecap01)
export const foamCover = (whitecap01) => WATER.foamMax * Math.pow(whitecap01 > 0 ? whitecap01 : 0, WATER.foamPower);
// 0..1: how far a wave of this sea has broken in liquid `depth` metres deep (the surf at a shore)
export function surf01(Hs, depth) {
  if (!(Hs > 0.02)) return 0;
  return 1 - smoothstep(0.5, 1 / WATER.surfBreak, depth / Hs);
}

const _wk3 = new Float64Array(3);

// (P18) THE SEA MAP. Until P18 the sea was one state round the focus: four trains, one height, one way, the same over a
// sheltered bay and the open shore beside it. seamap.js now raises the sea at every node of two levels round the focus
// (inner: the wind grid's 17 x 17 nodes 16 m apart; outer: 17 x 17 nodes 128 m apart, 2 km across) over that node's own
// fetch and depth, turned toward its longest fetch and refracted toward its shore, and hands it over (attachMap). The
// trains stay one set of waves (their lengths and phases are the reference sea's: the most exposed water about); per
// node the map holds
//   rH    the wind sea's height there over the reference's      open  how far the open sea's swell reaches it (0..1)
//   wc    its own whitecap01 (from its own steepness)            kS    shoaling and refraction of the long train there
// and, on the inner level, a WARP (m, frame axes): the trains are read at g + warp(g), so where the warp turns, the
// crests turn (its Jacobian is the turn: a least-squares fit, seamap.js). Each frame the field composes the texture
// below from them and the trains of the moment; surfaceAt, heightAt, runupAt and localAt read it, and so does the
// chunk (PC_PHYS_SEA_MAP: PAINTER opts in). Without a map everything is exactly as before.
export const SEA_TEX = Object.freeze({
  N: 17,                // nodes per side, both levels
  rows: 51,             // texture rows: 0-16 inner (sW, s3, foamAt, cover), 17-33 inner warp (x, z, 0, 0), 34-50 outer (as inner)
  band: 1.5,            // inner cells over which the inner level gives way to the outer one (P19: about the focus)
  margin: 0.25,         // (P19) inner cells the band keeps inside every inner grid it must lie in (see _composeMap)
  relax: 0.25,          // (P19) inner cells a second an edge of the band moves out again (or the focus's speed, if faster)
  ease: 3,              // s: the displayed map follows a new build
  noFoam: 3,            // x the local significant height: the foam level where the sea does not break (never reached)
});
const MN = SEA_TEX.N, MNN = MN * MN;
function easeArr(a, t, k) { for (let i = 0; i < a.length; i++) a[i] += (t[i] - a[i]) * k; }
// (P19) an N x N field of `c` values read at node position (u, v) (in its own nodes; bilinear, held at its edge, as _seaTap
// reads it) into dst[n * c ..]: at a node exactly, the node's own values
function tapInto(src, c, u, v, dst, n) {
  const Nm = MN - 1, cu = u < 0 ? 0 : u > Nm ? Nm : u, cv = v < 0 ? 0 : v > Nm ? Nm : v;
  const i = Math.min(Math.floor(cu), Nm - 1), j = Math.min(Math.floor(cv), Nm - 1), fu = cu - i, fv = cv - j;
  const a = (j * MN + i) * c, b = a + c, e = a + MN * c, d = e + c, o = n * c;
  for (let q = 0; q < c; q++) { const lo = src[a + q] + (src[b + q] - src[a + q]) * fu, hi = src[e + q] + (src[d + q] - src[e + q]) * fu; dst[o + q] = lo + (hi - lo) * fv; }
}

export class WaterField {
  // opts.swell: false = the wind sea alone, also on an open sea (tests of the wind sea)
  constructor(opts = {}) {
    this.swellOn = opts.swell !== false;
    this.height = 0;               // significant wave height at the focus now (m), smoothed
    this.period = 0; this.length = 0; this.speed = 0; this.steepness = 0; this.whitecap01 = 0;
    this.dir = new Float64Array(2); this.dir[0] = 1;      // wave direction (frame axes), smoothed
    this.phase = new Float64Array(NT);
    this.k = new Float64Array(NT);                          // wavenumbers (rad/m)
    this.kx = new Float64Array(NT); this.kz = new Float64Array(NT);   // wave vectors (frame axes)
    this.gphase = new Float64Array(NT);                     // phase of each train's groups
    this.gx = new Float64Array(NT); this.gz = new Float64Array(NT);   // group wave vectors
    this.amp = new Float64Array(NT);                        // amplitudes (m)
    this.omega = new Float64Array(NT);
    this.level = -1e9;             // liquid surface near the focus (radius - frame.r0), -1e9 when dry
    this.fetch = 0; this.depth = 0;  // (P16) the fetch (m) and the depth (m) the sea is raised over now (as update() was given them)
    this.present = false;
    this.frameVersion = -1;
    this.arrive = 0;               // s left of the quick settling after arriving somewhere
    this.g = 9.81;
    // wakes: x, z (grid), age (s), amplitude (m). Unused slots have amplitude 0.
    this.wake = new Float32Array(WATER.wakes * 4);
    this.wakeHead = 0;
    quantiles();                   // (measured here, while loading, not in the first played frame)
    // swell (P7): the wind it remembers, its height and length, how open the sea is (0 pond .. 1 open sea),
    // and the significant height of everything together (wind sea and swell: 4 sigma of the surface)
    this.swellWind = 0; this.swellHeight = 0; this.swellLength = 0; this.open = 0; this.significant = 0; this.slope = 0;
    this.cover = 0;                // share of the surface that is breaking (whitecaps), 0 .. foamMax
    this.foamAt = 1e9;             // elevation (m) above which the sea is breaking now (1e9: it is not)
    // uPhysWaterSea: Hs (m), the elevation above which the sea breaks (m), the width of that edge (m), whitecap cover
    this.uniforms = { uPhysWaterDir: [1, 0], uPhysWaterK: [0, 0, 0, 0], uPhysWaterAmp: [0, 0, 0, 0], uPhysWaterPhase: [0, 0, 0, 0], uPhysWaterGroup: [0, 0, 0, 0],
      uPhysWaterSea: [0, 1e9, 1, 0], uPhysWake: this.wake, uPhysWakeG: 9.81,
      // (P18) the sea map (SEA_TEX): a 17 x 51 RGBA float texture's data, and where its two levels lie (frame m of node
      // (0, 0), cell m, nodes a side; w = 0: no map). PAINTER: a DataTexture over uPhysSeaMap, needsUpdate when mapVersion moves.
      uPhysSeaGrid: [0, 0, 16, 0], uPhysSeaGrid2: [0, 0, 128, 0],
      // (P19) where the inner level gives way to the outer one, and the warp's turns fade: a rectangle (frame m) of centre
      // x, z and half-widths along east and north, at whose edge the inner level is gone; the band is SEA_TEX.band cells
      // wide inside it. PAINTER: copy it with uPhysSeaGrid (physics.md, "For PAINTER", P19).
      uPhysSeaBand: [0, 0, 0, 0] };
    // (P18) uPhysSeaMap is a getter: the first time anything outside reads it (PAINTER's syncPhysWater, wiring the map into the
    // shader), `mapRead` turns true and the reference sea moves to the most exposed water about (seamap.js): until the shader
    // reads the map the trains stay the sea of the water nearest the focus, so what is drawn is never the open sea's waves laid
    // over a sheltered lagoon. Inside, the field uses _seaData.
    this._seaData = new Float32Array(MN * SEA_TEX.rows * 4);
    this.mapRead = false;
    Object.defineProperty(this.uniforms, 'uPhysSeaMap', { enumerable: true, get: () => { this.mapRead = true; return this._seaData; } });
    // (P18) the map: the builder's last target (seamap.js), and what is shown (eased toward it, kept with the ground it belongs to)
    this.map = null;
    this.mapVersion = 0;           // bumps whenever uPhysSeaMap was rewritten
    this._mapOn = false;           // the map is in use (surfaceAt, heightAt, runupAt, localAt read it)
    this._mw = new Float32Array(MNN * 2); this._mi = new Float32Array(MNN * 4); this._mo = new Float32Array(MNN * 4);
    this._ow = new Float32Array(MNN * 2); this._oi = new Float32Array(MNN * 4); this._oo = new Float32Array(MNN * 4);   // (P19) what was shown, as a build lands
    this._be = new Float64Array(4); this._beOn = false;   // (P19) the band's edges (frame m: west, east, south, north; see _composeMap)
    this._fx = 0; this._fz = 0; this._fpx = 0; this._fpz = 0;   // (P19) the focus (frame m), now and at the last compose
    this._bw = 1;                  // (P19) the inner level's share at the place _seaAt was last asked about
    this._mg = [0, 0, 16, 0, 0, 0, 128, 0];    // the displayed levels' grids (inner x0, z0, cell, N; outer x0, z0, cell, N)
    this._mver = -1;
    this._mt = new Float64Array(16);
  }

  // (P18) Hand over a built sea map (seamap.js SeaMap.target), or null to drop it.
  attachMap(T) {
    if (!T || !T.on) { this.map = null; this._mapOn = false; this.uniforms.uPhysSeaGrid[3] = 0; this.uniforms.uPhysSeaGrid2[3] = 0; this._mver = -1; this._beOn = false; return; }
    this.map = T;
    if (T.version === this._mver) return;
    const g = this._mg, first = this._mver < 0;
    this._mver = T.version;
    // The displayed nodes stay with their ground, and (P19) a node new to a level starts from what was shown at its place
    // and eases to the build from there like the rest, so the frame a build lands in shows what the frame before did
    // (until P19 new nodes took the build's value at once, and after every re-anchor the outer level snapped to it: review
    // 7, finding 3):
    //   the inner level and its warp move by whole cells (the inner grid is the wind grid's); a node new to the inner level
    //     takes the outer level's value there (the band keeps the inner level off every node a build adds or drops, so the
    //     outer level is what was shown there), a new warp node the warp of the edge it extends (what is read beyond it);
    //   the outer level is read at its new nodes (bilinear, held at its old edge): after a re-anchor its lattice moves by
    //     X mod 128 m, not whole cells. A build without its outer level (sampled afresh after a re-anchor) leaves it shown.
    const inner = !first && g[3] > 0 && g[2] === T.cell, outer = !first && g[7] > 0 && g[6] === T.cell2;
    if (outer) this._oo.set(this._mo);
    if (!inner) { this._mw.set(T.warp); this._mi.set(T.inner); }
    else {
      const oi = this._oi, ow = this._ow, Nm = MN - 1; oi.set(this._mi); ow.set(this._mw);
      for (let j = 0; j < MN; j++) for (let i = 0; i < MN; i++) {
        const n = j * MN + i, x = T.x0 + i * T.cell, z = T.z0 + j * T.cell, u = (x - g[0]) / g[2], v = (z - g[1]) / g[2];
        if (u > -1e-6 && v > -1e-6 && u < Nm + 1e-6 && v < Nm + 1e-6) tapInto(oi, 4, u, v, this._mi, n);
        else if (outer) tapInto(this._oo, 4, (x - g[4]) / g[6], (z - g[5]) / g[6], this._mi, n);
        else for (let q = 0; q < 4; q++) this._mi[n * 4 + q] = T.inner[n * 4 + q];
        tapInto(ow, 2, u, v, this._mw, n);
      }
    }
    if (T.N2) {
      if (!outer) this._mo.set(T.outer);
      else for (let j = 0; j < MN; j++) for (let i = 0; i < MN; i++) tapInto(this._oo, 4, (T.x02 + i * T.cell2 - g[4]) / g[6], (T.z02 + j * T.cell2 - g[5]) / g[6], this._mo, j * MN + i);
      g[4] = T.x02; g[5] = T.z02; g[6] = T.cell2; g[7] = MN;
    } else if (!outer) g[7] = 0;
    g[0] = T.x0; g[1] = T.z0; g[2] = T.cell; g[3] = MN;
  }

  // The frame re-anchored at old grid position (X, Z): keep the waves where they are.
  rebase(frame, X, Z) {
    this.frameVersion = frame.version;
    for (let i = 0; i < NT; i++) { this.phase[i] -= this.kx[i] * X + this.kz[i] * Z; this.gphase[i] -= this.gx[i] * X + this.gz[i] * Z; }
    for (let w = 0; w < this.wake.length; w += 4) { this.wake[w] -= X; this.wake[w + 1] -= Z; }
    // (P18) the map's levels stay on their ground (the warp's phase offset k . warp is carried with it)
    const g = this._mg; g[0] -= X; g[1] -= Z; g[4] -= X; g[5] -= Z;
    const u = this.uniforms; u.uPhysSeaGrid[0] = g[0]; u.uPhysSeaGrid[1] = g[1]; u.uPhysSeaGrid2[0] = g[4]; u.uPhysSeaGrid2[1] = g[5];
    this._fx -= X; this._fz -= Z; this._fpx -= X; this._fpz -= Z; u.uPhysSeaBand[0] -= X; u.uPhysSeaBand[1] -= Z;
    const E = this._be; E[0] -= X; E[1] -= X; E[2] -= Z; E[3] -= Z;
  }

  // (P18) Ease the shown map toward the last build and write the texture's data from it and the trains of the moment.
  _composeMap(h) {
    const T = this.map, u = this.uniforms;
    if (!T || !this.present || !(this.height > 0 || this.amp[NT - 1] > 0)) { this._mapOn = false; this._beOn = false; u.uPhysSeaGrid[3] = 0; u.uPhysSeaGrid2[3] = 0; return; }
    const k = 1 - Math.exp(-h / SEA_TEX.ease), g = this._mg;
    easeArr(this._mw, T.warp, k); easeArr(this._mi, T.inner, k); if (T.N2 && g[7]) easeArr(this._mo, T.outer, k);
    const D = this._seaData, A = this.amp, sh = WATER.shares;
    const a012 = A[0] * A[0] + A[1] * A[1] + A[2] * A[2], A3 = A[NT - 1], aw3 = 0.5 * this.height * sh[NT - 1], sw2 = 0.5 * this.swellHeight;
    // (the wind sea at a node rises with the reference's: its whitecaps by how far the reference has come toward its target)
    const prog = T.HsRef > 1e-6 ? Math.min(1, this.height / T.HsRef) : 0;
    for (let lev = 0; lev < 2; lev++) {
      const S = lev ? this._mo : this._mi, r0 = lev ? 2 * MN : 0;
      if (lev && !g[7]) break;
      for (let n = 0; n < MNN; n++) {
        const sW = S[n * 4], open = S[n * 4 + 1], wc = S[n * 4 + 2], kS = S[n * 4 + 3];
        const w3 = aw3 * sW, a3 = w3 + (Math.max(w3, sw2 * kS) - w3) * open;
        const s3 = A3 > 1e-9 ? a3 / A3 : sW;
        const va = a012 * sW * sW + a3 * a3, sig = 4 * Math.sqrt(0.5 * va * VARG) / STD4;
        let cover = foamCover(wc * prog), at = SEA_TEX.noFoam * sig + 0.1;
        if (cover > WATER.foamMin && this.height * sW > 0.02) at = sig * foamLevel(cover, va > 0 ? a3 * a3 / va : R0); else cover = 0;
        const o = ((r0 + (n / MN | 0)) * MN + n % MN) * 4;
        D[o] = sW; D[o + 1] = s3; D[o + 2] = at; D[o + 3] = cover;
      }
    }
    u.uPhysSeaGrid[0] = g[0]; u.uPhysSeaGrid[1] = g[1]; u.uPhysSeaGrid[2] = g[2]; u.uPhysSeaGrid[3] = MN;
    u.uPhysSeaGrid2[0] = g[4]; u.uPhysSeaGrid2[1] = g[5]; u.uPhysSeaGrid2[2] = g[6]; u.uPhysSeaGrid2[3] = g[7] ? MN : 0;
    // (P19) THE BAND where the inner level gives way to the outer one (and the warp's turns fade, _seaAt). Until P19 it was the
    // shown inner grid's last 1.5 cells, which move in whole cells when a build lands (review 7, finding 3). Now it is a
    // rectangle whose every edge moves continuously: each lies `margin` inside the shown inner grid, inside the one being
    // built (seamap.js target.next*: it is shown when it lands), and inside any grid a build could start on now (centred
    // on the focus's nearest node: within 7.5 cells of the focus). A build landing only drops a grid from those, and a
    // build starting adds one no tighter than the last, so no edge ever has to step inward; an edge moving outward goes
    // at SEA_TEX.relax, or at the focus's speed if that is faster. So no place's share of either level steps in a frame,
    // and every node the band reads is held by the grid shown and by the next.
    const cell = g[2], span = (MN - 1) * cell, m = SEA_TEX.margin * cell, reach = 0.5 * (span - cell) - m, fx = this._fx, fz = this._fz;
    let w0 = Math.max(fx - reach, g[0] + m), e0 = Math.min(fx + reach, g[0] + span - m), s0 = Math.max(fz - reach, g[1] + m), n0 = Math.min(fz + reach, g[1] + span - m);
    if (T.nextOn) { w0 = Math.max(w0, T.nextX0 + m); e0 = Math.min(e0, T.nextX0 + span - m); s0 = Math.max(s0, T.nextZ0 + m); n0 = Math.min(n0, T.nextZ0 + span - m); }
    const E = this._be;
    if (!this._beOn) { E[0] = w0; E[1] = e0; E[2] = s0; E[3] = n0; this._beOn = true; }
    else {
      const v = h > 0 ? Math.hypot(fx - this._fpx, fz - this._fpz) / h : 0, out = Math.max(SEA_TEX.relax * cell, v < 200 ? v : 200) * h;
      E[0] = w0 >= E[0] ? w0 : Math.max(w0, E[0] - out); E[1] = e0 <= E[1] ? e0 : Math.min(e0, E[1] + out);
      E[2] = s0 >= E[2] ? s0 : Math.max(s0, E[2] - out); E[3] = n0 <= E[3] ? n0 : Math.min(n0, E[3] + out);
    }
    this._fpx = fx; this._fpz = fz;
    const Bd = u.uPhysSeaBand; Bd[0] = 0.5 * (E[0] + E[1]); Bd[1] = 0.5 * (E[2] + E[3]); Bd[2] = Math.max(0, 0.5 * (E[1] - E[0])); Bd[3] = Math.max(0, 0.5 * (E[3] - E[2]));
    // (P19) the warp rows: each node holds the shown warp where the band lets it be read: at the node itself within the
    // band's inner edge, and beyond it at a place drawn in toward it (each axis on its own: d -> r0 + b (u - u^2 / 2),
    // u = (|d| - r0) / b, held at u = 1; r0 the half-width less b). So the turns fade across the band and are gone
    // beyond it, every value shown comes from inside it (from nodes both the grid shown and the next hold), and a place
    // reads its own cell as before: its warp and its turn change from frame to frame only as smoothly as the band moves.
    const bw = SEA_TEX.band * cell, bx = Math.min(bw, Bd[2]), bz = Math.min(bw, Bd[3]), rx = Bd[2] - bx, rz = Bd[3] - bz, tw = this._tw || (this._tw = new Float32Array(2));
    for (let j = 0; j < MN; j++) {
      const dz = g[1] + j * cell - Bd[1], az = Math.abs(dz), uz = bz > 0 ? Math.min(1, Math.max(0, (az - rz) / bz)) : 1;
      const pz = Bd[1] + Math.sign(dz) * (Math.min(az, rz) + bz * (uz - 0.5 * uz * uz));
      for (let i = 0; i < MN; i++) {
        const dx = g[0] + i * cell - Bd[0], ax = Math.abs(dx), ux = bx > 0 ? Math.min(1, Math.max(0, (ax - rx) / bx)) : 1;
        const px = Bd[0] + Math.sign(dx) * (Math.min(ax, rx) + bx * (ux - 0.5 * ux * ux));
        tapInto(this._mw, 2, (px - g[0]) / cell, (pz - g[1]) / cell, tw, 0);
        const o = (MNN + j * MN + i) * 4; D[o] = tw[0]; D[o + 1] = tw[1]; D[o + 2] = 0; D[o + 3] = 0;
      }
    }
    this._mapOn = true; this.mapVersion++;
  }

  // (P18) The twin of the chunk's pcPhysSeaTap: one level's four numbers at grid position (x, z), bilinear, with their
  // derivatives along east and north (0 where the place is beyond the level and the edge value is held). o[oo + 0..3]
  // the values, [oo + 4..7] d/deast, [oo + 8..11] d/dnorth.
  _seaTap(gx0, gz0, cell, r0, x, z, o, oo) {
    const D = this._seaData, Nm = MN - 1;
    const u = (x - gx0) / cell, v = (z - gz0) / cell;
    const cu = u < 0 ? 0 : u > Nm ? Nm : u, cv = v < 0 ? 0 : v > Nm ? Nm : v;
    const inx = Math.abs(u - cu) <= 1e-6 ? 1 / cell : 0, inz = Math.abs(v - cv) <= 1e-6 ? 1 / cell : 0;
    const i = Math.min(Math.floor(cu), Nm - 1), j = Math.min(Math.floor(cv), Nm - 1), fu = cu - i, fv = cv - j;
    const a = ((r0 + j) * MN + i) * 4, b = a + 4, c = a + MN * 4, d = c + 4;
    for (let q = 0; q < 4; q++) {
      const a00 = D[a + q], a10 = D[b + q], a01 = D[c + q], a11 = D[d + q];
      const lo = a00 + (a10 - a00) * fu, hi = a01 + (a11 - a01) * fu;
      o[oo + q] = lo + (hi - lo) * fv;
      o[oo + 4 + q] = ((a10 - a00) * (1 - fv) + (a11 - a01) * fv) * inx;
      o[oo + 8 + q] = (hi - lo) * inz;
    }
  }
  // The twin of pcPhysSeaP: the per-node numbers (sW, s3, foam level, cover) at (x, z), the two levels blended, into
  // _tp[0..11] (values, d/deast, d/dnorth); and the warp into _tp[12..23] (pcPhysSeaTap of the warp rows: pcPhysSeaWarp).
  _seaAt(x, z) {
    const o = this._tp || (this._tp = new Float64Array(36)), g = this.uniforms.uPhysSeaGrid, g2 = this.uniforms.uPhysSeaGrid2, Bd = this.uniforms.uPhysSeaBand;
    const dx = x - Bd[0], dz = z - Bd[1], ax = Math.abs(dx), az = Math.abs(dz), bw = SEA_TEX.band * g[2];
    // (the warp rows hold the warp the band lets be read: _composeMap)
    this._seaTap(g[0], g[1], g[2], MN, x, z, o, 12);
    this._seaTap(g[0], g[1], g[2], 0, x, z, o, 0);
    this._bw = 1;
    if (g2[3] < 2) return o;
    this._seaTap(g2[0], g2[1], g2[2], 2 * MN, x, z, o, 24);
    // (P19) the levels: the inner one's share falls from 1 to 0 over the band's width inside its edge
    const ex = Bd[2] - ax, ez = Bd[3] - az, t = Math.min(1, Math.max(0, Math.min(ex, ez) / bw)), w = t * t * (3 - 2 * t);
    const dw = t > 0 && t < 1 ? -6 * t * (1 - t) / bw : 0, dex = ex <= ez ? Math.sign(dx) * dw : 0, dez = ex <= ez ? 0 : Math.sign(dz) * dw;
    for (let q = 0; q < 4; q++) {
      const p = o[q], r = o[24 + q];
      o[4 + q] = w * o[4 + q] + (1 - w) * o[28 + q] + (p - r) * dex;
      o[8 + q] = w * o[8 + q] + (1 - w) * o[32 + q] + (p - r) * dez;
      o[q] = r + (p - r) * w;
    }
    this._bw = w;
    return o;
  }

  // (P18) The local sea at grid position (x, z): what uPhysWaterSea is for the reference, here, and more. Fills o:
  // significant (m), foamAt (m), edge (m), cover (share white), dirx, dirz (the way the waves run here, frame axes, unit),
  // sW, s3 (the trains' scales here), and from the build (nearest node): fetch, depth (m, the mean along it), Hs (the wind
  // sea there, m, target), open, heading (rad, frame axes), node depth (m). Without a map: the reference's.
  localAt(x, z, o = {}) {
    if (!this._mapOn) {
      o.significant = this.significant; o.foamAt = this.foamAt; o.edge = Math.max(1e-4, this.height * WATER.foamEdge); o.cover = this.foamAt < 1e8 ? this.cover : 0;
      o.dirx = this.dir[0]; o.dirz = this.dir[1]; o.sW = 1; o.s3 = 1; o.fetch = this.fetch; o.depth = this.depth; o.Hs = this.height; o.open = this.open; o.heading = Math.atan2(this.dir[1], this.dir[0]); o.nodeDepth = NaN;
      return o;
    }
    const m = this._seaAt(x, z), A = this.amp;
    const sW = m[0], s3 = m[1], a012 = A[0] * A[0] + A[1] * A[1] + A[2] * A[2];
    o.significant = 4 * Math.sqrt(0.5 * VARG * (a012 * sW * sW + A[3] * A[3] * s3 * s3)) / STD4;
    o.foamAt = m[3] > WATER.foamMin ? m[2] : 1e9; o.edge = Math.max(1e-4, this.height * WATER.foamEdge * sW); o.cover = m[3] > WATER.foamMin ? m[3] : 0;
    // (the local wave vector: the gradient of the phase read at the warped place; [16], [17] are d/deast of the warp's x, z, [20], [21] d/dnorth)
    const d0 = this.dir[0], d1 = this.dir[1], lx = (1 + m[16]) * d0 + m[17] * d1, lz = m[20] * d0 + (1 + m[21]) * d1, ll = Math.hypot(lx, lz) || 1;
    o.dirx = lx / ll; o.dirz = lz / ll; o.sW = sW; o.s3 = s3;
    const T = this.map; let F = this.fetch, Dp = this.depth, Hs = this.height * sW, op = this.open, hd = Math.atan2(o.dirz, o.dirx), nd = NaN;
    if (T && T.info) {
      const g = this.uniforms.uPhysSeaGrid, g2 = this.uniforms.uPhysSeaGrid2;
      let i = Math.round((x - g[0]) / g[2]), j = Math.round((z - g[1]) / g[2]), I = T.info, base = 0;
      // (the outer level's node where the band gives the place mostly to the outer level: P19)
      if (i < 0 || j < 0 || i > MN - 1 || j > MN - 1 || this._bw < 0.5 && g2[3] >= 2) {
        if (g2[3] >= 2) { i = Math.round((x - g2[0]) / g2[2]); j = Math.round((z - g2[1]) / g2[2]); base = MNN; }
        i = i < 0 ? 0 : i > MN - 1 ? MN - 1 : i; j = j < 0 ? 0 : j > MN - 1 ? MN - 1 : j;
      }
      const q = (base + j * MN + i) * 6;
      if (I[q + 5] > 0) { F = I[q]; Dp = I[q + 1]; Hs = I[q + 2]; op = I[q + 3]; hd = I[q + 4]; }
      nd = T.depth ? T.depth[base + j * MN + i] : NaN;
    }
    o.fetch = F; o.depth = Dp; o.Hs = Hs; o.open = op; o.heading = hd; o.nodeDepth = nd;
    return o;
  }

  // Something disturbed the liquid at grid position (x, z): a ring of waves of amplitude `amp`
  // (m) spreads from there. Called by the facade for swimmers, waders and thruster wash.
  addWake(x, z, amp) {
    if (!(amp > 0.002)) return;
    const o = this.wakeHead * 4;
    this.wake[o] = x; this.wake[o + 1] = z; this.wake[o + 2] = 0; this.wake[o + 3] = Math.min(amp, 0.3);
    this.wakeHead = (this.wakeHead + 1) % WATER.wakes;
  }

  // Advance. we, wn: reference wind at the focus (frame axes, m/s). level: liquid surface near
  // the focus or -1e9. depth: liquid depth there (m). fetch: m. g, rhoAir, rhoLiq as windSea.
  // fx, fz: the focus (grid position): when the waves lengthen or turn, the pattern pivots
  // about the watcher, not about the frame's origin (which would sweep the crests past them).
  // prevailing (optional, m/s): the wind that prevails over this body's seas: somewhere out there it is
  // blowing, so an open sea has a swell on a calm day too (WATER.swellCalm of it)
  update(dt, frame, we, wn, level, depth, fetch, g, rhoAir, rhoLiq, fx = 0, fz = 0, prevailing = 0) {
    if (this.frameVersion !== frame.version) { this.frameVersion = frame.version; this.phase.fill(0); this.gphase.fill(0); this.height = 0; this.arrive = WATER.arriveTime; this.wake.fill(0); this.attachMap(null); }
    this.level = level; this.present = level > -1e8; this.g = g;
    this.fetch = fetch; this.depth = depth;     // (P16) what the sea was raised over (m), for the probe and the lab
    const U = Math.hypot(we, wn);
    // (for the first moments that both the liquid and the wind are known the sea follows them
    // quickly, since the wind estimate itself is still settling; from then on, slowly)
    const fresh = this.arrive > 0 && this.present && U > 0.3;
    windSea(this.present ? U : 0, fetch, g, rhoAir, rhoLiq, depth > 0 ? depth : 1e9, _t);
    const h = dt > 0.25 ? 0.25 : dt;
    const kh = 1 - Math.exp(-h / (fresh ? 0.2 : WATER.growTime));
    if (fresh) { this.arrive -= h; this.dir[0] = we / U; this.dir[1] = wn / U; }
    this.height += (_t.height - this.height) * kh;
    if (this.height < 1e-5) this.height = 0;
    // period and length follow the same sea; do not let them collapse when the wind drops
    if (_t.length > 0) { this.period += (_t.period - this.period) * kh; this.length += (_t.length - this.length) * kh; }
    this.speed = this.period > 0 ? this.length / this.period : 0;
    this.steepness = this.length > 0 ? this.height / this.length : 0;
    this.whitecap01 = smoothstep(0.035, 0.075, this.steepness) * whiteScale(this.speed);
    if (U > 0.3) {
      const kd = 1 - Math.exp(-h / WATER.turnTime);
      const d0 = this.dir[0] + (we / U - this.dir[0]) * kd, d1 = this.dir[1] + (wn / U - this.dir[1]) * kd, l = Math.hypot(d0, d1) || 1;
      this.dir[0] = d0 / l; this.dir[1] = d1 / l;
    }
    // the swell from the open side: the sea this wind raises over the open water beyond the game's fetch
    this.open = this.present && this.swellOn ? smoothstep(WATER.swellOpen[0], WATER.swellOpen[1], fetch) : 0;
    const ks = 1 - Math.exp(-h / (fresh ? 0.2 : WATER.swellTime));
    this.swellWind += (U - this.swellWind) * (U > this.swellWind ? 1 - Math.exp(-h / (fresh ? 0.2 : WATER.growTime)) : ks);   // (it rises with the sea and outlasts the wind)
    if (this.open > 0) {
      windSea(Math.max(this.swellWind, WATER.swellCalm * prevailing), fetch * WATER.swellFetch, g, rhoAir, rhoLiq, depth > 0 ? depth : 1e9, _s);
      const kq = fresh ? kh : ks;
      this.swellHeight += (_s.height * WATER.swellDecay - this.swellHeight) * kq;
      if (_s.length > 0) this.swellLength += (_s.length - this.swellLength) * (this.swellLength > 0 ? kq : 1);
    } else { this.swellHeight = 0; }
    const u = this.uniforms, d0 = this.dir[0], d1 = this.dir[1];
    let var4 = 0, slope4 = 0;
    for (let i = 0; i < NT; i++) {
      let L = this.length * WATER.lengths[i], A = 0.5 * this.height * WATER.shares[i];
      // (the longest train is the swell where the sea is open: never shorter than it was, never lower)
      if (i === NT - 1 && this.open > 0) { L += (Math.max(L, this.swellLength) - L) * this.open; A += (Math.max(A, 0.5 * this.swellHeight) - A) * this.open; }
      const k = L > 0.02 ? TAU / L : 0;
      // deep-water dispersion for each train: omega^2 = g k (longer waves travel faster)
      const om = Math.sqrt(g * k);
      const nkx = k * (d0 * COS[i] - d1 * SIN[i]), nkz = k * (d0 * SIN[i] + d1 * COS[i]);
      const ngx = k * GK * (d0 * GCOS[i] - d1 * GSIN[i]), ngz = k * GK * (d0 * GSIN[i] + d1 * GCOS[i]);
      this.k[i] = k; this.omega[i] = om;
      this.amp[i] = A; var4 += A * A; slope4 += A * A * k * k;
      // at the focus the phase only ever advances by omega dt, whatever the wave vector does
      this.phase[i] = (this.phase[i] + (nkx - this.kx[i]) * fx + (nkz - this.kz[i]) * fz + om * h) % (TAU * 4096);
      // the groups travel at half the phase speed: their phase advances at (k / n) (c / 2) = omega / (2 n)
      this.gphase[i] = (this.gphase[i] + (ngx - this.gx[i]) * fx + (ngz - this.gz[i]) * fz + om * GK * 0.5 * h) % (TAU * 4096);
      this.kx[i] = nkx; this.kz[i] = nkz; this.gx[i] = ngx; this.gz[i] = ngz;
      u.uPhysWaterK[i] = k; u.uPhysWaterAmp[i] = this.amp[i]; u.uPhysWaterPhase[i] = this.phase[i] % TAU; u.uPhysWaterGroup[i] = this.gphase[i] % TAU;
    }
    u.uPhysWaterDir[0] = d0; u.uPhysWaterDir[1] = d1; u.uPhysWakeG = g;
    // whitecaps: how much of the surface is breaking, and so how high it has to stand to break
    this.cover = foamCover(this.whitecap01);
    // (the significant height of all four trains together, the swell with them: 4 sigma. The foam level is
    // measured for the standard four in units of their Hs; with a swell under them the surface stands
    // higher by the ratio of the two)
    this.significant = 4 * Math.sqrt(0.5 * var4 * VARG) / STD4;
    this.slope = Math.sqrt(0.5 * slope4 * VARG);          // rms slope of the surface
    this.foamAt = this.cover > WATER.foamMin && this.height > 0.02 ? this.significant * foamLevel(this.cover, var4 > 0 ? this.amp[NT - 1] * this.amp[NT - 1] / var4 : R0) : 1e9;
    const S = u.uPhysWaterSea; S[0] = this.significant; S[1] = this.foamAt; S[2] = Math.max(1e-4, this.height * WATER.foamEdge); S[3] = this.foamAt < 1e8 ? this.cover : 0;
    // (P18) the sea at every node about, from the last build and the trains of the moment
    this._fx = fx; this._fz = fz;
    if (this.map || this._mapOn) this._composeMap(h);
    // wakes age and die
    const W = this.wake;
    for (let w = 0; w < W.length; w += 4) {
      if (W[w + 3] === 0) continue;
      W[w + 2] += h;
      if (!this.present || W[w + 2] > WATER.wakeLife * Math.sqrt(wakeLength(W[w + 3])) * 1.6) W[w + 3] = 0;
    }
  }

  // The wake part of the surface at (x, z): elevation (m).
  wakeAt(x, z) {
    const W = this.wake, g = this.g;
    let s = 0;
    for (let w = 0; w < W.length; w += 4) {
      const amp = W[w + 3];
      if (amp === 0) continue;
      const L = wakeLength(amp), k = TAU / L, c = Math.sqrt(g / k), age = W[w + 2];
      const dx = x - W[w], dz = z - W[w + 1], r = Math.sqrt(dx * dx + dz * dz);
      const q = (r - 0.5 * c * age) / (WATER.wakeWidth * L);              // the packet rides at the group speed
      if (q > 3 || q < -3) continue;
      s += amp * Math.exp(-q * q - age / (WATER.wakeLife * Math.sqrt(L))) * Math.sqrt(L / (r + L)) * Math.cos(k * (r - c * age));
    }
    return s;
  }

  // The wakes with their slope: o[0] = elevation (m), o[1] = d/deast, o[2] = d/dnorth. The twin of pcPhysWake.
  wakeInto(x, z, o) {
    const W = this.wake, g = this.g;
    let s = 0, se = 0, sn = 0;
    for (let w = 0; w < W.length; w += 4) {
      const amp = W[w + 3];
      if (amp === 0) continue;
      const L = wakeLength(amp), k = TAU / L, c = Math.sqrt(g / k), age = W[w + 2];
      const dx = x - W[w], dz = z - W[w + 1], r = Math.sqrt(dx * dx + dz * dz);
      const q = (r - 0.5 * c * age) / (WATER.wakeWidth * L);
      if (q > 3 || q < -3) continue;
      const A = amp * Math.exp(-q * q - age / (WATER.wakeLife * Math.sqrt(L))) * Math.sqrt(L / (r + L)), ph = k * (r - c * age);
      const cp = Math.cos(ph);
      s += A * cp;
      // d/dr of the carrier and of the packet's own shape (its Gaussian edge and its spreading)
      if (r > 1e-4) { const m = (-A * k * Math.sin(ph) - A * cp * (2 * q / (WATER.wakeWidth * L) + 0.5 / (r + L))) / r; se += m * dx; sn += m * dz; }
    }
    o[0] = s; o[1] = se; o[2] = sn;
    return o;
  }

  // Everything about the surface at grid position (x, z): the twin of pcPhysWaterD and
  // pcPhysWaterCrest in WATER_GLSL. Fills o:
  //   height (m above the still level), de, dn (slope along the frame's east and north),
  //   ax, az (unit vector, frame axes: the way the crests lie here; a stroke runs along it),
  //   crest01 (0 flanks and troughs .. 1 the tops of the higher waves), foam01 (breaking now)
  surfaceAt(x, z, o = {}) {
    if (this._mapOn) return this._surfaceMap(x, z, o);
    let h = 0, he = 0, hn = 0, Dx = this.dir[0] * 1e-6, Dz = this.dir[1] * 1e-6;
    const G = WATER.group;
    for (let i = 0; i < NT; i++) {
      const A = this.amp[i];
      if (A === 0) continue;
      const a = this.kx[i] * x + this.kz[i] * z - this.phase[i], e = this.gx[i] * x + this.gz[i] * z - this.gphase[i];
      const env = 1 + G * Math.sin(e), sa = Math.sin(a), ca = Math.cos(a), ce = Math.cos(e);
      h += A * env * sa;
      he += A * (env * ca * this.kx[i] + G * ce * sa * this.gx[i]);
      hn += A * (env * ca * this.kz[i] + G * ce * sa * this.gz[i]);
      const w = A * env / (this.k[i] || 1); Dx += w * this.kx[i]; Dz += w * this.kz[i];
    }
    const wk = this.wakeInto(x, z, _wk3);
    h += wk[0]; he += wk[1]; hn += wk[2];
    const dl = Math.hypot(Dx, Dz) || 1;
    o.height = h; o.de = he; o.dn = hn; o.ax = -Dz / dl; o.az = Dx / dl;
    const hs = this.significant > 1e-4 ? this.significant : 1e-4;
    o.crest01 = smoothstep(WATER.crestLow, WATER.crestHigh, h / hs);
    // the crest LINE: on a high wave, where the surface stops rising along the way the waves run
    o.line01 = o.crest01 * (1 - smoothstep(WATER.lineIn, WATER.lineOut, Math.abs(he * Dx + hn * Dz) / dl / (this.slope > 1e-6 ? this.slope : 1e-6)));
    o.foam01 = this.foamAt < 1e8 ? smoothstep(this.foamAt, this.foamAt + Math.max(1e-4, this.height * WATER.foamEdge), h) : 0;
    return o;
  }

  // Elevation of the surface above its still level at grid position (x, z), metres.
  // The JS twin of pcPhysWaterHeight in WATER_GLSL.
  // (P12) THE SWASH: the level of the water's edge on a beach of this slope (rise over run) at grid position
  // (x, z), in metres above the still level: the water stands at the contour of the bed that is this high
  // (negative: it has drawn back to where the still water is that deep). Each wave of the long train runs
  // up in a third of its period and drains back in two thirds; sets of high waves reach further.
  // Stockdon et al. 2006 (ten field experiments on natural beaches): set-up 0.35 b sqrt(H0 L0), incident
  // swash 0.75 b sqrt(H0 L0) from its lowest to its highest (b the beach slope, H0 and L0 the height and
  // length of the waves offshore), never more than twice the wave height (a wave surging up a wall).
  // (P18) surfaceAt with the sea map: the trains read at the warped place (so they run the way the map turns them), each
  // scaled by the map there (sW the wind sea's three, s3 the long train), the slope with the warp's Jacobian and the
  // scales' own gradients; crests and foam against the local sea. The twin of pcPhysWaterD under PC_PHYS_SEA_MAP.
  _surfaceMap(x, z, o) {
    const m = this._seaAt(x, z), G = WATER.group;
    const xw = x + m[12], zw = z + m[13];
    const Jxx = 1 + m[16], Jzx = m[17], Jxz = m[20], Jzz = 1 + m[21];
    let h = 0, he = 0, hn = 0;
    let Dx = (Jxx * this.dir[0] + Jzx * this.dir[1]) * 1e-6, Dz = (Jxz * this.dir[0] + Jzz * this.dir[1]) * 1e-6, s2 = 0;
    for (let i = 0; i < NT; i++) {
      const A = this.amp[i];
      if (A === 0) continue;
      const q = i < NT - 1 ? 1 : 0, s = m[q ? 0 : 1], sx = m[q ? 4 : 5], sz = m[q ? 8 : 9];
      const kx = this.kx[i], kz = this.kz[i], gx = this.gx[i], gz = this.gz[i];
      const kxl = kx * Jxx + kz * Jzx, kzl = kx * Jxz + kz * Jzz, gxl = gx * Jxx + gz * Jzx, gzl = gx * Jxz + gz * Jzz;
      const a = kx * xw + kz * zw - this.phase[i], e = gx * xw + gz * zw - this.gphase[i];
      const env = 1 + G * Math.sin(e), sa = Math.sin(a), ca = Math.cos(a), ce = Math.cos(e);
      h += A * s * env * sa;
      he += A * s * (env * ca * kxl + G * ce * sa * gxl) + A * env * sa * sx;
      hn += A * s * (env * ca * kzl + G * ce * sa * gzl) + A * env * sa * sz;
      const w = A * s * env / (this.k[i] || 1); Dx += w * kxl; Dz += w * kzl;
      s2 += A * A * s * s * (kxl * kxl + kzl * kzl);
    }
    const wk = this.wakeInto(x, z, _wk3);
    h += wk[0]; he += wk[1]; hn += wk[2];
    const dl = Math.hypot(Dx, Dz) || 1;
    o.height = h; o.de = he; o.dn = hn; o.ax = -Dz / dl; o.az = Dx / dl;
    const A = this.amp, a012 = A[0] * A[0] + A[1] * A[1] + A[2] * A[2];
    const sig = 4 * Math.sqrt(0.5 * VARG * (a012 * m[0] * m[0] + A[3] * A[3] * m[1] * m[1])) / STD4, hs = sig > 1e-4 ? sig : 1e-4;
    const slope = Math.sqrt(0.5 * s2 * VARG);
    o.crest01 = smoothstep(WATER.crestLow, WATER.crestHigh, h / hs);
    o.line01 = o.crest01 * (1 - smoothstep(WATER.lineIn, WATER.lineOut, Math.abs(he * Dx + hn * Dz) / dl / (slope > 1e-6 ? slope : 1e-6)));
    o.foam01 = m[3] > WATER.foamMin ? smoothstep(m[2], m[2] + Math.max(1e-4, this.height * WATER.foamEdge * m[0]), h) : 0;
    return o;
  }

  runupAt(x, z, slope) {
    const i = NT - 1;
    if (!this.present || !(this.amp[i] > 0) || !(this.k[i] > 0)) return 0;
    if (this._mapOn) {
      // (P18) the long train as the map has it here: its local wavelength and height, read at the warped place
      const m = this._seaAt(x, z), A = this.amp, xw = x + m[12], zw = z + m[13];
      const kxl = this.kx[i] * (1 + m[16]) + this.kz[i] * m[17], kzl = this.kx[i] * m[20] + this.kz[i] * (1 + m[21]), kl = Math.hypot(kxl, kzl);
      const sig = 4 * Math.sqrt(0.5 * VARG * ((A[0] * A[0] + A[1] * A[1] + A[2] * A[2]) * m[0] * m[0] + A[i] * A[i] * m[1] * m[1])) / STD4;
      if (!(kl > 0) || !(A[i] * m[1] > 0)) return 0;
      const q = Math.sqrt(sig * TAU / kl), b = slope > 0 ? slope : 0, swing = Math.min(WATER.swashSwing * b * q, 2 * sig);
      const a = this.kx[i] * xw + this.kz[i] * zw - this.phase[i];
      const env = 1 + WATER.group * Math.sin(this.gx[i] * xw + this.gz[i] * zw - this.gphase[i]);
      return WATER.swashSetup * b * q + 0.5 * swing * env * (Math.cos(a) + 0.5 * Math.sin(2 * a)) * 0.7698229407236336;
    }
    const q = Math.sqrt(this.significant * TAU / this.k[i]), b = slope > 0 ? slope : 0;
    const swing = Math.min(WATER.swashSwing * b * q, 2 * this.significant);
    const a = this.kx[i] * x + this.kz[i] * z - this.phase[i];
    const env = 1 + WATER.group * Math.sin(this.gx[i] * x + this.gz[i] * z - this.gphase[i]);
    return WATER.swashSetup * b * q + 0.5 * swing * env * (Math.cos(a) + 0.5 * Math.sin(2 * a)) * 0.7698229407236336;
  }

  heightAt(x, z) {
    if (this._mapOn) {
      const m = this._seaAt(x, z), xw = x + m[12], zw = z + m[13];
      let s = 0;
      for (let i = 0; i < NT; i++) {
        if (this.amp[i] === 0) continue;
        s += this.amp[i] * m[i < NT - 1 ? 0 : 1] * (1 + WATER.group * Math.sin(this.gx[i] * xw + this.gz[i] * zw - this.gphase[i])) * Math.sin(this.kx[i] * xw + this.kz[i] * zw - this.phase[i]);
      }
      return s + this.wakeAt(x, z);
    }
    let s = 0;
    for (let i = 0; i < NT; i++) {
      if (this.amp[i] === 0) continue;
      s += this.amp[i] * (1 + WATER.group * Math.sin(this.gx[i] * x + this.gz[i] * z - this.gphase[i])) * Math.sin(this.kx[i] * x + this.kz[i] * z - this.phase[i]);
    }
    return s + this.wakeAt(x, z);
  }
}

const f = (x) => (Number.isInteger(x) ? x.toFixed(1) : String(x));
const C4 = 'xyzw';
const train = (i) => `  {
    vec2 di = vec2(d.x * ${f(COS[i])} - d.y * ${f(SIN[i])}, d.x * ${f(SIN[i])} + d.y * ${f(COS[i])});
    vec2 gi = vec2(d.x * ${f(GCOS[i])} - d.y * ${f(GSIN[i])}, d.x * ${f(GSIN[i])} + d.y * ${f(GCOS[i])}) * ${f(GK)};
    float k = uPhysWaterK.${C4[i]}, A = uPhysWaterAmp.${C4[i]};
    float a = k * dot(di, g) - uPhysWaterPhase.${C4[i]}, e = k * dot(gi, g) - uPhysWaterGroup.${C4[i]};
    float env = 1.0 + ${f(WATER.group)} * sin(e), sa = sin(a);
    o.x += A * env * sa;
    o.yz += A * k * (env * cos(a) * di + ${f(WATER.group)} * cos(e) * sa * gi);
    D += A * env * di;
  }`;

// (P18) a train read through the sea map: at the warped place gw, its phase gradient turned by Jt (the warp's
// Jacobian, transposed), scaled by sc with gradient dsc (the twin of WaterField._surfaceMap)
const trainMap = (i) => `  {
    vec2 di = vec2(d.x * ${f(COS[i])} - d.y * ${f(SIN[i])}, d.x * ${f(SIN[i])} + d.y * ${f(COS[i])});
    vec2 gi = vec2(d.x * ${f(GCOS[i])} - d.y * ${f(GSIN[i])}, d.x * ${f(GSIN[i])} + d.y * ${f(GCOS[i])}) * ${f(GK)};
    float k = uPhysWaterK.${C4[i]}, A = uPhysWaterAmp.${C4[i]};
    float sc = ${i < 3 ? 'sm.x' : 'sm.y'}; vec2 dsc = ${i < 3 ? 'vec2(sdx.x, sdz.x)' : 'vec2(sdx.y, sdz.y)'};
    vec2 kl = Jt * di, gl = Jt * gi;
    float a = k * dot(di, gw) - uPhysWaterPhase.${C4[i]}, e = k * dot(gi, gw) - uPhysWaterGroup.${C4[i]};
    float env = 1.0 + ${f(WATER.group)} * sin(e), sa = sin(a);
    o.x += A * sc * env * sa;
    o.yz += A * sc * k * (env * cos(a) * kl + ${f(WATER.group)} * cos(e) * sa * gl) + A * env * sa * dsc;
    D += A * sc * env * kl;
  }`;
const SEA_GLSL = /* glsl */`
#ifdef PC_PHYS_SEA_MAP
// (P18) The sea map (physics.md, "For PAINTER", P18): the sea raised at every node about over its own fetch and depth,
// turned toward its longest fetch and refracted toward its shore. A ${MN} x ${SEA_TEX.rows} RGBA float texture (nearest
// filtering; read with texelFetch): rows 0-${MN - 1} the inner level (x the wind sea's scale, y the long train's, z the
// elevation (m) above which the sea breaks there, w the share that is white), rows ${MN}-${2 * MN - 1} the inner level's
// warp (xy, m, frame axes), rows ${2 * MN}-${3 * MN - 1} the outer level (as the inner).
uniform highp sampler2D uPhysSeaMap;
uniform vec4 uPhysSeaGrid;     // inner level: frame position (m) of node (0, 0), cell (m), nodes a side (under 2: no map)
uniform vec4 uPhysSeaGrid2;    // outer level: the same (under 2: none)
uniform vec4 uPhysSeaBand;     // (P19) where the inner level gives way to the outer one: a rectangle, xy its centre (frame m),
                               // zw its half-widths (m) along east and north; the band is ${f(SEA_TEX.band)} inner cells wide inside it
// One level's four numbers at grid position g (bilinear), with their derivatives along east and north (per m)
vec4 pcPhysSeaTap(vec4 grid, int r0, vec2 g, out vec4 ddx, out vec4 ddz) {
  float Nm = grid.w - 1.0;
  vec2 uv = (g - grid.xy) / grid.z;
  vec2 c = clamp(uv, vec2(0.0), vec2(Nm));
  vec2 inside = vec2(abs(uv.x - c.x) <= 1e-6 ? 1.0 : 0.0, abs(uv.y - c.y) <= 1e-6 ? 1.0 : 0.0) / grid.z;
  vec2 i0 = min(floor(c), vec2(Nm - 1.0));
  vec2 fr = c - i0;
  ivec2 b = ivec2(i0) + ivec2(0, r0);
  vec4 a00 = texelFetch(uPhysSeaMap, b, 0), a10 = texelFetch(uPhysSeaMap, b + ivec2(1, 0), 0);
  vec4 a01 = texelFetch(uPhysSeaMap, b + ivec2(0, 1), 0), a11 = texelFetch(uPhysSeaMap, b + ivec2(1, 1), 0);
  vec4 lo = a00 + (a10 - a00) * fr.x, hi = a01 + (a11 - a01) * fr.x;
  ddx = ((a10 - a00) * (1.0 - fr.y) + (a11 - a01) * fr.y) * inside.x;
  ddz = (hi - lo) * inside.y;
  return lo + (hi - lo) * fr.y;
}
// The per-node numbers at g, the two levels blended: (P19) the inner gives way to the outer across the band inside the
// rectangle uPhysSeaBand, whose edges move continuously, not in whole cells with the grid
vec4 pcPhysSeaP(vec2 g, out vec4 ddx, out vec4 ddz) {
  vec4 p = pcPhysSeaTap(uPhysSeaGrid, 0, g, ddx, ddz);
  if (uPhysSeaGrid2.w < 2.0) return p;
  vec4 dx2, dz2;
  vec4 q = pcPhysSeaTap(uPhysSeaGrid2, ${2 * MN}, g, dx2, dz2);
  vec2 dl = g - uPhysSeaBand.xy, e = uPhysSeaBand.zw - abs(dl);
  float bw = ${f(SEA_TEX.band)} * uPhysSeaGrid.z;
  float t = clamp(min(e.x, e.y) / bw, 0.0, 1.0), w = t * t * (3.0 - 2.0 * t);
  vec2 dd = e.x <= e.y ? vec2(sign(dl.x), 0.0) : vec2(0.0, sign(dl.y));
  vec2 dw = (t > 0.0 && t < 1.0) ? -6.0 * t * (1.0 - t) / bw * dd : vec2(0.0);
  ddx = w * ddx + (1.0 - w) * dx2 + (p - q) * dw.x;
  ddz = w * ddz + (1.0 - w) * dz2 + (p - q) * dw.y;
  return q + (p - q) * w;
}
// The inner level's warp at g (xy, m) and Jt, the transpose of the Jacobian of g + warp. (P19: the warp rows hold the warp
// as far as the band lets it be read, so its turns fade across the band and are gone beyond it: WaterField._composeMap)
vec2 pcPhysSeaWarp(vec2 g, out mat2 Jt) {
  vec4 wdx, wdz; vec4 wv = pcPhysSeaTap(uPhysSeaGrid, ${MN}, g, wdx, wdz);
  Jt = mat2(1.0 + wdx.x, wdz.x, wdx.y, 1.0 + wdz.y);
  return wv.xy;
}
// The local sea at a body-local point: what uPhysWaterSea is for the reference sea, here (x significant height (m),
// y the elevation above which it breaks (m), z the width of that edge (m), w the share that is white)
vec4 pcPhysSeaLocal(vec3 p) {
  if (uPhysSeaGrid.w < 2.0) return uPhysWaterSea;
  vec4 dx, dz; vec4 m = pcPhysSeaP(pcPhysGrid(p), dx, dz);
  vec4 A = uPhysWaterAmp * vec4(m.x, m.x, m.x, m.y);
  bool br = m.w > ${f(WATER.foamMin)};
  return vec4(${f(4 / STD4)} * sqrt(${f(0.5 * VARG)} * dot(A, A)), br ? m.z : 1e9, max(1e-4, uPhysWaterSea.z * m.x), br ? m.w : 0.0);
}
// The way the waves run at a body-local point (frame axes, unit): uPhysWaterDir turned by the map
vec2 pcPhysSeaDir(vec3 p) {
  if (uPhysSeaGrid.w < 2.0) return uPhysWaterDir;
  mat2 Jt; pcPhysSeaWarp(pcPhysGrid(p), Jt);
  return normalize(Jt * uPhysWaterDir);
}
#endif
`;

// GLSL twin. Shares the frame uniforms with FLORA_GLSL (guarded, so both may be included).
export const WATER_GLSL = /* glsl */`
// ---- Painted Cosmos physics: wind waves and wakes (generated from src/physics/water.js) ----
#ifndef PC_PHYS_FRAME
#define PC_PHYS_FRAME
uniform vec3 uPhysAnchor;      // body-local anchor of the field frame (m)
uniform vec3 uPhysEast;        // unit axes of the frame, body-local
uniform vec3 uPhysNorth;
uniform vec3 uPhysUp;
// (P12: along the ray from the body's centre, the exact inverse of how the fields sample the ground; it was
// the foot of the perpendicular on the tangent plane, 1.8 m out of register 384 m from the anchor.)
vec2 pcPhysGrid(vec3 p) {
  vec3 d = p - uPhysAnchor; float r0 = dot(uPhysAnchor, uPhysUp);
  return vec2(dot(d, uPhysEast), dot(d, uPhysNorth)) * (r0 > 1.0 ? r0 / max(r0 + dot(d, uPhysUp), 0.05 * r0) : 1.0);
}
#endif
uniform vec2 uPhysWaterDir;    // wave direction (frame axes)
uniform vec4 uPhysWaterK;      // wavenumbers of the four trains (rad/m)
uniform vec4 uPhysWaterAmp;    // amplitudes (m)
uniform vec4 uPhysWaterPhase;  // phases (rad)
uniform vec4 uPhysWaterGroup;  // phases of each train's groups (rad)
uniform vec4 uPhysWaterSea;    // x: significant height Hs (m); y: the elevation (m) above which the sea is breaking
                               // now (1e9: it is not); z: the width of that edge (m); w: whitecap cover (share of the surface)
uniform vec4 uPhysWake[${WATER.wakes}];     // wakes: x, z (frame axes, m), age (s), amplitude (m; 0 = unused)
uniform float uPhysWakeG;      // gravity (m/s^2), for the speed of the wake waves
${SEA_GLSL}
// The wakes: xyz = (height, dh/deast, dh/dnorth). Skip it (PC_PHYS_NO_WAKE) on far water.
vec3 pcPhysWake(vec2 g) {
  vec3 o = vec3(0.0);
  for (int i = 0; i < ${WATER.wakes}; i++) {
    vec4 w = uPhysWake[i];
    if (w.w <= 0.0) continue;
    float L = 0.8 + 14.0 * w.w, k = 6.2831853 / L, c = sqrt(uPhysWakeG / k);
    vec2 dl = g - w.xy; float r = length(dl);
    float q = (r - 0.5 * c * w.z) / (${f(WATER.wakeWidth)} * L);
    if (abs(q) > 3.0) continue;
    float A = w.w * exp(-q * q - w.z / (${f(WATER.wakeLife)} * sqrt(L))) * sqrt(L / (r + L));
    float ph = k * (r - c * w.z);
    float cp = cos(ph);
    o.x += A * cp;
    o.yz += (-A * k * sin(ph) - A * cp * (2.0 * q / (${f(WATER.wakeWidth)} * L) + 0.5 / (r + L))) * (r > 1e-4 ? dl / r : vec2(0.0));
  }
  return o;
}

// (P12) The long train alone (the swell where the sea is open, else the longest wave of the wind sea; its
// wavelength is 6.2831853 / uPhysWaterK.w): xyz as pcPhysWaterD. For water far from the eye, where the mesh
// is too coarse for the short trains but can still carry this one: on Neptune's storm coast the short
// trains are 7 to 11 m long and 0.2 m high and this one is 52 m long and 0.87 m high, so a surface that
// stops heaving 6 short wavelengths out (64 m) is flat although the sea is 2.8 m high.
vec3 pcPhysWaterLong(vec3 p) {
  vec2 g = pcPhysGrid(p);
  vec2 d = uPhysWaterDir;
  vec3 o = vec3(0.0);
  vec2 D = vec2(0.0);
#ifdef PC_PHYS_SEA_MAP
  if (uPhysSeaGrid.w >= 2.0) {
    mat2 Jt; vec2 gw = g + pcPhysSeaWarp(g, Jt);
    vec4 sdx, sdz; vec4 sm = pcPhysSeaP(g, sdx, sdz);
${trainMap(3)}
    return o;
  }
#endif
${train(3)}
  return o;
}

// Elevation (m) of the liquid surface above its still level at a body-local point, and its
// slope along the frame's east and north axes: xyz = (height, dh/deast, dh/dnorth).
// along: the way the crests lie at this point (unit, frame axes): the direction a stroke runs.
vec3 pcPhysWaterD(vec3 p, out vec2 along) {
  vec2 g = pcPhysGrid(p);
  vec2 d = uPhysWaterDir;
  vec3 o = vec3(0.0);
  vec2 D = d * 1e-6;
#ifdef PC_PHYS_SEA_MAP
  if (uPhysSeaGrid.w >= 2.0) {
    mat2 Jt; vec2 gw = g + pcPhysSeaWarp(g, Jt);
    vec4 sdx, sdz; vec4 sm = pcPhysSeaP(g, sdx, sdz);
    D = (Jt * d) * 1e-6;
${[0, 1, 2, 3].map(trainMap).join('\n')}
  } else {
#endif
${[0, 1, 2, 3].map(train).join('\n')}
#ifdef PC_PHYS_SEA_MAP
  }
#endif
  #ifndef PC_PHYS_NO_WAKE
    o += pcPhysWake(g);
  #endif
  D = normalize(D);
  along = vec2(-D.y, D.x);
  return o;
}
vec3 pcPhysWater(vec3 p) { vec2 along; return pcPhysWaterD(p, along); }
float pcPhysWaterHeight(vec3 p) { return pcPhysWater(p).x; }

// Crests and foam at a point, from what pcPhysWater returned there:
//   x  crest01: 0 on the flanks and in the troughs, 1 on the tops of the higher waves
//      (where a painter leaves the paper bare)
//   y  foam01: the sea is breaking here (whitecaps); 0 everywhere in a light sea
vec2 pcPhysWaterCrest(vec3 w) {
  float hs = max(uPhysWaterSea.x, 1e-4);
  float foam = uPhysWaterSea.y < 1e8 ? smoothstep(uPhysWaterSea.y, uPhysWaterSea.y + uPhysWaterSea.z, w.x) : 0.0;
  return vec2(smoothstep(${f(WATER.crestLow)}, ${f(WATER.crestHigh)}, w.x / hs), foam);
}
// The crest as a LINE (P7), from what pcPhysWaterD returned: 1 along the very top of a high wave (where the
// surface stops rising along the way the waves run), 0 a twelfth of a wavelength either side. crest01 is the
// whole top of the wave (a cap: a white sheet from near by); this is the stroke a painter leaves bare.
float pcPhysWaterCrestLine(vec3 w, vec2 along) {
  float hs = max(uPhysWaterSea.x, 1e-4);
  vec4 ak = uPhysWaterAmp * uPhysWaterK;                       // (the sea's rms slope, from its four trains)
  float s = abs(dot(w.yz, vec2(along.y, -along.x))) / max(sqrt(${f(0.5 * (1 + 0.45 * 0.45 / 2))} * dot(ak, ak)), 1e-6);
  return smoothstep(${f(WATER.crestLow)}, ${f(WATER.crestHigh)}, w.x / hs) * (1.0 - smoothstep(${f(WATER.lineIn)}, ${f(WATER.lineOut)}, s));
}
// (P12) The swash: the level (m above the still level) of the water's edge on a beach of this slope (rise over
// run; 0.07 is a sandy beach) at a body-local point: where the still depth plus this is under zero the bed is
// bare for the moment (wet sand), and the edge of the water lies where they sum to zero. It runs up in a third
// of the long train's period and drains back in two thirds. Twin of WaterField.runupAt.
float pcPhysWaterRunup(vec3 p, float slope) {
  float k = uPhysWaterK.w;
  if (uPhysWaterAmp.w <= 0.0 || k <= 0.0) return 0.0;
  vec2 g = pcPhysGrid(p), d = uPhysWaterDir;
#ifdef PC_PHYS_SEA_MAP
  if (uPhysSeaGrid.w >= 2.0) {
    // (P18) the long train as the map has it here: its local wavelength and height, read at the warped place
    mat2 Jt; vec2 gw = g + pcPhysSeaWarp(g, Jt);
    vec4 sdx, sdz; vec4 sm = pcPhysSeaP(g, sdx, sdz);
    vec2 di = vec2(d.x * ${f(COS[3])} - d.y * ${f(SIN[3])}, d.x * ${f(SIN[3])} + d.y * ${f(COS[3])});
    vec2 gi = vec2(d.x * ${f(GCOS[3])} - d.y * ${f(GSIN[3])}, d.x * ${f(GSIN[3])} + d.y * ${f(GCOS[3])}) * ${f(GK)};
    vec4 A = uPhysWaterAmp * vec4(sm.x, sm.x, sm.x, sm.y);
    float kl = k * length(Jt * di), sig = ${f(4 / STD4)} * sqrt(${f(0.5 * VARG)} * dot(A, A));
    if (kl <= 0.0 || A.w <= 0.0) return 0.0;
    float q = sqrt(sig * 6.2831853 / kl), b = max(slope, 0.0);
    float a = k * dot(di, gw) - uPhysWaterPhase.w, env = 1.0 + ${f(WATER.group)} * sin(k * dot(gi, gw) - uPhysWaterGroup.w);
    return ${f(WATER.swashSetup)} * b * q + 0.5 * min(${f(WATER.swashSwing)} * b * q, 2.0 * sig) * env * (cos(a) + 0.5 * sin(2.0 * a)) * ${f(1 / 1.299)};
  }
#endif
  vec2 di = vec2(d.x * ${f(COS[3])} - d.y * ${f(SIN[3])}, d.x * ${f(SIN[3])} + d.y * ${f(COS[3])});
  vec2 gi = vec2(d.x * ${f(GCOS[3])} - d.y * ${f(GSIN[3])}, d.x * ${f(GSIN[3])} + d.y * ${f(GCOS[3])}) * ${f(GK)};
  float q = sqrt(uPhysWaterSea.x * 6.2831853 / k), b = max(slope, 0.0);
  float a = k * dot(di, g) - uPhysWaterPhase.w, env = 1.0 + ${f(WATER.group)} * sin(k * dot(gi, g) - uPhysWaterGroup.w);
  return ${f(WATER.swashSetup)} * b * q + 0.5 * min(${f(WATER.swashSwing)} * b * q, 2.0 * uPhysWaterSea.x) * env * (cos(a) + 0.5 * sin(2.0 * a)) * ${f(1 / 1.299)};
}
// The surf at a shore: 0..1, how far a wave of this sea has broken in liquid depth metres deep.
float pcPhysWaterSurf(float depth) {
  return uPhysWaterSea.x > 0.02 ? 1.0 - smoothstep(0.5, ${f(1 / WATER.surfBreak)}, depth / uPhysWaterSea.x) : 0.0;
}
// (P18) The same two against a given sea (pcPhysSeaLocal(p) under PC_PHYS_SEA_MAP, else uPhysWaterSea): crests and foam,
// and the surf at a shore, of the sea that is there
vec2 pcPhysWaterCrestAt(vec3 w, vec4 sea) {
  float hs = max(sea.x, 1e-4);
  float foam = sea.y < 1e8 ? smoothstep(sea.y, sea.y + sea.z, w.x) : 0.0;
  return vec2(smoothstep(${f(WATER.crestLow)}, ${f(WATER.crestHigh)}, w.x / hs), foam);
}
float pcPhysWaterSurfAt(float depth, vec4 sea) {
  return sea.x > 0.02 ? 1.0 - smoothstep(0.5, ${f(1 / WATER.surfBreak)}, depth / sea.x) : 0.0;
}
// The unit normal of the surface (body-local) from pcPhysWater's result and the local up.
vec3 pcPhysWaterNormal(vec3 w, vec3 up) { return normalize(up - w.y * uPhysEast - w.z * uPhysNorth); }
// A frame-axes direction (such as \`along\`) as a body-local vector.
vec3 pcPhysWaterDir(vec2 a) { return a.x * uPhysEast + a.y * uPhysNorth; }
`;
export { clamp01 };
