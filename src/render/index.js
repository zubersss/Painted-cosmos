// Painted Cosmos: the painter. OWNER: PAINTER.
// Contract (docs/BRIEF.md section 4 + docs/COORDINATOR.md C6-C9):
//   createPainter(renderer) -> { render(scene, camera, dt), resize(w, h), setQuality(0|1|2),
//     setMood({...}), setRenderScale(s) }
// Additive: setTime(seconds), setDebugView(n), setLook({...}), info, dispose().
import * as THREE from 'three';
import { Post } from './post.js';
import { G, SHEET, WX, QUALITY, FRAME_HOOKS, GLAZES, ensureGlobals } from './shared.js';
import { makeWashMaterial, makePaintUniforms, standInFor, bindBodyUniforms, defaultBodyUniforms } from './materials.js';
import { VERT_PARS, VERT_END, FRAG_PARS } from './chunks.js';

// additive exports for materials written outside the painter (PHYSICS' draw kits): the three
// GLSL chunks of the scene pass and the uniforms they need
export { makeWashMaterial, makePaintUniforms, bindBodyUniforms, defaultBodyUniforms, VERT_PARS, VERT_END, FRAG_PARS };

// Pilot spreads this into the WebGLRenderer constructor (COORDINATOR C7).
export const RENDERER_OPTIONS = {
  antialias: false,
  alpha: false,
  powerPreference: 'high-performance',
  reversedDepthBuffer: true,
  logarithmicDepthBuffer: true,
};

// Internal resolution per quality tier (multiplied by setRenderScale), and Kuwahara sectors.
const TIERS = [
  { scale: 0.62, sectors: 4, graphite: 0.0 },
  { scale: 0.80, sectors: 8, graphite: 0.40 },
  { scale: 1.00, sectors: 8, graphite: 0.40 },
];

const GRADES = [   // hour, sheet grade (used only when no world has published one)
  [0, [0.42, 0.48, 0.70]], [4.5, [0.42, 0.48, 0.70]], [6, [1.0, 0.965, 0.955]], [8, [1, 1, 1]],
  [16, [1, 1, 1]], [18, [1.0, 0.96, 0.90]], [19.5, [0.42, 0.48, 0.70]], [24, [0.42, 0.48, 0.70]],
];

export function createPainter(renderer) {
  ensureGlobals();
  const post = new Post(renderer);
  let quality = 1, renderScale = 1, outW = 2, outH = 2;
  const mood = { bodyId: null, biomeWeights: null, timeOfDay: 12, altitude01: 0, inSpace01: 0, speed01: 0 };
  const swapped = [], glazed = [];
  const info = { internalWidth: 2, internalHeight: 2, quality: 1 };

  renderer.autoClear = false;
  renderer.setPixelRatio(1);

  function applySize() {
    const t = TIERS[quality];
    post.sectors = t.sectors;
    post.sheetUniforms.uPig.value.w = t.graphite;
    post.setSize(outW, outH, Math.min(1, Math.max(0.3, t.scale * renderScale)));
    info.internalWidth = post.inW; info.internalHeight = post.inH; info.quality = quality;
  }

  function resize(w, h) {
    outW = Math.max(2, w | 0); outH = Math.max(2, h | 0);
    renderer.setPixelRatio(1);
    renderer.setSize(outW, outH, false);
    applySize();
  }

  function setQuality(q) { quality = Math.max(0, Math.min(2, q | 0)); QUALITY.level = quality; applySize(); }
  function setRenderScale(s) { renderScale = Math.max(0.3, Math.min(1, +s || 1)); applySize(); }
  function setMood(m) { if (m) { Object.assign(mood, m); if ('sky' in m) WX.mood = m.sky || null; } }

  function gradeFromHour(h, out) {
    h = ((h % 24) + 24) % 24;
    for (let i = 0; i < GRADES.length - 1; i++) {
      const a = GRADES[i], b = GRADES[i + 1];
      if (h >= a[0] && h <= b[0]) {
        const t = (h - a[0]) / Math.max(1e-6, b[0] - a[0]);
        return out.set(a[1][0] + (b[1][0] - a[1][0]) * t, a[1][1] + (b[1][1] - a[1][1]) * t, a[1][2] + (b[1][2] - a[1][2]) * t);
      }
    }
    return out.set(1, 1, 1);
  }

  // Foreign materials (anything not painted by us) get a wash stand-in for the scene pass.
  function swapForeign(scene) {
    swapped.length = 0;
    scene.traverseVisible((o) => {
      const m = o.material;
      if (!m) return;
      if (Array.isArray(m)) {
        let need = false;
        for (const mm of m) if (!(mm.userData && mm.userData.pcPainted)) { need = true; break; }
        if (!need) return;
        swapped.push(o, m);
        o.material = m.map((mm) => (mm.userData && mm.userData.pcPainted ? mm : standInFor(o, mm)));
      } else if (!(m.userData && m.userData.pcPainted)) {
        swapped.push(o, m);
        o.material = standInFor(o, m);
      }
    });
  }
  function restoreForeign() {
    for (let i = 0; i < swapped.length; i += 2) swapped[i].material = swapped[i + 1];
    swapped.length = 0;
  }

  function render(scene, camera, dt) {
    if (dt > 0) G.uTime.value += Math.min(dt, 0.1);
    for (const hook of FRAME_HOOKS) hook(camera, info);
    if (SHEET.valid) post.sheetUniforms.uGrade.value.copy(SHEET.grade);
    else gradeFromHour(mood.timeOfDay == null ? 12 : mood.timeOfDay, post.sheetUniforms.uGrade.value);
    // weather on the sheet: a storm shifts the whole value key (more pigment, the paper stays
    // the brightest value); lightning is bare paper showing through for a frame or two
    post.sheetUniforms.uWxSheet.value.set(WX.key, Math.max(WX.flash, mood.sky && !WX.forced ? mood.sky.flash || 0 : 0), 0, 0);
    const prevTarget = renderer.getRenderTarget();
    const prevAuto = renderer.autoClear;
    renderer.autoClear = false;
    post.beginScene();
    swapForeign(scene);
    // glazes sit out the scene pass and are laid over the brushed picture afterwards
    glazed.length = 0;
    for (const o of GLAZES) if (o.visible && o.parent) { o.visible = false; glazed.push(o); }
    try {
      renderer.render(scene, camera);
    } finally {
      restoreForeign();
    }
    post.finish(glazed, camera);
    renderer.setRenderTarget(prevTarget);
    renderer.autoClear = prevAuto;
  }

  resize(renderer.domElement.width || 2, renderer.domElement.height || 2);

  return {
    render, resize, setQuality, setMood, setRenderScale,
    // additive
    setTime(seconds) { G.uTime.value = seconds; },
    getTime() { return G.uTime.value; },
    setDebugView(n) { post.debugView = n | 0; },
    setLook(o) {
      if (!o) return;
      const u = post.sheetUniforms, a = post.absUniforms;
      if (o.pooling != null) u.uPig.value.x = o.pooling;
      if (o.granulation != null) u.uPig.value.y = o.granulation;
      if (o.wobble != null) u.uPig.value.z = o.wobble;
      if (o.graphite != null) u.uPig.value.w = o.graphite;
      if (o.border != null) u.uBorder.value.w = o.border ? 1 : 0;
      if (o.abstraction != null) a.uAbstraction.value = o.abstraction;
      if (o.bleed != null) a.uBrush.value.w = o.bleed;
    },
    info,
    dispose() { post.dispose(); },
  };
}
