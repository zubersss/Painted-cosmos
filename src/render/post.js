// Painted Cosmos: the watercolor post passes. OWNER: PAINTER.
//
//   scene (MRT, internal res)      colour+wetness, normal+depth+region
//   -> prep (half res, mipmapped)  mean colour + mean luma^2, and wetness-premultiplied colour
//   -> abstraction (internal res)  brush-sized shapes (mip Kuwahara), wet-in-wet bleed
//   -> sheet (output res)          wobble, pigment pooling at wash edges, granulation in the
//                                  paper grain, graphite underdrawing, ragged border, paper
//
// Only paper effects live in screen space (grain, wobble, border). Everything that belongs to
// the painting (wash variation, strokes, light) is anchored in the world by the materials.
import * as THREE from 'three';
import { getTextures, G } from './shared.js';

const FS_VERT = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const BACKDROP_FRAG = /* glsl */`
layout(location = 1) out highp vec4 pcAux;
uniform float uAux8;
void main() {
  gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
  pcAux = uAux8 > 0.5 ? vec4(0.5, 0.5, 20.0 / 32.0, 0.0) : vec4(0.0, 0.0, 20.0, 0.0);
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

const ABS_FRAG = /* glsl */`
uniform sampler2D tScene;
uniform highp sampler2D tAux;
uniform highp sampler2D tHalfA;
uniform sampler2D tHalfB;
uniform sampler2D tPaper;
uniform vec2 uTexel;       // 1 / internal resolution
uniform vec2 uRes;         // internal resolution
uniform vec4 uBrush;       // near radius, far radius (fractions of height), bleed radius, bleed amount
uniform float uAbstraction;
varying vec2 vUv;
${AUX_DEC}
const vec3 W = vec3(0.3, 0.5, 0.2);
void main() {
  vec4 c0 = texture(tScene, vUv);
  vec4 aux = pcAuxDec(texture(tAux, vUv));
  float wet = c0.a;
  float cls = floor(aux.w + 0.001);
  // far things are fewer, larger, softer strokes; near things keep crisp accents
  float far = smoothstep(3.6, 8.2, aux.z);
  float r = mix(uBrush.x, uBrush.y, far) * uRes.y;     // brush radius in internal pixels
  float lod = max(0.0, log2(max(r, 1.0)) - 1.0);
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  float aspect = uRes.y / uRes.x;
  // a fixed-on-paper rotation breaks the regular 8-fold symmetry of the sectors
  float rot = texture(tPaper, vUv * vec2(1.0, aspect) * 2.3).b * 6.283;
  for (int k = 0; k < SECTORS; k++) {
    float a = rot + float(k) * (6.2831853 / float(SECTORS));
    vec2 off = vec2(cos(a), sin(a)) * r * 0.62 * uTexel;
    vec4 m = textureLod(tHalfA, vUv + off, lod);
    float l = dot(m.rgb, W);
    float var = max(0.0, m.a - l * l);
    float w = 1.0 / (0.00012 + var * var * 900.0 + var * 0.6);
    acc += m.rgb * w; wsum += w;
  }
  vec3 kuw = acc / wsum;
  // solid props (trunks, rocks, characters) keep more of their drawing
  float keep = (1.0 - far) * (cls == 3.0 || cls == 5.0 ? 0.72 : 0.30);
  // region 6: small crisp marks (splash rings) the brush leaves as they were drawn
  if (cls == 6.0) keep = 0.92;
  // region 8: a light of its own (a lamp, a flame, a lit cabin): its small warm shape is kept too
  if (cls == 8.0) keep = 0.85;
  keep = mix(1.0, keep, uAbstraction);
  vec3 col = mix(kuw, c0.rgb, keep);
  // wet-in-wet: wet areas take up the (wetness-weighted) colour around them, feathered
  vec2 feather = (texture(tPaper, vUv * vec2(1.0, aspect) * 5.1).ba - 0.5) * uBrush.z * 1.4;
  float blod = max(0.0, log2(max(uBrush.z * uRes.y, 1.0)) - 1.0);
  vec4 wb = textureLod(tHalfB, vUv + feather * vec2(aspect, 1.0), blod);
  vec3 bleed = wb.rgb / max(wb.a, 0.001);
  float bl = wet * wet * uBrush.w * smoothstep(0.02, 0.25, wb.a);
  col = mix(col, bleed, bl);
  gl_FragColor = vec4(col, wet);
}
`;

const SHEET_FRAG = /* glsl */`
uniform sampler2D tAbs;
uniform highp sampler2D tAux;
uniform highp sampler2D tHalfA;
uniform sampler2D tPaper;
uniform vec2 uOutRes;
uniform vec2 uInTexel;
uniform vec3 uPaperColor;
uniform vec3 uGrade;
uniform vec4 uPig;        // edge pooling, granulation, wobble px (at 1080p), graphite
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
  vec4 paper = texture(tPaper, puv, 0.55);
  vec4 plo = texture(tPaper, puv * 0.19 + 0.37);
  vec4 pmid = texture(tPaper, puv * 0.47 + 0.11 + uBoil);

  // the painter's hand: edges wobble with the paper, never ruler-straight
  vec2 wob = ((pmid.ba - 0.5) * 2.0 + (plo.ba - 0.5) * 1.2) * uPig.z * sc / uOutRes;
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
  vec4 auxU = pcAuxDec(texture(tAux, uv));
  float lamp = step(7.95, auxU.w);      // (region 7 is what flies in the air: flakes, hail; its hash goes up to 7.9)
  // A picture being laid (an arrival): the washes come up out of the bare paper as one, the sky and the
  // far end a little before the ground at the feet, in broad soft tides that follow the paper: never
  // a piece at a time, never a stipple.
  float laid = 1.0;
  if (uLaid < 0.999) {
    // (slowly: no part of the sheet changes by more than a thirtieth of its depth in a thirtieth of a second)
    float when = 0.11 * (1.0 - vUv.y) + 0.07 * plo.r + 0.02 * pmid.r;
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
  vec3 sur = textureLod(tHalfA, uv, 2.2).rgb;
  float pool = max(0.0, dot(sur, W) - lum);
  vec3 cx = texture(tAbs, uv + vec2(uInTexel.x, 0.0)).rgb - texture(tAbs, uv - vec2(uInTexel.x, 0.0)).rgb;
  vec3 cy = texture(tAbs, uv + vec2(0.0, uInTexel.y)).rgb - texture(tAbs, uv - vec2(0.0, uInTexel.y)).rgb;
  float grad = length(cx) + length(cy);
  float edge = pool * 3.2 + smoothstep(0.03, 0.45, grad) * 0.35;

  // granulation: pigment settles into the valleys of the paper, strongest in darks and wets
  float ph = paper.r;
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
  vec4 psoft = texture(tPaper, puv * 0.47 + 0.11 + uBoil, 3.6);
  float pfine = texture(tPaper, puv, 1.5).r, pmed = texture(tPaper, puv * 0.47 + 0.11 + uBoil, 1.2).r;
  float pits = (0.52 - pfine) * 0.36 * smoothstep(0.10, 0.42, lum) + (0.5 - pmed) * 0.85;
  float settle = (0.5 - psoft.r) * 0.7 + (0.5 - plo.r) * 0.8;
  dark = min(dark, 1.0);
  float gran = (mix(pits, settle, dark) + (0.5 - plo.r) * 0.35) * (0.22 + 0.85 * (1.0 - lum) * smoothstep(0.02, 0.30, lum)) * (0.55 + 0.8 * wet) * mix(1.0, 0.4, dark);
  gran *= 1.0 - 0.5 * uWxSheet.x;
  float d = 1.0 + uPig.x * edge + uPig.y * gran + (plo.g - 0.5) * 0.10;
  // a storm shifts the whole key: every wash carries more pigment (richer, not greyer)
  // (PAINTER 16/17, the M4 critique's second item: at its full weight the key laid a thunderstorm at three in the afternoon
  // as dark as midnight, median L* 27; a rain study is a light picture. A little over half of it: the wood and the meadow
  // keep their steps and the storm is told by the sky's wash, the veil and the rain)
  d += uWxSheet.x * 0.55 * (0.75 + 0.5 * plo.r);
  // (night, PAINTER 16: the moon models the land in the materials now, chunks.js pcLevel, so the key only deepens the
  // washes a little; it was 0.68 to 0.94, which ran every middle value down into one dark, 80 % of the frame within 7 L*)
  d += uNight * (0.30 + 0.20 * plo.r) * (1.0 - lamp);
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
  float bn = b + (plo.g - 0.5) * uBorder.y + (mix(pmid.g, psoft.g, dark) - 0.5) * uBorder.y * 0.45 + (paper.g - 0.5) * 0.006 * (1.0 - dark) - (1.0 - corner) * 0.012;
  float painted = mix(1.0, smoothstep(uBorder.x * 0.72, uBorder.x, bn), uBorder.w);
  float lip = (1.0 - smoothstep(uBorder.x, uBorder.x * 2.2, bn)) * painted * uBorder.w;
  // (a dark wash does not pool again where it stops: under the storm's key the border was a dirty grey rim round the sheet)
  d += lip * uBorder.z * (0.4 + 0.6 * plo.r) * mix(1.0, 0.25, dark);
  // dry edge: near the border the brush skips the paper's peaks
  // (a loaded dark wash skips far less: a few broad flecks of paper, never a pale rim with dark specks in it)
  float skL = smoothstep(0.46, 0.62, mix(ph, pmid.r, 0.65));
  float skD = smoothstep(0.63, 0.72, psoft.r * 0.6 + plo.r * 0.4 + (pmed - 0.5) * 0.2) * 0.55;
  float skip = (1.0 - smoothstep(uBorder.x * 0.9, uBorder.x * 1.6, bn)) * mix(skL, skD, dark) * uBorder.w;

  col = clamp(col - (col - col * col) * (d - 1.0), 0.0, 1.0);

  // graphite underdrawing on major silhouettes: faint, broken, catching the paper tooth
  vec2 guv = vUv + wob * 0.4 + shake + vec2(1.4, -0.9) * sc / uOutRes;      // (shake: the pencil follows the soft enlargement)
  vec4 a0 = pcAuxDec(texture(tAux, guv));
  vec4 a1 = pcAuxDec(texture(tAux, guv + vec2(uInTexel.x * 1.5, 0.0)));
  vec4 a2 = pcAuxDec(texture(tAux, guv + vec2(0.0, uInTexel.y * 1.5)));
  float dz = max(abs(a1.z - a0.z), abs(a2.z - a0.z));
  float c0 = floor(a0.w), c1 = floor(a1.w), c2 = floor(a2.w);
  // region changes count only where a solid thing (prop, character) meets something else
  float solid = max(step(2.5, c0) * step(c0, 3.5) + step(4.5, c0) * step(c0, 5.5), max(step(2.5, c1) * step(c1, 3.5) + step(4.5, c1) * step(c1, 5.5), step(2.5, c2) * step(c2, 3.5) + step(4.5, c2) * step(c2, 5.5)));
  c0 = min(c0, 5.0); c1 = min(c1, 5.0); c2 = min(c2, 5.0);
  float idc = max(abs(c1 - c0), abs(c2 - c0)) * min(solid, 1.0);
  float fol = max(step(3.5, a0.w) * step(a0.w, 4.99), max(step(3.5, a1.w) * step(a1.w, 4.99), step(3.5, a2.w) * step(a2.w, 4.99)));
  float line = max(smoothstep(0.14, 0.38, dz) * 0.6, min(idc, 1.0) * 0.38) * (1.0 - fol * 0.85);
  line *= 1.0 - max(step(5.5, a0.w), max(step(5.5, a1.w), step(5.5, a2.w)));   // nothing is outlined in the air
  line *= smoothstep(0.50, 0.70, plo.r + (pmid.r - 0.5) * 0.7) * (0.30 + 0.70 * smoothstep(0.35, 0.6, ph)) * (1.0 - smoothstep(6.5, 9.5, a0.z));
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
    float lift = uWxSheet.y * (isSky * (0.62 + 0.33 * smoothstep(0.0, 0.42, dot(sur, W))) + (1.0 - isSky) * smoothstep(0.25, 0.75, dot(col, W)) * 0.55);
    col = mix(col, vec3(1.0), clamp(lift, 0.0, 0.92));
  }
  // (at night the land keeps a floor, PAINTER 12; PAINTER 16: a soft floor only. The darkest washes gather a little above
  // the night's deepest indigo and everything over them keeps its step: the old toe laid all the washes under half value
  // into one narrow band, which was most of why the land at night was one value)
  if (uNight > 0.003) {
    float land = step(0.5, auxU.w) * (1.0 - lamp);
    vec3 toe = vec3(0.16, 0.175, 0.27) + 0.025 * (psoft.r - 0.5);
    vec3 c2 = col * col, t2 = toe * toe;
    col = mix(col, sqrt(sqrt(c2 * c2 + t2 * t2)), uNight * land * laid);
  }
  // (and under a storm's key, PAINTER 13: the storm lays more pigment into every wash, and Neptune's basalt cliffs and
  // stacks went to one flat near-black mass, L 14; the land's darkest washes are laid into a band above the floor, a
  // gentle toe, so a cliff in a gale is dense indigo with its steps still in it)
  if (uWxSheet.x > 0.003) {
    float landS = step(0.5, auxU.w);
    vec3 toeS = vec3(0.12, 0.13, 0.21) + 0.02 * (psoft.r - 0.5);
    col = max(col, mix(col, toeS + col * (1.0 - toeS / 0.55), min(uWxSheet.x, 1.0) * landS * laid));
  }
  // nothing is pure black: the darkest darks are dense indigo and sepia
  col = max(col, vec3(0.085, 0.09, 0.145) + 0.03 * (psoft.r - 0.5) + uNight * vec3(0.035, 0.045, 0.075));
  col = mix(vec3(1.0), col, painted * (1.0 - skip * 0.8));

  // paper: warm off-white, lit so its tooth shows faintly even where it is bare
  float relief = (ph - 0.5) * 0.055 * mix(1.0, 0.35, dark) + (plo.g - 0.5) * 0.02;
  // the last glaze over the sheet (night indigo, dusk gold); at night what was reserved stays paper
  float reserve = max(max(smoothstep(0.90, 0.985, dot(col, W)) * uNight, lamp), min(uWxSheet.y, 1.0) * smoothstep(0.45, 0.80, dot(col, W)));
  vec3 outc = uPaperColor * col * (1.0 + relief) * mix(vec3(1.0), mix(uGrade, vec3(1.0), reserve), painted);
  gl_FragColor = vec4(outc, 1.0);
}
`;

function fsMaterial(frag, uniforms, extra) {
  return new THREE.ShaderMaterial(Object.assign({
    uniforms, vertexShader: FS_VERT, fragmentShader: frag,
    depthTest: false, depthWrite: false,
  }, extra || {}));
}

export class Post {
  constructor(renderer) {
    this.renderer = renderer;
    // Float targets need EXT_color_buffer_float or _half_float (nearly every desktop WebGL 2 has one). Without, every
    // target is 8-bit and what the scene pass's second target and last frame's depth carry is packed (shared.js uAux8).
    const ex = renderer.extensions;
    this.floatFallback = !!(ex && ex.has && !ex.has('EXT_color_buffer_float') && !ex.has('EXT_color_buffer_half_float'));
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

    this.rtScene = new THREE.WebGLRenderTarget(2, 2, { count: 2, depthBuffer: true, type: THREE.UnsignedByteType });
    this.rtScene.textures[0].minFilter = THREE.LinearFilter; this.rtScene.textures[0].magFilter = THREE.LinearFilter;
    this.rtScene.textures[1].type = HF;
    this.rtScene.textures[1].minFilter = THREE.NearestFilter; this.rtScene.textures[1].magFilter = THREE.NearestFilter;
    this.rtScene.depthTexture = new THREE.DepthTexture(2, 2, THREE.FloatType);

    this.rtHalf = new THREE.WebGLRenderTarget(2, 2, { count: 2, depthBuffer: false, type: HF });
    this.rtHalf.textures[1].type = THREE.UnsignedByteType;
    for (const t of this.rtHalf.textures) { t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; }

    this.rtAbs = new THREE.WebGLRenderTarget(2, 2, { depthBuffer: false, type: THREE.UnsignedByteType });
    this.rtAbs.texture.minFilter = THREE.LinearFilter; this.rtAbs.texture.magFilter = THREE.LinearFilter;

    // last frame's painting + depth, kept for the water's reflections
    this.rtPrev = new THREE.WebGLRenderTarget(2, 2, { depthBuffer: false, type: HF });
    this.rtPrev.texture.minFilter = THREE.LinearFilter; this.rtPrev.texture.magFilter = THREE.LinearFilter;
    this.mKeep = fsMaterial(/* glsl */`
      uniform sampler2D tAbs; uniform highp sampler2D tAux; varying vec2 vUv;
      void main() { gl_FragColor = vec4(texture(tAbs, vUv).rgb, texture(tAux, vUv).z); }`,
      { tAbs: { value: this.rtAbs.texture }, tAux: { value: this.rtScene.textures[1] } });
    G.uPrevTex.value = this.rtPrev.texture;
    this.prevFrames = 0;

    this.mBackdrop = fsMaterial(BACKDROP_FRAG, { uAux8: G.uAux8 });
    this.mPrep = fsMaterial(PREP_FRAG, { tScene: { value: this.rtScene.textures[0] }, uTexel: { value: new THREE.Vector2() } });
    this.absUniforms = {
      tScene: { value: this.rtScene.textures[0] }, tAux: { value: this.rtScene.textures[1] },
      tHalfA: { value: this.rtHalf.textures[0] }, tHalfB: { value: this.rtHalf.textures[1] },
      tPaper: { value: tex.paper },
      uTexel: { value: new THREE.Vector2() }, uRes: { value: new THREE.Vector2() },
      uBrush: { value: new THREE.Vector4(0.0036, 0.0085, 0.013, 0.8) },
      uAbstraction: { value: 1 }, uAux8: G.uAux8,
    };
    this.mAbs = {};
    for (const s of [4, 8]) this.mAbs[s] = fsMaterial(ABS_FRAG, this.absUniforms, { defines: { SECTORS: s } });
    this.sheetUniforms = {
      tAbs: { value: this.rtAbs.texture }, tAux: { value: this.rtScene.textures[1] }, tHalfA: { value: this.rtHalf.textures[0] },
      tPaper: { value: tex.paper },
      uOutRes: { value: new THREE.Vector2() }, uInTexel: { value: new THREE.Vector2() },
      uPaperColor: G.uPaperColor, uGrade: { value: new THREE.Vector3(1, 1, 1) },
      uPig: { value: new THREE.Vector4(1.0, 1.0, 2.6, 0.55) },
      uBorder: { value: new THREE.Vector4(0.030, 0.034, 0.9, 1) },
      uBoil: { value: new THREE.Vector2(0, 0) },
      uWxSheet: { value: new THREE.Vector4(0, 0, 0, 0) },
      uNight: { value: 0 }, uNightNear: { value: 0 }, uLaid: { value: 1 }, uAux8: G.uAux8,
    };
    this.mSheet = fsMaterial(SHEET_FRAG, this.sheetUniforms);
    this.debugView = 0;
    this.mCopy = fsMaterial(/* glsl */`
      uniform sampler2D tA; uniform highp sampler2D tB; uniform int uMode; varying vec2 vUv;
      void main() {
        if (uMode == 1) gl_FragColor = vec4(texture(tA, vUv).rgb, 1.0);
        else if (uMode == 2) gl_FragColor = vec4(vec3(texture(tA, vUv).a), 1.0);
        else if (uMode == 3) { vec4 a = texture(tB, vUv); gl_FragColor = vec4(a.xy * 0.5 + 0.5, a.z / 20.0, 1.0); }
        else { vec4 a = texture(tB, vUv); gl_FragColor = vec4(fract(a.w), floor(a.w) / 6.0, 0.5, 1.0); }
      }`, { tA: { value: null }, tB: { value: this.rtScene.textures[1] }, uMode: { value: 1 } });
  }

  setSize(outW, outH, scale) {
    outW = Math.max(2, outW | 0); outH = Math.max(2, outH | 0);
    const inW = Math.max(2, Math.round(outW * scale)), inH = Math.max(2, Math.round(outH * scale));
    if (outW === this.outW && outH === this.outH && inW === this.inW && inH === this.inH) return;
    this.outW = outW; this.outH = outH; this.inW = inW; this.inH = inH;
    this.rtScene.setSize(inW, inH);
    this.rtHalf.setSize(Math.max(1, inW >> 1), Math.max(1, inH >> 1));
    this.rtAbs.setSize(inW, inH);
    this.rtPrev.setSize(Math.max(1, inW >> 1), Math.max(1, inH >> 1));
    this.prevFrames = 0; G.uPrevOn.value = 0;
    this.mPrep.uniforms.uTexel.value.set(1 / inW, 1 / inH);
    this.absUniforms.uTexel.value.set(1 / inW, 1 / inH);
    this.absUniforms.uRes.value.set(inW, inH);
    G.uSceneAux.value = this.rtScene.textures[1]; G.uSceneRes.value.set(inW, inH); G.uSceneCol.value = this.rtScene.textures[0];
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
    this.tri.material = this.mBackdrop;
    r.render(this.tri, this.cam);
  }

  // glazes: objects drawn over the brushed picture (see shared.js GLAZES), with the scene's camera
  finish(glazes, camera) {
    this._pass(this.mPrep, this.rtHalf);
    this._pass(this.mAbs[this.sectors], this.rtAbs);
    if (glazes && glazes.length) {
      const r = this.renderer;
      r.setRenderTarget(this.rtAbs);
      for (const o of glazes) { o.visible = true; r.render(o, camera); }
    }
    this._pass(this.mKeep, this.rtPrev);
    this.prevFrames++;
    G.uPrevOn.value = this.prevFrames >= 1 ? 1 : 0;
    if (this.debugView) {
      const m = this.mCopy;
      m.uniforms.uMode.value = this.debugView;
      m.uniforms.tA.value = this.debugView === 5 ? this.rtAbs.texture : this.rtScene.textures[0];
      if (this.debugView === 5) m.uniforms.uMode.value = 1;
      this._pass(m, null);
    } else {
      this._pass(this.mSheet, null);
    }
  }

  // The brush's passes that are not drawn every frame laid once into a 2 x 2 sheet (PILOT's P3), so that
  // none is first built mid-game: the four-sector brush is otherwise first drawn at the lowest tier, when
  // the machine is already struggling. (The prep, keep and backdrop passes run from the first frame.)
  warm() {
    const t = new THREE.WebGLRenderTarget(2, 2, { depthBuffer: false, type: THREE.UnsignedByteType });
    for (const m of [this.mAbs[4], this.mAbs[8], this.mSheet]) this._pass(m, t);
    t.dispose();
  }

  dispose() {
    this.rtScene.dispose(); this.rtHalf.dispose(); this.rtAbs.dispose(); this.rtPrev.dispose();
  }
}
