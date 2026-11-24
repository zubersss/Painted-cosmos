// Thunder by distance (group D, the weather, behind ?stormland=1 / ?wx2=1; src/audio/audio.js thunderPlan, thunderDue,
// thunderDistance). The coordinator's ruling of 24 Nov: the delay after a flash by its distance, a crack near and a low roll
// far, quieter under cover. The sound itself is heard only on a device; here its TIMING and its SHAPE are held.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { thunderPlan, thunderDue, thunderDistance, THUNDER } from '../src/audio/audio.js';
import { weatherAt, setForcedCell } from '../src/physics/weather.js';
import { ATMOSPHERES } from '../src/physics/atmosphere.js';

test('thunder: the bang is due once, on the first frame after the count-down crosses zero, whatever the frame rate', () => {
  for (const fps of [12, 30, 60, 144]) {
    const dt = 1 / fps; let prev = null, n = 0, at = null;
    for (let t = 0; t < 10; t += dt) {
      const tin = 4.2 - t;                     // the bang 4.2 s from now
      if (thunderDue(prev, tin)) { n++; at = t; }
      prev = tin;
    }
    assert.equal(n, 1, `${fps} frames a second: due ${n} times`);
    assert.ok(at >= 4.2 - 1e-9 && at < 4.2 + dt + 1e-9, `${fps}/s: due at ${at.toFixed(3)} s`);
  }
  assert.equal(thunderDue(null, null), false);
  // (with the storm switch) a count-down that jumps from one storm's to another's, already long past, is not a late bang
  assert.equal(thunderDue(1.2, -5.5, 0.5), false);
  assert.equal(thunderDue(0.02, -0.01, 0.5), true);
});

test('thunder: it arrives the flash\'s distance over the speed of sound after the flash, and the audio reads that distance back', () => {
  const u = { x: 0.6, y: 0.48, z: 0.64 }, l = Math.hypot(u.x, u.y, u.z); u.x /= l; u.y /= l; u.z /= l;
  setForcedCell({ kind: 'storm', x: u.x, y: u.y, z: u.z, r: 900, w: 1 });
  try {
    const c = ATMOSPHERES.earth.c, out = {};
    let seen = 0;
    for (let t = 3000; t < 3240 && seen < 4; t += 0.02) {
      const w = weatherAt('earth', u.x, u.y, u.z, 30, t, 18, { moist: 1 }, out), L = w.lightning;
      if (!L.last || !(L.last.t > t - 0.02)) continue;           // the frame of a new flash
      seen++;
      const d = L.last.distance, age = t - L.last.t;
      assert.ok(Math.abs(L.thunderIn - (d / c - age)) < 1e-6, `thunder in ${L.thunderIn.toFixed(3)} s for a flash ${d.toFixed(0)} m off`);
      // and at the moment it arrives, its loudness gives back the distance the plan is shaped by
      const tArr = L.last.t + d / c + 0.01;
      const w2 = weatherAt('earth', u.x, u.y, u.z, 30, tArr, 18, { moist: 1 }, out);
      if (w2.lightning.last.t === L.last.t) assert.ok(Math.abs(thunderDistance(w2.lightning.thunder01) - d) <= 0.03 * d + 5, `read back ${thunderDistance(w2.lightning.thunder01).toFixed(0)} m for ${d.toFixed(0)} m`);
    }
    assert.ok(seen >= 2, `${seen} flashes under the held storm`);
  } finally { setForcedCell(null); }
});

test('thunder: a crack near, a long low roll far, quieter and muffled under cover', () => {
  const top = (P) => Math.max(...P.map((l) => l.freq)), len = (P) => Math.max(...P.map((l) => l.at + l.attack + l.decay)), peak = (P) => Math.max(...P.map((l) => l.level));
  const near = thunderPlan(150, 0, false, 0.3), mid = thunderPlan(800, 0, false, 0.3), far = thunderPlan(2500, 0, false, 0.3);
  assert.ok(near.some((l) => l.at === 0 && l.freq >= 1500 && l.attack < 0.01), 'a near bolt cracks: high noise at once');
  assert.ok(!far.some((l) => l.freq > 300), `a far bolt only rolls (its highest layer ${top(far).toFixed(0)} Hz)`);
  assert.ok(far[0].attack >= 0.3 && len(far) >= 6, `a far roll swells slowly and lasts (${far[0].attack.toFixed(2)} s, ${len(far).toFixed(1)} s)`);
  assert.ok(len(near) < len(far) && peak(near) > peak(mid) && peak(mid) > peak(far), 'nearer is louder and shorter');
  const leaves = thunderPlan(150, 1, false, 0.3), ship = thunderPlan(150, 0, true, 0.3);
  assert.ok(peak(leaves) < peak(near), 'under leaves a little quieter');
  assert.ok(!ship.some((l) => l.freq > 400) && peak(ship) <= 0.6 * peak(near), 'in the ship muffled and quieter');
  assert.ok(THUNDER.near < THUNDER.far);
});
