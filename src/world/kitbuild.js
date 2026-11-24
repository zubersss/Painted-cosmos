// Painted Cosmos: the pieces every plant is built from (a mesh builder, tubes, blobs, leaf cards, strokes).
// OWNER: PAINTER. Pure geometry: no page, no game state.
//
// These lived in florakit.js until 2026-11-18, when the four new kinds of tree were given files of their own under
// kits/. A kit needs these pieces, and florakit.js needs the kits, so leaving them where they were made a ring of
// imports - which the physics' own load test catches, because a ring breaks for some orders of loading. They sit
// here instead, below both, and nothing imports upward.
import * as THREE from 'three';
import { mulberry32, smoothstep } from './noise.js';

export class Builder {
  // (PHYSICS' crown, P14: `aBranchId` one number for every vertex of a branch and the foliage it carries, -1 on the
  // trunk; `aLeaf01` 1 on foliage. `branch` is the number the next tube or blob is laid with)
  // (`aCard`, the oil look's leaves: the centre of the leaf a vertex belongs to, so the shader can light a leaf whole;
  // on everything else the vertex's own place. `card` is the centre the next vertices are laid with.)
  constructor() { this.p = []; this.n = []; this.m = []; this.uv = []; this.d = []; this.idx = []; this.br = []; this.lf = []; this.cd = []; this.branch = -1; this.card = null; this.axis = false; }
  get count() { return this.p.length / 3; }
  vert(px, py, pz, nx, ny, nz, mx, my, mz, u, v, sway, part, shade, hash) {
    this.p.push(px, py, pz); this.n.push(nx, ny, nz); this.m.push(mx, my, mz); this.uv.push(u, v); this.d.push(sway, part, shade, hash);
    this.br.push(this.branch); this.lf.push(part === 1 || part === 3 || part === 5 || part === 7 ? 1 : 0);
    if (this.card) this.cd.push(this.card[0], this.card[1], this.card[2]); else this.cd.push(px, py, pz);
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
    g.setAttribute('aBranchId', new THREE.BufferAttribute(new Float32Array(this.br), 1));
    g.setAttribute('aLeaf01', new THREE.BufferAttribute(new Float32Array(this.lf), 1));
    g.setAttribute('aCard', new THREE.BufferAttribute(new Float32Array(this.cd), 3));
    g.setIndex(this.count > 65535 ? new THREE.BufferAttribute(new Uint32Array(this.idx), 1) : new THREE.BufferAttribute(new Uint16Array(this.idx), 1));
    g.computeBoundingSphere();
    return g;
  }
}

// THE OIL LOOK'S LEAVES BY DISTANCE (flora.js, materials.js PROP_VERT: uLeafLod). A crown of leaves laid one by one
// is some 1,500 leaves, 3,000 triangles; a wood drew three and a half million of them every frame, twice (the picture
// and the shadow map), and the owner's phone drew nine pictures a second. Far off, a share of the leaves is drawn and
// each a little larger, so the crown stays as full: every leaf has a number (aData.w), and the leaves with the highest
// numbers are the ones kept. Here the triangles are put in that order (everything that is not a leaf first, then the
// leaves from the highest number down), so that a mesh draws only the first part of its index and the rest costs
// nothing at all. Only the order of the triangles changes; called for the oil look's trees alone.

// A tube along a path of points with radii. Normals are radial (smooth).
export function tube(B, pts, radii, sides, opts) {
  const o = Object.assign({ part: 0, shade: 0, hash: 0.5, sway0: 0, swayK: 0, swayH: 1, vScale: 1, v0: 0, cap: true }, opts || {});
  B.branch = o.branch != null ? o.branch : o.swayH > 1.5 ? -1 : (o.hash * 7.13) % 1;     // (a trunk carries -1; any other tube is its own branch)
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
    // (Builder.axis, the trees' two short programs, ?trees2=: every vertex of a ring carries the ring's centre in aCard,
    //  so the wood's vertex shader can pinch a branch in to its own line round the lens with no discard:
    //  materials.js PROP_VERT, PC_TREE_WOOD. Off, aCard is the vertex's own place, as it always was.)
    if (B.axis) B.card = [p.x, p.y, p.z];
    for (let s = 0; s <= sides; s++) {
      const ang = (s / sides) * Math.PI * 2, ca = Math.cos(ang), sa = Math.sin(ang);
      const nx = a.x * ca + b.x * sa, ny = a.y * ca + b.y * sa, nz = a.z * ca + b.z * sa;
      ring.push(B.vert(p.x + nx * radii[i], p.y + ny * radii[i], p.z + nz * radii[i], nx, ny, nz, nx, ny, nz, s / sides, vv, sway, o.part, o.shade, o.hash));
    }
    rings.push(ring);
  }
  if (B.axis) B.card = null;
  for (let i = 0; i < rings.length - 1; i++) for (let s = 0; s < sides; s++) {
    const p0 = rings[i][s], p1 = rings[i][s + 1], q0 = rings[i + 1][s], q1 = rings[i + 1][s + 1];
    B.tri(p0, q0, p1); B.tri(p1, q0, q1);
  }
}

// A noisy ellipsoid blob (foliage mass or rock). detail 1 = 80 triangles.

// A noisy ellipsoid blob (foliage mass or rock). detail 1 = 80 triangles.
const _ico = {};

export function ico(detail) {
  if (!_ico[detail]) {
    const g = new THREE.IcosahedronGeometry(1, detail);
    _ico[detail] = { p: g.attributes.position.array, uv: g.attributes.uv.array, n: g.attributes.position.count };
  }
  return _ico[detail];
}

export function blob(B, c, rx, ry, rz, rnd, opts) {
  const o = Object.assign({ detail: 1, part: 1, noise: 0.22, rough: 0, ledge: 0, ledgeF: 9, droop: 0, massC: null, massK: 0.6, sway: 0.5, shade0: 0, shadeK: 0.7, hash: rnd(), uvScale: 3, flatBottom: 0, taper: 0, uvT: false }, opts || {});
  B.branch = o.branch != null ? o.branch : (o.hash * 7.13) % 1;     // (a mass of foliage is its own branch unless given one)
  const I = ico(o.detail);
  const mc = o.massC || c;
  const ph1 = rnd() * 6.28, ph2 = rnd() * 6.28, ph3 = rnd() * 6.28;
  const base = B.count;
  for (let i = 0; i < I.n; i++) {
    let x = I.p[i * 3], y = I.p[i * 3 + 1], z = I.p[i * 3 + 2];
    // smooth lumpy displacement: a few low sine lobes so shared vertices stay welded
    // (`rough`: a second, finer set of lobes, so a big form's outline is broken; `ledge`: the girth steps in and out with height, wind-carved strata)
    const k = 1 + o.noise * (Math.sin(x * 3.1 + ph1) * Math.sin(y * 2.7 + ph2) + 0.6 * Math.sin(z * 4.3 + ph3 + x * 1.9))
      + (o.rough ? o.rough * (Math.sin(x * 8.3 + ph2) * Math.sin(z * 7.1 + ph1 + y * 5.0) + 0.5 * Math.sin(y * 13.0 + ph3 + x * 6.0 + z * 4.0)) : 0);
    const tp = (1 - o.taper * (y * 0.5 + 0.5)) * (o.ledge ? 1 + o.ledge * Math.sin(y * o.ledgeF + ph1 + 0.8 * Math.sin(x * 2.3 + z * 1.7 + ph2)) : 1);
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

// LEAVES AS STROKES (the oil look; the owner's overhaul 2, docs/HANDOVER.md 4a-2 on r2). The reference clip's crowns
// are not lumps: they are separate leaf-shaped pieces of flat colour on dark branches, with the sky between them. Here a
// mass of foliage is a cloud of such pieces: each a flat lozenge pointed at both ends (two triangles: its outline is
// geometry, so it is crisp at any size and needs no cut-out), most near the skin of the mass and a few inside, lying
// every way and drooping a little, facing more or less out of the mass. part 5; `aCard` carries each leaf's centre.
//   o.n how many, o.len / o.wid a leaf's length and width (m), o.massC / o.massK the crown's centre and how far a
//   leaf's light follows the crown's roundness, o.shade0 / o.shadeK the shade of the inner leaves, o.droop

// LEAVES AS STROKES (the oil look; the owner's overhaul 2, docs/HANDOVER.md 4a-2 on r2). The reference clip's crowns
// are not lumps: they are separate leaf-shaped pieces of flat colour on dark branches, with the sky between them. Here a
// mass of foliage is a cloud of such pieces: each a flat lozenge pointed at both ends (two triangles: its outline is
// geometry, so it is crisp at any size and needs no cut-out), most near the skin of the mass and a few inside, lying
// every way and drooping a little, facing more or less out of the mass. part 5; `aCard` carries each leaf's centre.
//   o.n how many, o.len / o.wid a leaf's length and width (m), o.massC / o.massK the crown's centre and how far a
//   leaf's light follows the crown's roundness, o.shade0 / o.shadeK the shade of the inner leaves, o.droop
export function leafCards(B, c, rx, ry, rz, rnd, opts) {
  const o = Object.assign({ n: 80, len: 0.42, wid: 0.17, part: 5, massC: null, massK: 0.6, sway: 0.6, shade0: 0, shadeK: 0.7, droop: 0.3, round: 0 }, opts || {});
  B.branch = o.branch != null ? o.branch : (rnd() * 7.13) % 1;
  const mc = o.massC || c;
  for (let i = 0; i < o.n; i++) {
    let x, y, z, l2;
    do { x = rnd() * 2 - 1; y = rnd() * 2 - 1; z = rnd() * 2 - 1; l2 = x * x + y * y + z * z; } while (l2 > 1 || l2 < 0.02);
    const l = Math.sqrt(l2), k = Math.pow(l, 0.35) / l;      // pushed toward the skin
    x *= k; y *= k; z *= k;
    const px = c.x + x * rx, py = c.y + y * ry - o.droop * (x * x + z * z) * ry, pz = c.z + z * rz;
    let ax = rnd() * 2 - 1, ay = (rnd() * 2 - 1) * 0.6 - 0.25, az = rnd() * 2 - 1;
    const al = Math.hypot(ax, ay, az) || 1; ax /= al; ay /= al; az /= al;
    const ox = x + (rnd() - 0.5) * 0.9, oy = y + 0.35 + (rnd() - 0.5) * 0.9, oz = z + (rnd() - 0.5) * 0.9;
    let sx = ay * oz - az * oy, sy = az * ox - ax * oz, sz = ax * oy - ay * ox, sl = Math.hypot(sx, sy, sz);
    if (sl < 1e-4) { sx = 1; sy = 0; sz = 0; sl = 1; }
    sx /= sl; sy /= sl; sz /= sl;
    const nx = sy * az - sz * ay, ny = sz * ax - sx * az, nz = sx * ay - sy * ax;
    const L = o.len * (0.7 + 0.6 * rnd()) * 0.5, W = o.wid * (0.7 + 0.6 * rnd()) * 0.5;
    let mx = px - mc.x, my = py - mc.y, mz = pz - mc.z;
    const ml = Math.hypot(mx, my, mz) || 1;
    mx = nx + (mx / ml - nx) * o.massK; my = ny + (my / ml - ny) * o.massK; mz = nz + (mz / ml - nz) * o.massK;
    const m2 = Math.hypot(mx, my, mz) || 1; mx /= m2; my /= m2; mz /= m2;
    const shade = Math.min(1, Math.max(0, o.shade0 + o.shadeK * (1 - l) + 0.25 * (0.5 - y * 0.5)));
    const hash = rnd();
    B.card = [px, py, pz];
    // (the widest point a little toward the stalk, as a leaf's is)
    const wx = px - ax * L * 0.2, wy = py - ay * L * 0.2, wz = pz - az * L * 0.2;
    if (o.round) {
      // (a leaf's own outline, six corners: a plant near the eye in four-cornered leaves was a heap of kites, plain polygons)
      const q = (t, k) => B.vert(px + ax * L * t + sx * W * k, py + ay * L * t + sy * W * k, pz + az * L * t + sz * W * k, nx, ny, nz, mx, my, mz, t, k, o.sway, o.part, shade, hash);
      const a0 = q(-1, 0), a1 = q(-0.55, 0.78), a2 = q(0.15, 0.92), a3 = q(1, 0), a4 = q(0.15, -0.92), a5 = q(-0.55, -0.78);
      B.tri(a0, a1, a5); B.tri(a1, a2, a5); B.tri(a2, a4, a5); B.tri(a2, a3, a4);
      B.card = null;
      continue;
    }
    const v0 = B.vert(px - ax * L, py - ay * L, pz - az * L, nx, ny, nz, mx, my, mz, -1, 0, o.sway, o.part, shade, hash);
    const v1 = B.vert(wx + sx * W, wy + sy * W, wz + sz * W, nx, ny, nz, mx, my, mz, 0, 1, o.sway, o.part, shade, hash);
    const v2 = B.vert(px + ax * L, py + ay * L, pz + az * L, nx, ny, nz, mx, my, mz, 1, 0, o.sway, o.part, shade, hash);
    const v3 = B.vert(wx - sx * W, wy - sy * W, wz - sz * W, nx, ny, nz, mx, my, mz, 0, -1, o.sway, o.part, shade, hash);
    B.tri(v0, v1, v2); B.tri(v0, v2, v3);
    B.card = null;
  }
}

// A CLUSTER OF LEAVES ON ONE CARD (the trees to 30 a second, package T2, 2026-11-24; docs/lead/TREES-DESIGN.md on
// r2; only with ?trees2=1). A crown laid one leaf at a time is some 1,300 leaves, 5,200 triangles, every one of them a
// shape the graphics card has to set up even when it is a few pixels big. Here a clump of leaves is ONE flat
// six-cornered card, and the leaves on it are not geometry at all: the plant's leaf program (materials.js
// CLUSTER_FRAG) finds, for each pixel of the card, the leaf dab that lies there in the baked layer of dabs the ground
// already uses (dabtex.js), and lays that leaf whole -- lit, shaded and coloured at its own exact centre -- or lets
// the sky through. Four triangles carry a dozen leaves.
//   c the card's centre; n the way it faces; t a way along it (made square to n here); R the radius of its corners
//   (m); o.cell the dab layer's cell on this card (m: about half a leaf's length). Every corner carries the centre
//   (aCard), the card's own mass normal (o.mass: the crown's roundness, for its light), and, in uv, where the corner
//   lies on the card along t and along n x t IN CELLS: so the shader has the card's whole frame, and the size of its
//   leaves, from any one corner, and needs no number of the kind's own (materials.js PROP_VERT, PC_TREE_CARD;
//   dabtex.js SPRAY_GLSL). part 7.
export function clusterCard(B, c, n, t, R, opts) {
  const o = Object.assign({ part: 7, sway: 0.6, shade: 0, hash: 0.5, mass: null, rot: 0, cell: 0.28 }, opts || {});
  if (o.branch != null) B.branch = o.branch;
  let nx = n.x, ny = n.y, nz = n.z; let l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
  let ux = t.x, uy = t.y, uz = t.z; const k = ux * nx + uy * ny + uz * nz; ux -= nx * k; uy -= ny * k; uz -= nz * k;
  l = Math.hypot(ux, uy, uz);
  if (l < 1e-4) { ux = Math.abs(nx) < 0.9 ? 1 : 0; uy = Math.abs(nx) < 0.9 ? 0 : 1; uz = 0; const k2 = ux * nx + uy * ny; ux -= nx * k2; uy -= ny * k2; uz -= nz * k2; l = Math.hypot(ux, uy, uz) || 1; }
  ux /= l; uy /= l; uz /= l;
  const vx = ny * uz - nz * uy, vy = nz * ux - nx * uz, vz = nx * uy - ny * ux;
  const m = o.mass || { x: nx, y: ny, z: nz };
  B.card = [c.x, c.y, c.z];
  const ids = [];
  for (let i = 0; i < 6; i++) {
    const a = o.rot + i * Math.PI / 3, cu = Math.cos(a) * R, cv = Math.sin(a) * R;
    ids.push(B.vert(c.x + ux * cu + vx * cv, c.y + uy * cu + vy * cv, c.z + uz * cu + vz * cv, nx, ny, nz, m.x, m.y, m.z, cu / o.cell, cv / o.cell, o.sway, o.part, o.shade, o.hash));
  }
  B.tri(ids[0], ids[1], ids[5]); B.tri(ids[1], ids[2], ids[5]); B.tri(ids[2], ids[4], ids[5]); B.tri(ids[2], ids[3], ids[4]);
  B.card = null;
}

// A single tapered stroke (grass blade, fern frond): a ribbon that arches outward.
export function stroke(B, root, dir, len, width, arch, rnd, opts) {
  const o = Object.assign({ segs: 3, part: 2, hash: rnd(), sway: 0.25, leaf: 0, twist: 0 }, opts || {});
  B.branch = o.branch != null ? o.branch : -1;
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

export function V(x, y, z) { return new THREE.Vector3(x, y, z); }

// ---------------------------------------------------------------------------------------------
// lod: 0 full (near), 1 medium (two washes and a trunk)
// (spec.slender, the oil look's woods: a tall straight stem, bare for two thirds of its height, under a small thin crown,
// so that from the ground a wood is its trunks against the air, as in the owner's reference clip. Without it the
// tree is exactly what it was: the slender form draws its own numbers only where it differs.)
// A FIR OF THE SNOW (the oil look only; the owner's reference pictures of 2026-11-16, described in
// docs/references/README.md on r2: dark green firs, full to the ground, every bough loaded with snow). A straight stem
// and tiers of drooping boughs from near the ground to the tip: each tier its needles one by one (leafCards), with
// snow lying on it: pale pieces of their own (part 6), each larger than a needle. Farther off (lod 1): fewer tiers,
// larger pieces.
