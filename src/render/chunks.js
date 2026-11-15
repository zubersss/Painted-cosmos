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
// A world seen from orbit is round (PAINTER 17, the M4 critique's third item: Earth from a radius up was a lumpy potato,
// its alpine range standing off the limb as a meringue; 300 m of relief on a 4 km ball is a fourteenth of the radius).
// A painter draws the limb as one true curve with a hand's wobble: above about a third of a radius the relief is drawn
// in toward the datum sphere, to a quarter of itself from 0.8 radii up. Only where a vertex is DRAWN moves (by this
// shift, along the radius); what paints it (the body coordinates the washes are laid by) stays, so no wash swims
// as the ship climbs. On the ground uRound.x is 0 and nothing moves at all.
uniform vec2 uRound;
vec3 pcRound(vec3 body) {
  float r = max(length(body), 1.0);
  return body * ((uRound.y - r) * uRound.x / r);
}
`;

// Fog in banks (PAINTER 19, the M4 pre-ship round: Uranus' Pearl Fog Flats were an almost empty mint-white page, Venus'
// haze big flat cream areas: a fog that thickens evenly with the distance lays one flat wash over everything past the
// first stones). Where a world's fog lies thick it lies in drifts anchored to the land, some tens of metres across and
// layered (the drifts change three times faster with height than along the ground: on a cliff face they are bands,
// not blots): in a thin drift the land is seen as if it were nearer, a step darker; a thick one takes it a little
// sooner (only a little: the ground at the feet stays a step below the fog). The far end still goes to the air (only
// the distance the fog is reckoned at changes). pcFogBank returns the factor on that distance: 1 where the world says
// nothing (uFogBank.x 0). Needs uNoise3D and uFogBank declared. Tried: blots in three dimensions alike (dark spots
// over Venus' mesas), thick drifts taking up to 1.4 times the distance (the near flats on Uranus went paler).
export const FOG_BANK = /* glsl */`
float pcFogBank(vec3 body) {
  if (uFogBank.x < 0.003) return 1.0;
  vec3 q = body / uFogBank.y, upB = normalize(body);
  q += upB * (dot(q, upB) * 3.0);
  float n = texture(uNoise3D, q + vec3(0.17, 0.41, 0.73)).r * 0.9 + texture(uNoise3D, q * 2.3 + vec3(0.61, 0.07, 0.29)).g * 0.1;
  float thin = smoothstep(0.38, 0.66, n);
  return 1.0 + uFogBank.x * (0.15 - 1.0 * thin);
}
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
uniform vec2 uFogBank;
${FOG_BANK}
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
#ifdef PC_OIL
uniform vec4 uOilA;    // the oil look's dials (shared.js OIL)
uniform vec4 uOilB;
uniform vec4 uOilC;
uniform vec4 uOilPx;
#endif
// (the 8-bit fallback, shared.js uAux8: normal to 0..1, log depth over 32, the region over 8 with its hash kept off the next class)
vec4 pcAuxEnc(vec4 a) { return uAux8 > 0.5 ? vec4(a.xy * 0.5 + 0.5, a.z / 32.0, (floor(a.w + 0.001) + fract(a.w + 0.001) * 0.9) / 8.0) : a; }
vec4 pcAuxDec(vec4 a) { return uAux8 > 0.5 ? vec4(a.xy * 2.0 - 1.0, a.z * 32.0, a.w * 8.0 + 0.02) : a; }

// The marks as the pixel sees them (PAINTER, R1 W2.1 of docs/lead/SHARP-SMOOTH-PLAN.md). A mark (the leaf shadow, a
// touch, a fleck of grit) is a threshold on a noise channel. Where the pattern is finer than the pixel the noise is read
// from a mip level that has averaged it, but the threshold made it hard again: from the ship the far floor was rows of
// dashes and camouflage blotches, hidden only while the brush repainted every far pixel. Here a threshold is widened by
// what of its channel lies inside the pixel, so a mark finer than the pixel eases to the share of the pixel it covers:
// the same mean (the same palette), no new edges. Near the eye nothing changes.
// pcFp: the pixel's footprint on the land in metres, set at the top of a material's main, before any discard
// (pcFp = pcFootprint(vBody);); a material that does not set it keeps every mark exactly as before.
float pcFp = 0.0;
// (R1 re-fix) pcDist: the view distance in metres, set beside pcFp by a material that lays the leaf shadow from afar
// (pcDappleL: its far octaves); 0 keeps it as it was
float pcDist = 0.0;
float pcFootprint(vec3 p) { vec3 a = dFdx(p), b = dFdy(p); return sqrt(max(dot(a, a), dot(b, b))); }
// What of a uNoise3D channel read at p / sc lies inside the pixel, as a variance: (the channel's variance, the squared
// size in texels at which half of it is averaged away), measured on the 64^3 noise's own mip chain (texgen.js
// genNoise3D: R and G alike, B finer, A the billows; docs/notes/painter.md, R1).
const vec2 PC_NRG = vec2(0.0191, 100.0), PC_NB = vec2(0.0163, 25.0), PC_NA = vec2(0.0550, 56.0);
float pcSub(float sc, vec2 k) { float s = 64.0 * pcFp / sc; s *= s; return k.x * s / (s + k.y); }
// smoothstep(e0, e1, v) widened by sub (the pcSub of each channel in v times its weight squared): the soft edge and the
// spread inside the pixel add as variances, so the mean share is kept. (1.4: a smoothstep as wide as a normal spread of
// sd s is about 1.9 s each side, 3.5 s^2; the mip level's box already averages most of that, and against the design
// supersampled 16 times (W2.1 off, 4x, box-filtered down) a full 3.5 was too soft: at E_1000_90 the error to it fell
// from 0.63 (the marks as drawn) to 0.48 at 3.5 and 0.42 at 1.5. The plan's lapvar bound there (350, the supersampled
// design's own is 675) sets the floor: 1.2 gave 366.)
float pcStepF(float e0, float e1, float v, float sub) {
  float m = 0.5 * (e0 + e1), h = 0.5 * (e1 - e0);
  h = sqrt(h * h + 1.4 * sub);
  return smoothstep(m - h, m + h, v);
}
// A thin line of a distance field (1 - smoothstep(e0, e1, a), a >= 0 its distance): widened by gpx, how much a changes
// across the pixel, keeping how much of the land the line covers; past the size of its cells (cell, metres) it is laid
// as that cover (cov per unit of the line's width).
float pcLineF(float e0, float e1, float a, float gpx, float cell, float cov) {
  float m = 0.5 * (e0 + e1), h = 0.5 * (e1 - e0);
  float h2 = sqrt(h * h + 0.25 * gpx * gpx), m2 = max(m, h2);
  float l = (1.0 - smoothstep(m2 - h2, m2 + h2, a)) * (m / m2);
  return mix(l, cov * m, smoothstep(0.15, 0.6, pcFp / cell));
}

// Pigment density model: heavier pigment grows richer, not muddier.
vec3 pcDensity(vec3 c, float d) {
  return clamp(c - (c - c * c) * (d - 1.0), 0.0, 1.0);
}

// Light in four soft value steps. x in 0..1 -> level in 0..3.
float pcLevel(float x, float soft) {
  #ifdef PC_OIL
    // (the oil look: a low sun still lights what faces it at all. The watercolour's steps follow the angle, so under a
    // sun ten degrees up the flat ground is local colour at best; the reference's wood at that hour is bright gold where
    // the sun reaches and violet where it does not. What faces the sun even a little is lit, what is turned or shaded
    // is not, and the angle only settles the few forms in between.)
    x = 0.30 + 0.62 * smoothstep(-0.10, 0.30, 2.0 * x - 1.0);
  #endif
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
  // (PAINTER 16/17: it was 0.17 + 0.26 x, every form in the two deepest washes; the lit side keeps the local wash now,
  // so a wood in the rain is still a wood in three values)
  x = mix(x, 0.25 + x * 0.36, uStorm);
  return smoothstep(0.26 - soft, 0.26 + soft, x)
       + smoothstep(0.50 - soft, 0.50 + soft, x)
       + smoothstep(0.76 - soft, 0.76 + soft, x);
}
// (R1 W2.1) the same, its steps' edges no narrower than the pixel sees them: fw, how much x changes across the pixel
// (fwidth, taken where the flow is uniform); 0 is pcLevel itself
float pcLevelF(float x, float soft, float fw) { return pcLevel(x, sqrt(soft * soft + 0.25 * fw * fw)); }

// Layer the washes for a light level:
//   3 sunlit: the local wash diluted so paper shows, warmed by the light
//   2 local colour   1 one cool glaze   0 two glazes, pigment pooling
#ifdef PC_OIL
// THE OIL LOOK'S LIGHT (docs/references/README.md: warm light against cool shade, deep darks, nothing diluted toward
// paper). A wash's transmittance becomes a body colour by laying it heavier (richer, never greyer); the watercolour's
// pale light and glaze keys, raised to a power, are the oil's warm light and its cool, violet shade.
vec3 pcOilSunC() { return pow(uLight, vec3(uOilA.z)); }
vec3 pcOilShadeC() { return pow(uGlaze, vec3(uOilA.w)); }
vec3 pcBody(vec3 c) { return pcDensity(c, uOilA.y); }
vec3 pcTone(vec3 c, float level) {
  vec3 b = pcBody(c);
  vec3 sunC = pcOilSunC(), shC = pcOilShadeC();
  vec3 lit = b * sunC * uOilB.x;
  vec3 loc = b * mix(vec3(1.0), sunC, 0.45);
  // (the shade is the cool key over the body colour, with a quarter of the key's own hue at the body's value: a
  // multiply alone takes an orange floor to brown, and the reference's shadows on its leaf carpet are maroon and violet)
  vec3 g1 = mix(b * shC, shC * dot(b, vec3(0.3, 0.5, 0.2)) * 1.25, 0.25);
  vec3 g2 = pcDensity(g1, 1.7);
  vec3 r = mix(g2, g1, clamp(level, 0.0, 1.0));
  r = mix(r, loc, clamp(level - 1.0, 0.0, 1.0));
  r = mix(r, lit, clamp(level - 2.0, 0.0, 1.0));
  return r;
}
vec3 pcToneWash(vec3 c, float level) {
#else
vec3 pcTone(vec3 c, float level) {
#endif
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
#ifdef PC_OIL
// (the oil look: the far end is the air's own colour, and toward the sun the air glows with the light's; the distance
// changes a thing's colour in flat steps and never softens its edge)
vec3 pcOilHaze(vec3 h) { return pow(h, vec3(uOilC.x)); }
vec3 pcAtmos(vec3 c, float f) { return mix(c, pcOilHaze(uHaze), f); }
vec3 pcAtmosWash(vec3 c, float f) {
#else
vec3 pcAtmos(vec3 c, float f) {
#endif
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
#ifdef PC_OIL
vec3 pcAtmosV(vec3 c, float f, vec3 viewPos) {
  vec3 h = pcOilHaze(pcHazeAt(viewPos));
  vec3 sunV = normalize((viewMatrix * vec4(uSunDirW, 0.0)).xyz);
  float toward = pow(max(dot(normalize(viewPos), sunV), 0.0), 3.0) * uDayness * (1.0 - uMoon) * (1.0 - uWx.x);
  h = mix(h, min(pcOilSunC() * 1.06, vec3(1.0)), toward * uOilC.y);
  return mix(c, h, f);
}
vec3 pcAtmosVWash(vec3 c, float f, vec3 viewPos) {
#else
vec3 pcAtmosV(vec3 c, float f, vec3 viewPos) {
#endif
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
// (what of the leaf shadow lies inside the pixel, as a variance: its two channels at 13 m and 4.1 m, weights 0.68 and 0.32)
// (R1 re-fix: the 4.1 m channel repeats every 4.1 m; from about 1.6 m a pixel, 1 km up, its repeat is under three pixels
// and what the mip level leaves of it is a regular lattice. It eases to its mean from 0.20 to 0.40 of its repeat a pixel
// (nothing changes at 400 m), its whole variance counted inside the pixel, so the share of the floor in sun is kept.)
float pcDappleE() { return smoothstep(0.20, 0.40, pcFp / 4.1); }
// (R1 re-fix: the leaf shadow's 13 m channel, its cells 3.25 m, was a hatch of one- and two-pixel dashes from 1 km, in the
// design itself (the same hatch in a render at 4x, box-filtered down) and in the picture: a mark finer than a brush
// can lay. Far off it is laid at twice its size for each doubling of the distance past 500 m (the terrain's brush marks
// keep their size on the sheet the same way), the two sizes cross-faded, each thresholded on its own so the share of
// sun is the same at every size: flecks of a few pixels, never a hatch. Under 500 m nothing changes.)
vec3 pcDappleOct() { float ld = log2(max(pcDist / 500.0, 1.0)), l0 = floor(ld); return vec3(13.0 * exp2(l0), smoothstep(0.2, 0.8, ld - l0), 0.0); }
float pcDappleSub() { vec3 o = pcDappleOct(); return 0.4624 * pcSub(o.x * (1.0 + o.y), PC_NRG) + 0.1024 * mix(pcSub(4.1, PC_NRG), PC_NRG.x, pcDappleE()); }
float pcDappleL(vec3 bodyPos, float canopy, float lift) {
  vec3 pp = bodyPos + uSunDirL * (lift / max(dot(normalize(bodyPos), uSunDirL), 0.22));
  vec3 o = pcDappleOct();
  float b = mix(texture(uNoise3D, pp / 4.1 + 0.37).g, 0.5, pcDappleE());
  float th = mix(0.05, 0.585, canopy);
  // mostly a crisp-edged glaze, here and there feathered where the wash was still wet
  float w = mix(0.012, 0.075, smoothstep(0.55, 0.75, texture(uNoise3D, pp / 23.0 + 0.7).b));
  // under an overcast nothing casts a shadow: only the dimness under the canopy is left
  // (R1 W2.1: from the air the flecks are finer than the pixel; there they ease to the share of the floor in sun)
  // (the 13 m channel read with the place's own gradients over its own scale: the scale steps with the distance, and the
  // screen's derivative across a step would read the coarsest level along it; at 13 m it is the read as it always was)
  vec3 dpx = dFdx(pp), dpy = dFdy(pp);
  float subB = 0.1024 * mix(pcSub(4.1, PC_NRG), PC_NRG.x, pcDappleE());
  float s = pcStepF(th - w, th + w, textureGrad(uNoise3D, pp / o.x, dpx / o.x, dpy / o.x).r * 0.68 + b * 0.32, 0.4624 * pcSub(o.x, PC_NRG) + subB);
  if (o.y > 0.001) s = mix(s, pcStepF(th - w, th + w, textureGrad(uNoise3D, pp / (2.0 * o.x), dpx / (2.0 * o.x), dpy / (2.0 * o.x)).r * 0.68 + b * 0.32, 0.4624 * pcSub(2.0 * o.x, PC_NRG) + subB), o.y);
  return mix(s, 1.0 - 0.42 * canopy, uWx.x);
}
float pcDapple(vec3 bodyPos, float canopy) { return pcDappleL(bodyPos, canopy, 8.0); }
#ifdef PC_OIL
// The leaf shadow for one stroke of the oil look (width w, read at the stroke's centre: no derivative is taken there):
// the same pattern as pcDappleL, with a clean edge, so a stroke lies in the sun or in the shade whole. Under a low sun
// the pattern is drawn out along the sun's bearing, as the shadows of trunks and crowns are: up to five times at
// eleven degrees and under.
float pcDappleS(vec3 bodyPos, float canopy, float lift, float w) {
  vec3 up = normalize(bodyPos);
  float se = dot(up, uSunDirL);
  vec3 pp = bodyPos + uSunDirL * (lift / max(se, 0.22));
  vec3 hd = uSunDirL - up * se;
  float hl = length(hd);
  if (hl > 1e-4) {
    float stretch = clamp(hl / max(se, 0.02), 1.0, 5.0);
    pp -= (hd / hl) * dot(pp, hd / hl) * (1.0 - 1.0 / stretch);
  }
  float a = textureLod(uNoise3D, pp / 13.0, log2(max(64.0 * w / 13.0, 1.0))).r;
  float b = textureLod(uNoise3D, pp / 4.1 + 0.37, log2(max(64.0 * w / 4.1, 1.0))).g;
  float th = mix(0.05, 0.585, canopy);
  float s = smoothstep(th - 0.015, th + 0.015, a * 0.68 + b * 0.32);
  return mix(s, 1.0 - 0.42 * canopy, uWx.x);
}
#endif

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

#ifdef PC_OIL
// ---- THE OIL LOOK'S STROKES -------------------------------------------------------------------------------------------
// A stroke is a patch of ONE flat colour with a clean edge, laid on the surface itself (docs/references/README.md, "what
// the clip does" and the crispness rule): it stays where it is when the eye moves and it is smaller far off. The strokes
// of a surface are a course of bricks over a chart of it (two coordinates in metres that lie in the surface): rows one
// stroke wide, each brick a stroke long, every row shifted and every joint moved at random, the chart itself bent by a
// slow noise so that no row runs straight. Everything that colours a stroke is read at the stroke's own centre, so the
// stroke is flat; its edge is drawn from the chart's screen derivatives, a pixel wide at any size and any slant.
//
// The size: a stroke is meant to be uOilA.x pixels wide (at 720 lines) wherever it is, so the strokes are laid in
// octaves of the distance, each twice the size of the last. Between two octaves no two layers are blended: a stroke of
// the finer layer is there or it is not (each by its own number), and where it is not, the coarser layer shows.
vec3 pcHash3(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.xxy + q.yzz) * q.zyx);
}
// One layer. p: the chart in units of a stroke's width; asp: a stroke's length over its width; sx, sy: chart units a
// pixel along the chart's two axes (from its screen derivatives). Out: the stroke's three numbers, its centre in the
// chart's units, and how far inside its edge the pixel lies, in pixels.
void pcBrick(vec2 p, float asp, vec2 spx, out vec3 rnd, out vec2 ctr, out float edgePx) {
  float row = floor(p.y);
  float sh = pcHash3(vec2(row, 7.31)).x * 17.0 + 0.5 * row;
  float x = p.x / asp + sh;
  float col = floor(x);
  const float J = 0.56;
  float jl = col + (pcHash3(vec2(col, row)).y - 0.5) * J;
  float jr = col + 1.0 + (pcHash3(vec2(col + 1.0, row)).y - 0.5) * J;
  if (x < jl) { col -= 1.0; jr = jl; jl = col + (pcHash3(vec2(col, row)).y - 0.5) * J; }
  else if (x > jr) { col += 1.0; jl = jr; jr = col + 1.0 + (pcHash3(vec2(col + 1.0, row)).y - 0.5) * J; }
  rnd = pcHash3(vec2(col + 0.37, row + 0.71));
  ctr = vec2((0.5 * (jl + jr) - sh) * asp, row + 0.5);
  float ex = min(x - jl, jr - x) * asp / max(spx.x, 1e-6);
  float ey = min(p.y - row, row + 1.0 - p.y) / max(spx.y, 1e-6);
  edgePx = min(ex, ey);
}
// The octave of the distance: x the finer layer's stroke width (m), y how far toward the coarser one (0..1).
vec2 pcStrokeOct(float dist, float w0) {
  float want = max(dist, 0.05) * uOilPx.x * uOilA.x * uOilPx.y / 720.0;     // metres wide to be that many pixels
  float l = log2(max(want / w0, 1.0)), l0 = floor(l);
  return vec2(w0 * exp2(l0), l - l0);
}
// How much of the pixel a stroke covers, from how far inside its edge it lies (pixels): a clean edge one pixel wide,
// with a hairline between two strokes for what lies under them.
float pcStrokeCover(float edgePx) {
  float g = max(0.5 * uOilB.y * uOilA.x * uOilPx.y / 720.0, 0.35);
  return smoothstep(g - 0.6, g + 0.6, edgePx);
}
// A value known at the pixel, carried to a point ds pixels away along the surface (a stroke's centre).
#define PC_AT(v, ds) ((v) + dFdx(v) * (ds).x + dFdy(v) * (ds).y)
// The pixels from here to a place dc chart units away (dpx, dpy: the chart's screen derivatives), kept inside lim px.
vec2 pcChartToPx(vec2 dc, vec2 dpx, vec2 dpy, float lim) {
  float det = dpx.x * dpy.y - dpx.y * dpy.x;
  if (abs(det) < 1e-12) return vec2(0.0);
  vec2 ds = vec2(dpy.y * dc.x - dpy.x * dc.y, -dpx.y * dc.x + dpx.x * dc.y) / det;
  float l = length(ds);
  return l > lim ? ds * (lim / l) : ds;
}
// The chart of a world's ground: metres along the sphere on the face of the cube the place lies on (equal angles), so
// the same place has the same chart from every patch of terrain and at every height. body: body-local metres.
vec2 pcGroundChart(vec3 body, float R) {
  vec3 a = abs(body);
  vec3 q = a.x >= a.y && a.x >= a.z ? vec3(body.y, body.z, a.x) : a.y >= a.z ? vec3(body.z, body.x, a.y) : vec3(body.x, body.y, a.z);
  return R * atan(q.xy, vec2(q.z));
}
// A noise channel read for a stroke of width w (m) at its centre: no derivative is taken there (the centre jumps from
// stroke to stroke), the level is the stroke's own size, so what is finer than the stroke is averaged.
vec4 pcNoiseS(vec3 p, float scale, float w) { return textureLod(uNoise3D, p / scale, log2(max(64.0 * w / scale, 1.0))); }
#endif

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
  // (R1 W2.5: .y carries the region squared, not the normal's y, which nothing read: after a multisample resolve
  // y - w^2 says whether the samples under a pixel lay on more than one region, post.js AUXFIX_FRAG)
  pcAux = pcAuxEnc(vec4(nV.x, uAux8 > 0.5 ? nV.y : id * id, log2(1.0 + max(viewZ, 0.0)), id));
}
`;
