// Tiny double-precision vector and quaternion helpers on plain {x,y,z} / {x,y,z,w} objects.
// No dependency on three, so every module built on this can be unit-tested in Node.
// The shapes are duck-compatible with THREE.Vector3 / THREE.Quaternion (same field names and
// the same quaternion convention), so values can be copied across with `.set(v.x, v.y, v.z)`.

export const V = (x = 0, y = 0, z = 0) => ({ x, y, z });
export const clone = (a) => ({ x: a.x, y: a.y, z: a.z });
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const addScaled = (a, b, s) => ({ x: a.x + b.x * s, y: a.y + b.y * s, z: a.z + b.z * s });
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
export const len = (a) => Math.hypot(a.x, a.y, a.z);
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const lerp = (a, b, t) => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
});
export function norm(a, fallback) {
  const l = Math.hypot(a.x, a.y, a.z);
  if (l < 1e-12) return fallback ? clone(fallback) : { x: 0, y: 1, z: 0 };
  return { x: a.x / l, y: a.y / l, z: a.z / l };
}
// Component of `a` perpendicular to unit vector `n`.
export const reject = (a, n) => addScaled(a, n, -dot(a, n));
// Unit tangent: `a` projected onto the plane perpendicular to unit `n`, normalised.
export function tangent(a, n, fallback) {
  const r = reject(a, n);
  if (len(r) < 1e-9) return fallback ? tangent(fallback, n) : anyPerpendicular(n);
  return norm(r);
}
export function anyPerpendicular(n) {
  const ref = Math.abs(n.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  return norm(cross(ref, n));
}
// Limit the length of `a` to `max`.
export function clampLen(a, max) {
  const l = len(a);
  return l > max && l > 0 ? scale(a, max / l) : a;
}
// Rotate `v` around unit `axis` by `angle` (right-handed).
export function rotateAround(v, axis, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const d = dot(axis, v) * (1 - c);
  const cr = cross(axis, v);
  return {
    x: v.x * c + cr.x * s + axis.x * d,
    y: v.y * c + cr.y * s + axis.y * d,
    z: v.z * c + cr.z * s + axis.z * d,
  };
}

// ---- scalars ---------------------------------------------------------------------------
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const mix = (a, b, t) => a + (b - a) * t;
export function smoothstep(a, b, x) {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}
// Frame-rate independent exponential approach factor: fraction to move this step.
export const damp = (rate, dt) => 1 - Math.exp(-rate * dt);
export function wrapAngle(a) {
  a = (a + Math.PI) % (2 * Math.PI);
  if (a < 0) a += 2 * Math.PI;
  return a - Math.PI;
}

// ---- quaternions -----------------------------------------------------------------------
export const Q = (x = 0, y = 0, z = 0, w = 1) => ({ x, y, z, w });
export const qClone = (q) => ({ x: q.x, y: q.y, z: q.z, w: q.w });
export function qFromAxisAngle(axis, angle) {
  const h = angle / 2, s = Math.sin(h);
  return { x: axis.x * s, y: axis.y * s, z: axis.z * s, w: Math.cos(h) };
}
// a * b (apply b first, then a), same as THREE.Quaternion.multiplyQuaternions(a, b).
export function qMul(a, b) {
  return {
    x: a.x * b.w + a.w * b.x + a.y * b.z - a.z * b.y,
    y: a.y * b.w + a.w * b.y + a.z * b.x - a.x * b.z,
    z: a.z * b.w + a.w * b.z + a.x * b.y - a.y * b.x,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}
export const qConj = (q) => ({ x: -q.x, y: -q.y, z: -q.z, w: q.w });
export function qNorm(q) {
  const l = Math.hypot(q.x, q.y, q.z, q.w) || 1;
  return { x: q.x / l, y: q.y / l, z: q.z / l, w: q.w / l };
}
export function qRotate(q, v) {
  // v' = q v q*
  const { x, y, z, w } = q;
  const tx = 2 * (y * v.z - z * v.y);
  const ty = 2 * (z * v.x - x * v.z);
  const tz = 2 * (x * v.y - y * v.x);
  return {
    x: v.x + w * tx + (y * tz - z * ty),
    y: v.y + w * ty + (z * tx - x * tz),
    z: v.z + w * tz + (x * ty - y * tx),
  };
}
export function qSlerp(a, b, t) {
  let cos = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
  let bx = b.x, by = b.y, bz = b.z, bw = b.w;
  if (cos < 0) { cos = -cos; bx = -bx; by = -by; bz = -bz; bw = -bw; }
  let s0, s1;
  if (cos > 0.9995) { s0 = 1 - t; s1 = t; }
  else {
    const th = Math.acos(cos), sn = Math.sin(th);
    s0 = Math.sin((1 - t) * th) / sn; s1 = Math.sin(t * th) / sn;
  }
  return qNorm({ x: a.x * s0 + bx * s1, y: a.y * s0 + by * s1, z: a.z * s0 + bz * s1, w: a.w * s0 + bw * s1 });
}
// Quaternion from an orthonormal basis (columns right, up, back), i.e. the orientation of an
// object whose local +X is `right`, +Y is `up` and +Z is `back`.
export function qFromBasis(right, up, back) {
  const m00 = right.x, m10 = right.y, m20 = right.z;
  const m01 = up.x, m11 = up.y, m21 = up.z;
  const m02 = back.x, m12 = back.y, m22 = back.z;
  const tr = m00 + m11 + m22;
  let x, y, z, w;
  if (tr > 0) {
    const s = 0.5 / Math.sqrt(tr + 1);
    w = 0.25 / s; x = (m21 - m12) * s; y = (m02 - m20) * s; z = (m10 - m01) * s;
  } else if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
    w = (m21 - m12) / s; x = 0.25 * s; y = (m01 + m10) / s; z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
    w = (m02 - m20) / s; x = (m01 + m10) / s; y = 0.25 * s; z = (m12 + m21) / s;
  } else {
    const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
    w = (m10 - m01) / s; x = (m02 + m20) / s; y = (m12 + m21) / s; z = 0.25 * s;
  }
  return qNorm({ x, y, z, w });
}
// Orientation of something that looks along `forward` (its local -Z) with `upHint` roughly up.
export function qLook(forward, upHint) {
  const f = norm(forward);
  let r = cross(f, upHint);
  if (len(r) < 1e-6) r = cross(f, anyPerpendicular(f));
  r = norm(r);
  const u = cross(r, f);
  return qFromBasis(r, u, scale(f, -1));
}
export const qForward = (q) => qRotate(q, { x: 0, y: 0, z: -1 });
export const qUp = (q) => qRotate(q, { x: 0, y: 1, z: 0 });
export const qRight = (q) => qRotate(q, { x: 1, y: 0, z: 0 });
