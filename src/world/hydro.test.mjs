// Painted Cosmos: lakes, ponds, puddles, the mouth cut and fjords (docs/lead/WATER-DESIGN.md 3.1, 3.3, 3.5; lane W2).
// OWNER: PAINTER (the water group). Run: node --test src/world/hydro.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODE, overlayOil, waterFromSearch } from '../data/mode.js';
import { LOOKS } from '../data/looks.js';
MODE.oil = true; overlayOil(LOOKS);
waterFromSearch('?rivers=tree&lakes=1&ponds=1&puddles=1&falls=1');
const { getSurface, makeSample, NOLQ } = await import('./surface.js');
const { ensureDrainage } = await import('./drainage.js');
const { attachRivers } = await import('./rivers.js');
const HY = await import('./hydro.js');

const S = getSurface('earth');
const spawn = S.getSpawn();
const D = ensureDrainage('earth');
const net = attachRivers(S, D);
// (the test's own pond and puddle settings, so it does not depend on the looks' numbers)
const look = S.look.oil, keepP = look.ponds, keepQ = look.puddles;
look.ponds = 0.3; look.puddles = 1;
const t0 = performance.now();
const hy = HY.attachHydro(S, D, net);
const buildMs = performance.now() - t0;
look.ponds = keepP; look.puddles = keepQ;
const R = S.R;
const o = makeSample(S.nB);
const bare = (x, y, z, full) => { const h = S.hydro; S.hydro = null; try { S.sample(x, y, z, o, !!full); return { h: o.h, lq: o.lq, still: o.still, cap: o.cap, bank: o.bank }; } finally { S.hydro = h; } };
const withH = (x, y, z, full) => { S.sample(x, y, z, o, !!full); return { h: o.h, lq: o.lq, still: o.still, cap: o.cap, bank: o.bank }; };
const unit = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };

test('no switch, or no oil look: nothing is attached', () => {
  const W = MODE.water, keep = { ...W };
  try {
    // (the oil look's parts are on by default since 24 Nov, the falls too: 'no part asked for' turns each one off -- E, at
    //  the falls flip)
    waterFromSearch('?look=oil&rivers=tree&lakes=0&ponds=0&puddles=0&fjord=0&falls=0');
    const S2 = { R: 4000, hydro: null, look: {}, biomes: [], lqGroup: [] };
    assert.equal(HY.attachHydro(S2, D, null), null, 'no part asked for');
    MODE.oil = false; waterFromSearch('?lakes=1');
    assert.equal(HY.attachHydro(S2, D, null), null, 'no oil look');
  } finally { MODE.oil = true; Object.assign(W, keep); }
});

test('attached on Earth with every part asked for, in reasonable time', () => {
  assert.ok(hy, 'attached'); assert.equal(S.hydro, hy);
  assert.ok(hy.lakes && hy.ponds && hy.puddles, 'lakes, ponds and puddles on');
  assert.ok(hy.nCor >= 3, 'mouth cuts: ' + hy.nCor);
  assert.ok(buildMs < 1500, 'build ' + buildMs.toFixed(0) + ' ms');
});

test('the wood\'s hills asked straight of the noise are _forest\'s own (forestRelief)', () => {
  const keep = S.hydro;
  let n = 0, worst = 0;
  S.hydro = { forest(SS, c, b, H) { const r = HY.forestRelief(SS, c.x, c.y, c.z); worst = Math.max(worst, Math.abs(r - H.hill)); n++; }, coast(SS, c, hh) { c.lqC = NaN; return hh; } };
  try {
    for (let i = 0; i < 400; i++) { const p = unit([spawn.x + (i % 20 - 10) * 0.004, spawn.y + (Math.floor(i / 20) - 10) * 0.004, spawn.z]); S.sample(p[0], p[1], p[2], o, false); }
  } finally { S.hydro = keep; }
  assert.ok(n > 100, 'the wood was asked'); assert.ok(worst < 1e-9, 'worst ' + worst);
});

test('lakes: each basin drowns only its deepest core, at most lakeArea (about a kilometre across)', () => {
  const maxA = HY.HYDRO_DEF.lakeArea * 1e6;
  assert.ok(hy.lakeCores && hy.lakeCores.length >= 10, 'the basins measured');
  for (const L of hy.lakeCores) assert.ok(L.core <= maxA + 120 * 120, 'a core of ' + (L.core / 1e6).toFixed(2) + ' km2');
  assert.ok(hy.lakeCores.some((L) => L.area > 2 * maxA && L.f0 > D.lakeMin), 'a big basin keeps most of its wood');
  assert.ok(hy.lakeCores.some((L) => L.area < maxA && L.f0 === D.lakeMin), 'a small basin drowns whole');
});

test('lakes: the cores are open water, dead level, and the landing keeps its ground', () => {
  const g = D.g, n = g.n, d3 = [0, 0, 0], bw = new Float32Array(S.nB);
  let tot = 0, wetA = 0, wetB = 0;
  const levels = new Map();
  for (let f = 0; f < 6; f++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const p = g.pid(f, i, j);
    if (D.lvl[p] - D.ter[p] < hy.lakeF0[p] + 1.0 || D.lvl[p] > 40) continue;    // the deep part of each lake's core ...
    g.dirOf(f, i, j, d3);
    S.biomeWeights(d3[0], d3[1], d3[2], bw);                           // ... inside the wood (not on a seam with the coast)
    let wood = 0; for (let k = 0; k < S.nB; k++) if (S.biomes[k].terrain === 'forest') wood += bw[k];
    if (wood < 0.98) continue;
    const a = bare(d3[0], d3[1], d3[2]), b = withH(d3[0], d3[1], d3[2]);
    tot++; if (a.lq > a.h + 0.05) wetA++; if (b.lq > b.h + 0.05) wetB++;
    if (b.lq > b.h + 0.05) { const k = Math.round(D.lvl[p] * 100); if (!levels.has(k)) levels.set(k, []); levels.get(k).push(b.lq); }
  }
  assert.ok(tot > 60, 'core points ' + tot);
  assert.ok(wetB / tot > 0.7, 'open water: ' + (100 * wetB / tot).toFixed(0) + '% (was ' + (100 * wetA / tot).toFixed(0) + '%)');
  assert.ok(wetB > wetA * 1.5);
  for (const [kk, L] of levels) if (L.length > 3) assert.ok(Math.max(...L) - Math.min(...L) < 0.02, 'a lake is dead level: ' + kk + ' ' + Math.min(...L) + '..' + Math.max(...L) + ' n ' + L.length);
  // the landing: not in a basin, and the water nearest it is where it was
  const dl = D.at(spawn.x, spawn.y, spawn.z, D.out());
  assert.ok(dl.fill < D.lakeMin, 'the landing is in no basin');
  const a = bare(spawn.x, spawn.y, spawn.z), b = withH(spawn.x, spawn.y, spawn.z);
  assert.equal(b.h, a.h); assert.equal(b.lq, a.lq);
  for (const L of net.lakes) if (L.level < 40) {
    const dist = Math.hypot(L.centre[0] - spawn.x, L.centre[1] - spawn.y, L.centre[2] - spawn.z) * R;
    if (dist < 1500) assert.ok(a.h > L.level + 1, 'the landing stands over the sill of every lake within 1.5 km');
  }
});

test('the mouth cut: water runs down its cut to a lip at the coast\'s wall and falls into the sea', () => {
  const C = hy.cors.find((c) => c.kind === 'fall' && c.fall.drop > 10 && c.hw > 5);
  assert.ok(C, 'a wide river falls more than 10 m somewhere on Earth');
  let prev = Infinity;
  for (let k = 0; k < C.n; k++) {
    const p = [C.st[k * 3], C.st[k * 3 + 1], C.st[k * 3 + 2]];
    const b = withH(p[0], p[1], p[2]);
    if (C.arc[k] >= 0) {
      assert.ok(b.lq !== NOLQ && b.lq > b.h + 0.2, 'water stands in the cut at ' + C.arc[k].toFixed(0) + ' m: lq ' + b.lq + ' h ' + b.h);
      assert.ok(b.lq <= prev + 1e-3, 'the cut\'s water never rises toward the sea');
      prev = b.lq;
    }
  }
  // past the lip, the sea far below
  const k = C.n - 1, p = [C.st[k * 3], C.st[k * 3 + 1], C.st[k * 3 + 2]], t = [C.tg[k * 3], C.tg[k * 3 + 1], C.tg[k * 3 + 2]];
  const q = unit([p[0] + t[0] * 3 / R, p[1] + t[1] * 3 / R, p[2] + t[2] * 3 / R]);
  const b = withH(q[0], q[1], q[2]);
  assert.ok(b.h < 0 && Math.abs(b.lq - (S.sea || 0)) < 1e-6, 'the sea at the cliff\'s foot');
  // the fall's entry for world/falls.js
  const F = C.fall;
  for (const key of ['width', 'top', 'foot', 'drop', 'speed']) assert.ok(Number.isFinite(F[key]), key);
  assert.ok(Math.abs(Math.hypot(...F.dir) - 1) < 1e-6 && Math.abs(Math.hypot(...F.across) - 1) < 1e-6);
  assert.ok(Math.abs(F.dir[0] * F.lip[0] + F.dir[1] * F.lip[1] + F.dir[2] * F.lip[2]) < 1e-6, 'the way over the lip lies along the ground');
  // and every fall stands over the sea it falls into
  for (const f of hy.falls) assert.ok(f.top - f.foot > 3, 'a fall of more than 3 m');
});

test('ponds: each is held in by its rim, level, small, and none near a landing', () => {
  assert.ok(hy.nPonds > 20, 'ponds on Earth: ' + hy.nPonds);
  const P = hy.pondData;
  let checked = 0;
  for (let i = 0; i < hy.nPonds; i += 3) {
    const k = i * 14, c = [P[k], P[k + 1], P[k + 2]], e1 = [P[k + 3], P[k + 4], P[k + 5]], e2 = [P[k + 6], P[k + 7], P[k + 8]];
    const a = P[k + 9], b = P[k + 10], level = P[k + 11];
    assert.ok(a <= 22.01 && b <= a, 'small');
    const mid = withH(c[0], c[1], c[2]);
    assert.ok(Math.abs(mid.lq - level) < 1e-6 && mid.lq > mid.h + 0.3, 'water in the middle at the pond\'s level');
    for (let r = 0; r < 16; r++) {
      // (just outside the water, on the raised rim: 1.12 radii, which the outline's 13 % bend keeps inside 1.27)
      const ang = r / 16 * Math.PI * 2, u = 1.12 * a * Math.cos(ang), v = 1.12 * b * Math.sin(ang);
      const q = unit([c[0] + (e1[0] * u + e2[0] * v) / R, c[1] + (e1[1] * u + e2[1] * v) / R, c[2] + (e1[2] * u + e2[2] * v) / R]);
      const s = withH(q[0], q[1], q[2]);
      assert.ok(s.h >= level - 1e-6, 'the rim holds the water in');
    }
    for (const cl of S.clearings) assert.ok(Math.hypot(c[0] - cl.x, c[1] - cl.y, c[2] - cl.z) * R > cl.r + 60, 'away from a clearing');
    checked++;
  }
  assert.ok(checked > 5);
});

test('puddles: shallow, few, only in hollows on near-level ground', () => {
  const k = HY.HYDRO_DEF;
  assert.equal(HY.puddleCap(-0.4, 0, 0.05, k, 1), 0, 'none on a 5 % slope');
  assert.ok(HY.puddleCap(-0.4, 0, 0.005, k, 1) > 0, 'one in a hollow on level ground');
  assert.equal(HY.puddleCap(0.2, 0, 0.0, k, 1), 0, 'none on a rise');
  assert.equal(HY.puddleCap(-0.4, 0, 0.0, k, 0), 0, 'none where the look has none');
  assert.ok(HY.puddleCap(-5, 0, 0, k, 1) <= k.capMax, 'never deeper than capMax');
  let dry = 0, cap = 0;
  for (let j = 0; j < 120; j++) for (let i = 0; i < 120; i++) {
    const p = unit([spawn.x + (i - 60) * 0.0006, spawn.y + (j - 60) * 0.0006, spawn.z]);
    S.sample(p[0], p[1], p[2], o, false);
    if (o.lq > o.h - 0.3) continue;
    dry++; if (o.cap > 0) { cap++; assert.ok(o.cap <= k.capMax + 1e-9); }
  }
  assert.ok(cap > 0 && cap / dry < 0.04, 'puddles on ' + (100 * cap / dry).toFixed(2) + '% of the dry ground (at most 4 %)');
  // a hollow on a river's flat floor must be deeper (puddleCap's `deep`) ...
  assert.ok(HY.puddleCap(-0.4, 0, 0.005, k, 1, 0.12) < HY.puddleCap(-0.4, 0, 0.005, k, 1), 'shallower on a river floor');
  assert.equal(HY.puddleCap(-0.2, 0, 0.005, k, 1, 0.12), 0, 'none in a shallow hollow on a river floor');
  // ... so beside the widest rivers, whose floors are near level all the way across, they stay few too (measured 24 Nov:
  // 5 to 9 % there before the floor rule)
  let wide = -1, ww = 0;
  for (let s = 0; s < net.nSeg; s++) { const w = Math.min(net.sW[2 * s], net.sW[2 * s + 1]); if (w > ww) { ww = w; wide = s; } }
  assert.ok(wide >= 0 && ww >= 6, 'a wide river on Earth: half width ' + ww);
  const a = wide * 3, m = unit([(net.sA[a] + net.sB[a]) / 2, (net.sA[a + 1] + net.sB[a + 1]) / 2, (net.sA[a + 2] + net.sB[a + 2]) / 2]);
  dry = 0; cap = 0;
  for (let j = 0; j < 120; j++) for (let i = 0; i < 120; i++) {
    const p = unit([m[0] + (i - 60) * 0.0006, m[1] + (j - 60) * 0.0006, m[2]]);
    S.sample(p[0], p[1], p[2], o, true);   // (full: o.s, the metres from the water's edge, is written only then)
    if (o.lq > o.h - 0.3) continue;
    dry++; if (o.cap > 0) cap++;
    if (o.cap > 0 && o.s < k.capBank[0]) assert.fail('a puddle at the water\'s edge');
  }
  assert.ok(cap / dry < 0.04, 'beside the widest river puddles on ' + (100 * cap / dry).toFixed(2) + '% of the dry ground (at most 4 %)');
});

test('the cross sections are continuous where they meet the land', () => {
  // the cut's bank meets the shelf T at hw + B, and its bed the edge depth at hw
  const hw = 6, B = 5, lv = 20, T = 25;
  assert.ok(Math.abs(HY.mouthCut(hw + B, hw, B, lv, 1, 0.22, T) - T) < 1e-9);
  assert.ok(Math.abs(HY.mouthCut(hw - 1e-9, hw, B, lv, 1, 0.22, T) - HY.mouthCut(hw + 1e-9, hw, B, lv, 1, 0.22, T)) < 1e-6);
  assert.ok(HY.mouthCut(0, hw, B, lv, 1, 0.22, T) < lv - 1, 'water stands over the bed');
  assert.ok(Math.abs(HY.fjordCut(30 + 8, 30, 8, 0, 12, 24) - 24) < 1e-9);
  assert.ok(HY.fjordCut(0, 30, 8, 0, 12, 24) <= -11.99);
  const out = [0];
  assert.ok(HY.pondAt(0, 30, 28, 1, out) < 28 && out[0] === 28);
  assert.ok(HY.pondAt(1.2, 27.5, 28, 1, out) >= 28 && out[0] !== out[0], 'the rim stands over the level');
});

test('outside every lake, pond, puddle and cut the ground is exactly as it was', () => {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let same = 0, inside = 0, other = 0;
  for (let i = 0; i < 6000; i++) {
    let p = unit([rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1]);
    if (i % 2) p = unit([spawn.x + (rnd() - 0.5) * 0.5, spawn.y + (rnd() - 0.5) * 0.5, spawn.z + (rnd() - 0.5) * 0.5]);
    const a = bare(p[0], p[1], p[2], true), b = withH(p[0], p[1], p[2], true);
    if (a.h === b.h && a.lq === b.lq) { same++; continue; }
    // a changed point must be inside one of the parts
    const dr = D.at(p[0], p[1], p[2], D.out());
    const q = hy._near(p[0], p[1], p[2]);
    const inCut = q.i >= 0 && q.t >= hy.cors[q.i].t0 - 1 && q.t <= hy.cors[q.i].tLip + 5;
    if (dr.fill > D.lakeMin || inCut || b.still === 1) inside++;
    else other++;
  }
  assert.equal(other, 0, 'changed outside every part: ' + other + ' (same ' + same + ', inside ' + inside + ')');
  assert.ok(same > 4000);
});

test('only a world whose look asks for them gets them: with every switch on, Venus and Neptune are as they were', () => {
  for (const id of ['venus', 'neptune']) {
    const S2 = getSurface(id), D2 = ensureDrainage(id);
    if (!D2) continue;
    assert.equal(HY.attachHydro(S2, D2, S2.rivers), null, id + ' gets no water parts');
    assert.equal(S2.hydro, null);
  }
});
