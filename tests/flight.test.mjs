import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SHIP, createShipState, stepFlight, beginLiftoff, beginLanding, stepLanding, stepLanded,
  findLandingSite, restOnSurface, floorAt, maxSpeedAt,
} from '../src/ship/flight.js';
import { createShipCamera, updateShipCamera, CAMERA } from '../src/player/camera.js';
import { stubSurface } from '../src/core/stubs/surface.js';
import { makeWorld, V, norm, dot, sub, scale, len, arc } from './helpers.mjs';
import { tangent, cross, qLook, qRotate, add } from '../src/core/vec.js';

const DT = 1 / 60, R = 4000, SPACE_ALT = 800;
const start = norm(V(0.1, 0.5, 0.86));
const north = tangent(V(0, 1, 0), start);
const fwdOf = (st) => qRotate(st.q, V(0, 0, -1));
const upOf = (st) => qRotate(st.q, V(0, 1, 0));
function envFor(st, sample, extra = {}) {
  const r = len(st.p);
  return { up: scale(st.p, 1 / r), universeUp: V(0, 1, 0), upWeight: 1, altitude: r - R, spaceAlt: SPACE_ALT, hasBody: true, sample, ...extra };
}
function fly(st, sample, seconds, input = {}, each) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) {
    const inp = typeof input === 'function' ? input(st, i * DT) : input;
    stepFlight(st, inp, DT, envFor(st, sample));
    if (each) each(st);
  }
  return st;
}
function hovering(sample, alt = 40, heading = north) {
  const st = createShipState(scale(start, sample(start).radius + alt), qLook(heading, start));
  st.gear01 = 0;
  return st;
}

test('lift-off: straight up to the hover height, gear up, then it hangs there', () => {
  const sample = makeWorld({ R });
  const st = restOnSurface(sample, start, north);
  assert.ok(Math.abs(len(st.p) - R) < 1e-9, 'rests on the ground');
  beginLiftoff(st);
  let maxV = 0;
  fly(st, sample, SHIP.liftoffSeconds + 0.1, {}, (s) => { maxV = Math.max(maxV, s.speed); });
  assert.equal(st.liftoff, null);
  assert.ok(Math.abs(len(st.p) - R - SHIP.hoverHeight) < 0.05, 'hover height ' + (len(st.p) - R));
  assert.ok(arc(st.p, start, R) < 0.01, 'no sideways drift');
  assert.ok(st.gear01 < 0.05);
  assert.ok(maxV < 8, 'a gentle rise: ' + maxV);
  const p = { ...st.p };
  fly(st, sample, 10);
  assert.ok(len(sub(st.p, p)) < 0.05, 'hovers without input');
});

test('throttle is persistent, speed follows it, X stops', () => {
  const sample = makeWorld({ R });
  const st = hovering(sample, 300);
  fly(st, sample, 1, { throttle: 1 });
  assert.ok(st.throttle > 0.5 && st.throttle < 0.6, 'half a second of W is about half throttle');
  fly(st, sample, 2, { throttle: 1 });
  assert.equal(st.throttle, 1);
  fly(st, sample, 6);
  const vmax = maxSpeedAt(300, SPACE_ALT, true);
  assert.ok(Math.abs(st.speed - vmax) < vmax * 0.05, `cruise ${st.speed} vs ${vmax}`);
  assert.ok(dot(norm(st.v), fwdOf(st)) > 0.995, 'flies where the nose points');
  fly(st, sample, 4, { cut: true });
  assert.ok(st.throttle < 0.01 && st.speed < 1, 'stopped: ' + st.speed);
  fly(st, sample, 1.5, { throttle: -1 });
  assert.ok(st.throttle >= SHIP.reverseMax - 1e-9 && st.throttle < 0, 'a little reverse');
});

test('speed limits rise with altitude: slow by the ground, fast in space', () => {
  assert.equal(maxSpeedAt(0, SPACE_ALT, true), SHIP.speedGround);
  assert.ok(maxSpeedAt(400, SPACE_ALT, true) > SHIP.speedGround * 1.5);
  assert.ok(Math.abs(maxSpeedAt(SPACE_ALT, SPACE_ALT, true) - SHIP.speedAtmoTop) < 1e-9);
  assert.equal(maxSpeedAt(SPACE_ALT * 6, SPACE_ALT, true), SHIP.speedSpace);
  assert.equal(maxSpeedAt(0, 1, false), SHIP.speedSpace);
  let prev = 0;
  for (let a = 0; a < SPACE_ALT * 6; a += 50) { const v = maxSpeedAt(a, SPACE_ALT, true); assert.ok(v >= prev - 1e-9); prev = v; }
});

test('mouse right turns right, banks into the turn, and the wings level by themselves', () => {
  const sample = makeWorld({ R });
  const st = hovering(sample, 200);
  const f0 = fwdOf(st);
  const east = cross(f0, start);
  let maxBank = 0;
  fly(st, sample, 1.5, () => ({ aimX: 0.01, throttle: 1 }), (s) => {
    const rWant = norm(cross(fwdOf(s), norm(s.p)));
    const r = qRotate(s.q, V(1, 0, 0));
    const roll = Math.atan2(dot(cross(rWant, r), fwdOf(s)), dot(rWant, r));
    maxBank = Math.max(maxBank, roll);
  });
  assert.ok(dot(fwdOf(st), east) > 0.5, 'turned right');
  assert.ok(maxBank > 0.15 && maxBank <= SHIP.maxBank + 0.05, 'banked right: ' + maxBank);
  fly(st, sample, 3);
  const up = norm(st.p);
  assert.ok(Math.abs(dot(qRotate(st.q, V(1, 0, 0)), up)) < 0.03, 'wings level again');
  // Keys turn too.
  const f1 = fwdOf(st);
  fly(st, sample, 1, { yawKey: -1 });
  assert.ok(dot(cross(f1, fwdOf(st)), up) > 0.3, 'A turns left');
});

test('mouse up raises the nose; near a planet it cannot loop', () => {
  const sample = makeWorld({ R });
  const st = hovering(sample, 300);
  fly(st, sample, 6, () => ({ aimY: -0.05 }));
  const elev = Math.asin(dot(fwdOf(st), norm(st.p)));
  assert.ok(elev > 1.2 && elev <= SHIP.pitchLimit + 0.02, 'nose up, limited: ' + elev);
  assert.ok(dot(upOf(st), norm(st.p)) > 0, 'not inverted');
  fly(st, sample, 8, () => ({ aimY: 0.05 }));
  const elev2 = Math.asin(dot(fwdOf(st), norm(st.p)));
  assert.ok(elev2 < -1.2 && elev2 >= -SHIP.pitchLimit - 0.02, 'nose down, limited: ' + elev2);
});

test('the ground is never a wall: a full-throttle dive ends in a skim, not a crash', () => {
  const sample = makeWorld({ R });
  const st = hovering(sample, 120);
  let minAlt = Infinity;
  fly(st, sample, 14, (s, t) => ({ aimY: t < 1.2 ? 0.02 : 0, throttle: 1 }), (s) => { minAlt = Math.min(minAlt, len(s.p) - R); });
  assert.ok(minAlt >= SHIP.minClearance - 1e-6, 'never below the minimum clearance: ' + minAlt);
  assert.ok(st.speed > 10, 'still flying');
  assert.ok(Number.isFinite(st.p.x));
});

test('flying into a hill: pulls up over it or bounces softly, never ends up inside', () => {
  for (const height of [30, 120]) {
    const hillDir = norm(add(start, scale(north, 300 / R)));
    const sample = makeWorld({ R, hill: { dir: hillDir, radius: 90, height } });
    const st = hovering(sample, 6);
    let minClear = Infinity;
    fly(st, sample, 16, { throttle: 1 }, (s) => { const g = floorAt(sample, s.p); minClear = Math.min(minClear, g.r - g.floor); });
    assert.ok(minClear >= SHIP.minClearance - 0.01, `height ${height}: clearance ${minClear}`);
    assert.ok(arc(st.p, start, R) > 250, 'got past or around the hill');
  }
});

test('Space and C move the ship straight up and down; sinking stops at the cushion', () => {
  const sample = makeWorld({ R });
  const st = hovering(sample, 30);
  fly(st, sample, 3, { lift: 1 });
  assert.ok(len(st.p) - R > 55, 'rose: ' + (len(st.p) - R));
  fly(st, sample, 12, { lift: -1 });
  const alt = len(st.p) - R;
  assert.ok(alt >= SHIP.minClearance - 1e-6 && alt < SHIP.minClearance + 1.5, 'settled just above the ground: ' + alt);
  assert.equal(st.bounces, 0);
});

test('landing assist: from a hover to a feather-soft touchdown, upright, gear down', () => {
  const sample = makeWorld({ R });
  const st = hovering(sample, 70);
  st.v = scale(north, 30);                       // arrive with some speed
  assert.equal(beginLanding(st, sample), true);
  let r = 'landing', t = 0, last = 0;
  while (r === 'landing' && t < 60) { last = -dot(st.v, norm(st.p)); r = stepLanding(st, DT, sample); t += DT; }
  assert.equal(r, 'touchdown');
  assert.ok(t > 4 && t < 25, 'landing takes ' + t);
  assert.ok(last <= SHIP.landMinDescent * 1.6, 'touchdown speed ' + last);
  assert.ok(Math.abs(len(st.p) - R) < 0.05);
  for (let i = 0; i < 120; i++) stepLanded(st, DT);
  assert.ok(dot(upOf(st), norm(st.p)) > 0.999, 'upright');
  assert.ok(st.gear01 > 0.95 && st.speed === 0);
});

test('landing assist picks flat dry ground nearby and refuses when there is none', () => {
  // Hovering over the flank of a steep cone: the site must be off the cone.
  const hill = { dir: start, radius: 20, height: 40 };
  const sample = makeWorld({ R, hill });
  const over = norm(add(start, scale(north, 8 / R)));
  const p = scale(over, R + 80);
  const site = findLandingSite(p, sample);
  assert.ok(site, 'found a site');
  assert.ok(site.slope < 0.3, 'flat: ' + site.slope);
  assert.ok(arc(site.dir, start, R) >= 19, 'off the cone');
  // Over water with a shore 20 m away: prefers the shore.
  const pond = makeWorld({ R, sea: R - 0.5, bowl: { dir: start, radius: 18, depth: 6 } });
  const s2 = findLandingSite(scale(start, R + 50), pond);
  assert.ok(s2 && !s2.liquid, 'dry ground preferred');
  // Open ocean: lands on the water (the ship floats).
  const ocean = makeWorld({ R: R - 30, sea: R });
  const s3 = findLandingSite(scale(start, R + 50), ocean);
  assert.ok(s3 && s3.liquid && Math.abs(s3.floor - R) < 1e-9);
  // A giant cone everywhere within reach: no site, no landing.
  const cliff = makeWorld({ R, hill: { dir: start, radius: 400, height: 800 } });
  const st = createShipState(scale(norm(add(start, scale(north, 150 / R))), R + 600), qLook(north, start));
  assert.equal(findLandingSite(st.p, cliff), null);
  assert.equal(beginLanding(st, cliff), false);
  assert.equal(st.landing, null);
});

test('landing on a gentle slope rests the ship along the ground', () => {
  const sample = makeWorld({ R, hill: { dir: start, radius: 400, height: 110 } });     // 15 degrees
  const over = norm(add(start, scale(north, 150 / R)));
  const st = createShipState(scale(over, sample(over).radius + 40), qLook(north, over));
  assert.equal(beginLanding(st, sample), true);
  let r = 'landing', n = 0;
  while (r === 'landing' && n++ < 4000) r = stepLanding(st, DT, sample);
  assert.equal(r, 'touchdown');
  for (let i = 0; i < 180; i++) stepLanded(st, DT);
  const g = sample(norm(st.p));
  assert.ok(dot(upOf(st), g.normal) > 0.985, 'leans with the slope');
  assert.ok(dot(upOf(st), norm(st.p)) > 0.95, 'but not too far');
});

test('deep space: no planet, no ground, free flight up to cruise speed', () => {
  const st = createShipState(V(5e5, 0, 0), qLook(V(0, 0, -1), V(0, 1, 0)));
  const env = { up: null, universeUp: V(0, 1, 0), upWeight: 0, altitude: 1e9, spaceAlt: 1, hasBody: false, sample: null };
  for (let i = 0; i < 20 / DT; i++) stepFlight(st, { throttle: 1, aimX: i < 60 ? 0.01 : 0 }, DT, env);
  assert.ok(Math.abs(st.speed - SHIP.speedSpace) < 5, 'cruise ' + st.speed);
  assert.ok(Math.abs(upOf(st).y) > 0.9, 'keeps a gentle sense of up (the ecliptic)');
});

test('on the stub terrain: ten minutes of careless flying never puts the ship in the ground', () => {
  const sample = (d) => stubSurface('earth', d);
  let rng = 99;
  const rand = () => { rng = (Math.imul(rng, 1664525) + 1013904223) | 0; return (rng >>> 0) / 4294967296; };
  const d0 = norm(V(0.33, 0.1, -0.94));
  const st = createShipState(scale(d0, sample(d0).radius + 30), qLook(tangent(V(0, 1, 0), d0), d0));
  let inp = { throttle: 1 }, minClear = Infinity;
  for (let i = 0; i < 600 / DT; i++) {
    if (i % 120 === 0) inp = { throttle: rand() < 0.8 ? 1 : -1, aimX: (rand() - 0.5) * 0.02, aimY: (rand() - 0.35) * 0.02, lift: rand() < 0.3 ? -1 : 0 };
    const r = len(st.p);
    stepFlight(st, inp, DT, { up: scale(st.p, 1 / r), universeUp: V(0, 1, 0), upWeight: 1, altitude: r - 4000, spaceAlt: 1e6, hasBody: true, sample });
    if (i % 3 === 0) { const g = floorAt(sample, st.p); minClear = Math.min(minClear, g.r - g.floor); }
  }
  assert.ok(minClear >= SHIP.minClearance - 0.02, 'clearance ' + minClear);
  assert.ok(Number.isFinite(st.p.x + st.v.x + st.q.w));
});

test('chase camera stays above the terrain and behind the ship', () => {
  const sample = (d) => stubSurface('earth', d);
  const d0 = norm(V(0.33, 0.1, -0.94));
  const st = createShipState(scale(d0, sample(d0).radius + 12), qLook(tangent(V(0, 1, 0), d0), d0));
  const cam = createShipCamera();
  let minClear = Infinity;
  for (let i = 0; i < 120 / DT; i++) {
    const r = len(st.p);
    stepFlight(st, { throttle: i < 200 ? 1 : 0, aimX: Math.sin(i / 200) * 0.004, lift: i % 900 > 600 ? -1 : 0 }, DT,
      { up: scale(st.p, 1 / r), universeUp: V(0, 1, 0), upWeight: 1, altitude: r - 4000, spaceAlt: 1e6, hasBody: true, sample });
    const pose = updateShipCamera(cam, st, DT, { upRef: norm(st.p), level01: 1, speed01: 0.1, sample, toLocal: (p) => p });
    const g = floorAt(sample, pose.p);
    minClear = Math.min(minClear, g.r - g.floor);
    const toShip = norm(sub(st.p, pose.p));
    assert.ok(dot(toShip, qRotate(pose.q, V(0, 0, -1))) > 0.8, 'the ship is in front of the camera');
  }
  assert.ok(minClear >= CAMERA.shipClearance * 0.95, 'camera clearance ' + minClear);
});

test('landing assist keeps clear of trees when there is open ground within reach', () => {
  const sample = makeWorld({ R });
  // A copse right under the ship: trunks every 4 m in a 20 m square.
  const east = cross(north, start);
  const trees = [];
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
    trees.push({ unitDir: norm(add(add(start, scale(north, (i * 4) / R)), scale(east, (j * 4) / R))), radius: 0.4, height: 15 });
  }
  const p = scale(start, R + 60);
  const site = findLandingSite(p, sample, undefined, trees);
  assert.ok(site, 'found a site');
  let nearest = Infinity;
  for (const t of trees) nearest = Math.min(nearest, arc(site.dir, t.unitDir, R));
  assert.ok(nearest >= SHIP.landClearance, 'clear of every trunk: ' + nearest);
  // With no obstacles the spot straight below is chosen.
  assert.ok(arc(findLandingSite(p, sample).dir, start, R) < 0.01);
});
