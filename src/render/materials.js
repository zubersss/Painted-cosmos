// Painted Cosmos: painted scene materials. OWNER: PAINTER.
// The watercolor look starts here, in the materials: washes with pigment-density turbulence,
// value-stepped light, cool glaze shadows, dry-brush sparkle, banded aerial perspective. The
// post passes (post.js) then treat the result as wet paint on paper.
import * as THREE from 'three';
import { G, PHYS, PHYSW, ensureGlobals, makeBodyUniforms } from './shared.js';
import { FLORA_GLSL } from '../physics/flora.glsl.js';
import { WATER_GLSL } from '../physics/water.js';
import { VERT_PARS, VERT_END, FRAG_PARS } from './chunks.js';

const FOG_VERT = /* glsl */`
uniform vec4 uFog;
float pcFogAmountV(float dist) {
  float f = 1.0 - exp(-dist * uFog.x);
  float q = f * uFog.y;
  float fl = floor(q);
  f = (fl + smoothstep(0.15, 0.85, q - fl)) / uFog.y;
  return clamp(f * uFog.z, 0.0, 1.0);
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
    uTime: G.uTime, uNoise3D: G.uNoise3D, uStrokeTex: G.uStrokeTex, uCast: G.uCast, uCastK: G.uCastK,
    uSunDirW: b.uSunDirW, uSunDirL: b.uSunDirL, uGlaze: b.uGlaze, uLight: b.uLight, uHaze: b.uHaze,
    uFog: b.uFog, uDayness: b.uDayness, uStorm: b.uStorm, uHueA: b.uHueA, uHueB: b.uHueB, uBodyR: b.uBodyR, uWx: b.uWx,
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
uniform vec3 uOrigin;     // patch origin, body-local metres
uniform vec3 uAnchor;     // patch origin modulo the stroke tile period
uniform vec3 uCamLocal;   // camera relative to the patch origin, body-local axes
uniform vec2 uMorph;      // distance range over which this level morphs to its parent
varying vec3 vBody;
varying vec3 vAnch;
varying vec3 vNV;
varying vec3 vNL;
varying vec3 vView;
varying vec4 vCol;
varying vec3 vCol2;
varying vec4 vPar;
varying vec3 vUpV;
void main() {
  float d = distance(position, uCamLocal);
  float m = clamp((d - uMorph.x) / (uMorph.y - uMorph.x), 0.0, 1.0);
  vec3 p = position + aMorph * m;
  vBody = p + uOrigin;
  vAnch = p + uAnchor;
  vNL = normal;
  vNV = normalMatrix * normal;
  vUpV = normalMatrix * normalize(vBody);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vView = mv.xyz;
  vCol = aColor; vCol2 = aColor2.rgb; vPar = aParams;
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
void main() {
  #include <logdepthbuf_fragment>
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

  // far away the forest floor reads as its canopy: one broad soft wash
  vec3 c = mix(vCol2, vCol.rgb, mid);

  // wash turbulence: the pigment load drifts, so no area is flat colour
  float d = 1.0 + (n1.r - 0.5) * 0.75 + (n2.g - 0.5) * 0.40 * near;
  // broken colour: darker touches of the brush inside the wash
  // (soft-edged and of uneven size: touches laid into a damp wash, not a pattern of dots)
  float dab = mix(smoothstep(0.50, 0.66, ma.r * 0.72 + ma.a * 0.28), smoothstep(0.50, 0.66, mb.r * 0.72 + mb.a * 0.28), lf) * markFade;
  d += dab * 0.30 * (1.0 - vPar.x * 0.5);
  // small crisp marks: grass, twigs, grit, laid with the tip of the brush
  float flick = mix(smoothstep(0.668, 0.70, fa.g * 0.72 + ma.b * 0.28), smoothstep(0.668, 0.70, fb.g * 0.72 + mb.b * 0.28), lf) * markFade;
  d += flick * 0.50 * (0.25 + 1.25 * vPar.x) * smoothstep(1.5, 7.0, dist);    // grit shows on rough ground, hardly at all on smooth sand or ice
  // neighbouring pigments run into each other: drifts of green and of warm earth
  vec3 hueA = c * uHueA;
  vec3 hueB = c * uHueB;
  c = mix(c, hueA, smoothstep(0.50, 0.72, n1.b) * 0.8);
  c = mix(c, hueB, smoothstep(0.52, 0.74, n2.r) * 0.6 * mid);

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
    float fine = 1.0 - smoothstep(w1 * 0.35, w1, a1);
    fine *= smoothstep(0.36, 0.50, n2.b + (n1.g - 0.5) * 0.7);
    vec3 wp2 = vAnch + (n1.rgb - 0.5) * 11.0 + (n2.rgb - 0.5) * 2.0;
    float a2 = pcTri8(wp2, nL, 1.0 / 64.0).a;
    float big = 1.0 - smoothstep(0.012, 0.045 + 0.05 * n2.r, a2);
    big *= smoothstep(0.30, 0.46, n1.g + (n2.b - 0.5) * 0.5);
    float crack = max(fine * near * 0.75, big * mix(0.55, 1.0, near) * mid);
    if (vPar.w > 0.0) c = pcDensity(c, 1.0 + crack * vPar.w * 2.2 * (1.0 - snowC * 0.8));
    else c = mix(c, mix(vec3(0.98, 0.52, 0.20), vec3(1.0, 0.86, 0.50), fine * near), clamp(crack * -vPar.w * 1.5, 0.0, 0.92));
  }

  // light in soft value steps; shadows are glazes
  vec3 sunV = normalize((viewMatrix * vec4(uSunDirW, 0.0)).xyz);
  float x = dot(nV, sunV) * 0.5 + 0.5;
  if (near > 0.0) sunny = min(sunny, 1.0 - pcCast(vBody, (ma.g - 0.5) * 0.34 + (n2.b - 0.5) * 0.16));
  x = mix(min(x, 0.44) - (1.0 - smoothstep(0.30, 0.50, n1.g)) * 0.22 * vPar.z, x, sunny);
  x += (n1.g - 0.5) * 0.10 + (mix(fa.b, fb.b, lf) - 0.5) * 0.06 * near;
  float lvl = pcLevel(x, 0.045);
  c = pcTone(c, lvl);
  c = mix(c, c * vec3(0.84, 0.83, 1.04), (1.0 - sunny) * 0.55);

  // dry brush on rough ground: the brush skips, paper sparkles through in small broken flecks
  float dryM = mix(smoothstep(0.60, 0.69, fa.b * 0.62 + fa.r * 0.38), smoothstep(0.60, 0.69, fb.b * 0.62 + fb.r * 0.38), lf);
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

  float f = pcFogAmount(dist);
  c = pcAtmos(c, f);
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
`;

export function makeTerrainMaterial(bodyU) {
  const m = new THREE.ShaderMaterial({
    name: 'pc-terrain',
    uniforms: baseUniforms(bodyU, {
      uOrigin: { value: new THREE.Vector3() }, uAnchor: { value: new THREE.Vector3() },
      uCamLocal: { value: new THREE.Vector3() }, uMorph: { value: new THREE.Vector2(1e8, 2e8) },
    }),
    vertexShader: TERRAIN_VERT, fragmentShader: TERRAIN_FRAG,
  });
  m.userData.pcPainted = true;
  return m;
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
  // the mesh carries the waves only where it is fine enough for them (the rest is painted),
  // and they die away at the waterline, so the shore does not crawl
  float lam = 6.2831853 / max(uPhysWaterK.x, 1e-3);
  float carry = 1.0 - smoothstep(2.2 * lam * uWaveLod, 6.0 * lam * uWaveLod, distance(p, uCamLocal));
  float shoal = smoothstep(0.0, 1.0, aDepth / max(uPhysWaterSea.x * 1.3, 0.05));
  p += normalize(vBody) * ((w.x + vWake.x) * carry * shoal);
  vBody = p + uOrigin;
  vToCam = uCamLocal - p;
  vDepth = aDepth;
  vLiq = aLiq; vLiqP = aLiqP.xy;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
  ${VERT_END}
}
`;

const WATER_FRAG = /* glsl */`
${FRAG_PARS}
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
    float sd = exp2(texture(uPrevTex, q).a) - 1.0;
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
  if (vDepth < 0.0) discard;
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
  float hs = max(uPhysWaterSea.x, 1e-4);
  float keep = 1.0 - smoothstep(0.22, 0.75, fwidth(wv.x) / hs);
  wv *= keep;
  float wavy = smoothstep(0.04, 0.35, uPhysWaterSea.x) * keep;      // 0 on a pond, 1 on a sea that is running
  float hN = clamp(wv.x / hs, -1.5, 1.5) * wavy;                    // -1 in the troughs .. 1 on the crests
  vec2 cf = pcPhysWaterCrest(wv);
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
  float rough = smoothstep(0.08, 0.9, uPhysWaterSea.x) * (1.0 - vLiqP.y) * (1.0 - vLiqP.x);
  c = mix(c, refl, hit.z * uPrevOn * (1.0 - 0.85 * rough));
  // the liquid's own wash: water takes a little of it and deepens the mirror; matte liquids
  // (lava, acid, a sea of cloud) are mostly their own colour
  float mirror = vLiq.a;
  vec3 own = pcDensity(vLiq.rgb, 1.0 + (r3.g - 0.5) * 1.3 + (r1.r - 0.5) * 0.6 - hN * 0.55);   // pigment gathers in the troughs
  // lava: paper-bright where it runs hot, dark crust drifting on it
  vec4 r4 = texture(uNoise3D, vBody / 9.0 + drift * 0.4);
  // (scarlet by the banks where it cools, cadmium orange in the stream, paper-yellow only where it
  // runs deep and hot; the plates of crust gather by the banks: a crust forms on lava, not on a glowing pool)
  float hotD = smoothstep(0.30, 1.20, vDepth + (r2.g - 0.5) * 0.5);
  own = mix(own, vec3(0.88, 0.25, 0.13), vLiqP.x * (1.0 - hotD) * 0.7);
  own = mix(own, vec3(1.0, 0.94, 0.64), vLiqP.x * hotD * smoothstep(0.40, 0.70, r4.r) * 0.92);
  own = mix(own, vec3(0.21, 0.16, 0.20), smoothstep(0.75, 1.0, vLiqP.x) * smoothstep(0.58 - 0.20 * (1.0 - hotD), 0.70 - 0.18 * (1.0 - hotD), r4.g + (r2.b - 0.5) * 0.3));
  // cloud sea: bare-paper billows with soft shaded hollows
  vec4 r5 = texture(uNoise3D, vBody / 47.0 + drift * 0.2);
  own = mix(own, vec3(1.0), vLiqP.y * smoothstep(0.42, 0.66, r5.r * 0.7 + r3.b * 0.3));
  own = mix(own, own * uGlaze, vLiqP.y * (1.0 - smoothstep(0.30, 0.52, r5.g)) * 0.6);
  own = mix(own, own * uGlaze, vLiqP.y * smoothstep(0.1, -0.9, hN) * 0.5);      // the hollows of a rolling cloud sea
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
  float shallow = 1.0 - smoothstep(0.02, 0.42, vDepth);
  vec3 bed = pcDensity(uBed, 1.0 + (r3.b - 0.5) * 0.8);
  c = mix(c, bed * mix(vec3(1.0), c, 0.45), clamp((1.0 - fres) * 0.42 + shallow * 0.7, 0.0, 0.9) * (1.0 - vLiqP.y) * (1.0 - vLiqP.x * 0.8));
  // pigment pools at the water's edge
  c = pcDensity(c, 1.0 + (1.0 - smoothstep(0.0, 0.09, vDepth)) * 0.35);
  // bare-paper glints: broken dashes where ripples catch the light
  float glint = smoothstep(0.715, 0.76, r2.r * 0.62 + r1.b * 0.38) * smoothstep(0.04, 0.2, vDepth) * uDayness;
  glint *= (1.0 - smoothstep(40.0, 120.0, dist)) * (1.0 - vLiqP.y) * (1.0 - 0.7 * wavy);
  // the sea running: bare paper along the tops of the higher waves, in broken dashes that lie
  // the way the crests lie; whitecaps where it breaks, ragged; surf where it shoals at a shore
  float liq = (1.0 - vLiqP.y) * (1.0 - vLiqP.x);
  float deep = smoothstep(0.04, 0.3, vDepth);
  vec4 r6 = texture(uNoise3D, vBody / 0.62 + drift * 3.0);
  float torn = r6.r * 0.55 + r2.g * 0.45;
  // (the crest line itself: high water where the slope along the waves' way turns over)
  float sAlong = abs(dot(wv.yz, uPhysWaterDir));
  float crest = smoothstep(0.25, 0.70, hN) * (1.0 - smoothstep(0.07, 0.24, sAlong)) * smoothstep(0.36, 0.50, torn) * (0.35 + 0.65 * uDayness);
  // (a whitecap is not a white sheet: torn dabs of paper on the front of the crest, with the
  // sea's own wash showing between them)
  float foam = cf.y * smoothstep(0.40, 0.90, hN) * smoothstep(0.44, 0.58, torn) * keep;
  // far off: the same share of white, as a few anchored dabs
  float capFar = uPhysWaterSea.y < 1.0e8 ? smoothstep(0.02, 0.12, uPhysWaterSea.w) : 0.0;
  float capTh = 0.70 - 0.55 * uPhysWaterSea.w;
  foam = max(foam, capFar * (1.0 - keep) * smoothstep(capTh, capTh + 0.05, r3.r * 0.6 + r1.g * 0.4) * (1.0 - smoothstep(500.0, 1500.0, dist)));
  // (in the shallows the breaking crests are white, ragged lines; at the waterline a thin
  // broken edge of swash that can still be seen from far off)
  float sz = pcPhysWaterSurf(vDepth);
  float surf = sz * sz * smoothstep(0.50, 0.85, hN + (r2.b - 0.5) * 0.7 + (r6.g - 0.5) * 0.5);
  float swash = (1.0 - smoothstep(0.03, 0.05 + 0.22 * hs, vDepth)) * smoothstep(0.04, 0.3, uPhysWaterSea.x);
  surf = max(surf, swash * smoothstep(0.40, 0.60, r2.g * 0.6 + r1.b * 0.4 + 0.25 * hN));
  // far off, where the waves are finer than the brush can hold: the swell as a painter lays it,
  // long broken strokes lying the way the crests lie (anchored to the planet), the hollow before
  // each one darker, and on a sea that is breaking a white horse here and there along them
  float farWhite = 0.0;
  // (seen across the water a swell 20 m long is a hair's breadth on the sheet: the strokes are
  // spaced by what the brush can hold there, a dozen pixels, in octaves that give way to one
  // another with distance, each one fixed to the planet)
  vec3 D3 = normalize(pcPhysWaterDir(uPhysWaterDir));
  vec3 A3 = normalize(cross(up, D3));
  float qd = dot(vBody, D3);
  float lk = max(0.0, log2(max(13.0 * fwidth(qd), 1.0e-3) / 8.5) / 1.3785);
  // (far: where a pixel is wider than the brush can draw a wave in, a metre or two of sea)
  float farSea = smoothstep(0.35, 1.6, fwidth(qd) + fwidth(dot(vBody, A3))) * smoothstep(0.03, 0.22, uPhysWaterSea.x) * liq * deep;
  if (farSea > 0.01) {
    float k0 = floor(lk), kf = lk - k0, capTh2 = 0.68 - 0.45 * uPhysWaterSea.w;
    float sw = 0.0, wh = 0.0, hol = 0.0;
    for (int i = 0; i < 2; i++) {
      float L = 8.5 * pow(2.6, k0 + float(i)), wgt = i == 0 ? 1.0 - kf : kf;
      float q = qd / L + (texture(uNoise3D, vBody / (L * 6.0) + 0.3).r - 0.5) * 1.6;
      float id = floor(q), s = fract(q);
      float br = texture(uNoise3D, vec3(dot(vBody, A3) / (L * 4.0), id * 0.371, id * 0.117)).r;
      float ln = smoothstep(0.70, 0.82, s) * (1.0 - smoothstep(0.92, 1.0, s));
      sw += wgt * ln * smoothstep(0.40, 0.54, br);
      wh += wgt * smoothstep(0.80, 0.88, s) * (1.0 - smoothstep(0.93, 1.0, s)) * smoothstep(capTh2, capTh2 + 0.05, br);
      hol += wgt * smoothstep(0.28, 0.52, s) * (1.0 - smoothstep(0.66, 0.76, s)) * smoothstep(0.35, 0.60, br);
    }
    c = pcDensity(c, 1.0 + farSea * (hol * 0.75 - sw * 0.25));
    c = mix(c, skyc, farSea * sw * 0.50);
    farWhite = farSea * wh * capFar * (0.35 + 0.65 * uDayness) * (1.0 - smoothstep(900.0, 2200.0, dist));
  }
  float white = max(max(max(crest * 0.85, foam) * deep, surf * smoothstep(0.0, 0.03, vDepth)) * liq, farWhite);
  glint = max(glint, white);
  c = mix(c, vec3(1.0), glint);
  // (a sea running high keeps its body under the murk: in a gale the air is thick enough to
  // swallow the far water whole, strokes and all, and a storm sea painted as a pale blank is
  // no sea; the painter keeps it darker than the sky to the horizon and lets the stacks go pale)
  // (and what glows is seen through the haze: lava keeps its fire into the distance)
  float f = pcFogAmount(dist) * (1.0 - 0.45 * farSea) * (1.0 - 0.6 * vLiqP.x);
  c = pcAtmos(c, f);
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
    vertexShader: WATER_VERT, fragmentShader: WATER_FRAG,
  });
  m.userData.pcPainted = true;
  return m;
}

// ------------------------------------------------------------------------------------------
// Props: trees, undergrowth, rocks. One shader, instanced, parts selected per vertex.
//   aData.y part: 0 bark, 1 foliage mass, 2 blade / frond, 3 accent dab, 4 rock
// ------------------------------------------------------------------------------------------
const PROP_VERT = /* glsl */`
${VERT_PARS}
${FOG_VERT}
attribute vec4 aData;     // x sway, y part, z inner shade, w blob hash
attribute vec3 aMass;     // soft "mass" normal of the whole crown
attribute vec4 aInst;     // per instance: x hue, y value, z seed, w canopy shade at its foot
#ifdef PC_FAR
  attribute vec2 aInst2;  // species index into the far tables
  varying float vSpecies;
  uniform float uFarTaper[8];
  uniform float uFarTrunk[8];
  uniform float uFarDrop[8];
#endif
uniform vec3 uOrigin;
uniform vec3 uCamLocal;
uniform vec4 uLod;        // min distance, max distance, jitter, fade start fraction
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
varying float vFog;

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
  #else
    mat4 im = mat4(1.0);
    vec4 inst = vec4(0.0, 0.0, 0.5, 0.7);
  #endif
  vec3 io = im[3].xyz;
  float di = distance(io, uCamLocal);
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
    lp = mix(lp * mix(uFarTrunk[fsi], 1.0, crown), vec3(lp.x * 1.5, (lp.y - 0.30) * 1.45, lp.z * 1.5), crown * (1.0 - uFarTrunk[fsi]));
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
      #ifdef PC_PHYS_FULL
        vec2 bend = pcPhysBend(rootB, uStiff).xy;
      #else
        vec2 bend = pcPhysBendLite(rootB, uStiff);
      #endif
      wp = io + pcPhysDisplace(wp - io, normalize(rootB), uPlantHeight * length(im[1].xyz), bend);
      #endif
    }
    wp = io + (wp - io) * vis;
  #else
    vec3 wp = (im * vec4((lp + sw) * vis, 1.0)).xyz;
  #endif
  vBody = wp + uOrigin;
  vObj = position;
  mat3 ir = mat3(im);
  vNV = normalMatrix * (ir * normal);
  #ifdef PC_BLADE_ROOT
    vMassV = normalMatrix * (ir * vec3(aMass.x * 0.4, 1.0, aMass.z * 0.4));
  #else
    vMassV = normalMatrix * (ir * aMass);
  #endif
  vec4 mv = modelViewMatrix * vec4(wp, 1.0);
  vView = mv.xyz;
  vUv = uv; vData = aData; vInst = inst;
  vFog = pcFogAmountV(di);
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
uniform mat3 normalMatrix;
#ifdef PC_FAR
  uniform vec3 uFarA[8];
  uniform vec3 uFarB[8];
  uniform vec3 uFarC[8];
  uniform vec3 uFarBarkA[8];
  uniform vec3 uFarBarkB[8];
  varying float vSpecies;
#endif
varying vec3 vBody;
varying vec3 vObj;
varying vec3 vNV;
varying vec3 vMassV;
varying vec3 vView;
varying vec2 vUv;
varying vec4 vData;
varying vec4 vInst;
varying float vFog;
void main() {
  #include <logdepthbuf_fragment>
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
  vec3 leafA = uLeafA, leafB = uLeafB, leafC = uLeafC, barkA = uBarkA, barkB = uBarkB;
  #ifdef PC_FAR
    int si = int(vSpecies + 0.5);
    leafA = uFarA[si]; leafB = uFarB[si]; leafC = uFarC[si]; barkA = uFarBarkA[si]; barkB = uFarBarkB[si];
  #endif
  vec3 c; float wet = 0.05; float id = 3.0; float x;
  vec3 upV = normalize(normalMatrix * normalize(vBody));   // the planet's up, for snow lying on things

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
    x *= mix(0.55, 1.0, pcDapple(vBody, canopy * 0.8));
    x += (n1.g - 0.5) * 0.12;
    float lvl = pcLevel(x, 0.06);
    // pale bark takes a thinner shadow wash: by day the trunks stay the lights of the picture
    c = mix(pcTone(c, lvl), pcTone(c, max(lvl, 1.0) * 0.5 + 1.0), pale * 0.75 * uDayness);
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
    x *= mix(0.62, 1.0, pcDapple(vBody, canopy * 0.6));
    // each wash of the crown sits at its own value; a few dark touches inside
    x += (vData.w - 0.5) * 0.26 + (n2.g - 0.5) * 0.14 - smoothstep(0.55, 0.8, st.g) * 0.16;
    float lvl = min(pcLevel(x, 0.07), 2.6);
    c = pcTone(c, lvl);
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
    x *= mix(0.42, 1.0, pcDapple(vBody, canopy));
    x += (n1.g - 0.5) * 0.14 + vUv.y * 0.10;
    float lvl = pcLevel(x, 0.06);
    c = pcTone(c, lvl);
    wet = 0.1;
    id = 4.0 + seed * 0.9;
  } else if (part < 3.5) {
    // ---- accent: one soft touch of pure pigment (none on a snowfield)
    if (seed < uWx.z * 1.2) discard;
    c = pcDensity(uAccent, 1.0 + (n1.r - 0.5) * 0.9);
    x = 0.6 * mix(0.6, 1.0, pcDapple(vBody, canopy));
    c = pcTone(c, pcLevel(x + 0.2, 0.08));
    wet = 0.35;
    id = 4.0 + seed * 0.9;
  } else {
    // ---- rock: pale granulating wash, paper on top, pooled dark at the base
    // the silhouette is nibbled and the tones wander: a wash, not a faceted solid
    vec4 nr = texture(uNoise3D, vBody / 2.3 + 0.3);
    float rimR = 1.0 - abs(dot(nV, V));
    if (rimR > 0.92 - 0.20 * smoothstep(0.42, 0.74, nr.r)) discard;
    c = mix(barkA, barkB, clamp(vData.z * 0.8 + (n1.r - 0.5) * 0.5, 0.0, 1.0));
    c = pcWetWash(pcDensity(c, 1.0 + (n1.b - 0.5) * 0.9 + (nr.b - 0.5) * 0.5), 0.8);
    float snowR = pcSnowCover(dot(nV, upV) * 0.5 + 0.5, nr.g * 0.6 + n1.r * 0.4, 0.0);
    c = mix(c, vec3(0.97, 0.98, 1.0), snowR);
    x = dot(nV, sunV) * 0.5 + 0.5;
    x *= mix(0.45, 1.0, pcDapple(vBody, canopy));
    vec4 nf = texture(uNoise3D, vBody / 0.55 + 0.61);
    x += (n1.g - 0.5) * 0.22 + (nr.g - 0.5) * 0.26 + (nf.b - 0.5) * 0.1;
    float lvl = pcLevel(x, 0.12);
    c = pcTone(c, lvl);
    float dryM = smoothstep(0.60, 0.70, nf.b * 0.6 + nf.r * 0.4);
    c = mix(c, vec3(1.0), dryM * 0.5 * near * (0.3 + 0.25 * lvl));
    id = 3.0 + seed * 0.9;
  }
  c = pcAtmos(c, vFog);
  wet = max(max(wet, vFog * 0.85), uWx.w * smoothstep(10.0, 90.0, vd) * 0.9);
  pcWrite(c, wet, nV, -vView.z, id);
}
`;

export function makePropMaterial(bodyU, opts = {}) {
  const v3 = (a, d) => ({ value: new THREE.Vector3().fromArray(a || d) });
  const own = {
    uOrigin: { value: new THREE.Vector3() }, uCamLocal: { value: new THREE.Vector3() },
    uLod: { value: new THREE.Vector4(0, 1e9, 0, 0.9) },
    uWind: { value: opts.wind == null ? 0.06 : opts.wind },
    uBarkA: v3(opts.barkA, [0.95, 0.94, 0.92]), uBarkB: v3(opts.barkB, [0.30, 0.27, 0.27]),
    uBarkP: { value: new THREE.Vector4().fromArray(opts.barkP || [0.62, 0, 1.0, 0.5]) },
    uLeafA: v3(opts.leafA, [0.72, 0.80, 0.36]), uLeafB: v3(opts.leafB, [0.50, 0.68, 0.34]),
    uLeafC: v3(opts.leafC, [0.30, 0.48, 0.40]),
    uLeafP: { value: new THREE.Vector4().fromArray(opts.leafP || [0.8, 0.25, 1.0, 0.45]) },
    uAccent: v3(opts.accent, [0.85, 0.29, 0.17]),
    uCanopy: { value: opts.canopy == null ? 1.0 : opts.canopy },
  };
  const defines = {};
  if (opts.phys) {
    defines.PC_PHYS = 1;
    if (opts.phys === 'full') defines.PC_PHYS_FULL = 1;
    if (opts.bladeRoot) defines.PC_BLADE_ROOT = 1;
    Object.assign(own, PHYS, { uStiff: { value: opts.stiff || 0 }, uPlantHeight: { value: opts.plantHeight || 1 } });
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
  c = pcAtmos(c, f);
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
  return m;
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
  d += (smoothstep(0.42, 0.62, fold) - 0.45) * 0.55 * (1.0 - vMat.z);
  vec3 c = pcWetWash(pcDensity(vCol, d), 0.7);
  // light in soft steps that run into each other inside the form; the shadow side is a glaze
  vec3 sunV = normalize((viewMatrix * vec4(uSunDirW, 0.0)).xyz);
  float x = dot(nV, sunV) * 0.5 + 0.5 + (n1.g - 0.5) * 0.20 + (n2.a - 0.5) * 0.08;
  float lvl = pcLevel(x, 0.085);
  vec3 lit = pcTone(c, lvl);
  // dry brush: the loaded brush skips on the lit side and paper sparkles through
  vec4 st = pcTri(vObj * uFig.z, normalize(vNO), 0.5);
  float dryM = smoothstep(0.56, 0.70, st.r * 0.8 + st.b * 0.3) * smoothstep(0.45, 0.60, n2.r);
  lit = mix(lit, vec3(1.0), dryM * vMat.x * 0.16 * clamp(lvl - 1.0, 0.0, 1.5));
  c = mix(lit, vCol, vMat.z);
  float f = pcFogAmount(length(vView));
  c = pcAtmos(c, f);
  pcWrite(c, max(vMat.y, f * 0.8), nV, -vView.z, uFig.w);
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
  return m;
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
  vFog = pcFogAmountV(di);
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
  vec4 n1 = texture(uNoise3D, vBody / 2.9 + 0.11);
  // the loaded brush: pigment pools where the stroke starts, the tip is drier and breaks
  vec4 n2 = texture(uNoise3D, vBody * vec3(7.0, 2.0, 7.0) + vS.z * 3.0);
  if (vKind > 4.5) {
    // a round touch: the brush pressed down once, its edge a little ragged
    vec2 q = vec2(vS.y, vS.x * 2.0 - 1.0);
    if (dot(q, q) > 0.78 + 0.44 * n2.g) discard;
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
  c = mix(c, c * vec3(0.84, 0.83, 1.04), (1.0 - sunny) * 0.55);
  c = pcAtmos(c, vFog);
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
  return m;
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
