// Painted Cosmos: the oil look's cast shadows. OWNER: PAINTER.
//
// The watercolour has no cast shadows: the shade under trees is a pattern (chunks.js pcDapple) and the explorer and the
// ship lay a soft blot (pcCast). The owner's reference clip is built on long shadows thrown across the forest floor by
// a low sun, so the oil look (shared.js LOOK) draws them: once a frame, what casts (the plants marked by flora.js,
// layer SHADOW_LAYER) is drawn from the sun into one square target that holds, for each texel, how far from the sun the
// nearest caster is. A stroke asks once, at its own centre (chunks.js pcSunAt), so it lies in the sun or in the shade
// WHOLE: a shadow's edge is cut along the strokes, crisp, as in the clip, and nothing is filtered or blurred.
//
// The map covers a square of the land round the eye, a little ahead of it (R metres to each side); beyond it the
// pattern stands in. It is laid in the BODY's own space and moved in whole texels, so that a stroke's answer does not
// change as the eye moves. The ground is not drawn into it (it shades itself by the light's angle), so a tree behind
// a rise still throws its shadow through the rise: not seen in a wood on level ground.
import * as THREE from 'three';
import { SHADOW, OIL } from './shared.js';

export const SHADOW_LAYER = 2;

const VERT = /* glsl */`
attribute vec4 aInst;     // (plants: z the instance's number, as in materials.js PROP_VERT)
attribute vec4 aData;     // (plants: y the part: 1 a mass of foliage)
uniform vec3 uOrigin;     // (set by the plants' own onBeforeRender, as for their painted material)
uniform vec3 uCamLocal;
uniform vec4 uLod;
uniform float uInv;
varying float vS;
varying vec3 vCell;
varying float vPart;
void main() {
  vec3 p = position;
  float sc = 1.0;
  #ifdef USE_INSTANCING
    // each plant is in a near mesh and a far one, and the painted shader draws the one whose range the eye is in:
    // the same rule here, or everything would cast twice
    vec3 io = instanceMatrix[3].xyz;
    float di = distance(io, uCamLocal);
    float j = 1.0 + (aInst.z - 0.5) * uLod.z;
    float vis = step(uLod.x * j, di) * (1.0 - smoothstep(uLod.y * j * uLod.w, uLod.y * j, di));
    sc = length(instanceMatrix[0].xyz);
    p = io + (mat3(instanceMatrix) * position) * vis;
  #endif
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vS = -mv.z * uInv;
  vCell = position * sc;
  vPart = aData.y;
  gl_Position = projectionMatrix * mv;
}
`;
const FRAG = /* glsl */`
uniform float uThin;
varying float vS;
varying vec3 vCell;
varying float vPart;
float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
void main() {
  // a crown is not a solid: the light comes through it in pieces (each about a third of a metre: a bough's worth)
  if (vPart > 0.5 && vPart < 1.5 && h3(floor(vCell * 2.8)) < uThin) discard;
  gl_FragColor = vec4(vS, 0.0, 0.0, 1.0);
}
`;

export class ShadowMap {
  constructor(renderer, opts) {
    const o = opts || {};
    const ex = renderer.extensions;
    this.ok = !!(ex && ex.has && ex.has('EXT_color_buffer_float'));
    this.size = o.size || 2048; this.R = o.range || 90; this.D = 400;
    this.rt = null; this.frames = 0;
    if (!this.ok) return;
    this.rt = new THREE.WebGLRenderTarget(this.size, this.size, { type: THREE.FloatType, format: THREE.RedFormat, depthBuffer: true });
    this.rt.texture.minFilter = THREE.NearestFilter; this.rt.texture.magFilter = THREE.NearestFilter; this.rt.texture.generateMipmaps = false;
    this.cam = new THREE.OrthographicCamera(-this.R, this.R, this.R, -this.R, 1, 2 * this.D);
    this.cam.layers.set(SHADOW_LAYER);
    this.mat = new THREE.ShaderMaterial({
      name: 'pc-shadow',
      uniforms: {
        uOrigin: { value: new THREE.Vector3() }, uCamLocal: { value: new THREE.Vector3() }, uLod: { value: new THREE.Vector4(0, 1e9, 0, 0.9) },
        uInv: { value: 1 / (2 * this.D) }, uThin: { value: 0.6 },
      },
      vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide,
    });
    OIL.uShTex.value = this.rt.texture;
    this._q = new THREE.Quaternion(); this._qi = new THREE.Quaternion();
    this._cam = new THREE.Vector3(); this._up = new THREE.Vector3(); this._f = new THREE.Vector3();
    this._X = new THREE.Vector3(); this._Y = new THREE.Vector3(); this._Z = new THREE.Vector3(); this._c = new THREE.Vector3();
    this._m = new THREE.Matrix4(); this._white = new THREE.Color(1, 1, 1); this._keep = new THREE.Color();
  }

  // Draw the map for this frame (before the scene pass). Leaves OIL.uShM / uShK set; uShK.x 0 where there is none.
  render(renderer, scene, camera) {
    const K = OIL.uShK.value;
    K.x = 0;
    const root = SHADOW.root, k = SHADOW.strength;
    if (!this.ok || !root || !(k > 0.01)) return false;
    // everything in the body's own space
    const q = this._q.copy(root.quaternion), qi = this._qi.copy(q).invert();
    const camL = this._cam.copy(camera.position).sub(root.position).applyQuaternion(qi);
    const up = this._up.copy(camL).normalize();
    const Z = this._Z.copy(SHADOW.sunDirL).normalize();
    const X = this._X.crossVectors(up, Z);
    if (X.lengthSq() < 1e-6) X.set(1, 0, 0).addScaledVector(Z, -Z.x);
    X.normalize();
    const Y = this._Y.crossVectors(Z, X);
    // the square lies a little ahead of the eye, and moves in whole texels
    const f = this._f.set(0, 0, -1).applyQuaternion(camera.quaternion).applyQuaternion(qi);
    f.addScaledVector(up, -f.dot(up));
    if (f.lengthSq() > 1e-6) f.normalize(); else f.set(0, 0, 0);
    const c = this._c.copy(camL).addScaledVector(f, this.R * 0.4);
    const tx = (2 * this.R) / this.size;
    const cx = Math.round(c.dot(X) / tx) * tx, cy = Math.round(c.dot(Y) / tx) * tx, cz = c.dot(Z);
    c.set(0, 0, 0).addScaledVector(X, cx).addScaledVector(Y, cy).addScaledVector(Z, cz);
    const R = this.R, D = this.D;
    // body-local -> (x, y in -1..1 over the square; z: 0 at the sun's side .. 1), as chunks.js pcSunAt reads it
    OIL.uShM.value.set(
      X.x / R, X.y / R, X.z / R, -cx / R,
      Y.x / R, Y.y / R, Y.z / R, -cy / R,
      -Z.x / (2 * D), -Z.y / (2 * D), -Z.z / (2 * D), (D + cz) / (2 * D),
      0, 0, 0, 1);
    // the sun's camera, in the scene's space
    const cam = this.cam;
    cam.position.copy(c).addScaledVector(Z, D).applyQuaternion(q).add(root.position);
    this._m.makeBasis(X.clone().applyQuaternion(q), Y.clone().applyQuaternion(q), Z.clone().applyQuaternion(q));
    cam.quaternion.setFromRotationMatrix(this._m);
    cam.updateMatrixWorld(true);
    const prevT = renderer.getRenderTarget(), prevA = renderer.getClearAlpha();
    renderer.getClearColor(this._keep);
    renderer.setRenderTarget(this.rt);
    renderer.setClearColor(this._white, 1);
    renderer.clear(true, true, false);
    const ov = scene.overrideMaterial;
    scene.overrideMaterial = this.mat;
    try { renderer.render(scene, cam); } finally { scene.overrideMaterial = ov; }
    renderer.setClearColor(this._keep, prevA);
    renderer.setRenderTarget(prevT);
    // x how strong, y the bias (0.3 m toward the sun), z a texel of the square, w where the square's answer gives way
    K.set(k, 0.3 / (2 * D), 1 / this.size, 0.86);
    this.frames++;
    return true;
  }

  dispose() { if (this.rt) this.rt.dispose(); if (this.mat) this.mat.dispose(); }
}
