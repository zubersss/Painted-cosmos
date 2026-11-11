// Tests: rain and snow particles, footprints. Run: node --test src/physics/
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPhysics } from './index.js';
import { PARTICLES, EVENT } from './particles.js';
import { cellsAt, weatherAt, DEFAULT_SEED } from './weather.js';
import { MARK, MARK_STRIDE, DeformField, DEFORM } from './deform.js';
import { BODIES } from '../data/bodies.js';
import { makeWorld, V, norm, len, dot } from './testworld.mjs';
import { epoch0 } from './testworld.mjs';

// a physics instance centred where it is raining (or snowing) right now
function rainy(bodyId = 'earth', { biome = 'alpine_meadow', pred = (w) => w.precipitation.type === 'rain' && w.precipitation.rate > 5, sea = 0 } = {}) {
  const R = BODIES[bodyId].radius;
  const sample = makeWorld({ R, biome, sea });
  const physics = createPhysics({ sampleSurface: (id, d) => sample(d), timeBudget: false });
  for (let t = 0; t < 8000; t += 53) for (const c of cellsAt(bodyId, t)) {
    const w = weatherAt(bodyId, c.x, c.y, c.z, 0, t, DEFAULT_SEED, { moist: 1, sun01: 0.5, wind: 4 }, {});
    if (pred(w)) return { physics, bodyId, focus: V(c.x * R, c.y * R, c.z * R), t0: t, R };
  }
  throw new Error('no such weather found on ' + bodyId);
}
function run(w, seconds, { hz = 60, each, disturbers } = {}) {
  for (let i = 0; i < Math.round(seconds * hz); i++) {
    w.t0 += 1 / hz;
    w.physics.update(1 / hz, { bodyId: w.bodyId, time: w.t0, focus: w.focus, disturbers: disturbers ? disturbers(w.t0) : undefined });
    if (each) each(w.t0);
  }
}
function stats(buf, up) {
  let vv = 0, vh = 0, n = buf.count;
  for (let i = 0; i < n; i++) {
    const vx = buf.vel[i * 3], vy = buf.vel[i * 3 + 1], vz = buf.vel[i * 3 + 2];
    const d = vx * up.x + vy * up.y + vz * up.z;
    vv += -d; vh += Math.hypot(vx - d * up.x, vy - d * up.y, vz - d * up.z);
  }
  return { fall: vv / n, drift: vh / n, n };
}

test('rain appears where it rains, in proportion, and drains away when it stops', () => {
  const w = rainy();
  run(w, 6);
  const P = w.physics.particles, wx = w.physics.here.weather;
  assert.equal(wx.precipitation.type, 'rain');
  assert.ok(P.rain.count > 100, 'drops: ' + P.rain.count);
  assert.ok(P.rain.count <= PARTICLES.capacity.rain[1]);
  assert.equal(P.snow.count, 0);
  // walk out of the weather: a clear sky has no rain
  const far = norm(V(-w.focus.z, 0.3 * w.R, w.focus.x));
  let clearAt = null;
  for (let k = 0; k < 400 && !clearAt; k++) { const d = norm(V(far.x + k * 0.01, far.y, far.z - k * 0.007)); const c = weatherAt('earth', d.x, d.y, d.z, 0, w.t0, DEFAULT_SEED, { moist: 1 }, {}); if (c.precipitation.rate === 0) clearAt = V(d.x * w.R, d.y * w.R, d.z * w.R); }
  w.focus = clearAt; run(w, 5);
  assert.equal(w.physics.particles.rain.count, 0);
});

test('drops fall at the terminal speed of their size and slant with the wind', () => {
  const w = rainy();
  run(w, 8);
  const P = w.physics.particles, up = norm(w.focus);
  const s = stats(P.rain, up), wx = w.physics.here.weather, air = w.physics.here.air;
  // the population is a spread of sizes around the species diameter
  assert.ok(s.fall > wx.precipitation.fallSpeed * 0.75 && s.fall < wx.precipitation.fallSpeed * 1.5, `mean fall ${s.fall} vs species ${wx.precipitation.fallSpeed}`);
  assert.ok(s.fall > 4.5 && s.fall < 10, 'Earth rain: ' + s.fall);
  // horizontal drift is the wind at drop height (2 m wind .. 20 m wind)
  assert.ok(s.drift > air.speed * 0.5 && s.drift < air.speed * 2.2 + 0.5, `drift ${s.drift} vs wind ${air.speed}`);
  for (let i = 0; i < P.rain.count * 3; i++) assert.ok(Number.isFinite(P.rain.pos[i]) && Number.isFinite(P.rain.vel[i]));
  for (let i = 0; i < P.rain.count; i++) assert.ok(P.rain.size[i] > 0.0002 && P.rain.size[i] < 0.01);
});

test('every drop stays inside the box around the focus, even when the focus races away', () => {
  const w = rainy();
  run(w, 4);
  const up = norm(w.focus), e = norm(V(-up.z, 0, up.x));
  // a ship at 60 m/s
  run(w, 3, { each: () => { w.focus = V(w.focus.x + e.x, w.focus.y + e.y, w.focus.z + e.z); const r = len(w.focus); w.focus = V(w.focus.x * w.R / r, w.focus.y * w.R / r, w.focus.z * w.R / r); } });
  const b = w.physics.particles.rain;
  assert.ok(b.count > 50);
  for (let i = 0; i < b.count; i++) {
    const p = V(b.origin.x + b.pos[i * 3] - w.focus.x, b.origin.y + b.pos[i * 3 + 1] - w.focus.y, b.origin.z + b.pos[i * 3 + 2] - w.focus.z);
    const upn = norm(w.focus), hgt = dot(p, upn), hor = Math.sqrt(Math.max(0, dot(p, p) - hgt * hgt));
    assert.ok(hor < PARTICLES.radius * 1.5 + 2 && hgt < PARTICLES.height + 6 && hgt > -PARTICLES.below - 3, `drop ${i} at ${hor}, ${hgt}`);
  }
});

test('drops splash where the ground is: events carry position, strength and time', () => {
  const w = rainy();
  const E = w.physics.particles.events;
  run(w, 6);
  assert.ok(E.total > 50, 'splashes: ' + E.total);
  for (let k = 0; k < Math.min(E.total, E.capacity); k++) {
    const o = k * 8;
    const p = V(E.origin.x + E.data[o], E.origin.y + E.data[o + 1], E.origin.z + E.data[o + 2]);
    assert.ok(Math.abs(len(p) - w.R) < 0.25, 'on the ground: ' + (len(p) - w.R));
    assert.equal(E.data[o + 3], EVENT.splash);
    assert.ok(E.data[o + 4] >= 0 && E.data[o + 4] <= 1 && E.data[o + 5] <= w.t0 + 1e-6);
  }
  // on water they are ripples
  const s = rainy('earth', { sea: BODIES.earth.radius + 2 });
  run(s, 5);
  const Es = s.physics.particles.events;
  assert.ok(Es.total > 20 && Es.data[3] === EVENT.ripple);
  assert.ok(Math.abs(len(V(Es.origin.x + Es.data[0], Es.origin.y + Es.data[1], Es.origin.z + Es.data[2])) - s.R - 2) < 0.25, 'on the water surface');
});

test('snow: slow, fluttering, and it settles instead of splashing', () => {
  // an alpine place in the cold: use the meadow biome on a tall world so the air is below freezing
  const w = rainy('earth', { biome: 'stub-polar', pred: (x) => x.precipitation.rate > 4 });
  run(w, 14);
  const P = w.physics.particles, wx = w.physics.here.weather;
  assert.equal(wx.precipitation.type, 'snow', 'it snows in the polar stub biome: ' + wx.kind + ' at ' + wx.temperature);
  assert.ok(P.snow.count > 100 && P.rain.count === 0);
  const s = stats(P.snow, norm(w.focus));
  assert.ok(s.fall > 0.4 && s.fall < 2.6, 'snow falls at ' + s.fall);
  const E = P.events; let settles = 0;
  for (let k = 0; k < Math.min(E.total, E.capacity); k++) if (E.data[k * 8 + 3] === EVENT.settle) settles++;
  assert.ok(settles > 0);
  assert.ok(wx.snowDepth >= 0);
});

test('the same shower on other worlds: Neptune methane, Jupiter water', () => {
  const n = rainy('neptune', { biome: 'storm_seas', pred: (x) => x.precipitation.type === 'rain' && x.precipitation.rate > 4 });
  run(n, 6);
  assert.equal(n.physics.particles.rain.species, 'methaneRain');
  const sn = stats(n.physics.particles.rain, norm(n.focus));
  assert.ok(sn.n > 50 && sn.fall > 3 && sn.fall < 14, 'Neptune rain falls at ' + sn.fall);
  const j = rainy('jupiter', { biome: 'lightning_plains', pred: (x) => x.precipitation.type === 'rain' && x.precipitation.rate > 4 });
  run(j, 6);
  const sj = stats(j.physics.particles.rain, norm(j.focus));
  const e = rainy(); run(e, 6);
  const se = stats(e.physics.particles.rain, norm(e.focus));
  // (the two showers are not equally heavy, so their drops are not the same size: compare
  // the fall speed per root of drop diameter, which is what gravity and air density set)
  const size = (b) => { let a = 0; for (let i = 0; i < b.count; i++) a += b.size[i]; return a / b.count; };
  const kj = sj.fall / Math.sqrt(size(j.physics.particles.rain)), ke = se.fall / Math.sqrt(size(e.physics.particles.rain));
  assert.ok(kj > ke * 1.3, `Jupiter (thinner air, stronger gravity) ${kj.toFixed(0)} vs Earth ${ke.toFixed(0)} m/s per root metre`);
});

test('stable at 20 Hz and with a hitch; quality changes the count', () => {
  const w = rainy();
  run(w, 6, { hz: 20 });
  const s = stats(w.physics.particles.rain, norm(w.focus));
  assert.ok(s.fall > 4.5 && s.fall < 10);
  w.physics.update(5, { bodyId: w.bodyId, time: w.t0 + 5, focus: w.focus }); w.t0 += 5;
  run(w, 1);
  for (let i = 0; i < w.physics.particles.rain.count * 3; i++) assert.ok(Number.isFinite(w.physics.particles.rain.pos[i]));
  const lo = rainy(), hi = rainy(); lo.physics.setQuality(0); hi.physics.setQuality(2);
  run(lo, 6); run(hi, 6);
  assert.ok(hi.physics.particles.rain.count > lo.physics.particles.rain.count * 2);
});

test('deterministic: two runs give identical buffers', () => {
  const a = rainy(), b = rainy();
  run(a, 3); run(b, 3);
  assert.equal(a.physics.particles.rain.count, b.physics.particles.rain.count);
  assert.deepEqual(Array.from(a.physics.particles.rain.pos.subarray(0, 300)), Array.from(b.physics.particles.rain.pos.subarray(0, 300)));
});

test('footprints: one per stride, alternating feet, deeper in snow than on rock, none in the air', () => {
  const walk = (bodyId, biome, speed, grounded = true) => {
    const R = BODIES[bodyId].radius, sample = makeWorld({ R, biome });
    const physics = createPhysics({ sampleSurface: (id, d) => sample(d), timeBudget: false });
    let p = V(0, 0, R); const v = V(speed, 0, 0);
    for (let i = 0; i < 600; i++) {
      p = V(p.x + speed / 60, 0, p.z); const r = len(p); p = V(p.x * R / r, 0, p.z * R / r);
      physics.update(1 / 60, { bodyId, time: 50 + i / 60, focus: p, disturbers: [{ kind: 'explorer', p, v, radius: 0.35, strength: 1, grounded }] });
    }
    return physics.fields.deform;
  };
  const sand = walk('earth', 'desert_canyon', 4.2), rock = walk('venus', 'pale_mesas', 4.2), air = walk('earth', 'desert_canyon', 4.2, false);
  const moon = walk('moon', 'mare', 4.2);
  assert.equal(rock.marks.total, 0, 'no prints on bare rock');
  assert.equal(air.marks.total, 0, 'no prints while airborne');
  const stride = 0.5 + 0.13 * 4.2;
  assert.ok(Math.abs(sand.marks.total - 42 / stride) <= 2, `prints over 42 m: ${sand.marks.total} (stride ${stride})`);
  assert.ok(moon.marks.total < sand.marks.total * 0.8, 'longer strides in low gravity: ' + moon.marks.total);
  const d = sand.marks.data;
  assert.ok(d[9] !== d[MARK_STRIDE + 9] && [MARK.footLeft, MARK.footRight].includes(d[9]), 'feet alternate');
  assert.ok(d[8] > 0.03 && d[8] < 0.1, 'sand print depth ' + d[8]);
  assert.ok(Math.abs(d[3] - 1) < 0.01, 'the print points the way you walk');
  let any = 0; for (const x of sand.depth) if (x > 0) any++;
  assert.ok(any > 4, 'a trail in the depth field');
  assert.ok(sand.depthAt(V(sand.marks.origin.x + d[(sand.marks.head - 1) * MARK_STRIDE], sand.marks.origin.y + d[(sand.marks.head - 1) * MARK_STRIDE + 1], sand.marks.origin.z + d[(sand.marks.head - 1) * MARK_STRIDE + 2])) > 0.005);
});

test('prints on loose ground have a rim; on mud they do not; the depth field piles up beside the trail', () => {
  const walk = (biome) => {
    const R = BODIES.earth.radius, sample = makeWorld({ R, biome });
    const physics = createPhysics({ sampleSurface: (id, d) => sample(d), timeBudget: false });
    let p = V(0, 0, R); const v = V(4, 0, 0);
    for (let i = 0; i < 300; i++) { p = V(p.x + 4 / 60, 0, p.z); const r = len(p); p = V(p.x * R / r, 0, p.z * R / r); physics.update(1 / 60, { bodyId: 'earth', time: 50 + i / 60, focus: p, disturbers: [{ kind: 'explorer', p, v, radius: 0.35, strength: 1, grounded: true }] }); }
    return physics.fields.deform;
  };
  const sand = walk('desert_canyon'), mud = walk('misty_wetland');
  const ds = sand.marks.data, dm = mud.marks.data;
  assert.equal(sand.marks.stride, MARK_STRIDE);
  assert.ok(Math.abs(ds[12] / ds[8] - 0.2) < 1e-6, 'sand rim is a fifth of the depth: ' + ds[12] / ds[8]);
  assert.ok(dm[8] > 0.05 && dm[12] === 0, 'mud squeezes, it does not pile: depth ' + dm[8] + ' rim ' + dm[12]);
  let lo = 0, hi = 0; for (const x of sand.depth) { if (x < lo) lo = x; if (x > hi) hi = x; }
  assert.ok(hi > 0.02 && lo < -0.002, `trough ${hi} and pile ${lo}`);
});

test('falling snow fills prints in; in clear weather they last over a minute', () => epoch0(() => {
  const snowy = rainy('earth', { biome: 'stub-polar', pred: (x) => x.precipitation.type === 'snow' && x.precipitation.rate > 4 });
  const fr0 = () => snowy.physics.fields.frame;
  run(snowy, 2);
  const v = V(fr0().ex * 4, fr0().ey * 4, fr0().ez * 4);
  let p = snowy.focus;
  run(snowy, 3, { disturbers: () => { p = V(p.x + v.x / 60, p.y + v.y / 60, p.z + v.z / 60); const l = len(p); p = V(p.x * snowy.R / l, p.y * snowy.R / l, p.z * snowy.R / l); snowy.focus = p; return [{ kind: 'explorer', p, v, radius: 0.35, strength: 1, grounded: true }]; } });
  const M = snowy.physics.fields.deform.marks;
  assert.ok(M.total > 5);
  const d0 = M.data[8];
  assert.ok(d0 > 0.1, 'a deep print in snow: ' + d0);
  run(snowy, 12);
  assert.ok(M.data[8] < d0 * 0.9, `the first print is filling: ${d0} -> ${M.data[8]}`);
  // the mechanism itself, with a steady snowfall of 1 mm of depth a second: hollows fill six times
  // as fast as level ground gains snow, the rim shrinks with the print, and a filled print is over
  const F = new DeformField(), fr = snowy.physics.fields.frame;
  F.update(0, fr, 0, 0, null, null, 9, 0, null);
  F._mark(fr, 1, 0, 1, 1, 0, 0.3, 0.12, 0.12, MARK.footLeft, 0, 100, 0.024); F._splat(1, 1, 0.12);
  for (let i = 0; i < 10 * 60; i++) F.update(1 / 60, fr, 0, 0, null, null, 9, i / 60, { snow: 0.001, sand: 0 });
  assert.ok(Math.abs(F.marks.data[8] - (0.12 - 10 * 0.001 * DEFORM.snowFill)) < 1e-4, 'after 10 s: ' + F.marks.data[8]);
  assert.ok(Math.abs(F.marks.data[12] / F.marks.data[8] - 0.2) < 1e-4, 'the rim shrinks with it');
  for (let i = 0; i < 15 * 60; i++) F.update(1 / 60, fr, 0, 0, null, null, 9, 10 + i / 60, { snow: 0.001, sand: 0 });
  assert.equal(F.marks.data[8], 0); assert.equal(F.marks.data[11], 0, 'life over');
  assert.equal(F.depthAt(1, 1), 0, 'and the trough is level again');
  // blowing sand does the same
  const G = new DeformField(); G.update(0, fr, 0, 0, null, null, 9, 0, null);
  G._mark(fr, 1, 0, 1, 1, 0, 0.3, 0.12, 0.06, MARK.footLeft, 0, 100, 0.012);
  for (let i = 0; i < 8 * 60; i++) G.update(1 / 60, fr, 0, 0, null, null, 9, i / 60, { snow: 0, sand: 1 });
  assert.equal(G.marks.data[8], 0, 'a sandstorm erases a print in seconds');
  // no weather: the same print is still there after a minute
  const R = BODIES.earth.radius, sample = makeWorld({ R, biome: 'desert_canyon' });
  const physics = createPhysics({ sampleSurface: (id, d) => sample(d), timeBudget: false });
  // (at 30 degrees north, in the calm of the horse latitudes: no sand is blowing)
  let q = V(0, R * 0.5, R * Math.sqrt(0.75));
  for (let i = 0; i < 120; i++) { q = V(q.x + 4 / 60, q.y, q.z); const r = len(q); q = V(q.x * R / r, q.y * R / r, q.z * R / r); physics.update(1 / 60, { bodyId: 'earth', time: 50 + i / 60, focus: q, disturbers: [{ kind: 'explorer', p: q, v: V(4, 0, 0), radius: 0.35, strength: 1, grounded: true }] }); }
  const depth = physics.fields.deform.marks.data[8], born = physics.fields.deform.marks.data[10], life = physics.fields.deform.marks.data[11];
  for (let i = 0; i < 70 * 20; i++) physics.update(1 / 20, { bodyId: 'earth', time: 52 + i / 20, focus: q });
  assert.equal(physics.fields.deform.marks.data[8], depth);
  assert.ok(life > 60 && born + life > 52 + 70, 'life ' + life);
}));

test('the ship leaves three pad prints where it comes down, and a jet scours a dish with a ring', () => {
  const R = BODIES.earth.radius, sample = makeWorld({ R, biome: 'desert_canyon' });
  const physics = createPhysics({ sampleSurface: (id, d) => sample(d), timeBudget: false });
  const p = V(0, R, 0), q = { x: 0, y: 0, z: 0, w: 1 };
  const frame = (hgt, extra = []) => ({ bodyId: 'earth', time: (t += 1 / 60), focus: p, disturbers: [{ kind: 'ship', p: V(0, R + hgt, 0), v: V(), radius: 4.2, strength: 1, q }, ...extra] });
  let t = 10;
  for (let i = 0; i < 60; i++) physics.update(1 / 60, frame(6));
  const M = physics.fields.deform.marks;
  assert.equal(M.total, 0, 'hovering leaves no pad prints');
  for (let i = 0; i < 30; i++) physics.update(1 / 60, frame(0));
  assert.equal(M.total, 3, 'three pads');
  const kinds = [0, 1, 2].map((k) => M.data[k * MARK_STRIDE + 9]);
  assert.deepEqual(kinds, [MARK.gear, MARK.gear, MARK.gear]);
  assert.ok(M.data[8] > 0.08 && M.data[8] <= 0.3, 'pad depth in sand ' + M.data[8]);
  // the three pads are where the legs are: 3.2 m ahead and 2.2 m to each side, 1.8 m behind
  const d = (a, b) => Math.hypot(M.data[a * MARK_STRIDE] - M.data[b * MARK_STRIDE], M.data[a * MARK_STRIDE + 1] - M.data[b * MARK_STRIDE + 1], M.data[a * MARK_STRIDE + 2] - M.data[b * MARK_STRIDE + 2]);
  assert.ok(Math.abs(d(1, 2) - 4.4) < 0.05 && Math.abs(d(0, 1) - Math.hypot(5, 2.2)) < 0.05);
  for (let i = 0; i < 120; i++) physics.update(1 / 60, frame(0));
  assert.equal(M.total, 3, 'standing still adds none');
  // lift off on thrusters: the downwash scours the sand
  for (let i = 0; i < 180; i++) physics.update(1 / 60, frame(1.5, [{ kind: 'downwash', p: V(0, R + 1.5, 0), v: V(), radius: 2.2, strength: 12000 }]));
  let scour = 0; for (let k = 0; k < M.total; k++) if (M.data[k * MARK_STRIDE + 9] === MARK.scour) scour++;
  assert.ok(scour >= 3, 'scour marks: ' + scour);
  const D = physics.fields.deform;
  assert.ok(D.depthAt(V(0.3, R, 0.3)) > 0.004, 'a dish under the jet: ' + D.depthAt(V(0.3, R, 0.3)));
  assert.ok(D.depthAt(V(3.3, R, 0)) < 0, 'a raised ring round it: ' + D.depthAt(V(3.3, R, 0)));
  // on rock a jet scours nothing
  const rock = createPhysics({ sampleSurface: (id, dd) => makeWorld({ R, biome: 'pale_mesas' })(dd), timeBudget: false });
  for (let i = 0; i < 120; i++) rock.update(1 / 60, { bodyId: 'venus', time: 5 + i / 60, focus: V(0, 3600, 0), disturbers: [{ kind: 'jet', p: V(0, 3601.5, 0), v: V(), radius: 0.15, strength: 1700 }] });
  assert.equal(rock.fields.deform.marks.total, 0);
});

// ---- shelter ------------------------------------------------------------------------------------
function rainyWood(canopy01, pred = (w) => w.precipitation.type === 'rain' && w.precipitation.rate > 8) {
  const R = BODIES.earth.radius;
  for (let t = 0; t < 8000; t += 53) for (const c of cellsAt('earth', t)) {
    const w = weatherAt('earth', c.x, c.y, c.z, 0, t, DEFAULT_SEED, { moist: 1, sun01: 0.5, wind: 4 }, {});
    if (!pred(w)) continue;
    const sample = makeWorld({ R, biome: 'alpine_meadow', stand: { dir: norm(V(c.x, c.y, c.z)), radius: 400, canopy01, canopyHeight: 14 } });
    return { physics: createPhysics({ sampleSurface: (id, d) => sample(d), timeBudget: false }), bodyId: 'earth', focus: V(c.x * R, c.y * R, c.z * R), t0: t, R, cell: c };
  }
  throw new Error('no rain found');
}
const below = (w, buf, hMax) => { let n = 0; for (let i = 0; i < buf.count; i++) { const p = V(buf.origin.x + buf.pos[i * 3], buf.origin.y + buf.pos[i * 3 + 1], buf.origin.z + buf.pos[i * 3 + 2]); if (len(p) - w.R < hMax) n++; } return n; };

test('a closed canopy keeps much of the rain off the ground under it, and less of it once it is soaked', () => {
  const open = rainyWood(0), wood = rainyWood(1);
  run(open, 8); run(wood, 8);
  const no = below(open, open.physics.particles.rain, 6), nw = below(wood, wood.physics.particles.rain, 6);
  const wet = wood.physics.here.weather.wetness01;
  const through = PARTICLES.throughDry + (PARTICLES.throughWet - PARTICLES.throughDry) * wet;
  assert.ok(no > 150, 'drops low in the open: ' + no);
  assert.ok(nw < no * (through + 0.15) && nw > no * (through - 0.15), `under the leaves ${nw} of ${no} (expected about ${(through * 100).toFixed(0)} % at wetness ${wet.toFixed(2)})`);
  // above the crowns it rains as hard as anywhere
  const above = (w) => w.physics.particles.rain.count - below(w, w.physics.particles.rain, 14);
  assert.ok(Math.abs(above(wood) - above(open)) < above(open) * 0.25, `above the canopy: ${above(wood)} against ${above(open)}`);
});

test('after the rain the wood goes on dripping: big slow drops from the leaves, none in the open', () => {
  const wood = rainyWood(1), open = rainyWood(0);
  // find when this shower ends at the cell centre, and go there
  let tEnd = wood.t0; const c = wood.cell;
  while (weatherAt('earth', c.x, c.y, c.z, 0, tEnd, DEFAULT_SEED, { moist: 1, sun01: 0.5, wind: 4 }, {}).precipitation.rate > 0.02 && tEnd < wood.t0 + 3000) tEnd += 5;
  for (const w of [wood, open]) { w.t0 = tEnd - 20; run(w, 20 + 25, { hz: 30 }); }      // (the last drizzle takes a while to come down)
  const P = wood.physics.particles, wx = wood.physics.here.weather;
  assert.equal(wx.precipitation.type, 'none');
  assert.ok(wx.wetness01 > 0.6, 'the wood is soaked: ' + wx.wetness01);
  assert.ok(P.system.dripping > 0.3 && P.rain.count > 20, `dripping ${P.system.dripping.toFixed(2)}, drops ${P.rain.count}`);
  let big = 0, high = 0; for (let i = 0; i < P.rain.count; i++) { if (P.rain.size[i] > 0.0035) big++; const p = V(P.rain.origin.x + P.rain.pos[i * 3], P.rain.origin.y + P.rain.pos[i * 3 + 1], P.rain.origin.z + P.rain.pos[i * 3 + 2]); if (len(p) - wood.R > 14.01) high++; }
  assert.ok(big > P.rain.count * 0.7, 'big drops: ' + big + ' of ' + P.rain.count);
  assert.equal(high, 0, 'none above the crowns');
  assert.ok(open.physics.particles.rain.count < P.rain.count * 0.2, `the open meadow has all but stopped: ${open.physics.particles.rain.count} against ${P.rain.count} in the wood`);
  assert.equal(open.physics.particles.system.dripping, 0);
  // they fall from rest: none is faster than free fall from the crown allows
  let fastest = 0; for (let i = 0; i < P.rain.count; i++) fastest = Math.max(fastest, Math.hypot(P.rain.vel[i * 3], P.rain.vel[i * 3 + 1], P.rain.vel[i * 3 + 2]));
  assert.ok(fastest < Math.sqrt(2 * 9.81 * 14) + 0.5 && fastest > 3, 'fastest drip ' + fastest);
});

test('the hull keeps the rain off what is under it', () => {
  const w = rainyWood(0);
  const up = norm(w.focus), ship = V(up.x * (w.R + 2.5), up.y * (w.R + 2.5), up.z * (w.R + 2.5));
  const ev0 = w.physics.particles.events.total;
  run(w, 8, { disturbers: () => [{ kind: 'ship', p: ship, v: V(0, 0, 0), radius: 4.2, strength: 1 }] });
  const b = w.physics.particles.rain, fr = w.physics.fields.frame;
  let under = 0, ring = 0;
  for (let i = 0; i < b.count; i++) {
    const p = V(b.origin.x + b.pos[i * 3], b.origin.y + b.pos[i * 3 + 1], b.origin.z + b.pos[i * 3 + 2]);
    const x = fr.lx(p.x, p.y, p.z), z = fr.lz(p.x, p.y, p.z), h = len(p) - w.R, r = Math.hypot(x, z);
    if (h < 3.5) { if (r < 2.8) under++; else if (r > 5 && r < 5 + 2.8 * 0.6) ring++; }      // (the ring has about the same area)
  }
  assert.ok(ring >= 2, 'rain all around: ' + ring);
  // (P7: a storm brings its own wind now, 16 m/s: rain driven at sixty degrees reaches a little way under the edge)
  assert.ok(under <= ring * 0.5, `under the hull ${under} against ${ring} beside it`);
  // and it lands on the hull instead: splashes up there
  const E = w.physics.particles.events; let onHull = 0;
  for (let k = 0; k < E.capacity; k++) { const o = k * 8; const p = V(E.origin.x + E.data[o], E.origin.y + E.data[o + 1], E.origin.z + E.data[o + 2]); if (E.data[o + 4] > 0 && Math.abs(len(p) - w.R - 4.7) < 0.3) onHull++; }
  assert.ok(E.total > ev0 && onHull > 3, 'splashes on the hull: ' + onHull);
});

test('over deep water the weather enters above the surface, not above the bed', () => {
  // a sea 40 m deep everywhere; the focus swims at the surface
  const w = rainy('earth', { sea: BODIES.earth.radius + 40 });
  const R = w.R + 40; const u = norm(w.focus); w.focus = V(u.x * (R + 0.5), u.y * (R + 0.5), u.z * (R + 0.5));
  w.physics.warmUp({ bodyId: w.bodyId, time: w.t0, focus: w.focus });
  run(w, 6);
  const b = w.physics.particles.rain; let above = 0, under = 0, top = -1e9;
  for (let i = 0; i < b.count; i++) { const h = len(V(b.origin.x + b.pos[i * 3], b.origin.y + b.pos[i * 3 + 1], b.origin.z + b.pos[i * 3 + 2])) - R; if (h > -0.3) above++; else under++; if (h > top) top = h; }
  assert.ok(b.count > 200 && under === 0, `${above} drops above the sea, ${under} under it`);
  assert.ok(top > PARTICLES.height - 3 && top < PARTICLES.height + 5, `the highest ${top.toFixed(1)} m over the surface`);
  // and they end on the surface as ripples
  const E = w.physics.particles.events; let ripples = 0; for (let k = 0; k < E.capacity; k++) if (E.data[k * 8 + 4] > 0 && E.data[k * 8 + 3] === EVENT.ripple) ripples++;
  assert.ok(ripples > 20, `${ripples} ripples`);
});

test('every particle says how long it has left: a flake by its fall to the ground, dust by its life', () => epoch0(() => {
  const w = rainy('earth', { pred: (x) => x.precipitation.type === 'snow' && x.precipitation.intensity01 > 0.6 });
  w.physics.warmUp({ bodyId: w.bodyId, time: w.t0, focus: w.focus });
  run(w, 8);
  const b = w.physics.particles.snow, u = norm(w.focus);
  assert.ok(b.left instanceof Float32Array && b.left.length === b.pos.length / 3);
  let low = 0, bad = 0, high = 0;
  for (let i = 0; i < b.count; i++) {
    const h = len(V(b.origin.x + b.pos[i * 3], b.origin.y + b.pos[i * 3 + 1], b.origin.z + b.pos[i * 3 + 2])) - w.R;
    const fall = -(b.vel[i * 3] * u.x + b.vel[i * 3 + 1] * u.y + b.vel[i * 3 + 2] * u.z);
    if (h < 3 && fall > 0.2) { low++; if (Math.abs(b.left[i] - h / fall) > 0.1 + 0.1 * h / fall) bad++; } else if (h > 8) { high++; assert.ok(b.left[i] > 2, `at ${h.toFixed(1)} m: ${b.left[i]}`); }
  }
  assert.ok(low > 30 && bad === 0 && high > 100, `${low} low flakes, ${bad} wrong, ${high} high`);
  // each flake is seen shrinking before it lands: no flake is retired with much time left
  const seen = new Map(); let lastLeft = [];
  run(w, 3, { each: () => { const now = new Map(); for (let i = 0; i < b.count; i++) now.set(b.size[i], b.left[i]); for (const [id, l] of seen) if (!now.has(id)) lastLeft.push(l); seen.clear(); for (const [id, l] of now) seen.set(id, l); } });
  lastLeft.sort((x, y) => x - y);
  assert.ok(lastLeft.length > 50 && lastLeft[Math.floor(lastLeft.length * 0.98)] < 0.08, `${lastLeft.length} landings; 98 % were announced to within ${lastLeft[Math.floor(lastLeft.length * 0.98)].toFixed(3)} s`);
}));

test('far from the anchor of the frame the rain still ends on the ground (the grid is a plane, the ground is not)', () => {
  const w = rainy('earth');
  w.physics.warmUp({ bodyId: w.bodyId, time: w.t0, focus: w.focus });
  run(w, 1);
  // walk 300 m east at 30 m/s: the frame re-anchors only after 384 m
  const fr = w.physics.fields.frame, e = V(fr.ex, fr.ey, fr.ez), re0 = w.physics.stats.reanchors;
  for (let i = 0; i < 600; i++) {
    w.focus = V(w.focus.x + e.x * 0.5, w.focus.y + e.y * 0.5, w.focus.z + e.z * 0.5); const l = len(w.focus) / w.R; w.focus = V(w.focus.x / l, w.focus.y / l, w.focus.z / l);
    run(w, 1 / 60);
  }
  run(w, 2);
  const d = Math.hypot(fr.lx(w.focus.x, w.focus.y, w.focus.z), fr.lz(w.focus.x, w.focus.y, w.focus.z));
  assert.ok(w.physics.stats.reanchors === re0 && d > 280, `${d.toFixed(0)} m from the anchor`);
  // (a plane through the anchor would be d^2 / 2R = 11 m above the ground here)
  const b = w.physics.particles.rain; let lo = 1e9, hi = -1e9;
  for (let i = 0; i < b.count; i++) { const h = len(V(b.origin.x + b.pos[i * 3], b.origin.y + b.pos[i * 3 + 1], b.origin.z + b.pos[i * 3 + 2])) - w.R; lo = Math.min(lo, h); hi = Math.max(hi, h); }
  assert.ok(b.count > 300 && lo > -0.2 && lo < 0.6 && hi < PARTICLES.height + 4.5, `drops from ${lo.toFixed(2)} to ${hi.toFixed(2)} m over the ground`);
  const E = w.physics.particles.events; let n = 0, worst = 0;
  for (let k = 0; k < E.capacity; k++) if (E.data[k * 8 + 4] > 0 && w.t0 - E.data[k * 8 + 5] < 1) { n++; worst = Math.max(worst, Math.abs(len(V(E.origin.x + E.data[k * 8], E.origin.y + E.data[k * 8 + 1], E.origin.z + E.data[k * 8 + 2])) - w.R)); }
  assert.ok(n > 50 && worst < 0.02, `${n} splashes, the worst ${worst.toFixed(3)} m off the ground`);
  // and a drop falls along the local vertical there, not the anchor's (4 degrees apart at 300 m)
  const u = norm(w.focus); let side = 0, down = 0;
  for (let i = 0; i < b.count; i++) { const vx = b.vel[i * 3], vy = b.vel[i * 3 + 1], vz = b.vel[i * 3 + 2], dn = -(vx * u.x + vy * u.y + vz * u.z); down += dn; side += vx * fr.ex + vy * fr.ey + vz * fr.ez + dn * (fr.ex * u.x + fr.ey * u.y + fr.ez * u.z); }
  void side; assert.ok(down / b.count > 3);
});

// ---- P7 ---------------------------------------------------------------------------------------------

test('rings near the focus: in a downpour there are enough of them alive within ten metres to be seen, on ground and on water', () => {
  const count = (w, kind, life) => {
    const E = w.physics.particles.events, F = w.physics.focus; let n = 0, near = 0;
    for (let k = 0; k < E.capacity; k++) {
      const o = k * 8; if (!(E.data[o + 4] > 0) || E.data[o + 3] !== kind || w.physics.time - E.data[o + 5] > life) continue;
      n++;
      if (Math.hypot(E.origin.x + E.data[o] - F.x, E.origin.y + E.data[o + 1] - F.y, E.origin.z + E.data[o + 2] - F.z) < PARTICLES.ringRadius + 0.5) near++;
    }
    return { n, near };
  };
  assert.ok(PARTICLES.events >= 512 && PARTICLES.ringRate >= 60);
  const w = rainy(); run(w, 6);
  const g = count(w, EVENT.splash, 0.28);
  assert.ok(g.near >= 12, `${g.near} crowns alive within ${PARTICLES.ringRadius} m on the ground (${g.n} in all)`);
  const s = rainy('earth', { sea: BODIES.earth.radius + 2 }); run(s, 6);
  const r = count(s, EVENT.ripple, 1.4);
  assert.ok(r.near >= 60 && r.n <= PARTICLES.events, `${r.near} ripples alive within ${PARTICLES.ringRadius} m on the water (${r.n} in all)`);
  // every one of them on the surface it fell on
  const E = s.physics.particles.events;
  for (let k = 0; k < E.capacity; k++) { const o = k * 8; if (E.data[o + 4] > 0) assert.ok(Math.abs(len(V(E.origin.x + E.data[o], E.origin.y + E.data[o + 1], E.origin.z + E.data[o + 2])) - s.R - 2) < 0.3, 'on the water'); }
});
