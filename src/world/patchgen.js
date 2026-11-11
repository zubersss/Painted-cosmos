// Painted Cosmos: terrain patch mesher (pure JS, no three). OWNER: PAINTER.
// Builds the vertex data of one quadtree node of the cube-sphere. Kept free of three so it can
// be unit-tested in Node and moved into a worker later without changes.
import { faceToDir } from './cubesphere.js';
import { makeSample, NOLQ } from './surface.js';

export const PATCH_N = 32;                 // cells per patch edge (even, for geomorphing)
const N = PATCH_N, V = N + 1, E = N + 3;   // E: sample grid with a one-vertex apron for normals

// Shared index buffers. Cells are split along the (i,j)->(i+1,j+1) diagonal everywhere, which
// is what makes the morph targets of the "odd/odd" vertices land exactly on the parent mesh.
let _indices = null;
export function patchIndices() {
  if (_indices) return _indices;
  const idx = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const a = j * V + i, b = a + 1, c = a + V, d = c + 1;
    idx.push(a, b, d, a, d, c);
  }
  // skirts: four strips hanging from the border
  const S0 = V * V;
  const strip = (get, s0, flip) => {
    for (let k = 0; k < N; k++) {
      const a = get(k), b = get(k + 1), c = s0 + k, d = s0 + k + 1;
      if (flip) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
    }
  };
  strip((k) => k, S0, true);                          // v = 0 edge
  strip((k) => N * V + k, S0 + V, false);             // v = 1 edge
  strip((k) => k * V, S0 + 2 * V, false);             // u = 0 edge
  strip((k) => k * V + N, S0 + 3 * V, true);          // u = 1 edge
  _indices = new Uint16Array(idx);
  return _indices;
}
export const PATCH_VERTS = V * V + 4 * V;

const _d = [0, 0, 0];
const _px = new Float64Array(E * E), _py = new Float64Array(E * E), _pz = new Float64Array(E * E);
const _hh = new Float32Array(E * E), _lq = new Float32Array(E * E);
const _col = new Float32Array(E * E * 10);
let _s = null;

function b8(v) { v = v * 255 + 0.5; return v < 0 ? 0 : v > 255 ? 255 : v | 0; }

export function buildPatchData(S, face, level, ix, iy) {
  if (!_s || _s.w.length < S.nB) _s = makeSample(S.nB);
  const s = _s, R = S.R;
  const span = 2 / (1 << level);
  const u0 = -1 + ix * span, v0 = -1 + iy * span, du = span / N;
  let minH = 1e9, maxH = -1e9, anyWater = false;
  // 1. sample the surface on the apron grid
  for (let j = 0; j < E; j++) {
    for (let i = 0; i < E; i++) {
      const k = j * E + i;
      faceToDir(face, u0 + (i - 1) * du, v0 + (j - 1) * du, _d);
      const inner = i >= 1 && i <= V && j >= 1 && j <= V;
      S.sample(_d[0], _d[1], _d[2], s, inner);
      const rr = R + s.h;
      _px[k] = _d[0] * rr; _py[k] = _d[1] * rr; _pz[k] = _d[2] * rr;
      _hh[k] = s.h; _lq[k] = s.lq === NOLQ ? -1e6 : s.lq;
      if (inner) {
        if (s.h < minH) minH = s.h; if (s.h > maxH) maxH = s.h;
        if (s.lq !== NOLQ && s.lq > s.h - 0.5) anyWater = true;
        const c = k * 10;
        _col[c] = s.r; _col[c + 1] = s.g; _col[c + 2] = s.b;
        _col[c + 3] = s.r2; _col[c + 4] = s.g2; _col[c + 5] = s.b2;
        _col[c + 6] = s.dry; _col[c + 7] = s.wet; _col[c + 8] = s.canopy; _col[c + 9] = s.aux;
      }
    }
  }
  // 2. origin: the patch centre, so vertex coordinates stay small
  const kc = (1 + N / 2) * E + (1 + N / 2);
  const ox = _px[kc], oy = _py[kc], oz = _pz[kc];
  const nv = PATCH_VERTS;
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), mor = new Float32Array(nv * 3);
  const col = new Uint8Array(nv * 4), col2 = new Uint8Array(nv * 4), par = new Uint8Array(nv * 4);
  let boundR2 = 0;
  for (let j = 0; j < V; j++) {
    for (let i = 0; i < V; i++) {
      const k = (j + 1) * E + (i + 1), o = (j * V + i) * 3;
      const x = _px[k] - ox, y = _py[k] - oy, z = _pz[k] - oz;
      pos[o] = x; pos[o + 1] = y; pos[o + 2] = z;
      const r2 = x * x + y * y + z * z; if (r2 > boundR2) boundR2 = r2;
      // normal: cross(dP/du, dP/dv), which points outward for our face frames
      const ax = _px[k + 1] - _px[k - 1], ay = _py[k + 1] - _py[k - 1], az = _pz[k + 1] - _pz[k - 1];
      const bx = _px[k + E] - _px[k - E], by = _py[k + E] - _py[k - E], bz = _pz[k + E] - _pz[k - E];
      let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
      const il = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      nor[o] = nx * il; nor[o + 1] = ny * il; nor[o + 2] = nz * il;
      // morph target: where this vertex sits on the parent's (half resolution) mesh
      const io = i & 1, jo = j & 1;
      if (io || jo) {
        let k1, k2;
        if (io && !jo) { k1 = k - 1; k2 = k + 1; }
        else if (!io && jo) { k1 = k - E; k2 = k + E; }
        else { k1 = k - E - 1; k2 = k + E + 1; }
        mor[o] = (_px[k1] + _px[k2]) * 0.5 - _px[k];
        mor[o + 1] = (_py[k1] + _py[k2]) * 0.5 - _py[k];
        mor[o + 2] = (_pz[k1] + _pz[k2]) * 0.5 - _pz[k];
      }
      const c = k * 10, q = (j * V + i) * 4;
      col[q] = b8(_col[c]); col[q + 1] = b8(_col[c + 1]); col[q + 2] = b8(_col[c + 2]); col[q + 3] = 255;
      col2[q] = b8(_col[c + 3]); col2[q + 1] = b8(_col[c + 4]); col2[q + 2] = b8(_col[c + 5]); col2[q + 3] = 255;
      par[q] = b8(_col[c + 6]); par[q + 1] = b8(_col[c + 7]); par[q + 2] = b8(_col[c + 8]); par[q + 3] = b8(_col[c + 9]);
    }
  }
  // 3. skirts: copies of the border pulled toward the planet centre
  const size = (Math.PI * 0.5 * R) / (1 << level);
  const drop = Math.max(0.4, (size / N) * 0.75);
  const S0 = V * V;
  const skirt = (dst, src) => {
    const o = dst * 3, p = src * 3;
    const x = pos[p] + ox, y = pos[p + 1] + oy, z = pos[p + 2] + oz;
    const il = drop / Math.sqrt(x * x + y * y + z * z);
    pos[o] = pos[p] - x * il; pos[o + 1] = pos[p + 1] - y * il; pos[o + 2] = pos[p + 2] - z * il;
    nor[o] = nor[p]; nor[o + 1] = nor[p + 1]; nor[o + 2] = nor[p + 2];
    mor[o] = mor[p]; mor[o + 1] = mor[p + 1]; mor[o + 2] = mor[p + 2];
    const a = dst * 4, b = src * 4;
    for (let t = 0; t < 4; t++) { col[a + t] = col[b + t]; col2[a + t] = col2[b + t]; par[a + t] = par[b + t]; }
  };
  for (let k = 0; k < V; k++) {
    skirt(S0 + k, k); skirt(S0 + V + k, N * V + k); skirt(S0 + 2 * V + k, k * V); skirt(S0 + 3 * V + k, k * V + N);
  }
  // 4. water surface, only where liquid reaches the ground
  let water = null;
  if (anyWater) {
    const wpos = new Float32Array(V * V * 3), wdep = new Float32Array(V * V);
    for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) {
      const k = (j + 1) * E + (i + 1), o = (j * V + i) * 3;
      const h = _hh[k], lq = _lq[k];
      const has = lq > -1e5;
      const hw = has ? lq : h - 1.5;
      const sc = (R + hw) / (R + h);
      wpos[o] = _px[k] * sc - ox; wpos[o + 1] = _py[k] * sc - oy; wpos[o + 2] = _pz[k] * sc - oz;
      wdep[j * V + i] = has ? lq - h : -1.5;
    }
    const widx = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = j * V + i, b = a + 1, c = a + V, d = c + 1;
      if (wdep[a] > -0.45 || wdep[b] > -0.45 || wdep[c] > -0.45 || wdep[d] > -0.45) widx.push(a, b, d, a, d, c);
    }
    if (widx.length) water = { positions: wpos, depth: wdep, indices: new Uint16Array(widx) };
  }
  return {
    origin: [ox, oy, oz], positions: pos, normals: nor, morph: mor, colors: col, colors2: col2, params: par,
    water, boundR: Math.sqrt(boundR2) + drop, minH, maxH, size,
  };
}
