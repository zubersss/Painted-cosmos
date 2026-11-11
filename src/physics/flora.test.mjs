// Tests: plants in wind, pushed aside, springing back. Run: node --test src/physics/
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPhysics } from './index.js';
import { FLORA, PlantSim, plantDisplace, plantBranch, BRANCH_F, BRANCH_M, treeFrequency, stemFrequency } from './flora.js';
import { FLORA_GLSL } from './flora.glsl.js';
import { oscStep, TAU } from './util.js';
import { setWindScale, WINDS } from './wind.js';
import { makeWorld, V, norm, len } from './testworld.mjs';

const R = 4000;
function world(bodyId = 'earth', biome = 'alpine_meadow', dir = V(0.3, 0.55, 0.78)) {
  const sample = makeWorld({ R, biome });
  const physics = createPhysics({ sampleSurface: (id, d) => sample(d), seed: 7, timeBudget: false });
  const d = norm(dir);
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
  // (P7: it comes back to the lean it keeps for a while, the wake, not all the way; that goes in some eight seconds)
  assert.ok(Math.abs(trace[30]) < Math.abs(trace[0]) * 0.8 && trace[30] > trace[0] * 0.2,   // (the probe, half a metre off, is inside the pressed zone since flatReach)
     `half a second later it has sprung back to its wake lean: ${trace[30] / trace[0]}`);
  assert.ok(peak < Math.abs(trace[0]) * 0.62, 'and the swing dies away');
  const end = trace[trace.length - 1] / trace[0];
  assert.ok(end > 0.05 && end < 0.45, `six seconds later some of the lean is left: ${end}`);
  // trampled grass stays down for a minute or so, then the field goes back to sleep
  run(w, 20, { t0: 109, hz: 20 });
  const tr = F.plantBend(w.focus, 0).flatten01;
  assert.ok(tr > 0.05 && tr < 0.6, 'trampled patch after 27 s: ' + tr);
  run(w, 420, { t0: 129, hz: 10 });
  assert.equal(w.physics.stats.pushCells, 0, 'the push field goes back to sleep');
  assert.ok(Math.abs(F.plantBend(w.focus, 0).flatten01) < 1e-6);
});

test('a walker leaves a parted wake: about two metres wide where they are, leaning out and along their path, trailing metres behind, gone in half a minute', () => {
  // two worlds alike, one with a walker: what differs is the walker's doing (the wind is the same in both)
  const w = world(), c = world();
  run(w, 2); run(c, 2);
  const F = w.physics.fields.flora, G = c.physics.fields.flora, fr = w.physics.fields.frame;
  const at = (e, n) => V(w.focus.x + fr.ex * e + fr.nx * n, w.focus.y + fr.ey * e + fr.ny * n, w.focus.z + fr.ez * e + fr.nz * n);
  const d = (e, n) => { const a = F.plantBend(at(e, n), 0), b = G.plantBend(at(e, n), 0); return { n: a.n - b.n, e: a.e - b.e, flat: a.flatten01 }; };
  // walk east at 1.5 m/s for 6 s: from 9 m west of the focus to the focus
  const speed = 1.5, T = 6;
  const body = (t) => [{ kind: 'explorer', p: at(-speed * (T - (t - 102)), 0), v: V(fr.ex * speed, fr.ey * speed, fr.ez * speed), radius: 0.35, strength: 1, grounded: true }];
  run(w, T, { t0: 102, disturbers: body }); run(c, T, { t0: 102 });
  // where the walker is: parted on both sides, out to a metre from the path (two metres wide), not at a metre and a half
  assert.ok(d(0, 0.6).n > 0.6 && d(0, -0.6).n < -0.6 && d(0, 1).n > 0.25, `parted beside the walker: ${d(0, 0.6).n}, ${d(0, -0.6).n}; a metre off ${d(0, 1).n}`);
  assert.ok(Math.abs(d(0, 1.5).n) < 0.02, 'not a metre and a half away');
  // behind: 3 m back (2 s ago) the grass still leans out and along the path; 7.5 m back (5 s ago) less
  const b3l = d(-3, 0.6), b3r = d(-3, -0.6), b7 = d(-7.5, 0.6);
  assert.ok(b3l.n > 0.2 && b3r.n < -0.2 && b3l.n < 0.7 * d(0, 0.6).n, `the wake 3 m behind leans out: ${b3l.n}, ${b3r.n}`);
  assert.ok(b3l.e > 0.08 && b3r.e > 0.08, `and along the path: ${b3l.e}`);
  assert.ok(b7.n > 0.1 && b7.n < b3l.n, `7.5 m behind less: ${b7.n}`);
  // on the path itself the grass is pressed down (trampled), still so behind
  assert.ok(d(-3, 0).flat > 0.15 && d(-7.5, 0).flat > 0.15, `trampled on the path: ${d(-3, 0).flat}`);
  // ahead of the walker nothing has moved
  assert.ok(Math.abs(d(2.5, 0.6).n) < 1e-6 && Math.abs(d(2.5, 0.6).e) < 1e-6, 'nothing ahead');
  // the walker is gone: half a minute later the wake has closed (the trampled path is still faintly there)
  run(w, 30, { t0: 108, hz: 20 }); run(c, 30, { t0: 108, hz: 20 });
  // (what is left is the pressed grass answering the wind differently, not a lean)
  assert.ok(Math.abs(d(-3, 0.6).n) < 0.25 * b3l.n, `closed: ${d(-3, 0.6).n} against ${b3l.n}`);
  assert.ok(d(-3, 0).flat > 0.05, 'the path is still faintly pressed');
  run(w, 420, { t0: 138, hz: 10 });
  assert.equal(w.physics.stats.pushCells, 0, 'and the field sleeps again');
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
    const s = new Float64Array(8); w.physics.fields.air.sampleWind(cx, cz, s);
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

test('plants shelter each other: the wind is slower in the lee of a wood, and recovers downwind and overhead', () => {
  // find which way the wind blows here, then plant a round wood upwind of the focus
  const probe = world(); run(probe, 1);
  const a0 = probe.physics.here.air, sp0 = a0.speed;
  assert.ok(sp0 > 0.5);
  const wdir = norm(a0.wind), up = norm(probe.focus);
  const upwind = norm(V(probe.focus.x - wdir.x * 62, probe.focus.y - wdir.y * 62, probe.focus.z - wdir.z * 62));
  const sample = makeWorld({ R, biome: 'alpine_meadow', stand: { dir: upwind, radius: 30, canopy01: 0.9, canopyHeight: 14 } });
  const physics = createPhysics({ sampleSurface: (id, d) => sample(d), seed: 7, timeBudget: false });
  const w = { physics, focus: probe.focus, bodyId: 'earth' };
  run(w, 3);
  const side = norm(V(up.y * wdir.z - up.z * wdir.y, up.z * wdir.x - up.x * wdir.z, up.x * wdir.y - up.y * wdir.x));
  const at = (along, across, h) => { const p = V(w.focus.x + wdir.x * along + side.x * across, w.focus.y + wdir.y * along + side.y * across, w.focus.z + wdir.z * along + side.z * across); const l = len(p); return physics.air('earth', V(p.x * R / l, p.y * R / l, p.z * R / l), {}, h).speed; };
  // 32 m behind the edge of the wood (about two tree heights) against the same distance out to the side
  const lee = at(0, 0, 2), open = (at(0, 90, 2) + at(0, -90, 2)) / 2;
  assert.ok(lee < open * 0.75, `in the lee ${lee.toFixed(2)} m/s, in the open ${open.toFixed(2)} m/s`);
  const far = at(60, 0, 2);
  assert.ok(far > lee * 1.15, `further downwind it recovers: ${far.toFixed(2)}`);
  const over = at(0, 0, 28), overOpen = (at(0, 90, 28) + at(0, -90, 28)) / 2;
  assert.ok(over > overOpen * 0.85, `above the tree tops there is no shelter: ${over.toFixed(2)} vs ${overOpen.toFixed(2)}`);
  // and the grass in the lee bends less than the grass in the open
  const F = physics.fields.flora;
  const bend = (along, across) => { let s = 0; for (let k = 0; k < 120; k++) { run(w, 1 / 60, { t0: 200 + k / 60 }); s += F.plantBend(V(w.focus.x + wdir.x * along + side.x * across, w.focus.y + wdir.y * along + side.y * across, w.focus.z + wdir.z * along + side.z * across), 0).load; } return s / 120; };
  assert.ok(bend(0, 0) < bend(0, 90) * 0.8);
});

test('crowns load their neighbours: a push on one crown spreads through a closed wood, not through scattered trees', () => {
  const spread = (canopy01) => {
    const mk = () => {
      const sample = makeWorld({ R, biome: 'alpine_meadow', stand: { dir: norm(V(0.3, 0.55, 0.78)), radius: 5000, canopy01, canopyHeight: 14 } });
      const physics = createPhysics({ sampleSurface: (id, d) => sample(d), seed: 7, timeBudget: false });
      const w = { physics, focus: V(...Object.values(norm(V(0.3, 0.55, 0.78))).map((c) => c * R)), bodyId: 'earth' };
      run(w, 4);
      return w;
    };
    const a = mk(), b = mk();
    const N = 32, o = ((N / 2) * N + N / 2) * 4;
    b.physics.fields.flora.field.bend[o + 2] += 1;                 // one crown shoved a long way east
    run(a, 0.7, { t0: 104 }); run(b, 0.7, { t0: 104 });
    const A = a.physics.fields.flora.bend, B = b.physics.fields.flora.bend;
    const nb = (B[o + 4 + 2] - A[o + 4 + 2] + B[o - 4 + 2] - A[o - 4 + 2] + B[o + N * 4 + 2] - A[o + N * 4 + 2] + B[o - N * 4 + 2] - A[o - N * 4 + 2]) / 4;
    let total = 0; for (let k = 2; k < A.length; k += 4) total += Math.abs(B[k] - A[k]);
    return { neighbours: nb, self: B[o + 2] - A[o + 2], total };
  };
  const closed = spread(1), open = spread(0.05);
  assert.ok(Math.abs(open.neighbours) < 1e-9, 'scattered trees do not touch: ' + open.neighbours);
  assert.ok(Math.abs(closed.neighbours) > 0.01, 'in a closed canopy the neighbours are moved: ' + closed.neighbours);
  assert.ok(Math.abs(closed.self) < Math.abs(open.self), `and the shoved crown is held back: ${closed.self.toFixed(3)} against ${open.self.toFixed(3)}`);
  assert.ok(closed.total < 4 && open.total < 4, 'nothing grows');
});

test('gusts travel through the grass: a plant downwind bends like its upwind neighbour, a moment later', () => {
  const s0 = WINDS.earth.scale;
  try {
    setWindScale('earth', 0.35);                        // a windy day, so that gusts cross the gap in seconds
    const w = world('earth', 'alpine_meadow', V(0.6, 0.04, 0.8)); run(w, 5);      // in the trade winds
    const F = w.physics.fields.flora, air = w.physics.fields.air, fr = w.physics.fields.frame;
    const u = Math.hypot(air.cwe, air.cwn), de = air.cwe / u, dn = air.cwn / u, gap = 32;
    assert.ok(u > 4, 'wind ' + u);
    const at = (m) => V(w.focus.x + (fr.ex * de + fr.nx * dn) * m, w.focus.y + (fr.ey * de + fr.ny * dn) * m, w.focus.z + (fr.ez * de + fr.nz * dn) * m);
    const a = [], b = [];
    run(w, 90, { t0: 105, hz: 30, each: () => { a.push(F.plantBendLite(at(0), 0).load); b.push(F.plantBendLite(at(gap), 0).load); } });
    const corr = (lag) => { let sxy = 0, sxx = 0, syy = 0, mx = 0, my = 0; const n = a.length - lag; for (let i = 0; i < n; i++) { mx += a[i]; my += b[i + lag]; } mx /= n; my /= n; for (let i = 0; i < n; i++) { sxy += (a[i] - mx) * (b[i + lag] - my); sxx += (a[i] - mx) ** 2; syy += (b[i + lag] - my) ** 2; } return sxy / Math.sqrt(sxx * syy + 1e-30); };
    let best = -1, bestLag = 0;
    for (let lag = 0; lag < 30 * 15; lag++) { const c = corr(lag); if (c > best) { best = c; bestLag = lag; } }
    const lagS = bestLag / 30, expect = gap / u;
    assert.ok(best > 0.6, 'the downwind plant repeats the upwind one: correlation ' + best.toFixed(2));
    assert.ok(lagS > expect * 0.5 && lagS < expect * 2, `after ${lagS.toFixed(1)} s; the wind (${u.toFixed(1)} m/s) covers ${gap} m in ${expect.toFixed(1)} s`);
    assert.ok(corr(0) < best - 0.03, 'and not at the same moment');
  } finally { setWindScale('earth', s0); }
});

test('branches: a crown does not sway as one piece; nothing moves at the trunk, nothing tears, and it is bounded', () => {
  const w = world('earth', 'temperate_forest');
  const F = w.physics.fields.flora, H = 12, L = FLORA.crown * H;
  run(w, 20);
  const bend = F.plantBend(w.focus, 1);
  assert.ok(bend.angle > 0.002, `the tree leans ${bend.angle.toFixed(4)} rad`);
  const o = {}, at = (az, x, s) => { F.plantBranch(Math.cos(az) * x * L, Math.sin(az) * x * L, s * H, H, w.focus, bend, o); return [o.e, o.n, o.up]; };
  // at the trunk: nothing. Along a branch: more toward the tip, as a cantilever (x^2 (3 - x) / 2)
  assert.deepEqual(at(0.7, 0, 0.6), [0, 0, 0]);
  const m = (v) => Math.hypot(v[0], v[1], v[2]);
  const half = m(at(0.7, 0.5, 0.6)), tip = m(at(0.7, 1, 0.6));
  assert.ok(Math.abs(half / tip - 0.3125) < 1e-9, `half way out moves ${half / tip} of the tip`);
  // all the way round the trunk the motion is continuous (whole lobes): no seam where atan2 wraps
  let jump = 0, prev = at(-Math.PI, 1, 0.6);
  for (let k = 1; k <= 720; k++) { const v = at(-Math.PI + k * Math.PI / 360, 1, 0.6); jump = Math.max(jump, m([v[0] - prev[0], v[1] - prev[1], v[2] - prev[2]])); prev = v; }
  const seam = m(at(Math.PI - 1e-7, 1, 0.6).map((v, i) => v - at(-Math.PI + 1e-7, 1, 0.6)[i]));
  assert.ok(seam < 1e-6 * L && jump < 0.05 * tip + 1e-9 + 0.03 * FLORA.branchGain * bend.angle * L, `seam ${seam}, largest step round the crown ${jump}`);
  for (const mm of BRANCH_M) assert.equal(mm, Math.round(mm));
  // over time: opposite sides of the crown are out of step, each moves at branch rates (faster
  // than the trunk), and no tip ever swings further than its bound
  const east = [], west = [], lean = [];
  run(w, 30, { t0: 120, each: () => { const b = F.plantBend(w.focus, 1); lean.push(b.angle); F.plantBranch(L, 0, 0.7 * H, H, w.focus, b, o); east.push(o.up); F.plantBranch(-L, 0, 0.7 * H, H, w.focus, b, o); west.push(o.up); } });
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length, c = (a, b) => { const ma = mean(a), mb = mean(b); let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < a.length; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; } return sab / Math.sqrt(saa * sbb); };
  assert.ok(Math.abs(c(east, west)) < 0.6, `east and west tips correlate ${c(east, west).toFixed(2)}`);
  const crossings = (a) => { const ma = mean(a); let n = 0; for (let i = 1; i < a.length; i++) if ((a[i] - ma) * (a[i - 1] - ma) < 0) n++; return n / 2 / 30; };   // Hz
  assert.ok(crossings(east) > 2 * FLORA.stiffHz && crossings(east) < FLORA.branchHz * Math.max(...BRANCH_F) * 1.2, `a tip bobs at about ${crossings(east).toFixed(2)} Hz; the trunk sways at ${FLORA.stiffHz}`);
  const bound = (FLORA.branchGain * Math.max(...lean) + 0) * L;
  assert.ok(Math.max(...east.map(Math.abs)) <= bound + 1e-9, `largest bob ${Math.max(...east.map(Math.abs)).toFixed(3)} m of ${bound.toFixed(3)} m`);
  assert.ok(Math.max(...east.map(Math.abs)) > 0.002, 'and it does move');
  // two trees side by side are not in step either (each has its own number)
  const U = F.uniforms, a1 = {}, a2 = {};
  plantBranch(L, 0, 8, H, 10.2, 3.1, 0.1, 0, 0, U, a1); plantBranch(L, 0, 8, H, 14.9, 3.1, 0.1, 0, 0, U, a2);
  assert.ok(Math.abs(a1.up - a2.up) > 1e-4);
});

test('branches follow the wind on the tree and how gusty it is; a brushed crown shivers; calm air leaves them still', () => {
  const U = { uPhysBranch: [0, FLORA.branchGain, FLORA.branchShake, FLORA.crown], uPhysBranchPhase: [0.3, 1.1, 2.0, 4.4] };
  const H = 10, L = FLORA.crown * H, o = {};
  const amp = (be, shake, gust) => { U.uPhysBranch[0] = gust; let mx = 0; for (let k = 0; k < 400; k++) { for (let i = 0; i < 4; i++) U.uPhysBranchPhase[i] = k * 0.37 * BRANCH_F[i]; plantBranch(L, 0, 7, H, 3, 4, be, 0, shake, U, o); mx = Math.max(mx, Math.hypot(o.e, o.n, o.up)); } return mx; };
  assert.equal(amp(0, 0, 1), 0, 'no lean, nothing shaken: still');
  const calm = amp(0.1, 0, 0), gusty = amp(0.1, 0, 1), storm = amp(0.2, 0, 1);
  assert.ok(gusty > 2 * calm && calm > 0, `the same lean: ${calm.toFixed(3)} m in smooth air, ${gusty.toFixed(3)} m in gusty air`);
  assert.ok(Math.abs(storm / gusty - 2) < 0.05, 'twice the lean, twice the swing');
  // a 3.5 m branch on a tree leaning 0.1 rad in gusty air: tips move a few decimetres at most
  assert.ok(gusty > 0.15 && gusty < 0.5, `${gusty}`);
  const shiver = amp(0, 1, 0);
  assert.ok(shiver > 0.15 && shiver < 1.3 * FLORA.branchShake * L, `a shaken crown in still air: ${shiver.toFixed(3)} m`);
  // the phases the field hands out advance at the four rates and stay wrapped
  const w = world('earth', 'temperate_forest'); run(w, 1);
  const P0 = w.physics.fields.flora.uniforms.uPhysBranchPhase.slice(); run(w, 0.1, { t0: 101 });
  const P1 = w.physics.fields.flora.uniforms.uPhysBranchPhase;
  for (let i = 0; i < 4; i++) { const d = ((P1[i] - P0[i]) % TAU + TAU) % TAU; assert.ok(Math.abs(d - TAU * FLORA.branchHz * BRANCH_F[i] * 0.1) < 1e-6, `oscillator ${i}`); assert.ok(P1[i] >= 0 && P1[i] < TAU); }
  const g = w.physics.fields.flora.uniforms.uPhysBranch[0]; assert.ok(g >= 0 && g <= 1);
  for (const name of ['pcPhysBranch', 'uPhysBranch', 'uPhysBranchPhase']) assert.ok(FLORA_GLSL.includes(name), name);
});
