// The cloud and rain map of a whole world, and the rain field for the water group (cloudfield.js; group D, the STORMS AND
// RAIN lane; docs/lead/WEATHER-DESIGN.md 6.4 and 9.2-9.3, reconciled with docs/lead/WATER-DESIGN.md 5.6).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CloudField, CLOUDMAP, rainAt, rainBetween, throughfall } from './cloudfield.js';
import { weatherAt, liveCells, gatherFrom, gather1, cellsAt, DEFAULT_SEED, WEATHER } from './weather.js';
import { makeWorld, norm, timing } from './testworld.mjs';
import { Particles } from './particles.js';
import { createPhysics } from './index.js';
import { WX2 } from './wx2.js';

// a place and a time inside a raining system of Earth's (found, not assumed: the cells drift)
function wetSpot(body = 'earth', minRate = 6) {
  for (let t = 600; t < 30000; t += 53) {
    for (const c of cellsAt(body, t)) {
      if (!(c.kind.rate >= 6) || c.w < 0.6) continue;
      const a = gather1(body, c.x, c.y, c.z, t);
      if (a.rate >= minRate) return { t, u: { x: c.x, y: c.y, z: c.z }, rate: a.rate };
    }
  }
  return null;
}

test('cloud map: liveCells + gatherFrom give exactly what gather gives', () => {
  const cells = [];
  let n = 0;
  for (let q = 0; q < 400; q++) {
    const t = 200 + q * 41.3, u = norm({ x: Math.sin(q * 1.3), y: Math.cos(q * 0.7), z: Math.sin(q * 2.1 + 1) });
    liveCells('earth', t, DEFAULT_SEED, cells);
    const a = gatherFrom(cells, 'earth', u.x, u.y, u.z);
    const v = { cloud: a.cloud, rate: a.rate, storm: a.storm, flash: a.flash, ox: a.ox, windMul: a.windMul };
    const b = gather1('earth', u.x, u.y, u.z, t);
    for (const k of Object.keys(v)) { assert.equal(v[k], b[k], `${k} at ${t}`); n++; }
  }
  assert.ok(n > 0);
});

test('cloud map: its texels agree with the weather at the same place and time', () => {
  const W = wetSpot();
  assert.ok(W, 'a raining system was found');
  const cf = new CloudField();
  cf.refresh('earth', W.t, null, null);
  const k = (() => { let best = 0, bd = -2; for (let i = 0; i < cf.count; i++) { const d = cf.cx[i] * W.u.x + cf.cy[i] * W.u.y + cf.cz[i] * W.u.z; if (d > bd) { bd = d; best = i; } } return best; })();
  const u = { x: cf.cx[k], y: cf.cy[k], z: cf.cz[k] };
  const o = weatherAt('earth', u.x, u.y, u.z, 0, W.t, DEFAULT_SEED, { moist: 1 }, {});
  const pr = o.precipitation, liquid = pr.type === 'none' ? 0 : pr.rate * (1 - pr.frozen01);
  assert.ok(Math.abs(cf.rain[k] - liquid) <= 0.02 * Math.max(1, liquid), `map ${cf.rain[k].toFixed(3)} mm/h, weatherAt ${liquid.toFixed(3)}`);
  assert.ok(cf.low[k] > 0.5 && cf.base[k] < cf.top[k], `cover ${cf.low[k].toFixed(2)}, base ${cf.base[k].toFixed(0)} m, top ${cf.top[k].toFixed(0)} m`);
  const r = rainAt('earth', u.x, u.y, u.z, W.t);
  assert.ok(Math.abs(r.rate - cf.rain[k]) < 1e-6, 'rainAt is the map at a texel centre');
});

test('rain field: rainBetween is the integral of rainAt; throughfall', () => {
  const W = wetSpot();
  const coarse = rainBetween('earth', W.u.x, W.u.y, W.u.z, W.t - 60, W.t + 60);
  const fine = rainBetween('earth', W.u.x, W.u.y, W.u.z, W.t - 60, W.t + 60, DEFAULT_SEED, null, {}, 0.5);
  assert.ok(fine.mm > 0.05, `${fine.mm.toFixed(3)} mm fell in two game minutes`);
  assert.ok(Math.abs(coarse.mm - fine.mm) <= 0.02 * fine.mm, `5 s steps ${coarse.mm.toFixed(4)} mm, 0.5 s steps ${fine.mm.toFixed(4)} mm`);
  // units: a steady rate over one game second is rate x timeScale / 3600 mm
  const one = rainBetween('earth', W.u.x, W.u.y, W.u.z, W.t, W.t + 0.01, DEFAULT_SEED, null, {}, 0.01);
  const r = rainAt('earth', W.u.x, W.u.y, W.u.z, W.t + 0.005);
  assert.ok(Math.abs(one.mm - r.rate * 0.01 * WEATHER.timeScale / 3600) < 1e-9);
  assert.equal(throughfall(0, 0), 1); assert.equal(throughfall(1, 0), 0.25); assert.equal(throughfall(1, 1), 0.75);
});

test('rain field: the shaders\' eight rain cells give the rain at the focus (the GPU twin of a cell)', () => {
  const W = wetSpot('earth', 10);
  const sample = makeWorld({ R: 4000 });
  const was = WX2.cloudmap;
  try {
    WX2.cloudmap = true;
    const p = createPhysics({ sampleSurface: (b, d) => sample(d), timeBudget: false });
    const F = { x: W.u.x * 4001.7, y: W.u.y * 4001.7, z: W.u.z * 4001.7 };
    for (let f = 0; f < 40; f++) p.update(1 / 30, { bodyId: 'earth', time: W.t + f / 30, focus: F, sunDir: null });
    const R = p.fields.rain;
    assert.ok(R && R.ready);
    // pcRainCells, in JS: at the focus's own frame position
    const fr = p.fields.frame, en = [fr.lx(F.x, F.y, F.z), fr.lz(F.x, F.y, F.z)];
    let gpu = 0;
    for (let i = 0; i < 8; i++) {
      const c = R.cells.subarray(i * 4, i * 4 + 4); if (!(c[3] > 0)) continue;
      const x = Math.hypot(en[0] - c[0], en[1] - c[1]) / c[2], x0 = R.cellsX[i];
      const t = Math.min(1, Math.max(0, (x - x0) / (1 - x0))), core = 1 - t * t * (3 - 2 * t);
      gpu += c[3] * core * core;
    }
    const cpu = rainAt('earth', W.u.x, W.u.y, W.u.z, W.t + 39 / 30).rate;
    assert.ok(cpu > 5 && Math.abs(gpu - cpu) <= 0.05 * cpu, `the cells' rain ${gpu.toFixed(2)} mm/h, rainAt ${cpu.toFixed(2)} mm/h`);
    assert.ok(R.now > 5, `here: ${R.now.toFixed(2)} mm/h`);
  } finally { WX2.cloudmap = was; }
});

test('cloud map: off by default; forceWeather holds a storm over the focus and lets it go', () => {
  const sample = makeWorld({ R: 4000 });
  const was = WX2.cloudmap;
  try {
    WX2.cloudmap = false;
    const p = createPhysics({ sampleSurface: (b, d) => sample(d), timeBudget: false });
    const u = norm({ x: 0.3, y: 0.2, z: 0.93 }), F = { x: u.x * 4001.7, y: u.y * 4001.7, z: u.z * 4001.7 };
    // a dry moment here
    let t = 100; for (; t < 30000; t += 31) if (gather1('earth', u.x, u.y, u.z, t).rate === 0 && gather1('earth', u.x, u.y, u.z, t).cloud < 0.05) break;
    p.update(1 / 30, { bodyId: 'earth', time: t, focus: F, sunDir: null });
    assert.equal(p.fields.cloud, null); assert.equal(p.fields.rain, null);
    assert.equal(p.here.weather.precipitation.rate, 0);
    p.forceWeather({ kind: 'storm' });
    p.update(1 / 30, { bodyId: 'earth', time: t + 1 / 30, focus: F, sunDir: null });
    assert.equal(p.here.weather.kind, 'thunderstorm');
    assert.ok(p.here.weather.precipitation.rate > 20, `${p.here.weather.precipitation.rate.toFixed(1)} mm/h under the held storm`);
    p.forceWeather(null);
    p.update(1 / 30, { bodyId: 'earth', time: t + 2 / 30, focus: F, sunDir: null });
    assert.equal(p.here.weather.precipitation.rate, 0);
    assert.equal(p.forcedWeather, null);
  } finally { WX2.cloudmap = was; }
});

test('cloud map: the cost of a full refresh on Earth', () => {
  const cf = new CloudField();
  for (let r = 0; r < 3; r++) cf.refresh('earth', 1700 + r, null, null);
  const t0 = performance.now();
  for (let r = 0; r < 10; r++) cf.refresh('earth', 1710 + r, null, null);
  const ms = (performance.now() - t0) / 10;
  timing(ms < 4, `a full refresh of the cloud map: ${ms.toFixed(2)} ms (a slice of it every frame: ${(ms / (CLOUDMAP.period * 30)).toFixed(3)} ms at 30 a second)`);
  assert.ok(Number.isFinite(ms));
});

test('rain box (?rainmap=1): at a shower\'s edge more drops fall on its wetter side, as many as before in all', () => {
  // a place at a raining system's edge: its rate down to half the centre's
  let edge = null;
  for (let t = 600; t < 20000 && !edge; t += 97) for (const c of cellsAt('earth', t)) {
    if (!(c.kind.rate >= 6) || c.w < 0.7) continue;
    const e = norm({ x: c.z, y: 0, z: -c.x }), r0 = rainAt('earth', c.x, c.y, c.z, t).rate;
    for (let d = 0.2; d < 1.2 && !edge; d += 0.02) {
      const a = d * c.r / 4000, u = norm({ x: c.x * Math.cos(a) + e.x * Math.sin(a), y: c.y * Math.cos(a), z: c.z * Math.cos(a) + e.z * Math.sin(a) });
      const r = rainAt('earth', u.x, u.y, u.z, t).rate;
      if (r < 0.5 * r0 && r > 1) edge = { t, u };
    }
    if (edge) break;
  }
  assert.ok(edge, 'a shower\'s edge was found');
  const sample = makeWorld({ R: 4000 });
  const wasC = WX2.cloudmap, wasR = WX2.rainmap, out = {};
  try {
    for (const on of [false, true]) {
      WX2.cloudmap = true; WX2.rainmap = on;
      const p = createPhysics({ sampleSurface: (b, d) => sample(d), timeBudget: false });
      const F = { x: edge.u.x * 4001.7, y: edge.u.y * 4001.7, z: edge.u.z * 4001.7 };
      for (let f = 0; f < 240; f++) p.update(1 / 30, { bodyId: 'earth', time: edge.t + f / 30, focus: F, sunDir: null });
      const S = p.particles.system, b = S.buffers.rain, rc = S.rainCorners;
      if (on) assert.ok(rc && Math.max(rc[0], rc[1], rc[2], rc[3]) > 1.3 * Math.min(rc[0], rc[1], rc[2], rc[3]), `the corners differ: ${rc && Array.from(rc).map((v) => v.toFixed(2))}`);
      else assert.equal(rc, null);
      out[on] = { n: b._n, b, rc, fx: p.fields.frame.lx(F.x, F.y, F.z), fz: p.fields.frame.lz(F.x, F.y, F.z) };
    }
    const A = out[false], B = out[true];
    assert.ok(Math.abs(B.n - A.n) <= 0.08 * A.n, `drops ${A.n} without, ${B.n} with`);
    // the placement law itself: corners 3, 1, 3, 1 mm/h (wet to the -x side): the wet half holds 2.5 / 4 of the drops.
    // (In the box as it runs the skew is smaller: at a storm's edge the wind carries a drop across the 48 m box in the
    //  under three seconds it takes to fall, so where it was placed is smeared along the wind. Measured at the edge
    //  found here, 3.1 against 1.7 mm/h: 53 % of the drops on the wet half, against 52 % without the switch.)
    const S = new Particles(5, 1), b = S.buffers.rain;
    b._rc = new Float64Array([3, 1, 3, 1, 2]); b._rcInv = 1 / 3;
    let wet = 0; const N = 4000;
    for (let i = 0; i < N; i++) { S._spawn(b, 0, 0, 0, 10, false, 24); if (b._p[0] < 0) wet++; }
    assert.ok(Math.abs(wet / N - 0.625) < 0.03, `${(wet / N * 100).toFixed(1)} % placed on the wet half (the law: 62.5 %)`);
  } finally { WX2.cloudmap = wasC; WX2.rainmap = wasR; }
});
