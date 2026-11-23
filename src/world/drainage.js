// Painted Cosmos: WHERE THE WATER ON A WORLD RUNS TO. OWNER: PAINTER.
//
// The owner, 23 Nov: water "should constantly be moving the way water would be naturally how it goes
// down hill and pools in areas it can't find go downhill any further".
//
// Until now no part of this game asked which way is downhill. A wood's water level was a noise field
// (surface.js _base, c.L) and the stream's surface was that field minus 0.4 m, so the water climbed
// hills: measured on Earth, 10 km of one channel climbs 18.2 m in total and 988 of 1,999 five-metre
// steps go UP (scratchpad trace, 2026-11-23; the nine-agent reading measured 15.1 m on another reach).
//
// A real flow cannot be stepped every frame: surface.js is a PURE FUNCTION of a point, asked thousands
// of times a frame by the mesher, the physics and the flora placer, at arbitrary points on worlds the
// player is not standing on. So the drainage is solved ONCE per world, on a coarse grid, and read as a
// field. That is permanent and exact and costs nothing per sample.
//
// WHAT IS SOLVED. A grid over the cube-sphere, 64 x 64 a face (98 m cells on Earth: R 4000, a face edge
// 6283 m). At each node the HYDROLOGICAL BASE of the place -- the level still water would stand at if
// the land here were smooth (surface.waterBaseAt). Then a priority flood (Barnes, Lehman and Mulla's
// Priority-Flood: pop the lowest known node, carry its level outward) which FILLS every depression to
// its own sill, so every basin's standing level is the exact height of the lowest pass out of it. Then
// the flow tree down the filled surface, and how much drains through each node.
//
// WHY THE BASE FIELD AND NOT THE GROUND. The obvious move is to sample surface.heightAt. It is wrong
// here, twice over. (1) Near a channel the wood's hills are smoothed away (surface.js `rise`), so the
// valley floor is c.L, while 100 m uphill the ground is up to 28 m higher; a 98 m grid lands on either
// at random, so a level read from it would jump 25 m within one cell and the water would jump with it.
// (2) heightAt costs 2.995 us a call against 0.613 us for the base (both measured here, 2026-11-23), so
// the base is a whole-world solve in 15 ms instead of 74 ms. The base field is smooth at 1,900 m, and a
// 98 m grid reproduces it to 0.16 m (its second derivative is 12 * (2 pi / 1900)^2).
//
// THE GRID. Gnomonic, not the tangent-warped (u, v) of cubesphere.js: a lookup then needs two divisions
// instead of two Math.atan, and the atan is a third of the whole lookup's cost. The price is cells that
// run 57 m at a face corner against 98 m at its centre -- finer everywhere than nominal, so nothing is
// lost. Every face carries a one-node halo copied from its neighbours, so a read is a plain bilinear
// inside one face and never crosses an edge.
//
// Nothing imports this file unless the switch is on, exactly as nothing of the powers is loaded without
// ?powers=1: surface.js only ever reads `this.drain`, which is null until something attaches a field.

import { FACES } from './cubesphere.js';
import { smoothstep } from './noise.js';
import { getSurface } from './surface.js';

// Defaults, all in metres. H is the pool band: the water stands level for a band of H and then falls H
// at the lip. 4.0 m against the wood's measured mean fall (c.L's maximum slope is 2 pi * 12 / 1900 =
// 3.97 %, and the traced channel falls about 2 %) makes pools 100 to 200 m long, which is the length of
// the still reaches in the owner's river references. BIAS keeps the banded level at most 0.8 m above the
// base field, so the new water is never much wider than today's (today the level is the base minus 0.4).
export const DRAIN_DEF = {
  n: 64,          // nodes a face edge: 64 -> 98 m cells on Earth, 24,576 nodes, 6 x 66 x 66 with halo
  H: 4.0,         // the pool band's height
  bias: 0.8,      // the band's level above its own floor
  edge: 0.14,     // the share of a band spent falling at the lip (0.14 of 4 m over about 24 m of ground)
  lakeMin: 1.2,   // a basin filled deeper than this stands at its own sill level, not on the band
  divide: 30.0,   // how high dry ground reads in the base field, so water routes round it, not through
};

// ---- the grid ---------------------------------------------------------------------------------------

class Grid {
  constructor(n) {
    this.n = n;
    this.w = n + 2;                 // a face's padded width: one halo node each side
    this.s2 = this.w * this.w;
    this.len = 6 * this.s2;
  }

  // padded index of node (face, i, j), i and j in [-1, n]
  pid(f, i, j) { return f * this.s2 + (j + 1) * this.w + (i + 1); }

  // the unit direction of node (face, i, j), written into out[0..2]. Gnomonic: the face's plane at
  // a = (i + 0.5) / n * 2 - 1, pushed out to the sphere.
  dirOf(f, i, j, out) {
    const F = FACES[f], n = this.n;
    const a = ((i + 0.5) / n) * 2 - 1, b = ((j + 0.5) / n) * 2 - 1;
    const x = F.n[0] + a * F.u[0] + b * F.v[0];
    const y = F.n[1] + a * F.u[1] + b * F.v[1];
    const z = F.n[2] + a * F.u[2] + b * F.v[2];
    const il = 1 / Math.sqrt(x * x + y * y + z * z);
    out[0] = x * il; out[1] = y * il; out[2] = z * il;
    return out;
  }

  // which node owns this direction (padded index of an INTERIOR node)
  idOf(x, y, z) {
    const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
    let f;
    if (ax >= ay && ax >= az) f = x > 0 ? 0 : 1;
    else if (ay >= az) f = y > 0 ? 2 : 3;
    else f = z > 0 ? 4 : 5;
    const F = FACES[f], n = this.n;
    const d = x * F.n[0] + y * F.n[1] + z * F.n[2];
    const a = (x * F.u[0] + y * F.u[1] + z * F.u[2]) / d;
    const b = (x * F.v[0] + y * F.v[1] + z * F.v[2]) / d;
    let i = Math.round(((a + 1) * 0.5) * n - 0.5), j = Math.round(((b + 1) * 0.5) * n - 0.5);
    if (i < 0) i = 0; else if (i >= n) i = n - 1;
    if (j < 0) j = 0; else if (j >= n) j = n - 1;
    return this.pid(f, i, j);
  }
}

// ---- a binary heap of (key, node) -------------------------------------------------------------------

class Heap {
  constructor(cap) { this.k = new Float64Array(cap + 1); this.v = new Int32Array(cap + 1); this.n = 0; }
  push(key, val) {
    const k = this.k, v = this.v;
    let i = ++this.n; k[i] = key; v[i] = val;
    while (i > 1) { const p = i >> 1; if (k[p] <= k[i]) break; const tk = k[p], tv = v[p]; k[p] = k[i]; v[p] = v[i]; k[i] = tk; v[i] = tv; i = p; }
  }
  pop() {
    const k = this.k, v = this.v, out = v[1];
    k[1] = k[this.n]; v[1] = v[this.n]; this.n--;
    let i = 1;
    for (;;) {
      const l = i << 1, r = l + 1; let m = i;
      if (l <= this.n && k[l] < k[m]) m = l;
      if (r <= this.n && k[r] < k[m]) m = r;
      if (m === i) break;
      const tk = k[m], tv = v[m]; k[m] = k[i]; v[m] = v[i]; k[i] = tk; v[i] = tv; i = m;
    }
    return out;
  }
}

// ---- the field --------------------------------------------------------------------------------------

export class Drainage {
  constructor(S, opts) {
    const o = Object.assign({}, DRAIN_DEF, opts || {});
    this.S = S; this.R = S.R;
    this.H = o.H; this.bias = o.bias; this.edge = o.edge; this.lakeMin = o.lakeMin; this.divide = o.divide;
    this.g = new Grid(o.n);
    const len = this.g.len;
    this.ter = new Float32Array(len);     // the base field as sampled
    this.lvl = new Float32Array(len);     // the same, every depression filled to its sill
    this.acc = new Uint16Array(len);      // how many nodes drain through this one (1 = only itself)
    this.cell = (Math.PI * 0.5 * this.R) / o.n;   // metres a cell at a face centre
    this.lakeNodes = 0; this.deepest = 0;   // kept for the log, not read by the game
    this.ms = { base: 0, flood: 0, flow: 0, halo: 0 };
    this._o = this.out();
  }

  out() { return { level: 0, pool: 0, fill: 0, fall: 0, acc: 1, fx: 0, fy: 0, fz: 0, _f: 0, _p: 0, _tu: 0, _tv: 0 }; }

  build() {
    this._sampleBase();
    this._flood();
    this._flow();
    this._halo();
    this.ready = true;
    return this;
  }

  // 1. the base field at every interior node
  _sampleBase() {
    const t0 = now();
    const g = this.g, n = g.n, S = this.S, d = [0, 0, 0];
    const w = new Float32Array(S.nB);
    for (let f = 0; f < 6; f++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      g.dirOf(f, i, j, d);
      this.ter[g.pid(f, i, j)] = S.waterBaseAt(d[0], d[1], d[2], w, this.divide);
    }
    this.ms.base = now() - t0;
  }

  // 2. the priority flood. Seeded with the lowest nodes of all -- on a sphere there is no edge to pour
  // off, so the sea (where the base field is the sea level) is the outlet; a world with no sea pours
  // into its own lowest node. Popping the lowest known node and carrying its level outward fills every
  // depression to the height of the lowest pass out of it, which is where its water really stands.
  _flood() {
    const t0 = now();
    const g = this.g, n = g.n, ter = this.ter, lvl = this.lvl, len = g.len;
    const done = new Uint8Array(len);
    const from = new Int32Array(len).fill(-1);
    const ord = new Int32Array(6 * n * n);     // the pop order: a valid downhill ordering for step 3
    const heap = new Heap(6 * n * n + 8);
    // the seeds: every node within a metre of the lowest base level anywhere (the sea, or one pit)
    let lo = Infinity;
    for (let f = 0; f < 6; f++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const t = ter[g.pid(f, i, j)]; if (t < lo) lo = t; }
    let seeds = 0;
    for (let f = 0; f < 6; f++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const p = g.pid(f, i, j);
      if (ter[p] <= lo + 1.0) { lvl[p] = ter[p]; done[p] = 1; heap.push(ter[p], p); seeds++; }
    }
    this.seeds = seeds;
    let k = 0;
    const nb = new Int32Array(8);
    while (heap.n > 0) {
      const c = heap.pop();
      ord[k++] = c;
      const m = this._nbs(c, nb);
      for (let t = 0; t < m; t++) {
        const p = nb[t];
        if (done[p]) continue;
        done[p] = 1; from[p] = c;
        lvl[p] = ter[p] > lvl[c] ? ter[p] : lvl[c];
        heap.push(lvl[p], p);
      }
    }
    this.ord = ord.subarray(0, k);
    this.from = from;
    // what the fill came to, for the log
    let lk = 0, deep = 0;
    for (let f = 0; f < 6; f++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const p = g.pid(f, i, j), fl = lvl[p] - ter[p];
      if (fl > this.lakeMin) { lk++; if (fl > deep) deep = fl; }
    }
    this.lakeNodes = lk; this.deepest = deep;
    this.ms.flood = now() - t0;
  }

  // the neighbours of an interior node, as padded interior indices. Inside a face this is arithmetic;
  // on a face's edge the would-be node's direction is looked up on whichever face owns it.
  _nbs(p, out) {
    const g = this.g, n = g.n, w = g.w;
    const f = Math.floor(p / g.s2), r = p - f * g.s2;
    const i = (r % w) - 1, j = ((r - (r % w)) / w) - 1;
    let m = 0;
    const d = this._d || (this._d = [0, 0, 0]);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (di === 0 && dj === 0) continue;
      const ii = i + di, jj = j + dj;
      if (ii >= 0 && ii < n && jj >= 0 && jj < n) out[m++] = g.pid(f, ii, jj);
      else { g.dirOf(f, ii, jj, d); const q = g.idOf(d[0], d[1], d[2]); if (q !== p) out[m++] = q; }
    }
    return m;
  }

  // 3. which way each node drains, and how much drains through it. Steepest descent on the FILLED
  // surface where there is any descent; inside a filled basin every level is equal, so the water is
  // sent back the way the flood reached it, which is the way out to the sill.
  _flow() {
    const t0 = now();
    const g = this.g, lvl = this.lvl, acc = this.acc, ord = this.ord, from = this.from;
    const rank = new Int32Array(g.len).fill(-1);
    for (let t = 0; t < ord.length; t++) rank[ord[t]] = t;
    const to = new Int32Array(g.len).fill(-1);
    const nb = new Int32Array(8);
    for (let t = 0; t < ord.length; t++) {
      const p = ord[t], m = this._nbs(p, nb);
      let best = -1, bd = 0;
      for (let q = 0; q < m; q++) {
        const r = nb[q];
        if (rank[r] < 0 || rank[r] >= t) continue;      // only ever drain to a node the flood reached first
        const dh = lvl[p] - lvl[r];
        if (dh > bd) { bd = dh; best = r; }
      }
      to[p] = best >= 0 ? best : (from[p] >= 0 ? from[p] : -1);
      acc[p] = 1;
    }
    for (let t = ord.length - 1; t >= 0; t--) {
      const p = ord[t], q = to[p];
      if (q < 0) continue;
      const a = acc[q] + acc[p];
      acc[q] = a > 65535 ? 65535 : a;
    }
    this.ms.flow = now() - t0;
    this.from = null; this.ord = null;        // only the field is kept
  }

  // 4. the halo: each face's border node is a copy of whichever node really owns that direction, so a
  // read is a bilinear inside one face and never has to cross an edge.
  _halo() {
    const t0 = now();
    const g = this.g, n = g.n, d = [0, 0, 0];
    for (let f = 0; f < 6; f++) for (let j = -1; j <= n; j++) for (let i = -1; i <= n; i++) {
      if (i >= 0 && i < n && j >= 0 && j < n) continue;
      g.dirOf(f, i, j, d);
      const src = g.idOf(d[0], d[1], d[2]), dst = g.pid(f, i, j);
      this.ter[dst] = this.ter[src]; this.lvl[dst] = this.lvl[src]; this.acc[dst] = this.acc[src];
    }
    this.ms.halo = now() - t0;
  }

  bytes() { return this.ter.byteLength + this.lvl.byteLength + this.acc.byteLength; }

  // ---- the read: eight array reads and some lerps -----------------------------------------------------
  // out.level  the filled level here (level inside a basin, the land's own fall outside one)
  // out.fill   how deep the fill stands over the base field (0 on a slope, metres inside a basin)
  // out.pool   where STANDING water stands: out.level inside a basin, the pool band outside (below)
  // Which way it falls and how much drains through it are the other two reads below, asked for only where
  // they are wanted: surface.js wants the fall on the few samples that are in a channel, not on all of
  // them, and asking for it here cost 0.14 us of a 2.80 us sample (measured 2026-11-23).
  at(x, y, z, out) {
    const o = out || this._o, g = this.g, n = g.n, w = g.w;
    const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
    let f;
    if (ax >= ay && ax >= az) f = x > 0 ? 0 : 1;
    else if (ay >= az) f = y > 0 ? 2 : 3;
    else f = z > 0 ? 4 : 5;
    const F = FACES[f];
    const dd = x * F.n[0] + y * F.n[1] + z * F.n[2];
    const a = (x * F.u[0] + y * F.u[1] + z * F.u[2]) / dd;
    const b = (x * F.v[0] + y * F.v[1] + z * F.v[2]) / dd;
    const fa = ((a + 1) * 0.5) * n - 0.5, fb = ((b + 1) * 0.5) * n - 0.5;
    let i0 = Math.floor(fa), j0 = Math.floor(fb);
    if (i0 < -1) i0 = -1; else if (i0 > n - 1) i0 = n - 1;
    if (j0 < -1) j0 = -1; else if (j0 > n - 1) j0 = n - 1;
    const tu = fa - i0, tv = fb - j0;
    const p = f * g.s2 + (j0 + 1) * w + (i0 + 1);
    const L = this.lvl, T = this.ter;
    const l00 = L[p], l10 = L[p + 1], l01 = L[p + w], l11 = L[p + w + 1];
    const lb = l00 + (l10 - l00) * tu, lt = l01 + (l11 - l01) * tu;
    const lev = lb + (lt - lb) * tv;
    const t00 = T[p], t10 = T[p + 1], t01 = T[p + w], t11 = T[p + w + 1];
    const tb = t00 + (t10 - t00) * tu, tt = t01 + (t11 - t01) * tu;
    let fill = lev - (tb + (tt - tb) * tv);
    if (fill < 0) fill = 0;
    o.level = lev; o.fill = fill;
    o._f = f; o._p = p; o._tu = tu; o._tv = tv;
    return o;
  }

  // Which way the water falls here, from the same cell the last at() read: out.fall in metres a metre and
  // out.fx/y/z a unit vector in the body's own frame. Call it straight after at() with the same out.
  flow(o) {
    const g = this.g, n = g.n, w = g.w, L = this.lvl;
    const F = FACES[o._f], p = o._p, tu = o._tu, tv = o._tv;
    const l00 = L[p], l10 = L[p + 1], l01 = L[p + w], l11 = L[p + w + 1];
    // the cell is 2/n wide in a and in b, and one unit of a is about R * (pi / 4) metres of ground at a
    // face centre: near enough for a direction and for how steep the fall is
    const perA = (2 / n) * this.R * Math.PI * 0.25;
    const ga = ((l10 - l00) * (1 - tv) + (l11 - l01) * tv) / perA;
    const gb = ((l01 - l00) * (1 - tu) + (l11 - l10) * tu) / perA;
    o.fall = Math.sqrt(ga * ga + gb * gb);
    const dx = -(ga * F.u[0] + gb * F.v[0]), dy = -(ga * F.u[1] + gb * F.v[1]), dz = -(ga * F.u[2] + gb * F.v[2]);
    const dl = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dl > 1e-12) { const il = 1 / dl; o.fx = dx * il; o.fy = dy * il; o.fz = dz * il; }
    else { o.fx = 0; o.fy = 0; o.fz = 0; }
    return o;
  }

  // How many grid nodes drain through here: 1 is a hilltop, a river's main stem is hundreds. Nothing in
  // stage one reads it; the falls and the river's width downstream (docs: stage two) will.
  through(o) {
    const w = this.g.w, A = this.acc, p = o._p, tu = o._tu, tv = o._tv;
    const ab = A[p] + (A[p + 1] - A[p]) * tu, at2 = A[p + w] + (A[p + w + 1] - A[p + w]) * tu;
    o.acc = ab + (at2 - ab) * tv;
    return o.acc;
  }

  // WHERE STANDING WATER STANDS. Two cases, blended by how deep the fill is.
  //
  // A FILLED BASIN (fill over lakeMin) is a lake or a pond: its level is the sill, dead level over the
  // whole basin, and the shoreline is wherever the ground rises through it -- so it follows the land's
  // own contour and nothing is placed by hand.
  //
  // ELSEWHERE the level is a STAIRCASE. A river cannot descend all the way round a sphere (its course is
  // the zero contour of a noise field, which is a closed loop, and no function is monotone round a
  // closed loop), so it descends the way a real brook on a hillside does: a reach standing level, a lip,
  // a fall, the next reach. The band is flat over 1 - edge of its height and falls H at the lip, which
  // on the measured 2 % reach is a 100 to 200 m pool and a fall of H over some 24 m.
  //
  // `base` is the CALLER'S OWN exact base level, where it has one (surface.js's wood has c.L). Pass it:
  // the grid's own `level` is blended across the biomes under the node and lifted over dry ground, so on
  // a seam between a wood and a dry biome it reads metres too high, and a level read from it there lifted
  // the GROUND through the berm (measured 2026-11-23 before this: 947 of 20,000 points on Earth moved,
  // the worst by 57 m). With `base` given, the staircase stands on the caller's own field and only the
  // FILL -- how deep a basin is, which is 0 on every slope -- comes from the grid. The cap is the same
  // guard once more: water can stand no higher than the fill plus the band's own bias.
  poolLevel(level, fill, base) {
    const b = base === undefined ? level : base;
    const H = this.H;
    const u = (b + fill) / H, k = Math.floor(u), t = u - k;
    const band = k * H + this.bias + H * smoothstep(1 - this.edge, 1, t);
    const lake = smoothstep(this.lakeMin * 0.5, this.lakeMin * 1.5, fill);
    const lv = band + (level - band) * lake;
    const cap = b + fill + this.bias;
    return lv < cap ? lv : cap;
  }
}

function now() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Number(process.hrtime.bigint()) / 1e6; }

// Build the field for a surface and hand it to that surface. Call it ONCE, before the first terrain
// patch of that world is built: every patch that is built before it lands would keep the old levels and
// would not agree with its neighbours. Returns the field, or null if the world has no liquid at all.
export function attachDrainage(S, opts) {
  if (!S || typeof S.waterBaseAt !== 'function') return null;
  if (S.drain) return S.drain;
  if (!S.lqGroup.some((g) => g >= 0)) return null;      // a world with no liquid of any kind gets no field
  const d = new Drainage(S, opts).build();
  S.drain = d;
  return d;
}

// The same by body id, and safe to call every frame: it builds once and then returns what it built. The
// one place it must NOT be first called is after that world's terrain has started building, because a
// patch built before the field lands keeps the old levels and will not meet its neighbours; call it for
// the starting world before the world is made, and for any other world before the eye arrives there.
export function ensureDrainage(bodyId, opts) {
  const done = ensureDrainage._d || (ensureDrainage._d = new Set());
  if (done.has(bodyId)) { const S = getSurface(bodyId); return S ? S.drain : null; }
  done.add(bodyId);
  try { return attachDrainage(getSurface(bodyId), opts); } catch (e) { return null; }
}
