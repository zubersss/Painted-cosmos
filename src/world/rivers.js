// Painted Cosmos: RIVERS DRAWN FROM THE DRAINAGE FIELD'S OWN FLOW TREE (?rivers=tree). OWNER: PAINTER (the water group,
// lane W1). docs/lead/WATER-DESIGN.md, section 3.2.
//
// The owner, 23-24 Nov: water that goes "down hill and pools in areas it can't find go downhill any further", "how the water
// collects and drifts into ponds or into runways into the rivers and oceans". Until now the oil look's rivers were the zero
// lines of noise fields (surface.js _riversOil): organic up close, but a zero line on a sphere is a CLOSED LOOP, so the
// rivers ran in rings round the hills, never all the way downhill and never to the sea (the maps of 24 Nov). The drainage
// field (world/drainage.js) already knows where every drop of rain on the world runs: this file draws the rivers ALONG
// that flow, so every stream joins a bigger one, every river ends at a lake, the sea or the edge of the wood, and they
// widen downstream as the land they drain grows.
//
// WHAT IS BUILT, ONCE A WORLD (attachRivers, at load, after the drainage field):
//   1. the river nodes: the field's nodes with at least `a1` nodes draining through them, on water-bearing ground (a wood
//      or the pools; a biome with no water of its own carries none);
//   2. the LEVEL each river node's water stands at: the filled level, never more than `cutMax` under the base field, and
//      never above any node upstream of it (a running minimum down the tree), so the water runs DOWNHILL ALL THE WAY;
//   3. the REACHES: chains of nodes from a source or a junction to the next junction, the sea, or the wood's edge;
//   4. each river as ONE SMOOTH CURVE through its nodes, on through every junction where it is the main stream (Catmull-Rom;
//      a tributary arrives along the river it joins, so it meets it at a slant, as a real one does), BENT: a stream wanders
//      (a noise across the curve, wavelength eleven times the width), a wide river swings in S-BENDS (the sine-generated
//      curve of real meanders, wavelength sixteen widths, a bend's radius about three widths, with a sand bar inside each);
//      held to nothing at its ends, and a tributary carried to where the river it joins was bent to; cut into segments of
//      `seg` metres with the width, the level and the turn at each;
//   5. an INDEX: every field node lists the segments within reach of it (exact distances near water), and a coarse field of
//      the distance to the nearest river and that river's level at every node (for the land far from water).
// WHAT A SAMPLE ASKS (net.sample, called from surface.js _base): the distance to the nearest water in the terms _riversOil
// returns it, and the current, a pool, a bar, the water's level and the base level graded toward the river (see the
// contract below). Rivers wide enough get the bars, the islands and the second arm the owner liked (the same shapes as
// _riversOil, laid along these curves); TWIGS, the finest threads, are still the third noise field, now ending where they
// meet a river or a stream of the tree.
//
// THE CONTRACT (fixed by lane 0; world/waterhooks.js calls attachRivers once a world, before its first patch):
//   attachRivers(S, drain)   build the network and set S.rivers = net; return net (or null: nothing attached).
//   net.sample(S, c)         with c.x, c.y, c.z (the unit direction) and c.L (the wood's base level) set. Sets, EVERY time:
//                            c.pool, c.bar, c.barZone (the bar and 6 m beyond: where trees stand back), c.fu, c.fv, c.still,
//                            c.swell, c.lvR (the water level, which surface.js _forest
//                            uses in place of the staircase) and c.L (the base level, graded toward the river); RETURNS the
//                            distance to the nearest water (under the nominal half width 2.5 m inside a channel; beyond it,
//                            metres from the water's edge), which _forest reads as c.s.
//   net.mouths               [{ end, lip, width, levelTop, levelSea, dir }]   a river's end at a coast (world/hydro.js)
//   net.lakes                [{ level, sill, out, nodes, centre }]            the basins the field fills (world/hydro.js)
import { smoothstep } from './noise.js';
import { MODE } from '../data/mode.js';

export const RIVER_DEF = {
  a1: 24,          // nodes draining through: a stream starts (64 a face edge: 98 m cells, so 24 nodes is 0.23 km2 of land)
  wMin: 1.4,       // metres of full width: a stream at its source ...
  wK: 2.2,         // ... growing as the root of what drains through it, w = wMin + wK sqrt(acc / 10) ...
  wMax: 26,        // ... to at most this
  seg: 12,         // metres the curve is sampled at (a third of it along S-bends) ...
  sag: 0.25,       // ... and then thinned: no point of it further than this from a segment ...
  segMax: 24,      // ... and no segment longer than this (metres)
  lam: 11,         // the meander's wavelength in widths (the field ratio of meanders), never under lamMin metres ...
  lamMin: 70,
  meander: 0.2,    // ... and how far it swings, a share of its wavelength
  wander: 26,      // metres: a slower wander on top (350 m), so a stream on an even slope is not a ruled line
  bends: 1,        // the wide rivers' S-BENDS (?bends=0: the streams' wander on them too, as W1 first had it)
  bendW: [8, 16],  // metres of full width over which a river's wander gives way to the S-bends
  bendLam: 16,     // the S-bends' wavelength in widths: longer than the field ratio (10 to 14), for the LONG bends of the owner's
                   // sheets (at 12 they read as a wiggle from the air: the maps of 24 Nov); a bend's radius is about 0.2 of it
  bendOmega: 1.25, // radians: how far the river swings from the valley's line where it crosses it (the sine-generated curve's
                   // omega, varied from 0.8 to 1.35 of this along the river): the swing is about a quarter wavelength each way
  bendJit: 0.3,    // wavelengths: how far a bend may run early or late, so they are not a ruled wave
  bendSmooth: 6,   // passes of smoothing more for the wide rivers' nodes (their bends their own, not the grid's turns)
  smooth: 3,       // passes of smoothing over the nodes (the grid's 45-degree zigzag out of the curve)
  mountW: 5,       // ?mount=1 (world/mountain.js): a stream's full width at most on the mountains, and the share of the wood's
  mountWander: 0.7, //   wander and meander it keeps there (torrents run straight down), and the catchment a stream starts at
  mountA1: 6,      //   there (nodes: the mountain's own flow runs into a hundred small valleys, each draining about forty),
  mountSink: 0.5,  //   and how far its water stands under the mountain's large-scale height (metres), and the deepest gorge
  mountCut: 10,    //   it cuts through a rise across it (metres; past that it runs dry over it)
  edgeThin: 90,    // metres: a river that ends at the edge of the wood (a marsh, a dry biome) thins away over this
  springs: null,   // [{ near: [x, y, z], up, acc, ramp }]: catchment added so a stream runs past a place (a look's oil.springs)
  keep: null,      // [{ near: [x, y, z], r }]: places a river bends round, its water's edge kept r metres off (a look's oil.keep)
  near: 100,       // metres: the exact distance is asked of the segments within this; beyond, the coarse field
  grade: [55, 220], // metres from the centre line: the base level is graded toward the river's own over the first, eased to
                    // the land's own by the second
  cutMax: 3.0,     // metres: how far the river may be let down under the base field to keep its level running downhill
  depth: 0.42,     // metres: the water stands this far under the graded base level (the channel's bed is 0.4 to 0.95 under it)
  wetMin: 0.85,    // the share of a node that must be ground with water of its own for a river to stand on it
  seaMin: 0.4,     // ... and the share of sea where a river's end is a MOUTH
};

const W = 2.5;     // the nominal channel half width the land's recipes are written for (surface.js _forest)

// ---- the build ------------------------------------------------------------------------------------------------------

export function buildRivers(S, D, opts) {
  const o = Object.assign({}, RIVER_DEF, opts || {});
  if (!D || !D.to || !D.accF || !D.ordR) return null;          // the field must have kept its flow tree (drainage.js)
  const t0 = now();
  const g = D.g, n = g.n, R = S.R, lvl = D.lvl, ter = D.ter, len = g.len;
  let to = D.to, accF = D.accF, ord = D.ordR;
  // node directions and what kind of ground each node is
  const dir = new Float64Array(len * 3), wet = new Float32Array(len).fill(-1), sea = new Float32Array(len).fill(-1);
  const bw = new Float32Array(S.nB), d3 = [0, 0, 0];
  for (let f = 0; f < 6; f++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const p = g.pid(f, i, j);
    g.dirOf(f, i, j, d3); dir[p * 3] = d3[0]; dir[p * 3 + 1] = d3[1]; dir[p * 3 + 2] = d3[2];
  }
  // what kind of ground a node is (asked only of the nodes that could carry a river, and of where they end: a twentieth)
  const kind = (p) => {
    if (wet[p] >= 0) return;
    S.biomeWeights(dir[p * 3], dir[p * 3 + 1], dir[p * 3 + 2], bw);
    let a = 0, b = 0;
    for (let k = 0; k < S.nB; k++) { const lg = S.lqGroup[k]; if (lg === 0 || lg === 2) a += bw[k]; else if (lg === 1) b += bw[k]; }
    wet[p] = a; sea[p] = b;
  };
  // THE MOUNTAINS (?mount=1, world/mountain.js). The field takes them for a wall (it routes the wood's water round them), and
  // their own terrain is ridges round closed valleys: a field filled over it fills a quarter of the mountain's nodes, some by
  // hundreds of metres (measured 24 Nov), and its streams climb over saddles. So the mountains get their own LOCAL flow: from
  // each node down its steepest slope on the mountain's own height (hM, the alpine recipe's large scale), into the valley
  // floors, where a torrent ends (it sinks into the meadow) or runs on off the mountain into the wood's own tree. The tree,
  // the catchments and the order below are this hybrid's; the field itself is untouched.
  const MT = S.mount, aS = MT ? new Float32Array(len) : null, hM = MT ? new Float32Array(len) : null;
  if (MT) {
    const ww = new Float32Array(S.nB), nb8 = new Int32Array(8), sh = D.share;
    for (let f = 0; f < 6; f++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const p = g.pid(f, i, j), x = dir[p * 3], y = dir[p * 3 + 1], z = dir[p * 3 + 2];
      let a = 0;
      if (sh) a = sh[p];
      else { S.biomeWeights(x, y, z, ww); for (const k of MT.idx) a += ww[k]; }
      aS[p] = a;
      // (the mountain's height where the mountain's flow is asked: its own nodes, over half mountain, and their neighbours)
      hM[p] = a > 0.25 ? MT.baseAt(S, x, y, z, ww, undefined, !sh) : ter[p];
    }
    const to2 = Int32Array.from(to), indeg = new Int32Array(len);
    for (let f = 0; f < 6; f++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const p = g.pid(f, i, j);
      if (aS[p] <= 0.5) continue;
      const k = D._nbs(p, nb8);
      let best = -1, bs = 0;
      for (let t = 0; t < k; t++) {
        const q = nb8[t], dd = len3(dir[p * 3] - dir[q * 3], dir[p * 3 + 1] - dir[q * 3 + 1], dir[p * 3 + 2] - dir[q * 3 + 2]) || 1;
        const sl = (hM[p] - hM[q]) / dd;
        if (sl > bs) { bs = sl; best = q; }
      }
      to2[p] = best;
    }
    // (the order, sources first, by peeling the nodes nothing drains into; a loop where the wood's tree runs back into the
    //  mountain's, if any, is left out)
    const ord2 = new Int32Array(ord.length);
    let nO = 0;
    for (let t = 0; t < ord.length; t++) { const q = to2[ord[t]]; if (q >= 0) indeg[q]++; }
    for (let t = 0; t < ord.length; t++) if (indeg[ord[t]] === 0) ord2[nO++] = ord[t];
    for (let h0 = 0; h0 < nO; h0++) { const q = to2[ord2[h0]]; if (q >= 0 && --indeg[q] === 0) ord2[nO++] = q; }
    const acc2 = new Float32Array(len);
    for (let t = 0; t < nO; t++) acc2[ord2[t]] = 1;
    for (let t = 0; t < nO; t++) { const p = ord2[t], q = to2[p]; if (q >= 0) acc2[q] += acc2[p]; }
    // (the rest of the build walks `ord` outlet first: reversed)
    const ordR2 = new Int32Array(nO);
    for (let t = 0; t < nO; t++) ordR2[t] = ord2[nO - 1 - t];
    to = to2; accF = acc2; ord = ordR2;
    if (globalThis.__MTDBG) { const h = [0, 0, 0, 0, 0, 0]; let pits = 0, nm = 0; for (let p = 0; p < len; p++) { if (aS[p] <= 0.5) continue; nm++; if (to2[p] < 0) pits++; const a = acc2[p]; h[a >= 48 ? 5 : a >= 24 ? 4 : a >= 12 ? 3 : a >= 6 ? 2 : a >= 3 ? 1 : 0]++; } console.log('mountain nodes', nm, 'pits', pits, 'acc <3,3+,6+,12+,24+,48+', h.join(' ')); }
  }
  // (springs: catchment added at a node a few steps up the tree from a place, and carried down its path, so that a stream
  //  runs past it: the landing's brook, which the noise rivers had by `oil.riverAt`)
  if (o.springs) for (const sp of o.springs) {
    let p = g.idOf(sp.near[0], sp.near[1], sp.near[2]);
    for (let k = 0; k < (sp.up || 0); k++) {
      let best = -1;
      for (let q = 0; q < len; q++) if (to[q] === p && (best < 0 || accF[q] > accF[best])) best = q;
      if (best < 0) break;
      p = best;
    }
    // (`ramp`: the catchment added grows over that many nodes from where it starts, so a river fed by it widens down to the
    //  place as a river does, instead of starting full width)
    const ramp = sp.ramp || 0;
    for (let guard = 0; p >= 0 && guard < 5000; guard++) { accF[p] += (sp.acc || 30) * (ramp > 0 ? Math.min(1, (guard + 1) / ramp) : 1); p = to[p]; }
  }
  // 1. the river nodes
  const isR = new Uint8Array(len);
  for (let f = 0; f < 6; f++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const p = g.pid(f, i, j);
    if (accF[p] >= (aS && aS[p] > 0.5 ? o.mountA1 : o.a1)) { kind(p); if (wet[p] >= o.wetMin) isR[p] = 1; }
  }
  const par = new Uint8Array(len);
  for (let p = 0; p < len; p++) if (isR[p] && to[p] >= 0 && isR[to[p]]) par[to[p]]++;
  // 2. the levels, down the tree (ord is the routing flood's pop order, the outlet first: walked backwards, every node
  //    comes after everything upstream of it)
  const P = new Float32Array(len).fill(Infinity);
  for (let t = ord.length - 1; t >= 0; t--) {
    const p = ord[t];
    if (!isR[p]) continue;
    // (?mount=1: on the mountains a stream's level is the mountain's own height, down which it runs)
    const own = aS && aS[p] > 0.5 ? hM[p] - o.cutMax : Math.max(lvl[p], ter[p] - o.cutMax);
    if (own < P[p]) P[p] = own;
    const q = to[p];
    if (q >= 0 && isR[q] && P[p] < P[q]) P[q] = P[p];
  }
  // the main parent of each node (the one draining the most), for the curve's tangent through a junction
  const main = new Int32Array(len).fill(-1);
  for (let p = 0; p < len; p++) {
    if (!isR[p] || to[p] < 0 || !isR[to[p]]) continue;
    const q = to[p];
    if (main[q] < 0 || accF[p] > accF[main[q]]) main[q] = p;
  }
  // 3. the reaches
  const reaches = [], mouths = [];
  for (let p0 = 0; p0 < len; p0++) {
    if (!isR[p0] || (par[p0] === 1)) continue;                 // a reach starts at a source (no parent) or a junction
    const pts = [p0];
    let p = p0, end = 'outlet', endNode = -1;
    for (let guard = 0; guard < 20000; guard++) {
      const q = to[p];
      if (q < 0) { end = 'outlet'; break; }
      if (!isR[q]) { kind(q); end = sea[q] >= o.seaMin ? 'sea' : 'edge'; endNode = q; break; }
      pts.push(q);
      if (par[q] >= 2) { end = 'join'; break; }
      p = q;
    }
    if (pts.length < 2 && end !== 'sea') continue;
    reaches.push({ pts, end, endNode, before: par[p0] >= 2 ? main[p0] : -1 });
  }
  // ... and the STEMS the curves are drawn along: from a source down through every junction where it is the river that drains
  //     the most there (the main parent), to where it joins a bigger river, the sea, the wood's edge or an outlet. A river is
  //     ONE curve through all its junctions, so its bends run on through them (the owner's sheets: one main river winding
  //     down the whole picture in long S-bends); a stem that joins a bigger one is drawn after it, and arrives where that
  //     river's bends have carried the junction.
  const pieceR = new Int32Array(len).fill(-1);                  // the reach each node's piece of curve (to the next) is in
  for (let ri = 0; ri < reaches.length; ri++) { const ps = reaches[ri].pts; for (let k = 0; k + 1 < ps.length; k++) pieceR[ps[k]] = ri; }
  const rank = new Int32Array(len).fill(len);
  for (let t = 0; t < ord.length; t++) rank[ord[t]] = t;
  const stems = [];
  for (let p0 = 0; p0 < len; p0++) {
    if (!isR[p0] || par[p0] !== 0) continue;                    // (every stem starts at a source: a junction continues its main parent's)
    const pts = [p0];
    let p = p0, end = 'outlet', endNode = -1, join = -1;
    for (let guard = 0; guard < 20000; guard++) {
      const q = to[p];
      if (q < 0) break;
      if (!isR[q]) { kind(q); end = sea[q] >= o.seaMin ? 'sea' : 'edge'; endNode = q; break; }
      if (main[q] !== p) { end = 'join'; join = q; break; }
      pts.push(q); p = q;
    }
    if (pts.length < 2 && end !== 'sea' && end !== 'join') continue;
    stems.push({ pts, end, endNode, join });
  }
  // (the routing order puts every node before everything upstream of it: by their last node, the rivers come before their
  //  tributaries)
  stems.sort((a, b) => rank[a.pts[a.pts.length - 1]] - rank[b.pts[b.pts.length - 1]]);
  const tStems = now();
  // 4. the curves and their segments
  const SA = [], SB = [], SW = [], SP = [], SQ = [], SR = [], SK = [], SM = [];   // (built as plain arrays, packed below)
  const pt = new Float64Array(3);
  const width = (a) => Math.min(o.wMax, o.wMin + o.wK * Math.sqrt(a / 10));
  const wOf = (q, a) => { const w = width(a); return aS ? w + (Math.min(w, o.mountW) - w) * aS[q] : w; };
  const bendOf = (w) => (o.bends ? smoothstep(o.bendW[0], o.bendW[1], w) : 0);   // 0..1: how much a river of S-bends this is
  const nC = S.nC.n3;
  // (a) the nodes smoothed along their stems, the stem's two ends held (the grid's stair of 45-degree steps is taken out;
  //     the wide rivers smoothed further, so their bends are their own and not the grid's turns)
  const spos = Float64Array.from(dir);
  for (const st of stems) {
    const cn = st.end === 'join' ? st.pts.concat([st.join]) : st.pts, m = cn.length;
    if (m < 3) continue;
    const ps = new Float64Array(m * 3), pv = new Float64Array(m * 3), f2 = new Float32Array(m);
    for (let k = 0; k < m; k++) { const q = cn[k]; ps[k * 3] = spos[q * 3]; ps[k * 3 + 1] = spos[q * 3 + 1]; ps[k * 3 + 2] = spos[q * 3 + 2]; f2[k] = bendOf(wOf(q, accF[q])); }
    const passes = o.smooth + (o.bends ? o.bendSmooth : 0);
    for (let it = 0; it < passes; it++) {
      pv.set(ps);
      for (let k = 1; k < m - 1; k++) {
        const f = it < o.smooth ? 1 : f2[k];
        if (f <= 0) continue;
        for (let i = 0; i < 3; i++) ps[k * 3 + i] = pv[k * 3 + i] + f * 0.25 * (pv[(k - 1) * 3 + i] + pv[(k + 1) * 3 + i] - 2 * pv[k * 3 + i]);
      }
    }
    for (let k = 1; k < m - 1; k++) { const q = cn[k]; spos[q * 3] = ps[k * 3]; spos[q * 3 + 1] = ps[k * 3 + 1]; spos[q * 3 + 2] = ps[k * 3 + 2]; }
  }
  const tSmooth = now();
  // (b) each stem's curve, bent, cut into segments
  const outOf = new Int32Array(len).fill(-1), idxOf = new Int32Array(len), stemOut = [];   // each node's point on its river's curve
  const thinned = new Set();                                              // the reaches the thinning at a wood's edge reaches into
  const P3 = (q) => [spos[q * 3], spos[q * 3 + 1], spos[q * 3 + 2]];
  for (let si = 0; si < stems.length; si++) {
    const st = stems[si], join = st.end === 'join';
    const cn = join ? st.pts.concat([st.join]) : st.pts, m = cn.length, own = join ? m - 1 : m;
    const last = st.pts[st.pts.length - 1];
    // the control points: the nodes, with one more at each end for the curve's tangent there (at a junction the curve
    // arrives along the river it joins, so a tributary meets it at a slant, as a real one does)
    const ctl = [null];
    for (const q of cn) ctl.push(P3(q));
    if (join && to[st.join] >= 0) ctl.push(P3(to[st.join]));
    else if ((st.end === 'sea' || st.end === 'edge') && st.endNode >= 0) ctl.push(P3(st.endNode));
    else ctl.push(null);
    if (m < 2) {      // a mouth right at a source: a stub toward the sea
      mouths.push({ end: ctl[1].slice(), lip: ctl[2] ? ctl[2].slice() : ctl[1].slice(), width: wOf(last, accF[last]), levelTop: P[last], levelSea: S.sea == null ? 0 : S.sea, dir: null, reach: pieceR[last] });
      continue;
    }
    if (!ctl[0]) ctl[0] = [2 * ctl[1][0] - ctl[2][0], 2 * ctl[1][1] - ctl[2][1], 2 * ctl[1][2] - ctl[2][2]];
    const L1 = ctl.length - 1;
    if (!ctl[L1]) ctl[L1] = [2 * ctl[L1 - 1][0] - ctl[L1 - 2][0], 2 * ctl[L1 - 1][1] - ctl[L1 - 2][1], 2 * ctl[L1 - 1][2] - ctl[L1 - 2][2]];
    // the curve sampled every `seg` metres, before the bends (a tributary keeps its own width and catchment to the junction;
    // its level falls to the river's there). A stretch of S-bends is sampled twice as finely: the bends stretch it three times
    // where they cross the valley, where it runs straight; the curve is thinned to what it needs below.
    const at = new Int32Array(m), stp = new Int32Array(m);
    let nR = 1;
    for (let k = 0; k < m - 1; k++) {
      const b = ctl[k + 1], c = ctl[k + 2];
      const chord = len3(c[0] - b[0], c[1] - b[1], c[2] - b[2]) * R;
      const toJ = join && k === m - 2, qa = accF[cn[k]], qb = toJ ? qa : accF[cn[k + 1]];
      stp[k] = Math.max(1, Math.ceil(chord / (bendOf(Math.max(wOf(cn[k], qa), wOf(toJ ? cn[k] : cn[k + 1], qb))) > 0 ? o.seg / 2 : o.seg)));
      nR += stp[k];
    }
    const X = new Float64Array(nR), Y = new Float64Array(nR), Z = new Float64Array(nR), RW = new Float64Array(nR);
    const RP = new Float64Array(nR), RQ = new Float64Array(nR), RR = new Int32Array(nR), RA = aS ? new Float32Array(nR) : null;
    let nk = 0;
    for (let k = 0; k < m - 1; k++) {
      const a = ctl[k], b = ctl[k + 1], c = ctl[k + 2], d = ctl[k + 3], steps = stp[k];
      const toJ = join && k === m - 2, qa = accF[cn[k]], qb = toJ ? qa : accF[cn[k + 1]], kb = toJ ? cn[k] : cn[k + 1];
      const wa = wOf(cn[k], qa), wb = wOf(kb, qb), pa = P[cn[k]], pb = P[cn[k + 1]], r = pieceR[cn[k]];
      const aa = aS ? aS[cn[k]] : 0, ab = aS ? aS[kb] : 0;
      at[k] = nk;
      for (let s = 0; s < steps; s++, nk++) {
        const u = s / steps;
        catmull(a, b, c, d, u, pt);
        const l = len3(pt[0], pt[1], pt[2]);
        X[nk] = pt[0] / l; Y[nk] = pt[1] / l; Z[nk] = pt[2] / l; RW[nk] = wa + (wb - wa) * u; RP[nk] = pa + (pb - pa) * u; RQ[nk] = qa + (qb - qa) * u; RR[nk] = r;
        if (RA) RA[nk] = aa + (ab - aa) * u;
      }
    }
    {
      const b = ctl[m], l = len3(b[0], b[1], b[2]), ke = join ? cn[m - 2] : cn[m - 1], qe = accF[ke];
      at[m - 1] = nk;
      if (RA) RA[nk] = aS[ke];
      X[nk] = b[0] / l; Y[nk] = b[1] / l; Z[nk] = b[2] / l; RW[nk] = wOf(ke, qe); RP[nk] = P[cn[m - 1]]; RQ[nk] = qe; RR[nk] = pieceR[cn[m - 2]];
    }
    const sArr = new Float64Array(nR);
    for (let k = 1; k < nR; k++) sArr[k] = sArr[k - 1] + len3(X[k] - X[k - 1], Y[k] - Y[k - 1], Z[k] - Z[k - 1]) * R;
    const arc = sArr[nR - 1];
    // THE BENDS: a push across the curve. A stream wanders (a noise along it, wavelength eleven times its width); a wide river
    // swings in S-BENDS, the sine-generated curve of real meanders (wavelength `bendLam` widths, the swing's angle `bendOmega`
    // varied along it, so one stretch runs in tight loops and the next nearly straight). The phase is carried along the
    // whole stem, so the bends run on through its junctions; both are held to nothing at the stem's ends.
    const sx = (cn[0] % 997) * 1.37 + 31.7, sy = (cn[0] % 389) * 2.11 - 8.3, sz = 55.1;
    const lamN0 = Math.max(o.lamMin, o.lam * RW[0]), lamN1 = Math.max(o.lamMin, o.lam * RW[nR - 1]);
    const b0 = bendOf(RW[0]), b1 = bendOf(RW[nR - 1]);
    const lamB0 = Math.max(o.lamMin, o.bendLam * RW[0]), lamB1 = Math.max(o.lamMin, o.bendLam * RW[nR - 1]);
    const tA = Math.min(lamN0 + (lamB0 - lamN0) * b0, arc / 3), tB = Math.min(lamN1 + (lamB1 - lamN1) * b1, arc / 3);
    // (a tributary's last stretch carried onto the river it joins, now that river is bent: to the NEAREST point of its curve
    //  to the junction, which the bends never carry far, and over a length that grows with the carry; carried to where the
    //  junction itself went, a short tributary folded back on itself, 24 Nov)
    let dx0 = 0, dy0 = 0, dz0 = 0, Ls = 1;
    if (join && outOf[st.join] >= 0) {
      const J = st.join, po = stemOut[outOf[J]], j0 = idxOf[J], bx = spos[J * 3] * R, by = spos[J * 3 + 1] * R, bz = spos[J * 3 + 2] * R;
      let bd2 = Infinity, bi = j0;
      for (let k = Math.max(0, j0 - 60); k <= Math.min(po.n - 1, j0 + 60); k++) {
        const ex = po.x[k] - bx, ey = po.y[k] - by, ez = po.z[k] - bz, d2 = ex * ex + ey * ey + ez * ez;
        if (d2 < bd2) { bd2 = d2; bi = k; }
      }
      dx0 = (po.x[bi] - bx) / R; dy0 = (po.y[bi] - by) / R; dz0 = (po.z[bi] - bz) / R;
      const dd = Math.sqrt(bd2);
      Ls = dd > 0.01 ? (2.5 * dd > arc * 0.6 ? arc : Math.max(Math.min(60, arc * 0.6), 2.5 * dd)) : 1;
    }
    const thinEnd = st.end === 'edge' || (st.end === 'outlet' && aS && aS[last] > 0.5) ? o.edgeThin : 0;
    const OX = new Float64Array(nR), OY = new Float64Array(nR), OZ = new Float64Array(nR), OH = new Float64Array(nR);
    let phN = 0, phB = 0;
    // (the slow noises -- how tight the bends, how early or late, the 350 m wander -- asked on a coarse grid along the river
    //  and eased between: they change over hundreds of metres, and asking them at every point of a river sampled every 6 m was
    //  most of the build's time)
    const GB = 0.0625, GS = 24, k1 = R / 350;
    let gB = -1, om0 = 0, om1 = 0, jt0 = 0, jt1 = 0, gS = -1, wd0 = 0, wd1 = 0, wk0 = 0, wk1 = 0;
    const omAt = (g) => Math.max(0.15, Math.min(SB_WMAX, o.bendOmega * (0.8 + 0.55 * nC(g * GB * 0.29 + sy, sz - 3.1, sx + 7.7))));
    const jtAt = (g) => o.bendJit * nC(g * GB * 0.23 - sz, sx + 1.9, sy - 4.4);
    const wdAt = (k) => o.wander * nC(X[k] * k1 - 17.2, Y[k] * k1 + 40.4, Z[k] * k1 - 3.3);
    for (let k = 0; k < nR; k++) {
      const ka = k > 0 ? k - 1 : 0, kb = k < nR - 1 ? k + 1 : nR - 1, sGo = sArr[k], w = RW[k];
      if (k > 0) { const ds = sGo - sArr[k - 1], wm = (w + RW[k - 1]) * 0.5; phN += ds / Math.max(o.lamMin, o.lam * wm); phB += ds / Math.max(o.lamMin, o.bendLam * wm); }
      const qx = X[k], qy = Y[k], qz = Z[k], tx = X[kb] - X[ka], ty = Y[kb] - Y[ka], tz = Z[kb] - Z[ka];
      // across: up x along
      let ax = qy * tz - qz * ty, ay = qz * tx - qx * tz, az = qx * ty - qy * tx;
      const al = len3(ax, ay, az) || 1; ax /= al; ay /= al; az /= al;
      const bd = bendOf(w);
      const hold = smoothstep(0, tA, sGo) * smoothstep(0, tB, arc - sGo);
      let swing = bd < 1 ? (1 - bd) * o.meander * Math.max(o.lamMin, o.lam * w) * nC(phN + sx, sy, sz) : 0;
      if (bd > 0) {
        const gf = phB / GB, g = Math.floor(gf), u = gf - g;
        if (g !== gB) { gB = g; om0 = omAt(g); om1 = omAt(g + 1); jt0 = jtAt(g); jt1 = jtAt(g + 1); }
        swing += bd * Math.max(o.lamMin, o.bendLam * w) * sbend(phB + jt0 + (jt1 - jt0) * u, om0 + (om1 - om0) * u);
      }
      // (the wander asked at the raw points every GS metres, eased between them)
      const gs = Math.floor(sGo / GS);
      if (gs !== gS) {
        gS = gs;
        let a0 = k; while (a0 > 0 && sArr[a0] > gs * GS) a0--;
        let a1 = k; while (a1 < nR - 1 && sArr[a1] < (gs + 1) * GS) a1++;
        wk0 = a0; wk1 = a1; wd0 = wdAt(a0); wd1 = a1 !== a0 ? wdAt(a1) : wd0;
      }
      const sp = sArr[wk1] - sArr[wk0];
      swing += sp > 0 ? wd0 + (wd1 - wd0) * Math.max(0, Math.min(1, (sGo - sArr[wk0]) / sp)) : wd0;
      const push2 = hold * swing * (RA ? 1 - (1 - o.mountWander) * RA[k] : 1) / R;
      let x = qx + ax * push2, y = qy + ay * push2, z = qz + az * push2;
      if (Ls > 1) { const f = 1 - smoothstep(0, Ls, arc - sGo); x += dx0 * f; y += dy0 * f; z += dz0 * f; }
      // (a place the river bends round -- the landing, which the owner's first look must find dry, with the river past it --
      //  its water's edge kept `r` off: a point nearer is carried out along the line from the place, eased so the bank is
      //  smooth; a river that passes farther off is as it was)
      if (o.keep) for (const kp of o.keep) {
        const kx = kp.near[0], ky = kp.near[1], kz = kp.near[2];
        let vx = x - kx, vy = y - ky, vz = z - kz;
        const dd = len3(vx, vy, vz) * R, need = kp.r + w * 0.5 + 3, A = need + 40;
        if (dd < A) {
          if (dd < 1e-3) { vx = ax; vy = ay; vz = az; } else { vx /= dd / R; vy /= dd / R; vz /= dd / R; }
          const fd = need + (A - need) * (dd / A) * (dd / A);
          x = kx + vx * fd / R; y = ky + vy * fd / R; z = kz + vz * fd / R;
        }
      }
      const l = R / len3(x, y, z);
      const thin = thinEnd > 0 ? 0.12 + 0.88 * smoothstep(0, thinEnd, arc - sGo) : 1;
      if (thin < 1 && RR[k] >= 0) thinned.add(RR[k]);
      OX[k] = x * l; OY[k] = y * l; OZ[k] = z * l; OH[k] = w * 0.5 * thin;
    }
    stemOut.push({ x: OX, y: OY, z: OZ, n: nR });
    for (let k = 0; k < own; k++) { outOf[cn[k]] = stemOut.length - 1; idxOf[cn[k]] = at[k]; }
    // how the curve turns, in widths over the radius of the bend, signed (positive: turning left, the bend's inside on the
    // left), smoothed over about 50 m of river either way so a bar lies along the whole bend: the sand bars lie on the inside
    // of the bends. (Asked only at the points kept below.)
    const kap = new Float32Array(nR);
    const kapAt = (k) => {
      if (k <= 0 || k >= nR - 1) return 0;
      const t1x = OX[k] - OX[k - 1], t1y = OY[k] - OY[k - 1], t1z = OZ[k] - OZ[k - 1], t2x = OX[k + 1] - OX[k], t2y = OY[k + 1] - OY[k], t2z = OZ[k + 1] - OZ[k];
      const l1 = len3(t1x, t1y, t1z), l2 = len3(t2x, t2y, t2z);
      if (l1 < 1e-6 || l2 < 1e-6) return 0;
      const cx = t1y * t2z - t1z * t2y, cy = t1z * t2x - t1x * t2z, cz = t1x * t2y - t1y * t2x;
      const turn = Math.asin(Math.max(-1, Math.min(1, (cx * OX[k] + cy * OY[k] + cz * OZ[k]) / (R * l1 * l2))));
      return turn / (0.5 * (l1 + l2)) * OH[k] * 2;
    };
    for (let k = 1; k < nR - 1; k++) kap[k] = kapAt(k);
    const kSAt = (k) => {
      let ks = 0, kw = 0;
      for (let j = k; j >= 0 && sArr[k] - sArr[j] < 50; j--) { const wgt = 1 - (sArr[k] - sArr[j]) / 50; ks += kap[j] * wgt; kw += wgt; }
      for (let j = k + 1; j < nR && sArr[j] - sArr[k] < 50; j++) { const wgt = 1 - (sArr[j] - sArr[k]) / 50; ks += kap[j] * wgt; kw += wgt; }
      return kw > 0 ? ks / kw : 0;
    };
    // the curve thinned to the points it needs: none further than `sag` from the chord between two kept points, none more than
    // `segMax` apart, and every node and every change of reach kept (so a junction is a segment's end)
    const keep = new Uint8Array(nR);
    keep[0] = 1; keep[nR - 1] = 1;
    for (let k = 0; k < m; k++) keep[at[k]] = 1;
    for (let k = 1; k < nR; k++) if (RR[k] !== RR[k - 1]) keep[k] = 1;
    const sag2 = o.sag * o.sag, sm2 = o.segMax * o.segMax;
    let i0 = 0, kS0 = kSAt(0);
    while (i0 < nR - 1) {
      let j = i0 + 1;
      while (j < nR - 1 && !keep[j]) {
        const c = j + 1, ux2 = OX[c] - OX[i0], uy2 = OY[c] - OY[i0], uz2 = OZ[c] - OZ[i0], uu = ux2 * ux2 + uy2 * uy2 + uz2 * uz2;
        if (uu > sm2) break;
        let ok = true;
        for (let t = i0 + 1; t < c && ok; t++) {
          const qx = OX[t] - OX[i0], qy = OY[t] - OY[i0], qz = OZ[t] - OZ[i0];
          const tt = uu > 0 ? Math.max(0, Math.min(1, (qx * ux2 + qy * uy2 + qz * uz2) / uu)) : 0;
          const ex = qx - ux2 * tt, ey = qy - uy2 * tt, ez = qz - uz2 * tt;
          if (ex * ex + ey * ey + ez * ez > sag2) ok = false;
        }
        if (!ok) break;
        j = c;
      }
      const kS1 = kSAt(j);
      SA.push(OX[i0], OY[i0], OZ[i0]); SB.push(OX[j], OY[j], OZ[j]); SW.push(OH[i0], OH[j]); SP.push(RP[i0], RP[j]); SQ.push(RQ[i0]); SR.push(RR[i0]); SK.push(kS0, kS1); if (RA) SM.push(RA[i0] > 0.5 ? 1 : 0);
      i0 = j; kS0 = kS1;
    }
    if (st.end === 'sea' || st.end === 'edge') {
      const e = nR - 1, b = st.endNode >= 0 ? [dir[st.endNode * 3], dir[st.endNode * 3 + 1], dir[st.endNode * 3 + 2]] : null;
      if (st.end === 'sea' || (st.endNode >= 0 && sea[st.endNode] > 0.15)) {
        const dx = OX[e] - OX[e - 1], dy = OY[e] - OY[e - 1], dz = OZ[e] - OZ[e - 1], dl = len3(dx, dy, dz) || 1;
        mouths.push({ end: [OX[e] / R, OY[e] / R, OZ[e] / R], lip: b, width: OH[e] * 2, levelTop: RP[e], levelSea: S.sea == null ? 0 : S.sea, dir: [dx / dl, dy / dl, dz / dl], reach: RR[e] });
      }
    }
  }
  const nS = SR.length;
  const net = new RiverNet(S, D, o);
  net.sA = Float64Array.from(SA); net.sB = Float64Array.from(SB); net.sW = Float32Array.from(SW); net.sP = Float32Array.from(SP);
  net.sQ = Float32Array.from(SQ); net.sR = Int32Array.from(SR); net.sK = Float32Array.from(SK); net.nSeg = nS;
  net.sM = aS ? Uint8Array.from(SM) : null;     // (?mount=1: the segments of the mountains' own streams)
  // (?mount=1: on a mountain stream the water's level comes from the mountain's own large-scale height at each end of each
  //  segment (24 m at most), not from the 98 m nodes: between two nodes a crag rises and falls tens of metres, and the nodes'
  //  level drawn straight between them stood up to 275 m under the slope and 46 m over it (measured 24 Nov). The level follows
  //  the slope down, `mountSink` under it, and NEVER RISES: where the slope rises along the stream it cuts a gorge, at most
  //  `mountCut` deep; where a crag stands higher than that across it, the stream runs DRY over the crag (sM = 2: no water, no
  //  gully, as a torrent runs under scree) and comes out below it at the slope's own level. Taking the slope's height as it
  //  came, the water rose along 28 % of the mountain's segments, by up to 149 m in one)
  if (aS) {
    const ww = new Float32Array(S.nB), sP = net.sP, sM = net.sM;
    let run = Infinity, prev = -1, prevB = 0;
    for (let s2 = 0; s2 < nS; s2++) {
      const a = s2 * 3;
      const joined = prev === s2 - 1 && net.sA[a] === net.sB[a - 3] && net.sA[a + 1] === net.sB[a - 2] && net.sA[a + 2] === net.sB[a - 1];
      if (!joined) run = Infinity;
      prev = s2;
      if (!sM[s2]) { run = Math.min(run, sP[s2 * 2], sP[s2 * 2 + 1]); continue; }
      const hA = joined && prevB === prevB ? prevB : MT.baseAt(S, net.sA[a] / R, net.sA[a + 1] / R, net.sA[a + 2] / R, ww) - o.mountSink;
      const hB = MT.baseAt(S, net.sB[a] / R, net.sB[a + 1] / R, net.sB[a + 2] / R, ww) - o.mountSink;
      prevB = hB;
      let pA = Math.min(run, hA);
      if (hA - pA > o.mountCut) { pA = hA; sM[s2] = 2; }
      let pB = Math.min(pA, hB);
      if (hB - pB > o.mountCut) { pB = hB; sM[s2] = 2; }
      sP[s2 * 2] = pA; sP[s2 * 2 + 1] = pB;
      run = pB;
    }
  }
  net.reaches = reaches.map((r, i) => ({ end: r.end, n: r.pts.length, thin: thinned.has(i) }));
  net.mouths = mouths;
  net.riverNodes = 0; for (let p = 0; p < len; p++) if (isR[p]) net.riverNodes++;
  net.ms.reaches = now() - t0; net.ms.stems = tStems - t0; net.ms.smooth = tSmooth - tStems;
  // 5. the index and the coarse field
  net._index(dir);
  net._lakes(dir);
  net.ms.total = now() - t0;
  return net;
}

// THE SINE-GENERATED CURVE (Langbein and Leopold, 1966): a river whose direction swings as theta = omega sin(2 pi t) along its
// own length bends with the least work, and it is the shape real meanders take. Tabled once as the push across the valley
// over one wavelength along it, in wavelengths, for omegas from 0 to SB_WMAX (past a right angle the loops fold back over
// themselves, which a push across cannot draw)
const SB_NW = 16, SB_NX = 64, SB_WMAX = 1.45;
let SB = null;
function sbTable() {
  if (SB) return SB;
  const T = new Float32Array(SB_NW * SB_NX), N = 2048, xs = new Float64Array(N + 1), ys = new Float64Array(N + 1);
  for (let a = 0; a < SB_NW; a++) {
    const om = SB_WMAX * a / (SB_NW - 1);
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < N; i++) {
      const th = om * Math.sin(2 * Math.PI * (i + 0.5) / N);
      xs[i + 1] = xs[i] + Math.cos(th) / N; ys[i + 1] = ys[i] + Math.sin(th) / N;
    }
    for (let i = 0; i <= N; i++) { lo = Math.min(lo, ys[i]); hi = Math.max(hi, ys[i]); }
    const X = xs[N], mid = (lo + hi) / 2;
    let i = 0;
    for (let k = 0; k < SB_NX; k++) {
      const xt = k / SB_NX * X;
      while (i < N - 1 && xs[i + 1] < xt) i++;
      const u = (xt - xs[i]) / ((xs[i + 1] - xs[i]) || 1);
      T[a * SB_NX + k] = (ys[i] + (ys[i + 1] - ys[i]) * u - mid) / X;
    }
  }
  SB = T;
  return T;
}
// the push across at `ph` wavelengths along (any number: one wave repeats), for a swing of `om` radians
export function sbend(ph, om) {
  const T = sbTable();
  const fa = Math.max(0, Math.min(SB_NW - 1.0001, om / SB_WMAX * (SB_NW - 1))), a = fa | 0, ua = fa - a;
  const fx = (ph - Math.floor(ph)) * SB_NX, x0 = Math.min(SB_NX - 1, fx | 0), ux = fx - x0, x1 = (x0 + 1) % SB_NX;
  const i0 = a * SB_NX, i1 = i0 + SB_NX;
  const r0 = T[i0 + x0] + (T[i0 + x1] - T[i0 + x0]) * ux, r1 = T[i1 + x0] + (T[i1 + x1] - T[i1 + x0]) * ux;
  return r0 + (r1 - r0) * ua;
}

function catmull(a, b, c, d, u, out) {
  const u2 = u * u, u3 = u2 * u;
  for (let i = 0; i < 3; i++) out[i] = 0.5 * ((2 * b[i]) + (-a[i] + c[i]) * u + (2 * a[i] - 5 * b[i] + 4 * c[i] - d[i]) * u2 + (-a[i] + 3 * b[i] - 3 * c[i] + d[i]) * u3);
  return out;
}

// a small binary heap (key, value) for the coarse field's spread
class Heap {
  constructor(cap) { this.k = new Float64Array(cap + 1); this.v = new Int32Array(cap + 1); this.n = 0; }
  push(key, val) {
    if (this.n + 1 >= this.k.length) { const k2 = new Float64Array(this.k.length * 2), v2 = new Int32Array(this.v.length * 2); k2.set(this.k); v2.set(this.v); this.k = k2; this.v = v2; }
    const k = this.k, v = this.v; let i = ++this.n; k[i] = key; v[i] = val;
    while (i > 1) { const p = i >> 1; if (k[p] <= k[i]) break; const tk = k[p], tv = v[p]; k[p] = k[i]; v[p] = v[i]; k[i] = tk; v[i] = tv; i = p; }
  }
  pop() {
    const k = this.k, v = this.v, out = v[1]; this.key = k[1];
    k[1] = k[this.n]; v[1] = v[this.n]; this.n--;
    let i = 1;
    for (;;) { const l = i << 1, r = l + 1; let m = i; if (l <= this.n && k[l] < k[m]) m = l; if (r <= this.n && k[r] < k[m]) m = r; if (m === i) break; const tk = k[m], tv = v[m]; k[m] = k[i]; v[m] = v[i]; k[i] = tk; v[i] = tv; i = m; }
    return out;
  }
}

// ---- the network --------------------------------------------------------------------------------------------------

class RiverNet {
  constructor(S, D, o) {
    this.S = S; this.D = D; this.o = o; this.R = S.R;
    this.ms = { reaches: 0, index: 0, lakes: 0, total: 0 };
    this.mouths = []; this.lakes = [];
    this._hit = { d: 1e9, sd: 1e9, i: -1, t: 0 };
  }

  bytes() {
    let b = this.sA.byteLength + this.sB.byteLength + this.sW.byteLength + this.sP.byteLength + this.sQ.byteLength + this.sR.byteLength + this.sK.byteLength;
    b += this.off.byteLength + this.items.byteLength + this.dn.byteLength + this.pn.byteLength;
    return b;
  }

  // Every node lists the segments within `near` + its cell's half diagonal; the coarse field holds, at every node, the
  // distance to the nearest centre line and that river's level there, spread over the grid from the exact values near water.
  _index(dir) {
    const t0 = now();
    const D = this.D, g = D.g, len = g.len, R = this.R, o = this.o, nS = this.nSeg;
    const reach = o.near + D.cell * 0.75;              // (a cell's half diagonal is at most 0.71 of its width)
    // (the (node, segment) pairs gathered flat, then sorted by node into one packed list: no per-node arrays to collect)
    let pairN = new Int32Array(1 << 16), pairS = new Int32Array(1 << 16), nPair = 0;
    const addPair = (p, s2) => {
      if (nPair === pairN.length) { const a = new Int32Array(nPair * 2), b = new Int32Array(nPair * 2); a.set(pairN); b.set(pairS); pairN = a; pairS = b; }
      pairN[nPair] = p; pairS[nPair] = s2; nPair++;
    };
    const nb = new Int32Array(8);
    const sA = this.sA, sB = this.sB;
    // segments in chunks of eight: one walk of the grid round each chunk's middle, every segment of the chunk tested
    // against every node it reaches
    const CH = 8;
    const seen = new Int32Array(len).fill(-1);
    let stamp = 0;
    // (a chunk is up to CH segments that JOIN, end to start: one stem's. Chunks of consecutive numbers once ran on from one
    //  river's end into the next river, anywhere on the world, and a walk round their middle missed the nodes by the far
    //  ones: a river's last few segments could be missing from its nodes' lists, 24 Nov)
    for (let c0 = 0, c1 = 0; c0 < nS; c0 = c1) {
      c1 = c0 + 1;
      while (c1 < nS && c1 - c0 < CH && sA[c1 * 3] === sB[c1 * 3 - 3] && sA[c1 * 3 + 1] === sB[c1 * 3 - 2] && sA[c1 * 3 + 2] === sB[c1 * 3 - 1]) c1++;
      const mid = (c0 + c1) >> 1;
      const mx = (sA[mid * 3] + sB[mid * 3]) * 0.5, my = (sA[mid * 3 + 1] + sB[mid * 3 + 1]) * 0.5, mz = (sA[mid * 3 + 2] + sB[mid * 3 + 2]) * 0.5;
      const start = g.idOf(mx, my, mz);
      // (the chunk's own reach: how far its segments' ends lie from its middle; a node farther than that and `reach` from the
      //  middle can hold none of them, and the walk does not go on through it)
      let cr = 0;
      for (let s2 = c0; s2 < c1; s2++) {
        const a = s2 * 3;
        cr = Math.max(cr, len3(sA[a] - mx, sA[a + 1] - my, sA[a + 2] - mz), len3(sB[a] - mx, sB[a + 1] - my, sB[a + 2] - mz));
      }
      const lim = reach + cr, lim2 = lim + D.cell;
      // (the walk as deep as the chunk's own reach asks: its segments are up to segMax long, and S-bends' up to that too)
      const depth = Math.ceil(lim / (D.cell * 0.57)) + 1;
      stamp++;
      let front = [start]; seen[start] = stamp;
      for (let lev = 0; lev <= depth && front.length; lev++) {
        const next = [];
        for (const p of front) {
          const px = dir[p * 3] * R, py = dir[p * 3 + 1] * R, pz = dir[p * 3 + 2] * R;
          const dm = len3(px - mx, py - my, pz - mz);
          if (dm < lim) {
            for (let s = c0; s < c1; s++) {
              if (segDist(sA, sB, s, px, py, pz) < reach) addPair(p, s);
            }
          }
          // walk on while still within reach of the chunk, and a cell beyond (so a node just inside is not missed)
          if (dm < lim2) {
            const k = D._nbs(p, nb);
            for (let t = 0; t < k; t++) { const q = nb[t]; if (seen[q] !== stamp) { seen[q] = stamp; next.push(q); } }
          }
        }
        front = next;
      }
    }
    // pack the lists
    const off = new Int32Array(len + 1);
    for (let k = 0; k < nPair; k++) off[pairN[k] + 1]++;
    for (let p = 0; p < len; p++) off[p + 1] += off[p];
    const items = new Int32Array(nPair), fill = off.slice(0, len);
    for (let k = 0; k < nPair; k++) items[fill[pairN[k]]++] = pairS[k];      // (stable: each node's segments in the order found)
    this.off = off; this.items = items;
    // the coarse field: exact where a node has segments listed, spread from there by a shortest path over the grid
    const dn = new Float32Array(len).fill(1e9), pn = new Float32Array(len).fill(0), sg = new Float32Array(len).fill(0);
    const heap = new Heap(4096);
    const n = g.n;
    for (let f = 0; f < 6; f++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const p = g.pid(f, i, j);
      if (off[p + 1] === off[p]) continue;
      const h = this._nearest(dir[p * 3] * R, dir[p * 3 + 1] * R, dir[p * 3 + 2] * R, off[p], off[p + 1], dir[p * 3], dir[p * 3 + 1], dir[p * 3 + 2]);
      if (h.i < 0) continue;
      dn[p] = h.d; pn[p] = this.sP[h.i * 2] + (this.sP[h.i * 2 + 1] - this.sP[h.i * 2]) * h.t;
      heap.push(h.d, p);
    }
    // (spread no farther than FAR: beyond it a sample is no river's -- the grading ends at grade[1] -- and the field reads
    //  as far away; a bilinear read between a near value and the 1e9 of nowhere is still far)
    const FAR = o.grade[1] + 2 * D.cell;
    while (heap.n > 0) {
      const p = heap.pop(), dp = heap.key;
      if (dp > dn[p] || dp > FAR) continue;
      const k = D._nbs(p, nb);
      for (let t = 0; t < k; t++) {
        const q = nb[t];
        const e = len3(dir[p * 3] - dir[q * 3], dir[p * 3 + 1] - dir[q * 3 + 1], dir[p * 3 + 2] - dir[q * 3 + 2]) * R;
        if (dp + e < dn[q]) { dn[q] = dp + e; pn[q] = pn[p]; heap.push(dn[q], q); }
      }
    }
    void sg;
    // the halo: each face's border node a copy of the node that owns that direction (a read never crosses a face)
    const d3 = [0, 0, 0];
    for (let f = 0; f < 6; f++) for (let j = -1; j <= n; j++) for (let i = -1; i <= n; i++) {
      if (i >= 0 && i < n && j >= 0 && j < n) continue;
      g.dirOf(f, i, j, d3);
      const src = g.idOf(d3[0], d3[1], d3[2]), dst = g.pid(f, i, j);
      dn[dst] = dn[src]; pn[dst] = pn[src];
    }
    this.dn = dn; this.pn = pn;
    this.ms.index = now() - t0;
  }

  // the nearest segment among items[i0..i1) to the point p (metres), with the side it lies on (up = u)
  _nearest(px, py, pz, i0, i1, ux, uy, uz) {
    const h = this._hit, sA = this.sA, sB = this.sB, items = this.items;
    h.d = 1e9; h.i = -1; h.t = 0; h.sd = 1e9;
    for (let k = i0; k < i1; k++) {
      const s = items[k], a = s * 3;
      const ax = sA[a], ay = sA[a + 1], az = sA[a + 2];
      const bx = sB[a] - ax, by = sB[a + 1] - ay, bz = sB[a + 2] - az;
      const qx = px - ax, qy = py - ay, qz = pz - az;
      const bb = bx * bx + by * by + bz * bz;
      let t = bb > 0 ? (qx * bx + qy * by + qz * bz) / bb : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = qx - bx * t, dy = qy - by * t, dz = qz - bz * t;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < h.d) {
        h.d = d2; h.i = s; h.t = t;
        // the side: (along x to-the-point) . up
        h.sd = (by * dz - bz * dy) * ux + (bz * dx - bx * dz) * uy + (bx * dy - by * dx) * uz;
      }
    }
    h.d = Math.sqrt(h.d);
    h.sd = h.sd >= 0 ? h.d : -h.d;
    return h;
  }

  // the basins the field fills, as a list (for world/hydro.js)
  _lakes(dir) {
    const t0 = now();
    const D = this.D, g = D.g, n = g.n, len = g.len, lvl = D.lvl, ter = D.ter, to = D.to, nb = new Int32Array(8);
    const comp = new Int32Array(len).fill(-1), lakes = [];
    for (let f = 0; f < 6; f++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const p0 = g.pid(f, i, j);
      if (comp[p0] >= 0 || lvl[p0] - ter[p0] <= D.lakeMin) continue;
      const id = lakes.length, st = [p0], nodes = [];
      comp[p0] = id;
      let cx = 0, cy = 0, cz = 0, out = -1;
      while (st.length) {
        const p = st.pop(); nodes.push(p);
        cx += dir[p * 3]; cy += dir[p * 3 + 1]; cz += dir[p * 3 + 2];
        const k = D._nbs(p, nb);
        for (let t = 0; t < k; t++) { const q = nb[t]; if (comp[q] < 0 && lvl[q] - ter[q] > D.lakeMin) { comp[q] = id; st.push(q); } }
      }
      for (const p of nodes) { const q = to[p]; if (q >= 0 && comp[q] !== id) { out = q; break; } }
      const cl = len3(cx, cy, cz) || 1;
      lakes.push({ level: lvl[p0], nodes: nodes.length, centre: [cx / cl, cy / cl, cz / cl], out: out >= 0 ? [dir[out * 3], dir[out * 3 + 1], dir[out * 3 + 2]] : null, sill: null });
    }
    this.lakes = lakes;
    this.ms.lakes = now() - t0;
  }

  // ---- the sample -------------------------------------------------------------------------------------------------
  sample(S, c) {
    const o = this.o, R = this.R, x = c.x, y = c.y, z = c.z, nA = S.nA.n3, nC = S.nC.n3;
    const D = this.D, g = D.g;
    const dr = S._drain(c);
    // the tangent axes _riversOil hands its current in (and patchgen packs)
    let ux, uy, uz;
    if (Math.abs(y) < 0.9) { ux = -z; uy = 0; uz = x; } else { ux = 0; uy = z; uz = -y; }
    const ul = 1 / Math.sqrt(ux * ux + uy * uy + uz * uz); ux *= ul; uy *= ul; uz *= ul;
    const vx = y * uz - z * uy, vy = z * ux - x * uz, vz = x * uy - y * ux;
    // 1. the nearest river of the tree: exact near water, the coarse field beyond
    const px = x * R, py = y * R, pz = z * R;
    const node = g.idOf(x, y, z), i0 = this.off[node], i1 = this.off[node + 1];
    let dC = 1e9, sd = 1e9, hw = W, Pr = 0, acc = 0, si = -1, st = 0;
    if (i1 > i0) {
      const h = this._nearest(px, py, pz, i0, i1, x, y, z);
      if (h.i >= 0) {
        si = h.i; st = h.t; dC = h.d; sd = h.sd;
        hw = this.sW[si * 2] + (this.sW[si * 2 + 1] - this.sW[si * 2]) * st;
        Pr = this.sP[si * 2] + (this.sP[si * 2 + 1] - this.sP[si * 2]) * st;
        acc = this.sQ[si];
      }
    }
    // (past `near` the coarse field answers, and the two must MEET there: the distance never under `near` (the coarse field
    //  undercut it at 1 % of such samples, by up to 37 m, measured 24 Nov, which would dip the hills along a line a hundred
    //  metres from every river), and the river's level eased from the exact one to the coarse one over the last 25 m)
    if (dC > o.near - 25) {
      const p = dr._p, tu = dr._tu, tv = dr._tv, w = g.w, dn = this.dn, pn = this.pn;
      const pb = pn[p] + (pn[p + 1] - pn[p]) * tu, pt = pn[p + w] + (pn[p + w + 1] - pn[p + w]) * tu, pF = pb + (pt - pb) * tv;
      if (dC > o.near) {
        const db = dn[p] + (dn[p + 1] - dn[p]) * tu, dt = dn[p + w] + (dn[p + w + 1] - dn[p + w]) * tu, dF = db + (dt - db) * tv;
        dC = Math.max(Math.min(dF, dC), o.near);
        sd = si >= 0 && sd < 0 ? -dC : dC;
        Pr = pF;
      } else if (si >= 0) Pr += (pF - Pr) * smoothstep(o.near - 25, o.near, dC);
    }
    // 2. the channel, in the terms the land's recipes read (as _riversOil's `lay`)
    let best = 1e9, bar = 0, deep = 0, win = 0, zone = 0;
    const lay = (sI, k, gv, who) => {
      const w = k * W;
      let d = sI < w ? (k <= 1 ? sI / k : Math.max(0, sI - (w - W))) : W + (sI - w) * gv;
      if (k < 0.3) d += (1 - smoothstep(0.02, 0.3, k)) * 260;
      if (d < best) { best = d; bar = 0; win = who || 0; if (sI < w) deep = Math.min(1, Math.max(0, (k - 1) / 3)); }
    };
    const kM = Math.max(0.3, hw / W);
    if (si >= 0 && kM >= 2.2) {
      // A RIVER (the owner's sheets of rivers from the air: pale SAND BARS along one side for stretches, a second arm round an
      // island, a pool now and then). The same shapes as _riversOil, laid along this river's own line.
      const near = 1 - smoothstep(60, 100, dC);
      const fp = R / 310, fs = R / 270, fb = R / 230;
      const pool = smoothstep(0.38, 0.66, nA(x * fp + 9.9, y * fp + 55.5, z * fp - 27.3)) * near;
      const kP = kM * (1 + 0.8 * pool);
      const n1 = nC(x * fb + 71.3, y * fb - 9.1, z * fb + 4.7);
      const p2 = Math.max(0, -n1 - 0.18) * (30 + 4 * kM) * near;
      const ns = nA(x * fs - 19.4, y * fs + 7.1, z * fs + 88.2);
      let barW = Math.max(0, Math.abs(ns) - 0.14) * 3.2 * hw * near, side = ns > 0, pb = false;
      // (a POINT BAR on the inside of every bend, wider the tighter the bend: the owner's sheets, pale sand bars lying inside
      //  each bend. sK is the turn in widths over the bend's radius, positive with the inside on the left. It stands a little
      //  higher than the stretches of bar, a hand's breadth to a knee over the water, so it is sand and not a shallow)
      if (o.bends) {
        const kb = this.sK[si * 2] + (this.sK[si * 2 + 1] - this.sK[si * 2]) * st, bb = smoothstep(0.08, 0.3, Math.abs(kb)) * 2.2 * hw * near;
        if (bb > barW) { barW = bb; side = kb > 0; pb = true; }
      }
      const sI = Math.abs(sd), w = kP * W;
      if (barW > 0.5 && sI > w && (sd > 0) === side) {
        // (a point bar: a bank up from the water, a flat of sand, and behind it a short scarp back up to the land's own lie, so
        //  that beyond the bar the ground is what it would be without it and two rivers' grounds still meet)
        const out = sI - w, d = pb ? Math.min(W + out, W + 2.0 + Math.min(out, barW) * 0.12 + Math.max(0, out - barW) * 3)
          : W + Math.min(out, barW) * 0.2 + Math.max(0, out - barW);
        if (d < best) { best = d; win = 0; bar = (1 - smoothstep(barW * 0.75, barW, out)) * smoothstep(0, 1.2, out); }
        // (where the trees stand back: the bar and 6 m beyond it, so their crowns do not hide it from the air: F, 24 Nov)
        zone = (1 - smoothstep(barW, barW + 6, out)) * smoothstep(0, 1.2, out);
      } else lay(sI, kP, 1);
      if (p2 > 0.5) lay(Math.abs(sd + p2), 0.8 + 0.1 * kM, 1);
    } else {
      // a stream: a channel of its own width in a narrower valley (as _riversOil's side streams), thin at its source
      lay(dC, kM, kM < 1.2 ? 2.2 : 1.4);
    }
    // 3. TWIGS: the third noise field's lines within a hundred metres of a river or stream of the tree, ending where they meet
    //    one (the level the field is taken at changes across the river: so a twig never crosses it)
    const parent = Math.max(0, dC - hw);
    let ku = 0, kv = 0;
    // (?runoff=1: the twigs are RUNNELS, water only in the wet, and reach further up the slopes: 160 m from a stream)
    const ro = MODE.water && MODE.water.runoff, twigR = ro ? 160 : 110;
    const fm = R / 190, mn = nA(x * fm - 61.1, y * fm + 2.9, z * fm + 30.3), mask = ro ? smoothstep(-0.45, -0.15, mn) : smoothstep(-0.05, 0.25, mn);
    if (parent < twigR && mask > 0.01) {
      const e = 2.0, eR = e / R, K3 = 150 / 1.25;
      const q0 = S._sf3(x, y, z), qf = q0 - (sd > 0 ? 0 : 0.17);
      let qs = Math.abs(qf) * K3;
      if (qs < 45) {
        const q1 = S._sf3(x + ux * eR, y + uy * eR, z + uz * eR), q2 = S._sf3(x + vx * eR, y + vy * eR, z + vz * eR);
        ku = (q1 - q0) / e; kv = (q2 - q0) / e;
        const g3 = Math.sqrt((q1 - q0) * (q1 - q0) + (q2 - q0) * (q2 - q0)) / e;
        const qt = Math.abs(qf) / Math.max(g3, 0.42 / K3);
        qs = qt + (qs - qt) * smoothstep(28, 45, qs);
        lay(qs, 0.5 * mask * (1 - smoothstep(10, ro ? 125 : 85, parent)), 3.0, 2);
      }
    }
    c.pool = deep; c.bar = bar; c.barZone = zone;
    // 4. the current, along the channel that won, downstream
    c.fu = 0; c.fv = 0;
    if (best < W + 3) {
      if (win === 0 && si >= 0) {
        const a = si * 3, bx = this.sB[a] - this.sA[a], by = this.sB[a + 1] - this.sA[a + 1], bz = this.sB[a + 2] - this.sA[a + 2];
        const fu = bx * ux + by * uy + bz * uz, fv = bx * vx + by * vy + bz * vz, fl = Math.hypot(fu, fv);
        if (fl > 1e-9) { c.fu = fu / fl; c.fv = fv / fl; }
      } else if (win === 2) {
        const dl = Math.hypot(ku, kv);
        if (dl > 1e-12) {
          let fu = -kv / dl, fv = ku / dl;
          // a twig runs toward the river it joins
          if (si >= 0) {
            const a = si * 3, qx = this.sA[a] + (this.sB[a] - this.sA[a]) * st - px, qy = this.sA[a + 1] + (this.sB[a + 1] - this.sA[a + 1]) * st - py, qz = this.sA[a + 2] + (this.sB[a + 2] - this.sA[a + 2]) * st - pz;
            if (fu * (qx * ux + qy * uy + qz * uz) + fv * (qx * vx + qy * vy + qz * vz) < 0) { fu = -fu; fv = -fv; }
          }
          c.fu = fu; c.fv = fv;
        }
      }
    }
    // 5. the base level graded toward the river's own, and the water's level: down the river all the way, the lake's in a basin
    const L = c.L, gr = 1 - smoothstep(o.grade[0], o.grade[1], dC);
    const Lg = L + (Math.min(L, Pr + o.depth) - L) * gr;
    c.L = Lg;
    let lv = Lg - o.depth;
    const lake = smoothstep(D.lakeMin * 0.5, D.lakeMin * 1.5, dr.fill);
    if (lake > 0) lv += (dr.level - lv) * lake;
    c.lvR = lv;
    c.still = Math.max(lake, deep * 0.6);
    c.swell = Math.max(win === 0 ? Math.min(1, Math.pow(Math.max(acc, 1) / 400, 0.4)) : win === 2 ? 0.1 : 0, lake * 0.6);
    // (?runoff=1: WATER THAT IS THERE ONLY IN THE WET -- the runnels, and the heads of the smallest streams of the tree -- with
    //  its depth at full wet; the level above is that full level, so the water's mesh holds it, and the paint shows it only
    //  as far as the rain has filled it: world/waterstate.js, the water-paint lane's uRunoff)
    if (ro && best < W + 1) {
      if (win === 2) c.cap = 0.6;
      else if (win === 0 && si >= 0 && acc < 40) c.cap = 0.6 * (1 - smoothstep(24, 40, acc));
    }
    return best;
  }
}

function segDist(sA, sB, s, px, py, pz) {
  const a = s * 3, ax = sA[a], ay = sA[a + 1], az = sA[a + 2];
  const bx = sB[a] - ax, by = sB[a + 1] - ay, bz = sB[a + 2] - az;
  const qx = px - ax, qy = py - ay, qz = pz - az, bb = bx * bx + by * by + bz * bz;
  let t = bb > 0 ? (qx * bx + qy * by + qz * bz) / bb : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
  return len3(qx - bx * t, qy - by * t, qz - bz * t);
}

// (Math.hypot is several times slower than this in V8, and the build and the index ask it hundreds of thousands of times)
function len3(x, y, z) { return Math.sqrt(x * x + y * y + z * z); }

function now() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Number(process.hrtime.bigint()) / 1e6; }

// ---- the hook --------------------------------------------------------------------------------------------------------

export function attachRivers(S, drain) {
  if (!S || S.rivers || !MODE.oil) return S ? S.rivers : null;
  // (only a world with a WOOD asks for them: _forest is the one recipe that reads the distance to the water (surface.js
  //  _base). Venus's acid pools, Uranus's sinkholes and Neptune's tundra lakes are other recipes: a network there was built
  //  for nothing -- 122, 47 and 26 ms at load, measured 24 Nov)
  if (!S.biomes.some((b) => b.terrain === 'forest')) return null;
  // (a look's springs: { at: 'landing' } is the world's first landing, which keeps its brook)
  const look = S.look && S.look.oil && S.look.oil.springs;
  let springs = null;
  if (look) {
    springs = [];
    for (const sp of look) {
      let near = sp.near;
      if (sp.at === 'landing') { const g = S.getSpawn(); near = [g.x, g.y, g.z]; }
      if (near) springs.push({ near, up: sp.up || 0, acc: sp.acc || 30, ramp: sp.ramp || 0 });
    }
  }
  const opts = {};
  if (springs) opts.springs = springs;
  // (a look's places a river bends round: { at: 'landing', r }, the world's first landing)
  const keepL = S.look && S.look.oil && S.look.oil.keep;
  if (keepL) {
    const keep = [];
    for (const kp of keepL) {
      let near = kp.near;
      if (kp.at === 'landing') { const g = S.getSpawn(); near = [g.x, g.y, g.z]; }
      if (near) keep.push({ near, r: kp.r || 12 });
    }
    if (keep.length) opts.keep = keep;
  }
  if (MODE.water && MODE.water.bends === 0) opts.bends = 0;
  const net = buildRivers(S, drain, opts);
  if (!net) return null;
  S.rivers = net;
  return net;
}
