// Tests: the facade (COORDINATOR.md C14): shape, determinism, budget, robustness.
// Run: node --test src/physics/
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPhysics, stepExplorerBody, stepShipBody, FLORA_GLSL, QUALITY } from './index.js';
import { stubSurface, stubSpawn } from '../core/stubs/surface.js';
import { BODIES, BODY_IDS } from '../data/bodies.js';
import { makeWorld, V, norm, len } from './testworld.mjs';

const spawnPoint = (bodyId) => { const d = stubSpawn(bodyId).unitDir, s = stubSurface(bodyId, d); return V(d.x * s.radius, d.y * s.radius, d.z * s.radius); };
function walker(bodyId, speed = 4) {
  let p = spawnPoint(bodyId);
  const up0 = norm(p), e = norm(V(-up0.z, 0, up0.x));
  const v = V(e.x * speed, 0, e.z * speed);
  return { get p() { return p; }, v, step(dt) { p = V(p.x + v.x * dt, p.y, p.z + v.z * dt); const r = stubSurface(bodyId, p).radius, l = len(p); p = V(p.x * r / l, p.y * r / l, p.z * r / l); return p; } };
}
const allFinite = (o, path = '') => {
  for (const k in o) {
    const v = o[k];
    if (typeof v === 'number') assert.ok(!Number.isNaN(v), 'NaN at ' + path + k);
    else if (v && typeof v === 'object' && !ArrayBuffer.isView(v)) allFinite(v, path + k + '.');
  }
};

test('API surface of C14 is all there', () => {
  const physics = createPhysics({ sampleSurface: stubSurface });
  for (const k of ['update', 'setQuality', 'air', 'weather', 'ground', 'bindEnv']) assert.equal(typeof physics[k], 'function', k);
  assert.equal(typeof physics.explorer.step, 'function'); assert.equal(typeof physics.ship.step, 'function'); assert.equal(typeof physics.ship.gear, 'function');
  assert.equal(physics.explorer.step, stepExplorerBody); assert.equal(physics.ship.step, stepShipBody);
  const F = physics.fields.flora;
  assert.ok(F.bend instanceof Float32Array && F.bend.length === F.size * F.size * 4);
  assert.ok(F.wind instanceof Float32Array && F.wind.length === F.size * F.size * 4);
  assert.ok(F.push instanceof Float32Array && F.push.length === F.nearSize * F.nearSize * 4);
  assert.ok(physics.fields.deform.depth instanceof Float32Array && physics.fields.deform.marks.data instanceof Float32Array);
  for (const k of ['rain', 'snow', 'hail', 'dust', 'sand', 'ash', 'spores', 'leaves', 'spray']) {
    const b = physics.particles[k];
    assert.ok(b && b.pos instanceof Float32Array && b.vel instanceof Float32Array && b.size instanceof Float32Array && b.age instanceof Float32Array && typeof b.count === 'number' && b.origin, k);
    assert.equal(b.pos.length, b.capacity * 3);
  }
  assert.equal(physics.glsl.flora, FLORA_GLSL);
  assert.throws(() => createPhysics({}));
});

test('queries work before the first update, on every body, with sane values', () => {
  const physics = createPhysics({ sampleSurface: stubSurface });
  for (const id of BODY_IDS) {
    const p = spawnPoint(id), d = norm(p);
    const a = physics.air(id, p), w = physics.weather(id, p), g = physics.ground(id, d);
    allFinite(a, id + '.air.'); allFinite(g, id + '.ground.');
    assert.ok(a.density >= 0 && a.temperature > 20 && a.wind && typeof a.gust01 === 'number');
    assert.ok(typeof w.kind === 'string' && w.intensity01 >= 0 && w.intensity01 <= 1 && w.precipitation && w.lightning && w.visibility01 > 0 && w.wetness01 >= 0 && w.snowDepth >= 0);
    assert.ok(typeof g.material === 'string' && g.friction > 0 && g.restitution >= 0 && g.sink >= 0 && g.drag >= 0);
  }
  assert.equal(physics.air('moon', spawnPoint('moon')).density, 0);
  assert.ok(physics.air('venus', spawnPoint('venus')).density > 30);
});

test('a session on every body: nothing is NaN, fields fill in, here() tracks the focus', () => {
  for (const id of BODY_IDS) {
    const physics = createPhysics({ sampleSurface: stubSurface });
    const w = walker(id);
    for (let i = 0; i < 240; i++) physics.update(1 / 60, { bodyId: id, time: 700 + i / 60, focus: w.step(1 / 60), sunDir: V(0.3, 0.5, 0.81), disturbers: [{ kind: 'explorer', p: w.p, v: w.v, radius: 0.35, strength: 1, grounded: true }] });
    allFinite(physics.here, id + '.here.');
    assert.equal(physics.here.bodyId, id);
    const F = physics.fields.flora;
    for (const arr of [F.bend, F.wind, F.push, physics.fields.deform.depth]) for (let k = 0; k < arr.length; k += 7) assert.ok(Number.isFinite(arr[k]), id);
    const airless = !(physics.here.air.density > 0);
    let any = false; for (let k = 0; k < F.wind.length; k += 4) if (F.wind[k] !== 0 || F.wind[k + 1] !== 0) any = true;
    assert.equal(any, !airless, id + ': wind field ' + (airless ? 'must be empty' : 'must be filled'));
    assert.ok(physics.fields.near.invalid === 0, id + ': near ground cache filled');
    assert.ok(Math.abs(physics.here.groundHeight - (len(w.p) - BODIES[id].radius)) < 0.5, id + ': ground height under the focus');
    // the same queries through the facade agree with here
    const a = physics.air(id, w.p, {}, 2);
    assert.ok(Math.abs(a.speed - physics.here.air.speed) < 1e-6 + 0.5 * physics.here.air.speed);
  }
});

test('deterministic: two instances fed the same frames agree exactly', () => {
  const mk = () => { const physics = createPhysics({ sampleSurface: stubSurface, seed: 5, timeBudget: false }); const w = walker('earth'); for (let i = 0; i < 200; i++) physics.update(1 / 60, { bodyId: 'earth', time: 1000 + i / 60, focus: w.step(1 / 60), disturbers: [{ kind: 'explorer', p: w.p, v: w.v, radius: 0.35, strength: 1, grounded: true }] }); return physics; };
  const a = mk(), b = mk();
  assert.deepEqual(Array.from(a.fields.flora.bend), Array.from(b.fields.flora.bend));
  assert.deepEqual(Array.from(a.fields.flora.push), Array.from(b.fields.flora.push));
  assert.equal(JSON.stringify(a.here.weather), JSON.stringify(b.here.weather));
  assert.equal(JSON.stringify(a.here.air), JSON.stringify(b.here.air));
  const c = createPhysics({ sampleSurface: stubSurface, seed: 6 });
  c.update(1 / 60, { bodyId: 'earth', time: 1000, focus: spawnPoint('earth') });
  assert.notEqual(JSON.stringify(c.here.air.wind), JSON.stringify(a.here.air.wind));
});

test('budget: well under 2 ms per frame at quality 1 (walking, flying, raining)', () => {
  const measure = (id, speed, frames, t0) => {
    const physics = createPhysics({ sampleSurface: stubSurface });
    const w = walker(id, speed), ms = [];
    for (let i = 0; i < frames; i++) {
      const p = w.step(1 / 60);
      const t = performance.now();
      physics.update(1 / 60, { bodyId: id, time: t0 + i / 60, focus: p, sunDir: V(0.3, 0.5, 0.81), disturbers: [{ kind: 'explorer', p, v: w.v, radius: 0.35, strength: 1, grounded: true }, { kind: 'jet', p, v: w.v, radius: 0.15, strength: 1700 }] });
      if (i > 120) ms.push(performance.now() - t);
    }
    ms.sort((x, y) => x - y);
    return { mean: ms.reduce((x, y) => x + y) / ms.length, p95: ms[Math.floor(ms.length * 0.95)], max: ms[ms.length - 1], samples: physics.stats.samples, physics };
  };
  const walk = measure('earth', 4, 900, 700), fly = measure('earth', 46, 900, 700), fast = measure('neptune', 160, 600, 300);
  console.log(`# physics.update ms per frame (Node, stub surface): walk mean ${walk.mean.toFixed(3)} p95 ${walk.p95.toFixed(3)} | ship 46 m/s mean ${fly.mean.toFixed(3)} p95 ${fly.p95.toFixed(3)} | 160 m/s mean ${fast.mean.toFixed(3)} p95 ${fast.p95.toFixed(3)}`);
  for (const m of [walk, fly, fast]) { assert.ok(m.mean < 1.5, 'mean ' + m.mean); assert.ok(m.p95 < 2.0, 'p95 ' + m.p95); }
  assert.ok(walk.samples <= QUALITY.samples[1], 'sampleSurface calls per frame when walking: ' + walk.samples);
});

test('warmUp fills the ground caches and leaves the first played frame inside the budget', () => {
  const physics = createPhysics({ sampleSurface: stubSurface });
  const p = spawnPoint('earth');
  const ms = physics.warmUp({ bodyId: 'earth', time: 0, focus: p });
  assert.ok(ms < 400, 'warm-up took ' + ms + ' ms');
  assert.equal(physics.fields.near.invalid, 0); assert.equal(physics.fields.air.terrain.invalid, 0);
  const w = walker('earth'); let worst = 0;
  for (let i = 0; i < 300; i++) { const q = w.step(1 / 60); const t = performance.now(); physics.update(1 / 60, { bodyId: 'earth', time: i / 60, focus: q, disturbers: [{ kind: 'explorer', p: q, v: w.v, radius: 0.35, strength: 1, grounded: true }] }); worst = Math.max(worst, performance.now() - t); }
  console.log(`# worst frame in the first 5 s after warmUp: ${worst.toFixed(2)} ms`);
  assert.ok(worst < 6, 'worst frame after warm-up ' + worst);       // loose: other processes share this machine
});

test('sampleSurface is called sparingly: a bounded number per frame, bursts only after a jump', () => {
  let calls = 0;
  const physics = createPhysics({ sampleSurface: (id, d) => { calls++; return stubSurface(id, d); }, timeBudget: false });
  const w = walker('earth');
  let worst = 0, first = 0;
  for (let i = 0; i < 600; i++) { calls = 0; physics.update(1 / 60, { bodyId: 'earth', time: i / 60, focus: w.step(1 / 60) }); if (i === 0) first = calls; if (i > 150) worst = Math.max(worst, calls); }
  assert.ok(first <= QUALITY.samples[1] * QUALITY.burst, 'first frame ' + first);
  assert.ok(worst <= QUALITY.samples[1], 'steady state ' + worst);
  physics.setQuality(0); calls = 0; physics.update(1 / 60, { bodyId: 'earth', time: 11, focus: w.step(1 / 60) }); assert.ok(calls <= QUALITY.samples[0]);
});

test('re-anchoring the near field is seamless: the wind at the focus does not jump', () => {
  const physics = createPhysics({ sampleSurface: stubSurface });
  const w = walker('earth', 40);
  let prev = null, worst = 0, anchors = 0, lastVersion = -1, prevBend = null, worstBend = 0;
  for (let i = 0; i < 1500; i++) {
    const p = w.step(1 / 60);
    physics.update(1 / 60, { bodyId: 'earth', time: 500 + i / 60, focus: p });
    const v = physics.fields.frame.version; if (v !== lastVersion) { anchors++; lastVersion = v; }
    const a = physics.here.air.wind;
    if (prev && i > 200) worst = Math.max(worst, Math.hypot(a.x - prev.x, a.y - prev.y, a.z - prev.z));
    prev = { ...a };
  }
  assert.ok(anchors >= 3, 'the frame re-anchored ' + anchors + ' times in 1000 m');
  assert.ok(worst < 0.5, 'largest change of wind at the focus in one frame: ' + worst + ' m/s');
});

test('deep space, NaN focus, missing frame: the near field sleeps and nothing throws', () => {
  const physics = createPhysics({ sampleSurface: stubSurface });
  const p = spawnPoint('earth');
  physics.update(1 / 60, { bodyId: 'earth', time: 1, focus: p });
  for (const f of [{ bodyId: null, time: 2 }, { bodyId: 'nowhere', time: 3, focus: p }, { bodyId: 'earth', time: 4, focus: V(NaN, 0, 0) }, { bodyId: 'earth', time: 5, focus: V() }, undefined, { bodyId: 'earth', time: NaN, focus: p }]) {
    physics.update(1 / 60, f);
    assert.ok(physics.particles.rain.count >= 0);
  }
  physics.update(NaN, { bodyId: 'earth', time: 6, focus: p });
  physics.update(1e9, { bodyId: 'mars', time: 7, focus: spawnPoint('mars') });
  allFinite(physics.here);
  assert.equal(physics.here.bodyId, 'mars');
  // queries on a body that is not the active one still work
  allFinite(physics.air('earth', p)); allFinite(physics.ground('earth', norm(p)));
});

test('bindEnv gives the step functions their air, ground and liquid', () => {
  const sample = makeWorld({ R: 4000, biome: 'desert_canyon' });
  const physics = createPhysics({ sampleSurface: (id, d) => sample(d) });
  const p = V(0, 0, 4000);
  physics.update(1 / 60, { bodyId: 'earth', time: 100, focus: p });
  const env = physics.bindEnv('earth', { sample, gravity: 9 });
  assert.equal(typeof env.air, 'function'); assert.equal(typeof env.ground, 'function'); assert.ok(env.liquid.density > 900);
  const st = { p: { ...p }, v: V(), grounded: true };
  for (let i = 0; i < 300; i++) { physics.update(1 / 60, { bodyId: 'earth', time: 100 + i / 60, focus: st.p, disturbers: physics.explorer.disturbers(st, []) }); stepExplorerBody(st, { wish: V(7.4, 0, 0) }, 1 / 60, env); }
  assert.equal(st.phys.material, 'sand');
  assert.ok(len(st.v) < 6 && len(st.v) > 3, 'running on desert sand at ' + len(st.v));
  assert.ok(physics.fields.deform.marks.total > 3, 'and leaving prints');
  const d = physics.ship.disturbers({ p, v: V(), phys: { downwash: { thrust: 11000, radius: 2.4 } } }, []);
  assert.equal(d.length, 2); assert.equal(d[1].kind, 'downwash');
});

test('against PAINTER\'s real Earth, if it loads in Node: runs clean and inside the budget', async () => {
  let real;
  try { real = await import('../world/surface.js'); } catch (e) { console.log('# (skipped: src/world/surface.js did not load in Node: ' + e.message + ')'); return; }
  if (typeof real.sampleSurfacePure !== 'function' || typeof real.getSurface !== 'function') { console.log('# (skipped: sampleSurfacePure not exported)'); return; }
  const sampleSurface = (id, d) => real.sampleSurfacePure(id, d.x, d.y, d.z);
  const physics = createPhysics({ sampleSurface });
  const sp = real.getSurface('earth').getSpawn();
  let p; { const s = sampleSurface('earth', sp); p = V(sp.x * s.radius, sp.y * s.radius, sp.z * s.radius); }
  const up = norm(p), e = norm(V(-up.z, 0, up.x)), ms = [];
  for (let i = 0; i < 500; i++) {
    p = V(p.x + e.x * 4 / 60, p.y, p.z + e.z * 4 / 60); const r = sampleSurface('earth', p).radius, l = len(p); p = V(p.x * r / l, p.y * r / l, p.z * r / l);
    const t = performance.now();
    physics.update(1 / 60, { bodyId: 'earth', time: 60 + i / 60, focus: p, sunDir: V(0.3, 0.5, 0.81), disturbers: [{ kind: 'explorer', p, v: V(e.x * 4, 0, e.z * 4), radius: 0.35, strength: 1, grounded: true }] });
    if (i > 150) ms.push(performance.now() - t);
  }
  allFinite(physics.here);
  const mean = ms.reduce((x, y) => x + y) / ms.length;
  console.log(`# physics.update on PAINTER's Earth: mean ${mean.toFixed(3)} ms; home forest: ${physics.here.weather.kind}, wind ${physics.here.air.speed.toFixed(2)} m/s at 2 m, canopy ${physics.here.cover.canopy01.toFixed(2)}, ground ${physics.ground('earth', norm(p)).material}`);
  assert.ok(mean < 2.0, 'mean ' + mean);
  assert.ok(physics.here.cover.canopy01 > 0.3, 'the home forest has a canopy');
  assert.ok(['litter', 'mud', 'rock', 'bed'].includes(physics.ground('earth', norm(p)).material));
});
