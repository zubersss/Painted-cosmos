// Painted Cosmos: THE 3D CLOUDS. OWNER: PAINTER (group D, lane W1 CLOUDS). docs/lead/WEATHER-DESIGN.md 4.2 A2 (A3, A5
// and A6 follow in this file).
//
// The sky's clouds were one flat layer painted on the dome behind everything, at 440 m above the datum on Earth, inside
// the oil look's mountains, and gone to space above 920 m. These are real clouds over the land: each one a cluster of
// rounded LOBES (low-poly balls a little lumpy with noise), stacked as a painter builds a cumulus -- a flat base, a
// domed middle, smaller lobes heaped on top, columns for a tower -- at the heights the weather group's cloud map gives,
// drifting with the wind aloft, born, growing and dying on their own clocks.
//
// PAINTED, NOT RENDERED. A lobe is not lit as a ball: its normal is bent toward the direction from its CLOUD's centre,
// so a whole cloud is lit as one rounded mass and its lobes read as bumps on it. The light is then laid in FOUR FLAT
// TONES as the look director set them (24 Nov): the lit top in the light's own colour, warm at the golden hours; the
// half-tone the sky's own blue-grey a step under it; the belly a further step down in the zenith key's hue; a deep tone
// only inside a storm (slate and indigo from the world's heavy-weather pigment, the lit flank keeping the light). All of
// it from the world's own keys, so every world and every hour keeps its palette; no line round anything. The tone is chosen once per STROKE (the look's own thin strokes, chunks.js pcThinLayer, laid on each lobe's
// own sphere and held at about 6 to 13 pixels on the screen), from the light at the stroke's centre, so the borders
// between tones are broken along the strokes' edges: crisp, no gradient, no outline.
//
// WHERE THEY ARE. Slots on a lattice of the whole world about 220 m apart, in a frame that turns with the wind aloft
// (the group's quaternion: the whole field drifts as one, with the wind the weather group's wind map gives at the eye).
// Each slot hosts a cloud in each of its generations if its own number is under the cover the cloud map gives where
// it now is (with the world's own fair-weather share under it: data/looks/<world>.js `weather.fair`, or 0.8 of its
// `cloud`), so a cloud drifting over clear air shrinks away and one drifting over a building sky grows. Its base and
// its thickness are the map's (`fields.cloud.base`, `.top`: the land smoothed over 1.2 km plus the weather's own form),
// so the alpine peaks wear caps and a storm's cell carries towers. With no map (the weather group's ?cloudmap=1 off)
// the cover is the sky's own number and the base the land under the slot plus the world's `weather.base`.
//
// HOW MUCH IT COSTS (derived; the speed-test rows measure it). Lobes are tessellated by their size on the screen
// (four levels, 80 to 5,120 triangles, an edge about ten pixels long), so on the phone's small picture most are the
// cheapest. One instanced draw per level, opaque, depth-written, no discard, clouds sorted nearest first, drawn after
// the ground and before the sky so what the land hides is never shaded and the sky behind a cloud is skipped.
//
// SWITCHES (oil look only; the hook in world/index.js fetches this module only where ?clouds3d= asks):
//   ?clouds3d=1   the cumulus;  2 (later) the towers' anvils and shelf
//   ?cloudlobes=  the lobes' bend toward the cloud's centre (0 balls .. 1 one mass; 0.85)
//   ?cloudslot=   the lattice's spacing in metres (380)
//   ?cloudfair=   the fair-weather share where the map says nothing (default: the world's own)
//   ?cloudsize=   a multiple of the clouds' size (1)
//   ?deck=0       no deck (A3);  ?valleycloud=0 no valley cloud (A5; 1.6 forces a cover of 0.6, for looking before the map
//                 carries its valley channel)
import * as THREE from 'three';
import { G, OIL, LOOK, QUALITY, register, ensureGlobals } from '../render/shared.js';
import * as SHARED from '../render/shared.js';
import { WX } from './wxfield.js';
import { makePaintUniforms, defaultBodyUniforms } from '../render/materials.js';
import { VERT_PARS, VERT_END, FRAG_PARS } from '../render/chunks.js';
import { BODIES } from '../data/bodies.js';
import { getLook } from '../data/looks.js';
import { sampleSurfacePure } from './surface.js';
import { faceToDir, dirToFace } from '../physics/windmap.js';

const _qs = (() => { try { return new URLSearchParams(location.search); } catch (e) { return null; } })();
const _qn = (k, d) => (_qs && _qs.has(k) && _qs.get(k) !== '' && isFinite(+_qs.get(k)) ? +_qs.get(k) : d);
const _gf = (v) => { const s = (+v).toFixed(4); return s; };

export const CLOUDS = {
  mode: Math.max(0, _qn('clouds3d', 1)),
  // (0.85 shaded a whole cumulus as one smooth lump: from the air at 1 km every cloud was a single flat tone; at 0.62 each
  // lobe keeps its own lit and turned-away side, the cauliflower's heads, while the whole still faces the light)
  lobeBend: Math.max(0, Math.min(1, _qn('cloudlobes', 0.62))),
  slot: Math.max(80, _qn('cloudslot', 380)),
  fair: _qs && _qs.has('cloudfair') ? Math.max(0, Math.min(1, _qn('cloudfair', 0.35))) : null,
  size: Math.max(0.2, _qn('cloudsize', 1)),
  deck: _qn('deck', 1) > 0,                      // ?deck=0: no deck (A3)
  valley: _qn('valleycloud', 1),
  skyfix: _qn('skyfix', 1) > 0,
  // THE HYBRID (the coordinator, 24 Nov): from the ground today's painted sky is the cover, and the 3D cumulus come in with
  // height, between airH[0] and airH[1] metres over the land under the eye (the owner's mile, the sea of cloud); storms and
  // clouds caught on mountains are drawn from anywhere. ?cloudhybrid=0: the 3D cumulus from the ground as well.
  hybrid: _qn('cloudhybrid', 1) > 0,
  airH: [250, 700],
  // (A4 the high cloud: OFF by default, ?cirrus=1 on. Seen in rework 2 from the ground and from 1 km, the strokes read as pale
  // ghost shapes with tails over the painted sky, not as mare's tails)
  cirrus: _qn('cirrus', 0) > 0,
  skyStrokes: _qn('skystrokes', 0) > 0,
  // (the coordinator, 24 Nov: from the ground in the hybrid, the 3D cumulus field the air would show is still laid into the
  // shadow map, unseen, so the clouds' shadows sweep the land, and they are the very clouds the player rises into.
  // ?cloudshadow=0: none; the speed test's row 'weather: no unseen cloud shadow field (fair)' sets world.clouds.shadowField)
  shadowField: _qn('cloudshadow', 1) > 0,                  // ?skyfix=0: the look director's audit items in sky.js left as they were                 // ?valleycloud=0: none; a number over 1 forces that much cover (0..1 as v - 1), for looking (A5)
  rebuild: 0.5,           // s between rebuilds of the instances (the drift itself is the group's turn, every frame; a lobe grows over tens of seconds, so twice a second is smooth)
  maxLobes: 6144,         // instances a level of detail holds at most
  sagPx: 2.2,             // how far a lobe's outline may stand off the true round, in pixels, before the next level is taken (its noise hides that much)
  // (the phone's budget, WEATHER-DESIGN 4.5 about 120k: at quality levels under 2 (the phone), once the nearest clouds have
  // spent this many triangles the rest take the coarsest lobe. A far cloud keeps all its lobes: cut to three, the far
  // heads went at the golden hour from 1 km (seen). MEASURED before it: a building sky from the air was 159k-190k at the
  // phone's pixel angle. ?cloudtris=)
  budget: Math.max(20000, _qn('cloudtris', 95000)),
  life: [150, 360],       // s: a cumulus' life (the painter's clock)
};

// ---- the lobe: an icosphere, indexed (each vertex shaded once), four levels -------------------------------------------
function icosphere(detail) {
  const t = (1 + Math.sqrt(5)) / 2;
  let v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
  let f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  v = v.map((p) => { const l = Math.hypot(...p); return p.map((x) => x / l); });
  for (let d = 0; d < detail; d++) {
    const mid = new Map(), nf = [];
    const m = (a, b) => {
      const k = a < b ? a * 65536 + b : b * 65536 + a;
      if (mid.has(k)) return mid.get(k);
      const p = [v[a][0] + v[b][0], v[a][1] + v[b][1], v[a][2] + v[b][2]], l = Math.hypot(...p);
      v.push(p.map((x) => x / l)); mid.set(k, v.length - 1); return v.length - 1;
    };
    for (const [a, b, c] of f) { const ab = m(a, b), bc = m(b, c), ca = m(c, a); nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
    f = nf;
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v.flat(), 3));
  g.setIndex(f.flat());
  return g;
}
// the four levels, and how far an edge's middle stands inside the true round, for a ball one pixel in radius (an
// icosahedron's edge spans 63.4 degrees, halved each level: the sagitta is 1 - cos(half of that)). The outline is what
// would read as a polygon; the inside is painted with the cloud's own normals and strokes, so its facets never show.
// (the fourth level, 5,120 triangles a lobe, is never taken: a storm's tower overhead took 1.2 million triangles with
// it, and at three the outline of the nearest, largest lobes stands a few pixels inside the round, which the noise on
// a lobe hides)
const LODS = [1, 2, 3].map((d) => ({ detail: d, sag: 1 - Math.cos(1.1071 / (1 << (d - 1)) / 2) }));

// ---- the shaders ------------------------------------------------------------------------------------------------------
const CLOUD_VERT = /* glsl */`
${VERT_PARS}
uniform highp sampler3D uNoise3D;
uniform vec3 uCamD;        // the eye, in the mesh's own frame (the drifting field's, less its anchor)
uniform vec3 uAnchorD;     // the mesh's origin from the planet's centre, same frame
uniform vec3 uCloudSun;    // toward the TRUE sun, same frame (the land's light swaps to the moon at night; a cloud top keeps the sun)
uniform float uCloudBend;  // how far a lobe's normal bends toward its cloud's centre
uniform float uGroundR;    // the planet's radius with its land (m): what throws the planet's shadow on a cloud
attribute vec4 iA;         // lobe centre (xyz, m), lobe radius (m)
attribute vec4 iB;         // cloud centre (xyz, m), how far its base plane lies below that centre (m)
attribute vec4 iC;         // the lobe's stroke pole (unit), its own number
attribute vec4 iD;         // x the squash along up, y the cloud's thickness (m), z storm 0..1, w the cloud's air 0..1
varying vec3 vRel;
varying vec3 vView;
varying vec3 vNP;          // the painted normal (lobe and cloud blended), the mesh's frame
varying vec3 vQ;           // the lobe's own direction in its stroke frame (pole on z)
varying vec4 vK;           // x lobe radius, y height in the cloud 0..1, z storm, w the lobe's number
varying vec3 vUp;
varying vec2 vAirSun;      // x the cloud's air, y how much of the sun reaches this point (the planet's shadow)
varying vec3 vNV;          // the painted normal in view space (for the scene's second target)
varying float vAxis;       // how far from the cloud's own upright axis, in units of its thickness (the core of its base is 0)
varying vec3 vPosA;        // the place from the planet's centre, drifting frame (for the lightning's light: no derivative of it)
varying vec3 vNL;          // the lobe's OWN normal, not bent: each head's own turned-away side
varying float vCrease;     // how far the lobe's own surface faces into its cloud (a crease between heads where it shows)
void main() {
  vec3 dir = normalize(position);
  vec3 up = normalize(uAnchorD + iB.xyz);
  // a lobe is never a perfect ball: two slow octaves of the world's noise swell and dent it
  float n1 = texture(uNoise3D, dir * 0.55 + iC.w * 7.13).r;
  float n2 = texture(uNoise3D, dir * 1.30 + iC.w * 3.71).g;
  float rr = iA.w * (0.86 + 0.30 * n1 + 0.10 * n2);
  vec3 off = dir * rr;
  off -= up * dot(off, up) * (1.0 - iD.x);
  vec3 p = iA.xyz + off;
  // THE FLAT BASE: nothing hangs below the cloud's base plane
  float hb = dot(p - iB.xyz, up) + iB.w;
  float base = 0.0;
  if (hb < 0.0) { p -= up * hb; hb = 0.0; base = 1.0; }
  // the painted normal: the lobe's own, bent toward the direction from a point just over the cloud's BASE (so all of the
  // heap above the shelf faces up and out, toward the light, and only the flat base faces down: the lit top dominates, the
  // review of 24 Nov; bent toward the cloud's middle, a far cloud seen from below was its grey belly all over), and on
  // the base straight down
  vec3 cen = iB.xyz - up * iB.w * 0.90;
  vec3 nl = normalize(off + up * dot(off, up) * (1.0 - iD.x));
  vec3 np = normalize(mix(nl, normalize(p - cen), uCloudBend));
  vNL = nl;
  vCrease = dot(nl, normalize(p - cen));
  // (the flat base is told in the fragment by its height, which is exactly 0 across it: a vertex pressed onto the base and
  // given the base's normal bent every triangle of a shelf lobe's side down with it, and the coarse far lobes, a triangle
  // or two tall, were all belly whichever way the sun stood: the grey saucers of the reworked stills)
  vNP = np;
  vNV = normalMatrix * vNP;
  { vec3 h = p - iB.xyz; h -= up * dot(h, up); vAxis = length(h) / max(iD.y * 0.9, 1.0); }
  // the stroke frame: the pole, and two axes round it
  vec3 pz = iC.xyz, px = normalize(cross(abs(pz.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0), pz)), py = cross(pz, px);
  vQ = vec3(dot(dir, px), dot(dir, py), dot(dir, pz));
  vK = vec4(iA.w, clamp(hb / max(iD.y, 1.0), 0.0, 1.0), iD.z, iC.w);
  vUp = up;
  // the planet's shadow (a cloud top keeps the sun after the land has lost it): the ray from here toward the sun
  vec3 pb = uAnchorD + p;
  float tc = -dot(pb, uCloudSun);
  float miss = length(pb + uCloudSun * max(tc, 0.0)) - uGroundR;
  vAirSun = vec2(iD.w, tc > 0.0 ? smoothstep(-20.0, 60.0, miss) : 1.0);
  vRel = p - uCamD;
  vPosA = uAnchorD + p;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
  ${VERT_END}
}
`;

// THE LIGHTNING IN THE CLOUD (WEATHER-DESIGN A2 and C4): the flashes of the storms near the eye (the cloud map's
// fields.cloud.flashes, the weather group's), each a light inside its cloud a few hundred metres over the base, lighting
// the strokes within about 300-450 m of it to a pale cool flat tone for the flash's own moment -- some strokes and not others,
// as a flash lights a cloud from inside in patches; never a glow. uFlash[i]: xyz the light, drifting frame from the
// planet's centre; w its strength now (0..1).
const FLASH_GLSL = /* glsl */`
uniform vec4 uFlash[4];
float pcCloudFlash(vec3 pa) {
  float f = 0.0;
  for (int i = 0; i < 4; i++) {
    vec4 L = uFlash[i];
    if (L.w <= 0.0) continue;
    f = max(f, L.w * (1.0 - smoothstep(150.0, 600.0, length(pa - L.xyz))));
  }
  return f;
}
`;

const CLOUD_FRAG = /* glsl */`
${FRAG_PARS}
uniform vec3 uCloudSun;
uniform vec3 uSkyZenith;
uniform vec3 uSkyHorizon;
uniform vec3 uCloudShade;
uniform vec3 uStormWash;
uniform vec4 uWxSky;
uniform vec4 uSkyOil;
uniform vec4 uAtmo;
varying vec3 vRel;
varying vec3 vView;
varying vec3 vNP;
varying vec3 vQ;
varying vec4 vK;
varying vec3 vUp;
varying vec2 vAirSun;
varying vec3 vNV;
varying float vAxis;
varying vec3 vPosA;
varying vec3 vNL;
varying float vCrease;
${FLASH_GLSL}
vec3 pcCloudDens(vec3 c, float d) { return clamp(c - (c - c * c) * (d - 1.0), 0.0, 1.0); }
// (the sky's ceiling on value, sky.js pcSkyCap, copied: nothing in a cloud goes paper-white)
vec3 pcCloudCap(vec3 c, float k) {
  if (k >= 0.999) return c;
  float L = max(c.r, max(c.g, c.b));
  float knee = max(0.0, k - 0.14);
  if (L <= knee) return c;
  float sp = max(1e-4, k - knee);
  return c * ((knee + sp * (1.0 - exp(-(L - knee) / sp))) / L);
}
void main() {
  #include <logdepthbuf_fragment>
  float dist = length(vRel);
  vec3 vdir = vRel / max(dist, 1e-3);
  vec3 n = normalize(vNP);
  // THE STROKES, laid on the lobe's own sphere: rows of latitude round its pole, a stroke about 6 to 13 pixels wide
  vec3 q = normalize(vQ);
  float r = vK.x;
  float lon = atan(q.y, q.x), lat = asin(clamp(q.z, -0.999, 0.999));
  vec2 ch = vec2(lon, lat) * r;
  // (the chart's derivatives from the direction's, not from the chart: the longitude jumps by a turn at its seam)
  vec3 qx = dFdx(q), qy = dFdy(q);
  float ir = 1.0 / max(q.x * q.x + q.y * q.y, 1e-4), il = 1.0 / sqrt(max(1.0 - q.z * q.z, 1e-4));
  vec2 dcx = vec2((q.x * qx.y - q.y * qx.x) * ir, qx.z * il) * r;
  vec2 dcy = vec2((q.x * qy.y - q.y * qy.x) * ir, qy.z * il) * r;
  vec2 oc = pcStrokeOct(dist * 1.4, 0.4);
  vec3 rnd, rndN; vec2 ds; float own;
  // (the ends ragged, as a loaded knife leaves them: cut straight, the deep strokes on a near tower were rectangles)
  vec2 uvS; float pxW;
  pcThinLayerUV(ch + vK.w * 53.0, dcx, dcy, oc.x, 3.0, q * r + vK.w * 9.0, 30.0, 1.5, 0.12, rnd, ds, own, rndN, uvS, pxW);
  // (a cloud the eye is close to thins BY WHOLE STROKES, from 280 m in (from 450 m a near cloud at 600 m read as lace), so it is passed through rather than standing as a
  // flat sheet in front of the camera -- the look director's review of the 1 km stills)
  if (fract(rnd.x * 7.13 + rnd.y * 3.31) > 0.25 + 0.75 * smoothstep(100.0, 280.0, dist)) discard;
  // the light, asked at the stroke's centre (the normal and the height carried there)
  vec3 nS = normalize(PC_AT(n, ds));
  float hS = clamp(PC_AT(vK.y, ds), 0.0, 1.0);
  float sunK = clamp(PC_AT(vAirSun.y, ds), 0.0, 1.0);
  vec3 sun = normalize(uCloudSun);
  float lam = dot(nS, sun);
  vec3 upV = normalize(vUp);
  // (a far cloud is painted as its lit shape over a thin darker base, as a painter simplifies a distant cumulus: past a
  // kilometre or so the base gives way to the light. Without it a far cloud seen a little from below was a grey saucer
  // with a cream rim, the reworked stills of 24 Nov)
  float onBase = 1.0 - smoothstep(0.004, 0.02, hS);
  float down = max(smoothstep(0.55, 0.85, -dot(nS, upV)), onBase) * (1.0 - 0.75 * smoothstep(1200.0, 3500.0, dist));
  float st = clamp(max(vK.z, uWxSky.y), 0.0, 1.0);
  // THE LIGHT ACROSS THE FORM (the review of 24 Nov: the lit top must dominate, the base flat and darker, the heap
  // building upward). Lit by the sun as far as it reaches, and from above whatever the hour, as a painter lights a
  // cumulus; the lower sides a step deeper; the flat base one darker shelf, the belly, deeper at its core only in a storm.
  // (and the sides lifted: light scattered through the cloud keeps a cumulus' turned-away flank a half-tone, not its belly;
  // only the flat base goes to the belly. Without it a field of cumulus seen from below was grey shelves with a cream cap)
  // (the far lift only for a cloud seen from below, where a far cumulus is its lit shape over a thin base; seen from above
  // or level it kept every far cloud in the lit tone, the flat cream shapes of the 1 km stills)
  float lookUp = smoothstep(-0.02, 0.06, dot(vdir, upV));
  float x = (lam * 0.5 + 0.5) * mix(0.40, 1.0, sunK) + 0.18 * max(dot(nS, upV), 0.0) * uAtmo.y * mix(0.5, 1.0, sunK)
          + 0.08 * (1.0 - abs(dot(nS, upV))) * uAtmo.y + 0.14 * smoothstep(1200.0, 3500.0, dist) * uAtmo.y * (1.0 - st) * lookUp;
  x -= (1.0 - smoothstep(0.0, 0.40, hS)) * 0.10 * (1.0 - down);
  // EACH HEAD'S OWN SHADED SIDE (rework 2b): a cumulus lit from the front and above is still a cauliflower -- every head
  // turns a side from the sun, in the half-tone, however lit the whole. Read from the lobe's own normal (the bent one
  // faces the whole cloud to the light: from 1 km, front-lit, every cloud was one flat lit tone)
  float lamL = dot(normalize(PC_AT(vNL, ds)), sun);
  x = mix(x, min(x, 0.46), smoothstep(0.15, -0.15, lamL) * (1.0 - down) * uAtmo.y);
  // and THE CREASES between heads: where a lobe's own surface turns in toward its cloud and still shows, it lies between
  // two heads, out of the light -- the half-tone. Front-lit (the sun behind the eye), this is what still draws a
  // cumulus' heads: from 600 m it was one flat light shape with a bumpy outline
  float crease = smoothstep(0.35, 0.02, PC_AT(vCrease, ds)) * (1.0 - down);
  x = mix(x, min(x, 0.44), crease);
  // and EACH HEAD ITS OWN LIT CAP when the sun stands high: the lower half of every head, by its own normal, in the
  // half-tone, so stacked heads read as a cauliflower whichever side the eye is on -- at noon, front-lit from the air, the
  // whole cloud was in the light (the look director's reviews of rework 2). At a low sun the light comes from the side and
  // the golden-hour form (passed) is left as it was.
  float capK = smoothstep(0.30, 0.70, dot(sun, upV)) * uAtmo.y;
  float headLow = smoothstep(0.10, -0.25, dot(normalize(PC_AT(vNL, ds)), upV));
  x = mix(x, min(x, 0.46), headLow * capK * (1.0 - down));
  float core = 1.0 - smoothstep(0.35, 0.75, PC_AT(vAxis, ds));
  x = mix(x, 0.22 - 0.16 * core * st, down);
  // (rework 2: flat tones in the body, broken only at the edges -- a stroke's own jitter small, so the strokes of one tone
  // do not alternate with the next across the body as stripes)
  float xN = x + (rndN.z - 0.5) * 0.04;
  x += (rnd.z - 0.5) * 0.04;
  // (a cloud's outline against the sky is never its deepest paint: the thin edge a step lighter than the body behind it.
  // There is no line drawn round anything: a lit edge is a tone of the strokes, not a rim)
  float side = 1.0 - abs(dot(nS, vdir));
  float sil = smoothstep(0.80, 0.90, side) * (1.0 - 0.6 * down);
  // (with the sun behind the cloud the thin edge takes the light itself, the silver lining, a tone of the strokes over the
  // grey body; across the sun's line a half-tone)
  float backlit = smoothstep(0.2, 0.7, dot(sun, vdir)) * sunK * uAtmo.y;
  float edgeX = mix(0.40, 0.56, backlit);
  x = mix(x, max(x, edgeX), sil); xN = mix(xN, max(xN, edgeX), sil);
  // (and a stroke in six or so near the base's edge takes the half-tone: the light the land throws back up into it; the core
  // of the base stays one flat tone)
  float baseRing = smoothstep(0.5, 0.85, PC_AT(vAxis, ds));
  x = mix(x, max(x, 0.40), down * baseRing * step(rnd.x, 0.16)); xN = mix(xN, max(xN, 0.40), down * baseRing * step(rndN.x, 0.16));
  // THE TONES (the look director's palette, 24 Nov): the lit top in THE LIGHT'S OWN COLOUR, warm at the golden hours;
  // the half-tone the sky's own blue-grey a step under it; the belly that blue-grey a further step down, the zenith key's
  // hue, never violet; the deep only inside a storm. About 0.82, 0.70 and 0.58 in luminance by day: three value steps.
  vec3 sunC = mix(pow(uLight, vec3(uOilA.z)), vec3(1.0, 0.84, 0.52), 0.75 * pcGold());
  vec3 zh = uSkyZenith / max(dot(uSkyZenith, vec3(0.3, 0.5, 0.2)), 1e-3);
  // (REWORK 2, the coordinator of 24 Nov: next to the painted sky the clouds read as grey saucers. A painter's fair cumulus
  // stays LIGHT even backlit: its shade a soft lavender-grey a step or two under the sky's own horizon value, the lit edges
  // near white, the whole cloud lighter than the blue round it. Built from the painted sky cloud's own tones (sky.js: its
  // lit top, and its half-tone made from the world's cloud-shadow key): the light near white in the light's colour, the lit
  // top, the half-tone that lavender lifted a third of the way to the horizon, the belly one step under it.)
  vec3 cTopA = mix(vec3(0.78, 0.78, 0.785), uSkyHorizon, 0.18);
  vec3 cLav = pcCloudDens(uCloudShade, 1.85);
  cLav = mix(cLav, vec3(dot(cLav, vec3(0.3, 0.5, 0.2))), 0.12);
  // (the light's colour a quarter in by day: at 0.4 the lit tops at noon were cream against the blue; the golden hours'
  // own wash, below, warms them then)
  vec3 cLight = mix(vec3(0.95), sunC * 0.95, 0.18);
  vec3 cTop = mix(cTopA * 1.01, sunC * 0.82, 0.25);
  // (a CLEAR step under the lit top, about 0.10 in value: at 0.35 toward the horizon it was a breath under it, and from
  // 600 m at noon a cumulus read as one pale tone, the look director's review)
  vec3 cHalf = mix(cLav, uSkyHorizon, 0.20);
  vec3 cBase = pcCloudDens(cHalf, 1.25);
  cLight = mix(cLight, cTop, st);
  // a storm: the shade goes to the world's heavy-weather pigment, slate and indigo, and only there a deep tone; the
  // lit flank keeps the light (the coordinator: a dark slate tower with a sunlit flank)
  vec3 cDeep = mix(cBase * 0.82, pcCloudDens(uStormWash, 1.30), 0.8);
  cHalf = mix(cHalf, pcCloudDens(mix(uStormWash, cHalf, 0.35), 1.05), st * 0.75);
  cBase = mix(cBase, pcCloudDens(uStormWash, 1.18), st * 0.85);
  cTop = mix(cTop, cTop * 0.92, st);
  vec3 c1 = x > 0.86 ? cLight : x > 0.56 ? cTop : x > 0.32 ? cHalf : (x > 0.10 || st < 0.05) ? cBase : cDeep;
  vec3 c2 = xN > 0.86 ? cLight : xN > 0.56 ? cTop : xN > 0.32 ? cHalf : (xN > 0.10 || st < 0.05) ? cBase : cDeep;
  vec3 c = mix(c2, c1, own);
  float topK = mix(step(0.56, xN), step(0.56, x), own);
  // THE GOLDEN HOURS, as the sky lays them over its own cloud (sky.js: the whole sky warms, most of all low down): the lit
  // top takes nearly all of it, the shade under half, so the form stays while the cloud goes warm with its sky.
  {
    float sunE = dot(sun, upV);
    // (how golden the hour is, read from THE SKY'S OWN WARMTH, its horizon key, not the sun's height: on this small world
    // the sun at 13:00 stands low enough that the height-based wash laid gold on the clouds under a plain blue sky -- the
    // cream clouds of the 1 km stills of rework 2)
    float gold = smoothstep(0.0, 0.16, uSkyHorizon.r - uSkyHorizon.b) * uAtmo.y * (1.0 - uAtmo.x) * (1.0 - uWxSky.x) * uOilG.w;
    float eV = dot(vdir, upV);
    c = mix(c, vec3(0.92, 0.80, 0.58), gold * mix(0.80, 0.45, smoothstep(0.0, 0.7, eV)) * mix(0.42, 0.90, topK));
  }
  // by night a cloud is a flat shape a step lighter than the sky it lies in, with no lit side (sky.js, the oil night)
  vec3 nightC = mix(mix(uSkyZenith, uSkyHorizon, 0.5), uSkyHorizon, 0.30) * (0.92 + 0.10 * hS);
  c = mix(nightC, c, uAtmo.y);
  // the lightning's light, asked at the stroke's centre: a stroke is lit whole or not at all
  // (a cloud lit in whole HEADS, each lobe by its own number, in two value steps falling off from the light: stroke by
  // stroke it was a scatter of flecks)
  {
    float flS = PC_AT(pcCloudFlash(vPosA), ds) - 0.35 * fract(vK.w * 5.31);
    vec3 flC = vec3(0.84, 0.86, 0.96);
    c = mix(c, mix(c, flC, 0.5), step(0.05, flS));
    c = mix(c, flC, step(0.35, flS));
  }
  // THE CLOUD'S OWN AIR: a far cloud goes toward the sky's low band in flat steps, one step for the whole cloud (the
  // land's air, pcFogAmount, would swallow it: the ground's visibility is a few hundred metres, a cloud's kilometres)
  vec3 farC = mix(uSkyHorizon, vec3(0.48, 0.50, 0.63), uOilS.x * 0.6);
  c = mix(c, farC, vAirSun.x);
  c = pcCloudCap(c, uSkyOil.y);
  vec3 nV = normalize(vNV);
  // (region 0, the sky's: the post passes leave clouds out of everything they lay on the land -- the night's near wash,
  // the far contrast, the cloud shadow's glaze -- by testing aux.w against 0.5, so the hash stays well under it)
  pcWrite(c, 0.0, nV, -vView.z, 0.02 + 0.4 * fract(vK.w * 3.7));
}
`;

let _matId = 0;
function makeCloudMaterial(skyU, own) {
  ensureGlobals();
  const m = new THREE.ShaderMaterial({
    name: 'pc-cloud-lobe',
    uniforms: makePaintUniforms(defaultBodyUniforms(), {
      ...own,
      uSkyZenith: skyU.uSkyZenith, uSkyHorizon: skyU.uSkyHorizon, uCloudShade: skyU.uCloudShade, uStormWash: skyU.uStormWash,
      uWxSky: skyU.uWxSky, uSkyOil: skyU.uSkyOil, uAtmo: skyU.uAtmo,
    }),
    vertexShader: CLOUD_VERT, fragmentShader: CLOUD_FRAG,
    side: THREE.FrontSide,
  });
  m.userData.pcPainted = true;
  _matId++;
  return register(m, 'cloud', null);
}

// ---- A3 THE DECK and A5 THE VALLEY CLOUD: a sheet of cloud you can be under, in, or above -------------------------------
// A grid of N x N quads laid round the eye on the sphere (gnomonic, about an anchor in the drifting frame, moved when the eye
// has gone a quarter of the way to its edge), each vertex set at the deck's base from the cloud map where it now is, and
// carrying the deck's cover, thickness and storm there. The fragment lays the sheet's own shapes over that cover --
// rolls across the wind, crisp gaps of sky where the cover breaks -- and leaves out (discards) what is clear: a deck's
// holes are its whole drawing, and its pixels are a fraction of a sky full of it. From below: a painted ceiling in flat
// tones, the rolls in it, the edges of the gaps lit where the sun is behind them. From above: a lit top in heaps, the
// peaks standing out of it through the depth test, the owner's Aloft reference's sea of cloud.
// The valley cloud is the same sheet, low (the land smoothed over 1.2 km less 40 m), carrying the map's `valley` channel.
const SHELL_VERT = /* glsl */`
${VERT_PARS}
uniform vec3 uCamD;
uniform vec3 uAnchorD;
uniform vec3 uCloudSun;
uniform float uGroundR;
attribute vec4 aDeck;      // x cover 0..1, y thickness (m), z storm 0..1, w the cloud's air
varying vec3 vRel;
varying vec3 vView;
varying vec3 vPosD;        // the place, from the planet's centre, drifting frame (for the sheet's own shapes: no derivative of it is taken)
varying vec4 vDeck;
varying float vSun;
varying vec3 vUpV;
void main() {
  vec3 p = position;
  vPosD = uAnchorD + p;
  float tc = -dot(vPosD, uCloudSun);
  float miss = length(vPosD + uCloudSun * max(tc, 0.0)) - uGroundR;
  vSun = tc > 0.0 ? smoothstep(-20.0, 60.0, miss) : 1.0;
  vDeck = aDeck;
  vUpV = normalMatrix * normalize(vPosD);
  vRel = p - uCamD;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
  ${VERT_END}
}
`;

const SHELL_FRAG = /* glsl */`
${FRAG_PARS}
uniform vec3 uCloudSun;
uniform vec3 uSkyZenith;
uniform vec3 uSkyHorizon;
uniform vec3 uCloudShade;
uniform vec3 uStormWash;
uniform vec4 uWxSky;
uniform vec4 uSkyOil;
uniform vec4 uAtmo;
uniform vec3 uDeckWind;    // the wind aloft's way, a unit tangent at the eye (drifting frame): the rolls lie across it
uniform vec3 uCamD;
uniform vec3 uAnchorD;
uniform vec4 uShellK;      // x 0 the deck, 1 the valley cloud; y the planet's radius (m); z the sheet's own scale (m)
varying vec3 vRel;
varying vec3 vView;
varying vec3 vPosD;
varying vec4 vDeck;
varying float vSun;
varying vec3 vUpV;
${FLASH_GLSL}
vec3 pcShDens(vec3 c, float d) { return clamp(c - (c - c * c) * (d - 1.0), 0.0, 1.0); }
vec3 pcShCap(vec3 c, float k) {
  if (k >= 0.999) return c;
  float L = max(c.r, max(c.g, c.b));
  float knee = max(0.0, k - 0.14);
  if (L <= knee) return c;
  float sp = max(1e-4, k - knee);
  return c * ((knee + sp * (1.0 - exp(-(L - knee) / sp))) / L);
}
// the sheet's own mass at a place: rolls across the wind (the noise squeezed along it), two octaves
float pcShMass(vec3 pb) {
  vec3 w = uDeckWind;
  vec3 q = (pb - w * dot(pb, w) * 0.62) / uShellK.z;
  return texture(uNoise3D, q).r * 0.72 + texture(uNoise3D, q * 2.6 + 0.37).g * 0.28;
}
void main() {
  #include <logdepthbuf_fragment>
  float dist = length(vRel);
  vec3 up = normalize(vPosD);
  float m = pcShMass(vPosD);
  float cov = clamp(vDeck.x, 0.0, 1.0);
  // (the gaps from a broader, rounder field than the rolls: cut from the rolls themselves they were slivers along the
  // wind, a scatter of thin gold streaks over a storm's edge, the stills of 24 Nov)
  vec3 qh = vPosD / (uShellK.z * 3.6);
  float hm = texture(uNoise3D, qh + 0.53).b * 0.82 + texture(uNoise3D, qh * 2.3 + 0.11).r * 0.18;
  // (the gaps: where the sheet's own mass falls under what its cover leaves open. A closed sheet has none at all: with a
  // threshold that only grew toward nothing, the noise's few deep dips were pin-holes of sky all over a storm's deck)
  float edge = hm - (1.0 - cov) * 1.15 + 0.12 * smoothstep(0.80, 1.0, cov);
  // (a sheet laid in strokes: the chart of the ground at the sheet's own radius, and the mass carried to each stroke's
  // centre, so a gap's edge and the border between two tones both run along the strokes)
  float R = uShellK.y;
  vec2 ch = pcGroundChart(vPosD, R);
  vec2 dcx = pcGroundChartD(vPosD, dFdx(vRel), R), dcy = pcGroundChartD(vPosD, dFdy(vRel), R);
  vec2 oc = pcStrokeOct(dist * 1.4, 0.6);
  vec3 rnd, rndN; vec2 ds; float own;
  vec2 uvS; float pxW;
  pcThinLayerUV(ch, dcx, dcy, oc.x, 3.0, vPosD * 0.01, 30.0, 2.0, 0.12, rnd, ds, own, rndN, uvS, pxW);
  float mS = PC_AT(m, ds);
  float eS = PC_AT(edge, ds) + (rnd.z - 0.5) * 0.03;
  if (eS < 0.0) discard;
  float below = step(dot(uAnchorD + uCamD, up), dot(vPosD, up));      // the eye under the sheet
  vec3 sun = normalize(uCloudSun);
  float se = dot(sun, up);
  float sunK = vSun;
  // (the same palette as the lobes, the look director's of 24 Nov: the light's own colour on top, the sky's blue-grey a step
  // under it, a further step for the belly in the zenith key's hue, a deep only in a storm)
  vec3 sunC = mix(pow(uLight, vec3(uOilA.z)), vec3(1.0, 0.84, 0.52), 0.75 * pcGold());
  vec3 zh = uSkyZenith / max(dot(uSkyZenith, vec3(0.3, 0.5, 0.2)), 1e-3);
  // (rework 2, as the lobes: the painted sky cloud's lit top and its lavender half-tone, lifted toward the horizon; the
  // ceiling's belly one step under it. Only a storm takes them down to its slate)
  vec3 cLav = pcShDens(uCloudShade, 1.85);
  cLav = mix(cLav, vec3(dot(cLav, vec3(0.3, 0.5, 0.2))), 0.12);
  vec3 cTop = mix(mix(vec3(0.78, 0.78, 0.785), uSkyHorizon, 0.18) * 1.01, sunC * 0.82, 0.25);
  vec3 cHalf = mix(cLav, uSkyHorizon, 0.30);
  vec3 cBase = pcShDens(cHalf, 1.30);
  vec3 cDeep = cBase;
  float st = clamp(max(vDeck.z, uWxSky.y * (1.0 - uShellK.x)), 0.0, 1.0);
  // (a THICK deck is dark beneath whatever the storm field says: the weather group's land storm at 980 m, its front still
  // a cumulus by the map, came as a pale lavender bank. From 250 m of thickness to 600 the belly goes a step deeper)
  float thickK = smoothstep(250.0, 600.0, vDeck.y) * (1.0 - uShellK.x);
  cBase = mix(cBase, pcShDens(mix(cBase, uStormWash, 0.35), 1.45), thickK);
  cDeep = mix(cDeep, pcShDens(mix(cDeep, uStormWash, 0.5), 1.55), thickK);
  // (a storm's ceiling a step lighter than its heaviest pigment: the sky is the light of a rain picture and its darks stay
  // over the wood's, PAINTER 16/17)
  cDeep = mix(cDeep, pcShDens(uStormWash, 1.18), st);
  cBase = mix(cBase, pcShDens(mix(uStormWash, cHalf, 0.25), 1.0), st * 0.75);
  cHalf = mix(cHalf, mix(pcShDens(uStormWash, 0.80), cHalf, 0.45), st * 0.6);
  float jit = (rnd.y - 0.5) * 0.10;
  vec3 c;
  if (below > 0.5) {
    // FROM BELOW (the review of 24 Nov: a storm's ceiling broken into two or three big masses with lighter gaps): the big
    // field that cuts the gaps sets the masses -- where it runs thin a lighter seam, a half-tone, even where the sheet is
    // closed; its body the belly; the rolls only move a stroke a step either way; a deep only in a storm's heaviest
    // (the masses' edges crisp and SMOOTH, a pixel wide from fwidth as the sky's own bands (sky.js tq): told stroke by
    // stroke, seen far and flat the light and dark bands stepped like a staircase in pixel blocks -- the look director)
    float xC = smoothstep(0.30, 0.62, hm) * 0.8 + (m - 0.5) * 0.35;
    float fwx = max(fwidth(xC), 1e-4);
    float kB = smoothstep(0.34 - fwx, 0.34 + fwx, xC), kD = smoothstep(0.72 - fwx, 0.72 + fwx, xC) * step(0.05, st);
    c = mix(mix(cHalf, cBase, kB), cDeep, kD);
    // the gaps' own edges, where the sun is over the sheet: a step lighter (the light comes through them), never a line
    float thin = (1.0 - smoothstep(0.0, 0.10, eS)) * step(0.0, se) * sunK * uAtmo.y * (1.0 - 0.7 * st);
    c = mix(c, cHalf, step(0.5, thin + (rnd.x - 0.5) * 0.4));
  } else {
    // FROM ABOVE: a lit top in heaps (the mass is its relief), the hollows a half-tone; the sun's height lights the whole
    float x = (0.55 + 0.45 * se) * mix(0.35, 1.0, sunK) + (mS - 0.5) * 0.40 + jit;
    c = x > 0.50 ? cTop : x > 0.30 ? cHalf : cBase;
  }
  float thick = clamp(eS / 0.30, 0.0, 1.0);
  // the valley cloud: a low white mist, lit, its shade a little cool (no belly: it is seen from above and from its side)
  if (uShellK.x > 0.5) c = mix(c, mix(cTop, cHalf, step(0.62, thick + jit) * 0.5), 0.75);
  {
    float gold = smoothstep(0.0, 0.16, uSkyHorizon.r - uSkyHorizon.b) * uAtmo.y * (1.0 - uAtmo.x) * (1.0 - uWxSky.x) * uOilG.w;
    float eV = dot(normalize(vRel), up);
    c = mix(c, vec3(0.92, 0.80, 0.58), gold * mix(0.80, 0.45, smoothstep(0.0, 0.7, abs(eV))) * 0.6 * (1.0 - 0.6 * st));
  }
  vec3 nightC = mix(mix(uSkyZenith, uSkyHorizon, 0.5), uSkyHorizon, 0.30) * (0.90 + 0.12 * thick);
  c = mix(nightC, c, uAtmo.y);
  // (the ceiling lit in its own MASSES, the thick of the sheet first, in TWO VALUE STEPS falling off from the light: near
  // it the pale cool flash tone, further out half-way to it -- one flat pale zone over a third of the sky, the look
  // director's review; stroke by stroke, a scatter of flecks. Its edges a pixel wide, as the masses')
  {
    float fl = pcCloudFlash(vPosD) - 0.45 * (1.0 - hm);
    float fwf = max(fwidth(fl), 1e-4);
    vec3 flC = vec3(0.84, 0.86, 0.96);
    c = mix(c, mix(c, flC, 0.5), smoothstep(0.02 - fwf, 0.02 + fwf, fl));
    c = mix(c, flC, smoothstep(0.30 - fwf, 0.30 + fwf, fl));
  }
  // the sheet's own air, in flat steps of the distance (the land's air would swallow it)
  float af = floor(min(0.45, 0.55 * (1.0 - exp(-dist / 8000.0))) * 5.0 + 0.5) / 5.0;
  vec3 farC = mix(uSkyHorizon, vec3(0.48, 0.50, 0.63), uOilS.x * 0.6);
  c = mix(c, farC, af);
  c = pcShCap(c, uSkyOil.y);
  vec3 nV = normalize(vUpV) * (below > 0.5 ? -1.0 : 1.0);
  pcWrite(c, 0.0, nV, -vView.z, 0.06);
}
`;

function makeShellMaterial(skyU, own, kind) {
  ensureGlobals();
  const m = new THREE.ShaderMaterial({
    name: kind ? 'pc-cloud-valley' : 'pc-cloud-deck',
    uniforms: makePaintUniforms(defaultBodyUniforms(), {
      uCamD: own.uCamD, uAnchorD: own.uAnchorD, uCloudSun: own.uCloudSun, uGroundR: own.uGroundR, uDeckWind: own.uDeckWind,
      uShellK: own.uShellK, uFlash: own.uFlash,
      uSkyZenith: skyU.uSkyZenith, uSkyHorizon: skyU.uSkyHorizon, uCloudShade: skyU.uCloudShade, uStormWash: skyU.uStormWash,
      uWxSky: skyU.uWxSky, uSkyOil: skyU.uSkyOil, uAtmo: skyU.uAtmo,
    }),
    vertexShader: SHELL_VERT, fragmentShader: SHELL_FRAG,
    side: THREE.DoubleSide,
  });
  m.userData.pcPainted = true;
  return register(m, 'cloud-sheet', { kind });
}

// ---- A6 THE CLOUD SHADOW MAP ------------------------------------------------------------------------------------------
// The lobes and the deck drawn from the sun, straight along its light, into a small square (256 x 256 texels over the
// ground the eye can see: about 9 to 27 m a texel) every second frame: 1 where a cloud stands between the sun and the
// ground, 0 where the light comes through. Read with WXFIELD_GLSL pcCloudShadow(body-local position) or, in a pass over
// the picture, through uCloudShadowV (view space -> the square), it is the clouds' own shapes lying on the land, and
// they move as the clouds move. It is smooth across a texel (the hardware's filter): the reader thresholds it crisply.
const SHADOW_LOBE_VERT = /* glsl */`
uniform highp sampler3D uNoise3D;
uniform vec3 uAnchorD;
attribute vec4 iA;
attribute vec4 iB;
attribute vec4 iC;
attribute vec4 iD;
void main() {
  vec3 dir = normalize(position);
  vec3 up = normalize(uAnchorD + iB.xyz);
  float n1 = texture(uNoise3D, dir * 0.55 + iC.w * 7.13).r;
  float n2 = texture(uNoise3D, dir * 1.30 + iC.w * 3.71).g;
  vec3 off = dir * iA.w * (0.86 + 0.30 * n1 + 0.10 * n2);
  off -= up * dot(off, up) * (1.0 - iD.x);
  vec3 p = iA.xyz + off;
  float hb = dot(p - iB.xyz, up) + iB.w;
  if (hb < 0.0) p -= up * hb;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;
const SHADOW_FRAG = /* glsl */`
void main() { gl_FragColor = vec4(1.0); }
`;
const SHADOW_SHEET_VERT = /* glsl */`
uniform vec3 uAnchorD;
attribute vec4 aDeck;
varying vec3 vPosD;
varying float vCov;
void main() {
  vPosD = uAnchorD + position;
  vCov = aDeck.x;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const SHADOW_SHEET_FRAG = /* glsl */`
uniform highp sampler3D uNoise3D;
uniform vec4 uShellK;
varying vec3 vPosD;
varying float vCov;
void main() {
  vec3 qh = vPosD / (uShellK.z * 3.6);
  float hm = texture(uNoise3D, qh + 0.53).b * 0.82 + texture(uNoise3D, qh * 2.3 + 0.11).r * 0.18;
  float cov = clamp(vCov, 0.0, 1.0);
  if (hm - (1.0 - cov) * 1.15 + 0.12 * smoothstep(0.80, 1.0, cov) < 0.0) discard;
  gl_FragColor = vec4(1.0);
}
`;
const CLOUD_LAYER = 7;

// ---- numbers from a slot -----------------------------------------------------------------------------------------------
function hash(a, b, c) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// A cloud's lobes in its own units (x, z across and r in units of its radius; y up in units of its thickness; sq how far
// the lobe is squashed along up), built as a painter builds a cumulus: A CAULIFLOWER ON A SHELF (the review of 24 Nov:
// "not a bunch of grapes"). The shelf: a ring of wide lobes whose centres sit ON the base plane, squashed, so half of
// each is cut by it and the cloud stands on one flat base; the body over it, narrower; the heap on top, smaller lobes
// building upward round the middle. The shelf first, then the body, then the heap: a far cloud draws the first few and
// is a flat strip, as perspective lays a far cumulus, never a round pill. aspect: thickness over radius at birth.
function makeTemplate(slot, gen, aspect) {
  const L = [];
  const H = (j) => hash(slot, gen * 131 + j, 77);
  let j = 0;
  // (rework 2: IRREGULAR outlines, not saucers. The shelf drawn out along a way of its own, its lobes at uneven reaches and
  // sizes, a lobe or two left out, the heap off the middle: each cumulus its own shape from any side)
  const elA = H(j++) * Math.PI, elK = 1 + 0.6 * H(j++), ec = Math.cos(elA), es = Math.sin(elA);
  const hx = (H(j++) - 0.5) * 0.36, hz = (H(j++) - 0.5) * 0.36;
  const shape = (o) => { const u = o.x * ec + o.z * es, v = -o.x * es + o.z * ec, U = u * elK, V = v / Math.sqrt(elK); o.x = U * ec - V * es; o.z = U * es + V * ec; return o; };
  // the shelf
  const ns = 6 + Math.floor(H(j++) * 3), a0 = H(j++) * Math.PI * 2, skip = Math.floor(H(j++) * ns * 1.6);
  for (let i = 0; i < ns; i++) {
    const a = a0 + (i + (H(j++) - 0.5) * 0.7) * Math.PI * 2 / ns, rg = 0.58 * (0.6 + 0.65 * H(j++)), rr = 0.44 * (0.72 + 0.5 * H(j++));
    if (i === skip) continue;
    L.push(shape({ x: Math.cos(a) * rg, z: Math.sin(a) * rg, y: 0.0, r: rr, sq: 0.55, k: 0 }));
  }
  L.push(shape({ x: hx * 0.4, z: hz * 0.4, y: 0.04, r: 0.55, sq: 0.55, k: 0 }));
  // the body: one tier for a fair cumulus, more for a tower
  const nb = Math.max(1, Math.min(5, Math.round(aspect / 0.9)));
  for (let t = 0; t < nb; t++) {
    const f = (t + 1) / (nb + 1), n = 4 + Math.floor(H(j++) * 2), b0 = H(j++) * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = b0 + (i + (H(j++) - 0.5) * 0.6) * Math.PI * 2 / n, rg = (0.34 - 0.10 * f) * (0.7 + 0.6 * H(j++));
      L.push(shape({ x: Math.cos(a) * rg + hx * f, z: Math.sin(a) * rg + hz * f, y: 0.18 + 0.50 * f + (H(j++) - 0.5) * 0.05, r: (0.40 - 0.06 * f) * (0.75 + 0.5 * H(j++)), sq: 0.9, k: 1 }));
    }
  }
  // the heap: smaller lobes round the middle, building upward, and the cap
  const nh = 3 + Math.floor(H(j++) * 3);
  for (let i = 0; i < nh; i++) {
    const a = H(j++) * Math.PI * 2, rg = 0.22 * H(j++);
    L.push({ x: Math.cos(a) * rg + hx, z: Math.sin(a) * rg + hz, y: 0.62 + 0.18 * H(j++), r: 0.22 + 0.12 * H(j++), sq: 0.95, k: 2 });
  }
  L.push({ x: hx + (H(j++) - 0.5) * 0.2, z: hz + (H(j++) - 0.5) * 0.2, y: 0.80, r: 0.26 + 0.06 * H(j++), sq: 0.95, k: 3 });
  // (the order: the shelf, the body, the heap, as built)
  return L;
}

// A THUNDERSTORM's lobes (the cloud map's convective cells, `fields.cloud.cells`, of the storm kind): a column of lobes
// from the base to the top, a little narrower as it rises, and at the top an ANVIL of flattened lobes fanned out
// downwind. Tower lobes in units of the tower's radius (x, z) and its height (y), anvil lobes (a: 1) in units of the
// anvil's length (x along the wind from the tower, z across it). The core first, then the anvil's middle, then its edges.
function makeStormTemplate(id, gen) {
  const L = [];
  const H = (j) => hash(id * 977 + 13, gen * 131 + j, 91);
  let j = 0;
  const K = 7;
  for (let k = 0; k < K; k++) {
    const f = k / (K - 1);
    // (the column barely narrows: a cumulonimbus is a massive tower, its top as broad as its middle, not a stalk)
    const n = Math.max(4, Math.round(7 - 2 * f + (H(j++) - 0.5)));
    const ring = 0.50 - 0.12 * f, rr = 0.52 - 0.06 * f;
    const a0 = H(j++) * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i + (H(j++) - 0.5) * 0.6) * Math.PI * 2 / n;
      const rg = ring * (0.7 + 0.5 * H(j++));
      L.push({ x: Math.cos(a) * rg, z: Math.sin(a) * rg, y: (k === 0 ? 0.01 : 0.04 + 0.80 * f) + (H(j++) - 0.5) * 0.03, r: rr * (0.85 + 0.3 * H(j++)), k, a: 0 });
    }
  }
  // the anvil: a FLAT shelf of smaller flattened lobes from over the tower out downwind, fanning out, its underside level
  // (bigger round lobes over the column made a puffy cap: the mushroom)
  const NA = 18;
  for (let i = 0; i < NA; i++) {
    const t = i / (NA - 1);
    const x = 0.05 + 1.05 * t + (H(j++) - 0.5) * 0.06;
    const half = 0.14 + 0.32 * t;
    const z = (H(j++) - 0.5) * 2 * half;
    L.push({ x, z, y: 0.95 + (H(j++) - 0.5) * 0.02 - 0.02 * t, r: 0.09 + 0.05 * H(j++) + 0.04 * (1 - t), k: K + 1, a: 1 });
  }
  return L;
}

// A sheet's mesh: (N + 1)^2 vertices round an anchor direction, refilled at each rebuild; the grid itself is moved only
// when the eye has gone a quarter of its span from its centre, so between moves every vertex stays where it is on the
// drifting world and a gap's shape does not swim as the eye flies.
class Sheet {
  constructor(name, N, kind) {
    this.N = N; this.kind = kind;
    const V = (N + 1) * (N + 1);
    const g = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(new Float32Array(V * 3), 3); this.pos.setUsage(THREE.DynamicDrawUsage);
    this.deck = new THREE.BufferAttribute(new Float32Array(V * 4), 4); this.deck.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.pos); g.setAttribute('aDeck', this.deck);
    const idx = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    g.setIndex(idx);
    this.g = g; this.mesh = null; this.name = name;
    this.cx = 0; this.cy = 0; this.cz = 0; this.span = 0; this.has = false;
    this.ex = 1; this.ey = 0; this.ez = 0; this.nx = 0; this.ny = 0; this.nz = 1;
    this.any = false;
  }
  // centre the grid on a drifting-frame direction (unit) with a half-span in metres along the ground (R the radius)
  place(ux, uy, uz, span, R) {
    this.cx = ux; this.cy = uy; this.cz = uz; this.span = span; this.has = true;
    let ex = uz, ey = 0, ez = -ux; const el = Math.hypot(ex, ez) || 1; ex /= el; ez /= el;
    if (Math.hypot(ux, uz) < 1e-6) { ex = 1; ez = 0; }
    this.ex = ex; this.ey = ey; this.ez = ez;
    this.nx = uy * ez - uz * ey; this.ny = uz * ex - ux * ez; this.nz = ux * ey - uy * ex;
    this.R = R;
  }
  needsPlace(ux, uy, uz, span) {
    if (!this.has || Math.abs(span - this.span) > this.span * 0.35) return true;
    const d = Math.acos(Math.max(-1, Math.min(1, ux * this.cx + uy * this.cy + uz * this.cz))) * this.R;
    return d > this.span * 0.25;
  }
  // fill: fn(dx, dy, dz, out) gives out.cover, out.base (m above the datum), out.thick, out.storm for a drifting-frame unit
  // direction; anchor the mesh's origin (drifting frame); air per vertex from the eye's distance
  fill(fn, anchor, camD, R) {
    const N = this.N, P = this.pos.array, D = this.deck.array, o = {};
    const t = Math.tan(this.span / R);
    let any = false;
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const a = (i / N * 2 - 1) * t, b = (j / N * 2 - 1) * t;
      let x = this.cx + this.ex * a + this.nx * b, y = this.cy + this.ey * a + this.ny * b, z = this.cz + this.ez * a + this.nz * b;
      const l = Math.hypot(x, y, z); x /= l; y /= l; z /= l;
      fn(x, y, z, o);
      const r = R + o.base, k = j * (N + 1) + i;
      P[k * 3] = x * r - anchor.x; P[k * 3 + 1] = y * r - anchor.y; P[k * 3 + 2] = z * r - anchor.z;
      D[k * 4] = o.cover; D[k * 4 + 1] = o.thick; D[k * 4 + 2] = o.storm; D[k * 4 + 3] = 0;
      if (o.cover > 0.04) any = true;
    }
    this.pos.needsUpdate = true; this.deck.needsUpdate = true;
    this.g.computeBoundingSphere();
    this.any = any;
    void camD;
    return any;
  }
}

// a bilinear read of a per-texel Float32Array of the maps' cube grid (the wind map's land heights), at a body-local direction
const _fc = {};
function cubeAt(A, N, x, y, z) {
  dirToFace(x, y, z, _fc);
  const fx = Math.max(0, Math.min(N - 1, (_fc.u + 1) * 0.5 * N - 0.5)), fy = Math.max(0, Math.min(N - 1, (_fc.v + 1) * 0.5 * N - 0.5));
  const i0 = Math.min(N - 2, Math.floor(fx)), j0 = Math.min(N - 2, Math.floor(fy)), tx = fx - i0, ty = fy - j0;
  const k = (_fc.face * N + j0) * N + i0;
  return (A[k] * (1 - tx) + A[k + 1] * tx) * (1 - ty) + (A[k + N] * (1 - tx) + A[k + N + 1] * tx) * ty;
}

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _e = new THREE.Vector3(), _n = new THREE.Vector3();
const _q = new THREE.Quaternion(), _qi = new THREE.Quaternion(), _qs2 = new THREE.Quaternion();
const _cOut = {}, _wOut = {}, _cOut2 = {}, _cOut3 = {};
const _w2 = new THREE.Vector3();

// ---- the field ---------------------------------------------------------------------------------------------------------
export function createClouds(scene) {
  ensureGlobals();
  const group = new THREE.Group();
  group.name = 'pc-cloud-field';
  const own = {
    uCamD: { value: new THREE.Vector3() }, uAnchorD: { value: new THREE.Vector3() }, uCloudSun: { value: new THREE.Vector3(0, 1, 0) },
    uCloudBend: { value: CLOUDS.lobeBend }, uGroundR: { value: 4000 }, uDeckWind: { value: new THREE.Vector3(1, 0, 0) },
    uFlash: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
  };
  const deck = new Sheet('pc-cloud-deck', 32, 0), valley = new Sheet('pc-cloud-valley', 24, 1);
  for (const sh of [deck, valley]) {
    sh.anchor = new THREE.Vector3();
    sh.u = { uAnchorD: { value: new THREE.Vector3() }, uCamD: { value: new THREE.Vector3() }, uShellK: { value: new THREE.Vector4(sh.kind, 4000, sh.kind ? 110 : 300, 0) } };
  }
  let deckMat = null, valleyMat = null, sheetTick = 0;
  const eyeDeck = { base: 0, top: 0, cover: 0 };
  let mat = null;
  const meshes = LODS.map((lod) => {
    const g = icosphere(lod.detail);
    const cap = CLOUDS.maxLobes;
    const mk = () => { const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4); a.setUsage(THREE.DynamicDrawUsage); return a; };
    g.setAttribute('iA', mk()); g.setAttribute('iB', mk()); g.setAttribute('iC', mk()); g.setAttribute('iD', mk());
    g.instanceCount = 0;
    return { lod, g, mesh: null, n: 0 };
  });
  // (the unseen field for the shadow map alone: the coarsest lobe, on the shadow's layer only, so the scene's camera never
  // draws it)
  const shadowOnly = (() => {
    const g = icosphere(1), cap = 2048;
    const mk = () => { const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4); a.setUsage(THREE.DynamicDrawUsage); return a; };
    g.setAttribute('iA', mk()); g.setAttribute('iB', mk()); g.setAttribute('iC', mk()); g.setAttribute('iD', mk());
    g.instanceCount = 0;
    return { lod: LODS[0], g, mesh: null, n: 0, cap };
  })();
  const anchor = new THREE.Vector3();
  // A6: the shadow map's target, its camera (placed in the body's own frame, carried to the scene at each render), and the
  // matrix from a body-local place to the map
  const shadowRT = new THREE.WebGLRenderTarget(256, 256, { depthBuffer: false, stencilBuffer: false });
  shadowRT.texture.minFilter = shadowRT.texture.magFilter = THREE.LinearFilter;
  shadowRT.texture.generateMipmaps = false; shadowRT.texture.name = 'pc-cloud-shadow';
  const shCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 18000);
  shCam.matrixAutoUpdate = false; shCam.matrixWorldAutoUpdate = false; shCam.layers.set(CLOUD_LAYER);
  const shBody = new THREE.Matrix4(), shBodyInv = new THREE.Matrix4(), shM = new THREE.Matrix4(), shRootInv = new THREE.Matrix4();
  const BIAS = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  const NO_SHADOW = new THREE.Matrix4().set(0, 0, 0, -1, 0, 0, 0, -1, 0, 0, 0, 0, 0, 0, 0, 1);
  const shState = { on: false, frame: 0, h: 2000, sun: new THREE.Vector3(0, 1, 0), centre: new THREE.Vector3(), fwd: new THREE.Vector3(), Rg: 4000, has: false, mats: null };
  const _cc = new THREE.Color(), _sp = new THREE.Vector3(), _st = new THREE.Vector3(), _su = new THREE.Vector3(), _sx = new THREE.Vector3();
  const self = {
    eyeInCloud01: 0, enabled: true, shadowK: 1,
    group, meshes, deck, valley, stats: { clouds: 0, lobes: 0, tris: 0, ms: 0 },
    shadowTarget: shadowRT,
  };
  // the drifting frame
  const Q = new THREE.Quaternion();
  let bodyId = null, R = 4000, slots = null, lastT = null, since = 1e9, lastWall = 0;
  const tpl = new Map();        // slot -> { gen, aspect, lobes }
  const groundCache = new Map();
  let lobes = [];               // the lobes of the last rebuild (for eyeInCloud01), drift frame, absolute
  function makeSlots(id) {
    const r = BODIES[id].radius;
    const N = Math.max(4, Math.min(96, Math.round(Math.PI * r / 2 / CLOUDS.slot)));
    const T = 6 * N * N, d = [0, 0, 0];
    const s = { N, T, x: new Float32Array(T), y: new Float32Array(T), z: new Float32Array(T) };
    for (let f = 0; f < 6; f++) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = (f * N + j) * N + i;
      faceToDir(f, (i + 0.15 + 0.7 * hash(k, 1, 3)) / N * 2 - 1, (j + 0.15 + 0.7 * hash(k, 2, 3)) / N * 2 - 1, d);
      s.x[k] = d[0]; s.y[k] = d[1]; s.z[k] = d[2];
    }
    return s;
  }
  function setBody(id, root) {
    bodyId = id; R = BODIES[id].radius; slots = makeSlots(id); tpl.clear(); groundCache.clear(); Q.identity(); lastT = null;
    if (group.parent !== root) { if (group.parent) group.parent.remove(group); root.add(group); }
  }
  // the highest land within 180 m of a place (five places), cached by the place to 90 m (the slots drift with the wind, so
  // a slot's own number would keep the land it stood over when it was first asked)
  function mountTop(k, x, y, z) {
    const key = 'm' + Math.round(x * R / 90) + ',' + Math.round(y * R / 90) + ',' + Math.round(z * R / 90);
    if (groundCache.size > 60000) groundCache.clear();
    let g = groundCache.get(key);
    if (g == null) {
      const l = Math.hypot(x, y, z) || 1, ux = x / l, uy = y / l, uz = z / l;
      let ex = uz, ez = -ux; const el = Math.hypot(ex, ez) || 1; ex /= el; ez /= el;
      const nx = uy * ez, ny = uz * ex - ux * ez, nz = -uy * ex, a = 180 / R;
      g = -1e9;
      for (const [p, q] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const s = sampleSurfacePure(bodyId, ux + (ex * p + nx * q) * a, uy + ny * q * a, uz + (ez * p + nz * q) * a);
        if (s && s.radius) g = Math.max(g, s.radius - R);
      }
      groundCache.set(key, g);
    }
    return g;
  }
  function groundAt(k, x, y, z) {
    let g = groundCache.get(k);
    if (g == null) { const s = sampleSurfacePure(bodyId, x, y, z); g = s && s.radius ? s.radius - R : 0; groundCache.set(k, g); }
    return g;
  }

  function rebuild(camL, sunL, fields, skyU, look) {
    const t0 = performance.now();
    const W = fields && fields.wind && fields.wind.ready ? fields.wind : null;
    const C = fields && fields.cloud && fields.cloud.ready ? fields.cloud : null;
    const wx = look.weather || {};
    const fair = CLOUDS.fair != null ? CLOUDS.fair : wx.fair != null ? wx.fair : (look.cloud || 0) * 0.8;
    const baseF = wx.base || [300, 380];
    const time = G.uTime.value;
    // the eye in the drifting frame
    _qi.copy(Q).invert();
    const camD = _v.copy(camL).applyQuaternion(_qi);
    const camR = camD.length();
    const upx = camD.x / camR, upy = camD.y / camR, upz = camD.z / camR;
    const gs = sampleSurfacePure(bodyId, upx, upy, upz);
    const Rg = gs && gs.radius ? gs.radius : R;
    // how far a cloud can be seen: the eye's horizon plus a cloud top's (1.2 km up) horizon
    const reach = Math.min(9000, Math.sqrt(Math.max(0, camR * camR - Rg * Rg)) + Math.sqrt(Math.max(0, (Rg + 1200) ** 2 - Rg * Rg)));
    const cosLim = Math.cos(Math.min(Math.PI, reach / R));
    anchor.copy(camD);
    shState.Rg = Rg; shState.h = Math.max(1200, Math.min(3500, reach * 0.75));
    // (A8: as the eye climbs past the sky's ceiling the fair cumulus go, one by one by their own numbers, and the far small
    // ones first; the thunderstorms stay until the shell has taken over. From 4 km the scatter of far puffs along the limb
    // read as specks round the globe, the first stills of the hand-over.)
    const c0 = wx.ceiling ? wx.ceiling[0] : 2800;
    const handK = smooth(c0 * 0.8, c0 * 1.4, camR - Rg);
    // (the hybrid: how far the 3D cumulus have taken over from the sky's own painted cloud, by the eye's height)
    const airK = CLOUDS.hybrid ? smooth(CLOUDS.airH[0], CLOUDS.airH[1], camR - Rg) : 1;
    const shadowField = CLOUDS.shadowField && self.shadowField !== false && self.shadowK > 0 && airK < 1;
    const eyeG = Rg - R;
    self.stats.airK = airK;
    // the wind aloft at the eye, in the drifting frame (what the towers lean along)
    let we = 2.5, wn = 0.8;
    if (W) { W.at(upx, upy, upz, _wOut); we = _wOut.aloftE; wn = _wOut.aloftN; }
    const rad = OIL.uOilPx.value.x || 0.0015;
    const clouds = [];
    const S = slots;
    for (let k = 0; k < S.T; k++) {
      const sx = S.x[k], sy = S.y[k], sz = S.z[k];
      if (sx * upx + sy * upy + sz * upz < cosLim) continue;
      if (handK > 0 && hash(k, 77, 1) < handK * 1.15) continue;
      // where the slot is now, on the world
      _w.set(sx, sy, sz).applyQuaternion(Q);
      let cover, base, thick, storm = 0, conv = 1, deckK = 0;
      if (C) {
        C.at(_w.x, _w.y, _w.z, _cOut);
        conv = _cOut.conv;
        cover = Math.min(0.95, fair + _cOut.low * (0.25 + 0.75 * _cOut.conv));
        const dt = _cOut.top - _cOut.base;
        thick = dt > 40 ? dt : 0;
        base = W ? _cOut.base : groundAt(k, _w.x, _w.y, _w.z) + _cOut.base;
        storm = _cOut.storm;
        if (_cOut.low < 0.05 || thick === 0) { thick = 0; }
        thick = Math.min(thick, 900);      // (the storm's own column is the cell's, below: round it, towering cumulus)
        // (under a closed deck, seen from below it, a cumulus is hidden in it: not drawn. From above it is the deck's heaps.)
        deckK = CLOUDS.deck ? Math.min(1, smooth(0.50, 0.92, _cOut.low) * (1 - 0.45 * _cOut.conv) + 0.6 * _cOut.storm) : 0;
        if (camR < R + base && deckK > 0.85) continue;
      } else {
        const sk = skyU.uCloud.value.y;
        cover = Math.min(0.95, Math.max(fair, sk));
        thick = 0;
        base = groundAt(k, _w.x, _w.y, _w.z) + baseF[0] + (baseF[1] - baseF[0]) * hash(k, 9, 1);
      }
      // (the hybrid, below the air: a cumulus is drawn in 3D only where it is CAUGHT ON A MOUNTAIN -- the land under it
      // standing 120 to 320 m and more over the land under the eye -- its base brought down onto the slopes so the summit
      // stands up into it, and the range holding a little more cloud than the plain, as ranges do)
      let keep = airK;
      if (keep < 1) {
        const gS = W && W.land && W.land.ready ? cubeAt(W.land.H2, W.N, _w.x, _w.y, _w.z) : groundAt(k, _w.x, _w.y, _w.z);
        // (120 to 320 m: Earth's ranges stand some 400 m over the wood at most -- 444 m within 4 km of the landing, measured --
        // and 220 to 520 m caught almost none)
        const mK = smooth(120, 320, gS - eyeG);
        if (mK > 0) {
          // (the base from the HIGHEST land under the cloud's footprint, 180 m round the slot: from the land at the slot
          // alone, on a steep range the cloud stood inside the rock and none showed, the first mountain stills)
          const gM = mountTop(k, _w.x, _w.y, _w.z);
          cover = Math.min(0.95, cover + 0.22 * mK); base = Math.min(base, gM - 50 + 90 * hash(k, 9, 3)); thick = Math.min(thick, 500);
        }
        keep = Math.max(keep, mK);
        // (and a TOWERING cumulus of the map -- thick and convective, a storm in its early stages, before the map names it
        // a storm cell -- is drawn from the ground too: the weather group's land storm at 3750 s came from 3.5 km away
        // as nothing at all, the hybrid's first game stills)
        if (C) keep = Math.max(keep, smooth(350, 800, thick) * smooth(0.25, 0.6, conv));
        if (keep <= 0.001 && !shadowField) continue;
      }
      const L0 = CLOUDS.life[0], L1 = CLOUDS.life[1];
      const life = L0 + (L1 - L0) * hash(k, 3, 5);
      const ph = hash(k, 4, 5) * life;
      const gen = Math.floor((time + ph) / life), u = (time + ph) / life - gen;
      const env = smooth(0.0, 0.28, u) * (1 - smooth(0.70, 1.0, u));
      // (a slot's own number against the cover: about half the slots' share in fair weather, since a cloud covers more than
      // its slot, rising to nine tenths of it as the sky closes. MEASURED from the lobes themselves (rays over the open
      // sky above 2 degrees, the land left out): the world's fair 0.45 covers 19 per cent of it, 0.55 about 30, 0.75 about
      // half, the design's 4.4 criterion 1: fair at most 25, building 30 to 60)
      const own = hash(k, gen, 11);
      const share = smooth(own - 0.12, own + 0.12, cover * (0.62 + 0.45 * smooth(0.40, 0.80, cover))), sk = keep > 0.001 ? smooth(own - 0.12, own + 0.12, keep * cover * (0.62 + 0.45 * smooth(0.40, 0.80, cover))) : 0;
      // (a cloud the hybrid does not show is laid into the shadow map only, at the size the air would show it)
      const hidden = env * sk < 0.04 && shadowField && keep < 1;
      const s = env * (hidden ? share : sk);
      if (s < 0.04) continue;
      // its size: a fair cumulus 70 to 150 m across the base's radius, more under a fuller sky; its thickness the map's
      // (towers in a storm's cell) or a fair one's
      // (fair cumulus are wider than they are tall: humilis; a thicker map makes them towers)
      // (fewer and bigger, the review of 24 Nov: many small clouds read as stickers. A fair cumulus 110 to 240 m across its
      // shelf's radius, wider than it is tall)
      // (the look director, 24 Nov: fewer near-identical sizes -- a few large clouds among many smaller: the size skewed)
      let Rc = (95 + 230 * Math.pow(hash(k, gen, 13), 2.2)) * (0.75 + 0.5 * cover) * (0.55 + 0.45 * s) * CLOUDS.size;
      const fairT = Rc * (0.65 + 0.55 * hash(k, gen, 17));
      let T = Math.max(60, (thick > 0 ? Math.max(fairT, thick * (0.55 + 0.45 * hash(k, gen, 19)) * (0.4 + 0.6 * conv)) : fairT) * (0.5 + 0.5 * s));
      // THE SEA OF CLOUD (the owner's Aloft reference): seen from above a closed deck, a cumulus is one of the deck's own
      // HEAPS -- wide, low, its lower third sunk in the sheet -- so the deck reads as one rolling floor with the peaks out of
      // it. Drawn as whole cumulus they stood on it as a field of cotton balls, the first stills from 1.6 km.
      if (deckK > 0.6 && camR > R + base + 40) {
        const hk = smooth(0.6, 0.9, deckK);
        Rc *= 1 + 0.5 * hk; T = T + (Rc * (0.30 + 0.22 * hash(k, gen, 21)) - T) * hk; base -= T * 0.32 * hk;
      }
      // (and toward the horizon the clouds crowd into rows and merge into a band, as perspective lays them: a far cloud wider
      // and flatter, so its neighbours overlap it. Without it, from the air the far ones were separate small ovals)
      {
        const dx = sx * (R + base) - camD.x, dy = sy * (R + base) - camD.y, dz = sz * (R + base) - camD.z;
        const farK = smooth(1500, 6000, Math.hypot(dx, dy, dz));
        Rc *= 1 + 0.7 * farK; T *= 1 - 0.30 * farK;
      }
      const rb = R + base;
      // the cloud's base centre in the drifting frame, and the eye's distance to its middle
      const bx = sx * rb, by = sy * rb, bz = sz * rb;
      const cx = bx + sx * T * 0.45 - camD.x, cy = by + sy * T * 0.45 - camD.y, cz = bz + sz * T * 0.45 - camD.z;
      const dist = Math.hypot(cx, cy, cz);
      // behind the world's curve (the top of the cloud, against the datum sphere): not drawn at all
      {
        const tx = bx + sx * T - camD.x, ty = by + sy * T - camD.y, tz = bz + sz * T - camD.z;
        const tt = -(camD.x * tx + camD.y * ty + camD.z * tz) / (tx * tx + ty * ty + tz * tz);
        if (tt > 0 && tt < 1) { const mx = camD.x + tx * tt, my = camD.y + ty * tt, mz = camD.z + tz * tt; if (mx * mx + my * my + mz * mz < R * R) continue; }
      }
      if (hidden && dist > 4500) continue;      // (the shadow map covers the ground within some 3.5 km ahead of the eye)
      clouds.push({ k, gen, s, Rc, T, storm, bx, by, bz, sx, sy, sz, dist, aspect: T / Rc, hidden });
    }
    // THE THUNDERSTORMS: the cloud map's convective cells of the storm kind, each a column from the base to the top
    // (the map's own thickness at its core, about 1.8 km on Earth) with an anvil fanned downwind at the top
    if (C && C.cells && CLOUDS.mode >= 1) {
      for (let i = 0; i < (C.cells.n || 0); i++) {
        const c = C.cells[i];
        if (c.kindId !== 'storm' || !(c.w > 0.15)) continue;
        _w.set(c.x, c.y, c.z).applyQuaternion(_qi);
        const sx = _w.x, sy = _w.y, sz = _w.z;
        if (sx * upx + sy * upy + sz * upz < Math.cos(Math.min(Math.PI, (reach + 2500) / R))) continue;
        C.at(c.x, c.y, c.z, _cOut);
        const base = W ? _cOut.base : groundAt(-1 - i, c.x, c.y, c.z) + _cOut.base;
        const T = Math.max(700, _cOut.top - _cOut.base) * (0.55 + 0.45 * c.w);
        // (a BROAD tower, from the cell's own size: at 0.3 of it, seen from the coast at 3.3 km, a thin column of stacked balls
        // under a puffy top read as a mushroom cloud)
        const Rc = Math.max(Math.min(800, Math.max(300, c.r * 0.55)) * (0.7 + 0.3 * c.w), T * 0.45);
        // (the anvil grows as the storm matures and outlives the tower: weather.js lays a land storm's stage, 0 cumulus, a
        // quarter towering, a half mature, then decay; a storm with no stage is taken as mature)
        const stg = c.stage != null ? c.stage : 0.5;
        const La = (1000 + 900 * hash(c.i, c.gen, 7)) * (0.4 + 0.6 * c.w) * (0.25 + 0.75 * smooth(0.25, 0.55, stg));
        const rb = R + base, bx = sx * rb, by = sy * rb, bz = sz * rb;
        const dist = Math.hypot(bx + sx * T * 0.5 - camD.x, by + sy * T * 0.5 - camD.y, bz + sz * T * 0.5 - camD.z);
        // (the anvil streams along the storm's OWN drift, the cell's anvilE / anvilN, which on a day of swinging wind aloft can
        // be far from the wind at the eye; a cell without them takes the eye's)
        clouds.push({ k: -1 - c.i, cb: 1 + c.i, gen: c.gen, s: c.w, Rc, T, La, storm: 1, bx, by, bz, sx, sy, sz, dist, aspect: T / Rc,
          ae: c.anvilE != null ? c.anvilE : null, an: c.anvilN != null ? c.anvilN : null });
      }
    }
    clouds.sort((a, b) => a.dist - b.dist);
    // the wind's frame at the eye, turned into the drifting frame: east = Y x up, north = up x east (the physics' own)
    _e.set(upz, 0, -upx); if (_e.lengthSq() < 1e-8) _e.set(1, 0, 0); _e.normalize();
    // (the slot frames below are each slot's own; the lean is taken along the eye's wind, carried to the slot)
    for (const M of meshes) M.n = 0;
    lobes = [];
    let tris = 0;
    const budget = (QUALITY.level | 0) >= 2 ? Infinity : CLOUDS.budget;
    // one lobe into the level of detail its size on the screen asks for
    shadowOnly.n = 0;
    let hid = false;
    const emit = (px, py, pz, r, cx, cy, cz, baseD, ex, ey, ez, nx, ny, nz, pa, seed, squash, T, storm, air) => {
      const dl = Math.hypot(px - camD.x, py - camD.y, pz - camD.z);
      if (!hid && dl < r * 0.8) { lobes.push(px, py, pz, r); return; }      // (the eye inside it: not drawn, the near air whites out)
      // the level of detail: the coarsest whose outline stays within CLOUDS.sagPx of the true round on the screen
      const pr = r / Math.max(dl - r, 1) / rad;
      let li = 0; while (li < LODS.length - 1 && pr * LODS[li].sag > CLOUDS.sagPx) li++;
      if (tris > budget) li = 0;
      const M = hid ? shadowOnly : meshes[li];
      if (M.n >= (M.cap || CLOUDS.maxLobes)) return;
      const q = M.n * 4, A = M.g.attributes.iA.array, B = M.g.attributes.iB.array, Cc = M.g.attributes.iC.array, D = M.g.attributes.iD.array;
      A[q] = px - anchor.x; A[q + 1] = py - anchor.y; A[q + 2] = pz - anchor.z; A[q + 3] = r;
      B[q] = cx - anchor.x; B[q + 1] = cy - anchor.y; B[q + 2] = cz - anchor.z; B[q + 3] = baseD;
      // the strokes' pole: level, turned its own way about the cloud's up
      const ca = Math.cos(pa), sa = Math.sin(pa);
      Cc[q] = ex * ca + nx * sa; Cc[q + 1] = ey * ca + ny * sa; Cc[q + 2] = ez * ca + nz * sa; Cc[q + 3] = seed;
      D[q] = squash; D[q + 1] = T; D[q + 2] = storm; D[q + 3] = air;
      M.n++;
      if (hid) return;
      tris += M.g.index.count / 3;
      if (dl < 600 + r) lobes.push(px, py, pz, r);
    };
    for (const cl of clouds) {
      let t = tpl.get(cl.k);
      if (!t || t.gen !== cl.gen) { t = { gen: cl.gen, lobes: cl.cb ? makeStormTemplate(cl.cb, cl.gen) : makeTemplate(cl.k, cl.gen, Math.max(0.6, Math.min(6, cl.aspect))) }; tpl.set(cl.k, t); }
      // the cloud's own frame
      const ux = cl.sx, uy = cl.sy, uz = cl.sz;
      let ex = uz, ey = 0, ez = -ux; const el = Math.hypot(ex, ez) || 1; ex /= el; ez /= el;
      const nx = uy * ez - uz * ey, ny = uz * ex - ux * ez, nz = ux * ey - uy * ex;
      // the wind aloft's way here, and the lean: the shear, along it (a tower leans downwind by up to a third of its height)
      const cwe = cl.ae != null && Math.hypot(cl.ae, cl.an) > 0.3 ? cl.ae : we, cwn = cl.ae != null && Math.hypot(cl.ae, cl.an) > 0.3 ? cl.an : wn;
      const ws = Math.hypot(cwe, cwn) || 1, lean = Math.min(0.35, 0.025 * ws) * (cl.cb ? 0.4 : 1);
      const ax = (ex * cwe + nx * cwn) / ws, ay = (ey * cwe + ny * cwn) / ws, az = (ez * cwe + nz * cwn) / ws;
      const bxw = uy * az - uz * ay, byw = uz * ax - ux * az, bzw = ux * ay - uy * ax;     // across the wind
      const lx = ax * lean, ly = ay * lean, lz = az * lean;
      // how many lobes: as many as are larger than a few pixels at this distance (a storm keeps them all)
      const pxR = cl.Rc / Math.max(cl.dist, 1) / rad;
      // (a cloud under two pixels across its radius is not drawn: the air has taken it by then)
      hid = !!cl.hidden;
      if (!hid && pxR < 2 + 4 * handK) continue;
      let nl = cl.cb ? t.lobes.length : Math.max(pxR < 4 ? 1 : 2, Math.min(t.lobes.length, Math.round(t.lobes.length * smooth(6, 60, pxR))));
      if (hid) nl = Math.min(t.lobes.length, 8);
      const cxA = cl.bx + ux * cl.T * 0.45, cyA = cl.by + uy * cl.T * 0.45, czA = cl.bz + uz * cl.T * 0.45;
      const baseD = cl.T * 0.45;
      const air = Math.round(Math.min(0.45, 0.55 * (1 - Math.exp(-cl.dist / 8000))) * 5) / 5;
      const fewK = 1 + 0.35 * (1 - nl / t.lobes.length);
      for (let i = 0; i < nl; i++) {
        const o = t.lobes[i];
        const pa = hash(cl.k, cl.gen * 37 + i, 23) * Math.PI, seed = hash(cl.k, cl.gen * 41 + i, 29) * 64;
        if (o.a) {
          // an anvil lobe: along the wind from the tower, fanned across it, flattened; its centre the anvil's, high up
          const y = o.y * cl.T, r = o.r * cl.La;
          const px = cl.bx + (ax * o.x + bxw * o.z) * cl.La + ux * y, py = cl.by + (ay * o.x + byw * o.z) * cl.La + uy * y, pz = cl.bz + (az * o.x + bzw * o.z) * cl.La + uz * y;
          const ac = 0.45 * cl.La, cy0 = cl.T * 0.94;
          emit(px, py, pz, r, cl.bx + ax * ac + ux * cy0, cl.by + ay * ac + uy * cy0, cl.bz + az * ac + uz * cy0, cl.T * 0.06 + r * 0.2, ex, ey, ez, nx, ny, nz, pa, seed, 0.20, cl.T, 1, air);
          continue;
        }
        const y = o.y * cl.T;
        // (a far cloud drawn with its first few lobes, the shelf's: they are laid a little wider to keep its size; perspective
        // flattens it into a strip by itself. Squashed further, a far cloud seen from below was all flat base: a grey saucer)
        const r = Math.max(4, o.r * cl.Rc * (cl.cb ? 1 : fewK));
        const sqz = cl.cb ? 0.92 : Math.min(0.95, (o.sq || 0.9) * (1 + 0.6 * (fewK - 1)));
        const px = cl.bx + ex * o.x * cl.Rc + nx * o.z * cl.Rc + ux * y + lx * y;
        const py = cl.by + ey * o.x * cl.Rc + ny * o.z * cl.Rc + uy * y + ly * y;
        const pz = cl.bz + ez * o.x * cl.Rc + nz * o.z * cl.Rc + uz * y + lz * y;
        emit(px, py, pz, r, cxA, cyA, czA, baseD, ex, ey, ez, nx, ny, nz, pa, seed, sqz, cl.T, cl.storm, air);
      }
    }
    hid = false;
    for (const M of [...meshes, shadowOnly]) {
      for (const k of ['iA', 'iB', 'iC', 'iD']) { const a = M.g.attributes[k]; a.clearUpdateRanges(); a.addUpdateRange(0, M.n * 4); a.needsUpdate = true; }
      M.g.instanceCount = M.n;
      if (M.mesh) M.mesh.visible = M.n > 0;
    }
    self.stats.shadowLobes = shadowOnly.n;
    group.position.set(0, 0, 0);
    for (const M of meshes) if (M.mesh) M.mesh.position.copy(anchor);
    if (shadowOnly.mesh) shadowOnly.mesh.position.copy(anchor);
    // THE SHEETS (A3 the deck, A5 the valley cloud), every second rebuild: the map itself refreshes twice a second
    {
      const ws = Math.hypot(we, wn) || 1;
      own.uDeckWind.value.set((_e.x * we + (upy * _e.z - upz * _e.y) * wn) / ws, (_e.y * we + (upz * _e.x - upx * _e.z) * wn) / ws, (_e.z * we + (upx * _e.y - upy * _e.x) * wn) / ws).normalize();
    }
    if ((sheetTick++ & 1) === 0) {
      const eyeG = Rg - R;
      const deckFn = (x, y, z, o) => {
        _w2.set(x, y, z).applyQuaternion(Q);
        if (C) {
          C.at(_w2.x, _w2.y, _w2.z, _cOut2);
          o.cover = Math.min(1, smooth(0.50, 0.92, _cOut2.low) * (1 - 0.45 * _cOut2.conv) + 0.6 * _cOut2.storm);
          o.base = W ? _cOut2.base : eyeG + _cOut2.base;
          o.thick = Math.max(150, Math.min(600, _cOut2.top - _cOut2.base));
          o.storm = _cOut2.storm;
        } else {
          o.cover = Math.max(smooth(0.62, 0.92, skyU.uCloud.value.y), smooth(0.30, 0.80, skyU.uWxSky.value.x));
          o.base = eyeG + baseF[0] - 80; o.thick = 400; o.storm = skyU.uWxSky.value.y;
        }
      };
      const vForce = CLOUDS.valley > 1 ? Math.min(1, CLOUDS.valley - 1) : 0;
      const valleyFn = (x, y, z, o) => {
        _w2.set(x, y, z).applyQuaternion(Q);
        let cov = vForce;
        if (C && !vForce) { C.at(_w2.x, _w2.y, _w2.z, _cOut2); cov = _cOut2.valley || 0; }
        o.cover = cov; o.thick = 50; o.storm = 0;
        o.base = W && W.land && W.land.ready ? cubeAt(W.land.H2, W.N, _w2.x, _w2.y, _w2.z) - 40 : eyeG + 15;
      };
      for (const [sh, on, fn, span] of [[deck, CLOUDS.deck, deckFn, Math.min(reach, 7000)], [valley, CLOUDS.valley > 0, valleyFn, 2500]]) {
        if (!on) { sh.any = false; continue; }
        if (sh.needsPlace(upx, upy, upz, span)) sh.place(upx, upy, upz, span, R);
        sh.anchor.copy(camD);
        sh.fill(fn, sh.anchor, camD, R);
        sh.u.uAnchorD.value.copy(sh.anchor);
        if (sh.mesh) { sh.mesh.position.copy(sh.anchor); sh.mesh.visible = sh.any; }
      }
      // the deck at the eye (the eye inside it whites out, below)
      deckFn(upx, upy, upz, _cOut3);
      eyeDeck.base = _cOut3.base; eyeDeck.top = _cOut3.base + _cOut3.thick; eyeDeck.cover = CLOUDS.deck ? _cOut3.cover : 0;
    }
    deck.u.uShellK.value.y = R; valley.u.uShellK.value.y = R;
    own.uAnchorD.value.copy(anchor);
    // the sky's own shell becomes the far background, the altocumulus, a kilometre over the land under the eye (sky.js uCloud3D)
    // (x: how far the 3D cumulus have taken over, 0 on the ground in the hybrid: the sky's own cloud exactly as it was;
    // w: 1 while this module draws, for what the sky adds with it whatever the height -- the high cloud)
    if (skyU.uCloud3D) skyU.uCloud3D.value.set(airK, Rg + (wx.alto != null ? wx.alto : 1000), wx.altoShare != null ? wx.altoShare : 0.45, 1);
    // the high cloud lies the way the wind aloft blows (sky.js A4), and a rainbow may stand where the map has rain (A9)
    if (skyU.uCirrus) {
      let ex = upz, ez = -upx; const el = Math.hypot(ex, ez) || 1; ex /= el; ez /= el;
      const nx = upy * ez, ny = upz * ex - upx * ez, nz = -upy * ex;
      _w2.set(ex * we + nx * wn, ny * wn, ez * we + nz * wn).applyQuaternion(Q);      // (drifting frame -> the body's)
      if (_w2.lengthSq() < 1e-8) _w2.set(1, 0, 0);
      _w2.normalize();
      skyU.uCirrus.value.set(_w2.x, _w2.y, _w2.z, CLOUDS.cirrus ? (wx.cirrus != null ? wx.cirrus : 0.25) : -1);
    }
    if (skyU.uRainbow) skyU.uRainbow.value.set(C && wx.rainbow !== 0 ? 1 : 0, 1500, 0, 0);
    // the look director's audit items in the sky (sky.js uSkyFix; ?skyfix=0 leaves the sky as it was): on with the clouds,
    // and from the air the sky laid in brush strokes, from 150 m up to their full from 800 m
    // (y, the sky laid in strokes from the air: OFF in rework 2 -- from 1 km the strokes read as dark blue blotches over the
    // sky, seen with ?skyfix=0 against 1. ?skystrokes=1 brings them back for the look director)
    if (skyU.uSkyFix) skyU.uSkyFix.value.set(CLOUDS.skyfix ? 1 : 0, CLOUDS.skyfix && CLOUDS.skyStrokes ? 0.45 * smooth(150, 800, camR - Rg) : 0, 0, 0);
    own.uGroundR.value = R + (look.weather && look.weather.shadowGround != null ? look.weather.shadowGround : 250);
    self.stats.clouds = clouds.reduce((a, c) => a + (c.hidden ? 0 : 1), 0); self.stats.lobes = meshes.reduce((a, M) => a + M.n, 0); self.stats.tris = tris;
    self.stats.ms = performance.now() - t0;

  }

  // A6: the shadow map, drawn every second frame before the scene (render/index.js through shared.js PREPASSES, or
  // world.clouds.renderShadow(renderer): WEATHER-DESIGN 8.4 T5). Nothing is drawn at night, nor with the speed test's
  // row 'storm: no cloud shadows' (WX.uCloudShadowK 0): the map then reads no shadow anywhere.
  self.renderShadow = function renderShadow(renderer, scene0) {
    const root = group.parent;
    const live = root && group.visible && mat && shState.has && self.shadowK > 0 && shState.sun.dot(shState.centre) > 0.02 * shState.centre.length();
    if (!live) { if (shState.on) { WX.uCloudShadowM.value.copy(NO_SHADOW); WX.uCloudShadowV.value.copy(NO_SHADOW); shState.on = false; } WX.uCloudShadowK.value = 0; return; }
    if ((shState.frame++ & 1) && shState.on) return;
    const sc = scene0 || scene;
    if (!sc) return;
    if (!shState.mats) {
      const lobeM = new THREE.ShaderMaterial({ name: 'pc-cloud-shadow-lobes', uniforms: { uNoise3D: G.uNoise3D, uAnchorD: own.uAnchorD }, vertexShader: SHADOW_LOBE_VERT, fragmentShader: SHADOW_FRAG, side: THREE.DoubleSide });
      const sheetM = (sh) => new THREE.ShaderMaterial({ name: 'pc-cloud-shadow-sheet', uniforms: { uNoise3D: G.uNoise3D, uAnchorD: sh.u.uAnchorD, uShellK: sh.u.uShellK }, vertexShader: SHADOW_SHEET_VERT, fragmentShader: SHADOW_SHEET_FRAG, side: THREE.DoubleSide });
      shState.mats = new Map();
      for (const M of meshes) shState.mats.set(M.mesh, lobeM);
      if (shadowOnly.mesh) shState.mats.set(shadowOnly.mesh, lobeM);
      shState.mats.set(deck.mesh, sheetM(deck));
      shState.mats.set(valley.mesh, sheetM(valley));
    }
    // the camera: in the body's frame, high along the sun over the ground the eye looks at, looking down the light
    const c = _st.copy(shState.centre).addScaledVector(shState.fwd, shState.h * 0.45);
    _sp.copy(c).addScaledVector(shState.sun, 9000);
    _su.copy(shState.centre).normalize();
    if (Math.abs(_su.dot(shState.sun)) > 0.99) _su.set(1, 0, 0);
    shBody.lookAt(_sp, c, _su); shBody.setPosition(_sp);
    shBodyInv.copy(shBody).invert();
    const h = shState.h;
    shCam.left = -h; shCam.right = h; shCam.top = h; shCam.bottom = -h; shCam.updateProjectionMatrix();
    root.updateMatrixWorld();
    shCam.matrixWorld.multiplyMatrices(root.matrixWorld, shBody); shCam.matrixWorldInverse.copy(shCam.matrixWorld).invert();
    shM.multiplyMatrices(shCam.projectionMatrix, shBodyInv).premultiply(BIAS);
    // the clouds' own materials out, the shadow's in; drawn alone (the camera sees only their layer)
    const swapped = [];
    for (const [mesh, m] of shState.mats) if (mesh) { swapped.push(mesh, mesh.material); mesh.material = m; }
    const prevT = renderer.getRenderTarget(), prevAuto = renderer.autoClear, prevA = renderer.getClearAlpha();
    renderer.getClearColor(_cc);
    try {
      renderer.setRenderTarget(shadowRT);
      renderer.setClearColor(0x000000, 0); renderer.clear(true, false, false);
      renderer.autoClear = false;
      renderer.render(sc, shCam);
    } finally {
      for (let i = 0; i < swapped.length; i += 2) swapped[i].material = swapped[i + 1];
      renderer.setRenderTarget(prevT); renderer.autoClear = prevAuto; renderer.setClearColor(_cc, prevA);
    }
    WX.uCloudShadow.value = shadowRT.texture;
    WX.uCloudShadowM.value.copy(shM);
    WX.uCloudShadowK.value = self.shadowK;
    shState.on = true;
  };
  // (the frame hook, at the start of every render: the eye's view space to the map, for a pass over the picture, and
  //  which way the eye looks, so the square is laid over the ground in front of it)
  const _cf = new THREE.Vector3();
  if (SHARED.FRAME_HOOKS) SHARED.FRAME_HOOKS.push((camera) => {
    const root = group.parent;
    if (!root || !shState.on || !WX.uCloudShadowV) return;
    root.updateMatrixWorld();
    shRootInv.copy(root.matrixWorld).invert();
    WX.uCloudShadowV.value.multiplyMatrices(shM, shRootInv).multiply(camera.matrixWorld);
    camera.getWorldDirection(_cf).transformDirection(shRootInv);
    const up = _sx.copy(shState.centre).normalize();
    _cf.addScaledVector(up, -_cf.dot(up));
    if (_cf.lengthSq() > 1e-6) shState.fwd.copy(_cf.normalize());
  });
  if (SHARED.PREPASSES) SHARED.PREPASSES.push((renderer, sc) => self.renderShadow(renderer, sc));

  // (for a still of the lightning: a list shaped as fields.cloud.flashes, { n, 0: { x, y, z, base, kind, flash01 } }, used in
  //  place of the map's while set; null in play)
  self.flashTest = null;
  self.update = function update(dt, camL, root, sunL, fields, skyU) {
    if (!LOOK.oil || !CLOUDS.mode) return;
    // (the speed test's row 'weather: clouds as before': the sky's own flat cloud back in their place)
    if (self.enabled === false) { group.visible = false; if (skyU && skyU.uCloud3D) { skyU.uCloud3D.value.x = 0; skyU.uCloud3D.value.w = 0; } if (skyU && skyU.uRainbow) skyU.uRainbow.value.x = 0; if (skyU && skyU.uSkyFix) skyU.uSkyFix.value.set(0, 0, 0, 0); return; }
    const id = root && root.name && root.name.startsWith('body-') ? root.name.slice(5) : null;
    if (!id || !BODIES[id]) return;
    const look = getLook(id);
    if (!(BODIES[id].atmosphereHeight > 0) || !(look.cloud > 0.01 || (look.weather && look.weather.cumulus))) { group.visible = false; if (skyU && skyU.uCloud3D) { skyU.uCloud3D.value.x = 0; skyU.uCloud3D.value.w = 0; } if (skyU && skyU.uRainbow) skyU.uRainbow.value.x = 0; if (skyU && skyU.uSkyFix) skyU.uSkyFix.value.set(0, 0, 0, 0); return; }
    group.visible = true;
    if (id !== bodyId || group.parent !== root) setBody(id, root);
    if (!mat) {
      mat = makeCloudMaterial(skyU, own);
      for (const [sh, kind] of [[deck, 0], [valley, 1]]) {
        const m = makeShellMaterial(skyU, { ...own, uAnchorD: sh.u.uAnchorD, uCamD: sh.u.uCamD, uShellK: sh.u.uShellK }, kind);
        if (kind) valleyMat = m; else deckMat = m;
        sh.mesh = new THREE.Mesh(sh.g, m);
        sh.mesh.name = sh.name;
        sh.mesh.frustumCulled = false;
        sh.mesh.renderOrder = 11;
        sh.mesh.layers.enable(CLOUD_LAYER);
        sh.mesh.visible = false;
        group.add(sh.mesh);
      }
      for (const M of meshes) {
        M.mesh = new THREE.Mesh(M.g, mat);
        M.mesh.name = 'pc-cloud-lobes-' + M.lod.detail;
        M.mesh.frustumCulled = false;
        M.mesh.renderOrder = 10;        // after the ground (5), before the sky (1000)
        M.mesh.layers.enable(CLOUD_LAYER);
        M.mesh.visible = false;
        group.add(M.mesh);
      }
      shadowOnly.mesh = new THREE.Mesh(shadowOnly.g, mat);
      shadowOnly.mesh.name = 'pc-cloud-shadowfield';
      shadowOnly.mesh.frustumCulled = false;
      shadowOnly.mesh.layers.set(CLOUD_LAYER);      // (the shadow's layer ONLY: never in the picture)
      shadowOnly.mesh.visible = false;
      group.add(shadowOnly.mesh);
    }
    // THE DRIFT: the whole field turns about the planet's centre with the wind aloft at the eye, on the painter's clock
    // (a held picture holds still)
    const t = G.uTime.value;
    const dT = lastT == null ? 0 : Math.max(0, Math.min(1, t - lastT));
    lastT = t;
    if (dT > 0) {
      const W = fields && fields.wind && fields.wind.ready ? fields.wind : null;
      const cl = camL.length(), ux = camL.x / cl, uy = camL.y / cl, uz = camL.z / cl;
      let we = 2.5, wn = 0.8;
      if (W) { W.at(ux, uy, uz, _wOut); we = _wOut.aloftE; wn = _wOut.aloftN; }
      let ex = uz, ez = -ux; const el = Math.hypot(ex, ez) || 1; ex /= el; ez /= el;
      const nx = uy * ez, ny = uz * ex - ux * ez, nz = -uy * ex;
      const vx = ex * we + nx * wn, vy = ny * wn, vz = ez * we + nz * wn;
      // the axis of the turn: up x wind
      _w.set(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
      const sp = _w.length();
      if (sp > 1e-6) { _qs2.setFromAxisAngle(_w.multiplyScalar(1 / sp), sp * dT / R); Q.premultiply(_qs2); }
    }
    group.quaternion.copy(Q);
    // A8: the cloud shell seen from outside (orbit.js) reads the same map and comes in as the eye climbs past the sky's
    // ceiling; the 3D clouds are left out above it (they are small and far below by then, and the shell covers them)
    {
      const shell = root.getObjectByName('pc-cloudshell');
      const altG = camL.length() - (shState.Rg || R);
      const c0 = (look.weather && look.weather.ceiling) ? look.weather.ceiling[0] : 2800;
      const hand = smooth(c0, c0 * 1.6, altG);
      if (shell && shell.material.uniforms.uWx3D) shell.material.uniforms.uWx3D.value.set(1, hand, 0, 0);
      if (hand >= 0.999) { group.visible = false; return; }
    }
    since += dt;
    const wall = performance.now();
    if (since >= CLOUDS.rebuild || wall - lastWall > CLOUDS.rebuild * 4000) { since = 0; lastWall = wall; rebuild(camL, sunL, fields, skyU, look); }
    // what the shaders need every frame, in the drifting frame
    _qi.copy(Q).invert();
    own.uCloudSun.value.copy(sunL).applyQuaternion(_qi).normalize();
    shState.sun.copy(sunL).normalize();
    shState.centre.copy(camL).normalize().multiplyScalar(shState.Rg);
    shState.has = true;
    own.uCamD.value.copy(camL).applyQuaternion(_qi).sub(anchor);
    for (const sh of [deck, valley]) sh.u.uCamD.value.copy(camL).applyQuaternion(_qi).sub(sh.anchor);
    // the lightning: the four brightest flashes near the eye, a light in their clouds a few hundred metres over the base
    {
      const Cf = self.flashTest ? self.flashTest : fields && fields.cloud && fields.cloud.flashes ? fields.cloud.flashes : null, F = own.uFlash.value;
      for (const v of F) v.w = 0;
      if (Cf && Cf.n) {
        const pick = [];
        for (let i = 0; i < Cf.n; i++) if (Cf[i].flash01 > 0.02) pick.push(Cf[i]);
        pick.sort((a, b) => b.flash01 - a.flash01);
        for (let i = 0; i < Math.min(4, pick.length); i++) {
          const f = pick[i], h = R + (f.base || 300) + (f.kind === 'ic' ? 650 : 280);
          _w2.set(f.x, f.y, f.z).normalize().multiplyScalar(h).applyQuaternion(_qi);
          F[i].set(_w2.x, _w2.y, _w2.z, f.flash01);
        }
      }
    }
    // the eye in a cloud: the deepest it stands inside any lobe near it (the near air whites out, world/index.js)
    let inK = 0;
    const cd = _v.copy(camL).applyQuaternion(_qi);
    for (let i = 0; i < lobes.length; i += 4) {
      const d = Math.hypot(cd.x - lobes[i], cd.y - lobes[i + 1], cd.z - lobes[i + 2]) / lobes[i + 3];
      if (d < 1.05) inK = Math.max(inK, smooth(1.05, 0.65, d));
    }
    // and inside the deck: between its base and its top where it is closed
    if (eyeDeck.cover > 0.3) {
      const a = camL.length() - R;
      inK = Math.max(inK, smooth(0.3, 0.8, eyeDeck.cover) * smooth(eyeDeck.base - 10, eyeDeck.base + 25, a) * (1 - smooth(eyeDeck.top - 25, eyeDeck.top + 10, a)));
    }
    self.eyeInCloud01 = inK;
  };
  void scene; void _gf; void _matId;
  return self;
}
