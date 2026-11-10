// STUB painter: a plain renderer behind the exact contract of src/render/index.js (plus
// COORDINATOR.md C7 and C8). No watercolour here. It renders the scene into a float-depth
// target (the same depth path Painter's pipeline uses, so ground-to-orbit depth is exercised)
// and copies it to the screen. The sky is a flat wash driven by setMood.
import * as THREE from 'three';

export const RENDERER_OPTIONS = {
  antialias: false, alpha: false, powerPreference: 'high-performance',
  reversedDepthBuffer: true, logarithmicDepthBuffer: true,
};

const PAPER = new THREE.Color(0xf4efe4);
const SKY_DAY = new THREE.Color(0xcfdde6);
const SKY_DUSK = new THREE.Color(0xe9c9a4);
const SKY_NIGHT = new THREE.Color(0x2c3350);
const SPACE = new THREE.Color(0x23294a);        // deep indigo, never black

export function createPainter(renderer) {
  let outW = 1, outH = 1, scale = 1, quality = 2;
  const mood = { bodyId: null, biomeWeights: {}, timeOfDay: 12, altitude01: 0, inSpace01: 0, speed01: 0 };
  let world = null;

  const target = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType, depthBuffer: true, stencilBuffer: false,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
  });
  target.depthTexture = new THREE.DepthTexture(1, 1, THREE.FloatType);

  const blitScene = new THREE.Scene();
  const blitCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const blitMat = new THREE.ShaderMaterial({
    uniforms: { tMap: { value: target.texture } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform sampler2D tMap; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tMap, vUv);\n#include <colorspace_fragment>\n}',
    depthTest: false, depthWrite: false,
  });
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  tri.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
  const blit = new THREE.Mesh(tri, blitMat);
  blit.frustumCulled = false;
  blitScene.add(blit);

  const sky = new THREE.Color();
  function skyColour() {
    // Day amount from the local solar time: 1 at noon, 0 at night, warm at the edges.
    const h = mood.timeOfDay;
    const sun = Math.cos(((h - 12) / 12) * Math.PI);          // 1 noon .. -1 midnight
    const day = THREE.MathUtils.smoothstep(sun, -0.18, 0.28);
    const dusk = 1 - Math.min(1, Math.abs(sun) / 0.3);
    sky.copy(SKY_NIGHT).lerp(SKY_DAY, day);
    sky.lerp(SKY_DUSK, Math.max(0, dusk) * 0.6);
    sky.lerp(PAPER, 0.25 * day);                              // horizon haze fades to paper
    sky.lerp(SPACE, mood.inSpace01);
    return sky;
  }

  function applySize() {
    const w = Math.max(1, Math.round(outW * scale)), h = Math.max(1, Math.round(outH * scale));
    target.setSize(w, h);
  }

  return {
    isStub: true,
    render(scene, camera, dt) {
      if (world && world.setSpaceAmount) world.setSpaceAmount(mood.inSpace01);
      renderer.setClearColor(skyColour(), 1);
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(blitScene, blitCam);
    },
    resize(w, h) {
      outW = Math.max(1, Math.floor(w)); outH = Math.max(1, Math.floor(h));
      renderer.setPixelRatio(1);
      renderer.setSize(outW, outH, false);
      applySize();
    },
    setRenderScale(s) {
      const v = Math.min(1, Math.max(0.25, s));
      if (v !== scale) { scale = v; applySize(); }
    },
    setQuality(q) { quality = q; },
    setMood(m) { Object.assign(mood, m); },
    // Stub-only wiring so the stub sky can fade the stub stars in. Not part of the contract.
    _attachWorld(w) { world = w; },
    _debug: { mood, get scale() { return scale; }, get quality() { return quality; }, target },
  };
}
