// Painted Cosmos: flora built from stroke clusters, all generated in code. OWNER: PAINTER.
// Every plant is a few soft forms: wobbly tapered tubes for trunks, noisy blobs with a ragged
// dabbed edge for foliage masses, single tapered strokes for blades and fronds.
//
// Vertex layout (see PROP shader in src/render/materials.js):
//   position, normal, uv, aMass (soft normal of the whole mass),
//   aData = (sway, part, inner shade, blob hash); part: 0 bark, 1 foliage, 2 blade, 3 accent, 4 rock
import * as THREE from 'three';
import { mulberry32, smoothstep } from './noise.js';
import { Builder, tube, blob, leafCards, stroke, V, ico } from './kitbuild.js';
export { Builder, tube, blob, leafCards, stroke, V } from './kitbuild.js';
import { mapleGeometry } from './kits/maple.js';
import { spruceGeometry } from './kits/spruce.js';
import { aspenGeometry } from './kits/aspen.js';
import { tallPineGeometry } from './kits/pine.js';
import { groveGeometry } from './kits/grove.js';

// Physical hints per kit for PHYSICS (C14): model height in metres before the instance scale,
// and stiffness (0 = bends like grass, 1 = a tree).
export const FLORA_PHYS = {
  grass: { height: 0.5, stiffness: 0 }, reed: { height: 1.4, stiffness: 0.05 }, fern: { height: 0.6, stiffness: 0.05 },
  flower: { height: 0.58, stiffness: 0 }, bush: { height: 1.3, stiffness: 0.35 },
  birch: { height: 13, stiffness: 1 }, pine: { height: 18, stiffness: 1 }, farTree: { height: 1, stiffness: 1 },
};

export function sortLeafCards(geo) {
  const idx = geo.index.array, d = geo.attributes.aData.array, nT = idx.length / 3;
  const rest = [], cards = [];
  for (let t = 0; t < nT; t++) { const part = d[idx[t * 3] * 4 + 1]; if (part > 4.5 && part < 6.5) cards.push(t); else rest.push(t); }
  if (!cards.length) return geo;
  const hOf = (t) => d[idx[t * 3] * 4 + 3];
  cards.sort((p, q) => hOf(q) - hOf(p) || p - q);
  const out = new idx.constructor(idx.length);
  let o = 0;
  for (const t of rest) { out[o++] = idx[t * 3]; out[o++] = idx[t * 3 + 1]; out[o++] = idx[t * 3 + 2]; }
  const base = o, hs = new Float32Array(cards.length);
  for (let i = 0; i < cards.length; i++) { const t = cards[i]; hs[i] = hOf(t); out[o++] = idx[t * 3]; out[o++] = idx[t * 3 + 1]; out[o++] = idx[t * 3 + 2]; }
  geo.setIndex(new THREE.BufferAttribute(out, 1));
  geo.userData.leaf = { base, hs };
  return geo;
}
// How much of a sorted index to draw so that every leaf whose number is over `thr` is drawn.
export function leafDrawCount(leaf, thr) {
  const hs = leaf.hs;
  let lo = 0, hi = hs.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (hs[m] > thr) lo = m + 1; else hi = m; }
  return leaf.base + lo * 3;
}

export function firGeometry(seed, lod) {
  const rnd = mulberry32(seed), B = new Builder();
  const H = 6.5 + rnd() * 4.5, lean = (rnd() - 0.5) * 0.5, lz = (rnd() - 0.5) * 0.4;
  const segs = lod === 0 ? 4 : 2, sides = lod === 0 ? 6 : 4, pts = [], rad = [];
  for (let i = 0; i <= segs; i++) { const t = i / segs; pts.push(V(lean * t * t, t * H, lz * t * t)); rad.push((0.17 - 0.15 * t) * (i === 0 ? 1.4 : 1)); }
  tube(B, pts, rad, sides, { part: 0, swayK: 0.3, swayH: H, hash: rnd() });
  if (lod === 0) tube(B, [V(0, -0.25, 0), V(0, 0.03, 0), V(pts[1].x * 0.3, 0.45, pts[1].z * 0.3)], [rad[0] * 2.0, rad[0] * 1.5, rad[0] * 0.98], sides, { part: 0, swayK: 0, swayH: H, hash: rnd() });
  const crownC = V(lean * 0.4, H * 0.45, lz * 0.4), Rb = H * (0.25 + rnd() * 0.06);
  // (twelve tiers of small needles near by: with nine tiers of larger ones the fir was thin, and near the eye its
  // needles were shards)
  const tiers = lod === 0 ? 12 : 6, big = lod === 0 ? 1 : 1.8;
  for (let k = 0; k < tiers; k++) {
    const t = k / (tiers - 1), y = H * (0.09 + 0.87 * t);
    const r = (Rb * Math.pow(1 - t, 0.85) + 0.16) * (0.9 + rnd() * 0.2), ry = r * 0.20 + 0.10;
    const c = V(lean * (y / H) * (y / H), y, lz * (y / H) * (y / H));
    leafCards(B, c, r, ry, r, rnd, { n: Math.round(lod === 0 ? 30 + 80 * (1 - t) : 12 + 30 * (1 - t)), len: 0.46 * big, wid: 0.17 * big, massC: crownC, massK: 0.5, sway: 0.25 + 0.4 * t, shade0: 0.12 + 0.22 * (1 - t), shadeK: 0.6, droop: 1.5 });
    // (the snow on the bough: on its upper side, out to three quarters of its reach)
    leafCards(B, V(c.x, c.y + ry * 0.8, c.z), r * 0.78, ry * 0.30, r * 0.78, rnd, { n: Math.round(lod === 0 ? 10 + 26 * (1 - t) : 4 + 10 * (1 - t)), len: 0.58 * big, wid: 0.30 * big, part: 6, massC: crownC, massK: 0.2, sway: 0.25 + 0.4 * t, shade0: 0, shadeK: 0, droop: 1.5, round: 1 });
  }
  return B.build();
}

// A BARE TREE OF THE SNOW (the oil look only; the same two pictures: slender stems in groups, each ending in a haze of
// fine bare twigs). A slender stem that bends a little, boughs from a third of its height that fork, and at the
// boughs' ends the twigs: thin slivers one by one (leafCards, painted in the kind's "leaf" washes, which are its twigs'
// colours), so that a crown is a haze of fine strokes and no tube is thinner than the pixel can carry.
export function bareGeometry(seed, lod) {
  const rnd = mulberry32(seed), B = new Builder();
  const H = 6.0 + rnd() * 3.5, lean = (rnd() - 0.5) * 1.2, lz = (rnd() - 0.5) * 0.9, ph = rnd() * 3;
  const segs = lod === 0 ? 7 : 3, sides = lod === 0 ? 6 : 4, pts = [], rad = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    pts.push(V(lean * t * t + 0.25 * Math.sin(t * 3.1 + ph) * t, t * H, lz * t * t + 0.18 * Math.cos(t * 2.3 + ph) * t));
    rad.push((0.115 - 0.090 * Math.pow(t, 0.8)) * (i === 0 ? 1.3 : 1));
  }
  tube(B, pts, rad, sides, { part: 0, swayK: 0.5, swayH: H, hash: rnd() });
  if (lod === 0) tube(B, [V(pts[0].x, -0.25, pts[0].z), V(pts[0].x, 0.03, pts[0].z), V(pts[0].x + (pts[1].x - pts[0].x) * 0.3, 0.45, pts[0].z + (pts[1].z - pts[0].z) * 0.3)], [rad[0] * 2.1, rad[0] * 1.5, rad[0] * 0.98], sides, { part: 0, swayK: 0, swayH: H, hash: rnd() });
  const at = (t) => { const f = Math.min(0.9999, Math.max(0, t)) * segs, i = Math.floor(f), k = f - i; return pts[i].clone().lerp(pts[i + 1], k); };
  const crownC = V(pts[segs].x * 0.8, H * 0.75, pts[segs].z * 0.8);
  const nb = lod === 0 ? 9 : 5, big = lod === 0 ? 1 : 1.6;
  for (let k = 0; k < nb; k++) {
    const up = k / (nb - 1), t0 = 0.34 + 0.62 * up + rnd() * 0.03, p0 = at(t0), ang = k * 2.4 + rnd() * 1.2;
    const len = (1.9 - 1.1 * up) * (0.8 + 0.4 * rnd()), rise = 0.85 + 0.35 * up;
    const p1 = V(p0.x + Math.cos(ang) * len * 0.50, p0.y + len * rise * 0.50, p0.z + Math.sin(ang) * len * 0.50);
    const p2 = V(p0.x + Math.cos(ang) * len * 0.85, p0.y + len * rise * 1.05, p0.z + Math.sin(ang) * len * 0.85);
    const bid = (k * 0.618034 + 0.13) % 1;
    // (2026-11-19, the owner: "it looks like spiders not trees".) A BOUGH IS A CURVE, NOT TWO BARS WITH A CORNER.
    // `tube` joins the points it is given with STRAIGHT sections, so [p0, p1, p2] is two straight bars meeting at a
    // hard corner at p1, and that corner is what reads as a KNEE. The three points are a quadratic's worth of
    // information already; sampling it at five gives the references' "LONG FLOWING STROKES" for one more ring.
    // ONLY IN THE OIL LOOK: this is the watercolour game's own tree, and its boughs must not move by a millimetre
    // (a session was caught by the pixel gate doing exactly that -- see the conifer's note below).
    tube(B, oilCurve(p0, p1, p2, spec), oilCurveR(spec, [0.042, 0.028, 0.016]), 4, { part: 0, shade: 0.5, sway0: 0.4, hash: rnd(), branch: bid });
    if (lod === 0) for (let j = 0; j < 2; j++) {
      const a2 = ang + (j ? 1.0 : -0.9) + (rnd() - 0.5) * 0.5, l2 = 0.55 + rnd() * 0.5, q0 = p1.clone().lerp(p2, 0.25 + 0.4 * j);
      tube(B, [q0, V(q0.x + Math.cos(a2) * l2 * 0.6, q0.y + l2 * 0.85, q0.z + Math.sin(a2) * l2 * 0.6)], [0.020, 0.012], 3, { part: 0, shade: 0.5, sway0: 0.6, hash: rnd(), branch: bid });
    }
    // (the twigs at the bough's end and round it)
    leafCards(B, V(p2.x, p2.y + 0.15, p2.z), 0.75 * big, 0.62 * big, 0.75 * big, rnd, { n: lod === 0 ? 40 : 16, len: 0.62 * big, wid: 0.040 * big, branch: bid, massC: crownC, massK: 0.3, sway: 0.6 + 0.3 * up, shade0: 0, shadeK: 0.3, droop: -0.2 });
  }
  leafCards(B, V(pts[segs].x, H + 0.2, pts[segs].z), 0.5 * big, 0.6 * big, 0.5 * big, rnd, { n: lod === 0 ? 26 : 10, len: 0.6 * big, wid: 0.040 * big, massC: crownC, massK: 0.3, sway: 0.9, shade0: 0, shadeK: 0.3, droop: -0.2 });
  return B.build();
}

export function birchGeometry(seed, lod, spec) {
  const rnd = mulberry32(seed), B = new Builder();
  const sl = !!(spec && spec.slender);
  // (spec.leafy, the oil look on every world: the tree's own form, its crown in leaves one by one (leafCards) where it
  // had lumpy washes: laid in dabs, those stood as brown lumps with dark seams, on Saturn's islands and in every wood)
  const leafy = !!(spec && spec.leafy) && !sl;
  // (the oil look's tree stood 16 to 20 m with its crown out of the picture: the clip's trees are about twelve metres,
  // their boughs beginning a few metres up, so the crowns fill the top of a view from the ground)
  const H = sl ? 11.5 + rnd() * 4 : 10.5 + rnd() * 2.5;
  // no two trunks alike: lean, an S-bend, and small kinks from ring to ring
  const lk = sl ? 0.45 : 1;
  const lean = (rnd() - 0.5) * 2.4 * lk, bend = (rnd() - 0.5) * 2.2 * lk, lz = (rnd() - 0.5) * 1.6 * lk, ph = rnd() * 3;
  const segs = lod === 0 ? 9 : 3, sides = lod === 0 ? 7 : 4;
  const pts = [], rad = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, y = t * H;
    const kink = lod ? 0 : 0.09;
    pts.push(V(lean * t * t + bend * Math.sin(t * 3.1 + ph) * 0.32 * t + (rnd() - 0.5) * kink, y, lz * t * t + bend * Math.cos(t * 2.3 + ph) * 0.2 * t + (rnd() - 0.5) * kink));
    rad.push((sl ? 0.165 - 0.105 * Math.pow(t, 0.8) : 0.225 - 0.165 * Math.pow(t, 0.75)) * (i === 0 ? (sl ? 1.3 : 1.5) : 1) * (0.86 + rnd() * 0.3));
  }
  tube(B, pts, rad, sides, { part: 0, swayK: 0.5, swayH: H, hash: rnd() });
  // (the oil look's tree: a foot. The stem spreads into the ground over its lowest half metre and goes on under it;
  // ending square on the floor it stood as a post set on a plane: the critic)
  if (sl && lod === 0) tube(B, [V(pts[0].x, -0.25, pts[0].z), V(pts[0].x, 0.03, pts[0].z), V(pts[0].x + (pts[1].x - pts[0].x) * 0.3, 0.55, pts[0].z + (pts[1].z - pts[0].z) * 0.3)], [rad[0] * 2.3, rad[0] * 1.6, rad[0] * 0.98], sides, { part: 0, swayK: 0, swayH: H, hash: rnd() });
  const top = pts[segs];
  const crownC = V(top.x * 0.85, H * (sl ? 0.76 : 0.72), top.z * 0.85);
  const at = (t) => { const f = Math.min(0.9999, Math.max(0, t)) * segs, i = Math.floor(f), k = f - i; return pts[i].clone().lerp(pts[i + 1], k); };
  if (lod === 0 && leafy) {
    // THE OIL LOOK'S BROADLEAF HAS A TREE'S OWN ARMATURE (2026-11-19, the owner: "it looks like spiders not trees").
    // MEASURED before this: the oil broadleaf was 2,862 triangles a tree of which 222 WERE WOOD -- ninety-two per
    // cent leaves and eight per cent of anything holding them up. It had THREE boughs, 6 cm thick and two metres
    // long, while six or seven separate clumps of leaf floated round the upper stem, each merely ASSIGNED to the
    // nearest bough tip. Nothing reached them. The watercolour game hides that under lumpy washes; the oil look
    // draws the leaves one by one, so what is left is a stick with three hairs and a cloud. That is the spider, and
    // it is what stands at the owner's own spawn (temperate_forest is broadleaf and conifer; the maple is elsewhere).
    // The references ask for one thing: "a HEAVY DARK STEM, BOUGHS SEEN THROUGH THE LEAVES", "forked low, boughs
    // reaching wide", "fork into boughs AND TWIGS", "ending in a haze of fine bare twigs". So: the clumps are
    // settled first, and a real bough is grown OUT TO EACH ONE -- sampled off a curve so it bends instead of
    // hinging, tapering to a fifth of its base, with a haze of fine twigs at its end inside the leaves.
    const nBlobs = 6 + ((rnd() * 2) | 0);
    const clumps = [];
    for (let k = 0; k < nBlobs; k++) {
      const t0 = 0.46 + 0.56 * (k / (nBlobs - 1)), p0 = at(t0);
      const spread = Math.max(0.2, (1.0 - Math.abs(t0 - 0.70) * 1.7)) * 2.3 + 0.2;
      const ang = k * 2.4 + rnd() * 1.2, rr = spread * (0.35 + 0.65 * rnd());
      const c = V(p0.x + Math.cos(ang) * rr, p0.y + (rnd() - 0.3) * 0.7 + (t0 > 1 ? (t0 - 1) * H : 0), p0.z + Math.sin(ang) * rr);
      clumps.push({ c, r: 1.9 + rnd() * 1.0, foot: at(Math.max(0.18, t0 - 0.30 - rnd() * 0.12)), bid: (k * 0.618034 + 0.13) % 1 });
    }
    // the stem's own girth where each bough leaves it, so a bough starts WIDE and the step is not a cliff
    const rAt = (y) => { const t = Math.max(0, Math.min(1, y / H)); return (0.225 - 0.165 * Math.pow(t, 0.75)); };
    for (const cl of clumps) {
      const p0 = cl.foot, p2 = cl.c, r0 = Math.max(0.035, rAt(p0.y) * 0.62);
      // the bough leaves the stem climbing and flattens as it reaches out, so the line sweeps instead of ramping
      const mid = V((p0.x + p2.x) * 0.5, (p0.y + p2.y) * 0.5 + (p2.y - p0.y) * 0.26 + 0.25, (p0.z + p2.z) * 0.5);
      const path = [], rr2 = [];
      for (let i = 0; i < 5; i++) { const t = i / 4, u = 1 - t;
        const cx = mid.x * 2 - (p0.x + p2.x) * 0.5, cy = mid.y * 2 - (p0.y + p2.y) * 0.5, cz = mid.z * 2 - (p0.z + p2.z) * 0.5;
        path.push(V(u * u * p0.x + 2 * u * t * cx + t * t * p2.x, u * u * p0.y + 2 * u * t * cy + t * t * p2.y, u * u * p0.z + 2 * u * t * cz + t * t * p2.z));
        rr2.push(r0 * (1 - 0.80 * Math.pow(t, 1.3))); }
      tube(B, path, rr2, 4, { part: 0, shade: 0.55, sway0: 0.4, hash: rnd(), branch: cl.bid });
      // and the haze of fine twigs at its end, inside the leaves, so the bough does not stop on a full stop
      for (let j = 0; j < 3; j++) {
        const a3 = rnd() * 6.283, e3 = 0.1 + rnd() * 0.9, lh = cl.r * (0.30 + 0.25 * rnd());
        const hx = Math.cos(a3) * Math.cos(e3), hy = Math.sin(e3), hz = Math.sin(a3) * Math.cos(e3);
        tube(B, [p2, V(p2.x + hx * lh * 0.5, p2.y + hy * lh * 0.5, p2.z + hz * lh * 0.5), V(p2.x + hx * lh, p2.y + hy * lh, p2.z + hz * lh)],
          [r0 * 0.26, r0 * 0.14, r0 * 0.05], 3, { part: 0, shade: 0.95, sway0: 0.9, hash: rnd(), branch: cl.bid });
      }
      leafCards(B, cl.c, cl.r * 1.10, cl.r * 0.78, cl.r * 1.05, rnd, { n: 200, len: 0.62, wid: 0.28, branch: cl.bid, massC: crownC, massK: 0.6, sway: 0.7 + 0.5 * (cl.c.y / H), shade0: 0.05, shadeK: 0.6 });
    }
  } else if (lod === 0) {
    // a few thin dark branches reaching into the crown (each its own number; a mass of foliage within 2.2 m of a
    // branch's tip is carried by it and swings with it, the others are branches of their own hidden in the wash)
    const tips = [];
    for (let k = 0; k < (sl ? 9 : 3); k++) {
      // (the oil look's tree, the overhaul plan's fifth piece: nine boughs from under half its height up, the low ones
      // long and nearly level, each carrying leaves at its end: the clip's crowns begin low and fill the upper half
      // of the picture; six short boughs near the top left the wood's roof thin and far)
      const t0 = (sl ? 0.34 + 0.068 * k : 0.40 + 0.16 * k) + rnd() * 0.06, p0 = at(t0);
      const low = sl ? 1 - k / 8 : 0;
      const ang = sl ? k * 2.4 + rnd() * 1.1 : rnd() * 6.283, len = sl ? 1.7 + 1.5 * low + rnd() * 1.5 : 1.9 + rnd() * 1.8;
      const rise = sl ? 0.78 - 0.42 * low : 0.78;
      // (the default tree's bough bends at exactly half its rise, as it always did: written as 0.78 * 0.64 it was 0.4992,
      // every bough of the watercolour game's trees a few millimetres lower: found by comparing the watercolour game's
      // picture on `main` and on this branch pixel for pixel, before the pull request)
      const p1 = V(p0.x + Math.cos(ang) * len * 0.55, p0.y + len * (sl ? rise * 0.64 : 0.5), p0.z + Math.sin(ang) * len * 0.55);
      const p2 = V(p0.x + Math.cos(ang) * len, p0.y + len * rise, p0.z + Math.sin(ang) * len);
      const bid = (k * 0.618034 + 0.13) % 1;
      tube(B, oilCurve(p0, p1, p2, spec), oilCurveR(spec, [0.06, 0.038, 0.014]), 4, { part: 0, shade: 0.8, sway0: 0.4, hash: rnd(), branch: bid });
      tips.push([p2, bid]);
      if (sl) { const r = 1.0 + 0.5 * low + rnd() * 0.4; leafCards(B, V(p2.x, p2.y + 0.2, p2.z), r * 1.15, r * 0.62, r * 1.15, rnd, { n: 104, len: 0.42, wid: 0.21, round: 1, branch: bid, massC: crownC, massK: 0.5, sway: 0.6 + 0.4 * (p2.y / H), shade0: 0.1 * low, shadeK: 0.5 }); }
    }
    // crown: a handful of large overlapping washes
    const nBlobs = sl ? 5 + ((rnd() * 2) | 0) : 6 + ((rnd() * 2) | 0);
    for (let k = 0; k < nBlobs; k++) {
      const t0 = sl ? 0.60 + 0.44 * (k / (nBlobs - 1)) : 0.46 + 0.56 * (k / (nBlobs - 1)), p0 = at(t0);
      const spread = sl ? Math.max(0.2, (1.0 - Math.abs(t0 - 0.78) * 2.2)) * 2.2 + 0.2 : Math.max(0.2, (1.0 - Math.abs(t0 - 0.70) * 1.7)) * 2.3 + 0.2;
      const ang = k * 2.4 + rnd() * 1.2, rr = spread * (0.35 + 0.65 * rnd());
      const c = V(p0.x + Math.cos(ang) * rr, p0.y + (rnd() - 0.3) * 0.7 + (t0 > 1 ? (t0 - 1) * H : 0), p0.z + Math.sin(ang) * rr);
      const r = sl ? 1.3 + rnd() * 0.8 : 1.9 + rnd() * 1.0;
      let bid = ((k + 3) * 0.618034 + 0.13) % 1, bd = 2.2;
      for (const [tp, id] of tips) { const dd = tp.distanceTo(c); if (dd < bd) { bd = dd; bid = id; } }
      // (the oil look's slender tree: the mass is leaves, one by one, florakit.js leafCards; else one lumpy wash)
      if (sl) leafCards(B, c, r * 1.3, r * 0.85, r * 1.3, rnd, { n: 160, len: 0.42, wid: 0.21, round: 1, branch: bid, massC: crownC, massK: 0.6, sway: 0.7 + 0.5 * (c.y / H), shade0: 0.0, shadeK: 0.6 });
      else if (leafy) leafCards(B, c, r * 1.10, r * 0.78, r * 1.05, rnd, { n: 200, len: 0.62, wid: 0.28, branch: bid, massC: crownC, massK: 0.6, sway: 0.7 + 0.5 * (c.y / H), shade0: 0.05, shadeK: 0.6 });      // (two hundred to a bough: with 125 a broad crown was a thin scatter, Saturn's island trees)
      else blob(B, c, r, r * (0.66 + rnd() * 0.2), r * (0.85 + rnd() * 0.3), rnd, { branch: bid, massC: crownC, massK: 0.55, sway: 0.7 + 0.5 * (c.y / H), shade0: 0.05 + 0.3 * (1 - (c.y - H * 0.45) / (H * 0.6)), droop: 0.25, uvScale: 3.4 });
    }
  } else if (sl) {
    // (farther off: fewer leaves, each twice the size, so the crown is still leaves and still as full)
    leafCards(B, V(top.x * 0.6 + 0.3, H * 0.58, top.z * 0.6 - 0.2), 3.6, 1.5, 3.5, rnd, { n: 70, len: 1.0, wid: 0.42, massC: crownC, massK: 0.5, sway: 0.6, shade0: 0.1 });
    leafCards(B, V(top.x * 0.8 + 0.4, H * 0.76, top.z * 0.8), 3.0, 2.0, 2.9, rnd, { n: 80, len: 0.95, wid: 0.40, massC: crownC, massK: 0.6, sway: 0.7 });
    leafCards(B, V(top.x * 0.95 - 0.3, H * 0.93, top.z * 0.95 + 0.2), 2.4, 1.9, 2.5, rnd, { n: 60, len: 0.95, wid: 0.40, massC: crownC, massK: 0.6, sway: 0.9 });
  } else if (leafy) {
    leafCards(B, V(top.x * 0.7 + 0.5, H * 0.60, top.z * 0.7), 3.3, 2.5, 3.1, rnd, { n: 95, len: 1.05, wid: 0.46, massC: crownC, massK: 0.5, sway: 0.7, shade0: 0.1 });
    leafCards(B, V(top.x * 0.9 - 0.4, H * 0.84, top.z * 0.9 + 0.3), 2.8, 2.3, 2.9, rnd, { n: 80, len: 1.05, wid: 0.46, massC: crownC, massK: 0.5, sway: 0.9 });
  } else {
    blob(B, V(top.x * 0.7 + 0.5, H * 0.60, top.z * 0.7), 3.2, 2.5, 3.0, rnd, { massC: crownC, massK: 0.4, sway: 0.7, shade0: 0.25, shadeK: 0.7, droop: 0.2, noise: 0.3, uvScale: 4 });
    blob(B, V(top.x * 0.9 - 0.4, H * 0.84, top.z * 0.9 + 0.3), 2.7, 2.3, 2.8, rnd, { massC: crownC, massK: 0.4, sway: 0.9, shade0: 0.0, shadeK: 0.6, droop: 0.2, noise: 0.3, uvScale: 4 });
  }
  return B.build();
}

export function pineGeometry(seed, lod, spec) {
  const rnd = mulberry32(seed), B = new Builder();
  const sl = !!(spec && spec.slender);      // (the oil look's woods: a tall bare stem under a high, narrow crown; see birchGeometry)
  const H = sl ? 19 + rnd() * 5 : 14 + rnd() * 4;
  const lean = (rnd() - 0.5) * 1.0, lz = (rnd() - 0.5) * 0.7;
  const segs = lod === 0 ? 6 : 2, sides = lod === 0 ? 7 : 4;
  const pts = [], rad = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const kink = lod ? 0 : 0.07;
    pts.push(V(lean * t * t + (rnd() - 0.5) * kink, t * H, lz * t * t + (rnd() - 0.5) * kink));
    rad.push((sl ? 0.24 - 0.18 * Math.pow(t, 0.9) : 0.32 - 0.27 * Math.pow(t, 0.9)) * (i === 0 ? (sl ? 1.3 : 1.4) : 1) * (0.88 + rnd() * 0.24));
  }
  tube(B, pts, rad, sides, { part: 0, swayK: 0.35, swayH: H, hash: rnd() });
  // (the oil look's tree: a foot. The stem spreads into the ground over its lowest half metre and goes on under it;
  // ending square on the floor it stood as a post set on a plane: the critic)
  if (sl && lod === 0) tube(B, [V(pts[0].x, -0.25, pts[0].z), V(pts[0].x, 0.03, pts[0].z), V(pts[0].x + (pts[1].x - pts[0].x) * 0.3, 0.55, pts[0].z + (pts[1].z - pts[0].z) * 0.3)], [rad[0] * 2.3, rad[0] * 1.6, rad[0] * 0.98], sides, { part: 0, swayK: 0, swayH: H, hash: rnd() });
  const crownC = V(lean * 0.5, H * (sl ? 0.80 : 0.62), lz * 0.4);
  if (lod === 0) {
    for (let k = 0; k < 2; k++) {
      const y = H * ((sl ? 0.40 : 0.20) + 0.09 * k + rnd() * 0.04), ang = rnd() * 6.283, len = 0.6 + rnd() * 0.9;
      tube(B, [V(0, y, 0), V(Math.cos(ang) * len, y + 0.1, Math.sin(ang) * len)], [0.045, 0.012], 4, { part: 0, shade: 0.7, hash: rnd() });
    }
    const tiers = 6;
    const gap = (H * 0.60) / (tiers - 1);
    for (let k = 0; k < tiers; k++) {
      const t = k / (tiers - 1);
      const y = H * (sl ? 0.62 + 0.36 * t : 0.36 + 0.60 * t);
      const r = (sl ? 2.7 - 2.0 * Math.pow(t, 0.85) : 3.9 - 3.0 * Math.pow(t, 0.85)) * (0.85 + rnd() * 0.3);
      const off = (1 - t) * 0.6;
      const c = V(lean * (y / H) * (y / H) + (rnd() - 0.5) * off, y, lz * (y / H) * (y / H) + (rnd() - 0.5) * off);
      if (sl) { leafCards(B, c, r, Math.max(r * 0.36 + 0.2, gap * 0.45), r, rnd, { n: 62, len: 0.70, wid: 0.19, massC: crownC, massK: 0.5, sway: 0.35 + 0.5 * t, shade0: 0.1 + 0.2 * (1 - t), shadeK: 0.7, droop: 0.9 }); continue; }
      blob(B, c, r, Math.max(r * 0.42 + 0.25, gap * (sl ? 0.45 : 0.7)), r * (0.9 + rnd() * 0.2), rnd, { massC: crownC, massK: 0.35, sway: 0.35 + 0.5 * t, shade0: 0.12 + 0.25 * (1 - t), shadeK: 0.8, droop: 0.9, noise: 0.28, uvScale: 4 });
    }
    if (sl) leafCards(B, V(lean, H * 0.99, lz), 0.6, 1.3, 0.6, rnd, { n: 22, len: 0.6, wid: 0.15, massC: crownC, massK: 0.4, sway: 0.9 });
    else blob(B, V(lean, H * 0.99, lz), 0.55, 1.4, 0.55, rnd, { massC: crownC, massK: 0.3, sway: 0.9, shade0: 0.0, uvScale: 2, taper: 0.6 });
  } else if (sl) {
    leafCards(B, V(lean * 0.6, H * 0.72, lz * 0.6), 2.6, H * 0.13, 2.5, rnd, { n: 80, len: 1.1, wid: 0.30, massC: crownC, massK: 0.5, sway: 0.4, droop: 0.6 });
    leafCards(B, V(lean * 0.9, H * 0.90, lz * 0.9), 1.8, H * 0.12, 1.7, rnd, { n: 50, len: 1.1, wid: 0.30, massC: crownC, massK: 0.5, sway: 0.8, droop: 0.4 });
  } else {
    blob(B, V(lean * 0.4, H * 0.56, lz * 0.4), 3.8, H * 0.21, 3.6, rnd, { massC: crownC, massK: 0.3, sway: 0.4, shade0: 0.2, shadeK: 0.75, droop: 0.5, noise: 0.26, taper: 0.45, uvScale: 5 });
    blob(B, V(lean * 0.8, H * 0.83, lz * 0.8), 2.4, H * 0.20, 2.3, rnd, { massC: crownC, massK: 0.3, sway: 0.8, shade0: 0.0, shadeK: 0.7, droop: 0.3, noise: 0.24, taper: 0.85, uvScale: 5 });
  }
  return B.build();
}

// A BOUGH DRAWN AS A CURVE INSTEAD OF TWO BARS (2026-11-19). `tube` joins its points with straight sections, so a
// bough given its foot, its middle and its tip is two bars meeting at a corner -- a knee, and the owner saw it:
// "it looks like spiders not trees". The same three points describe a quadratic, so the curve is already there and
// only needs sampling. Five points, which is one extra ring of the tube.
// BEHIND THE OIL LOOK ALONE (`spec.oilLook`, set in flora.js): the broadleaf and the conifer are the LIVE
// watercolour game's trees and their boughs may not move at all. Without the flag these two hand back exactly what
// was passed in, so the watercolour game builds the geometry it always built, number for number.
function oilCurve(p0, p1, p2, spec) {
  if (!(spec && spec.oilLook)) return [p0, p1, p2];
  const c = V(p1.x * 2 - (p0.x + p2.x) * 0.5, p1.y * 2 - (p0.y + p2.y) * 0.5, p1.z * 2 - (p0.z + p2.z) * 0.5);
  const out = [];
  for (let i = 0; i < 5; i++) { const t = i / 4, u = 1 - t;
    out.push(V(u * u * p0.x + 2 * u * t * c.x + t * t * p2.x, u * u * p0.y + 2 * u * t * c.y + t * t * p2.y, u * u * p0.z + 2 * u * t * c.z + t * t * p2.z)); }
  return out;
}
// and the widths to go with them: the same three the bough always had, thinned along the curve so it TAPERS to its
// tip instead of holding one width and stopping ("the hierarchy of widths", the references' own rule for both the
// rivers and the trees).
function oilCurveR(spec, r3) {
  if (!(spec && spec.oilLook)) return r3;
  const out = [];
  for (let i = 0; i < 5; i++) { const t = i / 4; out.push(r3[0] * (1 - (1 - r3[2] / r3[0]) * Math.pow(t, 1.3))); }
  return out;
}

// The far tree: one unit-high form (a trunk stroke and one wash) shared by every species.
// The instance matrix sizes it; the shader tapers it to a point for pines. 26 triangles.
export function farTreeGeometry(seed) {
  const rnd = mulberry32(seed), B = new Builder();
  tube(B, [V(0, 0, 0), V(0.01, 0.52, 0)], [0.020, 0.012], 3, { part: 0, swayK: 0.02, swayH: 1, hash: 0.5 });
  blob(B, V(0, 0.66, 0), 0.27, 0.36, 0.27, rnd, { detail: 0, massK: 0.15, sway: 0.05, shade0: 0.0, shadeK: 0.8, noise: 0.22, uvScale: 2, uvT: true });
  return B.build();
}

// AN EXPERIMENT, NOT THE LOOK: drawn only when the address says ?fartree=cards (flora.js), so that the owner's phone
// can time it against the lump (the speed test, once with and once without). SEEN here beside the lump (the gallery,
// oil, tier 1, 1280 x 600): a picture costs 11 to 13 parts in a hundred less, and the far wood is PLAINER: crowns of
// one flat tone with a few leaves on them, where the lump's crowns are dabbed all over. Not good enough to be the look.
// THE OIL LOOK'S FAR TREE (2026-11-17). The far tree above is a lump of 26 triangles whose crown is painted in two
// layers of leaf dabs for every pixel it covers, tree behind tree: measured in the game at the phone's settings (the same
// view with the far crowns laid in one flat colour), that painting was nineteen parts in twenty of the plants' paint, and
// on the owner's phone the plants' paint was 23 ms of a 40 ms frame. This one is painted as the near tree's leaves are,
// once a piece and not once a pixel (materials.js PROP_VERT, "a leaf's paint, once a leaf"): a stem, a SOLID DARK CORE
// of twenty flat faces in one tone (the shade inside the crown), and twenty-six LEAF CARDS standing on and out of it.
// (Thirty cards and no core were tried first: cheaper still, and seen from the air the wood was confetti, no crowns.)
// In the far tree's own unit shape: flora.js sizes it to its kind, PROP_VERT tapers a conifer's by height.
function facetCore(B, c, rx, ry, rz, rnd, opts) {
  const o = Object.assign({ noise: 0.22, massK: 0.5, sway: 0.05, shade0: 0.72, shadeK: 0.25 }, opts || {});
  B.branch = (rnd() * 7.13) % 1;
  // (2026-11-18) THE CORE IS KEPT LONGEST. Its faces are laid at the leaf cards' own part number, so when a far tree
  // is thinned by distance they are sorted with the cards - and sortLeafCards keeps the HIGHEST hashes, so a core
  // whose hash came out low (0.0023 at seed 6, the lowest of all fifty-seven pieces) would be the FIRST thing
  // dropped, leaving loose dabs floating over the sky with no crown under them: the "confetti" this look threw out
  // twice already. A hash of 1 puts the core at the front of the order, so it is the last thing to go.
  // (2026-11-18, found by an independent reader) THE DRAW IS KEPT AND THROWN AWAY. `rnd` is the one stream the whole
  // far tree is built from, so dropping the core's own draw handed every one of the 46 shingles and 10 leaf cards
  // after it the numbers that belonged to its neighbour: 284 of 292 vertices moved, the largest by about 8 m of a
  // 12 to 15 m tree. Every far tree in the oil wood silently became a different tree, for a change that was only
  // about SORT ORDER. One wasted random number keeps them the trees they were.
  rnd();
  const coreHash = 1;
  const I = ico(0), ph1 = rnd() * 6.28, ph2 = rnd() * 6.28, ph3 = rnd() * 6.28, P = [];
  for (let i = 0; i < I.n; i++) {
    const x = I.p[i * 3], y = I.p[i * 3 + 1], z = I.p[i * 3 + 2];
    const k = 1 + o.noise * (Math.sin(x * 3.1 + ph1) * Math.sin(y * 2.7 + ph2) + 0.6 * Math.sin(z * 4.3 + ph3 + x * 1.9));
    P.push([c.x + x * rx * k, c.y + y * ry * k, c.z + z * rz * k, y]);
  }
  for (let i = 0; i < I.n; i += 3) {
    const a = P[i], b = P[i + 1], d = P[i + 2];
    const cx = (a[0] + b[0] + d[0]) / 3, cy = (a[1] + b[1] + d[1]) / 3, cz = (a[2] + b[2] + d[2]) / 3;
    let nx = (b[1] - a[1]) * (d[2] - a[2]) - (b[2] - a[2]) * (d[1] - a[1]), ny = (b[2] - a[2]) * (d[0] - a[0]) - (b[0] - a[0]) * (d[2] - a[2]), nz = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]);
    let l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    let mx = cx - c.x, my = cy - c.y, mz = cz - c.z; l = Math.hypot(mx, my, mz) || 1; mx /= l; my /= l; mz /= l;
    if (nx * mx + ny * my + nz * mz < 0) { nx = -nx; ny = -ny; nz = -nz; }
    mx = nx + (mx - nx) * o.massK; my = ny + (my - ny) * o.massK; mz = nz + (mz - nz) * o.massK; l = Math.hypot(mx, my, mz) || 1; mx /= l; my /= l; mz /= l;
    // (one tone for the whole core, taken at the crown's middle, and dark: it is the shade inside the crown that the
    // leaves stand on. A tone of its own for every face was a cut gem, plain polygons)
    // (shade 2, where every other piece has 0 .. 1: the mark of the inside of a crown; PROP_VERT lays such a piece in
    // the crown's deep tone whatever the sun)
    const shade = 2, hash = coreHash;
    B.card = [c.x, c.y, c.z];
    const v0 = B.vert(a[0], a[1], a[2], nx, ny, nz, mx, my, mz, -1, 0, o.sway, 5, shade, hash);
    const v1 = B.vert(b[0], b[1], b[2], nx, ny, nz, mx, my, mz, 0, 1, o.sway, 5, shade, hash);
    const v2 = B.vert(d[0], d[1], d[2], nx, ny, nz, mx, my, mz, 1, 0, o.sway, 5, shade, hash);
    B.tri(v0, v1, v2);
    B.card = null;
  }
}
// Leaves laid like shingles over a crown: n flat leaf-shaped pieces spread evenly over the skin, each facing more or
// less outward (so none is seen edge-on, as a third of the leaf cards scattered every way are), pushed out a little by
// its own amount, with its own tone (aCard is its own centre: PROP_VERT paints each once, at its centre). With a dark
// core behind them they cover the crown as the lump's dabs do, in pieces about a dab's size at a far tree's distance.
function shingles(B, c, rx, ry, rz, rnd, opts) {
  const o = Object.assign({ n: 40, len: 0.24, wid: 0.19, tilt: 0.45, out: 0.07, sway: 0.05, shade0: 0.0, shadeK: 0.45, part: 5 }, opts || {});
  B.branch = (rnd() * 7.13) % 1;
  const ga = Math.PI * (3 - Math.sqrt(5)), ph = rnd() * 6.28;
  for (let i = 0; i < o.n; i++) {
    // a point of an even spiral over the sphere, jittered
    const y = 1 - 2 * (i + 0.5) / o.n + (rnd() - 0.5) * 0.08, rr = Math.sqrt(Math.max(0, 1 - y * y)), a = ph + i * ga + (rnd() - 0.5) * 0.3;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr, push = 1 + o.out * (rnd() * 2 - 0.6);
    const px = c.x + x * rx * push, py = c.y + y * ry * push, pz = c.z + z * rz * push;
    // outward, tilted its own way
    let nx = x / rx, ny = y / ry, nz = z / rz; let l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const mx = nx, my = ny, mz = nz;
    nx += (rnd() - 0.5) * o.tilt; ny += (rnd() - 0.5) * o.tilt; nz += (rnd() - 0.5) * o.tilt; l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    // its long side: any way across the skin (a leaf hangs a little: more down than up)
    let ax = rnd() - 0.5, ay = rnd() - 0.75, az = rnd() - 0.5;
    const k = ax * nx + ay * ny + az * nz; ax -= nx * k; ay -= ny * k; az -= nz * k; l = Math.hypot(ax, ay, az) || 1; ax /= l; ay /= l; az /= l;
    const sx = ny * az - nz * ay, sy = nz * ax - nx * az, sz = nx * ay - ny * ax;
    const L = o.len * (0.75 + 0.5 * rnd()) * 0.5, W = o.wid * (0.75 + 0.5 * rnd()) * 0.5;
    const shade = Math.min(1, Math.max(0, o.shade0 + o.shadeK * (0.5 - y * 0.5) + 0.12 * (rnd() - 0.5))), hash = rnd();
    B.card = [px, py, pz];
    const wx = px - ax * L * 0.2, wy = py - ay * L * 0.2, wz = pz - az * L * 0.2;
    const v0 = B.vert(px - ax * L, py - ay * L, pz - az * L, nx, ny, nz, mx, my, mz, -1, 0, o.sway, o.part, shade, hash);
    const v1 = B.vert(wx + sx * W, wy + sy * W, wz + sz * W, nx, ny, nz, mx, my, mz, 0, 1, o.sway, o.part, shade, hash);
    const v2 = B.vert(px + ax * L, py + ay * L, pz + az * L, nx, ny, nz, mx, my, mz, 1, 0, o.sway, o.part, shade, hash);
    const v3 = B.vert(wx - sx * W, wy - sy * W, wz - sz * W, nx, ny, nz, mx, my, mz, 0, -1, o.sway, o.part, shade, hash);
    B.tri(v0, v1, v2); B.tri(v0, v2, v3);
    B.card = null;
  }
}
// (fourth form, 2026-11-17, after the phone's tables: the tree of flat pieces ran at 36.5 pictures a second where the
// lump ran at 22.5, and looked too plain to be the look: a one-tone core with a few leaves on it. Now: the dark core,
// FORTY-SIX SHINGLED LEAVES over it, each in its own tone, with the dark between them, and ten leaves standing out of
// it for the outline.)
// THE FAR TREE AS ONE CARD (2026-11-19, the owner: "find another way around it"). The far tree that ships is a
// dark core, 46 shingles and 10 leaf cards -- 138 triangles, and 3,853 of them stand in one view of the autumn wood
// (531,714 triangles). The owner's own speed test says what that costs and what it is: "far trees one flat colour"
// saves 0.9 ms, so THE PAINT IS NOT THE COST; "far trees as lumps" (26 triangles) saves 8.7 ms, so THE TRIANGLES
// ARE. On a phone's tile GPU half a million tiny triangles are binned before a pixel is drawn.
//
// So: ONE QUAD, four triangles (two crossed), and the look's OWN dab shader paints it. Nothing new is needed in any
// material -- the oil branch already lays dabs across whatever surface it is given and cuts the ragged edge with
// its own discard, which is exactly what a far crown is. What a flat quad cannot do is turn in the light, so its
// four corners are given SPHERICAL NORMALS, splayed outward as if it were the ball it stands for: the dab shading
// then rounds it, and a crown reads as a crown rather than as a sheet of paper.
//
// It keeps the dabbed crown the owner approved; it is 4 triangles instead of 138.
export function farBlobGeometry(seed) {
  const rnd = mulberry32(seed), B = new Builder();
  tube(B, [V(0, 0, 0), V(0.01, 0.52, 0)], [0.020, 0.012], 3, { part: 0, swayK: 0.02, swayH: 1, hash: 0.5 });
  const c = V(0, 0.68, 0), R = 0.33, H = 0.42;
  // two crossed quads, so the crown has depth from any way round and does not vanish edge-on
  for (let q = 0; q < 2; q++) {
    const a = q * Math.PI * 0.5 + 0.4;
    const ex = Math.cos(a), ez = Math.sin(a);          // across
    const hash = 0.2 + 0.6 * rnd();
    B.branch = (rnd() * 7.13) % 1;
    B.card = [c.x, c.y, c.z];
    // A ROUNDED OUTLINE, not a quad: the first try was two crossed rectangles and from the air the wood was a
    // field of straight-edged patches -- the dab shader paints across whatever it is given and does not cut a
    // crown out of a square. Six corners, as the look's own leaves have (leafCards `round`), so the silhouette
    // is a crown. Four triangles a card instead of two, which is still 93% less than the tree it replaces.
    const corner = (sx, sy) => {
      const px = c.x + ex * R * sx, py = c.y + H * sy, pz = c.z + ez * R * sx;
      // SPHERICAL NORMALS: as if the card were the ball it stands for, so the light rounds it
      let nx = ex * sx * 0.78, ny = sy * 0.78, nz = ez * sx * 0.78;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      const shade = Math.min(1, Math.max(0, 0.46 - sy * 0.34));     // lighter on top, darker beneath
      return B.vert(px, py, pz, nx, ny, nz, nx, ny, nz, sx, sy, 0.05, 5, shade, hash);
    };
    const a0 = corner(0, -1), a1 = corner(-0.92, -0.42), a2 = corner(-0.80, 0.52),
          a3 = corner(0, 1), a4 = corner(0.80, 0.52), a5 = corner(0.92, -0.42);
    B.tri(a0, a1, a2); B.tri(a0, a2, a3); B.tri(a0, a3, a4); B.tri(a0, a4, a5);
    B.card = null;
  }
  return B.build();
}

export function farCardGeometry(seed) {
  const rnd = mulberry32(seed), B = new Builder();
  tube(B, [V(0, 0, 0), V(0.01, 0.52, 0)], [0.020, 0.012], 3, { part: 0, swayK: 0.02, swayH: 1, hash: 0.5 });
  const c = V(0, 0.66, 0);
  facetCore(B, c, 0.19, 0.27, 0.19, rnd);
  shingles(B, c, 0.245, 0.335, 0.245, rnd, { n: 46, len: 0.215, wid: 0.165 });
  leafCards(B, c, 0.27, 0.36, 0.27, rnd, { n: 10, len: 0.16, wid: 0.10, massC: c, massK: 0.75, sway: 0.05, shade0: 0.0, shadeK: 0.4, droop: 0.15 });
  return B.build();
}

export function grassGeometry(seed, spec) {
  const rnd = mulberry32(seed), B = new Builder();
  if (spec && spec.oil) {
    // (the oil look, the overhaul plan's fifth piece: a TUFT, as on the clip's forest floor: blades from one root that
    // fan out, a few of them long and nearly upright, the rest shorter and arching over)
    const n = 9;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * 6.283 + rnd() * 0.9, dir = V(Math.cos(ang), 0, Math.sin(ang)), r0 = rnd() * 0.045, long = i % 3 === 0;
      stroke(B, V(dir.x * r0, 0, dir.z * r0), dir, (long ? 0.58 : 0.30) + rnd() * 0.32, 0.026 + rnd() * 0.016, long ? 0.08 + rnd() * 0.22 : 0.25 + rnd() * 0.45, rnd, { segs: 3, sway: 0.6 });
    }
    return B.build();
  }
  const n = 6;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * 6.283 + rnd() * 0.8;
    const dir = V(Math.cos(ang), 0, Math.sin(ang));
    const r0 = rnd() * 0.10;
    stroke(B, V(dir.x * r0, 0, dir.z * r0), dir, 0.20 + rnd() * 0.30, 0.014 + rnd() * 0.012, 0.15 + rnd() * 0.5, rnd, { segs: 2, sway: 0.5 });
  }
  return B.build();
}

// Near grass: a patch of broad brush flicks about a metre and a half across. A blade thinner
// than three pixels is erased by the abstraction pass, so near the eye grass is laid as
// strokes the width of a brush tip. Each blade keeps its own root (in aMass.xz, metres from
// the patch centre) so that PHYSICS' push field bends blade by blade: the sward parts round
// a walker instead of leaning as one piece.
export function grassPatchGeometry(seed, spec) {
  const rnd = mulberry32(seed), B = new Builder();
  const n = 12;
  const roots = [];
  // (the oil look: the patch is two tufts, each six blades fanning from its own root, not twelve blades strewn over it;
  // the same count and order of strokes, so the low tier's five blades and each blade's own root hold as they did)
  const oil = !!(spec && spec.oil), tc = oil ? [V(-0.28 + rnd() * 0.2, -0.04, 0.1 + rnd() * 0.3), V(0.30 + rnd() * 0.2, -0.04, -0.35 + rnd() * 0.3)] : null;
  for (let i = 0; i < n; i++) {
    const ang = rnd() * 6.283, rr = 0.10 + 0.82 * Math.sqrt((i + 0.5) / n);
    let root = V(Math.cos(ang + i * 2.4) * rr, -0.04, Math.sin(ang + i * 2.4) * rr);
    let da = rnd() * 6.283, len = 0.36 + rnd() * 0.32, wid = 0.019 + rnd() * 0.011, arch = 0.25 + rnd() * 0.55;
    if (oil) {
      const t = tc[i % 2], k = (i >> 1), long = k % 3 === 0;
      da = (k / 6) * 6.283 + (i % 2) * 0.5 + (da - 3.14) * 0.14;
      root = V(t.x + Math.cos(da) * 0.03, -0.04, t.z + Math.sin(da) * 0.03);
      len = (long ? 0.62 : 0.32) + (len - 0.36); wid = 0.028 + (wid - 0.019) * 1.5; arch = long ? 0.06 + arch * 0.3 : arch;
    }
    const dir = V(Math.cos(da), 0, Math.sin(da));
    stroke(B, root, dir, len, wid, arch, rnd, { segs: 2, sway: 0.5 });
    roots.push(root);
  }
  const g = B.build();
  // every stroke has (segs + 1) * 2 = 6 vertices and 12 indices, in order (the low tier
  // draws the first five blades only: setDrawRange(0, 60))
  const m = g.getAttribute('aMass');
  for (let i = 0; i < m.count; i++) { const r = roots[Math.floor(i / 6)]; m.setXYZ(i, r.x, 1.0, r.z); }
  m.needsUpdate = true;
  return g;
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

export function fernGeometry(seed, spec) {
  const rnd = mulberry32(seed), B = new Builder();
  if (spec && spec.oil) {
    // (the oil look: a low leafy plant, its leaves one by one (leafCards), as the small plants of the clip's forest
    // floor. The fern's seven broad fronds, each one flat colour, stood side-on as a notched slab: seen in the stills
    // after overhauls 1 and 2.)
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * 6.283 + rnd() * 0.8, r = 0.10 + rnd() * 0.20, y = 0.10 + rnd() * 0.20;
      leafCards(B, V(Math.cos(ang) * r, y, Math.sin(ang) * r), 0.17, 0.07, 0.17, rnd, { n: 5, len: 0.25, wid: 0.115, massC: V(0, 0.05, 0), massK: 0.35, sway: 0.3, shade0: 0.0, shadeK: 0.25, droop: 0.2, round: 1 });
    }
    return B.build();
  }
  const n = 7;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * 6.283 + rnd() * 0.5;
    const dir = V(Math.cos(ang), 0, Math.sin(ang));
    stroke(B, V(0, 0, 0), dir, 0.45 + rnd() * 0.3, 0.055 + rnd() * 0.03, 0.75 + rnd() * 0.35, rnd, { segs: 3, leaf: 1, sway: 0.35 });
  }
  return B.build();
}

export function bushGeometry(seed, spec) {
  const rnd = mulberry32(seed), B = new Builder();
  if (spec && spec.oil) {
    // (the oil look: a sapling: thin stems that fork, and leaves one by one, as the young trees on the clip's floor)
    const h = 1.0 + rnd() * 0.5, lx = (rnd() - 0.5) * 0.3, lz = (rnd() - 0.5) * 0.3;
    tube(B, [V(0, 0, 0), V(lx * 0.5, h * 0.5, lz * 0.5), V(lx, h, lz)], [0.014, 0.010, 0.006], 4, { part: 0, shade: 0.8, sway0: 0.1, swayK: 0.3, swayH: h, hash: rnd() });
    for (let k = 0; k < 3; k++) {
      const a = k * 2.2 + rnd(), y0 = h * (0.35 + 0.2 * k), r = 0.3 + rnd() * 0.25;
      tube(B, [V(lx * y0 / h, y0, lz * y0 / h), V(Math.cos(a) * r, y0 + 0.28, Math.sin(a) * r)], [0.012, 0.005], 3, { part: 0, shade: 0.8, sway0: 0.3, hash: rnd() });
      leafCards(B, V(Math.cos(a) * r, y0 + 0.30, Math.sin(a) * r), 0.30, 0.24, 0.30, rnd, { n: 16, len: 0.24, wid: 0.11, massC: V(0, h * 0.6, 0), massK: 0.4, sway: 0.5, shadeK: 0.3, round: 1 });
    }
    leafCards(B, V(lx, h + 0.05, lz), 0.26, 0.22, 0.26, rnd, { n: 14, len: 0.24, wid: 0.11, massC: V(0, h * 0.6, 0), massK: 0.4, sway: 0.6, shadeK: 0.3, round: 1 });
    return B.build();
  }
  const cc = V(0, 0.5, 0);
  for (let i = 0; i < 2; i++) {
    const ang = i * 2.6 + rnd(), rr = 0.3 + rnd() * 0.3, r = 0.62 + rnd() * 0.3;
    blob(B, V(Math.cos(ang) * rr, 0.45 + rnd() * 0.3, Math.sin(ang) * rr), r, r * 0.8, r, rnd, { massC: cc, massK: 0.5, sway: 0.25, shade0: 0.1, uvScale: 2 });
  }
  return B.build();
}

// A boulder: a broken thing, not a pebble. A lumpy ellipsoid, wider than it is tall, cleaved by a few planes (its
// fractured faces: a near-level top and leaning sides), so it shows planes of light in the value steps and a
// silhouette with corners; the facets keep their own normals, the body between them its rounded one. (It was one
// smooth lumpy ellipsoid lit by the ellipsoid's own normal: a soap lozenge whatever its wash; ARTPASS wish 1.)
export function rockGeometry(seed) {
  const rnd = mulberry32(seed), B = new Builder();
  B.branch = -1;
  const I = ico(2), rx = 0.82, ry = 0.44, rz = 0.64, cy = 0.22;
  const ph1 = rnd() * 6.28, ph2 = rnd() * 6.28, ph3 = rnd() * 6.28, hash = rnd();
  // the cleaving planes, in the unit sphere's space: a top tilted 10 to 30 degrees, four sides leaning in
  const planes = [];
  const a0 = rnd() * 6.28;
  { const tilt = 0.18 + rnd() * 0.34, az = rnd() * 6.28; planes.push([Math.sin(tilt) * Math.cos(az), Math.cos(tilt), Math.sin(tilt) * Math.sin(az), 0.58 + rnd() * 0.12]); }
  for (let i = 0; i < 4; i++) {
    const az = a0 + i * 1.571 + (rnd() - 0.5) * 0.8, el = 0.10 + rnd() * 0.45;
    planes.push([Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az), 0.62 + rnd() * 0.16]);
  }
  for (let i = 0; i < I.n; i++) {
    const x = I.p[i * 3], y = I.p[i * 3 + 1], z = I.p[i * 3 + 2];
    const k = 1 + 0.20 * (Math.sin(x * 3.1 + ph1) * Math.sin(y * 2.7 + ph2) + 0.6 * Math.sin(z * 4.3 + ph3 + x * 1.9))
      + 0.06 * (Math.sin(x * 8.3 + ph2) * Math.sin(z * 7.1 + ph1 + y * 5.0) + 0.5 * Math.sin(y * 13.0 + ph3 + x * 6.0 + z * 4.0));
    let ux = x * k, uy = y * k, uz = z * k, cut = -1, cs = 0;
    for (let q = 0; q < planes.length; q++) { const P = planes[q], s = ux * P[0] + uy * P[1] + uz * P[2] - P[3]; if (s > cs) { cs = s; cut = q; } }
    if (cut >= 0) { const P = planes[cut]; ux -= cs * P[0]; uy -= cs * P[1]; uz -= cs * P[2]; }
    let px = ux * rx, py = uy * ry, pz = uz * rz;
    if (py < 0) py *= 0.55;
    // the facet's normal where it was cleaved (the plane's, through the ellipsoid's scaling), else the body's
    let nx, ny, nz;
    if (cut >= 0) { const P = planes[cut]; nx = P[0] / rx; ny = P[1] / ry; nz = P[2] / rz; } else { nx = x / rx; ny = y / ry; nz = z / rz; }
    const l = 1 / Math.hypot(nx, ny, nz); nx *= l; ny *= l; nz *= l;
    const shade = Math.min(1, Math.max(0, 0.5 - y * 0.5));
    B.vert(px, cy + py, pz, nx, ny, nz, nx, ny, nz, I.uv[i * 2], I.uv[i * 2 + 1] * 0.5, 0, 4, shade, hash);
  }
  for (let i = 0; i < I.n; i += 3) B.tri(B.count - I.n + i, B.count - I.n + i + 1, B.count - I.n + i + 2);
  return B.build();
}

export function flowerGeometry(seed, spec) {
  const rnd = mulberry32(seed), B = new Builder();
  const n = 5;
  // (the oil look: a flower's head is a small round touch of pure colour, a single dab; a five-pointed head the size
  // of a hand, in flat paint, was a red star standing in the grass)
  const oil = !!(spec && spec.oil);
  for (let i = 0; i < n; i++) {
    const ang = rnd() * 6.283, rr = rnd() * 0.28, h = 0.28 + rnd() * 0.3;
    const x = Math.cos(ang) * rr, z = Math.sin(ang) * rr;
    const dir = V(Math.cos(ang), 0, Math.sin(ang));
    stroke(B, V(x * 0.6, 0, z * 0.6), dir, h, 0.012, 0.25, rnd, { segs: 2, sway: 0.5 });
    // the head: a small cupped touch with five lobes (petals), its tips lifted and a little ragged, tilted to face
    // out from the clump (it was a flat hexagon: seen from above a red disc, seen across the meadow a red dash)
    const c = V(x * 0.6 + dir.x * h * 0.3, h * 0.96, z * 0.6 + dir.z * h * 0.3), s = (0.055 + rnd() * 0.04) * (oil ? 0.62 : 1);
    const base = B.count, hh = rnd(), a0 = rnd() * 6.283, tl = 0.35 + rnd() * 0.3;
    const ring = 10;
    B.vert(c.x, c.y + s * 0.15, c.z, 0, 1, 0, 0, 1, 0, 0.5, 1, 0.5, 3, 0, hh);
    for (let k = 0; k < ring; k++) {
      const a = a0 + (k / ring) * 6.283, lobe = k % 2 === 0 ? 1.0 + rnd() * 0.15 : (oil ? 0.84 : 0.42) + rnd() * 0.12, r = s * lobe;
      const lx = Math.cos(a) * r, lz = Math.sin(a) * r, ly = (k % 2 === 0 ? 0.35 : 0.12) * s + (lx * dir.x + lz * dir.z) * tl;
      B.vert(c.x + lx, c.y + ly, c.z + lz, Math.cos(a) * 0.45 + dir.x * tl, 0.85, Math.sin(a) * 0.45 + dir.z * tl, 0, 1, 0, 0.5, 1, 0.5, 3, 0, hh);
    }
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
  // (no budget: the near form is finely cut, so its outline is a wobbling line and not a row of
  // straight edges; ledges step its girth, a buttress and a few fallen blocks stand at its foot)
  blob(B, V((rnd() - 0.5) * 0.6, H * 0.46, (rnd() - 0.5) * 0.6), r, H * 0.56, r * (0.8 + rnd() * 0.4), rnd, { detail: lod ? 1 : 3, part: 4, noise: slim ? 0.30 : 0.24, rough: lod ? 0 : 0.07, ledge: lod ? 0.05 : 0.11, ledgeF: 7 + rnd() * 5, massK: 0, sway: 0, shade0: 0.05, shadeK: 0.9, taper: slim ? 0.80 : 0.86, flatBottom: 0.2, uvScale: 2 });
  if (!lod) {
    blob(B, V(1.6 + rnd(), H * 0.16, (rnd() - 0.5) * 2), r * 0.6, H * (slim ? 0.32 : 0.2), r * 0.6, rnd, { detail: 2, part: 4, noise: 0.25, rough: 0.08, ledge: 0.10, massK: 0, sway: 0, shade0: 0.2, shadeK: 0.8, taper: 0.8, uvScale: 1 });
    const nb = 2 + ((rnd() * 3) | 0);
    for (let q = 0; q < nb; q++) { const a = rnd() * 6.283, d = r * (0.7 + rnd() * 0.45), s2 = 0.35 + rnd() * 0.6; blob(B, V(Math.cos(a) * d, s2 * 0.3, Math.sin(a) * d), s2 * (0.8 + rnd() * 0.5), s2 * 0.6, s2 * (0.7 + rnd() * 0.5), rnd, { detail: 1, part: 4, noise: 0.3, massK: 0, sway: 0, shade0: 0.25, shadeK: 0.8, flatBottom: 0.4, uvScale: 1 }); }
  }
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
    // (PAINTER 14: the crest stays nearly level along the wave and drops only in its last eighth, where the curl shows in
    // profile; lowered steadily toward both ends, every wave seen along its crest stood as a snow peak, ARTPASS weakest 5)
    const ea = Math.min(a, 1 - a);
    const k = (0.34 + 0.66 * smoothstep(0.0, 0.16, ea) * (0.92 + 0.08 * Math.sin(Math.PI * a))) * (0.90 + 0.14 * rnd());
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
  // (2026-11-18, the owner: "Give the trees more branches as well and more versions of them".) Four kinds built in
  // files of their own under kits/, each a trunk that forks into real limbs with the leaves hung on them, so the
  // branch structure reads through the crown. A world asks for them through its look's `tallOil` list.
  maple: (seed, lod, spec) => mapleGeometry(seed, lod, spec),
  spruce: (seed, lod, spec) => spruceGeometry(seed, lod, spec),
  aspen: (seed, lod, spec) => aspenGeometry(seed, lod, spec),
  tallpine: (seed, lod, spec) => tallPineGeometry(seed, lod, spec),
  // (the oil look's trees of the snow are forms of their own: a `fir` conifer, a `bare` broadleaf)
  broadleaf: (seed, lod, spec) => (spec && spec.bare ? bareGeometry(seed, lod) : birchGeometry(seed, lod, spec)), conifer: (seed, lod, spec) => (spec && spec.fir ? firGeometry(seed, lod) : pineGeometry(seed, lod, spec)), fungus: fungusGeometry,
  // (2026-11-19, the owner's six from the sheet of ten: one grammar, six rows of numbers, kits/grove.js)
  roundmaple: groveGeometry('roundmaple'), poplar: groveGeometry('poplar'), oak: groveGeometry('oak'),
  birch: groveGeometry('birch'), willow: groveGeometry('willow'), sapling: groveGeometry('sapling'),
  crystal: (seed, lod, spec) => crystalGeometry(seed, lod, spec && spec.thin), spire: (seed, lod, spec) => spireGeometry(seed, lod, spec), kelp: kelpGeometry, wave: waveGeometry, vine: vineGeometry,
};
