// Painted Cosmos physics: marks left in the ground. OWNER: PHYSICS. Pure (no three, no DOM).
//
// FIRST VERSION (stage P1): footprints and a trail.
//   marks   a ring buffer of individual prints (crisp: PAINTER draws each as a brush mark)
//   depth   a 64 x 64 grid of 0.5 m cells around the focus (broad: the trough of a trail through
//           snow or sand, to darken or lower the ground), in metres pressed down
// How deep a print is comes from the ground: `sink` of the material under the foot (ground.js),
// more in snow, almost nothing on rock. How long it lasts comes from `imprint`.
// Strides are timed by the body's motion: a step is about 0.5 m + 0.13 s x speed long and
// lengthens in low gravity (g0 / g)^0.25, which is why prints on the Moon are far apart.
// Later stages add: displaced rims, angle-of-repose relaxation, wind-blown drifts, landing marks.
import { clamp01 } from './util.js';
import { scrollField } from './near.js';

export const DEFORM = Object.freeze({
  N: 64, cell: 0.5,
  marks: 256,              // ring capacity
  stride0: 0.5,            // m: step length at a standstill
  strideGain: 0.13,        // s: extra step length per m/s
  footOffset: 0.12,        // m: each foot lands this far to its side of the path
  footLength: 0.30, footWidth: 0.12,   // m
  fade: 150,               // s for a print in the most lasting material to fade (scaled by imprint)
});
export const MARK = Object.freeze({ footLeft: 0, footRight: 1, gear: 2, hull: 3, scorch: 4 });
export const MARK_STRIDE = 12;   // x, y, z, dirx, diry, dirz, length, width, depth, kind, born, life

export class DeformField {
  constructor() {
    const N = DEFORM.N;
    this.N = N; this.cell = DEFORM.cell;
    this.depth = new Float32Array(N * N);
    this._tmp = new Float32Array(N * N);
    this.ci = 0; this.cj = 0;
    this.frameVersion = -1;
    this.version = 0;
    // marks: positions relative to marks.origin (body-local axes)
    this.marks = { data: new Float32Array(DEFORM.marks * MARK_STRIDE), capacity: DEFORM.marks, head: 0, total: 0, origin: { x: 0, y: 0, z: 0 }, stride: MARK_STRIDE };
    this._walk = [];           // per-disturber stride state
    this.uniforms = { uPhysDeformMap: [0, 0, 1 / (N * DEFORM.cell), N] };
    this._any = false;
  }

  reset() { this.depth.fill(0); this._any = false; }

  // The frame has re-anchored at old grid position (X, Z): keep the trail, renumber the grid,
  // and move the marks to the new origin.
  rebase(frame, X, Z) {
    const M = this.marks, dx = M.origin.x - frame.ox, dy = M.origin.y - frame.oy, dz = M.origin.z - frame.oz;
    for (let k = 0; k < M.capacity; k++) { const o = k * MARK_STRIDE; M.data[o] += dx; M.data[o + 1] += dy; M.data[o + 2] += dz; }
    M.origin.x = frame.ox; M.origin.y = frame.oy; M.origin.z = frame.oz;
    this.frameVersion = frame.version;
    this.ci -= Math.round(X / this.cell); this.cj -= Math.round(Z / this.cell);
    this.version++;
  }

  // disturbers: as in physics.update. ground(x, z, out) -> { sink, imprint } for grid position.
  update(dt, frame, fx, fz, disturbers, groundOf, g, time) {
    const N = this.N, cell = this.cell;
    if (this.frameVersion !== frame.version) {
      // marks are kept across a re-anchor: shift them to the new origin
      const M = this.marks, dx = M.origin.x - frame.ox, dy = M.origin.y - frame.oy, dz = M.origin.z - frame.oz;
      if (this.frameVersion >= 0 && Math.hypot(dx, dy, dz) < 2000) {
        for (let k = 0; k < M.capacity; k++) { const o = k * MARK_STRIDE; M.data[o] += dx; M.data[o + 1] += dy; M.data[o + 2] += dz; }
      } else { M.data.fill(0); M.total = 0; M.head = 0; }
      M.origin.x = frame.ox; M.origin.y = frame.oy; M.origin.z = frame.oz;
      this.frameVersion = frame.version; this.reset();
      this.ci = Math.round(fx / cell); this.cj = Math.round(fz / cell);
    }
    const ni = Math.round(fx / cell), nj = Math.round(fz / cell);
    if (ni !== this.ci || nj !== this.cj) { scrollField(this.depth, this._tmp, N, 1, ni - this.ci, nj - this.cj, 0); this.ci = ni; this.cj = nj; this.version++; }
    // slow healing
    if (this._any) {
      const k = Math.exp(-dt / (DEFORM.fade * 0.6));
      let any = false;
      const d = this.depth;
      for (let n = 0; n < N * N; n++) { if (d[n] !== 0) { d[n] *= k; if (d[n] < 2e-4) d[n] = 0; else any = true; } }
      this._any = any; this.version++;
    }
    if (!disturbers) return;
    let wi = 0;
    for (let k = 0; k < disturbers.length; k++) {
      const D = disturbers[k];
      if (!D || D.kind !== 'explorer' || !D.p) continue;
      const W = this._walk[wi] || (this._walk[wi] = { dist: 0, side: 1, lx: 0, lz: 0, has: false });
      wi++;
      const x = frame.lx(D.p.x, D.p.y, D.p.z), z = frame.lz(D.p.x, D.p.y, D.p.z);
      const grounded = D.grounded != null ? D.grounded : true;
      if (!grounded) { W.has = false; continue; }
      if (!W.has) { W.lx = x; W.lz = z; W.has = true; W.dist = 0; continue; }
      const dx = x - W.lx, dz = z - W.lz, step = Math.hypot(dx, dz);
      if (step > 3) { W.lx = x; W.lz = z; W.dist = 0; continue; }        // teleported
      W.dist += step; W.lx = x; W.lz = z;
      const speed = D.v ? Math.hypot(D.v.x, D.v.y, D.v.z) : step / Math.max(dt, 1e-3);
      const stride = (DEFORM.stride0 + DEFORM.strideGain * speed) * Math.pow(9.0 / Math.max(g, 0.5), 0.25);
      if (W.dist < stride || step < 1e-5) continue;
      W.dist = 0; W.side = -W.side;
      const hx = dx / step, hz = dz / step;
      const mx = x - hz * DEFORM.footOffset * W.side, mz = z + hx * DEFORM.footOffset * W.side;
      const G = groundOf(mx, mz, _g);
      const depth = G.sink * (0.8 + 0.4 * clamp01(speed / 6));
      if (depth < 0.002) continue;
      this._mark(frame, mx, G.h, mz, hx, hz, DEFORM.footLength, DEFORM.footWidth, depth, W.side < 0 ? MARK.footLeft : MARK.footRight, time, DEFORM.fade * (0.15 + 0.85 * G.imprint));
      this._splat(mx, mz, depth * 0.6);
    }
  }

  _mark(frame, x, y, z, hx, hz, length, width, depth, kind, time, life) {
    const M = this.marks, o = M.head * MARK_STRIDE, d = M.data;
    d[o] = frame.ex * x + frame.ax * y + frame.nx * z;
    d[o + 1] = frame.ey * x + frame.ay * y + frame.ny * z;
    d[o + 2] = frame.ez * x + frame.az * y + frame.nz * z;
    d[o + 3] = frame.ex * hx + frame.nx * hz; d[o + 4] = frame.ey * hx + frame.ny * hz; d[o + 5] = frame.ez * hx + frame.nz * hz;
    d[o + 6] = length; d[o + 7] = width; d[o + 8] = depth; d[o + 9] = kind; d[o + 10] = time; d[o + 11] = life;
    M.head = (M.head + 1) % M.capacity; M.total++;
  }

  _splat(x, z, depth) {
    const N = this.N, cell = this.cell;
    const u = x / cell - this.ci + N / 2 - 0.5, v = z / cell - this.cj + N / 2 - 0.5;
    const i = Math.floor(u), j = Math.floor(v);
    if (i < 0 || j < 0 || i > N - 2 || j > N - 2) return;
    const fu = u - i, fv = v - j, n = j * N + i, d = this.depth;
    d[n] = Math.max(d[n], depth * (1 - fu) * (1 - fv)); d[n + 1] = Math.max(d[n + 1], depth * fu * (1 - fv));
    d[n + N] = Math.max(d[n + N], depth * (1 - fu) * fv); d[n + N + 1] = Math.max(d[n + N + 1], depth * fu * fv);
    this._any = true; this.version++;
    this.uniforms.uPhysDeformMap[0] = this.ci * cell; this.uniforms.uPhysDeformMap[1] = this.cj * cell;
  }

  // Depth (m) pressed into the ground at grid position (x, z).
  depthAt(x, z) {
    const N = this.N, cell = this.cell;
    let u = x / cell - this.ci + N / 2 - 0.5, v = z / cell - this.cj + N / 2 - 0.5;
    if (u < 0 || v < 0 || u > N - 1 || v > N - 1) return 0;
    let i = Math.floor(u), j = Math.floor(v);
    if (i > N - 2) i = N - 2; if (j > N - 2) j = N - 2;
    const fu = u - i, fv = v - j, n = j * N + i, d = this.depth;
    return d[n] * (1 - fu) * (1 - fv) + d[n + 1] * fu * (1 - fv) + d[n + N] * (1 - fu) * fv + d[n + N + 1] * fu * fv;
  }
}
const _g = {};
