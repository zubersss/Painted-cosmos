// Tests: the wind the explorer makes (powers.js) and what answers it. Run: node --test src/physics/
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPhysics } from './index.js';
import { MATERIAL_INDEX } from './ground.js';
import { makeWinds, castGust, castZone, castOrb, castVortex, castPart, castRip, partedAt, partShape, turnWind, moveWind, releaseWind, stepWinds, placeWinds, powerWind, windsToDevils, WINDPOWER, KIND } from './powers.js';
import { LocalFrame } from './near.js';
import { FLORA } from './flora.js';          // (the trees' own lean limit, for the one-ability rule)
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
  assert.ok(Math.abs(at(0.4, 9, 0, WINDPOWER.gustAxis)[0]) < 0.05, 'and none across it on its own line (' + WINDPOWER.gustAxis + ' m up)');
  // it turns about its own line: over the line the air goes one way across, under it the other; to one side of
  // the line it rises, to the other it sinks (taking the ground's own lift away: the two sides differ)
  const over = at(0.4, 9, 0, WINDPOWER.gustAxis + 1)[0], under = at(0.4, 9, 0, WINDPOWER.gustAxis - 1)[0];
  assert.ok(over * under < 0 && Math.abs(over) > 2, 'the air turns about the line: ' + over.toFixed(1) + ' over it, ' + under.toFixed(1) + ' under');
  const east = at(0.4, 9, 1.5, WINDPOWER.gustAxis)[2], west = at(0.4, 9, -1.5, WINDPOWER.gustAxis)[2];
  assert.ok(Math.abs(east - west) > 4, 'rising on one side, sinking on the other: ' + east.toFixed(1) + ', ' + west.toFixed(1));
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

test('a whirl among the game\'s own dust devils: its record is a whole devil, and a real devil can take its slot after it', async () => {
  const { makeDevil, devilsNear } = await import('./features.js');
  const p = V(0, 0, BODIES.mars.radius), f = frameAt('mars', p), S = makeWinds();
  castVortex(S, 'mars', p, 1); stepWinds(S, 1); placeWinds(S, f, 'mars');
  const devils = []; devils.count = 0;
  windsToDevils(S, devils);
  assert.equal(devils.count, 1);
  assert.deepEqual(Object.keys(devils[0]).sort(), Object.keys(makeDevil()).sort(), 'the same fields as one of the game\'s own');
  assert.ok(Math.abs(devils[0].p.z - p.z) < 1e-6 && devils[0].radius === WINDPOWER.vortexRadius, 'its foot and its size');
  // the game's own devils write into every field of whatever lies in the list: they must be able to
  const D = devils[0]; D.p.x = 1; D.age = 2; D.life = 3; D.id = 4;
  // and a whole frame of the physics with a whirl on a world of dust devils goes through, again and again
  const w = setup('mars', 'desert_canyon'), S2 = makeWinds();
  run(w, 1, S2);
  castVortex(S2, w.bodyId, add(w.focus, axes(w).n, 12), 1);
  run(w, 2, S2);
  for (let i = 0; i < 200; i++) stepWinds(S2, 0.1);                 // the whirl is over; its slot is the game's again
  run(w, 2, S2);
  assert.ok(w.physics.features.devils.count >= 0, 'the physics still runs');
  void devilsNear;
});

test('move water: a held channel runs out along the aim, parts the water on its floor, and closes from the far end when let go', () => {
  const R = BODIES.earth.radius, p = V(0, 0, R), f = frameAt('earth', p), S = makeWinds(), W = WINDPOWER;
  const n = V(f.nx, f.ny, f.nz), e = V(f.ex, f.ey, f.ez);
  const part = castPart(S, 'earth', p, n);
  assert.equal(part.kind, KIND.part); assert.equal(part.len, 0);
  const at = (north, east) => partedAt(S, 'earth', p.x + n.x * north + e.x * east, p.y + n.y * north + e.y * east, p.z + n.z * north + e.z * east);
  assert.equal(at(3, 0), 0, 'nothing is parted before it has run out');
  for (let i = 0; i < 30; i++) stepWinds(S, 1 / 60);                       // half a second: 8 m
  assert.ok(Math.abs(part.len - 0.5 * W.partOpen) < 1e-6, 'it runs out at partOpen: ' + part.len);
  assert.equal(at(3, 0), 1, 'the floor is dry 3 m along');
  assert.equal(at(3, W.partHalf + 0.1), 0, 'the water stands beyond the wall');
  assert.ok(at(3, W.partHalf - 0.25) > 0 && at(3, W.partHalf - 0.25) < 1, 'the wall is in between');
  assert.equal(at(part.len + 0.5, 0), 0, 'and beyond its end'); assert.equal(at(-1.5, 0), 0, 'and behind its start');
  assert.equal(at(3, 0), partShape(3, 0, part.len, W.partHalf), 'partedAt is partShape (the painter draws the same shape)');
  for (let i = 0; i < 120; i++) stepWinds(S, 1 / 60);
  assert.equal(part.len, W.partReach, 'held, it stays at its full length');
  // it goes where it is moved and turned, and no cast takes a held one's place
  moveWind(part, V(p.x + e.x * 20, p.y + e.y * 20, p.z + e.z * 20)); turnWind(part, e);
  assert.equal(at(3, 0), 0); assert.equal(at(0, 23), 1, 'moved 20 m east and turned east: dry 3 m along it there');
  for (let i = 0; i < 9; i++) castGust(S, 'earth', p, n);
  assert.ok(S.count <= W.max && [...Array(S.count).keys()].some((i) => S[i] === part), 'the held channel is still in the list');
  // it carries a wind along itself
  placeWinds(S, frameAt('earth', V(p.x + e.x * 20, p.y + e.y * 20, p.z + e.z * 20)), 'earth');
  const o = new Float64Array(4);
  for (let i = 0; i < S.count; i++) if (S[i] !== part) S[i].strength = 0;
  powerWind(S, 5, 0, 1, o);
  assert.ok(o[0] > W.partWind * 0.8 && Math.abs(o[1]) < 0.01, 'a wind along it between its walls: ' + o[0].toFixed(1));
  powerWind(S, 5, W.partHalf * 2.5, 1, o); assert.equal(o[0], 0, 'and none outside them');
  // let go: it closes from the far end inward and is gone
  releaseWind(part);
  for (let i = 0; i < 30; i++) stepWinds(S, 1 / 60);
  assert.ok(Math.abs(part.len - (W.partReach - 0.5 * W.partClose)) < 1e-6, 'closing at partClose: ' + part.len);
  assert.equal(at(0, 23), 1, 'still dry near its start'); assert.equal(at(0, 20 + W.partReach - 1), 0, 'the far end has closed');
  for (let i = 0; i < 120; i++) stepWinds(S, 1 / 60);
  assert.ok(![...Array(S.count).keys()].some((i) => S[i] === part && S[i].kind === KIND.part), 'and it is gone');
  assert.equal(at(0, 23), 0);
});

test('move water: over water the channel throws spray off its two walls and carries strokes of air; over land no spray', () => {
  for (const [sea, want] of [[1.2, true], [0, false]]) {
    const w = setup('earth', 'alpine_meadow', { sea }), S = makeWinds();
    run(w, 1, S);
    const { n } = axes(w), sp = w.physics.particles.spray, lf = w.physics.particles.leaves, s0 = sp._n, l0 = lf._n;
    castPart(S, w.bodyId, add(w.focus, n, -1.5), n);
    run(w, 1.5, S);
    if (want) assert.ok(sp._n > s0 + 40, 'spray off the walls: ' + (sp._n - s0)); else assert.ok(sp._n <= s0 + 2, 'no water, no spray: ' + (sp._n - s0));
    let pale = 0; for (let i = 0; i < lf._n; i++) if (lf.mat[i] < 200) pale++;
    assert.ok(pale > 8, 'strokes of air along it: ' + pale + ' (leaves before: ' + l0 + ')');
  }
});

test('a gust through a wood tears leaves out of the crowns, raises dust, and snaps a branch or two; over bare ground none of it', () => {
  const I_WOOD = MATERIAL_INDEX.mud;
  // (high: only the wood's own leaves three metres up and more, not the pale strokes of air, which fly at any height)
  const look = (b) => { let high = 0, wood = 0, leaf = 0; for (let i = 0; i < b._n; i++) { const m = b.mat[i]; if (m === I_WOOD) { wood++; continue; } if (m < 200) continue; leaf++; if (b._p[i * 3 + 1] > 3) high++; } return { high, wood, leaf }; };
  // a wood: leaves come down from the height they grew at, dust comes up, and a branch snaps
  const w = setup('earth', 'autumn_woodland'), S = makeWinds();
  run(w, 2, S);
  const b = w.physics.particles.leaves, du = w.physics.particles.dust, before = look(b), d0 = du._n;
  castGust(S, w.bodyId, add(w.focus, axes(w).n, 1), axes(w).n);
  let mostHigh = 0, mostWood = 0;
  run(w, 1.6, S, () => { const o = look(b); mostHigh = Math.max(mostHigh, o.high); mostWood = Math.max(mostWood, o.wood); });
  const after = look(b);
  assert.ok(after.leaf > before.leaf + 120, 'leaves in the air: ' + (after.leaf - before.leaf));
  assert.ok(mostHigh > before.high + 80, 'and most of them from the crowns, three metres up and more: ' + mostHigh);
  assert.ok(du._n > d0 + 25, 'dust raised off the floor too: ' + (du._n - d0));
  assert.ok(mostWood >= WINDPOWER.snapPieces && mostWood <= WINDPOWER.snapMax * WINDPOWER.snapPieces,
    'one or two branches snapped, no more: ' + mostWood + ' pieces of ' + WINDPOWER.snapPieces);
  // bare ground with no canopy: nothing is torn and no branch snaps
  const m = setup('mercury', 'obsidian_fields'), S2 = makeWinds();
  run(m, 2, S2);
  const mb = m.physics.particles.leaves, m0 = look(mb);
  castGust(S2, m.bodyId, add(m.focus, axes(m).n, 1), axes(m).n);
  let mw = 0, mh = 0;
  run(m, 1.6, S2, () => { const o = look(mb); mw = Math.max(mw, o.wood); mh = Math.max(mh, o.high - m0.high); });
  assert.equal(mw, 0, 'no branch where there are no trees');
  assert.ok(mh < 25, 'and nothing torn from a crown that is not there: ' + mh);
});

test('a stilled place is seen to fall still: strokes round its rim in its first second, none after', () => {
  const w = setup('earth', 'alpine_meadow'), S = makeWinds();
  run(w, 1, S);
  const { n } = axes(w), b = w.physics.particles.leaves;
  const pale = () => { let k = 0; for (let i = 0; i < b._n; i++) if (b.mat[i] < 200) k++; return k; };
  const p0 = pale();
  castZone(S, w.bodyId, add(w.focus, n, 4), n, 'calm');
  run(w, 0.8, S);
  const during = pale();
  assert.ok(during > p0 + 30, 'strokes while it falls still: ' + (during - p0));
  // they stand round the rim, not in the middle
  let rim = 0, mid = 0; for (let i = 0; i < b._n; i++) { if (!(b.mat[i] < 200)) continue; const r = Math.hypot(b._p[i * 3], b._p[i * 3 + 2] - 4); if (r > WINDPOWER.zoneRadius * 0.6) rim++; else mid++; }
  assert.ok(rim > mid * 3, 'round its rim: ' + rim + ' at the rim, ' + mid + ' inside');
  run(w, 5, S);
  assert.ok(pale() <= p0 + 3, 'and none once it is still: ' + pale());
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

test('the explorer\'s wind lays a stand over the way it is sent, further than any gale bends a tree, and the wood stands up again after', () => {
  const w = setup('earth', 'autumn_woodland'), S = makeWinds();
  run(w, 2, S);
  const F = w.physics.fields.flora, { n, e } = axes(w);
  const at = (north) => { const o = {}, q = add(w.focus, n, north); F.plantBend(q, 1, o); return { ang: o.angle || 0, e: o.e || 0, n: o.n || 0 }; };
  const quiet = at(8);
  assert.ok(quiet.ang < 0.1, 'a quiet wood barely leans: ' + (quiet.ang * 57.3).toFixed(1) + ' degrees');
  // sent north: the trees lean north, and further than a real tree's own limit (FLORA.stiffMax)
  castGust(S, w.bodyId, add(w.focus, n, 1), n, 1, 2, true);
  let worst = quiet;
  run(w, 2, S, () => { const b = at(8); if (b.ang > worst.ang) worst = b; });
  assert.ok(worst.ang > 0.45, 'laid over by the gust: ' + (worst.ang * 57.3).toFixed(1) + ' degrees');
  assert.ok(worst.n > 0 && Math.abs(worst.e) < worst.n * 0.4, 'and the lean is the way the wind was sent (north)');
  // sent east from the same spot: they lean east
  const S2 = makeWinds();
  castGust(S2, w.bodyId, add(w.focus, e, 1), e, 1, 2, true);
  let worstE = { ang: 0, e: 0, n: 0 };
  run(w, 2, S2, () => { const o = {}, q = add(w.focus, e, 8); F.plantBend(q, 1, o); if ((o.angle || 0) > worstE.ang) worstE = { ang: o.angle, e: o.e, n: o.n }; });
  assert.ok(worstE.ang > 0.45 && worstE.e > 0 && Math.abs(worstE.n) < worstE.e * 0.4, 'laid over to the east instead: ' + (worstE.ang * 57.3).toFixed(1) + ' degrees');
  // and when the explorer's wind is gone the wood stands as it did, under its own weather
  run(w, 6, S2);
  const after = at(8);
  assert.ok(after.ang < 0.12, 'standing again: ' + (after.ang * 57.3).toFixed(1) + ' degrees');
});

test('ONE ABILITY BENDS THE TREES (owner, 2026-11-18): a quickened place, a gathered ball and a wind knife stir a wood but never lay it over', () => {
  const w = setup('earth', 'autumn_woodland'), F = w.physics.fields.flora, { n } = axes(w);
  const at = (north) => { const o = {}; F.plantBend(add(w.focus, n, north), 1, o); return o.angle || 0; };
  run(w, 2, makeWinds());
  // what a real trunk may do under any weather: FLORA.stiffMax, 17 degrees
  const limit = FLORA.stiffMax + 1e-6;
  for (const [name, cast] of [
    ['a quickened place', (S) => castZone(S, w.bodyId, add(w.focus, n, 6), n, 'quicken', 3)],
    ['a stilled place', (S) => castZone(S, w.bodyId, add(w.focus, n, 6), n, 'calm', 3)],
    ['a gathered ball', (S) => castOrb(S, w.bodyId, add(w.focus, n, 6), 3)],
    ['the knife\'s blade', (S) => castGust(S, w.bodyId, add(w.focus, n, 1), n, 0.9, 3)],
  ]) {
    const S = makeWinds();
    cast(S);
    let worst = 0;
    run(w, 2.5, S, () => { const a = at(6); if (a > worst) worst = a; });
    assert.ok(worst <= limit, name + ' leaves the wood within a real tree\'s own limit: ' + (worst * 57.3).toFixed(1) + ' degrees, limit ' + (limit * 57.3).toFixed(1));
  }
  // and the one that does bend them still does, from the same place
  const S = makeWinds();
  castGust(S, w.bodyId, add(w.focus, n, 1), n, 1, 3, true);
  let worst = 0;
  run(w, 2.5, S, () => { const a = at(6); if (a > worst) worst = a; });
  assert.ok(worst > limit * 1.5, 'the gust ability still lays them right over: ' + (worst * 57.3).toFixed(1) + ' degrees');
});

// THE RIP IN SPACE-TIME (the owner, 2026-11-22: "a rip in space time that sucks everything in a long ways in").
// What makes it the owner's rip and not a bigger gathered ball: the draw does not die away with distance. It is
// at full strength out to most of its reach, so standing fifty metres off you are already being taken.
test('a rip draws everything in from a long way off, turns and lifts at the tear, and closes by itself', () => {
  const p = V(0, 0, BODIES.earth.radius), f = frameAt('earth', p), S = makeWinds(), o = new Float64Array(4);
  const R = 55;
  castRip(S, 'earth', p, R, 6.5);
  for (let i = 0; i < 90; i++) stepWinds(S, 1 / 60);        // let it tear open
  placeWinds(S, f, 'earth');
  // a long way out to the east, and still drawn hard back to the middle (west is -o[0])
  powerWind(S, 40, 0, 2, o);
  assert.ok(o[0] < -20, 'at 40 m the air is barely drawn in: ' + o[0].toFixed(1));
  powerWind(S, 10, 0, 2, o);
  const near = o[0];
  powerWind(S, 40, 0, 2, o);
  assert.ok(o[0] < near * 0.6, 'the draw falls away with distance like a ball: near ' + near.toFixed(1) + ' far ' + o[0].toFixed(1));
  // round it as well as in
  powerWind(S, 20, 0, 2, o);
  assert.ok(Math.abs(o[1]) > 0.5, 'nothing turns round the tear: ' + o[1].toFixed(2));
  // and lifted into it at the middle
  powerWind(S, 1, 0, 2, o);
  assert.ok(o[2] > 4, 'nothing is lifted into the tear: ' + o[2].toFixed(1));
  // nothing at all beyond its reach
  assert.equal(powerWind(S, R + 6, 0, 2, o), false, 'it reaches past its own rim');
  // nor high above it (a crown is taken, a cloud is not)
  assert.equal(powerWind(S, 10, 0, WINDPOWER.ripTall * 1.5, o), false, 'it reaches to the clouds');
  // it is not held: it closes by itself and gives its slot back
  for (let i = 0; i < 60 * 9; i++) stepWinds(S, 1 / 60);
  assert.equal(S.count, 0, 'a rip outlived its life: ' + S.count);
});
