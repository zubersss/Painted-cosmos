// Painted Cosmos: uniforms and textures shared by every painted material. OWNER: PAINTER.
import * as THREE from 'three';
import { genNoise3D, genStrokes, genPaper } from './texgen.js';
import { PAPER, hexToRgb } from '../data/looks.js';
import { MODE } from '../data/mode.js';
import { getDabTextures } from './dabtex.js';

let _tex = null;
export function getTextures() {
  if (_tex) return _tex;
  const n3 = new THREE.Data3DTexture(genNoise3D(64), 64, 64, 64);
  n3.format = THREE.RGBAFormat; n3.type = THREE.UnsignedByteType;
  n3.wrapS = n3.wrapT = n3.wrapR = THREE.RepeatWrapping;
  // mipmapped, so far-away lookups average out instead of shimmering
  n3.minFilter = THREE.LinearMipmapLinearFilter; n3.magFilter = THREE.LinearFilter; n3.generateMipmaps = true;
  n3.unpackAlignment = 1; n3.needsUpdate = true;

  const st = new THREE.DataTexture(genStrokes(256), 256, 256, THREE.RGBAFormat, THREE.UnsignedByteType);
  st.wrapS = st.wrapT = THREE.RepeatWrapping;
  st.minFilter = THREE.LinearMipmapLinearFilter; st.magFilter = THREE.LinearFilter;
  st.generateMipmaps = true; st.anisotropy = 4; st.needsUpdate = true;

  const pp = new THREE.DataTexture(genPaper(512), 512, 512, THREE.RGBAFormat, THREE.UnsignedByteType);
  pp.wrapS = pp.wrapT = THREE.RepeatWrapping;
  pp.minFilter = THREE.LinearMipmapLinearFilter; pp.magFilter = THREE.LinearFilter;
  pp.generateMipmaps = true; pp.needsUpdate = true;

  _tex = { noise3D: n3, strokes: st, paper: pp };
  return _tex;
}

const paper = hexToRgb(PAPER);

// One object per uniform, shared by reference between all materials.
export const G = {
  uTime: { value: 0 },          // seconds, drives wind and drift (frozen for deterministic frames)
  uNoise3D: { value: null },
  uStrokeTex: { value: null },
  uPaperColor: { value: new THREE.Vector3(paper[0], paper[1], paper[2]) },
  uPrevTex: { value: null },    // last frame's painting (rgb) and log depth (a), half resolution
  uPrevOn: { value: 0 },
  // cast shade of the explorer and the ship on the ground (the world fills these): per caster
  // [centre body-local, half length], [axis body-local, half width]; uCastK the two strengths
  uCast: { value: [new THREE.Vector4(0, 0, 0, 1), new THREE.Vector4(1, 0, 0, 1), new THREE.Vector4(0, 0, 0, 1), new THREE.Vector4(1, 0, 0, 1)] },
  uCastK: { value: new THREE.Vector2(0, 0) },
  uNoHazeUp: { value: new THREE.Vector4(0, 0, 0, 0) }, uUpW0: { value: new THREE.Vector3(0, 1, 0) },   // (for body uniforms made before these existed)
  uMoon0: { value: 0 },
  uFogBank0: { value: new THREE.Vector2(0, 150) },     // (a material without a body: no banks)
  uRound0: { value: new THREE.Vector2(0, 4000) }, uHeart0: { value: new THREE.Vector4(0, 1, 0, 0) },
  uGroundK0: { value: new THREE.Vector4(0, 1, 0, 0) },
  // the near air (x how much of what stands at distance y metres it veils, rising as 1 - exp(-d / y)): a dust storm
  // veils the explorer at the eye's own distance, which the far washes' stacked bands cannot (the world sets it)
  uAirNear: { value: new THREE.Vector2(0, 9) },
  uAirless: { value: 0 },        // 1 on a world without air (the kits draw kicked dust as grains, not puffs)
  // the scene pass's second target (normal, log depth, region) and its size: glazes test their
  // depth against it by hand (set by the post passes)
  uSceneAux: { value: null }, uSceneRes: { value: new THREE.Vector2(2, 2) },
  // the scene pass's colour (what lies behind a glaze, before the brush): the star glaze reads
  // how dark the sky is there
  uSceneCol: { value: null },
  // 1 where the browser cannot draw into float targets (no EXT_color_buffer_float or _half_float): the scene pass's
  // second target (normal, log depth, region) and last frame's depth are then 8-bit, so they are written packed into
  // 0..1 (pcAuxEnc) and unpacked where they are read (pcAuxDec); 0 everywhere else: nothing changes (see post.js)
  uAux8: { value: 0 },
};

// THE LOOK. The default is the watercolour. `?look=oil` (docs/HANDOVER.md 4a, the owner's reference clip) paints the same
// world in opaque paint: body colour, a warm light and a cool shade, strokes laid on the surfaces themselves, no paper
// and no brush passes. It is a compile-time switch (the define PC_OIL in every painted material), so the watercolour's
// shaders are, with it off, exactly what they were. The uniforms below are the oil look's dials, shared by reference
// by every material; `&stroke=` (a multiple of the stroke's size) and painter.setLook({ oil: {...} }) turn them.
const _qs = (() => { try { return new URLSearchParams(location.search); } catch (e) { return null; } })();
const _qn = (k, d) => (_qs && _qs.has(k) && isFinite(+_qs.get(k)) ? +_qs.get(k) : d);
export const LOOK = { oil: !!(_qs && _qs.get('look') === 'oil') };
MODE.oil = LOOK.oil;      // (for the look data and the surface, which do not load this module: data/mode.js)
export const OIL = {
  // THE STROKES ARE THE OWNER'S STYLE 5 (2026-11-15: leaf dabs lying every way, the clip's own way, a little thinner than
  // the clip's). The five other styles tried at checkpoint 1 are gone; the thin strokes are kept for bark, the tiles
  // for snow.
  // x: a stroke's width on the screen (pixels at 720 lines; it is scaled with the picture's height); a leaf dab is about
  //    uOilS.w of these to a cell   y: how much richer than a wash the body colour is (pcDensity)   z, w: the powers
  //    that turn the pale light and glaze keys of the watercolour into the oil's warm light and cool shade
  uOilA: { value: new THREE.Vector4(4.6 * _qn('stroke', 1), 1.9, 2.0, 1.15) },
  // x: the sunlit paint's gain   y: the tiles' line (a share of a tile's width)   z: how far a stroke's colour strays
  //    from its neighbours'   w: a tile's length over its width
  uOilB: { value: new THREE.Vector4(1.12, 0.07, 1.0, 2.6) },
  // x: the power on the haze key (near 1: a pale, high air, as the clip's)   y: the glow of the air toward the sun
  //    z: 0 strokes off (the colour and light only) .. 1 on   w: how much farther off the air takes a thing on the
  //    ground than in the watercolour (the wood's depth; eased to 1.6 as the eye rises and the air thins)
  uOilC: { value: new THREE.Vector4(1.15, 0.8, _qn('strokes', 1), 4.0) },
  // the shade (chunks.js pcTone): x the cool key's gain over the body colour   y the sky's own fill in it (added)
  //    z the green left in the key (under 1: the shade leans to violet)   w the tiles' line: how light it is
  uOilD: { value: new THREE.Vector4(1.0, 0.10, 0.90, 1.3) },
  // x: (not in use)   y: (not in use)   z: a leaf dab's length over its width   w: a dab's cell (half its length) in
  //    stroke widths
  uOilS: { value: new THREE.Vector4(1, 0, 2.4, 2.6) },
  // what grows on the ground: x the share of the near ground's strokes kept (the clip's floor is a carpet of leaves
  //    with tufts of grass here and there, not a sward)   y the share of the undergrowth's blades and fronds kept
  //    z 1 while the scene pass is multisampled (set every frame)
  // (x is 0 since the overhaul plan's fifth piece: the watercolour's near strokes are shapes cut out of cards, a fan of
  // blades as one card with a notched top: in flat paint they stood on the floor as notched slabs. The oil look's floor
  // is its leaf dabs, tufts of real blades, saplings and small leafy plants.)
  uOilG: { value: new THREE.Vector4(0.0, 0.45, 0, 0) },
  // the cast shadows (shadow.js): the map, the body's own space to the map's square, and x how strong (0: no map this
  //    frame), y the bias, z a texel, w where the map's answer gives way to the leaf shadow's pattern
  // the leaf dabs laid once (dabtex.js; made in ensureGlobals from uOilS.z): a texel a dab, and each texel's topmost three
  uDabP: { value: null }, uDabId: { value: null },
  uShTex: { value: null }, uShM: { value: new THREE.Matrix4() }, uShK: { value: new THREE.Vector4(0, 0, 0, 0.86) },
  // LIGHT IN THE AIR (the overhaul plan's fourth piece; post.js OIL_FRAG): the eye's own space to the shadow map's
  // square, the way to the sun in the eye's space, the lit air's colour, and x how strong the shafts are (0: none),
  // y the air's density (1/m), z how far along a line of sight the air is followed (m), w the lit share taken as the
  // air's mean (a line with more of its air in the sun is lighter than the picture as painted, one with less darker)
  uShAir: { value: null },      // (the shadow map taken down for the air: shadow.js AIR_FRAG)
  uShV: { value: new THREE.Matrix4() }, uSunV: { value: new THREE.Vector3(0, 1, 0) }, uShaftC: { value: new THREE.Vector3(1, 0.86, 0.58) },
  uShaft: { value: new THREE.Vector4(0, 0.01, 110, 0.55) },
  // the wanderer's lantern: where it is (the body's own space) and how strong its pool of light is now (0 by day):
  // laid into the ground's and the plants' strokes (chunks.js pcLamp), not a light in the scene
  uLamp: { value: new THREE.Vector4(0, 0, 0, 0) },
  // x: the angle one pixel of the scene pass takes (radians)   y: the scene pass's height in pixels (both set every
  // frame)   z: the smallest stroke's width, m (nearer than where that is uOilA.x pixels, strokes keep this width on
  // the land and grow on the screen, as the clip's do)   w: (not in use)
  uOilPx: { value: new THREE.Vector4(0.0015, 720, 0.027 * _qn('stroke', 1), 0.085) },
};

// What the shadow map needs from the world each frame (shadow.js): the body the eye is on (its root in the scene), the
// way to its sun in its own space, and how strong a shadow is now (none under a closed sky or in the middle of twilight).
// (air: the density of the air on the ground, 1/m, and shaft: how strong the light in the air is, for the shafts)
export const SHADOW = { root: null, sunDirL: new THREE.Vector3(0, 1, 0), strength: 0, air: 0, shaft: 0 };
// (a tool may reach every painted material ever made: tools/lab.mjs swaps their shaders without a reload)
export const MATERIALS = new Set();
export function register(m, kind, opts) {
  m.userData.pcMake = { kind, opts: opts || null };
  if (LOOK.oil) { m.defines = m.defines || {}; m.defines.PC_OIL = 1; }
  if (typeof window !== 'undefined') { MATERIALS.add(m); window.__pcMaterials = MATERIALS; }
  return m;
}

// (R1 W2.4) whether water was drawn in this frame's scene pass (the water material says so as it is drawn), and the world
// the eye is on (index.js, from the mood): the post passes keep last frame's painting for its reflections on a world
// once its water has been drawn there (post.js finish)
export const PREV = { water: false, body: null };

// Things laid as a GLAZE over the painted scene (rain): objects whose material blends. They are
// left out of the scene pass and drawn after the abstraction pass, straight onto the brushed
// picture, so a stroke stays a stroke: transparent, darker than a light sky, lighter than a
// dark wood. Whoever makes such an object pushes it here (the world does for PHYSICS' kits).
export const GLAZES = [];

export function ensureGlobals() {
  const t = getTextures();
  G.uNoise3D.value = t.noise3D;
  G.uStrokeTex.value = t.strokes;
  if (LOOK.oil && !OIL.uDabP.value) { const d = getDabTextures(OIL.uOilS.value.z, 0.12); OIL.uDabP.value = d.par; OIL.uDabId.value = d.id; }
  return G;
}

// Per-body light and atmosphere uniforms. The world owns one of these per body and updates the
// active body's every frame; all of that body's materials share the same objects.
export function makeBodyUniforms() {
  return {
    uSunDirW: { value: new THREE.Vector3(0.4, 0.8, 0.4).normalize() },   // toward the sun, scene space
    uSunDirL: { value: new THREE.Vector3(0.4, 0.8, 0.4).normalize() },   // toward the sun, body-local
    uGlaze: { value: new THREE.Vector3(0.66, 0.69, 0.90) },              // cool shadow glaze
    uLight: { value: new THREE.Vector3(1.0, 0.985, 0.93) },              // sunlit wash tint
    uHaze: { value: new THREE.Vector3(0.93, 0.955, 0.975) },             // distance fades to this (near paper)
    uHazeUp: { value: new THREE.Vector4(0, 0, 0, 0) },                   // under a closed sky: the sky's wash overhead, and how far the far air takes it high in the view
    uUpW: { value: new THREE.Vector3(0, 1, 0) },                         // up at the eye, scene space
    uFog: { value: new THREE.Vector4(1 / 4000, 5, 1, 0) },               // 1/visibility, bands, max, altitude01
    uStorm: { value: 0 },                                                // 0 .. 1: under a storm cloud nothing is lit
    uDayness: { value: 1 },                                              // 1 day .. 0 night
    uMoon: { value: 0 },                                                 // 0 the sun is the light .. 1 night on the ground: the moon is, and uSunDir* hold its direction (chunks.js pcLevel)
    uHueA: { value: new THREE.Vector3(0.84, 0.99, 0.80) },               // the two drifts of neighbouring pigment in ground washes
    uHueB: { value: new THREE.Vector3(1.0, 0.90, 0.80) },
    uBodyR: { value: 4000 },                                             // base radius of the body (strata follow the height)
    uHeart: { value: new THREE.Vector4(0, 1, 0, 0) },                    // a world's one great pale marking seen from orbit (Pluto's heart): xyz its place (unit, body-local), w its size (0: none)
    uRound: { value: new THREE.Vector2(0, 4000) },                       // from orbit the limb closes on the mean sphere: x how far the relief is drawn in (0 on the ground .. 0.75), y the datum radius (chunks.js pcRound)
    uWx: { value: new THREE.Vector4(0, 0, 0, 0) },                       // weather: x overcast (flat cool light), y wet ground, z snow cover, w veil (rain or snow in the air)
    uFogBank: { value: new THREE.Vector2(0, 150) },                      // a thick fog lies in banks (PAINTER 19): x how much (0 none), y the drifts' measure (m); chunks.js pcFogBank
    uGroundK: { value: new THREE.Vector4(0, 1, 0, 0) },                  // the oil look: x how this world's ground is laid: 0 leaf dabs, 1 tiles with a light edge (snow and ice); y the share of the oil look's blades and near strokes this world keeps (1: all of them; a look's oil.grass)
  };
}

// Weather for the picture: PHYSICS' sky numbers (docs/notes/physics.md, "For PAINTER" B), each
// 0..1 and continuous: cloud, overcast, haze, fog, dust, wet, snow, rain, snowfall, storm, flash.
// Three sources, in this order: a forced sky (gallery, tests: world.setWeather), PHYSICS' own
// numbers for this frame (world.setPhysics), what PILOT handed the painter (setMood.sky).
export const WX = { forced: null, mood: null, flash: 0, key: 0 };
export function skyNow(physics, bodyId) {
  if (WX.forced) return WX.forced;
  const h = physics && physics.here;
  if (h && h.sky && (!h.bodyId || h.bodyId === bodyId)) return h.sky;
  return WX.mood;
}

// The painter reads this to grade the sheet; the world writes it for the body the camera is on.
export const SHEET = {
  grade: new THREE.Vector3(1, 1, 1),
  valid: false,
  night: 0,      // 0 day .. 1 night on the ground: the sheet's night key (see post.js)
  nightNear: 0,  // the world's own deeper night wash over the near land (a look's nightNear, post.js; 0 on most worlds)
  laid: 1,       // 1: the picture is on the paper; 0: bare paper (an arrival: the land is being laid under it); between: it comes up as one
};

// How the picture is moving: the painter writes speed01 from the mood, the ship's model says
// when the pulse drive is on (its animate state), the world eases pulse01 and lays the streaks.
export const MOTION = { speed01: 0, space01: 0, pulse: false, pulseAt: -1, pulse01: 0, given: null };

// Quality tier (0 low, 1 medium, 2 high): set by the painter, read by the world to scale how
// far flora is drawn.
export const QUALITY = { level: 1 };

// PHYSICS' flora field (COORDINATOR C14): three float textures and their uniforms, shared by
// every plant material. The world fills them from physics.fields.flora each frame; until then
// uPhysOn is 0 and plants use the painter's own gentle sway.
function blank() {
  const t = new THREE.DataTexture(new Float32Array(16), 2, 2, THREE.RGBAFormat, THREE.FloatType);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
}
export const PHYS = {
  uPhysBend: { value: blank() }, uPhysWind: { value: blank() }, uPhysPush: { value: blank() },
  uPhysAnchor: { value: new THREE.Vector3() }, uPhysEast: { value: new THREE.Vector3(1, 0, 0) },
  uPhysNorth: { value: new THREE.Vector3(0, 0, -1) }, uPhysUp: { value: new THREE.Vector3(0, 1, 0) },
  uPhysWindMap: { value: new THREE.Vector4(0, 0, 1, 2) }, uPhysNearMap: { value: new THREE.Vector4(0, 0, 1, 2) },
  uPhysWave: { value: new THREE.Vector4(1, 0, 0.1, 0) }, uPhysWavePhase: { value: new THREE.Vector4() },
  uPhysShape: { value: new THREE.Vector4(1, 1, 1, 1) }, uPhysOn: { value: 0 },
  // (branches: PHYSICS' four oscillators and their gains; they were never copied, so no branch moved)
  uPhysBranchPhase: { value: new THREE.Vector4() }, uPhysBranch: { value: new THREE.Vector4(0, 0, 0, 0.3) },
  // (each branch rings on four clock lines: without this copied, every ring froze as a fixed offset)
  uPhysBranchClock: { value: new THREE.Vector4() },
};
let _physV = -1, _physP = -1, _physF = null;
export function syncPhysFlora(F) {
  if (!F || !F.bend) { PHYS.uPhysOn.value = 0; return; }
  if (F !== _physF) {
    _physF = F;
    const mk = (arr, n) => { const t = new THREE.DataTexture(arr, n, n, THREE.RGBAFormat, THREE.FloatType); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; };
    PHYS.uPhysBend.value = mk(F.bend, F.size); PHYS.uPhysWind.value = mk(F.wind, F.size); PHYS.uPhysPush.value = mk(F.push, F.nearSize);
    _physV = _physP = -1;
  }
  if (F.version !== _physV) { PHYS.uPhysBend.value.needsUpdate = true; PHYS.uPhysWind.value.needsUpdate = true; _physV = F.version; }
  if (F.pushVersion !== _physP) { PHYS.uPhysPush.value.needsUpdate = true; _physP = F.pushVersion; }
  for (const k in F.uniforms) if (PHYS[k]) PHYS[k].value.fromArray(F.uniforms[k]);
  PHYS.uPhysOn.value = 1;
}

// PHYSICS' sea (docs/notes/physics.md, "For PAINTER" D): the uniforms of its wave chunk, shared
// by every liquid material. The world copies them from physics.fields.water each frame; with
// no physics (or on a body it is not running on) the sea lies flat.
// (PHYSICS P18/P19: the sea map, `PC_PHYS_SEA_MAP` in the water material: the sea raised at every node about over
// its own fetch and depth, a 17 x 51 float texture read with texelFetch, the two levels' grids and the band where
// the inner level gives way to the outer one. With no map (uPhysSeaGrid.w 0) the chunk reads uPhysWaterSea as before.)
function seaTex(data) {
  const t = new THREE.DataTexture(data || new Float32Array(17 * 51 * 4), 17, 51, THREE.RGBAFormat, THREE.FloatType);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
}
export const PHYSW = {
  uPhysWaterDir: { value: new THREE.Vector2(1, 0) }, uPhysWaterK: { value: new THREE.Vector4(1, 1, 1, 1) },
  uPhysWaterAmp: { value: new THREE.Vector4() }, uPhysWaterPhase: { value: new THREE.Vector4() },
  uPhysWaterGroup: { value: new THREE.Vector4() }, uPhysWaterSea: { value: new THREE.Vector4(0, 1e9, 1, 0) },
  uPhysWake: { value: new Float32Array(64) }, uPhysWakeG: { value: 9.81 },
  uPhysSeaMap: { value: seaTex() }, uPhysSeaGrid: { value: new THREE.Vector4(0, 0, 16, 0) },
  uPhysSeaGrid2: { value: new THREE.Vector4(0, 0, 128, 0) }, uPhysSeaBand: { value: new THREE.Vector4(0, 0, 0, 0) },
  uWaveLod: { value: 1 },   // scales the distance over which the mesh can still carry the waves
};
const _noWake = new Float32Array(64);
let _seaV = -1;
export function syncPhysWater(W) {
  const u = W && W.uniforms;
  if (!u) {
    PHYSW.uPhysWaterAmp.value.set(0, 0, 0, 0); PHYSW.uPhysWaterSea.value.set(0, 1e9, 1, 0); PHYSW.uPhysWake.value = _noWake;
    PHYSW.uPhysSeaGrid.value.w = 0; PHYSW.uPhysSeaGrid2.value.w = 0;
    return;
  }
  PHYSW.uPhysWaterDir.value.fromArray(u.uPhysWaterDir); PHYSW.uPhysWaterK.value.fromArray(u.uPhysWaterK);
  PHYSW.uPhysWaterAmp.value.fromArray(u.uPhysWaterAmp); PHYSW.uPhysWaterPhase.value.fromArray(u.uPhysWaterPhase);
  PHYSW.uPhysWaterGroup.value.fromArray(u.uPhysWaterGroup); PHYSW.uPhysWaterSea.value.fromArray(u.uPhysWaterSea);
  PHYSW.uPhysWake.value = u.uPhysWake; PHYSW.uPhysWakeG.value = u.uPhysWakeG;
  if (u.uPhysSeaMap) {
    // (the same array every frame: the texture is made once over it, re-uploaded when the map was rewritten)
    if (PHYSW.uPhysSeaMap.value.image.data !== u.uPhysSeaMap) { PHYSW.uPhysSeaMap.value.dispose(); PHYSW.uPhysSeaMap.value = seaTex(u.uPhysSeaMap); _seaV = -1; }
    if (W.mapVersion !== _seaV) { PHYSW.uPhysSeaMap.value.needsUpdate = true; _seaV = W.mapVersion; }
    PHYSW.uPhysSeaGrid.value.fromArray(u.uPhysSeaGrid); PHYSW.uPhysSeaGrid2.value.fromArray(u.uPhysSeaGrid2);
    if (u.uPhysSeaBand) PHYSW.uPhysSeaBand.value.fromArray(u.uPhysSeaBand);
  } else { PHYSW.uPhysSeaGrid.value.w = 0; PHYSW.uPhysSeaGrid2.value.w = 0; }
}

// Things that must be brought up to date with the camera just before a frame is painted
// (PHYSICS' draw kits face the picture plane and size themselves in internal pixels):
// each hook is called as hook(camera, painter.info) at the start of painter.render.
export const FRAME_HOOKS = [];
