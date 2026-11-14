// Painted Cosmos: cube-sphere mapping (pure JS, no three). OWNER: PAINTER.
// Six faces, each parameterised by (u, v) in [-1, 1]. A tangent warp keeps cell sizes nearly
// equal across a face. Body-local frame: +Y is the north pole.

// face axis, U axis, V axis (right-handed so that U x V = axis, i.e. outward-facing triangles
// when wound (u, v) counter-clockwise).
export const FACES = [
  { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },   // +X
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },   // -X
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },   // +Y
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },   // -Y
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },    // +Z
  { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },  // -Z
];

const QP = Math.PI / 4;

// (face, u, v) -> unit direction written into out[0..2]
export function faceToDir(face, u, v, out) {
  const f = FACES[face];
  const a = Math.tan(u * QP), b = Math.tan(v * QP);
  const x = f.n[0] + a * f.u[0] + b * f.v[0];
  const y = f.n[1] + a * f.u[1] + b * f.v[1];
  const z = f.n[2] + a * f.u[2] + b * f.v[2];
  const il = 1 / Math.sqrt(x * x + y * y + z * z);
  out[0] = x * il; out[1] = y * il; out[2] = z * il;
  return out;
}

// unit direction -> { face, u, v } written into out (object with face,u,v)
export function dirToFace(x, y, z, out) {
  const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
  let face;
  if (ax >= ay && ax >= az) face = x > 0 ? 0 : 1;
  else if (ay >= az) face = y > 0 ? 2 : 3;
  else face = z > 0 ? 4 : 5;
  const f = FACES[face];
  const d = x * f.n[0] + y * f.n[1] + z * f.n[2];
  const a = (x * f.u[0] + y * f.u[1] + z * f.u[2]) / d;
  const b = (x * f.v[0] + y * f.v[1] + z * f.v[2]) / d;
  out.face = face; out.u = Math.atan(a) / QP; out.v = Math.atan(b) / QP;
  return out;
}

// Edge length in metres of a quadtree node at `level` on a sphere of radius R (at face centre).
export function nodeSize(R, level) {
  return (Math.PI * 0.5 * R) / (1 << level);
}
