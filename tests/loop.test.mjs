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
import { V, add, scale, cross, qRotate } from '../src/core/vec.js';

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
  assert.ok(Math.abs(sim.mood.timeOfDay - FEEL.startHour) < 0.1, 'starts on a clear morning');
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
  // Point the nose down at the planet (near a body the nose stops at the pitch limit, so the
  // planet can fill the view but the ship cannot loop), throttle up.
  play(sim, pad, 6, opts({ each: () => holdPitch(sim, pad, -60) }));
  assert.ok(Math.abs(sim.info().ship.pitchDeg + 60) < 4, 'nose toward the planet: ' + sim.info().ship.pitchDeg);
  play(sim, pad, 3, opts({ each: () => { pad.dy += 30; } }));
  assert.ok(sim.info().ship.pitchDeg >= -SHIP.pitchLimit * 180 / Math.PI - 0.5, 'pitch limit holds in orbit');
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

// ---- M4: stepping out (PAINTER's critique of PILOT, item 1) ------------------------------------
// The hull as a picture sees it (PAINTER's model, measured: body, glass, fin, wings, wing tips),
// projected by the test's own arithmetic: the share of a 16:9 frame its spheres cover from the
// camera's pose, and whether any of them lies between the lens and the explorer's chest.
const HULL = [[0, 1.3, -3.3, 1.2], [0, 1.45, -1.3, 1.6], [0, 1.3, 1.0, 1.6], [0, 1.6, 3.2, 1.4], [0, 2.5, 4.0, 0.9], [-2.4, 1.5, 1.0, 1.0], [2.4, 1.5, 1.0, 1.0], [-3.3, 1.6, 1.25, 0.7], [3.3, 1.6, 1.25, 0.7]];
function hullInFrame(sim) {
  const pose = sim.camPose, p = pose.p, dir = qRotate(pose.q, V(0, 0, -1)), sh = sim.sh;
  const shape = HULL.map((h) => ({ p: add(sh.p, qRotate(sh.q, V(h[0], h[1], h[2]))), radius: h[3] }));
  const up = norm(p), right = norm(cross(dir, up)), top = cross(right, dir), th = Math.tan((pose.fov * Math.PI) / 360), tw = th * 16 / 9;
  const discs = [];
  for (const h of shape) { const v = sub(h.p, p), d = dot(v, dir); if (d > 0.3) discs.push({ x: dot(v, right) / d, y: dot(v, top) / d, r: h.radius / d }); }
  let hit = 0, mid = 0, midN = 0; const NX = 48, NY = 27;
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const nx = (i + 0.5) / NX * 2 - 1, ny = (j + 0.5) / NY * 2 - 1, inMid = Math.abs(nx) < 0.5 && Math.abs(ny) < 0.5;
    if (inMid) midN++;
    for (const c of discs) if ((nx * tw - c.x) ** 2 + (ny * th - c.y) ** 2 < c.r * c.r) { hit++; if (inMid) mid++; break; }
  }
  const chest = add(sim.ex.p, scale(norm(sim.ex.p), 1.2)), seg = sub(chest, p), sl = len(seg), sd = scale(seg, 1 / sl);
  let hidden = false;
  for (const h of shape) { const q = sub(h.p, p), t = Math.max(0, Math.min(sl, dot(q, sd))); if (len(sub(q, scale(sd, t))) < h.radius) hidden = true; }
  return { cover: hit / (NX * NY), middle: mid / midN, hidden };
}

test('M4 stepping out: the first picture is the land with the explorer in it, not the ship\'s wing', () => {
  for (const body of ['earth', 'mars', 'pluto']) {
    const sim = newSim();
    const pad = new Pad();
    sim.teleport({ body, ship: true, altitude: 30 });
    play(sim, pad, 1);
    pad.tap('KeyE');
    play(sim, pad, 90, { until: () => sim.sm.state === S.LANDED });
    assert.equal(sim.sm.state, S.LANDED, body + ': landed');
    play(sim, pad, 1.5);
    pad.tap('KeyE');
    // the way out is a walk, not a cut: the explorer is seen all the way, and moves
    let seen = true, t = 0;
    const p0 = { ...sim.hatchPoint() };
    play(sim, pad, 6, { each: () => { t += 1 / 60; if (sim.sm.state === S.BOARDING && !sim.explorerVisible()) seen = false; }, until: () => sim.sm.state === S.ON_FOOT });
    assert.equal(sim.sm.state, S.ON_FOOT, body + ': stepped out');
    assert.ok(seen, body + ': the explorer is in sight all the way out');
    assert.ok(t > 1.3 && t < 2.6, `${body}: out in ${t.toFixed(2)} s (it was 0.95: a cut)`);
    assert.ok(len(sub(sim.ex.p, p0)) > 2.4, `${body}: a few steps clear of the wing: ${len(sub(sim.ex.p, p0)).toFixed(1)} m from the ladder`);
    assert.equal(sim.ex.mode, 'idle', body + ': standing');
    for (const wait of [0, 2.5]) {
      play(sim, pad, wait);
      const f = hullInFrame(sim);
      assert.ok(!f.hidden, `${body} +${wait} s: the hull is not between the lens and the explorer`);
      assert.ok(f.cover < 1 / 6, `${body} +${wait} s: the hull takes ${(f.cover * 100).toFixed(0)} % of the frame (it took 35 %; a sixth at most)`);
      assert.ok(f.middle < 0.05, `${body} +${wait} s: and ${(f.middle * 100).toFixed(0)} % of its middle`);
    }
    assert.ok(sim.footCam.boomNow > CAMERA.boom - 0.3, `${body}: the boom is free: ${sim.footCam.boomNow.toFixed(1)} m`);
    assert.equal(sim.shipInPicture(), false, body + ': a sketch of the place may be drawn');
    // turned to look at the ship from beside it, the page waits
    pad.dx += (sim.info().shipBearingDeg * RAD) / FEEL.mouseFoot;
    play(sim, pad, 0.5);
    assert.equal(sim.shipInPicture(), true, body + ': looking at the ship from beside it, the page waits');
  }
});
