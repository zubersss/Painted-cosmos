// Painted Cosmos: the explorer and the ship. OWNER: PAINTER.
// Contract (COORDINATOR C10): explorer about 1.8 m tall, origin at the feet, facing -Z, +Y up.
// Ship about 9 m long, origin at the centre of the landing-gear contact plane (pads where
// PHYSICS' legs stand: (0, 0, -3.2) and (+-2.2, 0, 1.8)), nose toward -Z; object3D.userData.seat
// and .hatch are local points. animate(state, dt) ignores unknown fields and defaults missing ones.
//
// Both are painted, not modelled: every form is a soft lofted shape with a hand-wobbled
// surface (no primitive is left ruler-true), the local washes are vertex colours from one
// small palette (canvas cream, indigo-sepia, grey-blue, copper, and a single red accent that
// the scarf, the hat band, the fin and the wing tips share), and each figure is ONE mesh whose
// parts are moved by a matrix palette (render/materials.js, makeFigureMaterial).
import * as THREE from 'three';
import { makeFigureMaterial } from '../render/materials.js';
import { MOTION, G } from '../render/shared.js';

// ---- small vector and noise helpers ---------------------------------------------------------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
function hash3(x, y, z) { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); }
function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  let fx = x - xi, fy = y - yi, fz = z - zi;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t;
  return L(L(L(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), fx), L(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), fx), fy),
    L(L(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), fx), L(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), fx), fy), fz);
}
// Catmull-Rom through rows of numbers
function spline(keys, sub_) {
  const out = [];
  for (let i = 0; i < keys.length - 1; i++) {
    const p0 = keys[Math.max(0, i - 1)], p1 = keys[i], p2 = keys[i + 1], p3 = keys[Math.min(keys.length - 1, i + 2)];
    for (let s = 0; s < sub_; s++) {
      const t = s / sub_, t2 = t * t, t3 = t2 * t;
      out.push(p1.map((_, j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  out.push(keys[keys.length - 1].slice());
  return out;
}

// ---- the palette (washes as they should look on paper) -----------------------------------------
const CREAM = hex('#e4d4ae'), HEM = hex('#b79a70'), INK = hex('#3d4056'), TROUSER = hex('#6a6170');
const PACK = hex('#6c7b8d'), ROLL = hex('#efe6cf'), COPPER = hex('#a9683f'), RED = hex('#c8452e');
const FLESH = hex('#e9c9a6'), HAIR = hex('#5b4634'), GLASS = hex('#8eaab6'), OCHRE = hex('#c9914e');
const SEPIA = hex('#6f4e3a'), KEEL = hex('#86674b'), FLAME0 = [1, 0.99, 0.94], FLAME1 = hex('#f6c871'), FLAME2 = hex('#e79a52');

// ---- geometry kit: lofted soft forms into one buffer ------------------------------------------
function makeBuilder() {
  const P = [], C = [], M = [], Q = [], I = [];
  const B = { part: 0 };
  // rings: [{ c, u, v, ru, rv, e }] (centre, two axes, two radii, superellipse exponent)
  // o: seg, col ([r,g,b] or fn(p, t, a, ring)), dry, wet, glow, lump (m), freq, closed, warp(p, a, t, ring), cap
  B.loft = (rings, o = {}) => {
    const seg = o.seg || 12, base = P.length / 3, n = rings.length;
    const col = typeof o.col === 'function' ? o.col : () => o.col || CREAM;
    const lump = o.lump == null ? 0.012 : o.lump, freq = o.freq || 3.3, seed = (base * 0.371) % 19;
    const dry = o.dry == null ? 0.5 : o.dry, wet = o.wet == null ? 0.12 : o.wet, glow = o.glow || 0;
    const put = (p, c, t, a, ring) => {
      const cc = col(p, t, a, ring), j = glow ? 1 : 0.93 + 0.14 * noise3(p[0] * 2.1 + seed, p[1] * 2.1, p[2] * 2.1 + 7.7);
      P.push(p[0], p[1], p[2]); C.push(Math.min(1, cc[0] * j), Math.min(1, cc[1] * j), Math.min(1, cc[2] * j)); M.push(dry, wet, glow); Q.push(B.part);
    };
    for (let i = 0; i < n; i++) {
      const r = rings[i], e = r.e || 2, t = i / (n - 1);
      for (let k = 0; k < seg; k++) {
        const a = (k / seg) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        const cu = Math.sign(ca) * Math.pow(Math.abs(ca), 2 / e) * r.ru, sv = Math.sign(sa) * Math.pow(Math.abs(sa), 2 / e) * r.rv;
        let p = [r.c[0] + r.u[0] * cu + r.v[0] * sv, r.c[1] + r.u[1] * cu + r.v[1] * sv, r.c[2] + r.u[2] * cu + r.v[2] * sv];
        if (o.warp) p = o.warp(p, a, t, r) || p;
        // the hand: the surface wanders a little, anchored to the form
        if (lump) p = add(p, mul(norm(sub(p, r.c)), lump * 2 * (noise3(p[0] * freq + seed, p[1] * freq + 3.1, p[2] * freq) - 0.5)));
        put(p, null, t, a, r);
      }
    }
    const first = I.length;
    const quad = (i0, i1) => { for (let k = 0; k < seg; k++) { const a = base + i0 * seg + k, b = base + i0 * seg + (k + 1) % seg, c = base + i1 * seg + k, d = base + i1 * seg + (k + 1) % seg; I.push(a, b, c, b, d, c); } };
    for (let i = 0; i < n - 1; i++) quad(i, i + 1);
    if (o.closed) quad(n - 1, 0);
    else {
      const capK = o.cap == null ? 0.3 : o.cap;
      const apex = (i, j, flip) => {
        const p = add(rings[i].c, mul(sub(rings[i].c, rings[j].c), capK)), v = P.length / 3;
        put(p, null, i ? 1 : 0, 0, rings[i]);
        for (let k = 0; k < seg; k++) { const a = base + i * seg + k, b = base + i * seg + (k + 1) % seg; if (flip) I.push(a, v, b); else I.push(a, b, v); }
      };
      apex(0, 1, true); apex(n - 1, n - 2, false);
    }
    // face the washes outward: a closed form has a positive volume
    let vol = 0;
    for (let q = first; q < I.length; q += 3) {
      const a = I[q] * 3, b = I[q + 1] * 3, c = I[q + 2] * 3;
      vol += P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c]);
    }
    if (vol < 0) for (let q = first; q < I.length; q += 3) { const s = I[q + 1]; I[q + 1] = I[q + 2]; I[q + 2] = s; }
  };
  // rings along a path of points; rad(i, t) -> radius or [ru, rv]; o.ref = wished first axis
  B.path = (pts, rad, o = {}) => {
    const n = pts.length, rings = [];
    for (let i = 0; i < n; i++) {
      const a = o.closed ? pts[(i - 1 + n) % n] : pts[Math.max(0, i - 1)], b = o.closed ? pts[(i + 1) % n] : pts[Math.min(n - 1, i + 1)];
      const w = norm(sub(b, a));
      let u = o.ref ? o.ref.slice() : (Math.abs(w[0]) < 0.8 ? [1, 0, 0] : [0, 0, 1]);
      u = norm(sub(u, mul(w, dot(u, w))));
      const r = typeof rad === 'function' ? rad(i, i / (n - 1)) : rad;
      rings.push({ c: pts[i], u, v: cross(w, u), ru: r.length ? r[0] : r, rv: r.length ? r[1] : r, e: o.e || 2 });
    }
    B.loft(rings, o);
  };
  // a limb: a tube from A to B with rounded ends
  B.capsule = (A, Bp, rA, rB, o = {}) => {
    const w = norm(sub(Bp, A)), pts = [], rr = [], mid = o.mid == null ? 2 : o.mid;
    for (const th of [0.42, 0.95]) { pts.push(add(A, mul(w, -rA * Math.cos(th)))); rr.push(rA * Math.sin(th)); }
    for (let i = 0; i <= mid + 1; i++) { const t = i / (mid + 1); pts.push(lerp3(A, Bp, t)); rr.push((rA + (rB - rA) * t) * (1 + (o.bulge || 0) * Math.sin(Math.PI * t))); }
    for (const th of [0.95, 0.42]) { pts.push(add(Bp, mul(w, rB * Math.cos(th)))); rr.push(rB * Math.sin(th)); }
    B.path(pts, (i) => (o.flat ? [rr[i], rr[i] * o.flat] : rr[i]), o);
  };
  // a soft lump: an ellipsoid (rings along Y), e > 2 squares it toward a cushion
  B.blob = (c, rx, ry, rz, o = {}) => {
    const rings = [], m = o.rings || 7;
    for (let i = 0; i < m; i++) {
      const th = Math.PI * (0.11 + 0.78 * (i / (m - 1))), s = Math.pow(Math.sin(th), 2 / (o.ey || 2));
      rings.push({ c: [c[0], c[1] - ry * Math.cos(th), c[2]], u: [1, 0, 0], v: [0, 0, 1], ru: rx * s, rv: rz * s, e: o.e || 2 });
    }
    B.loft(rings, o);
  };
  B.build = (center, radius) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    g.setAttribute('aMat', new THREE.Float32BufferAttribute(M, 3));
    g.setAttribute('aPart', new THREE.Float32BufferAttribute(Q, 1));
    g.setIndex(I);
    g.computeVertexNormals();
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(center[0], center[1], center[2]), radius);
    return g;
  };
  return B;
}

// ---- rig: a few pivots; the mesh follows them through the material's matrix palette ------------
function makeRig(defs, mats) {
  const root = new THREE.Object3D(), bones = {}, list = [];
  for (const d of defs) {
    const b = new THREE.Object3D(), par = d.parent ? bones[d.parent] : null;
    b.userData.pivot = d.pivot;
    b.position.set(d.pivot[0] - (par ? par.userData.pivot[0] : 0), d.pivot[1] - (par ? par.userData.pivot[1] : 0), d.pivot[2] - (par ? par.userData.pivot[2] : 0));
    b.userData.rest = b.position.clone();
    b.userData.bindInv = new THREE.Matrix4().makeTranslation(-d.pivot[0], -d.pivot[1], -d.pivot[2]);
    (par || root).add(b); bones[d.name] = b; list.push(b);
  }
  const update = () => {
    root.updateMatrixWorld(true);
    for (let i = 0; i < list.length; i++) mats[i].multiplyMatrices(list[i].matrixWorld, list[i].userData.bindInv);
  };
  return { bones, update };
}
const mixc = (a, b, t) => lerp3(a, b, clamp01(t));

// =================================================================================================
// The explorer: a travelling painter. Broad soft hat, long canvas coat, a pack with a rolled
// sheet on top and two small jet bottles, a red scarf.
// =================================================================================================
export function createExplorer() {
  const B = makeBuilder();
  const X = [1, 0, 0], Z = [0, 0, 1];
  const ringsY = (rows) => rows.map((r) => ({ c: [r[3] || 0, r[0], r[4] || 0], u: X, v: Z, ru: r[1], rv: r[2], e: r[5] || 2.2 }));
  const coat = (p) => (p[1] > 0.985 && p[1] < 1.045 ? SEPIA : mixc(CREAM, HEM, sstep(1.05, 0.55, p[1]) * 0.85));

  // 0 torso: upper coat, collar, scarf round the neck, pack, rolled sheet, jet bottles
  B.part = 0;
  B.loft(ringsY([[1.00, 0.165, 0.130], [1.10, 0.172, 0.136], [1.24, 0.192, 0.142], [1.34, 0.205, 0.132], [1.41, 0.150, 0.112], [1.46, 0.078, 0.072]]), { seg: 14, col: coat, lump: 0.010 });
  { // scarf: a soft ring round the neck
    const pts = []; for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; pts.push([Math.cos(a) * 0.088, 1.452 + Math.sin(a * 2) * 0.008, Math.sin(a) * 0.082 + 0.005]); }
    B.path(pts, 0.036, { seg: 7, closed: true, col: RED, lump: 0.006, dry: 0.3 });
  }
  B.blob([0, 1.19, 0.215], 0.158, 0.215, 0.088, { seg: 12, e: 3.0, ey: 2.6, col: (p) => mixc(PACK, hex('#8a98a6'), sstep(1.22, 1.38, p[1])), lump: 0.010 });
  B.capsule([-0.205, 1.44, 0.21], [0.205, 1.44, 0.21], 0.064, 0.060, { seg: 9, col: (p) => mixc(ROLL, HEM, sstep(0.17, 0.23, Math.abs(p[0])) * 0.7), lump: 0.006, dry: 0.7 });
  for (const s of [-1, 1]) {
    B.capsule([s * 0.19, 1.22, 0.235], [s * 0.19, 1.00, 0.235], 0.054, 0.050, { seg: 8, col: (p) => mixc(COPPER, SEPIA, 0.15 + 0.4 * sstep(1.12, 1.0, p[1])), lump: 0.005 });
    B.capsule([s * 0.19, 0.975, 0.235], [s * 0.19, 0.935, 0.235], 0.028, 0.044, { seg: 7, col: INK, lump: 0, mid: 0 });
  }
  // 1 head: face, hair, the hat with its band
  B.part = 1;
  B.blob([0, 1.585, 0], 0.112, 0.125, 0.118, { seg: 12, col: (p) => (p[2] < -0.04 && p[1] < 1.66 ? FLESH : HAIR), lump: 0.004, dry: 0.2 });
  B.loft(ringsY([[1.652, 0.06, 0.06], [1.658, 0.305, 0.315, 0, 0.01], [1.672, 0.318, 0.33, 0, 0.01], [1.688, 0.29, 0.30, 0, 0.01], [1.690, 0.142, 0.146], [1.715, 0.136, 0.14], [1.76, 0.128, 0.132], [1.80, 0.098, 0.102], [1.815, 0.05, 0.05]]), {
    seg: 16, lump: 0.007, cap: 0.15, dry: 0.35,
    col: (p) => (Math.hypot(p[0], p[2]) < 0.17 && p[1] > 1.688 && p[1] < 1.722 ? RED : INK),
    warp: (p, a, t, r) => {
      if (r.ru < 0.2) return [p[0] + (p[1] - 1.69) * 0.06, p[1], p[2] + (p[1] - 1.69) * 0.10];     // the crown leans back a little
      const k = 1 + 0.05 * Math.sin(2 * a + 0.6) + 0.035 * Math.sin(5 * a + 1.1);                     // a brim shaped by hand and weather
      return [p[0] * k, p[1] - 0.034 * Math.sin(a) * Math.sin(a) + 0.012 * Math.sin(3 * a + 1), p[2] * k];
    },
  });
  // 2, 3 arms: sleeve and a pale hand
  for (const s of [-1, 1]) {
    B.part = s < 0 ? 2 : 3;
    B.path([[s * 0.222, 1.385, 0], [s * 0.232, 1.33, 0], [s * 0.252, 1.12, -0.012], [s * 0.255, 0.95, -0.045], [s * 0.252, 0.875, -0.062]], (i) => [0.03, 0.066, 0.060, 0.052, 0.044][i], { seg: 9, col: (p) => mixc(CREAM, HEM, 0.25 + sstep(1.0, 0.86, p[1]) * 0.4), lump: 0.006 });
    B.blob([s * 0.252, 0.842, -0.068], 0.040, 0.050, 0.044, { seg: 8, rings: 5, col: FLESH, lump: 0.003, dry: 0.2 });
  }
  // 4 skirt of the coat, with a hem that waves; closed underneath in shadow
  B.part = 4;
  B.loft(ringsY([[1.03, 0.160, 0.126], [0.96, 0.186, 0.150], [0.84, 0.220, 0.190], [0.70, 0.250, 0.222], [0.585, 0.272, 0.244], [0.555, 0.262, 0.236], [0.60, 0.14, 0.12]]), {
    seg: 16, lump: 0.012, cap: 0.0,
    col: (p, t) => (t > 0.9 ? mixc(INK, SEPIA, 0.5) : coat(p)),
    warp: (p, a, t) => { const k = sstep(0.95, 0.56, p[1]); return [p[0] * (1 + k * 0.09 * Math.sin(3 * a + 0.4)), p[1] + k * (0.032 * Math.sin(4 * a + 1.3) + 0.018 * Math.sin(7 * a)), p[2] * (1 + k * 0.09 * Math.sin(3 * a + 0.4))]; },
  });
  // 5 the scarf's tail, over the pack
  B.part = 5;
  B.path([[-0.05, 1.45, 0.10], [-0.06, 1.445, 0.22], [-0.07, 1.38, 0.325], [-0.085, 1.22, 0.338], [-0.075, 1.06, 0.334], [-0.09, 0.95, 0.326]], (i) => [[0.030, 0.018], [0.046, 0.016], [0.054, 0.015], [0.060, 0.014], [0.064, 0.014], [0.046, 0.012]][i], { seg: 8, col: RED, lump: 0.004, ref: X, dry: 0.3 });
  // 6..9 legs: thigh, shin and boot
  for (const s of [-1, 1]) {
    B.part = s < 0 ? 6 : 7;
    B.capsule([s * 0.095, 0.90, 0], [s * 0.095, 0.48, 0], 0.088, 0.070, { seg: 9, col: TROUSER, lump: 0.006 });
    B.part = s < 0 ? 8 : 9;
    B.capsule([s * 0.095, 0.48, 0], [s * 0.095, 0.11, 0.008], 0.069, 0.060, { seg: 9, col: (p) => mixc(INK, TROUSER, sstep(0.22, 0.34, p[1])), lump: 0.005 });
    B.blob([s * 0.097, 0.062, -0.042], 0.074, 0.062, 0.128, { seg: 9, rings: 5, col: INK, lump: 0.004, dry: 0.25 });
  }
  // 10 the two jets under the bottles: bare paper running into warm colour
  B.part = 10;
  for (const s of [-1, 1]) {
    B.path([[s * 0.19, 0.935, 0.235], [s * 0.19, 0.86, 0.237], [s * 0.19, 0.72, 0.242], [s * 0.19, 0.56, 0.25]], (i) => [0.034, 0.058, 0.046, 0.018][i], { seg: 7, lump: 0, glow: 1, wet: 0.9, cap: 0.5, col: (p) => (p[1] > 0.84 ? mixc(FLAME1, FLAME0, sstep(0.84, 0.9, p[1])) : mixc(FLAME2, FLAME1, sstep(0.56, 0.84, p[1]))) });
  }

  const mat = makeFigureMaterial({ parts: 11, scale: 0.42, pooling: 0.55, stroke: 2.6 });
  const mesh = new THREE.Mesh(B.build([0, 0.95, 0], 1.9), mat);
  mesh.name = 'explorer-figure';
  const g = new THREE.Group(); g.name = 'explorer'; g.add(mesh);
  g.userData.height = 1.82; g.userData.pcCaster = 'explorer';

  const rig = makeRig([
    { name: 'torso', pivot: [0, 0.90, 0] },
    { name: 'head', parent: 'torso', pivot: [0, 1.47, 0] },
    { name: 'armL', parent: 'torso', pivot: [-0.222, 1.375, 0] }, { name: 'armR', parent: 'torso', pivot: [0.222, 1.375, 0] },
    { name: 'skirt', parent: 'torso', pivot: [0, 1.01, 0] },
    { name: 'scarf', parent: 'torso', pivot: [-0.065, 1.44, 0.17] },
    { name: 'thighL', parent: 'torso', pivot: [-0.095, 0.89, 0] }, { name: 'thighR', parent: 'torso', pivot: [0.095, 0.89, 0] },
    { name: 'shinL', parent: 'thighL', pivot: [-0.095, 0.48, 0] }, { name: 'shinR', parent: 'thighR', pivot: [0.095, 0.48, 0] },
    { name: 'jet', parent: 'torso', pivot: [0, 0.935, 0.235] },
  ], mat.uniforms.uPart.value);
  const b = rig.bones;

  // pose weights (smoothed so one mode runs into the next) and the stride phase
  const w = { walk: 0, run: 0, jet: 0, fall: 0, wade: 0, sit: 0 };
  let t = 0, ph = 0, jetS = 0, first = true;
  function animate(state, dt) {
    const s = state || {};
    dt = Math.max(0, Math.min(0.1, dt || 0)); t += dt;
    const mode = s.mode || 'idle';
    const speed = s.speed == null ? (mode === 'walk' ? 1.4 : mode === 'wade' ? 0.8 : 0) : Math.max(0, s.speed);
    const moving = mode === 'walk' || mode === 'wade';
    const k = first || s.snap ? 1 : 1 - Math.exp(-9 * dt); first = false;
    const to = (key, v) => { w[key] += (v - w[key]) * k; };
    to('walk', moving ? clamp01(speed / 0.9) : 0); to('run', moving ? sstep(1.8, 4.2, speed) : 0);
    to('jet', mode === 'jet' ? 1 : 0); to('fall', mode === 'fall' ? 1 : 0); to('wade', mode === 'wade' ? 1 : 0); to('sit', mode === 'sit' ? 1 : 0);
    jetS += ((s.jet01 == null ? (mode === 'jet' ? 1 : 0) : s.jet01) - jetS) * k;
    // the stride matches the ground covered: one step is 0.45 m + 0.22 s of travel
    const step = Math.max(0.5, Math.min(1.5, 0.45 + 0.22 * speed));
    // PHYSICS' gait (P13), when the game passes it: `feet` [left, right] { fwd, up, side, down } (m ahead of the
    // body, off the ground), `ride` (m the hips are off their standing height, below negative: `hip` plus the
    // stride's bob), `stride` (0 .. 1, the left foot lands at 0), `surge` (m the body is ahead within the
    // stride). The boots are put where the feet are and the hips hung by `ride`: no walk cycle on a clock of
    // this figure's own (two clocks drift and the feet slide). Without them: the old cycle.
    const feet = Array.isArray(s.feet) && s.feet.length === 2 && s.feet[0] && s.feet[1] ? s.feet : null;
    const ride = Number.isFinite(s.ride) ? s.ride : Number.isFinite(s.hip) ? s.hip : 0, surge = Number.isFinite(s.surge) ? Math.max(-0.3, Math.min(0.3, s.surge)) : 0;
    if (s.phase != null) ph = s.phase; else if (feet && Number.isFinite(s.stride)) ph = 2 * Math.PI * s.stride + Math.PI / 2; else if (moving) ph += dt * Math.PI * speed / step;
    const A = Math.min(0.82, Math.asin(Math.min(0.95, step / 1.76))) * w.walk * (1 - 0.35 * w.wade);
    const air = Math.max(w.jet, w.fall), sit = w.sit, grounded = 1 - Math.max(air, sit);
    // PHYSICS' hips (`hip`: metres below standing height; about 0.3 for half a second after a landing): the knees
    // fold by the angle that lowers the hips that far, the back leans into it, and the figure straightens as it eases
    // (PHYSICS' `hip` is the leg's length less its standing length: NEGATIVE while the legs are folded. It was read
    // as positive here, so the figure never folded its knees after a landing.)
    w.hip = (w.hip || 0) + (Math.max(0, Math.min(0.5, -ride)) - (w.hip || 0)) * (first || s.snap || feet ? 1 : 1 - Math.exp(-22 * dt));
    const crouch = Math.acos(Math.max(0.3, 1 - w.hip / 0.86)) * (1 - sit);
    // (PHYSICS' jump crouch, `crouch01` 0..1 over the 0.12 s before the push: the back leans in and the arms go back,
    // the anticipation that makes the jump read; the hips' fall itself is in `ride`)
    const cr01 = Number.isFinite(s.crouch01) ? Math.max(0, Math.min(1, s.crouch01)) : 0;
    w.cr = (w.cr || 0) + (cr01 - (w.cr || 0)) * (first || s.snap ? 1 : 1 - Math.exp(-30 * dt));
    const lean = -(0.035 + 0.075 * w.run) * w.walk * grounded - 0.20 * w.jet * (0.4 + 0.6 * jetS) + 0.07 * w.fall - 0.10 * sit - 0.30 * crouch - 0.22 * w.cr;
    const L1 = 0.41, L2 = 0.48, hipY = L1 + L2 + Math.max(-0.5, Math.min(0.06, ride));
    const leg = (thigh, shin, phi, side, F) => {
      const sw = Math.max(0, Math.cos(phi));
      let th, kn;
      if (F) {
        // two bones to the boot: the swinging leg folds (the heel comes up toward the hip, most at a run), so
        // that a run's flight reads in the knee
        // (the heel is drawn up to about the other knee at a run: PHYSICS' lift is the foot's clearance, 0.18 m at 4.2 m/s;
        // four times it, as first written, knelt in the air)
        const up = F.down ? 0 : Math.min(0.30, Math.max(0, F.up || 0) * (1.4 + 1.3 * w.run));
        const dz = (F.fwd || 0) - surge, dy = Math.max(0.1, hipY - up);
        const D = Math.max(0.14, Math.min(L1 + L2 - 0.003, Math.hypot(dz, dy)));
        const knee = Math.PI - Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + L2 * L2 - D * D) / (2 * L1 * L2))));
        th = (Math.atan2(dz, dy) + Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + D * D - L2 * L2) / (2 * L1 * D)))) - lean) * grounded;
        kn = -knee * grounded;
      } else {
        th = A * Math.sin(phi) * grounded; kn = -(0.10 + (0.55 + 0.75 * w.run) * Math.pow(sw, 0.8)) * w.walk * grounded;
      }
      th += w.jet * (-0.22 - 0.07 * side + 0.03 * Math.sin(t * 2.3 + side)) + w.fall * (side < 0 ? 0.38 : -0.12) + sit * 1.45;
      kn += w.jet * (-0.42 - 0.1 * side) + w.fall * (side < 0 ? -0.55 : -0.85) - sit * 1.45;
      // at rest the weight is on one leg (with PHYSICS' feet too: standing, both boots are under the hips and the
      // figure may settle on one; it straightens out of it as the stride begins)
      const ease = (1 - w.walk) * grounded * (side < 0 ? 1 : 0.25) * (F ? 1 - w.cr : 1);
      thigh.rotation.x = th + 0.09 * ease + (F ? 0 : crouch); shin.rotation.x = kn - 0.17 * ease - (F ? 0 : 2 * crouch);
      thigh.rotation.z = side * (0.02 + 0.10 * w.fall + 0.04 * w.jet);
    };
    leg(b.thighL, b.shinL, ph, -1, feet && feet[0]); leg(b.thighR, b.shinR, ph + Math.PI, 1, feet && feet[1]);
    const breathe = Math.sin(t * 1.5);
    // hips: bob twice a stride (highest as the legs pass), lean into the walk, sink to sit
    // (with PHYSICS' gait the hips ride where it says: its bob, and the body a little ahead or behind within the stride)
    b.torso.position.y = b.torso.userData.rest.y + (feet ? Math.max(-0.5, Math.min(0.06, ride)) * (1 - sit) * (1 - air) : (Math.cos(2 * ph) * (0.014 + 0.026 * w.run) - 0.02 - 0.03 * w.run) * w.walk * grounded - w.hip * (1 - sit)) + breathe * 0.003 - sit * 0.40;
    b.torso.position.z = b.torso.userData.rest.z - (feet ? surge * grounded : 0);
    b.torso.rotation.x = lean;
    b.torso.rotation.y = 0.07 * Math.sin(ph) * w.walk * grounded;
    b.torso.rotation.z = (0.022 + Math.sin(t * 0.47) * 0.012) * (1 - w.walk) * grounded + 0.03 * Math.sin(ph) * w.walk * w.wade;
    const pitch = Math.max(-0.7, Math.min(0.7, s.lookPitch || 0));
    b.head.rotation.x = pitch * 0.55 - b.torso.rotation.x * 0.7 - 0.18 * w.fall;
    b.head.rotation.y = -b.torso.rotation.y * 0.8 + Math.sin(t * 0.31) * 0.10 * (1 - w.walk) * (1 - air);
    const arm = (bone, side, phi) => {
      bone.rotation.x = -Math.sin(phi) * (0.30 + 0.45 * w.run) * w.walk * grounded * (1 - 0.5 * w.wade) + 0.22 * w.run * w.walk + 0.25 * w.jet - 0.25 * w.fall + 0.55 * sit - 0.65 * w.cr;
      bone.rotation.z = side * (0.03 + 0.012 * breathe + 0.50 * crouch + 0.45 * w.jet + 1.95 * w.fall + 0.42 * w.wade * w.walk + 0.08 * Math.sin(t * 6.1 + side) * w.fall);
    };
    arm(b.armL, -1, ph); arm(b.armR, 1, ph + Math.PI);
    // the coat: streams back when moving, flares in the air
    const flutter = Math.sin(t * 7.3) * 0.5 + Math.sin(t * 11.9 + 1.3) * 0.5;
    b.skirt.rotation.x = -(0.07 + 0.16 * w.run) * w.walk * grounded + 0.045 * Math.sin(2 * ph + 0.6) * w.walk * grounded - 0.16 * w.jet + 0.03 * flutter * air + 0.75 * sit;
    b.skirt.rotation.z = 0.035 * Math.sin(ph + 0.4) * w.walk * grounded + Math.sin(t * 0.9) * 0.006;
    const fl = 1 + 0.10 * w.jet + 0.30 * w.fall + 0.05 * w.run * w.walk;
    b.skirt.scale.set(fl, 1 - 0.16 * w.fall - 0.25 * sit, fl + 0.06 * w.walk);
    b.scarf.rotation.x = -(0.25 * w.walk + 0.75 * w.run * w.walk) * grounded - 0.85 * w.jet - 2.45 * w.fall + (0.03 * Math.sin(t * 1.1) + 0.07 * flutter * Math.max(w.run * w.walk, air));
    b.scarf.rotation.z = 0.05 * Math.sin(t * 0.8) + 0.10 * flutter * Math.max(w.walk * 0.5, air);
    // the jets: the flame boils at about eight frames a second, never faster
    const boil = hash3(Math.floor(t * 8), 3.3, 1.7);
    const fs = jetS * (0.78 + 0.34 * boil);
    b.jet.scale.set(jetS > 0.02 ? 0.7 + 0.5 * jetS : 0.001, Math.max(0.001, fs), jetS > 0.02 ? 0.7 + 0.5 * jetS : 0.001);
    rig.update();
  }
  animate({ mode: 'idle' }, 0);
  G.figure = g;      // (the flora parts where it stands between the lens and the figure: see flora.js `_focus`)
  return { object3D: g, animate };
}

// =================================================================================================
// The ship: a hand-built flying skiff. A boat's planked hull under a canvas deck, a glass
// bubble on hoops, cloth wings on ribs, a red-tipped fin, two copper pots for engines, three
// legs with round pads, a rope ladder on the port side where the explorer boards.
// =================================================================================================
export function createShip() {
  const B = makeBuilder();
  const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
  // hull stations: z, half width, deck crown, depth of the belly, height of the gunwale
  const ST = spline([
    [-4.50, 0.12, 0.03, 0.09, 1.15], [-4.30, 0.48, 0.08, 0.34, 1.15], [-3.80, 0.88, 0.13, 0.56, 1.17], [-3.00, 1.20, 0.17, 0.71, 1.20],
    [-2.00, 1.40, 0.19, 0.79, 1.24], [-1.00, 1.47, 0.20, 0.82, 1.28], [0.20, 1.44, 0.20, 0.80, 1.33], [1.40, 1.28, 0.19, 0.72, 1.40],
    [2.50, 1.02, 0.17, 0.58, 1.50], [3.40, 0.72, 0.14, 0.42, 1.62], [4.10, 0.42, 0.10, 0.27, 1.74], [4.45, 0.18, 0.05, 0.12, 1.80]], 2);
  const station = (z) => { let i = 0; while (i < ST.length - 2 && ST[i + 1][0] < z) i++; const a = ST[i], c = ST[i + 1], t = clamp01((z - a[0]) / (c[0] - a[0])); return a.map((v, j) => v + (c[j] - v) * t); };

  // 0 the body
  B.part = 0;
  B.loft(ST.map((s) => ({ c: [0, s[4], s[0]], u: X, v: Y, ru: s[1], rv: s[3], e: 2.5, top: s[2] / s[3], gy: s[4] })), {
    seg: 36, lump: 0.022, freq: 1.3, cap: 0.25, dry: 0.7,
    warp: (p, a, t, r) => (p[1] > r.gy ? [p[0], r.gy + (p[1] - r.gy) * r.top, p[2]] : p),
    col: (p, t, a) => {
      const sa = Math.sin(a);
      if (Math.abs(sa) < 0.1) return mixc(SEPIA, INK, 0.35);                         // the gunwale: a dark rail along the sheer
      if (sa > 0) return mixc(CREAM, HEM, 0.18 + 0.25 * noise3(p[0] * 1.3, 4.4, p[2] * 0.9));   // canvas deck
      const strake = Math.floor((-sa) * 5.2 + 0.25 * Math.sin(p[2] * 0.8));         // planks: each strake its own load of ochre
      const patch = hash3(strake * 3.1, Math.floor(p[2] * 0.55 + strake * 0.37), 1.0);
      return mul(mixc(OCHRE, KEEL, sstep(0.55, 1.0, -sa) * 0.9), 0.90 + 0.16 * patch);
    },
  });
  // bow lantern
  B.blob([0, 1.19, -4.58], 0.10, 0.10, 0.10, { seg: 8, rings: 5, col: FLAME1, glow: 0.8, wet: 0.6, lump: 0 });
  // the cowl in front of the pilot, three dials, the seat back
  B.blob([0, 1.40, -2.02], 0.46, 0.155, 0.28, { seg: 18, rings: 9, e: 2.6, col: (p) => mixc(SEPIA, COPPER, sstep(1.44, 1.6, p[1]) * 0.6), lump: 0.012, dry: 0.3 });
  for (const x of [-0.20, 0, 0.20]) B.blob([x, 1.475 - Math.abs(x) * 0.10, -1.795 - Math.abs(x) * 0.06], 0.044, 0.044, 0.016, { seg: 14, rings: 7, col: (p, t) => (t < 0.16 || t > 0.84 ? INK : ROLL), lump: 0, dry: 0.1 });
  B.blob([0, 1.60, -0.74], 0.27, 0.33, 0.10, { seg: 10, e: 2.8, col: mixc(COPPER, SEPIA, 0.45), lump: 0.008 });
  // wings: cloth over ribs, the tips in the accent
  for (const s of [-1, 1]) {
    const rings = [];
    for (let i = 0; i <= 9; i++) {
      const q = i / 9, tip = sstep(0.86, 1.0, q);
      rings.push({ c: [s * (1.22 + 2.5 * q), 1.31 + 0.30 * q + 0.05 * q * q, 0.72 + 0.55 * q + 0.10 * tip], u: Z, v: Y, ru: (0.86 - 0.36 * q) * (1 - 0.45 * tip), rv: (0.090 - 0.045 * q) * (1 - 0.3 * tip), e: 2.0, i });
    }
    B.loft(rings, { seg: 12, lump: 0.012, freq: 2.2, cap: 0.12, dry: 0.75, col: (p, t, a, r) => (t > 0.8 ? RED : mixc(CREAM, HEM, (r.i % 2 ? 0.42 : 0.05) + 0.15 * sstep(0.2, -0.6, Math.cos(a)))) });
  }
  // fin and tailplanes
  {
    const rings = [];
    for (let i = 0; i <= 7; i++) { const q = i / 7, tip = sstep(0.8, 1.0, q); rings.push({ c: [0, 1.66 + 1.56 * q, 3.72 + 0.56 * q], u: Z, v: X, ru: (0.64 - 0.30 * q) * (1 - 0.4 * tip), rv: (0.055 - 0.02 * q), e: 2.0 }); }
    B.loft(rings, { seg: 10, lump: 0.010, cap: 0.15, dry: 0.75, col: (p, t) => (t > 0.60 ? RED : mixc(CREAM, HEM, 0.12)) });
    for (const s of [-1, 1]) {
      const rr = [];
      for (let i = 0; i <= 5; i++) { const q = i / 5, tip = sstep(0.75, 1.0, q); rr.push({ c: [s * (0.22 + 1.22 * q), 1.80 + 0.12 * q, 3.95 + 0.25 * q], u: Z, v: Y, ru: (0.42 - 0.15 * q) * (1 - 0.4 * tip), rv: 0.04 - 0.015 * q, e: 2.0 }); }
      B.loft(rr, { seg: 10, lump: 0.008, cap: 0.15, dry: 0.75, col: () => mixc(CREAM, HEM, 0.2) });
    }
  }
  // engines: two copper pots
  for (const s of [-1, 1]) {
    const rows = [[1.52, 0.10], [1.66, 0.30], [2.05, 0.43], [2.65, 0.47], [3.15, 0.39], [3.46, 0.31], [3.47, 0.25], [3.36, 0.16]];
    B.loft(rows.map((r) => ({ c: [s * 1.42, 1.22, r[0]], u: X, v: Y, ru: r[1], rv: r[1], e: 2.0 })), { seg: 14, lump: 0.014, freq: 2.6, cap: 0.2, dry: 0.4, col: (p, t) => (p[2] < 1.72 || t > 0.62 ? INK : mixc(COPPER, SEPIA, 0.25 * sstep(2.4, 3.3, p[2]))) });
  }
  // a bundle lashed to the after deck, and the rope ladder on the port side
  B.capsule([-0.55, 1.66, 1.25], [0.55, 1.66, 1.25], 0.17, 0.16, { seg: 9, col: (p) => (Math.abs(Math.abs(p[0]) - 0.3) < 0.06 ? SEPIA : PACK), lump: 0.014 });
  for (const z of [-0.80, -0.40]) B.capsule([-1.44, 1.27, z], [-1.76, 0.10, z], 0.026, 0.024, { seg: 6, col: SEPIA, lump: 0.01, mid: 3 });
  for (let i = 0; i < 4; i++) { const q = 0.16 + 0.22 * i, x = -1.44 - 0.32 * q, y = 1.27 - 1.17 * q; B.capsule([x, y, -0.83], [x, y, -0.37], 0.022, 0.022, { seg: 6, col: SEPIA, lump: 0.006, mid: 0 }); }

  // 1 the canopy: glass bubble on two hoops and a spine, hinged at the back
  B.part = 1;
  const CAN = { c: [0, 1.44, -1.25], rx: 0.70, ry: 0.80, rz: 1.18 };
  {
    const rings = [];
    for (let i = 0; i < 10; i++) { const th = Math.PI * (0.07 + 0.86 * (i / 9)), sn = Math.sin(th); rings.push({ c: [0, CAN.c[1], CAN.c[2] - CAN.rz * Math.cos(th)], u: X, v: Y, ru: CAN.rx * sn, rv: CAN.ry * sn, e: 2.1 }); }
    B.loft(rings, { seg: 20, lump: 0.010, freq: 1.8, wet: 0.45, dry: 0.0, cap: 0.2,
      col: (p, t, a) => { const up = sstep(1.45, 2.2, p[1]); const glint = sstep(0.55, 0.9, Math.cos(a - 2.2)) * sstep(0.25, 0.45, t) * sstep(0.75, 0.5, t); return mixc(mixc(GLASS, hex('#d9e6e9'), up), [1, 1, 1], glint); } });
    const hoop = (z, r) => { const k = Math.sqrt(Math.max(0, 1 - ((z - CAN.c[2]) / CAN.rz) ** 2)), pts = []; for (let i = 0; i <= 22; i++) { const a = Math.PI * (i / 22); pts.push([Math.cos(a) * (CAN.rx * k + 0.012), CAN.c[1] - 0.06 + Math.sin(a) * (CAN.ry * k + 0.072), z]); } B.path(pts, r, { seg: 7, col: SEPIA, lump: 0.006, ref: Z, dry: 0.3 }); };
    hoop(-1.95, 0.019); hoop(-1.25, 0.019); hoop(-0.55, 0.022);
    const sp = []; for (let i = 0; i <= 8; i++) { const z = -1.95 + (1.40 * i) / 8, k = Math.sqrt(Math.max(0, 1 - ((z - CAN.c[2]) / CAN.rz) ** 2)); sp.push([0, CAN.c[1] + CAN.ry * k + 0.012, z]); }
    B.path(sp, 0.017, { seg: 6, col: SEPIA, lump: 0.005, ref: X, dry: 0.3 });
  }
  // 2, 3, 4 the legs: strut, brace and a round pad each
  const PADS = [[0, -3.2], [-2.2, 1.8], [2.2, 1.8]], HIPS = [[0, 0.74, -3.02], [-1.22, 1.02, 1.66], [1.22, 1.02, 1.66]];
  for (let i = 0; i < 3; i++) {
    B.part = 2 + i;
    const pad = PADS[i], hip = HIPS[i];
    B.capsule(hip, [pad[0], 0.11, pad[1]], 0.070, 0.052, { seg: 8, col: mixc(INK, SEPIA, 0.3), lump: 0.008 });
    if (i) B.capsule([hip[0] * 0.92, 0.70, 1.28], lerp3(hip, [pad[0], 0.11, pad[1]], 0.62), 0.034, 0.030, { seg: 6, col: mixc(INK, SEPIA, 0.3), lump: 0.006 });
    B.blob([pad[0], 0.052, pad[1]], 0.27, 0.052, 0.27, { seg: 10, rings: 5, col: INK, lump: 0.010, dry: 0.3 });
  }
  // 5 the two flames
  B.part = 5;
  for (const s of [-1, 1]) {
    B.path([[s * 1.42, 1.22, 3.40], [s * 1.42, 1.22, 3.62], [s * 1.42, 1.22, 4.0], [s * 1.42, 1.22, 4.5]], (i) => [0.16, 0.24, 0.17, 0.05][i], { seg: 9, lump: 0, glow: 1, wet: 0.9, cap: 0.5, ref: X, col: (p) => (p[2] < 3.7 ? mixc(FLAME0, FLAME1, sstep(3.5, 3.7, p[2]) * 0.6) : mixc(FLAME1, FLAME2, sstep(3.7, 4.5, p[2]))) });
  }

  const mat = makeFigureMaterial({ parts: 6, scale: 1.5, pooling: 0.45, stroke: 0.9 });
  const mesh = new THREE.Mesh(B.build([0, 1.5, 0], 8.5), mat);
  mesh.name = 'ship-figure';
  const g = new THREE.Group(); g.name = 'ship'; g.add(mesh);
  g.userData.seat = new THREE.Vector3(0, 1.75, -1.3);
  g.userData.hatch = new THREE.Vector3(-2.3, 0, -0.6);
  g.userData.pcCaster = 'ship';

  const rig = makeRig([
    { name: 'body', pivot: [0, 0, 0] },
    { name: 'canopy', parent: 'body', pivot: [0, 1.47, -0.02] },
    { name: 'leg0', parent: 'body', pivot: HIPS[0] }, { name: 'leg1', parent: 'body', pivot: HIPS[1] }, { name: 'leg2', parent: 'body', pivot: HIPS[2] },
    { name: 'flame', parent: 'body', pivot: [0, 1.22, 3.40] },
  ], mat.uniforms.uPart.value);
  const b = rig.bones;
  let t = 0, thr = 0, hov = 0, first = true;
  function animate(state, dt) {
    const s = state || {};
    dt = Math.max(0, Math.min(0.1, dt || 0)); t += dt;
    const mode = s.mode || 'landed';
    const k = first || s.snap ? 1 : 1 - Math.exp(-6 * dt); first = false;
    const gear = clamp01(s.gear01 == null ? (mode === 'landed' || mode === 'hover' ? 1 : 0) : s.gear01);
    const can = clamp01(s.canopy01 || 0);
    // (the world lays the pulse drive's streaks over the sky while this says so)
    MOTION.pulse = mode === 'pulse'; MOTION.pulseAt = performance.now();
    const want = mode === 'pulse' ? 2.6 : mode === 'landed' ? clamp01(s.throttle01 || 0) * 0.5 : 0.22 + 0.9 * clamp01(s.throttle01 == null ? (mode === 'fly' ? 0.6 : 0.15) : s.throttle01);
    thr += (want - thr) * k; hov += ((mode === 'hover' ? 1 : 0) - hov) * k;
    // gear: the legs fold away as it comes up (nose leg back under the belly, the outriggers up to the wings)
    const f = 1 - gear, sc = gear > 0.02 ? 0.55 + 0.45 * gear : 0.001;
    b.leg0.rotation.x = -1.35 * f; b.leg1.rotation.z = -1.0 * f; b.leg2.rotation.z = 1.0 * f;
    b.leg0.scale.setScalar(sc); b.leg1.scale.setScalar(sc); b.leg2.scale.setScalar(sc);
    b.canopy.rotation.x = 0.95 * can;
    // hovering: a slow breathing bob, a hint of roll
    b.body.position.y = hov * Math.sin(t * 1.7) * 0.06;
    b.body.rotation.z = hov * Math.sin(t * 1.1) * 0.012;
    // thrust: paper-white flames that boil at eight frames a second; long and thin in a pulse
    const boil = hash3(Math.floor(t * 8), 7.1, 2.9);
    const wide = thr > 0.02 ? (mode === 'pulse' ? 0.8 : 0.75 + 0.3 * Math.min(1, thr)) : 0.001;
    b.flame.scale.set(wide, wide, Math.max(0.001, thr * (0.85 + 0.3 * boil)));
    rig.update();
  }
  animate({ mode: 'landed' }, 0);
  return { object3D: g, animate };
}
