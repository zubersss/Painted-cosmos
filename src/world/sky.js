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
  vec3 cl = mix(vec3(1.0), uCloudShade, shade * 0.9);
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

  // ---- space: deep indigo and Payne's grey washes with spattered stars (first pass)
  if (uAtmo.x > 0.001 || uAtmo.y < 0.999) {
    vec3 dw = normalize(vDirW);
    vec4 s1 = texture(uNoise3D, dw * 0.9 + 0.4);
    vec4 s2 = texture(uNoise3D, dw * 2.9);
    // deep indigo and Payne's grey laid wet, with salt blooms and spattered masking-fluid stars
    vec3 sp = mix(vec3(0.21, 0.25, 0.46), vec3(0.33, 0.36, 0.50), s1.r);
    sp = mix(sp, vec3(0.40, 0.33, 0.56), smoothstep(0.55, 0.80, s1.g) * 0.6);          // a violet nebula drift
    sp = dens(sp, 1.0 + (s2.g - 0.5) * 0.9 + (s1.b - 0.5) * 0.7);
    vec4 sa = texture(uNoise3D, dw * 6.3 + 0.2);
    float salt = smoothstep(0.66, 0.80, sa.r * 0.6 + s2.b * 0.4);                         // salt: pale crystalline blooms
    sp = mix(sp, vec3(0.62, 0.66, 0.82), salt * 0.55);
    vec4 st = texture(uNoise3D, dw * 17.0);
    vec4 st2 = texture(uNoise3D, dw * 43.0 + 0.5);
    float star = smoothstep(0.795, 0.815, st.b * 0.55 + st2.r * 0.45) + smoothstep(0.86, 0.88, st.r * 0.5 + st2.g * 0.5);
    sp = mix(sp, vec3(1.0), clamp(star, 0.0, 1.0));
    float sunS = 1.0 - smoothstep(uAtmo.z * 0.82, uAtmo.z, ang);
    sp = mix(sp, vec3(1.0, 0.985, 0.93), clamp(halo, 0.0, 1.0));
    sp = mix(sp, vec3(1.0), sunS);
    // stars also come out at night from the ground
    float night = (1.0 - uAtmo.y) * (1.0 - uAtmo.x);
    col = mix(col, vec3(1.0), star * night * (1.0 - cloud) * smoothstep(0.0, 0.25, e) * 0.9);
    col = mix(col, sp, uAtmo.x);
  }

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), mix(1.0, 0.45, uAtmo.x));
  pcAux = vec4(0.0, 0.0, 20.0, 0.0);
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
