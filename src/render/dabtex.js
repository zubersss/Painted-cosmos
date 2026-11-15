// THE OIL LOOK'S DABS, LAID ONCE (the overhaul plan's third piece, docs/HANDOVER.md 4a-2: "strokes baked").
// A layer of leaf dabs (chunks.js, "dabs") was searched afresh for every pixel: eighteen dabs tried, each with its own
// random numbers, on every layer of every surface. Here the layer is laid once, at start-up, as a tile of DAB_N cells a
// side that repeats over the chart:
//   par: one texel a dab (two to a cell): where in its cell it lies (x, y), the way it is turned (radians), and its
//        number (a 16-bit fraction: its place in the pile, the order in which dabs are left out toward the next
//        octave, and, from its lower bits, its length and width). Float texels, read with texelFetch: the shader and
//        this file work from the very same numbers, whatever the machine's arithmetic.
//   id:  DAB_T texels to a cell: for each texel, which of the eighteen dabs round its cell can lie on it at all, the
//        four highest in the pile, highest first (255: none). "Can lie on it" is taken with a margin of a texel, so a
//        pixel anywhere in the texel finds its top dab among the four; the shader then draws the dab's edge itself, as
//        before, a pixel wide at any size.
// The tile repeats every DAB_N cells, but only the dabs' places and shapes do: a dab's colour, its light and whether it
// is a fallen leaf come from where it lies on the world.
import * as THREE from 'three';

export const DAB_N = 32, DAB_T = 32;

function mulberry(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// a dab's half length and half width from its number (the same lines as the shader's pcDabHit)
export function dabSize(pz, aspect) {
  const f = (x) => x - Math.floor(x);
  const a = 0.62 + 0.36 * f(pz * 16), b = a / aspect * (0.8 + 0.4 * f(pz * 256));
  return [a, b];
}

// aspect: a dab's length over its width; agree: how far the dabs agree in direction (0 every way .. 1 all one way).
export function makeDabData(aspect, agree, seed = 0x51ab5) {
  const N = DAB_N, T = DAB_T, S = N * T, rnd = mulberry(seed);
  const par = new Float32Array(N * 2 * N * 4);
  for (let cy = 0; cy < N; cy++) for (let cx = 0; cx < N; cx++) for (let k = 0; k < 2; k++) {
    const i = (cy * N * 2 + cx * 2 + k) * 4, g = rnd();
    let dx = (g - 0.5) + 1e-4, dy = (g * 7.7) % 1 - 0.5 + 1e-4;
    dx += (1 - dx) * agree; dy += ((g - 0.5) * 0.6 - dy) * agree;
    par[i] = rnd(); par[i + 1] = rnd(); par[i + 2] = Math.atan2(dy, dx);
    par[i + 3] = Math.floor(rnd() * 65535 + 1) / 65536;       // (never 0: a number of 0 would be "no dab")
  }
  const id = new Uint8Array(S * S * 4).fill(255), top = new Float32Array(S * S * 4).fill(-1);
  const m = 1.0 / T;                                          // the margin: a texel (its half diagonal is 0.71 of one)
  for (let cy = 0; cy < N; cy++) for (let cx = 0; cx < N; cx++) for (let k = 0; k < 2; k++) {
    const i = (cy * N * 2 + cx * 2 + k) * 4;
    const ox = cx + par[i], oy = cy + par[i + 1], th = par[i + 2], pz = par[i + 3];
    const cs = Math.cos(th), sn = Math.sin(th), [a, b] = dabSize(pz, aspect);
    const r = a + 2 * m;
    const x0 = Math.floor((ox - r) * T), x1 = Math.ceil((ox + r) * T), y0 = Math.floor((oy - r) * T), y1 = Math.ceil((oy + r) * T);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const px = (tx + 0.5) / T - ox, py = (ty + 0.5) / T - oy;
      const qx = Math.abs(cs * px + sn * py), qy = Math.abs(cs * py - sn * px);
      if (qx >= a + m) continue;
      // (the widest the dab is within the margin of this place along it)
      const t = Math.min(Math.max(qx - m, 0) / a, 1);
      if (qy >= b * (1 - t * t) + m) continue;
      const wx = ((tx % S) + S) % S, wy = ((ty % S) + S) % S, w = wy * S + wx;
      // which of the eighteen round the texel's own cell this dab is
      let di = cx - Math.floor(tx / T), dj = cy - Math.floor(ty / T);
      if (di < -1 || di > 1 || dj < -1 || dj > 1) continue;   // (cannot happen: a dab reaches less than a cell from its centre)
      const code = (dj + 1) * 6 + (di + 1) * 2 + k;
      const i4 = w * 4;
      // (kept in the order of the pile, highest first: an insertion into four)
      let at = 4;
      while (at > 0 && pz > top[i4 + at - 1]) at--;
      if (at > 3) continue;
      for (let q = 3; q > at; q--) { top[i4 + q] = top[i4 + q - 1]; id[i4 + q] = id[i4 + q - 1]; }
      top[i4 + at] = pz; id[i4 + at] = code;
    }
  }
  return { par, id, size: S };
}

let _dab = null;
export function getDabTextures(aspect, agree) {
  if (_dab && _dab.aspect === aspect && _dab.agree === agree) return _dab;
  const d = makeDabData(aspect, agree);
  const par = new THREE.DataTexture(d.par, DAB_N * 2, DAB_N, THREE.RGBAFormat, THREE.FloatType);
  par.minFilter = par.magFilter = THREE.NearestFilter; par.generateMipmaps = false; par.needsUpdate = true;
  const id = new THREE.DataTexture(d.id, d.size, d.size, THREE.RGBAFormat, THREE.UnsignedByteType);
  id.minFilter = id.magFilter = THREE.NearestFilter; id.generateMipmaps = false; id.needsUpdate = true;
  if (_dab) { _dab.par.dispose(); _dab.id.dispose(); }
  _dab = { par, id, aspect, agree };
  return _dab;
}
