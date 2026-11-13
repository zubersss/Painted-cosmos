import test from 'node:test';
import assert from 'node:assert/strict';
import { EXPLORER, createExplorerState, stepExplorer, collideObstacles, scrambleSample } from '../src/player/explorer.js';
import { createFootCamera, lookFootCamera, updateFootCamera, CAMERA } from '../src/player/camera.js';
import { stubSurface, stubSpawn } from '../src/core/stubs/surface.js';
import { makeWorld, arc, V, norm, dot, sub, scale, len } from './helpers.mjs';
import { tangent, cross, rotateAround, qRotate, add } from '../src/core/vec.js';

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

test('in a thicket the squeezed third-person view slides into the eyes, and back out when there is room', () => {
  const sample = makeWorld({ R });
  const feet = scale(start, R);
  const cam = createFootCamera(fwd0, start);
  cam.pitch = 0;
  // A crystal (or trunk) 1.6 m behind the explorer, at pivot height: the boom has 0.85 m left.
  const crystal = [{ p: sub(scale(start, R + CAMERA.pivotHeight), scale(fwd0, 1.6)), radius: 0.4 }];
  let pose;
  for (let i = 0; i < 120; i++) pose = updateFootCamera(cam, feet, DT, sample, undefined, crystal);
  assert.ok(cam.tight01 > 0.95, 'the view is the explorer\'s own: ' + cam.tight01);
  const eye = add(scale(start, R + 1.62), scale(fwd0, 0.1));
  assert.ok(len(sub(pose.p, eye)) < 0.15, 'camera at eye height, at the face: ' + len(sub(pose.p, eye)));
  assert.ok(dot(pose.look, fwd0) > 0.99, 'looking where the player looks');
  assert.ok(len(sub(pose.p, crystal[0].p)) > 0.4 + 0.3, 'never inside the crystal');
  // Half squeezed (a hull 3.4 m behind): partly forward, never a jump.
  const cam2 = createFootCamera(fwd0, start); cam2.pitch = 0;
  const hull = [{ p: sub(scale(start, R + CAMERA.pivotHeight), scale(fwd0, 3.4)), radius: 1.2 }];
  let last = null, worst = 0;
  for (let i = 0; i < 180; i++) {
    const q = updateFootCamera(cam2, feet, DT, sample, undefined, i < 90 ? hull : []);
    // (The boom snaps in within a few frames when something appears behind the explorer: that
    // is the old rule. What is measured here is everything after it, and the way back out.)
    if (last && i > 20) worst = Math.max(worst, len(sub(q.p, last.p)));
    last = q;
    if (i === 89) assert.ok(cam2.tight01 > 0.05 && cam2.tight01 < 0.95, 'half squeezed is half way: ' + cam2.tight01);
  }
  assert.ok(worst < 0.25, 'the way back out is continuous (largest step ' + worst.toFixed(2) + ' m a frame)');
  // Room again: third person, full boom.
  for (let i = 0; i < 300; i++) pose = updateFootCamera(cam, feet, DT, sample, undefined, []);
  assert.ok(cam.tight01 === 0 && Math.abs(cam.boomNow - CAMERA.boom) < 0.05);
});

test('tree trunks are solid: walking into one slides round it; the jetpack goes over', () => {
  const env = { sample: makeWorld({ R }), gravity: 9 };
  const st = createExplorerState(scale(start, R), fwd0);
  // A trunk 6 m ahead, a little off the line of travel.
  const right = cross(fwd0, start);
  const trunkDir = norm(sub(start, scale(sub(scale(fwd0, -6), scale(right, 0.15)), 1 / R)));
  const trunk = [{ unitDir: trunkDir, radius: 0.4, height: 12 }];
  let minGap = Infinity;
  for (let i = 0; i < 5 / DT; i++) {
    stepExplorer(st, { moveZ: 1, viewFwd: fwd0 }, DT, env);
    collideObstacles(st, trunk);
    minGap = Math.min(minGap, arc(st.p, trunkDir, R));
  }
  assert.ok(minGap >= 0.4 + 0.35 - 1e-3, 'never inside the trunk: ' + minGap);
  assert.ok(arc(st.p, start, R) > 14, 'slid round it and kept going: ' + arc(st.p, start, R));
  assert.ok(Math.abs(len(st.p) - R) < 1e-6 && st.grounded, 'still on the ground');
  // Above the top of the obstacle nothing is hit.
  const air = createExplorerState(scale(trunkDir, R + 13), fwd0);
  air.altitude = 13; air.grounded = false;
  assert.equal(collideObstacles(air, trunk), 0);
  assert.equal(collideObstacles(st, []), 0);
});

test('a low boulder dead ahead is walked over, not into: the run does not stall', () => {
  const right = cross(fwd0, start);
  const at = (ahead, side) => norm(add(start, add(scale(fwd0, ahead / R), scale(right, side / R))));
  // The two rocks that stopped a run dead at Mars' spawn: knee-high and waist-high, side by side.
  const rocks = [{ unitDir: at(6, -0.5), radius: 0.6, height: 0.48 }, { unitDir: at(6.8, 0.9), radius: 1.22, height: 0.99 }];
  const env = { sample: scrambleSample(makeWorld({ R }), () => rocks), gravity: 3.7 };
  const st = createExplorerState(scale(start, R), fwd0);
  let top = 0, slowest = Infinity, steps = 0;
  for (let i = 0; i < 4 / DT; i++) {
    stepExplorer(st, { moveZ: 1, run: true, viewFwd: fwd0 }, DT, env);
    collideObstacles(st, rocks, undefined, { moving: true, dt: DT });
    top = Math.max(top, len(st.p) - R);
    if (i * DT > 0.6) slowest = Math.min(slowest, st.speed);
    steps++;
  }
  assert.ok(arc(st.p, start, R) > 22, 'kept running: ' + arc(st.p, start, R).toFixed(1) + ' m in 4 s');
  assert.ok(top > 0.3 && top < 1.05, 'went up and over the rocks: ' + top.toFixed(2) + ' m');
  assert.ok(slowest > 3, 'never slowed to a crawl: ' + slowest.toFixed(1) + ' m/s');
  assert.ok(Math.abs(len(st.p) - R) < 1e-3 && st.grounded, 'back on the ground after them');
});

test('wedged between two trunks with the key held, the explorer walks round one of them', () => {
  const right = cross(fwd0, start);
  const at = (ahead, side) => norm(add(start, add(scale(fwd0, ahead / R), scale(right, side / R))));
  // Two crystals a body's width apart, straight ahead: a pocket with no way through the middle.
  const pair = [{ unitDir: at(6, -1.05), radius: 0.99, height: 4.4 }, { unitDir: at(6, 1.1), radius: 1.04, height: 4.6 }];
  const env = { sample: makeWorld({ R }), gravity: 3.7 };
  const st = createExplorerState(scale(start, R), fwd0);
  let minGap = Infinity;
  for (let i = 0; i < 8 / DT; i++) {
    stepExplorer(st, { moveZ: 1, viewFwd: fwd0 }, DT, env);
    collideObstacles(st, pair, undefined, { moving: true, dt: DT });
    for (const o of pair) minGap = Math.min(minGap, arc(st.p, o.unitDir, R) - o.radius);
  }
  assert.ok(minGap >= 0.3, 'never inside a crystal (two pushes in turn may overlap by millimetres): ' + minGap.toFixed(3));
  assert.ok(dot(sub(st.p, scale(start, R)), fwd0) > 14, 'got past them: ' + dot(sub(st.p, scale(start, R)), fwd0).toFixed(1) + ' m ahead after 8 s');
  // With the key let go nothing moves the explorer.
  const idle = createExplorerState(scale(at(4.9, 0), R), fwd0);
  for (let i = 0; i < 2 / DT; i++) { stepExplorer(idle, { viewFwd: fwd0 }, DT, env); collideObstacles(idle, pair, undefined, { moving: false, dt: DT }); }
  assert.ok(idle.speed < 0.05 && !idle.detour, 'standing in the pocket, the explorer stands');
});

test('the suit\'s share of the wind: a little of it in the pace on the ground, most of a gale held off in the air', () => {
  // PHYSICS' body is replaced by a recorder: this checks the command PILOT sends it.
  const R = 4000, p0 = V(0, R, 0);
  const world = makeWorld({ R });
  const command = (wind, { grounded = true, altitude = 0, keys = { moveZ: 1 } } = {}) => {
    let seen = null;
    const env = {
      sample: world, gravity: 9,
      air: (p, out) => { out.wind = wind; out.density = 1.2; return out; },
      bodyStep: (st, cmd) => { seen = { shelter01: cmd.shelter01, wish: Math.hypot(cmd.wish.x, cmd.wish.y, cmd.wish.z) }; },
    };
    const st = createExplorerState(scale(p0, 1 + altitude / R), V(0, 0, -1));
    st.grounded = grounded; st.altitude = altitude;
    stepExplorer(st, { viewFwd: V(0, 0, -1), ...keys }, 1 / 60, env);
    return seen;
  };
  const walk = EXPLORER.walkSpeed;
  // On the ground: nothing cancelled (the lean and the push are PHYSICS' own); the pace gives a little.
  const calm = command(V(0, 0, 0)), head = command(V(0, 0, 19)), tail = command(V(0, 0, -19)), side = command(V(19, 0, 0));
  assert.equal(calm.shelter01, 0);
  assert.ok(Math.abs(calm.wish - walk) < 1e-9, 'still air: the walking pace');
  assert.ok(head.wish < walk * 0.8 && head.wish > 3, `into a 19 m/s wind: ${head.wish.toFixed(2)} m/s`);
  assert.ok(tail.wish > walk * 1.05 && tail.wish <= walk * EXPLORER.windPaceMax + 1e-9, `with it: ${tail.wish.toFixed(2)} m/s`);
  assert.ok(Math.abs(side.wish - walk) < 1e-9, 'across it: the walking pace');
  assert.equal(head.shelter01, 0);
  // No heading asks for less than 3 m/s, in any gale.
  for (const w of [30, 45, 60]) assert.ok(command(V(0, 0, w)).wish >= 3, `into ${w} m/s: ${command(V(0, 0, w)).wish.toFixed(2)} m/s`);
  // Standing still asks for nothing.
  assert.equal(command(V(0, 0, 30), { keys: {} }).wish, 0);
  // Off the ground: a breeze is left alone, a gale is cut to what a wind of windAirCap would do.
  assert.equal(command(V(0, 0, 8), { grounded: false, altitude: 10 }).shelter01, 0);
  const gale = command(V(0, 0, 40), { grounded: false, altitude: 10 });
  assert.ok(Math.abs(gale.shelter01 - (1 - (EXPLORER.windAirCap / 40) ** 2)) < 1e-9, `40 m/s in the air: shelter ${gale.shelter01.toFixed(3)}`);
  assert.ok(gale.shelter01 > 0.85 && gale.shelter01 < 1);
});

test('a rise at the explorer\'s back lifts the third-person camera, and the explorer stays in the frame', () => {
  // Review 6 (second half): under a rise the lifted camera kept aiming 9 m ahead and showed only the
  // top of the hat (Neptune's storm_seas vista). Before the fix a 25 m bank put the feet 1.35 half-heights
  // from the middle of the view (out of the frame).
  const R = 4000, feetDir = norm({ x: 0, y: 0, z: 1 }), f = { x: 1, y: 0, z: 0 };
  for (const hill of [null, { h: 12, at: 9, r: 7 }, { h: 25, at: 10, r: 9 }]) {
    const world = makeWorld({ R, hill: hill ? { dir: norm({ x: -hill.at / R, y: 0, z: 1 }), radius: hill.r, height: hill.h } : null });
    const feet = scale(feetDir, world(feetDir).radius);
    const cam = createFootCamera(f, feetDir);
    let pose; for (let i = 0; i < 120; i++) pose = updateFootCamera(cam, feet, 1 / 30, world);
    const look = qRotate(pose.q, { x: 0, y: 0, z: -1 }), toF = norm(sub(feet, pose.p));
    const k = Math.acos(Math.min(1, dot(look, toF))) / ((CAMERA.fovFoot * Math.PI) / 360);
    if (hill) assert.ok(cam.lift > 3, `the boom lifts over the rise (${cam.lift.toFixed(2)} m)`);
    assert.ok(k < 0.9, `${hill ? hill.h + ' m rise' : 'level'}: the feet ${k.toFixed(2)} of the half-height from the middle`);
    if (!hill) assert.ok(k > 0.6, 'level ground: the explorer in the lower third as before');
    assert.ok(len(sub(pose.p, feet)) > 2, 'the camera is not in the explorer');
  }
});

// ---- M4: a swimmer (PHYSICS' critique of PILOT, item 5: "make sure the controls suit a swimmer") ----
test('M4 afloat: Space does not hop a swimmer; held, the jetpack lifts them out; a swimmer comes round, it does not spin', () => {
  const world = makeWorld({ R: R - 6, sea: R });
  const env = { sample: world, gravity: 9 };
  const st = createExplorerState(scale(start, R - EXPLORER.swimDepth), fwd0);
  st.grounded = false;
  run(st, env, 1, { viewFwd: fwd0 });
  assert.ok(st.swimming);
  // a tap of Space: no hop (it was a 4.8 m/s jump off the water)
  let top = -Infinity;
  stepExplorer(st, { jump: true, jet: true, viewFwd: fwd0 }, DT, env);
  for (let i = 0; i < 0.1 / DT; i++) { stepExplorer(st, { viewFwd: fwd0 }, DT, env); top = Math.max(top, dot(st.v, norm(st.p))); }
  assert.ok(top < 0.6, 'no hop: rising at ' + top.toFixed(2) + ' m/s at most');
  assert.ok(st.swimming, 'still afloat');
  // held: the jetpack lights after its short delay and lifts the swimmer out
  run(st, env, 1.6, { jet: true, viewFwd: fwd0 });
  assert.ok(len(st.p) > R + 3, 'the jetpack lifted them out: ' + (len(st.p) - R).toFixed(1) + ' m');
  // turning: asked to swim the other way, the body comes round in about a second, not in a tenth
  const sw = createExplorerState(scale(start, R - EXPLORER.swimDepth), fwd0);
  sw.grounded = false;
  run(sw, env, 1, { viewFwd: fwd0, moveZ: 1 });
  const turnTime = (s, e, inp) => { let t = 0; const f0 = { ...s.fwd }; while (t < 5 && dot(s.fwd, f0) > -0.7) { stepExplorer(s, inp, DT, e); t += DT; } return t; };
  const side = rotateAround(fwd0, start, 0.2);
  const tSwim = turnTime(sw, env, { viewFwd: side, moveZ: -1 });
  const walker = createExplorerState(scale(start, R), fwd0), land = { sample: makeWorld({ R }), gravity: 9 };
  run(walker, land, 1, { viewFwd: fwd0, moveZ: 1 });
  const tWalk = turnTime(walker, land, { viewFwd: side, moveZ: -1 });
  assert.ok(tSwim > 0.5 && tSwim < 2, `a swimmer comes about in ${tSwim.toFixed(2)} s`);
  assert.ok(tSwim > 2.5 * tWalk, `a walker in ${tWalk.toFixed(2)} s`);
});

// ---- M4: the jetpack on a light world (PHYSICS' critique of PILOT, item 8) -----------------------
test('M4 burn and coast: the tank refills only on the ground or afloat, so no burn-and-coast keeps the explorer up, on any world', () => {
  // A player who wants to stay up: burns the tank down to `lo` to climb, coasts over the top and down,
  // and burns again when falling under `H` m. (The re-fix pass: with a slow refill in the air Pluto
  // stayed up for ever burning to a half and relighting under 8 m: 42 relights in 1200 s.)
  const aloft = (gravity, lo, H, seconds = 600) => {
    const env = { sample: makeWorld({ R }), gravity };
    const st = createExplorerState(scale(start, R), fwd0);
    stepExplorer(st, { jump: true, jet: true, viewFwd: fwd0 }, DT, env);
    let t = 0, landed = null, rose = 0, burn = true, last = st.fuel;
    for (; t < seconds; t += DT) {
      if (burn && st.fuel < lo) burn = false;
      else if (!burn && dot(st.v, norm(st.p)) < 0 && st.altitude < H) burn = true;
      stepExplorer(st, { jet: burn, viewFwd: fwd0 }, DT, env);
      if (!st.grounded && !st.swimming && st.fuel > last + 1e-12) rose++;
      last = st.fuel;
      if (t > 3 && st.grounded) { landed = t; break; }
    }
    return { landed, rose };
  };
  for (const [name, g] of [['Jupiter', 11.5], ['Earth', 9], ['Mars', 4.6], ['the Moon', 2.2], ['Pluto', 1.4]]) {
    for (const [lo, H] of [[0.03, 14], [0.5, 8], [0.4, 8], [0.3, 8], [0.7, 4]]) {
      const r = aloft(g, lo, H);
      assert.equal(r.rose, 0, `${name}, burn to ${lo}, relight under ${H} m: the tank never rises in the air`);
      assert.ok(r.landed != null, `${name}, burn to ${lo}, relight under ${H} m: the explorer comes down (${r.landed == null ? 'never' : 'after ' + r.landed.toFixed(0) + ' s'})`);
    }
    assert.ok(aloft(g, 0.03, 14).landed > 4, `${name}: a good flight all the same`);
  }
  // on the ground it refills in rechargeGroundSeconds, as before
  const env = { sample: makeWorld({ R }), gravity: 9 };
  const st = createExplorerState(scale(start, R), fwd0);
  st.fuel = 0;
  for (let t = 0; t < EXPLORER.rechargeGroundSeconds + 0.1; t += DT) stepExplorer(st, { viewFwd: fwd0 }, DT, env);
  assert.equal(st.fuel, 1);
});
