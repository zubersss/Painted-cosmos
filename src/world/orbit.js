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
// The rings' own drawing from the inner edge to the outer (r: 0..1), shared by the ring's geometry
// (seen from space) and the arc laid into the sky (seen from the ground), so the two agree:
// a thin inner ring, the broad pale ring, the dark division, the outer ring with a hair-line gap.
// -> x: how much wash lies there (0: a gap, the sky shows through), y: how pale it is (1: bare paper)
export const RING_PROFILE = /* glsl */`
vec2 pcRingProfile(float r, vec4 n, vec4 n2) {
  float w = (n.r - 0.5) * 0.012;                                                            // the hand's wobble
  float c = smoothstep(0.02, 0.06, r) * (1.0 - smoothstep(0.215 + w, 0.245 + w, r));
  float b = smoothstep(0.245 + w, 0.30 + w, r) * (1.0 - smoothstep(0.615 - w, 0.645 - w, r));
  float a = smoothstep(0.715 + w, 0.745 + w, r) * (1.0 - smoothstep(0.94, 0.99, r));
  float hair = 1.0 - 0.85 * smoothstep(0.868, 0.876, r) * (1.0 - smoothstep(0.888, 0.896, r));
  float on = max(max(c * 0.5, b), a * hair);
  float ringlets = 0.5 + 0.5 * smoothstep(0.30, 0.70, n2.g);                                // band beside band: denser, thinner
  float pale = b * (0.62 + 0.38 * ringlets) + a * (0.34 + 0.26 * ringlets) + c * 0.12;
  return vec2(on, clamp(pale, 0.0, 1.0));
}`;
const RING_FRAG = /* glsl */`
${FRAG_PARS}
uniform vec3 uColor;
uniform vec2 uRadii;
varying vec3 vPos;
varying vec3 vView;
${RING_PROFILE}
void main() {
  #include <logdepthbuf_fragment>
  float r = (length(vPos.xy) - uRadii.x) / (uRadii.y - uRadii.x);
  // bands of wash laid side by side, with gaps of bare paper between them
  vec4 n = texture(uNoise3D, vec3(r * 2.3, 0.37, 0.11));
  vec4 n2 = texture(uNoise3D, vec3(r * 9.1, 0.71, 0.53));
  vec2 pr = pcRingProfile(r, n, n2);
  if (pr.x < 0.42) discard;
  vec4 t = texture(uNoise3D, vPos * 0.00021);
  // (the plane's own coordinates are x, y: the ring's mesh lies in its local xy and is turned into the equator)
  vec3 c = pcDensity(mix(uColor, vec3(1.0), 0.06 + 0.36 * pr.y), 0.85 + (1.0 - pr.y) * 1.05 + (t.r - 0.5) * 0.6 + (n2.b - 0.5) * 0.3);
  // the far side of the ring lies in the planet's shadow: a cool glaze over the wash
  vec3 pl = vec3(vPos.x, 0.0, vPos.y);
  vec3 sunL = normalize(uSunDirL);
  float al = dot(pl, sunL);
  float shadow = al > 0.0 ? 0.0 : 1.0 - smoothstep(uRadii.x * 0.70, uRadii.x * 0.78, length(pl - sunL * al));
  c = mix(c, pcDensity(c * vec3(0.52, 0.54, 0.74), 1.5), shadow * 0.85);
  pcWrite(c, 1.0, vec3(0.0, 0.0, 1.0), -vView.z, 0.5);
}`;

export function makeRing(bodyU, R, rings) {
  ensureGlobals();
  const geo = new THREE.RingGeometry(R * rings.inner, R * rings.outer, 128, 1);
  const mat = new THREE.ShaderMaterial({
    name: 'pc-ring',
    uniforms: Object.assign({ uNoise3D: G.uNoise3D, uStrokeTex: G.uStrokeTex, uTime: G.uTime, uAux8: G.uAux8, uColor: { value: new THREE.Vector3().fromArray(rings.color) }, uRadii: { value: new THREE.Vector2(R * rings.inner, R * rings.outer) } }, bodyU),
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
uniform vec4 uCloud;      // coverage, feature size, drift, bands (0 = scattered cloud, 1 = a full banded deck)
uniform vec4 uDeck;       // number of belts pole to pole, how far the weather pushes their edges, white streaks, wetness
uniform vec4 uAxis;       // xyz: the axis the belts turn about (unit, body-local); w: matte, 0..1 (no sunlit wash on the deck)
uniform vec3 uBandA;
uniform vec3 uBandB;
uniform vec4 uSpot;      // a great storm: unit direction, and its angular radius (0 = none)
uniform vec3 uSpotCol;
uniform float uLimbCos;   // the cosine, on the shell, at which the line of sight just clears the world's own limb
varying vec3 vPos;
varying vec3 vNV;
varying vec3 vView;
void main() {
  #include <logdepthbuf_fragment>
  vec3 q = vPos / uCloud.y + vec3(uTime * uCloud.z, 0.0, uTime * uCloud.z * 0.6);
  float c1 = texture(uNoise3D, q).r, c2 = texture(uNoise3D, q * 2.7 + 0.31).g, c3 = texture(uNoise3D, q * 7.3).b;
  float v = c1 * 0.60 + c2 * 0.28 + c3 * 0.12;
  // banded worlds: belts of wash laid along the latitude, their edges pushed about by the weather
  vec3 nrm = normalize(vPos);
  // (the belts' axis is the look's own, deck.axis: Neptune's first landing is at 72 degrees north, and belts about the
  // body's pole were rings concentric with the limb from above it, reflections on a glass ball; M4 critique, item 3)
  float lat = asin(clamp(dot(nrm, uAxis.xyz), -1.0, 1.0)) / 1.5708;
  float wob = ((c1 - 0.5) + (c2 - 0.5) * 0.45) * uDeck.y;
  float sv = sin((lat + wob) * uDeck.x * 3.14159 + 0.6);
  float stripe = smoothstep(-0.20, 0.20, sv + (c3 - 0.5) * 0.35);
  v += (stripe - 0.5) * 0.30 * uCloud.w;
  // the great storm: an oval twice as long as it is tall, turning on itself
  float storm = 0.0, spiral = 0.0;
  if (uSpot.w > 0.0) {
    vec3 sd = normalize(uSpot.xyz);
    vec3 east = normalize(cross(vec3(0.0, 1.0, 0.0), sd));
    vec3 north = cross(sd, east);
    vec3 dv = nrm - sd;
    float de = dot(dv, east) * 0.55, dn = dot(dv, north);
    float r = length(vec2(de, dn)) / uSpot.w;
    spiral = sin(atan(dn, abs(de) + abs(dn) > 0.0 ? de : 1.0) * 2.0 + r * 8.0 + (c2 - 0.5) * 3.5);
    storm = (1.0 - smoothstep(0.72, 1.0, r + (c2 - 0.5) * 0.22)) * step(0.0, dot(nrm, sd));
  }
  float th = 1.0 - uCloud.x;
  vec3 nV = normalize(vNV);
  // scattered cloud thins away toward the limb and is not drawn beyond the world's own edge: the globe keeps
  // one soft outline (cloud standing out past the limb was a ragged hard fringe against space)
  float ndv = clamp(dot(nV, normalize(-vView)), 0.0, 1.0);
  float edge = (1.0 - uCloud.w) * (1.0 - smoothstep(uLimbCos + 0.04, uLimbCos + 0.30, ndv));
  if (max(v, storm * uCloud.x) < th + edge * 0.6) discard;
  vec3 sunV = normalize((viewMatrix * vec4(uSunDirW, 0.0)).xyz);
  float x = dot(nV, sunV) * 0.5 + 0.5 + (c2 - 0.5) * 0.25;
  vec3 belt = mix(uBandA, uBandB, stripe);
  vec3 c = mix(mix(vec3(1.0), belt, 0.30), belt, uCloud.w);
  c = pcDensity(c, 0.8 + smoothstep(th, th + 0.25, v) * 0.7 + (c1 - 0.5) * 0.5 * uCloud.w);
  // white streaks of high cloud drawn out along the wind: bare paper
  float streak = smoothstep(0.64, 0.72, texture(uNoise3D, vec3(q.x * 0.45, q.y * 3.6, q.z * 0.45) + 0.4).r + (c3 - 0.5) * 0.15);
  c = mix(c, vec3(1.0), streak * uDeck.z);
  c = mix(c, pcDensity(uSpotCol, 1.0 + spiral * 0.5), storm);
  // (matte: a deck of saturated wash takes no sunlit wash: the lit side of Neptune was a pale lobe following the limb,
  // lighter than the belts beside it. Its day side is the belts' own colour; the terminator still falls into the glaze)
  c = pcTone(c, pcLevel(mix(x, min(x, 0.62), uAxis.w), 0.08));
  float limb = pow(1.0 - ndv, 2.5) * uFog.w;
  c = mix(c, mix(uHaze, vec3(1.0), 0.4), limb);
  // the edge of a cloud is wet: it runs into the wash beneath instead of standing as a cut shape
  pcWrite(c, mix(1.0, uDeck.w, uCloud.w), nV, -vView.z, 0.6);
}`;

export function makeCloudShell(bodyU, radius, look, stormDir) {
  ensureGlobals();
  const sky = look.sky.day, D = look.deck || {};
  const mat = new THREE.ShaderMaterial({
    name: 'pc-cloudshell',
    uniforms: Object.assign({
      uNoise3D: G.uNoise3D, uStrokeTex: G.uStrokeTex, uTime: G.uTime, uAux8: G.uAux8,
      uCloud: { value: new THREE.Vector4(look.cloud, 2600, 0.0006, look.bands ? 1 : 0) },
      uLimbCos: { value: 0.4 },
      uDeck: { value: new THREE.Vector4(D.belts || 7, D.wobble == null ? 0.10 : D.wobble, D.streaks || 0, D.wet == null ? 0.55 : D.wet) },
      uAxis: { value: (() => { const a = new THREE.Vector3().fromArray(D.axis || [0, 1, 0]).normalize(); return new THREE.Vector4(a.x, a.y, a.z, D.matte || 0); })() },
      uBandA: { value: new THREE.Vector3().fromArray(D.a || sky.horizon) }, uBandB: { value: new THREE.Vector3().fromArray(D.b || sky.cloudShade) },
      uSpot: { value: stormDir ? new THREE.Vector4(stormDir.x, stormDir.y, stormDir.z, D.storm ? D.storm.size : 0.22) : new THREE.Vector4(0, 1, 0, 0) },
      uSpotCol: { value: new THREE.Vector3().fromArray((D.storm && D.storm.color) || [0.80, 0.36, 0.30]) },
    }, bodyU),
    vertexShader: CLOUD_VERT, fragmentShader: CLOUD_FRAG,
  });
  mat.userData.pcPainted = true;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 40), mat);
  mesh.name = 'pc-cloudshell';
  mesh.visible = false;
  return mesh;
}
