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

// The pre-ship verifier's R1 (on b0710fe): routed round a world, the pulse planned its speed along
// the nose only. With the nose on the tangent past the world just left (or one between) the course's
// world was off the line of flight, the drive ran up toward 30 km/s, and once round it had less room
// than braking takes: it went into that world's ground at 4 to 30 km/s, or round it at top speed
// without end (98 of 2160 routes and clocks; Earth -> Venus and Earth -> Mercury at clocks 3000 and
// 3600 s; Venus -> Earth in the real game hit Earth at 4.2 km/s). The test starts at three game clocks
// of the first hour, from every world to every other, the nose on the world or dead behind it.
test('every world to every other at three clocks: the pulse lets go at the chosen world\'s sphere, never runs into it, never circles it', () => {
  const ALL = ['mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
  const bad = [];
  let runs = 0, worstIn = 0, lowest = Infinity, longest = 0;
  for (const T0 of [0, 3000, 3600]) {
    for (const from of ALL) for (const to of ALL) {
      if (from === to) continue;
      for (const where of ['ahead', 'behind']) {
        const sim = newSim();
        sim.t = T0;
        const pad = new Pad();
        sim.teleport({ body: from, lat: 10, lon: 30, ship: true, altitude: 3 * spaceAltitude(BODIES[from]) });
        play(sim, pad, 0.2);
        const t = norm(sub(sim.bodyInShipFrame(to), sim.sh.p));
        const side = norm(cross(t, Math.abs(t.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0)));
        sim.sh.q = where === 'behind' ? qLook(V(-t.x, -t.y, -t.z), side) : qLook(t, side);
        sim.sh.v = V();
        sim.setTarget(to);
        play(sim, pad, 0.1);
        const d0 = len(sub(sim.bodyInShipFrame(to), sim.sh.p));
        const R = arrivalRadius(BODIES[to]);
        pad.tap('KeyF');
        runs++;
        let tP = 0, vIn = null, inPulse = Infinity, after = Infinity, other = Infinity, otherId = null, ended = null;
        const said = [];
        play(sim, pad, 600, {
          fps: 30,
          each: () => {
            const pulsing = sim.sm.state === S.PULSE;
            if (pulsing) tP += 1 / 30;
            const d = len(sub(sim.bodyInShipFrame(to), sim.sh.p));
            if (tP > 0 && vIn == null && d < R) vIn = sim.pulse ? sim.pulse.v : sim.sh.speed;
            if (pulsing) inPulse = Math.min(inPulse, d);
            if (ended != null) after = Math.min(after, d - BODIES[to].radius);
            if (pulsing) for (const id of ALL) {
              if (id === to || id === from) continue;
              const a = len(sub(sim.bodyInShipFrame(id), sim.sh.p)) - BODIES[id].radius - spaceAltitude(BODIES[id]);
              if (a < other) { other = a; otherId = id; }
            }
            if (tP > 0 && ended == null && !pulsing) ended = sim.t;
            if (sim.notice && !said.includes(sim.notice.text)) said.push(sim.notice.text);
          },
          until: () => ended != null && sim.t - ended > 20,
        });
        const tag = `clock ${T0} ${from}->${to} (${where}): ${JSON.stringify(said)}`;
        const why = [];
        if (ended == null) why.push(tP > 0 ? `still pulsing after ${tP.toFixed(0)} s` : 'the drive never started');
        else {
          if (vIn != null && vIn > PULSE.exitSpeed * 1.25) why.push(`into its sphere at ${vIn.toFixed(0)} m/s`);
          if (inPulse < R * 0.9) why.push(`pulsing ${(inPulse / 1000).toFixed(1)} km from its centre (sphere ${(R / 1000).toFixed(1)})`);
          if (after < spaceAltitude(BODIES[to])) why.push(`down to ${after.toFixed(0)} m over its ground after letting go`);
          if (!said.includes(BODIES[to].name + ' ahead')) why.push('no word of arriving');
          if (tP > 2.5 * PULSE_ETA(d0 - R) + 30) why.push(`a pulse of ${tP.toFixed(0)} s for ${(d0 / 1000).toFixed(0)} km`);
        }
        if (other < 0) why.push(`within the edge of ${otherId}'s space by ${(-other).toFixed(0)} m`);
        if (why.length) bad.push(`${tag}: ${why.join('; ')}`);
        if (vIn != null) worstIn = Math.max(worstIn, vIn);
        if (after < Infinity) lowest = Math.min(lowest, after - spaceAltitude(BODIES[to]));
        longest = Math.max(longest, tP / Math.max(1, PULSE_ETA(d0 - R)));
      }
    }
  }
  console.log(`      ${runs} pulses; fastest into a sphere ${worstIn.toFixed(0)} m/s; lowest ${lowest.toFixed(0)} m over the edge of space; longest ${longest.toFixed(2)} x its ETA`);
  assert.deepEqual(bad.slice(0, 20), [], `${bad.length} of ${runs}`);
});
const PULSE_ETA = (d) => pulse.pulseEta(Math.max(0, d));

// The verifier's real-game case: Venus at 945 m, the clock at 0.3 s, Earth chosen on the map, the
// nose on Earth, F. On b0710fe the pulse passed Mercury and hit Earth's ground at 4.2 km/s (and lay
// on it nose-down with "F Drop out of pulse"); on 8c7d603 it stopped 162 km out ("Mercury is in the way").
test('Venus to Earth at the start of the clock: round Mercury and in front of Earth, at cruise speed', () => {
  const sim = newSim();
  sim.t = 0.3;
  const pad = new Pad();
  sim.teleport({ body: 'venus', lat: 10, lon: 30, ship: true, altitude: 945 });
  play(sim, pad, 0.2);
  assert.equal(sim.sm.state, S.SPACE);
  const t = norm(sub(sim.bodyInShipFrame('earth'), sim.sh.p));
  sim.sh.q = qLook(t, norm(cross(t, V(0, 1, 0))));
  sim.sh.v = V();
  sim.setTarget('earth');
  play(sim, pad, 0.1);
  pad.tap('KeyF');
  const said = [];
  let pulsed = false, vIn = null, low = Infinity, mercury = Infinity;
  const R = arrivalRadius(BODIES.earth);
  play(sim, pad, 400, {
    fps: 30,
    each: () => {
      if (sim.sm.state === S.PULSE) pulsed = true;
      const d = len(sub(sim.bodyInShipFrame('earth'), sim.sh.p));
      if (pulsed && vIn == null && d < R) vIn = sim.pulse ? sim.pulse.v : sim.sh.speed;
      low = Math.min(low, d - BODIES.earth.radius);
      if (pulsed) mercury = Math.min(mercury, len(sub(sim.bodyInShipFrame('mercury'), sim.sh.p)));
      if (sim.notice && !said.includes(sim.notice.text)) said.push(sim.notice.text);
    },
    until: () => pulsed && sim.sm.state === S.SPACE && sim.sh.speed < 30,
  });
  assert.ok(pulsed && sim.sm.state === S.SPACE, 'pulsed and let go: ' + JSON.stringify(said));
  assert.ok(said.includes('Earth ahead'), JSON.stringify(said));
  assert.ok(vIn < PULSE.exitSpeed * 1.25, `into Earth's sphere at ${vIn && vIn.toFixed(0)} m/s`);
  assert.ok(low > spaceAltitude(BODIES.earth), `never lower than the edge of Earth's space: ${low.toFixed(0)} m over its ground`);
  assert.ok(mercury > arrivalRadius(BODIES.mercury), `round Mercury outside its sphere (${(mercury / 1000).toFixed(1)} km)`);
});

// The verifier's R2 (on b0710fe): F held the course until arrival or the map, so after "Turn
// stopped" or a drop-out the prompt stayed on the old world with the nose dead on another, and F
// turned the ship away from the world in the middle of the picture. F's hold now ends with its turn
// or its pulse; a world chosen on the map still holds.
test('after a stopped turn or a drop-out, the course is again the marker last pointed at; a world chosen on the map holds', () => {
  const sim = newSim();
  const pad = new Pad();
  sim.teleport({ body: 'earth', lat: 10, lon: 30, ship: true, altitude: 3 * spaceAltitude(BODIES.earth) });
  play(sim, pad, 0.2);
  const aim = (id, back = false) => {
    const t = norm(sub(sim.bodyInShipFrame(id), sim.sh.p));
    sim.sh.q = qLook(back ? V(-t.x, -t.y, -t.z) : t, norm(cross(t, V(0, 1, 0))));
    sim.sh.v = V();
    play(sim, pad, 0.3);
  };
  aim('saturn'); aim('saturn', true);
  assert.equal(sim.promptNow.text, 'Pulse to Saturn', 'the marker last pointed at');
  pad.tap('KeyF'); play(sim, pad, 1);
  assert.ok(sim.turn, 'turning onto the course for Saturn');
  pad.tap('KeyF'); play(sim, pad, 0.3);
  assert.equal(sim.turn, null);
  aim('mars');
  assert.equal(sim.promptNow.text, 'Pulse to Mars', 'after "Turn stopped" the nose on Mars names Mars');
  // a drop-out
  pad.tap('KeyF');
  play(sim, pad, 30, { until: () => sim.sm.state === S.PULSE });
  assert.equal(sim.sm.state, S.PULSE);
  play(sim, pad, 3);
  pad.tap('KeyF');
  play(sim, pad, 90, { until: () => sim.sm.state === S.SPACE });
  assert.equal(sim.sm.state, S.SPACE, 'dropped out');
  aim('jupiter');
  assert.equal(sim.promptNow.text, 'Pulse to Jupiter', 'after a drop-out the nose on Jupiter names Jupiter');
  pad.tap('KeyF'); play(sim, pad, 1);
  assert.ok(sim.sm.state === S.PULSE || (sim.turn && sim.turn.dest === 'jupiter'), 'F goes to Jupiter');
  pad.tap('KeyF'); play(sim, pad, 90, { until: () => sim.sm.state === S.SPACE && !sim.turn });
  // chosen on the map: pointing elsewhere does not change it, after a stopped turn or a drop-out either
  sim.setTarget('neptune');
  aim('mars');
  assert.equal(sim.promptNow.text, 'Pulse to Neptune', 'the map\'s choice holds');
  pad.tap('KeyF'); play(sim, pad, 1);
  pad.tap('KeyF'); play(sim, pad, 0.3);
  aim('mars');
  assert.equal(sim.promptNow.text, 'Pulse to Neptune', 'and holds after a stopped turn');
});
