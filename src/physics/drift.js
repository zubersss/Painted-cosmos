// Painted Cosmos physics: drifts. OWNER: PHYSICS. Pure (no three, no DOM).
//
// Wind does not leave loose snow or sand lying level. Where the air is slowed (behind a rise,
// in a hollow, behind a boulder field or a landed hull) what it carries drops out and piles
// up; where it speeds up (a crest, a windward face) the ground is scoured, in the end bare.
// The measure used in snow hydrology for this is Winstral's Sx (Winstral, Elder and Davis
// 2002): from each point look UPWIND and take the steepest line of sight to the ground out to
// some distance; Sx > 0 means there is higher ground upwind (shelter, deposition). Measured
// drift depth follows it closely; so do the sand tails behind rocks on Mars. Where nothing
// shelters a point, the ground rising into the wind there says how exposed it is (scour).
//
// DriftField keeps, on a 64 x 64 grid of 0.5 m cells round the focus (the same grid as the
// ground marks), a FACTOR f: how much loose material lies at a cell, in units of the depth that
// lies on level ground here (`level`: the snow depth from the weather, or the thin loose layer
// that saltation moves about on sand and dust). f = 0 level, +1 twice as deep, -1 blown bare.
//   depth(x, z) = f * level           (m above the level deposit; negative where scoured)
// f relaxes toward its equilibrium for the wind as it blows now, at a rate set by how hard the
// wind is moving material (nothing moves in a calm: yesterday's drifts stay). The equilibrium
// is a function of the ground, the hull and the wind direction only, so drifts are where they
// were when the walker comes back, they melt with the snow and deepen with the next fall, and
// a drift never grows deeper than most of the step it lies behind.
// The wind direction is eased over 20 s: a drift does not turn with every gust.
import { clamp, clamp01, smoothstep } from './util.js';
import { scrollField } from './near.js';

export const DRIFT = Object.freeze({
  N: 64, cell: 0.5,
  // m upwind where the horizon is looked for. Lee drifts behind an obstacle of height H reach
  // 5 to 10 H (Tabler 1994), so 12 m covers steps of a metre or two; larger relief is terrain.
  reach: Object.freeze([1, 2, 3, 4.5, 6.5, 9, 12]),
  lee: 0.2,            // tan of the upwind sight line at which the deposit is twice the level one
  gain: 2.5,           // the most a lee holds, in level depths
  fill: 0.8,           // a drift fills at most this share of the step it lies behind
  rise: 1.5,           // m upwind over which the ground's rise into the wind is measured
  scour: 0.05,         // rise into the wind (tan) at which scouring starts ...
  scourFull: 0.3,      // ... and at which the ground is blown bare (17 degrees)
  sandLayer: 0.12,     // m: the loose layer blowing sand moves about, on the loosest ground
  rate: 1 / 40,        // 1/s in a full gale: a drift is two thirds built in 40 s (the weather's clock runs fast)
  turn: 20,            // s over which the drifting direction follows the wind
  rows: 4,             // rows of the grid whose equilibrium is refreshed each update (a pass takes 16 updates)
  hullHeight: 2.2,     // m: a landed hull as an obstacle (its top is this far over its feet)
});

export class DriftField {
  constructor() {
    const N = DRIFT.N;
    this.N = N; this.cell = DRIFT.cell;
    this.f = new Float32Array(N * N);              // the factor now
    this.eq = new Float32Array(N * N).fill(NaN);   // its equilibrium (NaN: not worked out yet)
    this._tmp = new Float32Array(N * N);
    this.ci = 0; this.cj = 0;                      // grid cell under the centre
    this.de = 1; this.dn = 0;                      // the way the drifting wind blows (unit, toward)
    this.level = 0;                                // m of loose material on level ground here
    this.row = 0; this.version = 0; this.frameVersion = -1; this.fresh = true;
    this.uniforms = { uPhysDriftMap: [0, 0, 1 / (N * DRIFT.cell), N], uPhysDriftLevel: [0] };
  }

  reset() { this.f.fill(0); this.eq.fill(NaN); this.row = 0; this.fresh = true; this.version++; }

  // The frame has re-anchored at old grid position (X, Z).
  rebase(frame, X, Z) {
    this.frameVersion = frame.version;
    this.ci -= Math.round(X / this.cell); this.cj -= Math.round(Z / this.cell);
  }

  // Equilibrium factor at grid position (x, z) for wind blowing toward (de, dn).
  // near: TerrainGrid (heightAt(x, z, fallback) in m above the frame's datum).
  // shelters: Float32Array of [x, z, top (m above the datum), radius] x n (landed hulls).
  equilibrium(x, z, near, level, shelters, n) {
    const z0 = near.heightAt(x, z, NaN);
    if (z0 !== z0) return NaN;
    // under standing liquid nothing lies at all (a pool on a terrace, the sea, a cloud sea)
    if (near.liquidAt) { const lq = near.liquidAt(x, z); if (lq > z0) return -1; }
    const R = DRIFT.reach, de = this.de, dn = this.dn;
    let sx = -1e9, step = 0;
    for (let k = 0; k < R.length; k++) {
      const d = R[k], ux = x - de * d, uz = z - dn * d;
      let h = near.heightAt(ux, uz, NaN);
      if (h !== h) continue;                                   // beyond the ground that is known
      for (let s = 0; s < n; s++) { const o = s * 4, dx = ux - shelters[o], dz = uz - shelters[o + 1]; if (dx * dx + dz * dz < shelters[o + 3] * shelters[o + 3] && shelters[o + 2] > h) h = shelters[o + 2]; }
      const t = (h - z0) / d;
      if (t > sx) { sx = t; step = h - z0; }
    }
    if (sx < -1e8) return 0;
    if (sx > 0) {
      let f = sx / DRIFT.lee; if (f > DRIFT.gain) f = DRIFT.gain;
      const cap = DRIFT.fill * step / Math.max(level, 0.02);    // never deeper than most of the step
      return f < cap ? f : cap;
    }
    // Not sheltered: is it exposed? Sx hardly says (on a windward face the far, flat ground upwind
    // lies only just under the line of sight). What speeds the air up and strips the ground is
    // the ground rising INTO the wind, on the face and over the crest (the speed-up over a
    // ridge goes as its slope; Jackson and Hunt 1975): the rise over the last metre and a half.
    const up = near.heightAt(x - de * DRIFT.rise, z - dn * DRIFT.rise, NaN);
    if (up !== up) return 0;
    return -clamp01(((z0 - up) / DRIFT.rise - DRIFT.scour) / (DRIFT.scourFull - DRIFT.scour));
  }

  // dt: s.  (fx, fz): focus in grid coordinates.  near: the near TerrainGrid.  (we, wn): wind at
  // the focus (m/s, east / north).  level: m of loose material lying on level ground here (0:
  // nothing to drift).  transport01: how hard the wind is moving it (0 calm .. 1 a gale).
  // shelters, n: landed hulls, as in equilibrium().
  update(dt, frame, fx, fz, near, we, wn, level, transport01, shelters, n) {
    const N = this.N, cell = this.cell;
    if (this.frameVersion !== frame.version) { this.frameVersion = frame.version; this.reset(); this.ci = Math.round(fx / cell); this.cj = Math.round(fz / cell); }
    const ni = Math.round(fx / cell), nj = Math.round(fz / cell);
    if (ni !== this.ci || nj !== this.cj) {
      scrollField(this.f, this._tmp, N, 1, ni - this.ci, nj - this.cj, 0);
      scrollField(this.eq, this._tmp, N, 1, ni - this.ci, nj - this.cj, NaN);
      this.ci = ni; this.cj = nj; this.version++;
    }
    this.uniforms.uPhysDriftMap[0] = this.ci * cell; this.uniforms.uPhysDriftMap[1] = this.cj * cell;
    this.level = level > 0 ? level : 0; this.uniforms.uPhysDriftLevel[0] = this.level;
    if (!(level > 0)) { if (!this.fresh) this.reset(); return; }
    // the drifting direction follows the wind slowly (at once on the first update here)
    const sp = Math.hypot(we, wn);
    if (sp > 0.5) {
      // (and only while the wind is moving material: the drifts lie as the last wind that could shape them left them)
      const k = this.fresh ? 1 : 1 - Math.exp(-dt / DRIFT.turn * clamp01(transport01 * 4));
      // (turned through the angle between them, so that a wind that backs right round is followed too)
      const ax = we / sp, az = wn / sp, a = Math.atan2(this.de * az - this.dn * ax, this.de * ax + this.dn * az) * k;
      const c = Math.cos(a), sn = Math.sin(a), de = this.de * c - this.dn * sn, dn = this.de * sn + this.dn * c;
      this.de = de; this.dn = dn;
    }
    // refresh the equilibrium: all of it on arrival (the drifts are already there), else a few rows
    const half = (N - 1) / 2, f = this.f, eq = this.eq;
    const rows = this.fresh ? N : DRIFT.rows, k = 1 - Math.exp(-dt * DRIFT.rate * clamp01(transport01));
    for (let r = 0; r < rows; r++) {
      const j = this.row; this.row = (this.row + 1) % N;
      const z = (this.cj + j - half) * cell;
      for (let i = 0; i < N; i++) {
        const o = j * N + i, was = eq[o];
        const e = this.equilibrium((this.ci + i - half) * cell, z, near, level, shelters, n);
        eq[o] = e;
        // a cell seen for the first time holds its drift already: the wind did not start when we arrived
        if (was !== was && e === e) f[o] = e;
      }
    }
    if (this.fresh) { this.fresh = false; this.version++; return; }
    if (k > 0) {
      for (let o = 0; o < N * N; o++) { const e = eq[o]; if (e === e) f[o] += (e - f[o]) * k; }
      this.version++;
    }
  }

  // Factor at a grid position (bilinear; 0 outside the field).
  factorAt(x, z) {
    const N = this.N, half = (N - 1) / 2;
    const u = x / this.cell - this.ci + half, v = z / this.cell - this.cj + half;
    if (!(u >= 0 && v >= 0 && u <= N - 1 && v <= N - 1)) return 0;
    const i = Math.min(N - 2, u | 0), j = Math.min(N - 2, v | 0), a = u - i, b = v - j, o = j * N + i, F = this.f;
    return (F[o] * (1 - a) + F[o + 1] * a) * (1 - b) + (F[o + N] * (1 - a) + F[o + N + 1] * a) * b;
  }
  // m of loose material above (below) the level deposit at a grid position.
  depthAt(x, z) { return this.factorAt(x, z) * this.level; }
}

// How hard the wind is moving snow (0..1). U: wind speed at the focus (m/s); wet01: wet snow
// does not blow (it needs twice the wind); snowfall01: snow that is falling goes to the lee as
// it lands, in any wind that can carry a flake sideways.
// (Dry fresh snow starts to move at about 4 to 5 m/s at 10 m; Li and Pomeroy 1997.)
export function snowTransport01(U, wet01, snowfall01) {
  const dry = smoothstep(4, 10, U / (1 + clamp01(wet01)));
  const falling = 0.6 * clamp01(snowfall01) * smoothstep(1, 4, U);
  return clamp(dry > falling ? dry : falling, 0, 1);
}
