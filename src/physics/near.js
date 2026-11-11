// Painted Cosmos physics: the near field. OWNER: PHYSICS. Pure (no three, no DOM).
//
// Everything that is simulated "around the focus" (wind grid, flora field, footprints, rain
// splashes) lives on flat grids laid on a tangent plane of the sphere, the LocalFrame. Within a
// few hundred metres of the anchor a plane and a 4 km sphere differ by centimetres sideways.
// The frame is fixed in body-local space, so nothing swims when the floating origin moves or the
// planet spins. When the focus has wandered far from the anchor the frame re-anchors under it
// (carrying its axes over by parallel transport, so vectors stored in grid axes stay valid).
//
// The ground is seen only through sampleSurface, which is expensive (about 8 microseconds).
// TerrainGrid caches it: a few samples per frame, nearest the focus first.

export class LocalFrame {
  constructor() {
    this.bodyId = null;
    this.ax = 0; this.ay = 1; this.az = 0;      // anchor unit direction (the frame's up)
    this.ex = 1; this.ey = 0; this.ez = 0;      // east-like axis (unit, tangent)
    this.nx = 0; this.ny = 0; this.nz = -1;     // north-like axis = up x east
    this.r0 = 1;                                // radius of the anchor point (m)
    this.ox = 0; this.oy = 0; this.oz = 0;      // anchor point = up * r0 (body-local, m)
    this.version = 0;                           // bumps on every re-anchor
    // rotation of grid vectors at the last re-anchor (old axes -> new axes), row-major 2x2
    this.m00 = 1; this.m01 = 0; this.m10 = 0; this.m11 = 1;
  }

  // Anchor the frame under body-local point (px,py,pz). Keeps the axes as close as possible to
  // the previous ones when the body is the same (parallel transport); geographic east otherwise.
  anchor(bodyId, px, py, pz) {
    const r = Math.hypot(px, py, pz) || 1;
    const ax = px / r, ay = py / r, az = pz / r;
    let ex, ey, ez;
    const same = this.bodyId === bodyId && this.version > 0;
    if (same) {
      const d = this.ex * ax + this.ey * ay + this.ez * az;
      ex = this.ex - d * ax; ey = this.ey - d * ay; ez = this.ez - d * az;
    } else { ex = az; ey = 0; ez = -ax; }        // Y x up
    let l = Math.hypot(ex, ey, ez);
    if (l < 1e-6) { ex = 1; ey = 0; ez = 0; const d = ax; ex -= d * ax; ey -= d * ay; ez -= d * az; l = Math.hypot(ex, ey, ez) || 1; }
    ex /= l; ey /= l; ez /= l;
    const nx = ay * ez - az * ey, ny = az * ex - ax * ez, nz = ax * ey - ay * ex;
    if (same) {
      this.m00 = this.ex * ex + this.ey * ey + this.ez * ez; this.m01 = this.nx * ex + this.ny * ey + this.nz * ez;
      this.m10 = this.ex * nx + this.ey * ny + this.ez * nz; this.m11 = this.nx * nx + this.ny * ny + this.nz * nz;
    } else { this.m00 = 1; this.m01 = 0; this.m10 = 0; this.m11 = 1; }
    this.bodyId = bodyId;
    this.ax = ax; this.ay = ay; this.az = az;
    this.ex = ex; this.ey = ey; this.ez = ez;
    this.nx = nx; this.ny = ny; this.nz = nz;
    this.r0 = r; this.ox = ax * r; this.oy = ay * r; this.oz = az * r;
    this.version++;
  }

  // Grid coordinates (metres along the east and north axes) of a body-local point.
  lx(px, py, pz) { return (px - this.ox) * this.ex + (py - this.oy) * this.ey + (pz - this.oz) * this.ez; }
  lz(px, py, pz) { return (px - this.ox) * this.nx + (py - this.oy) * this.ny + (pz - this.oz) * this.nz; }

  // Unit direction of the surface point above/below grid position (x, z). Writes o[0..2].
  dir(x, z, o) {
    const px = this.ox + this.ex * x + this.nx * z, py = this.oy + this.ey * x + this.ny * z, pz = this.oz + this.ez * x + this.nz * z;
    const l = Math.hypot(px, py, pz);
    o[0] = px / l; o[1] = py / l; o[2] = pz / l;
    return o;
  }
}

// Spiral visiting order for an N x N grid: indices sorted by distance from the centre.
function spiralOrder(N) {
  const c = (N - 1) / 2, idx = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) idx.push(j * N + i);
  idx.sort((a, b) => {
    const ai = a % N - c, aj = Math.floor(a / N) - c, bi = b % N - c, bj = Math.floor(b / N) - c;
    return (ai * ai + aj * aj) - (bi * bi + bj * bj);
  });
  return Uint16Array.from(idx);
}

const _d = new Float64Array(3);
const _dir = { x: 0, y: 0, z: 0 };

// A cache of the ground on an N x N grid of nodes `cell` metres apart that follows the focus.
// Node (i, j) sits at grid position ((ci + i - half) * cell, (cj + j - half) * cell).
export class TerrainGrid {
  constructor(N, cell, withCover) {
    this.N = N; this.cell = cell; this.half = (N - 1) / 2;
    this.h = new Float32Array(N * N);          // ground radius - frame.r0 (m)
    this.lq = new Float32Array(N * N);         // liquid radius - frame.r0, or -1e9 where dry
    this.gx = new Float32Array(N * N);         // ground slope d h / d east
    this.gz = new Float32Array(N * N);         // ground slope d h / d north
    this.valid = new Uint8Array(N * N);
    this.cover = withCover ? new Float32Array(N * N * 8) : null;   // z0, canopy01, canopyH, moist, fog, dustSrc, dT, snowBase
    this.ci = 0; this.cj = 0;                  // grid centre, in cells from the anchor
    this.order = spiralOrder(N);
    this.invalid = N * N;
    this.frameVersion = -1;
    this.changed = 0;                          // bumps whenever any node changes
    this._tmpF = new Float32Array(N * N);
    this._tmpU = new Uint8Array(N * N);
    this._tmpC = withCover ? new Float32Array(N * N * 8) : null;
  }

  invalidate() { this.valid.fill(0); this.invalid = this.N * this.N; this.changed++; }

  // The frame has just re-anchored at old grid position (X, Z) (multiples of this grid's cell)
  // and its anchor radius changed by -dr: keep every node, renumber the grid, re-base heights.
  rebase(frame, X, Z, dr) {
    this.frameVersion = frame.version;
    this.ci -= Math.round(X / this.cell); this.cj -= Math.round(Z / this.cell);
    const h = this.h, lq = this.lq;
    for (let n = 0; n < h.length; n++) { h[n] += dr; if (lq[n] > -1e8) lq[n] += dr; }
    this.changed++;
  }

  // Follow the focus (grid coordinates fx, fz) and sample up to `budget` missing nodes.
  //   sample(dir {x,y,z}) -> contract surface;  coverOf(surface, out8, offset) fills cover.
  // `clock` (optional, ms) and `budgetMs` stop the sampling early when the surface is slow.
  // Returns the number of sampleSurface calls made.
  update(frame, fx, fz, sample, budget, coverOf, clock, budgetMs) {
    const N = this.N;
    if (this.frameVersion !== frame.version) { this.frameVersion = frame.version; this.ci = Math.round(fx / this.cell); this.cj = Math.round(fz / this.cell); this.invalidate(); }
    const ni = Math.round(fx / this.cell), nj = Math.round(fz / this.cell);
    if (ni !== this.ci || nj !== this.cj) this._scroll(ni - this.ci, nj - this.cj);
    if (this.invalid === 0 || budget <= 0) return 0;
    let used = 0;
    const order = this.order, half = this.half, cell = this.cell;
    const t0 = clock ? clock() : 0;
    for (let k = 0; k < order.length && used < budget; k++) {
      const n = order[k];
      if (this.valid[n]) continue;
      if (clock && used >= 2 && clock() - t0 > budgetMs) break;
      const i = n % N, j = (n - i) / N;
      const x = (this.ci + i - half) * cell, z = (this.cj + j - half) * cell;
      frame.dir(x, z, _d);
      _dir.x = _d[0]; _dir.y = _d[1]; _dir.z = _d[2];
      const s = sample(_dir);
      this.h[n] = s.radius - frame.r0;
      this.lq[n] = (s.liquidRadius || 0) > s.radius ? s.liquidRadius - frame.r0 : -1e9;
      // slope from the normal: n ~ up - grad h (unnormalised), so grad h = -(n . axis) / (n . up)
      const nn = s.normal;
      const nu = nn.x * _d[0] + nn.y * _d[1] + nn.z * _d[2];
      const k1 = nu > 0.05 ? 1 / nu : 20;
      this.gx[n] = -(nn.x * frame.ex + nn.y * frame.ey + nn.z * frame.ez) * k1;
      this.gz[n] = -(nn.x * frame.nx + nn.y * frame.ny + nn.z * frame.nz) * k1;
      if (this.cover && coverOf) coverOf(s, this.cover, n * 8);
      this.valid[n] = 1; this.invalid--; used++;
    }
    if (used) this.changed++;
    return used;
  }

  _scroll(di, dj) {
    const N = this.N;
    this.ci += di; this.cj += dj;
    if (Math.abs(di) >= N || Math.abs(dj) >= N) { this.invalidate(); return; }
    const move = (arr, tmp, comps, fill) => {
      tmp.set(arr);
      for (let j = 0; j < N; j++) {
        const sj = j + dj;
        for (let i = 0; i < N; i++) {
          const si = i + di, o = (j * N + i) * comps;
          if (si >= 0 && si < N && sj >= 0 && sj < N) { const s = (sj * N + si) * comps; for (let c = 0; c < comps; c++) arr[o + c] = tmp[s + c]; }
          else for (let c = 0; c < comps; c++) arr[o + c] = fill;
        }
      }
    };
    move(this.h, this._tmpF, 1, 0); move(this.lq, this._tmpF, 1, -1e9); move(this.gx, this._tmpF, 1, 0); move(this.gz, this._tmpF, 1, 0);
    move(this.valid, this._tmpU, 1, 0);
    if (this.cover) move(this.cover, this._tmpC, 8, 0);
    let inv = 0;
    for (let n = 0; n < N * N; n++) if (!this.valid[n]) inv++;
    this.invalid = inv; this.changed++;
  }

  // Fractional node coordinates of grid position (x, z); inside the grid when 0..N-1.
  u(x) { return x / this.cell - this.ci + this.half; }
  v(z) { return z / this.cell - this.cj + this.half; }

  // Ground height (radius - r0) at grid position (x, z) by bilinear interpolation of valid
  // nodes. Returns `fallback` when outside the grid or when no surrounding node is known yet.
  heightAt(x, z, fallback) {
    const N = this.N;
    let u = this.u(x), v = this.v(z);
    if (u < 0 || v < 0 || u > N - 1 || v > N - 1) return fallback;
    let i = Math.floor(u), j = Math.floor(v);
    if (i > N - 2) i = N - 2; if (j > N - 2) j = N - 2;
    const fu = u - i, fv = v - j, n = j * N + i;
    const w00 = (1 - fu) * (1 - fv) * this.valid[n], w10 = fu * (1 - fv) * this.valid[n + 1];
    const w01 = (1 - fu) * fv * this.valid[n + N], w11 = fu * fv * this.valid[n + N + 1];
    const ws = w00 + w10 + w01 + w11;
    if (ws < 0.25) return fallback;
    return (this.h[n] * w00 + this.h[n + 1] * w10 + this.h[n + N] * w01 + this.h[n + N + 1] * w11) / ws;
  }

  // Liquid surface (radius - r0) at (x, z), or -1e9 where the nearest node is dry.
  liquidAt(x, z) {
    const N = this.N;
    const i = Math.round(this.u(x)), j = Math.round(this.v(z));
    if (i < 0 || j < 0 || i > N - 1 || j > N - 1) return -1e9;
    const n = j * N + i;
    return this.valid[n] ? this.lq[n] : -1e9;
  }

  // Nearest valid node index to (x, z), or -1.
  nearest(x, z) {
    const N = this.N;
    let i = Math.round(this.u(x)), j = Math.round(this.v(z));
    if (i < 0) i = 0; else if (i > N - 1) i = N - 1;
    if (j < 0) j = 0; else if (j > N - 1) j = N - 1;
    const n = j * N + i;
    if (this.valid[n]) return n;
    // fall back to the centre node (always sampled first)
    const c = this.order[0];
    return this.valid[c] ? c : -1;
  }
}

// Move an N x N field of `comps` floats by (di, dj) cells, filling new cells with `fill`.
export function scrollField(arr, tmp, N, comps, di, dj, fill = 0) {
  if (di === 0 && dj === 0) return;
  if (Math.abs(di) >= N || Math.abs(dj) >= N) { arr.fill(fill); return; }
  tmp.set(arr);
  for (let j = 0; j < N; j++) {
    const sj = j + dj;
    for (let i = 0; i < N; i++) {
      const si = i + di, o = (j * N + i) * comps;
      if (si >= 0 && si < N && sj >= 0 && sj < N) { const s = (sj * N + si) * comps; for (let c = 0; c < comps; c++) arr[o + c] = tmp[s + c]; }
      else for (let c = 0; c < comps; c++) arr[o + c] = fill;
    }
  }
}
