// Painted Cosmos physics: weather systems. OWNER: PHYSICS. Pure (no three, no DOM).
//
// Each body carries a fixed number of weather CELLS: systems that are born, drift with the
// steering wind of their latitude, mature, decay and are reborn elsewhere. Everything is a pure
// function of (body, seed, time): there is no stored state, so the weather is the same on every
// visit, can be asked about any place at any time (past or future), and survives a teleport.
//
// Ground wetness and fresh snow are integrals over the recent past of that same function, so
// they build up under rain and dry or melt afterwards without any per-place memory.
//
// TIME SCALE: the game's day lasts about 25 minutes (Earth: 1500 s), so weather processes run
// 60 times faster than real ones (WEATHER.timeScale). A real hour of drying, melting or snowfall
// takes one game minute. Rates below are quoted in real units and converted with that factor.
import { BODIES } from '../data/bodies.js';
import { ATMOSPHERES, SPECIES, terminalVelocity, meanFreePath, airDensity, airTemperature } from './atmosphere.js';
import { prevailing, windLarge, WINDS } from './wind.js';
import { hash3, hashString, clamp, clamp01, mix, smoothstep, TAU } from './util.js';

export const WEATHER = Object.freeze({
  timeScale: 60,           // game seconds of weather per real second (see above)
  dryTime: 3.0 * 3600,     // real s for a soaked surface to dry in still air at 288 K
  wetDepth: 3.0,           // mm of rain that wets the ground through (a heavy shower: about 20 game seconds)
  snowRatio: 10,           // m of fresh snow per m of water (100 kg/m^3)
  meltRate: 4.0,           // mm of water per kelvin above freezing per real day (degree-day factor)
  snowLife: 8 * 3600,      // real s before fresh snow settles (crusts, is trodden, blows off): 8 game minutes (30 h before P7)
  slot: 9,                 // s: lightning scheduling slot
  frontReach: 1.3,         // gust front runs this many cell radii ahead of the core
  coldShare: 0.35,         // water a system gives as snow, as a fraction of what it would rain
  passTime: 40,            // s: no system is smaller than the distance it drifts in this time
  edgeTime: 30,            // s: how long the edge of a drifting system takes to pass
  clearVisibility: 20000,  // m: visual range of clean air (Koschmieder, real scale)
  // (P7) a gale's own sky: from galeFrom to galeFull m/s of large-scale wind (Beaufort 8 to 12) scud covers up to
  // galeCloud of the sky, and over an open sea spray takes the view (sprayExt: extinction in units of clear air:
  // 12 = a visual range of 1.5 km in a hurricane-force wind over a breaking sea)
  galeFrom: 18, galeFull: 34, galeCloud: 0.9, sprayExt: 12,
});

// Cell kinds. rate: peak precipitation (mm/h water equivalent). cloud: cloud cover. wind: mean
// wind multiplier at full strength. outflow: gust-front speed (m/s). flash: lightning flashes
// per minute at full strength. vis: visual range at full strength (m). size / life: multipliers.
const KINDS = {
  cloud: { rate: 0.0, cloud: 0.85, wind: 1.0, outflow: 0, flash: 0, vis: 0, size: 1.3, life: 1.2 },
  drizzle: { rate: 0.8, cloud: 1.0, wind: 1.0, outflow: 0, flash: 0, vis: 4000, size: 1.2, life: 1.2 },
  rain: { rate: 6, cloud: 1.0, wind: 1.3, outflow: 2, flash: 0, vis: 0, size: 1.2, life: 1.2 },
  shower: { rate: 10, cloud: 0.9, wind: 1.4, outflow: 6, flash: 0, vis: 0, size: 0.6, life: 0.6 },
  storm: { rate: 32, cloud: 1.0, wind: 1.9, outflow: 14, flash: 5, vis: 0, size: 0.9, life: 0.8 },
  fog: { rate: 0.0, cloud: 0.6, wind: 0.35, outflow: 0, flash: 0, vis: 120, size: 0.8, life: 1.0 },
  // Mars: regional dust storm. Lifts dust once the wind passes the saltation threshold.
  dust: { rate: 0.0, cloud: 0.5, wind: 3.0, outflow: 8, flash: 0, vis: 90, size: 1.8, life: 1.6, dust: 1 },
  // Venus: sulphur haze banks, and sulphuric-acid drizzle that mostly evaporates on the way down.
  haze: { rate: 0.0, cloud: 1.0, wind: 1.0, outflow: 0, flash: 0, vis: 350, size: 1.5, life: 1.5 },
  acid: { rate: 1.2, cloud: 1.0, wind: 1.2, outflow: 0, flash: 0.3, vis: 900, size: 1.0, life: 1.0 },
  // Ice giants: fall of ice crystals; Pluto: slow frost from the thin nitrogen air.
  ice: { rate: 1.5, cloud: 0.8, wind: 1.3, outflow: 3, flash: 0, vis: 1500, size: 1.2, life: 1.2 },
  frost: { rate: 0.15, cloud: 0.2, wind: 1.0, outflow: 0, flash: 0, vis: 6000, size: 1.6, life: 1.8 },
  // Pluto: thin layered haze.
  veil: { rate: 0.0, cloud: 0.3, wind: 1.0, outflow: 0, flash: 0, vis: 7000, size: 1.6, life: 1.8 },
};

// Per-body regime. cells: how many systems. radius: [min, max] m. life: [min, max] s.
// steer: cells drift at this multiple of the prevailing surface wind (Venus: the cloud deck
// super-rotates far faster than the slow surface air). kinds: [kind, weight].
// frostBelow: frost only falls where the air is colder than this (K).
// melt: freezing point of the precipitating substance (K). liquid / solid: particle species.
// virga: altitude (m) below which falling drops have evaporated (0 = they reach the ground).
export const REGIMES = {
  mercury: { cells: 0 },
  moon: { cells: 0 },
  venus: { cells: 14, radius: [700, 1500], life: [1200, 2400], steer: 8, melt: 0, liquid: 'acid', solid: 'acid', virga: 160,
    kinds: [['haze', 5], ['acid', 3], ['cloud', 2]] },
  earth: { cells: 22, radius: [500, 1300], life: [600, 1500], steer: 1.6, melt: 273.15, liquid: 'rain', solid: 'snow', virga: 0,
    kinds: [['cloud', 3], ['drizzle', 1.2], ['rain', 2], ['shower', 2], ['storm', 1.1], ['fog', 1]] },
  mars: { cells: 9, radius: [600, 1400], life: [1200, 2600], steer: 1.3, melt: 1e9, liquid: 'frost', solid: 'frost', virga: 0, frostBelow: 200,
    kinds: [['dust', 3], ['cloud', 3], ['frost', 1]] },
  // Jupiter: storms ride the jets. `tracks` = the number of jets between equator and pole (the
  // wind bands); a cell is born on one of them and runs along it, eastward on one jet, westward
  // on the next. `spots`: storms that never die. The Great Red Spot: an anticyclone at 22 S that
  // has lasted centuries, drifting slowly west, its winds circling at about 120 m/s (scaled).
  jupiter: { cells: 26, radius: [500, 1400], life: [500, 1200], steer: 1.2, melt: 273.15, liquid: 'rain', solid: 'snow', virga: 0, tracks: 11,
    kinds: [['storm', 3], ['shower', 2], ['rain', 2], ['cloud', 3]],
    spots: [{ name: 'Great Red Spot', lat: -22, lon: 40, drift: -1.2, radius: 1500, kind: 'storm', strength: 0.95, swirl: 11, spin: 1 }] },
  // Saturn: mist and fine drizzle, calm between rare great storms, all of it carried round on
  // the broad equatorial jet.
  saturn: { cells: 20, radius: [600, 1500], life: [700, 1600], steer: 1.1, melt: 273.15, liquid: 'drizzle', solid: 'snow', virga: 0, tracks: 7,
    kinds: [['fog', 4], ['drizzle', 2], ['rain', 1.5], ['storm', 0.8], ['cloud', 3]] },
  uranus: { cells: 18, radius: [600, 1500], life: [800, 1800], steer: 0.9, melt: 90.7, liquid: 'methaneRain', solid: 'methaneSnow', virga: 0,
    kinds: [['ice', 4], ['fog', 3], ['cloud', 3], ['storm', 0.6]] },
  // Neptune: the fastest weather in the solar system. Its Great Dark Spot (Voyager 2, 1989) was
  // an anticyclone racing west at 300 m/s; here it is a storm that laps the planet in half an hour.
  neptune: { cells: 24, radius: [600, 1500], life: [500, 1300], steer: 0.9, melt: 90.7, liquid: 'methaneRain', solid: 'methaneSnow', virga: 0,
    kinds: [['storm', 3], ['rain', 3], ['shower', 2], ['ice', 1.5], ['cloud', 2]],
    spots: [{ name: 'Great Dark Spot', lat: -20, lon: 200, drift: -13, radius: 1300, kind: 'storm', strength: 0.9, swirl: 14, spin: 1 }] },
  pluto: { cells: 8, radius: [500, 1100], life: [1500, 3000], steer: 2, melt: 1e9, liquid: 'frost', solid: 'frost', virga: 0,
    kinds: [['frost', 4], ['veil', 2]] },
};
for (const id in REGIMES) {
  const r = REGIMES[id];
  if (!r.kinds) continue;
  let s = 0;
  for (const k of r.kinds) s += k[1];
  r.total = s;
}

// The default seed puts a fair morning over Earth's home forest for the first minutes of play
// (weather.test.mjs checks it). Change it only together with that test.
export const DEFAULT_SEED = 18;

// (the last lookup is remembered: building a string key on every call would allocate)
const seedCache = {};
let _sb = null, _ss = NaN, _sv = 0;
function seedFor(bodyId, seed) {
  if (bodyId === _sb && seed === _ss) return _sv;
  const k = bodyId + ':' + seed;
  _sb = bodyId; _ss = seed;
  return (_sv = seedCache[k] || (seedCache[k] = hashString('weather-' + k) | 0));
}

const _pv = new Float64Array(2);
// One cell at one time. Fills c: x,y,z (unit centre), r (m), w (0..1 strength now), kind (object),
// kindId, age, life, gen, i. Returns false when the cell is dormant.
function cellAt(bodyId, R, regime, s, i, t, c) {
  if (i >= regime.cells) return spotAt(R, regime.spots[i - regime.cells], i, t, c);
  const life0 = mix(regime.life[0], regime.life[1], hash3(i, 1, 0, s));
  const phase = hash3(i, 2, 0, s) * life0;
  const kid = pickKind(regime, hash3(i, 3, Math.floor((t + phase) / life0), s));
  const K = KINDS[kid];
  // the life of this generation depends on its kind, but generations must tile time: use the
  // base life for the schedule and let short-lived kinds spend the rest of the slot dormant
  const gen = Math.floor((t + phase) / life0);
  const age = (t + phase) - gen * life0;
  const life = life0 * Math.min(1, K.life / 1.2);
  if (age >= life) return false;
  const u = age / life;
  const env = smoothstep(0, 0.22, u) * (1 - smoothstep(0.72, 1, u));
  if (env <= 0) return false;
  const strength = mix(0.45, 1, hash3(i, 5, gen, s));
  let sy0 = hash3(i, 6, gen, s) * 1.9 - 0.95;
  if (regime.tracks) {
    // born on a jet: latitude m * 90 / tracks degrees, a degree or two either side
    const m = Math.round((hash3(i, 6, gen, s) * 2 - 1) * (regime.tracks - 1) * 0.5);
    sy0 = Math.sin(m * Math.PI / regime.tracks + (hash3(i, 10, gen, s) - 0.5) * 0.05);
  }
  const lon0 = hash3(i, 7, gen, s) * TAU;
  const lat0 = Math.asin(sy0);
  prevailing(bodyId, sy0, _pv);
  const cl = Math.max(0.3, Math.cos(lat0));
  // never quite still: systems have their own drift of a metre or two per second
  const own = (hash3(i, 8, gen, s) - 0.5) * 3;
  const ownN = regime.tracks ? 0 : (hash3(i, 9, gen, s) - 0.5) * 1.6;      // a storm on a jet stays on it
  const vn = regime.tracks ? 0 : regime.steer * _pv[1] * 0.5 + ownN;
  const ts = age - life * 0.5;
  const lon = lon0 + (regime.steer * _pv[0] + own) / (R * cl) * ts;
  const lat = clamp(lat0 + vn / R * ts, -1.45, 1.45);
  const cla = Math.cos(lat);
  c.x = cla * Math.sin(lon); c.y = Math.sin(lat); c.z = cla * Math.cos(lon);
  // velocity of the centre (east, north), for the lab and for gust-front direction
  c.ve = regime.steer * _pv[0] + own; c.vn = vn;
  // A system carried on a fast jet is a big one: it is never smaller than the distance it
  // travels in WEATHER.passTime, so even the fastest weather takes that long to arrive.
  c.r = Math.max(mix(regime.radius[0], regime.radius[1], hash3(i, 4, gen, s)) * K.size, Math.hypot(c.ve, vn) * WEATHER.passTime) * (0.75 + 0.25 * env);
  c.w = env * strength; c.s = strength; c.env = env;
  c.kind = K; c.kindId = kid; c.age = age; c.life = life; c.gen = gen; c.i = i;
  c.swirl = 0; c.spin = 0;
  return true;
}
// A storm that never dies: fixed latitude, steady drift in longitude, a slow breathing strength.
function spotAt(R, sp, i, t, c) {
  const lat = sp.lat * Math.PI / 180, cla = Math.cos(lat);
  const lon = sp.lon * Math.PI / 180 + sp.drift / (R * cla) * t;
  c.x = cla * Math.sin(lon); c.y = Math.sin(lat); c.z = cla * Math.cos(lon);
  c.r = sp.radius;
  c.w = sp.strength * (0.9 + 0.1 * Math.sin(t / 97 + i)); c.s = c.w; c.env = 1;
  c.kind = KINDS[sp.kind]; c.kindId = sp.kind; c.age = t; c.life = Infinity; c.gen = 0; c.i = i;
  c.swirl = sp.swirl; c.spin = sp.spin;
  c.ve = sp.drift; c.vn = 0;
  return true;
}
function pickKind(regime, h) {
  let a = h * regime.total;
  const ks = regime.kinds;
  for (let k = 0; k < ks.length; k++) { a -= ks[k][1]; if (a <= 0) return ks[k][0]; }
  return ks[ks.length - 1][0];
}

// All live cells of a body at time t (for the lab's globe view and for tests).
export function cellsAt(bodyId, t, seed = DEFAULT_SEED) {
  const regime = REGIMES[bodyId];
  const out = [];
  if (!regime || !regime.cells) return out;
  const R = BODIES[bodyId].radius, s = seedFor(bodyId, seed);
  const n = regime.cells + (regime.spots ? regime.spots.length : 0);
  for (let i = 0; i < n; i++) {
    const c = {};
    if (cellAt(bodyId, R, regime, s, i, t, c)) out.push(c);
  }
  return out;
}

const _c = {};
const _acc = { rate: 0, rateIce: 0, rateFrost: 0, cloud: 0, windMul: 1, calm: 0, flash: 0, fog: 0, haze: 0, dust: 0, ox: 0, oy: 0, oz: 0, storm: 0, top: null, topW: 0, topCell: -1, topGen: 0, front: 0 };

// Sum the influence of every cell on unit direction (ux,uy,uz) at time t into _acc.
function gather(bodyId, ux, uy, uz, t, seed) {
  const a = _acc;
  a.rate = 0; a.rateIce = 0; a.rateFrost = 0; a.cloud = 0; a.windMul = 1; a.calm = 0; a.flash = 0; a.fog = 0; a.haze = 0; a.dust = 0;
  a.ox = a.oy = a.oz = 0; a.storm = 0; a.top = null; a.topW = 0; a.topCell = -1; a.topGen = 0; a.front = 0;
  const regime = REGIMES[bodyId];
  if (!regime || !regime.cells) return a;
  const R = BODIES[bodyId].radius, s = seedFor(bodyId, seed);
  let clear = 1;
  const nCells = regime.cells + (regime.spots ? regime.spots.length : 0);
  for (let i = 0; i < nCells; i++) {
    if (!cellAt(bodyId, R, regime, s, i, t, _c)) continue;
    const dot = ux * _c.x + uy * _c.y + uz * _c.z;
    const reach = _c.r * WEATHER.frontReach;
    const d = R * Math.sqrt(Math.max(0, 2 - 2 * dot));
    if (d >= reach) continue;
    const K = _c.kind;
    const x = d / _c.r;
    // The edges are smeared by turbulent mixing as the system travels: the faster it drifts,
    // the wider they are (an edge takes about WEATHER.edgeTime to pass).
    const x0 = clamp(1 - Math.hypot(_c.ve, _c.vn) * WEATHER.edgeTime / _c.r, 0.2, 0.45);
    const core = (1 - smoothstep(x0, 1, x)) * _c.w;                // precipitation footprint
    const cover = (1 - smoothstep(x0 + 0.25, 1.15, x)) * _c.w;     // cloud shield is wider
    if (core > 0) {
      const rr = K.rate * core * core;
      a.rate += rr;
      if (K === KINDS.ice) a.rateIce += rr; else if (K === KINDS.frost) a.rateFrost += rr;
      a.flash += K.flash * core;
    }
    if (K.vis > 0) {
      // A bank of fog, dust or haze. The extinction (in clear-air units) is shaped so that the
      // visual range closes in steadily on the way in: visibility01 = 1 / sqrt(1 + ext) falls
      // in proportion to the depth into the bank, and the edge is a gradual veil, never a wall.
      // (At the middle of a full-grown bank of strength s the extinction is s^2 E, as thick as
      // its kind and strength say.)
      const veil = _c.w > 0 ? core / _c.w * _c.env : 0;
      if (veil > 0) {
        const E = _c.s * _c.s * WEATHER.clearVisibility / K.vis, q = 1 - (1 - 1 / Math.sqrt(1 + E)) * veil;
        const ext = 1 / (q * q) - 1;
        if (K === KINDS.fog) a.fog += ext; else if (K === KINDS.dust) a.dust += ext; else a.haze += ext;
      }
    }
    if (core > 0) {
      if (K === KINDS.storm) a.storm = Math.max(a.storm, core);
      if (core > a.topW) { a.topW = core; a.top = _c.kindId; a.topCell = i; a.topGen = _c.gen; }
    }
    if (cover > 0) clear *= 1 - K.cloud * cover;
    // mean wind: stronger under active systems, calmer inside fog
    if (K.wind >= 1) a.windMul += (K.wind - 1) * cover; else a.calm = Math.max(a.calm, (1 - K.wind) * cover);
    // gust front: cold outflow spreading from the core, strongest just ahead of the rain
    if (K.outflow > 0 && d > 1) {
      const ring = smoothstep(0.15, 0.8, x) * (1 - smoothstep(0.95, WEATHER.frontReach, x));
      const v = K.outflow * _c.w * ring;
      if (v > 0) {
        // direction: from the cell centre to the point, in the tangent plane at the point
        let dx = ux - _c.x, dy = uy - _c.y, dz = uz - _c.z;
        const dn = dx * ux + dy * uy + dz * uz;
        dx -= dn * ux; dy -= dn * uy; dz -= dn * uz;
        const l = Math.hypot(dx, dy, dz);
        if (l > 1e-9) { a.ox += dx / l * v; a.oy += dy / l * v; a.oz += dz / l * v; a.front = Math.max(a.front, ring * _c.w); }
      }
    }
    // a great spot turns: wind circling the centre, fastest at 70 % of its radius
    if (_c.swirl > 0 && d > 1) {
      const v = _c.swirl * _c.w * smoothstep(0, 0.7, x) * (1 - smoothstep(0.75, WEATHER.frontReach, x)) * _c.spin;
      let dx = ux - _c.x, dy = uy - _c.y, dz = uz - _c.z;
      const dn = dx * ux + dy * uy + dz * uz;
      dx -= dn * ux; dy -= dn * uy; dz -= dn * uz;
      const l = Math.hypot(dx, dy, dz);
      // tangent = up x radial
      if (l > 1e-9) { a.ox += (uy * dz - uz * dy) / l * v; a.oy += (uz * dx - ux * dz) / l * v; a.oz += (ux * dy - uy * dx) / l * v; }
    }
  }
  a.cloud = 1 - clear;
  return a;
}

// What the weather does to the wind at a place: o[0] = multiplier on the mean wind,
// o[1..3] = outflow vector (m/s, body-local) to add, o[4] = extra gustiness 0..1.
export function weatherWind(bodyId, ux, uy, uz, t, seed, o) {
  const a = gather(bodyId, ux, uy, uz, t, seed);
  o[0] = a.windMul * (1 - a.calm);
  o[1] = a.ox; o[2] = a.oy; o[3] = a.oz;
  o[4] = clamp01(a.storm * 0.8 + a.front * 0.6 + (a.windMul - 1) * 0.3);
  return o;
}

// Precipitation rate (mm/h water equivalent) and the fraction of it that is frozen, for the
// history integrals. climate: { moist } from ground.coverAt (optional).
function precipAt(bodyId, ux, uy, uz, t, seed, moist, T, o) {
  const a = gather(bodyId, ux, uy, uz, t, seed);
  const regime = REGIMES[bodyId];
  o.rate = a.rate * moist;
  // (snow falls up to two or three kelvin above melting; the band is 4 K wide since P7, it was 2.5: as the day
  // warms through it the fresh snow goes inside the 8 % a second a sky number may move, R-WX-1)
  o.frozen = regime && regime.melt < 1e8 ? 1 - smoothstep(regime.melt - 1.5, regime.melt + 2.5, T) : 1;
  return o;
}

// Lags (game seconds into the past) for the wetness and snow integrals, geometric spacing.
// (P7: 21 slices, none wider than 100 s within the last 9 game minutes, where there were 12 reaching back 47
// minutes. A spell of rain or snow at one place lasts 100 to 200 game seconds; a slice 665 s wide counted one
// that its midpoint fell in six times over and missed the others, so fresh snow came and went with nothing
// falling (cover from 0.5 to 0.99 and back under a clear sky, 0.55 to nothing in three minutes as a spell left
// the last slice). With that, fresh snow is fresh for 8 real hours (snowLife; it was 30), so what is older than
// the fine slices weighs little. Still a quadrature: see sky.test.mjs for how steady it is.)
const LAGS = [0, 10, 20, 32, 46, 64, 86, 114, 150, 196, 250, 310, 380, 460, 550, 650, 770, 910, 1080, 1290, 1550, 1870];
const _p = { rate: 0, frozen: 0 };

// Ground moisture at a place and time: o.wetness01, o.snowDepth (m, fresh + base), o.freshSnow.
//   env: { moist, snowBase, T (K, now), Tmean (K, daily mean), wind (m/s), sun01 (cos zenith or null) }
export function moistureAt(bodyId, ux, uy, uz, t, seed, env, o = {}) {
  const regime = REGIMES[bodyId];
  const moist = env.moist != null ? env.moist : 1;
  const T = env.T != null ? env.T : 288;
  o.wetness01 = 0; o.freshSnow = 0;
  const melt = regime ? regime.melt : 1e9;
  // Standing snow: the biome's own (ground.js `snowBase`), which is what PAINTER has painted into
  // its ground. (Until P7 a pack of up to 0.4 m was added wherever the daily mean stays below
  // freezing: the green alpine meadow of the brief stood under 40 cm of snow in fair weather.
  // The coordinator's ruling: standing snow belongs to the painted terrain; what the weather adds
  // is FRESH snow, from recent snowfall, and that is what a painter lays over the ground.)
  const base = env.snowBase || 0;
  o.standing = base;
  if (!regime || !regime.cells) { o.snowDepth = base; return o; }
  const ts = WEATHER.timeScale;
  // drying: faster when warm, windy and sunny (evaporation ~ (1 + 0.25 U) and vapour deficit)
  const warm = clamp((T - 263) / 25, 0.15, 2.5);
  const dryTau = WEATHER.dryTime / ts / (warm * (1 + 0.25 * (env.wind || 0)) * (1 + 1.2 * Math.max(0, env.sun01 || 0)));
  // melting: degree-day law
  const meltPerS = T > melt ? WEATHER.meltRate * (T - melt) / 86400 * ts * WEATHER.snowRatio / 1000 : 0;   // m of snow per game s
  const settleTau = WEATHER.snowLife / ts;
  let water = 0, snow = 0;
  for (let k = 0; k < LAGS.length - 1; k++) {
    const lag = 0.5 * (LAGS[k] + LAGS[k + 1]), dl = LAGS[k + 1] - LAGS[k];
    precipAt(bodyId, ux, uy, uz, t - lag, seed, moist, T, _p);
    if (_p.rate <= 0) continue;
    const mm = _p.rate * dl * ts / 3600;                 // mm of water that fell in this slice
    water += mm * (1 - _p.frozen) * Math.exp(-lag / dryTau);
    const depth = mm * _p.frozen * WEATHER.coldShare * WEATHER.snowRatio / 1000;     // m of fresh snow
    snow += Math.max(0, depth * Math.exp(-lag / settleTau) - meltPerS * lag * 0.5);
  }
  // melting snow keeps the ground wet
  // (it comes in over the first 1.5 K above melting and the first centimetre of snow: until P7 it was a
  // step, and the wetness jumped by 55 % in a second where the afternoon crossed the melting point)
  if (meltPerS > 0) water += WEATHER.wetDepth * 0.8 * clamp01((T - melt) / 1.5) * clamp01((snow + base - 0.002) / 0.01);
  o.wetness01 = 1 - Math.exp(-water / WEATHER.wetDepth);
  o.freshSnow = snow;
  o.snowDepth = base + snow;
  return o;
}

const _a2 = new Float64Array(5), _wl = new Float64Array(4);

// The weather at a place and time.
//   up: unit direction {x,y,z}.  altitude: m above the base radius.
//   env: { moist, fog, snowBase, dT, dustSource (from ground.coverAt), sun01 (cos zenith or null),
//          wind (local mean wind speed, m/s) }, all optional.
// Fills and returns `o` (shape documented in docs/notes/physics.md, API section).
export function weatherAt(bodyId, ux, uy, uz, altitude, t, seed, env, o = {}) {
  const regime = REGIMES[bodyId];
  const atm = ATMOSPHERES[bodyId];
  const moist = env && env.moist != null ? env.moist : 1;
  const sun01 = env && env.sun01 != null ? env.sun01 : null;
  const T = airTemperature(bodyId, altitude, uy, sun01) + (env && env.dT ? env.dT : 0);
  const wind = env && env.wind != null ? env.wind : (WINDS[bodyId] ? WINDS[bodyId].U : 0);
  const a = gather(bodyId, ux, uy, uz, t, seed);
  const pr = o.precipitation || (o.precipitation = {});
  const li = o.lightning || (o.lightning = { last: { t: -1e9, x: 0, y: 1, z: 0, distance: 1e9 } });
  // Weather lives in the lower half of the atmosphere (PAINTER's cloud deck sits at 55 % of its
  // height). Climb through it and you are above the rain, the fog and the cloud.
  const top = BODIES[bodyId].atmosphereHeight || 0;
  const below = top > 0 ? 1 - smoothstep(top * 0.5, top * 0.62, altitude) : 0;

  let rate = a.rate * moist * below;
  const melt = regime && regime.melt != null ? regime.melt : 1e9;
  const frozen = melt < 1e8 ? 1 - smoothstep(melt - 1.5, melt + 2.5, T) : (melt > 0 ? 1 : 0);
  // What falls, in three continuous shares (so that nothing steps where two systems overlap or
  // the air crosses freezing): frost, solid (snow and ice crystals) and liquid.
  let rFrost = regime && regime.liquid === 'frost' ? rate : a.rateFrost * moist * below;
  if (regime && regime.frostBelow > 0) {
    // frost only falls from air colder than this; it fades in over the last few degrees
    const k = 1 - smoothstep(regime.frostBelow - 4, regime.frostBelow, T);
    rate -= rFrost * (1 - k); rFrost *= k;
  }
  const rIce = regime && regime.liquid === 'frost' ? 0 : a.rateIce * moist * below;
  const rOther = Math.max(0, rate - rIce - rFrost);
  // cold air holds less vapour (Clausius-Clapeyron): the same system snows less water than it rains
  const rSolid = rOther * frozen * WEATHER.coldShare + rIce, rLiquid = rOther * (1 - frozen);
  rate = rSolid + rLiquid + rFrost;
  // virga: drops evaporate on the way down in hot dry air (Venus) and only reach high ground
  let reach = 1;
  if (regime && regime.virga > 0) reach = smoothstep(regime.virga * 0.6, regime.virga * 1.4, altitude);
  const rho = airDensity(bodyId, altitude);
  let type = 'none', species = null;
  pr.hail01 = 0;
  if (rate > 0.02 && regime) {
    if (a.top === 'frost' || regime.liquid === 'frost') {
      if (rFrost > 0.02) { type = 'frost'; species = 'frost'; }
    } else if (a.top === 'ice') { type = 'ice'; species = bodyId === 'earth' ? 'iceCrystal' : regime.solid; }
    else if (a.top === 'acid') { type = 'acid'; species = 'acid'; }
    else if (frozen > 0.5) {
      type = 'snow'; species = regime.solid === 'snow' && wind > 11 ? 'blizzardSnow' : regime.solid;
    } else {
      type = rate < 1.2 ? 'drizzle' : 'rain';
      species = regime.liquid === 'rain' ? (rate < 1.2 ? 'drizzle' : rate > 12 ? 'heavyRain' : 'rain') : regime.liquid;
      // hail in the core of a strong storm
      if (a.storm > 0.82 && regime.liquid === 'rain') pr.hail01 = (a.storm - 0.82) / 0.18;
    }
  }
  pr.type = type;
  pr.species = species;
  pr.rate = type === 'none' ? 0 : rate;
  pr.frozen01 = type === 'none' || !(rate > 0) ? 0 : clamp01((rSolid + rFrost) / rate);
  pr.reachesGround01 = reach;
  const sp = species ? SPECIES[species] : null;
  pr.dropSize = sp ? sp.d : 0;
  pr.fallSpeed = sp && atm.mu > 0 ? terminalVelocity(sp, BODIES[bodyId].gravity, rho, atm.mu, meanFreePath(bodyId, rho, T)) : 0;
  if (!(pr.fallSpeed < 1e4)) pr.fallSpeed = 0;
  // 0..1 for drawing and for particle counts: saturates around a downpour
  // (a millimetre of snow is far more flakes than a millimetre of rain is drops)
  // (it rises from nothing at the 0.02 mm/h below which nothing is said to fall)
  pr.intensity01 = type === 'none' ? 0 : clamp01(1 - Math.exp(-(rLiquid / 9 + rSolid / 1.2 + rFrost / 0.1) * clamp01((rate - 0.02) / 0.06)));

  // ---- fog and mist: a local condition (calm, damp, cool air) plus drifting fog banks --------
  const fogBiome = env && env.fog != null ? env.fog : 0.2;
  const calm = 1 - smoothstep(2.0, 7.0, wind);
  const dawn = sun01 == null ? 0.35 : 1 - smoothstep(-0.05, 0.4, sun01);
  // radiation fog needs calm, cool, damp air; a few places (honey-mist valleys, pearl-fog flats)
  // are misty whatever the wind does
  // (only where the air is near the condensation point of something: not on Venus or Mars)
  const mistOK = regime && regime.cells && atm.rho0 > 0.3 && melt > 1 && melt < 1e8 && T < melt + 40;
  const mist = mistOK ? Math.max(fogBiome * calm * (0.3 + 0.7 * dawn), 0.5 * smoothstep(0.92, 1, fogBiome)) : 0;
  // ---- a gale has a sky of its own (P7) -----------------------------------------------------------
  // The large-scale wind here (no gusts: it changes over minutes), with what the weather cells make
  // of it. From a strong gale to hurricane force (Beaufort 8 to 12) scud closes the sky, and over an
  // open sea the air fills with spray torn from the crests ("visibility seriously affected"): until
  // P7 Neptune's 34 m/s blew over a white sea under a fair sky.
  windLarge(bodyId, ux, uy, uz, t, seed, _wl);
  const galeU = _wl[3] * a.windMul * (1 - a.calm);
  const gale01 = rho > 0.05 ? smoothstep(WEATHER.galeFrom, WEATHER.galeFull, galeU) : 0;
  const open = env && env.fetch > 0 ? smoothstep(600, 2000, env.fetch) : 0;
  const sprayExt = WEATHER.sprayExt * gale01 * open;
  const fogExt = (a.fog * (0.4 + 0.6 * fogBiome) + mist * mist * WEATHER.clearVisibility / 150 + sprayExt) * below;
  // ---- dust: storms, plus wind over a dust source above the saltation threshold ---------------
  const dustSrc = env && env.dustSource != null ? env.dustSource : 0;
  const lift = rho > 0 ? smoothstep(1.0, 2.2, wind / saltationThreshold(bodyId, rho)) : 0;
  const dustExt = (a.dust * (0.5 + 0.5 * dustSrc) + lift * dustSrc * WEATHER.clearVisibility / 400) * below;
  // ---- visibility (Koschmieder): extinctions add; rain 0.2 R^0.6 per km, snow about 2 R^0.7 --
  let ext = 1 + fogExt + dustExt + a.haze * below;
  // (the rate / (rate + 0.5) factor only rounds off the infinite slope of a power law at zero)
  // Each share of what falls adds its own, so the sum is continuous through sleet and where an
  // ice-crystal veil overlaps a shower.
  const kx = WEATHER.clearVisibility / 3912;
  let extP = 0;
  if (rLiquid > 0) extP += 0.2 * Math.pow(rLiquid, 0.6) * (rLiquid / (rLiquid + 0.5)) * kx * reach;
  if (rSolid > 0) extP += 2.0 * Math.pow(rSolid, 0.7) * (rSolid / (rSolid + 0.5)) * kx;
  if (rFrost > 0) extP += 0.5 * rFrost * kx;
  ext += extP;
  // The same as a length: what is falling, and the dust in the air, each hide this share of a
  // sight line per metre (1/m; over a short path s the share hidden is s times this). The
  // draw kits size their marks from it: the marks in view cover what the physics says.
  if (o.precipitation) o.precipitation.extinction = extP * 3.912 / WEATHER.clearVisibility;
  o.dustExtinction = dustExt * 3.912 / WEATHER.clearVisibility;
  o.visibility = WEATHER.clearVisibility / ext;
  // For drawing: the game's distances are compressed, so the painted fog distance should shrink
  // with the square root of the real visual range (20 km -> 1, 5 km -> 0.5, 200 m -> 0.1).
  o.visibility01 = Math.sqrt(1 / ext);
  // How much of the view each veil takes away by itself (with only fog in the air,
  // visibility01 = 1 - fog01). 0.5 is a visual range of 5 km, 0.78 is 1 km, 0.9 is 200 m.
  o.fog01 = 1 - 1 / Math.sqrt(1 + fogExt);
  o.dust01 = 1 - 1 / Math.sqrt(1 + dustExt);
  o.haze01 = 1 - 1 / Math.sqrt(1 + a.haze * below);
  // how much dust is in the air (its mass loading, saturating), for particle counts
  o.dustLoad01 = clamp01(1 - Math.exp(-dustExt / 60));
  // (P7) what falls, falls from cloud: rain or snow means a closed sky (a blizzard stood under a sky
  // 0.46 covered); and a gale drives scud across it
  const closed = 1 - (1 - clamp01(pr.intensity01 || 0)) * (1 - clamp01(pr.intensity01 || 0));   // (no steeper than twice what is falling: R-WX-1)
  o.cloud01 = clamp01(Math.max(a.cloud + 0.25 * o.fog01, 0.97 * closed, WEATHER.galeCloud * gale01 * (0.5 + 0.5 * Math.min(1, moist)))) * below;        // 0 once you are above the deck
  o.gale01 = gale01 * below;
  o.cloudBelow01 = clamp01(a.cloud) * (1 - below);              // cloud you are looking down on
  o.temperature = T;
  o.storm01 = a.storm;
  o.front01 = a.front;
  o.windFactor = a.windMul * (1 - a.calm);

  // ---- lightning ----------------------------------------------------------------------------------
  li.rate = a.flash;                       // flashes per minute hereabouts
  li.flash01 = 0; li.nextIn = Infinity; li.thunderIn = Infinity; li.thunder01 = 0;
  li.last.t = -1e9; li.last.distance = 1e9;
  if (regime && regime.cells && a.topCell >= 0 && a.flash > 0.05) {
    lightningFor(bodyId, regime, seed, a.topCell, a.topGen, a.flash, ux, uy, uz, t, atm.c, li);
  }

  // ---- kind: one word for what a person would call it --------------------------------------------
  // `kind` is a label; `intensity01` is how much weather there is, and is continuous: the
  // largest of the precipitation, the storm core, dust, fog, haze, half the cloud and the wind.
  let kind = 'clear', inten = 0;
  const airless = !(atm.rho0 > 0);
  if (airless) { kind = 'vacuum'; }
  else if (a.storm > 0.25 && type !== 'none') { kind = type === 'snow' ? 'blizzard' : 'thunderstorm'; inten = a.storm; }
  else if (type === 'snow') { kind = wind > 11 && pr.intensity01 > 0.3 ? 'blizzard' : 'snow'; inten = pr.intensity01; }
  else if (type === 'rain') { kind = 'rain'; inten = pr.intensity01; }
  else if (type === 'drizzle') { kind = 'drizzle'; inten = clamp01(rate / 1.2); }
  else if (type === 'acid') { kind = reach > 0.3 ? 'acid drizzle' : 'virga'; inten = pr.intensity01; }
  else if (type === 'ice') { kind = 'ice fall'; inten = pr.intensity01; }
  else if (type === 'frost') { kind = 'frost fall'; inten = pr.intensity01; }
  // (the meteorologist's lines: fog and dust storm under 1 km of visual range, mist and haze under 5 km)
  else if (o.dust01 > 0.78) { kind = 'dust storm'; inten = o.dust01; }
  else if (o.fog01 > 0.78) { kind = 'fog'; inten = o.fog01; }
  else if (o.haze01 > 0.7) { kind = 'haze'; inten = o.haze01; }
  else if (o.fog01 > 0.5) { kind = 'mist'; inten = o.fog01 / 0.78; }
  else if (o.dust01 > 0.5) { kind = 'dust haze'; inten = o.dust01 / 0.78; }
  else if (o.cloud01 > 0.6) { kind = 'overcast'; inten = o.cloud01; }
  else if (wind * o.windFactor > 8) { kind = 'windy'; inten = clamp01((wind * o.windFactor - 8) / 12); }
  else if (wind * o.windFactor > 2.5) { kind = 'breeze'; inten = clamp01((wind * o.windFactor - 2.5) / 5.5); }
  o.kind = kind;
  o.kindIntensity01 = clamp01(inten);       // how strong within its kind (steps when the kind changes)
  o.intensity01 = airless ? 0 : clamp01(Math.max(pr.intensity01, a.storm, o.dust01, o.fog01, o.haze01, 0.5 * o.cloud01, (wind * o.windFactor - 2.5) / 17.5));
  return o;
}

// Wind speed (m/s at 10 m) above which sand starts to hop (saltation) on a body: the fluid
// threshold friction velocity u*t = A sqrt((rho_p - rho) g d / rho), A = 0.1 (Bagnold 1941),
// for 250 micron sand, converted to 10 m with the log law over rippled sand (z0 = 0.2 mm).
// Earth: about 6 m/s. Mars: about 33 m/s (thin air must blow far harder to move a grain, which
// is why its dunes barely move). Venus: under 1 m/s.
export function saltationThreshold(bodyId, rho) {
  if (!(rho > 0)) return Infinity;
  const d = 0.00025, rp = 2650, g = BODIES[bodyId].gravity;
  const ust = 0.1 * Math.sqrt((rp - rho) * g * d / rho);
  return ust / 0.4 * Math.log(10 / 0.0002);
}

// Deterministic lightning of one storm cell: at most one flash per time slot, at a hashed moment
// and place inside the core. Finds the most recent flash and the next one.
function lightningFor(bodyId, regime, seed, cell, gen, perMin, ux, uy, uz, t, cSound, li) {
  const s = seedFor(bodyId, seed) + 7919;
  const R = BODIES[bodyId].radius;
  const slot = WEATHER.slot;
  const p = clamp01(perMin * slot / 60);
  const n0 = Math.floor(t / slot);
  if (!cellAt(bodyId, R, regime, seedFor(bodyId, seed), cell, t, _c)) return;
  const cx = _c.x, cy = _c.y, cz = _c.z, cr = _c.r;
  let ex = cz, ez = -cx; const el = Math.hypot(ex, ez) || 1; ex /= el; ez /= el;
  const nx = cy * ez, ny = cz * ex - cx * ez, nz = -cy * ex;
  let lastT = -1e9, nextT = Infinity, lastN = 0;
  for (let n = n0; n >= n0 - 12; n--) {
    if (hash3(cell, n, gen, s) < p) {
      const ft = (n + 0.1 + 0.8 * hash3(cell, n, gen + 1, s)) * slot;
      if (ft <= t) { lastT = ft; lastN = n; break; }
    }
  }
  for (let n = n0; n <= n0 + 12; n++) {
    if (hash3(cell, n, gen, s) < p) {
      const ft = (n + 0.1 + 0.8 * hash3(cell, n, gen + 1, s)) * slot;
      if (ft > t) { nextT = ft; break; }
    }
  }
  li.nextIn = nextT - t;
  if (lastT > -1e8) {
    const ang = hash3(cell, lastN, gen + 2, s) * TAU, rad = Math.sqrt(hash3(cell, lastN, gen + 3, s)) * cr * 0.55 / R;
    const oe = Math.cos(ang) * rad, on = Math.sin(ang) * rad;
    let sx = cx + ex * oe + nx * on, sy = cy + ny * on, sz = cz + ez * oe + nz * on;
    const sl = Math.hypot(sx, sy, sz); sx /= sl; sy /= sl; sz /= sl;
    const dist = R * Math.sqrt(Math.max(0, 2 - 2 * (sx * ux + sy * uy + sz * uz)));
    const age = t - lastT;
    li.last.t = lastT; li.last.x = sx; li.last.y = sy; li.last.z = sz; li.last.distance = dist;
    // a flash is 3-4 return strokes about 50 ms apart, fading over a third of a second
    if (age < 0.7) li.flash01 = clamp01(Math.exp(-age / 0.16) * (0.62 + 0.38 * Math.cos(age * 118)) / (1 + (dist / 700) * (dist / 700)));
    // thunder arrives at the speed of sound of this air
    if (cSound > 0) {
      const delay = dist / cSound;
      li.thunderIn = delay - age;                                  // negative once it has passed
      const ta = age - delay;
      li.thunder01 = ta >= 0 && ta < 6 ? clamp01(Math.exp(-ta / 1.8) / (1 + dist / 900)) : 0;
    }
  }
}
export { KINDS };
