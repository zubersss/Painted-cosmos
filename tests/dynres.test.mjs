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

// ---- THE SHARPNESS LADDER (the owner's speed table of 2026-11-19, v26) -----------------------------------------
// Their S23 Ultra reads -0.0 ms for every row of the speed test, because its display holds it at 60 a second and
// nothing can be told apart under that cap. The only rows that cost anything were the sharper ones. So a device
// with room is given MORE PICTURE. A rung is a quarter of a picture pixel to the screen point.
//
// The machine here is the owner's own, fitted from their four sharpness rows: 8.5 ms that does not depend on the
// picture, plus 10.4 ms for every million picture pixels, with the display holding anything under 16.7 at 16.7 and
// anything over it a whole interval late (which is what a display really does, and is what makes a rung too far
// obvious at once).
function phone({ dpr0 = 1.25, css = 823 * 384, fixed = 8.5, perMP = 10.4 } = {}) {
  return (sharp) => {
    const mp = css * (dpr0 + 0.25 * sharp) ** 2 / 1e6;
    const ms = fixed + perMP * mp;
    return ms <= 1000 / 60 ? 1000 / 60 : Math.ceil(ms / (1000 / 60)) * (1000 / 60);   // a missed refresh waits for the next
  };
}
function climb(ctrl, cost, seconds, hitchMs = 0) {
  let t = 0, worstHeld = 0;
  let last = ctrl.sharp;
  while (t < seconds) {
    let ms = cost(ctrl.sharp);
    if (hitchMs && ctrl.sharp !== last) { ms = hitchMs; last = ctrl.sharp; }   // rebuilding the targets costs one frame
    ctrl.frame(ms);
    if (cost(ctrl.sharp) <= 1000 / 60 && ctrl.sharp > worstHeld) worstHeld = ctrl.sharp;
    t += ms / 1000;
  }
  return worstHeld;
}

test('dynres: with no rungs offered, nothing about the picture changes (every device until the caller asks)', () => {
  const c = new DynamicResolution({ scale: 1, quality: 2, maxQuality: 2 });
  assert.equal(c.sharpMax, 0);
  const cost = phone();
  for (let i = 0; i < 60 * 60; i++) c.frame(cost(0));
  assert.equal(c.sharp, 0, 'a rung was climbed that was never offered');
  assert.equal(c.sharpChanges, 0);
});

test('dynres: the owner`s phone climbs to the sharpest picture it can hold at 60, and no further', () => {
  // ten rungs are offered (1.25 -> 3.75, the screen`s own). By the fit, 1.50 costs 15.9 ms and holds; 1.75 costs
  // 18.5 and misses the refresh, so it is shown 33.3 ms late and must be given back at once.
  const c = new DynamicResolution({ scale: 1, quality: 2, maxQuality: 2, sharpMax: 10 });
  const cost = phone();
  climb(c, cost, 600);
  assert.equal(c.sharp, 1, 'it did not settle on the one rung that holds 60: ' + c.sharp + ' rungs');
  assert.ok(cost(c.sharp) <= 1000 / 60 + 1e-9, 'it settled on a picture the phone cannot hold at 60');
  assert.ok(cost(c.sharp + 1) > 1000 / 60, 'it stopped short: the next rung would have held too');
  assert.ok(c.sharpChanges >= 2, 'it never tried the rung above: ' + c.sharpChanges + ' changes');
});

test('dynres: a slower phone is left where it is, and a faster one climbs further', () => {
  const slow = new DynamicResolution({ scale: 1, quality: 2, maxQuality: 2, sharpMax: 10 });
  climb(slow, phone({ fixed: 13 }), 600);
  assert.equal(slow.sharp, 0, 'a phone with no room to spare was given a sharper picture: ' + slow.sharp);
  // (this one found a real fault: judged against the budget STRETCHED to the cap it had settled for, a phone stuck
  //  at 30 a second climbed four rungs for nothing, because a display shows the same 33 ms however much picture is
  //  drawn until the moment it drops to 20. The ladder is judged against the real sixty-a-second line instead.)

  const fast = new DynamicResolution({ scale: 1, quality: 2, maxQuality: 2, sharpMax: 10 });
  climb(fast, phone({ fixed: 3, perMP: 4 }), 900);
  assert.ok(fast.sharp >= 3, 'a phone with plenty of room climbed only ' + fast.sharp + ' rungs');
});

test('dynres: a rung is the first thing given back when the frames go wrong, and a panic takes the whole ladder', () => {
  const c = new DynamicResolution({ scale: 1, quality: 2, maxQuality: 2, sharpMax: 10 });
  climb(c, phone({ fixed: 3, perMP: 4 }), 900);
  const was = c.sharp, scale0 = c.scale, q0 = c.quality;
  assert.ok(was >= 2, 'nothing to give back: ' + was);
  // the world turns heavy (a wood, weather, a fire): one rung goes, and the scale and the tier are not touched yet
  let r = null;
  for (let i = 0; i < 40 && (!r || r.sharp === was); i++) r = c.frame(24);
  assert.equal(r.sharp, was - 1, 'the sharpest rung was not the first thing given back');
  assert.equal(r.scale, scale0, 'the picture was shrunk before the sharpening was given back');
  assert.equal(r.quality, q0, 'the tier went before the sharpening did');
  // and a real panic gives back half the ladder at a time, so a tall one is empty in a second or two -- and the
  // picture and the tier are still untouched at the moment the last rung goes, because the sharpening is the one
  // thing in the frame that is not the game itself.
  let emptiedAt = null;
  for (let i = 0; i < 60 && !emptiedAt; i++) { const q = c.frame(70); if (q.sharp === 0) emptiedAt = q; }
  assert.ok(emptiedAt, 'a panic never emptied the ladder: ' + c.sharp + ' rungs left');
  assert.ok(c.changes < 40, 'the ladder was emptied one rung at a time, not by halves');
  assert.equal(emptiedAt.scale, scale0, 'the picture was shrunk before the ladder was empty');
  assert.equal(emptiedAt.quality, q0, 'a tier went before the ladder was empty');
});

test('dynres: one rebuilt-targets hitch a rung does not send it back down', () => {
  // changing the canvas rebuilds five drawing targets: one slow frame. That is a hitch, not load.
  const c = new DynamicResolution({ scale: 1, quality: 2, maxQuality: 2, sharpMax: 10 });
  const held = climb(c, phone({ fixed: 3, perMP: 4 }), 900, 300);
  assert.ok(c.sharp >= 2, 'the hitch of its own rebuilding stopped it climbing: ' + c.sharp);
  assert.ok(held >= c.sharp, 'it settled above what it can hold');
});

// ---- THE SHARPER PICTURE ON A TOUCH DEVICE (24 Nov, the owner's phone table v39.5; main.js SHARP_TOUCH) --------------
// The phone starts on the first rung (1.2 times as sharp each way), may climb to the second (1.4 times), and gives the
// rungs back first when the smoothed frame is over 27 ms for half a second; it climbs only after 6 s under 20 ms; it
// keeps its preset's tier (1) as its top. The machine here: a 60 Hz phone whose work is (a + b x megapixels) with a
// frame-to-frame wobble of +-J, each frame shown at the next refresh. Fitted to the owner's v39.5 foot table (held at
// 56 a second at its own size; 23.9 ms at 1.5 times as sharp each way) and the bank (32.0 ms at 1.5 times). The table
// does not pin the wobble, so two machines: J 0.15 (fit a 4.6, b 10.5 ms/MP: the slope of the v26 fit above) and the
// harsher J 0.20 (a 12.1, b 4.0; the bank a 15.7).
const TOUCH = { minScale: 0.85, targetMs: 33.3, highMs: 37, lowMs: 27, panicMs: 62, tierUpMs: 22, sharpHighMs: 27, sharpLowMs: 20, sharpDownAfter: 0.5 };
function touchPhone({ a, b, J, css = 823 * 384, dpr0 = 1.25, seed = 11 }) {
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const T = 1000 / 60;
  return (sharp) => {
    const mp = css * (dpr0 + 0.25 * sharp) ** 2 / 1e6;
    const w = (a + b * mp) * (1 + J * (2 * rnd() - 1));
    return Math.max(T, Math.ceil(w / T) * T);
  };
}
const touchCtrl = () => new DynamicResolution({ scale: 1, quality: 1, maxQuality: 1, sharpTier: 1, sharpMax: 2, sharp: 1, tuning: TOUCH });
function run(ctrl, cost, seconds) {
  let t = 0, n = 0, twice = 0, worstSharp = ctrl.sharp, minScale = ctrl.scale, minQ = ctrl.quality;
  while (t < seconds) { const ms = cost(ctrl.sharp); ctrl.frame(ms); t += ms / 1000; n++; if (ms > 25) twice++; worstSharp = Math.min(worstSharp, ctrl.sharp); minScale = Math.min(minScale, ctrl.scale); minQ = Math.min(minQ, ctrl.quality); }
  return { twice: twice / n, worstSharp, minScale, minQ };
}

test('dynres touch: the defaults leave the ladder exactly as it was (?sharp=0 and the desktop)', () => {
  assert.equal(DYNRES.sharpHighMs, 0); assert.equal(DYNRES.sharpLowMs, 0); assert.equal(DYNRES.sharpDownAfter, 0);
  const c = new DynamicResolution({ scale: 1, quality: 2, maxQuality: 2, sharpMax: 10 });
  assert.equal(c.sharpTier, null, 'a device not asking for it has its ladder climb from the top tier, as before');
});

test('dynres touch: on foot the phone keeps the sharper picture, and its tier and scale, for a minute', () => {
  for (const m of [{ a: 4.6, b: 10.5, J: 0.15 }, { a: 12.1, b: 4.0, J: 0.20 }]) {
    const c = touchCtrl(), r = run(c, touchPhone(m), 60);
    assert.ok(r.worstSharp >= 1, 'the first rung was given back on foot (J ' + m.J + ')');
    assert.equal(r.minScale, 1, 'the picture was shrunk on foot (J ' + m.J + ')');
    assert.equal(r.minQ, 1, 'the tier went on foot (J ' + m.J + ')');
  }
  // with the gentler wobble the frames have room under 20 ms, so it climbs to the second rung and stays there
  const g = touchCtrl(); run(g, touchPhone({ a: 4.6, b: 10.5, J: 0.15 }), 60);
  assert.equal(g.sharp, 2, 'with room to spare it did not climb to 1.4 times: rung ' + g.sharp);
  // with the harsher one it stays on the first: the frames are not under 20 ms long enough
  const h = touchCtrl(); run(h, touchPhone({ a: 12.1, b: 4.0, J: 0.20 }), 60);
  assert.equal(h.sharp, 1, 'with the harsher machine it moved off the first rung: ' + h.sharp);
});

test('dynres touch: at the bank the harsher machine gives the sharpness back first, and nothing else', () => {
  const c = touchCtrl();
  const r = run(c, touchPhone({ a: 15.7, b: 4.0, J: 0.20 }), 20);
  assert.equal(c.sharp, 0, 'over 27 ms at the bank the first rung was kept: rung ' + c.sharp);
  assert.equal(r.minScale, 1, 'the picture was shrunk at the bank');
  assert.equal(r.minQ, 1, 'the tier went at the bank');
  // and it does not climb back while the frames are not under 20 ms
  run(c, touchPhone({ a: 15.7, b: 4.0, J: 0.20, seed: 5 }), 60);
  assert.equal(c.sharp, 0, 'it climbed back at the bank: rung ' + c.sharp);
  // the gentler machine keeps the first rung at the bank (about 18.7 ms there)
  const g = touchCtrl(); const rg = run(g, touchPhone({ a: 7.5, b: 10.5, J: 0.15 }), 30);
  assert.ok(rg.worstSharp >= 1, 'the gentler machine gave the first rung back at the bank');
});

test('dynres touch: a sudden heavy load empties the ladder before the picture or the tier is touched', () => {
  const c = touchCtrl();
  run(c, touchPhone({ a: 4.6, b: 10.5, J: 0.15 }), 10);
  const sharp0 = c.sharp, scale0 = c.scale, q0 = c.quality;
  let r = null;
  for (let i = 0; i < 200; i++) { r = c.frame(45); if (r.sharp === 0) break; }
  assert.ok(sharp0 > 0 && r.sharp === 0, 'the ladder was not emptied under 45 ms frames');
  assert.equal(r.scale, scale0, 'the picture was shrunk before the ladder was empty');
  assert.equal(r.quality, q0, 'the tier went before the ladder was empty');
});

test('dynres touch: how often a frame is held twice on foot (judder on a 60 Hz display), reported', (t) => {
  const rows = [];
  for (const m of [{ a: 4.6, b: 10.5, J: 0.15 }, { a: 12.1, b: 4.0, J: 0.20 }]) {
    for (const rung of [0, 1, 2]) {
      const cost = touchPhone({ ...m, seed: 3 }); let n = 0, twice = 0, sum = 0;
      for (let i = 0; i < 20000; i++) { const ms = cost(rung); n++; sum += ms; if (ms > 25) twice++; }
      rows.push('J ' + m.J + ' rung ' + rung + ': ' + (sum / n).toFixed(1) + ' ms, ' + (100 * twice / n).toFixed(0) + '% held twice');
    }
  }
  t.diagnostic(rows.join(' | '));
  assert.ok(rows.length === 6);
});
