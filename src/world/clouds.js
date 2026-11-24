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
// TONES (the lit top, a half-tone, the belly, the deep belly) and a thin rim where the sun is behind a thin edge, built
// from the world's own keys exactly as the sky's own painted cloud is (sky.js), so every world and every hour keeps its
// palette. The tone is chosen once per STROKE (the look's own thin strokes, chunks.js pcThinLayer, laid on each lobe's
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
//   ?cloudlobes=  the lobes' bend toward the cloud's centre (0 balls .. 1 one mass; 0.72)
//   ?cloudslot=   the lattice's spacing in metres (220)
//   ?cloudfair=   the fair-weather share where the map says nothing (default: the world's own)
//   ?cloudsize=   a multiple of the clouds' size (1)
//   ?deck=0       no deck (A3);  ?valleycloud=0 no valley cloud (A5; 1.6 forces a cover of 0.6, for looking before the map
//                 carries its valley channel)
import * as THREE from 'three';
import { G, OIL, LOOK, register, ensureGlobals } from '../render/shared.js';
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
  lobeBend: Math.max(0, Math.min(1, _qn('cloudlobes', 0.72))),
  slot: Math.max(80, _qn('cloudslot', 220)),
  fair: _qs && _qs.has('cloudfair') ? Math.max(0, Math.min(1, _qn('cloudfair', 0.35))) : null,
  size: Math.max(0.2, _qn('cloudsize', 1)),
  deck: _qn('deck', 1) > 0,                      // ?deck=0: no deck (A3)
  valley: _qn('valleycloud', 1),                 // ?valleycloud=0: none; a number over 1 forces that much cover (0..1 as v - 1), for looking (A5)
  rebuild: 0.25,          // s between rebuilds of the instances (the drift itself is the group's turn, every frame)
  maxLobes: 6144,         // instances a level of detail holds at most
  sagPx: 1.4,             // how far a lobe's outline may stand off the true round, in pixels, before the next level is taken
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
  // the painted normal: the lobe's own, bent toward the direction from a point a little below the cloud's centre (so the
  // top reads round and the sides turn down), and on the base straight down
  vec3 cen = iB.xyz - up * iB.w * 0.35;
  vec3 nl = normalize(off + up * dot(off, up) * (1.0 - iD.x));
  vec3 np = normalize(mix(nl, normalize(p - cen), uCloudBend));
  vNP = normalize(mix(np, -up, base));
  vNV = normalMatrix * vNP;
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
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
  ${VERT_END}
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
  // the light, asked at the stroke's centre (the normal and the height carried there)
  vec3 nS = normalize(PC_AT(n, ds));
  float hS = clamp(PC_AT(vK.y, ds), 0.0, 1.0);
  float sunK = clamp(PC_AT(vAirSun.y, ds), 0.0, 1.0);
  vec3 sun = normalize(uCloudSun);
  float lam = dot(nS, sun);
  float down = smoothstep(0.55, 0.85, -dot(nS, normalize(vUp)));
  // (the light across the form, as far as the sun reaches; the lower sides a little deeper; the flat base never deeper
  // than the belly, which is lit by the sky and the land below it: the deepest paint is for the sides turned away)
  float x = (lam * 0.5 + 0.5) * mix(0.42, 1.0, sunK) - (1.0 - smoothstep(0.0, 0.40, hS)) * 0.10 * (1.0 - down);
  x = mix(x, max(x, 0.25), down);
  // (and a painter's cloud is lit from above whatever the hour: what faces up takes a share of the light, sky.js does
  // the same; with the sun behind the clouds, as most of the stations look, the first stills were all belly)
  x += 0.14 * max(dot(nS, normalize(vUp)), 0.0) * uAtmo.y;
  float xN = x + (rndN.z - 0.5) * 0.10;
  x += (rnd.z - 0.5) * 0.10;
  // the rim: an edge seen nearly side-on, with the sun behind the cloud, catches the light through its thin edge
  float side = 1.0 - abs(dot(nS, vdir));
  float behind = smoothstep(0.15, 0.75, dot(sun, vdir)) * sunK * uAtmo.y;
  float rim = step(0.86, side + (rnd.y - 0.5) * 0.08) * step(0.3, behind) * step(rnd.x, 0.75);
  // (a cloud's outline against the sky is never its deepest paint: seen from below with the sun behind the eye, the far
  // side of every lobe turned away and laid a dark crescent round it, which read as an outline; the thin edge is a
  // half-tone, as the sky's own cloud lets its thin edges be light)
  float sil = smoothstep(0.80, 0.90, side) * (1.0 - 0.6 * down);
  x = mix(x, max(x, 0.46), sil); xN = mix(xN, max(xN, 0.46), sil);
  // (the base seen from below is not one flat lilac: a stroke in six or so takes the half-tone, the light the land
  // throws back up into it, as a painter flecks a cloud's belly; the first stills' bases were cut-outs)
  x = mix(x, max(x, 0.46), down * step(rnd.x, 0.16)); xN = mix(xN, max(xN, 0.46), down * step(rndN.x, 0.16));
  // THE FOUR TONES (sky.js THE CLOUD'S THREE TONES, and a deeper one): the lit top a neutral grey-white 0.78 with a
  // breath of the light; the half-tone the world's cloud-shadow key; the belly that key with a third of the sky's own
  // middle in it; the deep belly a step below in value, a fifth to its grey
  vec3 sunC = mix(pow(uLight, vec3(uOilA.z)), vec3(1.0, 0.84, 0.52), 0.75 * pcGold());
  vec3 midS = mix(pcCloudDens(uSkyZenith, 1.0 + 0.45 * uAtmo.y), uSkyHorizon, 0.62);
  vec3 cTop = mix(vec3(0.78, 0.78, 0.785), uSkyHorizon, 0.18) * mix(vec3(1.0), sunC, 0.30);
  vec3 cHalf = pcCloudDens(uCloudShade, 1.65);
  cHalf = mix(cHalf, vec3(dot(cHalf, vec3(0.3, 0.5, 0.2))), 0.24);
  // (the belly: the half-tone a step deeper with a little of the sky's middle in it, and pulled toward its grey: laid
  // with a third of the sky's blue it was a periwinkle flat across every base seen from below, the first stills)
  vec3 cBase = mix(pcCloudDens(cHalf, 1.25), midS, 0.14);
  cBase = mix(cBase, vec3(dot(cBase, vec3(0.3, 0.5, 0.2))), 0.22);
  vec3 cDeep = mix(pcCloudDens(cBase, 1.7), vec3(dot(cBase, vec3(0.3, 0.5, 0.2)) * 0.62), 0.24);
  vec3 cRim = min(mix(cTop, sunC, 0.45) * 1.06, vec3(0.86));
  // a storm's cloud: the bellies go to the world's heavy-weather pigment, the tops a half-tone
  float st = clamp(max(vK.z, uWxSky.y), 0.0, 1.0);
  cDeep = mix(cDeep, pcCloudDens(uStormWash, 1.30), st * 0.85);
  cBase = mix(cBase, pcCloudDens(uStormWash, 1.15), st * 0.70);
  cTop = mix(cTop, mix(cHalf, cTop, 0.55), st * 0.6);
  // (the deep belly only well round the shaded side: at 0.16 it lay as a dark crescent along every lobe's join seen
  // from below, which read as an outline, the stills of 24 Nov)
  vec3 c1 = x > 0.54 ? cTop : x > 0.38 ? cHalf : x > 0.09 ? cBase : cDeep;
  vec3 c2 = xN > 0.54 ? cTop : xN > 0.38 ? cHalf : xN > 0.09 ? cBase : cDeep;
  c1 = mix(c1, cRim, rim);
  vec3 c = mix(c2, c1, own);
  // by night a cloud is a flat shape a step lighter than the sky it lies in, with no lit side (sky.js, the oil night)
  vec3 nightC = mix(mix(uSkyZenith, uSkyHorizon, 0.5), uSkyHorizon, 0.30) * (0.92 + 0.10 * hS);
  c = mix(nightC, c, uAtmo.y);
  // THE CLOUD'S OWN AIR: a far cloud goes toward the sky's low band in flat steps, one step for the whole cloud (the
  // land's air, pcFogAmount, would swallow it: the ground's visibility is a few hundred metres, a cloud's kilometres)
  vec3 farC = mix(uSkyHorizon, vec3(0.48, 0.50, 0.63), uOilS.x * 0.6);
  c = mix(c, farC, vAirSun.x);
  c = pcCloudCap(c, uSkyOil.y);
  vec3 nV = normalize(vNV);
  pcWrite(c, 0.0, nV, -vView.z, 0.02 + 0.5 * fract(vK.w * 3.7));
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
  vec3 qh = vPosD / (uShellK.z * 2.4);
  float hm = texture(uNoise3D, qh + 0.53).b * 0.78 + texture(uNoise3D, qh * 2.3 + 0.11).r * 0.22;
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
  vec3 sunC = mix(pow(uLight, vec3(uOilA.z)), vec3(1.0, 0.84, 0.52), 0.75 * pcGold());
  vec3 midS = mix(pcShDens(uSkyZenith, 1.0 + 0.45 * uAtmo.y), uSkyHorizon, 0.62);
  vec3 cTop = mix(vec3(0.78, 0.78, 0.785), uSkyHorizon, 0.18) * mix(vec3(1.0), sunC, 0.30);
  vec3 cHalf = pcShDens(uCloudShade, 1.65);
  cHalf = mix(cHalf, vec3(dot(cHalf, vec3(0.3, 0.5, 0.2))), 0.24);
  vec3 cBase = mix(pcShDens(cHalf, 1.25), midS, 0.14);
  cBase = mix(cBase, vec3(dot(cBase, vec3(0.3, 0.5, 0.2))), 0.22);
  vec3 cDeep = mix(pcShDens(cBase, 1.7), vec3(dot(cBase, vec3(0.3, 0.5, 0.2)) * 0.62), 0.24);
  float st = clamp(max(vDeck.z, uWxSky.y * (1.0 - uShellK.x)), 0.0, 1.0);
  vec3 sDeep = pcShDens(uStormWash, 1.32), sBase = pcShDens(uStormWash, 1.15), sHalf = mix(pcShDens(uStormWash, 0.85), cHalf, 0.35);
  cDeep = mix(cDeep, sDeep, st * 0.85);
  cBase = mix(cBase, sBase, st * 0.70);
  cHalf = mix(cHalf, sHalf, st * 0.60);
  float jit = (rnd.y - 0.5) * 0.10;
  vec3 c;
  if (below > 0.5) {
    // FROM BELOW: the ROLLS, three flat tones laid by the mass itself (the thin of the roll a half-tone, its body the
    // belly, its heaviest the deep), a storm a step heavier throughout; the thin edges of a gap lit when the sun is over
    // the sheet (the light comes through them)
    float x = mS + jit + 0.18 * st;
    c = x > 0.66 ? cDeep : x > 0.42 ? cBase : cHalf;
    float rim = (1.0 - smoothstep(0.0, 0.08, eS)) * step(0.0, se) * sunK * uAtmo.y * (1.0 - 0.7 * st);
    c = mix(c, mix(cTop, sunC, 0.25), step(0.5, rim + (rnd.x - 0.5) * 0.4));
  } else {
    // FROM ABOVE: a lit top in heaps (the mass is its relief), the hollows a half-tone; the sun's height lights the whole
    float thick = clamp(eS / 0.30, 0.0, 1.0);
    float x = (0.55 + 0.45 * se) * mix(0.35, 1.0, sunK) + (mS - 0.5) * 0.40 + jit;
    c = x > 0.50 ? cTop : x > 0.30 ? cHalf : cBase;
  }
  float thick = clamp(eS / 0.30, 0.0, 1.0);
  // the valley cloud: a low white mist, lit, its shade a little cool (no belly: it is seen from above and from its side)
  if (uShellK.x > 0.5) c = mix(c, mix(cTop, cHalf, step(0.62, thick + jit) * 0.5), 0.75);
  vec3 nightC = mix(mix(uSkyZenith, uSkyHorizon, 0.5), uSkyHorizon, 0.30) * (0.90 + 0.12 * thick);
  c = mix(nightC, c, uAtmo.y);
  // the sheet's own air, in flat steps of the distance (the land's air would swallow it)
  float af = floor(min(0.6, 0.62 * (1.0 - exp(-dist / 7000.0))) * 5.0 + 0.5) / 5.0;
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
      uShellK: own.uShellK,
      uSkyZenith: skyU.uSkyZenith, uSkyHorizon: skyU.uSkyHorizon, uCloudShade: skyU.uCloudShade, uStormWash: skyU.uStormWash,
      uWxSky: skyU.uWxSky, uSkyOil: skyU.uSkyOil, uAtmo: skyU.uAtmo,
    }),
    vertexShader: SHELL_VERT, fragmentShader: SHELL_FRAG,
    side: THREE.DoubleSide,
  });
  m.userData.pcPainted = true;
  return register(m, 'cloud-sheet', { kind });
}

// ---- numbers from a slot -----------------------------------------------------------------------------------------------
function hash(a, b, c) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// A cloud's lobes in its own units (x, z across in units of its radius; y up in units of its thickness; r in units of its
// radius), the core first: a far cloud draws the first few. aspect: thickness over radius at birth.
function makeTemplate(slot, gen, aspect) {
  const L = [];
  const K = Math.max(2, Math.min(7, Math.round(aspect / 0.62)));     // tiers from base to top
  const H = (j) => hash(slot, gen * 131 + j, 77);
  let j = 0;
  for (let k = 0; k < K; k++) {
    const f = K > 1 ? k / (K - 1) : 0;
    const n = Math.max(1, Math.round(5.2 - 3.6 * f + (H(j++) - 0.5) * 1.5));
    const ring = 0.56 - 0.36 * f;
    const rr = 0.46 - 0.16 * f;
    const a0 = H(j++) * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i + (H(j++) - 0.5) * 0.6) * Math.PI * 2 / n;
      const rg = ring * (0.75 + 0.5 * H(j++));
      L.push({ x: Math.cos(a) * rg, z: Math.sin(a) * rg, y: (k === 0 ? 0.02 : 0.10 + 0.70 * f) + (H(j++) - 0.5) * 0.06, r: rr * (0.82 + 0.36 * H(j++)), k });
    }
  }
  // the cap: one lobe on top, a little off the middle
  L.push({ x: (H(j++) - 0.5) * 0.3, z: (H(j++) - 0.5) * 0.3, y: 0.86, r: 0.30 + 0.08 * H(j++), k: K });
  // the core first (biggest, lowest, nearest the middle), the small heaped lobes last
  L.sort((a, b) => (b.r - 0.25 * Math.hypot(a.x, a.z) - 0.1 * a.k) - (a.r - 0.25 * Math.hypot(b.x, b.z) - 0.1 * b.k));
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
    const n = Math.max(2, Math.round(6 - 3 * f + (H(j++) - 0.5)));
    const ring = 0.52 - 0.22 * f, rr = 0.50 - 0.12 * f;
    const a0 = H(j++) * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i + (H(j++) - 0.5) * 0.6) * Math.PI * 2 / n;
      const rg = ring * (0.7 + 0.5 * H(j++));
      L.push({ x: Math.cos(a) * rg, z: Math.sin(a) * rg, y: (k === 0 ? 0.01 : 0.04 + 0.80 * f) + (H(j++) - 0.5) * 0.03, r: rr * (0.85 + 0.3 * H(j++)), k, a: 0 });
    }
  }
  // the anvil: about a dozen flattened lobes from just upwind of the tower to its far edge, fanning out
  const NA = 13;
  for (let i = 0; i < NA; i++) {
    const t = i / (NA - 1);
    const x = -0.10 + 1.08 * t + (H(j++) - 0.5) * 0.08;
    const half = 0.10 + 0.30 * t;
    const z = (H(j++) - 0.5) * 2 * half;
    L.push({ x, z, y: 0.93 + (H(j++) - 0.5) * 0.04 - 0.03 * t, r: 0.13 + 0.07 * H(j++) + 0.05 * (1 - t), k: K + 1, a: 1 });
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
  const anchor = new THREE.Vector3();
  const self = {
    eyeInCloud01: 0, enabled: true,
    group, meshes, deck, valley, stats: { clouds: 0, lobes: 0, tris: 0, ms: 0 },
    // (A6, step 3: the cloud shadow map; render/index.js asks for it before the main render, WEATHER-DESIGN 8.4 T5)
    renderShadow() {},
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
    // the wind aloft at the eye, in the drifting frame (what the towers lean along)
    let we = 2.5, wn = 0.8;
    if (W) { W.at(upx, upy, upz, _wOut); we = _wOut.aloftE; wn = _wOut.aloftN; }
    const rad = OIL.uOilPx.value.x || 0.0015;
    const clouds = [];
    const S = slots;
    for (let k = 0; k < S.T; k++) {
      const sx = S.x[k], sy = S.y[k], sz = S.z[k];
      if (sx * upx + sy * upy + sz * upz < cosLim) continue;
      // where the slot is now, on the world
      _w.set(sx, sy, sz).applyQuaternion(Q);
      let cover, base, thick, storm = 0, conv = 1;
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
        if (CLOUDS.deck && camR < R + base && Math.min(1, smooth(0.50, 0.92, _cOut.low) * (1 - 0.45 * _cOut.conv) + 0.6 * _cOut.storm) > 0.85) continue;
      } else {
        const sk = skyU.uCloud.value.y;
        cover = Math.min(0.95, Math.max(fair, sk));
        thick = 0;
        base = groundAt(k, _w.x, _w.y, _w.z) + baseF[0] + (baseF[1] - baseF[0]) * hash(k, 9, 1);
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
      const s = env * smooth(own - 0.12, own + 0.12, cover * (0.55 + 0.35 * smooth(0.40, 0.80, cover)));
      if (s < 0.04) continue;
      // its size: a fair cumulus 70 to 150 m across the base's radius, more under a fuller sky; its thickness the map's
      // (towers in a storm's cell) or a fair one's
      // (fair cumulus are wider than they are tall: humilis; a thicker map makes them towers)
      const Rc = (70 + 80 * hash(k, gen, 13)) * (0.75 + 0.5 * cover) * (0.55 + 0.45 * s) * CLOUDS.size;
      const fairT = Rc * (0.75 + 0.75 * hash(k, gen, 17));
      const T = Math.max(60, (thick > 0 ? Math.max(fairT, thick * (0.55 + 0.45 * hash(k, gen, 19)) * (0.4 + 0.6 * conv)) : fairT) * (0.5 + 0.5 * s));
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
      clouds.push({ k, gen, s, Rc, T, storm, bx, by, bz, sx, sy, sz, dist, aspect: T / Rc });
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
        const Rc = Math.min(520, Math.max(160, c.r * 0.30)) * (0.6 + 0.4 * c.w);
        const La = (1000 + 900 * hash(c.i, c.gen, 7)) * (0.4 + 0.6 * c.w);
        const rb = R + base, bx = sx * rb, by = sy * rb, bz = sz * rb;
        const dist = Math.hypot(bx + sx * T * 0.5 - camD.x, by + sy * T * 0.5 - camD.y, bz + sz * T * 0.5 - camD.z);
        clouds.push({ k: -1 - c.i, cb: 1 + c.i, gen: c.gen, s: c.w, Rc, T, La, storm: 1, bx, by, bz, sx, sy, sz, dist, aspect: T / Rc });
      }
    }
    clouds.sort((a, b) => a.dist - b.dist);
    // the wind's frame at the eye, turned into the drifting frame: east = Y x up, north = up x east (the physics' own)
    _e.set(upz, 0, -upx); if (_e.lengthSq() < 1e-8) _e.set(1, 0, 0); _e.normalize();
    // (the slot frames below are each slot's own; the lean is taken along the eye's wind, carried to the slot)
    for (const M of meshes) M.n = 0;
    lobes = [];
    let tris = 0;
    // one lobe into the level of detail its size on the screen asks for
    const emit = (px, py, pz, r, cx, cy, cz, baseD, ex, ey, ez, nx, ny, nz, pa, seed, squash, T, storm, air) => {
      const dl = Math.hypot(px - camD.x, py - camD.y, pz - camD.z);
      if (dl < r * 0.8) { lobes.push(px, py, pz, r); return; }      // (the eye inside it: not drawn, the near air whites out)
      // the level of detail: the coarsest whose outline stays within CLOUDS.sagPx of the true round on the screen
      const pr = r / Math.max(dl - r, 1) / rad;
      let li = 0; while (li < LODS.length - 1 && pr * LODS[li].sag > CLOUDS.sagPx) li++;
      const M = meshes[li];
      if (M.n >= CLOUDS.maxLobes) return;
      const q = M.n * 4, A = M.g.attributes.iA.array, B = M.g.attributes.iB.array, Cc = M.g.attributes.iC.array, D = M.g.attributes.iD.array;
      A[q] = px - anchor.x; A[q + 1] = py - anchor.y; A[q + 2] = pz - anchor.z; A[q + 3] = r;
      B[q] = cx - anchor.x; B[q + 1] = cy - anchor.y; B[q + 2] = cz - anchor.z; B[q + 3] = baseD;
      // the strokes' pole: level, turned its own way about the cloud's up
      const ca = Math.cos(pa), sa = Math.sin(pa);
      Cc[q] = ex * ca + nx * sa; Cc[q + 1] = ey * ca + ny * sa; Cc[q + 2] = ez * ca + nz * sa; Cc[q + 3] = seed;
      D[q] = squash; D[q + 1] = T; D[q + 2] = storm; D[q + 3] = air;
      M.n++;
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
      const ws = Math.hypot(we, wn) || 1, lean = Math.min(0.35, 0.025 * ws) * (cl.cb ? 0.4 : 1);
      const ax = (ex * we + nx * wn) / ws, ay = (ey * we + ny * wn) / ws, az = (ez * we + nz * wn) / ws;
      const bxw = uy * az - uz * ay, byw = uz * ax - ux * az, bzw = ux * ay - uy * ax;     // across the wind
      const lx = ax * lean, ly = ay * lean, lz = az * lean;
      // how many lobes: as many as are larger than a few pixels at this distance (a storm keeps them all)
      const pxR = cl.Rc / Math.max(cl.dist, 1) / rad;
      // (a cloud under two pixels across its radius is not drawn: the air has taken it by then)
      if (pxR < 2) continue;
      const nl = cl.cb ? t.lobes.length : Math.max(pxR < 4 ? 1 : 2, Math.min(t.lobes.length, Math.round(t.lobes.length * smooth(6, 60, pxR))));
      const cxA = cl.bx + ux * cl.T * 0.45, cyA = cl.by + uy * cl.T * 0.45, czA = cl.bz + uz * cl.T * 0.45;
      const baseD = cl.T * 0.45;
      const air = Math.round(Math.min(0.6, 0.62 * (1 - Math.exp(-cl.dist / 7000))) * 5) / 5;
      const fewK = 1 + 0.55 * (1 - nl / t.lobes.length);
      for (let i = 0; i < nl; i++) {
        const o = t.lobes[i];
        const pa = hash(cl.k, cl.gen * 37 + i, 23) * Math.PI, seed = hash(cl.k, cl.gen * 41 + i, 29) * 64;
        if (o.a) {
          // an anvil lobe: along the wind from the tower, fanned across it, flattened; its centre the anvil's, high up
          const y = o.y * cl.T, r = o.r * cl.La;
          const px = cl.bx + (ax * o.x + bxw * o.z) * cl.La + ux * y, py = cl.by + (ay * o.x + byw * o.z) * cl.La + uy * y, pz = cl.bz + (az * o.x + bzw * o.z) * cl.La + uz * y;
          const ac = 0.45 * cl.La, cy0 = cl.T * 0.94;
          emit(px, py, pz, r, cl.bx + ax * ac + ux * cy0, cl.by + ay * ac + uy * cy0, cl.bz + az * ac + uz * cy0, cl.T * 0.06 + r * 0.2, ex, ey, ez, nx, ny, nz, pa, seed, 0.30, cl.T, 1, air);
          continue;
        }
        const y = o.y * cl.T;
        const r = Math.max(4, o.r * (cl.cb ? cl.Rc : Math.min(cl.Rc * 1.05, Math.max(cl.T * 0.55, cl.Rc * 0.7)) * fewK));
        const px = cl.bx + ex * o.x * cl.Rc + nx * o.z * cl.Rc + ux * y + lx * y;
        const py = cl.by + ey * o.x * cl.Rc + ny * o.z * cl.Rc + uy * y + ly * y;
        const pz = cl.bz + ez * o.x * cl.Rc + nz * o.z * cl.Rc + uz * y + lz * y;
        emit(px, py, pz, r, cxA, cyA, czA, baseD, ex, ey, ez, nx, ny, nz, pa, seed, cl.cb ? 0.92 : 0.86 / fewK, cl.T, cl.storm, air);
      }
    }
    for (const M of meshes) {
      for (const k of ['iA', 'iB', 'iC', 'iD']) { const a = M.g.attributes[k]; a.clearUpdateRanges(); a.addUpdateRange(0, M.n * 4); a.needsUpdate = true; }
      M.g.instanceCount = M.n;
      if (M.mesh) M.mesh.visible = M.n > 0;
    }
    group.position.set(0, 0, 0);
    for (const M of meshes) if (M.mesh) M.mesh.position.copy(anchor);
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
    if (skyU.uCloud3D) skyU.uCloud3D.value.set(1, Rg + (wx.alto != null ? wx.alto : 1000), wx.altoShare != null ? wx.altoShare : 0.45, 0);
    own.uGroundR.value = R + (look.weather && look.weather.shadowGround != null ? look.weather.shadowGround : 250);
    self.stats.clouds = clouds.length; self.stats.lobes = meshes.reduce((a, M) => a + M.n, 0); self.stats.tris = tris;
    self.stats.ms = performance.now() - t0;

  }

  self.update = function update(dt, camL, root, sunL, fields, skyU) {
    if (!LOOK.oil || !CLOUDS.mode) return;
    // (the speed test's row 'weather: clouds as before': the sky's own flat cloud back in their place)
    if (self.enabled === false) { group.visible = false; if (skyU && skyU.uCloud3D) skyU.uCloud3D.value.x = 0; return; }
    const id = root && root.name && root.name.startsWith('body-') ? root.name.slice(5) : null;
    if (!id || !BODIES[id]) return;
    const look = getLook(id);
    if (!(BODIES[id].atmosphereHeight > 0) || !(look.cloud > 0.01 || (look.weather && look.weather.cumulus))) { group.visible = false; if (skyU && skyU.uCloud3D) skyU.uCloud3D.value.x = 0; return; }
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
        sh.mesh.visible = false;
        group.add(sh.mesh);
      }
      for (const M of meshes) {
        M.mesh = new THREE.Mesh(M.g, mat);
        M.mesh.name = 'pc-cloud-lobes-' + M.lod.detail;
        M.mesh.frustumCulled = false;
        M.mesh.renderOrder = 10;        // after the ground (5), before the sky (1000)
        M.mesh.visible = false;
        group.add(M.mesh);
      }
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
    since += dt;
    const wall = performance.now();
    if (since >= CLOUDS.rebuild || wall - lastWall > CLOUDS.rebuild * 4000) { since = 0; lastWall = wall; rebuild(camL, sunL, fields, skyU, look); }
    // what the shaders need every frame, in the drifting frame
    _qi.copy(Q).invert();
    own.uCloudSun.value.copy(sunL).applyQuaternion(_qi).normalize();
    own.uCamD.value.copy(camL).applyQuaternion(_qi).sub(anchor);
    for (const sh of [deck, valley]) sh.u.uCamD.value.copy(camL).applyQuaternion(_qi).sub(sh.anchor);
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
