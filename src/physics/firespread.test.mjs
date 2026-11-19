// Tests: the four mechanics added to the fire on 2026-11-19, when the owner asked to "really figure out the
// mechanics of how a fire spreads and starts and how it spreads and how it acts based around different
// environments". OWNER: PHYSICS.
//
//   IT RUNS UPHILL and creeps down.
//   IT NEEDS AIR: on an airless world nothing catches, and in thin air it burns slower.
//   EMBERS GO AHEAD OF IT in a wind, over a gap no creeping fire could cross.
//   IT MAKES ITS OWN WEATHER: enough fire in one place in a light wind is a FIRE WHIRL; a gale is not.
//
// Run: node --test src/physics/firespread.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeFires, lightFire, stepFires, clearBurns, slopeRate, FIRE, FUEL } from './fire.js';

const R = 6371000;
const BODY = 'testworld';
const at = (e, n) => { const k = R / Math.hypot(e, n, R); return { x: e * k, y: n * k, z: R * k }; };

// A world whose ground RISES GOING NORTH at `slope` (rise over run), everything else wood. `bare(e, n)` may say a
// place has nothing on it.
function hill(slope, bare = null) {
  return {
    asks: 0, wind: { x: 0, y: 0, z: 0 }, air: 1,
    fuelAt(bodyId, px, py, pz, out) {
      this.asks++;
      const none = bare && bare(px, py);
      out.kind = none ? FUEL.none : FUEL.leaves;
      out.fuel = none ? 0 : 1;
      out.wet = 0;
      const want = R + py * slope;                       // the ground rises toward the north
      const k = want / (Math.hypot(px, py, pz) || 1);
      out.px = px * k; out.py = py * k; out.pz = pz * k;
    },
    windAt(s, o) { o[0] = this.wind.x; o[1] = this.wind.y; o[2] = this.wind.z; },
    airAt() { return this.air; },
  };
}
const run = (F, ctx, secs, hz = 60) => { const n = Math.round(secs * hz); for (let i = 0; i < n; i++) { stepFires(F, 1 / hz, ctx); clearBurns(F); } return F; };
const reach = (F) => { let north = 0, south = 0; for (let i = 0; i < F.count; i++) { const n = F[i].py; if (n > north) north = n; if (-n > south) south = -n; } return { north, south }; };
const live = (F) => { let n = 0; for (let i = 0; i < F.count; i++) if (!F[i].ash && F[i].heat > 0) n++; return n; };

test('fire: the rate doubles for every ten degrees of upslope, and is bounded both ways', () => {
  assert.ok(Math.abs(slopeRate(0) - 1) < 1e-9, 'level ground is not 1: ' + slopeRate(0));
  assert.ok(Math.abs(slopeRate(FIRE.slopeDouble) - 2) < 1e-9, 'ten degrees up is not double: ' + slopeRate(FIRE.slopeDouble));
  assert.ok(Math.abs(slopeRate(-FIRE.slopeDouble) - 0.5) < 1e-9, 'ten degrees down is not half: ' + slopeRate(-FIRE.slopeDouble));
  assert.equal(slopeRate(99), FIRE.slopeMax, 'up a cliff is not capped');
  assert.equal(slopeRate(-99), FIRE.slopeMin, 'straight down is not floored');
  assert.equal(slopeRate(NaN), 1, 'a not-a-number slope must be taken as level');
  // and it rises the whole way, with no step in it
  let was = 0;
  for (let u = -0.6; u <= 0.6; u += 0.05) { const r = slopeRate(u); assert.ok(r >= was - 1e-12, 'it is not monotonic at ' + u.toFixed(2)); was = r; }
});

test('fire: it runs uphill and creeps down', () => {
  // the same fire, the same still air, on a one-in-three slope: the only difference between north and south is
  // which way the ground goes
  const ctx = hill(0.33);
  const F = makeFires();
  lightFire(F, BODY, at(0, 0), 3, ctx);
  run(F, ctx, 26);
  const r = reach(F);
  assert.ok(r.north > r.south * 1.5,
    'it did not run uphill: ' + r.north.toFixed(1) + ' m up against ' + r.south.toFixed(1) + ' m down');
});

test('fire: on a level world it goes the same way in every direction', () => {
  // the companion to the test above: without a slope there is no bias, so the one above is measuring the slope
  // and not some accident of the way the spokes are walked
  const ctx = hill(0);
  const F = makeFires();
  lightFire(F, BODY, at(0, 0), 3, ctx);
  run(F, ctx, 26);
  const r = reach(F);
  const big = Math.max(r.north, r.south), small = Math.min(r.north, r.south);
  assert.ok(big < small * 1.5 + 4,
    'a level world still favoured one way: ' + r.north.toFixed(1) + ' north, ' + r.south.toFixed(1) + ' south');
});

test('fire: on an airless world nothing catches and the flame dies', () => {
  const ctx = hill(0);
  ctx.air = 0;
  const F = makeFires();
  const s = lightFire(F, BODY, at(0, 0), 3, ctx);
  assert.ok(s, 'the cast itself should still happen: the player must see that they cast');
  run(F, ctx, 6);
  assert.equal(live(F), 0, 'something is still burning on a world with no air');
  assert.equal(reach(F).north, 0, 'it spread on a world with no air');
});

test('fire: in thin air the same fuel lasts longer', () => {
  const burnOut = (air) => {
    const ctx = hill(0); ctx.air = air;
    const F = makeFires();
    lightFire(F, BODY, at(0, 0), 1, ctx);
    const s = F[0];
    let t = 0;
    for (let i = 0; i < 60 * 60; i++) { stepFires(F, 1 / 60, ctx); clearBurns(F); t += 1 / 60; if (!(s.fuel > 0)) break; }
    return t;
  };
  const thick = burnOut(1), thin = burnOut(0.3);
  assert.ok(thin > thick * 1.2,
    'thin air did not slow the burn: ' + thick.toFixed(1) + ' s in full air, ' + thin.toFixed(1) + ' s in thin');
});

test('fire: an ember crosses a gap that a creeping fire cannot', () => {
  // a bare band from 7 to 14 m north. The ordinary step is about 2.2 m, so nothing can walk over it.
  const band = (px, py) => py > 7 && py < 14;
  const far = (F) => { let n = 0; for (let i = 0; i < F.count; i++) if (F[i].py > 14.5) n++; return n; };

  const still = hill(0, band);
  const A = makeFires();
  lightFire(A, BODY, at(0, 0), 4, still);
  run(A, still, 40);
  assert.equal(far(A), 0, 'a fire in still air walked over a seven-metre gap, which it must not');

  // the same gap, with a wind strong enough to carry a piece of it
  const blown = hill(0, band);
  blown.wind.y = FIRE.windCap;            // a full wind, blowing north
  const B = makeFires();
  lightFire(B, BODY, at(0, 0), 4, blown);
  run(B, blown, 40);
  assert.ok(far(B) > 0, 'no ember crossed the gap in a full wind');
});

test('fire: enough fire in one place in a light wind is a whirl, and a gale is not', () => {
  const ctx = hill(0);
  const F = makeFires();
  // (14 s, not 8: MEASURED, a cast of size 4 in dense wood has 7 patches alight at 8 s and reaches the ninth at
  //  about 10. The first run of this test failed at 8 s and the fault was the test's, not the fire's.)
  lightFire(F, BODY, at(0, 0), 4, ctx);
  run(F, ctx, 14);
  assert.ok(F.whirl, 'a big fire in still air raised no whirl');
  assert.ok(F.whirl.patches >= FIRE.whirlN, 'the whirl says it has ' + F.whirl.patches + ' patches, under its own threshold');
  assert.ok(F.whirl.strength > 0 && F.whirl.strength <= 1, 'the strength is outside 0..1: ' + F.whirl.strength);
  assert.equal(F.whirl.bodyId, BODY);

  // the same fire in a gale: the column is torn apart before it can turn
  const gale = hill(0);
  gale.wind.y = FIRE.windCap;
  const G = makeFires();
  lightFire(G, BODY, at(0, 0), 4, gale);
  run(G, gale, 14);
  assert.equal(G.whirl, null, 'a whirl formed in a full gale, where the column cannot hold together');
});

test('fire: a whirl needs to hold before it is called one, and goes when the fire does', () => {
  const ctx = hill(0);
  const F = makeFires();
  lightFire(F, BODY, at(0, 0), 4, ctx);
  stepFires(F, 1 / 60, ctx); clearBurns(F);
  assert.equal(F.whirl, null, 'one frame of fire was already called a whirl');
  run(F, ctx, 14);
  assert.ok(F.whirl, 'it never became a whirl');
  // put it out: the whirl must go with it
  for (let i = 0; i < F.count; i++) { F[i].fuel = 0; F[i].heat = 0; F[i].ash = true; }
  stepFires(F, 1 / 60, ctx);
  assert.equal(F.whirl, null, 'the whirl outlived the fire under it');
});

test('fire: snuff puts out what is near it and leaves the rest burning', async () => {
  const { douseNear } = await import('./fire.js');
  const ctx = hill(0);
  const F = makeFires();
  lightFire(F, BODY, at(0, 0), 4, ctx);
  run(F, ctx, 16);
  const before = live(F);
  assert.ok(before >= 6, 'the fire to put out never got going: ' + before);
  // put out only what is within 6 m of where it was lit
  const n = douseNear(F, BODY, at(0, 0), 6);
  assert.ok(n > 0, 'snuff put nothing out');
  for (let i = 0; i < F.count; i++) {
    const s = F[i];
    if (s.ash) continue;
    const d = Math.hypot(s.px, s.py, s.pz - R);
    assert.ok(d > 5.5, 'a patch ' + d.toFixed(1) + ' m from the middle is still alight inside the snuff');
  }
  assert.equal(F.whirl, null, 'the whirl survived a snuff through the middle of its own fire');
  // and a snuff on another world touches nothing
  const m = douseNear(F, 'elsewhere', at(0, 0), 60);
  assert.equal(m, 0, 'a snuff reached across worlds');
});
