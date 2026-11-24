// Painted Cosmos: the near ground, the sward. OWNER: PAINTER.
// Three rings of instanced brush marks round the eye, one draw call each, laid the way a
// painter lays a meadow: close by, tufts of single flicks with flowers on their stalks, fallen
// leaves and twigs under the trees, stones and moss by the water; farther off, fan-brush
// touches (a clump of grass in one mark, a frond of fern, a drift of flowers as a dash of
// colour, a stone); farthest, a few broad soft touches that only break the wash. "Far things
// are fewer, larger, softer strokes; near things get a few crisp accents." On worlds without
// grass the same rings lay splinters, stones and drift ripples.
//
// Marks are anchored to the planet: each ring divides the ground into cells of a cube-sphere
// grid, each cell owns one clump whose places, shapes and washes are a pure function of the
// cell. Cells come and go at the edge of the ring's range, where a mark's size is already
// nothing, so nothing pops; a clump laid inside the range grows in.
import * as THREE from 'three';
import { faceToDir, dirToFace } from './cubesphere.js';
import { hash3i } from './noise.js';
import { getSurface, makeSample, NOLQ } from './surface.js';
import { makeNearMaterial } from '../render/materials.js';
import { QUALITY, LOOK } from '../render/shared.js';
import { getLook } from '../data/looks.js';
import { bloomAt, bloomSwitches, hasBlooms, SHAPES } from './bloom.js';
import { SEASON } from '../data/season.js';

// cell (m); range (m) at quality 0, 1, 2 (0: the ring is not laid); marks per cell; the ring
// fades in between `inner` distances (so a broad touch is never held up to the eye); how soft
// its marks are left; how far above the ground the eye may be; cells moved before re-listing.
const RINGS_WC = [
  // (the single strokes run on to 23 m at the top tier and the fan touches begin at 6 m: the two
  // hands overlap over a long band instead of changing over at 17 m)
  { name: 'fine', cell: 0.6, range: [11, 12, 23], per: 12, inner: [0.8, 2.6], soft: 0, alt: 45, step: 2 },
  { name: 'mid', cell: 1.9, range: [0, 40, 66], per: 7, inner: [6, 13], soft: 0.6, alt: 90, step: 1 },
  { name: 'far', cell: 6.5, range: [0, 0, 240], per: 5, inner: [38, 66], soft: 0.8, alt: 200, step: 1 },
];

// THE FAR GROUND'S OWN MARKS (2026-11-22, the owner: "i want things to look high quality and fully rendered even
// from 300 yards away" -- 275 m). The three rings above reach 23 m, 66 m and 240 m at the three tiers, so at
// 275 m the ground carried NONE of its own marks: a bare painted slope, which is half of why the far picture
// reads as unfinished. The fourth ring below is a coarser, broader hand laid out past it.
//   `?vista=`    0 takes the ring away altogether -- no ring, no draw call, no buffer, the oil look exactly as it
//                was. Otherwise it scales the reach; the pool grows with the SQUARE of it, so it is held to 1.4.
//   `?vistaink=` how far a far mark's colour departs from the ground it lies on (1 as laid, 0 the ground's own
//                colour and nothing to see, 2 twice as far). The far marks are deliberately close to their
//                ground: see layVista.
//   `?farpool=`  how much bigger the FAR ring's pool of marks is than the old sizing (1.45 as laid, 1 as it was):
//                see the note on `pool` in the constructor. Nothing to do with the reach; it only stops the far
//                ring's outermost cells coming up bare.
const VISTA = (() => {
  let on = 1, ink = 1, pool = 1.45;
  try {
    const q = new URLSearchParams(location.search);
    if (q.has('vista') && isFinite(+q.get('vista'))) on = Math.max(0, Math.min(1.4, +q.get('vista')));
    if (q.has('vistaink') && isFinite(+q.get('vistaink'))) ink = Math.max(0, Math.min(2, +q.get('vistaink')));
    if (q.has('farpool') && isFinite(+q.get('farpool'))) pool = Math.max(1, Math.min(2, +q.get('farpool')));
  } catch { /* no address to read */ }
  return { on, ink, pool };
})();
// Cell 13 m: twice the far ring's 6.5 m, so a quarter of the marks for the same ground, which is how the reach
// is paid for -- the area grows with the SQUARE of the reach, and 450 m is 3.5 times the area of 240 m.
// MEASURED on Earth's forest at the top tier (Node, the whole ring due at once): 5,141 cells and 15,501 marks of
// a 22,513 pool (1.5 MB), against the far ring's 5,836 cells and 25,765 marks of a 30,959 pool (2.0 MB). Nearly
// twice the reach for less than the far ring's own cost; its arrival is 100 ms of script against the far ring's
// 68, and it re-lists itself every 13 m walked at 3.1 ms a time, where the fine ring does 4.8 ms every 1.2 m.
//   `per` 6 sizes the pool and the hand lays 4: a cell laid while the pool is empty is recorded as BARE until it
//   leaves the ring (site(), `!this.free.length`), so the pool must never run dry. Measured, 4 a cell comes to
//   69% of the pool, which leaves room for the cells that linger past the range.
//   `innerQ`, `mark`: the fade-in distance and the size of a mark at each tier. A mark is two and a half to
//   seven metres across its long axis, which at 275 m is six to sixteen pixels of a 720-line picture at 60
//   degrees (one pixel is 0.44 m out there), where the far ring's own grass touch is two to four pixels and the
//   comb of five to ten blades the fragment shader cuts into it is under a pixel a blade -- that is the pepper
//   this ring must not become. `mark` holds a mark to about the same size ON SCREEN at the distance where the
//   ring fades in (126 m at the top tier, 40 m at the middle one, which has no far ring of its own at all).
//   `alt` 220: a hand coarser than the far ring's (200) is the last to go as the eye rises, not the first.
//   `grown`: a mark is laid already grown. Over a ring this large the 0.7 s growing-in (GROW_T) would be seen as
//   a wave of marks arriving from the feet outward, which is the owner's own complaint about things loading in;
//   nothing pops without it, because a mark has no size at the rim where cells are listed (NEAR_VERT, `vis`).
// THE FLORA LANE'S SWITCHES (2026-11-24, docs/lead/FLORA-DESIGN.md; the oil look only, the watercolour game never reads them).
// The lane is ON by default; `?flora=old` (the one opt-out, for the owner's comparison) gives the oil look back as it was
// before the lane, to the bit. Each of these is 1 by default and 0 gives that package back exactly as it was. (The
// cull, G1, is on either way: it changes no pixel.)
//   `?grass2=`   0 takes the whole grass package away (G2-G4): the oil look's near grass as it was on 24 Nov.
//   `?nearcull=` 0 shades every mark again, in view or not (G1; the speed test's row does the same). On with ?flora=old too.
//   `?bladegreen=` 0 gives the blades the undergrowth's greens again instead of their own (`oil.flora.sward.leaf`, F10)
//   `?tuft=`     0 lets each blade pick its own colour again instead of its tuft's, and each touch of the middle band its
//                own instead of mostly its cell's (the look director's audit 2)
//   `?comb=`     0 lets the middle band's grass touches lean every way again instead of with the meadow's comb (audit 2)
//   `?driftpatch=` 0 lays a drift's heart past the near ring as many floor-sized heads again, not as a patch (audit 2)
//   `?patchfloor=` 1 also brings the heads' floor down in the middle and far rings (0.55 and 0.4 of it; not yet seen)
//   `?sheen=`    0 takes away the gusts' sheen on the blades (G4: needs PHYSICS' bend, so the game, or the gallery's &physics=1).
const FLORA = (() => {
  const f = { grass2: 1, cull: 1, sheen: 1, bloom: 0, blade: 1, tuft: 1, comb: 1, patch: 0, pfloor: 0 };
  try {
    const q = new URLSearchParams(location.search), on = (k) => !q.has(k) || (q.get(k) !== '0' && q.get(k) !== 'false');
    // THE ONE OPT-OUT (the owner, 24 Nov, through the coordinator: "No do make it look different"): the lane is ON by
    // default; ?flora=old gives today's flora back for comparison, every part of the lane that changes the picture off.
    // The marks the eye cannot see are dropped either way (G1, picture-identical; ?nearcull=0 off).
    const isOld = q.get('flora') === 'old' || q.get('flora') === '0' || q.get('flora') === 'false';
    f.grass2 = !isOld && on('grass2') ? 1 : 0;
    f.cull = on('nearcull') ? 1 : 0;
    f.sheen = f.grass2 && on('sheen') ? 1 : 0;
    f.blade = f.grass2 && on('bladegreen') ? 1 : 0;
    f.tuft = f.grass2 && on('tuft') ? 1 : 0;
    f.comb = f.grass2 && on('comb') ? 1 : 0;
  } catch { /* no address to read */ }
  if (!LOOK.oil) { f.grass2 = 0; f.cull = 0; f.sheen = 0; f.blade = 0; f.tuft = 0; f.comb = 0; }
  // (F1-F3: the flowers from world/bloom.js's map, ?bloom=0 off; read there, where the ground's colour reads it too)
  f.bloom = LOOK.oil ? bloomSwitches().bloom : 0;
  try {
    const q = new URLSearchParams(location.search), on = (k) => !q.has(k) || (q.get(k) !== '0' && q.get(k) !== 'false');
    f.patch = f.bloom && on('driftpatch') ? 1 : 0;
    f.pfloor = f.patch && q.get('patchfloor') === '1' ? 1 : 0;
  } catch { f.patch = f.bloom; }
  return f;
})();
export { FLORA };
const V = VISTA.on;
const RINGS_OIL = [Object.assign({}, RINGS_WC[0], { pool: bloomSwitches().year ? 1.25 : 1 }), RINGS_WC[1], Object.assign({}, RINGS_WC[2], { pool: VISTA.pool }), {
  name: 'vista', cell: 13, range: [0, 190 * V, 450 * V], per: 6,
  inner: [126 * V, 206 * V], innerQ: [[0, 0], [40 * V, 72 * V], [126 * V, 206 * V]], mark: [0, 0.45 * V, V],
  soft: 0.95, alt: 220, step: 1, vista: 1, grown: 1,
}];
// G2, THE CARPET (2026-11-24, docs/lead/FLORA-DESIGN.md 6.2). The same blades a square metre everywhere in the fine ring
// covered 14 per cent of the ground's pixels at 3 m and all of them, overlapping, by 8 m (worked from the camera: a blade
// never goes under 1.7 pixels wide, a square metre of ground shrinks as the cube of the distance at a grazing look), so the
// sward was a bare leaf carpet at the feet and a textured band at 8 to 12 m. This ring adds three times the fine ring's
// blades a square metre within 7 m of the eye: with the fine ring's own, four times. Its own ring, not more marks in the
// fine one, because a cell keeps its marks as the eye walks on (it is laid when it enters the ring): the fine ring would
// have to carry them to 12 m (to 23 at the top tier) in every cell. Each blade's own range falls between 5 and 7 m, so
// the carpet thins into the fine ring with no edge. Not laid at the low tier, nor above 14 m of height.
const CARPET = { name: 'carpet', cell: 0.45, range: [0, 7, 8], per: 20, inner: [0.5, 1.2], soft: 0, alt: 14, step: 2, carpet: 1 };
const RINGS = !LOOK.oil ? RINGS_WC : (FLORA.grass2 ? [CARPET] : []).concat(V > 0 ? RINGS_OIL : RINGS_WC);
const GROW_T = 0.7;      // seconds a clump laid inside the range takes to grow in (the shader's measure)
const HOLD_T = 6;        // seconds the strokes wait at most for their ground
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const dens = (c, d) => Math.max(0, Math.min(1, c - (c - c * c) * (d - 1)));   // the pigment density model
// (F2) a colour packed in one float for a mark's second colour (the shader unpacks it: materials.js NEAR_VERT vTone)
// (F2) a painted flower is drawn larger than life: at the game's distances a real head of two or three centimetres is
// three to five pixels and sinks into the sward (SEEN, the level meadow, 24 Nov). The data keeps real sizes; this is the
// painter's licence, one number for all of them.
const BLOOM_HEAD = 2.5;   // (2.0 until the coordinator's note, 24 Nov: "a poppy at 2 m should read as a poppy")
// (the colour takes the low 18 bits; pure white would carry into the year's bits above them, so it stops one short)
// (the look director on the final set: the stones by the water and on stony ground came out near-black discs; with the lane
// on they are a step under the ground they lie on, light greys and ochres, never dark: half or more of the way to the
// ground's colour, and no channel's top under 0.62. ?grass2=0 / ?flora=old: as they were.)
function stoneC(c, gr, gg, gb, m, out) {
  if (!FLORA.grass2) { out[0] = lerp(c[0], gr, m); out[1] = lerp(c[1], gg, m); out[2] = lerp(c[2], gb, m); return out; }
  const k = Math.max(m, 0.55);
  let r = lerp(c[0], gr, k), g = lerp(c[1], gg, k), b = lerp(c[2], gb, k);
  const v = Math.max(r, g, b); if (v < 0.62) { const f = 0.62 / Math.max(v, 1e-3); r = Math.min(1, r * f); g = Math.min(1, g * f); b = Math.min(1, b * f); }
  out[0] = r; out[1] = g; out[2] = b; return out;
}
const _stc = [0, 0, 0], _cuv = [1, 0];
// A BLADE'S TONE (the look director's audit 2: "marks take their colour from the PIXEL, not the THING"; from 10 to 30 m
// the sward was a speckle of three greens, blade by blade). With ?tuft on, a TUFT takes one of the three colours (or is a
// dark accent tuft, one in seven) and its blades differ only by a value step; off, each blade picks its own as before.
// Returns the colour's index (0 light, 1 mid, 2 the dark accent), whether it is the accent, and the density to lay it at.
const _bt = { i: 0, acc: false, dk: 1 };
function bladeTone(pv, th) {
  if (!FLORA.tuft) { _bt.acc = pv < 0.14; _bt.i = _bt.acc ? 2 : pv < 0.55 ? 1 : 0; _bt.dk = _bt.acc ? 1.12 : pv < 0.36 ? 0.84 : 1.2; return _bt; }
  _bt.acc = th < 0.14; _bt.i = _bt.acc ? 2 : th < 0.55 ? 1 : 0;
  _bt.dk = (_bt.acc ? 1.12 : th < 0.36 ? 0.84 : 1.2) * (0.94 + 0.12 * pv);
  return _bt;
}
const packTone = (c) => Math.min(262143, 1 + Math.round(Math.max(0, Math.min(1, c[0])) * 63) * 4096 + Math.round(Math.max(0, Math.min(1, c[1])) * 63) * 64 + Math.round(Math.max(0, Math.min(1, c[2])) * 63));
// (the year, ?bloomyear=0 off) a kind's flowering window, `season: [from, to]` on SEASON.t (0 high summer, 1 deep autumn),
// in sevenths, in the six bits above the colour: when it comes into flower times 8, plus how far before the end of the
// year it is over. [0, 1], or no window, is 0: in flower all the year, the mark as it was. Read by materials.js NEAR_VERT.
const packWin = (w) => {
  if (!w || !bloomSwitches().year) return 0;
  const a = Math.round(Math.max(0, Math.min(1, w[0])) * 7), e = Math.round(Math.max(0, Math.min(1, w[1])) * 7);
  return (a * 8 + (7 - e)) * 262144;
};
const packYear = (b) => {
  const w = b && b.season;
  if (!w || !bloomSwitches().year) return 0;
  const a = Math.round(Math.max(0, Math.min(1, w[0])) * 7), e = Math.round(Math.max(0, Math.min(1, w[1])) * 7);
  return (a * 8 + (7 - e)) * 262144;
};
// smooth value noise on the cell grid (drifts of flowers, where the grass stands tall)
function vnoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  return lerp(lerp(hash3i(xi, yi, 91, seed), hash3i(xi + 1, yi, 91, seed), sx), lerp(hash3i(xi, yi + 1, 91, seed), hash3i(xi + 1, yi + 1, 91, seed), sx), sy);
}
// stroke kinds as the shader reads them (iPar.y): under 1.5 a plain tapering stroke (the number
// is its width at half length), 2 a grass flick, 3 a flick left crisp, 4 a fan-brush touch,
// 5 a round touch facing the eye, 6 a touch laid flat on the ground; +0.25: left crisp.
const FLICK = 2, FAN = 4, DAB = 5, LYING = 6, CRISP = 0.25;
// (audit 2, ?driftpatch: a drift's patch is a crisp dab in every way but one, so the shader knows it: it comes in only
// past 11-16 m, where the near ring's own flowers stop, materials.js NEAR_VERT)
const PATCH = DAB + 0.4;
const SEED_HEAD = [0.88, 0.76, 0.46], LITTER = [[0.80, 0.62, 0.34], [0.66, 0.42, 0.26], [0.46, 0.30, 0.24]], TWIG = [0.36, 0.27, 0.25];

// What grows or lies near the eye in a biome: shares of each kind in a full clump (0..1).
// A biome may say so itself (looks.js, `near: { blade, reed, needle, dab, ripple, flower, fern, litter }`
// as counts out of 8, the measure the first near layer was written in).
function styleOf(look, b) {
  const sm = b.small || {}, forest = b.terrain === 'forest';
  const under = Object.assign({}, look.flora && look.flora.under, b.under);
  const st = { blade: 0, reed: 0, needle: 0, dab: 0, ripple: 0, flower: 0, fern: 0, litter: 0, crust: 0, gm: 0.60, flowerSize: 1,
    crustC: under.crust || null, stalk: under.stalk || null,
    leaf: under.leaf || null, rock: under.rock || null, shard: under.shard || null, bush: under.bush || null,
    flowers: under.flowers || (under.accent ? [under.accent] : null), litterC: under.litter || (forest ? LITTER : null) };
  const grass = (sm.grass == null ? (forest ? 0.4 : 0) : sm.grass) + (sm.fern || 0) * 0.6;
  st.blade = Math.round(8 * Math.min(1, grass * 2.0));
  st.reed = Math.round(3 * Math.min(1, (sm.reed || 0) * 2));
  st.needle = Math.round(6 * Math.min(1, (sm.shard || 0) * 7));
  if (b.terrain === 'dunes') st.ripple = 5;
  st.dab = Math.max(st.blade >= 6 ? 0 : 2, Math.round(6 * Math.min(1, (sm.rock || 0) * 9)));
  st.flower = 8 * Math.min(1, (sm.flower == null ? (forest ? 0.07 : 0) : sm.flower) * 7);
  st.fern = 8 * Math.min(1, (sm.fern == null ? (forest ? 0.12 : 0) : sm.fern) * 5);
  st.litter = st.litterC ? (forest ? 8 : (b.tall ? 4 : 0)) : 0;
  // (`crust`: what lies flat on bare ground in patches: lichen, sulphur crust, frost flowers, plates of ice or glass;
  // `gm`: how far a blade's wash is pulled to the ground's; `flowerSize`: fungi are flowers with broad heads)
  st.crust = st.crustC ? 4 : 0;
  if (b.near) Object.assign(st, b.near);
  if (!st.crustC) st.crust = 0;
  // (G4, the flora lane: a blade in its OWN greens. `leafB` / `gmB` are what the blades of the fine ring and the carpet are
  // mixed from; with ?grass2=0 they are `leaf` and `gm` as they were. A blade took six tenths of the ground's own wash, so
  // in a still a sward of four times the blades read as no more grass than one (docs/shots/painter/flora-design/
  // exp-meadow-*): at a quarter it stands out as a stroke. In the oil look a biome's own undergrowth greens (`oil.under`,
  // the ones its PROP undergrowth already wears) are the blades' too: the autumn wood's watercolour `under` is straw.
  // A biome may set its own: `oil.flora.sward` = { gm, carpet } (carpet: the carpet ring's blades, 1 = three times the
  // fine ring's a square metre).)
  const sw = (FLORA.grass2 && b.oil && b.oil.flora && b.oil.flora.sward) || {};
  // (the lime, LOOK-AUDIT F10 / LOOK-RULES R2.4, agreed with the look director 24 Nov: the blades may have greens of their
  // own, `oil.flora.sward.leaf`, so the lit blades come out olive-gold on screen -- hue 55-75, S at most 0.72, V 0.50-0.72
  // -- while the PROP undergrowth and the ground's palette, which are others' to set, stay as they are)
  st.leafB = FLORA.grass2 ? ((FLORA.blade && sw.leaf) || (b.oil && b.oil.under && b.oil.under.leaf) || st.leaf) : st.leaf;
  st.gmB = FLORA.grass2 ? (FLORA.blade && sw.gm != null ? sw.gm : 0.25) : st.gm;
  st.carpet = sw.carpet != null ? sw.carpet : 1;
  let left = 8;
  for (const k of ['blade', 'reed', 'needle', 'ripple', 'dab']) { st[k] = Math.max(0, Math.min(left, st[k])); left -= st[k]; }
  for (const k of ['blade', 'reed', 'needle', 'ripple', 'dab', 'flower', 'fern', 'litter', 'crust']) st[k] /= 8;
  return st;
}

class Ring {
  constructor(cfg, S, styles, root, bu, bodyId) {
    this.cfg = cfg; this.S = S; this.styles = styles;
    this.n = Math.max(8, Math.round((Math.PI * 0.5 * S.R) / cfg.cell));
    this.cellM = (Math.PI * 0.5 * S.R) / this.n;
    const rMax = Math.max(...cfg.range);
    // (`pool`, 2026-11-22: the pool is sized for three cells in four laying a full clump. COUNTED on Earth's
    // forest at the top tier, the whole ring listed at once: the far ring asks for 21,351 marks and HAS 21,351,
    // so it runs dry, and because clumps are laid nearest first the cells it then records as bare are the ones
    // at the rim -- the far band was coming up empty before anything was asked of it at 275 m. The oil look's
    // far ring is given half again as much; the watercolour's pool is what it was. `?farpool=`.)
    const N = this.N = Math.ceil((Math.PI * (rMax + cfg.cell + 1) * (rMax + cfg.cell + 1)) / (cfg.cell * cfg.cell * 0.8) * cfg.per * 0.75 * (cfg.pool || 1));
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, -1, 0.5, 0, 1, 0.5, 0, 0, 1, 0], 3));
    g.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]);
    const attr = (name, size) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(N * size), size); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(name, a); return a; };
    this.aRoot = attr('iRoot', 3); this.aAxis = attr('iAxis', 4); this.aPar = attr('iPar', 4); this.aCol = attr('iCol', 4); this.aExt = attr('iExt', 2);
    this.attrs = [this.aRoot, this.aAxis, this.aPar, this.aCol, this.aExt];
    // (F2, the oil look only: a mark's SECOND colour, packed in one float -- a daisy's eye, a cushion's flowers -- set as
    // data like every colour, LOOK-RULES R2.1; 0: none, the shader takes its second tone from the mark's own colour)
    this.aTone = LOOK.oil ? attr('iTone', 1) : null;
    if (this.aTone) this.attrs.push(this.aTone);
    g.instanceCount = 0;
    this.material = makeNearMaterial(bu);
    this.material.uniforms.uNearK.value.set(FLORA.cull, 0, 0, 0);
    // (the sheen grows over a bend of 0.03 to 0.35 rad: a breeze bends the grass a few degrees, a gust a fifth of a turn)
    this.material.uniforms.uNearL.value.set(FLORA.grass2, FLORA.sheen, 0.03, 0.35);
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.name = 'near-' + cfg.name + '-' + bodyId; this.mesh.frustumCulled = false; this.mesh.visible = false;
    root.add(this.mesh);
    this.origin = new THREE.Vector3(); this.hasOrigin = false;
    this.map = new Map();            // cell key -> the slots of its clump (null: nothing there)
    this.free = []; for (let i = N - 1; i >= 0; i--) this.free.push(i);
    this.high = 0; this.lo = N; this.hi = -1; this.all = true;
    // (what the GPU holds, PAINTER 19: three takes an attribute's update ranges only in a frame that draws the mesh,
    // and the ranges were laid down afresh in every update. A frame built and not drawn (a held clock stepped on, a
    // leap, a frame put aside to be painted later) lost what it had changed, a full upload after a teleport among
    // it, and the GPU kept the strokes of the place before, written against the old origin on the old ground's
    // plane: whole sheets of them stood leaning into the sky (Earth's alpine meadow, reached from the forest). What
    // has changed is now kept, and sent again with whatever changes next, until the GPU has taken it: `sent`)
    this.sent = false;
    // (all are taken in one go; with the second colour there are six, and the account waits for both of the last two)
    this.upl = 0;
    this.aExt.onUpload(() => { this.upl |= 1; if (this.upl === (this.aTone ? 3 : 1)) { this.sent = true; this.upl = 0; } });
    if (this.aTone) this.aTone.onUpload(() => { this.upl |= 2; if (this.upl === 3) { this.sent = true; this.upl = 0; } });
    this.pending = []; this.li = 1e9; this.lj = 1e9; this.lf = -1; this.now = 0; this.filled = false; this.range = 0; this.lastGrown = -10; this.okAt = -10;
    this.s = makeSample(S.nB); this.d = [0, 0, 0]; this.fo = { face: 0, u: 0, v: 0 };
  }
  // the GPU has taken what was sent: what changes from here is a fresh account
  taken() { if (this.sent) { this.sent = false; this.all = false; this.lo = this.N; this.hi = -1; } }

  // (still busy while clumps laid inside the range are growing in: a frame taken at 0 shows a whole sward)
  get busy() { return this.mesh.visible ? this.pending.length + (this.now - this.lastGrown < GROW_T + 0.1 ? 1 : 0) : 0; }
  get triangles() { return this.mesh.visible ? this.high * 3 : 0; }

  clear() {
    this.taken();
    this.map.clear(); this.free.length = 0; for (let i = this.N - 1; i >= 0; i--) this.free.push(i);
    this.pending.length = 0; this.lf = -1; this.filled = false; this.high = 0;
    this.lo = this.N; this.hi = -1;
    this.aAxis.array.fill(0); this.all = true;
  }
  hide() { if (this.mesh.visible) { this.mesh.visible = false; this.clear(); } }

  update(camLocal, alt, sliceMs, dt, pixel, ready) {
    const cfg = this.cfg, RANGE = cfg.range[QUALITY.level] || 0;
    this.taken();
    if (!(RANGE > 0) || alt > cfg.alt) { this.hide(); return 0; }
    if (RANGE !== this.range) { this.range = RANGE; if (this.mesh.visible) this.clear(); }
    this.mesh.visible = true;
    this.now += dt > 0 ? dt : 0;
    const R = this.S.R, n = this.n, CELL = cfg.cell;
    if (!this.hasOrigin || this.origin.distanceToSquared(camLocal) > 300 * 300) {
      if (!this.hasOrigin || this.origin.distanceToSquared(camLocal) > 900 * 900) this.clear();
      else {
        // the eye has moved on: the marks keep their places, written against the new origin (the sward
        // used to be taken up and laid again here, every 300 m of a walk)
        const dx = camLocal.x - this.origin.x, dy = camLocal.y - this.origin.y, dz = camLocal.z - this.origin.z, a = this.aRoot.array;
        for (let o = 0, e = this.high * 3; o < e; o += 3) { a[o] -= dx; a[o + 1] -= dy; a[o + 2] -= dz; }
        this.all = true;
      }
      this.origin.copy(camLocal); this.hasOrigin = true;
      this.material.uniforms.uOrigin.value.copy(this.origin);
      this.mesh.position.copy(this.origin); this.mesh.updateMatrixWorld(true);
    }
    const u = this.material.uniforms;
    u.uCamLocal.value.copy(camLocal).sub(this.origin);
    // (G3, the flora lane: the middle ring's touches each have a range between 0.4 and 1 of the ring's, where they had
    // 0.66 to 1, so past about 25 m the band thins toward its rim instead of standing in rows behind one another: its
    // touches painted each pixel they covered 3.8 times at the autumn landing. The shader grows a touch as the band thins.)
    u.uNear.value.set(RANGE * (FLORA.grass2 && cfg.name === 'mid' ? 0.40 : 0.66), RANGE, this.now, pixel || 0.002);
    if (u.uNearK) u.uNearK.value.w = cfg.name === 'mid' ? (FLORA.pfloor ? 0.55 : 0.85) : (cfg.name === 'far' ? (FLORA.pfloor ? 0.4 : 0.6) : 1);   // (a flower head's least size on screen, a share)
    if (u.uNearK) u.uNearK.value.y = FLORA.bloom ? SEASON.t : 0;    // (the flowers' year: packYear above)
    // (the fade-in band is a tier's own where a ring says so: the vista ring is laid at two tiers whose reaches
    // differ by more than twice, and one band of metres cannot serve both -- at the middle tier it would fade in
    // where it is already fading out. The three rings above have one band each, as they had.)
    const inn = (cfg.innerQ && cfg.innerQ[QUALITY.level]) || cfg.inner;
    u.uNear2.value.set(inn[0], inn[1], cfg.soft, 0);
    // the cell under the eye; when it has moved on, see which cells have come into range or left it
    const il = 1 / camLocal.length(), cx = camLocal.x * il, cy = camLocal.y * il, cz = camLocal.z * il;
    const fo = dirToFace(cx, cy, cz, this.fo), d = this.d;
    const i0 = Math.floor((fo.u * 0.5 + 0.5) * n), j0 = Math.floor((fo.v * 0.5 + 0.5) * n);
    const ef = fo.face, eu = fo.u, ev = fo.v;        // (the eye's place on the cube: `fo` is used again below)
    if (fo.face !== this.lf || Math.max(Math.abs(i0 - this.li), Math.abs(j0 - this.lj)) >= cfg.step) {
      this.lf = fo.face; this.li = i0; this.lj = j0;
      const f0 = fo.face, pad = cfg.step * CELL, reach = (RANGE + 0.4 + pad) / R, K = Math.ceil((RANGE + 1 + pad) / (CELL * 0.62));
      const want = new Set();
      this.pending.length = 0;
      for (let b = -K; b <= K; b++) {
        for (let a = -K; a <= K; a++) {
          let f = f0, i = i0 + a, j = j0 + b;
          faceToDir(f0, ((i + 0.5) / n) * 2 - 1, ((j + 0.5) / n) * 2 - 1, d);
          const dist = Math.hypot(d[0] - cx, d[1] - cy, d[2] - cz);
          if (dist > reach) continue;
          if (i < 0 || j < 0 || i >= n || j >= n) {       // over the edge of the cube face: the cell belongs to the neighbour
            const o = dirToFace(d[0], d[1], d[2], this.fo);
            f = o.face; i = Math.min(n - 1, Math.max(0, Math.floor((o.u * 0.5 + 0.5) * n))); j = Math.min(n - 1, Math.max(0, Math.floor((o.v * 0.5 + 0.5) * n)));
          }
          const key = (f * n + i) * n + j;
          if (want.has(key)) continue;
          want.add(key);
          if (!this.map.has(key)) this.pending.push([dist, f, i, j, key]);
        }
      }
      // cells that have left: their marks had already shrunk to nothing
      const gone = (RANGE + 2.2 + pad + CELL) / R;
      for (const [key, slot] of this.map) {
        if (want.has(key)) continue;
        const j = key % n, i = ((key - j) / n) % n, f = Math.floor(key / (n * n));
        faceToDir(f, ((i + 0.5) / n) * 2 - 1, ((j + 0.5) / n) * 2 - 1, d);
        if (Math.hypot(d[0] - cx, d[1] - cy, d[2] - cz) < gone) continue;
        this.map.delete(key);
        if (slot) { for (const o of slot) { this.free.push(o); this.aAxis.array[o * 4 + 3] = 0; this.touch(o); } }
      }
      this.pending.sort((p, q) => q[0] - p[0]);          // nearest last: popped first
    }
    // lay the clumps that are due, nearest first, inside the time allowed
    // (strokes are laid on ground that is on the paper as it will stay, and after what stands on it: on an
    // arrival they wait, at most HOLD_T seconds, and then grow in from the feet outward; a clump at the
    // rim of the range has no size yet and needs no growing)
    let spent = 0;
    const ok = !ready || ready(ef, eu, ev);
    if (ok) this.okAt = this.now;
    if (this.pending.length && (ok || this.now - this.okAt > HOLD_T)) {
      const t0 = performance.now();
      let guard = 0;
      while (this.pending.length && (guard++ < 3 || (guard & 3) || performance.now() - t0 < sliceMs)) {
        const p = this.pending.pop(), grown = !!cfg.grown || p[0] * R > RANGE * 0.9;
        this.lay(p[1], p[2], p[3], p[4], grown ? -10 : this.now);
        if (!grown) this.lastGrown = this.now;
      }
      if (!this.pending.length) this.filled = true;
      spent = performance.now() - t0;
    }
    if (this.all || this.hi >= this.lo) {
      this.mesh.geometry.instanceCount = this.high;
      for (const a of this.attrs) {
        a.clearUpdateRanges();
        if (!this.all) a.addUpdateRange(this.lo * a.itemSize, (this.hi - this.lo + 1) * a.itemSize);
        a.needsUpdate = true;
      }
      // (all, lo and hi stand until the GPU has taken them: taken(), at the next update after a frame that drew this)
    }
    return spent;
  }
  touch(o) { if (o < this.lo) this.lo = o; if (o > this.hi) this.hi = o; }

  // Where a cell's clump stands and what its ground is: false when nothing can stand there.
  site(f, i, j, key) {
    const S = this.S, n = this.n, s = this.s, d = this.d, R = S.R, seed = this.seed = (f * 7919 + 13) | 0;
    const r1 = hash3i(i, j, 1, seed), r2 = hash3i(i, j, 2, seed);
    faceToDir(f, ((i + 0.15 + 0.7 * r1) / n) * 2 - 1, ((j + 0.15 + 0.7 * r2) / n) * 2 - 1, d);
    const x = this.x = d[0], y = this.y = d[1], z = this.z = d[2];
    S.sample(x, y, z, s, true);
    const h = s.h;
    if ((s.lq !== NOLQ && s.lq > h - 0.04) || !this.free.length) { this.map.set(key, null); return false; }
    // the ground's own plane here (two more heights): marks stand on the slope, not on the sphere
    let ux, uy, uz;
    if (Math.abs(y) < 0.9) { ux = -z; uy = 0; uz = x; } else { ux = 0; uy = z; uz = -y; }
    let l = 1 / Math.hypot(ux, uy, uz); ux *= l; uy *= l; uz *= l;
    const vx = y * uz - z * uy, vy = z * ux - x * uz, vz = x * uy - y * ux;
    const e = Math.max(0.45, this.cfg.cell * 0.4);
    const gu = (S.heightAt(x + ux * e / R, y + uy * e / R, z + uz * e / R) - h) / e, gv = (S.heightAt(x + vx * e / R, y + vy * e / R, z + vz * e / R) - h) / e;
    const steep = this.steep = Math.hypot(gu, gv);
    if (steep > 1.3) { this.map.set(key, null); return false; }
    let nx = x - ux * gu - vx * gv, ny = y - uy * gu - vy * gv, nz = z - uz * gu - vz * gv;
    l = 1 / Math.hypot(nx, ny, nz);
    this.nx = nx * l; this.ny = ny * l; this.nz = nz * l;
    this.ux = ux; this.uy = uy; this.uz = uz; this.vx = vx; this.vy = vy; this.vz = vz; this.gu = gu; this.gv = gv;
    this.px = x * (R + h) - this.origin.x; this.py = y * (R + h) - this.origin.y; this.pz = z * (R + h) - this.origin.z;
    // which biome's ground this is (borders intermix clump by clump)
    let bi = s.top, acc = 0; const pick = this.pick = hash3i(i, j, 3, seed);
    for (let q = 0; q < S.nB; q++) { acc += s.w[q]; if (pick < acc) { bi = q; break; } }
    this.st = this.styles[bi]; this.bi = bi;
    // (a biome without undergrowth of its own, the forests, grows grass wherever the canopy lets it)
    const und = S.biomes[bi].small ? (s.under || 0) : 1;
    this.canopy = Math.min(1, s.canopy || 0);
    this.meadow = Math.min(1, 0.3 + 0.7 * und) * (1 - 0.4 * this.canopy) * (1 - Math.min(1, s.rock || 0) * 0.7) * (steep > 0.8 ? 0.4 : 1);
    this.shore = s.lq !== NOLQ ? 1 - sstep(0.06, 0.75, h - s.lq) : 0;
    // drifts and patches, in metres along the cube face (so the three rings agree where they are)
    const U = (i + 0.5) * this.cellM, V = (j + 0.5) * this.cellM;
    this.rough = vnoise(U / 7.3, V / 7.3, seed + 5);
    this.drift = vnoise(U / 9.7 + 31.7, V / 9.7 + 3.3, seed + 9);
    this.which = vnoise(U / 27 + 7.1, V / 27 + 1.9, seed + 11);
    // stones lie in drifts with bare ground between, crust in patches of its own (and one more, larger, slower field: which crust)
    this.stony = 2.1 * sstep(0.44, 0.76, vnoise(U / 5.9 + 13.1, V / 5.9 + 7.7, seed + 15) * 0.75 + 0.25 * this.rough);
    // (PAINTER 17, the M4 critique's fifth item: Uranus' and Pluto's first views were an even scatter of white splinters, one
    // size at one spacing. Drifts: larger companies, denser at their hearts, with bare ground between; about as many in all.
    // It was 1.9 * sstep(0.42, 0.72, noise at 6.7 m))
    this.needly = 2.7 * sstep(0.52, 0.76, vnoise(U / 10.5 + 23.1, V / 10.5 + 1.7, seed + 19));       // splinters stand in companies
    this.crusty = sstep(0.40, 0.66, vnoise(U / 4.3 + 3.9, V / 4.3 + 17.3, seed + 17) * 0.7 + 0.3 * this.drift);
    // (PAINTER 14: reeds stand in beds, with mud and water between them: the misty wetland's near reeds were one even comb)
    this.reedy = 1.8 * sstep(0.34, 0.58, vnoise(U / 6.1 + 41.3, V / 6.1 + 9.9, seed + 23));
    this.slots = []; this.map.set(key, this.slots);
    return true;
  }

  // one mark: (ou, ov) where in the clump on the ground's plane, lift above it; the way it grows
  // (0: the ground's normal leaned by `tilt` toward `la`; 1: the normal itself), its measure and wash
  put(ou, ov, lift, tilt, la, len, wid, kind, hz, born, cr, cg, cb, curl, flex, tone = 0) {
    if (!this.free.length) return -1;
    const o = this.free.pop(); this.slots.push(o); if (o >= this.high) this.high = o + 1; this.touch(o);
    const { ux, uy, uz, vx, vy, vz, nx, ny, nz, x, y, z } = this;
    const dh = ou * this.gu + ov * this.gv - 0.02 + lift;
    const Ro = this.aRoot.array, A = this.aAxis.array, P = this.aPar.array, C = this.aCol.array, E = this.aExt.array;
    Ro[o * 3] = this.px + ux * ou + vx * ov + x * dh; Ro[o * 3 + 1] = this.py + uy * ou + vy * ov + y * dh; Ro[o * 3 + 2] = this.pz + uz * ou + vz * ov + z * dh;
    const ca = Math.cos(la) * tilt, sa = Math.sin(la) * tilt;
    const ax = nx + ux * ca + vx * sa, ay = ny + uy * ca + vy * sa, az = nz + uz * ca + vz * sa, l = 1 / Math.hypot(ax, ay, az);
    A[o * 4] = ax * l; A[o * 4 + 1] = ay * l; A[o * 4 + 2] = az * l; A[o * 4 + 3] = len;
    P[o * 4] = wid; P[o * 4 + 1] = kind; P[o * 4 + 2] = hz; P[o * 4 + 3] = born;
    C[o * 4] = cr; C[o * 4 + 1] = cg; C[o * 4 + 2] = cb; C[o * 4 + 3] = curl;
    E[o * 2] = this.canopy; E[o * 2 + 1] = flex;
    if (this.aTone) this.aTone.array[o] = tone;
    return o;
  }

  lay(f, i, j, key, born) {
    if (!this.site(f, i, j, key)) return;
    if (this.cfg.carpet) this.layCarpet(i, j, born);
    else if (this.cfg.name === 'fine') this.layFine(i, j, born);
    else if (this.cfg.vista) this.layVista(i, j, born);
    else this.layBroad(i, j, born);
  }

  // ---- close by: single flicks in tufts, flowers on stalks, fallen leaves, twigs, stones, moss ----
  layFine(i, j, born) {
    const st = this.st, s = this.s, seed = this.seed, per = this.cfg.per, lowQ = QUALITY.level === 0;
    const gr = s.r, gg = s.g, gb = s.b, canopy = this.canopy, shore = this.shore;
    const H = (k) => hash3i(i, j, k, seed);
    const tall = sstep(0.52, 0.74, this.rough);
    // (F2: where the map grows flowers they are plants of several marks; the cell is given room for them)
    const blooming = FLORA.bloom && hasBlooms(this.S, this.bi);
    let left = (lowQ ? per >> 1 : per) + (blooming ? 10 : 0);
    // by the water: stones, moss, a few dark sedges
    if (shore > 0.25 && st.rock) {
      const ns = Math.min(left, H(60) < shore ? 2 : 1);
      for (let k = 0; k < ns; k++) {
        const q1 = H(61 + k), q2 = H(64 + k), q3 = H(67 + k), c = st.rock[q3 < 0.45 ? 0 : 1];
        const w = 0.05 + 0.13 * q2 * q2;
        const sc = stoneC(c, gr, gg, gb, 0.25, _stc);
        this.put((q1 - 0.5) * 0.5, (q3 - 0.5) * 0.5, 0, 0, 0, w * (0.9 + 0.6 * q1), w, DAB, q2, born, sc[0], sc[1], sc[2], 0, 0);
      }
      left -= ns;
      if (st.leaf && left > 0) {       // moss: a dark, saturated touch lying on the bank
        const q1 = H(70), q2 = H(71), c = st.leaf[2];
        this.put((q1 - 0.5) * 0.4, (q2 - 0.5) * 0.4, 0.02, 0, 0, 0.05 + 0.20 * q1 * q1, 0.04 + 0.11 * q2 * q2, LYING, q1, born, dens(lerp(c[0], gr, 0.45), 1.2), dens(lerp(c[1], gg, 0.45), 1.1), dens(lerp(c[2], gb, 0.45), 1.2), q2 * 6.28, 0);
        left--;
      }
    }
    // under the trees: fallen leaves, now and then a twig
    if (st.litter > 0 && canopy > 0.18 && left > 0) {
      const nl = Math.min(left, Math.round(5 * st.litter * Math.min(1, canopy * 1.25) * (0.5 + H(72))));
      for (let k = 0; k < nl; k++) {
        const q1 = H(73 + k), q2 = H(79 + k), q3 = H(85 + k), q4 = H(91 + k);
        if (k === 0 && q4 < 0.14) {     // a twig
          this.put((q1 - 0.5) * 0.6, (q2 - 0.5) * 0.6, 0.015, 0, 0, 0.10 + 0.16 * q3, 0.010 + 0.006 * q4, LYING, q3, born, lerp(TWIG[0], gr, 0.5), lerp(TWIG[1], gg, 0.5), lerp(TWIG[2], gb, 0.5), q1 * 6.28, 0);
        } else {
          const c = st.litterC[q4 < 0.4 ? 0 : q4 < 0.78 ? 1 : 2], m = 0.30 + 0.25 * q2;
          this.put((q1 - 0.5) * 0.62, (q3 - 0.5) * 0.62, 0.012, 0, 0, 0.045 + 0.06 * q2, 0.028 + 0.035 * q3, LYING + (q4 > 0.78 ? CRISP : 0), q2, born, lerp(c[0], gr, m), lerp(c[1], gg, m), lerp(c[2], gb, m), q1 * 6.28, 0);
        }
      }
      left -= nl;
    }
    // flowers in drifts: a stalk and a head; a drift is of one kind
    // (F2, the flora lane: where the biome has blooms of its own -- data/looks/*.js `oil.flora.blooms`, world/bloom.js --
    // they are laid from the one map instead, as plants: layBlooms below)
    if (blooming) left -= this.layBlooms(i, j, born, 0.36, left - 2);
    const fl = !blooming && st.flower > 0 && st.flowers ? st.flower * sstep(0.50, 0.70, this.drift) * this.meadow * (1 - 0.6 * canopy) : 0;
    if (fl > 0.02 && left > 1) {
      const nf = Math.min(left >> 1, H(100) < fl * 1.3 ? (H(101) < fl * 0.6 ? 3 : 2) : (H(101) < fl * 2 ? 1 : 0));
      const fc = st.flowers[Math.min(st.flowers.length - 1, Math.floor(this.which * st.flowers.length * 0.999))];
      for (let k = 0; k < nf; k++) {
        const q1 = H(102 + k), q2 = H(106 + k), q3 = H(110 + k), q4 = H(114 + k);
        const ou = (q1 - 0.5) * 0.56, ov = (q2 - 0.5) * 0.56, L = (0.16 + 0.26 * q3) * (1 + 0.5 * tall), la = q4 * 6.2832, tilt = 0.05 + 0.22 * q1;
        const lc = st.stalk || (st.leaf ? st.leaf[1] : [gr, gg, gb]), fs = st.flowerSize;
        this.put(ou, ov, 0, tilt, la, L, fs > 1.3 ? 0.030 : 0.012, FLICK, q3, born, lerp(lc[0], gr, fs > 1.3 ? 0.25 : 0.5), lerp(lc[1], gg, fs > 1.3 ? 0.25 : 0.5), lerp(lc[2], gb, fs > 1.3 ? 0.25 : 0.5), 0, 1);
        const hr = (0.020 + 0.045 * q2 * q2) * fs;
        this.put(ou, ov, 0, tilt, la, hr * (fs > 1.3 ? 0.8 : 1.5), hr, DAB + CRISP, q2, born, fc[0], fc[1], fc[2], L * 0.96, 1);
      }
      left -= nf * 2;
    }
    // what lies on bare ground: pebbles, drift ripples; what stands on it: reeds, splinters
    const others = [];
    const cnt = (share, k) => { const v = share * 8 * (per / 12); const nI = Math.floor(v); return nI + (H(k) < v - nI ? 1 : 0); };
    for (let q = cnt(st.reed * this.reedy, 120); q > 0; q--) others.push(1);
    for (let q = cnt(st.needle * 1.6 * this.needly, 121); q > 0; q--) others.push(2);
    for (let q = cnt(st.ripple * 1.3, 122); q > 0; q--) others.push(4);
    // (a pebble where the sward is thin, except between reed beds: there the mud is bare, and the pebbles stood on it as dots)
    for (let q = cnt(st.dab * 1.2 * this.stony, 123) + (st.blade > 0 && this.meadow < 0.55 && !(st.reed > 0 && this.reedy < 0.6) ? 1 : 0); q > 0; q--) others.push(3);
    for (let q = cnt(st.crust * 2.2 * this.crusty, 124); q > 0; q--) others.push(5);
    // Grass grows in tufts, not in rows: a cell has one tuft, or two, or (one in six) none; a
    // tuft is a handful of flicks from nearly one root, fanned, one or two of them long. Tufts
    // differ in size, so the sward is uneven in spacing and in height; where the grass is left
    // to itself (`rough`) it stands tall and goes to seed.
    const t1 = H(4), t2 = H(5), t3 = H(6), t4 = H(7);
    const nTuft = t1 < 0.16 ? 0 : t1 < 0.70 ? 1 : 2;
    const tu = [(t2 - 0.5) * 0.5, (t4 - 0.5) * 0.5], tv = [(t3 - 0.5) * 0.5, (t2 * 7.13 % 1 - 0.5) * 0.5], tsz = [(0.55 + 1.0 * t3 * t3) * (1 + 0.45 * tall), (0.5 + 0.9 * t4) * (1 + 0.3 * tall)];
    // (where reeds grow, the sedge stands with them in the beds and the mud between is nearly bare)
    const bedK = st.reed > 0 ? 0.3 + 0.7 * Math.min(1, this.reedy) : 1;
    const nBlade = nTuft === 0 ? 0 : Math.min(Math.max(0, left - Math.min(others.length, 3)), Math.round(st.blade * (per - 1) * this.meadow * (0.7 + 0.5 * this.rough) * bedK));
    for (let k = 0; k < nBlade; k++) {
      const q1 = H(10 + k), q2 = H(24 + k), q3 = H(38 + k), q4 = H(52 + k), q5 = H(140 + k);
      const tf = nTuft === 2 ? (k & 1) : 0;
      const ang = q1 * 6.2832, rad = 0.015 + 0.075 * q2;
      // (a flick: pressed on at the root, lifted off to a point, curved; most are short, the
      // tuft's leader is long; the outer ones lean far over)
      const lead = k < 2 && q3 > 0.45;
      const pv = (q5 * 9.7) % 1, bt = bladeTone(pv, H(960 + tf)), acc = bt.acc;
      const len = (0.09 + 0.34 * q3 * q3) * tsz[tf] * (lead ? 1.5 : 1) * (acc ? 1.2 : 1), wid = 0.020 + 0.018 * q4;
      // most are close to the ground's own value (a little richer, or a little paler: the
      // sunlit and the dry); one in seven is a darker accent, and only those are left crisp
      const L = st.leafB, c = L ? L[bt.i] : null, gm = acc ? Math.max(st.gmB, st.gm) * 0.73 : st.gmB;
      let cr = gr, cg = gg, cb = gb;
      if (c) { cr = lerp(c[0], gr, gm); cg = lerp(c[1], gg, gm); cb = lerp(c[2], gb, gm); }
      if (lead && tall > 0.3 && !acc) { const m = 0.5 * tall; cr = lerp(cr, SEED_HEAD[0], m); cg = lerp(cg, SEED_HEAD[1], m); cb = lerp(cb, SEED_HEAD[2], m); }
      const dk = bt.dk;
      this.put(Math.cos(ang) * rad + tu[tf], Math.sin(ang) * rad + tv[tf], 0, 0.08 + 0.85 * q4 * q4, (tf ? t3 : t4) * 6.2832 + (q2 - 0.5) * 1.5, len, wid, acc && (k < 2 || q2 < 0.3) ? 3 : 2, q3 * 0.61 + q1 * 0.39, born,
        dens(cr, dk), dens(cg, dk), dens(cb, dk), (q5 - 0.5) * 1.5 + (q1 - 0.5) * 0.5, 1);
    }
    left -= nBlade;
    for (let k = 0; k < others.length && left > 0; k++, left--) {
      const kind = others[k];
      const q1 = H(150 + k), q2 = H(160 + k), q3 = H(170 + k), q4 = H(180 + k), q5 = H(190 + k);
      if ((kind === 2) && nTuft === 0) continue;
      const tf = nTuft === 2 ? (k & 1) : 0, inT = kind === 2;
      const ang = q1 * 6.2832, rad = kind === 2 ? 0.02 + 0.13 * q2 : kind === 1 ? (q2 < 0.75 ? 0.04 + 0.30 * q2 : 0.2 + 0.4 * q2) : 0.06 + 0.42 * Math.sqrt(q2);
      const ou = Math.cos(ang) * rad + (inT ? tu[tf] : 0), ov = Math.sin(ang) * rad + (inT ? tv[tf] : 0);
      let len, wid, mid, curl = 0, tilt = 0, flex = 0, cr, cg, cb;
      if (kind === 1) {     // reed stubble
        len = 0.45 + 0.55 * q3; wid = 0.024 + 0.012 * q4; mid = 0.86; curl = (q5 - 0.5) * 0.25; tilt = 0.04 + 0.16 * q4; flex = 0.7;
        const c = st.leaf ? st.leaf[1] : [gr, gg, gb];
        cr = dens(lerp(c[0], gr, 0.45), 1.3); cg = dens(lerp(c[1], gg, 0.45), 1.3); cb = dens(lerp(c[2], gb, 0.45), 1.3);
      } else if (kind === 2) {     // frost needles, crystal splinters: half catch the light, half are its shadow
        // (splinters stand in clusters, like the tufts: a few from one root, unequal, one of them tall)
        len = (0.06 + 0.26 * q3 * q3) * (0.55 + 1.0 * t3 * t3) * (k < 2 && q3 > 0.4 ? 1.6 : 1); wid = 0.026 + 0.020 * q4; mid = q5 > 0.8 ? 3 : 2; tilt = 0.85 * q4 * q4;
        const c = st.shard ? st.shard[q5 < 0.5 ? 0 : st.shard.length - 1] : null;
        if (c && c.length === 3) { cr = c[0]; cg = c[1]; cb = c[2]; }
        else if (q5 < 0.5) { cr = lerp(gr, 0.95, 0.6); cg = lerp(gg, 0.97, 0.6); cb = lerp(gb, 1.0, 0.6); }
        else { cr = dens(gr, 1.7) * 0.93; cg = dens(gg, 1.7) * 0.95; cb = dens(gb, 1.7); }
      } else if (kind === 5) {     // crust: a flat touch lying on the ground, one of the patch's own kind, ragged, unequal
        const cc = st.crustC, c = cc[Math.min(cc.length - 1, Math.floor((this.which * 0.75 + q5 * 0.25) * cc.length * 0.999))], m = 0.18 + 0.30 * q1;
        this.put(ou * 0.8, ov * 0.8, 0.012, 0, 0, 0.04 + 0.24 * q3 * q3, 0.02 + 0.10 * q4 * q4 + 0.02, LYING + (q5 > 0.8 ? CRISP : 0), q3, born, lerp(c[0], gr, m), lerp(c[1], gg, m), lerp(c[2], gb, m), q2 * 6.2832, 0);
        continue;
      } else if (kind === 4) {     // a drift ripple: a low dark comma on the sand
        len = 0.022 + 0.02 * q3; wid = 0.20 + 0.26 * q4; mid = 0.9;
        cr = dens(gr, 1.45); cg = dens(gg, 1.45); cb = dens(gb, 1.5);
      } else {                     // a pebble: a squat dab, darker than its ground
        len = 0.035 + 0.065 * q3; wid = 0.06 + 0.09 * q4; mid = 0.93;
        const c = st.rock ? st.rock[q5 < 0.4 ? 0 : 1] : null;
        if (c) { const sc = stoneC(c, gr, gg, gb, 0.5, _stc); cr = sc[0]; cg = sc[1]; cb = sc[2]; } else { const k2 = 1.3 + 0.8 * q5; cr = dens(gr, k2); cg = dens(gg, k2); cb = dens(gb, k2 + 0.1); }
      }
      this.put(ou, ov, 0, tilt, q2 * 6.2832 + 1.7, len, wid, mid, q3 * 0.61 + q1 * 0.39, born, cr, cg, cb, curl, flex);
    }
  }

  // ---- F2, flowers as plants: one to several heads on a forking stalk, a leaf at the foot, in drifts from the map ----
  // `area` the cell's ground (m2), `room` how many marks it may take. Returns how many it took.
  layBlooms(i, j, born, area, room) {
    if (room < 2) return 0;
    const seed = this.seed, H = (k) => hash3i(i, j, k, seed);
    // (the look director, 24 Nov: "mix kinds, leave gaps of grass between clumps". A cell is a clump of ONE kind, the
    // runner-up's where the map says two drifts run together; and one cell in three in a drift is grass, the clumps in
    // the others a third fuller, so the drift's plants a square metre are what they were)
    // THE YEAR TURNING (the coordinator's ruling, 24 Nov: no place flowerless near the eye in any season): a cell holds the
    // clump the map gives it in summer AND the one it gives in autumn, each with its half of the year as its window, so
    // the vertex shader fades one out as the other comes in (materials.js NEAR_VERT; stalks and leaves too) and nothing is
    // ever laid again or seams. Held still (?season=) or not followed (?bloomyear=0), one clump as the map says now.
    const groups = this.bloomGroups(this.bg || (this.bg = []));
    if (!groups.length) return 0;
    const t = H(523);
    if (groups.length === 1) return t < 0.33 ? 0 : this.layBloomClump(i, j, born, area, room, groups[0].o, groups[0].win, H);
    // (two clumps: a third of the cells hold the summer one, a third the autumn one, a third both, the room shared; so in
    // either half of the year two cells in three flower, as with one clump and its third of gaps, and each season's gaps
    // are the other season's cells. COUNTED 24 Nov with the year moved to 0.85 in a page: laid one after the other, the
    // summer clump took the whole room and the autumn bank was all but bare.)
    const useS = t < 0.667, useA = t >= 0.333, H2 = (k) => H(k + 1000);
    let used = 0;
    if (useS) used += this.layBloomClump(i, j, born, area, useA ? room >> 1 : room, groups[0].o, groups[0].win, H);
    if (useA) used += this.layBloomClump(i, j, born, area, room - used, groups[1].o, groups[1].win, H2);
    return used;
  }
  // the clumps a cell holds: [{ o: bloomAt's answer, win: [from, to] or null (the kind's own) }]
  bloomGroups(out) {
    out.length = 0;
    const s = this.s, mk = (k) => this[k] || (this[k] = { kind: -1, bloom: null, dens: 0, heart: 0 });
    const sw = bloomSwitches();
    if (!sw.year || SEASON.held) {
      const o = bloomAt(this.S, this.x, this.y, this.z, s, this.bi, mk('bo'));
      if (o.kind >= 0 && o.dens >= 0.01) out.push({ o, win: null });
      return out;
    }
    const oS = bloomAt(this.S, this.x, this.y, this.z, s, this.bi, mk('boS'), 0.15);
    const oA = bloomAt(this.S, this.x, this.y, this.z, s, this.bi, mk('boA'), 0.85);
    const okS = oS.kind >= 0 && oS.dens >= 0.01, okA = oA.kind >= 0 && oA.dens >= 0.01;
    if (okS && okA && oS.bloom === oA.bloom && oS.bloom2 === oA.bloom2) { out.push({ o: oS, win: null }); return out; }
    // the hand-over between the two: half way from where the autumn kind comes in to where the summer kind is over
    const se = okS && oS.bloom.season ? oS.bloom.season[1] : 1, as = okA && oA.bloom.season ? oA.bloom.season[0] : 0;
    const m = Math.max(2 / 7, Math.min(5 / 7, (se + as) / 2));
    if (okS) out.push({ o: oS, win: [oS.bloom.season ? oS.bloom.season[0] : 0, m] });
    if (okA) out.push({ o: oA, win: [m, oA.bloom.season ? oA.bloom.season[1] : 1] });
    return out;
  }
  layBloomClump(i, j, born, area, room, o, win, H) {
    if (room < 2) return 0;
    const st = this.st, s = this.s;
    const b = (o.bloom2 && H(524) < o.mix) ? o.bloom2 : o.bloom, sh = SHAPES[b.shape] || (DAB + CRISP), C = this.cfg.cell;
    const want = o.dens * (b.peak || 8) * area * 1.5;
    let nP = Math.floor(want) + (H(500) < want - Math.floor(want) ? 1 : 0);
    if (nP <= 0) return 0;
    const gr = s.r, gg = s.g, gb = s.b, tall = sstep(0.52, 0.74, this.rough);
    const lc = st.leafB ? st.leafB[1] : (st.leaf ? st.leaf[1] : [gr, gg, gb]);
    const sc0 = lerp(lc[0], gr, 0.35), sc1 = lerp(lc[1], gg, 0.35), sc2 = lerp(lc[2], gb, 0.35);
    // (a cell's plants stand together in one tuft, a third of the cell across, and not spread evenly over it: a clump of
    // ox-eyes, a poppy with its buds round it)
    const cu = (H(520) - 0.5) * C * 0.5, cv = (H(521) - 0.5) * C * 0.5;
    const yr = win ? packWin(win) : packYear(b), tone = (b.eye ? packTone(b.eye) : 0) + yr;
    let used = 0;
    for (let p = 0; p < nP && used < room - 1; p++) {
      const q1 = H(510 + p), q2 = H(530 + p), q3 = H(550 + p), q4 = H(570 + p), q5 = H(590 + p);
      const ou = cu + (q1 - 0.5) * C * 0.42, ov = cv + (q2 - 0.5) * C * 0.42, la = q4 * 6.2832, tilt = 0.04 + 0.16 * q5;
      const jit = 0.93 + 0.14 * q3, cr = b.c[0] * jit, cg = b.c[1] * jit, cb = b.c[2] * jit;
      if (sh === SHAPES.cushion) {
        // a low dome of leaves with its flowers on top: one mark (its leaves the mark's colour, its flowers its second)
        const r0 = (b.head[0] + (b.head[1] - b.head[0]) * q3) * 1.3, bc = b.body || lc;
        // (the look director on the final set: the thrift "read as dark green buns with a pink rim": its leaves grey-green,
        // one colour, and the flowers ON TOP as small dabs; ?grass2=0 / ?flora=old keeps the cushion as it was)
        const top = FLORA.grass2;
        this.put(ou, ov, 0, 0.05 * q5, la, r0 * 1.4, r0, SHAPES.cushion, q1 * 0.61 + q2 * 0.39, born, bc[0], bc[1], bc[2], 0, 0.3, (top ? packTone(bc) : packTone(b.c)) + yr);
        used++;
        if (top) {
          const nf = 3 + Math.floor(q4 * 4);
          for (let f = 0; f < nf && used < room; f++) {
            const qa = H(700 + p * 9 + f), qb = H(720 + p * 9 + f), an = qa * 6.2832, rr = Math.sqrt(qb) * r0 * 0.55;
            const hr = 0.010 + 0.006 * H(740 + p * 9 + f);
            this.put(ou + Math.cos(an) * rr, ov + Math.sin(an) * rr, 0, 0, 0, hr * 2, hr, DAB + CRISP, qa, born, b.c[0], b.c[1], b.c[2], r0 * (0.75 - 0.5 * (rr / r0) * (rr / r0)), 0.3, yr);
            used++;
          }
        }
        continue;
      }
      const L = (b.stalk[0] + (b.stalk[1] - b.stalk[0]) * q3) * (1.15 + 0.25 * tall);
      // the stalk, and one short leaf at its foot when there is room
      this.put(ou, ov, 0, tilt, la, L, 0.010 + 0.004 * q5, FLICK, q3, born, sc0, sc1, sc2, (q5 - 0.5) * 0.3, 1, win ? yr : 0); used++;
      if (used < room - 2 && q4 > 0.35) { this.put(ou, ov, 0, 0.55 + 0.3 * q1, la + 2.1, 0.06 + 0.07 * q2, 0.014, FLICK, q2, born, sc0 * 0.92, sc1 * 0.92, sc2 * 0.92, 0.3, 1, win ? yr : 0); used++; }
      const nh = Math.max(1, Math.round(b.heads[0] + (b.heads[1] - b.heads[0]) * q2));
      for (let h = 0; h < nh && used < room; h++) {
        const qh = H(610 + p * 7 + h), r0 = (b.head[0] + (b.head[1] - b.head[0]) * qh) * (h > 0 && sh !== SHAPES.bell ? 0.85 : 1) * (sh === SHAPES.spike ? 1.3 : BLOOM_HEAD);
        // heads on a forking stalk: the first at the top, the others lower and a little out to the side; bells hang
        // along the upper half of a nodding stalk; a spike is one tall head at the top
        const hu = (qh - 0.5) * 0.06 * (h > 0 ? 1 : 0), hv = (H(640 + p * 7 + h) - 0.5) * 0.06 * (h > 0 ? 1 : 0);
        if (sh === SHAPES.spike) {
          this.put(ou, ov, 0, tilt, la, r0, 0.018 + 0.012 * qh, SHAPES.spike, qh, born, cr, cg, cb, Math.max(0.05, L - r0 * 0.85), 1, tone);
        } else {
          const held = sh === SHAPES.bell ? L * (0.55 + 0.42 * (1 - h / nh)) - r0 * 2 : L * (1 - 0.22 * h) - r0;
          this.put(ou + hu, ov + hv, 0, tilt, la, r0 * 2, r0, sh, qh, born, cr, cg, cb, Math.max(0.02, held), 1, tone);
        }
        used++;
      }
    }
    return used;
  }

  // ---- G2, the carpet: tufts of single blades near the feet, three times the fine ring's a square metre ----
  // The blades are the fine ring's own (the same lengths, widths, leans, curls and colours: layFine's grass below), laid in
  // one to three tufts a cell; there are no stones, leaves or flowers here, which the fine ring lays.
  layCarpet(i, j, born) {
    const st = this.st, s = this.s, seed = this.seed, per = this.cfg.per;
    if (!(st.blade > 0)) return;
    const gr = s.r, gg = s.g, gb = s.b, H = (k) => hash3i(i, j, k, seed);
    const tall = sstep(0.52, 0.74, this.rough);
    const bedK = st.reed > 0 ? 0.3 + 0.7 * Math.min(1, this.reedy) : 1;
    // (the fine ring lays st.blade x 11 x meadow x (0.7 + 0.5 rough) in a cell of 0.36 m2 with a tuft in five cells of six;
    // 16 in a cell of 0.2025 m2 is three times that a square metre)
    const want = st.blade * 16 * st.carpet * this.meadow * (0.7 + 0.5 * this.rough) * bedK;
    const n = Math.min(per, Math.floor(want) + (H(300) < want - Math.floor(want) ? 1 : 0));
    if (n <= 0) return;
    const nT = n <= 7 ? 1 : n <= 15 ? 2 : 3, C = this.cfg.cell;
    const tu = [], tv = [], tsz = [], tl = [];
    for (let t = 0; t < nT; t++) {
      tu.push((H(301 + t) - 0.5) * C * 0.8); tv.push((H(305 + t) - 0.5) * C * 0.8);
      const z = H(309 + t); tsz.push((0.55 + 1.0 * z * z) * (1 + 0.45 * tall)); tl.push(H(313 + t) * 6.2832);
    }
    for (let k = 0; k < n; k++) {
      const q1 = H(320 + k), q2 = H(345 + k), q3 = H(370 + k), q4 = H(395 + k), q5 = H(420 + k);
      const tf = k % nT;
      const ang = q1 * 6.2832, rad = 0.015 + 0.075 * q2;
      const lead = k < nT * 2 && q3 > 0.45;
      const pv = (q5 * 9.7) % 1, bt = bladeTone(pv, H(970 + tf)), acc = bt.acc;
      const len = (0.09 + 0.34 * q3 * q3) * tsz[tf] * (lead ? 1.5 : 1) * (acc ? 1.2 : 1), wid = 0.020 + 0.018 * q4;
      const L = st.leafB, c = L ? L[bt.i] : null, gm = acc ? Math.max(st.gmB, st.gm) * 0.73 : st.gmB;
      let cr = gr, cg = gg, cb = gb;
      if (c) { cr = lerp(c[0], gr, gm); cg = lerp(c[1], gg, gm); cb = lerp(c[2], gb, gm); }
      if (lead && tall > 0.3 && !acc) { const m = 0.5 * tall; cr = lerp(cr, SEED_HEAD[0], m); cg = lerp(cg, SEED_HEAD[1], m); cb = lerp(cb, SEED_HEAD[2], m); }
      const dk = bt.dk;
      this.put(Math.cos(ang) * rad + tu[tf], Math.sin(ang) * rad + tv[tf], 0, 0.08 + 0.85 * q4 * q4, tl[tf] + (q2 - 0.5) * 1.5, len, wid, acc && (k < 2 || q2 < 0.3) ? 3 : 2, q3 * 0.61 + q1 * 0.39, born,
        dens(cr, dk), dens(cg, dk), dens(cb, dk), (q5 - 0.5) * 1.5 + (q1 - 0.5) * 0.5, 1);
    }
  }

  // ---- farther off: fan-brush touches, dashes of colour, stones ----
  layBroad(i, j, born) {
    const st = this.st, s = this.s, seed = this.seed, cfg = this.cfg, per = cfg.per, far = cfg.name === 'far';
    const gr = s.r, gg = s.g, gb = s.b, canopy = this.canopy, shore = this.shore, C = cfg.cell;
    const H = (k) => hash3i(i, j, k, seed);
    const kw = far ? 2.7 : 1, kh = far ? 1.55 : 1;         // far touches are broader, a little taller
    const tall = sstep(0.52, 0.74, this.rough);
    const flex = far ? 0 : 0.6;
    let left = per, k = 0;
    const at = (q1, q2) => [(q1 - 0.5) * C * 0.92, (q2 - 0.5) * C * 0.92];
    // a drift of flowers: dashes of the flower's colour at the height of the sward
    // (F3, the flora lane: where the biome has blooms of its own the drift is laid from the map as round touches of its
    // colour, as many as its heart says, and a spike as a taller one; the horizontal dashes read as white and red lines)
    const blooming = FLORA.bloom && !cfg.vista && hasBlooms(this.S, this.bi);
    if (blooming) {
      // (the year turning: the summer drift's touches and the autumn drift's, each in its half of the year, as the near ring)
      const groups = this.bloomGroups(this.bg || (this.bg = []));
      // (two groups: as the near ring, a third of the cells the summer drift's, a third the autumn's, a third both)
      const ty = H(126), two2 = groups.length === 2, cap0 = left - 1;
      for (let gi = 0; gi < groups.length; gi++) {
      const o = groups[gi].o, win = groups[gi].win, ho = gi * 41;
      if (two2 && (gi === 0 ? ty >= 0.667 : ty < 0.333)) continue;
      const cap = two2 && ty >= 0.333 && ty < 0.667 ? cap0 >> 1 : left - 1;
      if (o.kind >= 0 && o.dens > 0.03 && left > 1) {
        const b = o.bloom, sh = SHAPES[b.shape] || 0, v = o.dens * (far ? 10 : 9) * (two2 ? 1.5 : 1), yr = win ? packWin(win) : packYear(b), tone = (b.eye ? packTone(b.eye) : 0) + yr;
        const nf = Math.min(cap, left - 1, Math.floor(v) + (H(100 + ho) < v - Math.floor(v) ? 1 : 0));
        // (the look director on the final set: past the near ring "the heads are many tiny dots of every colour side by
        // side, which starts to read as confetti; let each drift keep to one or two kinds at that distance": the runner-up
        // takes a fifth of the share it takes near the eye; and from the far ring a white head is held a step under the
        // meadow's lightest grass, as at 150 m pale flecks read as the paper)
        const b1 = b, sh1 = sh, tone1 = tone, B2 = o.bloom2, mx2 = o.mix * 0.2;
        // THE DRIFT AS ONE PATCH (the look director's audit 2, ?driftpatch=0 off): past 15 m the heads were many
        // floor-sized dots side by side, the same 4-5 px dot for every flower, an even rain of dots where the references
        // show pools of colour with dots scattered round them. So where the drift is thick (its heart), the cell lays one
        // to three touches in the drift's colour, standing in the sward and facing the eye, gathered round one centre so
        // that the cell's flowers are one pool, as many and as broad as the cell's COVER says (the thing, not the
        // pixel), with two heads (one in the far ring) left over them; where it is thin (its edge) the heads stay
        // scattered as before. The touches are kept small (about 0.5-0.7 m across in the middle ring, 2-3 m in the far):
        // MEASURED (Node, the meadow on foot) touches sized to fill the cell painted 36 per cent more of the picture
        // and, at 10 m, were blobs some 70 px across. The cell's room the heads give up goes to its grass.
        let nh = nf;
        if (FLORA.patch && nf >= 2) {
          const cov = Math.min(1, o.dens * (two2 ? 1.5 : 1));
          if (cov > 0.22) {
            const np = Math.min(nf - 1, far ? (cov > 0.5 ? 2 : 1) : (cov > 0.6 ? 3 : cov > 0.38 ? 2 : 1));
            const pc = b1.c, wj = far && Math.max(pc[0], pc[1], pc[2]) - Math.min(pc[0], pc[1], pc[2]) < 0.25 * Math.max(pc[0], pc[1], pc[2]) ? 0.8 : 1;
            const st0 = b1.stalk ? 0.5 * (b1.stalk[0] + b1.stalk[1]) : 0.2;
            const c0 = at(0.3 + 0.4 * H(918 + ho), 0.3 + 0.4 * H(919 + ho)), dw0 = far ? 0.8 + 0.8 * cov : 0.22 + 0.14 * cov;
            for (let q = 0; q < np; q++, k++) {
              const q1 = H(900 + q + ho), q2 = H(906 + q + ho), q3 = H(912 + q + ho);
              const dw = dw0 * (0.85 + 0.3 * q3), jit = (0.94 + 0.12 * q2) * wj;
              const p = np === 1 ? c0 : [c0[0] + (q1 - 0.5) * 2.4 * dw0, c0[1] + (q2 - 0.5) * 1.8 * dw0];
              this.put(p[0], p[1], 0, 0, 0, dw * (0.45 + 0.15 * q1) * kh, dw, PATCH, q3, born, pc[0] * jit, pc[1] * jit, pc[2] * jit, st0 * 0.3, flex * 0.5, tone1);
            }
            left -= np;
            nh = Math.min(nf - np, far ? 1 : 2);
          }
        }
        for (let q = 0; q < nh; q++, k++) {
          const q1 = H(102 + q + ho), q2 = H(106 + q + ho), q3 = H(110 + q + ho), p = at(q1, q2);
          let jit = 0.94 + 0.12 * q2;
          // (some touches are the runner-up drift's, as in the near ring)
          const two = B2 && H(114 + q + ho) < mx2, b = two ? B2 : b1, sh = two ? (SHAPES[B2.shape] || 0) : sh1;
          const tone = two ? (B2.eye ? packTone(B2.eye) : 0) + (win ? yr : packYear(B2)) : tone1;
          const st0 = b.stalk ? b.stalk[0] + (b.stalk[1] - b.stalk[0]) * q3 : 0.2;
          if (far) { const mxc = Math.max(b.c[0], b.c[1], b.c[2]), mnc = Math.min(b.c[0], b.c[1], b.c[2]); if (mxc - mnc < 0.25 * mxc) jit *= 0.8; }
          if (sh === SHAPES.cushion) {
            const r0 = (b.head[0] + (b.head[1] - b.head[0]) * q1) * 1.3 * kw, bc = b.body || b.c;
            this.put(p[0], p[1], 0, 0, 0, r0 * 1.4, r0, SHAPES.cushion, q3, born, bc[0], bc[1], bc[2], 0, 0, packTone(b.c) + (win ? yr : packYear(b)));
          } else if (sh === SHAPES.spike) {
            const hh = (b.head[0] + (b.head[1] - b.head[0]) * q1) * kh;
            this.put(p[0], p[1], 0, 0, 0, hh, 0.035 * kw, sh, q3, born, b.c[0] * jit, b.c[1] * jit, b.c[2] * jit, Math.max(0, st0 - hh * 0.8) * kh, flex, tone);
          } else {
            // (the near ring's own head, drawn by the same shader, so a drift is the same flowers from 2 m to 60 m: SEEN 24 Nov,
            // from 10 m up the near ring's flowers are past their 12 m and these round touches were one or two pixels, and a
            // drift was only the ground's tint, which for a red flower on green is a rust brown; the head's floor of a few
            // pixels, materials.js NEAR_VERT, keeps each a dot of the flower's colour)
            const r0 = (0.035 + 0.035 * q1) * kw;
            this.put(p[0], p[1], 0, 0, 0, r0 * 2, r0, sh || (DAB + CRISP), q3, born, b.c[0] * jit, b.c[1] * jit, b.c[2] * jit, st0 * 0.85 * kh, flex, tone);
          }
        }
        left -= nh;
      }
      }
    }
    const fl = !blooming && st.flower > 0 && st.flowers ? st.flower * sstep(0.50, 0.70, this.drift) * this.meadow * (1 - 0.6 * canopy) : 0;
    if (fl > 0.04) {
      const nf = Math.min(left - 1, 1 + (H(100) < fl * 1.5 ? 1 : 0) + (far && H(101) < fl ? 1 : 0));
      const fc = st.flowers[Math.min(st.flowers.length - 1, Math.floor(this.which * st.flowers.length * 0.999))];
      for (let q = 0; q < nf; q++, k++) {
        const q1 = H(102 + q), q2 = H(106 + q), q3 = H(110 + q), p = at(q1, q2), m = far ? 0.25 : 0.1;
        this.put(p[0], p[1], (0.12 + 0.16 * q3) * (1 + 0.5 * tall) * kh, 0, 0, (0.035 + 0.035 * q3) * kh * Math.min(1.6, st.flowerSize), (0.10 + 0.22 * q1) * kw * Math.min(1.6, st.flowerSize), DAB, q3, born, lerp(fc[0], gr, m), lerp(fc[1], gg, m), lerp(fc[2], gb, m), 0, flex);
      }
      left -= nf;
    }
    // under the trees: fronds of fern, and the fallen leaves as dashes of sienna
    if (st.fern > 0 && canopy > 0.2 && st.bush) {
      const nfe = Math.min(left, (H(120) < st.fern * canopy * 2.2 ? 1 : 0) + (H(121) < st.fern * canopy ? 1 : 0));
      for (let q = 0; q < nfe; q++, k++) {
        const q1 = H(122 + q), q2 = H(125 + q), q3 = H(128 + q), p = at(q1, q2), c = st.bush[q3 < 0.3 ? 0 : q3 < 0.7 ? 1 : 2];
        this.put(p[0], p[1], 0, 0.1, q1 * 6.28, (0.34 + 0.34 * q3) * kh, (0.34 + 0.30 * q2) * kw, FAN, 0.5 + 0.5 * q3, born, lerp(c[0], gr, 0.4), lerp(c[1], gg, 0.4), lerp(c[2], gb, 0.4), (q2 - 0.5) * 0.3, flex);
      }
      left -= nfe;
    }
    if (st.litter > 0 && canopy > 0.2 && left > 0) {
      const nl = Math.min(left, H(130) < st.litter * canopy ? 2 : 1);
      for (let q = 0; q < nl; q++, k++) {
        const q1 = H(131 + q), q2 = H(134 + q), q3 = H(137 + q), p = at(q1, q2), c = st.litterC[q3 < 0.4 ? 0 : q3 < 0.78 ? 1 : 2], m = 0.42 + 0.2 * q2;
        this.put(p[0], p[1], 0, 0, 0, (0.03 + 0.03 * q3) * kh, (0.16 + 0.30 * q1) * kw, DAB, q3, born, lerp(c[0], gr, m), lerp(c[1], gg, m), lerp(c[2], gb, m), 0, 0);
      }
      left -= nl;
    }
    // stones: by the water, and wherever the ground is stony
    const nst = Math.min(left, (shore > 0.3 && st.rock ? 1 : 0) + Math.floor(st.dab * (far ? 2.2 : 3.0) * this.stony + H(140) * 0.9));
    for (let q = 0; q < nst; q++, k++) {
      const q1 = H(141 + q), q2 = H(145 + q), q3 = H(149 + q), q4 = H(153 + q), p = at(q1, q2);
      // (unequal: most are small, one in a while is a boulder; most are the pale stone with its
      // own shadow under it, one in four the dark one; all near the ground's value)
      const w = (0.05 + 0.42 * q3 * q3 * q3) * (far ? 2.2 : 1);
      const c = st.rock ? st.rock[q4 < 0.74 ? 0 : 1] : null, m = q4 < 0.74 ? 0.35 : 0.6;
      let cr, cg, cb;
      if (c) { const sc = stoneC(c, gr, gg, gb, m, _stc); cr = sc[0]; cg = sc[1]; cb = sc[2]; } else { const k2 = 1.15 + 0.5 * q4; cr = dens(gr, k2); cg = dens(gg, k2); cb = dens(gb, k2 + 0.1); }
      this.put(p[0], p[1], 0, 0, 0, w * (0.55 + 0.8 * q1), w, DAB + (q4 > 0.8 ? CRISP : 0), q3, born, cr, cg, cb, 0, 0);
    }
    left -= nst;
    // crust: broken drags of a second wash lying flat on the ground, longer and softer the farther
    // off (seen across a plain they are the horizontal strokes that give it its distance)
    if (st.crust > 0 && left > 0) {
      const ncr = Math.min(left, Math.round(st.crust * (far ? 3.2 : 4.2) * this.crusty + H(240) - 0.5));
      const cc = st.crustC;
      for (let q = 0; q < ncr; q++, k++) {
        const q1 = H(241 + q), q2 = H(245 + q), q3 = H(249 + q), q4 = H(253 + q), p = at(q1, q2);
        const c = cc[Math.min(cc.length - 1, Math.floor((this.which * 0.75 + q4 * 0.25) * cc.length * 0.999))], m = (far ? 0.42 : 0.30) + 0.25 * q3;
        this.put(p[0], p[1], 0.015, 0, 0, (0.14 + 0.5 * q3 * q3) * kw, (0.07 + 0.22 * q4 * q4) * kw, LYING, q3, born, lerp(c[0], gr, m), lerp(c[1], gg, m), lerp(c[2], gb, m), q2 * 6.2832, 0);
      }
      left -= ncr;
    }
    // drift ripples on dunes: long low dashes, darker than the sand
    // (short, unequal, soft: rows of long thin ones read as ruled dashes)
    const nrp = Math.min(left, Math.round(st.ripple * 3 + H(160) - 0.5));
    for (let q = 0; q < nrp; q++, k++) {
      const q1 = H(161 + q), q2 = H(165 + q), q3 = H(169 + q), p = at(q1, q2);
      this.put(p[0], p[1], 0, 0, 0, (0.03 + 0.04 * q3) * kh, (0.14 + 0.5 * q1 * q1) * kw, DAB, q3, born, dens(gr, 1.2), dens(gg, 1.2), dens(gb, 1.25), 0, 0);
    }
    left -= nrp;
    // splinters of frost and crystal: a cluster in one touch, lit or in its own shadow
    const nnd = Math.min(left, Math.round(st.needle * 4 * this.needly + H(170) - 0.5));
    for (let q = 0; q < nnd; q++, k++) {
      const q1 = H(171 + q), q2 = H(175 + q), q3 = H(179 + q), q5 = H(183 + q), p = at(q1, q2);
      const c = st.shard ? st.shard[q5 < 0.5 ? 0 : st.shard.length - 1] : null;
      let cr, cg, cb;
      if (c && c.length === 3) { cr = c[0]; cg = c[1]; cb = c[2]; }
      else if (q5 < 0.5) { cr = lerp(gr, 0.95, 0.6); cg = lerp(gg, 0.97, 0.6); cb = lerp(gb, 1.0, 0.6); }
      else { cr = dens(gr, 1.6) * 0.93; cg = dens(gg, 1.6) * 0.95; cb = dens(gb, 1.6); }
      this.put(p[0], p[1], 0, 0.25 * q2, q1 * 6.28, (0.16 + 0.38 * q3 * q3) * kh, (0.07 + 0.09 * q2) * kw, FAN + (q5 > 0.75 ? CRISP : 0), 0.05 + 0.2 * q3, born, cr, cg, cb, (q1 - 0.5) * 0.5, 0);
    }
    left -= nnd;
    // reeds by the water
    const nrd = Math.min(left, Math.round(st.reed * 3 * this.reedy + H(190) - 0.5));
    for (let q = 0; q < nrd; q++, k++) {
      const q1 = H(191 + q), q2 = H(194 + q), q3 = H(197 + q), p = at(q1, q2), c = st.leaf ? st.leaf[1] : [gr, gg, gb];
      this.put(p[0], p[1], 0, 0.1 * q2, q1 * 6.28, (0.5 + 0.5 * q3) * kh, (0.12 + 0.14 * q2) * kw, FAN, 0.3 + 0.3 * q3, born, dens(lerp(c[0], gr, 0.45), 1.3), dens(lerp(c[1], gg, 0.45), 1.3), dens(lerp(c[2], gb, 0.45), 1.3), (q1 - 0.5) * 0.3, flex);
    }
    left -= nrd;
    // the grass: clumps, each one touch of a fan brush; taller and gone to seed where it is rough
    if (st.blade > 0 && left > 0) {
      const ng = Math.min(left, Math.round(st.blade * per * this.meadow * (0.55 + 0.6 * this.rough) * (st.reed > 0 ? 0.3 + 0.7 * Math.min(1, this.reedy) : 1) + H(200) - 0.5));
      // (G3, the flora lane, ?grass2=0 off: a touch in the blades' own greens, narrower, and more upright)
      const L = st.leafB, g2 = FLORA.grass2, nw = g2 ? 0.6 : 1, nt = g2 ? 0.5 : 1;
      // (audit 2, ?tuft: from 10 to 40 m each touch picking its own of the three greens was the same speckle the blades
      // made nearer; now seven touches in ten take their cell's green, so the band reads in patches of a couple of metres,
      // with a value step between them)
      const vc = H(975), vcell = vc < 0.36 ? 2 : vc < 0.72 ? 1 : 0;
      // (audit 2, ?comb: the touches lean with the meadow's comb, the same slow wind as the far drags, grassTurn,
      // instead of every way, so from 20 to 60 m the grass has a direction)
      const cb0 = FLORA.comb ? this.combUV(H(976), _cuv) : null, cla = cb0 ? Math.atan2(cb0[1], cb0[0]) : 0;
      for (let q = 0; q < ng; q++, k++) {
        const q1 = H(201 + q), q2 = H(208 + q), q3 = H(215 + q), q4 = H(222 + q), q5 = H(229 + q), p = at(q1, q2);
        // the shaded side of a tuft, the sunlit one, the dry one: all near the ground's own value
        const v = FLORA.tuft && H(980 + q) < 0.7 ? vcell : q5 < 0.36 ? 2 : q5 < 0.72 ? 1 : 0, c = L ? L[v] : null, gm = v === 2 ? st.gmB - 0.02 : st.gmB;
        let cr = gr, cg = gg, cb = gb;
        if (c) { cr = lerp(c[0], gr, gm); cg = lerp(c[1], gg, gm); cb = lerp(c[2], gb, gm); }
        if (v === 0 && tall > 0.2) { const m = 0.55 * tall; cr = lerp(cr, SEED_HEAD[0], m); cg = lerp(cg, SEED_HEAD[1], m); cb = lerp(cb, SEED_HEAD[2], m); }
        const dk = (v === 2 ? 1.10 : v === 1 ? 1.04 : 0.86) * (FLORA.tuft ? 0.95 + 0.1 * q5 : 1);
        this.put(p[0], p[1], 0, cb0 ? 0.16 + 0.12 * q4 : 0.12 * q4 * nt, cb0 ? cla + (q3 - 0.5) * 0.5 : q3 * 6.28, (0.15 + 0.24 * q3) * (1 + 1.1 * tall) * kh, (0.13 + 0.20 * q4) * kw * nw, FAN, q3 * 0.61 + q1 * 0.39, born,
          dens(cr, dk), dens(cg, dk), dens(cb, dk), cb0 ? (q2 - 0.5) * 0.2 : (q2 - 0.5) * 0.5, flex);
      }
    }
  }

  // The turn (iCol.a) that lays a flat touch's long axis ALONG the land's contour here, jittered by `q`: a far
  // hillside is painted across its form, never up and down it, and a slope whose marks all ran downhill would
  // read as rain. Where the ground is level there is no contour and the turn is free.
  // (the shader builds a flat touch's own frame from the ground's normal -- materials.js NEAR_VERT, the `lying`
  //  branch: t1 = normalize(n x k) with k the constant below, t2 = n x t1, and the touch runs along
  //  t1*cos(a) + t2*sin(a). The contour is n x uphill, so the turn is that direction read on that frame.)
  // A3, THE GRASS'S COMB (the flora lane, docs/lead/FLORA-DESIGN.md 9.3; ?grass2=0 off): on level grass the far drags
  // are laid one way, as the wind combs a meadow, where they lay every way; the comb is a prevailing wind from the west
  // that wanders slowly (a fifth of a turn either way over a kilometre and a half), and on a slope the drags still run
  // along the contour (contourTurn), the two handed over by the slope, drag by drag. Seen from the air a meadow is
  // brushed in one direction and changes it as the land does.
  // the comb's direction on the ground here, read on the clump's own (u, v) frame (the lean `put` takes): the same
  // slow wind from the west as grassTurn, so the middle band's touches and the far drags are combed alike
  combUV(q, out) {
    const nx = this.nx, ny = this.ny, nz = this.nz, R = this.S.R;
    let ex = nz, ez = -nx; const l = Math.hypot(ex, ez);
    if (!(l > 1e-6)) { out[0] = 1; out[1] = 0; return out; }
    ex /= l; ez /= l;
    const wx = ny * ez, wy = nz * ex - nx * ez, wz = -ny * ex;                                   // north = n x east
    const w = 0.6 * this.S.nC.n3(this.x * R / 1500 + 3.1, this.y * R / 1500 - 7.7, this.z * R / 1500 + 1.3) + (q - 0.5) * 0.4;
    const cw = Math.cos(w), sw = Math.sin(w), dx = ex * cw + wx * sw, dy = wy * sw, dz = ez * cw + wz * sw;
    out[0] = dx * this.ux + dy * this.uy + dz * this.uz; out[1] = dx * this.vx + dy * this.vy + dz * this.vz;
    return out;
  }

  grassTurn(q, q2) {
    const steep = this.steep, k = sstep(0.08, 0.25, steep);
    if (q2 < k) return this.contourTurn(q);
    const nx = this.nx, ny = this.ny, nz = this.nz, R = this.S.R;
    // east on the ground here (as the gallery and the game frame it: Y x up), turned by the slow wander
    let ex = nz, ey = 0, ez = -nx;                                       // (0, 1, 0) x n
    let l = Math.hypot(ex, ey, ez); if (!(l > 1e-6)) return this.contourTurn(q);
    ex /= l; ey /= l; ez /= l;
    const wx = ny * ez - nz * ey, wy = nz * ex - nx * ez, wz = nx * ey - ny * ex;                 // north = n x east
    const w = 0.6 * this.S.nC.n3(this.x * R / 1500 + 3.1, this.y * R / 1500 - 7.7, this.z * R / 1500 + 1.3) + (q - 0.5) * 0.4;
    const dx = ex * Math.cos(w) + wx * Math.sin(w), dy = ey * Math.cos(w) + wy * Math.sin(w), dz = ez * Math.cos(w) + wz * Math.sin(w);
    // the same frame the shader builds a flat touch in (see contourTurn below)
    let t1x = ny * 0.4671 - nz * 0.8271, t1y = nz * 0.3126 - nx * 0.4671, t1z = nx * 0.8271 - ny * 0.3126;
    l = Math.hypot(t1x, t1y, t1z); if (!(l > 1e-7)) return this.contourTurn(q);
    t1x /= l; t1y /= l; t1z /= l;
    const t2x = ny * t1z - nz * t1y, t2y = nz * t1x - nx * t1z, t2z = nx * t1y - ny * t1x;
    return Math.atan2(dx * t2x + dy * t2y + dz * t2z, dx * t1x + dy * t1y + dz * t1z);
  }

  contourTurn(q) {
    const nx = this.nx, ny = this.ny, nz = this.nz, free = q * 6.2832;
    if (this.steep < 0.06) return free;
    const hx = this.ux * this.gu + this.vx * this.gv, hy = this.uy * this.gu + this.vy * this.gv, hz = this.uz * this.gu + this.vz * this.gv;
    let cx = ny * hz - nz * hy, cy = nz * hx - nx * hz, cz = nx * hy - ny * hx;
    let l = Math.hypot(cx, cy, cz);
    if (!(l > 1e-7)) return free;
    cx /= l; cy /= l; cz /= l;
    let t1x = ny * 0.4671 - nz * 0.8271, t1y = nz * 0.3126 - nx * 0.4671, t1z = nx * 0.8271 - ny * 0.3126;
    l = Math.hypot(t1x, t1y, t1z);
    if (!(l > 1e-7)) return free;
    t1x /= l; t1y /= l; t1z /= l;
    const t2x = ny * t1z - nz * t1y, t2y = nz * t1x - nx * t1z, t2z = nx * t1y - ny * t1x;
    // within a quarter turn either way, so the far ground is not combed
    return Math.atan2(cx * t2x + cy * t2y + cz * t2z, cx * t1x + cy * t1y + cz * t1z) + (q - 0.5) * 0.9;
  }

  // ---- THE FAR GROUND (?vista=): a coarse, broad hand for the land past 275 m ----
  // Only two kinds of mark are laid here: a touch lying on the ground (LYING, a pointed oval) and a squat dab
  // (DAB, a disc). The fan-brush touch the far ring lays its grass, reeds and splinters with is cut into a comb
  // of five to ten blades by the fragment shader (materials.js NEAR_FRAG) on a test that either keeps a pixel
  // or throws it away; at 275 m the whole touch is two to four pixels across, so each blade of that comb is a
  // fraction of a pixel and the mark would break into pepper -- the owner's first rule ("no grain") in the
  // other direction. An oval and a disc are one smooth edge each and survive the same reduction. Nothing
  // stands up out here either: a blade, a reed, a splinter is under a pixel wide at this distance whatever is
  // done to it.
  // The colours sit CLOSE to the ground's own (?vistaink= turns it): at 275 m what survives the air is a step of
  // VALUE and a lean of hue over a whole patch, and a mark that differs from its ground by a lot is a speck.
  layVista(i, j, born) {
    const st = this.st, s = this.s, seed = this.seed, cfg = this.cfg, C = cfg.cell;
    const gr = s.r, gg = s.g, gb = s.b, canopy = this.canopy;
    const H = (k) => hash3i(i, j, k, seed);
    const msz = (cfg.mark && cfg.mark[QUALITY.level]) || 1, ink = VISTA.ink;
    const at = (q1, q2) => [(q1 - 0.5) * C * 0.92, (q2 - 0.5) * C * 0.92];
    // A 13 m cell is twice the far ring's, and the ground's own plane -- all `put` has to go on -- is that much
    // worse an answer six metres out from the clump's anchor. MEASURED at Earth's alpine meadow: 29% of these
    // marks came out over a metre off the land and 6% over three metres, which at 275 m is a speck floating
    // seven pixels clear of the mountainside, exactly the kind of fault the owner is complaining about. So each
    // far mark asks the land for the height at its OWN place. It costs one more heightAt a mark (measured: the
    // ring's arrival goes from 61 to about 100 ms of script), and all of it falls inside the time slice.
    // (the mark's PLANE is still the clump's: re-deriving a normal would be two more heightAt a mark, and over a
    //  mark two to five metres across the tilt is worth about two pixels at 275 m)
    const onLand = (ou, ov, base) => {
      const S2 = this.S, h = this.s.h, r = S2.R + h;
      const bx = this.x * r + this.ux * ou + this.vx * ov, by = this.y * r + this.uy * ou + this.vy * ov, bz = this.z * r + this.uz * ou + this.vz * ov;
      const l = 1 / Math.hypot(bx, by, bz);
      return S2.heightAt(bx * l, by * l, bz * l) - h - ou * this.gu - ov * this.gv + 0.02 + base;
    };
    let left = 4;          // (cfg.per is 6: the pool is sized for six a cell so that it cannot run dry)
    // what lies flat and bare comes first: the crust of an ice world, the ripples of a dune, the companies of
    // splinters. Those worlds have no sward, so these marks are the whole of what carries their distance.
    if (st.crust > 0 && st.crustC && this.crusty > 0.1 && left > 0) {
      const n0 = Math.min(left, 1 + (H(300) < st.crust * this.crusty * 1.6 ? 1 : 0)), cc = st.crustC;
      for (let q = 0; q < n0; q++, left--) {
        const q1 = H(301 + q), q2 = H(305 + q), q3 = H(309 + q), q4 = H(313 + q), p = at(q1, q2);
        const c = cc[Math.min(cc.length - 1, Math.floor((this.which * 0.75 + q4 * 0.25) * cc.length * 0.999))], m = 1 - 0.30 * ink;
        this.put(p[0], p[1], onLand(p[0], p[1], 0.03), 0, 0, (0.40 + 0.45 * q3) * msz, (1.3 + 1.5 * q4) * msz, LYING, q3, born,
          lerp(c[0], gr, m), lerp(c[1], gg, m), lerp(c[2], gb, m), this.contourTurn(q2), 0);
      }
    }
    if (st.ripple > 0 && left > 0) {
      const n0 = Math.min(left, 1 + (H(320) < st.ripple * 1.4 ? 1 : 0));
      for (let q = 0; q < n0; q++, left--) {
        const q1 = H(321 + q), q2 = H(325 + q), q3 = H(329 + q), p = at(q1, q2), d = 1 + 0.22 * ink;
        this.put(p[0], p[1], onLand(p[0], p[1], 0.03), 0, 0, (0.28 + 0.26 * q3) * msz, (1.8 + 1.8 * q1) * msz, LYING, q3, born,
          dens(gr, d), dens(gg, d), dens(gb, d + 0.04), this.contourTurn(q2), 0);
      }
    }
    if (st.needle > 0 && this.needly > 0.15 && left > 0) {
      const n0 = Math.min(left, 1 + (H(340) < st.needle * this.needly ? 1 : 0));
      for (let q = 0; q < n0; q++, left--) {
        const q1 = H(341 + q), q2 = H(345 + q), q3 = H(349 + q), q5 = H(353 + q), p = at(q1, q2);
        const c = st.shard ? st.shard[q5 < 0.5 ? 0 : st.shard.length - 1] : null;
        let cr, cg, cb;
        if (c && c.length === 3) { const m = 1 - 0.55 * ink; cr = lerp(c[0], gr, m); cg = lerp(c[1], gg, m); cb = lerp(c[2], gb, m); }
        else if (q5 < 0.5) { cr = lerp(gr, 0.95, 0.30 * ink); cg = lerp(gg, 0.97, 0.30 * ink); cb = lerp(gb, 1.0, 0.30 * ink); }
        else { const d = 1 + 0.35 * ink; cr = dens(gr, d); cg = dens(gg, d); cb = dens(gb, d); }
        this.put(p[0], p[1], onLand(p[0], p[1], 0), 0, 0, (0.9 + 1.1 * q3) * msz, (0.5 + 0.7 * q2) * msz, DAB, q3, born, cr, cg, cb, 0, 0);
      }
    }
    // under the trees: the floor's fallen leaves as one broad drag of the litter colour
    if (st.litter > 0 && st.litterC && canopy > 0.2 && left > 0) {
      const n0 = Math.min(left, 1 + (H(360) < st.litter * canopy ? 1 : 0));
      for (let q = 0; q < n0; q++, left--) {
        const q1 = H(361 + q), q2 = H(365 + q), q3 = H(369 + q), q4 = H(373 + q), p = at(q1, q2);
        const c = st.litterC[q4 < 0.4 ? 0 : q4 < 0.78 ? 1 : 2], m = 1 - 0.34 * ink;
        this.put(p[0], p[1], onLand(p[0], p[1], 0.02), 0, 0, (0.45 + 0.40 * q3) * msz, (1.2 + 1.3 * q1) * msz, LYING, q3, born,
          lerp(c[0], gr, m), lerp(c[1], gg, m), lerp(c[2], gb, m), this.contourTurn(q2), 0);
      }
    }
    // the sward, as the mass it reads as from here: the shaded side of a slope's grass, the sunlit one, the dry
    // one, a step of value apart (the same three the far ring picks from, laid as one broad drag instead of a
    // fan of blades)
    if (st.blade > 0 && this.meadow > 0.15 && left > 0) {
      const n0 = Math.min(left, 1 + (H(380) < st.blade * this.meadow * 1.3 ? 1 : 0));
      const L = st.leaf, tall = sstep(0.52, 0.74, this.rough);
      // (A2, the flora lane, ?bloom=0 off: where the cell lies in a flower drift's heart, its first drag is the drift's
      // colour, held close to the ground's as these drags are (`?vistaink=`) but a step nearer the flower the deeper the
      // heart: from 40 to 190 m the drifts the near rings lay as plants are patches of their colour)
      let bo = null;
      if (FLORA.bloom && hasBlooms(this.S, this.bi)) {
        bo = bloomAt(this.S, this.x, this.y, this.z, s, this.bi, this.bo || (this.bo = { kind: -1, bloom: null, dens: 0, heart: 0 }));
        if (bo.kind < 0 || bo.dens < 0.3) bo = null;
      }
      for (let q = 0; q < n0; q++, left--) {
        const q1 = H(381 + q), q2 = H(385 + q), q3 = H(389 + q), q4 = H(393 + q), p = at(q1, q2);
        const v = q4 < 0.38 ? 2 : q4 < 0.74 ? 1 : 0, c = L ? L[v] : null, m = 1 - (1 - st.gm) * ink;
        let cr = gr, cg = gg, cb = gb;
        if (c) { cr = lerp(c[0], gr, m); cg = lerp(c[1], gg, m); cb = lerp(c[2], gb, m); }
        if (v === 0 && tall > 0.2) { const k2 = 0.45 * tall * ink; cr = lerp(cr, SEED_HEAD[0], k2); cg = lerp(cg, SEED_HEAD[1], k2); cb = lerp(cb, SEED_HEAD[2], k2); }
        let dk = v === 2 ? 1 + 0.14 * ink : v === 1 ? 1 : 1 - 0.12 * ink;
        if (bo && q === 0) { const fc = bo.bloom.c, mf = Math.min(0.8, (0.35 + 0.5 * bo.dens) * ink); cr = lerp(gr, fc[0], mf); cg = lerp(gg, fc[1], mf); cb = lerp(gb, fc[2], mf); dk = 1; }
        const turn = FLORA.grass2 ? this.grassTurn(q2, H(397 + q)) : this.contourTurn(q2);
        this.put(p[0], p[1], onLand(p[0], p[1], 0.02), 0, 0, (0.50 + 0.50 * q3) * msz, (1.5 + 1.4 * q1) * msz, LYING, q3, born,
          dens(cr, dk), dens(cg, dk), dens(cb, dk), turn, 0);
      }
    }
    // stones last, and only the ones that are there at all: at 275 m a stone under a metre is nothing, so these
    // are the boulders and the crags, not the pebbles the fine ring lays
    const nst = Math.min(left, (this.shore > 0.3 && st.rock ? 1 : 0) + (H(400) < st.dab * this.stony * 1.2 ? 1 : 0));
    for (let q = 0; q < nst; q++, left--) {
      const q1 = H(401 + q), q2 = H(405 + q), q3 = H(409 + q), q4 = H(413 + q), p = at(q1, q2);
      const w = (0.55 + 1.5 * q3 * q3) * msz;
      const c = st.rock ? st.rock[q4 < 0.74 ? 0 : 1] : null, m = 1 - (q4 < 0.74 ? 0.40 : 0.24) * ink;
      let cr, cg, cb;
      if (c) { cr = lerp(c[0], gr, m); cg = lerp(c[1], gg, m); cb = lerp(c[2], gb, m); }
      else { const k2 = 1 + (0.15 + 0.40 * q4) * ink; cr = dens(gr, k2); cg = dens(gg, k2); cb = dens(gb, k2 + 0.1); }
      this.put(p[0], p[1], onLand(p[0], p[1], 0), 0, 0, w * (0.6 + 0.7 * q1), w, DAB, q3, born, cr, cg, cb, 0, 0);
    }
  }
}

export class NearGround {
  constructor(bodyId, root, bu) {
    const S = getSurface(bodyId), look = getLook(bodyId);
    const styles = S.biomes.map((b) => styleOf(look, b));
    this.mesh = new THREE.Group(); this.mesh.name = 'near-' + bodyId;
    root.add(this.mesh);
    this.rings = RINGS.map((cfg) => new Ring(cfg, S, styles, this.mesh, bu, bodyId));
    this.lastQ = QUALITY.level;
    this.groundReady = null;         // (face, u, v) -> may strokes be laid round this place yet (set by the world)
  }
  get busy() { let n = 0; if (this.mesh.visible) for (const r of this.rings) n += r.busy; return n; }
  get pending() { let n = 0; if (this.mesh.visible) for (const r of this.rings) if (r.mesh.visible) n += r.pending.length; return n; }
  get triangles() { let n = 0; for (const r of this.rings) n += r.triangles; return n; }
  clear() { for (const r of this.rings) r.clear(); }

  // camLocal: the eye, body-local; alt: its height over the ground; sliceMs: time to build in
  update(camLocal, active, alt, sliceMs, dt, pixel) {
    if (!active) { for (const r of this.rings) r.hide(); return; }
    this.mesh.visible = true;
    if (QUALITY.level !== this.lastQ) { this.lastQ = QUALITY.level; this.clear(); }
    // (walking, a few cells come due each frame and the slice is never filled; after a landing or
    // a leap the whole sward is due and arrives nearest first over a few seconds, inside the slice)
    let left = sliceMs;
    for (const r of this.rings) left -= r.update(camLocal, alt, Math.max(0.15, left), dt, pixel, this.groundReady);
  }
}
