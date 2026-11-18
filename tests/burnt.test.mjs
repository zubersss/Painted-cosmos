// Fire's lasting record (src/data/burnt.js): the scorched ground, the burnt crowns, the melted ice, and the saved
// game that keeps them. The fire itself is not here — this proves only the record and how fast it answers.
// Run: node --test tests/burnt.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BURN, BURNT, MARK,
  scorch, charMore, burntAt, scorchesOn,
  burnCrown, burntCrownAt, burningOn, burntCrownsOn,
  meltIce, deepenMelt, meltedAt, meltedBare, meltedThrough, meltsOn,
  burntRows, burntLoad,
} from '../src/data/burnt.js';

const R = 6371000;            // a place on an Earth-sized body, in the body's own coordinates
const P = (e = 0, n = 0) => [100 + e, R, 200 + n];     // a point e metres east and n metres north of our test place
// Microseconds for one go of fn, as the quickest of five runs of n. (The quickest, because a single run of a
// thousand was measured anywhere between 0.26 and 3.9 microseconds a read on this machine: the browser tidying up
// behind us, or the first runs going before the engine has settled. The quickest run is the one that says what the
// work itself costs.)
const timeOf = (n, fn) => {
  let best = Infinity;
  for (let r = 0; r < 5; r++) {
    for (let i = 0; i < n; i++) fn(i);                 // (a warm-up run, then a timed one)
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < n; i++) fn(i);
    const each = Number(process.hrtime.bigint() - t0) / 1000 / n;
    if (each < best) best = each;
  }
  return best;
};

test('nothing has burned: every reader answers at once and the record is empty', () => {
  burntLoad([]);
  assert.equal(BURNT.size, 0); assert.equal(BURNT.scorches, 0); assert.equal(BURNT.melts, 0); assert.equal(BURNT.crowns, 0);
  assert.equal(burntAt('earth', ...P()), 0);
  assert.equal(meltedAt('earth', ...P()), 0);
  assert.equal(meltedBare('earth', ...P()), 0);
  assert.equal(meltedThrough('earth', ...P()), false);
  assert.equal(burntCrownAt('earth', ...P()), null);
  assert.deepEqual(scorchesOn('earth'), []); assert.deepEqual(meltsOn('earth'), []); assert.deepEqual(burntCrownsOn('earth'), []);
  const each = timeOf(10000, (i) => burntAt('earth', 100 + i, R, 200));
  assert.ok(each < 1, 'a read of an empty record is nothing at all: ' + each.toFixed(4) + ' us');
  console.log('    empty record: ' + (each * 1000).toFixed(1) + ' ns a read');
});

test('burnt ground: it is kept, read back, soft at its edge, and its neighbours are clean', () => {
  burntLoad([]);
  const v0 = BURNT.version;
  const m = scorch('earth', ...P(), 3, 1);
  assert.ok(m && m.kind === MARK.ground && m.r === 3 && m.c === 1);
  assert.equal(BURNT.scorches, 1); assert.equal(BURNT.size, 1); assert.ok(BURNT.version > v0);
  assert.equal(burntAt('earth', ...P()), 1, 'black in the middle');
  assert.ok(burntAt('earth', ...P(2.2)) > 0 && burntAt('earth', ...P(2.2)) < 1, 'fading toward its rim');
  assert.equal(burntAt('earth', ...P(3.1)), 0, 'and clean just outside it');
  assert.equal(burntAt('earth', ...P(40)), 0, 'a neighbour forty metres off is untouched');
  assert.equal(burntAt('mars', ...P()), 0, 'another body, another ground');
  assert.equal(burntAt('earth', 100, R + 60, 200), 0, 'and sixty metres up in the air there is no floor to be burnt');
  // a fire that sits where it is only ever blackens the place
  burntLoad([]);
  const s = scorch('earth', ...P(), 3, 0.2);
  assert.ok(Math.abs(burntAt('earth', ...P()) - 0.2) < 1e-9, 'singed, not black');
  scorch('earth', ...P(), 3, 0.1);
  assert.ok(Math.abs(s.c - 0.2) < 1e-9, 'a weaker burn does not clean it');
  assert.ok(Math.abs(charMore(s, BURN.charTime * 0.5) - 0.7) < 1e-9, 'half the charring time darkens it by half');
  charMore(s, BURN.charTime * 10);
  assert.equal(s.c, 1, 'and it never goes past black');
  // A fire creeping along does not leave a thousand circles: the mark it has already made RUNS ON ALONG ITS LINE,
  // until the stroke is as long as one stroke may be. (Before 2026-11-18 a creeping mark was a circle grown about
  // the place that caught first, which blackened the ground to every side of the path as well.)
  burntLoad([]);
  const a = scorch('earth', ...P(), 3);
  for (let i = 1; i <= 8; i++) scorch('earth', ...P(i), 3);      // a metre at a time along the ground, due east
  const lenOf = (k) => Math.hypot(k.x2 - k.x, k.y2 - k.y, k.z2 - k.z);
  assert.equal(BURNT.scorches, 1, 'one mark, run on to ' + lenOf(a).toFixed(1) + ' m');
  assert.ok(Math.abs(lenOf(a) - 8) < 1e-6, 'as long as the fire crept, and no longer: ' + lenOf(a).toFixed(2) + ' m');
  assert.equal(a.r, 3, 'and no wider than the flame that made it');
  assert.ok(burntAt('earth', ...P(6)) > 0, 'the whole crept-over strip reads burnt');
  // THE FAULT THIS SHAPE FIXES: the ground beside the path, which the fire never came near, is not blackened.
  assert.equal(burntAt('earth', ...P(4, 3.1)), 0, 'three metres to the side of a strip eight metres long is clean');
  assert.equal(burntAt('earth', ...P(-3.1)), 0, 'and so is the ground behind where it started');
  for (let i = 9; i <= 40; i++) scorch('earth', ...P(i), 3);     // on across the ground
  assert.ok(BURNT.scorches > 1 && BURNT.scorches < 12, 'a long fire front is a few strokes, not one blot and not forty: ' + BURNT.scorches);
  assert.ok(scorchesOn('earth').every((k) => k.r <= BURN.scorchWide && lenOf(k) <= BURN.scorchLong + 1e-6),
    'none of them wider or longer than a scorch may be');
  assert.ok(burntAt('earth', ...P(25)) > 0, 'and the far end of the strip is burnt too');
  assert.deepEqual(scorchesOn('mars'), [], 'nothing on another body');
  // A fire that turns a corner starts another mark, rather than swinging one stroke over ground nothing burned.
  burntLoad([]);
  for (let i = 0; i <= 6; i++) scorch('earth', ...P(i), 2);       // east for six metres
  assert.equal(BURNT.scorches, 1);
  for (let i = 1; i <= 6; i++) scorch('earth', ...P(6, i), 2);    // then north for six
  assert.equal(BURNT.scorches, 2, 'the corner is two strokes: ' + BURNT.scorches);
  assert.equal(burntAt('earth', ...P(1, 5)), 0, 'and the inside of the corner, never burned, is clean');
  assert.ok(burntAt('earth', ...P(3)) > 0 && burntAt('earth', ...P(6, 3)) > 0, 'while both arms of it are burnt');
  // A mark is filed in every cell its box reaches into, so a cell can hold a mark that never comes near it, and two
  // marks can share a cell. Every reader measures the real distance to each mark it finds, so neither leaves a place
  // reading burnt when it is not. (This is also what makes it harmless that two far-apart cells can land on the same
  // cell number.)
  burntLoad([]);
  const wide = scorch('earth', ...P(), BURN.scorchWide, 1);
  for (let i = 1; i <= BURN.scorchLong; i++) scorch('earth', ...P(i), BURN.scorchWide);
  assert.equal(wide.r, BURN.scorchWide);
  assert.equal(BURNT.scorches, 1, 'one stroke as long and as wide as a scorch may be');
  assert.equal(burntAt('earth', ...P(-5.1)), 0, 'a corner of its box, past the end of the stroke, is not burnt');
  assert.equal(burntAt('earth', ...P(9, 5.1)), 0, 'nor a hand past its side');
  assert.ok(burntAt('earth', ...P(9, 4.5)) > 0, 'but four and a half metres out to the side of it is burnt');
  assert.ok(burntAt('earth', ...P(BURN.scorchLong + 4.5)) > 0, 'and so is the round cap at its far end');
  burntLoad([]);
  scorch('earth', ...P(), 2, 1);                     // two marks eight metres apart: one cell holds both
  scorch('earth', ...P(8), 2, 0.4);
  assert.equal(BURNT.scorches, 2);
  assert.equal(burntAt('earth', ...P()), 1, 'each place reads its own mark');
  assert.ok(Math.abs(burntAt('earth', ...P(8)) - 0.4) < 1e-9);
  assert.equal(burntAt('earth', ...P(4)), 0, 'and the gap between them is not burnt');
  // nonsense places are refused outright
  burntLoad([]);
  assert.equal(scorch('earth', NaN, R, 200), null);
  assert.equal(scorch('earth', ...P(60), 0), null, 'a scorch of no width is no scorch');
  burntLoad([]);
});

test('burnt leaves: one tree, known again by its own place, and bare when it is done', () => {
  burntLoad([]);
  const tree = ['earth', 10.5, 20.25, 6371000.5];
  const B = burnCrown(...tree, BURN.crownTime * 0.5);
  assert.ok(B && BURNT.crowns === 1);
  assert.ok(Math.abs(B.c + 0.5) < 1e-9, 'it has not caught yet: the fire is still climbing it');
  assert.equal(burnCrown(...tree), null, 'a crown does not burn twice');
  assert.equal(burntCrownAt(...tree), B, 'known again by the three numbers of its place');
  assert.equal(burntCrownAt('mars', 10.5, 20.25, 6371000.5), null, 'another body, another tree');
  assert.equal(burntCrownAt('earth', 10.5, 20.25, 6371000.4), null, 'and a tree a tenth of a metre off is a different tree');
  assert.deepEqual(burningOn('earth'), [B]); assert.deepEqual(burningOn('mars'), []);
  assert.deepEqual(burntCrownsOn('earth'), [B]);
  B.c = 1;                                          // (the world steps this, as it steps a felled tree's fall)
  assert.deepEqual(burningOn('earth'), [], 'a crown that is done burning is no longer stepped');
  assert.deepEqual(burntCrownsOn('earth'), [B], 'but it is still a burnt crown');
  burntLoad([]);
});

test('melted ice: it deepens, it stops on ground, and where there is no ground it keeps going', () => {
  burntLoad([]);
  // ice four metres thick over ground
  const m = meltIce('earth', ...P(), 3, 4);
  assert.ok(m && m.kind === MARK.melt && m.floor === 4 && m.d === 0);
  assert.equal(BURNT.melts, 1);
  assert.equal(meltedAt('earth', ...P()), 0, 'nothing melted yet');
  assert.equal(deepenMelt(m, 1.5), 1.5);
  assert.ok(Math.abs(meltedAt('earth', ...P()) - 1.5) < 1e-9, 'a metre and a half of ice gone in the middle');
  assert.ok(meltedAt('earth', ...P(2.2)) < 1.5 && meltedAt('earth', ...P(2.2)) > 0, 'and less at its edge: the ice dips into a bowl');
  assert.equal(meltedAt('earth', ...P(3.1)), 0, 'outside it the ice is whole');
  assert.ok(Math.abs(meltedBare('earth', ...P()) - 1.5 / 4) < 1e-9, 'the ground is not yet bare, but it is nearer');
  assert.equal(deepenMelt(m, 90), 4, 'the melt stops where the ground is');
  assert.equal(meltedBare('earth', ...P()), 1, 'and the ground is bare');
  assert.equal(meltedThrough('earth', ...P()), false, 'it is not a hole: there is ground under it');
  // ice with nothing under it: it just keeps melting away (the owner's words)
  burntLoad([]);
  const h = meltIce('earth', ...P(), 3);
  assert.equal(h.floor, -1, 'no ground under this ice');
  assert.equal(deepenMelt(h, 30), 30, 'thirty metres down and still going');
  assert.equal(deepenMelt(h, 1e6), BURN.deep, 'as far down as we remember, and no further');
  assert.equal(meltedBare('earth', ...P()), 0, 'there is no ground to reveal');
  assert.equal(meltedThrough('earth', ...P()), true, 'it is a hole');
  assert.equal(deepenMelt(h, -5), BURN.deep, 'ice does not come back');
  // a floor learned later is taken; a floor already known is not thrown away by a caller that says -1
  burntLoad([]);
  const k = meltIce('earth', ...P(), 3);
  meltIce('earth', ...P(), 3, 6);
  assert.equal(k.floor, 6, 'the ground under it is now known');
  meltIce('earth', ...P(), 3, -1);
  assert.equal(k.floor, 6, 'and a later guess of "no ground" cannot take it away');
  assert.equal(meltsOn('earth').length, 1, 'all of that was one melted place');
  assert.equal(deepenMelt(null, 5), 0, 'and nothing at all melts nothing');
  burntLoad([]);
});

test('the three kinds do not read as each other', () => {
  burntLoad([]);
  scorch('earth', ...P(), 3, 1);
  meltIce('earth', ...P(60), 3, 2);
  assert.equal(meltedAt('earth', ...P()), 0, 'burnt ground is not melted ice');
  assert.equal(burntAt('earth', ...P(60)), 0, 'and melted ice is not burnt ground');
  assert.equal(BURNT.size, 2); assert.equal(BURNT.scorches, 1); assert.equal(BURNT.melts, 1);
  burntLoad([]);
});

test('the list is capped and the oldest marks are forgotten first', () => {
  burntLoad([]);
  const far = (i) => [100 + i * 40, R, 200];          // forty metres apart, so none of them touches another
  for (let i = 0; i < BURN.max + 10; i++) scorch('earth', ...far(i), 3);
  assert.equal(BURNT.scorches, BURN.max, 'no more than the record holds: ' + BURNT.scorches);
  assert.equal(burntAt('earth', ...far(0)), 0, 'the first place burnt is clean again');
  assert.equal(burntAt('earth', ...far(9)), 0);
  assert.equal(burntAt('earth', ...far(10)), 1, 'and the rest are still burnt');
  assert.equal(burntAt('earth', ...far(BURN.max + 9)), 1);
  assert.equal(scorchesOn('earth').length, BURN.max, 'the filing agrees with the count');
  // the melted places share that cap with the burnt ground; the crowns have their own
  burntLoad([]);
  for (let i = 0; i < BURN.maxCrowns + 5; i++) burnCrown('earth', i * 3, R, 0);
  assert.equal(BURNT.crowns, BURN.maxCrowns);
  assert.equal(burntCrownAt('earth', 0, R, 0), null, 'the first tree burnt stands green again');
  assert.ok(burntCrownAt('earth', (BURN.maxCrowns + 4) * 3, R, 0), 'the last is black');
  burntLoad([]);
});

test('a saved game keeps all three and comes back the same', () => {
  burntLoad([]);
  const tree = ['earth', 10.5, 20.25, 6371000.5];
  scorch('earth', ...P(), 3, 0.6);
  scorch('mars', 3000, 3389500, -200, 5, 1);
  for (let i = 1; i <= 9; i++) scorch('mars', 3000 + i, 3389500, -200, 5, 1);     // a stroke the fire crept along
  const m = meltIce('earth', ...P(60), 4, 6); deepenMelt(m, 2.5);
  const h = meltIce('neptune', 0, 24620000, 0, 3); deepenMelt(h, 30);
  burnCrown(...tree); burnCrown('earth', 11.5, 20.25, 6371000.5);
  const before = { ground: burntAt('earth', ...P()), melt: meltedAt('earth', ...P(60)), bare: meltedBare('earth', ...P(60)) };
  const rows = JSON.parse(JSON.stringify(burntRows()));          // as it would go through the saved game
  assert.equal(rows.length, 6);
  burntLoad([]); assert.equal(BURNT.size, 0);
  burntLoad(rows);
  assert.equal(BURNT.scorches, 2); assert.equal(BURNT.melts, 2); assert.equal(BURNT.crowns, 2);
  assert.ok(Math.abs(burntAt('earth', ...P()) - before.ground) < 1e-9, 'the burnt ground is as black as it was');
  assert.ok(Math.abs(meltedAt('earth', ...P(60)) - before.melt) < 1e-9, 'the ice is gone to the same depth');
  assert.ok(Math.abs(meltedBare('earth', ...P(60)) - before.bare) < 1e-9);
  assert.equal(meltedThrough('neptune', 0, 24620000, 0), true, 'the bottomless hole is still bottomless');
  assert.equal(burntAt('mars', 3000, 3389500, -200), 1, 'and the other body kept its own');
  // the stroke came back as a stroke, both ends of it, and nine metres along it is still burnt
  const mk = scorchesOn('mars')[0];
  assert.ok(Math.abs(Math.hypot(mk.x2 - mk.x, mk.y2 - mk.y, mk.z2 - mk.z) - 9) < 0.02, 'the stroke is as long as it was');
  assert.equal(burntAt('mars', 3009, 3389500, -200), 1, 'and its far end is burnt');
  const back = burntCrownAt(...tree);
  assert.ok(back && back.c === 1, 'a crown from a save has finished burning');
  assert.deepEqual(burntRows(), rows, 'saved again, it is the same save');
  // A row from a save written before marks were strokes has only eight numbers in it. It comes back as a mark whose
  // two ends are in one place, which is the plain circle it always was: nobody's saved game is thrown away.
  burntLoad([['earth', MARK.ground, 100, R, 200, 3, 1, 0]]);
  assert.equal(BURNT.scorches, 1);
  const old = scorchesOn('earth')[0];
  assert.ok(old.x2 === old.x && old.y2 === old.y && old.z2 === old.z, 'both ends in one place');
  assert.equal(burntAt('earth', 100, R, 200), 1, 'black in the middle, as it was');
  assert.equal(burntAt('earth', 103.1, R, 200), 0, 'and clean just outside its rim');
  // nothing has burned: there is nothing to put in the save (so an old saved game is what it always was)
  burntLoad([]);
  assert.deepEqual(burntRows(), []);
});

test('rubbish rows are refused, row by row', () => {
  burntLoad([]);
  const good = ['earth', MARK.ground, 100, R, 200, 3, 1, 0];
  burntLoad([
    good,
    null, 'not a row', 42, [],
    ['earth', MARK.ground, 100, R, 200, 3, 1],                    // too short
    [7, MARK.ground, 100, R, 200, 3, 1, 0],                       // no body
    ['', MARK.ground, 100, R, 200, 3, 1, 0],                      // nameless body
    ['earth', MARK.ground, 'x', R, 200, 3, 1, 0],                 // a place that is not a number
    ['earth', MARK.ground, NaN, R, 200, 3, 1, 0],
    ['earth', MARK.ground, 100, R, Infinity, 3, 1, 0],
    ['earth', 9, 100, R, 300, 3, 1, 0],                           // a kind we do not know
    ['earth', MARK.ground, 100, R, 400, 0, 1, 0],                 // no width
    ['earth', MARK.ground, 100, R, 500, -2, 1, 0],
    ['neptune', MARK.melt, 0, 24620000, 0, 3, 30, -1],            // good
    ['earth', MARK.crown, 10.5, 20.25, 6371000.5, 0, 1, 0],       // good
  ]);
  assert.equal(BURNT.scorches, 1); assert.equal(BURNT.melts, 1); assert.equal(BURNT.crowns, 1);
  assert.equal(burntAt('earth', 100, R, 200), 1, 'the good row came through');
  assert.equal(meltedAt('neptune', 0, 24620000, 0), 30);
  assert.ok(burntCrownAt('earth', 10.5, 20.25, 6371000.5));
  // a wild width or depth in a row is brought back inside what the record allows
  burntLoad([
    ['earth', MARK.ground, 100, R, 200, 1e9, 99, 0],
    ['earth', MARK.melt, 100, R, 600, 1e9, 1e9, -1],
    ['earth', MARK.melt, 100, R, 900, 3, 1e9, 2],
  ]);
  assert.ok(scorchesOn('earth')[0].r <= BURN.scorchWide, 'no scorch wider than a scorch may be');
  assert.equal(burntAt('earth', 100, R, 200), 1, 'and no blacker than black');
  const ms = meltsOn('earth');
  assert.ok(ms.every((k) => k.r <= BURN.meltWide && k.d <= BURN.deep), 'no melt deeper or wider than one may be');
  assert.equal(meltedAt('earth', 100, R, 900), 2, 'a melt on ground is no deeper than the ice was');
  // and the record survives being handed no rows at all, or something that is not a list
  burntLoad(undefined); assert.equal(BURNT.size, 0);
  burntLoad('rubbish'); assert.equal(BURNT.size, 0);
  burntLoad([]);
});

test('reading is quick with a hundred marks on the list (the world asks many times a frame)', () => {
  // a fire that has spread over a patch of ground some 300 m across: a hundred scorch marks, spaced so that they
  // stay a hundred marks and are not merged into a few. Each is a real stroke eight metres long, as a creeping
  // fire leaves, so that what is timed is the work the game will really do.
  burntLoad([]);
  const place = (i) => [100 + (i % 10) * 30, R, 200 + Math.floor(i / 10) * 30];
  for (let i = 0; i < 100; i++) for (let k = 0; k <= 8; k++) { const p = place(i); scorch('earth', p[0] + k, p[1], p[2], 3, 1); }
  assert.equal(BURNT.scorches, 100, 'a hundred marks: ' + BURNT.scorches);
  // reads spread over that patch, about a quarter of them landing on burnt ground
  const read = (i) => burntAt('earth', 100 + (i * 7.3) % 300, R, 200 + (i * 11.9) % 300);
  const many = timeOf(20000, read);
  // What the filing cells are worth: the same answer worked out the plain way, by trying every mark on the list.
  // (The same arithmetic, written out here, so the comparison is of the layout and nothing else.)
  const all = scorchesOn('earth', []);
  const flatRead = (i) => {
    const x = 100 + (i * 7.3) % 300, y = R, z = 200 + (i * 11.9) % 300;
    let best = 0;
    for (let k = 0; k < all.length; k++) {
      const m = all[k];
      if (m.bodyId !== 'earth') continue;
      // the distance to the mark's own line, which is what a capsule asks (data/burnt.js segDist2)
      const ax = x - m.x, ay = y - m.y, az = z - m.z;
      const bx = m.x2 - m.x, by = m.y2 - m.y, bz = m.z2 - m.z, bb = bx * bx + by * by + bz * bz;
      let d2;
      if (bb <= 1e-12) d2 = ax * ax + ay * ay + az * az;
      else {
        let t = (ax * bx + ay * by + az * bz) / bb;
        if (t < 0) t = 0; else if (t > 1) t = 1;
        const ex = ax - bx * t, ey = ay - by * t, ez = az - bz * t;
        d2 = ex * ex + ey * ey + ez * ez;
      }
      if (d2 >= m.r * m.r) continue;
      const d = Math.sqrt(d2), a = m.r * BURN.core;
      const t2 = d <= a ? 1 : (m.r - d) / (m.r - a);
      const v = m.c * (d <= a ? 1 : t2 * t2 * (3 - 2 * t2));
      if (v > best) best = v;
    }
    return best;
  };
  const flat = timeOf(20000, flatRead);
  for (let i = 0; i < 100; i++) assert.equal(read(i), flatRead(i), 'the quick way and the plain way give the same answer');
  console.log('    100 marks: ' + (many * 1000).toFixed(0) + ' ns a read = ' + many.toFixed(3) + ' ms for a thousand reads; trying every mark instead: ' + (flat * 1000).toFixed(0) + ' ns a read');
  assert.ok(many < 1, 'a thousand reads over a hundred marks are a fraction of a frame: ' + many.toFixed(3) + ' ms');
  assert.ok(many < flat, 'and quicker than trying every mark: ' + (flat / many).toFixed(1) + ' times');
  // and with the record full, where trying every mark would be six times worse again
  burntLoad([]);
  for (let i = 0; i < BURN.max; i++) for (let k = 0; k <= 8; k++) scorch('earth', 100 + (i % 20) * 30 + k, R, 200 + Math.floor(i / 20) * 30, 3, 1);
  assert.equal(BURNT.scorches, BURN.max);
  const full = timeOf(20000, (i) => burntAt('earth', 100 + (i * 7.3) % 600, R, 200 + (i * 11.9) % 900));
  console.log('    ' + BURN.max + ' marks (the record full): ' + (full * 1000).toFixed(0) + ' ns a read = ' + full.toFixed(3) + ' ms for a thousand reads');
  assert.ok(full < 1, 'a full record is still quick to read: ' + full.toFixed(3) + ' ms the thousand');
  assert.ok(full < many * 3 + 0.05, 'and six times the marks is not six times the work: ' + (full / many).toFixed(2) + ' times');
  burntLoad([]);
});
