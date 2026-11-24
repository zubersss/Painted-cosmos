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
import { hash3, hashString, noise3, clamp, clamp01, mix, smoothstep, TAU } from './util.js';
import { WX2 } from './wx2.js';

export const WEATHER = Object.freeze({
  timeScale: 60,           // game seconds of weather per real second (see above)
  dryTime: 3.0 * 3600,     // real s for a soaked surface to dry in still air at 288 K
  wetDepth: 3.0,           // mm of rain that wets the ground through (a heavy shower: about 20 game seconds)
  // (M4) what the surface holds: leaves, sward and the top of the soil keep a few millimetres, the rest of a downpour
  // runs off. Until M4 every millimetre that fell stayed to be dried (33 mm of the first storm). With the store the
  // ground is never wetter than 1 - exp(-wetStore / wetDepth) = 0.95 and dries from there: after that storm, at noon
  // in the sun and a light wind, 0.18 two minutes after the last drop (0.35 without the store); under a closed sky in
  // still air 0.31 four minutes after (0.62).
  wetStore: 9.0,           // mm of water the surface holds at most
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
  nameGale: 12,            // m/s: (M4) in a wind over this the air is not called mist or fog (see weatherAt: kind)
  // (P8) home-grown storms: where the surface feeds the air far more moisture than the body's mean
  // (a biome's `moist` over ownFrom: Neptune's storm seas 1.6, Jupiter's storm wall 1.4 and
  // lightning plains 1.3) convection builds over the place itself, the way thunderstorms stand
  // over a warm sea: for a share of the time that rises to ownMax at ownFrom + ownSpan, in spells
  // of minutes (ownTime) over kilometres (ownLength). They bring cloud, rain and lightning but no
  // wind of their own: over such a place the standing gale is the storm's wind.
  ownFrom: 1.2, ownSpan: 0.4, ownMax: 0.8, ownLength: 2500, ownTime: 420, ownRate: 0.45,
});

// Cell kinds. rate: peak precipitation (mm/h water equivalent). cloud: cloud cover. wind: mean
// wind multiplier at full strength. blow (P7, lead review 5 P1: storms brought no wind): the wind the
// system brings by itself under its cloud shield, m/s at 10 m, added along the mean wind (a storm is 16 m/s
// whatever the breeze was; a multiple of a 2 m/s breeze is still a breeze). outflow: gust-front speed (m/s). flash: lightning flashes
// per minute at full strength. vis: visual range at full strength (m). size / life: multipliers.
const KINDS = {
  cloud: { rate: 0.0, cloud: 0.85, wind: 1.0, outflow: 0, flash: 0, vis: 0, size: 1.3, life: 1.2 },
  drizzle: { rate: 0.8, cloud: 1.0, wind: 1.0, outflow: 0, flash: 0, vis: 4000, size: 1.2, life: 1.2 },
  rain: { rate: 6, cloud: 1.0, wind: 1.3, outflow: 2, blow: 3, flash: 0, vis: 0, size: 1.2, life: 1.2 },
  shower: { rate: 10, cloud: 0.9, wind: 1.4, outflow: 6, blow: 6, flash: 0, vis: 0, size: 0.6, life: 0.6 },
  storm: { rate: 32, cloud: 1.0, wind: 1.9, outflow: 14, blow: 16, flash: 5, vis: 0, size: 0.9, life: 0.8 },
  fog: { rate: 0.0, cloud: 0.6, wind: 0.35, outflow: 0, flash: 0, vis: 120, size: 0.8, life: 1.0 },
  // Mars: regional dust storm. Lifts dust once the wind passes the saltation threshold.
  dust: { rate: 0.0, cloud: 0.5, wind: 3.0, outflow: 8, blow: 20, flash: 0, vis: 90, size: 1.8, life: 1.6, dust: 1 },
  // Venus: sulphur haze banks, and sulphuric-acid drizzle that mostly evaporates on the way down.
  haze: { rate: 0.0, cloud: 1.0, wind: 1.0, outflow: 0, flash: 0, vis: 350, size: 1.5, life: 1.5 },
  acid: { rate: 1.2, cloud: 1.0, wind: 1.2, outflow: 0, flash: 0.3, vis: 900, size: 1.0, life: 1.0 },
  // Ice giants: fall of ice crystals; Pluto: slow frost from the thin nitrogen air.
  ice: { rate: 1.5, cloud: 0.8, wind: 1.3, outflow: 3, blow: 4, flash: 0, vis: 1500, size: 1.2, life: 1.2 },
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
  // `epoch` (s): where in the life of its weather systems a body's game clock starts (the initial
  // condition of the weather; it may be negative). Earth's is chosen so that the first day at the home
  // forest is fair and the first thunderstorm crosses it at noon of the second: see DEFAULT_SEED below.
  earth: { cells: 22, radius: [500, 1300], life: [600, 1500], steer: 1.6, melt: 273.15, liquid: 'rain', solid: 'snow', virga: 0, epoch: -1050,
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

// The default seed and Earth's epoch (REGIMES.earth.epoch) put this over Earth's home forest
// (weather.test.mjs checks it; change them only together with that test). (M4; PILOT's critique of
// PHYSICS, item 5: the first storm came two minutes into every new game.) By the game's clock
// (PILOT's: a new game begins at 8:00, the first sunset is 11 minutes in, the second sunrise at
// 22 minutes, the second noon at about 30): a fair first day, dusk and night with no system over
// the forest (the first 17 minutes: under 0.12 of cloud from the weather; the sky's own fair-weather
// clouds are PAINTER's), cloud over the second morning from 20 minutes (1230 s), a brightening, then
// the first drops at 1670 s and the thunderstorm from 1690 to 1850 s (heaviest, 20 mm/h and more,
// from 1730 to 1790 s: the second noon), and a clear afternoon from 1870 s.
// Until P8 the epoch was 0 (the storm at 640 to 800 s: after dark as the clock then was, at dusk as
// it is now); from P8 to M4 it was 480 (the storm at 160 to 320 s). Every Earth weather time of P8 to
// M4 is 1530 s later now; no other body's weather moved. (Why -1050 and not a rounder number: the
// large-scale wind runs on the game's clock and the systems on this one, so the epoch also decides
// which storm is the strongest at Earth's sea coast in the first 9000 s, the one coast.mjs judges
// PAINTER's coast by. With -1050 it comes from just south of east and finds 2151 m of fetch 80 m
// out (PASS at 2000); with -1200, -1100 or -900 it comes 10 to 20 degrees further round and finds
// 1474 to 1894 m.)
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
  if (regime.epoch) t += regime.epoch;
  if (i >= regime.cells) return spotAt(R, regime.spots[i - regime.cells], i, t, c);
  const life0 = mix(regime.life[0], regime.life[1], hash3(i, 1, 0, s));
  const phase = hash3(i, 2, 0, s) * life0;
  let kid = pickKind(regime, hash3(i, 3, Math.floor((t + phase) / life0), s));
  // (group D, ?stormland=1) the body's random THUNDERSTORMS give way to the ones the land grows (landPart): a generation
  // that begins after STORMLAND.from of a body with land storms registered is a shower instead (its rain kept, no lightning)
  if (kid === 'storm' && LAND && WX2.stormland && LAND.bodyId === bodyId && Math.floor((t + phase) / life0) * life0 - phase - (regime.epoch || 0) > STORMLAND.from) kid = 'shower';
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

const _lt = { flash01: 0, nextIn: Infinity, thunderIn: Infinity, thunder01: 0, last: { t: -1e9, x: 0, y: 1, z: 0, distance: 1e9 } };   // (one storm's lightning, merged in weatherAt)
// ---- (group D) STORMS BORN FROM THE LAND -----------------------------------------------------------------------------
// docs/lead/WEATHER-DESIGN.md 6.2 C2. Behind wx2.js WX2.stormland, and only on a body whose convection sites have been
// registered (setLandStorms: the wind map's `sites`, windmap.js, read from the land). On a stormy afternoon a few sites
// FIRE: each grows a convective system at its local hour h, living STORMLAND.lifeH game hours through four stages --
// cumulus, towering, a mature thunderstorm (heavy rain, hail in its core, lightning, a gust front), decay -- and drifting
// with the wind aloft, so a storm born over the range crosses the wood or the coast. Each system is TWO cells gathered
// like any other: its cloud (kind 'cloud', from its birth) and its storm (kind 'storm', from the towering stage), so
// nothing steps from one stage to the next. Every one of them is a pure function of (body, seed, t, the sites, the sun's
// reference): the same afternoon on every visit, and askable at any time.
export const STORMLAND = Object.freeze({
  from: 1900,              // game s: none before, so Earth's first day stays fair and its first storm is the tuned one
  stormDays: 0.667,        // the share of days on which the range grows storms (the owner judges this one number)
  perDay: [1, 3],          // how many sites fire on a stormy afternoon (W3.2; with ?stormswing=0 only)
  hours: [12.5, 16.0],     // the local hour a site fires
  lifeH: [4.0, 6.5],       // its life in game hours (cumulus at the start, gone by the evening)
  r: [520, 950],           // m: the storm's core grown to this radius
  cloudR: 1.3,             // the cloud's shield is this much wider than the core
  steer: 0.8,              // it drifts at this share of the wind aloft over its site at its birth ...
  steer0: 0.5,             // (... and at this share with ?stormswing=0, as W3.2 laid it)
  anchor: 0.25,            // ... only after this share of its life: it stands over the slope that feeds it while it builds
  aloft: 1.95,             // the wind aloft at the cloud's base over the 10 m wind (air.js aloftFactor at 350 m on Earth)
  // (the coordinator's ruling of 24 Nov, behind WX2.stormswing, on with ?stormland: storms that come to the player now
  //  and then by NATURAL means. Two changes. (1) On a stormy afternoon every site has its own chance to fire, by its
  //  weight and the day's instability, so a stormy day over a range grows storms over many of its peaks, as real ones do,
  //  and not one or two over the whole world; a lesser hill (the wind map keeps 128 sites) grows a lesser storm. (2) The wind aloft that steers them swings from day to day: a synoptic
  //  turn of its direction and a change of its speed, smooth over a day or two, so on some days the range's storms are
  //  carried over the wood and on most they go the usual way. The owner's dial (the look's `storms`, setStormDial)
  //  scales both: how many fire, and how far they drift.)
  count: 12,               // storms expected over the world on a stormy afternoon of average instability (dial 1)
  countMax: 24,            // at most this many on one day (the cost of the gathers)
  instab: [0.5, 1.5],      // the day's instability: it scales every site's chance
  swing: 3.14,             // rad: the largest turn of the day's wind aloft from its usual direction (180 degrees: a reversal)
  speed: [0.6, 2.2],       // the day's wind aloft as a share of its usual speed
  swingDays: 1.6,          // days over which the swing changes (one knot of its smooth noise every 1.6 days)
});
// (the owner's dial, the look data's `storms` for the body: physics/index.js passes it in; 1 = as tuned)
let DIAL = 1;
export function setStormDial(n) {
  const v = Number.isFinite(n) && n >= 0 ? n : 1;
  if (v === DIAL) return;
  DIAL = v; if (LAND) LAND.days.clear();
}
export function stormDial() { return DIAL; }
// a smooth number in [0, 1] over x (one knot per unit), the same for every caller: the day's swing
function knots(x, a, sd) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return mix(hash3(i, a, 7, sd), hash3(i + 1, a, 7, sd), u);
}
const LAND_BASE = 20000;   // cell numbers of the land storms (LAND_BASE + 2 k: the cloud, + 1: the storm)
let LAND = null;           // { bodyId, sites, solarDay, t0, hour0 (each site's world hour at t0), days: Map }
// Register (or keep) a body's convection sites and the sun's reference: sites [{x, y, z, w}] (windmap.js), sunDir its
// body-local direction now (core/orbits.js), t the game time now. Cheap to call every frame: it re-anchors only on a new
// body or site list, or when the hour it predicts is 1.5 h off the sun's (a jump of the clock: setHour, a teleport; the
// painter's gallery, which holds its sun still, then keeps one schedule through a preroll of up to a game hour and a half).
export function setLandStorms(bodyId, sites, sunDir, t) {
  if (!bodyId || !sites || !sites.length || !sunDir) { LAND = null; return; }
  const b = BODIES[bodyId];
  const solarDay = b.orbitPeriod > 0 ? 1 / (1 / b.dayLength - 1 / b.orbitPeriod) : b.dayLength;
  const fresh = !LAND || LAND.bodyId !== bodyId || LAND.sites !== sites;
  if (!fresh) {
    const want = hourAt(sunDir, sites[0]), have = (LAND.hour0[0] + 24 * (t - LAND.t0) / solarDay) % 24;
    let dh = Math.abs(want - have); if (dh > 12) dh = 24 - dh;
    if (dh < 1.5) return;
  }
  const hour0 = new Float64Array(sites.length);
  for (let j = 0; j < sites.length; j++) hour0[j] = hourAt(sunDir, sites[j]);
  LAND = { bodyId, sites, solarDay, t0: t, hour0, days: new Map() };
}
export function landStorms() { return LAND; }
// the local SOLAR hour at body-local unit d for a sun at s: the hour angle (core/orbits.js localSolarTime), which runs evenly
// with time -- the world's painted hour (sunHourAt) does not at high latitudes, and a schedule laid on it drifts
function hourAt(s, d) {
  let h = Math.atan2(d.x, d.z) - Math.atan2(s.x, s.z);
  h -= TAU * Math.round(h / TAU);
  h = 12 + h * 12 / Math.PI;
  h %= 24; if (h < 0) h += 24;
  return h;
}
// what fires on day D (counted from the reference's first site's midnight): [{ k, site, tf, life, s, r, ve, vn }]
const _lw = new Float64Array(4);
function landDay(bodyId, seed, D) {
  const L = LAND;
  let day = L.days.get(D);
  if (day) return day;
  day = [];
  const sd = seedFor(bodyId, seed) + 31337, S = STORMLAND;
  const swing = WX2.stormswing;
  if (hash3(D, 1, 0, sd) < (swing && !(DIAL > 0) ? 0 : S.stormDays)) {
    // (before the swing: the 64 strongest sites only, which were all the wind map gave then: windmap.js sitesMax)
    const nSites = swing ? L.sites.length : Math.min(L.sites.length, 64);
    let wsum = 0; for (let q = 0; q < nSites; q++) wsum += L.sites[q].w;
    // which sites fire: (swing) each on its own chance, by its weight and the day's instability; (before) 1 to 3 drawn
    const fire = [];
    if (swing) {
      const inst = mix(S.instab[0], S.instab[1], hash3(D, 2, 0, sd)), per = S.count * inst * DIAL / wsum;
      for (let q = 0; q < L.sites.length && fire.length < S.countMax; q++) if (hash3(D, 100 + q, 1, sd) < Math.min(0.9, per * L.sites[q].w)) fire.push(q);
    } else {
      const n = S.perDay[0] + Math.floor(hash3(D, 2, 0, sd) * (S.perDay[1] - S.perDay[0] + 1) * 0.9999);
      for (let k = 0; k < n; k++) {
        let j = -1;
        for (let tries = 0; tries < 6 && j < 0; tries++) {
          let a = hash3(D, 3 + k, tries, sd) * wsum;
          for (let q = 0; q < nSites; q++) { a -= L.sites[q].w; if (a <= 0) { if (!fire.includes(q)) j = q; break; } }
        }
        if (j >= 0) fire.push(j);
      }
    }
    // (swing) the day's wind aloft: turned and scaled, the same for every storm of the day (one weather pattern)
    const rot = swing ? S.swing * (2 * knots(D / S.swingDays, 1, sd) - 1) : 0;
    const mul = swing ? mix(S.speed[0], S.speed[1], knots(D / S.swingDays, 2, sd)) * DIAL : 1;
    const cr = Math.cos(rot), sr = Math.sin(rot);
    for (let k = 0; k < fire.length; k++) {
      const j = fire[k], site = L.sites[j];
      // (the numbers each storm draws: by its order on the day before, by its site with the swing, so that a site
      //  firing or not never changes another site's storm)
      const hk = swing ? 1000 + j : k;
      const h = mix(S.hours[0], S.hours[1], hash3(D, 10 + hk, 0, sd));
      const tf = L.t0 + (24 * D + h - L.hour0[0] + (L.hour0[0] - L.hour0[j])) * L.solarDay / 24;
      const life = mix(S.lifeH[0], S.lifeH[1], hash3(D, 20 + hk, 0, sd)) * L.solarDay / 24;
      // its drift: the large-scale wind over its site at its birth, made the wind aloft, along the site's east and north
      windLarge(bodyId, site.x, site.y, site.z, tf, seed, _lw);
      let ex = site.z, ez = -site.x; const el = Math.hypot(ex, ez) || 1; ex /= el; ez /= el;
      const nx = site.y * ez, ny = site.z * ex - site.x * ez, nz = -site.y * ex;
      const st = swing ? S.steer : S.steer0;
      const ve0 = (_lw[0] * ex + _lw[2] * ez) * S.aloft * st, vn0 = (_lw[0] * nx + _lw[1] * ny + _lw[2] * nz) * S.aloft * st;
      const ve = (ve0 * cr - vn0 * sr) * mul, vn = (ve0 * sr + vn0 * cr) * mul;
      // (swing) a lesser hill grows a lesser storm: smaller and weaker by its site's weight
      const lesser = swing ? site.w : 1;
      day.push({ k, j, site, tf, life, s: mix(0.75, 1, hash3(D, 30 + hk, 0, sd)) * (0.55 + 0.45 * lesser), r: mix(S.r[0], S.r[1], hash3(D, 40 + hk, 0, sd)) * (0.6 + 0.4 * lesser), ve, vn, ex, ez, nx, ny, nz });
    }
  }
  if (L.days.size > 64) L.days.clear();
  L.days.set(D, day);
  return day;
}
// (group D) THE LAST AND THE NEXT FLASH OF ONE STORM CELL c (liveCells' fields) at time t, whatever point asks: the cell's
// own lightning as weatherAt would schedule it overhead (lightningFor, round its own centre). Fills li like
// here.weather.lightning (last { t, x, y, z }, nextIn); its flash01 and thunder are for a place at the cell's centre.
const _fl1 = { x: 0, y: 1, z: 0, r: 1 };
export function flashOf(bodyId, seed, c, t, li) {
  const regime = REGIMES[bodyId], atm = ATMOSPHERES[bodyId];
  li.last = li.last || { t: -1e9, x: 0, y: 1, z: 0, distance: 1e9 };
  li.flash01 = 0; li.nextIn = Infinity; li.last.t = -1e9;
  const perMin = c.kind.flash * c.w;
  if (!regime || !(perMin > 0.05)) return li;
  _fl1.x = c.x; _fl1.y = c.y; _fl1.z = c.z; _fl1.r = c.r;
  lightningFor(bodyId, regime, seed, c.i, c.gen, perMin, c.x, c.y, c.z, t, atm.c, li, _fl1);
  return li;
}
export { LAND_BASE };

// the day index of game time t for the land storms (from the first site's local midnight)
function landDayOf(t) { return Math.floor((LAND.hour0[0] + 24 * (t - LAND.t0) / LAND.solarDay) / 24); }
// One land storm's two cells at time t: part 0 its cloud, 1 its storm. Fills c with cellAt's fields (and stage, top,
// anvilE, anvilN, site for the clouds lane); returns false when it is not alive or not yet grown into this part.
function landPart(bodyId, f, D, part, t, c) {
  const u = (t - f.tf) / f.life;
  if (!(u > 0 && u < 1)) return false;
  const R = BODIES[bodyId].radius;
  const w = part === 0 ? smoothstep(0, 0.12, u) * (1 - smoothstep(0.85, 1, u)) : f.s * smoothstep(0.2, 0.45, u) * (1 - smoothstep(0.7, 1, u));
  if (!(w > 0)) return false;
  // where it has drifted to: the site turned along its drift by the distance run since it began to drift
  const dt = t - f.tf, sp = Math.hypot(f.ve, f.vn), dd = Math.max(0, dt - STORMLAND.anchor * f.life);
  let x = f.site.x, y = f.site.y, z = f.site.z;
  if (sp > 1e-6) {
    const a = sp * dd / R, de = f.ve / sp, dn = f.vn / sp;
    const tx = de * f.ex + dn * f.nx, ty = dn * f.ny, tz = de * f.ez + dn * f.nz, ca = Math.cos(a), sa = Math.sin(a);
    x = x * ca + tx * sa; y = y * ca + ty * sa; z = z * ca + tz * sa;
  }
  c.x = x; c.y = y; c.z = z;
  const grow = part === 0 ? 0.45 + 0.55 * smoothstep(0, 0.5, u) : 0.6 + 0.4 * smoothstep(0.2, 0.6, u);
  c.r = f.r * grow * (part === 0 ? STORMLAND.cloudR : 1);
  c.w = w; c.s = part === 0 ? 1 : f.s; c.env = 1;
  c.kindId = part === 0 ? 'cloud' : 'storm'; c.kind = KINDS[c.kindId];
  c.age = dt; c.life = f.life; c.gen = D; c.i = LAND_BASE + 2 * f.k + part;
  c.swirl = 0; c.spin = 0; c.ve = f.ve; c.vn = f.vn;
  c.stage = u; c.site = f.j; c.anvilE = f.ve; c.anvilN = f.vn; c.land = true;
  return true;
}
// every live land cell at time t into the reused list `out` from index out.n
function landCellsInto(bodyId, t, seed, out) {
  if (!LAND || !WX2.stormland || LAND.bodyId !== bodyId || t < STORMLAND.from) return;
  const D = landDayOf(t);
  for (let d = D - 1; d <= D; d++) {
    for (const f of landDay(bodyId, seed, d)) for (let part = 0; part < 2; part++) {
      const c = out[out.n] || (out[out.n] = {});
      if (landPart(bodyId, f, d, part, t, c)) out.n++;
    }
  }
}
// the centre of land cell number i (generation D) at time t, for its lightning (lightningFor's `own`)
const _lc = {}, _lown = { x: 0, y: 1, z: 0, r: 1 };
function landCentre(bodyId, seed, i, D, t) {
  if (!LAND) return null;
  const k = (i - LAND_BASE) >> 1, part = (i - LAND_BASE) & 1;
  for (const f of landDay(bodyId, seed, D)) if (f.k === k) {
    if (!landPart(bodyId, f, D, part, t, _lc)) return null;
    _lown.x = _lc.x; _lown.y = _lc.y; _lown.z = _lc.z; _lown.r = _lc.r;
    return _lown;
  }
  return null;
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
  const lc = []; lc.n = 0; landCellsInto(bodyId, t, seed, lc);
  for (let i = 0; i < lc.n; i++) out.push(lc[i]);
  return out;
}

const _c = {};
const _acc = { blow: 0, rate: 0, rateIce: 0, rateFrost: 0, cloud: 0, windMul: 1, calm: 0, flash: 0, fog: 0, haze: 0, dust: 0, ox: 0, oy: 0, oz: 0, storm: 0, top: null, topW: 0, topCell: -1, topGen: 0, front: 0, clear: 1, conv: 0, baseW: 0, topH: 0, coverSum: 0, fTopW: 0, fCell: -1, fGen: 0, fRate: 0, f2W: 0, f2Cell: -1, f2Gen: 0, f2Rate: 0, f3W: 0, f3Cell: -1, f3Gen: 0, f3Rate: 0 };

// (group D) A CELL FORCED OVER A PLACE (physics.forceWeather: the speed test's storm row and the stills of a storm). While
// one is set it is gathered after the body's own cells everywhere, so the sky numbers, the rain, the lightning and the
// cloud map all follow it as they would a real one. null (the default, always, in the game) is the weather as it was.
let _forced = null;
export function setForcedCell(c) { _forced = c && c.kind && KINDS[c.kind] ? c : null; }
export function forcedCell() { return _forced; }
function forcedInto(c) {
  const f = _forced, K = KINDS[f.kind];
  c.x = f.x; c.y = f.y; c.z = f.z; c.r = f.r || 900; c.w = f.w == null ? 1 : f.w; c.s = c.w; c.env = 1;
  c.kind = K; c.kindId = f.kind; c.age = 0; c.life = Infinity; c.gen = 0; c.i = FORCED_CELL;
  c.swirl = 0; c.spin = 0; c.ve = 0; c.vn = 0;
  return c;
}
const FORCED_CELL = 9002;
const _fown = { x: 0, y: 1, z: 0, r: 900 };
function forcedCentre() { _fown.x = _forced.x; _fown.y = _forced.y; _fown.z = _forced.z; _fown.r = _forced.r || 900; return _fown; }

function resetAcc(a) {
  a.blow = 0; a.rate = 0; a.rateIce = 0; a.rateFrost = 0; a.cloud = 0; a.windMul = 1; a.calm = 0; a.flash = 0; a.fog = 0; a.haze = 0; a.dust = 0;
  a.ox = a.oy = a.oz = 0; a.storm = 0; a.top = null; a.topW = 0; a.topCell = -1; a.topGen = 0; a.front = 0;
  a.fTopW = 0; a.fCell = -1; a.fGen = 0; a.fRate = 0; a.f2W = 0; a.f2Cell = -1; a.f2Gen = 0; a.f2Rate = 0; a.f3W = 0; a.f3Cell = -1; a.f3Gen = 0; a.f3Rate = 0;
  a.clear = 1; a.conv = 0; a.baseW = 0; a.topH = 0; a.coverSum = 0;
}

// (group D) what a cell of each kind looks like to the cloud map: the share of its cover that is cumuliform, its base above
// the land (m) and how thick it is (m). The numbers are the design's vertical scale (docs/lead/WEATHER-DESIGN.md 3).
export const CLOUD_FORM = {
  cloud: { conv: 0.6, base: 320, thick: 260 }, drizzle: { conv: 0.1, base: 180, thick: 320 }, rain: { conv: 0.15, base: 200, thick: 520 },
  shower: { conv: 0.9, base: 260, thick: 750 }, storm: { conv: 1, base: 220, thick: 1800 }, fog: { conv: 0, base: 0, thick: 60 },
  dust: { conv: 0, base: 0, thick: 400 }, haze: { conv: 0, base: 150, thick: 500 }, acid: { conv: 0.1, base: 200, thick: 600 },
  ice: { conv: 0.3, base: 250, thick: 600 }, frost: { conv: 0, base: 300, thick: 200 }, veil: { conv: 0, base: 400, thick: 200 },
};

// The influence of ONE cell c (cellAt's or spotAt's fields) on unit direction (ux,uy,uz), added into a. (gather's body,
// taken out so that a planet-wide map can derive every cell once and then call this per texel: the arithmetic is gather's
// own, in its own order, so gather is what it was to the last digit.)
function accumulate(a, c, ux, uy, uz, R) {
  const dot = ux * c.x + uy * c.y + uz * c.z;
  const reach = c.r * WEATHER.frontReach;
  const d = R * Math.sqrt(Math.max(0, 2 - 2 * dot));
  if (d >= reach) return;
  const K = c.kind;
  const x = d / c.r;
  // The edges are smeared by turbulent mixing as the system travels: the faster it drifts,
  // the wider they are (an edge takes about WEATHER.edgeTime to pass).
  const x0 = clamp(1 - Math.hypot(c.ve, c.vn) * WEATHER.edgeTime / c.r, 0.2, 0.45);
  const core = (1 - smoothstep(x0, 1, x)) * c.w;                // precipitation footprint
  const cover = (1 - smoothstep(x0 + 0.25, 1.15, x)) * c.w;     // cloud shield is wider
  if (core > 0) {
    const rr = K.rate * core * core;
    a.rate += rr;
    if (K === KINDS.ice) a.rateIce += rr; else if (K === KINDS.frost) a.rateFrost += rr;
    a.flash += K.flash * core;
    // (group D: the three cells that give this place most of its lightning, each with its own rate: with the cloud map on,
    //  the lightning here is theirs, so every flash of a storm over or beside this place lights it, as its bolt is drawn)
    const fw = K.flash * core;
    if (fw > a.f3W) {
      if (fw > a.fTopW) {
        a.f3W = a.f2W; a.f3Cell = a.f2Cell; a.f3Gen = a.f2Gen; a.f3Rate = a.f2Rate;
        a.f2W = a.fTopW; a.f2Cell = a.fCell; a.f2Gen = a.fGen; a.f2Rate = a.fRate;
        a.fTopW = fw; a.fCell = c.i; a.fGen = c.gen; a.fRate = K.flash * c.w;
      } else if (fw > a.f2W) {
        a.f3W = a.f2W; a.f3Cell = a.f2Cell; a.f3Gen = a.f2Gen; a.f3Rate = a.f2Rate;
        a.f2W = fw; a.f2Cell = c.i; a.f2Gen = c.gen; a.f2Rate = K.flash * c.w;
      } else { a.f3W = fw; a.f3Cell = c.i; a.f3Gen = c.gen; a.f3Rate = K.flash * c.w; }
    }
  }
  if (K.vis > 0) {
    // A bank of fog, dust or haze. The extinction (in clear-air units) is shaped so that the
    // visual range closes in steadily on the way in: visibility01 = 1 / sqrt(1 + ext) falls
    // in proportion to the depth into the bank, and the edge is a gradual veil, never a wall.
    // (At the middle of a full-grown bank of strength s the extinction is s^2 E, as thick as
    // its kind and strength say.)
    const veil = c.w > 0 ? core / c.w * c.env : 0;
    if (veil > 0) {
      const E = c.s * c.s * WEATHER.clearVisibility / K.vis, q = 1 - (1 - 1 / Math.sqrt(1 + E)) * veil;
      const ext = 1 / (q * q) - 1;
      if (K === KINDS.fog) a.fog += ext; else if (K === KINDS.dust) a.dust += ext; else a.haze += ext;
    }
  }
  if (core > 0) {
    if (K === KINDS.storm) a.storm = Math.max(a.storm, core);
    if (core > a.topW) { a.topW = core; a.top = c.kindId; a.topCell = c.i; a.topGen = c.gen; }
  }
  if (cover > 0) {
    a.clear *= 1 - K.cloud * cover;
    // (group D: the cloud map's form, cover-weighted; nothing of the old weather reads these)
    const F = CLOUD_FORM[c.kindId], wc = K.cloud * cover;
    if (F) { a.coverSum += wc; a.conv += F.conv * wc; a.baseW += F.base * wc; a.topH += (F.base + F.thick * (0.55 + 0.45 * c.w)) * wc; }
  }
  // mean wind: stronger under active systems, calmer inside fog
  if (K.wind >= 1) a.windMul += (K.wind - 1) * cover; else a.calm = Math.max(a.calm, (1 - K.wind) * cover);
  if (K.blow > 0) a.blow = Math.max(a.blow, K.blow * cover);     // (the cloud shield is wider than the rain: the wind rises first)
  // gust front: cold outflow spreading from the core, strongest just ahead of the rain
  if (K.outflow > 0 && d > 1) {
    const ring = smoothstep(0.15, 0.8, x) * (1 - smoothstep(0.95, WEATHER.frontReach, x));
    const v = K.outflow * c.w * ring;
    if (v > 0) {
      // direction: from the cell centre to the point, in the tangent plane at the point
      let dx = ux - c.x, dy = uy - c.y, dz = uz - c.z;
      const dn = dx * ux + dy * uy + dz * uz;
      dx -= dn * ux; dy -= dn * uy; dz -= dn * uz;
      const l = Math.hypot(dx, dy, dz);
      if (l > 1e-9) { a.ox += dx / l * v; a.oy += dy / l * v; a.oz += dz / l * v; a.front = Math.max(a.front, ring * c.w); }
    }
  }
  // a great spot turns: wind circling the centre, fastest at 70 % of its radius
  if (c.swirl > 0 && d > 1) {
    const v = c.swirl * c.w * smoothstep(0, 0.7, x) * (1 - smoothstep(0.75, WEATHER.frontReach, x)) * c.spin;
    let dx = ux - c.x, dy = uy - c.y, dz = uz - c.z;
    const dn = dx * ux + dy * uy + dz * uz;
    dx -= dn * ux; dy -= dn * uy; dz -= dn * uz;
    const l = Math.hypot(dx, dy, dz);
    // tangent = up x radial
    if (l > 1e-9) { a.ox += (uy * dz - uz * dy) / l * v; a.oy += (uz * dx - ux * dz) / l * v; a.oz += (ux * dy - uy * dx) / l * v; }
  }
}

// Sum the influence of every cell on unit direction (ux,uy,uz) at time t into _acc.
function gather(bodyId, ux, uy, uz, t, seed) {
  const a = _acc;
  resetAcc(a);
  const regime = REGIMES[bodyId];
  if (!regime || !regime.cells) return a;
  const R = BODIES[bodyId].radius, s = seedFor(bodyId, seed);
  const nCells = regime.cells + (regime.spots ? regime.spots.length : 0);
  for (let i = 0; i < nCells; i++) {
    if (!cellAt(bodyId, R, regime, s, i, t, _c)) continue;
    accumulate(a, _c, ux, uy, uz, R);
  }
  if (LAND && WX2.stormland && LAND.bodyId === bodyId && t >= STORMLAND.from) {
    _lcl.n = 0; landCellsInto(bodyId, t, seed, _lcl);
    for (let i = 0; i < _lcl.n; i++) accumulate(a, _lcl[i], ux, uy, uz, R);
  }
  if (_forced) accumulate(a, forcedInto(_c), ux, uy, uz, R);
  a.cloud = 1 - a.clear;
  return a;
}
const _lcl = []; _lcl.n = 0;

// (group D) gather itself, for the rain field's pure functions (cloudfield.js rainAt): its accumulator, overwritten by
// the next call to any of the weather's functions, so read what you need from it at once.
export function gather1(bodyId, ux, uy, uz, t, seed = DEFAULT_SEED) { return gather(bodyId, ux, uy, uz, t, seed); }

// (group D) Every live cell of a body at time t, each a plain object with cellAt's fields, into `out` (reused: its objects
// are kept and refilled). For a map that asks about thousands of places at one time: derive the cells once, then
// gatherFrom per place (MEASURED on the build machine for Earth's 6,144 texels: 0.35 ms against 20.4 ms by gather).
export function liveCells(bodyId, t, seed = DEFAULT_SEED, out = []) {
  out.n = 0;
  const regime = REGIMES[bodyId];
  if (!regime || !regime.cells) return out;
  const R = BODIES[bodyId].radius, s = seedFor(bodyId, seed);
  const nCells = regime.cells + (regime.spots ? regime.spots.length : 0);
  for (let i = 0; i < nCells; i++) {
    const c = out[out.n] || (out[out.n] = {});
    if (cellAt(bodyId, R, regime, s, i, t, c)) out.n++;
  }
  landCellsInto(bodyId, t, seed, out);
  if (_forced) { const c = out[out.n] || (out[out.n] = {}); forcedInto(c); out.n++; }
  // (how far each reaches, as the least dot product of a place's direction with its centre that it still touches: a
  //  place below it is skipped by gatherFrom without the square root, exactly where accumulate would return at once)
  for (let i = 0; i < out.n; i++) { const c = out[i], q = c.r * WEATHER.frontReach / R; c.dotMin = 1 - 0.5 * q * q; }
  return out;
}
// gather over a list made by liveCells (the same numbers gather gives at the same time and place). Returns its accumulator,
// which the next call overwrites: read what you need from it first.
const _acc2 = { blow: 0, rate: 0, rateIce: 0, rateFrost: 0, cloud: 0, windMul: 1, calm: 0, flash: 0, fog: 0, haze: 0, dust: 0, ox: 0, oy: 0, oz: 0, storm: 0, top: null, topW: 0, topCell: -1, topGen: 0, front: 0, clear: 1, conv: 0, baseW: 0, topH: 0, coverSum: 0, fTopW: 0, fCell: -1, fGen: 0, fRate: 0, f2W: 0, f2Cell: -1, f2Gen: 0, f2Rate: 0, f3W: 0, f3Cell: -1, f3Gen: 0, f3Rate: 0 };
export function gatherFrom(cells, bodyId, ux, uy, uz) {
  const a = _acc2;
  resetAcc(a);
  const R = BODIES[bodyId].radius;
  for (let i = 0; i < cells.n; i++) { const c = cells[i]; if (ux * c.x + uy * c.y + uz * c.z > c.dotMin) accumulate(a, c, ux, uy, uz, R); }
  a.cloud = 1 - a.clear;
  return a;
}

// What the weather does to the wind at a place: o[0] = multiplier on the mean wind,
// o[1..3] = outflow vector (m/s, body-local) to add, o[4] = extra gustiness 0..1,
// o[5] = the system's own wind (m/s at 10 m) to add along the mean wind (P7).
export function weatherWind(bodyId, ux, uy, uz, t, seed, o) {
  const a = gather(bodyId, ux, uy, uz, t, seed);
  o[0] = a.windMul * (1 - a.calm);
  o[1] = a.ox; o[2] = a.oy; o[3] = a.oz;
  o[4] = clamp01(a.storm * 0.8 + a.front * 0.6 + (a.windMul - 1) * 0.3);
  o[5] = a.blow;
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
  // ((M4) the water from the oldest slice to the newest, drying between them and never more than the surface holds
  // (WEATHER.wetStore: the rest ran off). Without the store this is the sum it was, mm x exp(-lag / dryTau), to the digit.)
  let water = 0, snow = 0, lagPrev = 0.5 * (LAGS[LAGS.length - 2] + LAGS[LAGS.length - 1]);
  for (let k = LAGS.length - 2; k >= 0; k--) {
    const lag = 0.5 * (LAGS[k] + LAGS[k + 1]), dl = LAGS[k + 1] - LAGS[k];
    if (water > 0) water *= Math.exp(-(lagPrev - lag) / dryTau);
    lagPrev = lag;
    precipAt(bodyId, ux, uy, uz, t - lag, seed, moist, T, _p);
    if (_p.rate <= 0) continue;
    const mm = _p.rate * dl * ts / 3600;                 // mm of water that fell in this slice
    water += mm * (1 - _p.frozen);
    if (water > WEATHER.wetStore) water = WEATHER.wetStore;
    const depth = mm * _p.frozen * WEATHER.coldShare * WEATHER.snowRatio / 1000;     // m of fresh snow
    snow += Math.max(0, depth * Math.exp(-lag / settleTau) - meltPerS * lag * 0.5);
  }
  if (water > 0) water *= Math.exp(-lagPrev / dryTau);
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
// Strength now (0..1) of the storm a place grows for itself (WEATHER.own*), for a biome moisture
// `moist`. A smooth pattern in space and time: neighbours agree, and it comes and goes over minutes.
const OWN_CELL = 9001;
const _own = { x: 0, y: 1, z: 0, r: 1 };
export function ownStorm01(bodyId, ux, uy, uz, t, seed, moist) {
  const duty = WEATHER.ownMax * clamp01((moist - WEATHER.ownFrom) / WEATHER.ownSpan);
  if (!(duty > 0)) return 0;
  const k = BODIES[bodyId].radius / WEATHER.ownLength, tt = t / WEATHER.ownTime;
  const n = 0.5 + 0.5 * noise3(ux * k + tt * 0.37, uy * k - tt * 0.21, uz * k + tt, seedFor(bodyId, seed) + 4001);
  // (the noise spends about as long over 0.5 as under it: the threshold follows the share of time wanted)
  const thr = 0.5 - (duty - 0.5) * 0.62;
  return smoothstep(thr - 0.11, thr + 0.11, n);
}

// Fills and returns `o` (shape documented in docs/notes/physics.md, API section).
export function weatherAt(bodyId, ux, uy, uz, altitude, t, seed, env, o = {}) {
  const regime = REGIMES[bodyId];
  const atm = ATMOSPHERES[bodyId];
  const moist = env && env.moist != null ? env.moist : 1;
  const sun01 = env && env.sun01 != null ? env.sun01 : null;
  const T = airTemperature(bodyId, altitude, uy, sun01) + (env && env.dT ? env.dT : 0);
  const wind = env && env.wind != null ? env.wind : (WINDS[bodyId] ? WINDS[bodyId].U : 0);
  const a = gather(bodyId, ux, uy, uz, t, seed);
  // a storm of the place's own making (WEATHER.own*): cloud first, then rain and lightning
  const own = regime && regime.cells && moist > WEATHER.ownFrom ? ownStorm01(bodyId, ux, uy, uz, t, seed, moist) : 0;
  if (own > 0) {
    const core = smoothstep(0.3, 1, own);
    a.cloud = 1 - (1 - a.cloud) * (1 - Math.min(1, own * 1.6));
    a.rate += KINDS.storm.rate * WEATHER.ownRate * core * core;
    a.flash += KINDS.storm.flash * core;
    if (core > a.storm) a.storm = core;
    if (core > a.topW) {
      // its lightning falls round a centre the whole neighbourhood agrees on
      const q = BODIES[bodyId].radius / (WEATHER.ownLength * 0.5);
      const cx = Math.round(ux * q), cy = Math.round(uy * q), cz = Math.round(uz * q), cl = Math.hypot(cx, cy, cz) || 1;
      _own.x = cx / cl; _own.y = cy / cl; _own.z = cz / cl; _own.r = WEATHER.ownLength * 0.6;
      a.topW = core; a.top = 'storm'; a.topCell = OWN_CELL; a.topGen = Math.round(cx * 7 + cy * 13 + cz * 17);
    }
  }
  const pr = o.precipitation || (o.precipitation = {});
  const li = o.lightning || (o.lightning = { last: { t: -1e9, x: 0, y: 1, z: 0, distance: 1e9 } });
  // Weather lives in the lower half of the atmosphere (PAINTER's cloud deck sits at 55 % of its
  // height). Climb through it and you are above the rain, the fog and the cloud.
  const top = BODIES[bodyId].atmosphereHeight || 0;
  // (group D, ?stormland=1: the weather lives under ITS OWN TOP, which the caller says (env.cloudTop, m above the datum:
  //  the cloud map's, over the land), not under half the atmosphere above the datum, which put a quarter of Earth's
  //  alpine meadow above all weather. Without env.cloudTop it is exactly as it was.)
  const below = env && env.cloudTop != null ? 1 - smoothstep(env.cloudTop, env.cloudTop + 150, altitude) : top > 0 ? 1 - smoothstep(top * 0.5, top * 0.62, altitude) : 0;
  // (group D: the land's own weather at this place, when the caller has it: env.rainK multiplies what falls -- more on
  //  the windward side of a range, less in its lee -- and env.cu is the fair cumulus the wind map's lift grows here)
  if (env && env.rainK != null) { a.rate *= env.rainK; a.rateIce *= env.rainK; a.rateFrost *= env.rainK; }
  if (env && env.cu > 0) a.cloud = 1 - (1 - a.cloud) * (1 - clamp01(env.cu));

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
  // (M4; PILOT's critique of PHYSICS, item 5: the wood was misty from 6.5 minutes into a new game to the 24th.)
  // Radiation mist is the night's work: the ground cools under a clear sky through the night, the mist is thickest
  // before dawn, lies through the sunrise and is burnt off in the morning. Until M4 it hung on the sun's height alone
  // (all of it under 23 degrees), so every gold evening and every dusk stood in it. With the sun's east part
  // (env.sunEast: the sun's direction along east here, + in the morning) the hour is known: psi is the sun's angle
  // round the sky, -90 at sunset, 0 at midnight, 90 at sunrise, +-180 at noon. No mist through the afternoon, the
  // evening and the dusk; it gathers from an hour and a half after sunset, is whole from two hours after midnight to
  // the sunrise, and is gone by mid-morning. Without env.sunEast (a caller that does not say): the old law.
  // And a clouded night keeps its warmth: under a closed sky there is 0.3 of it.
  let dawn;
  if (sun01 == null) dawn = 0.35;
  else if (env == null || env.sunEast == null) dawn = 1 - smoothstep(-0.05, 0.4, sun01);
  else { const psi = Math.atan2(env.sunEast, -sun01) * 57.29578; dawn = smoothstep(-70, 20, psi) * (1 - smoothstep(95, 125, psi)); }
  const openSky = env != null && env.sunEast != null ? 1 - 0.7 * clamp01(a.cloud) : 1;
  // radiation fog needs calm, cool, damp air; a few places (honey-mist valleys, pearl-fog flats)
  // are misty whatever the wind does
  // (only where the air is near the condensation point of something: not on Venus or Mars)
  const mistOK = regime && regime.cells && atm.rho0 > 0.3 && melt > 1 && melt < 1e8 && T < melt + 40;
  const mist = mistOK ? Math.max(fogBiome * calm * (0.3 + 0.7 * dawn) * openSky, 0.5 * smoothstep(0.92, 1, fogBiome)) : 0;
  // ---- a gale has a sky of its own (P7) -----------------------------------------------------------
  // The large-scale wind here (no gusts: it changes over minutes), with what the weather cells make
  // of it. From a strong gale to hurricane force (Beaufort 8 to 12) scud closes the sky, and over an
  // open sea the air fills with spray torn from the crests ("visibility seriously affected"): until
  // P7 Neptune's 34 m/s blew over a white sea under a fair sky.
  windLarge(bodyId, ux, uy, uz, t, seed, _wl);
  const galeU = _wl[3] * a.windMul * (1 - a.calm);   // (not the storm's own wind: a storm has its own sky)
  const gale01 = rho > 0.05 ? smoothstep(WEATHER.galeFrom, WEATHER.galeFull, galeU) : 0;
  const open = env && env.fetch > 0 ? smoothstep(600, 2000, env.fetch) : 0;
  const sprayExt = WEATHER.sprayExt * gale01 * open;
  const fogExt = (a.fog * (0.4 + 0.6 * fogBiome) + mist * mist * WEATHER.clearVisibility / 150 + sprayExt) * below;
  // ---- dust: storms, plus wind over a dust source above the saltation threshold ---------------
  const dustSrc = env && env.dustSource != null ? env.dustSource : 0;
  const lift = rho > 0 ? smoothstep(1.0, 2.2, wind / saltationThreshold(bodyId, rho)) : 0;
  // (P8, lead review 5 P4) ... and only dry ground gives dust up: soil moisture binds the grains
  // (the threshold of wind erosion rises steeply with it; Fecan et al. 1999), so where it rains
  // as much as the body's mean (a biome's moist of 1: a temperate wood, a meadow, a wet coast)
  // the wind lifts none, however hard it blows. A dust STORM's dust is carried in from elsewhere.
  const dry = clamp01(1 - moist);
  const dustExt = (a.dust * (0.5 + 0.5 * dustSrc) + lift * dustSrc * dry * WEATHER.clearVisibility / 400) * below;
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
    // (group D, with the cloud map on: the storm overhead flashes as its own schedule says, the same flashes the cloud map
    //  lists and the bolts draw (cloudfield.js flashesFor: flashOf, the cell's own rate); before, the place took the cell
    //  that COVERED it most -- often a storm's wider cloud shield, a different cell -- at the rate gathered here, so the
    //  flash of light and the bolt in the sky were two different series. Brightness still falls with the distance.)
    //  (Up to the three storms that flash most here, each on its own schedule: the brightest flash of them, the latest one
    //  as `last`, the soonest next.)
    if (WX2.cloudmap && a.fCell >= 0 && a.topCell !== OWN_CELL) {
      for (let q = 0; q < 3; q++) {
        const cell = q === 0 ? a.fCell : q === 1 ? a.f2Cell : a.f3Cell;
        if (cell < 0) continue;
        const gen = q === 0 ? a.fGen : q === 1 ? a.f2Gen : a.f3Gen, per = q === 0 ? a.fRate : q === 1 ? a.f2Rate : a.f3Rate;
        const L = _lt; L.flash01 = 0; L.nextIn = Infinity; L.thunderIn = Infinity; L.thunder01 = 0; L.last.t = -1e9; L.last.distance = 1e9;
        lightningFor(bodyId, regime, seed, cell, gen, per, ux, uy, uz, t, atm.c, L, cell === FORCED_CELL && _forced ? forcedCentre() : cell >= LAND_BASE ? landCentre(bodyId, seed, cell, gen, t) : null);
        if (L.flash01 > li.flash01) li.flash01 = L.flash01;
        if (L.nextIn < li.nextIn) li.nextIn = L.nextIn;
        if (L.last.t > li.last.t) { li.last.t = L.last.t; li.last.x = L.last.x; li.last.y = L.last.y; li.last.z = L.last.z; li.last.distance = L.last.distance; li.thunderIn = L.thunderIn; li.thunder01 = L.thunder01; }
      }
    } else {
      lightningFor(bodyId, regime, seed, a.topCell, a.topGen, a.flash, ux, uy, uz, t, atm.c, li, a.topCell === OWN_CELL ? _own : a.topCell === FORCED_CELL && _forced ? forcedCentre() : a.topCell >= LAND_BASE ? landCentre(bodyId, seed, a.topCell, a.topGen, t) : null);
    }
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
  // ((M4; PILOT's critique of PHYSICS, item 8) mist and fog do not stand in a gale: at Neptune's storm coast the air was
  // called mist for 348 of 600 s with 5 to 41 m/s blowing. What takes the view there is spray off the sea, or scud: in
  // a wind over nameGale the grey air is 'spray' over open water and 'windy' elsewhere; its numbers are unchanged.)
  else if (o.fog01 > 0.5 && wind * o.windFactor > WEATHER.nameGale) { kind = sprayExt > 0.5 * fogExt ? 'spray' : 'windy'; inten = clamp01((wind * o.windFactor - 8) / 12); }
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
function lightningFor(bodyId, regime, seed, cell, gen, perMin, ux, uy, uz, t, cSound, li, own = null) {
  const s = seedFor(bodyId, seed) + 7919;
  const R = BODIES[bodyId].radius;
  const slot = WEATHER.slot;
  const p = clamp01(perMin * slot / 60);
  const n0 = Math.floor(t / slot);
  if (own) { _c.x = own.x; _c.y = own.y; _c.z = own.z; _c.r = own.r; }
  else if (cell >= regime.cells + (regime.spots ? regime.spots.length : 0) || !cellAt(bodyId, R, regime, seedFor(bodyId, seed), cell, t, _c)) return;   // (a cell that is not the body's own, with no centre given: none)
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
