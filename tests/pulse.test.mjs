// Pulse drive and travel between worlds, in the pure simulation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/core/sim.js';
import { S } from '../src/core/state.js';
import { BODIES, spaceAltitude, soiRadius } from '../src/data/bodies.js';
import { PULSE, arrivalRadius, pulseAdvice, createPulse, stepPulseSpeed, pulseEta } from '../src/ship/pulse.js';
import { stubSurface, stubSpawn } from '../src/core/stubs/surface.js';
import { Pad, play, V, sub, norm, flyTo } from './helpers.mjs';
import { qLook } from '../src/core/vec.js';

const newSim = (opts = {}) => new Sim({ sampleSurface: stubSurface, getSpawn: (id) => stubSpawn(id).unitDir, ...opts });

test('arrival spheres sit inside each sphere of influence and above the atmosphere', () => {
  for (const b of Object.values(BODIES)) {
    assert.ok(arrivalRadius(b) < soiRadius(b) * 0.9, b.id);
    assert.ok(arrivalRadius(b) > b.radius + spaceAltitude(b) * 2, b.id);
  }
});

test('pulse advice: free in open space, brakes for what is ahead, refuses to dive into a body', () => {
  const p = V(0, 0, 0), f = V(0, 0, -1);
  assert.equal(pulseAdvice(p, f, []).vWant, PULSE.speed);
  // A sphere far ahead: full speed. Close ahead: limited. On the line but behind: ignored.
  const far = [{ id: 'a', c: V(0, 0, -5e6), radius: 9000 }];
  assert.equal(pulseAdvice(p, f, far).vWant, PULSE.speed);
  const near = [{ id: 'a', c: V(0, 0, -60e3), radius: 9000 }];
  const adv = pulseAdvice(p, f, near);
  assert.equal(adv.block, 'a');
  assert.ok(adv.vWant < PULSE.speed && adv.vWant > PULSE.exitSpeed);
  assert.equal(pulseAdvice(p, f, [{ id: 'a', c: V(0, 0, 60e3), radius: 9000 }]).vWant, PULSE.speed);
  // Off to the side: the line of flight misses it.
  assert.equal(pulseAdvice(p, f, [{ id: 'a', c: V(20e3, 0, -60e3), radius: 9000 }]).block, null);
  // Inside a sphere: allowed outward, refused inward.
  assert.equal(pulseAdvice(p, f, [{ id: 'a', c: V(0, 0, 3000), radius: 9000 }]).inside, null);
  assert.equal(pulseAdvice(p, f, [{ id: 'a', c: V(0, 0, -3000), radius: 9000 }]).inside, 'a');
});

test('a pulse hop accelerates smoothly and is back at cruise speed exactly at the arrival sphere', () => {
  const f = V(0, 0, -1);
  const spheres = [{ id: 'mars', c: V(0, 0, -300e3), radius: 6600 }];
  let p = V(0, 0, 0);
  const ps = createPulse(700);
  let t = 0, vMax = 0, aMax = 0, jerkMax = 0, prevA = 0;
  const dt = 1 / 60;
  for (; t < 400; t += dt) {
    const adv = pulseAdvice(p, f, spheres);
    stepPulseSpeed(ps, adv.vWant, dt);
    p = V(0, 0, p.z - ps.v * dt);
    vMax = Math.max(vMax, ps.v); aMax = Math.max(aMax, Math.abs(ps.a));
    jerkMax = Math.max(jerkMax, Math.abs(ps.a - prevA) / dt); prevA = ps.a;
    const left = -p.z > 0 ? 300e3 - 6600 - (-p.z) : 0;
    if (left <= 0) break;
  }
  assert.ok(t < 60, 'the hop takes under a minute: ' + t.toFixed(1));
  assert.ok(t > 15, 'and is not instant: ' + t.toFixed(1));
  assert.ok(vMax > 5000, 'pulse speed ' + vMax.toFixed(0));
  assert.ok(aMax <= PULSE.accel + 1e-6);
  assert.ok(ps.v < PULSE.exitSpeed * 1.25, 'arrives at about cruise speed: ' + ps.v.toFixed(0));
  assert.ok(jerkMax < PULSE.accel * 9, 'no snap: jerk ' + jerkMax.toFixed(0));
  assert.ok(Math.abs(pulseEta(300e3 - 6600) - t) < t * 0.5, 'the estimate is in the right range');
});

test('earth to mars to saturn in one sitting: lift off, pulse, land, step out, twice', () => {
  const sim = newSim();
  const pad = new Pad();
  const log = [];
  play(sim, pad, 0.5);
  flyTo(sim, pad, 'mars', log);
  flyTo(sim, pad, 'saturn', log);
  assert.deepEqual(Object.keys(sim.visited).sort(), ['earth', 'mars', 'saturn']);
  assert.ok(sim.sm.history.filter((s) => s === S.PULSE).length >= 2 || sim.sm.history.length >= 200);
  for (const leg of log) {
    assert.ok(leg.pulseSeconds > 10 && leg.pulseSeconds < 150, `${leg.to}: ${leg.km} km in ${leg.pulseSeconds} s`);
    assert.ok(leg.vMax > 3000, `${leg.to}: pulse speed ${leg.vMax}`);
  }
  console.log('      trip log:', JSON.stringify(log), 'game time', sim.t.toFixed(0), 's');
});

test('the drive refuses to dive at the planet below and says why; F again drops out', () => {
  const sim = newSim();
  const pad = new Pad();
  sim.teleport({ body: 'earth', ship: true, altitude: 3000, pitchDeg: -70 });
  play(sim, pad, 0.5);
  pad.tap('KeyF');
  play(sim, pad, 0.2);
  assert.equal(sim.sm.state, S.SPACE, 'no pulse toward the ground');
  assert.match(sim.notice.text, /Earth/);
  // Level out, point away: now it goes.
  sim.teleport({ body: 'earth', ship: true, altitude: 3000, pitchDeg: 30 });
  play(sim, pad, 0.5);
  pad.tap('KeyF');
  play(sim, pad, 3);
  assert.equal(sim.sm.state, S.PULSE);
  assert.ok(sim.sh.speed > 700, 'accelerating: ' + sim.sh.speed.toFixed(0));
  pad.tap('KeyF');
  play(sim, pad, 30, { until: () => sim.sm.state === S.SPACE });
  assert.equal(sim.sm.state, S.SPACE, 'dropped out on request');
  assert.ok(sim.sh.speed < PULSE.exitSpeed * 1.2);
});

test('aiming picks the target; a target chosen on the map stays chosen', () => {
  const sim = newSim();
  const pad = new Pad();
  sim.teleport({ body: 'earth', ship: true, altitude: 6000 });
  play(sim, pad, 0.2);
  // Put the nose on the moon (wherever it is in the sky right now).
  sim.sh.q = qLook(norm(sub(sim.bodyInShipFrame('moon'), sim.sh.p)), norm(sim.sh.p));
  play(sim, pad, 0.1);
  assert.equal(sim.aimed, 'moon');
  assert.equal(sim.target, 'moon');
  assert.ok(sim.targetInfo().distance > 15e3);
  sim.setTarget('jupiter');
  play(sim, pad, 1);
  assert.equal(sim.target, 'jupiter', 'the map choice holds while the nose is on the moon');
  assert.equal(sim.aimed, 'moon');
});
