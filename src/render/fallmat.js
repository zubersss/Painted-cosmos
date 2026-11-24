// Painted Cosmos: THE WATERFALL'S PAINT (?falls=1, the oil look): the falling sheet, its plunge pool and its spray. OWNER:
// PAINTER (the water group, lane W2). docs/lead/WATER-DESIGN.md, section 3.5; the look's rules, docs/lead/LOOK-RULES.md.
//
// The owner, 23 Nov: "the waterfall off the sea cliff". The design: "Painted in falling strokes: long thin streaks that slide
// DOWN fast, white and milk with the cliff showing through thin parts at the edges, broken into strands; never a flat white
// sheet and never a blur. A plunge pool: the water at the foot laid as churned milk and lace, with a ring of white flecks
// (spray) thrown out and falling back: a few hundred camera-facing dabs, crisp, each a stroke."
//
// HOW IT IS PAINTED (each a rule of the look):
//   THE SHEET. The shared thin strokes (chunks.js pcThinLayer) on the sheet's OWN chart: the first axis runs DOWN the fall in
//     the water's own time of flight, so a stroke rides with the water and lengthens as the water quickens (a streak near the
//     lip is short, one near the foot long, the fall's own speed sqrt(2 g d)); the second axis is across, in metres. Each
//     stroke is one flat colour (R3.1): bare white, milk, or the river's own glassy wash near the lip, its light asked at its
//     centre through the shadow map (R1.2a, R1.3a), its paint through pcTone (R5). Where the sheet thins -- at its edges and
//     lower down -- WHOLE strokes are left out and the cliff shows between them (the strands): a stroke is in or out, never
//     faded (R4.1). The stroke's size is the look's own octave of the distance (pcStrokeOct), finer than the ground's.
//   THE POOL. A flat disc on the sea at the fall's foot, the same material: strokes that run OUT from the foot along the
//     outflow and are carried with it, milk in the middle, lace further out where more and more strokes are left out and the
//     sea shows between them. (The seam of its polar chart lies toward the cliff, under the sheet.)
//   THE SPRAY. Instanced dabs, each a short pointed stroke along its own motion, one flat colour, never under three pixels:
//     farther off there are fewer of them and each is larger, so it never turns to a glitter (R4.5).
// THE INTERFACE W3 MAY TAKE OVER (docs/lead/WATER-DESIGN.md 5.5, "fallmat.js includes waterchunk.js for the plunge pool's lace
// and the spray's colour"): render/waterchunk.js does not exist yet, so the milk is this file's FALL_CHUNK pcFallMilk(wash,
// aer). When W3 lands a pcWaterMilk of its own, this include is the one line that changes.
import * as THREE from 'three';
import { makePaintUniforms } from './materials.js';
import { VERT_PARS, VERT_END, FRAG_PARS } from './chunks.js';
import { register } from './shared.js';

// (the milk of churned water, from its own wash: aer 0 is the river's colour, 1 a pale milk, never paper white; the same
//  recipe as the water's own aeration in materials.js WATER_FRAG, kept apart so a fall needs no water mesh)
export const FALL_CHUNK = /* glsl */`
vec3 pcFallMilk(vec3 wash, float aer) { return mix(wash, mix(vec3(0.90, 0.94, 0.95), pcDensity(wash, 1.25), 0.30), clamp(aer, 0.0, 1.0)); }
`;

const SHEET_VERT = /* glsl */`
${VERT_PARS}
attribute vec4 aF;        // the sheet: x across (-1..1), y down (0 lip .. 1 foot), z time of flight (s), w kind (0 sheet, 1 pool)
                          // the pool: x its radius (0..1), y unused, z unused, w 1
attribute vec4 aG;        // the sheet: x half width (m) here, y the chart's metres a second, z unused, w the fall's number
                          // the pool: x, y its two half axes (m, across and out), z its outflow speed, w the fall's number
attribute vec2 aP;        // the pool: its local place (m) across and out from the foot
uniform vec3 uOrgRel;     // the meshes' origin, measured from the eye in the body's axes (worked out in double on the CPU)
uniform vec3 uOrgB;       // the same origin in the body's own metres
varying vec3 vBody;
varying vec3 vRel;
varying vec3 vView;
varying vec3 vNb;
varying vec4 vF;
varying vec4 vG;
varying vec2 vP;
void main() {
  vRel = uOrgRel + position;
  vBody = uOrgB + position;
  vNb = normal;
  vF = aF; vG = aG; vP = aP;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
  ${VERT_END}
}
`;

const SHEET_FRAG = /* glsl */`
${FRAG_PARS}
${FALL_CHUNK}
uniform vec3 uFallWash;    // the river's own water colour
uniform vec4 uFallK;       // x the sheet's strands (how readily it breaks, 1 as built), y the pool's lace, z the white share
varying vec3 vBody;
varying vec3 vRel;
varying vec3 vView;
varying vec3 vNb;
varying vec4 vF;
varying vec4 vG;
varying vec2 vP;
void main() {
  #include <logdepthbuf_fragment>
  float dist = length(vView);
  float tw = mod(uTime, 600.0);          // (the clock wrapped: the chart stays a small number, so its strokes stay exact)
  vec3 up = normalize(vBody);
  vec3 c;
  vec3 nb;
  #ifdef PC_OIL
  if (vF.w < 0.5) {
    // ---- THE SHEET ----
    float K = vG.y;
    float across = vF.x * vG.x;
    vec2 ch = vec2((vF.z - tw) * K, across);
    vec2 dcx = vec2(dFdx(vF.z) * K, dFdx(across)), dcy = vec2(dFdy(vF.z) * K, dFdy(across));
    vec2 oc = pcStrokeOct(dist, uOilPx.z * 0.55);
    vec3 r1, r2; vec2 ds; float own;
    pcThinLayer(ch, dcx, dcy, oc.x, 10.0, vec3(ch * 0.5, vG.w * 13.0), 40.0, 1.6, r1, ds, own, r2);
    vec3 rr = own >= 0.5 ? r1 : r2;                      // (whole strokes: the pixel takes the stroke it is most in)
    // where the sheet thins it breaks into strands: whole strokes left out, the cliff between them
    float edge = abs(vF.x);
    float thin = smoothstep(0.62, 1.0, edge) * 0.75 + smoothstep(0.45, 1.0, vF.y) * (0.12 + 0.38 * edge);
    if (rr.z < thin * uFallK.x) discard;
    // the stroke's colour: bare white, milk, a share of the river's own wash; glassy near the lip, where it has not yet broken
    float glassy = 1.0 - smoothstep(0.04, 0.26, vF.y);
    vec3 milk = pcFallMilk(uFallWash, 0.9);
    vec3 col = rr.x < 0.40 * uFallK.z ? vec3(0.92, 0.94, 0.95) : rr.x < 0.86 ? milk : pcFallMilk(uFallWash, 0.55);
    if (rr.y < glassy * 0.75) col = pcDensity(uFallWash, 1.35);
    nb = normalize(vNb);
    // the light at the stroke's centre (R1.2a): the face's turn to the sun and the shadow map there
    vec3 ctrB = vBody + dFdx(vRel) * ds.x + dFdy(vRel) * ds.y;
    float x = dot(nb, uSunDirL) * 0.5 + 0.5 + (rr.y - 0.5) * 0.08;
    float sunny = pcSunAt(ctrB, 0.0, 0.0, 0.1);
    float level = pcLevel(mix(min(x, 0.44), x, sunny), 0.04);
    c = pcTone(col, level);
  } else {
    // ---- THE PLUNGE POOL ----
    // strokes carried OUT from the cliff with the outflow, the first axis seaward (metres, moving), the second across. (A polar
    // chart drew every stroke into the foot: a starburst, seen from above. Here no stroke meets another; the boil at the foot
    // is the milk and the broken lace, and the slow bend of the rows fans them a little.)
    float rN = vF.x;
    vec2 ch = vec2(vP.y - tw * vG.z, vP.x);
    vec2 dcx = vec2(dFdx(vP.y), dFdx(vP.x)), dcy = vec2(dFdy(vP.y), dFdy(vP.x));
    vec2 oc = pcStrokeOct(dist, uOilPx.z * 0.7);
    vec3 r1, r2; vec2 ds; float own;
    pcThinLayer(ch, dcx, dcy, oc.x, 5.0, vec3(ch * 0.4, vG.w * 7.0), 40.0, 6.0, r1, ds, own, r2);
    vec3 rr = own >= 0.5 ? r1 : r2;
    // milk at the foot, lace beyond: more strokes left out the farther from the foot
    float cover = 1.0 - smoothstep(0.30, 1.0, rN) * uFallK.y;
    if (rr.z > cover) discard;
    vec3 milk = pcFallMilk(uFallWash, 0.85);
    vec3 col = rr.x < 0.30 * uFallK.z ? vec3(0.92, 0.94, 0.95) : rr.x < 0.80 ? milk : pcFallMilk(uFallWash, 0.45);
    nb = up;
    vec3 ctrB = vBody + dFdx(vRel) * ds.x + dFdy(vRel) * ds.y;
    float x = dot(up, uSunDirL) * 0.5 + 0.5 + (rr.y - 0.5) * 0.08;
    float sunny = pcSunAt(ctrB, 0.0, 0.0, 0.1);
    c = pcTone(col, pcLevel(mix(min(x, 0.44), x, sunny), 0.04));
  }
  #else
    c = vec3(0.9); nb = up;
  #endif
  c = pcAtmosV(c, pcFogAmount(dist), vView);
  pcWrite(c, 0.3, normalize((viewMatrix * vec4(nb, 0.0)).xyz), -vView.z, 2.0);
}
`;

const SPRAY_VERT = /* glsl */`
${VERT_PARS}
attribute vec4 aS;        // x its number (0..1), y how far along the foot's line (-1..1), z kind (0 the plunge, 1 off the sheet), w unused
attribute vec4 aC;        // the foot's place (m, from the meshes' origin), w the fall's half width (m)
attribute vec4 aD;        // the way out from the cliff (unit, body axes), w the drop (m)
attribute vec4 aA;        // across the fall (unit, body axes), w the lip's height over the foot (m)
uniform vec3 uOrgRel;
uniform vec3 uOrgB;
uniform vec4 uSprayK;     // x how many to keep (0..1), y the smallest a dab may be in pixels
uniform float uTime;
uniform vec4 uOilPx;      // (shared.js OIL: x metres a pixel a metre away, y the picture's lines)
varying vec3 vBody;
varying vec3 vView;
varying vec2 vQ;
varying float vH;
void main() {
  float h = aS.x;
  vec3 up = normalize(uOrgB + aC.xyz);
  // its life: a period of its own, thrown from the foot (or peeled off the lower sheet), arcing out and falling back
  float P = 1.1 + 1.4 * fract(h * 7.31);
  float t = fract(mod(uTime, 600.0) / P + h * 3.17) * P;
  float drop = aD.w, k = clamp(sqrt(drop / 20.0), 0.5, 1.6);
  vec3 out3 = aD.xyz, acr = aA.xyz;
  float a = (fract(h * 5.13) - 0.5) * 2.6;               // which way round: mostly out from the cliff, some along it
  vec3 hz = normalize(out3 * cos(a) + acr * sin(a));
  float vh = (1.5 + 4.5 * fract(h * 11.7)) * k, vv = (2.5 + 6.0 * fract(h * 13.9)) * k;
  vec3 p0 = aC.xyz + acr * (aS.y * aC.w) + out3 * 0.6;
  if (aS.z > 0.5) {
    // off the sheet: from somewhere on its lower half, drifting out and down with the air the fall drags
    float s = 0.45 + 0.5 * fract(h * 17.3);
    p0 = aC.xyz + acr * (aS.y * aC.w) - out3 * 0.4 * (1.0 - s) + up * (aA.w * (1.0 - s));
    hz = normalize(out3 + acr * (fract(h * 19.1) - 0.5)); vh = (0.8 + 1.6 * fract(h * 23.3)) * k; vv = (0.2 + 1.0 * fract(h * 29.7));
  }
  vec3 vel = hz * vh + up * (vv - 9.81 * t);
  vec3 p = p0 + hz * (vh * t) + up * (vv * t - 4.905 * t * t);
  float above = dot(p - aC.xyz, up);
  vBody = uOrgB + p;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float dist = max(-mv.z, 0.1);
  // its size: a few decimetres, never under uSprayK.y pixels; farther off fewer are kept and each is larger
  float own = (0.18 + 0.30 * fract(h * 31.1)) * k;
  float px = dist * uOilPx.x * uOilPx.y / 720.0;           // metres a pixel there, at 720 lines
  float size = max(own, px * uSprayK.y);
  float keep = step(h, uSprayK.x * min(1.0, (own * own) / (size * size) * 1.6)) * step(-0.25, above) * step(t, P * 0.96);
  // the dab lies along its own motion on the screen
  vec3 vv3 = (viewMatrix * vec4(vel, 0.0)).xyz;
  vec2 ax = length(vv3.xy) > 1e-4 ? normalize(vv3.xy) : vec2(0.0, 1.0);
  vec2 ay = vec2(-ax.y, ax.x);
  float len = size * (1.4 + min(2.2, length(vel) * 0.12)), wid = size * 0.6;
  mv.xy += (ax * position.x * len + ay * position.y * wid) * keep;
  vView = mv.xyz;
  vQ = position.xy; vH = h;
  gl_Position = projectionMatrix * mv;
  if (keep < 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  ${VERT_END}
}
`;

const SPRAY_FRAG = /* glsl */`
${FRAG_PARS}
${FALL_CHUNK}
uniform vec3 uFallWash;
varying vec3 vBody;
varying vec3 vView;
varying vec2 vQ;
varying float vH;
void main() {
  #include <logdepthbuf_fragment>
  // a short stroke, pointed at both ends, one flat colour
  if (abs(vQ.y) > 1.0 - vQ.x * vQ.x) discard;
  float k = fract(vH * 23.7);
  vec3 col = k < 0.55 ? vec3(0.92, 0.94, 0.95) : pcFallMilk(uFallWash, 0.8);
  #ifdef PC_OIL
    float sun = pcSunAt(vBody, 0.0, 0.0, 0.1);
    vec3 c = pcTone(col, mix(1.6, 2.8, sun));
  #else
    vec3 c = col;
  #endif
  c = pcAtmosV(c, pcFogAmount(length(vView)), vView);
  pcWrite(c, 0.3, vec3(0.0, 0.0, 1.0), -vView.z, 6.0);
}
`;

// The sheet's and the pool's material (one draw for every fall near the eye).
export function makeFallSheetMaterial(bodyU) {
  const m = new THREE.ShaderMaterial({
    name: 'pc-fall-sheet',
    uniforms: makePaintUniforms(bodyU, {
      uOrgRel: { value: new THREE.Vector3() }, uOrgB: { value: new THREE.Vector3() },
      uFallWash: { value: new THREE.Color(0.30, 0.46, 0.56) }, uFallK: { value: new THREE.Vector4(1, 1, 1, 0) },
    }),
    vertexShader: SHEET_VERT, fragmentShader: SHEET_FRAG, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
  });
  m.userData.pcPainted = true;
  return register(m, 'fall-sheet');
}

// The spray's material (one draw for every fall near the eye).
export function makeFallSprayMaterial(bodyU) {
  const m = new THREE.ShaderMaterial({
    name: 'pc-fall-spray',
    uniforms: makePaintUniforms(bodyU, {
      uOrgRel: { value: new THREE.Vector3() }, uOrgB: { value: new THREE.Vector3() },
      uFallWash: { value: new THREE.Color(0.30, 0.46, 0.56) }, uSprayK: { value: new THREE.Vector4(1, 3, 0, 0) },
    }),
    vertexShader: SPRAY_VERT, fragmentShader: SPRAY_FRAG, side: THREE.DoubleSide,
  });
  m.userData.pcPainted = true;
  return register(m, 'fall-spray');
}
