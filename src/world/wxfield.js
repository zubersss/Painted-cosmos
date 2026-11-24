// Painted Cosmos: THE WEATHER FIELD ON THE GPU. OWNER: PAINTER (group D, lane W1 CLOUDS). docs/lead/WEATHER-DESIGN.md 9.4.
//
// The physics keeps two maps of the whole world on the same cube-sphere grid (32 texels a face edge, about 196 m on
// Earth): the wind map (physics/windmap.js, `physics.fields.wind`, behind ?windmap=1) and the cloud and rain map
// (physics/cloudfield.js, `physics.fields.cloud`, behind ?cloudmap=1). This module turns them into two small textures
// and a few shared uniforms (`WX`), and gives every shader that needs the weather ONE piece of GLSL to read them with
// (`WXFIELD_GLSL`). The clouds read it, the water group reads it (rain rings, puddles, wind on far water, the deck
// mirrored in a lake), the look director reads the cloud shadow through it. Nobody else decodes the textures.
//
// HOW TO USE IT IN A MATERIAL (any group):
//   import { WX, WXFIELD_GLSL } from '../world/wxfield.js';
//   uniforms: { ...WX, ...yourOwn }               (shared by reference, as PHYS is: one upload serves every material)
//   fragment or vertex text: WXFIELD_GLSL + yourShader   (guarded: including it twice is harmless)
//   then, with a BODY-LOCAL unit direction d (or a body-local position p, for the shadow):
//     vec4  pcWxField(d)      R low cloud cover 0..1, G cloud thickness (top - base) / 2500 m, B sqrt(rain / 40 mm/h), A storm 0..1
//     vec4  pcWxField2(d)     R cloud base / 2500 m above the datum, G high cloud cover, B wind speed / 30 m/s, A wind dir / 2pi
//     float pcRainAt(d)       mm/h of liquid rain at the ground (0 .. 40)
//     vec2  pcWindAt(d)       m/s at 10 m over open ground, along the place's own east and north (east = normalize(Y x d),
//                             north = d x east: the physics' convention, windmap.js)
//     float pcCloudBase(d)    m above the datum;  float pcCloudTop(d)  m above the datum
//     float pcCloudShadow(p)  0 lit .. 1 under cloud, SMOOTH (threshold it crisply in the caller: the crispness rule)
//     uWxOn                   x 1 when the cloud map is live, y 1 when the wind map is live (0: the textures hold zeros)
//     uCloudShadowV (mat4)    the eye's view space -> the shadow map's uv, every frame (for post.js, which works from a pixel's
//                             view position): uv = (uCloudShadowV * vec4(viewPos, 1.0)).xy, outside 0..1 no shadow
//   NOTE: render/shared.js has a WX of its own (the forced sky): where both are needed, import this one as WXF.
//   The textures are read bilinearly inside a face and seamless across face edges (each face carries a border of
//   its neighbours' texels), so any direction may be asked, in a vertex or a fragment shader.
//
// WHEN IT IS UPLOADED. The maps refresh in slices (the cloud map every 0.5 s, the wind map every 2 s); the textures are
// rebuilt only when either map's `version` moves on, and never more than twice a second. MEASURED in Node on this
// machine, warm: the cloud map's channels 0.09 ms, the wind's 0.16 ms (2 x 6 x 34 x 34 texels; wxfield.test.mjs prints
// the pair), so about 0.01 ms a frame on average at 30 a second, a 0.3 to 0.5 ms spike twice a second on the phone if it is
// three times slower (unverified); the upload is 2 x 27.7 KB. With both maps switched off (`fields.cloud` and `fields.wind` null) the textures hold zeros and
// `uWxOn` is (0, 0): nothing is rebuilt after the first frame.
//
// CHANNEL CHOICES the contract (9.4) left open, said here so the readers know:
//   - the WIND in uWxField2 is the wind at 10 m (e10, n10): what moves water, grass and smoke. The clouds drift with
//     the wind ALOFT, which clouds.js reads on the CPU straight from `fields.wind` (aloftE, aloftN).
//   - the RAIN in uWxField is LIQUID rain at the ground (`fields.cloud.rain`); snow is not in the texture.
//   - the wind's direction is stored as an angle, which a texture cannot blend across 0 / 2pi, so pcWindAt reads the
//     four texels itself and blends the VECTORS (four fetches, not one). pcWxField2's raw A channel is blended by the
//     hardware: do not use it for anything but the nearest texel's direction.
import * as THREE from 'three';
import * as SHARED from '../render/shared.js';
import { faceToDir, texelOf } from '../physics/windmap.js';

export const WXN = 32;                 // the maps' grid (physics CLOUDMAP.N / WINDMAP's N)
const P = WXN + 2;                     // a face's block in the atlas, with its one-texel border
const AW = 6 * P, AH = P;              // the atlas: six blocks side by side
const SPAN = 2500;                     // m: the heights' and thicknesses' scale
const RAINMAX = 40;                    // mm/h: the rain's scale (sqrt-coded, fine at a drizzle)
const WINDMAX = 30;                    // m/s

function atlas() {
  const t = new THREE.DataTexture(new Uint8Array(AW * AH * 4), AW, AH, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.generateMipmaps = false; t.flipY = false; t.unpackAlignment = 1; t.needsUpdate = true;
  return t;
}
function blankShadow() {
  const t = new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
}
// (until clouds.js renders a shadow map, the matrix sends every point to uv (-1, -1): outside the map, no shadow)
const _noShadowM = new THREE.Matrix4().set(0, 0, 0, -1, 0, 0, 0, -1, 0, 0, 0, 0, 0, 0, 0, 1);
// (the look director's touch T3, look-director a40647e: render/ does not import world/, so the three uniforms the last pass
//  reads live in render/shared.js CLOUDSHADOW; these are the very same objects. One name only, as committed there)
const _CS = SHARED.CLOUDSHADOW || null;

export const WX = {
  uWxField: { value: atlas() },        // R low cover, G (top - base) / 2500 m, B sqrt(rain / 40 mm/h), A storm
  uWxField2: { value: atlas() },       // R base / 2500 m above the datum, G high cover, B wind / 30 m/s, A wind dir / 2pi
  uWxN: { value: WXN },
  uWxOn: { value: new THREE.Vector2(0, 0) },
  uCloudShadow: _CS && _CS.uCloudShadow || { value: blankShadow() },          // (clouds.js A6) 256 x 256, R 0 lit .. 1 shadow, smooth
  uCloudShadowM: { value: _noShadowM.clone() },    // body-local position -> shadow map uv (xy)
  uCloudShadowK: _CS && _CS.uCloudShadowK || { value: 0 },                    // 0: no cloud shadow anywhere (clouds.js sets it while its map is drawn)
  uCloudShadowV: _CS && _CS.uCloudShadowV || { value: _noShadowM.clone() },   // (additive) the eye's VIEW space -> the map's uv, set every frame: for a pass over the picture (post.js), which has view positions, not body ones
};

// THE ATLAS'S INDEX: for every atlas texel, the map texel it copies (its own inside a face; across the edge, the
// neighbouring face's texel nearest to where the border texel's centre lies on the sphere). Made once.
let _src = null;
export function atlasIndex() {
  if (_src) return _src;
  _src = new Int32Array(AW * AH);
  const d = [0, 0, 0];
  for (let f = 0; f < 6; f++) for (let jj = 0; jj < P; jj++) for (let ii = 0; ii < P; ii++) {
    const i = ii - 1, j = jj - 1;
    let k;
    if (i >= 0 && i < WXN && j >= 0 && j < WXN) k = (f * WXN + j) * WXN + i;
    else {
      // (the border texel's centre, the face's own mapping carried past its edge; at the four corners the
      //  diagonal neighbour is a corner shared by three faces, and the nearest texel to it is as good as any)
      faceToDir(f, (i + 0.5) / WXN * 2 - 1, (j + 0.5) / WXN * 2 - 1, d);
      k = texelOf(WXN, d[0], d[1], d[2]);
    }
    _src[jj * AW + f * P + ii] = k;
  }
  return _src;
}

const TAU = Math.PI * 2;

// Fill the atlases' bytes from the maps (a map that is null gives zeros in its channels): the cloud map's six channels,
// the wind map's two. Exported for the tests. (Written flat, with the arrays in locals and the byte coding inlined: with
// a helper per channel the pair took 0.94 ms here, now 0.27.)
export function fillAtlases(cloud, wind, A, B) { fillCloud(cloud, A, B); fillWind(wind, B); }
export function fillCloud(cloud, A, B) {
  const src = atlasIndex(), n = src.length;
  const C = cloud && cloud.low && cloud.low.length === 6 * WXN * WXN ? cloud : null;
  if (C) {
    const low = C.low, base = C.base, top = C.top, rain = C.rain, storm = C.storm, high = C.high;
    const kS = 255 / SPAN, kR = 1 / RAINMAX;
    for (let q = 0, o = 0; q < n; q++, o += 4) {
      const k = src[q], b = base[k];
      let v = low[k] * 255; A[o] = v <= 0 ? 0 : v >= 255 ? 255 : v + 0.5;
      v = (top[k] - b) * kS; A[o + 1] = v <= 0 ? 0 : v >= 255 ? 255 : v + 0.5;
      v = rain[k] * kR; v = v <= 0 ? 0 : v >= 1 ? 255 : Math.sqrt(v) * 255 + 0.5; A[o + 2] = v;
      v = storm[k] * 255; A[o + 3] = v <= 0 ? 0 : v >= 255 ? 255 : v + 0.5;
      v = b * kS; B[o] = v <= 0 ? 0 : v >= 255 ? 255 : v + 0.5;
      v = high[k] * 255; B[o + 1] = v <= 0 ? 0 : v >= 255 ? 255 : v + 0.5;
    }
  } else for (let o = 0; o < n * 4; o += 4) { A[o] = A[o + 1] = A[o + 2] = A[o + 3] = 0; B[o] = B[o + 1] = 0; }
}
export function fillWind(wind, B) {
  const src = atlasIndex(), n = src.length;
  const W = wind && wind.e10 && wind.e10.length === 6 * WXN * WXN ? wind : null;
  if (W) {
    const e10 = W.e10, n10 = W.n10, kW = 255 / WINDMAX, kA = 255 / TAU;
    for (let q = 0, o = 0; q < n; q++, o += 4) {
      const k = src[q], e = e10[k], nn = n10[k];
      const v = Math.sqrt(e * e + nn * nn) * kW; B[o + 2] = v >= 255 ? 255 : v + 0.5;
      let a = Math.atan2(nn, e); if (a < 0) a += TAU;
      B[o + 3] = (a * kA + 0.5) & 255;   // (wraps: 2pi is 0)
    }
  } else for (let o = 0; o < n * 4; o += 4) { B[o + 2] = 0; B[o + 3] = 0; }
}

// THE CPU TWIN of the shader's look-up (the tests hold the two to the maps): bilinear in the atlas at a body-local unit
// direction, channels 0..1 as the shader sees them. data: the atlas's bytes; out: [r, g, b, a].
const _FACES = [
  { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] }, { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] }, { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] }, { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
];
export function atlasPx(x, y, z) {
  const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
  const f = ax >= ay && ax >= az ? (x > 0 ? 0 : 1) : ay >= az ? (y > 0 ? 2 : 3) : (z > 0 ? 4 : 5);
  const F = _FACES[f], dn = x * F.n[0] + y * F.n[1] + z * F.n[2];
  const s = Math.atan((x * F.u[0] + y * F.u[1] + z * F.u[2]) / dn) * 4 / Math.PI;
  const t = Math.atan((x * F.v[0] + y * F.v[1] + z * F.v[2]) / dn) * 4 / Math.PI;
  return [f * P + 1 + (s * 0.5 + 0.5) * WXN, 1 + (t * 0.5 + 0.5) * WXN];
}
export function sampleAtlas(data, x, y, z, out = [0, 0, 0, 0]) {
  const [px, py] = atlasPx(x, y, z);
  const fx = px - 0.5, fy = py - 0.5, i0 = Math.floor(fx), j0 = Math.floor(fy), tx = fx - i0, ty = fy - j0;
  const at = (i, j, c) => data[(Math.min(AH - 1, Math.max(0, j)) * AW + Math.min(AW - 1, Math.max(0, i))) * 4 + c] / 255;
  for (let c = 0; c < 4; c++) {
    out[c] = (at(i0, j0, c) * (1 - tx) + at(i0 + 1, j0, c) * tx) * (1 - ty) + (at(i0, j0 + 1, c) * (1 - tx) + at(i0 + 1, j0 + 1, c) * tx) * ty;
  }
  return out;
}

// THE SHADER SIDE. Every name starts pcWx / pcCloud / pcRain / pcWind, every constant PCWX_.
export const WXFIELD_GLSL = /* glsl */`
#ifndef PC_WXFIELD_GLSL
#define PC_WXFIELD_GLSL 1
uniform sampler2D uWxField;
uniform sampler2D uWxField2;
uniform float uWxN;
uniform vec2 uWxOn;
uniform sampler2D uCloudShadow;
uniform mat4 uCloudShadowM;
uniform float uCloudShadowK;
// the atlas texel position (in texels) of a body-local direction: the cube face (as physics/windmap.js FACES and
// world/cubesphere.js order them), the tangent mapping, the face's block with its one-texel border
vec2 pcWxPx(vec3 d) {
  vec3 a = abs(d);
  float face; vec3 n; vec3 u; vec3 v;
  if (a.x >= a.y && a.x >= a.z) {
    if (d.x > 0.0) { face = 0.0; n = vec3(1.0, 0.0, 0.0); u = vec3(0.0, 0.0, -1.0); }
    else { face = 1.0; n = vec3(-1.0, 0.0, 0.0); u = vec3(0.0, 0.0, 1.0); }
    v = vec3(0.0, 1.0, 0.0);
  } else if (a.y >= a.z) {
    u = vec3(1.0, 0.0, 0.0);
    if (d.y > 0.0) { face = 2.0; n = vec3(0.0, 1.0, 0.0); v = vec3(0.0, 0.0, -1.0); }
    else { face = 3.0; n = vec3(0.0, -1.0, 0.0); v = vec3(0.0, 0.0, 1.0); }
  } else {
    v = vec3(0.0, 1.0, 0.0);
    if (d.z > 0.0) { face = 4.0; n = vec3(0.0, 0.0, 1.0); u = vec3(1.0, 0.0, 0.0); }
    else { face = 5.0; n = vec3(0.0, 0.0, -1.0); u = vec3(-1.0, 0.0, 0.0); }
  }
  vec2 st = atan(vec2(dot(d, u), dot(d, v)) / dot(d, n)) * 1.2732395;
  return vec2(face * (uWxN + 2.0) + 1.0, 1.0) + (st * 0.5 + 0.5) * uWxN;
}
vec2 pcWxUV(vec3 d) { return pcWxPx(d) / vec2(6.0 * (uWxN + 2.0), uWxN + 2.0); }
vec4 pcWxField(vec3 d) { return texture(uWxField, pcWxUV(d)); }
vec4 pcWxField2(vec3 d) { return texture(uWxField2, pcWxUV(d)); }
float pcRainAt(vec3 d) { float b = pcWxField(d).b; return 40.0 * b * b; }
float pcCloudBase(vec3 d) { return pcWxField2(d).r * 2500.0; }
float pcCloudTop(vec3 d) { return (pcWxField2(d).r + pcWxField(d).g) * 2500.0; }
// the wind: four texels read and their VECTORS blended (an angle cannot be blended across 0 / 2pi)
vec2 pcWxWindTexel(ivec2 p) {
  vec2 sa = texelFetch(uWxField2, p, 0).ba;
  float ang = sa.y * 6.2831853;
  return sa.x * 30.0 * vec2(cos(ang), sin(ang));
}
vec2 pcWindAt(vec3 d) {
  vec2 f = pcWxPx(d) - 0.5;
  vec2 i0 = floor(f); vec2 t = f - i0;
  ivec2 p = ivec2(i0);
  vec2 a = mix(pcWxWindTexel(p), pcWxWindTexel(p + ivec2(1, 0)), t.x);
  vec2 b = mix(pcWxWindTexel(p + ivec2(0, 1)), pcWxWindTexel(p + ivec2(1, 1)), t.x);
  return mix(a, b, t.y);
}
// the cloud shadow at a BODY-LOCAL position (clouds.js renders the map along the sun; outside it: no shadow)
float pcCloudShadow(vec3 p) {
  vec2 uv = (uCloudShadowM * vec4(p, 1.0)).xy;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 0.0;
  return texture(uCloudShadow, uv).r * uCloudShadowK;
}
#endif
`;

// THE UPDATER (world/index.js asks for `createWxField()` once and calls `update(physics.fields)` every frame).
export function createWxField() {
  let cv = -1, wv = -1, cb = null, wb = null, last = -1e9, zeroed = false;
  const A = WX.uWxField.value.image.data, B = WX.uWxField2.value.image.data;
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const self = {
    rebuilds: 0, ms: 0,
    update(fields) {
      const C = fields ? fields.cloud : null, W = fields ? fields.wind : null;
      const cOn = !!(C && C.ready), wOn = !!(W && W.ready);
      WX.uWxOn.value.set(cOn ? 1 : 0, wOn ? 1 : 0);
      if (!cOn && !wOn) {
        if (!zeroed) { A.fill(0); B.fill(0); WX.uWxField.value.needsUpdate = WX.uWxField2.value.needsUpdate = true; zeroed = true; cv = wv = -1; }
        return false;
      }
      const c1 = cOn ? C.version : -1, w1 = wOn ? W.version : -1;
      const cMoved = c1 !== cv || C !== cb, wMoved = w1 !== wv || W !== wb;
      const t = now();
      if (!(cMoved || wMoved) || t - last < 450) return false;
      const t0 = now();
      // (each map's channels only when that map moved on: the cloud map every 0.5 s, the wind map every 2 s)
      if (cMoved) fillCloud(cOn ? C : null, A, B);
      if (wMoved) fillWind(wOn ? W : null, B);
      WX.uWxField.value.needsUpdate = WX.uWxField2.value.needsUpdate = true;
      cv = c1; wv = w1; cb = C; wb = W; last = t; zeroed = false;
      self.rebuilds++; self.ms = now() - t0;
      return true;
    },
  };
  return self;
}
