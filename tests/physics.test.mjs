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
import { Pad, play, len, sub, norm, dot } from './helpers.mjs';

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
  assert.ok(sim.physicsMs < 2, 'physics.update average ' + sim.physicsMs.toFixed(2) + ' ms');
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
  play(sim, pad, SHIP.liftoffSeconds + 0.6);
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
  assert.ok(sim.physicsMs < 2, 'physics.update average ' + sim.physicsMs.toFixed(2) + ' ms');
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
    play(sim, pad, SHIP.liftoffSeconds + 0.8);
    assert.equal(sim.sm.state, S.ATMOSPHERE);
    assert.ok(sim.sh.altGround > SHIP.hoverHeight - 2.5, `${body}: lifted to ${sim.sh.altGround.toFixed(1)} m`);
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
