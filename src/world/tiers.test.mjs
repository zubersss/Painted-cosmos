// R2 W7.3 (docs/lead/SHARP-SMOOTH-PLAN.md, PAINTER W7 item 3): the tiers differ by what they draw, not by blur.
// Run: node --test src/world/
// The tiers drew at 0.62, 0.80 and 1.00 of the sheet's size (a 1.6x enlargement at the lowest tier before the
// resolution controller took anything); now 0.75, 0.85 and 1.00, and the lowest tier's near brush is a single pixel,
// by day and by night. A painter is made on a stand-in renderer (no GL is drawn: the passes' sizes and the brush's
// uniforms are what is read) at a desktop's 1280x720 and 1920x1080 and at the phone preset's buffer for the iPhone 14
// held sideways (937x425, PILOT's W3.5).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const three = pathToFileURL(path.resolve(here, '../../vendor/three/three.module.js')).href;
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier === 'three') return { url: '${three}', shortCircuit: true };
  return next(specifier, context);
}`), import.meta.url);
const THREE = await import('three');
const P = await import('../render/index.js');
const { SHEET } = await import('../render/shared.js');

// what createPainter touches of a WebGLRenderer
function standIn(w, h) {
  const gl = { COLOR: 0x1800, clearBufferfv() {} };
  return { extensions: { has: () => true }, capabilities: { reversedDepthBuffer: true }, domElement: { width: w, height: h },
    setPixelRatio() {}, setSize() {}, getRenderTarget() { return null; }, setRenderTarget() {}, render() {}, clear() {}, setClearColor() {},
    getContext() { return gl; }, autoClear: true, info: { render: { frame: 0 } } };
}

test("the tiers' shares of the sheet: 0.75, 0.85, 1.0; the lowest tier's near brush one pixel", () => {
  assert.ok(Array.isArray(P.TIERS), 'render/index.js exports TIERS');
  assert.deepEqual(P.TIERS.map((t) => t.scale), [0.75, 0.85, 1.0]);
  assert.equal(P.TIERS[0].brush, 1.0);
  assert.ok(P.TIERS[1].brush > 1 && P.TIERS[2].brush > 1, 'the upper tiers keep their brush of 1.4 px');
});

for (const [w, h, name] of [[1280, 720, 'desktop 1280x720'], [1920, 1080, 'desktop 1920x1080'], [937, 425, 'iPhone 14 sideways, the phone preset']]) {
  test(`${name}: at render scale 1 the lowest tier draws at least 0.75 of the sheet, the middle 0.85`, () => {
    const p = P.createPainter(standIn(w, h));
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera();
    const want = [0.75, 0.85, 1.0];
    for (const q of [0, 1, 2]) {
      p.setQuality(q); p.setRenderScale(1);
      const iw = p.info.internalWidth, ih = p.info.internalHeight;
      assert.ok(iw >= Math.floor(w * want[q]) && ih >= Math.floor(h * want[q]), `q${q}: ${iw}x${ih} for ${w}x${h}`);
      assert.ok(iw <= Math.ceil(w * want[q]) && ih <= Math.ceil(h * want[q]), `q${q}: ${iw}x${ih} for ${w}x${h}`);
      // the near brush's radius after a frame, by day and by night (the night widens it, but not at the lowest tier)
      for (const night of [0, 1]) {
        SHEET.valid = true; SHEET.night = night; SHEET.nightNear = 0; SHEET.laid = 1; SHEET.grade.set(1, 1, 1);
        p.render(scene, cam, 0.016);
        const br = p._post.absUniforms.uBrushR.value;
        if (q === 0) assert.equal(br.x, 1.0, `q0 night ${night}: the near brush ${br.x} px`);
        else assert.ok(Math.abs(br.x - 1.4 * (1 + 0.45 * night)) < 1e-9, `q${q} night ${night}: ${br.x}`);
        assert.equal(br.y, 0, `q${q}: the new brush (the old one only under 0.6 of the sheet)`);
      }
      SHEET.valid = false;
    }
    p.dispose();
  });
}
