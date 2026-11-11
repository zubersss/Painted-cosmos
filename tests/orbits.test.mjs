import test from 'node:test';
import assert from 'node:assert/strict';
import { BODIES, BODY_IDS } from '../src/data/bodies.js';
import { Ephemeris, spaceAltitude } from '../src/core/orbits.js';
import {
  HELIO, bodyFrame, frameState, posToUniverse, posFromUniverse, velToUniverse, velFromUniverse,
  convertState, chooseFrame, sameFrame, FloatingOrigin, quatToUniverse,
} from '../src/core/frames.js';
import { V, add, sub, scale, len, norm, dot, qRotate, qLook } from '../src/core/vec.js';

const eph = new Ephemeris(BODIES);
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg || ''} ${a} vs ${b} (eps ${eps})`);
const vnear = (a, b, eps, msg) => assert.ok(len(sub(a, b)) <= eps, `${msg || ''} ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);

test('every body in the contract has data and stays on its orbit', () => {
  assert.deepEqual(Object.keys(BODIES).sort(), [...BODY_IDS].sort());
  for (const id of BODY_IDS) {
    const b = BODIES[id];
    for (const t of [0, 1234.5, 99999]) {
      const p = eph.position(id, t);
      const centre = b.parent ? eph.position(b.parent, t) : V();
      near(len(sub(p, centre)), b.orbitRadius, 1e-6, id + ' orbit radius');
      near(p.y, 0, 1e-9, id + ' stays in the ecliptic');
    }
  }
});

test('planets are in the real order outward from the sun', () => {
  const order = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
  for (let i = 1; i < order.length; i++) assert.ok(BODIES[order[i]].orbitRadius > BODIES[order[i - 1]].orbitRadius);
  assert.equal(BODIES.moon.parent, 'earth');
});

test('velocity is the time derivative of position', () => {
  for (const id of ['earth', 'moon', 'jupiter']) {
    const t = 777, h = 1e-3;
    const fd = scale(sub(eph.position(id, t + h), eph.position(id, t - h)), 1 / (2 * h));
    vnear(eph.velocity(id, t), fd, 1e-4, id);
  }
});

test('orbits repeat after one period; spin repeats after one day', () => {
  const b = BODIES.mars;
  vnear(eph.position('mars', 100), eph.position('mars', 100 + b.orbitPeriod), 1e-6);
  const q0 = eph.orientation('mars', 50), q1 = eph.orientation('mars', 50 + b.dayLength);
  vnear(qRotate(q0, V(1, 0, 0)), qRotate(q1, V(1, 0, 0)), 1e-9);
});

test('local solar time runs forward through a day: sunrise 6, noon 12, sunset 18', () => {
  const id = 'earth', dir = norm(V(0.4, 0.2, 0.9));
  const e = new Ephemeris(BODIES);
  e.setLocalSolarTime(id, 0, dir, 12);
  near(e.localSolarTime(id, 0, dir), 12, 1e-9, 'set to noon');
  // At noon the sun is as high as it gets today; at 6 and 18 it is near the horizon... sampled:
  const day = BODIES.earth.dayLength;
  let prev = 12, maxElev = -2, maxAt = 0;
  for (let i = 1; i <= 200; i++) {
    const t = (i / 200) * day * 0.98;
    const h = e.localSolarTime(id, t, dir);
    const forward = ((h - prev + 24) % 24);
    assert.ok(forward > 0 && forward < 1, `time moves forward (${prev} -> ${h})`);
    prev = h;
  }
  for (let i = -100; i <= 100; i++) {
    const t = (i / 200) * day;
    const el = e.sunElevationSin(id, t, dir);
    if (el > maxElev) { maxElev = el; maxAt = e.localSolarTime(id, t, dir); }
  }
  near(maxAt, 12, 0.2, 'the sun peaks at noon');
  // Night side: at local midnight the sun is below the horizon.
  e.setLocalSolarTime(id, 0, dir, 0);
  assert.ok(e.sunElevationSin(id, 0, dir) < 0, 'midnight is dark');
  e.setLocalSolarTime(id, 0, dir, 9.5);
  near(e.localSolarTime(id, 0, dir), 9.5, 1e-9);
  assert.ok(e.sunElevationSin(id, 0, dir) > 0, 'morning is light');
});

test('frames: round trip and continuity across a frame change', () => {
  const t = 4321;
  const frames = [HELIO, bodyFrame('earth', false), bodyFrame('earth', true), bodyFrame('moon', true)];
  const st = { p: V(1200, 3900, -700), v: V(30, -4, 12), q: qLook(V(0.2, 0.1, -1), V(0, 1, 0)) };
  for (const a of frames) for (const b of frames) {
    const c = convertState(eph, t, a, b, st);
    const back = convertState(eph, t, b, a, c);
    vnear(back.p, st.p, 1e-6, 'position round trip');
    vnear(back.v, st.v, 1e-9, 'velocity round trip');
    // Same universe position and velocity before and after.
    const fa = frameState(eph, a, t), fb = frameState(eph, b, t);
    vnear(posToUniverse(fa, st.p), posToUniverse(fb, c.p), 1e-6, 'universe position is continuous');
    vnear(velToUniverse(fa, st.p, st.v), velToUniverse(fb, c.p, c.v), 1e-9, 'universe velocity is continuous');
    vnear(qRotate(quatToUniverse(fa, st.q), V(0, 0, -1)), qRotate(quatToUniverse(fb, c.q), V(0, 0, -1)), 1e-9, 'attitude is continuous');
  }
});

test('a point at rest on the ground moves with the planet (rotating-frame velocity is exact)', () => {
  const f = bodyFrame('earth', true);
  const p = scale(norm(V(0.5, 0.3, 0.8)), 4000);
  const t = 900, h = 1e-3;
  const P0 = posToUniverse(frameState(eph, f, t - h), p), P1 = posToUniverse(frameState(eph, f, t + h), p);
  const fd = scale(sub(P1, P0), 1 / (2 * h));
  vnear(velToUniverse(frameState(eph, f, t), p, V()), fd, 1e-3);
  vnear(velFromUniverse(frameState(eph, f, t), posToUniverse(frameState(eph, f, t), p), fd), V(), 1e-3);
});

test('chooseFrame: ground frame low, orbit frame above the atmosphere, sun frame far away', () => {
  const t = 100;
  const E = eph.position('earth', t);
  const up = norm(V(0.3, 0.8, 0.5));
  const at = (alt) => add(E, scale(up, BODIES.earth.radius + alt));
  const edge = spaceAltitude(BODIES.earth);
  assert.deepEqual(chooseFrame(eph, t, at(10), HELIO), bodyFrame('earth', true));
  assert.deepEqual(chooseFrame(eph, t, at(edge * 2), HELIO), bodyFrame('earth', false));
  assert.deepEqual(chooseFrame(eph, t, at(eph.soiRadius('earth') * 2), HELIO), HELIO);
  // Hysteresis: just above the edge you stay in the ground frame if you were in it.
  assert.ok(chooseFrame(eph, t, at(edge * 1.05), bodyFrame('earth', true)).rotating);
  assert.ok(!chooseFrame(eph, t, at(edge * 1.05), bodyFrame('earth', false)).rotating);
  // Just outside the sphere of influence you stay with the body you were with.
  const justOut = eph.soiRadius('earth') * 1.04 - BODIES.earth.radius;
  assert.ok(sameFrame(chooseFrame(eph, t, at(justOut), bodyFrame('earth', false)), bodyFrame('earth', false)));
  assert.ok(sameFrame(chooseFrame(eph, t, at(justOut), HELIO), HELIO));
  // Near the moon the moon wins, even though it sits close to Earth.
  const M = eph.position('moon', t);
  assert.equal(chooseFrame(eph, t, add(M, scale(up, BODIES.moon.radius + 50)), HELIO).id, 'moon');
});

test('no two spheres of influence overlap', () => {
  for (const t of [0, 5000, 77777]) {
    for (const a of BODY_IDS) for (const b of BODY_IDS) {
      if (a >= b) continue;
      const d = len(sub(eph.position(a, t), eph.position(b, t)));
      assert.ok(d > (eph.soiRadius(a) + eph.soiRadius(b)) * 1.08, `${a}/${b} at t=${t}: ${d}`);
    }
  }
});

test('floating origin: camera-relative numbers stay exact at the edge of the system', () => {
  const o = new FloatingOrigin();
  const cam = V(1180e3 + 1234.5678, 432.1, -998877.6655);        // out by Pluto
  o.set(cam);
  const pt = add(cam, V(0.0123, 1.5, -2.25));                    // something 2.7 m from the camera
  const s = o.toScene(pt);
  // What the GPU sees (float32) is still accurate to well under a millimetre...
  const f32 = new Float32Array([s.x, s.y, s.z]);
  assert.ok(Math.hypot(f32[0] - 0.0123, f32[1] - 1.5, f32[2] + 2.25) < 1e-4);
  // ...whereas the raw universe coordinates would be off by centimetres in float32.
  const raw = new Float32Array([pt.x, pt.y, pt.z]);
  assert.ok(Math.hypot(raw[0] - pt.x, raw[1] - pt.y, raw[2] - pt.z) > 0.01);
  vnear(o.toUniverse(s), pt, 1e-7);
});

test('space edge: every body has room between the ground and space', () => {
  for (const id of BODY_IDS) {
    const b = BODIES[id];
    assert.ok(spaceAltitude(b) >= b.radius * 0.2 - 1e-9 && spaceAltitude(b) >= b.atmosphereHeight);
    assert.ok(eph.soiRadius(id) > b.radius + spaceAltitude(b) * 2);
  }
});
