// Painted Cosmos physics: the facade (COORDINATOR.md C14). OWNER: PHYSICS.
// Pure logic: no three, no DOM, plain {x,y,z} vectors, body-local coordinates, metres, seconds.
// The exact, current API is documented at the top of docs/notes/physics.md.
//
//   const physics = createPhysics({ sampleSurface, seed });
//   physics.update(dt, { bodyId, time, focus, sunDir, disturbers });      // once per frame
//   physics.air(bodyId, p) / physics.weather(bodyId, p) / physics.ground(bodyId, unitDir)
//   physics.explorer.step(st, cmd, dt, physics.bindEnv(bodyId, { sample, gravity }))
//   physics.ship.step(...) / physics.ship.gear(...)
//   physics.fields.flora / physics.fields.deform / physics.particles.rain ... / physics.glsl.flora
import { BODIES } from '../data/bodies.js';
import { ATMOSPHERES, airDensity, airTemperature, liquidOf, gravityAt, fallSpeed, terminalVelocity, SPECIES, bluntTerminal } from './atmosphere.js';
import { WINDS, WIND, setWindScale } from './wind.js';
import { weatherAt, moistureAt, cellsAt, DEFAULT_SEED, WEATHER, REGIMES, saltationThreshold } from './weather.js';
import { liquidAt, BIOME_LIQUID, groundAt, coverAt, MATERIALS, BIOMES, GROUND, holdAngle, iceFriction } from './ground.js';
import { LocalFrame, TerrainGrid } from './near.js';
import { AirGrid, airAt, AIR } from './air.js';
import { FloraField, FLORA, PlantSim, plantDisplace, treeFrequency, stemFrequency } from './flora.js';
import { FLORA_GLSL } from './flora.glsl.js';
import { Particles, PARTICLES, EVENT } from './particles.js';
import { Loose, LOOSE, KICK } from './loose.js';
import { devilsNear, DEVILS } from './features.js';
import { WaterField, WATER_GLSL, WATER, windSea, fetchOf } from './water.js';
import { DeformField, DEFORM, MARK, MARK_STRIDE } from './deform.js';
import { stepExplorerBody, EXPLORER_BODY, jumpSpeedFor, explorerTerminal, sustainableSpeed } from './explorer.js';
import {
  stepShipBody, stepShipGear, wakeShip, SHIP_BODY, shipTopSpeed, shipTerminal, downwashSpeed, groundEffect, gearSag,
  planSpeedChange, sampleSpeedChange, pulseBrakeDistance, stepPulse,
} from './ship.js';

export const PHYSICS_VERSION = 2;
const FETCH_DEFAULT = 800;     // m: fetch assumed for a sea state asked about away from the focus

export const QUALITY = Object.freeze({
  samples: [4, 8, 12],        // sampleSurface calls per frame in steady state, per quality tier
  burst: 3,                   // x that while a grid is mostly empty (after a teleport or landing)
  sampleMs: 0.35,             // ms of sampleSurface per grid per frame at most (after the first two calls)
  reanchor: 384,              // m the focus may wander from the anchor before the frame moves
  moistureEvery: 0.25,        // s between refreshes of the wetness / snow integrals at the focus
});

const now = typeof performance !== 'undefined' && performance.now ? () => performance.now() : () => 0;

// options: sampleSurface (required), seed, timeBudget (default true: ration slow sampleSurface
// calls by time as well as by count; pass false for bit-exact repeatability, as the tests do).
export function createPhysics({ sampleSurface, seed = DEFAULT_SEED, timeBudget = true } = {}) {
  if (typeof sampleSurface !== 'function') throw new Error('createPhysics: sampleSurface(bodyId, unitDir) is required');
  const frame = new LocalFrame();
  const airGrid = new AirGrid(seed);
  const near = new TerrainGrid(17, 2, 8);       // 32 m of ground at 2 m, for particles, pushes and prints
  const flora = new FloraField();
  const particles = new Particles(seed, 1);
  const loose = new Loose(particles);
  const devils = []; devils.count = 0;
  const _denv = { dustSource: 0, sun01: null, wind: 0, storm01: 0, we: 0, wn: 0, rho: 0 };
  const deform = new DeformField(SHIP_BODY.legs);
  const _fill = { snow: 0, sand: 0 };
  const water = new WaterField();
  let liqLevel = -1e9, liqDepth = 0, liqScan = 0;

  let quality = 1;
  let warming = false;
  let active = null;            // body the near field is on, or null
  let time = 0;
  let sunDir = null;
  let lastMoist = -1e9, moistX = 1e9, moistZ = 1e9;
  const focus = { x: 0, y: 1, z: 0 };
  const moist = { wetness01: 0, snowDepth: 0, freshSnow: 0 };
  const cover = { z0: 0.03, canopy01: 0, canopyHeight: 0, moist: 1, fog: 0.2, dustSource: 0.1, dT: 0, snowBase: 0, leaves: 0, spores: 0, ash: 0, fetch: 80, liquidDensity: 0 };
  const here = {
    bodyId: null,
    air: { density: 0, wind: { x: 0, y: 0, z: 0 }, speed: 0, gust01: 0, turbulence: 0, temperature: 0, pressure: 0, soundSpeed: 0, viscosity: 0, altitude: 0, height: 0, near: false },
    weather: { kind: 'clear', intensity01: 0, precipitation: { type: 'none', rate: 0, intensity01: 0, fallSpeed: 0, dropSize: 0, species: null, reachesGround01: 1, frozen01: 0, hail01: 0 }, wetness01: 0, snowDepth: 0, visibility01: 1, visibility: WEATHER.clearVisibility, cloud01: 0, fog01: 0, dust01: 0, haze01: 0, storm01: 0, front01: 0, windFactor: 1, temperature: 0, lightning: { rate: 0, flash01: 0, nextIn: Infinity, thunderIn: Infinity, thunder01: 0, last: { t: -1e9, x: 0, y: 1, z: 0, distance: 1e9 } } },
    cover,
    groundHeight: 0,          // m above the body's base radius, under the focus
  };
  // Small weather near the focus, refreshed by update(): dust devils (features.js).
  const features = { devils };
  const stats = { ms: 0, msAvg: 0, msMax: 0, msGround: 0, msAir: 0, msWeather: 0, msFlora: 0, msParticles: 0, samples: 0, particles: 0, pushCells: 0, frames: 0, reanchors: 0 };
  const _dirv = { x: 0, y: 0, z: 0 };
  const _d3 = new Float64Array(3);
  const _g = {}, _g2 = {}, _cov = {}, _menv = {}, _m2 = {}, _wenv = {};
  let sampleBody = 'earth';
  const sampleActive = (dir) => sampleSurface(sampleBody, dir);

  // what the near terrain grid keeps per node: the dry contact numbers of the ground there
  function groundInto(surface, arr, o) {
    groundAt(sampleBody, surface, null, _g2);
    arr[o] = _g2.sink; arr[o + 1] = _g2.imprint; arr[o + 2] = _g2.dust; arr[o + 3] = _g2.repose;
    arr[o + 4] = _g2.friction; arr[o + 5] = _g2.kinetic; arr[o + 6] = _g2.z0; arr[o + 7] = _g2.liquidDepth;
  }
  const _gn = { sink: 0.015, imprint: 0.5, h: 0 };
  function groundOfGrid(x, z, o) {
    const n = near.nearest(x, z);
    if (n < 0) { o.sink = 0.015; o.imprint = 0.5; o.loose = 0; o.dust = 0; o.h = here.groundHeight + BODIES[active].radius - frame.r0; return o; }
    const c = near.cover, a = n * 8;
    // snow on the ground deepens the print and keeps it
    const snow = moist.snowDepth;
    o.sink = Math.max(c[a], Math.min(snow * 0.8, GROUND.snowSinkMax)) * (c[a + 7] > 0.05 ? 0 : 1);
    o.imprint = snow > GROUND.snowCover ? 1 : c[a + 1];
    // loose: granular ground that piles into rims and can be scoured (sand, dust, gravel, snow)
    o.loose = snow > GROUND.snowCover ? 1 : (c[a + 3] > 0 ? 1 : 0) * (1 - Math.min(1, moist.wetness01 * 1.5));
    o.dust = c[a + 2];
    o.h = near.heightAt(x, z, near.h[n]);
    return o;
  }

  function sun01At(bodyId, ux, uy, uz) {
    return sunDir && bodyId === active ? ux * sunDir.x + uy * sunDir.y + uz * sunDir.z : null;
  }

  // ---- per frame ----------------------------------------------------------------------------
  function update(dt, f) {
    const t0 = now();
    if (!(dt >= 0)) dt = 0;
    if (dt > 0.25) dt = 0.25;
    if (f && typeof f.time === 'number' && f.time === f.time) time = f.time; else time += dt;
    const bodyId = f && f.bodyId && BODIES[f.bodyId] ? f.bodyId : null;
    const fp = f && f.focus;
    if (!bodyId || !fp || !(fp.x === fp.x && fp.y === fp.y && fp.z === fp.z) || Math.hypot(fp.x, fp.y, fp.z) < 1) {
      // deep space, or nothing to centre on: the near field sleeps
      if (active) { particles.clear(); devils.count = 0; active = null; here.bodyId = null; }
      stats.ms = now() - t0; return;
    }
    focus.x = fp.x; focus.y = fp.y; focus.z = fp.z;
    sunDir = f.sunDir && f.sunDir.x === f.sunDir.x ? f.sunDir : null;
    sampleBody = bodyId;
    const body = BODIES[bodyId];
    // (re)anchor the near field
    let fx = frame.lx(fp.x, fp.y, fp.z), fz = frame.lz(fp.x, fp.y, fp.z);
    const rf = Math.hypot(fp.x, fp.y, fp.z);
    if (active !== bodyId || frame.bodyId !== bodyId || Math.hypot(fx, fz) > QUALITY.reanchor * 3) {
      // a new body, or a jump: start afresh under the focus
      frame.anchor(bodyId, fp.x, fp.y, fp.z);
      fx = 0; fz = 0; lastMoist = -1e9; stats.reanchors++;
      liqScan = 0; liqLevel = -1e9; liqDepth = 0;
    } else if (Math.hypot(fx, fz) > QUALITY.reanchor) {
      // wandered far from the anchor: move the anchor to the nearest point of the 16 m lattice
      // that every grid shares, and carry all the fields over (nothing is dropped or re-sampled)
      const X = Math.round(fx / 16) * 16, Z = Math.round(fz / 16) * 16;
      frame.dir(X, Z, _d3);
      const r0 = frame.r0;
      frame.anchor(bodyId, _d3[0] * rf, _d3[1] * rf, _d3[2] * rf);
      const dr = r0 - frame.r0;
      near.rebase(frame, X, Z, dr); airGrid.terrain.rebase(frame, X, Z, dr);
      flora.rebase(frame, X, Z); particles.rebase(frame, X, Z, dr); deform.rebase(frame, X, Z); water.rebase(frame, X, Z);
      if (liqLevel > -1e8) liqLevel += dr;
      fx = frame.lx(fp.x, fp.y, fp.z); fz = frame.lz(fp.x, fp.y, fp.z);
      moistX -= X; moistZ -= Z; stats.reanchors++;
    }
    active = bodyId; here.bodyId = bodyId;
    const r = rf;
    const ux = fp.x / r, uy = fp.y / r, uz = fp.z / r;

    // the ground: a few samples per frame, nearest the focus first
    let budget = QUALITY.samples[quality];
    const bn = near.invalid > near.N * near.N * 0.5 || near.frameVersion !== frame.version ? QUALITY.burst : 1;
    const ba = airGrid.terrain.invalid > airGrid.N * airGrid.N * 0.5 || airGrid.terrain.frameVersion !== frame.version ? QUALITY.burst : 1;
    // (a slow surface is rationed by time as well: at most QUALITY.sampleMs per grid per frame)
    const clock = timeBudget && !warming ? now : null;
    if (warming) budget = 64;
    let used = near.update(frame, fx, fz, sampleActive, Math.ceil(budget * 0.5) * bn, groundInto, clock, QUALITY.sampleMs);
    const t1 = now();
    used += airGrid.update(frame, bodyId, time, fx, fz, sampleActive, Math.ceil(budget * 0.5) * ba, clock, QUALITY.sampleMs);
    const t2 = now();
    stats.samples = used; stats.msGround = t1 - t0; stats.msAir = t2 - t1;

    // where we are
    const coverKnown = airGrid.coverNear(fx, fz, cover);
    let gh = near.heightAt(fx, fz, NaN);
    if (gh !== gh) gh = airGrid.terrain.heightAt(fx, fz, NaN);
    if (gh !== gh) gh = r - frame.r0;
    here.groundHeight = frame.r0 + gh - body.radius;
    const fy = r - frame.r0;
    const sun01 = sun01At(bodyId, ux, uy, uz);
    // dust devils near the focus (a few hashes; nothing on bodies that have none)
    _denv.dustSource = cover.dustSource * (1 - Math.min(1, moist.wetness01 * 3)) * (moist.snowDepth > 0.02 ? 0 : 1);
    _denv.sun01 = sun01; _denv.wind = Math.hypot(airGrid.cwe, airGrid.cwn); _denv.storm01 = here.weather.storm01 || 0;
    _denv.rho = airDensity(bodyId, r - body.radius);
    devilsNear(bodyId, fp.x, fp.y, fp.z, time, seed, _denv, frame, devils);
    features.devils = devils;
    airAt(bodyId, fp.x, fp.y, fp.z, time, seed, airGrid, frame, sunDir, Math.max(2, fy - gh), here.air, devils);
    _wenv.moist = cover.moist; _wenv.fog = cover.fog; _wenv.snowBase = cover.snowBase; _wenv.dT = cover.dT; _wenv.dustSource = cover.dustSource;
    _wenv.sun01 = sun01; _wenv.wind = Math.hypot(airGrid.cwe, airGrid.cwn);
    weatherAt(bodyId, ux, uy, uz, r - body.radius, time, seed, _wenv, here.weather);
    if (time - lastMoist > QUALITY.moistureEvery || time < lastMoist || Math.hypot(fx - moistX, fz - moistZ) > 15) {
      lastMoist = time; moistX = fx; moistZ = fz;
      _menv.moist = cover.moist; _menv.snowBase = cover.snowBase; _menv.T = here.weather.temperature;
      _menv.Tmean = airTemperature(bodyId, r - body.radius, uy, null) + cover.dT;
      _menv.wind = _wenv.wind; _menv.sun01 = sun01;
      moistureAt(bodyId, ux, uy, uz, time, seed, _menv, moist);
    }
    here.weather.wetness01 = moist.wetness01; here.weather.snowDepth = moist.snowDepth;

    // fields and particles
    const t3 = now();
    const dist = f.disturbers || null;
    flora.update(dt, frame, airGrid, near, here.air.density, fx, fz, dist, quality, devils);
    const t4 = now();
    // the hull keeps the rain off what is under it
    { let ns = 0; const SH = particles.shelters;
      if (dist) for (let k = 0; k < dist.length && ns < 4; k++) { const D = dist[k]; if (D.kind !== 'ship' || !D.p) continue; const o = ns * 4; SH[o] = frame.lx(D.p.x, D.p.y, D.p.z); SH[o + 1] = frame.lz(D.p.x, D.p.y, D.p.z); SH[o + 2] = Math.hypot(D.p.x, D.p.y, D.p.z) - frame.r0 + 2.2; SH[o + 3] = (D.radius || 4.2) * 0.85; ns++; }
      particles.shelterCount = ns; }
    particles.update(dt, frame, airGrid, near, fx, fy, fz, gh, here.weather, here.air.density, cover, bodyId, body.gravity, time);
    loose.update(dt, frame, airGrid, near, fx, fy, fz, gh, here.weather, here.air.density, cover, bodyId, body.gravity, time, dist, here.air.turbulence, moist.wetness01, moist.snowDepth, devils);
    // what is filling the marks in: falling snow (m of depth per second) and blowing sand
    const pr = here.weather.precipitation;
    _fill.snow = pr.type === 'snow' || pr.type === 'ice' || pr.type === 'frost' ? pr.rate * pr.frozen01 * WEATHER.snowRatio * WEATHER.timeScale / 3.6e6 : 0;
    _fill.sand = loose.saltation01;
    deform.update(dt, frame, fx, fz, dist, groundOfGrid, body.gravity, time, _fill);
    // liquid near the focus (looked for a few times a second) and the waves the wind raises on it
    if (--liqScan <= 0) {
      liqScan = 20; liqLevel = -1e9; liqDepth = 0;
      const T = airGrid.terrain, lq = T.lq, hh = T.h, va = T.valid;
      // (the level of the highest liquid about, and the deepest water under it: the waves are
      // raised over the open water, not over the shallows the focus may be standing in)
      for (let n = 0; n < lq.length; n++) if (va[n] && lq[n] > -1e8) { if (lq[n] > liqLevel) liqLevel = lq[n]; if (lq[n] - hh[n] > liqDepth) liqDepth = lq[n] - hh[n]; }
      const l2 = near.liquidAt(fx, fz);
      if (l2 === l2 && l2 > -1e8) { liqLevel = l2; liqDepth = Math.max(liqDepth, l2 - gh); }
    }
    // (until the ground under the focus has been sampled, nothing is known about the liquid here)
    water.update(dt, frame, airGrid.cwe, airGrid.cwn, coverKnown ? liqLevel : -1e9, liqDepth, cover.fetch || 80, body.gravity, here.air.density, cover.liquidDensity || liquidOf(bodyId).density, fx, fz);
    stats.msWeather = t3 - t2; stats.msFlora = t4 - t3; stats.msParticles = now() - t4;

    let pc = 0;
    for (let k = 0; k < PARTICLES.kinds.length; k++) pc += particles.buffers[PARTICLES.kinds[k]].count;
    stats.particles = pc;
    stats.pushCells = flora.active;
    stats.frames++;
    stats.ms = now() - t0;
    stats.msAvg += (stats.ms - stats.msAvg) * 0.05;
    if (stats.frames > 120 && stats.ms > stats.msMax) stats.msMax = stats.ms;      // worst frame after warm-up
  }

  // Call once while loading (after the world can be sampled): fills the ground caches under the
  // focus and lets the JavaScript engine compile the hot loops, so the first played frame is
  // already inside the budget. Takes a frame like update(); returns the milliseconds it took.
  function warmUp(f, maxMs = 60) {
    const t0 = now();
    warming = true;
    for (let i = 0; i < 400; i++) {
      update(0, f);
      if (i >= 40 && near.invalid === 0 && airGrid.terrain.invalid === 0) break;
      if (now() - t0 > maxMs && i >= 8) break;
    }
    warming = false;
    stats.frames = 0; stats.msMax = 0;
    return now() - t0;
  }

  // ---- environment queries ----------------------------------------------------------------------
  // The air at body-local point p. `height` (m above the ground) is optional: pass it when you
  // know it (the explorer and the ship do).
  function air(bodyId, p, out, height) {
    return airAt(bodyId, p.x, p.y, p.z, time, seed, bodyId === active ? airGrid : null, frame, bodyId === active ? sunDir : null, height, out || {}, bodyId === active ? devils : null);
  }

  function nearFocus(bodyId, ux, uy, uz, metres) {
    if (bodyId !== active) return false;
    const r = Math.hypot(focus.x, focus.y, focus.z) || 1;
    const d = ux * focus.x / r + uy * focus.y / r + uz * focus.z / r;
    return (1 - d) * 2 * r * r < metres * metres;
  }

  // The weather at body-local point p (any body, any time through opts.time).
  function weather(bodyId, p, out, opts) {
    const o = out || {};
    const r = Math.hypot(p.x, p.y, p.z) || 1;
    const ux = p.x / r, uy = p.y / r, uz = p.z / r;
    const t = opts && opts.time != null ? opts.time : time;
    const body = BODIES[bodyId];
    const local = nearFocus(bodyId, ux, uy, uz, 120) && t === time;
    let cv = null;
    if (local) cv = cover;
    else if (opts && opts.surface) cv = coverAt(bodyId, opts.surface, _cov);
    const sun01 = sun01At(bodyId, ux, uy, uz);
    const env = {};
    if (cv) { env.moist = cv.moist; env.fog = cv.fog; env.snowBase = cv.snowBase; env.dT = cv.dT; env.dustSource = cv.dustSource; }
    env.sun01 = sun01;
    env.wind = local ? Math.hypot(airGrid.cwe, airGrid.cwn) : (WINDS[bodyId] ? WINDS[bodyId].U : 0);
    weatherAt(bodyId, ux, uy, uz, r - body.radius, t, seed, env, o);
    if (local && nearFocus(bodyId, ux, uy, uz, 40)) { o.wetness01 = moist.wetness01; o.snowDepth = moist.snowDepth; }
    else {
      env.T = o.temperature; env.Tmean = airTemperature(bodyId, r - body.radius, uy, null) + (cv ? cv.dT : 0);
      moistureAt(bodyId, ux, uy, uz, t, seed, env, _m2);
      o.wetness01 = _m2.wetness01; o.snowDepth = _m2.snowDepth;
    }
    return o;
  }

  // Contact properties of the ground. Give either a unit direction (one sampleSurface call is
  // made) or a surface sample you already have (none is made).
  function ground(bodyId, unitDir, out, surface) {
    const o = out || {};
    let s = surface;
    if (!s) { _dirv.x = unitDir.x; _dirv.y = unitDir.y; _dirv.z = unitDir.z; s = sampleSurface(bodyId, _dirv); }
    const st = _g;
    const body = BODIES[bodyId];
    if (bodyId === active && (!unitDir || nearFocus(bodyId, unitDir.x, unitDir.y, unitDir.z, 60))) {
      st.wetness01 = moist.wetness01; st.snowDepth = moist.snowDepth;
      // temperature at this ground: the focus air temperature, corrected for the height difference
      st.temperature = here.weather.temperature - ATMOSPHERES[bodyId].lapse * ((s.radius - body.radius) - here.groundHeight);
    } else if (unitDir) {
      const l = Math.hypot(unitDir.x, unitDir.y, unitDir.z) || 1;
      const ux = unitDir.x / l, uy = unitDir.y / l, uz = unitDir.z / l;
      coverAt(bodyId, s, _cov);
      const env = { moist: _cov.moist, snowBase: _cov.snowBase, wind: WINDS[bodyId] ? WINDS[bodyId].U : 0, sun01: null };
      env.Tmean = airTemperature(bodyId, s.radius - body.radius, uy, null) + _cov.dT;
      env.T = env.Tmean;
      moistureAt(bodyId, ux, uy, uz, time, seed, env, _m2);
      st.wetness01 = _m2.wetness01; st.snowDepth = _m2.snowDepth; st.temperature = env.T;
    } else { st.wetness01 = 0; st.snowDepth = 0; st.temperature = ATMOSPHERES[bodyId].T0; }
    return groundAt(bodyId, s, st, o);
  }

  // The liquid surface at body-local point p: its waves. Near the focus this is the simulated
  // sea state (the same three wave trains PAINTER draws); elsewhere an estimate from the wind.
  //   -> { present, height (elevation at p now, m), significant (m), period (s), length (m),
  //        speed (m/s), steepness, whitecap01, dir {x,y,z} (body-local, the way the waves run) }
  const _ws = {}, _wa = { wind: { x: 0, y: 0, z: 0 } };
  function waterAt(bodyId, p, out) {
    const o = out || {};
    const dir = o.dir || (o.dir = { x: 0, y: 0, z: 0 });
    if (bodyId === active && airGrid.inside(frame.lx(p.x, p.y, p.z), frame.lz(p.x, p.y, p.z))) {
      o.present = water.present;
      o.height = water.present ? water.heightAt(frame.lx(p.x, p.y, p.z), frame.lz(p.x, p.y, p.z)) : 0;
      o.significant = water.height; o.period = water.period; o.length = water.length; o.speed = water.speed;
      o.steepness = water.steepness; o.whitecap01 = water.whitecap01;
      dir.x = frame.ex * water.dir[0] + frame.nx * water.dir[1]; dir.y = frame.ey * water.dir[0] + frame.ny * water.dir[1]; dir.z = frame.ez * water.dir[0] + frame.nz * water.dir[1];
    } else {
      const a = air(bodyId, p, _wa, 10), body = BODIES[bodyId];
      windSea(a.speed, FETCH_DEFAULT, body.gravity, a.density, liquidOf(bodyId).density, 1e9, _ws);
      o.present = true; o.height = 0; o.significant = _ws.height; o.period = _ws.period; o.length = _ws.length; o.speed = _ws.speed;
      o.steepness = _ws.steepness; o.whitecap01 = _ws.whitecap01;
      const s = a.speed > 1e-6 ? 1 / a.speed : 0; dir.x = a.wind.x * s; dir.y = a.wind.y * s; dir.z = a.wind.z * s;
    }
    return o;
  }

  // Add physics to an env object for the explorer or ship step functions:
  //   env.air(p, out, height), env.ground(surface, out), env.liquid, and gravity / radius if missing.
  // With no body (deep space) the env is returned as it is: no air, no gravity.
  function bindEnv(bodyId, env = {}) {
    const body = BODIES[bodyId];
    if (!body) { env.air = undefined; env.ground = undefined; return env; }
    env.air = (p, out, height) => air(bodyId, p, out, height);
    env.ground = (surface, out) => ground(bodyId, null, out, surface);
    env.liquid = liquidOf(bodyId);
    env.liquidOf = (surface) => liquidAt(bodyId, surface);
    if (env.gravity == null) env.gravity = body.gravity;
    if (env.radius == null) env.radius = body.radius;
    return env;
  }

  // Disturbers for physics.update from PILOT's states. Appends to `out` (clear it each frame with
  // out.length = 0); the entries are four objects owned by physics and reused, so nothing is
  // allocated per frame.
  const _dEx = { kind: 'explorer', p: null, v: null, radius: EXPLORER_BODY.radius, strength: 1, grounded: true, kick: undefined, impact: 0 };
  const _dJet = { kind: 'jet', p: null, v: null, radius: 0.15, strength: 0 };
  const _dShip = { kind: 'ship', p: null, v: null, radius: 4.2, strength: 1, q: null, legContact: null };
  const _dWash = { kind: 'downwash', p: null, v: null, radius: 2.2, strength: 0 };
  function explorerDisturbers(st, out = []) {
    const B = st.phys;
    _dEx.p = st.p; _dEx.v = st.v; _dEx.grounded = !!st.grounded;
    _dEx.kick = B ? B.dust : undefined; _dEx.impact = B ? B.puff : 0;
    out.push(_dEx);
    if (B && B.jetThrottle > 0.02) { _dJet.p = st.p; _dJet.v = st.v; _dJet.strength = EXPLORER_BODY.jetThrust * B.jetThrottle; out.push(_dJet); }
    return out;
  }
  function shipDisturbers(st, out = []) {
    const B = st.phys;
    _dShip.p = st.p; _dShip.v = st.v; _dShip.q = st.q || null;
    _dShip.legContact = B && B.contacts != null && (B.contacts > 0 || B.asleep || B.lift01 < 1) ? B.legContact : null;
    out.push(_dShip);
    if (B && B.downwash && B.downwash.thrust > 50) { _dWash.p = st.p; _dWash.v = st.v; _dWash.radius = B.downwash.radius; _dWash.strength = B.downwash.thrust; out.push(_dWash); }
    return out;
  }

  const fields = {
    frame,                    // the LocalFrame all near fields share (anchor and axes, body-local)
    flora: {
      // textures (RGBA float32, N x N, row j = north index, column i = east index)
      get bend() { return flora.bend; }, get wind() { return flora.wind; }, get push() { return flora.push; },
      size: FLORA.N, cell: FLORA.cell, nearSize: FLORA.nearN, nearCell: FLORA.nearCell,
      uniforms: flora.uniforms,
      get version() { return flora.version; }, get pushVersion() { return flora.pushVersion; },
      // CPU twin of the shader: bend of a plant rooted at body-local point p
      plantBend(p, stiff01, out) { return flora.plantBend(frame.lx(p.x, p.y, p.z), frame.lz(p.x, p.y, p.z), stiff01, out); },
      plantBendLite(p, stiff01, out) { return flora.plantBendLite(frame.lx(p.x, p.y, p.z), frame.lz(p.x, p.y, p.z), stiff01, out); },
      plantDisplace,
      field: flora,
    },
    deform: {
      get depth() { return deform.depth; }, size: DEFORM.N, cell: DEFORM.cell,
      marks: deform.marks, uniforms: deform.uniforms,
      get version() { return deform.version; },
      depthAt(p) { return deform.depthAt(frame.lx(p.x, p.y, p.z), frame.lz(p.x, p.y, p.z)); },
      field: deform,
    },
    water: {
      uniforms: water.uniforms,   // uPhysWaterDir[2], uPhysWaterK[3], uPhysWaterAmp[3], uPhysWaterPhase[3]
      heightAt(p) { return water.present ? water.heightAt(frame.lx(p.x, p.y, p.z), frame.lz(p.x, p.y, p.z)) : 0; },
      field: water,
    },
    air: airGrid,             // the wind grid itself (for the lab and for debugging)
    near,
  };

  return {
    version: PHYSICS_VERSION,
    seed,
    update,
    warmUp,
    setQuality(q) { quality = q <= 0 ? 0 : q >= 2 ? 2 : 1; particles.setQuality(quality); },
    get quality() { return quality; },
    // How far a body's real prevailing wind is scaled down for play (data.WINDS[body].scale).
    setWindScale,
    get time() { return time; },
    air, weather, ground, bindEnv,
    water: waterAt,
    here,                     // air, weather and cover at the focus, refreshed by update()
    focus,                    // {x,y,z} body-local: the focus of the last update (read-only)
    features,                 // { devils: [...] with .count }: dust devils near the focus
    explorer: { step: stepExplorerBody, tuning: EXPLORER_BODY, disturbers: explorerDisturbers, jumpSpeed: jumpSpeedFor, terminal: explorerTerminal, sustainableSpeed },
    ship: {
      step: stepShipBody, gear: stepShipGear, wake: wakeShip, tuning: SHIP_BODY, disturbers: shipDisturbers,
      topSpeed: shipTopSpeed, terminal: shipTerminal, downwashSpeed, groundEffect, gearSag,
      planSpeedChange, sampleSpeedChange, pulseBrakeDistance, stepPulse,
    },
    fields,
    particles: Object.assign({ events: particles.events, system: particles }, particles.buffers),
    glsl: { flora: FLORA_GLSL, water: WATER_GLSL },
    // reference data
    data: { ATMOSPHERES, WINDS, REGIMES, MATERIALS, BIOMES, SPECIES },
    util: {
      airDensity, airTemperature, gravityAt, fallSpeed, terminalVelocity, bluntTerminal, liquidOf, liquidAt, BIOME_LIQUID, cellsAt: (bodyId, t) => cellsAt(bodyId, t == null ? time : t, seed),
      saltationThreshold, holdAngle, iceFriction, treeFrequency, stemFrequency, PlantSim,
    },
    stats,
  };
}

export {
  // step functions and tuning tables, for PILOT's pure modules and tests
  stepExplorerBody, EXPLORER_BODY, jumpSpeedFor, explorerTerminal, sustainableSpeed,
  stepShipBody, stepShipGear, wakeShip, SHIP_BODY, shipTopSpeed, shipTerminal, downwashSpeed, groundEffect, gearSag,
  planSpeedChange, sampleSpeedChange, pulseBrakeDistance, stepPulse,
  FLORA_GLSL, WATER_GLSL, WATER, windSea, fetchOf, FLORA, PARTICLES, EVENT, DEFORM, MARK, MARK_STRIDE, WEATHER, WIND, AIR, GROUND, DEFAULT_SEED, LOOSE, KICK, DEVILS,
};
