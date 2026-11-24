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
attribute vec4 aG;        // the sheet: x half width (m) here, y the chart's metres a second, z how far above the lip its run starts (in s), w the fall's number
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
    // (the review, 24 Nov: "a white blind of even streaks"; real falls break into a few thick ROPES and ragged lace with dark
    //  gaps where the rock shows, widen as they fall; the lip a ruled line; the whites few, the body milk and pale blue)
    float K = vG.y;
    float across = vF.x * vG.x;
    vec2 ch = vec2((vF.z - tw) * K, across);
    vec2 dcx = vec2(dFdx(vF.z) * K, dFdx(across)), dcy = vec2(dFdy(vF.z) * K, dFdy(across));
    vec2 oc = pcStrokeOct(dist, uOilPx.z * 0.85);
    vec3 r1, r2; vec2 ds; float own;
    pcThinLayer(ch, dcx, dcy, oc.x, 7.0, vec3(ch * 0.5, vG.w * 13.0), 40.0, 1.6, r1, ds, own, r2);
    vec3 rr = own >= 0.5 ? r1 : r2;                      // (whole strokes: the pixel takes the stroke it is most in)
    // what the stroke's centre is: where across the sheet, how far down, and whether it lies on a ROPE (a slow noise across the
    // sheet, fixed to it, about a third of its width a rope; asked at the centre, so a stroke is in a rope or not, whole)
    float acrC = across + dFdx(across) * ds.x + dFdy(across) * ds.y;
    float sC = vF.y + dFdx(vF.y) * ds.x + dFdy(vF.y) * ds.y;
    float rope = texture(uNoise3D, vec3(acrC / max(3.0, vG.x * 0.55), vG.w * 0.37, 0.61)).r;
    float edge = abs(acrC) / max(vG.x, 1e-3);
    float down = clamp(sC, 0.0, 1.0);
    // the run onto the lip (sC < 0): strokes start at different places, so the lip is broken by them and never ruled
    if (sC < 0.0 && rr.z < smoothstep(0.0, -vG.z, sC)) discard;
    // ragged sides: whole strokes left out toward the edges, more so lower down and between the ropes
    float rag = smoothstep(0.72, 1.0, edge + 0.18 * (rope - 0.5)) * (0.55 + 0.45 * down);
    if (rr.z < rag * uFallK.x) discard;
    // between the ropes, lower down, the sheet thins to a few strands over the wet rock: those strokes are painted as the
    // rock's dark wet face, not cut out (cheaper, and the gap reads dark as it does in a real fall)
    float thick = smoothstep(0.26, 0.56, rope + 0.30 * (1.0 - down));
    bool gap = rr.y > 0.45 + 0.55 * thick && sC > 0.25;
    // the stroke's colour: a few bright whites (about V 0.92 once lit), the body in milk and pale blue steps, glassy near the lip
    float glassy = 1.0 - smoothstep(-0.05, 0.22, sC);
    vec3 col = rr.x < 0.14 * uFallK.z + 0.10 * thick ? vec3(0.86, 0.90, 0.92)
             : rr.x < 0.66 ? pcFallMilk(uFallWash, 0.90)
             : pcFallMilk(uFallWash, 0.66);
    if (rr.y < glassy * 0.8) col = pcFallMilk(uFallWash, 0.30 + 0.5 * step(0.7, rr.x));
    // (the wet rock seen through a thin place: a mid slate, a step or two under the water, never a black hole)
    if (gap) col = mix(vec3(0.44, 0.45, 0.50), pcDensity(uFallWash, 1.2), 0.35);
    nb = normalize(vNb);
    // the light at the stroke's centre (R1.2a): the face's turn to the sun and the shadow map there
    vec3 ctrB = vBody + dFdx(vRel) * ds.x + dFdy(vRel) * ds.y;
    float x = dot(nb, uSunDirL) * 0.5 + 0.5 + (rr.y - 0.5) * 0.08 - (gap ? 0.06 : 0.0);
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
uniform vec4 uOilA;       // (shared.js OIL: x the look's stroke width in pixels at 720 lines)
varying vec3 vBody;
varying vec3 vView;
varying vec2 vQ;
varying float vH;
varying float vKind;
void main() {
  float h = aS.x;
  vKind = aS.z;
  vec3 up = normalize(uOrgB + aC.xyz);
  // its life: a period of its own, thrown from the foot (or peeled off the lower sheet), arcing out and falling back
  float P = 1.1 + 1.4 * fract(h * 7.31);
  float t = fract(mod(uTime, 600.0) / P + h * 3.17) * P;
  float drop = aD.w, k = clamp(sqrt(drop / 20.0), 0.5, 1.6);
  vec3 out3 = aD.xyz, acr = aA.xyz;
  float a = (fract(h * 5.13) - 0.5) * 2.6;               // which way round: mostly out from the cliff, some along it
  vec3 hz = normalize(out3 * cos(a) + acr * sin(a));
  float vh = (1.5 + 4.5 * fract(h * 11.7)) * k, vv = (3.0 + 8.0 * fract(h * 13.9)) * k;
  vec3 p0 = aC.xyz + acr * (aS.y * aC.w) + out3 * 0.6;
  float own = (0.18 + 0.30 * fract(h * 31.1)) * k;
  float grav = 9.81;
  if (aS.z > 1.5) {
    // THE SPRAY CLOUD over the pool (the review: "a big pale spray cloud"): slow dabs rising from all over the foot and
    // drifting out, larger and paler than the thrown ones; each still one crisp stroke, the cloud is many of them
    P = 2.6 + 2.2 * fract(h * 7.31);
    t = fract(mod(uTime, 600.0) / P + h * 3.17) * P;
    float rad = aC.w + 0.3 * drop;
    p0 = aC.xyz + acr * (aS.y * rad) + out3 * (aS.w * (0.5 * aC.w + 0.25 * drop) - 1.0);
    hz = normalize(out3 + acr * (fract(h * 19.7) - 0.5) * 0.8);
    vh = 0.3 + 0.7 * fract(h * 23.9); vv = (0.7 + 1.2 * fract(h * 29.3)) * k; grav = 0.0;
    own = (0.12 + 0.22 * fract(h * 31.1)) * k;
  } else if (aS.z > 0.5) {
    // off the sheet: from somewhere on its lower half, drifting out and down with the air the fall drags
    float s = 0.45 + 0.5 * fract(h * 17.3);
    p0 = aC.xyz + acr * (aS.y * aC.w) - out3 * 0.4 * (1.0 - s) + up * (aA.w * (1.0 - s));
    hz = normalize(out3 + acr * (fract(h * 19.1) - 0.5)); vh = (0.8 + 1.6 * fract(h * 23.3)) * k; vv = (0.2 + 1.0 * fract(h * 29.7));
  }
  vec3 vel = hz * vh + up * (vv - grav * t);
  vec3 p = p0 + hz * (vh * t) + up * (vv * t - 0.5 * grav * t * t);
  float above = dot(p - aC.xyz, up);
  vBody = uOrgB + p;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float dist = max(-mv.z, 0.1);
  // its size: a few decimetres, never under uSprayK.y pixels; farther off fewer are kept and each is larger
  float px = dist * uOilPx.x * uOilPx.y / 720.0;           // metres a pixel there, at 720 lines
  // (no larger than about twice the look's own stroke there, so near the eye the foam reads as spray and not as scattered
  //  petals: the look director, 24 Nov; never under uSprayK.y pixels; and fewer of them close by)
  float size = clamp(own, px * uSprayK.y, max(px * uSprayK.y, 1.4 * px * uOilA.x));      // (the sheet's strokes are 0.5 to 1 of px * uOilA.x: pcStrokeOct)
  float nearK = mix(0.5, 1.0, smoothstep(25.0, 90.0, dist));
  float keep = step(h, uSprayK.x * nearK * min(1.0, (own * own) / (size * size) * 1.6)) * step(-0.25, above) * step(t, P * 0.96);
  // the dab lies along its own motion on the screen
  vec3 vv3 = (viewMatrix * vec4(vel, 0.0)).xyz;
  vec2 ax = length(vv3.xy) > 1e-4 ? normalize(vv3.xy) : vec2(0.0, 1.0);
  vec2 ay = vec2(-ax.y, ax.x);
  float len = aS.z > 1.5 ? size * 1.15 : size * (1.3 + min(1.2, length(vel) * 0.08)), wid = size * (aS.z > 1.5 ? 0.8 : 0.6);
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
varying float vKind;
void main() {
  #include <logdepthbuf_fragment>
  // a short stroke, pointed at both ends, one flat colour: the thrown ones white or milk, the cloud's paler and bluer
  if (abs(vQ.y) > 1.0 - vQ.x * vQ.x) discard;
  float k = fract(vH * 23.7);
  vec3 col = vKind > 1.5 ? pcFallMilk(uFallWash, 0.82 + 0.15 * k) : k < 0.40 ? vec3(0.88, 0.91, 0.93) : pcFallMilk(uFallWash, 0.8);
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
