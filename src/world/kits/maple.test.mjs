// The broad-crowned maple, read as numbers. Run: node --test src/world/kits/
//   The tree in maple.js has never been looked at: it was built on a machine with no graphics card and no browser was
//   run, so there is no still of it. Everything that is claimed about its shape is claimed here, measured off the real
//   geometry at sixteen seeds and printed, so that whoever comes next can read the shape of the tree without seeing it.
//   What is measured: the triangles at both levels of detail; the height and the crown's width; that the trunk goes
//   into the ground; that the limbs are separate tubes which fork (the kit writes down every tube it lays, and the
//   count of tubes is checked against the triangles in the mesh, so the written record cannot drift from the thing);
//   that the lowest limb reaches out and DOWN; that the leaves are many, small and above the floor; that two seeds
//   give a different tree; and that not one number in the whole mesh is NaN.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const three = pathToFileURL(path.resolve(here, '../../../vendor/three/three.module.js')).href;
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier === 'three') return { url: '${three}', shortCircuit: true };
  return next(specifier, context);
}`), import.meta.url);

const { mapleGeometry } = await import('./maple.js');

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 11, 17, 23, 31, 47, 64, 99, 128];
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// Everything the mesh says about itself, in metres.
function measure(seed, lod, spec) {
  const g = mapleGeometry(seed, lod, spec);
  const tag = `seed ${seed}, lod ${lod}${spec && spec.slender ? ', slender' : ''}`;
  for (const name of Object.keys(g.attributes)) {
    const a = g.attributes[name].array;
    for (let i = 0; i < a.length; i++) assert.ok(Number.isFinite(a[i]), `${name}[${i}] is a number (${tag})`);
  }
  const P = g.getAttribute('position'), D = g.getAttribute('aData'), C = g.getAttribute('aCard');
  let y0 = Infinity, y1 = -Infinity, x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  let barkLow = Infinity, leafLow = Infinity;
  const cards = [];                       // every leaf: the vertices that share one leaf's centre (aCard)
  for (let i = 0; i < P.count; i++) {
    const p = [P.getX(i), P.getY(i), P.getZ(i)], part = D.getY(i);
    y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
    x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]);
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
  const L = g.userData.limbs, byDepth = {};
  for (const l of L) byDepth[l.depth] = (byDepth[l.depth] || 0) + 1;
  const ends = L.filter((l) => l.depth > 0 && !L.some((o) => o.depth === l.depth + 1 && d3(o.from, l.tip) < 1e-6));
  return {
    g, tag, tri: g.index.count / 3, verts: P.count, limbs: L, byDepth, ends: ends.length, cards: cards.length,
    height: y1 - y0, top: y1, barkLow, leafLow, width: Math.max(x1 - x0, z1 - z0),
    leafLen: len.reduce((a, b) => a + b, 0) / len.length, leafWid: wid.reduce((a, b) => a + b, 0) / wid.length,
    leafLenMin: Math.min(...len), leafLenMax: Math.max(...len),
  };
}

test('the trunk is short and forks low into three to five main limbs, and those fork again', () => {
  const rows = [];
  for (const seed of SEEDS) {
    const m = measure(seed, 0, {});
    const trunk = m.limbs[0];
    assert.equal(trunk.depth, 0, m.tag);
    // the fork: low, a fifth to a quarter of the way up, never above a third
    assert.ok(trunk.tip[1] <= m.height / 3, `${m.tag}: forks at ${trunk.tip[1].toFixed(2)} m of ${m.height.toFixed(2)} m`);
    assert.ok(trunk.tip[1] > 1.2, `${m.tag}: the fork is above head height (${trunk.tip[1].toFixed(2)} m)`);
    assert.ok(trunk.r > 0.28, `${m.tag}: a thick stem (radius ${trunk.r.toFixed(2)} m)`);
    assert.ok(m.byDepth[1] >= 3 && m.byDepth[1] <= 5, `${m.tag}: ${m.byDepth[1]} main limbs`);
    // every main limb leaves the stem's own centre line, over its top third
    for (const l of m.limbs.filter((q) => q.depth === 1)) {
      assert.ok(l.from[1] > trunk.tip[1] * 0.68 && l.from[1] <= trunk.tip[1] + 1e-6, `${m.tag}: a main limb starts on the stem's top third`);
      assert.ok(Math.hypot(l.from[0] - trunk.tip[0], l.from[2] - trunk.tip[2]) < 0.6, `${m.tag}: a main limb starts on the stem`);
    }
    // and every later limb starts exactly at the tip of one of the depth above it: that is what a fork is.
    // (Depth 4 is not a fork but the HAZE OF FINE TWIGS a limb ends in -- the references' own words -- so it sprays
    //  from the tip of whatever limb ended, which is a depth 2 that did not fork again or a depth 3.)
    for (const l of m.limbs.filter((q) => q.depth >= 2 && q.depth < 4)) {
      assert.ok(m.limbs.some((o) => o.depth === l.depth - 1 && d3(o.from, l.from) !== 0 && d3(o.tip, l.from) < 1e-6),
        `${m.tag}: a limb of depth ${l.depth} forks off one of depth ${l.depth - 1}`);
      assert.ok(l.r < m.limbs.find((o) => o.depth === l.depth - 1 && d3(o.tip, l.from) < 1e-6).r, `${m.tag}: a fork is thinner than what it forks from`);
    }
    for (const l of m.limbs.filter((q) => q.depth === 4)) {
      assert.ok(m.limbs.some((o) => (o.depth === 2 || o.depth === 3) && d3(o.tip, l.from) < 1e-6),
        `${m.tag}: a twig of the haze sprays from the tip of a limb that ended`);
      assert.ok(l.len < 1.4 && l.r < 0.05, `${m.tag}: a twig of the haze is fine and short: ${l.len.toFixed(2)} m, ${l.r.toFixed(3)} m thick`);
    }
    assert.ok((m.byDepth[4] || 0) >= 6, `${m.tag}: ${m.byDepth[4] || 0} twigs of haze, so no limb ends on a full stop`);
    assert.equal(m.byDepth[2], m.byDepth[1] * 2, `${m.tag}: each main limb forks in two`);
    assert.ok((m.byDepth[3] || 0) % 2 === 0 && (m.byDepth[3] || 0) <= 12, `${m.tag}: ${m.byDepth[3] || 0} third-order twigs`);
    assert.ok(m.ends >= 6, `${m.tag}: ${m.ends} limb ends to hang leaves on`);
    rows.push(`  seed ${String(seed).padStart(3)}: ${m.limbs.length} tubes (trunk + ${m.byDepth[1]} main + ${m.byDepth[2]} forks + ${m.byDepth[3] || 0} twigs), ${m.ends} ends, fork at ${trunk.tip[1].toFixed(2)} m of ${m.height.toFixed(2)} m`);
  }
  console.log('LIMBS, near form (lod 0):');
  for (const r of rows) console.log(r);
});

test('the tubes the kit wrote down are the tubes in the mesh: the triangles add up exactly', () => {
  // (the kit's own record of its limbs is used by the tests above, so it must be checked against the thing itself:
  // every ring of every tube and every leaf card, counted by hand here, must come to the mesh's own triangle count)
  for (const lod of [0, 1]) for (const seed of SEEDS) {
    const m = measure(seed, lod, {});
    const sides = (d) => (d >= 4 ? 3 : lod ? 3 : d === 1 ? 5 : d === 2 ? 4 : 3);
    // (2026-11-19, the owner: "it looks like spiders not trees".) A limb is SAMPLED OFF A CURVE now, so it is no
    // longer one or two straight sections: a bough is four or five points (three or four sections) and a twig three.
    // That is the whole of the mend -- `tube` joins its points with STRAIGHT sections, so three points was an arch
    // drawn as two bars meeting at a corner, and that corner is what read as a knee. Depth 4 is the haze of fine
    // twigs at a limb's end, three points of three sides, near by only.
    const segs = (d) => (d >= 4 ? 2 : d >= 3 ? 2 : lod ? 3 : 4);
    let tri = lod ? 3 * 4 * 2 : 5 * 6 * 2;                        // the trunk: its rings by its sides, two each
    for (const l of m.limbs) if (l.depth > 0) tri += segs(l.depth) * sides(l.depth) * 2;
    tri += m.cards * (lod ? 2 : 4);                               // a far card is two triangles, a near one four
    assert.equal(m.tri, tri, `${m.tag}: ${m.tri} triangles in the mesh, ${tri} counted off the record`);
  }
});

test('both levels of detail stay inside their triangle budget', () => {
  const t0 = [], t1 = [], c0 = [], c1 = [];
  for (const seed of SEEDS) {
    const a = measure(seed, 0, {}), b = measure(seed, 1, {});
    t0.push(a.tri); t1.push(b.tri); c0.push(a.cards); c1.push(b.cards);
    // (2026-11-18: 3000 was a number picked in the air; the tree this one replaces, the old broadleaf,
    //  is 7,242 triangles near, and at 3000 these crowns rendered as bare winter armatures. The budget is now
    //  the old tree's own cost, which is what the wood was already paying.)
    // (2026-11-19: 11,200 was the old broadleaf's own cost and held while a limb was two straight bars. Sampling it
    //  off a curve and spraying a haze of fine twigs at its end -- what the references ask of a branch and what the
    //  owner asked for by name -- costs 5.6 per cent more: measured over 24 seeds, a mean of 10,555 before and
    //  11,145 after, the dearest seed 11,428. The budget is the dearest seed and a little over.)
    assert.ok(a.tri < 11700, `${a.tag}: ${a.tri} triangles`);
    assert.ok(b.tri < 700, `${b.tag}: ${b.tri} triangles`);
    assert.ok(b.tri < a.tri / 3, `${b.tag}: the far form is far cheaper`);
  }
  console.log(`TRIANGLES: near ${Math.min(...t0)} to ${Math.max(...t0)} (budget 11200: the owner asked for as many leaves as the trees can carry), far ${Math.min(...t1)} to ${Math.max(...t1)} (budget 700)`);
  console.log(`LEAF CARDS: near ${Math.min(...c0)} to ${Math.max(...c0)}, far ${Math.min(...c1)} to ${Math.max(...c1)}`);
});

test('it stands on the ground and its crown is as wide as it is tall or wider', () => {
  const rows = [], wh = [];
  for (const lod of [0, 1]) for (const spec of [{}, { slender: 1 }]) {
    const hs = [], ws = [], rs = [];
    for (const seed of SEEDS) {
      const m = measure(seed, lod, spec);
      assert.ok(m.barkLow <= 0, `${m.tag}: the trunk reaches the ground (lowest bark ${m.barkLow.toFixed(2)} m)`);
      assert.ok(m.barkLow > -0.5, `${m.tag}: and does not sink far into it`);
      assert.ok(m.leafLow > 0.3, `${m.tag}: no leaf is buried in the floor (lowest leaf ${m.leafLow.toFixed(2)} m)`);
      assert.ok(m.height > 6.5 && m.height < 13, `${m.tag}: ${m.height.toFixed(2)} m tall`);
      assert.ok(m.width / m.height > 0.95, `${m.tag}: crown ${m.width.toFixed(2)} m across against ${m.height.toFixed(2)} m tall`);
      assert.ok(m.width / m.height < 2.0, `${m.tag}: and not a pancake`);
      hs.push(m.height); ws.push(m.width); rs.push(m.width / m.height);
      if (lod === 0 && !spec.slender) wh.push(m.width / m.height);
    }
    rows.push(`  ${lod ? 'far ' : 'near'}${spec.slender ? ', slender' : '         '}: height ${Math.min(...hs).toFixed(1)} to ${Math.max(...hs).toFixed(1)} m, crown ${Math.min(...ws).toFixed(1)} to ${Math.max(...ws).toFixed(1)} m across, width over height ${Math.min(...rs).toFixed(2)} to ${Math.max(...rs).toFixed(2)} (middle ${med(rs).toFixed(2)})`);
  }
  console.log('SIZE:');
  for (const r of rows) console.log(r);
  assert.ok(med(wh) > 1.1, `the middling tree is wider than it is tall (${med(wh).toFixed(2)})`);
});

test('the lowest limbs reach out and down', () => {
  for (const seed of SEEDS) {
    const m = measure(seed, 0, {});
    const low = m.limbs.filter((l) => l.depth === 1).sort((a, b) => a.from[1] - b.from[1])[0];
    assert.ok(low.tip[1] < low.from[1], `${m.tag}: the lowest limb ends ${(low.from[1] - low.tip[1]).toFixed(2)} m below where it left the stem`);
    const out = Math.hypot(low.tip[0] - low.from[0], low.tip[2] - low.from[2]);
    assert.ok(out > m.height * 0.25, `${m.tag}: and reaches ${out.toFixed(2)} m out from the stem`);
  }
});

test('the leaves are many small strokes, not a few slabs', () => {
  const rows = [];
  for (const lod of [0, 1]) {
    const n = [], ll = [], ww = [];
    for (const seed of SEEDS) {
      const m = measure(seed, lod, {});
      assert.ok(m.cards >= (lod ? 240 : 560), `${m.tag}: ${m.cards} leaf cards`);
      assert.ok(m.leafLen < (lod ? 0.85 : 0.46), `${m.tag}: a leaf is ${m.leafLen.toFixed(3)} m long on average`);
      assert.ok(m.leafLen > (lod ? 0.4 : 0.22) && m.leafWid > 0.1, `${m.tag}: and not a speck`);
      assert.ok(m.cards >= m.ends * 12, `${m.tag}: ${Math.round(m.cards / m.ends)} leaves to a clump`);
      n.push(m.cards); ll.push(m.leafLen); ww.push(m.leafWid);
    }
    rows.push(`  ${lod ? 'far ' : 'near'}: ${Math.min(...n)} to ${Math.max(...n)} cards, each ${med(ll).toFixed(3)} m long and ${med(ww).toFixed(3)} m wide on average`);
  }
  console.log('LEAVES:');
  for (const r of rows) console.log(r);
});

test('no two seeds grow the same tree', () => {
  const hs = [], ns = [], rows = [];
  for (const seed of SEEDS) {
    const m = measure(seed, 0, {});
    hs.push(m.height); ns.push(m.limbs.length);
  }
  assert.equal(new Set(hs.map((h) => h.toFixed(4))).size, SEEDS.length, 'every seed a height of its own');
  assert.ok(new Set(ns).size >= 4, `the number of limbs varies: ${[...new Set(ns)].sort((a, b) => a - b).join(', ')}`);
  // two named seeds, in full
  const a = measure(1, 0, {}), b = measure(3, 0, {});
  assert.notEqual(a.height.toFixed(2), b.height.toFixed(2));
  assert.notEqual(a.limbs.length, b.limbs.length);
  assert.notEqual(a.ends, b.ends);
  for (const m of [a, b]) rows.push(`  seed ${m.tag.split(',')[0].slice(5)}: ${m.height.toFixed(2)} m tall, crown ${m.width.toFixed(2)} m across, ${m.limbs.length} tubes, ${m.byDepth[1]} main limbs, ${m.ends} leaf clumps, lean of the stem ${Math.hypot(m.limbs[0].tip[0], m.limbs[0].tip[2]).toFixed(2)} m`);
  console.log('TWO SEEDS SIDE BY SIDE:');
  for (const r of rows) console.log(r);
  console.log(`  over ${SEEDS.length} seeds: heights ${Math.min(...hs).toFixed(2)} to ${Math.max(...hs).toFixed(2)} m, tube counts ${[...new Set(ns)].sort((x, y) => x - y).join(', ')}`);
});
