// Painted Cosmos: where the trees stand, as the ground is told it (group C, the far view). OWNER: PAINTER.
//
// THE CANOPY PAINTED INTO THE GROUND (the owner, 24 Nov: "things should look good far before I get there like when im
// flying high in the sky up to a mile I want trees from a distance to look good"). From a few hundred metres up the
// wood is one roof of crowns, and the 3D trees cannot carry that roof alone: each far tree is a few pixels from above
// and the floor between them showed as a loud yellow carpet ("pepper on mustard", the design, docs/lead/FARVIEW-
// DESIGN.md on r2). So the ground's own paint lays the crowns (render/farground.js), and for the painted roof to stand
// where the real trees stand, the ground must know, at every vertex, how many trees the placer keeps there and how
// many of them are needle trees. That is this file.
//
// IT READS THE PLACEMENT, IT DOES NOT CHANGE IT. world/floraplace.js placeTrees keeps a candidate tree when its own
// random number is under
//     0.62 * (0.14 + 0.86 * clump) * s.trees                         (a wood)
//     ... * min(1, 0.06 + 0.94 * 1.25 * groups)                      (outside the woods, where tall things stand in groups)
// and chooses its kind by the grove field. Every field and every number below is that function's, evaluated at the
// vertex instead of at a candidate. If the placer changes, this must change with it: src/world/farstand.test.mjs
// counts the placer's real trees against this function's prediction over many cells and fails when they part.
//
// What it hands back (0..1 each), packed by world/patchgen.js into two bytes nobody in the oil look read:
//   stand   the placer's own keep share over 0.62: 1 a closed wood (about 0.042 trees a square metre), 0 no trees
//   needle  of the trees kept here, the share that are needle trees (their crowns are drawn dark and narrow)
// ONLY ON A WORLD WHOSE CANOPY IS PAINTED (CANOPY_WORLDS) AND ONLY IN THE OIL LOOK WITH ?canopy= ON: everywhere else
// patchgen writes the bytes it always wrote, so the picture is the one it was to the bit.
import { smoothstep, clamp } from './noise.js';
import { NOLQ } from './surface.js';
import { MODE } from '../data/mode.js';
import * as BL from './bloom.js';

// ?canopy=0 takes the painted canopy out (patchgen packs nothing new, the ground's program is compiled without it).
// ?canopy=1, the default, lays it. Read once.
const _q = (() => { try { return new URLSearchParams(location.search); } catch (e) { return null; } })();
export const CANOPY = (() => { const v = _q && _q.has('canopy') ? +_q.get('canopy') : 1; return isFinite(v) ? Math.max(0, v) : 1; })();

// ?groundseason=0|1: the floor and the far colour follow the year (the far view's FV3, render/farground.js). 1, the
// default, lays it; 0 is the picture before it to the bit. Read once.
export const GROUND_SEASON = (() => { const v = _q && _q.has('groundseason') ? +_q.get('groundseason') : 1; return isFinite(v) && v > 0; })();
export function groundSeasonOn(bodyId) { return !!(MODE.oil && GROUND_SEASON && CANOPY_WORLDS[bodyId]); }

// ?rockfield=0|1: ROCK FACES, STRATA AND SNOW THAT READ FROM AFAR (the far view's FV4: render/farground.js ROCK_FRAG, and
// the snow shed off steep faces by patchgen.js). Read once.
export const ROCKFIELD = (() => { const v = _q && _q.has('rockfield') ? +_q.get('rockfield') : 0; return isFinite(v) && v > 0; })();
export function rockfieldOn(bodyId) { return !!(MODE.oil && ROCKFIELD && CANOPY_WORLDS[bodyId]); }

// ?bloomfar=1: THE FLOWER DRIFTS FROM THE AIR (FV6(b), with flora B: world/bloom.js writes each full sample's drift
// cover o.fd and its colour as an index into the world's 16-colour palette o.fi; the mesher packs them, the ground lays
// that share of its dabs in the flower's own colour, whole). The same switch as bloom.js's own (bloomSwitches().far),
// read here too because the ground's program is compiled before any world. Read once; off by default.
export const BLOOM_FAR = (() => { try { return new URLSearchParams(location.search).get('bloomfar') === '1'; } catch (e) { return false; } })();
// on for a world whose flowers bloom.js can hand over: the oil look, the switch, a palette with colours in it. (The
// namespace import: on a branch whose bloom.js has no palette yet this is simply off.)
export function bloomFarOn(S) {
  if (!MODE.oil || !BLOOM_FAR || typeof BL.bloomPalette !== 'function') return false;
  const p = BL.bloomPalette(S);
  return !!(p && p.count > 0);
}
export function bloomPaletteOf(S) { return typeof BL.bloomPalette === 'function' ? BL.bloomPalette(S) : null; }

// The worlds whose woods are roofs of round crowns seen from above. Earth only: the other worlds' tall things are
// crystals, spires, kelp, fungus and snow firs, which from the air are not crowns, and each would want its own look.
export const CANOPY_WORLDS = { earth: 1 };
export function canopyOn(bodyId) { return !!(MODE.oil && CANOPY > 0 && CANOPY_WORLDS[bodyId]); }

// The kits that are needle trees (their crowns from above are narrow dark stars, their colour does not turn).
export const NEEDLE = new Set(['conifer', 'spruce', 'tallpine']);

// The stand and the needle share at the unit direction (x, y, z), given the sample `s` the mesher has just taken
// there (S.sample(x, y, z, s, true): s.top, s.trees, s.birch, s.lq, s.h). out: [stand, needle]. Calls no S.sample.
export function standAt(S, x, y, z, s, out) {
  out[0] = 0; out[1] = 0;
  if (!(s.trees > 0)) return out;
  const bi = S.biomes[s.top];
  if (!bi || !bi.tall || !bi.tall.length) return out;
  if (!bi.tallWet && s.lq !== NOLQ && s.lq > s.h - 0.15) return out;
  const n3 = S.nC.n3, R = S.R, fc = R / 17, fd = R / 52, fg = R / 160;
  const clump = smoothstep(-0.30, 0.22, n3(x * fc + 3.3, y * fc - 8.1, z * fc + 1.7) + 0.45 * n3(x * fd - 5.0, y * fd, z * fd + 9.0));
  let keep = (0.14 + 0.86 * clump) * s.trees;
  if (bi.terrain !== 'forest' && (bi.tallD || 0) < 0.36) {
    const g = (0.06 + 0.94 * smoothstep(-0.30, 0.18, n3(x * fg - 4.0, y * fg + 13.0, z * fg + 7.0)) * 1.25);
    if (g < 1) keep *= g;
  }
  out[0] = clamp(keep, 0, 1);
  // the kind: the grove field picks the pair, the roll picks within it (floraplace.js, the same lines)
  const grove = n3(x * fd + 21.0, y * fd + 4.0, z * fd - 13.0);
  const np = bi.tall.length >> 1;
  const pr = np > 1 && grove > 0.45 ? Math.min(np - 1, 1 + Math.floor(((grove - 0.45) / 0.55) * (np - 1))) : 0;
  const tall = S.look.flora.tall, ta = bi.tall[pr * 2], tb = bi.tall[pr * 2 + 1];
  const pb = clamp(s.birch + grove * 0.55, ta === tb ? 1 : 0.04, ta === tb ? 1 : 0.97);
  const na = tall[ta] && NEEDLE.has(tall[ta].kit) ? 1 : 0, nb = tall[tb] && NEEDLE.has(tall[tb].kit) ? 1 : 0;
  out[1] = na * pb + nb * (1 - pb);
  return out;
}
