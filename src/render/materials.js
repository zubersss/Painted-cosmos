// Painted Cosmos: painted scene materials. OWNER: PAINTER.
// The watercolor look starts here, in the materials: washes with pigment-density turbulence,
// value-stepped light, cool glaze shadows, dry-brush sparkle, banded aerial perspective. The
// post passes (post.js) then treat the result as wet paint on paper.
import * as THREE from 'three';
import { G, ensureGlobals, makeBodyUniforms } from './shared.js';
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
    uTime: G.uTime, uNoise3D: G.uNoise3D, uStrokeTex: G.uStrokeTex,
    uSunDirW: b.uSunDirW, uSunDirL: b.uSunDirL, uGlaze: b.uGlaze, uLight: b.uLight, uHaze: b.uHaze,
    uFog: b.uFog, uDayness: b.uDayness, uHueA: b.uHueA, uHueB: b.uHueB,
  }, own || {});
}

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
  vec4 st = pcTri(vAnch, nL, 1.0 / 8.0);
  vec4 st2 = pcTri(vAnch, nL, 1.0 / 2.0);

  // far away the forest floor reads as its canopy: one broad soft wash
  vec3 c = mix(vCol2, vCol.rgb, mid);

  // wash turbulence: the pigment load drifts, so no area is flat colour
  float d = 1.0 + (n1.r - 0.5) * 0.75 + (n2.g - 0.5) * 0.40 * near;
  // broken colour: darker brush touches inside the wash
  float dab = smoothstep(0.30, 0.62, st.g + (n2.b - 0.5) * 0.3) * near;
  d += dab * 0.42 * (1.0 - vPar.x * 0.6);
  // short dark strokes: grass, twigs and litter suggested by the side of the brush
  float flick = smoothstep(0.58, 0.68, st2.r * 0.8 + st.b * 0.25) * near;
  d += flick * 0.75;
  // neighbouring pigments run into each other: drifts of green and of warm earth
  vec3 hueA = c * uHueA;
  vec3 hueB = c * uHueB;
  c = mix(c, hueA, smoothstep(0.50, 0.72, n1.b) * 0.8);
  c = mix(c, hueB, smoothstep(0.52, 0.74, n2.r) * 0.6 * mid);
  c = pcDensity(c, d);

  // cracked ground (dried basins, frost polygons, ice shelves): pigment pools in the cracks
  float crack = (1.0 - smoothstep(0.03, 0.11, st.a)) * near + (1.0 - smoothstep(0.02, 0.08, pcTri(vAnch, nL, 1.0 / 32.0).a)) * mid;
  c = pcDensity(c, 1.0 + crack * vPar.w * 2.6);

  // light in soft value steps; shadows are glazes
  vec3 sunV = normalize((viewMatrix * vec4(uSunDirW, 0.0)).xyz);
  float x = dot(nV, sunV) * 0.5 + 0.5;
  float sunny = pcDapple(vBody, vPar.z * mix(0.82, 1.0, mid));
  x = mix(min(x, 0.44) - (1.0 - smoothstep(0.30, 0.50, n1.g)) * 0.22 * vPar.z, x, sunny);
  x += (n1.g - 0.5) * 0.10 + (st.b - 0.5) * 0.06 * near;
  float lvl = pcLevel(x, 0.045);
  c = pcTone(c, lvl);

  // dry brush on rough ground: broken strokes, paper sparkling through
  float dryM = smoothstep(0.50, 0.64, st2.r * 0.75 + st.r * 0.35 + (n2.r - 0.5) * 0.25);
  c = mix(c, vec3(1.0), dryM * vPar.x * near * (0.22 + 0.16 * lvl));

  float f = pcFogAmount(dist);
  c = pcAtmos(c, f);
  // from space the limb of the planet thins into its haze, toward bare paper
  vec3 upV = normalize(vUpV);
  float limb = pow(1.0 - clamp(dot(upV, normalize(-vView)), 0.0, 1.0), 2.5) * uFog.w;
  c = mix(c, mix(uHaze, vec3(1.0), 0.4), limb);
  float wet = max(max(vPar.y, f * 0.9), limb);
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
varying vec3 vBody;
varying vec3 vToCam;
varying vec3 vView;
varying float vDepth;
varying vec4 vLiq;
varying vec2 vLiqP;
void main() {
  vBody = position + uOrigin;
  vToCam = uCamLocal - position;
  vDepth = aDepth;
  vLiq = aLiq; vLiqP = aLiqP.xy;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
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
  vec3 n = normalize(up + (r1.xyz - 0.5) * 0.13 + (r2.xyz - 0.5) * 0.06);
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
  c = mix(c, refl, hit.z * uPrevOn);
  // the liquid's own wash: water takes a little of it and deepens the mirror; matte liquids
  // (lava, acid, a sea of cloud) are mostly their own colour
  float mirror = vLiq.a;
  vec3 own = pcDensity(vLiq.rgb, 1.0 + (r3.g - 0.5) * 1.3 + (r1.r - 0.5) * 0.6);
  // lava: paper-bright where it runs hot, dark crust drifting on it
  vec4 r4 = texture(uNoise3D, vBody / 9.0 + drift * 0.4);
  own = mix(own, vec3(1.0, 0.975, 0.86), vLiqP.x * smoothstep(0.50, 0.72, r4.r));
  own = mix(own, vec3(0.30, 0.22, 0.24), vLiqP.x * smoothstep(0.56, 0.70, r4.g + (r2.b - 0.5) * 0.3));
  // cloud sea: bare-paper billows with soft shaded hollows
  vec4 r5 = texture(uNoise3D, vBody / 47.0 + drift * 0.2);
  own = mix(own, vec3(1.0), vLiqP.y * smoothstep(0.42, 0.66, r5.r * 0.7 + r3.b * 0.3));
  own = mix(own, own * uGlaze, vLiqP.y * (1.0 - smoothstep(0.30, 0.52, r5.g)) * 0.6);
  c = mix(own, pcDensity(c * mix(vec3(1.0), vLiq.rgb, 0.35), 1.12 + (r3.g - 0.5) * 0.35), mirror);

  // horizontal strokes of reflected sky where the surface is ruffled
  float ruf = smoothstep(0.585, 0.66, r1.b * 0.55 + r2.g * 0.45);
  c = mix(c, skyc, ruf * 0.55 * mirror);

  // the bed shows through where the water is shallow or seen from above
  float fres = pow(1.0 - max(dot(Vd, up), 0.0), 2.5);
  float shallow = 1.0 - smoothstep(0.02, 0.42, vDepth);
  vec3 bed = pcDensity(uBed, 1.0 + (r3.b - 0.5) * 0.8);
  c = mix(c, bed * mix(vec3(1.0), c, 0.45), clamp((1.0 - fres) * 0.42 + shallow * 0.7, 0.0, 0.9) * (1.0 - vLiqP.y) * (1.0 - vLiqP.x * 0.8));
  // pigment pools at the water's edge
  c = pcDensity(c, 1.0 + (1.0 - smoothstep(0.0, 0.09, vDepth)) * 0.35);
  // bare-paper glints: broken dashes where ripples catch the light
  float glint = smoothstep(0.715, 0.76, r2.r * 0.62 + r1.b * 0.38) * smoothstep(0.04, 0.2, vDepth) * uDayness;
  glint *= (1.0 - smoothstep(40.0, 120.0, dist)) * (1.0 - vLiqP.y);
  c = mix(c, vec3(1.0), glint);
  float f = pcFogAmount(dist);
  c = pcAtmos(c, f);
  pcWrite(c, mix(0.7, 1.0, vLiqP.y), normalize(normalMatrix * up), -vView.z, 2.0);
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

// MOTION: the one place flora moves. Returns the local offset of a vertex for a given sway
// weight. PHYSICS' wind / disturbance field replaces the body of this function (C14).
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
  #endif
  lp += pcSway(aData.x, inst.z * 6.283 + dot(io, vec3(0.11, 0.07, 0.13))) / max(length(im[0].xyz), 0.001);
  vec3 wp = (im * vec4(lp * vis, 1.0)).xyz;
  vBody = wp + uOrigin;
  vObj = position;
  mat3 ir = mat3(im);
  vNV = normalMatrix * (ir * normal);
  vMassV = normalMatrix * (ir * aMass);
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
    c = pcDensity(c, 1.0 + (n1.r - 0.5) * 0.7);
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
    c = pcDensity(c, 1.0 + (n1.r - 0.5) * 0.9 + vInst.y * 0.5);
    x = dot(mV, sunV) * 0.5 + 0.5;
    x = x * (1.0 - vData.z * 0.42);
    float through = pow(max(dot(-V, sunV), 0.0), 1.5);
    x = max(x, through * (0.50 + 0.45 * st.g + (n2.r - 0.5) * 0.5));
    x *= mix(0.62, 1.0, pcDapple(vBody, canopy * 0.6));
    // each wash of the crown sits at its own value; a few dark touches inside
    x += (vData.w - 0.5) * 0.26 + (n2.g - 0.5) * 0.14 - smoothstep(0.55, 0.8, st.g) * 0.16;
    float lvl = min(pcLevel(x, 0.07), 2.6);
    c = pcTone(c, lvl);
    wet = uLeafP.w;
    id = 4.0 + fract(seed * 7.0 + vData.w * 0.37) * 0.9;
  } else if (part < 2.5) {
    // ---- blades and fronds: single crisp strokes, lit like the ground under them
    float hue = vInst.x + (n1.b - 0.5) * 0.8;
    c = mix(leafA, leafB, clamp(0.5 + hue * 0.5, 0.0, 1.0));
    c = mix(c, leafC, clamp(0.55 - vUv.y * 0.7, 0.0, 1.0));
    c = pcDensity(c, 1.0 + (n1.r - 0.5) * 0.8 + vInst.y * 0.5);
    vec3 upV = normalize(vMassV);
    x = dot(upV, sunV) * 0.5 + 0.5;
    x *= mix(0.42, 1.0, pcDapple(vBody, canopy));
    x += (n1.g - 0.5) * 0.14 + vUv.y * 0.10;
    float lvl = pcLevel(x, 0.06);
    c = pcTone(c, lvl);
    wet = 0.1;
    id = 4.0 + seed * 0.9;
  } else if (part < 3.5) {
    // ---- accent: one soft touch of pure pigment
    c = pcDensity(uAccent, 1.0 + (n1.r - 0.5) * 0.9);
    x = 0.6 * mix(0.6, 1.0, pcDapple(vBody, canopy));
    c = pcTone(c, pcLevel(x + 0.2, 0.08));
    wet = 0.35;
    id = 4.0 + seed * 0.9;
  } else {
    // ---- rock: pale granulating wash, paper on top, pooled dark at the base
    vec4 st = pcTri(vBody, normalize(vObj + 0.001), 1.0 / 3.0);
    c = mix(barkA, barkB, clamp(vData.z * 0.8 + (n1.r - 0.5) * 0.5, 0.0, 1.0));
    c = pcDensity(c, 1.0 + (n1.b - 0.5) * 0.9);
    x = dot(nV, sunV) * 0.5 + 0.5;
    x *= mix(0.45, 1.0, pcDapple(vBody, canopy));
    x += (n1.g - 0.5) * 0.18 + (st.b - 0.5) * 0.1;
    float lvl = pcLevel(x, 0.04);
    c = pcTone(c, lvl);
    float dryM = smoothstep(0.50, 0.62, st.r * 0.8 + st.g * 0.3);
    c = mix(c, vec3(1.0), dryM * 0.5 * near * (0.3 + 0.25 * lvl));
    id = 3.0 + seed * 0.9;
  }
  c = pcAtmos(c, vFog);
  wet = max(wet, vFog * 0.85);
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
  if (opts.far) {
    // far trees of every species share one mesh: per-instance species picks the washes
    defines.PC_FAR = 1;
    const pad = (a) => { while (a.length < 8) a.push(a[a.length - 1].clone ? a[a.length - 1].clone() : a[a.length - 1]); return a; };
    const arr = (k) => ({ value: pad(opts.far.map((f) => new THREE.Vector3().fromArray(f[k]))) });
    own.uFarA = arr('leafA'); own.uFarB = arr('leafB'); own.uFarC = arr('leafC');
    own.uFarBarkA = arr('barkA'); own.uFarBarkB = arr('barkB');
    own.uFarTaper = { value: pad(opts.far.map((f) => f.taper || 0)) };
    own.uFarTrunk = { value: pad(opts.far.map((f) => (f.trunk ? 1 : 0))) };
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
      uFlat: { value: opts.flat ? 1 : 0 },
      uMap: { value: opts.map || null },
      uPointSize: { value: opts.pointSize || 3 },
    }),
    vertexShader: WASH_VERT, fragmentShader: WASH_FRAG,
    side: opts.side == null ? THREE.FrontSide : opts.side,
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
