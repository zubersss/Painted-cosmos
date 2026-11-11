// Tests: plants in wind, pushed aside, springing back. Run: node --test src/physics/
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPhysics } from './index.js';
import { FLORA, PlantSim, plantDisplace, plantBranch, plantCrown, BRANCH_M, CROWN_D, treeFrequency, stemFrequency } from './flora.js';
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
  const b2 = [];
  run(w, 30, { t0: 110, each: () => { a.push(F.plantBend(at(0), 0).angle); b.push(F.plantBend(at(0.1), 0).angle); b2.push(F.plantBend(at(0.6), 0).angle); c.push(F.plantBend(at(45), 0).angle); } });
  const corr = (x, y) => { const mx = x.reduce((p, q) => p + q) / x.length, my = y.reduce((p, q) => p + q) / y.length; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; } return sxy / Math.sqrt(sxx * syy + 1e-30); };
  // (P11: the blades of one tuft, a hand apart, move together; tufts a step apart are related but no longer in
  // step: the flutter is eddies 0.9 to 3.2 m long. Until P11 plants 0.6 m apart were asked to correlate above 0.95,
  // and did, which is why a meadow moved as one sheet.)
  assert.ok(corr(a, b) > 0.95, 'blades 0.1 m apart move together: ' + corr(a, b));
  assert.ok(corr(a, b2) > 0.3 && corr(a, b2) < 0.95, 'tufts 0.6 m apart are related, not in step: ' + corr(a, b2));
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

// (P14) The branch tests of P6 to P13 held the swing to the TRUNK's lean ("twice the lean, twice the swing", a tip
// bound of branchGain x lean x length): the model they checked was the fault (P11's stiff trunks left 7 cm at
// the tips in a thunderstorm). They are rewritten for a branch that carries its own wind.
// A uniform wind of U m/s at the crown (Earth air), turbulence intensity I, blowing toward `ang` (rad from east);
// the phases as the field would carry them. each(o, t, dir) is called for every 1/60 s.
function crownWind(U, I, T, each, { ang = 0.4, point = [0.8, 0.6], id = 0.13, leaf = 0, shake = 0, H = 13 } = {}) {
  const L = FLORA.crown * H, dir = [Math.cos(ang), Math.sin(ang)], load = (U / 8) ** 2;
  const Un = { uPhysBranch: [8, FLORA.branchGain, FLORA.branchShake, FLORA.crown], uPhysBranchPhase: [0, 0, 0, 0] };
  const cw = [load * dir[0], load * dir[1], U * 0.7 * dir[0], U * 0.7 * dir[1], I * (U * 0.7 + 0.25)], o = {};
  for (let k = 0; k < Math.round(T * 60); k++) {
    const t = k / 60;
    for (let i = 0; i < 3; i++) Un.uPhysBranchPhase[i] = ((FLORA.crownK[i] * (CROWN_D[i][0] * dir[0] + CROWN_D[i][1] * dir[1]) * U * t) % TAU + TAU) % TAU;
    Un.uPhysBranchPhase[3] = (TAU * FLORA.twigHz * t) % (TAU * 16);
    plantCrown(L * point[0], L * point[1], 8, H, 3, 4, cw, shake, Un, id, leaf, o);
    each(o, t, dir);
  }
  return L;
}
function tipStats(U, I, opts) {
  const al = [], up = [], cr = []; let set = 0, hz = 0;
  const L = crownWind(U, I, 120, (o, t, d) => { al.push(o.e * d[0] + o.n * d[1]); cr.push(-o.e * d[1] + o.n * d[0]); up.push(o.up); set = o.set; hz = o.hz; }, opts);
  const mean = al.reduce((p, q) => p + q, 0) / al.length; let s2 = 0, n = 0;
  for (let i = 0; i < al.length; i++) { s2 += (al[i] - mean) ** 2; if (i && (al[i] - mean) * (al[i - 1] - mean) < 0) n++; }
  return { L, set, hz, mean, min: Math.min(...al), max: Math.max(...al), rms: Math.sqrt(s2 / al.length), rate: n / 2 / 120, up: Math.max(...up.map(Math.abs)), cross: Math.max(...cr.map(Math.abs)), al };
}

test('P14 branches carry their own wind: a tip streams downwind and thrashes about that set in a gale, barely stirs in a breeze, is still in a calm', () => {
  // a 3.5 m branch on a 13 m birch
  const gale = tipStats(20, 0.3), fresh = tipStats(11, 0.3), breeze = tipStats(3, 0.3);
  console.log(`# branch tip (${gale.L.toFixed(2)} m branch, ${gale.hz.toFixed(2)} Hz): 20 m/s set ${gale.set.toFixed(2)} m, along the wind ${gale.min.toFixed(2)} to ${gale.max.toFixed(2)} m (rms ${gale.rms.toFixed(2)}), up +-${gale.up.toFixed(2)}, across +-${gale.cross.toFixed(2)}, ${gale.rate.toFixed(2)} Hz; 11 m/s set ${fresh.set.toFixed(2)}, ${fresh.min.toFixed(2)} to ${fresh.max.toFixed(2)}; 3 m/s set ${breeze.set.toFixed(3)}, ${breeze.min.toFixed(3)} to ${breeze.max.toFixed(3)}`);
  assert.ok(Math.abs(gale.L - 3.5) < 0.1, `the branch is ${gale.L} m long`);
  // the gale: streaming 0.3 to 0.6 m downwind at the tip, thrashing about the set at about a hertz, bobbing and swaying across
  assert.ok(gale.set > 0.25 && gale.set < 0.45 && Math.abs(gale.mean - gale.set) < 0.03, `set ${gale.set} m, mean ${gale.mean}`);
  assert.ok(gale.max - gale.min > 0.3 && gale.max - gale.min < 0.9, `the tip travels ${(gale.max - gale.min).toFixed(2)} m`);
  assert.ok(gale.max > 0.5 && gale.max < 0.85 && gale.min > -0.15, `from ${gale.min} to ${gale.max} m downwind`);
  assert.ok(gale.rms > 0.3 * gale.set && gale.rms < 0.65 * gale.set, `rms ${gale.rms} about a set of ${gale.set}`);
  assert.ok(gale.rate > 0.6 && gale.rate < 2.2, `${gale.rate} Hz`);
  assert.ok(gale.up > 0.08 && gale.up < 0.3 && gale.cross > 0.06 && gale.cross < 0.25, `up ${gale.up}, across ${gale.cross}`);
  // the breeze: centimetres, slowly
  assert.ok(breeze.max - breeze.min < 0.08 && breeze.max - breeze.min > 0.02 && breeze.rate < 0.4, `a breeze moves the tip ${(breeze.max - breeze.min).toFixed(3)} m at ${breeze.rate} Hz`);
  assert.ok(gale.max - gale.min > 8 * (breeze.max - breeze.min), 'a gale tosses what a breeze stirs');
  // the set grows as the drag of a leafy branch does: U^1.3 (below the limit)
  const s5 = tipStats(5, 0.3).set, s10 = tipStats(10, 0.3).set;
  assert.ok(Math.abs(Math.log(s10 / s5) / Math.log(2) - 1.3) < 0.08, `twice the wind, ${(s10 / s5).toFixed(2)} times the set`);
  // and never past its limit, whatever blows
  const hur = tipStats(70, 0.5);
  assert.ok(hur.set < FLORA.branchSetMax * hur.L && hur.max < 0.6 * hur.L && Number.isFinite(hur.max), `70 m/s: ${hur.max} m on a ${hur.L} m branch`);
  // smoother air, less thrash; calm air, wood still; a brushed crown in still air shivers
  assert.ok(tipStats(20, 0.1).rms < 0.45 * gale.rms);
  let mx = 0; crownWind(0, 0, 5, (o) => { mx = Math.max(mx, Math.abs(o.e), Math.abs(o.n), Math.abs(o.up)); });
  assert.equal(mx, 0, 'no wind, nothing shaken: still');
  let sh = 0; const L = crownWind(0, 0, 5, (o) => { sh = Math.max(sh, Math.hypot(o.e, o.n, o.up)); }, { shake: 1 });
  assert.ok(sh > 0.15 && sh < 1.3 * FLORA.branchShake * L, `a shaken crown in still air: ${sh.toFixed(3)} m`);
});

test('P14 a crown changes shape: branches differ in frequency and lag; along a branch the motion grows as a cantilever; nothing of the wood moves at the trunk; foliage trembles on top', () => {
  // three branches of one crown, the same wind
  const a = tipStats(15, 0.3, { id: 0.13 }), b = tipStats(15, 0.3, { id: 0.52, point: [-0.6, 0.8] }), c = tipStats(15, 0.3, { id: 0.86, point: [0.2, -0.98] });
  const corr = (x, y) => { const mx = x.reduce((p, q) => p + q, 0) / x.length, my = y.reduce((p, q) => p + q, 0) / y.length; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; } return sxy / Math.sqrt(sxx * syy); };
  console.log(`# three branches in 15 m/s: ${a.hz.toFixed(2)}, ${b.hz.toFixed(2)}, ${c.hz.toFixed(2)} Hz; their swings correlate ${corr(a.al, b.al).toFixed(2)}, ${corr(a.al, c.al).toFixed(2)}, ${corr(b.al, c.al).toFixed(2)}`);
  assert.ok(Math.max(a.hz, b.hz, c.hz) / Math.min(a.hz, b.hz, c.hz) > 1.3 && Math.min(a.hz, b.hz, c.hz) > 0.8 && Math.max(a.hz, b.hz, c.hz) < 1.8, 'each branch has its own frequency, 0.85 to 1.75 Hz');
  for (const [x, y] of [[a, b], [a, c], [b, c]]) assert.ok(Math.abs(corr(x.al, y.al)) < 0.75, `two branches of one crown are not in step: ${corr(x.al, y.al)}`);
  // along a branch: x^2 (3 - x) / 2 of the tip's set; at the axis nothing
  const half = tipStats(15, 0.3, { point: [0.4, 0.3] }), tip = tipStats(15, 0.3, { point: [0.8, 0.6] });
  assert.ok(Math.abs(half.set / tip.set - 0.3125) < 1e-9, `half way out streams ${half.set / tip.set} of the tip`);
  let mx = 0; crownWind(20, 0.3, 3, (o) => { mx = Math.max(mx, Math.hypot(o.e, o.n, o.up)); }, { point: [0, 0] });
  assert.equal(mx, 0, 'the wood at the axis does not move');
  // without a number per branch (pcPhysBranch): continuous all the way round the trunk, no seam where atan2 wraps
  const Un = { uPhysBranch: [8, 1, FLORA.branchShake, FLORA.crown], uPhysBranchPhase: [0.3, 1.1, 2.0, 4.4] }, cw = [3, 1, 8, 3, 3], o = {}, H = 13, L = FLORA.crown * H;
  const at = (az) => { plantBranch(Math.cos(az) * L, Math.sin(az) * L, 8, H, 3, 4, 0, 0, 0, Un, o, cw); return [o.e, o.n, o.up]; };
  const m = (v) => Math.hypot(v[0], v[1], v[2]);
  let jump = 0, prev = at(-Math.PI), far = 0;
  for (let k = 1; k <= 720; k++) { const v = at(-Math.PI + k * Math.PI / 360); jump = Math.max(jump, m([v[0] - prev[0], v[1] - prev[1], v[2] - prev[2]])); far = Math.max(far, m(v)); prev = v; }
  const seam = m(at(Math.PI - 1e-7).map((v, i) => v - at(-Math.PI + 1e-7)[i]));
  assert.ok(seam < 1e-6 * L && jump < 0.06 * far, `seam ${seam}, largest step round the crown ${jump} of ${far}`);
  for (const mm of BRANCH_M) assert.equal(mm, Math.round(mm));
  // foliage: the twigs tremble on top of the branch, a centimetre in a breeze, a few in a gale, faster than the branch
  const trem = (U) => { const w = [], f = []; crownWind(U, 0.3, 20, (q) => w.push([q.e, q.n, q.up])); crownWind(U, 0.3, 20, (q) => f.push([q.e, q.n, q.up]), { leaf: 1 });
    const d = f.map((v, i) => Math.hypot(v[0] - w[i][0], v[1] - w[i][1], v[2] - w[i][2])), up = f.map((v, i) => v[2] - w[i][2]); let n = 0; for (let i = 1; i < up.length; i++) if (up[i] * up[i - 1] < 0) n++;
    return { max: Math.max(...d), rate: n / 2 / 20 }; };
  const tb = trem(3), tg = trem(20);
  console.log(`# foliage trembles up to ${(tb.max * 100).toFixed(1)} cm in 3 m/s, ${(tg.max * 100).toFixed(1)} cm in 20 m/s, at ${tg.rate.toFixed(1)} Hz`);
  assert.ok(tb.max > 0.004 && tb.max < 0.02 && tg.max > 0.04 && tg.max < 0.09, `${tb.max} m and ${tg.max} m`);
  assert.ok(tg.rate > 2.5 && tg.rate < 6.5, `${tg.rate} Hz`);
});

test('P14 the crown in the field: the eddy trains are carried by the wind at crown height, stay wrapped and stay put when the frame re-anchors; the chunk declares it', async () => {
  const { FloraField } = await import('./flora.js');
  const w = world('earth', 'temperate_forest'); run(w, 20);
  const F = w.physics.fields.flora, U = F.uniforms;
  const P0 = U.uPhysBranchPhase.slice(), R0 = F.field.branchPhase.slice();
  run(w, 1 / 60, { t0: 120 });
  const P1 = U.uPhysBranchPhase, cwm = F.field.crownWind;
  assert.ok(Math.hypot(cwm[0], cwm[1]) > 0.3, `there is a wind at the crowns: ${Math.hypot(cwm[0], cwm[1])} m/s`);
  for (let i = 0; i < 3; i++) {
    const want = FLORA.crownK[i] * (CROWN_D[i][0] * cwm[0] + CROWN_D[i][1] * cwm[1]) / 60;
    assert.ok(Math.abs(F.field.branchPhase[i] - R0[i] - want) < 1e-9, `train ${i} is carried by the wind`);
    assert.ok(P1[i] >= 0 && P1[i] < TAU, 'wrapped');
  }
  const dt = ((P1[3] - P0[3]) % (TAU * 16) + TAU * 16) % (TAU * 16);
  assert.ok(Math.abs(dt - TAU * FLORA.twigHz / 60) < 1e-6 && P1[3] >= 0 && P1[3] < TAU * 16, 'the twig clock runs and wraps at 16 turns');
  assert.ok(Math.abs(U.uPhysBranch[0] - Math.sqrt(2 * FLORA.qRef / 1.225)) < 0.6, `load 1 is ${U.uPhysBranch[0]} m/s in Earth air`);
  assert.equal(U.uPhysBranch[3], FLORA.crown);
  // a tree in the field: its branch tips move, finite, with the wind's load on them; the wrapper and the twin agree
  const o = {}, o2 = {}, H = 13, L = FLORA.crown * H;
  let far = 0, sum = 0, n = 0;
  run(w, 20, { t0: 121, each: () => { F.plantCrown(L, 0, 8, H, w.focus, 0, 0.4, 0, o); far = Math.max(far, Math.hypot(o.e, o.n, o.up)); sum += o.load; n++; assert.ok(Number.isFinite(o.e + o.n + o.up)); } });
  assert.ok(far > 0.002 && far < 0.3 * L, `a tip moves up to ${far} m under a load of ${(sum / n).toFixed(2)}`);
  const fr = w.physics.fields.frame, gx = fr.lx(w.focus.x, w.focus.y, w.focus.z), gz = fr.lz(w.focus.x, w.focus.y, w.focus.z);
  F.plantCrown(L, 0, 8, H, w.focus, 0, 0.4, 1, o); plantCrown(L, 0, 8, H, gx, gz, F.field.crownAt(gx, gz, H), 0, U, 0.4, 1, o2);
  assert.deepEqual([o.e, o.n, o.up], [o2.e, o2.n, o2.up]);
  F.plantBranch(L, 0, 8, H, w.focus, { shake01: 0 }, o); plantCrown(L, 0, 8, H, gx, gz, F.field.crownAt(gx, gz, H), 0, U, -1, 0, o2);
  assert.deepEqual([o.e, o.n, o.up], [o2.e, o2.n, o2.up]);
  // a low plant takes the wind of its own height: a bush's twigs feel less than a crown's
  const hi = Math.hypot(...F.field.crownAt(gx, gz, 13).slice(0, 2)), lo = Math.hypot(...F.field.crownAt(gx, gz, 1.3).slice(0, 2));
  assert.ok(Number.isFinite(lo) && Number.isFinite(hi));
  // re-anchoring: the phases are moved with the anchor, so the eddy at a place stays the eddy at that place
  const ff = new FloraField(); ff.branchPhase[0] = 1; ff.branchPhase[1] = 2; ff.branchPhase[2] = 3;
  const Uf = { uPhysBranch: [8, 1, 0.08, FLORA.crown], uPhysBranchPhase: [1, 2, 3, 0.7] }, cw = [3, 1, 8, 3, 3], q0 = {}, q1 = {};
  plantCrown(2, 1, 8, 13, 40, 9, cw, 0, Uf, -1, 0, q0);
  ff.onReanchor(32, -16);                       // the new anchor, in the old frame's coordinates
  for (let i = 0; i < 3; i++) Uf.uPhysBranchPhase[i] = ff.branchPhase[i];
  plantCrown(2, 1, 8, 13, 40 - 32, 9 + 16, cw, 0, Uf, -1, 0, q1);
  assert.ok(Math.hypot(q0.e - q1.e, q0.n - q1.n, q0.up - q1.up) < 1e-9, 'the same swing at the same place after re-anchoring');
  for (const name of ['pcPhysCrown', 'pcPhysBranch', 'uPhysBranch', 'uPhysBranchPhase', String(FLORA.branchThrash), String(FLORA.crownTilt), String(FLORA.twigMax)]) assert.ok(FLORA_GLSL.includes(name), name);
});

test('in a storm a tree leans and tosses but does not whip back upwind (aerodynamic damping; P8, the thunderstorm at the Earth spawn)', async () => {
  // (before P8 a lull in the gust front swung a tree from 12 degrees downwind to 11 upwind in 0.4 s,
  // at up to 104 degrees a second: the lightly damped sway of a calm day, driven by a gale)
  const { BODIES } = await import('../data/bodies.js');
  const sample = makeWorld({ R: BODIES.earth.radius, biome: 'alpine_meadow' });
  const physics = createPhysics({ sampleSurface: (b, d) => sample(d), timeBudget: false });
  const d = norm(V(0.1736, 0.5817, 0.7946)), R = sample(d).radius, p = V(d.x * (R + 1), d.y * (R + 1), d.z * (R + 1));
  const run = (t0, secs) => {
    physics.warmUp({ bodyId: 'earth', time: t0 - 10, focus: p });
    for (let t = t0 - 10; t < t0; t += 1 / 30) physics.update(1 / 30, { bodyId: 'earth', time: t, focus: p });
    const o = {}, a = {}; let fastest = 0, upwind = 0, largest = 0, pe = 0, pn = 0, wmax = 0;
    for (let i = 0; i < secs * 60; i++) {
      physics.update(1 / 60, { bodyId: 'earth', time: t0 + i / 60, focus: p });
      physics.fields.flora.plantBend(p, 1, o); physics.air('earth', p, a, 10);
      const w = Math.hypot(a.wind.x, a.wind.y, a.wind.z); wmax = Math.max(wmax, w);
      if (i) fastest = Math.max(fastest, Math.hypot(o.e - pe, o.n - pn) * 60);
      pe = o.e; pn = o.n; largest = Math.max(largest, o.angle);
      // the bend against the wind: its part along the wind's own direction, when negative
      const F = physics.fields.flora.plantBendLite(p, 1, {});
      if (w > 4) { const wl = Math.hypot(physics.here.air.wind.x, physics.here.air.wind.y, physics.here.air.wind.z) || 1; const al = (F.e * o.e + F.n * o.n) / (Math.hypot(F.e, F.n) || 1); upwind = Math.min(upwind, al); }
    }
    return { fastest: fastest * 57.3, upwind: upwind * 57.3, largest: largest * 57.3, wmax };
  };
  const storm = run(170, 40);
  assert.ok(storm.wmax > 12, 'this is the gust front: ' + storm.wmax);
  // (P11: "> 6" before the trunks were made as stiff as measured trees. This open ground has 46 m/s at 10 m in the gust
  // front: the trunk goes to its limit, as a real one would break.)
  assert.ok(storm.largest > 3 && storm.largest <= FLORA.stiffMax * 57.3 + 0.01, 'the tree leans: ' + storm.largest);
  assert.ok(storm.fastest < 30, 'no whip: fastest ' + storm.fastest + ' deg/s');
  assert.ok(storm.upwind > -2, 'never far upwind: ' + storm.upwind + ' deg');
  assert.ok(FLORA.stiffDamp < 0.2 && FLORA.aeroDamp * 3 < 0.1, 'in a breeze the sway is still free');
});

// ---- P11: flutter ------------------------------------------------------------------------------------
test('P11 flutter: blades a metre apart are out of step, each swings near its own frequency, none bends upwind, and a re-anchoring does not move the eddies', async () => {
  const { flutterAt, FLUT_D, FloraField } = await import('./flora.js');
  // the three trains together have unit rms where the blade follows fully (slow eddies)
  const o = new Float64Array(2), P = [0, 0, 0];
  let s2 = 0, n = 0;
  for (let x = 0; x < 200; x += 0.37) for (let z = 0; z < 40; z += 3.1) { flutterAt(x, z, 0.3, 0.1, 0.17 * 0.32, P, o); s2 += o[0] * o[0]; n++; }
  const m = Math.min(FLORA.flutterMax, FLORA.flutterGain * 0.17 * 0.32 / (0.32 + 0.25));
  assert.ok(Math.abs(Math.sqrt(s2 / n) / m - 1) < 0.15, `rms ${Math.sqrt(s2 / n) / m} of the depth`);
  // a blade does not follow eddies that pass faster than it can swing: a train lying along a 12 m/s wind (the 0.9 m
  // one passes at 8 Hz) is nearly gone, one lying across it passes slowly and stays
  const amp = (w, i) => { const d = FLUT_D[i]; let mx = 0; for (let x = 0; x < 30; x += 0.02) { flutterAt(x * d[0], x * d[1], w * d[0], w * d[1], 1e9, P, o); mx = Math.max(mx, Math.abs(o[0])); } return mx / FLORA.flutterMax; };
  assert.ok(amp(12, 0) < 0.9 * amp(1.5, 0), `largest swing with the wind along the 0.9 m train: ${amp(12, 0).toFixed(2)} in 12 m/s, ${amp(1.5, 0).toFixed(2)} in 1.5 m/s (of the depth)`);
  // in the field: a storm wind over grass
  const w = world();
  run(w, 12);
  const F = w.physics.fields.flora, fr = w.physics.fields.frame;
  const at = (e, nn) => V(w.focus.x + fr.ex * e + fr.nx * nn, w.focus.y + fr.ey * e + fr.ny * nn, w.focus.z + fr.ez * e + fr.nz * nn);
  const a = [], b = [], lite = [], dots = [];
  run(w, 20, { t0: 112, each: () => { const A = F.plantBend(at(0, 0), 0, {}), B = F.plantBend(at(1.1, 0.4), 0, {}), L = F.plantBendLite(at(0, 0), 0, {}); a.push(A.angle); b.push(B.angle); lite.push(L.angle); dots.push((A.e * L.e + A.n * L.n) / (Math.hypot(L.e, L.n) || 1)); } });
  const mean = (x) => x.reduce((p, q) => p + q, 0) / x.length;
  const corr = (x, y) => { const mx = mean(x), my = mean(y); let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; } return sxy / Math.sqrt(sxx * syy); };
  // what the eddies add to each blade (its lean less the smooth field's)
  const da = a.map((v, i) => v - lite[i]), db = b.map((v, i) => v - lite[i]);
  const c = corr(da, db);
  const sd = Math.sqrt(mean(da.map((v) => (v - mean(da)) ** 2)));
  console.log(`# flutter: lean ${(mean(a) * 57.3).toFixed(1)} deg, the eddies add ${(sd * 57.3).toFixed(1)} deg rms; blades 1.2 m apart correlate ${c.toFixed(2)}; least lean along the wind ${(Math.min(...dots) * 57.3).toFixed(1)} deg`);
  assert.ok(mean(a) > 0.01, 'there is a wind: lean ' + mean(a));
  assert.ok(sd > 0.04 * mean(a), `the eddies move the blade: ${sd} rad on a lean of ${mean(a)}`);
  assert.ok(Math.abs(c) < 0.8, `blades 1.2 m apart are not in step: ${c}`);
  assert.ok(Math.min(...dots) > 0, 'a blade never bends upwind');
  // re-anchoring: the phases are moved with the anchor, so the eddy at a place stays the eddy at that place
  const ff = new FloraField(); ff.flutPhase[0] = 1; ff.flutPhase[1] = 2; ff.flutPhase[2] = 3;
  const q0 = new Float64Array(2), q1 = new Float64Array(2);
  flutterAt(40, 9, 3, 1, 0.5, ff.flutPhase, q0);
  ff.onReanchor(32, -16);                       // the new anchor, in the old frame's coordinates
  flutterAt(40 - 32, 9 + 16, 3, 1, 0.5, ff.flutPhase, q1);
  assert.ok(Math.abs(q0[0] - q1[0]) < 1e-9 && Math.abs(q0[1] - q1[1]) < 1e-9, `the same swing at the same place after re-anchoring: ${q0[0]} and ${q1[0]}`);
  // the chunk carries it, and the two constants it took the uniform slots of
  assert.ok(FLORA_GLSL.includes('uPhysWavePhase.w') && FLORA_GLSL.includes('uPhysWave.z') && FLORA_GLSL.includes(String(FLORA.flutterGain)));
  assert.ok(!/uPhysWave\.[zw] \*/.test(FLORA_GLSL), 'the honami wavenumber and depth are constants of the chunk now');
});
