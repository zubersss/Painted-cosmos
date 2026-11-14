// Reference frames and the floating origin. Pure (no three).
//
// Three kinds of frame, all described by a small plain object:
//   { kind: 'helio' }                          the universe frame (sun at the origin, inertial)
//   { kind: 'body', id, rotating: false }      centred on a body, axes parallel to the universe
//   { kind: 'body', id, rotating: true }       fixed to the body's ground (it spins with it)
//
// On foot, landed and in the atmosphere everything lives in the rotating frame, so the ground
// (and the air) never slides under you. In space near a body the ship lives in the body-centred
// inertial frame: the planet turns beneath a parked ship but never runs away from it. Beyond a
// body's sphere of influence the ship lives in the universe frame.
import { V, add, sub, cross, qRotate, qConj, qMul, Q, len } from './vec.js';
import { spaceAltitude } from './orbits.js';

export const HELIO = Object.freeze({ kind: 'helio' });
export const bodyFrame = (id, rotating) => ({ kind: 'body', id, rotating: !!rotating });
export const sameFrame = (a, b) =>
  a.kind === b.kind && (a.kind === 'helio' || (a.id === b.id && a.rotating === b.rotating));

// Snapshot of a frame at time t: where its origin is, how fast it moves and turns.
export function frameState(eph, frame, t) {
  if (frame.kind === 'helio') return { origin: V(), vel: V(), rot: Q(), omega: V(), rotating: false };
  const origin = eph.position(frame.id, t);
  const vel = eph.velocity(frame.id, t);
  if (!frame.rotating) return { origin, vel, rot: Q(), omega: V(), rotating: false };
  return { origin, vel, rot: eph.orientation(frame.id, t), omega: eph.angularVelocity(frame.id), rotating: true };
}

export const posToUniverse = (fs, p) => add(fs.origin, fs.rotating ? qRotate(fs.rot, p) : p);
export function posFromUniverse(fs, P) {
  const d = sub(P, fs.origin);
  return fs.rotating ? qRotate(qConj(fs.rot), d) : d;
}
export function velToUniverse(fs, p, v) {
  if (!fs.rotating) return add(fs.vel, v);
  const r = qRotate(fs.rot, p);
  return add(add(fs.vel, qRotate(fs.rot, v)), cross(fs.omega, r));
}
export function velFromUniverse(fs, P, Vu) {
  if (!fs.rotating) return sub(Vu, fs.vel);
  const r = sub(P, fs.origin);
  return qRotate(qConj(fs.rot), sub(sub(Vu, fs.vel), cross(fs.omega, r)));
}
export const quatToUniverse = (fs, q) => (fs.rotating ? qMul(fs.rot, q) : q);
export const quatFromUniverse = (fs, Qu) => (fs.rotating ? qMul(qConj(fs.rot), Qu) : Qu);

// Convert a kinematic state { p, v, q } from one frame to another at time t. Position, velocity
// and attitude are continuous in the universe frame, so nothing visibly jumps.
export function convertState(eph, t, from, to, st) {
  if (sameFrame(from, to)) return { p: st.p, v: st.v, q: st.q };
  const a = frameState(eph, from, t), b = frameState(eph, to, t);
  const P = posToUniverse(a, st.p);
  const Vu = velToUniverse(a, st.p, st.v);
  return {
    p: posFromUniverse(b, P),
    v: velFromUniverse(b, P, Vu),
    q: st.q ? quatFromUniverse(b, quatToUniverse(a, st.q)) : undefined,
  };
}

// Which frame should a ship at universe position P fly in? Hysteresis keeps it from flickering
// at the boundaries. Children (the moon) win over their parent when both contain P.
export function chooseFrame(eph, t, P, current) {
  let pick = null;
  for (const id of eph.ids) {
    const b = eph.body(id);
    const d = len(sub(P, eph.position(id, t)));
    const isCurrent = current.kind === 'body' && current.id === id;
    if (d > eph.soiRadius(id) * (isCurrent ? 1.08 : 1)) continue;
    const cand = { id, alt: d - b.radius, moon: !!b.parent };
    if (!pick || (cand.moon && !pick.moon) || (cand.moon === pick.moon && cand.alt < pick.alt)) pick = cand;
  }
  if (!pick) return HELIO;
  const b = eph.body(pick.id);
  const edge = spaceAltitude(b);
  const wasRotating = current.kind === 'body' && current.id === pick.id && current.rotating;
  const rotating = wasRotating ? pick.alt < edge * 1.1 : pick.alt < edge;
  return bodyFrame(pick.id, rotating);
}

// Body-local unit direction and distance for a frame-space position near that frame's body.
export function bodyLocal(eph, frame, t, p) {
  if (frame.kind !== 'body') return null;
  const local = frame.rotating ? p : qRotate(qConj(eph.orientation(frame.id, t)), p);
  const r = len(local);
  return { local, r, dir: r > 0 ? { x: local.x / r, y: local.y / r, z: local.z / r } : V(0, 1, 0) };
}

// ---- floating origin -------------------------------------------------------------------
// The scene is the universe translated so that `origin` (the camera) sits at (0,0,0). All the
// subtraction happens here in doubles; only small camera-relative numbers reach the GPU.
export class FloatingOrigin {
  constructor() { this.origin = V(); }
  set(P) { this.origin = { x: P.x, y: P.y, z: P.z }; }
  toScene(P) { return sub(P, this.origin); }
  toUniverse(S) { return add(S, this.origin); }
}
