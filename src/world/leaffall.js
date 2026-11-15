// Painted Cosmos: leaves falling through the air of an autumn wood (the oil look only). OWNER: PAINTER.
//
// The owner's reference clip has a few large, slow leaves in the air of its wood, some close to the lens. Here: a few
// dozen leaves in a cube of air round the eye. Each has its place in a lattice fixed to the BODY (the cube wraps round
// the eye as it moves, so a leaf stays where it is in the world), falls at its own speed, sways and tumbles. A leaf is
// one flat colour, pointed at both ends like the dabs on the ground, in the sun or in the shade whole (the shadow map,
// render/shadow.js). Everything is worked out in the vertex shader from the wash clock: nothing is kept between frames,
// and a frozen clock (the gallery's &t=) gives the same leaves every time.
import * as THREE from 'three';
import { makePaintUniforms, bindBodyUniforms } from '../render/materials.js';
import { VERT_PARS, VERT_END, FRAG_PARS } from '../render/chunks.js';
import { register } from '../render/shared.js';

const N = 80, CUBE = 26;

const VERT = /* glsl */`
${VERT_PARS}
attribute vec4 aLeaf;     // xyz: its place in the cube (0..1); w: its number
uniform vec3 uCamL;       // the eye, body-local metres
uniform vec4 uLeafK;      // x: the share of the leaves in the air now (0: none), y: the cube's side (m)
uniform float uTime;
varying vec3 vBody;
varying vec3 vView;
varying vec3 vNV;
varying vec2 vQ;
varying float vH;
void main() {
  float h = aLeaf.w, t = uTime, Lc = uLeafK.y;
  vec3 up = normalize(uCamL);
  vec3 e1 = normalize(cross(up, vec3(0.31, 0.74, 0.59))), e2 = cross(up, e1);
  float speed = 0.40 + 0.55 * fract(h * 7.31);
  vec3 wp = aLeaf.xyz * Lc - up * (speed * t)
          + (e1 * sin(t * (0.5 + fract(h * 3.7)) + h * 40.0) + e2 * cos(t * (0.4 + fract(h * 5.1)) + h * 17.0)) * 0.45;
  vec3 rel = (fract((wp - uCamL) / Lc) - 0.5) * Lc;          // from the eye, in the body's axes
  // it tumbles: its long axis turns, and it rolls about it
  float a = h * 50.0 + t * (0.8 + 1.4 * fract(h * 9.1));
  vec3 a1 = normalize(vec3(sin(a), 0.35 * cos(a * 0.7), cos(a)));
  vec3 a2 = normalize(cross(a1, normalize(vec3(cos(a * 0.6), 1.0, sin(a * 0.5)))));
  float size = 0.075 + 0.07 * fract(h * 11.3);
  // none at the lens, none at the cube's faces (a leaf does not pop as the cube wraps), and only this hour's share
  float edge = max(abs(rel.x), max(abs(rel.y), abs(rel.z))) / Lc;
  float keep = smoothstep(0.6, 1.6, length(rel)) * (1.0 - smoothstep(0.40, 0.49, edge)) * step(fract(h * 13.7), uLeafK.x - 0.001);
  vec3 p = rel + (a1 * position.x * size + a2 * position.y * size * 0.5) * keep;
  vBody = uCamL + rel;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vView = mv.xyz;
  vNV = normalMatrix * cross(a1, a2);
  vQ = position.xy; vH = h;
  gl_Position = projectionMatrix * mv;
  ${VERT_END}
}
`;

const FRAG = /* glsl */`
${FRAG_PARS}
varying vec3 vBody;
varying vec3 vView;
varying vec3 vNV;
varying vec2 vQ;
varying float vH;
void main() {
  #include <logdepthbuf_fragment>
  // a leaf: pointed at both ends
  if (abs(vQ.y) > 1.0 - vQ.x * vQ.x) discard;
  float k = fract(vH * 23.7);
  vec3 col = k < 0.42 ? vec3(0.97, 0.82, 0.27) : k < 0.72 ? vec3(0.94, 0.58, 0.22) : k < 0.88 ? vec3(0.84, 0.32, 0.20) : vec3(0.60, 0.40, 0.24);
  #ifdef PC_OIL
    float sun = pcSunAt(vBody, 0.0, 0.0, 0.1);
  #else
    float sun = 1.0;
  #endif
  vec3 c = pcTone(col, mix(1.1, 2.8, sun) - 0.5 * abs(vQ.y));
  c = pcAtmosV(c, pcFogAmount(length(vView)), vView);
  pcWrite(c, 1.0, normalize(vNV), -vView.z, 7.0 + fract(vH * 3.3) * 0.9);
}
`;

export function makeLeafFall(bodyUniforms) {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0], 3));
  g.setIndex([0, 1, 2, 1, 3, 2]);
  const a = new Float32Array(N * 4);
  let s = 12345;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < N; i++) { a[i * 4] = rnd(); a[i * 4 + 1] = rnd(); a[i * 4 + 2] = rnd(); a[i * 4 + 3] = rnd(); }
  g.setAttribute('aLeaf', new THREE.InstancedBufferAttribute(a, 4));
  g.instanceCount = N;
  const mat = new THREE.ShaderMaterial({
    name: 'pc-leaffall',
    uniforms: makePaintUniforms(bodyUniforms, { uCamL: { value: new THREE.Vector3(0, 4000, 0) }, uLeafK: { value: new THREE.Vector4(0, CUBE, 0, 0) } }),
    vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide,
  });
  mat.userData.pcPainted = true;
  register(mat, 'leaf');
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'pc-leaffall';
  mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = false;
  mesh.visible = false;
  let bound = bodyUniforms || null;
  return {
    mesh,
    // every frame: the eye in the scene and in the body's space, the body's root and uniforms, how many leaves (0..1)
    update(cameraPos, root, camL, bodyU, share) {
      mesh.visible = share > 0.01;
      if (!mesh.visible) return;
      if (bodyU !== bound) { bindBodyUniforms(mat, bodyU); bound = bodyU; }
      mat.uniforms.uCamL.value.copy(camL);
      mat.uniforms.uLeafK.value.x = Math.min(1, share);
      mesh.position.copy(cameraPos); mesh.quaternion.copy(root.quaternion);
      mesh.updateMatrix();
    },
  };
}
