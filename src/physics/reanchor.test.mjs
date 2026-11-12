// Tests (P20): the near field's re-anchor on every world. Run: node --test src/physics/
// The frame is a gnomonic grid on the tangent plane at its anchor; a re-anchor of D m moves every grid over by whole
// cells, which is exact at the new anchor only: a fixed ground point s m from it lands about D s (D + s) / R^2 from where
// the grids put it. P19 measured it on Earth's 4 km (1.2 m 120 m out). On the Moon's 1.4 km the same 384 m made it 0.77 m
// 10 m out and 2.4 m 30 m out; and the particles, which are points, were shifted the same way, and the splash events
// alive in that frame were drawn the whole re-anchor (384 m) away.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPhysics, QUALITY, reanchorAt } from './index.js';
import { LocalFrame } from './near.js';
import { stubSurface, stubSpawn } from '../core/stubs/surface.js';
import { BODIES, BODY_IDS } from '../data/bodies.js';
import { V, norm, len, makeWorld } from './testworld.mjs';

const reach = (id) => reanchorAt(BODIES[id].radius);

test('P20 the frame re-anchors sooner on a small world, so that a ground point 30 m out moves no more than on Earth', () => {
  // Earth and the giants keep 384 m; the small worlds re-anchor sooner
  assert.equal(reach('earth'), 384);
  for (const id of ['jupiter', 'saturn', 'uranus', 'neptune']) assert.equal(reach(id), 384, id);
  assert.ok(reach('moon') < 130 && reach('pluto') < 150 && reach('mercury') < 210, `moon ${reach('moon')}, pluto ${reach('pluto')}, mercury ${reach('mercury')}`);
  // walk a smooth sphere of each world's radius at 25 m/s for 40 s (the curvature's share alone: on real ground the
  // anchor's radius also follows the relief, which rescales the grid by r0'/r0, P20 notes): where the frame re-anchored,
  // and how far ground points 30 m out (and 10 m behind) landed from where the grids put them
  const rows = [];
  for (const id of BODY_IDS) {
    const R = BODIES[id].radius, world = makeWorld({ R }), physics = createPhysics({ sampleSurface: (b, d) => world(d) }), F = physics.fields.frame;
    const d0 = stubSpawn(id).unitDir;
    let p = V(d0.x * R, d0.y * R, d0.z * R);
    const e = norm(V(-d0.z, 0, d0.x));
    let worst = 0, far = 0, hops = 0;
    for (let i = 0; i < 40 * 30; i++) {
      p = V(p.x + e.x * 25 / 30, p.y + e.y * 25 / 30, p.z + e.z * 25 / 30); const l = len(p); p = V(p.x * R / l, p.y * R / l, p.z * R / l);
      const v0 = F.version, before = Object.assign(new LocalFrame(), F), dist = Math.hypot(F.lx(p.x, p.y, p.z), F.lz(p.x, p.y, p.z));
      physics.update(1 / 30, { bodyId: id, time: 100 + i / 30, focus: p });
      if (F.version !== v0 && i > 0) {
        hops++; far = Math.max(far, dist);
        // X, Z: the new anchor's coordinates in the old frame (a point of the 16 m lattice)
        const X = Math.round(before.lx(F.ox, F.oy, F.oz)), Z = Math.round(before.lz(F.ox, F.oy, F.oz));
        for (const [a, b] of [[30, 0], [24, 18], [0, 30], [-30, 0], [-8, -6]]) {
          const q = [0, 0, 0]; F.dir(a, b, q); const P = [q[0] * R, q[1] * R, q[2] * R];
          worst = Math.max(worst, Math.hypot(F.lx(...P) - (before.lx(...P) - X), F.lz(...P) - (before.lz(...P) - Z)));
        }
      }
    }
    rows.push(`${id} ${hops} at up to ${far.toFixed(0)} m, ${worst.toFixed(3)} m`);
    assert.ok(hops >= 2, `${id}: ${hops} re-anchors in 1000 m`);
    assert.ok(far <= reach(id) + 26, `${id}: re-anchored ${far.toFixed(0)} m from the anchor (reach ${reach(id).toFixed(0)})`);
    // Earth's own level (0.30 m 30 m out after 384 m, and the 16 m lattice's rounding) on every world: before P20 the Moon
    // 2.4 m, Pluto 1.9, Mercury 1.0
    assert.ok(worst < 0.36, `${id}: a ground point 30 m out lands ${worst.toFixed(3)} m from where the grids put it`);
  }
  console.log('# re-anchors in 1000 m at 25 m/s on a smooth sphere, the farthest from the anchor, the worst shift of a ground point 30 m out: ' + rows.join('; '));
  // and on ground with relief (the stubs): the anchor keeps its radius within the band (QUALITY.reanchorBand), so the grids
  // are not rescaled at each re-anchor (the stub Moon: its anchor's radius fell 20 m in one, 0.60 m 30 m out, before the band)
  const rows2 = [];
  for (const id of ['moon', 'pluto', 'mercury', 'earth']) {
    const physics = createPhysics({ sampleSurface: stubSurface }), F = physics.fields.frame, R = BODIES[id].radius, d0 = stubSpawn(id).unitDir;
    let p = V(d0.x * R, d0.y * R, d0.z * R), worst = 0, kept = 0, hops = 0;
    const e = norm(V(-d0.z, 0, d0.x));
    for (let i = 0; i < 40 * 30; i++) {
      p = V(p.x + e.x * 25 / 30, p.y + e.y * 25 / 30, p.z + e.z * 25 / 30); const r = stubSurface(id, p).radius, l = len(p); p = V(p.x * r / l, p.y * r / l, p.z * r / l);
      const v0 = F.version, before = Object.assign(new LocalFrame(), F);
      physics.update(1 / 30, { bodyId: id, time: 100 + i / 30, focus: p });
      if (F.version !== v0 && i > 0) {
        hops++; if (F.r0 === before.r0) kept++;
        const X = before.lx(F.ox, F.oy, F.oz), Z = before.lz(F.ox, F.oy, F.oz);
        for (const [a, b] of [[30, 0], [24, 18], [0, 30], [-30, 0], [-8, -6]]) {
          const q = [0, 0, 0]; F.dir(a, b, q); const P = [q[0] * F.r0, q[1] * F.r0, q[2] * F.r0];
          worst = Math.max(worst, Math.hypot(F.lx(...P) - (before.lx(...P) - X), F.lz(...P) - (before.lz(...P) - Z)));
        }
      }
    }
    rows2.push(`${id} ${kept} of ${hops} kept the radius, ${worst.toFixed(3)} m`);
    assert.ok(worst < 0.36, `${id} (relief): a ground point 30 m out lands ${worst.toFixed(3)} m from where the grids put it`);
  }
  console.log('# on the stubs\' relief: ' + rows2.join('; '));
});

test('P20 a re-anchor carries every particle and every splash event exactly: nothing that is a point moves', () => {
  for (const id of ['moon', 'earth']) {
    const physics = createPhysics({ sampleSurface: stubSurface }), F = physics.fields.frame, S = physics.particles.system;
    const d0 = stubSpawn(id).unitDir, R = BODIES[id].radius;
    F.anchor(id, d0.x * R, d0.y * R, d0.z * R);
    // the focus 'reach' metres east; drops and events round it (within 40 m), as the field holds them there
    const X = Math.round(reach(id) / 16) * 16, Z = 32, b = S.buffers.rain, n = 60;
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    S.frameVersion = F.version; b._n = n;
    for (let i = 0; i < n; i++) { b._p[i * 3] = X + 40 * rnd(); b._p[i * 3 + 1] = 2 + 15 * Math.abs(rnd()); b._p[i * 3 + 2] = Z + 40 * rnd(); }
    for (let k = 0; k < 20; k++) S._event(F, X + 30 * rnd(), 0.1, Z + 30 * rnd(), 1, 1, 0.01);
    S.events.origin.x = F.ox; S.events.origin.y = F.oy; S.events.origin.z = F.oz;
    const bodyLocal = (fr) => { const out = []; for (let i = 0; i < n; i++) { const x = b._p[i * 3], y = b._p[i * 3 + 1], z = b._p[i * 3 + 2]; const q = [fr.ox + fr.ex * x + fr.nx * z, fr.oy + fr.ey * x + fr.ny * z, fr.oz + fr.ez * x + fr.nz * z], k = (fr.r0 + y) / Math.hypot(...q); out.push(q.map((c) => c * k)); } return out; };
    const evLocal = () => { const E = S.events, out = []; for (let k = 0; k < 20; k++) out.push([E.origin.x + E.data[k * 8], E.origin.y + E.data[k * 8 + 1], E.origin.z + E.data[k * 8 + 2]]); return out; };
    const p0 = bodyLocal(F), e0 = evLocal();
    // the re-anchor exactly as physics.update makes it
    const q = [0, 0, 0]; F.dir(X, Z, q); const r0 = F.r0, F0 = { ox: F.ox, oy: F.oy, oz: F.oz, ex: F.ex, ey: F.ey, ez: F.ez, nx: F.nx, ny: F.ny, nz: F.nz };
    F.anchor(id, q[0] * r0, q[1] * r0, q[2] * r0);
    S.rebase(F, X, Z, r0 - F.r0, F0);
    // and the next update moves the events' origin to the new anchor (particles.js update)
    S.events.origin.x = F.ox; S.events.origin.y = F.oy; S.events.origin.z = F.oz;
    const p1 = bodyLocal(F), e1 = evLocal();
    let dp = 0, de = 0;
    for (let i = 0; i < n; i++) dp = Math.max(dp, Math.hypot(p1[i][0] - p0[i][0], p1[i][1] - p0[i][1], p1[i][2] - p0[i][2]));
    for (let k = 0; k < 20; k++) de = Math.max(de, Math.hypot(e1[k][0] - e0[k][0], e1[k][1] - e0[k][1], e1[k][2] - e0[k][2]));
    // (float32 storage: a few hundredths of a millimetre; before P20 the drops 0.2 m (Earth) to 2.6 m (the Moon) and
    // the events the whole re-anchor)
    assert.ok(dp < 2e-3, `${id}: a drop moved ${dp.toFixed(4)} m in the re-anchor`);
    assert.ok(de < 2e-3, `${id}: a splash event moved ${de.toFixed(4)} m in the re-anchor`);
  }
});
