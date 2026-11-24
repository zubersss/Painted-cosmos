// Painted Cosmos: LAKES, PONDS, PUDDLES, A RIVER'S MOUTH AND FJORDS (?lakes= ?ponds= ?puddles= ?falls= ?fjord=). OWNER:
// PAINTER (the water group, lane W2). docs/lead/WATER-DESIGN.md, sections 3.1, 3.3 and 3.5.
//
// The owner, 23-24 Nov: water that "pools in areas it can't find go downhill any further", "the natural lakes and ponds and
// oceans", "fjords and waterfalls", and the waterfall off the sea cliff where the river reaches the sea.
//
// THE CONTRACT (lane 0's; world/waterhooks.js calls attachHydro once a world, after the drainage field and the rivers, before
// the first patch; surface.js calls the two hooks):
//   attachHydro(S, drain, rivers)  builds what the address asks for (MODE.water) and sets S.hydro = { forest, coast }.
//   hydro.forest(S, c, b, H)       from surface.js _forest after the water's level: H holds the parts b.h was made of
//                                  (b.h = H.L + H.hb + H.hill * H.rise + H.sm + H.mi + H.rock). May set b.h, b.lq, c.still,
//                                  c.bank, c.cap.
//   hydro.coast(S, c, hh, T)       from the coast recipe after its cliff and stacks: returns the new hh and sets c.lqC EVERY
//                                  time (the level of river water standing in a mouth's cut, NaN where there is none).
//
// WHAT EACH PART DOES
//   LAKES (?lakes=1, lakeCarve). The drainage field fills 13 basins on Earth to their sills, but the wood's hills stood in
//     them, so only the channels flooded (148 of 708 points in the largest). Inside a filled basin the hills are drowned: the
//     relief over the base level shrinks by lakeK where the fill is deep and the bed is let down a little more, so the lake is
//     open water up to a shoreline wherever the land rises through the sill, and the tallest hills stand as islands.
//   THE MOUTH CUT (?falls=1, mouthCut). Measured in Node at Earth's main mouth (24 Nov): the land between a river's end and the
//     sea is NOT the coast's own ground (the coast recipe there is open sea, -11 to -22 m) but surface.js sample()'s BERM: across
//     the wood-sea blend the wood's water never holds 0.55 of the weight, so the ground is lifted to its level + 1.2 m (the
//     "flat 26 m shelf"), until the wood's weight falls under 0.0015 and the berm stops (the "sheer wall", 25.6 to -18.4 m in
//     one step). A river therefore ends 200 to 400 m short of the sea behind a shelf. The cut is a CORRIDOR from the river's end
//     to that wall: inside it the wood's b.lq and the coast's c.lqC both carry the cut's water level, so sample() merges the two
//     groups and the berm does not fire; both recipes return the same bed and banks, so the blend is the bed; beyond the bank the
//     ground is untouched. The LIP is put at the wall (found at load by walking the unchanged surface), so the river runs through
//     its cut to the cliff's edge and falls into the sea at its foot.
//   FJORDS (?fjord=1, fjordCut). A big river's mouth may instead be drowned: the corridor and the river's own last reach become
//     a narrow inlet at the sea's level between steep walls, and the river falls into its head.
//   PONDS (?ponds=1, pondAt). A jittered grid of 120 m cells; a cell may hold one small still pond in an open, level glade: its
//     outline a bent ellipse, its level just under the lowest point of its rim (so it is always held in), its bed a bowl.
//   PUDDLES (?puddles=1, puddleCap). The fine relief's hollows on near-level ground: c.cap is how deep water stands there at
//     full wetness (at most 0.12 m). The paint (lane W3) lets them come and go with the ground's wetness. On a river's flat floor
//     (where the land is near level everywhere, so the slope alone would let every hollow hold one) a hollow must be deeper,
//     and none lies right at the water's edge: they stay few beside a wide river too.
// THE FALLS LIST (S.hydro.falls) is what world/falls.js draws: one entry a lip, with its place, its way, width, the level at the
// lip and at the foot, and the water's speed over it.
//
// RULES KEPT: nothing is built or asked without its switch; the sample's shared fields are written by surface.js every time; the
// hooks never call S.sample (the surface's scratch state is shared), so everything that needs the ground is measured at load.
import { MODE } from '../data/mode.js';
import { smoothstep } from './noise.js';
import { NOLQ, makeSample } from './surface.js';
import { FACES as FACES_LOCAL } from './cubesphere.js';
import { alpineMacro } from './mountain.js';

export const HYDRO_DEF = {
  // lakes
  lakeK: 0.78,       // the share of a basin's relief drowned where it is filled deepest (a look's oil.lakeK)
  lakeDrop: 1.4,     // metres the bed is let down under the base level where the fill is deep
  lakeIn: 1.6,       // the hills go down over (lakeIn - 1) * lakeMin of fill from where the drowning starts
  lakeArea: 0.75,    // km2: the most of any basin that becomes open water (its deepest core; about a kilometre across)
  // tarns (?mount=1 with the lakes: small still lakes in the mountains' hollows where their streams gather)
  tarnAcc: 15,       // nodes of the mountain draining into a hollow, at least (where the streams gather)
  tarnGap: 350,      // metres between two tarns, at least
  tarnMax: 24,       // tarns a world, at most
  tarnCell: 18, tarnN: 13,   // the ground measured round a hollow at load: 13 x 13 points 18 m apart
  tarnArea: 0.038,   // km2: a tarn no larger (about 220 m across)
  tarnDepth: 7,      // metres: and no deeper than this under its rim
  tarnMin: [6, 0.8], // and at least this many of those points, and this deep, or it is no tarn
  // the mouth cut
  step: 6,           // metres between the stations of a corridor
  maxLen: 640,       // metres: a corridor no longer than this
  back: 18,          // metres: the corridor starts this far up the river's own end
  wallDrop: 6,       // metres: a drop this big within one step is the coast's wall
  turn: 0.15,        // how fast the corridor turns toward the sea (down the wood's weight), a share a step
  hwMin: 0.9,        // metres: the narrowest channel cut (half width)
  depth: 1.0,        // metres of water in the middle of the cut's channel
  lipDepth: 0.35,    // ... and over the hard rock lip
  edge: 0.22,        // metres of water at the channel's edge, where the bank begins
  slope: 0.0025,     // the cut's water falls this much a metre toward the lip ...
  fallAlong: 1.2,    // ... and no more than this in all
  draw: 0.3,         // metres: the water draws down over the last few widths before the lip
  bankK: 0.9,        // the bank runs bankK metres for each metre it rises ...
  bankMin: 3, bankMax: 16,   // ... held to this
  fallMin: 3,        // metres: a smaller drop at the wall is no fall
  seaFoot: -1,       // metres: the wall's foot must be under the sea by this much (a fall into the sea, not onto a beach)
  // fjords (a look's oil.fjords overrides: { every, len: [a, b], width: [a, b], depth, minW })
  fjord: { every: 1, len: [300, 600], width: [40, 90], depth: 12, minW: 8, bankK: 0.45 },
  // ponds (a biome's oil.ponds, else the world's look oil.ponds: the chance a cell holds one)
  pondCell: 120,     // metres
  pondChance: 0.0,   // the default where neither the biome nor the world says
  pondR: [6, 22],    // metres: the larger half axis
  pondSpread: 1.4,   // metres: the most the rim may vary (a pond only on level ground)
  pondDepth: [0.6, 1.2],
  pondGlade: 0,      // how open the ground must be (0: a woodland pond is fine; the trees keep off water by themselves)
  pondChannel: 22,   // metres: no pond this close to running water
  pondKeep: 80,      // metres: no pond this near a landing's or an easel's clearing
  pondRelief: 9,     // metres: only where the wood's hills stand lower than this (hollows and valley floors)
  // puddles (a biome's oil.puddles, else the world's: 0 none .. 1)
  capMax: 0.12,      // metres
  capSlope: 0.03,    // no puddle on a slope steeper than this
  capFloor: 0.12,    // metres: on a river's flat floor a hollow must be this much deeper to hold one (times (1 - rise)^2, the
                     // wood's rise: 0 on the floor, 1 some 95 m from the water) ...
  capBank: [4, 10],  // ... and none within the first of these metres of the water's edge, all by the second
};

const D2 = Math.PI / 4;

// ---- small vector helpers (unit directions; metres are R times) ------------------------------------------------------
function norm3(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; v[0] /= l; v[1] /= l; v[2] /= l; return v; }
// move a unit point p along a tangent direction d by m metres (R the radius); returns a new unit point
function move(p, d, m, R) { const k = m / R; return norm3([p[0] + d[0] * k, p[1] + d[1] * k, p[2] + d[2] * k]); }
// d projected into the tangent plane at p, made unit
function tangent(p, d) { const k = d[0] * p[0] + d[1] * p[1] + d[2] * p[2]; return norm3([d[0] - p[0] * k, d[1] - p[1] * k, d[2] - p[2] * k]); }
// the tangent axes the rivers use at a point
function axes(p) {
  let ux = -p[2], uy = 0, uz = p[0];
  if (Math.abs(p[1]) > 0.9) { ux = 0; uy = p[2]; uz = -p[1]; }
  const ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
  return [[ux, uy, uz], [p[1] * uz - p[2] * uy, p[2] * ux - p[0] * uz, p[0] * uy - p[1] * ux]];
}
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function hash3(a, b, c, s) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647) ^ Math.imul(s | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// ---- the pure parts (named as the design names them; the class below calls them) ------------------------------------

// LAKES: the hills of a filled basin drowned. `dr` is the drainage read for this point (fill), lakeMin the field's.
// f0: where in this basin the drowning starts (its fill, m): lakeMin for a small basin, deeper for a big one, so that only its
// deepest core becomes open water (the coordinator's ruling, 24 Nov: lakes sit IN the wood, the largest about a kilometre
// across); the shore is then a contour of the fill, which is a contour of the land's own base level.
export function lakeCarve(c, b, H, fill, lakeMin, o, f0) {
  const s0 = f0 === undefined ? lakeMin : f0;
  if (!(fill > s0)) return false;
  const k = o.lakeK * smoothstep(s0, s0 + lakeMin * (o.lakeIn - 1), fill);
  const k2 = smoothstep(s0, s0 + lakeMin * 1.5, fill);
  const hb = H.hb - k * Math.max(0, H.hb + 0.4);
  b.h = H.L + hb - o.lakeDrop * k2 + H.hill * H.rise * (1 - k) + H.sm * (1 - 0.6 * k) + H.mi + H.rock * (1 - k);
  if (b.lq > b.h) {
    c.still = Math.max(c.still, smoothstep(lakeMin * 0.5, lakeMin * 1.5, fill));
    c.swell = Math.max(c.swell, 0.6 * k / o.lakeK);      // (a lake rises a little after rain; the max rule shared with the rivers)
  }
  return true;
}

// THE CUT'S CROSS SECTION at signed distance d from its centre line: a channel of half width hw whose bed is `dep` under the
// water `lv` in its middle and `edge` at its sides, then a bank that rises from there to the shelf T over B metres.
export function mouthCut(d, hw, B, lv, dep, edge, T) {
  const a = d < 0 ? -d : d;
  const e = lv - edge;
  if (a < hw) { const u = a / hw; return e - dep * (1 - u * u); }
  const u = Math.min(1, (a - hw) / B);
  return e + (T - e) * u * u * (3 - 2 * u);
}

// A FJORD'S CROSS SECTION: a U-shaped floor `depth` under the sea across half width hw, walls rising to T over B.
export function fjordCut(d, hw, B, sea, depth, T) {
  const a = d < 0 ? -d : d;
  if (a < hw) { const u = a / hw; return sea - depth * (1 - u * u * u * u); }
  const u = Math.min(1, (a - hw) / B);
  return sea + (T - sea) * Math.pow(u, 0.7);
}

// PONDS: the ground and water of one pond at its bent-ellipse radius rho. Returns the new ground, and writes the level into
// out[0] (NaN outside the water).
export function pondAt(rho, h, level, dep, out) {
  if (rho < 1) { out[0] = level; const g = level - dep * Math.pow(1 - rho * rho, 0.7); return g < h ? g : h; }
  out[0] = NaN;
  const r = level + 0.14 * smoothstep(1, 1.1, rho) * (1 - smoothstep(1.1, 1.45, rho));
  return h < r ? r : h;
}

// PUDDLES: the depth water stands at full wetness in a hollow of the fine relief (sm: the 15.5 m term, amplitude 0.42 m; mi: the
// 3.4 m term), on ground whose slope is `slope`; `deep` (metres, default 0) more of a hollow asked for. 0 where there is none.
export function puddleCap(sm, mi, slope, o, k, deep) {
  if (!(k > 0) || slope > o.capSlope) return 0;
  const hollow = -sm - mi * 0.6 - 0.13 - (deep || 0);   // deeper than 13 cm under the mean of the 15 m relief (and `deep`)
  if (hollow <= 0) return 0;
  const flat = 1 - smoothstep(o.capSlope * 0.5, o.capSlope, slope);
  const cap = Math.min(o.capMax, hollow * 0.55) * flat * Math.min(1, k);
  return cap > 0.008 ? cap : 0;
}

// The wood's hills at a point, as surface.js _forest makes them before `rise` (hill * 24 + mid * 4.5): asked straight of the
// noise so a hook or a load-time filter need not call the surface (tests/hydro.test.mjs holds this to _forest's own H.hill).
export function forestRelief(S, x, y, z) {
  const R = S.R, nA = S.nA.n3, f1 = R / 350, f2 = R / 98;
  const hill = Math.max(0, 0.5 + 0.55 * nA(x * f1 + 7.7, y * f1 + 1.1, z * f1 - 3.3));
  return hill * 24 + nA(x * f2 - 5.1, y * f2 + 8.8, z * f2 + 2.4) * 4.5;
}

// ---- the parts of one world --------------------------------------------------------------------------------------------

class Hydro {
  constructor(S, D, net, want, opts) {
    this.S = S; this.D = D; this.net = net; this.R = S.R;
    const lookO = (S.look && S.look.oil) || {};
    const o = this.o = Object.assign({}, HYDRO_DEF, opts || {});
    if (lookO.lakeK != null) o.lakeK = lookO.lakeK;
    if (lookO.fjords) o.fjord = Object.assign({}, HYDRO_DEF.fjord, lookO.fjords);
    this.want = want;
    this.lakes = !!want.lakes; this.ponds = false; this.puddles = false;
    this.cors = []; this.nCor = 0; this.falls = [];
    this.cn = Math.max(4, Math.round((Math.PI * 0.5 * S.R) / o.pondCell));   // (the 120 m cells' count a face edge)
    this.ms = { lakes: 0, tarns: 0, cuts: 0, ponds: 0 };
    this._q = { x: NaN, y: NaN, z: NaN, i: -1, t: 0, d: 0, k: 0, f: 0 };
    this._lv = [NaN];
    // (the two hooks, bound so surface.js can call them as S.hydro.forest / S.hydro.coast)
    this.forest = this.forest.bind(this);
    this.coast = this.coast.bind(this);
    this.alpine = this.alpine.bind(this);
  }

  // ---- built once, at load ---------------------------------------------------------------------------------------------
  build() {
    const S = this.S;
    this._smp = makeSample(S.nB);
    this._bw = new Float32Array(S.nB);
    const W = this.want;
    if (W.lakes) this._buildLakes();
    if (W.tarns) this._buildTarns();
    if (W.falls || W.fjord) this._buildCuts();
    if (W.ponds) this._buildPonds();
    if (W.puddles) this._puddleSetup();
    this._smp = null;
    return this;
  }

  // THE LAKES' SIZE. Each basin the field fills (nodes filled over lakeMin, joined) drowns only its DEEPEST CORE, at most
  // lakeArea km2 (about a kilometre across): the nodes taken deepest first until their area reaches it, and the fill of the
  // last one taken is where that basin's drowning starts (lakeF0, per node, halo included). A basin smaller than that drowns
  // whole, as before.
  _buildLakes() {
    const t0 = now();
    const D = this.D, g = D.g, n = g.n, len = g.len, lm = D.lakeMin, R = this.R, o = this.o;
    const F0 = new Float32Array(len).fill(1e9), comp = new Int32Array(len).fill(-1), nb = new Int32Array(8);
    const d3 = [0, 0, 0], d4 = [0, 0, 0];
    const areaOf = (f, i, j) => {      // (m2: the node's cell, from its neighbours' places)
      g.dirOf(f, i, j, d3); g.dirOf(f, i + 1, j, d4);
      const a = Math.hypot(d3[0] - d4[0], d3[1] - d4[1], d3[2] - d4[2]) * R;
      g.dirOf(f, i, j + 1, d4);
      return a * Math.hypot(d3[0] - d4[0], d3[1] - d4[1], d3[2] - d4[2]) * R;
    };
    const maxA = o.lakeArea * 1e6, lakeW = [];
    let id = 0, biggest = 0;
    this.lakeCores = [];
    for (let f = 0; f < 6; f++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const p0 = g.pid(f, i, j);
      if (comp[p0] >= 0 || D.lvl[p0] - D.ter[p0] <= lm) continue;
      const st = [p0], nodes = [];
      comp[p0] = id;
      while (st.length) {
        const p = st.pop(); nodes.push(p);
        const k = D._nbs(p, nb);
        for (let t = 0; t < k; t++) { const q = nb[t]; if (comp[q] < 0 && D.lvl[q] - D.ter[q] > lm) { comp[q] = id; st.push(q); } }
      }
      const rows = nodes.map((p) => {
        const ff = Math.floor(p / g.s2), r = p - ff * g.s2, ii = (r % g.w) - 1, jj = ((r - (r % g.w)) / g.w) - 1;
        return [D.lvl[p] - D.ter[p], areaOf(ff, ii, jj), p];
      }).sort((a, b) => b[0] - a[0]);
      let acc = 0, f0 = lm;
      for (const [fl, a] of rows) { acc += a; if (acc > maxA) { f0 = Math.max(lm, fl); break; } }
      for (const [, , p] of rows) F0[p] = f0;
      const coreRows = rows.filter((r) => r[0] >= f0), core = coreRows.reduce((s2, r) => s2 + r[1], 0);
      biggest = Math.max(biggest, core);
      // HOW WIDE the lake is (for the water's paint: a lake wider than about 150 m is laid as the sea is -- the look
      // director's condition for the new strokes on ponds): the narrow axis of the ellipse of the core's own area and
      // shape (the core's nodes' spread on the ground, their second moments), 2 sqrt(A r / pi) with r the axes' ratio
      let mx = 0, my = 0, mz = 0;
      for (const [, , p] of coreRows) { const q = this._pdir(p, d3); mx += q[0]; my += q[1]; mz += q[2]; }
      const ml = Math.hypot(mx, my, mz) || 1; mx /= ml; my /= ml; mz /= ml;
      let ux = -mz, uy = 0, uz = mx; if (Math.abs(my) > 0.9) { ux = 0; uy = mz; uz = -my; }
      const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
      const vx = my * uz - mz * uy, vy = mz * ux - mx * uz, vz = mx * uy - my * ux;
      let suu = 0, svv = 0, suv = 0;
      for (const [, , p] of coreRows) {
        const q = this._pdir(p, d3), a = (q[0] * ux + q[1] * uy + q[2] * uz) * R, b = (q[0] * vx + q[1] * vy + q[2] * vz) * R;
        suu += a * a; svv += b * b; suv += a * b;
      }
      const nC = Math.max(1, coreRows.length); suu /= nC; svv /= nC; suv /= nC;
      const tr = suu + svv, dt = Math.sqrt(Math.max(0, (suu - svv) * (suu - svv) / 4 + suv * suv)), l1 = tr / 2 + dt, l2 = tr / 2 - dt;
      const ratio = l1 > 1e-6 ? Math.sqrt(Math.max(0, l2) / l1) : 1;
      lakeW.push(2 * Math.sqrt(core * ratio / Math.PI));
      this.lakeCores.push({ nodes: nodes.length, area: rows.reduce((s2, r) => s2 + r[1], 0), core, f0, width: lakeW[id] });
      id++;
    }
    // (the halo, as the field's own: a read stands between four nodes of one face)
    for (let f = 0; f < 6; f++) for (let j = -1; j <= n; j++) for (let i = -1; i <= n; i++) {
      if (i >= 0 && i < n && j >= 0 && j < n) continue;
      g.dirOf(f, i, j, d3);
      const q = g.idOf(d3[0], d3[1], d3[2]);
      F0[g.pid(f, i, j)] = F0[q]; comp[g.pid(f, i, j)] = comp[q];
    }
    this.lakeF0 = F0; this.lakeBiggest = biggest; this.lakeComp = comp; this.lakeWidth = Float32Array.from(lakeW);
    this.ms.lakes = now() - t0;
  }

  // the wood's share at a point: the weight of the biomes whose water is the wood's (groups 0 and 2), and of the coast
  _kinds(p) {
    const S = this.S, bw = this._bw;
    S.biomeWeights(p[0], p[1], p[2], bw);
    let wood = 0, ok = 0;
    for (let i = 0; i < S.nB; i++) {
      const g = S.lqGroup[i], t = S.biomes[i].terrain;
      if (g === 0 || g === 2) wood += bw[i];
      if (t === 'forest' || t === 'coast') ok += bw[i];
    }
    return [wood, ok];
  }

  _h(p) { const o = this._smp; this.S.sample(p[0], p[1], p[2], o, false); return o; }

  // THE MOUTHS. From the rivers' list where the tree is drawn (world/rivers.js net.mouths); without it, from a search of the
  // drainage field for wood water near the sea (the design's fallback).
  _mouths() {
    if (this.net && this.net.mouths && this.net.mouths.length) return this.net.mouths;
    return this._searchMouths();
  }

  // (THE FALLBACK, without ?rivers=tree: wood nodes of the drainage field that drain many nodes and lie within 300 m of
  //  the sea, each with water standing in its channel; the noise rivers rarely come that close, so this finds few.)
  _searchMouths() {
    const S = this.S, D = this.D, g = D.g, n = g.n, R = this.R, out = [];
    if (!D.acc) return out;
    const d3 = [0, 0, 0], cand = [];
    for (let f = 0; f < 6; f++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const p = g.pid(f, i, j);
      if (D.acc[p] < 40) continue;
      g.dirOf(f, i, j, d3);
      const [wood] = this._kinds(d3);
      if (wood < 0.9) continue;
      cand.push([D.acc[p], d3.slice()]);
    }
    cand.sort((a, b) => b[0] - a[0]);
    for (const [acc, p] of cand.slice(0, 60)) {
      // a sea within 300 m: walk eight ways
      let best = null;
      for (let a = 0; a < 8; a++) {
        const [u, v] = axes(p), ca = Math.cos(a * D2), sa = Math.sin(a * D2);
        const dir = [u[0] * ca + v[0] * sa, u[1] * ca + v[1] * sa, u[2] * ca + v[2] * sa];
        for (let m = 60; m <= 300; m += 60) { const q = move(p, dir, m, R); const [w] = this._kinds(q); if (w < 0.05) { if (!best || m < best[0]) best = [m, dir]; break; } }
      }
      if (!best) continue;
      // water standing in a channel near the node
      const o = this._h(p);
      if (!(o.lq !== NOLQ && o.lq > o.h + 0.2)) continue;
      out.push({ end: p.slice(), lip: null, width: Math.min(12, 1.4 + 2.2 * Math.sqrt(acc / 10)), levelTop: o.lq, levelSea: S.sea == null ? 0 : S.sea, dir: best[1] });
      if (out.length >= 12) break;
    }
    return out;
  }

  // Walk from a mouth's end toward the sea, turning down the wood's weight, until the ground drops by wallDrop within a step.
  _trace(m) {
    const S = this.S, R = this.R, o = this.o, step = o.step;
    const pts = [];
    let p = move(m.end, m.dir, -o.back, R), d = tangent(p, m.dir);
    let t = -o.back, prev = null;
    for (let guard = 0; guard < 400; guard++) {
      const k = this._kinds(p);
      const s = this._h(p);
      if (k[1] < 0.985) return { fail: 'biome' };               // the corridor would cross ground the hooks cannot cut
      if (prev && prev.h - s.h > o.wallDrop) {
        // the wall: bisect between the last high station and this one
        let a = prev.p, b = p;
        for (let it = 0; it < 7; it++) {
          const mid = norm3([(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5, (a[2] + b[2]) * 0.5]);
          if (this._h(mid).h > (prev.h + s.h) * 0.5) a = mid; else b = mid;
        }
        const lipT = prev.t + Math.hypot(a[0] - prev.p[0], a[1] - prev.p[1], a[2] - prev.p[2]) * R;
        if (lipT - prev.t > 0.5) pts.push({ p: a, t: lipT, h: this._h(a).h });
        // (the foot: the lowest ground within 40 m past the wall; the berm's step may land on the coast's own cliff first)
        let foot = Infinity;
        const db = tangent(b, d);
        for (let mm = 2; mm <= 40; mm += 2) foot = Math.min(foot, this._h(move(b, db, mm, R)).h);
        return { pts, foot, top: prev.h };
      }
      if (t > o.maxLen) return { fail: 'long' };
      pts.push({ p, t, h: s.h });
      prev = pts[pts.length - 1];
      // turn toward the sea: down the gradient of the wood's weight
      if (t >= 0) {
        const [u, v] = axes(p), e = 3;
        const w0 = k[0], wu = this._kinds(move(p, u, e, R))[0], wv = this._kinds(move(p, v, e, R))[0];
        const g = [-((wu - w0) * u[0] + (wv - w0) * v[0]), -((wu - w0) * u[1] + (wv - w0) * v[1]), -((wu - w0) * u[2] + (wv - w0) * v[2])];
        if (Math.hypot(g[0], g[1], g[2]) > 1e-9) { norm3(g); d = norm3([d[0] * (1 - o.turn) + g[0] * o.turn, d[1] * (1 - o.turn) + g[1] * o.turn, d[2] * (1 - o.turn) + g[2] * o.turn]); }
      }
      p = move(p, d, step, R); d = tangent(p, d); t += step;
    }
    return { fail: 'guard' };
  }

  _buildCuts() {
    const t0 = now();
    const S = this.S, R = this.R, o = this.o, sea = S.sea == null ? 0 : S.sea;
    const mouths = this._mouths();
    this.mouthsSeen = mouths.length; this.cutFail = {};
    const fj = o.fjord;
    // (which wide mouths are drowned: the one nearest the world's first landing stays a FALL -- the owner's waterfall off the
    //  sea cliff -- and of the others, by their distance from the landing, every `every`-th from the second; so the choice
    //  does not hang on the order the rivers' list happens to have)
    const sp = S.getSpawn ? S.getSpawn() : null;
    const dl = (m) => (sp && m.end ? Math.hypot(m.end[0] - sp.x, m.end[1] - sp.y, m.end[2] - sp.z) : 0);
    const wide = mouths.filter((m) => m.width >= fj.minW && m.end).sort((a, b) => dl(a) - dl(b));
    const drown = new Set(wide.filter((m, i) => i > 0 && (i - 1) % Math.max(1, fj.every | 0) === 0));
    for (let mi = 0; mi < mouths.length; mi++) {
      const m = mouths[mi];
      if (!m.dir || !m.end) { this.cutFail.nodir = (this.cutFail.nodir || 0) + 1; continue; }
      const tr = this._trace(m);
      if (tr.fail) { this.cutFail[tr.fail] = (this.cutFail[tr.fail] || 0) + 1; continue; }
      if (tr.pts.length < 4) { this.cutFail.short = (this.cutFail.short || 0) + 1; continue; }
      if (!(tr.foot < sea + o.seaFoot)) { this.cutFail.foot = (this.cutFail.foot || 0) + 1; continue; }
      // the level the river's water actually stands at its end
      const se = this._h(m.end);
      const top = se.lq !== NOLQ && se.lq > se.h - 0.5 ? se.lq : m.levelTop;
      if (!(top - sea > o.fallMin)) { this.cutFail.low = (this.cutFail.low || 0) + 1; continue; }
      const fjord = !!this.want.fjord && drown.has(m);
      if (!fjord && !this.want.falls) continue;            // (?fjord=1 alone: the other mouths are left as they were)
      const cor = fjord ? this._fjordCor(m, tr, top, sea) : this._fallCor(m, tr, top, sea);
      if (!cor) { this.cutFail.shelf = (this.cutFail.shelf || 0) + 1; continue; }
      this.cors.push(cor);
    }
    this.nCor = this.cors.length;
    if (this.nCor) this._markCuts();
    this.ms.cuts = now() - t0;
  }

  // the stations of a corridor from the traced points: positions, tangents (seaward), lefts, arc
  _stations(pts) {
    const n = pts.length, R = this.R;
    const st = new Float64Array(n * 3), tg = new Float64Array(n * 3), lf = new Float64Array(n * 3), arc = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      const p = pts[k].p, a = pts[Math.max(0, k - 1)].p, b = pts[Math.min(n - 1, k + 1)].p;
      const t = tangent(p, [b[0] - a[0], b[1] - a[1], b[2] - a[2]]), l = cross(p, t);
      st.set(p, k * 3); tg.set(t, k * 3); lf.set(l, k * 3); arc[k] = pts[k].t;
    }
    // the bounding cap: centre and the chord radius, with room for the banks
    let cx = 0, cy = 0, cz = 0;
    for (let k = 0; k < n; k++) { cx += st[k * 3]; cy += st[k * 3 + 1]; cz += st[k * 3 + 2]; }
    const c = norm3([cx, cy, cz]);
    let rmax = 0;
    for (let k = 0; k < n; k++) rmax = Math.max(rmax, Math.hypot(st[k * 3] - c[0], st[k * 3 + 1] - c[1], st[k * 3 + 2] - c[2]));
    void R;
    return { n, st, tg, lf, arc, c, rmax };
  }

  // the shelf beside a station, measured on the unchanged surface: the ground's height B + hw out on each side, and the
  // natural water there (so the bank never stands lower than water beside it)
  _shelf(p, l, off) {
    const R = this.R;
    const out = [];
    for (const sgn of [1, -1]) {
      const q = move(p, l, sgn * off, R), s = this._h(q);
      out.push(s.h, s.lq !== NOLQ && s.lq > s.h ? s.lq : -1e9);
    }
    return out;     // [hL, lqL, hR, lqR]
  }

  _fallCor(m, tr, top, sea) {
    const o = this.o, R = this.R;
    const pts = tr.pts, S0 = this._stations(pts), n = S0.n;
    const tLip = pts[n - 1].t;
    const hw = Math.max(o.hwMin, m.width * 0.5);
    const hwc = Math.min(hw, 6);
    const fallAlong = Math.min(o.fallAlong, o.slope * Math.max(0, tLip));
    const lv = new Float32Array(n), TL = new Float32Array(n), TR = new Float32Array(n), B = new Float32Array(n), dep = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      const t = S0.arc[k];
      const along = t <= 0 ? 0 : fallAlong * Math.min(1, t / Math.max(1, tLip));
      lv[k] = top - along - o.draw * smoothstep(tLip - 4 * hwc, tLip, t);
      const lipE = smoothstep(tLip - 3 * hwc, tLip, t);
      dep[k] = o.depth * (1 - lipE) + o.lipDepth * lipE;
    }
    // THE WALL'S LINE. The coast's wall need not cross the cut square: near the lip it may lie a few metres nearer or farther
    // on either side. So, across the cut every 1.5 m, the ground is walked along the corridor's last direction from a few
    // stations back until it drops to the sea: wallT[i] is where the wall stands at offset wallD[i]. Past it the cut stops
    // (the sea is untouched), and the fall's top edge follows the same line.
    const kS = Math.max(0, n - Math.max(4, Math.ceil((hw + o.bankMax) / o.step) + 2));
    const pS = [S0.st[kS * 3], S0.st[kS * 3 + 1], S0.st[kS * 3 + 2]], lS = [S0.lf[kS * 3], S0.lf[kS * 3 + 1], S0.lf[kS * 3 + 2]];
    const tE = [S0.tg[(n - 1) * 3], S0.tg[(n - 1) * 3 + 1], S0.tg[(n - 1) * 3 + 2]];
    // (every 3 m across, walked 3 m at a time from a little before where the last offset found it, then bisected to 0.4 m)
    const WS = 3, span = Math.ceil((hw + o.bankMax + 1.5) / WS) * WS, wallD = [], wallT = [];
    const land = (q) => this._h(q).h >= sea + o.seaFoot + 1;
    let guess = tLip - S0.arc[kS];
    for (let d = -span; d <= span + 1e-6; d += WS) {
      const q0 = move(pS, lS, d, R), td = tangent(q0, tE);
      let tw = tLip + 30;
      let a = Math.max(0, guess - 9);
      if (!land(move(q0, td, a, R))) a = 0;              // (already past it there: walk from the station itself)
      for (; a <= tLip - S0.arc[kS] + 30; a += WS) {
        if (!land(move(q0, td, a + WS, R))) {
          let lo = a, hi = a + WS;
          for (let it = 0; it < 3; it++) { const mid = (lo + hi) * 0.5; if (land(move(q0, td, mid, R))) lo = mid; else hi = mid; }
          tw = S0.arc[kS] + (lo + hi) * 0.5; guess = (lo + hi) * 0.5;
          break;
        }
      }
      wallD.push(d); wallT.push(tw);
    }
    const wallAt = (d) => {
      const f = (d + span) / WS, i = Math.max(0, Math.min(wallD.length - 2, Math.floor(f))), u = Math.max(0, Math.min(1, f - i));
      return wallT[i] + (wallT[i + 1] - wallT[i]) * u;
    };
    for (let k = 0; k < n; k++) {
      const p = [S0.st[k * 3], S0.st[k * 3 + 1], S0.st[k * 3 + 2]], l = [S0.lf[k * 3], S0.lf[k * 3 + 1], S0.lf[k * 3 + 2]];
      const e = lv[k] - o.edge;
      const s0 = this._shelf(p, l, hw + 6);
      const b = Math.max(o.bankMin, Math.min(o.bankMax, (Math.max(s0[0], s0[2]) - e) * o.bankK));
      B[k] = b;
      const s1 = this._shelf(p, l, hw + b);
      // (never lower than the cut's own water, nor than natural water standing beside it: a levee where the land is low;
      //  and where the measuring point fell past the wall on the sea side the shelf is carried from the station before)
      TL[k] = Math.max(s1[0], lv[k] + 0.6, s1[1] + 0.3);
      TR[k] = Math.max(s1[2], lv[k] + 0.6, s1[3] + 0.3);
      if (k > 0 && S0.arc[k] > wallAt(hw + b) - 1.5) TL[k] = TL[k - 1];
      if (k > 0 && S0.arc[k] > wallAt(-(hw + b)) - 1.5) TR[k] = TR[k - 1];
    }
    const lip = [S0.st[(n - 1) * 3], S0.st[(n - 1) * 3 + 1], S0.st[(n - 1) * 3 + 2]];
    const dir = [S0.tg[(n - 1) * 3], S0.tg[(n - 1) * 3 + 1], S0.tg[(n - 1) * 3 + 2]];
    const across = [S0.lf[(n - 1) * 3], S0.lf[(n - 1) * 3 + 1], S0.lf[(n - 1) * 3 + 2]];
    const lipD = o.lipDepth + 0.015 * m.width;
    const fall = { kind: 'sea', lip, dir, across, width: hw * 2, top: lv[n - 1], foot: sea, floor: tr.foot, drop: lv[n - 1] - sea, speed: Math.sqrt(9.81 * lipD), lipDepth: lipD, mouth: m };
    this.falls.push(fall);
    // the fall's top edge along the wall: for each place across the sheet (u, -1..1), how far past the centre's lip it starts
    const edgeU = [], edgeT = [];
    for (let i = 0; i <= 8; i++) { const u = -1 + i / 4; edgeU.push(u); edgeT.push(Math.max(-6, Math.min(6, wallAt(u * hw) - tLip))); }
    fall.edgeU = edgeU; fall.edgeT = edgeT;
    return Object.assign(S0, { kind: 'fall', hw, lv, TL, TR, B, dep, wallD, wallT, wallSpan: span, wallStep: WS, t0: S0.arc[0], tLip, reach: hw + o.bankMax + 2, fall });
  }

  // A FJORD: the corridor and the river's own last reach drowned to the sea's level between steep walls; the river falls into
  // its head. (Only where the river is wide; a look's oil.fjords says how many, how long, how wide, how deep.)
  _fjordCor(m, tr, top, sea) {
    const o = this.o, fj = o.fjord, R = this.R, net = this.net;
    // the river's own reach, upstream of its end, for the inland part
    const h = hash3(Math.round(m.end[0] * 1e4), Math.round(m.end[1] * 1e4), Math.round(m.end[2] * 1e4), 77);
    const corrLen = tr.pts[tr.pts.length - 1].t;
    const want = fj.len[0] + (fj.len[1] - fj.len[0]) * h;
    const inland = Math.max(0, want - corrLen);
    const up = [];
    if (inland > 0 && net && net.sR && m.reach != null) {
      const sA = net.sA, sR = net.sR;
      let last = -1;
      for (let s = net.nSeg - 1; s >= 0; s--) if (sR[s] === m.reach) { last = s; break; }
      let acc = 0, s = last;
      let prevP = m.end;
      while (s >= 0 && sR[s] === m.reach && acc < inland) {
        const p = norm3([sA[s * 3] / R, sA[s * 3 + 1] / R, sA[s * 3 + 2] / R]);
        acc += Math.hypot(p[0] - prevP[0], p[1] - prevP[1], p[2] - prevP[2]) * R;
        up.push({ p, t: -acc });
        prevP = p; s--;
      }
      up.reverse();
    }
    // the centre line: the reach's points (if any), then the traced corridor from the river's end on
    const pts = up.concat(tr.pts.filter((q) => q.t >= 0));
    if (pts.length < 4) return null;
    const S0 = this._stations(pts), n = S0.n;
    const tHead = pts[0].t, tLip = pts[n - 1].t;
    const wid = fj.width[0] + (fj.width[1] - fj.width[0]) * hash3(7, Math.round(m.end[0] * 1e4), 3, 91);
    const hwF = wid * 0.5, hwR = Math.max(o.hwMin, m.width * 0.5);
    const lv = new Float32Array(n), TL = new Float32Array(n), TR = new Float32Array(n), B = new Float32Array(n), dep = new Float32Array(n), HW = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      const t = S0.arc[k], u = smoothstep(tHead, tHead + Math.min(120, (tLip - tHead) * 0.4), t);
      HW[k] = hwR + (hwF - hwR) * u;                       // narrow at its head, its full width toward the sea
      dep[k] = fj.depth * (0.35 + 0.65 * u);
      lv[k] = sea;
    }
    for (let k = 0; k < n; k++) {
      const p = [S0.st[k * 3], S0.st[k * 3 + 1], S0.st[k * 3 + 2]], l = [S0.lf[k * 3], S0.lf[k * 3 + 1], S0.lf[k * 3 + 2]];
      const s0 = this._shelf(p, l, HW[k] + 6);
      const b = Math.max(o.bankMin, Math.min(o.bankMax, (Math.max(s0[0], s0[2]) - sea) * fj.bankK));
      const s1 = this._shelf(p, l, HW[k] + b);
      B[k] = b; TL[k] = Math.max(s1[0], sea + 2); TR[k] = Math.max(s1[2], sea + 2);
    }
    // the fall at the head: the river's level down to the sea
    const p0 = [S0.st[0], S0.st[1], S0.st[2]], d0 = [S0.tg[0], S0.tg[1], S0.tg[2]], l0 = [S0.lf[0], S0.lf[1], S0.lf[2]];
    const lipD = o.lipDepth + 0.015 * m.width;
    const fall = { kind: 'fjord', lip: p0, dir: d0, across: l0, width: hwR * 2, top, foot: sea, floor: sea - dep[0], drop: top - sea, speed: Math.sqrt(9.81 * lipD), lipDepth: lipD, mouth: m };
    this.falls.push(fall);
    return Object.assign(S0, { kind: 'fjord', hw: hwF, HW, lv, TL, TR, B, dep, t0: tHead, tLip, tHead, top, reach: hwF + o.bankMax + 2, fall });
  }

  // the nearest corridor station segment to a point: q.i (corridor, -1 none), q.k, q.f (segment and fraction), q.t (arc), q.d
  // (signed distance, + to the left of the seaward flow). Cached for the point: the forest and the coast hooks ask the same one.
  _near(x, y, z) {
    const q = this._q;
    if (q.x === x && q.y === y && q.z === z) return q;
    q.x = x; q.y = y; q.z = z; q.i = -1;
    const R = this.R;
    let best = 1e18;
    for (let ci = 0; ci < this.nCor; ci++) {
      const C = this.cors[ci];
      const lim = C.rmax + C.reach / R;
      const ex = x - C.c[0], ey = y - C.c[1], ez = z - C.c[2];
      if (ex * ex + ey * ey + ez * ez > lim * lim) continue;
      const st = C.st, n = C.n;
      // (a coarse pass every 4th station, then the segments round the best)
      let bk = 0, bd = 1e18;
      for (let k = 0; k < n; k += 4) { const dx = x - st[k * 3], dy = y - st[k * 3 + 1], dz = z - st[k * 3 + 2], d2 = dx * dx + dy * dy + dz * dz; if (d2 < bd) { bd = d2; bk = k; } }
      const k0 = Math.max(0, bk - 5), k1 = Math.min(n - 1, bk + 5);
      for (let k = k0; k < k1; k++) {
        const ax = st[k * 3], ay = st[k * 3 + 1], az = st[k * 3 + 2];
        const bx = st[k * 3 + 3] - ax, by = st[k * 3 + 4] - ay, bz = st[k * 3 + 5] - az;
        const px = x - ax, py = y - ay, pz = z - az, bb = bx * bx + by * by + bz * bz;
        let f = bb > 0 ? (px * bx + py * by + pz * bz) / bb : 0;
        // (past either end of the corridor the distance keeps growing along it, so the cut does not end in a round cap)
        const fc = f < 0 ? 0 : f > 1 ? 1 : f;
        const dx = px - bx * fc, dy = py - by * fc, dz = pz - bz * fc;
        const lx = C.lf[k * 3] + (C.lf[k * 3 + 3] - C.lf[k * 3]) * fc, ly = C.lf[k * 3 + 1] + (C.lf[k * 3 + 4] - C.lf[k * 3 + 1]) * fc, lz = C.lf[k * 3 + 2] + (C.lf[k * 3 + 5] - C.lf[k * 3 + 2]) * fc;
        const across = (dx * lx + dy * ly + dz * lz);
        const d2 = dx * dx + dy * dy + dz * dz;
        // the across distance ranks; a point beyond the corridor's ends is ranked by its full distance
        const rank = (f < 0 && k === 0) || (f > 1 && k === n - 2) ? d2 : across * across;
        if (rank < best) {
          best = rank; q.i = ci; q.k = k; q.f = f; q.d = across * R;
          const seg = C.arc[k + 1] - C.arc[k];
          q.t = C.arc[k] + seg * f;
        }
      }
    }
    return q;
  }

  // ---- tarns ----------------------------------------------------------------------------------------------------------
  // THE MOUNTAIN TARNS (?mount=1 with the lakes; the coordinator, 24 Nov). The mountains' streams (world/mountain.js, the water
  // lead's) run down the mountain's own large-scale height into the valley floors and end there. Those hollows are ringed by
  // ridges, so filled to their sills they would be lakes a hundred metres deep; a tarn is small. So: the hollows where a
  // stream's catchment gathers (local lows of alpineMacro among the field's alpine nodes, with at least tarnAcc nodes draining
  // in by steepest descent), at least tarnGap apart, below the snow; round each the REAL ground is measured on a small grid,
  // and flooded from its lowest point up, cell by cell, stopping before it spills off the grid, passes tarnArea or tarnDepth.
  // The tarn's level is the last cell taken; its cells are its basin, the cells next to them its rim. In the alpine recipe the
  // water stands where the ground is under the level inside the basin; on the rim the ground is raised to just over the level
  // where it dips (so there is never a wall of water), and a margin of stones runs round it. Never on a slope: the level is a
  // flood's, so the water only fills what holds it.
  _buildTarns() {
    const t0 = now();
    const S = this.S, D = this.D, g = D.g, n = g.n, len = g.len, R = this.R, o = this.o;
    const ai = S.biomes.findIndex((b) => b.terrain === 'alpine');
    this.tarns = []; this.nTarns = 0;
    if (ai < 0 || !S.mount || !this._macro) { this.ms.tarns = now() - t0; return; }
    const T = S.biomes[ai].t || {}, snow = (T.snow || 190) - 40;
    const bw = this._bw, d3 = [0, 0, 0], nb = new Int32Array(8);
    const hM = new Float32Array(len).fill(NaN);
    for (let f = 0; f < 6; f++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const p = g.pid(f, i, j); g.dirOf(f, i, j, d3);
      // (the field took ground with no water of its own -- the mountains among it -- for a wall `divide` over the base level:
      //  only those nodes are asked their biome, a third of them)
      if (D.ter[p] - S._bigL(d3[0], d3[1], d3[2]) < 0.8 * D.divide) continue;
      S.biomeWeights(d3[0], d3[1], d3[2], bw);
      if (bw[ai] >= 0.98) hM[p] = this._macro(S, d3[0], d3[1], d3[2], T);
    }
    // steepest descent over the mountain's own height, and what drains through each node
    const order = [], to = new Int32Array(len).fill(-1), acc = new Float32Array(len);
    for (let p = 0; p < len; p++) if (hM[p] === hM[p]) order.push(p);
    for (const p of order) {
      const k = D._nbs(p, nb); let best = -1, bh = hM[p];
      for (let t = 0; t < k; t++) { const q = nb[t]; if (hM[q] === hM[q] && hM[q] < bh) { bh = hM[q]; best = q; } }
      to[p] = best;
    }
    order.sort((a, b) => hM[b] - hM[a]);
    for (const p of order) acc[p] += 1;
    for (const p of order) if (to[p] >= 0) acc[to[p]] += acc[p];
    const cand = [];
    for (const p of order) if (to[p] < 0 && acc[p] >= o.tarnAcc && hM[p] < snow) cand.push(p);
    cand.sort((a, b) => acc[b] - acc[a]);
    const smp = this._smp, N = o.tarnN, cs = o.tarnCell, half = (N - 1) / 2, maxCells = (o.tarnArea * 1e6) / (cs * cs);
    const chosen = [];
    for (const p of cand) {
      if (chosen.length >= o.tarnMax) break;
      const ff = Math.floor(p / g.s2), r0 = p - ff * g.s2, ii = (r0 % g.w) - 1, jj = ((r0 - (r0 % g.w)) / g.w) - 1;
      const c0 = g.dirOf(ff, ii, jj, [0, 0, 0]);
      if (chosen.some((q) => Math.hypot(q[0] - c0[0], q[1] - c0[1], q[2] - c0[2]) * R < o.tarnGap)) continue;
      // the real ground round it (the surface as it is, the streams' gullies in it: S.hydro is not attached yet)
      const [u, v] = axes(c0), H = new Float32Array(N * N);
      for (let b = 0; b < N; b++) for (let a = 0; a < N; a++) {
        const du = (a - half) * cs / R, dv = (b - half) * cs / R;
        const q = norm3([c0[0] + u[0] * du + v[0] * dv, c0[1] + u[1] * du + v[1] * dv, c0[2] + u[2] * du + v[2] * dv]);
        S.sample(q[0], q[1], q[2], smp, false);
        H[b * N + a] = smp.h;
      }
      // the flood from the lowest point near the middle
      let start = -1;
      for (let b = half - 3; b <= half + 3; b++) for (let a = half - 3; a <= half + 3; a++) { const k = b * N + a; if (start < 0 || H[k] < H[start]) start = k; }
      const inB = new Uint8Array(N * N), seen = new Uint8Array(N * N), heap = [[H[start], start]];
      seen[start] = 1;
      let level = H[start], cells = 0;
      const hmin = H[start];
      while (heap.length) {
        let bi = 0; for (let k = 1; k < heap.length; k++) if (heap[k][0] < heap[bi][0]) bi = k;
        const [hk, k] = heap.splice(bi, 1)[0];
        const a = k % N, b = (k - a) / N;
        if (a <= 1 || b <= 1 || a >= N - 2 || b >= N - 2) break;              // (it would spill near the grid's edge: stop before)
        if (hk - hmin > o.tarnDepth || cells + 1 > maxCells) break;
        inB[k] = 1; cells++; level = Math.max(level, hk);
        for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = (b + db) * N + (a + da); if (!seen[q]) { seen[q] = 1; heap.push([H[q], q]); } }
      }
      if (cells < o.tarnMin[0] || level - hmin < o.tarnMin[1]) continue;
      // the shore and the rim. 1 the basin; 2 the cells beside it, where the water may still stand wherever the ground is under the
      // level (the true shore, the level's contour, lies between a basin point and the next, so it falls in these cells and the
      // shore follows the land, not the grid); 3 the cells beside those, where the ground is raised to just over the level if
      // it dips (the rim that holds it in)
      const mask = new Uint8Array(N * N);
      for (let k = 0; k < N * N; k++) if (inB[k]) mask[k] = 1;
      for (const [from, put] of [[1, 2], [2, 3]]) {
        const add = [];
        for (let b = 1; b < N - 1; b++) for (let a = 1; a < N - 1; a++) {
          const k = b * N + a; if (mask[k]) continue;
          for (let db = -1; db <= 1; db++) for (let da = -1; da <= 1; da++) if (mask[(b + db) * N + (a + da)] === from) { add.push(k); db = 2; break; }
        }
        for (const k of add) mask[k] = put;
      }
      chosen.push(c0);
      this.tarns.push({ c: c0, u, v, level, hmin, cells, mask, acc: acc[p] });
    }
    this.nTarns = this.tarns.length;
    // the 120 m cells each tarn's grid reaches, marked once (index + 1), so a sample anywhere else asks nothing
    const mark = new Uint16Array(6 * this.cn * this.cn), reach = half * cs + cs;
    this.tarns.forEach((tr, i) => {
      for (let b = -reach; b <= reach; b += 20) for (let a = -reach; a <= reach; a += 20) {
        const q = norm3([tr.c[0] + (tr.u[0] * a + tr.v[0] * b) / R, tr.c[1] + (tr.u[1] * a + tr.v[1] * b) / R, tr.c[2] + (tr.u[2] * a + tr.v[2] * b) / R]);
        const k = this._cell(q[0], q[1], q[2]); if (!mark[k]) mark[k] = i + 1;
      }
    });
    this.tarnMark = mark;
    this.ms.tarns = now() - t0;
  }

  // THE TARN IN THE ALPINE RECIPE (world/mountain.js calls it after its own stream, the water lead's hook): the recipe's height
  // h; returns the height; raises c.lqA to the tarn's level where its water stands, and its margin's wash and wetness
  alpine(S, c, h) {
    if (!this.nTarns) return h;
    const id = this.tarnMark[this._cell(c.x, c.y, c.z)];
    if (!id) return h;
    const tr = this.tarns[id - 1], o = this.o, N = o.tarnN, half = (N - 1) / 2, R = this.R;
    const dx = c.x - tr.c[0], dy = c.y - tr.c[1], dz = c.z - tr.c[2];
    const a = Math.round((dx * tr.u[0] + dy * tr.u[1] + dz * tr.u[2]) * R / o.tarnCell + half);
    const b = Math.round((dx * tr.v[0] + dy * tr.v[1] + dz * tr.v[2]) * R / o.tarnCell + half);
    if (a < 0 || b < 0 || a >= N || b >= N) return h;
    const m = tr.mask[b * N + a];
    if (!m) return h;
    const lv = tr.level;
    if (m === 3) { if (h < lv + 0.15) h = lv + 0.15; }                      // (the rim holds the water in)
    else if (h < lv) {
      c.lqA = c.lqA === c.lqA ? Math.max(c.lqA, lv) : lv;
      c.still = 1; c.turbW = 0; c.fspdW = 0; c.fu = 0; c.fv = 0;
      c.swell = Math.max(c.swell, 0.4);
      c.growA = 0;
    }
    // a margin of stones and wet ground round the water
    const shore = 1 - smoothstep(lv + 0.1, lv + 1.2, h);
    c.bedA = Math.max(c.bedA, shore * 0.85);
    c.wetA = Math.max(c.wetA, shore * 0.7);
    if (shore > 0.5) c.growA = Math.min(c.growA, 1 - shore);
    return h;
  }

  // (a field node's unit direction)
  _pdir(p, out) {
    const g = this.D.g, ff = Math.floor(p / g.s2), r = p - ff * g.s2, ii = (r % g.w) - 1, jj = ((r - (r % g.w)) / g.w) - 1;
    g.dirOf(ff, ii, jj, out); return out;
  }
  // HOW WIDE THE LAKE IS at a unit direction (m; 0 where no lake of the field's basins: ponds, tarns and puddles are not
  // these lakes). For the water's paint (lane W3: a lake wider than about 150 m takes the sea's paint level): asked at load
  // by the mesher, never inside sample(). The basin's core width, read at the nearest field node.
  lakeWidthAt(x, y, z) {
    if (!this.lakeComp) return 0;
    const id = this.lakeComp[this.D.g.idOf(x, y, z)];
    return id >= 0 ? this.lakeWidth[id] : 0;
  }

  // ---- the hooks ------------------------------------------------------------------------------------------------------
  forest(S, c, b, H) {
    if (this.lakes) {
      const dr = c.dr || S._drain(c);
      if (dr.fill > this.D.lakeMin) {
        // (the basin's own start of drowning: the least of the four nodes the read stands between that lie in a basin)
        const T = this.lakeF0, p = dr._p, w = this.D.g.w;
        const f0 = Math.min(T[p], T[p + 1], T[p + w], T[p + w + 1]);
        if (f0 < 1e8) lakeCarve(c, b, H, dr.fill, this.D.lakeMin, this.o, f0);
      }
    }
    const cell = this.ponds || this.nCor ? this._cell(c.x, c.y, c.z) : -1;
    if (this.ponds) this._pond(S, c, b, cell);
    if (this.puddles) this._puddle(S, c, b, H);
    if (this.nCor && this.cutMark[cell]) this._cutForest(S, c, b, H);
  }

  coast(S, c, hh) {
    c.lqC = NaN;
    if (!this.nCor || !this.cutMark[this._cell(c.x, c.y, c.z)]) return hh;
    const q = this._near(c.x, c.y, c.z);
    if (q.i < 0) return hh;
    const C = this.cors[q.i];
    const g = this._cutGround(C, q);
    if (g === null) return hh;
    c.lqC = this._lv[0];
    c.bank = Math.max(c.bank, this._bank);
    c.turbW = this._turb; c.fspdW = this._spd;
    return hh + (g - hh) * this._w;
  }

  _cutForest(S, c, b) {
    const q = this._near(c.x, c.y, c.z);
    if (q.i < 0) return;
    const C = this.cors[q.i];
    const g = this._cutGround(C, q);
    if (g === null) {
      // just past the wall, in the cut's notch: the wood's berm is not raised there (its water is not the sea's)
      if (q.t > C.tLip - 8 && q.t < C.tLip + 10 && Math.abs(q.d) < C.hw + C.B[C.n - 1] && this._pastWall(C, q)) b.lq = NOLQ;
      return;
    }
    b.h += (g - b.h) * this._w;
    b.lq = this._lv[0];
    c.bank = Math.max(c.bank, this._bank);
    c.turbW = this._turb; c.fspdW = this._spd;
    if (C.kind === 'fjord') c.still = Math.max(c.still, 0.8);
  }

  _pastWall(C, q) {
    if (!C.wallT) return q.t > C.tLip;
    const ff = (q.d + C.wallSpan) / C.wallStep, i = Math.max(0, Math.min(C.wallD.length - 2, Math.floor(ff))), u = Math.max(0, Math.min(1, ff - i));
    return q.t > C.wallT[i] + (C.wallT[i + 1] - C.wallT[i]) * u;
  }

  // the cut's ground at the point q of corridor C; null outside it. Sets this._lv[0] (its water level), this._w (how much the
  // cut applies: it eases in over the river's own last metres), this._bank (0 shelving .. 1 a cut bank).
  _cutGround(C, q) {
    if (q.t > C.tLip + (C.wallT ? 6 : 0) || q.t < C.t0) return null;
    const k = q.k, f = q.f < 0 ? 0 : q.f > 1 ? 1 : q.f, k1 = Math.min(C.n - 1, k + 1);
    const Bk = C.B[k] + (C.B[k1] - C.B[k]) * f;
    const hw = C.HW ? C.HW[k] + (C.HW[k1] - C.HW[k]) * f : C.hw;
    const a = Math.abs(q.d);
    if (a >= hw + Bk) return null;
    // (past the coast's wall at this place across: the sea, untouched)
    if (C.wallT && this._pastWall(C, q)) return null;
    const lv = C.lv[k] + (C.lv[k1] - C.lv[k]) * f;
    const T = q.d >= 0 ? C.TL[k] + (C.TL[k1] - C.TL[k]) * f : C.TR[k] + (C.TR[k1] - C.TR[k]) * f;
    const dep = C.dep[k] + (C.dep[k1] - C.dep[k]) * f;
    this._lv[0] = lv;
    this._bank = smoothstep(hw, hw + 1.5, a) * smoothstep(1.5, 6, T - lv);
    // (the water's own churn and speed in the cut: about a metre a second, quickening and going white over the last two widths
    //  before the lip; a fjord is the sea, still. surface.js takes these in place of the drainage field's, c.turbW / c.fspdW.)
    if (C.kind === 'fjord') { this._turb = 0; this._spd = 0; }
    else {
      const near = smoothstep(C.tLip - 2.2 * Math.min(hw, 8), C.tLip, q.t);
      this._turb = 0.65 * near * near; this._spd = 1.0 + (C.fall.speed - 1.0) * near;
    }
    if (C.kind === 'fjord') {
      this._w = 1;
      // the head: the river's bed steps down into the inlet over its first few metres
      const g = fjordCut(q.d, hw, Bk, lv, dep, T);
      return g;
    }
    // (the cut eases in over the river's own last metres, so it meets the river's channel without a seam)
    this._w = smoothstep(C.t0, C.t0 + this.o.back * 0.8, q.t);
    return mouthCut(q.d, hw, Bk, lv, dep, this.o.edge, T);
  }

  // ---- ponds ------------------------------------------------------------------------------------------------------------
  _buildPonds() {
    const t0 = now();
    const S = this.S, R = this.R, o = this.o, D = this.D;
    const n = this.cn;
    this.pn = n;
    const cellOf = new Int32Array(6 * n * n).fill(-1);
    const P = [];       // per pond: cx, cy, cz, e1(3), e2(3), a, b, level, dep, seed
    const lookP = S.look && S.look.oil && S.look.oil.ponds;
    const chanceOf = (bi) => (bi.oil && bi.oil.ponds != null ? bi.oil.ponds : lookP != null ? lookP : o.pondChance);
    const FACES = this._faces();
    const bw = this._bw, smp = this._smp, seed = (S.seed | 0) ^ 0x51ed;
    // (the cheapest tests first: the largest chance any wood here has, then the hills' height straight from the noise, then
    //  the drainage's basins, and only then the biomes and the surface itself)
    let maxC = 0;
    for (const bi of S.biomes) if (bi.terrain === 'forest') maxC = Math.max(maxC, chanceOf(bi));
    const pads = S.pads || [], dro = D.out();
    let tried = 0;
    const rj = this.pondReject = { chan: 0, wet: 0, basin: 0, rim: 0, rimwet: 0, pad: 0 };
    if (maxC > 0) for (let f = 0; f < 6; f++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const hr = hash3(i, j, f, seed);
      if (hr > maxC) continue;
      // the cell's centre and its size in metres (gnomonic cells are smaller toward a face's corner)
      const F = FACES[f];
      const ca = ((i + 0.5) / n) * 2 - 1, cb = ((j + 0.5) / n) * 2 - 1;
      const jx = 0.3 + 0.4 * hash3(i, j, f, seed + 1), jy = 0.3 + 0.4 * hash3(i, j, f, seed + 2);
      const pa = ((i + jx) / n) * 2 - 1, pb = ((j + jy) / n) * 2 - 1;
      const p = norm3([F.n[0] + pa * F.u[0] + pb * F.v[0], F.n[1] + pa * F.u[1] + pb * F.v[1], F.n[2] + pa * F.u[2] + pb * F.v[2]]);
      // (low ground only: a pond lies in a hollow or on a valley's floor, not on a hilltop's flat. The hills' own height
      //  (surface.js _forest: hill * 24 + mid * 4.5) is asked straight of the noise, before the costly sample.)
      if (forestRelief(S, p[0], p[1], p[2]) > o.pondRelief) continue;
      if (D.at(p[0], p[1], p[2], dro).fill > 0.3) { rj.basin++; continue; }
      S.biomeWeights(p[0], p[1], p[2], bw);
      let top = -1, tw = 0, forest = 0;
      for (let k = 0; k < S.nB; k++) { if (bw[k] > tw) { tw = bw[k]; top = k; } if (S.biomes[k].terrain === 'forest') forest += bw[k]; }
      if (forest < 0.98 || top < 0) continue;
      if (hr > chanceOf(S.biomes[top])) continue;
      // (and not on a landing's levelled place or within pondKeep of a landing's or an easel's clearing: a first view keeps
      //  its ground)
      let onPad = false;
      for (const pd of pads) { const d = Math.hypot(p[0] - pd.x, p[1] - pd.y, p[2] - pd.z) * R; if (d < pd.r * 1.7 + o.pondKeep) onPad = true; }
      for (const cl of S.clearings || []) { const d = Math.hypot(p[0] - cl.x, p[1] - cl.y, p[2] - cl.z) * R; if (d < cl.r + o.pondKeep) onPad = true; }
      if (onPad) { rj.pad++; continue; }
      tried++;
      const p1 = norm3([F.n[0] + (ca + 1 / n) * F.u[0] + cb * F.v[0], F.n[1] + (ca + 1 / n) * F.u[1] + cb * F.v[1], F.n[2] + (ca + 1 / n) * F.u[2] + cb * F.v[2]]);
      const p0 = norm3([F.n[0] + ca * F.u[0] + cb * F.v[0], F.n[1] + ca * F.u[1] + cb * F.v[1], F.n[2] + ca * F.u[2] + cb * F.v[2]]);
      const cellM = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]) * R * 2;   // (two half steps: one cell)
      // the pond: its axes and size (it must stay inside its own cell: the jitter keeps it 0.3 of a cell from each edge)
      const rMax = Math.min(o.pondR[1], cellM * 0.24);
      const a = o.pondR[0] + (rMax - o.pondR[0]) * hash3(i, j, f, seed + 3);
      if (a < o.pondR[0]) continue;
      const bAx = a * (0.55 + 0.4 * hash3(i, j, f, seed + 4));
      const th = Math.PI * hash3(i, j, f, seed + 5);
      // the place: open, level, dry, away from running water and from a basin's lake
      // (the distance to running water is the sample's own c.s, left in the surface's scratch: no full sample is needed)
      S.sample(p[0], p[1], p[2], smp, o.pondGlade > 0);
      if ((o.pondGlade > 0 && smp.glade < o.pondGlade) || S._ctx.s < o.pondChannel) { rj.chan++; continue; }
      if (smp.lq !== NOLQ && smp.lq > smp.h - 0.4) { rj.wet++; continue; }
      const [u, v] = axes(p);
      const ct = Math.cos(th), sn = Math.sin(th);
      const e1 = [u[0] * ct + v[0] * sn, u[1] * ct + v[1] * sn, u[2] * ct + v[2] * sn], e2 = cross(p, e1);
      // the rim: eight points round the outline a little outside it; the level is just under the lowest of them
      let lo = Infinity, hi = -Infinity;
      for (let r = 0; r < 8; r++) {
        const ang = r * D2, ra = 1.08 * a * Math.cos(ang), rb = 1.08 * bAx * Math.sin(ang);
        const q = norm3([p[0] + (e1[0] * ra + e2[0] * rb) / R, p[1] + (e1[1] * ra + e2[1] * rb) / R, p[2] + (e1[2] * ra + e2[2] * rb) / R]);
        S.sample(q[0], q[1], q[2], smp, false);
        if (smp.lq !== NOLQ && smp.lq > smp.h - 0.3) { lo = -Infinity; break; }
        lo = Math.min(lo, smp.h); hi = Math.max(hi, smp.h);
      }
      if (!(lo > -Infinity)) { rj.rimwet++; continue; }
      if (hi - lo > o.pondSpread) { rj.rim++; continue; }
      const dep = o.pondDepth[0] + (o.pondDepth[1] - o.pondDepth[0]) * hash3(i, j, f, seed + 6);
      cellOf[f * n * n + j * n + i] = P.length / 14;
      P.push(p[0], p[1], p[2], e1[0], e1[1], e1[2], e2[0], e2[1], e2[2], a, bAx, lo - 0.22, dep, hash3(i, j, f, seed + 7) * 100);
    }
    this.pondCellOf = cellOf; this.pondData = Float64Array.from(P); this.nPonds = P.length / 14; this.pondTried = tried;
    this.ponds = this.nPonds > 0;
    this.ms.ponds = now() - t0;
  }

  _faces() { return this._F || (this._F = FACES_LOCAL); }

  // which cell of the 120 m grid (gnomonic, a face at a time) a direction lies in: the ponds' cells and the cuts' marks
  _cell(x, y, z) {
    const n = this.cn, FACES = this._faces();
    const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
    let f;
    if (ax >= ay && ax >= az) f = x > 0 ? 0 : 1; else if (ay >= az) f = y > 0 ? 2 : 3; else f = z > 0 ? 4 : 5;
    const F = FACES[f];
    const dd = x * F.n[0] + y * F.n[1] + z * F.n[2];
    const a = (x * F.u[0] + y * F.u[1] + z * F.u[2]) / dd, bb = (x * F.v[0] + y * F.v[1] + z * F.v[2]) / dd;
    let i = Math.floor((a + 1) * 0.5 * n), j = Math.floor((bb + 1) * 0.5 * n);
    if (i < 0) i = 0; else if (i >= n) i = n - 1;
    if (j < 0) j = 0; else if (j >= n) j = n - 1;
    return f * n * n + j * n + i;
  }

  // every cell within reach of a cut, marked once at load: a sample anywhere else asks nothing of the cuts
  _markCuts() {
    const R = this.R, n = this.cn, mark = new Uint8Array(6 * n * n);
    const cellM = (Math.PI * 0.5 * R) / n;
    for (const C of this.cors) {
      const reach = (C.HW ? Math.max(...C.HW) : C.hw) + this.o.bankMax + 4;
      const step = Math.min(cellM * 0.4, 30), rr = reach + 8;
      for (let k = 0; k < C.n; k++) {
        const p = [C.st[k * 3], C.st[k * 3 + 1], C.st[k * 3 + 2]], [u, v] = axes(p);
        for (let a = -rr; a <= rr + 1e-6; a += step) for (let b = -rr; b <= rr + 1e-6; b += step) {
          if (a * a + b * b > rr * rr * 1.2) continue;
          const q = norm3([p[0] + (u[0] * a + v[0] * b) / R, p[1] + (u[1] * a + v[1] * b) / R, p[2] + (u[2] * a + v[2] * b) / R]);
          mark[this._cell(q[0], q[1], q[2])] = 1;
        }
      }
    }
    this.cutMark = mark;
  }

  _pond(S, c, b, cell) {
    const x = c.x, y = c.y, z = c.z;
    const id = this.pondCellOf[cell];
    if (id < 0) return;
    const P = this.pondData, o = id * 14, R = this.R;
    const dx = x - P[o], dy = y - P[o + 1], dz = z - P[o + 2];
    const u = (dx * P[o + 3] + dy * P[o + 4] + dz * P[o + 5]) * R, v = (dx * P[o + 6] + dy * P[o + 7] + dz * P[o + 8]) * R;
    let rho = Math.sqrt((u / P[o + 9]) * (u / P[o + 9]) + (v / P[o + 10]) * (v / P[o + 10]));
    if (rho > 1.6) return;
    // (the outline bent by a noise a few metres across, so no pond is a drawn ellipse)
    const fq = R / 7.5, sd = P[o + 13];
    rho *= 1 + 0.13 * S.nC.n3(x * fq + sd, y * fq - sd * 0.7, z * fq + 3.1);
    if (rho > 1.45) return;
    const lv = this._lv;
    b.h = pondAt(rho, b.h, P[o + 11], P[o + 12], lv);
    if (lv[0] === lv[0]) { b.lq = lv[0]; c.still = 1; c.turbW = 0; c.fspdW = 0; c.swell = Math.max(c.swell, 0.3); }
  }

  // ---- puddles ------------------------------------------------------------------------------------------------------------
  _puddleSetup() {
    const S = this.S, look = S.look && S.look.oil ? S.look.oil.puddles : null;
    let any = look != null && look > 0;
    for (const bi of S.biomes) if (bi.oil && bi.oil.puddles > 0) any = true;
    // (one number a world: the hook has no biome in hand, so the world's own, else the largest of its woods')
    let k = look != null ? look : 0;
    if (look == null) for (const bi of S.biomes) if (bi.terrain === 'forest' && bi.oil && bi.oil.puddles > k) k = bi.oil.puddles;
    this.puddleK = k;
    this.puddles = any && k > 0;
  }

  _puddle(S, c, b, H) {
    if (b.lq > b.h - 0.3) return;                         // water already stands here
    const o = this.o, bank = smoothstep(o.capBank[0], o.capBank[1], H.s);   // (H.s: metres from the water's edge)
    if (!(bank > 0)) return;
    const fl = 1 - H.rise, deep = o.capFloor * fl * fl;   // a river's flat floor: a deeper hollow asked for
    if (-H.sm - H.mi * 0.6 - 0.13 - deep <= 0) return;    // (no hollow: the slope is not even asked)
    // the slope of the land the hollow lies in: the hills (1,900 m, 350 m, 98 m terms), by differences 4 m apart
    const R = this.R, x = c.x, y = c.y, z = c.z, e = 4 / R, nA = S.nA.n3;
    const [u, v] = axes([x, y, z]);
    const f0 = R / 1900;
    const big = (px, py, pz) => 12 * nA(px * f0 + 3.1, py * f0 - 1.7, pz * f0 + 8.2);
    const r0 = big(x, y, z) + H.hill * H.rise;                         // (H.hill is forestRelief at this very point)
    const ux = x + u[0] * e, uy = y + u[1] * e, uz = z + u[2] * e, vx = x + v[0] * e, vy = y + v[1] * e, vz = z + v[2] * e;
    const ru = big(ux, uy, uz) + forestRelief(S, ux, uy, uz) * H.rise, rv = big(vx, vy, vz) + forestRelief(S, vx, vy, vz) * H.rise;
    const slope = Math.hypot(ru - r0, rv - r0) / 4;
    // (the max rule shared with the rivers' runnels, which set c.cap in _base before this: never take a runnel's away)
    c.cap = Math.max(c.cap, puddleCap(H.sm, H.mi, slope, o, this.puddleK * bank, deep));
  }
}

function now() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Number(process.hrtime.bigint()) / 1e6; }

// ---- the hook --------------------------------------------------------------------------------------------------------
export function attachHydro(S, drain, rivers, opts) {
  if (!S || !drain || !MODE.oil) return S ? S.hydro : null;
  if (S.hydro) return S.hydro;
  const W = MODE.water || {};
  // WHICH WORLDS. A part is built on a world only where that world's look asks for it: lakes where it gives oil.lakeK, fjords
  // where it gives oil.fjords, ponds and puddles where a look or a biome gives oil.ponds / oil.puddles (their chance and share,
  // read in their builders), the falls wherever the rivers reach a sea cliff (world/rivers.js draws its tree on Earth only).
  // So the switches can be on by default in the oil look and change Earth alone (the coordinator, 24 Nov: Earth first).
  const lookO = (S.look && S.look.oil) || {};
  const want = { lakes: !!W.lakes && lookO.lakeK != null, ponds: !!W.ponds, puddles: !!W.puddles, falls: !!W.falls, fjord: !!W.fjord && !!lookO.fjords };
  // (tarns: with the mountains' streams, ?mount=1, which attached S.mount before this; their large-scale height is the water
  //  lead's alpineMacro, world/mountain.js, read only)
  want.tarns = want.lakes && !!W.mount && !!S.mount;
  if (!want.lakes && !want.ponds && !want.puddles && !want.falls && !want.fjord) return null;
  const hy = new Hydro(S, drain, rivers || S.rivers || null, want, opts);
  hy._macro = alpineMacro;
  hy.build();
  // nothing of it does anything: leave the surface as it was
  if (!hy.lakes && !hy.ponds && !hy.puddles && !hy.nCor && !hy.nTarns) { S.hydroInfo = hy; return null; }
  S.hydro = hy;
  return hy;
}

// The whole hook with the design's names, for a reader looking for them.
export const hydroForest = (S, c, b, H) => S.hydro && S.hydro.forest(S, c, b, H);
export const hydroCoast = (S, c, hh, T) => (S.hydro ? S.hydro.coast(S, c, hh, T) : (c.lqC = NaN, hh));
