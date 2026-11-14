// node --test src/world/figure.test.mjs
// The painted figure's legs, in Node: where the boots are, read from the matrix palette the mesh is drawn with
// (art/models.js createExplorer). Written for the M4 re-fix: inside leg() a local named like the swim weight hid it,
// so on land every swinging leg was pulled to the tread-water pose (the ankle up to 0.7 m from PHYSICS' foot, behind
// the hips and in the ground) and afloat the kick hung on whatever stride PHYSICS happened to hold.
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

// the page's import map, for Node: the bare 'three' specifier is the vendored build
const three = pathToFileURL(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../vendor/three/three.module.js')).href;
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier === 'three') return { url: '${three}', shortCircuit: true };
  return next(specifier, context);
}`), import.meta.url);

const THREE = await import('three');
const { createExplorer } = await import('../art/models.js');

// the rig's order in the palette (models.js makeRig): thighs 6 and 7, shins 8 and 9; hips 0.89 m, knees 0.48 m, ankles 0
const LEGS = [{ thigh: 6, shin: 8, x: -0.095 }, { thigh: 7, shin: 9, x: 0.095 }];
const v = new THREE.Vector3();
const at = (mats, i, x, y) => { v.set(x, y, 0).applyMatrix4(mats[i]); return { fwd: -v.z, up: v.y, side: v.x }; };
const bend = (mats, L) => {
  const hip = at(mats, L.thigh, L.x, 0.89), knee = at(mats, L.thigh, L.x, 0.48), ank = at(mats, L.shin, L.x, 0);
  const a = [knee.fwd - hip.fwd, knee.up - hip.up, knee.side - hip.side], b = [ank.fwd - knee.fwd, ank.up - knee.up, ank.side - knee.side];
  const la = Math.hypot(...a), lb = Math.hypot(...b);
  return Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (la * lb))));
};
// a stride as PHYSICS hands it (figure.js figureArgs): the left foot lands at stride 0 and stands for a third of it,
// then swings from behind the hips to ahead of them, lifted; the right foot half a stride later
const foot = (s) => {
  s = ((s % 1) + 1) % 1;
  if (s < 0.35) return { fwd: 0.30 - 0.75 * s / 0.35, up: 0, side: 0, down: 1 };
  const u = (s - 0.35) / 0.65;
  return { fwd: -0.45 + 0.75 * u, up: 0.18 * Math.sin(Math.PI * u), side: 0, down: 0 };
};

test('M4 re-fix: on land the boot is where the foot is, through the whole swing', () => {
  for (const speed of [1.6, 4.2, 7.2]) {
    const ex = createExplorer(), mats = ex.object3D.children[0].material.uniforms.uPart.value;
    let worst = 0, low = 1;
    for (let i = 0; i < 180; i++) {
      const stride = (i / 60) % 1, feet = [foot(stride), foot(stride + 0.5)];
      ex.animate({ mode: 'walk', speed, stride, feet, ride: 0, surge: 0, swim: 0, stroke: (i / 90) % 1, swimSpeed: 0 }, 1 / 60);
      if (i < 60) continue;                        // (the walk's weights ease in over the first cycle)
      LEGS.forEach((L, k) => {
        const a = at(mats, L.shin, L.x, 0), F = feet[k];
        worst = Math.max(worst, Math.abs(a.fwd - F.fwd)); low = Math.min(low, a.up - F.up);
        assert.ok(Math.abs(a.fwd - F.fwd) < 0.06, `at ${speed} m/s, stride ${stride.toFixed(2)}, leg ${k}: the boot is ${a.fwd.toFixed(2)} m ahead of the hips, the foot ${F.fwd.toFixed(2)}`);
        assert.ok(a.up > F.up - 0.03 && a.up < 0.36, `at ${speed} m/s, stride ${stride.toFixed(2)}, leg ${k}: the boot is ${a.up.toFixed(2)} m up, the foot ${F.up.toFixed(2)}`);
      });
    }
    assert.ok(worst < 0.06 && low > -0.03);
  }
});

test('M4 re-fix: afloat both legs kick with the stroke, whatever stride is held', () => {
  for (const swimSpeed of [2.0, 0]) for (const stride of [0, 0.25, 0.389, 0.5, 0.75]) {
    const ex = createExplorer(), mats = ex.object3D.children[0].material.uniforms.uPart.value;
    const lo = [9, 9], hi = [-9, -9];
    for (let i = 0; i < 240; i++) {
      const still = { fwd: 0, up: 0, side: 0, down: 0 };
      ex.animate({ mode: 'swim', speed: swimSpeed, stride, feet: [still, still], ride: 0, surge: 0, swim: 1, stroke: (i / 60 * 1.1) % 1, swimSpeed, submerged01: 0.69 }, 1 / 60);
      if (i < 120) continue;
      LEGS.forEach((L, k) => { const b = bend(mats, L); lo[k] = Math.min(lo[k], b); hi[k] = Math.max(hi[k], b); });
    }
    for (const k of [0, 1]) assert.ok(hi[k] - lo[k] > 0.25, `swim speed ${swimSpeed}, stride ${stride}, leg ${k}: the knee bends ${lo[k].toFixed(2)} to ${hi[k].toFixed(2)} rad over two strokes`);
    // (a frog kick and a scissor both use the two legs alike: neither is left straight)
    assert.ok(Math.abs((hi[0] - lo[0]) - (hi[1] - lo[1])) < 0.05);
  }
});
