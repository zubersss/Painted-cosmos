// TEN LOOKS OF A TREE, for the owner to pick five from (their words, 2026-11-19: "show me 10 different
// looks of the trees and ill pick 5 to plant in the world").
//
//   node tools/treevariants.mjs [out=/tmp/trees.png] [seeds=3,9] [turn=0,70] [w=300] [h=620] [leaves=1]
//   node tools/treevariants.mjs measure=1          the width hierarchy of each, against the references
//
// It is ONE PARAMETRIC TREE with ten settings, not ten hand-written trees, so that whichever five are
// chosen can be promoted into src/world/kits/ as real kits sharing one mended grammar. The grammar is
// built to what the owner's twenty references were MEASURED to say (docs/references/README.md, "The
// branches, measured"):
//   - a HIERARCHY OF WIDTHS spanning about SEVENTEEN from the typical twig to the trunk. The game's
//     trees spanned four to six, and half the wood in the references was finer than anything the game
//     drew at all. So every tree here ends in a real NETWORK of fine twigs, which is where that fine
//     end comes from; trunks are NOT fattened to reach the ratio, which would only make it heavier.
//   - the fork HIGH on most kinds: the trunk rises clear before the boughs leave.
//   - boughs that ARCH up and outward and go on dividing, never a straight bar with a knee (`tube`
//     joins its points with straight sections, so every limb here is sampled off a curve).
//   - LEAVES ALONG THE TWIGS in loose clusters with sky between them, not a pom-pom on a stick.
import fs from 'node:fs';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const three = pathToFileURL(path.resolve(REPO, 'vendor/three/three.module.js')).href;
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(s, c, n) { if (s === 'three') return { url: '${three}', shortCircuit: true }; return n(s, c); }`), import.meta.url);
globalThis.location = { search: '?look=oil' };
const { Builder, tube, leafCards, V } = await import(pathToFileURL(path.resolve(REPO, 'src/world/kitbuild.js')).href);
const { mulberry32 } = await import(pathToFileURL(path.resolve(REPO, 'src/world/noise.js')).href);
const { writePng } = await import(pathToFileURL(path.resolve(REPO, 'tests/stationlib/png.mjs')).href);

// ---- the grammar -------------------------------------------------------------------------------
// P: height, girth (of height), lean, forkAt (of height), boughs, rise (how steeply a bough leaves),
// spread (how far it swings out), arch (how hard it bends over), levels (how many times it divides),
// split (how far along a limb its children leave), taper (what a limb keeps of its width at its tip),
// twigs (hairs at every final tip), twigLen, leafAt (where along the final limbs leaves hang),
// leafN (cards a cluster), leafR (a cluster's size), leafLen, droop.
export function growTree(P, seed) {
  const rnd = mulberry32(seed), B = new Builder();
  const H = P.height * (0.88 + 0.24 * rnd());
  const r0 = H * P.girth * (0.9 + 0.2 * rnd());
  const lean = (rnd() - 0.5) * P.lean, lz = (rnd() - 0.5) * P.lean * 0.7, ph = rnd() * 3;
  const fy = H * P.forkAt * (0.92 + 0.16 * rnd());
  // the stem: it rises clear to the fork and carries on a little above it
  const top = P.leader ? H : fy * 1.08;
  const nS = P.leader ? 9 : 6, pts = [], rad = [];
  const axis = (t) => V(lean * t * t + 0.10 * Math.sin(t * 2.7 + ph) * t * H * 0.1, top * t, lz * t * t);
  pts.push(V(axis(0).x, -0.25, axis(0).z)); rad.push(r0 * 1.7);
  for (let i = 0; i <= nS; i++) { const t = i / nS; pts.push(axis(t));
    rad.push(r0 * (P.leader ? Math.max(0.03, 1 - 0.97 * Math.pow(t, 1.15)) : 1 - 0.42 * Math.pow(t, 0.8))); }
  tube(B, pts, rad, 6, { part: 0, shade: 0.34, swayK: 0.3, swayH: H, hash: rnd() });
  const rTop = r0 * 0.58;
  const groundUp = (q) => { if (q.y < 0.35) q.y = 0.35 / (1 + (0.35 - q.y) * 2.2); return q; };   // nothing hangs through the ground
  const stations = [];                       // where leaves will hang: points along the finer limbs
  let widest = 0, finest = 1e9;

  // one limb, sampled off a curve, and the limbs it divides into
  function limb(p0, ang, el, len, r, depth) {
    const dx = Math.cos(ang) * Math.cos(el), dy = Math.sin(el), dz = Math.sin(ang) * Math.cos(el);
    const tip = V(p0.x + dx * len, p0.y + dy * len, p0.z + dz * len);
    const bow = len * P.arch * (0.5 + 0.9 * Math.max(0, 1 - Math.max(0, el) * 1.4));
    const mid = V((p0.x + tip.x) / 2, (p0.y + tip.y) / 2 + bow, (p0.z + tip.z) / 2);
    const c = V(mid.x * 2 - (p0.x + tip.x) * 0.5, mid.y * 2 - (p0.y + tip.y) * 0.5, mid.z * 2 - (p0.z + tip.z) * 0.5);
    const at = (t) => { const u = 1 - t; return V(u*u*p0.x + 2*u*t*c.x + t*t*tip.x, u*u*p0.y + 2*u*t*c.y + t*t*tip.y, u*u*p0.z + 2*u*t*c.z + t*t*tip.z); };
    const divides = depth < P.levels && (depth < 2 || rnd() > P.stopEarly);
    const tEnd = divides ? P.split * 1.06 : 1;       // a whisker past the fork, as a real one is
    const nP = depth === 1 ? 6 : P.arch < 0 ? 5 : 4, pth = [], rr = [];
    for (let i = 0; i < nP; i++) { const t = i / (nP - 1) * tEnd; pth.push(at(t)); rr.push(r * (1 - (1 - P.taper) * Math.pow(t, 1.3))); }
    tube(B, pth, rr, depth === 1 ? 5 : depth === 2 ? 4 : 3, { part: 0, shade: 0.16 + 0.12 * depth, sway0: 0.12 + 0.2 * depth, hash: rnd(), branch: (depth * 0.37 + ang) % 1 });
    widest = Math.max(widest, r); finest = Math.min(finest, r * P.taper);
    if (!divides) {                        // leaves ALONG the last limbs, several to a limb
      for (let i = 0; i < 5; i++) stations.push({ p: at(Math.min(1, 0.18 + 0.82 * (i + 0.2 + rnd() * 0.6) / 5)), r, len: len / 5, w: 1 });
    } else if (depth >= 2) {               // and a few INSIDE the crown, so it is a mass and not a skin
      for (let i = 0; i < 2; i++) stations.push({ p: at(0.45 + 0.5 * rnd()), r, len: len / 5, w: P.inner });
    }
    if (!divides) {
      // the end: a spray of fine hairs, which is where the references' fine end of the range lives
      for (let i = 0; i < P.twigs; i++) {
        const a2 = ang + (rnd() - 0.5) * 2.4;
        const e2 = P.twigDrop < -0.8 ? -1.06 - 0.44 * rnd()
          : Math.max(-1.4, Math.min(1.5, el + P.twigDrop + (rnd() - 0.45) * 1.1));
        let lh = len * P.twigLen * (0.45 + 1.15 * rnd());
        const rh = r * P.taper * 0.85;
        const hx = Math.cos(a2) * Math.cos(e2), hy = Math.sin(e2), hz = Math.sin(a2) * Math.cos(e2);
        const sagK = P.twigDrop < -0.8 ? P.twigDrop * 0.35 : 0.12;   // a weeper's hair sags under itself
        const fall = Math.max(0.05, -hy + (sagK < 0 ? -sagK * 2.6 : 0));   // how far down a metre of twig goes
        lh = Math.min(lh, H * P.twigMax);                                          // never a limb's length again
        if (hy < -0.3) lh = Math.min(lh, Math.max(0.2, (tip.y - P.hem) / fall));   // the curtain's hem
        const q1 = V(tip.x + hx * lh * 0.5, tip.y + hy * lh * 0.5 + lh * sagK, tip.z + hz * lh * 0.5);
        const q2 = V(tip.x + hx * lh, tip.y + hy * lh + lh * sagK * 2.6, tip.z + hz * lh);
        tube(B, [tip, q1, q2], [rh, rh * 0.5, rh * 0.16], 3, { part: 0, shade: 0.68, sway0: 0.9, hash: rnd(), branch: (ang + i) % 1 });
        finest = Math.min(finest, rh * 0.16);
        const ns = lh > len * 0.7 ? 4 : 2;      // a long hanging twig is leafy the whole way down
        for (let j = 1; j <= ns; j++) { const u = j / ns;
          stations.push({ p: V(tip.x + hx * lh * u, tip.y + hy * lh * u + lh * sagK * u * u * 2.6, tip.z + hz * lh * u), r: rh, len: lh / ns, w: 0.8 }); }
      }
      stations.push({ p: tip, r, len, w: 1 });
      return;
    }
    const nC = depth === 1 ? 2 + (rnd() < P.triple ? 1 : 0) : 2;   // (reached only when it divides)
    for (let i = 0; i < nC; i++) {
      const a2 = ang + (i - (nC - 1) * 0.5) * (P.spread * (0.7 + 0.6 * rnd()));
      const e2 = Math.max(-1.3, Math.min(1.45, el + (el < P.liftTo ? P.lift : P.drop) + (rnd() - 0.5) * 0.3));
      limb(at(P.split), a2, e2, len * (0.40 + 0.40 * rnd()), r * 0.58, depth + 1);
    }
  }
  for (let k = 0; k < P.boughs; k++) {
    const up = P.boughs > 1 ? k / (P.boughs - 1) : 0.5;
    // with a leader the limbs are spread up the whole stem and shorten toward the top; without one
    // they all leave within a short length above the fork.
    const t0 = P.leader ? (P.forkAt + (0.95 - P.forkAt) * up) : (0.72 + 0.28 * up);
    const shrink = P.leader ? (1 - 0.72 * up) : 1;
    const ang = k * 2.399 + (rnd() - 0.5) * 0.8;
    const el = P.rise - P.droopB * (1 - up) + (rnd() - 0.5) * 0.22;
    limb(axis(t0), ang, el, H * P.boughLen * shrink * (0.88 + 0.24 * rnd()), rTop * (0.82 - 0.14 * up) * (P.leader ? 0.5 + 0.5 * shrink : 1), 1);
  }
  // THE LEAVES HANG ALONG THE TWIGS, in small clusters with sky between, as the references do -- not
  // one ball on the end of each stick, which is what the game had and what reads as a lollipop.
  let wsum = 0; for (const st of stations) wsum += st.w;
  const want = P.leafN;
  const crownC = V(0, H * 0.72, 0);
  for (const st of stations) {
    const n = Math.max(3, Math.round(want * st.w / Math.max(1e-6, wsum)));
    const r = Math.min(P.leafR * H, st.len * 1.1) * (0.7 + 0.6 * rnd());
    groundUp(st.p);
    leafCards(B, st.p, r, r * 0.74, r, rnd, { n, len: P.leafLen, wid: P.leafLen * 0.46, round: 1, massC: crownC, massK: 0.55, sway: 0.7, shade0: 0.05, shadeK: 0.6, droop: P.leafDroop });
  }
  const g = B.build();
  g.userData.stat = { H, r0, widest, finest, stations: stations.length };
  return g;
}

// ---- the ten -----------------------------------------------------------------------------------
const BASE = { height: 11, girth: 0.034, lean: 0.6, forkAt: 0.42, boughs: 4, rise: 0.55, droopB: 0.5, lift: 0.12,
  spread: 0.8, arch: 0.16, levels: 3, split: 0.62, taper: 0.22, triple: 0.3, twigs: 4, twigLen: 0.3,
  drop: -0.10, liftTo: 0.3, twigDrop: 0, stopEarly: 0.3, leader: 0, inner: 0.45, hem: 1.4, twigMax: 0.16,
  boughLen: 0.34, leafN: 900, leafR: 0.055, leafLen: 0.5, leafDroop: 0.3 };
export const LOOKS = [
  ['1 round maple',                         { height: 10, forkAt: 0.32, boughs: 5, rise: 0.70, droopB: 0.35, spread: 0.88, arch: 0.24, boughLen: 0.34, levels: 4, stopEarly: 0.40, inner: 0.60, leafN: 1700, leafR: 0.042 }],
  ['2 tall poplar',                         { height: 15, girth: 0.024, leader: 1, forkAt: 0.12, boughs: 22, rise: 1.05, droopB: 0.10, spread: 0.34, arch: 0.08, boughLen: 0.21, levels: 2, twigs: 3, leafN: 1700, leafR: 0.030 }],
  ['3 great oak',                         { height: 11, girth: 0.050, forkAt: 0.24, boughs: 5, rise: 0.56, droopB: 0.58, spread: 0.95, arch: 0.32, boughLen: 0.46, levels: 4, triple: 0.5, inner: 0.60, leafN: 2300, leafR: 0.044 }],
  ['4 slender birch',                         { height: 13, girth: 0.017, lean: 1.3, forkAt: 0.38, boughs: 9, rise: 0.80, droopB: 0.40, spread: 0.60, arch: 0.16, boughLen: 0.26, levels: 4, twigs: 7, twigDrop: -0.45, inner: 0.5, leafN: 1400, leafR: 0.028, leafLen: 0.40 }],
  ['5 flat parasol',      { height: 8, forkAt: 0.72, boughs: 6, rise: -0.02, droopB: 0.02, lift: 0.22, liftTo: -0.1, drop: -0.14, spread: 1.05, arch: 0.30, boughLen: 0.55, levels: 3, stopEarly: 0.1, leafN: 1100, leafR: 0.050 }],
  ['6 weeping willow',  { height: 13, girth: 0.030, forkAt: 0.50, boughs: 6, rise: 0.95, droopB: 0.05, lift: 0.0, liftTo: -9, drop: -0.40, spread: 0.52, arch: -0.12, boughLen: 0.30, levels: 4, split: 0.70, taper: 0.30, twigs: 8, twigLen: 1.6, twigMax: 0.46, twigDrop: -1.3, stopEarly: 0.15, hem: 1.8, inner: 0.3, leafN: 1800, leafR: 0.028, leafLen: 0.34, leafDroop: 0.8 }],
  ['7 young sapling',     { height: 5, girth: 0.030, lean: 1.2, forkAt: 0.38, boughs: 3, rise: 0.80, droopB: 0.25, spread: 0.85, arch: 0.18, boughLen: 0.40, levels: 3, stopEarly: 0.5, leafN: 420 }],
  ['8 gnarled veteran',   { height: 8, girth: 0.082, lean: 2.2, forkAt: 0.18, boughs: 4, rise: 0.30, droopB: 0.75, spread: 1.30, arch: 0.36, boughLen: 0.46, levels: 4, triple: 0.8, stopEarly: 0.45, leafN: 1000 }],
  ['9 low thicket',       { height: 6, girth: 0.022, forkAt: 0.06, boughs: 6, rise: 1.15, droopB: 0.25, spread: 0.32, arch: 0.16, boughLen: 0.52, levels: 4, twigs: 6, stopEarly: 0.35, leafN: 950, leafR: 0.038 }],
  ['10 vase elm',         { height: 13, girth: 0.034, forkAt: 0.45, boughs: 4, rise: 1.10, droopB: 0.20, drop: -0.04, spread: 0.50, arch: 0.36, boughLen: 0.30, levels: 4, leafN: 1150 }],
].map(([name, o]) => [name, Object.assign({}, BASE, o)]);

// ---- drawing ------------------------------------------------------------------------------------
// (as tools/treeshape.mjs does: the real geometry, filled flat, orthographic, no browser and no
//  graphics card. Leaves in a warm wash first, wood in grey over them, so the look can be judged
//  and not only the armature. A grey bar at each tree's foot is 1.8 m, a person's height.)
const FONT = { // 3x5, enough for the labels
  0: 0x7b6f, 1: 0x2492, 2: 0x73e7, 3: 0x73cf, 4: 0x5bc9, 5: 0x79cf, 6: 0x79ef, 7: 0x7249, 8: 0x7bef, 9: 0x7bc9,
};
function glyph(px, H, d, x0, y0, k, v) {
  const bits = FONT[d]; if (bits == null) return;
  for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++)
    if ((bits >> ((4 - r) * 3 + (2 - c))) & 1)
      for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) {
        const x = x0 + c * k + a, y = y0 + r * k + b;
        if (x >= 0 && y >= 0 && x < px.W && y < H) { const o = (y * px.W + x) * 3; px.a[o] = px.a[o+1] = px.a[o+2] = v; }
      }
}
export function drawTree(geo, px, x0, W, H, turn, opts = {}) {
  const pos = geo.attributes.position.array, idx = geo.index ? geo.index.array : null;
  const data = geo.attributes.aData ? geo.attributes.aData.array : null;
  const n = idx ? idx.length : pos.length / 3;
  const leaves = opts.leaves !== false;
  const WOOD = (p) => p < 4.5;
  const ca = Math.cos(turn), sa = Math.sin(turn);
  // THE WHOLE TREE sets the frame, leaves included -- measuring the wood alone sat the tree low in
  // the cell and cut the crown off the top of the page (seen, 19 Nov).
  let yMax = 0, xMin = 1e9, xMax = -1e9;
  for (let i = 0; i < pos.length; i += 3) {
    if (data && !leaves && !WOOD(data[(i / 3) * 4 + 1])) continue;
    if (pos[i+1] > yMax) yMax = pos[i+1];
    const q = pos[i] * ca - pos[i+2] * sa; if (q < xMin) xMin = q; if (q > xMax) xMax = q;
  }
  const sc = opts.sc || Math.min(W * 0.92 / Math.max(xMax - xMin, 1e-3), H * 0.90 / Math.max(yMax, 1e-3));
  const cx = x0 + W * 0.5 - (xMin + xMax) * 0.5 * sc, by = H - 14;
  let warm = false;
  const put = (x, y, v) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= px.W || y >= H) return; const o = (y * px.W + x) * 3;
    const r = warm ? Math.min(255, 86 + v) : v, g = warm ? Math.round(v * 0.70) : v, b = warm ? Math.round(v * 0.26) : v;
    if (warm ? px.a[o] === 255 : v < px.a[o]) { px.a[o] = r; px.a[o+1] = g; px.a[o+2] = b; } };
  const tri = (ax, ay, bx, by2, cx2, cy, v) => {
    const xa = Math.max(0, Math.floor(Math.min(ax, bx, cx2))), xb = Math.min(px.W - 1, Math.ceil(Math.max(ax, bx, cx2)));
    const ya = Math.max(0, Math.floor(Math.min(ay, by2, cy))), yb = Math.min(H - 1, Math.ceil(Math.max(ay, by2, cy)));
    const d = (by2 - cy) * (ax - cx2) + (cx2 - bx) * (ay - cy); if (Math.abs(d) < 1e-9) return;
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
      const X = x + 0.5, Y = y + 0.5;
      const l1 = ((by2 - cy) * (X - cx2) + (cx2 - bx) * (Y - cy)) / d;
      const l2 = ((cy - ay) * (X - cx2) + (ax - cx2) * (Y - cy)) / d;
      if (l1 >= -0.002 && l2 >= -0.002 && l1 + l2 <= 1.002) put(x, y, v);
    }
  };
  for (const woodPass of (leaves ? [false, true] : [true])) for (let t = 0; t < n; t += 3) {
    const i0 = idx ? idx[t] : t, i1 = idx ? idx[t+1] : t+1, i2 = idx ? idx[t+2] : t+2;
    const isWood = !data || WOOD(data[i0 * 4 + 1]);
    if (isWood !== woodPass) continue;
    const shade = data ? Math.max(0, Math.min(1, data[i0 * 4 + 2])) : 0;
    const v = isWood ? Math.round(18 + shade * 148) : Math.round(132 + shade * 86);
    const X = (i) => cx + (pos[i*3] * ca - pos[i*3+2] * sa) * sc, Y = (i) => by - pos[i*3+1] * sc;
    warm = !isWood;
    tri(X(i0), Y(i0), X(i1), Y(i1), X(i2), Y(i2), v);
  }
  warm = false;
  if (opts.scale !== false) { const hp = Math.round(1.8 * sc);   // a person, 1.8 m, for size
    for (let y = by - hp; y <= by; y++) for (let x = x0 + 5; x < x0 + 9; x++) put(x, y, 205); }
  for (let x = x0 + 2; x < x0 + W - 2; x++) put(x, by + 2, 215);
  if (opts.label != null) { let x = x0 + 14; for (const ch of String(opts.label)) { glyph(px, H, +ch, x, 10, 4, 60); x += 16; } }
  return { height: yMax, width: xMax - xMin, tris: ((idx ? idx.length : pos.length / 3) / 3) | 0 };
}

// ---- the ruler ----------------------------------------------------------------------------------
// The same statistic the references were measured with (docs/references/README.md): the horizontal
// run of wood on each scanline, in THOUSANDTHS of the picture's width, and then the 99th against the
// median -- how far the tree's widths reach from its typical twig to its trunk. Here it is measured
// on the BARE WOOD with nothing hiding the twigs, so it is not the same number as the references'
// 17.0 (measured through leaves, which hide the fine end). It is for comparing tree WITH TREE, this
// grammar against the kits the game ships, measured the same way.
export function ruler(geo, turn = 0, W = 900, H = 1200) {
  const px = { W, a: new Uint8Array(W * H * 3).fill(255) };
  drawTree(geo, px, 0, W, H, turn, { leaves: false, scale: false, label: null });
  const runs = [];
  for (let y = 0; y < H; y++) { let run = 0;
    for (let x = 0; x < W; x++) { const dark = px.a[(y * W + x) * 3] < 200;
      if (dark) run++; else { if (run) runs.push(run / W * 1000); run = 0; } }
    if (run) runs.push(run / W * 1000); }
  runs.sort((a, b) => a - b);
  const q = (f) => runs.length ? runs[Math.min(runs.length - 1, Math.floor(f * runs.length))] : 0;
  return { n: runs.length, median: q(0.5), p90: q(0.9), p99: q(0.99), spread: q(0.5) > 0 ? q(0.99) / q(0.5) : 0 };
}

// ---- the sheet ----------------------------------------------------------------------------------
if (process.argv[1] && process.argv[1].endsWith('treevariants.mjs')) {
  const A = Object.fromEntries(process.argv.slice(2).map((s) => s.split('=')));
  if (A.measure === '1') {
    const FK = await import(pathToFileURL(path.resolve(REPO, 'src/world/florakit.js')).href);
    const SPEC = { oilLook: 1, leafy: 1, double: 1 };
    console.log('the width hierarchy of the bare wood (thousandths of the picture, 3 seeds averaged)');
    console.log('                        runs  median    p90    p99   99/med   triangles');
    const row = (name, f) => {
      const r = [0, 0, 0, 0, 0], T = [];
      for (const s of [3, 9, 17]) { const g = f(s); const m = ruler(g, 0);
        r[0] += m.n / 3; r[1] += m.median / 3; r[2] += m.p90 / 3; r[3] += m.p99 / 3; r[4] += m.spread / 3;
        T.push(((g.index ? g.index.count : g.attributes.position.count) / 3) | 0); }
      console.log(name.padEnd(22) + String(Math.round(r[0])).padStart(6) + r[1].toFixed(2).padStart(8) + r[2].toFixed(2).padStart(7) + r[3].toFixed(2).padStart(7) + r[4].toFixed(1).padStart(8) + ('  ' + Math.round(T.reduce((a, b) => a + b) / 3)).padStart(12));
    };
    for (const [name, P] of LOOKS) row(name, (s) => growTree(P, s));
    console.log('-- the kits the game ships now, measured the same way --');
    for (const k of Object.keys(FK.TALL_KITS || {})) row(k, (s) => FK.TALL_KITS[k](s, 0, SPEC));
    console.log('(the references, measured through their leaves, reach 17; see docs/references/README.md)');
  } else {
    const W = +(A.w || 300), H = +(A.h || 640), COLS = +(A.cols || 5);
    const seeds = (A.seeds || '3').split(',').map(Number);
    const turns = (A.turn || '0').split(',').map(Number);
    const pick = A.pick ? A.pick.split(',') : null;
    const SHOW = pick ? LOOKS.filter(([n]) => pick.includes(n.split(' ')[0])) : LOOKS;
    const cells = SHOW.length * seeds.length * turns.length;
    const rows = Math.ceil(cells / COLS), PW = W * COLS, PH = H * rows;
    const px = { W: PW, a: new Uint8Array(PW * PH * 3).fill(255) };
    const grown = [];
    for (const [name, P] of SHOW) for (const s of seeds) for (const t of turns) grown.push({ name, g: growTree(P, s), t });
    let gy = 0, gx = 0;
    for (const q of grown) { const p = q.g.attributes.position.array, ca = Math.cos(q.t * Math.PI / 180), sa = Math.sin(q.t * Math.PI / 180);
      let lo = 1e9, hi = -1e9; for (let i = 0; i < p.length; i += 3) { if (p[i+1] > gy) gy = p[i+1]; const u = p[i] * ca - p[i+2] * sa; if (u < lo) lo = u; if (u > hi) hi = u; }
      if (hi - lo > gx) gx = hi - lo; }
    const SC = Math.min(W * 0.92 / gx, H * 0.90 / gy);   // ONE scale, so the ten can be compared
    let k = 0; const notes = [];
    for (const q of grown) {
      const name = q.name, cxk = (k % COLS) * W, cyk = Math.floor(k / COLS) * H;
      const sub = { W: PW, a: px.a.subarray(cyk * PW * 3) };
      const r = drawTree(q.g, sub, cxk, W, H, q.t * Math.PI / 180, { label: name.split(' ')[0], leaves: A.leaves !== '0', sc: SC });
      notes.push(name.padEnd(20) + r.height.toFixed(1).padStart(5) + ' m tall ' + r.width.toFixed(1).padStart(5) + ' m across ' + String(r.tris).padStart(6) + ' triangles');
      k++;
    }
    const OUT = A.out || '/tmp/trees.png';
    fs.writeFileSync(OUT, writePng(px.a, PW, PH, 3));
    for (const s of notes) console.log(s);
    console.log('wrote ' + OUT + ' (' + PW + 'x' + PH + ')');
  }
}
