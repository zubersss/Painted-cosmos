// A ship at rest on water floats (the coordinator's ruling, 2026-11-12): it heaves and pitches with
// the drawn sea (PHYSICS' env.waterLevel), averaged over the hull; and a swimmer's view follows the
// swell's mean. A model sea stands in for PHYSICS' here: a wave train along the hull.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/core/sim.js';
import { stubSurface, stubSpawn } from '../src/core/stubs/surface.js';
import { V, norm, len, dot, sub, qRotate } from '../src/core/vec.js';

// The sim with a model sea: w(p) = A sin(k x - w t), x along the hull from where it came to rest.
function afloat({ A, lambda, period }) {
  const sim = new Sim({ sampleSurface: stubSurface, getSpawn: (id) => stubSpawn(id).unitDir, body: 'earth' });
  const sea = { t: 0, p0: null, fwd: null };
  sim.physics = { bindEnv(id, env) { env.waterLevel = (p) => (sea.p0 ? A * Math.sin((2 * Math.PI / lambda) * dot(sub(p, sea.p0), sea.fwd) - (2 * Math.PI / period) * sea.t) : 0); return env; }, explorer: { step: null } };
  sim.sh.onLiquid = true; sim.sh.restQ = sim.sh.q;
  sea.p0 = sim.sh.p; sea.fwd = qRotate(sim.sh.q, V(0, 0, -1));
  return { sim, sea };
}
function ride(o, seconds, h = 1 / 60) {
  const { sim, sea } = o, up = norm(sim.sh.p), r0 = len(sim.sh.p);
  let hiZ = -Infinity, loZ = Infinity, hiP = -Infinity, loP = Infinity, agree = 0, n = 0;
  for (let t = 0; t < seconds; t += h) {
    sea.t = t; sim.stepAfloat(h);
    if (t < 3) continue;                                     // the hull takes up the sea
    const z = len(sim.sh.p) - r0, nose = qRotate(sim.sh.q, V(0, 0, -1)), pitch = Math.asin(Math.max(-1, Math.min(1, dot(nose, up))));
    hiZ = Math.max(hiZ, z); loZ = Math.min(loZ, z); hiP = Math.max(hiP, pitch); loP = Math.min(loP, pitch);
    // nose up when the water is higher at the bow than at the stern
    const bow = sim.explorerEnv('earth').waterLevel({ x: sea.p0.x + sea.fwd.x * 4, y: sea.p0.y + sea.fwd.y * 4, z: sea.p0.z + sea.fwd.z * 4 });
    const stern = sim.explorerEnv('earth').waterLevel({ x: sea.p0.x - sea.fwd.x * 4, y: sea.p0.y - sea.fwd.y * 4, z: sea.p0.z - sea.fwd.z * 4 });
    if (Math.abs(bow - stern) > 0.2 * Math.abs(sim.sh.float.pitch) + 0.05) { n++; if (Math.sign(bow - stern) === Math.sign(pitch)) agree++; }
  }
  return { heave: (hiZ - loZ) / 2, pitch: (hiP - loP) / 2, agree: n ? agree / n : 1 };
}

test('a ship landed on a long swell heaves with it and pitches nose up into a rising sea', () => {
  const r = ride(afloat({ A: 1, lambda: 60, period: 6.2 }), 20);
  assert.ok(r.heave > 0.6 && r.heave < 1.05, `heave ${r.heave.toFixed(2)} m on a 1 m swell`);
  assert.ok(r.pitch > 0.03 && r.pitch < 0.35, `pitch ${r.pitch.toFixed(3)} rad`);
  assert.ok(r.agree > 0.8, `pitch follows the sea's slope (${(r.agree * 100).toFixed(0)} % of frames)`);
});

test('waves shorter than the hull lift it little: the sea is averaged over its size', () => {
  const long = ride(afloat({ A: 0.5, lambda: 60, period: 6.2 }), 15), short = ride(afloat({ A: 0.5, lambda: 3, period: 1.4 }), 15);
  assert.ok(short.heave < 0.35 * long.heave, `3 m chop ${short.heave.toFixed(3)} m against a 60 m swell's ${long.heave.toFixed(3)} m`);
});

test('on a still sea the ship rests where it landed; lift-off forgets the float', () => {
  const o = afloat({ A: 0, lambda: 60, period: 6 });
  const p0 = o.sim.sh.p;
  ride(o, 5);
  assert.ok(len(sub(o.sim.sh.p, p0)) < 1e-9, 'not moved');
  assert.ok(o.sim.sh.float, 'afloat');
});

test('a swimmer\'s view follows the swell\'s mean, not each slap', () => {
  const sim = new Sim({ sampleSurface: stubSurface, getSpawn: (id) => stubSpawn(id).unitDir, body: 'earth' });
  const up = norm(sim.ex.p), r0 = len(sim.ex.p);
  sim.ex.swimming = true;
  let camHi = -Infinity, camLo = Infinity, bodyHi = -Infinity, bodyLo = Infinity;
  for (let t = 0; t < 12; t += 1 / 60) {
    const z = 0.3 * Math.sin(2 * Math.PI * t / 0.6);       // a slap every 0.6 s
    sim.ex.p = { x: up.x * (r0 + z), y: up.y * (r0 + z), z: up.z * (r0 + z) };
    const pose = sim.footPose(1 / 60);
    if (t < 3) continue;
    const c = dot(pose.p, up); camHi = Math.max(camHi, c); camLo = Math.min(camLo, c); bodyHi = Math.max(bodyHi, z); bodyLo = Math.min(bodyLo, z);
  }
  assert.ok(camHi - camLo < 0.4 * (bodyHi - bodyLo), `the view moves ${(camHi - camLo).toFixed(3)} m for the body's ${(bodyHi - bodyLo).toFixed(2)} m`);
});
