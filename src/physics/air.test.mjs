// The air near the player through the first storm (P10): the gust pattern rides in the air, and
// shelter follows a veering wind at the pace the air crosses the fetch.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPhysics } from './index.js';
import { WIND, gustLevel, gustLevelAt, gustPhase } from './wind.js';
import { AIR, wakeAt } from './air.js';
import { BODIES } from '../data/bodies.js';
import { makeWorld, V, norm } from './testworld.mjs';

const SPAWN = norm(V(0.1736, 0.5817, 0.7946));     // PAINTER's Earth spawn (weather.test.mjs holds the storm over it)

// Stand at `dir` on `sampleSurface` from t0 to t1 of the game's clock and record, at each height,
// the largest change of the wind vector from one frame to the next (as an acceleration), the
// lull-to-gust swing of the wind speed, and the fastest reference wind (what carries the gusts).
function scan(sampleSurface, dir, t0, t1, hz, heights) {
  const physics = createPhysics({ sampleSurface, timeBudget: false });
  const R = sampleSurface('earth', dir).radius;
  const pts = heights.map((h) => V(dir.x * (R + h), dir.y * (R + h), dir.z * (R + h)));
  physics.warmUp({ bodyId: 'earth', time: t0 - 5, focus: pts[0] });
  for (let t = t0 - 5; t < t0; t += 1 / hz) physics.update(1 / hz, { bodyId: 'earth', time: t, focus: pts[0] });
  const out = heights.map((h) => ({ h, worst: 0, at: 0, lo: 1e9, hi: 0, prev: null }));
  const a = {}, grid = physics.fields.air;
  let uref = 0;
  for (let i = 0; i < (t1 - t0) * hz; i++) {
    const t = t0 + i / hz;
    physics.update(1 / hz, { bodyId: 'earth', time: t, focus: pts[0] });
    uref = Math.max(uref, Math.hypot(grid.cwe, grid.cwn));
    for (let k = 0; k < heights.length; k++) {
      const o = out[k];
      physics.air('earth', pts[k], a, heights[k], BIG);
      const w = [a.wind.x, a.wind.y, a.wind.z], s = Math.hypot(w[0], w[1], w[2]);
      o.lo = Math.min(o.lo, s); o.hi = Math.max(o.hi, s);
      if (o.prev) { const acc = Math.hypot(w[0] - o.prev[0], w[1] - o.prev[1], w[2] - o.prev[2]) * hz; if (acc > o.worst) { o.worst = acc; o.at = t; } }
      o.prev = w;
    }
  }
  return { out, uref };
}

// What is physical: a gust is a piece of the air and travels with it. The wind at a fixed place can
// go from the deepest lull to the strongest gust no faster than the air carries the edge of the
// smallest gust past it: swing x (speed of the air that carries the gusts) / (the smallest gust,
// WIND.gustLength2), with 1.5 for the steepest edge the pattern has. Anything faster is the model
// moving the air by other means: a pattern that slides through the air, a field that steps.
// (P11) The pattern has four octaves now (the inertial range: wind.js), and the bound is re-derived from them:
// each octave can swing the level by 2 x weight x gustNorm of the 2 x gustMax the clamp allows, across its
// own lattice length, and the steepest the interpolant between two lattice values gets is 1.875 x the mean
// slope (the quintic fade of noise3; "1.5" stood here for the same thing). So "swing / the smallest gust"
// becomes swing x 1.875 x the sum of (weight x gustNorm / gustMax) / length: 0.16 per metre where
// 1.5 / gustLength2 was 0.044. That is what a mast sees too: the 1 s rate of change of the model now equals
// Kaimal's (wind.test.mjs); before P11 it was 0.6 of it. The bound still catches what it was written for:
// the wake that switched in one frame gave 86 and 123 m/s2 at 2 and 10 m on the real ground (bounds 61 and 84),
// and that fault has its own test below.
const GUST_LENGTHS = [WIND.gustLength, WIND.gustLength2, WIND.gustLength3, WIND.gustLength4];
const EDGE = 1.875 * WIND.gustWeights.reduce((a, w, i) => a + w * WIND.gustNorm / WIND.gustMax / GUST_LENGTHS[i], 0);
const bound = (o, uref) => (o.hi - o.lo) * uref * EDGE;
// (P18) What these tests measure is the grid and the pattern it carries (a step at a hop, a wake that switches, a pattern that
// slides through the air): the point's sub-second eddies (wind.js gustSubAt) are left out by asking the air as a receiver
// far larger than they are, which averages them away (aerodynamic admittance); they have their own test (wind.test.mjs).
const BIG = { size: 1000, vx: 0, vy: 0, vz: 0 };

test('the first storm at the Earth spawn: at 2, 10 and 30 m the air accelerates no faster than the storm\'s own wind carries a gust past (open ground)', () => {
  const sample = makeWorld({ R: BODIES.earth.radius, biome: 'alpine_meadow' });
  const { out, uref } = scan((b, d) => sample(d), SPAWN, 150, 330, 60, [2, 10, 30]);
  assert.ok(uref > 12, 'this is the storm: reference wind up to ' + uref.toFixed(1) + ' m/s');
  for (const o of out) {
    console.log(`# open ground, ${o.h} m: worst ${o.worst.toFixed(1)} m/s2 at ${o.at.toFixed(2)} s; wind ${o.lo.toFixed(1)} to ${o.hi.toFixed(1)} m/s; bound ${bound(o, uref).toFixed(1)}`);
    assert.ok(o.hi - o.lo > 5, `gusts at ${o.h} m`);
    assert.ok(o.worst < bound(o, uref), `at ${o.h} m: ${o.worst.toFixed(1)} m/s2 at t = ${o.at.toFixed(2)}, bound ${bound(o, uref).toFixed(1)}`);
  }
});

test('the first storm at the Earth spawn on PAINTER\'s real ground (forest: wakes of the stands upwind), if it loads in Node: the same bound, and no wake switches in one frame', async () => {
  let real;
  try { real = await import('../world/surface.js'); } catch (e) { console.log('# (skipped: src/world/surface.js did not load in Node: ' + e.message + ')'); return; }
  if (typeof real.sampleSurfacePure !== 'function' || typeof real.getSurface !== 'function') { console.log('# (skipped: sampleSurfacePure not exported)'); return; }
  const sp = real.getSurface('earth').getSpawn();
  // (before P10: 86, 123 and 51 m/s2 at 241.13 s, when the wake at the spawn changed stands in one frame)
  const { out, uref } = scan((id, d) => real.sampleSurfacePure(id, d.x, d.y, d.z), sp, 150, 330, 60, [2, 10, 30]);
  for (const o of out) {
    console.log(`# real ground, ${o.h} m: worst ${o.worst.toFixed(1)} m/s2 at ${o.at.toFixed(2)} s; wind ${o.lo.toFixed(1)} to ${o.hi.toFixed(1)} m/s; bound ${bound(o, uref).toFixed(1)}`);
    assert.ok(o.worst < bound(o, uref), `at ${o.h} m: ${o.worst.toFixed(1)} m/s2 at t = ${o.at.toFixed(2)}, bound ${bound(o, uref).toFixed(1)}`);
  }
});

test('a runner crossing the storm feels no step in the wind when the grid hops a cell (the weather on a lattice fixed to the ground; fields that move with their ground)', () => {
  // (before P10: 407 m/s2 at 2 m: every 16 m the per-node shelter was one cell stale for up to four
  // frames, and the storm's outflow, taken at the grid's centre alone, hopped with the centre)
  const R0 = BODIES.earth.radius, sample = makeWorld({ R: R0, biome: 'alpine_meadow' });
  const physics = createPhysics({ sampleSurface: (b, d) => sample(d), timeBudget: false });
  const e = norm(V(-SPAWN.z, 0, SPAWN.x)), hz = 60, speed = 7, grid = physics.fields.air;
  let p = V(SPAWN.x * (R0 + 2), SPAWN.y * (R0 + 2), SPAWN.z * (R0 + 2));
  physics.warmUp({ bodyId: 'earth', time: 150, focus: p });
  const a = {}, o = { worst: 0, at: 0, lo: 1e9, hi: 0 };
  let prev = null, uref = 0, hops = 0, ci = grid.terrain.ci, cj = grid.terrain.cj;
  for (let i = 0; i < 180 * hz; i++) {
    const t = 150 + i / hz;
    p = V(p.x + e.x * speed / hz, p.y + e.y * speed / hz, p.z + e.z * speed / hz);
    const l = Math.hypot(p.x, p.y, p.z) / (R0 + 2); p = V(p.x / l, p.y / l, p.z / l);
    physics.update(1 / hz, { bodyId: 'earth', time: t, focus: p });
    if (grid.terrain.ci !== ci || grid.terrain.cj !== cj) { hops++; ci = grid.terrain.ci; cj = grid.terrain.cj; }
    physics.air('earth', p, a, 2, BIG); uref = Math.max(uref, Math.hypot(grid.cwe, grid.cwn));
    const w = [a.wind.x, a.wind.y, a.wind.z], s = Math.hypot(w[0], w[1], w[2]);
    o.lo = Math.min(o.lo, s); o.hi = Math.max(o.hi, s);
    if (prev) { const acc = Math.hypot(w[0] - prev[0], w[1] - prev[1], w[2] - prev[2]) * hz; if (acc > o.worst) { o.worst = acc; o.at = t; } }
    prev = w;
  }
  // the runner meets the gusts at the wind's speed and its own
  const lim = bound(o, uref + speed);
  console.log(`# a runner at 7 m/s, 2 m: worst ${o.worst.toFixed(1)} m/s2 at ${o.at.toFixed(2)} s over ${hops} hops of the grid; bound ${lim.toFixed(1)}`);
  assert.ok(hops > 50, 'the grid followed the runner: ' + hops);
  assert.ok(o.worst < lim, `${o.worst.toFixed(1)} m/s2 at t = ${o.at.toFixed(2)}, bound ${lim.toFixed(1)}`);
});

test('seen from the air the gust pattern stands still: riding with the wind through the storm front the gust level only fades over its cycle (the stateless form slides through the air)', () => {
  const sample = makeWorld({ R: BODIES.earth.radius, biome: 'alpine_meadow' });
  const physics = createPhysics({ sampleSurface: (b, d) => sample(d), timeBudget: false });
  const R = sample(SPAWN).radius, p0 = V(SPAWN.x * (R + 10), SPAWN.y * (R + 10), SPAWN.z * (R + 10));
  const hz = 60, grid = physics.fields.air, gs = grid.gustShift;
  physics.warmUp({ bodyId: 'earth', time: 120, focus: p0 });
  let q = { ...p0 }, gPrev = NaN, oPrev = NaN, ride = 0, slide = 0, veer = 0, cPrev = null;
  for (let i = 0; i < (330 - 120) * hz; i++) {
    const t = 120 + i / hz;
    physics.update(1 / hz, { bodyId: 'earth', time: t, focus: p0 });
    // the rider goes with the air that carries the gusts; set back at the spawn every 3 s
    const fresh = i % (3 * hz) === 0;
    if (fresh) q = { ...p0 }; else { q.x += grid.cwx / hz; q.y += grid.cwy / hz; q.z += grid.cwz / hz; }
    const g = gustLevelAt('earth', q.x, q.y, q.z, gs[0], gs[1], gs[2], gs[3], gs[4], gs[5], t, physics.seed);
    const o = gustLevel('earth', q.x, q.y, q.z, grid.cwx, grid.cwy, grid.cwz, t, physics.seed);
    if (!fresh) { ride = Math.max(ride, Math.abs(g - gPrev) * hz); slide = Math.max(slide, Math.abs(o - oPrev) * hz); }
    if (cPrev) veer = Math.max(veer, Math.hypot(grid.cwx - cPrev[0], grid.cwy - cPrev[1], grid.cwz - cPrev[2]) * hz);
    gPrev = g; oPrev = o; cPrev = [grid.cwx, grid.cwy, grid.cwz];
  }
  console.log(`# riding with the wind: the pattern changes at most ${ride.toFixed(3)} /s (cross-fade); the stateless form ${slide.toFixed(2)} /s; the mean wind changes at up to ${veer.toFixed(2)} m/s2`);
  // the cross-fade alone: two copies trading weight over half a cycle
  assert.ok(ride < 8 / WIND.gustCycle, 'the pattern is carried by the air: ' + ride);
  assert.ok(veer > 0.1 && slide > 3 * ride, 'and this storm is one where the stateless form is not: ' + slide);
});

test('in a steady wind the carried pattern is the stateless one exactly, cycle after cycle', () => {
  const w = [7, 0.5, -3], gp = new Float64Array(4), s = [0, 0, 0, 0, 0, 0];
  let c1 = NaN, c2 = NaN, worst = 0;
  const dt = 1 / 30;
  for (let i = 0; i < 30 * 400; i++) {
    const t = 1000 + i * dt;
    gustPhase(t, gp);
    for (let k = 0; k < 3; k++) {
      s[k] = gp[0] !== c1 ? w[k] * gp[2] : s[k] + w[k] * dt;
      s[3 + k] = gp[1] !== c2 ? w[k] * gp[3] : s[3 + k] + w[k] * dt;
    }
    c1 = gp[0]; c2 = gp[1];
    const a = gustLevelAt('earth', 100 + i, 6.3e6, 50, s[0], s[1], s[2], s[3], s[4], s[5], t, 3);
    worst = Math.max(worst, Math.abs(a - gustLevel('earth', 100 + i, 6.3e6, 50, w[0], w[1], w[2], t, 3)));
  }
  assert.ok(worst < 1e-6, 'difference ' + worst);
});

test('the lee of a wood follows a veering wind at the pace the air crosses the fetch, and takes new ground at once', () => {
  // the wind grid's own fields: nothing moves by more than the easing allows between two frames of a storm
  const R = BODIES.earth.radius, d = SPAWN;
  const side = norm(V(-d.z, 0, d.x));
  const stand = norm(V(d.x + side.x * 70 / R, d.y + side.y * 70 / R, d.z + side.z * 70 / R));
  const sample = makeWorld({ R, biome: 'alpine_meadow', stand: { dir: stand, radius: 40, canopy01: 0.9, canopyHeight: 14 } });
  const physics = createPhysics({ sampleSurface: (b, dd) => sample(dd), timeBudget: false });
  const p = V(d.x * (R + 2), d.y * (R + 2), d.z * (R + 2)), grid = physics.fields.air, N = grid.N;
  physics.warmUp({ bodyId: 'earth', time: 150, focus: p });
  let wakes = 0; for (let n = 0; n < N * N; n++) if (grid.wake[n] < 0.9) wakes++;
  assert.ok(wakes > 3, 'the wood casts a wake as soon as the ground is known: ' + wakes + ' nodes');
  const prevW = new Float32Array(grid.wake), prevS = new Float32Array(grid.shel);
  let step = 0, moved = 0;
  for (let i = 0; i < 120 * 60; i++) {
    physics.update(1 / 60, { bodyId: 'earth', time: 150 + i / 60, focus: p });
    for (let n = 0; n < N * N; n++) {
      const dw = Math.abs(grid.wake[n] - prevW[n]), ds = Math.abs(grid.shel[n] - prevS[n]);
      step = Math.max(step, dw, ds); moved = Math.max(moved, Math.abs(grid.wake[n] - 1));
    }
    prevW.set(grid.wake); prevS.set(grid.shel);
  }
  console.log(`# shelter and wake: largest change in one frame ${step.toFixed(4)} (of 1) over two minutes of the storm`);
  // a full change of 1.5 (shelter spans 0.08 .. 1.6) eased over at least a second is 0.025 a frame
  assert.ok(moved > 0.3, 'the wake is there: ' + moved);
  assert.ok(step < 1.6 / 60, 'no step: ' + step);
  assert.ok(AIR.shelterAdjust > 0);
});

// (P15) are the crowns sheltered twice? Inside a wood no stand upwind is taller or denser, so there is no wake and the
// crowns feel the canopy's own profile; behind a wood the lee is whole low down and thins with height (windbreak and
// forest-edge measurements: at the top of the trees that cast it a third to a half of the loss near the ground).
test('the lee of trees upwind is whole low down, half at their height, gone at one and a half times it', () => {
  const H = 14, wk = 0.4;
  assert.equal(wakeAt(wk, H, 2), wk, 'the walker at 2 m behind a 14 m wood: the whole lee');
  assert.equal(wakeAt(wk, H, 0.5 * H), wk);
  assert.ok(Math.abs(wakeAt(wk, H, H) - (1 - 0.6 * 0.5)) < 1e-9, 'at the trees\' height half the loss: ' + wakeAt(wk, H, H));
  assert.equal(wakeAt(wk, H, 1.5 * H), 1);
  let prev = 0; for (let z = 0; z <= 25; z += 0.5) { const f = wakeAt(wk, H, z); assert.ok(f >= prev - 1e-12 && f <= 1, 'rises with height'); prev = f; }
  assert.equal(wakeAt(1, H, 3), 1); assert.equal(wakeAt(wk, 0, 3), 1);
});
