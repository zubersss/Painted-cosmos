// Painted Cosmos: the near ground. OWNER: PAINTER.
// One instanced layer of brush strokes round the eye, one draw call, about 20 k triangles:
// grass blades where the biome grows grass, reed stubble by the water, frost needles and
// splinters on ice and crystal, pebbles on bare rock, drift ripples on dunes. The art bible's
// "near things get a few crisp accents", and what PHYSICS' push field parts round a walker.
//
// Strokes are anchored to the planet: the ground is divided into cells of a cube-sphere grid
// (about 0.8 m), each cell owns one clump of up to eight strokes whose places, shapes and
// washes are a pure function of the cell. Cells come and go at the edge of the range, where a
// stroke's length is already nothing, so nothing pops; a clump laid inside the range grows in.
import * as THREE from 'three';
import { faceToDir, dirToFace } from './cubesphere.js';
import { hash3i } from './noise.js';
import { getSurface, makeSample, NOLQ } from './surface.js';
import { makeNearMaterial } from '../render/materials.js';
import { QUALITY } from '../render/shared.js';
import { getLook } from '../data/looks.js';

const CELL = 0.66, RANGE = 11, PER = 8, MAXS = 6400;   // at most 6400 strokes: 19.2 k triangles
const lerp = (a, b, t) => a + (b - a) * t;
const dens = (c, d) => Math.max(0, Math.min(1, c - (c - c * c) * (d - 1)));   // the pigment density model

// What grows or lies near the eye in a biome: counts of each kind of stroke in a full clump.
// A biome may say so itself (looks.js, `near: { blade, reed, needle, dab, ripple }`).
function styleOf(look, b) {
  const sm = b.small || {}, forest = b.terrain === 'forest';
  const under = Object.assign({}, look.flora && look.flora.under, b.under);
  const st = { blade: 0, reed: 0, needle: 0, dab: 0, ripple: 0, leaf: under.leaf || null, rock: under.rock || null, shard: under.shard || null };
  const grass = (sm.grass == null ? (forest ? 0.4 : 0) : sm.grass) + (sm.fern || 0) * 0.6;
  st.blade = Math.round(PER * Math.min(1, grass * 2.0));
  st.reed = Math.round(3 * Math.min(1, (sm.reed || 0) * 2));
  st.needle = Math.round(6 * Math.min(1, (sm.shard || 0) * 7));
  if (b.terrain === 'dunes') st.ripple = 5;
  st.dab = Math.max(st.blade >= 6 ? 0 : 2, Math.round(6 * Math.min(1, (sm.rock || 0) * 9)));
  if (b.near) Object.assign(st, b.near);
  // never more than a clump holds: grass first, then what lies on the ground
  let left = PER;
  for (const k of ['blade', 'reed', 'needle', 'ripple', 'dab']) { st[k] = Math.max(0, Math.min(left, st[k])); left -= st[k]; }
  return st;
}

export class NearGround {
  constructor(bodyId, root, bu) {
    this.S = getSurface(bodyId);
    const look = getLook(bodyId);
    this.styles = this.S.biomes.map((b) => styleOf(look, b));
    this.n = Math.max(8, Math.round((Math.PI * 0.5 * this.S.R) / CELL));
    const N = MAXS;
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, -1, 0.5, 0, 1, 0.5, 0, 0, 1, 0], 3));
    g.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]);
    const attr = (name, size) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(N * size), size); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(name, a); return a; };
    this.aRoot = attr('iRoot', 3); this.aAxis = attr('iAxis', 4); this.aPar = attr('iPar', 4); this.aCol = attr('iCol', 4); this.aExt = attr('iExt', 2);
    g.instanceCount = 0;
    this.material = makeNearMaterial(bu);
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.name = 'near-' + bodyId; this.mesh.frustumCulled = false; this.mesh.visible = false;
    root.add(this.mesh);
    this.origin = new THREE.Vector3(); this.hasOrigin = false;
    this.map = new Map();            // cell key -> the stroke slots of its clump (null: nothing grows there)
    this.free = []; for (let i = MAXS - 1; i >= 0; i--) this.free.push(i);
    this.high = 0; this.lastQ = QUALITY.level;
    this.pending = []; this.lastKey = -1; this.dirty = false; this.now = 0; this.filled = false;
    this.s = makeSample(this.S.nB); this.d = [0, 0, 0]; this.fo = { face: 0, u: 0, v: 0 };
    this.cam = new THREE.Vector3();
  }

  get busy() { return this.mesh.visible ? this.pending.length : 0; }
  get triangles() { return this.mesh.visible ? this.high * 3 : 0; }

  clear() {
    this.map.clear(); this.free.length = 0; for (let i = MAXS - 1; i >= 0; i--) this.free.push(i);
    this.pending.length = 0; this.lastKey = -1; this.filled = false; this.high = 0;
    this.aAxis.array.fill(0); this.dirty = true;
  }

  // camLocal: the eye, body-local; alt: its height over the ground; sliceMs: time to build in
  update(camLocal, active, alt, sliceMs, dt, pixel) {
    const show = active && alt < 45;
    if (!show) { if (this.mesh.visible) { this.mesh.visible = false; this.clear(); } return; }
    this.mesh.visible = true;
    this.now += Math.max(dt || 0, 1 / 60);
    const R = this.S.R, n = this.n;
    if (!this.hasOrigin || this.origin.distanceToSquared(camLocal) > 300 * 300) {
      this.origin.copy(camLocal); this.hasOrigin = true; this.clear();
      this.material.uniforms.uOrigin.value.copy(this.origin);
      this.mesh.position.copy(this.origin); this.mesh.updateMatrixWorld(true);
    }
    const u = this.material.uniforms;
    u.uCamLocal.value.copy(camLocal).sub(this.origin);
    u.uNear.value.set(RANGE * 0.66, RANGE, this.now, pixel || 0.002);
    if (QUALITY.level !== this.lastQ) { this.lastQ = QUALITY.level; this.clear(); }      // the low tier lays every other stroke
    // the cell under the eye; when it changes, see which cells have come into range or left it
    const il = 1 / camLocal.length(), cx = camLocal.x * il, cy = camLocal.y * il, cz = camLocal.z * il;
    const fo = dirToFace(cx, cy, cz, this.fo), d = this.d;
    const i0 = Math.floor((fo.u * 0.5 + 0.5) * n), j0 = Math.floor((fo.v * 0.5 + 0.5) * n), key0 = (fo.face * n + i0) * n + j0;
    if (key0 !== this.lastKey) {
      this.lastKey = key0;
      const f0 = fo.face, reach = (RANGE + 0.4) / R, K = Math.ceil((RANGE + 1) / (CELL * 0.62));
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
      // cells that have left: their strokes had already shrunk to nothing
      const gone = (RANGE + 2.2) / R;
      for (const [key, slot] of this.map) {
        if (want.has(key)) continue;
        const j = key % n, i = ((key - j) / n) % n, f = Math.floor(key / (n * n));
        faceToDir(f, ((i + 0.5) / n) * 2 - 1, ((j + 0.5) / n) * 2 - 1, d);
        if (Math.hypot(d[0] - cx, d[1] - cy, d[2] - cz) < gone) continue;
        this.map.delete(key);
        if (slot) { for (const o of slot) { this.free.push(o); this.aAxis.array[o * 4 + 3] = 0; } this.dirty = true; }
      }
      this.pending.sort((p, q) => q[0] - p[0]);          // nearest last: popped first
    }
    // lay the clumps that are due, nearest first, inside the time allowed
    if (this.pending.length) {
      const t0 = performance.now(), grown = this.filled ? this.now : -10;
      let guard = 0;
      while (this.pending.length && (guard++ < 4 || performance.now() - t0 < sliceMs)) {
        const p = this.pending.pop();
        this.lay(p[1], p[2], p[3], p[4], p[0] * R > RANGE * 0.9 ? -10 : grown);
      }
      if (!this.pending.length) this.filled = true;
    }
    if (this.dirty) {
      this.dirty = false;
      this.mesh.geometry.instanceCount = this.high;
      this.aRoot.needsUpdate = this.aAxis.needsUpdate = this.aPar.needsUpdate = this.aCol.needsUpdate = this.aExt.needsUpdate = true;
    }
  }

  // one clump: where it stands, what grows there, eight strokes
  lay(f, i, j, key, born) {
    const S = this.S, n = this.n, s = this.s, d = this.d, R = S.R, seed = (f * 7919 + 13) | 0;
    const r1 = hash3i(i, j, 1, seed), r2 = hash3i(i, j, 2, seed);
    faceToDir(f, ((i + 0.15 + 0.7 * r1) / n) * 2 - 1, ((j + 0.15 + 0.7 * r2) / n) * 2 - 1, d);
    const x = d[0], y = d[1], z = d[2];
    S.sample(x, y, z, s, true);
    const h = s.h;
    if ((s.lq !== NOLQ && s.lq > h - 0.04) || !this.free.length) { this.map.set(key, null); return; }
    // the ground's own plane here (two more heights): strokes stand on the slope, not on the sphere
    let ux, uy, uz;
    if (Math.abs(y) < 0.9) { ux = -z; uy = 0; uz = x; } else { ux = 0; uy = z; uz = -y; }
    let l = 1 / Math.hypot(ux, uy, uz); ux *= l; uy *= l; uz *= l;
    const vx = y * uz - z * uy, vy = z * ux - x * uz, vz = x * uy - y * ux;
    const e = 0.45, gu = (S.heightAt(x + ux * e / R, y + uy * e / R, z + uz * e / R) - h) / e, gv = (S.heightAt(x + vx * e / R, y + vy * e / R, z + vz * e / R) - h) / e;
    const steep = Math.hypot(gu, gv);
    if (steep > 1.3) { this.map.set(key, null); return; }
    let nx = x - ux * gu - vx * gv, ny = y - uy * gu - vy * gv, nz = z - uz * gu - vz * gv;
    l = 1 / Math.hypot(nx, ny, nz); nx *= l; ny *= l; nz *= l;
    const slots = [], lowQ = QUALITY.level === 0;
    this.map.set(key, slots);
    const px = x * (R + h) - this.origin.x, py = y * (R + h) - this.origin.y, pz = z * (R + h) - this.origin.z;
    // which biome's ground this is (borders intermix clump by clump)
    let bi = s.top, acc = 0; const pick = hash3i(i, j, 3, seed);
    for (let q = 0; q < S.nB; q++) { acc += s.w[q]; if (pick < acc) { bi = q; break; } }
    const st = this.styles[bi];
    // (a biome without undergrowth of its own, the forests, grows grass wherever the canopy lets it)
    const und = S.biomes[bi].small ? (s.under || 0) : 1;
    const meadow = Math.min(1, 0.3 + 0.7 * und) * (1 - 0.4 * Math.min(1, s.canopy || 0)) * (1 - Math.min(1, s.rock || 0) * 0.7);
    const nBlade = Math.round(st.blade * meadow * (steep > 0.8 ? 0.4 : 1));
    const gr = s.r, gg = s.g, gb = s.b;
    const A = this.aAxis.array, P = this.aPar.array, C = this.aCol.array, Ro = this.aRoot.array, E = this.aExt.array;
    let kinds = [];
    for (let q = 0; q < nBlade; q++) kinds.push(0);
    for (let q = 0; q < st.reed; q++) kinds.push(1);
    for (let q = 0; q < st.needle; q++) kinds.push(2);
    for (let q = 0; q < st.ripple; q++) kinds.push(4);
    for (let q = 0; q < st.dab + (st.blade - nBlade > 3 ? 1 : 0); q++) kinds.push(3);
    // Grass grows in tufts, not in rows: a cell has one tuft, or two, or (one in five) none; a
    // tuft is a handful of flicks from nearly one root, fanned, one or two of them long. Tufts
    // differ in size, so the sward is uneven in spacing and in height.
    const t1 = hash3i(i, j, 4, seed), t2 = hash3i(i, j, 5, seed), t3 = hash3i(i, j, 6, seed), t4 = hash3i(i, j, 7, seed);
    const nTuft = t1 < 0.20 ? 0 : t1 < 0.74 ? 1 : 2;
    const tu = [(t2 - 0.5) * 0.5, (t4 - 0.5) * 0.5], tv = [(t3 - 0.5) * 0.5, (t2 * 7.13 % 1 - 0.5) * 0.5], tsz = [0.55 + 1.0 * t3 * t3, 0.5 + 0.9 * t4];
    for (let k = 0; k < PER; k++) {
      // (dealt in a shuffled order, so that the half laid at the low tier is a fair sample)
      const kind = kinds.length ? kinds[(k * 5 + ((pick * 8) | 0)) % PER] : undefined;
      if (kind === undefined || (lowQ && (k & 1)) || !this.free.length) continue;
      if ((kind === 0 || kind === 2) && nTuft === 0) continue;      // (a bare patch: no tuft, no cluster of splinters)
      const o = this.free.pop(); slots.push(o); if (o >= this.high) this.high = o + 1;
      const q1 = hash3i(i, j, 10 + k, seed), q2 = hash3i(i, j, 20 + k, seed), q3 = hash3i(i, j, 30 + k, seed), q4 = hash3i(i, j, 40 + k, seed), q5 = hash3i(i, j, 50 + k, seed);
      // where in the clump: on the ground's plane, up to half a metre from its centre
      const tf = nTuft === 2 ? (k & 1) : 0;
      const ang = q1 * 6.2832, rad = (kind === 0 ? 0.015 + 0.07 * q2 : kind === 2 ? 0.02 + 0.13 * q2 : kind === 1 ? (q2 < 0.75 ? 0.04 + 0.30 * q2 : 0.2 + 0.4 * q2) : 0.06 + 0.45 * Math.sqrt(q2));
      const inT = kind === 0 || kind === 2;
      const ou = Math.cos(ang) * rad + (inT ? tu[tf] : 0), ov = Math.sin(ang) * rad + (inT ? tv[tf] : 0), dh = ou * gu + ov * gv - 0.02;
      Ro[o * 3] = px + ux * ou + vx * ov + x * dh; Ro[o * 3 + 1] = py + uy * ou + vy * ov + y * dh; Ro[o * 3 + 2] = pz + uz * ou + vz * ov + z * dh;
      let len, wid, mid, curl, tilt, flex, cr, cg, cb;
      if (kind === 0) {            // a grass blade: one flick of the brush
        // (a flick: pressed on at the root, lifted off to a point, curved; most are short, the
        // tuft's leader is long; the outer ones lean far over)
        const lead = k < 2 && q3 > 0.35;
        const pv = (q5 * 9.7) % 1, acc = pv < 0.14;
        len = (0.09 + 0.34 * q3 * q3) * tsz[tf] * (lead ? 1.7 : 1) * (acc ? 1.25 : 1); wid = 0.020 + 0.018 * q4; curl = (q5 - 0.5) * 1.5 + (q1 - 0.5) * 0.5; tilt = 0.08 + 0.85 * q4 * q4; flex = 1;
        // most are close to the ground's own value (a little richer, or a little paler: the
        // sunlit and the dry); one in seven is a darker accent, and only those are left crisp
        const L = st.leaf;
        const c = L ? L[acc ? 2 : pv < 0.55 ? 1 : 0] : null, gm = acc ? 0.48 : 0.66;
        if (c) { cr = lerp(c[0], gr, gm); cg = lerp(c[1], gg, gm); cb = lerp(c[2], gb, gm); } else { cr = gr; cg = gg; cb = gb; }
        const dk = acc ? 1.06 : pv < 0.36 ? 0.86 : 1.14;
        cr = dens(cr, dk); cg = dens(cg, dk); cb = dens(cb, dk);
        mid = acc ? 3 : 2;      // (2 and up: the flick shape; 3: an accent)
      } else if (kind === 1) {     // reed stubble
        len = 0.45 + 0.55 * q3; wid = 0.024 + 0.012 * q4; mid = 0.86; curl = (q5 - 0.5) * 0.25; tilt = 0.04 + 0.16 * q4; flex = 0.7;
        const c = st.leaf ? st.leaf[1] : [gr, gg, gb];
        cr = dens(lerp(c[0], gr, 0.45), 1.3); cg = dens(lerp(c[1], gg, 0.45), 1.3); cb = dens(lerp(c[2], gb, 0.45), 1.3);
      } else if (kind === 2) {     // frost needles, crystal splinters: half catch the light, half are its shadow
        // (splinters stand in clusters, like the tufts: a few from one root, unequal, one of them tall)
        len = (0.06 + 0.26 * q3 * q3) * tsz[tf] * (k < 2 && q3 > 0.4 ? 1.6 : 1); wid = 0.026 + 0.020 * q4; mid = q5 > 0.8 ? 3 : 2; curl = 0; tilt = 0.85 * q4 * q4; flex = 0;
        const c = st.shard ? st.shard[q5 < 0.5 ? 0 : st.shard.length - 1] : null;
        if (c && c.length === 3) { cr = c[0]; cg = c[1]; cb = c[2]; }
        else if (q5 < 0.5) { cr = lerp(gr, 0.95, 0.6); cg = lerp(gg, 0.97, 0.6); cb = lerp(gb, 1.0, 0.6); }
        else { cr = dens(gr, 1.7) * 0.93; cg = dens(gg, 1.7) * 0.95; cb = dens(gb, 1.7); }
      } else if (kind === 4) {     // a drift ripple: a low dark comma on the sand
        len = 0.022 + 0.02 * q3; wid = 0.20 + 0.26 * q4; mid = 0.9; curl = 0; tilt = 0; flex = 0;
        cr = dens(gr, 1.45); cg = dens(gg, 1.45); cb = dens(gb, 1.5);
      } else {                     // a pebble: a squat dab, darker than its ground
        len = 0.035 + 0.065 * q3; wid = 0.06 + 0.09 * q4; mid = 0.93; curl = 0; tilt = 0; flex = 0;
        const c = st.rock ? st.rock[q5 < 0.4 ? 0 : 1] : null;
        if (c) { cr = lerp(c[0], gr, 0.5); cg = lerp(c[1], gg, 0.5); cb = lerp(c[2], gb, 0.5); } else { const k2 = 1.3 + 0.8 * q5; cr = dens(gr, k2); cg = dens(gg, k2); cb = dens(gb, k2 + 0.1); }
      }
      // the way it grows: the ground's normal, leaned over a little
      const la = q2 * 6.2832 + 1.7, tx = (ux * Math.cos(la) + vx * Math.sin(la)) * tilt, ty = (uy * Math.cos(la) + vy * Math.sin(la)) * tilt, tz = (uz * Math.cos(la) + vz * Math.sin(la)) * tilt;
      let ax = nx + tx, ay = ny + ty, az = nz + tz; l = 1 / Math.hypot(ax, ay, az);
      A[o * 4] = ax * l; A[o * 4 + 1] = ay * l; A[o * 4 + 2] = az * l; A[o * 4 + 3] = len;
      P[o * 4] = wid; P[o * 4 + 1] = mid; P[o * 4 + 2] = q3 * 0.61 + q1 * 0.39; P[o * 4 + 3] = born;
      C[o * 4] = cr; C[o * 4 + 1] = cg; C[o * 4 + 2] = cb; C[o * 4 + 3] = curl;
      E[o * 2] = Math.min(1, s.canopy || 0); E[o * 2 + 1] = flex;
    }
    this.dirty = true;
  }
}
