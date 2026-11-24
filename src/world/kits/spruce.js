// Painted Cosmos: A SPRUCE, built from the florakit's own pieces. OWNER: PAINTER.
// The owner asked for this on 18 November: "Give the trees more branches as well and more versions of them for example
// like in the video the Christmas tree looking ones with the strokes make it better then the video reference tho".
// This is the Christmas tree they name. NOT SEEN: it was built where no picture can be drawn, so nothing here is said
// about how it looks; what is known of its shape is the numbers its test prints (spruce.test.mjs, run with
// `node --test src/world/kits/`).
//
// The snow worlds' fir (florakit.js firGeometry) hangs rings of needle cards round a cone, so it is a cone of foliage
// rather than a tree of boughs, and it carries snow this kind does not want. This one is built as a tree of LIMBS:
//   - a straight spire of a trunk, thin at the top but never gone, ending in a leader spike above the last whorl;
//   - tiered whorls of real boughs, three to seven to a whorl, each a thin tube that leaves the trunk rising and then
//     SAGS. The sag is a share of the bough's OWN length, and that share grows with the length, so the long low boughs
//     end well below where they left the trunk while the short high ones still point up. That is the thing that makes
//     a spruce read as a spruce and not as a cone;
//   - every bough forks: one branchlet off the high whorls' boughs, two off the long low ones, each sagging harder than
//     its parent, so the limbs read as limbs and not as spokes;
//   - the needles are MANY SMALL CARDS laid in little sprays ALONG each bough and each fork, thickest near the ends and
//     flattened (a bough's needles hang in a plane), so the eye has a bough to follow and not a disc. Each spray's
//     light follows its own bough out from the trunk (massC is the bough's base, not the crown's middle), so one bough
//     is not lit as part of one round crown;
//   - the whorls are long and wide near the ground, short and tight at the top, and the plan keeps a gap of clear air
//     between one whorl's needles and the next, so the dark trunk shows through (the gaps are in the test's numbers).
// The needles are laid with a LOW shade0: in the owner's reference pictures these trees are a twentieth of the paint
// and they are what makes the oranges sing, so the dark is the kind's own colours (looks/<world>.js leaf washes), not
// an inner-shade number piled on top.
// (florakit's `stroke` is not used here: a stroke is rooted on the ground and arches up from it, which suits grass and
// fronds; a needle spray hangs anywhere in the air, so it is leafCards' lozenges, pointed at both ends, as the fir's
// needles are.)
import { Builder, tube, leafCards, V } from '../kitbuild.js';
import { mulberry32 } from '../noise.js';

// lod 0 full (near), 1 cheap (far). spec.slender: the oil look's woods want a taller, narrower tree, as the other
// tall kits read it (florakit.js birchGeometry, pineGeometry).
export function spruceGeometry(seed, lod, spec) {
  const rnd = mulberry32(seed), B = new Builder();
  B.axis = !!(spec && spec.trees2);      // (?trees2=: kitbuild.js tube, the wood's pinch at the lens)
  const sl = !!(spec && spec.slender);
  const H = sl ? 13.5 + rnd() * 5.5 : 10.5 + rnd() * 5.0;
  // a spruce stands nearly straight: a little lean, and none of the birch's S-bend
  const lean = (rnd() - 0.5) * 0.5, lz = (rnd() - 0.5) * 0.42;
  // THE TREE'S OWN CHARACTER, so that no two seeds are the same tree: how thickly it is boughed and how far its boughs
  // reach. The owner's references never show two alike.
  const bushy = 0.78 + rnd() * 0.46, wide = (sl ? 0.84 : 1) * (0.90 + rnd() * 0.22);
  const big = lod === 0 ? 1 : 1.9;        // far off: fewer needles, each larger, so a tree is still as full
  const baseY = -0.12;                    // the stem goes on under the floor: ending square on it, a tree stands as a post on a plane

  // ---- the spire ------------------------------------------------------------------------------
  const segs = lod === 0 ? 6 : 2, sides = lod === 0 ? 5 : 4, pts = [], rad = [];
  const rAt = (t) => 0.235 - 0.195 * Math.pow(Math.max(0, t), 0.85);
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    pts.push(V(lean * t * t, baseY + (H - baseY) * t, lz * t * t));
    rad.push(rAt(t) * (i === 0 ? 1.4 : 1));
  }
  // (shade on bark is "how much of the dark bark wash": a twig's is near 1, a trunk's is 0 (materials.js, "thin
  // branches read dark"). The spire is laid at 0.3 -- dark, but well under the half where the shader starts treating a
  // piece as a twig and parts it when the eye is close -- so the trunk stays whole and visible to the top.)
  tube(B, pts, rad, sides, { part: 0, shade: 0.3, swayK: 0.25, swayH: H, hash: rnd() });
  // the foot: the stem spreads into the ground over its lowest half metre (firGeometry's, and for the same reason)
  if (lod === 0) tube(B, [V(0, -0.34, 0), V(0, -0.02, 0), V(pts[1].x * 0.25, 0.5, pts[1].z * 0.25)], [rad[0] * 2.0, rad[0] * 1.5, rad[0] * 0.98], sides, { part: 0, shade: 0.3, swayK: 0, swayH: H, hash: rnd() });
  // the leader: the spike of new stem above the last whorl that names this shape. It is the stem's own tip, not a
  // bough, so it carries the trunk's number (-1) and bends with the trunk instead of ringing on its own.
  const spike = 0.55 + rnd() * 0.55, top = pts[segs];
  tube(B, [top, V(top.x, H + spike, top.z)], [rad[segs] * 0.95, 0.009], lod === 0 ? 4 : 3, { part: 0, shade: 0.45, branch: -1, swayK: 0.25, swayH: H, hash: rnd() });

  // ---- the plan of whorls, before anything is laid -------------------------------------------
  // (the plan is made first so that the needles can be shared out by what the tubes have already cost: see below)
  const axis = (y) => { const t = Math.min(1, Math.max(0, (y - baseY) / (H - baseY))); return V(lean * t * t, y, lz * t * t); };
  // seven tiers near by, four far off (a far spruce is still tiered: that is what names the kind at a distance)
  const whorls = lod === 0 ? 7 : 4;
  const yLow = 0.12 * H, yTop = 0.90 * H, limbs = [];
  for (let w = 0; w < whorls; w++) {
    const t = w / (whorls - 1);                          // 0 the lowest whorl, 1 the highest
    const y = yLow + (yTop - yLow) * t;
    // three to seven boughs, more near the ground, and this tree's own thickness over it
    const nb = Math.max(3, Math.min(7, Math.round((3.2 + 3.3 * (1 - t)) * bushy + (rnd() - 0.5) * 0.8)));
    const ph = rnd() * 6.283;                            // each whorl turned its own way, so the boughs never line up in a row
    for (let i = 0; i < nb; i++) {
      const ang = ph + (i / nb) * 6.283 + (rnd() - 0.5) * 0.5;
      const len = H * (0.205 - 0.145 * t) * wide * (0.82 + rnd() * 0.36);
      // how steeply it leaves the trunk, and how hard it then sags: both as a share of its own length, and the sag's
      // share grows with the length, so a long low bough ends about a third of its length BELOW its base and a short
      // high one a quarter of its length above it
      const rel = len / (0.205 * H * wide);
      const rise = 0.30 + 0.38 * t + rnd() * 0.10, drop = 0.30 + 0.30 * rel + rnd() * 0.08;
      limbs.push({ w, t, y, ang, len, rise, drop, nf: lod === 0 ? (t < 0.5 ? 2 : 1) : 0, bid: 0, base: null, pt: null, forks: [] });
    }
  }

  // ---- the limbs ------------------------------------------------------------------------------
  const sS = lod === 0 ? [0, 0.38, 0.72, 1] : [0, 0.6, 1];              // where a bough's tube is jointed
  const rK = lod === 0 ? [1, 0.62, 0.38, 0.18] : [1, 0.5, 0.2];
  for (let k = 0; k < limbs.length; k++) {
    const L = limbs[k], c = axis(L.y);
    L.bid = (k * 0.618034 + 0.13) % 1;                                   // its own number: it is loaded by its own wind and rings at its own time (PHYSICS' crown)
    L.base = V(c.x, L.y, c.z);
    L.pt = (s) => V(c.x + Math.cos(L.ang) * L.len * s, L.y + L.len * (L.rise * s - L.drop * s * s), c.z + Math.sin(L.ang) * L.len * s);
    const r0 = 0.028 + 0.020 * (L.len / 3);
    tube(B, sS.map(L.pt), rK.map((f) => Math.max(0.006, r0 * f)), 3, { part: 0, shade: 0.85, sway0: 0.18 + 0.45 * L.t, hash: rnd(), branch: L.bid });
    // the forks. A branchlet leaves the bough about halfway out, swings to one side, and sags harder than its parent
    // (it is thinner). It carries its parent's number, so a bough and everything on it swing together.
    for (let j = 0; j < L.nf; j++) {
      const s0 = 0.40 + 0.26 * rnd(), p0 = L.pt(s0);
      const a2 = L.ang + (j ? 1 : -1) * (0.5 + rnd() * 0.5), l2 = L.len * (0.30 + 0.20 * rnd());
      const rise2 = L.rise * 0.8, drop2 = L.drop * 1.25;
      const F = (u) => V(p0.x + Math.cos(a2) * l2 * u, p0.y + l2 * (rise2 * u - drop2 * u * u), p0.z + Math.sin(a2) * l2 * u);
      tube(B, [F(0), F(0.6), F(1)], [Math.max(0.005, r0 * 0.5), Math.max(0.005, r0 * 0.3), 0.005], 3, { part: 0, shade: 0.9, sway0: 0.3 + 0.45 * L.t, hash: rnd(), branch: L.bid });
      L.forks.push({ F, len: l2 });
    }
  }

  // ---- the needles ----------------------------------------------------------------------------
  // THE NEEDLES' BUDGET is what is left of the tree's triangles once every tube is laid. So a thickly boughed tree and
  // a sparse one cost the same: the bushy one spends its triangles on boughs, the sparse one on needles. A card is two
  // triangles. (The other way round -- a fixed number of needles to a bough -- a thickly boughed seed costs far more
  // than a sparse one, and it is the near tree's cost that the look has to hold to.)
  const TRI = lod === 0 ? 2880 : 650;
  const keepTop = lod === 0 ? 26 : 10;                                   // kept back for the leader's own spray
  let budget = Math.max(60, Math.floor((TRI - B.idx.length / 3) / 2) - keepTop);
  let wTot = 0;
  for (const L of limbs) wTot += L.len;
  const S = lod === 0 ? [0.26, 0.45, 0.62, 0.78, 0.90, 1.0] : [0.45, 0.78, 1.0];
  const SW = lod === 0 ? [0.6, 0.9, 1.2, 1.6, 2.0, 2.2] : [1.0, 1.7, 2.1];
  const U = [0.45, 0.78, 1.0], UW = [0.7, 1.1, 1.4];
  let cards = 0;
  // one spray: a small flattened cloud of needle cards on a point of a limb. rr is its reach across the bough and a
  // little under half of that upward, so a spray lies in its bough's own plane (needles do) and the whorls keep the
  // air between them that lets the trunk show.
  const spray = (p, nWant, rr, L, s) => {
    const n = Math.min(nWant, budget - cards);           // the budget is a hard ceiling: rounding a hundred sprays up never breaks it
    if (n < 1) return;
    leafCards(B, p, rr, rr * 0.42, rr, rnd, {
      n, len: 0.30 * big, wid: 0.082 * big, branch: L.bid,
      massC: L.base, massK: 0.5,
      sway: Math.min(1, 0.22 + 0.5 * (p.y / H) + 0.25 * s),
      shade0: 0.03 + 0.10 * (1 - L.t), shadeK: 0.5, droop: 0.9,
    });
    cards += n;
  };
  // (?pines, 24 Nov: shared out by LIMB, not by length, the short high boughs get as many needles as the long low ones,
  //  so the top is the dark narrow cone the references show rather than a pole with specks over a broad skirt; the
  //  same budget, so the same triangles. ONLY THE MIDDLE FORM (lod 1, from where the near tree hands over): the near
  //  spruce stays exactly as the owner approved it, the look director's ruling. spec.needleTop, set by flora.js only
  //  with the switch.)
  const byLimb = !!(spec && spec.needleTop) && lod !== 0;
  for (const L of limbs) {
    const share = byLimb ? budget / limbs.length : budget * (L.len / wTot);
    let wSum = 0;
    for (const w of SW) wSum += w;
    for (const f of L.forks) for (const w of UW) wSum += w;
    for (let i = 0; i < S.length; i++) {
      const s = S[i], rr = (0.07 + 0.075 * L.len) * (0.72 + 0.5 * s) * big;
      spray(L.pt(s), Math.max(1, Math.round(share * SW[i] / wSum)), rr, L, s);
    }
    for (const f of L.forks) for (let i = 0; i < U.length; i++) {
      const rr = (0.06 + 0.06 * f.len) * (0.72 + 0.5 * U[i]);
      spray(f.F(U[i]), Math.max(1, Math.round(share * UW[i] / wSum)), rr, L, 0.8);
    }
  }
  budget += keepTop;                                     // the leader's share, held back above
  // the leader's own needles: a tight spray up the spike, so the top of the tree is a point and not a stub. It is the
  // stem's tip, so it is given a number of its own rather than a bough's.
  const lead = { bid: 0.4721, base: V(top.x, H, top.z), t: 1 };          // (a number no bough is given: it rings on its own)
  spray(V(top.x, H + spike * 0.45, top.z), Math.round(keepTop * 0.6), 0.13 * big, lead, 0.9);
  spray(V(top.x, H + spike * 0.92, top.z), Math.round(keepTop * 0.4), 0.09 * big, lead, 1.0);

  const g = B.build();
  // THE SHAPE IN NUMBERS, for the test and for the log: this file was written where no picture could be drawn, so the
  // test reads these and checks them against the geometry itself.
  const wh = [];
  for (const L of limbs) {
    const sp = Math.min(1, L.rise / (2 * L.drop));                       // where along the bough it stops rising
    const peak = L.len * (L.rise * sp - L.drop * sp * sp), tipDy = L.len * (L.rise - L.drop);
    const reach = (0.07 + 0.075 * L.len) * 1.22 * big;                   // how far a tip spray's needles hang past the tip
    const e = wh[L.w] || (wh[L.w] = { y: L.y, boughs: 0, len: 0, hi: -1e9, lo: 1e9 });
    e.boughs++; e.len = Math.max(e.len, L.len);
    e.hi = Math.max(e.hi, L.y + peak + reach * 0.5); e.lo = Math.min(e.lo, L.y + tipDy - reach);
  }
  g.userData.spruce = { H, height: H + spike, slender: sl, whorls: wh, limbs: limbs.length, forks: limbs.reduce((a, L) => a + L.nf, 0), cards };
  return g;
}
