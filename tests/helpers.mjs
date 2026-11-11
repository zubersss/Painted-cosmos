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
