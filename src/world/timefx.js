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
//   THE KNOT tied in time (the seventh power): a small bright standing stroke with a ring crossed through it,
//   seen from anywhere on the world, turning very slowly. It is the one thing in the picture that says "you can
//   come back here".
//
// WHAT IT COSTS. One instanced draw for every bubble (eight at most, and only while one is open) and one for the
// knot. With nothing cast the meshes are invisible and nothing is drawn at all.
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

// ---- the knot ---------------------------------------------------------------------------------------------
const KNOT_VERT = /* glsl */`
${VERT_PARS}
uniform vec4 uKnot;        // xyz: where it is, FROM THE EYE, in the body's axes; w: 0..1 how shown
uniform float uTime;
varying vec2 vQ;
varying vec3 vView;
varying float vArm;
void main() {
  vQ = position.xy;
  vArm = position.z;                                            // which of the crossed cards this is
  // it stands upright, faces the eye about that, and turns very slowly
  vec3 up = normalize(uKnot.xyz + vec3(0.0, 1e-5, 0.0));
  vec3 to = normalize(-uKnot.xyz);
  vec3 r = normalize(cross(up, to));
  float a = uTime * 0.6 + vArm * 2.094;
  vec3 ax = r * cos(a) + cross(up, r) * sin(a);
  float s = 0.42 * uKnot.w;
  vec3 p = uKnot.xyz + up * (position.y * s * 1.9 + s * 1.1) + ax * (position.x * s);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
  ${VERT_END}
}
`;

const KNOT_FRAG = /* glsl */`
${FRAG_PARS}
uniform vec4 uKnot;
varying vec2 vQ;
varying vec3 vView;
varying float vArm;
void main() {
  #include <logdepthbuf_fragment>
  if (uKnot.w < 0.01) discard;
  // a stroke drawn to a point at both ends, with a bright heart: the mark a brush leaves standing on end
  float w = 1.0 - vQ.y * vQ.y;
  if (abs(vQ.x) > w * 0.42) discard;
  float e = abs(vQ.x) / max(w * 0.42, 1e-3);
  float beat = 0.72 + 0.28 * sin(uTime * 2.3 + vArm * 1.7);
  vec3 col = mix(vec3(1.0, 0.97, 0.86), vec3(0.62, 0.84, 1.00), smoothstep(0.1, 0.9, e));
  float a = (1.0 - smoothstep(0.55, 1.0, e)) * (0.45 + 0.55 * w) * beat * uKnot.w;
  if (a < 0.30) discard;                                        // a mark, not a glow: see the bubble above
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

  // the knot: three crossed strokes standing on the ground
  const kg = new THREE.BufferGeometry();
  const pos = [], idx = [];
  for (let a = 0; a < 3; a++) {
    const o = a * 4;
    pos.push(-1, -1, a, 1, -1, a, -1, 1, a, 1, 1, a);
    idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
  }
  kg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  kg.setIndex(idx);
  const kmat = new THREE.ShaderMaterial({
    name: 'pc-knot',
    uniforms: makePaintUniforms(bodyUniforms, { uKnot: { value: new THREE.Vector4(0, 0, 0, 0) }, uSceneAux: G.uSceneAux, uSceneRes: G.uSceneRes }),
    vertexShader: KNOT_VERT, fragmentShader: KNOT_FRAG,
    side: THREE.DoubleSide,
  });
  kmat.userData.pcPainted = true;
  register(kmat, 'glaze');
  const knot = new THREE.Mesh(kg, kmat);
  knot.name = 'pc-knot';
  knot.frustumCulled = false; knot.matrixAutoUpdate = false; knot.visible = false;

  let bound = bodyUniforms || null;
  return {
    mesh, knot,
    // Every frame: the eye in the scene and in the body's own axes, the body's root and its uniforms, and the
    // player's own time (physics/times.js, with the knot stashed on it: see core/powers.js).
    update(cameraPos, root, camL, bodyU, times, bodyId) {
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
      // the knot, if one is tied on this world
      const k = live && live.knot && live.knot.bodyId === bodyId ? live.knot : null;
      knot.visible = !!k;
      if (k) {
        if (bodyU !== bound) { bindBodyUniforms(mat, bodyU); bindBodyUniforms(kmat, bodyU); bound = bodyU; }
        kmat.uniforms.uKnot.value.set(k.p.x - camL.x, k.p.y - camL.y, k.p.z - camL.z, 1);
        knot.position.copy(cameraPos); knot.quaternion.copy(root.quaternion); knot.updateMatrix(); knot.matrixWorld.copy(knot.matrix); knot.matrixWorldNeedsUpdate = false;
      }
    },
  };
}
