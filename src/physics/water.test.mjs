// Tests: wind waves. Run: node --test src/physics/
import test from 'node:test';
import assert from 'node:assert/strict';
import { windSea, WaterField, WATER_GLSL, WATER, fetchOf, foamLevel, foamCover, surf01 } from './water.js';
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
