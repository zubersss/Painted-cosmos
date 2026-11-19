// Painted Cosmos: the six trees the owner chose from the sheet of ten. OWNER: PAINTER.
//
// Built 2026-11-19. The owner was shown ten tree SHAPES drawn flat (tools/treevariants.mjs, the sheet in
// docs/shots/trees/ten_looks.png on r2) and answered: "Yes do 12374 and the widow 6 but refine them a little better
// and make sure the leaves change colors from summer to autumn for the forest". The six are 1 round maple, 2 tall
// poplar, 3 great oak, 4 slender birch, 6 weeping willow, 7 young sapling.
//
// ONE GRAMMAR, SIX SETTINGS. Every kit below is the same `grow` with a different row of numbers, so a fault mended
// once is mended in all six and a seventh tree costs a row of numbers rather than a file. What the grammar is built
// to is what the owner's twenty references were MEASURED to say (docs/references/README.md, "The branches,
// measured"), and five of its rules exist because a drawing showed the opposite:
//
//   1. A LIMB ENDS WHERE IT DIVIDES. Drawing a limb to its full length and then hanging its children partway along
//      left the last third of every limb projecting past the fork with nothing on it. That is the bare grey SPIDER
//      LEG the owner objected to ("it looks like spiders not trees"), and it was the whole of the fault.
//   2. EVERY LIMB IS SAMPLED OFF A CURVE. kitbuild's `tube` joins its points with STRAIGHT sections, so a limb given
//      three points is two bars with a knee in it. Four to six points off a quadratic give a bough that bends.
//   3. LEAVES HANG ALONG THE FINER LIMBS, in small clusters with sky between them, and a few INSIDE the crown as
//      well. Hung only at the limb ends they are lollipops; hung only on the outermost limbs the crown is a hollow
//      shell with bare wood behind a skin of leaves.
//   4. A LIMB MAY STOP DIVIDING A LEVEL EARLY, so the limbs do not all end at one height. Without that the crown is
//      flat-topped whatever else is done to it.
//   5. A TREE MAY HAVE A LEADER: one stem running the whole height with side limbs all the way up it, shortening
//      toward the top. Without it there is no poplar -- limbs that all leave at one fork can only make a vase or a
//      dome, however steeply they rise.
//
// AND ONE RULE THAT CAME FROM MEASURING RATHER THAN LOOKING: the willow's wood reached 3.86 m BELOW THE GROUND
// (seed 3), because the clamp that gives its curtain a hem counted the twig's angle but not the sag added on top of
// it. Nothing here but the trunk's own 0.25 m stub goes under the ground now, and grove.test.mjs holds that.
//
// WHAT IS NOT CLAIMED: the shapes have been seen, flat-filled and in one colour, in Node. Nothing here has been seen
// in the game's own paint, light or motion.
import { Builder, tube, leafCards, V } from '../kitbuild.js';
import { mulberry32 } from '../noise.js';

// The settings a tree is made of. height m; girth of height; lean; forkAt where the boughs leave (of height);
// boughs how many; rise how steeply one leaves; droopB how much lower the first is than the last; spread the angle
// between a limb's children; arch how hard a limb bends over (negative sags); levels how many times it divides;
// split how far along a limb its children leave; taper what a limb keeps of its width at its tip; triple the chance
// of a three-way first fork; stopEarly the chance a limb stops dividing early; lift/liftTo/drop how a child's
// elevation changes; twigs the hairs at a final tip; twigLen/twigMax their length; twigDrop how they hang; hem how
// far above the ground a hanging twig stops; leader one stem the whole height; inner the weight of leaves inside
// the crown; leafN how many leaves in all; leafR a cluster's size of the height; leafLen a leaf; leafDroop.
const BASE = {
  height: 11, girth: 0.034, lean: 0.6, forkAt: 0.42, boughs: 4, rise: 0.55, droopB: 0.5, lift: 0.12,
  spread: 0.8, arch: 0.16, levels: 3, split: 0.62, taper: 0.22, triple: 0.3, twigs: 4, twigLen: 0.3,
  drop: -0.10, liftTo: 0.3, twigDrop: 0, stopEarly: 0.3, leader: 0, inner: 0.45, hem: 1.4, twigMax: 0.16,
  boughLen: 0.34, leafN: 900, leafR: 0.055, leafLen: 0.5, leafDroop: 0.3,
};

export const GROVE = {
  // (the owner's numbers from the sheet are kept in the names, so a choice can be traced to the picture they saw)
  roundmaple: Object.assign({}, BASE, { height: 10, forkAt: 0.32, boughs: 5, rise: 0.70, droopB: 0.35, spread: 0.88, arch: 0.24, boughLen: 0.34, levels: 4, stopEarly: 0.40, inner: 0.60, leafN: 1700, leafR: 0.042 }),
  poplar: Object.assign({}, BASE, { height: 15, girth: 0.024, leader: 1, forkAt: 0.12, boughs: 22, rise: 1.05, droopB: 0.10, spread: 0.34, arch: 0.08, boughLen: 0.21, levels: 2, twigs: 3, leafN: 1500, leafR: 0.030 }),
  oak: Object.assign({}, BASE, { height: 11, girth: 0.050, forkAt: 0.24, boughs: 5, rise: 0.56, droopB: 0.58, spread: 0.95, arch: 0.32, boughLen: 0.46, levels: 4, triple: 0.5, inner: 0.60, leafN: 2000, leafR: 0.044 }),
  birch: Object.assign({}, BASE, { height: 13, girth: 0.017, lean: 1.3, forkAt: 0.38, boughs: 9, rise: 0.80, droopB: 0.40, spread: 0.60, arch: 0.16, boughLen: 0.26, levels: 4, twigs: 6, twigDrop: -0.45, inner: 0.6, leafN: 1800, leafR: 0.028, leafLen: 0.40 }),
  willow: Object.assign({}, BASE, { height: 13, girth: 0.030, forkAt: 0.50, boughs: 6, rise: 0.95, droopB: 0.05, lift: 0.0, liftTo: -9, drop: -0.40, spread: 0.52, arch: -0.12, boughLen: 0.30, levels: 4, split: 0.70, taper: 0.30, twigs: 7, twigLen: 1.6, twigMax: 0.46, twigDrop: -1.3, stopEarly: 0.15, hem: 1.8, inner: 0.3, leafN: 2000, leafR: 0.028, leafLen: 0.34, leafDroop: 0.8 }),
  sapling: Object.assign({}, BASE, { height: 5, girth: 0.030, lean: 1.2, forkAt: 0.38, boughs: 3, rise: 0.80, droopB: 0.25, spread: 0.85, arch: 0.18, boughLen: 0.40, levels: 3, stopEarly: 0.5, leafN: 520 }),
};

// lod 0 full (near); lod 1 medium -- one level fewer, no haze of hairs, a third of the leaves in larger four-cornered
// cards, and fewer sides to every tube. (spec.slender, as the other kits take it: the deep wood's form, forking
// higher with a narrower crown, so a wood seen from inside is its trunks against the air.)
export function grow(P0, seed, lod, spec) {
  const rnd = mulberry32(seed), B = new Builder();
  const near = lod === 0;
  const sl = !!(spec && spec.slender);
  const P = sl ? Object.assign({}, P0, { forkAt: Math.min(0.8, P0.forkAt * 1.35), boughLen: P0.boughLen * 0.84, spread: P0.spread * 0.82 }) : P0;
  const LV = near ? P.levels : Math.max(2, P.levels - 1);
  const H = P.height * (0.88 + 0.24 * rnd());
  const r0 = H * P.girth * (0.9 + 0.2 * rnd());
  const lean = (rnd() - 0.5) * P.lean, lz = (rnd() - 0.5) * P.lean * 0.7, ph = rnd() * 3;
  const fy = H * P.forkAt * (0.92 + 0.16 * rnd());

  // the stem. With a leader it runs the whole height and tapers nearly to nothing; without one it rises to the fork
  // and a little above it.
  const top = P.leader ? H : fy * 1.08;
  const nS = P.leader ? (near ? 9 : 6) : 6, pts = [], rad = [];
  const axis = (t) => V(lean * t * t + 0.10 * Math.sin(t * 2.7 + ph) * t * H * 0.1, top * t, lz * t * t);
  pts.push(V(axis(0).x, -0.25, axis(0).z)); rad.push(r0 * 1.7);
  for (let i = 0; i <= nS; i++) { const t = i / nS; pts.push(axis(t));
    rad.push(r0 * (P.leader ? Math.max(0.03, 1 - 0.97 * Math.pow(t, 1.15)) : 1 - 0.42 * Math.pow(t, 0.8))); }
  tube(B, pts, rad, near ? 6 : 5, { part: 0, shade: 0.2, swayK: 0.22, swayH: H, hash: rnd() });
  const rTop = r0 * 0.58;
  // nothing hangs through the ground
  const groundUp = (q) => { if (q.y < 0.35) q.y = 0.35 / (1 + (0.35 - q.y) * 2.2); return q; };
  const stations = [];                      // where the leaves will hang, along the finer limbs
  const crownC = V(0, H * 0.72, 0);

  function limb(p0, ang, el, len, r, depth, bid) {
    const dx = Math.cos(ang) * Math.cos(el), dy = Math.sin(el), dz = Math.sin(ang) * Math.cos(el);
    const tip = V(p0.x + dx * len, p0.y + dy * len, p0.z + dz * len);
    const bow = len * P.arch * (0.5 + 0.9 * Math.max(0, 1 - Math.max(0, el) * 1.4));
    const mid = V((p0.x + tip.x) / 2, (p0.y + tip.y) / 2 + bow, (p0.z + tip.z) / 2);
    const c = V(mid.x * 2 - (p0.x + tip.x) * 0.5, mid.y * 2 - (p0.y + tip.y) * 0.5, mid.z * 2 - (p0.z + tip.z) * 0.5);
    const at = (t) => { const u = 1 - t; return V(u * u * p0.x + 2 * u * t * c.x + t * t * tip.x, u * u * p0.y + 2 * u * t * c.y + t * t * tip.y, u * u * p0.z + 2 * u * t * c.z + t * t * tip.z); };
    const divides = depth < LV && (depth < 2 || rnd() > P.stopEarly);
    const tEnd = divides ? P.split * 1.06 : 1;      // a limb ends at its fork, a whisker past it
    const nP = depth === 1 ? (near ? 6 : 4) : P.arch < 0 ? 5 : 4;
    const pth = [], rr = [];
    for (let i = 0; i < nP; i++) { const t = i / (nP - 1) * tEnd; pth.push(at(t)); rr.push(r * (1 - (1 - P.taper) * Math.pow(t, 1.3))); }
    const sd = near ? (depth === 1 ? 5 : depth === 2 ? 4 : 3) : (depth === 1 ? 4 : 3);
    tube(B, pth, rr, sd, { part: 0, shade: 0.16 + 0.12 * depth, sway0: 0.12 + 0.2 * depth, hash: rnd(), branch: bid });

    if (!divides) {
      for (let i = 0; i < 5; i++) stations.push({ p: at(Math.min(1, 0.18 + 0.82 * (i + 0.2 + rnd() * 0.6) / 5)), len: len / 5, w: 1, bid });
      if (near) for (let i = 0; i < P.twigs; i++) {       // the haze of fine hairs: the fine end of the range
        const a2 = ang + (rnd() - 0.5) * 2.4;
        const e2 = P.twigDrop < -0.8 ? -1.06 - 0.44 * rnd()
          : Math.max(-1.4, Math.min(1.5, el + P.twigDrop + (rnd() - 0.45) * 1.1));
        let lh = len * P.twigLen * (0.45 + 1.15 * rnd());
        const rh = r * P.taper * 0.85;
        const hx = Math.cos(a2) * Math.cos(e2), hy = Math.sin(e2), hz = Math.sin(a2) * Math.cos(e2);
        const sagK = P.twigDrop < -0.8 ? P.twigDrop * 0.35 : 0.12;      // a weeper's hair sags under its own weight
        const fall = Math.max(0.05, -hy + (sagK < 0 ? -sagK * 2.6 : 0));  // how far down a metre of twig goes
        lh = Math.min(lh, H * P.twigMax);
        if (hy < -0.3) lh = Math.min(lh, Math.max(0.2, (tip.y - P.hem) / fall));   // the curtain's hem
        const q1 = V(tip.x + hx * lh * 0.5, tip.y + hy * lh * 0.5 + lh * sagK, tip.z + hz * lh * 0.5);
        const q2 = V(tip.x + hx * lh, tip.y + hy * lh + lh * sagK * 2.6, tip.z + hz * lh);
        tube(B, [tip, q1, q2], [rh, rh * 0.5, rh * 0.16], 3, { part: 0, shade: 0.68, sway0: 0.9, hash: rnd(), branch: bid });
        const ns = lh > len * 0.7 ? 3 : 2;                 // a long hanging twig is leafy the whole way down
        for (let j = 1; j <= ns; j++) { const u = j / ns;
          stations.push({ p: V(tip.x + hx * lh * u, tip.y + hy * lh * u + lh * sagK * u * u * 2.6, tip.z + hz * lh * u), len: lh / ns, w: 0.8, bid }); }
      }
      stations.push({ p: tip, len, w: 1, bid });
      return;
    }
    if (depth >= 2) for (let i = 0; i < 2; i++) stations.push({ p: at(0.45 + 0.5 * rnd()), len: len / 5, w: P.inner, bid });
    const nC = depth === 1 ? 2 + (rnd() < P.triple ? 1 : 0) : 2;
    for (let i = 0; i < nC; i++) {
      const a2 = ang + (i - (nC - 1) * 0.5) * (P.spread * (0.7 + 0.6 * rnd()));
      const e2 = Math.max(-1.3, Math.min(1.45, el + (el < P.liftTo ? P.lift : P.drop) + (rnd() - 0.5) * 0.3));
      limb(at(P.split), a2, e2, len * (0.40 + 0.40 * rnd()), r * 0.58, depth + 1, bid);
    }
  }

  for (let k = 0; k < P.boughs; k++) {
    const up = P.boughs > 1 ? k / (P.boughs - 1) : 0.5;
    // with a leader the limbs are spread up the whole stem and shorten toward the top; without one they all leave
    // within a short length above the fork
    const t0 = P.leader ? (P.forkAt + (0.95 - P.forkAt) * up) : (0.72 + 0.28 * up);
    const shrink = P.leader ? (1 - 0.72 * up) : 1;
    const ang = k * 2.399 + (rnd() - 0.5) * 0.8;
    const el = P.rise - P.droopB * (1 - up) + (rnd() - 0.5) * 0.22;
    limb(axis(t0), ang, el, H * P.boughLen * shrink * (0.88 + 0.24 * rnd()), rTop * (0.82 - 0.14 * up) * (P.leader ? 0.5 + 0.5 * shrink : 1), 1, (k * 0.37) % 1);
  }

  // The leaves. A tree's count is shared out over however many places a seed happens to grow to hang them, so one
  // tree of a kind costs about what the next one does. Each cluster keeps its limb's branch number, so a limb the
  // wind knife takes carries its own leaves away with it.
  //
  // THE PLACES ARE THINNED FIRST. A cluster has a floor of a few leaves or it is not a cluster at all, so on a tree
  // with very many places -- the willow grows four down every one of its hanging twigs -- that floor, not leafN,
  // decided the count, and cutting leafN by a fifth changed nothing (measured, 2026-11-19: 22016 triangles before
  // and after). Dropping places until the budget can afford them is what makes leafN mean something again.
  const want = near ? P.leafN : Math.round(P.leafN * 0.32);
  const floor = near ? 3 : 2;
  const room = Math.max(8, Math.floor(want / floor));
  if (stations.length > room) {
    const keep = [], step = stations.length / room;
    for (let i = 0; i < room; i++) keep.push(stations[Math.floor(i * step)]);   // spread through, not the first few
    stations.length = 0; for (const st of keep) stations.push(st);
  }
  let wsum = 0; for (const st of stations) wsum += st.w;
  for (const st of stations) {
    const n = Math.max(floor, Math.round(want * st.w / Math.max(1e-6, wsum)));
    const r = Math.min(P.leafR * H, st.len * 1.1) * (0.7 + 0.6 * rnd()) * (near ? 1 : 1.5);
    groundUp(st.p);
    leafCards(B, st.p, r, r * 0.74, r, rnd, {
      n, len: near ? P.leafLen : P.leafLen * 1.8, wid: (near ? P.leafLen : P.leafLen * 1.8) * 0.46,
      round: near ? 1 : 0, branch: st.bid, massC: crownC, massK: 0.55,
      sway: 0.55 + 0.45 * Math.max(0, Math.min(1, st.p.y / H)), shade0: 0.05, shadeK: 0.6, droop: P.leafDroop,
    });
  }
  return B.build();
}

// the six, as the kit registry takes them
export function groveGeometry(kind) {
  const P = GROVE[kind];
  if (!P) throw new Error('no grove tree called ' + kind);
  return (seed, lod, spec) => grow(P, seed, lod, spec);
}
