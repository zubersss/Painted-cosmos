// The pulse drive: fast travel between worlds. Pure (no three).
//
// The ship accelerates hard along its nose, holds a speed far above cruise, and brakes by itself
// so that it arrives at cruise speed on the "arrival sphere" of whatever lies ahead: close
// enough that the planet fills the view, far enough to take it in. It cannot be flown into
// anything: every body (and the sun) is a sphere the drive will not enter.
import { V, sub, add, scale, norm, cross, dot, len, clamp, damp } from '../core/vec.js';
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
  // The course (a world chosen on the map, or aimed at): F takes the ship there whether or not
  // its mark is on the screen. A nose more than `turnFirst` off the course is first turned onto
  // it, calmly (the picture swings round in a few seconds), and the drive starts when it is on.
  turnFirst: 0.21,         // rad (12 deg): closer than this the drive starts at once and draws the nose on
  turnRate: 0.7,           // rad/s: the turn's top rate (half a turn in about five seconds)
  turnAccel: 0.9,          // rad/s^2: how gently it starts and stops
  turnDone: 0.026,         // rad (1.5 deg): on the course
  turnMax: 20,             // s: a turn that has not arrived by then gives up (never seen)
  // Another world (or the Sun) across the straight line to the course's world: the course goes
  // along the tangent past it, passMargin outside its sphere, and on to the world (it used to
  // stop in front of it: "Venus is in the way"). A straight line counts as across a sphere
  // within blockMargin of it: once round, the course goes straight on only with room to spare.
  passMargin: 1.18,
  blockMargin: 1.08,
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
    const allowed = brakeSpeed(entry, T);
    if (allowed < vWant) { vWant = allowed; block = s.id; }
  }
  return { vWant, block, inside };
}

// The speed from which the drive can still be down to exit speed after `room` metres.
export function brakeSpeed(room, T = PULSE) {
  const v = Math.sqrt(T.exitSpeed * T.exitSpeed + 2 * T.accel * T.brakeShare * Math.max(0, room));
  return Math.max(T.exitSpeed * 0.6, v - T.accel * T.brakeLead);
}

// The speed on a course to `dest`: pulseAdvice along the nose, and besides it the distance left
// to the course's world itself, wherever that world lies. (While the nose follows the tangent
// past a world between, or is still being drawn round, the course's world is off the line of
// flight; planned along the nose alone the drive ran up toward top speed with less room left
// than braking takes, and went into that world at km/s, or round it at 30 km/s without end:
// the pre-ship verifier's R1.) The straight distance is never longer than the way round, so the
// drive is always slow enough to let go at the world's arrival sphere, wherever the nose is.
// Returns pulseAdvice's { vWant, block, inside }; block is `dest` where that limits.
export function courseAdvice(p, f, dest, spheres, T = PULSE) {
  const adv = pulseAdvice(p, f, spheres, T);
  const D = dest ? spheres.find((s) => s.id === dest) : null;
  if (!D) return adv;
  const v = brakeSpeed(len(sub(D.c, p)) - D.radius, T);
  if (v < adv.vWant) { adv.vWant = v; adv.block = dest; }
  return adv;
}

// The direction of the course to `dest` from p: straight at it, or, when another sphere lies
// across that line (within blockMargin of its radius) before the world's own (the world just
// left, a world between, the Sun), along the tangent past that sphere at passMargin times its radius. Inside a sphere and
// heading in toward its centre: across, along its surface. `f` (the nose) picks the side to
// pass on when the world lies dead behind the obstacle. spheres: as for pulseAdvice.
// Returns { dir (unit), around (the id passed round, or null) }, or null without `dest`.
export function courseDir(p, f, dest, spheres, T = PULSE) {
  const D = spheres.find((s) => s.id === dest);
  if (!D) return null;
  const toD = sub(D.c, p);
  const dD = len(toD);
  if (dD < 1e-6) return { dir: f, around: null };
  const t = scale(toD, 1 / dD);
  const reach = dD - D.radius;
  let best = null, bestEntry = Infinity;
  for (const s of spheres) {
    if (s.id === dest) continue;
    const oc = sub(s.c, p);
    const d = len(oc);
    const along = dot(oc, t);
    if (along <= 0) continue;                                    // behind, or heading out of it
    if (d < s.radius) {
      if (bestEntry > 0) { bestEntry = 0; best = { s, d, oc }; }
      continue;
    }
    const off2 = d * d - along * along;
    const rb = s.radius * T.blockMargin;
    if (off2 >= rb * rb) continue;                               // the straight line misses it
    const entry = along - Math.sqrt(rb * rb - off2);
    if (entry > reach || entry >= bestEntry) continue;            // beyond the world, or not the first
    bestEntry = entry; best = { s, d, oc };
  }
  if (!best) return { dir: t, around: null };
  const { s, d, oc } = best;
  const c = scale(oc, 1 / d);
  let u = sub(t, scale(c, dot(t, c)));
  if (len(u) < 1e-4) u = sub(f, scale(c, dot(f, c)));
  if (len(u) < 1e-4) u = cross(c, Math.abs(c.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0));
  u = norm(u);
  const r = s.radius * T.passMargin;
  const a = d > r ? Math.asin(r / d) : Math.PI / 2;
  return { dir: norm(add(scale(c, Math.cos(a)), scale(u, Math.sin(a)))), around: s.id };
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
