// Painted Cosmos: the water's hooks (lane 0, docs/lead/WATER-DESIGN.md 5.0) -- the switches, and that the surface asks the
// water's parts only when they are attached and writes their fields EVERY time. OWNER: PAINTER.
// Run: node --test src/world/waterhooks.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODE, overlayOil, waterFromSearch } from '../data/mode.js';
import { LOOKS } from '../data/looks.js';
MODE.oil = true; overlayOil(LOOKS);
const { getSurface, makeSample, NOLQ } = await import('./surface.js');
const WH = await import('./waterhooks.js');

test('the switches: the watercolour game has none; the oil look has the reviewed water on by default, each with its opt-out', () => {
  const W = waterFromSearch('?flow=1');
  assert.equal(W.on, false);
  for (const k of ['rivers', 'lakes', 'ponds', 'puddles', 'swell', 'falls', 'fjord', 'splash']) assert.equal(W[k], 0, k);
  assert.equal(W.wpaint, 1, 'the new strokes are the default on rivers and ponds (the coordinator, 24 Nov)');
  assert.equal(W.wsea, 0, 'and v37\'s on the sea until the sea from the air passes');
  let P = waterFromSearch('?wpaint=0'); assert.equal(P.wpaint, 0); assert.equal(P.wsea, 0, '?wpaint=0 alone: v37\'s water everywhere');
  P = waterFromSearch('?wpaint=2'); assert.equal(P.wpaint, 2); assert.equal(P.wsea, 2, '?wpaint=2 alone: the new paint everywhere');
  P = waterFromSearch('?wpaint=2&wsea=0'); assert.equal(P.wpaint, 2); assert.equal(P.wsea, 0);
  P = waterFromSearch('?wsea=1'); assert.equal(P.wpaint, 1); assert.equal(P.wsea, 1);
  assert.equal(W.wakes, 1);
  // (the oil look's defaults, 24 Nov: rivers of the tree with bends, lakes, ponds, puddles, fjord, and the falls since the
  //  paint's curtain fix passed the look director)
  const O = waterFromSearch('?look=oil');
  assert.equal(O.on, true);
  for (const k of ['rivers', 'lakes', 'ponds', 'puddles', 'fjord', 'falls']) assert.equal(O[k], 1, k);
  for (const k of ['swell', 'runoff', 'mount', 'splash', 'wsea']) assert.equal(O[k], 0, k);
  assert.equal(O.wpaint, 1, 'the strokes on rivers and ponds, the sea on v37 (wsea 0)');
  assert.equal(O.bends, 1);
  // (all six turned off: the oil look's ground water as it was)
  const X = waterFromSearch('?look=oil&rivers=old&lakes=0&ponds=0&puddles=0&fjord=0&falls=0');
  assert.equal(X.on, false);
  for (const k of ['rivers', 'lakes', 'ponds', 'puddles', 'falls', 'fjord']) assert.equal(X[k], 0, k);
  assert.equal(waterFromSearch('?look=oil&rivers=old').rivers, 0); assert.equal(waterFromSearch('?look=oil&lakes=0').lakes, 0); assert.equal(waterFromSearch('?look=oil&falls=0').falls, 0);
  const V = waterFromSearch('?rivers=tree&lakes=1&wpaint=2&wakes=2');
  assert.equal(V.on, true); assert.equal(V.rivers, 1); assert.equal(V.lakes, 1); assert.equal(V.wpaint, 2); assert.equal(V.wakes, 2);
  assert.equal(waterFromSearch('?wpaint=2').on, false, 'the paint alone changes no ground');
  assert.equal(waterFromSearch('?rivers=1').rivers, 0, 'rivers takes the word tree, nothing else');
  waterFromSearch('');
});

test('no switch: loadWater fetches nothing and ensureWater attaches nothing', async () => {
  waterFromSearch('');
  assert.equal(await WH.loadWater(), false);
  WH.ensureWater('earth');
  const S = getSurface('earth');
  assert.equal(S.rivers, null); assert.equal(S.hydro, null);
});

test('the surface asks the parts only when attached, and writes their fields every time', () => {
  const S = getSurface('earth'), o = makeSample(S.nB), sp = S.getSpawn();
  const p = [sp.x, sp.y, sp.z];
  S.sample(p[0], p[1], p[2], o, true);
  const h0 = o.h, lq0 = o.lq, s0 = o.s;
  assert.equal(o.still, 0); assert.equal(o.bank, 0); assert.equal(o.cap, 0); assert.equal(o.swell, 0);
  // a river part that says "a river 1 m away, flowing east", and a hydro part that marks every other call still
  let rc = 0, fc = 0, cc = 0, odd = false;
  S.rivers = { sample(SS, c) { rc++; c.pool = 0; c.bar = 0; c.fu = 1; c.fv = 0; c.swell = 0.5; return 1.0; } };
  S.hydro = {
    forest(SS, c, b, H) {
      fc++; odd = !odd;
      assert.ok(Math.abs(H.L + H.hb + H.hill * H.rise + H.sm + H.mi + H.rock - b.h) < 1e-9, 'H holds the parts b.h was made of');
      if (odd) { c.still = 1; c.cap = 0.05; }
    },
    coast(SS, c, hh) { cc++; c.lqC = NaN; return hh; },
  };
  try {
    S.sample(p[0], p[1], p[2], o, true);
    assert.ok(rc > 0, 'the river part was asked'); assert.ok(fc > 0, 'the hydro part was asked in the wood');
    assert.ok(Math.abs(o.s - 1.0) < 0.5, 'the river part answers the distance (the wood wobbles it a little)'); assert.equal(o.swell, 0.5); assert.equal(o.still, 1); assert.equal(o.cap, 0.05);
    S.sample(p[0], p[1], p[2], o, true);         // the hydro part says nothing this time: the fields must not keep the last call's
    assert.equal(o.still, 0, 'still written every time'); assert.equal(o.cap, 0, 'cap written every time');
    // a coast point: the coast hook is asked there and its NaN leaves the sea's level alone
    const o2 = makeSample(S.nB); let coastSeen = false;
    let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 4000 && !coastSeen; i++) {
      let x = rnd() * 2 - 1, y = rnd() * 2 - 1, z = rnd() * 2 - 1; const l = Math.hypot(x, y, z); x /= l; y /= l; z /= l;
      const c0 = cc; S.sample(x, y, z, o2, false);
      if (cc > c0 && o2.lq !== NOLQ) coastSeen = true;
    }
    assert.ok(coastSeen, 'the coast hook was asked somewhere on Earth');
  } finally { S.rivers = null; S.hydro = null; }
  S.sample(p[0], p[1], p[2], o, true);
  assert.equal(o.h, h0); assert.equal(o.lq, lq0); assert.equal(o.s, s0);
});

test('the water frame steps the registered parts, and a failing part does not stop the others', () => {
  let a = 0, b = 0;
  WH.WATER_PARTS.push({ name: 'bad', update() { throw new Error('x'); } }, { name: 'good', update(ctx) { a++; b = ctx.dt; } });
  const warn = console.warn; console.warn = () => {};
  try { WH.frame({ id: 'earth', root: null, body: null }, 0.016, null, null); WH.frame({ id: 'earth' }, 0.02, null, null); }
  finally { console.warn = warn; WH.WATER_PARTS.length = 0; }
  assert.equal(a, 2); assert.equal(b, 0.02);
});

test('a water part may say how aerated its water is and how fast it runs, and only where it says so', () => {
  const S = getSurface('earth'), o = makeSample(S.nB), sp = S.getSpawn();
  S.sample(sp.x, sp.y, sp.z, o, false);
  const t0 = o.turb, f0 = o.fspd;
  let say = true;
  S.hydro = { forest(SS, c) { if (say) { c.turbW = 0.37; c.fspdW = 2.5; } }, coast(SS, c, hh) { c.lqC = NaN; return hh; } };
  try {
    S.sample(sp.x, sp.y, sp.z, o, false);
    assert.equal(o.turb, 0.37); assert.equal(o.fspd, 2.5);
    say = false;
    S.sample(sp.x, sp.y, sp.z, o, false);
    assert.equal(o.turb, t0, 'the field\'s own churn again where the part says nothing'); assert.equal(o.fspd, f0);
  } finally { S.hydro = null; }
});
