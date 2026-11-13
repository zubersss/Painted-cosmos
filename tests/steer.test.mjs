// Steering above a world's air, after a re-boarding, and C (M4's blind play-test on 3d38bb2,
// BROKEN 2 and CONFUSING 6). Climbing out of Venus with Saturn's mark overhead, the mark stayed
// an arrow at the top of the picture: the 78 degree pitch limit held to 9 km up (the arrival
// sphere is at 4.3 km), and A / D, turning round Venus' up, only swung the arrow round the edge.
// C held with the nose up climbed (225 -> 320 m).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Sim, FEEL } from '../src/core/sim.js';
import { S } from '../src/core/state.js';
import { BODIES, spaceAltitude } from '../src/data/bodies.js';
import { stubSurface, stubSpawn } from '../src/core/stubs/surface.js';
import { bodyFrame } from '../src/core/frames.js';
import { Pad, play, flyTo, holdPitch, V, sub, norm, len, dot } from './helpers.mjs';
import { qLook, qRotate, cross } from '../src/core/vec.js';

const newSim = () => new Sim({ sampleSurface: stubSurface, getSpawn: (id) => stubSpawn(id).unitDir });
const RAD = Math.PI / 180;
const nose = (sim) => qRotate(sim.sh.q, V(0, 0, -1));
const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(norm(a), norm(b))))) / RAD;

// Over Venus at `alt` m (above its air: Venus' air ends at 900 m), on the side that faces Saturn,
// so that Saturn's mark is straight overhead; the nose level.
function overVenus(alt) {
  const sim = newSim();
  const pad = new Pad();
  sim.teleport({ body: 'venus', ship: true, altitude: 3 * spaceAltitude(BODIES.venus) });
  play(sim, pad, 0.1);
  const up = norm(sub(sim.eph.position('saturn', sim.t), sim.eph.position('venus', sim.t)));
  sim.shFrame = bodyFrame('venus', false);
  sim.sh.p = V(up.x * (BODIES.venus.radius + alt), up.y * (BODIES.venus.radius + alt), up.z * (BODIES.venus.radius + alt));
  sim.sh.v = V();
  sim.sh.throttle = 0;
  sim.sh.q = qLook(norm(cross(up, Math.abs(up.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0))), up);
  sim.sm.force(S.SPACE);
  sim.setTarget('saturn');
  play(sim, pad, 0.1);
  return { sim, pad };
}

test('climbing out of Venus with the mark overhead: the mouse brings the nose onto it, A / D turn the nose (not the picture round it)', () => {
  for (const alt of [1500, 2700, 6000]) {
    const { sim, pad } = overVenus(alt);
    assert.equal(sim.sm.state, S.SPACE, 'above the air');
    assert.ok(angle(nose(sim), sub(sim.bodyInShipFrame('saturn'), sim.sh.p)) > 85, 'the mark starts overhead');
    // Follow the mark with the mouse, as a player does (the helper's own way of aiming).
    play(sim, pad, 8, {
      each: () => {
        const a = sim.aimAt('saturn');
        pad.dx += Math.max(-60, Math.min(60, a.yawDeg * RAD / FEEL.mouseShip * 0.12));
        pad.dy -= Math.max(-60, Math.min(60, a.pitchDeg * RAD / FEEL.mouseShip * 0.12));
      },
    });
    const off = angle(nose(sim), sub(sim.bodyInShipFrame('saturn'), sim.sh.p));
    assert.ok(off < 2, `${alt} m over Venus: the nose comes onto Saturn's mark overhead (${off.toFixed(1)} deg off)`);
    // Now hold D for a second: the nose swings off the mark (it used to turn round Venus' up,
    // which with the nose overhead is the nose itself: the picture rolled round the mark).
    pad.press('KeyD');
    play(sim, pad, 1);
    pad.release('KeyD');
    const swung = angle(nose(sim), sub(sim.bodyInShipFrame('saturn'), sim.sh.p));
    assert.ok(swung > 25, `${alt} m: D turns the nose off the mark (${swung.toFixed(1)} deg)`);
  }
});

test('in a world\'s air the nose still stops at the pitch limit, and the mouse pitches it a little more gently', () => {
  const sim = newSim();
  const pad = new Pad();
  sim.teleport({ body: 'earth', ship: true, altitude: 300 });
  play(sim, pad, 0.5);
  assert.equal(sim.sm.state, S.ATMOSPHERE);
  for (let i = 0; i < 40; i++) { pad.dy -= 200; play(sim, pad, 0.1); }
  assert.ok(sim.info().ship.pitchDeg < 79, 'no loops in the air: ' + sim.info().ship.pitchDeg.toFixed(1));
  assert.ok(sim.info().ship.pitchDeg > 70, 'but nearly straight up: ' + sim.info().ship.pitchDeg.toFixed(1));
  // A 120 px drag in the air: 0.8 of what it is above the air.
  sim.teleport({ body: 'earth', ship: true, altitude: 300 });
  play(sim, pad, 0.5);
  const p0 = sim.info().ship.pitchDeg;
  pad.dy -= 120;
  play(sim, pad, 1.5);
  const d = sim.info().ship.pitchDeg - p0;
  const full = 120 * FEEL.mouseShip / RAD;
  assert.ok(d > full * 0.7 && d < full * 0.9, `120 px pitches the nose ${d.toFixed(1)} deg in the air (${full.toFixed(1)} above it)`);
});

test('C sinks whatever the nose does: nose 20 degrees up at 225 m, C held, the ship comes down', () => {
  for (const body of ['earth', 'venus', 'mars']) {
    const sim = newSim();
    const pad = new Pad();
    sim.teleport({ body, ship: true, altitude: 225, pitchDeg: 20, throttle: 0.8 });
    play(sim, pad, 3, { each: () => holdPitch(sim, pad, 20) });
    const a0 = sim.sh.altGround;
    pad.press('KeyC');
    let top = a0;
    play(sim, pad, 12, { each: () => { holdPitch(sim, pad, 20); top = Math.max(top, sim.sh.altGround); } });
    pad.release('KeyC');
    const a1 = sim.sh.altGround;
    assert.ok(top < a0 + 15, `${body}: C held never climbed much (${a0.toFixed(0)} -> top ${top.toFixed(0)} m)`);
    assert.ok(a1 < a0 - 60, `${body}: C held 12 s sank from ${a0.toFixed(0)} to ${a1.toFixed(0)} m`);
  }
});

test('after stepping out on Venus and boarding again, the mouse and A / D steer the ship above the air as on a new game', () => {
  const sim = newSim();
  const pad = new Pad();
  const log = [];
  play(sim, pad, 0.5);
  flyTo(sim, pad, 'venus', log);
  assert.equal(sim.sm.state, S.ON_FOOT, 'stood on Venus');
  // Walk back to the ship, board, lift off, climb above the air.
  pad.dx += (sim.info().shipBearingDeg * RAD) / FEEL.mouseFoot;
  pad.press('KeyW');
  play(sim, pad, 30, { until: () => sim.info().canBoard });
  pad.release('KeyW');
  pad.tap('KeyE');
  play(sim, pad, 4, { until: () => sim.sm.state === S.LANDED });
  assert.equal(sim.sm.state, S.LANDED, 'boarded again');
  pad.tap('Space');
  play(sim, pad, 4);
  pad.press('KeyW');
  play(sim, pad, 120, { each: () => holdPitch(sim, pad, 55), until: () => sim.sm.state === S.SPACE });
  play(sim, pad, 60, { each: () => holdPitch(sim, pad, 55), until: () => sim.info().ship.altitude > 3 * spaceAltitude(BODIES.venus) });
  pad.release('KeyW');
  assert.equal(sim.sm.state, S.SPACE);
  play(sim, pad, 2);
  for (const [dx, dy, what] of [[0, -300, 'drag up'], [0, 300, 'drag down'], [300, 0, 'drag right'], [-300, 0, 'drag left']]) {
    const f0 = nose(sim);
    pad.dx += dx; pad.dy += dy;
    play(sim, pad, 1.5);
    const turned = angle(f0, nose(sim));
    const want = 300 * FEEL.mouseShip / RAD;
    assert.ok(turned > want * 0.8 && turned < want * 1.25, `${what}: the nose turned ${turned.toFixed(1)} deg (${want.toFixed(1)} asked)`);
  }
  const f0 = nose(sim);
  pad.press('KeyA');
  play(sim, pad, 1);
  pad.release('KeyA');
  assert.ok(angle(f0, nose(sim)) > 30, 'A turns the nose: ' + angle(f0, nose(sim)).toFixed(1));
});
