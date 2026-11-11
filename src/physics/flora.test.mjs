// Tests: plants in wind, pushed aside, springing back. Run: node --test src/physics/
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPhysics } from './index.js';
import { FLORA, PlantSim, plantDisplace, treeFrequency, stemFrequency } from './flora.js';
import { FLORA_GLSL } from './flora.glsl.js';
import { oscStep, TAU } from './util.js';
import { makeWorld, V, norm, len } from './testworld.mjs';

const R = 4000;
function world(bodyId = 'earth', biome = 'alpine_meadow') {
  const sample = makeWorld({ R, biome });
  const physics = createPhysics({ sampleSurface: (id, d) => sample(d), seed: 7, timeBudget: false });
  const d = norm(V(0.3, 0.55, 0.78));
  const focus = V(d.x * R, d.y * R, d.z * R);
  return { physics, focus, bodyId, d };
}
function run(w, seconds, { hz = 60, t0 = 100, disturbers = () => [], each } = {}) {
  for (let i = 0; i < Math.round(seconds * hz); i++) {
    const t = t0 + (i + 1) / hz;
    w.physics.update(1 / hz, { bodyId: w.bodyId, time: t, focus: w.focus, disturbers: disturbers(t) });
    if (each) each(t);
  }
}

test('the oscillator step is exact: 60 Hz, 20 Hz and one big step land on the same curve', () => {
  for (const [w, z] of [[TAU * 2.2, 0.38], [TAU * 0.45, 0.12], [TAU * 7, 1.0], [TAU * 3, 2.5]]) {
    const ref = new Float64Array([0.3, -1]); oscStep(ref, 0, 1, w, z, 1.2);
    for (const n of [72, 24, 5]) {
      const s = new Float64Array([0.3, -1]);
      for (let i = 0; i < n; i++) oscStep(s, 0, 1, w, z, 1.2 / n);
      assert.ok(Math.abs(s[0] - ref[0]) < 1e-9 && Math.abs(s[1] - ref[1]) < 1e-8, `w ${w} z ${z} n ${n}`);
    }
  }
});

test('the oscillator never gains energy, even with absurd steps', () => {
  for (const dt of [1 / 60, 1 / 20, 0.25, 5]) for (const [w, z] of [[TAU * 2.2, 0.38], [TAU * 9, 0.05], [TAU * 0.3, 0.0]]) {
    const s = new Float64Array([1, 0]); let e = w * w;
    for (let i = 0; i < 400; i++) { oscStep(s, 0, 0, w, z, dt); const en = w * w * s[0] * s[0] + s[1] * s[1]; assert.ok(en <= e * (1 + 1e-9) + 1e-12, `dt ${dt} w ${w}`); e = en; }
  }
});

test('grass bends downwind, more in gusts, and the bend is bounded', () => {
  const w = world();
  run(w, 20);
  const F = w.physics.fields.flora, air = w.physics.here.air;
  const fr = w.physics.fields.frame;
  const we = air.wind.x * fr.ex + air.wind.y * fr.ey + air.wind.z * fr.ez, wn = air.wind.x * fr.nx + air.wind.y * fr.ny + air.wind.z * fr.nz;
  let along = 0, n = 0, max = 0;
  for (let k = 0; k < 200; k++) {
    const p = V(w.focus.x + fr.ex * ((k % 20) - 10) * 5 + fr.nx * (Math.floor(k / 20) - 5) * 9, w.focus.y + fr.ey * ((k % 20) - 10) * 5 + fr.ny * (Math.floor(k / 20) - 5) * 9, w.focus.z + fr.ez * ((k % 20) - 10) * 5 + fr.nz * (Math.floor(k / 20) - 5) * 9);
    const b = F.plantBend(p, 0);
    assert.ok(Number.isFinite(b.e) && Number.isFinite(b.n));
    assert.ok(b.angle >= 0 && b.angle <= FLORA.flatAngle + 1e-9);
    along += (b.e * we + b.n * wn) / (Math.hypot(we, wn) || 1); n++; max = Math.max(max, b.angle);
  }
  assert.ok(air.speed > 0.5, 'there is wind: ' + air.speed);
  assert.ok(along / n > 0.01, 'mean bend is downwind: ' + along / n);
  assert.ok(max > 0.03 && max < FLORA.softMax, 'largest bend ' + max);
});

test('trees bend far less than grass and sway slower', () => {
  const w = world('earth', 'temperate_forest');
  const g = [], t = [];
  run(w, 40, { each: () => { g.push(w.physics.fields.flora.plantBend(w.focus, 0).angle); t.push(w.physics.fields.flora.plantBend(w.focus, 1).angle); } });
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const rough = (a) => { let s = 0; for (let i = 2; i < a.length; i++) s += Math.abs(a[i] - 2 * a[i - 1] + a[i - 2]); return s / a.length / (mean(a) || 1); };
  assert.ok(mean(t) < FLORA.stiffMax && mean(t) > 0);
  assert.ok(rough(t) < rough(g), 'a tree moves more smoothly than grass');
});

test('the load is dynamic pressure: Venus air bends plants in a breeze, Mars air hardly in a gale, vacuum never', () => {
  const bend = (bodyId) => { const w = world(bodyId); let m = 0, n = 0; run(w, 15, { each: () => { m += w.physics.fields.flora.plantBend(w.focus, 0).angle; n++; } }); return { bend: m / n, wind: w.physics.here.air.speed, rho: w.physics.here.air.density }; };
  const e = bend('earth'), v = bend('venus'), m = bend('mars'), moon = bend('moon');
  assert.equal(moon.bend, 0);
  assert.ok(v.wind < e.wind, 'Venus wind is slower');
  const q = (x) => 0.5 * x.rho * x.wind * x.wind;
  assert.ok(m.bend < e.bend * 0.25 || q(m) > q(e), `Mars ${m.bend} (q ${q(m)}) vs Earth ${e.bend} (q ${q(e)})`);
  assert.ok((v.bend > e.bend) === (q(v) > q(e)), `Venus ${v.bend} (q ${q(v)}) vs Earth ${e.bend} (q ${q(e)})`);
});

test('the explorer pushes grass aside; it springs back, damped, and is still again', () => {
  const w = world();
  run(w, 2);
  const F = w.physics.fields.flora, fr = w.physics.fields.frame;
  const beside = V(w.focus.x + fr.ex * 0.5, w.focus.y + fr.ey * 0.5, w.focus.z + fr.ez * 0.5);
  const before = F.plantBend(beside, 0);
  const body = [{ kind: 'explorer', p: w.focus, v: V(), radius: 0.35, strength: 1, grounded: true }];
  run(w, 1.0, { t0: 102, disturbers: () => body });
  const pushed = F.plantBend(beside, 0);
  assert.ok(pushed.e > before.e + 0.4, `pushed east: ${before.e} -> ${pushed.e}`);
  assert.ok(F.plantBend(w.focus, 0).flatten01 > 0.9, 'flattened under the feet');
  assert.ok(F.plantBend(beside, 1).angle < pushed.angle * 0.3, 'a trunk barely gives');
  assert.ok(w.physics.stats.pushCells > 4);
  // release: record the spring-back
  const trace = [];
  run(w, 6, { t0: 103, each: () => trace.push(F.plantBend(beside, 0).e - before.e) });
  let peak = 0; for (let i = 60; i < trace.length; i++) peak = Math.max(peak, Math.abs(trace[i]));
  assert.ok(Math.abs(trace[30]) < Math.abs(trace[0]) * 0.6, 'half a second later it has mostly sprung back');
  assert.ok(peak < Math.abs(trace[0]) * 0.35, 'and the swing dies away');
  // trampled grass stays down for a minute or so, then the field goes back to sleep
  run(w, 20, { t0: 109, hz: 20 });
  const tr = F.plantBend(w.focus, 0).flatten01;
  assert.ok(tr > 0.05 && tr < 0.6, 'trampled patch after 27 s: ' + tr);
  run(w, 420, { t0: 129, hz: 10 });
  assert.equal(w.physics.stats.pushCells, 0, 'the push field goes back to sleep');
  assert.ok(Math.abs(F.plantBend(w.focus, 0).flatten01) < 1e-6);
});

test('a jet from above blows plants radially outward and flattens the centre', () => {
  const w = world();
  run(w, 2);
  const F = w.physics.fields.flora, fr = w.physics.fields.frame;
  const up = norm(w.focus), jetP = V(w.focus.x + up.x * 3, w.focus.y + up.y * 3, w.focus.z + up.z * 3);
  const jet = [{ kind: 'jet', p: jetP, v: V(), radius: 0.15, strength: 1700 }];
  const at = (e, n) => V(w.focus.x + fr.ex * e + fr.nx * n, w.focus.y + fr.ey * e + fr.ny * n, w.focus.z + fr.ez * e + fr.nz * n);
  const b0 = F.plantBend(at(1.5, 0), 0).e, c0 = F.plantBend(at(-1.5, 0), 0).e;
  run(w, 1.5, { t0: 102, disturbers: () => jet });
  assert.ok(F.plantBend(at(1.5, 0), 0).e > b0 + 0.3, 'blown east on the east side');
  assert.ok(F.plantBend(at(-1.5, 0), 0).e < c0 - 0.3, 'blown west on the west side');
  assert.ok(F.plantBend(at(0, 1.5), 0).n > 0.3, 'blown north on the north side');
  assert.ok(F.plantBend(at(8, 0), 0).shake01 < F.plantBend(at(1.5, 0), 0).shake01, 'weaker further out');
  // from 60 m up the plume has spread over 700 m2 (momentum is conserved, pressure is not):
  // 1700 N / 720 m2 = 2.4 Pa, a breath. From 300 m: nothing.
  const far = (h) => { const w2 = world(); run(w2, 2); const b0 = F2(w2).plantBend(w2.focus, 0).angle; const j = [{ kind: 'jet', p: V(w2.focus.x + up.x * h, w2.focus.y + up.y * h, w2.focus.z + up.z * h), v: V(), radius: 0.15, strength: 1700 }]; run(w2, 1.5, { t0: 102, disturbers: () => j }); return { w2, d: Math.abs(F2(w2).plantBend(V(w2.focus.x + fr.ex * 6, w2.focus.y + fr.ey * 6, w2.focus.z + fr.ez * 6), 0).load) }; };
  const F2 = (x) => x.physics.fields.flora;
  const h60 = far(60), h300 = far(300);
  assert.ok(h60.d < 0.25, 'load 6 m off-axis under a jet 60 m up: ' + h60.d);
  assert.equal(h300.w2.physics.stats.pushCells, 0);
});

test('a body flying overhead does not touch the grass', () => {
  const w = world(); run(w, 1);
  const up = norm(w.focus);
  const body = [{ kind: 'explorer', p: V(w.focus.x + up.x * 4, w.focus.y + up.y * 4, w.focus.z + up.z * 4), v: V(), radius: 0.35, strength: 1, grounded: false }];
  run(w, 1, { t0: 101, disturbers: () => body });
  assert.equal(w.physics.stats.pushCells, 0);
});

test('20 Hz and 60 Hz give the same field (exact integration)', () => {
  const a = world(), b = world();
  run(a, 12, { hz: 60 }); run(b, 12, { hz: 20 });
  const A = a.physics.fields.flora.bend, B = b.physics.fields.flora.bend;
  let worst = 0, mag = 0;
  for (let i = 0; i < A.length; i++) { worst = Math.max(worst, Math.abs(A[i] - B[i])); mag = Math.max(mag, Math.abs(A[i])); }
  assert.ok(mag > 0.001 && worst < 0.12 * mag + 1e-4, `largest difference ${worst} of ${mag}`);
});

test('waves travel through a meadow: neighbouring plants are coherent, distant ones are not in step', () => {
  const w = world();
  run(w, 10);
  const F = w.physics.fields.flora, fr = w.physics.fields.frame;
  const at = (e) => V(w.focus.x + fr.ex * e, w.focus.y + fr.ey * e, w.focus.z + fr.ez * e);
  const series = (e) => { const s = []; run(w, 0, {}); return s; };
  const a = [], b = [], c = [];
  run(w, 30, { t0: 110, each: () => { a.push(F.plantBend(at(0), 0).angle); b.push(F.plantBend(at(0.6), 0).angle); c.push(F.plantBend(at(45), 0).angle); } });
  const corr = (x, y) => { const mx = x.reduce((p, q) => p + q) / x.length, my = y.reduce((p, q) => p + q) / y.length; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; } return sxy / Math.sqrt(sxx * syy + 1e-30); };
  assert.ok(corr(a, b) > 0.95, 'plants 0.6 m apart move together: ' + corr(a, b));
  assert.ok(corr(a, c) < 0.9, 'plants 45 m apart do not: ' + corr(a, c));
  // no shimmer: frame-to-frame change of the bend is small
  let worst = 0; for (let i = 1; i < a.length; i++) worst = Math.max(worst, Math.abs(a[i] - a[i - 1]));
  assert.ok(worst < 0.03, 'largest change of bend in one frame: ' + worst + ' rad');
});

test('a single PlantSim agrees with the field for a plant of the reference frequency', () => {
  const w = world();
  const plant = new PlantSim({ height: 0.5, stiff01: 0, hz: FLORA.softHz, damping: FLORA.softDamp });
  plant.damping = FLORA.softDamp / (0.6 + 0.4);      // Earth air: the density term is 1
  const F = w.physics.fields.flora.field, fr = w.physics.fields.frame;
  let err = 0, n = 0, mag = 0;
  run(w, 30, { each: () => {
    // the same wind the field cell sees: 2 m wind scaled back to blade height through the field's own factors
    const x = fr.lx(w.focus.x, w.focus.y, w.focus.z), z = fr.lz(w.focus.x, w.focus.y, w.focus.z);
    // (sampled at the centre of the field cell the plant is compared with)
    const cx = (F.ci + 0.5) * F.cell, cz = (F.cj + 0.5) * F.cell;
    const s = new Float64Array(7); w.physics.fields.air.sampleWind(cx, cz, s);
    plant.step(1 / 60, s[0] * s[4], s[1] * s[4], w.physics.here.air.density);
    const i = (F.N / 2) * F.N + F.N / 2;
    const fe = F.bend[i * 4], fn = F.bend[i * 4 + 1];
    if (w.physics.time > 110) { err += Math.hypot(plant.s[0] - fe, plant.s[2] - fn); mag += Math.hypot(fe, fn); n++; }
  } });
  assert.ok(mag / n > 1e-4);
  assert.ok(err / mag < 0.35, `plant vs field cell: ${err / n} of ${mag / n}`);
});

test('plant shape: a bent stem keeps its length and leans most at the tip', () => {
  for (const ang of [0.1, 0.6, 1.2]) {
    const tip = plantDisplace(1, 1, ang, 0), mid = plantDisplace(0.5, 1, ang, 0), root = plantDisplace(0, 1, ang, 0);
    assert.ok(Math.abs(Math.hypot(tip.e, tip.up) - 1) < 1e-9, 'tip stays 1 m from the root');
    assert.ok(root.e === 0 && root.up === 0);
    assert.ok(mid.e / 0.5 < tip.e / 1, 'the stem curves');
    assert.ok(tip.up < 1 && tip.up > 0);
  }
  const d = plantDisplace(1, 1, 0.3, 0.4);
  assert.ok(Math.abs(d.n / d.e - 0.4 / 0.3) < 1e-9, 'displacement follows the bend direction');
});

test('natural frequencies fall with size', () => {
  assert.ok(Math.abs(treeFrequency(20, 0.3) - 0.352) < 0.01, 'a 20 m pine: ' + treeFrequency(20, 0.3));
  assert.ok(treeFrequency(10, 0.15) > treeFrequency(20, 0.3) && treeFrequency(30, 0.5) < 0.3);
  assert.ok(stemFrequency(0.3) > 3 && stemFrequency(2) < 1.1 && stemFrequency(0.3) > stemFrequency(1));
});

test('the GLSL chunk is self-consistent with the JS model', () => {
  for (const name of ['pcPhysBend', 'pcPhysDisplace', 'pcPhysWind', 'pcPhysTex', 'uPhysBend', 'uPhysWind', 'uPhysPush', 'uPhysAnchor', 'uPhysEast', 'uPhysNorth', 'uPhysWindMap', 'uPhysNearMap', 'uPhysWave', 'uPhysWavePhase', 'uPhysShape']) assert.ok(FLORA_GLSL.includes(name), name);
  assert.ok(FLORA_GLSL.includes(String(FLORA.flatAngle)));
  const w = world(); run(w, 1);
  const U = w.physics.fields.flora.uniforms;
  for (const k of Object.keys(U)) { assert.ok(FLORA_GLSL.includes(k), 'uniform ' + k + ' is declared in the chunk'); for (const v of U[k]) assert.ok(Number.isFinite(v), k); }
  assert.deepEqual(U.uPhysShape, [FLORA.softFlex, FLORA.softMax, FLORA.stiffFlex, FLORA.stiffMax]);
  assert.equal(U.uPhysWindMap[3], 32); assert.equal(U.uPhysNearMap[3], 64);
  // braces balance
  assert.equal((FLORA_GLSL.match(/{/g) || []).length, (FLORA_GLSL.match(/}/g) || []).length);
});
