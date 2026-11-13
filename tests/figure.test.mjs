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

// ---- M4: PHYSICS' body state reaches the figure, in the figure's own axes ---------------------
test('M4 the figure is handed the lean, the wind past it, the gale\'s crouch and a wall, in its own axes', () => {
  // The body faces -Z on top of the world (+Y up): its right hand is +X.
  const ex = {
    mode: 'walk', speed: 4, jet01: 0, grounded: true, swimming: false, altitude: 0, airTime: 0,
    p: { x: 0, y: 1000, z: 0 }, fwd: { x: 0, y: 0, z: -1 }, v: { x: 0, y: 0, z: -4 },
    phys: {
      ride: 0, leanV: { x: 0.1, y: 0, z: -0.3 }, lean: Math.hypot(0.1, 0.3), hunker01: 0.4,
      relWind: { x: -6, y: 1, z: 20 }, relWindSpeed: Math.hypot(6, 1, 20), windBrace: 800,
      swim: 0, stroke: 0.25, strokeRate: 0, swimSpeed: 0, submerged01: 0, arc: 0, vUp: 0.2, airTime: 0, wall: 1, slip01: 0.5,
    },
  };
  const a = figureArgs(ex, 0, {}, { density: 1.2, gust01: 0.3 });
  assert.ok(Math.abs(a.leanFwd - 0.3) < 1e-12, 'the top of the body tips forward ' + a.leanFwd);
  assert.ok(Math.abs(a.leanRight - 0.1) < 1e-12, 'and to its right ' + a.leanRight);
  assert.ok(Math.abs(a.lean - Math.hypot(0.1, 0.3)) < 1e-12);
  assert.equal(a.hunker01, 0.4);
  assert.ok(Math.abs(a.windFwd + 20) < 1e-12, 'a headwind is air going backward past the body: ' + a.windFwd);
  assert.ok(Math.abs(a.windRight + 6) < 1e-12 && Math.abs(a.windUp - 1) < 1e-12);
  assert.ok(Math.abs(a.windSpeed - Math.hypot(6, 1, 20)) < 1e-9);
  assert.equal(a.windLoad01, 1, 'flat out past 15 m/s in Earth\'s air');
  assert.equal(a.gust01, 0.3); assert.equal(a.windBrace, 800);
  assert.equal(a.wall, 1); assert.equal(a.slip01, 0.5); assert.equal(a.vUp, 0.2);
  // Thin air carries less: the same 21 m/s in Mars' air hardly lifts a scarf.
  assert.ok(figureArgs(ex, 0, {}, { density: 0.015 }).windLoad01 < 0.05);
  // Turned a quarter to its left (facing -X, its right hand toward -Z), the same lean is to its right and a little back.
  const b = figureArgs({ ...ex, fwd: { x: -1, y: 0, z: 0 } }, 0);
  assert.ok(Math.abs(b.leanFwd + 0.1) < 1e-12 && Math.abs(b.leanRight - 0.3) < 1e-12, `${b.leanFwd} ${b.leanRight}`);
  // Nothing from PHYSICS, or rubbish: plain zeros, never NaN.
  const c = figureArgs({ ...ex, phys: { leanV: { x: NaN, y: 0, z: 0 }, relWind: null, hunker01: 7, stroke: NaN } }, 0);
  for (const k of ['leanFwd', 'leanRight', 'lean', 'windFwd', 'windRight', 'windUp', 'windSpeed', 'windLoad01', 'gust01', 'stroke', 'strokeRate', 'vUp', 'airTime', 'slip01']) assert.ok(Number.isFinite(c[k]), k + ' ' + c[k]);
  assert.equal(c.hunker01, 1);
});

test('M4 with PHYSICS: a run leans into its own wind, a jump rises then falls, the air past the body is its own motion', { skip }, () => {
  const sim = newSim(), pad = new Pad(), a = {};
  play(sim, pad, 0.6);
  pad.press('KeyW'); pad.press('ShiftLeft');
  play(sim, pad, 3);
  figureArgs(sim.ex, 0, a, sim.physics.here && sim.physics.here.air);
  // (the stub ground's weather at seed 1 blows about 4 m/s in the runner's face on top of the run's own 7.4)
  const still = sim.ex.speed;
  assert.ok(a.windFwd < -still * 0.7 && a.windFwd > -still - 12, 'the air goes past a runner backward: ' + a.windFwd.toFixed(2) + ' m/s at a run of ' + still.toFixed(2));
  assert.ok(a.leanFwd > 0.005 && a.leanFwd < 0.3, 'and the runner leans forward into it: ' + a.leanFwd.toFixed(3) + ' rad');
  assert.ok(Math.abs(a.lean - sim.ex.phys.lean) < 1e-6, 'the lean\'s size is PHYSICS\' own: ' + a.lean + ' ' + sim.ex.phys.lean);
  assert.equal(a.arc, 0); assert.equal(a.swim, 0);
  pad.releaseAll();
  play(sim, pad, 1.5);
  pad.tap('Space');
  const arcs = [];
  let top = 0;
  play(sim, pad, 2.5, { each: () => { figureArgs(sim.ex, 0, a); arcs.push(a.arc); top = Math.max(top, a.airTime); assert.ok(a.arc === 0 || Math.sign(a.vUp) === a.arc || a.vUp === 0, `arc ${a.arc} with vUp ${a.vUp}`); } });
  const seq = arcs.filter((x, i) => i === 0 || x !== arcs[i - 1]).join(',');
  assert.match(seq, /^0,1,-1,0$/, 'standing, rising, falling, standing: ' + seq);
  assert.ok(top > 0.4 && top < 2, 'air time counted: ' + top.toFixed(2) + ' s');
});

test('M4 afloat the mode is swim and the stroke turns over; in the shallows it is wade', { skip }, () => {
  const sea = (id, d) => { const s = stubSurface(id, d); return { ...s, liquidRadius: s.radius + 6, isLiquid: true }; };
  const physics = P.createPhysics({ sampleSurface: sea, seed: 1 });
  const sim = new Sim({ sampleSurface: sea, getSpawn: (id) => stubSpawn(id).unitDir, physics });
  const pad = new Pad(), a = {};
  play(sim, pad, 4);
  figureArgs(sim.ex, 0, a);
  assert.equal(sim.ex.mode, 'swim', 'afloat: ' + sim.ex.mode);
  assert.equal(a.mode, 'swim'); assert.equal(a.swim, 1);
  assert.ok(a.submerged01 > 0.4, 'most of the body under: ' + a.submerged01.toFixed(2));
  assert.ok(Math.abs(a.strokeRate - 0.625) < 0.2, 'treading water: ' + a.strokeRate.toFixed(3) + ' cycles a second');
  assert.equal(a.arc, 0, 'afloat is not a flight');
  pad.press('KeyW');
  play(sim, pad, 3);
  const phases = [];
  play(sim, pad, 3, { each: () => { figureArgs(sim.ex, 0, a); phases.push(a.stroke); } });
  assert.ok(a.swimSpeed > 1 && a.strokeRate > 0.7, `swimming ${a.swimSpeed.toFixed(2)} m/s at ${a.strokeRate.toFixed(2)} strokes a second`);
  let wraps = 0;
  for (let i = 1; i < phases.length; i++) { assert.ok(phases[i] >= 0 && phases[i] < 1); if (phases[i] < phases[i - 1]) wraps++; }
  assert.ok(wraps >= 2 && wraps <= 6, 'the stroke turned over ' + wraps + ' times in 3 s');
  // Knee-deep: wading, feet on the bed.
  const shallow = (id, d) => { const s = stubSurface(id, d); return { ...s, liquidRadius: s.radius + 0.6, isLiquid: true }; };
  const sim2 = new Sim({ sampleSurface: shallow, getSpawn: (id) => stubSpawn(id).unitDir, physics: P.createPhysics({ sampleSurface: shallow, seed: 1 }) });
  play(sim2, pad, 3);
  assert.equal(sim2.ex.mode, 'wade', 'knee-deep: ' + sim2.ex.mode);
  assert.equal(figureArgs(sim2.ex, 0).swim, 0);
});

test('M4 without PHYSICS a swimmer is still a swimmer', () => {
  const sea = (id, d) => { const s = stubSurface(id, d); return { ...s, liquidRadius: s.radius + 6, isLiquid: true }; };
  const sim = new Sim({ sampleSurface: sea, getSpawn: (id) => stubSpawn(id).unitDir });
  play(sim, new Pad(), 3);
  const a = figureArgs(sim.ex, 0);
  assert.equal(sim.ex.mode, 'swim'); assert.equal(a.swim, 1); assert.equal(a.arc, 0); assert.equal(a.stroke, 0);
});

test('the drawn hull takes pitch, roll and yaw from the buffet, clamped', () => {
  const t = hullTrim({ pitch: 0.02, roll: -0.5, yaw: 0.05 });
  assert.equal(t.pitch, 0.02); assert.equal(t.roll, -HULL_TRIM_MAX); assert.equal(t.yaw, 0.05);
  const z = hullTrim(null);
  assert.equal(z.pitch + z.roll + z.yaw, 0);
  assert.equal(hullTrim({ pitch: NaN }).pitch, 0);
});
