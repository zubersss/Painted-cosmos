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
import { WINDS, WIND, setWindScale, windLarge } from './wind.js';
import { weatherAt, moistureAt, cellsAt, DEFAULT_SEED, WEATHER, REGIMES, saltationThreshold } from './weather.js';
import { liquidAt, BIOME_LIQUID, groundAt, coverAt, MATERIALS, MATERIAL_IDS, MATERIAL_INDEX, MATERIAL_NONE, materialNow, BIOMES, GROUND, holdAngle, iceFriction } from './ground.js';
import { LocalFrame, TerrainGrid } from './near.js';
import { AirGrid, airAt, AIR } from './air.js';
import { FloraField, FLORA, PlantSim, plantDisplace, plantBranch, plantCrown, treeFrequency, stemFrequency } from './flora.js';
import { FLORA_GLSL } from './flora.glsl.js';
import { Particles, PARTICLES, EVENT } from './particles.js';
import { Loose, LOOSE, KICK } from './loose.js';
import { devilsNear, DEVILS } from './features.js';
import { skyNumbers, SKY } from './sky.js';
import { DriftField, DRIFT, snowTransport01 } from './drift.js';
import { clamp01, smoothstep } from './util.js';
import { WaterField, WATER_GLSL, WATER, windSea, fetchOf, wakeLength, foamCover, surf01, FetchGauge, FETCH_GAUGE, SEA_TEX } from './water.js';
import { SeaMap, SEA_MAP, FetchRose } from './seamap.js';
import { DeformField, DEFORM, MARK, MARK_STRIDE } from './deform.js';
import { stepExplorerBody, EXPLORER_BODY, jumpSpeedFor, explorerTerminal, sustainableSpeed, gaitOf, strideBob } from './explorer.js';
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
  // (P20) ...and no more than lets a ground point 30 m out move further in a re-anchor than it does on Earth. A re-anchor
  // carries every grid over by whole cells, which is exact at the new anchor only: a point s m beyond it lands about
  // D s (D + s) / R^2 off (D the distance moved). On Earth's 4 km at 384 m that is 0.30 m 30 m out; on the Moon's 1.4 km
  // the same 384 m made it 2.4 m (0.8 m 10 m out: a trail in the dust jumped). Now D (D + 30) / R^2 <= reanchorShift on
  // every world (reanchorAt): the Moon 125 m, Pluto 145, Mercury 205, Mars 284, Venus 344; Earth and the giants 384 as
  // before. Points (particles, the wakes) are carried exactly whatever D is (near.js LocalFrame.carry).
  reanchorShift: 0.00994,
  // (P20) ...and the anchor keeps its radius through a re-anchor unless the focus has left this share of the world's radius
  // about it: the grid's metres are metres at the anchor's radius, so a new radius rescales every grid by r0' / r0 about
  // the anchor (a point s m out moves s dr / r0: on the Moon's crater fields the anchor's radius changed by up to 54 m in
  // one re-anchor, 1.2 m 30 m out). Within the band a re-anchor rescales nothing; a grid metre is then within 2 % of a
  // metre on the ground.
  reanchorBand: 0.02,
  moistureEvery: 0.25,        // s between refreshes of the wetness / snow integrals at the focus
});

// (P20) how far the focus may wander from the anchor on a world of radius R (m): QUALITY.reanchor, or less on a small world
export function reanchorAt(R) { return Math.min(QUALITY.reanchor, (Math.sqrt(900 + 4 * QUALITY.reanchorShift * R * R) - 30) / 2); }

const now = typeof performance !== 'undefined' && performance.now ? () => performance.now() : () => 0;

// options: sampleSurface (required), seed, timeBudget (default true: ration slow sampleSurface
// calls by time as well as by count; pass false for bit-exact repeatability, as the tests do).
export function createPhysics({ sampleSurface, seed = DEFAULT_SEED, timeBudget = true } = {}) {
  if (typeof sampleSurface !== 'function') throw new Error('createPhysics: sampleSurface(bodyId, unitDir) is required');
  const frame = new LocalFrame();
  const airGrid = new AirGrid(seed);
  const near = new TerrainGrid(17, 2, 10);      // 32 m of ground at 2 m, for particles, pushes and prints
  const flora = new FloraField();
  const particles = new Particles(seed, 1);
  const loose = new Loose(particles);
  const devils = []; devils.count = 0;
  const _denv = { dustSource: 0, sun01: null, wind: 0, storm01: 0, we: 0, wn: 0, rho: 0 };
  const deform = new DeformField(SHIP_BODY.legs);
  const drift = new DriftField();
  const _dsh = new Float32Array(16);     // landed hulls, as obstacles the wind drifts round
  let driftSnow = false;                 // what drifts here is snow (else the loose layer of sand or dust)
  const _fill = { snow: 0, sand: 0 };
  const water = new WaterField();
  const _wk = [];            // per-disturber wake state: where and when it last left a ring
  const _frame0 = { ox: 0, oy: 0, oz: 0, ex: 1, ey: 0, ez: 0, nx: 0, ny: 0, nz: 1 };   // (P20) the frame before a re-anchor
  let liqLevel = -1e9, liqDepth = 0, liqScan = 0;
  // (P16) the fetch measured upwind over the water there (water.js FetchGauge), from the water point: the focus where it
  // stands in water FETCH_GAUGE.minDepth deep, else the nearest node of the wind grid that is, else the deepest about
  // (P18) ... and since P18 the sea map (seamap.js): the sea raised at every node about over its own fetch and depth,
  // turned toward its longest fetch and refracted toward its shore; its far rose replaces the P16 gauge's five radials
  const seaMap = new SeaMap();
  const _sc = { frame, air: airGrid, bodyId: null, R: 1, level: -1e9, we: 0, wn: 0, g: 9.81, rhoAir: 1.2, rhoLiq: 1000, dir: null, swellHeight: 0, swellLength: 0, sample: null, budget: 0, clock: null, ms: 0, quality: 1, fx: 0, fz: 0, time: 0 };
  const _uf = new Float64Array(2), _loc = {};
  // the old gauge's numbers, from the map: the reference sea's fetch and depth, the far rose's radials (API: fields.water.gauge)
  const gauge = {
    get fetch() { return seaMap.target.on ? seaMap.target.refFetch : -1; }, get depth() { return seaMap.target.on ? seaMap.target.refDepth : 0; },
    get radial() { return Array.from(seaMap.rose.r); }, get ready() { return seaMap.target.on && seaMap.rose.ready; }, get final() { return seaMap.target.on; },
    samples: 0, get measured() { return seaMap.rose.measured; },
  };
  const wp = { ok: false, x: 0, y: 1, z: 0, depth: 0, cap: 80 };     // the far point the rose is measured from (unit dir)

  let quality = 1;
  let warming = false;
  let active = null;            // body the near field is on, or null
  let time = 0;
  let sunDir = null;
  let lastMoist = -1e9, moistX = 1e9, moistZ = 1e9;
  let fresh = 0, freshT = -1e9, freshBody = null; const freshP = { x: 0, y: 0, z: 0 };   // fresh snow at the focus, integrated as it falls
  const focus = { x: 0, y: 1, z: 0 };
  const focusPrev = { x: 0, y: 0, z: 0, ok: false }, focusV = { size: 0, vx: 0, vy: 0, vz: 0 };     // (P18) the focus's velocity, for here.air
  const _wl4 = new Float64Array(4);
  const moist = { wetness01: 0, snowDepth: 0, freshSnow: 0 };
  const cover = { z0: 0.03, canopy01: 0, canopyHeight: 0, moist: 1, fog: 0.2, dustSource: 0.1, dT: 0, snowBase: 0, leaves: 0, spores: 0, ash: 0, fetch: 80, liquidDensity: 0 };
  const here = {
    bodyId: null,
    air: { density: 0, wind: { x: 0, y: 0, z: 0 }, speed: 0, gust01: 0, veer: 0, turbulence: 0, temperature: 0, pressure: 0, soundSpeed: 0, viscosity: 0, altitude: 0, height: 0, near: false },
    weather: { kind: 'clear', intensity01: 0, precipitation: { type: 'none', rate: 0, intensity01: 0, fallSpeed: 0, dropSize: 0, species: null, reachesGround01: 1, frozen01: 0, hail01: 0, extinction: 0 }, dustExtinction: 0, wetness01: 0, snowDepth: 0, visibility01: 1, visibility: WEATHER.clearVisibility, cloud01: 0, fog01: 0, dust01: 0, haze01: 0, storm01: 0, front01: 0, windFactor: 1, temperature: 0, lightning: { rate: 0, flash01: 0, nextIn: Infinity, thunderIn: Infinity, thunder01: 0, last: { t: -1e9, x: 0, y: 1, z: 0, distance: 1e9 } } },
    cover,
    groundHeight: 0,          // m above the body's base radius, under the focus
    sky: skyNumbers(null, {}),  // the weather as eleven numbers 0..1 for a painter (sky.js), refreshed by update()
    // what the wind is raising near the focus right now, each 0..1 (P10; for the picture and for sound):
    // sand hopping in streamers, snow blowing along the ground (a ground blizzard at 1), spume torn off the
    // sea's breaking crests, surf on a shore within the particle box
    blown: { sand: 0, snow: 0, spume: 0, surf: 0, leaves: 0, litter: 0, leafStock01: 1 },   // (P15) leaves, litter: a second, torn off the crowns and lifted off the floor in the box; leafStock01: the loose leaves still on the trees
  };
  // Small weather near the focus, refreshed by update(): dust devils (features.js).
  const features = { devils };
  const stats = { ms: 0, msAvg: 0, msMax: 0, msGround: 0, msAir: 0, msWeather: 0, msFlora: 0, msParticles: 0, msFetch: 0, fetchSamples: 0, samples: 0, particles: 0, pushCells: 0, frames: 0, reanchors: 0 };
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
    arr[o + 8] = _g2.materialId; arr[o + 9] = _g2.mudding;       // which material, and how far rain turns it to mud
  }
  function groundOfGrid(x, z, o) {
    const n = near.nearest(x, z);
    if (n < 0) { o.sink = 0.015; o.imprint = 0.5; o.loose = 0; o.dust = 0; o.mat = MATERIAL_NONE; o.h = here.groundHeight + BODIES[active].radius - frame.r0; return o; }
    const c = near.cover, a = n * near.CW;
    // snow on the ground deepens the print and keeps it
    // (as deep as it lies HERE: more in a drift, none where the wind has scoured the ground bare)
    const dd = drift.depthAt(x, z);
    const snow = driftSnow ? Math.max(0, moist.snowDepth + dd) : moist.snowDepth;
    o.sink = Math.max(c[a], Math.min(snow * 0.8, GROUND.snowSinkMax)) * (c[a + 7] > 0.05 ? 0 : 1);
    if (!driftSnow && dd > 0) o.sink += Math.min(dd, 0.1) * 0.4;      // a tail of blown sand is softer than the bed it lies on
    o.imprint = snow > GROUND.snowCover ? 1 : c[a + 1];
    // loose: granular ground that piles into rims and can be scoured (sand, dust, gravel, snow)
    o.loose = snow > GROUND.snowCover ? 1 : (c[a + 3] > 0 ? 1 : 0) * (1 - Math.min(1, moist.wetness01 * 1.5));
    o.dust = c[a + 2];
    // what the mark is made in (its ink): snow once snow covers the ground, else the ground as it is now
    o.mat = snow > GROUND.snowCover ? MATERIAL_INDEX.snow : materialNow(c[a + 8], c[a + 9], Math.atan(Math.hypot(near.gx[n], near.gz[n])), moist.wetness01, snow, here.weather.temperature);
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
    const reach = reanchorAt(body ? body.radius : 4000);
    if (active !== bodyId || frame.bodyId !== bodyId || Math.hypot(fx, fz) > QUALITY.reanchor * 3) {
      // a new body, or a jump: start afresh under the focus
      frame.anchor(bodyId, fp.x, fp.y, fp.z);
      fx = 0; fz = 0; lastMoist = -1e9; stats.reanchors++;
      liqScan = 0; liqLevel = -1e9; liqDepth = 0; wp.ok = false; seaMap.reset();
    } else if (Math.hypot(fx, fz) > reach) {
      // wandered far from the anchor: move the anchor to the nearest point of the 16 m lattice
      // that every grid shares, and carry all the fields over (nothing is dropped or re-sampled)
      const X = Math.round(fx / 16) * 16, Z = Math.round(fz / 16) * 16;
      frame.dir(X, Z, _d3);
      const r0 = frame.r0, F0 = _frame0, band = QUALITY.reanchorBand * (body ? body.radius : 4000);
      F0.ox = frame.ox; F0.oy = frame.oy; F0.oz = frame.oz; F0.ex = frame.ex; F0.ey = frame.ey; F0.ez = frame.ez; F0.nx = frame.nx; F0.ny = frame.ny; F0.nz = frame.nz;
      // (P20) the anchor's radius: kept, unless the focus has left the band about it (then moved only to the band's edge)
      const ra = rf > r0 + band ? rf - band : rf < r0 - band ? rf + band : r0;
      frame.anchor(bodyId, _d3[0] * ra, _d3[1] * ra, _d3[2] * ra);
      const dr = r0 - frame.r0;
      near.rebase(frame, X, Z, dr); airGrid.terrain.rebase(frame, X, Z, dr);
      // (P20) what is a point is carried exactly (particles, and the wakes' last ring); grids shift by whole cells
      flora.rebase(frame, X, Z); particles.rebase(frame, X, Z, dr, F0); deform.rebase(frame, X, Z); drift.rebase(frame, X, Z); water.rebase(frame, X, Z); seaMap.rebase(X, Z);
      for (let k = 0; k < _wk.length; k++) if (_wk[k] && _wk[k].x < 1e8) { frame.carry(F0, _wk[k].x, _wk[k].z, _d3); _wk[k].x = _d3[0]; _wk[k].z = _d3[1]; }
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
    // (P18: felt by a point moving with the focus: the sub-second eddies it meets too often fade)
    if (dt > 0 && focusPrev.ok && Math.hypot(fp.x - focusPrev.x, fp.y - focusPrev.y, fp.z - focusPrev.z) < 100) { const k = 1 - Math.exp(-dt / 0.1); focusV.vx += ((fp.x - focusPrev.x) / dt - focusV.vx) * k; focusV.vy += ((fp.y - focusPrev.y) / dt - focusV.vy) * k; focusV.vz += ((fp.z - focusPrev.z) / dt - focusV.vz) * k; }
    else if (!(dt > 0 && focusPrev.ok)) { focusV.vx = 0; focusV.vy = 0; focusV.vz = 0; }
    focusPrev.x = fp.x; focusPrev.y = fp.y; focusPrev.z = fp.z; focusPrev.ok = true;
    airAt(bodyId, fp.x, fp.y, fp.z, time, seed, airGrid, frame, sunDir, Math.max(2, fy - gh), here.air, devils, focusV);
    _wenv.moist = cover.moist; _wenv.fog = cover.fog; _wenv.snowBase = cover.snowBase; _wenv.dT = cover.dT; _wenv.dustSource = cover.dustSource;
    // (the weather answers the large-scale wind here, not the gusty wind at the focus: fog does not come and go
    // with a three-second gust, and physics.weather() anywhere, any time, then says what physics.here says: P7)
    _wenv.sun01 = sun01; _wenv.wind = windLarge(bodyId, ux, uy, uz, time, seed, _wl4)[3]; _wenv.fetch = cover.fetch || 0;
    weatherAt(bodyId, ux, uy, uz, r - body.radius, time, seed, _wenv, here.weather);
    if (time - lastMoist > QUALITY.moistureEvery || time < lastMoist || Math.hypot(fx - moistX, fz - moistZ) > 15) {
      lastMoist = time; moistX = fx; moistZ = fz;
      _menv.moist = cover.moist; _menv.snowBase = cover.snowBase; _menv.T = here.weather.temperature;
      _menv.Tmean = airTemperature(bodyId, r - body.radius, uy, null) + cover.dT;
      _menv.wind = windLarge(bodyId, ux, uy, uz, time, seed, _wl4)[3]; _menv.sun01 = sun01;   // (the large-scale wind: what physics.weather() uses anywhere, so the two agree)
      moistureAt(bodyId, ux, uy, uz, time, seed, _menv, moist);
    }
    // Fresh snow at the focus is integrated as it falls (P7): dF/dt = what is falling - F / (the time fresh
    // snow stays fresh) - melt. The stateless estimate (moistureAt: a quadrature over the past) counts a
    // snow shower shorter than its slices too often or not at all, so by itself it rises under a clear sky;
    // here it only starts the integration (on arrival, after a jump in place or time) and from then on
    // the cover grows only while snow falls and goes steadily after. physics.here is the authority at
    // the focus; physics.weather(p, { time }) elsewhere is the estimate.
    {
      const ts = WEATHER.timeScale, pr = here.weather.precipitation, melt = REGIMES[bodyId] ? REGIMES[bodyId].melt : 1e9, T = here.weather.temperature;
      const jumped = !(freshT <= time && time - freshT < 5) || freshBody !== bodyId || Math.hypot(fp.x - freshP.x, fp.y - freshP.y, fp.z - freshP.z) > 200;
      if (jumped) fresh = moist.freshSnow;
      else {
        const hh = time - freshT;
        const fall = pr && pr.rate > 0 ? pr.rate * (pr.frozen01 || 0) * (pr.reachesGround01 == null ? 1 : pr.reachesGround01) * ts / 3600 * WEATHER.snowRatio / 1000 : 0;   // m of fresh snow a game second
        const meltPerS = T > melt ? WEATHER.meltRate * (T - melt) / 86400 * ts * WEATHER.snowRatio / 1000 : 0;
        fresh = Math.max(0, (fresh + (fall - meltPerS) * hh) * Math.exp(-hh / (WEATHER.snowLife / ts)));
      }
      freshT = time; freshBody = bodyId; freshP.x = fp.x; freshP.y = fp.y; freshP.z = fp.z;
      moist.freshSnow = fresh; moist.snowDepth = (moist.standing || 0) + fresh;
    }
    here.weather.wetness01 = moist.wetness01; here.weather.snowDepth = moist.snowDepth; here.weather.freshSnow = moist.freshSnow;

    // fields and particles
    const t3 = now();
    const dist = f.disturbers || null;
    flora.update(dt, frame, airGrid, near, here.air.density, fx, fz, dist, quality, devils);
    const t4 = now();
    skyNumbers(here.weather, here.sky);        // the weather as a painter needs it (sky.js)
    // the hull keeps the rain off what is under it
    { let ns = 0; const SH = particles.shelters;
      if (dist) for (let k = 0; k < dist.length && ns < 4; k++) { const D = dist[k]; if (D.kind !== 'ship' || !D.p) continue; const o = ns * 4; SH[o] = frame.lx(D.p.x, D.p.y, D.p.z); SH[o + 1] = frame.lz(D.p.x, D.p.y, D.p.z); SH[o + 2] = Math.hypot(D.p.x, D.p.y, D.p.z) - frame.r0 + 2.2; SH[o + 3] = (D.radius || 4.2) * 0.85; ns++; }
      particles.shelterCount = ns; }
    // the surface the weather meets under the focus: the ground, or the liquid standing over it
    // (over a deep sea the bed is far below: rain that entered 18 m over the bed fell under water)
    let wh = gh; { let l0 = near.liquidAt(fx, fz); if (l0 !== l0) l0 = airGrid.terrain.liquidAt(fx, fz); if (l0 === l0 && l0 > wh) wh = l0; }
    // the eye (f.eye: the camera, body-local; optional): what falls as single flakes is simulated round it.
    // (An eye far from the focus is a map or a free camera: the focus then.)
    let ecx = fx, ecz = fz;
    if (f.eye) { const x = frame.lx(f.eye.x, f.eye.y, f.eye.z), z = frame.lz(f.eye.x, f.eye.y, f.eye.z); if (Math.abs(x - fx) < 60 && Math.abs(z - fz) < 60) { ecx = x; ecz = z; } }
    // (P20) a raindrop's ring shows on still water, not among the waves of a running sea (Hs here, from the map: a calm lagoon keeps them)
    { const hs = water.present ? water.localAt(fx, fz, _loc).significant : 0; particles.seaCalm01 = 1 - smoothstep(0.1, 0.5, hs > 0 ? hs : 0); }
    particles.update(dt, frame, airGrid, near, fx, fy, fz, wh, here.weather, here.air.density, cover, bodyId, body.gravity, time, ecx, ecz);
    loose.update(dt, frame, airGrid, near, fx, fy, fz, wh, here.weather, here.air.density, cover, bodyId, body.gravity, time, dist, here.air.turbulence, moist.wetness01, moist.snowDepth, devils);
    // drifts: what lies loose on level ground here, how hard the wind moves it, and what stands in its way
    { const U = Math.hypot(airGrid.cwe, airGrid.cwn), snow = moist.snowDepth;
      driftSnow = snow > 0.01;
      const level = driftSnow ? snow : DRIFT.sandLayer * clamp01(cover.dustSource) * (1 - Math.min(1, moist.wetness01 * 2));
      const tr = driftSnow ? snowTransport01(U, moist.wetness01, here.sky.snowfall) : loose.saltation01;
      let ns = 0;
      if (dist) for (let k = 0; k < dist.length && ns < 4; k++) {
        const D = dist[k]; if (D.kind !== 'ship' || !D.p) continue;
        const x = frame.lx(D.p.x, D.p.y, D.p.z), z = frame.lz(D.p.x, D.p.y, D.p.z), feet = Math.hypot(D.p.x, D.p.y, D.p.z) - frame.r0;
        if (feet - near.heightAt(x, z, gh) > 1.2) continue;                   // flying: the wind goes under it
        const o = ns * 4; _dsh[o] = x; _dsh[o + 1] = z; _dsh[o + 2] = feet + DRIFT.hullHeight; _dsh[o + 3] = (D.radius || 4.2) * 0.85; ns++;
      }
      drift.update(dt, frame, fx, fz, near, airGrid.cwe, airGrid.cwn, level > 0.004 ? level : 0, tr, _dsh, ns); }
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
    // (P18) the sea map: raised at every node about over its own fetch and depth (seamap.js), built in slices; its outer
    // level and far rose sample within the old gauge's ration (more while they are not known, on arrival). The reference
    // sea (the trains) is the sea of the most exposed node; the map scales and turns it everywhere else (water.js).
    let seaFetch = cover.fetch || 80, seaDepth = liqDepth, swe = airGrid.cwe, swn = airGrid.cwn;
    stats.fetchSamples = 0; stats.msFetch = 0;
    if (liqLevel > -1e8 && coverKnown) {
      const tg = now(), known = seaMap.outer.invalid === 0 && seaMap.rose.ready;
      _sc.bodyId = bodyId; _sc.R = body.radius; _sc.level = liqLevel; _sc.we = airGrid.cwe; _sc.wn = airGrid.cwn; _sc.g = body.gravity;
      _sc.rhoAir = here.air.density; _sc.rhoLiq = cover.liquidDensity || liquidOf(bodyId).density; _sc.dir = water.dir;
      _sc.swellHeight = water.open > 0 ? water.swellHeight : 0; _sc.swellLength = water.open > 0 ? water.swellLength : 0;
      _sc.exposed = water.mapRead;      // (the reference moves to the most exposed water once something reads the map: water.js)
      _sc.sample = sampleActive; _sc.budget = warming ? 64 : known ? Math.max(2, QUALITY.samples[quality] >> 1) : QUALITY.samples[quality] * QUALITY.burst;
      _sc.clock = clock; _sc.ms = known ? QUALITY.sampleMs : 3 * QUALITY.sampleMs; _sc.quality = quality; _sc.fx = fx; _sc.fz = fz; _sc.time = time;
      const n = seaMap.update(_sc);
      stats.samples += n; stats.fetchSamples = n; gauge.samples = n;
      const T = seaMap.target;
      if (T.on) { seaFetch = T.refFetch; seaDepth = T.refDepth > 0 ? T.refDepth : liqDepth; swe = T.refU * Math.cos(T.refHeading); swn = T.refU * Math.sin(T.refHeading); }
      else if (seaMap.upwindFetch(airGrid.cwe, airGrid.cwn, _uf)) { seaFetch = Math.min(seaFetch, _uf[0]); if (_uf[1] > 0) seaDepth = _uf[1]; }
      const W = seaMap.wp;
      if (W.ok) { frame.dir(W.x, W.z, _d3); wp.ok = true; wp.x = _d3[0]; wp.y = _d3[1]; wp.z = _d3[2]; wp.depth = W.depth; wp.cap = W.cap; } else wp.ok = false;
      stats.msFetch = now() - tg;
    }
    water.attachMap(liqLevel > -1e8 && seaMap.target.on ? seaMap.target : null);
    water.expectMap = true;     // (P20) the sea on arrival settles quickly until the map's first build has measured it (water.js arriveWait)
    // wakes: a body moving in the liquid, and thrusters blowing on it, leave rings of waves
    if (water.present && dist) {
      const rhoL = cover.liquidDensity || liquidOf(bodyId).density;
      for (let k = 0; k < dist.length; k++) {
        const D = dist[k];
        if (!D || !D.p || D.kind === 'ship') continue;
        const S = _wk[k] || (_wk[k] = { x: 1e9, z: 1e9, t: -1e9 });
        const x = frame.lx(D.p.x, D.p.y, D.p.z), z = frame.lz(D.p.x, D.p.y, D.p.z);
        let lq = near.liquidAt(x, z); if (lq !== lq) lq = airGrid.terrain.liquidAt(x, z);
        if (!(lq > -1e8)) continue;                                       // dry ground under it (or not known yet)
        const hgt = Math.hypot(D.p.x, D.p.y, D.p.z) - frame.r0 - lq;     // above the liquid surface
        let amp = 0;
        if (D.kind === 'explorer') {
          // wading or swimming: the body's bow wave, a few centimetres, growing with speed
          if (hgt < 0.2 && hgt > -2.5) { const sp = D.v ? Math.hypot(D.v.x, D.v.y, D.v.z) : 0; amp = Math.min(0.06, 0.012 * sp); }
        } else if (hgt < 14 && hgt > -0.5 && D.strength > 0) {
          // a jet presses a dish into the liquid as deep as its pressure can hold up: q / (rho g)
          const Rj = (D.radius || 0.4) + 0.25 * Math.max(0, hgt);
          amp = Math.min(0.25, 0.5 * D.strength / (Math.PI * Rj * Rj) / (rhoL * body.gravity));
        }
        if (amp < 0.004) continue;
        const L = wakeLength(amp);
        if (Math.hypot(x - S.x, z - S.z) >= WATER.wakeEvery * L || time - S.t >= WATER.wakeEvery || time < S.t) { water.addWake(x, z, amp); S.x = x; S.z = z; S.t = time; }
      }
    }
    // (until the ground under the focus has been sampled, nothing is known about the liquid here)
    water.update(dt, frame, swe, swn, coverKnown ? liqLevel : -1e9, seaDepth, seaFetch, body.gravity, here.air.density, cover.liquidDensity || liquidOf(bodyId).density, fx, fz, WINDS[bodyId] ? WINDS[bodyId].U : 0);
    // the sea's own spray: spume off the breaking crests, surf on the shore (loose.js; the drops move from the next step on)
    loose.sea(dt, water, near, fx, fz, airGrid.cwe, airGrid.cwn, body.gravity, airGrid);
    here.blown.sand = loose.saltation01; here.blown.snow = loose.blowingSnow01; here.blown.spume = loose.spume01; here.blown.surf = loose.surf01; here.blown.leaves = loose.leafRate; here.blown.litter = loose.litterRate; here.blown.leafStock01 = loose.leafStock01;
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
  // recv (optional, P18): what feels the air, { size (m), vx, vy, vz (m/s, body-local) } (air.js airAt)
  function air(bodyId, p, out, height, recv) {
    return airAt(bodyId, p.x, p.y, p.z, time, seed, bodyId === active ? airGrid : null, frame, bodyId === active ? sunDir : null, height, out || {}, bodyId === active ? devils : null, recv || null);
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
    if (cv) { env.moist = cv.moist; env.fog = cv.fog; env.snowBase = cv.snowBase; env.dT = cv.dT; env.dustSource = cv.dustSource; env.fetch = cv.fetch || 0; }
    env.sun01 = sun01;
    const wl = windLarge(bodyId, ux, uy, uz, t, seed, _wl4)[3];
    env.wind = wl;
    weatherAt(bodyId, ux, uy, uz, r - body.radius, t, seed, env, o);
    if (local && nearFocus(bodyId, ux, uy, uz, 40)) { o.wetness01 = moist.wetness01; o.snowDepth = moist.snowDepth; o.freshSnow = moist.freshSnow; }
    else {
      env.T = o.temperature; env.Tmean = airTemperature(bodyId, r - body.radius, uy, null) + (cv ? cv.dT : 0); env.wind = wl;
      moistureAt(bodyId, ux, uy, uz, t, seed, env, _m2);
      o.wetness01 = _m2.wetness01; o.snowDepth = _m2.snowDepth; o.freshSnow = _m2.freshSnow;
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
      // the snow as deep as the wind has left it at this very spot (drift.js)
      if (driftSnow && unitDir && s.radius > 0) { const px = unitDir.x * s.radius, py = unitDir.y * s.radius, pz = unitDir.z * s.radius; st.snowDepth = Math.max(0, moist.snowDepth + drift.depthAt(frame.lx(px, py, pz), frame.lz(px, py, pz))); }
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
    const lx = bodyId === active ? frame.lx(p.x, p.y, p.z) : 0, lz = bodyId === active ? frame.lz(p.x, p.y, p.z) : 0;
    // (P18: with the sea map, as far as its outer level reaches: 2 km)
    if (bodyId === active && (airGrid.inside(lx, lz) || water._mapOn && Math.max(Math.abs(lx - frame.lx(focus.x, focus.y, focus.z)), Math.abs(lz - frame.lz(focus.x, focus.y, focus.z))) < 0.5 * (SEA_TEX.N - 1) * SEA_MAP.outerCell)) {
      o.present = water.present;
      o.height = water.present ? water.heightAt(lx, lz) : 0;
      // (P18) the sea HERE: the map's local sea (the reference's where there is no map)
      const L = water.localAt(lx, lz, _loc);
      o.significant = L.significant; o.period = water.period; o.length = water.length; o.speed = water.speed;
      o.swell = water.open > 0 ? water.swellHeight * (water._mapOn ? L.open * Math.min(1, L.s3) : water.open) : 0; o.swellLength = water.open > 0 ? water.swellLength : 0;
      o.steepness = water.steepness; o.whitecap01 = water._mapOn ? (L.cover > 0 ? Math.pow(L.cover / WATER.foamMax, 1 / WATER.foamPower) : 0) : water.whitecap01; o.whitecapCover = water._mapOn ? L.cover : water.foamAt < 1e8 ? water.cover : 0;
      o.fetch = L.fetch; o.depth = L.depth;     // (P16) what this sea was raised over: the measured fetch (m), the mean depth along it (m); (P18) here
      o.waveHs = L.Hs; o.open = L.open; o.nodeDepth = L.nodeDepth;     // (P18) the wind sea here (m), how far the open sea's swell reaches here, the depth at the map's node (m)
      dir.x = frame.ex * L.dirx + frame.nx * L.dirz; dir.y = frame.ey * L.dirx + frame.ny * L.dirz; dir.z = frame.ez * L.dirx + frame.nz * L.dirz;
    } else {
      const a = air(bodyId, p, _wa, 10), body = BODIES[bodyId];
      windSea(a.speed, FETCH_DEFAULT, body.gravity, a.density, liquidOf(bodyId).density, 1e9, _ws);
      o.swell = 0; o.swellLength = 0;
      o.present = true; o.height = 0; o.significant = _ws.height; o.period = _ws.period; o.length = _ws.length; o.speed = _ws.speed;
      o.steepness = _ws.steepness; o.whitecap01 = _ws.whitecap01; o.whitecapCover = foamCover(_ws.whitecap01);
      o.fetch = FETCH_DEFAULT; o.depth = Infinity; o.waveHs = _ws.height; o.open = 0; o.nodeDepth = NaN;
      const s = a.speed > 1e-6 ? 1 / a.speed : 0; dir.x = a.wind.x * s; dir.y = a.wind.y * s; dir.z = a.wind.z * s;
    }
    return o;
  }

  // (P20) The height of the liquid's surface over its still level at body-local p, where the still liquid is `depth` m deep,
  // as PAINTER's water shader draws it near the eye (materials.js WATER_VERT: the waves, the wake, and in the shallows,
  // under 1.28 Hs of depth, the waves giving way to the swash at a beach of 0.07): what a floating or wading body rides.
  // Until P20 the body floated on the still level and the drawn waves passed through it (Neptune's storm: +-2 m).
  // 0 off the active body, on a still liquid, or beyond the field.
  // rate (optional): rate[0] is how fast that surface rises there (m/s; the waves' share), which the body's drag in the
  // liquid is measured against.
  const _locW = {};
  function waterLevelAt(bodyId, p, depth, rate) {
    if (rate) rate[0] = 0;
    if (bodyId !== active || !water.present) return 0;
    const lx = frame.lx(p.x, p.y, p.z), lz = frame.lz(p.x, p.y, p.z);
    const h = water.heightAt(lx, lz), hs = water.localAt(lx, lz, _locW).significant;
    const shoal = depth > 0 ? Math.min(1, depth / Math.max(1.28 * (hs > 0 ? hs : 0), 0.05)) : 0;
    const run = shoal < 1 ? water.runupAt(lx, lz, 0.07) : 0;
    const w = run + (h - run) * shoal;
    if (rate) { const r = water.rateAt(lx, lz) * shoal; rate[0] = r === r ? r : 0; }
    return w === w ? w : 0;
  }

  // Add physics to an env object for the explorer or ship step functions:
  //   env.air(p, out, height), env.ground(surface, out), env.liquid, and gravity / radius if missing.
  // With no body (deep space) the env is returned as it is: no air, no gravity.
  function bindEnv(bodyId, env = {}) {
    const body = BODIES[bodyId];
    if (!body) { env.air = undefined; env.ground = undefined; return env; }
    env.air = (p, out, height, recv) => air(bodyId, p, out, height, recv);
    env.ground = (surface, out) => ground(bodyId, null, out, surface);
    env.liquid = liquidOf(bodyId);
    env.liquidOf = (surface) => liquidAt(bodyId, surface);
    // (P20) the liquid's surface where a body floats or wades: the drawn sea (waterLevel), not its still level
    env.waterLevel = (p, depth, rate) => waterLevelAt(bodyId, p, depth, rate);
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
  const _cw = new Float64Array(5);
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
      // how far a point of a crown is moved by its branch (m: { e, n, up }); add it before plantDisplace.
      // rel: the point's offset from the trunk { e, n } (m) and height h; H: the plant's height;
      // root: body-local; bend: what plantBend returned for the plant (stiff01 as for the plant)
      // (P14: the branch's wind is its own, looked up at the root; of `bend` only shake01 is read)
      plantBranch(re, rn, h, H, root, bend, out) { const gx = frame.lx(root.x, root.y, root.z), gz = frame.lz(root.x, root.y, root.z); return plantBranch(re, rn, h, H, gx, gz, 0, 0, (bend && bend.shake01) || 0, flora.uniforms, out, flora.crownAt(gx, gz, H, _cw)); },
      // (P14) the twin of pcPhysCrown: the same for a point of the branch or foliage mass numbered id (0..1; negative:
      // none), leaf01 1 on foliage; shake01 from plantBend. out also carries set (m), load, I, hz, gain (see flora.js)
      plantCrown(re, rn, h, H, root, shake01, id, leaf01, out) { const gx = frame.lx(root.x, root.y, root.z), gz = frame.lz(root.x, root.y, root.z); return plantCrown(re, rn, h, H, gx, gz, flora.crownAt(gx, gz, H, _cw), shake01 || 0, flora.uniforms, id, leaf01, out); },
      field: flora,
    },
    deform: {
      get depth() { return deform.depth; }, size: DEFORM.N, cell: DEFORM.cell,
      marks: deform.marks, uniforms: deform.uniforms,
      get version() { return deform.version; },
      depthAt(p) { return deform.depthAt(frame.lx(p.x, p.y, p.z), frame.lz(p.x, p.y, p.z)); },
      field: deform,
    },
    // drifts (drift.js): a 64 x 64 grid of 0.5 m cells round the focus, the grid of the marks.
    //   factor: Float32Array(64*64): loose material at the cell in units of what lies on level ground
    //           (0 level, +1 twice as deep, -1 blown bare); level: that depth now (m); snow: it is snow
    //           (else the loose layer of sand or dust); depthAt(p): m above (below) the level deposit
    drift: {
      get factor() { return drift.f; }, size: DRIFT.N, cell: DRIFT.cell, uniforms: drift.uniforms,
      get version() { return drift.version; }, get level() { return drift.level; }, get snow() { return driftSnow; },
      depthAt(p) { return drift.depthAt(frame.lx(p.x, p.y, p.z), frame.lz(p.x, p.y, p.z)); },
      field: drift,
    },
    water: {
      uniforms: water.uniforms,   // uPhysWaterDir[2], uPhysWaterK[4], uPhysWaterAmp[4], uPhysWaterPhase[4], uPhysWaterGroup[4],
                                  // uPhysWaterSea[4] (Hs, breaking level, its edge, whitecap cover),
                                  // uPhysWake (Float32Array(64): 16 x (x, z, age, amplitude)), uPhysWakeG
      heightAt(p) { return water.present ? water.heightAt(frame.lx(p.x, p.y, p.z), frame.lz(p.x, p.y, p.z)) : 0; },
      // the whole surface at body-local p, the twin of the chunk: { height, de, dn (slope along the
      // frame's east and north), ax, az (the way the crests lie, frame axes), crest01, foam01 }
      sample(p, out) { return water.surfaceAt(frame.lx(p.x, p.y, p.z), frame.lz(p.x, p.y, p.z), out || {}); },
      // 0..1: how far this sea's waves have broken where the liquid is `depth` m deep (the surf at a shore)
      surf01(depth) { return water.present ? surf01(water.height, depth) : 0; },
      // (P12) the swash: level (m over the still level) of the water's edge on a beach of this slope at body-local p
      runup(p, slope = 0.07) { return water.runupAt(frame.lx(p.x, p.y, p.z), frame.lz(p.x, p.y, p.z), slope); },
      // (P16) the fetch gauge: fetch (m, the mean of its radials), depth (m), radial (m each), ready, final, samples (this frame);
      // and the water point it measures from (body-local unit direction, its depth and its biome's fetch, the cap)
      gauge, waterPoint: wp,
      // (P18) the sea at body-local p (water.js localAt): significant, foamAt, edge, cover, dirx, dirz (frame axes), sW, s3,
      // fetch, depth, Hs, open, heading, nodeDepth; and the surf there in `depth` m of liquid; the builder itself
      local(p, out) { return water.localAt(frame.lx(p.x, p.y, p.z), frame.lz(p.x, p.y, p.z), out || {}); },
      surfAt(p, depth) { if (!water.present) return 0; const L = water.localAt(frame.lx(p.x, p.y, p.z), frame.lz(p.x, p.y, p.z), _loc); return surf01(L.significant, depth); },
      map: seaMap,
      get mapVersion() { return water.mapVersion; },
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
    sky: (weather, out) => skyNumbers(weather || here.weather, out),   // the same numbers for any weather() result
    here,                     // air, weather and cover at the focus, refreshed by update()
    focus,                    // {x,y,z} body-local: the focus of the last update (read-only)
    features,                 // { devils: [...] with .count }: dust devils near the focus
    explorer: { step: stepExplorerBody, tuning: EXPLORER_BODY, disturbers: explorerDisturbers, jumpSpeed: jumpSpeedFor, terminal: explorerTerminal, sustainableSpeed, gait: gaitOf, bob: strideBob },
    ship: {
      step: stepShipBody, gear: stepShipGear, wake: wakeShip, tuning: SHIP_BODY, disturbers: shipDisturbers,
      topSpeed: shipTopSpeed, terminal: shipTerminal, downwashSpeed, groundEffect, gearSag,
      planSpeedChange, sampleSpeedChange, pulseBrakeDistance, stepPulse,
    },
    fields,
    particles: Object.assign({ events: particles.events, system: particles }, particles.buffers),
    glsl: { flora: FLORA_GLSL, water: WATER_GLSL },
    // reference data
    data: { ATMOSPHERES, WINDS, REGIMES, MATERIALS, MATERIAL_IDS, MATERIAL_INDEX, MATERIAL_NONE, BIOMES, SPECIES },
    util: {
      airDensity, airTemperature, gravityAt, fallSpeed, terminalVelocity, bluntTerminal, liquidOf, liquidAt, BIOME_LIQUID, cellsAt: (bodyId, t) => cellsAt(bodyId, t == null ? time : t, seed),
      saltationThreshold, holdAngle, iceFriction, treeFrequency, stemFrequency, PlantSim,
    },
    stats,
  };
}

export {
  // step functions and tuning tables, for PILOT's pure modules and tests
  stepExplorerBody, EXPLORER_BODY, jumpSpeedFor, explorerTerminal, sustainableSpeed, gaitOf,
  stepShipBody, stepShipGear, wakeShip, SHIP_BODY, shipTopSpeed, shipTerminal, downwashSpeed, groundEffect, gearSag,
  planSpeedChange, sampleSpeedChange, pulseBrakeDistance, stepPulse,
  FLORA_GLSL, WATER_GLSL, WATER, SEA_TEX, SEA_MAP, windSea, fetchOf, skyNumbers, SKY, FLORA, PARTICLES, EVENT, DEFORM, MARK, MARK_STRIDE, WEATHER, WIND, AIR, GROUND, DEFAULT_SEED, LOOSE, KICK, DEVILS,
  MATERIAL_IDS, MATERIAL_INDEX, MATERIAL_NONE, materialNow,
};
