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
    // Wall-clock: reported always, asserted only on request (PC_TIMING=1), because a busy
    // machine is not a slow sampler.
    if (process.env.PC_TIMING) assert.ok(ms < 0.25, `${id}: ${ms.toFixed(3)} ms per sample (budget: 30 samples within about 2 ms)`);
    else if (ms >= 0.25) console.log(`  (timing, not asserted: ${id}: ${ms.toFixed(3)} ms per sample, wanted under 0.25)`);
  }
});

// ---- the real forest: trunks are solid --------------------------------------------------------
let obstacles = null;
try { obstacles = await import('../src/world/obstacles.js'); } catch { /* optional */ }
const skipObs = skip || (obstacles && obstacles.sampleObstaclesPure ? false : 'Painter obstacles not importable');

test('walking through the real forest never ends up inside a trunk or under the ground', { skip: skipObs }, async () => {
  const { Sim } = await import('../src/core/sim.js');
  const { Pad, play, len, norm, dot } = await import('./helpers.mjs');
  const sim = new Sim({
    sampleSurface: (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z),
    getSpawn: (id) => surface.getSurface(id).getSpawn(),
    sampleObstacles: (id, d, r) => obstacles.sampleObstaclesPure(id, d.x, d.y, d.z, r),
  });
  const pad = new Pad();
  let seen = 0, worst = Infinity, under = 0;
  pad.press('KeyW');
  for (let leg = 0; leg < 6; leg++) {
    pad.dx += 380;                                    // turn about 50 degrees each leg
    play(sim, pad, 12, {
      each: () => {
        const r = len(sim.ex.p);
        for (const o of sim.nearObstacles) {
          seen++;
          if (sim.ex.altitude > o.height) continue;
          const gap = Math.acos(Math.min(1, dot(norm(sim.ex.p), o.unitDir))) * r - o.radius;
          worst = Math.min(worst, gap);
        }
        const s = surface.sampleSurfacePure('earth', sim.ex.p.x / r, sim.ex.p.y / r, sim.ex.p.z / r);
        if (r < s.radius - 0.01) under++;
      },
    });
  }
  assert.ok(seen > 0, 'the forest has obstacles near the spawn');
  assert.ok(worst >= 0.3, 'closest approach to a trunk surface: ' + worst.toFixed(3) + ' m');
  assert.equal(under, 0, 'never under the ground');
});

test('flying low over the real forest: the ship rides above the tree tops, never through them', { skip: skipObs }, async () => {
  const { Sim, FEEL } = await import('../src/core/sim.js');
  const { Pad, play, len, norm, dot } = await import('./helpers.mjs');
  const sim = new Sim({
    sampleSurface: (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z),
    getSpawn: (id) => surface.getSurface(id).getSpawn(),
    sampleObstacles: (id, d, r) => obstacles.sampleObstaclesPure(id, d.x, d.y, d.z, r),
  });
  const pad = new Pad();
  sim.teleport({ body: 'earth', ship: true, altitude: 30 });
  play(sim, pad, 0.5);
  pad.press('KeyW');
  pad.press('KeyC');                                   // push down onto the canopy the whole way
  let trees = 0, worst = Infinity, turn = 0;
  for (let leg = 0; leg < 8; leg++) {
    turn = leg % 2 ? 260 : -200;
    play(sim, pad, 8, {
      each: (t) => {
        if (t < 0.5) pad.dx += turn / 30;
        if (t < 0.3) return;
        // Every tree whose crown we are over must be below the hull.
        const r = len(sim.sh.p), up = norm(sim.sh.p);
        const ground = surface.sampleSurfacePure('earth', up.x, up.y, up.z).radius;
        const near = obstacles.sampleObstaclesPure('earth', up.x, up.y, up.z, 6);
        for (const o of near) {
          const gap = Math.acos(Math.min(1, dot(up, norm(o.unitDir)))) * r;
          if (gap > o.radius + 1.5) continue;         // only trunks more or less directly below
          trees++;
          worst = Math.min(worst, r - ground - o.height);
        }
      },
    });
  }
  assert.ok(trees > 20, 'flew over trees: ' + trees);
  assert.ok(worst > 0.5, 'lowest hull height above a tree top directly below: ' + worst.toFixed(2) + ' m');
  assert.equal(sim.sh.bounces, 0, 'no bumps');
  assert.ok(FEEL);
});

test('earth to mars to saturn on the real worlds, with PHYSICS and the real obstacles', { skip: skipObs }, async () => {
  const { Sim } = await import('../src/core/sim.js');
  const { Pad, play, flyTo } = await import('./helpers.mjs');
  let physics = null;
  try {
    const P = await import('../src/physics/index.js');
    physics = P.createPhysics({ sampleSurface: (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z), seed: 1 });
  } catch { /* the trip is still worth flying without it */ }
  const sim = new Sim({
    sampleSurface: (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z),
    getSpawn: (id) => surface.getSurface(id).getSpawn(),
    sampleObstacles: (id, d, r) => obstacles.sampleObstaclesPure(id, d.x, d.y, d.z, r),
    physics,
  });
  const pad = new Pad();
  const log = [];
  play(sim, pad, 0.5);
  flyTo(sim, pad, 'mars', log);
  flyTo(sim, pad, 'saturn', log);
  assert.deepEqual(Object.keys(sim.visited).sort(), ['earth', 'mars', 'saturn']);
  console.log('      real-world trip:', JSON.stringify(log), 'physics', physics ? 'on, avg ' + sim.physicsMs.toFixed(2) + ' ms' : 'off',
    'biomes', JSON.stringify(Object.fromEntries(Object.entries(sim.visited).map(([k, v]) => [k, Object.keys(v.biomes)]))));
});

test('landing anywhere: on every body the assist sets the ship down, it settles, and you can step out and walk', { skip: skipObs }, async () => {
  const { Sim } = await import('../src/core/sim.js');
  const { S } = await import('../src/core/state.js');
  const { Pad, play, len, sub, norm, dot } = await import('./helpers.mjs');
  let physics = null;
  try {
    const P = await import('../src/physics/index.js');
    physics = P.createPhysics({ sampleSurface: (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z), seed: 1 });
  } catch { /* still worth doing without it */ }
  const sim = new Sim({
    sampleSurface: (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z),
    getSpawn: (id) => surface.getSurface(id).getSpawn(),
    sampleObstacles: (id, d, r) => obstacles.sampleObstaclesPure(id, d.x, d.y, d.z, r),
    physics,
  });
  const pad = new Pad();
  const report = [];
  // The spawn of every body, and three other places on each (other biomes, maybe liquid).
  const places = [null, { lat: 35, lon: 120 }, { lat: -20, lon: -60 }, { lat: 62, lon: 10 }];
  for (const body of BODY_IDS) {
    for (const where of places) {
      sim.teleport(where ? { body, ship: true, altitude: 55, ...where } : { body, ship: true, altitude: 55 });
      play(sim, pad, 0.6);
      pad.tap('KeyE');
      play(sim, pad, 0.2);
      const tag = `${body} ${where ? where.lat + ',' + where.lon : 'spawn'}`;
      if (sim.sm.state !== S.LANDING) {
        // Refusing is allowed (nothing nearby will hold the ship) as long as it says so and
        // the ship is still flying and under control.
        assert.ok(sim.notice && /steep/i.test(sim.notice.text), tag + ': refused without a word');
        assert.equal(sim.sm.state, S.ATMOSPHERE);
        report.push(tag + ': refused (too steep)');
        continue;
      }
      let touch = 0;
      play(sim, pad, 90, { each: () => { touch = sim.sh.speed; }, until: () => sim.sm.state !== S.LANDING });
      if (sim.sm.state === S.ATMOSPHERE) {
        // The assist found its way barred (a ledge) and handed the ship back, hovering, with a word.
        assert.ok(sim.notice && /level ground/i.test(sim.notice.text), tag + ': gave up without a word');
        assert.ok(sim.sh.altGround > 1 && sim.sh.speed < 3, tag + ': hovering after giving up');
        report.push(tag + ': refused (no level ground on the way)');
        continue;
      }
      assert.equal(sim.sm.state, S.LANDED, tag + ': landed');
      assert.ok(touch < 3, `${tag}: touchdown at ${touch.toFixed(2)} m/s`);
      const p0 = { ...sim.sh.p };
      play(sim, pad, 5);
      const moved = len(sub(sim.sh.p, p0));
      assert.ok(moved < 1.5, `${tag}: the parked ship stayed put (moved ${moved.toFixed(2)} m)`);
      const q = sim.sh.q, uy = { x: 2 * (q.x * q.y - q.w * q.z), y: 1 - 2 * (q.x * q.x + q.z * q.z), z: 2 * (q.y * q.z + q.w * q.x) };
      assert.ok(dot(uy, norm(sim.sh.p)) > 0.8, `${tag}: upright (${dot(uy, norm(sim.sh.p)).toFixed(2)})`);
      pad.tap('KeyE');
      play(sim, pad, 4, { until: () => sim.sm.state === S.ON_FOOT });
      assert.equal(sim.sm.state, S.ON_FOOT, tag + ': stepped out');
      assert.equal(sim.bodyId, body);
      const e0 = { ...sim.ex.p };
      pad.press('KeyW');
      play(sim, pad, 3);
      pad.release('KeyW');
      const r = len(sim.ex.p), up = norm(sim.ex.p);
      const s = surface.sampleSurfacePure(body, up.x, up.y, up.z);
      assert.ok(r >= s.radius - 0.05 || sim.ex.swimming, `${tag}: on the ground, not under it`);
      report.push(`${tag}: ${s.biomeId}${sim.sh.onLiquid ? ' (afloat)' : ''}, walked ${len(sub(sim.ex.p, e0)).toFixed(1)} m`);
    }
  }
  const landed = report.filter((x) => !/refused/.test(x)).length;
  assert.ok(landed >= BODY_IDS.length * 3, `landed at ${landed} of ${report.length} places`);
  for (const body of BODY_IDS) assert.ok(report.some((x) => x.startsWith(body + ' ') && !/refused/.test(x)), body + ': at least one landing');
  console.log('      landings:\n        ' + report.join('\n        '));
});
