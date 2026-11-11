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
  // turbulence and the odd backrun: no flat colour anywhere in a wet wash
  vec4 n1 = texture(uNoise3D, d * 1.3 + 0.17);
  vec4 n2 = texture(uNoise3D, d * 4.1);
  float turb = (n1.r - 0.5) * 0.9 + (n2.g - 0.5) * 0.35;
  float back = smoothstep(0.80, 0.86, n1.a) * (1.0 - smoothstep(0.86, 0.93, n1.a));
  sky = dens(sky, 1.0 + turb * (1.0 - t * 0.7) + back * 0.9 * (1.0 - t));
  sky = mix(sky, vec3(1.0), smoothstep(0.86, 0.95, n1.a) * 0.35 * (1.0 - t));
  // below the horizon (seen from high up): haze
  sky = mix(sky, uHaze, smoothstep(0.02, -0.12, e));

  // ---- clouds: bare paper with soft violet undersides, on a shell around the planet
  float rc = length(uCamL);
  float b = dot(uCamL, d);
  float disc = b * b - (rc * rc - uCloud.x * uCloud.x);
  float cloud = 0.0, shade = 0.0;
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
    }
  }
  vec3 cl = mix(vec3(1.0), uCloudShade, shade * 0.9);
  cl = dens(cl, 1.0 + (n2.r - 0.5) * 0.8);
  vec3 col = mix(sky, cl, cloud);

  // ---- the sun: bare paper with a warm halo
  float ang = acos(clamp(sd, -1.0, 1.0));
  float halo = exp(-ang * 7.0) * 0.75 + exp(-ang * 28.0) * 0.6;
  col = mix(col, vec3(1.0, 0.985, 0.93), clamp(halo, 0.0, 1.0) * (1.0 - cloud * 0.6));
  float sun = 1.0 - smoothstep(uAtmo.z * 0.82, uAtmo.z, ang + (n2.b - 0.5) * 0.012);
  col = mix(col, vec3(1.0), sun * (1.0 - cloud * 0.5));

  // ---- space: deep indigo and Payne's grey washes with spattered stars (first pass)
  if (uAtmo.x > 0.001 || uAtmo.y < 0.999) {
    vec3 dw = normalize(vDirW);
    vec4 s1 = texture(uNoise3D, dw * 0.9 + 0.4);
    vec4 s2 = texture(uNoise3D, dw * 2.9);
    vec3 sp = mix(vec3(0.19, 0.23, 0.42), vec3(0.30, 0.33, 0.44), s1.r);
    sp = dens(sp, 1.0 + (s2.g - 0.5) * 1.3 + (s1.b - 0.5) * 0.8);
    vec4 st = texture(uNoise3D, dw * 13.0);
    vec4 st2 = texture(uNoise3D, dw * 31.0 + 0.5);
    float star = smoothstep(0.80, 0.83, st.b * 0.55 + st2.r * 0.45);
    sp = mix(sp, vec3(1.0), star);
    float sunS = 1.0 - smoothstep(uAtmo.z * 0.82, uAtmo.z, ang);
    sp = mix(sp, vec3(1.0, 0.985, 0.93), clamp(halo, 0.0, 1.0));
    sp = mix(sp, vec3(1.0), sunS);
    // stars also come out at night from the ground
    float night = (1.0 - uAtmo.y) * (1.0 - uAtmo.x);
    col = mix(col, vec3(1.0), star * night * (1.0 - cloud) * smoothstep(0.0, 0.25, e) * 0.9);
    col = mix(col, sp, uAtmo.x);
  }

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
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
