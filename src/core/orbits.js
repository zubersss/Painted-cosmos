// Orbital math: where every body is, how it is turned, and what time it is where you stand.
// Pure (no three). "Universe" frame: the sun sits at the origin, the planets orbit in the XZ
// plane, +Y is ecliptic north, metres, seconds. All values are JS doubles.
import { V, add, sub, norm, dot, cross, scale, qFromAxisAngle, qMul, qConj, qRotate, wrapAngle } from './vec.js';

const TAU = Math.PI * 2;

export class Ephemeris {
  // bodies: the BODIES table from src/data/bodies.js (or any table of the same shape).
  constructor(bodies) {
    this.bodies = bodies;
    this.ids = Object.keys(bodies);
    this.spinPhase = {};            // extra spin angle per body (radians), set at boot / by tests
    for (const id of this.ids) this.spinPhase[id] = bodies[id].spinPhase || 0;
    this._tilt = {};
    for (const id of this.ids) this._tilt[id] = qFromAxisAngle(V(1, 0, 0), bodies[id].axialTilt || 0);
  }

  body(id) {
    const b = this.bodies[id];
    if (!b) throw new Error('unknown body id: ' + id);
    return b;
  }

  // Position of the body centre in the universe frame at time t.
  position(id, t) {
    const b = this.body(id);
    const a = b.orbitPhase + (TAU * t) / b.orbitPeriod;
    // Counter-clockwise seen from +Y (north), the same sense as the spin.
    const p = V(Math.sin(a) * b.orbitRadius, 0, Math.cos(a) * b.orbitRadius);
    return b.parent ? add(this.position(b.parent, t), p) : p;
  }

  velocity(id, t) {
    const b = this.body(id);
    const w = TAU / b.orbitPeriod;
    const a = b.orbitPhase + w * t;
    const v = V(Math.cos(a) * b.orbitRadius * w, 0, -Math.sin(a) * b.orbitRadius * w);
    return b.parent ? add(this.velocity(b.parent, t), v) : v;
  }

  spinAngle(id, t) {
    const b = this.body(id);
    return this.spinPhase[id] + (TAU * t) / b.dayLength;
  }

  // Orientation of the body-local frame (+Y north pole) in the universe frame.
  orientation(id, t) {
    return qMul(this._tilt[id], qFromAxisAngle(V(0, 1, 0), this.spinAngle(id, t)));
  }

  // Angular velocity vector of the body in the universe frame (rad/s).
  angularVelocity(id) {
    const b = this.body(id);
    return scale(qRotate(this._tilt[id], V(0, 1, 0)), TAU / b.dayLength);
  }

  // Unit direction from the body centre to the sun, in body-local coordinates.
  sunDirLocal(id, t) {
    const toSun = norm(scale(this.position(id, t), -1));
    return qRotate(qConj(this.orientation(id, t)), toSun);
  }

  // Local solar time in hours [0, 24) at body-local unit direction `dir`: 6 sunrise, 12 noon,
  // 18 sunset. At the poles the hour angle of the meridian is still well defined.
  localSolarTime(id, t, dir) {
    const s = this.sunDirLocal(id, t);
    const h = wrapAngle(Math.atan2(dir.x, dir.z) - Math.atan2(s.x, s.z));
    let hours = 12 + (h * 12) / Math.PI;
    hours %= 24;
    if (hours < 0) hours += 24;
    return hours;
  }

  // Sine of the sun's elevation above the local horizon at body-local `dir`.
  sunElevationSin(id, t, dir) {
    return dot(this.sunDirLocal(id, t), dir);
  }

  // Choose the spin phase so that the local solar time at `dir` equals `hours` at time t.
  setLocalSolarTime(id, t, dir, hours) {
    const now = this.localSolarTime(id, t, dir);
    let d = hours - now;
    if (d > 12) d -= 24;
    if (d < -12) d += 24;
    this.spinPhase[id] += (d * Math.PI) / 12;
  }

  // Radius of the sphere of influence used for choosing the flight frame (see frames.js).
  soiRadius(id) {
    const b = this.body(id);
    return b.soiRadius || b.radius * 4;
  }

  // Nearest body by distance to its surface. Returns { id, distance (to centre), altitude }.
  nearest(P, t) {
    let best = null;
    for (const id of this.ids) {
      const d = Math.hypot(...Object.values(sub(P, this.position(id, t))));
      const alt = d - this.bodies[id].radius;
      if (!best || alt < best.altitude) best = { id, distance: d, altitude: alt };
    }
    return best;
  }
}

// Height above the base radius where flight stops being "in the atmosphere" and becomes space.
// Airless bodies still get a thin near-surface zone so that landing logic has room to work.
export function spaceAltitude(body) {
  return Math.max(body.atmosphereHeight || 0, body.radius * 0.12);
}

export { cross as _cross };
