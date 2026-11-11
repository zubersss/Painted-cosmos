// Painted Cosmos: the sky wash, clouds, sun and (simple, for now) space. OWNER: PAINTER.
// One full-screen triangle drawn last at the far plane. Everything is evaluated per view ray in
// the active body's local frame, so clouds and wash variation are anchored to the planet.
import * as THREE from 'three';
import { G, ensureGlobals } from '../render/shared.js';

const SKY_VERT = /* glsl */`
uniform vec2 uProjScale;
uniform mat3 uCamRot;      // camera rotation, scene space
uniform mat3 uBodyInv;     // scene -> body-local rotation
varying vec3 vDirL;
varying vec3 vDirW;
void main() {
  vec3 dv = vec3(position.xy * uProjScale, -1.0);
  vDirW = uCamRot * dv;
  vDirL = uBodyInv * vDirW;
  #ifdef USE_REVERSED_DEPTH_BUFFER
    gl_Position = vec4(position.xy, 0.0, 1.0);
  #else
    gl_Position = vec4(position.xy, 1.0, 1.0);
  #endif
}
`;

const SKY_FRAG = /* glsl */`
uniform highp sampler3D uNoise3D;
uniform sampler2D uStrokeTex;
uniform vec3 uSunDirL;
uniform vec3 uCamL;         // camera position, body-local
uniform vec3 uSkyZenith;
uniform vec3 uSkyHorizon;
uniform vec3 uHaze;
uniform vec3 uCloudShade;
uniform vec4 uCloud;        // shell radius, coverage, feature size (m), drift
uniform vec4 uAtmo;         // space01 (0 on the ground .. 1 in space), dayness, sun angular radius, body radius
uniform vec4 uWxSky;        // weather: x overcast, y storm, z rain veil, w snow veil
uniform vec3 uStormWash;    // this world's heavy-weather pigment (its cloud shadow laid dense, glazed with indigo)
uniform float uTime;
varying vec3 vDirL;
varying vec3 vDirW;
layout(location = 1) out highp vec4 pcAux;

vec3 dens(vec3 c, float d) { return clamp(c - (c - c * c) * (d - 1.0), 0.0, 1.0); }

void main() {
  vec3 d = normalize(vDirL);
  vec3 up = normalize(uCamL);
  float e = dot(d, up);
  float sd = dot(d, uSunDirL);
  float sunE = dot(uSunDirL, up);

  // ---- the wash: strong at the zenith, thinning to bare paper at the horizon
  float t = pow(1.0 - clamp(e, 0.0, 1.0), 2.4);
  vec3 sky = mix(uSkyZenith, uSkyHorizon, t);
  // the horizon glows toward the sun at dawn and dusk
  float toward = pow(max(sd, 0.0), 3.0) * (1.0 - smoothstep(0.0, 0.5, sunE));
  sky = mix(sky, uSkyHorizon, toward * 0.65);
  // (overcast: the world has already turned the zenith and horizon keys into one heavy wash of
  // its storm pigment, dense overhead and running thinner toward a paler band above the horizon)
  float oc = uWxSky.x;
  // turbulence and the odd backrun: no flat colour anywhere in a wet wash
  vec4 n1 = texture(uNoise3D, d * 1.3 + 0.17);
  vec4 n2 = texture(uNoise3D, d * 4.1);
  float turb = (n1.r - 0.5) * 0.9 + (n2.g - 0.5) * 0.35;
  float bf = n1.a + (n2.b - 0.5) * 0.10;
  float back = smoothstep(0.84, 0.90, bf) * (1.0 - smoothstep(0.90, 0.95, bf));
  sky = dens(sky, 1.0 + turb * (1.0 - t * 0.7) * (1.0 + oc * 0.7) + back * 0.38 * (1.0 - t));
  sky = mix(sky, vec3(1.0), smoothstep(0.90, 0.97, bf) * 0.22 * (1.0 - t));
  // below the horizon (seen from high up): haze
  sky = mix(sky, uHaze, 1.0 - smoothstep(-0.12, 0.02, e));

  // ---- clouds: bare paper with soft violet undersides, on a shell around the planet
  float rc = length(uCamL);
  float b = dot(uCamL, d);
  float disc = b * b - (rc * rc - uCloud.x * uCloud.x);
  float cloud = 0.0, shade = 0.0, body = 0.0, belly = 0.5;
  if (uCloud.y > 0.001 && disc > 0.0) {
    float tt = rc < uCloud.x ? (-b + sqrt(disc)) : (-b - sqrt(disc));
    if (tt > 0.0) {
      vec3 hp = uCamL + d * tt;
      vec3 q = hp / uCloud.z + vec3(uTime * uCloud.w, 0.0, uTime * uCloud.w * 0.6);
      float c1 = texture(uNoise3D, q).r;
      float c2 = texture(uNoise3D, q * 2.7 + 0.31).g;
      float c3 = texture(uNoise3D, q * 7.3).b;
      float v = c1 * 0.60 + c2 * 0.28 + c3 * 0.12;
      float th = 1.0 - uCloud.y;
      // crisp on the upper edge, wet and soft on the lower
      cloud = smoothstep(th - 0.02, th + 0.09, v);
      float toSun = texture(uNoise3D, q + uSunDirL * 0.09).r * 0.60 + texture(uNoise3D, (q + uSunDirL * 0.09) * 2.7 + 0.31).g * 0.28 + c3 * 0.12;
      shade = smoothstep(0.0, 0.10, toSun - v + 0.02) * smoothstep(th + 0.02, th + 0.16, v);
      float fade = rc < uCloud.x ? smoothstep(0.015, 0.20, e) : 1.0;
      cloud *= fade;
      body = smoothstep(th + 0.02, th + 0.30, v);
      belly = smoothstep(th + 0.06, th + 0.50, v + (c2 - 0.5) * 0.25);
    }
  }
  // (at night a cloud is a pale shape lifted out of the wash, not bare paper: paper is kept for the stars)
  vec3 cl = mix(mix(mix(uSkyHorizon, vec3(1.0), 0.22), vec3(1.0), uAtmo.y), uCloudShade, shade * 0.9);
  cl = dens(cl, 1.0 + (n2.r - 0.5) * 0.8);
  // under an overcast the cloud is no longer bare paper: it is the wash itself, in heavy masses
  // with dark bellies; their torn edges stay pale, where the light still comes through
  vec3 mass = dens(uStormWash, 0.10 + 1.25 * belly + 0.3 * uWxSky.y + (n2.r - 0.5) * 0.4);
  cl = mix(cl, mass, oc * (0.30 + 0.70 * body));
  vec3 col = mix(sky, cl, cloud);

  // rain or snow falling from the cloud base, far off: soft slanted drags of the wet wash,
  // strongest low in the sky (anchored to the planet: they do not turn with the camera)
  float veil = max(uWxSky.z, uWxSky.w);
  if (veil > 0.01) {
    vec3 hz = normalize(d - up * e + up * 1e-4);
    vec3 side = cross(up, hz);
    vec3 vq = hz * 1.7 + side * (e * 1.1) + up * (e * 0.30) + vec3(uTime * 0.004, 0.0, 0.0);
    float drag = texture(uNoise3D, vq).r * 0.75 + texture(uNoise3D, vq * 2.3 + 0.3).g * 0.25;
    float low = (1.0 - smoothstep(0.03, 0.62, e)) * smoothstep(-0.10, 0.03, e);
    col = dens(col, 1.0 + (smoothstep(0.30, 0.78, drag) - 0.35) * low * uWxSky.z * 1.05);
    // falling snow whitens the low sky instead: the far world goes to paper
    col = mix(col, vec3(0.985, 0.985, 0.99), uWxSky.w * low * (0.35 + 0.45 * smoothstep(0.35, 0.65, drag)));
  }

  // ---- the sun: bare paper with a warm halo
  float ang = acos(clamp(sd, -1.0, 1.0));
  float halo = exp(-ang * 7.0) * 0.75 + exp(-ang * 28.0) * 0.6;
  col = mix(col, vec3(1.0, 0.985, 0.93), clamp(halo, 0.0, 1.0) * (1.0 - cloud * 0.6) * (1.0 - oc * 0.9));
  float sun = 1.0 - smoothstep(uAtmo.z * 0.82, uAtmo.z, ang + (n2.b - 0.5) * 0.012);
  col = mix(col, vec3(1.0), sun * (1.0 - cloud * 0.5) * (1.0 - oc));

  // ---- space: deep indigo and Payne's grey washes in layers, salt blooms, a violet drift.
  // (The stars are not painted here: the brush would take them. They are spattered on
  // afterwards as a glaze, see makeSkyGlaze; this pass only says where they may lie.)
  float starOK = 0.0;
  if (uAtmo.x > 0.001 || uAtmo.y < 0.999) {
    vec3 dw = normalize(vDirW);
    vec4 s1 = texture(uNoise3D, dw * 0.9 + 0.4);
    vec4 s2 = texture(uNoise3D, dw * 2.9);
    vec3 sp = mix(vec3(0.20, 0.24, 0.45), vec3(0.34, 0.37, 0.52), s1.r);
    sp = mix(sp, vec3(0.42, 0.33, 0.57), smoothstep(0.55, 0.80, s1.g) * 0.6);          // a violet nebula drift, wet in wet
    sp = dens(sp, 1.0 + (s2.g - 0.5) * 0.9 + (s1.b - 0.5) * 0.7);
    // a second wash laid over the first when it had dried: its edge is crisp here, lost there
    float lay = s1.a * 0.62 + s2.r * 0.38;
    float edgeW = mix(0.012, 0.10, smoothstep(0.35, 0.65, s2.a));
    float over = smoothstep(0.50 - edgeW, 0.50 + edgeW, lay);
    sp = dens(sp, 1.0 + over * 0.50 + (1.0 - smoothstep(0.0, 0.035, abs(lay - 0.50))) * over * 0.22);
    // a pale bloom where water ran back into the wash (a nebula), and salt
    float bloom = smoothstep(0.62, 0.86, s1.b * 0.7 + s2.b * 0.3) * (1.0 - over * 0.6);
    sp = mix(sp, vec3(0.70, 0.66, 0.80), bloom * 0.42);
    vec4 sa = texture(uNoise3D, dw * 6.3 + 0.2);
    float salt = smoothstep(0.66, 0.80, sa.r * 0.6 + s2.b * 0.4);                         // salt: pale crystalline blooms
    sp = mix(sp, vec3(0.62, 0.66, 0.82), salt * 0.50);
    float sunS = 1.0 - smoothstep(uAtmo.z * 0.82, uAtmo.z, ang);
    sp = mix(sp, vec3(1.0, 0.985, 0.93), clamp(halo, 0.0, 1.0));
    sp = mix(sp, vec3(1.0), sunS);
    col = mix(col, sp, uAtmo.x);
    // stars: in space everywhere but in the sun's glare; from the ground at night, above the
    // horizon haze and where no cloud lies
    float night = (1.0 - uAtmo.y) * (1.0 - cloud) * (1.0 - oc) * smoothstep(0.03, 0.30, e);
    starOK = mix(night, 1.0, uAtmo.x) * (1.0 - clamp(halo * 1.6, 0.0, 1.0));
  }

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), mix(1.0, 0.45, uAtmo.x));
  pcAux = vec4(starOK, 0.0, 20.0, 0.0);     // (x: where stars may lie; the sky has no normal to store)
}
`;

export function makeSkyUniforms() {
  ensureGlobals();
  return {
    uNoise3D: G.uNoise3D, uStrokeTex: G.uStrokeTex, uTime: G.uTime,
    uSunDirL: { value: new THREE.Vector3(0.3, 0.8, 0.5).normalize() },
    uCamL: { value: new THREE.Vector3(0, 4000, 0) },
    uSkyZenith: { value: new THREE.Vector3(0.50, 0.69, 0.90) },
    uSkyHorizon: { value: new THREE.Vector3(0.90, 0.94, 0.97) },
    uHaze: { value: new THREE.Vector3(0.93, 0.955, 0.975) },
    uCloudShade: { value: new THREE.Vector3(0.80, 0.80, 0.90) },
    uCloud: { value: new THREE.Vector4(4600, 0.45, 2600, 0.0006) },
    uAtmo: { value: new THREE.Vector4(0, 1, 0.045, 4000) },
    uWxSky: { value: new THREE.Vector4(0, 0, 0, 0) },
    uStormWash: { value: new THREE.Vector3(0.48, 0.50, 0.68) },
    uProjScale: { value: new THREE.Vector2(1, 1) },
    uCamRot: { value: new THREE.Matrix3() },
    uBodyInv: { value: new THREE.Matrix3() },
  };
}

// ------------------------------------------------------------------------------------------
// The sky's glaze: what is laid over the brushed sky afterwards (see shared.js GLAZES).
//   Stars: spattered masking fluid. Round soft dots of bare paper, most of them small, a few
//   large, fixed among themselves (scene directions); the sky pass says where they may lie.
//   Pulse streaks: when the drive is on, long soft drags of the brush run out from the point
//   the ship flies toward: pale ones lifted out of the wash and a few darker ones, each with a
//   loaded start and a dry, broken tail. They flow outward; nothing in them is a hard line.
// ------------------------------------------------------------------------------------------
const GLAZE_FRAG = /* glsl */`
uniform highp sampler3D uNoise3D;
uniform highp sampler2D uSceneAux;
uniform vec2 uSceneRes;
uniform vec4 uAtmo;
uniform vec4 uStreak;       // x strength 0..1, y flow (the painter's clock), z one pixel (tangent), w -
uniform vec3 uTravel;       // where the ship is going, scene space (unit)
varying vec3 vDirW;
float h21(vec2 p) { vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
// one layer of spatter on a cube map: at most one star a cell
float spatter(vec3 d, float n, float share, float rMin, float rMax, float px) {
  vec3 a = abs(d);
  vec2 uv; float face;
  if (a.x >= a.y && a.x >= a.z) { uv = d.yz / a.x; face = d.x > 0.0 ? 0.0 : 1.0; }
  else if (a.y >= a.z) { uv = d.zx / a.y; face = d.y > 0.0 ? 2.0 : 3.0; }
  else { uv = d.xy / a.z; face = d.z > 0.0 ? 4.0 : 5.0; }
  vec2 g = (uv * 0.5 + 0.5) * n, cell = floor(g), f = g - cell;
  vec2 key = cell + face * 71.0;
  float h = h21(key + 0.5);
  if (h > share) return 0.0;
  float hs = h21(key + 17.3);
  float r = mix(rMin, rMax, hs * hs * hs) * px;                 // radius (tangent): most are small
  float cellT = 2.0 / n;                                         // a cell's width (tangent, on its face)
  float rc = min(r / cellT, 0.30);
  vec2 c = vec2(h21(key + 3.1), h21(key + 7.7)) * (1.0 - 2.0 * rc - 0.04) + rc + 0.02;
  float dist = length(f - c) / max(rc, 1e-4);
  // a round soft dot; the small ones are fainter (a fine spatter), the large ones bare paper
  return (1.0 - smoothstep(0.35, 1.0, dist)) * (0.50 + 0.50 * smoothstep(0.05, 0.6, hs));
}
void main() {
  vec4 aux = texture(uSceneAux, gl_FragCoord.xy / uSceneRes);
  if (aux.w > 0.5) discard;                                      // only the sky takes this glaze
  vec3 d = normalize(vDirW);
  float S = uStreak.x;
  // ---- stars
  float px = uStreak.z;
  float star = max(spatter(d, 26.0, 0.24, 1.3, 3.2, px), spatter(d.zxy, 11.0, 0.16, 2.4, 4.4, px));
  star *= aux.x * (1.0 - 0.75 * S);
  vec3 col = vec3(1.0);
  float alpha = star;
  // ---- pulse streaks
  if (S > 0.004) {
    vec3 f = normalize(uTravel);
    vec3 u = normalize(cross(f, abs(f.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0))), v = cross(f, u);
    float c = clamp(dot(d, f), -1.0, 1.0);
    float rho = sqrt(max(1.0 - c, 0.0) / max(1.0 + c, 1e-4));    // tan(theta / 2): 0 ahead, 1 abeam
    float lr = log(max(rho, 1e-4));
    float phi = atan(dot(d, v), dot(d, u)) / 6.2831853 + 0.5;     // 0..1 round the way ahead
    // (the hand is not a ruler: each drag wanders a little as it runs out)
    vec4 wn = texture(uNoise3D, d * 2.3 + 0.21);
    phi += (wn.r - 0.5) * 0.005 + (wn.g - 0.5) * 0.002;
    float pale = 0.0, deep = 0.0;
    for (int L = 0; L < 2; L++) {
      float K = L == 0 ? 38.0 : 67.0;
      float gphi = phi * K, i = floor(gphi), x = gphi - i - 0.5;
      float h = h21(vec2(i, 3.0 + float(L) * 9.0)), h2 = h21(vec2(i, 11.0 + float(L) * 5.0));
      if (h > 0.62) continue;
      float w = mix(0.16, 0.50, h2 * h2);                          // half width, share of the sector
      float xo = abs(x + (h2 - 0.5) * 0.3) / w;
      float across = (1.0 - smoothstep(0.0, 1.0, xo)) * (1.0 - 0.35 * smoothstep(0.0, 0.5, xo));      // soft from the middle out: a wet drag, no edge
      // along: one drag after another flows outward; each starts loaded and trails off dry
      float len = mix(1.1, 2.4, h2);
      float sAl = (lr - uStreak.y * mix(0.55, 0.95, h) + h * 13.0) / len;
      float xa = 1.0 - fract(sAl);                                 // 0 at the head (outer end) .. 1 at the tail
      float along = smoothstep(0.0, 0.10, xa) * (1.0 - smoothstep(0.45, 0.98, xa));
      float dryN = texture(uNoise3D, vec3(gphi * 0.9, sAl * 2.3, h * 7.0)).r;
      float dry = 1.0 - smoothstep(0.18, 0.70, xa) * smoothstep(0.36, 0.58, dryN) * 0.9;
      dry *= 0.72 + 0.28 * smoothstep(0.30, 0.55, texture(uNoise3D, vec3(gphi * 2.1, sAl * 5.0, h * 3.0)).g);
      float m = across * along * dry * (L == 0 ? 1.0 : 0.6);
      if (h2 > 0.30) pale = max(pale, m); else deep = max(deep, m);
    }
    float reach = smoothstep(0.035, 0.42, rho) * (1.0 - smoothstep(6.0, 40.0, rho));
    pale *= reach * S; deep *= reach * S;
    // a darker drag under, a lifted pale one over
    float aD = deep * 0.40, aP = pale * 0.58;
    vec3 cD = vec3(0.17, 0.20, 0.38), cP = vec3(0.90, 0.93, 1.0);
    float aS = alpha, aAll = 1.0 - (1.0 - aD) * (1.0 - aP) * (1.0 - aS);
    col = (cD * aD * (1.0 - aP) * (1.0 - aS) + cP * aP * (1.0 - aS) + vec3(aS)) / max(aAll, 1e-4);
    alpha = aAll;
  }
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(col, alpha);
}
`;

export function makeSkyGlaze(skyUniforms) {
  ensureGlobals();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const uniforms = {
    uNoise3D: G.uNoise3D, uSceneAux: G.uSceneAux, uSceneRes: G.uSceneRes,
    uAtmo: skyUniforms.uAtmo, uProjScale: skyUniforms.uProjScale, uCamRot: skyUniforms.uCamRot, uBodyInv: skyUniforms.uBodyInv,
    uStreak: { value: new THREE.Vector4(0, 0, 0.002, 0) },
    uTravel: { value: new THREE.Vector3(0, 0, -1) },
  };
  const mat = new THREE.ShaderMaterial({
    name: 'pc-sky-glaze', uniforms, vertexShader: SKY_VERT, fragmentShader: GLAZE_FRAG,
    depthWrite: false, depthTest: false, transparent: true,
  });
  mat.userData.pcPainted = true; mat.userData.pcGlaze = true;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'pc-sky-glaze';
  mesh.frustumCulled = false;
  mesh.renderOrder = 1001;
  const m4 = new THREE.Matrix4();
  mesh.onBeforeRender = function (renderer, scene, camera) {
    const pe = camera.projectionMatrix.elements;
    uniforms.uProjScale.value.set(1 / pe[0], 1 / pe[5]);
    uniforms.uCamRot.value.setFromMatrix4(m4.extractRotation(camera.matrixWorld));
    mat.uniformsNeedUpdate = true;
  };
  return mesh;
}

export function makeSky(uniforms) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const mat = new THREE.ShaderMaterial({
    name: 'pc-sky', uniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
    depthWrite: false, depthTest: true, depthFunc: THREE.LessEqualDepth,
  });
  mat.userData.pcPainted = true;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'pc-sky';
  mesh.frustumCulled = false;
  mesh.renderOrder = 1000;
  const m4 = new THREE.Matrix4();
  mesh.onBeforeRender = function (renderer, scene, camera) {
    const pe = camera.projectionMatrix.elements;
    uniforms.uProjScale.value.set(1 / pe[0], 1 / pe[5]);
    uniforms.uCamRot.value.setFromMatrix4(m4.extractRotation(camera.matrixWorld));
    mat.uniformsNeedUpdate = true;
  };
  return mesh;
}
