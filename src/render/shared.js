// Painted Cosmos: uniforms and textures shared by every painted material. OWNER: PAINTER.
import * as THREE from 'three';
import { genNoise3D, genStrokes, genPaper } from './texgen.js';
import { PAPER, hexToRgb } from '../data/looks.js';

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
  // the near air (x how much of what stands at distance y metres it veils, rising as 1 - exp(-d / y)): a dust storm
  // veils the explorer at the eye's own distance, which the far washes' stacked bands cannot (the world sets it)
  uAirNear: { value: new THREE.Vector2(0, 9) },
  // the scene pass's second target (normal, log depth, region) and its size: glazes test their
  // depth against it by hand (set by the post passes)
  uSceneAux: { value: null }, uSceneRes: { value: new THREE.Vector2(2, 2) },
  // the scene pass's colour (what lies behind a glaze, before the brush): the star glaze reads
  // how dark the sky is there
  uSceneCol: { value: null },
};

// Things laid as a GLAZE over the painted scene (rain): objects whose material blends. They are
// left out of the scene pass and drawn after the abstraction pass, straight onto the brushed
// picture, so a stroke stays a stroke: transparent, darker than a light sky, lighter than a
// dark wood. Whoever makes such an object pushes it here (the world does for PHYSICS' kits).
export const GLAZES = [];

export function ensureGlobals() {
  const t = getTextures();
  G.uNoise3D.value = t.noise3D;
  G.uStrokeTex.value = t.strokes;
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
    uHueA: { value: new THREE.Vector3(0.84, 0.99, 0.80) },               // the two drifts of neighbouring pigment in ground washes
    uHueB: { value: new THREE.Vector3(1.0, 0.90, 0.80) },
    uBodyR: { value: 4000 },                                             // base radius of the body (strata follow the height)
    uWx: { value: new THREE.Vector4(0, 0, 0, 0) },                       // weather: x overcast (flat cool light), y wet ground, z snow cover, w veil (rain or snow in the air)
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
export const PHYSW = {
  uPhysWaterDir: { value: new THREE.Vector2(1, 0) }, uPhysWaterK: { value: new THREE.Vector4(1, 1, 1, 1) },
  uPhysWaterAmp: { value: new THREE.Vector4() }, uPhysWaterPhase: { value: new THREE.Vector4() },
  uPhysWaterGroup: { value: new THREE.Vector4() }, uPhysWaterSea: { value: new THREE.Vector4(0, 1e9, 1, 0) },
  uPhysWake: { value: new Float32Array(64) }, uPhysWakeG: { value: 9.81 },
  uWaveLod: { value: 1 },   // scales the distance over which the mesh can still carry the waves
};
const _noWake = new Float32Array(64);
export function syncPhysWater(W) {
  const u = W && W.uniforms;
  if (!u) {
    PHYSW.uPhysWaterAmp.value.set(0, 0, 0, 0); PHYSW.uPhysWaterSea.value.set(0, 1e9, 1, 0); PHYSW.uPhysWake.value = _noWake;
    return;
  }
  PHYSW.uPhysWaterDir.value.fromArray(u.uPhysWaterDir); PHYSW.uPhysWaterK.value.fromArray(u.uPhysWaterK);
  PHYSW.uPhysWaterAmp.value.fromArray(u.uPhysWaterAmp); PHYSW.uPhysWaterPhase.value.fromArray(u.uPhysWaterPhase);
  PHYSW.uPhysWaterGroup.value.fromArray(u.uPhysWaterGroup); PHYSW.uPhysWaterSea.value.fromArray(u.uPhysWaterSea);
  PHYSW.uPhysWake.value = u.uPhysWake; PHYSW.uPhysWakeG.value = u.uPhysWakeG;
}

// Things that must be brought up to date with the camera just before a frame is painted
// (PHYSICS' draw kits face the picture plane and size themselves in internal pixels):
// each hook is called as hook(camera, painter.info) at the start of painter.render.
export const FRAME_HOOKS = [];
