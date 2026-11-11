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
import { groundAt, coverAt, MATERIALS, BIOMES, GROUND, holdAngle, iceFriction } from './ground.js';
import { LocalFrame, TerrainGrid } from './near.js';
import { AirGrid, airAt, AIR } from './air.js';
import { FloraField, FLORA, PlantSim, plantDisplace, treeFrequency, stemFrequency } from './flora.js';
import { FLORA_GLSL } from './flora.glsl.js';
import { Particles, PARTICLES, EVENT } from './particles.js';
import { DeformField, DEFORM, MARK, MARK_STRIDE } from './deform.js';
import { stepExplorerBody, EXPLORER_BODY, jumpSpeedFor, explorerTerminal, sustainableSpeed } from './explorer.js';
import {
  stepShipBody, stepShipGear, wakeShip, SHIP_BODY, shipTopSpeed, shipTerminal, downwashSpeed, groundEffect, gearSag,
  planSpeedChange, sampleSpeedChange, pulseBrakeDistance, stepPulse,
} from './ship.js';

export const PHYSICS_VERSION = 1;

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
  const deform = new DeformField();

  let quality = 1;
  let warming = false;
  let active = null;            // body the near field is on, or null
  let time = 0;
  let sunDir = null;
  let lastMoist = -1e9, moistX = 1e9, moistZ = 1e9;
  const focus = { x: 0, y: 1, z: 0 };
  const moist = { wetness01: 0, snowDepth: 0, freshSnow: 0 };
  const cover = { z0: 0.03, canopy01: 0, canopyHeight: 0, moist: 1, fog: 0.2, dustSource: 0.1, dT: 0, snowBase: 0 };
  const here = {
    bodyId: null,
    air: { density: 0, wind: { x: 0, y: 0, z: 0 }, speed: 0, gust01: 0, turbulence: 0, temperature: 0, pressure: 0, soundSpeed: 0, viscosity: 0, altitude: 0, height: 0, near: false },
    weather: { kind: 'clear', intensity01: 0, precipitation: { type: 'none', rate: 0, intensity01: 0, fallSpeed: 0, dropSize: 0, species: null, reachesGround01: 1, frozen01: 0, hail01: 0 }, wetness01: 0, snowDepth: 0, visibility01: 1, visibility: WEATHER.clearVisibility, cloud01: 0, fog01: 0, dust01: 0, haze01: 0, storm01: 0, front01: 0, windFactor: 1, temperature: 0, lightning: { rate: 0, flash01: 0, nextIn: Infinity, thunderIn: Infinity, thunder01: 0, last: { t: -1e9, x: 0, y: 1, z: 0, distance: 1e9 } } },
    cover,
    groundHeight: 0,          // m above the body's base radius, under the focus
  };
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
    if (n < 0) { o.sink = 0.015; o.imprint = 0.5; o.h = here.groundHeight + BODIES[active].radius - frame.r0; return o; }
    const c = near.cover, a = n * 8;
    // snow on the ground deepens the print and keeps it
    const snow = moist.snowDepth;
    o.sink = Math.max(c[a], Math.min(snow * 0.8, GROUND.snowSinkMax)) * (c[a + 7] > 0.05 ? 0 : 1);
    o.imprint = snow > GROUND.snowCover ? 1 : c[a + 1];
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
      if (active) { particles.clear(); active = null; here.bodyId = null; }
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
    } else if (Math.hypot(fx, fz) > QUALITY.reanchor) {
      // wandered far from the anchor: move the anchor to the nearest point of the 16 m lattice
      // that every grid shares, and carry all the fields over (nothing is dropped or re-sampled)
      const X = Math.round(fx / 16) * 16, Z = Math.round(fz / 16) * 16;
      frame.dir(X, Z, _d3);
      const r0 = frame.r0;
      frame.anchor(bodyId, _d3[0] * rf, _d3[1] * rf, _d3[2] * rf);
      const dr = r0 - frame.r0;
      near.rebase(frame, X, Z, dr); airGrid.terrain.rebase(frame, X, Z, dr);
      flora.rebase(frame, X, Z); particles.rebase(frame, X, Z, dr); deform.rebase(frame, X, Z);
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
    airGrid.coverNear(fx, fz, cover);
    let gh = near.heightAt(fx, fz, NaN);
    if (gh !== gh) gh = airGrid.terrain.heightAt(fx, fz, NaN);
    if (gh !== gh) gh = r - frame.r0;
    here.groundHeight = frame.r0 + gh - body.radius;
    const fy = r - frame.r0;
    airAt(bodyId, fp.x, fp.y, fp.z, time, seed, airGrid, frame, sunDir, Math.max(2, fy - gh), here.air);
    const sun01 = sun01At(bodyId, ux, uy, uz);
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
    flora.update(dt, frame, airGrid, near, here.air.density, fx, fz, dist, quality);
    const t4 = now();
    particles.update(dt, frame, airGrid, near, fx, fy, fz, gh, here.weather, here.air.density, cover, bodyId, body.gravity, time);
    deform.update(dt, frame, fx, fz, dist, groundOfGrid, body.gravity, time);
    stats.msWeather = t3 - t2; stats.msFlora = t4 - t3; stats.msParticles = now() - t4;

    stats.particles = particles.buffers.rain.count + particles.buffers.snow.count;
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
    return airAt(bodyId, p.x, p.y, p.z, time, seed, bodyId === active ? airGrid : null, frame, bodyId === active ? sunDir : null, height, out || {});
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

  // Add physics to an env object for the explorer or ship step functions:
  //   env.air(p, out, height), env.ground(surface, out), env.liquid, and gravity / radius if missing.
  // With no body (deep space) the env is returned as it is: no air, no gravity.
  function bindEnv(bodyId, env = {}) {
    const body = BODIES[bodyId];
    if (!body) { env.air = undefined; env.ground = undefined; return env; }
    env.air = (p, out, height) => air(bodyId, p, out, height);
    env.ground = (surface, out) => ground(bodyId, null, out, surface);
    env.liquid = liquidOf(bodyId);
    if (env.gravity == null) env.gravity = body.gravity;
    if (env.radius == null) env.radius = body.radius;
    return env;
  }

  // Disturbers for physics.update from PILOT's states (reuses the objects in `out`).
  function explorerDisturbers(st, out = []) {
    const B = st.phys;
    out.push({ kind: 'explorer', p: st.p, v: st.v, radius: EXPLORER_BODY.radius, strength: 1, grounded: !!st.grounded });
    if (B && B.jetThrottle > 0.02) out.push({ kind: 'jet', p: st.p, v: st.v, radius: 0.15, strength: EXPLORER_BODY.jetThrust * B.jetThrottle });
    return out;
  }
  function shipDisturbers(st, out = []) {
    const B = st.phys;
    out.push({ kind: 'ship', p: st.p, v: st.v, radius: 4.2, strength: 1 });
    if (B && B.downwash.thrust > 50) out.push({ kind: 'downwash', p: st.p, v: st.v, radius: B.downwash.radius, strength: B.downwash.thrust });
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
    here,                     // air, weather and cover at the focus, refreshed by update()
    explorer: { step: stepExplorerBody, tuning: EXPLORER_BODY, disturbers: explorerDisturbers, jumpSpeed: jumpSpeedFor, terminal: explorerTerminal, sustainableSpeed },
    ship: {
      step: stepShipBody, gear: stepShipGear, wake: wakeShip, tuning: SHIP_BODY, disturbers: shipDisturbers,
      topSpeed: shipTopSpeed, terminal: shipTerminal, downwashSpeed, groundEffect, gearSag,
      planSpeedChange, sampleSpeedChange, pulseBrakeDistance, stepPulse,
    },
    fields,
    particles: Object.assign({ events: particles.events, system: particles }, particles.buffers),
    glsl: { flora: FLORA_GLSL },
    // reference data
    data: { ATMOSPHERES, WINDS, REGIMES, MATERIALS, BIOMES, SPECIES },
    util: {
      airDensity, airTemperature, gravityAt, fallSpeed, terminalVelocity, bluntTerminal, liquidOf, cellsAt: (bodyId, t) => cellsAt(bodyId, t == null ? time : t, seed),
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
  FLORA_GLSL, FLORA, PARTICLES, EVENT, DEFORM, MARK, MARK_STRIDE, WEATHER, WIND, AIR, GROUND, DEFAULT_SEED,
};
