// Painted Cosmos physics: THE CLOUD AND RAIN MAP OF A WHOLE WORLD, and THE RAIN FIELD handed to the water group.
// OWNER: PHYSICS (group D, the STORMS AND RAIN lane). Pure (no three, no DOM). docs/lead/WEATHER-DESIGN.md 6 and 9.2-9.3.
// Behind wx2.js WX2.cloudmap: with it off nothing here runs.
//
// Until now the sky knew ONE weather: the eleven numbers at the eye (sky.js), so a storm two kilometres off could not be
// seen until it was overhead, and nothing told the water where on the planet it was raining. This holds, for every texel
// of the same cube-sphere grid as the wind map (32 a face: 196 m on Earth), how much low cloud there is and of what form,
// where its base and top stand, the high cloud, and how hard it rains and snows at the ground; refreshed twice a second
// in slices. The weather systems are weather.js's own (liveCells + gatherFrom: the very numbers weatherAt gives), so the
// map and the sky at the eye cannot disagree.
//
// THE RAIN FIELD, for the water group (their WATER-DESIGN.md 5.6 asked for uRainCells[8] and rainAt; reconciled here):
//   on the CPU:  fields.rain.rate / .snow (mm/h at the ground, per texel), .at(), .now (mm/h liquid at the focus), and the
//                pure functions rainAt / rainBetween / throughfall below: any place, any time;
//   on the GPU:  fields.rain.cells (Float32Array(32): uRainCells[8], each (east, north, radius, peak mm/h) about the physics
//                frame's anchor uPhysAnchor along uPhysEast / uPhysNorth, the same coordinates pcPhysGrid gives), and
//                fields.rain.cellsX (Float32Array(8): uRainCellsX[2], where each cell's core starts to fall off), with
//                RAIN_GLSL's pcRainCells(en) turning them into mm/h at a point exactly as weather.js lays a cell's rain.
//   What the cells do not carry: the place's moisture and its share of snow (the CPU functions do). With the map's
//   texture (world/wxfield.js, lane CLOUDS, later) the GPU will have the whole planet's rate as well.
import { BODIES } from '../data/bodies.js';
import { liveCells, gatherFrom, gather1, flashOf, REGIMES, WEATHER, KINDS, DEFAULT_SEED } from './weather.js';
import { WX2 } from './wx2.js';
import { heatBuilt, sunHourAt } from './windmap.js';
import { noise3, hash3 } from './util.js';
import { airTemperature } from './atmosphere.js';
import { faceToDir, dirToFace } from './windmap.js';
import { clamp, clamp01, smoothstep } from './util.js';

export const CLOUDMAP = Object.freeze({
  N: 32,                // texels a face edge (the wind map's grid)
  // (?stormland=1) what the land does to the cloud and the rain, from the wind map's lift and trigger:
  cuMax: 0.7,           // fair cumulus over a fully triggered texel covers this much of its sky ...
  cuBase: [300, 380],   // ... with its base this far over the land at the morning's start and through the afternoon (m) ...
  cuThick: [150, 750],  // ... and this thick, from just triggered to fully
  rainWind: 0.8,        // rain x (1 + this x lift) on the windward side (lift in m/s, up to 1.5) ...
  rainLee: 0.5,         // ... and x (1 - this x sinking) in the lee (up to 1 m/s)
  cirrus: 0.35,         // the most high cloud the slow cirrus field lays
  anvil: 1.6,           // a storm's anvil spreads this many core radii, downwind of it
  flashReach: 4000,     // m: the lightning of every storm cell this near the focus is listed
  period: 0.5,          // s for a full refresh
  cells: 8,             // rain cells handed to the shaders
  cellReach: 4500,      // m: a raining system further than this from the focus (to its edge) is not handed on
});

// The share of what falls that reaches the ground UNDER TREES (particles.js: a dry canopy lets a quarter through, a soaked
// one three quarters; the rest runs down the stems or evaporates): canopy01 the closure, wet01 how soaked it is.
const THROUGH_DRY = 0.25, THROUGH_WET = 0.75;
export function throughfall(canopy01, wet01) {
  const c = clamp01(canopy01 || 0), t = THROUGH_DRY + (THROUGH_WET - THROUGH_DRY) * clamp01(wet01 || 0);
  return 1 - c * (1 - t);
}

// What falls at a place, split as weatherAt splits it (liquid, and frozen as water): a = gather's accumulator, moist the
// place's rain multiplier, T its air temperature (K), alt its height above the datum (for the virga of a hot world).
function split(bodyId, a, moist, T, alt, out) {
  const regime = REGIMES[bodyId];
  out.rate = 0; out.snow = 0;
  if (!regime || !regime.cells) return out;
  let rate = a.rate * moist;
  const melt = regime.melt != null ? regime.melt : 1e9;
  const frozen = melt < 1e8 ? 1 - smoothstep(melt - 1.5, melt + 2.5, T) : (melt > 0 ? 1 : 0);
  let rFrost = regime.liquid === 'frost' ? rate : a.rateFrost * moist;
  if (regime.frostBelow > 0) { const k = 1 - smoothstep(regime.frostBelow - 4, regime.frostBelow, T); rate -= rFrost * (1 - k); rFrost *= k; }
  const rIce = regime.liquid === 'frost' ? 0 : a.rateIce * moist;
  const rOther = Math.max(0, rate - rIce - rFrost);
  const reach = regime.virga > 0 ? smoothstep(regime.virga * 0.6, regime.virga * 1.4, alt) : 1;
  out.rate = rOther * (1 - frozen) * reach;
  out.snow = rOther * frozen * WEATHER.coldShare + rIce + rFrost;
  return out;
}

// THE RAIN AT ANY PLACE AND TIME (mm/h at the ground). env (optional): { moist (the biome's rain multiplier, 1),
// altitude (m above the datum, 0: for the air's temperature and a hot world's virga), sun01 (null), dT (K, 0) }.
// Returns out { rate (liquid), snow (water equivalent) }.
export function rainAt(bodyId, ux, uy, uz, t, seed = DEFAULT_SEED, env = null, out = {}) {
  const a = gather1(bodyId, ux, uy, uz, t, seed);
  const alt = env && env.altitude != null ? env.altitude : 0;
  const T = airTemperature(bodyId, alt, uy, env && env.sun01 != null ? env.sun01 : null) + (env && env.dT ? env.dT : 0);
  // (?stormland=1: the land's windward and lee factor from the wind map the physics is running, as the map applies it)
  if (WX2.stormland && RAINLAND.map && RAINLAND.map.ready && RAINLAND.map.bodyId === bodyId && !(env && env.rainK != null)) {
    const lift = RAINLAND.map.at(ux, uy, uz, _rlo).lift, rk = 1 + CLOUDMAP.rainWind * clamp(lift, 0, 1.5) - CLOUDMAP.rainLee * clamp(-lift, 0, 1);
    a.rate *= rk; a.rateIce *= rk; a.rateFrost *= rk;
  } else if (env && env.rainK != null) { a.rate *= env.rainK; a.rateIce *= env.rainK; a.rateFrost *= env.rainK; }
  split(bodyId, a, env && env.moist != null ? env.moist : 1, T, alt, out);
  // (the weather's ceiling as weatherAt lays it: without ?stormland it lives under half the atmosphere above the DATUM, so
  //  ground higher than that gets none; with it the weather lives under its own top, which stands over any land)
  if (!WX2.stormland) { const b = ceilingBelow(bodyId, alt); out.rate *= b; out.snow *= b; }
  return out;
}
function ceilingBelow(bodyId, alt) { const top = BODIES[bodyId].atmosphereHeight || 0; return top > 0 ? 1 - smoothstep(top * 0.5, top * 0.62, alt) : 0; }
// the wind map rainAt reads the land's windward and lee factor from (physics/index.js sets it while ?stormland is on)
export const RAINLAND = { map: null };
const _rlo = {};
// WHAT FELL between game times t0 and t1 (mm of water at the ground; the weather's own clock, WEATHER.timeScale: a game
// second of a 6 mm/h rain lays 6 x 60 / 3600 = 0.1 mm). Midpoint steps of at most `step` game seconds (the systems change
// over tens of seconds). Returns out { mm, mmSnow }.
const _rb = {};
export function rainBetween(bodyId, ux, uy, uz, t0, t1, seed = DEFAULT_SEED, env = null, out = {}, step = 5) {
  out.mm = 0; out.mmSnow = 0;
  if (!(t1 > t0)) return out;
  const n = Math.max(1, Math.ceil((t1 - t0) / step)), h = (t1 - t0) / n, k = h * WEATHER.timeScale / 3600;
  for (let i = 0; i < n; i++) {
    rainAt(bodyId, ux, uy, uz, t0 + (i + 0.5) * h, seed, env, _rb);
    out.mm += _rb.rate * k; out.mmSnow += _rb.snow * k;
  }
  return out;
}

// The GPU twin of a cell's rain (weather.js accumulate: K.rate x core^2, core = (1 - smoothstep(x0, 1, d / r)) x w), for
// the rain cells handed to the shaders. uRainCells[i] = (east, north, radius, peak) about uPhysAnchor (m, mm/h; peak 0:
// no cell), uRainCellsX[2] the eight x0. pcRainCells(en): mm/h at frame position en (pcPhysGrid of a body-local point).
export const RAIN_GLSL = /* glsl */`
uniform vec4 uRainCells[8];
uniform vec4 uRainCellsX[2];
float pcRainCells(vec2 en) {
  float r = 0.0;
  for (int i = 0; i < 8; i++) {
    vec4 c = uRainCells[i];
    if (c.w <= 0.0) continue;
    float x0 = uRainCellsX[i / 4][i - (i / 4) * 4];
    float core = 1.0 - smoothstep(x0, 1.0, length(en - c.xy) / c.z);
    r += c.w * core * core;
  }
  return r;
}
`;

// ---- the map ---------------------------------------------------------------------------------------------------------
const _d3 = [0, 0, 0], _sp = {}, _wo = {}, _hp = { x: 0, y: 1, z: 0 }, _li = { last: { t: -1e9, x: 0, y: 1, z: 0, distance: 1e9 } }, _ab = {};

export class CloudField {
  constructor(seed = DEFAULT_SEED) {
    const N = CLOUDMAP.N, T = 6 * N * N;
    this.seed = seed; this.N = N; this.count = T;
    this.cx = new Float32Array(T); this.cy = new Float32Array(T); this.cz = new Float32Array(T);
    for (let f = 0; f < 6; f++) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = (f * N + j) * N + i;
      faceToDir(f, (i + 0.5) / N * 2 - 1, (j + 0.5) / N * 2 - 1, _d3);
      this.cx[k] = _d3[0]; this.cy[k] = _d3[1]; this.cz[k] = _d3[2];
    }
    const F = () => new Float32Array(T);
    this.low = F(); this.conv = F(); this.base = F(); this.top = F(); this.mid = F(); this.high = F(); this.valley = F();
    this.rain = F(); this.snow = F(); this.storm = F();
    this.cu = F();                                // (?stormland=1) the fair cumulus share of `low`, grown by the land's lift
    this.cells = []; this.cells.n = 0;           // weather.js liveCells of the last frame (reused objects)
    this.flashes = []; this.flashes.n = 0;       // the last flash of every storm cell near the focus (flashesFor)
    this.bodyId = null; this.version = 0; this.t = 0; this.ready = false;
    this._cursor = 0;
    // the rain field for the water group (see the top of this file)
    this.rainCells = new Float32Array(CLOUDMAP.cells * 4);
    this.rainCellsX = new Float32Array(CLOUDMAP.cells);
    this.rainNow = 0;
    this._order = [];
  }

  _reset(bodyId) {
    this.bodyId = bodyId; this.version = 0; this.ready = false; this._cursor = 0;
    for (const A of [this.low, this.conv, this.base, this.top, this.mid, this.high, this.valley, this.rain, this.snow, this.storm, this.cu]) A.fill(0);
  }

  // One frame's slice. windMap: the wind map (its land's heights and moisture), or null (the datum and moist 1).
  // sunDir: body-local toward the sun, or null.
  step(dt, bodyId, t, sunDir, windMap) {
    if (bodyId !== this.bodyId) this._reset(bodyId);
    liveCells(bodyId, t, this.seed, this.cells);
    let n = Math.ceil(this.count * Math.max(0, dt) / CLOUDMAP.period);
    if (!this.ready) n = Math.max(n, Math.ceil(this.count / 4));
    this._run(bodyId, t, sunDir, windMap, n);
  }
  refresh(bodyId, t, sunDir, windMap) {
    if (bodyId !== this.bodyId) this._reset(bodyId);
    liveCells(bodyId, t, this.seed, this.cells);
    this._cursor = 0;
    this._run(bodyId, t, sunDir, windMap, this.count);
  }

  _run(bodyId, t, sunDir, windMap, n) {
    const L = windMap && windMap.land && windMap.land.ready && windMap.bodyId === bodyId ? windMap.land : null;
    const M = L && windMap.ready ? windMap : null;
    this._anvils(t);
    for (let q = 0; q < n; q++) {
      const k = this._cursor;
      this._texel(bodyId, k, sunDir, L, M, t);
      if (++this._cursor >= this.count) { this._cursor = 0; this.version++; this.t = t; this.ready = true; }
    }
  }

  // the anvils of this frame's storm cells: [x, y, z, radius, weight] (downwind of each core, where its top spreads)
  _anvils(t) {
    const C = this.cells, A = this._anv || (this._anv = []);
    A.length = 0;
    const R = this.bodyId ? BODIES[this.bodyId].radius : 4000;
    for (let i = 0; i < C.n; i++) {
      const c = C[i];
      if (c.kindId !== 'storm' || !(c.w > 0.25)) continue;
      const sp = Math.hypot(c.ve, c.vn);
      let x = c.x, y = c.y, z = c.z;
      if (sp > 0.1) {
        // 0.8 of a core radius downwind along the cell's own drift
        let ex = z, ez = -x; const el = Math.hypot(ex, ez) || 1; ex /= el; ez /= el;
        const nx = y * ez, ny = z * ex - x * ez, nz = -y * ex, a = 0.8 * c.r / R, de = c.ve / sp, dn = c.vn / sp;
        x += a * (de * ex + dn * nx); y += a * dn * ny; z += a * (de * ez + dn * nz);
        const l = Math.hypot(x, y, z); x /= l; y /= l; z /= l;
      }
      const ar = c.r * CLOUDMAP.anvil / R;
      A.push(x, y, z, 1 - 0.5 * ar * ar, c.w);
    }
  }

  _texel(bodyId, k, sunDir, L, M, t) {
    const ux = this.cx[k], uy = this.cy[k], uz = this.cz[k];
    const a = gatherFrom(this.cells, bodyId, ux, uy, uz);
    const land = L ? L.H2[k] : 0, h = L ? L.h[k] : 0, moist = L ? L.moist[k] : 1;
    const landStorms = WX2.stormland && M;
    // (?stormland=1) the land's own: more rain on the windward side, less in the lee
    if (landStorms) {
      const lift = M.lift[k];
      const rk = 1 + CLOUDMAP.rainWind * clamp(lift, 0, 1.5) - CLOUDMAP.rainLee * clamp(-lift, 0, 1);
      a.rate *= rk; a.rateIce *= rk; a.rateFrost *= rk;
    }
    let low = a.cloud, conv = 0, base = land + 320, top = land + 320, wsum = a.coverSum;
    if (wsum > 1e-6) { conv = a.conv / wsum; base = land + a.baseW / wsum; top = land + a.topH / wsum; }
    // (?stormland=1) fair cumulus where the land lifts the air and the afternoon has heated it: flat-based, its base
    // rising through the day, thicker the more strongly triggered
    let cu = 0;
    const hour = sunDir ? sunHourAt(sunDir, (_hp.x = ux, _hp.y = uy, _hp.z = uz, _hp)) : 12;
    if (landStorms) {
      cu = CLOUDMAP.cuMax * smoothstep(0.05, 0.85, M.trigger[k]);
      if (cu > 0) {
        const cb = land + CLOUDMAP.cuBase[0] + (CLOUDMAP.cuBase[1] - CLOUDMAP.cuBase[0]) * heatBuilt(hour);
        const ct = cb + CLOUDMAP.cuThick[0] + (CLOUDMAP.cuThick[1] - CLOUDMAP.cuThick[0]) * M.trigger[k];
        const wc = cu;
        if (wsum > 1e-6) { base = (base * wsum + cb * wc) / (wsum + wc); top = (top * wsum + ct * wc) / (wsum + wc); conv = (conv * wsum + wc) / (wsum + wc); }
        else { base = cb; top = ct; conv = 1; }
        low = 1 - (1 - low) * (1 - cu);
      }
    }
    this.low[k] = low; this.conv[k] = conv; this.base[k] = base; this.top[k] = top; this.cu[k] = cu;
    this.storm[k] = a.storm;
    // high cloud: the anvils of the storms near by, and (?stormland=1) a slow field of cirrus
    let high = 0;
    const A = this._anv;
    for (let q = 0; q < A.length; q += 5) {
      const d = ux * A[q] + uy * A[q + 1] + uz * A[q + 2];
      if (d > A[q + 3]) { const x = (1 - d) / (1 - A[q + 3]); high = 1 - (1 - high) * (1 - A[q + 4] * (1 - smoothstep(0.35, 1, x))); }
    }
    if (landStorms) {
      const nc = noise3(ux * 2.3 + t * 0.0011, uy * 2.3, uz * 2.3 - t * 0.0007, 7177);
      high = 1 - (1 - high) * (1 - CLOUDMAP.cirrus * smoothstep(0.15, 0.6, nc));
    }
    this.high[k] = high;
    // valley cloud (?stormland=1): radiation mist lying in the hollows, gathered through the night, gone by mid-morning,
    // only where the air is calm
    if (landStorms && L) {
      const hh = (hour + 12) % 24;      // 12 at midnight
      const dawn = smoothstep(7.5, 14, hh) * (1 - smoothstep(18.5, 21.5, hh));
      const calm = 1 - smoothstep(2, 6, Math.hypot(M.e10[k], M.n10[k]));
      this.valley[k] = smoothstep(-12, -70, L.relief[k]) * dawn * calm * clamp01(moist) * (1 - L.water[k]);
    } else this.valley[k] = 0;
    if (a.rate > 0) {
      const sun01 = sunDir ? ux * sunDir.x + uy * sunDir.y + uz * sunDir.z : null;
      const T = airTemperature(bodyId, h, uy, sun01);
      split(bodyId, a, moist, T, h, _sp);
      const cb = WX2.stormland ? 1 : ceilingBelow(bodyId, h);     // (weatherAt's ceiling, as rainAt above)
      this.rain[k] = _sp.rate * cb; this.snow[k] = _sp.snow * cb;
    } else { this.rain[k] = 0; this.snow[k] = 0; }
  }

  // THE LIGHTNING OF EVERY STORM NEAR THE FOCUS (not only the one overhead, as here.weather.lightning): for each storm
  // cell within CLOUDMAP.flashReach of the focus, its last flash (time, ground point, how long ago, a seed for its shape,
  // cloud-to-ground or in the cloud) and when the next comes. The list is reused; .n entries are live.
  flashesFor(bodyId, t, fx, fy, fz) {
    const R = BODIES[bodyId].radius, C = this.cells, out = this.flashes;
    out.n = 0;
    const fl = Math.hypot(fx, fy, fz) || 1, ux = fx / fl, uy = fy / fl, uz = fz / fl;
    for (let i = 0; i < C.n; i++) {
      const c = C[i];
      if (c.kindId !== 'storm' || !(c.w > 0.2)) continue;
      const dc = R * Math.sqrt(Math.max(0, 2 - 2 * (ux * c.x + uy * c.y + uz * c.z)));
      if (dc - c.r > CLOUDMAP.flashReach) continue;
      flashOf(bodyId, this.seed, c, t, _li);
      if (!(_li.last.t > -1e8)) continue;
      const f = out[out.n] || (out[out.n] = {});
      const L = _li.last, age = t - L.t;
      f.t = L.t; f.age = age; f.x = L.x; f.y = L.y; f.z = L.z; f.nextIn = _li.nextIn;
      f.distance = R * Math.sqrt(Math.max(0, 2 - 2 * (ux * L.x + uy * L.y + uz * L.z)));
      f.cell = c.i; f.gen = c.gen;
      f.seed = hash3(c.i, Math.floor(L.t * 10), c.gen, 4049);
      f.kind = f.seed < 0.38 ? 'cg' : 'ic';              // about a third reach the ground
      f.base = this.at(L.x, L.y, L.z, _ab).base;          // (the cloud's base over the land there, m above the datum)
      // the flash's own brightness by its age alone (weather.js lightningFor's strokes, not dimmed by distance)
      f.flash01 = age < 0.7 ? clamp01(Math.exp(-age / 0.16) * (0.62 + 0.38 * Math.cos(age * 118))) : 0;
      out.n++;
    }
    return out;
  }

  // THE RAIN CELLS for the shaders: the raining systems nearest the focus, about the physics frame's anchor. frame: the
  // physics' LocalFrame. Called once a frame by physics/index.js (cheap: the live cells are already made).
  rainCellsFor(bodyId, frame, fx, fy, fz) {
    const R = BODIES[bodyId].radius, C = this.cells, ord = this._order;
    ord.length = 0;
    const fl = Math.hypot(fx, fy, fz) || 1, ux = fx / fl, uy = fy / fl, uz = fz / fl;
    for (let i = 0; i < C.n; i++) {
      const c = C[i];
      if (!(c.kind.rate > 0) || !(c.w > 0)) continue;
      const d = R * Math.sqrt(Math.max(0, 2 - 2 * (ux * c.x + uy * c.y + uz * c.z)));
      if (d - c.r > CLOUDMAP.cellReach) continue;
      ord.push([d - c.r, i]);
    }
    ord.sort((p, q) => p[0] - q[0]);
    const RC = this.rainCells, RX = this.rainCellsX;
    RC.fill(0); RX.fill(0.35);
    for (let m = 0; m < Math.min(CLOUDMAP.cells, ord.length); m++) {
      const c = C[ord[m][1]], r0 = frame.r0;
      RC[m * 4] = frame.lx(c.x * r0, c.y * r0, c.z * r0); RC[m * 4 + 1] = frame.lz(c.x * r0, c.y * r0, c.z * r0);
      RC[m * 4 + 2] = c.r; RC[m * 4 + 3] = c.kind.rate * c.w * c.w;
      RX[m] = clamp(1 - Math.hypot(c.ve, c.vn) * WEATHER.edgeTime / c.r, 0.2, 0.45);
    }
    return RC;
  }

  // Bilinear read at body-local unit direction. Fills out: low, conv, base, top, mid, high, valley, rain, snow, storm.
  at(ux, uy, uz, out) {
    const N = this.N;
    dirToFace(ux, uy, uz, _wo);
    const x = clamp((_wo.u + 1) * 0.5 * N - 0.5, 0, N - 1), y = clamp((_wo.v + 1) * 0.5 * N - 0.5, 0, N - 1);
    const i0 = Math.min(N - 2, Math.floor(x)), j0 = Math.min(N - 2, Math.floor(y)), fx = x - i0, fy = y - j0;
    const b = _wo.face * N * N, k00 = b + j0 * N + i0, k10 = k00 + 1, k01 = k00 + N, k11 = k01 + 1;
    const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
    const B = (A) => A[k00] * w00 + A[k10] * w10 + A[k01] * w01 + A[k11] * w11;
    out.low = B(this.low); out.conv = B(this.conv); out.base = B(this.base); out.top = B(this.top); out.mid = B(this.mid);
    out.high = B(this.high); out.valley = B(this.valley); out.rain = B(this.rain); out.snow = B(this.snow); out.storm = B(this.storm); out.cu = B(this.cu);
    return out;
  }
}
