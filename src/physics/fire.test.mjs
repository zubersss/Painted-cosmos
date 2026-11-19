// Tests: the fire the explorer lights (fire.js) -- that it spreads, that the wind carries it, that it stops at
// water and at bare rock, that it burns out behind itself, THAT IT GOES OUT, what it reports, its cap, and what a
// frame of it costs.
// Run: node --test src/physics/fire.test.mjs   (or node --test src/physics/ for all the physics)
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeFires, lightFire, stepFires, placeFires, fireAt, clearBurns, anyBurning, douseFires, fireBytes, FIRE, FUEL } from './fire.js';
import { LocalFrame } from './near.js';
// THE GAME'S OWN LASTING RECORD, NOT A STAND-IN. The tests at the foot of this file light fires with the real thing
// behind them, because "does a fire go out" was once answered yes by a stand-in that never forgot anything, while
// the real record is capped and forgets, and with it the same fire burned for ever.
import { scorch, burntAt, burntLoad, BURNT, BURN } from '../data/burnt.js';

// ---- a plain stand-in world ------------------------------------------------------------------
// A round world of this radius, and one place on it to light fires at: the point (0, 0, R), where east is +X and
// north is +Y (util.js eastNorth). So a patch's px is how many metres east of there it is, and py how many north
// (near enough: over the hundred metres a fire runs, the curve of a world this size is under a millimetre).
const R = 6371000;
const BODY = 'testworld';
const at = (e, n) => { const k = R / Math.hypot(e, n, R); return { x: e * k, y: n * k, z: R * k }; };
const EAST = (s) => s.px, NORTH = (s) => s.py;

// `cover(e, n)` is what the world has at that place: { kind, fuel, wet }. Left out, it is wood everywhere.
// `remember`: the world keeps a note of every place the fire has reported as burnt and offers it nothing more.
// That is the one thing the real game has that fire.js does not (the lasting record, src/data/burnt.js), and a
// world without it lets a fire burn the same ground over and over, so the tests that need a fire to DIE say so.
function world(cover, remember = false) {
  return {
    asks: 0, winds: 0, scars: [],
    wind: { x: 0, y: 0, z: 0 },
    // the game does this: read the rows the fire left, write them down, clear them
    keep(F) {
      if (remember) for (let i = 0; i < F.burns.count; i++) {
        const b = F.burns[i];
        if (b.kind !== FUEL.ice) this.scars.push({ px: b.px, py: b.py, pz: b.pz, r: b.radius });
      }
      clearBurns(F);
    },
    burnt(px, py, pz) {
      for (let i = 0; i < this.scars.length; i++) {
        const k = this.scars[i], dx = px - k.px, dy = py - k.py, dz = pz - k.pz;
        if (dx * dx + dy * dy + dz * dz < k.r * k.r) return true;
      }
      return false;
    },
    fuelAt(bodyId, px, py, pz, out) {
      this.asks++;
      const c = remember && this.burnt(px, py, pz) ? { kind: FUEL.none } : (cover ? cover(px, py) : { kind: FUEL.leaves, fuel: 1 });
      out.kind = c && c.kind !== undefined ? c.kind : FUEL.none;
      out.fuel = c && c.fuel !== undefined ? c.fuel : 1;
      out.wet = c && c.wet !== undefined ? c.wet : 0;
      // the world sets the place down on its own ground (here, a plain sphere)
      const k = R / (Math.hypot(px, py, pz) || 1);
      out.px = px * k; out.py = py * k; out.pz = pz * k;
    },
    windAt(s, o) { this.winds++; o[0] = this.wind.x; o[1] = this.wind.y; o[2] = this.wind.z; },
  };
}
// a wind of U metres a second blowing toward the north (in the body's own axes, at our one place)
const northWind = (ctx, U) => { ctx.wind.x = 0; ctx.wind.y = U; ctx.wind.z = 0; };

function run(F, ctx, secs, each, hz = 60) {
  const n = Math.round(secs * hz);
  for (let i = 0; i < n; i++) { stepFires(F, 1 / hz, ctx); if (each) each(F, i / hz); }
  return F;
}
const live = (F) => { let n = 0; for (let i = 0; i < F.count; i++) if (!F[i].ash) n++; return n; };
// the furthest any patch has got in a direction, ash and all, watched over the whole run
function watcher() {
  const m = { north: -1e9, south: -1e9, east: -1e9, west: -1e9, lit: 0, most: 0 };
  return {
    m,
    look(F) {
      for (let i = 0; i < F.count; i++) {
        const s = F[i], e = EAST(s), n = NORTH(s);
        if (n > m.north) m.north = n;
        if (-n > m.south) m.south = -n;
        if (e > m.east) m.east = e;
        if (-e > m.west) m.west = -e;
      }
      if (F.count > m.most) m.most = F.count;
      m.lit = F.lit;
    },
  };
}

// ---- it spreads ------------------------------------------------------------------------------

test('a fire lit in a wood spreads from where it was lit', () => {
  const F = makeFires(7), ctx = world();
  const s = lightFire(F, BODY, at(0, 0), 1, ctx);
  assert.ok(s, 'it was lit');
  assert.equal(s.kind, FUEL.leaves, 'and it found the wood under it');
  assert.equal(F.count, 1, 'one patch to begin with');
  const w = watcher();
  run(F, ctx, 20, (f) => w.look(f));
  assert.ok(F.lit > 8, 'many patches have caught in 20 s: ' + F.lit);
  const reach = Math.max(w.m.north, w.m.south, w.m.east, w.m.west);
  assert.ok(reach > 8, 'and the fire has got well away from where it was lit: ' + reach.toFixed(1) + ' m');
  // it went every way, not along one line
  assert.ok(Math.min(w.m.north, w.m.south, w.m.east, w.m.west) > 3,
    'in still air it spreads all round: N ' + w.m.north.toFixed(1) + ' S ' + w.m.south.toFixed(1) + ' E ' + w.m.east.toFixed(1) + ' W ' + w.m.west.toFixed(1));
});

test('lit where nothing will burn it shows for a moment and spreads nothing', () => {
  for (const c of [{ kind: FUEL.none }, { kind: FUEL.leaves, fuel: 1, wet: 0.9 }]) {
    const F = makeFires(3), ctx = world(() => c);
    const s = lightFire(F, BODY, at(0, 0), 1, ctx);
    assert.equal(s.kind, FUEL.none, 'nothing under it');
    run(F, ctx, 1, null);
    assert.ok(s.heat > 0, 'the ability still makes a flame, so the player sees the cast');
    run(F, ctx, FIRE.bareLife + FIRE.dieTime + 0.5, null);
    assert.equal(F.count, 0, 'and a few seconds later there is no fire at all, and no ash: nothing burned');
    assert.equal(F.lit, 1, 'nothing ever caught from it');
    assert.equal(F.burns.count, 0, 'and nothing was reported as burnt');
  }
});

// ---- the wind carries it ---------------------------------------------------------------------

test('the wind carries it: it runs much further downwind than across or against the wind', () => {
  const secs = 26;
  const go = (U) => {
    const F = makeFires(11), ctx = world();
    northWind(ctx, U);
    lightFire(F, BODY, at(0, 0), 1, ctx);
    const w = watcher();
    run(F, ctx, secs, (f) => w.look(f));
    return w.m;
  };
  const calm = go(0), blow = go(14);
  const cross = (blow.east + blow.west) / 2;
  const ratio = blow.north / cross, back = blow.north / Math.max(0.01, blow.south);
  // the numbers this run measured, for the report (and so a change that flattens the wind out is noticed here)
  console.log('  still air: N %s S %s E %s W %s m in %ss',
    calm.north.toFixed(1), calm.south.toFixed(1), calm.east.toFixed(1), calm.west.toFixed(1), secs);
  console.log('  a 14 m/s wind from the south: downwind %s m, across %s m, upwind %s m -> %sx across, %sx upwind',
    blow.north.toFixed(1), cross.toFixed(1), blow.south.toFixed(1), ratio.toFixed(2), back.toFixed(2));
  assert.ok(Math.abs(calm.north - calm.south) < calm.north * 0.6, 'in still air it is much the same both ways');
  assert.ok(ratio > 1.6, 'it runs at least half again as far downwind as across the wind: ' + ratio.toFixed(2) + 'x');
  assert.ok(back > 2.5, 'and much further downwind than into the wind: ' + back.toFixed(2) + 'x');
  assert.ok(blow.north > calm.north * 1.3, 'the wind makes the fire run: ' + blow.north.toFixed(1) + ' m against ' + calm.north.toFixed(1) + ' m in still air');
});

test('in a light wind it still creeps against the wind, it does not stop dead', () => {
  const F = makeFires(43), ctx = world();
  northWind(ctx, 4);                       // a breeze, not a gale
  lightFire(F, BODY, at(0, 0), 1, ctx);
  const w = watcher();
  run(F, ctx, 26, (f) => w.look(f));
  console.log('  a 4 m/s breeze: downwind %s m, across %s m, upwind %s m',
    w.m.north.toFixed(1), ((w.m.east + w.m.west) / 2).toFixed(1), w.m.south.toFixed(1));
  assert.ok(w.m.south > 4, 'it still backs into a breeze: ' + w.m.south.toFixed(1) + ' m');
  assert.ok(w.m.north > w.m.south * 1.3, 'but it runs with the breeze first: ' + w.m.north.toFixed(1) + ' m downwind');
});

test('the same fire lit twice the same way burns the same way', () => {
  const shape = (seed) => {
    const F = makeFires(seed), ctx = world();
    northWind(ctx, 9);
    lightFire(F, BODY, at(0, 0), 2, ctx);
    run(F, ctx, 18, null);
    let t = '';
    for (let i = 0; i < F.count; i++) t += F[i].px.toFixed(2) + ',' + F[i].py.toFixed(2) + ',' + F[i].fuel.toFixed(3) + ';';
    return t;
  };
  assert.equal(shape(51), shape(51), 'twice from the same seed: the same fire');
  assert.notEqual(shape(51), shape(52), 'and a different seed takes a different way through the wood');
});

test("a gust from the player drives the fire the way it is sent", () => {
  // the player's wind arrives the same way the world's does, in the body's own axes (the physics adds what
  // powers.js gives at the patch to the world's wind before handing it over), so a gust toward the east shows
  // here as the fire running east
  const F = makeFires(5), ctx = world();
  lightFire(F, BODY, at(0, 0), 1, ctx);
  ctx.wind.x = 20; ctx.wind.y = 0; ctx.wind.z = 0;        // a strong gust, straight east
  const w = watcher();
  run(F, ctx, 22, (f) => w.look(f));
  assert.ok(w.m.east > w.m.west * 2.5, 'it ran east with the gust: E ' + w.m.east.toFixed(1) + ' m, W ' + w.m.west.toFixed(1) + ' m');
  assert.ok(w.m.east > w.m.north * 1.5, 'and east rather than along the way it was not sent: N ' + w.m.north.toFixed(1) + ' m');
});

// ---- it stops where nothing will burn --------------------------------------------------------

test('it stops at water and at bare ground, and burns right up to the edge', () => {
  //   north of 12 m: a lake.   east of 10 m: bare rock.   everything else: undergrowth.
  const F = makeFires(2), ctx = world((e, n) => {
    if (n > 12) return { kind: FUEL.none };                    // water
    if (e > 10) return { kind: FUEL.none };                    // bare rock
    return { kind: FUEL.undergrowth, fuel: 1 };
  });
  northWind(ctx, 12);                                          // and the wind is blowing it at the lake
  lightFire(F, BODY, at(0, 0), 1, ctx);
  let worstN = -1e9, worstE = -1e9;
  run(F, ctx, 30, (f) => {
    for (let i = 0; i < f.count; i++) {
      if (NORTH(f[i]) > worstN) worstN = NORTH(f[i]);
      if (EAST(f[i]) > worstE) worstE = EAST(f[i]);
    }
  });
  assert.ok(worstN <= 12, 'no patch is burning in the lake: the furthest north was ' + worstN.toFixed(2) + ' m');
  assert.ok(worstE <= 10, 'nor on the bare rock: the furthest east was ' + worstE.toFixed(2) + ' m');
  assert.ok(worstN > 8, 'but it did burn up to the water (' + worstN.toFixed(1) + ' m of 12)');
  for (let i = 0; i < F.count; i++) assert.ok(F[i].kind !== FUEL.none, 'nothing burning on nothing');
});

test('rain puts out a fire that is already alight', () => {
  const F = makeFires(4), ctx = world();
  let raining = false;
  ctx.dampAt = () => (raining ? 0.9 : 0);
  lightFire(F, BODY, at(0, 0), 1, ctx);
  run(F, ctx, 14, null);
  const before = live(F);
  assert.ok(before > 2, 'a fire going well: ' + before + ' patches');
  raining = true;
  run(F, ctx, FIRE.dampEvery + FIRE.dieTime + 0.5, null);
  assert.equal(live(F), 0, 'the shower put every patch out');
  run(F, ctx, FIRE.ashLife + 1, null);
  assert.equal(F.count, 0, 'and the ashes are gone too');
});

// ---- it burns out and leaves a front ---------------------------------------------------------

test('a patch burns out, so the fire is a front and the middle goes cold', () => {
  const F = makeFires(9), ctx = world(null, true);
  const lit = lightFire(F, BODY, at(0, 0), 1, ctx).id;
  let finished = 0;
  run(F, ctx, 30, (f) => {
    for (let i = 0; i < f.burns.count; i++) if (f.burns[i].id === lit && f.burns[i].done) finished++;
    ctx.keep(f);
  });
  assert.equal(finished, 1, 'the patch it was lit at burnt through and said so, once');
  assert.ok(live(F) > 0, 'while the fire itself is still going: ' + live(F) + ' patches alight');
  // every patch still alight is away from the middle: a ring, not a disc
  let nearest = 1e9, furthest = 0;
  for (let i = 0; i < F.count; i++) {
    if (F[i].ash) continue;
    const d = Math.hypot(EAST(F[i]), NORTH(F[i]));
    if (d < nearest) nearest = d;
    if (d > furthest) furthest = d;
  }
  console.log('  after 30 s: %s patches alight, between %s and %s m from where it was lit',
    live(F), nearest.toFixed(1), furthest.toFixed(1));
  assert.ok(nearest > 4, 'nothing is still burning in the middle: the nearest is ' + nearest.toFixed(1) + ' m out');
  assert.ok(furthest - nearest < furthest * 0.9, 'and what is alight is a front, not a disc');
});

test('one casting does not run across the world', () => {
  const F = makeFires(13), ctx = world(null, true);
  northWind(ctx, 16);
  const lim = lightFire(F, BODY, at(0, 0), 1, ctx).reach;
  let far = 0;
  run(F, ctx, 200, (f) => {
    for (let i = 0; i < f.count; i++) { const d = Math.hypot(EAST(f[i]), NORTH(f[i])); if (d > far) far = d; }
    ctx.keep(f);
  });
  // (2026-11-19, the owner: "wind strengthens the fire".) THE LIMIT IS NOW THE WIND-DRIVEN ONE. A fire in a full
  // gale runs FIRE.windReach times further from where it was lit than a creeping one does -- that is the point of
  // the change, and the bound is still finite and still small: 1.35 times, not 'until it meets the sea'. This test
  // holds the new bound, which is what keeps a casting from crossing the world.
  const lim2 = lim * FIRE.windReach;
  console.log('  a fire in endless wood with a 16 m/s wind got %s m from where it was lit (its limit is %s m, %s still)', far.toFixed(0), lim2.toFixed(0), lim.toFixed(0));
  assert.ok(far <= lim2 + FIRE.spread * 2, 'it stayed within its wind-driven reach: ' + far.toFixed(0) + ' m of ' + lim2.toFixed(0));
  assert.ok(far > lim, 'the wind did NOT drive it past its still-air reach: ' + far.toFixed(0) + ' m of ' + lim.toFixed(0));
  assert.ok(far > 40, 'and it did make a real run of it first: ' + far.toFixed(0) + ' m');
});

test('a fire goes out when the wood it is in has burned', () => {
  // a stand of wood 22 m across, nothing but bare rock round it, and a world that remembers what has burnt
  const F = makeFires(14), ctx = world((e, n) => (Math.hypot(e, n) < 22 ? { kind: FUEL.leaves, fuel: 1 } : { kind: FUEL.none }), true);
  lightFire(F, BODY, at(0, 0), 1, ctx);
  let out = -1;
  run(F, ctx, 300, (f, t) => { ctx.keep(f); if (out < 0 && f.count === 0) out = t; });
  assert.ok(out > 10, 'it burned for a good while first: ' + out.toFixed(0) + ' s');
  assert.ok(out > 0, 'the fire went out of its own accord once the wood was gone, after ' + out.toFixed(0) + ' s');
  assert.equal(F.count, 0, 'nothing is left of it');
  console.log('  a stand of wood 44 m across burned out in %s s; %s patches caught in all', out.toFixed(0), F.lit);
});

// ---- what it reports -------------------------------------------------------------------------

test('it reports what it has burnt: where, how wide, what it was, and that it is finished', () => {
  const F = makeFires(21), ctx = world((e, n) => ({ kind: n > 4 ? FUEL.ground : FUEL.leaves, fuel: 1 }), true);
  lightFire(F, BODY, at(0, 0), 1, ctx);
  const kinds = new Map(), seen = new Map();
  let done = 0, rows = 0;
  run(F, ctx, 40, (f) => {
    for (let i = 0; i < f.burns.count; i++) {
      const b = f.burns[i];
      rows++;
      kinds.set(b.kind, (kinds.get(b.kind) || 0) + 1);
      assert.equal(b.bodyId, BODY, 'the row says which world');
      assert.ok(b.radius > 0.5 && b.radius < 10, 'and how wide the burnt place is: ' + b.radius);
      assert.ok(Math.abs(Math.hypot(b.px, b.py, b.pz) - R) < 1, 'the place is on the ground');
      assert.ok(b.burnt > 0 && b.burnt <= 1.0001, 'and how much of what was there has gone: ' + b.burnt);
      // the rows about one burning place only ever say more has burnt, never less
      assert.ok(b.id > 0, 'every row says which patch it is about');
      assert.ok(b.burnt >= (seen.get(b.id) || 0) - 1e-9, 'the burn at a place only grows');
      seen.set(b.id, b.burnt);
      if (b.done) { done++; assert.ok(b.burnt > 0.9, 'a finished place has burnt through: ' + b.burnt); }
    }
    ctx.keep(f);
  });
  assert.equal(F.lost, 0, 'no row was lost while the caller kept up');
  assert.ok(rows > 20, 'it reported as it went: ' + rows + ' rows');
  assert.ok(done > 5, 'and said when each place was finished: ' + done + ' of them');
  assert.ok(kinds.get(FUEL.leaves) > 0 && kinds.get(FUEL.ground) > 0,
    'it says what burned -- leaves and burnable ground, both: ' + [...kinds.entries()].join(' '));
  assert.ok(!kinds.has(FUEL.none), 'and never reports burning where there was nothing');
  assert.ok(done <= F.lit, 'no more places finished than ever caught');
});

test('rows are not lost quietly when the caller does not read them', () => {
  const F = makeFires(1), ctx = world();
  lightFire(F, BODY, at(0, 0), 1, ctx);
  run(F, ctx, 90, null);                      // nobody ever calls clearBurns
  assert.equal(F.burns.count, FIRE.burnsMax, 'the rows fill up and stop');
  assert.ok(F.lost > 0, 'and what was dropped is counted, not swallowed: ' + F.lost);
  assert.equal(F.burns.length, FIRE.burnsMax, 'the array itself never grew');
});

// ---- ice melts instead of burning ------------------------------------------------------------

test('on ice the fire melts instead of burning, and says how much heat went in', () => {
  const F = makeFires(5), ctx = world(() => ({ kind: FUEL.ice, fuel: 0 }));
  const s = lightFire(F, BODY, at(0, 0), 2, ctx);
  assert.equal(s.kind, FUEL.ice, 'it knows it is on ice');
  const r0 = s.radius;
  let heat = 0, melts = 0, done = false, other = 0;
  run(F, ctx, 14, (f) => {
    for (let i = 0; i < f.burns.count; i++) {
      const b = f.burns[i];
      if (b.kind !== FUEL.ice) { other++; continue; }
      melts++;
      assert.equal(b.burnt, 0, 'ice does not burn: nothing of it is charred');
      assert.ok(b.heat >= heat, 'the heat into one place only ever grows');
      heat = b.heat;
      if (b.done) done = true;
    }
    clearBurns(f);
  });
  assert.equal(other, 0, 'it reported nothing but melting');
  assert.ok(melts >= 2, 'it reported the melting as it went: ' + melts + ' rows');
  assert.ok(heat > 4, 'and a real amount of heat went into the ice: ' + heat.toFixed(1) + ' seconds of full flame');
  assert.ok(done, 'with a last row when the melting was over');
  assert.equal(F.lit, 1, 'a fire on ice passes nothing on: there is nothing in ice to carry it');
  assert.ok(s.radius > r0 * 1.5, 'the melted place opened out as it went: ' + r0.toFixed(1) + ' m to ' + s.radius.toFixed(1) + ' m');
});

test('a fire in a wood melts the ice it reaches, and the ice carries it no further', () => {
  // wood to the south, an ice sheet from 6 m north
  const F = makeFires(17), ctx = world((e, n) => (n > 6 ? { kind: FUEL.ice, fuel: 0 } : { kind: FUEL.leaves, fuel: 1 }));
  northWind(ctx, 10);
  lightFire(F, BODY, at(0, 0), 1, ctx);
  let melted = 0, burnt = 0, deepest = 0;
  run(F, ctx, 40, (f) => {
    for (let i = 0; i < f.burns.count; i++) {
      const b = f.burns[i];
      if (b.kind === FUEL.ice) { melted++; if (b.py > deepest) deepest = b.py; } else burnt++;
    }
    clearBurns(f);
  });
  assert.ok(burnt > 0, 'the wood burned');
  assert.ok(melted > 0, 'and the ice it reached melted: ' + melted + ' rows');
  assert.ok(deepest > 6 && deepest < 6 + FIRE.spread * 3,
    'the melting is at the edge of the ice, and goes no further in: ' + deepest.toFixed(1) + ' m');
});

// ---- the cap ---------------------------------------------------------------------------------

test('a forest fire cannot grow past its cap', () => {
  const F = makeFires(23), ctx = world();
  northWind(ctx, 15);
  // four fires lit at once in endless wood, left to run for two minutes
  for (const p of [[0, 0], [30, 0], [0, 30], [-30, -30]]) lightFire(F, BODY, at(p[0], p[1]), 4, ctx);
  let most = 0, mostLive = 0;
  run(F, ctx, 120, (f) => { if (f.count > most) most = f.count; const l = live(f); if (l > mostLive) mostLive = l; clearBurns(f); });
  console.log('  four big fires, 2 minutes: at most %s records of %s (%s of them alight), %s patches caught in all',
    most, FIRE.max, mostLive, F.lit);
  assert.ok(most <= FIRE.max, 'never more records than the cap: ' + most);
  assert.ok(F.lit > 60, 'while the fire itself went on and on: ' + F.lit + ' patches caught');
  assert.equal(F.length, FIRE.max, 'and the list itself never grew past the cap');
});

test('the list makes no new records once it is going', () => {
  const F = makeFires(29), ctx = world();
  northWind(ctx, 12);
  lightFire(F, BODY, at(0, 0), 2, ctx);
  run(F, ctx, 10, null);
  const ids = F.map((s) => s), rows = F.burns.map((b) => b);
  run(F, ctx, 60, (f) => clearBurns(f));
  assert.equal(F.length, FIRE.max, 'the same number of slots');
  for (let i = 0; i < F.length; i++) assert.ok(ids.includes(F[i]), 'every record is one of the ones made at the start');
  for (let i = 0; i < F.burns.length; i++) assert.equal(F.burns[i], rows[i], 'and the burn rows are reused, not made');
});

// ---- the readers -----------------------------------------------------------------------------

test('anything that wants to know can ask where it is burning', () => {
  const F = makeFires(31), ctx = world();
  const frame = new LocalFrame();
  frame.anchor(BODY, 0, 0, R);
  assert.equal(fireAt(F, 0, 0), 0, 'nothing burning: nothing to ask about');
  assert.equal(anyBurning(F), false);
  lightFire(F, BODY, at(0, 0), 1, ctx);
  run(F, ctx, 1.5, null);
  placeFires(F, frame, BODY);
  assert.ok(anyBurning(F), 'it is alight');
  const h = fireAt(F, 0, 0);
  assert.ok(h > 0.5, 'hot in the middle of a patch: ' + h.toFixed(2));
  assert.equal(fireAt(F, 300, 300), 0, 'and nothing at all a long way off');
  assert.equal(fireAt(F, 0, 60), 0, 'nor just outside the fire');
  // another world's fire is not in this frame
  const G = makeFires(32);
  lightFire(G, 'elsewhere', at(0, 0), 1, ctx);
  run(G, ctx, 1.5, null);
  placeFires(G, frame, BODY);
  assert.equal(fireAt(G, 0, 0), 0, "a fire on another world is not burning here");
});

test('a fire can be put out', () => {
  const F = makeFires(33), ctx = world();
  lightFire(F, BODY, at(0, 0), 1, ctx);
  run(F, ctx, 12, null);
  assert.ok(live(F) > 1);
  clearBurns(F);
  douseFires(F);
  assert.equal(live(F), 0, 'out');
  assert.ok(F.burns.count > 0, 'and what had begun to burn was reported as finished');
  for (let i = 0; i < F.burns.count; i++) assert.ok(F.burns[i].done, 'every row says it is finished');
});

// ---- what it costs ---------------------------------------------------------------------------

test('a frame of a big fire costs well under a third of a millisecond', () => {
  const F = makeFires(37), ctx = world();
  northWind(ctx, 15);
  for (const p of [[0, 0], [30, 0], [0, 30], [-30, -30]]) lightFire(F, BODY, at(p[0], p[1]), 4, ctx);
  run(F, ctx, 20, (f) => clearBurns(f));          // let it grow to its cap
  assert.ok(F.count > FIRE.max * 0.6, 'a full fire to time: ' + F.count + ' records');
  // the time of 6000 frames of it, and how often the world is asked anything in a frame
  const frames = 6000, asks0 = ctx.asks, winds0 = ctx.winds;
  const t0 = performance.now();
  for (let i = 0; i < frames; i++) { stepFires(F, 1 / 60, ctx); clearBurns(F); }
  const per = (performance.now() - t0) / frames;
  const asks = (ctx.asks - asks0) / frames, winds = (ctx.winds - winds0) / frames;
  console.log('  %s records: %s ms a frame, %s fuel asks and %s wind asks a frame',
    F.count, per.toFixed(4), asks.toFixed(2), winds.toFixed(2));
  assert.ok(per < 0.3, 'a frame of a big fire costs ' + per.toFixed(4) + ' ms');
  assert.ok(winds < FIRE.max / (FIRE.windEvery * 60) + 1, 'the wind is asked on each patch own beat, not every frame: ' + winds.toFixed(2));
});

test('the empty list costs one comparison', () => {
  const F = makeFires(41), ctx = world();
  const t0 = performance.now();
  for (let i = 0; i < 200000; i++) stepFires(F, 1 / 60, ctx);
  const per = (performance.now() - t0) / 200000;
  console.log('  nothing burning: %s ms a frame', per.toFixed(6));
  assert.equal(ctx.asks, 0, 'with no fire the world is never asked anything');
  assert.ok(per < 0.001, 'and a frame costs nothing: ' + per.toFixed(6) + ' ms');
});

// ---- IT GOES OUT ------------------------------------------------------------------------------
// (2026-11-18. The one thing a reader measured as broken here: a fire in an ordinary wood never went out. These
// tests light fires with the game's own record behind them, which is capped and forgets, and measure that each one
// ends by itself. Everything above this line uses stand-ins; these do not.)

// The world answered the way the game will answer it: a round stand of wood with bare rock round it, and the
// lasting record (data/burnt.js) asked whether the floor of a place has already burned.
// `forget`: a world that keeps no record at all -- which is also what the real record becomes once its cap is
// passed and it starts forgetting its oldest marks. A fire must go out in that world too, on its own memory alone.
function woodWorld(radius, forget = false) {
  return {
    asks: 0, winds: 0, wind: { x: 0, y: 0, z: 0 },
    fuelAt(bodyId, px, py, pz, out) {
      this.asks++;
      out.fuel = 1; out.wet = 0;
      const k = R / (Math.hypot(px, py, pz) || 1);
      out.px = px * k; out.py = py * k; out.pz = pz * k;      // the world sets the place on its own ground
      // Outside the stand there is bare rock. Inside it there is wood -- unless the record says this floor has
      // already burned, which is how the game will answer it: nothing left here to catch. A mark is black right
      // through in its core and fades to nothing at its rim (BURN.core), so a third of the way is the game's own
      // judgement of "burnt enough"; nothing about the fire ENDING rests on the number.
      if (Math.hypot(px, py) > radius) out.kind = FUEL.none;
      else if (!forget && burntAt(bodyId, out.px, out.py, out.pz) > 0.35) out.kind = FUEL.none;
      else out.kind = FUEL.leaves;
    },
    windAt(s, o) { this.winds++; o[0] = this.wind.x; o[1] = this.wind.y; o[2] = this.wind.z; },
    // what the game does once a frame: read the rows the fire has left, write them into the record, clear them
    keep(F) {
      if (!forget) for (let i = 0; i < F.burns.count; i++) {
        const b = F.burns[i];
        if (b.kind !== FUEL.ice) scorch(b.bodyId, b.px, b.py, b.pz, b.radius, b.burnt);
      }
      clearBurns(F);
    },
  };
}

// Runs one fire until it is out, or until `limit` seconds have gone by. Returns what it cost.
function burnOut(F, ctx, limit = 600) {
  let out = -1, marks = 0, bytes = 0, mostLive = 0, lost = 0;
  for (let i = 0; i < Math.round(limit * 60) && out < 0; i++) {
    stepFires(F, 1 / 60, ctx);
    lost += F.lost;
    ctx.keep(F);
    if (BURNT.scorches > marks) marks = BURNT.scorches;
    const b = fireBytes(F); if (b > bytes) bytes = b;
    const l = live(F); if (l > mostLive) mostLive = l;
    if (F.count === 0) out = (i + 1) / 60;
  }
  return { out, marks, bytes, mostLive, lost };
}

test('a fire goes out by itself in a wood of any ordinary size, with the real record behind it', () => {
  for (const across of [24, 44, 80]) {
    burntLoad([]);
    const F = makeFires(across), ctx = woodWorld(across / 2);
    assert.ok(lightFire(F, BODY, at(0, 0), 2, ctx), 'it was lit');
    const r = burnOut(F, ctx);
    console.log('  a wood %s m across: OUT after %s s. %s patches caught, %s alight at once, %s marks on the record (of %s), %s bytes of the fire\'s own memory at its worst',
      across, r.out < 0 ? 'NOT AT ALL' : r.out.toFixed(0), F.lit, r.mostLive, r.marks, BURN.max, r.bytes);
    assert.ok(r.out > 0, 'the fire in a wood ' + across + ' m across went out of its own accord');
    assert.ok(r.out > 8, 'and burned for a good while first: ' + r.out.toFixed(0) + ' s');
    assert.equal(F.count, 0, 'nothing of it is left');
    assert.equal(anyBurning(F), false);
    assert.equal(fireBytes(F), 0, 'and its memory of the ground went out with it');
    assert.ok(r.bytes > 0 && r.bytes < 12000, "the memory cost a couple of kilobytes, not more: " + r.bytes + ' bytes');
    assert.ok(r.marks > 4 && r.marks <= BURN.max, 'the record kept where it burned: ' + r.marks + ' marks');
    assert.equal(r.lost, 0, 'and no row of what burned was lost on the way');
  }
});

test('a fire goes out on its own memory alone, in a world that remembers nothing', () => {
  // THIS IS THE FAULT ITSELF. A world that offers the same wood again and again -- which the real record becomes as
  // soon as its cap is passed, since it forgets its oldest marks -- used to leave a fire burning for ever (measured
  // before this: a wood 44 m across still burning after five minutes, 2,219 patches caught). The fire's own memory
  // of the ground this casting has burned is what ends it, and nothing else is helping here.
  burntLoad([]);
  const F = makeFires(77), ctx = woodWorld(22, true);
  lightFire(F, BODY, at(0, 0), 2, ctx);
  const r = burnOut(F, ctx);
  console.log('  a wood 44 m across and a world with no memory at all: OUT after %s s, %s patches caught',
    r.out < 0 ? 'NOT AT ALL' : r.out.toFixed(0), F.lit);
  assert.equal(BURNT.size, 0, 'nothing was written down anywhere');
  assert.ok(r.out > 0, 'and the fire still went out by itself');
  assert.ok(ctx.asks > 50, 'having really asked the world about the wood: ' + ctx.asks + ' times');
  assert.equal(F.count, 0);
});

test('a fire lit later in the same place still works', () => {
  burntLoad([]);
  const F = makeFires(5), ctx = woodWorld(22);
  lightFire(F, BODY, at(0, 0), 2, ctx);
  const first = burnOut(F, ctx);
  assert.ok(first.out > 0, 'the first fire went out');
  const lit0 = F.lit;
  // the record still remembers this wood, so a second fire finds nothing left to catch: the ability's own flame
  // shows for a moment (so the player sees the cast) and dies, and nothing spreads
  const s = lightFire(F, BODY, at(0, 0), 2, ctx);
  assert.ok(s, 'it is still lit');
  assert.equal(s.kind, FUEL.none, 'but there is nothing left here to burn');
  const again = burnOut(F, ctx, 30);
  assert.ok(again.out > 0 && again.out < 6, 'and it is gone in a moment: ' + again.out.toFixed(1) + ' s');
  assert.equal(F.lit, lit0 + 1, 'nothing caught from it');
  // and when the record has forgotten this place (which is what its cap does), the same place burns again, and
  // that fire goes out as well
  burntLoad([]);
  const G = makeFires(6), c2 = woodWorld(22);
  const t = lightFire(G, BODY, at(0, 0), 2, c2);
  assert.equal(t.kind, FUEL.leaves, 'the wood is there to burn again');
  const third = burnOut(G, c2);
  console.log('  the same wood burned twice: %s s the first time, %s s the second', first.out.toFixed(0), third.out.toFixed(0));
  assert.ok(third.out > 8, 'it burned properly the second time: ' + third.out.toFixed(0) + ' s');
  assert.equal(G.count, 0, 'and went out again');
});

test('a fire cannot be lit at a place that is not a real place', () => {
  // (2026-11-18, found by the reader who checked fire.js) A bad aim -- a view sample that hands back a
  // not-a-number -- used to be written into a patch, and from there into the lasting record, where it poisons a
  // filing cell for the rest of the session.
  burntLoad([]);
  const F = makeFires(8), ctx = world();
  for (const p of [{ x: NaN, y: 0, z: R }, { x: 0, y: Infinity, z: R }, { x: 0, y: 0, z: NaN }, null, undefined]) {
    assert.equal(lightFire(F, BODY, p, 1, ctx), null, 'refused: ' + JSON.stringify(p));
  }
  assert.equal(lightFire(F, null, at(0, 0), 1, ctx), null, 'and nowhere in particular is refused too');
  assert.equal(F.count, 0, 'not one patch was made');
  assert.equal(F.lit, 0);
  assert.equal(ctx.asks, 0, 'and the world was never even asked');
  assert.ok(lightFire(F, BODY, at(0, 0), 1, ctx), 'while a real place is lit as it always was');
});
