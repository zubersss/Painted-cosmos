// The uneven clock (src/core/sim.js CLOCK, stepClock; src/core/orbits.js turnBy): PAINTER's critique
// of PILOT, M4 item 5. Earth's day was 1500 s of which 660 were night, one dark blue, and the
// gold and the rose each went by in half a minute.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Sim, FEEL, CLOCK, clockRate } from '../src/core/sim.js';
import { S } from '../src/core/state.js';
import { BODIES, spaceAltitude } from '../src/data/bodies.js';
import { stubSurface, stubSpawn } from '../src/core/stubs/surface.js';
import { V, norm, dot, len, sub, qRotate, qConj } from '../src/core/vec.js';

const newSim = (o = {}) => new Sim({ sampleSurface: stubSurface, getSpawn: (id) => stubSpawn(id).unitDir, ...o });
const DEG = 180 / Math.PI;
const elevOf = (sim) => Math.asin(Math.max(-1, Math.min(1, sim.eph.sunElevationSin(sim.bodyId, sim.t, norm(sim.ex.p))))) * DEG;

// Stand still for `seconds` and let the world turn; returns the seconds spent with the sun in each band.
function watch(sim, seconds, uneven = true, dt = 0.25) {
  const out = { day: 0, gold: 0, blue: 0, night: 0, drop: 0, worstTurn: 0, firstSunset: null, firstSunrise: null };
  let last = elevOf(sim), lastDir = sim.eph.sunDirLocal(sim.bodyId, sim.t);
  for (let t = 0; t < seconds; t += dt) {
    sim.t += dt;
    if (uneven) sim.stepClock(dt);
    const e = elevOf(sim), d = sim.eph.sunDirLocal(sim.bodyId, sim.t);
    out.worstTurn = Math.max(out.worstTurn, Math.acos(Math.min(1, dot(d, lastDir))) * DEG / dt);
    if (e >= CLOCK.easeFrom) out.day += dt; else if (e >= 0) out.gold += dt; else if (e >= -8) out.blue += dt; else out.night += dt;
    if (e < -3.5 && e >= -9.5) out.drop += dt;                    // where the picture went from ochre to the night's blue
    if (out.firstSunset == null && last >= 0 && e < 0) out.firstSunset = t;
    if (out.firstSunset != null && out.firstSunrise == null && last < 0 && e >= 0) out.firstSunrise = t;
    last = e; lastDir = d;
  }
  return out;
}

test('M4 the clock: a new game begins at eight; the first sitting ends in the gold, and night is a short part of it', () => {
  const sim = newSim();
  assert.ok(Math.abs(sim.eph.sunHour('earth', sim.t, norm(sim.ex.p)) - FEEL.startHour) < 0.05, 'the world\'s hour at the spawn is ' + FEEL.startHour);
  assert.equal(FEEL.startHour, 8);
  const even = watch(newSim({ hour: 9.5 }), 3200, false), day = BODIES.earth.dayLength;
  const a = watch(sim, 3200);
  assert.ok(a.firstSunset > even.firstSunset + 120, `the first sunset comes ${(a.firstSunset / 60).toFixed(1)} minutes in (it was ${(even.firstSunset / 60).toFixed(1)})`);
  assert.ok(a.firstSunrise - a.firstSunset < 0.75 * (even.firstSunrise - even.firstSunset), `and the sun is under the horizon for ${((a.firstSunrise - a.firstSunset) / 60).toFixed(1)} minutes (it was ${((even.firstSunrise - even.firstSunset) / 60).toFixed(1)})`);
  assert.ok(a.worstTurn < 1.2, `the sun never jumps: ${a.worstTurn.toFixed(2)} degrees a second at most (its own turning is ${(360 / day).toFixed(2)})`);
});

// One whole day, from the first sunset to the next: the seconds in each band.
function oneDay(uneven) {
  const sim = newSim(), dt = 0.25;
  const out = { total: 0, day: 0, gold: 0, blue: 0, night: 0, drop: 0 };
  let last = elevOf(sim), on = false;
  for (let t = 0; t < 4000; t += dt) {
    sim.t += dt;
    if (uneven) sim.stepClock(dt);
    const e = elevOf(sim);
    if (last >= 0 && e < 0) { if (on) return out; on = true; }
    if (on) {
      out.total += dt;
      if (e >= CLOCK.easeFrom) out.day += dt; else if (e >= 0) out.gold += dt; else if (e >= -8) out.blue += dt; else out.night += dt;
      if (e < -3.5 && e >= -9.5) out.drop += dt;
    }
    last = e;
  }
  throw new Error('no second sunset');
}

test('M4 the clock: one day at Earth\'s spawn: the day as long as it was, dusk and dawn long, the night short', () => {
  const even = oneDay(false), one = oneDay(true);
  assert.ok(one.total > 20 * 60 && one.total < 30 * 60, `a day and a night take ${(one.total / 60).toFixed(1)} minutes (${(even.total / 60).toFixed(1)} by the body's own turning)`);
  // (the seasons turn in four hours here, so the two days are not the same day: about as long)
  assert.ok(Math.abs(one.day - even.day) < 0.2 * even.day, `the sun is well up for ${(one.day / 60).toFixed(1)} minutes, about as it was (${(even.day / 60).toFixed(1)})`);
  assert.ok(even.night / even.total > 0.4, `it was night for ${(100 * even.night / even.total).toFixed(0)} % of the day`);
  assert.ok(one.night / one.total < 0.25, `night is ${(100 * one.night / one.total).toFixed(0)} % of it (it was ${(100 * even.night / even.total).toFixed(0)} %)`);
  assert.ok(one.night > 150, 'and still a night: ' + one.night.toFixed(0) + ' s');
  assert.ok(one.gold > 2 * even.gold && one.blue > 2 * even.blue, `the gold hours ${(one.gold / 120).toFixed(1)} minutes each, the blue ${(one.blue / 120).toFixed(1)} (they were ${(even.gold / 120).toFixed(1)} and ${(even.blue / 120).toFixed(1)})`);
  assert.ok(one.drop > 2 * even.drop, `from the last ochre to the night's key takes ${(one.drop / 2).toFixed(0)} s (it took ${(even.drop / 2).toFixed(0)})`);
  console.log(`      the clock at the stub's Earth spawn, minutes: even day ${(even.day / 60).toFixed(1)} gold ${(even.gold / 60).toFixed(1)} blue ${(even.blue / 60).toFixed(1)} night ${(even.night / 60).toFixed(1)} of ${(even.total / 60).toFixed(1)}; uneven day ${(one.day / 60).toFixed(1)} gold ${(one.gold / 60).toFixed(1)} blue ${(one.blue / 60).toFixed(1)} night ${(one.night / 60).toFixed(1)} of ${(one.total / 60).toFixed(1)}`);
});

test('M4 the clock: its rate by the sun\'s height; back to the body\'s own before the ship leaves the ground frame', () => {
  assert.equal(clockRate(40), 1);
  assert.equal(clockRate(CLOCK.easeFrom), 1);
  assert.equal(clockRate(0), CLOCK.slow);
  assert.equal(clockRate(-30), CLOCK.fast);
  for (let e = -20, last = clockRate(-21); e <= 20; e += 0.5) { const r = clockRate(e); assert.ok(Math.abs(r - last) < 0.25, 'no step in the rate at ' + e); last = r; }
  // night on the ground: the world turns fast, and the frame says so (the ship's velocity is converted with it)
  const sim = newSim({ hour: 0 });
  sim.stepClock(1 / 60);
  assert.equal(sim.clockRate, CLOCK.fast);
  const w = len(sim.eph.angularVelocity('earth'));
  assert.ok(Math.abs(w - CLOCK.fast * 2 * Math.PI / BODIES.earth.dayLength) < 1e-12, 'the frame\'s turning is the clock\'s');
  // a ship high in the air, at night: the world's own turning
  sim.teleport({ body: 'earth', ship: true, altitude: 0.7 * spaceAltitude(BODIES.earth) });
  sim.eph.setSunHour('earth', sim.t, norm(sim.sh.p), 0);
  assert.equal(sim.sm.state, S.ATMOSPHERE);
  sim.stepClock(1 / 60);
  assert.equal(sim.clockRate, 1);
  assert.equal(len(sim.eph.angularVelocity('earth')), 2 * Math.PI / BODIES.earth.dayLength);
  // low in the air at night it is still the night's rate, eased toward 1 with height
  sim.teleport({ body: 'earth', ship: true, altitude: 0.4 * spaceAltitude(BODIES.earth) });
  sim.eph.setSunHour('earth', sim.t, norm(sim.sh.p), 0);
  sim.stepClock(1 / 60);
  assert.ok(sim.clockRate > 1.2 && sim.clockRate < CLOCK.fast - 0.2, 'between: ' + sim.clockRate.toFixed(2));
  // an instrument may ask for the even clock (?clock=even)
  const even = newSim({ hour: 0 });
  even.unevenClock = false;
  even.stepClock(1 / 60);
  assert.equal(even.clockRate, 1);
  // in space nothing is turned
  sim.teleport({ body: 'earth', ship: true, altitude: 5000 });
  sim.stepClock(1 / 60);
  assert.equal(sim.clockRate, 1);
  assert.equal(sim.eph.spinRate.earth, 1);
});

test('M4 the clock: through the Moon\'s hurried night Earth keeps its place in the Moon\'s sky', () => {
  const sim = newSim({ body: 'moon', hour: 19 });
  const earthDir = () => {
    const toEarth = sub(sim.eph.position('earth', sim.t), sim.eph.position('moon', sim.t));
    return norm(qRotate(qConj(sim.eph.orientation('moon', sim.t)), toEarth));
  };
  const e0 = earthDir(), lock0 = sim.eph.spinPhase.moon - sim.eph.orbitShift.moon;
  let fast = 0;
  for (let t = 0; t < 500; t += 0.25) { sim.t += 0.25; sim.stepClock(0.25); if (sim.clockRate > 2.9) fast += 0.25; }
  assert.ok(fast > 300, 'the night was hurried for ' + fast + ' s');
  // the orbit has turned with the spin, to the digit (what is left is the libration of its tilted axis, 1.7 degrees)
  const lock = sim.eph.spinPhase.moon - sim.eph.orbitShift.moon, d = Math.abs(lock - lock0) % (2 * Math.PI);
  assert.ok(Math.min(d, 2 * Math.PI - d) < 1e-9, 'the Moon\'s orbit turned with its spin');
  const off = Math.acos(Math.min(1, dot(e0, earthDir()))) * DEG;
  assert.ok(off < 2 * BODIES.moon.axialTilt * DEG + 0.2, `Earth moved ${off.toFixed(2)} degrees in the Moon's sky (without the lock: ${(fast * 2 * 360 / BODIES.moon.dayLength).toFixed(0)})`);
  assert.equal(sim.eph.orbitShift.mars, 0, 'the planets keep their orbits');
});
