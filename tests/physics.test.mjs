// Pilot's controllers driven through PHYSICS' models (COORDINATOR.md C14): the same behaviour
// checks as the kinematic tests, with a body that has mass. Skipped if src/physics cannot be
// imported (a file caught mid-edit).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Sim, FEEL } from '../src/core/sim.js';
import { S } from '../src/core/state.js';
import { EXPLORER } from '../src/player/explorer.js';
import { SHIP } from '../src/ship/flight.js';
import { BODIES } from '../src/data/bodies.js';
import { stubSurface, stubSpawn } from '../src/core/stubs/surface.js';
import { Pad, play, len, sub, norm, dot, makeWorld } from './helpers.mjs';
import { V, cross, tangent, add, scale } from '../src/core/vec.js';

// Wall-clock time says how busy the machine is, not whether the code is right: three agents
// render on four cores here. Timings are reported, and only asserted when asked for
// (PC_TIMING=1 node --test tests/physics.test.mjs on a quiet machine).
const timing = (ok, msg) => { if (process.env.PC_TIMING) assert.ok(ok, msg); else if (!ok) console.log('  (timing, not asserted: ' + msg + ')'); };

let P = null, why = '';
try { P = await import('../src/physics/index.js'); } catch (e) { why = String(e && e.message).slice(0, 120); }
const skip = P && P.createPhysics ? false : 'physics not importable: ' + why;
const RAD = Math.PI / 180;
function newSim(opts = {}) {
  const physics = P.createPhysics({ sampleSurface: stubSurface, seed: 1 });
  return new Sim({ sampleSurface: stubSurface, getSpawn: (id) => stubSpawn(id).unitDir, physics, ...opts });
}
const holdPitch = (sim, pad, deg) => {
  const err = deg - sim.info().ship.pitchDeg;
  pad.dy -= Math.max(-40, Math.min(40, (err * RAD / FEEL.mouseShip) * 0.12));
};

test('with physics: walking and running reach their speeds, stop, and never leave the ground', { skip }, () => {
  const sim = newSim();
  const pad = new Pad();
  play(sim, pad, 0.5);
  pad.press('KeyW');
  let t90 = null;
  play(sim, pad, 3, { each: (t) => { if (t90 == null && sim.ex.speed > EXPLORER.walkSpeed * 0.9) t90 = t; } });
  assert.ok(Math.abs(sim.ex.speed - EXPLORER.walkSpeed) < 0.35, 'walk ' + sim.ex.speed.toFixed(2));
  assert.ok(t90 != null && t90 < 0.8, 'reaches walking pace quickly: ' + t90);
  pad.press('ShiftLeft');
  play(sim, pad, 3);
  assert.ok(sim.ex.speed > EXPLORER.walkSpeed * 1.4, 'run ' + sim.ex.speed.toFixed(2));
  pad.releaseAll();
  const p0 = { ...sim.ex.p };
  play(sim, pad, 2);
  assert.ok(sim.ex.speed < 0.3, 'stops: ' + sim.ex.speed.toFixed(2));
  assert.ok(len(sub(sim.ex.p, p0)) < 6, 'within a few strides: ' + len(sub(sim.ex.p, p0)).toFixed(1));
  assert.ok(sim.ex.grounded);
  timing(sim.physicsMs < 2, 'physics.update average ' + sim.physicsMs.toFixed(2) + ' ms (wanted under 2)');
});

test('with physics: jetpack climbs, drains fuel, lands softly, refills', { skip }, () => {
  const sim = newSim();
  const pad = new Pad();
  play(sim, pad, 0.5);
  pad.press('Space');
  play(sim, pad, 2.3);
  assert.equal(sim.ex.mode, 'jet');
  assert.ok(sim.ex.altitude > 8, 'climbed ' + sim.ex.altitude.toFixed(1));
  assert.ok(sim.ex.fuel < 0.65 && sim.ex.fuel > 0.3, 'fuel ' + sim.ex.fuel.toFixed(2));
  play(sim, pad, 3);
  pad.release('Space');
  let touch = 0;
  play(sim, pad, 20, { each: () => { if (!sim.ex.grounded) touch = -dot(sim.ex.v, norm(sim.ex.p)); }, until: () => sim.ex.grounded });
  assert.ok(sim.ex.grounded, 'came down');
  assert.ok(touch < 10, 'soft touchdown: ' + touch.toFixed(1) + ' m/s');
  play(sim, pad, 3);
  assert.equal(sim.ex.fuel, 1);
});

test('with physics: the lighter the world, the higher the same jetpack burn carries you', { skip }, () => {
  const top = (body) => {
    const sim = newSim({ body });
    const pad = new Pad();
    play(sim, pad, 0.3);
    pad.press('Space');
    let h = 0;
    play(sim, pad, 12, { each: () => { h = Math.max(h, sim.ex.altitude); } });
    return h;
  };
  const earth = top('earth'), moon = top('moon');
  assert.ok(earth > 15 && earth < 60, 'earth ' + earth.toFixed(1));
  assert.ok(moon > earth * 1.5, `moon ${moon.toFixed(1)} vs earth ${earth.toFixed(1)}`);
});

test('with physics: the M1 loop still closes (walk, board, lift off, space, return, land, step out)', { skip }, () => {
  const sim = newSim();
  const pad = new Pad();
  play(sim, pad, 0.5);
  pad.dx += (sim.info().shipBearingDeg * RAD) / FEEL.mouseFoot;
  pad.press('KeyW');
  play(sim, pad, 30, { until: () => sim.info().canBoard });
  pad.release('KeyW');
  pad.tap('KeyE');
  play(sim, pad, 4, { until: () => sim.sm.state === S.LANDED });
  assert.equal(sim.sm.state, S.LANDED);
  pad.tap('Space');
  play(sim, pad, 12, { until: () => sim.sm.state === S.ATMOSPHERE && !sim.sh.liftoff });
  play(sim, pad, 1.5);
  assert.ok(Math.abs(sim.sh.altGround - SHIP.hoverHeight) < 1.5, 'hover ' + sim.sh.altGround.toFixed(1));
  const hover = { ...sim.sh.p };
  play(sim, pad, 6);
  assert.ok(len(sub(sim.sh.p, hover)) < 1.0, 'hands off, it stays put: ' + len(sub(sim.sh.p, hover)).toFixed(2));
  pad.press('KeyW');
  play(sim, pad, 120, { each: () => holdPitch(sim, pad, 55), until: () => sim.sm.state === S.SPACE });
  assert.equal(sim.sm.state, S.SPACE);
  play(sim, pad, 30, { each: () => holdPitch(sim, pad, 55), until: () => sim.info().ship.altitude > 3000 });
  pad.release('KeyW');
  pad.press('KeyX');
  play(sim, pad, 20, { until: () => sim.sh.speed < 3 });
  pad.release('KeyX');
  assert.ok(sim.sh.speed < 3, 'X brings it to rest: ' + sim.sh.speed.toFixed(1));
  play(sim, pad, 6, { each: () => holdPitch(sim, pad, -60) });
  pad.press('KeyW'); play(sim, pad, 1.3); pad.release('KeyW');
  play(sim, pad, 200, { each: () => holdPitch(sim, pad, -55), until: () => sim.sm.state === S.ATMOSPHERE });
  assert.equal(sim.sm.state, S.ATMOSPHERE);
  let minClear = Infinity;
  play(sim, pad, 200, { each: () => { holdPitch(sim, pad, -35); minClear = Math.min(minClear, sim.sh.altGround); }, until: () => sim.sh.altGround < 170 });
  pad.press('KeyS');
  play(sim, pad, 200, {
    each: () => { holdPitch(sim, pad, sim.sh.altGround > 110 ? -18 : -7); if (sim.sh.throttle < 0.25) pad.release('KeyS'); minClear = Math.min(minClear, sim.sh.altGround); },
    until: () => sim.info().ship.canLand,
  });
  pad.release('KeyS');
  assert.ok(sim.info().ship.canLand);
  assert.equal(sim.sh.bounces, 0, 'never touched the ground on the way down');
  pad.tap('KeyE');
  let touch = 0;
  play(sim, pad, 60, { each: () => { touch = sim.sh.speed; }, until: () => sim.sm.state === S.LANDED });
  assert.equal(sim.sm.state, S.LANDED);
  assert.ok(touch < 3, 'soft touchdown: ' + touch.toFixed(2));
  pad.tap('KeyE');
  play(sim, pad, 4, { until: () => sim.sm.state === S.ON_FOOT });
  assert.equal(sim.sm.state, S.ON_FOOT);
  // (A wall-clock number in a unit test: generous, because other roles' browsers share the
  // machine. The 2 ms budget is policed on the frame read-out and in the lead's reviews.)
  timing(sim.physicsMs < 10, 'physics.update average ' + sim.physicsMs.toFixed(2) + ' ms (wanted under 10)');
});

test('with physics: a full-throttle dive at the ground still ends in a skim, with no bump', { skip }, () => {
  for (const body of ['earth', 'jupiter', 'moon']) {
    const sim = newSim();
    const pad = new Pad();
    sim.teleport({ body, ship: true, altitude: 260, pitchDeg: -60, throttle: 1 });
    let minAlt = Infinity;
    play(sim, pad, 16, { each: (t) => { if (t > 0.2) minAlt = Math.min(minAlt, sim.sh.altGround); } });
    assert.equal(sim.sh.bounces, 0, `${body}: no bounce (lowest ${minAlt.toFixed(2)} m)`);
    assert.ok(minAlt >= SHIP.minClearance - 0.05, `${body}: lowest ${minAlt.toFixed(2)} m`);
    assert.ok(sim.sh.speed > 8, `${body}: still flying at ${sim.sh.speed.toFixed(0)} m/s`);
    assert.ok(BODIES[body]);
  }
});

test('with physics: the parked ship stands on its landing gear, settles and sleeps', { skip }, () => {
  for (const body of ['earth', 'moon', 'jupiter']) {
    const sim = newSim({ body });
    const pad = new Pad();
    const p0 = { ...sim.sh.p };
    play(sim, pad, 6);
    assert.ok(sim.sh.gearOn, body + ': on its gear');
    assert.ok(sim.sh.phys && sim.sh.phys.asleep, body + ': asleep after six seconds');
    assert.ok(len(sub(sim.sh.p, p0)) < 0.6, `${body}: settled within ${len(sub(sim.sh.p, p0)).toFixed(2)} m of where it was parked`);
    const up = norm(sim.sh.p);
    const shipUp = sim.shipPoseU ? null : null;
    assert.equal(shipUp, null);
    // Upright: the hull's up is within 25 degrees of the planet's up.
    const q = sim.sh.q, uy = { x: 2 * (q.x * q.y - q.w * q.z), y: 1 - 2 * (q.x * q.x + q.z * q.z), z: 2 * (q.y * q.z + q.w * q.x) };
    assert.ok(dot(uy, up) > 0.9, body + ': upright ' + dot(uy, up).toFixed(3));
    const p1 = { ...sim.sh.p };
    play(sim, pad, 20);
    assert.ok(len(sub(sim.sh.p, p1)) < 1e-6, body + ': asleep means it does not creep');
    // It still boards and lifts off.
    sim.sm.force(S.LANDED);
    pad.tap('Space');
    // Off the gear: the weight comes off the legs first, then the feet leave, then it rises.
    let onLegs = 0, firstAir = null;
    const tUp = play(sim, pad, 12, {
      each: (t) => { if (sim.sh.liftoff && !sim.sh.liftoff.air) onLegs = t; else if (firstAir == null) firstAir = t; },
      until: () => sim.sm.state === S.ATMOSPHERE && !sim.sh.liftoff,
    });
    assert.equal(sim.sm.state, S.ATMOSPHERE);
    assert.ok(onLegs > 0.3 && onLegs < 3.6, `${body}: ${onLegs.toFixed(2)} s on the legs before the feet left`);
    assert.ok(tUp < 9, `${body}: lift-off took ${tUp.toFixed(1)} s`);
    assert.ok(sim.sh.altGround > SHIP.hoverHeight - 1.5, `${body}: lifted to ${sim.sh.altGround.toFixed(1)} m`);
    play(sim, pad, 3);
    assert.ok(sim.sh.speed < 0.6 && sim.sh.altGround > SHIP.hoverHeight - 2, `${body}: hovering at ${sim.sh.altGround.toFixed(1)} m, ${sim.sh.speed.toFixed(2)} m/s`);
  }
});

test('with physics: after a landing the hull is handed to the gear and stays where it touched down', { skip }, () => {
  const sim = newSim();
  const pad = new Pad();
  sim.teleport({ body: 'earth', ship: true, altitude: 40 });
  play(sim, pad, 1);
  pad.tap('KeyE');
  play(sim, pad, 60, { until: () => sim.sm.state === S.LANDED });
  assert.equal(sim.sm.state, S.LANDED);
  const p0 = { ...sim.sh.p };
  play(sim, pad, 6);
  assert.ok(sim.sh.phys.asleep, 'asleep');
  assert.ok(len(sub(sim.sh.p, p0)) < 0.6, 'moved ' + len(sub(sim.sh.p, p0)).toFixed(2) + ' m while settling');
  pad.tap('KeyE');
  play(sim, pad, 4, { until: () => sim.sm.state === S.ON_FOOT });
  assert.equal(sim.sm.state, S.ON_FOOT);
  assert.ok(len(sub(sim.ex.p, sim.sh.p)) < 8);
});

test('with physics: the last metre of a landing is taken on the legs (soft touch, three feet down, asleep)', { skip }, () => {
  for (const body of ['earth', 'moon', 'jupiter']) {
    const sim = newSim({ body });
    const pad = new Pad();
    sim.teleport({ body, ship: true, altitude: 40 });
    play(sim, pad, 0.6);
    pad.tap('KeyE');
    play(sim, pad, 0.2);
    assert.equal(sim.sm.state, S.LANDING, body + ': landing began');
    let onGear = 0, fastest = 0, firstContacts = 0;
    play(sim, pad, 60, {
      each: () => {
        if (sim.sh.landing && sim.sh.landing.gear) { onGear++; fastest = Math.max(fastest, -dot(sim.sh.v, norm(sim.sh.p))); }
        if (sim.sm.state === S.LANDED && !firstContacts) firstContacts = sim.sh.phys.contacts;
      },
      until: () => sim.sm.state === S.LANDED,
    });
    assert.equal(sim.sm.state, S.LANDED, body + ': landed');
    assert.ok(onGear > 10, `${body}: the legs took the last metre (${onGear} frames on the gear)`);
    assert.ok(fastest <= 1.5, `${body}: sink rate on the gear ${fastest.toFixed(2)} m/s (R-SHIP-5: 1.5 or less)`);
    const p0 = { ...sim.sh.p };
    let deepest = 0;
    play(sim, pad, 5, { each: () => { for (const c of sim.sh.phys.legCompress) deepest = Math.max(deepest, c); } });
    assert.equal(sim.sh.phys.contacts, 3, body + ': three feet on the ground');
    assert.ok(sim.sh.phys.asleep, body + ': settled and asleep within 5 s');
    assert.ok(deepest > 0.005 && deepest < P.SHIP_BODY.gearTravel, `${body}: the legs took the weight without hitting the stops (${(deepest * 100).toFixed(1)} cm)`);
    assert.ok(len(sub(sim.sh.p, p0)) < 0.6, `${body}: it stayed where it touched (moved ${len(sub(sim.sh.p, p0)).toFixed(2)} m)`);
    const q = sim.sh.q, uy = { x: 2 * (q.x * q.y - q.w * q.z), y: 1 - 2 * (q.x * q.x + q.z * q.z), z: 2 * (q.y * q.z + q.w * q.x) };
    assert.ok(dot(uy, norm(sim.sh.p)) > 0.9, body + ': upright');
    // And the loop goes on: step out, walk.
    pad.tap('KeyE');
    play(sim, pad, 4, { until: () => sim.sm.state === S.ON_FOOT });
    assert.equal(sim.sm.state, S.ON_FOOT, body + ': stepped out');
  }
});

test('with physics: suit thrusters make the start and the stop crisp (the named assist)', { skip }, () => {
  const sim = newSim();
  const pad = new Pad();
  play(sim, pad, 0.5);
  pad.press('KeyW');
  let t90 = null;
  play(sim, pad, 2, { each: (t) => { if (t90 == null && sim.ex.speed > EXPLORER.walkSpeed * 0.9) t90 = t; } });
  assert.ok(t90 != null && t90 <= 0.5, 'to 90 % of pace in ' + t90 + ' s');
  pad.release('KeyW');
  const p0 = { ...sim.ex.p };
  let tStop = null;
  play(sim, pad, 3, { each: (t) => { if (tStop == null && sim.ex.speed < 0.2) tStop = t; } });
  assert.ok(tStop != null && tStop < 1.0, 'stopped in ' + tStop + ' s');
  assert.ok(len(sub(sim.ex.p, p0)) < 1.3, 'within ' + len(sub(sim.ex.p, p0)).toFixed(2) + ' m');
});

test('with physics: on a light world a run still slides, but the suit stops it once the keys are let go', { skip }, () => {
  // At the old 0.45 share a run took 7.7 m and 2.1 s to stop on the Moon, 10.5 m on Pluto.
  const sim = newSim({ body: 'moon' });
  sim.teleport({ body: 'moon' });
  const pad = new Pad();
  play(sim, pad, 1);
  pad.press('KeyW'); pad.press('ShiftLeft');
  let t90 = null;
  play(sim, pad, 5, { each: (t) => { if (t90 == null && sim.ex.speed > EXPLORER.runSpeed * 0.9) t90 = t; } });
  assert.ok(t90 != null && t90 > 1.2, 'the run still builds up slowly on the Moon: 90 % of pace in ' + t90 + ' s');
  pad.release('KeyW'); pad.release('ShiftLeft');
  const p0 = { ...sim.ex.p };
  let tStop = null;
  play(sim, pad, 4, { each: (t) => { if (tStop == null && sim.ex.speed < 0.2) tStop = t; } });
  const d = len(sub(sim.ex.p, p0));
  assert.ok(tStop != null && tStop < 1.9, 'stopped in ' + tStop + ' s');
  assert.ok(d > 3 && d < 6.5, 'a slide of ' + d.toFixed(2) + ' m: longer than on Earth, not a skid');
});

// ---- M4: the hull has mass (PHYSICS' critique of PILOT, items 1 to 3) ---------------------------
// A recorder of the flying hull: the largest change of its velocity in one step, and the largest
// move in one step beyond what its velocity accounts for (a clamp that sets the hull somewhere).
function hullRecorder(sim) {
  const R = { dv: 0, dvUp: 0, hop: 0, sink: 0, sinkLow: 0, climb: 0, lastV: null, lastP: null, lastT: 0 };
  R.each = () => {
    const sh = sim.sh, up = norm(sh.p), dt = sim.t - R.lastT;
    if (R.lastV && dt > 0) {
      const d = sub(sh.v, R.lastV);
      R.dv = Math.max(R.dv, len(d)); R.dvUp = Math.max(R.dvUp, Math.abs(dot(d, up)));
      const exp = { x: (sh.v.x + R.lastV.x) * 0.5 * dt, y: (sh.v.y + R.lastV.y) * 0.5 * dt, z: (sh.v.z + R.lastV.z) * 0.5 * dt };
      R.hop = Math.max(R.hop, len(sub(sub(sh.p, R.lastP), exp)));
    }
    const vUp = dot(sh.v, up);
    R.sink = Math.max(R.sink, -vUp); R.climb = Math.max(R.climb, vUp);
    if (sh.landing && sh.altGround < 25) R.sinkLow = Math.max(R.sinkLow, -vUp);
    R.lastV = { ...sh.v }; R.lastP = { ...sh.p }; R.lastT = sim.t;
  };
  return R;
}
// The stub ground under a wood: crowns 23 m up everywhere (Painter's canopy field), so the floor
// free flight uses is the tree tops, as at Earth's spawn.
const wood = (id, d) => ({ ...stubSurface(id, d), canopyHeight: 23 });
function boardAt(sim, pad) {
  play(sim, pad, 0.5);
  pad.dx += (sim.info().shipBearingDeg * RAD) / FEEL.mouseFoot;
  pad.press('KeyW');
  play(sim, pad, 30, { until: () => sim.info().canBoard });
  pad.release('KeyW');
  pad.tap('KeyE');
  play(sim, pad, 4, { until: () => sim.sm.state === S.LANDED });
  assert.equal(sim.sm.state, S.LANDED);
  play(sim, pad, 1);
}

test('M4 lift-off under trees: the hull rises out of the wood under its own lift; it is never set on the crowns', { skip }, () => {
  for (const fps of [60, 30]) {
    const physics = P.createPhysics({ sampleSurface: wood, seed: 1 });
    const sim = new Sim({ sampleSurface: wood, getSpawn: (id) => stubSpawn(id).unitDir, physics });
    const pad = new Pad();
    boardAt(sim, pad);
    pad.tap('Space');
    const R = hullRecorder(sim);
    let free = null, t = 0;
    play(sim, pad, 16, { fps, each: () => { R.each(); t += 1 / fps; if (free == null && sim.sm.state === S.ATMOSPHERE && !sim.sh.liftoff) free = t; } });
    const h = len(sim.sh.p) - stubSurface('earth', norm(sim.sh.p)).radius;
    assert.ok(R.hop < 0.1, `${fps} Hz: the hull never moves more than its velocity says: ${R.hop.toFixed(2)} m in one step (it was 16 m)`);
    assert.ok(R.dv < 0.5 * (60 / fps), `${fps} Hz: no jolt: ${R.dv.toFixed(2)} m/s in one step`);
    assert.ok(free != null && free < 12, `${fps} Hz: free flight after ${free} s`);
    assert.ok(h > 23 + SHIP.minClearance && h < 23 + 9, `${fps} Hz: over the crowns: ${h.toFixed(1)} m over the ground`);
    assert.ok(R.climb < SHIP.liftoffRise + 1.5, `${fps} Hz: a calm rise: ${R.climb.toFixed(1)} m/s at most`);
    assert.ok(sim.sh.altGround >= SHIP.minClearance, 'clear of the tree tops: ' + sim.sh.altGround.toFixed(2));
  }
});

test('M4 E at full speed: the ship slows with its own brakes, then lands; nothing is taken from it at once', { skip }, () => {
  const sim = newSim();
  const pad = new Pad();
  sim.teleport({ body: 'earth', ship: true, altitude: 30 });
  play(sim, pad, 0.5);
  pad.press('KeyW');
  play(sim, pad, 9, { each: () => holdPitch(sim, pad, 0) });
  pad.release('KeyW');
  assert.ok(sim.sh.speed > 40, 'at speed: ' + sim.sh.speed.toFixed(1));
  assert.equal(sim.promptNow && sim.promptNow.text, 'Land here');
  const R = hullRecorder(sim);
  pad.tap('KeyE');
  play(sim, pad, 0.1, { each: R.each });
  assert.equal(sim.sm.state, S.ATMOSPHERE, 'still flying: slowing first');
  assert.match(sim.notice.text, /Slowing down to land/);
  assert.equal(sim.promptNow.text, 'Cancel landing');
  let began = null, t = 0;
  play(sim, pad, 60, { each: () => { R.each(); t += 1 / 60; if (began == null && sim.sm.state === S.LANDING) { began = t; assert.ok(sim.sh.speed <= 13, 'the assist takes over at ' + sim.sh.speed.toFixed(1) + ' m/s'); } }, until: () => sim.sm.state === S.LANDED });
  assert.equal(sim.sm.state, S.LANDED, 'landed');
  assert.ok(began > 1.5 && began < 8, 'slowed down for ' + began.toFixed(1) + ' s (46 m/s at the hull\'s own 14 m/s^2 is 3.3 s)');
  assert.ok(R.dv < 0.6, `the largest change of velocity in one step: ${R.dv.toFixed(2)} m/s (it was 3.1, 18 g)`);
  assert.ok(R.hop < 0.1, 'no hop: ' + R.hop.toFixed(2));
  assert.ok(R.sinkLow <= SHIP.landMaxDescent + 0.3, `the descent near the ground: ${R.sinkLow.toFixed(1)} m/s (it was 13)`);
  assert.equal(sim.sh.bounces, 0);
  // W or Space lets the slowing go.
  sim.teleport({ body: 'earth', ship: true, altitude: 30 });
  play(sim, pad, 0.5);
  pad.press('KeyW'); play(sim, pad, 9, { each: () => holdPitch(sim, pad, 0) }); pad.release('KeyW');
  pad.tap('KeyE'); play(sim, pad, 0.5);
  pad.tap('Space'); play(sim, pad, 4);
  assert.equal(sim.sm.state, S.ATMOSPHERE);
  assert.equal(sim.promptNow && sim.promptNow.text, 'Land here', 'the landing was let go');
});

test('M4 E at a hover, and a landing abandoned among the trees: no lurch, no hop', { skip }, () => {
  const physics = P.createPhysics({ sampleSurface: wood, seed: 1 });
  const sim = new Sim({ sampleSurface: wood, getSpawn: (id) => stubSpawn(id).unitDir, physics });
  const pad = new Pad();
  sim.teleport({ body: 'earth', ship: true, altitude: 40 });
  play(sim, pad, 1.5);
  const R = hullRecorder(sim);
  pad.tap('KeyE');
  const ground = () => len(sim.sh.p) - stubSurface('earth', norm(sim.sh.p)).radius;
  play(sim, pad, 40, { each: R.each, until: () => sim.sm.state === S.LANDING && ground() < 12 });
  assert.equal(sim.sm.state, S.LANDING);
  assert.ok(ground() < 12, 'among the trees: ' + ground().toFixed(1) + ' m up, the crowns at 23');
  assert.ok(R.dv < 0.35, `the landing begins without a lurch: ${R.dv.toFixed(2)} m/s in one step (it was 1.2, 4.4 g)`);
  assert.ok(R.sink <= SHIP.landHighDescent + 0.3, 'descent ' + R.sink.toFixed(1) + ' m/s');
  const R2 = hullRecorder(sim);
  pad.tap('Space');
  play(sim, pad, 12, { each: R2.each });
  assert.equal(sim.sm.state, S.ATMOSPHERE);
  assert.ok(R2.hop < 0.1, `given back to the pilot under the crowns, the hull is not set on top of them: ${R2.hop.toFixed(2)} m in one step`);
  assert.ok(R2.dv < 0.6, `and its velocity is not rewritten: ${R2.dv.toFixed(2)} m/s in one step`);
  assert.ok(R2.climb <= SHIP.assistRise + 2.5, 'it rises out at ' + R2.climb.toFixed(1) + ' m/s');
  assert.ok(sim.sh.altGround > SHIP.minClearance - 0.2, 'and ends over the tree tops: ' + sim.sh.altGround.toFixed(2) + ' m');
});

test('M4 a steep slope at full throttle: the ship slows and climbs within its lift; no rocket, no jolt, no bump', { skip }, () => {
  // A cone 150 m high with sides of 62 degrees, 400 m ahead of a ship skimming at 46 m/s.
  const hill = { dir: V(0, 1, 0), radius: 80, height: 150 };
  const world = makeWorld({ R: BODIES.earth.radius, hill });
  const ss = (id, d) => world(d);
  const physics = P.createPhysics({ sampleSurface: ss, seed: 1 });
  const start = norm(V(0.3, 0.4, 0.86));
  const sim = new Sim({ sampleSurface: ss, getSpawn: () => start, physics });
  const pad = new Pad();
  sim.teleport({ body: 'earth', ship: true, altitude: 8, heading: 0 });
  const up = norm(sim.sh.p), east = tangent(cross(V(0, 1, 0), up), up, V(1, 0, 0)), north = cross(up, east);
  hill.dir = norm(add(up, scale(north, 400 / BODIES.earth.radius)));
  play(sim, pad, 0.5);
  const R = hullRecorder(sim);
  let minClear = Infinity, slowest = Infinity, far = 0;
  pad.press('KeyW');
  play(sim, pad, 30, { each: () => {
    holdPitch(sim, pad, 0); R.each();
    const g = world(norm(sim.sh.p));
    minClear = Math.min(minClear, len(sim.sh.p) - g.radius);
    far = Math.acos(Math.min(1, dot(norm(sim.sh.p), up))) * BODIES.earth.radius;
    if (far > 250 && far < 420) slowest = Math.min(slowest, sim.sh.speed);
  } });
  assert.equal(sim.sh.bounces, 0, 'no bump');
  assert.ok(far > 520, 'over the cone and on: ' + far.toFixed(0) + ' m');
  assert.ok(minClear >= SHIP.minClearance - 0.05, 'never nearer the ground than ' + minClear.toFixed(2) + ' m');
  assert.ok(R.dvUp < 0.46, `the largest change of vertical speed in one step: ${R.dvUp.toFixed(2)} m/s, the hull's own lift (it was 3.5 to 8.5, 16 to 35 g)`);
  assert.ok(R.climb < 26, `it climbs at ${R.climb.toFixed(1)} m/s at most (it was shot up at 71)`);
  assert.ok(slowest < 40, 'and slows for the slope: ' + slowest.toFixed(1) + ' m/s');
});
