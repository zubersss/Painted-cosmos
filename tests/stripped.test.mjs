// The wind that strips a tree bare (the powers): the lasting record of how bare each crown is
// (src/data/stripped.js), the handover from the physics that tears the leaves, and the saved game.
// Run: node --test tests/stripped.test.mjs
//
// This test only loads the record itself, which is pure: it needs no browser, no world and no play code. What the
// physics and the world must do with it is written out as patches in the report that came with this file; until
// those are applied nothing in the game writes to this record.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STRIP, STRIPPED, stripTree, strippedAt, bareAt, strippedOn, stripStep, bendTurn,
  tornAt, drainTorn, strippedRows, strippedLoad,
} from '../src/data/stripped.js';

const R = 6371000.5;                       // a tree's place is body-local and far from the origin: full-sized numbers
const P = (i = 0) => [100 + i * 7.25, R, 200 - i * 3.5];
// Microseconds for one go of fn, as the quickest of five runs of n. (The quickest, because a single run of a cheap
// function measures the machine's mood as much as the code: another process, or the engine not yet settled.)
const timeOf = (n, fn) => {
  let best = Infinity;
  for (let r = 0; r < 5; r++) {
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < n; i++) fn(i);
    const each = Number(process.hrtime.bigint() - t0) / 1000 / n;
    if (each < best) best = each;
  }
  return best;
};

test('nothing has been stripped: every reader answers at once', () => {
  strippedLoad([]);
  assert.equal(STRIPPED.size, 0);
  assert.equal(bareAt('earth', ...P()), 0);
  assert.equal(strippedAt('earth', ...P()), null);
  assert.deepEqual(strippedOn('earth'), []);
  assert.equal(stripStep(1 / 60), 0, 'and a frame of play costs nothing');
  const each = timeOf(20000, (i) => bareAt('earth', 100 + i, R, 200));
  assert.ok(each < 1, 'a read of an empty record is nothing at all: ' + each.toFixed(4) + ' us');
  console.log('    empty record: ' + (each * 1000).toFixed(1) + ' ns a read');
});

test('a crown goes bare by degrees, not at a stroke, and is known again by its own place', () => {
  strippedLoad([]);
  const v0 = STRIPPED.version;
  // a few leaves out of a full crown barely shows
  const A = stripTree('earth', ...P(), STRIP.full * 0.1, 0, 0, 1);
  assert.ok(A && STRIPPED.size === 1 && STRIPPED.version > v0, 'a tree new to the list always asks to be drawn again');
  assert.ok(Math.abs(A.b - 0.1) < 1e-9, 'a tenth of a crown of leaves is a tenth bare: ' + A.b);
  assert.equal(bareAt('earth', ...P()), A.b);
  assert.equal(strippedAt('earth', ...P()), A, 'the same record, by the same three numbers');
  assert.equal(bareAt('mars', ...P()), 0, 'another body, another tree');
  assert.equal(bareAt('earth', ...P(1)), 0, 'and the tree next to it is untouched');
  // ONE report cannot take a green crown bare, however much it carries: the owner asked for stripping, not a switch
  strippedLoad([]);
  const B = stripTree('earth', ...P(), STRIP.full * 50, 0, 0, 1);
  assert.ok(Math.abs(B.b - STRIP.step) < 1e-9, 'one report adds STRIP.step at the most: ' + B.b);
  assert.ok(STRIP.step < 0.5, 'and that is less than half a crown, so it takes three casts at the very least');
  // wind that keeps working on the same tree does strip it, and it stops at bare
  for (let i = 0; i < 10; i++) stripTree('earth', ...P(), STRIP.full * 50, 0, 0, 1);
  assert.equal(bareAt('earth', ...P()), 1, 'bare in the end');
  assert.equal(STRIPPED.size, 1, 'and still one tree');
  assert.deepEqual(strippedOn('earth'), [strippedAt('earth', ...P())]);
  assert.deepEqual(strippedOn('mars'), []);
  strippedLoad([]);
});

test('it keeps the way the wind was going, and leans toward the wind that works on it next', () => {
  strippedLoad([]);
  const A = stripTree('earth', ...P(), STRIP.full, 0, 0, 5);
  assert.ok(Math.abs(A.dz - 1) < 1e-9 && Math.abs(A.dx) < 1e-9, 'the first wind is kept as a unit: ' + A.dz);
  // a few leaves taken by a wind across the first barely turn the kept direction
  stripTree('earth', ...P(), STRIP.full * 0.05, 1, 0, 0);
  const B = strippedAt('earth', ...P());
  assert.ok(Math.abs(Math.hypot(B.dx, B.dy, B.dz) - 1) < 1e-9, 'still a unit');
  assert.ok(B.dx > 0 && B.dx < 0.2 && B.dz > 0.95, 'barely moved: ' + B.dx.toFixed(2) + ', ' + B.dz.toFixed(2));
  // a wind that takes as many leaves as one report may turns it most of the way, but never the whole way: what is
  // left of the crown leans the way of the wind that really worked on the tree
  stripTree('earth', ...P(), STRIP.full * 50, 1, 0, 0);
  assert.ok(Math.abs(Math.hypot(B.dx, B.dy, B.dz) - 1) < 1e-9, 'still a unit');
  assert.ok(B.dx > B.dz && B.dz > 0.1, 'mostly the new wind, with the old still in it: '
    + B.dx.toFixed(2) + ', ' + B.dz.toFixed(2));
  // a report with no direction at all (a still place) leaves the lean where it was
  const was = [B.dx, B.dy, B.dz];
  stripTree('earth', ...P(), 1, 0, 0, 0);
  assert.deepEqual([B.dx, B.dy, B.dz], was);
  strippedLoad([]);
});

test('what is left of a stripped tree leans the way the wind went, by as much as it is bare', () => {
  // the same shape as a felled tree's turn: v turned by the quaternion q = [x, y, z, w]
  const rot = (q, v) => {
    const [x, y, z, w] = q, tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]);
    return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)];
  };
  const q = [0, 0, 0, 1], up = [0, 1, 0];
  // a tree in full leaf stands straight
  assert.deepEqual(bendTurn(0, 1, 0, { b: 0, dx: 0, dy: 0, dz: 1 }, q), [0, 0, 0, 1]);
  // wholly bare: its top has gone over toward the wind by STRIP.bend
  bendTurn(0, 1, 0, { b: 1, dx: 0, dy: 0, dz: 1 }, q);
  let top = rot(q, up);
  assert.ok(Math.abs(top[2] - Math.sin(STRIP.bend)) < 1e-9 && Math.abs(top[0]) < 1e-9,
    'the top leans along the wind: ' + top.map((n) => n.toFixed(3)));
  // half bare: half the lean
  bendTurn(0, 1, 0, { b: 0.5, dx: 0, dy: 0, dz: 1 }, q);
  assert.ok(Math.abs(rot(q, up)[2] - Math.sin(STRIP.bend * 0.5)) < 1e-9, 'half bare, half the lean');
  // a wind aimed partly upward is taken level; one aimed straight up leans nothing
  bendTurn(0, 1, 0, { b: 1, dx: 0, dy: 0.8, dz: 0.6 }, q);
  assert.ok(Math.abs(rot(q, up)[2] - Math.sin(STRIP.bend)) < 1e-9);
  assert.deepEqual(bendTurn(0, 1, 0, { b: 1, dx: 0, dy: 1, dz: 0 }, q), [0, 0, 0, 1]);
  // and it works away from the poles too: up is not always (0, 1, 0)
  const u = 1 / Math.sqrt(3);
  bendTurn(u, u, u, { b: 1, dx: 1, dy: 0, dz: 0 }, q);
  top = rot(q, [u, u, u]);
  assert.ok(Math.abs(Math.hypot(...top) - 1) < 1e-9, 'still a unit');
  assert.ok(top[0] > u, 'and leaning toward the wind: ' + top.map((n) => n.toFixed(3)));
  // a real record off the list leans the same way the wind that stripped it went
  strippedLoad([]);
  for (let i = 0; i < 10; i++) stripTree('earth', ...P(), STRIP.full * 50, 0, 0, 1);
  bendTurn(0, 1, 0, strippedAt('earth', ...P()), q);
  assert.ok(Math.abs(rot(q, up)[2] - Math.sin(STRIP.bend)) < 1e-6);
  strippedLoad([]);
});

test('the world is asked to redraw a tree only when its bareness has really moved', () => {
  strippedLoad([]);
  stripTree('earth', ...P(), STRIP.full * 0.2);          // on the list: it must be drawn
  let v = STRIPPED.version;
  // a trickle of leaves, each well under STRIP.quant, costs no redraw until it adds up to one
  const tiny = STRIP.full * STRIP.quant * 0.4;
  stripTree('earth', ...P(), tiny); stripTree('earth', ...P(), tiny);
  assert.equal(STRIPPED.version, v, 'two reports under the step: nothing redrawn');
  stripTree('earth', ...P(), tiny);
  assert.ok(STRIPPED.version > v, 'past the step: now it is redrawn');
  // a tree already bare, held in a gust, does not ask to be redrawn every frame for nothing
  for (let i = 0; i < 20; i++) stripTree('earth', ...P(), STRIP.full * 50);
  assert.equal(bareAt('earth', ...P()), 1);
  v = STRIPPED.version;
  for (let i = 0; i < 60; i++) stripTree('earth', ...P(), STRIP.full * 50);
  assert.equal(STRIPPED.version, v, 'a second of gusting a bare tree: no redraws');
  strippedLoad([]);
});

test('a stripped tree waits, then comes back into leaf, and leaves the list when it is green', () => {
  strippedLoad([]);
  for (let i = 0; i < 10; i++) stripTree('earth', ...P(), STRIP.full * 50);   // held in a gust until it is bare
  assert.equal(bareAt('earth', ...P()), 1);
  // the wait: the owner sees what they did before any of it is undone
  for (let i = 0; i < Math.floor((STRIP.hold - 1) * 60); i++) stripStep(1 / 60);
  assert.equal(bareAt('earth', ...P()), 1, 'nothing has grown back during the wait');
  // a little comes back once the wait is out
  for (let i = 0; i < 120; i++) stripStep(1 / 60);
  const part = bareAt('earth', ...P());
  assert.ok(part > 0 && part < 1, 'coming back: ' + part.toFixed(3));
  // more wind through it starts the wait over, and takes it bare again
  for (let i = 0; i < 10; i++) stripTree('earth', ...P(), STRIP.full * 50);
  for (let i = 0; i < 60; i++) stripStep(1 / 60);
  assert.equal(bareAt('earth', ...P()), 1, 'more wind sets the wait going again');
  // and from a fresh wait, bare to green again takes the wait and the growing-back together
  for (let i = 0; i < 10; i++) stripTree('earth', ...P(), STRIP.full * 50);
  let t = 0;
  while (STRIPPED.size && t < (STRIP.hold + STRIP.regrow) * 3) { stripStep(1 / 30); t += 1 / 30; }
  assert.equal(STRIPPED.size, 0, 'green again, and off the list');
  assert.equal(bareAt('earth', ...P()), 0);
  const want = STRIP.hold + STRIP.regrow;
  assert.ok(t > want * 0.98 && t < want * 1.02, 'bare to green took ' + t.toFixed(0) + ' s of ' + want
    + ' (' + STRIP.hold + ' s of waiting and ' + STRIP.regrow + ' s of growing)');
  // a big step of time (a slow frame) does not undo a wood in one go
  stripTree('earth', ...P(), STRIP.full * 50);
  for (let i = 0; i < STRIP.hold + 2; i++) stripStep(1);
  stripStep(1000);
  assert.ok(bareAt('earth', ...P()) > 0, 'one enormous frame is taken as one second, not a thousand');
  strippedLoad([]);
});

test('the list has a cap, and forgets the tree that was stripped longest ago, not the one being stripped now', () => {
  strippedLoad([]);
  for (let i = 0; i < STRIP.max + 5; i++) stripTree('earth', ...P(i), STRIP.full * 50);
  assert.equal(STRIPPED.size, STRIP.max, 'no more than the cap');
  assert.equal(bareAt('earth', ...P(0)), 0, 'the first five are in leaf again');
  assert.equal(bareAt('earth', ...P(4)), 0);
  assert.ok(bareAt('earth', ...P(5)) > 0, 'the rest are still bare');
  assert.ok(bareAt('earth', ...P(STRIP.max + 4)) > 0, 'the newest included');
  // the tree the player is working on right now is not the one the cap throws away
  const keep = P(5);
  stripTree('earth', ...keep, 1);
  for (let i = 0; i < 20; i++) stripTree('earth', ...P(STRIP.max + 10 + i), STRIP.full * 50);
  assert.ok(bareAt('earth', ...keep) > 0, 'it is still on the list');
  strippedLoad([]);
});

test('the handover from the physics: many leaves out of one crown are one report', () => {
  strippedLoad([]);
  const held = [];
  assert.deepEqual(drainTorn(held), [], 'nothing torn, nothing to name');
  // leaves torn within a crown's width of each other are the same crown
  const [x, y, z] = P();
  for (let i = 0; i < 30; i++) tornAt('earth', x + (i % 3) * 0.5, y, z - (i % 4) * 0.5, 1, 0, 0, 1);
  tornAt('earth', x + 40, y, z, 7, 1, 0, 0);               // a crown well away: its own report
  const got = drainTorn(held);
  assert.equal(got.length, 2, 'two crowns, two reports');
  assert.equal(got[0].leaves, 30, 'all thirty leaves credited to the crown they came from');
  assert.equal(got[1].leaves, 7);
  assert.ok(Math.abs(got[0].dz - 1) < 1e-9, 'and the wind that took them');
  assert.deepEqual(drainTorn(held), [], 'drained once is drained');
  // what was handed over is not written over by the next thing the wind tears
  tornAt('earth', x, y, z, 5, 0, 0, 1);
  const a = drainTorn(held), snap = { ...a[0] };
  tornAt('earth', x + 100, y, z + 100, 99, 0, 1, 0);
  tornAt('earth', x + 200, y, z + 200, 99, 0, 1, 0);
  assert.deepEqual({ ...held[0] }, snap, 'the drained report is still what it was');
  // nobody draining it (the powers off) must not let it grow without end
  for (let i = 0; i < 500; i++) tornAt('earth', x + i * 20, y, z, 1, 0, 0, 1);
  assert.equal(drainTorn(held).length, STRIP.inbox, 'it holds STRIP.inbox reports and no more');
  strippedLoad([]);
  assert.deepEqual(drainTorn(held), [], 'and a new game starts with it empty');
});

test('the saved game: the wood is as the owner left it, and rubbish is refused', () => {
  strippedLoad([]);
  stripTree('earth', ...P(0), STRIP.full * 50, 0, 0, 1);
  stripTree('earth', ...P(0), STRIP.full * 50, 0, 0, 1);
  stripTree('mars', ...P(1), STRIP.full * 0.5, 1, 0, 0);
  const b0 = bareAt('earth', ...P(0)), rows = JSON.parse(JSON.stringify(strippedRows()));
  assert.equal(rows.length, 2);
  strippedLoad([]); assert.equal(STRIPPED.size, 0);
  strippedLoad(rows.concat([
    ['earth', 'x', 2, 3, 0.5, 0, 0, 1],            // a place that is not a number
    null,                                           // not a row at all
    ['earth', ...P(9), 0, 0, 0, 1],                 // a tree in full leaf: not on this list
    ['earth', ...P(8), NaN, 0, 0, 1],               // no bareness
  ]));
  assert.equal(STRIPPED.size, 2, 'the two real trees, and nothing else');
  assert.ok(Math.abs(bareAt('earth', ...P(0)) - b0) < 1e-3, 'as bare as it was: ' + bareAt('earth', ...P(0)));
  assert.ok(Math.abs(strippedAt('earth', ...P(0)).dz - 1) < 1e-3, 'leaning the way the wind went');
  assert.ok(bareAt('mars', ...P(1)) > 0 && bareAt('earth', ...P(1)) === 0, 'each on its own world');
  // and it waits again before recovering: the owner opens the game and sees the wood they left
  for (let i = 0; i < Math.floor((STRIP.hold - 1) * 30); i++) stripStep(1 / 30);
  assert.ok(Math.abs(bareAt('earth', ...P(0)) - b0) < 1e-3, 'still bare when the game is opened again');
  strippedLoad([]);
});

test('MEASURED: what the world pays to ask a hundred stripped trees how bare they are', () => {
  strippedLoad([]);
  for (let i = 0; i < 100; i++) stripTree('earth', ...P(i), STRIP.full * 50, 0, 0, 1);
  assert.equal(STRIPPED.size, 100);
  // the world lays a chunk and asks of every tree in it: most are not on the list, a few are
  const hit = timeOf(20000, (i) => bareAt('earth', ...P(i % 100)));
  const miss = timeOf(20000, (i) => bareAt('earth', ...P(1000 + (i % 100))));
  const mixed = timeOf(20000, (i) => bareAt('earth', ...P(i % 100 < 10 ? i % 100 : 1000 + (i % 100))));
  assert.ok(mixed < 2, 'a read is far under a microsecond: ' + mixed.toFixed(3) + ' us');
  console.log('    100 stripped: ' + (mixed * 1000).toFixed(0) + ' ns a read = ' + mixed.toFixed(3)
    + ' ms for a THOUSAND reads (one stripped tree in ten); a tree on the list ' + (hit * 1000).toFixed(0)
    + ' ns, one not on it ' + (miss * 1000).toFixed(0) + ' ns');
  // with the list full it is the same work: one lookup is one lookup
  strippedLoad([]);
  for (let i = 0; i < STRIP.max; i++) stripTree('earth', ...P(i), STRIP.full * 50, 0, 0, 1);
  const full = timeOf(20000, (i) => bareAt('earth', ...P(i % STRIP.max)));
  console.log('    ' + STRIP.max + ' stripped (the list full): ' + (full * 1000).toFixed(0) + ' ns a read = '
    + full.toFixed(3) + ' ms for a thousand reads');
  assert.ok(full < 2, 'six times the trees is not six times the work: ' + full.toFixed(3) + ' us');
  // and a frame of regrowth over the whole list
  const step = timeOf(2000, () => stripStep(1 / 60));
  console.log('    one frame of coming back into leaf, ' + STRIP.max + ' trees: ' + step.toFixed(3) + ' ms');
  strippedLoad([]);
});
