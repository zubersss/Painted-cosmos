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
  let t = 0, worst = 0, changes = 0, tiers0 = ctrl.tierChanges, under30 = 0, firstHeld = null;
  const log = [];
  while (t < seconds) {
    const ms = cost(ctrl.scale, ctrl.quality);
    const r = ctrl.frame(ms);
    if (r.changed) changes++;
    t += ms / 1000;
    if (ms > 33.4) under30 += ms / 1000; else if (firstHeld == null) firstHeld = t;
    if (t > seconds * 0.6) worst = Math.max(worst, ms);
    log.push(ms);
  }
  return { worst, changes, tierChanges: ctrl.tierChanges - tiers0, under30, firstHeld, last: log[log.length - 1] };
}

test('the game starts at the best tier and full resolution; a fast machine stays there', () => {
  const c = new DynamicResolution();
  assert.deepEqual(c.start, { scale: 1, quality: 2 });
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

test('a slow machine is not left at a crawl: above 30 fps within two seconds, then no hunting', () => {
  const c = new DynamicResolution();
  const cost = machine({ fixed: 6, perPixel: 70 });                  // 76 ms at the top: 13 fps
  const r = simulate(c, cost, 120);
  assert.ok(r.firstHeld < 2, `30 fps or better after ${r.firstHeld.toFixed(2)} s`);
  assert.ok(r.under30 < 1.5, `${r.under30.toFixed(2)} s under 30 fps in two minutes`);
  assert.ok(c.quality < 2, 'tier dropped to ' + c.quality);
  assert.ok(r.worst < 33.4, 'never below 30 fps once settled: ' + r.worst);
  const before = c.changes;
  const again = simulate(c, cost, 120);
  assert.ok(c.changes - before <= 4, 'no oscillation: ' + (c.changes - before) + ' changes in two minutes');
  assert.equal(again.tierChanges, 0, 'the tier holds still');
  assert.equal(again.under30, 0, 'and the careful tries upward never cost 30 fps');
});

test('a hopeless machine is at the floor within five seconds and stays there', () => {
  for (const m of [{ fixed: 30, perPixel: 200 }, { fixed: 10, perPixel: 400 }]) {     // 230 and 410 ms at the top
    const c = new DynamicResolution();
    let t = 0, at = null;
    while (t < 60) { const ms = machine(m)(c.scale, c.quality); c.frame(ms); t += ms / 1000; if (at == null && c.quality === 0 && c.scale === DYNRES.minScale) at = t; }
    assert.ok(at != null && at < 5, `floor reached after ${at == null ? 'never' : at.toFixed(1) + ' s'} (${m.perPixel})`);
    const before = c.changes;
    simulate(c, machine(m), 60);
    assert.equal(c.changes, before, 'no thrashing at the floor');
  }
});

test('frames slower than a quarter second: one or two are a hitch, a run of them is load', () => {
  const d = new DynamicResolution();
  d.frame(800); d.frame(1200);
  for (let i = 0; i < 120; i++) d.frame(16.7);
  d.frame(900);
  for (let i = 0; i < 120; i++) d.frame(16.7);
  assert.equal(d.scale, 1);
  assert.equal(d.quality, 2);
  assert.equal(d.changes, 0, 'hitches change nothing');
  // A software renderer at three frames a second: every frame is "a hitch". It must still come down.
  const s = new DynamicResolution();
  for (let i = 0; i < 12; i++) s.frame(330);
  assert.ok(s.quality < 2 || s.scale <= 0.6, `came down within 4 s: tier ${s.quality}, scale ${s.scale}`);
});

test('load that goes away is given back even behind a display refresh: resolution first, then the tier', () => {
  const c = new DynamicResolution();
  simulate(c, machine({ fixed: 6, perPixel: 70 }), 60);
  assert.ok(c.quality < 2);
  // vsync: the frame time never reads under 16.7 ms, so headroom is never seen, only steadiness.
  const r = simulate(c, machine({ fixed: 2, perPixel: 5, vsync: true }), 400);
  assert.equal(c.quality, 2);
  assert.equal(c.scale, 1);
  assert.equal(r.under30, 0);
  // And faster on a display that shows the headroom.
  const f = new DynamicResolution();
  simulate(f, machine({ fixed: 6, perPixel: 70 }), 60);
  simulate(f, machine({ fixed: 2, perPixel: 5, vsync: false }), 200);
  assert.deepEqual([f.quality, f.scale], [2, 1]);
});

test('upward tries that do not hold get rarer: no oscillation at the edge of the budget', () => {
  // Resolution: the balance lies between two steps.
  const c = new DynamicResolution();
  const cost = machine({ fixed: 4, perPixel: 20 });
  simulate(c, cost, 120);
  const a = simulate(c, cost, 300), b = simulate(c, cost, 300);
  assert.ok(a.changes <= 8 && b.changes <= 6, `changes in five minutes: ${a.changes}, then ${b.changes}`);
  assert.equal(a.tierChanges + b.tierChanges, 0);
  // Tier: the one below is easy at full resolution, the one above cannot hold even at the
  // smallest picture. Each try that fails triples the wait for the next.
  const t = new DynamicResolution({ quality: 1 });
  const hard = machine({ fixed: 3, perPixel: 20, tierCost: [0.3, 0.5, 6] });
  const first = simulate(t, hard, 600), later = simulate(t, hard, 600);
  assert.equal(t.quality, 1, 'ends on the tier that holds');
  assert.ok(first.tierChanges <= 8, `tier changes in the first ten minutes: ${first.tierChanges}`);
  assert.ok(later.tierChanges <= 4, `in the next ten: ${later.tierChanges}`);
  assert.ok(later.under30 < 6, `${later.under30.toFixed(1)} s under 30 fps in ten minutes`);
});

test('a panic frame time sheds load at once; pinning works; rest() forgets', () => {
  const c = new DynamicResolution();
  for (let i = 0; i < 10; i++) c.frame(45);
  assert.ok(c.scale < 0.9, 'reacted within ten frames: ' + c.scale);
  const e = new DynamicResolution({ enabled: false, scale: 0.7, quality: 1 });
  for (let i = 0; i < 300; i++) e.frame(50);
  assert.equal(e.scale, 0.7);
  assert.equal(e.quality, 1);
  const f = new DynamicResolution({ maxQuality: 1, quality: 1 });
  simulate(f, machine({ fixed: 2, perPixel: 3, vsync: false }), 120);
  assert.equal(f.quality, 1, "never exceeds the player's ceiling");
  const g = new DynamicResolution({ minQuality: 2 });
  simulate(g, machine({ fixed: 30, perPixel: 200 }), 30);
  assert.equal(g.quality, 2, 'a pinned tier stays; only the resolution gives');
  assert.equal(g.scale, DYNRES.minScale);
  // Loading is not the machine's pace: the caller feeds nothing, then rest() starts clean.
  const h = new DynamicResolution();
  h.frame(40); h.frame(40);
  h.rest();
  for (let i = 0; i < 30; i++) h.frame(16.7);
  assert.equal(h.changes, 0);
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
  const none = { render: false, world: false, art: false, ui: false, physics: false };
  const all = { render: true, world: true, art: true, ui: true, physics: true };
  const every = (v) => ({ render: v, world: v, art: v, ui: v, physics: v });
  assert.deepEqual(planProviders('', none), every('stub'));
  assert.deepEqual(planProviders('', all), every('real'));
  assert.deepEqual(planProviders('?stub=1', all), every('stub'));
  assert.deepEqual(planProviders('?stub=world', all), { ...every('real'), world: 'stub' });
  assert.deepEqual(planProviders('?stub=physics', all), { ...every('real'), physics: 'stub' });
  assert.deepEqual(planProviders('?real=1', none), every('real'));
  assert.deepEqual(planProviders('?real=world,art', none), { ...every('stub'), world: 'real', art: 'real' });
  assert.equal(planProviders('?stub=1&real=1', none).render, 'stub', 'stub wins when both are given');
});
