// Tests: wind waves. Run: node --test src/physics/
import test from 'node:test';
import assert from 'node:assert/strict';
import { windSea, WaterField, WATER_GLSL, WATER, fetchOf } from './water.js';
import { createPhysics } from './index.js';
import { setWindScale, WINDS } from './wind.js';
import { BODIES } from '../data/bodies.js';
import { makeWorld, V, norm, len } from './testworld.mjs';

test('wind sea: follows the fetch-limited growth curves and the fully developed limit', () => {
  // SPM 1984: U = 15 m/s over 20 km of water: Hs about 1.1 m, Tp about 4.4 s
  const a = windSea(15, 20000, 9.81, 1.225, 999, Infinity);
  assert.ok(Math.abs(a.height - 0.0016 * 15 * Math.sqrt(20000 / 9.81)) < 1e-9 && a.height > 0.9 && a.height < 1.3, 'Hs ' + a.height);
  assert.ok(a.period > 3.8 && a.period < 5, 'Tp ' + a.period);
  assert.ok(Math.abs(a.length - 9.81 * a.period ** 2 / (2 * Math.PI)) < 1e-9);
  // an endless fetch: Pierson-Moskowitz
  const fd = windSea(15, 1e9, 9.81, 1.225, 999, Infinity);
  assert.ok(Math.abs(fd.height - 0.2433 * 225 / 9.81) < 1e-9 && Math.abs(fd.period - 8.134 * 15 / 9.81) < 1e-9);
  // monotonic in wind and fetch
  let prev = 0; for (let U = 1; U < 40; U += 1) { const h = windSea(U, 2500, 9, 1.2, 999, Infinity).height; assert.ok(h >= prev); prev = h; }
  prev = 0; for (let F = 5; F < 1e5; F *= 1.7) { const h = windSea(12, F, 9, 1.2, 999, Infinity).height; assert.ok(h >= prev); prev = h; }
  assert.equal(windSea(0, 2500, 9, 1.2, 999, Infinity).height, 0);
  assert.equal(windSea(12, 2500, 9, 0, 999, Infinity).height, 0, 'no air, no waves');
});

test('a brook only ripples; a sea coast in a gale gets real waves; shallows break them', () => {
  const brook = windSea(8, fetchOf('temperate_forest'), 9, 1.2, 999, 0.5);
  const coast = windSea(20, fetchOf('sea_coast'), 9, 1.2, 999, Infinity);
  assert.ok(brook.height < 0.02, 'brook ' + brook.height);
  assert.ok(coast.height > 0.4 && coast.height < 1.2, 'coast ' + coast.height);
  assert.ok(coast.whitecap01 > 0.5, 'whitecaps in a gale: ' + coast.whitecap01);
  const shoal = windSea(20, 2500, 9, 1.2, 999, 0.6);
  assert.ok(shoal.height <= 0.6 * WATER.breakRatio + 1e-9 && shoal.length < coast.length, `breaking in 0.6 m: ${shoal.height}, length ${shoal.length} < ${coast.length}`);
  for (const U of [3, 10, 30, 60]) assert.ok(windSea(U, 1e6, 9, 1.2, 999, Infinity).steepness <= 1 / 7 + 1e-9);
});

test('other worlds: Neptune\'s methane sea is rougher than water under the same wind; weak gravity makes long slow waves', () => {
  const water = windSea(20, 2500, 10.2, 0.99, 999, Infinity), methane = windSea(20, 2500, 10.2, 0.99, 450, Infinity);
  assert.ok(methane.height > water.height * 1.4, `${methane.height} vs ${water.height}`);
  const lowG = windSea(10, 2500, 1.4, 1.2, 999, Infinity), earth = windSea(10, 2500, 9, 1.2, 999, Infinity);
  assert.ok(lowG.height > earth.height * 2 && lowG.period > earth.period * 2);
});

test('the sea state at the focus rises and falls slowly, and the JS twin is bounded by its amplitudes', () => {
  const F = new WaterField();
  const frame = { version: 1 };
  // arriving somewhere, the sea is already running under the wind that blows there
  for (let i = 0; i < 100; i++) F.update(1 / 60, frame, 3, 0, 0, 50, 2500, 9, 1.2, 999);
  assert.ok(Math.abs(F.height - windSea(3, 2500, 9, 1.2, 999, 50).height) < 2e-3 && F.height > 0.05, 'set within two seconds of arriving: ' + F.height);
  let prev = F.height, worst = 0;
  for (let i = 0; i < 60 * 120; i++) {
    const U = i < 60 * 60 ? 18 : 2;          // a gale for a minute, then it drops
    F.update(1 / 60, frame, U, 0, 0, 50, 2500, 9, 1.2, 999);
    worst = Math.max(worst, Math.abs(F.height - prev)); prev = F.height;
    if (i === 60 * 60 - 1) assert.ok(F.height > 0.4, 'risen after a minute of gale: ' + F.height);
  }
  assert.ok(F.height < 0.2, 'fallen a minute after: ' + F.height);
  assert.ok(worst < 0.002, 'no jump: ' + worst + ' m per frame');
  const sum = (F.amp[0] + F.amp[1] + F.amp[2] + F.amp[3]) * (1 + WATER.group);
  for (let k = 0; k < 500; k++) assert.ok(Math.abs(F.heightAt(k * 1.7, k * 0.9)) <= sum + 1e-9);
  // waves run downwind: the crest pattern moves along +x
  const G = new WaterField(); for (let i = 0; i < 3000; i++) G.update(1 / 60, frame, 15, 0, 0, 50, 2500, 9, 1.2, 999);
  assert.ok(G.dir[0] > 0.99);
  const h0 = G.heightAt(0, 0); G.update(0.05, frame, 15, 0, 0, 50, 2500, 9, 1.2, 999);
  const moved = G.speed * 0.05;
  assert.ok(Math.abs(G.heightAt(moved, 0) - h0) < Math.abs(G.heightAt(0, 0) - h0) + 0.02, 'the surface is carried along at the phase speed');
});

test('in the game loop: waves on a windy coast, none on dry land, none without air; continuous over a re-anchor', () => {
  const mk = (bodyId, biome, sea) => { const R = BODIES[bodyId].radius; const sample = makeWorld({ R, biome, sea: sea ? R + sea : 0 }); return { physics: createPhysics({ sampleSurface: (id, d) => sample(d), timeBudget: false }), R, bodyId }; };
  const run = (w, dir, seconds, speed = 0) => { let p = V(dir.x * w.R, dir.y * w.R, dir.z * w.R); const e = norm(V(-dir.z, 0, dir.x)); let t = w.t || 100; for (let i = 0; i < seconds * 30; i++) { t += 1 / 30; p = V(p.x + e.x * speed / 30, p.y, p.z + e.z * speed / 30); const l = len(p); p = V(p.x * w.R / l, p.y * w.R / l, p.z * w.R / l); w.physics.update(1 / 30, { bodyId: w.bodyId, time: t, focus: p }); } w.t = t; return p; };
  const s0 = WINDS.earth.scale;
  try {
    setWindScale('earth', 0.3);
    const sea = mk('earth', 'sea_coast', 3);
    const p = run(sea, norm(V(0.6, 0.04, 0.8)), 90);
    const ws = sea.physics.water('earth', p, {});
    assert.ok(ws.present && ws.significant > 0.2, 'Hs ' + ws.significant);
    assert.ok(Math.abs(ws.height) <= ws.significant && ws.length > 2 && ws.period > 1);
    assert.ok(Math.abs(sea.physics.fields.water.heightAt(p) - ws.height) < 1e-12);
    const U = sea.physics.fields.water.uniforms;
    assert.ok(U.uPhysWaterAmp[0] > 0.05 && U.uPhysWaterK[0] > 0 && Number.isFinite(U.uPhysWaterPhase[0]));
    // walk 500 m: the frame re-anchors; the height under the walker never jumps
    let prev = null, worst = 0;
    const before = sea.physics.stats.reanchors;
    let q = p; const e = norm(V(-q.z, 0, q.x));
    // the most a frame can change it: every train at its steepest, crossed at 40 m/s plus its own speed
    const Wf = sea.physics.fields.water.field; let excess = 0;
    for (let i = 0; i < 60 * 14; i++) {
      q = V(q.x + e.x * 40 / 60, q.y, q.z + e.z * 40 / 60); const l = len(q); q = V(q.x * sea.R / l, q.y * sea.R / l, q.z * sea.R / l); sea.t += 1 / 60;
      sea.physics.update(1 / 60, { bodyId: 'earth', time: sea.t, focus: q });
      const h = sea.physics.fields.water.heightAt(q);
      let bound = 0.004; for (let k = 0; k < 4; k++) bound += Wf.amp[k] * (1 + WATER.group) * (Wf.k[k] * 40 + Wf.omega[k] + WATER.group * Wf.k[k] / WATER.groupWaves * 40) / 60;
      if (prev != null) { worst = Math.max(worst, Math.abs(h - prev)); excess = Math.max(excess, Math.abs(h - prev) - bound * 1.1); }
      prev = h;
    }
    assert.ok(sea.physics.stats.reanchors > before, 're-anchored');
    assert.ok(excess <= 0, `the surface under the walker jumped ${excess} m more than the waves themselves allow (largest change ${worst})`);
    const dry = mk('earth', 'desert_canyon', 0); const pd = run(dry, norm(V(0.6, 0.04, 0.8)), 20);
    assert.equal(dry.physics.water('earth', pd, {}).present, false);
    assert.equal(dry.physics.fields.water.heightAt(pd), 0);
  } finally { setWindScale('earth', s0); }
  const moon = mk('moon', 'mare', 2); const pm = run(moon, norm(V(0.6, 0.04, 0.8)), 20);
  assert.equal(moon.physics.water('moon', pm, {}).significant, 0, 'no wind, no waves');
});

test('the GLSL twin declares what the uniforms object carries, and shares the frame block with the flora chunk', async () => {
  const { FLORA_GLSL } = await import('./flora.glsl.js');
  for (const n of ['pcPhysWater', 'pcPhysWaterHeight', 'pcPhysWake', 'uPhysWaterDir', 'uPhysWaterK', 'uPhysWaterAmp', 'uPhysWaterPhase', 'uPhysWaterGroup', 'uPhysWake', 'uPhysWakeG', '#ifndef PC_PHYS_FRAME']) assert.ok(WATER_GLSL.includes(n), n);
  assert.ok(FLORA_GLSL.includes('#ifndef PC_PHYS_FRAME') && FLORA_GLSL.includes('pcPhysGrid'));
  const both = FLORA_GLSL + WATER_GLSL;
  assert.equal((both.match(/#ifndef PC_PHYS_FRAME/g) || []).length, 2);
  assert.equal((both.match(/{/g) || []).length, (both.match(/}/g) || []).length);
});

test('waves come in sets: the height swells and fades along the sea, the sets travel at half the wave speed, and nothing repeats like wallpaper', () => {
  const F = new WaterField(), frame = { version: 1 };
  for (let i = 0; i < 600; i++) F.update(1 / 60, frame, 15, 0, 0, 200, 2500, 9.81, 1.2, 999, 0, 0);
  // the local height of the sea (largest elevation within a wavelength) along the wind
  const L = F.length, local = (x) => { let m = 0; for (let s = 0; s < 24; s++) m = Math.max(m, Math.abs(F.heightAt(x + s * L / 24, 0))); return m; };
  let lo = 1e9, hi = 0; for (let k = 0; k < 60; k++) { const h = local(k * L * 1.3); lo = Math.min(lo, h); hi = Math.max(hi, h); }
  assert.ok(hi > lo * 1.7, `sets: the highest stretch is ${hi.toFixed(2)} m, the calmest ${lo.toFixed(2)} m`);
  // no period: the surface 30 or 60 wavelengths on does not match the surface here
  const corr = (lag) => { let a = 0, b = 0, c = 0; for (let k = 0; k < 400; k++) { const x = k * 0.37 * L, z = k * 0.11 * L, p = F.heightAt(x, z), q = F.heightAt(x + lag, z + lag * 0.2); a += p * q; b += p * p; c += q * q; } return a / Math.sqrt(b * c); };
  let mean = 0; const lags = [9, 17, 30, 44, 61, 83];
  for (const n of lags) { const c = Math.abs(corr(n * L)); mean += c / lags.length; assert.ok(c < 0.6, `correlation ${n} wavelengths away: ${c.toFixed(2)}`); }
  assert.ok(mean < 0.35, 'mean correlation at long range: ' + mean.toFixed(2));
  // the envelope of the main train moves at half its phase speed
  const g0 = F.gphase[0], p0 = F.phase[0];
  for (let i = 0; i < 60; i++) F.update(1 / 60, frame, 15, 0, 0, 200, 2500, 9.81, 1.2, 999, 0, 0);
  const cg = (F.gphase[0] - g0) / Math.hypot(F.gx[0], F.gz[0]), c = (F.phase[0] - p0) / F.k[0];
  assert.ok(Math.abs(cg / c - 0.5) < 0.02, `group speed ${cg.toFixed(2)} m/s against phase speed ${c.toFixed(2)}`);
  // the sea still measures what it says: 4 sigma of the surface is the significant height
  let v = 0, n = 0; for (let k = 0; k < 4000; k++) { const h = F.heightAt(k * 1.37 * L, k * 0.73 * L); v += h * h; n++; }
  assert.ok(Math.abs(4 * Math.sqrt(v / n) / F.height - 1) < 0.12, `4 sigma ${(4 * Math.sqrt(v / n)).toFixed(2)} m against Hs ${F.height.toFixed(2)} m`);
});

test('wakes: rings spread from where the liquid was disturbed at the group speed of their own waves, and die away', () => {
  const F = new WaterField(), frame = { version: 1 };
  F.update(1 / 60, frame, 0, 0, 0, 200, 2500, 9.81, 1.2, 999, 0, 0);       // a flat calm
  assert.equal(F.heightAt(3, 4), 0);
  F.addWake(0, 0, 0.05);
  const L = 0.8 + 14 * 0.05, c = Math.sqrt(9.81 * L / (2 * Math.PI));
  let peakR = 0, peak = 0;
  for (let i = 0; i < 120; i++) F.update(1 / 60, frame, 0, 0, 0, 200, 2500, 9.81, 1.2, 999, 0, 0);     // 2 s
  for (let r = 0; r < 12; r += 0.02) { const h = Math.abs(F.heightAt(r, 0)); if (h > peak) { peak = h; peakR = r; } }
  assert.ok(Math.abs(peakR - 0.5 * c * 2) < 0.6 * L, `after 2 s the ring is ${peakR.toFixed(2)} m out (group speed ${(0.5 * c).toFixed(2)} m/s)`);
  assert.ok(peak > 0.004 && peak < 0.05, 'and lower than it began: ' + peak);
  assert.ok(Math.abs(F.heightAt(peakR * 0.6, peakR * 0.8) - F.heightAt(peakR, 0)) < 1e-9, 'a ring: the same all the way round');
  assert.equal(F.heightAt(40, 0), 0, 'nothing far away yet');
  // carried over a re-anchor, gone after its life
  const h0 = F.heightAt(peakR, 0); F.rebase(frame, 100, -50);
  assert.ok(Math.abs(F.heightAt(peakR - 100, 50) - h0) < 1e-6);
  for (let i = 0; i < 60 * 12; i++) F.update(1 / 60, frame, 0, 0, 0, 200, 2500, 9.81, 1.2, 999, 0, 0);
  let any = 0; for (let r = 0; r < 40; r += 0.1) any = Math.max(any, Math.abs(F.heightAt(r - 100, 50)));
  assert.equal(any, 0, 'died away');
});

test('in the game loop: a swimmer trails a wake, a hovering ship presses rings out of the sea, dry land takes none', () => {
  const R = BODIES.earth.radius, d = norm(V(0.6, 0.04, 0.8));
  const mk = (sea) => { const sample = makeWorld({ R, biome: 'sea_coast', sea: sea ? R + sea : 0 }); return createPhysics({ sampleSurface: (id, dd) => sample(dd), timeBudget: false }); };
  const s0 = WINDS.earth.scale;
  try {
    setWindScale('earth', 50);                                             // a flat calm, so that only the wakes move the surface
    const sea = mk(3); let t = 100; let p = V(d.x * (R + 2.2), d.y * (R + 2.2), d.z * (R + 2.2)); const e = norm(V(-d.z, 0, d.x));
    for (let i = 0; i < 60; i++) { t += 1 / 60; sea.update(1 / 60, { bodyId: 'earth', time: t, focus: p }); }
    const start = p;
    for (let i = 0; i < 60 * 6; i++) { t += 1 / 60; p = V(p.x + e.x * 2 / 60, p.y, p.z + e.z * 2 / 60); const l = len(p); p = V(p.x * (R + 2.2) / l, p.y * (R + 2.2) / l, p.z * (R + 2.2) / l);
      sea.update(1 / 60, { bodyId: 'earth', time: t, focus: p, disturbers: [{ kind: 'explorer', p, v: V(e.x * 2, 0, e.z * 2), radius: 0.35, strength: 1, grounded: false }] }); }
    const W = sea.fields.water.field; let live = 0; for (let w = 3; w < W.wake.length; w += 4) if (W.wake[w] > 0) live++;
    assert.ok(live >= 4, 'sources along the path: ' + live);
    const behind = V((start.x + p.x) / 2, (start.y + p.y) / 2, (start.z + p.z) / 2); let worstB = 0, worstA = 0;
    for (let k = -8; k <= 8; k++) { const q = V(behind.x + d.y * k * 0.3, behind.y, behind.z + k * 0.1); worstB = Math.max(worstB, Math.abs(sea.fields.water.heightAt(q))); }
    const ahead = V(p.x + e.x * 25, p.y, p.z + e.z * 25); worstA = Math.abs(sea.fields.water.heightAt(ahead));
    assert.ok(worstB > 0.003 && worstA < 1e-6, `behind the swimmer ${worstB.toFixed(4)} m, 25 m ahead ${worstA}`);
    // a ship hovering 4 m over the sea
    const sea2 = mk(3); t = 100; const hov = V(d.x * (R + 7), d.y * (R + 7), d.z * (R + 7));
    for (let i = 0; i < 60 * 5; i++) { t += 1 / 60; sea2.update(1 / 60, { bodyId: 'earth', time: t, focus: hov, disturbers: [{ kind: 'ship', p: hov, v: V(), radius: 4.2, strength: 1 }, { kind: 'downwash', p: hov, v: V(), radius: 2.2, strength: 4200 * 9.81 * 0.3 }] }); }
    let ring = 0; for (let r = 1; r < 14; r += 0.25) { const q = V(hov.x + e.x * r, hov.y, hov.z + e.z * r); ring = Math.max(ring, Math.abs(sea2.fields.water.heightAt(q))); }
    assert.ok(ring > 0.003 && ring < 0.3, 'rings under the hovering ship: ' + ring);       // (the hover thrusters press about 4 cm into water)
    // dry land: nothing
    const dry = mk(0); t = 100;
    for (let i = 0; i < 120; i++) { t += 1 / 60; dry.update(1 / 60, { bodyId: 'earth', time: t, focus: hov, disturbers: [{ kind: 'downwash', p: hov, v: V(), radius: 2.2, strength: 12000 }] }); }
    let any = 0; for (let w = 3; w < dry.fields.water.field.wake.length; w += 4) any += dry.fields.water.field.wake[w];
    assert.equal(any, 0);
  } finally { setWindScale('earth', s0); }
});
