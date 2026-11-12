// Orbital math: where every body is, how it is turned, and what time it is where you stand.
// Pure (no three). "Universe" frame: the sun sits at the origin, the planets orbit in the XZ
// plane, +Y is ecliptic north, metres, seconds. All values are JS doubles.
import { V, add, sub, len, norm, dot, scale, qFromAxisAngle, qMul, qConj, qRotate, wrapAngle } from './vec.js';
import { spaceAltitude, soiRadius } from '../data/bodies.js';

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

  // The hour as the world paints it at body-local unit direction `dir` (src/world/index.js,
  // `lighting.hours` and `sunForHours`): 6 the sun on the horizon in the east, 12 at its highest,
  // 18 on the horizon in the west, 0 at its lowest. localSolarTime above is the hour angle, which
  // agrees with it only on the equator or at an equinox: on Earth's spawn (36 degrees north, in
  // winter at t = 0) the hour angle's 6 and 18 have the sun 13 degrees below the horizon, and on
  // Neptune's its 10 is sunrise. Every hour PILOT sets (the first morning, teleport, setHour) and the
  // mood's timeOfDay are this one, so "hour 10" is the same light on every world.
  sunHour(id, t, dir) {
    return sunHourAt(this.sunDirLocal(id, t), norm(dir));
  }

  // Choose the spin phase so that sunHour at `dir` equals `hours` at time t. Where the sun never
  // sets or never rises the world's hour does not reach every value: the nearest it comes is
  // taken. Where an hour comes twice in a turn (a polar day), the one nearer the same hour angle.
  setSunHour(id, t, dir, hours) {
    const d = norm(dir), base = this.spinPhase[id], N = 720;
    const at = (phi) => { this.spinPhase[id] = phi; return wrapHours(this.sunHour(id, t, d) - hours); };
    const errs = [];
    for (let k = 0; k < N; k++) errs.push(Math.abs(at(base + (k * TAU) / N)));
    let best = 0;
    for (let k = 1; k < N; k++) if (errs[k] < errs[best]) best = k;
    // every local minimum as good as the best (to a quarter of an hour) is a candidate
    const cands = [];
    for (let k = 0; k < N; k++) {
      const a = errs[(k + N - 1) % N], b = errs[(k + 1) % N];
      if (errs[k] <= a && errs[k] <= b && errs[k] < errs[best] + 0.25) cands.push(k);
    }
    let pick = best, pickBy = Infinity;
    for (const k of cands) {
      this.spinPhase[id] = base + (k * TAU) / N;
      const by = Math.abs(wrapHours(this.localSolarTime(id, t, d) - hours));
      if (by < pickBy) { pickBy = by; pick = k; }
    }
    // refine inside the two grid steps round the pick (the hour is smooth there)
    let lo = base + ((pick - 1) * TAU) / N, hi = base + ((pick + 1) * TAU) / N;
    for (let i = 0; i < 40; i++) {
      const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
      if (Math.abs(at(m1)) <= Math.abs(at(m2))) hi = m2; else lo = m1;
    }
    this.spinPhase[id] = wrapAngle((lo + hi) / 2);
  }

  // Radius of the sphere of influence used for choosing the flight frame (see frames.js).
  soiRadius(id) { return soiRadius(this.body(id)); }

  // Nearest body by distance to its surface. Returns { id, distance (to centre), altitude }.
  nearest(P, t) {
    let best = null;
    for (const id of this.ids) {
      const d = len(sub(P, this.position(id, t)));
      const alt = d - this.bodies[id].radius;
      if (!best || alt < best.altitude) best = { id, distance: d, altitude: alt };
    }
    return best;
  }
}

// Hours in (-12, 12].
function wrapHours(h) {
  h %= 24;
  if (h > 12) h -= 24;
  if (h <= -12) h += 24;
  return h;
}

// The world's hour from the sun's body-local direction `s` at body-local unit direction `d`
// (src/world/index.js: east = Y x up, the elevation is s . up).
export function sunHourAt(s, d) {
  let ex = d.z, ez = -d.x;
  const el = Math.hypot(ex, ez);
  if (el < 1e-6) { ex = 1; ez = 0; } else { ex /= el; ez /= el; }
  const se = s.x * ex + s.z * ez, e = s.x * d.x + s.y * d.y + s.z * d.z;
  let h = 12 + (Math.atan2(-se, e) * 12) / Math.PI;
  h %= 24;
  if (h < 0) h += 24;
  return h;
}

export { spaceAltitude };
