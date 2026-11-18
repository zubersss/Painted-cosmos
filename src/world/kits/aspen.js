// Painted Cosmos: AN ASPEN STAND - several pale slender stems out of one root. OWNER: PAINTER.
// Built 2026-11-18, the owner asking for more branches and more kinds of tree: "Give the trees more branches as well
// and more versions of them ... each still at least drawn in an artistic way with strokes".
//
// This kit is not one tree: it is a GROUP, which is how an aspen actually grows. One root sends up many stems of
// different ages at once, so they stand in close clumps, a tall one beside a half-grown one, and the owner's
// references are noted as showing them that way - pale verticals in groups, about four parts in a hundred of all the
// paint in them. So one of these geometries is three to seven stems from one place: each slender, each nearly
// straight, each with a few short limbs low down and more near its top, and each with its own small high crown.
// The stems are the point. They are kept smooth (five sides near by, no kinks, only a gentle lean away from the group
// and one slow bend across it) and laid with no inner shade, so that the kind's own pale bark colours carry them and
// they read as clean verticals from a distance.
//
// WHAT IS NEW HERE, and what the owner asked for first: the LIMBS ARE REAL TUBES and the leaves hang on their ends.
// Today's broadleaf is a stem with a mass of leaves on top; this is 36 to 53 separate tubes (3 to 7 stems, 14 to 20
// main limbs, 16 to 28 forks of those), and the leaves in 28 to 40 small loose puffs on the limb ends and the stems'
// tips, so that bare limb and sky show through every crown.
// The leaves are strokes, not slabs: six-cornered leaf cards (florakit.js leafCards with `round`) a quarter of a
// metre long, laid MANY and SMALL - the game now draws at up to four times the pixels it used to, so small dabs have
// pixels to live in - and spread thin inside each puff, so a crown is a haze rather than a blob, as an aspen's is.
//
// THE SWAY OF A STAND. Everything of the sway here is reckoned off the stem it belongs to and never off the group:
// each stem's trunk tube is given ITS OWN height as `swayH` (so a seven-metre stem is fully bent at seven metres, not
// a third bent because its neighbour is twenty), and every limb and every leaf puff takes its sway from how far up
// ITS OWN stem it sits. The same goes for `massC`, the crown centre a leaf's light follows: each stem has its own.
// What this kit CANNOT set for itself is PHYSICS' own bend, which takes one height for the whole model (materials.js
// PROP_VERT, uPlantHeight): with the wind physics on, a short stem of the stand is bent on the tall one's curve, so
// it will look stiffer than it should. Mending that means touching src/physics, which was not this job; it is written
// down here in case it shows when somebody finally looks at a stand in the wind.
//
// Measured over sixteen seeds (aspen.test.mjs, which prints all of it): 3 to 7 stems, each stand 14.6 to 18.2 m tall
// over all (16.6 to 20.1 m with spec.slender) and 4.0 to 7.2 m across, with stems of 7.3 to 15.9 m standing together;
// 2544 to 2912 triangles near and 490 to 636 far; 503 to 542 leaf cards near, 0.26 m long and 0.19 m wide on average,
// and 200 to 213 far at 0.57 by 0.42 m.
//
// Nothing here has been SEEN. It was built and measured on a machine with no graphics card; no browser was run, so
// there is no still of it, and the numbers in aspen.test.mjs are the only account of its shape there is.
// For FLORA_PHYS when this kit is wired in: height about 16 m (the tallest stem and its crown), stiffness 1 (a tree).
import { Builder, tube, leafCards, V } from '../kitbuild.js';
import { mulberry32 } from '../noise.js';

// lod: 0 full (near), 1 medium (every stem, two limbs each, no forks, and fewer larger leaves)
// (spec.slender, as in birchGeometry and pineGeometry: the deep wood's version - taller, straighter, its crowns
// narrower, so that from the ground a wood is its trunks against the air. Without it, the open-grown stand.)
// It is registered nowhere: the coordinator wires it into TALL_KITS.
export function aspenGeometry(seed, lod, spec) {
  const rnd = mulberry32(seed), B = new Builder();
  const near = lod === 0;
  const sl = !!(spec && spec.slender);
  // three to seven stems: a clone puts up as many as it likes, and the stands in the references are never twins
  const nS = 3 + ((rnd() * 5) | 0);
  const Hmax = (sl ? 15.0 : 13.0) + rnd() * 3.5;
  const a0 = rnd() * 6.283;                        // which way the group fans out of the ground
  const segs = near ? 3 : 2, sides = near ? 5 : 3;
  // The whole stand's leaves, shared out at the end over however many limb ends the seed happened to grow (by the
  // square of each puff's size), so a stand of seven stems costs about what a stand of three does and one tree of
  // this kind costs about what the next one does.
  // (2026-11-18, SEEN: the first still of these trees in the wood had crowns you could see straight through - they
  //  read as bare winter armatures with a few leaves, where the references are dense and the limbs show at the edges
  //  and through gaps. The cause was the triangle budget this kit was built to, 3000 near, which was set without
  //  looking at THE TREE IT REPLACES: the old broadleaf is 7,242 triangles near. So these crowns were 2.7 times too
  //  thin. The count below is raised to sit beside the old tree's own cost, not beside a number picked in the air.)
  // (2026-11-18, the owner: "give the trees as much leaves as you can and make it as as best as you can".) Raised
  //  again, above the old broadleaf's own cost this time. It is spent only on the NEAR tier, which is a handful of
  //  trees in any frame; the far tiers, which are thousands, are left exactly as they were, so the wood gains its
  //  fullness where the eye is and costs nothing where it is not.
  const totalCards = near ? 2340 : 200;

  const tubes = [], stems = [], clumps = [];      // what was laid, written down for the test: see the end of the file
  for (let k = 0; k < nS; k++) {
    // the tallest stem first, the rest from a little over half its height up: a clone is stems of every age at once
    const H = Hmax * (k === 0 ? 1 : 0.52 + 0.44 * rnd());
    const ang = a0 + k * 2.399 + (rnd() - 0.5) * 0.7;              // the golden turn, so stems do not stack up
    const off = k === 0 ? rnd() * 0.12 : 0.28 + 0.85 * rnd();      // how far from the root's middle it breaks ground
    const bx = Math.cos(ang) * off, bz = Math.sin(ang) * off;
    // it leans AWAY from the group, as stems in a close clump do, each reaching past its neighbours for the light;
    // the lean is small on purpose - a metre or so of a fourteen-metre stem - because these must read as verticals
    const away = (0.045 + 0.045 * rnd()) * H * (sl ? 0.55 : 1);
    const ph = rnd() * 6.283, wob = (0.10 + 0.16 * rnd()) * (sl ? 0.55 : 1);
    const r0 = (0.085 + 0.055 * (H / Hmax)) * (0.9 + 0.2 * rnd());
    // the stem's centre line: t 0 at the ground, 1 at the tip. The lean grows with the square of the height and one
    // slow bend crosses it, so no two stems are alike and none of them is a ruled line.
    const axis = (t) => V(
      bx + Math.cos(ang) * away * t * t + Math.sin(ang) * wob * Math.sin(t * 2.6 + ph) * t,
      t * H,
      bz + Math.sin(ang) * away * t * t - Math.cos(ang) * wob * Math.sin(t * 2.6 + ph) * t);
    const rAt = (t) => r0 * (1 - 0.62 * Math.pow(t, 0.9));
    // (a foot, as the oil look's other trees have: the stem spreads over its lowest quarter metre and goes on under
    // the floor, so it is not a post set on a plane. One extra ring of its own tube, kept at both levels of detail,
    // which is also what puts a vertex below y = 0 whichever level is drawn.)
    const pts = [V(bx, -0.24, bz)], rad = [r0 * 1.75];
    for (let i = 0; i <= segs; i++) { const t = i / segs; pts.push(axis(t)); rad.push(rAt(t) * (i === 0 ? 1.25 : 1)); }
    // `swayH: H` is this stem's OWN height (see the head of the file): tube() also reads it as the mark of a trunk and
    // gives the whole tube branch -1, which is what tells PHYSICS' crown that nothing here moves at the root.
    tube(B, pts, rad, sides, { part: 0, swayK: 0.55, swayH: H, hash: rnd() });
    const top = axis(1);
    tubes.push({ stem: k, depth: 0, from: [bx, -0.24, bz], tip: [top.x, top.y, top.z], r: r0, len: H + 0.24, rings: pts.length, sides });
    stems.push({ H, base: [bx, 0, bz], top: [top.x, top.y, top.z], r0, lean: Math.hypot(top.x - bx, top.z - bz) });
    // the crown centre this stem's leaves take their light from - its own, never the group's
    const crownC = V(top.x * 0.9, H * 0.84, top.z * 0.9);

    // One limb, and whatever it forks into. `ang` is the way it sets off round the stem, `el` how steeply it climbs,
    // `len` its length, `r` its girth where it leaves, `bid` the branch number it and its leaves share.
    const grow = (p0, a1, el, len, r, depth, bid) => {
      const dx = Math.cos(a1) * Math.cos(el), dy = Math.sin(el), dz = Math.sin(a1) * Math.cos(el);
      const tip = V(p0.x + dx * len, p0.y + dy * len, p0.z + dz * len);
      // a limb arches: it leaves the stem climbing and flattens toward its end under its own weight, the more so the
      // nearer level it set off
      const bow = len * (0.05 + 0.14 * Math.max(0, 1 - Math.max(0, el) * 1.5));
      const mid = V((p0.x + tip.x) / 2, (p0.y + tip.y) / 2 + bow, (p0.z + tip.z) / 2);
      const sd = near ? (depth === 1 ? 4 : 3) : 3;
      // a main limb near by bows through three rings; a fork, and anything far off, is a straight piece of two
      const path = near && depth === 1 ? [p0, mid, tip] : [p0, tip];
      const rr = path.length === 3 ? [r, r * 0.72, r * 0.45] : [r, r * 0.45];
      // (deeper in the crown a limb is laid darker and swings more, as the branches of the other kits are; its sway
      // is how far up ITS OWN stem it left, so a short stem's limbs are not stiffened by a tall neighbour)
      tube(B, path, rr, sd, { part: 0, shade: 0.45 + 0.2 * depth, sway0: 0.2 + 0.5 * (p0.y / H), hash: rnd(), branch: bid });
      tubes.push({ stem: k, depth, from: [p0.x, p0.y, p0.z], tip: [tip.x, tip.y, tip.z], r, len, rings: path.length, sides: sd });
      // the upper limbs fork in two, so the crown's ends are at two depths and its outline is ragged rather than
      // even; the short low ones do not fork, and nothing forks far away, where the fork would be a pixel wide
      if (near && depth === 1 && p0.y > H * 0.60) {
        for (let i = 0; i < 2; i++) {
          // the two halves part widely and both turn upward: a narrow fork reads as one longer branch
          const a2 = a1 + (i ? 1 : -1) * (0.5 + 0.5 * rnd());
          const e2 = Math.max(0.10, Math.min(1.35, el + 0.25 + (rnd() - 0.5) * 0.4));
          grow(tip, a2, e2, len * (0.42 + 0.16 * rnd()), r * 0.55, depth + 1, bid);
        }
        return;
      }
      // the end of a limb: a small loose puff of leaves, set a little beyond the tip. Small on purpose - an aspen's
      // crown is a haze of separate sprays, not one dome - and held clear of the floor. Its size is set against the
      // number of leaves it will be given (about fifteen; see the end of the file): a puff about a metre across, whose
      // outline those fifteen quarter-metre cards roughly cover, so a spray reads as foliage while the crown of
      // sprays stays open. Built half again wider at first, the same fifteen cards covered about a third of it, which
      // is a scatter and not foliage - worked out from the areas on paper, since nobody here can look at it.
      const rc = H * (near ? 0.036 : 0.055) * (0.8 + 0.4 * rnd());
      clumps.push({ c: V(tip.x + dx * rc * 0.4, Math.max(tip.y + rc * 0.15, rc + 0.6), tip.z + dz * rc * 0.4), r: rc, bid, H, mc: crownC });
    };

    // The limbs: a few short ones low down and more near the top, which is how an aspen carries its crown - the low
    // ones are what is left of the stem's younger years and the top ones are this year's growth. The count is shared
    // out over however many stems the seed grew, and a taller stem gets more of them than a half-grown one.
    const nL = near ? Math.max(2, Math.round((15 / nS) * (0.55 + 0.45 * (H / Hmax))) + ((rnd() * 2) | 0)) : 2;
    for (let j = 0; j < nL; j++) {
      const up = nL > 1 ? j / (nL - 1) : 1;
      // crowded toward the top: with `up` spread evenly, up^0.6 leaves wide gaps low down and close ones high up
      const t0 = 0.44 + 0.54 * Math.pow(up, 0.6);
      const p0 = axis(t0);
      // low limbs leave nearly level or dipping a little, the top ones climb steeply beside the stem
      const el = -0.06 + 1.05 * Math.pow(up, 1.1) + (rnd() - 0.5) * 0.25;
      // short, as an aspen's limbs are: a thirteenth of the stem's height at the top, and the lowest nearly twice
      // that - which is why the crown stays narrow and the stem goes on being the thing you see
      const len = H * (0.075 + 0.055 * (1 - up)) * (0.8 + 0.4 * rnd()) * (sl ? 0.85 : 1);
      grow(p0, a0 + k * 1.7 + j * 2.399 + (rnd() - 0.5) * 0.8, el, len, rAt(t0) * 0.5, 1, ((k * 7 + j) * 0.618034 + 0.13) % 1);
    }
    // its own small high crown: the tip carries the fullest puff of the stem, on a branch number of its own, so it
    // trembles with the top of the stem and not with any one limb
    const rt = H * (near ? 0.050 : 0.075) * (sl ? 0.85 : 1);
    clumps.push({ c: V(top.x, H + rt * 0.25, top.z), r: rt, bid: ((k * 7 + 97) * 0.618034 + 0.13) % 1, H, mc: crownC });
  }

  // The leaves. Many fine cards rather than a few big ones: near by the six-cornered card (four triangles, so a leaf
  // close to the eye is a leaf and not a kite); far off fewer and twice the size, plain lozenges of two triangles, as
  // the other kits thin their crowns by distance. They are nearly as wide as they are long, which is the shape of an
  // aspen's leaf and is what makes the crown flicker rather than streak. Each puff's share is by the square of its size.
  let wsum = 0;
  for (const q of clumps) wsum += q.r * q.r;
  for (const q of clumps) {
    const n = Math.max(near ? 10 : 6, Math.round(totalCards * q.r * q.r / wsum));
    leafCards(B, q.c, q.r * 1.20, q.r * 0.95, q.r * 1.20, rnd, {
      n, len: near ? 0.26 : 0.56, wid: near ? 0.20 : 0.42, round: near ? 1 : 0, branch: q.bid,
      // the sway and the crown centre are this leaf's OWN stem's (see the head of the file)
      massC: q.mc, massK: 0.5, sway: 0.50 + 0.50 * (q.c.y / q.H), shade0: 0.02, shadeK: 0.45, droop: 0.25,
    });
  }

  const g = B.build();
  // The shape as numbers. Nobody can look at this stand, so it writes down every tube it laid - which stem it belongs
  // to, how deep in the forking it is, where it starts and ends, and how many rings and sides it was given - and
  // every stem's height and lean. aspen.test.mjs reads these and checks the record against the mesh's own triangles,
  // so the written account cannot drift away from the thing itself.
  g.userData.tubes = tubes;
  g.userData.stems = stems;
  return g;
}
