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
};

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
    uFog: { value: new THREE.Vector4(1 / 4000, 5, 1, 0) },               // 1/visibility, bands, max, altitude01
    uDayness: { value: 1 },                                              // 1 day .. 0 night
    uHueA: { value: new THREE.Vector3(0.84, 0.99, 0.80) },               // the two drifts of neighbouring pigment in ground washes
    uHueB: { value: new THREE.Vector3(1.0, 0.90, 0.80) },
    uBodyR: { value: 4000 },                                             // base radius of the body (strata follow the height)
  };
}

// The painter reads this to grade the sheet; the world writes it for the body the camera is on.
export const SHEET = {
  grade: new THREE.Vector3(1, 1, 1),
  valid: false,
};

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
