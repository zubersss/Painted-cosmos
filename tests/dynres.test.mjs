import test from 'node:test';
import assert from 'node:assert/strict';
import { DynamicResolution, DYNRES } from '../src/core/dynres.js';
import { cameraPlanes, farthestExtent, DEPTH } from '../src/core/depth.js';
import { planProviders } from '../src/core/providers.plan.js';

// A machine model: frame time = fixed + pixels * tierCost. vsync at 60 Hz floors it at 16.7 ms
// when `vsync` is set (a real display never reports faster than its refresh).
function machine({ fixed, perPixel, tierCost = [0.45, 0.7, 1.0], vsync = true }) {
  return (scale, quality) => {
    const ms = fixed + perPixel * scale * scale * tierCost[quality];
    return vsync ? Math.max(1000 / 60, ms) : ms;
  };
}
function simulate(ctrl, cost, seconds) {
  let t = 0, worst = 0, changes = 0;
  const log = [];
  while (t < seconds) {
    const ms = cost(ctrl.scale, ctrl.quality);
    const r = ctrl.frame(ms);
    if (r.changed) changes++;
    t += ms / 1000;
    if (t > seconds * 0.6) worst = Math.max(worst, ms);
    log.push(ms);
  }
  return { worst, changes, last: log[log.length - 1] };
}

test('a fast machine stays at full resolution and top quality', () => {
  const c = new DynamicResolution();
  const r = simulate(c, machine({ fixed: 3, perPixel: 6 }), 60);
  assert.equal(c.scale, 1);
  assert.equal(c.quality, 2);
  assert.equal(r.changes, 0);
});

test('an integrated GPU a bit over budget settles on a lower resolution, same tier, 60 fps', () => {
  const c = new DynamicResolution();
  const r = simulate(c, machine({ fixed: 4, perPixel: 20 }), 60);
  assert.equal(c.quality, 2);
  assert.ok(c.scale < 1 && c.scale >= 0.5, 'scale ' + c.scale);
  assert.ok(r.worst <= DYNRES.highMs + 0.5, 'holds the budget: ' + r.worst);
});

test('a slow machine drops tiers until it holds 30 fps or better, and stops hunting', () => {
  const c = new DynamicResolution();
  const cost = machine({ fixed: 6, perPixel: 70 });
  const r = simulate(c, cost, 120);
  assert.ok(c.quality < 2, 'tier dropped to ' + c.quality);
  assert.ok(r.worst < 33.4, 'never below 30 fps once settled: ' + r.worst);
  const before = c.changes;
  simulate(c, cost, 120);
  assert.ok(c.changes - before <= 6, 'no oscillation: ' + (c.changes - before) + ' changes in two minutes');
});

test('a hopeless machine ends at the floor without thrashing', () => {
  const c = new DynamicResolution();
  simulate(c, machine({ fixed: 30, perPixel: 200 }), 60);
  assert.equal(c.quality, 0);
  assert.equal(c.scale, DYNRES.minScale);
  const before = c.changes;
  simulate(c, machine({ fixed: 30, perPixel: 200 }), 60);
  assert.equal(c.changes, before);
});

test('load that goes away is given back: resolution first, then the tier', () => {
  const c = new DynamicResolution();
  simulate(c, machine({ fixed: 6, perPixel: 70 }), 60);
  assert.ok(c.quality < 2);
  simulate(c, machine({ fixed: 2, perPixel: 5, vsync: false }), 200);
  assert.equal(c.quality, 2);
  assert.equal(c.scale, 1);
});

test('a panic frame time sheds load at once; hitches are ignored; pinning works', () => {
  const c = new DynamicResolution();
  for (let i = 0; i < 10; i++) c.frame(45);
  assert.ok(c.scale < 0.9, 'reacted within ten frames: ' + c.scale);
  const d = new DynamicResolution();
  d.frame(800); d.frame(1200);
  assert.equal(d.scale, 1);
  const e = new DynamicResolution({ enabled: false, scale: 0.7, quality: 1 });
  for (let i = 0; i < 300; i++) e.frame(50);
  assert.equal(e.scale, 0.7);
  assert.equal(e.quality, 1);
  const f = new DynamicResolution({ maxQuality: 1, quality: 1 });
  simulate(f, machine({ fixed: 2, perPixel: 3, vsync: false }), 120);
  assert.equal(f.quality, 1, "never exceeds the player's ceiling");
});

test('camera planes: tight near on foot, growing with clear air in flight, far covers the system', () => {
  assert.equal(cameraPlanes('foot', 0, 1e5).near, DEPTH.nearFoot);
  assert.equal(cameraPlanes('cockpit', 5000, 1e5).near, DEPTH.nearCockpit);
  assert.equal(cameraPlanes('chase', 0, 1e5).near, DEPTH.nearChase);
  const high = cameraPlanes('chase', 5000, 1e5).near;
  assert.ok(high > 1 && high <= 4, 'the ship itself is never clipped: ' + high);
  let prev = 0;
  for (let c = 0; c < 3000; c += 50) { const n = cameraPlanes('chase', c, 1e5).near; assert.ok(n >= prev); prev = n; }
  const far = cameraPlanes('foot', 0, 2.4e6).far;
  assert.ok(far >= 2.4e6 * 1.1);
  assert.ok(cameraPlanes('foot', 0, 10).far >= DEPTH.farMin);
  const ext = farthestExtent({ x: 0, y: 0, z: 0 }, [{ p: { x: 3, y: 4, z: 0 }, radius: 2 }, { p: { x: 100, y: 0, z: 0 }, radius: 10 }]);
  assert.equal(ext, 110);
});

test('provider plan: stubs by default until a module is flagged ready; URL can force either way', () => {
  const none = { render: false, world: false, art: false, ui: false };
  const all = { render: true, world: true, art: true, ui: true };
  assert.deepEqual(planProviders('', none), { render: 'stub', world: 'stub', art: 'stub', ui: 'stub' });
  assert.deepEqual(planProviders('', all), { render: 'real', world: 'real', art: 'real', ui: 'real' });
  assert.deepEqual(planProviders('?stub=1', all), { render: 'stub', world: 'stub', art: 'stub', ui: 'stub' });
  assert.deepEqual(planProviders('?stub=world', all), { render: 'real', world: 'stub', art: 'real', ui: 'real' });
  assert.deepEqual(planProviders('?real=1', none), { render: 'real', world: 'real', art: 'real', ui: 'real' });
  assert.deepEqual(planProviders('?real=world,art', none), { render: 'stub', world: 'real', art: 'real', ui: 'stub' });
  assert.deepEqual(planProviders('?stub=1&real=1', none).render, 'stub', 'stub wins when both are given');
});
