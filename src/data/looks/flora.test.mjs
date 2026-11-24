// Painted Cosmos: THE GUARD ON THE FLOWER DATA (the flora lane). Run it with
//   node --test src/data/looks/flora.test.mjs
// Each biome's `oil.flora` (src/data/looks/<world>.js) is read by world/bloom.js and world/nearground.js, and a mistake
// in it shows only as a flower missing from a picture: a shape the near ring has no head for, a colour outside 0..1, a
// window on the year that never opens. Each fails here, in Node, with no browser. It also holds the promise the year
// makes (FLORA-DESIGN 5.1, the coordinator's ruling of 24 Nov): every place keeps a bold kind in flower in every season.
import { test } from 'node:test';
import assert from 'node:assert';
import { MODE, overlayOil } from '../mode.js';

MODE.oil = true;
const { LOOKS } = await import('../looks.js');
overlayOil(LOOKS);
const { SHAPES, inFlower } = await import('../../world/bloom.js');

const floras = [];
for (const [world, L] of Object.entries(LOOKS)) {
  for (const b of (L && L.biomes) || []) {
    const f = b.oil && b.oil.flora;
    if (f && f.blooms && f.blooms.length) floras.push({ where: world + '/' + (b.name || b.id || '?'), f });
  }
}
const isCol = (c) => Array.isArray(c) && c.length === 3 && c.every((v) => Number.isFinite(v) && v >= 0 && v <= 1);
const isPair = (r) => Array.isArray(r) && r.length === 2 && r.every(Number.isFinite);

test('there are flowers to guard', () => {
  assert.ok(floras.length >= 6, 'expected the six Earth biomes with flowers, found ' + floras.length);
});

test('every flower kind is drawable', () => {
  for (const { where, f } of floras) {
    for (const b of f.blooms) {
      const n = where + ' ' + b.kind;
      assert.ok(typeof b.kind === 'string' && b.kind, n + ': a name');
      assert.ok(b.shape in SHAPES, n + ': shape ' + b.shape + ' has no head in the near ring');
      assert.ok(isCol(b.c), n + ': colour');
      if (b.eye) assert.ok(isCol(b.eye), n + ': eye colour');
      if (b.body) assert.ok(isCol(b.body), n + ': body colour');
      for (const k of ['head', 'stalk', 'heads']) assert.ok(isPair(b[k]) && b[k][0] <= b[k][1] && b[k][0] >= 0, n + ': ' + k);
      assert.ok(b.drift > 0 && b.peak > 0, n + ': drift and peak');
      if (b.hab) for (const [k, r] of Object.entries(b.hab)) assert.ok(isPair(r), n + ': hab.' + k);
      if (b.season) {
        assert.ok(isPair(b.season) && b.season[0] >= 0 && b.season[1] <= 1 && b.season[0] < b.season[1], n + ': season window');
        // (in sevenths, as the shader carries it: a window that rounds shut never flowers)
        assert.ok(Math.round(b.season[1] * 7) > Math.round(b.season[0] * 7), n + ': season window rounds shut in sevenths');
      }
    }
  }
});

test('no flower head at the cloak\'s blue (LOOK-RULES R2.5: hue 210-240 at S over 0.45 is the cloak\'s alone)', () => {
  const hs = (c) => { const mx = Math.max(...c), mn = Math.min(...c), d = mx - mn; if (d < 1e-6) return [0, 0];
    let h = mx === c[0] ? ((c[1] - c[2]) / d) % 6 : mx === c[1] ? (c[2] - c[0]) / d + 2 : (c[0] - c[1]) / d + 4; h *= 60; if (h < 0) h += 360; return [h, d / mx]; };
  for (const { where, f } of floras) for (const b of f.blooms) for (const k of ['c', 'eye']) {
    if (!b[k]) continue;
    const [h, sat] = hs(b[k]);
    assert.ok(!(h >= 210 && h <= 240 && sat > 0.45), where + ' ' + b.kind + '.' + k + ' at hue ' + h.toFixed(0) + ' S ' + sat.toFixed(2) + ': the cloak\'s blue');
  }
});

test('the year: a kind with no window is always in flower, and a window opens and closes', () => {
  for (let t = 0; t <= 1.0001; t += 0.05) assert.strictEqual(inFlower(null, t), 1);
  assert.strictEqual(inFlower([0, 1], 0.5), 1);
  assert.strictEqual(inFlower([0, 0.45], 0), 1);
  assert.strictEqual(inFlower([0, 0.45], 1), 0);
  assert.strictEqual(inFlower([0.45, 1], 0), 0);
  assert.strictEqual(inFlower([0.45, 1], 1), 1);
});

test('the year: every place keeps a BOLD kind fully in flower at every point of the year', () => {
  // (the coordinator's ruling, 24 Nov: "no place may ever be flowerless near the eye in any season: every place keeps a
  // bold kind in flower in every season", with season-true kinds)
  for (const { where, f } of floras) {
    const bold = f.blooms.filter((b) => b.bold);
    assert.ok(bold.length >= 2, where + ': fewer than two bold kinds');
    for (let t = 0; t <= 1.0001; t += 1 / 28) {
      const best = Math.max(...bold.map((b) => inFlower(b.season, t)));
      assert.ok(best >= 0.99, where + ': no bold kind fully in flower at year ' + t.toFixed(2));
    }
  }
});

test('the year: a kind\'s window packs into the six bits above its colour and reads back as the shader reads it', () => {
  // (world/nearground.js packYear and materials.js NEAR_VERT: a = round(from * 7), e = round(to * 7), w = a * 8 + 7 - e)
  for (const { f } of floras) for (const b of f.blooms) {
    if (!b.season) continue;
    const a = Math.round(b.season[0] * 7), e = Math.round(b.season[1] * 7), w = a * 8 + (7 - e);
    assert.ok(w >= 0 && w <= 63);
    const tone = 262143 + w * 262144;                   // the largest colour under it
    assert.ok(tone < 2 ** 24, 'exact in a 32-bit float');
    const yw = Math.floor(tone / 262144), tn = tone - yw * 262144;
    assert.strictEqual(yw, w); assert.strictEqual(tn, 262143);
    assert.ok(Math.abs(Math.floor(yw / 8) / 7 - a / 7) < 1e-9 && Math.abs(1 - (yw % 8) / 7 - e / 7) < 1e-9);
  }
});
