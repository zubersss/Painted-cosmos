// Painted Cosmos: the body of an animal, built in code. OWNER: PAINTER.
// Pure geometry and numbers: no page, no game state, no routines. Nothing here is loaded unless MODE.beasts
// is on (src/data/mode.js), exactly as no module of the powers is loaded without ?powers=1.
//
// WHY IT IS BUILT THIS WAY (the three measured facts the design hands down, docs/notes and the reading of
// 2026-11-23; every number below that is not mine is named where it came from):
//
//   1. THERE IS NO SKINNING IN THIS ENGINE. No SkinnedMesh, no skin weights, no AnimationMixer anywhere in
//      src/. So an animal cannot bend: it is rigid parts hinged at pivots that OVERLAP at the joint, which is
//      exactly how the explorer is built (src/art/models.js) and reads well because the look has no outlines.
//      Every tube here therefore starts a little way INSIDE its parent, so a hinge can never open a gap.
//   2. THE DRAW CALL IS THE WHOLE COST: 0.107 ms each on the owner's phone (3 ms / 28 far-tree meshes, the
//      v27 table). Forty animals posed the explorer's way -- one mesh and one uniform matrix palette apiece --
//      would be 4.3 ms of a 9.6 ms script before they did anything. So a herd is ONE instanced draw and the
//      pose is done in the VERTEX SHADER from per-instance numbers (src/render/beastmat.js). The matrix palette
//      is a UNIFORM (materials.js:2597): every instance drawn from one mesh would otherwise share one pose.
//   3. TRIANGLES ARE VERY NEARLY FREE on the owner's device (measured twice: cutting the far trees' triangles
//      by three quarters saved 0.1 ms). So the body may be properly made. What is NOT free is attributes and
//      per-instance bytes, so the attribute list below is kept to six.
//
// THE ART. The owner: "focus on the artstyle and animation for these make sure its really good". The hand is
// the explorer's own: flat strokes that follow the form, light in flat half-steps with crisp joins, no outline,
// no blur, no grain, no fur texture -- a coat is PIECES (flat ribbons laid along the run of the muscle, as the
// explorer's 579 cloak strips are, models.js cloakRow), or it is not made at all. The eye is one dark dab with
// a smaller pale dab beside it, never a drawn line. Colours come from the biome's own family; the one opposite
// accent in every scene is spent on the player's blue cloak and animals do not take it.
//
// ONE GRAMMAR, ROWS OF NUMBERS -- this project's own answer to twenty-five of anything (six trees, one `grow`,
// six rows: src/world/kits/grove.js:8-12). A species is a row: length, height, leg, neck, head, ear, tail,
// girth and its washes. Proportion does the work: a hare and a badger share every line of code below.
import * as THREE from 'three';
import { mulberry32 } from './noise.js';

// ---- the contract, in one place so no other file copies it ----------------------------------------
// Per-vertex attributes a beast geometry carries (src/render/beastmat.js reads exactly these):
//   position  vec3  the REST pose, metres, origin on the ground between the feet, facing -Z, +Y up
//                   (the figures' own contract, models.js:2). Instance scale 1 = the animal's real size.
//   normal    vec3  the rest normal. On a FLAT piece (aMat.x >= 0.99) it is the same at every corner.
//   color     vec3  the wash, linear 0..1. Three is NOT told vertexColors: the shader declares it, as FIG_VERT does.
//   aMat      vec3  (dry, wet, glow) -- models.js' own meaning. dry >= 0.985: paint the piece as ONE flat colour.
//   aRig      vec4  (part 0..15, limb 0..1 from the part's pivot to its tip, piece seed 0..1, flutter 0..1)
//   aPiece    vec3  the centre of the flat piece this vertex belongs to; on a solid form, the vertex itself
//                   (src/world/kitbuild.js' aCard convention), so light may be worked out once per piece.
// Six attributes, so with instanceMatrix (4) + aInst + aGait + aSpec there are 13 of the 16 WebGL2 guarantees.
export const BEAST_ATTRS = ['position', 'normal', 'color', 'aMat', 'aRig', 'aPiece'];
export const MAX_PARTS = 16;          // uPivot[16]/uAxis[16]/uSwing[16] = 48 vec4, far inside WebGL2's 256
// A part's chain to the root is at most THREE rotations, so the vertex shader unrolls a fixed three-step walk.
export const MAX_DEPTH = 3;
// What a creature is doing (per instance, aGait.z). The routines (src/physics/fauna.js) write it; the
// material reads it to scale the swings. Kept here so three files cannot drift apart.
export const STATE = { STAND: 0, WALK: 1, TROT: 2, GRAZE: 3, ALERT: 4, FLEE: 5, HUNT: 6, REST: 7 };

// ---- small helpers (models.js' own, re-written here: they are private there and this file is not three-free) ----
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const mixc = (a, b, t) => lerp3(a, b, clamp01(t));
function hash3(x, y, z) { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); }
function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  let fx = x - xi, fy = y - yi, fz = z - zi;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t;
  return L(L(L(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), fx), L(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), fx), fy),
    L(L(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), fx), L(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), fx), fy), fz);
}
// one deterministic stream per geometry: the world's own, so a kit and an animal shuffle the same way
const rng = mulberry32;

// ---- the builder: lofted soft forms and flat strokes into one buffer --------------------------------
// Written after src/art/models.js makeBuilder (the explorer's own), with two attributes added: aRig (which
// part, how far along it, the piece's seed, how much the piece trails) and aPiece (the flat piece's centre).
// `lump` is models.js' default 0.012 m scaled by the animal: no primitive is left ruler-true.
class BeastBuilder {
  constructor(scale) {
    this.P = []; this.C = []; this.M = []; this.R = []; this.PC = []; this.I = [];
    this.part = 0; this.limb0 = 0; this.limb1 = 1; this.piece = null; this.seed = 0.5; this.flutter = 0;
    this.scale = scale || 1;        // the animal's own size, so the hand's wobble is in proportion
  }
  get tris() { return this.I.length / 3; }
  get verts() { return this.P.length / 3; }
  _put(p, col, dry, wet, glow, t) {
    this.P.push(p[0], p[1], p[2]);
    this.C.push(Math.min(1, col[0]), Math.min(1, col[1]), Math.min(1, col[2]));
    this.M.push(dry, wet, glow);
    this.R.push(this.part, this.limb0 + (this.limb1 - this.limb0) * t, this.seed, this.flutter);
    if (this.piece) this.PC.push(this.piece[0], this.piece[1], this.piece[2]);
    else this.PC.push(p[0], p[1], p[2]);
    return this.P.length / 3 - 1;
  }
  tri(a, b, c) { this.I.push(a, b, c); }
  // rings swept along a path: [{ c, u, v, ru, rv, e }]; o: seg, col (array or fn(p, t, a)), dry, wet, glow, lump, warp, cap
  loft(rings, o = {}) {
    const seg = o.seg || 10, base = this.verts, n = rings.length;
    const col = typeof o.col === 'function' ? o.col : () => o.col || [0.6, 0.5, 0.4];
    const lump = (o.lump == null ? 0.012 : o.lump) * this.scale, freq = (o.freq || 3.3) / this.scale;
    const dry = o.dry == null ? 0.45 : o.dry, wet = o.wet == null ? 0.10 : o.wet, glow = o.glow || 0;
    const jseed = (base * 0.371) % 19;
    for (let i = 0; i < n; i++) {
      const r = rings[i], e = r.e || 2, t = i / (n - 1);
      for (let k = 0; k < seg; k++) {
        const a = (k / seg) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        const cu = Math.sign(ca) * Math.pow(Math.abs(ca), 2 / e) * r.ru, sv = Math.sign(sa) * Math.pow(Math.abs(sa), 2 / e) * r.rv;
        let p = [r.c[0] + r.u[0] * cu + r.v[0] * sv, r.c[1] + r.u[1] * cu + r.v[1] * sv, r.c[2] + r.u[2] * cu + r.v[2] * sv];
        if (o.warp) p = o.warp(p, a, t, r) || p;
        if (lump) p = add(p, mul(norm(sub(p, r.c)), lump * 2 * (noise3(p[0] * freq + jseed, p[1] * freq + 3.1, p[2] * freq) - 0.5)));
        // the hand again, in the wash: a form's pigment load is never flat
        const cc = col(p, t, a), j = glow > 0 || o.even ? 1 : 0.94 + 0.12 * noise3(p[0] * 2.1 * freq + jseed, p[1] * 2.1 * freq, p[2] * 2.1 * freq + 7.7);
        this._put(p, [cc[0] * j, cc[1] * j, cc[2] * j], dry, wet, glow, t);
      }
    }
    const first = this.I.length;
    const quad = (i0, i1) => { for (let k = 0; k < seg; k++) { const a = base + i0 * seg + k, b = base + i0 * seg + (k + 1) % seg, c = base + i1 * seg + k, d = base + i1 * seg + (k + 1) % seg; this.tri(a, b, c); this.tri(b, d, c); } };
    for (let i = 0; i < n - 1; i++) quad(i, i + 1);
    const capK = o.cap == null ? 0.3 : o.cap;
    if (capK > 0) {
      const apex = (i, j, flip) => {
        const p = add(rings[i].c, mul(sub(rings[i].c, rings[j].c), capK)), t = i ? 1 : 0;
        const cc = col(p, t, 0), v = this._put(p, cc, dry, wet, glow, t);
        for (let k = 0; k < seg; k++) { const a = base + i * seg + k, b = base + i * seg + (k + 1) % seg; if (flip) this.tri(a, v, b); else this.tri(a, b, v); }
      };
      apex(0, 1, true); apex(n - 1, n - 2, false);
    }
    // face the washes outward: a closed form has a positive volume (models.js' own check)
    let vol = 0;
    for (let q = first; q < this.I.length; q += 3) {
      const a = this.I[q] * 3, b = this.I[q + 1] * 3, c = this.I[q + 2] * 3;
      vol += this.P[a] * (this.P[b + 1] * this.P[c + 2] - this.P[b + 2] * this.P[c + 1]) - this.P[a + 1] * (this.P[b] * this.P[c + 2] - this.P[b + 2] * this.P[c]) + this.P[a + 2] * (this.P[b] * this.P[c + 1] - this.P[b + 1] * this.P[c]);
    }
    if (vol < 0) for (let q = first; q < this.I.length; q += 3) { const s = this.I[q + 1]; this.I[q + 1] = this.I[q + 2]; this.I[q + 2] = s; }
  }
  // rings along a path of points; rad(i, t) -> radius or [ru, rv]
  path(pts, rad, o = {}) {
    const n = pts.length, rings = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      const w = norm(sub(b, a));
      let u = o.ref ? o.ref.slice() : (Math.abs(w[0]) < 0.8 ? [1, 0, 0] : [0, 0, 1]);
      u = norm(sub(u, mul(w, dot(u, w))));
      const r = typeof rad === 'function' ? rad(i, i / (n - 1)) : rad;
      rings.push({ c: pts[i], u, v: cross(w, u), ru: r.length ? r[0] : r, rv: r.length ? r[1] : r, e: o.e || 2 });
    }
    this.loft(rings, o);
  }
  // a limb: a tube from A to B with rounded ends. `over`: how far it starts INSIDE its parent (a hinge must
  // never open a gap: finding 1 at the head of this file). A limb may bend: `kink` moves its middle point.
  limb(A, Bp, rA, rB, o = {}) {
    const w = norm(sub(Bp, A)), over = (o.over || 0);
    const A2 = add(A, mul(w, -over));
    const mid = o.mid == null ? 2 : o.mid, pts = [], rr = [];
    for (let i = 0; i <= mid + 1; i++) {
      const t = i / (mid + 1);
      let p = lerp3(A2, Bp, t);
      if (o.kink) p = add(p, mul(o.kink, Math.sin(Math.PI * t)));
      pts.push(p); rr.push((rA + (rB - rA) * t) * (1 + (o.bulge || 0) * Math.sin(Math.PI * t)));
    }
    this.path(pts, (i) => (o.flat ? [rr[i], rr[i] * o.flat] : rr[i]), o);
  }
  // a soft lump (rings about Y): a head, a muzzle, a hoof
  blob(c, rx, ry, rz, o = {}) {
    const rings = [], m = o.rings || 7;
    for (let i = 0; i < m; i++) {
      const th = Math.PI * (0.11 + 0.78 * (i / (m - 1))), s = Math.sin(th);
      rings.push({ c: [c[0], c[1] - ry * Math.cos(th), c[2]], u: [1, 0, 0], v: [0, 0, 1], ru: rx * s, rv: rz * s, e: o.e || 2 });
    }
    this.loft(rings, o);
  }
  // A FLAT STROKE: a six-cornered lozenge of ONE colour, pointed at both ends, laid on a surface. This is the
  // whole of the coat, the ears, the eye dabs, the tail's brush and every marking: `dry: 1` tells the fragment
  // shader to paint the piece as one flat colour with no stroke work at all (materials.js:2666, the explorer's
  // 579 cloak strips). Four triangles. c the centre, ax the way it runs (unit), nrm its face (unit), len and
  // wid in metres. The outline is geometry, so it is crisp at any size and needs no cut-out.
  stroke(c, ax, nrm, len, wid, col, o = {}) {
    const side = norm(cross(nrm, ax));
    const L = len * 0.5, W = wid * 0.5;
    this.piece = c.slice(); this.seed = o.seed == null ? 0.5 : o.seed; this.flutter = o.flutter || 0;
    const base = this.verts, dry = o.dry == null ? 1 : o.dry;
    // the widest point a little toward the root, as a leaf's is (kitbuild.js leafCards)
    const q = (t, k) => {
      const p = [c[0] + ax[0] * L * t + side[0] * W * k, c[1] + ax[1] * L * t + side[1] * W * k, c[2] + ax[2] * L * t + side[2] * W * k];
      return this._put(p, col, dry, 0, o.glow || 0, 0.5 + t * 0.5);
    };
    const a0 = q(-1, 0), a1 = q(-0.5, 0.82), a2 = q(0.2, 0.94), a3 = q(1, 0), a4 = q(0.2, -0.94), a5 = q(-0.5, -0.82);
    // wound so the face looks along `nrm` (checked by hand: (a0,a5,a1) cross-product is +nrm)
    this.tri(a0, a5, a1); this.tri(a1, a5, a2); this.tri(a2, a5, a4); this.tri(a2, a4, a3);
    this.piece = null; this.seed = 0.5; this.flutter = 0;
    return base;
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    g.setAttribute('aMat', new THREE.Float32BufferAttribute(this.M, 3));
    g.setAttribute('aRig', new THREE.Float32BufferAttribute(this.R, 4));
    g.setAttribute('aPiece', new THREE.Float32BufferAttribute(this.PC, 3));
    g.setIndex(this.I);
    g.computeVertexNormals();          // a flat piece has its own four corners, so it keeps its own flat normal
    return g;
  }
}

// =================================================================================================
// THE WALKER: one four-legged body plan. A row of numbers makes a deer, a fox, a hare or a badger.
// =================================================================================================
// FOURTEEN PARTS, never more than THREE hinges from the root, so the vertex shader's parent walk is a
// fixed three-step loop that GLSL unrolls. The body (0) is the root and does not hinge: its bob, its lean
// and its breath are the whole-instance transform.
//   0 body  1 neck  2 head  3 ears  4 tail base  5 tail tip  6/7 fore-left upper/lower  8/9 fore-right
//   10/11 hind-left  12/13 hind-right  14 horn or antler (only where the row asks for one)
// The hoof is built on the end of the lower leg and the muzzle on the head: parts are the scarce thing
// (16 of them) and triangles are not, so a shape that needs no hinge of its own is baked in.
export const WP = { BODY: 0, NECK: 1, HEAD: 2, EARS: 3, TAIL0: 4, TAIL1: 5, FL_U: 6, FL_L: 7, FR_U: 8, FR_L: 9, HL_U: 10, HL_L: 11, HR_U: 12, HR_L: 13, HORN: 14 };

const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];

// A ROW OF NUMBERS IS A SPECIES. Lengths in metres; everything else is a share of something else, so that a
// row reads as proportions and not as a model.
//   high   shoulder height (the top of the back), m        legF  how much of that height is leg (0..1)
//   len    the barrel, nose-end to rump, m                 girth the barrel's half width against its half height
//   neck   the neck's length, m                            neckUp how steeply it rises (0 flat .. 1 upright)
//   head   the head's length, m                            snout how drawn-out the muzzle is (0..1)
//   ear    the ear's length, m (0: none)                   earUp how upright the ear stands (0..1)
//   tail   the tail's length, m                            brush how bushy its end is (0..1)
//   horn   antler or horn length, m (0: none)              limbW how thick the legs are (1 = ordinary)
//   coat   how many flat strokes the coat is laid in       marks 'dapple' | 'rump' | 'bib' | 'mask' | ''
//   col    the washes: back, side, belly, dark, pale, mark
// THE COLOURS HERE ARE PLACEHOLDERS AND MUST BE REPLACED BY THE BIOME'S OWN FAMILY (src/data/looks/<world>.js,
// `oil.pal`): the one opposite accent in a scene is spent on the player's blue cloak, so an animal wears the
// biome's family with at most one small accent. A caller may pass `col` of its own and these are not used.
export const SHAPES = {
  deer: { plan: 'walker', high: 1.10, legF: 0.60, len: 1.05, girth: 0.72, neck: 0.44, neckUp: 0.74, head: 0.26, snout: 0.62, ear: 0.15, earUp: 0.80, tail: 0.14, brush: 0.45, horn: 0, limbW: 0.85, coat: 96, marks: 'rump',
    col: { back: hex('#8a6a46'), side: hex('#a07f55'), belly: hex('#d8c49a'), dark: hex('#4a382f'), pale: hex('#efe4c6'), mark: hex('#e8d8b0') } },
  stag: { plan: 'walker', high: 1.24, legF: 0.60, len: 1.18, girth: 0.78, neck: 0.48, neckUp: 0.70, head: 0.29, snout: 0.62, ear: 0.15, earUp: 0.75, tail: 0.14, brush: 0.45, horn: 0.46, limbW: 0.95, coat: 104, marks: 'rump',
    col: { back: hex('#7c5f40'), side: hex('#946f4b'), belly: hex('#cbb78f'), dark: hex('#453429'), pale: hex('#e8dcbc'), mark: hex('#ddcaa4') } },
  fawn: { plan: 'walker', high: 0.62, legF: 0.63, len: 0.56, girth: 0.74, neck: 0.22, neckUp: 0.72, head: 0.16, snout: 0.48, ear: 0.10, earUp: 0.85, tail: 0.09, brush: 0.40, horn: 0, limbW: 0.72, coat: 58, marks: 'dapple',
    col: { back: hex('#9c7850'), side: hex('#b48c5e'), belly: hex('#dfcda4'), dark: hex('#4a382f'), pale: hex('#f2e8cc'), mark: hex('#f0e2bd') } },
  fox: { plan: 'walker', high: 0.42, legF: 0.50, len: 0.62, girth: 0.72, neck: 0.14, neckUp: 0.34, head: 0.18, snout: 0.88, ear: 0.095, earUp: 0.95, tail: 0.40, brush: 1.00, horn: 0, limbW: 0.80, coat: 72, marks: 'bib',
    col: { back: hex('#a85f30'), side: hex('#c2763c'), belly: hex('#e8dcc8'), dark: hex('#3e3029'), pale: hex('#f2ead6'), mark: hex('#2f2622') } },
  hare: { plan: 'walker', high: 0.30, legF: 0.45, len: 0.42, girth: 0.84, neck: 0.07, neckUp: 0.55, head: 0.12, snout: 0.45, ear: 0.13, earUp: 0.88, tail: 0.05, brush: 0.60, horn: 0, limbW: 0.78, coat: 54, marks: '',
    col: { back: hex('#8d7a56'), side: hex('#a89066'), belly: hex('#e2d6b8'), dark: hex('#4a3c2e'), pale: hex('#efe6cc'), mark: hex('#d6c69c') } },
  badger: { plan: 'walker', high: 0.28, legF: 0.32, len: 0.64, girth: 0.92, neck: 0.07, neckUp: 0.18, head: 0.17, snout: 0.92, ear: 0.035, earUp: 0.50, tail: 0.12, brush: 0.50, horn: 0, limbW: 1.25, coat: 60, marks: 'mask',
    col: { back: hex('#6d6760'), side: hex('#8a837a'), belly: hex('#3a332e'), dark: hex('#2e2a27'), pale: hex('#e8e2d4'), mark: hex('#2e2a27') } },
  boar: { plan: 'walker', high: 0.80, legF: 0.46, len: 1.00, girth: 0.86, neck: 0.11, neckUp: 0.16, head: 0.40, snout: 1.00, ear: 0.11, earUp: 0.60, tail: 0.18, brush: 0.30, horn: 0, limbW: 1.20, coat: 86, marks: '',
    col: { back: hex('#524437'), side: hex('#6b5949'), belly: hex('#7a6a58'), dark: hex('#2f2721'), pale: hex('#9b8c76'), mark: hex('#3a322a') } },
};

// the barrel from the chest (t = 0) to the rump (t = 1): half width, half height, and where its centre line runs
const RU = [0.50, 0.86, 1.00, 0.98, 0.92, 0.94, 1.00, 0.72];
const RV = [0.52, 0.92, 1.04, 0.98, 0.90, 0.96, 1.02, 0.70];
const CYO = [0.06, 0.04, 0.00, -0.03, -0.03, 0.00, 0.04, 0.05];
const atT = (tab, t) => { const x = clamp01(t) * (tab.length - 1), i = Math.min(tab.length - 2, Math.floor(x)); return tab[i] + (tab[i + 1] - tab[i]) * (x - i); };

// ONE SOURCE OF TRUTH FOR WHERE EVERYTHING IS. The plan's pivots and the geometry's tubes are both read off
// this, so a hinge can never sit somewhere the limb is not.
export function walkerLayout(S) {
  const legLen = S.high * S.legF;                       // the ground to the shoulder joint
  const rv0 = Math.max(0.02, (S.high - legLen) * 0.5);  // the barrel's half height
  const ru0 = rv0 * S.girth;
  const cy0 = S.high - rv0 * (atT(RV, 0.22) + atT(CYO, 0.22));   // so the withers is exactly at the shoulder height
  const L = S.len;
  const zAt = (t) => -L * 0.5 + L * t;                  // the chest at -Z (the animal faces -Z), the rump at +Z
  const cyAt = (t) => cy0 + rv0 * atT(CYO, t);
  const ruAt = (t) => ru0 * atT(RU, t);
  const rvAt = (t) => rv0 * atT(RV, t);
  // the belly hangs at the middle and the withers stand up: the one warp both the loft and the coat use
  const warp = (p, a, t) => {
    const cy = cyAt(t), dy = p[1] - cy;
    const belly = 1 + 0.20 * Math.sin(Math.PI * t), back = 1 + 0.12 * Math.exp(-Math.pow((t - 0.22) / 0.17, 2));
    return [p[0], cy + dy * (dy < 0 ? belly : back), p[2]];
  };
  const E = 2.3;        // flat-sided, as a barrel is: a round section reads as a sausage
  const surf = (t, a) => {
    const ca = Math.cos(a), sa = Math.sin(a);
    const p = [Math.sign(ca) * Math.pow(Math.abs(ca), 2 / E) * ruAt(t), cyAt(t) + Math.sign(sa) * Math.pow(Math.abs(sa), 2 / E) * rvAt(t), zAt(t)];
    return warp(p, a, t);
  };
  const neckAng = S.neckUp * 1.25;
  const nBase = [0, cyAt(0.13) + rvAt(0.13) * 0.58, zAt(0.12)];
  const nDir = [0, Math.sin(neckAng), -Math.cos(neckAng)];
  const poll = add(nBase, mul(nDir, S.neck));
  const hAng = neckAng * 0.30 - 0.12;                   // the head is held flatter than the neck, the nose a little down
  const hDir = [0, Math.sin(hAng), -Math.cos(hAng)];
  const sx = (t) => ruAt(t) * 0.78;                     // how far out a leg stands
  // the fore leg: the shoulder down and a little back to the elbow, then down and forward to the foot
  const shoulder = (s) => [s * sx(0.26), legLen, zAt(0.26)];
  const elbow = (s) => [s * sx(0.26) * 0.94, legLen * 0.46, zAt(0.26) + L * 0.035];
  const ffoot = (s) => [s * sx(0.26) * 0.90, 0.030 * S.high, zAt(0.26) - L * 0.015];
  // the hind leg: the hip down and FORWARD to the stifle, then back and down through the hock to the foot.
  // The hock bending backward is the one thing that says animal and not dog-shaped model; it is a kink inside
  // the lower part (a third hinge would cost a part and buy nothing at 11 pixels).
  const hip = (s) => [s * sx(0.80) * 0.96, legLen * 1.04, zAt(0.80)];
  const stifle = (s) => [s * sx(0.80) * 0.90, legLen * 0.56, zAt(0.80) - L * 0.105];
  const hfoot = (s) => [s * sx(0.80) * 0.86, 0.030 * S.high, zAt(0.80) + L * 0.075];
  const rump = [0, cyAt(0.94) + rvAt(0.94) * 0.50, zAt(0.96)];
  return { S, legLen, rv0, ru0, cy0, L, E, zAt, cyAt, ruAt, rvAt, warp, surf, neckAng, nBase, nDir, poll, hDir, shoulder, elbow, ffoot, hip, stifle, hfoot, rump, sx };
}

// THE SWING DIALS, part by part. Every number is mine and chosen for the drawing, not measured; what IS
// measured is the shape of the walk, and it is not repeated here: PHYSICS' gaitOf (src/physics/explorer.js:860)
// already turns speed, gravity and leg length into step length, cadence, duty and the hips' bob, and was
// exported expressly so a figure could be drawn without the body (explorer.js:896). The routines hand the
// stride PHASE over per instance (aGait.x); these dials only say how far each part swings when it does.
//   amp   radians at a walk            phase  where in the stride this part leads (turns, 0..1)
//   harm  how much of the swing is at TWICE the stride (the second harmonic: a leg that is one sine is a
//         pendulum, and a pendulum is a toy)
//   lag   how far this part TRAILS its parent (turns). The shin trailing the thigh, the tail's end trailing
//         its base, the ear trailing the head: this is the single thing that stops a hinge chain reading as
//         a doll, and it costs one subtraction in the shader.
//   gait  how much this part's swing follows the stride at all (0: it moves only on its own clock)
const WALK_SWING = [
  { amp: 0.000, phase: 0.00, harm: 0.00, lag: 0.00, gait: 0 },       // 0 body: the root does not hinge
  { amp: 0.035, phase: 0.10, harm: 0.80, lag: 0.06, gait: 0.6 },     // 1 neck: a small nod at twice the stride
  { amp: 0.030, phase: 0.10, harm: 0.90, lag: 0.15, gait: 0.6 },     // 2 head: counter-bobs, trailing the neck
  { amp: 0.000, phase: 0.00, harm: 0.00, lag: 0.30, gait: 0 },       // 3 ears: their own slow uneven clock
  { amp: 0.040, phase: 0.00, harm: 0.50, lag: 0.08, gait: 0.3 },     // 4 tail base
  { amp: 0.090, phase: 0.00, harm: 0.40, lag: 0.22, gait: 0.3 },     // 5 tail tip: trails its base by a fifth of a stride
  { amp: 0.400, phase: 0.00, harm: 0.10, lag: 0.00, gait: 1 },       // 6 fore-left upper
  { amp: 0.340, phase: 0.00, harm: 0.28, lag: 0.11, gait: 1 },       // 7 fore-left lower
  { amp: 0.400, phase: 0.50, harm: 0.10, lag: 0.00, gait: 1 },       // 8 fore-right upper (half a stride away: a trot)
  { amp: 0.340, phase: 0.50, harm: 0.28, lag: 0.11, gait: 1 },       // 9 fore-right lower
  { amp: 0.440, phase: 0.50, harm: 0.12, lag: 0.00, gait: 1 },       // 10 hind-left upper (diagonal to the fore-right)
  { amp: 0.400, phase: 0.50, harm: 0.32, lag: 0.14, gait: 1 },       // 11 hind-left lower
  { amp: 0.440, phase: 0.00, harm: 0.12, lag: 0.00, gait: 1 },       // 12 hind-right upper
  { amp: 0.400, phase: 0.00, harm: 0.32, lag: 0.14, gait: 1 },       // 13 hind-right lower
  { amp: 0.000, phase: 0.00, harm: 0.00, lag: 0.00, gait: 0 },       // 14 horn: rigid on the head
];
const AX_X = [1, 0, 0], AX_Y = [0, 1, 0], AX_Z = [0, 0, 1];

// beastPlan(shape) -> the part table for THAT row of numbers: pivots are in metres and must match the
// geometry, so they are read off walkerLayout, which the geometry also reads.
export function beastPlan(shape) {
  const S = typeof shape === 'string' ? SHAPES[shape] : shape;
  if (!S) throw new Error('beastPlan: no such shape');
  const Y = walkerLayout(S);
  const skull = add(Y.poll, mul(Y.hDir, S.head * 0.30));
  const P = [
    { name: 'body', parent: -1, pivot: [0, Y.cyAt(0.5), Y.zAt(0.5)], axis: AX_X },
    { name: 'neck', parent: WP.BODY, pivot: Y.nBase, axis: AX_X },
    { name: 'head', parent: WP.NECK, pivot: Y.poll, axis: AX_X },
    // the ears are ONE part: they flick together, and at eleven pixels nobody counts them. The axis is the
    // body's own forward, so a flick fans them out and back rather than hinging them like a lid.
    { name: 'ears', parent: WP.HEAD, pivot: skull, axis: AX_Z },
    { name: 'tail0', parent: WP.BODY, pivot: Y.rump, axis: AX_X },
    { name: 'tail1', parent: WP.TAIL0, pivot: add(Y.rump, [0, -S.tail * 0.22, S.tail * 0.42]), axis: AX_Y },
    { name: 'fl_u', parent: WP.BODY, pivot: Y.shoulder(-1), axis: AX_X },
    { name: 'fl_l', parent: WP.FL_U, pivot: Y.elbow(-1), axis: AX_X },
    { name: 'fr_u', parent: WP.BODY, pivot: Y.shoulder(1), axis: AX_X },
    { name: 'fr_l', parent: WP.FR_U, pivot: Y.elbow(1), axis: AX_X },
    { name: 'hl_u', parent: WP.BODY, pivot: Y.hip(-1), axis: AX_X },
    { name: 'hl_l', parent: WP.HL_U, pivot: Y.stifle(-1), axis: AX_X },
    { name: 'hr_u', parent: WP.BODY, pivot: Y.hip(1), axis: AX_X },
    { name: 'hr_l', parent: WP.HR_U, pivot: Y.stifle(1), axis: AX_X },
    { name: 'horn', parent: WP.HEAD, pivot: skull, axis: AX_X },
  ];
  for (let i = 0; i < P.length; i++) Object.assign(P[i], WALK_SWING[i]);
  const plan = {
    name: 'walker', shape: S, layout: Y, parts: P, count: P.length,
    // the whole-animal dials the material applies to the ROOT, which has no hinge of its own
    body: {
      // the body rises and falls TWICE a stride, highest as the legs pass (the explorer's own rule,
      // models.js:500). Get this and an eleven-pixel animal reads; miss it and a sixty-five-pixel animal is a toy.
      bob: Y.legLen * 0.035,
      headBob: -0.6,              // the head counter-bobs against it
      breath: 0.012,              // the barrel scales by this much, slowly, when the animal is still
      lean: 0.10,                 // radians of roll per radian a second of turn
      strideLen: Y.legLen * 1.7,  // metres of ground in one full cycle; PHYSICS' gaitOf is the real source
      scale: Math.max(0.06, Math.min(0.45, S.high * 0.26)),   // the wash chart in metres (the explorer's is 0.42 m at 1.75 m)
    },
    // the four-beat WALK's leg phases (fore-left, fore-right, hind-left, hind-right). The table above is the
    // two-beat trot, which is what a creature at speed does; a material that wants the slow walk reads this
    // one vec4 instead, and nothing else changes.
    phaseWalk: [0.00, 0.50, 0.25, 0.75],
  };
  validatePlan(plan);
  return plan;
}

// A part's chain to the root must be at most MAX_DEPTH rotations, because the vertex shader's parent walk is
// unrolled that many times. A plan that breaks it would simply not be posed and nobody would see why, so it
// throws here, at build time, where the message can say which part.
export function validatePlan(plan) {
  if (plan.count > MAX_PARTS) throw new Error('beastPlan: ' + plan.count + ' parts, the tables hold ' + MAX_PARTS);
  for (let i = 0; i < plan.count; i++) {
    let d = 0, j = i;
    while (plan.parts[j].parent >= 0) {
      if (plan.parts[j].parent >= j) throw new Error('beastPlan: part ' + plan.parts[i].name + ' has a parent at or after it; the shader walks the table once');
      j = plan.parts[j].parent; d++;
      if (d > MAX_DEPTH) throw new Error('beastPlan: part ' + plan.parts[i].name + ' is ' + d + ' hinges from the root; the shader unrolls ' + MAX_DEPTH);
    }
  }
  return plan;
}

// The three uniform tables, packed as the material uploads them. 16 x 3 = 48 vec4, far inside WebGL2's
// guaranteed 256 vertex uniform vectors (counted, not assumed: the material's own pars add about 40 more).
//   uBPivot[i] = (pivot x, y, z, parent index or -1)
//   uBAxis[i]  = (axis x, y, z, lag in turns)
//   uBSwing[i] = (amplitude rad, phase in turns, second harmonic, how far it follows the stride)
export function planUniforms(plan) {
  const pivot = new Float32Array(MAX_PARTS * 4), axis = new Float32Array(MAX_PARTS * 4), swing = new Float32Array(MAX_PARTS * 4);
  for (let i = 0; i < MAX_PARTS; i++) {
    const p = plan.parts[i];
    if (!p) { pivot[i * 4 + 3] = -1; axis[i * 4] = 1; continue; }     // an unused slot is the identity
    pivot[i * 4] = p.pivot[0]; pivot[i * 4 + 1] = p.pivot[1]; pivot[i * 4 + 2] = p.pivot[2]; pivot[i * 4 + 3] = p.parent;
    axis[i * 4] = p.axis[0]; axis[i * 4 + 1] = p.axis[1]; axis[i * 4 + 2] = p.axis[2]; axis[i * 4 + 3] = p.lag;
    swing[i * 4] = p.amp; swing[i * 4 + 1] = p.phase; swing[i * 4 + 2] = p.harm; swing[i * 4 + 3] = p.gait;
  }
  return { pivot, axis, swing, count: plan.count };
}

// =================================================================================================
// THE GEOMETRY: one row of numbers in, one mesh out.
// =================================================================================================
// beastGeometry(shape, seed, lod, opts) -> BufferGeometry
//   lod 0  near, everything, with the coat. userData.coatStart is where the coat's triangles begin, so the
//          MIDDLE drawing is the SAME buffers with setDrawRange(0, coatStart) and costs no memory and no
//          build at all (the trick flora.js already uses for leaves, flora.js:371).
//   lod 1  far: fewer sides, no coat, no eye dabs, no brush. What is kept is what reads at ten pixels --
//          the gaps between the legs, the angle of the neck and a pale rump against a dark body.
//   opts.coat 0 turns the coat off wherever it is built (?beastcoat=0, for an A-and-B still)
//   opts.col  the washes, if the biome's palette is handing them over instead of the row's placeholders
export function beastGeometry(shape, seed, lod, opts = {}) {
  const S = typeof shape === 'string' ? SHAPES[shape] : shape;
  const C = opts.col || S.col;
  const Y = walkerLayout(S), L = S.len, rnd = rng((seed | 0) * 2654435761 + 17);
  const near = !lod;
  const seg = near ? 9 : 5, legSeg = near ? 6 : 3;
  const bodyRings = near ? 8 : 6;
  const B = new BeastBuilder(S.high);
  const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

  // ---- 0 the body: a barrel of eight rings, flat-sided, the belly hanging and the withers up -------
  const hide = (upness, t) => {
    const c = upness > 0 ? mixc(C.side, C.back, sstep(0.10, 0.92, upness)) : mixc(C.side, C.belly, sstep(-0.05, -0.70, upness));
    // the chest and the haunch are a shade deeper than the flank: a flat-lit barrel reads as a drum
    return mixc(c, C.back, 0.16 * sstep(0.34, 0.02, t) + 0.10 * sstep(0.70, 0.98, t));
  };
  B.part = WP.BODY; B.limb0 = 0; B.limb1 = 1;
  {
    const rings = [];
    for (let i = 0; i < bodyRings; i++) {
      const t = i / (bodyRings - 1);
      rings.push({ c: [0, Y.cyAt(t), Y.zAt(t)], u: [1, 0, 0], v: [0, 1, 0], ru: Y.ruAt(t), rv: Y.rvAt(t), e: Y.E });
    }
    B.loft(rings, { seg, cap: 0.34, lump: 0.010, col: (p, t, a) => hide(Math.sin(a), t), warp: (p, a, t) => Y.warp(p, a, t), dry: 0.42, wet: 0.10 });
  }

  // ---- 1 the neck ---------------------------------------------------------------------------------
  B.part = WP.NECK; B.limb0 = 0; B.limb1 = 1;
  {
    const r0 = S.head * 0.56, r1 = S.head * 0.40, pts = [], n = near ? 5 : 3;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      // the neck leaves the chest and straightens: a straight tube from the withers is a broom handle
      const bend = Math.sin(Math.PI * t) * S.neck * 0.10;
      pts.push(add(add(Y.nBase, mul(Y.nDir, S.neck * (t * 1.22 - 0.22))), [0, 0, -bend]));
    }
    B.path(pts, (i) => { const t = i / (n - 1); return [r0 + (r1 - r0) * t, (r0 + (r1 - r0) * t) * 1.08]; }, { seg, cap: 0.2, lump: 0.008, col: (p) => hide(0.45, 0.1), dry: 0.42 });
  }

  // ---- 2 the head: a skull and a muzzle, an eye of two dabs, a nose ---------------------------------
  B.part = WP.HEAD; B.limb0 = 0; B.limb1 = 1;
  const hc = add(Y.poll, mul(Y.hDir, S.head * 0.30));
  const hrx = S.head * 0.30, hry = S.head * 0.33, hrz = S.head * 0.42;
  B.blob(hc, hrx, hry, hrz, { seg, rings: near ? 7 : 4, lump: 0.006, e: 2.2, col: (p) => hide(0.5, 0.2), dry: 0.4 });
  {
    // the muzzle: how far it is drawn out is the whole difference between a deer, a fox and a badger
    const mc = add(add(hc, mul(Y.hDir, S.head * (0.20 + 0.26 * S.snout))), [0, -S.head * 0.10, 0]);
    B.blob(mc, S.head * (0.20 - 0.05 * S.snout), S.head * (0.19 - 0.04 * S.snout), S.head * (0.14 + 0.18 * S.snout),
      { seg: near ? 7 : 4, rings: near ? 6 : 3, lump: 0.004, e: 2.2, col: (p) => mixc(hide(0.4, 0.2), C.dark, 0.45 + 0.3 * S.snout), dry: 0.45 });
    if (near) {
      // THE EYE IS TWO DABS AND NEVER A DRAWN LINE: outlines are forbidden in this look. A dark dab with a
      // smaller pale one beside it is what a painter puts there, and it reads at ten metres.
      for (const s of [-1, 1]) {
        const e0 = [hc[0] + s * hrx * 0.86, hc[1] + hry * 0.26, hc[2] - hrz * 0.26];
        const nrm = norm([s * 0.94, 0.26, -0.20]);
        B.stroke(e0, norm([0, 0.3, -0.95]), nrm, S.head * 0.115, S.head * 0.085, C.dark, { seed: 0.2 });
        B.stroke(add(e0, mul(norm([s * 0.2, 0.55, -0.80]), S.head * 0.055)), norm([0, 0.3, -0.95]), nrm, S.head * 0.055, S.head * 0.040, C.pale, { seed: 0.8 });
      }
      const nose = add(add(hc, mul(Y.hDir, S.head * (0.33 + 0.42 * S.snout))), [0, -S.head * 0.14, 0]);
      B.stroke(nose, [1, 0, 0], norm(add(Y.hDir, [0, -0.45, 0])), S.head * 0.17, S.head * 0.12, C.dark, { seed: 0.5 });
    }
  }

  // ---- 3 the ears: two flat cards, one part, flicking together --------------------------------------
  if (S.ear > 0.005) {
    B.part = WP.EARS; B.limb0 = 0; B.limb1 = 1;
    const skull = add(Y.poll, mul(Y.hDir, S.head * 0.30));
    for (const s of [-1, 1]) {
      const root = [skull[0] + s * hrx * 0.70, skull[1] + hry * 0.62, skull[2] + hrz * 0.10];
      const ax = norm([s * (0.52 - 0.34 * S.earUp), 0.30 + 0.86 * S.earUp, 0.26 - 0.20 * S.earUp]);
      const face = norm([s * 0.86, -0.1, -0.5]);
      // the card is laid from its ROOT, so aRig.y runs 0 at the skull to 1 at the tip and the material can
      // let the tip trail (the lag that keeps an ear from reading as a plank)
      B.stroke(add(root, mul(ax, S.ear * 0.5)), ax, face, S.ear, S.ear * 0.44, mixc(hide(0.5, 0.2), C.dark, 0.25), { seed: 0.3 + 0.4 * s, flutter: 1 });
      if (near) B.stroke(add(root, mul(ax, S.ear * 0.46)), ax, mul(face, -1), S.ear * 0.72, S.ear * 0.26, mixc(C.pale, C.side, 0.35), { seed: 0.6, flutter: 1 });
    }
  }

  // ---- 4, 5 the tail, and the pale flash under it ---------------------------------------------------
  {
    const tdir = norm([0, -0.46 - 0.3 * (1 - S.brush), 0.88]);
    B.part = WP.TAIL0; B.limb0 = 0; B.limb1 = 1;
    B.limb(Y.rump, add(Y.rump, mul(tdir, S.tail * 0.5)), S.tail * 0.19, S.tail * 0.15, { seg: near ? 6 : 4, over: S.tail * 0.45, mid: 1, lump: 0.004, col: () => hide(0.6, 0.95), dry: 0.42 });
    B.part = WP.TAIL1; B.limb0 = 0; B.limb1 = 1;
    const t1 = add(Y.rump, mul(tdir, S.tail * 0.5));
    B.limb(t1, add(Y.rump, mul(tdir, S.tail)), S.tail * 0.15, S.tail * 0.08, { seg: near ? 6 : 4, over: S.tail * 0.10, mid: 1, lump: 0.004, col: (p, t) => mixc(hide(0.6, 0.95), C.dark, 0.3 * t), dry: 0.42 });
    // the brush: a few flat strokes, so a fox's tail is a brush and not a sausage
    if (near && S.brush > 0.2) {
      const nb = Math.round(5 + 9 * S.brush);
      for (let i = 0; i < nb; i++) {
        const u = (i + 0.5) / nb, c = add(Y.rump, mul(tdir, S.tail * (0.42 + 0.56 * u)));
        const a = (i * 2.399) % (Math.PI * 2), face = norm([Math.cos(a), Math.sin(a) * 0.5, 0.2]);
        const ax = norm(add(tdir, mul([Math.cos(a), Math.sin(a), 0], 0.55)));
        B.stroke(add(c, mul(ax, S.tail * 0.14)), ax, face, S.tail * (0.26 + 0.22 * u) * S.brush, S.tail * 0.13 * S.brush,
          mixc(hide(0.6, 0.95), i % 3 ? C.dark : C.pale, 0.18 + 0.3 * rnd()), { seed: rnd(), flutter: u });
      }
    }
    // the pale flash: under the tail, so that a raised tail shows it (the thing the eye tracks across a wood)
    B.part = WP.TAIL0;
    B.stroke(add(Y.rump, [0, -S.tail * 0.30, S.tail * 0.12]), [0, -1, 0.2], [0, 0.2, 1], S.tail * 0.9, S.tail * 0.7, C.pale, { seed: 0.4 });
  }

  // ---- 6..13 the legs ------------------------------------------------------------------------------
  const lw = S.limbW * Y.legLen;
  for (const s of [-1, 1]) {
    const fu = s < 0 ? WP.FL_U : WP.FR_U, fl = s < 0 ? WP.FL_L : WP.FR_L;
    const hu = s < 0 ? WP.HL_U : WP.HR_U, hl = s < 0 ? WP.HL_L : WP.HR_L;
    const legCol = (p, t) => mixc(hide(0.1, 0.5), C.dark, 0.18 + 0.5 * t * t);
    // the fore leg: shoulder down and back to the elbow, then down and forward to the foot
    B.part = fu; B.limb0 = 0; B.limb1 = 1;
    B.limb(Y.shoulder(s), Y.elbow(s), lw * 0.115, lw * 0.072, { seg: legSeg, over: lw * 0.10, mid: near ? 2 : 0, lump: 0.004, col: (p, t) => mixc(hide(0.2, 0.3), C.dark, 0.10 * t), dry: 0.42, bulge: 0.12 });
    B.part = fl; B.limb0 = 0; B.limb1 = 1;
    B.limb(Y.elbow(s), Y.ffoot(s), lw * 0.072, lw * 0.040, { seg: legSeg, over: lw * 0.085, mid: near ? 2 : 0, lump: 0.003, col: legCol, dry: 0.42, cap: 0.10 });
    // the hind leg: hip down and FORWARD to the stifle, then the lower part kinked BACK through the hock.
    B.part = hu; B.limb0 = 0; B.limb1 = 1;
    B.limb(Y.hip(s), Y.stifle(s), lw * 0.145, lw * 0.082, { seg: legSeg, over: lw * 0.10, mid: near ? 2 : 0, lump: 0.004, col: (p, t) => mixc(hide(0.25, 0.8), C.dark, 0.10 * t), dry: 0.42, bulge: 0.18 });
    B.part = hl; B.limb0 = 0; B.limb1 = 1;
    B.limb(Y.stifle(s), Y.hfoot(s), lw * 0.082, lw * 0.040, { seg: legSeg, over: lw * 0.085, mid: near ? 3 : 1, lump: 0.003, col: legCol, dry: 0.42, cap: 0.10, kink: [0, 0, L * 0.075] });
    // the hoof or paw: a small flattened lump, the darkest wash on the animal. Not at the far drawing:
    // at four pixels a hoof is nothing, and eight of them cost more triangles than the eight legs.
    if (near) for (const [pt, part] of [[Y.ffoot(s), fl], [Y.hfoot(s), hl]]) {
      B.part = part; B.limb0 = 0.9; B.limb1 = 1;
      B.blob([pt[0], pt[1] + lw * 0.028, pt[2]], lw * 0.050, lw * 0.042, lw * 0.062, { seg: near ? 6 : 4, rings: near ? 5 : 3, lump: 0.002, col: () => C.dark, dry: 0.5 });
    }
  }

  // ---- 14 the antler, where the row asks for one ----------------------------------------------------
  if (S.horn > 0.01) {
    B.part = WP.HORN; B.limb0 = 0; B.limb1 = 1;
    const skull = add(Y.poll, mul(Y.hDir, S.head * 0.30));
    for (const s of [-1, 1]) {
      const root = [skull[0] + s * hrx * 0.52, skull[1] + hry * 0.70, skull[2] + hrz * 0.16];
      const beam = norm([s * 0.36, 0.78, 0.52]);
      const tip = add(root, mul(beam, S.horn));
      B.limb(root, tip, S.horn * 0.085, S.horn * 0.035, { seg: near ? 5 : 4, over: S.horn * 0.08, mid: near ? 3 : 1, lump: 0.004, col: (p, t) => mixc(C.dark, C.pale, 0.25 + 0.45 * t), dry: 0.5, kink: [s * S.horn * 0.10, 0, -S.horn * 0.16] });
      if (near) for (const u of [0.30, 0.60, 0.88]) {
        const b = add(root, mul(beam, S.horn * u)), d = norm([s * 0.26, 0.60 + 0.3 * u, -0.80 + 0.5 * u]);
        B.limb(b, add(b, mul(d, S.horn * (0.56 - 0.22 * u))), S.horn * 0.045, S.horn * 0.022, { seg: 4, over: S.horn * 0.05, mid: 1, lump: 0.003, col: () => mixc(C.dark, C.pale, 0.5), dry: 0.5 });
      }
    }
  }

  // =================================================================================================
  // THE COAT, LAST. Every triangle from here on is a flat stroke, so the middle drawing is this same
  // buffer with setDrawRange(0, coatStart) and the coat costs nothing beyond its range.
  // =================================================================================================
  // THE MARKINGS GO IN BEFORE THE LINE, not after it. A pale rump is not decoration: at ten pixels it is
  // the spot the eye actually tracks across a wood, which is the whole reason a distant animal reads at all.
  // So it survives every drawing, and only the coat is dropped.
  if (S.marks) layMarks(B, S, Y, C, rnd);
  const coatStart = B.I.length;
  const coatN = opts.coat === 0 ? 0 : Math.round((S.coat || 0) * (near ? 1 : 0));
  if (coatN > 0) layCoat(B, S, Y, C, coatN, rnd, hide);

  const g = B.build();
  g.userData.plan = 'walker';
  g.userData.shape = S;
  g.userData.lod = lod | 0;
  g.userData.coatStart = coatStart;         // the middle drawing: setDrawRange(0, coatStart)
  g.userData.indexCount = B.I.length;
  g.userData.tris = B.tris;
  g.userData.verts = B.verts;
  g.userData.scale = Math.max(0.06, Math.min(0.45, S.high * 0.26));     // the wash chart, metres
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, S.high * 0.55, 0), S.high * 0.55 + S.len * 0.62 + S.neck + S.tail);
  return g;
}

// ---- the coat: flat ribbons laid along the run of the muscle ---------------------------------------
// THE COAT IS THE WHOLE LOOK AND IT IS THE THING THAT CAN GO WRONG. There is no fur and no grain in this
// game and there never will be (no picture file exists in the repository and the look forbids grain): a coat
// is PIECES. Each is one flat colour with a crisp edge -- `dry: 1`, which the fragment shader paints with no
// stroke work at all, exactly as it paints the explorer's 579 cloak strips (materials.js:2666).
// Each stroke is laid ON the surface it belongs to, anchored at both ends, lying ALONG the muscle: forward
// and down at the shoulder, straight along the spine over the back, back and down over the haunch. They are
// laid per PART, never across a joint, so a hinge can never tear one; the parts' own overlap hides the seam.
// A stroke is laid proud of the skin by about half a per cent of the animal's height -- enough not to fight
// the surface for the depth buffer, little enough not to float.
function layCoat(B, S, Y, C, n, rnd, hide) {
  const nb = Math.round(n * 0.70), nn = Math.round(n * 0.12), nl = Math.max(0, n - nb - nn);
  const len0 = S.len * 0.075, wid0 = len0 * 0.24, lift = S.high * 0.006;
  // where a point on the barrel is, which way it faces, and which way the body runs there
  const surfN = (t, a) => {
    const p = Y.surf(t, a), pa = Y.surf(t, a + 0.015), pt = Y.surf(Math.min(0.995, t + 0.012), a);
    let nr = norm(cross(sub(pt, p), sub(pa, p)));
    if (dot(nr, sub(p, [0, Y.cyAt(t), Y.zAt(t)])) < 0) nr = mul(nr, -1);
    return { p, n: nr, tz: norm(sub(pt, p)) };
  };
  // a jittered grid, so the coat covers evenly and never clumps; rows round the barrel, columns along it
  const rows = Math.max(3, Math.round(Math.sqrt(nb * 0.55))), cols = Math.max(1, Math.ceil(nb / rows));
  let laid = 0;
  for (let c = 0; c < cols && laid < nb; c++) for (let r = 0; r < rows && laid < nb; r++, laid++) {
    const t = 0.06 + 0.88 * ((c + 0.5 + (rnd() - 0.5) * 0.8) / cols);
    // from the lower flank, over the back, to the other lower flank: never on the belly, where nothing is seen
    const a = -0.35 * Math.PI + 1.70 * Math.PI * ((r + 0.5 + (rnd() - 0.5) * 0.8) / rows);
    const F = surfN(clamp01(t) * 0.94 + 0.03, a);
    // the run of the muscle: forward-down at the shoulder, back-down over the haunch, flat along the spine
    let tilt = t < 0.34 ? -0.58 * (0.34 - t) / 0.34 : t > 0.68 ? 0.54 * (t - 0.68) / 0.32 : 0;
    tilt *= 0.35 + 0.65 * Math.abs(Math.cos(a));
    tilt += (rnd() - 0.5) * 0.22;
    const side = norm(cross(F.n, F.tz));
    const ax = norm(add(mul(F.tz, Math.cos(tilt)), mul(side, Math.sin(tilt))));
    const up = Math.sin(a);
    const col = mixc(hide(up, t), up > 0.3 ? C.back : C.belly, 0.10 + 0.16 * rnd());
    const k = 0.86 + 0.34 * rnd();
    B.part = WP.BODY; B.limb0 = 0; B.limb1 = 1; B.flutter = 0;
    B.stroke(add(F.p, mul(F.n, lift)), ax, F.n, len0 * k, wid0 * (0.8 + 0.5 * rnd()), col, { seed: rnd() });
  }
  // the neck and the four upper legs: the same stroke on a tube's surface
  const tubeCoat = (part, A, Bp, rA, rB, count, colAt) => {
    const w = norm(sub(Bp, A));
    let u = Math.abs(w[0]) < 0.8 ? [1, 0, 0] : [0, 0, 1];
    u = norm(sub(u, mul(w, dot(u, w))));
    const v = cross(w, u);
    B.part = part; B.limb0 = 0; B.limb1 = 1; B.flutter = 0;
    for (let i = 0; i < count; i++) {
      const t = 0.08 + 0.84 * ((i + 0.5 + (rnd() - 0.5) * 0.7) / count), a = rnd() * Math.PI * 2;
      const r = rA + (rB - rA) * t;
      const nr = norm(add(mul(u, Math.cos(a)), mul(v, Math.sin(a))));
      const p = add(add(A, mul(w, Math.hypot(Bp[0] - A[0], Bp[1] - A[1], Bp[2] - A[2]) * t)), mul(nr, r + lift));
      const tilt = (rnd() - 0.5) * 0.5;
      const sd = norm(cross(nr, w));
      B.stroke(p, norm(add(mul(w, Math.cos(tilt)), mul(sd, Math.sin(tilt)))), nr, len0 * (0.62 + 0.3 * rnd()), wid0 * (0.8 + 0.4 * rnd()), colAt(t, rnd()), { seed: rnd() });
    }
  };
  if (nn > 0) tubeCoat(WP.NECK, Y.nBase, Y.poll, S.head * 0.56, S.head * 0.40, nn, (t, j) => mixc(hide(0.45, 0.1), C.back, 0.08 + 0.2 * j));
  const per = Math.floor(nl / 4);
  if (per > 0) for (const s of [-1, 1]) {
    tubeCoat(s < 0 ? WP.FL_U : WP.FR_U, Y.shoulder(s), Y.elbow(s), Y.legLen * S.limbW * 0.115, Y.legLen * S.limbW * 0.072, per, (t, j) => mixc(hide(0.2, 0.3), C.dark, 0.10 + 0.22 * j));
    tubeCoat(s < 0 ? WP.HL_U : WP.HR_U, Y.hip(s), Y.stifle(s), Y.legLen * S.limbW * 0.145, Y.legLen * S.limbW * 0.082, per, (t, j) => mixc(hide(0.25, 0.8), C.dark, 0.10 + 0.22 * j));
  }
}

// ---- markings: pieces, never texture ----------------------------------------------------------------
// A dappled fawn is pale dabs laid on the flank like leaf cards; a badger's stripe is two flat pieces; a
// pale rump is the spot the eye actually tracks across a wood. All of them are the same flat stroke.
function layMarks(B, S, Y, C, rnd) {
  const lift = S.high * 0.007;
  const put = (t, a, len, wid, col, tilt) => {
    const p = Y.surf(t, a), pa = Y.surf(t, a + 0.015), pt = Y.surf(Math.min(0.995, t + 0.012), a);
    let nr = norm(cross(sub(pt, p), sub(pa, p)));
    if (dot(nr, sub(p, [0, Y.cyAt(t), Y.zAt(t)])) < 0) nr = mul(nr, -1);
    const tz = norm(sub(pt, p)), sd = norm(cross(nr, tz));
    B.stroke(add(p, mul(nr, lift)), norm(add(mul(tz, Math.cos(tilt || 0)), mul(sd, Math.sin(tilt || 0)))), nr, len, wid, col, { seed: rnd() });
  };
  B.part = WP.BODY; B.limb0 = 0; B.limb1 = 1; B.flutter = 0;
  if (S.marks === 'dapple') {
    // eighteen pale dabs over the upper flank, in two loose rows, as a fawn's are
    for (let i = 0; i < 18; i++) {
      const t = 0.18 + 0.62 * rnd(), a = (i % 2 ? 1 : -1) * (0.18 + 0.30 * rnd()) * Math.PI + Math.PI * 0.5;
      const d = S.len * (0.030 + 0.016 * rnd());
      put(t, a, d, d * 0.9, C.mark, rnd() * 3);
    }
  } else if (S.marks === 'rump') {
    for (let i = 0; i < 7; i++) {
      const t = 0.88 + 0.08 * rnd(), a = Math.PI * (0.5 + (rnd() - 0.5) * 0.9);
      put(t, a, S.len * 0.085, S.len * 0.055, C.pale, (rnd() - 0.5) * 0.8);
    }
  } else if (S.marks === 'bib') {
    for (let i = 0; i < 6; i++) {
      const t = 0.03 + 0.12 * rnd(), a = -Math.PI * (0.5 + (rnd() - 0.5) * 0.5);
      put(t, a, S.len * 0.075, S.len * 0.055, C.pale, (rnd() - 0.5) * 0.8);
    }
  } else if (S.marks === 'mask') {
    // the badger: two dark bands along the head, from the muzzle over the eye to the ear. Pieces, not a line.
    B.part = WP.HEAD;
    const hc = add(Y.poll, mul(Y.hDir, S.head * 0.30)), hrx = S.head * 0.30, hry = S.head * 0.33, hrz = S.head * 0.42;
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      const u = i / 2;
      const p = [hc[0] + s * hrx * (0.66 + 0.2 * u), hc[1] + hry * (0.34 - 0.1 * u), hc[2] - hrz * (0.62 - 1.0 * u)];
      B.stroke(p, norm([0, 0.12, -0.99]), norm([s * 0.9, 0.3, -0.3]), S.head * 0.34, S.head * 0.14, C.mark, { seed: rnd() });
    }
  }
}

// =================================================================================================
// THE FAR TIER: ONE geometry for every walker on the world.
// =================================================================================================
// Measured by the design's own arithmetic on the owner's phone: a 1.5 m animal is 10.8 px tall at 60 m,
// 2.2 px at 300 m and 0.4 px at a mile. Beyond about 180 m the difference between a fox and a deer IS the
// scale and the colour, so every far walker shares one mesh -- one draw call for all of them -- and tells
// the shader which species it is with a per-instance index (aSpec.x), exactly as the far trees already
// choose their washes out of uniform tables of eight (materials.js:1533, :2402-2414).
//
// SO THE FAR GEOMETRY'S `color` IS NOT A COLOUR. It carries the three BLEND WEIGHTS (back, side, belly),
// which always sum to about one, and the material mixes the species' own three washes with them:
//     vec3 c = uHideA[si] * color.r + uHideB[si] * color.g + uHideC[si] * color.b;
// One line, no extra attribute, and a hundred species out of one mesh. geo.userData.washWeights says so.
const WASH_W = { back: [1, 0, 0], side: [0, 1, 0], belly: [0, 0, 1], dark: [0.42, 0.58, 0], pale: [0.18, 0.30, 0.52], mark: [0.15, 0.25, 0.60] };
// the median walker the far mesh is built at: a row halfway between a deer and a fox, so no species is
// stretched more than about twice either way by its instance scale
export const FAR_SHAPE = { plan: 'walker', high: 0.70, legF: 0.55, len: 0.80, girth: 0.78, neck: 0.26, neckUp: 0.58, head: 0.22, snout: 0.70, ear: 0.12, earUp: 0.82, tail: 0.20, brush: 0.4, horn: 0, limbW: 0.9, coat: 0, marks: 'rump', col: WASH_W };

export function beastFarGeometry(seed) {
  const g = beastGeometry(FAR_SHAPE, seed == null ? 7 : seed, 1, { col: WASH_W, coat: 0 });
  g.userData.washWeights = true;
  g.userData.unitHeight = FAR_SHAPE.high;       // instance scale = the species' height / this
  return g;
}

// ---- the species table the far material reads ------------------------------------------------------
// uHideA/uHideB/uHideC[16] = (r, g, b, unused); uBProp[16] = (height m, length m, leg length m, stride m).
// Sixteen is the table's size, as the far trees' is eight; growing it is one number here and one in the
// shader, and 16 x 4 vec4 is 64 of WebGL2's guaranteed 256.
export const MAX_SPECIES = 16;
export function speciesUniforms(rows) {
  const A = new Float32Array(MAX_SPECIES * 4), Bb = new Float32Array(MAX_SPECIES * 4), Cc = new Float32Array(MAX_SPECIES * 4), prop = new Float32Array(MAX_SPECIES * 4);
  const n = Math.min(MAX_SPECIES, rows.length);
  for (let i = 0; i < n; i++) {
    const S = typeof rows[i] === 'string' ? SHAPES[rows[i]] : rows[i], c = S.col;
    A[i * 4] = c.back[0]; A[i * 4 + 1] = c.back[1]; A[i * 4 + 2] = c.back[2];
    Bb[i * 4] = c.side[0]; Bb[i * 4 + 1] = c.side[1]; Bb[i * 4 + 2] = c.side[2];
    Cc[i * 4] = c.belly[0]; Cc[i * 4 + 1] = c.belly[1]; Cc[i * 4 + 2] = c.belly[2];
    const legLen = S.high * S.legF;
    prop[i * 4] = S.high; prop[i * 4 + 1] = S.len; prop[i * 4 + 2] = legLen; prop[i * 4 + 3] = legLen * 1.7;
  }
  return { hideA: A, hideB: Bb, hideC: Cc, prop, count: n };
}

// How tall a thing of `h` metres is in PIXELS at `d` metres, on the picture the game is actually drawing.
// The hand-over distances between the three drawings are set by THIS and never by metres: the painter's own
// notes record that the trees' first ranges were wrong on the phone for exactly that reason.
export function pixelHeight(h, d, screenH, fovDeg) {
  return (screenH * 0.5) * h / (Math.max(0.01, d) * Math.tan((fovDeg || 58) * Math.PI / 360));
}
export function distanceForPixels(h, px, screenH, fovDeg) {
  return (screenH * 0.5) * h / (Math.max(0.01, px) * Math.tan((fovDeg || 58) * Math.PI / 360));
}
