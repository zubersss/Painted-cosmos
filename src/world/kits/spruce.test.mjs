// THE SPRUCE'S SHAPE, IN NUMBERS (src/world/kits/spruce.js). Run: node --test src/world/kits/
// This tree was built where no picture can be drawn, so nothing about it has been SEEN. What is checked here instead is
// its shape as numbers, read out of the geometry itself: how many triangles it costs near and far, how tall and how
// wide it stands, that its stem reaches under the floor, how many separate limbs it has and that they fork, that the
// long low boughs end BELOW where they left the trunk while the high ones end above (the sag that makes a spruce a
// spruce), that there is clear air between one whorl and the next for the trunk to show through, that its needles are
// many and small and thicker toward the ends of the boughs, and that two seeds are two different trees.
// Everything but the whorl gaps is measured from the vertex buffers; the gaps are read from the plan the kit leaves in
// userData.spruce, which the other numbers are checked against.
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const three = pathToFileURL(path.resolve(here, '../../../vendor/three/three.module.js')).href;
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier === 'three') return { url: '${three}', shortCircuit: true };
  return next(specifier, context);
}`), import.meta.url);

const { spruceGeometry } = await import('./spruce.js');

const SEEDS = [101, 202, 303, 404, 505, 606, 707, 808];
const BARK = 0, CARD = 5;
// a bough's tube is 4 rings of 4 (3 sides, the seam vertex doubled), a fork's 3 rings of 4: so the bark vertices on one
// limb's number say how many tubes were laid on it, and (v - 16) / 12 is how many times it forked
const BOUGH_V = 16, FORK_V = 12;

// Everything the geometry says about one tree.
function read(geo) {
  const P = geo.attributes.position.array, D = geo.attributes.aData.array, Bi = geo.attributes.aBranchId.array;
  const n = geo.attributes.position.count, tris = geo.index.count / 3;
  const r = { tris, verts: n, minY: Infinity, maxY: -Infinity, wide: 0, nan: 0, barkOnTrunk: 0, limbs: new Map(), cards: [], trunkShade: [], boughShade: [], nearTrunkY: [] };
  for (const a of ['position', 'normal', 'aMass', 'uv', 'aData', 'aBranchId', 'aLeaf01', 'aCard']) {
    const arr = geo.attributes[a].array;
    for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i])) r.nan++;
  }
  for (let i = 0; i < n; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], part = D[i * 4 + 1], bid = Bi[i];
    r.minY = Math.min(r.minY, y); r.maxY = Math.max(r.maxY, y);
    r.wide = Math.max(r.wide, Math.hypot(x, z));
    if (part === BARK) {
      if (bid < 0) { r.barkOnTrunk++; r.trunkShade.push(D[i * 4 + 2]); }
      else {
        r.boughShade.push(D[i * 4 + 2]);
        const L = r.limbs.get(bid) || { verts: 0, near: Infinity, far: 0, nearY: 0, farY: 0, baseY: 0, cardsIn: 0, cardsOut: 0 };
        const rr = Math.hypot(x, z);
        L.verts++;
        if (rr < L.near) { L.near = rr; L.nearY = y; }
        if (rr > L.far) { L.far = rr; L.farY = y; }
        r.limbs.set(bid, L);
      }
    }
  }
  // the cards: leafCards lays four vertices a card, so they come in fours -- the long way across is v0 to v2 and the
  // width v1 to v3. Each card is grouped onto the limb whose reach it lies within, to see where the needles are thickest.
  const starts = [];
  for (let i = 0; i < n; i++) if (D[i * 4 + 1] === CARD) starts.push(i);
  assert.equal(starts.length % 4, 0, 'needle cards come four vertices at a time');
  for (let q = 0; q < starts.length; q += 4) {
    const a = starts[q], b = starts[q + 1], c = starts[q + 2], d = starts[q + 3];
    const len = Math.hypot(P[c * 3] - P[a * 3], P[c * 3 + 1] - P[a * 3 + 1], P[c * 3 + 2] - P[a * 3 + 2]);
    const wid = Math.hypot(P[d * 3] - P[b * 3], P[d * 3 + 1] - P[b * 3 + 1], P[d * 3 + 2] - P[b * 3 + 2]);
    const bid = Bi[a], L = r.limbs.get(bid);
    const cx = (P[a * 3] + P[c * 3]) / 2, cy = (P[a * 3 + 1] + P[c * 3 + 1]) / 2, cz = (P[a * 3 + 2] + P[c * 3 + 2]) / 2, cr = Math.hypot(cx, cz);
    if (L) { if (cr > L.far * 0.55) L.cardsOut++; else L.cardsIn++; }
    if (cr < 0.70) r.nearTrunkY.push(cy);                 // the needles that stand close in against the stem
    r.cards.push({ len, wid, y: cy, r: cr, shade: D[a * 4 + 2] });
  }
  r.nCards = r.cards.length;
  r.cardLen = r.cards.reduce((s, c) => s + c.len, 0) / Math.max(1, r.nCards);
  r.cardWid = r.cards.reduce((s, c) => s + c.wid, 0) / Math.max(1, r.nCards);
  r.cardShade = r.cards.reduce((s, c) => s + c.shade, 0) / Math.max(1, r.nCards);
  r.cardShadeMax = r.cards.reduce((s, c) => Math.max(s, c.shade), 0);
  r.cardLowest = r.cards.reduce((s, c) => Math.min(s, c.y), Infinity);
  r.nearTrunkY.sort((x, y) => x - y);
  r.forks = 0; r.unforked = 0;
  for (const L of r.limbs.values()) {
    const f = Math.round((L.verts - BOUGH_V) / FORK_V);
    L.nf = f; r.forks += Math.max(0, f);
    if (f < 1) r.unforked++;
  }
  return r;
}

const near = SEEDS.map((s) => ({ seed: s, g: spruceGeometry(s, 0), })), far = SEEDS.map((s) => ({ seed: s, g: spruceGeometry(s, 1) }));
for (const e of near.concat(far)) e.r = read(e.g);
const slender = spruceGeometry(999, 0, { slender: 1 });

test('nothing in a spruce is NaN, at any seed, near or far', () => {
  for (const e of near.concat(far)) assert.equal(e.r.nan, 0, 'seed ' + e.seed);
  assert.equal(read(slender).nan, 0);
  console.log('seeds built: ' + SEEDS.join(', ') + ' (near and far), and one slender; no NaN in any attribute');
});

test('the triangle budget: under 3000 near, under 700 far', () => {
  const t0 = near.map((e) => e.r.tris), t1 = far.map((e) => e.r.tris);
  console.log('triangles lod 0: ' + Math.min(...t0) + ' .. ' + Math.max(...t0) + '  (per seed: ' + t0.join(', ') + ')');
  console.log('triangles lod 1: ' + Math.min(...t1) + ' .. ' + Math.max(...t1) + '  (per seed: ' + t1.join(', ') + ')');
  for (const e of near) assert.ok(e.r.tris < 3000, 'seed ' + e.seed + ' lod 0: ' + e.r.tris);
  for (const e of far) assert.ok(e.r.tris < 700, 'seed ' + e.seed + ' lod 1: ' + e.r.tris);
  // and the budget is spent, not left on the table
  for (const e of near) assert.ok(e.r.tris > 2300, 'seed ' + e.seed + ' lod 0 is thin: ' + e.r.tris);
  for (const e of far) assert.ok(e.r.tris > 450, 'seed ' + e.seed + ' lod 1 is thin: ' + e.r.tris);
});

test('it stands on the ground, and it is taller than it is wide', () => {
  const hs = near.map((e) => e.r.maxY), ws = near.map((e) => e.r.wide * 2);
  console.log('height (m): ' + hs.map((h) => h.toFixed(1)).join(', '));
  console.log('width (m):  ' + ws.map((w) => w.toFixed(1)).join(', '));
  console.log('slender spec: ' + read(slender).maxY.toFixed(1) + ' m tall, ' + (read(slender).wide * 2).toFixed(1) + ' m wide');
  for (const e of near.concat(far)) {
    assert.ok(e.r.minY <= 0, 'seed ' + e.seed + ' does not reach the floor: ' + e.r.minY);
    assert.ok(e.r.maxY > 10 && e.r.maxY < 22, 'seed ' + e.seed + ' height ' + e.r.maxY);
    assert.ok(e.r.wide * 2 < e.r.maxY * 0.75, 'seed ' + e.seed + ' is too broad for a spruce');
    assert.ok(e.r.wide * 2 > e.r.maxY * 0.20, 'seed ' + e.seed + ' is too narrow to be boughed');
  }
  // the same tree far off keeps its height and nearly its girth
  for (let i = 0; i < SEEDS.length; i++) {
    assert.ok(Math.abs(near[i].r.maxY - far[i].r.maxY) < 0.9, 'seed ' + SEEDS[i] + ' changes height between the two levels');
  }
});

test('the limbs are many, they are real tubes, and they fork', () => {
  for (const e of near) {
    const u = e.g.userData.spruce;
    assert.equal(e.r.limbs.size, u.limbs, 'seed ' + e.seed + ': the plan and the geometry disagree on the number of limbs');
    assert.equal(e.r.forks, u.forks, 'seed ' + e.seed + ': the plan and the geometry disagree on the forks');
    assert.ok(e.r.limbs.size >= 24 && e.r.limbs.size <= 50, 'seed ' + e.seed + ' limbs ' + e.r.limbs.size);
    assert.equal(e.r.unforked, 0, 'seed ' + e.seed + ': ' + e.r.unforked + ' limbs carry no fork');
    assert.ok(e.r.barkOnTrunk > 40, 'seed ' + e.seed + ': the trunk is too few vertices to be a spire');
    for (const w of u.whorls) assert.ok(w.boughs >= 3 && w.boughs <= 7, 'a whorl of ' + w.boughs + ' boughs');
  }
  const l0 = near.map((e) => e.r.limbs.size), f0 = near.map((e) => e.r.forks);
  console.log('limbs (lod 0): ' + l0.join(', ') + '   forks: ' + f0.join(', '));
  console.log('limbs (lod 1): ' + far.map((e) => e.r.limbs.size).join(', ') + '   forks: ' + far.map((e) => e.r.forks).join(', ') + ' (far off a bough is one tube, no fork)');
  console.log('whorls per tree: ' + near.map((e) => e.g.userData.spruce.whorls.length).join(', ') + ' near, ' + far.map((e) => e.g.userData.spruce.whorls.length).join(', ') + ' far');
  console.log('depth of the tubes: trunk -> bough -> fork (three levels near by, two far off)');
  // far off there are still tiered boughs, just no forks
  for (const e of far) { assert.ok(e.r.limbs.size >= 10, 'seed ' + e.seed + ' far limbs ' + e.r.limbs.size); assert.equal(e.r.forks, 0); }
});

test('the long low boughs sag below their base, the short high ones rise', () => {
  let low = 0, high = 0;
  for (const e of near) {
    const H = e.r.maxY;
    for (const L of e.r.limbs.values()) {
      const dy = L.farY - L.nearY;                    // the far end of the limb against where it left the trunk
      if (L.nearY < H * 0.35) { assert.ok(dy < 0, 'a low bough at y ' + L.nearY.toFixed(1) + ' ends ' + dy.toFixed(2) + ' m above its base'); low++; }
      if (L.nearY > H * 0.70) { assert.ok(dy > 0, 'a high bough at y ' + L.nearY.toFixed(1) + ' ends ' + dy.toFixed(2) + ' m below its base'); high++; }
    }
  }
  const e0 = near[0], H0 = e0.r.maxY, rows = [];
  for (const L of e0.r.limbs.values()) rows.push({ y: L.nearY, reach: L.far, dy: L.farY - L.nearY });
  rows.sort((a, b) => a.y - b.y);
  console.log('seed ' + e0.seed + ', bough by bough (base height, reach, rise or sag of its end, m):');
  for (const q of rows) console.log('   y ' + q.y.toFixed(2).padStart(6) + '   reach ' + q.reach.toFixed(2) + '   end ' + (q.dy >= 0 ? '+' : '') + q.dy.toFixed(2));
  console.log('checked ' + low + ' low boughs sagging and ' + high + ' high boughs rising, over ' + SEEDS.length + ' seeds');
  assert.ok(low > 40 && high > 20);
});

test('there is clear air between one whorl and the next, for the trunk to show through', () => {
  // measured from the needles themselves: every needle card standing within 70 cm of the stem, by height. Between one
  // whorl and the next there should be a stretch of stem with no needle close in against it at all.
  for (const e of near) {
    const ys = e.r.nearTrunkY, bands = [];
    for (let i = 1; i < ys.length; i++) if (ys[i] - ys[i - 1] > 0.45) bands.push(+(ys[i] - ys[i - 1]).toFixed(2));
    const whorls = e.g.userData.spruce.whorls.length;
    assert.ok(bands.length >= whorls - 2, 'seed ' + e.seed + ': only ' + bands.length + ' clear stretches of stem between ' + whorls + ' whorls');
    assert.ok(bands.reduce((a, b) => a + b, 0) > e.r.maxY * 0.25, 'seed ' + e.seed + ': the stem is covered for most of its height');
    if (e === near[0]) console.log('seed ' + e.seed + ': clear stretches of stem between the whorls (m): ' + bands.join(', ') + '  -- ' + e.r.nearTrunkY.length + ' needles stand within 70 cm of it, over ' + whorls + ' whorls');
  }
  const tot = near.map((e) => {
    const ys = e.r.nearTrunkY; let n = 0, sum = 0;
    for (let i = 1; i < ys.length; i++) if (ys[i] - ys[i - 1] > 0.45) { n++; sum += ys[i] - ys[i - 1]; }
    return n + ' bands / ' + sum.toFixed(1) + ' m';
  });
  console.log('clear stem between the whorls, per seed: ' + tot.join(', '));
  // and the plan's own, stricter measure: the lowest needle of one whorl against the highest of the one below it,
  // which counts a tip hanging two metres out from the stem as if it were over the stem
  const gaps = [];
  for (const e of near) { const w = e.g.userData.spruce.whorls; for (let i = 0; i + 1 < w.length; i++) gaps.push(w[i + 1].lo - w[i].hi); }
  console.log('tip-to-tip gap, the strict measure (m): ' + Math.min(...gaps).toFixed(2) + ' .. ' + Math.max(...gaps).toFixed(2) + ' over ' + gaps.length + ' pairs');
  for (const g of gaps) assert.ok(g > -0.1, 'two whorls overlap by ' + (-g).toFixed(2) + ' m even at their tips');
});

test('the needles are laid dark, the stem is not laid as a twig', () => {
  for (const e of near) {
    // (leafCards adds its own inner shade on top of shade0; what matters is that the number stays low, so the dark is
    // the kind's own colours and not a shade piled over them)
    assert.ok(e.r.cardShade < 0.45, 'seed ' + e.seed + ' mean needle shade ' + e.r.cardShade.toFixed(2));
    assert.ok(e.r.cardShadeMax <= 1.0);
    // bark: a trunk's shade is near 0, a twig's near 1 (materials.js: over a half, a piece of bark is parted when the
    // eye comes close, which is right for a branchlet and wrong for a stem)
    for (const v of e.r.trunkShade) assert.ok(v < 0.5, 'the stem carries the shade of a twig: ' + v);
    for (const v of e.r.boughShade) assert.ok(v > 0.7, 'a bough carries the shade of a stem: ' + v);
    assert.ok(e.r.cardLowest > 0.05, 'seed ' + e.seed + ': a needle hangs into the floor at y ' + e.r.cardLowest.toFixed(2));
  }
  console.log('needle shade: mean ' + near.map((e) => e.r.cardShade.toFixed(2)).join(', ') + ' (0 = the kind\'s own colour, 1 = deep in the crown)');
  console.log('bark shade: stem ' + near[0].r.trunkShade[0].toFixed(2) + ', boughs ' + near[0].r.boughShade[0].toFixed(2) + ' (over 0.5 a piece of bark is read as a twig)');
  console.log('the lowest needle stands at y ' + Math.min(...near.map((e) => e.r.cardLowest)).toFixed(2) + ' m: the lowest boughs sweep down but not into the floor');
});

test('the needles are many small cards, thickest toward the ends of the boughs', () => {
  for (const e of near) {
    assert.equal(e.r.nCards, e.g.userData.spruce.cards, 'seed ' + e.seed + ': the plan and the geometry disagree on the needles');
    assert.ok(e.r.nCards > 450, 'seed ' + e.seed + ' needles ' + e.r.nCards);
    assert.ok(e.r.cardLen < 0.42 && e.r.cardWid < 0.14, 'seed ' + e.seed + ' needle ' + e.r.cardLen + ' x ' + e.r.cardWid);
    let out = 0, inn = 0;
    for (const L of e.r.limbs.values()) { out += L.cardsOut; inn += L.cardsIn; }
    assert.ok(out > inn, 'seed ' + e.seed + ': ' + out + ' needles on the outer half, ' + inn + ' on the inner');
  }
  for (const e of far) assert.ok(e.r.nCards > 110, 'seed ' + e.seed + ' far needles ' + e.r.nCards);
  const e0 = near[0];
  let out = 0, inn = 0;
  for (const L of e0.r.limbs.values()) { out += L.cardsOut; inn += L.cardsIn; }
  console.log('needle cards (lod 0): ' + near.map((e) => e.r.nCards).join(', '));
  console.log('needle cards (lod 1): ' + far.map((e) => e.r.nCards).join(', '));
  console.log('a needle card is ' + near[0].r.cardLen.toFixed(3) + ' x ' + near[0].r.cardWid.toFixed(3) + ' m near, ' + far[0].r.cardLen.toFixed(3) + ' x ' + far[0].r.cardWid.toFixed(3) + ' m far');
  console.log('seed ' + e0.seed + ': ' + out + ' needles on the outer half of the boughs, ' + inn + ' on the inner half');
});

test('two seeds are two different trees', () => {
  const hs = near.map((e) => +e.r.maxY.toFixed(3)), ls = near.map((e) => e.r.limbs.size), ws = near.map((e) => +e.r.wide.toFixed(3));
  assert.equal(new Set(hs).size, hs.length, 'two seeds stand the same height');
  assert.equal(new Set(ws).size, ws.length, 'two seeds stand the same width');
  assert.ok(new Set(ls).size >= 4, 'the limb counts are too alike: ' + ls.join(', '));
  // and they do not merely differ in size: the boughs leave the trunk at other angles
  const a = near[0], b = near[1];
  const ya = [...a.r.limbs.values()].map((L) => +L.nearY.toFixed(2)).sort(), yb = [...b.r.limbs.values()].map((L) => +L.nearY.toFixed(2)).sort();
  assert.notDeepEqual(ya, yb);
  console.log('heights: ' + hs.map((h) => h.toFixed(2)).join(', '));
  console.log('limb counts: ' + ls.join(', ') + '  (' + new Set(ls).size + ' different values over ' + ls.length + ' seeds)');
  console.log('widths (half, m): ' + ws.map((w) => w.toFixed(2)).join(', '));
});
