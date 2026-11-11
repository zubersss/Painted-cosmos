// Painted Cosmos: GLSL shared by every painted scene material. OWNER: PAINTER.
//
// Scene pass outputs (MRT):
//   location 0: rgb = wash colour as transmittance over paper (1 = bare paper), a = wetness
//               (how much this surface bleeds wet-in-wet in the post passes)
//   location 1: xy = view-space normal, z = log2(1 + view depth in metres), w = region id
//               (integer part = class: 0 sky, 1 ground, 2 water, 3 solid prop, 4 foliage,
//                5 character / ship / foreign; fraction = a per-object hash)

export const VERT_PARS = /* glsl */`
#include <common>
#include <logdepthbuf_pars_vertex>
`;

export const VERT_END = /* glsl */`
#include <logdepthbuf_vertex>
`;

export const FRAG_PARS = /* glsl */`
#include <common>
#include <logdepthbuf_pars_fragment>
uniform highp sampler3D uNoise3D;
uniform sampler2D uStrokeTex;
uniform vec3 uSunDirW;
uniform vec3 uSunDirL;
uniform vec3 uGlaze;
uniform vec3 uLight;
uniform vec3 uHaze;
uniform vec4 uFog;
uniform float uTime;
uniform float uDayness;
layout(location = 1) out highp vec4 pcAux;

// Pigment density model: heavier pigment grows richer, not muddier.
vec3 pcDensity(vec3 c, float d) {
  return clamp(c - (c - c * c) * (d - 1.0), 0.0, 1.0);
}

// Light in four soft value steps. x in 0..1 -> level in 0..3.
float pcLevel(float x, float soft) {
  x = mix(0.37 + x * 0.30, x, uDayness);   // night: a dim, even moonlight, nothing near black
  return smoothstep(0.26 - soft, 0.26 + soft, x)
       + smoothstep(0.50 - soft, 0.50 + soft, x)
       + smoothstep(0.76 - soft, 0.76 + soft, x);
}

// Layer the washes for a light level:
//   3 sunlit: the local wash diluted so paper shows, warmed by the light
//   2 local colour   1 one cool glaze   0 two glazes, pigment pooling
vec3 pcTone(vec3 c, float level) {
  vec3 lit = mix(c, vec3(1.0), 0.30) * uLight;
  vec3 g1 = c * uGlaze;
  vec3 g2 = pcDensity(g1 * pow(uGlaze, vec3(0.75)), 1.3);
  vec3 r = mix(g2, g1, clamp(level, 0.0, 1.0));
  r = mix(r, c * mix(vec3(1.0), uLight, 0.55), clamp(level - 1.0, 0.0, 1.0));
  r = mix(r, lit, clamp(level - 2.0, 0.0, 1.0));
  return r;
}

// Atmospheric perspective in soft stacked bands. Returns 0..1.
float pcFogAmount(float dist) {
  float f = 1.0 - exp(-dist * uFog.x);
  float q = f * uFog.y;
  float fl = floor(q);
  f = (fl + smoothstep(0.15, 0.85, q - fl)) / uFog.y;
  return clamp(f * uFog.z, 0.0, 1.0);
}

// Each distance band is lighter, cooler, lower in contrast; the far end is bare paper.
vec3 pcAtmos(vec3 c, float f) {
  float l = dot(c, vec3(0.3, 0.5, 0.2));
  vec3 cool = mix(c, vec3(l) * vec3(0.86, 0.95, 1.10), min(1.0, f * 1.6) * 0.62);
  return mix(cool, uHaze, f);
}

// Dappled light: a leaf-shadow pattern projected along the sun direction, anchored to the
// planet. Every point along one sun ray gets the same value, so ground, trunks and foliage
// share one continuous pattern. Returns 1 in sun, 0 in shade.
float pcDapple(vec3 bodyPos, float canopy) {
  vec3 pp = bodyPos - uSunDirL * dot(bodyPos, uSunDirL);
  float a = texture(uNoise3D, pp / 13.0).r;
  float b = texture(uNoise3D, pp / 4.1 + 0.37).g;
  float v = a * 0.68 + b * 0.32;
  float th = mix(0.05, 0.585, canopy);
  // mostly a crisp-edged glaze, here and there feathered where the wash was still wet
  float w = mix(0.012, 0.075, smoothstep(0.55, 0.75, texture(uNoise3D, pp / 23.0 + 0.7).b));
  return smoothstep(th - w, th + w, v);
}

// Triplanar lookup into the stroke atlas (p in metres, anchored; n body-local normal).
vec4 pcTri(vec3 p, vec3 n, float scale) {
  vec3 w = abs(n); w = w * w * w * w; w /= (w.x + w.y + w.z);
  return texture(uStrokeTex, p.yz * scale) * w.x
       + texture(uStrokeTex, p.zx * scale) * w.y
       + texture(uStrokeTex, p.xy * scale) * w.z;
}

void pcWrite(vec3 col, float wet, vec3 nV, float viewZ, float id) {
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), clamp(wet, 0.0, 1.0));
  pcAux = vec4(nV.xy, log2(1.0 + max(viewZ, 0.0)), id);
}
`;
