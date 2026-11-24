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
//   4. each reach as a SMOOTH CURVE through its nodes (Catmull-Rom; at a junction the curve arrives along the river it joins,
//      so a tributary meets it at a slant, as a real one does), BENT into meanders (a noise across the curve, wavelength
//      eleven times the width, the field ratio of meanders; held to nothing at the reach's ends so the joins stay joined),
//      cut into segments of `seg` metres with the width and the level at each end;
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
//                            c.pool, c.bar, c.fu, c.fv, c.still, c.swell, c.lvR (the water level, which surface.js _forest
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
  seg: 12,         // metres a segment (a 12 m chord of a bend 50 m round is 0.36 m off the curve)
  lam: 11,         // the meander's wavelength in widths (the field ratio of meanders), never under lamMin metres ...
  lamMin: 70,
  meander: 0.2,    // ... and how far it swings, a share of its wavelength
  wander: 26,      // metres: a slower wander on top (350 m), so a stream on an even slope is not a ruled line
  smooth: 3,       // passes of smoothing over the nodes (the grid's 45-degree zigzag out of the curve)
  edgeThin: 90,    // metres: a river that ends at the edge of the wood (a marsh, a dry biome) thins away over this
  springs: null,   // [{ near: [x, y, z], up, acc }]: catchment added so a stream runs past a place (a look's oil.springs)
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
  const g = D.g, n = g.n, R = S.R, to = D.to, accF = D.accF, ord = D.ordR, lvl = D.lvl, ter = D.ter, len = g.len;
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
    for (let guard = 0; p >= 0 && guard < 5000; guard++) { accF[p] += sp.acc || 30; p = to[p]; }
  }
  // 1. the river nodes
  const isR = new Uint8Array(len);
  for (let f = 0; f < 6; f++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const p = g.pid(f, i, j);
    if (accF[p] >= o.a1) { kind(p); if (wet[p] >= o.wetMin) isR[p] = 1; }
  }
  const par = new Uint8Array(len);
  for (let p = 0; p < len; p++) if (isR[p] && to[p] >= 0 && isR[to[p]]) par[to[p]]++;
  // 2. the levels, down the tree (ord is the routing flood's pop order, the outlet first: walked backwards, every node
  //    comes after everything upstream of it)
  const P = new Float32Array(len).fill(Infinity);
  for (let t = ord.length - 1; t >= 0; t--) {
    const p = ord[t];
    if (!isR[p]) continue;
    const own = Math.max(lvl[p], ter[p] - o.cutMax);
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
  // 4. the curves and their segments
  const SA = [], SB = [], SW = [], SP = [], SQ = [], SR = [];   // (built as plain arrays, packed below)
  const pt = new Float64Array(3), tmp = new Float64Array(12);
  const width = (a) => Math.min(o.wMax, o.wMin + o.wK * Math.sqrt(a / 10));
  const nC = S.nC.n3;
  for (let ri = 0; ri < reaches.length; ri++) {
    const rc = reaches[ri], nodes = rc.pts, m = nodes.length;
    // the control points: the nodes, with one more at each end for the curve's tangent there
    const ctl = [];
    const push = (q) => ctl.push([dir[q * 3], dir[q * 3 + 1], dir[q * 3 + 2]]);
    if (rc.before >= 0) push(rc.before); else ctl.push(null);
    for (const q of nodes) push(q);
    const last = nodes[m - 1];
    if (rc.end === 'join' && to[last] >= 0) push(to[last]);
    else if ((rc.end === 'sea' || rc.end === 'edge') && rc.endNode >= 0) push(rc.endNode);
    else ctl.push(null);
    if (m < 2) {      // a mouth right at a source: a stub toward the sea
      if (rc.end === 'sea') mouths.push({ end: ctl[1].slice(), lip: ctl[2] ? ctl[2].slice() : ctl[1].slice(), width: width(accF[last]), levelTop: P[last], levelSea: S.sea == null ? 0 : S.sea, dir: null });
      continue;
    }
    // (the nodes smoothed toward their neighbours, the reach's own two ends held: the grid's stair of 45-degree steps is
    //  taken out, and the joins stay where they were)
    for (let it = 0; it < o.smooth && m > 2; it++) {
      const prev = ctl.map((q) => (q ? q.slice() : q));
      for (let k = 2; k < m; k++) for (let i = 0; i < 3; i++) ctl[k][i] = 0.25 * prev[k - 1][i] + 0.5 * prev[k][i] + 0.25 * prev[k + 1][i];
    }
    if (!ctl[0]) ctl[0] = [2 * ctl[1][0] - ctl[2][0], 2 * ctl[1][1] - ctl[2][1], 2 * ctl[1][2] - ctl[2][2]];
    const L1 = ctl.length - 1;
    if (!ctl[L1]) ctl[L1] = [2 * ctl[L1 - 1][0] - ctl[L1 - 2][0], 2 * ctl[L1 - 1][1] - ctl[L1 - 2][1], 2 * ctl[L1 - 1][2] - ctl[L1 - 2][2]];
    // the curve sampled every `seg` metres, before the meander
    const raw = [];
    let arc = 0;
    for (let k = 0; k < m - 1; k++) {
      const a = ctl[k], b = ctl[k + 1], c = ctl[k + 2], d = ctl[k + 3];
      const chord = Math.hypot(c[0] - b[0], c[1] - b[1], c[2] - b[2]) * R;
      const steps = Math.max(1, Math.ceil(chord / o.seg));
      const wa = width(accF[nodes[k]]), wb = width(accF[nodes[k + 1]]), pa = P[nodes[k]], pb = P[nodes[k + 1]];
      for (let s = 0; s < steps; s++) {
        const u = s / steps;
        catmull(a, b, c, d, u, pt);
        const l = Math.hypot(pt[0], pt[1], pt[2]);
        raw.push({ x: pt[0] / l, y: pt[1] / l, z: pt[2] / l, w: wa + (wb - wa) * u, P: pa + (pb - pa) * u, acc: accF[nodes[k]] + (accF[nodes[k + 1]] - accF[nodes[k]]) * u });
      }
    }
    {
      const b = ctl[m], l = Math.hypot(b[0], b[1], b[2]);
      raw.push({ x: b[0] / l, y: b[1] / l, z: b[2] / l, w: width(accF[last]), P: P[last], acc: accF[last] });
    }
    for (let k = 1; k < raw.length; k++) arc += Math.hypot(raw[k].x - raw[k - 1].x, raw[k].y - raw[k - 1].y, raw[k].z - raw[k - 1].z) * R;
    // the meander: a push across the curve, held to nothing at both ends so the joins stay joined
    let wSum = 0; for (const q of raw) wSum += q.w;
    const wMean = wSum / raw.length, lam = Math.max(o.lamMin, o.lam * wMean), taper = Math.min(lam, arc / 3);
    const thinEnd = rc.end === 'edge' ? o.edgeThin : 0;
    const out = [];
    let sGo = 0;
    for (let k = 0; k < raw.length; k++) {
      const q = raw[k], qa = raw[Math.max(0, k - 1)], qb = raw[Math.min(raw.length - 1, k + 1)];
      if (k > 0) sGo += Math.hypot(q.x - raw[k - 1].x, q.y - raw[k - 1].y, q.z - raw[k - 1].z) * R;
      let tx = qb.x - qa.x, ty = qb.y - qa.y, tz = qb.z - qa.z;
      // across: up x along
      let ax = q.y * tz - q.z * ty, ay = q.z * tx - q.x * tz, az = q.x * ty - q.y * tx;
      const al = Math.hypot(ax, ay, az) || 1; ax /= al; ay /= al; az /= al;
      const k0 = R / lam, k1 = R / 350;
      const hold = smoothstep(0, taper, sGo) * smoothstep(0, taper, arc - sGo);
      const swing = o.meander * lam * nC(q.x * k0 + 31.7, q.y * k0 - 8.3, q.z * k0 + 55.1) + o.wander * nC(q.x * k1 - 17.2, q.y * k1 + 40.4, q.z * k1 - 3.3);
      const push2 = hold * swing / R;
      let x = q.x + ax * push2, y = q.y + ay * push2, z = q.z + az * push2;
      const l = Math.hypot(x, y, z); x /= l; y /= l; z /= l;
      const thin = thinEnd > 0 ? 0.12 + 0.88 * smoothstep(0, thinEnd, arc - sGo) : 1;
      out.push([x * R, y * R, z * R, q.w * 0.5 * thin, q.P, q.acc]);
    }
    for (let k = 0; k < out.length - 1; k++) {
      const a = out[k], b = out[k + 1];
      SA.push(a[0], a[1], a[2]); SB.push(b[0], b[1], b[2]); SW.push(a[3], b[3]); SP.push(a[4], b[4]); SQ.push(a[5]); SR.push(ri);
    }
    if (rc.end === 'sea' || rc.end === 'edge') {
      const a = out[out.length - 1], b = rc.endNode >= 0 ? [dir[rc.endNode * 3], dir[rc.endNode * 3 + 1], dir[rc.endNode * 3 + 2]] : null;
      const pb = out[out.length - 2];
      if (rc.end === 'sea' || (rc.endNode >= 0 && sea[rc.endNode] > 0.15)) {
        const dx = a[0] - pb[0], dy = a[1] - pb[1], dz = a[2] - pb[2], dl = Math.hypot(dx, dy, dz) || 1;
        mouths.push({ end: [a[0] / R, a[1] / R, a[2] / R], lip: b, width: a[3] * 2, levelTop: a[4], levelSea: S.sea == null ? 0 : S.sea, dir: [dx / dl, dy / dl, dz / dl], reach: ri });
      }
    }
    void tmp;
  }
  const nS = SR.length;
  const net = new RiverNet(S, D, o);
  net.sA = Float64Array.from(SA); net.sB = Float64Array.from(SB); net.sW = Float32Array.from(SW); net.sP = Float32Array.from(SP);
  net.sQ = Float32Array.from(SQ); net.sR = Int32Array.from(SR); net.nSeg = nS;
  net.reaches = reaches.map((r) => ({ end: r.end, n: r.pts.length }));
  net.mouths = mouths;
  net.riverNodes = 0; for (let p = 0; p < len; p++) if (isR[p]) net.riverNodes++;
  net.ms.reaches = now() - t0;
  // 5. the index and the coarse field
  net._index(dir);
  net._lakes(dir);
  net.ms.total = now() - t0;
  return net;
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
    let b = this.sA.byteLength + this.sB.byteLength + this.sW.byteLength + this.sP.byteLength + this.sQ.byteLength + this.sR.byteLength;
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
    const CH = 8, depth = Math.ceil((reach + CH * o.seg * 0.5) / (D.cell * 0.57)) + 1;
    const seen = new Int32Array(len).fill(-1);
    let stamp = 0;
    for (let c0 = 0; c0 < nS; c0 += CH) {
      const c1 = Math.min(nS, c0 + CH), mid = (c0 + c1) >> 1;
      const mx = (sA[mid * 3] + sB[mid * 3]) * 0.5, my = (sA[mid * 3 + 1] + sB[mid * 3 + 1]) * 0.5, mz = (sA[mid * 3 + 2] + sB[mid * 3 + 2]) * 0.5;
      const start = g.idOf(mx, my, mz);
      // (the chunk's own reach: how far its segments' ends lie from its middle; a node farther than that and `reach` from the
      //  middle can hold none of them, and the walk does not go on through it)
      let cr = 0;
      for (let s2 = c0; s2 < c1; s2++) {
        const a = s2 * 3;
        cr = Math.max(cr, Math.hypot(sA[a] - mx, sA[a + 1] - my, sA[a + 2] - mz), Math.hypot(sB[a] - mx, sB[a + 1] - my, sB[a + 2] - mz));
      }
      const lim = reach + cr, lim2 = lim + D.cell;
      stamp++;
      let front = [start]; seen[start] = stamp;
      for (let lev = 0; lev <= depth && front.length; lev++) {
        const next = [];
        for (const p of front) {
          const px = dir[p * 3] * R, py = dir[p * 3 + 1] * R, pz = dir[p * 3 + 2] * R;
          const dm = Math.hypot(px - mx, py - my, pz - mz);
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
        const e = Math.hypot(dir[p * 3] - dir[q * 3], dir[p * 3 + 1] - dir[q * 3 + 1], dir[p * 3 + 2] - dir[q * 3 + 2]) * R;
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
      const cl = Math.hypot(cx, cy, cz) || 1;
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
    let best = 1e9, bar = 0, deep = 0, win = 0;
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
      const barW = Math.max(0, Math.abs(ns) - 0.14) * 3.2 * hw * near;
      const sI = Math.abs(sd), w = kP * W;
      if (barW > 0.5 && sI > w && (sd > 0) === (ns > 0)) {
        const out = sI - w, d = W + Math.min(out, barW) * 0.2 + Math.max(0, out - barW);
        if (d < best) { best = d; win = 0; bar = (1 - smoothstep(barW * 0.75, barW, out)) * smoothstep(0, 1.2, out); }
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
    c.pool = deep; c.bar = bar;
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
  return Math.hypot(qx - bx * t, qy - by * t, qz - bz * t);
}

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
      if (near) springs.push({ near, up: sp.up || 0, acc: sp.acc || 30 });
    }
  }
  const net = buildRivers(S, drain, springs ? { springs } : undefined);
  if (!net) return null;
  S.rivers = net;
  return net;
}
