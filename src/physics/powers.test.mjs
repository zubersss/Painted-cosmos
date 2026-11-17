// Tests: the wind the explorer makes (powers.js) and what answers it. Run: node --test src/physics/
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPhysics } from './index.js';
import { makeWinds, castGust, castZone, castOrb, castVortex, moveWind, releaseWind, stepWinds, placeWinds, powerWind, windsToDevils, WINDPOWER, KIND } from './powers.js';
import { LocalFrame } from './near.js';
import { BODIES } from '../data/bodies.js';
import { makeWorld, V, norm } from './testworld.mjs';

const HERE = V(0.31, 0.56, 0.77);
function setup(bodyId, biome, { sea = 0, seed = 14 } = {}) {
  const R = BODIES[bodyId].radius;
  const sample = makeWorld({ R, biome, sea: sea ? R + sea : 0 });
  const physics = createPhysics({ sampleSurface: (id, d) => sample(d), seed, timeBudget: false });
  const d = norm(HERE);
  return { physics, bodyId, R, focus: V(d.x * R, d.y * R, d.z * R), t: 300, up: d };
}
function run(w, seconds, winds, each) {
  const hz = 60;
  for (let i = 0; i < Math.round(seconds * hz); i++) {
    w.t += 1 / hz;
    if (winds) stepWinds(winds, 1 / hz);
    w.physics.update(1 / hz, { bodyId: w.bodyId, time: w.t, focus: w.focus, sunDir: w.up, winds: winds || undefined });
    if (each) each(w.t);
  }
}
// a frame of our own, to place a list without a whole physics
function frameAt(bodyId, p) { const f = new LocalFrame(); f.anchor(bodyId, p.x, p.y, p.z); return f; }
// east and north at the focus, body-local (the frame's own axes)
function axes(w) { const f = w.physics.fields.frame || frameAt(w.bodyId, w.focus); return { e: V(f.ex, f.ey, f.ez), n: V(f.nx, f.ny, f.nz) }; }
const add = (p, d, k) => V(p.x + d.x * k, p.y + d.y * k, p.z + d.z * k);
const count = (b) => b.count;
// the mean velocity (east, north) of the grains inside the gust's path: within 6 m of the aim's line, 1 to 32 m out
// (the focus is the frame's anchor: grid x east, z north from it)
// (b._p, b._v, b._n: the simulation's own arrays, in the frame's grid; b.pos is what is published, in the body's axes)
function meanVel(b) { let e = 0, n = 0, k = 0; for (let i = 0; i < b._n; i++) { const x = b._p[i * 3], z = b._p[i * 3 + 2]; if (Math.abs(x) > 6 || z < 1 || z > 32) continue; e += b._v[i * 3]; n += b._v[i * 3 + 2]; k++; } return k ? [e / k, n / k, k] : [0, 0, 0]; }

test('a gust is a pulse that runs out along the aim, widens, and is gone', () => {
  const p = V(0, 0, BODIES.earth.radius), f = frameAt('earth', p), S = makeWinds(), o = new Float64Array(4);
  castGust(S, 'earth', p, V(f.nx, f.ny, f.nz));            // aimed north
  const at = (t, n, e, hz = 1) => { S[0].age = t; S[0].strength = 1; placeWinds(S, f, 'earth'); powerWind(S, e, n, hz, o); return [o[0], o[1], o[2]]; };
  // at 0.4 s the front is 10.4 m out: strong just behind it, nothing well ahead of it
  const near = at(0.4, 9, 0), ahead = at(0.4, 20, 0);
  assert.ok(near[1] > 12, 'wind along the aim behind the front: ' + near[1].toFixed(1));
  assert.ok(Math.abs(near[0]) < 0.5, 'and none across it on the axis');
  assert.ok(Math.hypot(ahead[0], ahead[1]) < 0.3, 'none yet 10 m ahead of the front: ' + ahead[1].toFixed(2));
  assert.ok(near[2] > 1, 'it blows upward at the ground: ' + near[2].toFixed(1));
  assert.ok(at(0.4, 9, 0, 8)[1] < near[1] * 0.2, 'and is weak 8 m up');
  // across: half strength about 0.8 of its half-width out, gone at 2.4 widths; it fans outward
  const w = WINDPOWER.gustRadius + WINDPOWER.gustSpread * 9;
  const side = at(0.4, 9, w);
  assert.ok(side[1] < near[1] * 0.45 && side[1] > near[1] * 0.25, 'one width out, about a third');
  assert.ok(side[0] > 0, 'fanning outward on the east side');
  assert.equal(Math.hypot(...at(0.4, 9, w * 2.6)), 0, 'nothing beyond 2.4 widths');
  // later the pulse has gone by here, and it weakens with the distance run
  assert.ok(at(1.2, 9, 0)[1] < near[1] * 0.25, 'the pulse has passed');
  assert.ok(at(1.2, 28, 0)[1] < near[1] * 0.6 && at(1.2, 28, 0)[1] > 2, 'weaker 28 m out, still a wind');
  assert.equal(Math.hypot(...at(1.2, WINDPOWER.gustReach + 6, 0)), 0, 'nothing beyond its reach');
  // it ends
  for (let i = 0; i < 200; i++) stepWinds(S, 1 / 60);
  assert.equal(S.count, 0, 'gone after its life');
});

test('wind control: a stilled place multiplies the wind by nothing, a quickened one by more, and both pass', () => {
  const p = V(0, 0, BODIES.earth.radius), f = frameAt('earth', p), S = makeWinds(), o = new Float64Array(4);
  castZone(S, 'earth', p, V(f.ex, f.ey, f.ez), 'calm');
  for (let i = 0; i < 300; i++) stepWinds(S, 1 / 60);
  placeWinds(S, f, 'earth');
  assert.ok(powerWind(S, 0, 0, 1, o) && o[3] < 0.01, 'a dead calm in the middle: ' + o[3]);
  assert.ok(powerWind(S, WINDPOWER.zoneRadius * 0.9, 0, 1, o) && o[3] > 0.3 && o[3] < 1, 'easing at the rim');
  assert.equal(powerWind(S, WINDPOWER.zoneRadius + 1, 0, 1, o), false, 'nothing outside');
  assert.ok(powerWind(S, 0, 0, WINDPOWER.zoneHeight * 1.6, o) === false, 'nor high above');
  const Q = makeWinds();
  castZone(Q, 'earth', p, V(f.ex, f.ey, f.ez), 'quicken');
  for (let i = 0; i < 300; i++) stepWinds(Q, 1 / 60);
  placeWinds(Q, f, 'earth'); powerWind(Q, 0, 0, 1, o);
  assert.ok(Math.abs(o[3] - WINDPOWER.quickenGain) < 0.01 && o[0] > WINDPOWER.quickenPush * 0.95, 'quickened, with a push along the aim');
  for (let i = 0; i < 60 * (WINDPOWER.zoneLife + 1); i++) { stepWinds(S, 1 / 60); stepWinds(Q, 1 / 60); }
  assert.equal(S.count + Q.count, 0, 'both pass');
});

test('a gathered ball draws the air in, turns it, and holds at its height; let go, it fades', () => {
  const p = V(0, 0, BODIES.earth.radius), f = frameAt('earth', p), S = makeWinds(), o = new Float64Array(4);
  const s = castOrb(S, 'earth', p);
  for (let i = 0; i < 60; i++) stepWinds(S, 1 / 60);
  placeWinds(S, f, 'earth');
  powerWind(S, 4, 0, WINDPOWER.orbHeight, o);
  assert.ok(o[0] < -3, 'drawn in toward the ball from the east: ' + o[0].toFixed(1));
  assert.ok(o[1] > 1, 'and turned round it');
  powerWind(S, 0.5, 0, 0.1, o); assert.ok(o[2] > 1, 'lifted under the ball');
  powerWind(S, 0.5, 0, 4, o); assert.ok(o[2] < -1, 'pressed down over it');
  assert.equal(powerWind(S, WINDPOWER.orbRadius + 1, 0, 1, o), false, 'nothing beyond its radius');
  for (let i = 0; i < 600; i++) stepWinds(S, 1 / 60);
  assert.equal(S.count, 1, 'held: it stays');
  moveWind(s, V(3, 0, BODIES.earth.radius)); placeWinds(S, f, 'earth');
  assert.ok(Math.hypot(s.x, s.z) > 2.9, 'it moves where it is carried');
  releaseWind(s);
  for (let i = 0; i < 60; i++) stepWinds(S, 1 / 60);
  assert.equal(S.count, 0, 'let go: gone within a second');
});

test('a tornado is handed to the game as a dust devil; at most six sources live at once', () => {
  const p = V(0, 0, BODIES.earth.radius), f = frameAt('earth', p), S = makeWinds(), devils = []; devils.count = 0;
  castVortex(S, 'earth', p, -1);
  for (let i = 0; i < 300; i++) stepWinds(S, 1 / 60);
  placeWinds(S, f, 'earth'); windsToDevils(S, devils);
  assert.equal(devils.count, 1);
  const D = devils[0];
  assert.ok(D.radius === WINDPOWER.vortexRadius && D.speed === WINDPOWER.vortexSpeed && D.spin === -1 && D.strength > 0.99 && D.height === WINDPOWER.vortexHeight);
  for (let i = 0; i < 12; i++) castGust(S, 'earth', p, V(f.ex, f.ey, f.ez));
  assert.equal(S.count, WINDPOWER.max, 'never more than the limit');
  assert.ok(S.every((s, i) => i >= S.count || s.kind === KIND.jet), 'the oldest gave way');
});

test('unused, the powers change nothing: the same world with no list and with an empty one', () => {
  const a = setup('earth', 'temperate_forest'), b = setup('earth', 'temperate_forest'), empty = makeWinds();
  run(a, 4, null); run(b, 4, empty);
  const A = a.physics.particles.leaves, B = b.physics.particles.leaves;
  assert.equal(A.count, B.count, 'the same leaves in the air');
  for (let i = 0; i < A.count * 3; i += 7) assert.equal(A.pos[i], B.pos[i]);
  assert.deepEqual(Array.from(a.physics.fields.flora.bend.slice(0, 256)), Array.from(b.physics.fields.flora.bend.slice(0, 256)), 'the same bend in the plants');
  assert.equal(a.physics.here.air.speed, b.physics.here.air.speed);
});

test('a gust is felt in the air at a point, bends the plants it passes, and the air is as it was afterwards', () => {
  const w = setup('earth', 'temperate_forest'), S = makeWinds();
  run(w, 2, S);
  const { n } = axes(w);
  const at = add(w.focus, n, 8), before = w.physics.air(w.bodyId, at, {}, 1).speed;
  const bend0 = Array.from(w.physics.fields.flora.bend);
  castGust(S, w.bodyId, add(w.focus, n, 1), n);
  let peak = 0, bent = 0;
  run(w, 1.2, S, () => { peak = Math.max(peak, w.physics.air(w.bodyId, at, {}, 1).speed); const b = w.physics.fields.flora.bend; for (let i = 0; i < b.length; i++) bent = Math.max(bent, Math.abs(b[i] - bend0[i])); });
  assert.ok(peak > before + 10, 'the air 8 m out along the aim took the gust: ' + before.toFixed(1) + ' -> ' + peak.toFixed(1) + ' m/s');
  assert.ok(bent > 0.2, 'the plants bent to it: ' + bent.toFixed(2));
  run(w, 4, S);
  assert.equal(S.count, 0);
  assert.ok(Math.abs(w.physics.air(w.bodyId, at, {}, 1).speed - before) < 4, 'and the air is as it was');
});

test('a gust lifts what lies loose and carries it along the aim: dust off dry ground, leaves off a wood floor', () => {
  for (const [body, biome, kind] of [['earth', 'desert_canyon', 'dust'], ['earth', 'autumn_woodland', 'leaves']]) {
    const w = setup(body, biome), S = makeWinds();
    run(w, 2, S);
    const { n } = axes(w);                 // (after the first frames: the frame is anchored by then)
    const b = w.physics.particles[kind], n0 = count(b);
    castGust(S, w.bodyId, add(w.focus, n, 1), n);
    let most = 0, along = 0;
    run(w, 1.0, S, () => { if (count(b) > most) most = count(b); const v = meanVel(b); if (v[2] > 10 && v[1] > along) along = v[1]; });
    assert.ok(most > n0 + 25, body + ' ' + kind + ': lifted ' + (most - n0) + ' (from ' + n0 + ')');
    assert.ok(along > 1.5, body + ' ' + kind + ': carried along the aim at ' + along.toFixed(1) + ' m/s on average');
  }
});

test('the air is seen: over ground with nothing loose on it a gust still carries pale strokes, and they are gone in seconds', () => {
  const w = setup('mercury', 'obsidian_fields'), S = makeWinds();
  const E = setup('earth', 'alpine_meadow');
  for (const x of [E]) {
    run(x, 2, S);
    const { n } = axes(x), b = x.physics.particles.leaves, n0 = b._n;
    castGust(S, x.bodyId, add(x.focus, n, 1), n);
    let most = 0;
    run(x, 0.8, S, () => { most = Math.max(most, b._n); });
    assert.ok(most > n0 + 60, 'strokes of air in the gust: ' + (most - n0));
    let pale = 0; for (let i = 0; i < b._n; i++) if (b.mat[i] < 200) pale++;
    assert.ok(pale > 50, 'in the colours of snow and ice, not of leaves: ' + pale);
    run(x, 5, S);
    assert.ok(b._n < n0 + 12, 'and gone again: ' + b._n + ' (there were ' + n0 + ')');
  }
  void w;
});

test('gather: the leaves of a wood floor are drawn into the ball and held round it, and go where it is carried', () => {
  const w = setup('earth', 'autumn_woodland'), S = makeWinds();
  run(w, 2, S);
  const { n, e } = axes(w), b = w.physics.particles.leaves;
  const near = (cx, cz, r) => { let k = 0; for (let i = 0; i < b._n; i++) { const dx = b._p[i * 3] - cx, dz = b._p[i * 3 + 2] - cz; if (dx * dx + dz * dz < r * r) k++; } return k; };
  const before = near(0, 4, 3);
  const orb = castOrb(S, w.bodyId, add(w.focus, n, 4));
  run(w, 2.5, S);
  const held = near(0, 4, 3);
  assert.ok(held > before + 15, 'leaves within 3 m of the ball: ' + before + ' -> ' + held);
  // carried 10 m east over two seconds: the crowd goes with it
  for (let i = 0; i < 120; i++) { moveWind(orb, add(add(w.focus, n, 4), e, 10 * (i + 1) / 120)); run(w, 1 / 60, S); }
  run(w, 0.8, S);
  const there = near(10, 4, 3.5), left = near(0, 4, 3);
  assert.ok(there > 12 && there > left, 'they went with the ball: ' + there + ' round it, ' + left + ' left behind');
});

test('a whirl lifts the leaves at its foot and turns them round itself', () => {
  const w = setup('earth', 'autumn_woodland'), S = makeWinds();
  run(w, 2, S);
  const { n } = axes(w), b = w.physics.particles.leaves, n0 = b._n;
  castVortex(S, w.bodyId, add(w.focus, n, 12), 1);
  run(w, 4, S);
  // round the foot (grid 0, 12): how many, how high, and which way they turn (positive: with its spin)
  let k = 0, turn = 0, high = 0;
  for (let i = 0; i < b._n; i++) {
    const dx = b._p[i * 3], dz = b._p[i * 3 + 2] - 12, r = Math.hypot(dx, dz);
    if (r > 12 || r < 0.3) continue;
    k++; turn += (-dz * b._v[i * 3] + dx * b._v[i * 3 + 2]) / r; if (b.hag[i] > 4) high++;
  }
  assert.ok(b._n > n0 + 40 && k > 40, 'leaves in the air round it: ' + k + ' (the wood had ' + n0 + ' flying)');
  assert.ok(turn / k > 1, 'turning with it, ' + (turn / k).toFixed(1) + ' m/s on average');
  assert.ok(high > 5, 'and carried up: ' + high + ' over 4 m');
  assert.equal(w.physics.features.devils.count >= 1, true, 'the game sees it as a dust devil');
});

test('a stilled place: the air at the explorer is nearly still while it lasts', () => {
  const w = setup('earth', 'sea_coast'), S = makeWinds();
  run(w, 2, S);
  const { e } = axes(w);
  const before = w.physics.here.air.speed;
  castZone(S, w.bodyId, w.focus, e, 'calm');
  run(w, 5, S);
  const calm = w.physics.here.air.speed;
  assert.ok(before > 1, 'there was a wind: ' + before.toFixed(1));
  assert.ok(calm < before * 0.1 + 0.2, 'stilled: ' + before.toFixed(1) + ' -> ' + calm.toFixed(2) + ' m/s');
});

test('the cost: a frame of physics with every kind of wind at work costs little more than one without', () => {
  const w = setup('earth', 'autumn_woodland'), S = makeWinds();
  run(w, 3, S);
  const { n, e } = axes(w);
  const time = (secs) => { const t0 = performance.now(); run(w, secs, S); return (performance.now() - t0) / (secs * 60); };
  const base = time(3);
  castVortex(S, w.bodyId, add(w.focus, n, 10)); castZone(S, w.bodyId, add(w.focus, e, 20), e, 'quicken'); castOrb(S, w.bodyId, add(w.focus, e, -6));
  let cast = 0;
  const t0 = performance.now(); let frames = 0;
  for (let k = 0; k < 6; k++) { castGust(S, w.bodyId, add(w.focus, n, 1), n); run(w, 0.5, S); frames += 30; cast++; }
  const busy = (performance.now() - t0) / frames;
  console.log('physics a frame: ' + base.toFixed(3) + ' ms without, ' + busy.toFixed(3) + ' ms with a tornado, a zone, a ball and a gust every half second (' + cast + ' gusts)');
  assert.ok(busy < base + 2.5, 'under 2.5 ms more a frame: ' + base.toFixed(2) + ' -> ' + busy.toFixed(2));
});
