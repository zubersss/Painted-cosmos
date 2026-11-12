// Painted Cosmos physics: the sea map (P18). OWNER: PHYSICS. Pure (no three, no DOM).
//
// Until P18 the sea was one state round the focus: raised over the fetch measured from one water point (P16), the same
// over a sheltered bay and over the open shore beside it, and running straight down the wind everywhere. Here the sea
// is raised at every node of two levels round the focus, each over its OWN fetch and depth:
//   inner level: the wind grid's 17 x 17 nodes, 16 m apart (its ground and liquid are already sampled);
//   outer level: 17 x 17 nodes 128 m apart, 2 km across (a grid of its own, a few samples a frame, only near liquid);
//   far rose:    24 radials from the most open water about, measured out to the biome's fetch (2500 m on sea coasts).
// At each wet node:
//   FETCH by direction: eleven radials 15 degrees apart about upwind (+-75), each run upwind over the levels' liquid
//     until dry ground; one that leaves both levels still wet is carried on by the far rose (the far shore taken as
//     square to the radial). The fetch of a heading is the mean of its radial and its two neighbours (1/4, 1/2, 1/4:
//     about the 24 degrees of the Shore Protection Manual's radials).
//   THE TURN TOWARD THE LONGEST FETCH: the wind sea runs where it grows highest, the heading phi off the wind that
//     makes the most of U cos(phi) over the fetch that way (fetch-limited: H ~ U cos(phi) sqrt(F); fully developed:
//     H ~ (U cos(phi))^2). Over an irregular shore the waves are slanted toward the longer fetch (Donelan, Skafel,
//     Graber, Liu, Schwab and Venkatesh 1992; Pettersson, Kahma and Tuomi 2010 measured the same in the Gulf of
//     Finland); under a wind blowing along a long lake the sea runs along the lake, not down the wind.
//   THE SEA: windSea (SPM 1984, depth-limited) at that heading over that fetch and the mean depth along it; whitecaps
//     from its own steepness; the open sea's swell reaches it as far as its fetch toward the wind (+-45 degrees: the
//     swell's spread and diffraction round a headland) is open (WATER.swellOpen).
//   REFRACTION AND SHOALING (inner level): where the water is shallower than half a wavelength the waves slow, and a
//     crest that comes in at an angle turns toward the depth contours (Snell: sin(theta) / c is kept along a ray, c / c0
//     = tanh(k d) for each period); the height changes by the shoaling coefficient sqrt(cg0 / cg) and the refraction
//     coefficient sqrt(cos(theta0) / cos(theta)) (straight, parallel contours locally). Waves running off a shore (an
//     offshore wind) are left alone.
// The reference sea (the trains the field runs, their lengths and phases) is the sea of the most exposed node: every
// other node is that sea scaled (water.js SEA_TEX). Where the map turns the waves, the trains are read at a warped
// place g + warp(g) whose Jacobian is the turn: the warp is the least-squares fit of grad(warp) = R(alpha) - I over the
// inner level (Gauss-Seidel with over-relaxation, warm-started from the last build), so crests stay continuous lines
// that bend. The turns die out over the inner level's last 2.5 cells, where it meets water read straight.
// Built in slices over about twenty frames (a fraction of a millisecond each) when the ground, the wind or the far
// measurements change, and at most every few seconds.
import { windSea, WATER, fetchOf, SEA_TEX } from './water.js';
import { TerrainGrid } from './near.js';
import { smoothstep, TAU } from './util.js';

const DEG = Math.PI / 180;
export const SEA_MAP = Object.freeze({
  N: SEA_TEX.N,
  outerCell: 128,                 // m between the outer level's nodes (2 km across)
  radials: 11, spacing: 15,       // radials at (k - 5) x 15 degrees about upwind
  turnMax: 4,                     // headings up to 4 x 15 degrees off the wind
  step: 12, stepGrow: 0.1,        // m: the march's step, growing by this share of the distance gone beyond the inner level
  rose: 24,                       // radials of the far rose (15 degrees apart), from the far point
  roseCell: 48,                   // m: a rose holds for a far point within this (or a tenth of its mean fetch) ...
  roseKeep: 8,                    // ... and this many are kept
  roseStep0: 16,                  // m: its first step (growing by stepGrow)
  minDepth: 1,                    // m: the reference and the far point are water at least this deep
  swellW: [0.25, 0.5, 0.75, 1, 0.75, 0.5, 0.25],   // radials 2 .. 8 (+-45 degrees about upwind) for the swell's reach
  every: 4,                       // s: a build at least this often while there is liquid about ...
  soonest: 0.75,                  // ... and no sooner than this after the last one
  windTurn: 5 * DEG, windRel: 0.08,   // a build when the wind has turned or changed this much since the last
  dirTurn: 2 * DEG,               // ... or the reference sea's own way has turned this much (the turns are against it)
  rows: [2, 3, 4],                // inner rows marched a frame, by quality (the outer level twice that)
  sweeps: 12, sweepFrames: 4,     // Gauss-Seidel sweeps of the warp a frame, for this many frames
  sor: 1.8,
  edgeTaper: 2.5,                 // inner cells over which the turns die out toward the inner level's edge ...
  edgeZero: 1,                    // ... (P19) to nothing this many cells short of it: the farthest out the shown warp is read
                                  // (water.js _composeMap: the band's edge lies SEA_TEX.margin inside the grid, the warp is
                                  // read up to half the band inside that), so beyond the band the warp holds no turn
  kSMax: 1.4,                     // the most shoaling and refraction may raise a wave before it breaks (the chunk's 0.78 d caps it)
  turnMaxRad: 1.2,                // a turn is never more than this (rad)
});
const NR = SEA_MAP.radials, MID = (NR - 1) >> 1, N = SEA_MAP.N, NN = N * N;

// Wavelength of period T (s) in water d m deep under gravity g (Fenton and McKee 1990, as windSea)
function lengthAt(T, d, g) {
  const L0 = g * T * T / TAU;
  return d < L0 ? L0 * Math.pow(Math.tanh(Math.pow(TAU * Math.max(d, 1e-3) / L0, 0.75)), 2 / 3) : L0;
}
const wrap = (a) => a - TAU * Math.round(a / TAU);
const tri = (A, m) => 0.25 * A[m - 1] + 0.5 * A[m] + 0.25 * A[m + 1];       // a heading's fetch from its radial and the two beside it

// THE FAR ROSE: 24 radials from one point (geographic: radial k runs k x 15 degrees from east toward north), each upwind
// over the world's liquid until dry ground or the cap, in steps of 16 m growing by a tenth of the distance gone (as the
// P16 gauge's radials). Measured a few samples a frame; kept by place. A radial still running is a lower bound.
export class FetchRose {
  constructor() {
    this.r = new Float64Array(SEA_MAP.rose); this.dsum = new Float64Array(SEA_MAP.rose); this.wet = new Float64Array(SEA_MAP.rose);
    this.done = new Uint8Array(SEA_MAP.rose); this.capped = new Uint8Array(SEA_MAP.rose);   // (capped: ran to the cap, met no shore)
    this.body = null; this.x = 0; this.y = 1; this.z = 0; this.cap = 0; this.pointDepth = 0;
    this.ok = false;            // a point is set
    this.ready = false;         // every radial has finished
    this.samples = 0;           // sampleSurface calls made in the last update
    this.measured = 0;          // roses finished
    this.version = 0;           // bumps whenever a radial moves
    this.kept = [];
    this._k = 0; this._q = { x: 0, y: 0, z: 1 };
    this._e = [1, 0, 0]; this._n = [0, 0, -1];
  }
  // A new point (unit, body-local) to measure from: a kept rose there is taken whole, else the measurement starts.
  setPoint(body, px, py, pz, R, cap, pointDepth) {
    if (this.ok && body === this.body && cap === this.cap && R * Math.acos(Math.min(1, px * this.x + py * this.y + pz * this.z)) < 1) return;
    if (this.ok && this.ready) this._keep();
    this.body = body; this.x = px; this.y = py; this.z = pz; this.R = R; this.cap = cap; this.pointDepth = pointDepth; this.ok = true;
    let ex = pz, ez = -px; const el = Math.hypot(ex, ez);
    if (el < 1e-6) { ex = 1; ez = 0; } else { ex /= el; ez /= el; }
    this._e[0] = ex; this._e[1] = 0; this._e[2] = ez;
    this._n[0] = py * ez; this._n[1] = pz * ex - px * ez; this._n[2] = -py * ex;
    for (let i = 0; i < this.kept.length; i++) {
      const m = this.kept[i];
      if (m.body !== body || m.cap !== cap) continue;
      let f = 0; for (let k = 0; k < m.r.length; k++) f += m.r[k];
      if (R * Math.acos(Math.min(1, m.x * px + m.y * py + m.z * pz)) <= Math.max(SEA_MAP.roseCell, 0.1 * f / m.r.length)) {
        this.r.set(m.r); this.dsum.set(m.dsum); this.wet.set(m.wet); this.capped.set(m.capped); this.done.fill(1); this.ready = true; this._k = SEA_MAP.rose; this.version++;
        this.kept.splice(i, 1); this.kept.unshift(m);
        return;
      }
    }
    this.r.fill(0); this.dsum.fill(0); this.wet.fill(0); this.capped.fill(0); this.done.fill(cap > 0 ? 0 : 1); this.ready = !(cap > 0); this._k = 0; this.version++;
  }
  _keep() {
    const m = { body: this.body, x: this.x, y: this.y, z: this.z, cap: this.cap, r: Float64Array.from(this.r), dsum: Float64Array.from(this.dsum), wet: Float64Array.from(this.wet), capped: Uint8Array.from(this.capped) };
    this.kept = this.kept.filter((k) => !(k.body === m.body && k.cap === m.cap && Math.abs(k.x - m.x) + Math.abs(k.y - m.y) + Math.abs(k.z - m.z) < 1e-9));
    this.kept.unshift(m); if (this.kept.length > SEA_MAP.roseKeep) this.kept.pop();
  }
  reset() { if (this.ok && this.ready) this._keep(); this.ok = false; this.ready = false; this.r.fill(0); this.version++; }
  // One frame: up to `budget` sampleSurface calls (and the clock's ration after the first two).
  update(sample, budget, clock = null, ms = 0) {
    this.samples = 0;
    if (!this.ok || this.ready) return 0;
    const n = SEA_MAP.rose, q = this._q, t0 = clock ? clock() : 0, R = this.R;
    let moved = false;
    for (let pass = 0; pass < 2 * n && this.samples < budget; pass++) {
      if (clock && this.samples >= 2 && clock() - t0 > ms) break;
      const k = this._k % n; this._k++;
      if (this.done[k]) { if (this.done.every((x) => x)) break; continue; }
      const r0 = this.r[k], r1 = Math.min(this.cap, r0 + Math.max(SEA_MAP.roseStep0, SEA_MAP.stepGrow * r0));
      const a = k / n * TAU, ca = Math.cos(a), sa = Math.sin(a), e = this._e, nn = this._n;
      const bx = e[0] * ca + nn[0] * sa, by = e[1] * ca + nn[1] * sa, bz = e[2] * ca + nn[2] * sa;
      const th = r1 / R, c = Math.cos(th), s = Math.sin(th);
      q.x = this.x * c + bx * s; q.y = this.y * c + by * s; q.z = this.z * c + bz * s;
      const S = sample(q); this.samples++; moved = true;
      const d = S ? (S.liquidRadius || 0) - S.radius : -1;
      if (d > 0) { this.dsum[k] += d * (r1 - r0); this.wet[k] += r1 - r0; this.r[k] = r1; if (r1 >= this.cap) { this.done[k] = 1; this.capped[k] = 1; } }
      else { this.r[k] = 0.5 * (r0 + r1); this.done[k] = 1; }
    }
    if (moved) this.version++;
    if (this.done.every((x) => x)) { if (!this.ready) { this.ready = true; this.measured++; this._keep(); } }
    return this.samples;
  }
  // The rose along geographic angle a (rad from east toward north): o[0] fetch (m, interpolated), o[1] the mean depth along
  // it (m), o[2] how far it ran to the cap rather than to a shore (0..1: open water as far as the cap allows)
  at(a, o) {
    const n = SEA_MAP.rose, t = ((a / TAU * n) % n + n) % n, i = Math.floor(t) % n, j = (i + 1) % n, f = t - Math.floor(t);
    o[0] = this.r[i] * (1 - f) + this.r[j] * f;
    o[2] = this.capped[i] * (1 - f) + this.capped[j] * f;
    const di = this.wet[i] > 0 ? this.dsum[i] / this.wet[i] : this.pointDepth, dj = this.wet[j] > 0 ? this.dsum[j] / this.wet[j] : this.pointDepth;
    o[1] = di * (1 - f) + dj * f;
    return o;
  }
  // (for the probes: the mean of the radials, the API's `fetch` of the old gauge)
  get mean() { let f = 0; for (let k = 0; k < this.r.length; k++) f += this.r[k]; return f / this.r.length; }
}

const _ro = new Float64Array(3);
// REFRACTION AND SHOALING of a wave of period T running toward theta (rad) in water d m deep under gravity g, over
// straight contours whose shoreward normal is nu (rad) and whose depth falls gl per metre toward it: o[0] the way it runs
// here, o[1] its shoaling x refraction coefficient (Snell: sin(theta) / c kept, c / c0 = L / L0 = tanh(k d); Ks =
// sqrt(cg0 / cg); Kr = sqrt(cos(theta0) / cos(theta))). A wave running off the shore, or a flat bottom, is not turned.
function turnAt(theta, T, d, g, nu, gl, o) {
  if (!(T > 0)) { o[0] = theta; o[1] = 1; return; }
  const L0 = g * T * T / TAU, L = lengthAt(T, d, g), kd = TAU * d / L, ratio = L / L0;
  const n1 = 0.5 * (1 + (kd < 20 ? 2 * kd / Math.sinh(2 * kd) : 0)), Ks = Math.sqrt(0.5 / (n1 * ratio));
  const p0 = wrap(theta - nu), cp = Math.cos(p0), w = smoothstep(0, 0.35, cp) * smoothstep(0.003, 0.02, gl);
  if (!(w > 0)) { o[0] = theta; o[1] = Math.min(SEA_MAP.kSMax, Ks); return; }
  const p1 = Math.asin(Math.max(-1, Math.min(1, Math.sin(p0) * ratio)));
  const Kr = Math.sqrt(Math.max(cp, 1e-3) / Math.max(Math.cos(p1), 1e-3));
  o[0] = theta + w * wrap(nu + p1 - theta); o[1] = Math.min(SEA_MAP.kSMax, Ks * (1 + w * (Kr - 1)));
}
const _d3 = new Float64Array(3);
let _capBody = 'earth';
function capInto(surface, arr, o) { arr[o] = fetchOf(surface && surface.biomeId); }

export class SeaMap {
  constructor() {
    this.outer = new TerrainGrid(N, SEA_MAP.outerCell, 1);    // cover: the biome's fetch (the cap) at each node
    this.rose = new FetchRose();
    // the snapshot a build works on: depth at every node of both levels (m; negative dry, NaN unknown), the cap
    this.D = new Float32Array(2 * NN); this.cap = new Float32Array(2 * NN);
    this.run = new Float32Array(2 * NN * NR); this.rdep = new Float32Array(2 * NN * NR); this.rex = new Uint8Array(2 * NN * NR);
    // per node of both levels: F, D, H, T, L, wc, open, heading (rad), Ffar weight; and the inner level's alpha
    this.sea = new Float32Array(2 * NN * 8);
    this.alpha = new Float32Array(NN); this.wx = new Float32Array(NN); this.wz = new Float32Array(NN);
    this.target = {
      on: false, version: 0, N, cell: 16, x0: 0, z0: 0, N2: 0, cell2: SEA_MAP.outerCell, x02: 0, z02: 0,
      warp: new Float32Array(NN * 2), inner: new Float32Array(NN * 4), outer: new Float32Array(NN * 4),
      info: new Float32Array(2 * NN * 6), depth: new Float32Array(2 * NN),
      HsRef: 0, wcRef: 0, refFetch: 0, refDepth: 0, refHeading: 0, refU: 0, ref: -1, refX: 0, refZ: 0,
      // (P19) the inner grid of the build under way (from its snapshot until it is published): WaterField keeps the band
      // where the inner level gives way to the outer one inside it too, so nothing shown steps when the build lands
      nextOn: false, nextX0: 0, nextZ0: 0,
    };
    this.stage = 0; this.row = 0; this.sweep = 0; this.last = -1e9; this.built = 0; this.ref = -1; this._betterWp = -1;
    this._b = { x0: 0, z0: 0, cell: 16, x02: 0, z02: 0, ok2: false, U: 0, aU: 0, g: 9.81, rhoA: 1.2, rhoL: 1000, dirA: 0, swellH: 0, swellT: 0, depthLevel: 0, R: 1, body: null, rv: -1 };
    this._seen = { inner: -1, outer: -1, rose: -1, U: 0, aU: 0, dirA: 0 };
    this.wp = { ok: false, x: 0, z: 0, n: -1, depth: 0, cap: 80 };      // the far point (frame position), the inner node it is at
    this.stats = { samples: 0, built: 0 };
  }
  reset() { this.stage = 0; this.last = -1e9; this.target.on = false; this.target.nextOn = false; this.wp.ok = false; this.rose.reset(); this.outer.invalidate(); this.outer.frameVersion = -1; }
  // The frame re-anchored: the outer level's cells (128 m) do not divide the 16 m lattice, so it is sampled afresh;
  // a build under way is dropped (its positions are in the old frame). (P19) The published target moves into the new frame
  // with the ground it describes: the next build warm-starts its warp from it node by node and keeps its free constant
  // (the crests stay put on average); left in the old frame it was 24 cells off after a 384 m re-anchor, the warp started
  // cold and the crests slid 15 to 17 m in the 5 s after each re-anchor (review 7, finding 2). WaterField.rebase moves
  // what it shows by the same, so attachMap still finds the shown nodes and the target's on the same ground.
  rebase(X, Z) {
    this.outer.invalidate(); this.outer.frameVersion = -1; this.stage = 0; this.last = -1e9;
    if (this.wp.ok) { this.wp.x -= X; this.wp.z -= Z; }
    const T = this.target; T.x0 -= X; T.z0 -= Z; T.x02 -= X; T.z02 -= Z; T.refX -= X; T.refZ -= Z; T.nextOn = false;
  }

  // One frame. c: { frame, air (the AirGrid), bodyId, R, level (liquid surface about, or -1e9), we, wn (the 10 m wind,
  // frame axes), g, rhoAir, rhoLiq, dir (the reference sea's way, [e, n]), swellHeight, swellLength, sample, budget,
  // clock, ms, quality, fx, fz, time }. Returns sampleSurface calls made.
  update(c) {
    this.stats.samples = 0;
    const T = c.air.terrain;
    if (!(c.level > -1e8)) { if (this.target.on) { this.target.on = false; this.target.version++; } this.stage = 0; this.target.nextOn = false; return 0; }
    _capBody = c.bodyId;
    // the outer level first (it is the 2 km picture), then the far rose with what is left
    let used = this.outer.update(c.frame, c.fx, c.fz, c.sample, c.budget, capInto, c.clock, c.ms);
    if (this.wp.ok && used < c.budget) {
      c.frame.dir(this.wp.x, this.wp.z, _d3);
      this.rose.setPoint(c.bodyId, _d3[0], _d3[1], _d3[2], c.R, this.wp.cap, this.wp.depth);
      used += this.rose.update(c.sample, c.budget - used, c.clock, c.ms);
    }
    this.stats.samples = used;
    // the build, in slices
    if (this.stage === 0) {
      const U = Math.hypot(c.we, c.wn), aU = Math.atan2(-c.wn, -c.we), dA = Math.atan2(c.dir[1], c.dir[0]), S = this._seen;
      const due = c.time - this.last >= SEA_MAP.every || c.time < this.last;
      const moved = T.changed !== S.inner || this.outer.changed !== S.outer || this.rose.version !== S.rose
        || Math.abs(wrap(aU - S.aU)) > SEA_MAP.windTurn || Math.abs(U - S.U) > SEA_MAP.windRel * Math.max(S.U, 1) || Math.abs(wrap(dA - S.dirA)) > SEA_MAP.dirTurn;
      if ((due || moved) && c.time - this.last >= SEA_MAP.soonest || !this.target.on && c.time - this.last >= 0.1 || c.time < this.last) {
        S.inner = T.changed; S.outer = this.outer.changed; S.rose = this.rose.version; S.U = U; S.aU = aU; S.dirA = dA;
        this._snapshot(c, T, U, aU, dA); this.stage = 1; this.row = 0; this.last = c.time;
      }
      return used;
    }
    const rows = SEA_MAP.rows[c.quality] || 3;
    if (this.stage === 1) { for (let k = 0; k < rows && this.row < N; k++, this.row++) this._marchRow(0, this.row); if (this.row >= N) { this.stage = 2; this.row = 0; } }
    else if (this.stage === 2) { if (!this._b.ok2) { this.stage = 3; this.row = 0; } else { for (let k = 0; k < 2 * rows && this.row < N; k++, this.row++) this._marchRow(1, this.row); if (this.row >= N) { this.stage = 3; this.row = 0; } } }
    else if (this.stage === 3) { for (let k = 0; k < rows && this.row < 2 * N; k++, this.row++) this._seaRow(this.row); if (this.row >= 2 * N) { this._reference(); this.stage = 4; } }
    else if (this.stage === 4) { this._refract(); this.stage = 5; this.sweep = 0; }
    else if (this.stage === 5) { this._solve(SEA_MAP.sweeps); if (++this.sweep >= SEA_MAP.sweepFrames) this.stage = 6; }
    else if (this.stage === 6) { this._publish(c); this.stage = 0; }
    return used;
  }

  // Before the first build: the fetch and depth upwind of the far point by the rose so far (radials at upwind and 15 degrees
  // either side, 1/4, 1/2, 1/4; a lower bound while they run), into o[0], o[1]; false while there is no rose.
  upwindFetch(we, wn, o) {
    if (!this.rose.ok) return false;
    const a = Math.atan2(-wn, -we) + (this._b.beta || 0), w = [0.25, 0.5, 0.25];
    let f = 0, d = 0;
    for (let k = -1; k <= 1; k++) { this.rose.at(a + k * SEA_MAP.spacing * DEG, _ro); f += w[k + 1] * _ro[0]; d += w[k + 1] * _ro[1]; }
    o[0] = f; o[1] = d;
    return true;
  }

  _snapshot(c, T, U, aU, dA) {
    const b = this._b, O = this.outer, D = this.D, cap = this.cap, lev = c.level;
    b.x0 = (T.ci - T.half) * T.cell; b.z0 = (T.cj - T.half) * T.cell; b.cell = T.cell;
    { const P = this.target; P.nextOn = true; P.nextX0 = b.x0; P.nextZ0 = b.z0; }
    b.U = U; b.aU = aU; b.dirA = dA; b.g = c.g; b.rhoA = c.rhoAir; b.rhoL = c.rhoLiq; b.R = c.R; b.body = c.bodyId;
    b.exposed = !!c.exposed; b.fx = c.fx; b.fz = c.fz;
    b.swellH = c.swellHeight || 0; b.swellT = c.swellLength > 0 ? Math.sqrt(c.swellLength * TAU / c.g) : 0;
    const CW = T.CW;
    for (let n = 0; n < NN; n++) {
      D[n] = T.valid[n] ? (T.lq[n] > -1e8 ? T.lq[n] - T.h[n] : Math.min(-0.05, lev - T.h[n])) : NaN;
      cap[n] = T.cover ? T.cover[n * CW + 14] || 80 : 80;
    }
    b.ok2 = O.frameVersion === c.frame.version && O.invalid < NN;
    b.x02 = (O.ci - O.half) * O.cell; b.z02 = (O.cj - O.half) * O.cell;
    for (let n = 0; n < NN; n++) {
      D[NN + n] = b.ok2 && O.valid[n] ? (O.lq[n] > -1e8 ? O.lq[n] - O.h[n] : Math.min(-0.05, lev - O.h[n])) : NaN;
      cap[NN + n] = b.ok2 && O.valid[n] ? O.cover[n] || 80 : 80;
    }
    // the far point: kept while it is still deep water on the inner level, else the inner node that sees most open water
    // upwind by the last build (or, first, the deepest), so the rose is measured from the open side of the place
    const wp = this.wp;
    if (wp.ok) { const i = Math.round((wp.x - b.x0) / b.cell), j = Math.round((wp.z - b.z0) / b.cell); wp.n = i >= 0 && j >= 0 && i < N && j < N ? j * N + i : -1; if (wp.n < 0 || !(D[wp.n] >= SEA_MAP.minDepth)) wp.ok = false; }
    if (!wp.ok || this._betterWp >= 0 && this._betterWp !== wp.n) {
      let best = -1, bs = -1;
      const pick = this._betterWp >= 0 && D[this._betterWp] >= SEA_MAP.minDepth ? this._betterWp : -1;
      if (pick >= 0) best = pick;
      else for (let n = 0; n < NN; n++) if (D[n] >= SEA_MAP.minDepth && D[n] > bs) { bs = D[n]; best = n; }
      if (best >= 0) { wp.ok = true; wp.n = best; wp.x = b.x0 + (best % N) * b.cell; wp.z = b.z0 + ((best / N) | 0) * b.cell; wp.depth = D[best]; wp.cap = cap[best]; }
    }
    this._betterWp = -1;
    b.rv = this.rose.version;
    // the rose is geographic at its point: the frame's east there, as a geographic angle
    if (wp.ok) {
      const fr = c.frame; fr.dir(wp.x, wp.z, _d3);
      const px = _d3[0], py = _d3[1], pz = _d3[2];
      let ex = pz, ez = -px; const el = Math.hypot(ex, ez) || 1; ex /= el; ez /= el;
      const nx = py * ez, ny = pz * ex - px * ez, nz = -py * ex;
      b.beta = Math.atan2(fr.ex * nx + fr.ey * ny + fr.ez * nz, fr.ex * ex + fr.ez * ez);
    } else b.beta = 0;
  }

  // the eleven radials of every node of one row of a level: how far each runs upwind over liquid (m), the depth along
  // it (m x m), and how it ended (0 at a shore or the cap, 1 beyond what the levels know: the far rose carries it on)
  _marchRow(lev, j) {
    const b = this._b, base = lev * NN, cell = lev ? SEA_MAP.outerCell : b.cell, x0 = lev ? b.x02 : b.x0, z0 = lev ? b.z02 : b.z0;
    const D = this.D, oc = SEA_MAP.outerCell, ok2 = b.ok2, Nm = N - 1;
    for (let i = 0; i < N; i++) {
      const n = base + j * N + i, o = n * NR;
      if (!(D[n] > 0)) { for (let m = 0; m < NR; m++) { this.run[o + m] = 0; this.rdep[o + m] = 0; this.rex[o + m] = 0; } continue; }
      const x = x0 + i * cell, z = z0 + j * cell, capM = this.cap[n];
      for (let m = 0; m < NR; m++) {
        const a = b.aU + (m - MID) * SEA_MAP.spacing * DEG, ca = Math.cos(a), sa = Math.sin(a);
        let r = 0, ds = 0, ex = 0;
        for (let s = 0; s < 96; s++) {
          if (r >= capM) { r = capM; break; }
          // (half the inner level's cell while on it: a whole cell steps over a barrier one node thick at a corner; then half the
          // outer's, growing with the distance gone)
          const px0 = x + ca * r, pz0 = z + sa * r, onInner = px0 >= b.x0 && pz0 >= b.z0 && px0 <= b.x0 + Nm * b.cell && pz0 <= b.z0 + Nm * b.cell;
          const step = onInner ? 0.5 * b.cell : Math.max(0.5 * oc, SEA_MAP.stepGrow * r);
          const r1 = Math.min(capM, r + step), px = x + ca * r1, pz = z + sa * r1;
          // the depth there from the two levels (written out: a call per step would box its numbers)
          let u = (px - b.x0) / b.cell, v = (pz - b.z0) / b.cell, bs = 0, d;
          if (u < 0 || v < 0 || u > Nm || v > Nm) {
            if (!ok2) { ex = 1; break; }
            u = (px - b.x02) / oc; v = (pz - b.z02) / oc; bs = NN;
            if (u < 0 || v < 0 || u > Nm || v > Nm) { ex = 1; break; }
          }
          { const ii = Math.min(Math.floor(u), N - 2), jj = Math.min(Math.floor(v), N - 2), fu = u - ii, fv = v - jj, q = bs + jj * N + ii;
            const a0 = D[q], a1 = D[q + 1], a2 = D[q + N], a3 = D[q + N + 1];
            d = (a0 * (1 - fu) + a1 * fu) * (1 - fv) + (a2 * (1 - fu) + a3 * fu) * fv; }
          if (d !== d) { ex = 1; break; }                    // not known yet: carried on by the far rose
          if (d <= 0) { r = 0.5 * (r + r1); break; }
          ds += d * (r1 - r); r = r1;
        }
        this.run[o + m] = r; this.rdep[o + m] = ds; this.rex[o + m] = ex;
      }
    }
  }

  // the sea at every wet node of one row (rows 0 .. N-1 the inner level, N .. 2N-1 the outer)
  _seaRow(jj) {
    const b = this._b, lev = jj >= N ? 1 : 0, j = jj - lev * N, base = lev * NN, cell = lev ? SEA_MAP.outerCell : b.cell;
    const x0 = lev ? b.x02 : b.x0, z0 = lev ? b.z02 : b.z0, wp = this.wp, R = this.rose, useRose = wp.ok && R.ok;
    const F = this._F || (this._F = new Float64Array(NR)), Dm = this._Dm || (this._Dm = new Float64Array(NR));
    const g = b.g, U = b.U;
    for (let i = 0; i < N; i++) {
      const n = base + j * N + i, o = n * NR, so = n * 8;
      if (!(this.D[n] > 0)) { for (let q = 0; q < 8; q++) this.sea[so + q] = 0; this.sea[so + 7] = -1; continue; }
      const x = x0 + i * cell, z = z0 + j * cell, capM = this.cap[n];
      for (let m = 0; m < NR; m++) {
        let r = this.run[o + m], ds = this.rdep[o + m];
        if (this.rex[o + m] === 1) {
          // beyond the levels: the far rose's shore along this radial, square to it, from this node (else the levels' edge)
          const a = b.aU + (m - MID) * SEA_MAP.spacing * DEG;
          if (useRose) {
            R.at(a + b.beta, _ro);
            // (a radial that ran to the cap met no shore: open water to the cap from anywhere about)
            const far = Math.min(capM, (1 - _ro[2]) * (_ro[0] - ((x - wp.x) * Math.cos(a) + (z - wp.z) * Math.sin(a))) + _ro[2] * capM);
            if (far > r) { ds += (far - r) * _ro[1]; r = far; }
          }
        }
        F[m] = Math.min(r, capM); Dm[m] = r > 0 ? ds / r : this.D[n];
      }
      // the heading that raises the highest sea: U cos(phi) over the fetch that way (1/4, 1/2, 1/4 of three radials)
      let best = 0, bs = -1, sc = this._sc || (this._sc = new Float64Array(2 * SEA_MAP.turnMax + 1));
      for (let k = -SEA_MAP.turnMax; k <= SEA_MAP.turnMax; k++) {
        const m = MID + k, cph = Math.cos(k * SEA_MAP.spacing * DEG), Fk = 0.25 * F[m - 1] + 0.5 * F[m] + 0.25 * F[m + 1];
        const s = Math.min(0.0016 * cph * Math.sqrt(Fk / g), 0.2433 * cph * cph * U / g);
        sc[k + SEA_MAP.turnMax] = s; if (s > bs + 1e-12) { bs = s; best = k; }
      }
      let kk = best;
      if (Math.abs(best) < SEA_MAP.turnMax) {
        const s0 = sc[best + SEA_MAP.turnMax - 1], s1 = sc[best + SEA_MAP.turnMax], s2 = sc[best + SEA_MAP.turnMax + 1], den = s0 - 2 * s1 + s2;
        if (den < -1e-12) kk = best + Math.max(-0.5, Math.min(0.5, 0.5 * (s0 - s2) / den));
      }
      const mf = MID + kk, m0 = Math.floor(mf), fm = mf - m0;
      const Fh = tri(F, m0) * (1 - fm) + (fm > 0 ? tri(F, m0 + 1) * fm : 0), Dh = tri(Dm, m0) * (1 - fm) + (fm > 0 ? tri(Dm, m0 + 1) * fm : 0);
      const phi = kk * SEA_MAP.spacing * DEG;
      const ws = windSea(U * Math.cos(phi), Fh, g, b.rhoA, b.rhoL, Dh > 0 ? Dh : this.D[n], this._ws || (this._ws = {}));
      // the swell's reach: the fetch toward the wind over +-45 degrees
      let fsw = 0, wsum = 0;
      for (let q = 0; q < SEA_MAP.swellW.length; q++) { fsw += SEA_MAP.swellW[q] * F[MID - 3 + q]; wsum += SEA_MAP.swellW[q]; }
      const open = smoothstep(WATER.swellOpen[0], WATER.swellOpen[1], fsw / wsum);
      const S = this.sea;
      S[so] = Fh; S[so + 1] = Dh; S[so + 2] = ws.height; S[so + 3] = ws.period; S[so + 4] = ws.whitecap01; S[so + 5] = open;
      S[so + 6] = wrap(b.aU + Math.PI + phi); S[so + 7] = 1;
    }
  }

  // the reference: the most exposed node (the highest sea, the open sea's swell counted), deep enough; or, while nothing reads
  // the map (b.exposed false: the shader draws the trains everywhere), the water nearest the focus (P16's water point: the inner
  // node nearest the focus at least minDepth deep, else the deepest), so a lagoon is drawn with its own sea, not the open sea's
  _reference() {
    const S = this.sea, D = this.D, b = this._b;
    let ref = -1, rs = -1, any = -1, as = -1;
    if (b.exposed) {
      for (let n = 0; n < 2 * NN; n++) {
        if (!(S[n * 8 + 7] > 0)) continue;
        const s = S[n * 8 + 2] * (1 + 0.5 * S[n * 8 + 5]);
        if (s > as) { as = s; any = n; }
        if (D[n] >= SEA_MAP.minDepth && s > rs) { rs = s; ref = n; }
      }
    } else {
      for (let n = 0; n < NN; n++) {
        if (!(S[n * 8 + 7] > 0)) continue;
        const dx = b.x0 + (n % N) * b.cell - b.fx, dz = b.z0 + ((n / N) | 0) * b.cell - b.fz, d2 = dx * dx + dz * dz;
        if (D[n] > as) { as = D[n]; any = n; }
        if (D[n] >= SEA_MAP.minDepth && (rs < 0 || d2 < rs)) { rs = d2; ref = n; }
      }
    }
    this.ref = ref >= 0 ? ref : any;
    // the far point should be the inner node that sees the most open water: the next snapshot moves it there
    let bw = -1, bv = -1;
    for (let n = 0; n < NN; n++) if (S[n * 8 + 7] > 0 && D[n] >= SEA_MAP.minDepth) { let v = 0; for (let m = 0; m < NR; m++) v += this.rex[n * NR + m] === 1 ? 2 : this.run[n * NR + m] / 256; if (v > bv + 0.5) { bv = v; bw = n; } }
    if (bw >= 0 && this.wp.ok && this.wp.n >= 0) { let v0 = 0; for (let m = 0; m < NR; m++) v0 += this.rex[this.wp.n * NR + m] === 1 ? 2 : this.run[this.wp.n * NR + m] / 256; this._betterWp = bv > v0 + 2 ? bw : -1; }
  }

  // refraction and shoaling on the inner level, and the turn at every inner node against the reference sea's way
  _refract() {
    const b = this._b, S = this.sea, D = this.D, al = this.alpha, g = b.g;
    this.kS = this.kS || new Float32Array(NN); this.kW = this.kW || new Float32Array(NN);
    const known = this._known || (this._known = new Uint8Array(NN));
    const ref = this.ref, Href = ref >= 0 ? S[ref * 8 + 2] : 0;
    for (let n = 0; n < NN; n++) {
      this.kS[n] = 1; this.kW[n] = 1; al[n] = 0; known[n] = 0;
      if (!(S[n * 8 + 7] > 0)) continue;
      const i = n % N, j = (n / N) | 0, d = D[n];
      // the depth's gradient (central differences where the neighbours are known)
      const dl = i > 0 ? D[n - 1] : NaN, dr = i < N - 1 ? D[n + 1] : NaN, dd = j > 0 ? D[n - N] : NaN, du = j < N - 1 ? D[n + N] : NaN;
      const gx = (dr === dr && dl === dl ? (dr - dl) / 2 : dr === dr ? dr - d : dl === dl ? d - dl : 0) / b.cell;
      const gz = (du === du && dd === dd ? (du - dd) / 2 : du === du ? du - d : dd === dd ? d - dd : 0) / b.cell;
      const gl = Math.hypot(gx, gz), nu = Math.atan2(-gz, -gx);     // toward the shallower water: toward the shore
      const t2 = this._t2 || (this._t2 = new Float64Array(2));
      turnAt(S[n * 8 + 6], S[n * 8 + 3], d, g, nu, gl, t2); const tw = t2[0], Kw = t2[1];
      turnAt(wrap(b.aU + Math.PI), b.swellT, d, g, nu, gl, t2); const ts = t2[0], Ks = t2[1];
      this.kW[n] = Kw; this.kS[n] = Ks;
      // one way for all four trains: the wind sea's and the swell's, by their energy here
      const Ew = (S[n * 8 + 2] * Kw) ** 2, Es = (0.5 * b.swellH * Ks * S[n * 8 + 5]) ** 2, Et = Ew + Es;
      const th = Et > 0 ? Math.atan2(Ew * Math.sin(tw) + Es * Math.sin(ts), Ew * Math.cos(tw) + Es * Math.cos(ts)) : tw;
      al[n] = Math.max(-SEA_MAP.turnMaxRad, Math.min(SEA_MAP.turnMaxRad, wrap(th - b.dirA)));
      known[n] = 1;
    }
    // land and unknown nodes take their wet neighbours' turn (so the warp is smooth across the shore), then the turns
    // die out toward the inner level's edge
    for (let pass = 0; pass < 6; pass++) {
      let changed = 0;
      for (let n = 0; n < NN; n++) {
        if (known[n]) continue;
        const i = n % N, j = (n / N) | 0; let s = 0, c = 0;
        if (i > 0 && known[n - 1] === 1) { s += al[n - 1]; c++; } if (i < N - 1 && known[n + 1] === 1) { s += al[n + 1]; c++; }
        if (j > 0 && known[n - N] === 1) { s += al[n - N]; c++; } if (j < N - 1 && known[n + N] === 1) { s += al[n + N]; c++; }
        if (c) { al[n] = s / c; known[n] = 2; changed++; }
      }
      for (let n = 0; n < NN; n++) if (known[n] === 2) known[n] = 1;
      if (!changed) break;
    }
    for (let n = 0; n < NN; n++) {
      const i = n % N, j = (n / N) | 0, e = Math.min(i, j, N - 1 - i, N - 1 - j);
      al[n] *= smoothstep(SEA_MAP.edgeZero, SEA_MAP.edgeZero + SEA_MAP.edgeTaper, e);
    }
    void Href;
  }

  // Gauss-Seidel with over-relaxation on the normal equations of grad(warp) = R(alpha) - I (each edge's matrix the mean
  // of its two nodes'); warm-started from the last build's warp
  _solve(sweeps) {
    const al = this.alpha, wx = this.wx, wz = this.wz, h = this._b.cell, w = SEA_MAP.sor;
    const c = this._ca || (this._ca = new Float32Array(NN)), s = this._sa || (this._sa = new Float32Array(NN));
    if (this.sweep === 0) {
      // (the phase read at g + warp(g) has the gradient J^T k, J the warp's Jacobian: J = R(-alpha) turns the waves by +alpha)
      for (let n = 0; n < NN; n++) { c[n] = Math.cos(al[n]) - 1; s[n] = -Math.sin(al[n]); }
      // warm start: the last build's warp moved to this build's nodes
      const T = this.target, di = Math.round((this._b.x0 - T.x0) / h), dj = Math.round((this._b.z0 - T.z0) / h);
      for (let n = 0; n < NN; n++) {
        const i = n % N + di, j = ((n / N) | 0) + dj, ok = T.on && i >= 0 && j >= 0 && i < N && j < N;
        wx[n] = ok ? T.warp[(j * N + i) * 2] : 0; wz[n] = ok ? T.warp[(j * N + i) * 2 + 1] : 0;
      }
      this._w0x = Float32Array.from(wx); this._w0z = Float32Array.from(wz);
    }
    for (let it = 0; it < sweeps; it++) {
      for (let n = 0; n < NN; n++) {
        const i = n % N, j = (n / N) | 0;
        let sx = 0, sz = 0, k = 0;
        // neighbour m at offset e: warp_m - warp_n = M e, M = [[c, -s], [s, c]] (the mean of the two nodes')
        if (i > 0) { const m = n - 1, cc = 0.5 * (c[n] + c[m]), ss = 0.5 * (s[n] + s[m]); sx += wx[m] + cc * h; sz += wz[m] + ss * h; k++; }
        if (i < N - 1) { const m = n + 1, cc = 0.5 * (c[n] + c[m]), ss = 0.5 * (s[n] + s[m]); sx += wx[m] - cc * h; sz += wz[m] - ss * h; k++; }
        if (j > 0) { const m = n - N, cc = 0.5 * (c[n] + c[m]), ss = 0.5 * (s[n] + s[m]); sx += wx[m] - ss * h; sz += wz[m] + cc * h; k++; }
        if (j < N - 1) { const m = n + N, cc = 0.5 * (c[n] + c[m]), ss = 0.5 * (s[n] + s[m]); sx += wx[m] + ss * h; sz += wz[m] - cc * h; k++; }
        wx[n] += w * (sx / k - wx[n]); wz[n] += w * (sz / k - wz[n]);
      }
    }
  }

  _publish(c) {
    const b = this._b, S = this.sea, T = this.target, D = this.D, ref = this.ref;
    T.nextOn = false;
    if (ref < 0) { if (T.on) { T.on = false; T.version++; } return; }
    // the warp's free constant: what moves the crests least against the last build (its mean change over the water is nil)
    let mx = 0, mz = 0, cnt = 0;
    for (let n = 0; n < NN; n++) if (S[n * 8 + 7] > 0) { mx += this.wx[n] - this._w0x[n]; mz += this.wz[n] - this._w0z[n]; cnt++; }
    if (cnt && T.on) { mx /= cnt; mz /= cnt; } else { mx = 0; mz = 0; }
    // with no turn anywhere there is no warp at all
    let anyTurn = false; for (let n = 0; n < NN; n++) if (Math.abs(this.alpha[n]) > 1e-4) { anyTurn = true; break; }
    const Href = S[ref * 8 + 2], wcRef = S[ref * 8 + 4], Lref = lengthAt(S[ref * 8 + 3], S[ref * 8 + 1] > 0 ? S[ref * 8 + 1] : 1e9, b.g);
    T.x0 = b.x0; T.z0 = b.z0; T.cell = b.cell; T.x02 = b.x02; T.z02 = b.z02; T.N2 = b.ok2 ? N : 0;
    for (let n = 0; n < NN; n++) { T.warp[n * 2] = anyTurn ? this.wx[n] - mx : 0; T.warp[n * 2 + 1] = anyTurn ? this.wz[n] - mz : 0; }
    for (let lev = 0; lev < 2; lev++) {
      const arr = lev ? T.outer : T.inner, base = lev * NN, val = this._val || (this._val = new Uint8Array(NN));
      for (let n = 0; n < NN; n++) {
        const q = (base + n) * 8, o = n * 4, wet = S[q + 7] > 0;
        val[n] = wet ? 1 : 0;
        const kW = lev ? 1 : this.kW[n], kS = lev ? 1 : this.kS[n];
        // (a node whose sea is higher than the reference's is the reference's trains made higher: never steeper than 1 in 10)
        arr[o] = wet ? (Href > 1e-4 ? Math.min(Math.max(1.5, 0.1 * Lref / Href), S[q + 2] * kW / Href) : 1) : 0;
        arr[o + 1] = wet ? S[q + 5] : 0; arr[o + 2] = wet ? S[q + 4] : 0; arr[o + 3] = wet ? kS : 1;
        const io = (base + n) * 6;
        T.info[io] = S[q]; T.info[io + 1] = S[q + 1]; T.info[io + 2] = S[q + 2] * kW; T.info[io + 3] = S[q + 5]; T.info[io + 4] = S[q + 6]; T.info[io + 5] = wet ? 1 : 0;
        T.depth[base + n] = D[base + n];
      }
      // dry and unknown nodes take their wet neighbours' sea (the water's edge lies between them), else the reference's
      for (let pass = 0; pass < 8; pass++) {
        let changed = 0;
        for (let n = 0; n < NN; n++) {
          if (val[n]) continue;
          const i = n % N, j = (n / N) | 0; let c4 = 0, a0 = 0, a1 = 0, a2 = 0, a3 = 0;
          for (let k = 0; k < 4; k++) {
            const m = k === 0 ? (i > 0 ? n - 1 : -1) : k === 1 ? (i < N - 1 ? n + 1 : -1) : k === 2 ? (j > 0 ? n - N : -1) : (j < N - 1 ? n + N : -1);
            if (m < 0 || val[m] !== 1) continue;
            a0 += arr[m * 4]; a1 += arr[m * 4 + 1]; a2 += arr[m * 4 + 2]; a3 += arr[m * 4 + 3]; c4++;
          }
          if (c4) { arr[n * 4] = a0 / c4; arr[n * 4 + 1] = a1 / c4; arr[n * 4 + 2] = a2 / c4; arr[n * 4 + 3] = a3 / c4; val[n] = 2; changed++; }
        }
        for (let n = 0; n < NN; n++) if (val[n] === 2) val[n] = 1;
        if (!changed) break;
      }
      for (let n = 0; n < NN; n++) if (!val[n]) { arr[n * 4] = 1; arr[n * 4 + 1] = S[ref * 8 + 5]; arr[n * 4 + 2] = wcRef; arr[n * 4 + 3] = 1; }
    }
    T.HsRef = Href; T.wcRef = wcRef; T.refFetch = S[ref * 8]; T.refDepth = S[ref * 8 + 1]; T.refHeading = S[ref * 8 + 6];
    T.refU = b.U * Math.cos(wrap(S[ref * 8 + 6] - b.aU - Math.PI)); T.ref = ref; T.refOpen = S[ref * 8 + 5];
    const rl = ref >= NN ? 1 : 0, rn = ref - rl * NN;
    T.refX = (rl ? b.x02 : b.x0) + (rn % N) * (rl ? SEA_MAP.outerCell : b.cell); T.refZ = (rl ? b.z02 : b.z0) + ((rn / N) | 0) * (rl ? SEA_MAP.outerCell : b.cell);
    T.on = true; T.version++; this.built++; this.stats.built = this.built;
  }
}
