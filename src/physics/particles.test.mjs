// Tests: rain and snow particles, footprints. Run: node --test src/physics/
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPhysics } from './index.js';
import { PARTICLES, EVENT } from './particles.js';
import { cellsAt, weatherAt, DEFAULT_SEED } from './weather.js';
import { MARK, MARK_STRIDE } from './deform.js';
import { BODIES } from '../data/bodies.js';
import { makeWorld, V, norm, len, dot } from './testworld.mjs';

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
  assert.ok(sj.fall > se.fall * 1.2, `Jupiter (thinner air, stronger gravity) ${sj.fall} vs Earth ${se.fall}`);
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
