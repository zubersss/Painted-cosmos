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
uniform vec4 uOilD;
uniform vec4 uOilS;
uniform vec4 uOilG;
uniform vec4 uOilPx;
uniform mat4 uShM;
uniform highp sampler2D uShTex;
uniform vec4 uShK;
uniform sampler2D uShAir;
uniform vec4 uLamp;
uniform vec4 uLampF;
uniform vec4 uLampV;
uniform float uAuroraK;
uniform vec4 uGroundK;
uniform highp sampler2D uDabP;    // the dabs laid once (dabtex.js): a texel a dab
uniform highp sampler2D uDabId;   // and which dabs can lie on each texel of the tile
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
// (the golden hours: with the sun under about thirty degrees the oil look's light is gold and its air a pale gold,
// whatever the hour's own keys say: the owner's reference clip stands in that light with the sun still well up, its
// shadows about twice as long as what throws them and half the forest floor in the sun)
float pcGold() { return (1.0 - smoothstep(0.36, 0.80, dot(uSunDirW, uUpW))) * uDayness * (1.0 - uMoon) * (1.0 - uWx.x); }
vec3 pcOilSunC() { return mix(pow(uLight, vec3(uOilA.z)), vec3(1.0, 0.84, 0.52), 0.75 * pcGold()); }
// (the cool key with its green drawn down: a shade leans to violet and maroon, not to slate)
vec3 pcOilShadeC() { return pow(uGlaze, vec3(uOilA.w)) * vec3(1.0, uOilD.z, 1.0); }
vec3 pcBody(vec3 c) { return pcDensity(c, uOilA.y); }
vec3 pcTone(vec3 c, float level) {
  vec3 b = pcBody(c);
  vec3 sunC = pcOilSunC(), shC = pcOilShadeC();
  // (the lights are laid in lighter, yellower paint than the local colour, as a painter mixes them: the body colour's
  // full weight under a warm light turned every sunlit leaf and every sunlit patch of the floor to one orange)
  // (the light's own colour takes three tenths of a lit paint, not four: under the golden hours' light every lit leaf
  // went to orange-red, and the clip's lit floor is gold and yellow with orange in it)
  vec3 lit = pcDensity(c, mix(1.0, uOilA.y, 0.42)) * mix(vec3(1.0), sunC, 0.30) * uOilB.x;
  vec3 loc = b * mix(vec3(1.0), sunC, 0.45);
  // (the shade is the cool key over the body colour, with a quarter of the key's own hue at the body's value: a
  // multiply alone takes an orange floor to brown, and the reference's shadows on its leaf carpet are maroon and violet)
  // (and the sky's own light, added: without it a shadow on an orange floor is brown; with it, maroon and violet)
  vec3 g0 = b * shC * uOilD.x;
  // (a shade is deep, but not a purer colour than the thing in the light: a fifth of it goes to its own grey)
  // (measured against the clip's frames after overhauls 1 and 2: its shadow on the leaf floor is a plum, about
  // (0.37, 0.19, 0.22), blue over green; ours was a red-brown, (0.52, 0.25, 0.12). So two fifths of a shade is a violet
  // at the shade's own value, whatever the thing's colour)
  // (the violet is the cool key's own hue, its green drawn down: a plum by a day's violet key, a deep blue by a night's
  // teal one; a fixed violet turned a teal night's shadows purple)
  vec3 shH = shC / max(dot(shC, vec3(0.3, 0.5, 0.2)), 1e-3) * vec3(1.12, 0.84, 0.84);      // (by day about (1.12, 0.73, 1.12): a plum, red and blue level; with more blue the trunks' shade stood indigo)
  // (deeper, and half of it the key's hue: the floor's shadows were a wine red where the clip's are a violet umber)
  vec3 g1 = mix(pcDensity(g0, 1.35), vec3(dot(g0, vec3(0.3, 0.5, 0.2))) * shH * 0.92, 0.50) + pow(uGlaze, vec3(3.0)) * vec3(1.0, 0.8, 0.75) * uOilD.y * (0.35 + 0.65 * uDayness);      // (the sky's fill less blue than the key: on a dark thing it is most of the shade, and the trunks stood indigo)
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
  #ifdef PC_OIL
    // (the clip's wood stands in a thick pale air: a trunk thirty metres off is half gone. From the ship the land must
    // read, so the thickening eases off as the air's own reach grows with the eye's height)
    dist *= mix(uOilC.w, 1.6, clamp((1.0 / max(uFog.x, 1e-6) - 200.0) / 400.0, 0.0, 1.0));
  #endif
  float f = 1.0 - exp(-dist * uFog.x);
  #ifdef PC_OIL
    f = f * f * (3.0 - 2.0 * f);      // (thin near the eye, where colour and detail must stand whole; thick far off)
  #endif
  float q = f * uFog.y;
  float fl = floor(q);
  f = (fl + smoothstep(0.15, 0.85, q - fl)) / uFog.y;
  return clamp(max(f * uFog.z, uAirNear.x * (1.0 - exp(-dist / max(uAirNear.y, 0.1)))), 0.0, 1.0);
}

// Each distance band is lighter, cooler, lower in contrast; the far end is bare paper.
#ifdef PC_OIL
// (the oil look: the far end is the air's own colour, and toward the sun the air glows with the light's; the distance
// changes a thing's colour in flat steps and never softens its edge)
// (the gold air a step deeper than it was: the clip's far air reads about (0.77, 0.69, 0.60), ours was nearly white)
vec3 pcOilHaze(vec3 h) { return mix(pow(h, vec3(uOilC.x)), vec3(0.95, 0.85, 0.63), 0.75 * pcGold()); }
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
  h = mix(h, min(mix(pcOilSunC(), vec3(1.0), 0.5) * 1.05, vec3(1.0)), toward * uOilC.y);
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
#ifdef PC_OIL
float pcDappleS(vec3 bodyPos, float canopy, float lift, float w);
float pcSunAt(vec3 bodyPos, float canopy, float lift, float w);
// (the oil look: one shadow for everything, the strokes' own, as the pixel sees it; a blade of grass in a patch of
// sun on the painted floor stood in the watercolour pattern's shade)
float pcDappleL(vec3 bodyPos, float canopy, float lift) { return pcSunAt(bodyPos, canopy, lift, max(pcFp, 0.02)); }
float pcDappleLWash(vec3 bodyPos, float canopy, float lift) {
#else
float pcDappleL(vec3 bodyPos, float canopy, float lift) {
#endif
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
// The lantern's pool (the wanderer's, by night): a stroke within a few metres of the lantern is painted in its warm
// light, whole; at the pool's edge, where the warm light runs into the night's blue, a ring of strokes between the two
// (yellow-green on snow, as in the clip). paint: the stroke as the night has it; wash: its own colour; r: its number.
vec3 pcLamp(vec3 paint, vec3 wash, vec3 body, float r) {
  if (uLamp.w < 0.01) return paint;
  // (a modest pool, a few metres across, whose edge is broken stroke by stroke into the night: each stroke takes its
  // distance a metre and a half nearer or farther by its own number)
  float d = length(body - uLamp.xyz) + (r - 0.5) * 1.5;
  float k = uLamp.w * (1.0 - smoothstep(0.3, 3.4, d));
  if (k < 0.004) return paint;
  // (the wanderer's own shadow by the lantern, as in the clip's night: a dark streak on the lit snow from the feet away
  // from the lantern, widening as it goes; a stroke lies in it or out of it whole)
  if (uLampF.w > 0.5) {
    vec3 upL = normalize(uLamp.xyz);
    vec3 la = uLampF.xyz - uLamp.xyz; la -= upL * dot(la, upL);
    vec3 ld = la / max(length(la), 1e-3);
    vec3 lq = body - uLampF.xyz; lq -= upL * dot(lq, upL);
    float ls = dot(lq, ld), lside = length(lq - ld * ls);
    k *= 1.0 - 0.9 * step(-0.08 + (r - 0.5) * 0.08, ls) * step(lside, (0.12 + (r - 0.5) * 0.06) * (1.0 + max(ls, 0.0) / 0.55));
  }
  // (the pool: orange at the feet, yellow round it, then strokes of a pale warm light among the night's own, then the
  // night. Laid before this: one flat mustard out to three metres (a disc), then broad rings with a yellow-green one
  // (toxic, and banded: the critic's words; the clip's pool has no green in it).)
  float wl = dot(wash, vec3(0.3, 0.5, 0.2));
  vec3 orange = min(mix(pcDensity(wash, 1.2) * vec3(1.35, 0.90, 0.42) + vec3(0.10, 0.045, 0.0), vec3(1.0, 0.64, 0.22) * (0.75 + 0.5 * wl), 0.5), vec3(1.0));
  vec3 yellow = min(orange * vec3(0.98, 1.22, 1.28) + vec3(0.0, 0.03, 0.03), vec3(1.0));
  orange *= 0.90 + 0.16 * fract(r * 7.3); yellow *= 0.92 + 0.12 * fract(r * 5.1);
  vec3 pale = mix(paint, vec3(1.0, 0.90, 0.66), 0.42);
  return k > 0.74 ? orange : k > 0.48 ? yellow : k > 0.24 ? pale : paint;
}
// The sun at a place on the body, for one stroke (1 in the sun .. 0 in the shade): where the shadow map covers the place
// (shadow.js), what the map says, whole; beyond its square, and when there is no map, the leaf shadow's pattern.
float pcSunAt(vec3 bodyPos, float canopy, float lift, float w) {
  if (uShK.x >= 0.004) {
    vec3 q = (uShM * vec4(bodyPos, 1.0)).xyz;
    vec2 a = abs(q.xy);
    float inside = (1.0 - smoothstep(uShK.w, 0.97, max(a.x, a.y))) * uShK.x;
    if (inside >= 0.004) {
      float lit = step(q.z - uShK.y, textureLod(uShTex, q.xy * 0.5 + 0.5, 0.0).r);
      // (well inside the map's square the pattern is not worked out at all)
      if (inside > 0.996) return lit;
      return mix(pcDappleS(bodyPos, canopy, lift, w), lit, inside);
    }
  }
  return pcDappleS(bodyPos, canopy, lift, w);
}
// The sun on the GROUND for one stroke, from the shadow map taken down and smoothed (shadow.js AIR_FRAG: the share of a
// patch about half a metre across that something shades). A stroke is in the shade where more than about four tenths
// of its patch is, each stroke by its own number a little sooner or later. So the canopy throws masses of shade with
// pools of light between them, and no single leaf's gap is a fleck of light: asked of the fine map, the floor under a
// crown was a spatter of single lit dabs, and the shadows of bare trunks, ruled lines (the critic's "bar code").
// r: the stroke's number.
float pcSunAtSoft(vec3 bodyPos, float canopy, float lift, float w, float r) {
  if (uShK.x >= 0.004) {
    vec3 q = (uShM * vec4(bodyPos, 1.0)).xyz;
    vec2 a = abs(q.xy);
    float inside = (1.0 - smoothstep(uShK.w, 0.97, max(a.x, a.y))) * uShK.x;
    if (inside >= 0.004) {
      vec2 f = textureLod(uShAir, q.xy * 0.5 + 0.5, 0.5).rg;
      float cov = f.r * step(f.g / max(f.r, 1e-3) - 0.0006, q.z);
      float lit = step(cov, 0.30 + 0.24 * r);
      if (inside > 0.996) return lit;
      return mix(pcDappleS(bodyPos, canopy, lift, w), lit, inside);
    }
  }
  return pcDappleS(bodyPos, canopy, lift, w);
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
    #ifdef PC_OIL
      k *= 1.0 - uShK.x;      // (the oil look: while the shadow map is on the figures throw their real shadows into it, shadow.js)
    #endif
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
  vec3 hr = pcHash3(vec2(row, 7.31));
  float sh = hr.x * 17.0 + 0.5 * row;
  // (the joints lean, each row its own way: a stroke ends where the brush was lifted, not on a ruled line)
  float x = (p.x + (p.y - row - 0.5) * (hr.z - 0.5) * 1.3) / asp + sh;
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
  // (from the ship the strokes are laid broader, up to 1.7 times from where the air's reach has grown to a kilometre and
  // a half: a stroke is then a clump of trees or a patch of a field, and fewer of them lie at the size of a pixel, where
  // they flickered under a moving eye; checkpoint 1's flicker index, the log on r2)
  want *= 1.0 + 0.7 * clamp((1.0 / max(uFog.x, 1e-6) - 200.0) / 1300.0, 0.0, 1.0);
  float l = log2(max(want / w0, 1.0)), l0 = floor(l);
  return vec2(w0 * exp2(l0), l - l0);
}
// The same with the octave's own numbers, for strokes that come and go whole (pcDabs): x the finer layer's width, y how
// far toward the coarser, z the octave's number, w the distance's own number before it is cut to octaves (it runs on
// smoothly over the land, so its screen derivatives carry it to a stroke's centre).
vec4 pcStrokeOct4(float dist, float w0) {
  float want = max(dist, 0.05) * uOilPx.x * uOilA.x * uOilPx.y / 720.0;
  want *= 1.0 + 0.7 * clamp((1.0 / max(uFog.x, 1e-6) - 200.0) / 1300.0, 0.0, 1.0);
  float lu = log2(want / w0), l0 = floor(max(lu, 0.0));
  return vec4(w0 * exp2(l0), max(lu, 0.0) - l0, l0, lu);
}
// The same for a surface whose strokes may not grow past wmax (m): bark, a blade. x the finer layer's width, y how far
// toward the coarser, z 1 while a stroke is still a few pixels wide .. 0 where the strokes have shrunk under the pixel
// (there the surface is laid in its mean colour: nothing finer than a pixel is drawn).
vec3 pcStrokeOctCap(float dist, float w0, float wmax) {
  vec2 o = pcStrokeOct(dist, w0);
  if (o.x >= wmax) { o.x = wmax; o.y = 0.0; }
  float px = o.x / (max(dist, 0.05) * uOilPx.x);
  return vec3(o, smoothstep(1.3, 3.4, px));
}
// A stroke (its paint, and how much of the pixel it covers) laid over what is already there: in the hairline round
// a stroke what lies under shows a step darker, never lighter (two layers lit apart made bright cracks in a shade).
vec3 pcLay(vec3 under, vec3 paint, float cover, float present) {
  return mix(under * mix(1.0, uOilD.w, present * (1.0 - cover)), paint, cover * present * uOilC.z);
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
// One layer of strokes over a chart. ch: the chart (m); dcx, dcy: its screen derivatives; w: a stroke's width (m); asp:
// its length over its width; bendP: a place the chart's slow bend is anchored to (m); lim: the farthest a centre is
// looked for (pixels). Out: the stroke's three numbers, the pixels from here to its centre, how much of the pixel it
// covers. (Everything here that takes a screen derivative runs for every pixel alike: call it outside any branch.)
void pcStrokeLayer(vec2 ch, vec2 dcx, vec2 dcy, float w, float asp, vec3 bendP, float lim, out vec3 rnd, out vec2 ds, out float cover) {
  vec2 wn = (texture(uNoise3D, bendP / (w * 34.0) + 0.19).rg - 0.5) * 5.6;
  vec2 p = ch / w + wn;
  vec2 dpx = dcx / w + dFdx(wn), dpy = dcy / w + dFdy(wn);
  // (and the rows themselves waver)
  float wv = 0.83 * p.x + 1.7 * sin(0.61 * p.y);
  p.y += 0.22 * sin(wv);
  vec2 spx = vec2(length(vec2(dpx.x, dpy.x)), length(vec2(dpx.y, dpy.y)));
  vec2 ctr; float ePx;
  pcBrick(p, asp, spx, rnd, ctr, ePx);
  ds = pcChartToPx(ctr - p, dpx, dpy, lim);
  cover = pcStrokeCover(ePx);
}
// DABS (the owner's word on the first stills: "too wide and too outlined ... almost exactly like the video"). The
// reference's forest floor is not a course of tiles: it is leaf-shaped dabs, pointed at both ends, lying every way, one
// over another, with no line between them. A layer of dabs: two in every cell of a grid one dab wide, each anywhere in
// its cell, turned its own way, a little longer or shorter; where two lie over one another the one with the higher
// number is on top.
// THE LAYER IS LAID ONCE (dabtex.js; the overhaul plan's "strokes baked"): the dabs of a tile of PC_DAB_N cells, and for
// every texel of it the four topmost dabs that can lie there. A pixel reads its texel and tries those (most often one or
// two of them), where it
// tried eighteen with their random numbers before. The picture is the same kind; a pixel's work is a fraction.
// A DAB COMES AND GOES WHOLE: toward the next octave of the distance the finer layer's dabs are left out one by one, each
// by its own number. Whether a dab is there is asked at the dab's centre (the distance's number carried there), so no
// dab is cut where the answer changes across it, and a dab that is about to go has first grown small: nothing pops
// under a moving eye (checkpoint 1's flicker from the ship).
#define PC_DAB_N 32.0
#define PC_DAB_T 32.0
// One of a texel's four. code: which of the eighteen round the cell; p: the chart in cells; asp: a dab's length over
// its width; dpx, dpy: the chart's screen derivatives; oc: the distance's number at the pixel less the octave's, and
// its screen derivatives (pcStrokeOct4); ab: the share left out is ab.x + ab.y * (how far toward the next octave).
bool pcDabHit(float code, vec2 cell, vec2 p, float asp, vec2 dpx, vec2 dpy, vec2 ipx, float lim, vec3 oc, vec2 ab, out vec3 rnd, out vec2 o, out vec2 ds, out float ePx) {
  float k = mod(code, 2.0), ij = floor(code * 0.5 + 0.01);
  vec2 c = cell + vec2(mod(ij, 3.0), floor(ij / 3.0 + 0.01)) - 1.0;
  vec2 cw = mod(c, PC_DAB_N);
  vec4 P = texelFetch(uDabP, ivec2(int(cw.x + 0.5) * 2 + int(k + 0.5), int(cw.y + 0.5)), 0);
  o = c + P.xy;
  vec2 d = p - o;
  ds = pcChartToPx(-d, dpx, dpy, lim);
  // (is it there: its number against the share left out where its centre lies; near going, it is small)
  float gone = clamp(ab.x + ab.y * smoothstep(0.15, 0.85, oc.x + dot(oc.yz, ds)), 0.0, 1.0);
  float sz = clamp((P.a - gone * 1.12 + 0.12) / 0.12, 0.0, 1.0);
  if (sz <= 0.0) return false;
  // (it comes at a little over half its size and grows: grown from nothing, the youngest dabs were clusters of dots)
  sz = mix(0.58, 1.0, sz);
  float cs = cos(P.z), sn = sin(P.z);
  vec2 q = vec2(cs * d.x + sn * d.y, cs * d.y - sn * d.x);
  // (a dab is as long as its cell, a little more or less, and asp times narrower: dabtex.js dabSize)
  float a = (0.62 + 0.36 * fract(P.a * 16.0)), b = a / asp * (0.8 + 0.4 * fract(P.a * 256.0));
  a *= sz; b *= sz;
  float t = q.x / a;
  if (abs(t) >= 1.0) return false;
  float inside = b * (1.0 - t * t) - abs(q.y);
  if (inside <= 0.0) return false;
  // (how far inside the edge, in pixels: across the dab, and from its ends)
  ePx = min(inside * length(vec2(-sn, cs) * ipx), (a - abs(q.x)) * length(vec2(cs, sn) * ipx));
  // (its own three numbers, from where it lies on the world: the tile repeats, a dab's colour does not)
  rnd = pcHash3(c + k * 31.7);
  return true;
}
// One layer of dabs over a chart. ch: the chart (m); dcx, dcy: its screen derivatives; w: a dab's cell (half its
// length, m); asp: its length over its width; lim: the farthest a centre is looked for (pixels); oc, ab: see pcDabHit.
// Out: the top dab's numbers, its centre on the chart (m: the SAME for every pixel of the dab, to the last bit), the
// pixels from here to that centre and how much of the pixel the dab covers (a clean edge a pixel wide; 0: no dab here),
// and the numbers of the dab under it (has2: whether there is one).
// (The dabs' chart is not bent by a slow noise as the tiles' is: dabs lie every way and have no rows to hide, and with
// no bend a dab's centre is known exactly. A centre carried there by derivatives differed by a centimetre or two from
// pixel to pixel, and under a crown, where the shadow map changes from texel to texel, half the pixels of a dab found
// it in the sun and half in the shade: a dab of dots, seen in the first stills of the baked strokes.)
// (No derivative is taken in here: it may be called inside a branch.)
void pcDabLayer(vec2 ch, vec2 dcx, vec2 dcy, float w, float asp, float lim, vec3 oc, vec2 ab,
                out vec3 rnd1, out vec2 ctr, out vec2 ds, out float cov1, out vec3 rnd2, out float has2) {
  vec2 p = ch / w;
  vec2 dpx = dcx / w, dpy = dcy / w;
  vec2 ipx = 1.0 / max(vec2(length(vec2(dpx.x, dpy.x)), length(vec2(dpx.y, dpy.y))), vec2(1e-6));
  rnd1 = vec3(0.5); rnd2 = vec3(0.5); has2 = 0.0; cov1 = 0.0; ds = vec2(0.0); ctr = ch;
  if (ab.x >= 0.999 && ab.y >= 0.0) return;
  vec2 cell = floor(p);
  vec2 tf = min(floor((p - cell) * PC_DAB_T), PC_DAB_T - 1.0);
  vec4 ids = floor(texelFetch(uDabId, ivec2(mod(cell, PC_DAB_N) * PC_DAB_T + tf + 0.5), 0) * 255.0 + 0.5);
  vec3 r; vec2 o, dsc; float e; bool got = false;
  for (int s = 0; s < 4; s++) {
    float code = ids[s];
    if (code > 17.5) break;
    if (pcDabHit(code, cell, p, asp, dpx, dpy, ipx, lim, oc, ab, r, o, dsc, e)) {
      if (!got) { rnd1 = r; ctr = o * w; ds = dsc; cov1 = clamp(e, 0.0, 1.0); got = true; if (cov1 >= 0.999) break; }
      else { rnd2 = r; has2 = 1.0; break; }
    }
  }
}
// A dab's own colour from the wash it is laid in: heavier or lighter, toward the warm or toward the cool.
// leafy: 0 ground, rock, bark .. 1 leaves, which stray farther: here and there one is red, or still green.
vec3 pcDabTint(vec3 c, vec3 rnd, float leafy) {
  c = pcDensity(c, 1.0 + (rnd.x - 0.5) * 1.1 * uOilB.z);
  c *= mix(vec3(1.0), mix(vec3(1.10, 0.98, 0.80), vec3(0.88, 0.97, 1.10), rnd.y), 0.6 * uOilB.z);
  float odd = fract(rnd.y * 17.3);
  c *= mix(vec3(1.0), vec3(1.12, 0.66, 0.50), leafy * step(0.93, odd) * uOilB.z);
  c *= mix(vec3(1.0), vec3(0.78, 1.06, 0.52), leafy * step(odd, 0.13) * uOilB.z);
  return clamp(c, 0.0, 1.0);
}
// THIN STROKES (the owner, 2026-11-15: "thinner than the video ... copy how the lines are used"). A course of long thin
// strokes that run the way the surface runs, with nothing drawn between them: where two meet, each gives way to the
// other over one pixel. p: the chart in stroke widths (the strokes run along its first axis); asp: length over width.
// Out: the stroke's numbers and centre, how much of the pixel is its own (1 inside, a half on its edge), and the
// numbers of the stroke that has the rest.
void pcThin(vec2 p, float asp, vec2 spx, out vec3 rnd, out vec2 ctr, out float own, out vec3 rndN) {
  // (the rows are of unequal width)
  p.y += 0.27 * sin(1.7 * p.y + 0.9 * sin(0.21 * p.x));
  float row = floor(p.y);
  vec3 hr = pcHash3(vec2(row, 7.31));
  float sh = hr.x * 17.0 + 0.5 * row;
  const float J = 0.6, LEAN = 2.6;
  float x = (p.x + (p.y - row - 0.5) * (hr.z - 0.5) * LEAN) / asp + sh;
  float col = floor(x);
  float jl = col + (pcHash3(vec2(col, row)).y - 0.5) * J;
  float jr = col + 1.0 + (pcHash3(vec2(col + 1.0, row)).y - 0.5) * J;
  if (x < jl) { col -= 1.0; jr = jl; jl = col + (pcHash3(vec2(col, row)).y - 0.5) * J; }
  else if (x > jr) { col += 1.0; jl = jr; jr = col + 1.0 + (pcHash3(vec2(col + 1.0, row)).y - 0.5) * J; }
  rnd = pcHash3(vec2(col + 0.37, row + 0.71));
  ctr = vec2((0.5 * (jl + jr) - sh) * asp, row + 0.5);
  vec2 ipx = 1.0 / max(spx, vec2(1e-6));
  float eL = (x - jl) * asp * ipx.x, eR = (jr - x) * asp * ipx.x, eB = (p.y - row) * ipx.y, eT = (row + 1.0 - p.y) * ipx.y;
  float e = min(min(eL, eR), min(eB, eT));
  own = clamp(0.5 + e, 0.0, 1.0);
  rndN = rnd;
  if (e < 0.5) {
    if (e == eL) rndN = pcHash3(vec2(col - 1.0 + 0.37, row + 0.71));
    else if (e == eR) rndN = pcHash3(vec2(col + 1.0 + 0.37, row + 0.71));
    else {
      float rN = e == eB ? row - 1.0 : row + 1.0;
      vec3 hN = pcHash3(vec2(rN, 7.31));
      float xN = (p.x + (p.y - rN - 0.5) * (hN.z - 0.5) * LEAN) / asp + hN.x * 17.0 + 0.5 * rN;
      float cN = floor(xN);
      float l2 = cN + (pcHash3(vec2(cN, rN)).y - 0.5) * J;
      if (xN < l2) cN -= 1.0;
      else if (xN > cN + 1.0 + (pcHash3(vec2(cN + 1.0, rN)).y - 0.5) * J) cN += 1.0;
      rndN = pcHash3(vec2(cN + 0.37, rN + 0.71));
    }
  }
}
// One layer of thin strokes over a chart (the arguments as pcStrokeLayer's; w: a stroke's width, m).
// bend: how far the slow noise bends the rows, in stroke widths (9: the ground's flow, whose strokes swell and thin with
// it to about twice and half their width; 2: bark, whose streaks keep their width)
// (bend below 0: a SLOW, WIDE bend, minus that many stroke widths over a reach five times as long: the strokes sweep in
// long arcs, as wind-laid snow does, where the quick bend makes them ripple as water does)
void pcThinLayer(vec2 ch, vec2 dcx, vec2 dcy, float w, float asp, vec3 bendP, float lim, float bend, out vec3 rnd, out vec2 ds, out float own, out vec3 rndN) {
  vec2 wn = (texture(uNoise3D, bendP / (w * (bend < 0.0 ? 300.0 : 60.0)) + 0.19).rg - 0.5) * abs(bend);
  vec2 p = ch / w + wn;
  vec2 dpx = dcx / w + dFdx(wn), dpy = dcy / w + dFdy(wn);
  vec2 spx = vec2(length(vec2(dpx.x, dpy.x)), length(vec2(dpx.y, dpy.y)));
  vec2 ctr;
  pcThin(p, asp, spx, rnd, ctr, own, rndN);
  ds = pcChartToPx(ctr - p, dpx, dpy, lim);
}
// The chart of a world's ground: metres along the sphere on the face of the cube the place lies on (equal angles), so
// the same place has the same chart from every patch of terrain and at every height. body: body-local metres.
vec2 pcGroundChart(vec3 body, float R) {
  vec3 a = abs(body);
  vec3 q = a.x >= a.y && a.x >= a.z ? vec3(body.y, body.z, a.x) : a.y >= a.z ? vec3(body.z, body.x, a.y) : vec3(body.x, body.y, a.z);
  return R * atan(q.xy, vec2(q.z));
}
// How the ground's chart changes for a change db of the place (the same laying as pcGroundChart). A derivative of the
// chart is NOT taken from the chart itself: the body's own coordinates are kilometres, known to half a millimetre, and
// their difference from one pixel to the next is a few millimetres near the eye: a tenth of it noise. The place's
// derivative is taken from a position measured from the eye (a varying of its own) and carried through here.
vec2 pcGroundChartD(vec3 body, vec3 db, float R) {
  vec3 a = abs(body);
  vec3 q, dq;
  if (a.x >= a.y && a.x >= a.z) { q = vec3(body.y, body.z, a.x); dq = vec3(db.y, db.z, db.x * sign(body.x)); }
  else if (a.y >= a.z) { q = vec3(body.z, body.x, a.y); dq = vec3(db.z, db.x, db.y * sign(body.y)); }
  else { q = vec3(body.x, body.y, a.z); dq = vec3(db.x, db.y, db.z * sign(body.z)); }
  return R * (q.z * dq.xy - q.xy * dq.z) / (q.z * q.z + q.xy * q.xy);
}
// The way from the body's centre to the place whose chart is ch, on the face that body lies on (pcGroundChart undone).
vec3 pcGroundUnchart(vec3 body, vec2 ch, float R) {
  vec3 a = abs(body);
  vec2 t = tan(ch / R);
  vec3 d = a.x >= a.y && a.x >= a.z ? vec3(sign(body.x), t.x, t.y) : a.y >= a.z ? vec3(t.y, sign(body.y), t.x) : vec3(t.x, t.y, sign(body.z));
  return normalize(d);
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
