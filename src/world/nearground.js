// Painted Cosmos: the near ground, the sward. OWNER: PAINTER.
// Three rings of instanced brush marks round the eye, one draw call each, laid the way a
// painter lays a meadow: close by, tufts of single flicks with flowers on their stalks, fallen
// leaves and twigs under the trees, stones and moss by the water; farther off, fan-brush
// touches (a clump of grass in one mark, a frond of fern, a drift of flowers as a dash of
// colour, a stone); farthest, a few broad soft touches that only break the wash. "Far things
// are fewer, larger, softer strokes; near things get a few crisp accents." On worlds without
// grass the same rings lay splinters, stones and drift ripples.
//
// Marks are anchored to the planet: each ring divides the ground into cells of a cube-sphere
// grid, each cell owns one clump whose places, shapes and washes are a pure function of the
// cell. Cells come and go at the edge of the ring's range, where a mark's size is already
// nothing, so nothing pops; a clump laid inside the range grows in.
import * as THREE from 'three';
import { faceToDir, dirToFace } from './cubesphere.js';
import { hash3i } from './noise.js';
import { getSurface, makeSample, NOLQ } from './surface.js';
import { makeNearMaterial } from '../render/materials.js';
import { QUALITY } from '../render/shared.js';
import { getLook } from '../data/looks.js';

// cell (m); range (m) at quality 0, 1, 2 (0: the ring is not laid); marks per cell; the ring
// fades in between `inner` distances (so a broad touch is never held up to the eye); how soft
// its marks are left; how far above the ground the eye may be; cells moved before re-listing.
const RINGS = [
  // (the single strokes run on to 23 m at the top tier and the fan touches begin at 6 m: the two
  // hands overlap over a long band instead of changing over at 17 m)
  { name: 'fine', cell: 0.6, range: [11, 12, 23], per: 12, inner: [0.8, 2.6], soft: 0, alt: 45, step: 2 },
  { name: 'mid', cell: 1.9, range: [0, 40, 66], per: 7, inner: [6, 13], soft: 0.6, alt: 90, step: 1 },
  { name: 'far', cell: 6.5, range: [0, 0, 240], per: 5, inner: [38, 66], soft: 0.8, alt: 200, step: 1 },
];
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const dens = (c, d) => Math.max(0, Math.min(1, c - (c - c * c) * (d - 1)));   // the pigment density model
// smooth value noise on the cell grid (drifts of flowers, where the grass stands tall)
function vnoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  return lerp(lerp(hash3i(xi, yi, 91, seed), hash3i(xi + 1, yi, 91, seed), sx), lerp(hash3i(xi, yi + 1, 91, seed), hash3i(xi + 1, yi + 1, 91, seed), sx), sy);
}
// stroke kinds as the shader reads them (iPar.y): under 1.5 a plain tapering stroke (the number
// is its width at half length), 2 a grass flick, 3 a flick left crisp, 4 a fan-brush touch,
// 5 a round touch facing the eye, 6 a touch laid flat on the ground; +0.25: left crisp.
const FLICK = 2, FAN = 4, DAB = 5, LYING = 6, CRISP = 0.25;
const SEED_HEAD = [0.88, 0.76, 0.46], LITTER = [[0.80, 0.62, 0.34], [0.66, 0.42, 0.26], [0.46, 0.30, 0.24]], TWIG = [0.36, 0.27, 0.25];

// What grows or lies near the eye in a biome: shares of each kind in a full clump (0..1).
// A biome may say so itself (looks.js, `near: { blade, reed, needle, dab, ripple, flower, fern, litter }`
// as counts out of 8, the measure the first near layer was written in).
function styleOf(look, b) {
  const sm = b.small || {}, forest = b.terrain === 'forest';
  const under = Object.assign({}, look.flora && look.flora.under, b.under);
  const st = { blade: 0, reed: 0, needle: 0, dab: 0, ripple: 0, flower: 0, fern: 0, litter: 0, crust: 0, gm: 0.60, flowerSize: 1,
    crustC: under.crust || null, stalk: under.stalk || null,
    leaf: under.leaf || null, rock: under.rock || null, shard: under.shard || null, bush: under.bush || null,
    flowers: under.flowers || (under.accent ? [under.accent] : null), litterC: under.litter || (forest ? LITTER : null) };
  const grass = (sm.grass == null ? (forest ? 0.4 : 0) : sm.grass) + (sm.fern || 0) * 0.6;
  st.blade = Math.round(8 * Math.min(1, grass * 2.0));
  st.reed = Math.round(3 * Math.min(1, (sm.reed || 0) * 2));
  st.needle = Math.round(6 * Math.min(1, (sm.shard || 0) * 7));
  if (b.terrain === 'dunes') st.ripple = 5;
  st.dab = Math.max(st.blade >= 6 ? 0 : 2, Math.round(6 * Math.min(1, (sm.rock || 0) * 9)));
  st.flower = 8 * Math.min(1, (sm.flower == null ? (forest ? 0.07 : 0) : sm.flower) * 7);
  st.fern = 8 * Math.min(1, (sm.fern == null ? (forest ? 0.12 : 0) : sm.fern) * 5);
  st.litter = st.litterC ? (forest ? 8 : (b.tall ? 4 : 0)) : 0;
  // (`crust`: what lies flat on bare ground in patches: lichen, sulphur crust, frost flowers, plates of ice or glass;
  // `gm`: how far a blade's wash is pulled to the ground's; `flowerSize`: fungi are flowers with broad heads)
  st.crust = st.crustC ? 4 : 0;
  if (b.near) Object.assign(st, b.near);
  if (!st.crustC) st.crust = 0;
  let left = 8;
  for (const k of ['blade', 'reed', 'needle', 'ripple', 'dab']) { st[k] = Math.max(0, Math.min(left, st[k])); left -= st[k]; }
  for (const k of ['blade', 'reed', 'needle', 'ripple', 'dab', 'flower', 'fern', 'litter', 'crust']) st[k] /= 8;
  return st;
}

class Ring {
  constructor(cfg, S, styles, root, bu, bodyId) {
    this.cfg = cfg; this.S = S; this.styles = styles;
    this.n = Math.max(8, Math.round((Math.PI * 0.5 * S.R) / cfg.cell));
    this.cellM = (Math.PI * 0.5 * S.R) / this.n;
    const rMax = Math.max(...cfg.range);
    const N = this.N = Math.ceil((Math.PI * (rMax + cfg.cell + 1) * (rMax + cfg.cell + 1)) / (cfg.cell * cfg.cell * 0.8) * cfg.per * 0.75);
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, -1, 0.5, 0, 1, 0.5, 0, 0, 1, 0], 3));
    g.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]);
    const attr = (name, size) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(N * size), size); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(name, a); return a; };
    this.aRoot = attr('iRoot', 3); this.aAxis = attr('iAxis', 4); this.aPar = attr('iPar', 4); this.aCol = attr('iCol', 4); this.aExt = attr('iExt', 2);
    this.attrs = [this.aRoot, this.aAxis, this.aPar, this.aCol, this.aExt];
    g.instanceCount = 0;
    this.material = makeNearMaterial(bu);
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.name = 'near-' + cfg.name + '-' + bodyId; this.mesh.frustumCulled = false; this.mesh.visible = false;
    root.add(this.mesh);
    this.origin = new THREE.Vector3(); this.hasOrigin = false;
    this.map = new Map();            // cell key -> the slots of its clump (null: nothing there)
    this.free = []; for (let i = N - 1; i >= 0; i--) this.free.push(i);
    this.high = 0; this.lo = N; this.hi = -1; this.all = true;
    this.pending = []; this.li = 1e9; this.lj = 1e9; this.lf = -1; this.now = 0; this.filled = false; this.range = 0;
    this.s = makeSample(S.nB); this.d = [0, 0, 0]; this.fo = { face: 0, u: 0, v: 0 };
  }

  get busy() { return this.mesh.visible ? this.pending.length : 0; }
  get triangles() { return this.mesh.visible ? this.high * 3 : 0; }

  clear() {
    this.map.clear(); this.free.length = 0; for (let i = this.N - 1; i >= 0; i--) this.free.push(i);
    this.pending.length = 0; this.lf = -1; this.filled = false; this.high = 0;
    this.aAxis.array.fill(0); this.all = true;
  }
  hide() { if (this.mesh.visible) { this.mesh.visible = false; this.clear(); } }

  update(camLocal, alt, sliceMs, dt, pixel) {
    const cfg = this.cfg, RANGE = cfg.range[QUALITY.level] || 0;
    if (!(RANGE > 0) || alt > cfg.alt) { this.hide(); return 0; }
    if (RANGE !== this.range) { this.range = RANGE; if (this.mesh.visible) this.clear(); }
    this.mesh.visible = true;
    this.now += Math.max(dt || 0, 1 / 60);
    const R = this.S.R, n = this.n, CELL = cfg.cell;
    if (!this.hasOrigin || this.origin.distanceToSquared(camLocal) > 300 * 300) {
      this.origin.copy(camLocal); this.hasOrigin = true; this.clear();
      this.material.uniforms.uOrigin.value.copy(this.origin);
      this.mesh.position.copy(this.origin); this.mesh.updateMatrixWorld(true);
    }
    const u = this.material.uniforms;
    u.uCamLocal.value.copy(camLocal).sub(this.origin);
    u.uNear.value.set(RANGE * 0.66, RANGE, this.now, pixel || 0.002);
    u.uNear2.value.set(cfg.inner[0], cfg.inner[1], cfg.soft, 0);
    // the cell under the eye; when it has moved on, see which cells have come into range or left it
    const il = 1 / camLocal.length(), cx = camLocal.x * il, cy = camLocal.y * il, cz = camLocal.z * il;
    const fo = dirToFace(cx, cy, cz, this.fo), d = this.d;
    const i0 = Math.floor((fo.u * 0.5 + 0.5) * n), j0 = Math.floor((fo.v * 0.5 + 0.5) * n);
    if (fo.face !== this.lf || Math.max(Math.abs(i0 - this.li), Math.abs(j0 - this.lj)) >= cfg.step) {
      this.lf = fo.face; this.li = i0; this.lj = j0;
      const f0 = fo.face, pad = cfg.step * CELL, reach = (RANGE + 0.4 + pad) / R, K = Math.ceil((RANGE + 1 + pad) / (CELL * 0.62));
      const want = new Set();
      this.pending.length = 0;
      for (let b = -K; b <= K; b++) {
        for (let a = -K; a <= K; a++) {
          let f = f0, i = i0 + a, j = j0 + b;
          faceToDir(f0, ((i + 0.5) / n) * 2 - 1, ((j + 0.5) / n) * 2 - 1, d);
          const dist = Math.hypot(d[0] - cx, d[1] - cy, d[2] - cz);
          if (dist > reach) continue;
          if (i < 0 || j < 0 || i >= n || j >= n) {       // over the edge of the cube face: the cell belongs to the neighbour
            const o = dirToFace(d[0], d[1], d[2], this.fo);
            f = o.face; i = Math.min(n - 1, Math.max(0, Math.floor((o.u * 0.5 + 0.5) * n))); j = Math.min(n - 1, Math.max(0, Math.floor((o.v * 0.5 + 0.5) * n)));
          }
          const key = (f * n + i) * n + j;
          if (want.has(key)) continue;
          want.add(key);
          if (!this.map.has(key)) this.pending.push([dist, f, i, j, key]);
        }
      }
      // cells that have left: their marks had already shrunk to nothing
      const gone = (RANGE + 2.2 + pad + CELL) / R;
      for (const [key, slot] of this.map) {
        if (want.has(key)) continue;
        const j = key % n, i = ((key - j) / n) % n, f = Math.floor(key / (n * n));
        faceToDir(f, ((i + 0.5) / n) * 2 - 1, ((j + 0.5) / n) * 2 - 1, d);
        if (Math.hypot(d[0] - cx, d[1] - cy, d[2] - cz) < gone) continue;
        this.map.delete(key);
        if (slot) { for (const o of slot) { this.free.push(o); this.aAxis.array[o * 4 + 3] = 0; this.touch(o); } }
      }
      this.pending.sort((p, q) => q[0] - p[0]);          // nearest last: popped first
    }
    // lay the clumps that are due, nearest first, inside the time allowed
    let spent = 0;
    if (this.pending.length) {
      const t0 = performance.now(), grown = this.filled ? this.now : -10;
      let guard = 0;
      while (this.pending.length && (guard++ < 3 || (guard & 3) || performance.now() - t0 < sliceMs)) {
        const p = this.pending.pop();
        this.lay(p[1], p[2], p[3], p[4], p[0] * R > RANGE * 0.9 ? -10 : grown);
      }
      if (!this.pending.length) this.filled = true;
      spent = performance.now() - t0;
    }
    if (this.all || this.hi >= this.lo) {
      this.mesh.geometry.instanceCount = this.high;
      for (const a of this.attrs) {
        a.clearUpdateRanges();
        if (!this.all) a.addUpdateRange(this.lo * a.itemSize, (this.hi - this.lo + 1) * a.itemSize);
        a.needsUpdate = true;
      }
      this.all = false; this.lo = this.N; this.hi = -1;
    }
    return spent;
  }
  touch(o) { if (o < this.lo) this.lo = o; if (o > this.hi) this.hi = o; }

  // Where a cell's clump stands and what its ground is: false when nothing can stand there.
  site(f, i, j, key) {
    const S = this.S, n = this.n, s = this.s, d = this.d, R = S.R, seed = this.seed = (f * 7919 + 13) | 0;
    const r1 = hash3i(i, j, 1, seed), r2 = hash3i(i, j, 2, seed);
    faceToDir(f, ((i + 0.15 + 0.7 * r1) / n) * 2 - 1, ((j + 0.15 + 0.7 * r2) / n) * 2 - 1, d);
    const x = this.x = d[0], y = this.y = d[1], z = this.z = d[2];
    S.sample(x, y, z, s, true);
    const h = s.h;
    if ((s.lq !== NOLQ && s.lq > h - 0.04) || !this.free.length) { this.map.set(key, null); return false; }
    // the ground's own plane here (two more heights): marks stand on the slope, not on the sphere
    let ux, uy, uz;
    if (Math.abs(y) < 0.9) { ux = -z; uy = 0; uz = x; } else { ux = 0; uy = z; uz = -y; }
    let l = 1 / Math.hypot(ux, uy, uz); ux *= l; uy *= l; uz *= l;
    const vx = y * uz - z * uy, vy = z * ux - x * uz, vz = x * uy - y * ux;
    const e = Math.max(0.45, this.cfg.cell * 0.4);
    const gu = (S.heightAt(x + ux * e / R, y + uy * e / R, z + uz * e / R) - h) / e, gv = (S.heightAt(x + vx * e / R, y + vy * e / R, z + vz * e / R) - h) / e;
    const steep = this.steep = Math.hypot(gu, gv);
    if (steep > 1.3) { this.map.set(key, null); return false; }
    let nx = x - ux * gu - vx * gv, ny = y - uy * gu - vy * gv, nz = z - uz * gu - vz * gv;
    l = 1 / Math.hypot(nx, ny, nz);
    this.nx = nx * l; this.ny = ny * l; this.nz = nz * l;
    this.ux = ux; this.uy = uy; this.uz = uz; this.vx = vx; this.vy = vy; this.vz = vz; this.gu = gu; this.gv = gv;
    this.px = x * (R + h) - this.origin.x; this.py = y * (R + h) - this.origin.y; this.pz = z * (R + h) - this.origin.z;
    // which biome's ground this is (borders intermix clump by clump)
    let bi = s.top, acc = 0; const pick = this.pick = hash3i(i, j, 3, seed);
    for (let q = 0; q < S.nB; q++) { acc += s.w[q]; if (pick < acc) { bi = q; break; } }
    this.st = this.styles[bi];
    // (a biome without undergrowth of its own, the forests, grows grass wherever the canopy lets it)
    const und = S.biomes[bi].small ? (s.under || 0) : 1;
    this.canopy = Math.min(1, s.canopy || 0);
    this.meadow = Math.min(1, 0.3 + 0.7 * und) * (1 - 0.4 * this.canopy) * (1 - Math.min(1, s.rock || 0) * 0.7) * (steep > 0.8 ? 0.4 : 1);
    this.shore = s.lq !== NOLQ ? 1 - sstep(0.06, 0.75, h - s.lq) : 0;
    // drifts and patches, in metres along the cube face (so the three rings agree where they are)
    const U = (i + 0.5) * this.cellM, V = (j + 0.5) * this.cellM;
    this.rough = vnoise(U / 7.3, V / 7.3, seed + 5);
    this.drift = vnoise(U / 9.7 + 31.7, V / 9.7 + 3.3, seed + 9);
    this.which = vnoise(U / 27 + 7.1, V / 27 + 1.9, seed + 11);
    // stones lie in drifts with bare ground between, crust in patches of its own (and one more, larger, slower field: which crust)
    this.stony = 2.1 * sstep(0.44, 0.76, vnoise(U / 5.9 + 13.1, V / 5.9 + 7.7, seed + 15) * 0.75 + 0.25 * this.rough);
    this.needly = 1.9 * sstep(0.42, 0.72, vnoise(U / 6.7 + 23.1, V / 6.7 + 1.7, seed + 19));       // splinters stand in companies
    this.crusty = sstep(0.40, 0.66, vnoise(U / 4.3 + 3.9, V / 4.3 + 17.3, seed + 17) * 0.7 + 0.3 * this.drift);
    this.slots = []; this.map.set(key, this.slots);
    return true;
  }

  // one mark: (ou, ov) where in the clump on the ground's plane, lift above it; the way it grows
  // (0: the ground's normal leaned by `tilt` toward `la`; 1: the normal itself), its measure and wash
  put(ou, ov, lift, tilt, la, len, wid, kind, hz, born, cr, cg, cb, curl, flex) {
    if (!this.free.length) return -1;
    const o = this.free.pop(); this.slots.push(o); if (o >= this.high) this.high = o + 1; this.touch(o);
    const { ux, uy, uz, vx, vy, vz, nx, ny, nz, x, y, z } = this;
    const dh = ou * this.gu + ov * this.gv - 0.02 + lift;
    const Ro = this.aRoot.array, A = this.aAxis.array, P = this.aPar.array, C = this.aCol.array, E = this.aExt.array;
    Ro[o * 3] = this.px + ux * ou + vx * ov + x * dh; Ro[o * 3 + 1] = this.py + uy * ou + vy * ov + y * dh; Ro[o * 3 + 2] = this.pz + uz * ou + vz * ov + z * dh;
    const ca = Math.cos(la) * tilt, sa = Math.sin(la) * tilt;
    const ax = nx + ux * ca + vx * sa, ay = ny + uy * ca + vy * sa, az = nz + uz * ca + vz * sa, l = 1 / Math.hypot(ax, ay, az);
    A[o * 4] = ax * l; A[o * 4 + 1] = ay * l; A[o * 4 + 2] = az * l; A[o * 4 + 3] = len;
    P[o * 4] = wid; P[o * 4 + 1] = kind; P[o * 4 + 2] = hz; P[o * 4 + 3] = born;
    C[o * 4] = cr; C[o * 4 + 1] = cg; C[o * 4 + 2] = cb; C[o * 4 + 3] = curl;
    E[o * 2] = this.canopy; E[o * 2 + 1] = flex;
    return o;
  }

  lay(f, i, j, key, born) {
    if (!this.site(f, i, j, key)) return;
    if (this.cfg.name === 'fine') this.layFine(i, j, born); else this.layBroad(i, j, born);
  }

  // ---- close by: single flicks in tufts, flowers on stalks, fallen leaves, twigs, stones, moss ----
  layFine(i, j, born) {
    const st = this.st, s = this.s, seed = this.seed, per = this.cfg.per, lowQ = QUALITY.level === 0;
    const gr = s.r, gg = s.g, gb = s.b, canopy = this.canopy, shore = this.shore;
    const H = (k) => hash3i(i, j, k, seed);
    const tall = sstep(0.52, 0.74, this.rough);
    let left = lowQ ? per >> 1 : per;
    // by the water: stones, moss, a few dark sedges
    if (shore > 0.25 && st.rock) {
      const ns = Math.min(left, H(60) < shore ? 2 : 1);
      for (let k = 0; k < ns; k++) {
        const q1 = H(61 + k), q2 = H(64 + k), q3 = H(67 + k), c = st.rock[q3 < 0.45 ? 0 : 1];
        const w = 0.05 + 0.13 * q2 * q2;
        this.put((q1 - 0.5) * 0.5, (q3 - 0.5) * 0.5, 0, 0, 0, w * (0.9 + 0.6 * q1), w, DAB, q2, born, lerp(c[0], gr, 0.25), lerp(c[1], gg, 0.25), lerp(c[2], gb, 0.25), 0, 0);
      }
      left -= ns;
      if (st.leaf && left > 0) {       // moss: a dark, saturated touch lying on the bank
        const q1 = H(70), q2 = H(71), c = st.leaf[2];
        this.put((q1 - 0.5) * 0.4, (q2 - 0.5) * 0.4, 0.02, 0, 0, 0.05 + 0.20 * q1 * q1, 0.04 + 0.11 * q2 * q2, LYING, q1, born, dens(lerp(c[0], gr, 0.45), 1.2), dens(lerp(c[1], gg, 0.45), 1.1), dens(lerp(c[2], gb, 0.45), 1.2), q2 * 6.28, 0);
        left--;
      }
    }
    // under the trees: fallen leaves, now and then a twig
    if (st.litter > 0 && canopy > 0.18 && left > 0) {
      const nl = Math.min(left, Math.round(5 * st.litter * Math.min(1, canopy * 1.25) * (0.5 + H(72))));
      for (let k = 0; k < nl; k++) {
        const q1 = H(73 + k), q2 = H(79 + k), q3 = H(85 + k), q4 = H(91 + k);
        if (k === 0 && q4 < 0.14) {     // a twig
          this.put((q1 - 0.5) * 0.6, (q2 - 0.5) * 0.6, 0.015, 0, 0, 0.10 + 0.16 * q3, 0.010 + 0.006 * q4, LYING, q3, born, lerp(TWIG[0], gr, 0.5), lerp(TWIG[1], gg, 0.5), lerp(TWIG[2], gb, 0.5), q1 * 6.28, 0);
        } else {
          const c = st.litterC[q4 < 0.4 ? 0 : q4 < 0.78 ? 1 : 2], m = 0.30 + 0.25 * q2;
          this.put((q1 - 0.5) * 0.62, (q3 - 0.5) * 0.62, 0.012, 0, 0, 0.045 + 0.06 * q2, 0.028 + 0.035 * q3, LYING + (q4 > 0.78 ? CRISP : 0), q2, born, lerp(c[0], gr, m), lerp(c[1], gg, m), lerp(c[2], gb, m), q1 * 6.28, 0);
        }
      }
      left -= nl;
    }
    // flowers in drifts: a stalk and a head; a drift is of one kind
    const fl = st.flower > 0 && st.flowers ? st.flower * sstep(0.50, 0.70, this.drift) * this.meadow * (1 - 0.6 * canopy) : 0;
    if (fl > 0.02 && left > 1) {
      const nf = Math.min(left >> 1, H(100) < fl * 1.3 ? (H(101) < fl * 0.6 ? 3 : 2) : (H(101) < fl * 2 ? 1 : 0));
      const fc = st.flowers[Math.min(st.flowers.length - 1, Math.floor(this.which * st.flowers.length * 0.999))];
      for (let k = 0; k < nf; k++) {
        const q1 = H(102 + k), q2 = H(106 + k), q3 = H(110 + k), q4 = H(114 + k);
        const ou = (q1 - 0.5) * 0.56, ov = (q2 - 0.5) * 0.56, L = (0.16 + 0.26 * q3) * (1 + 0.5 * tall), la = q4 * 6.2832, tilt = 0.05 + 0.22 * q1;
        const lc = st.stalk || (st.leaf ? st.leaf[1] : [gr, gg, gb]), fs = st.flowerSize;
        this.put(ou, ov, 0, tilt, la, L, fs > 1.3 ? 0.030 : 0.012, FLICK, q3, born, lerp(lc[0], gr, fs > 1.3 ? 0.25 : 0.5), lerp(lc[1], gg, fs > 1.3 ? 0.25 : 0.5), lerp(lc[2], gb, fs > 1.3 ? 0.25 : 0.5), 0, 1);
        const hr = (0.020 + 0.045 * q2 * q2) * fs;
        this.put(ou, ov, 0, tilt, la, hr * (fs > 1.3 ? 0.8 : 1.5), hr, DAB + CRISP, q2, born, fc[0], fc[1], fc[2], L * 0.96, 1);
      }
      left -= nf * 2;
    }
    // what lies on bare ground: pebbles, drift ripples; what stands on it: reeds, splinters
    const others = [];
    const cnt = (share, k) => { const v = share * 8 * (per / 12); const nI = Math.floor(v); return nI + (H(k) < v - nI ? 1 : 0); };
    for (let q = cnt(st.reed, 120); q > 0; q--) others.push(1);
    for (let q = cnt(st.needle * 1.6 * this.needly, 121); q > 0; q--) others.push(2);
    for (let q = cnt(st.ripple * 1.3, 122); q > 0; q--) others.push(4);
    for (let q = cnt(st.dab * 1.2 * this.stony, 123) + (st.blade > 0 && this.meadow < 0.55 ? 1 : 0); q > 0; q--) others.push(3);
    for (let q = cnt(st.crust * 2.2 * this.crusty, 124); q > 0; q--) others.push(5);
    // Grass grows in tufts, not in rows: a cell has one tuft, or two, or (one in six) none; a
    // tuft is a handful of flicks from nearly one root, fanned, one or two of them long. Tufts
    // differ in size, so the sward is uneven in spacing and in height; where the grass is left
    // to itself (`rough`) it stands tall and goes to seed.
    const t1 = H(4), t2 = H(5), t3 = H(6), t4 = H(7);
    const nTuft = t1 < 0.16 ? 0 : t1 < 0.70 ? 1 : 2;
    const tu = [(t2 - 0.5) * 0.5, (t4 - 0.5) * 0.5], tv = [(t3 - 0.5) * 0.5, (t2 * 7.13 % 1 - 0.5) * 0.5], tsz = [(0.55 + 1.0 * t3 * t3) * (1 + 0.45 * tall), (0.5 + 0.9 * t4) * (1 + 0.3 * tall)];
    const nBlade = nTuft === 0 ? 0 : Math.min(Math.max(0, left - Math.min(others.length, 3)), Math.round(st.blade * (per - 1) * this.meadow * (0.7 + 0.5 * this.rough)));
    for (let k = 0; k < nBlade; k++) {
      const q1 = H(10 + k), q2 = H(24 + k), q3 = H(38 + k), q4 = H(52 + k), q5 = H(140 + k);
      const tf = nTuft === 2 ? (k & 1) : 0;
      const ang = q1 * 6.2832, rad = 0.015 + 0.075 * q2;
      // (a flick: pressed on at the root, lifted off to a point, curved; most are short, the
      // tuft's leader is long; the outer ones lean far over)
      const lead = k < 2 && q3 > 0.45;
      const pv = (q5 * 9.7) % 1, acc = pv < 0.14;
      const len = (0.09 + 0.34 * q3 * q3) * tsz[tf] * (lead ? 1.5 : 1) * (acc ? 1.2 : 1), wid = 0.020 + 0.018 * q4;
      // most are close to the ground's own value (a little richer, or a little paler: the
      // sunlit and the dry); one in seven is a darker accent, and only those are left crisp
      const L = st.leaf, c = L ? L[acc ? 2 : pv < 0.55 ? 1 : 0] : null, gm = acc ? st.gm * 0.73 : st.gm;
      let cr = gr, cg = gg, cb = gb;
      if (c) { cr = lerp(c[0], gr, gm); cg = lerp(c[1], gg, gm); cb = lerp(c[2], gb, gm); }
      if (lead && tall > 0.3 && !acc) { const m = 0.5 * tall; cr = lerp(cr, SEED_HEAD[0], m); cg = lerp(cg, SEED_HEAD[1], m); cb = lerp(cb, SEED_HEAD[2], m); }
      const dk = acc ? 1.12 : pv < 0.36 ? 0.84 : 1.2;
      this.put(Math.cos(ang) * rad + tu[tf], Math.sin(ang) * rad + tv[tf], 0, 0.08 + 0.85 * q4 * q4, (tf ? t3 : t4) * 6.2832 + (q2 - 0.5) * 1.5, len, wid, acc && (k < 2 || q2 < 0.3) ? 3 : 2, q3 * 0.61 + q1 * 0.39, born,
        dens(cr, dk), dens(cg, dk), dens(cb, dk), (q5 - 0.5) * 1.5 + (q1 - 0.5) * 0.5, 1);
    }
    left -= nBlade;
    for (let k = 0; k < others.length && left > 0; k++, left--) {
      const kind = others[k];
      const q1 = H(150 + k), q2 = H(160 + k), q3 = H(170 + k), q4 = H(180 + k), q5 = H(190 + k);
      if ((kind === 2) && nTuft === 0) continue;
      const tf = nTuft === 2 ? (k & 1) : 0, inT = kind === 2;
      const ang = q1 * 6.2832, rad = kind === 2 ? 0.02 + 0.13 * q2 : kind === 1 ? (q2 < 0.75 ? 0.04 + 0.30 * q2 : 0.2 + 0.4 * q2) : 0.06 + 0.42 * Math.sqrt(q2);
      const ou = Math.cos(ang) * rad + (inT ? tu[tf] : 0), ov = Math.sin(ang) * rad + (inT ? tv[tf] : 0);
      let len, wid, mid, curl = 0, tilt = 0, flex = 0, cr, cg, cb;
      if (kind === 1) {     // reed stubble
        len = 0.45 + 0.55 * q3; wid = 0.024 + 0.012 * q4; mid = 0.86; curl = (q5 - 0.5) * 0.25; tilt = 0.04 + 0.16 * q4; flex = 0.7;
        const c = st.leaf ? st.leaf[1] : [gr, gg, gb];
        cr = dens(lerp(c[0], gr, 0.45), 1.3); cg = dens(lerp(c[1], gg, 0.45), 1.3); cb = dens(lerp(c[2], gb, 0.45), 1.3);
      } else if (kind === 2) {     // frost needles, crystal splinters: half catch the light, half are its shadow
        // (splinters stand in clusters, like the tufts: a few from one root, unequal, one of them tall)
        len = (0.06 + 0.26 * q3 * q3) * (0.55 + 1.0 * t3 * t3) * (k < 2 && q3 > 0.4 ? 1.6 : 1); wid = 0.026 + 0.020 * q4; mid = q5 > 0.8 ? 3 : 2; tilt = 0.85 * q4 * q4;
        const c = st.shard ? st.shard[q5 < 0.5 ? 0 : st.shard.length - 1] : null;
        if (c && c.length === 3) { cr = c[0]; cg = c[1]; cb = c[2]; }
        else if (q5 < 0.5) { cr = lerp(gr, 0.95, 0.6); cg = lerp(gg, 0.97, 0.6); cb = lerp(gb, 1.0, 0.6); }
        else { cr = dens(gr, 1.7) * 0.93; cg = dens(gg, 1.7) * 0.95; cb = dens(gb, 1.7); }
      } else if (kind === 5) {     // crust: a flat touch lying on the ground, one of the patch's own kind, ragged, unequal
        const cc = st.crustC, c = cc[Math.min(cc.length - 1, Math.floor((this.which * 0.75 + q5 * 0.25) * cc.length * 0.999))], m = 0.18 + 0.30 * q1;
        this.put(ou * 0.8, ov * 0.8, 0.012, 0, 0, 0.04 + 0.24 * q3 * q3, 0.02 + 0.10 * q4 * q4 + 0.02, LYING + (q5 > 0.8 ? CRISP : 0), q3, born, lerp(c[0], gr, m), lerp(c[1], gg, m), lerp(c[2], gb, m), q2 * 6.2832, 0);
        continue;
      } else if (kind === 4) {     // a drift ripple: a low dark comma on the sand
        len = 0.022 + 0.02 * q3; wid = 0.20 + 0.26 * q4; mid = 0.9;
        cr = dens(gr, 1.45); cg = dens(gg, 1.45); cb = dens(gb, 1.5);
      } else {                     // a pebble: a squat dab, darker than its ground
        len = 0.035 + 0.065 * q3; wid = 0.06 + 0.09 * q4; mid = 0.93;
        const c = st.rock ? st.rock[q5 < 0.4 ? 0 : 1] : null;
        if (c) { cr = lerp(c[0], gr, 0.5); cg = lerp(c[1], gg, 0.5); cb = lerp(c[2], gb, 0.5); } else { const k2 = 1.3 + 0.8 * q5; cr = dens(gr, k2); cg = dens(gg, k2); cb = dens(gb, k2 + 0.1); }
      }
      this.put(ou, ov, 0, tilt, q2 * 6.2832 + 1.7, len, wid, mid, q3 * 0.61 + q1 * 0.39, born, cr, cg, cb, curl, flex);
    }
  }

  // ---- farther off: fan-brush touches, dashes of colour, stones ----
  layBroad(i, j, born) {
    const st = this.st, s = this.s, seed = this.seed, cfg = this.cfg, per = cfg.per, far = cfg.name === 'far';
    const gr = s.r, gg = s.g, gb = s.b, canopy = this.canopy, shore = this.shore, C = cfg.cell;
    const H = (k) => hash3i(i, j, k, seed);
    const kw = far ? 2.7 : 1, kh = far ? 1.55 : 1;         // far touches are broader, a little taller
    const tall = sstep(0.52, 0.74, this.rough);
    const flex = far ? 0 : 0.6;
    let left = per, k = 0;
    const at = (q1, q2) => [(q1 - 0.5) * C * 0.92, (q2 - 0.5) * C * 0.92];
    // a drift of flowers: dashes of the flower's colour at the height of the sward
    const fl = st.flower > 0 && st.flowers ? st.flower * sstep(0.50, 0.70, this.drift) * this.meadow * (1 - 0.6 * canopy) : 0;
    if (fl > 0.04) {
      const nf = Math.min(left - 1, 1 + (H(100) < fl * 1.5 ? 1 : 0) + (far && H(101) < fl ? 1 : 0));
      const fc = st.flowers[Math.min(st.flowers.length - 1, Math.floor(this.which * st.flowers.length * 0.999))];
      for (let q = 0; q < nf; q++, k++) {
        const q1 = H(102 + q), q2 = H(106 + q), q3 = H(110 + q), p = at(q1, q2), m = far ? 0.25 : 0.1;
        this.put(p[0], p[1], (0.12 + 0.16 * q3) * (1 + 0.5 * tall) * kh, 0, 0, (0.035 + 0.035 * q3) * kh * Math.min(1.6, st.flowerSize), (0.10 + 0.22 * q1) * kw * Math.min(1.6, st.flowerSize), DAB, q3, born, lerp(fc[0], gr, m), lerp(fc[1], gg, m), lerp(fc[2], gb, m), 0, flex);
      }
      left -= nf;
    }
    // under the trees: fronds of fern, and the fallen leaves as dashes of sienna
    if (st.fern > 0 && canopy > 0.2 && st.bush) {
      const nfe = Math.min(left, (H(120) < st.fern * canopy * 2.2 ? 1 : 0) + (H(121) < st.fern * canopy ? 1 : 0));
      for (let q = 0; q < nfe; q++, k++) {
        const q1 = H(122 + q), q2 = H(125 + q), q3 = H(128 + q), p = at(q1, q2), c = st.bush[q3 < 0.3 ? 0 : q3 < 0.7 ? 1 : 2];
        this.put(p[0], p[1], 0, 0.1, q1 * 6.28, (0.34 + 0.34 * q3) * kh, (0.34 + 0.30 * q2) * kw, FAN, 0.5 + 0.5 * q3, born, lerp(c[0], gr, 0.4), lerp(c[1], gg, 0.4), lerp(c[2], gb, 0.4), (q2 - 0.5) * 0.3, flex);
      }
      left -= nfe;
    }
    if (st.litter > 0 && canopy > 0.2 && left > 0) {
      const nl = Math.min(left, H(130) < st.litter * canopy ? 2 : 1);
      for (let q = 0; q < nl; q++, k++) {
        const q1 = H(131 + q), q2 = H(134 + q), q3 = H(137 + q), p = at(q1, q2), c = st.litterC[q3 < 0.4 ? 0 : q3 < 0.78 ? 1 : 2], m = 0.42 + 0.2 * q2;
        this.put(p[0], p[1], 0, 0, 0, (0.03 + 0.03 * q3) * kh, (0.16 + 0.30 * q1) * kw, DAB, q3, born, lerp(c[0], gr, m), lerp(c[1], gg, m), lerp(c[2], gb, m), 0, 0);
      }
      left -= nl;
    }
    // stones: by the water, and wherever the ground is stony
    const nst = Math.min(left, (shore > 0.3 && st.rock ? 1 : 0) + Math.floor(st.dab * (far ? 2.2 : 3.0) * this.stony + H(140) * 0.9));
    for (let q = 0; q < nst; q++, k++) {
      const q1 = H(141 + q), q2 = H(145 + q), q3 = H(149 + q), q4 = H(153 + q), p = at(q1, q2);
      // (unequal: most are small, one in a while is a boulder; most are the pale stone with its
      // own shadow under it, one in four the dark one; all near the ground's value)
      const w = (0.05 + 0.42 * q3 * q3 * q3) * (far ? 2.2 : 1);
      const c = st.rock ? st.rock[q4 < 0.74 ? 0 : 1] : null, m = q4 < 0.74 ? 0.35 : 0.6;
      let cr, cg, cb;
      if (c) { cr = lerp(c[0], gr, m); cg = lerp(c[1], gg, m); cb = lerp(c[2], gb, m); } else { const k2 = 1.15 + 0.5 * q4; cr = dens(gr, k2); cg = dens(gg, k2); cb = dens(gb, k2 + 0.1); }
      this.put(p[0], p[1], 0, 0, 0, w * (0.55 + 0.8 * q1), w, DAB + (q4 > 0.8 ? CRISP : 0), q3, born, cr, cg, cb, 0, 0);
    }
    left -= nst;
    // crust: broken drags of a second wash lying flat on the ground, longer and softer the farther
    // off (seen across a plain they are the horizontal strokes that give it its distance)
    if (st.crust > 0 && left > 0) {
      const ncr = Math.min(left, Math.round(st.crust * (far ? 3.2 : 4.2) * this.crusty + H(240) - 0.5));
      const cc = st.crustC;
      for (let q = 0; q < ncr; q++, k++) {
        const q1 = H(241 + q), q2 = H(245 + q), q3 = H(249 + q), q4 = H(253 + q), p = at(q1, q2);
        const c = cc[Math.min(cc.length - 1, Math.floor((this.which * 0.75 + q4 * 0.25) * cc.length * 0.999))], m = (far ? 0.42 : 0.30) + 0.25 * q3;
        this.put(p[0], p[1], 0.015, 0, 0, (0.14 + 0.5 * q3 * q3) * kw, (0.07 + 0.22 * q4 * q4) * kw, LYING, q3, born, lerp(c[0], gr, m), lerp(c[1], gg, m), lerp(c[2], gb, m), q2 * 6.2832, 0);
      }
      left -= ncr;
    }
    // drift ripples on dunes: long low dashes, darker than the sand
    // (short, unequal, soft: rows of long thin ones read as ruled dashes)
    const nrp = Math.min(left, Math.round(st.ripple * 3 + H(160) - 0.5));
    for (let q = 0; q < nrp; q++, k++) {
      const q1 = H(161 + q), q2 = H(165 + q), q3 = H(169 + q), p = at(q1, q2);
      this.put(p[0], p[1], 0, 0, 0, (0.03 + 0.04 * q3) * kh, (0.14 + 0.5 * q1 * q1) * kw, DAB, q3, born, dens(gr, 1.2), dens(gg, 1.2), dens(gb, 1.25), 0, 0);
    }
    left -= nrp;
    // splinters of frost and crystal: a cluster in one touch, lit or in its own shadow
    const nnd = Math.min(left, Math.round(st.needle * 4 * this.needly + H(170) - 0.5));
    for (let q = 0; q < nnd; q++, k++) {
      const q1 = H(171 + q), q2 = H(175 + q), q3 = H(179 + q), q5 = H(183 + q), p = at(q1, q2);
      const c = st.shard ? st.shard[q5 < 0.5 ? 0 : st.shard.length - 1] : null;
      let cr, cg, cb;
      if (c && c.length === 3) { cr = c[0]; cg = c[1]; cb = c[2]; }
      else if (q5 < 0.5) { cr = lerp(gr, 0.95, 0.6); cg = lerp(gg, 0.97, 0.6); cb = lerp(gb, 1.0, 0.6); }
      else { cr = dens(gr, 1.6) * 0.93; cg = dens(gg, 1.6) * 0.95; cb = dens(gb, 1.6); }
      this.put(p[0], p[1], 0, 0.25 * q2, q1 * 6.28, (0.16 + 0.38 * q3 * q3) * kh, (0.07 + 0.09 * q2) * kw, FAN + (q5 > 0.75 ? CRISP : 0), 0.05 + 0.2 * q3, born, cr, cg, cb, (q1 - 0.5) * 0.5, 0);
    }
    left -= nnd;
    // reeds by the water
    const nrd = Math.min(left, Math.round(st.reed * 3 + H(190) - 0.5));
    for (let q = 0; q < nrd; q++, k++) {
      const q1 = H(191 + q), q2 = H(194 + q), q3 = H(197 + q), p = at(q1, q2), c = st.leaf ? st.leaf[1] : [gr, gg, gb];
      this.put(p[0], p[1], 0, 0.1 * q2, q1 * 6.28, (0.5 + 0.5 * q3) * kh, (0.12 + 0.14 * q2) * kw, FAN, 0.3 + 0.3 * q3, born, dens(lerp(c[0], gr, 0.45), 1.3), dens(lerp(c[1], gg, 0.45), 1.3), dens(lerp(c[2], gb, 0.45), 1.3), (q1 - 0.5) * 0.3, flex);
    }
    left -= nrd;
    // the grass: clumps, each one touch of a fan brush; taller and gone to seed where it is rough
    if (st.blade > 0 && left > 0) {
      const ng = Math.min(left, Math.round(st.blade * per * this.meadow * (0.55 + 0.6 * this.rough) + H(200) - 0.5));
      const L = st.leaf;
      for (let q = 0; q < ng; q++, k++) {
        const q1 = H(201 + q), q2 = H(208 + q), q3 = H(215 + q), q4 = H(222 + q), q5 = H(229 + q), p = at(q1, q2);
        // the shaded side of a tuft, the sunlit one, the dry one: all near the ground's own value
        const v = q5 < 0.36 ? 2 : q5 < 0.72 ? 1 : 0, c = L ? L[v] : null, gm = v === 2 ? st.gm - 0.02 : st.gm;
        let cr = gr, cg = gg, cb = gb;
        if (c) { cr = lerp(c[0], gr, gm); cg = lerp(c[1], gg, gm); cb = lerp(c[2], gb, gm); }
        if (v === 0 && tall > 0.2) { const m = 0.55 * tall; cr = lerp(cr, SEED_HEAD[0], m); cg = lerp(cg, SEED_HEAD[1], m); cb = lerp(cb, SEED_HEAD[2], m); }
        const dk = v === 2 ? 1.10 : v === 1 ? 1.04 : 0.86;
        this.put(p[0], p[1], 0, 0.12 * q4, q3 * 6.28, (0.15 + 0.24 * q3) * (1 + 1.1 * tall) * kh, (0.13 + 0.20 * q4) * kw, FAN, q3 * 0.61 + q1 * 0.39, born,
          dens(cr, dk), dens(cg, dk), dens(cb, dk), (q2 - 0.5) * 0.5, flex);
      }
    }
  }
}

export class NearGround {
  constructor(bodyId, root, bu) {
    const S = getSurface(bodyId), look = getLook(bodyId);
    const styles = S.biomes.map((b) => styleOf(look, b));
    this.mesh = new THREE.Group(); this.mesh.name = 'near-' + bodyId;
    root.add(this.mesh);
    this.rings = RINGS.map((cfg) => new Ring(cfg, S, styles, this.mesh, bu, bodyId));
    this.lastQ = QUALITY.level;
  }
  get busy() { let n = 0; if (this.mesh.visible) for (const r of this.rings) n += r.busy; return n; }
  get triangles() { let n = 0; for (const r of this.rings) n += r.triangles; return n; }
  clear() { for (const r of this.rings) r.clear(); }

  // camLocal: the eye, body-local; alt: its height over the ground; sliceMs: time to build in
  update(camLocal, active, alt, sliceMs, dt, pixel) {
    if (!active) { for (const r of this.rings) r.hide(); return; }
    this.mesh.visible = true;
    if (QUALITY.level !== this.lastQ) { this.lastQ = QUALITY.level; this.clear(); }
    // (walking, a few cells come due each frame and the slice is never filled; after a landing or
    // a leap the whole sward is due and arrives nearest first over a few seconds, inside the slice)
    let left = sliceMs;
    for (const r of this.rings) left -= r.update(camLocal, alt, Math.max(0.15, left), dt, pixel);
  }
}
