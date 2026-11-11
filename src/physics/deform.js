// Painted Cosmos physics: marks left in the ground. OWNER: PHYSICS. Pure (no three, no DOM).
//
//   marks   a ring buffer of individual marks (crisp: PAINTER draws each as a brush mark):
//           footprints, the three pads of the ship's gear, the scoured ring under a jet
//   depth   a 64 x 64 grid of 0.5 m cells around the focus (broad: the trough of a trail through
//           snow or sand, the dish under a hovering ship), in metres pressed down; negative
//           where displaced material has piled up
// How deep a mark is comes from the ground: `sink` of the material under it (ground.js), more
// in snow, almost nothing on rock. How long it lasts comes from `imprint`.
// What is pressed out of a print has to go somewhere: loose ground (sand, snow, dust) is
// pushed up into a rim about a fifth as high as the print is deep.
// Marks do not last for ever: falling snow fills them (drifting snow finds the hollows first),
// blowing sand rounds them off and erases them, and everything slowly slumps.
// Strides are timed by the body's motion: a step is about 0.5 m + 0.13 s x speed long and
// lengthens in low gravity (g0 / g)^0.25, which is why prints on the Moon are far apart.
import { clamp01, smoothstep } from './util.js';
import { scrollField } from './near.js';

export const DEFORM = Object.freeze({
  N: 64, cell: 0.5,
  marks: 256,              // ring capacity
  stride0: 0.5,            // m: step length at a standstill
  strideGain: 0.13,        // s: extra step length per m/s
  footOffset: 0.12,        // m: each foot lands this far to its side of the path
  footLength: 0.30, footWidth: 0.12,   // m
  fade: 150,               // s for a mark in the most lasting material to fade (scaled by imprint)
  rim: 0.2,                // rim height as a fraction of the depth, on loose ground
  padRadius: 0.32,         // m: a landing pad
  padPressure: 2.2,        // a pad presses this many times deeper than a boot (63 kPa against 30)
  padMax: 0.3,             // m
  snowFill: 6,             // hollows fill this many times faster than level ground gains snow
  sandFill: 0.012,         // m/s that blowing sand fills a print at full saltation
  scourEvery: 0.6,         // s between scour marks under a jet
  scourLoad: 60,           // Pa of jet pressure on the ground that starts to scour loose ground
});
export const MARK = Object.freeze({ footLeft: 0, footRight: 1, gear: 2, hull: 3, scour: 4 });
// x, y, z (relative to marks.origin), dirx, diry, dirz, length, width, depth, kind, born, life, rim,
// material (what it was pressed into: an index into ground.js MATERIAL_IDS, 255 = unknown)
export const MARK_STRIDE = 14;

const _g = { sink: 0, imprint: 0, h: 0, loose: 0, dust: 0, mat: 255 };
const _a = new Float64Array(3);
function qRot(q, x, y, z, o) {
  const tx = 2 * (q.y * z - q.z * y), ty = 2 * (q.z * x - q.x * z), tz = 2 * (q.x * y - q.y * x);
  o[0] = x + q.w * tx + (q.y * tz - q.z * ty); o[1] = y + q.w * ty + (q.z * tx - q.x * tz); o[2] = z + q.w * tz + (q.x * ty - q.y * tx);
  return o;
}

export class DeformField {
  constructor(legs) {
    const N = DEFORM.N;
    this.N = N; this.cell = DEFORM.cell;
    this.depth = new Float32Array(N * N);
    this._tmp = new Float32Array(N * N);
    this.ci = -0; this.cj = -0;     // ((P17) -0: Math.round's -0 never changes the field's kind of storage; see FloraField)
    this.frameVersion = -1;
    this.version = 0;
    // marks: positions relative to marks.origin (body-local axes)
    this.marks = { data: new Float32Array(DEFORM.marks * MARK_STRIDE), capacity: DEFORM.marks, head: 0, total: 0, origin: { x: 0, y: 0, z: 0 }, stride: MARK_STRIDE };
    this._walk = [];           // per-explorer stride state
    this._ship = [];           // per-ship pad state
    this._jet = [];            // per-jet scour timer
    this.legs = legs || [[0, 0, -3.2], [-2.2, 0, 1.8], [2.2, 0, 1.8]];
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
    for (const W of this._walk) W.has = false;
    for (const S of this._ship) { S.x -= X; S.z -= Z; }
    this.version++;
  }

  // disturbers: as in physics.update (ship disturbers may carry q and legContact).
  // groundOf(x, z, out) -> { sink, imprint, h, loose (0..1 granular), dust, mat (material index) } for a grid position.
  // fill: { snow: m/s of snow depth falling now, sand: 0..1 how hard sand is blowing }.
  update(dt, frame, fx, fz, disturbers, groundOf, g, time, fill) {
    const N = this.N, cell = this.cell;
    if (this.frameVersion !== frame.version) {
      const M = this.marks;
      M.data.fill(0); M.total = 0; M.head = 0;
      M.origin.x = frame.ox; M.origin.y = frame.oy; M.origin.z = frame.oz;
      this.frameVersion = frame.version; this.reset();
      this.ci = Math.round(fx / cell); this.cj = Math.round(fz / cell);
      for (const W of this._walk) W.has = false;
      for (const S of this._ship) S.down = 0;
    }
    const ni = Math.round(fx / cell), nj = Math.round(fz / cell);
    if (ni !== this.ci || nj !== this.cj) { scrollField(this.depth, this._tmp, N, 1, ni - this.ci, nj - this.cj, 0); this.ci = ni; this.cj = nj; this.version++; }
    this.uniforms.uPhysDeformMap[0] = this.ci * cell; this.uniforms.uPhysDeformMap[1] = this.cj * cell;

    // ---- healing: slump, snow filling in, sand blowing over -------------------------------------
    const fillRate = fill ? (fill.snow || 0) * DEFORM.snowFill + (fill.sand || 0) * DEFORM.sandFill : 0;   // m/s
    if (this._any) {
      const k = Math.exp(-dt / (DEFORM.fade * 0.6)), f = fillRate * dt;
      let any = false;
      const d = this.depth;
      for (let n = 0; n < N * N; n++) {
        let v = d[n];
        if (v === 0) continue;
        v *= k;
        if (v > 0) { v -= f; if (v < 2e-6) v = 0; } else { v += f; if (v > -2e-6) v = 0; }
        d[n] = v; if (v !== 0) any = true;
      }
      this._any = any; this.version++;
    }
    if (fillRate > 0) {
      // the marks themselves grow shallower; a filled mark is over
      const M = this.marks, f = fillRate * dt, n = M.total < M.capacity ? M.total : M.capacity;
      for (let k = 0; k < n; k++) {
        const o = k * MARK_STRIDE;
        if (M.data[o + 8] <= 0) continue;
        const nd = M.data[o + 8] - f;
        if (nd <= 0) { M.data[o + 8] = 0; M.data[o + 12] = 0; M.data[o + 11] = 0; }
        else { M.data[o + 12] *= nd / M.data[o + 8]; M.data[o + 8] = nd; }
      }
    }
    if (!disturbers) return;
    let wi = 0, si = 0, ji = 0;
    for (let k = 0; k < disturbers.length; k++) {
      const D = disturbers[k];
      if (!D || !D.p) continue;
      const x = frame.lx(D.p.x, D.p.y, D.p.z), z = frame.lz(D.p.x, D.p.y, D.p.z);
      if (D.kind === 'explorer') {
        const W = this._walk[wi] || (this._walk[wi] = { dist: 0, side: 1, lx: 0, lz: 0, has: false });
        wi++;
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
        this._mark(frame, mx, G.h, mz, hx, hz, DEFORM.footLength, DEFORM.footWidth, depth, W.side < 0 ? MARK.footLeft : MARK.footRight, time, DEFORM.fade * (0.15 + 0.85 * G.imprint), depth * DEFORM.rim * G.loose, G.mat);
        this._splat(mx, mz, depth * 0.6);
        // the rim: what was pressed out, piled a little ahead of and beside the print
        if (G.loose > 0.3) this._splat(mx + hx * 0.4, mz + hz * 0.4, -depth * DEFORM.rim * G.loose * 0.6);
      } else if (D.kind === 'ship') {
        // the pads of the landing gear: a mark each time a foot comes down
        const S = this._ship[si] || (this._ship[si] = { down: 0, x: 1e9, z: 1e9, c: [0, 0, 0] });
        si++;
        if (!D.q) continue;
        const speed = D.v ? Math.hypot(D.v.x, D.v.y, D.v.z) : 0;
        for (let i = 0; i < 3; i++) {
          const L = this.legs[i];
          qRot(D.q, L[0], L[1], L[2], _a);
          const px = D.p.x + _a[0], py = D.p.y + _a[1], pz = D.p.z + _a[2];
          const lx = frame.lx(px, py, pz), lz = frame.lz(px, py, pz);
          const G = groundOf(lx, lz, _g);
          const hgt = Math.hypot(px, py, pz) - (frame.r0 + G.h);
          // a foot is down when the gear model says so, or (without it) when the ship rests on the ground
          // a foot presses the ground only where it is: whatever the caller's flags say, a
          // foot more than a hand's breadth up leaves no print
          const down = hgt < 0.25 && (D.legContact ? D.legContact[i] > 0 : speed < 0.3);
          if (down && !S.c[i]) {
            const depth = Math.min(DEFORM.padMax, G.sink * DEFORM.padPressure);
            if (depth >= 0.002) {
              // forward of the ship, for the mark's direction
              qRot(D.q, 0, 0, -1, _a);
              const fx2 = _a[0] * frame.ex + _a[1] * frame.ey + _a[2] * frame.ez, fz2 = _a[0] * frame.nx + _a[1] * frame.ny + _a[2] * frame.nz, fl = Math.hypot(fx2, fz2) || 1;
              this._mark(frame, lx, G.h, lz, fx2 / fl, fz2 / fl, DEFORM.padRadius * 2, DEFORM.padRadius * 2, depth, MARK.gear, time, DEFORM.fade * 2 * (0.15 + 0.85 * G.imprint), depth * DEFORM.rim * G.loose, G.mat);
              this._splat(lx, lz, depth);
            }
          }
          S.c[i] = down ? 1 : 0;
        }
      } else if (D.kind === 'jet' || D.kind === 'downwash') {
        // a jet scours loose ground into a shallow dish with a raised ring
        const J = this._jet[ji] || (this._jet[ji] = { t: 0 });
        ji++;
        const G = groundOf(x, z, _g);
        const hgt = Math.hypot(D.p.x, D.p.y, D.p.z) - (frame.r0 + G.h);
        const R = (D.radius || 0.4) + 0.25 * Math.max(0, hgt);
        const q = (D.strength || 0) / (Math.PI * R * R);
        const loose = Math.max(G.loose, G.dust * 0.5);
        if (q < DEFORM.scourLoad || loose < 0.1) { J.t = DEFORM.scourEvery; continue; }
        J.t += dt;
        // the dish deepens while the jet stays: a few millimetres a second, more when stronger
        const rate = 0.004 * loose * clamp01(q / 400);
        this._dish(x, z, R, rate * dt);
        if (J.t >= DEFORM.scourEvery) {
          J.t = 0;
          this._mark(frame, x, G.h, z, 1, 0, R * 2, R * 2, Math.min(0.08, rate * 6), MARK.scour, time, DEFORM.fade * 0.5 * (0.15 + 0.85 * G.imprint), Math.min(0.03, rate * 2), G.mat);
        }
      }
    }
  }

  _mark(frame, x, y, z, hx, hz, length, width, depth, kind, time, life, rim, mat) {
    const M = this.marks, o = M.head * MARK_STRIDE, d = M.data;
    d[o] = frame.ex * x + frame.ax * y + frame.nx * z;
    d[o + 1] = frame.ey * x + frame.ay * y + frame.ny * z;
    d[o + 2] = frame.ez * x + frame.az * y + frame.nz * z;
    d[o + 3] = frame.ex * hx + frame.nx * hz; d[o + 4] = frame.ey * hx + frame.ny * hz; d[o + 5] = frame.ez * hx + frame.nz * hz;
    d[o + 6] = length; d[o + 7] = width; d[o + 8] = depth; d[o + 9] = kind; d[o + 10] = time; d[o + 11] = life;
    d[o + 12] = rim || 0; d[o + 13] = mat != null ? mat : 255;
    M.head = (M.head + 1) % M.capacity; M.total++;
  }

  // Add `depth` (positive pressed in, negative piled up) at grid position (x, z), bilinearly.
  _splat(x, z, depth) {
    const N = this.N, cell = this.cell;
    const u = x / cell - this.ci + N / 2 - 0.5, v = z / cell - this.cj + N / 2 - 0.5;
    const i = Math.floor(u), j = Math.floor(v);
    if (i < 0 || j < 0 || i > N - 2 || j > N - 2) return;
    const fu = u - i, fv = v - j, n = j * N + i, d = this.depth;
    if (depth >= 0) {
      d[n] = Math.max(d[n], depth * (1 - fu) * (1 - fv)); d[n + 1] = Math.max(d[n + 1], depth * fu * (1 - fv));
      d[n + N] = Math.max(d[n + N], depth * (1 - fu) * fv); d[n + N + 1] = Math.max(d[n + N + 1], depth * fu * fv);
    } else {
      // a rim only rises where the ground is not already pressed down
      const w = [(1 - fu) * (1 - fv), fu * (1 - fv), (1 - fu) * fv, fu * fv], idx = [n, n + 1, n + N, n + N + 1];
      for (let k = 0; k < 4; k++) if (d[idx[k]] <= 0) d[idx[k]] = Math.min(d[idx[k]], depth * w[k]);
    }
    this._any = true; this.version++;
  }

  // A dish of radius R scoured by `amount` metres at the centre, with a low ring round it.
  _dish(x, z, R, amount) {
    const N = this.N, cell = this.cell, d = this.depth;
    const i0 = Math.max(0, Math.floor((x - R * 1.5) / cell - this.ci + N / 2)), i1 = Math.min(N - 1, Math.ceil((x + R * 1.5) / cell - this.ci + N / 2));
    const j0 = Math.max(0, Math.floor((z - R * 1.5) / cell - this.cj + N / 2)), j1 = Math.min(N - 1, Math.ceil((z + R * 1.5) / cell - this.cj + N / 2));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const cx = (this.ci + i - N / 2 + 0.5) * cell - x, cz = (this.cj + j - N / 2 + 0.5) * cell - z;
      const u = Math.hypot(cx, cz) / R;
      if (u > 1.5) continue;
      const n = j * N + i;
      // scoured inside, piled just outside (volume roughly kept), never deeper than 12 cm
      const dv = u < 1 ? amount * (1 - u * u) : -amount * 0.6 * (1 - smoothstep(1, 1.5, u)) * smoothstep(1, 1.15, u);
      d[n] = Math.max(-0.05, Math.min(0.12, d[n] + dv));
    }
    this._any = true; this.version++;
  }

  // Depth (m) pressed into the ground at grid position (x, z); negative on a rim.
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
