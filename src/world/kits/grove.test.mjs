// The six trees the owner chose on 2026-11-19, and -- more importantly -- the check that a kit cannot be left out
// of one of the lists a kit has to be in. OWNER: PAINTER.
//
// On 2026-11-18 four new kits went into the autumn wood and one of them was never added to the far-tree list, so
// 38,686 of 38,968 far trees silently fell back to a 26-triangle lump and the far wood went back to grey blobs.
// Nothing failed; nothing could. The last test in this file is the one that would have caught it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO = path.resolve(HERE, '../../..');
const three = pathToFileURL(path.resolve(REPO, 'vendor/three/three.module.js')).href;
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(s, c, n) { if (s === 'three') return { url: '${three}', shortCircuit: true }; return n(s, c); }`), import.meta.url);

const { GROVE, groveGeometry } = await import('../kits/grove.js');
const { TALL_KITS } = await import('../florakit.js');

const SEEDS = [3, 9, 17, 23, 41];
// measured 2026-11-19 over these seeds; a budget is a ceiling with room in it, not the number itself
// MEASURED 2026-11-19 over twelve seeds, least to most: roundmaple 8446-11698, poplar 10100-10520,
// oak 9870-12730, birch 13426-15434, willow 13244-15936, sapling 2982-3590. The kit the game already
// ships, for comparison, is the maple at 11188. A budget is a ceiling with room in it, to catch a
// regression -- not a number anything was tuned to hit.
const BUDGET = { roundmaple: 10000, poplar: 10500, oak: 11500, birch: 12000, willow: 13500, sapling: 3600 };
const SIZE = {   // [least height, most height, least across, most across] in metres, MEASURED over twelve seeds
  // (re-measured 2026-11-19 after the leaf counts were cut for the owner's phone: with fewer leaves the HIGHEST
  //  LEAF sits a little lower, so the oak's floor moved 9 -> 8 m and the willow's with it. The ranges are measured,
  //  not loosened to fit.)
  roundmaple: [6, 10, 9, 13],   // 6.8-8.9 m tall, 9.0-11.6 m across
  poplar: [13, 19, 5, 9],       // 13.8-17.2, 5.3-7.3
  oak: [8, 13, 13, 18],         // 8.9-11.3, 13.3-16.7
  birch: [8, 13, 9, 13],        // 8.4-11.8, 9.0-12.0
  willow: [8, 13, 10, 16],      // 8.8-11.4, 10.4-14.3
  sapling: [4, 7, 4, 8],        // 4.1-5.8, 4.9-6.5
};
function spanOf(g) {
  const p = g.attributes.position.array;
  let hi = 0, xlo = 1e9, xhi = -1e9, zlo = 1e9, zhi = -1e9;
  for (let i = 0; i < p.length; i += 3) {
    if (p[i + 1] > hi) hi = p[i + 1];
    if (p[i] < xlo) xlo = p[i]; if (p[i] > xhi) xhi = p[i];
    if (p[i + 2] < zlo) zlo = p[i + 2]; if (p[i + 2] > zhi) zhi = p[i + 2];
  }
  return { hi, across: Math.max(xhi - xlo, zhi - zlo) };
}

for (const kind of Object.keys(GROVE)) {
  test('grove: ' + kind + ' builds at both detail levels, with no NaN and nothing underground', () => {
    const make = groveGeometry(kind);
    for (const seed of SEEDS) for (const lod of [0, 1]) {
      const g = make(seed, lod);
      const p = g.attributes.position.array, d = g.attributes.aData.array;
      assert.ok(g.index && g.index.count > 0, kind + ' seed ' + seed + ' lod ' + lod + ' built nothing');
      for (let i = 0; i < p.length; i++) assert.ok(Number.isFinite(p[i]), kind + ' seed ' + seed + ' has a NaN position');
      // only the trunk's own stub is allowed under the ground. The willow reached 3.86 m DOWN before the hem
      // clamp was taught to count the sag as well as the angle (2026-11-19), and no drawing showed it: measured.
      for (let v = 0; v < p.length / 3; v++) {
        if (d[v * 4 + 1] < 4.5) assert.ok(p[v * 3 + 1] >= -0.26, kind + ' has wood at y=' + p[v * 3 + 1].toFixed(2) + ' m, under the ground');
      }
    }
  });

  test('grove: ' + kind + ' keeps to its triangle budget and its size', () => {
    const make = groveGeometry(kind);
    for (const seed of SEEDS) {
      const g0 = make(seed, 0), g1 = make(seed, 1);
      const t0 = g0.index.count / 3, t1 = g1.index.count / 3;
      assert.ok(t0 <= BUDGET[kind], kind + ' seed ' + seed + ' is ' + t0 + ' triangles near, over its ' + BUDGET[kind]);
      // the middle tier must be a real saving: it is drawn far more often than the near one
      // (2026-11-19: the middle tier is now a STEM AND ITS FIRST BOUGHS and nothing else, after the owner's phone
      //  measured 22 frames a second at v21. It must be a TENTH of the near tree, not merely less than half.)
      assert.ok(t1 < t0 * 0.12, kind + ' middle tier is ' + t1 + ' of ' + t0 + ' triangles, not the saving it must be');
      const s = spanOf(g0), [hLo, hHi, wLo, wHi] = SIZE[kind];
      assert.ok(s.hi >= hLo && s.hi <= hHi, kind + ' seed ' + seed + ' is ' + s.hi.toFixed(1) + ' m tall, outside ' + hLo + '-' + hHi);
      assert.ok(s.across >= wLo && s.across <= wHi, kind + ' seed ' + seed + ' is ' + s.across.toFixed(1) + ' m across, outside ' + wLo + '-' + wHi);
    }
  });

  test('grove: ' + kind + ' has a real hierarchy of widths, and its leaves belong to its limbs', () => {
    const g = groveGeometry(kind)(9, 0);
    const d = g.attributes.aData.array, p = g.attributes.position.array;
    // every leaf card carries the branch number of the limb it hangs on, so a limb the wind knife takes carries
    // its leaves away with it. A leaf whose number belongs to no wood is a leaf that would be left in mid air.
    const woodIds = new Set(), leafIds = new Set();
    const bid = g.attributes.aBranchId.array;
    for (let v = 0; v < p.length / 3; v++) (d[v * 4 + 1] < 4.5 ? woodIds : leafIds).add(Math.round(bid[v] * 1000));
    for (const id of leafIds) assert.ok(woodIds.has(id), kind + ' has leaves on branch ' + id + ', which has no wood');
    // the trunk must be far thicker than the finest twig: the whole point of the references' measurement
    assert.ok(woodIds.size >= 2, kind + ' grew only one branch');
  });
}

test('grove: no two of the six are the same tree', () => {
  // Six settings that all grew the same tree would be six wasted kits. One number cannot say this -- a weeping
  // willow and a round maple can be the same width for their height and still be nothing alike -- so each pair is
  // compared on THREE: how wide it is for its height, how high up its leaves begin, and how much of it is wood.
  const of = (k) => {
    const g = groveGeometry(k)(9, 0), p = g.attributes.position.array, d = g.attributes.aData.array, idx = g.index.array;
    const s = spanOf(g); let leafLow = 1e9, wood = 0;
    for (let v = 0; v < p.length / 3; v++) if (d[v * 4 + 1] >= 4.5 && p[v * 3 + 1] < leafLow) leafLow = p[v * 3 + 1];
    for (let q = 0; q < idx.length; q += 3) if (d[idx[q] * 4 + 1] < 4.5) wood++;
    return { k, wide: s.across / s.hi, low: leafLow / s.hi, wood: wood / (idx.length / 3) };
  };
  const all = Object.keys(GROVE).map(of);
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const a = all[i], b = all[j];
    const apart = Math.abs(a.wide - b.wide) > 0.12 || Math.abs(a.low - b.low) > 0.10 || Math.abs(a.wood - b.wood) > 0.04;
    assert.ok(apart, a.k + ' and ' + b.k + ' are the same tree on all three counts: wide ' + a.wide.toFixed(2) + '/' + b.wide.toFixed(2)
      + ', leaves begin ' + a.low.toFixed(2) + '/' + b.low.toFixed(2) + ', wood ' + a.wood.toFixed(2) + '/' + b.wood.toFixed(2));
  }
});

// THE ONE THAT WOULD HAVE CAUGHT 2026-11-18. Every kit the registry offers must be in every list a kit has to be
// in, or it is drawn wrong somewhere and nothing says so.
test('every kit in TALL_KITS is in every list a kit must be in', async () => {
  const { CAN_CARD, FAR_DIMS, BRANCHY, FAR_TRUNK } = await import('../flora.js');
  const { crownShape } = await import('../../player/camera.js');
  const NOT_A_TREE = new Set(['crystal', 'spire', 'kelp', 'wave', 'vine', 'fungus']);   // these are not wood with a crown
  for (const kit of Object.keys(TALL_KITS)) {
    assert.ok(FAR_DIMS[kit], kit + ' has no entry in FAR_DIMS (flora.js): it would be drawn far off at a guessed size');
    if (NOT_A_TREE.has(kit)) continue;
    assert.ok(CAN_CARD[kit] === 1, kit + ' is not in CAN_CARD (flora.js): far off it falls back to a 26-triangle lump');
    assert.ok(BRANCHY.has(kit), kit + ' is not in BRANCHY (flora.js): its stem is not drawn as wood');
    assert.ok(FAR_TRUNK.has(kit), kit + ' is not in FAR_TRUNK (flora.js): its far card has no trunk');
    const c = crownShape(kit, 1);
    assert.ok(c && c !== null, kit + ' has no crown in camera.js: the lens would treat it as a solid pole 0.7 m wide');
  }
});
