// The sketchbook's pictures: the store keeps them beside the save, inside a size budget, and
// no storage failure can throw into the game.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SketchStore, SKETCH, SKETCH_KEY, biomeKey, vistaKey, sketchHand } from '../src/core/sketches.js';
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

// ---- M4: the sketch's hand (PAINTER's critique of PILOT, item 2: "the sketchbook keeps screenshots") ----
test('M4 a kept frame is drawn as a sketch: washes and pencil, lifted to paper at a ragged edge, no rectangle', () => {
  const w = SKETCH.width, h = SKETCH.height;
  // a frame: a blue sky over a green land with a dark wood on the left and a red thing in the middle
  const frame = () => {
    const px = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const o = 4 * (y * w + x), sky = y < 44, wood = !sky && x < 70 && y < 70, thing = Math.hypot(x - 110, y - 64) < 7;
      const c = thing ? [190, 60, 40] : wood ? [30, 60, 34] : sky ? [150, 190, 232] : [112, 150, 70];
      px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255;
    }
    return px;
  };
  const a = sketchHand(frame(), w, h, 5), b = sketchHand(frame(), w, h, 5), c = sketchHand(frame(), w, h, 6), src = frame();
  assert.deepEqual(a, b, 'the same frame and seed give the same sketch');
  assert.notDeepEqual(a, c, 'another page has another ragged edge');
  const at = (px, x, y) => [px[4 * (y * w + x)], px[4 * (y * w + x) + 1], px[4 * (y * w + x) + 2]];
  // the border is bare paper all the way round (white: the page multiplies it onto its paper)
  let border = 0, borderN = 0;
  for (let x = 0; x < w; x++) for (const y of [0, 1, h - 2, h - 1]) { borderN++; if (Math.min(...at(a, x, y)) >= 250) border++; }
  for (let y = 0; y < h; y++) for (const x of [0, 1, w - 2, w - 1]) { borderN++; if (Math.min(...at(a, x, y)) >= 250) border++; }
  assert.equal(border, borderN, 'no pixel of the border carries ink: there is no rectangle');
  // the edge is ragged: along a line a little way in, some of it is paper and some is not
  let paper = 0;
  for (let x = 10; x < w - 10; x++) if (Math.min(...at(a, x, 9)) >= 250) paper++;
  assert.ok(paper > 8 && paper < w - 28, `the edge wanders: ${paper} of ${w - 20} pixels of row 9 are paper`);
  // inside: the wood is darker than the land, the land darker than the sky (the tones are kept)
  const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  const wood = lum(at(a, 40, 58)), land = lum(at(a, 150, 80)), sky = lum(at(a, 96, 26));
  assert.ok(wood < land - 12 && land < sky - 12, `wood ${wood.toFixed(0)} < land ${land.toFixed(0)} < sky ${sky.toFixed(0)}`);
  assert.ok(sky > 225, 'the lights are left as paper: ' + sky.toFixed(0));
  // the colour is mostly ink: far less saturated than the frame
  const sat = (c) => (Math.max(...c) - Math.min(...c)) / Math.max(1, Math.max(...c));
  assert.ok(sat(at(a, 150, 80)) < 0.55 * sat(at(src, 150, 80)), `the land's colour ${sat(at(a, 150, 80)).toFixed(2)} of ${sat(at(src, 150, 80)).toFixed(2)}`);
  // a pencil line where the frame has an edge: the wood's edge against the land is darker than the wash either side
  let line = 255;
  for (let x = 66; x <= 74; x++) line = Math.min(line, lum(at(a, x, 60)));
  assert.ok(line < Math.min(wood, land) - 6, `a pencil line at the wood's edge: ${line.toFixed(0)} against ${wood.toFixed(0)} and ${land.toFixed(0)}`);
});
