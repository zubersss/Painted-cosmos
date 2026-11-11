// The whole M1 loop, played through the pure simulation in Node with scripted keys and mouse:
// on foot -> jetpack -> board -> lift off -> space -> back down -> land -> step out.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Sim, FEEL } from '../src/core/sim.js';
import { S } from '../src/core/state.js';
import { SHIP } from '../src/ship/flight.js';
import { CAMERA } from '../src/player/camera.js';
import { BODIES } from '../src/data/bodies.js';
import { spaceAltitude } from '../src/core/orbits.js';
import { stubSurface, stubSpawn } from '../src/core/stubs/surface.js';
import { Pad, play, len, sub, norm, dot } from './helpers.mjs';

const RAD = Math.PI / 180;
function newSim(opts = {}) {
  return new Sim({ sampleSurface: stubSurface, getSpawn: (id) => stubSpawn(id).unitDir, ...opts });
}
// Nudge the ship's nose toward a pitch (degrees above the horizon) with mouse movement.
function holdPitch(sim, pad, deg) {
  const err = deg - sim.info().ship.pitchDeg;
  pad.dy -= Math.max(-40, Math.min(40, (err * RAD / FEEL.mouseShip) * 0.12));
}

test('M1 loop on Earth: walk, jetpack, board, lift off, reach space, return, land, step out', () => {
  const sim = newSim();
  const pad = new Pad();
  let minClear = Infinity;
  const watch = () => { const c = sim.info().cameraClearance; if (c != null) minClear = Math.min(minClear, c); };
  const opts = (o = {}) => ({ ...o, each: (t) => { watch(); if (o.each) o.each(t); } });

  // -- on foot ---------------------------------------------------------------------------------
  play(sim, pad, 0.5, opts());
  assert.equal(sim.sm.state, S.ON_FOOT);
  assert.equal(sim.bodyId, 'earth');
  assert.ok(Math.abs(sim.mood.timeOfDay - 9.5) < 0.1, 'starts on a clear morning');
  const p0 = { ...sim.ex.p };
  pad.press('KeyW');
  play(sim, pad, 2, opts());
  pad.release('KeyW');
  assert.ok(len(sub(sim.ex.p, p0)) > 6, 'walked');
  assert.ok(sim.ex.grounded);

  // -- jetpack -----------------------------------------------------------------------------------
  pad.press('Space');
  play(sim, pad, 2.2, opts());
  assert.equal(sim.ex.mode, 'jet');
  assert.ok(sim.ex.altitude > 8, 'jetpack altitude ' + sim.ex.altitude);
  assert.ok(sim.ex.fuel < 0.6);
  pad.release('Space');
  play(sim, pad, 12, opts({ until: () => sim.ex.grounded }));
  assert.ok(sim.ex.grounded, 'came back down');
  play(sim, pad, 3, opts());
  assert.equal(sim.ex.fuel, 1, 'fuel recharged');

  // -- walk to the ship and board ----------------------------------------------------------------
  pad.dx += (sim.info().shipBearingDeg * RAD) / FEEL.mouseFoot;
  play(sim, pad, 0.2, opts());
  assert.ok(Math.abs(sim.info().shipBearingDeg) < 3, 'facing the ship');
  pad.press('KeyW');
  play(sim, pad, 20, opts({ until: () => sim.info().canBoard }));
  pad.release('KeyW');
  assert.ok(sim.info().canBoard, 'reached the ship');
  assert.equal(sim.promptNow.text, 'Board ship');
  pad.tap('KeyE');
  play(sim, pad, 0.1, opts());
  assert.equal(sim.sm.state, S.BOARDING);
  play(sim, pad, 3, opts({ until: () => sim.sm.state === S.LANDED }));
  assert.equal(sim.sm.state, S.LANDED);
  assert.match(sim.promptNow.text, /Lift off/);
  assert.equal(sim.explorerVisible(), false);

  // -- lift off ------------------------------------------------------------------------------------
  pad.tap('Space');
  play(sim, pad, 0.1, opts());
  assert.equal(sim.sm.state, S.ATMOSPHERE);
  assert.ok(sim.sh.liftoff, 'lift-off sequence running');
  play(sim, pad, SHIP.liftoffSeconds + 0.5, opts());
  assert.ok(!sim.sh.liftoff);
  assert.ok(Math.abs(sim.sh.altGround - SHIP.hoverHeight) < 1.5, 'hovering at ' + sim.sh.altGround);
  assert.ok(sim.sh.speed < 0.5, 'hovering still');
  assert.ok(sim.sh.gear01 < 0.2, 'gear up');
  // Let go of everything: it just hangs there.
  const hover = { ...sim.sh.p };
  play(sim, pad, 5, opts());
  assert.ok(len(sub(sim.sh.p, hover)) < 0.5, 'no drift, no sink: ' + len(sub(sim.sh.p, hover)));

  // -- climb to space, no loading screen -----------------------------------------------------------
  pad.press('KeyW');
  let maxSpeedAtmo = 0;
  const tClimb = play(sim, pad, 90, opts({
    each: () => { holdPitch(sim, pad, 55); maxSpeedAtmo = Math.max(maxSpeedAtmo, sim.sh.speed); },
    until: () => sim.sm.state === S.SPACE,
  }));
  assert.equal(sim.sm.state, S.SPACE, 'reached space');
  assert.equal(sim.info().frame, 'earth:orbit');
  assert.ok(tClimb > 6 && tClimb < 45, `climb takes an unhurried but not boring time: ${tClimb}s`);
  assert.ok(maxSpeedAtmo <= SHIP.speedAtmoTop * 1.05);
  assert.equal(sim.sh.bounces, 0);
  // Keep climbing until the planet is a globe below us, then stop and park.
  play(sim, pad, 60, opts({ each: () => holdPitch(sim, pad, 55), until: () => sim.info().ship.altitude > 4000 }));
  pad.release('KeyW');
  assert.ok(sim.info().ship.altitude > 4000);
  assert.ok(sim.mood.inSpace01 > 0.99 && sim.mood.altitude01 === 1);
  pad.press('KeyX');
  play(sim, pad, 8, opts());
  pad.release('KeyX');
  assert.ok(sim.sh.speed < 5, 'stopped in space: ' + sim.sh.speed);
  const parkAlt = sim.info().ship.altitude;
  play(sim, pad, 30, opts());
  assert.ok(Math.abs(sim.info().ship.altitude - parkAlt) < 20, 'a parked ship stays with its planet');
  // The moon is out there: another world to see.
  const moon = sim.aimAt('moon');
  assert.ok(moon.distance > 10e3 && moon.distance < 45e3);

  // -- come back down ------------------------------------------------------------------------------
  // Point the nose at the planet, throttle up.
  play(sim, pad, 6, opts({ each: () => { const a = sim.aimAt('earth'); pad.dx += a.yawDeg * RAD / FEEL.mouseShip * 0.1; pad.dy -= a.pitchDeg * RAD / FEEL.mouseShip * 0.1; } }));
  assert.ok(Math.abs(sim.aimAt('earth').pitchDeg) < 6, 'nose on the planet');
  pad.press('KeyW');
  play(sim, pad, 1.2, opts());
  pad.release('KeyW');
  play(sim, pad, 120, opts({ each: () => holdPitch(sim, pad, -50), until: () => sim.sm.state === S.ATMOSPHERE }));
  assert.equal(sim.sm.state, S.ATMOSPHERE, 'entered the atmosphere');
  assert.equal(sim.info().frame, 'earth:ground');
  // Descend at a comfortable angle, then flatten out near the ground.
  play(sim, pad, 120, opts({ each: () => holdPitch(sim, pad, -35), until: () => sim.sh.altGround < 160 }));
  pad.press('KeyS');
  play(sim, pad, 60, opts({
    each: () => { holdPitch(sim, pad, -8); if (sim.sh.throttle < 0.25) pad.release('KeyS'); },
    until: () => sim.info().ship.canLand,
  }));
  pad.release('KeyS');
  assert.ok(sim.info().ship.canLand, 'landing prompt is showing');
  assert.equal(sim.promptNow.text, 'Land here');
  assert.equal(sim.sh.bounces, 0, 'never touched the ground on the way down');

  // -- landing assist --------------------------------------------------------------------------------
  pad.tap('KeyE');
  play(sim, pad, 0.1, opts());
  assert.equal(sim.sm.state, S.LANDING);
  let touchSpeed = 0;
  const tLand = play(sim, pad, 60, opts({ each: () => { touchSpeed = sim.sh.speed; }, until: () => sim.sm.state === S.LANDED }));
  assert.equal(sim.sm.state, S.LANDED, 'landed');
  assert.ok(touchSpeed < 2.5, 'soft touchdown: ' + touchSpeed);
  assert.ok(tLand < 40, 'landing takes ' + tLand);
  play(sim, pad, 2, opts());
  const g = stubSurface('earth', norm(sim.sh.p));
  assert.ok(Math.abs(len(sim.sh.p) - Math.max(g.radius, g.liquidRadius)) < 0.05, 'gear on the ground');
  const shipUp = sim.shipPoseU();
  assert.ok(sim.sh.gear01 > 0.95);

  // -- step out ----------------------------------------------------------------------------------------
  pad.tap('KeyE');
  play(sim, pad, 0.1, opts());
  assert.equal(sim.sm.state, S.BOARDING);
  play(sim, pad, 3, opts({ until: () => sim.sm.state === S.ON_FOOT }));
  assert.equal(sim.sm.state, S.ON_FOOT);
  assert.ok(sim.explorerVisible());
  play(sim, pad, 1, opts());
  assert.ok(sim.ex.grounded || sim.ex.swimming, 'standing next to the ship');
  assert.ok(len(sub(sim.ex.p, sim.sh.p)) < 8);
  const p1 = { ...sim.ex.p };
  pad.press('KeyW');
  play(sim, pad, 2, opts());
  assert.ok(len(sub(sim.ex.p, p1)) > 4, 'walking again on new ground');

  const want = [S.ON_FOOT, S.BOARDING, S.LANDED, S.ATMOSPHERE, S.SPACE, S.ATMOSPHERE, S.LANDING, S.LANDED, S.BOARDING, S.ON_FOOT];
  assert.deepEqual(sim.sm.history.slice(-want.length), want);
  assert.ok(minClear >= Math.min(CAMERA.clearance, CAMERA.shipClearance) * 0.9, 'camera never clipped the ground: ' + minClear);
  assert.ok(shipUp);
});

test('the same loop works on another world (the moon: airless, low gravity)', () => {
  const sim = newSim({ body: 'moon' });
  const pad = new Pad();
  play(sim, pad, 0.5);
  assert.equal(sim.bodyId, 'moon');
  sim.teleport({ body: 'moon', ship: true, altitude: 0.01 });
  sim.sm.force(S.LANDED);
  sim.shFrame = { kind: 'body', id: 'moon', rotating: true };
  pad.tap('Space');
  play(sim, pad, 4);
  assert.equal(sim.sm.state, S.ATMOSPHERE);
  pad.press('KeyW');
  play(sim, pad, 60, { each: () => holdPitch(sim, pad, 60), until: () => sim.sm.state === S.SPACE });
  assert.equal(sim.sm.state, S.SPACE);
  assert.ok(sim.info().ship.altitude >= spaceAltitude(BODIES.moon));
  pad.release('KeyW');
});

test('first person toggles with V and hides the explorer', () => {
  const sim = newSim();
  const pad = new Pad();
  play(sim, pad, 0.2);
  assert.ok(sim.explorerVisible());
  pad.tap('KeyV');
  play(sim, pad, 0.2);
  assert.ok(sim.footCam.firstPerson);
  assert.ok(!sim.explorerVisible());
  assert.equal(sim.info().view, 'foot');
  pad.tap('KeyV');
  play(sim, pad, 0.2);
  assert.ok(!sim.footCam.firstPerson);
});

test('frame rate does not change the feel: 20 fps and 144 fps walk the same distance', () => {
  const dist = (fps) => {
    const sim = newSim();
    const pad = new Pad();
    const p0 = { ...sim.ex.p };
    pad.press('KeyW');
    play(sim, pad, 4, { fps });
    return len(sub(sim.ex.p, p0));
  };
  const a = dist(20), b = dist(144), c = dist(60);
  assert.ok(Math.abs(a - c) < 0.25 && Math.abs(b - c) < 0.25, `${a} ${b} ${c}`);
});

test('teleport puts you where you ask, on any body', () => {
  const sim = newSim();
  for (const body of ['mars', 'pluto', 'jupiter']) {
    const i = sim.teleport({ body, lat: 10, lon: 40 });
    assert.equal(i.state, S.ON_FOOT);
    assert.equal(sim.bodyId, body);
    const d = norm(sim.ex.p);
    assert.ok(Math.abs(Math.asin(d.y) / RAD - 10) < 1e-6);
    assert.ok(dot(norm(sim.sh.p), d) > 0.9999, 'the ship is beside you');
  }
  const i = sim.teleport({ body: 'earth', ship: true, altitude: 5000 });
  assert.equal(i.state, S.SPACE);
  assert.equal(i.frame, 'earth:orbit');
});
