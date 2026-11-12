// Painted Cosmos physics: the air at a point (density, wind, gusts, temperature), assembled from
// the atmosphere table, the wind layers, the weather cells and the ground. OWNER: PHYSICS. Pure.
//
// Near the focus the wind lives on a grid (AirGrid: 17 x 17 nodes, 16 m apart) that is rebuilt
// every frame: large-scale wind, weather multiplier and gust-front outflow, travelling gusts,
// turbulence from the local roughness, shelter from the terrain upwind. Everything near the
// player (flora field, particles, the explorer's wind load, the ship's buffeting) reads that one
// grid, so a gust that bends the grass also slants the rain and leans on the explorer.
// Away from the focus the same layers are evaluated directly, without terrain.
import { BODIES } from '../data/bodies.js';
import { ATMOSPHERES, airDensity, airTemperature } from './atmosphere.js';
import { WINDS, WIND, windLarge, gustLevel, gustLevelAt, gustFineAt, gustCross, gustCrossAt, gustCrossFineAt, gustPhase, gustNodes, gustSubAt, GUST_SUB, turbulenceIntensity, heightFactor, slopeFactor, shelterFactor, wakeAt, WAKE } from './wind.js';
import { weatherWind } from './weather.js';
import { TerrainGrid, scrollField } from './near.js';
import { coverAt } from './ground.js';
import { FLORA } from './flora.js';
import { devilWind } from './features.js';
import { clamp, clamp01, smoothstep } from './util.js';

// (P15) The wind left at height z (m) in the lee of trees of height wkH that leave wk of it near the ground: whole up
// to AIR.wakeFull of their height, gone at AIR.wakeTop. One shape for the particles' air, profileAt and the crowns.
// (P16) It lives in wind.js now and is re-exported here (the same function): flora.js takes it from wind.js, so no
// module of the physics imports air.js back (src/physics/load.test.mjs loads every module alone to keep it so).
export { wakeAt };

export const AIR = Object.freeze({
  gridN: 17,              // nodes per side of the wind grid
  gridCell: 16,           // m between nodes (256 m across)
  shelterStep: 24,        // m: step of the upwind search for higher ground
  shelterSteps: 5,        // 120 m of fetch
  wakeDrop: 0.75,         // a dense stand of trees takes this much off the wind just behind it ...
  wakeLength: 5,          // ... recovering over this many tree heights downwind (a shelter belt
                          // protects out to 10-15 heights; Wang and Takle 1996)
  wakeTop: WAKE.top,      // the wake reaches this many canopy heights up (1.5; the number is wind.js WAKE.top)
  // (P15) ... and is whole only below this share of their height: behind a forest edge or a dense belt the quiet zone
  // lies under half to two thirds of its height, and at its top the speed is lost by a third to a quarter of what is lost
  // near the ground (Heisler and DeWalle 1988; Wang and Takle 1996). Until P15 the wake was whole up to the full height
  // (particles, profileAt) and, for the crowns (sampleWind), at every height: a crown in a clearing behind a wood felt
  // the wood's ground-level lee at its own height and above.
  wakeFull: WAKE.full,    // 0.5 (wind.js WAKE.full, which wakeAt reads)
  shelterAdjust: 48,      // m: shelter and wakes follow a veering wind as the air crosses this much fetch
                          // (the time it takes is this over the wind speed, kept between 1 and 6 s)
  shelterLearn: 0.4,      // s: a node whose upwind search reaches newly sampled ground takes it in over this
  aloftGain: 1.2,         // wind in the free air above the surface layer: 1 + this at 60 % of the atmosphere
  aloftGainVenus: 12,     // Venus: slow at the ground, fast aloft (super-rotation)
});

const _w = new Float64Array(4);
const _ww = new Float64Array(6);
const _d = new Float64Array(3);
const _cov = {};
const _cs = { biomeWeights: null, biomeId: null, liquidRadius: 0, radius: 0 };

// Per node of the wind grid: z0, canopy01, canopyH, moist, fog, dustSrc, dT, snowBase, and the
// wind height factors at blade height, crown height and 2 m (computed once, when the node's
// ground is sampled, so the flora field never has to redo them).
const CW = 16;
function coverInto(surface, arr, o) {
  coverAt(_coverBody, surface, _cov);
  arr[o] = _cov.z0; arr[o + 1] = _cov.canopy01; arr[o + 2] = _cov.canopyHeight; arr[o + 3] = _cov.moist;
  arr[o + 4] = _cov.fog; arr[o + 5] = _cov.dustSource; arr[o + 6] = _cov.dT; arr[o + 7] = _cov.snowBase;
  arr[o + 8] = heightFactor(FLORA.softHeight, _cov.z0, _cov.canopyHeight, _cov.canopy01);
  arr[o + 9] = heightFactor(Math.max(FLORA.stiffHeight, _cov.canopyHeight), _cov.z0, _cov.canopyHeight, _cov.canopy01);
  arr[o + 10] = heightFactor(2, _cov.z0, _cov.canopyHeight, _cov.canopy01);
  arr[o + 11] = _cov.leaves; arr[o + 12] = _cov.spores; arr[o + 13] = _cov.ash; arr[o + 14] = _cov.fetch; arr[o + 15] = _cov.liquidDensity;
}
// Computed on first use, not at load (the coordinator's guard after 6d5c02a, kept): when flora.js imported air.js, FLORA was
// not yet initialised while air.js loaded from flora.glsl.js -> flora.js -> air.js. P16 removed that cycle (flora.js takes
// wakeAt from wind.js); lazy costs nothing and keeps air.js safe whatever imports it first.
let HF0 = null;
const hf0 = () => HF0 || (HF0 = [heightFactor(FLORA.softHeight, WIND.refRoughness), heightFactor(FLORA.stiffHeight, WIND.refRoughness), heightFactor(2, WIND.refRoughness)]);
let _coverBody = 'earth';

export class AirGrid {
  constructor(seed) {
    const N = AIR.gridN;
    this.N = N; this.cell = AIR.gridCell;
    this.seed = seed;
    this.terrain = new TerrainGrid(N, AIR.gridCell, CW);
    this.we = new Float32Array(N * N);        // reference wind along the frame's east axis (m/s)
    this.wn = new Float32Array(N * N);        // ... north axis
    this.gust = new Float32Array(N * N);      // travelling gust level -1..1 (the two large octaves)
    this.cross = new Float32Array(N * N);     // (P12) the lateral level (its two large octaves; already in we / wn)
    // (P11) what the fine eddies (wind.js gustFineAt) do to the wind at each node, as a factor on we / wn.
    // NOT in we / wn: a 16 m grid cannot carry eddies of 10 to 30 m, and what samples it sparsely (the
    // falling and blown particles) would move in step over a whole cell. sampleWind hands it to the plants.
    this.fine = new Float32Array(N * N).fill(1);
    this.shel = new Float32Array(N * N).fill(1);   // terrain shelter / speed-up factor
    this.I = new Float32Array(N * N).fill(0.17);   // turbulence intensity at 10 m
    this.wake = new Float32Array(N * N).fill(1);   // wind left near the ground in the lee of trees upwind (0..1)
    this.wakeH = new Float32Array(N * N);          // height of the canopy that casts it (m)
    // what the upwind search last found for each node (NaN: not searched yet): shel, wake and wakeH
    // move toward these at the pace the air crosses the fetch, and never step (P10)
    this._shelT = new Float32Array(N * N).fill(NaN);
    this._wakeT = new Float32Array(N * N).fill(NaN);
    this._wakeHT = new Float32Array(N * N).fill(NaN);
    this._known = new Uint8Array(N * N);           // how many of a node's upwind probes fell on known ground ...
    this._seen = new Float64Array(N * N);          // ... and the terrain grid's change count when it was last searched
    this._fast = new Uint8Array(N * N);            // 1 while a node is taking in ground that has just become known
    // how far the wind has carried each copy of the gust pattern since the middle of its cycle (m,
    // body-local), and the cycle each is in: the pattern moves with the air, at the wind's own speed
    this.gustShift = new Float64Array(6);
    this._gc1 = NaN; this._gc2 = NaN; this._gbody = null; this._gp = new Float64Array(4);
    this.bodyId = null;
    this.time = 0;
    this.ready = false;
    // patch-wide values of this frame
    this.cwx = 0; this.cwy = 0; this.cwz = 0;     // mean wind at the centre (body-local, m/s), with weather
    this.cwe = 0; this.cwn = 0;                   // the same in frame axes
    this.mul = 1; this.gustiness = 0;
    this._row = 0;
    // the wind of the weather and of the planet on a 3 x 3 lattice 256 m wide that is fixed to the
    // ground (not to the grid's centre, which hops a cell at a time as the focus moves)
    this._sup = new Float32Array(9 * 4);      // per lattice node: east, north (m/s), gustiness, multiplier
    this._si = 0; this._sj = 0;               // where the lattice lies, in cells (0 .. N - 2)
    this._ci1 = 0; this._cj1 = 0;             // the terrain grid's centre when this was last updated
  }

  // Rebuild the grid for this frame. sample(dir) is sampleSurface bound to the body.
  // Returns the number of sampleSurface calls made.
  update(frame, bodyId, t, fx, fz, sample, budget, clock, budgetMs) {
    const N = this.N, cell = this.cell, T = this.terrain;
    _coverBody = bodyId;
    // the step since the last call; a jump (a warm-up, a new body, a new frame, a pause) is not
    // a step: fields are set, not eased, and the gust pattern is placed afresh
    const dts = t - this.time;
    const fresh = !this.ready || this.bodyId !== bodyId || T.frameVersion !== frame.version;
    const jump = fresh || !(dts > 0) || dts > 1;
    const ci0 = T.ci, cj0 = T.cj;
    const used = T.update(frame, fx, fz, sample, budget, coverInto, clock, budgetMs);
    if (fresh) this._shelT.fill(NaN);
    else if (T.ci !== ci0 || T.cj !== cj0) {
      // the grid followed the focus: the per-node fields move with the ground they belong to
      const di = T.ci - ci0, dj = T.cj - cj0;
      scrollField(this.shel, null, N, 1, di, dj, 1); scrollField(this.wake, null, N, 1, di, dj, 1); scrollField(this.wakeH, null, N, 1, di, dj, 0);
      scrollField(this.I, null, N, 1, di, dj, 0.17);
      scrollField(this._shelT, null, N, 1, di, dj, NaN); scrollField(this._wakeT, null, N, 1, di, dj, NaN); scrollField(this._wakeHT, null, N, 1, di, dj, NaN);
      scrollField(this._known, null, N, 1, di, dj, 0); scrollField(this._seen, null, N, 1, di, dj, -1); scrollField(this._fast, null, N, 1, di, dj, 0);
    }
    this.bodyId = bodyId; this.time = t; this.ready = true;
    const W = WINDS[bodyId];
    const half = T.half;
    if (!W || W.U === 0 || !(ATMOSPHERES[bodyId].rho0 > 0)) {
      this.we.fill(0); this.wn.fill(0); this.gust.fill(0); this.cross.fill(0);
      this.cwx = this.cwy = this.cwz = this.cwe = this.cwn = 0; this.mul = 1; this.gustiness = 0;
      return used;
    }
    // The wind of the planet and of the weather on a lattice of 3 x 3 nodes, one grid width (256 m)
    // apart, interpolated to the nodes. (P10: the weather's part used to be taken at the grid's centre
    // alone and the lattice hung from that centre. The centre hops 16 m at a time as the focus moves,
    // and across a storm's gust front the outflow changes by 1 m/s in 16 m: a walker's wind stepped by
    // that much every 16 m. The lattice is now fixed to the ground and carries the weather at every
    // node, so the field is one function of place, whatever the grid does.)
    const L = N - 1, sup = this._sup;
    if (!fresh && (ci0 !== this._ci1 || cj0 !== this._cj1)) {
      // the frame was re-anchored since the last update (cells were renumbered before this call; a
      // scroll, inside T.update, renumbers nothing): the lattice stays where it is on the ground
      this._si = (((this._si + ci0 - this._ci1) % L) + L) % L; this._sj = (((this._sj + cj0 - this._cj1) % L) + L) % L;
    }
    this._ci1 = T.ci; this._cj1 = T.cj;
    const gi0 = T.ci - half, gj0 = T.cj - half;
    const la = Math.floor((gi0 - this._si) / L), lb = Math.floor((gj0 - this._sj) / L);
    for (let b = 0; b < 3; b++) for (let a = 0; a < 3; a++) {
      frame.dir(((la + a) * L + this._si) * cell, ((lb + b) * L + this._sj) * cell, _d);
      windLarge(bodyId, _d[0], _d[1], _d[2], t, this.seed, _w);
      weatherWind(bodyId, _d[0], _d[1], _d[2], t, this.seed, _ww);
      const mul = _ww[0], blow = _ww[5];
      // (P12) both winds lie in the tangent plane at their own node, up to 640 m from the anchor. They
      // are TURNED into the frame's plane (the smallest rotation that takes the node's up to the
      // anchor's), not projected onto it: the projection lost 1 - cos of the tilt, half a percent of
      // the wind at the edge of the frame's reach, and gave it back in one frame at a re-anchoring.
      const tde = (_d[0] * frame.ex + _d[1] * frame.ey + _d[2] * frame.ez), tdn = (_d[0] * frame.nx + _d[1] * frame.ny + _d[2] * frame.nz);
      const tc = 1 + _d[0] * frame.ax + _d[1] * frame.ay + _d[2] * frame.az;
      const tw = (_w[0] * frame.ax + _w[1] * frame.ay + _w[2] * frame.az) / tc, to = (_ww[1] * frame.ax + _ww[2] * frame.ay + _ww[3] * frame.az) / tc;
      const oe = _ww[1] * frame.ex + _ww[2] * frame.ey + _ww[3] * frame.ez - tde * to;
      const on = _ww[1] * frame.nx + _ww[2] * frame.ny + _ww[3] * frame.nz - tdn * to;
      const k = (b * 3 + a) * 4;
      // (the system's own wind, added along what is blowing: a storm blows 16 m/s whatever the breeze
      // was; where the mean wind and the outflow cancel, on the rear side, it shifts through a lull)
      const be = (_w[0] * frame.ex + _w[1] * frame.ey + _w[2] * frame.ez - tde * tw) * mul + oe, bn = (_w[0] * frame.nx + _w[1] * frame.ny + _w[2] * frame.nz - tdn * tw) * mul + on;
      const bs = Math.hypot(be, bn), bl = bs > 1e-6 ? blow * Math.min(1, bs / 2) / bs : 0;
      sup[k] = be * (1 + bl);
      sup[k + 1] = bn * (1 + bl);
      sup[k + 2] = _ww[4]; sup[k + 3] = mul;
    }
    // the patch-wide values are those at the focus itself (they move smoothly with it)
    {
      let u = (fx / cell - this._si) / L - la, v = (fz / cell - this._sj) / L - lb;
      u = u < 0 ? 0 : u > 1.999 ? 1.999 : u; v = v < 0 ? 0 : v > 1.999 ? 1.999 : v;
      const a0 = u >= 1 ? 1 : 0, b0 = v >= 1 ? 1 : 0, fu = u - a0, fv = v - b0, k = (b0 * 3 + a0) * 4;
      const w00 = (1 - fu) * (1 - fv), w10 = fu * (1 - fv), w01 = (1 - fu) * fv, w11 = fu * fv;
      this.cwe = sup[k] * w00 + sup[k + 4] * w10 + sup[k + 12] * w01 + sup[k + 16] * w11;
      this.cwn = sup[k + 1] * w00 + sup[k + 5] * w10 + sup[k + 13] * w01 + sup[k + 17] * w11;
      this.gustiness = sup[k + 2] * w00 + sup[k + 6] * w10 + sup[k + 14] * w01 + sup[k + 18] * w11;
      this.mul = sup[k + 3] * w00 + sup[k + 7] * w10 + sup[k + 15] * w01 + sup[k + 19] * w11;
    }
    this.cwx = frame.ex * this.cwe + frame.nx * this.cwn;
    this.cwy = frame.ey * this.cwe + frame.ny * this.cwn;
    this.cwz = frame.ez * this.cwe + frame.nz * this.cwn;
    const cs = Math.hypot(this.cwe, this.cwn);
    const dwe = cs > 1e-6 ? this.cwe / cs : 1, dwn = cs > 1e-6 ? this.cwn / cs : 0;
    // the gust pattern rides in the air: each copy is carried by the wind of the moment (an
    // integral, kept here), and starts again half a cycle upwind when its cycle begins. In a steady
    // wind this is gustLevel() exactly; in a wind that changes the pattern still moves at the
    // wind's speed and no faster (it used to move at wind + 48 s x the wind's rate of change).
    {
      const gs = this.gustShift, gp = gustPhase(t, this._gp);
      const re = jump || this._gbody !== bodyId;
      if (re || gp[0] !== this._gc1) { gs[0] = this.cwx * gp[2]; gs[1] = this.cwy * gp[2]; gs[2] = this.cwz * gp[2]; }
      else { gs[0] += this.cwx * dts; gs[1] += this.cwy * dts; gs[2] += this.cwz * dts; }
      if (re || gp[1] !== this._gc2) { gs[3] = this.cwx * gp[3]; gs[4] = this.cwy * gp[3]; gs[5] = this.cwz * gp[3]; }
      else { gs[3] += this.cwx * dts; gs[4] += this.cwy * dts; gs[5] += this.cwz * dts; }
      this._gc1 = gp[0]; this._gc2 = gp[1]; this._gbody = bodyId;
    }

    // terrain shelter for a quarter of the rows per frame (it only changes as the wind veers)
    const rows = Math.ceil(N / 4);
    for (let q = 0; q < rows; q++) {
      const j = this._row; this._row = (this._row + 1) % N;
      for (let i = 0; i < N; i++) {
        const n = j * N + i;
        if (!T.valid[n]) { this.shel[n] = 1; this._shelT[n] = NaN; continue; }
        const x = (T.ci + i - half) * cell, z = (T.cj + j - half) * cell;
        const h0 = T.h[n];
        let sx = -1.5, known = 0;
        // (P18: the lookups go through a scratch array, T.groundQ and T.nearKnownQ, exactly heightAt, nearest and known:
        // called with numbers they boxed each one)
        const q = this._q || (this._q = new Float64Array(5));
        for (let k = 1; k <= AIR.shelterSteps; k++) {
          const dd = k * AIR.shelterStep;
          q[0] = x - dwe * dd; q[1] = z - dwn * dd; T.groundQ(q);
          const hk = q[2];
          if (hk !== hk) continue;
          known++;
          const a = Math.atan2(hk - h0, dd);
          if (a > sx) sx = a;
        }
        if (sx < -1.4) sx = 0;
        // plants sheltering each other: a stand of trees (or a reed bed, or a hedge) upwind
        // casts a wake of slower air downwind of itself, deepest just behind it
        let drop = 0, dropH = 0;
        const c0 = T.cover[n * CW + 1], hc0 = T.cover[n * CW + 2];
        for (let k = 1; k <= AIR.shelterSteps; k++) {
          const dd = k * AIR.shelterStep;
          q[0] = x - dwe * dd; q[1] = z - dwn * dd;
          const m = T.nearKnownQ(q);
          if (q[4] === 1) known++;
          if (m < 0 || m === n) continue;
          const c = T.cover[m * CW + 1], hc = T.cover[m * CW + 2];
          if (!(c > 0.05) || !(hc > 0.5)) continue;
          // only what stands taller and denser than the place itself shelters it
          const more = clamp01((c * hc - c0 * hc0) / (c * hc));
          const r = AIR.wakeDrop * c * more * Math.exp(-dd / (AIR.wakeLength * hc));
          if (r > drop) { drop = r; dropH = hc; }
        }
        const sl = Math.sqrt(1 + T.gx[n] * T.gx[n] + T.gz[n] * T.gz[n]);
        const lee = -(T.gx[n] * dwe + T.gz[n] * dwn) / sl;
        const sh = clamp(shelterFactor(sx) * (0.5 + 0.5 * slopeFactor(lee)), 0.08, 1.6);
        // a node searched for the first time takes what was found. One whose search reached ground
        // that has been sampled since its last search is learning, not seeing the air change: it
        // takes the new value in over shelterLearn (so a walker, whose grid gains a row of ground
        // every 16 m, feels no step either). Otherwise the change comes from the wind veering and
        // is eased at the pace of the air (below).
        if (this._shelT[n] !== this._shelT[n]) { this.shel[n] = sh; this.wake[n] = 1 - drop; this.wakeH[n] = dropH; this._fast[n] = 0; }
        else if (this._known[n] !== known && this._seen[n] !== T.changed) this._fast[n] = 1;   // (until it has arrived)
        this._known[n] = known; this._seen[n] = T.changed;
        this._shelT[n] = sh; this._wakeT[n] = 1 - drop; this._wakeHT[n] = dropH;
        const z0 = T.cover[n * CW];
        this.I[n] = turbulenceIntensity(WIND.refHeight, z0 > 0 ? z0 : WIND.refRoughness);
      }
    }

    // shelter and wakes follow the wind as it veers: the search above is a step function of the
    // wind's direction (the nearest stand upwind, five probes of the ground), and the air cannot
    // re-arrange itself faster than it crosses the fetch (before P10 a wake that changed stands took
    // a fifth off the wind in one frame: 120 m/s2 at 10 m in the first storm at the Earth spawn)
    {
      const k0 = jump ? 1 : 1 - Math.exp(-dts / clamp(AIR.shelterAdjust / Math.max(cs, 1e-3), 1, 6));
      const k1 = jump ? 1 : 1 - Math.exp(-dts / AIR.shelterLearn);
      const sT = this._shelT, wT = this._wakeT, hT = this._wakeHT, sh = this.shel, wk = this.wake, wh = this.wakeH, fast = this._fast;
      for (let n = 0; n < N * N; n++) {
        const a = sT[n];
        if (a !== a) continue;
        const k = fast[n] ? k1 : k0;
        sh[n] += (a - sh[n]) * k; wk[n] += (wT[n] - wk[n]) * k; wh[n] += (hT[n] - wh[n]) * k;
        if (fast[n] && Math.abs(a - sh[n]) < 0.01 && Math.abs(wT[n] - wk[n]) < 0.01) fast[n] = 0;
      }
    }

    // nodes: interpolate the large-scale wind, add the travelling gusts and the shelter
    const gain = WIND.gustGain;
    const gs = this.gustShift;
    const Rref = BODIES[bodyId].radius;
    // (P18) every node's place in the pattern first, then the three levels of every node in one call (wind.js gustNodes,
    // exactly gustLevelAt, gustCrossAt, gustFineAt): called per node with twelve numbers each they were 385 KB of garbage
    // a frame (every number handed over and every answer boxed); the fields are bit for bit as before (air.test.mjs)
    const P = this._P || (this._P = new Float64Array(N * N * 3)), GL = this._GL || (this._GL = new Float64Array(N * N));
    const GC = this._GC || (this._GC = new Float64Array(N * N)), GF = this._GF || (this._GF = new Float64Array(N * N));
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = (T.ci + i - half) * cell, z = (T.cj + j - half) * cell;
      let px = frame.ox + frame.ex * x + frame.nx * z, py = frame.oy + frame.ey * x + frame.ny * z, pz = frame.oz + frame.ez * x + frame.nz * z;
      { const kr = Rref / Math.sqrt(px * px + py * py + pz * pz); px *= kr; py *= kr; pz *= kr; }
      const n = j * N + i;
      P[3 * n] = px; P[3 * n + 1] = py; P[3 * n + 2] = pz;
    }
    gustNodes(bodyId, P, N * N, gs, t, this.seed, GL, GC, GF);
    for (let j = 0; j < N; j++) {
      const v = (gj0 + j - this._sj) / L - lb, b0 = v >= 1 ? 1 : 0, fv = v - b0;
      for (let i = 0; i < N; i++) {
        const u = (gi0 + i - this._si) / L - la, a0 = u >= 1 ? 1 : 0, fu = u - a0;
        const k = (b0 * 3 + a0) * 4;
        const w00 = (1 - fu) * (1 - fv), w10 = fu * (1 - fv), w01 = (1 - fu) * fv, w11 = fu * fv;
        const be = sup[k] * w00 + sup[k + 4] * w10 + sup[k + 12] * w01 + sup[k + 16] * w11;
        const bn = sup[k + 1] * w00 + sup[k + 5] * w10 + sup[k + 13] * w01 + sup[k + 17] * w11;
        const gi = (sup[k + 2] * w00 + sup[k + 6] * w10 + sup[k + 14] * w01 + sup[k + 18] * w11) * 0.15;
        // (P12) the pattern is read ON THE SPHERE, at the node's own direction and the body's base radius:
        // one function of place whatever the frame is anchored to. (It was read on the frame's tangent
        // plane, which 384 m from the anchor stands 18 m above a 4 km sphere: when the frame re-anchored
        // every node's place in the pattern moved by that much at once, and the gust level at the focus
        // stepped by up to 0.1.) airAt reads its fine eddies the same way, at the point's height above
        // the ground. (P18: the places and the levels are worked out above, all nodes at once.)
        const n = j * N + i;
        const g = GL[n];
        const A = (this.I[n] + gi) * gain, fc = Math.max(WIND.minFactor, 1 + A * g);
        // (P12) the lateral part: the wind swings as well as gusts (wind.js, crossWeights)
        const cl = GC[n];
        const kc = A * WIND.crossRatio * cl, sh = this.shel[n];
        this.we[n] = (be * fc - bn * kc) * sh; this.wn[n] = (bn * fc + be * kc) * sh; this.gust[n] = g; this.cross[n] = cl;
        const gt = g + GF[n];
        this.fine[n] = Math.max(WIND.minFactor, 1 + A * (gt > WIND.gustMax ? WIND.gustMax : gt < -WIND.gustMax ? -WIND.gustMax : gt)) / fc;
      }
    }
    return used;
  }

  inside(x, z) {
    const T = this.terrain, u = T.u(x), v = T.v(z);
    return u >= 0 && v >= 0 && u <= this.N - 1 && v <= this.N - 1;
  }

  // Wind only (the per-frame hot path). Writes these numbers into the typed array `o`:
  //   [0] we, [1] wn (reference wind, frame axes), [2] gust (-1..1), [3] turbulence intensity,
  //   [4..6] wind height factors at blade height, crown height and 2 m, [7] canopy01,
  //   [8] (P11; only if o has room) the factor of the fine eddies on we / wn: multiply by it for what a
  //   thing standing at one place feels (plants); leave it out for what is carried along (particles).
//   (P15; each only if o has room) [9] the wake factor that is in [0] and [1], [10] the height of the trees casting
//   it (m), [11] the canopy height here (m): what stands higher than the ground takes the wake as wakeAt has it there.
  // (A typed array, not an object: storing a double in an object field can allocate.)
  sampleWind(x, z, o) {
    const N = this.N, T = this.terrain;
    let u = T.u(x), v = T.v(z);
    u = u < 0 ? 0 : u > N - 1 ? N - 1 : u; v = v < 0 ? 0 : v > N - 1 ? N - 1 : v;
    let i = Math.floor(u), j = Math.floor(v);
    if (i > N - 2) i = N - 2; if (j > N - 2) j = N - 2;
    const fu = u - i, fv = v - j, n = j * N + i;
    const w00 = (1 - fu) * (1 - fv), w10 = fu * (1 - fv), w01 = (1 - fu) * fv, w11 = fu * fv;
    // (this sampler serves things near the ground, so the lee of trees upwind is applied here)
    const wk = this.wake[n] * w00 + this.wake[n + 1] * w10 + this.wake[n + N] * w01 + this.wake[n + N + 1] * w11;
    o[0] = (this.we[n] * w00 + this.we[n + 1] * w10 + this.we[n + N] * w01 + this.we[n + N + 1] * w11) * wk;
    o[1] = (this.wn[n] * w00 + this.wn[n + 1] * w10 + this.wn[n + N] * w01 + this.wn[n + N + 1] * w11) * wk;
    o[2] = this.gust[n] * w00 + this.gust[n + 1] * w10 + this.gust[n + N] * w01 + this.gust[n + N + 1] * w11;
    o[3] = this.I[n] * w00 + this.I[n + 1] * w10 + this.I[n + N] * w01 + this.I[n + N + 1] * w11;
    if (o.length > 8) o[8] = this.fine[n] * w00 + this.fine[n + 1] * w10 + this.fine[n + N] * w01 + this.fine[n + N + 1] * w11;
    // (P15) [9] the wake factor in [0] and [1] (so that what stands higher can take it out: wakeAt), [10] the height of
    // the trees that cast it (m); only if o has room
    if (o.length > 10) { o[9] = wk; o[10] = this.wakeH[n] * w00 + this.wakeH[n + 1] * w10 + this.wakeH[n + N] * w01 + this.wakeH[n + N + 1] * w11; }
    if (o.length > 11) o[11] = 0;
    // height factors from the nodes whose ground is known
    const va = T.valid, c = T.cover;
    const v00 = w00 * va[n], v10 = w10 * va[n + 1], v01 = w01 * va[n + N], v11 = w11 * va[n + N + 1];
    const vs = v00 + v10 + v01 + v11;
    if (vs > 0.2) {
      const k = 1 / vs, a = n * CW + 8, b = a + CW, d = (n + N) * CW + 8, e = d + CW;
      o[4] = (c[a] * v00 + c[b] * v10 + c[d] * v01 + c[e] * v11) * k;
      o[5] = (c[a + 1] * v00 + c[b + 1] * v10 + c[d + 1] * v01 + c[e + 1] * v11) * k;
      o[6] = (c[a + 2] * v00 + c[b + 2] * v10 + c[d + 2] * v01 + c[e + 2] * v11) * k;
      o[7] = (c[a - 7] * v00 + c[b - 7] * v10 + c[d - 7] * v01 + c[e - 7] * v11) * k;     // canopy01
      if (o.length > 11) o[11] = (c[a - 6] * v00 + c[b - 6] * v10 + c[d - 6] * v01 + c[e - 6] * v11) * k;   // (P15) canopy height (m)
    } else { const h = hf0(); o[4] = h[0]; o[5] = h[1]; o[6] = h[2]; o[7] = 0; }
    return o;
  }

  // (P12) The mean wind at (x, z), zh above the ground, as a fraction of the reference wind there: each of
  // the four nodes round the place has its own profile (the log law of its roughness, the calm under its
  // canopy, the lee of the trees upwind of it, which fades out above their tops), and the place has the
  // blend of the four. The particles' air (particles.js) is this same blend, tabulated every metre: one
  // air for what stands in it and what is carried by it.
  profileAt(x, z, zh) {
    const N = this.N, T = this.terrain;
    let u = T.u(x), v = T.v(z);
    u = u < 0 ? 0 : u > N - 1 ? N - 1 : u; v = v < 0 ? 0 : v > N - 1 ? N - 1 : v;
    let i = Math.floor(u), j = Math.floor(v);
    if (i > N - 2) i = N - 2; if (j > N - 2) j = N - 2;
    const fu = u - i, fv = v - j, n = j * N + i, va = T.valid, c = T.cover;
    let f = 0;
    for (let k = 0; k < 4; k++) {
      const w = (k & 1 ? fu : 1 - fu) * (k & 2 ? fv : 1 - fv);
      if (!(w > 0)) continue;
      const m = n + (k & 1) + (k & 2 ? N : 0), a = m * CW, ok = va[m];
      let fn = heightFactor(zh, ok ? c[a] : WIND.refRoughness, ok ? c[a + 2] : 0, ok ? c[a + 1] : 0);
      const wk = this.wake[m], wkH = this.wakeH[m];
      if (wk < 1 && wkH > 0) fn *= wakeAt(wk, wkH, zh);
      f += w * fn;
    }
    return f;
  }

  // Bilinear sample at grid position (x, z) (clamped to the grid). Fills o:
  //   we, wn (reference wind, frame axes), gust (-1..1), I, z0, canopy01, canopyH, dT, h (ground
  //   height above frame.r0, NaN when unknown), gx, gz (ground slope).
  sample(x, z, o) {
    const N = this.N, T = this.terrain;
    let u = T.u(x), v = T.v(z);
    u = u < 0 ? 0 : u > N - 1 ? N - 1 : u; v = v < 0 ? 0 : v > N - 1 ? N - 1 : v;
    let i = Math.floor(u), j = Math.floor(v);
    if (i > N - 2) i = N - 2; if (j > N - 2) j = N - 2;
    const fu = u - i, fv = v - j, n = j * N + i;
    const w00 = (1 - fu) * (1 - fv), w10 = fu * (1 - fv), w01 = (1 - fu) * fv, w11 = fu * fv;
    o.we = this.we[n] * w00 + this.we[n + 1] * w10 + this.we[n + N] * w01 + this.we[n + N + 1] * w11;
    o.wn = this.wn[n] * w00 + this.wn[n + 1] * w10 + this.wn[n + N] * w01 + this.wn[n + N + 1] * w11;
    o.gust = this.gust[n] * w00 + this.gust[n + 1] * w10 + this.gust[n + N] * w01 + this.gust[n + N + 1] * w11;
    o.cross = this.cross[n] * w00 + this.cross[n + 1] * w10 + this.cross[n + N] * w01 + this.cross[n + N + 1] * w11;
    o.I = this.I[n] * w00 + this.I[n + 1] * w10 + this.I[n + N] * w01 + this.I[n + N + 1] * w11;
    o.wake = this.wake[n] * w00 + this.wake[n + 1] * w10 + this.wake[n + N] * w01 + this.wake[n + N + 1] * w11;
    o.wakeH = Math.max(this.wakeH[n], this.wakeH[n + 1], this.wakeH[n + N], this.wakeH[n + N + 1]);
    // ground and cover: valid nodes only
    const va = T.valid, c = T.cover;
    const v00 = w00 * va[n], v10 = w10 * va[n + 1], v01 = w01 * va[n + N], v11 = w11 * va[n + N + 1];
    const vs = v00 + v10 + v01 + v11;
    if (vs > 0.2) {
      const k = 1 / vs, a = n * CW, b = a + CW, d = (n + N) * CW, e = d + CW;
      o.h = (T.h[n] * v00 + T.h[n + 1] * v10 + T.h[n + N] * v01 + T.h[n + N + 1] * v11) * k;
      o.gx = (T.gx[n] * v00 + T.gx[n + 1] * v10 + T.gx[n + N] * v01 + T.gx[n + N + 1] * v11) * k;
      o.gz = (T.gz[n] * v00 + T.gz[n + 1] * v10 + T.gz[n + N] * v01 + T.gz[n + N + 1] * v11) * k;
      o.z0 = (c[a] * v00 + c[b] * v10 + c[d] * v01 + c[e] * v11) * k;
      o.canopy01 = (c[a + 1] * v00 + c[b + 1] * v10 + c[d + 1] * v01 + c[e + 1] * v11) * k;
      o.canopyH = (c[a + 2] * v00 + c[b + 2] * v10 + c[d + 2] * v01 + c[e + 2] * v11) * k;
      o.dT = (c[a + 6] * v00 + c[b + 6] * v10 + c[d + 6] * v01 + c[e + 6] * v11) * k;
    } else { o.h = NaN; o.gx = 0; o.gz = 0; o.z0 = WIND.refRoughness; o.canopy01 = 0; o.canopyH = 0; o.dT = 0; }
    return o;
  }

  // Cover fields of the node nearest (x, z): fills o { z0, canopy01, canopyHeight, moist, fog,
  // dustSource, dT, snowBase } and returns true, or returns false when nothing is known yet.
  coverNear(x, z, o) {
    const n = this.terrain.nearest(x, z);
    if (n < 0) return false;
    const c = this.terrain.cover, a = n * CW;
    o.z0 = c[a]; o.canopy01 = c[a + 1]; o.canopyHeight = c[a + 2]; o.moist = c[a + 3];
    o.fog = c[a + 4]; o.dustSource = c[a + 5]; o.dT = c[a + 6]; o.snowBase = c[a + 7];
    o.leaves = c[a + 11]; o.spores = c[a + 12]; o.ash = c[a + 13]; o.fetch = c[a + 14]; o.liquidDensity = c[a + 15];
    return true;
  }
}

// Wind in the free air above the surface layer, as a multiple of the 60 m wind.
export function aloftFactor(bodyId, z) {
  const top = BODIES[bodyId].atmosphereHeight || 0;
  if (z <= WIND.blendHeight || top <= WIND.blendHeight) return 1;
  const g = bodyId === 'venus' ? AIR.aloftGainVenus : AIR.aloftGain;
  return 1 + g * smoothstep(WIND.blendHeight, Math.max(top * 0.6, WIND.blendHeight + 1), z);
}

const _s = {};
const _dw = new Float64Array(3);
const _sub = new Float64Array(4);

// The air at body-local point (px,py,pz).
//   grid: the AirGrid (or null), frame: its LocalFrame, used when the point is near the focus.
//   sunDir: body-local unit vector toward the sun, or null.   height: m above the ground if the
//   caller knows it (otherwise the near-field ground cache is used, or 10 m is assumed).
// Fills o: density (kg/m^3), wind {x,y,z} (m/s, body-local), speed, gust01 (0 lull .. 1 gust),
// turbulence (sigma of the wind speed, m/s), temperature (K), pressure (Pa), soundSpeed (m/s),
// viscosity (Pa s), altitude (m above the base radius), height (m above ground used), near (bool).
// recv (optional, P18): what feels the air there, { size (m), vx, vy, vz (its velocity, body-local m/s) }: the sub-second
// eddies smaller than it are averaged away and those it meets too often fade (wind.js gustSubAt). Without it: a point at rest.
export function airAt(bodyId, px, py, pz, t, seed, grid, frame, sunDir, height, o = {}, devils = null, recv = null) {
  const body = BODIES[bodyId], atm = ATMOSPHERES[bodyId];
  const r = Math.hypot(px, py, pz) || 1;
  const ux = px / r, uy = py / r, uz = pz / r;
  const alt = r - body.radius;
  const wind = o.wind || (o.wind = { x: 0, y: 0, z: 0 });
  const rho = airDensity(bodyId, alt);
  const sun01 = sunDir ? ux * sunDir.x + uy * sunDir.y + uz * sunDir.z : null;
  o.density = rho;
  o.altitude = alt;
  o.viscosity = atm.mu;
  o.near = false;
  let dT = 0;
  if (!(rho > 0) || !WINDS[bodyId] || WINDS[bodyId].U === 0) {
    wind.x = wind.y = wind.z = 0; o.speed = 0; o.gust01 = 0; o.veer = 0; o.turbulence = 0; o.height = height != null ? height : 0;
  } else if (grid && frame && grid.ready && frame.bodyId === bodyId && grid.bodyId === bodyId && grid.inside(frame.lx(px, py, pz), frame.lz(px, py, pz))) {
    const x = frame.lx(px, py, pz), z = frame.lz(px, py, pz);
    grid.sample(x, z, _s);
    let zh = height;
    if (zh == null) zh = _s.h === _s.h ? r - (frame.r0 + _s.h) : 10;
    if (zh < 0) zh = 0;
    // (P12: the four nodes' own profiles, blended; see profileAt. It was one profile of the blended
    // ground: half-way between a meadow node and a wood node, a canopy of half the height and half
    // the closure, which is no wood at all at 10 m up.)
    let f = grid.profileAt(x, z, zh) * aloftFactor(bodyId, zh);
    // (P11) the fine eddies, exactly at this point (the grid holds the large gusts only: see wind.js)
    const fMean = f;
    let gust = _s.gust, kx = 0, veer = 0;
    {
      const gs = grid.gustShift, A = (_s.I + grid.gustiness * 0.15) * WIND.gustGain;
      const fc = Math.max(WIND.minFactor, 1 + A * gust);
      const kr = (body.radius + zh) / r;      // (P12) on the sphere, zh above it: see AirGrid.update
      gust += gustFineAt(bodyId, px * kr, py * kr, pz * kr, gs[0], gs[1], gs[2], gs[3], gs[4], gs[5], t, grid.seed);
      // (P18) the sub-second eddies at this point, by Kaimal's spectrum at its height (over the canopy's displacement), weighted
      // against the OPEN profile here (the log law of the ground's roughness, no canopy, no lee): what they add is then U10 I
      // times Kaimal's share times fMean / fOpen, so in the lee of a wood or under a canopy the small eddies are as much smaller
      // as the mean wind is (sigma follows the local friction velocity), and in the open they are the surface layer's
      const U10 = Math.hypot(grid.cwe, grid.cwn), Ue = recv ? Math.hypot(grid.cwx - (recv.vx || 0), grid.cwy - (recv.vy || 0), grid.cwz - (recv.vz || 0)) : U10;
      const fOpen = heightFactor(zh, _s.z0 > 0 ? _s.z0 : WIND.refRoughness) * aloftFactor(bodyId, zh);
      gustSubAt(bodyId, px * kr, py * kr, pz * kr, gs, t, grid.seed, zh - 0.65 * _s.canopyH * _s.canopy01, fOpen, U10, _sub, recv ? recv.size || 0 : 0, Ue);
      gust += _sub[0];
      gust = gust > WIND.gustMax ? WIND.gustMax : gust < -WIND.gustMax ? -WIND.gustMax : gust;
      f *= Math.max(WIND.minFactor, 1 + A * gust) / fc;
      // (P12) the fine lateral eddies, exactly at this point: the grid's wind already swings with the two
      // large octaves (_s.cross); what the whole level adds to that, as a fraction of the mean wind here
      let ct = _s.cross + gustCrossFineAt(bodyId, px * kr, py * kr, pz * kr, gs[0], gs[1], gs[2], gs[3], gs[4], gs[5], t, grid.seed) + _sub[1];
      ct = ct > WIND.gustMax ? WIND.gustMax : ct < -WIND.gustMax ? -WIND.gustMax : ct;
      kx = A * WIND.crossRatio * (ct - _s.cross) / Math.max(WIND.minFactor, 1 + A * gust);
      veer = A * WIND.crossRatio * ct;
    }
    const we0 = (_s.we - _s.wn * kx) * f, wn0 = (_s.wn + _s.we * kx) * f;
    // the flow follows the ground: vertical component from the slope, fading with height
    let wu = (we0 * _s.gx + wn0 * _s.gz) * Math.exp(-zh / 25);
    let we = we0, wn = wn0;
    // a dust devil close by: its swirl, inflow and updraught are added exactly, not from the grid
    if (devils && devils.count > 0 && devilWind(devils, x, z, zh, _dw)) { we += _dw[0]; wn += _dw[1]; wu += _dw[2]; }
    // (P12) the grid's wind is in the frame's axes, the tangent plane at the ANCHOR. Here, up to 384 m
    // away on a 4 km sphere, that plane is tilted 5.5 degrees to the ground: a 7 m/s wind blew 0.7 m/s
    // into or out of the hill, and stopped doing so in one frame when the frame re-anchored. Turn it
    // into this point's own tangent plane (the smallest rotation that takes the anchor's up to this up).
    {
      let hx = frame.ex * we + frame.nx * wn, hy = frame.ey * we + frame.ny * wn, hz = frame.ez * we + frame.nz * wn;
      const c = frame.ax * ux + frame.ay * uy + frame.az * uz;
      if (c > -0.9) { const k = (hx * ux + hy * uy + hz * uz) / (1 + c); hx -= (frame.ax + ux) * k; hy -= (frame.ay + uy) * k; hz -= (frame.az + uz) * k; }
      wind.x = hx + ux * wu; wind.y = hy + uy * wu; wind.z = hz + uz * wu;
    }
    o.speed = Math.hypot(we, wn, wu);
    o.gust01 = clamp01(0.5 + 0.5 * gust);
    o.veer = veer;                 // (P12) the lateral speed over the mean wind: the tangent of how far the wind has swung
    // (P18: and the sub-second eddies' share of sigma_u^2 = ((I + ...) U10)^2)
    { const ti = (_s.I + grid.gustiness * 0.15) * Math.hypot(grid.cwe, grid.cwn), tb = ti * fMean / (1 + zh / 300), fo = heightFactor(zh, _s.z0 > 0 ? _s.z0 : WIND.refRoughness) * aloftFactor(bodyId, zh), ts = ti * Math.min(1, fMean / Math.max(fo, 1e-3)); o.turbulence = Math.sqrt(tb * tb + ts * ts * _sub[2]); }
    o.height = zh; o.near = true; dT = _s.dT;
  } else {
    windLarge(bodyId, ux, uy, uz, t, seed, _w);
    weatherWind(bodyId, ux, uy, uz, t, seed, _ww);
    let wx = _w[0] * _ww[0] + _ww[1], wy = _w[1] * _ww[0] + _ww[2], wz = _w[2] * _ww[0] + _ww[3];
    { const bs = Math.hypot(wx, wy, wz), bl = bs > 1e-6 ? _ww[5] * Math.min(1, bs / 2) / bs : 0; wx *= 1 + bl; wy *= 1 + bl; wz *= 1 + bl; }   // the system's own wind
    // (no state out here: the pattern is carried by the synoptic wind alone, which changes over
    // hours; carried by the storm's own wind it would race whenever that wind changed, see gustLevel)
    const g = gustLevel(bodyId, px, py, pz, _w[0], _w[1], _w[2], t, seed);
    const zh = height != null ? Math.max(0, height) : 10;
    const I = turbulenceIntensity(WIND.refHeight, WIND.refRoughness) + _ww[4] * 0.15;
    const f = Math.max(WIND.minFactor, 1 + I * WIND.gustGain * g) * heightFactor(zh, WIND.refRoughness) * aloftFactor(bodyId, zh);
    wx *= f; wy *= f; wz *= f;
    // (P12) the lateral part, across the wind in the horizontal (the two large octaves, as the grid's fields)
    {
      const kc = I * WIND.gustGain * WIND.crossRatio * gustCross(bodyId, px, py, pz, _w[0], _w[1], _w[2], t, seed) / Math.max(WIND.minFactor, 1 + I * WIND.gustGain * g);
      const cx = uy * wz - uz * wy, cy = uz * wx - ux * wz, cz = ux * wy - uy * wx;
      wx += cx * kc; wy += cy * kc; wz += cz * kc; o.veer = kc;
    }
    wind.x = wx; wind.y = wy; wind.z = wz;
    o.speed = Math.hypot(wx, wy, wz);
    o.gust01 = clamp01(0.5 + 0.5 * g);
    o.turbulence = I * o.speed / (1 + zh / 300);
    o.height = zh;
  }
  const T = airTemperature(bodyId, alt, uy, sun01) + dT;
  o.temperature = T;
  o.pressure = atm.M > 0 ? rho * 8.314462 * T / atm.M : 0;
  o.soundSpeed = rho > 0 ? atm.c * Math.sqrt(T / atm.T0) : 0;
  return o;
}
