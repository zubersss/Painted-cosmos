// The figure steps with PHYSICS' gait (P13): what game.js hands the explorer model, the drawn
// hull's trim, footsteps from footfalls, the stroll, and the fold before a jump. Driven through
// PILOT's Sim with PHYSICS' real explorer on the stub ground. Skipped if src/physics cannot be
// imported (a file caught mid-edit).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/core/sim.js';
import { EXPLORER } from '../src/player/explorer.js';
import { figureArgs, hullTrim, hasFootfalls, footLoudness, HULL_TRIM_MAX } from '../src/player/figure.js';
import { stubSurface, stubSpawn } from '../src/core/stubs/surface.js';
import { Pad, play } from './helpers.mjs';

let P = null, why = '';
try { P = await import('../src/physics/index.js'); } catch (e) { why = String(e && e.message).slice(0, 120); }
const skip = P && P.createPhysics ? false : 'physics not importable: ' + why;
function newSim() {
  const physics = P.createPhysics({ sampleSurface: stubSurface, seed: 1 });
  return new Sim({ sampleSurface: stubSurface, getSpawn: (id) => stubSpawn(id).unitDir, physics });
}

test('the figure is handed the stride: hips that ride it, placed feet, the gait; the camera stays on the mean', { skip }, () => {
  const sim = newSim(), pad = new Pad();
  play(sim, pad, 0.6);
  pad.press('KeyW');
  play(sim, pad, 1.5);
  const rides = [], strides = [], camR = [], exR = [];
  const a = {};
  play(sim, pad, 2, { each: () => {
    figureArgs(sim.ex, sim.footCam.pitch, a);
    rides.push(a.hip); strides.push(a.stride);
    exR.push(sim.ex.altitude);                       // st.p over the ground under it
  } });
  figureArgs(sim.ex, sim.footCam.pitch, a);
  assert.equal(a.hip, sim.ex.phys.ride, 'hip carries ride (hip + the bob)');
  assert.equal(a.ride, sim.ex.phys.ride);
  assert.equal(a.gait, 2, 'the 4.2 m/s pace is a run by its gait');
  assert.ok(Array.isArray(a.feet) && a.feet.length === 2 && Number.isFinite(a.feet[0].fwd), 'two feet placed');
  assert.ok([0, 1, 2, 3].includes(a.footDown), 'footDown ' + a.footDown);
  const bob = Math.max(...rides) - Math.min(...rides);
  assert.ok(bob > 0.03 && bob < 0.2, `the hips rise and fall with the stride: ${(bob * 100).toFixed(1)} cm`);
  assert.ok(strides.every((s) => s >= 0 && s < 1) && new Set(strides.map((s) => Math.round(s * 10))).size >= 6, 'the stride turns over');
  // The explorer's place (and so the camera, which is set from it) does not carry the bob: its
  // height over the ground changes by a fraction of the hips' bob (the ground itself is a stub).
  const dr = Math.max(...exR) - Math.min(...exR);
  assert.ok(dr < bob * 0.5 + 0.02, `st.p does not bob with the hips: ${(dr * 100).toFixed(1)} cm against ${(bob * 100).toFixed(1)}`);
  // Standing still: no stride, both feet down.
  pad.release('KeyW');
  play(sim, pad, 2);
  figureArgs(sim.ex, 0, a);
  assert.equal(a.gait, 0, 'standing');
  assert.equal(a.footDown, 3, 'both feet down');
});

test('without PHYSICS the figure gets the old fields and the mixer keeps its own cadence', () => {
  const sim = new Sim({ sampleSurface: stubSurface, getSpawn: (id) => stubSpawn(id).unitDir });
  play(sim, new Pad(), 0.3);
  const a = figureArgs(sim.ex, 0.1);
  assert.equal(a.hip, 0); assert.equal(a.ride, 0); assert.equal(a.feet, null); assert.equal(a.footDown, 3);
  assert.equal(a.lookPitch, 0.1);
  assert.equal(hasFootfalls(sim.ex.phys), false);
});

test('footsteps come from footfalls: about three a second at the pace, loud by their force', { skip }, () => {
  const sim = newSim(), pad = new Pad();
  play(sim, pad, 0.6);
  assert.ok(hasFootfalls(sim.ex.phys), 'the body counts footfalls');
  pad.press('KeyW');
  play(sim, pad, 1.5);
  const n0 = sim.ex.phys.steps, louds = [];
  let seen = n0;
  play(sim, pad, 3, { each: () => {
    const ph = sim.ex.phys;
    if (ph.steps !== seen) { seen = ph.steps; louds.push(footLoudness(ph.footfall.force, 9.0)); }
  } });
  const rate = (sim.ex.phys.steps - n0) / 3;
  assert.ok(rate > 2.5 && rate < 3.5, `cadence at 4.2 m/s on Earth: ${rate.toFixed(2)} a second (PHYSICS: 3.0)`);
  assert.equal(louds.length, sim.ex.phys.steps - n0, 'one footfall at a time at 60 Hz');
  const mean = louds.reduce((s, x) => s + x, 0) / louds.length;
  assert.ok(mean > 0.85 && mean < 1.15, 'the pace sounds at about its own level: ' + mean.toFixed(2));
  // A stroll is softer, a run louder.
  assert.ok(footLoudness(1.3 * 900, 9) < 0.75 && footLoudness(3.6 * 900, 9) > 1.2, 'stroll soft, run loud');
  assert.ok(footLoudness(1e6, 9) <= 1.25 && footLoudness(0, 9) >= 0.5, 'bounded');
});

test('C strolls: a true walking gait under 2 m/s; C again for the pace; Shift still runs', { skip }, () => {
  const sim = newSim(), pad = new Pad();
  play(sim, pad, 0.6);
  pad.tap('KeyC');
  play(sim, pad, 0.1);
  assert.equal(sim.stroll, true);
  assert.match(sim.notice.text, /Strolling/);
  pad.press('KeyW');
  play(sim, pad, 2.5);
  assert.ok(Math.abs(sim.ex.speed - EXPLORER.strollSpeed) < 0.2, 'stroll ' + sim.ex.speed.toFixed(2));
  assert.equal(sim.ex.phys.gait, 1, 'a walk by its gait');
  pad.press('ShiftLeft');
  play(sim, pad, 2);
  assert.ok(sim.ex.speed > EXPLORER.walkSpeed + 1, 'Shift runs from a stroll: ' + sim.ex.speed.toFixed(2));
  pad.release('ShiftLeft');
  pad.tap('KeyC');
  play(sim, pad, 2);
  assert.equal(sim.stroll, false);
  assert.ok(Math.abs(sim.ex.speed - EXPLORER.walkSpeed) < 0.35, 'back to the pace: ' + sim.ex.speed.toFixed(2));
});

test('the fold before a jump: an eighth of a second from a stand, half that from a run', { skip }, () => {
  const leaveAfter = (keys) => {
    const sim = newSim(), pad = new Pad();
    play(sim, pad, 0.6);
    for (const k of keys) pad.press(k);
    play(sim, pad, keys.length ? 2 : 0.2);
    pad.tap('Space');
    let t = 0, left = null, crouched = 0;
    play(sim, pad, 1, { each: () => { t += 1 / 60; crouched = Math.max(crouched, sim.ex.phys.crouch01 || 0); if (left == null && !sim.ex.grounded) left = t; } });
    return { left, crouched };
  };
  const stand = leaveAfter([]), run = leaveAfter(['KeyW', 'ShiftLeft']);
  assert.ok(stand.left > EXPLORER.jumpCrouch - 0.02 && stand.left < EXPLORER.jumpCrouch + 0.05, 'from a stand the feet leave after ' + stand.left.toFixed(3) + ' s');
  assert.ok(stand.crouched > 0.6, 'and the legs fold (crouch01 ' + stand.crouched.toFixed(2) + ')');
  assert.ok(run.left > EXPLORER.jumpCrouchRun - 0.02 && run.left < EXPLORER.jumpCrouchRun + 0.05, 'from a run after ' + run.left.toFixed(3) + ' s');
});

test('the drawn hull takes pitch, roll and yaw from the buffet, clamped', () => {
  const t = hullTrim({ pitch: 0.02, roll: -0.5, yaw: 0.05 });
  assert.equal(t.pitch, 0.02); assert.equal(t.roll, -HULL_TRIM_MAX); assert.equal(t.yaw, 0.05);
  const z = hullTrim(null);
  assert.equal(z.pitch + z.roll + z.yaw, 0);
  assert.equal(hullTrim({ pitch: NaN }).pitch, 0);
});
