import test from 'node:test';
import assert from 'node:assert/strict';
import { stubSurface, stubSpawn, stubVistas, stubParams } from '../src/core/stubs/surface.js';
import { BODIES, BODY_IDS } from '../src/data/bodies.js';
import { spaceAltitude } from '../src/core/orbits.js';

const dirs = [];
for (let i = 0; i < 1500; i++) {
  const y = 1 - (2 * (i + 0.5)) / 1500, r = Math.sqrt(1 - y * y), a = i * 2.399963;
  dirs.push({ x: Math.cos(a) * r, y, z: Math.sin(a) * r });
}

test('stub sampleSurface honours the contract on every body', () => {
  for (const id of BODY_IDS) {
    const R = BODIES[id].radius;
    let maxAbove = 0;
    for (const d of dirs) {
      const s = stubSurface(id, d);
      assert.ok(Number.isFinite(s.radius) && s.radius > R * 0.9 && s.radius < R * 1.1);
      const nl = Math.hypot(s.normal.x, s.normal.y, s.normal.z);
      assert.ok(Math.abs(nl - 1) < 1e-9, 'unit normal');
      const cos = s.normal.x * d.x + s.normal.y * d.y + s.normal.z * d.z;
      assert.ok(Math.abs(Math.acos(Math.min(1, cos)) - s.slope) < 1e-9, 'slope is the angle between normal and up');
      assert.ok(s.slope >= 0 && s.slope < Math.PI / 2);
      assert.equal(s.isLiquid, s.liquidRadius > s.radius);
      const w = Object.values(s.biomeWeights);
      assert.ok(Math.abs(w.reduce((a, b) => a + b, 0) - 1) < 1e-9, 'weights sum to 1');
      const heaviest = Object.entries(s.biomeWeights).sort((a, b) => b[1] - a[1])[0][0];
      assert.equal(s.biomeId, heaviest);
      maxAbove = Math.max(maxAbove, s.radius - R);
    }
    assert.ok(maxAbove < spaceAltitude(BODIES[id]) * 0.8, `${id}: terrain stays well below space (${maxAbove})`);
  }
});

test('deterministic: the same planet on every visit, and scale-independent input', () => {
  const d = { x: 0.3, y: -0.5, z: 0.81 };
  const a = stubSurface('mars', d), b = stubSurface('mars', { x: d.x * 7, y: d.y * 7, z: d.z * 7 });
  assert.deepEqual(a, stubSurface('mars', d));
  assert.ok(Math.abs(a.radius - b.radius) < 1e-9);
  assert.notEqual(stubSurface('earth', d).radius - 4000, stubSurface('venus', d).radius - 3600);
});

test('continuous: neighbouring samples differ by no more than the slope allows', () => {
  for (const d of dirs.slice(0, 300)) {
    const e = 0.25 / 4000;
    const a = stubSurface('earth', d), b = stubSurface('earth', { x: d.x + e, y: d.y, z: d.z - e });
    assert.ok(Math.abs(a.radius - b.radius) < 1.5, 'no cliffs taller than the explorer between samples 0.35 m apart');
  }
});

test('spawn is flat, dry and has room for the ship; vistas are stable', () => {
  for (const id of BODY_IDS) {
    const sp = stubSpawn(id);
    const s = stubSurface(id, sp.unitDir);
    assert.ok(!s.isLiquid, id + ' spawn is dry');
    assert.ok(s.slope < 0.2, `${id} spawn slope ${s.slope}`);
    assert.equal(stubSpawn(id), sp);
    const v = stubVistas(id);
    assert.equal(v.length, 3);
    assert.deepEqual(v, stubVistas(id));
    for (const x of v) assert.ok(Math.abs(Math.hypot(x.unitDir.x, x.unitDir.y, x.unitDir.z) - 1) < 1e-9);
  }
  assert.equal(stubParams('earth').seaLevel, 0);
  assert.equal(stubParams('moon').seaLevel, null);
});
