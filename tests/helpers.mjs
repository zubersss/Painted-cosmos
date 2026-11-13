// Synthetic worlds for testing the controllers without three or a browser.
import { V, norm, dot, sub, scale, len } from '../src/core/vec.js';

// A smooth sphere of radius R with optional features, behind the sampleSurface contract.
//   sea:   radius of a liquid shell (0 = none)
//   bowl:  { dir, radius (m), depth (m) }   a round basin
//   hill:  { dir, radius (m), height (m) }  a cone with straight sides (slope = atan(height/radius))
export function makeWorld({ R = 4000, sea = 0, bowl = null, hill = null } = {}) {
  const height = (d) => {
    let h = 0;
    if (bowl) {
      const a = Math.acos(Math.min(1, dot(d, bowl.dir))) * R;
      if (a < bowl.radius) h -= bowl.depth * (1 - (a / bowl.radius) ** 2);
    }
    if (hill) {
      const a = Math.acos(Math.min(1, dot(d, hill.dir))) * R;
      if (a < hill.radius) h += hill.height * (1 - a / hill.radius);
    }
    return h;
  };
  return (dirIn) => {
    const d = norm(dirIn);
    const h = height(d);
    // numeric normal
    const a = norm(Math.abs(d.y) < 0.9 ? { x: -d.z, y: 0, z: d.x } : { x: 0, y: d.z, z: -d.y });
    const b = { x: d.y * a.z - d.z * a.y, y: d.z * a.x - d.x * a.z, z: d.x * a.y - d.y * a.x };
    const e = 0.2 / R;
    const ha = (height(norm({ x: d.x + a.x * e, y: d.y + a.y * e, z: d.z + a.z * e })) - height(norm({ x: d.x - a.x * e, y: d.y - a.y * e, z: d.z - a.z * e }))) / (2 * e * R);
    const hb = (height(norm({ x: d.x + b.x * e, y: d.y + b.y * e, z: d.z + b.z * e })) - height(norm({ x: d.x - b.x * e, y: d.y - b.y * e, z: d.z - b.z * e }))) / (2 * e * R);
    const n = norm({ x: d.x - a.x * ha - b.x * hb, y: d.y - a.y * ha - b.y * hb, z: d.z - a.z * ha - b.z * hb });
    const radius = R + h;
    return {
      radius, normal: n, slope: Math.acos(Math.min(1, dot(n, d))), liquidRadius: sea,
      isLiquid: sea > radius, biomeId: 'test', biomeWeights: { test: 1 },
    };
  };
}

export const arc = (a, b, R) => Math.acos(Math.min(1, dot(norm(a), norm(b)))) * R;
export { V, norm, dot, sub, scale, len };

// A scripted player for the pure simulation: holds keys, moves the mouse.
export class Pad {
  constructor() { this.keys = new Set(); this.edges = new Set(); this.dx = 0; this.dy = 0; this.wheel = 0; }
  down(c) { return this.keys.has(c); }
  axis(n, p) { return (this.keys.has(p) ? 1 : 0) - (this.keys.has(n) ? 1 : 0); }
  press(c) { if (!this.keys.has(c)) { this.keys.add(c); this.edges.add(c); } }
  release(c) { this.keys.delete(c); }
  releaseAll() { this.keys.clear(); }
  tap(c) { this.edges.add(c); }
  take() {
    const o = { edges: this.edges, dx: this.dx, dy: this.dy, wheel: this.wheel };
    this.edges = new Set(); this.dx = 0; this.dy = 0; this.wheel = 0;
    return o;
  }
}

// Advance the simulation at 60 fps for `seconds` (or until `until()` is true). `each` runs
// before every frame and may steer. Returns the seconds actually simulated.
export function play(sim, pad, seconds, { each, until, fps = 60 } = {}) {
  const dt = 1 / fps;
  const n = Math.round(seconds * fps);
  for (let i = 0; i < n; i++) {
    if (each) each(i * dt);
    sim.frame(dt, pad, pad.take());
    sim.lastView = sim.view(dt);
    if (until && until()) return (i + 1) * dt;
  }
  return n * dt;
}

// ---- a whole leg of a journey, played with keys and mouse through the pure simulation ---------
import assert from 'node:assert/strict';
import { FEEL } from '../src/core/sim.js';
import { S } from '../src/core/state.js';
import { BODIES, spaceAltitude } from '../src/data/bodies.js';
import { arrivalRadius } from '../src/ship/pulse.js';

const RAD = Math.PI / 180;
export const holdPitch = (sim, pad, deg) => {
  const err = deg - sim.info().ship.pitchDeg;
  pad.dy -= Math.max(-40, Math.min(40, (err * RAD / FEEL.mouseShip) * 0.12));
};
// Turn the nose toward a body with the mouse (as a player would, watching the marker).
export const aimAt = (sim, pad, id) => {
  const a = sim.aimAt(id);
  pad.dx += Math.max(-60, Math.min(60, a.yawDeg * RAD / FEEL.mouseShip * 0.12));
  pad.dy -= Math.max(-60, Math.min(60, a.pitchDeg * RAD / FEEL.mouseShip * 0.12));
};

// Fly one leg: from parked or landed on `from`, to standing on `to`.
export function flyTo(sim, pad, to, log) {
  if (sim.sm.state === S.ON_FOOT) {
    pad.dx += (sim.info().shipBearingDeg * RAD) / FEEL.mouseFoot;
    pad.press('KeyW');
    play(sim, pad, 30, { until: () => sim.info().canBoard });
    pad.release('KeyW');
    pad.tap('KeyE');
    play(sim, pad, 4, { until: () => sim.sm.state === S.LANDED });
  }
  assert.equal(sim.sm.state, S.LANDED);
  pad.tap('Space');
  play(sim, pad, 4);
  pad.press('KeyW');
  play(sim, pad, 120, { each: () => holdPitch(sim, pad, 55), until: () => sim.sm.state === S.SPACE });
  assert.equal(sim.sm.state, S.SPACE, 'reached space');
  // Climb clear of the planet, pick the target on the map, point at it, pulse.
  play(sim, pad, 60, { each: () => holdPitch(sim, pad, 55), until: () => sim.info().ship.altitude > 3 * spaceAltitude(BODIES[sim.shFrame.id]) });
  pad.release('KeyW');
  sim.setTarget(to);
  play(sim, pad, 12, { each: () => aimAt(sim, pad, to), until: () => Math.abs(sim.aimAt(to).yawDeg) < 4 && Math.abs(sim.aimAt(to).pitchDeg) < 4 });
  assert.equal(sim.promptNow.text, 'Pulse to ' + BODIES[to].name);
  const d0 = sim.targetInfo().distance;
  pad.tap('KeyF');
  play(sim, pad, 0.2);
  assert.equal(sim.sm.state, S.PULSE, 'pulse engaged: ' + (sim.notice && sim.notice.text));
  let vMax = 0;
  const tPulse = play(sim, pad, 300, { each: () => { vMax = Math.max(vMax, sim.sh.speed); }, until: () => sim.sm.state === S.SPACE });
  assert.equal(sim.sm.state, S.SPACE, 'dropped out of pulse');
  // (The distance to the world flown to, not to the target of the moment: inside the world's
  // frame the course is dropped, and whatever lies near the nose then becomes the target.)
  const d1 = len(sub(sim.bodyInShipFrame(to), sim.sh.p));
  assert.ok(d1 < arrivalRadius(BODIES[to]) * 1.25, `arrived at ${to}: ${(d1 / 1000).toFixed(1)} km from its centre`);
  assert.ok(d1 > BODIES[to].radius + spaceAltitude(BODIES[to]), 'still in space');
  log.push({ to, km: Math.round(d0 / 1000), pulseSeconds: +tPulse.toFixed(1), vMax: Math.round(vMax) });
  // Coast in, descend, land.
  play(sim, pad, 12);
  assert.equal(sim.info().frame, to + ':orbit', 'flying in the frame of ' + to);
  assert.ok(sim.sh.speed < 60, 'coasted to a near stop: ' + sim.sh.speed.toFixed(0));
  pad.press('KeyW');
  play(sim, pad, 1.5);
  pad.release('KeyW');
  play(sim, pad, 240, { each: () => holdPitch(sim, pad, -60), until: () => sim.sm.state === S.ATMOSPHERE });
  assert.equal(sim.sm.state, S.ATMOSPHERE, 'entered the atmosphere of ' + to);
  play(sim, pad, 240, { each: () => holdPitch(sim, pad, -35), until: () => sim.sh.altGround < 170 });
  pad.press('KeyS');
  play(sim, pad, 240, {
    each: () => { holdPitch(sim, pad, sim.sh.altGround > 110 ? -18 : -7); if (sim.sh.throttle < 0.25) pad.release('KeyS'); },
    until: () => sim.info().ship.canLand,
  });
  pad.release('KeyS');
  assert.ok(sim.info().ship.canLand, 'landing prompt over ' + to);
  pad.tap('KeyE');
  play(sim, pad, 90, { until: () => sim.sm.state === S.LANDED });
  assert.equal(sim.sm.state, S.LANDED, 'landed on ' + to);
  assert.equal(sim.sh.bounces, 0);
  pad.tap('KeyE');
  play(sim, pad, 4, { until: () => sim.sm.state === S.ON_FOOT });
  assert.equal(sim.sm.state, S.ON_FOOT);
  assert.equal(sim.bodyId, to);
  pad.press('KeyW');
  play(sim, pad, 2);
  pad.release('KeyW');
  assert.ok(sim.visited[to] && Object.keys(sim.visited[to].biomes).length >= 1, 'the sketchbook has ' + to);
}

