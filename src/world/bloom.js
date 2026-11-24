// Painted Cosmos: where the flowers bloom (pure JS: no three, no page; safe in Node). OWNER: PAINTER (the flora lane).
//
// THE ONE MAP OF WHERE FLOWERS GROW (2026-11-24, docs/lead/FLORA-DESIGN.md 5.1; the owner: "there should be flowers ...
// make sure it looks beautiful the flaura and the density of the grass and flowers"). Before this a flower stood only
// within 12 m of the eye, every place had the same four, and nothing of a drift was left past the near ring. Now every
// distance asks the same question of the same function, so a drift at the feet is the same drift as a patch of colour
// from 150 m and a tinted slope from a mile:
//   the near rings (world/nearground.js) lay flowers as plants where `dens` is high;
//   the middle ring lays the drift's colour as round touches;
//   the ground's own colour (world/surface.js, ONE call: bloomTint below) carries it to the horizon and from the air.
//
// What a biome says (its `oil.flora`, src/data/looks/<world>.js; the oil look only, the watercolour game never reads it):
//   blooms: [{ kind, shape, c, eye?, body?, head: [a, b], stalk: [a, b], heads: [a, b], drift, peak, share, hab, edge?,
//              sprinkle?, tint? }]
//     shape   'rayed' | 'cup' | 'bell' | 'spike' | 'froth' | 'cushion' (the near ring's head touches: materials.js NEAR_FRAG)
//     c       the flower's colour, MIXED FROM THE BIOME'S NAMED PIGMENTS in the look file (never a loose number: the rule
//             the animals' coats keep, LOOK-RULES R2.1); `eye` a second colour (a daisy's eye), `body` a cushion's leaves
//     head    the head's size (m): its radius; a spike's height
//     stalk   how high it is held (m); heads: how many on one plant
//     drift   the size of its patches (m); peak: plants a square metre at a drift's heart
//     share   how strongly it claims ground against the biome's other kinds; hab: where it grows (below)
//     tint    how strongly a drift colours the ground (default 0.5 of its cover)
//   hab: { canopy, wet, meadow, height, lip, rock }: each [a, b] is a ramp from a to b (a > b: falling), over
//     canopy  the closed-canopy share (0 open, 1 under the crowns)
//     wet     how near water: 1 at the bank, 0 from 22 m off (from the sample's distance to water, s.s)
//     meadow  the place's own undergrowth share (s.under)
//     height  metres above the sea; lip: on the lip of a cliff (s.lip); rock: rocky ground (s.rock)
//   sward: { gm, carpet, floor }: the grass package's dials (nearground.js reads gm and carpet; `floor` here: how much
//     darker the ground's near paint is under a dense sward, the sward's own shade at its roots)
import { MODE } from '../data/mode.js';

// THE SWITCHES (the oil look only; 1 by default, 0 gives the picture back as it was, to the bit):
//   ?bloom=0     no flowers from this map at all (the near rings lay their flowers as before, the ground is not tinted)
//   ?bloomair=0  the flowers, but not their colour in the ground (A1)
//   ?grass2=0    (read here too for the floor under the sward; nearground.js FLORA reads it for everything else)
// Read once, at the first call (MODE.oil is set by render/shared.js when it loads, which may be after this module is).
let SW = null;
export function bloomSwitches() {
  if (SW) return SW;
  const f = { bloom: 1, air: 1, grass2: 1 };
  try {
    const q = new URLSearchParams(location.search), on = (k) => !q.has(k) || (q.get(k) !== '0' && q.get(k) !== 'false');
    f.grass2 = on('grass2') ? 1 : 0;
    f.bloom = on('bloom') ? 1 : 0;
    f.air = f.bloom && on('bloomair') ? 1 : 0;
  } catch { /* no address to read (Node): everything on, if the look is */ }
  if (!MODE.oil) { f.bloom = 0; f.air = 0; f.grass2 = 0; }
  SW = f;
  return f;
}

export const SHAPES = { rayed: 7, cup: 8, bell: 9, spike: 10, froth: 11, cushion: 12 };

const ss = (a, b, x) => { if (a === b) return x >= b ? 1 : 0; const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const ramp = (r, x) => (r ? ss(r[0], r[1], x) : 1);

// a biome's blooms, laid out once (null: none)
const CACHE = new WeakMap();
function bloomsOf(S, bi) {
  let L = CACHE.get(S);
  if (!L) { L = S.biomes.map((b) => { const f = b.oil && b.oil.flora; return f && f.blooms && f.blooms.length ? f.blooms : null; }); CACHE.set(S, L); }
  return L[bi] || null;
}
// whether a biome has blooms of its own (the near rings then lay their flowers from this map and not their old way)
export function hasBlooms(S, bi) { return !!(bloomSwitches().bloom && bloomsOf(S, bi)); }
function swardOf(S, bi) {
  const b = S.biomes[bi], f = b && b.oil && b.oil.flora;
  return (f && f.sward) || null;
}

function habitat(h, s) {
  if (!h) return 1;
  // how wet: near a river or stream (the sample's distance to its water, s.s), or a little above standing water (a
  // pool's or a bog's level, s.lq: the misty wetland's pools are not in s.s at all)
  const lqOK = s.lq != null && s.lq > -1e8;
  const wet = Math.max(1 - ss(1.5, 22, s.s == null ? 1e9 : s.s), lqOK ? 1 - ss(0.05, 1.6, (s.h || 0) - s.lq) : 0);
  return ramp(h.canopy, Math.min(1, s.canopy || 0)) * ramp(h.wet, wet) * ramp(h.meadow, s.under || 0)
    * ramp(h.height, s.h || 0) * ramp(h.lip, s.lip || 0) * ramp(h.rock, Math.min(1, s.rock || 0));
}

// bloomAt(S, x, y, z, s, bi, out): x y z a unit direction on the body, s its FULL surface sample, bi a biome index.
// Writes out.kind (index into the biome's blooms, -1 none), out.bloom (that entry or null), out.dens (0..1, of its peak),
// out.heart (0..1, how deep into a drift). Returns out.
export function bloomAt(S, x, y, z, s, bi, out) {
  out.kind = -1; out.bloom = null; out.dens = 0; out.heart = 0;
  if (!bloomSwitches().bloom) return out;
  const B = bloomsOf(S, bi);
  if (!B) return out;
  if (s.lq !== undefined && s.h !== undefined && s.lq > s.h - 0.02) return out;      // (nothing blooms under water)
  const R = S.R, n3 = S.nC.n3, X = x * R, Y = y * R, Z = z * R;
  // whole slopes rich or poor in flower, at 150-600 m: what reads from a mile (SEEN, 24 Nov: at 0.35 to 1 the drifts lay
  // evenly everywhere and from 150 m nothing gathered into a patch; a poor slope now has a sprinkle, a rich one more than
  // its drifts' own peak)
  const rich = 0.15 + 1.15 * ss(-0.35, 0.45, n3(X / 430 + 11.3, Y / 430 - 4.1, Z / 430 + 7.7));
  // ... and inside a slope the flowers stand in PATCHES of 15 to 40 m with grass between, the same for every kind (SEEN,
  // the coordinator on the level meadow, 24 Nov: with each kind's drifts on their own noise, six kinds' drifts together
  // covered the whole meadow and the near flowers were an even confetti. A patch holds the drifts of two or three kinds
  // side by side, as the poppies beside the daisies in the old picture; between patches there is only a sprinkle.)
  const patch = 0.06 + 1.24 * ss(-0.12, 0.32, n3(X / 26 - 5.3, Y / 26 + 8.9, Z / 26 - 2.2));
  let best = -1, bd = 0, bh = 0;
  for (let k = 0; k < B.length; k++) {
    const b = B[k], hab = habitat(b.hab, s);
    if (hab <= 0.001) continue;
    const o = 17.3 * (k + 1), d = b.drift || 9;
    // a drift: one kind's clonal patch, dense at the heart and ragged at its edge (two octaves: the second roughens
    // the outline so it is never a blob)
    const n = n3(X / d + o, Y / d - o * 0.7, Z / d + o * 1.3) + 0.35 * n3(X / (d * 0.37) - o, Y / (d * 0.37) + o, Z / (d * 0.37) - 0.5 * o);
    const e = b.edge == null ? 0.05 : b.edge;
    // ... and drifts of one kind gather in colonies four times their own size, so from the air they are patches of 30 to
    // 50 m and not an even speckle
    const colony = ss(-0.25, 0.45, n3(X / (d * 4) - o * 1.9, Y / (d * 4) + o * 0.3, Z / (d * 4) + o));
    // (a drift's heart is solid, its edge a short ragged step: 0.30 of the noise where it was 0.45 and read as an even wash)
    const heart = ss(e, e + 0.30, n) * (0.30 + 0.90 * colony);
    const v = Math.max(heart, b.sprinkle == null ? 0.03 : b.sprinkle) * hab * (b.share == null ? 1 : b.share);
    if (v > bd) { bd = v; best = k; bh = heart; }
  }
  if (best < 0) return out;
  out.kind = best; out.bloom = B[best]; out.dens = Math.min(1, bd * rich * patch); out.heart = bh * Math.min(1, patch);
  return out;
}

// bloomTint(S, o, x, y, z, bi): ONE CALL at the end of Surface.sample (full samples only). Mixes the drift's colour into
// the ground's near paint (o.r..b) and its far colour (o.r2..b2) by its cover, and lays the sward's own shade into the
// near paint where the grass is dense (the dark between the blades: LOOK-RULES R3.1 keeps a blade one flat colour, so
// the dark roots are the ground's). Writes nothing else; with the look off or no data it returns at once.
const _bo = { kind: -1, bloom: null, dens: 0, heart: 0 };
export function bloomTint(S, o, x, y, z, bi) {
  const sw = bloomSwitches();
  if (!sw.air && !sw.grass2) return;
  if (sw.grass2) {
    const g = swardOf(S, bi);
    if (g && g.floor) {
      // (a step deeper in VALUE and a little quieter, not richer: LOOK-RULES R2.2 wants the darks deep and quiet, and a glaze
      // of the same colour -- tried first -- raised the saturation of the meadow's darks from 0.43 to 0.50 seen from 60 m)
      const k = g.floor * Math.min(1, o.under || 0) * (1 - 0.6 * Math.min(1, o.canopy || 0));
      if (k > 0) {
        const lum = o.r * 0.3 + o.g * 0.5 + o.b * 0.2, d = 1 - 0.6 * k, q = 1.6 * k;
        o.r = (o.r + (lum - o.r) * q) * d; o.g = (o.g + (lum - o.g) * q) * d; o.b = (o.b + (lum - o.b) * q) * d;
      }
    }
  }
  if (!sw.air) return;
  const r = bloomAt(S, x, y, z, o, bi, _bo);
  if (r.kind < 0 || r.dens < 0.02) return;
  const b = r.bloom, c = b.c;                      // (a cushion's c is its flowers' colour; its `body` is its leaves)
  // (SEEN, 24 Nov: at half of its cover a drift did not show from 10 m or 150 m at all. A drift's heart is solid colour from
  // the air -- a bluebell wood, a poppy field -- so its far colour goes most of the way, held at 0.7 so the ground's own
  // value structure stays under it; at the feet the flowers themselves stand there and the ground takes less.)
  const cover = r.dens * (b.tint == null ? 0.85 : b.tint);
  const kn = cover * 0.4, kf = Math.min(0.7, cover);
  o.r += (c[0] - o.r) * kn; o.g += (c[1] - o.g) * kn; o.b += (c[2] - o.b) * kn;
  o.r2 += (c[0] - o.r2) * kf; o.g2 += (c[1] - o.g2) * kf; o.b2 += (c[2] - o.b2) * kf;
}
