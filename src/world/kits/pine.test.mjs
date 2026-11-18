// THE TALL PINE'S SHAPE, IN NUMBERS (src/world/kits/pine.js). Run: node --test src/world/kits/*.test.mjs
// This tree was built where no picture can be drawn, so nothing about it has been SEEN. What is checked here instead
// is its shape as numbers, read out of the geometry itself: what it costs in triangles near and far, how tall and how
// wide it stands, that its trunk goes into the ground, that the lower two thirds of that trunk carries NOT ONE NEEDLE
// (the thing this kind is for), how many separate limbs there are and that each of them forks, that a limb leaves the
// trunk nearly level and turns up over its outer third, that the needles sit only at the limbs' ends and lie in FLAT
// PLATES rather than balls, that the crown is wider than it is deep and spread right round the trunk, that the dead
// low limbs are bare, that the needles are many and small, and that two seeds are two different trees.
//
// Nearly everything is measured from the vertex buffers. Two things are read from the plan the kit leaves in
// userData.tallPine, and both are then checked against the geometry: the plates' centres (used only to group the
// needle cards into plates, the extents themselves being measured) and the limbs' own tallies.
// HOW A LIMB IS FOUND IN THE BUFFERS: every tube carries one branch number (aBranchId) -- the trunk and its foot
// carry -1, and a limb, its forks and its needles all carry the limb's own number, so that the limb swings whole.
// Within one number the vertices are in the order they were laid: the limb's own tube first (4 rings of 5 vertices
// near by: 4 sides, the seam vertex doubled), then one 12-vertex tube for each fork. So the count says how many times
// a limb forked, and the first four rings give the limb's centre line back, which is what the slopes are taken from.
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

const { tallPineGeometry } = await import('./pine.js');

const SEEDS = [11, 22, 33, 44, 55, 66, 77, 88];
const BARK = 0, CARD = 5;
const LIMB_V = 20, FORK_V = 12, DEAD_V = 12;      // near by: a limb's own tube, a fork's, a dead stub's
const f32 = (v) => Math.fround(v);                // aBranchId is kept as 32-bit floats: 0.13 reads back as 0.12999999

// Everything the geometry says about one tree. `isNear` only says how many vertices a ring has (4 sides on a near
// limb, 3 on a far one or on a dead stub), so that a limb's own tube can be told from the forks laid after it.
function read(geo, isNear) {
  const P = geo.attributes.position.array, D = geo.attributes.aData.array, Bi = geo.attributes.aBranchId.array;
  const n = geo.attributes.position.count;
  const r = {
    tris: geo.index.count / 3, verts: n, minY: Infinity, maxY: -Infinity, wide: 0, nan: 0,
    trunkV: 0, trunkY: [], trunkShade: [], limbShade: [], limbs: new Map(), cards: [],
  };
  for (const a of ['position', 'normal', 'aMass', 'uv', 'aData', 'aBranchId', 'aLeaf01', 'aCard']) {
    const arr = geo.attributes[a].array;
    for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i])) r.nan++;
  }
  for (let i = 0; i < n; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], part = D[i * 4 + 1], bid = Bi[i];
    r.minY = Math.min(r.minY, y); r.maxY = Math.max(r.maxY, y);
    r.wide = Math.max(r.wide, Math.hypot(x, z));
    if (part !== BARK) continue;
    if (bid < 0) { r.trunkV++; r.trunkY.push(y); r.trunkShade.push(D[i * 4 + 2]); continue; }
    r.limbShade.push(D[i * 4 + 2]);
    const L = r.limbs.get(bid) || { verts: [], cards: [] };
    L.verts.push([x, y, z]);                      // in the order they were laid: the limb's tube, then its forks
    r.limbs.set(bid, L);
  }
  // the needle cards: leafCards lays four vertices a card, the long way across from the first to the third
  const starts = [];
  for (let i = 0; i < n; i++) if (D[i * 4 + 1] === CARD) starts.push(i);
  assert.equal(starts.length % 4, 0, 'needle cards come four vertices at a time');
  for (let q = 0; q < starts.length; q += 4) {
    const a = starts[q], b = starts[q + 1], c = starts[q + 2], d = starts[q + 3];
    const e = {
      x: (P[a * 3] + P[c * 3]) / 2, y: (P[a * 3 + 1] + P[c * 3 + 1]) / 2, z: (P[a * 3 + 2] + P[c * 3 + 2]) / 2,
      len: Math.hypot(P[c * 3] - P[a * 3], P[c * 3 + 1] - P[a * 3 + 1], P[c * 3 + 2] - P[a * 3 + 2]),
      wid: Math.hypot(P[d * 3] - P[b * 3], P[d * 3 + 1] - P[b * 3 + 1], P[d * 3 + 2] - P[b * 3 + 2]),
      bid: Bi[a], shade: D[a * 4 + 2],
    };
    e.r = Math.hypot(e.x, e.z);
    r.cards.push(e);
    const L = r.limbs.get(e.bid); if (L) L.cards.push(e);
  }
  r.nCards = r.cards.length;
  r.cardLen = r.cards.reduce((s, c) => s + c.len, 0) / Math.max(1, r.nCards);
  r.cardWid = r.cards.reduce((s, c) => s + c.wid, 0) / Math.max(1, r.nCards);
  r.cardShade = r.cards.reduce((s, c) => s + c.shade, 0) / Math.max(1, r.nCards);
  r.cardLow = r.cards.reduce((s, c) => Math.min(s, c.y), Infinity);
  r.cardHigh = r.cards.reduce((s, c) => Math.max(s, c.y), -Infinity);
  r.reach = r.cards.reduce((s, c) => Math.max(s, c.r), 0);
  // live limbs and dead stubs: a dead stub is one short tube with no needle on it
  r.live = []; r.dead = [];
  for (const [bid, L] of r.limbs) {
    L.bid = bid;
    // the limb's OWN tube is the first thing laid under its number; its forks follow, 12 vertices each
    const per = L.cards.length && isNear ? 5 : 4;           // 4 sides on a near limb, 3 on a far one and on a stub
    const own = L.cards.length ? (isNear ? LIMB_V : 12) : DEAD_V;
    L.rings = ringsOf(L.verts.slice(0, own), per);
    (L.cards.length ? r.live : r.dead).push(L);
  }
  return r;
}

// the centre line of a tube, as the mean of each of its rings
function ringsOf(verts, per) {
  const out = [];
  for (let i = 0; i + per <= verts.length; i += per) {
    let x = 0, y = 0, z = 0;
    for (let j = 0; j < per; j++) { x += verts[i + j][0]; y += verts[i + j][1]; z += verts[i + j][2]; }
    out.push({ x: x / per, y: y / per, z: z / per });
  }
  return out;
}
const flat2 = (a, b) => Math.hypot(b.x - a.x, b.z - a.z);   // how far apart two points are, seen from above

const near = SEEDS.map((s) => ({ seed: s, g: tallPineGeometry(s, 0) }));
const far = SEEDS.map((s) => ({ seed: s, g: tallPineGeometry(s, 1) }));
for (const e of near) { e.r = read(e.g, true); e.u = e.g.userData.tallPine; }
for (const e of far) { e.r = read(e.g, false); e.u = e.g.userData.tallPine; }
const slender = tallPineGeometry(999, 0, { slender: 1 });

test('nothing in a tall pine is NaN, at any seed, near or far', () => {
  for (const e of near.concat(far)) assert.equal(e.r.nan, 0, 'seed ' + e.seed);
  assert.equal(read(slender, true).nan, 0);
  console.log('seeds built: ' + SEEDS.join(', ') + ' (near and far), and one slender; no NaN in any attribute');
});

test('the triangle budget: under 3000 near, under 700 far, and spent', () => {
  const t0 = near.map((e) => e.r.tris), t1 = far.map((e) => e.r.tris);
  console.log('triangles lod 0: ' + Math.min(...t0) + ' .. ' + Math.max(...t0) + '  (per seed: ' + t0.join(', ') + ')');
  console.log('triangles lod 1: ' + Math.min(...t1) + ' .. ' + Math.max(...t1) + '  (per seed: ' + t1.join(', ') + ')');
  for (const e of near) assert.ok(e.r.tris < 3000, 'seed ' + e.seed + ' lod 0: ' + e.r.tris);
  for (const e of far) assert.ok(e.r.tris < 700, 'seed ' + e.seed + ' lod 1: ' + e.r.tris);
  for (const e of near) assert.ok(e.r.tris > 2700, 'seed ' + e.seed + ' lod 0 leaves triangles on the table: ' + e.r.tris);
  for (const e of far) assert.ok(e.r.tris > 600, 'seed ' + e.seed + ' lod 1 leaves triangles on the table: ' + e.r.tris);
  // the needles' budget is what is left over, so a thickly limbed seed costs what a sparse one does
  const spread = Math.max(...t0) - Math.min(...t0);
  assert.ok(spread < 60, 'the near cost swings by ' + spread + ' triangles between seeds');
  console.log('the cost swings by only ' + spread + ' triangles near and ' + (Math.max(...t1) - Math.min(...t1)) + ' far, over limb counts of ' + near.map((e) => e.u.limbs).join(', '));
});

test('it stands in the ground, it is tall, and far off it is the same tree', () => {
  const hs = near.map((e) => e.r.maxY), ws = near.map((e) => e.r.wide * 2);
  console.log('height (m): ' + hs.map((h) => h.toFixed(1)).join(', '));
  console.log('width (m):  ' + ws.map((w) => w.toFixed(1)).join(', '));
  const sr = read(slender, true);
  console.log('slender spec: ' + sr.maxY.toFixed(1) + ' m tall, ' + (sr.wide * 2).toFixed(1) + ' m wide');
  for (const e of near.concat(far)) {
    assert.ok(e.r.minY <= 0, 'seed ' + e.seed + ' does not reach the floor: ' + e.r.minY);
    assert.ok(e.r.maxY > 16 && e.r.maxY < 28, 'seed ' + e.seed + ' height ' + e.r.maxY);
    assert.ok(e.r.wide * 2 < e.r.maxY * 0.75, 'seed ' + e.seed + ' is too broad for a pine');
    assert.ok(e.r.wide * 2 > e.r.maxY * 0.35, 'seed ' + e.seed + ' is too narrow to be a canopy');
  }
  console.log('the trunk goes into the ground: its lowest vertex is at y ' + Math.min(...near.map((e) => e.r.minY)).toFixed(2) + ' near, ' + Math.min(...far.map((e) => e.r.minY)).toFixed(2) + ' far');
  // the same seed near and far: the plan is drawn before anything is laid, so it is one tree at two costs
  for (let i = 0; i < SEEDS.length; i++) {
    assert.ok(Math.abs(near[i].r.maxY - far[i].r.maxY) < 0.5, 'seed ' + SEEDS[i] + ' changes height between the levels');
    assert.ok(Math.abs(near[i].r.wide - far[i].r.wide) < 0.6, 'seed ' + SEEDS[i] + ' changes girth between the levels');
    assert.equal(near[i].u.limbs, far[i].u.limbs, 'seed ' + SEEDS[i] + ' grows other limbs far off');
  }
  console.log('near against far, same seeds: heights differ by at most ' + Math.max(...SEEDS.map((s, i) => Math.abs(near[i].r.maxY - far[i].r.maxY))).toFixed(2) + ' m, half-widths by at most ' + Math.max(...SEEDS.map((s, i) => Math.abs(near[i].r.wide - far[i].r.wide))).toFixed(2) + ' m');
});

test('the lower trunk is BARE: no needle below 0.6 of the height', () => {
  for (const e of near.concat(far)) {
    const share = e.r.cardLow / e.r.maxY;
    assert.ok(share > 0.60, 'seed ' + e.seed + ': a needle hangs at ' + share.toFixed(2) + ' of the height');
    assert.ok(e.r.cardLow > 10, 'seed ' + e.seed + ': the lowest needle is only ' + e.r.cardLow.toFixed(1) + ' m up');
    // the pole itself runs the whole way: from under the floor to the top, in one tube
    assert.ok(Math.min(...e.r.trunkY) <= 0 && Math.max(...e.r.trunkY) > e.r.maxY - 1.0, 'seed ' + e.seed + ': the pole does not run the whole height');
    for (const v of e.r.trunkShade) assert.ok(v < 0.5, 'the pole carries the shade of a twig: ' + v);
    for (const v of e.r.limbShade) assert.ok(v > 0.7, 'a limb carries the shade of a trunk: ' + v);
  }
  console.log('the lowest needle stands at ' + near.map((e) => e.r.cardLow.toFixed(1)).join(', ') + ' m, that is ' + near.map((e) => (e.r.cardLow / e.r.maxY).toFixed(2)).join(', ') + ' of each tree\'s height');
  console.log('so at eye level (1.7 m) there is nothing but bare wood, for ' + near.map((e) => (e.r.cardLow - 1.7).toFixed(0)).join(', ') + ' m of clear air under the needles');
  console.log('bark shade: pole ' + near[0].r.trunkShade[0].toFixed(2) + ', limbs ' + near[0].r.limbShade[0].toFixed(2) + ' (over 0.5 a piece of bark is read as a twig)');
});

test('the limbs are few, long, real tubes, and every one of them forks', () => {
  for (const e of near) {
    assert.equal(e.r.live.length, e.u.limbs, 'seed ' + e.seed + ': the plan and the geometry disagree on the limbs');
    assert.equal(e.r.dead.length, e.u.dead, 'seed ' + e.seed + ': the plan and the geometry disagree on the dead stubs');
    assert.ok(e.r.live.length >= 4 && e.r.live.length <= 8, 'seed ' + e.seed + ' limbs ' + e.r.live.length);
    let forks = 0;
    for (const L of e.r.live) {
      const nf = (L.verts.length - LIMB_V) / FORK_V;
      assert.ok(Number.isInteger(nf), 'a limb of ' + L.verts.length + ' vertices is not a tube and its forks');
      assert.ok(nf >= 1 && nf <= 2, 'a limb carries ' + nf + ' forks');
      assert.equal(L.rings.length, 4, 'a limb is not four rings');
      assert.ok(flat2(L.rings[0], L.rings[3]) > 2.2, 'a limb reaches only ' + flat2(L.rings[0], L.rings[3]).toFixed(1) + ' m out');
      forks += nf;
    }
    assert.equal(forks, e.u.forks, 'seed ' + e.seed + ': the plan and the geometry disagree on the forks');
    assert.ok(e.r.trunkV > 70, 'seed ' + e.seed + ': the pole is too few vertices (' + e.r.trunkV + ')');
  }
  console.log('limbs (lod 0): ' + near.map((e) => e.r.live.length).join(', ') + '   forks: ' + near.map((e) => e.u.forks).join(', '));
  console.log('limbs (lod 1): ' + far.map((e) => e.r.live.length).join(', ') + '   forks: ' + far.map((e) => e.u.forks).join(', ') + ' (far off a limb is one tube and no fork)');
  console.log('depth of the tubes: trunk -> limb -> fork (three levels near by, two far off)');
  const lens = near[0].u.limbLog.map((L) => L.len);
  console.log('seed ' + near[0].seed + ', limb by limb (where it leaves the trunk, how long, where its end is):');
  for (const L of near[0].u.limbLog) console.log('   base y ' + L.baseY.toFixed(2).padStart(6) + '   length ' + L.len.toFixed(2) + ' m   end y ' + L.tipY.toFixed(2) + '   forks ' + L.nf);
  console.log('a limb is ' + Math.min(...lens).toFixed(1) + ' to ' + Math.max(...lens).toFixed(1) + ' m long on that tree');
  for (const e of far) { assert.ok(e.r.live.length >= 4, 'seed ' + e.seed + ' far limbs ' + e.r.live.length); assert.equal(e.u.forks, 0); }
});

test('a limb leaves the trunk nearly level and turns up at its end', () => {
  const first = [], last = [];
  for (const e of near) for (const L of e.r.live) {
    const R = L.rings;
    const s1 = (R[1].y - R[0].y) / Math.max(1e-6, flat2(R[0], R[1]));     // over its first third
    const s3 = (R[3].y - R[2].y) / Math.max(1e-6, flat2(R[2], R[3]));     // over its last third
    assert.ok(s1 < 0.25, 'seed ' + e.seed + ': a limb leaves the trunk at a slope of ' + s1.toFixed(2) + ', not nearly level');
    assert.ok(s3 > 0.35, 'seed ' + e.seed + ': a limb ends at a slope of ' + s3.toFixed(2) + ', it does not turn up');
    assert.ok(R[3].y > R[0].y, 'a limb ends below where it left the trunk');
    first.push(s1); last.push(s3);
  }
  console.log('slope where a limb leaves the trunk: ' + Math.min(...first).toFixed(2) + ' .. ' + Math.max(...first).toFixed(2) + ' (0 is level; measured over ' + first.length + ' limbs)');
  console.log('slope over its last third:           ' + Math.min(...last).toFixed(2) + ' .. ' + Math.max(...last).toFixed(2) + ' -- the turn up at the end');
  // and the dead stubs do the opposite: level away from the trunk, then drooping, and never a needle on them
  let stubs = 0;
  for (const e of near) for (const L of e.r.dead) {
    assert.equal(L.verts.length, DEAD_V, 'a dead stub of ' + L.verts.length + ' vertices');
    assert.equal(L.cards.length, 0, 'a dead stub carries needles');
    const R = L.rings;
    assert.ok(R[R.length - 1].y < R[0].y, 'a dead stub does not droop');
    assert.ok(R[0].y < e.r.cardLow, 'a dead stub is up in the needles');
    stubs++;
  }
  const dy = [];
  for (const e of near) for (const L of e.r.dead) dy.push(L.rings[L.rings.length - 1].y - L.rings[0].y);
  console.log(stubs + ' dead stubs over ' + SEEDS.length + ' seeds (one or two a tree), low on the bare trunk, bare of needles, drooping by ' + Math.min(...dy).toFixed(2) + ' to ' + Math.max(...dy).toFixed(2) + ' m');
});

// A limb's needle mass measured in the LIMB'S OWN FRAME, from the geometry alone: how far the needles spread ACROSS
// the limb (horizontally, square to its bearing) against how thick they are VERTICALLY about the limb's own centre
// line, which is read back from the limb's rings. A plate is wide and thin; a ball is the same both ways. The plates
// along one limb overlap on purpose, so they are measured as the one mass they make.
function plateShape(L) {
  const R = L.rings, a = R[0], b = R[R.length - 1];
  let dx = b.x - a.x, dz = b.z - a.z;
  const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
  const along = (c) => (c.x - a.x) * dx + (c.z - a.z) * dz;
  const across = (c) => (c.x - a.x) * -dz + (c.z - a.z) * dx;
  // the centre line's height at a distance out along the bearing: straight between the rings, level past the end
  const ring = R.map((p) => ({ s: along(p), y: p.y }));
  const lineY = (s) => {
    if (s <= ring[0].s) return ring[0].y;
    for (let i = 1; i < ring.length; i++) if (s <= ring[i].s) {
      const t = (s - ring[i - 1].s) / Math.max(1e-6, ring[i].s - ring[i - 1].s);
      return ring[i - 1].y + (ring[i].y - ring[i - 1].y) * t;
    }
    return ring[ring.length - 1].y;
  };
  const ac = L.cards.map(across), th = L.cards.map((c) => c.y - lineY(along(c))), al = L.cards.map(along);
  const width = Math.max(...ac) - Math.min(...ac), thick = Math.max(...th) - Math.min(...th);
  return { width, thick, ratio: thick / Math.max(1e-6, width), reach: flat2(a, b), inner: Math.min(...al) };
}

test('the needles sit only at the limbs\' ends, in flat plates and not balls', () => {
  // EACH PLATE ON ITS OWN. The plates along one limb overlap on purpose, and a limb's whole needle mass is therefore
  // not a plate -- it is a mass that climbs with the limb. So the cards are shared out between the plates by the order
  // they were laid in (one plate's cards are laid together, and the kit records how many went into each), and each
  // plate's own thickness and width are then measured from the cards themselves.
  const ratios = [], widths = [], thicks = [], inners = [], outs = [], limbRatio = [];
  for (const e of near) {
    let q = 0, measured = 0;
    for (const pl of e.u.plateLog) {
      const grp = e.r.cards.slice(q, q + pl.n); q += pl.n;
      assert.ok(grp.every((c) => c.bid === f32(pl.bid)), 'the cards are not laid plate by plate');
      if (grp.length < 8) continue;
      const ys = grp.map((c) => c.y), xs = grp.map((c) => c.x), zs = grp.map((c) => c.z);
      const thick = Math.max(...ys) - Math.min(...ys);
      const width = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
      const ratio = thick / Math.max(1e-6, width);
      assert.ok(ratio < 0.60, 'seed ' + e.seed + ': a plate of needles is ' + thick.toFixed(2) + ' m thick and ' + width.toFixed(2) + ' m across -- a ball, not a plate');
      ratios.push(ratio); widths.push(width); thicks.push(thick); measured++;
    }
    assert.equal(q, e.r.nCards, 'seed ' + e.seed + ': the plates do not account for every needle');
    assert.ok(measured > e.u.plates * 0.6, 'seed ' + e.seed + ': only ' + measured + ' of ' + e.u.plates + ' plates were big enough to measure');
    // and the needles begin out along a limb, not at the trunk: measured in the limb's own frame
    for (const L of e.r.live) {
      const p = plateShape(L);
      assert.ok(p.inner > p.reach * 0.33, 'seed ' + e.seed + ': needles start ' + p.inner.toFixed(2) + ' m out on a limb reaching ' + p.reach.toFixed(2) + ' m');
      assert.ok(p.width > 1.3, 'seed ' + e.seed + ': a limb\'s needles are only ' + p.width.toFixed(2) + ' m across');
      inners.push(p.inner / p.reach); limbRatio.push(p.ratio);
    }
    // over the tree: the needles stand well away from the trunk
    const out = e.r.cards.filter((c) => c.r > e.r.reach * 0.4).length / e.r.nCards;
    const meanR = e.r.cards.reduce((s, c) => s + c.r, 0) / e.r.nCards;
    assert.ok(out > 0.75, 'seed ' + e.seed + ': only ' + (out * 100).toFixed(0) + ' per cent of the needles are out past 0.4 of the reach');
    assert.ok(meanR > e.r.reach * 0.45, 'seed ' + e.seed + ': the needles crowd the trunk (mean ' + meanR.toFixed(1) + ' m of ' + e.r.reach.toFixed(1) + ')');
    outs.push(out);
  }
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  console.log('a plate of needles, by the CENTRES of its needles: ' + Math.min(...widths).toFixed(2) + ' to ' + Math.max(...widths).toFixed(2) + ' m across, ' + Math.min(...thicks).toFixed(2) + ' to ' + Math.max(...thicks).toFixed(2) + ' m thick, over ' + ratios.length + ' plates (a needle is 0.34 m long and lies its own way, so the plate itself is thicker than its centres)');
  console.log('so a plate is ' + Math.min(...ratios).toFixed(2) + ' to ' + Math.max(...ratios).toFixed(2) + ' as thick as it is wide, ' + mean(ratios).toFixed(2) + ' on average (1.0 would be a ball)');
  console.log('plates a tree: ' + near.map((e) => e.u.plates).join(', ') + ' near, ' + far.map((e) => e.u.plates).join(', ') + ' far');
  console.log('a whole limb\'s needles, measured about the limb\'s own rising centre line: ' + Math.min(...limbRatio).toFixed(2) + ' to ' + Math.max(...limbRatio).toFixed(2) + ' as thick as they are wide (they climb with the limb, so this is not a plate\'s own measure)');
  console.log('the needles begin ' + Math.min(...inners).toFixed(2) + ' to ' + Math.max(...inners).toFixed(2) + ' of the way out along a limb: the inner part is bare wood');
  console.log('needles out past 0.4 of the tree\'s reach: ' + outs.map((o) => (o * 100).toFixed(0) + '%').join(', '));
  console.log('mean distance of a needle from the trunk: ' + near.map((e) => (e.r.cards.reduce((s, c) => s + c.r, 0) / e.r.nCards).toFixed(1)).join(', ') + ' m, of a reach of ' + near.map((e) => e.r.reach.toFixed(1)).join(', ') + ' m');
});

test('the crown is wider than it is deep, and spread right round the trunk', () => {
  for (const e of near.concat(far)) {
    const depth = e.r.cardHigh - e.r.cardLow, width = e.r.wide * 2;
    assert.ok(width > depth * 1.25, 'seed ' + e.seed + ': the crown is ' + width.toFixed(1) + ' m wide and ' + depth.toFixed(1) + ' m deep');
    // round the trunk: the biggest gap between one limb's bearing and the next is less than half the circle
    const ang = e.u.limbLog.map((L) => ((L.ang % 6.283) + 6.283) % 6.283).sort((a, b) => a - b);
    let gap = 0;
    for (let i = 0; i < ang.length; i++) gap = Math.max(gap, i ? ang[i] - ang[i - 1] : ang[0] + 6.283 - ang[ang.length - 1]);
    assert.ok(gap < 3.1, 'seed ' + e.seed + ': ' + gap.toFixed(2) + ' radians of the circle with no limb in it');
  }
  const wd = near.map((e) => (e.r.wide * 2) / (e.r.cardHigh - e.r.cardLow));
  console.log('crown width against crown depth: ' + wd.map((v) => v.toFixed(2)).join(', ') + ' (over 1 is wider than deep: a canopy from below, a flat star from the air)');
  console.log('crown depth (m): ' + near.map((e) => (e.r.cardHigh - e.r.cardLow).toFixed(1)).join(', ') + '   crown width (m): ' + near.map((e) => (e.r.wide * 2).toFixed(1)).join(', '));
  const gaps = near.map((e) => {
    const ang = e.u.limbLog.map((L) => ((L.ang % 6.283) + 6.283) % 6.283).sort((a, b) => a - b);
    let gap = 0;
    for (let i = 0; i < ang.length; i++) gap = Math.max(gap, i ? ang[i] - ang[i - 1] : ang[0] + 6.283 - ang[ang.length - 1]);
    return gap;
  });
  console.log('biggest bearing with no limb in it: ' + gaps.map((g) => g.toFixed(2)).join(', ') + ' radians (3.14 would be a whole half of the tree bare)');
});

test('the needles are many small cards', () => {
  for (const e of near) {
    assert.equal(e.r.nCards, e.u.cards, 'seed ' + e.seed + ': the plan and the geometry disagree on the needles');
    assert.ok(e.r.nCards > 1100, 'seed ' + e.seed + ' needles ' + e.r.nCards);
    assert.ok(e.r.cardLen < 0.42 && e.r.cardWid < 0.12, 'seed ' + e.seed + ' needle ' + e.r.cardLen + ' x ' + e.r.cardWid);
    // laid dark by the kind's own colours, not by a shade number piled over them
    assert.ok(e.r.cardShade < 0.45, 'seed ' + e.seed + ' mean needle shade ' + e.r.cardShade.toFixed(2));
  }
  for (const e of far) {
    assert.ok(e.r.nCards > 240, 'seed ' + e.seed + ' far needles ' + e.r.nCards);
    assert.ok(e.r.cardLen < 0.80, 'seed ' + e.seed + ' far needle ' + e.r.cardLen);
  }
  console.log('needle cards (lod 0): ' + near.map((e) => e.r.nCards).join(', '));
  console.log('needle cards (lod 1): ' + far.map((e) => e.r.nCards).join(', '));
  console.log('a needle is ' + near[0].r.cardLen.toFixed(3) + ' x ' + near[0].r.cardWid.toFixed(3) + ' m near, ' + far[0].r.cardLen.toFixed(3) + ' x ' + far[0].r.cardWid.toFixed(3) + ' m far (fewer and larger far off, so the crown is as full)');
  console.log('mean needle shade: ' + near.map((e) => e.r.cardShade.toFixed(2)).join(', ') + ' (0 = the kind\'s own colour, 1 = deep in the crown)');
});

test('two seeds are two different trees', () => {
  const hs = near.map((e) => +e.r.maxY.toFixed(3)), ws = near.map((e) => +e.r.wide.toFixed(3)), ls = near.map((e) => e.r.live.length);
  assert.equal(new Set(hs).size, hs.length, 'two seeds stand the same height');
  assert.equal(new Set(ws).size, ws.length, 'two seeds stand the same width');
  assert.ok(new Set(ls).size >= 3, 'the limb counts are too alike: ' + ls.join(', '));
  // not merely a change of size: the limbs leave the trunk at other heights and other bearings, and fork other ways
  const a = near[0].u.limbLog.map((L) => +L.baseY.toFixed(2)), b = near[1].u.limbLog.map((L) => +L.baseY.toFixed(2));
  assert.notDeepEqual(a, b);
  const ga = near[0].u.limbLog.map((L) => +L.ang.toFixed(2)), gb = near[1].u.limbLog.map((L) => +L.ang.toFixed(2));
  assert.notDeepEqual(ga, gb);
  console.log('heights: ' + hs.map((h) => h.toFixed(2)).join(', '));
  console.log('half-widths (m): ' + ws.map((w) => w.toFixed(2)).join(', '));
  console.log('limb counts: ' + ls.join(', ') + '  (' + new Set(ls).size + ' different values over ' + ls.length + ' seeds)');
  console.log('where the bare trunk gives out, as a share of the height: ' + near.map((e) => (e.u.bareTo / e.r.maxY).toFixed(2)).join(', '));
  console.log('dead stubs a tree: ' + near.map((e) => e.r.dead.length).join(', '));
});
