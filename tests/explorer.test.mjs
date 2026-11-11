import test from 'node:test';
import assert from 'node:assert/strict';
import { EXPLORER, createExplorerState, stepExplorer } from '../src/player/explorer.js';
import { createFootCamera, lookFootCamera, updateFootCamera, CAMERA } from '../src/player/camera.js';
import { stubSurface, stubSpawn } from '../src/core/stubs/surface.js';
import { makeWorld, arc, V, norm, dot, sub, scale, len } from './helpers.mjs';
import { tangent, cross, rotateAround, qRotate } from '../src/core/vec.js';

const DT = 1 / 60;
const R = 4000;
const start = norm(V(0.2, 0.3, 0.93));
function run(st, env, seconds, input) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) stepExplorer(st, typeof input === 'function' ? input(i * DT, st) : input, DT, env);
  return st;
}
const fwd0 = tangent(V(0, 0, -1), start);

test('walks at walking speed along the ground and stays on it', () => {
  const env = { sample: makeWorld({ R }), gravity: 9 };
  const st = createExplorerState(scale(start, R), fwd0);
  run(st, env, 3, { moveZ: 1, viewFwd: fwd0 });
  assert.ok(Math.abs(st.speed - EXPLORER.walkSpeed) < 0.05, 'speed ' + st.speed);
  assert.ok(st.grounded);
  assert.ok(Math.abs(len(st.p) - R) < 1e-6, 'feet on the sphere');
  const d = arc(st.p, start, R);
  assert.ok(d > 11.5 && d < 12.7, 'distance ' + d);
  assert.equal(st.mode, 'walk');
  run(st, env, 0.6, { viewFwd: fwd0 });
  assert.ok(st.speed < 0.01, 'stops quickly when the keys are released');
  assert.equal(st.mode, 'idle');
});

test('runs with Shift, strafes, and the body turns to face where it goes', () => {
  const env = { sample: makeWorld({ R }), gravity: 9 };
  const st = createExplorerState(scale(start, R), fwd0);
  run(st, env, 2, { moveZ: 1, run: true, viewFwd: fwd0 });
  assert.ok(Math.abs(st.speed - EXPLORER.runSpeed) < 0.05);
  const right = cross(fwd0, start);
  run(st, env, 1.5, { moveX: 1, viewFwd: fwd0 });
  assert.ok(dot(st.fwd, tangent(right, norm(st.p))) > 0.95, 'faces right');
  assert.ok(Math.abs(dot(st.fwd, norm(st.p))) < 1e-9, 'facing stays tangent to the ground');
});

test('can walk all the way around a small planet and come home', () => {
  const r = 60;                                       // a tiny world keeps the test fast
  const env = { sample: makeWorld({ R: r }), gravity: 9 };
  const st = createExplorerState(scale(start, r), fwd0);
  let view = fwd0, total = 0, prev = { ...st.p };
  const T = (2 * Math.PI * r) / EXPLORER.walkSpeed;
  for (let i = 0; i < Math.round(T / DT); i++) {
    view = tangent(view, norm(st.p), view);
    stepExplorer(st, { moveZ: 1, viewFwd: view }, DT, env);
    total += len(sub(st.p, prev)); prev = { ...st.p };
  }
  assert.ok(Math.abs(total - 2 * Math.PI * r) < 3, 'walked one circumference: ' + total);
  assert.ok(arc(st.p, start, r) < 3, 'back where we began: ' + arc(st.p, start, r));
  assert.ok(st.grounded);
});

test('gravity pulls toward the centre from anywhere, and falling is cushioned', () => {
  for (const dir of [V(0, 1, 0), V(0, -1, 0), V(1, 0, 0), norm(V(-0.5, -0.6, 0.6))]) {
    const env = { sample: makeWorld({ R }), gravity: 9 };
    const st = createExplorerState(scale(dir, R + 30), tangent(V(0.3, 0.2, -1), dir));
    st.grounded = false;
    let maxDown = 0, touch = 0;
    for (let i = 0; i < 600 && !st.grounded; i++) {
      stepExplorer(st, { viewFwd: st.fwd }, DT, env);
      const vd = -dot(st.v, norm(st.p));
      if (!st.grounded) { maxDown = Math.max(maxDown, vd); touch = vd; }
    }
    assert.ok(st.grounded, 'landed');
    assert.ok(Math.abs(len(st.p) - R) < 1e-6);
    assert.ok(arc(st.p, dir, R) < 0.01, 'fell straight down');
    assert.ok(maxDown <= EXPLORER.terminalFall + 1e-6);
    assert.ok(touch < EXPLORER.softFallSpeed + 3, 'soft touchdown: ' + touch);
  }
});

test('jump is a light hop; holding Space lights the jetpack; fuel drains and recharges', () => {
  const env = { sample: makeWorld({ R }), gravity: 9 };
  const st = createExplorerState(scale(start, R), fwd0);
  // A tap: hop only.
  let top = 0;
  stepExplorer(st, { jump: true, jet: true, viewFwd: fwd0 }, DT, env);
  for (let i = 0; i < 200 && !st.grounded; i++) { stepExplorer(st, { viewFwd: fwd0 }, DT, env); top = Math.max(top, st.altitude); }
  assert.ok(top > 0.9 && top < 1.7, 'hop height ' + top);
  assert.equal(st.fuel, 1);
  // Hold: jetpack.
  stepExplorer(st, { jump: true, jet: true, viewFwd: fwd0 }, DT, env);
  run(st, env, 2, { jet: true, viewFwd: fwd0 });
  assert.equal(st.mode, 'jet');
  assert.ok(st.altitude > 9, 'climbed ' + st.altitude);
  assert.ok(dot(st.v, norm(st.p)) <= EXPLORER.jetMaxRise + 1e-6, 'climb speed is capped');
  assert.ok(st.fuel < 0.6 && st.fuel > 0.4, 'fuel ' + st.fuel);
  // Burn it all: thrust stops, we come down, nothing breaks.
  run(st, env, 4, { jet: true, viewFwd: fwd0 });
  assert.ok(st.fuel < 0.05, 'tank empty: ' + st.fuel);
  assert.ok(!st.jetting || st.fuel === 0);
  let n = 0;
  while (!st.grounded && n++ < 2000) stepExplorer(st, { viewFwd: fwd0 }, DT, env);
  assert.ok(st.grounded);
  const before = st.fuel;
  run(st, env, EXPLORER.rechargeGroundSeconds * 0.5, { viewFwd: fwd0 });
  assert.ok(st.fuel > before + 0.4, 'recharges on the ground');
  run(st, env, EXPLORER.rechargeGroundSeconds, { viewFwd: fwd0 });
  assert.equal(st.fuel, 1);
});

test('the jetpack steers in the air', () => {
  const env = { sample: makeWorld({ R }), gravity: 9 };
  const st = createExplorerState(scale(start, R), fwd0);
  stepExplorer(st, { jump: true, jet: true, viewFwd: fwd0 }, DT, env);
  run(st, env, 2.5, { jet: true, moveZ: 1, viewFwd: fwd0 });
  assert.ok(st.speed > 3.5, 'forward speed in the air ' + st.speed);
  assert.ok(arc(st.p, start, R) > 5);
});

test('slope limit: a steep cone cannot be walked up, a gentle one can', () => {
  for (const [height, climbs] of [[40, false], [8, true]]) {
    const hillDir = norm(sub(start, scale(fwd0, -0.008)));       // about 32 m ahead
    const world = makeWorld({ R, hill: { dir: hillDir, radius: 25, height } });   // 58 deg or 18 deg sides
    const env = { sample: world, gravity: 9 };
    const st = createExplorerState(scale(start, world(start).radius), fwd0);
    const toHill = tangent(sub(hillDir, start), start);
    let view = toHill;
    for (let i = 0; i < 20 / DT; i++) {
      view = tangent(sub(hillDir, norm(st.p)), norm(st.p), view);
      stepExplorer(st, { moveZ: 1, viewFwd: view }, DT, env);
    }
    const gained = len(st.p) - R;
    if (climbs) assert.ok(gained > height * 0.9, 'reached the top: ' + gained);
    else assert.ok(gained < 3, 'stopped at the foot of the steep slope: ' + gained);
    assert.ok(st.grounded);
  }
});

test('placed on a very steep face, the explorer slides down instead of sticking', () => {
  const hillDir = start;
  const world = makeWorld({ R, hill: { dir: hillDir, radius: 30, height: 70 } });     // 67 deg
  const env = { sample: world, gravity: 9 };
  const side = norm(sub(start, scale(fwd0, -15 / R)));
  const st = createExplorerState(scale(side, world(side).radius), fwd0);
  const h0 = len(st.p);
  run(st, env, 3, { viewFwd: fwd0 });
  assert.ok(len(st.p) < h0 - 5, 'slid down ' + (h0 - len(st.p)));
});

test('wading slows you down; deep liquid floats you; you can walk out again', () => {
  const bowlDir = norm(sub(start, scale(fwd0, -40 / R)));          // a pond 40 m ahead
  const world = makeWorld({ R, sea: R - 0.01, bowl: { dir: bowlDir, radius: 25, depth: 4 } });
  const env = { sample: world, gravity: 9 };
  const st = createExplorerState(scale(start, world(start).radius), fwd0);
  let view = tangent(sub(bowlDir, start), start);
  let minSpeedWading = 99, sawWade = false, sawSwim = false, maxDepth = 0;
  for (let i = 0; i < 40 / DT; i++) {
    view = tangent(view, norm(st.p), view);
    stepExplorer(st, { moveZ: 1, viewFwd: view }, DT, env);
    if (st.mode === 'wade') sawWade = true;
    if (st.swimming) { sawSwim = true; assert.ok(Math.abs(st.liquidDepth - EXPLORER.swimDepth) < 0.7, 'floats near the surface: ' + st.liquidDepth); }
    else if (st.grounded && st.liquidDepth > 0.8) minSpeedWading = Math.min(minSpeedWading, st.speed);
    maxDepth = Math.max(maxDepth, st.liquidDepth);
  }
  assert.ok(sawWade, 'waded');
  assert.ok(sawSwim, 'floated over the deep middle');
  assert.ok(minSpeedWading < EXPLORER.walkSpeed * 0.75, 'slower in the water: ' + minSpeedWading);
  assert.ok(maxDepth < 2.3, 'never sinks to the bottom: ' + maxDepth);
  assert.ok(st.liquidDepth === 0 && st.grounded, 'came out the other side');
  assert.ok(arc(st.p, start, R) > 60);
});

test('the jetpack lifts you out of deep liquid', () => {
  const world = makeWorld({ R: R - 6, sea: R });
  const env = { sample: world, gravity: 9 };
  const st = createExplorerState(scale(start, R - EXPLORER.swimDepth), fwd0);
  st.grounded = false;
  run(st, env, 1, { viewFwd: fwd0 });
  assert.ok(st.swimming);
  stepExplorer(st, { jump: true, jet: true, viewFwd: fwd0 }, DT, env);
  run(st, env, 1.5, { jet: true, viewFwd: fwd0 });
  assert.ok(len(st.p) > R + 3, 'rose out of the water: ' + (len(st.p) - R));
});

test('on the real stub terrain: an hour of wandering never falls through or flies off', () => {
  const sample = (d) => stubSurface('earth', d);
  const env = { sample, gravity: 9 };
  const sp = stubSpawn('earth').unitDir;
  const st = createExplorerState(scale(sp, sample(sp).radius), tangent(V(0, 1, 0), sp));
  let view = st.fwd, rng = 7;
  const rand = () => { rng = (Math.imul(rng, 1664525) + 1013904223) | 0; return (rng >>> 0) / 4294967296; };
  let input = { moveZ: 1, viewFwd: view };
  for (let i = 0; i < 3600 / DT; i += 1) {
    if (i % 240 === 0) {
      view = rotateAround(view, norm(st.p), (rand() - 0.5) * 2);
      input = { moveZ: 1, moveX: rand() < 0.2 ? 1 : 0, run: rand() < 0.5, jet: rand() < 0.3, jump: rand() < 0.3 };
    }
    view = tangent(view, norm(st.p), view);
    stepExplorer(st, { ...input, viewFwd: view, jump: input.jump && i % 240 === 0 }, DT, env);
    if (i % 20 === 0) {
      const s = sample(norm(st.p));
      assert.ok(len(st.p) >= s.radius - 1e-6, 'never under the ground');
      assert.ok(len(st.p) < s.radius + 60, 'never flies away');
      assert.ok(Number.isFinite(st.p.x + st.v.x + st.fuel));
    }
  }
});

// ---- cameras ---------------------------------------------------------------------------------
test('third-person camera never goes under the ground or a liquid surface', () => {
  const sample = (d) => stubSurface('earth', d);
  const env = { sample, gravity: 9 };
  for (const seed of [1, 2, 3]) {
    let rng = seed * 977;
    const rand = () => { rng = (Math.imul(rng, 1664525) + 1013904223) | 0; return (rng >>> 0) / 4294967296; };
    // Start somewhere rough: search for a steep place.
    let best = null;
    for (let i = 0; i < 4000; i++) {
      const d = norm(V(rand() * 2 - 1, rand() * 1.2 - 0.6, rand() * 2 - 1));
      const s = sample(d);
      if (!s.isLiquid && (!best || s.slope > best.slope)) best = { d, slope: s.slope, s };
    }
    assert.ok(best.slope > 0.7, 'found steep terrain to test on');
    const st = createExplorerState(scale(best.d, best.s.radius), tangent(V(0, 1, 0), best.d));
    const cam = createFootCamera(st.fwd, best.d);
    let minClear = Infinity;
    for (let i = 0; i < 90 / DT; i++) {
      if (i % 30 === 0) lookFootCamera(cam, norm(st.p), (rand() - 0.5) * 1.5, (rand() - 0.5) * 1.2);
      stepExplorer(st, { moveZ: rand() < 0.8 ? 1 : 0, run: true, jet: i % 600 < 200, jump: i % 600 === 0, viewFwd: cam.viewFwd }, DT, env);
      const pose = updateFootCamera(cam, st.p, DT, sample);
      const s = sample(norm(pose.p));
      const clear = len(pose.p) - Math.max(s.radius, s.liquidRadius || 0);
      minClear = Math.min(minClear, clear);
      // Looks roughly where it is pointed and stays upright.
      assert.ok(dot(qRotate(pose.q, V(0, 1, 0)), norm(pose.p)) > 0.2, 'camera stays upright');
    }
    assert.ok(minClear >= CAMERA.clearance * 0.95, `seed ${seed}: clearance ${minClear}`);
  }
});

test('first-person camera sits at eye height and looks where the mouse points', () => {
  const sample = makeWorld({ R });
  const cam = createFootCamera(fwd0, start);
  cam.firstPerson = true;
  const feet = scale(start, R);
  let pose = updateFootCamera(cam, feet, DT, sample);
  assert.ok(Math.abs(len(pose.p) - R - 1.62) < 0.02);
  assert.ok(dot(qRotate(pose.q, V(0, 0, -1)), fwd0) > 0.98);
  lookFootCamera(cam, start, Math.PI / 2, 0);                      // mouse right by 90 degrees
  pose = updateFootCamera(cam, feet, DT, sample);
  assert.ok(dot(qRotate(pose.q, V(0, 0, -1)), cross(fwd0, start)) > 0.98, 'turned right');
  lookFootCamera(cam, start, 0, -10);                              // mouse far up
  assert.equal(cam.pitch, CAMERA.pitchMax);
  lookFootCamera(cam, start, 0, 10);
  assert.equal(cam.pitch, CAMERA.pitchMin);
});

test('third-person camera stops in front of the ship instead of going inside it', () => {
  const sample = makeWorld({ R });
  const feet = scale(start, R);
  const cam = createFootCamera(fwd0, start);
  cam.pitch = 0;
  // A hull sphere 4 m behind the explorer, at pivot height.
  const hull = [{ p: sub(scale(start, R + CAMERA.pivotHeight), scale(fwd0, 4)), radius: 1.5 }];
  let pose;
  for (let i = 0; i < 120; i++) pose = updateFootCamera(cam, feet, DT, sample, undefined, hull);
  const d = len(sub(pose.p, hull[0].p));
  assert.ok(d >= 1.5 + 0.2, 'camera is outside the hull: ' + d);
  assert.ok(len(sub(pose.p, feet)) < 4, 'pulled in toward the explorer');
  // With nothing in the way the boom is full length again.
  for (let i = 0; i < 240; i++) pose = updateFootCamera(cam, feet, DT, sample, undefined, []);
  assert.ok(Math.abs(cam.boomNow - CAMERA.boom) < 0.05);
});
