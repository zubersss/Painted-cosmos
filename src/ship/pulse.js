// The pulse drive: fast travel between worlds. Pure (no three).
//
// The ship accelerates hard along its nose, holds a speed far above cruise, and brakes by itself
// so that it arrives at cruise speed on the "arrival sphere" of whatever lies ahead: close
// enough that the planet fills the view, far enough to take it in. It cannot be flown into
// anything: every body (and the sun) is a sphere the drive will not enter.
import { sub, dot, len, clamp, damp } from '../core/vec.js';
import { spaceAltitude } from '../data/bodies.js';

export const PULSE = Object.freeze({
  speed: 30000,            // m/s: top pulse speed (rarely reached: most hops brake before it)
  accel: 400,              // m/s^2: about 40 g, carried by the drive field, not by the pilot
  spool: 0.9,              // s: how quickly the acceleration builds and fades (no snap)
  exitSpeed: 820,          // m/s: the drive lets go at about cruise speed
  turnScale: 0.3,          // steering authority while pulsing
  assistRate: 0.6,         // rad/s: how fast the nose is drawn onto the selected target
  aimCone: 0.26,           // rad (15 deg): a body this close to the nose becomes the target
  brakeShare: 0.8,         // fraction of `accel` the braking curve plans with (the rest is margin)
  brakeLead: 0.6,          // s of travel kept in hand
});

// Where a pulse toward `body` ends: its centre distance. The planet then spans about 55 degrees.
export function arrivalRadius(body) {
  return body.radius + Math.max(spaceAltitude(body) * 3, body.radius * 1.2);
}

export function createPulse(speed) {
  return { v: speed, a: 0, cancel: false, block: null, t: 0 };
}

// What speed may the drive hold right now? `spheres`: [{ id, c (centre, same frame as p), radius }].
// Returns { vWant, block (id of the sphere that limits it, or null), inside (id we are inside
// and heading into, or null) }.
export function pulseAdvice(p, f, spheres, T = PULSE) {
  let vWant = T.speed, block = null, inside = null;
  for (const s of spheres) {
    const oc = sub(s.c, p);
    const d = len(oc);
    const along = dot(oc, f);
    if (d < s.radius) {
      // Inside a sphere: fine while leaving, not while heading further in.
      if (along > 0.25 * d) { inside = s.id; vWant = 0; block = s.id; }
      continue;
    }
    if (along <= 0) continue;                              // behind us
    const off2 = d * d - along * along;
    if (off2 >= s.radius * s.radius) continue;             // the line of flight misses it
    const entry = along - Math.sqrt(s.radius * s.radius - off2);
    const room = Math.max(0, entry);
    // Speed from which we can still be down to exit speed at the sphere.
    const v = Math.sqrt(T.exitSpeed * T.exitSpeed + 2 * T.accel * T.brakeShare * room);
    const allowed = Math.max(T.exitSpeed * 0.6, v - T.accel * T.brakeLead);
    if (allowed < vWant) { vWant = allowed; block = s.id; }
  }
  return { vWant, block, inside };
}

// Advance the drive's speed toward vWant with limited, smoothly spooled acceleration.
export function stepPulseSpeed(ps, vWant, dt, T = PULSE) {
  const err = vWant - ps.v;
  const want = clamp(err / 0.5, -T.accel, T.accel);
  // Braking must not lag (the curve assumes the full deceleration is there): spool up gently,
  // spool down hard.
  ps.a += (want - ps.a) * damp(want < ps.a ? 8 : 1 / T.spool * 2.2, dt);
  ps.v = Math.max(0, ps.v + ps.a * dt);
  ps.t += dt;
  return ps;
}

// Rough time for a pulse hop of `distance` metres (for the map and the HUD).
export function pulseEta(distance, T = PULSE) {
  const a = T.accel * T.brakeShare;
  const dPeak = (T.speed * T.speed) / a;                 // distance to reach and shed top speed
  if (distance >= dPeak) return (2 * T.speed) / a + (distance - dPeak) / T.speed;
  return 2 * Math.sqrt(Math.max(0, distance) / a);
}
