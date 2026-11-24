// The near ground's strokes as the GPU holds them, driven from Node without a browser. Run: node --test src/world/
//   PAINTER 19 (the M4 pre-ship round): at Earth's alpine meadow, reached straight from the forest, a column of leaf
//   dabs leaned up into the sky and a cascade of them hung at the upper left (the PHYSICS verifier's frames at the top
//   tier, and at quality 0). They were the forest's own strokes: three takes an attribute's update ranges only in a
//   frame that draws the mesh, the ring laid its ranges down afresh in every update, and the frames after the leap
//   were built and not drawn (the instruments step the clock with the painting put aside; a game frame can be built
//   and not drawn too), so the full upload the leap asked for was lost and the GPU kept the old marks, written against
//   the old origin on the old ground's plane.
//   Here a stand-in for three's WebGLAttributes (the same rules: a new buffer takes the whole array; a newer version
//   takes its update ranges, or the whole array if there are none; then the ranges are cleared and onUpload is called)
//   holds the GPU's copy, and every stroke the GPU would draw must stand on the ground round the eye.
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const three = pathToFileURL(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../vendor/three/three.module.js')).href;
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier === 'three') return { url: '${three}', shortCircuit: true };
  return next(specifier, context);
}`), import.meta.url);

const THREE = await import('three');
const { NearGround } = await import('./nearground.js');
const { QUALITY, makeBodyUniforms } = await import('../render/shared.js');
const { getSurface, getStandPure } = await import('./surface.js');

// three's rules for an attribute's buffer (WebGLAttributes.update / updateBuffer), on a copy in memory
function makeGpu() {
  const held = new Map();
  return {
    draw(ng) {
      if (!ng.mesh.visible) return;
      for (const r of ng.rings) {
        if (!r.mesh.visible) continue;
        for (const a of r.attrs) {
          let g = held.get(a);
          if (!g) { g = { version: a.version, data: Float32Array.from(a.array) }; held.set(a, g); a.onUploadCallback(); continue; }
          if (g.version >= a.version) continue;
          if (!a.updateRanges.length) g.data.set(a.array);
          else for (const u of a.updateRanges) g.data.set(a.array.subarray(u.start, u.start + u.count), u.start);
          a.clearUpdateRanges();
          a.onUploadCallback();
          g.version = a.version;
        }
      }
    },
    copy(a) { return held.get(a).data; },
  };
}

// the eye 1.7 m over the ground at a unit direction, body-local
function eyeAt(S, d) {
  const h = S.heightAt(d.x, d.y, d.z), r = S.R + h + 1.7;
  return new THREE.Vector3(d.x * r, d.y * r, d.z * r);
}

// every stroke the GPU would draw: on the ground (its root within a few metres of the land) and inside its ring
function strays(S, ng, gpu, eye) {
  const out = [];
  for (const r of ng.rings) {
    if (!r.mesh.visible) continue;
    const ro = gpu.copy(r.aRoot), ax = gpu.copy(r.aAxis), n = r.mesh.geometry.instanceCount, o = r.mesh.position;
    const reach = (r.cfg.range[QUALITY.level] || 0) + r.cfg.cell * 3 + 6;     // (a cell leaves a little beyond the range: ring.update, `gone`)
    let bad = 0, worst = 0;
    for (let k = 0; k < n; k++) {
      if (!(ax[k * 4 + 3] > 0)) continue;
      const x = ro[k * 3] + o.x, y = ro[k * 3 + 1] + o.y, z = ro[k * 3 + 2] + o.z, l = Math.hypot(x, y, z);
      const off = Math.abs(l - (S.R + S.heightAt(x / l, y / l, z / l)));
      const far = Math.hypot(x - eye.x, y - eye.y, z - eye.z);
      if (off > 8 || far > reach) { bad++; worst = Math.max(worst, off, far - reach); }
    }
    if (bad) out.push(`${r.cfg.name}: ${bad} strokes off the ground or out of the ring (worst ${worst.toFixed(0)} m)`);
  }
  return out;
}

const S = getSurface('earth');
const forest = S.getSpawn(), meadow = getStandPure('earth', 'alpine_meadow').unitDir;

function run(drawEvery) {
  const ng = new NearGround('earth', new THREE.Group(), makeBodyUniforms());
  const gpu = makeGpu();
  let eye = eyeAt(S, forest);
  // the forest, every frame drawn, until the sward is laid
  for (let f = 0; f < 400 && (f < 3 || ng.pending > 0); f++) { ng.update(eye, true, 1.7, 1e4, 1 / 30, 0.002); gpu.draw(ng); }
  // the leap to the meadow; frames built, and drawn only every `drawEvery`; the sward is laid a few clumps a frame,
  // as in play (the least slice there is: each ring lays four clumps and whatever more fits in 0.15 ms)
  eye = eyeAt(S, meadow);
  for (let f = 1; f <= 60; f++) { ng.update(eye, true, 1.7, 0, 1 / 30, 0.002); if (f % drawEvery === 0) gpu.draw(ng); }
  ng.update(eye, true, 1.7, 0, 1 / 30, 0.002); gpu.draw(ng);
  return strays(S, ng, gpu, eye);
}

for (const q of [2, 0]) {
  test(`quality ${q}: after a leap from the forest to the alpine meadow every stroke the GPU draws stands on the meadow, whether each frame was drawn or not`, () => {
    QUALITY.level = q;
    for (const every of [1, 7, 1000]) {
      const bad = run(every);
      assert.deepEqual(bad, [], `frames drawn one in ${every}: ${bad.join('; ')}`);
    }
  });
}
