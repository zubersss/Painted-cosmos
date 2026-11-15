// Painted Cosmos: the watercolor post passes. OWNER: PAINTER.
//
//   scene (MRT, internal res)      colour+wetness, normal+depth+region
//   -> prep (half res, mipmapped)  mean colour + mean luma^2, and wetness-premultiplied colour
//   -> abstraction (internal res)  brush-sized shapes (mip Kuwahara), wet-in-wet bleed
//   -> pool (half res)             (R1 re-fix) the washes' value at a few pixels and its surround, and its gradient
//   -> edges (internal res)        (R1 re-fix) where an outline is, and the pencil's line, from the region target
//   -> [post AA (internal res)]    (R1 re-fix) a light FXAA where the scene is drawn with one sample (tier 0, phones)
//   -> sheet (output res)          wobble, pigment pooling at wash edges, granulation in the
//                                  paper grain, graphite underdrawing, ragged border, paper
//
// Only paper effects live in screen space (grain, wobble, border). Everything that belongs to
// the painting (wash variation, strokes, light) is anchored in the world by the materials.
import * as THREE from 'three';
import { getTextures, G, PREV, LOOK, OIL } from './shared.js';

const FS_VERT = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// the 8-bit fallback's unpacking (shared.js uAux8), for the passes that read the scene's second target
const AUX_DEC = /* glsl */`
uniform float uAux8;
vec4 pcAuxDec(vec4 a) { return uAux8 > 0.5 ? vec4(a.xy * 2.0 - 1.0, a.z * 32.0, a.w * 8.0 + 0.02) : a; }
`;

const PREP_FRAG = /* glsl */`
uniform sampler2D tScene;
uniform vec2 uTexel;
varying vec2 vUv;
layout(location = 1) out highp vec4 pcB;
void main() {
  vec4 a = texture(tScene, vUv + uTexel * vec2(-1.0, -1.0));
  vec4 b = texture(tScene, vUv + uTexel * vec2(1.0, -1.0));
  vec4 c = texture(tScene, vUv + uTexel * vec2(-1.0, 1.0));
  vec4 d = texture(tScene, vUv + uTexel * vec2(1.0, 1.0));
  vec3 W = vec3(0.3, 0.5, 0.2);
  float la = dot(a.rgb, W), lb = dot(b.rgb, W), lc = dot(c.rgb, W), ld = dot(d.rgb, W);
  gl_FragColor = vec4((a.rgb + b.rgb + c.rgb + d.rgb) * 0.25, (la * la + lb * lb + lc * lc + ld * ld) * 0.25);
  pcB = vec4(a.rgb * a.a + b.rgb * b.a + c.rgb * c.a + d.rgb * d.a, a.a + b.a + c.a + d.a) * 0.25;
}
`;

// (R1 W2.2) the near brush's statistics at the scene's own size: the colour and the luma squared of each pixel, mipmapped
// (the half-size prep is a 4 px box at its finest: a brush of a pixel or two read from it was a 4 px blur)
const PREPF_FRAG = /* glsl */`
uniform sampler2D tScene;
varying vec2 vUv;
void main() {
  vec3 c = texture(tScene, vUv).rgb;
  float l = dot(c, vec3(0.3, 0.5, 0.2));
  gl_FragColor = vec4(c, l * l);
}
`;

// (R1 W2.5) The region through the multisample resolve. The scene pass's second target is drawn with four (or two)
// samples a pixel and resolved by averaging them, so a pixel half sky (0) and half foliage (4) came out 2: water. Every
// material writes its region squared beside it (chunks.js pcWrite, .y), so after the resolve y - w^2 is the spread of
// the regions under the pixel: 0 where every sample lay on one region. Such a pixel is kept as it is (its depth and
// normal the mean of its samples, on one surface); a pixel whose samples lay on different regions takes the whole of
// the neighbour (3x3, then 5x5) nearest it in depth whose samples did not; with none, the region its samples' spread
// points to (w2 / w: exact where one of them is the sky). Every reader of the second target reads this one.
export const AUXFIX_FRAG = /* glsl */`
uniform highp sampler2D tAux;
const float MIXED = 0.12;
void main() {
  ivec2 ip = ivec2(gl_FragCoord.xy), hi = textureSize(tAux, 0) - 1;
  highp vec4 a = texelFetch(tAux, ip, 0);
  if (a.y - a.w * a.w < MIXED) { gl_FragColor = a; return; }
  highp vec4 best = a;
  float bd = 1e9;
  for (int r = 1; r <= 2; r++) {
    for (int j = -r; j <= r; j++) for (int i = -r; i <= r; i++) {
      if (max(abs(i), abs(j)) != r) continue;
      highp vec4 n = texelFetch(tAux, clamp(ip + ivec2(i, j), ivec2(0), hi), 0);
      float dz = abs(n.z - a.z);
      if (n.y - n.w * n.w < MIXED && dz < bd) { bd = dz; best = n; }
    }
    if (bd < 1e8) break;
  }
  if (bd > 1e8) best.w = a.y / max(a.w, 1e-3);
  gl_FragColor = best;
}
`;

// (R1 re-fix) the brush's two reads of the paper (the sectors' rotation and the bleed's feather) depend only on the pixel
// and the scene's size: laid once per size in full floats (the very values the reads give: in 8 bits the bleed's
// colour, a ratio of two small sums where the wash is barely wet, and the brush's choice of sector moved visibly) and
// fetched once a pixel; where the browser cannot draw into float targets the brush reads the paper itself
const ABSPAPER_FRAG = /* glsl */`
uniform sampler2D tPaper;
uniform vec2 uTexel;
uniform vec2 uRes;
varying vec2 vUv;
void main() {
  float aspect = uRes.y / uRes.x;
  float rot = textureLod(tPaper, vUv * vec2(1.0, aspect) * 2.3, max(0.0, log2(1177.6 * uTexel.x))).b;
  gl_FragColor = vec4(rot, texture(tPaper, vUv * vec2(1.0, aspect) * 5.1).ba, 1.0);
}
`;

const ABS_FRAG = /* glsl */`
uniform sampler2D tScene;
uniform sampler2D tAbsP;   // (R1 re-fix) ABSPAPER_FRAG
uniform highp sampler2D tAux;
uniform highp sampler2D tHalfA;
uniform highp sampler2D tFullA;   // (R1 W2.2) PREPF_FRAG's statistics at the scene's size
uniform sampler2D tHalfB;
uniform sampler2D tPaper;
uniform vec2 uTexel;       // 1 / internal resolution
uniform vec2 uRes;         // internal resolution
uniform vec4 uBrush;       // near radius, far radius (fractions of height: the old brush), bleed radius, bleed amount
uniform vec2 uBrushR;      // (R1 W2.2) x the near brush's radius in internal pixels, y 1: the old brush (below)
uniform float uAbstraction;
varying vec2 vUv;
${AUX_DEC}
const vec3 W = vec3(0.3, 0.5, 0.2);
void main() {
  vec4 c0 = texture(tScene, vUv);
  vec4 aux = pcAuxDec(texture(tAux, vUv));
  float wet = c0.a;
  float cls = floor(aux.w + 0.001);
  float far = smoothstep(3.6, 8.2, aux.z);
  // solid props (trunks, rocks, characters) keep more of their drawing
  float keepN = cls == 3.0 || cls == 5.0 ? 0.72 : 0.30;
  // region 6: small crisp marks (splash rings) the brush leaves as they were drawn
  if (cls == 6.0) keepN = 0.92;
  // region 8: a light of its own (a lamp, a flame, a lit cabin): its small warm shape is kept too
  if (cls == 8.0) keepN = 0.85;
  // (R1 W2.2, docs/lead/SHARP-SMOOTH-PLAN.md: the brush turned round. It was a brush that grew with the distance and
  // repainted every far pixel: from the ship all the ground is far, and all of it was 6 to 9 px blots. Now the near
  // things take a small brush, a pixel or two of the scene's own size, and with the distance it lets the scene through:
  // from the air the land is drawn as the scene drew it. The palette, the paper, the washes, the pooling, the grain and
  // the pencil are all still laid by the sheet.)
  float keep = mix(keepN, 1.0, far);
  float r = min(uBrushR.x, 2.0) * (1.0 - far);         // brush radius in internal pixels
  float lod = max(0.0, log2(max(r, 1.0)));              // (read from the statistics at the scene's own size)
  // (the old brush where the scene is drawn under 0.6 of the sheet's size, which only a pinned scale reaches: there the
  // big far brush is what smooths the enlargement's steps. Far things fewer, larger, softer strokes, repainted whole.)
  if (uBrushR.y > 0.5) {
    keep = cls == 6.0 || cls == 8.0 ? keepN : (1.0 - far) * keepN;
    r = mix(uBrush.x, uBrush.y, far) * uRes.y;
    lod = max(0.0, log2(max(r, 1.0)) - 1.0);
  }
  keep = mix(1.0, keep, uAbstraction);
  vec3 col = c0.rgb;
  float aspect = uRes.y / uRes.x;
#ifdef PC_ABSP_BAKED
  vec4 ap = texelFetch(tAbsP, ivec2(gl_FragCoord.xy), 0);
#else
  vec4 ap = vec4(textureLod(tPaper, vUv * vec2(1.0, aspect) * 2.3, max(0.0, log2(1177.6 * uTexel.x))).b, texture(tPaper, vUv * vec2(1.0, aspect) * 5.1).ba, 1.0);
#endif
  // (where the scene is let through whole the sectors are not read at all)
  if (keep < 0.995) {
    vec3 acc = vec3(0.0);
    float wsum = 0.0;
    // a fixed-on-paper rotation breaks the regular 8-fold symmetry of the sectors
    // (its level set by hand: an implicit one is undefined inside a branch some pixels of a quad skip)
    float rot = ap.r * 6.283;
    for (int k = 0; k < SECTORS; k++) {
      float a = rot + float(k) * (6.2831853 / float(SECTORS));
      vec2 off = vec2(cos(a), sin(a)) * r * 0.62 * uTexel;
      vec4 m = uBrushR.y > 0.5 ? textureLod(tHalfA, vUv + off, lod) : textureLod(tFullA, vUv + off, lod);
      float l = dot(m.rgb, W);
      float var = max(0.0, m.a - l * l);
      float w = 1.0 / (0.00012 + var * var * 900.0 + var * 0.6);
      acc += m.rgb * w; wsum += w;
    }
    col = mix(acc / wsum, c0.rgb, keep);
  }
  // wet-in-wet: wet areas take up the (wetness-weighted) colour around them, feathered
  // (R1 re-fix: not read where the pixel is dry: under 0.035 the bleed moves it by under a thousandth)
  if (wet > 0.035) {
    vec2 feather = (ap.gb - 0.5) * uBrush.z * 1.4;
    float blod = max(0.0, log2(max(uBrush.z * uRes.y, 1.0)) - 1.0);
    vec4 wb = textureLod(tHalfB, vUv + feather * vec2(aspect, 1.0), blod);
    vec3 bleed = wb.rgb / max(wb.a, 0.001);
    float bl = wet * wet * uBrush.w * smoothstep(0.02, 0.25, wb.a);
    // (R1 re-fix: the bleed takes up the colour round it, but its step in value is at most 6/255: over the far land's haze
    // and under the storm's rain it laid a nine-pixel average of the wet ground round a pixel into it, a value outside
    // anything near it (the halo share of the brush's output was 0.70 % at E_1000_45 and 0.82 % under the storm, the plan
    // allows 0.5 %; 0 and 0.003 % with the cap, the mean colour the same to a tenth of a level))
    vec3 cb = mix(col, bleed, bl);
    float dl = dot(cb - col, W);
    col = cb - sign(dl) * max(abs(dl) - 6.0 / 255.0, 0.0);
  }
  gl_FragColor = vec4(col, wet);
}
`;

// (R1 W2.4, re-fix) The paper under a pixel of the sheet: six reads of the paper texture, which depend only on the pixel
// and the sheet's size (and uBoil and the border's settings), laid once per size into one target and read back with
// three fetches (PAPERS_FRAG). PAPER_LIVE and PAPER_STATIC are the reads; PAPER_TERMS gathers them into
// what the sheet uses: the tremor's offset w0, the border's paper terms (b0, and bD where a dark wash changes it), the
// dry edge's two measures (skL light, skD dark), the pencil's paper factor (lineP) and the grain's own values. The
// 8-bit fallback (no float targets) reads the paper live with the same text (PC_PAPER_BAKED undefined).
const PAPER_LIVE = /* glsl */`
  {
    vec4 plo = texture(tPaper, puv * 0.19 + 0.37);
    vec4 pmid = texture(tPaper, puv * 0.47 + 0.11 + uBoil);
    w0 = (pmid.ba - 0.5) * 2.0 + (plo.ba - 0.5) * 1.2;
    ploR = plo.r; ploG = plo.g; pmidR = pmid.r; pmidG = pmid.g;
  }
`;
// in: puv, uBoil, uBorder; out: ph, s1 (the dark wash's dry edge, but for the live part), bnP0, bnPD (the border's
// paper: bn's own term and the term the dark wash adds), psoftR, pfine, pmed
const PAPER_STATIC = /* glsl */`
  {
    vec4 paper = texture(tPaper, puv, 0.55);
    vec4 psoft = texture(tPaper, puv * 0.47 + 0.11 + uBoil, 3.6);
    pfine = texture(tPaper, puv, 1.5).r; pmed = texture(tPaper, puv * 0.47 + 0.11 + uBoil, 1.2).r;
    ph = paper.r; psoftR = psoft.r;
    s1 = psoft.r * 0.6 + (pmed - 0.5) * 0.2;
    bnP0 = (paper.g - 0.5) * 0.006;
    bnPD = psoft.g * uBorder.y * 0.45 - (paper.g - 0.5) * 0.006;
  }
`;
// in: the reads' values; out: b0, bD, skL, skD, lineP (the sheet's own formulas, gathered)
const PAPER_TERMS = /* glsl */`
  b0 = (ploG - 0.5) * uBorder.y + (pmidG - 0.5) * uBorder.y * 0.45 + bnP0;
  bD = bnPD - pmidG * uBorder.y * 0.45;
  skL = smoothstep(0.46, 0.62, mix(ph, pmidR, 0.65));
  skD = smoothstep(0.63, 0.72, s1 + ploR * 0.4) * 0.55;
  lineP = smoothstep(0.50, 0.70, ploR + (pmidR - 0.5) * 0.7) * (0.30 + 0.70 * smoothstep(0.35, 0.6, ph));
`;
// The paper laid into three targets (PAPERS_FRAG, three fetches): 0 (half floats) the tremor w0 and the border's two
// terms (they go through steep steps), 1 (half floats) ph, pmidR, ploR and the dark wash's dry edge skD (the light
// one, skL, and the pencil's paper factor are made from these in the sheet), 2 (8-bit) ploG psoftR pfine pmed (they
// move a wash by under a thousandth). (An integer target would hold it all in one fetch, but the station harness's
// read counter cannot follow an integer texture.)
const PAPERS_FRAG = /* glsl */`
uniform sampler2D tPaper;
uniform vec2 uOutRes;
uniform vec2 uBoil;
uniform vec4 uBorder;
layout(location = 1) out highp vec4 pcP1;
layout(location = 2) out highp vec4 pcP2;
void main() {
  float sc = max(uOutRes.y / 1080.0, 0.62);
  vec2 puv = gl_FragCoord.xy / (512.0 * sc);
  vec2 w0; float ploR, ploG, pmidR, pmidG, ph, s1, bnP0, bnPD, psoftR, pfine, pmed, b0, bD, skL, skD, lineP;
  ${PAPER_LIVE}
  ${PAPER_STATIC}
  ${PAPER_TERMS}
  gl_FragColor = vec4(w0, b0, bD);
  pcP1 = vec4(ph, pmidR, ploR, skD);
  pcP2 = vec4(ploG, psoftR, pfine, pmed);
}
`;

// (R1 re-fix) The washes' value a few pixels wide and its broad surround, and the change of the first across 2 px of the
// scene each way, at half size: the sheet's edge test, its pooling and its rim read them here (they were seven reads of
// the half-size prep a pixel of the sheet). Out 0: the value at lod 0.6 and the surround at lod 2.2 (luma), the change
// in x (r, g); out 1: its b, the change in y. The changes are kept as colours, not as the rim's measure (their lengths):
// a colour difference of the bilinear prep is itself bilinear, so read between these texels it is the sheet's own
// (a length read between them was not: 0.3 to 0.5 of a 255th on average, tens at a few edges).
const POOL_FRAG = /* glsl */`
uniform highp sampler2D tHalfA;
uniform vec2 uInTexel;
uniform float uAux8;      // (the 8-bit fallback: the changes, signed, stored as 0.5 + c / 2)
varying vec2 vUv;
layout(location = 1) out highp vec4 pcQ1;
const vec3 W = vec3(0.3, 0.5, 0.2);
void main() {
  vec2 go = uInTexel * 2.0;
  vec3 m = textureLod(tHalfA, vUv, 0.6).rgb;
  float sur = dot(textureLod(tHalfA, vUv, 2.2).rgb, W);
  vec3 cx = textureLod(tHalfA, vUv + vec2(go.x, 0.0), 0.6).rgb - textureLod(tHalfA, vUv - vec2(go.x, 0.0), 0.6).rgb;
  vec3 cy = textureLod(tHalfA, vUv + vec2(0.0, go.y), 0.6).rgb - textureLod(tHalfA, vUv - vec2(0.0, go.y), 0.6).rgb;
  if (uAux8 > 0.5) { cx = cx * 0.5 + 0.5; cy = cy * 0.5 + 0.5; }
  gl_FragColor = vec4(dot(m, W), sur, cx.rg);
  pcQ1 = vec4(cx.b, cy);
}
`;

// (R1 re-fix) Outlines and the pencil from the region target, a pixel of the scene at a time (the sheet read the region
// target six times a pixel for them). Out 0 (R): the sheet's outline test where it does not need the picture: a step in
// depth over 2 px, or a class that draws an outline (the sky, the water, a figure or the ship) meeting another. Out 1:
// the pencil's line before its paper factor, for the four ways the sheet's reads 1.5 px over fall (+1 or +2 texels in x
// and in y, as the sheet's read point lies in the first or second half of its texel): the sheet picks one, so the line
// is the one the sheet drew.
const EDGE_FRAG = /* glsl */`
uniform highp sampler2D tAux;
layout(location = 1) out highp vec4 pcL;
${AUX_DEC}
float pcLine(vec4 a0, vec4 a1, vec4 a2) {
  float dz = max(abs(a1.z - a0.z), abs(a2.z - a0.z));
  float c0 = floor(a0.w), c1 = floor(a1.w), c2 = floor(a2.w);
  // region changes count only where a solid thing (prop, character) meets something else
  float solid = max(step(2.5, c0) * step(c0, 3.5) + step(4.5, c0) * step(c0, 5.5), max(step(2.5, c1) * step(c1, 3.5) + step(4.5, c1) * step(c1, 5.5), step(2.5, c2) * step(c2, 3.5) + step(4.5, c2) * step(c2, 5.5)));
  c0 = min(c0, 5.0); c1 = min(c1, 5.0); c2 = min(c2, 5.0);
  float idc = max(abs(c1 - c0), abs(c2 - c0)) * min(solid, 1.0);
  float fol = max(step(3.5, a0.w) * step(a0.w, 4.99), max(step(3.5, a1.w) * step(a1.w, 4.99), step(3.5, a2.w) * step(a2.w, 4.99)));
  float line = max(smoothstep(0.14, 0.38, dz) * 0.6, min(idc, 1.0) * 0.38) * (1.0 - fol * 0.85);
  line *= 1.0 - max(step(5.5, a0.w), max(step(5.5, a1.w), step(5.5, a2.w)));   // nothing is outlined in the air
  return line * (1.0 - smoothstep(6.5, 9.5, a0.z));
}
void main() {
  ivec2 q = ivec2(gl_FragCoord.xy), hi = textureSize(tAux, 0) - 1;
  vec4 a0 = pcAuxDec(texelFetch(tAux, q, 0));
  vec4 x1 = pcAuxDec(texelFetch(tAux, min(q + ivec2(1, 0), hi), 0)), x2 = pcAuxDec(texelFetch(tAux, min(q + ivec2(2, 0), hi), 0));
  vec4 y1 = pcAuxDec(texelFetch(tAux, min(q + ivec2(0, 1), hi), 0)), y2 = pcAuxDec(texelFetch(tAux, min(q + ivec2(0, 2), hi), 0));
  float eZ = max(abs(x2.z - a0.z), abs(y2.z - a0.z));
  vec3 ec = vec3(floor(a0.w + 0.001), floor(x2.w + 0.001), floor(y2.w + 0.001));
  // (a class that draws an outline: the sky (0), the water (2), a figure or the ship (5); the foliage against the ground
  // is not one, nor a trunk or a stone, unless it stands well in front of what is behind it (the depth step): from the
  // air the whole wood would tremble)
  vec3 eS = step(abs(ec - 0.0), vec3(0.1)) + step(abs(ec - 2.0), vec3(0.1)) + step(abs(ec - 5.0), vec3(0.1));
  float eC = step(0.5, abs(ec.y - ec.x) + abs(ec.z - ec.x)) * step(0.5, eS.x + eS.y + eS.z);
  gl_FragColor = vec4(max(smoothstep(0.30, 0.80, eZ), eC), 0.0, 0.0, 1.0);
  pcL = vec4(pcLine(a0, x1, y1), pcLine(a0, x2, y1), pcLine(a0, x1, y2), pcLine(a0, x2, y2));
}
`;

// (R1 re-fix, ruling 4) A light anti-aliasing where the scene is drawn with one sample (tier 0, phones and tablets, or
// ?aa=post): FXAA's nine reads on the abstraction pass's output at the scene's size. The four corner reads find an
// edge's direction from the luma; two and then four reads along it blend across the stair, and the two-read blend is
// kept where the four-read one strays outside the neighbourhood's range (a thin line). The wetness is the pixel's own.
const FXAA_FRAG = /* glsl */`
uniform sampler2D tAbs;
uniform vec2 uTexel;
varying vec2 vUv;
const vec3 W = vec3(0.3, 0.5, 0.2);
void main() {
  vec4 cM = texture(tAbs, vUv);
  float lNW = dot(texture(tAbs, vUv + vec2(-0.5, 0.5) * uTexel).rgb, W);
  float lNE = dot(texture(tAbs, vUv + vec2(0.5, 0.5) * uTexel).rgb, W);
  float lSW = dot(texture(tAbs, vUv + vec2(-0.5, -0.5) * uTexel).rgb, W);
  float lSE = dot(texture(tAbs, vUv + vec2(0.5, -0.5) * uTexel).rgb, W);
  float lM = dot(cM.rgb, W);
  float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE))), lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
  vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), (lNW + lSW) - (lNE + lSE));
  float red = max((lNW + lNE + lSW + lSE) * 0.25 * 0.125, 1.0 / 128.0);
  dir = clamp(dir / (min(abs(dir.x), abs(dir.y)) + red), vec2(-8.0), vec2(8.0)) * uTexel;
  vec3 cA = 0.5 * (texture(tAbs, vUv + dir * (1.0 / 3.0 - 0.5)).rgb + texture(tAbs, vUv + dir * (2.0 / 3.0 - 0.5)).rgb);
  vec3 cB = cA * 0.5 + 0.25 * (texture(tAbs, vUv - dir * 0.5).rgb + texture(tAbs, vUv + dir * 0.5).rgb);
  float lB = dot(cB, W);
  // (where the neighbourhood's contrast is under FXAA's own threshold, an eighth of its brightest, nothing moves: a wash's
  // interior and its fine texture stay as they were)
  vec3 c = (lB < lMin || lB > lMax) ? cA : cB;
  float th = max(0.0625, lMax * 0.125);
  gl_FragColor = vec4(mix(cM.rgb, c, smoothstep(th, th * 2.0, lMax - lMin)), cM.a);
}
`;

const SHEET_FRAG = /* glsl */`
uniform sampler2D tAbs;
uniform highp sampler2D tAux;
uniform highp sampler2D tHalfA;
uniform sampler2D tPaper;
uniform highp sampler2D tPool;   // (R1 re-fix) POOL_FRAG: the washes' value, its surround and its change, half size
uniform highp sampler2D tPool1;
uniform highp sampler2D tEdge;   // (R1 re-fix) EDGE_FRAG: the outline test from the region target
uniform highp sampler2D tLine;   // (R1 re-fix) EDGE_FRAG: the pencil's line, four ways
#ifdef PC_PAPER_BAKED
uniform highp sampler2D tPap0;   // (R1 W2.4, re-fix) PAPERS_FRAG's three targets at this sheet's size
uniform highp sampler2D tPap1;
uniform sampler2D tPap2;
#endif
uniform vec2 uOutRes;
uniform vec2 uInTexel;
uniform vec3 uPaperColor;
uniform vec3 uGrade;
uniform vec4 uPig;        // edge pooling, granulation, wobble px (at 1080p), graphite
uniform float uWobIn;     // (R1 W2.2) the wobble inside a wash, px at 1080p: the full uPig.z only on edges
uniform float uPoolFine;  // (R1 W2.2) the pooling of a pixel against its few-pixel neighbourhood, both ways
uniform float uSheetOld;  // (R1 W2.2) 1 with the old brush (post.js ABS_FRAG): the wobble everywhere and the pooling as it was
uniform vec4 uBorder;     // width, raggedness, pooling, enabled
uniform vec2 uBoil;
uniform vec4 uWxSheet;    // weather: x value key (heavier pigment under a storm), y lightning flash
uniform float uNight;     // the night key: 0 day .. 1 night on the ground
uniform float uNightNear; // the world's own deeper night wash over the near land (a look's nightNear; 0 on most worlds)
uniform float uLaid;      // 1 the picture is on the paper; 0 bare paper; between: it comes up from the paper as one
varying vec2 vUv;
${AUX_DEC}
const vec3 W = vec3(0.3, 0.5, 0.2);
// The picture read through a smooth cubic B-spline: four bilinear taps (PAINTER 19, below)
vec4 pcCubic(sampler2D t, vec2 uv, vec2 texel) {
  vec2 st = uv / texel - 0.5, i = floor(st), f = st - i, f2 = f * f, f3 = f2 * f;
  vec2 w0 = (-f3 + 3.0 * f2 - 3.0 * f + 1.0) / 6.0, w1 = (3.0 * f3 - 6.0 * f2 + 4.0) / 6.0;
  vec2 w2 = (-3.0 * f3 + 3.0 * f2 + 3.0 * f + 1.0) / 6.0, w3 = f3 / 6.0;
  vec2 g0 = w0 + w1, g1 = w2 + w3;
  vec2 h0 = (i - 0.5 + w1 / g0) * texel, h1 = (i + 1.5 + w3 / g1) * texel;
  return g0.y * (g0.x * texture(t, h0) + g1.x * texture(t, vec2(h1.x, h0.y)))
       + g1.y * (g0.x * texture(t, vec2(h0.x, h1.y)) + g1.x * texture(t, h1));
}
void main() {
  float sc = max(uOutRes.y / 1080.0, 0.62);
  vec2 px = gl_FragCoord.xy;
  vec2 puv = px / (512.0 * sc);
  // the paper under this pixel (R1 W2.4, re-fix: laid once per size, three fetches; above)
  vec2 w0; float ploR, ploG, pmidR, pmidG, ph, s1, bnP0, bnPD, psoftR, pfine, pmed, b0, bD, skL, skD, lineP;
#ifdef PC_PAPER_BAKED
  {
    ivec2 ip = ivec2(px);
    vec4 q0 = texelFetch(tPap0, ip, 0), q1 = texelFetch(tPap1, ip, 0), q2 = texelFetch(tPap2, ip, 0);
    w0 = q0.xy; b0 = q0.z; bD = q0.w;
    ph = q1.x; pmidR = q1.y; ploR = q1.z; skD = q1.w;
    ploG = q2.x; psoftR = q2.y; pfine = q2.z; pmed = q2.w;
    skL = smoothstep(0.46, 0.62, mix(ph, pmidR, 0.65));
    lineP = smoothstep(0.50, 0.70, ploR + (pmidR - 0.5) * 0.7) * (0.30 + 0.70 * smoothstep(0.35, 0.6, ph));
  }
#else
  ${PAPER_LIVE}
  ${PAPER_STATIC}
  ${PAPER_TERMS}
#endif

  // the painter's hand: edges wobble with the paper, never ruler-straight
  // (R1 W2.2: only edges. The tremor resampled the whole sheet up to two pixels off, which smeared every fine thing
  // inside a wash; it is kept where an edge is: a step in the wash's value (the scene's own value at a few pixels against
  // its broad surround), a silhouette (a step in depth, or a solid thing, the sky or the water meeting something else)
  // and the ragged border. Inside a wash the paper moves the picture by a third of a pixel.)
  // (R1 re-fix: the value step from POOL_FRAG, the depth step and the outlining classes from EDGE_FRAG, read where this
  // pixel lies in them; the old brush's sheet wobbles everywhere and reads neither)
  ivec2 isz = textureSize(tEdge, 0);
  vec4 pv = vec4(0.0);
  float surL = 0.0, edgeW = 1.0;
  if (uSheetOld < 0.5) {
    pv = texture(tPool, vUv);
    surL = pv.y;
    float eV = abs(pv.x - pv.y);
    float eA = texelFetch(tEdge, clamp(ivec2(floor(vUv * vec2(isz))), ivec2(0), isz - 1), 0).r;
    vec2 bd0 = min(vUv, 1.0 - vUv) * vec2(uOutRes.x / uOutRes.y, 1.0);
    float eB = 1.0 - smoothstep(uBorder.x * 1.2, uBorder.x * 2.6, min(bd0.x, bd0.y));
    edgeW = max(max(smoothstep(0.05, 0.12, eV), eA), eB * uBorder.w);
  }
  vec2 wob = w0 * mix(uWobIn, uPig.z, edgeW) * sc / uOutRes;
  vec2 uv = vUv + wob;
  // (PAINTER 19, the soft enlargement. At the lowest tier at half scale the scene is drawn at under a third of the
  // sheet's size, and a plain bilinear lookup enlarged every stair of an aliased edge into a block three pixels a
  // side: the figure and the ship were the most digital things on the page. Where the scene is drawn small it is
  // read through a smooth cubic, at a place the paper's tooth shakes by about half a pixel of the scene: a stair
  // becomes a soft edge with a little of the hand's tremor in it. At full size nothing here changes.)
  float up = uOutRes.y * uInTexel.y;                       // sheet pixels to one pixel of the scene
  float soft = smoothstep(1.15, 1.9, up);
  vec2 shake = vec2(0.0);
  if (soft > 0.0) {
    shake = (vec2(texture(tPaper, puv * 0.83 + 0.21, 0.4).r, texture(tPaper, puv * 0.71 + 0.63, 0.4).r) - 0.5) * 2.0 * uInTexel * 0.6 * soft;
    uv += shake;
  }
  vec4 c = soft > 0.0 ? mix(texture(tAbs, uv), pcCubic(tAbs, uv, uInTexel), soft) : texture(tAbs, uv);
  vec3 col = c.rgb;
  float wet = c.a;
  // (what lies here: the region, and whether it is a light of its own: a lamp, a flame, a lit cabin, region 8; such a
  // light is left as it was painted by the night's key and the last glaze: the one warm thing in the indigo)
  // (R1 re-fix: what lies here matters only by night, under a storm, in a lightning flash or under a world's last glaze; on
  // a plain day nothing below reads it, so it is not read)
  vec4 auxU = vec4(0.0, 0.0, 20.0, 1.0);
  if (uNight > 0.003 || uWxSheet.x > 0.003 || uWxSheet.y > 0.003 || uGrade != vec3(1.0)) auxU = pcAuxDec(texture(tAux, uv));
  float lamp = step(7.95, auxU.w);      // (region 7 is what flies in the air: flakes, hail; its hash goes up to 7.9)
  // A picture being laid (an arrival): the washes come up out of the bare paper as one, the sky and the
  // far end a little before the ground at the feet, in broad soft tides that follow the paper: never
  // a piece at a time, never a stipple.
  float laid = 1.0;
  if (uLaid < 0.999) {
    // (slowly: no part of the sheet changes by more than a thirtieth of its depth in a thirtieth of a second)
    float when = 0.11 * (1.0 - vUv.y) + 0.07 * ploR + 0.02 * pmidR;
    laid = smoothstep(0.0, 1.0, uLaid * 1.2 - when);
    col = mix(vec3(1.0), col, laid);
    wet *= laid;
  }
  // night is its own painting, not the day darkened: the hue narrows to the night's indigo,
  // and (below) every wash carries far more pigment, so the darks and middles run together
  // into a few deep masses while whatever was left as paper stays paper: the reserved lights
  float lit0 = dot(col, W);
  col = mix(col, vec3(lit0) * vec3(0.88, 0.97, 1.13), 0.58 * uNight * (1.0 - smoothstep(0.80, 0.97, lit0)) * (1.0 - lamp));
  float lum = dot(col, W);

  // pigment pools just inside the border of each wash: wide (compare with the blurred
  // surround) plus a little right at the edge (local gradient)
  // (R1 W2.2: read on the picture a few pixels wide, the half-size prep, the scale the old brush's blots had: on the
  // scene's own pixels, which the brush no longer repaints, every fine mark from the air took a pool and a dark rim, and
  // the far land went 5 L* darker; the washes' edges pool as before)
  // (R1 re-fix: the few-pixel value, its surround and its gradient are POOL_FRAG's, read where the picture is read)
  float pool, grad, fineP;
  if (uSheetOld > 0.5) {
    // (the old brush's sheet: its blots are the washes, read on its own pixels, one-sided)
    surL = dot(textureLod(tHalfA, vUv, 2.2).rgb, W);
    pool = max(0.0, dot(textureLod(tHalfA, uv, 2.2).rgb, W) - lum);
    fineP = 0.0;
    vec3 cx = texture(tAbs, uv + vec2(uInTexel.x, 0.0)).rgb - texture(tAbs, uv - vec2(uInTexel.x, 0.0)).rgb;
    vec3 cy = texture(tAbs, uv + vec2(0.0, uInTexel.y)).rgb - texture(tAbs, uv - vec2(0.0, uInTexel.y)).rgb;
    grad = length(cx) + length(cy);
  } else {
    vec4 pu = texture(tPool, uv), pu1 = texture(tPool1, uv);
    // (R1 re-fix: a wash's value under its surround by 0.02 or less is not a wash's edge: over the sharp picture every
    // small mark took the wide pool's pigment, and the far land went 3 dE darker than the palette; with the rim's floor
    // below, the region means come back within 3 (E_400_90 land 2.90 -> 1.54), the land's transfer still over 1.0)
    pool = max(0.0, surL - pu.x - 0.02);
    // (and the pixel against that few-pixel picture, on both sides: a mark darker than its neighbourhood takes a little
    // more pigment, a lighter one a little less, as the brush's pooling did at its own scale; nothing on average, so the
    // far land keeps its value)
    fineP = clamp(pu.x - lum, -0.08, 0.08);
    vec3 gx = vec3(pu.zw, pu1.x), gy = pu1.yzw;
    if (uAux8 > 0.5) { gx = gx * 2.0 - 1.0; gy = gy * 2.0 - 1.0; }
    grad = length(gx) + length(gy);
  }
  // (R1 re-fix: the rim from a gradient of 0.10 up (was 0.03): the fine marks' own gradients are not a wash's edge)
  float edge = pool * 3.2 + fineP * uPoolFine + smoothstep(mix(0.10, 0.03, uSheetOld), mix(0.60, 0.45, uSheetOld), grad) * 0.35;

  // granulation: pigment settles into the valleys of the paper, strongest in darks and wets
  // fine pits show in light washes; dark passages keep only the broad settling
  // In light and middle washes the pigment sits in the pits of the paper: a fine speckle. In
  // a dark wash the pits are full: what shows there is the broad soft settling of the pigment
  // (the same paper, out of focus), never a hard speck at the size of a pixel.
  // (A saturated middle wash, Neptune's ultramarine sky, counts as dark: there the pits read
  // as pepper over the whole wash. So does anything under the night's glaze, whatever it was
  // by day. Only the light washes keep the fine speckle, and even there it is a little soft.)
  float gl = dot(uGrade, W);
  float dark = 1.0 - smoothstep(0.42, 0.80, lum * gl);
  dark = max(dark, uWxSheet.x * 1.15 * (1.0 - smoothstep(0.50, 0.88, lum)));     // under a storm key the middle washes are dark too
  float pits = (0.52 - pfine) * 0.36 * smoothstep(0.10, 0.42, lum) + (0.5 - pmed) * 0.85;
  float settle = (0.5 - psoftR) * 0.7 + (0.5 - ploR) * 0.8;
  dark = min(dark, 1.0);
  float gran = (mix(pits, settle, dark) + (0.5 - ploR) * 0.35) * (0.22 + 0.85 * (1.0 - lum) * smoothstep(0.02, 0.30, lum)) * (0.55 + 0.8 * wet) * mix(1.0, 0.4, dark);
  gran *= 1.0 - 0.5 * uWxSheet.x;
  float d = 1.0 + uPig.x * edge + uPig.y * gran + (ploG - 0.5) * 0.10;
  // a storm shifts the whole key: every wash carries more pigment (richer, not greyer)
  // (PAINTER 16/17, the M4 critique's second item: at its full weight the key laid a thunderstorm at three in the afternoon
  // as dark as midnight, median L* 27; a rain study is a light picture. A little over half of it: the wood and the meadow
  // keep their steps and the storm is told by the sky's wash, the veil and the rain)
  d += uWxSheet.x * 0.55 * (0.75 + 0.5 * ploR);
  // (night, PAINTER 16: the moon models the land in the materials now, chunks.js pcLevel, so the key only deepens the
  // washes a little; it was 0.68 to 0.94, which ran every middle value down into one dark, 80 % of the frame within 7 L*)
  d += uNight * (0.30 + 0.20 * ploR) * (1.0 - lamp);
  // (PAINTER 19, the blind player's UGLY 9: Mars by night was one blue-grey wash from the sky to the boots. A nocturne
  // is darkest at the feet: the land within about twenty metres takes a deeper wash, easing out by 160 m, so that the
  // near ground, the middle distance and the sky's lighter band are three washes. It is laid as a graded wash over
  // the lower part of the sheet, the land and what stands on it alike (the ground alone left the sward's strokes as
  // pale cut-outs on it); the figure and the ship (region 5) and the lights keep theirs: they are the subject)
  // (its strength is the world's own, a look's nightNear, Mars 0.30: laid on every world it sank Earth's moonlit
  // meadow and pale beach, each the one lighter mass of its nocturne, toward the wood's and the sea's value)
  float clsN = floor(auxU.w + 0.001);
  float nearLand = step(0.5, auxU.w) * (1.0 - step(4.5, clsN) * step(clsN, 5.5)) * step(clsN, 6.5)
                 * (1.0 - smoothstep(4.3, 7.3, auxU.z)) * (1.0 - smoothstep(0.30, 0.62, vUv.y));
  d += uNight * uNightNear * nearLand * (1.0 - lamp);

  // ragged unpainted border: the wash simply stops, and pools where it stops
  vec2 bd = min(vUv, 1.0 - vUv) * vec2(uOutRes.x / uOutRes.y, 1.0);
  float b = min(bd.x, bd.y);
  float corner = smoothstep(0.0, 0.08, bd.x) * smoothstep(0.0, 0.08, bd.y);
  // (the edge of a dark wash is ragged in broad pieces only: fine tooth there is a row of dots)
  // (R1 W2.4: the paper's terms, PAPER_STATIC, gathered by what the dark wash changes)
  float bn = b + b0 - (1.0 - corner) * 0.012 + dark * bD;
  float painted = mix(1.0, smoothstep(uBorder.x * 0.72, uBorder.x, bn), uBorder.w);
  float lip = (1.0 - smoothstep(uBorder.x, uBorder.x * 2.2, bn)) * painted * uBorder.w;
  // (a dark wash does not pool again where it stops: under the storm's key the border was a dirty grey rim round the sheet)
  d += lip * uBorder.z * (0.4 + 0.6 * ploR) * mix(1.0, 0.25, dark);
  // dry edge: near the border the brush skips the paper's peaks
  // (a loaded dark wash skips far less: a few broad flecks of paper, never a pale rim with dark specks in it)
  float skip = (1.0 - smoothstep(uBorder.x * 0.9, uBorder.x * 1.6, bn)) * mix(skL, skD, dark) * uBorder.w;

  col = clamp(col - (col - col * col) * (d - 1.0), 0.0, 1.0);

  // graphite underdrawing on major silhouettes: faint, broken, catching the paper tooth
  // (R1 re-fix: the line as EDGE_FRAG drew it at the texel this point lies in, the way the reads 1.5 px over fall)
  vec2 guv = vUv + wob * 0.4 + shake + vec2(1.4, -0.9) * sc / uOutRes;      // (shake: the pencil follows the soft enlargement)
  vec2 gt = guv * vec2(isz);
  vec4 L4 = texelFetch(tLine, clamp(ivec2(floor(gt)), ivec2(0), isz - 1), 0);
  vec2 gf = step(0.5, fract(gt));
  float line = mix(mix(L4.r, L4.g, gf.x), mix(L4.b, L4.a, gf.x), gf.y) * lineP;
  col *= mix(vec3(1.0), vec3(0.46, 0.46, 0.50), line * uPig.w * laid);

  // lightning: for a frame or two the paper shows through. The sky and the lights go bare,
  // the darks stay as silhouettes against them
  if (uWxSheet.y > 0.003) {
    // (how much of the neighbourhood is open sky: the gaps in a crown are part of the crown,
    // a lone sky pixel there lifted to paper was a fringe of white specks round every tree)
    vec2 o2 = uInTexel * 3.0;
    float isSky = 5.0 - step(0.5, pcAuxDec(texture(tAux, uv)).w) - step(0.5, pcAuxDec(texture(tAux, uv + vec2(o2.x, o2.y))).w) - step(0.5, pcAuxDec(texture(tAux, uv + vec2(-o2.x, o2.y))).w)
      - step(0.5, pcAuxDec(texture(tAux, uv + vec2(o2.x, -o2.y))).w) - step(0.5, pcAuxDec(texture(tAux, uv + vec2(-o2.x, -o2.y))).w);
    isSky = smoothstep(0.55, 1.0, isSky * 0.2);
    // (the thin parts of the cloud light up most: the sky's own values, not the paper's, shape the flash)
    float lift = uWxSheet.y * (isSky * (0.62 + 0.33 * smoothstep(0.0, 0.42, surL)) + (1.0 - isSky) * smoothstep(0.25, 0.75, dot(col, W)) * 0.55);
    col = mix(col, vec3(1.0), clamp(lift, 0.0, 0.92));
  }
  // (at night the land keeps a floor, PAINTER 12; PAINTER 16: a soft floor only. The darkest washes gather a little above
  // the night's deepest indigo and everything over them keeps its step: the old toe laid all the washes under half value
  // into one narrow band, which was most of why the land at night was one value)
  if (uNight > 0.003) {
    float land = step(0.5, auxU.w) * (1.0 - lamp);
    vec3 toe = vec3(0.16, 0.175, 0.27) + 0.025 * (psoftR - 0.5);
    vec3 c2 = col * col, t2 = toe * toe;
    col = mix(col, sqrt(sqrt(c2 * c2 + t2 * t2)), uNight * land * laid);
  }
  // (and under a storm's key, PAINTER 13: the storm lays more pigment into every wash, and Neptune's basalt cliffs and
  // stacks went to one flat near-black mass, L 14; the land's darkest washes are laid into a band above the floor, a
  // gentle toe, so a cliff in a gale is dense indigo with its steps still in it)
  if (uWxSheet.x > 0.003) {
    float landS = step(0.5, auxU.w);
    vec3 toeS = vec3(0.12, 0.13, 0.21) + 0.02 * (psoftR - 0.5);
    col = max(col, mix(col, toeS + col * (1.0 - toeS / 0.55), min(uWxSheet.x, 1.0) * landS * laid));
  }
  // nothing is pure black: the darkest darks are dense indigo and sepia
  col = max(col, vec3(0.085, 0.09, 0.145) + 0.03 * (psoftR - 0.5) + uNight * vec3(0.035, 0.045, 0.075));
  col = mix(vec3(1.0), col, painted * (1.0 - skip * 0.8));

  // paper: warm off-white, lit so its tooth shows faintly even where it is bare
  float relief = (ph - 0.5) * 0.055 * mix(1.0, 0.35, dark) + (ploG - 0.5) * 0.02;
  // the last glaze over the sheet (night indigo, dusk gold); at night what was reserved stays paper
  float reserve = max(max(smoothstep(0.90, 0.985, dot(col, W)) * uNight, lamp), min(uWxSheet.y, 1.0) * smoothstep(0.45, 0.80, dot(col, W)));
  // (R1 re-fix: the last glaze (a world's night indigo, the dusk's gold) is laid over the broad washes, the picture's
  // detail keeps its strength: a glaze that darkened everything darkened the marks with it, and by night at 150 m the
  // land's detail was 0.70 of the scene's at 6-16 px (the plan asks 0.9: 0.94 now; the mean colours the same within
  // 0.2 dE). The broad wash is the surround the pooling reads, and the detail is weighted twice, since the surround
  // still holds part of the 6-16 px band. By day the grade is 1 and nothing changes.)
  vec3 gk = mix(vec3(1.0), mix(uGrade, vec3(1.0), reserve), painted);
  vec3 gd = gk + (1.0 - gk) * (1.0 - clamp(surL / max(lum, 0.02), 0.25, 4.0)) * 2.0 * (1.0 - uSheetOld);
  vec3 outc = uPaperColor * col * (1.0 + relief) * max(gd, gk * 0.5);
  gl_FragColor = vec4(outc, 1.0);
}
`;

// THE OIL LOOK'S LAST PASS (shared.js LOOK): the scene as the materials painted it, with no brush, no pooling, no pencil
// and no paper over it, so nothing here can soften an edge. What it does: the picture comes up from the dark canvas on
// an arrival; the world's last key (dusk gold, night blue) is laid over everything but the lights; a little more depth
// in the darks. Where the scene is drawn smaller than the screen it is enlarged plainly.
const OIL_FRAG = /* glsl */`
uniform sampler2D tAbs;
uniform highp sampler2D tAux;
uniform vec3 uGrade;
uniform vec4 uWxSheet;
uniform float uNight;
uniform float uLaid;
uniform vec4 uOilC;
varying vec2 vUv;
${AUX_DEC}
const vec3 W = vec3(0.3, 0.5, 0.2);
void main() {
  vec3 col = texture(tAbs, vUv).rgb;
  float lamp = 0.0;
  if (uNight > 0.003 || uGrade != vec3(1.0)) lamp = step(7.95, pcAuxDec(texture(tAux, vUv)).w);
  col *= mix(uGrade, vec3(1.0), lamp);
  // lightning: for a frame or two everything light goes lighter
  col = mix(col, vec3(1.0), clamp(uWxSheet.y * smoothstep(0.25, 0.75, dot(col, W)) * 0.6, 0.0, 0.9));
  // a gentle S over the values: the darks a step deeper, the lights kept
  vec3 s = col * col * (3.0 - 2.0 * col);
  col = mix(col, s, 0.35);
  // colours that pop (the owner, 2026-11-15): every colour pushed from its grey, the dull ones most and the pure ones
  // hardly, so nothing clips; a pixel's own colour only, no neighbour is read: no edge is touched
  float lw = dot(col, W), sat = max(col.r, max(col.g, col.b)) - min(col.r, min(col.g, col.b));
  col = clamp(mix(vec3(lw), col, 1.0 + 0.28 * (1.0 - sat)), 0.0, 1.0);
  col = mix(vec3(0.07, 0.06, 0.09), col, smoothstep(0.0, 1.0, uLaid));
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

function fsMaterial(frag, uniforms, extra) {
  return new THREE.ShaderMaterial(Object.assign({
    uniforms, vertexShader: FS_VERT, fragmentShader: frag,
    depthTest: false, depthWrite: false,
  }, extra || {}));
}

export class Post {
  constructor(renderer, opts) {
    this.renderer = renderer;
    // Float targets need EXT_color_buffer_float or _half_float (nearly every desktop WebGL 2 has one). Without, every
    // target is 8-bit and what the scene pass's second target and last frame's depth carry is packed (shared.js uAux8).
    // (opts.floatFallback: that path on any machine, for tests: index.js ?float=0)
    const ex = renderer.extensions;
    this.floatFallback = !!(opts && opts.floatFallback) || !!(ex && ex.has && !ex.has('EXT_color_buffer_float') && !ex.has('EXT_color_buffer_half_float'));
    G.uAux8.value = this.floatFallback ? 1 : 0;
    const HF = this.floatFallback ? THREE.UnsignedByteType : THREE.HalfFloatType;
    const tex = getTextures();
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this.tri = new THREE.Mesh(geo, null);
    this.tri.frustumCulled = false;

    this.outW = 2; this.outH = 2; this.inW = 2; this.inH = 2;
    this.sectors = 8;

    this.HF = HF;
    this.rtScene1 = this._sceneTarget(0);
    this.rtScene = this.rtScene1;
    // (R1 W2.5) multisampled scene pass: off until setAA asks for it; its second target read through the region rule
    // (AUXFIX_FRAG) into rtAux
    this.samples = 0; this.rtSceneMS = null;
    this.rtAux = new THREE.WebGLRenderTarget(2, 2, { depthBuffer: false, type: HF });
    this.rtAux.texture.minFilter = THREE.NearestFilter; this.rtAux.texture.magFilter = THREE.NearestFilter; this.rtAux.texture.generateMipmaps = false;
    this.mAuxFix = fsMaterial(AUXFIX_FRAG, { tAux: { value: null } });
    this.mAuxFix.name = 'region-resolve';

    this.rtHalf = new THREE.WebGLRenderTarget(2, 2, { count: 2, depthBuffer: false, type: HF });
    this.rtHalf.textures[1].type = THREE.UnsignedByteType;
    for (const t of this.rtHalf.textures) { t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; }

    // (R1 W2.2) the near brush's statistics at the scene's own size (PREPF_FRAG), mipmapped
    this.rtFull = new THREE.WebGLRenderTarget(2, 2, { depthBuffer: false, type: HF });
    this.rtFull.texture.generateMipmaps = true; this.rtFull.texture.minFilter = THREE.LinearMipmapLinearFilter; this.rtFull.texture.magFilter = THREE.LinearFilter;
    this.mPrepF = fsMaterial(PREPF_FRAG, { tScene: { value: this.rtScene.textures[0] } });

    this.rtAbs = new THREE.WebGLRenderTarget(2, 2, { depthBuffer: false, type: THREE.UnsignedByteType });
    this.rtAbs.texture.minFilter = THREE.LinearFilter; this.rtAbs.texture.magFilter = THREE.LinearFilter;

    // (R1 re-fix) the washes' value, surround and gradient at half size (POOL_FRAG), for the sheet
    this.rtPool = new THREE.WebGLRenderTarget(2, 2, { count: 2, depthBuffer: false, type: HF });
    for (const t of this.rtPool.textures) { t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; }
    this.mPool = fsMaterial(POOL_FRAG, { tHalfA: { value: this.rtHalf.textures[0] }, uInTexel: { value: new THREE.Vector2() }, uAux8: G.uAux8 });
    this.mPool.name = 'pool';
    // (R1 re-fix) the outline test and the pencil's line from the region target, at the scene's size (EDGE_FRAG)
    this.rtEdge = new THREE.WebGLRenderTarget(2, 2, { count: 2, depthBuffer: false, type: THREE.UnsignedByteType });
    this.rtEdge.textures[0].format = THREE.RedFormat;
    for (const t of this.rtEdge.textures) { t.minFilter = THREE.NearestFilter; t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; }
    this.mEdge = fsMaterial(EDGE_FRAG, { tAux: { value: null }, uAux8: G.uAux8 });
    this.mEdge.name = 'edges';
    // (R1 re-fix, ruling 4) the light post AA where the scene is drawn with one sample (setPostAA): FXAA_FRAG
    this.postAA = false;
    this.rtAA = new THREE.WebGLRenderTarget(2, 2, { depthBuffer: false, type: THREE.UnsignedByteType });
    this.rtAA.texture.minFilter = THREE.LinearFilter; this.rtAA.texture.magFilter = THREE.LinearFilter; this.rtAA.texture.generateMipmaps = false;
    this.mFxaa = fsMaterial(FXAA_FRAG, { tAbs: { value: this.rtAbs.texture }, uTexel: { value: new THREE.Vector2() } });
    this.mFxaa.name = 'post-aa';

    // last frame's painting + depth, kept for the water's reflections
    this.rtPrev = new THREE.WebGLRenderTarget(2, 2, { depthBuffer: false, type: HF });
    this.rtPrev.texture.minFilter = THREE.LinearFilter; this.rtPrev.texture.magFilter = THREE.LinearFilter;
    this.mKeep = fsMaterial(/* glsl */`
      uniform sampler2D tAbs; uniform highp sampler2D tAux; varying vec2 vUv;
      void main() { gl_FragColor = vec4(texture(tAbs, vUv).rgb, texture(tAux, vUv).z); }`,
      { tAbs: { value: this.rtAbs.texture }, tAux: { value: this.rtScene.textures[1] } });
    G.uPrevTex.value = this.rtPrev.texture;
    this.prevFrames = 0;
    // (R1 re-fix: kept on a world once its water has been drawn there: see finish)
    this.waterSeen = false; this.waterBody = null;
    // (R1 W2.4: the scene's second target cleared to what the backdrop pass wrote: normal 0, log depth 20, region 0 (the
    // sky); the 8-bit fallback's packed value)
    this.auxClear = new Float32Array(this.floatFallback ? [0.5, 0.5, 20 / 32, 0] : [0, 0, 20, 0]);

    // (R1 W2.4, re-fix) the paper under every pixel of the sheet, laid once per size into three targets (PAPERS_FRAG):
    // half floats, half floats, 8-bit; none where the browser cannot draw into float targets (the 8-bit fallback reads
    // the paper itself, as it always has)
    this.paperBaked = !this.floatFallback;
    this.rtPaper = new THREE.WebGLRenderTarget(2, 2, { count: 3, depthBuffer: false, type: THREE.HalfFloatType });
    this.rtPaper.textures[2].type = THREE.UnsignedByteType;
    for (const t of this.rtPaper.textures) { t.minFilter = THREE.NearestFilter; t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; }
    this.paperAt = [0, 0, NaN, NaN, NaN, NaN];
    this.mPrep = fsMaterial(PREP_FRAG, { tScene: { value: this.rtScene.textures[0] }, uTexel: { value: new THREE.Vector2() } });
    this.absUniforms = {
      tScene: { value: this.rtScene.textures[0] }, tAux: { value: this.rtScene.textures[1] },
      tHalfA: { value: this.rtHalf.textures[0] }, tHalfB: { value: this.rtHalf.textures[1] }, tFullA: { value: this.rtFull.texture },
      tPaper: { value: tex.paper },
      uTexel: { value: new THREE.Vector2() }, uRes: { value: new THREE.Vector2() },
      uBrush: { value: new THREE.Vector4(0.0036, 0.0085, 0.013, 0.8) },
      uBrushR: { value: new THREE.Vector2(1.4, 0) },
      uAbstraction: { value: 1 }, uAux8: G.uAux8,
    };
    // (R1 re-fix) the brush's paper, laid once per size of the scene (ABSPAPER_FRAG)
    this.absPaperBaked = !!(ex && ex.has && ex.has('EXT_color_buffer_float')) && !this.floatFallback;
    this.rtAbsP = new THREE.WebGLRenderTarget(2, 2, { depthBuffer: false, type: this.absPaperBaked ? THREE.FloatType : THREE.UnsignedByteType });
    this.rtAbsP.texture.minFilter = THREE.NearestFilter; this.rtAbsP.texture.magFilter = THREE.NearestFilter; this.rtAbsP.texture.generateMipmaps = false;
    this.absUniforms.tAbsP = { value: this.rtAbsP.texture };
    this.mAbsP = fsMaterial(ABSPAPER_FRAG, { tPaper: this.absUniforms.tPaper, uTexel: this.absUniforms.uTexel, uRes: this.absUniforms.uRes });
    this.mAbsP.name = 'brush-paper';
    this.absPaperAt = '';
    this.mAbs = {};
    for (const s of [4, 8]) this.mAbs[s] = fsMaterial(ABS_FRAG, this.absUniforms, { defines: this.absPaperBaked ? { SECTORS: s, PC_ABSP_BAKED: 1 } : { SECTORS: s } });
    this.sheetUniforms = {
      tAbs: { value: this.rtAbs.texture }, tAux: { value: this.rtScene.textures[1] }, tHalfA: { value: this.rtHalf.textures[0] },
      tPool: { value: this.rtPool.textures[0] }, tPool1: { value: this.rtPool.textures[1] }, tEdge: { value: this.rtEdge.textures[0] }, tLine: { value: this.rtEdge.textures[1] },
      tPaper: { value: tex.paper },
      uOutRes: { value: new THREE.Vector2() }, uInTexel: { value: new THREE.Vector2() },
      uPaperColor: G.uPaperColor, uGrade: { value: new THREE.Vector3(1, 1, 1) },
      uPig: { value: new THREE.Vector4(1.0, 1.0, 2.6, 0.55) }, uWobIn: { value: 0.3 }, uPoolFine: { value: 2.0 }, uSheetOld: { value: 0 },
      uBorder: { value: new THREE.Vector4(0.030, 0.034, 0.9, 1) },
      uBoil: { value: new THREE.Vector2(0, 0) },
      uWxSheet: { value: new THREE.Vector4(0, 0, 0, 0) },
      uNight: { value: 0 }, uNightNear: { value: 0 }, uLaid: { value: 1 }, uAux8: G.uAux8,
    };
    Object.assign(this.sheetUniforms, { tPap0: { value: this.rtPaper.textures[0] }, tPap1: { value: this.rtPaper.textures[1] }, tPap2: { value: this.rtPaper.textures[2] } });
    this.mSheet = fsMaterial(SHEET_FRAG, this.sheetUniforms, this.paperBaked ? { defines: { PC_PAPER_BAKED: 1 } } : null);
    this.mPaper = fsMaterial(PAPERS_FRAG, { tPaper: this.sheetUniforms.tPaper, uOutRes: this.sheetUniforms.uOutRes, uBoil: this.sheetUniforms.uBoil, uBorder: this.sheetUniforms.uBorder });
    this.mPaper.name = 'paper-bake';
    this.oil = LOOK.oil;
    this.mOil = fsMaterial(OIL_FRAG, { tAbs: this.sheetUniforms.tAbs, tAux: this.sheetUniforms.tAux, uGrade: this.sheetUniforms.uGrade, uWxSheet: this.sheetUniforms.uWxSheet,
      uNight: this.sheetUniforms.uNight, uLaid: this.sheetUniforms.uLaid, uOilC: OIL.uOilC, uAux8: G.uAux8 });
    this.mOil.name = 'oil-finish';
    this.debugView = 0;
    this.mCopy = fsMaterial(/* glsl */`
      uniform sampler2D tA; uniform highp sampler2D tB; uniform int uMode; varying vec2 vUv;
      void main() {
        if (uMode == 1) gl_FragColor = vec4(texture(tA, vUv).rgb, 1.0);
        else if (uMode == 2) gl_FragColor = vec4(vec3(texture(tA, vUv).a), 1.0);
        else if (uMode == 3) { vec4 a = texture(tB, vUv); gl_FragColor = vec4(a.xy * 0.5 + 0.5, a.z / 20.0, 1.0); }
        else { vec4 a = texture(tB, vUv); gl_FragColor = vec4(fract(a.w), floor(a.w) / 6.0, 0.5, 1.0); }
      }`, { tA: { value: null }, tB: { value: this.rtScene.textures[1] }, uMode: { value: 1 } });
    this._bindScene();
  }

  // the scene pass's target: two attachments (colour and wetness; normal, log depth, region) and a 32-bit float depth
  // (with samples, a multisampled one: three draws it into renderbuffers and resolves the colours after the pass; the
  // depth is neither resolved nor kept)
  _sceneTarget(samples) {
    const rt = new THREE.WebGLRenderTarget(Math.max(2, this.inW), Math.max(2, this.inH), samples
      ? { count: 2, depthBuffer: true, type: THREE.UnsignedByteType, samples, resolveDepthBuffer: false, storeMultisampledDepthBuffer: false }
      : { count: 2, depthBuffer: true, type: THREE.UnsignedByteType });
    rt.textures[0].minFilter = THREE.LinearFilter; rt.textures[0].magFilter = THREE.LinearFilter;
    rt.textures[1].type = this.HF;
    rt.textures[1].minFilter = THREE.NearestFilter; rt.textures[1].magFilter = THREE.NearestFilter;
    rt.depthTexture = new THREE.DepthTexture(Math.max(2, this.inW), Math.max(2, this.inH), THREE.FloatType);
    return rt;
  }

  // (R1 W2.5) MSAA on the scene pass: 0 (none), 2 or 4 samples. Not where the browser cannot draw into float targets
  // (the region and depth are packed into 8 bits there and an average of them means nothing).
  setAA(samples) {
    const n = this.floatFallback ? 0 : samples >= 4 ? 4 : samples >= 2 ? 2 : 0;
    if (n === this.samples) return;
    if (this.rtSceneMS) { this.rtSceneMS.depthTexture.dispose(); this.rtSceneMS.dispose(); this.rtSceneMS = null; }
    this.samples = n;
    if (n) this.rtSceneMS = this._sceneTarget(n);
    this.rtScene = n ? this.rtSceneMS : this.rtScene1;
    this.prevFrames = 0; G.uPrevOn.value = 0;
    this._bindScene();
  }

  // every reader of the scene pass's targets pointed at the ones in use
  _bindScene() {
    const col = this.rtScene.textures[0], aux = this.samples ? this.rtAux.texture : this.rtScene.textures[1];
    this.mPrep.uniforms.tScene.value = col; this.mPrepF.uniforms.tScene.value = col; this.absUniforms.tScene.value = col;
    this.absUniforms.tAux.value = aux; this.sheetUniforms.tAux.value = aux; this.mKeep.uniforms.tAux.value = aux; this.mCopy.uniforms.tB.value = aux;
    this.mEdge.uniforms.tAux.value = aux;
    this.mAuxFix.uniforms.tAux.value = this.rtScene.textures[1];
    G.uSceneAux.value = aux; G.uSceneCol.value = col;
  }

  // (R1 re-fix, ruling 4) the light post AA (FXAA_FRAG) on or off: where the scene is drawn with one sample
  setPostAA(on) {
    this.postAA = !!on;
    this.sheetUniforms.tAbs.value = this.postAA ? this.rtAA.texture : this.rtAbs.texture;
  }

  setSize(outW, outH, scale) {
    outW = Math.max(2, outW | 0); outH = Math.max(2, outH | 0);
    const inW = Math.max(2, Math.round(outW * scale)), inH = Math.max(2, Math.round(outH * scale));
    if (outW === this.outW && outH === this.outH && inW === this.inW && inH === this.inH) return;
    this.outW = outW; this.outH = outH; this.inW = inW; this.inH = inH;
    this.rtScene1.setSize(inW, inH);
    if (this.rtSceneMS) this.rtSceneMS.setSize(inW, inH);
    this.rtAux.setSize(inW, inH);
    this.rtHalf.setSize(Math.max(1, inW >> 1), Math.max(1, inH >> 1));
    this.rtFull.setSize(inW, inH);
    this.rtAbs.setSize(inW, inH);
    this.rtAbsP.setSize(inW, inH);
    this.rtPool.setSize(Math.max(1, inW >> 1), Math.max(1, inH >> 1));
    this.rtEdge.setSize(inW, inH);
    this.rtAA.setSize(inW, inH);
    this.rtPrev.setSize(Math.max(1, inW >> 1), Math.max(1, inH >> 1));
    if (this.paperBaked) this.rtPaper.setSize(outW, outH);
    // (R1 re-fix: a resized target loses what was laid in it; laid again at the next frame whatever the size is then: a
    // size that changed and changed back before a frame was drawn (the station harness's settle does it, so can a tier
    // and a scale changed in one step) kept the old key and drew with a cleared target)
    this.absPaperAt = ''; this.paperAt[0] = 0;
    this.prevFrames = 0; G.uPrevOn.value = 0;
    this.mPrep.uniforms.uTexel.value.set(1 / inW, 1 / inH);
    this.absUniforms.uTexel.value.set(1 / inW, 1 / inH);
    this.absUniforms.uRes.value.set(inW, inH);
    this.mPool.uniforms.uInTexel.value.set(1 / inW, 1 / inH);
    this.mFxaa.uniforms.uTexel.value.set(1 / inW, 1 / inH);
    G.uSceneRes.value.set(inW, inH);
    this._bindScene();
    this.sheetUniforms.uOutRes.value.set(outW, outH);
    this.sheetUniforms.uInTexel.value.set(1 / inW, 1 / inH);
  }

  _pass(material, target) {
    const r = this.renderer;
    this.tri.material = material;
    r.setRenderTarget(target);
    r.render(this.tri, this.cam);
  }

  beginScene() {
    const r = this.renderer;
    r.setRenderTarget(this.rtScene);
    r.setClearColor(0xffffff, 1);
    r.clear(true, true, true);
    // (R1 W2.4: the backdrop was a pass over the whole picture writing white and this value; a clear does the same)
    const gl = r.getContext();
    gl.clearBufferfv(gl.COLOR, 1, this.auxClear);
    PREV.water = false;
  }

  // (R1 W2.4) the paper laid again when the sheet's size or the paper's own settings changed
  _paper() {
    const a = this.paperAt, u = this.sheetUniforms, bo = u.uBoil.value, br = u.uBorder.value;
    if (a[0] === this.outW && a[1] === this.outH && a[2] === bo.x && a[3] === bo.y && a[4] === br.x && a[5] === br.y) return;
    a[0] = this.outW; a[1] = this.outH; a[2] = bo.x; a[3] = bo.y; a[4] = br.x; a[5] = br.y;
    this._pass(this.mPaper, this.rtPaper);
  }

  // glazes: objects drawn over the brushed picture (see shared.js GLAZES), with the scene's camera
  finish(glazes, camera) {
    if (this.oil) return this._finishOil(glazes, camera);
    // (R1 W2.5) the region through the resolve, before anything reads it
    if (this.samples) this._pass(this.mAuxFix, this.rtAux);
    this._pass(this.mPrep, this.rtHalf);
    // (the near brush's statistics, at the scene's own size: not drawn where the old brush is in use)
    if (this.absUniforms.uBrushR.value.y < 0.5 && this.absUniforms.uAbstraction.value > 0) this._pass(this.mPrepF, this.rtFull);
    // (R1 re-fix) the brush's paper, laid again when the scene's size changed
    const ak = this.inW + 'x' + this.inH;
    if (this.absPaperBaked && this.absPaperAt !== ak) { this.absPaperAt = ak; this._pass(this.mAbsP, this.rtAbsP); }
    this._pass(this.mAbs[this.sectors], this.rtAbs);
    if (glazes && glazes.length) {
      const r = this.renderer;
      r.setRenderTarget(this.rtAbs);
      for (const o of glazes) { o.visible = true; r.render(o, camera); }
    }
    // (R1 re-fix, ruling 4: the light post AA where the scene has one sample)
    if (this.postAA) this._pass(this.mFxaa, this.rtAA);
    // last frame's painting for the water's reflections (R1 W2.4, re-fix: kept on a world once water has been drawn
    // there, every frame while the eye stays on that world, so water that comes back into view reflects at once; a world
    // without water, Mars, never keeps it. Where it was not kept the frame before (the first water a world shows, a
    // resize), the water reflects nothing for that frame rather than an old picture.)
    const water = PREV.water;
    if (water) { this.waterSeen = true; this.waterBody = PREV.body; }
    if (water || (this.waterSeen && this.waterBody === PREV.body)) {
      this._pass(this.mKeep, this.rtPrev);
      this.prevFrames++;
    } else this.prevFrames = 0;
    G.uPrevOn.value = this.prevFrames >= 1 ? 1 : 0;
    // (R1 re-fix) the sheet's pooling and outlines, read once a pixel: the pool only for the new brush's sheet
    if (this.sheetUniforms.uSheetOld.value < 0.5) this._pass(this.mPool, this.rtPool);
    this._pass(this.mEdge, this.rtEdge);
    if (this.debugView) {
      const m = this.mCopy;
      m.uniforms.uMode.value = this.debugView;
      m.uniforms.tA.value = this.debugView === 5 ? this.rtAbs.texture : this.rtScene.textures[0];
      if (this.debugView === 5) m.uniforms.uMode.value = 1;
      this._pass(m, null);
    } else {
      if (this.paperBaked) this._paper();
      this._pass(this.mSheet, null);
    }
  }

  // The oil look's passes (shared.js LOOK): the scene as painted, the glazes over it, last frame kept for the water, the
  // last key. No brush, no pooling, no pencil, no paper.
  _finishOil(glazes, camera) {
    // (the region through the resolve, before anything reads it, as in the watercolour's passes)
    if (this.samples) this._pass(this.mAuxFix, this.rtAux);
    const m = this.mCopy;
    m.uniforms.uMode.value = 1; m.uniforms.tA.value = this.rtScene.textures[0];
    this._pass(m, this.rtAbs);
    if (glazes && glazes.length) {
      const r = this.renderer;
      r.setRenderTarget(this.rtAbs);
      for (const o of glazes) { o.visible = true; r.render(o, camera); }
    }
    if (this.postAA) this._pass(this.mFxaa, this.rtAA);
    const water = PREV.water;
    if (water) { this.waterSeen = true; this.waterBody = PREV.body; }
    if (water || (this.waterSeen && this.waterBody === PREV.body)) { this._pass(this.mKeep, this.rtPrev); this.prevFrames++; } else this.prevFrames = 0;
    G.uPrevOn.value = this.prevFrames >= 1 ? 1 : 0;
    if (this.debugView) {
      m.uniforms.uMode.value = this.debugView === 5 ? 1 : this.debugView;
      m.uniforms.tA.value = this.debugView === 5 ? this.rtAbs.texture : this.rtScene.textures[0];
      this._pass(m, null);
    } else this._pass(this.mOil, null);
  }

  // The brush's passes that are not drawn every frame laid once into a 2 x 2 sheet (PILOT's P3), so that
  // none is first built mid-game: the four-sector brush is otherwise first drawn at the lowest tier, when
  // the machine is already struggling. (The prep and keep passes run from the first frame; the paper is laid when the
  // sheet first is.)
  warm() {
    const t = new THREE.WebGLRenderTarget(2, 2, { depthBuffer: false, type: THREE.UnsignedByteType });
    for (const m of [this.mPrepF, this.mAbs[4], this.mAbs[8], this.mFxaa, this.mPool, this.mSheet]) this._pass(m, t);
    t.dispose();
    if (this.paperBaked) { this.paperAt[0] = 0; this._paper(); }
    this.absPaperAt = '';
  }

  dispose() {
    this.rtScene1.dispose(); if (this.rtSceneMS) this.rtSceneMS.dispose(); this.rtAux.dispose();
    this.rtHalf.dispose(); this.rtFull.dispose(); this.rtAbs.dispose(); this.rtPrev.dispose(); this.rtPaper.dispose();
    this.rtPool.dispose(); this.rtEdge.dispose(); this.rtAA.dispose(); this.rtAbsP.dispose();
  }
}
