// Painted Cosmos: A TALL PINE, built from the florakit's own pieces. OWNER: PAINTER.
// Asked for by the owner on 18 November, with more branches and more kinds of tree: "Give the trees more branches as
// well and more versions of them ... each still at least drawn in a artistc way with strokes you decide the trees the
// fit that look best as many as you want". This is the tree that gives the owner's references their vertical rhythm:
// a long BARE pole of a trunk, and high up a few long limbs holding an open, flat-topped canopy.
// NOT SEEN. It was built where no picture can be drawn, so nothing here is said about how it looks; what is known of
// its shape is the numbers its test prints (pine.test.mjs, run with `node --test src/world/kits/*.test.mjs`).
//
// What it adds to the pine the game already has (florakit.js pineGeometry, which is this tree's starting point and not
// its answer). That one hangs six tiers of needles down the upper two thirds of the stem, so it is a column of
// foliage; this one is a tree of LIMBS:
//   - the lower trunk is GENUINELY BARE: no needle of it is laid below about 0.62 of its height, so at eye level there
//     is nothing but wood and you see straight through a wood of them. That clear air under the canopy is what gives
//     the references their depth, and it is the one thing this kind is for;
//   - four to eight LONG LIMBS, real tubes, leaving the trunk NEARLY LEVEL (they dip a few centimetres as they go) and
//     then turning up over their outer half, so each one is a shallow hook. The lower limbs are longer and turn up
//     harder than the high ones, so every limb's end arrives at about the same height: that is what makes the top
//     flat instead of a dome;
//   - each limb forks, twice on the long low ones and once high up, so the branch structure reads through the crown
//     rather than a spoke going into a lump;
//   - the needles sit ONLY on the outer four tenths of the limbs and the forks, in FLAT PLATES (a plate is as wide as
//     a limb is long but a fifth as thick), never balls. Each plate's light follows its own limb out from the trunk
//     (massC is the limb's base, not the crown's middle), so one limb is not lit as a piece of one round crown;
//   - one or two DEAD LIMBS low on the bare trunk: short, drooping, and bare of needles, as the references show them.
// The crown therefore comes out WIDER THAN IT IS DEEP, half again to three quarters again as wide, so from below it is
// a canopy with sky between the limbs and from the air a flat star of needle plates with the limbs' wood between them.
//
// The needles are strokes, not slabs: leafCards' lozenges, pointed at both ends, 0.34 m long and 7.5 cm wide, and
// MANY -- some twelve hundred near by, where the old pine's tiers were six lumpy washes. The game now draws at up to
// four times the pixels it used to, so dabs this small have pixels to live in.
//
// MEASURED over eight seeds (pine.test.mjs prints all of it): 17.7 to 21.4 m tall with a crown 9.0 to 11.7 m across
// and 5.6 to 7.8 m deep; the lowest needle 11.8 to 14.2 m up, which is 0.62 to 0.67 of the height, so there are ten
// to thirteen metres of clear air under the canopy at eye level; four to eight limbs, 2.6 to 4.4 m long, carrying six
// to thirteen forks between them, and one or two dead stubs; 1200 to 1295 needle cards near by in 29 to 59 plates,
// 267 to 293 in 9 to 17 plates far off. 2878 to 2880 triangles near, 646 to 650 far -- the needles take whatever the
// wood leaves over, so the cost swings by two triangles between a four-limbed seed and an eight-limbed one.
// (florakit's `stroke` is not used here, though a needle is exactly the long thin mark it makes: a stroke is laid as
// part 2, a blade, which the painter puts in the grass washes and not the kind's leaf washes, and it sets no leaf
// centre, so the oil look's "a leaf's paint, once a leaf" would have nothing to paint it by. leafCards' lozenge is
// the needle of the fir and of the old pine both, and it is the one used here.)
//
// For FLORA_PHYS when this kit is wired in: height about 20 m, stiffness 1 (it is a tree).
import { Builder, tube, leafCards, V } from '../kitbuild.js';
import { mulberry32 } from '../noise.js';

// lod: 0 full (near), 1 cheap (far: the trunk, the limbs without their forks, and one plate at each limb's end -- a
// far pine must keep its limbs, because the limbs against the sky are what name the kind at a distance).
// (spec.slender, as in birchGeometry and pineGeometry: the oil look's deep woods want a taller, narrower tree.)
export function tallPineGeometry(seed, lod, spec) {
  const rnd = mulberry32(seed), B = new Builder();
  const near = lod === 0;
  const sl = !!(spec && spec.slender);

  // ---- the plan, drawn before a thing is laid -------------------------------------------------
  // (every number that decides the TREE is drawn here, before any number that decides how finely it is built, so that
  // one seed is the same tree near and far: the same height, the same limbs in the same places.)
  const H = (sl ? 20.0 : 16.5) + rnd() * 5.5;
  // a pine stands straight: a little lean and a slow bend, none of the birch's S
  const lean = (rnd() - 0.5) * 0.8, lz = (rnd() - 0.5) * 0.6, ph = rnd() * 3;
  // this tree's own character, so that no two seeds are one tree: how far its limbs reach, and where its bare wood
  // gives out. The owner's references never show two alike.
  const wide = (sl ? 0.86 : 1) * (0.88 + rnd() * 0.26);
  const bareTo = H * (0.62 + rnd() * 0.04);
  const nL = 4 + Math.floor(rnd() * 5);                  // four to eight long limbs
  const ph0 = rnd() * 6.283;                             // the whole crown turned its own way
  const plan = [];
  for (let k = 0; k < nL; k++) {
    const u = nL > 1 ? k / (nL - 1) : 0;                 // 0 the lowest limb, 1 the highest
    const y = bareTo + (H * 0.94 - bareTo) * u + (rnd() - 0.5) * H * 0.02;
    // turned by the golden angle from the limb below, so no two limbs sit over each other and from the air the ends
    // make a star rather than a fan
    const ang = ph0 + k * 2.3999632 + (rnd() - 0.5) * 0.5;
    const len = H * (0.21 - 0.05 * u) * wide * (0.86 + rnd() * 0.28);
    // the shape of a limb, both as shares of its OWN length: `dip` how much it falls away as it leaves the trunk
    // (small: it leaves nearly level), `up` how hard it then turns up. `up` is largest on the LOW limbs, which are
    // also the longest, so their ends climb to meet the short high ones and the canopy comes out flat on top.
    const dip = 0.05 + rnd() * 0.07;
    const up = 0.55 - 0.20 * u + (rnd() - 0.5) * 0.08;
    plan.push({ k, u, y, ang, len, dip, up, nf: near ? (u < 0.6 ? 2 : 1) : 0, bid: (k * 0.618034 + 0.13) % 1, forks: [] });
  }
  // the dead limbs: short stubs low on the bare trunk that leave it level and then droop. They are laid near by only
  // -- far off they are a few pixels of bark and the triangles are better spent on needles.
  const dead = [];
  for (let k = 0; k < (near ? 1 + (rnd() < 0.55 ? 1 : 0) : 0); k++) {
    dead.push({ y: H * (0.20 + rnd() * 0.24), ang: rnd() * 6.283, len: 0.5 + rnd() * 0.7, bid: (0.911 + k * 0.057) % 1 });
  }

  // ---- the pole -------------------------------------------------------------------------------
  const baseY = -0.15;                                   // the stem goes on under the floor: ending square on it, a tree stands as a post on a plane
  const segs = near ? 7 : 2, sides = near ? 6 : 4, pts = [], rad = [];
  const bendX = (t) => lean * t * t + 0.16 * Math.sin(t * 2.6 + ph) * t;
  const bendZ = (t) => lz * t * t + 0.12 * Math.cos(t * 2.1 + ph) * t;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, kink = near ? 0.05 : 0;
    pts.push(V(bendX(t) + (rnd() - 0.5) * kink, baseY + (H - baseY) * t, bendZ(t) + (rnd() - 0.5) * kink));
    rad.push((0.30 - 0.235 * Math.pow(t, 0.85)) * (i === 0 ? 1.35 : 1) * (0.95 + rnd() * 0.1));
  }
  // (shade on bark is "how much of the dark bark wash": a twig's is near 1, a trunk's near 0, and over a half the
  // painter treats a piece of bark as a twig (materials.js, "thin branches read dark"). The pole is laid at 0.2, well
  // under that half: it is the one thing the eye has at eye level and it must stay whole and lit.)
  tube(B, pts, rad, sides, { part: 0, shade: 0.2, swayK: 0.3, swayH: H, hash: rnd() });
  // the foot: the stem spreads into the ground over its lowest half metre (firGeometry's, for the same reason)
  if (near) tube(B, [V(pts[0].x, -0.34, pts[0].z), V(pts[0].x, -0.02, pts[0].z), V(pts[1].x * 0.25, 0.55, pts[1].z * 0.25)],
    [rad[0] * 2.0, rad[0] * 1.5, rad[0] * 0.98], sides, { part: 0, shade: 0.2, swayK: 0, swayH: H, hash: rnd() });
  // the trunk's centre line at any height, kinks aside: where a limb leaves it
  const axis = (y) => { const t = Math.min(1, Math.max(0, (y - baseY) / (H - baseY))); return V(bendX(t), y, bendZ(t)); };

  // ---- the limbs ------------------------------------------------------------------------------
  const sS = near ? [0, 0.34, 0.68, 1] : [0, 0.6, 1];    // where a limb's tube is jointed
  const rK = near ? [1, 0.60, 0.36, 0.15] : [1, 0.5, 0.18];
  for (const L of plan) {
    const c = axis(L.y);
    L.base = V(c.x, L.y, c.z);
    L.pt = (s) => V(c.x + Math.cos(L.ang) * L.len * s, L.y + L.len * (L.up * s * s - L.dip * s), c.z + Math.sin(L.ang) * L.len * s);
    const r0 = 0.042 + 0.009 * L.len;
    // its own branch number: it is loaded by its own wind and rings at its own time (PHYSICS' crown, P14), and
    // everything on it -- forks and needles alike -- carries that number, so a limb swings whole.
    tube(B, sS.map(L.pt), rK.map((f) => Math.max(0.008, r0 * f)), near ? 4 : 3,
      { part: 0, shade: 0.8, sway0: 0.25 + 0.4 * L.u, hash: rnd(), branch: L.bid });
    // the forks: a branchlet leaves the limb about half way out, swings off to one side, and turns up a little harder
    // than its parent does (it is thinner)
    for (let j = 0; j < L.nf; j++) {
      const s0 = 0.45 + 0.22 * rnd(), p0 = L.pt(s0);
      const a2 = L.ang + (j ? 1 : -1) * (0.45 + rnd() * 0.5), l2 = L.len * (0.28 + 0.18 * rnd());
      const up2 = L.up * 1.15, dip2 = L.dip * 0.7;
      const F = (v) => V(p0.x + Math.cos(a2) * l2 * v, p0.y + l2 * (up2 * v * v - dip2 * v), p0.z + Math.sin(a2) * l2 * v);
      tube(B, [F(0), F(0.55), F(1)], [Math.max(0.007, r0 * 0.5), Math.max(0.007, r0 * 0.32), 0.007], 3,
        { part: 0, shade: 0.9, sway0: 0.35 + 0.4 * L.u, hash: rnd(), branch: L.bid });
      L.forks.push({ F, len: l2 });
    }
  }
  for (const D of dead) {
    const c = axis(D.y);
    // level away from the trunk, then drooping: dead wood sags and keeps no needles
    const P = (s) => V(c.x + Math.cos(D.ang) * D.len * s, D.y - D.len * (0.30 * s * s + 0.05 * s), c.z + Math.sin(D.ang) * D.len * s);
    tube(B, [P(0), P(0.6), P(1)], [0.035, 0.020, 0.008], 3, { part: 0, shade: 0.95, sway0: 0.10, hash: rnd(), branch: D.bid });
  }

  // ---- the needles ----------------------------------------------------------------------------
  // THE NEEDLES' BUDGET is whatever is left of the tree's triangles once every piece of wood is laid, shared out by
  // limb length. So a seed with eight limbs and a seed with four cost about the same: the first spends its triangles
  // on wood, the second on needles. A card is two triangles. (The other way round -- a fixed count of needles to a
  // limb -- an eight-limbed seed costs half again as much as a four-limbed one, and it is the near tree's cost that
  // the look has to hold to.)
  const TRI = near ? 2880 : 650;
  const keepTop = near ? 26 : 10;                        // held back for the flat cap on the trunk's tip
  const big = near ? 1 : 1.9;                            // far off: fewer needles, each larger, so a tree is as full
  let budget = Math.max(60, Math.floor((TRI - B.idx.length / 3) / 2) - keepTop), cards = 0, plates = 0;
  const plateLog = [];
  // ONE PLATE of needles on a point of a limb: a flat cloud of needle cards, as wide across as it is long and a
  // fifth of that thick, so it lies in its limb's own plane. Flat plates are what make a canopy seen from below and
  // a star seen from the air; balls of needles make a column of foliage, which is the tree this kind is not.
  // (That fifth is where the needles' CENTRES lie; a needle is a third of a metre long and lies its own way, so the
  // plate the painter lays is thicker than its centres are.)
  // (A plate's REACH is the same near and far: only the needles in it change size, as the fir's do. Grown by `big`
  // as well, a far tree stood a metre and a half broader than the same seed near by.)
  const plate = (p, nWant, rr, L, s) => {
    const n = Math.min(nWant, budget - cards);           // the budget is a hard ceiling: rounding fifty plates up never breaks it
    if (n < 1) return;
    leafCards(B, p, rr, rr * 0.20, rr, rnd, {
      n, len: 0.34 * big, wid: 0.075 * big, branch: L.bid,
      massC: L.base, massK: 0.5,
      sway: Math.min(1, 0.3 + 0.5 * (p.y / H) + 0.2 * s),
      // the needles are laid with a LOW inner shade: in the owner's reference pictures the dark of a conifer is the
      // kind's own colours (looks/<world>.js leaf washes), not a shade number piled over them
      shade0: 0.04 + 0.10 * (1 - L.u), shadeK: 0.5, droop: 0.45,
    });
    cards += n; plates++; plateLog.push({ x: p.x, y: p.y, z: p.z, rr, n, bid: L.bid });
  };
  // only the outer four tenths of a limb carries needles, thickest at the very end
  const S = near ? [0.62, 0.76, 0.88, 1.0] : [0.74, 1.0];
  const SW = near ? [0.7, 1.0, 1.3, 1.5] : [1.1, 1.5];
  const U = [0.55, 1.0], UW = [0.8, 1.2];
  let wTot = 0;
  for (const L of plan) wTot += L.len;
  for (const L of plan) {
    const share = budget * (L.len / wTot);
    let wSum = 0;
    for (const w of SW) wSum += w;
    for (const f of L.forks) for (const w of UW) wSum += w;
    for (let i = 0; i < S.length; i++) {
      const s = S[i], rr = (0.30 + 0.105 * L.len) * (0.80 + 0.35 * s);
      plate(L.pt(s), Math.max(1, Math.round(share * SW[i] / wSum)), rr, L, s);
    }
    for (const f of L.forks) for (let i = 0; i < U.length; i++) {
      const rr = (0.26 + 0.10 * f.len) * (0.80 + 0.35 * U[i]);
      plate(f.F(U[i]), Math.max(1, Math.round(share * UW[i] / wSum)), rr, L, 0.9);
    }
  }
  // the flat cap on the tip of the pole, so the top of the tree is a plate and not a bare stub. It is the stem's own
  // tip rather than a limb, so it is given a number no limb is given: it rings on its own.
  budget += keepTop;
  const top = pts[segs], cap = { bid: 0.5307, base: V(top.x, H * 0.92, top.z), u: 1 };
  plate(V(top.x, H + 0.10, top.z), keepTop, 0.42, cap, 1);

  const g = B.build();
  // THE SHAPE IN NUMBERS, for the test and for the log: this file was written where no picture could be drawn, so the
  // test reads these and checks them against the geometry itself.
  g.userData.tallPine = {
    H, bareTo, slender: sl, limbs: plan.length, forks: plan.reduce((a, L) => a + L.forks.length, 0),
    dead: dead.length, deadBids: dead.map((D) => D.bid), capBid: cap.bid, cards, plates, plateLog,
    limbLog: plan.map((L) => ({ bid: L.bid, baseY: L.y, len: L.len, ang: L.ang % 6.283, tipY: L.pt(1).y, nf: L.forks.length })),
  };
  return g;
}
