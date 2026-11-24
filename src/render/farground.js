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
import { CANOPY, NEEDLE, CANOPY_WORLDS, canopyOn } from '../world/farstand.js';
import { MODE } from '../data/mode.js';

export { CANOPY, canopyOn };
const GROUND_SEASON_DEFAULT = false;
// ?candab=: the canopy's own dabs against the ground's (0.5: its finer layer is half the ground's finest, its coarser
// layer the ground's finest). From a few hundred metres up the ground's dab is as big as a whole crown, so the roof's
// cap and shaded side could not be laid with it; a crown wants three or four strokes across.
export const CANOPY_DAB = (() => { try { const q = new URLSearchParams(location.search); const v = q.has('candab') ? +q.get('candab') : 0.5; return isFinite(v) && v > 0.05 ? Math.min(v, 1) : 0.5; } catch (e) { return 0.5; } })();
// ?groundseason=0|1: THE FLOOR AND THE FAR COLOUR FOLLOW THE YEAR (FV3; see SEASON_FRAG below). Read once.
export const GROUND_SEASON = (() => { try { const q = new URLSearchParams(location.search); return q.has('groundseason') ? +q.get('groundseason') > 0 : GROUND_SEASON_DEFAULT; } catch (e) { return GROUND_SEASON_DEFAULT; } })();
// ?candebug=1: each dab of the canopy in a flat colour that says what it is (see the end of pcCanopyAt). For looking only.
export const CANOPY_DEBUG = (() => { try { return new URLSearchParams(location.search).get('candebug') === '1'; } catch (e) { return false; } })();

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
  for (int LC = 0; LC < 2; LC++) {
    if (rem < 0.004) break;
    float wsC = (LC == 0 ? 1.0 : 2.0) * PC_CAN_DAB, wC = o4x * wsC;
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
//   * a wood's far colour (vCol2, wherever the canopy is: parC.z) is moved by the difference between the crowns' mean
//     wash NOW and the season the palette was painted for -- which is read off the palette itself: a gold far colour is
//     an autumn one, a green one a summer one -- so the far wood is the colour its trees are, all year;
//   * the share of the floor's dabs laid as fallen leaves is a quarter of itself in high summer and all of it in autumn;
//   * and a fallen leaf in summer is last year's: the floor's own wash taken toward its brown, not a fresh crown colour.
// AT THE TOP OF AUTUMN (t = 1) NOTHING MOVES in the autumn wood: the move is zero where the palette is gold, the leaves'
// share and colour are exactly what they were. That is the owner's approved autumn floor, kept to the bit.
// ?groundseason=0 compiles none of it.
export const SEASON_FRAG = /* glsl */`
#ifdef PC_SEASONG
uniform vec4 uSeasonG;    // x the year (0 high summer .. 1 deep autumn), y 1: on (a world whose trees turn)
uniform vec3 uCanSum;     // the crowns' mean wash in high summer and in deep autumn (farground.js: the canopy's own mean)
uniform vec3 uCanAut;
vec3 pcSeasonFar(vec3 c2, float canopy) {
  if (uSeasonG.y < 0.5) return c2;
  float refA = smoothstep(0.0, 0.06, c2.r - c2.g);
  vec3 sh = mix(uCanSum, uCanAut, uSeasonG.x) - mix(uCanSum, uCanAut, refA);
  return clamp(c2 + sh * clamp(canopy * 1.2, 0.0, 1.0), 0.0, 1.0);
}
float pcSeasonLeafK() { return uSeasonG.y < 0.5 ? 1.0 : mix(0.25, 1.0, uSeasonG.x); }
vec3 pcSeasonLeaf(vec3 leaf, vec3 floorC) {
  if (uSeasonG.y < 0.5) return leaf;
  return mix(leaf, pcDensity(floorC * vec3(1.0, 0.84, 0.64), 1.3), (1.0 - uSeasonG.x) * 0.85);
}
#endif`;

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
