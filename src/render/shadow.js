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
import { SHADOW, SHADOW_CROWD, OIL, QUALITY } from './shared.js';

export const SHADOW_LAYER = 2;

// HOW FAR THE SQUARE REACHES WHEN THE EYE LOOKS ALONG THE LAND (2026-11-22, for the owner's 300 yards). `?shreach=`
// is how many of the ladder's own SQRT2 steps it may take for that: 0 the square exactly as it was, 1 the default,
// 2 to be shown beside it. (2 and 3 come out the same square: the test in render stops growing it once it holds
// everything that casts into it.)
const REACH = (() => {
  try { const q = new URLSearchParams(location.search).get('shreach'); return q != null && isFinite(+q) ? Math.max(0, Math.min(3, Math.round(+q))) : 1; }
  catch (e) { return 1; }     // (no address: a test, or a tool)
})();
// The square lies LEAD of its own half-width ahead of the eye, and the map alone answers for FULL of it (uShK.w in
// render below; past that chunks.js pcSunAt eases into the leaf pattern). So the ground has cast shadows out to
// (LEAD + FULL) x R metres ahead of the player's feet, and keeps (FULL - LEAD) x R behind them: with the 90 m
// square, 113 m ahead and 41 m behind.
const LEAD = 0.4, FULL = 0.86;
// HOW FAR OUT SOMETHING THAT CAN CAST INTO THIS MAP STILL STANDS, at the top quality tier. The oil look's far trees
// were taken out of this pass and the ground was never in it (flora.js), so what casts is the trees of the near and
// middle tiers: the middle tier reaches T1 = 190 m times the tier's own range scale, each tree jittering its
// hand-over by 15% (flora.js) -- 219 m at tier 2, 131 m at tier 1, 61 m at tier 0. The square is grown towards this
// and NO further: every metre past the last caster coarsens the near shadow for nothing.
// Only tier 2 grows at all. At tier 1 (what a phone starts at, core/preset.js) the whole prize is cast shadow on the
// band from 113 to 131 m -- past 131 m nothing casts there whatever size the square is -- and that is not worth a
// texel 41% coarser on the ground the player is standing on, nor the wider frustum's draws on a device at its frame
// cap. The phone's middle distance wants the far trees drawn into this pass, not a bigger square.
const MID_TIER = 219;
// Looking DOWN this steeply (the sines of 48 and 58 degrees) the middle distance has left the frame, so the square
// comes back in and the near shadow has its finest texels again. Two numbers and not one so that a view held near
// the threshold does not change the texels a shadow is cut on from frame to frame.
const LOOK_ON = 0.74, LOOK_OFF = 0.85;

const VERT = /* glsl */`
attribute vec4 aInst;     // (plants: z the instance's number, as in materials.js PROP_VERT)
attribute vec4 aData;     // (plants: y the part: 1 a mass of foliage)
uniform vec3 uOrigin;     // (set by the plants' own onBeforeRender, as for their painted material)
uniform vec3 uCamLocal;
uniform vec4 uLod;
uniform float uInv;
attribute vec3 aCard;     // (trees: the centre of the leaf a vertex belongs to, florakit.js)
uniform vec4 uLeafLod;    // (trees: leaves by distance, flora.js: x the distance within which every leaf is drawn, 0 off; y the least share)
uniform float uThinLeaf;
varying float vS;
varying vec3 vCell;
varying float vPart;
varying float vLeafH;
void main() {
  vec3 p = position;
  vLeafH = aData.w;
  float sc = 1.0;
  #ifdef USE_INSTANCING
    // each plant is in a near mesh and a far one, and the painted shader draws the one whose range the eye is in:
    // the same rule here, or everything would cast twice
    vec3 io = instanceMatrix[3].xyz;
    float di = distance(io, uCamLocal);
    float j = 1.0 + (aInst.z - 0.5) * uLod.z;
    float vis = step(uLod.x * j, di) * (1.0 - smoothstep(uLod.y * j * uLod.w, uLod.y * j, di));
    sc = length(instanceMatrix[0].xyz);
    vec3 lp = position;
    // (LEAVES BY DISTANCE, as materials.js PROP_VERT. Of a crown's leaves only the share 1 - uThinLeaf throws a shadow
    // at all (FRAG below); far off fewer still are drawn, each larger, so that the crown's shade stays as deep.)
    if (uLeafLod.x > 0.0 && aData.y > 4.5 && aData.y < 6.5) {
      float keep = clamp(pow(uLeafLod.x / max(di, 0.01), 1.2), uLeafLod.y, 1.0);
      float shr = 1.0 - uThinLeaf;
      float fs = min(shr, keep * 0.5);
      lp = aCard + (position - aCard) * step(1.0 - fs, aData.w) * min(sqrt(shr / max(fs, 0.01)), 2.6);
    }
    p = io + (mat3(instanceMatrix) * lp) * vis;
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
uniform float uThinLeaf;
varying float vS;
varying vec3 vCell;
varying float vPart;
varying float vLeafH;
float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
void main() {
  // a crown is not a solid: the light comes through it in pieces (each about a third of a metre: a bough's worth)
  if (vPart > 0.5 && vPart < 1.5 && h3(floor(vCell * 2.8)) < uThin) discard;
  // (and a crown of separate leaves: only a share of its leaves throw a shadow, each leaf whole (its own number), or a
  // full crown shades its whole floor: with every leaf throwing, a wood in leaf was nine parts shade; the clip's floor
  // is about half in the sun)
  if (vPart > 4.5 && vLeafH < uThinLeaf) discard;
  gl_FragColor = vec4(vS, 0.0, 0.0, 1.0);
}
`;

// THE FIGURES' OWN SHADOWS (the overhaul plan's eighth piece: the clip's figure throws a real shadow). The explorer and
// the ship are drawn with their own shader, each part moved by its bone (materials.js FIG_VERT: uPart); here they are
// drawn into the map the same way, with the same bones, after the plants. (The soft blot they laid on the ground,
// chunks.js pcCast, gives way to this while the map is on.)
const FIG_SH_VERT = /* glsl */`
uniform mat4 uPart[PC_PARTS];
uniform float uInv;
attribute float aPart;
varying float vS;
void main() {
  vec4 mv = modelViewMatrix * (uPart[int(aPart + 0.5)] * vec4(position, 1.0));
  vS = -mv.z * uInv;
  gl_Position = projectionMatrix * mv;
}
`;
const FIG_SH_FRAG = /* glsl */`
varying float vS;
void main() { gl_FragColor = vec4(vS, 0.0, 0.0, 1.0); }
`;

// THE AIR'S SHADE (for the light in the air, post.js OIL_FRAG). The map itself is too fine for the air: under a crown
// it changes from texel to texel, leaf by leaf, and a line of sight that asked it sixteen times came out as grain (seen
// in the first stills of the shafts). So the map is taken down once a frame to a quarter of its size: for each block of
// sixteen texels, the share that something shades, and how far from the sun that something is on average (times the
// share); mipmapped and read smoothly, so the air's light is smooth and the picture's edges stay the painted ones.
const AIR_VERT = /* glsl */`
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const AIR_FRAG = /* glsl */`
uniform highp sampler2D tSh;
void main() {
  ivec2 b = ivec2(gl_FragCoord.xy) * 4;
  float c = 0.0, d = 0.0;
  for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++) {
    float z = texelFetch(tSh, b + ivec2(i, j), 0).r;
    float k = step(z, 0.999);
    c += k; d += k * z;
  }
  gl_FragColor = vec4(c / 16.0, d / 16.0, 0.0, 1.0);
}
`;

export class ShadowMap {
  // (PILOT's speed test, core/bench.js) The square the shadows are drawn into, made another size while the game runs:
  // what a smaller square costs and saves is the device's to say. 2048 is the look's own.
  setSize(n) {
    n = Math.max(256, Math.min(4096, n | 0));
    if (!this.ok || !this.rt || n === this.size) return this.size;
    this.size = n; this.rt.setSize(n, n); this.rtAir.setSize(n / 4, n / 4);
    return n;
  }
  constructor(renderer, opts) {
    const o = opts || {};
    const ex = renderer.extensions;
    this.ok = !!(ex && ex.has && ex.has('EXT_color_buffer_float'));
    this.size = o.size || 2048; this.R = o.range || 90; this.R0 = this.R; this.D = 400;
    this.rt = null; this.frames = 0; this._far = false;      // (whether the eye is looking along the land: LOOK_ON)
    if (!this.ok) return;
    this.rt = new THREE.WebGLRenderTarget(this.size, this.size, { type: THREE.FloatType, format: THREE.RedFormat, depthBuffer: true });
    this.rt.texture.minFilter = THREE.NearestFilter; this.rt.texture.magFilter = THREE.NearestFilter; this.rt.texture.generateMipmaps = false;
    this.cam = new THREE.OrthographicCamera(-this.R, this.R, this.R, -this.R, 1, 2 * this.D);
    this.cam.layers.set(SHADOW_LAYER);
    this.mat = new THREE.ShaderMaterial({
      name: 'pc-shadow',
      uniforms: {
        uOrigin: { value: new THREE.Vector3() }, uCamLocal: { value: new THREE.Vector3() }, uLod: { value: new THREE.Vector4(0, 1e9, 0, 0.9) },
        uInv: { value: 1 / (2 * this.D) }, uThin: { value: 0.6 }, uThinLeaf: { value: 0.66 }, uLeafLod: { value: new THREE.Vector4(0, 0, 0, 0) },
      },
      vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide,
    });
    OIL.uShTex.value = this.rt.texture;
    // (the air's shade: see AIR_FRAG)
    this.rtAir = new THREE.WebGLRenderTarget(this.size / 4, this.size / 4, { type: THREE.HalfFloatType, format: THREE.RGFormat, depthBuffer: false });
    this.rtAir.texture.minFilter = THREE.LinearMipmapLinearFilter; this.rtAir.texture.magFilter = THREE.LinearFilter; this.rtAir.texture.generateMipmaps = true;
    this.airMat = new THREE.ShaderMaterial({ name: 'pc-shadow-air', uniforms: { tSh: { value: this.rt.texture } }, vertexShader: AIR_VERT, fragmentShader: AIR_FRAG, depthTest: false, depthWrite: false });
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this.airTri = new THREE.Mesh(tri, this.airMat); this.airTri.frustumCulled = false;
    this.airCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    OIL.uShAir.value = this.rtAir.texture;
    this._q = new THREE.Quaternion(); this._qi = new THREE.Quaternion();
    this._cam = new THREE.Vector3(); this._up = new THREE.Vector3(); this._f = new THREE.Vector3();
    this._X = new THREE.Vector3(); this._Y = new THREE.Vector3(); this._Z = new THREE.Vector3(); this._c = new THREE.Vector3();
    this._m = new THREE.Matrix4(); this._white = new THREE.Color(1, 1, 1); this._keep = new THREE.Color();
    this._figMats = new Map();
  }

  // Draw the map for this frame (before the scene pass). Leaves OIL.uShM / uShK set; uShK.x 0 where there is none.
  render(renderer, scene, camera) {
    const K = OIL.uShK.value;
    K.x = 0; OIL.uShaft.value.x = 0;
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
    const pitch = f.dot(up);      // the sine of how far the view is above level; negative looking down
    f.addScaledVector(up, -pitch);
    if (f.lengthSq() > 1e-6) f.normalize(); else f.set(0, 0, 0);
    // FROM THE AIR the square lies on the LAND under the eye, not round the eye (from 150 m up with a low sun the land
    // in view fell outside it, and the wood from the ship had no shadows at all), and it is larger the higher the eye:
    // 90 m to each side on the ground, then 127, 180, 255, 360 (in steps, so that the texels a shadow is cut on change
    // seldom; SHADOW.alt: the eye's height over the land, from the world)
    const alt = Math.max(0, SHADOW.alt || 0);
    let R = this.R0;
    while (R < 359 && alt * 1.5 > R) R *= Math.SQRT2;
    // ...AND WHEN THE EYE LOOKS ALONG THE LAND, not only when it is high. Standing on level ground the ladder above
    // leaves the square at 90 m however far the player is looking, so a wood at 150 m had no cast shadow at all and
    // the leaf pattern stood in for it. One step of the same ladder, 90 m to 127 m, carries the shadows out to 160 m
    // ahead of the feet, and the square then keeps 58 m of ground behind them instead of 41, so a low sun at the
    // player's back still holds the trees that throw towards them. What it costs, both of them MEASURED OFF THE
    // NUMBERS AND NOT SEEN: the texel a shadow is cut on goes from 0.088 m to 0.124 m, and the patch the ground reads
    // it through (the quarter-sized map, AIR_FRAG, at mip 0.5) from 0.50 m to 0.70 m. ?shreach=0 is the old square.
    // Only while the ladder above has left the square at its smallest, which is an eye under 60 m: the views from
    // the air were judged with the square their own height gives them, and this step is for the player on the land.
    if (REACH > 0 && R === this.R0 && (QUALITY.level | 0) >= 2) {
      this._far = f.lengthSq() > 0.5 && -pitch < (this._far ? LOOK_OFF : LOOK_ON);
      for (let s = 0; this._far && s < REACH && R < 359 && (LEAD + FULL) * R < MID_TIER; s++) R *= Math.SQRT2;
    }
    if (R !== this.R) { this.R = R; const sc = this.cam; sc.left = -R; sc.right = R; sc.top = R; sc.bottom = -R; sc.updateProjectionMatrix(); }
    const c = this._c.copy(camL).addScaledVector(up, -alt).addScaledVector(f, this.R * LEAD);
    const tx = (2 * this.R) / this.size;
    const cx = Math.round(c.dot(X) / tx) * tx, cy = Math.round(c.dot(Y) / tx) * tx, cz = c.dot(Z);
    c.set(0, 0, 0).addScaledVector(X, cx).addScaledVector(Y, cy).addScaledVector(Z, cz);
    const D = this.D;
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
    // the figures (whatever in the scene is marked as a caster and is drawn by bones)
    for (const o of scene.children) {
      if (!o.visible || !o.userData || !o.userData.pcCaster) continue;
      const swapped = [];
      o.traverse((m) => {
        const src = m.isMesh && m.material && m.material.uniforms && m.material.uniforms.uPart ? m.material : null;
        if (!src) return;
        let sm = this._figMats.get(src);
        if (!sm) {
          sm = new THREE.ShaderMaterial({ name: 'pc-shadow-figure', defines: { PC_PARTS: src.defines.PC_PARTS }, uniforms: { uPart: src.uniforms.uPart, uInv: this.mat.uniforms.uInv },
            vertexShader: FIG_SH_VERT, fragmentShader: FIG_SH_FRAG, side: THREE.DoubleSide });
          this._figMats.set(src, sm);
        }
        swapped.push([m, src]); m.material = sm;
      });
      if (!swapped.length) continue;
      cam.layers.enableAll();
      const au = renderer.autoClear; renderer.autoClear = false;
      try { renderer.render(o, cam); } finally { for (const [m, src] of swapped) m.material = src; cam.layers.set(SHADOW_LAYER); renderer.autoClear = au; }
    }
    // THE CROWDS (world/beasts.js): an instanced herd, posed by the SAME vertex shader that paints it, so a
    // walking animal's shadow walks with it. Each near mesh is one more draw call in this pass and it buys the
    // one thing that made a deer read as pasted onto the floor rather than standing on it.
    if (SHADOW_CROWD.size) {
      const au2 = renderer.autoClear; renderer.autoClear = false;
      cam.layers.enableAll();
      for (const e of SHADOW_CROWD) {
        const mesh = e.mesh;
        if (!mesh || !mesh.visible || !mesh.count || !mesh.parent) continue;
        let sm = this._figMats.get(e.material);
        // the crowd hands in its OWN way of building the shadow twin, so this file never imports the
        // creatures: with the animals off, not one byte of render/beastmat.js is fetched (the powers' rule).
        if (!sm) { if (typeof e.makeShadow !== 'function') continue; sm = e.makeShadow(e.material, this.mat.uniforms.uInv); this._figMats.set(e.material, sm); }
        const src = mesh.material;
        mesh.material = sm;
        try { renderer.render(mesh, cam); } finally { mesh.material = src; }
      }
      cam.layers.set(SHADOW_LAYER); renderer.autoClear = au2;
    }
    // (the map taken down and smoothed: for the light in the air and for the ground's strokes, chunks.js pcSunAtSoft)
    renderer.setRenderTarget(this.rtAir); renderer.render(this.airTri, this.airCam);
    renderer.setClearColor(this._keep, prevA);
    renderer.setRenderTarget(prevT);
    // x how strong, y the bias (0.3 m toward the sun), z a texel of the square, w where the square's answer gives way
    K.set(k, 0.3 / (2 * D), 1 / this.size, FULL);
    // for the light in the air (post.js OIL_FRAG): the eye's space to the square, and the way to the sun in the eye's space
    // (the body's root and the eye are in the scene, and the scene has just been walked and placed for the sun's
    // camera: they are up to date. Walking the root's whole subtree again here was a third of a frame's placing.)
    OIL.uShV.value.copy(root.matrixWorld).invert().multiply(camera.matrixWorld).premultiply(OIL.uShM.value);
    OIL.uSunV.value.copy(Z).applyQuaternion(q).transformDirection(camera.matrixWorldInverse);
    OIL.uShaft.value.x = SHADOW.shaft * k * (SHADOW.shaftK == null ? 1 : SHADOW.shaftK); OIL.uShaft.value.y = SHADOW.air;
    this.frames++;
    return true;
  }

  dispose() { if (this.rt) this.rt.dispose(); if (this.mat) this.mat.dispose(); if (this.rtAir) this.rtAir.dispose(); if (this.airMat) this.airMat.dispose(); }
}
