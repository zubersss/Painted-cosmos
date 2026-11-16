// Painted Cosmos: the painter. OWNER: PAINTER.
// Contract (docs/BRIEF.md section 4 + docs/COORDINATOR.md C6-C9):
//   createPainter(renderer) -> { render(scene, camera, dt), resize(w, h), setQuality(0|1|2),
//     setMood({...}), setRenderScale(s) }
// Additive: setTime(seconds), setDebugView(n), setLook({...}), info, dispose().
import * as THREE from 'three';
import { Post } from './post.js';
import { G, SHEET, WX, QUALITY, FRAME_HOOKS, GLAZES, MOTION, PREV, LOOK, OIL, SHADOW, ensureGlobals, SCREEN } from './shared.js';
const _lv = new THREE.Vector3();
import { makeWashMaterial, makePaintUniforms, standInFor, bindBodyUniforms, defaultBodyUniforms } from './materials.js';
import { VERT_PARS, VERT_END, FRAG_PARS } from './chunks.js';
import { ShadowMap } from './shadow.js';

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

// (R1 W2.2) the near brush's radius, internal pixels
const BRUSH_PX = 1.4;

// (R1 W2.5, re-fix) anti-aliasing is part of the tier (docs/lead/SHARP-SMOOTH-PLAN.md, ruling 4): MSAA on the scene
// pass at tiers 2 and 1 on a desktop; at tier 0 and on a phone or tablet (a coarse pointer with touch: their GPUs pay
// for samples in bandwidth, not yet seen to hold) a light post AA instead (post.js FXAA_FRAG, nine reads a pixel of the
// scene). Four samples while what they add at the tier's full size stays under AA_MB (the targets' samples: colour 4,
// region and depth 8, z 4 bytes each, and the repaired region 8 a pixel: 72 bytes a pixel at 4x, 142 MiB at 1920x1080
// drawn whole; 40 at 2x, 79 MiB), else two, else the post AA. The budget is reckoned on the tier's own size, not on
// what the resolution controller draws now, so its steps never rebuild the multisampled targets. `?aa=0|post|msaa|2`
// (or setAA) overrides, for tests. (The plan's rule above 100 MB, the region packed into 8 bits while MSAA is on, is
// not taken: 8 bits hold the log depth in eighths of a log2 metre, coarser than the brush's, the edges' and the
// pencil's thresholds, and the picture would change; fewer samples keep it.)
const AA_MB = 100;
const TOUCH = typeof matchMedia === 'function' && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0 && matchMedia('(pointer: coarse)').matches;
const QS = (() => { try { return new URLSearchParams(location.search); } catch (e) { return null; } })();
const AA_URL = QS ? QS.get('aa') : null;
// (R1 re-fix) the old brush (post.js ABS_FRAG) only where the URL pins the resolution (?scale= or ?dynres=0: the tests'
// pinned low runs): in play the resolution controller's low steps draw the new brush's sharp picture, enlarged, never
// the old blots (outside a page, the tests' stand-in renderers, the old rule stands)
const PINNED = QS ? QS.has('scale') || QS.get('dynres') === '0' : true;
const LITE_PIN = QS && QS.has('lite') ? (QS.get('lite') === '0' ? 0 : 1) : null;

const GRADES = [   // hour, sheet grade (used only when no world has published one)
  [0, [0.42, 0.48, 0.70]], [4.5, [0.42, 0.48, 0.70]], [6, [1.0, 0.965, 0.955]], [8, [1, 1, 1]],
  [16, [1, 1, 1]], [18, [1.0, 0.96, 0.90]], [19.5, [0.42, 0.48, 0.70]], [24, [0.42, 0.48, 0.70]],
];

export function createPainter(renderer) {
  ensureGlobals();
  // (?float=0: the 8-bit fallback's path on a machine that has float targets, for tests)
  const post = new Post(renderer, { floatFallback: !!(QS && QS.get('float') === '0') });
  // (the oil look's cast shadows: `&shadow=0` turns them off, `&shadow=4096` or another size sets the map's)
  const shadow = LOOK.oil && !(QS && QS.get('shadow') === '0') ? new ShadowMap(renderer, { size: QS && +QS.get('shadow') > 256 ? +QS.get('shadow') : 2048 }) : null;
  let quality = 1, renderScale = 1, outW = 2, outH = 2, graphite = 0.4;
  const mood = { bodyId: null, biomeWeights: null, timeOfDay: 12, altitude01: 0, inSpace01: 0, speed01: 0 };
  const swapped = [], glazed = [];
  const info = { internalWidth: 2, internalHeight: 2, quality: 1, aa: 0, postAA: false, depth: '' };
  const aaOf = (m) => (m === 'off' || m === 0 || m === '0' ? 'off' : m === 'post' ? 'post' : m === 'msaa' || m === 4 || m === '4' ? 'msaa' : m === 'msaa2' || m === 2 || m === '2' ? 'msaa2' : 'auto');
  let aaMode = aaOf(AA_URL);
  // (which depth the scene is drawn with, for the stats line: reversed-Z where the browser has EXT_clip_control, else
  // a logarithmic depth written by every fragment, which costs the early depth test and MSAA's depth per sample)
  { const c = renderer.capabilities || {}; info.depth = c.reversedDepthBuffer ? 'reversed-z' : c.logarithmicDepthBuffer ? 'log' : 'standard'; }

  renderer.autoClear = false;
  renderer.setPixelRatio(1);
  // One program for a material wherever it is drawn. The paint's shaders write the sheet as it is (none
  // converts a colour space; the canvas still shows sRGB), so the canvas is told it takes linear values,
  // as the painter's own targets do: a compile of the scene made outside the scene pass (PILOT's prewarm)
  // then builds the programs the scene pass draws with, not a second set keyed to the canvas.
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

  function applySize() {
    const t0 = TIERS[quality];
    // (THE OIL LOOK IS NOT DRAWN SMALL AND STRETCHED: its strokes are sized in the picture's own pixels, and a picture at
    // 0.8 or 0.62 of the canvas, stretched over a phone's screen, was "blurry and blotchy": the owner, on the phone.
    // Every tier draws the whole canvas: a lower tier draws less far and less densely, not smaller. The watercolour's
    // tiers are as they were.)
    const t = LOOK.oil ? { scale: 1.0, sectors: t0.sectors, graphite: t0.graphite } : t0;
    // (the lighter paint on a touch device, shared.js uOilL; ?lite=0|1 pins it)
    if (LOOK.oil) OIL.uOilL.value.x = LITE_PIN != null ? LITE_PIN : TOUCH ? 1 : 0;
    post.sectors = t.sectors;
    graphite = t.graphite; post.sheetUniforms.uPig.value.w = graphite;
    post.setSize(outW, outH, Math.min(1, Math.max(0.3, t.scale * renderScale)));
    // (R1 W2.5, re-fix) the samples this tier and output size are given (on the tier's full size: the same at every
    // step of the resolution controller), else the post AA
    const px = Math.max(2, Math.round(outW * t.scale)) * Math.max(2, Math.round(outH * t.scale)), mb = (n) => (px * (n * 16 + 8)) / (1024 * 1024);
    let n = 0;
    if (aaMode === 'msaa') n = 4;
    else if (aaMode === 'msaa2') n = 2;
    else if (aaMode === 'auto' && quality >= 1 && !TOUCH) n = mb(4) <= AA_MB ? 4 : mb(2) <= AA_MB ? 2 : 0;
    post.setAA(n);
    // (the oil look on a touch device has no smoothing filter at all: the light post filter softens every stroke's edge,
    // and the phone's screen then stretches the picture three times over: blur on blur, against the look's first rule)
    post.setPostAA(aaMode === 'post' || (aaMode === 'auto' && post.samples === 0 && !(LOOK.oil && TOUCH)));
    info.internalWidth = post.inW; info.internalHeight = post.inH; info.quality = quality; info.aa = post.samples; info.postAA = post.postAA;
  }

  function resize(w, h) {
    outW = Math.max(2, w | 0); outH = Math.max(2, h | 0);
    SCREEN.outW = outW; SCREEN.outH = outH;
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
    // the night key: deep washes, broader and wetter brushwork, hardly any pencil
    const night = SHEET.valid ? SHEET.night : 0;
    post.sheetUniforms.uNight.value = night;
    post.sheetUniforms.uNightNear.value = SHEET.valid ? SHEET.nightNear : 0;
    post.sheetUniforms.uLaid.value = SHEET.valid ? SHEET.laid : 1;
    post.sheetUniforms.uPig.value.w = graphite * (1 - 0.75 * night);
    const ub = post.absUniforms.uBrush.value;
    ub.x = 0.0036 * (1 + 0.45 * night); ub.y = 0.0085 * (1 + 0.30 * night); ub.z = 0.013 * (1 + 0.5 * night);
    // (R1 W2.2: the near brush in internal pixels, broader by night, capped at 2 px in the shader; the old brush, which
    // grew with the distance, only where the scene is drawn under 0.6 of the sheet's size: post.js ABS_FRAG)
    const br = post.absUniforms.uBrushR.value;
    br.x = BRUSH_PX * (1 + 0.45 * night); br.y = PINNED && post.inH < 0.6 * post.outH ? 1 : 0;
    post.sheetUniforms.uSheetOld.value = br.y;
    MOTION.speed01 = +mood.speed01 || 0; MOTION.space01 = +mood.inSpace01 || 0;
    PREV.body = mood.bodyId == null ? null : mood.bodyId;
    // (PILOT's mood.pulse01, 0 to 1: the pulse drive spooling up and dropping out; without it the ship model's mode says so)
    MOTION.given = typeof mood.pulse01 === 'number' ? Math.max(0, Math.min(1, mood.pulse01)) : null;
    post.sheetUniforms.uWxSheet.value.set(WX.key, Math.max(WX.flash, mood.sky && !WX.forced ? mood.sky.flash || 0 : 0), 0, 0);
    if (LOOK.oil) {
      // (the angle one pixel of the scene pass takes: the oil look's strokes are sized on the screen, chunks.js)
      const pe = camera.projectionMatrix.elements;
      OIL.uOilPx.value.x = 2 / (Math.max(pe[5], 1e-6) * Math.max(post.inH, 2)); OIL.uOilPx.value.y = post.inH;
      OIL.uOilG.value.z = post.samples ? 1 : 0;       // (whether the scene is multisampled: a leaf's edge by cover, materials.js)
    }
    const prevTarget = renderer.getRenderTarget();
    const prevAuto = renderer.autoClear;
    renderer.autoClear = false;
    if (shadow) shadow.render(renderer, scene, camera);
    if (LOOK.oil) {
      // (the lantern's glow in the air, post.js OIL_FRAG: where the lantern is in the eye's space, and how strong)
      const L = OIL.uLamp.value, V = OIL.uLampV.value;
      if (L.w > 0.01 && SHADOW.root) { _lv.set(L.x, L.y, L.z).applyMatrix4(SHADOW.root.matrixWorld).applyMatrix4(camera.matrixWorldInverse); V.set(_lv.x, _lv.y, _lv.z, L.w); }
      else V.w = 0;
    }
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
    // (R1 W2.5, re-fix) 'auto' (the tier's own), 'off', 'post' (the light post AA), 'msaa' (4 samples) or 'msaa2';
    // info.aa says the samples drawn, info.postAA whether the post AA runs; aaMode() says it in words (PILOT's read-out)
    setAA(mode) { aaMode = aaOf(mode); applySize(); },
    aaMode() { return post.samples ? `msaa ${post.samples}x` : post.postAA ? 'post (fxaa)' : 'none'; },
    // PILOT's P3 (docs/lead/HARDENING.md A2), behind the loading card, after world.prewarm(): with a scene
    // and camera it compiles the scene as the scene pass draws it (into the pass's own target; the glazes
    // are laid into a target too, so one compile covers them); with or without, it lays each of the brush's
    // passes once. Resolves when the programs are ready (at once where the browser cannot say).
    prewarm(scene, camera) {
      const prev = renderer.getRenderTarget();
      let p = null;
      if (scene && camera) {
        // (without KHR_parallel_shader_compile three's compileAsync only warns and waits: the plain compile is the same work)
        const par = renderer.extensions && renderer.extensions.has('KHR_parallel_shader_compile');
        renderer.setRenderTarget(post.rtScene);
        try { p = par && renderer.compileAsync ? renderer.compileAsync(scene, camera) : renderer.compile(scene, camera); } catch (e) { console.warn('prewarm: ' + e.message); }
        renderer.setRenderTarget(prev);
      }
      post.warm();
      renderer.setRenderTarget(prev);
      return Promise.resolve(p).then(() => true, () => true);
    },
    setLook(o) {
      if (!o) return;
      const u = post.sheetUniforms, a = post.absUniforms;
      if (o.pooling != null) u.uPig.value.x = o.pooling;
      if (o.granulation != null) u.uPig.value.y = o.granulation;
      if (o.wobble != null) u.uPig.value.z = o.wobble;
      if (o.graphite != null) { graphite = o.graphite; u.uPig.value.w = graphite; }
      if (o.border != null) u.uBorder.value.w = o.border ? 1 : 0;
      if (o.abstraction != null) a.uAbstraction.value = o.abstraction;
      if (o.bleed != null) a.uBrush.value.w = o.bleed;
      // (the oil look's dials, shared.js OIL: { oil: { uOilA: [..], uOilB: [..], uOilC: [..] } })
      if (o.oil) for (const k in o.oil) if (OIL[k]) OIL[k].value.fromArray(o.oil[k]);
    },
    info,
    // (for instruments only: the post passes themselves, so that a study can read a pass or try a shader in a running page)
    _post: post,
    // true where the browser cannot draw into float targets and the painting runs on 8-bit ones (post.js)
    floatFallback: post.floatFallback,
    _shadow: shadow,
    // (PILOT's speed test, src/core/bench.js: the shadow pass, or only the light in the air, switched off and on again)
    _bench(o) {
      if (!o) return;
      if (shadow && o.shadow != null) { if (shadow._ok0 == null) shadow._ok0 = shadow.ok; shadow.ok = !!o.shadow && shadow._ok0; }
      if (o.shaft != null) SHADOW.shaftK = o.shaft ? 1 : 0;
      // (the lighter paint on or off, and the flat modes: shared.js uOilL)
      if (o.lite != null) OIL.uOilL.value.x = o.lite ? 1 : 0;
      if (o.flat != null) OIL.uOilL.value.y = +o.flat || 0;
    },
    get lite() { return OIL.uOilL.value.x > 0.5; },
    dispose() { post.dispose(); if (shadow) shadow.dispose(); },
  };
}
