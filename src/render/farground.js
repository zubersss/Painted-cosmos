// Painted Cosmos: the ground seen from the air (group C, the far view). OWNER: PAINTER.
//
// THE CANOPY PAINTED INTO THE GROUND (FV2 of docs/lead/FARVIEW-DESIGN.md on r2). The owner, 24 Nov: "things should look
// good far before I get there like when im flying high in the sky up to a mile I want trees from a distance to look
// good". From a few hundred metres up a wood is ONE ROOF OF CROWNS -- the owner's twenty autumn woods from the air
// (docs/references/README.md on r2): "a whole country of round crowns, each tree one colour family ... lit on the sun's
// side and shaded cool on the other ... with its shadow lying on the grass beside it", dark conifers in groups among
// them, glades of grass between the stands. What the game drew there was a few-pixel speck for each far tree on a loud
// yellow floor of leaf dabs, and past the far trees' reach the floor alone.
//
// WHAT THIS DOES. The ground's leaf dabs carry the roof. Each dab of the ground (render/materials.js TERRAIN_FRAG, the
// oil look) asks, AT ITS OWN CENTRE, whether it lies on a crown of a painted canopy and where on it:
//   * a jittered grid of crowns, one cell of uCanK.x metres each (8 m), laid on the ground's own chart, so a crown stays
//     put as the eye moves; a cell holds a crown by the placer's own share of trees kept there (world/farstand.js: the
//     stand, a byte a vertex), so the roof is closed where the wood is dense, open at its edges, and absent in a glade;
//   * which kind: a needle tree by the placer's own needle share there (narrower, darker, its colour does not turn);
//   * the crown's colour: the far trees' own (uCanA/B/C/F, the season's mix, written each frame from the same look data
//     and the same rule flora.js uses for uFarA..uFarFam), each crown its own place on the family run (yellow, orange,
//     red) with the far tree's own split (four yellow, four orange, two red);
//   * its light: a LIT CAP slid toward the sun, the crown's body, its SHADED SIDE away from the sun, the SHADOW of a
//     taller neighbour, and between crowns the floor in deep under-canopy shade (or in sun, at an open stand's edge) --
//     and over all of it the hill's own light, so a wood on a slope turned from the sun is a shaded wood;
// and the dab is then painted ONE FLAT COLOUR in that colour and that light, through the shared pcTone. So a crown is a
// cluster of the ground's own small strokes, never a drawn disc, and nothing new is drawn: no draw call, no texture.
// WHERE THE CROWNS ARE SMALLER THAN A DAB (from about 400 m up the dabs are as big as a crown) the light is taken to the
// crown's mean, lit and shaded by the hill alone (a coin toss of light for each stroke would be the confetti the look
// rules forbid, R1.3c), while each dab keeps the colour of the crown its centre lies on: a patchwork of tree colours.
// WHEN IT IS LAID (all asked at the dab's own centre, so a crown's dabs come and go whole, never a soft fade):
//   * the eye looks DOWN on the place (more than about 5 degrees), and is at least about 15 to 30 m above it: the roof
//     of a wood is seen only from above it. On foot in a wood, or looking along the land, it is never laid;
//   * the place is past uCanK.z metres from the eye (past the near trees).
// ?canopy=0 takes it out (world/farstand.js reads it): the ground's program is compiled without any of it and the
// mesher packs nothing new, so the picture is the one before to the bit. Only in the oil look, only on CANOPY_WORLDS.
import { SEASON, leafNow } from '../data/season.js';
import { CANOPY, NEEDLE, CANOPY_WORLDS, GROUND_SEASON, ROCKFIELD, canopyOn, BLOOM_FAR, bloomFarOn, bloomPaletteOf } from '../world/farstand.js';
import { MODE } from '../data/mode.js';
import { pig, dilute, mixc } from '../data/looks/common.js';

export { CANOPY, canopyOn, GROUND_SEASON, ROCKFIELD, BLOOM_FAR };
// ?candab=: the canopy's own dabs against the ground's (0.5: its finer layer is half the ground's finest, its coarser
// layer the ground's finest). From a few hundred metres up the ground's dab is as big as a whole crown, so the roof's
// cap and shaded side could not be laid with it; a crown wants three or four strokes across.
export const CANOPY_DAB = (() => { try { const q = new URLSearchParams(location.search); const v = q.has('candab') ? +q.get('candab') : 0.5; return isFinite(v) && v > 0.05 ? Math.min(v, 1) : 0.5; } catch (e) { return 0.5; } })();
// ?candebug=1: each dab of the canopy in a flat colour that says what it is (see the end of pcCanopyAt). For looking only.
export const ROCK_DEBUG = (() => { try { const v = +new URLSearchParams(location.search).get('rockdebug'); return isFinite(v) && v > 0 ? v : 0; } catch (e) { return 0; } })();
// ?canfloor=: the smallest a canopy dab may be, in pixels (2.6); 0 takes the floor out (for an A/B still).
export const CANOPY_FLOOR = (() => { try { const q = new URLSearchParams(location.search); const v = q.has('canfloor') ? +q.get('canfloor') : 2.6; return isFinite(v) && v >= 0 ? Math.min(v, 12) : 2.6; } catch (e) { return 2.6; } })();
export const CANOPY_DEBUG = (() => { try { return new URLSearchParams(location.search).get('candebug') === '1'; } catch (e) { return false; } })();
// ?farshadow=1 (A1's far crowns' shadows, render/shadow.js FAR_SHADOW on trees-far; the same rule read here): the canopy's
// dabs read the shadow map too (PC_FAR_SHADOW in pcCanopyAt). Off by default.
export const CANOPY_FARSHADOW = (() => { try { const v = new URLSearchParams(location.search).get('farshadow'); return v === '1' || v === 'true'; } catch (e) { return false; } })();

// THE VERTEX SHADER'S PART: the stand rides in the far wash's spare byte (patchgen.js), morphed as everything else is.
export const CANOPY_VERT_DECL = /* glsl */`
#ifdef PC_CANOPY
varying float vFarS;      // the stand: the placer's own share of trees kept here (world/farstand.js), 0..1
#endif`;
export const CANOPY_VERT_MAIN = /* glsl */`
  #ifdef PC_CANOPY
    vFarS = mix(aColor2.a, aColor2P.a, m);
  #endif`;

// THE FRAGMENT SHADER'S PART, laid above pcGroundAt (which calls pcCanopyAt) inside the oil look's ground.
export const CANOPY_FRAG = /* glsl */`
#ifdef PC_CANOPY
varying float vFarS;
uniform vec3 uCanA;       // the broadleaves' crowns NOW: the far trees' three washes, mixed for the season (farground.js)
uniform vec3 uCanB;
uniform vec3 uCanC;
uniform vec4 uCanF;       // rgb the family's third colour (a red), a how far each crown keeps to its own part of the run
uniform vec3 uCanN;       // the needle trees' crowns: their light wash and their deep one
uniform vec3 uCanN2;
uniform vec4 uCanK;       // x the grid (m), y a crown's radius over the grid, z the nearest it is laid (m), w 1: on
float gCanOn = 0.0;       // set in main where the leaf dabs are laid: only they carry the canopy
vec2 gCtrCh;              // the dab's centre on the ground's chart (m), set with gCtrB
vec2 gSunCh;              // the sun's way along the ground's chart at this pixel (unit), and its height (sine)
float gSunE;
float gSdx, gSdy;         // the stand's screen derivatives, taken in main outside any branch
vec3 gEye;                // the eye on the body (vBody - vRel: exact, both are the pixel's own)
float gCan;               // out of pcCanopyAt: 1 this dab is painted by the canopy
vec3 gCanC;               // its colour
float gCanL;              // its level (pcLevel)
float gCanLf;             // how far its colour may stray as a leaf's (pcDabTint)
// the roof seen from this place at all: from above, from high enough, far enough (0 .. 1)
float pcCanGate(vec3 P) {
  vec3 rel = P - gEye;
  float len = length(rel);
  float drop = -dot(rel, normalize(P));
  return smoothstep(0.07, 0.16, drop / max(len, 1e-3)) * smoothstep(14.0, 30.0, drop) * smoothstep(uCanK.z, uCanK.z + 40.0, len) * uCanK.w;
}
// the share of the grid's cells that hold a crown, from the stand: the placer's density is about 0.042 trees a square
// metre where the stand is 1, with crowns about 9.6 m across on the mean, so the real wood covers 1 - exp(-3 stand) of
// the ground (0.95 closed, 0.78 at half, 0.34 at its thinnest)
float pcCanKeep(float stand) { return clamp(1.0 - exp(-3.0 * stand), 0.0, 1.0); }
// Whether a cell's crown is a needle tree: its own number against the needle share there, most of that number shared
// by the block of four cells by four (32 m) it lies in, so the needle trees stand in GROUPS of a few crowns (the placer's own
// share comes from a field 52 m across, and the references have the dark conifers in groups among the broadleaves; one
// number per crown scattered them one by one, a pepper of black dabs from a kilometre)
// (two thirds of the crowns take the block's number and the rest their own: a mixture of two even numbers is still even,
// so the share of needle trees is the placer's own, only gathered)
float pcCanNeedle(vec2 cell, float own, float needle) {
  float grp = pcHash3(floor(cell / 4.0) + vec2(41.7, 19.3)).y;
  return step(fract(own * 3.31) < 0.75 ? grp : own, needle);
}
// A crown's place on the family run (yellow, orange, red): its own number, most of it shared by the block of four
// cells by four (32 m) it lies in, so the colours stand in STANDS -- the references from high up: "a patchwork: stands of
// orange, amber, yellow and red broadleaves" -- while the share of each colour is the far tree's own (the same mixture
// of two even numbers as pcCanNeedle). One number per crown made the far wood a fine confetti of yellow and orange.
float pcCanFam(vec2 cell, float own) {
  float std = pcHash3(floor(cell / 4.0) + vec2(7.9, 63.1)).x;
  return fract(own * 5.17) < 0.6 ? std : own;
}
// one cell's crown: its centre on the chart (m), its radius (m), its height over its neighbours (m), whether it is
// there, and its numbers
void pcCanCell(vec2 cell, float keep, float needle, out vec2 C, out float r, out float h, out float has, out vec3 h2) {
  vec3 h1 = pcHash3(cell + vec2(13.17, 71.31));
  h2 = pcHash3(cell + vec2(57.71, 3.93));
  float G = uCanK.x;
  // (jittered by half a cell, so a crown is at most 0.75 of a cell from its cell's middle and the four nearest cells hold
  // every crown that can reach a place; crowns 0.5 to 0.73 of a cell in radius pack a closed wood as a closed roof)
  C = (cell + 0.5 + (h1.xy - 0.5) * 0.50) * G;
  float nd = pcCanNeedle(cell, h2.x, needle);
  h2.z = pcCanFam(cell, h2.z);
  r = G * uCanK.y * (0.80 + 0.38 * h2.y) * mix(1.0, 0.72, nd);
  h = h1.x * 2.5 + h2.y * 1.5 + nd * 2.0;
  has = step(h1.z, keep) * (1.0 - 2.0 * nd);      // (+1 a broadleaf, -1 a needle tree, 0 none)
}
// A crown's own wash: the far tree's rule (materials.js PROP_VERT, the family run), from its number t and its depth k
vec3 pcCanWash(float t, float hue, float k) {
  float cF = t < 0.4 ? t * 0.5 : (t < 0.8 ? 0.3 + (t - 0.4) * 0.75 : 0.75 + (t - 0.8) * 1.25);
  float a0 = clamp(cF - 0.13, 0.0, 1.0), b0 = clamp(cF + 0.13, 0.0, 1.0);
  vec3 pa = a0 < 0.5 ? mix(uCanA, uCanB, a0 * 2.0) : mix(uCanB, uCanF.rgb, a0 * 2.0 - 1.0);
  vec3 pb = b0 < 0.5 ? mix(uCanA, uCanB, b0 * 2.0) : mix(uCanB, uCanF.rgb, b0 * 2.0 - 1.0);
  vec3 lA = mix(uCanA, pa, uCanF.a), lB = mix(uCanB, pb, uCanF.a);
  vec3 lC = mix(uCanC, mix(pb, uCanC, 0.55) * vec3(0.92, 0.80, 0.84), uCanF.a);
  return mix(mix(lA, lB, hue), lC, k);
}
// THE CANOPY AT ONE DAB. P the dab's centre on the body, ch its centre on the chart (m), stand and needle there, floorC
// the floor's own wash there, landX the land's light there (dot(n, sun) * 0.5 + 0.5), w the dab's cell (m), rnd its
// numbers. Sets gCan, gCanC, gCanL, gCanLf.
void pcCanopyAt(vec3 P, vec2 ch, float stand, float needle, vec3 floorC, float landX, float w, vec3 rnd, bool own) {
  gCan = 0.0;
  if (gCanOn < 0.5 || stand < 0.02) return;
  float gate = pcCanGate(P);
  // (the roof comes in dab by dab across the gate's edge, each by its own number: never a soft fade)
  if (gate <= 0.0 || fract(rnd.z * 7.31 + rnd.x * 3.17) >= gate) return;
  float keep = pcCanKeep(stand);
  float G = uCanK.x;
  // the light: what flat ground in the sun takes, and how far the hill turns this place toward the sun or from it
  float flatX = 0.5 + 0.5 * max(gSunE, 0.0);
  float hill = (landX - flatX) * 0.9;
  float sunUp = clamp(gSunE * 1.4, 0.0, 1.0);
  // how big a crown is against the dab: where it is smaller than about a dab and a half its light goes to its mean
  float pf = smoothstep(2.6, 1.3, 2.0 * G * uCanK.y / max(w, 1e-3));
  vec3 col; float x; float lf = 1.0;
  int reg;          // what the dab is: 0 floor in shade, 1 floor in sun, 2 a lit cap, 3 a crown's body, 4 its shaded side, 5 in a neighbour's shadow
  bool ndl = false;
  if (pf > 0.99) {
    // FAR OFF, WHERE A CROWN IS NO BIGGER THAN A DAB: the cell the dab's centre lies in is the whole question. Its crown
    // (one in keep of them hold one) gives the dab its colour; its light is the crown's mean, turned by the hill; an
    // empty cell is the floor in the roof's shade, a step down and no more (from this far a gap is never a black hole).
    vec2 cellF = floor(ch / G);
    vec3 h = pcHash3(cellF + vec2(13.17, 71.31));
    if (h.z >= keep) {
      // (an empty cell: in a close wood the roof's own shade -- from this far a gap is a darker patch of the canopy, the
      // crowns' deepest wash a step down, never a black hole: as near-black dabs the gaps were a pepper from a
      // kilometre -- and at an open wood's edge the grass in the sun)
      bool shdF = fract(h.x * 3.37) < keep * keep;
      col = shdF ? mix(uCanC, floorC, 0.3) : floorC;
      x = shdF ? 0.43 + hill * 0.5 : landX;
      lf = 0.0; reg = shdF ? 0 : 1;
      pcUp = shdF ? 0.5 : 1.0;
    } else {
      pcUp = 0.85;
      // (a needle tree's crown from above is about half a broadleaf's, 0.72 of its radius: so where a whole cell stands
      // for a crown, only about half the needle trees' cells are laid dark, or the far wood is a pepper of black)
      ndl = pcCanNeedle(cellF, fract(h.x * 7.13), needle * 0.55) > 0.5;
      x = mix(0.58, 0.70, sunUp) + hill;
      reg = 3;
      if (ndl) { col = mix(uCanN, uCanN2, 0.25 + 0.5 * fract(h.y * 5.3)); x -= 0.04; lf = 0.3; }
      else col = pcCanWash(pcCanFam(cellF, fract(h.y * 3.71 + h.x)), pcCanFam(cellF, fract(h.x * 9.7)), 0.08);
    }
  } else {
    float cotS = sqrt(max(1.0 - gSunE * gSunE, 0.0)) / max(gSunE, 0.06);
    // (where the crowns are only a little larger than a dab they swell toward filling their cells: a dab that big stands
    // for a crown AND the gaps round it, so the floor shows only where the wood itself is open)
    float grow = mix(1.0, 1.45, pf);
    // the four cells whose crowns can reach this place (a crown is at most 0.75 of a cell from its cell's middle)
    vec2 cb = floor(ch / G - 0.5);
    vec2 Ck[4]; float rk[4]; float hk[4]; float sk[4]; vec3 nk[4];
    int top = -1; float topZ = -1e9;
    for (int i = 0; i < 4; i++) {
      vec2 cell = cb + vec2(float(i - (i / 2) * 2), float(i / 2));
      pcCanCell(cell, keep, needle, Ck[i], rk[i], hk[i], sk[i], nk[i]);
      if (sk[i] == 0.0) continue;
      vec2 d = ch - Ck[i];
      float q = dot(d, d) / (rk[i] * rk[i] * grow * grow);
      if (q >= 1.0) continue;
      float z = hk[i] + rk[i] * 0.5 * sqrt(1.0 - q);      // (the crown's dome over the place: the highest is on top)
      if (z > topZ) { topZ = z; top = i; }
    }
    if (top < 0) {
      // BETWEEN THE CROWNS: the floor, in the shadow of a crown beside it (the sun's side of this place) or under the
      // roof's shade where the wood is close, and in the sun only at an open stand's edge
      float shd = 0.0;
      vec2 off = gSunCh * min(10.0 * cotS, 0.7 * G);
      for (int i = 0; i < 4; i++) {
        if (sk[i] == 0.0) continue;
        vec2 d = ch + off - Ck[i];
        if (dot(d, d) < rk[i] * rk[i]) shd = 1.0;
      }
      // (and under a close roof the light hardly reaches the floor at all, whatever the crowns beside it do)
      shd = max(shd, step(fract(rnd.y * 7.3), keep * keep * keep * keep * (1.0 - 0.5 * max(gSunE, 0.0))));
      // (in the shade of the roof the floor is laid in the crowns' own deepest wash over it -- an umber in autumn, a
      // deep green in summer -- and not in the floor's grass at the deepest level, which came out a cold slate grey)
      col = mix(floorC, uCanC, 0.75 * shd);
      x = mix(landX, mix(0.12, 0.36, pf), shd);
      lf = 0.0; reg = shd > 0.5 ? 0 : 1;
      // (and a floor under a roof sees little of the sky, so it takes little of the sky's blue fill in its shade:
      // chunks.js pcUp, the contract written there -- flat open ground is 1, a wall 0; with the open sky's fill the gaps
      // were teal)
      pcUp = mix(1.0, 0.25, shd);
    } else {
      vec2 C = Ck[0]; float r = rk[0], h = hk[0], s = sk[0]; vec3 n2 = nk[0];
      if (top == 1) { C = Ck[1]; r = rk[1]; h = hk[1]; s = sk[1]; n2 = nk[1]; }
      else if (top == 2) { C = Ck[2]; r = rk[2]; h = hk[2]; s = sk[2]; n2 = nk[2]; }
      else if (top == 3) { C = Ck[3]; r = rk[3]; h = hk[3]; s = sk[3]; n2 = nk[3]; }
      vec2 d = (ch - C) / r;
      float along = dot(d, gSunCh);
      // the crown's own light: a lit cap toward the sun, the body, the shaded side away from it (seen from above with
      // the sun high most of a crown's top is in the sun, so the cap grows with the sun's height)
      vec2 dc = d - gSunCh * 0.32;
      float capR = 0.55 + 0.25 * sunUp;
      float xr = 0.60; reg = 3;
      if (dot(dc, dc) < capR * capR) { xr = 0.80; reg = 2; }
      else if (along < mix(-0.20, -0.42, sunUp)) { xr = 0.42; reg = 4; }
      // (which way the piece of the crown faces the sky: its top fully, its flank half, chunks.js pcUp)
      pcUp = reg == 4 ? 0.55 : 0.90;
      // and the shadow of a taller neighbour on it
      for (int i = 0; i < 4; i++) {
        if (i == top || sk[i] == 0.0 || hk[i] <= h) continue;
        vec2 e = ch + gSunCh * min((hk[i] - h) * cotS, 0.7 * G) - Ck[i];
        if (dot(e, e) < rk[i] * rk[i]) { xr = min(xr, 0.33); reg = 5; }
      }
      x = mix(xr, mix(0.58, 0.70, sunUp), pf) + hill;
      ndl = s < 0.0;
      if (ndl) {
        // a needle tree: its own dark green, a step deeper toward its middle, its light a little lower
        col = mix(uCanN, uCanN2, 0.25 + 0.5 * n2.y);
        x -= 0.04;
        lf = 0.3;
      } else {
        col = pcCanWash(n2.z, pcCanFam(floor(C / G), fract(n2.y * 9.7)), xr < 0.5 ? 0.35 : 0.08);
      }
    }
  }
  // (in the canopy's own layer of dabs a floor in the sun is not laid: the ground's own dabs under it are that floor)
  if (own && reg == 1) return;
  gCan = 1.0;
  gCanC = col;
  gCanLf = lf;
  // (the roof's lights are held a little under the full lit paint: the far trees' lemon and amber washes in full sun
  // reached V 0.95 and over, and the look rules want lit foliage at 0.60 to 0.82 (R1.2c); MEASURED, the share of a 1 km
  // still over V 0.90 went 11.1 to 13.7 per cent with the full light. A cap is still one flat colour for the dab.)
  gCanL = min(pcLevel(x + (rnd.z - 0.5) * 0.06, 0.03), 2.6);
  #ifdef PC_FAR_SHADOW
    // (THE FAR CROWNS' SHADOWS ON THE ROOF, trees-far A1's lines, ?farshadow=1, chosen by the look director: a dab whose centre
    // lies in a far crown's shadow, as the shadow map says (pcSunAtSoft's own test without its dapple), takes the
    // neighbour's-shadow level. It reads the map, not the grid, so it holds on both sides of pf: where this roof's own
    // shading has gone to the mean, the dabs beside each impostor crown on its shadow side still step down. One read a dab.)
    if (uShK.x >= 0.004) {
      vec3 qF = (uShM * vec4(P, 1.0)).xyz; vec2 aF = abs(qF.xy);
      float inF = (1.0 - smoothstep(uShK.w, 0.97, max(aF.x, aF.y))) * uShK.x;
      if (inF > 0.5) {
        vec2 fF = textureLod(uShAir, qF.xy * 0.5 + 0.5, 0.5).rg;
        float covF = fF.r * step(fF.g / max(fF.r, 1e-3) - 0.0006, qF.z);
        if (covF > 0.40 + 0.26 * fract(rnd.y * 5.7)) gCanL = min(gCanL, pcLevel(0.33, 0.03));
      }
    }
  #endif
  #ifdef PC_CANDEBUG
    // (?candebug=1: what each dab is, in flat colours -- black a floor in shade, green a floor in sun, white a lit cap,
    // orange a crown's body, red its shaded side, purple a neighbour's shadow; a needle tree bluer; all of it at half
    // where the light is taken to the mean, far off)
    gCanC = reg == 0 ? vec3(0.03) : reg == 1 ? vec3(0.1, 0.9, 0.1) : reg == 2 ? vec3(1.0) : reg == 3 ? vec3(1.0, 0.55, 0.0) : reg == 4 ? vec3(0.9, 0.0, 0.0) : vec3(0.6, 0.0, 0.8);
    if (ndl) gCanC = mix(gCanC, vec3(0.0, 0.3, 1.0), 0.6);
    gCanC *= 1.0 - 0.5 * pf;
    gCanL = 2.0;
  #endif
}
// THE CANOPY'S OWN LAYERS OF DABS (called in main before the ground's, inside the leaf-dab branch): two layers an octave
// apart at PC_CAN_DAB and twice that of the ground's finest cell, laid from the top down exactly as the ground's are,
// each dab a crown's piece (or a floor in the roof's shade) asked at its own centre; a dab on a floor in the sun is left
// out and the ground's own dabs lay it. What a dab covers whole is finished: the ground's layers under it are not
// worked out. Adds to main's acc and takes from its rem.
void pcCanopyLayers(vec2 ch, vec2 dlx, vec2 dly, float o4x, float wpx, vec3 ocl, float rB, float rdx, float rdy, inout vec3 acc, inout float rem) {
  if (gCanOn < 0.5 || vFarS <= 0.02 || (uOilL.y > 0.5 && uOilL.y < 1.5)) return;
  // (A CANOPY DAB IS NEVER UNDER ABOUT 3 PIXELS: the look director, 24 Nov. The ground's finest dab is AIMED at the
  // same width in pixels at every distance (materials.js dabPx, from the stroke size and the picture's lines only), so
  // the canopy's is PC_CAN_DAB of it everywhere in a frame; on a phone at its smaller picture that came under three
  // pixels, a grain. There the next octave up is taken, for the whole frame at once: no line where it changes.)
  // (PC_CAN_FLOOR, ?canfloor=: the floor in pixels, 2.6; 0 none. MEASURED: the phone view of 480 lines aims the
  // ground's finest dab at 4.0 px, so the canopy's was 2.0; at 720 lines it is 2.99, which is left as it was)
  float canK = PC_CAN_DAB, aimPx = 0.50 * uOilS.w * uOilA.x * uOilPx.y / 720.0;
  if (canK * aimPx < PC_CAN_FLOOR) canK *= 2.0;
  if (canK * aimPx < PC_CAN_FLOOR) canK *= 2.0;
  for (int LC = 0; LC < 2; LC++) {
    if (rem < 0.004) break;
    float wsC = (LC == 0 ? 1.0 : 2.0) * canK, wC = o4x * wsC;
    vec3 rndC, rndC2; vec2 dsC, ctrC; float covC, has2C;
    pcDabLayer(ch, dlx, dly, wC, uOilS.z, 4.0 * wpx * uOilS.w * wsC, ocl, LC == 0 ? vec2(0.35, 0.65) : vec2(0.0, 0.35), rndC, ctrC, dsC, covC, rndC2, has2C);
    if (covC <= 0.0) continue;
    vec2 dsCA = dsC * min(1.0, 24.0 / max(length(dsC), 1e-3));
    vec3 PC = pcGroundUnchart(vBody, ctrC, uBodyR) * (rB + rdx * dsC.x + rdy * dsC.y);
    vec3 nVC = normalize(vNV + gNvdx * dsCA.x + gNvdy * dsCA.y);
    pcCanopyAt(PC, ctrC, clamp(vFarS + gSdx * dsCA.x + gSdy * dsCA.y, 0.0, 1.0), clamp(vPar.w + gPdx.w * dsCA.x + gPdy.w * dsCA.y, 0.0, 1.0),
               clamp(vCol.rgb + gCdx.rgb * dsCA.x + gCdy.rgb * dsCA.y, 0.0, 1.0), dot(nVC, gSunV) * 0.5 + 0.5, wC, rndC, true);
    #ifdef PC_FIRE
      if (gCan > 0.5 && pcMarksAt(PC).x > 0.3) gCan = 0.0;      // (no crown stands where the fire has been)
    #endif
    if (gCan < 0.5) continue;
    acc += rem * covC * pcTone(pcDabTint(gCanC, rndC, gCanLf), gCanL);
    rem *= 1.0 - covC;
    if (has2C > 0.5 && rem >= 0.004) { acc += rem * pcTone(pcDabTint(gCanC, rndC2, gCanLf), gCanL); rem = 0.0; }
  }
  gCan = 0.0;
}
// The canopy's mean wash at a pixel, for the ground that shows BETWEEN the dabs (the lighter paint leaves more of it):
// the crowns' mean colour over the share the roof covers here. rgb the wash, a that share.
vec4 pcCanopyMean(float stand, float needle) {
  if (gCanOn < 0.5 || stand < 0.02) return vec4(0.0);
  float gate = pcCanGate(vBody);
  if (gate <= 0.0) return vec4(0.0);
  vec3 b = mix(mix(uCanA, uCanB, 0.5), mix(uCanB, uCanF.rgb, 0.4), uCanF.a * 0.5);
  return vec4(mix(b, mix(uCanN, uCanN2, 0.5), needle), pcCanKeep(stand) * gate);
}
#endif`;

// THE FLOOR AND THE FAR COLOUR FOLLOW THE YEAR (FV3 of the design). The trees turn from summer to autumn (flora.js
// setSeason) and so does the painted canopy above; the GROUND did not: its far colour of a wood is the biome's palette
// (the autumn wood's golds, the green wood's greens) and its fallen leaves are that colour too, at every point of the
// year -- so in summer the autumn wood stood green on a gold carpet (the design's stills) and in autumn the green wood's
// far hills stayed green under gold trees. Here, in the oil look's ground:
//   * a wood's far colour (vCol2) is moved by the difference between the crowns' mean wash NOW and the season its
//     palette was painted for, over the canopy's share there: the share painted in a summer palette (every wood but one
//     whose look data says autumn: 1) by now - summer, the rest by now - autumn. The mesher hands the summer-painted
//     share in the parameters' second byte (vPar.y; surface.js canS), the autumn-painted in the first (vPar.x, canA), both
//     of TREES and not of the canopy (which also counts a stream bank's shade: the stream drawn blue into the far colour
//     went turquoise in the first summer still). So the far wood is the
//     colour its trees are, all year, and at the top of autumn the autumn wood does not move at all, nor at its edges.
//     (Two earlier forms, both MEASURED wrong at the top of autumn: the season read off the palette's own hue moved
//     19,518 pixels of the autumn wood on foot; a blended "palette season" byte moved 43,595 pixels of a 400 m view where
//     the wood blends into the mountain, its canopy being the wood's and its byte a blend.)
//   * the share of the floor's dabs laid as fallen leaves is seven tenths of itself in high summer, all of it in autumn;
//   * and a fallen leaf in summer is last year's: the floor's own wash taken toward its brown, not a fresh crown colour.
// AT THE TOP OF AUTUMN (t = 1) NOTHING MOVES in the autumn wood: the move is zero where the palette is gold, the leaves'
// share and colour are exactly what they were. That is the owner's approved autumn floor, kept to the bit.
// ?groundseason=0 compiles none of it.
// (the far colour's move is worked out ONCE A VERTEX, in the vertex shader: it reads only what the vertex carries and three
// uniforms, so the ground's pixels pay nothing for it; the fallen leaves' share and colour are the fragment's)
export const SEASON_VERT = /* glsl */`
#ifdef PC_SEASONG
uniform vec4 uSeasonG;    // x the year (0 high summer .. 1 deep autumn), y 1: on (a world whose trees turn)
uniform vec3 uCanSum;     // the crowns' mean wash in high summer and in deep autumn (farground.js: the canopy's own mean)
uniform vec3 uCanAut;
// (needle: the share of needle trees there, world/farstand.js; they do not turn, so only the broadleaves' share moves --
// without it the mountain's conifer stands went gold in autumn)
vec3 pcSeasonFar(vec3 c2, float canA, float canS, float needle) {
  if (uSeasonG.y < 0.5) return c2;
  vec3 now = mix(uCanSum, uCanAut, uSeasonG.x);
  vec3 sh = (now - uCanSum) * clamp(canS * 1.15, 0.0, 1.0) + (now - uCanAut) * clamp(canA * 1.15, 0.0, 1.0);
  return clamp(c2 + sh * (1.0 - needle), 0.0, 1.0);
}
#endif`;
export const SEASON_VERT_MAIN = /* glsl */`
  #ifdef PC_SEASONG
    vCol2 = pcSeasonFar(vCol2, vPar.x, vPar.y, clamp(vPar.w, 0.0, 1.0));      // (the far view, FV3: render/farground.js)
  #endif`;
export const SEASON_FRAG = /* glsl */`
#ifdef PC_SEASONG
uniform vec4 uSeasonG;
// (seven tenths of the fallen leaves in high summer, and last year's leaf a quiet brown with a third of its colour taken
// to its own grey: with a quarter of the leaves and a heavier brown the floor under the trees on foot in summer was more
// of the grass whose shade is today's saturated green (the look audit's F4, the look director's L2), and MEASURED, the
// saturation of a still's darks went 0.61 to 0.68 -- worse on the look rules' C7; with a half, 0.66)
float pcSeasonLeafK() { return uSeasonG.y < 0.5 ? 1.0 : mix(0.7, 1.0, uSeasonG.x); }
vec3 pcSeasonLeaf(vec3 leaf, vec3 floorC) {
  if (uSeasonG.y < 0.5) return leaf;
  vec3 br = pcDensity(floorC * vec3(1.0, 0.86, 0.68), 1.2);
  br = mix(br, vec3(dot(br, vec3(0.3, 0.5, 0.2))), 0.35);
  return mix(leaf, br, (1.0 - uSeasonG.x) * 0.85);
}
#endif`;

// ROCK FACES THAT READ FROM AFAR (FV4 of the design; the look audit's F12, mountains as flat-coloured facets and mottle).
// What the alpine range was from the air (the design's stills, and fv2_alpine_400m_30deg_12h_phone_AB.jpg): a lilac,
// green and cream mosaic with no lit and shaded planes. Three causes in the ground's own paint, and the cure for each:
//   * the biome's patch colours (alpine green and pale cream, 48 m and 20 m across) mottle the faces as much as the
//     meadows: on steep ground (the dab centre's facing, 35 to 48 degrees) the wash is taken half way to its own value,
//     so a cliff is rock-coloured and the patches stay on the turf;
//   * every dab of the floor strays: one in two takes a neighbouring pigment, two in five of the lit ones are laid a full
//     step darker, and each varies its weight and warmth: on rock the step down is not taken, the pigment and the
//     stray are halved, so a face is laid in lit planes and shaded planes by its own facing;
//   * strata were not painted at all in the oil look (vCol.a carries them, 1 - strata): on steep rock two tones by
//     height band, beds of unequal thickness (a band of a little over 19 m, wandering with a slow wave), each band one
//     density of the rock's own wash -- no new hue.
// Most of the snow is shed off faces over about 50 degrees by the mesher (patchgen.js), so white lies on the summits'
// gentler ground, on ledges and in gullies, with dark ribs where the face is steepest.
// ?rockfield=0 compiles none of it. (The dabs on a cliff still smear: their chart is edge-on there, which only the look
// director's slope chart can cure, F13.)
export const ROCK_FRAG = /* glsl */`
#ifdef PC_ROCKF
uniform float uRockK;     // 1 on a world whose rock is painted so (CANOPY_WORLDS: Earth), 0 elsewhere
uniform vec3 uRockC0, uRockC1, uRockC2, uRockC3;      // the world's cliff rock: pale, mid, deep, slate (ROCK_LOOK below)
uniform vec4 uRockB;      // x a bed's mean height (m), y the gullies' spacing (m), z the sea's level (m), w unused
uniform vec3 uRockM0, uRockM1, uRockM2, uRockM3;      // the MOUNTAINS' rock family: light, mid, deep, warm (ROCK_LOOK .mtn)
uniform vec2 uRockMH;     // the height band (m) over which the coast's rock gives way to the mountains' family
float gRock = 0.0;        // how much this dab is a rock face (set in pcGroundAt, read in pcGroundPaint)
float gCliff = 0.0;       // this dab is a cliff's rock (0 or 1: whole dabs), set with gRock
float gGully = 0.0;       // how far into a gully the cliff dab lies: its light goes down (pcGroundAt)
float gRockLw = 1.0;      // (main) the surface's metres per pixel here (lw): how many pixels a bed spans
float gRockT = 0.0;       // the rock dab's temperature by its plane: +0.8 lit (warm) .. -1 turned away (cool), pcRockPlanes
float gRockP = 0.0;       // how much the light planes rule this dab: bedded rock only (a cliff, a mountain's face), never snow
float gCliffU = 0.0;      // 1 while pcCliffC paints the ground BETWEEN the dabs, per pixel (main's bare branch)
float gFaceOn = 0.0;      // (main) this pixel is steep enough that the upright charts may lay its dabs
float gFaceD = 0.0;       // (main) the dab being painted lies on an upright chart
#ifdef PC_ROCKDEBUG
const float uRockDbg = PC_ROCKDEBUG;
#endif
vec2 gFaceP;              // (main) at the pixel: the facing (dot of the normal with up), and the strike's way (0 .. 8, pcStrikeWay)

// L8, THE SLOPE CHART (the look director's line, 24 Nov). On a face the ground's chart is edge-on: it is laid on the
// sphere seen from straight above, so a metre down a cliff is no distance on it, and every dab stretched into a
// vertical stripe, a different colour from column to column (the coast's ruled wall, F13). An UPRIGHT chart lies on
// the face instead: u along the strike, v the height, running DOWN the fall line. Pure: no derivative of pB. In cells.
// THE STRIKE IS TAKEN IN EIGHT FIXED WAYS (every 22.5 degrees on the ground's chart), never turned smoothly: the
// ground's chart counts kilometres, and a u turned with the face's facing swam by metres as the facing changed from
// facet to facet. In a fixed way a dab is at most 2 per cent longer than true. (Two were tried first, the chart's own
// axes: a coast at 45 degrees to them is laid as a staircase of facets whose smoothed facing lies half way between,
// and half the dabs on it were refused, SEEN in ?rockdebug=1.)
// (Two charts cannot be blended into one without a seam or a band of crushed dabs: an upright chart and the ground's
// are kilometres apart in number. So pcSlopeChart falls back to pcGroundChart under about 25 degrees as a hard choice,
// and the GROUND's dabs cross from one chart to another by WHOLE DABS (pcFaceLayer): each dab keeps its chart by its
// own number against the share at its own centre, so there is no seam and no dab is cut. Two neighbouring ways of the
// strike meet the same way.)
const float PC_STRIKE = 2.5464791;      // (8 / pi: the strike's angle in ways)
// the strike's angle at a facing, in ways (0 .. 8), from the facing's level part on the ground's chart
float pcStrikeWay(vec3 n, vec3 upB, float up) {
  vec2 g = pcGroundChartD(vBody, n - upB * up, uBodyR);
  return mod(atan(g.x, 1e-7 - g.y) * PC_STRIKE + 8.0, 8.0);      // (the 1e-7: level ground has no strike, and atan(0, 0) is no number)
}
// the upright chart of way k (m): u along the strike, v down
vec2 pcStrikeAxis(float k) { float a = k / PC_STRIKE; return vec2(cos(a), sin(a)); }
vec2 pcSlopeChart(vec3 pB, vec3 nB, vec3 upB, float cell) {
  float up = dot(nB, upB);
  vec2 ch = pcGroundChart(pB, uBodyR);
  if (up > 0.906) return ch / cell;
  vec2 g = pcGroundChartD(pB, nB - upB * up, uBodyR);
  float k = floor(mod(atan(g.x, -g.y) * PC_STRIKE + 8.0, 8.0) + 0.5);
  return vec2(dot(ch, pcStrikeAxis(k)), uBodyR - length(pB)) / cell;
}
// The shares at the pixel (main, once): x how much the place is a face (the upright charts' share: 0 under 37 degrees,
// all of it by 50), y how much of that is the strike's way j + 1 rather than way j (j = floor(gFaceP.y)).
// (AT THE PIXEL, NOT CARRIED TO THE DAB'S CENTRE. The coast's wall runs across the terrain's grid, so it is a staircase
// of facets a few pixels wide, and the facing carried to a centre by its screen derivatives jumped at every facet's
// edge: each dab was cut into slivers down the face, SEEN in ?rockdebug=1. The smoothed facing itself does not jump; a
// dab is cut only where a share passes its number inside it, which is in the bands between, and never on a sheer face.)
vec2 gFaceK;
// One layer of the ground's dabs on steep land: the upright charts of the strike's two nearest ways and the ground's
// own, each dab kept by its own number against the shares. The arguments and out as pcDabLayer's (hB: the pixel's
// height, rdx, rdy its screen derivatives); face out: 0 the ground's chart, 1 way j, 2 way j + 1. A chart whose share is
// nothing here is not asked: on a face that runs one of the eight ways, one layer costs one look-up.
void pcFaceLayer(vec2 ch, vec2 dlx, vec2 dly, float hB, float rdx, float rdy, float w, float asp, float lim,
                 vec3 ocl, vec2 ab, out vec3 rnd, out vec2 ctr, out vec2 ds, out float cov, out vec3 rnd2, out float has2,
                 out float face) {
  cov = 0.0; face = 0.0; has2 = 0.0; rnd = vec3(0.5); rnd2 = vec3(0.5); ds = vec2(0.0); ctr = ch;
  vec3 r, r2; vec2 c, d; float cv, h2;
  float j = floor(gFaceP.y);
  for (int a = 0; a < 2; a++) {
    float sh = gFaceK.x * (a == 0 ? 1.0 - gFaceK.y : gFaceK.y);
    if (sh <= 0.0) continue;
    vec2 ax = pcStrikeAxis(j + float(a));
    pcDabLayer(vec2(dot(ch, ax), -hB), vec2(dot(dlx, ax), -rdx), vec2(dot(dly, ax), -rdy), w, asp, lim, ocl, ab, r, c, d, cv, r2, h2);
    if (cv <= 0.0 || fract(r.z * 31.1 + r.x * 7.7) >= sh) continue;
    rnd = r; ctr = c; ds = d; cov = cv; rnd2 = r2; has2 = h2; face = 1.0 + float(a);
    return;
  }
  if (gFaceK.x >= 1.0) return;
  pcDabLayer(ch, dlx, dly, w, asp, lim, ocl, ab, r, c, d, cv, r2, h2);
  if (cv <= 0.0 || fract(r.z * 31.1 + r.x * 7.7) < gFaceK.x) return;
  rnd = r; ctr = c; ds = d; cov = cv; rnd2 = r2; has2 = h2;
}
// THE LIGHT OF A FACE. On the staircase wall the smoothed facing turns from column to column, and each column was lit
// apart: stripes of light and shade down a cliff that is one plane (SEEN). A dab of an upright chart is lit as the
// face it is laid on: level, it faces straight out from its way of the strike (the side the land falls to); its
// steepness is the pixel's (gFaceP.x). The body's axes are carried to the eye's by the frame the smoothed facing and
// up make in both (gFaceA, gFaceB), so the light is the same arithmetic as every other dab's.
vec3 gFaceNV;                       // the face dab's facing, in the eye's axes (pcGroundAt takes it for its light)
vec3 gFaceA2, gFaceB2, gFaceUV;     // the smoothed facing's level part in the body's axes and in the eye's, and up in the eye's
vec2 gFaceG;                        // the smoothed facing's level part on the ground's chart (which side the land falls to)
void pcFaceFrame(vec3 nP, vec3 upB, float upSm) {
  gFaceA2 = normalize(nP - upB * upSm + vec3(1e-6, 0.0, 0.0));
  gFaceUV = normalize(vUpV);
  vec3 nV = normalize(vNV);
  gFaceB2 = normalize(nV - gFaceUV * dot(nV, gFaceUV) + vec3(1e-6, 0.0, 0.0));
  gFaceG = pcGroundChartD(vBody, gFaceA2, uBodyR);
}
void pcFaceLight(vec2 ch, float face, vec3 upB) {
  vec2 ax = pcStrikeAxis(floor(gFaceP.y) + face - 1.0);
  vec2 n2 = vec2(-ax.y, ax.x);
  n2 *= dot(n2, gFaceG) < 0.0 ? -4.0 : 4.0;
  vec3 b = pcGroundUnchart(vBody, ch + n2, uBodyR) - pcGroundUnchart(vBody, ch, uBodyR);
  vec3 hD = normalize(b - upB * dot(b, upB));
  float u = gFaceP.x, sn = sqrt(max(1.0 - u * u, 0.0));
  float c2 = dot(hD, gFaceA2), c3 = dot(hD, cross(upB, gFaceA2));
  gFaceNV = normalize(gFaceUV * u + (gFaceB2 * c2 + cross(gFaceUV, gFaceB2) * c3) * sn);
}
// A dab of an upright chart: its centre's place on the body, EXACT from the chart (its v is the height there; its u
// is taken along the strike from the pixel's place on the ground's chart), not carried by screen derivatives.
vec3 pcFaceCentre(vec2 ch, vec2 ctr, float face) {
  vec2 ax = pcStrikeAxis(floor(gFaceP.y) + face - 1.0);
  return pcGroundUnchart(vBody, ch + ax * (ctr.x - dot(ch, ax)), uBodyR) * (uBodyR - ctr.y);
}
// THE CLIFF'S ROCK (the coordinator, 24 Nov: the coast's wall must read as rock with strata, a broken top, shade in its
// gullies). Bc a dab's place, hB its height, rnd its numbers, c the place's own wash. Beds by height, each one of the
// world's four rock tones, leaning and wandering along the face, with a dark seam at a bed's foot and a lit lip at its
// top; gullies down the face where a slow field across it runs high, where the beds are lost under scree and the light
// goes (gGully); the last metres over the sea wet and dark. A touch of the place's own hue, so a coast and a range
// differ. Nothing here varies down the face but the beds: the fields are asked at the place with its height taken out.
vec3 pcCliffC(vec3 Bc, float hB, vec3 rnd, vec3 c, float w) {
  vec3 hp = Bc * (uBodyR / max(length(Bc), 1.0));
  vec4 nG = textureLod(uNoise3D, hp / uRockB.y + 0.31, 0.0);
  vec4 nS = textureLod(uNoise3D, hp / (uRockB.y * 4.3) + 0.67, 0.0);
  // (a gully and a bed are told apart only while they span enough pixels for several dabs: where a bed is under a few
  // dabs tall each dab drew a random bed's tone, and the far slopes were a confetti of cream, umber and slate, SEEN at
  // 400 m and 1 km. There they go to the rock's mean, lit and shaded by the face's own facing alone. w here is the
  // surface's metres per pixel (main's lw): a bed is kept whole over 14 px tall, gone under 7; a gully (about a quarter
  // of its spacing wide) over 9 px, gone under 4. Measured by the dab's own size in metres instead, the beds were faint
  // from the sea at 68 m and gone at 150 m: a face seen across is far larger on the screen than its distance says.)
  float kB = 1.0 - smoothstep(7.0, 14.0, uRockB.x / max(w, 1e-4)), kG = 1.0 - smoothstep(4.0, 9.0, 0.25 * uRockB.y / max(w, 1e-4));
  gGully = smoothstep(0.55, 0.70, nG.r + 0.25 * (nS.g - 0.5)) * (1.0 - 0.7 * kG);
  float hb = hB + 9.0 * (nS.b - 0.5) + 0.8 * (nG.a - 0.5);
  float q = hb / uRockB.x + 0.38 * sin(hb / (uRockB.x * 2.7));
  float bi = floor(q), f = q - bi;
  // (the beds alternate a light one and a dark one, each its tone by its own number: four tones at random under a
  // full sun all came out one tan, the light taking every lit colour toward its gold, SEEN)
  float t = pcHash3(vec2(bi * 1.37 + 0.21, 3.7)).x;
  // (ONE ROCK FAMILY PER MOUNTAIN: the look director's second audit, 3. Over the coast's height the beds are the
  // sandstone's strong turns; up the range they are the mountains' grey-violet family, the beds small steps inside it,
  // never a rainbow. The band is the world's (uRockMH): on Earth from 35 to 90 m above the sea.)
  float kM = smoothstep(uRockMH.x, uRockMH.y, hB);
  bool lightBed = mod(bi, 2.0) < 0.5;
  vec3 toneC = lightBed ? (t < 0.72 ? uRockC0 : uRockC3) : (t < 0.6 ? uRockC1 : uRockC2);
  vec3 toneM = lightBed ? (t < 0.6 ? uRockM0 : uRockM3) : (t < 0.7 ? uRockM1 : uRockM2);
  vec3 tone = mix(toneC, toneM, kM);
  vec3 lipC = mix(mix(uRockC0, uRockM0, kM), vec3(1.0), 0.4);
  if (f < 0.10) tone = tone * vec3(0.60, 0.60, 0.66);
  else if (f > 0.89) tone = mix(tone, lipC, 0.6);      // (the lit lip: the only near-white on a face)
  vec3 meanC = 0.5 * (mix(uRockC0, uRockC3, 0.28) + mix(uRockC1, uRockC2, 0.4));
  vec3 meanM = 0.5 * (mix(uRockM0, uRockM3, 0.4) + mix(uRockM1, uRockM2, 0.3));
  // (the ground between the dabs is asked per pixel, not per dab: there a bed under about 3 px tall, its seams and lips
  // a fraction of a pixel, came out as a dither of light and dark pixels, the speckle the look director saw on the far
  // faces at 1 km. So under the dabs the beds go WHOLLY to the mean by 3 px, the way a dab's beds go to it by 7.)
  float kBf = mix(0.85 * kB, 1.0, gCliffU * (1.0 - smoothstep(3.0, 6.0, uRockB.x / max(w, 1e-4))));
  tone = mix(tone, mix(meanC, meanM, kM), kBf);
  tone = mix(tone, pcDensity(mix(mix(uRockC1, uRockC2, 0.4), mix(uRockM1, uRockM2, 0.5), kM), 1.15), gGully * 0.75);
  float lc = max(dot(c, vec3(0.3, 0.5, 0.2)), 0.05);
  tone = clamp(tone * mix(vec3(1.0), clamp(c / lc, vec3(0.7), vec3(1.4)), 0.08), 0.0, 1.0);
  float wet = (1.0 - smoothstep(0.8, 3.2, hB - uRockB.z + 0.9 * (rnd.x - 0.5))) * step(uRockB.z - 1.5, hB);
  return mix(tone, pcDensity(tone, 1.75) * vec3(0.92, 0.96, 1.05), wet * 0.85);
}
// the wash at a dab on steep rock: up the dab centre's facing (dot of the normal with up), Bc its place, strata the
// biome's (1 - vCol.a), rnd the dab's numbers
// THE FAR FACES (step 1): from 35 to 48 degrees, only from about 80 m out, all of it by 250 m: it is the far face that
// reads as a mosaic, and near, on foot, a steep slope is as often turf as rock -- SEEN at the alpine easel, where the
// whole green slope went grey -- and the ground does not know which; dist is the pixel's own.
// THE CLIFFS (step 2): from 49 degrees, all of it by 60, at every distance, where the land has beds (strata: the coast,
// the range; never a wood's cut bank): the world's own rock (pcCliffC). Its top and foot are broken by WHOLE DABS, each
// rock or turf by its own number and a slow field against the share at its centre: a ragged edge, never a line.
vec3 pcRockWash(vec3 c, float up, vec3 Bc, float strata, float dist, vec3 rnd, float w) {
  float hB = length(Bc) - uBodyR;
  // (up the range, past the coast's height band, the rock begins at a gentler slope, about 30 degrees, from 80 m out:
  // the mountains' flanks were the pastel patches of the alpine wash, rose, lime and lilac, the audit's rainbow)
  // (the mountain's family and its light planes only where the beds are WHOLE: a partly snowy place (patchgen.js reports
  // part of its beds) took part rock and part wash, and the planes darkened the wash's red patch into soft dark red-brown
  // smudges on the alpine ridges, SEEN by the look director)
  float kMt = smoothstep(uRockMH.x, uRockMH.y, hB) * smoothstep(0.35, 0.50, strata);
  float far = mix(smoothstep(0.82, 0.67, up), smoothstep(0.87, 0.74, up), kMt) * smoothstep(80.0, 250.0, dist);
  float cl = smoothstep(0.66, 0.50, up) * smoothstep(0.05, 0.20, strata);
  float nr = textureLod(uNoise3D, Bc / 4.3 + 0.13, 0.0).g;
  // (SNOW WINS OVER ROCK above the snowline, the look director's condition: a wash the surface laid snow over (its own
  // white, the mesher having shed it off the sheerest faces only) is not painted as rock, so the peaks keep their white;
  // with rock laid over it the peaks' tips went grey at 420 m and 1 km, SEEN. Whole dabs: the wash at the dab's centre.)
  float sn = smoothstep(0.70, 0.86, min(min(c.r, c.g), c.b));
  gCliff = step(fract(rnd.y * 7.7 + rnd.z * 3.1) * 0.6 + nr * 0.4, (cl * 1.1 - 0.05) * (1.0 - sn)) * uRockK;
  gRock = max(far * uRockK * (1.0 - sn), gCliff);
  // (the planes only on BEDDED rock: a snow-laid place reports no beds (patchgen.js), and a snowfield turned from the sun
  // was laid in the deep shade plane and went dark at 1 km, SEEN; snow keeps the ordinary light)
  gRockP = max(gCliff, far * uRockK * (1.0 - sn) * smoothstep(0.35, 0.50, strata));
  gGully = 0.0;
  if (gRock <= 0.0) return c;
  if (gCliff > 0.5) return pcCliffC(Bc, hB, rnd, c, gRockLw);
  if (kMt > 0.0) return mix(c, pcCliffC(Bc, hB, rnd, c, gRockLw), gRock * mix(0.65, 1.0, kMt));      // (a mountain's far face: its family, not its wash)
  float l = dot(c, vec3(0.3, 0.5, 0.2));
  vec3 rk = mix(vec3(l), c, 0.5);
  if (strata > 0.004) {
    float f = fract(hB / 19.3 + 0.6 * sin(hB / 61.0 + 2.3));
    rk = f < 0.42 ? pcDensity(rk, 0.86) : (f < 0.58 ? pcDensity(rk, 1.38) : rk);
  }
  return mix(c, rk, gRock * (0.65 + 0.35 * min(strata * 2.0, 1.0)));
}
// THE ROCK'S LIGHT IN PLANES (the look director's second audit, 3: "a mountain is a few big planes, lit and shaded").
// The oil look's light lights whatever faces the sun at all, so under a high sun every face of a range was lit and none
// was in shade. A rock dab is lit by its slope's own facing in THREE PLANES instead, as a painter splits a mountain:
// the side turned TOWARD THE SUN'S BEARING the full light, the side on the local colour, the side turned AWAY from the
// sun's bearing the deep shade, and a gully on the shaded side a step deeper still. The bearing and not the height: at
// noon the sun is high and a face turned away from it still saw the sun (the first form, by the facing's dot with the
// sun, left 0.00 per cent of a mountain under V 0.3, SEEN). A face that is truly turned from the sun (a low sun) is in
// shade whatever its bearing. The step is taken whole at the dab (its facing is the dab's) and handed to the shared
// pcLevel, so night, cloud and storm still rule it. lvl: the dab's own level, kept where darker (a cast shadow).
float pcRockPlanes(float lvl, vec3 nV, float sunny) {
  vec3 upV = normalize(vUpV);
  float d = dot(nV, gSunV);
  vec3 nh = nV - upV * dot(nV, upV), sh = gSunV - upV * dot(gSunV, upV);
  float dh = dot(nh, sh) / max(length(nh) * length(sh), 1e-4);
  float b = mix(dh, 1.0, smoothstep(0.30, 0.12, length(nh)));      // (a gentle face has no side: its bearing does not count)
  b = min(b, smoothstep(0.02, 0.16, d) * 2.0 - 1.0);               // (turned from a low sun: shade)
  // (the planes sit BELOW the light the oil look gives a lit thing: toward the sun the rock's local colour with half a
  // step of light (base - 0.5), side on the cool shade (base - 1.6), turned away the deep shade (base - 2.4), a gully on
  // the shaded side the deepest paint. base is the full light as the shared pcLevel gives it now, so at night or under
  // cloud every plane goes down with it. A first form put the lit plane at full light and the side at the local colour:
  // on a light grey family the two were nearly one value, and a range seen with the sun behind the eye had no dark side
  // at all, SEEN at 150 m at noon; the references' rock is mid-value.)
  // (the lit plane only for a face squarely toward the sun's bearing, over 0.55: from 0.35 a range seen with the sun behind
  // the eye was all one lit plane, flat grey, SEEN at 420 m at noon)
  // (the side plane less 1.8 and a TEMPERATURE split, the look director's two numbers before v39.3: the lit plane leans
  // to the sun's colour, the side and the away planes to the cool violet shade key, so the two sides read by hue as well
  // as by value even with the sun behind the eye, gRockT for pcRockTemp)
  float s1 = smoothstep(-0.20, -0.10, b), s2 = smoothstep(0.50, 0.60, b);
  float lp = max(pcLevel(0.75, 0.02) - mix(mix(2.4, 1.8, s1), 0.5, s2) - 0.5 * gGully * (1.0 - s2), 0.0);
  gRockT = mix(mix(-1.0, -0.75, s1), 0.8, s2);
  lp = mix(min(lp, 1.0), lp, sunny);
  return mix(lvl, lp, gRockP);
}
// the rock dab's paint leaned warm or cool by its plane (pcRockPlanes' gRockT): toward the sun's own colour a little on
// the lit plane, toward a cool violet on the shaded ones (the shade key's hue, as the references paint rock in shade)
// (v2, the look director's numbers: the warm lean is the rock's OWN warm tone's hue (uRockM3, normalised; the sun's
// colour is near white at noon, so the first form leaned to almost nothing, rock S median 0.08 to 0.10 at noon, MEASURED)
// strengthened 2.2 times, and the cool lean 1.25 blue)
vec3 pcRockTemp(vec3 k) {
  if (gRockP <= 0.0) return k;
  vec3 wC = uRockM3 / max(dot(uRockM3, vec3(0.3, 0.5, 0.2)), 1e-3);
  wC = vec3(1.0) + (wC - vec3(1.0)) * 2.2;
  // (AT NOON the side and turned-away planes lean further to the cool violet, the look director after v39.4: with the sun
  // high their shade is shallow and the rock read as one grey, S median 0.07 at the noon views, MEASURED; 1.25 blue at a
  // low sun as before, up to the noon key with the sun overhead)
  float kN = smoothstep(0.55, 0.85, dot(gSunV, normalize(vUpV)));
  vec3 cool = mix(vec3(0.86, 0.84, 1.25), vec3(0.82, 0.80, 1.34), kN);
  vec3 t = gRockT > 0.0 ? mix(vec3(1.0), wC, gRockT) : mix(vec3(1.0), cool, -gRockT);
  return clamp(k * mix(vec3(1.0), t, gRockP), 0.0, 1.0);
}
#endif`;

// THE FLOWER DRIFTS FROM THE AIR (FV6(b) of the design, with flora B; ?bloomfar=1, the oil look, a world with flowers).
// From 150 m the drifts were a few flecks: a tint in the ground's wash cannot show a drift, only dabs in the flower's own
// colour, whole, can (B's stills on design-flora: final-meadow-150m-summer-old-new.jpg). world/bloom.js writes each full
// sample's drift cover (o.fd) and its colour as an index into the world's 16-colour palette (o.fi, from the look data,
// whites held to 0.80); patchgen.js packs them into aBloom (and its parent copy, the cover halfway, the index the stronger
// neighbour's). A ground dab whose own number is under 0.9 of the cover at its centre is laid in the flower's colour,
// in its own light and its usual shade; the ground between the dabs takes 0.45 of the drift. Nothing else changes.
export const BLOOM_VERT_DECL = /* glsl */`
#ifdef PC_BLOOMF
attribute vec4 aBloom;
attribute vec4 aBloomP;
varying float vBloomK;
flat varying vec2 vBloomI;
#endif
`;
export const BLOOM_VERT_MAIN = /* glsl */`
#ifdef PC_BLOOMF
  vBloomK = mix(aBloom.x, aBloomP.x, m);
  vBloomI = m > 0.5 ? aBloomP.yz : aBloom.yz;    // (an index is not interpolated: the triangle's first vertex names it; y the drift's kind, z the slope's)
#endif
`;
export const BLOOM_FRAG = /* glsl */`
#ifdef PC_BLOOMF
varying float vBloomK;
flat varying vec2 vBloomI;
uniform vec3 uBloomPal[16];
uniform float uBloomOn;     // 1 on a world whose flowers bloom.js hands over (farstand.js bloomFarOn), else 0
float gBloom = 0.0;         // this dab is a flower's (set in pcGroundAt, read in pcGroundPaint)
vec3 gBloomC;
float gBkdx, gBkdy;         // (main) the cover's screen derivatives
vec3 pcBloomPal(float i) { return uBloomPal[int(clamp(floor(i * 15.0 + 0.5), 0.0, 15.0))]; }
// is the dab at dsA (pixels to its centre, already held short) a flower: by its own number against the cover there
void pcBloomAt(vec2 dsA, vec3 rnd) {
  gBloom = 0.0;
  if (uBloomOn < 0.5) return;
  float k = clamp(vBloomK + gBkdx * dsA.x + gBkdy * dsA.y, 0.0, 1.0);
  if (k <= 0.02 || fract(rnd.z * 23.17 + rnd.y * 5.31) >= 0.9 * k) return;
  // (far off a dab takes the SLOPE's kind, bloom.js o.fi2, not its drift's own: every dab its own kind made a confetti
  // from 420 m, SEEN by flora B; whole dabs cross over from 250 to 400 m, each by its own number)
  float farK = smoothstep(250.0, 400.0, length(vView));
  gBloomC = pcBloomPal(fract(rnd.x * 7.13 + rnd.z * 3.7) < farK ? vBloomI.y : vBloomI.x);
  gBloom = 1.0;
}
#endif
`;
export function bloomUniforms() { return { uBloomPal: { value: new Float32Array(48) }, uBloomOn: { value: 0 } }; }

// THE UNIFORMS (plain arrays: three reads a vec3 from three numbers), and what writes them each frame.
export function canopyUniforms() {
  return {
    uCanA: { value: [0.8, 0.9, 0.4] }, uCanB: { value: [0.55, 0.8, 0.3] }, uCanC: { value: [0.3, 0.58, 0.3] },
    uCanF: { value: [0, 0, 0, 0] }, uCanN: { value: [0.3, 0.38, 0.26] }, uCanN2: { value: [0.18, 0.25, 0.19] },
    // x the grid, 8 m; y a crown's radius over the grid (0.62: 0.50 .. 0.73 of a cell, under the 0.75 the four cells
    // can reach; crowns 8 to 12 m across, the placer's own 9.6 m on the mean); z the nearest it is laid, 60 m; w on (1)
    // or off (0, a world with no painted canopy)
    uCanK: { value: [8.0, 0.62, 60.0, 0.0] },
  };
}
export function rockUniforms() {
  const L = ROCK_LOOK.earth;
  return { uRockK: { value: 0 }, uRockC0: { value: L.c[0].slice() }, uRockC1: { value: L.c[1].slice() }, uRockC2: { value: L.c[2].slice() },
    uRockC3: { value: L.c[3].slice() }, uRockB: { value: [L.bed, L.gully, 0, 0] },
    uRockM0: { value: L.mtn.c[0].slice() }, uRockM1: { value: L.mtn.c[1].slice() }, uRockM2: { value: L.mtn.c[2].slice() }, uRockM3: { value: L.mtn.c[3].slice() },
    uRockMH: { value: L.mtn.band.slice() } };
}
// THE CLIFFS' ROCK, a world at a time (FV4, the cliffs): its four tones, pale, mid, deep and slate, laid by local value
// (pcTone lights and shades them), a bed's mean height and the gullies' spacing in metres. Each tone is a mix of the
// shared pigments (data/looks/common.js), so no hue is invented here (the look rules, R2.1); it belongs in the world's
// look data (an oil.rock of earth.js), which is not this lane's file: asked of its owner. Earth: the coast's sandstone,
// a yellow ochre with a little Davy's grey (diluted, the lit bed had 22.8 per cent of its pixels over V 0.90 at noon:
// the look director, 24 Nov; the references' rock is mid-value) and a warm grey (Davy's grey with raw umber), a red umber bed (raw umber with burnt sienna) and a
// cool slate (Payne's grey); beds a few metres thick on a cliff of 25 m over the sea. The pale and the grey beds take
// turns with the dark ones (pcCliffC): under a full sun four tones at random came out one tan.
export const ROCK_LOOK = {
  earth: { c: [mixc(pig('yellowOchre'), pig('davysGrey'), 0.15), dilute(mixc(pig('davysGrey'), pig('rawUmber'), 0.4), 0.18),
               mixc(pig('rawUmber'), pig('burntSienna'), 0.4), dilute(pig('paynesGrey'), 0.25)], bed: 5.5, gully: 22,
    // THE MOUNTAINS' FAMILY (the look director's second audit, 3: "one rock family per mountain, grey-violet, with the bed
    // tones as small steps inside it"): a light grey-violet (Davy's grey, a little cobalt violet), a mid grey (Davy's with
    // Payne's), a deep blue-violet (Payne's with cobalt violet), a warm grey (Davy's with raw umber); over the band of
    // heights (m above the sea) where the coast's sandstone gives way to it
    mtn: { c: [dilute(mixc(pig('davysGrey'), pig('cobaltViolet'), 0.18), 0.22), mixc(pig('davysGrey'), pig('paynesGrey'), 0.35),
               mixc(pig('paynesGrey'), pig('cobaltViolet'), 0.25), dilute(mixc(pig('davysGrey'), pig('rawUmber'), 0.3), 0.1)], band: [35, 90] } },      // (from 60 to 140 m a mountain's lower flanks kept the pastel wash, SEEN; the coast's cliff tops are about 25 m)
};
export function seasonUniforms() {
  return { uSeasonG: { value: [0, 0, 0, 0] }, uCanSum: { value: [0.6, 0.8, 0.3] }, uCanAut: { value: [0.9, 0.6, 0.2] } };
}
// the crowns' mean wash at a season, as the painted canopy lays them: pcCanWash over the family run (the same piecewise
// split), at the middle of each crown's hue, a little of its depth
function crownMean(spec, t, out) {
  const A = [0, 0, 0], B = [0, 0, 0], C = [0, 0, 0];
  leafNow(spec.sum[0], spec.aut[0], t, A); leafNow(spec.sum[1], spec.aut[1], t, B); leafNow(spec.sum[2], spec.aut[2], t, C);
  const F = spec.fam, fa = F[3] * t, N = 40;
  out[0] = out[1] = out[2] = 0;
  const run = (u, o) => { for (let i = 0; i < 3; i++) o[i] = u < 0.5 ? A[i] + (B[i] - A[i]) * u * 2 : B[i] + (F[i] - B[i]) * (u * 2 - 1); return o; };
  const pa = [0, 0, 0], pb = [0, 0, 0];
  for (let k = 0; k < N; k++) {
    const tf = (k + 0.5) / N;
    const cF = tf < 0.4 ? tf * 0.5 : (tf < 0.8 ? 0.3 + (tf - 0.4) * 0.75 : 0.75 + (tf - 0.8) * 1.25);
    run(Math.min(1, Math.max(0, cF - 0.13)), pa); run(Math.min(1, Math.max(0, cF + 0.13)), pb);
    for (let i = 0; i < 3; i++) {
      const lA = A[i] + (pa[i] - A[i]) * fa, lB = B[i] + (pb[i] - B[i]) * fa;
      const lC = C[i] + ((pb[i] + (C[i] - pb[i]) * 0.55) * [0.92, 0.80, 0.84][i] - C[i]) * fa;
      out[i] += ((lA + lB) * 0.5 * 0.92 + lC * 0.08) / N;
    }
  }
  return out;
}

// The colours of a world's crowns, gathered once from its look data exactly as flora.js gathers the far trees': each
// kind as the oil look lays it (its `oil` entry over it), the broadleaves' summer and autumn dresses and their family
// colour averaged over the kinds that stand in its woods, and the needle trees' washes. null: no tall kinds at all.
const _specs = new Map();
function canopySpec(S) {
  if (_specs.has(S.id)) return _specs.get(S.id);
  const tall = (S.look.flora && S.look.flora.tall) || [];
  // how much of its wood each kind fills, as the placer chooses (floraplace.js): the grove field gives the first pair of
  // a biome's kinds about three quarters of the wood and shares the rest among the other pairs; within a pair the first
  // kind takes the biome's mix (oil.tallMix where the oil look sets one). Each wooded biome counts once.
  const wt = new Map();
  let famMax = 0;      // (the largest share of a wood's broadleaves, by how much they fill, that carry a family colour)
  for (const b of S.biomes) {
    const T = b.tall || [];
    if (!T.length) continue;
    const np = T.length >> 1 || 1;
    const tm = MODE.oil && b.oil && typeof b.oil.tallMix === 'number' ? b.oil.tallMix : b.tallMix;
    const mix = typeof tm === 'number' ? Math.min(1, tm) : 0.5;
    let fb = 0, bb = 0;
    const put = (k, w) => {
      wt.set(k, (wt.get(k) || 0) + w);
      const sp = tall[k] ? Object.assign({}, tall[k], tall[k].oil || null) : null;
      if (sp && !NEEDLE.has(sp.kit)) { bb += w; if (sp.fam) fb += w * (sp.fam[3] == null ? 1 : sp.fam[3]); }
    };
    for (let p = 0; p < np; p++) {
      const wp = np === 1 ? 1 : p === 0 ? 0.75 : 0.25 / (np - 1);
      const ta = T[p * 2], tb = T[p * 2 + 1] != null ? T[p * 2 + 1] : ta;
      put(ta, wp * (ta === tb ? 1 : mix));
      if (tb !== ta) put(tb, wp * (1 - mix));
    }
    if (bb > 0) famMax = Math.max(famMax, fb / bb);
  }
  const add = (acc, c, w) => { for (let i = 0; i < 3; i++) acc[i] += c[i] * w; };
  const sum = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], aut = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], ned = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const fam = [0, 0, 0], famW = [0];
  let nb = 0, nn = 0, nf = 0;
  for (const [k, w] of wt) {
    const sp0 = tall[k];
    if (!sp0 || !(w > 0)) continue;
    const sp = Object.assign({}, sp0, sp0.oil || null);
    if (NEEDLE.has(sp.kit)) { for (let j = 0; j < 3; j++) add(ned[j], sp.leaf[j], w); nn += w; continue; }
    const turns = !!(sp.leafSum || sp.leafAut);
    const s = turns ? sp.leafSum || sp.leaf : sp.leaf, a = turns ? sp.leafAut || sp.leaf : sp.leaf;
    for (let j = 0; j < 3; j++) { add(sum[j], s[j], w); add(aut[j], a[j], w); }
    nb += w;
    if (sp.fam) { add(fam, sp.fam, w); nf += w; famW[0] += (sp.fam[3] == null ? 1 : sp.fam[3]) * w; }
  }
  let spec = null;
  if (nb + nn > 0) {
    const div = (m, n) => m.map((c) => c.map((v) => v / Math.max(n, 1e-9)));
    spec = { sum: div(sum, nb), aut: div(aut, nb), needle: div(ned, nn),
      // (the family run's strength: in the wood where it is strongest, the share of the broadleaves, by how much they
      // fill, that carry a family colour -- the autumn wood's round maples, about two thirds of its trees. ONE number
      // for the whole world, so the green wood's painted roof takes it too in autumn though its own trees carry none:
      // a known mismatch, small, and the price of a body-wide material)
      fam: nf ? [fam[0] / nf, fam[1] / nf, fam[2] / nf, famMax] : [0, 0, 0, 0], nb, nn };
    if (!nb) { spec.sum = spec.needle; spec.aut = spec.needle; }
    if (!nn) spec.needle = [[0.30, 0.38, 0.26], [0.22, 0.30, 0.21], [0.15, 0.21, 0.17]];
  }
  _specs.set(S.id, spec);
  return spec;
}

// THE SPEED TEST'S HANDLE (core/bench.js): `off` lays no canopy at run time -- the same picture as ?canopy=0, with the
// same program and meshes, so a row can time the canopy's paint alone. Nothing else sets it.
export const CANOPY_BENCH = { off: false };

// Each frame (terrain.js update): the season's crowns into the ground's uniforms. A handful of numbers.
const _c = [0, 0, 0];
export function syncCanopy(material, S) {
  const u = material && material.uniforms;
  if (u && u.uBloomPal) {
    const on = bloomFarOn(S);
    u.uBloomOn.value = on ? 1 : 0;
    if (on && u.uBloomPal.userData !== S.id) {
      const p = bloomPaletteOf(S), a = u.uBloomPal.value;
      for (let i = 0; i < 16; i++) for (let t = 0; t < 3; t++) a[i * 3 + t] = p.colours[i] ? p.colours[i][t] || 0 : 0;
      u.uBloomPal.userData = S.id;
    }
  }
  if (u && u.uRockK) {
    u.uRockK.value = MODE.oil && CANOPY_WORLDS[S.id] ? 1 : 0;
    if (u.uRockB) u.uRockB.value[2] = S.sea == null ? 0 : S.sea;
  }
  if (!u || !(u.uCanK || u.uSeasonG)) return;
  const spec = MODE.oil && CANOPY_WORLDS[S.id] ? canopySpec(S) : null;
  if (u.uSeasonG) u.uSeasonG.value[1] = 0;
  if (u.uCanK) u.uCanK.value[3] = spec && canopyOn(S.id) && !CANOPY_BENCH.off ? 1 : 0;
  if (!spec) return;
  const t = SEASON.t;
  if (u.uCanA) {
    leafNow(spec.sum[0], spec.aut[0], t, _c); u.uCanA.value[0] = _c[0]; u.uCanA.value[1] = _c[1]; u.uCanA.value[2] = _c[2];
    leafNow(spec.sum[1], spec.aut[1], t, _c); u.uCanB.value[0] = _c[0]; u.uCanB.value[1] = _c[1]; u.uCanB.value[2] = _c[2];
    leafNow(spec.sum[2], spec.aut[2], t, _c); u.uCanC.value[0] = _c[0]; u.uCanC.value[1] = _c[1]; u.uCanC.value[2] = _c[2];
    // (the family's red is an AUTUMN colour: its amount rides the season, as flora.js setSeason does for uFarFam)
    u.uCanF.value[0] = spec.fam[0]; u.uCanF.value[1] = spec.fam[1]; u.uCanF.value[2] = spec.fam[2]; u.uCanF.value[3] = spec.fam[3] * t;
    const n = spec.needle;
    for (let i = 0; i < 3; i++) { u.uCanN.value[i] = n[0][i] * 0.5 + n[1][i] * 0.5; u.uCanN2.value[i] = n[2][i]; }
  }
  // (FV3: the year on the ground. The two means are the same all year; only the season's number moves.)
  if (u.uSeasonG) {
    u.uSeasonG.value[0] = t; u.uSeasonG.value[1] = spec.nb > 0 ? 1 : 0;
    if (!spec.means) spec.means = [crownMean(spec, 0, [0, 0, 0]), crownMean(spec, 1, [0, 0, 0])];
    for (let i = 0; i < 3; i++) { u.uCanSum.value[i] = spec.means[0][i]; u.uCanAut.value[i] = spec.means[1][i]; }
  }
}

// THE FAR VIEW'S WATER LINE (?farwater=1; the water group's lead, written here with C's agreement, 24 Nov; docs/notes/water.md
// "THE WATER FROM THE AIR" on design-water). From high up the ground's patches are coarse: they drop a river's water mesh
// (world/patchgen.js: thin water is left to the far colour) and a river of 19 m falls between vertices 40 to 60 m apart, so
// from 1 km a river of the tree was lost. The mesher packs at each vertex the SIGNED distance to the nearest river's centre
// line (its sign the side of the river), which passes through zero across the river and interpolates truly between
// vertices however far apart they lie, the river's half width, and its size (no river near: two rivers' distances of
// opposite sign would cross zero between them). The river is then laid as wide as it is, at each pixel, over the ground's
// paint, in the tone of water seen from above (the sky's, as the water's own paint takes it). WHY AT EACH PIXEL AND NOT IN
// THE DABS (C asked for the dabs; tried, 24 Nov 17:00, and SEEN to lose the river again): from 1 km the river is about 7
// pixels wide, narrower than a dab, and a dab is painted whole from its centre, so few dabs ever took the water and the
// line broke up. Only past 250 m (nearer, the water's own mesh holds the river). Compiled in only with the oil look and
// ?farwater=1 (render/materials.js); the mesher packs nothing without it.
export const FARWATER_VERT_DECL = /* glsl */`
#ifdef PC_FARWATER
attribute vec4 aFarW;     // the signed distance to a river's centre (0.5 on it), its size, the river's half width
attribute vec4 aFarWP;    // the same as the parent patch paints it
varying vec3 vFarW;
#endif`;
export const FARWATER_VERT_MAIN = /* glsl */`
  #ifdef PC_FARWATER
    vFarW = mix(aFarW.xyz, aFarWP.xyz, m);
  #endif`;
export const FARWATER_FRAG = /* glsl */`
#ifdef PC_FARWATER
varying vec3 vFarW;
// how much of this pixel is river: 1 inside, 0 out, over the pixel's own share of the distance (a crisp edge of about a
// pixel). Its width breathes: br along it, and the pools are in the packed half width already. Near the eye it does not
// fade out but NARROWS to nothing, from 500 m to 250 m (the look director: by whole width, never a soft cross-fade)
float pcFarWater(vec3 fw, float aa, float dist, float br) {
  float sd = (fw.x - 0.5) * 96.0, dc = fw.y * 48.0, hw = fw.z * 24.0;
  float hwE = hw * br * smoothstep(250.0, 500.0, dist);
  aa = max(aa, 0.05);
  return (1.0 - smoothstep(hwE - aa, hwE + aa, abs(sd))) * step(0.75, hw) * step(0.05, hwE) * (1.0 - smoothstep(41.0, 46.0, dc));
}
// the ground's paint c with the river laid over it. ITS COLOUR (the look director, 24 Nov, after a darker try lost it): water
// far off mirrors the sky, so it is the LAKE'S OWN COLOUR at that distance, by the angle -- the water's own paint's sky
// (WATER_FRAG, v37's: the sky from horizon to zenith along the reflected ray, three tenths of white, the liquid's wash taken
// in and the mirror's share of it) -- pale blue toward grazing, the zenith's deeper blue looking down; and looking nearly
// straight down, the water's body, a step darker than the land beside it. The liquid: the landing wood's (the autumn
// woodland's, looks/earth.js: the rivers of the tree are drawn only on a wood). The air is laid over it after, as over the lake.
uniform vec3 uSkyZenith;
uniform vec3 uSkyHorizon;
vec3 pcFarWaterLay(vec3 c, float dist) {
  float br = 0.82 + 0.36 * texture(uNoise3D, vBody / 85.0).r;      // (riffles narrower, reaches wider, over about 100 m)
  float k = pcFarWater(vFarW, fwidth(vFarW.x) * 72.0, dist, br);
  if (k <= 0.0) return c;
  float re = clamp(dot(normalize(vUpV), normalize(-vView)), 0.0, 1.0);   // (the reflected ray's height: 1 looking straight down)
  const vec3 liq = vec3(0.68, 0.78, 0.84);
  vec3 skyc = mix(mix(uSkyHorizon, uSkyZenith, clamp(re * 1.2, 0.0, 1.0)), vec3(1.0), 0.30);
  vec3 mir = mix(pcDensity(liq, 1.0), pcDensity(skyc * mix(vec3(1.0), liq, 0.35), 1.12), 0.72);
  // (and a step deeper and bluer: the water's own paint averages its light and dark strokes to this; with the sky's alone
  //  the line came out a step lighter and greyer than the lake beside it, SEEN 18:10: V 0.81 S 0.11 against V 0.71 S 0.17)
  mir *= vec3(0.74, 0.78, 0.82);
  vec3 bodyW = mix(mix(uHaze, vec3(1.0), 0.30), vec3(0.45, 0.62, 0.86), 0.5);
  float lw = dot(bodyW, vec3(0.299, 0.587, 0.114)), lc = dot(c, vec3(0.299, 0.587, 0.114));
  bodyW *= 0.70 * lc / max(lw, 1e-3);
  return mix(c, mix(mir, bodyW, smoothstep(0.80, 0.93, re)), k);
}
#endif`;
