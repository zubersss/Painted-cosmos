// Painted Cosmos: GLSL shared by every painted scene material. OWNER: PAINTER.
//
// Scene pass outputs (MRT):
//   location 0: rgb = wash colour as transmittance over paper (1 = bare paper), a = wetness
//               (how much this surface bleeds wet-in-wet in the post passes)
//   location 1: xy = view-space normal, z = log2(1 + view depth in metres), w = region id
//               (integer part = class: 0 sky, 1 ground, 2 water, 3 solid prop, 4 foliage,
//                5 character / ship / foreign, 6 small crisp marks the brush leaves as drawn, 7 what
//                flies in the air (kitmat.js), 8 a light of its own (a flame, a lamp, a lit cabin: the
//                night's key and the last glaze leave it as painted, post.js); fraction = a per-object hash)

// Depth. Where the browser has EXT_clip_control three keeps a reversed float depth and none of this is
// compiled. Where it has not (Firefox, docs/lead/HARDENING.md A1), three falls back to a logarithmic depth
// written per fragment (gl_FragDepth), which turns off early and hierarchical Z for every scene shader
// (about 2.9 times the fragments shaded at the Earth spawn). Here the same log depth is written per vertex
// instead (gl_Position.z): exact at the vertices and linear across the screen in between, which on these
// worlds' triangles (the terrain's LOD keeps a cell under 1/40 of its distance) is off by well under a
// centimetre a metre. A material whose large triangles near the eye poke through others opts back into
// the fragment write with the define PC_FRAG_LOGDEPTH (and a late renderOrder: one depth-writing shader
// can turn hierarchical Z off for the rest of the pass on some GPUs).
export const VERT_PARS = /* glsl */`
#include <common>
#include <logdepthbuf_pars_vertex>
#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
  uniform float logDepthBufFC;
#endif
`;

export const VERT_END = /* glsl */`
#include <logdepthbuf_vertex>
#if defined(USE_LOGARITHMIC_DEPTH_BUFFER) && !defined(PC_FRAG_LOGDEPTH)
  if (isPerspectiveMatrix(projectionMatrix)) gl_Position.z = (log2(max(1e-6, 1.0 + gl_Position.w)) * logDepthBufFC - 1.0) * gl_Position.w;
#endif
`;

export const FRAG_PARS = /* glsl */`
#include <common>
#include <logdepthbuf_pars_fragment>
#if defined(USE_LOGARITHMIC_DEPTH_BUFFER) && !defined(PC_FRAG_LOGDEPTH)
  #undef USE_LOGARITHMIC_DEPTH_BUFFER
#endif
uniform highp sampler3D uNoise3D;
uniform sampler2D uStrokeTex;
uniform vec3 uSunDirW;
uniform vec3 uSunDirL;
uniform vec3 uGlaze;
uniform vec3 uLight;
uniform vec3 uHaze;
uniform vec4 uHazeUp;  // under a closed sky: rgb the sky's own wash overhead, a how far the far air takes it high in the view (0: one haze at every height)
uniform vec3 uUpW;     // up at the eye, scene space
uniform vec4 uFog;
uniform vec2 uAirNear;  // the near air: x its share at distance y (m), see shared.js
uniform float uTime;
uniform float uDayness;
uniform float uMoon;   // the night's light on the ground: 0 the sun is the light .. 1 the moon is (the world then hands the moon's direction in uSunDir*)
uniform float uStorm;
uniform vec4 uWx;      // weather: x overcast, y wet, z snow cover, w veil (rain or snow in the air)
layout(location = 1) out highp vec4 pcAux;
uniform float uAux8;
// (the 8-bit fallback, shared.js uAux8: normal to 0..1, log depth over 32, the region over 8 with its hash kept off the next class)
vec4 pcAuxEnc(vec4 a) { return uAux8 > 0.5 ? vec4(a.xy * 0.5 + 0.5, a.z / 32.0, (floor(a.w + 0.001) + fract(a.w + 0.001) * 0.9) / 8.0) : a; }
vec4 pcAuxDec(vec4 a) { return uAux8 > 0.5 ? vec4(a.xy * 2.0 - 1.0, a.z * 32.0, a.w * 8.0 + 0.02) : a; }

// Pigment density model: heavier pigment grows richer, not muddier.
vec3 pcDensity(vec3 c, float d) {
  return clamp(c - (c - c * c) * (d - 1.0), 0.0, 1.0);
}

// Light in four soft value steps. x in 0..1 -> level in 0..3.
float pcLevel(float x, float soft) {
  float xs = mix(0.37 + x * 0.30, x, uDayness);   // night with no moon (an airless world, the far side seen from space): a dim, even light, nothing near black
  // Night on the ground is a picture in its own key (PAINTER 16, the M4 critique's first item: night was the day's picture
  // under a dark veil, one value from sky to boots). The moon stands where the sun is not (a full moon), the world hands
  // its direction in the sun's place, and it models every form as the sun does, in fewer steps: the open ground and the
  // tops of things are the lights, what faces away and what the canopy shades is the deep wash. The light changes hands
  // in the middle of twilight, when nothing is modelled at all (the blue hour is flat): no form flips in a frame.
  float mk = abs(2.0 * uMoon - 1.0);
  x = mix(0.47, uMoon > 0.5 ? 0.12 + x * 0.78 : xs, mk);
  // overcast: the light comes from the whole sky. Nothing is sunlit, forms are modelled in two
  // soft steps (local colour and one glaze) that run into each other
  x = mix(x, 0.37 + x * 0.25, uWx.x);
  soft += 0.08 * uWx.x;
  // under a storm cloud nothing is lit at all: every form stands in the cloud's shadow, in the
  // cool glaze and the deep one (the ground loses its sun before the rain comes)
  x = mix(x, 0.17 + x * 0.26, uStorm);
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
  // (the deepest step is the same cool glaze over the local colour with the pigment pooled heavier, not a second
  // glaze: two glazes and the density turned every deep shadow toward the glaze's own ultramarine, whatever was
  // under it: Mercury's crystals all one blue, Jupiter's crowns slate, the autumn crowns flat sepia; ARTPASS wish 2)
  vec3 g2 = pcDensity(g1, 1.55);
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
  return clamp(max(f * uFog.z, uAirNear.x * (1.0 - exp(-dist / max(uAirNear.y, 0.1)))), 0.0, 1.0);
}

// Each distance band is lighter, cooler, lower in contrast; the far end is bare paper.
vec3 pcAtmos(vec3 c, float f) {
  float l = dot(c, vec3(0.3, 0.5, 0.2));
  vec3 cool = mix(c, vec3(l) * vec3(0.86, 0.95, 1.10), min(1.0, f * 1.6) * 0.62 * (1.0 - uAirNear.x));   // (dust is warm: it does not cool)
  return mix(cool, uHaze, f);
}
// The far end of anything is the sky behind it. Under a closed sky that is the pale band only low down:
// higher in the view the sky is the cloud's own heavy wash (the sky's gradient, see sky.js), and a far
// cliff that went to paper there stood in a storm sky as a pale cut-out with ruled edges.
vec3 pcHazeAt(vec3 viewPos) {
  if (uHazeUp.a < 0.004) return uHaze;
  float e = clamp(dot(normalize(viewPos), mat3(viewMatrix) * uUpW), 0.0, 1.0);
  return mix(uHaze, uHazeUp.rgb, uHazeUp.a * smoothstep(0.03, 0.20, e));
}
vec3 pcAtmosV(vec3 c, float f, vec3 viewPos) {
  float l = dot(c, vec3(0.3, 0.5, 0.2));
  vec3 cool = mix(c, vec3(l) * vec3(0.86, 0.95, 1.10), min(1.0, f * 1.6) * 0.62 * (1.0 - uAirNear.x));   // (dust is warm: it does not cool)
  return mix(cool, pcHazeAt(viewPos), f);
}

// Dappled light: a leaf-shadow pattern projected along the sun direction, anchored to the
// planet. Every point along one sun ray gets the same value, so ground, trunks and foliage
// share one continuous pattern. Returns 1 in sun, 0 in shade.
// lift: how far (m) below the leaves that cast it the point lies. The pattern is read where the sun ray
// through the point meets that level: one pattern along a ray, and it drifts with the sun as real sun
// flecks do, a few centimetres a second. (It used to be projected through the planet's centre: on a
// world 4 km in radius with a day of 25 minutes the flecks ran over the forest floor at 17 m/s.)
float pcDappleL(vec3 bodyPos, float canopy, float lift) {
  vec3 pp = bodyPos + uSunDirL * (lift / max(dot(normalize(bodyPos), uSunDirL), 0.22));
  float a = texture(uNoise3D, pp / 13.0).r;
  float b = texture(uNoise3D, pp / 4.1 + 0.37).g;
  float v = a * 0.68 + b * 0.32;
  float th = mix(0.05, 0.585, canopy);
  // mostly a crisp-edged glaze, here and there feathered where the wash was still wet
  float w = mix(0.012, 0.075, smoothstep(0.55, 0.75, texture(uNoise3D, pp / 23.0 + 0.7).b));
  // under an overcast nothing casts a shadow: only the dimness under the canopy is left
  return mix(smoothstep(th - w, th + w, v), 1.0 - 0.42 * canopy, uWx.x);
}
float pcDapple(vec3 bodyPos, float canopy) { return pcDappleL(bodyPos, canopy, 8.0); }

// The shade the explorer and the ship lay on the ground: a soft-edged glaze under and beside
// them (0 none .. 1 full), so they stand on the land instead of floating over it. rag: any
// anchored noise around 0 (a ragged edge).
uniform vec4 uCast[4];
uniform vec2 uCastK;
float pcCast(vec3 bodyPos, float rag) {
  float s = 0.0;
  vec3 up = normalize(bodyPos);
  for (int i = 0; i < 2; i++) {
    float k = i == 0 ? uCastK.x : uCastK.y;
    if (k < 0.004) continue;
    vec4 A = uCast[i * 2], B = uCast[i * 2 + 1];
    vec3 dd = bodyPos - A.xyz;
    dd -= up * dot(dd, up);
    float al = dot(dd, B.xyz);
    float q = length(vec2(al / A.w, length(dd - B.xyz * al) / B.w));
    s = max(s, (1.0 - smoothstep(0.55 + rag, 1.0 + rag, q)) * k);
  }
  return s;
}

// Rain-wet: the wash goes darker and richer (more pigment, not grey).
vec3 pcWetWash(vec3 c, float amt) {
  return pcDensity(c * mix(vec3(1.0), vec3(0.95, 0.96, 0.99), uWx.y * amt), 1.0 + 0.62 * uWx.y * amt);
}

// Snow cover: how much of an up-facing form is left as bare paper. upness 1 = facing the sky,
// rag = any anchored noise around 0.5 (keeps the edge of the cover ragged), shelter 0..1.
float pcSnowCover(float upness, float rag, float shelter) {
  float th = mix(1.12, 0.40, uWx.z) + shelter * 0.22;
  return smoothstep(th, th + 0.10, upness * 0.62 + rag * 0.42) * step(0.004, uWx.z);
}

// Triplanar lookup into the stroke atlas (p in metres, anchored; n body-local normal).
vec4 pcTri(vec3 p, vec3 n, float scale) {
  vec3 w = abs(n); w = w * w * w * w; w /= (w.x + w.y + w.z);
  return texture(uStrokeTex, p.yz * scale) * w.x
       + texture(uStrokeTex, p.zx * scale) * w.y
       + texture(uStrokeTex, p.xy * scale) * w.z;
}

// The same with a narrow blend band: for line work (cracks), where two half-strength copies
// of a pattern would read as a double exposure.
vec4 pcTri8(vec3 p, vec3 n, float scale) {
  vec3 w = abs(n); w = w * w; w = w * w; w = w * w; w /= (w.x + w.y + w.z);
  return texture(uStrokeTex, p.yz * scale) * w.x
       + texture(uStrokeTex, p.zx * scale) * w.y
       + texture(uStrokeTex, p.xy * scale) * w.z;
}

void pcWrite(vec3 col, float wet, vec3 nV, float viewZ, float id) {
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), clamp(wet, 0.0, 1.0));
  pcAux = pcAuxEnc(vec4(nV.xy, log2(1.0 + max(viewZ, 0.0)), id));
}
`;
