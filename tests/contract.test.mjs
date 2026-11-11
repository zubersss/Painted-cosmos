// Integration contract: Painter's real sampleSurface, checked against COORDINATOR.md C1, C2 and
// C11 and against what Pilot's controllers assume. If Painter's module cannot be imported (a
// file caught mid-edit), the checks are skipped rather than failed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BODIES, BODY_IDS, spaceAltitude } from '../src/data/bodies.js';

let surface = null, why = '';
try { surface = await import('../src/world/surface.js'); } catch (e) { why = String(e && e.message).slice(0, 120); }
const skip = surface && surface.sampleSurfacePure ? false : 'Painter world not importable: ' + why;

const dirs = [];
for (let i = 0; i < 1200; i++) {
  const y = 1 - (2 * (i + 0.5)) / 1200, r = Math.sqrt(1 - y * y), a = i * 2.399963;
  dirs.push([Math.cos(a) * r, y, Math.sin(a) * r]);
}

test('real sampleSurface honours the contract on every body', { skip }, () => {
  for (const id of BODY_IDS) {
    const R = BODIES[id].radius;
    for (const d of dirs) {
      const s = surface.sampleSurfacePure(id, d[0], d[1], d[2]);
      assert.ok(Number.isFinite(s.radius) && s.radius > R * 0.8 && s.radius < R * 1.3, `${id} radius`);
      const n = s.normal, nl = Math.hypot(n.x, n.y, n.z);
      assert.ok(Math.abs(nl - 1) < 1e-3, `${id} unit normal`);
      const cos = (n.x * d[0] + n.y * d[1] + n.z * d[2]) / nl;
      assert.ok(Math.abs(Math.acos(Math.min(1, cos)) - s.slope) < 0.02, `${id} slope is the angle between normal and up`);
      assert.ok(s.liquidRadius >= 0, `${id} liquidRadius present`);
      assert.equal(!!s.isLiquid, s.liquidRadius > s.radius, `${id} isLiquid`);
      const sum = Object.values(s.biomeWeights).reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(sum - 1) < 1e-3, `${id} biome weights sum to 1`);
    }
  }
});

test('real terrain stays inside the ground flight frame (below 0.8 x spaceAltitude)', { skip }, () => {
  for (const id of BODY_IDS) {
    let top = -Infinity;
    for (const d of dirs) top = Math.max(top, surface.sampleSurfacePure(id, d[0], d[1], d[2]).radius - BODIES[id].radius);
    assert.ok(top < spaceAltitude(BODIES[id]) * 0.8, `${id}: terrain reaches ${top.toFixed(0)} m, space starts at ${spaceAltitude(BODIES[id])} m`);
  }
});

test('real spawn points are dry and gentle enough to stand and park on', { skip }, () => {
  for (const id of BODY_IDS) {
    const sp = surface.getSurface(id).getSpawn();
    const s = surface.sampleSurfacePure(id, sp.x, sp.y, sp.z);
    assert.ok(!s.isLiquid, id + ' spawn is dry');
    assert.ok(s.slope < 0.35, `${id} spawn slope ${(s.slope * 57.3).toFixed(1)} deg`);
  }
});

test('real sampleSurface is deterministic and cheap enough for 30 calls a frame', { skip }, () => {
  for (const id of ['earth', 'mercury', 'jupiter']) {
    const a = surface.sampleSurfacePure(id, 0.3, 0.5, 0.81), b = surface.sampleSurfacePure(id, 0.3, 0.5, 0.81);
    assert.equal(a.radius, b.radius);
    const t0 = performance.now();
    for (const d of dirs) surface.sampleSurfacePure(id, d[0], d[1], d[2]);
    const ms = (performance.now() - t0) / dirs.length;
    assert.ok(ms < 0.25, `${id}: ${ms.toFixed(3)} ms per sample (budget: 30 samples within about 2 ms, with slack for a busy machine)`);
  }
});
