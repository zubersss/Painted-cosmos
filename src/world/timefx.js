// Painted Cosmos: WHAT THE THIRD ELEMENT LOOKS LIKE. OWNER: PAINTER. (The oil look and ?powers=1 only.)
//
// The owner, 2026-11-22: "Now make the designs for these powers actually look cool make sure the art is drawn
// originally as well". It is: every mark here is drawn by this file's own shader, as everything in this game is.
// There is no picture in this repository that was not made by it, and there will not be (CLAUDE.md: other
// people's pictures are never committed).
//
// WHAT IS DRAWN
//   THE BUBBLE of a slowed, hastened or stopped place (physics/times.js). Not a soap bubble and not glass: a ball
//   of air with its EDGE PAINTED -- the rim broken into brush marks that drift round it, the way a wet edge is
//   left when a brush is dragged round a curve. You see it from outside as a drawn ball and from inside as a ring
//   of paint round the whole view, which is exactly what it is.
//     slow    a cool pearl, the marks long and slow, drifting with the hand of the brush
//     haste   a warm orange, the marks short and quick and smeared the way a dragged brush leaves them
//     still   a cold pale glaze with HAIRLINE CRACKS of light in it: the one mark in the game with no motion at
//             all, because the place it holds has none either
//   THE RIP IN SPACE-TIME (the owner's own idea, 2026-11-22: "a rip in space time that sucks everything in a long
//   ways in"). A TEAR standing where it was torn: a slit of nothing with its edges painted hot, breathing, and
//   round it the air itself drawn in as STROKES THAT RUN INWARD and die at the lip. The strokes are the whole
//   point of it -- the world really is being pulled in (physics/powers.js KIND.rip: the leaves, the dust, the
//   spray and the rain all answer it), and these say so.
//
//   (THE KNOT went with the cut of 2026-11-22, when the owner cut space and time from twelve powers to four. Its
//   shader is in the history at v31.)
//
// WHAT IT COSTS. One instanced draw for every bubble (eight at most, and only while one is open) and one for all
// the rips together. With nothing cast the meshes are invisible and nothing is drawn at all.
import * as THREE from 'three';
import { makePaintUniforms, bindBodyUniforms } from '../render/materials.js';
import { VERT_PARS, VERT_END, FRAG_PARS } from '../render/chunks.js';
import { register, G } from '../render/shared.js';

const MAX = 8;                 // the same ceiling physics/times.js keeps (TIMEPOWER.max)

// ---- the bubble -------------------------------------------------------------------------------------------
const BUBBLE_VERT = /* glsl */`
${VERT_PARS}
attribute vec4 aZone;      // xyz: the middle, FROM THE EYE, in the body's axes; w: its radius (m)
attribute vec2 aZoneK;     // x: how fast the world runs inside (0 stopped, <1 slow, >1 hastened); y: 0..1 how open
varying vec3 vView;
varying vec3 vNrm;
varying vec3 vBall;        // where on the ball this pixel is (unit)
varying vec2 vK;
void main() {
  vNrm = normalMatrix * normal;
  vBall = normal;
  vK = aZoneK;
  vec3 p = aZone.xyz + position * aZone.w * (0.35 + 0.65 * aZoneK.y);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
  ${VERT_END}
}
`;

const BUBBLE_FRAG = /* glsl */`
${FRAG_PARS}
varying vec3 vView;
varying vec3 vNrm;
varying vec3 vBall;
varying vec2 vK;
void main() {
  #include <logdepthbuf_fragment>
  if (vK.y < 0.004) discard;
  vec3 n = normalize(vNrm), v = normalize(-vView);
  // THE EDGE. A ball's silhouette, which is where a brush dragged round it would leave its paint.
  float f = 1.0 - abs(dot(n, v));
  float rim = f * f;
  // ... BROKEN INTO MARKS. Two noises over the ball itself: a slow one that makes the marks, and a quicker one
  // that ragges their ends. They drift round the ball, so the edge is always being laid and never a drawn ring.
  float drift = uTime * (vK.x > 1.0 ? 0.55 : vK.x < 0.02 ? 0.0 : 0.16);
  vec4 n1 = texture(uNoise3D, vBall * 1.15 + vec3(drift * 0.6, drift * 0.2, 0.0));
  vec4 n2 = texture(uNoise3D, vBall * 3.7 - vec3(0.0, drift, drift * 0.4));
  float mark = smoothstep(0.30, 0.62, n1.r * 0.72 + n2.g * 0.28);
  // A BAND OF PAINT, NOT A WIRE. At its first width (0.18 .. 0.92 of the silhouette) the edge came out as a thin
  // drawn arc -- seen, over the owner's own river -- which is the one thing a brush never leaves. It is a broad
  // band now, ragged on both sides, so that it reads as a ball of air with its edge painted round.
  float band = smoothstep(0.02, 0.80, rim);
  float cov = band * mix(0.45, 1.0, mark);
  // THE THREE PAINTS. A stopped place is the odd one out: no drift at all, a cold glaze, and hairline cracks.
  vec3 cool = vec3(0.70, 0.86, 1.00), warm = vec3(1.00, 0.69, 0.33), cold = vec3(0.86, 0.94, 1.00);
  bool stopped = vK.x < 0.02;
  vec3 col = stopped ? cold : (vK.x < 1.0 ? cool : warm);
  float a = cov;
  if (stopped) {
    // the cracks: thin bright lines through the glaze, fixed in the ball so they do not crawl
    float cr = 1.0 - smoothstep(0.0, 0.06, abs(fract(n1.b * 6.0 + n2.r * 2.0) - 0.5));
    col = mix(col, vec3(1.0), cr * 0.75);
    a = max(a, cr * 0.9 * (0.25 + 0.75 * band));
  } else if (vK.x > 1.0) {
    // hastened: the marks smeared ALONG the way the brush went, so the edge reads as speed
    float sm = smoothstep(0.25, 0.85, n2.b);
    a *= 0.70 + 0.70 * sm;
    col = mix(col, vec3(1.0, 0.92, 0.70), sm * 0.5);
  }
  a *= vK.y;
  // IT IS MADE OF MARKS, NOT OF GLASS. Everything else in this look is laid as strokes with hard edges and gaps
  // between them, and so is this: the paint is either here or it is not, and what makes a bubble's edge soft from
  // a distance is the GAPS, not a fade. (It was built first as a GLAZE -- a wash laid over the finished picture,
  // which the painter draws in a pass of its own from a list a material must be ON -- and it was invisible for an
  // afternoon. This is the path the leaves in the air take, and that one works.)
  if (a < 0.30 + 0.36 * fract(n2.r * 7.3 + n1.g * 3.1)) discard;
  vec3 c = pcAtmosV(col, pcFogAmount(length(vView)), vView);
  pcWrite(c, 1.0, n, -vView.z, 6.0);
}
`;

// ---- the rip ----------------------------------------------------------------------------------------------
// One buffer holds every rip's marks: RIPS tears, QUADS little cards each. A card's own number is carried in
// position.z, and which rip it belongs to falls out of that. Card 0 is the TEAR itself (a tall slit that faces
// the eye); the rest are the STROKES OF AIR running inward, each one going round again when it reaches the lip.
const RIPS = 3, QUADS = 76;

const RIP_VERT = /* glsl */`
${VERT_PARS}
uniform vec4 uRip[${RIPS}];       // xyz: the tear, FROM THE EYE, in the body's axes; w: how far it reaches (m)
uniform vec4 uRipK[${RIPS}];      // x: 0..1 how open it is; y: a number of its own, so two tears are not alike
uniform vec3 uRipO;               // where the EYE is, in the body's own axes (so UP can be worked out at all)
uniform float uTime;
varying vec2 vQ;
varying float vRole;              // 0 the tear itself, 1 a stroke of air
varying float vFade;
varying vec3 vView;
float ripHash(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }
void main() {
  float qi = position.z;
  float ri = floor(qi / ${QUADS}.0);
  float k = qi - ri * ${QUADS}.0;
  int rj = int(ri);
  vec4 R = uRip[rj];
  vec4 K = uRipK[rj];
  vQ = position.xy;
  vRole = k < 0.5 ? 0.0 : 1.0;
  vFade = K.x;
  if (K.x < 0.004) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vView = vec3(0.0); return; }   // not open: off the screen
  // THE GROUND'S OWN FRAME AT THE TEAR. up is from the WORLD'S MIDDLE to the tear, which needs the eye's own
  // place in the body's axes: everything here is eye-relative (for the precision), so normalize(R.xyz) is the way
  // from the EYE to the tear and not up at all. (That mistake built the first rip entirely under the ground.)
  vec3 up = normalize(uRipO + R.xyz);
  vec3 to = normalize(-R.xyz);
  vec3 rt = normalize(cross(up, to));
  vec3 fw = normalize(cross(rt, up));
  vec3 p;
  if (k < 0.5) {
    // THE TEAR: a slit standing on the ground, facing the eye, breathing a little. (It was 0.21 of the reach at
    // first -- a twenty-metre column that ran off the top of the picture at sixteen paces. Seen and cut back.)
    float h = R.w * 0.080 * (0.88 + 0.12 * sin(uTime * 1.7 + K.y));
    float w = R.w * 0.048 * (0.80 + 0.20 * sin(uTime * 6.3 + K.y * 3.0));
    p = R.xyz + up * (position.y * h + h) * K.x + rt * (position.x * w);
  } else {
    // A STROKE OF AIR: laid along the way in, carried from the rim to the lip over and over
    float a = ripHash(k + K.y) * 6.2831853;
    float sp = 0.40 + 0.55 * ripHash(k + 3.3);
    float ph = fract(ripHash(k + 7.1) + uTime * sp);
    float rho = R.w * mix(1.0, 0.07, ph * ph);                    // faster as it nears, as a drawn thing is
    float hh = (0.8 + 7.0 * ripHash(k + 11.7)) * (1.0 - 0.55 * ph);
    vec3 dir = rt * cos(a) + fw * sin(a);
    float len = R.w * (0.030 + 0.045 * ripHash(k + 5.2)) * (0.45 + 0.9 * ph);
    float wid = 0.07 + 0.16 * ripHash(k + 2.2);                     // thin: a stroke of air, not a leaf
    p = R.xyz + dir * (rho + position.x * len) + up * (hh + position.y * wid);
    vFade = K.x * (1.0 - smoothstep(0.80, 1.0, ph)) * smoothstep(0.0, 0.10, ph);
  }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
  ${VERT_END}
}
`;

const RIP_FRAG = /* glsl */`
${FRAG_PARS}
varying vec2 vQ;
varying float vRole;
varying float vFade;
varying vec3 vView;
void main() {
  #include <logdepthbuf_fragment>
  if (vFade < 0.02) discard;
  vec3 col;
  float a;
  if (vRole < 0.5) {
    // THE TEAR: a slit of nothing with its edges painted hot. The middle is the darkest thing in the picture and
    // the lips are near white; the edge is broken into marks and gaps so it is paint and not a glow.
    float w = 1.0 - vQ.y * vQ.y * 0.82;                            // narrower at top and bottom: a tear, not a box
    // AND TORN, not cut: the edge is taken in bands, each band its own width, so the silhouette itself is ragged
    float band = floor(vQ.y * 6.0);
    float jag = 0.80 + 0.20 * fract(sin((band + 3.1) * 12.9898) * 43758.5453);
    float e = abs(vQ.x) / max(w * jag, 1e-3);
    if (e > 1.0) discard;
    float tear = fract(sin((vQ.y * 17.0 + 4.7) * 12.9898) * 43758.5453);
    if (e > 0.80 && tear < 0.30) discard;                          // and the lip itself breaks into marks
    // the inside of it is the darkest thing in the picture, and only the last of the way out is the hot lip
    float lip = smoothstep(0.58, 0.99, e);
    col = mix(vec3(0.02, 0.015, 0.05), mix(vec3(0.52, 0.36, 0.95), vec3(1.0, 0.97, 0.90), lip * lip), lip);
    a = vFade * (0.72 + 0.28 * lip);
  } else {
    // A STROKE OF AIR drawn in: pointed at both ends, cool and pale, the colour of the stopped moment
    float w = 1.0 - vQ.y * vQ.y;
    if (abs(vQ.x) > w) discard;
    float e = abs(vQ.x) / max(w, 1e-3);
    col = mix(vec3(0.93, 0.96, 1.0), vec3(0.55, 0.72, 0.98), smoothstep(0.0, 1.0, e));
    a = vFade * (1.0 - smoothstep(0.45, 1.0, e)) * (0.35 + 0.65 * w);
  }
  if (a < 0.28) discard;                                           // marks and gaps: the bubble's own lesson
  vec3 c = pcAtmosV(col, pcFogAmount(length(vView)), vView);
  pcWrite(c, 1.0, normalize(-vView), -vView.z, 6.0);
}
`;

export function makeTimeFx(bodyUniforms) {
  // the ball: an icosphere, cheap, and instanced so every bubble in the world is ONE draw
  const base = new THREE.IcosahedronGeometry(1, 2);
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', base.getAttribute('position'));
  g.setAttribute('normal', base.getAttribute('normal'));
  if (base.getIndex()) g.setIndex(base.getIndex());
  const zone = new Float32Array(MAX * 4), zoneK = new Float32Array(MAX * 2);
  const aZone = new THREE.InstancedBufferAttribute(zone, 4), aZoneK = new THREE.InstancedBufferAttribute(zoneK, 2);
  aZone.setUsage(THREE.DynamicDrawUsage); aZoneK.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('aZone', aZone); g.setAttribute('aZoneK', aZoneK);
  g.instanceCount = 0;
  const mat = new THREE.ShaderMaterial({
    name: 'pc-timefx',
    uniforms: makePaintUniforms(bodyUniforms, { uSceneAux: G.uSceneAux, uSceneRes: G.uSceneRes }),
    vertexShader: BUBBLE_VERT, fragmentShader: BUBBLE_FRAG,
    side: THREE.DoubleSide,
  });
  mat.userData.pcPainted = true;
  register(mat, 'glaze');
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'pc-timefx';
  mesh.frustumCulled = false; mesh.matrixAutoUpdate = false; mesh.visible = false;

  // the rips: RIPS tears of QUADS cards each, all in one buffer. A card carries its own number in position.z and
  // works out from that which tear it belongs to and what it is (the tear itself, or a stroke of air).
  const kg = new THREE.BufferGeometry();
  const pos = [], idx = [];
  for (let q = 0; q < RIPS * QUADS; q++) {
    const o = q * 4;
    pos.push(-1, -1, q, 1, -1, q, -1, 1, q, 1, 1, q);
    idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
  }
  kg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  kg.setIndex(idx);
  const ripU = []; const ripK = [];
  for (let i = 0; i < RIPS; i++) { ripU.push(new THREE.Vector4(0, 0, 0, 1)); ripK.push(new THREE.Vector4(0, 0, 0, 0)); }
  const kmat = new THREE.ShaderMaterial({
    name: 'pc-rip',
    uniforms: makePaintUniforms(bodyUniforms, { uRip: { value: ripU }, uRipK: { value: ripK }, uRipO: { value: new THREE.Vector3() }, uSceneAux: G.uSceneAux, uSceneRes: G.uSceneRes }),
    vertexShader: RIP_VERT, fragmentShader: RIP_FRAG,
    side: THREE.DoubleSide,
  });
  kmat.userData.pcPainted = true;
  register(kmat, 'glaze');
  const rip = new THREE.Mesh(kg, kmat);
  rip.name = 'pc-rip';
  rip.frustumCulled = false; rip.matrixAutoUpdate = false; rip.visible = false;

  let bound = bodyUniforms || null;
  return {
    mesh, rip,
    // Every frame: the eye in the scene and in the body's own axes, the body's root and its uniforms, and the
    // player's own time (physics/times.js, with the rips stashed on it: see core/powers.js).
    update(cameraPos, root, camL, bodyU, times, bodyId, rips) {
      const live = times && times.count ? times : null;
      let n = 0;
      if (live) {
        for (let i = 0; i < live.count && n < MAX; i++) {
          const s = live[i];
          if (!s.live || s.bodyId !== bodyId || !(s.strength > 0.004)) continue;
          const o = n * 4;
          zone[o] = s.px - camL.x; zone[o + 1] = s.py - camL.y; zone[o + 2] = s.pz - camL.z; zone[o + 3] = s.radius;
          zoneK[n * 2] = s.rate; zoneK[n * 2 + 1] = s.strength;
          n++;
        }
      }
      mesh.visible = n > 0;
      if (mesh.visible) {
        if (bodyU !== bound) { bindBodyUniforms(mat, bodyU); bindBodyUniforms(kmat, bodyU); bound = bodyU; }
        g.instanceCount = n;
        aZone.needsUpdate = true; aZoneK.needsUpdate = true;
        mesh.position.copy(cameraPos); mesh.quaternion.copy(root.quaternion); mesh.updateMatrix(); mesh.matrixWorld.copy(mesh.matrix); mesh.matrixWorldNeedsUpdate = false;
      }
      // THE RIPS torn open on this world (core/powers.js hands them over on the time list: they live in the WIND
      // list, because a rip IS a wind source, and the painter never sees that one)
      let m = 0;
      if (rips) {
        const nr = rips.count !== undefined ? rips.count : rips.length;
        for (let i = 0; i < nr && m < RIPS; i++) {
          const r = rips[i];
          if (!r || r.bodyId !== bodyId || !(r.strength > 0.004)) continue;
          ripU[m].set(r.px - camL.x, r.py - camL.y, r.pz - camL.z, r.radius);
          ripK[m].set(r.strength, (r.id || i + 1) % 17, 0, 0);
          m++;
        }
      }
      for (let i = m; i < RIPS; i++) ripK[i].set(0, 0, 0, 0);
      rip.visible = m > 0;
      if (rip.visible) {
        kmat.uniforms.uRipO.value.set(camL.x, camL.y, camL.z);
        if (bodyU !== bound) { bindBodyUniforms(mat, bodyU); bindBodyUniforms(kmat, bodyU); bound = bodyU; }
        rip.position.copy(cameraPos); rip.quaternion.copy(root.quaternion); rip.updateMatrix(); rip.matrixWorld.copy(rip.matrix); rip.matrixWorldNeedsUpdate = false;
      }
    },
  };
}
