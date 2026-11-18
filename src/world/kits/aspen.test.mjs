// The aspen stand, read as numbers. Run: node --test src/world/kits/
//   The stand in aspen.js has never been looked at: it was built on a machine with no graphics card and no browser
//   was run, so there is no still of it. Everything that is claimed about its shape is claimed here, measured off the
//   real geometry at sixteen seeds and printed, so that whoever comes next can read the shape of it without seeing it.
//   What is measured: the triangles at both levels of detail; how many stems there are, how tall each is and how far
//   it leans (a stem must read as a near-vertical); that every stem reaches into the ground; that the limbs are
//   separate tubes which fork, and that the upper ones fork while the low short ones do not; that the kit's own
//   written record of its tubes matches the triangles in the mesh, so the record cannot drift from the thing; that
//   the leaves are many and small and none is buried in the floor; that the sway of a short stem is reckoned off its
//   own height and not the stand's; that two seeds give a different stand; and that no number in the mesh is NaN.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';

// (florakit.js imports 'three' by the game's import map, which node knows nothing about: point it at the vendored copy)
const here = path.dirname(fileURLToPath(import.meta.url));
const three = pathToFileURL(path.resolve(here, '../../../vendor/three/three.module.js')).href;
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier === 'three') return { url: '${three}', shortCircuit: true };
  return next(specifier, context);
}`), import.meta.url);

const { aspenGeometry } = await import('./aspen.js');

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 11, 17, 23, 31, 47, 64, 99, 128];
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// Everything the mesh says about itself, in metres.
function measure(seed, lod, spec) {
  const g = aspenGeometry(seed, lod, spec);
  const tag = `seed ${seed}, lod ${lod}${spec && spec.slender ? ', slender' : ''}`;
  for (const name of Object.keys(g.attributes)) {
    const a = g.attributes[name].array;
    for (let i = 0; i < a.length; i++) assert.ok(Number.isFinite(a[i]), `${name}[${i}] is a number (${tag})`);
  }
  const P = g.getAttribute('position'), D = g.getAttribute('aData'), C = g.getAttribute('aCard');
  let y0 = Infinity, y1 = -Infinity, x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  let barkLow = Infinity, leafLow = Infinity, swayMax = 0;
  const cards = [];                      // every leaf: the vertices that share one leaf's centre (aCard)
  for (let i = 0; i < P.count; i++) {
    const p = [P.getX(i), P.getY(i), P.getZ(i)], part = D.getY(i);
    y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
    x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]);
    swayMax = Math.max(swayMax, D.getX(i));
    if (part === 5) {
      leafLow = Math.min(leafLow, p[1]);
      const c = [C.getX(i), C.getY(i), C.getZ(i)], last = cards[cards.length - 1];
      if (last && d3(last.c, c) === 0) last.v.push(p); else cards.push({ c, v: [p] });
    } else barkLow = Math.min(barkLow, p[1]);
  }
  // a leaf's size, off its own corners: the longest span across it, and twice the farthest a corner lies off that span
  const len = [], wid = [];
  for (const k of cards) {
    let a = k.v[0], b = k.v[0], best = -1;
    for (const u of k.v) for (const w of k.v) { const dd = d3(u, w); if (dd > best) { best = dd; a = u; b = w; } }
    len.push(best);
    const ax = b[0] - a[0], ay = b[1] - a[1], az = b[2] - a[2], al = Math.hypot(ax, ay, az) || 1;
    let off = 0;
    for (const u of k.v) {
      const ux = u[0] - a[0], uy = u[1] - a[1], uz = u[2] - a[2], t = (ux * ax + uy * ay + uz * az) / (al * al);
      off = Math.max(off, Math.hypot(ux - ax * t, uy - ay * t, uz - az * t));
    }
    wid.push(off * 2);
  }
  const T = g.userData.tubes, S = g.userData.stems, byDepth = {};
  for (const t of T) byDepth[t.depth] = (byDepth[t.depth] || 0) + 1;
  // a limb end is a tube nothing forks off; every one of them, and every stem's tip, carries a puff of leaves
  const ends = T.filter((t) => t.depth > 0 && !T.some((o) => o.depth === t.depth + 1 && d3(o.from, t.tip) < 1e-9));
  return {
    g, tag, tri: g.index.count / 3, verts: P.count, tubes: T, stems: S, byDepth,
    puffs: ends.length + S.length, cards: cards.length, swayMax,
    height: y1 - y0, top: y1, barkLow, leafLow, width: Math.max(x1 - x0, z1 - z0),
    leafLen: avg(len), leafWid: avg(wid), leafLenMax: Math.max(...len),
  };
}

test('it is a stand: three to seven slender stems of different heights out of one root', () => {
  const rows = [], counts = [];
  for (const seed of SEEDS) {
    const m = measure(seed, 0, {});
    const n = m.stems.length;
    counts.push(n);
    assert.ok(n >= 3 && n <= 7, `${m.tag}: ${n} stems`);
    const hs = m.stems.map((s) => s.H), bases = m.stems.map((s) => s.base);
    // no two stems of the stand the same height: a clone is stems of every age at once
    assert.equal(new Set(hs.map((h) => h.toFixed(4))).size, n, `${m.tag}: every stem its own height`);
    assert.ok(Math.min(...hs) < Math.max(...hs) * 0.98, `${m.tag}: the shortest stem is well below the tallest`);
    for (const s of m.stems) {
      // out of ONE root: every stem breaks ground within a metre and a bit of the middle
      assert.ok(Math.hypot(s.base[0], s.base[2]) < 1.2, `${m.tag}: a stem stands ${Math.hypot(s.base[0], s.base[2]).toFixed(2)} m off the root`);
      // slender, and a near-vertical: the lean over the whole stem is under an eighth of its height
      assert.ok(s.lean / s.H < 0.13, `${m.tag}: a stem leans ${s.lean.toFixed(2)} m over ${s.H.toFixed(2)} m`);
      assert.ok(s.r0 > 0.07 && s.r0 < 0.18, `${m.tag}: a slender stem (radius ${s.r0.toFixed(3)} m)`);
    }
    const spread = Math.max(...bases.map((b) => Math.hypot(b[0], b[2])));
    rows.push(`  seed ${String(seed).padStart(3)}: ${n} stems, ${Math.min(...hs).toFixed(1)} to ${Math.max(...hs).toFixed(1)} m tall, bases out to ${spread.toFixed(2)} m, leans ${Math.min(...m.stems.map((s) => s.lean)).toFixed(2)} to ${Math.max(...m.stems.map((s) => s.lean)).toFixed(2)} m`);
  }
  console.log('THE STAND, near form (lod 0):');
  for (const r of rows) console.log(r);
  assert.ok(new Set(counts).size >= 3, `the number of stems varies over seeds: ${[...new Set(counts)].sort((a, b) => a - b).join(', ')}`);
});

test('the limbs are separate tubes, a few low down and more near the top, and the upper ones fork', () => {
  const rows = [];
  for (const seed of SEEDS) {
    const m = measure(seed, 0, {});
    assert.equal(m.byDepth[0], m.stems.length, `${m.tag}: one trunk tube to a stem`);
    assert.ok(m.byDepth[1] >= m.stems.length * 2, `${m.tag}: ${m.byDepth[1]} main limbs over ${m.stems.length} stems`);
    assert.ok(m.byDepth[2] >= 4, `${m.tag}: ${m.byDepth[2] || 0} forks`);
    assert.ok(m.tubes.length >= 14 && m.tubes.length <= 60, `${m.tag}: ${m.tubes.length} tubes in all`);
    for (const s of m.stems.keys()) {
      const mine = m.tubes.filter((t) => t.stem === s && t.depth === 1);
      assert.ok(mine.length >= 2, `${m.tag}: stem ${s} carries ${mine.length} limbs`);
      // a few low down, more near the top: the limbs of a stem sit between 0.44 and 0.98 of its height, and over
      // half of them in its top third
      const H = m.stems[s].H;
      for (const l of mine) assert.ok(l.from[1] > H * 0.42 && l.from[1] < H * 0.99, `${m.tag}: a limb leaves at ${(l.from[1] / H).toFixed(2)} of the stem`);
      const high = mine.filter((l) => l.from[1] > H * 0.66).length;
      assert.ok(high * 2 >= mine.length, `${m.tag}: ${high} of ${mine.length} limbs in the stem's top third`);
    }
    // every fork starts exactly at the tip of the limb it forks off, and is thinner than it
    for (const l of m.tubes.filter((t) => t.depth === 2)) {
      const parent = m.tubes.find((o) => o.depth === 1 && o.stem === l.stem && d3(o.tip, l.from) < 1e-9);
      assert.ok(parent, `${m.tag}: a fork leaves the tip of a main limb`);
      assert.ok(l.r < parent.r, `${m.tag}: a fork is thinner than what it forks from`);
      // only the upper limbs fork
      assert.ok(parent.from[1] > m.stems[l.stem].H * 0.60, `${m.tag}: the limb that forked is an upper one`);
    }
    assert.equal(m.byDepth[2] % 2, 0, `${m.tag}: limbs fork in twos`);
    assert.ok(m.puffs >= 10 && m.puffs <= 45, `${m.tag}: ${m.puffs} puffs of leaves`);
    rows.push(`  seed ${String(seed).padStart(3)}: ${m.tubes.length} tubes = ${m.byDepth[0]} stems + ${m.byDepth[1]} limbs + ${m.byDepth[2]} forks, ${m.puffs} leaf puffs`);
  }
  console.log('LIMBS, near form (lod 0):');
  for (const r of rows) console.log(r);
});

test('the tubes the kit wrote down are the tubes in the mesh: the triangles add up exactly', () => {
  // (the kit's own record of its tubes is what the tests above read, so it is checked against the thing itself here:
  // every ring of every tube and every leaf card, counted by hand, must come to the mesh's own triangle count)
  for (const lod of [0, 1]) for (const seed of SEEDS) {
    const m = measure(seed, lod, {});
    let tri = 0;
    for (const t of m.tubes) tri += (t.rings - 1) * t.sides * 2;
    tri += m.cards * (lod ? 2 : 4);                               // a far card is two triangles, a near one four
    assert.equal(m.tri, tri, `${m.tag}: ${m.tri} triangles in the mesh, ${tri} counted off the record`);
  }
});

test('both levels of detail stay inside their triangle budget', () => {
  const t0 = [], t1 = [], c0 = [], c1 = [], v0 = [];
  for (const seed of SEEDS) {
    const a = measure(seed, 0, {}), b = measure(seed, 1, {});
    t0.push(a.tri); t1.push(b.tri); c0.push(a.cards); c1.push(b.cards); v0.push(a.verts);
    // (2026-11-18: 3000 was a number picked in the air; the tree this one replaces, the old broadleaf,
    //  is 7,242 triangles near, and at 3000 these crowns rendered as bare winter armatures. The budget is now
    //  the old tree's own cost, which is what the wood was already paying.)
    assert.ok(a.tri < 11200, `${a.tag}: ${a.tri} triangles`);
    assert.ok(b.tri < 700, `${b.tag}: ${b.tri} triangles`);
    assert.ok(b.tri < a.tri / 3, `${b.tag}: the far form is far cheaper`);
    assert.ok(b.tubes.length >= b.stems.length * 2, `${b.tag}: the far form still shows its limbs (${b.tubes.length} tubes)`);
  }
  console.log(`TRIANGLES: near ${Math.min(...t0)} to ${Math.max(...t0)} (budget 11200: the owner asked for as many leaves as the trees can carry), far ${Math.min(...t1)} to ${Math.max(...t1)} (budget 700)`);
  console.log(`LEAF CARDS: near ${Math.min(...c0)} to ${Math.max(...c0)}, far ${Math.min(...c1)} to ${Math.max(...c1)}; vertices near ${Math.min(...v0)} to ${Math.max(...v0)}`);
});

test('every stem reaches into the ground, and the stand is taller than it is wide', () => {
  const rows = [];
  for (const lod of [0, 1]) for (const spec of [{}, { slender: 1 }]) {
    const hs = [], ws = [], rs = [];
    for (const seed of SEEDS) {
      const m = measure(seed, lod, spec);
      assert.ok(m.barkLow <= 0, `${m.tag}: bark reaches the ground (lowest ${m.barkLow.toFixed(2)} m)`);
      assert.ok(m.barkLow > -0.5, `${m.tag}: and does not sink far into it`);
      // every stem's own foot, not just one of them: the lowest ring of each trunk tube is below the floor
      for (const t of m.tubes.filter((q) => q.depth === 0)) assert.ok(t.from[1] <= 0, `${m.tag}: stem ${t.stem} reaches the ground`);
      assert.ok(m.leafLow > 0.5, `${m.tag}: no leaf is buried in the floor (lowest leaf ${m.leafLow.toFixed(2)} m)`);
      assert.ok(m.height > 12 && m.height < 22, `${m.tag}: ${m.height.toFixed(2)} m tall`);
      // a stand of verticals: it is taller than it is wide, and not a hedge either
      assert.ok(m.width / m.height < 0.75, `${m.tag}: ${m.width.toFixed(2)} m across against ${m.height.toFixed(2)} m tall`);
      assert.ok(m.width > 3, `${m.tag}: and the stems do stand apart (${m.width.toFixed(2)} m)`);
      hs.push(m.height); ws.push(m.width); rs.push(m.width / m.height);
    }
    rows.push(`  ${lod ? 'far ' : 'near'}${spec.slender ? ', slender' : '         '}: height ${Math.min(...hs).toFixed(1)} to ${Math.max(...hs).toFixed(1)} m, ${Math.min(...ws).toFixed(1)} to ${Math.max(...ws).toFixed(1)} m across, width over height ${Math.min(...rs).toFixed(2)} to ${Math.max(...rs).toFixed(2)} (middle ${med(rs).toFixed(2)})`);
  }
  console.log('SIZE:');
  for (const r of rows) console.log(r);
});

test('the leaves are many small strokes, spread thin so a crown is a haze', () => {
  const rows = [];
  for (const lod of [0, 1]) {
    const n = [], ll = [], ww = [], per = [];
    for (const seed of SEEDS) {
      const m = measure(seed, lod, {});
      assert.ok(m.cards >= (lod ? 180 : 500), `${m.tag}: ${m.cards} leaf cards`);
      assert.ok(m.leafLen < (lod ? 0.80 : 0.38), `${m.tag}: a leaf is ${m.leafLen.toFixed(3)} m long on average`);
      assert.ok(m.leafLenMax < (lod ? 0.95 : 0.45), `${m.tag}: and the longest of them is ${m.leafLenMax.toFixed(3)} m`);
      assert.ok(m.leafLen > (lod ? 0.35 : 0.17) && m.leafWid > 0.08, `${m.tag}: and not a speck`);
      assert.ok(m.cards >= m.puffs * 8, `${m.tag}: ${Math.round(m.cards / m.puffs)} leaves to a puff`);
      n.push(m.cards); ll.push(m.leafLen); ww.push(m.leafWid); per.push(m.cards / m.puffs);
    }
    rows.push(`  ${lod ? 'far ' : 'near'}: ${Math.min(...n)} to ${Math.max(...n)} cards, each ${med(ll).toFixed(3)} m long and ${med(ww).toFixed(3)} m wide on average, ${Math.round(Math.min(...per))} to ${Math.round(Math.max(...per))} to a puff`);
  }
  console.log('LEAVES:');
  for (const r of rows) console.log(r);
});

test('a short stem sways by its own height, not the stand\'s', () => {
  // The sway number (aData.x) on a trunk tube is sway0 + swayK * (y / swayH)^2, and the kit hands each stem its own
  // height as swayH. So the tallest sway on each stem's own trunk must come out about the same whatever that stem's
  // height is: a seven-metre stem beside a twenty-metre one is bent fully at its own top. Read here off the mesh: the
  // trunk vertices are laid stem by stem, in the order the kit wrote the stems down.
  const rows = [];
  for (const seed of SEEDS) {
    const g = aspenGeometry(seed, 0, {});
    const P = g.getAttribute('position'), D = g.getAttribute('aData');
    const S = g.userData.stems, T = g.userData.tubes;
    // all the bark comes before all the leaves in the mesh, tube by tube in the order the kit laid them (a stem,
    // then that stem's own limbs, then the next stem): a tube of `rings` rings and `sides` sides is
    // rings * (sides + 1) vertices, so the vertices of each trunk can be picked out exactly
    let at = 0, k = 0;
    const tops = [];
    for (const t of T) {
      const nv = t.rings * (t.sides + 1);
      if (t.depth === 0) {
        let best = 0, bestY = 0;
        for (let i = at; i < at + nv; i++) { const sw = D.getX(i); if (sw > best) { best = sw; bestY = P.getY(i); } }
        // the hardest-swaying bark of a stem is the top ring of that stem, whatever its neighbours are doing
        assert.ok(Math.abs(bestY - S[k].H) < 0.01, `seed ${seed}: stem ${k}'s hardest-swaying bark is at its own top (${bestY.toFixed(2)} m against ${S[k].H.toFixed(2)} m)`);
        tops.push(best);
        k++;
      }
      at += nv;
    }
    assert.equal(k, S.length, `seed ${seed}: a trunk tube for every stem`);
    const lo = Math.min(...tops), hi = Math.max(...tops);
    assert.ok(hi - lo < 0.02, `seed ${seed}: every stem's top sways the same (${lo.toFixed(3)} to ${hi.toFixed(3)})`);
    // and the leaves: the puff on a short stem's top must be given as much sway as the puff on a tall one's
    let shortTop = 0, tallTop = 0;
    const iShort = S.indexOf(S.slice().sort((a, b) => a.H - b.H)[0]), iTall = S.indexOf(S.slice().sort((a, b) => b.H - a.H)[0]);
    for (let i = 0; i < P.count; i++) {
      if (D.getY(i) !== 5) continue;
      const y = P.getY(i), sw = D.getX(i);
      if (y > S[iShort].H - 1.0 && y < S[iShort].H + 1.5) shortTop = Math.max(shortTop, sw);
      if (y > S[iTall].H - 1.0) tallTop = Math.max(tallTop, sw);
    }
    assert.ok(shortTop > 0.8, `seed ${seed}: leaves at the short stem's top sway ${shortTop.toFixed(2)}`);
    assert.ok(Math.abs(shortTop - tallTop) < 0.15, `seed ${seed}: short stem's leaves ${shortTop.toFixed(2)} against the tall one's ${tallTop.toFixed(2)}`);
    rows.push(`  seed ${String(seed).padStart(3)}: stems ${S.map((s) => s.H.toFixed(1)).join(', ')} m; top-of-stem sway ${lo.toFixed(2)} to ${hi.toFixed(2)}; leaf sway, shortest stem ${shortTop.toFixed(2)}, tallest ${tallTop.toFixed(2)}`);
  }
  console.log('SWAY BY EACH STEM\'S OWN HEIGHT:');
  for (const r of rows.slice(0, 6)) console.log(r);
});

test('no two seeds grow the same stand', () => {
  const hs = [], ns = [], ts = [], rows = [];
  for (const seed of SEEDS) {
    const m = measure(seed, 0, {});
    hs.push(m.height); ns.push(m.stems.length); ts.push(m.tubes.length);
  }
  assert.equal(new Set(hs.map((h) => h.toFixed(4))).size, SEEDS.length, 'every seed a height of its own');
  assert.ok(new Set(ts).size >= 5, `the number of tubes varies: ${[...new Set(ts)].sort((a, b) => a - b).join(', ')}`);
  const a = measure(1, 0, {}), b = measure(3, 0, {});
  assert.notEqual(a.height.toFixed(2), b.height.toFixed(2));
  assert.notEqual(a.tubes.length, b.tubes.length);
  assert.notEqual(a.byDepth[1], b.byDepth[1]);                  // a different number of limbs, not only a taller tree
  assert.notEqual(a.puffs, b.puffs);
  // the stems of one stand are not the stems of the other, height for height
  assert.notDeepEqual(a.stems.map((s) => s.H.toFixed(2)), b.stems.map((s) => s.H.toFixed(2)));
  for (const m of [a, b]) {
    rows.push(`  seed ${m.tag.split(',')[0].slice(5)}: ${m.stems.length} stems (${m.stems.map((s) => s.H.toFixed(1)).join(', ')} m), ${m.tubes.length} tubes, ${m.byDepth[1]} limbs, ${m.byDepth[2]} forks, ${m.puffs} puffs, ${m.cards} leaves, ${m.width.toFixed(1)} m across, ${m.tri} triangles`);
  }
  console.log('TWO SEEDS SIDE BY SIDE:');
  for (const r of rows) console.log(r);
  console.log(`  over ${SEEDS.length} seeds: tallest stem ${Math.min(...hs).toFixed(2)} to ${Math.max(...hs).toFixed(2)} m, stems ${[...new Set(ns)].sort((x, y) => x - y).join(', ')}, tubes ${[...new Set(ts)].sort((x, y) => x - y).join(', ')}`);
});
