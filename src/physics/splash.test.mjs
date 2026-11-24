// Painted Cosmos physics: the player in the water (the water group, lane W4): the per-pixel rings with kinds (water.js
// WAKES2), the rings and splashes of a wader, a swimmer and a low flight, and how wet the figure is (splash.js).
// Run: node --test src/physics/splash.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WaterField, WAKES2, WAKE_KIND, wake2Shape, WAKE2_GLSL } from './water.js';
import { makeWaterPlay, stepWaterPlay, dryWaterPlay, SPLASHES, SPLASH } from './splash.js';

// a flat frame: east = x, north = z, up = y; body-local points map to the grid one to one
const frame = { version: 1, r0: 1000, ex: 1, ey: 0, ez: 0, nx: 0, ny: 0, nz: 1, ax: 0, ay: 1, az: 0, lx: (x) => x, lz: (x, y, z) => z };
const water = () => { const F = new WaterField({ swell: false }); for (let i = 0; i < 30; i++) F.update(1 / 60, frame, 0, 0, 0, 5, 100, 9.81, 1.2, 999); return F; };
const live = () => { let n = 0; for (let w = 3; w < WAKES2.buf.length; w += 4) if (WAKES2.buf[w] !== 0) n++; return n; };
const reset = () => { WAKES2.buf.fill(0); WAKES2.head = 0; WAKES2.live = 0; };

test('off: no ring is laid and the surface is the field as it was', () => {
  reset(); WAKES2.on = false;
  const F = water();
  const o = [0, 0, 0], a = F.wakeInto(1, 1, o).slice();
  F.addRing(0, 0, 0.05, WAKE_KIND.foot);
  assert.equal(live(), 0);
  assert.deepEqual(F.wakeInto(1, 1, o), a);
});

test('the kinds ride in the fourth number and come back out', () => {
  const o = {};
  wake2Shape(-0.015, o); assert.equal(o.kind, WAKE_KIND.foot); assert.ok(Math.abs(o.amp - 0.015) < 1e-9); assert.ok(o.L > 0.4 && o.L < 0.5);
  wake2Shape(1.03, o); assert.equal(o.kind, WAKE_KIND.press); assert.ok(Math.abs(o.amp - 0.03) < 1e-9);
  wake2Shape(0.02, o); assert.equal(o.kind, WAKE_KIND.bow);
  assert.match(WAKE2_GLSL, /uniform vec4 uWWake\[32\]/); assert.match(WAKE2_GLSL, /vec3 pcWake2\(vec2 g\)/);
});

test('on: a footfall ring rises and falls on the water, travels out and dies', () => {
  reset(); WAKES2.on = true;
  try {
    const F = water();
    F.addRing(0, 0, 0.02, WAKE_KIND.foot);
    assert.equal(live(), 1);
    // after a while the ring has travelled: something at half a metre, nothing left at the source's own place in time
    for (let i = 0; i < 30; i++) F.update(1 / 60, frame, 0, 0, 0, 5, 100, 9.81, 1.2, 999);
    let mx = 0; const o = [0, 0, 0];
    for (let r = 0; r <= 1.5; r += 0.02) mx = Math.max(mx, Math.abs(F.wake2Into(r, 0, o)[0]));
    assert.ok(mx > 0.002 && mx < 0.03, 'a ring of a centimetre or so: ' + mx);
    for (let i = 0; i < 600; i++) F.update(1 / 60, frame, 0, 0, 0, 5, 100, 9.81, 1.2, 999);
    assert.equal(WAKES2.live, 0, 'gone in ten seconds');
  } finally { WAKES2.on = false; reset(); }
});

// a stand-in for loose.js: counts what is thrown
const looseMock = () => { const L = { n: 0, emit() { L.n++; return true; } }; return L; };
const D0 = (p, v, phys) => ({ kind: 'explorer', p, v, phys });

test('a wader: a ring at each footfall in water over 3 cm, none on dry ground; flecks with ?splash=1', () => {
  reset(); WAKES2.on = true; SPLASHES.on = true;
  try {
    const F = water(), P = makeWaterPlay(), L = looseMock();
    const B = { steps: 0, footfall: null, swim: 0, stroke: 0 };
    const D = D0({ x: 0, y: 1000, z: 0 }, { x: 1, y: 0, z: 0 }, B);
    stepWaterPlay(P, F, L, D, frame, 0, 0, -0.3, 0, 0, 1 / 60);        // (the first call only learns the count)
    const before = live();
    B.steps = 1; B.footfall = { p: { x: 0.2, y: 1000, z: 0.1 }, speed: 1.2 };
    stepWaterPlay(P, F, L, D, frame, 0, 0, -0.3, 0, 0.1, 1 / 60);
    const foot = [...Array(32).keys()].some((i) => WAKES2.buf[i * 4 + 3] < 0);
    assert.ok(foot, 'a footfall ring was laid'); assert.ok(live() > before);
    assert.ok(L.n >= SPLASH.footDrops, 'flecks thrown: ' + L.n);
    // on dry ground (the water under 3 cm) a footfall makes no ring
    reset(); const n0 = L.n;
    B.steps = 2; stepWaterPlay(P, F, L, D, frame, 0, 0, -0.01, 0, 0.2, 1 / 60);
    assert.ok(![...Array(32).keys()].some((i) => WAKES2.buf[i * 4 + 3] < 0), 'no ring in a film of water');
    assert.equal(L.n, n0);
  } finally { WAKES2.on = false; SPLASHES.on = false; reset(); }
});

test('going in at speed throws a crown, more the faster; a swimmer\'s strokes lay pulses at both hands; a low fast flight a furrow', () => {
  reset(); WAKES2.on = true; SPLASHES.on = true;
  try {
    const F = water();
    const crown = (vDown) => {
      const P = makeWaterPlay(), L = looseMock(), B = { steps: 0, footfall: null, swim: 0, stroke: 0 };
      stepWaterPlay(P, F, L, D0({ x: 0, y: 1000, z: 0 }, { x: 0, y: 0, z: 0 }, B), frame, 0, 0, 0.5, 0, 0, 1 / 60);    // out of the water
      stepWaterPlay(P, F, L, D0({ x: 0, y: 1000, z: 0 }, { x: 0, y: -vDown, z: 0 }, B), frame, 0, 0, -0.4, 0, 0.02, 1 / 60);
      return { n: L.n, s: P.here.splash };
    };
    const slow = crown(1.0), mid = crown(3), fast = crown(7);
    assert.equal(slow.n, 0, 'stepping in slowly throws nothing');
    assert.ok(mid.n > 0 && fast.n > mid.n, 'more drops the faster: ' + mid.n + ' ' + fast.n);
    assert.ok(fast.s > mid.s && mid.s > 0);
    // the stroke wraps 0.9 -> 0.1: two pulses, one at each hand
    reset();
    const P = makeWaterPlay(), B = { steps: 0, footfall: null, swim: 1, stroke: 0.9 };
    const D = D0({ x: 0, y: 1000, z: 0 }, { x: 1.2, y: 0, z: 0 }, B);
    stepWaterPlay(P, F, null, D, frame, 0, 0, -1.2, 0, 0, 1 / 60);
    const n1 = live(); B.stroke = 0.1;
    stepWaterPlay(P, F, null, D, frame, 0.02, 0, -1.2, 0, 0.02, 1 / 60);
    assert.equal(live() - n1, 2, 'two pulses');
    // flying 2 m over the water at 20 m/s: furrow sources, the lower the deeper
    reset();
    const Q = makeWaterPlay(), Bf = { steps: 0, footfall: null, swim: 0, stroke: 0 };
    let x = 0; for (let i = 0; i < 30; i++) { stepWaterPlay(Q, F, null, D0({ x, y: 1002, z: 0 }, { x: 20, y: 0, z: 0 }, Bf), frame, x, 0, 2, 0, i / 60, 1 / 60); x += 20 / 60; }
    const press = [...Array(32).keys()].filter((i) => WAKES2.buf[i * 4 + 3] >= 1).length;
    assert.ok(press >= 3, 'furrow sources dropped behind: ' + press);
    reset();
    const R = makeWaterPlay();
    for (let i = 0; i < 30; i++) stepWaterPlay(R, F, null, D0({ x: 0, y: 1012, z: 0 }, { x: 20, y: 0, z: 0 }, Bf), frame, i, 0, 12, 0, i / 60, 1 / 60);
    assert.equal(live(), 0, 'no furrow from 12 m up');
  } finally { WAKES2.on = false; SPLASHES.on = false; reset(); }
});

test('wet01: soaks in the water in a second or two, dries over minutes', () => {
  const P = makeWaterPlay(), F = water(), B = { steps: 0, footfall: null, swim: 1, stroke: 0 };
  SPLASHES.on = true;
  try {
    for (let i = 0; i < 120; i++) stepWaterPlay(P, F, null, D0({ x: 0, y: 1000, z: 0 }, { x: 0, y: 0, z: 0 }, B), frame, 0, 0, -1.4, 0, i / 60, 1 / 60);
    assert.ok(P.here.wet01 > 0.8, 'soaked swimming: ' + P.here.wet01);
    for (let i = 0; i < 60 * 30; i++) dryWaterPlay(P, 1 / 60);
    assert.ok(P.here.wet01 < 0.7 && P.here.wet01 > 0.4, 'half dry after half a minute: ' + P.here.wet01);
    for (let i = 0; i < 60 * 300; i++) dryWaterPlay(P, 1 / 60);
    assert.ok(P.here.wet01 < 0.05, 'dry after five minutes');
  } finally { SPLASHES.on = false; }
});
