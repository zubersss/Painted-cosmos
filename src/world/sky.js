// Painted Cosmos: the sky wash, clouds, sun and (simple, for now) space. OWNER: PAINTER.
// One full-screen triangle drawn last at the far plane. Everything is evaluated per view ray in
// the active body's local frame, so clouds and wash variation are anchored to the planet.
import * as THREE from 'three';
import { G, OIL, register, ensureGlobals } from '../render/shared.js';
import { RING_PROFILE } from './orbit.js';

// The oil sky's five dials, so that a still can be compared against the one before it without touching the code.
// They do nothing at all in the watercolour game: the shader reads them only inside #ifdef PC_OIL.
//   ?cloudform=  how much of the painted cloud is laid: its size, its lanes and the lobes along its edges
//                (0: the cloud exactly as it was, one flat shape with a step down one side)
//   ?skycap=     the ceiling on the sky's value, the sun's own disc apart (1: no ceiling, the sky as it was)
//   ?cloudlit=   how far the cloud's lit side stands from its shadowed side (0: none, the mass in one tone)
//   ?skyair=     how far the sky's lowest band is laid in the SAME air the far land ends in, and nothing else
//                (0: the sky exactly as it was, its own air; 1: one air for the land and the sky. See pcSkyAir.)
//   ?skyairtop=  how high that band stands, as dot(view, up): 0.075 is about four degrees above the horizon
const _qs = (() => { try { return new URLSearchParams(location.search); } catch (e) { return null; } })();
const _qn = (k, d) => (_qs && _qs.has(k) && isFinite(+_qs.get(k)) ? +_qs.get(k) : d);

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
uniform vec4 uRingS;        // a ringed world seen from under its rings: inner, outer radius (m), strength (0: none)
uniform vec3 uRingC;        // the rings' wash
uniform vec4 uBelt;         // a banded world from inside: belts pole to pole, how far their edges wander (rad), strength
uniform vec4 uSeaC;         // a sea of cloud: its top above the body's radius (m), strength, how high its heads stand
uniform vec4 uAurora;       // an aurora over a biome that names it: x strength (0: none)
uniform float uTime;
varying vec3 vDirL;
varying vec3 vDirW;
layout(location = 1) out highp vec4 pcAux;
uniform float uAux8;
#ifdef PC_OIL
uniform vec4 uOilA;
uniform vec4 uOilC;
uniform vec4 uOilG;
uniform vec4 uOilS;         // x: how far the far air leans to the blue-violet of the owner's aerial references
uniform vec4 uSkyOil;       // x cloud shaping, y the ceiling on the sky's value, z the cloud's lit side (the dials above)
uniform vec4 uSkyAir;       // x: how far the lowest band is the land's own air   y: how high that band stands (dot(view, up))
uniform vec4 uLookN;        // w: the air from the air (L5; render/shared.js OIL.uLookN, set by world/index.js)
uniform vec4 uLookG;        // x: the golden hour's sky painted by direction and in bands (render/shared.js OIL.uLookG)
#endif

vec3 dens(vec3 c, float d) { return clamp(c - (c - c * c) * (d - 1.0), 0.0, 1.0); }
#ifdef PC_OIL
// A SKY LAID IN BRUSH STROKES (the owner, twice: 2026-11-16 and again 2026-11-19, "the sky of the ice planets still
// needs to be streaky and painted like"). The oil sky was laid in six broad bands with nothing inside them, and on
// the ice worlds -- where there is no weather, no cloud and nothing else in the sky at all -- that left a smooth
// wall of colour: a gradient, not paint. This lays the strokes a brush would leave in it.
//
// WHAT A STROKE IS: long, nearly level, tapered to nothing at both ends, as wide as a brush and not a hairline, and
// a step DEEPER or LIGHTER than the sky it lies on -- never another colour, so every world keeps its own (Uranus
// stays mint, Pluto stays lilac). Several families of them cross at shallow angles, as a sky laid in one sitting
// does; each family is a set of level lines about an axis of its own that leans a little from straight up, and
// along a line the strokes come and go with gaps between.
//
// It is the SAME construction as the night sky's streaks below the owner asked for in November -- families of level
// lines, segments along them, tapered -- at a quarter of their frequency and in the sky's own colour instead of the
// aurora's cyan. The two are deliberately alike: it is one hand painting.
//
// k: how strongly (0 none; the world's own, data/looks/<world>.js skyStrokes, through uSkyOil.w).
vec3 pcSkyStrokes(vec3 sky, vec3 d, vec3 up, float k, vec4 wv) {
  if (k < 0.002) return sky;
  vec3 ta = normalize(cross(up, vec3(0.31, 0.74, 0.59))), tb = cross(up, ta);
  vec3 col = sky;
  for (int L = 0; L < 3; L++) {
    float fl = float(L);
    vec2 lean = L == 0 ? vec2(0.13, 0.04) : L == 1 ? vec2(-0.09, 0.15) : vec2(0.05, -0.21);
    vec3 ax = normalize(up + ta * lean.x + tb * lean.y);
    vec3 a1 = normalize(ta - ax * dot(ta, ax)), a2 = cross(ax, a1);
    float fq = L == 0 ? 15.0 : L == 1 ? 11.0 : 19.0;          // (a row every few degrees: a brush, not a comb)
    float rowf = dot(d, ax) * fq + 0.9 * (L < 2 ? wv.r : wv.b) + fl * 0.41;
    float row = floor(rowf);
    float hx = fract(sin((row + fl * 71.0) * 91.7) * 43758.5453), hy = fract(sin((row + fl * 13.0) * 37.3) * 24634.63);
    // along the line: a few long strokes with gaps, the longest on few lines
    float along = atan(dot(d, a2), dot(d, a1)) * (1.0 + 3.5 * hx * hx) + hy * 40.0;
    float seg = floor(along), ft = along - seg;
    float hs = fract(sin((seg + row * 57.0 + fl * 19.0) * 12.9898) * 43758.5453), hl = fract(hs * 7.31 + hx);
    float a0 = 0.03 + 0.22 * hl, a1e = a0 + 0.34 + 0.60 * hs * (1.0 - a0 - 0.34);
    float sp = (ft - a0) / max(a1e - a0, 1e-3);
    float taper = smoothstep(0.0, 0.34, sp) * smoothstep(0.0, 0.34, 1.0 - sp);
    // as wide as a brush: a share of the gap between lines, never thinner than a pixel of the screen
    float fwr = max(fwidth(rowf), 1e-4);
    float wid = max((0.10 + 0.26 * hl) * taper, 0.0);
    float cov = smoothstep(-0.5 * fwr, 0.5 * fwr, wid - abs(rowf - row - 0.5)) * step(0.0, sp) * step(sp, 1.0) * step(0.22, fract(hs * 3.7 + hy));
    // deeper or lighter by the stroke's own draw, as a loaded brush and a dry one leave different paint
    // (MEASURED at half these numbers, Pluto's Pale Heart Glacier at noon: a quarter of the sky's pixels moved, by
    //  3.5 of 255 on average -- there, but not to be SEEN, and the owner has asked for a painted sky twice.)
    float dp = hs < 0.52 ? 1.0 + (0.22 + 0.50 * hl) : 1.0 - (0.17 + 0.36 * hl);
    col = mix(col, dens(col, dp), cov * k);
  }
  return col;
}
#endif
${RING_PROFILE}
#ifdef PC_OIL
// THE COLOUR THE FAR AIR GOES TO, the same one the land is lost into (render/chunks.js pcOilHaze). Every one of the
// eight aerial paintings the owner sent has the distance turning BLUE-VIOLET, measured at (0.48, 0.50, 0.63); ours
// went to a warm cream, and so did the sky standing behind it. The sky low down is painted with the far air's own
// colour now, so that the two meet instead of one being cream against the other's blue. k is how far it leans
// (?hazeblue=, the dial the land already uses; 0 is the sky as it was).
vec3 pcSkyFar(vec3 h, float k) { return mix(h, vec3(0.48, 0.50, 0.63), clamp(k, 0.0, 1.0)); }

// ONE AIR FOR THE LAND AND THE SKY (2026-11-22, the owner: "i want things to look high quality and fully rendered
// even from 300 yards away"). The far land ended in one function and the sky's lowest band in another (pcSkyFar
// above), so the two were never the same colour. MEASURED at the horizon, away from the sun, largest of the three
// channels: the sky's lowest band stood 0.098 from the land's air at noon on Earth, 0.119 at dusk, 0.103 on Pluto at
// noon - and at dusk the difference was a HUE one, the land grey-lilac at (0.79, 0.73, 0.64) against a sky at
// (0.82, 0.71, 0.52). That is a seam along the horizon, which is the one line in the picture a far ridge is read
// against.
//
// THIS IS A COPY of pcOilHaze (render/chunks.js, in FRAG_PARS). It is copied, not shared, because FRAG_PARS is the
// painted materials' own string with their own uniform list and the sky is its own program; making one string of it
// is a change in two owners' files at once. THE TWO MUST BE CHANGED TOGETHER: if pcOilHaze's power, its cream or its
// blue-violet move, move them here too.
//
// The gold is the LAND'S, not the sky's own. chunks.js pcGold multiplies by uDayness * (1 - uMoon), and uMoon is
// (1 - dayness) * (1 - space01) (world/index.js), so on the ground the land's gold follows dayness SQUARED while the
// sky's own warm band further down follows dayness: in twilight the sky warms twice as hard as the land does. That
// band is the sky's and is left where it is; this is the air, and it follows the land exactly.
// (The one thing left out: the land reads its overcast from uWx.x, which is max(overcast, 1.5 * storm), and the sky
// is handed the overcast alone - so in a storm the land's air is a shade less gold than this. Little of the gold
// survives a storm on either side.)
float pcAirGold(float sunE) {
  float moon = (1.0 - uAtmo.y) * (1.0 - uAtmo.x);
  return (1.0 - smoothstep(0.48, 0.86, sunE)) * uAtmo.y * (1.0 - moon) * (1.0 - uWxSky.x) * uOilG.w;
}
vec3 pcSkyAir(vec3 h, float sunE, float sd, float lk) {
  // (L5: from the air, the gold toward the sun and the blue-violet away from it, as the land's far air: chunks.js
  // pcAtmosV. sd is dot(view, sun); lk how far it applies -- uLookN.w for the AIR the land ends in (the band under the
  // horizon and the lowest band laid last), 0 for the sky's own bands above it: laid through them it flattened the
  // painted sky from a mile up into one periwinkle (seen). On foot uLookN.w is 0 and this is the band as it was.)
  float side = smoothstep(-0.4, 0.7, sd);
  vec3 warm = mix(pow(h, vec3(uOilC.x)), vec3(0.95, 0.85, 0.63), 0.75 * pcAirGold(sunE) * mix(1.0, 0.45 + 0.55 * side, lk));
  return mix(warm, vec3(0.48, 0.50, 0.63), clamp(uOilS.x * mix(1.0, mix(1.5, 0.45, side) * 1.2, lk), 0.0, 1.0));
}

// NOTHING IN THE SKY IS PAPER WHITE any more, the sun's own disc and the light close round it apart. Measured on the
// owner's twenty oil paintings: their cloud and their valley mist is a NEUTRAL grey-white at 0.78, not white, and only
// a twentieth of all their paint is brighter than 0.85 - against half of ours in a view from the air, a quarter of it
// pure white, and the sky is the biggest block of that white because it fills the top of the frame. This rolls the top
// of the sky's range off and leaves everything below the knee exactly where it stood, so the blues, the bands and the
// cloud's own steps do not move: it is the shoulder post.js lays on the whole picture, laid here on the sky alone.
// Every channel is scaled by the same amount, so a colour keeps its hue and its strength and only its value comes down.
vec3 pcSkyCap(vec3 c, float k) {
  if (k >= 0.999) return c;
  float L = max(c.r, max(c.g, c.b));
  float knee = max(0.0, k - 0.14);
  if (L <= knee) return c;
  float sp = max(1e-4, k - knee);
  return c * ((knee + sp * (1.0 - exp(-(L - knee) / sp))) / L);
}
// THE AURORA AS LIGHT (the owner, 2026-11-16, of the aurora laid as a ribbon of hard-edged flames: "the northern lights
// look like stripes instead of lights like the reference"). The clip's aurora glows: a bright core along its foot, rays
// that are soft at their sides and die away upward into the dark, a little colour under the foot, and no drawn edge
// anywhere. So here it is LIGHT ADDED TO THE SKY, and it is soft: the one soft thing in the oil look's picture, by the
// owner's word (the crispness rule stands for everything else). Rays at three scales along the horizon, each with its
// own brightness and reach, run softly into their neighbours.
float pcAuH(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
vec2 pcAuRay(float ax, float sd0) {
  float i = floor(ax), f = ax - i;
  f = f * f * (3.0 - 2.0 * f);
  return mix(vec2(pcAuH(i + sd0), pcAuH(i + sd0 + 57.3)), vec2(pcAuH(i + 1.0 + sd0), pcAuH(i + 58.3 + sd0)), f);
}
// az: the bearing; e: the height in the sky; e0: the curtain's foot; hgt: how high its rays may reach; fold: how strong
// the curtain is along this bearing (0..1). Returns the light to add.
vec3 pcAuroraLight(float az, float e, float e0, float hgt, float fold, float wob) {
  float up = e - e0, fk = 0.30 + 0.70 * fold;
  vec2 r1 = pcAuRay(az * 26.0 + wob, 0.0), r2 = pcAuRay(az * 110.0 + wob * 3.0, 31.0), r3 = pcAuRay(az * 330.0, 77.0);
  float reach = hgt * (0.22 + 0.78 * r1.y * r1.y) * (0.50 + 0.50 * r2.y) * (0.30 + 0.70 * fold);
  float tt = up / max(reach, 1e-4);
  float ray = (0.35 + 0.65 * r2.x) * (0.70 + 0.30 * r3.x) * (0.45 + 0.55 * r1.x);
  float body = 1.0 - smoothstep(0.0, 1.0, tt);
  body *= body;
  float foot = smoothstep(-0.010, 0.002, up);
  float core = exp(-max(up, 0.0) / 0.012);
  float I = foot * (body * ray + 0.9 * core * (0.5 + 0.5 * r2.x)) * fk;
  vec3 col = mix(vec3(0.16, 1.0, 0.50), vec3(0.10, 0.78, 0.66), smoothstep(0.15, 0.70, tt));
  col = mix(col, vec3(0.36, 0.40, 1.0), smoothstep(0.55, 1.0, tt) * 0.85);
  col = mix(col, vec3(0.82, 1.0, 0.86), core * 0.8);
  vec3 L = col * I;
  L += vec3(0.85, 0.30, 0.80) * exp(-abs(up + 0.004) / 0.004) * 0.45 * (0.4 + 0.6 * r2.x) * fk;
  L += vec3(0.10, 0.55, 0.36) * exp(-max(up, 0.0) / (hgt * 0.9)) * smoothstep(-0.06, 0.0, up) * 0.22 * fk;
  return L;
}
#endif

void main() {
  vec3 d = normalize(vDirL);
  vec3 up = normalize(uCamL);
  float e = dot(d, up), eR = e;      // (eR: the true dot(view, up), for what is placed by geometry -- the cloud sea, the aurora's and the rain's directions)
  #ifdef PC_OIL
    // (THE AIR'S TOP, world/index.js AIRTOP: from the air the bands, the strokes and the low air band are laid from the
    // TRUE horizon, which stands uSkyAir.z below level (as dot(view, up); 0 on foot and over the wood, where nothing
    // changes). From a mile up on Earth it is 44 degrees down, and everything between it and level was one flat band
    // of haze. Mapped so the true horizon reads 0 and the zenith still 1.)
    if (uSkyAir.z < -1e-4) e = (e - uSkyAir.z) / (1.0 - uSkyAir.z);
  #endif
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
  #ifdef PC_OIL
    // (the oil look, the overhaul plan's sixth piece: the sky is laid in broad flat bands from the horizon to the zenith,
    // their edges wandering and a pixel wide; a wash's turbulence and its backruns, in opaque paint, were smudges and
    // rings in the sky: the stills of the open sky. Under a closed sky the heavy wash keeps its turbulence.)
    //
    // A SKY THAT IS NOT ONE COLOUR (the art pass against the owner's twenty oil paintings). The bands ran from the
    // world's zenith key straight to its horizon key, and on Earth that second key is all but white, so the whole
    // lower sky was one cream wash with nothing in it. Their skies do three things instead: they go DEEP overhead,
    // pale through the middle, and end in a COOL BAND low down - the same blue-violet the far land is lost into. So
    // the bands run through three keys now. Each world keeps its own colours: all three are made from its own two
    // keys, so Venus stays warm, Uranus stays mint, and the hour still sets them (the keys are blended per hour in
    // world/index.js, and a golden hour warms the band below).
    vec3 zenO = dens(uSkyZenith, 1.0 + 0.45 * uAtmo.y * (1.0 - oc));          // more pigment overhead, by day only: the night keys are laid light on purpose
    // (and ONE AIR: the lowest band ends in the same function the far land ends in, pcSkyAir above, so that at a
    // golden hour the land and the sky immediately over it warm together. ?skyair=0 is the band exactly as it was.
    // On its own this closes almost none of the seam - the sky's own density, warm band and ceiling are laid over
    // it afterwards - which is why the band at the very bottom is laid again, last of all, at the end of this
    // shader. This keeps the HUE of the two the same all the way up the lower sky.)
    vec3 airO = pcSkyAir(uHaze, sunE, sd, uLookN.w);        // what the far land ends in: chunks.js pcAtmos, on the same haze key
    vec3 bandO = mix(mix(pcSkyFar(uSkyHorizon, uOilS.x * 1.35), uSkyHorizon, 0.18), pcSkyAir(uSkyHorizon, sunE, sd, 0.0), uSkyAir.x);
    vec3 midO = mix(zenO, bandO, 0.62);
    float tb = t * 6.0 + (n1.r - 0.5) * 1.7 + (n2.g - 0.5) * 0.35;
    float tbi = floor(tb), fwb = max(fwidth(tb), 1e-4);
    float tq = clamp((tbi + smoothstep(0.5 - fwb, 0.5 + fwb, tb - tbi)) / 6.0, 0.0, 1.0);
    // the bands still step from one key to the next with an edge a pixel wide that wanders: the look's own sky, in
    // two stretches instead of one (the deep half of the sky, then the pale band)
    sky = tq < 0.58 ? mix(zenO, midO, tq / 0.58) : mix(midO, bandO, (tq - 0.58) / 0.42);
    sky = mix(sky, bandO, toward * 0.45);
    sky = dens(sky, 1.0 + turb * (1.0 - t * 0.7) * 1.7 * oc);
    // AND THE BRUSH'S OWN STROKES IN IT (the owner: the ice worlds' sky must be streaky and painted). Laid on the
    // bands and under everything else, so cloud, rings and the aurora still pass in front of them. Fading out close
    // to the horizon, where the air itself takes over, and gone under a closed sky, where there is cloud to look at.
    sky = pcSkyStrokes(sky, d, up, uSkyOil.w * (1.0 - oc) * smoothstep(-0.02, 0.10, e) * (1.0 - uAtmo.x), n2);
  #else
  sky = dens(sky, 1.0 + turb * (1.0 - t * 0.7) * (1.0 + oc * 0.7) + back * 0.38 * (1.0 - t));
  sky = mix(sky, vec3(1.0), smoothstep(0.90, 0.97, bf) * 0.22 * (1.0 - t));
  #endif
  // below the horizon (seen from high up): haze
  #ifdef PC_OIL
    // (the oil look: the far air's own colour, not the haze key straight. On Earth that key is all but white, and from
    // the air the white band under the horizon - wherever the land is too far off to be drawn - was a good part of
    // everything the measurement found over 0.85.)
    // (ONE AIR here too: the band below the horizon is the land's own air, gold and all, not the haze key leaned
    // blue. From 400 m up this band is everything between the lowest cloud and the land's own far edge.)
    sky = mix(sky, mix(pcSkyFar(uHaze, uOilS.x), airO, uSkyAir.x), 1.0 - smoothstep(-0.12, 0.02, e));
  #else
  sky = mix(sky, uHaze, 1.0 - smoothstep(-0.12, 0.02, e));
  #endif

  // ---- the rings, seen from the ground: a great pale arc across the sky, laid into the wash
  // before the clouds (so clouds drift in front of it), band beside band with the sky between,
  // lost in the haze toward the horizon; the planet's own shadow lies across its far side.
  // (The same plane, radii and bands as the ring's geometry in orbit.js, which takes over in space.)
  if (uRingS.z > 0.001 && abs(d.y) > 1e-5) {
    float tr = -uCamL.y / d.y;
    vec3 rp = uCamL + d * tr;
    float r01 = (length(rp.xz) - uRingS.x) / (uRingS.y - uRingS.x);
    float pb = dot(uCamL, d), pd = pb * pb - (dot(uCamL, uCamL) - uAtmo.w * uAtmo.w);
    bool hid = pd > 0.0 && (-pb - sqrt(pd)) > 0.0 && (-pb - sqrt(pd)) < tr;      // the planet in the way (from high up)
    if (tr > 0.0 && r01 > 0.0 && r01 < 1.0 && !hid) {
      vec4 ra = texture(uNoise3D, vec3(r01 * 2.3, 0.37, 0.11));
      vec4 rb = texture(uNoise3D, vec3(r01 * 9.1, 0.71, 0.53));
      vec2 pr = pcRingProfile(r01, ra, rb);
      float al = dot(rp, uSunDirL);
      float lit = al > 0.0 ? 1.0 : smoothstep(uAtmo.w * 0.95, uAtmo.w * 1.05, length(rp - uSunDirL * al));
      // the brush runs dry along the arc here and there (anchored to the ring, not to the eye)
      float dryb = texture(uNoise3D, vec3(rp.xz / uRingS.y * 2.6, r01 * 1.7)).g;
      float k = pr.x * uRingS.z * smoothstep(0.012, 0.13, e) * (1.0 - oc * 0.85) * (0.74 + 0.26 * smoothstep(0.30, 0.56, dryb));
      // by day: the pale rings are lifted out of the sky's wash to paper; the thin ones are a glaze of their own gold over it
      vec3 lifted = mix(vec3(1.0, 0.99, 0.95), uRingC, 0.10);
      vec3 glazed = dens(sky * mix(vec3(1.0), uRingC, 0.35), 1.05);
      vec3 ringD = mix(glazed, lifted, smoothstep(0.10, 0.62, pr.y));
      // by night the lit ring is the palest thing in the sky
      vec3 ringN = mix(uRingC, vec3(1.0, 0.985, 0.93), 0.25 + 0.6 * pr.y);
      vec3 ringc = mix(ringN, ringD, uAtmo.y);
      // in the planet's shadow: only a cool breath darker than the sky
      ringc = mix(dens(sky * vec3(0.86, 0.85, 0.93), 1.35), ringc, lit);
      sky = mix(sky, ringc, k * mix(0.94, 0.92, uAtmo.y));
      // pigment pools where the sky's wash stops against each lifted band: the arc's fine drawn edges
      sky = dens(sky, 1.0 + pr.x * (1.0 - pr.x) * 4.0 * 0.9 * uRingS.z * smoothstep(0.012, 0.13, e) * uAtmo.y * (1.0 - oc));
    }
  }

  // ---- the belts of a banded world, seen from inside it: the high cloud lies in broad bands
  // along the parallels, pale zone beside darker belt, their edges run wet into each other
  float rc0 = length(uCamL);
  if (uBelt.z > 0.001) {
    float bb = dot(uCamL, d), bd = bb * bb - (rc0 * rc0 - uCloud.x * uCloud.x);
    if (bd > 0.0 && rc0 < uCloud.x) {
      vec3 bp = normalize(uCamL + d * (-bb + sqrt(bd)));
      vec4 b1 = texture(uNoise3D, bp * 5.3 + vec3(uTime * 0.0003, 0.0, 0.0));
      vec4 b2 = texture(uNoise3D, bp * 19.0 + 0.4);
      float lat = asin(clamp(bp.y, -1.0, 1.0)) + ((b1.r - 0.5) + (b2.g - 0.5) * 0.4) * uBelt.y;
      float sv = sin(lat * uBelt.x * 3.14159 + 0.6), sv2 = sin(lat * uBelt.x * 3.14159 * 2.7 + 2.1);
      float belt = smoothstep(-0.22, 0.30, sv + 0.28 * sv2 + (b2.r - 0.5) * 0.35);
      vec3 zone = mix(sky, vec3(1.0, 0.985, 0.94), 0.50);
      vec3 beltc = dens(mix(sky, uCloudShade, 0.62), 1.30 + (b1.g - 0.5) * 0.9 + (b2.b - 0.5) * 0.4);
      sky = mix(sky, mix(zone, beltc, belt), uBelt.z * smoothstep(-0.02, 0.07, e) * (1.0 - oc) * (1.0 - uAtmo.x));
    }
  }

  // ---- an aurora (a biome that names it, PAINTER 12): curtains hung low over the horizon, their lower edge a wavy
  // pale line lifted out of the wash, rays running up from it and fading into violet; folded along the horizon
  // (anchored to the planet, drifting slowly). By day a pale ghost in the blue, by night the palest thing low down.
  if (uAurora.x > 0.001) {
    vec3 ha = normalize(d - up * eR + up * 1e-4);
    vec4 fa = texture(uNoise3D, ha * 1.25 + vec3(0.7, 0.2, uTime * 0.0015));
    vec4 fb = texture(uNoise3D, ha * 3.4 + vec3(0.1, uTime * 0.002, 0.4));
    float fold = smoothstep(0.38, 0.62, fa.r * 0.7 + fb.g * 0.3);                    // where along the horizon a curtain hangs
    float e0 = 0.16 + 0.12 * fa.g + 0.05 * (fb.r - 0.5);                             // its lower edge, wavy (9 to 19 degrees up)
    float ray = texture(uNoise3D, vec3(ha.xz * 16.0, ha.y * 16.0) + vec3(0.0, uTime * 0.004, 0.0)).g;
    ray = 0.40 + 0.60 * smoothstep(0.35, 0.70, ray);                                  // rays: streaks up the curtain
    float hgt = 0.22 + 0.25 * fb.b;
  #ifdef PC_OIL
    // (the oil look: the aurora is light added to the sky, see pcAuroraLight above. Laid before this, each seen in
    // stills and each wrong: broad strokes with square ends (a row of blocks), separate combs of hairlines (bar codes),
    // one ribbon of hard-edged flames (stripes, the owner's word).)
    float az = atan(ha.z, ha.x);
    e0 = 0.105 + 0.11 * fa.g + 0.04 * (fb.r - 0.5);              // (its foot lower in the oil look: six to thirteen degrees up, in a level view's upper half)
    float aStr = uAurora.x * (0.30 + 0.70 * (1.0 - uAtmo.y)) * (1.0 - oc) * (1.0 - uAtmo.x);
    vec3 aL = clamp(pcAuroraLight(az, e, e0, hgt * 2.3, fold, fa.b * 3.0) * aStr * 1.45, 0.0, 1.0);      // (taller and brighter than its first laying as light, whose rays were short and dim beside the clip's)
    sky = 1.0 - (1.0 - sky) * (1.0 - aL);
  #else
    float k = smoothstep(e0 - 0.012, e0 + 0.02, e) * (1.0 - smoothstep(e0 + 0.04, e0 + hgt, e)) * fold * ray;
    // (pale viridian at the lower edge lifted out of the blue, violet where the rays fade: it has to stand against the
    // middle of the sky, where the wash is deep; low down the sky is near paper and a pale curtain is lost in it)
    vec3 ac = mix(vec3(0.66, 0.93, 0.78), vec3(0.80, 0.68, 0.93), smoothstep(e0, e0 + hgt * 0.8, e));
    sky = mix(sky, ac, clamp(k * uAurora.x * (0.62 + 0.36 * (1.0 - uAtmo.y)) * (1.0 - oc) * (1.0 - uAtmo.x), 0.0, 0.85));
  #endif
  }

  // ---- a sea of cloud seen from one of its islands: beyond the island's rim the cloud tops
  // lie in rows out to their own horizon, and heads of cumulus stand up along it. (The sea
  // itself is the liquid's surface near by; this is its far reach, which no island's rim hides.)
  if (uSeaC.y > 0.001) {
    float rs = uAtmo.w + uSeaC.x;
    // where the top of the far cloud lies for this eye: below eye level (its own horizon) from above it,
    // above eye level from a bench lower than the cloud tops (the islands then stand in a bank of it)
    float et = rc0 > rs ? -sqrt(max(0.0, 1.0 - (rs * rs) / (rc0 * rc0))) : sin(atan((rs - rc0) / 450.0));
    vec3 hz2 = normalize(d - up * eR + up * 1e-4);
    vec4 h1 = texture(uNoise3D, hz2 * 2.2 + 0.31);
    vec4 h2 = texture(uNoise3D, hz2 * 7.0);
    float head = (0.016 + 0.085 * smoothstep(0.30, 0.78, h1.r) + 0.020 * h2.g) * uSeaC.z;       // heads of cumulus stand up along it
    float above = eR - et;
    float deck = 0.0, hollow = 0.0;
    if (above < head) {
      deck = 1.0 - smoothstep(head * 0.80, head, above);                              // a crisp upper edge
      float sb = dot(uCamL, d), sdisc = sb * sb - (rc0 * rc0 - rs * rs);
      if (rc0 > rs && sdisc > 0.0 && sb < 0.0) {
        // the deck itself, seen from above: rows of billows out to its horizon; the sea near by is the liquid's own surface
        float ts = -sb - sqrt(sdisc);
        vec3 sp = uCamL + d * ts;
        vec4 q1 = texture(uNoise3D, sp / 190.0 + vec3(uTime * 0.0006, 0.0, 0.0));
        vec4 q2 = texture(uNoise3D, sp / 53.0);
        deck *= smoothstep(160.0, 420.0, ts);
        hollow = 1.0 - smoothstep(0.30, 0.56, q1.r * 0.65 + q2.g * 0.35);
      } else {
        // the heads and the bank under them: lit tops, the sides and hollows in a soft glaze
        float under = clamp(1.0 - above / max(head, 1e-4), 0.0, 1.0);
        hollow = smoothstep(0.22, 0.85, under + (h2.r - 0.5) * 0.5) * (0.55 + 0.45 * h2.b) * (1.0 - 0.5 * (1.0 - smoothstep(-0.10, 0.0, above)));
      }
      vec3 deckc = mix(vec3(1.0, 0.995, 0.97), mix(uCloudShade, vec3(0.80, 0.76, 0.88), 0.35), hollow * 0.62);
      sky = mix(sky, deckc, deck * uSeaC.y * (1.0 - oc * 0.6) * (1.0 - uAtmo.x));
    }
  }

  // ---- clouds: bare paper with soft violet undersides, on a shell around the planet
  float rc = length(uCamL);
  float b = dot(uCamL, d);
  float disc = b * b - (rc * rc - uCloud.x * uCloud.x);
  float cloud = 0.0, shade = 0.0, body = 0.0, belly = 0.5;
  #ifdef PC_OIL
    float oilS1 = 0.0, oilS2 = 0.0;      // the cloud's half-tone and its belly in shadow: set here, painted further down
  #endif
  if (uCloud.y > 0.001 && disc > 0.0) {
    float tt = rc < uCloud.x ? (-b + sqrt(disc)) : (-b - sqrt(disc));
    if (tt > 0.0) {
      vec3 hp = uCamL + d * tt;
      vec3 q = hp / uCloud.z + vec3(uTime * uCloud.w, 0.0, uTime * uCloud.w * 0.6);
  #ifdef PC_OIL
      // CLOUD WITH FORM (the art pass against the owner's twenty oil paintings). Every one of their eight aerial
      // pictures has substantial cloud with real form: thick rounded masses, lit on top and shadowed underneath,
      // sitting in bands with real blue between them. Ours was two flat shapes cut out of one field of noise, so a
      // cloud read as a piece of paper with a step down one side and no body in it at all.
      //
      // FIRST, SMALLER MASSES, which is why there was nothing in the sky to shade in the first place. The feature size
      // the world hands in is 2.5 km on Earth, and the whole of the sky this shell shows from the ground - from
      // straight up to where the shell goes under the horizon - is only 1.9 km of it. So ONE cloud was wider than the
      // whole sky: whatever the hour, the sky overhead was all cloud or all clear, which is exactly the flat wash with
      // nothing in it. A fifth of that size puts about four masses across the sky, which is what their pictures hold.
      // The drift is scaled with it, so the clouds still cross the sky at the speed they did (1.5 m a second on Earth).
      // Every world comes out the same, because every one of them shows between 0.6 and 0.9 of a feature.
      // (the size goes with ?cloudform= as well, so that ?cloudform=0 is the cloud exactly as it was and a still of
      //  the two can be set side by side)
      //
      // Four things make the form, and together they cost ONE LOOK-UP FEWER into the noise than the flat cloud did,
      // because the finest of its three octaves is dropped: in flat paint that octave only roughened the outline, and
      // what the eye wants along a cloud's edge is curves, not wobble.
      //  - the mass is read twice, once as it stands and once a short way TOWARD THE LIGHT AND UPWARD, so a cloud is
      //    lighter where the sun comes from and lighter on its top, and deepest under its own belly. Always some way
      //    upward, because a painter's cloud is lit from above whatever the hour, and at dawn the sun is not above it.
      //  - its paint is laid in THREE steps, not one, and each step is a contour of the mass itself, so the steps nest
      //    inside one another the way a painter stacks light, half-tone and shadow on anything round.
      //  - the thin edges are let be light while the thick core keeps its shadow, which is what makes a cloud look lit
      //    through instead of cut out.
      //  - the edges are scalloped by LOBES of one size, worked out from the hit point with three sines and no look-up
      //    at all, and thrown out of step by the mass's own field so that they never read as a grid. They are let go
      //    wherever the shell is seen so nearly edge-on that a lobe would be smaller than a pixel, which is where
      //    grain and flicker come from.
      q *= mix(1.0, 5.0, uSkyOil.x);
      float c1 = texture(uNoise3D, q).r;
      float c2 = texture(uNoise3D, q * 2.7 + 0.31).g;
      float v = c1 * 0.82 + c2 * 0.18;
      float th = 1.0 - uCloud.y;
      vec3 ql = q + normalize(uSunDirL + normalize(hp) * 0.85) * 0.14;
      float vl = texture(uNoise3D, ql).r * 0.82 + texture(uNoise3D, ql * 2.7 + 0.31).g * 0.18;
      // CLOUD LANES: the masses gather in broad lanes with clear sky between them, as theirs do. The lanes are waves
      // in one plane across the whole world, so they belong to the planet and do not turn with the eye, and they
      // travel with the cloud. Two spacings, about 1.5 km and 600 m on Earth, so the sky has a broad band and a
      // finer one inside it. A banded world has its own belts in the sky already and takes no lanes, and a closed
      // sky is not broken into them either.
      // (They take as much cloud away as they give - about a third of the sky is left clear and the rest is thicker -
      // so every world still carries the share of cloud its look asks for.)
      float da = dot(q, normalize(vec3(0.83, 0.21, -0.52)));
      float lane = sin(da * 2.2 + (c1 - 0.5) * 1.3) * 0.62 + sin(da * 5.4 + (c2 - 0.5) * 2.0) * 0.38;
      float laneK = uSkyOil.x * (1.0 - uBelt.z) * (1.0 - oc);
      float thO = th + (0.5 - smoothstep(-0.45, 0.35, lane)) * 0.30 * laneK;
      // the lobes: rounded bumps about a hundred metres across, a fifth of a mass, their phase thrown out by the
      // mass's own field so they never read as a grid
      float la = q.x * 30.0 + c1 * 6.3, lb = q.y * 34.0 + c2 * 6.3, lc = q.z * 26.0 + c1 * 4.1;
      float lobe = sin(la) * sin(lb) * sin(lc);
      lobe *= (1.0 - smoothstep(0.80, 2.20, max(fwidth(la), max(fwidth(lb), fwidth(lc))))) * uSkyOil.x;
      thO -= lobe * 0.055;
      float fwv = max(fwidth(v), 1e-4);
      // the silhouette, with an edge a pixel wide, as everything else in this look has
      cloud = smoothstep(-fwv, fwv, v - (thO + 0.035)) * (rc < uCloud.x ? smoothstep(0.015, 0.20, e) : 1.0);
      float deep = clamp((v - thO - 0.035) / 0.16, 0.0, 1.0);          // how far into the mass this pixel lies (0 at its edge)
      float sh = clamp(0.5 - (v - vl) * 5.0 * uSkyOil.z, 0.0, 1.0) * (0.40 + 0.60 * deep);
      float fws = max(fwidth(sh), 1e-4);
      oilS1 = smoothstep(-fws, fws, sh - 0.30);
      oilS2 = smoothstep(-fws, fws, sh - 0.62);
      body = smoothstep(thO + 0.02, thO + 0.30, v);
      belly = smoothstep(thO + 0.06, thO + 0.50, v + (c2 - 0.5) * 0.25);
  #else
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
  #endif
    }
  }

  // (at night a cloud is a pale shape lifted out of the wash, not bare paper: paper is kept for the stars)
  vec3 cl = mix(mix(mix(uSkyHorizon, vec3(1.0), 0.22), vec3(1.0), uAtmo.y), uCloudShade, shade * 0.9);
  #ifndef PC_OIL
  cl = dens(cl, 1.0 + (n2.r - 0.5) * 0.8);
  #else
  // THE CLOUD'S THREE TONES. The owner's references measure their cloud and the mist in their valleys at a NEUTRAL
  // grey-white of 0.78 - not white - and the side away from the light goes well below it. So: a lit top of that
  // neutral with a breath of the world's own light in it, a half-tone, and a belly with real pigment in it leaning to
  // the sky's own blue, so the mass sits IN the sky instead of on top of it. All three are made from the world's
  // cloud-shadow key, which is set per world and per hour, so every world's cloud keeps its own colour and warms at
  // dusk along with everything else.
  vec3 cTop = mix(vec3(0.78, 0.78, 0.785), uSkyHorizon, 0.18);
  // (both of the deeper tones are pulled a little way toward their own grey. The art pass found the game's darks LURID
  //  where the references' are neutral - a trunk's deepest pixels at saturation 0.93 against their 0.33, which is
  //  most of why theirs read as oil paint and ours as poster paint - and a cloud shadow made by pigment alone came out
  //  at up to 0.71 on the warm worlds. Reckoned over every world with cloud at day, dawn and dusk, the half-tone now
  //  sits at saturation 0.32 and the belly at 0.29, against the references' 0.33.)
  vec3 cHalf = dens(uCloudShade, 1.85);
  cHalf = mix(cHalf, vec3(dot(cHalf, vec3(0.3, 0.5, 0.2))), 0.12);
  // (the belly takes a third of the sky's own middle colour before the pigment goes in, which is how a painter keeps
  //  the shadow of a cloud inside the sky and not a hole in it)
  vec3 cBase = mix(uCloudShade, midO, 0.35);
  vec3 cDeep = mix(dens(cBase, 2.05), vec3(dot(cBase, vec3(0.3, 0.5, 0.2)) * 0.56), 0.24);
  // (the oil look by night: a cloud is a flat shape one step lighter than the sky it lies in, with no lit side at all)
  cl = mix(mix(sky, uSkyHorizon, 0.22), mix(mix(cTop, cHalf, oilS1), cDeep, oilS2), uAtmo.y);      // (barely: small pale shapes in a dark sky were stray marks)
  #endif
  // under an overcast the cloud is no longer bare paper: it is the wash itself, in heavy masses
  // with dark bellies; their torn edges stay pale, where the light still comes through
  // (PAINTER 16/17, the M4 critique: under Earth's thunderstorm the closed sky was the darkest thing in the picture, its
  // darkest hundredth at L* 8, the crowns paler cut-outs against it. The sky is the light of a rain picture: the masses
  // are laid a little thinner and their bellies less deep, so that the sky's darks stay above the wood's)
  vec3 mass = dens(mix(uStormWash, vec3(1.0), 0.12), 0.10 + 1.05 * belly + 0.22 * uWxSky.y + (n2.r - 0.5) * 0.4);
  cl = mix(cl, mass, oc * (0.30 + 0.70 * body));
  vec3 col = mix(sky, cl, cloud);

  // rain or snow falling from the cloud base, far off: soft slanted drags of the wet wash,
  // strongest low in the sky (anchored to the planet: they do not turn with the camera)
  float veil = max(uWxSky.z, uWxSky.w);
  if (veil > 0.01) {
    vec3 hz = normalize(d - up * eR + up * 1e-4);
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
  #ifdef PC_OIL
    // (the oil look: space is laid in flat shapes with clean edges, a pixel wide: a deep indigo ground, a lighter blue
    // drift over part of it, a violet one, and a few pale clouds of stars' dust; no wet edge, no bloom, no salt: as
    // washes they were the one soft, blotted thing left in the picture: the survey of the worlds, the Moon's sky)
    float d1 = s1.r * 0.7 + s2.g * 0.3, d2 = s1.g * 0.7 + s2.r * 0.3, d3 = s1.b * 0.65 + s2.b * 0.35;
    float w1 = max(fwidth(d1), 1e-4), w2 = max(fwidth(d2), 1e-4), w3 = max(fwidth(d3), 1e-4);
    vec3 sp = vec3(0.070, 0.085, 0.240);
    sp = mix(sp, vec3(0.110, 0.140, 0.340), smoothstep(-w1, w1, d1 - 0.50));
    sp = mix(sp, vec3(0.150, 0.190, 0.420), smoothstep(-w1, w1, d1 - 0.62));
    sp = mix(sp, vec3(0.230, 0.150, 0.400), smoothstep(-w2, w2, d2 - 0.60));
    sp = mix(sp, vec3(0.330, 0.240, 0.520), smoothstep(-w2, w2, d2 - 0.70));
    sp = mix(sp, vec3(0.360, 0.420, 0.660), smoothstep(-w3, w3, d3 - 0.70));
  #else
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
  #endif
    float sunS = 1.0 - smoothstep(uAtmo.z * 0.82, uAtmo.z, ang);
    sp = mix(sp, vec3(1.0, 0.985, 0.93), clamp(halo, 0.0, 1.0));
    sp = mix(sp, vec3(1.0), sunS);
    // (PILOT's M4 critique, item 10: below the edge of the air the blue sky and the indigo of space were mixed half and
    // half over the whole sky into one flat grey-violet, with stars already on it: two good washes mixed in the middle
    // are mud. As the air thins the day's sky runs out toward bare paper, and space is a second wash that comes down
    // from the zenith with a wet, wandering edge and a pale bloom where it stops: above the edge indigo and its stars,
    // below it the thin pale sky down to the world's rim. No star lies where its ground is not yet indigo.)
    float spA = uAtmo.x;
  #ifdef PC_OIL
    // (the oil look: AS THE AIR THINS THE SKY DOES NOT RUN OUT TO BARE PAPER. Paper is the watercolour's way of saying
    // "thin air", and in opaque paint it bleached the whole upper half of every view from the air to white: this one
    // line is a large part of why half that picture measured brighter than 0.85 where a twentieth of the owner's
    // aerial paintings is. Thinning air DEEPENS here, toward the indigo of space, as theirs do; the pale band low
    // down is left alone, so the horizon still reads as far-off air and not as a wall.)
    float deepen = smoothstep(0.0, 0.8, spA) * 0.75 * uAtmo.y * (1.0 - clamp(halo, 0.0, 1.0)) * smoothstep(-0.05, 0.45, e);
    vec3 thin = mix(col, vec3(0.16, 0.19, 0.42), deepen);
  #else
    vec3 thin = mix(col, vec3(0.985, 0.98, 0.965), smoothstep(0.0, 0.8, spA) * 0.80 * uAtmo.y * (1.0 - clamp(halo, 0.0, 1.0)));
  #endif
    float spWob = (s1.r - 0.5) * 0.34 + (s2.g - 0.5) * 0.14;
    float spEdge = mix(1.30, -0.60, smoothstep(0.04, 1.0, spA));
    float inSp = spA >= 0.999 ? 1.0 : smoothstep(spEdge - 0.06, spEdge + 0.20, e + spWob);
    float spBloom = (1.0 - smoothstep(0.0, 0.22, abs(e + spWob - spEdge + 0.06))) * (1.0 - inSp) * spA;
  #ifdef PC_OIL
    col = mix(thin, sp, inSp);      // (the oil look lays no pale bloom where space's wash stops: nothing in opaque paint blots)
  #else
    col = mix(mix(thin, vec3(1.0), spBloom * 0.30), sp, inSp);
  #endif
    // stars: in space everywhere but in the sun's glare; from the ground at night, above the
    // horizon haze and where no cloud lies
    float night = (1.0 - uAtmo.y) * (1.0 - cloud) * (1.0 - oc) * smoothstep(0.03, 0.30, e);
    starOK = mix(night, 1.0, inSp) * (1.0 - clamp(halo * 1.6, 0.0, 1.0));
  }

  #ifdef PC_OIL
    // (the oil look: the sky's washes a little richer, and toward a sun in the air a warm glow. It was laid as "a sky
    // nearly white with light", after the clip; the owner's twenty paintings say otherwise, and the measurement says
    // so too, so the glow is warm now and not white. In space the sky is as it was.)
    col = dens(clamp(col, 0.0, 1.0), mix(1.0, uOilA.y, 0.3));
    // (the glow round a sun seen through the air, and the golden hours below: both were laid in paint at full white,
    // so the sky anywhere near the sun went to paper. They keep all of their warmth and lose the white - their
    // colours sit where the owner's references put their brightest sky - and the warm band is still strongest low
    // down, which is where theirs is.)
    col = mix(col, vec3(0.93, 0.87, 0.72), pow(max(sd, 0.0), 3.0) * 0.60 * uAtmo.y * (1.0 - uAtmo.x) * (1.0 - uWxSky.x));
    // (the golden hours, as chunks.js pcGold: the whole sky warms, most of all low down, where it meets the air's pale gold)
    float gold = (1.0 - smoothstep(0.48, 0.86, sunE)) * uAtmo.y * (1.0 - uAtmo.x) * (1.0 - uWxSky.x) * uOilG.w;
    if (uLookG.x < 0.5) {
      col = mix(col, vec3(0.92, 0.80, 0.58), gold * mix(0.80, 0.45, smoothstep(0.0, 0.7, e)));
    } else {
      // THE GOLDEN HOUR'S SKY, PAINTED (24 Nov; the coordinator: from the air and from the ground at 16.8 the sky was one
      // flat ochre wash). The wash above laid the same gold all round the sky, 0.80 of it low down and 0.45 high, so
      // every direction came out the same ochre and the bands and strokes under it were lost. A painter's golden hour
      // keeps the gold where the light is: warm and strongest low toward the sun, cooling round the sky and deepening
      // overhead and away from it, where the zenith key's blue shows and the low sky goes a cool lilac. Laid in four
      // steps round the sky (by the angle to the sun, its edges a pixel wide and wandering with the sky's own noise)
      // and on the sky's own height bands (tq), so it is painted, not a glow. ?goldsky=0 is the wash as it was.
      // (rings round the sun, five steps by the angle to it, their edges a pixel wide and wandering with the sky's noise:
      // pale gold close to the sun, gold, a warm peach, a cool lilac, and away from the sun the sky's own blue a step
      // deeper. Each ring is laid as a glaze that keeps the value of what is under it -- the sky's height bands, the
      // clouds -- so the steps and shapes under it still read; strongest low in the sky, lighter overhead.)
      float gT = smoothstep(-0.55, 0.97, sd) * 5.0 + (n1.g - 0.5) * 0.9 + (n2.r - 0.5) * 0.35;
      float gTi = clamp(floor(gT), 0.0, 4.0), fwg = max(fwidth(gT), 1e-4);
      float ring = clamp(gTi + smoothstep(0.5 - fwg, 0.5 + fwg, gT - gTi), 0.0, 5.0);      // 0 away from the sun .. 5 by it
      float low = tq;                                                                      // 0 overhead .. 1 at the horizon band
      float cl = dot(col, vec3(0.3, 0.5, 0.2));
      vec3 rc = ring < 1.5 ? mix(vec3(0.62, 0.68, 0.90), vec3(0.76, 0.70, 0.86), ring - 0.5)
              : ring < 2.5 ? mix(vec3(0.76, 0.70, 0.86), vec3(0.90, 0.72, 0.64), ring - 1.5)
              : ring < 3.5 ? mix(vec3(0.90, 0.72, 0.64), vec3(0.93, 0.77, 0.52), ring - 2.5)
              : mix(vec3(0.93, 0.77, 0.52), vec3(0.96, 0.88, 0.66), clamp(ring - 3.5, 0.0, 1.0));
      vec3 rv = mix(rc, clamp(rc * (cl / max(dot(rc, vec3(0.3, 0.5, 0.2)), 1e-3)), 0.0, 1.0), 0.55);   // (the ring keeping the value under it)
      float amt = gold * mix(0.30, 0.88, low) * mix(0.75, 1.0, ring / 5.0);
      col = ring < 0.5 ? mix(col, dens(col, 1.30) * vec3(0.86, 0.95, 1.14), gold * mix(0.55, 0.30, low))      // (away: the blue deeper)
                       : mix(col, rv, amt);
    }
    {
      // THE NIGHT SKY'S STREAKS (the owner, 2026-11-16: "make the lines on the sky at night time near the northern lights
      // closer to the ... references ... the patterns in the sky"). The clip's night sky, looked at closely: LONG, THIN,
      // NEARLY STRAIGHT streaks of pale cyan on the dark, lying almost level, some rising a little to one side and some
      // falling, so that they cross one another at shallow angles; of every length, from a short touch to a third of
      // the picture; each drawn to a point at both ends; thicker and brighter here, a hair there. So: four families of
      // streaks, each a set of level lines about an axis of its own that leans a little from straight up (a family's
      // lines lie level on one side of the sky and lean one way or the other elsewhere, and two families cross at a
      // shallow angle); along a line, streaks of the line's own length with gaps between; bent only very gently by a
      // slow noise. (Laid before this: short dashes in rows bent by a quick noise: curls and worms, not the clip's.)
      vec3 ta = normalize(cross(up, vec3(0.31, 0.74, 0.59))), tb = cross(up, ta);
      vec4 wv4 = texture(uNoise3D, d * 0.7 + 0.37);
      float nightK = (1.0 - uAtmo.y) * (1.0 - uAtmo.x) * smoothstep(0.02, 0.10, e);
      if (nightK > 0.004) {
        for (int L = 0; L < 4; L++) {
          float fl = float(L);
          vec2 lean = L == 0 ? vec2(0.16, 0.05) : L == 1 ? vec2(-0.11, 0.19) : L == 2 ? vec2(0.04, -0.27) : vec2(-0.30, -0.10);
          vec3 ax = normalize(up + ta * lean.x + tb * lean.y);
          vec3 a1 = normalize(ta - ax * dot(ta, ax)), a2 = cross(ax, a1);
          float fq = L == 0 ? 64.0 : L == 1 ? 47.0 : L == 2 ? 83.0 : 38.0;
          float rowf = dot(d, ax) * fq + 1.6 * (L < 2 ? wv4.r : wv4.b) + fl * 0.37;
          float row = floor(rowf), hx = fract(sin((row + fl * 71.0) * 91.7) * 43758.5453), hy = fract(sin((row + fl * 13.0) * 37.3) * 24634.63);
          // (a line's streaks: from one in a sixth of the sky round to a dozen, the longest on few lines)
          float along = atan(dot(d, a2), dot(d, a1)) * (1.0 + 11.0 * hx * hx) + hy * 40.0;
          float seg = floor(along), ft = along - seg;
          float hs = fract(sin((seg + row * 57.0 + fl * 19.0) * 12.9898) * 43758.5453), hl = fract(hs * 7.31 + hx);
          float a0 = 0.04 + 0.20 * hl, a1e = a0 + 0.30 + 0.62 * hs * (1.0 - a0 - 0.30);
          float sp = (ft - a0) / max(a1e - a0, 1e-3);
          // (drawn to a point at both ends; one to three pixels thick, whatever the lens)
          float taper = smoothstep(0.0, 0.30, sp) * smoothstep(0.0, 0.30, 1.0 - sp);
          float fwr = max(fwidth(rowf), 1e-4);
          float wid = (0.45 + 0.75 * hl * hl) * fwr * taper;
          float cov = smoothstep(-0.5 * fwr, 0.5 * fwr, wid - abs(rowf - row - 0.5)) * step(0.0, sp) * step(sp, 1.0) * step(0.42, fract(hs * 3.7 + hy));
          col = mix(col, mix(col, vec3(0.40, 0.80, 0.78), 0.30 + 0.55 * hl), cov * nightK * (0.45 + 0.55 * hs));
        }
      }
    }
    // THE CEILING, laid last of all (pcSkyCap above): the sun's own disc and the light close round it are left where
    // they are, because the references keep their small bright sun too, and so is space, which is dark already.
    col = mix(col, pcSkyCap(col, uSkyOil.y), (1.0 - clamp(halo * 1.2, 0.0, 1.0)) * (1.0 - sun) * (1.0 - uAtmo.x));
    // AND THE LOWEST BAND OF ALL IS THE LAND'S OWN AIR, laid after everything else (pcSkyAir above). Three things
    // in this shader belong to the sky alone and are laid over its bands: the extra density (uOilA.y, a third of the
    // way), the golden-hour warm band, and the ceiling just above. The land's air gets none of the three, so they
    // are exactly what held the two apart. MEASURED at the horizon on Earth, away from the sun, largest channel:
    // giving the band the land's own function (above) moves the seam 0.098 -> 0.095 at noon and 0.119 -> 0.109 at
    // dusk, and on Pluto at a low sun it OPENS it, 0.061 -> 0.100. Laid here, after all three, the lowest band IS
    // the air and there is no seam left to measure.
    // Stepped, not graded: two flat steps with an edge a pixel wide, wandering with the same noise the bands above
    // wander with, because a four-degree gradient along the bottom of the sky is a glow, and this look has none.
    // Left alone: the sun's own disc and the light close round it (as the ceiling leaves them); the sky toward the
    // sun, where the land's air and the sky each have a warm glow of their own and the sky's is the better one (the
    // land's is built from uLight, which the sky is not handed); falling rain and snow, which whiten the low sky
    // themselves; and space.
    // The far land keeps a quarter of its own paint now (the ceiling in chunks.js pcFogAmount), so it does NOT come
    // all the way to this colour - and that is the point of the pair: one air, with a far ridge standing a quarter
    // of a shade against it, which is the join the eye reads a distance by.
    if (uSkyAir.x > 0.004) {
      float ab = clamp((uSkyAir.y - e) / max(uSkyAir.y, 1e-3), 0.0, 1.0) * 2.0 + (n1.r - 0.5) * 0.6;
      float abi = floor(ab), fwa = max(fwidth(ab), 1e-4);
      float aq = clamp((abi + smoothstep(0.5 - fwa, 0.5 + fwa, ab - abi)) * 0.5, 0.0, 1.0);
      float ak = aq * uSkyAir.x * (1.0 - uAtmo.x) * (1.0 - veil) * (1.0 - pow(max(sd, 0.0), 3.0))
        * (1.0 - clamp(halo * 1.2, 0.0, 1.0)) * (1.0 - sun);
      col = mix(col, airO, ak);
    }
  #endif
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), mix(1.0, 0.45, uAtmo.x));
  pcAux = uAux8 > 0.5 ? vec4(starOK, 0.0, 20.0 / 32.0, 0.0) : vec4(starOK, 0.0, 20.0, 0.0);     // (x: where stars may lie; the sky has no normal to store)
}
`;

export function makeSkyUniforms() {
  ensureGlobals();
  return {
    uNoise3D: G.uNoise3D, uStrokeTex: G.uStrokeTex, uTime: G.uTime, uAux8: G.uAux8,
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
    uRingS: { value: new THREE.Vector4(1, 2, 0, 0) },
    uRingC: { value: new THREE.Vector3(0.93, 0.86, 0.66) },
    uBelt: { value: new THREE.Vector4(9, 0.02, 0, 0) },
    uAurora: { value: new THREE.Vector4(0, 0, 0, 0) },
    uSeaC: { value: new THREE.Vector4(80, 0, 1, 0) },
    uProjScale: { value: new THREE.Vector2(1, 1) },
    uCamRot: { value: new THREE.Matrix3() },
    uBodyInv: { value: new THREE.Matrix3() },
    // the oil sky's dials (see the top of this file). The watercolour's shader never declares this one: the
    // preprocessor drops the line with everything else inside #ifdef PC_OIL, so it is handed to nothing.
    // (w: how strongly the sky is laid in brush strokes -- the world's own `skyStrokes`, set per body in
    //  world/index.js; `?skystroke=` turns it anywhere, which is how it was looked at)
    uSkyOil: { value: new THREE.Vector4(_qn('cloudform', 1), _qn('skycap', 0.86), _qn('cloudlit', 1), 0) },
    // ONE AIR FOR THE LAND AND THE SKY (see pcSkyAir in the shader above). x: how far the sky's lowest band is the
    // same air the far land ends in (?skyair=; 0 is the sky exactly as it was, which is the other half of the pair
    // to show the owner). y: how high that band stands, as dot(view, up) -- 0.075 is about four degrees over the
    // horizon, which is a painter's band low down and not a wall of one colour (?skyairtop=). z: where the TRUE
    // horizon stands from the air, as dot(view, up), set each frame by world/index.js (AIRTOP); 0 on the ground.
    uSkyAir: { value: new THREE.Vector4(_qn('skyair', 1), _qn('skyairtop', 0.075), 0, 0) },
    ...OIL,
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
uniform float uAux8;
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
  if (aux.w * (uAux8 > 0.5 ? 8.0 : 1.0) > 0.5) discard;                                      // only the sky takes this glaze
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
    float dvv = dot(d, v), duu = dot(d, u);
    float phi = atan(dvv, abs(duu) + abs(dvv) > 0.0 ? duu : 1.0) / 6.2831853 + 0.5;     // 0..1 round the way ahead
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
    uNoise3D: G.uNoise3D, uSceneAux: G.uSceneAux, uSceneRes: G.uSceneRes, uAux8: G.uAux8,
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
  register(mat, 'sky');
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
