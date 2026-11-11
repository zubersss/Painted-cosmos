// Two guards that keep the ship forgiving near the ground, each held by its own test:
//   1. a sink (C held) that stalls near the ground lands, or the screen says why not
//      ("Slow down to land"): never a silent hover (PHYSICS saw one at 4.1 m on the Moon);
//   2. thin-air worlds keep to a gentler pace low over the ground and are fast only with height
//      (Mars and the Moon turned on 208 to 260 m and took 131 to 248 m to stop at 143 m/s).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Sim, FEEL } from '../src/core/sim.js';
import { S } from '../src/core/state.js';
import { SHIP } from '../src/ship/flight.js';
import { stubSurface, stubSpawn } from '../src/core/stubs/surface.js';
import { cross, reject, qRotate, add } from '../src/core/vec.js';
import { Pad, play, makeWorld, V, norm, dot, sub, scale, len } from './helpers.mjs';

let P = null, why = '';
try { P = await import('../src/physics/index.js'); } catch (e) { why = String(e && e.message).slice(0, 120); }
const skip = P && P.createPhysics ? false : 'physics not importable: ' + why;
const RAD = Math.PI / 180;
const stubSim = (opts = {}) => new Sim({ sampleSurface: stubSurface, getSpawn: (id) => stubSpawn(id).unitDir, ...opts });
const withPhysics = (opts = {}) => stubSim({ physics: P.createPhysics({ sampleSurface: stubSurface, seed: 1 }), ...opts });

// ---- 1. the stalled sink -------------------------------------------------------------------

function sinkWhileFlyingOn(sim, tag) {
  const pad = new Pad();
  play(sim, pad, 0.3);
  sim.teleport({ body: 'earth', ship: true, altitude: 9, throttle: 0.3 });
  pad.press('KeyC');
  let said = null, at = null;
  play(sim, pad, 8, { each: (t) => { if (!said && sim.notice) { said = sim.notice.text; at = t; } }, until: () => sim.sm.state !== S.ATMOSPHERE });
  assert.equal(sim.sm.state, S.ATMOSPHERE, tag + ': still flying (too fast to set down)');
  assert.ok(sim.sh.speed >= 5, `${tag}: moving at ${sim.sh.speed.toFixed(1)} m/s`);
  assert.equal(said, 'Slow down to land', tag + ': the screen says why the ship does not land');
  assert.ok(at < 6, `${tag}: said within ${at.toFixed(1)} s of holding C`);
  assert.equal(sim.sh.bounces, 0, tag + ': no bump while skimming');
  // Do what it says (X cuts the throttle), still holding C: the ship lands.
  pad.press('KeyX');
  play(sim, pad, 20, { until: () => sim.sm.state !== S.ATMOSPHERE });
  assert.equal(sim.sm.state, S.LANDING, tag + ': slowed down, it begins to land');
  pad.releaseAll();
  play(sim, pad, 60, { until: () => sim.sm.state === S.LANDED });
  assert.equal(sim.sm.state, S.LANDED, tag + ': landed');
}

test('sink held while flying on: the screen says "Slow down to land"; slow down and it lands', () => {
  sinkWhileFlyingOn(stubSim(), 'kinematic');
});

test('with physics: sink held while flying on says "Slow down to land"; slow down and it lands', { skip }, () => {
  sinkWhileFlyingOn(withPhysics(), 'with physics');
});

test('a sink that stalls above the usual touch-down height (creeping up a slope) lands all the same', () => {
  // A cone hill; the ship creeps up its flank at walking pace with C held. The pull-up over
  // rising ground keeps it from sinking: without the guard it would hover there for ever.
  const spawn = norm(V(0.3, 0.5, 0.8));
  const east = norm(cross(V(0, 1, 0), spawn)), north = cross(spawn, east);
  for (const [radius, height] of [[90, 25], [60, 45]]) {
    const hillDir = norm(add(spawn, scale(north, (radius * 0.75) / 4000)));
    const world = makeWorld({ R: 4000, hill: { dir: hillDir, radius, height } });
    const sim = new Sim({ sampleSurface: (id, d) => world(d), getSpawn: () => spawn });
    const pad = new Pad();
    const tag = `slope of ${Math.round(Math.atan(height / radius) / RAD)} degrees`;
    play(sim, pad, 0.3);
    sim.teleport({ body: 'earth', ship: true, altitude: 7, dir: [spawn.x, spawn.y, spawn.z], throttle: 0.07 });
    pad.press('KeyC');
    let lowest = Infinity;
    const t = play(sim, pad, 8, {
      each: (t) => {
        // Keep the nose on the hill top with the yaw keys.
        const up = norm(sim.sh.p), fwd = qRotate(sim.sh.q, V(0, 0, -1));
        const to = norm(reject(sub(scale(hillDir, len(sim.sh.p)), sim.sh.p), up));
        const side = dot(cross(fwd, to), up);
        pad.release('KeyA'); pad.release('KeyD');
        if (side > 0.03) pad.press('KeyA'); else if (side < -0.03) pad.press('KeyD');
        if (t > 0.1) lowest = Math.min(lowest, sim.sh.altGround);       // (the first frame after a teleport has no height yet)
      },
      until: () => sim.sm.state !== S.ATMOSPHERE,
    });
    // The case the guard is for: the sink never reached the height at which C simply lands.
    assert.ok(lowest > SHIP.minClearance + 1.2, `${tag}: the sink stalled at ${lowest.toFixed(1)} m, above the ${(SHIP.minClearance + 1.2).toFixed(1)} m where C lands by itself`);
    assert.equal(sim.sm.state, S.LANDING, `${tag}: a landing began (after ${t.toFixed(1)} s)` + (sim.notice ? ', "' + sim.notice.text + '"' : ''));
    assert.ok(t < 4, `${tag}: within ${t.toFixed(1)} s`);
    pad.releaseAll();
    play(sim, pad, 90, { until: () => sim.sm.state !== S.LANDING });
    // Landed; or handed back hovering with a word if the assist found no level ground on the way.
    if (sim.sm.state !== S.LANDED) assert.ok(sim.notice && /level ground|steep/i.test(sim.notice.text), `${tag}: gave up without a word (${sim.sm.state})`);
    else assert.equal(sim.sh.bounces, 0, tag + ': no bump');
  }
});

// ---- 2. the pace of thin-air worlds near the ground -----------------------------------------

// Fly level at full throttle for 20 s, holding `alt` metres above the ground by pitch; then cut.
function cruise(body, alt) {
  const sim = withPhysics({ body });
  const pad = new Pad();
  play(sim, pad, 0.3);
  sim.teleport({ body, ship: true, altitude: alt, pitchDeg: 0, throttle: 1 });
  pad.press('KeyW');
  let top = 0;
  play(sim, pad, 20, {
    each: (t) => {
      const err = (alt - sim.sh.altGround) * 0.4 - sim.info().ship.pitchDeg;
      pad.dy -= Math.max(-40, Math.min(40, (err * RAD / FEEL.mouseShip) * 0.12));
      if (t > 10) top = Math.max(top, sim.sh.speed);
    },
  });
  const speedScale = sim.flightEnv().speedScale, state = sim.sm.state, p0 = { ...sim.sh.p };
  pad.release('KeyW');
  pad.press('KeyX');
  const seconds = play(sim, pad, 30, { until: () => sim.sh.speed < 3 });
  return { top, speedScale, state, stop: len(sub(sim.sh.p, p0)), seconds, bounces: sim.sh.bounces };
}

test('with physics: thin-air worlds keep a gentler pace low over the ground, and height buys speed', { skip }, () => {
  const low = SHIP.speedGround * 1.7;                                   // about 78 m/s
  for (const body of ['mars', 'moon']) {
    const a = cruise(body, 30);
    assert.equal(a.state, S.ATMOSPHERE, body + ': flying in the ground frame');
    assert.ok(Math.abs(a.speedScale - 1.7) < 0.02, `${body}: pace under 60 m is 1.7 times Earth's (${a.speedScale.toFixed(2)})`);
    assert.ok(a.top > low * 0.8 && a.top < low * 1.15, `${body}: ${a.top.toFixed(0)} m/s at 30 m (about ${low.toFixed(0)}; it was 143)`);
    assert.ok(a.stop < 150, `${body}: X stops it in ${a.stop.toFixed(0)} m (${a.seconds.toFixed(1)} s) from that pace`);
    assert.equal(a.bounces, 0, body + ': no bump');
  }
  const high = cruise('mars', 250);
  assert.ok(high.speedScale > 2.2, `mars: at 250 m the pace has opened up (${high.speedScale.toFixed(2)})`);
  assert.ok(high.top > low * 2, `mars: ${high.top.toFixed(0)} m/s at 250 m: height buys speed`);
  // Worlds with air to fly in are untouched: Earth's pace is 1 at any height, Venus' thick air
  // is slower than Earth's low down and no faster with height.
  const earth = cruise('earth', 30), venus = cruise('venus', 30);
  assert.ok(Math.abs(earth.speedScale - 1) < 0.02, `earth: pace ${earth.speedScale.toFixed(2)}`);
  assert.ok(earth.top < SHIP.speedGround * 1.15, `earth: ${earth.top.toFixed(0)} m/s at 30 m`);
  assert.ok(venus.speedScale < 0.8, `venus: pace ${venus.speedScale.toFixed(2)}`);
});
