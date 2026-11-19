// Painted Cosmos: the broad-crowned tree of the autumn woods, a maple or an oak. OWNER: PAINTER.
// Built 2026-11-18, the owner asking for more branches and more kinds of tree: "Give the trees more branches as well
// and more versions of them ... each still at least drawn in an artistic way with strokes".
//
// Every other tall kit here is a stem with a mass of leaves on top. This one is built the way the owner's autumn
// references read: a SHORT THICK TRUNK that forks LOW - measured at a fifth to a quarter of the tree's height, 1.8 to
// 2.4 m up - into three to five main limbs; each of those forks in two, and the long low ones once more, so a tree is
// 12 to 22 separate tubes, where today's broadleaf is a stem with three to nine straight boughs; and the leaves hang in
// SEVERAL ROUNDED CLUMPS at the limbs' ends instead of one mass, so that bare limb and sky show through the crown.
// That is what makes a tree of it rather than a lollipop. Measured over sixteen seeds: 8.6 to 11.7 m tall with a crown
// 12.4 to 17.6 m across, that is 1.2 to 1.7 times as wide as it is tall; seven to thirteen clumps of leaves. The lowest
// limb always reaches out and DOWN: it leaves the stem going downhill and its end hangs below where it started.
//
// The leaves are strokes, not slabs: six-cornered leaf cards about a third of a metre long (florakit.js leafCards with
// `round`), laid many to a clump - more and smaller, since the game now draws at up to four times the pixels it used
// to, so small dabs have pixels to live in. Six hundred of them near by, measured at 0.33 by 0.20 m each; 260 larger
// ones far off. The tree's leaf count is fixed and shared out over however many limb ends a seed happens to grow, so
// one tree of this kind costs about what the next one does: 2624 to 2764 triangles near, 578 to 606 far.
//
// Nothing here has been SEEN. It was built and measured, never looked at: no browser was run. maple.test.mjs builds it
// at many seeds and prints its numbers, which is the only account of its shape there is.
// For FLORA_PHYS when this kit is wired in: height about 10 m, stiffness 1 (it is a tree).
import { Builder, tube, leafCards, V } from '../kitbuild.js';
import { mulberry32 } from '../noise.js';

// lod: 0 full (near), 1 medium (the trunk, the main limbs, and one large clump on each)
// (spec.slender, as in birchGeometry and pineGeometry: the deep wood's version, forking a little higher with a
// narrower crown, so that from the ground a wood is its trunks against the air. Without it, the open-grown tree.)
export function mapleGeometry(seed, lod, spec) {
  const rnd = mulberry32(seed), B = new Builder();
  const near = lod === 0;
  const sl = !!(spec && spec.slender);
  // the height the tree is cut to reach: the limb lengths below are set so the topmost limb's chain of forks ends
  // near it (measured: 8.6 to 11.7 m)
  const H = (sl ? 11.0 : 10.3) + rnd() * 2.6;
  // the stem: short, thick and leaning its own way, with a slight bend in it so no two are alike
  const lean = (rnd() - 0.5) * 0.9, lz = (rnd() - 0.5) * 0.7, ph = rnd() * 3;
  // (low, as the references are: measured at a fifth to a quarter of the tree's height, never above a third, at
  // either level of detail)
  const forkY = H * (sl ? 0.20 : 0.18) * (0.9 + 0.2 * rnd());
  const r0 = (sl ? 0.30 : 0.38) * (0.86 + 0.28 * rnd());
  const segs = near ? 4 : 2, sides = near ? 6 : 4;
  // the stem's centre line, 0 at the ground and 1 at the fork; the limbs are started from it too
  const axis = (t) => V(lean * t * t + 0.12 * Math.sin(t * 2.6 + ph) * t, forkY * t, lz * t * t);
  // (a foot, as the oil look's other trees have: the stem spreads over its lowest quarter metre and goes on under the
  // floor, so it is not a post set on a plane. Here it is two rings of the trunk's own tube, cheap enough to keep at
  // both levels of detail, which is also what puts a vertex below y = 0 whichever level is drawn.)
  const pts = [V(axis(0).x, -0.24, axis(0).z)], rad = [r0 * 1.70];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    pts.push(axis(t));
    rad.push(r0 * (i === 0 ? 1.34 : 1) * (1 - 0.34 * Math.pow(t, 0.8)) * (0.93 + 0.14 * rnd()));
  }
  tube(B, pts, rad, sides, { part: 0, swayK: 0.22, swayH: H, hash: rnd() });
  const rTop = r0 * 0.66, top = axis(1);
  const crownC = V(top.x * 0.8, H * 0.62, top.z * 0.8);

  // What the limbs came to, written down for the test: nobody can look at this tree, so its shape is read as numbers.
  // (depth 0 the trunk, 1 a main limb, 2 what a main limb forks into, 3 the fork of a low one.)
  const limbs = [{ depth: 0, from: [pts[0].x, pts[0].y, pts[0].z], tip: [top.x, top.y, top.z], r: r0, len: forkY + 0.24 }];
  const clumps = [];
  let twigs = 0;      // the whole tree's third-order twigs, held to six so that every seed costs about the same

  // One limb, and the limbs it forks into. ang is the way it sets off round the stem, el how steeply it climbs
  // (negative: it goes out and down), len its length, r its girth at the fork, bid the main limb's own number.
  function grow(p0, ang, el, len, r, depth, bid) {
    const dx = Math.cos(ang) * Math.cos(el), dy = Math.sin(el), dz = Math.sin(ang) * Math.cos(el);
    const tip = V(p0.x + dx * len, p0.y + dy * len, p0.z + dz * len);
    // a limb arches: it leaves the stem climbing and flattens toward the end under its own weight, the more so the
    // nearer level it set off, so the lowest limbs end lower than they began
    const bow = len * (0.06 + 0.17 * Math.max(0, 1 - Math.max(0, el) * 1.6));
    const mid = V((p0.x + tip.x) / 2, (p0.y + tip.y) / 2 + bow, (p0.z + tip.z) / 2);
    const sd = near ? (depth === 1 ? 5 : depth === 2 ? 4 : 3) : 3;
    // (2026-11-19, the owner: "it looks like spiders not trees".) A BOUGH TAPERS. It used to leave the stem and hold
    // its width for its whole length -- a six-metre bar of one thickness, stopping dead -- which is a leg and not a
    // branch. The references are about nothing else: "a HEAVY DARK STEM, boughs seen through the leaves", "forked
    // low, with bare dark boughs REACHING WIDE", "fork into BOUGHS AND TWIGS", and the rule written for the rivers
    // and meant for both: "the HIERARCHY OF WIDTHS - one wide river, thin tributaries, thinner twigs that END".
    // A limb now thins to a FIFTH of its own base by its tip (it was 44 per cent), and bows through four points
    // rather than three so that the thinning reads along its length instead of in one step.
    // AND IT IS A CURVE, NOT TWO BARS WITH A CORNER. This is the other half of the spider, and it was hiding in
    // plain sight: `tube` joins the points it is given with STRAIGHT sections, and a bough was given three -- its
    // foot, its middle and its tip -- so the arch everyone meant was two straight bars meeting at one hard corner
    // half way along. That corner is a KNEE. The limb is sampled off a real curve now (a quadratic through the
    // raised middle), four or five points along it, so it leaves the stem, bends and goes on: the references'
    // "LONG FLOWING STROKES" and limbs that "spread over the whole top of the picture".
    const ctl = V(mid.x * 2 - (p0.x + tip.x) * 0.5, mid.y * 2 - (p0.y + tip.y) * 0.5, mid.z * 2 - (p0.z + tip.z) * 0.5);
    const at = (t) => { const u = 1 - t;
      return V(u * u * p0.x + 2 * u * t * ctl.x + t * t * tip.x, u * u * p0.y + 2 * u * t * ctl.y + t * t * tip.y, u * u * p0.z + 2 * u * t * ctl.z + t * t * tip.z); };
    const nP = depth >= 3 ? 3 : near ? 5 : 4;
    const path = [], rr = [];
    for (let i = 0; i < nP; i++) { const t = i / (nP - 1); path.push(at(t));
      // the width runs from its own base to a FIFTH of it at the tip, fastest near the tip, as a bough does
      rr.push(r * (1 - 0.80 * Math.pow(t, 1.35))); }
    // (deeper in the crown a limb is laid darker and swings more, as the branches of the other kits are)
    tube(B, path, rr, sd, { part: 0, shade: 0.25 + 0.2 * depth, sway0: 0.15 + 0.22 * depth, hash: rnd(), branch: bid });
    limbs.push({ depth, from: [p0.x, p0.y, p0.z], tip: [tip.x, tip.y, tip.z], r, len });
    // a main limb always forks; one of its halves forks once more if it is a long low one and the tree has twigs to
    // spare, so that the crown's ends are at two different depths and the outline is ragged rather than even
    const again = near && (depth === 1 || (depth === 2 && twigs < 6 && el < 0.75 && rnd() < 0.6));
    if (again) {
      for (let i = 0; i < 2; i++) {
        // the two halves of a fork part widely - a narrow fork reads as one long branch, and its reach piles onto its
        // parent's instead of spreading the crown sideways
        const a2 = ang + (i ? 1 : -1) * (0.42 + 0.46 * rnd());
        // (2026-11-19) A FORK BENDS, IT DOES NOT HINGE. A low limb used to turn up by 0.80 rad -- 46 degrees in one
        // joint, on top of as much again sideways -- and that hard elbow is the second half of what read as a leg.
        // The references ask for "LONG FLOWING STROKES" and limbs that "spread over the whole top of the picture".
        // The turn is 0.44 now, and the arching below carries the rest of the lift, so the line keeps going instead
        // of breaking. The crown still closes: the test that pins its width is unchanged.
        const e2 = Math.max(-0.26, Math.min(1.36, el + (el < 0.35 ? 0.44 : -0.12) + (rnd() - 0.5) * 0.34));
        if (depth === 2) twigs++;
        grow(tip, a2, e2, len * (0.48 + 0.14 * rnd()), r * 0.56, depth + 1, bid);
      }
      return;
    }
    // A HAZE OF FINE TWIGS AT THE END, which is the last thing the references ask of a branch and the game did not
    // have: "slender dark trunks ... each ending in a HAZE OF FINE BARE TWIGS", and "fork into boughs AND TWIGS".
    // A limb used to stop dead at a point. Three or four hairs now spray from its tip, each a fifth of its parent's
    // length and a third of its width, so the outline breaks up instead of ending on a full stop. They are the
    // cheapest thing on the tree -- three rings of three sides, about a dozen triangles each -- and only near by.
    if (near && depth >= 2) {
      const nh = 3 + ((rnd() * 2) | 0);
      for (let i = 0; i < nh; i++) {
        const ah = ang + (i - (nh - 1) * 0.5) * (0.5 + 0.4 * rnd()) + (rnd() - 0.5) * 0.3;
        const eh = Math.max(-0.5, Math.min(1.5, el + (rnd() - 0.4) * 0.8));
        const lh = len * (0.16 + 0.12 * rnd()), rh = r * 0.30;
        const hx = Math.cos(ah) * Math.cos(eh), hy = Math.sin(eh), hz = Math.sin(ah) * Math.cos(eh);
        const h1 = V(tip.x + hx * lh * 0.5, tip.y + hy * lh * 0.5 + lh * 0.10, tip.z + hz * lh * 0.5);
        const h2 = V(tip.x + hx * lh, tip.y + hy * lh + lh * 0.06, tip.z + hz * lh);
        tube(B, [tip, h1, h2], [rh, rh * 0.5, rh * 0.18], 3, { part: 0, shade: 0.9, sway0: 0.9, hash: rnd(), branch: bid });
        limbs.push({ depth: 4, from: [tip.x, tip.y, tip.z], tip: [h2.x, h2.y, h2.z], r: rh, len: lh });   // (written down like the rest: the kit's record is checked against the mesh)
      }
    }
    // the end of a limb: a rounded clump of leaves, set a little beyond the tip and a little above it
    const rc = H * (near ? 0.075 : 0.135) * (0.78 + 0.45 * rnd()) * (sl ? 0.86 : 1);
    // (held up off the floor: a clump on the end of a low limb that hangs through the ground is leaves buried in it)
    const cy = Math.max(tip.y + dy * rc * 0.3 + rc * 0.2, rc * 1.25 + 0.5);
    clumps.push({ c: V(tip.x + dx * rc * 0.5, cy, tip.z + dz * rc * 0.5), r: rc, bid });
  }

  // the main limbs: three to five, leaving the stem over its top third, the lowest first. The low ones are the long
  // ones and set off nearly level; the last is the stem carried on upward.
  const nL = 3 + ((rnd() * 3) | 0);
  for (let k = 0; k < nL; k++) {
    const up = nL > 1 ? k / (nL - 1) : 0.5;
    const p0 = axis(0.70 + 0.30 * up);
    const ang = k * 2.399 + (rnd() - 0.5) * 0.9;                      // the golden turn, so limbs do not stack
    // the lowest limb always sets off downhill - it reaches out and DOWN, whatever the seed - and is the longest; the
    // topmost climbs steeply, so it can be long without widening the crown
    const el = Math.min(1.38, -0.10 + 1.50 * Math.pow(up, 1.15) + (rnd() - 0.5) * 0.16);
    const len = H * 0.39 * (1 + 0.05 * (1 - up)) * (0.90 + 0.20 * rnd()) * (sl ? 0.88 : 1);
    grow(p0, ang, el, len, rTop * (0.80 - 0.18 * up), 1, (k * 0.618034 + 0.13) % 1);
  }

  // The leaves. A fixed number for the whole tree, shared out by clump size, so a seed with many limb ends gets many
  // small clumps and one with few gets fuller ones, and both cost the same. Near by they are the six-cornered card
  // (four triangles); far off fewer and larger plain lozenges (two), as the other kits thin their crowns by distance.
  // (2026-11-18, SEEN: the first still of these trees in the wood had crowns you could see straight through - they
  //  read as bare winter armatures with a few leaves, where the references are dense and the limbs show at the edges
  //  and through gaps. The cause was the triangle budget this kit was built to, 3000 near, which was set without
  //  looking at THE TREE IT REPLACES: the old broadleaf is 7,242 triangles near. So these crowns were 2.7 times too
  //  thin. The count below is raised to sit beside the old tree's own cost, not beside a number picked in the air.)
  // (2026-11-18, the owner: "give the trees as much leaves as you can and make it as as best as you can".) Raised
  //  again, above the old broadleaf's own cost this time. It is spent only on the NEAR tier, which is a handful of
  //  trees in any frame; the far tiers, which are thousands, are left exactly as they were, so the wood gains its
  //  fullness where the eye is and costs nothing where it is not.
  const total = near ? 2560 : 260;
  let wsum = 0;
  for (const q of clumps) wsum += q.r * q.r;
  for (const q of clumps) {
    const n = Math.max(near ? 20 : 12, Math.round(total * q.r * q.r / wsum));
    leafCards(B, q.c, q.r * 1.15, q.r * 0.90, q.r * 1.15, rnd, {
      n, len: near ? 0.33 : 0.62, wid: near ? 0.22 : 0.40, round: near ? 1 : 0, branch: q.bid,
      massC: crownC, massK: 0.55, sway: 0.55 + 0.45 * (q.c.y / H), shade0: 0.03, shadeK: 0.55, droop: 0.35,
    });
  }
  const g = B.build();
  g.userData.limbs = limbs;            // the shape as numbers (see above): the test reads it
  return g;
}
