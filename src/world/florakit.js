// Painted Cosmos: flora built from stroke clusters, all generated in code. OWNER: PAINTER.
// Every plant is a few soft forms: wobbly tapered tubes for trunks, noisy blobs with a ragged
// dabbed edge for foliage masses, single tapered strokes for blades and fronds.
//
// Vertex layout (see PROP shader in src/render/materials.js):
//   position, normal, uv, aMass (soft normal of the whole mass),
//   aData = (sway, part, inner shade, blob hash); part: 0 bark, 1 foliage, 2 blade, 3 accent, 4 rock
import * as THREE from 'three';
import { mulberry32 } from './noise.js';

// Physical hints per kit for PHYSICS (C14): model height in metres before the instance scale,
// and stiffness (0 = bends like grass, 1 = a tree).
export const FLORA_PHYS = {
  grass: { height: 0.5, stiffness: 0 }, reed: { height: 1.4, stiffness: 0.05 }, fern: { height: 0.6, stiffness: 0.05 },
  flower: { height: 0.58, stiffness: 0 }, bush: { height: 1.3, stiffness: 0.35 },
  birch: { height: 13, stiffness: 1 }, pine: { height: 18, stiffness: 1 }, farTree: { height: 1, stiffness: 1 },
};

class Builder {
  constructor() { this.p = []; this.n = []; this.m = []; this.uv = []; this.d = []; this.idx = []; }
  get count() { return this.p.length / 3; }
  vert(px, py, pz, nx, ny, nz, mx, my, mz, u, v, sway, part, shade, hash) {
    this.p.push(px, py, pz); this.n.push(nx, ny, nz); this.m.push(mx, my, mz); this.uv.push(u, v); this.d.push(sway, part, shade, hash);
    return this.p.length / 3 - 1;
  }
  tri(a, b, c) { this.idx.push(a, b, c); }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.p), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.n), 3));
    g.setAttribute('aMass', new THREE.BufferAttribute(new Float32Array(this.m), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(this.uv), 2));
    g.setAttribute('aData', new THREE.BufferAttribute(new Float32Array(this.d), 4));
    g.setIndex(this.count > 65535 ? new THREE.BufferAttribute(new Uint32Array(this.idx), 1) : new THREE.BufferAttribute(new Uint16Array(this.idx), 1));
    g.computeBoundingSphere();
    return g;
  }
}

// A tube along a path of points with radii. Normals are radial (smooth).
function tube(B, pts, radii, sides, opts) {
  const o = Object.assign({ part: 0, shade: 0, hash: 0.5, sway0: 0, swayK: 0, swayH: 1, vScale: 1, v0: 0, cap: true }, opts || {});
  const rings = [];
  let vv = o.v0;
  const up = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), t = new THREE.Vector3();
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    t.copy(pts[Math.min(i + 1, pts.length - 1)]).sub(pts[Math.max(i - 1, 0)]).normalize();
    a.set(1, 0, 0); if (Math.abs(t.x) > 0.9) a.set(0, 0, 1);
    b.crossVectors(t, a).normalize(); a.crossVectors(b, t).normalize();
    if (i > 0) vv += p.distanceTo(pts[i - 1]) * o.vScale;
    const ring = [];
    const sway = o.sway0 + o.swayK * Math.pow(Math.max(0, p.y / o.swayH), 2);
    for (let s = 0; s <= sides; s++) {
      const ang = (s / sides) * Math.PI * 2, ca = Math.cos(ang), sa = Math.sin(ang);
      const nx = a.x * ca + b.x * sa, ny = a.y * ca + b.y * sa, nz = a.z * ca + b.z * sa;
      ring.push(B.vert(p.x + nx * radii[i], p.y + ny * radii[i], p.z + nz * radii[i], nx, ny, nz, nx, ny, nz, s / sides, vv, sway, o.part, o.shade, o.hash));
    }
    rings.push(ring);
  }
  for (let i = 0; i < rings.length - 1; i++) for (let s = 0; s < sides; s++) {
    const p0 = rings[i][s], p1 = rings[i][s + 1], q0 = rings[i + 1][s], q1 = rings[i + 1][s + 1];
    B.tri(p0, q0, p1); B.tri(p1, q0, q1);
  }
}

// A noisy ellipsoid blob (foliage mass or rock). detail 1 = 80 triangles.
const _ico = {};
function ico(detail) {
  if (!_ico[detail]) {
    const g = new THREE.IcosahedronGeometry(1, detail);
    _ico[detail] = { p: g.attributes.position.array, uv: g.attributes.uv.array, n: g.attributes.position.count };
  }
  return _ico[detail];
}
function blob(B, c, rx, ry, rz, rnd, opts) {
  const o = Object.assign({ detail: 1, part: 1, noise: 0.22, droop: 0, massC: null, massK: 0.6, sway: 0.5, shade0: 0, shadeK: 0.7, hash: rnd(), uvScale: 3, flatBottom: 0, taper: 0, uvT: false }, opts || {});
  const I = ico(o.detail);
  const mc = o.massC || c;
  const ph1 = rnd() * 6.28, ph2 = rnd() * 6.28, ph3 = rnd() * 6.28;
  const base = B.count;
  for (let i = 0; i < I.n; i++) {
    let x = I.p[i * 3], y = I.p[i * 3 + 1], z = I.p[i * 3 + 2];
    // smooth lumpy displacement: a few low sine lobes so shared vertices stay welded
    const k = 1 + o.noise * (Math.sin(x * 3.1 + ph1) * Math.sin(y * 2.7 + ph2) + 0.6 * Math.sin(z * 4.3 + ph3 + x * 1.9));
    const tp = 1 - o.taper * (y * 0.5 + 0.5);
    let px = x * rx * k * tp, py = y * ry * k, pz = z * rz * k * tp;
    const rad = Math.sqrt(x * x + z * z);
    py -= o.droop * rad * rad * ry;
    if (o.flatBottom && y < 0) py *= 1 - o.flatBottom;
    // ellipsoid normal
    let nx = x / rx, ny = y / ry, nz = z / rz; let l = 1 / Math.hypot(nx, ny, nz); nx *= l; ny *= l; nz *= l;
    // mass normal: blend toward the direction from the crown centre
    let mx = c.x + px - mc.x, my = c.y + py - mc.y, mz = c.z + pz - mc.z; l = 1 / Math.max(1e-6, Math.hypot(mx, my, mz)); mx *= l; my *= l; mz *= l;
    mx = nx + (mx - nx) * o.massK; my = ny + (my - ny) * o.massK; mz = nz + (mz - nz) * o.massK; l = 1 / Math.max(1e-6, Math.hypot(mx, my, mz));
    const shade = Math.min(1, Math.max(0, o.shade0 + o.shadeK * (0.5 - y * 0.5)));
    B.vert(c.x + px, c.y + py, c.z + pz, nx, ny, nz, mx * l, my * l, mz * l, I.uv[i * 2] * o.uvScale, o.uvT ? y * 0.5 + 0.5 : I.uv[i * 2 + 1] * o.uvScale * 0.5, o.sway, o.part, shade, o.hash);
  }
  for (let i = 0; i < I.n; i += 3) B.tri(base + i, base + i + 1, base + i + 2);
}

// A single tapered stroke (grass blade, fern frond): a ribbon that arches outward.
function stroke(B, root, dir, len, width, arch, rnd, opts) {
  const o = Object.assign({ segs: 3, part: 2, hash: rnd(), sway: 0.25, leaf: 0, twist: 0 }, opts || {});
  const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
  let prevL = -1, prevR = -1;
  for (let i = 0; i <= o.segs; i++) {
    const t = i / o.segs;
    // arc: rises then bends over
    const out = len * (t * arch + 0.15 * t * t), upv = len * (t - arch * 0.55 * t * t);
    const p = new THREE.Vector3(root.x + dir.x * out, root.y + upv, root.z + dir.z * out);
    const w = width * (o.leaf ? Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.08)) : (1 - t * 0.92));
    const nUp = new THREE.Vector3(-dir.x * (1 - t) * 0.6, 1, -dir.z * (1 - t) * 0.6).normalize();
    const L = B.vert(p.x - side.x * w, p.y, p.z - side.z * w, nUp.x, nUp.y, nUp.z, 0, 1, 0, 0, t, o.sway * t * t, o.part, 0, o.hash);
    const Rr = B.vert(p.x + side.x * w, p.y, p.z + side.z * w, nUp.x, nUp.y, nUp.z, 0, 1, 0, 1, t, o.sway * t * t, o.part, 0, o.hash);
    if (i > 0) { B.tri(prevL, prevR, L); B.tri(prevR, Rr, L); }
    prevL = L; prevR = Rr;
  }
}

function V(x, y, z) { return new THREE.Vector3(x, y, z); }

// ---------------------------------------------------------------------------------------------
// lod: 0 full (near), 1 medium (two washes and a trunk)
export function birchGeometry(seed, lod) {
  const rnd = mulberry32(seed), B = new Builder();
  const H = 10.5 + rnd() * 2.5;
  // no two trunks alike: lean, an S-bend, and small kinks from ring to ring
  const lean = (rnd() - 0.5) * 2.4, bend = (rnd() - 0.5) * 2.2, lz = (rnd() - 0.5) * 1.6, ph = rnd() * 3;
  const segs = lod === 0 ? 9 : 3, sides = lod === 0 ? 7 : 4;
  const pts = [], rad = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, y = t * H;
    const kink = lod ? 0 : 0.09;
    pts.push(V(lean * t * t + bend * Math.sin(t * 3.1 + ph) * 0.32 * t + (rnd() - 0.5) * kink, y, lz * t * t + bend * Math.cos(t * 2.3 + ph) * 0.2 * t + (rnd() - 0.5) * kink));
    rad.push((0.225 - 0.165 * Math.pow(t, 0.75)) * (i === 0 ? 1.5 : 1) * (0.86 + rnd() * 0.3));
  }
  tube(B, pts, rad, sides, { part: 0, swayK: 0.5, swayH: H, hash: rnd() });
  const top = pts[segs];
  const crownC = V(top.x * 0.85, H * 0.72, top.z * 0.85);
  const at = (t) => { const f = Math.min(0.9999, Math.max(0, t)) * segs, i = Math.floor(f), k = f - i; return pts[i].clone().lerp(pts[i + 1], k); };
  if (lod === 0) {
    // a few thin dark branches reaching into the crown
    for (let k = 0; k < 3; k++) {
      const t0 = 0.40 + 0.16 * k + rnd() * 0.06, p0 = at(t0);
      const ang = rnd() * 6.283, len = 1.9 + rnd() * 1.8;
      const p1 = V(p0.x + Math.cos(ang) * len * 0.55, p0.y + len * 0.5, p0.z + Math.sin(ang) * len * 0.55);
      const p2 = V(p0.x + Math.cos(ang) * len, p0.y + len * 0.78, p0.z + Math.sin(ang) * len);
      tube(B, [p0, p1, p2], [0.06, 0.038, 0.014], 4, { part: 0, shade: 0.8, sway0: 0.4, hash: rnd() });
    }
    // crown: a handful of large overlapping washes
    const nBlobs = 6 + ((rnd() * 2) | 0);
    for (let k = 0; k < nBlobs; k++) {
      const t0 = 0.46 + 0.56 * (k / (nBlobs - 1)), p0 = at(t0);
      const spread = Math.max(0.2, (1.0 - Math.abs(t0 - 0.70) * 1.7)) * 2.3 + 0.2;
      const ang = k * 2.4 + rnd() * 1.2, rr = spread * (0.35 + 0.65 * rnd());
      const c = V(p0.x + Math.cos(ang) * rr, p0.y + (rnd() - 0.3) * 0.7 + (t0 > 1 ? (t0 - 1) * H : 0), p0.z + Math.sin(ang) * rr);
      const r = 1.9 + rnd() * 1.0;
      blob(B, c, r, r * (0.66 + rnd() * 0.2), r * (0.85 + rnd() * 0.3), rnd, { massC: crownC, massK: 0.55, sway: 0.7 + 0.5 * (c.y / H), shade0: 0.05 + 0.3 * (1 - (c.y - H * 0.45) / (H * 0.6)), droop: 0.25, uvScale: 3.4 });
    }
  } else {
    blob(B, V(top.x * 0.7 + 0.5, H * 0.60, top.z * 0.7), 3.2, 2.5, 3.0, rnd, { massC: crownC, massK: 0.4, sway: 0.7, shade0: 0.25, shadeK: 0.7, droop: 0.2, noise: 0.3, uvScale: 4 });
    blob(B, V(top.x * 0.9 - 0.4, H * 0.84, top.z * 0.9 + 0.3), 2.7, 2.3, 2.8, rnd, { massC: crownC, massK: 0.4, sway: 0.9, shade0: 0.0, shadeK: 0.6, droop: 0.2, noise: 0.3, uvScale: 4 });
  }
  return B.build();
}

export function pineGeometry(seed, lod) {
  const rnd = mulberry32(seed), B = new Builder();
  const H = 14 + rnd() * 4;
  const lean = (rnd() - 0.5) * 1.0, lz = (rnd() - 0.5) * 0.7;
  const segs = lod === 0 ? 6 : 2, sides = lod === 0 ? 7 : 4;
  const pts = [], rad = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const kink = lod ? 0 : 0.07;
    pts.push(V(lean * t * t + (rnd() - 0.5) * kink, t * H, lz * t * t + (rnd() - 0.5) * kink));
    rad.push((0.32 - 0.27 * Math.pow(t, 0.9)) * (i === 0 ? 1.4 : 1) * (0.88 + rnd() * 0.24));
  }
  tube(B, pts, rad, sides, { part: 0, swayK: 0.35, swayH: H, hash: rnd() });
  const crownC = V(lean * 0.5, H * 0.62, lz * 0.4);
  if (lod === 0) {
    for (let k = 0; k < 2; k++) {
      const y = H * (0.20 + 0.09 * k + rnd() * 0.04), ang = rnd() * 6.283, len = 0.6 + rnd() * 0.9;
      tube(B, [V(0, y, 0), V(Math.cos(ang) * len, y + 0.1, Math.sin(ang) * len)], [0.045, 0.012], 4, { part: 0, shade: 0.7, hash: rnd() });
    }
    const tiers = 6;
    const gap = (H * 0.60) / (tiers - 1);
    for (let k = 0; k < tiers; k++) {
      const t = k / (tiers - 1);
      const y = H * (0.36 + 0.60 * t);
      const r = (3.9 - 3.0 * Math.pow(t, 0.85)) * (0.85 + rnd() * 0.3);
      const off = (1 - t) * 0.6;
      const c = V(lean * (y / H) * (y / H) + (rnd() - 0.5) * off, y, lz * (y / H) * (y / H) + (rnd() - 0.5) * off);
      blob(B, c, r, Math.max(r * 0.42 + 0.25, gap * 0.7), r * (0.9 + rnd() * 0.2), rnd, { massC: crownC, massK: 0.35, sway: 0.35 + 0.5 * t, shade0: 0.12 + 0.25 * (1 - t), shadeK: 0.8, droop: 0.9, noise: 0.28, uvScale: 4 });
    }
    blob(B, V(lean, H * 0.99, lz), 0.55, 1.4, 0.55, rnd, { massC: crownC, massK: 0.3, sway: 0.9, shade0: 0.0, uvScale: 2, taper: 0.6 });
  } else {
    blob(B, V(lean * 0.4, H * 0.56, lz * 0.4), 3.8, H * 0.21, 3.6, rnd, { massC: crownC, massK: 0.3, sway: 0.4, shade0: 0.2, shadeK: 0.75, droop: 0.5, noise: 0.26, taper: 0.45, uvScale: 5 });
    blob(B, V(lean * 0.8, H * 0.83, lz * 0.8), 2.4, H * 0.20, 2.3, rnd, { massC: crownC, massK: 0.3, sway: 0.8, shade0: 0.0, shadeK: 0.7, droop: 0.3, noise: 0.24, taper: 0.85, uvScale: 5 });
  }
  return B.build();
}

// The far tree: one unit-high form (a trunk stroke and one wash) shared by every species.
// The instance matrix sizes it; the shader tapers it to a point for pines. 26 triangles.
export function farTreeGeometry(seed) {
  const rnd = mulberry32(seed), B = new Builder();
  tube(B, [V(0, 0, 0), V(0.01, 0.52, 0)], [0.020, 0.012], 3, { part: 0, swayK: 0.02, swayH: 1, hash: 0.5 });
  blob(B, V(0, 0.66, 0), 0.27, 0.36, 0.27, rnd, { detail: 0, massK: 0.15, sway: 0.05, shade0: 0.0, shadeK: 0.8, noise: 0.22, uvScale: 2, uvT: true });
  return B.build();
}

export function grassGeometry(seed) {
  const rnd = mulberry32(seed), B = new Builder();
  const n = 6;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * 6.283 + rnd() * 0.8;
    const dir = V(Math.cos(ang), 0, Math.sin(ang));
    const r0 = rnd() * 0.10;
    stroke(B, V(dir.x * r0, 0, dir.z * r0), dir, 0.20 + rnd() * 0.30, 0.014 + rnd() * 0.012, 0.15 + rnd() * 0.5, rnd, { segs: 2, sway: 0.5 });
  }
  return B.build();
}

export function reedGeometry(seed) {
  const rnd = mulberry32(seed), B = new Builder();
  const n = 8;
  for (let i = 0; i < n; i++) {
    const ang = rnd() * 6.283;
    const dir = V(Math.cos(ang), 0, Math.sin(ang));
    const r0 = rnd() * 0.22;
    stroke(B, V(dir.x * r0, 0, dir.z * r0), dir, 0.7 + rnd() * 0.7, 0.016 + rnd() * 0.012, 0.06 + rnd() * 0.22, rnd, { segs: 3, sway: 0.8 });
  }
  return B.build();
}

export function fernGeometry(seed) {
  const rnd = mulberry32(seed), B = new Builder();
  const n = 7;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * 6.283 + rnd() * 0.5;
    const dir = V(Math.cos(ang), 0, Math.sin(ang));
    stroke(B, V(0, 0, 0), dir, 0.45 + rnd() * 0.3, 0.055 + rnd() * 0.03, 0.75 + rnd() * 0.35, rnd, { segs: 3, leaf: 1, sway: 0.35 });
  }
  return B.build();
}

export function bushGeometry(seed) {
  const rnd = mulberry32(seed), B = new Builder();
  const cc = V(0, 0.5, 0);
  for (let i = 0; i < 2; i++) {
    const ang = i * 2.6 + rnd(), rr = 0.3 + rnd() * 0.3, r = 0.62 + rnd() * 0.3;
    blob(B, V(Math.cos(ang) * rr, 0.45 + rnd() * 0.3, Math.sin(ang) * rr), r, r * 0.8, r, rnd, { massC: cc, massK: 0.5, sway: 0.25, shade0: 0.1, uvScale: 2 });
  }
  return B.build();
}

export function rockGeometry(seed) {
  const rnd = mulberry32(seed), B = new Builder();
  blob(B, V(0, 0.28, 0), 0.75, 0.5, 0.6, rnd, { detail: 1, part: 4, noise: 0.32, massK: 0, sway: 0, shade0: 0, shadeK: 1.0, flatBottom: 0.4, uvScale: 1 });
  return B.build();
}

export function flowerGeometry(seed) {
  const rnd = mulberry32(seed), B = new Builder();
  const n = 5;
  for (let i = 0; i < n; i++) {
    const ang = rnd() * 6.283, rr = rnd() * 0.28, h = 0.28 + rnd() * 0.3;
    const x = Math.cos(ang) * rr, z = Math.sin(ang) * rr;
    const dir = V(Math.cos(ang), 0, Math.sin(ang));
    stroke(B, V(x * 0.6, 0, z * 0.6), dir, h, 0.012, 0.25, rnd, { segs: 2, sway: 0.5 });
    // the head: a small soft dab
    const c = V(x * 0.6 + dir.x * h * 0.3, h * 0.96, z * 0.6 + dir.z * h * 0.3), s = 0.05 + rnd() * 0.035;
    const base = B.count, hh = rnd();
    const ring = 6;
    B.vert(c.x, c.y + s * 0.5, c.z, 0, 1, 0, 0, 1, 0, 0.5, 1, 0.5, 3, 0, hh);
    for (let k = 0; k < ring; k++) { const a = (k / ring) * 6.283; B.vert(c.x + Math.cos(a) * s, c.y, c.z + Math.sin(a) * s, Math.cos(a) * 0.5, 0.8, Math.sin(a) * 0.5, 0, 1, 0, 0.5, 1, 0.5, 3, 0, hh); }
    for (let k = 0; k < ring; k++) B.tri(base, base + 1 + ((k + 1) % ring), base + 1 + k);
  }
  return B.build();
}

// ---------------------------------------------------------------------------------------------
// Kits for the other worlds. Same contract: (seed, lod) -> geometry, lod 0 near, 1 mid.

// A fungal tower: a pale leaning stalk under a broad drooping cap, with a smaller cap or two.
export function fungusGeometry(seed, lod) {
  const rnd = mulberry32(seed), B = new Builder();
  const H = 12 + rnd() * 5, lean = (rnd() - 0.5) * 4.5, lz = (rnd() - 0.5) * 3.0, bend = (rnd() - 0.5) * 3.0, ph = rnd() * 3;
  const segs = lod ? 3 : 8, sides = lod ? 4 : 7, pts = [], rad = [];
  for (let i = 0; i <= segs; i++) { const t = i / segs; pts.push(V(lean * t * t + bend * Math.sin(t * 3.0 + ph) * 0.35 * t + (lod ? 0 : (rnd() - 0.5) * 0.18), t * H, lz * t * t + bend * Math.cos(t * 2.2 + ph) * 0.25 * t)); rad.push((0.66 - 0.30 * Math.pow(t, 0.7)) * (i === 0 ? 1.5 : 1) * (0.8 + rnd() * 0.4)); }
  tube(B, pts, rad, sides, { part: 0, swayK: 0.15, swayH: H, hash: rnd() });
  const top = pts[segs], cc = V(top.x, H * 0.9, top.z);
  const r = 4.2 + rnd() * 1.6;
  blob(B, V(top.x, H + 0.4, top.z), r, r * 0.34, r * (0.9 + rnd() * 0.2), rnd, { massC: cc, massK: 0.2, sway: 0.2, shade0: 0.0, shadeK: 0.9, droop: 0.55, noise: 0.14, flatBottom: 0.5, uvScale: 4 });
  if (!lod) {
    for (let k = 0; k < 2; k++) {
      const t = 0.45 + 0.2 * k + rnd() * 0.08, f = t * segs, i = Math.min(segs - 1, Math.floor(f)), p = pts[i].clone().lerp(pts[i + 1], f - i);
      const a = rnd() * 6.283, rr = 1.4 + rnd() * 0.9;
      blob(B, V(p.x + Math.cos(a) * 1.3, p.y, p.z + Math.sin(a) * 1.3), rr, rr * 0.32, rr, rnd, { massC: cc, massK: 0.2, sway: 0.2, shade0: 0.15, shadeK: 0.9, droop: 0.5, noise: 0.14, flatBottom: 0.5, uvScale: 2 });
    }
  }
  return B.build();
}

// A crystal cluster: a few tilted, tapering prisms (thin = reed-like needles).
export function crystalGeometry(seed, lod, thin) {
  const rnd = mulberry32(seed), B = new Builder();
  const n = lod ? 2 : (thin ? 5 : 4) + ((rnd() * 2) | 0);
  for (let i = 0; i < n; i++) {
    const a = rnd() * 6.283, tilt = (i === 0 ? 0.08 : 0.2 + rnd() * 0.5) * (thin ? 0.35 : 1);
    const H = (thin ? 5 + rnd() * 3.5 : 2.6 + rnd() * 3.4) * (i === 0 ? 1.25 : 0.8), r0 = thin ? 0.09 + rnd() * 0.06 : 0.38 + rnd() * 0.34;
    const off = i === 0 ? 0 : (thin ? 0.4 : 0.6) + rnd() * 0.5;
    const bx = Math.cos(a) * off, bz = Math.sin(a) * off, dx = Math.cos(a) * Math.sin(tilt), dz = Math.sin(a) * Math.sin(tilt), dy = Math.cos(tilt);
    // needles bow a little and thicken unevenly: a brush stroke, not a ruled line
    const bow = (thin ? 0.09 : 0.035) * H * (rnd() - 0.5) * 2, ba = rnd() * 6.283, ox = Math.cos(ba) * bow, oz = Math.sin(ba) * bow;
    const pts = [], rad = [], ns = lod ? 2 : 4;
    for (let q = 0; q <= ns; q++) {
      const tq = q / ns, arc = Math.sin(Math.PI * tq);
      pts.push(V(bx + dx * H * tq + ox * arc, q === 0 ? -0.2 : dy * H * tq, bz + dz * H * tq + oz * arc));
      rad.push(q === ns ? 0.02 : r0 * (1 - 0.30 * tq) * (0.85 + 0.3 * rnd()));
    }
    tube(B, pts, rad, lod ? 5 : 7, { part: 4, shade: 0.25 + 0.5 * rnd(), sway0: 0, hash: rnd() });
  }
  return B.build();
}

// A pinnacle of rock or ice: one tall tapering form, wind-carved. spec.slim: a slender needle
// that leans downwind and hooks over at the tip.
export function spireGeometry(seed, lod, spec) {
  const rnd = mulberry32(seed), B = new Builder();
  const slim = spec && spec.slim;
  const H = slim ? 8 + rnd() * 5 : 9 + rnd() * 6, r = slim ? 1.05 + rnd() * 0.5 : 2.0 + rnd() * 1.0;
  const base = B.count;
  blob(B, V((rnd() - 0.5) * 0.6, H * 0.46, (rnd() - 0.5) * 0.6), r, H * 0.56, r * (0.8 + rnd() * 0.4), rnd, { detail: lod ? 1 : 2, part: 4, noise: slim ? 0.30 : 0.24, massK: 0, sway: 0, shade0: 0.05, shadeK: 0.9, taper: slim ? 0.80 : 0.86, flatBottom: 0.2, uvScale: 2 });
  if (!lod) blob(B, V(1.6 + rnd(), H * 0.16, (rnd() - 0.5) * 2), r * 0.6, H * (slim ? 0.32 : 0.2), r * 0.6, rnd, { detail: 1, part: 4, noise: 0.25, massK: 0, sway: 0, shade0: 0.2, shadeK: 0.8, taper: 0.8, uvScale: 1 });
  if (slim) {
    // carved by one wind: the whole form leans along +Z, the more the higher, and the tip hooks
    const lean = 0.22 + rnd() * 0.16;
    for (let i = base; i < B.count; i++) { const t = Math.max(0, B.p[i * 3 + 1] / H); B.p[i * 3 + 2] += t * t * H * lean; B.p[i * 3 + 1] -= t * t * t * H * 0.07; B.p[i * 3] *= 1 - 0.25 * Math.sin(t * 9 + seed) * (1 - t); }
  }
  return B.build();
}

// Kelp: tall ribbons that sway.
export function kelpGeometry(seed, lod) {
  const rnd = mulberry32(seed), B = new Builder();
  const n = lod ? 4 : 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.283 + rnd(), dir = V(Math.cos(a), 0, Math.sin(a)), r0 = rnd() * 0.7;
    stroke(B, V(dir.x * r0, 0, dir.z * r0), dir, 6 + rnd() * 6, 0.13 + rnd() * 0.12, 0.10 + rnd() * 0.2, rnd, { segs: lod ? 3 : 6, leaf: 1, sway: 1.6 });
  }
  return B.build();
}

// A frozen wave: a long back rising to a crest whose lip curls over a hollow, caught in ice.
// A profile (back toe, crest, lip, hollow, front toe) swept along the crest line, tapering
// and swinging forward toward both ends. Local +Z is the way the wave was running.
export function waveGeometry(seed, lod) {
  const rnd = mulberry32(seed), B = new Builder();
  const H = 6.5 + rnd() * 4.5, L = 9 + rnd() * 6, lean = 1.0 + rnd() * 0.5;
  // [z, y, shade] across the wave, in units of H
  const P = lod
    ? [[-0.80, 0, 0.75], [-0.25, 0.70, 0.4], [0.15, 1.0, 0.0], [0.62 * lean, 0.72, 0.2], [0.24, 0.36, 0.95], [0.40, 0, 0.7]]
    : [[-0.80, 0, 0.75], [-0.52, 0.34, 0.6], [-0.24, 0.72, 0.4], [0.02, 0.95, 0.15], [0.28 * lean, 1.0, 0.0], [0.56 * lean, 0.88, 0.05], [0.70 * lean, 0.66, 0.2], [0.62 * lean, 0.50, 0.5], [0.36, 0.48, 0.9], [0.16, 0.24, 1.0], [0.40, 0, 0.7]];
  const st = lod ? 4 : 8, np = P.length;
  const rows = [];
  for (let i = 0; i <= st; i++) {
    const a = i / st, xx = (a - 0.5) * L;
    const k = (0.42 + 0.58 * Math.pow(Math.sin(Math.PI * (0.04 + 0.92 * a)), 0.45)) * (0.85 + 0.25 * rnd());     // lower toward the ends, where the curl shows in profile
    const fwd = (Math.abs(a - 0.5) * 2) ** 2 * 1.6 + (rnd() - 0.5) * 0.3;                         // the ends run ahead
    const row = [];
    for (let j = 0; j < np; j++) {
      const z = P[j][0] * H * (0.75 + 0.25 * k) + fwd, y = P[j][1] * H * k;
      // normal: perpendicular to the profile, pointing out of the ice
      const p0 = P[Math.max(0, j - 1)], p1 = P[Math.min(np - 1, j + 1)];
      let ny = (p1[0] - p0[0]), nz = -(p1[1] - p0[1]); const l = Math.hypot(ny, nz) || 1; ny /= l; nz /= l;
      row.push(B.vert(xx + (rnd() - 0.5) * 0.25, y - (j === 0 || j === np - 1 ? 0.3 : 0), z, 0, ny, nz, 0, ny, nz, a * 3, j / (np - 1) * 2, 0, 4, P[j][2], 0.5));
    }
    rows.push(row);
  }
  for (let i = 0; i < st; i++) for (let j = 0; j < np - 1; j++) {
    const a = rows[i][j], b = rows[i + 1][j], c = rows[i][j + 1], d = rows[i + 1][j + 1];
    B.tri(a, c, b); B.tri(b, c, d);
  }
  return B.build();
}

// A hanging garden: a mound of leaves on the lip of a cliff and a curtain of trailing strands
// falling down its face. Local +Z points out over the edge; the strands hang below y = 0.
export function vineGeometry(seed, lod) {
  const rnd = mulberry32(seed), B = new Builder();
  const cc = V(0, 0.6, 0.6);
  const mounds = lod ? 1 : 3;
  for (let i = 0; i < mounds; i++) {
    const r = 1.5 + rnd() * 0.9, x0 = lod ? 0 : (i - 1) * 2.6 + (rnd() - 0.5);
    blob(B, V(x0, 0.35 + rnd() * 0.4, 1.0 + rnd() * 0.8), r * (lod ? 2.0 : 1.15), r * 0.62, r * 0.9, rnd, { massC: cc, massK: 0.5, sway: 0.15, shade0: 0.1, shadeK: 0.7, droop: 0.5, noise: 0.3, uvScale: 3 });
  }
  const n = lod ? 5 : 9;
  for (let i = 0; i < n; i++) {
    const x0 = ((i + 0.5) / n - 0.5) * 8.4 + (rnd() - 0.5) * 0.8, L = 6 + rnd() * 11, w0 = 0.40 + rnd() * 0.34;
    const segs = lod ? 3 : 6, ph = rnd() * 6.283, out = 0.7 + rnd() * 0.7, hh = rnd();
    let pl = -1, pr = -1;
    for (let k = 0; k <= segs; k++) {
      const t = k / segs;
      const px = x0 + Math.sin(ph + t * 3.3) * 0.38 * t, py = 0.5 - L * (t * t * 0.35 + t * 0.65) - (t === 0 ? 0 : 0.2), pz = out * Math.min(1, t * 4) * 1.6 + 0.9 + t * L * 0.30 + Math.cos(ph + t * 2.1) * 0.2;
      const w = w0 * (1 - 0.6 * t) * (k === segs ? 0.25 : 1);
      const a = B.vert(px - w, py, pz, 0, 0.25, 0.97, 0, 0.3, 0.95, 0, 1 - t, 0.25 + 1.6 * t * t, 2, 0, hh);
      const b = B.vert(px + w, py, pz, 0, 0.25, 0.97, 0, 0.3, 0.95, 1, 1 - t, 0.25 + 1.6 * t * t, 2, 0, hh);
      if (k > 0) { B.tri(pl, pr, a); B.tri(pr, b, a); }
      pl = a; pr = b;
      // garlands of leaves along the strand, a flower here and there
      if (!lod && k > 0 && k < segs && rnd() < 0.55) {
        const r = 0.45 + rnd() * 0.45, fl = rnd() < 0.3;
        blob(B, V(px + (rnd() - 0.5) * 0.4, py, pz + 0.15), r * (fl ? 0.6 : 1), r * (fl ? 0.5 : 0.8), r * 0.6, rnd, { detail: 0, part: fl ? 3 : 1, massC: V(px, py, pz - 2), massK: 0.3, sway: 0.25 + 1.6 * t * t, shade0: 0.15 + 0.4 * t, shadeK: 0.6, noise: 0.3, uvScale: 2 });
      }
    }
  }
  return B.build();
}

// A small crystal shard cluster for the undergrowth.
export function shardGeometry(seed) {
  const rnd = mulberry32(seed), B = new Builder();
  for (let i = 0; i < 3; i++) {
    const a = rnd() * 6.283, tilt = 0.15 + rnd() * 0.6, H = 0.35 + rnd() * 0.55, r0 = 0.07 + rnd() * 0.07, off = i ? 0.12 + rnd() * 0.12 : 0;
    const bx = Math.cos(a) * off, bz = Math.sin(a) * off, dx = Math.cos(a) * Math.sin(tilt), dz = Math.sin(a) * Math.sin(tilt), dy = Math.cos(tilt);
    tube(B, [V(bx, -0.05, bz), V(bx + dx * H * 0.7, dy * H * 0.7, bz + dz * H * 0.7), V(bx + dx * H, dy * H, bz + dz * H)], [r0, r0 * 0.8, 0.008], 4, { part: 4, shade: 0.3 + 0.4 * rnd(), hash: rnd() });
  }
  return B.build();
}

export const TALL_KITS = {
  broadleaf: birchGeometry, conifer: pineGeometry, fungus: fungusGeometry,
  crystal: (seed, lod, spec) => crystalGeometry(seed, lod, spec && spec.thin), spire: (seed, lod, spec) => spireGeometry(seed, lod, spec), kelp: kelpGeometry, wave: waveGeometry, vine: vineGeometry,
};
