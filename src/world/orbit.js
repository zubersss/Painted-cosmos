// Painted Cosmos: what a body wears when seen from outside: ring arcs and the cloud layer.
// OWNER: PAINTER. Both are ordinary scene geometry (depth-tested, no blending), so rings also
// cross the sky when you stand on the planet, and clouds part where the painting shows through.
import * as THREE from 'three';
import { G, ensureGlobals } from '../render/shared.js';
import { VERT_PARS, VERT_END, FRAG_PARS } from '../render/chunks.js';

const RING_VERT = /* glsl */`
${VERT_PARS}
varying vec3 vPos;
varying vec3 vView;
void main() {
  vPos = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
  ${VERT_END}
}`;
const RING_FRAG = /* glsl */`
${FRAG_PARS}
uniform vec3 uColor;
uniform vec2 uRadii;
varying vec3 vPos;
varying vec3 vView;
void main() {
  #include <logdepthbuf_fragment>
  float r = (length(vPos.xy) - uRadii.x) / (uRadii.y - uRadii.x);
  // bands of wash laid side by side, with gaps of bare paper between them
  vec4 n = texture(uNoise3D, vec3(r * 2.3, 0.37, 0.11));
  vec4 n2 = texture(uNoise3D, vec3(r * 9.1, 0.71, 0.53));
  float band = n.r * 0.65 + n2.g * 0.35;
  float gap = smoothstep(0.40, 0.46, band) * smoothstep(0.0, 0.05, r) * (1.0 - smoothstep(0.93, 1.0, r));
  if (gap < 0.5) discard;
  vec4 t = texture(uNoise3D, vPos * 0.00021);
  vec3 c = pcDensity(mix(uColor, vec3(1.0), 0.25 + 0.5 * n2.b), 0.75 + band * 0.9 + (t.r - 0.5) * 0.6);
  // the far side of the ring falls in the planet's shadow
  vec3 sunL = normalize(uSunDirL);
  vec3 p = vPos.xzy * vec3(1.0, 1.0, 1.0);
  pcWrite(c, 1.0, vec3(0.0, 0.0, 1.0), -vView.z, 0.5);
}`;

export function makeRing(bodyU, R, rings) {
  ensureGlobals();
  const geo = new THREE.RingGeometry(R * rings.inner, R * rings.outer, 128, 1);
  const mat = new THREE.ShaderMaterial({
    name: 'pc-ring',
    uniforms: Object.assign({ uNoise3D: G.uNoise3D, uStrokeTex: G.uStrokeTex, uTime: G.uTime, uColor: { value: new THREE.Vector3().fromArray(rings.color) }, uRadii: { value: new THREE.Vector2(R * rings.inner, R * rings.outer) } }, bodyU),
    vertexShader: RING_VERT, fragmentShader: RING_FRAG, side: THREE.DoubleSide,
  });
  mat.userData.pcPainted = true;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = Math.PI / 2;     // into the equatorial plane
  mesh.name = 'pc-ring';
  return mesh;
}

const CLOUD_VERT = /* glsl */`
${VERT_PARS}
varying vec3 vPos;
varying vec3 vNV;
varying vec3 vView;
void main() {
  vPos = position;
  vNV = normalMatrix * normal;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
  ${VERT_END}
}`;
const CLOUD_FRAG = /* glsl */`
${FRAG_PARS}
uniform vec4 uCloud;      // coverage, feature size, drift, bands
uniform vec3 uBandA;
uniform vec3 uBandB;
varying vec3 vPos;
varying vec3 vNV;
varying vec3 vView;
void main() {
  #include <logdepthbuf_fragment>
  vec3 q = vPos / uCloud.y + vec3(uTime * uCloud.z, 0.0, uTime * uCloud.z * 0.6);
  float c1 = texture(uNoise3D, q).r, c2 = texture(uNoise3D, q * 2.7 + 0.31).g, c3 = texture(uNoise3D, q * 7.3).b;
  float v = c1 * 0.60 + c2 * 0.28 + c3 * 0.12;
  // banded worlds: the cloud deck follows the latitude in long soft stripes
  float lat = normalize(vPos).y;
  float stripe = 0.5 + 0.5 * sin(lat * 15.0 + (c1 - 0.5) * 3.0);
  v += (stripe - 0.5) * 0.30 * uCloud.w;
  float th = 1.0 - uCloud.x;
  if (v < th) discard;
  vec3 nV = normalize(vNV);
  vec3 sunV = normalize((viewMatrix * vec4(uSunDirW, 0.0)).xyz);
  float x = dot(nV, sunV) * 0.5 + 0.5 + (c2 - 0.5) * 0.25;
  vec3 c = mix(vec3(1.0), mix(uBandA, uBandB, stripe), 0.30 + uCloud.w * 0.60);
  c = pcDensity(c, 0.8 + smoothstep(th, th + 0.25, v) * 0.7);
  c = pcTone(c, pcLevel(x, 0.08));
  float limb = pow(1.0 - clamp(dot(nV, normalize(-vView)), 0.0, 1.0), 2.5);
  c = mix(c, mix(uHaze, vec3(1.0), 0.4), limb);
  pcWrite(c, 1.0, nV, -vView.z, 0.6);
}`;

export function makeCloudShell(bodyU, radius, look) {
  ensureGlobals();
  const sky = look.sky.day;
  const mat = new THREE.ShaderMaterial({
    name: 'pc-cloudshell',
    uniforms: Object.assign({
      uNoise3D: G.uNoise3D, uStrokeTex: G.uStrokeTex, uTime: G.uTime,
      uCloud: { value: new THREE.Vector4(look.cloud, 2600, 0.0006, look.bands || 0) },
      uBandA: { value: new THREE.Vector3().fromArray(sky.horizon) }, uBandB: { value: new THREE.Vector3().fromArray(look.deck || sky.cloudShade) },
    }, bodyU),
    vertexShader: CLOUD_VERT, fragmentShader: CLOUD_FRAG,
  });
  mat.userData.pcPainted = true;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 40), mat);
  mesh.name = 'pc-cloudshell';
  mesh.visible = false;
  return mesh;
}
