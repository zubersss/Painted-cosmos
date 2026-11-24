// The trees to 30 a second (?trees2=, 2026-11-24; docs/lead/TREES-DESIGN.md on r2, package T2). OWNER: PAINTER.
// Run: node --test src/world/
// What these hold, each because breaking it would change the owner's chosen trees without anyone seeing it:
//   1. THE SAME TREE. With ?trees2 the grove kits draw every random number they drew before, in the same order, so the
//      trunk, the boughs and where the clumps of leaves hang are the very ones of today's tree. Only what is laid on
//      them changes: the hair twigs go, a side goes from every tube.
//   2. THE SPLIT KEEPS THE LEAVES. ?trees2=split changes no leaf: same count, same places, same numbers.
//   3. A CARD CARRIES ITS OWN FRAME. A card's six corners agree on its centre and its radius (the shader reads the
//      card's whole frame from any one corner), and the frame read back from a corner is square and the right size.
//   4. THE WOOD CAN BE PINCHED. With Builder.axis every ring of a tube carries its centre, at the radius it was laid at.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const three = pathToFileURL(path.resolve(here, '../../vendor/three/three.module.js')).href;
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier === 'three') return { url: '${three}', shortCircuit: true };
  return next(specifier, context);
}`), import.meta.url);

const { GROVE, grow } = await import('./kits/grove.js');
const parts = (g) => { const d = g.attributes.aData.array, n = {}; for (let i = 1; i < d.length; i += 4) n[d[i]] = (n[d[i]] || 0) + 1; return n; };
const leafSig = (g) => {
  const d = g.attributes.aData.array, c = g.attributes.aCard.array, out = [];
  for (let v = 0; v < d.length / 4; v++) if (d[v * 4 + 1] > 4.5) out.push([c[v * 3], c[v * 3 + 1], c[v * 3 + 2], d[v * 4 + 3]].map((x) => x.toFixed(5)).join(','));
  return out;
};
// the trunk's own vertices: the first tube a grove tree lays (part 0, shade 0.2)
const trunkTop = (g) => { const p = g.attributes.position.array, d = g.attributes.aData.array; let y = -1e9; for (let v = 0; v < d.length / 4; v++) if (d[v * 4 + 1] < 0.5 && Math.abs(d[v * 4 + 2] - 0.2) < 1e-6) y = Math.max(y, p[v * 3 + 1]); return y; };

test('trees2=split: the same leaves, the same trunk, fewer wood triangles', () => {
  for (const k of Object.keys(GROVE)) for (const seed of [11, 12, 13]) {
    const a = grow(GROVE[k], seed, 0, { oilLook: 1, double: 1 }), b = grow(GROVE[k], seed, 0, { oilLook: 1, double: 1, trees2: 'split' });
    assert.deepEqual(leafSig(b), leafSig(a), `${k} seed ${seed}: the leaves moved`);
    // (a side fewer on the trunk moves its top ring's highest vertex by a few centimetres; the stem itself is the same)
    assert.ok(Math.abs(trunkTop(a) - trunkTop(b)) < 0.05, `${k} seed ${seed}: the trunk changed height`);
    assert.ok(b.index.count < a.index.count, `${k} seed ${seed}: no triangles saved`);
  }
});

test('trees2=cards: cards hang where the clumps hung; each card agrees on its frame', () => {
  for (const k of Object.keys(GROVE)) for (const seed of [11, 12]) {
    const a = grow(GROVE[k], seed, 0, { oilLook: 1, double: 1, trees2: 'split' }), b = grow(GROVE[k], seed, 0, { oilLook: 1, double: 1, trees2: 'cards' });
    const pb = parts(b);
    assert.ok(pb[7] > 0 && !pb[5], `${k}: cards and no single leaves (${JSON.stringify(pb)})`);
    assert.equal(trunkTop(a), trunkTop(b), `${k}: the trunk changed`);
    const pos = b.attributes.position.array, nrm = b.attributes.normal.array, uv = b.attributes.uv.array, crd = b.attributes.aCard.array, d = b.attributes.aData.array;
    const cards = new Map();
    for (let v = 0; v < d.length / 4; v++) {
      if (d[v * 4 + 1] < 6.5) continue;
      const key = [crd[v * 3], crd[v * 3 + 1], crd[v * 3 + 2]].join(',');
      (cards.get(key) || cards.set(key, []).get(key)).push(v);
    }
    for (const vs of cards.values()) {
      assert.equal(vs.length % 6, 0, `${k}: a card is six corners`);
      const R = Math.hypot(uv[vs[0] * 2], uv[vs[0] * 2 + 1]);
      for (const v of vs.slice(0, 6)) {
        assert.ok(Math.abs(Math.hypot(uv[v * 2], uv[v * 2 + 1]) - R) < 1e-4, `${k}: corners disagree on the radius`);
        // the frame read back as the shader reads it (materials.js PROP_VERT, PC_TREE_CARD)
        const dx = pos[v * 3] - crd[v * 3], dy = pos[v * 3 + 1] - crd[v * 3 + 1], dz = pos[v * 3 + 2] - crd[v * 3 + 2];
        const nx = nrm[v * 3], ny = nrm[v * 3 + 1], nz = nrm[v * 3 + 2], u = uv[v * 2], w = uv[v * 2 + 1], q2 = u * u + w * w;
        const cx = ny * dz - nz * dy, cy = nz * dx - nx * dz, cz = nx * dy - ny * dx;
        const U = [(u * dx - w * cx) / q2, (u * dy - w * cy) / q2, (u * dz - w * cz) / q2];
        const cell = GROVE[k].leafLen / 1.8;
        assert.ok(Math.abs(Math.hypot(...U) - cell) < 1e-3, `${k}: the frame's axis is not one cell long (${Math.hypot(...U)} against ${cell})`);
        assert.ok(Math.abs(U[0] * nx + U[1] * ny + U[2] * nz) < 1e-3, `${k}: the frame's axis is not in the card`);
      }
    }
  }
});

test('Builder.axis: a ring carries its centre, every vertex at the ring\'s radius from it', () => {
  const g = grow(GROVE.oak, 11, 0, { oilLook: 1, double: 1, trees2: 'split' });
  const p = g.attributes.position.array, c = g.attributes.aCard.array, d = g.attributes.aData.array;
  let wood = 0, moved = 0;
  for (let v = 0; v < d.length / 4; v++) {
    if (d[v * 4 + 1] > 0.5) continue;
    wood++;
    const r = Math.hypot(p[v * 3] - c[v * 3], p[v * 3 + 1] - c[v * 3 + 1], p[v * 3 + 2] - c[v * 3 + 2]);
    if (r > 1e-6) moved++;
    assert.ok(r < 2, 'a ring centre more than 2 m from its vertex');
  }
  assert.equal(moved, wood, 'every wood vertex carries its ring centre, not its own place');
  const off = grow(GROVE.oak, 11, 0, { oilLook: 1, double: 1 });
  const p2 = off.attributes.position.array, c2 = off.attributes.aCard.array, d2 = off.attributes.aData.array;
  for (let v = 0; v < d2.length / 4; v++) if (d2[v * 4 + 1] < 0.5) assert.equal(c2[v * 3], p2[v * 3], 'without ?trees2 the wood keeps its own place in aCard');
});
