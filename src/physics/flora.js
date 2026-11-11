// Painted Cosmos physics: how plants move. OWNER: PHYSICS. Pure (no three, no DOM).
//
// A plant is a damped cantilever. Wind drag loads it; it deflects toward a static bend that
// saturates as it streamlines; because it has mass and stiffness it overshoots and sways at its
// own natural frequency, which falls with its size:
//   grass and reeds (0.3-2 m)   2-5 Hz, heavily damped by the air (damping ratio 0.3-0.5)
//   saplings and shrubs         about 1 Hz
//   trees: f = 0.0948 + 3.4317 DBH / H^2 Hz (DBH in cm, H in m; Moore and Maguire 2004):
//     a 20 m pine with a 30 cm trunk sways at 0.35 Hz, a 10 m birch at 0.6 Hz; damping 0.05-0.15.
// The load is the dynamic pressure of the air, q = rho U^2 / 2, so the same wind speed bends
// plants hard in the dense air of Venus and hardly at all on Mars.
//
// Delivered two ways that agree by construction:
//   1. FloraField: two grids around the focus.
//        bend (32 x 32 cells of 8 m): the dynamic response, in load units, of a reference SOFT
//          oscillator (grass) and a reference STIFF one (trees) to the gusty wind of that cell.
//          Gusts travel through the wind grid, so waves run through a meadow and a wood sways
//          in slow coherent masses, never as noise.
//        push (64 x 64 cells of 0.5 m): plants pushed aside by bodies (explorer, hull), blown
//          down by jets (jetpack plume, ship downwash), flattened under weight, springing back.
//      PAINTER uploads both as textures; FLORA_GLSL (flora.glsl.js) turns them into a vertex bend.
//   2. plantBend(): the same arithmetic in JS for a handful of near plants (and for the tests).
//   Plus PlantSim: a single plant integrated with its own frequency, for hero plants.
import { clamp, clamp01, smoothstep, oscStep, TAU } from './util.js';
import { scrollField } from './near.js';
import { devilWind } from './features.js';

export const FLORA = Object.freeze({
  N: 32, cell: 8,               // bend / wind field
  nearN: 64, nearCell: 0.5,     // push field
  qRef: 39.2,                   // Pa = load 1: the dynamic pressure of an 8 m/s wind in Earth air
  softHeight: 0.5,              // m: where grass feels the wind
  stiffHeight: 10,              // m: where crowns feel it (or the canopy top, if higher)
  softHz: 2.2, softDamp: 0.38,
  stiffHz: 0.45, stiffDamp: 0.12,
  // shape of the response (shared with the shader through uniforms)
  softFlex: 3.0, softMax: 1.2,        // bend angle = max * (1 - exp(-flex * load)), radians
  stiffFlex: 1.2, stiffMax: 0.25,
  flatAngle: 1.45,              // rad: a flattened plant lies this far over
  // travelling waves in soft plants (honami): wavelengths about 14, 11 and 19 m, moving a bit
  // faster than the wind at blade height
  waveK: 0.45,                  // rad/m of the first train
  waveSpeed: 1.4,               // x wind speed at blade height
  waveAmp: 0.45,                // modulation depth of the soft load at full gust
  // contact pushes
  pushLoad: 2.6,                // load a body puts on plants it touches
  pushReach: 0.7,               // m beyond the body radius that plants are still pushed (0.45 before P7: stems
                                //   lean on their neighbours; a walker parts the grass about two metres wide)
  // the wake (P7): a stem pushed over does not come all the way back at once. A share of the
  // push stays as a lean (the way it was pushed: aside and along the walker's path), set in a
  // quarter of a second of contact, and goes over wakeTime: at a walk the parted wake trails
  // some ten metres behind (measured: grass 0.6 m off the path leans 60 degrees as the walker passes, 25 degrees
  // 3 m behind, 17 degrees 7.5 m behind, nothing half a minute later). And where the body itself went the grass is pressed down sooner.
  wakeShare: 0.2, wakeSet: 0.25, wakeTime: 6,
  flatReach: 0.25,              // m beyond the body radius pressed fully flat (P7, PAINTER's ask: not the boot but the sweep
                                //   of legs and coat hem through knee-high grass: flat to 0.6 m, half at 0.85 m, none at 1.1 m)
  trampleTime: 0.7,             // s under a body for most of the trampled set to form (2.5 before P7: a walker left none)
  pushHz: 1.6, pushDamp: 0.55,  // spring-back of a released plant: one small overshoot
  contactHz: 7,                 // how fast a plant gives way to a body
  flatRecover: 1.2,             // s: elastic recovery of flattened plants
  flatSet: 60,                  // s: recovery of the trampled (plastic) part
  shakeDecay: 0.7,              // s
  // crowns that touch load each other: in a closed canopy a tree cannot sway far from its
  // neighbours, so a wood moves in slow masses and the collisions take energy out (Rudnicki et
  // al. 2008). Rate (1/s) at which the stiff response of a cell is drawn toward the mean of
  // its four neighbours, times the canopy closure there.
  crownCoupling: 0.9,
  jetSpread: 0.25,              // jet footprint radius grows by this x height above the ground
  // Branches. A tree is not one cantilever: its first-order branches are cantilevers on the
  // trunk with natural frequencies two to four times the trunk's (measured on open-grown trees:
  // trunk 0.2 to 0.5 Hz, branches 0.8 to 2 Hz; James, Haritos and Ades 2006; Rodriguez, de
  // Langre and Moulia 2008), each with its own phase. They are driven by the turbulence, not
  // the mean wind, and being out of step with the trunk they take energy out of its sway (the
  // crown is the tree's damper). So a crown does not sway as one piece: lobes of it bob and
  // swing in turn, faster than the trunk leans.
  branchHz: 1.3,                // Hz: the first of four branch rates (x BRANCH_F)
  branchGain: 0.5,              // rad of branch swing per rad of trunk lean, in fully gusty air (tips of 3.5 m branches
                                // move about 10 cm in a fresh breeze, half a metre in a storm)
  branchCalm: 0.35,             // share of that left in smooth air (the trunk's own sway shakes them)
  branchShake: 0.08,            // rad: swing of a crown that has just been brushed or blown on (shake01 = 1)
  crown: 0.35,                  // a branch is this long, as a share of the plant's height
});
// Four branch oscillators: relative rates (incommensurate, so the pattern never repeats), how
// many lobes each puts round the trunk (whole numbers: the motion is continuous all the way
// round), and how its phase runs with height and from tree to tree.
export const BRANCH_F = [1, 1.37, 0.71, 1.93];
export const BRANCH_M = [2, 3, 1, 4];
export const BRANCH_S = [2.6, -1.9, 4.1, 0];
export const BRANCH_T = [1, 1.7, 2.3, 0.6];

const _s = new Float64Array(8);
const _coef = new Float64Array(8);
const _tmp2 = new Float64Array(2);
const _dwf = new Float64Array(3);

// Coefficients of the exact oscillator step for (w, z, dt): [a11, a12, a21, a22].
function oscCoef(w, z, dt, o, i) {
  _tmp2[0] = 1; _tmp2[1] = 0; oscStep(_tmp2, 0, 0, w, z, dt); o[i] = _tmp2[0]; o[i + 2] = _tmp2[1];
  _tmp2[0] = 0; _tmp2[1] = 1; oscStep(_tmp2, 0, 0, w, z, dt); o[i + 1] = _tmp2[0]; o[i + 3] = _tmp2[1];
}

export class FloraField {
  constructor() {
    const N = FLORA.N, M = FLORA.nearN;
    this.N = N; this.cell = FLORA.cell; this.M = M; this.nearCell = FLORA.nearCell;
    // textures for PAINTER (RGBA float, row-major, row = north index)
    this.bend = new Float32Array(N * N * 4);     // soft east, soft north, stiff east, stiff north (load units)
    this.wind = new Float32Array(N * N * 4);     // wind east, north at 2 m (m/s), gust01, turbulence (m/s)
    this.push = new Float32Array(M * M * 4);     // push east, north (load units), flatten01, shake01
    // internal state
    this._vel = new Float32Array(N * N * 4);     // rates of the four bend components
    this._pv = new Float32Array(M * M * 2);      // push rates
    this._fl = new Float32Array(M * M * 2);      // flatten: elastic, plastic
    this._act = new Uint8Array(M * M);
    this._tmpN = new Float32Array(N * N * 4);
    this._tmpM = new Float32Array(M * M * 4);
    this._tmpA = new Uint8Array(M * M);
    this._tg = new Float32Array(M * M * 4);      // push targets of this step (zero between steps)
    this._st = new Float32Array(M * M * 2);      // the lean a pushed plant keeps for a while (the wake)
    this._can = new Float32Array(N * N);         // canopy closure per bend cell
    this._cpl = new Float32Array(N * N * 4);     // scratch for the crown coupling
    this.ci = 0; this.cj = 0;                    // bend grid centre, in cells
    this.mi = 0; this.mj = 0;                    // push grid centre, in near cells
    this.frameVersion = -1;
    this.version = 0;                            // bumps every update (re-upload bend and wind)
    this.pushVersion = 0;                        // bumps when the push field changed
    this.active = 0;                             // cells of the push field that are moving
    this.rho = 1.225;
    this.wavePhase = new Float64Array(3);
    this.waveDir = new Float64Array(2); this.waveDir[0] = 1;
    this.gustMean = 0;
    // uniforms for FLORA_GLSL, refreshed every update (plain arrays; PAINTER copies them)
    this.uniforms = {
      uPhysAnchor: [0, 0, 0], uPhysEast: [1, 0, 0], uPhysNorth: [0, 0, -1], uPhysUp: [0, 1, 0],
      uPhysWindMap: [0, 0, 1 / (N * FLORA.cell), N],
      uPhysNearMap: [0, 0, 1 / (M * FLORA.nearCell), M],
      uPhysWave: [1, 0, FLORA.waveK, FLORA.waveAmp],
      uPhysWavePhase: [0, 0, 0, 0],
      uPhysShape: [FLORA.softFlex, FLORA.softMax, FLORA.stiffFlex, FLORA.stiffMax],
      // branches (P6): phases of the four branch oscillators (rad, wrapped), and
      // x: gustiness 0..1 near the focus, y: gain, z: shake swing (rad), w: branch length / height
      uPhysBranchPhase: [0, 0, 0, 0],
      uPhysBranch: [0, FLORA.branchGain, FLORA.branchShake, FLORA.crown],
    };
    this.branchPhase = new Float64Array(4);
    this.gustiness = 0;
  }

  reset() {
    this.bend.fill(0); this.wind.fill(0); this.push.fill(0); this._vel.fill(0); this._pv.fill(0); this._fl.fill(0); this._act.fill(0); this._tg.fill(0); this._st.fill(0);
    this.active = 0;
  }

  // The frame has re-anchored at old grid position (X, Z) (multiples of 16 m): keep every cell
  // and renumber the grids, so parted grass and swaying trees carry straight on.
  rebase(frame, X, Z) {
    this.frameVersion = frame.version;
    this.ci -= Math.round(X / this.cell); this.cj -= Math.round(Z / this.cell);
    this.mi -= Math.round(X / this.nearCell); this.mj -= Math.round(Z / this.nearCell);
    this.onReanchor(X, Z);
  }

  // (dx, dz) is the new anchor in the OLD frame's coordinates: keeps the travelling waves continuous.
  onReanchor(dx, dz) {
    const k = FLORA.waveK, d0 = this.waveDir[0], d1 = this.waveDir[1];
    for (let i = 0; i < 3; i++) {
      const a = WAVE_ROT[i], ki = k * WAVE_K[i];
      const ex = d0 * Math.cos(a) - d1 * Math.sin(a), ez = d0 * Math.sin(a) + d1 * Math.cos(a);
      this.wavePhase[i] -= ki * (ex * dx + ez * dz);
    }
  }

  // Advance the fields by dt.
  //   frame: LocalFrame.  air: AirGrid (already updated this frame).  near: TerrainGrid of the
  //   near field (2 m nodes) or null.  rho: air density at the focus.  (fx, fz): focus in grid
  //   coordinates.  disturbers: frame.disturbers (see index.js).  quality: 0 | 1 | 2.
  update(dt, frame, air, near, rho, fx, fz, disturbers, quality, devils) {
    const N = this.N, cell = this.cell, M = this.M, nc = this.nearCell;
    if (this.frameVersion !== frame.version) {
      this.frameVersion = frame.version; this.reset();
      this.ci = Math.round(fx / cell); this.cj = Math.round(fz / cell);
      this.mi = Math.round(fx / nc); this.mj = Math.round(fz / nc);
    }
    // follow the focus in whole cells
    const ni = Math.round(fx / cell), nj = Math.round(fz / cell);
    if (ni !== this.ci || nj !== this.cj) {
      scrollField(this.bend, this._tmpN, N, 4, ni - this.ci, nj - this.cj, 0);
      scrollField(this._vel, this._tmpN, N, 4, ni - this.ci, nj - this.cj, 0);
      this.ci = ni; this.cj = nj;
    }
    const pi = Math.round(fx / nc), pj = Math.round(fz / nc);
    if (pi !== this.mi || pj !== this.mj) {
      const di = pi - this.mi, dj = pj - this.mj;
      scrollField(this.push, this._tmpM, M, 4, di, dj, 0);
      scrollField(this._pv, this._tmpM, M, 2, di, dj, 0);
      scrollField(this._fl, this._tmpM, M, 2, di, dj, 0);
      scrollField(this._st, this._tmpM, M, 2, di, dj, 0);
      scrollField(this._act, this._tmpA, M, 1, di, dj, 0);
      this.mi = pi; this.mj = pj; this.pushVersion++;
    }
    this.rho = rho;
    const h = dt > 0.1 ? 0.1 : dt;

    // ---- bend field: drive the two reference oscillators with the wind load of each cell --------
    oscCoef(TAU * FLORA.softHz, FLORA.softDamp, h, _coef, 0);
    oscCoef(TAU * FLORA.stiffHz, FLORA.stiffDamp, h, _coef, 4);
    const a11 = _coef[0], a12 = _coef[1], a21 = _coef[2], a22 = _coef[3];
    const b11 = _coef[4], b12 = _coef[5], b21 = _coef[6], b22 = _coef[7];
    const kq = 0.5 * rho / FLORA.qRef;
    const bend = this.bend, vel = this._vel, wind = this.wind;
    let gsum = 0, se = 0, sn = 0, tsum = 0;
    const swirl = !!devils && devils.count > 0;
    for (let j = 0; j < N; j++) {
      const z = (this.cj + j - N / 2 + 0.5) * cell;
      for (let i = 0; i < N; i++) {
        const x = (this.ci + i - N / 2 + 0.5) * cell;
        air.sampleWind(x, z, _s);
        const n = j * N + i, o = n * 4;
        let we = _s[0], wn = _s[1];
        const hs = _s[4], ht = _s[5], h2 = _s[6];
        // a dust devil in the field: its swirl bends the plants round it (divided by the height
        // factor because the vortex is given at plant height already)
        if (swirl && devilWind(devils, x, z, 0.5, _dwf)) { we += _dwf[0] / (hs > 0.05 ? hs : 0.05); wn += _dwf[1] / (hs > 0.05 ? hs : 0.05); }
        const sp = Math.sqrt(we * we + wn * wn);
        // load = q / qRef along the wind, at the height each class lives at
        const ls = kq * sp * hs * hs, lt = kq * sp * ht * ht;
        const tse = we * ls, tsn = wn * ls, tte = we * lt, ttn = wn * lt;
        let d = bend[o] - tse, v = vel[o];
        bend[o] = tse + a11 * d + a12 * v; vel[o] = a21 * d + a22 * v;
        d = bend[o + 1] - tsn; v = vel[o + 1];
        bend[o + 1] = tsn + a11 * d + a12 * v; vel[o + 1] = a21 * d + a22 * v;
        d = bend[o + 2] - tte; v = vel[o + 2];
        bend[o + 2] = tte + b11 * d + b12 * v; vel[o + 2] = b21 * d + b22 * v;
        d = bend[o + 3] - ttn; v = vel[o + 3];
        bend[o + 3] = ttn + b11 * d + b12 * v; vel[o + 3] = b21 * d + b22 * v;
        wind[o] = we * h2; wind[o + 1] = wn * h2;
        const g01 = 0.5 + 0.5 * _s[2];
        wind[o + 2] = g01 < 0 ? 0 : g01 > 1 ? 1 : g01;
        wind[o + 3] = _s[3] * sp * h2;
        this._can[n] = _s[7];
        gsum += wind[o + 2]; se += we * hs; sn += wn * hs; tsum += wind[o + 3];
      }
    }
    // ---- crowns loading their neighbours --------------------------------------------------------
    if (FLORA.crownCoupling > 0) {
      const cp = this._cpl, can = this._can, kc = FLORA.crownCoupling * h;
      for (let n = 0; n < N * N; n++) { const o = n * 4; cp[o] = bend[o + 2]; cp[o + 1] = bend[o + 3]; cp[o + 2] = vel[o + 2]; cp[o + 3] = vel[o + 3]; }
      for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
        const n = j * N + i, c = can[n];
        if (c < 0.2) continue;
        const k = 1 - Math.exp(-kc * c), o = n * 4, l = o - 4, r = o + 4, d = o - N * 4, u = o + N * 4;
        // position and velocity both: touching crowns share load and damp their relative motion
        bend[o + 2] += ((cp[l] + cp[r] + cp[d] + cp[u]) * 0.25 - cp[o]) * k;
        bend[o + 3] += ((cp[l + 1] + cp[r + 1] + cp[d + 1] + cp[u + 1]) * 0.25 - cp[o + 1]) * k;
        vel[o + 2] += ((cp[l + 2] + cp[r + 2] + cp[d + 2] + cp[u + 2]) * 0.25 - cp[o + 2]) * k;
        vel[o + 3] += ((cp[l + 3] + cp[r + 3] + cp[d + 3] + cp[u + 3]) * 0.25 - cp[o + 3]) * k;
      }
    }

    // ---- travelling waves ------------------------------------------------------------------------
    const inv = 1 / (N * N);
    se *= inv; sn *= inv;
    const ms = Math.hypot(se, sn);
    if (ms > 0.05) {
      // the wave direction follows the mean wind slowly (it must not swing with every gust)
      const k = 1 - Math.exp(-h / 6);
      let d0 = this.waveDir[0] + (se / ms - this.waveDir[0]) * k, d1 = this.waveDir[1] + (sn / ms - this.waveDir[1]) * k;
      const l = Math.hypot(d0, d1) || 1;
      this.waveDir[0] = d0 / l; this.waveDir[1] = d1 / l;
    }
    for (let i = 0; i < 3; i++) {
      this.wavePhase[i] = (this.wavePhase[i] + FLORA.waveK * WAVE_K[i] * FLORA.waveSpeed * WAVE_C[i] * ms * h) % (TAU * 1024);
    }
    this.gustMean = gsum * inv;
    // branches: four oscillators on the clock, and how gusty the air is (turbulence over mean wind), eased over 2 s
    for (let i = 0; i < 4; i++) this.branchPhase[i] = (this.branchPhase[i] + TAU * FLORA.branchHz * BRANCH_F[i] * h) % TAU;
    { const g = clamp01(tsum * inv / (ms + 0.5) * 2.5); this.gustiness += (g - this.gustiness) * (1 - Math.exp(-h / 2)); }

    // ---- push field ----------------------------------------------------------------------------------
    this._pushStep(h, frame, near, fx, fz, disturbers);

    // ---- uniforms -----------------------------------------------------------------------------------
    const U = this.uniforms;
    U.uPhysAnchor[0] = frame.ox; U.uPhysAnchor[1] = frame.oy; U.uPhysAnchor[2] = frame.oz;
    U.uPhysEast[0] = frame.ex; U.uPhysEast[1] = frame.ey; U.uPhysEast[2] = frame.ez;
    U.uPhysNorth[0] = frame.nx; U.uPhysNorth[1] = frame.ny; U.uPhysNorth[2] = frame.nz;
    U.uPhysUp[0] = frame.ax; U.uPhysUp[1] = frame.ay; U.uPhysUp[2] = frame.az;
    U.uPhysWindMap[0] = this.ci * cell; U.uPhysWindMap[1] = this.cj * cell;
    U.uPhysNearMap[0] = this.mi * nc; U.uPhysNearMap[1] = this.mj * nc;
    U.uPhysWave[0] = this.waveDir[0]; U.uPhysWave[1] = this.waveDir[1];
    U.uPhysWavePhase[0] = this.wavePhase[0] % TAU; U.uPhysWavePhase[1] = this.wavePhase[1] % TAU; U.uPhysWavePhase[2] = this.wavePhase[2] % TAU;
    for (let i = 0; i < 4; i++) U.uPhysBranchPhase[i] = this.branchPhase[i];
    U.uPhysBranch[0] = this.gustiness;
    this.version++;
  }

  _pushStep(h, frame, near, fx, fz, disturbers) {
    const M = this.M, nc = this.nearCell;
    const push = this.push, pv = this._pv, fl = this._fl, act = this._act;
    const half = M / 2;
    // 1. targets from disturbers, written into the scratch field (target east, north, flatten, shake)
    const tg = this._tg;
    let any = false;
    if (disturbers) {
      for (let k = 0; k < disturbers.length; k++) {
        const D = disturbers[k];
        if (!D || !D.p) continue;
        const x = frame.lx(D.p.x, D.p.y, D.p.z), z = frame.lz(D.p.x, D.p.y, D.p.z);
        const gh = near ? near.heightAt(x, z, NaN) : NaN;
        const r = Math.hypot(D.p.x, D.p.y, D.p.z);
        const hgt = gh === gh ? r - (frame.r0 + gh) : (D.height != null ? D.height : 0);
        const air = D.kind === 'jet' || D.kind === 'downwash';
        let reach, R = D.radius || 0.4;
        let qg = 0;
        if (air) {
          // a jet striking the ground spreads into a radial wall jet. A free jet keeps its
          // momentum while it widens (about 14 degrees half-angle), so the dynamic pressure on
          // the ground is the thrust over the footprint: it falls as 1 / height^2 and nothing else
          R = R + FLORA.jetSpread * Math.max(0, hgt);
          qg = (D.strength || 0) / (Math.PI * R * R) / FLORA.qRef;
          if (qg < 0.03) continue;                 // under 1.2 Pa: less than a breath of wind
          reach = R * Math.min(6, Math.sqrt(qg / 0.03));
        } else {
          // a body only touches plants when it is down among them
          if (hgt > (D.kind === 'ship' ? 2.5 : 1.2)) continue;
          reach = R + FLORA.pushReach;
        }
        const vx = D.v ? D.v.x * frame.ex + D.v.y * frame.ey + D.v.z * frame.ez : 0;
        const vz = D.v ? D.v.x * frame.nx + D.v.y * frame.ny + D.v.z * frame.nz : 0;
        const sp = Math.hypot(vx, vz);
        const i0 = Math.max(0, Math.floor((x - reach) / nc - this.mi + half)), i1 = Math.min(M - 1, Math.ceil((x + reach) / nc - this.mi + half));
        const j0 = Math.max(0, Math.floor((z - reach) / nc - this.mj + half)), j1 = Math.min(M - 1, Math.ceil((z + reach) / nc - this.mj + half));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const cx = (this.mi + i - half + 0.5) * nc - x, cz = (this.mj + j - half + 0.5) * nc - z;
          const d = Math.hypot(cx, cz);
          if (d > reach) continue;
          const n = j * M + i, o = n * 4;
          act[n] = 1;
          let mag, flat = 0, shake;
          const dx = d > 1e-4 ? cx / d : 0, dz = d > 1e-4 ? cz / d : 0;
          let ex = dx, ez = dz;
          if (air) {
            const u = d / R;
            mag = qg * (u < 1 ? u : 1 / (u * u));
            flat = clamp01(qg / 4) * (1 - smoothstep(0.5, 1.3, u)) * 0.8;
            shake = clamp01(mag);
          } else {
            mag = FLORA.pushLoad * (D.strength == null ? 1 : D.strength) * (1 - smoothstep(R * 0.5, reach, d));
            // plants ahead of a moving body are pushed forward as well as aside
            if (sp > 0.2) { const f = Math.min(0.6, sp / 6); ex = dx * (1 - f) + vx / sp * f; ez = dz * (1 - f) + vz / sp * f; }
            // under the body itself the plants are pressed flat (falling off over one cell)
            if (hgt < 0.4) flat = 1 - smoothstep(R + FLORA.flatReach, R + FLORA.flatReach + nc, d);
            shake = clamp01(mag * (0.2 + sp / 3));
          }
          // strongest disturber wins per cell
          if (mag > Math.hypot(tg[o], tg[o + 1])) { tg[o] = ex * mag; tg[o + 1] = ez * mag; }
          if (flat > tg[o + 2]) tg[o + 2] = flat;
          if (shake > tg[o + 3]) tg[o + 3] = shake;
        }
        any = true;
      }
    }
    if (!any && this.active === 0) return;
    // 2. integrate the active cells
    oscCoef(TAU * FLORA.pushHz, FLORA.pushDamp, h, _coef, 0);
    oscCoef(TAU * FLORA.contactHz, 1.0, h, _coef, 4);
    const ke = 1 - Math.exp(-h / FLORA.flatRecover), kp = 1 - Math.exp(-h / FLORA.flatSet), ks = Math.exp(-h / FLORA.shakeDecay);
    const st = this._st, kw = 1 - Math.exp(-h / FLORA.wakeSet), kr = Math.exp(-h / FLORA.wakeTime), kt = 1 - Math.exp(-h / FLORA.trampleTime);
    let active = 0;
    for (let n = 0; n < M * M; n++) {
      if (!act[n]) continue;
      const o = n * 4, o2 = n * 2;
      let te = tg[o], tn = tg[o + 1]; const tf = tg[o + 2], ts = tg[o + 3];
      // the wake: while it is pushed a share of the push sets in; released, the plant comes back to
      // that lean (with its own swing), and the lean goes slowly
      const touched = te !== 0 || tn !== 0;
      if (touched) {
        const we2 = te * FLORA.wakeShare, wn2 = tn * FLORA.wakeShare;
        if (we2 * we2 + wn2 * wn2 > st[o2] * st[o2] + st[o2 + 1] * st[o2 + 1]) { st[o2] += (we2 - st[o2]) * kw; st[o2 + 1] += (wn2 - st[o2 + 1]) * kw; }
      } else { st[o2] *= kr; st[o2 + 1] *= kr; te = st[o2]; tn = st[o2 + 1]; }
      // giving way to a body is fast and critically damped; springing back is the plant's own
      const pushing = te * te + tn * tn > push[o] * push[o] + push[o + 1] * push[o + 1];
      const c = pushing ? 4 : 0;
      let d = push[o] - te, v = pv[o2];
      push[o] = te + _coef[c] * d + _coef[c + 1] * v; pv[o2] = _coef[c + 2] * d + _coef[c + 3] * v;
      d = push[o + 1] - tn; v = pv[o2 + 1];
      push[o + 1] = tn + _coef[c] * d + _coef[c + 1] * v; pv[o2 + 1] = _coef[c + 2] * d + _coef[c + 3] * v;
      // flatten: pressed down at once, elastic part recovers in a second, trampled part in a minute
      if (tf > fl[o2]) fl[o2] = tf; else fl[o2] -= fl[o2] * ke;
      if (tf > 0.9) fl[o2 + 1] += (0.6 - fl[o2 + 1]) * kt; else fl[o2 + 1] -= fl[o2 + 1] * kp;
      push[o + 2] = Math.max(fl[o2], fl[o2 + 1]);
      push[o + 3] = ts > push[o + 3] ? ts : push[o + 3] * ks;
      tg[o] = tg[o + 1] = tg[o + 2] = tg[o + 3] = 0;
      const e = Math.abs(push[o]) + Math.abs(push[o + 1]) + Math.abs(pv[o2]) * 0.1 + Math.abs(pv[o2 + 1]) * 0.1 + push[o + 2] + push[o + 3];
      if (e < 0.004 && !touched && tf === 0) { act[n] = 0; push[o] = push[o + 1] = push[o + 2] = push[o + 3] = 0; pv[o2] = pv[o2 + 1] = 0; fl[o2] = fl[o2 + 1] = 0; st[o2] = st[o2 + 1] = 0; }
      else active++;
    }
    this.active = active;
    this.pushVersion++;
  }

  // Bilinear sample of a 4-component field. Returns into _q[0..3].
  _tex(arr, N, u, v) {
    // u, v in texel units (texel centres at +0.5), clamped to the edge like a texture
    let x = u - 0.5, y = v - 0.5;
    x = x < 0 ? 0 : x > N - 1 ? N - 1 : x; y = y < 0 ? 0 : y > N - 1 ? N - 1 : y;
    let i = Math.floor(x), j = Math.floor(y);
    if (i > N - 2) i = N - 2; if (j > N - 2) j = N - 2;
    const fu = x - i, fv = y - j, o = (j * N + i) * 4, o2 = o + N * 4;
    const w00 = (1 - fu) * (1 - fv), w10 = fu * (1 - fv), w01 = (1 - fu) * fv, w11 = fu * fv;
    for (let c = 0; c < 4; c++) _q[c] = arr[o + c] * w00 + arr[o + 4 + c] * w10 + arr[o2 + c] * w01 + arr[o2 + 4 + c] * w11;
    return _q;
  }

  // The bend of a plant rooted at grid position (x, z). The JS twin of pcPhysBend in FLORA_GLSL.
  //   stiff01: 0 grass .. 1 tree.   Fills o: e, n (bend direction x angle, radians, along the
  //   frame's east and north axes), angle, flatten01, shake01, load.
  plantBend(x, z, stiff01, o = {}) {
    const N = this.N, M = this.M;
    const b = this._tex(this.bend, N, (x - this.ci * this.cell) / this.cell + N / 2, (z - this.cj * this.cell) / this.cell + N / 2);
    let le = b[0] + (b[2] - b[0]) * stiff01, ln = b[1] + (b[3] - b[1]) * stiff01;
    const g = this._tex(this.wind, N, (x - this.ci * this.cell) / this.cell + N / 2, (z - this.cj * this.cell) / this.cell + N / 2)[2];
    // travelling waves modulate the load on soft plants
    let wsum = 0;
    for (let i = 0; i < 3; i++) {
      const a = WAVE_ROT[i], ki = FLORA.waveK * WAVE_K[i];
      const ex = this.waveDir[0] * Math.cos(a) - this.waveDir[1] * Math.sin(a), ez = this.waveDir[0] * Math.sin(a) + this.waveDir[1] * Math.cos(a);
      wsum += WAVE_A[i] * Math.sin(ki * (ex * x + ez * z) - this.wavePhase[i]);
    }
    const wave = 1 + FLORA.waveAmp * (1 - stiff01) * (0.35 + 0.65 * g) * wsum;
    le *= wave; ln *= wave;
    // near-field push (only inside the push grid; soft plants take it fully, trunks hardly)
    const pu = (x - this.mi * this.nearCell) / this.nearCell + M / 2, pvv = (z - this.mj * this.nearCell) / this.nearCell + M / 2;
    let flat = 0, shake = 0;
    if (pu > 0 && pvv > 0 && pu < M && pvv < M) {
      const p = this._tex(this.push, M, pu, pvv);
      const give = 1 - 0.85 * stiff01;
      le += p[0] * give; ln += p[1] * give; flat = p[2] * (1 - stiff01); shake = p[3];
    }
    const load = Math.hypot(le, ln);
    const flex = FLORA.softFlex + (FLORA.stiffFlex - FLORA.softFlex) * stiff01;
    const amax = FLORA.softMax + (FLORA.stiffMax - FLORA.softMax) * stiff01;
    let ang = amax * (1 - Math.exp(-flex * load));
    ang = ang + (FLORA.flatAngle - ang) * flat;
    const k = load > 1e-6 ? ang / load : 0;
    o.e = le * k; o.n = ln * k; o.angle = ang; o.flatten01 = flat; o.shake01 = shake; o.load = load;
    return o;
  }

  // The cheap twin (pcPhysBendLite): wind response only. Fills o: e, n, angle, load.
  plantBendLite(x, z, stiff01, o = {}) {
    const N = this.N;
    const b = this._tex(this.bend, N, (x - this.ci * this.cell) / this.cell + N / 2, (z - this.cj * this.cell) / this.cell + N / 2);
    const le = b[0] + (b[2] - b[0]) * stiff01, ln = b[1] + (b[3] - b[1]) * stiff01;
    const load = Math.hypot(le, ln);
    const flex = FLORA.softFlex + (FLORA.stiffFlex - FLORA.softFlex) * stiff01;
    const amax = FLORA.softMax + (FLORA.stiffMax - FLORA.softMax) * stiff01;
    const ang = amax * (1 - Math.exp(-flex * load));
    const k = load > 1e-6 ? ang / load : 0;
    o.e = le * k; o.n = ln * k; o.angle = ang; o.load = load;
    return o;
  }
}
const _q = new Float64Array(4);
// the three wave trains: relative wavenumber, direction offset (rad), relative speed, amplitude
export const WAVE_K = [1, 1.31, 0.74];
export const WAVE_ROT = [0, 0.38, -0.31];
export const WAVE_C = [1, 0.92, 1.12];
export const WAVE_A = [0.5, 0.3, 0.2];

// How far a point of a crown is moved by its branch (m; add it to the point before plantDisplace).
// The JS twin of pcPhysBranch in FLORA_GLSL.
//   (re, rn): the point's horizontal offset from the trunk (m east, north); h: its height above
//   the root; H: the plant's height; (gx, gz): the root in grid coordinates; (be, bn): the bend
//   from plantBend (rad); shake01 from plantBend; U: the field's uniforms. Fills o: e, n, up.
// A branch is a cantilever on the trunk: nothing moves at the trunk, the tip most (x^2 (3 - x) / 2
// along it). Its swing follows the trunk's lean (the wind on this tree, shelter and all) times
// how gusty the air is, plus whatever shook the crown; its phase turns round the trunk in whole
// lobes, so neighbouring parts of a crown move together and opposite sides do not.
export function plantBranch(re, rn, h, H, gx, gz, be, bn, shake01, U, o = {}) {
  const r = Math.hypot(re, rn), Hs = Math.max(H, 1e-3), L = U.uPhysBranch[3] * Hs;
  o.e = 0; o.n = 0; o.up = 0;
  if (r < 1e-4) return o;
  const x = Math.min(1, r / L), shape = x * x * (3 - x) * 0.5;
  const ang = Math.hypot(be, bn);
  const A = U.uPhysBranch[1] * ang * (FLORA.branchCalm + (1 - FLORA.branchCalm) * U.uPhysBranch[0]) + U.uPhysBranch[2] * shake01;
  if (A < 1e-6) return o;
  const s = clamp01(h / Hs), az = Math.atan2(rn, re), P = U.uPhysBranchPhase;
  const tp = TAU * fract01(Math.floor(gx * 2) * 0.3183 + Math.floor(gz * 2) * 0.7071);       // this tree's own number
  const a0 = Math.sin(P[0] + BRANCH_M[0] * az + BRANCH_T[0] * tp + BRANCH_S[0] * s);
  const a1 = Math.sin(P[1] + BRANCH_M[1] * az + BRANCH_T[1] * tp + BRANCH_S[1] * s);
  const a2 = Math.sin(P[2] + BRANCH_M[2] * az + BRANCH_T[2] * tp + BRANCH_S[2] * s);
  const a3 = Math.sin(P[3] + BRANCH_M[3] * az + BRANCH_T[3] * tp + BRANCH_S[3] * s);
  const k = A * L * shape;
  // it bobs (up), swings along the load (or along itself in still air), and flutters across itself
  const de = ang > 1e-6 ? be / ang : re / r, dn = ang > 1e-6 ? bn / ang : rn / r;
  const al = 0.7 * a1 * k, tg = 0.3 * a3 * k;
  o.e = de * al - rn / r * tg; o.n = dn * al + re / r * tg; o.up = (0.6 * a0 + 0.4 * a2) * k;
  return o;
}
const fract01 = (v) => v - Math.floor(v);

// Where a point of a plant ends up when the plant bends: the cantilever curls over, keeping its
// length. `h` is the point's height above the root (m), `H` the plant's height, (be, bn) the
// bend from plantBend (radians along east / north). Fills o: e, n (horizontal shift, m) and
// up (new height, m). The JS twin of pcPhysDisplace in FLORA_GLSL.
export function plantDisplace(h, H, be, bn, o = {}) {
  const ang = Math.hypot(be, bn);
  const s = clamp01(h / Math.max(H, 1e-3));
  // the slope of a tip-loaded cantilever grows as (2 s - s^2); integrate it along the stem
  const a = ang * s * (2 - s);                     // local lean at this height
  // average lean below this point is about ang * (s - s^2 / 3): chord of the curve
  const am = ang * (s - s * s / 3);
  const hor = h * Math.sin(am), ver = h * Math.cos(am);
  const k = ang > 1e-6 ? hor / ang : 0;
  o.e = be * k; o.n = bn * k; o.up = ver; o.lean = a;
  return o;
}

// Natural sway frequency (Hz) of a tree of height H (m) and trunk diameter dbh (m)
// (Moore and Maguire 2004, conifers; a fair first guess for broadleaves in leaf).
export function treeFrequency(H, dbh) {
  return 0.0948 + 3.4317 * (dbh * 100) / (H * H);
}
// Natural frequency (Hz) of a grass or reed stem of height H (m): f ~ 1 / H^1.5 from a tapering
// cantilever (0.3 m lawn grass about 4 Hz, 1 m meadow grass 1.6 Hz, 2 m reeds 0.9 Hz).
export function stemFrequency(H) {
  return 1.6 / Math.pow(Math.max(H, 0.05), 0.75);
}

// One plant with its own frequency and damping, driven by the air at its own position: for the
// few hero plants nearest the camera, and the reference the field model is checked against.
export class PlantSim {
  constructor({ height = 0.5, stiff01 = 0, hz, damping } = {}) {
    this.height = height; this.stiff01 = stiff01;
    this.hz = hz || (stiff01 > 0.5 ? treeFrequency(height, height * 0.018) : stemFrequency(height));
    this.damping = damping != null ? damping : FLORA.softDamp + (FLORA.stiffDamp - FLORA.softDamp) * stiff01;
    this.s = new Float64Array(4);              // load east, rate, load north, rate
    this.e = 0; this.n = 0; this.angle = 0;
  }
  // we, wn: wind at the plant's own height (m/s, any two horizontal axes).  rho: air density.
  // pushE, pushN: extra load from the push field (optional).
  step(dt, we, wn, rho, pushE = 0, pushN = 0) {
    const sp = Math.hypot(we, wn), l = 0.5 * rho * sp / FLORA.qRef;
    const w = TAU * this.hz;
    // the air damps a plant more in dense air: aerodynamic damping ~ rho U / (m w)
    const z = Math.min(1.5, this.damping * (0.6 + 0.4 * Math.sqrt(rho / 1.225)));
    oscStep(this.s, 0, we * l + pushE, w, z, dt);
    oscStep(this.s, 2, wn * l + pushN, w, z, dt);
    const load = Math.hypot(this.s[0], this.s[2]);
    const flex = FLORA.softFlex + (FLORA.stiffFlex - FLORA.softFlex) * this.stiff01;
    const amax = FLORA.softMax + (FLORA.stiffMax - FLORA.softMax) * this.stiff01;
    this.angle = amax * (1 - Math.exp(-flex * load));
    const k = load > 1e-6 ? this.angle / load : 0;
    this.e = this.s[0] * k; this.n = this.s[2] * k;
    return this;
  }
}
export { clamp };
