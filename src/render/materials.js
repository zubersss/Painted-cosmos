// Painted Cosmos: painted scene materials. OWNER: PAINTER.
// The watercolor look starts here, in the materials: washes with pigment-density turbulence,
// value-stepped light, cool glaze shadows, dry-brush sparkle, banded aerial perspective. The
// post passes (post.js) then treat the result as wet paint on paper.
import * as THREE from 'three';
import { G, PHYS, PHYSW, PREV, OIL, LOOK, register, ensureGlobals, makeBodyUniforms } from './shared.js';
import { FLORA_GLSL } from '../physics/flora.glsl.js';
import { WATER_GLSL } from '../physics/water.js';
import { VERT_PARS, VERT_END, FRAG_PARS, FOG_BANK } from './chunks.js';

const FOG_VERT = /* glsl */`
#ifdef PC_OIL
uniform vec4 uOilC;
#endif
uniform vec4 uFog;
uniform vec2 uAirNear;
uniform highp sampler3D uNoise3D;
uniform vec2 uFogBank;
${FOG_BANK}
float pcFogAmountV(float dist) {
  #ifdef PC_OIL
    dist *= mix(uOilC.w, 1.6, clamp((1.0 / max(uFog.x, 1e-6) - 200.0) / 400.0, 0.0, 1.0));     // (as chunks.js pcFogAmount)
  #endif
  float f = 1.0 - exp(-dist * uFog.x);
  #ifdef PC_OIL
    f = f * f * (3.0 - 2.0 * f);
  #endif
  float q = f * uFog.y;
  float fl = floor(q);
  f = (fl + smoothstep(0.15, 0.85, q - fl)) / uFog.y;
  return clamp(max(f * uFog.z, uAirNear.x * (1.0 - exp(-dist / max(uAirNear.y, 0.1)))), 0.0, 1.0);
}
`;

let _defaultBody = null;
export function defaultBodyUniforms() {
  if (!_defaultBody) _defaultBody = makeBodyUniforms();
  return _defaultBody;
}

function baseUniforms(bodyU, own) {
  ensureGlobals();
  const b = bodyU || defaultBodyUniforms();
  return Object.assign({
    uTime: G.uTime, uNoise3D: G.uNoise3D, uStrokeTex: G.uStrokeTex, uCast: G.uCast, uCastK: G.uCastK, uAirNear: G.uAirNear, uAux8: G.uAux8,
    uSunDirW: b.uSunDirW, uSunDirL: b.uSunDirL, uGlaze: b.uGlaze, uLight: b.uLight, uHaze: b.uHaze, uHazeUp: b.uHazeUp || G.uNoHazeUp, uUpW: b.uUpW || G.uUpW0,
    uFog: b.uFog, uDayness: b.uDayness, uMoon: b.uMoon || G.uMoon0, uStorm: b.uStorm, uHueA: b.uHueA, uHueB: b.uHueB, uBodyR: b.uBodyR, uWx: b.uWx, uRound: b.uRound || G.uRound0, uHeart: b.uHeart || G.uHeart0, uFogBank: b.uFogBank || G.uFogBank0,
    uGroundK: b.uGroundK || G.uGroundK0,
    ...OIL,
  }, own || {});
}

// The uniforms every painted material needs (what FRAG_PARS declares), for materials built
// outside this file: makePaintUniforms(bodyUniforms?, own?) -> uniforms object. Pass the
// body's uniforms (world.bodyUniforms(id)) to be lit and hazed like that body.
export function makePaintUniforms(bodyU, own) { return baseUniforms(bodyU, own); }

// ------------------------------------------------------------------------------------------
// Terrain
// ------------------------------------------------------------------------------------------
const TERRAIN_VERT = /* glsl */`
${VERT_PARS}
attribute vec3 aMorph;
attribute vec4 aColor;
attribute vec4 aColor2;
attribute vec4 aParams;
attribute vec4 aColorP;   // the same vertex as the parent patch paints it (washes, parameters, normal): a patch
attribute vec4 aColor2P;  // that has just taken over from its parent shows exactly what the parent showed
attribute vec4 aParamsP;  // and slides to its own look, so the ground never changes in one frame
attribute vec3 aNormalP;
uniform vec3 uOrigin;     // patch origin, body-local metres
uniform vec3 uAnchor;     // patch origin modulo the stroke tile period
uniform vec3 uCamLocal;   // camera relative to the patch origin, body-local axes
uniform vec3 uMorph;      // xy: distance range over which this level morphs to its parent; z: how much of the parent's look it still wears (it took over a moment ago)
varying vec3 vBody;
varying vec3 vAnch;
varying vec3 vNV;
varying vec3 vNL;
varying vec3 vView;
varying vec4 vCol;
varying vec3 vCol2;
varying vec4 vPar;
varying vec3 vUpV;
#ifdef PC_OIL
varying vec3 vRel;        // the place measured from the eye, in the body's axes: small numbers, so its screen derivatives are exact (chunks.js pcGroundChartD)
#endif
void main() {
  float d = distance(position, uCamLocal);
  float m = max(clamp((d - uMorph.x) / (uMorph.y - uMorph.x), 0.0, 1.0), uMorph.z);
  vec3 p = position + aMorph * m;
  vBody = p + uOrigin;
  #ifdef PC_OIL
    vRel = p - uCamLocal;
  #endif
  vAnch = p + uAnchor;
  vec3 nrm = normalize(normal + aNormalP * m);
  vNL = nrm;
  vNV = normalMatrix * nrm;
  vUpV = normalMatrix * normalize(vBody);
  vec4 mv = modelViewMatrix * vec4(p + pcRound(vBody), 1.0);
  vView = mv.xyz;
  vCol = mix(aColor, aColorP, m); vCol2 = mix(aColor2.rgb, aColor2P.rgb, m); vPar = mix(aParams, aParamsP, m);
  gl_Position = projectionMatrix * mv;
  ${VERT_END}
}
`;

const TERRAIN_FRAG = /* glsl */`
${FRAG_PARS}
varying vec3 vBody;
varying vec3 vAnch;
varying vec3 vNV;
varying vec3 vNL;
varying vec3 vView;
varying vec4 vCol;
varying vec3 vCol2;
uniform vec3 uHueA;
uniform vec3 uHueB;
uniform float uBodyR;
varying vec4 vPar;
varying vec3 vUpV;
// PHYSICS' push field (what has been trodden or blown flat): the ground shows the track
${FLORA_GLSL}
uniform float uPhysOn;
uniform vec2 uRound;      // x: how far from the ground the eye is, as the relief is drawn in (0 on the ground .. 0.75 from orbit)
uniform vec4 uHeart;      // a great pale marking seen from orbit: xyz its place, w its size (0: none)
#ifdef PC_OIL
// THE GROUND IN THE OIL LOOK (chunks.js: "the oil look's strokes", "dabs"). Leaf dabs lying every way, as the clip's
// forest floor (the owner's style 5): the ground's own colour under two layers of them, an octave apart. A dab's paint
// is worked out at its own centre (the ground's washes there, the light, the leaf shadow) and laid flat, and under
// trees a share of the dabs take the canopy's colour: the leaves that have fallen.
// (Tried at checkpoint 1 and dropped by the owner's choice: thin strokes along the land, tiles; in the history.)
// (Not carried over from the watercolour yet: strata, cracks, puddles, the trodden track, a world's great marking.)
varying vec3 vRel;
vec3 gBdx, gBdy, gC2dx, gC2dy, gNvdx, gNvdy, gNldx, gNldy, gSunV, gBc;
vec3 gCtrB;       // a dab's own place on the body (set before pcGroundAt; x > 1e20: none, the place is carried from the pixel)
vec4 gCdx, gCdy, gPdx, gPdy;
float gMid;
// The ground where a stroke lies (ds: the pixels from here to its centre; w: its width, m): its wash, the light's
// level, the snow's cover, the canopy's colour and its cover there.
void pcGroundAt(vec2 ds, float w, vec3 rnd, out vec3 c, out float lvl, out float snowC, out vec3 leaf, out float canopy) {
  vec3 Bc = gCtrB.x > 1e20 ? vBody + gBdx * ds.x + gBdy * ds.y : gCtrB;
  vec4 colC = clamp(vCol + gCdx * ds.x + gCdy * ds.y, 0.0, 1.0);
  vec3 col2C = clamp(vCol2 + gC2dx * ds.x + gC2dy * ds.y, 0.0, 1.0);
  vec4 parC = vPar + gPdx * ds.x + gPdy * ds.y;
  vec3 nVc = normalize(vNV + gNvdx * ds.x + gNvdy * ds.y), nLc = normalize(vNL + gNldx * ds.x + gNldy * ds.y);
  c = mix(col2C, colC.rgb, gMid);                  // (far away the forest floor is its canopy)
  vec4 n1 = pcNoiseS(Bc, 31.0, w), n2 = pcNoiseS(Bc + 0.21 * 6.3, 6.3, w);
  c = mix(c, c * uHueA, smoothstep(0.50, 0.72, n1.b) * 0.8);
  c = mix(c, c * uHueB, smoothstep(0.52, 0.74, n2.r) * 0.6 * gMid);
  c = pcDensity(c, 1.0 + (n1.r - 0.5) * 0.5 * uOilB.z);
  snowC = pcSnowCover(dot(nLc, normalize(Bc)), rnd.z * 0.5 + n2.b * 0.3 + n1.a * 0.2, parC.z);
  // the light, a stroke at a time: in the sun or in the leaf shadow whole
  float x = dot(nVc, gSunV) * 0.5 + 0.5;
  float sunny = min(pcSunAtSoft(Bc, parC.z * mix(0.82, 1.0, gMid), 8.0, w, fract(rnd.y * 5.7)), 1.0 - pcCast(Bc, (rnd.x - 0.5) * 0.3));
  lvl = pcLevel(mix(min(x, 0.44) - 0.10 * parC.z, x + (rnd.z - 0.5) * 0.10, sunny), 0.03);
  leaf = pcDensity(col2C, 1.15);
  canopy = parC.z;
  gBc = Bc;
}
// One stroke's paint from that: its own colour (a fallen leaf's, for the share fk of the strokes), the snow, the light.
vec3 pcGroundPaint(vec3 c, vec3 leaf, float fk, vec3 rnd, float snowC, float lvl) {
  float f = step(1.0 - fk, fract(rnd.z * 13.7));
  // (bare ground and grass, where no leaf has fallen: a dab is the ground's colour or one of its two neighbouring
  // pigments, and a share of the dabs are laid a step deeper; lit grass all of one colour was a flat lemon patch,
  // in a clearing and from the air: the stills after overhauls 3 to 5)
  float gq = fract(rnd.y * 23.3);
  vec3 cg = gq > 0.72 ? c * uHueA : gq < 0.24 ? c * uHueB : c;
  lvl -= (1.0 - f) * step(0.58, fract(rnd.x * 11.1)) * 0.9 * step(1.5, lvl);
  vec3 k = pcDabTint(mix(cg, leaf, f), rnd, f);
  k = mix(pcWetWash(k, 1.0 - snowC), mix(vec3(0.94, 0.955, 1.0), vec3(0.86, 0.90, 1.0), rnd.x * 0.6), snowC);
  return pcLamp(pcTone(k, lvl), k, gBc, rnd.y);
}
void main() {
  #include <logdepthbuf_fragment>
  float dist = length(vView);
  vec3 nV = normalize(vNV);
  gSunV = normalize((viewMatrix * vec4(uSunDirW, 0.0)).xyz);
  gMid = 1.0 - smoothstep(120.0, 420.0, dist);
  vec2 ch = pcGroundChart(vBody, uBodyR);
  gBdx = dFdx(vRel); gBdy = dFdy(vRel);
  vec2 dlx = pcGroundChartD(vBody, gBdx, uBodyR), dly = pcGroundChartD(vBody, gBdy, uBodyR);
  gCtrB = vec3(1e30);
  gCdx = dFdx(vCol); gCdy = dFdy(vCol);
  gC2dx = dFdx(vCol2); gC2dy = dFdy(vCol2);
  gPdx = dFdx(vPar); gPdy = dFdy(vPar);
  gNvdx = dFdx(vNV); gNvdy = dFdy(vNV); gNldx = dFdx(vNL); gNldy = dFdy(vNL);
  float wpx = uOilA.x * uOilPx.y / 720.0;
  vec3 c, leaf; float lvl, snowC, canopy;
  vec3 acc;
  if (uGroundK.x > 0.5) {
    // a world of snow and ice: LONG THIN STROKES THAT RUN WITH THE LAND, as the clip's snow is laid (its night frames,
    // looked at again for the overhaul plan's night: flowing streaks of turquoise, blue and near white, no line between
    // them). The rows lie on the contours of a slope. Two layers an octave apart: a stroke of the finer one is there or
    // it is not, whole (asked at its own centre), and where it is not the coarser shows. (Before: a course of tiles
    // with a light edge, which stood as a pavement of outlined stones: the stills after overhauls 1 and 2.)
    vec2 chT = vec2(ch.x, ch.y + 1.4 * (length(vBody) - uBodyR));
    vec3 upT = normalize(vBody);
    vec2 dtx = vec2(dlx.x, dlx.y + 1.4 * dot(upT, gBdx)), dty = vec2(dly.x, dly.y + 1.4 * dot(upT, gBdy));
    vec4 ot = pcStrokeOct4(dist * 2.0, uOilPx.z * 2.0);
    vec2 lgT = vec2(dFdx(ot.w), dFdy(ot.w));
    vec3 r0, n0, r1, n1; vec2 ds0, ds1; float own0, own1;
    // (long strokes in slow wide arcs: laid in quick waves, flat snow read as open water: the critic, on the first night)
    pcThinLayer(chT, dtx, dty, ot.x, 8.0, vBody, 14.0 * wpx * 8.0, -34.0, r0, ds0, own0, n0);
    pcThinLayer(chT, dtx, dty, ot.x * 2.0, 8.0, vBody, 28.0 * wpx * 8.0, -34.0, r1, ds1, own1, n1);
    float fr0 = ot.w - ot.z;
    bool fine = r0.z >= smoothstep(0.15, 0.85, fr0 + dot(lgT, ds0));
    bool fineN = n0.z >= smoothstep(0.15, 0.85, fr0);
    vec3 pc0 = vec3(0.0), pc1 = vec3(0.0);
    if (!fine || (own0 < 0.999 && !fineN)) {
      // the coarser layer here: its stroke, and the stroke beside it over the pixel at their edge
      pcGroundAt(ds1, ot.x * 2.0, r1, c, lvl, snowC, leaf, canopy);
      pc1 = pcGroundPaint(c, leaf, 0.0, r1, snowC, lvl + (r1.x - 0.5) * 0.9);
      if (own1 < 0.999) pc1 = mix(pcGroundPaint(c, leaf, 0.0, n1, snowC, lvl + (n1.x - 0.5) * 0.9), pc1, own1);
    }
    if (fine) {
      pcGroundAt(ds0, ot.x, r0, c, lvl, snowC, leaf, canopy);
      pc0 = pcGroundPaint(c, leaf, 0.0, r0, snowC, lvl + (r0.x - 0.5) * 0.9);
      if (own0 < 0.999) pc0 = mix(fineN ? pcGroundPaint(c, leaf, 0.0, n0, snowC, lvl + (n0.x - 0.5) * 0.9) : pc1, pc0, own0);
    }
    acc = fine ? pc0 : pc1;
  } else {
  // leaf dabs (the owner's style 5), in three layers an octave apart and LAID FROM THE TOP DOWN: the finest (its dabs
  // left out one by one toward the next octave), the middle one whole, the coarsest coming in under them, so that at the
  // step of an octave nothing changes: the middle layer is then the finest, and the coarsest the middle. (Leaves of
  // many sizes, the overhaul plan's fifth piece: a third of the finest layer's dabs are never laid, so dabs twice and
  // four times the size show between them, as the big leaves among the small on the clip's floor.) A pixel
  // a dab covers whole stops there: most pixels work out one layer, where they worked out two and the ground under them
  // before (the overhaul plan's "strokes baked", chunks.js). Under the last dab the ground's own colour, the light and
  // the leaf shadow as the pixel has them.
  // (seen at a low angle a dab is squeezed flat on the screen: far across a level floor the dabs were lines a pixel
  // high, a hatching; so the dabs are laid larger the lower the angle, up to three times)
  float graze = inversesqrt(max(abs(dot(nV, normalize(-vView))), 0.11));
  vec4 o4 = pcStrokeOct4(dist * uOilS.w * graze, uOilPx.z * uOilS.w);
  vec3 ocl = vec3(o4.w - o4.z, dFdx(o4.w), dFdy(o4.w));
  float lw = max(length(gBdx), length(gBdy));
  // (a dab's own place: where its centre's chart lies on the sphere, at the ground's height carried there)
  float rB = length(vBody);
  vec3 upB = vBody / rB;
  float rdx = dot(upB, gBdx), rdy = dot(upB, gBdy);
  acc = vec3(0.0);
  float rem = 1.0;
  for (int L = 0; L < 3; L++) {
    if (rem < 0.004) break;
    float ws = L == 0 ? 1.0 : L == 1 ? 2.0 : 4.0, w = o4.x * ws;
    vec3 rnd, rnd2; vec2 ds, ctr; float cov, has2;
    pcDabLayer(ch, dlx, dly, w, uOilS.z, 4.0 * wpx * uOilS.w * ws, ocl,
               L == 0 ? vec2(0.35, 0.65) : L == 1 ? vec2(0.0, 0.35) : vec2(1.0, -1.0), rnd, ctr, ds, cov, rnd2, has2);
    if (cov <= 0.0) continue;
    gCtrB = pcGroundUnchart(vBody, ctr, uBodyR) * (rB + rdx * ds.x + rdy * ds.y);
    pcGroundAt(ds, w, rnd, c, lvl, snowC, leaf, canopy);
    float fk = clamp(canopy * 1.6, 0.0, 0.88) * gMid;      // (under trees the floor is nearly all fallen leaves, with the earth dark between)
    acc += rem * cov * pcGroundPaint(c, leaf, fk, rnd, snowC, lvl);
    rem *= 1.0 - cov;
    if (has2 > 0.5 && rem >= 0.004) { acc += rem * pcGroundPaint(c, leaf, fk, rnd2, snowC, lvl); rem = 0.0; }
  }
  gCtrB = vec3(1e30);
  if (rem >= 0.004 || uOilC.z < 0.999) {
    float x0 = dot(nV, gSunV) * 0.5 + 0.5;
    float sun0 = min(pcSunAtSoft(vBody, vPar.z * mix(0.82, 1.0, gMid), 8.0, max(lw, o4.x * 0.5), 0.5), 1.0 - pcCast(vBody, 0.0));
    vec3 bare = pcTone(pcDensity(mix(vCol2, vCol.rgb, gMid), 1.15), pcLevel(mix(min(x0, 0.44) - 0.10 * vPar.z, x0, sun0), 0.05));
    acc = mix(bare, acc + rem * bare, uOilC.z);
  }
  }
  float f = pcFogAmount(dist * pcFogBank(vBody));
  vec3 cOut = pcAtmosV(acc, f, vView);
  vec3 upV = normalize(vUpV);
  float limb = pow(1.0 - clamp(dot(upV, normalize(-vView)), 0.0, 1.0), 2.5) * uFog.w;
  cOut = mix(cOut, pcOilHaze(uHaze), limb);
  pcWrite(cOut, 0.0, nV, -vView.z, 1.0);
}
#else
void main() {
  #include <logdepthbuf_fragment>
  pcFp = pcFootprint(vBody);      // (R1 W2.1: every mark below is laid as the pixel sees it, chunks.js)
  pcDist = length(vView);         // (R1 re-fix: the leaf shadow's far octaves, chunks.js)
  vec3 nV = normalize(vNV);
  vec3 nL = normalize(vNL);
  float dist = length(vView);
  float near = 1.0 - smoothstep(18.0, 80.0, dist);
  float mid = 1.0 - smoothstep(120.0, 420.0, dist);

  vec4 n1 = texture(uNoise3D, vBody / 31.0);
  vec4 n2 = texture(uNoise3D, vBody / 6.3 + 0.21);
  // Brush marks: short broken touches that keep about the same size on the sheet, so far
  // ground gets fewer, larger marks. Two octaves of a field anchored to the planet in 3D (no
  // projection axis, nothing to stretch), each thresholded on its own and cross-faded.
  float lodf = log2(max(dist / 4.0, 1.0));
  float l0 = floor(lodf);
  float lf = smoothstep(0.2, 0.8, lodf - l0);
  vec3 q = vBody * exp2(-l0);
  vec4 ma = texture(uNoise3D, q / 2.3 + 0.13), mb = texture(uNoise3D, q / 4.6 + 0.13);
  vec4 fa = texture(uNoise3D, q / 0.61 + 0.57), fb = texture(uNoise3D, q / 1.22 + 0.57);
  float markFade = 1.0 - smoothstep(150.0, 520.0, dist);
  float ms = exp2(l0);       // (the marks' octave, metres per unit of q: what of each pattern lies inside the pixel scales with it)

  // far away the forest floor reads as its canopy: one broad soft wash
  vec3 c = mix(vCol2, vCol.rgb, mid);

  // wash turbulence: the pigment load drifts, so no area is flat colour
  float d = 1.0 + (n1.r - 0.5) * 0.75 + (n2.g - 0.5) * 0.40 * near;
  // broken colour: darker touches of the brush inside the wash
  // (soft-edged and of uneven size: touches laid into a damp wash, not a pattern of dots)
  float dab = mix(pcStepF(0.50, 0.66, ma.r * 0.72 + ma.a * 0.28, 0.5184 * pcSub(2.3 * ms, PC_NRG) + 0.0784 * pcSub(2.3 * ms, PC_NA)),
                  pcStepF(0.50, 0.66, mb.r * 0.72 + mb.a * 0.28, 0.5184 * pcSub(4.6 * ms, PC_NRG) + 0.0784 * pcSub(4.6 * ms, PC_NA)), lf) * markFade;
  d += dab * 0.30 * (1.0 - vPar.x * 0.5);
  // small crisp marks: grass, twigs, grit, laid with the tip of the brush
  float flick = mix(pcStepF(0.668, 0.70, fa.g * 0.72 + ma.b * 0.28, 0.5184 * pcSub(0.61 * ms, PC_NRG) + 0.0784 * pcSub(2.3 * ms, PC_NB)),
                    pcStepF(0.668, 0.70, fb.g * 0.72 + mb.b * 0.28, 0.5184 * pcSub(1.22 * ms, PC_NRG) + 0.0784 * pcSub(4.6 * ms, PC_NB)), lf) * markFade;
  d += flick * 0.50 * (0.25 + 1.25 * vPar.x) * smoothstep(1.5, 7.0, dist);    // grit shows on rough ground, hardly at all on smooth sand or ice
  // neighbouring pigments run into each other: drifts of green and of warm earth
  vec3 hueA = c * uHueA;
  vec3 hueB = c * uHueB;
  c = mix(c, hueA, pcStepF(0.50, 0.72, n1.b, pcSub(31.0, PC_NB)) * 0.8);
  c = mix(c, hueB, pcStepF(0.52, 0.74, n2.r, pcSub(6.3, PC_NRG)) * 0.6 * mid);

  // strata: beds of unequal thickness that follow the height, strongest on steep faces
  float steep = smoothstep(0.05, 0.38, 1.0 - dot(nL, normalize(vBody)));
  if (vCol.a < 0.995) {
    float strata = 1.0 - vCol.a;
    float hgt = length(vBody) - uBodyR;
    float b1 = texture(uNoise3D, vec3(hgt / 41.0 + (n1.r - 0.5) * 0.10, 0.31, 0.77)).r;
    float b2 = texture(uNoise3D, vec3(hgt / 11.0 + (n2.g - 0.5) * 0.12, 0.13, 0.41)).g;
    float beds = (b1 - 0.5) * 1.7 + (b2 - 0.5) * 0.9;
    float sk = strata * (0.30 + 0.70 * steep);
    d += beds * 0.9 * sk;
    c = mix(c, hueB * vec3(1.0, 0.93, 0.88), smoothstep(0.05, 0.40, beds) * sk * 0.7);
    c = mix(c, mix(c, vec3(1.0), 0.45), smoothstep(0.10, 0.45, -beds) * sk * 0.8);
  }
  c = pcDensity(c, d);

  // weather on the ground. Rain: the wash goes darker and richer. Snow: up-facing forms are
  // left as bare paper, ragged at the edge of the cover and thinner under trees; steep faces
  // stay dark, so the land is drawn by what the snow could not lie on.
  float upf = dot(nL, normalize(vBody));
  float snowC = pcSnowCover(upf, mix(ma.g, mb.g, lf) * 0.45 + n2.b * 0.30 + n1.a * 0.25, vPar.z);
  // (where the trees' shade lies the wet wash is laid thinner: wet shade on a wet lawn was a
  // row of dark hard-edged holes)
  float sunny = pcDapple(vBody, vPar.z * mix(0.82, 1.0, mid));
  c = pcWetWash(c, (1.0 - snowC) * mix(0.35, 1.0, sunny));
  c = mix(c, mix(vec3(1.0), vec3(0.90, 0.93, 1.0), smoothstep(0.42, 0.70, n1.g) * 0.55), snowC);

  // cracked ground (dried basins, frost polygons, ice shelves): pigment pools in the cracks.
  // The lines wander, swell, thin and break off: drawn by hand, not tiled.
  // (a negative amount: cooled lava, whose cracks open on the glow beneath: lines of fire, not of pigment)
  if (abs(vPar.w) > 0.01) {
    vec3 wp = vAnch + (n2.rgb - 0.5) * 2.2 + (ma.rgb - 0.5) * 0.5;
    float a1 = pcTri8(wp, nL, 1.0 / 16.0).a;
    float w1 = 0.035 + 0.075 * n1.b;
    // (R1 W2.1: the atlas' cell field changes by about 17 a tile, so 1.1 a metre at 1/16 and 0.27 at 1/64; its cells
    // are 16/11 and 64/11 m; a line covers about 1.8 times its mean width of the land, texgen.js genStrokes)
    float fine = pcLineF(w1 * 0.35, w1, a1, 1.1 * pcFp, 1.45, 1.8);
    fine *= pcStepF(0.36, 0.50, n2.b + (n1.g - 0.5) * 0.7, pcSub(6.3, PC_NB) + 0.49 * pcSub(31.0, PC_NRG));
    vec3 wp2 = vAnch + (n1.rgb - 0.5) * 11.0 + (n2.rgb - 0.5) * 2.0;
    float a2 = pcTri8(wp2, nL, 1.0 / 64.0).a;
    float big = pcLineF(0.012, 0.045 + 0.05 * n2.r, a2, 0.27 * pcFp, 5.8, 1.8);
    big *= pcStepF(0.30, 0.46, n1.g + (n2.b - 0.5) * 0.5, pcSub(31.0, PC_NRG) + 0.25 * pcSub(6.3, PC_NB));
    float crack = max(fine * near * 0.75, big * mix(0.55, 1.0, near) * mid);
    if (vPar.w > 0.0) c = pcDensity(c, 1.0 + crack * vPar.w * 2.2 * (1.0 - snowC * 0.8));
    else c = mix(c, mix(vec3(0.98, 0.52, 0.20), vec3(1.0, 0.86, 0.50), fine * near), clamp(crack * -vPar.w * 1.5, 0.0, 0.92));
  }

  // light in soft value steps; shadows are glazes
  vec3 sunV = normalize((viewMatrix * vec4(uSunDirW, 0.0)).xyz);
  float x = dot(nV, sunV) * 0.5 + 0.5;
  if (near > 0.0) sunny = min(sunny, 1.0 - pcCast(vBody, (ma.g - 0.5) * 0.34 + (n2.b - 0.5) * 0.16));
  float xn = (n1.g - 0.5) * 0.10 + (mix(fa.b, fb.b, lf) - 0.5) * 0.06 * near;
  float xS = min(x, 0.44) - (1.0 - smoothstep(0.30, 0.50, n1.g)) * 0.22 * vPar.z + xn, xL = x + xn;
  // (R1 W2.1: the light's steps no sharper than the pixel; and where the leaf shadow is finer than the pixel, the shade
  // and the sunlit wash are each laid in their own share of it: the light read at the mixed value was one middle step,
  // not the floor's mean colour)
  float fwL = fwidth(xL);
  float lvl = pcLevelF(mix(xS, xL, sunny), 0.045, fwL);
  vec3 cT = pcTone(c, lvl);
  float fk = smoothstep(0.0002, 0.0016, pcDappleSub());
  if (fk > 0.001) {
    float lvL = pcLevelF(xL, 0.045, fwL);
    cT = mix(cT, mix(pcTone(c, pcLevelF(xS, 0.045, fwL)), pcTone(c, lvL), sunny), fk);
    lvl = mix(lvl, lvL, fk);
  }
  c = cT;
  c = mix(c, c * vec3(0.84, 0.83, 1.04), (1.0 - sunny) * 0.55);
  // (PAINTER 14: a sun fleck on the floor of a wood is the picture's light: where the sun gets through the canopy the
  // wash is laid thin, nearly bare paper warmed by the light. The reference forest had no paper anywhere: its flecks
  // were the meadow's sunlit green, a middle value against the wood's shade. Open ground and the thinner stands of other
  // worlds (a canopy under 0.55: fungus, kelp, groves) are not touched.)
  // (a patch of sun is laid thinner, and its heart (the same pattern read at a higher threshold) thinnest, so a fleck
  // goes from a pale sunlit green at its edge to nearly paper in its middle; the floor keeps its shade)
  // (R1 W2.1: the heart lies inside the patch, so 0.55 of the patch plus 0.45 of its heart: the same where both are
  // drawn, and the right share where they are finer than the pixel)
  float fleck = (0.55 * sunny + 0.45 * min(pcDappleL(vBody, vPar.z * 1.08, 8.0), sunny)) * smoothstep(0.55, 0.90, vPar.z) * smoothstep(2.3, 2.85, lvl) * uDayness * (1.0 - uWx.x) * (1.0 - snowC);
  c = mix(c, mix(c, vec3(1.0), 0.55) * uLight, fleck * 0.8);

  // dry brush on rough ground: the brush skips, paper sparkles through in small broken flecks
  float dryM = mix(pcStepF(0.60, 0.69, fa.b * 0.62 + fa.r * 0.38, 0.3844 * pcSub(0.61 * ms, PC_NB) + 0.1444 * pcSub(0.61 * ms, PC_NRG)),
                   pcStepF(0.60, 0.69, fb.b * 0.62 + fb.r * 0.38, 0.3844 * pcSub(1.22 * ms, PC_NB) + 0.1444 * pcSub(1.22 * ms, PC_NRG)), lf);
  c = mix(c, vec3(1.0), dryM * vPar.x * markFade * (0.24 + 0.16 * lvl));
  // standing water after rain: small pale shapes of sky lying in the flats near the eye
  // (a puddle is a pale, soft-edged piece of sky: it runs into the wet ground round it, with
  // no rim, and is palest in its middle)
  float pud = uWx.y * (1.0 - snowC) * smoothstep(0.985, 0.999, upf) * near * (1.0 - vPar.z * 0.6);
  if (pud > 0.01) {
    float pn = texture(uNoise3D, vBody / 3.1 + 0.43).r * 0.7 + n2.a * 0.3;
    pud *= smoothstep(0.63, 0.79, pn) * smoothstep(0.47, 0.65, n1.a);
    c = mix(c, mix(uHaze, vec3(1.0), 0.35), pud * 0.70);
  } else pud = 0.0;

  // Wet rock under a storm: a steep face takes a deeper wash (the pale cliffs of a storm coast stood
  // against the storm's sky as paper cut-outs with ruled edges).
  // (PAINTER 12: a wash already dark takes little more: Neptune's Payne's grey basalt under a gale went to a near-black
  // slab; nothing is black, the darks stay indigo)
  c = pcDensity(c, 1.0 + (0.80 * uStorm + 0.35 * uWx.y) * (1.0 - smoothstep(0.50, 0.92, upf)) * (1.0 - snowC) * smoothstep(0.10, 0.42, dot(c, vec3(0.3, 0.5, 0.2))));
  // A track: where a walker (or a hull's wash) has laid the growth flat the ground's wash is a tone
  // duller and deeper, as trodden grass is. PHYSICS lays the stems; the strokes standing over the
  // sward are too few to show the lane by themselves.
  if (uPhysOn > 0.5 && dist < 70.0) {
    vec2 tuv = (pcPhysGrid(vBody) - uPhysNearMap.xy) * uPhysNearMap.z + 0.5;
    if (tuv.x > 0.0 && tuv.y > 0.0 && tuv.x < 1.0 && tuv.y < 1.0) {
      float trod = clamp(pcPhysTex(uPhysPush, tuv, uPhysNearMap.w).z, 0.0, 1.0) * (1.0 - smoothstep(40.0, 70.0, dist)) * (1.0 - snowC);
      c = pcDensity(c, 1.0 + 0.42 * trod) * mix(vec3(1.0), vec3(0.95, 0.97, 0.90), trod);
    }
  }
  float f = pcFogAmount(dist * pcFogBank(vBody));      // (PAINTER 19: a thick fog lies in banks, chunks.js)
  c = pcAtmosV(c, f, vView);
  // A world's one great marking, as a painter lays it on the globe from orbit (PAINTER 17, the M4 critique's third item:
  // Pluto had no heart): one pale cream wash in the shape of a heart where the heart glacier lies, its left lobe barer
  // paper, a thin tholin-orange line pooled along its edge. It is laid only from orbit (with the relief drawn in);
  // on the ground and in low flight the land's own washes are all there is.
  if (uHeart.w > 0.0 && uRound.x > 0.004) {
    vec3 nb = normalize(vBody), hc = normalize(uHeart.xyz);
    vec3 he = normalize(cross(vec3(0.0, 1.0, 0.0), hc)), hn = cross(hc, he);
    vec2 hp = vec2(dot(nb, he), dot(nb, hn)) / uHeart.w;
    hp += (texture(uNoise3D, nb * 1.7 + 0.3).rg - 0.5) * 0.22;                     // the hand's wobble
    float hx = hp.x * 1.25, hy = hp.y * 1.25 + 0.30;
    float hq = hx * hx + hy * hy - 1.0;
    float hf = hq * hq * hq - hx * hx * hy * hy * hy;
    float hm = (1.0 - smoothstep(-0.02, 0.05, hf)) * step(0.0, dot(nb, hc)) * (uRound.x / 0.75);
    float hedge = (1.0 - smoothstep(0.0, 0.16, abs(hf + 0.02))) * step(0.0, dot(nb, hc)) * (uRound.x / 0.75);
    vec3 heartC = mix(vec3(0.985, 0.955, 0.925), vec3(0.96, 0.88, 0.87), smoothstep(-0.1, 0.5, hx));
    c = mix(c, pcDensity(heartC, 0.7 + (n1.r - 0.5) * 0.9), hm * 0.86);
    c = mix(c, c * vec3(0.93, 0.74, 0.62), hedge * 0.55 * (0.5 + n1.g));
  }
  // from space the limb of the planet thins into its haze, toward bare paper
  vec3 upV = normalize(vUpV);
  float limb = pow(1.0 - clamp(dot(upV, normalize(-vView)), 0.0, 1.0), 2.5) * uFog.w;
  c = mix(c, mix(uHaze, vec3(1.0), 0.4), limb);
  float wet = max(max(vPar.y, f * 0.9), limb);
  // wet ground and falling rain or snow: edges soften, far layers run into each other
  wet = max(wet, max(uWx.y * 0.45 * (1.0 - snowC), uWx.w * smoothstep(10.0, 90.0, dist) * 0.9));
  wet = max(wet, smoothstep(0.0, 0.25, pud));      // a puddle's edge is wet in wet
  pcWrite(c, wet, nV, -vView.z, 1.0);
}
#endif
`;

export function makeTerrainMaterial(bodyU) {
  const m = new THREE.ShaderMaterial({
    name: 'pc-terrain',
    uniforms: baseUniforms(bodyU, {
      uOrigin: { value: new THREE.Vector3() }, uAnchor: { value: new THREE.Vector3() },
      uCamLocal: { value: new THREE.Vector3() }, uMorph: { value: new THREE.Vector3(1e8, 2e8, 0) },
      ...PHYS,
    }),
    vertexShader: TERRAIN_VERT, fragmentShader: TERRAIN_FRAG,
  });
  m.userData.pcPainted = true;
  return register(m, 'terrain');
}

// ------------------------------------------------------------------------------------------
// Water
// ------------------------------------------------------------------------------------------
const WATER_VERT = /* glsl */`
${VERT_PARS}
attribute float aDepth;
attribute vec4 aLiq;      // liquid wash colour, and how much it mirrors
attribute vec4 aLiqP;     // x glow (lava), y cloud (a sea of cloud)
uniform vec3 uOrigin;
uniform vec3 uCamLocal;
uniform float uWaveLod;
varying vec3 vBody;
varying vec3 vToCam;
varying vec3 vView;
varying float vDepth;
varying vec4 vLiq;
varying vec2 vLiqP;
varying vec3 vWake;
// PHYSICS' sea: the surface rises and falls with its wave trains and wakes (C14)
#define PC_PHYS_NO_WAKE
${WATER_GLSL}
void main() {
  vec3 p = position;
  vBody = p + uOrigin;
  vec2 along;
  vec3 w = pcPhysWaterD(vBody, along);
  vWake = pcPhysWake(pcPhysGrid(vBody));
  // The mesh carries each wave only where it is fine enough for it (the rest is painted): the short
  // trains near the eye, the long one (the swell, PHYSICS' fourth train) five times as far. (The reach
  // of all of them used to be measured by the first, short train: Neptune's 2.8 m sea lay flat from 64 m out.)
  vec3 wl = pcPhysWaterLong(vBody);
  float dcam = distance(p, uCamLocal);
  float lam = 6.2831853 / max(uPhysWaterK.x, 1e-3), lamL = 6.2831853 / max(uPhysWaterK.w, 1e-3);
  float carry = 1.0 - smoothstep(2.2 * lam * uWaveLod, 6.0 * lam * uWaveLod, dcam);
  float carryL = 1.0 - smoothstep(2.2 * lamL * uWaveLod, 6.0 * lamL * uWaveLod, dcam);
  // In the shallows a wave is as high as the depth lets it be (PHYSICS: 0.78 of it), and at the edge
  // the water itself runs up the beach with each wave and drains back (pcPhysWaterRunup).
  // (PHYSICS P18: the sea that is here, from the sea map; uPhysWaterSea where there is no map)
  vec4 sea = pcPhysSeaLocal(vBody);
  float shoal = clamp(aDepth / max(1.28 * sea.x, 0.05), 0.0, 1.0);
  float runup = pcPhysWaterRunup(vBody, 0.07);
  p += normalize(vBody) * mix(runup, (w.x - wl.x + vWake.x) * carry + wl.x * carryL, shoal);
  // (in the last few centimetres of the shallows the bed's small bumps rose through the water's surface where the two
  // meshes interpolate differently: a halftone of dots along every flat shore, ARTPASS wish 9. The sheet of water is
  // laid a breath higher there, so the bed shows only through its own wash; the edge is still drawn by the discard)
  p += normalize(vBody) * 0.06 * (1.0 - smoothstep(0.05, 0.40, aDepth));
  vBody = p + uOrigin;
  vToCam = uCamLocal - p;
  vDepth = aDepth;
  vLiq = aLiq; vLiqP = aLiqP.xy;
  vec4 mv = modelViewMatrix * vec4(p + pcRound(vBody), 1.0);
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
  ${VERT_END}
}
`;

const WATER_FRAG = /* glsl */`
${FRAG_PARS}
#ifdef PC_OIL
uniform float uBodyR;
#endif
uniform vec3 uSkyZenith;
uniform vec3 uSkyHorizon;
uniform vec3 uReflDark;
uniform vec3 uBed;
uniform float uTreeLine;
uniform highp sampler2D uPrevTex;
uniform float uPrevOn;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
varying vec3 vBody;
varying vec3 vToCam;
varying vec3 vView;
varying float vDepth;
varying vec4 vLiq;
varying vec2 vLiqP;
varying vec3 vWake;
#define PC_PHYS_NO_WAKE
${WATER_GLSL}

// Mirror the painting itself: march the reflected ray through last frame's depth.
// Returns uv and a confidence.
vec3 pcReflect(vec3 P, vec3 R) {
  float t = 0.7;
  vec2 uv = vec2(0.5);
  float conf = 0.0;
  for (int i = 0; i < 12; i++) {
    vec3 p = P + R * t;
    vec4 cp = projectionMatrix * vec4(p, 1.0);
    if (cp.w <= 0.0) break;
    vec2 q = cp.xy / cp.w * 0.5 + 0.5;
    if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) break;
    uv = q;
    float sd = exp2(texture(uPrevTex, q).a * (uAux8 > 0.5 ? 32.0 : 1.0)) - 1.0;
    float rd = -p.z;
    conf = 0.55;
    if (sd < rd && rd - sd < max(2.5, t * 0.9)) { conf = 1.0; break; }
    if (sd > 4.0e5) conf = 1.0;      // open sky behind this point
    t *= 1.7;
  }
  vec2 e = min(uv, 1.0 - uv);
  return vec3(uv, conf * smoothstep(0.0, 0.08, min(e.x, e.y)));
}

void main() {
  #include <logdepthbuf_fragment>
  // (the still depth plus the swash of the moment: under zero the bed is bare just now)
  // (and the swash reaches 0.4 m above the still waterline at most, to a ragged line: the
  // mesh ends in straight cell edges a little higher, and a sheet of foam ended there as a white slab)
  float vDep = vDepth + pcPhysWaterRunup(vBody, 0.07);
  if (vDep < 0.0 || vDepth < -0.38 + (texture(uNoise3D, vBody / 2.1).g - 0.5) * 0.14) discard;
  vec3 up = normalize(vBody);
  vec3 Vd = normalize(vToCam);
  float dist = length(vView);
  vec3 drift = vec3(uTime * 0.012, uTime * 0.007, -uTime * 0.009);
  vec4 r1 = texture(uNoise3D, vBody / 4.6 + drift);
  vec4 r2 = texture(uNoise3D, vBody / 1.35 - drift * 1.7);
  vec4 r3 = texture(uNoise3D, vBody / 17.0);
  // PHYSICS' sea at this point: height, slope, crests, foam. What the brush cannot hold at
  // this distance is dropped (waves smaller than a pixel would shimmer): far water goes flat
  // and is given its whitecaps as a few anchored dabs instead.
  vec2 along;
  vec3 wv = pcPhysWaterD(vBody, along) + vWake;
  // (PHYSICS P18: the sea that is here and the way its waves run, from the sea map: lower and fewer breaking in a bay
  // behind a spit, the crests coming round toward a beach; the reference sea where there is no map)
  vec4 sea = pcPhysSeaLocal(vBody);
  vec2 sdir = pcPhysSeaDir(vBody);
  float hs = max(sea.x, 1e-4);
  float keep = 1.0 - smoothstep(0.22, 0.75, fwidth(wv.x) / hs);
  wv *= keep;
  float wavy = smoothstep(0.04, 0.35, sea.x) * keep;      // 0 on a pond, 1 on a sea that is running
  float hN = clamp(wv.x / hs, -1.5, 1.5) * wavy;                    // -1 in the troughs .. 1 on the crests
  vec2 cf = pcPhysWaterCrestAt(wv, sea);
  vec3 n = normalize(pcPhysWaterNormal(wv, up) + (r1.xyz - 0.5) * 0.13 + (r2.xyz - 0.5) * 0.06);
  vec3 r = reflect(-Vd, n);
  float re = dot(r, up);

  // what the water mirrors when the painting cannot tell us: sky above a ragged tree line
  float line = uTreeLine + (r3.r - 0.5) * 0.30;
  float skyAmt = smoothstep(line - 0.05, line + 0.05, re + (r1.g - 0.5) * 0.18);
  vec3 skyc = mix(uSkyHorizon, uSkyZenith, clamp(re * 1.2, 0.0, 1.0));
  skyc = mix(skyc, vec3(1.0), 0.30);
  vec3 dark = pcDensity(uReflDark, 1.0 + (r3.g - 0.5) * 0.9);
  vec3 c = mix(dark, skyc, skyAmt);

  // the painting, mirrored: soft vertical reflections broken by the ripples
  vec3 nV = normalize(normalMatrix * n);
  vec3 Rv = reflect(normalize(vView), nV);
  vec3 hit = pcReflect(vView, Rv);
  vec3 refl = texture(uPrevTex, hit.xy).rgb;
  // (a sea that is running is no mirror: it keeps its own wash and only takes a breath of the sky)
  float rough = smoothstep(0.08, 0.9, sea.x) * (1.0 - vLiqP.y) * (1.0 - vLiqP.x);
  c = mix(c, refl, hit.z * uPrevOn * (1.0 - 0.85 * rough));
  // the liquid's own wash: water takes a little of it and deepens the mirror; matte liquids
  // (lava, acid, a sea of cloud) are mostly their own colour
  float mirror = vLiq.a;
  vec3 own = pcDensity(vLiq.rgb, 1.0 + (r3.g - 0.5) * 1.3 + (r1.r - 0.5) * 0.6 - hN * 0.55);   // pigment gathers in the troughs
  // lava: paper-bright where it runs hot, dark crust drifting on it
  vec4 r4 = texture(uNoise3D, vBody / 9.0 + drift * 0.4);
  // (scarlet by the banks where it cools, cadmium orange in the stream, paper-yellow only where it
  // runs deep and hot; the plates of crust gather by the banks: a crust forms on lava, not on a glowing pool)
  float hotD = smoothstep(0.30, 1.20, vDep + (r2.g - 0.5) * 0.5);
  own = mix(own, vec3(0.88, 0.25, 0.13), vLiqP.x * (1.0 - hotD) * 0.7);
  own = mix(own, vec3(1.0, 0.94, 0.64), vLiqP.x * hotD * smoothstep(0.40, 0.70, r4.r) * 0.92);
  // (PAINTER 13: the crust is plates, not spots: each blotch is cut by thin lines of fire where it has cracked, and its
  // own wash is not one flat dark but laid heavier and lighter as it cooled; at its edge it goes scarlet before the
  // orange. Dark round blotches on a flat orange read as a leopard's print)
  float crustA = smoothstep(0.75, 1.0, vLiqP.x) * smoothstep(0.58 - 0.20 * (1.0 - hotD), 0.70 - 0.18 * (1.0 - hotD), r4.g + (r2.b - 0.5) * 0.3);
  vec4 r7 = texture(uNoise3D, vBody / 3.4 + drift * 0.4 + 0.37);
  float fire = 1.0 - smoothstep(0.0, 0.030 + 0.030 * r1.r, abs(r4.b - 0.5) * 0.7 + abs(r7.r - 0.5) * 0.3);
  crustA *= 1.0 - 0.85 * fire * smoothstep(0.2, 0.6, crustA);
  // (the crust gathers in rafts and along the banks, and the deep stream runs open between them: spots of one size laid
  // evenly over the whole river were the leopard)
  vec4 r8 = texture(uNoise3D, vBody / 38.0 + drift * 0.15 + 0.53);
  crustA *= mix(smoothstep(0.44, 0.64, r8.r), 1.0, (1.0 - hotD) * 0.75);
  vec3 crustC = mix(vec3(0.20, 0.15, 0.19), vec3(0.40, 0.29, 0.29), smoothstep(0.30, 0.72, r7.g * 0.7 + r2.r * 0.3));
  own = mix(own, vec3(0.80, 0.20, 0.12), smoothstep(0.75, 1.0, vLiqP.x) * crustA * (1.0 - crustA) * 2.4);
  own = mix(own, crustC, crustA);
  // cloud sea: bare-paper billows with soft shaded hollows
  vec4 r5 = texture(uNoise3D, vBody / 47.0 + drift * 0.2);
  own = mix(own, vec3(1.0), vLiqP.y * smoothstep(0.42, 0.66, r5.r * 0.7 + r3.b * 0.3));
  own = mix(own, own * uGlaze, vLiqP.y * (1.0 - smoothstep(0.30, 0.52, r5.g)) * 0.6);
  own = mix(own, own * uGlaze, vLiqP.y * (1.0 - smoothstep(-0.9, 0.1, hN)) * 0.5);      // the hollows of a rolling cloud sea
  // rain stipples the surface: it mirrors less and takes the sky's value
  mirror *= (1.0 - 0.45 * uWx.w) * (1.0 - 0.6 * rough);
  c = mix(own, pcDensity(c * mix(vec3(1.0), vLiq.rgb, 0.35), 1.12 + (r3.g - 0.5) * 0.35 - hN * 0.40), mirror);

  // under a closed sky the water takes the storm: its wash is laid heavier and glazed with
  // the sky's own indigo (a sea under a thunderhead is darker than the land, never a clear blue)
  float stormy = uWx.x * (1.0 - vLiqP.y) * (1.0 - vLiqP.x);
  c = pcDensity(mix(c, c * uGlaze, stormy * 0.55), 1.0 + stormy * (0.50 + (r3.b - 0.5) * 0.5));

  // horizontal strokes of reflected sky where the surface is ruffled
  float ruf = smoothstep(0.585, 0.66, r1.b * 0.55 + r2.g * 0.45);
  c = mix(c, skyc, ruf * 0.55 * mirror);
  // a sea that is running is laid in broken strokes of unequal weight: dark in the hollows
  // between the sets, thin where the backs of the waves take the sky (the strokes are
  // anchored to the planet; seen across the water they lie flat, as strokes on a sea do)
  float band = (texture(uNoise3D, vBody / 7.3 + 0.21).g - 0.5) * 1.5 + (r3.b - 0.5) * 0.9;
  c = pcDensity(c, 1.0 + rough * (band * 0.9 - hN * 0.25));

  // the bed shows through where the water is shallow or seen from above
  float fres = pow(1.0 - max(dot(Vd, up), 0.0), 2.5);
  float shallow = 1.0 - smoothstep(0.02, 0.42, vDep);
  vec3 bed = pcDensity(uBed, 1.0 + (r3.b - 0.5) * 0.8);
  c = mix(c, bed * mix(vec3(1.0), c, 0.45), clamp((1.0 - fres) * 0.42 + shallow * 0.7, 0.0, 0.9) * (1.0 - vLiqP.y) * (1.0 - vLiqP.x * 0.8));
  // pigment pools at the water's edge
  c = pcDensity(c, 1.0 + (1.0 - smoothstep(0.0, 0.09, vDep)) * 0.35);
  // bare-paper glints: broken dashes where ripples catch the light
  float glint = smoothstep(0.715, 0.76, r2.r * 0.62 + r1.b * 0.38) * smoothstep(0.04, 0.2, vDep) * max(uDayness, uMoon);
  glint *= (1.0 - smoothstep(40.0, 120.0, dist)) * (1.0 - vLiqP.y) * (1.0 - 0.7 * wavy);
  // (glints are the sun's: under a closed sky there are none; in a gale they were a glitter of white pixels)
  glint *= 1.0 - 0.9 * uWx.x;
  // the sea running: bare paper along the tops of the higher waves, in broken dashes that lie
  // the way the crests lie; whitecaps where it breaks, ragged; surf where it shoals at a shore
  float liq = (1.0 - vLiqP.y) * (1.0 - vLiqP.x);
  float deep = smoothstep(0.04, 0.3, vDep);
  vec4 r6 = texture(uNoise3D, vBody / 0.62 + drift * 3.0);
  float torn = r6.r * 0.55 + r2.g * 0.45;
  // (beyond the first twenty metres the torn foam is sized to the distance, in octaves that give way to one
  // another, and drawn out three to one along the crest: a 0.6 m pattern seen at 60 m was a white pixel, and the
  // gale's white horses were a glitter of specks; now each is a short torn dash lying along its wave)
  float tornW = 0.5;
  {
    vec3 Dw = normalize(pcPhysWaterDir(sdir)), Aw = normalize(cross(up, Dw));
    float lw = log2(max(dist, 20.0) / 20.0), kw = floor(lw), fw = lw - kw;
    // (and it is torn anew as it goes: a white horse forms and is gone in two or three seconds)
    vec3 qw = vec3(dot(vBody, Aw) / 1.9, dot(vBody, Dw) / 0.62, dot(vBody, up) / 0.62 + uTime * 0.3) + drift * 3.0;
    float t0 = texture(uNoise3D, qw / exp2(kw) + 0.13).r, t1 = texture(uNoise3D, qw / exp2(kw + 1.0) + 0.57).r;
    float tw = mix(t0, t1, fw);
    tw = 0.5 + (tw - 0.5) * (1.0 + 0.45 * fw * (1.0 - fw) * 4.0);      // (the blend of two octaves is flatter: restored)
    torn = mix(torn, tw * 0.75 + r2.g * 0.25, smoothstep(14.0, 28.0, dist));
    tornW = tw;
  }
  // (the crest line itself: high water where the slope along the waves' way turns over)
  float sAlong = abs(dot(wv.yz, sdir));
  float crest = smoothstep(0.25, 0.70, hN) * (1.0 - smoothstep(0.07, 0.24, sAlong)) * smoothstep(0.36, 0.50, torn) * (0.35 + 0.65 * uDayness);
  // (a whitecap is not a white sheet: torn dabs of paper on the front of the crest, with the
  // sea's own wash showing between them)
  float foam = cf.y * smoothstep(0.40, 0.90, hN) * smoothstep(0.44, 0.58, torn) * keep;
  // far off: the same share of white, as a few anchored dabs
  float capFar = sea.y < 1.0e8 ? smoothstep(0.02, 0.12, sea.w) : 0.0;
  float capTh = 0.70 - 0.55 * sea.w;
  foam = max(foam, capFar * (1.0 - keep) * smoothstep(capTh, capTh + 0.05, r3.r * 0.6 + r1.g * 0.4) * (1.0 - smoothstep(500.0, 1500.0, dist)));
  // (a sea running high breaks all over: white horses beyond the first ten metres whether or not the waves under
  // them are drawn, each a torn dash lying along its wave, sized to the distance, grouped by the sets, more on the
  // crests, forming and going. Between 30 and 150 m nothing broke at all: the near crests are dropped there as finer
  // than the brush, and the far strokes have not begun)
  // (PAINTER 12: and wherever the sea map says this water is breaking, by its own share of white, however low the
  // waves: a fresh breeze on Earth's coast whitens a twentieth of the sea with Hs half a metre, and none showed)
  float galeW = max(smoothstep(0.5, 2.0, sea.x) * (sea.y < 1.0e8 ? 1.0 : 0.6), sea.y < 1.0e8 ? 0.85 * smoothstep(0.012, 0.07, sea.w) : 0.0);
  float horseTh = 0.68 - 0.11 * galeW;      // (PAINTER 17: 0.08; Earth's coast in its 13 m/s storm, a twentieth of it white by PHYSICS, showed no white horse at 640 x 360)
  foam = max(foam, galeW * smoothstep(horseTh, horseTh + 0.06, tornW * 0.62 + r3.r * 0.38) * (0.55 + 0.45 * smoothstep(-0.3, 0.5, hN)) * smoothstep(10.0, 30.0, dist) * (1.0 - smoothstep(600.0, 1500.0, dist)));
  // (in the shallows the breaking crests are white, ragged lines; at the waterline a thin
  // broken edge of swash that can still be seen from far off)
  float sz = pcPhysWaterSurfAt(vDep, sea);
  // (beyond twenty metres the surf is torn by the pattern sized to the distance: a 0.6 m pattern there was a
  // glitter of white pixels over the shoaling bay)
  float surf = sz * sz * smoothstep(0.50, 0.85, hN + mix((r2.b - 0.5) * 0.7 + (r6.g - 0.5) * 0.5, (tornW - 0.5) * 1.3, smoothstep(14.0, 28.0, dist)));
  // (the swash runs up the shore with each wave and draws back: the depth here is the still depth plus
  // PHYSICS' run-up; and its lace is carried in with the waves, torn anew as it goes. A rim drawn from the
  // still depth and a still pattern was frozen from frame to frame)
  vec3 D3 = normalize(pcPhysWaterDir(sdir));
  vec4 rsw = texture(uNoise3D, (vBody - D3 * (uTime * 0.55)) / 1.35);
  // (PAINTER 17: a sea of half a metre and more runs further up the beach and its lace is closer: the storm's waterline
  // was a hair of white at 640 x 360, lost to the brush)
  float swK = smoothstep(0.30, 0.60, hs);
  float swash = (1.0 - smoothstep(0.03, 0.05 + (0.22 + 0.30 * swK) * hs, vDep)) * smoothstep(0.04, 0.3, sea.x);
  // (lace, not a sheet: where the run-up is a film over the sand the foam is torn wide open)
  float film = 1.0 - smoothstep(-0.25, 0.02, vDepth);
  surf = max(surf, swash * smoothstep(0.40 + 0.05 * film - 0.07 * swK, 0.60 + 0.05 * film - 0.07 * swK, rsw.g * 0.6 + r1.b * 0.4 + 0.25 * hN));
  // (PHYSICS' critique of PAINTER, item 4: no surf at the beach in a storm. The surf above is drawn on the crests of waves
  // the mesh carries; where they are finer than the brush, a few metres out already at 640 x 360, nothing broke at all.
  // There the surf zone PHYSICS gives is laid as torn foam carried in with the waves: ragged lines along the shore,
  // the sea's wash between them, never a white band)
  surf = max(surf, sz * (1.0 - keep) * smoothstep(0.50, 0.66, tornW * 0.45 + rsw.g * 0.40 + r1.b * 0.15) * smoothstep(0.10, 0.45, sea.x));
  // far off, where the waves are finer than the brush can hold: the swell as a painter lays it,
  // long broken strokes lying the way the crests lie (anchored to the planet), the hollow before
  // each one darker, and on a sea that is breaking a white horse here and there along them
  float farWhite = 0.0;
  // (seen across the water a swell 20 m long is a hair's breadth on the sheet: the strokes are
  // spaced by what the brush can hold there, a dozen pixels, in octaves that give way to one
  // another with distance, each one fixed to the planet)
  vec3 A3 = normalize(cross(up, D3));
  // (a sea running high: deeper hollows, paler backs and more white horses, so a gale reads from the shore)
  float gale = smoothstep(0.6, 2.6, sea.x);
  float qd = dot(vBody, D3);
  float lk = max(0.0, log2(max(13.0 * fwidth(qd), 1.0e-3) / 8.5) / 1.3785);
  // (far: where a pixel is wider than the brush can draw a wave in, a metre or two of sea)
  float farSea = smoothstep(0.35, 1.6, fwidth(qd) + fwidth(dot(vBody, A3))) * smoothstep(0.03, 0.22, sea.x) * liq * deep;
  if (farSea > 0.01) {
    float k0 = floor(lk), kf = lk - k0, capTh2 = 0.68 - 0.45 * sea.w - 0.13 * gale;
    float sw = 0.0, wh = 0.0, hol = 0.0;
    for (int i = 0; i < 2; i++) {
      float L = 8.5 * pow(2.6, k0 + float(i)), wgt = i == 0 ? 1.0 - kf : kf;
      float q = qd / L + (texture(uNoise3D, vBody / (L * 6.0) + 0.3).r - 0.5) * 1.6;
      float id = floor(q), s = fract(q);
      float br = texture(uNoise3D, vec3(dot(vBody, A3) / (L * 4.0), id * 0.371, id * 0.117)).r;
      float ln = smoothstep(0.70, 0.82, s) * (1.0 - smoothstep(0.92, 1.0, s));
      sw += wgt * ln * smoothstep(0.40, 0.54, br);
      // (a white horse is a dash at least two pixels deep: seen across the water the band was a tenth of a pixel tall,
      // and a long dash along its wave came out as a row of single white specks, a glitter)
      // (PAINTER 13: three pixels deep at least, and broken along the crest into dashes a few metres long: seen from a
      // beach, the eye 2 or 3 m up, a dash two pixels deep was taken by the brush (it keeps nothing under three pixels)
      // and Neptune's gale, 15 % of it white, showed hardly a white horse)
      float c0 = 0.78 - 0.05 * gale, bw = clamp(3.4 * fwidth(q), 0.07, 0.36);
      float brk = texture(uNoise3D, vec3(dot(vBody, A3) / (L * 0.9), id * 0.53 + 0.2, id * 0.29 + 0.71)).g;
      wh += wgt * smoothstep(c0 - bw * 0.5, c0, s) * (1.0 - smoothstep(c0 + bw * 0.4, c0 + bw * 0.9, s)) * smoothstep(capTh2, capTh2 + 0.05, br) * smoothstep(0.40, 0.52, brk);
      hol += wgt * smoothstep(0.28, 0.52, s) * (1.0 - smoothstep(0.66, 0.76, s)) * smoothstep(0.35, 0.60, br);
    }
    c = pcDensity(c, 1.0 + farSea * (hol * (0.75 + 0.60 * gale) - sw * 0.25));
    c = mix(c, skyc, farSea * sw * (0.50 + 0.22 * gale));
    // (the share of white sets how many dashes break (capTh2); each one that breaks is white: a fresh breeze's 5 % of
    // white drew its few dashes at a quarter strength, and none read)
    farWhite = farSea * wh * smoothstep(0.008, 0.05, sea.w) * (0.35 + 0.65 * uDayness) * (1.0 - smoothstep(900.0, 2200.0, dist));
  }
  float white = max(max(max(crest * 0.85, foam) * deep, surf * smoothstep(0.0, 0.03, vDep)) * liq, farWhite);
  // (PHYSICS P26: the cap on white water is lifted and the sea's white share, sea.w, runs to 1; the coordinator's ruling:
  // paint whatever share comes as broken foam, streaks and spray, never a flat white area. To 0.15 the caps above are the
  // picture, as they were. Beyond it the crests' foam is blown into streaks along the wind, drawn out twelve to one and
  // sized to the distance, the sea's own wash dark between them; from about a half the streaks close up and the whole
  // sea rises toward the paper: driven foam with the waves' own values still in it, the troughs greyer, the fronts of
  // the crests bare paper, torn everywhere. Neptune's squall, 100 % white by PHYSICS, was the same dark indigo band.)
  float wOver = sea.y < 1.0e8 ? smoothstep(0.15, 0.60, sea.w) * liq * deep : 0.0;
  if (wOver > 0.001) {
    float lsS = log2(max(dist, 12.0) / 12.0), ksS = floor(lsS), fsS = lsS - ksS;
    vec3 qS = vec3(dot(vBody, A3) / 0.9, dot(vBody, D3) / 11.0 - uTime * 0.05, dot(vBody, up) / 0.9) + drift * 2.0;
    float s0 = texture(uNoise3D, qS / exp2(ksS) + 0.31).g, s1 = texture(uNoise3D, qS / exp2(ksS + 1.0) + 0.77).g;
    float sk = mix(s0, s1, fsS);
    sk = 0.5 + (sk - 0.5) * (1.0 + 0.45 * fsS * (1.0 - fsS) * 4.0);
    float closeUp = smoothstep(0.50, 1.0, sea.w);
    float sth = mix(0.60, 0.40, closeUp);
    float streak = smoothstep(sth, sth + 0.10, sk * 0.75 + tornW * 0.25) * (0.55 + 0.45 * smoothstep(0.36, 0.60, torn));
    float form = 0.42 + 0.58 * smoothstep(-0.5, 0.6, hN);
    white = max(white, wOver * max(streak * form, closeUp * 0.46 * form * (0.75 + 0.5 * (tornW - 0.5))));
  }
  glint = max(glint, white);
  c = mix(c, vec3(1.0), glint);
  // (a sea running high keeps its body under the murk: in a gale the air is thick enough to
  // swallow the far water whole, strokes and all, and a storm sea painted as a pale blank is
  // no sea; the painter keeps it darker than the sky to the horizon and lets the stacks go pale)
  // (and what glows is seen through the haze: lava keeps its fire into the distance)
  #ifdef PC_OIL
  {
    // water in strokes: short thin dashes lying along the water (the world's own chart, so they stay where they are),
    // a share of them a step lighter and carrying the sky's colour, a share a step deeper, nothing drawn between two.
    // (The overhaul plan's seventh piece: toward the sun or the moon a share of the dashes are the light itself, a path
    // of broken marks; under an aurora, by night, a share are its green, as the clip's lake carries its aurora. The
    // chart's derivatives come from a position measured from the eye: chunks.js pcGroundChartD.)
    vec2 wch = pcGroundChart(vBody, uBodyR);
    vec2 wdx = pcGroundChartD(vBody, -dFdx(vToCam), uBodyR), wdy = pcGroundChartD(vBody, -dFdy(vToCam), uBodyR);
    vec2 woc = pcStrokeOct(dist * 1.1, uOilPx.z * 1.1);
    vec3 wr1, wr2; vec2 wds; float wown;
    // (long thin dashes, and the deep ones well deeper: short and all pale, a stream was a strip of pale flat patches,
    // "low-poly ice": the critic)
    pcThinLayer(wch, wdx, wdy, woc.x, 11.0, vBody, 60.0, 4.0, wr1, wds, wown, wr2);
    vec3 cdeep = pcDensity(c, 2.1) * vec3(0.90, 0.92, 1.0), clight = mix(c, mix(skyc, vec3(1.0), 0.25), 0.45);
    float wsp = pow(max(dot(reflect(-normalize(vToCam), up), uSunDirL), 0.0), 22.0) * max(uDayness, uMoon) * (1.0 - uWx.x);
    vec3 wsun = min(mix(pcOilSunC(), vec3(1.0), 0.35) * 1.06, vec3(1.0));
    float wau = uAuroraK * (1.0 - uDayness);
    vec3 w1 = wr1.x > 0.62 ? clight : (wr1.x < 0.30 ? cdeep : c), w2 = wr2.x > 0.62 ? clight : (wr2.x < 0.30 ? cdeep : c);
    w1 = wr1.z < 0.34 * wau ? mix(vec3(0.10, 0.74, 0.60), vec3(0.24, 0.96, 0.56), step(0.5, fract(wr1.z * 31.7))) : w1;
    w2 = wr2.z < 0.34 * wau ? mix(vec3(0.10, 0.74, 0.60), vec3(0.24, 0.96, 0.56), step(0.5, fract(wr2.z * 31.7))) : w2;
    w1 = wr1.y < wsp * 1.2 ? wsun : w1; w2 = wr2.y < wsp * 1.2 ? wsun : w2;
    c = mix(w2, w1, wown);
  }
  #endif
  float f = pcFogAmount(dist) * (1.0 - 0.45 * farSea) * (1.0 - 0.6 * vLiqP.x);
  c = pcAtmosV(c, f, vView);
  pcWrite(c, mix(mix(0.7, 0.22, white), 1.0, vLiqP.y), normalize(normalMatrix * up), -vView.z, 2.0);
}
`;

export function makeWaterMaterial(bodyU, skyU) {
  const m = new THREE.ShaderMaterial({
    name: 'pc-water',
    uniforms: baseUniforms(bodyU, {
      uOrigin: { value: new THREE.Vector3() }, uCamLocal: { value: new THREE.Vector3() },
      uSkyZenith: skyU.uSkyZenith, uSkyHorizon: skyU.uSkyHorizon,
      uReflDark: { value: new THREE.Vector3(0.40, 0.52, 0.42) },
      uBed: { value: new THREE.Vector3(0.80, 0.70, 0.52) },
      uTreeLine: { value: 0.30 },
      uPrevTex: G.uPrevTex, uPrevOn: G.uPrevOn,
      uPhysAnchor: PHYS.uPhysAnchor, uPhysEast: PHYS.uPhysEast, uPhysNorth: PHYS.uPhysNorth, uPhysUp: PHYS.uPhysUp,
      ...PHYSW,
    }),
    // (PHYSICS' sea map, P18/P19: the uniforms come with PHYSW; without the define the chunk is as before)
    defines: { PC_PHYS_SEA_MAP: 1 },
    vertexShader: WATER_VERT, fragmentShader: WATER_FRAG,
  });
  m.userData.pcPainted = true;
  // (R1 W2.4: water drawn in this frame wants last frame's painting kept for the next: post.js finish)
  m.onBeforeRender = () => { PREV.water = true; };
  return register(m, 'water');
}

// ------------------------------------------------------------------------------------------
// Props: trees, undergrowth, rocks. One shader, instanced, parts selected per vertex.
//   aData.y part: 0 bark, 1 foliage mass, 2 blade / frond, 3 accent dab, 4 rock
// ------------------------------------------------------------------------------------------
const PROP_VERT = /* glsl */`
${VERT_PARS}
${FOG_VERT}
attribute vec4 aData;     // x sway, y part, z inner shade, w blob hash
attribute float aBranchId; // (trees) PHYSICS' crown: one number per branch and its foliage, -1 the trunk
attribute float aLeaf01;   // (trees) 1 on foliage
attribute vec3 aMass;     // soft "mass" normal of the whole crown
attribute vec4 aInst;     // per instance: x hue, y value, z seed, w canopy shade at its foot
attribute float aBorn;    // per instance: when it came into this mesh (the wash clock, s); negative: when it left (it is being lifted out)
#ifdef PC_OIL
attribute vec3 aCard;     // (the oil look's leaves, florakit.js leafCards: the centre of the leaf this vertex belongs to; elsewhere the vertex's own place)
varying vec3 vCardB;      // that centre on the body: a leaf is lit, shaded and lamp-lit whole
#endif
#ifdef PC_FAR
  attribute vec2 aInst2;  // species index into the far tables
  varying float vSpecies;
  uniform float uFarTaper[8];
  uniform float uFarTrunk[8];
  uniform float uFarDrop[8];
#endif
#ifdef PC_HOLLOW
  uniform vec4 uHollow;   // a spire's form in its own units: x girth at the foot, y height, z lean of the top along +Z (of the height)
  varying float vHollow;  // 0 the eye is clear of this one .. 1 the eye is inside it
#endif
uniform vec3 uOrigin;
uniform vec3 uCamLocal;
uniform vec4 uLod;        // min distance, max distance, jitter, fade start fraction
uniform vec3 uWashIn;     // x the wash clock now (s), y when this mesh was first laid, z how long a wash takes (s)
uniform float uWind;
uniform float uTime;
varying vec3 vBody;
varying vec3 vObj;
varying vec3 vNV;
varying vec3 vMassV;
varying vec3 vView;
varying vec2 vUv;
varying vec4 vData;
varying vec4 vInst;
varying float vWash;      // 1: fully laid; below: the strokes are still arriving (negative: being lifted out)
varying float vAbove;     // metres above the plant's foot (the sun flecks on a trunk continue the ground's)
varying float vFog;
#ifdef PC_OIL
varying vec3 vMassO;      // the crown's mass normal in the plant's own space: which way a crown's chart is laid
varying float vScaleO;    // the plant's size (its instance's scale): its own space times this is metres
varying vec3 vRelO;       // the place measured from the eye, in the body's axes (its screen derivatives are exact)
#endif

// MOTION. With PHYSICS' field (uPhysOn) plants bend as loaded stems: wind, gusts, things
// pushing through them (C14). Without it, this gentle sway stands in.
#ifdef PC_PHYS
${FLORA_GLSL}
uniform float uPhysOn;
uniform float uStiff;
uniform float uPlantHeight;
#endif
vec3 pcSway(float w, float phase) {
  float a = sin(uTime * 1.1 + phase) * 0.6 + sin(uTime * 2.7 + phase * 1.9) * 0.3;
  float b = cos(uTime * 0.8 + phase * 1.3) * 0.6;
  return vec3(a, 0.0, b) * w * uWind;
}

void main() {
  #ifdef USE_INSTANCING
    mat4 im = instanceMatrix;
    vec4 inst = aInst;
    // nothing snaps into being: a thing new to this mesh washes in over half a second, and one that
    // has changed tier is lifted out of its old mesh while it is laid in the new (the two patterns interlock)
    float wsh = clamp((uWashIn.x - max(abs(aBorn), uWashIn.y)) / uWashIn.z, 0.0, 1.0);
    vWash = aBorn < 0.0 ? -(1.0 - clamp((uWashIn.x + aBorn) / uWashIn.z, 0.0, 1.0)) - 1e-3 : wsh;
  #else
    mat4 im = mat4(1.0);
    vec4 inst = vec4(0.0, 0.0, 0.5, 0.7);
    vWash = 1.0;
  #endif
  vec3 io = im[3].xyz;
  float di = distance(io, uCamLocal);
  #ifdef PC_HOLLOW
    // (the last fixes, the second blind player on Neptune: on foot the camera's boom and the landing camera pass into an
    // ice spire 17 to 27 m tall, and from inside one the eye saw only the few faces turned toward it, hard-edged dark
    // polygons at the corners of the frame. A spire the eye is in, or at the skin of, parts round it as a crown at the
    // lens does: the eye in the spire's own frame, against its girth at that height, leaning and tapering as it does)
    vec3 ce = uCamLocal - io;
    vec3 el = vec3(dot(im[0].xyz, ce) / dot(im[0].xyz, im[0].xyz), dot(im[1].xyz, ce) / dot(im[1].xyz, im[1].xyz), dot(im[2].xyz, ce) / dot(im[2].xyz, im[2].xyz));
    float hy = clamp(el.y / uHollow.y, 0.0, 1.0);
    float gr = uHollow.x * max(1.0 - 0.7 * hy, 0.6);
    float rr = length(vec2(el.x, el.z - hy * hy * uHollow.y * uHollow.z));
    vHollow = (1.0 - smoothstep(gr * 0.95, gr * 1.5 + 0.3, rr)) * step(-1.0, el.y) * (1.0 - smoothstep(uHollow.y * 1.2, uHollow.y * 1.45, el.y));
  #endif
  float j = 1.0 + (inst.z - 0.5) * uLod.z;
  // strokes at the edge of their range shrink away instead of popping
  float vis = step(uLod.x * j, di) * (1.0 - smoothstep(uLod.y * j * uLod.w, uLod.y * j, di));
  vec3 lp = position;
  #ifdef PC_FAR
    vSpecies = aInst2.x;
    int fsi = int(aInst2.x + 0.5);
    float crown = step(0.5, aData.y);
    lp.xz *= 1.0 - uFarTaper[fsi] * uv.y * crown;                 // pines, spires: taper to a point
    // rock-like kinds have no trunk: the form stands on the ground
    // (the last fixes, the second blind player on Saturn: that form was the crown's blob set down on its lowest point, a
    // spindle standing on its tip, and far off, where the tip was lost in the haze, Saturn's spires and the crystals hung
    // above the horizon. Its lower half is pressed into a broad foot, the widest girth a quarter of the way up, and it
    // stands on the ground as the near spire does; a hanging kind keeps its fall)
    float foot = crown * (1.0 - uFarTrunk[fsi]) * (1.0 - uFarDrop[fsi]);
    float yb = lp.y < 0.66 ? 0.66 - (0.66 - lp.y) * 0.3 : lp.y;
    vec3 rockP = mix(vec3(lp.x * 1.5, (lp.y - 0.30) * 1.45, lp.z * 1.5), vec3(lp.x * 1.5, (yb - 0.566) * 2.23, lp.z * 1.5), foot);
    lp = mix(lp * mix(uFarTrunk[fsi], 1.0, crown), rockP, crown * (1.0 - uFarTrunk[fsi]));
    lp.y -= uFarDrop[fsi] * 0.97;                                   // hanging kinds: the wash falls below its root
  #endif
  vec3 sw = pcSway(aData.x, inst.z * 6.283 + dot(io, vec3(0.11, 0.07, 0.13))) / max(length(im[0].xyz), 0.001);
  #ifdef PC_PHYS
    vec3 wp = (im * vec4(lp + sw * (1.0 - uPhysOn), 1.0)).xyz;
    if (uPhysOn > 0.5) {
      vec3 rootB = io + uOrigin;
      #ifdef PC_BLADE_ROOT
        // a patch of grass: every blade bends about its own root, so the sward parts
        vec3 bro = (im * vec4(aMass.x, 0.0, aMass.z, 0.0)).xyz;
        rootB += bro;
        vec2 bendB = pcPhysBend(rootB, uStiff).xy;
        wp = io + bro + pcPhysDisplace(wp - io - bro, normalize(rootB), uPlantHeight * length(im[1].xyz), bendB);
      #else
      #if defined(PC_PHYS_FULL) || defined(PC_PHYS_BRANCH)
        vec4 pbP = pcPhysBend(rootB, uStiff);
        vec2 bend = pbP.xy;
      #else
        vec2 bend = pcPhysBendLite(rootB, uStiff);
      #endif
      vec3 relP = wp - io, upP = normalize(rootB);
      float Hp = uPlantHeight * length(im[1].xyz);
      #ifdef PC_PHYS_BRANCH
        // (a crown does not sway as one piece: PHYSICS' crown, each branch loaded by its own wind and ringing at its
        // own frequency out of step with its neighbours, the foliage trembling on top, nothing moving at the trunk.
        // aBranchId: one number for a branch and the masses of foliage it carries (-1 the trunk); each tree its own)
        float bidP = aBranchId < 0.0 ? -1.0 : fract(aBranchId + inst.z * 7.31);
        relP += pcPhysCrown(relP, upP, Hp, rootB, pbP, bidP, aLeaf01);
      #endif
      wp = io + pcPhysDisplace(relP, upP, Hp, bend);
      #endif
    }
    wp = io + (wp - io) * vis;
  #else
    vec3 wp = (im * vec4((lp + sw) * vis, 1.0)).xyz;
  #endif
  vBody = wp + uOrigin;
  #ifdef PC_OIL
    vRelO = wp - uCamLocal;
  #endif
  #ifdef USE_INSTANCING
    vAbove = dot(wp - io, normalize(io + uOrigin));
  #else
    vAbove = 0.0;
  #endif
  vObj = position;
  mat3 ir = mat3(im);
  vNV = normalMatrix * (ir * normal);
  #ifdef PC_BLADE_ROOT
    vMassV = normalMatrix * (ir * vec3(aMass.x * 0.4, 1.0, aMass.z * 0.4));
  #else
    vMassV = normalMatrix * (ir * aMass);
  #endif
  vec4 mv = modelViewMatrix * vec4(wp + pcRound(io + uOrigin), 1.0);     // (a thing stands on the ground where the ground is drawn)
  vView = mv.xyz;
  vUv = uv; vData = aData; vInst = inst;
  #ifdef PC_OIL
    vMassO = aMass;
    vScaleO = length(im[0].xyz);
    vCardB = vBody - (ir * (position - aCard)) * vis;       // (the leaf moves as one piece: its centre is this far from the vertex)
  #endif
  vFog = pcFogAmountV(di * pcFogBank(vBody));      // (PAINTER 19: a thick fog lies in banks)
  gl_Position = projectionMatrix * mv;
  ${VERT_END}
}
`;

const PROP_FRAG = /* glsl */`
${FRAG_PARS}
uniform vec3 uBarkA;
uniform vec3 uBarkB;
uniform vec4 uBarkP;   // mark threshold, 0 marks run around / 1 along, dark base height (m), dry brush
uniform vec3 uLeafA;
uniform vec3 uLeafB;
uniform vec3 uLeafC;
uniform vec4 uLeafP;   // raggedness, sky holes, dab scale, wetness
uniform vec3 uAccent;
uniform float uCanopy;
uniform float uGem;       // 1: a crystal or a splinter of ice or glass, lit through its body (PAINTER 13)
#ifdef PC_OIL
uniform vec4 uOilDark;    // x: the share of this kind's trees whose bark is the dark pair below (the oil look's woods)
uniform vec3 uOilDarkA;
uniform vec3 uOilDarkB;
#endif
uniform mat3 normalMatrix;
#ifdef PC_FAR
  uniform vec3 uFarA[8];
  uniform vec3 uFarB[8];
  uniform vec3 uFarC[8];
  uniform vec3 uFarBarkA[8];
  uniform vec3 uFarBarkB[8];
  varying float vSpecies;
#endif
#ifdef PC_HOLLOW
  varying float vHollow;
#endif
uniform vec4 uFocus;      // the explorer's figure in view space (w 1 while it is shown)
varying vec3 vBody;
varying vec3 vObj;
varying vec3 vNV;
varying vec3 vMassV;
varying vec3 vView;
varying vec2 vUv;
varying vec4 vData;
varying vec4 vInst;
varying float vWash;
varying float vAbove;
varying float vFog;
#ifdef PC_OIL
varying vec3 vMassO;
varying float vScaleO;
varying vec3 vRelO;
varying vec3 vCardB;
#endif
void main() {
  #include <logdepthbuf_fragment>
  pcFp = pcFootprint(vBody);      // (R1 W2.1, chunks.js: before any discard, where the flow is uniform)
  pcDist = length(vView);         // (R1 re-fix: the leaf shadow's far octaves, chunks.js)
  float part = vData.y;
  vec3 nV = normalize(vNV);
  if (!gl_FrontFacing) nV = -nV;
  vec3 V = normalize(-vView);
  vec3 sunV = normalize((viewMatrix * vec4(uSunDirW, 0.0)).xyz);
  vec4 n1 = texture(uNoise3D, vBody / 9.0);
  float seed = vInst.z;
  float canopy = vInst.w * uCanopy;
  float vd = length(vView);
  float near = 1.0 - smoothstep(30.0, 110.0, vd);
  // strokes part when they are right in front of the eye (the explorer can walk through trunks)
  if (vd < 1.6 && texture(uNoise3D, vBody / 0.7).r * 0.8 + 0.1 > smoothstep(0.35, 1.6, vd)) discard;
  #ifdef PC_HOLLOW
    // a spire the eye is in parts into a few broad ragged washes (not a stipple of chips), none of it left once the eye
    // is inside its skin (vertex shader)
    if (vHollow > 0.001 && texture(uNoise3D, vBody / 3.2).g * 0.62 + texture(uNoise3D, vBody / 0.8).b * 0.26 + 0.06 < vHollow) discard;
  #endif
  // (PHYSICS' and PILOT's critiques, M4: a crown at the lens, in the jetpack's first second under the birches or as the
  // ship sets down in a wood, was one flat green slab over a third of the frame, with a black branch bar across it.
  // A crown within three and a half metres of the eye breaks into separate dabs with the picture between them, fewer
  // the nearer, and its branches thin away with it. vAbove: only what stands well over a plant's foot: the grass,
  // the ferns and the bushes at the boots are left whole)
  // (the re-fix: only the crown's own washes (part 1) and its thin branches (bark laid with a twig's shade: a trunk's is
  // 0). As first written the rule took every part: a birch's trunk 1.8 m from the eye was cut into floating white
  // blocks above eye level, and by the same reading a tall reed, a kelp ribbon, an ice needle or a fungal tower would
  // be. A trunk, a blade and a stone part only right at the lens, by the rule above, as before)
  if (vAbove > 1.7 && vd < 3.6 && ((part > 0.5 && part < 1.5) || (part < 0.5 && vData.z > 0.5))) {
    float nl = part > 0.5 ? texture(uNoise3D, vBody / 1.1).r * 0.62 + texture(uNoise3D, vBody / 0.36).g * 0.38 : texture(uNoise3D, vBody / 0.7).r * 0.8 + 0.1;
    if (nl > mix(0.20, 1.0, smoothstep(0.9, 3.6, vd))) discard;
  }
  // strokes that stand between the lens and the explorer's figure part round the line of sight to it:
  // a window in the crown, ragged like everything else, so the figure is never lost behind foliage
  if (uFocus.w > 0.5 && vView.z > uFocus.z + 0.4) {
    vec3 rd = normalize(vView);
    float off = length(uFocus.xyz - rd * dot(uFocus.xyz, rd));
    float hole = 1.0 - smoothstep(0.8, 2.0, off);
    if (hole > 0.0 && texture(uNoise3D, vBody / 0.9).r * 0.8 + 0.08 < hole) discard;
  }
  // a wash being laid (or lifted): broken strokes that fill in, anchored to the thing itself
  // (the touches are sized to the distance, in steps: about a hundredth of it and four times that, so a far
  // crown fills in by a few blotches over the half second and is never a stipple of single pixels)
  if (vWash < 0.999) {
    float ws = exp2(floor(log2(max(vd, 30.0) / 60.0) + 0.5));
    float wn = texture(uNoise3D, vBody / (2.3 * ws)).g * 0.5 + texture(uNoise3D, vBody / (0.6 * ws)).b * 0.5;
    wn = clamp((wn - 0.5) * 1.5 + 0.5, 0.02, 0.98);
    if (vWash >= 0.0 ? wn > vWash : wn < 1.0 + vWash) discard;
  }
  vec3 leafA = uLeafA, leafB = uLeafB, leafC = uLeafC, barkA = uBarkA, barkB = uBarkB;
  #ifdef PC_FAR
    int si = int(vSpecies + 0.5);
    leafA = uFarA[si]; leafB = uFarB[si]; leafC = uFarC[si]; barkA = uFarBarkA[si]; barkB = uFarBarkB[si];
  #endif
  vec3 c; float wet = 0.05; float id = 3.0; float x;
  float oilCover = 1.0;
  vec3 upV = normalize(normalMatrix * normalize(vBody));   // the planet's up, for snow lying on things

  #ifdef PC_OIL
  // THE OIL LOOK'S PLANTS (chunks.js, "the oil look's strokes"): bark and crowns in two layers of strokes, as the ground.
  // Bark: the chart is the tube's own (round it, along it), the strokes run the way the bark's marks do. A crown: the
  // chart is the mass's own space, flattened along whichever axis the face looks down most (taken from the face itself,
  // so it never turns with the eye); a dab too near the outline, or where the sky shows through, is left out whole.
  // (the clip's floor is a carpet of leaves with a tuft here and there: most blades and fronds are not laid)
  if (part > 1.5 && part < 2.5 && fract(seed * 7.77 + 0.31) > uOilG.y * uGroundK.y) discard;
  if (part > 4.5) {
    // ---- a leaf (florakit.js leafCards): one piece of flat colour, its outline the geometry's own; in the sun or in
    // the shade WHOLE (everything is asked at the leaf's centre), each leaf its own colour of the tree's three
    float h = vData.w;
    vec3 r3 = vec3(h, fract(h * 13.7), fract(h * 5.1));
    float hue = vInst.x + (h - 0.5) * 1.7;
    vec3 cs = mix(leafA, leafB, clamp(0.5 + hue * 0.5, 0.0, 1.0));
    cs = mix(cs, leafC, clamp(vData.z * 0.55 + (r3.y - 0.5) * 0.6, 0.0, 1.0));
    cs = pcWetWash(pcDabTint(pcDensity(cs, 1.0 + vInst.y * 0.4), r3, 1.0), 0.7);
    vec3 mV = normalize(vMassV);
    float xs_ = (dot(mV, sunV) * 0.5 + 0.5) * (1.0 - vData.z * 0.35);
    // (the sun behind a crown comes through its leaves: those glow)
    xs_ = max(xs_, pow(max(dot(-V, sunV), 0.0), 1.5) * (0.6 + 0.4 * r3.x));
    xs_ *= mix(0.50, 1.0, pcSunAt(vCardB, canopy * 0.4, 8.0 - vAbove, 0.3));
    xs_ += (r3.z - 0.5) * 0.25;
    xs_ = max(xs_, 0.30 + 0.15 * r3.x);
    float lvl = pcLevel(xs_, 0.03);
    // (a leaf's shade is its own colour laid heavier with half the cool key over it, never the key's mud)
    vec3 deepF = pcBody(pcDensity(cs, 1.35)) * mix(vec3(1.0), pcOilShadeC(), 0.5) * 0.80;
    c = pcLamp(mix(deepF, pcTone(cs, lvl), smoothstep(1.2, 2.0, lvl)), cs, vCardB, r3.y);
    wet = 0.0;
    id = 4.0 + fract(seed * 7.0 + h * 0.37) * 0.9;
  } else if (part < 1.5) {
    bool isBark = part < 0.5;
    // (some trees of a kind are dark-barked: their own pair of bark washes, and their marks run along the stem)
    float dk = step(fract(seed * 5.31 + 0.17), uOilDark.x - 0.001);
    barkA = mix(barkA, uOilDarkA, dk); barkB = mix(barkB, uOilDarkB, dk);
    bool along = uBarkP.y > 0.5 || dk > 0.5;
    float wpxP = uOilA.x * uOilPx.y / 720.0;
    vec3 odx = dFdx(vObj), ody = dFdy(vObj);
    vec2 ch, dcx, dcy;
    if (isBark) {
      // (uBarkP.y: 0 the marks run round the stem, 1 along it; the tube's own chart, in metres or near enough: along
      // it the plant's own units, round it one turn taken as 1.1 of them)
      vec2 uvm = vec2(vUv.y, vUv.x * 1.1) * vScaleO;
      ch = along ? uvm : uvm.yx;
      vec2 ux = dFdx(vUv), uy = dFdy(vUv);
      vec2 mx = vec2(ux.y, ux.x * 1.1) * vScaleO, my = vec2(uy.y, uy.x * 1.1) * vScaleO;
      dcx = along ? mx : mx.yx; dcy = along ? my : my.yx;
    } else {
      // (a crown's chart: the crown's own space in metres, laid flat along whichever axis the MASS faces most there, so
      // it is one chart over a whole side of the crown, whatever its triangles, and a leaf is the same size on a
      // sapling and on a far tree drawn large. Tried: the way the mass faces as metres round a ball of fixed size: a
      // far tree's crown, twice that ball, got leaves twice too large, a handful to a crown, and from the air every
      // crown was a few flat patches. The chart's derivatives are taken of all three layings before one is chosen.)
      vec3 po = vObj * vScaleO, pox = odx * vScaleO, poy = ody * vScaleO;
      vec3 ma = abs(normalize(vMassO));
      if (ma.x >= ma.y && ma.x >= ma.z) { ch = po.zy; dcx = pox.zy; dcy = poy.zy; }
      else if (ma.y >= ma.z) { ch = po.xz; dcx = pox.xz; dcy = poy.xz; }
      else { ch = po.xy; dcx = pox.xy; dcy = poy.xy; }
      ch += vData.w * 23.0;
    }
    // (bark's streaks are a stroke wide on the screen at every distance, as the ground's are: capped at a width on the
    // stem they shrank under the pixel a few metres off and every trunk was a flat slab. A crown's leaves are never
    // under about three and a half pixels wide: thinner, and a far crown was a stipple of single pixels)
    float dabK = max(uOilS.w * 0.9, 2.2 * uOilS.z / max(uOilA.x, 0.5));
    #ifdef PC_FAR
      // (a far tree's crown is one small mass: with dabs the size of the ground's it was four or five flat patches, a
      // faceted lump from the air; smaller leaves, so a crown is a cluster of them, as the near trees are)
      dabK *= 0.62;
    #endif
    vec4 o4c = pcStrokeOct4(vd * (0.85 + 0.3 * seed) * dabK, 0.05);
    vec3 oc = isBark ? vec3(pcStrokeOct(vd * (0.85 + 0.3 * seed), 0.004), 1.0) : vec3(o4c.xy, 1.0);
    // (a crown's dabs come and go whole, each asked at its own centre: chunks.js pcDabLayer)
    vec3 ocl = vec3(o4c.w - o4c.z, dFdx(o4c.w), dFdy(o4c.w));
    float gone = smoothstep(0.15, 0.85, oc.y), fine = oc.z;
    vec3 nvdx = dFdx(vNV), nvdy = dFdy(vNV), mvdx = dFdx(vMassV), mvdy = dFdy(vMassV);
    vec3 vwdx = dFdx(vView), vwdy = dFdy(vView), bdx = dFdx(vRelO), bdy = dFdy(vRelO);      // (the place's derivatives from a position measured from the eye: the body's own coordinates are too coarse to difference, chunks.js pcGroundChartD)
    float pale = smoothstep(0.55, 0.9, dot(barkA, vec3(0.333)));
    float xb0 = (dot(nV, sunV) * 0.5 + 0.5) * mix(0.55 + 0.30 * pale, 1.0, pcSunAt(vBody, canopy * 0.8, 8.0 - vAbove, oc.x));
    vec3 acc = isBark ? pcTone(mix(barkA, barkB, 0.16), pcLevel(xb0, 0.04)) : pcTone(pcDensity(leafC, 1.5), 0.7);
    float accA = isBark ? 1.0 : 0.0;
    for (int L = 1; L >= 0; L--) {
      float w = oc.x * (L == 1 ? 2.0 : 1.0);
      float lim = 4.0 * wpxP * (L == 1 ? 2.0 : 1.0);
      vec3 rnd, rnd2; vec2 ds, ctrD; float cov, has2;
      // (bark: long thin streaks that run with the stem or round it, nothing drawn between them; a crown: thin leaves,
      // lying every way)
      // (streaks that run with the stem are long; those that run round it are short, so the stem still turns in the light)
      if (isBark) { float ba = along ? 15.0 : 3.2; pcThinLayer(ch + seed * 37.0, dcx, dcy, w, ba, vObj + seed * 11.0, lim * ba, 2.0, rnd, ds, cov, rnd2); has2 = 1.0; }
      else pcDabLayer(ch + seed * 37.0, dcx, dcy, w, uOilS.z, lim * 3.0, ocl, L == 0 ? vec2(0.0, 1.0) : vec2(0.0), rnd, ctrD, ds, cov, rnd2, has2);
      vec3 Bc = vBody + bdx * ds.x + bdy * ds.y;
      vec3 nVc = normalize(vNV + nvdx * ds.x + nvdy * ds.y);
      if (!gl_FrontFacing) nVc = -nVc;
      vec3 Vc = normalize(-(vView + vwdx * ds.x + vwdy * ds.y));
      vec4 nA = pcNoiseS(Bc, 9.0, w);
      vec3 cs; float xs_;
      if (isBark) {
        // a streak is the bark's light wash or one of its dark marks, whole; the foot of the stem and a thin branch are dark
        float markP = mix(mix(0.10, 0.42, clamp((0.72 - uBarkP.x) * 4.0, 0.0, 1.0)), 0.34, dk);
        float base = 1.0 - smoothstep(0.0, uBarkP.z, vUv.y + (rnd.y - 0.5) * 1.1 * fine);
        float twig = smoothstep(0.0, 1.0, vData.z);
        float m1 = mix(markP, step(1.0 - markP, rnd.x), fine), m2 = mix(markP, step(1.0 - markP, rnd2.x), fine);
        #ifdef PC_FAR
          base = 0.0;
        #endif
        vec3 k1 = mix(barkA, barkB, clamp(max(max(m1, base * 0.9), twig), 0.0, 1.0)), k2 = mix(barkA, barkB, clamp(max(max(m2, base * 0.9), twig), 0.0, 1.0));
        k1 = pcWetWash(pcDensity(k1, 1.0 + ((rnd.y - 0.5) * 1.5 * fine + (nA.r - 0.5) * 0.5) * uOilB.z), 0.9);
        k2 = pcWetWash(pcDensity(k2, 1.0 + ((rnd2.y - 0.5) * 1.5 * fine + (nA.r - 0.5) * 0.5) * uOilB.z), 0.9);
        k1 *= mix(vec3(1.0), mix(vec3(1.12, 0.96, 0.80), vec3(0.90, 0.90, 1.08), rnd.z), 0.7 * uOilB.z * fine);
        k2 *= mix(vec3(1.0), mix(vec3(1.12, 0.96, 0.80), vec3(0.90, 0.90, 1.08), rnd2.z), 0.7 * uOilB.z * fine);
        xs_ = dot(nVc, sunV) * 0.5 + 0.5;
        xs_ *= mix(0.55 + 0.30 * pale, 1.0, pcSunAt(Bc, canopy * 0.8, 8.0 - vAbove, w));
        xs_ += (rnd.x - 0.5) * 0.10 * fine;
        float lvl = pcLevel(xs_, 0.03), pk = pale * 0.45 * max(uDayness, uMoon);
        vec3 l1 = mix(pcTone(k1, lvl), pcTone(k1, max(lvl, 1.0) * 0.5 + 1.0), pk), l2 = mix(pcTone(k2, lvl), pcTone(k2, max(lvl, 1.0) * 0.5 + 1.0), pk);
        l1 = pcLamp(l1, k1, Bc, rnd.y); l2 = pcLamp(l2, k2, Bc, rnd2.y);
        vec3 lay = mix(l2, l1, cov);
        if (L == 1) acc = mix(acc, lay, fine * uOilC.z);
        else {
          float here = step(gone, rnd.x * 0.999), there = step(gone, rnd2.x * 0.999);
          lay = here > 0.5 ? mix(mix(acc, l2, there), l1, cov) : mix(mix(acc, l2, there), acc, cov);
          acc = mix(acc, lay, fine * uOilC.z);
        }
      } else {
        vec3 mVc = normalize(vMassV + mvdx * ds.x + mvdy * ds.y);
        // the outline is ragged by whole leaves, and the sky shows through where whole leaves are left out
        float rim = 1.0 - abs(dot(nVc, Vc));
        float cut = smoothstep(0.30, 0.90, rim) * uLeafP.x + uLeafP.y * (0.30 + 0.75 * smoothstep(0.46, 0.72, nA.r));
        float there = step(cut, fract(rnd.z * 9.1) * 0.8 + 0.2 * rnd.x + 0.10);
        float hue = vInst.x + (rnd.x - 0.5) * 1.5 + (vData.w - 0.5) * 0.7 + (nA.b - 0.5) * 0.5;
        cs = mix(leafA, leafB, clamp(0.5 + hue * 0.5, 0.0, 1.0));
        cs = mix(cs, leafC, clamp(vData.z * 0.75 + (rnd.y - 0.5) * 0.5, 0.0, 1.0));
        cs = pcWetWash(pcDabTint(pcDensity(cs, 1.0 + (nA.r - 0.5) * 0.4 * uOilB.z + vInst.y * 0.5), rnd, 1.0), 0.7);
        float snowF = pcSnowCover(dot(mVc, upV) * 0.5 + 0.5, rnd.x * 0.6 + nA.g * 0.4, vData.z * 0.8);
        cs = mix(cs, mix(vec3(0.94, 0.955, 1.0), vec3(0.86, 0.90, 1.0), rnd.y * 0.6), snowF);
        xs_ = dot(mVc, sunV) * 0.5 + 0.5;
        xs_ = xs_ * (1.0 - vData.z * 0.42 * (1.0 - snowF));
        // (the sun behind a crown comes through its leaves: those glow)
        float through = pow(max(dot(-Vc, sunV), 0.0), 1.5);
        xs_ = max(xs_, through * (0.55 + 0.45 * rnd.x));
        xs_ *= mix(0.62, 1.0, pcSunAt(Bc, canopy * 0.6, 8.0 - vAbove, w));
        xs_ += (vData.w - 0.5) * 0.22 + (rnd.y - 0.5) * 0.20;
        xs_ = max(xs_, 0.30 + 0.18 * rnd.x + (vData.w - 0.5) * 0.14);
        float lvl = pcLevel(xs_, 0.03);
        // (a crown's shade is its own colour laid heavier with half the cool key over it: the key alone over an orange
        // crown is mud; light comes through leaves)
        vec3 deepF = pcBody(pcDensity(cs, 1.35)) * mix(vec3(1.0), pcOilShadeC(), 0.5) * 0.80;
        vec3 lit = pcLamp(mix(deepF, pcTone(cs, lvl), smoothstep(1.2, 2.0, lvl)), cs, Bc, rnd.y);
        acc = mix(acc, lit, cov * there * uOilC.z);
        accA = max(accA, there * cov);
      }
    }
    // (a crown's outline, leaf by leaf: with the scene multisampled a leaf's edge takes the share of the pixel it covers
    // (alpha to coverage: the material asks for it, makePropMaterial), which is what keeps the outline still under a
    // moving eye; with one sample a leaf is there or it is not)
    if (accA < (uOilG.z > 0.5 ? 0.06 : 0.5)) discard;
    c = acc;
    oilCover = accA;
    wet = 0.0;
    id = isBark ? 3.0 + seed * 0.9 : 4.0 + fract(seed * 7.0 + vData.w * 0.37) * 0.9;
  } else
  #endif
  if (part < 0.5) {
    // ---- bark: a pale or warm wash with dry-brushed marks
    float pale = smoothstep(0.55, 0.9, dot(barkA, vec3(0.333)));
    #ifdef PC_FAR
      c = mix(barkA, barkB, 0.22 + 0.3 * n1.b);
    #else
      vec2 tuv = mix(vec2(vUv.x * 1.5 + seed * 3.0, vUv.y * 1.15 + seed * 5.0), vec2(vUv.y * 0.30 + seed * 3.0, vUv.x * 3.0 + seed * 5.0), uBarkP.y);
      vec4 st = texture(uStrokeTex, tuv);
      vec4 stb = texture(uStrokeTex, vec2(vUv.x * 1.0 + seed * 9.0, vUv.y * 0.21 + seed * 2.0));
      // the edge of the stroke is broken: the trunk thins and swells along its length
      vec4 nb = texture(uNoise3D, vec3(vUv.y * 0.55 + seed * 7.0, seed * 3.0, vUv.x * 0.15));
      float rimB = 1.0 - abs(dot(nV, V));
      if (rimB > 0.86 - 0.42 * smoothstep(0.42, 0.72, nb.r) && vData.z < 0.5) discard;
      // dashes (lenticels), plus a few larger dark scars
      float marks = smoothstep(uBarkP.x, uBarkP.x + 0.05, st.r * 0.92 + st.b * 0.14 + (n1.b - 0.5) * 0.10);
      marks = max(marks, smoothstep(0.80, 0.86, stb.g + (st.r - 0.5) * 0.25) * (1.0 - uBarkP.y));
      float base = 1.0 - smoothstep(0.0, uBarkP.z, vUv.y + (st.b - 0.5) * 1.3);
      float twig = smoothstep(0.0, 1.0, vData.z);   // thin branches read dark
      c = mix(barkA, barkB, clamp(max(max(marks, base * 0.9), twig), 0.0, 1.0));
      // soft grey washes drift up the trunk: never one even white
      c *= mix(vec3(1.0), vec3(0.80, 0.80, 0.87), smoothstep(0.48, 0.70, nb.g) * 0.7 * pale);
      float dryM = smoothstep(0.56, 0.68, st.g * 0.5 + st.r * 0.6);
      c = mix(c, vec3(1.0), dryM * uBarkP.w * near * 0.5);
    #endif
    c = pcWetWash(pcDensity(c, 1.0 + (n1.r - 0.5) * 0.7), 0.9);     // wet bark goes dark
    x = dot(nV, sunV) * 0.5 + 0.5;
    // (PAINTER 14: a pale trunk keeps its sunlit side under the canopy's shade, so a birch wood's trunks are its paper
    // lights, the shaded side glazed: the leaf shadow laid over them whole made the reference forest's birches light
    // grey, and the frame had no paper anywhere)
    x *= mix(0.55 + 0.30 * pale, 1.0, pcDappleL(vBody, canopy * 0.8, 8.0 - vAbove));
    x += (n1.g - 0.5) * 0.12;
    float lvl = pcLevel(x, 0.06);
    // pale bark takes a thinner shadow wash: by day the trunks stay the lights of the picture
    c = mix(pcTone(c, lvl), pcTone(c, max(lvl, 1.0) * 0.5 + 1.0), pale * 0.75 * max(uDayness, uMoon));     // (and by night: birch bark is one of a nocturne's reserved lights)
    id = 3.0 + seed * 0.9;
  } else if (part < 1.5) {
    // ---- foliage mass: a few overlapping washes with a ragged, dabbed edge.
    // The dabs keep about the same size on the sheet at any distance: far crowns are fewer,
    // larger strokes (two octaves cross-faded, anchored to the tree).
    float lodf = log2(max(vd / 7.0, 1.0));
    float l0 = floor(lodf);
    float fr = smoothstep(0.25, 0.75, lodf - l0);
    float s0 = exp2(-l0);
    vec2 suv = vUv * uLeafP.z;
    vec4 st = mix(texture(uStrokeTex, suv * s0 + seed * 3.7), texture(uStrokeTex, suv * s0 * 0.5 + seed * 3.7), fr);
    vec4 n2 = mix(texture(uNoise3D, vBody * (s0 / 2.6) + 0.4), texture(uNoise3D, vBody * (s0 / 5.2) + 0.4), fr);
    float rim = 1.0 - abs(dot(nV, V));
    float cut = smoothstep(0.30, 0.92, rim) * uLeafP.x + uLeafP.y * smoothstep(0.52, 0.72, n2.r);
    // the edge of a wash is a little more broken than its inside
    float stE = texture(uStrokeTex, suv * s0 * 2.0 + seed * 1.3).g;
    if (mix(st.g, stE, 0.45) + (n2.g - 0.5) * 0.5 < cut) discard;
    vec3 mV = normalize(vMassV);
    float hue = vInst.x + (n1.b - 0.5) * 0.9 + (vData.w - 0.5) * 0.7;
    c = mix(leafA, leafB, clamp(0.5 + hue * 0.5, 0.0, 1.0));
    c = mix(c, leafC, clamp(vData.z * 0.75 + (n2.b - 0.5) * 0.3, 0.0, 1.0));
    c = pcWetWash(pcDensity(c, 1.0 + (n1.r - 0.5) * 0.9 + vInst.y * 0.5), 0.7);
    // snow lies on the tops of the masses: bare paper with a ragged lower edge
    float snowF = pcSnowCover(dot(mV, upV) * 0.5 + 0.5, st.g * 0.6 + n2.g * 0.4, vData.z * 0.8);
    c = mix(c, vec3(0.97, 0.98, 1.0), snowF);
    x = dot(mV, sunV) * 0.5 + 0.5;
    x = x * (1.0 - vData.z * 0.42 * (1.0 - snowF));
    float through = pow(max(dot(-V, sunV), 0.0), 1.5);
    x = max(x, through * (0.50 + 0.45 * st.g + (n2.r - 0.5) * 0.5));
    x *= mix(0.62, 1.0, pcDappleL(vBody, canopy * 0.6, 8.0 - vAbove));
    // each wash of the crown sits at its own value; a few dark touches inside
    x += (vData.w - 0.5) * 0.26 + (n2.g - 0.5) * 0.14 - smoothstep(0.55, 0.8, st.g) * 0.16;
    // (PAINTER 13: light comes through a crown and off the sky into it: no wash of a crown goes below one glaze, and the
    // floor itself wanders from wash to wash. The near autumn crowns overhead, their inner washes in the canopy's shade,
    // went to the deepest step and stood as flat, hard sepia masses; a forest's near crowns as one dark slate)
    x = max(x, 0.29 + 0.20 * st.g + (n2.r - 0.5) * 0.22 + (vData.w - 0.5) * 0.16);
    float lvl = min(pcLevel(x, 0.07), 2.6);
    // (and a crown's shade is its own colour laid heavier with only half the cool glaze over it: the violet glaze over an
    // orange or gold crown made mud, the autumn wood's near crowns one flat sepia; a green crown's shade goes deep green,
    // not slate)
    vec3 deepF = pcDensity(c, 1.45) * mix(vec3(1.0), uGlaze, 0.45);
    c = mix(pcTone(c, lvl), deepF, (1.0 - smoothstep(0.8, 1.7, lvl)) * 0.75 * uDayness);
    wet = max(uLeafP.w, uWx.y * 0.5);
    id = 4.0 + fract(seed * 7.0 + vData.w * 0.37) * 0.9;
  } else if (part < 2.5) {
    // ---- blades and fronds: single crisp strokes, lit like the ground under them
    // (under snow most of them are buried; the few left stand dark against the paper)
    if (seed < uWx.z * 0.9) discard;
    float hue = vInst.x + (n1.b - 0.5) * 0.8;
    c = mix(leafA, leafB, clamp(0.5 + hue * 0.5, 0.0, 1.0));
    c = mix(c, leafC, clamp(0.55 - vUv.y * 0.7, 0.0, 1.0));
    c = mix(c, vec3(0.50, 0.43, 0.40), uWx.z * 0.85);      // (what still stands out of the snow is dead stalk, not a green fleck)
    c = pcWetWash(pcDensity(c, 1.0 + (n1.r - 0.5) * 0.8 + vInst.y * 0.5), 0.6);
    x = dot(normalize(vMassV), sunV) * 0.5 + 0.5;
    x *= mix(0.42, 1.0, pcDappleL(vBody, canopy, 8.0 - vAbove));
    x += (n1.g - 0.5) * 0.14 + vUv.y * 0.10;
    float lvl = pcLevel(x, 0.06);
    c = pcTone(c, lvl);
    wet = 0.1;
    id = 4.0 + seed * 0.9;
  } else if (part < 3.5) {
    // ---- accent: one soft touch of pure pigment (none on a snowfield)
    if (seed < uWx.z * 1.2) discard;
    c = pcDensity(uAccent, 1.0 + (n1.r - 0.5) * 0.9);
    x = 0.6 * mix(0.6, 1.0, pcDappleL(vBody, canopy, 8.0 - vAbove));
    c = pcTone(c, pcLevel(x + 0.2, 0.08));
    wet = 0.35;
    id = 4.0 + seed * 0.9;
  } else {
    #ifdef PC_OIL
    // ---- a boulder in the oil look: planes of flat paint. Its cleaved faces are each one piece, a little its own colour
    // (a face's number comes from the way it looks, in the stone's own space), lit whole, in half-tone steps; no
    // nibbled edge, no grain. On a world of snow, and under snow anywhere, what faces up is snow. (As a wash it stood in
    // the oil look as a smooth-shaded lump: the critic.)
    {
      vec3 nb = normalize(vMassO);
      float fh = fract(sin(dot(floor(nb * 3.0 + 0.5), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
      c = mix(barkA, barkB, clamp(vData.z * 0.7 + (fh - 0.5) * 0.5, 0.0, 1.0));
      c = pcWetWash(pcDensity(c, 1.0 + (fh - 0.5) * 0.5), 0.8);
      float upF = dot(nV, upV);
      float snowR = max(pcSnowCover(upF * 0.5 + 0.5, fh, 0.0), uGroundK.x * step(0.55, upF));
      c = mix(c, vec3(0.92, 0.95, 0.98), snowR);
      x = (dot(nV, sunV) * 0.5 + 0.5) * mix(0.45, 1.0, pcSunAt(vBody, canopy, 8.0 - vAbove, 0.3));
      float lvlR = floor(pcLevel(x, 0.04) * 2.0 + 0.5) * 0.5;
      if (uGem > 0.5) lvlR = max(lvlR, 1.5);      // (a crystal is lit through: none of its faces goes to the deep step)
      c = pcLamp(pcTone(c, lvlR), c, vBody, fh);
      id = 3.0 + seed * 0.9;
    }
    #else
    // ---- rock: pale granulating wash, paper on top, pooled dark at the base
    // the silhouette is nibbled and the tones wander: a wash, not a faceted solid
    vec4 nr = texture(uNoise3D, vBody / 2.3 + 0.3);
    float rimR = 1.0 - abs(dot(nV, V));
    if (rimR > 0.92 - 0.20 * smoothstep(0.42, 0.74, nr.r)) discard;
    c = mix(barkA, barkB, clamp(vData.z * 0.8 + (n1.r - 0.5) * 0.5, 0.0, 1.0));
    // (the pigment gathers just inside the stone's edge, as a wash dries on a rough form)
    c = pcWetWash(pcDensity(c, 1.0 + (n1.b - 0.5) * 0.9 + (nr.b - 0.5) * 0.5 + smoothstep(0.55, 0.88, rimR + (nr.r - 0.5) * 0.2) * 0.38), 0.8);
    float snowR = pcSnowCover(dot(nV, upV) * 0.5 + 0.5, nr.g * 0.6 + n1.r * 0.4, 0.0);
    c = mix(c, vec3(0.97, 0.98, 1.0), snowR);
    x = dot(nV, sunV) * 0.5 + 0.5;
    x *= mix(0.45, 1.0, pcDappleL(vBody, canopy, 8.0 - vAbove));
    vec4 nf = texture(uNoise3D, vBody / 0.55 + 0.61);
    x += (n1.g - 0.5) * 0.22 + (nr.g - 0.5) * 0.26 + (nf.b - 0.5) * 0.1;
    // (a crystal is lit through: the middle of every facet keeps a light core of its own wash and no facet takes more than
    // one glaze; where the light passes the edge goes to paper. As stone they went to the deep step and every one was the
    // same saturated blue-violet, whatever its wash: Mercury's crystal gardens, ARTPASS weakest 3)
    if (uGem > 0.5) x = max(x + 0.04, 0.28 + 0.18 * (1.0 - rimR) + (nr.g - 0.5) * 0.20);
    float lvl = pcLevel(x, 0.12);
    c = pcTone(c, lvl);
    if (uGem > 0.5) c = mix(c, vec3(0.99, 0.985, 0.97), smoothstep(0.72, 0.92, rimR + (nr.b - 0.5) * 0.3) * smoothstep(1.6, 2.6, lvl) * 0.6);
    float dryM = pcStepF(0.60, 0.70, nf.b * 0.6 + nf.r * 0.4, 0.36 * pcSub(0.55, PC_NB) + 0.16 * pcSub(0.55, PC_NRG));
    c = mix(c, vec3(1.0), dryM * 0.5 * near * (0.3 + 0.25 * lvl));
    id = 3.0 + seed * 0.9;
    #endif
  }
  c = pcAtmosV(c, vFog, vView);
  wet = max(max(wet, vFog * 0.85), uWx.w * smoothstep(10.0, 90.0, vd) * 0.9);
  #ifdef PC_OIL
    wet = oilCover;       // (the oil look has no wet paint: the first target's alpha is the pixel's cover, for alpha to coverage)
  #endif
  pcWrite(c, wet, nV, -vView.z, id);
}
`;

export function makePropMaterial(bodyU, opts = {}) {
  const v3 = (a, d) => ({ value: new THREE.Vector3().fromArray(a || d) });
  const own = {
    uOrigin: { value: new THREE.Vector3() }, uCamLocal: { value: new THREE.Vector3() },
    uLod: { value: new THREE.Vector4(0, 1e9, 0, 0.9) },
    uWashIn: { value: new THREE.Vector3(1e6, 0, 0.55) },
    uFocus: { value: new THREE.Vector4(0, 0, 0, 0) },
    uWind: { value: opts.wind == null ? 0.06 : opts.wind },
    uBarkA: v3(opts.barkA, [0.95, 0.94, 0.92]), uBarkB: v3(opts.barkB, [0.30, 0.27, 0.27]),
    uBarkP: { value: new THREE.Vector4().fromArray(opts.barkP || [0.62, 0, 1.0, 0.5]) },
    uLeafA: v3(opts.leafA, [0.72, 0.80, 0.36]), uLeafB: v3(opts.leafB, [0.50, 0.68, 0.34]),
    uLeafC: v3(opts.leafC, [0.30, 0.48, 0.40]),
    uLeafP: { value: new THREE.Vector4().fromArray(opts.leafP || [0.8, 0.25, 1.0, 0.45]) },
    uAccent: v3(opts.accent, [0.85, 0.29, 0.17]),
    uCanopy: { value: opts.canopy == null ? 1.0 : opts.canopy },
    uGem: { value: opts.gem ? 1 : 0 },
    // (the oil look: opts.oilDark = [share, [bark light], [bark dark]])
    uOilDark: { value: new THREE.Vector4(opts.oilDark ? opts.oilDark[0] : 0, 0, 0, 0) },
    uOilDarkA: v3(opts.oilDark && opts.oilDark[1], [0.5, 0.4, 0.4]), uOilDarkB: v3(opts.oilDark && opts.oilDark[2], [0.2, 0.15, 0.2]),
  };
  const defines = {};
  if (opts.phys) {
    defines.PC_PHYS = 1;
    if (opts.phys === 'full') defines.PC_PHYS_FULL = 1;
    if (opts.bladeRoot) defines.PC_BLADE_ROOT = 1;
    if (opts.branch) defines.PC_PHYS_BRANCH = 1;
    Object.assign(own, PHYS, { uStiff: { value: opts.stiff || 0 }, uPlantHeight: { value: opts.plantHeight || 1 } });
  }
  if (opts.hollow) {
    // a spire parts round an eye inside it (PROP_VERT, PC_HOLLOW): its girth at the foot, height and lean, in its own units
    defines.PC_HOLLOW = 1;
    own.uHollow = { value: new THREE.Vector4(opts.hollow[0], opts.hollow[1], opts.hollow[2] || 0, 0) };
  }
  if (opts.far) {
    // far trees of every species share one mesh: per-instance species picks the washes
    defines.PC_FAR = 1;
    const pad = (a) => { while (a.length < 8) a.push(a[a.length - 1].clone ? a[a.length - 1].clone() : a[a.length - 1]); return a; };
    const arr = (k) => ({ value: pad(opts.far.map((f) => new THREE.Vector3().fromArray(f[k]))) });
    own.uFarA = arr('leafA'); own.uFarB = arr('leafB'); own.uFarC = arr('leafC');
    own.uFarBarkA = arr('barkA'); own.uFarBarkB = arr('barkB');
    own.uFarTaper = { value: pad(opts.far.map((f) => f.taper || 0)) };
    own.uFarTrunk = { value: pad(opts.far.map((f) => (f.trunk ? 1 : 0))) };
    own.uFarDrop = { value: pad(opts.far.map((f) => (f.drop ? 1 : 0))) };
  }
  const m = new THREE.ShaderMaterial({
    name: 'pc-prop-' + (opts.name || ''),
    defines,
    uniforms: baseUniforms(bodyU, own),
    vertexShader: PROP_VERT, fragmentShader: PROP_FRAG,
    side: opts.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
  });
  m.userData.pcPainted = true;
  register(m, 'prop', opts);
  if (LOOK.oil) m.alphaToCoverage = true;       // (a crown's leaves at its outline: PROP_FRAG, the oil branch)
  return m;
}

// ------------------------------------------------------------------------------------------
// Wash: the general painted material (explorer, ship, Pilot's incidental objects, and the
// stand-in for any foreign Three material found in the scene).
// ------------------------------------------------------------------------------------------
const WASH_VERT = /* glsl */`
${VERT_PARS}
varying vec3 vObj;
varying vec3 vNO;
varying vec3 vNV;
varying vec3 vView;
#ifdef USE_VCOLOR
  attribute vec3 color;
  varying vec3 vVCol;
#endif
#ifdef USE_UVMAP
  varying vec2 vUv;
#endif
#ifdef PC_POINTS
  uniform float uPointSize;
#endif
void main() {
  vec3 p = position;
  vec3 n = vec3(0.0, 1.0, 0.0);
  #ifndef PC_UNLIT
    n = normal;
  #endif
  #ifdef PC_SPRITE
    vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vec2 sc = vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
    mv.xy += position.xy * sc;
    vNV = vec3(0.0, 0.0, 1.0);
  #else
    #ifdef USE_INSTANCING
      p = (instanceMatrix * vec4(p, 1.0)).xyz;
      n = mat3(instanceMatrix) * n;
    #endif
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vNV = normalMatrix * n;
  #endif
  vObj = position; vNO = n;
  vView = mv.xyz;
  #ifdef USE_VCOLOR
    vVCol = color;
  #endif
  #ifdef USE_UVMAP
    vUv = uv;
  #endif
  gl_Position = projectionMatrix * mv;
  #ifdef PC_POINTS
    gl_PointSize = uPointSize;
  #endif
  ${VERT_END}
}
`;

const WASH_FRAG = /* glsl */`
${FRAG_PARS}
uniform vec3 uColor;
uniform vec4 uWash;   // noise scale (1/m), dry brush, wetness, region id
uniform float uFlat;  // 1 = no light steps (pure wash)
uniform float uFade;  // 1 = all of it; less: thinned through a fixed stipple (a far world's ball giving way to the world itself)
varying vec3 vObj;
varying vec3 vNO;
varying vec3 vNV;
varying vec3 vView;
#ifdef USE_VCOLOR
  varying vec3 vVCol;
#endif
#ifdef USE_UVMAP
  uniform sampler2D uMap;
  varying vec2 vUv;
#endif
void main() {
  if (uFade < 0.999 && fract(52.9829189 * fract(dot(floor(gl_FragCoord.xy), vec2(0.06711056, 0.00583715)))) >= uFade) discard;
  #include <logdepthbuf_fragment>
  vec3 c = uColor;
  #ifdef USE_VCOLOR
    c *= vVCol;
  #endif
  #ifdef USE_UVMAP
    vec4 tx = texture(uMap, vUv);
    if (tx.a < 0.5) discard;
    c *= tx.rgb;
  #endif
  vec4 n1 = texture(uNoise3D, vObj * uWash.x);
  vec4 n2 = texture(uNoise3D, vObj * uWash.x * 3.7 + 0.31);
  c = pcDensity(c, 1.0 + (n1.r - 0.5) * 0.7 + (n2.g - 0.5) * 0.3);
  vec3 nV = vec3(0.0, 0.0, 1.0);
  float lvl = 2.0;
  #ifndef PC_UNLIT
    nV = normalize(vNV);
    if (!gl_FrontFacing) nV = -nV;
    vec3 sunV = normalize((viewMatrix * vec4(uSunDirW, 0.0)).xyz);
    float x = dot(nV, sunV) * 0.5 + 0.5 + (n1.g - 0.5) * 0.14;
    lvl = mix(pcLevel(x, 0.05), 2.0, uFlat);
    vec4 st = pcTri(vObj * 2.0, normalize(vNO), 0.5);
    float dryM = smoothstep(0.52, 0.66, st.r * 0.8 + st.b * 0.3);
    c = mix(c, vec3(1.0), dryM * uWash.y * (0.25 + 0.15 * lvl));
  #endif
  c = pcTone(c, lvl);
  float f = pcFogAmount(length(vView));
  c = pcAtmosV(c, f, vView);
  pcWrite(c, max(uWash.z, f * 0.8), nV, -vView.z, uWash.w);
}
`;

// makeWashMaterial({ color, wet, dry, scale, id, flat, vertexColors, side, map })
//   color: THREE.Color | hex | css string: the wash as it should look on paper
//   wet 0..1: how much it bleeds into neighbours; dry 0..1: dry-brush sparkle
//   scale: size in metres of the wash turbulence; flat: skip the light steps
export function makeWashMaterial(opts = {}) {
  const col = new THREE.Color(opts.color == null ? 0xb9b3a8 : opts.color);
  const rgb = { r: 0, g: 0, b: 0 };
  col.getRGB(rgb, THREE.SRGBColorSpace);
  const defines = {};
  if (opts.vertexColors) defines.USE_VCOLOR = 1;
  if (opts.map) defines.USE_UVMAP = 1;
  if (opts.unlit) defines.PC_UNLIT = 1;
  if (opts.points) { defines.PC_POINTS = 1; defines.PC_UNLIT = 1; }
  if (opts.sprite) { defines.PC_SPRITE = 1; defines.PC_UNLIT = 1; }
  const m = new THREE.ShaderMaterial({
    name: 'pc-wash',
    defines,
    uniforms: baseUniforms(opts.bodyUniforms, {
      uColor: { value: new THREE.Vector3(rgb.r, rgb.g, rgb.b) },
      uWash: { value: new THREE.Vector4(1 / (opts.scale || 1.6), opts.dry == null ? 0.25 : opts.dry, opts.wet == null ? 0.15 : opts.wet, opts.id == null ? 5.0 : opts.id) },
      uFlat: { value: opts.flat ? 1 : 0 }, uFade: { value: 1 },
      uMap: { value: opts.map || null },
      uPointSize: { value: opts.pointSize || 3 },
    }),
    vertexShader: WASH_VERT, fragmentShader: WASH_FRAG,
    side: opts.side == null ? THREE.FrontSide : opts.side,
  });
  m.userData.pcPainted = true;
  return register(m, 'wash', opts);
}

// ------------------------------------------------------------------------------------------
// Figure: the explorer and the ship. One mesh each; its parts (limbs, coat, gear, canopy) are
// moved by a small palette of matrices (attribute aPart), so a whole figure is one draw call.
// The local washes are vertex colours; aMat = (dry brush, wetness, glow: 1 = bare light,
// not modelled by the sun). The wash turbulence is anchored to each part's rest shape, so it
// travels with the limb and never swims.
// ------------------------------------------------------------------------------------------
const FIG_VERT = /* glsl */`
${VERT_PARS}
uniform mat4 uPart[PC_PARTS];
attribute vec3 color;
attribute vec3 aMat;
attribute float aPart;
varying vec3 vObj;
varying vec3 vNO;
varying vec3 vNV;
varying vec3 vView;
varying vec3 vCol;
varying vec3 vMat;
void main() {
  mat4 pm = uPart[int(aPart + 0.5)];
  vec4 mv = modelViewMatrix * (pm * vec4(position, 1.0));
  vNV = normalMatrix * normalize(mat3(pm) * normal);
  vObj = position; vNO = normal; vCol = color; vMat = aMat;
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
  ${VERT_END}
}
`;

const FIG_FRAG = /* glsl */`
${FRAG_PARS}
uniform vec4 uFig;    // wash turbulence scale (1/m), pooling inside the silhouette, dry-stroke scale, region id
varying vec3 vObj;
varying vec3 vNO;
varying vec3 vNV;
varying vec3 vView;
varying vec3 vCol;
varying vec3 vMat;
void main() {
  #include <logdepthbuf_fragment>
  vec3 nV = normalize(vNV);
  if (!gl_FrontFacing) nV = -nV;
  vec4 n1 = texture(uNoise3D, vObj * uFig.x);
  vec4 n2 = texture(uNoise3D, vObj * uFig.x * 3.3 + 0.31);
  // the wash: its pigment load drifts, and pools just inside the edge of the form
  float rim = 1.0 - clamp(dot(nV, normalize(-vView)), 0.0, 1.0);
  float d = 1.0 + (n1.r - 0.5) * 0.75 + (n2.g - 0.5) * 0.35 + uFig.y * smoothstep(0.35, 0.95, rim + (n2.b - 0.5) * 0.25);
  // a few long soft strokes down the form: folds in cloth, runs of weather on a hull
  float fold = texture(uNoise3D, vObj * vec3(2.6, 0.22, 2.6) * uFig.x + 0.17).b;
  d += (smoothstep(0.42, 0.62, fold) - 0.45) * 0.55 * (1.0 - max(vMat.z, 0.0));
  vec3 c = pcWetWash(pcDensity(vCol, d), 0.7);
  // light in soft steps that run into each other inside the form; the shadow side is a glaze
  vec3 sunV = normalize((viewMatrix * vec4(uSunDirW, 0.0)).xyz);
  float x = dot(nV, sunV) * 0.5 + 0.5 + (n1.g - 0.5) * 0.20 + (n2.a - 0.5) * 0.08;
  float lvl = pcLevel(x, 0.085);
  vec3 lit = pcTone(c, lvl);
  #ifdef PC_OIL
  {
    // the figure in strokes: thin streaks that run down the cloth and along the limbs (the figure's own up), each a
    // little lighter or darker, warmer or cooler than the next, with nothing drawn between them; fine, because the
    // figure is what the eye reads first. The chart is the figure's own space, laid along whichever side the form faces.
    // (The overhaul plan's eighth piece: the colour under the streaks carries no grain of its own (the wash's drifting
    // pigment made every streak speckled), only the slow folds; a piece marked dry 1 (a strip of the cloak, models.js)
    // is one flat piece of paint with no streaks; and where the form turns from the eye on the sun's side its edge
    // takes the light: a rim.)
    vec3 fox = dFdx(vObj), foy = dFdy(vObj);
    vec3 fna = abs(normalize(vNO));
    vec2 fch, fdx, fdy;
    if (fna.x >= fna.z) { fch = vObj.yz; fdx = fox.yz; fdy = foy.yz; } else { fch = vObj.yx; fdx = fox.yx; fdy = foy.yx; }
    vec2 foc = pcStrokeOct(length(vView) * 0.8, 0.006);
    vec3 fr1, fr2; vec2 fds; float fown;
    pcThinLayer(fch, fdx, fdy, foc.x, 5.0, vObj, 40.0, 2.0, fr1, fds, fown, fr2);
    vec3 co = pcWetWash(pcDensity(vCol, 1.0 + (smoothstep(0.42, 0.62, fold) - 0.45) * 0.30 * (1.0 - max(vMat.z, 0.0))), 0.7);
    float sunF = dot(nV, sunV);
    float lvo = pcLevel(sunF * 0.5 + 0.5, 0.05) + 0.9 * smoothstep(0.50, 0.85, rim) * smoothstep(0.0, 0.5, sunF) * uDayness;
    // (the light in flat steps, half a tone each, with clean edges between them: a limb shaded smoothly from light to
    // dark was a rendered cylinder, the one soft gradient on the figure)
    lvo = floor(lvo * 2.0 + 0.5) * 0.5;
    vec3 t1 = pcTone(pcDabTint(co, fr1, 0.0), lvo + (fr1.z - 0.5) * 0.5), t2 = pcTone(pcDabTint(co, fr2, 0.0), lvo + (fr2.z - 0.5) * 0.5);
    lit = vMat.x > 0.985 ? pcTone(co, lvo) : mix(t2, t1, fown);
    // (the lantern's light on the figure itself, by night: the side toward the lantern is warm, in two flat steps)
    if (uLampV.w > 0.01) {
      vec3 toL = uLampV.xyz - vView;
      float dl = length(toL), fl = uLampV.w * (1.0 - smoothstep(0.25, 1.5, dl)) * smoothstep(-0.1, 0.5, dot(nV, toL / max(dl, 1e-3)));
      vec3 warmF = min(pcDensity(vCol, 1.1) * vec3(1.45, 0.92, 0.50) + vec3(0.12, 0.05, 0.0), vec3(1.0));
      lit = fl > 0.55 ? warmF : fl > 0.22 ? mix(lit, warmF, 0.5) : lit;
    }
  }
  #else
  // dry brush: the loaded brush skips on the lit side and paper sparkles through
  vec4 st = pcTri(vObj * uFig.z, normalize(vNO), 0.5);
  float dryM = smoothstep(0.56, 0.70, st.r * 0.8 + st.b * 0.3) * smoothstep(0.45, 0.60, n2.r);
  lit = mix(lit, vec3(1.0), dryM * vMat.x * 0.16 * clamp(lvl - 1.0, 0.0, 1.5));
  #endif
  // (aMat.z: 0..1 a light of its own, a flame or a lantern, not modelled by the sun; below 0: glass that is lit from
  // within when the light goes: a cabin lamp, warm paper with a touch of quinacridone gold, the one warm thing in a night)
  float lampN = max(-vMat.z, 0.0) * (1.0 - uDayness);
  float glowK = max(vMat.z, 0.0);
  c = mix(lit, vCol, glowK);
  vec3 cabin = mix(vec3(1.0, 0.90, 0.62), vec3(1.0, 0.97, 0.84), smoothstep(0.35, 0.75, n1.b + (n2.r - 0.5) * 0.4));
  c = mix(c, cabin, lampN * (0.80 + 0.20 * n1.r));
  float f = pcFogAmount(length(vView));
  c = pcAtmosV(c, f, vView);
  pcWrite(c, max(vMat.y, f * 0.8), nV, -vView.z, max(glowK, lampN) > 0.5 ? 8.0 : uFig.w);
}
`;

// makeFigureMaterial({ parts, scale, pooling, stroke, id }) -> ShaderMaterial; its
// uniforms.uPart.value is an array of `parts` Matrix4 (identity until the model's rig fills it).
export function makeFigureMaterial(opts = {}) {
  const n = Math.max(1, opts.parts | 0 || 1);
  const mats = [];
  for (let i = 0; i < n; i++) mats.push(new THREE.Matrix4());
  const m = new THREE.ShaderMaterial({
    name: 'pc-figure',
    defines: { PC_PARTS: n },
    uniforms: baseUniforms(opts.bodyUniforms, {
      uPart: { value: mats },
      uFig: { value: new THREE.Vector4(1 / (opts.scale || 0.6), opts.pooling == null ? 0.5 : opts.pooling, opts.stroke || 2.0, opts.id == null ? 5.0 : opts.id) },
    }),
    vertexShader: FIG_VERT, fragmentShader: FIG_FRAG,
    side: opts.side == null ? THREE.FrontSide : opts.side,
  });
  m.userData.pcPainted = true;
  return register(m, 'figure', opts);
}

// ------------------------------------------------------------------------------------------
// The near ground: one instanced layer of brush strokes round the eye (src/world/nearground.js):
// grass blades, reed stubble, frost needles, pebbles, drift ripples. Each stroke is a tapering
// flick that faces the picture plane about its own axis, takes the light of the ground it
// stands on, is bent blade by blade by PHYSICS' push field, shrinks away at the end of its
// range (far strokes are fewer) and is never thinner than the brush can hold.
// ------------------------------------------------------------------------------------------
const NEAR_VERT = /* glsl */`
${VERT_PARS}
${FOG_VERT}
${FLORA_GLSL}
uniform float uPhysOn;
attribute vec3 iRoot;   // root relative to uOrigin (body-local metres)
attribute vec4 iAxis;   // xyz the way the stroke grows (unit), w its length (0 = an empty slot)
attribute vec4 iPar;    // x width (m), y kind (under 1.5: a plain stroke, its width at half length; 2 a grass flick, 3 a flick left crisp, 4 a fan-brush touch, 5 a round touch facing the eye, 6 a touch laid flat; +0.25 left crisp), z hash, w born (s)
attribute vec4 iCol;    // wash; a: curl of the tip (share of the length); a round touch: how high it is held (m); a flat one: its turn (radians)
attribute vec2 iExt;    // x canopy shade at the root, y how much it gives to a push (0 rigid .. 1 grass)
uniform vec3 uOrigin;
uniform vec3 uCamLocal;
uniform vec4 uNear;     // x full density out to here (m), y nothing beyond here, z now (s), w one pixel at 1 m (tangent)
uniform vec4 uNear2;    // x, y the ring fades in between these distances (m), z how soft its marks are left
uniform float uTime;
uniform vec4 uWx;
varying vec3 vBody;
varying vec3 vNV;
varying vec3 vView;
varying vec3 vCol;
varying vec4 vS;        // x along the stroke 0..1, y across -1..1, z hash, w canopy
varying float vFog;
varying float vFlat;
varying float vAcc;
varying float vLoad;
varying float vKind;
void main() {
  float t = position.y, side = position.x, h = iPar.z, kind = iPar.y;
  bool flick = kind > 1.5 && kind < 3.5;
  bool broad = kind > 3.5;
  bool fan = broad && kind < 4.5;
  bool lying = kind > 5.5;
  bool dab = broad && !fan && !lying;
  vKind = kind;
  vLoad = flick ? 0.4 : (broad ? 0.6 : 1.0);
  vAcc = flick ? kind - 2.0 : (broad ? step(0.1, fract(kind)) : step(fract(h * 13.7), 0.5));
  vec3 root = iRoot;
  vec3 toCam = uCamLocal - root;
  float di = length(toCam);
  // every stroke has its own range (so the sward thins with distance) and grows in after it is laid
  float range = mix(uNear.x, uNear.y, fract(h * 7.31));
  float vis = (1.0 - smoothstep(range * 0.72, range, di)) * smoothstep(0.0, 0.7, uNear.z - iPar.w) * smoothstep(uNear2.x, uNear2.y, di);
  float flex = iExt.y;
  // fresh snow buries what is short: no stroke stands on a snowfield but the tall stubble
  float snowK = 1.0 - smoothstep(0.12, 0.50, uWx.z) * (1.0 - 0.30 * smoothstep(0.62, 0.95, iAxis.w));
  if (broad) vis *= kind > 4.5 ? step(0.5, snowK) * snowK : snowK;        // (what lies on the ground is under the snow altogether)
  float len = iAxis.w * vis * (broad ? 1.0 : snowK);
  vec3 ax = iAxis.xyz;
  vec3 up = normalize(root + uOrigin);
  // what has pushed through here: a blade leans with the load, and where it was trodden or
  // blown flat it lies over the way it already leaned, and stays down for a while
  vec4 pb = vec4(0.0);
  if (flex > 0.01 && uPhysOn > 0.5) {
    pb = pcPhysBend(root + uOrigin, 0.0);
    float fl = clamp(pb.z, 0.0, 1.0) * flex;
    vec3 axh = ax - up * dot(ax, up);
    ax = normalize(mix(ax, axh / max(length(axh), 0.05) + up * 0.16, fl * 0.92));
    vFlat = fl;
  } else vFlat = 0.0;
  vec3 sd = cross(ax, toCam / max(di, 0.001));
  sd /= max(length(sd), 0.05);
  float wPx = uNear.w * di;                                       // metres across one pixel here
  vec3 rel;
  float grow = min(1.0, vis * 3.0);
  if (broad) {
    t = min(1.0, t * 2.0);                                        // (the whole quad; the tip triangle closes to nothing)
    if (lying) {
      // laid on the ground's own plane, turned as it fell
      vec3 t1 = normalize(cross(ax, vec3(0.3126, 0.8271, 0.4671)));
      vec3 t2 = cross(ax, t1);
      vec3 da = t1 * cos(iCol.a) + t2 * sin(iCol.a), db = cross(ax, da);
      rel = da * (max(len, wPx * 1.2 * grow) * (t * 2.0 - 1.0)) + db * (side * max(iPar.x, wPx * 0.9) * grow);
    } else if (dab) {
      rel = ax * (iCol.a * (len / max(iAxis.w, 1e-4)) + max(len, wPx * 1.3 * grow) * t) + sd * (side * max(iPar.x, wPx * 1.3) * grow);
    } else {
      // a fan-brush touch: broad at the foot, spreading a little, its top cut into blades by the fragment shader
      rel = ax * (len * t) + sd * (side * iPar.x * (1.0 + 0.4 * t) * grow + iCol.a * len * t * t);
    }
  } else {
    // (close to the eye a blade is as slender as a blade is; farther off it is as broad as the brush must be)
    // (a flick is narrow where the brush touched down, full a third of the way up, and runs out
    // to a point: a lancet, not a tooth)
    float prof = flick ? (t < 0.25 ? 0.40 : (t < 0.75 ? 1.0 : 0.0)) : (t < 0.25 ? 1.0 : (t < 0.75 ? iPar.y : 0.0));
    float wid = max(iPar.x * mix(0.42, 1.0, smoothstep(2.0, 7.5, di)), wPx * (flick ? 1.7 : 2.3)) * prof * (1.0 + 0.25 * vFlat);
    if (flick && t > 0.25 && t < 0.75) t = 0.34;
    rel = ax * (len * t) + sd * (side * wid * grow + iCol.a * len * t * t);
  }
  if (flex > 0.01 && len > 0.0 && !lying) {
    if (uPhysOn > 0.5) {
      rel = mix(rel, pcPhysDisplace(rel, up, max(iAxis.w + (dab ? iCol.a : 0.0), 0.05), pb.xy * (1.0 - vFlat)), flex);
    } else {
      float tt = dab ? 1.0 : t;
      rel += sd * (sin(uTime * 1.3 + h * 40.0) * 0.05 * (dab ? iCol.a : len) * tt * tt * flex);
    }
  }
  vec3 wp = root + rel;
  vBody = wp + uOrigin;
  vNV = normalMatrix * normalize(mix(up, ax, 0.35));
  vec4 mv = modelViewMatrix * vec4(wp, 1.0);
  vView = mv.xyz;
  vCol = iCol.rgb; vS = vec4(t, side, h, iExt.x);
  vFog = pcFogAmountV(di * pcFogBank(vBody));      // (PAINTER 19: a thick fog lies in banks)
  gl_Position = projectionMatrix * mv;
  ${VERT_END}
}
`;

const NEAR_FRAG = /* glsl */`
${FRAG_PARS}
uniform vec4 uNear2;
varying vec3 vBody;
varying vec3 vNV;
varying vec3 vView;
varying vec3 vCol;
varying vec4 vS;
varying float vFog;
varying float vFlat;
varying float vAcc;
varying float vLoad;
varying float vKind;
void main() {
  #include <logdepthbuf_fragment>
  pcFp = pcFootprint(vBody);      // (R1 W2.1, chunks.js)
  #ifdef PC_OIL
    // (the clip's floor is a carpet of leaves with a tuft here and there, not a sward: most of the near strokes are not laid)
    if (fract(vS.z * 13.37 + 0.11) > uOilG.x * uGroundK.y) discard;
  #endif
  vec4 n1 = texture(uNoise3D, vBody / 2.9 + 0.11);
  // the loaded brush: pigment pools where the stroke starts, the tip is drier and breaks
  vec4 n2 = texture(uNoise3D, vBody * vec3(7.0, 2.0, 7.0) + vS.z * 3.0);
  if (vKind > 4.5) {
    // a round touch: the brush pressed down once, its edge a little ragged
    // (seen close it must not be a disc: the outline is lobed by the hairs of the brush, each touch its own way,
    // and toward the edge the brush has run dry and the paper shows in flecks)
    vec2 q = vec2(vS.y, vS.x * 2.0 - 1.0);
    float qa = atan(q.y, abs(q.x) + abs(q.y) > 0.0 ? q.x : 1.0), qs = vS.z * 6.283, qr = dot(q, q);
    float lim = 0.64 + 0.17 * sin(qa * 3.0 + qs) + 0.11 * sin(qa * 5.0 - qs * 1.7) + 0.08 * sin(qa * 8.0 + qs * 2.3) + 0.24 * n2.g;
    if (qr > lim) discard;
    if (qr > lim * 0.40 && texture(uNoise3D, vec3(q * 2.1, vS.z * 7.0)).r > 0.86 - 0.34 * (qr / lim)) discard;
  } else {
    if (vKind > 3.5) {
      // a fan brush: a handful of blades of unequal height from one foot, lower at the sides
      // (two combs of different pitch, so no two touches are cut alike and none is a crown)
      float u = vS.y * 0.5 + 0.5, hz = vS.z;
      float nb = 5.0 + floor(fract(hz * 5.37) * 5.0);
      float b1 = u * nb + hz * 7.0 + 0.4 * sin(u * 9.0 + hz * 30.0), b2 = u * nb * 0.37 + hz * 3.0;
      float h1 = 0.30 + 0.70 * fract(sin(floor(b1) * 12.9898 + hz * 78.233) * 43758.5453);
      float h2 = 0.55 + 0.45 * fract(sin(floor(b2) * 39.3468 + hz * 11.135) * 24634.6345);
      // (the lower part is one body of wash; only its top is broken into blades)
      float blades = h1 * h2 * pow(max(1.0 - abs(fract(b1 + (n2.b - 0.5) * 0.8) - 0.5) * 2.0, 0.0), 0.45);
      float top = mix(0.40, 1.0, blades) * (1.0 - 0.66 * vS.y * vS.y) + (n2.g - 0.5) * 0.22;
      if (vS.x > top) discard;
    }
    if (vS.x > 0.5 && n2.r > 1.18 - vS.x * 0.62) discard;
  }
  // (a flick carries little more pigment than the ground it stands on: a loaded, crisp, wet
  // mark pooled by the sheet as well was a black comma)
  float d = 1.0 + (0.55 - vS.x) * (vKind > 4.5 && vKind < 5.5 ? 1.5 : 0.7) * vLoad + (vS.z - 0.5) * 0.5 * vLoad + (n1.r - 0.5) * 0.5;
  vec3 c = pcWetWash(pcDensity(vCol, d), mix(1.0, 0.4, 1.0 - vLoad));
  c = mix(c, vec3(1.0), max(uWx.z * smoothstep(0.35, 0.9, vS.x) * 0.8, vFlat * 0.16));     // snow on the tips; trodden grass shows its pale side
  vec3 nV = normalize(vNV);
  vec3 sunV = normalize((viewMatrix * vec4(uSunDirW, 0.0)).xyz);
  float x = dot(nV, sunV) * 0.5 + 0.5;
  float sunny = min(pcDapple(vBody, vS.w), 1.0 - pcCast(vBody, (n1.g - 0.5) * 0.3));
  x = mix(min(x, 0.44), x, sunny) + (n1.g - 0.5) * 0.10;
  float lvl = pcLevel(x, 0.05);
  c = pcTone(c, lvl);
  #ifndef PC_OIL
  c = mix(c, c * vec3(0.84, 0.83, 1.04), (1.0 - sunny) * 0.55);
  #endif
  c = pcAtmosV(c, vFog, vView);
  // the accents are left as the brush drew them; the rest belong to the ground's wash, and
  // the farther rings' touches are softer still
  pcWrite(c, max(max(vAcc > 0.5 ? 0.2 : 0.45, uNear2.z), vFog * 0.9), nV, -vView.z, (vAcc > 0.5 ? 6.0 : 4.0) + vS.z * 0.9);
}
`;

export function makeNearMaterial(bodyU) {
  const m = new THREE.ShaderMaterial({
    name: 'pc-near',
    uniforms: baseUniforms(bodyU, Object.assign({
      uOrigin: { value: new THREE.Vector3() }, uCamLocal: { value: new THREE.Vector3() },
      uNear: { value: new THREE.Vector4(5, 13, 0, 0.002) }, uNear2: { value: new THREE.Vector4(0.8, 2.6, 0, 0) },
    }, PHYS)),
    vertexShader: NEAR_VERT, fragmentShader: NEAR_FRAG,
    side: THREE.DoubleSide,
  });
  m.userData.pcPainted = true;
  return register(m, 'near');
}

// Re-point a material's light uniforms at a body's (so an object standing on a planet is lit
// and hazed like the planet around it).
export function bindBodyUniforms(material, bodyU) {
  if (!material || !material.uniforms || !bodyU) return;
  for (const k of Object.keys(bodyU)) if (material.uniforms[k]) material.uniforms[k] = bodyU[k];
  material.uniformsNeedUpdate = true;
}

// ------------------------------------------------------------------------------------------
// Stand-ins for foreign materials (COORDINATOR C9)
// ------------------------------------------------------------------------------------------
const standIns = new WeakMap();
export function standInFor(object, material) {
  let s = standIns.get(material);
  if (s) return s;
  const color = material.color ? material.color : new THREE.Color(0xb9b3a8);
  const c = color.clone();
  if (material.transparent && material.opacity < 1) c.lerp(new THREE.Color(1, 1, 1), 1 - material.opacity);
  const o = { color: c, side: material.side, vertexColors: !!material.vertexColors && !!(object.geometry && object.geometry.attributes.color) };
  if (object.isPoints) { o.points = true; o.pointSize = Math.max(2, (material.size || 1) * 2); }
  else if (object.isLine) o.unlit = true;
  else if (object.isSprite) { o.sprite = true; o.side = THREE.DoubleSide; if (material.map) o.map = material.map; }
  else if (!object.geometry || !object.geometry.attributes.normal) o.unlit = true;
  if (material.isMeshBasicMaterial) o.flat = true;
  s = makeWashMaterial(o);
  standIns.set(material, s);
  return s;
}
