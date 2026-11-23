// Painted Cosmos: THE GUARD ON THE ANIMAL DATA. Put this at src/data/looks/fauna.test.mjs and run it with
//   node --test src/data/looks/fauna.test.mjs
// WHY IT EXISTS. In this very folder the trees were named by ARRAY INDEX, the placer could only ever stand two
// of them, and two whole species were built at every start-up and drawn nowhere for a fortnight before anybody
// noticed (src/data/looks/earth.js, the note in the autumn wood). An animal missing from a picture is far
// harder to notice than a missing tree. So everything about the animals is named, and this file is what makes
// a name a promise: a typo in `eatenBy`, a biome standing a kind that does not exist, a kind that stands
// nowhere at all -- each of them fails here, in Node, in a second, with no browser.
import { test } from 'node:test';
import assert from 'node:assert';
import { MODE, overlayOil } from '../mode.js';
import { FAUNA_GUILDS, faunaKinds, faunaRoster, faunaLives, faunaShapes } from './common.js';

MODE.oil = true;
const { LOOKS } = await import('../looks.js');
overlayOil(LOOKS);
const E = LOOKS.earth, F = E.fauna;
const PLANS = ['walker', 'bird', 'fish', 'swarm'];
const BODY = ['high', 'legF', 'len', 'girth', 'neck', 'neckUp', 'head', 'snout', 'ear', 'earUp', 'tail', 'brush', 'horn', 'limbW', 'coat', 'marks'];
const WASHES = ['back', 'side', 'belly', 'dark', 'pale', 'mark'];

test('every name in `order` is a kind, and every kind is in `order`', () => {
  for (const id of F.order) assert.ok(F.kinds[id], 'order names "' + id + '" and there is no such kind');
  for (const id of Object.keys(F.kinds)) assert.ok(F.order.includes(id), 'kind "' + id + '" is in no order, so nothing can draw it');
  assert.equal(new Set(F.order).size, F.order.length, 'a name is in `order` twice');
});

test('every kind has a plan, a guild, a stage, a size, a weight and a coat', () => {
  for (const [id, k] of Object.entries(F.kinds)) {
    assert.ok(FAUNA_GUILDS.includes(k.guild), id + ': guild "' + k.guild + '" is not one of the eight');
    assert.ok(PLANS.includes(k.plan), id + ': plan "' + k.plan + '" is not a body plan');
    assert.ok([1, 2, 3].includes(k.stage), id + ': stage must be 1, 2 or 3');
    assert.ok(k.high > 0, id + ': no height');
    assert.ok(k.mass > 0, id + ': no mass');
    assert.ok(k.col && k.col.back && k.col.dark, id + ': no coat');
    for (const [f, c] of Object.entries(k.col)) {
      assert.ok(Array.isArray(c) && c.length === 3 && c.every((v) => v >= 0 && v <= 1), id + ': col.' + f + ' is not three numbers in 0..1');
    }
    if (k.hab) assert.ok(k.hab.length === 4 && k.hab.every((v) => v >= 0 && v <= 1), id + ': hab is not four numbers in 0..1');
    if (k.group) assert.ok(k.group[0] >= 1 && k.group[1] >= k.group[0], id + ': group ' + k.group);
    if (k.hours) assert.ok(k.hours.length === 2 && k.hours.every((h) => h >= 0 && h <= 24), id + ': hours ' + k.hours);
  }
});

test('nothing eats, is eaten by, or lives in, something that does not exist', () => {
  for (const [id, k] of Object.entries(F.kinds)) {
    for (const g of k.hunts || []) assert.ok(FAUNA_GUILDS.includes(g), id + ': hunts "' + g + '", which is not a guild');
    for (const n of k.eatenBy || []) assert.ok(F.kinds[n], id + ': eaten by "' + n + '", which is not a kind');
    for (const b of k.in || []) assert.ok(E.biomes.some((x) => x.id === b), id + ': lives in "' + b + '", which is not a biome of Earth');
    if (k.of) assert.ok(F.kinds[k.of], id + ': is an age of "' + k.of + '", which is not a kind');
    for (const n of Object.keys(k.with || {})) assert.ok(F.kinds[n], id + ': stands with "' + n + '", which is not a kind');
  }
});

test('the five built first are complete: every field a body, a gait and a painter need', () => {
  for (const id of ['deer', 'fox', 'hare', 'heron', 'trout', 'stag', 'fawn']) {
    const k = F.kinds[id];
    assert.ok(k, 'the five: no "' + id + '"');
    assert.equal(k.stage, 1, id + ': should be stage 1');
    for (const f of BODY) assert.notEqual(k[f], undefined, id + ': stage 1 and no "' + f + '"');
    for (const f of WASHES) assert.ok(k.col[f], id + ': stage 1 and no col.' + f);
  }
});

test('every biome stands only kinds that exist and that say they live there', () => {
  for (const b of E.biomes) {
    assert.ok(b.life, b.id + ': no life at all');
    for (const [n, d] of Object.entries(b.life)) {
      assert.ok(F.kinds[n], b.id + ' stands "' + n + '", which is not a kind');
      assert.ok(d > 0, b.id + ': "' + n + '" at ' + d);
      assert.ok((F.kinds[n].in || []).includes(b.id), b.id + ' stands "' + n + '" but that kind does not say it lives there');
    }
  }
});

test('no kind is built and drawn nowhere (the trap that cost a fortnight)', () => {
  const placed = new Set();
  for (const b of E.biomes) for (const n of Object.keys(b.life || {})) placed.add(n);
  for (const id of F.order) {
    if (F.kinds[id].of) continue;            // a stag stands in a deer group, not in a list of its own
    assert.ok(placed.has(id), 'kind "' + id + '" stands in no biome at all');
  }
});

test('a hunter never stands where there is nothing of its menu', () => {
  for (const b of E.biomes) {
    const here = Object.keys(b.life || {});
    for (const n of here) for (const g of F.kinds[n].hunts || []) {
      assert.ok(here.some((o) => F.kinds[o].guild === g), b.id + ': the ' + n + ' hunts ' + g + ' and nothing of that guild stands here');
    }
  }
});

test('the stage ladder only ever adds, and the index of a kind never moves', () => {
  const a = faunaKinds(E, 1), b = faunaKinds(E, 2), c = faunaKinds(E, 3);
  assert.ok(a.length <= b.length && b.length <= c.length);
  for (let i = 0; i < a.length; i++) { assert.equal(b[i].id, a[i].id); assert.equal(b[i].sp, i); }
  for (let i = 0; i < b.length; i++) { assert.equal(c[i].id, b[i].id); assert.equal(c[i].sp, i); }
});

test('the three readers give the routines, the placer and the builder what they ask for', () => {
  const kinds = faunaKinds(E, 3);
  for (const r of faunaLives(kinds)) { assert.ok(r.guild >= 0 && r.guild < FAUNA_GUILDS.length); assert.ok(r.high > 0); }
  for (const b of E.biomes) for (const row of faunaRoster(b, kinds)) {
    assert.ok(row.perKm2 > 0 && row.sp >= 0 && ['wood', 'open', 'water', 'any'].includes(row.wants), b.id + '/' + row.id);
  }
  for (const s of faunaShapes(kinds)) for (const f of BODY) assert.notEqual(s[f], undefined, s.id + ': the builder would get no "' + f + '"');
});
