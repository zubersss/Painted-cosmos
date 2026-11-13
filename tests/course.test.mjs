// The pulse goes where the course says (M4's blind play-test on 3d38bb2, BROKEN 1 and CONFUSING 5).
// With the mark of the chosen world behind, above or beside the nose the screen said "Pulse to
// Saturn", and F fired the ship straight along its nose, away from it (Saturn 662 -> 1974 km,
// 2846 -> 3287 km, 684 -> 1167 km); and a pulse to Saturn stopped short at Venus because Venus
// lay in front. Now F turns the ship onto the course first, in plain sight, and the drive goes
// round whatever lies across the straight line.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/core/sim.js';
import { S } from '../src/core/state.js';
import { BODIES, spaceAltitude } from '../src/data/bodies.js';
import * as pulse from '../src/ship/pulse.js';
const { PULSE, arrivalRadius } = pulse;
import { stubSurface, stubSpawn } from '../src/core/stubs/surface.js';
import { Pad, play, V, sub, norm, len, dot } from './helpers.mjs';
import { qLook, qRotate, cross } from '../src/core/vec.js';

const newSim = () => new Sim({ sampleSurface: stubSurface, getSpawn: (id) => stubSpawn(id).unitDir });
const WORLDS = ['mercury', 'venus', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
const deg = (r) => (r * 180) / Math.PI;

// In Earth's orbit (three times the height of its air), the nose set so that the world's mark is
// `where` the nose: behind it, straight above the ship, or off its right wing.
function inOrbit(to, where, lon = 30) {
  const sim = newSim();
  const pad = new Pad();
  sim.teleport({ body: 'earth', lat: 10, lon, ship: true, altitude: 3 * spaceAltitude(BODIES.earth) });
  play(sim, pad, 0.2);
  assert.equal(sim.sm.state, S.SPACE);
  const t = norm(sub(sim.bodyInShipFrame(to), sim.sh.p));
  const side = norm(cross(t, Math.abs(t.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0)));
  if (where === 'behind') sim.sh.q = qLook(V(-t.x, -t.y, -t.z), side);
  else if (where === 'above') sim.sh.q = qLook(side, t);          // the world straight over the canopy
  else sim.sh.q = qLook(side, cross(t, side));                      // the world off the right wing
  sim.sh.v = V();
  sim.setTarget(to);                                               // chosen on the map
  play(sim, pad, 0.1);
  return { sim, pad };
}

test('the pulse goes where the course says: from Earth\'s orbit, the mark behind, above or beside the nose, F arrives at every world', () => {
  const log = [];
  for (const to of WORLDS) {
    for (const where of ['behind', 'above', 'beside']) {
      const { sim, pad } = inOrbit(to, where);
      const a0 = sim.aimAt(to);
      const off0 = deg(Math.acos(Math.cos((a0.yawDeg * Math.PI) / 180) * Math.cos((a0.pitchDeg * Math.PI) / 180)));
      assert.ok(off0 > 60, `${to} ${where}: the mark starts well off the nose (${off0.toFixed(0)} deg)`);
      assert.equal(sim.promptNow && sim.promptNow.text, 'Pulse to ' + BODIES[to].name, 'the prompt names the world');
      const d0 = a0.distance;
      pad.tap('KeyF');
      let turnRate = 0, prevF = qRotate(sim.sh.q, V(0, 0, -1)), pulsed = false, tPulse = null, gone = 0;
      const said = [];
      play(sim, pad, 420, {
        fps: 30,
        each: (t) => {
          const f = qRotate(sim.sh.q, V(0, 0, -1));
          if (sim.turn) turnRate = Math.max(turnRate, Math.acos(Math.min(1, dot(f, prevF))) * 30);
          prevF = f;
          if (sim.sm.state === S.PULSE && !pulsed) { pulsed = true; tPulse = t; }
          if (pulsed) gone = Math.max(gone, len(sub(sim.bodyInShipFrame(to), sim.sh.p)) - d0);
          if (sim.notice && !said.includes(sim.notice.text)) said.push(sim.notice.text);
        },
        until: () => pulsed && sim.sm.state === S.SPACE,
      });
      if (sim.notice && !said.includes(sim.notice.text)) said.push(sim.notice.text);
      const d1 = len(sub(sim.bodyInShipFrame(to), sim.sh.p));
      const tag = `${to} ${where}: ${JSON.stringify(said)}`;
      assert.ok(pulsed, `${tag}: the drive started`);
      assert.equal(sim.sm.state, S.SPACE, `${tag}: and let go`);
      assert.ok(d1 < arrivalRadius(BODIES[to]) * 1.3, `${tag}: arrived at ${to}, ${(d1 / 1000).toFixed(1)} km from its centre (was ${(d0 / 1000).toFixed(0)} km)`);
      assert.ok(d1 > BODIES[to].radius + spaceAltitude(BODIES[to]), `${tag}: still in space`);
      assert.ok(gone < 2000, `${tag}: never flew away from it (${(gone / 1000).toFixed(1)} km further at most)`);
      assert.ok(said.includes(BODIES[to].name + ' ahead'), `${tag}: the screen says "${BODIES[to].name} ahead"`);
      assert.ok(said.some((x) => /^Turning onto the course for /.test(x)), `${tag}: the screen said it was turning onto the course`);
      assert.ok(!said.some((x) => /in the way|lies on your course|Too close|right ahead/.test(x)), `${tag}: nothing barred the way`);
      assert.ok(turnRate <= PULSE.turnRate * 1.05, `${tag}: a calm turn (${deg(turnRate).toFixed(0)} deg/s at most)`);
      assert.ok(tPulse > 1 && tPulse < 12, `${tag}: the turn took ${tPulse.toFixed(1)} s`);
      log.push(`${to}/${where} ${(d0 / 1000).toFixed(0)}km turn ${tPulse.toFixed(1)}s arrive ${(d1 / 1000).toFixed(1)}km`);
    }
  }
  console.log('      ' + log.join('; '));
});

test('a world across the straight line: the course goes along the tangent past it, and a mark on the nose still pulses at once', () => {
  // courseDir by itself: a sphere of 10 km halfway along a 200 km line is passed at passMargin x its radius.
  const p = V(0, 0, 0), f = V(0, 0, -1);
  const spheres = [{ id: 'far', c: V(0, 0, -200e3), radius: 9000 }, { id: 'mid', c: V(0, 0, -100e3), radius: 10e3 }, { id: 'sun', c: V(0, 300e3, 0), radius: 20e3 }];
  const { courseDir } = pulse;
  const c = courseDir(p, f, 'far', spheres);
  assert.equal(c.around, 'mid');
  const off = Math.acos(dot(c.dir, V(0, 0, -1)));
  assert.ok(Math.abs(off - Math.asin((PULSE.passMargin * 10e3) / 100e3)) < 1e-6, 'along the tangent of passMargin x the radius: ' + deg(off).toFixed(2));
  // The line along the course misses the sphere it goes round.
  const along = dot(V(0, 0, -100e3), c.dir);
  assert.ok(100e3 ** 2 - along ** 2 > 10e3 ** 2, 'the course clears the sphere');
  // Nothing across the line: straight at it.
  assert.equal(courseDir(p, f, 'far', [spheres[0], { id: 'mid', c: V(30e3, 0, -100e3), radius: 10e3 }]).around, null);
  // Inside a sphere, heading in: across, along its surface (no inward part).
  const inside = courseDir(V(0, 0, 0), f, 'far', [spheres[0], { id: 'here', c: V(0, 0, -4000), radius: 8800 }]);
  assert.equal(inside.around, 'here');
  assert.ok(Math.abs(dot(inside.dir, V(0, 0, -1))) < 1e-9, 'tangent to the sphere we are inside');

  // In the game: the mark on the nose (within the drive's own reach) pulses at once, no turn.
  // (a place in Earth's orbit from which the straight line to Mars is clear of the Earth)
  let sim, pad;
  for (let lon = 0; lon < 360; lon += 30) {
    ({ sim, pad } = inOrbit('mars', 'behind', lon));
    if (sim.course().around === null) break;
  }
  assert.equal(sim.course().around, null);
  const t = norm(sub(sim.bodyInShipFrame('mars'), sim.sh.p));
  const side = norm(cross(t, V(0, 1, 0)));
  sim.sh.q = qLook(norm(V(t.x + side.x * 0.1, t.y + side.y * 0.1, t.z + side.z * 0.1)), V(0, 1, 0));
  play(sim, pad, 0.1);
  pad.tap('KeyF');
  play(sim, pad, 0.2);
  assert.equal(sim.sm.state, S.PULSE, 'the mark 6 degrees off the nose: the drive starts at once');
  assert.equal(sim.turn, null);
});

test('the turn onto the course: F again or the mouse stops it, and the prompt says so', () => {
  const { sim, pad } = inOrbit('saturn', 'behind');
  pad.tap('KeyF');
  play(sim, pad, 1);
  assert.ok(sim.turn, 'turning');
  assert.equal(sim.sm.state, S.SPACE);
  assert.equal(sim.promptNow.text, 'Stop turning');
  pad.tap('KeyF');
  play(sim, pad, 0.5);
  assert.equal(sim.turn, null, 'F again stops the turn');
  assert.match(sim.notice.text, /Turn stopped/);
  assert.equal(sim.promptNow.text, 'Pulse to Saturn');
  pad.tap('KeyF');
  play(sim, pad, 1);
  assert.ok(sim.turn, 'turning again');
  pad.dx += 150;
  play(sim, pad, 0.2);
  assert.equal(sim.turn, null, 'a deliberate turn of the mouse takes the ship back');
  assert.equal(sim.sm.state, S.SPACE);
});

// CONFUSING 5: a pulse to Saturn dropped out at Venus because Venus lay in front, and nothing on
// the screen said why. Now the drive goes round it and on to Saturn.
test('a pulse to Saturn with Venus right in front goes round Venus and arrives at Saturn', async () => {
  const { HELIO } = await import('../src/core/frames.js');
  const sim = newSim();
  const pad = new Pad();
  sim.teleport({ body: 'earth', lat: 10, lon: 30, ship: true, altitude: 3 * spaceAltitude(BODIES.earth) });
  play(sim, pad, 0.2);
  const P = (id) => sim.eph.position(id, sim.t);
  const away = norm(sub(P('venus'), P('saturn')));
  sim.shFrame = HELIO;
  sim.sh.p = V(P('venus').x + away.x * 60e3, P('venus').y + away.y * 60e3, P('venus').z + away.z * 60e3);
  sim.sh.v = V();
  sim.sh.q = qLook(V(-away.x, -away.y, -away.z), V(0, 1, 0));       // the nose on Saturn, Venus dead ahead
  sim.setTarget('saturn');
  play(sim, pad, 0.1);
  assert.equal(sim.course().around, 'venus', 'Venus lies across the straight line');
  pad.tap('KeyF');
  const said = [];
  let pulsed = false, nearVenus = Infinity;
  play(sim, pad, 300, {
    fps: 30,
    each: () => {
      if (sim.sm.state === S.PULSE) pulsed = true;
      nearVenus = Math.min(nearVenus, len(sub(sim.bodyInShipFrame('venus'), sim.sh.p)));
      if (sim.notice && !said.includes(sim.notice.text)) said.push(sim.notice.text);
    },
    until: () => pulsed && sim.sm.state === S.SPACE,
  });
  if (sim.notice && !said.includes(sim.notice.text)) said.push(sim.notice.text);
  const d1 = len(sub(sim.bodyInShipFrame('saturn'), sim.sh.p));
  assert.ok(d1 < arrivalRadius(BODIES.saturn) * 1.3, `arrived at Saturn: ${(d1 / 1000).toFixed(1)} km; said ${JSON.stringify(said)}`);
  assert.ok(nearVenus > arrivalRadius(BODIES.venus), `passed Venus outside its sphere (${(nearVenus / 1000).toFixed(1)} km)`);
  assert.ok(!said.some((x) => /Venus/.test(x)), 'nothing said about Venus: ' + JSON.stringify(said));
});
