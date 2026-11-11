// Tests: drifts of snow and sand in the lee (drift.js). Run: node --test src/physics/
import test from 'node:test';
import assert from 'node:assert/strict';
import { DriftField, DRIFT, snowTransport01 } from './drift.js';
import { LocalFrame, TerrainGrid } from './near.js';
import { createPhysics } from './index.js';
import { cellsAt, weatherAt, DEFAULT_SEED } from './weather.js';
import { BODIES } from '../data/bodies.js';
import { makeWorld, V, norm, len } from './testworld.mjs';

// A stand-in for the near TerrainGrid: any height function of the grid position.
const ground = (fn) => ({ heightAt: (x, z, fb) => { const h = fn(x, z); return h === h ? h : fb; } });
const frame = () => ({ version: 1 });
// run a field to its equilibrium for a steady wind blowing toward (we, wn)
function settle(D, near, we, wn, level, { transport = 1, seconds = 6, shelters = new Float32Array(16), n = 0, fx = 0, fz = 0 } = {}) {
  const F = frame();
  for (let i = 0; i < seconds * 60; i++) D.update(1 / 60, F, fx, fz, near, we, wn, level, transport, shelters, n);
  return D;
}
const stats = (D, pred) => { let n = 0, sum = 0, mx = -1e9, mn = 1e9; const N = D.N, half = (N - 1) / 2; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = (D.ci + i - half) * D.cell, z = (D.cj + j - half) * D.cell; if (!pred(x, z)) continue; const d = D.depthAt(x, z); n++; sum += d; mx = Math.max(mx, d); mn = Math.min(mn, d); } return { n, mean: sum / n, max: mx, min: mn }; };

test('level ground holds no drift, whatever the wind; with nothing loose there is nothing to drift', () => {
  const D = settle(new DriftField(), ground(() => 0), 9, 2, 0.2);
  for (const f of D.f) assert.equal(f, 0);
  const E = settle(new DriftField(), ground((x) => Math.max(0, 2 - Math.abs(x))), 9, 0, 0);
  for (const f of E.f) assert.equal(f, 0);
  assert.equal(E.depthAt(3, 0), 0); assert.equal(E.level, 0);
});

test('a bank across the wind: snow piles in its lee and is scoured from its windward face and crest', () => {
  // a bank 2 m high along north-south, 3 m wide at the foot on either side; wind blowing east
  const bank = ground((x) => Math.max(0, 2 * (1 - Math.abs(x) / 3)));
  const S = 0.2, D = settle(new DriftField(), bank, 9, 0, S);
  const lee = stats(D, (x, z) => x > 3.2 && x < 7 && Math.abs(z) < 10), wind = stats(D, (x, z) => x > -2.8 && x < -0.5 && Math.abs(z) < 10);
  const far = stats(D, (x, z) => x < -5 && Math.abs(z) < 10), down = stats(D, (x, z) => x > 14.5 && Math.abs(z) < 10);
  assert.ok(lee.mean > 0.2 && lee.max <= DRIFT.gain * S + 1e-6, `in the lee ${lee.mean.toFixed(2)} m more than the level ${S} m (most ${lee.max.toFixed(2)})`);
  assert.ok(wind.mean < -0.1 && wind.max < 0 && wind.min >= -S - 1e-6, `the windward face is scoured: ${wind.mean.toFixed(2)} m (never more than there is: ${wind.min.toFixed(2)})`);
  assert.ok(Math.abs(far.mean) < 1e-6, 'upwind of the bank: level');
  assert.ok(Math.abs(down.mean) < 0.02, `12 m and more downwind: level again (${down.mean.toFixed(3)})`);
  // the drift tapers away from the bank: deepest just behind it
  const near2 = stats(D, (x, z) => x > 3.2 && x < 5 && Math.abs(z) < 10).mean, far2 = stats(D, (x, z) => x > 9 && x < 11 && Math.abs(z) < 10).mean;
  assert.ok(near2 > 2 * far2 && far2 > 0, `${near2.toFixed(2)} m at the foot, ${far2.toFixed(2)} m six metres on`);
  // turn the wind round: within a minute and a half of a gale the drift has changed sides
  settle(D, bank, -9, 0, S, { seconds: 100 });
  const lee2 = stats(D, (x, z) => x < -3.2 && x > -7 && Math.abs(z) < 10), old = stats(D, (x, z) => x > 3.2 && x < 7 && Math.abs(z) < 10);
  assert.ok(lee2.mean > 0.15 && old.mean < 0.05, `after the wind turned: ${lee2.mean.toFixed(2)} m on the new lee, ${old.mean.toFixed(2)} m left on the old`);
});

test('a drift is never deeper than most of the step it lies behind; a hollow fills from any wind', () => {
  // a kerb 0.3 m high in half a metre of level snow: the lee holds 0.8 x 0.3 m more, not 2.5 x 0.5
  const kerb = ground((x) => (x < 0 ? 0.3 : 0));
  const D = settle(new DriftField(), kerb, 9, 0, 0.5);
  const lee = stats(D, (x, z) => x > 0.6 && x < 2 && Math.abs(z) < 10);
  assert.ok(lee.max <= DRIFT.fill * 0.3 + 1e-6 && lee.max > 0.15, `behind a 30 cm kerb: ${lee.max.toFixed(3)} m`);
  // a bowl 1.5 m deep and 5 m across: snow gathers in it whichever way the wind blows
  const bowl = ground((x, z) => { const r = Math.hypot(x, z); return r < 5 ? -1.5 * (1 - (r / 5) ** 2) : 0; });
  for (const [we, wn] of [[8, 0], [0, -8], [-5, 6]]) {
    const B = settle(new DriftField(), bowl, we, wn, 0.15);
    const inside = stats(B, (x, z) => Math.hypot(x, z) < 3.5), rim = stats(B, (x, z) => Math.hypot(x, z) > 7 && Math.hypot(x, z) < 12);
    assert.ok(inside.mean > 0.05 && Math.abs(rim.mean) < 0.03, `wind ${we},${wn}: ${inside.mean.toFixed(3)} m more in the hollow, ${rim.mean.toFixed(3)} m round it`);
  }
});

test('nothing moves in a calm; drifts melt with the snow and deepen with the next fall; they stay put as the walker moves', () => {
  const bank = ground((x) => Math.max(0, 2 * (1 - Math.abs(x) / 3)));
  const D = settle(new DriftField(), bank, 9, 0, 0.2);
  const before = D.f.slice(), v0 = D.version;
  // the wind turns but nothing is being moved: the drift stays where it was
  settle(D, bank, -9, 0, 0.2, { transport: 0, seconds: 60 });
  assert.deepEqual(Array.from(D.f), Array.from(before)); assert.equal(D.version, v0);
  // half the snow gone: the same pattern at half the depth; more snow: deeper
  const d1 = D.depthAt(4.5, 0);
  D.update(1 / 60, frame(), 0, 0, bank, 0, 0, 0.1, 0, new Float32Array(16), 0); assert.ok(Math.abs(D.depthAt(4.5, 0) - d1 / 2) < 1e-6);
  D.update(1 / 60, frame(), 0, 0, bank, 0, 0, 0.4, 0, new Float32Array(16), 0); assert.ok(Math.abs(D.depthAt(4.5, 0) - d1 * 2) < 1e-6);
  // the walker goes 9 m north: the drift is where it was in the world, and the new ground coming into the field has its drift already
  const here = D.depthAt(4.5, 3);
  settle(D, bank, 9, 0, 0.4, { transport: 0, seconds: 1, fz: 9 });
  assert.ok(Math.abs(D.depthAt(4.5, 3) - here) < 1e-6);
  assert.ok(D.depthAt(4.5, 22) > 0.1, `north of where the field used to end: ${D.depthAt(4.5, 22).toFixed(2)} m`);
  assert.deepEqual(D.uniforms.uPhysDriftMap.slice(0, 2), [0, 9]);
  // snow transport: nothing in light air, a gale moves it, wet snow needs twice the wind, falling snow goes to the lee in a breeze
  assert.equal(snowTransport01(2, 0, 0), 0); assert.ok(snowTransport01(12, 0, 0) === 1);
  assert.ok(snowTransport01(7, 0, 0) > 0.3 && snowTransport01(7, 1, 0) === 0);
  assert.ok(snowTransport01(3, 0, 1) > 0.3 && snowTransport01(0.5, 0, 1) === 0);
});

test('nothing lies on standing liquid: over a pool the factor is -1 (no snow, no sand), and its banks drift as banks', () => {
  // a pool 6 m across and 1 m deep, brim-full, on level ground
  const bed = (x, z) => (Math.hypot(x, z) < 3 ? -1 : 0);
  const near = { heightAt: (x, z) => bed(x, z), liquidAt: (x, z) => (Math.hypot(x, z) < 3 ? 0 : NaN) };
  const D = settle(new DriftField(), near, 9, 0, 0.2);
  const pool = stats(D, (x, z) => Math.hypot(x, z) < 2.2), shore = stats(D, (x, z) => Math.hypot(x, z) > 5 && Math.abs(z) > 5);
  assert.ok(Math.abs(pool.mean + 0.2) < 1e-6 && Math.abs(pool.max + 0.2) < 1e-6, `over the pool ${pool.mean.toFixed(3)} m (all of the level 0.2 m gone)`);
  assert.ok(Math.abs(shore.mean) < 1e-6, 'the shore to the side: level');
});

test('a landed hull is an obstacle: a drift grows behind it; a flying one casts none', () => {
  // flat ground, the hull's feet at the origin, its top 2.2 m up, radius 3.6 m
  const flat = ground(() => 0), sh = new Float32Array(16); sh.set([0, 0, DRIFT.hullHeight, 3.6]);
  const D = settle(new DriftField(), flat, 9, 0, 0.2, { shelters: sh, n: 1 });
  const lee = stats(D, (x, z) => x > 4.5 && x < 9 && Math.abs(z) < 2), side = stats(D, (x, z) => Math.abs(z) > 6), up = stats(D, (x, z) => x < -5 && Math.abs(z) < 2);
  assert.ok(lee.mean > 0.1, `behind the hull ${lee.mean.toFixed(2)} m more`);
  assert.ok(Math.abs(side.mean) < 1e-6 && Math.abs(up.mean) < 1e-6, 'beside it and upwind of it: level');
  const E = settle(new DriftField(), flat, 9, 0, 0.2);
  assert.ok(Math.abs(stats(E, (x, z) => x > 4.5 && x < 9 && Math.abs(z) < 2).mean) < 1e-9);
});

function snowy(opts) {
  const R = BODIES.earth.radius, sample = makeWorld({ R, biome: 'alpine_meadow', ...opts });
  const physics = createPhysics({ sampleSurface: (id, d) => sample(d), timeBudget: false });
  for (let t = 0; t < 12000; t += 53) for (const c of cellsAt('earth', t)) {
    const w = weatherAt('earth', c.x, c.y, c.z, 0, t, DEFAULT_SEED, { moist: 1, sun01: 0.5, wind: 4 }, {});
    if ((w.precipitation.type === 'snow') && w.precipitation.intensity01 > 0.6) return { physics, R, c, t0: t, sample };
  }
  throw new Error('no snow found');
}

test('in the game loop: lying snow drifts behind a hill, the walker sinks deeper in the drift, and every number is finite', () => {
  // a hill 3 m high, 8 m in radius, 9 m upwind of the focus (the wind's direction is the weather's: find it first)
  const probe = snowy({}); const f0 = V(probe.c.x * probe.R, probe.c.y * probe.R, probe.c.z * probe.R);
  probe.physics.warmUp({ bodyId: 'earth', time: probe.t0, focus: f0 });
  let t = probe.t0; for (let i = 0; i < 600; i++) { t += 1 / 60; probe.physics.update(1 / 60, { bodyId: 'earth', time: t, focus: f0 }); }
  const wind = probe.physics.here.air.wind, wl = len(wind), u = norm(f0);
  const snow0 = probe.physics.here.weather.snowDepth;
  assert.ok(wl > 1 && snow0 > 0.02, `wind ${wl.toFixed(1)} m/s, ${snow0.toFixed(2)} m of snow lying`);
  // on flat ground: no drift anywhere
  let worst = 0; for (const f of probe.physics.fields.drift.factor) worst = Math.max(worst, Math.abs(f));
  assert.ok(worst < 0.05 && probe.physics.fields.drift.snow && Math.abs(probe.physics.fields.drift.level - snow0) < 1e-6, `flat: largest factor ${worst}`);
  // the same place with the hill upwind
  const hillDir = norm(V(f0.x - wind.x / wl * 9, f0.y - wind.y / wl * 9, f0.z - wind.z / wl * 9));
  const w = snowy({ cone: { dir: hillDir, radius: 8, height: 3 } });
  const focus = V(u.x * w.R, u.y * w.R, u.z * w.R);
  w.physics.warmUp({ bodyId: 'earth', time: w.t0, focus });
  t = w.t0; for (let i = 0; i < 600; i++) { t += 1 / 60; w.physics.update(1 / 60, { bodyId: 'earth', time: t, focus }); }
  const D = w.physics.fields.drift;
  // just behind the foot of the hill (2 m downwind of the focus is 3 m behind the foot) against the open ground to the side
  const at = (along, across) => { const s = norm(V(u.y * wind.z - u.z * wind.y, u.z * wind.x - u.x * wind.z, u.x * wind.y - u.y * wind.x)); return V(focus.x + wind.x / wl * along + s.x * across, focus.y + wind.y / wl * along + s.y * across, focus.z + wind.z / wl * along + s.z * across); };
  const lee = D.depthAt(at(1, 0)), open = D.depthAt(at(1, 14));
  assert.ok(lee > 0.5 * snow0 && Math.abs(open) < 0.3 * snow0, `behind the hill ${lee.toFixed(3)} m more snow, beside it ${open.toFixed(3)} m`);
  for (const f of D.factor) assert.ok(Number.isFinite(f) && f >= -1 - 1e-6 && f <= DRIFT.gain + 1e-6);
  // the ground the explorer stands on knows it: deeper snow in the drift, so the boot sinks further
  const gLee = w.physics.ground('earth', norm(at(1, 0)), {}), gOpen = w.physics.ground('earth', norm(at(1, 14)), {});
  assert.ok(gLee.snowDepth > gOpen.snowDepth + 0.4 * snow0, `snow under the boot: ${gLee.snowDepth.toFixed(3)} m in the drift, ${gOpen.snowDepth.toFixed(3)} m in the open`);
  assert.ok(gLee.sink >= gOpen.sink, `sink ${gLee.sink} against ${gOpen.sink}`);
  assert.equal(D.size, 64); assert.equal(D.cell, 0.5); assert.ok(D.uniforms.uPhysDriftMap.length === 4 && D.uniforms.uPhysDriftLevel[0] > 0);
});

test('cost: a full refresh of the field on arrival, then a few rows a frame', () => {
  const bank = ground((x, z) => Math.max(0, 2 * (1 - Math.abs(x) / 3)) + 0.3 * Math.sin(z));
  const D = new DriftField(), F = frame(), sh = new Float32Array(16);
  const t0 = performance.now(); D.update(1 / 60, F, 0, 0, bank, 9, 0, 0.2, 1, sh, 0); const first = performance.now() - t0;
  let best = 1e9; for (let k = 0; k < 40; k++) { const t1 = performance.now(); for (let i = 0; i < 20; i++) D.update(1 / 60, F, 0, 0, bank, 9, 0, 0.2, 1, sh, 0); best = Math.min(best, (performance.now() - t1) / 20); }
  assert.ok(first < 30 && best < 0.25, `arrival ${first.toFixed(2)} ms, then ${best.toFixed(3)} ms a frame`);
});
