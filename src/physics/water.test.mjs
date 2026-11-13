// Tests: wind waves. Run: node --test src/physics/
import test from 'node:test';
import assert from 'node:assert/strict';
import { windSea, WaterField, WATER_GLSL, WATER, fetchOf, foamLevel, foamCover, whiteWind, surf01, FetchGauge } from './water.js';
import { createPhysics, QUALITY } from './index.js';
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
  const F = new WaterField({ swell: false }), frame = { version: 1 };
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

// ---- the sea for a painter's own liquid: slope, crest direction, crests, foam ----------------------
// (the wind sea alone: the swell an open sea has under it since P7 has its own test)
const gale = (U = 18, seconds = 20, F = new WaterField({ swell: false })) => { const frame = { version: 1 }; for (let i = 0; i < seconds * 60; i++) F.update(1 / 60, frame, U * 0.8, U * 0.6, 0, 200, 2500, 9.81, 1.225, 999, 0, 0); return F; };

test('surfaceAt: the slope is the slope of heightAt, wakes included, and the crest direction lies along the crests', () => {
  const F = gale(18);
  F.addWake(3, -2, 0.08); F.addWake(-6, 5, 0.03);
  for (let i = 0; i < 90; i++) F.update(1 / 60, { version: 1 }, 14.4, 10.8, 0, 200, 2500, 9.81, 1.225, 999, 0, 0);
  const o = {}, e = 1e-4; let worst = 0, steep = 0;
  for (let k = 0; k < 400; k++) {
    const x = Math.sin(k * 1.31) * 25, z = Math.cos(k * 0.77) * 25;
    F.surfaceAt(x, z, o);
    assert.ok(Math.abs(o.height - F.heightAt(x, z)) < 1e-12);
    const de = (F.heightAt(x + e, z) - F.heightAt(x - e, z)) / (2 * e), dn = (F.heightAt(x, z + e) - F.heightAt(x, z - e)) / (2 * e);
    worst = Math.max(worst, Math.abs(o.de - de), Math.abs(o.dn - dn)); steep = Math.max(steep, Math.hypot(o.de, o.dn));
    assert.ok(Math.abs(Math.hypot(o.ax, o.az) - 1) < 1e-9, 'unit');
    // the crests lie across the wind, within the spread of the trains
    assert.ok(Math.abs(o.ax * 0.8 + o.az * 0.6) < Math.sin(0.5), 'along the crests, not along the wind: ' + (o.ax * 0.8 + o.az * 0.6));
  }
  assert.ok(worst < 1e-5 && steep > 0.1, `slope against finite differences: ${worst} (steepest ${steep.toFixed(2)})`);
  // walking along the crest direction from a crest, the surface stays high; across it, it falls away
  let alongDrop = 0, acrossDrop = 0, n = 0;
  for (let k = 0; k < 4000 && n < 40; k++) {
    const x = Math.sin(k * 2.1) * 200, z = Math.cos(k * 1.3) * 200;
    F.surfaceAt(x, z, o);
    if (o.crest01 < 0.95) continue;
    const h = o.height, ax = o.ax, az = o.az, s = F.length * 0.2;
    alongDrop += h - Math.min(F.heightAt(x + ax * s, z + az * s), F.heightAt(x - ax * s, z - az * s));
    acrossDrop += h - Math.min(F.heightAt(x - az * s, z + ax * s), F.heightAt(x + az * s, z - ax * s)); n++;
  }
  assert.ok(n === 40 && acrossDrop > alongDrop * 2.5, `a fifth of a wavelength along a crest the sea drops ${(alongDrop / n).toFixed(3)} m, across it ${(acrossDrop / n).toFixed(3)} m`);
});

test('crests are the tops of the higher waves; a calm sea has none worth the name beyond its own ripples', () => {
  const F = gale(18), o = {};
  let top = 0, any = 0, N = 0, trough = 0;
  for (let j = 0; j < 150; j++) for (let i = 0; i < 150; i++) {
    F.surfaceAt(i * 1.9, j * 2.3, o); N++;
    if (o.crest01 > 0.5) { top++; assert.ok(o.height > WATER.crestLow * F.height); }
    if (o.crest01 > 0) any++;
    if (o.height < 0 && o.crest01 > 0) trough++;
  }
  assert.equal(trough, 0, 'never in a trough');
  assert.ok(top / N > 0.03 && top / N < 0.15 && any / N < 0.4, `crest01 over half on ${(100 * top / N).toFixed(1)} % of the sea, over nothing on ${(100 * (1 - any / N)).toFixed(0)} %`);
});

test('whitecaps: the breaking share of the sea follows the wind as measured at sea, and the foam covers exactly that share', () => {
  // Monahan and O'Muircheartaigh 1980: W = 3.84e-6 U^3.41, over the game's longest fetch
  for (const U of [10, 15, 20]) {
    const s = windSea(U, 2500, 9.81, 1.225, 999, 1e9), W = foamCover(s.whitecap01), M = 3.84e-6 * Math.pow(U, 3.41);
    assert.ok(W / M > 0.6 && W / M < 1.7, `${U} m/s: ${(W * 100).toFixed(1)} % against ${(M * 100).toFixed(1)} %`);
  }
  assert.ok(foamCover(windSea(4, 2500, 9.81, 1.225, 999, 1e9).whitecap01) < WATER.foamMin, 'a light breeze breaks nothing');
  // the level is a quantile: higher for a smaller share, never above the highest possible crest
  let prev = 9; for (const W of [0.0005, 0.002, 0.01, 0.04, 0.1, 0.15]) { const q = foamLevel(W); assert.ok(q < prev && q > 0.15 && q < 0.5 * WATER.shares.reduce((a, b) => a + b, 0) * (1 + WATER.group), `${W}: ${q}`); prev = q; }
  // on the sea itself: count the foam
  const o = {};
  for (const U of [12, 16, 22]) {
    const F = gale(U);
    assert.ok(F.cover > 0.005 && F.foamAt < F.height, `U ${U}: cover ${F.cover}, breaking above ${F.foamAt} m of Hs ${F.height}`);
    let foam = 0, N = 0;
    for (let j = 0; j < 220; j++) for (let i = 0; i < 220; i++) { F.surfaceAt(i * 2.7 + j * 0.31, j * 3.1, o); N++; if (o.height > F.foamAt) foam++; if (o.foam01 > 0) assert.ok(o.crest01 > 0.3, 'foam only on crests'); }
    assert.ok(Math.abs(foam / N / F.cover - 1) < 0.25, `U ${U}: ${(100 * foam / N).toFixed(2)} % of the surface breaks, the law says ${(100 * F.cover).toFixed(2)} %`);
    assert.deepEqual(F.uniforms.uPhysWaterSea.map((x) => +x.toFixed(6)), [F.height, F.foamAt, F.height * WATER.foamEdge, F.cover].map((x) => +x.toFixed(6)));
  }
  // a breeze: no foam anywhere, and the uniform says so
  const B = gale(4);
  assert.equal(B.uniforms.uPhysWaterSea[3], 0); assert.ok(B.uniforms.uPhysWaterSea[1] > 1e8);
  for (let k = 0; k < 500; k++) assert.equal(B.surfaceAt(k * 3.3, k * 1.7, o).foam01, 0);
});

test('P26 white water in a storm (the coordinator\'s ruling: the 15 % cap lifted): beyond a gale the white share follows the wind by Monahan\'s law carried on, saturating toward all of the sea; to a gale nothing changes; other worlds by the wind\'s power on the liquid\'s weight', () => {
  // Until P26 cover = foamMax whitecap01^foamPower stopped at 15 % (a sea cannot stand steeper than it does in a gale):
  // Neptune's 75 m/s squall had 12 % of its sea white, where a real sea at hurricane force (33 m/s) is white with foam
  // and streaks. Now, where it is more, cover = 1 - exp(-whitecap01 x 3.84e-6 Ue^3.41): patches of white laid at random
  // overlap, so the law's W covers 1 - exp(-W).
  const sea = (U) => windSea(U, 2500, 9.81, 1.225, 999, 1e9), cov = (U) => foamCover(sea(U).whitecap01, whiteWind(U, 9.81, 1.225, 999));
  // to a fresh gale: as it was, to the digit
  for (const U of [4, 8, 10, 12, 15, 18, 20]) assert.equal(cov(U), foamCover(sea(U).whitecap01), `${U} m/s: ${cov(U)}`);
  // beyond it: the law carried on (30 m/s: a third of the sea; 55: nearly all; 75: all), rising all the way
  const c30 = cov(30), c40 = cov(40), c55 = cov(55), c75 = cov(75);
  console.log(`# P26 white share of an open sea on Earth: ${[15, 20, 22, 25, 30, 40, 55, 75].map((U) => U + ' m/s ' + (100 * cov(U)).toFixed(1) + ' %').join(', ')}`);
  assert.ok(Math.abs(c30 - (1 - Math.exp(-sea(30).whitecap01 * 3.84e-6 * Math.pow(30, 3.41)))) < 1e-12, '30 m/s: ' + c30);
  assert.ok(c30 > 0.28 && c30 < 0.40 && c40 > 0.6 && c40 < 0.75 && c55 > 0.93 && c55 < 0.99 && c75 > 0.999 && c75 <= 1, `30, 40, 55, 75 m/s: ${c30.toFixed(3)}, ${c40.toFixed(3)}, ${c55.toFixed(3)}, ${c75.toFixed(5)}`);
  let prev = 0; for (let U = 2; U <= 90; U += 1) { const c = cov(U); assert.ok(c >= prev - 1e-12 && c <= 1, `${U} m/s: ${c} after ${prev}`); prev = c; }
  assert.equal(foamCover(1), WATER.foamMax, 'with no wind given: the steepness\'s law alone');
  // the wind as on Earth: Earth's own; Neptune's 75 m/s over methane (0.99 kg/m3 of air, 450 of liquid, 11.15 m/s2) about 86
  assert.ok(Math.abs(whiteWind(30, 9.81, 1.225, 999) - 30) < 1e-9);
  const nep = whiteWind(75, 11.15, 0.99, 450);
  assert.ok(nep > 80 && nep < 92, 'Neptune: ' + nep);
  assert.ok(whiteWind(30, 9.81, 2.45, 999) > 30 && whiteWind(30, 19.6, 1.225, 999) < 30 && whiteWind(0, 9.81, 1.225, 999) === 0, 'denser air whitens more, more gravity less');
  // the level is a quantile all the way: lower for a larger share, under the mean surface beyond half of it, the lowest trough at all of it
  prev = 9; for (const W of [0.15, 0.3, 0.398, 0.4, 0.5, 0.67, 0.8, 0.96, 0.999, 1]) { const q = foamLevel(W); assert.ok(q <= prev + 1e-9 && q > -1.2, `${W}: ${q} after ${prev}`); prev = q; }
  assert.ok(foamLevel(0.6) < 0 && foamLevel(0.3) > 0 && Math.abs(foamLevel(0.3981) - foamLevel(0.3982)) < 2e-3, 'half the surface stands above its mean; no step where the tables meet');
  // on the sea itself: count the foam in a storm, a hurricane and beyond
  const o = {};
  for (const U of [30, 40, 55]) {
    const F = gale(U, 60);
    assert.ok(Math.abs(F.whiteWind - U) < 0.5, `U ${U}: the sea has felt ${F.whiteWind} m/s`);
    assert.ok(Math.abs(F.cover - foamCover(F.whitecap01, F.whiteWind)) < 1e-12 && F.cover > 0.3, `U ${U}: cover ${F.cover}`);
    let foam = 0, N = 0;
    for (let j = 0; j < 220; j++) for (let i = 0; i < 220; i++) { F.surfaceAt(i * 2.7 + j * 0.31, j * 3.1, o); N++; if (o.height > F.foamAt) foam++; }
    assert.ok(Math.abs(foam / N / F.cover - 1) < 0.08, `U ${U}: ${(100 * foam / N).toFixed(1)} % of the surface is white, the law says ${(100 * F.cover).toFixed(1)} %`);
    assert.deepEqual(F.uniforms.uPhysWaterSea.map((x) => +x.toFixed(6)), [F.significant, F.foamAt, F.height * WATER.foamEdge, F.cover].map((x) => +x.toFixed(6)));
  }
  // the white outlasts the wind as the swell does (foam and streaks linger): 20 s after a 55 m/s wind falls to 10, still
  // mostly white; ten minutes after, a fresh breeze's sea
  const F = gale(55, 60), frame = { version: 1 }, c0 = F.cover;
  for (let i = 0; i < 20 * 60; i++) F.update(1 / 60, frame, 8, 6, 0, 200, 2500, 9.81, 1.225, 999, 0, 0);
  const c20 = F.cover;
  for (let i = 0; i < 600 * 60; i++) F.update(1 / 60, frame, 8, 6, 0, 200, 2500, 9.81, 1.225, 999, 0, 0);
  assert.ok(c0 > 0.93 && c20 > 0.5 && c20 < c0 && F.cover < 0.05, `the white share: ${c0.toFixed(2)} in the storm, ${c20.toFixed(2)} 20 s after, ${F.cover.toFixed(3)} ten minutes after`);
});

test('surf: a wave breaks where the liquid is shallower than 1.28 wave heights', () => {
  assert.equal(surf01(0.6, 5), 0, 'deep water');
  assert.equal(surf01(0.6, 0.6 / WATER.surfBreak + 0.01), 0);
  assert.ok(surf01(0.6, 0.6) > 0.2 && surf01(0.6, 0.6) < 0.8);
  assert.equal(surf01(0.6, 0.25), 1, 'fully broken in the shallows');
  assert.equal(surf01(0.01, 0.001), 0, 'ripples do not make surf');
});

test('the chunk carries the same formulas as the twin: constants, uniforms and functions', () => {
  for (const n of ['uniform vec4 uPhysWaterSea', 'vec3 pcPhysWaterD(vec3 p, out vec2 along)', 'vec2 pcPhysWaterCrest(vec3 w)', 'float pcPhysWaterSurf(float depth)', 'vec3 pcPhysWaterNormal(vec3 w, vec3 up)', 'vec3 pcPhysWaterDir(vec2 a)', 'D += A * env * di;',
    `smoothstep(${WATER.crestLow}, ${WATER.crestHigh}, w.x / hs)`, `smoothstep(0.5, ${1 / WATER.surfBreak}, depth / uPhysWaterSea.x)`, 'smoothstep(uPhysWaterSea.y, uPhysWaterSea.y + uPhysWaterSea.z, w.x)']) assert.ok(WATER_GLSL.includes(n), n);
  assert.equal((WATER_GLSL.match(/{/g) || []).length, (WATER_GLSL.match(/}/g) || []).length);
  assert.equal((WATER_GLSL.match(/\(/g) || []).length, (WATER_GLSL.match(/\)/g) || []).length);
  // (the numbers of chunk and twin are compared in a real GL context: physics-lab.html, window.__lab.waterAgreement())
});

// ---- P7: the swell, and the crest as a line ------------------------------------------------------

test('an open sea has a swell under its wind sea: several times longer, higher, seen far out; a lake has none; the foam still covers what the law says', () => {
  const frame = { version: 1 }, o = {};
  const run = (U, fetch, seconds = 30, F = new WaterField()) => { for (let i = 0; i < seconds * 60; i++) F.update(1 / 60, frame, U * 0.8, U * 0.6, 0, 200, fetch, 9.81, 1.225, 999, 0, 0); return F; };
  for (const U of [8, 16, 30]) {
    const F = run(U, 2500), sea = windSea(U, 2500, 9.81, 1.225, 999, 200), far = windSea(U, 2500 * WATER.swellFetch, 9.81, 1.225, 999, 200);
    assert.equal(F.open, 1);
    const Ls = 2 * Math.PI / F.k[3], As = F.amp[3];
    assert.ok(Math.abs(Ls / far.length - 1) < 0.05 && Ls > 3.5 * F.length, `U ${U}: swell ${Ls.toFixed(0)} m long on a ${F.length.toFixed(1)} m sea`);
    assert.ok(Math.abs(2 * As / (far.height * WATER.swellDecay) - 1) < 0.05 && 2 * As > 0.9 * sea.height, `U ${U}: swell ${(2 * As).toFixed(2)} m high, wind sea ${sea.height.toFixed(2)} m`);
    assert.ok(2 * As / Ls < 0.04, 'a swell is not steep');
    // the sea measures what it says: 4 sigma of the whole surface is `significant`
    let v = 0; for (let k = 0; k < 6000; k++) { const h = F.heightAt(k * 1.37 * Ls, k * 0.73 * Ls); v += h * h; }
    assert.ok(Math.abs(4 * Math.sqrt(v / 6000) / F.significant - 1) < 0.1 && F.significant > F.height * 1.3, `4 sigma ${(4 * Math.sqrt(v / 6000)).toFixed(2)} against ${F.significant.toFixed(2)} (wind sea ${F.height.toFixed(2)})`);
    // foam: the share of the surface that breaks is still the law's, with the swell under it
    if (F.foamAt < 1e8) {
      let foam = 0, N = 0;
      for (let j = 0; j < 260; j++) for (let i = 0; i < 260; i++) { F.surfaceAt(i * 2.7 + j * 0.31, j * 3.1, o); N++; if (o.height > F.foamAt) foam++; }
      assert.ok(Math.abs(foam / N / F.cover - 1) < 0.3, `U ${U}: ${(100 * foam / N).toFixed(2)} % of the surface breaks, the law says ${(100 * F.cover).toFixed(2)} %`);
    }
  }
  // a lake, a pond: the four trains of the wind sea and nothing else
  for (const fetch of [40, 400]) { const F = run(12, fetch), G = run(12, fetch, 30, new WaterField({ swell: false })); assert.equal(F.open, 0); for (let i = 0; i < 4; i++) assert.ok(Math.abs(F.amp[i] - G.amp[i]) < 1e-12 && Math.abs(F.k[i] - G.k[i]) < 1e-12); assert.ok(Math.abs(F.significant / F.height - 1) < 0.01); }
  // it outlasts the wind: a minute after the gale has dropped to a breeze the wind sea has all but gone, the swell is still half itself
  const F = run(24, 2500, 40), a0 = F.amp[3], h0 = F.height;
  run(3, 2500, 60, F);
  assert.ok(F.height < 0.25 * h0 && F.amp[3] > 0.45 * a0, `wind sea ${(F.height / h0).toFixed(2)} of what it was, swell ${(F.amp[3] / a0).toFixed(2)}`);
  // and nothing jumps while it changes: the surface at the focus moves no faster than its waves
  let worst = 0, prev = F.heightAt(0, 0);
  for (let i = 0; i < 600; i++) { F.update(1 / 60, frame, 20, 5, 0, 200, 2500, 9.81, 1.225, 999, 0, 0); const h = F.heightAt(0, 0); worst = Math.max(worst, Math.abs(h - prev)); prev = h; }
  assert.ok(worst < 0.08, `the surface at the focus moves ${worst.toFixed(3)} m a frame at most`);
});

test('the crest as a line: a narrow stroke along the top of the high waves, a small share of the cap; GLSL twin present', () => {
  const frame = { version: 1 }, o = {};
  const F = new WaterField(); for (let i = 0; i < 1800; i++) F.update(1 / 60, frame, 14, 10, 0, 200, 2500, 9.81, 1.225, 999, 0, 0);
  let cap = 0, line = 0, N = 0;
  for (let j = 0; j < 300; j++) for (let i = 0; i < 300; i++) {
    F.surfaceAt(i * 0.83 + j * 0.21, j * 0.97, o); N++;
    if (o.crest01 > 0.5) cap++;
    if (o.line01 > 0.5) { line++; assert.ok(o.crest01 > 0.5, 'the line lies on the cap'); assert.ok(o.height > 0, 'on a top'); }
  }
  assert.ok(line > 0 && line / N < 0.035 && line < 0.3 * cap, `line on ${(100 * line / N).toFixed(1)} % of the sea, cap on ${(100 * cap / N).toFixed(1)} %`);
  // across a wave the line is narrow: walking along the way the waves run, each run of line01 > 0.5 is under a fifth of the main wavelength
  const dx = F.dir[0], dz = F.dir[1]; let run = 0, longest = 0, runs = 0, total = 0;
  for (let k = 0; k < 40000; k++) { F.surfaceAt(dx * k * 0.05, dz * k * 0.05, o); if (o.line01 > 0.5) { run++; longest = Math.max(longest, run); } else { if (run > 0) { runs++; total += run; } run = 0; } }
  const mean = total / runs * 0.05, Ls = 2 * Math.PI / F.k[3];
  // (a line a seventh of the short wavelength wide on average; the widest, where the chop is flat on top of a swell, a small part of the swell)
  assert.ok(runs > 20 && mean < 0.16 * F.length && longest * 0.05 < 0.12 * Ls, `the line is ${mean.toFixed(2)} m wide on average (widest ${(longest * 0.05).toFixed(2)} m) on a ${F.length.toFixed(1)} m sea over a ${Ls.toFixed(0)} m swell`);
  assert.ok(WATER_GLSL.includes('float pcPhysWaterCrestLine(vec3 w, vec2 along)'));
});

test('P12 the swash: the water runs up a beach in a third of the wave period and drains back in two thirds, as high as Stockdon\'s beaches', () => {
  const frame = { version: 1 }, F = new WaterField();
  for (let i = 0; i < 40 * 60; i++) F.update(1 / 60, frame, 16 * 0.8, 16 * 0.6, 0, 200, 2500, 9.81, 1.225, 999, 0, 0);
  const L = 2 * Math.PI / F.k[3], q = Math.sqrt(F.significant * L), T = 2 * Math.PI / F.omega[3], slope = 0.07;
  // a minute at one place on the shore, 120 Hz
  let lo = 9, hi = -9, mean = 0, up = 0, down = 0, prev = F.runupAt(3, 5, slope), n = 0;
  for (let i = 0; i < 60 * 120; i++) {
    F.update(1 / 120, frame, 16 * 0.8, 16 * 0.6, 0, 200, 2500, 9.81, 1.225, 999, 0, 0);
    const r = F.runupAt(3, 5, slope); lo = Math.min(lo, r); hi = Math.max(hi, r); mean += r; n++;
    if (r > prev) up++; else down++; prev = r;
  }
  mean /= n;
  console.log(`# swash on a 0.07 beach: sea ${F.significant.toFixed(2)} m, long train ${L.toFixed(0)} m, period ${T.toFixed(1)} s: set-up ${mean.toFixed(2)} m, the edge between ${lo.toFixed(2)} and ${hi.toFixed(2)} m (${((hi - lo) / slope).toFixed(1)} m up and down the beach), rising ${(up / n * 100).toFixed(0)} % of the time`);
  assert.ok(Math.abs(mean - 0.35 * slope * q) < 0.05 * slope * q + 0.01, `set-up ${mean} against ${0.35 * slope * q}`);
  // (sets of waves: the largest swing is the mean one times 1 + WATER.group)
  assert.ok(hi - lo > 0.75 * slope * q * 0.95 && hi - lo < 0.75 * slope * q * (1 + WATER.group) * 1.05, `swing ${hi - lo} against ${0.75 * slope * q}`);
  assert.ok(up / n > 0.28 && up / n < 0.40, `the uprush takes ${(up / n).toFixed(2)} of the time (a third)`);
  // a steeper beach is climbed higher, a flat one hardly; a wall never more than twice the wave height; no sea, no swash
  assert.ok(F.runupAt(3, 5, 0.14) - F.runupAt(3, 5, 0) !== 0 && Math.abs(F.runupAt(3, 5, 0)) < 1e-9);
  let wall = 0; for (let i = 0; i < 600; i++) { F.update(1 / 60, frame, 16 * 0.8, 16 * 0.6, 0, 200, 2500, 9.81, 1.225, 999, 0, 0); wall = Math.max(wall, F.runupAt(3, 5, 50) - 0.35 * 50 * q); }
  assert.ok(wall <= F.significant * (1 + WATER.group) * 1.01, `on a wall ${wall} m over the set-up, the sea ${F.significant}`);
  assert.equal(new WaterField().runupAt(0, 0, 0.07), 0);
  assert.ok(WATER_GLSL.includes('float pcPhysWaterRunup(vec3 p, float slope)') && WATER_GLSL.includes('vec3 pcPhysWaterLong(vec3 p)'));
});

// ---- (P16) the fetch, measured; the depth, felt ----------------------------------------------------------
test('P16 depth-limited growth (SPM 1984): deep water as before; over a shallow bottom the sea grows slower and stops lower', () => {
  // deep water: exactly the deep-water laws
  for (const [U, F] of [[8, 300], [20, 2500], [30, 1e6]]) {
    const a = windSea(U, F, 9.81, 1.225, 999, Infinity), b = windSea(U, F, 9.81, 1.225, 999, 5000);
    // (the period law's tanh still takes 0.07 % off a fully developed 30 m/s sea in 5 km of water: within 0.2 %)
    assert.ok(Math.abs(a.height - b.height) < 1e-4 * a.height && Math.abs(a.period - b.period) < 2e-3 * a.period, `U ${U} F ${F}: ${a.height} / ${b.height}, ${a.period} / ${b.period} s`);
  }
  // the shallow-water curves themselves, where the sea is fetch-limited (below the fully developed cap)
  const spmH = (U, F, d, g) => { const t = Math.tanh(0.530 * Math.pow(g * d / U / U, 0.75)); return 0.283 * t * Math.tanh(0.00565 * Math.sqrt(g * F / U / U) / t) * U * U / g; };
  for (const [U, F, d] of [[20, 10000, 5], [15, 2500, 2], [30, 500, 3.4], [10, 20000, 8]]) {
    const s = windSea(U, F, 9.81, 1.225, 999, d), ref = spmH(U, F, d, 9.81);
    assert.ok(Math.abs(s.height / Math.min(ref, WATER.breakRatio * d) - 1) < 0.03, `U ${U} F ${F} d ${d}: ${s.height.toFixed(3)} m against SPM ${ref.toFixed(3)}`);
  }
  // 3.4 m of water under 30 m/s: over 2500 m a little lower and shorter than in deep water (the sea is still young);
  // over 30 km (the fetch of an open sea's swell) under half of it (1.1 m against 2.7)
  const lag = windSea(30, 2500, 9.81, 1.225, 999, 3.4), open = windSea(30, 2500, 9.81, 1.225, 999, Infinity);
  assert.ok(lag.height < 0.95 * open.height && lag.period < open.period, `lagoon ${lag.height.toFixed(2)} m ${lag.period.toFixed(1)} s, open ${open.height.toFixed(2)} m ${open.period.toFixed(1)} s`);
  const lagL = windSea(30, 30000, 9.81, 1.225, 999, 3.4), openL = windSea(30, 30000, 9.81, 1.225, 999, Infinity);
  assert.ok(lagL.height < 0.5 * openL.height && lagL.height < WATER.breakRatio * 3.4, `over 30 km: ${lagL.height.toFixed(2)} m against ${openL.height.toFixed(2)} m`);
  let prev = 0; for (let d = 0.2; d < 400; d *= 1.3) { const h = windSea(25, 2500, 9.81, 1.225, 999, d).height; assert.ok(h >= prev - 1e-12, `depth ${d}`); prev = h; }
});

test('P16 whitecaps need waves long enough to trap air: ripples of a pond in a breeze are not white, a gale\'s chop is', () => {
  const pond = windSea(8.8, 24, 9.81, 1.225, 999, 2);
  assert.ok(pond.steepness > 0.075 && pond.length < 0.5 && pond.whitecap01 === 0, `ripples ${pond.length.toFixed(2)} m long, steepness ${pond.steepness.toFixed(3)}: white ${pond.whitecap01}`);
  const chop = windSea(30, 133, 11, 1.2, 450, 3.3);
  assert.ok(chop.length > 1.3 && chop.whitecap01 > 0.8, `a gale's chop ${chop.length.toFixed(2)} m: white ${chop.whitecap01}`);
});

// a round lake of radius a (m) and depth dep (m) on a 4 km sphere, centred on C; dry land 1 m up elsewhere
const lakeWorld = (C, a, dep, R = 4000, biome = 'sea_coast') => (d) => {
  const l = Math.hypot(d.x, d.y, d.z), x = d.x / l, y = d.y / l, z = d.z / l, s = Math.acos(Math.min(1, x * C.x + y * C.y + z * C.z)) * R;
  const wet = s < a;
  return { radius: wet ? R - dep : R + 1, liquidRadius: wet ? R : 0, isLiquid: wet, normal: { x, y, z }, slope: 0, biomeId: biome, biomeWeights: { [biome]: 1 } };
};
test('P16 the fetch gauge: the mean of five radials upwind to the shore, the mean depth over them, capped; sparse and cached', () => {
  const R = 4000, C = norm(V(0.2, 0.9, 0.3)), lake = lakeWorld(C, 300, 3);
  // an upwind tangent at C, and the point 150 m downwind of the centre
  const t = norm(V(C.z, 0, -C.x)), at = (P, u, m) => { const th = m / R; return norm(V(P.x * Math.cos(th) + u.x * Math.sin(th), P.y * Math.cos(th) + u.y * Math.sin(th), P.z * Math.cos(th) + u.z * Math.sin(th))); };
  let calls = 0; const sample = (q) => { calls++; return lake(q); };
  const measure = (G, P, u, cap, budget = 8) => { let prev = -1, frames = 0;
    for (; frames < 200; frames++) { const c0 = calls; G.update('earth', P.x, P.y, P.z, u.x, u.y, u.z, R, cap, 3, sample, budget); assert.ok(calls - c0 <= budget, 'within the budget'); if (G.ready) break; assert.ok(G.fetch >= prev - 1e-9, 'a lower bound that only grows'); prev = G.fetch; }
    return frames; };
  // from the centre: every radial meets the shore 300 m out
  const G = new FetchGauge(); calls = 0;
  const fr = measure(G, C, t, 2500);
  assert.ok(Math.abs(G.fetch / 300 - 1) < 0.06 && Math.abs(G.depth - 3) < 1e-6, `from the centre: ${G.fetch.toFixed(0)} m (radials ${G.radial.map((r) => r.toFixed(0))}), depth ${G.depth}`);
  assert.ok(calls <= 5 * 40 && fr >= 3, `${calls} samples over ${fr + 1} frames`);
  // the same place and wind again, or 30 m away: nothing sampled
  const c1 = calls; G.update('earth', C.x, C.y, C.z, t.x, t.y, t.z, R, 2500, 3, sample, 8); G.update('earth', ...Object.values(at(C, t, 30)), t.x, t.y, t.z, R, 2500, 3, sample, 8);
  assert.equal(calls, c1, 'cached');
  // 150 m downwind of the centre: the radials run 445 to 450 m (the chord of the circle), their mean 448
  const P = at(C, V(-t.x, -t.y, -t.z), 150), G2 = new FetchGauge(); measure(G2, P, t, 2500);
  assert.ok(Math.abs(G2.fetch / 447.6 - 1) < 0.06, `150 m downwind of the centre: ${G2.fetch.toFixed(0)} m (radials ${G2.radial.map((r) => r.toFixed(0))})`);
  // the wind turned through 90 degrees there: a new measurement (the radials now cross the lake off its centre)
  const tl = norm(V(P.y * t.z - P.z * t.y, P.z * t.x - P.x * t.z, P.x * t.y - P.y * t.x)); const c2 = calls; measure(G2, P, tl, 2500);
  const want = Math.sqrt(300 * 300 - 150 * 150);
  assert.ok(calls > c2 && Math.abs(G2.fetch / want - 1) < 0.08, `across the wind: ${G2.fetch.toFixed(0)} m against ${want.toFixed(0)}`);
  // capped by the biome's fetch; an endless sea runs to the cap
  const G3 = new FetchGauge(); measure(G3, C, t, 100); assert.equal(G3.fetch, 100);
  const sea = (q) => ({ radius: R - 40, liquidRadius: R }), G4 = new FetchGauge(); let n4 = 0;
  while (!G4.ready && n4 < 400) { G4.update('earth', C.x, C.y, C.z, t.x, t.y, t.z, R, 2500, 40, sea, 8); n4++; }
  assert.ok(G4.fetch === 2500 && Math.abs(G4.depth - 40) < 1e-9, `open sea ${G4.fetch} m, ${G4.depth} m deep`);
  // a clock ration stops it early (two samples at least a frame)
  const G5 = new FetchGauge(); let c5 = calls, tick = 0; G5.update('earth', C.x, C.y, C.z, t.x, t.y, t.z, R, 2500, 3, sample, 50, () => (tick += 1), 0.5); assert.equal(calls - c5, 2);
});

test('P16 in the game loop: a gale over a small lake raises a chop; over an open sea, the sea; the fetch and depth are reported', () => {
  const R = BODIES.earth.radius, d = norm(V(0.6, 0.04, 0.8)), s0 = WINDS.earth.scale;
  const run = (sample, seconds = 40) => {
    const physics = createPhysics({ sampleSurface: (id, q) => sample(q), timeBudget: false });
    const p = V(d.x * (R + 1.5), d.y * (R + 1.5), d.z * (R + 1.5)); let worst = 0;
    for (let i = 0; i < seconds * 30; i++) { physics.update(1 / 30, { bodyId: 'earth', time: 300 + i / 30, focus: p }); worst = Math.max(worst, physics.stats.fetchSamples); }
    return { ws: physics.water('earth', p, {}), F: physics.fields.water.field, G: physics.fields.water.gauge, worst };
  };
  try {
    setWindScale('earth', 0.12);
    const lake = run(lakeWorld(d, 120, 3, R)), open = run(makeWorld({ R, biome: 'sea_coast', sea: R + 30 }));
    console.log(`# a gale: lake 120 m: fetch ${lake.ws.fetch.toFixed(0)} m, Hs ${lake.ws.significant.toFixed(2)} m, swell ${lake.F.open}; open sea: fetch ${open.ws.fetch.toFixed(0)} m, depth ${open.ws.depth.toFixed(0)} m, Hs ${open.ws.significant.toFixed(2)} m, swell ${open.F.open}; gauge samples a frame at most ${lake.worst} / ${open.worst}`);
    assert.ok(open.ws.fetch === 2500 && Math.abs(open.ws.depth - 30) < 1 && open.F.open === 1, `open sea: ${open.ws.fetch} m, ${open.ws.depth} m`);
    assert.ok(lake.ws.fetch > 100 && lake.ws.fetch < 140 && lake.F.open === 0, `lake: fetch ${lake.ws.fetch}`);
    assert.ok(open.ws.significant > 0.5 && lake.ws.significant < 0.3 * open.ws.significant, `lake ${lake.ws.significant} m against open sea ${open.ws.significant} m`);
    const most = QUALITY.samples[1] * QUALITY.burst;
    assert.ok(lake.worst <= most && open.worst <= most, 'the gauge keeps to its ration');
  } finally { setWindScale('earth', s0); }
});

test('P20 a floating explorer rides the drawn sea: its body follows the waves the shader draws, not the still level', async () => {
  // The body step floated on the world's still liquid level; the waves PAINTER draws (the twin: fields.water.heightAt)
  // passed through it. bindEnv now hands the step env.waterLevel, the drawn surface's height over the still level, and
  // its rate, which the body's drag in the water is measured against (the water moves with its surface).
  const { stepExplorerBody, EXPLORER_BODY } = await import('./explorer.js');
  const s0 = WINDS.earth.scale;
  try {
    setWindScale('earth', 0.3);
    const R = BODIES.earth.radius, sample = makeWorld({ R, biome: 'sea_coast', sea: R + 10 }), physics = createPhysics({ sampleSurface: (id, d) => sample(d), timeBudget: false });
    const d = norm(V(0.6, 0.04, 0.8)), env = physics.bindEnv('earth', { sample, gravity: BODIES.earth.gravity });
    const st = { p: V(d.x * (R + 10 - EXPLORER_BODY.floatDepth), d.y * (R + 10 - EXPLORER_BODY.floatDepth), d.z * (R + 10 - EXPLORER_BODY.floatDepth)), v: V(), grounded: false };
    const body = [], surf = [];
    for (let i = 0; i < 120 * 30; i++) {
      physics.update(1 / 30, { bodyId: 'earth', time: 100 + i / 30, focus: st.p });
      stepExplorerBody(st, {}, 1 / 30, env);
      if (i > 90 * 30) { body.push(len(st.p) - (R + 10)); surf.push(physics.fields.water.heightAt(st.p)); }
    }
    const n = body.length, mb = body.reduce((a, b) => a + b) / n, ms = surf.reduce((a, b) => a + b) / n;
    let sbb = 0, sss = 0, sbs = 0, dd = 0;
    for (let i = 0; i < n; i++) { const b = body[i] - mb, s = surf[i] - ms; sbb += b * b; sss += s * s; sbs += b * s; dd += (b - s) ** 2; }
    const corr = sbs / Math.sqrt(sbb * sss), sdS = Math.sqrt(sss / n), sdB = Math.sqrt(sbb / n), sdD = Math.sqrt(dd / n);
    console.log(`# floating in a gale (the drawn sea there: sd ${sdS.toFixed(3)} m): the body's height sd ${sdB.toFixed(3)} m, correlation ${corr.toFixed(3)}, off the surface sd ${sdD.toFixed(3)} m; feet ${(-mb + ms).toFixed(2)} m under the mean surface`);
    assert.ok(sdS > 0.08, 'a sea that is running: sd ' + sdS);
    assert.ok(corr > 0.9, 'the body rises and falls with the drawn waves: correlation ' + corr);
    // (a body near its own heave period, about 2.2 s, rides the short waves a little higher than they are: damped, not
    // stiff; the head floated at the still level: sd 0, correlation 0.04, 0.229 m off the surface)
    assert.ok(sdD < 0.5 * sdS, `the body keeps to the surface: ${sdD} m off it against waves of sd ${sdS}`);
    assert.ok(sdB > 0.7 * sdS && sdB < 1.5 * sdS, `it heaves as the sea does: sd ${sdB} against ${sdS}`);
    assert.ok(Math.abs(-mb + ms - EXPLORER_BODY.floatDepth) < 0.15, 'floats at the float depth under the moving surface: ' + (-mb + ms));
  } finally { setWindScale('earth', s0); }
});

test('P20 arriving at a coast in a gale, the sea is already running there: within 8 s, not over minutes', async () => {
  // The quick settling on arrival (WATER.arriveTime) ran out before the sea map's first build had measured the fetch: the sea
  // settled to the short upwind estimate's small sea and then grew over growTime (0.16 m at 8 s, 0.50 m at 40 s, 0.98 at 150 s).
  const { coastWorld } = await import('./testworld.mjs');
  const s0 = WINDS.earth.scale;
  try {
    setWindScale('earth', 0.3);
    const R = BODIES.earth.radius, C = norm(V(0.6, 0.04, 0.8));
    const world = coastWorld(C, (u, v) => (u < 0 ? 4 : -Math.min(20, 0.5 + 0.07 * u)), { R });
    const physics = createPhysics({ sampleSurface: (id, q) => world(q), timeBudget: false });
    const d = world.at(30, 0), p = V(d.x * R, d.y * R, d.z * R), hs = {};
    for (let i = 1; i <= 60 * 30; i++) {
      physics.update(1 / 30, { bodyId: 'earth', time: 300 + i / 30, focus: p });
      void physics.fields.water.uniforms.uPhysSeaMap;     // read as the game's water shader reads it
      if (i === 8 * 30 || i === 60 * 30) hs[i / 30] = physics.water('earth', p, {}).significant;
    }
    console.log(`# arriving 30 m off an open coast in a gale: Hs ${hs[8].toFixed(2)} m at 8 s, ${hs[60].toFixed(2)} m at 60 s`);
    assert.ok(hs[60] > 0.5, 'a gale\'s sea: ' + hs[60]);
    assert.ok(hs[8] > 0.8 * hs[60], `the sea is there on arrival: ${hs[8]} m at 8 s against ${hs[60]} m at 60 s`);
  } finally { setWindScale('earth', s0); }
});

test('P20 raindrop rings show on still water and not among the waves of a running sea', async () => {
  // (a storm sea at Neptune's coast was drawn under crisp rain rings, as a pond would be)
  const { coastWorld } = await import('./testworld.mjs');
  const { EVENT } = await import('./particles.js');
  const s0 = WINDS.earth.scale;
  try {
    for (const [scale, want] of [[0.3, 'none'], [20, 'rings']]) {
      setWindScale('earth', scale);
      const R = BODIES.earth.radius, C = norm(V(0.6, 0.04, 0.8));
      const world = coastWorld(C, (u, v) => (u < 0 ? 4 : -Math.min(20, 0.5 + 0.07 * u)), { R });
      const physics = createPhysics({ sampleSurface: (id, q) => world(q), timeBudget: false });
      const d = world.at(30, 0), p = V(d.x * R, d.y * R, d.z * R);
      for (let i = 1; i <= 20 * 30; i++) physics.update(1 / 30, { bodyId: 'earth', time: 300 + i / 30, focus: p });
      const S = physics.particles.system, hs = physics.water('earth', p, {}).significant, F = physics.fields.frame, E = S.events, t0 = E.total;
      for (let k = 0; k < 50; k++) S._event(F, 0, 0, 0, EVENT.ripple, 0.8, 0.003);
      const made = E.total - t0;
      console.log(`# rain rings 30 m off the coast, wind scale ${scale}: Hs ${hs.toFixed(2)} m, calm ${S.seaCalm01.toFixed(2)}, ${made} of 50 ripples kept`);
      if (want === 'none') assert.ok(hs > 0.5 && made === 0, `a running sea (Hs ${hs}) keeps no ring: ${made}`);
      else assert.ok(made === 50, `still water (Hs ${hs}) keeps its rings: ${made}`);
    }
  } finally { setWindScale('earth', s0); }
});

test('P21 the floating twin copies the water shader\'s lift in the last 0.4 m of the shallows (PAINTER 12)', async () => {
  // PAINTER 12 lays the drawn sheet higher where the still water is shallow (WATER_VERT, after the waves' mix:
  // p += up * 0.06 * (1 - smoothstep(0.05, 0.40, aDepth))): the bed's bumps showed through as a halftone of dots. A body
  // wading there stood 6 cm into the sheet until env.waterLevel added the same. In a dead calm the twin is that term alone.
  const { smoothstep } = await import('./util.js');
  const s0 = WINDS.earth.scale;
  try {
    setWindScale('earth', 0);
    const R = BODIES.earth.radius, sample = makeWorld({ R, biome: 'sea_coast', sea: R + 10 }), physics = createPhysics({ sampleSurface: (id, d) => sample(d), timeBudget: false });
    const d = norm(V(0.6, 0.04, 0.8)), p = V(d.x * (R + 9), d.y * (R + 9), d.z * (R + 9)), env = physics.bindEnv('earth', { sample, gravity: BODIES.earth.gravity });
    for (let i = 0; i < 60; i++) physics.update(1 / 30, { bodyId: 'earth', time: 50 + i / 30, focus: p });
    // (the calm's own small sea, its swell: under 0.078 m every depth from 0.1 m on takes the waves whole (the shader's shoal
    // mix is 1 from 1.28 Hs, at least 0.05 m), so the difference from 2 m of water is the lift alone)
    const hs = physics.water('earth', p, {}).significant;
    assert.ok(hs < 0.078, 'a calm: Hs ' + hs);
    for (const depth of [0.1, 0.2, 0.3, 0.4, 1]) {
      const want = 0.06 * (1 - smoothstep(0.05, 0.40, depth)), got = env.waterLevel(p, depth) - env.waterLevel(p, 2);
      assert.ok(Math.abs(got - want) < 0.002, `${depth} m of still water: the drawn sheet ${got.toFixed(4)} m over its level at 2 m deep, the shader's ${want.toFixed(4)}`);
    }
  } finally { setWindScale('earth', s0); }
});

test('P22 arriving, the sea is what the wind\'s history has raised: a squall that rose 30 s ago is met at the height of a sea that has grown for 30 s, not at the equilibrium of the wind now (and one who stood through it sees the same)', async () => {
  // Until P22 the arrival's quick settling (P20, Decision 51) settled to the equilibrium of the wind NOW, as if it had always
  // blown: at Neptune's stand an arriving player saw Hs 6.0 m 80 m out where one who stood through the squall saw 3.5 m.
  const W = await import('./water.js');
  assert.equal(typeof W.seaGrown, 'function', 'seaGrown: the sea a wind\'s history has raised');
  const F = 2500, D = 50, g = 9, rA = 1.2, rL = 999, U = (t) => (t < 600 ? 5 : 20), frame = { version: 1 };
  // (stood through: the field under the same wind from long before)
  const A = new WaterField(); A.expectMap = false;
  for (let t = 0; t < 630; t += 1 / 30) A.update(1 / 30, frame, U(t), 0, 0, D, F, g, rA, rL);
  // (arriving at 630 s with the history, and without it: the equilibrium of 20 m/s)
  const B = new WaterField(); B.expectMap = false; B.hist = W.seaGrown(U, 630, F, D, g, rA, rL, 0, {}); B.hist.ok = true;
  const C = new WaterField(); C.expectMap = false;
  for (let i = 0; i < 90; i++) { B.update(1 / 30, frame, 20, 0, 0, D, F, g, rA, rL); C.update(1 / 30, frame, 20, 0, 0, D, F, g, rA, rL); }
  const eq = windSea(20, F, g, rA, rL, D).height;
  assert.ok(Math.abs(B.height - A.height) < 0.1 * A.height, `the arrival's wind sea ${B.height.toFixed(2)} m, stood through ${A.height.toFixed(2)} m`);
  assert.ok(A.height < 0.85 * eq && C.height > 0.95 * eq, `30 s of a 20 m/s squall: ${A.height.toFixed(2)} m; its equilibrium ${eq.toFixed(2)} m (without the history the arrival shows ${C.height.toFixed(2)})`);
  assert.ok(Math.abs(B.swellHeight - A.swellHeight) < 0.1 * Math.max(0.05, A.swellHeight), `the swell: arriving ${B.swellHeight.toFixed(2)} m, stood through ${A.swellHeight.toFixed(2)} m`);
});
