// R2 W6.1 (docs/lead/SHARP-SMOOTH-PLAN.md): the resolution floor and measured steps, on model machines.
// The controller works on internal = the tier's share x the render scale; it never draws under the
// floor (0.67; 0.75 on phones and tablets) unless a URL pins a smaller scale; at the floor it sheds a
// rung (geometry, then MSAA), never pixels; its steps are sized from what the first step bought.
// MODELS, not measurements: the cost model is the perf audit's dynsim (frame = fragment fetches at the
// internal size + post fetches at the output size + triangles, 1080p, Earth spawn,
// /home/user/.pc-scratch/audit/perf/scripts/dynsim.mjs), extended by the tier shares and MSAA.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as DR from '../src/core/dynres.js';

const { DynamicResolution } = DR;
const FLOOR = 0.67, FLOOR_TOUCH = 0.75;
const TODAY = [0.62, 0.8, 1.0], W73 = [0.75, 0.85, 1.0];       // render/index.js TIERS today; PAINTER's W7.3
const RUNGS_MSAA = DR.RUNGS_MSAA || [{ q: 0, aa: 'auto' }, { q: 1, aa: 'post' }, { q: 1, aa: 'auto' }, { q: 2, aa: 'auto' }];
const internalOf = (d, shares) => Math.min(1, shares[d.quality] * d.scale);

// dynsim's cost: scene fetches per internal pixel, the post's fetches (the brush at the internal size, the
// sheet at the output's), triangles; MSAA (R1 W2.5, the painter's budget rule) as a factor on the scene pass.
const W = 1920, H = 1080, OUT = W * H, SECT = [4, 8, 8], SCENE_BF = [45, 80, 99], TRIS = [300000, 900000, 1470000];
function dynsimMs(m, shares, q, scale, aa) {
  const s = Math.min(1, Math.max(0.3, shares[q] * scale));
  const inn = Math.round(W * s) * Math.round(H * s), half = inn / 4, up = H / Math.round(H * s);
  const abs = 1 + 2 + 2 + SECT[q] * 4 + 2, sheet = 6 * 2 + 1 + 2 + 2 * 2 + 4 + 3 * 2 + (up > 1.15 ? 8 : 0);
  const post = (inn * abs + half * 7 + (half / 3) * 12 + OUT * sheet) * (m.post || 1);
  const px = Math.round(W * shares[q]) * Math.round(H * shares[q]), mb = (n) => (px * (n * 16 + 8)) / 1048576;
  const n = aa === 'post' || q === 0 ? 0 : mb(4) <= 100 ? 4 : mb(2) <= 100 ? 2 : 0;
  const msaa = n === 4 ? m.msaa4 || 1 : n === 2 ? m.msaa2 || 1 : 1;
  const bf = SCENE_BF[q] * inn * msaa + post + (n === 0 ? inn * 9 : 0);
  return Math.max((bf / m.rate) * 1000 + (TRIS[q] / m.tris) * 1000 + 0.6, m.cpu);
}
const UHD620 = { name: 'UHD 620 class', rate: 13.8e9, tris: 350e6, cpu: 9 };
const IRISXE = { name: 'Iris Xe class', rate: 32e9, tris: 900e6, cpu: 9 };
const R680M = { name: '680M class', rate: 52e9, tris: 1500e6, cpu: 9 };

function run(d, cost, seconds) {
  let t = 0, minInternal = Infinity, belowFloor = 0, changes = 0, worst = 0;
  const rungs = [];
  while (t < seconds) {
    const ms = cost(d);
    const r = d.frame(ms);
    if (r.changed) { changes++; rungs.push(`${d.quality}${d.aa ? '/' + d.aa : ''}`); }
    t += ms / 1000;
    if (t > seconds * 0.6) worst = Math.max(worst, ms);
    minInternal = Math.min(minInternal, d._shares ? Math.min(1, d._shares[d.quality] * d.scale) : Infinity);
  }
  return { changes, rungs, worst };
}
function tracked(opts, shares) {
  const d = new DynamicResolution({ ...opts, shares });
  d._shares = shares;
  return d;
}
// a run that records the smallest internal resolution reached and the time spent under the floor
function runLow(d, shares, cost, seconds, floor) {
  let t = 0, minInternal = 1, under = 0;
  while (t < seconds) { const ms = cost(d); d.frame(ms); t += ms / 1000; const i = internalOf(d, shares); minInternal = Math.min(minInternal, i); if (i < floor - 1e-9) under += ms / 1000; }
  return { minInternal, under };
}

test('W6.1 no model machine ends under the floor without a pin (desktop 0.67, phone and tablet 0.75)', () => {
  const machines = [UHD620, IRISXE, R680M, { ...UHD620, name: 'UHD 620, R1 post', post: 1.016, msaa4: 1.3, msaa2: 1.15 },
    { name: 'half a UHD 620', rate: 6.9e9, tris: 175e6, cpu: 9 }, { name: 'a quarter', rate: 3.45e9, tris: 90e6, cpu: 9 }];
  const synth = [
    { name: 'pixel-bound', cost: (q, i) => 2 + 40 * i * i * [0.45, 0.7, 1][q] },
    { name: 'phone-like', cost: (q, i) => 5 + 28 * i * i * [0.45, 0.7, 1][q] },
    { name: 'hopeless', cost: (q, i) => 30 + 200 * i * i * [0.45, 0.7, 1][q] },
    { name: 'vertex-bound', cost: (q) => [6, 11, 21][q] },
  ];
  for (const shares of [TODAY, W73]) {
    for (const floor of [FLOOR, FLOOR_TOUCH]) {
      const cases = machines.map((m) => ({ name: m.name, ms: (d) => dynsimMs(m, shares, d.quality, d.scale, d.aa) }))
        .concat(synth.map((m) => ({ name: m.name, ms: (d) => m.cost(d.quality, internalOf(d, shares)) })));
      for (const c of cases) {
        for (const rungs of [undefined, RUNGS_MSAA]) {
          const d = tracked({ floor, rungs }, shares);
          run(d, c.ms, 90);
          const i = internalOf(d, shares), q = d.quality;
          // a tier whose share is under the floor draws at render scale 1 (the most it can draw)
          const lowest = Math.min(floor, shares[q]);
          assert.ok(i >= lowest - 1e-9, `${c.name}, shares ${shares}, floor ${floor}${rungs ? ', MSAA rung' : ''}: ends at tier ${q} scale ${d.scale} = internal ${i.toFixed(3)} (floor ${lowest})`);
          if (shares[q] < floor) assert.equal(d.scale, 1, `${c.name}: a tier under the floor is drawn at its whole share`);
        }
      }
    }
  }
});

test('W6.1 the model UHD 620-class laptop at 1080p settles at 0.70 of the output or more (0.59 before)', () => {
  // dynsim's cost as the perf audit set it, and with R1's post (its reads a pixel at the near stations,
  // +1.6 %: docs/notes/painter.md); MSAA's own cost is not in this model (see the next test).
  for (const shares of [TODAY, W73]) {
    for (const post of [1, 1.016]) {
      const m = { ...UHD620, post };
      const d = tracked({}, shares);
      const r = run(d, (x) => dynsimMs(m, shares, x.quality, x.scale, x.aa), 120);
      const i = internalOf(d, shares);
      assert.ok(i >= 0.7 - 1e-9, `shares ${shares}, post x${post}: settles at tier ${d.quality} scale ${d.scale} = ${i.toFixed(3)} linear`);
      assert.ok(r.worst <= DR.DYNRES.highMs + 0.5, `and holds the budget: worst ${r.worst.toFixed(1)} ms`);
    }
  }
});

test('W6.1 with MSAA costed and its own rung: geometry is shed before MSAA, both before the floor is passed', () => {
  // MSAA's cost on an integrated GPU is a guess (+30 % of the scene pass at 4x, +15 % at 2x): no real GPU here.
  const m = { ...UHD620, post: 1.016, msaa4: 1.3, msaa2: 1.15 };
  for (const shares of [TODAY, W73]) {
    const d = tracked({ rungs: RUNGS_MSAA }, shares);
    const r = run(d, (x) => dynsimMs(m, shares, x.quality, x.scale, x.aa), 120);
    assert.ok(internalOf(d, shares) >= FLOOR - 1e-9, `ends at ${internalOf(d, shares).toFixed(3)}`);
    assert.equal(d.quality, 1, `ends on tier 1 (${d.quality}/${d.aa})`);
    // the order the rungs were left in: 2/auto -> 1/auto -> (1/post) -> 0, never a rung skipped downward
    let prev = 3;
    for (const step of r.rungs) {
      const idx = RUNGS_MSAA.findIndex((g) => `${g.q}/${g.aa}` === step);
      assert.ok(idx >= prev - 1, `a rung skipped on the way down: ${r.rungs.join(' ')}`);
      prev = idx;
    }
    assert.ok(r.worst <= DR.DYNRES.highMs + 0.5, `holds the budget: worst ${r.worst.toFixed(1)} ms`);
  }
  // a machine whose q1 holds only without MSAA ends on 1/post, at the floor or above
  const shares = W73;
  // (the top tier at its floor 26.4 ms, tier 1 with MSAA at its floor 20.8, without 16.3)
  const cost = (x) => { const i = internalOf(x, shares); return 4 + 50 * i * i * [0.45, x.aa === 'post' ? 0.55 : 0.75, 1][x.quality]; };
  const d = tracked({ rungs: RUNGS_MSAA }, shares);
  run(d, cost, 120);
  assert.deepEqual([d.quality, d.aa], [1, 'post'], `ends on tier 1 without MSAA: ${d.quality}/${d.aa} at ${internalOf(d, shares).toFixed(3)}`);
  assert.ok(internalOf(d, shares) >= FLOOR - 1e-9);
});

test('W6.1 a machine whose cost does not move with the pixels is not driven to the floor', () => {
  // vertex load: the top tier costs 20 ms whatever the resolution, the one below 12
  const shares = W73;
  const vertex = (x) => { const i = internalOf(x, shares); return 0.6 + [5, 11, 18][x.quality] + 2 * i * i; };
  const a = tracked({}, shares);
  const r = runLow(a, shares, vertex, 120, FLOOR);
  assert.equal(a.quality, 1, 'the geometry goes, not the pixels: tier ' + a.quality);
  assert.ok(r.minInternal >= 0.8, `the picture never went down to the floor: smallest ${r.minInternal.toFixed(3)} of the output`);
  assert.ok(internalOf(a, shares) >= 0.8, `and ends well above it: ${internalOf(a, shares).toFixed(3)}`);
  // post passes at the output's size: 15 ms at any resolution, the scene 5 ms at full size (q2), 3 (q1)
  const post = (x) => { const i = internalOf(x, shares); return 15 + [2, 3, 5][x.quality] * i * i; };
  const b = tracked({}, shares);
  const s = runLow(b, shares, post, 120, FLOOR);
  // (it may try the top tier again later, at 0.85, and settle there a little lower: still far from the floor)
  assert.ok(s.minInternal >= FLOOR + 0.08, `output-bound: smallest ${s.minInternal.toFixed(3)} of the output (tier ${b.quality})`);
  assert.ok(internalOf(b, shares) >= 0.8, `and ends at ${internalOf(b, shares).toFixed(3)} (tier ${b.quality})`);
  // and a CPU-bound machine (every setting 22 ms) keeps the best picture (the cap and CPU rule, kept)
  const c = tracked({}, shares);
  run(c, () => 22, 60);
  assert.deepEqual([c.quality, c.scale], [2, 1], 'the CPU-bound machine keeps the top picture');
});

test('W6.1 steps are sized from what the first step bought, not from pixels alone', () => {
  // half the frame is fixed (7 ms), half goes with the pixels: the pixel rule would take three or four
  // steps to find the budget; the measured rule is there in two, and does not overshoot below the floor
  const shares = [1, 1, 1];
  const cost = (x) => { const i = internalOf(x, shares); return 7 + 15 * i * i; };     // 22 ms at full size
  const d = tracked({}, shares);
  let t = 0, settledAt = null, steps = 0;
  while (t < 30) {
    const ms = cost(d); const r = d.frame(ms); t += ms / 1000;
    if (r.changed) steps++;
    if (settledAt == null && ms <= DR.DYNRES.highMs) settledAt = t;
  }
  assert.ok(steps <= 2 || settledAt < 1.5, `within budget after ${settledAt && settledAt.toFixed(2)} s, ${steps} changes in 30 s`);
  assert.ok(settledAt != null && settledAt < 1.6, `within budget after ${settledAt && settledAt.toFixed(2)} s`);
  const i = internalOf(d, shares);
  assert.ok(i >= FLOOR && i <= 0.9, `settles between the floor and full size: ${i.toFixed(3)}`);
});

test('W6.1 URL pins under the floor keep working (the tests\' painted runs: ?scale=0.5&quality=0)', () => {
  // the pinned tier and a scale under the floor: a slow machine stays at the pinned scale, never pushed up to the floor
  const d = new DynamicResolution({ scale: 0.5, quality: 0, minQuality: 0, maxQuality: 0, shares: TODAY, scaleFloor: 0.5 });
  assert.equal(d.scale, 0.5, 'the pinned start is kept');
  for (let i = 0; i < 600; i++) d.frame(900);
  assert.deepEqual([d.quality, d.scale], [0, 0.5], 'a software renderer stays where the URL put it');
  // a fast machine may climb from the pinned start, as before
  const f = new DynamicResolution({ scale: 0.5, quality: 0, minQuality: 0, maxQuality: 0, shares: TODAY, scaleFloor: 0.5 });
  run(f, () => 8, 120);
  assert.equal(f.scale, 1, 'room shown: the resolution climbs from the pinned start');
  // ?dynres=0 pins both, wherever they are
  const p = new DynamicResolution({ enabled: false, scale: 0.4, quality: 0, shares: TODAY });
  for (let i = 0; i < 100; i++) p.frame(50);
  assert.deepEqual([p.quality, p.scale], [0, 0.4]);
  // without a pin a start under the floor is lifted to it
  const u = new DynamicResolution({ scale: 0.5, quality: 2, shares: W73 });
  assert.equal(u.scale, FLOOR, 'no pin: lifted to the floor');
  const t = new DynamicResolution({ scale: 0.5, quality: 2, shares: W73, floor: FLOOR_TOUCH });
  assert.equal(t.scale, FLOOR_TOUCH, 'the phone floor');
  assert.equal(new DynamicResolution({ quality: 0, shares: W73, floor: FLOOR_TOUCH }).sMin(0), 1, "the phone's tier 0 at W7.3's share is at its floor at scale 1");
});

test('W6.1 nothing left to shed and still over budget: exhausted (what the phone paces on)', () => {
  const shares = W73;
  const slow = tracked({ floor: FLOOR_TOUCH, quality: 1 }, shares);
  run(slow, (x) => { const i = internalOf(x, shares); return 10 + 30 * i * i * [0.6, 0.8, 1][x.quality]; }, 20);
  assert.equal(slow.quality, 0);
  assert.ok(internalOf(slow, shares) >= FLOOR_TOUCH - 1e-9);
  assert.ok(slow.exhausted, 'over budget at the floor of the lowest tier: exhausted');
  const ok = tracked({ floor: FLOOR_TOUCH, quality: 1 }, shares);
  run(ok, () => 12, 20);
  assert.ok(!ok.exhausted, 'a machine on budget is not');
  // a tier pinned by the URL is the lowest allowed: exhausted there too
  const pin = tracked({ minQuality: 1, maxQuality: 1, quality: 1 }, shares);
  run(pin, (x) => { const i = internalOf(x, shares); return 10 + 30 * i * i; }, 20);
  assert.ok(pin.exhausted && pin.quality === 1);
});

test('W6.1 the tiers\' shares: said by the painter, the stub\'s [1,1,1], read off the painter, or today\'s', () => {
  assert.equal(typeof DR.tierSharesOf, 'function');
  assert.deepEqual(DR.tierSharesOf({ tierShares: [0.75, 0.85, 1] }), [0.75, 0.85, 1]);
  assert.deepEqual(DR.tierSharesOf({ isStub: true }), [1, 1, 1]);
  // a painter that can only be asked: its internal height at render scale 1, tier by tier
  const TI = [0.62, 0.8, 1];
  let q = 2, s = 1, sets = 0;
  const outH = 425;
  const p = {
    info: { get internalHeight() { return Math.round(outH * Math.min(1, TI[q] * s)); } },
    setQuality(v) { q = v; sets++; }, setRenderScale(v) { s = v; sets++; },
  };
  assert.deepEqual(DR.tierSharesOf(p, outH, { scale: 0.9, quality: 1 }), TI);
  assert.deepEqual([q, s], [1, 0.9], 'the painter is left where the game had it');
  assert.deepEqual(DR.tierSharesOf({}, outH), [...DR.TIER_SHARES], 'nothing to go by: today\'s shares');
  assert.deepEqual([...DR.TIER_SHARES], TODAY);
});
