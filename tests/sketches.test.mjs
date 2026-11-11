// The sketchbook's pictures: the store keeps them beside the save, inside a size budget, and
// no storage failure can throw into the game.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SketchStore, SKETCH, SKETCH_KEY, biomeKey, vistaKey } from '../src/core/sketches.js';
import { Sim } from '../src/core/sim.js';
import { stubSurface } from '../src/core/stubs/surface.js';

const pic = (n, fill = 'A') => 'data:image/jpeg;base64,' + fill.repeat(n);
function memory() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, m };
}

test('sketches are kept, read back, and survive a reload', () => {
  const st = memory();
  const a = new SketchStore(st);
  assert.equal(a.count, 0);
  assert.ok(a.put(biomeKey('earth', 'temperate_forest'), pic(5000)));
  assert.ok(a.put(vistaKey('earth', 'earth-sea_coast-1'), pic(6000, 'B')));
  assert.equal(a.count, 2);
  assert.ok(a.saved);
  assert.equal(a.get('b:earth:temperate_forest'), pic(5000));
  const b = new SketchStore(st);                       // a new visit
  assert.equal(b.count, 2);
  assert.equal(b.get('v:earth:earth-sea_coast-1'), pic(6000, 'B'));
  assert.equal(b.total, a.total);
  b.clear();
  assert.equal(b.count, 0);
  assert.equal(st.getItem(SKETCH_KEY), null);
  assert.equal(new SketchStore(st).count, 0);
});

test('what is not a small picture is refused', () => {
  const s = new SketchStore(memory());
  assert.equal(s.put('b:earth:x', 'hello'), false);
  assert.equal(s.put('b:earth:x', null), false);
  assert.equal(s.put('', pic(100)), false);
  assert.equal(s.put('b:earth:x', pic(SKETCH.maxEach + 1)), false, 'one sketch has a size limit');
  assert.equal(s.count, 0);
});

test('the total stays inside the budget: the oldest pictures go first, never the newest', () => {
  const s = new SketchStore(memory(), { maxTotal: 30000 });
  for (let i = 0; i < 10; i++) assert.ok(s.put('b:earth:' + i, pic(5000)));
  assert.ok(s.total <= 30000, 'total ' + s.total);
  assert.ok(s.has('b:earth:9') && s.has('b:earth:8'), 'the newest are kept');
  assert.ok(!s.has('b:earth:0') && !s.has('b:earth:1'), 'the oldest were dropped');
  // Drawing a page again replaces its picture without growing the total.
  const before = s.total;
  assert.ok(s.put('b:earth:9', pic(5000, 'C')));
  assert.equal(s.total, before);
  // A reload keeps the same set, in the same order of age.
  const again = new SketchStore(s.storage, { maxTotal: 30000 });
  assert.deepEqual(Object.keys(again.items).sort(), Object.keys(s.items).sort());
});

test('a storage that is full, blocked or holds rubbish never throws', () => {
  const full = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); }, removeItem: () => { throw new Error('no'); } };
  const s = new SketchStore(full);
  assert.ok(s.put('b:mars:rust_canyons', pic(4000)), 'the picture is still kept for this visit');
  assert.equal(s.saved, false);
  assert.ok(s.has('b:mars:rust_canyons'));
  s.clear();
  const angry = { getItem: () => { throw new Error('SecurityError'); }, setItem: () => { throw new Error('SecurityError'); }, removeItem: () => {} };
  assert.equal(new SketchStore(angry).count, 0);
  for (const junk of ['{', 'null', '[]', '{"version":9,"items":{}}', '{"version":1,"items":7}', JSON.stringify({ version: 1, items: { a: 1, b: { u: 'x' }, c: { u: pic(200), n: 'q' } } })]) {
    const st = memory(); st.setItem(SKETCH_KEY, junk);
    const k = new SketchStore(st);
    assert.ok(k.count <= 1, junk);                      // only the one well-formed picture survives
  }
  // A storage with room for little: the store makes room once and carries on.
  let cap = 12000;
  const small = memory();
  const tight = { getItem: small.getItem, removeItem: small.removeItem, setItem: (k, v) => { if (String(v).length > cap) throw new Error('QuotaExceededError'); small.setItem(k, v); } };
  const t = new SketchStore(tight);
  for (let i = 0; i < 6; i++) t.put('v:moon:' + i, pic(3000));
  assert.equal(t.count, 6, 'this visit keeps every picture');
  assert.ok(t.saved, 'the newest pictures reach the storage');
  assert.ok(small.getItem(SKETCH_KEY).length <= cap);
  const next = new SketchStore(tight);
  assert.ok(next.has('v:moon:5') && !next.has('v:moon:0'), 'and the next visit has the newest of them');
  assert.equal(new SketchStore(null).put('b:earth:a', pic(100)), true, 'without a storage the pictures live in memory');
});

test('the sketchbook lists every view of a world with whether it was found', () => {
  const sim = new Sim({
    sampleSurface: stubSurface,
    getVistas: (b) => [{ id: b + '-1', name: 'First', unitDir: { x: 0, y: 0, z: 1 } }, { id: b + '-2', name: 'Second', unitDir: { x: 1, y: 0, z: 0 } }],
  });
  sim.vistas.earth = { 'earth-2': true };
  const page = sim.sketchbook().find((p) => p.id === 'earth');
  assert.deepEqual(page.vistas, [{ id: 'earth-1', name: 'First', found: false }, { id: 'earth-2', name: 'Second', found: true }]);
  assert.equal(page.vistasTotal, 2);
});
