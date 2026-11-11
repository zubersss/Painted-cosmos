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
  // (P8) aerodynamic damping: a crown moving through moving air is braked by its own drag, in
  // proportion to the wind (damping ratio rho Cd A U / (2 m omega): 0.1 to 0.3 for a tree in
  // leaf in 10 m/s; Moore and Maguire 2004, Sellier and Fourcaud 2009), so a tree that sways
  // freely in a breeze follows the gusts of a gale without whipping back upwind. Per m/s of
  // reference wind at Earth's air density; the ratio never exceeds aeroDampMax.
  aeroDamp: 0.025, aeroDampMax: 0.85,
  // shape of the response (shared with the shader through uniforms)
  softFlex: 3.0, softMax: 1.2,        // bend angle = max * (1 - exp(-flex * load)), radians
  // (P11) trunks. Until P11 a trunk leaned 0.25 (1 - exp(-1.2 load)) rad: 10 degrees in 8 m/s, 12.8 in 11 m/s and
  // pinned at its limit (14.3) through any storm: in the first filmstrip of the birches in the thunderstorm
  // nothing moved in 1.2 s but the branch tips. Measured trees are far stiffer: the top of a 12 to 20 m tree
  // moves 0.3 to 0.5 m in a fresh breeze and about a metre in a gale (Mayer 1987; Peltola 1996; Gardiner 1995;
  // James, Haritos and Ades 2006), a lean of the chord of 1.5 to 2.5 degrees at 8 m/s, growing as the load to
  // the power 0.7 (the crown streamlines) until the stem fails near 15 to 20 degrees. Now 3 degrees at the tip
  // in 8 m/s (chord 2: 0.42 m at the top of a 12 m birch), 5.2 in 11 m/s, 12 in 20 m/s, limit 17.
  stiffFlex: 0.19, stiffMax: 0.30,
  flatAngle: 1.45,              // rad: a flattened plant lies this far over
  // travelling waves in soft plants (honami): wavelengths about 14, 11 and 19 m, moving a bit
  // faster than the wind at blade height
  waveK: 0.45,                  // rad/m of the first train
  waveSpeed: 1.4,               // x wind speed at blade height
  waveAmp: 0.45,                // modulation depth of the soft load at full gust
  // (P11) FLUTTER: the eddies smaller than the wind grid can carry. Until P11 three blades a metre apart
  // leaned within half a degree of each other at every instant and a meadow moved as one sheet (in the
  // fair-weather breeze by a hundredth of a degree in a second: the filmstrip was twelve identical frames).
  // At blade height the air is the most turbulent there is (sigma / U about 0.4), and a third of that
  // variance lies in eddies 0.5 to 5 m long (Kaimal's spectrum at z = 0.5 m), which arrive at a blade at
  // U / length: a hertz or two, its own frequency. Three frozen eddy trains of those lengths, fixed in the
  // ground frame at 60 degrees to each other and carried by the wind at blade height (Taylor), load each
  // soft plant along the wind and across it; a blade answers each as the oscillator it is (softHz,
  // flutterDamp: full below its frequency, 1.2 x at it, little above). No uniform is added: the three
  // phases ride in uPhysWave.z, uPhysWave.w and uPhysWavePhase.w (the wavenumber and depth of the honami
  // waves they used to hold never changed and are now constants of the chunk).
  flutterK: Object.freeze([6.98, 3.70, 1.96]),      // rad/m: eddies 0.9, 1.7 and 3.2 m long
  flutterAng: Object.freeze([0.35, 1.40, 2.44]),    // rad: their directions in the field frame (60 degrees apart)
  flutterA: Object.freeze([0.64, 0.79, 0.98]),      // amplitudes: variance as length^(2/3), unit rms together
  flutterGain: 2.4,             // rms load swing / mean load = this x the turbulence intensity of the cell
                                // (2 x 0.53 sigma_u at blade height, where U is 0.43 of the 10 m wind)
  flutterMax: 0.6,              // ... and never more than this (the storm's own gustiness is larger eddies)
  flutterBlade: 0.62,           // wind at blade height over the wind at 2 m (open grass)
  flutterDamp: 0.45,            // damping ratio of a blade in moving air
  flutterCross: 0.6,            // across the wind as a share of along it
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
  // Langre and Moulia 2008), each with its own phase, and being out of step with the trunk they
  // take energy out of its sway (the crown is the tree's damper).
  // (P14) A BRANCH CARRIES ITS OWN WIND. Until P14 a branch swung by branchGain x the TRUNK's lean; P11 made
  // trunks as stiff as measured trees (right) and the branches went quiet with them (wrong: 7 cm at the tip
  // in the thunderstorm, the birches read as still). A branch in leaf is loaded by the wind on its own
  // foliage:
  //   the set: the tip streams downwind by branchSet x (q / qRef)^branchSetExp of the branch's length. The
  //     drag of a leafy branch grows as U^1.3, not U^2 (leaves and twigs fold into the wind: Vogel 1989,
  //     exponent -0.7), so as load^0.65. By a 3.5 m birch branch (5 cm at the base tapering to a twig, about
  //     50 N/m at the tip; 0.16 m^2 of drag area left at 20 m/s, 38 N of which some 60 % acts at the tip):
  //     0.38 m in a 20 m/s gale, 0.16 m in 10 m/s, 0.06 m in 5 m/s, never more than branchSetMax of its length.
  //   the thrash: the gusts smaller than the wind grid load it as they pass. Three frozen eddy trains 6, 11 and
  //     19 m long (the lengths that pass a crown at about a hertz in a strong wind), fixed in the ground and
  //     carried by the wind at crown height (Taylor), each felt by a branch as the oscillator it is (its own
  //     frequency, branchHz +- branchSpread / 2 by the branch's own number; damped by its wood and, more, by
  //     its leaves in the moving air): full below its frequency, amplified at it, little above, and late by
  //     its own lag. The swing of the load is branchThrash x the turbulence intensity (d ln F / d ln U = 1.3).
  //     So the rms swing about the set is 0.4 to 0.5 of the set in a storm and its peaks about the set itself:
  //     a tip in 20 m/s streams 0.4 m downwind and thrashes between 0 and 0.8 m; in a 3 m/s breeze it moves
  //     2 to 3 cm. Branches differ in frequency, lag and place in the eddies, so a crown changes shape.
  //   the foliage: twigs in leaf tremble at twigHz and above on top (twigMax in a gale, a centimetre in a breeze).
  branchHz: 1.3,                // Hz: a first-order branch in leaf (a 3.5 m birch branch; 0.85 to 1.75 by branchSpread)
  branchSpread: 0.7,            // the branches of one crown differ in frequency by this much (share of branchHz, end to end)
  branchSet: 0.0334,            // tip set / branch length at load 1 (8 m/s at the crown in Earth air)
  branchSetExp: 0.65,           // the set grows as load to this power (drag as U^1.3)
  branchSetMax: 0.30,           // of its length: a branch streams no further (a chord of 17 degrees)
  branchThrash: 1.3,            // swing of the load / mean load = this x the turbulence intensity
  branchDamp: 0.08,             // damping ratio of a branch in still air (wood and leaves)
  branchAero: 0.012,            // ... plus this per m/s of wind at the crown (leaf drag), up to branchDampMax
  branchDampMax: 0.6,
  crownK: Object.freeze([1.047, 0.571, 0.331]),     // rad/m: eddies 6, 11 and 19 m long
  crownAng: Object.freeze([1.92, 0.87, 2.97]),      // rad: their directions in the field frame (60 degrees apart)
  crownA: Object.freeze([0.656, 0.802, 0.962]),     // amplitudes: variance as length^(2/3), unit rms together
  crownTilt: 0.25,              // rad per metre of height: the eddies lean with the shear, a crown's top leads its skirt
  crownImax: 0.6,               // the turbulence intensity counted at the crown, at most
  crownI: 3,                    // (twelfth agent) turbulence intensity at the crown / in the open air at 2 m: the roughness sublayer and
                                // the crown's own wake (sigma_u / U 0.4 to 0.6 at canopy top: Raupach, Finnigan and Brunet 1996)
  crownBand: 0.33,              // the share of sigma_u in eddies 5 to 25 m long (von Karman, Lu 25 m): what the three trains carry.
                                // (The eleventh agent put all of sigma_u in them at the open air's I: 1.3 x I, the same number
                                // uncapped; and gave them a resonant peak, which is now the clock lines' alone.)
  twigHz: 3.6,                  // Hz: the first of the two rates foliage trembles at (the other 23/16 of it)
  twigMax: 0.07,                // m: swing of twigs in leaf in a gale
  twigGain: 1.2,                // ... reached as 1 - exp(-twigGain x load)
  // (P14, twelfth agent) THE BRANCH RINGS AT ITS OWN FREQUENCY. The three eddy trains are lines in the spectrum
  // whose frequencies are set by the wind (k U / 2 pi): in a breeze they pass a crown at 0.1 to 0.5 Hz and a
  // branch only follows them, slower than the trunk; measured at the Earth spawn the tips moved at 0.2 to 0.8 Hz
  // in every wind, and three branches of one crown correlated 0.7 to 0.9 in the gust front. Real turbulence is
  // a continuous spectrum: there is always forcing at the branch's own frequency, and a lightly damped
  // cantilever answers it most (the resonant part of the buffeting response; Davenport). Its variance about the
  // set: sigma^2 / set^2 = integral |H(f)|^2 x 1.69 I^2 x phi(f Lu / Uc) dln f, phi(n) = 4 n / (1 + 70.8 n^2)^(5/6)
  // (von Karman, the share of the along-wind variance per unit ln f), H the branch's own oscillator. It is built
  // here as the spectral representation (Shinozuka): four clock lines at clockR x branchHz, each weighted by
  // |H| and the turbulence at it, with phases of the branch's own (from id) and of the place (clockK: a crown's
  // two sides and two trees a few metres apart are out of step). A branch at 0.94 Hz rings at 0.9 to 1.1 Hz,
  // one at 1.69 Hz at 1.4 to 2; their swings at those frequencies do not correlate. In a gale (I 0.17 in the
  // open, more in a wood) it adds about 0.1 of the set at the branch's own period; across the wind and up
  // it is driven by the cross and vertical turbulence (sigma_v / sigma_u 0.75, sigma_w 0.5) through the drag.
  crownLu: 25,                  // m: integral length of the along-wind turbulence at crown height (1 to 2 x the canopy's height)
  clockR: Object.freeze([0.55, 0.78, 1.1, 1.55]),   // the clock lines (x branchHz: 0.72, 1.01, 1.43, 2.02 Hz), 0.34 apart in ln f
  clockK: Object.freeze([[0.29, 0.17], [-0.12, 0.31], [-0.26, -0.21], [0.33, -0.08]]),  // rad/m: their phase over the ground
  branchRes: 1,                 // a lever on the resonant part (1 = the model)
  branchResX: 0.6,              // its swing across the wind, of the along-wind swing
  branchResUp: 0.45,            // and up and down
  branchGain: 1,                // a lever on all of it (1 = the model; 1.3 rad per rad of trunk lean before P14)
  branchShake: 0.08,            // rad: swing of a crown that has just been brushed or blown on (shake01 = 1)
  crown: 0.27,                  // a branch is this long, as a share of the plant's height (3.5 m on a 13 m birch; 0.35 before P14)
});
// Without a number per branch (pcPhysBranch, plantBranch) the crown moves in whole lobes round the trunk
// (whole numbers: the motion is continuous all the way round), each eddy train with its own count and its own
// run of phase with height. (Trees differ by where they stand in the eddies; the number per tree of P6, taken
// from the grid cell, jumped when the frame re-anchored and is gone: BRANCH_T is no longer used.)
export const BRANCH_F = [1, 1.37, 0.71, 1.93];   // (the four clock oscillators of P6 to P13: no longer used by the model)
export const BRANCH_M = [2, 3, 1, 4];
export const BRANCH_S = [2.6, -1.9, 4.1, 0];
export const BRANCH_T = [1, 1.7, 2.3, 0.6];
// (P14) the crown's eddy trains: unit directions; the phase of the vertical and of the cross-wind part of a
// branch's swing against its along-wind part; how far a branch's own number puts it out of step (turns: the
// long eddies take a crown as one, the short ones branch by branch)
export const CROWN_D = FLORA.crownAng.map((a) => [Math.cos(a), Math.sin(a)]);
export const CROWN_UP = [1.9, 4.4, 0.8];
export const CROWN_X = [3.6, 1.1, 5.2];
export const CROWN_ID = [1, 0.5, 0.25];
// (P14, twelfth agent) the clock lines: frequency (Hz), the weight of one line (sqrt(2 x 1.69 x dln f)), and
// the multipliers that give a branch's three phases per line from its number
export const CLOCK_F = FLORA.clockR.map((r) => r * FLORA.branchHz);
export const CLOCK_W = Math.sqrt(2 * 1.69 * Math.log(FLORA.clockR[1] / FLORA.clockR[0]));
export const CLOCK_ID = [[13.1, 17.3, 23.9, 29.3], [31.7, 37.1, 41.3, 43.7], [47.9, 53.3, 59.1, 61.7]];
export const CLOCK_M = [1, 2, 3, 2];          // without a number per branch: whole lobes round the trunk

const _s = new Float64Array(9);
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
    this.flutPhase = new Float64Array(3);        // (P11) phases of the three flutter trains
    this.waveDir = new Float64Array(2); this.waveDir[0] = 1;
    this.gustMean = 0;
    // uniforms for FLORA_GLSL, refreshed every update (plain arrays; PAINTER copies them)
    this.uniforms = {
      uPhysAnchor: [0, 0, 0], uPhysEast: [1, 0, 0], uPhysNorth: [0, 0, -1], uPhysUp: [0, 1, 0],
      uPhysWindMap: [0, 0, 1 / (N * FLORA.cell), N],
      uPhysNearMap: [0, 0, 1 / (M * FLORA.nearCell), M],
      uPhysWave: [1, 0, 0, 0],                    // xy: wave direction; z, w: flutter phases 0 and 1 (P11)
      uPhysWavePhase: [0, 0, 0, 0],
      uPhysShape: [FLORA.softFlex, FLORA.softMax, FLORA.stiffFlex, FLORA.stiffMax],
      // branches (P14): xyz: phases of the crown's three eddy trains (rad, wrapped), w: the twig clock (rad,
      // wrapped at 16 turns), and x: wind speed at load 1 (m/s: sqrt(2 qRef / rho)), y: gain, z: shake swing
      // (rad), w: branch length / height.  (P6 to P13: four clock oscillators, and x was the gustiness.)
      uPhysBranchPhase: [0, 0, 0, 0],
      uPhysBranch: [Math.sqrt(2 * FLORA.qRef / 1.225), FLORA.branchGain, FLORA.branchShake, FLORA.crown],
      // (P14, twelfth agent) phases of the four clock lines a branch rings on (rad, wrapped; see FLORA.clockR)
      uPhysBranchClock: [0, 0, 0, 0],
    };
    this.clockPhase = new Float64Array(4);
    this.branchPhase = new Float64Array(4);      // [0..2] the crown's eddy trains (unwrapped), [3] the twig clock
    this.crownWind = new Float64Array(2);        // mean wind at crown height over the field (m/s east, north)
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
    for (let i = 0; i < 3; i++) this.flutPhase[i] -= FLORA.flutterK[i] * (FLUT_D[i][0] * dx + FLUT_D[i][1] * dz);
    for (let i = 0; i < 3; i++) this.branchPhase[i] -= FLORA.crownK[i] * (CROWN_D[i][0] * dx + CROWN_D[i][1] * dz);
    for (let i = 0; i < 4; i++) this.clockPhase[i] -= FLORA.clockK[i][0] * dx + FLORA.clockK[i][1] * dz;
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
    const aero = FLORA.aeroDamp * Math.hypot(air.cwe || 0, air.cwn || 0) * rho / 1.225;
    oscCoef(TAU * FLORA.softHz, Math.min(FLORA.aeroDampMax, FLORA.softDamp + aero), h, _coef, 0);
    oscCoef(TAU * FLORA.stiffHz, Math.min(FLORA.aeroDampMax, FLORA.stiffDamp + aero), h, _coef, 4);
    const a11 = _coef[0], a12 = _coef[1], a21 = _coef[2], a22 = _coef[3];
    const b11 = _coef[4], b12 = _coef[5], b21 = _coef[6], b22 = _coef[7];
    const kq = 0.5 * rho / FLORA.qRef;
    const bend = this.bend, vel = this._vel, wind = this.wind;
    let gsum = 0, se = 0, sn = 0, tsum = 0, sce = 0, scn = 0;
    const swirl = !!devils && devils.count > 0;
    for (let j = 0; j < N; j++) {
      const z = (this.cj + j - N / 2 + 0.5) * cell;
      for (let i = 0; i < N; i++) {
        const x = (this.ci + i - N / 2 + 0.5) * cell;
        air.sampleWind(x, z, _s);
        const n = j * N + i, o = n * 4;
        // (P11) with the fine eddies (10 to 30 m) the wind grid keeps apart: a plant stands in one place
        let we = _s[0] * _s[8], wn = _s[1] * _s[8];
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
        gsum += wind[o + 2]; se += we * hs; sn += wn * hs; tsum += wind[o + 3]; sce += we * ht; scn += wn * ht;
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
    // (P11) the flutter trains are carried by the wind at blade height (se, sn: its mean over the field)
    for (let i = 0; i < 3; i++) this.flutPhase[i] = (this.flutPhase[i] + FLORA.flutterK[i] * (FLUT_D[i][0] * se + FLUT_D[i][1] * sn) * h) % (TAU * 1024);
    this.gustMean = gsum * inv;
    // (P14) branches: the crown's eddy trains are carried by the mean wind at crown height; the twig clock runs
    sce *= inv; scn *= inv; this.crownWind[0] = sce; this.crownWind[1] = scn;
    for (let i = 0; i < 3; i++) this.branchPhase[i] = (this.branchPhase[i] + FLORA.crownK[i] * (CROWN_D[i][0] * sce + CROWN_D[i][1] * scn) * h) % (TAU * 1024);
    this.branchPhase[3] = (this.branchPhase[3] + TAU * FLORA.twigHz * h) % (TAU * 16);
    for (let i = 0; i < 4; i++) this.clockPhase[i] = (this.clockPhase[i] + TAU * CLOCK_F[i] * h) % TAU;
    // how gusty the air is (turbulence over mean wind), eased over 2 s (physics.here; no longer a uniform)
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
    U.uPhysWave[2] = this.flutPhase[0] % TAU; U.uPhysWave[3] = this.flutPhase[1] % TAU; U.uPhysWavePhase[3] = this.flutPhase[2] % TAU;
    for (let i = 0; i < 3; i++) { const p = this.branchPhase[i] % TAU; U.uPhysBranchPhase[i] = p < 0 ? p + TAU : p; }
    U.uPhysBranchPhase[3] = this.branchPhase[3];
    U.uPhysBranch[0] = Math.sqrt(2 * FLORA.qRef / Math.max(rho, 1e-6));
    for (let i = 0; i < 4; i++) { const p = this.clockPhase[i] % TAU; U.uPhysBranchClock[i] = p < 0 ? p + TAU : p; }
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
    const wt = this._tex(this.wind, N, (x - this.ci * this.cell) / this.cell + N / 2, (z - this.cj * this.cell) / this.cell + N / 2);
    const g = wt[2], w2e = wt[0], w2n = wt[1], turb = wt[3];
    // travelling waves modulate the load on soft plants
    let wsum = 0;
    for (let i = 0; i < 3; i++) {
      const a = WAVE_ROT[i], ki = FLORA.waveK * WAVE_K[i];
      const ex = this.waveDir[0] * Math.cos(a) - this.waveDir[1] * Math.sin(a), ez = this.waveDir[0] * Math.sin(a) + this.waveDir[1] * Math.cos(a);
      wsum += WAVE_A[i] * Math.sin(ki * (ex * x + ez * z) - this.wavePhase[i]);
    }
    const wave = 1 + FLORA.waveAmp * (1 - stiff01) * (0.35 + 0.65 * g) * wsum;
    le *= wave; ln *= wave;
    // (P11) flutter: the small eddies, along the load and across it
    if (stiff01 < 1) {
      const U = this.uniforms; _fl3[0] = U.uPhysWave[2]; _fl3[1] = U.uPhysWave[3]; _fl3[2] = U.uPhysWavePhase[3];
      flutterAt(x, z, w2e, w2n, turb, _fl3, _fl2);
      const fa = _fl2[0] * (1 - stiff01), fc = _fl2[1] * (1 - stiff01), e0 = le, n0 = ln;
      const fl = 1 + fa > 0.15 ? 1 + fa : 0.15;        // (a lull between eddies, never a wind from behind)
      le = e0 * fl - n0 * fc; ln = n0 * fl + e0 * fc;
    }
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

  // (P14) What a crown feels at grid position (x, z): o[0], o[1] the wind load (q / qRef, east / north) at the
  // height of a plant H metres tall (the stiff class's at 10 m and above, the soft class's at blade height,
  // between by height), o[2], o[3] the wind at 2 m (m/s), o[4] its turbulence (m/s). For plantCrown.
  crownAt(x, z, H, o = new Float64Array(5)) {
    const N = this.N, u = (x - this.ci * this.cell) / this.cell + N / 2, v = (z - this.cj * this.cell) / this.cell + N / 2;
    const b = this._tex(this.bend, N, u, v), k = clamp01((H - 0.5) / 9.5);
    o[0] = b[0] + (b[2] - b[0]) * k; o[1] = b[1] + (b[3] - b[1]) * k;
    const wt = this._tex(this.wind, N, u, v);
    o[2] = wt[0]; o[3] = wt[1]; o[4] = wt[3];
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
// (P11) the flutter: unit directions of the three eddy trains, and the JS twin of pcPhysFlutter in FLORA_GLSL.
export const FLUT_D = FLORA.flutterAng.map((a) => [Math.cos(a), Math.sin(a)]);
export const FLUT_PH = [1.7, 4.1, 2.9];      // the cross-wind part runs this far (rad) out of step with the along-wind part
// (x, z): grid position; (w2e, w2n): wind at 2 m there (m/s); turb: sigma there (m/s); P: the three phases.
// Fills o[0] = swing along the load, o[1] = across it (both as shares of the load; multiply by 1 - stiff01).
export function flutterAt(x, z, w2e, w2n, turb, P, o) {
  const sp = Math.hypot(w2e, w2n), m = Math.min(FLORA.flutterMax, FLORA.flutterGain * turb / (sp + 0.25));
  const ue = w2e * FLORA.flutterBlade, un = w2n * FLORA.flutterBlade, wn = TAU * FLORA.softHz, z4 = 4 * FLORA.flutterDamp * FLORA.flutterDamp;
  let a = 0, c = 0;
  for (let i = 0; i < 3; i++) {
    const k = FLORA.flutterK[i], d = FLUT_D[i];
    const r = k * (d[0] * ue + d[1] * un) / wn, r2 = r * r;
    const H = FLORA.flutterA[i] / Math.sqrt((1 - r2) * (1 - r2) + z4 * r2);
    const ph = k * (d[0] * x + d[1] * z) - P[i];
    a += H * Math.sin(ph); c += H * Math.sin(ph + FLUT_PH[i]);
  }
  o[0] = m * a; o[1] = m * FLORA.flutterCross * c;
  return o;
}
const _fl2 = new Float64Array(2), _fl3 = new Float64Array(3);

// (P14) How far a point of a crown is moved by its branch and its twigs (m; add it to the point before
// plantDisplace). The JS twin of pcPhysCrown in FLORA_GLSL.
//   (re, rn): the point's horizontal offset from the trunk's axis (m east, north); h: its height above the
//   root; H: the plant's height; (gx, gz): the root in grid coordinates; cw: what FloraField.crownAt(gx, gz,
//   H) filled (the wind load at the plant's height, the wind at 2 m and its turbulence, at the root);
//   shake01 from plantBend; U: the field's uniforms; id: one number in 0..1 for all points of one branch or
//   one mass of foliage (negative: none; the crown then moves in whole lobes round the trunk); leaf01: 1 on
//   foliage, 0 on wood.  Fills o: e, n, up (m), and for probes set (m: how far this point streams downwind),
//   load (q / qRef), I (turbulence intensity), hz (the branch's own frequency), gain (its largest amplification).
// A branch is a cantilever on the trunk: nothing moves at the axis, the tip most (x^2 (3 - x) / 2 along it,
// x = distance from the axis / branch length). See FLORA (branches) for the model.
export function plantCrown(re, rn, h, H, gx, gz, cw, shake01, U, id, leaf01, o = {}) {
  const r = Math.hypot(re, rn), Hs = Math.max(H, 1e-3), B = U.uPhysBranch, P = U.uPhysBranchPhase, L = B[3] * Hs;
  const x = Math.min(1, r / L), shape = x * x * (3 - x) * 0.5;
  const load = Math.hypot(cw[0], cw[1]);
  const de = load > 1e-6 ? cw[0] / load : r > 1e-4 ? re / r : 1, dn = load > 1e-6 ? cw[1] / load : r > 1e-4 ? rn / r : 0;
  const Uc = B[0] * Math.sqrt(load);
  const fb = FLORA.branchHz * (1 + FLORA.branchSpread * ((id >= 0 ? fract01(id * 5.37 + 0.31) : 0.5) - 0.5));
  const z2 = 2 * Math.min(FLORA.branchDampMax, FLORA.branchDamp + FLORA.branchAero * Uc);
  const s = clamp01(h / Hs), px = gx + re, pz = gz + rn;
  let az = 0, qs;
  if (id >= 0) qs = TAU * fract01(id * 9.7);
  else { az = r > 1e-4 ? Math.atan2(rn, re) : 0; qs = 2 * az; }
  let da = 0, du = 0, dc = 0, gmax = 0;
  for (let i = 0; i < 3; i++) {
    const k = FLORA.crownK[i], d = CROWN_D[i], cd = d[0] * de + d[1] * dn;
    const rr = k * Math.abs(cd) * Uc / (TAU * fb), r2 = rr * rr;
    const g = FLORA.crownA[i] / Math.sqrt(1 + r2 * r2);      // (twelfth agent) the background: followed below fb, shed above; the peak is the clock lines'
    let ph = k * (d[0] * px + d[1] * pz) + FLORA.crownTilt * h - P[i] + Math.atan2(z2 * rr, 1 - r2) * Math.sign(cd);
    ph += id >= 0 ? TAU * CROWN_ID[i] * fract01(id * (7 + 4 * i) + 0.17 * i) : BRANCH_M[i] * az + BRANCH_S[i] * s;
    da += g * Math.sin(ph); du += g * Math.sin(ph + CROWN_UP[i]); dc += g * Math.sin(ph + CROWN_X[i]);
    gmax += g;
  }
  const Io = cw[4] / (Math.hypot(cw[2], cw[3]) + 0.25), I = Math.min(FLORA.crownImax, FLORA.crownI * Io);
  const set = FLORA.branchSetMax * (1 - Math.exp(-FLORA.branchSet * Math.pow(load, FLORA.branchSetExp) / FLORA.branchSetMax));
  const A = FLORA.branchThrash * FLORA.crownBand * I * set, sk = B[2] * shake01;
  qs += P[3] * 0.375;
  const k0 = B[1] * L * shape;
  // it streams downwind and swings about that set, bobs, and sways across the wind; a shaken crown shivers
  // (P14, twelfth agent) the resonant part: the branch rings on the clock lines near its own frequency
  let ra = 0, ru = 0, rc = 0, rv = 0;
  const C = U.uPhysBranchClock;
  if (C && set > 0 && FLORA.branchRes > 0) {
    const Ul = Math.max(Uc, 0.5);
    for (let j = 0; j < 4; j++) {
      const rj = CLOCK_F[j] / fb, n = CLOCK_F[j] * FLORA.crownLu / Ul;
      const c = CLOCK_W * I * Math.sqrt(4 * n / Math.pow(1 + 70.8 * n * n, 5 / 6)) / Math.sqrt((1 - rj * rj) * (1 - rj * rj) + z2 * z2 * rj * rj);
      const base = FLORA.clockK[j][0] * px + FLORA.clockK[j][1] * pz - C[j];
      let oa, ou, oc;
      if (id >= 0) { oa = TAU * fract01(id * CLOCK_ID[0][j]); ou = TAU * fract01(id * CLOCK_ID[1][j]); oc = TAU * fract01(id * CLOCK_ID[2][j]); }
      else { oa = CLOCK_M[j] * az + 0.9 * j; ou = CLOCK_M[(j + 1) & 3] * az + 2.3 + j; oc = CLOCK_M[(j + 2) & 3] * az + 4.1 + 1.7 * j; }
      ra += c * Math.sin(base + oa); ru += c * Math.sin(base + ou); rc += c * Math.sin(base + oc); rv += 0.5 * c * c;
    }
  }
  const kr = FLORA.branchRes * set;
  let al = k0 * (set + A * da + sk * Math.sin(qs) + kr * ra);
  let vu = k0 * (0.6 * A * du + 0.7 * sk * Math.sin(qs + 1.9) + FLORA.branchResUp * kr * ru);
  let cr = k0 * (0.5 * A * dc + FLORA.branchResX * kr * rc);
  if (leaf01 > 0) {
    // twigs in leaf: two ripples through the foliage at twigHz and 23/16 of it
    const tw = leaf01 * B[1] * FLORA.twigMax * (1 - Math.exp(-FLORA.twigGain * load)) * (0.5 + Io), idp = id > 0 ? id : 0;
    const q1 = P[3] + 3.1 * re + 2.3 * rn + 2.7 * h + 40 * idp, q2 = P[3] * 1.4375 - 2.2 * re + 3.4 * rn - 1.9 * h + 71 * idp;
    al += tw * (0.6 * Math.sin(q1) + 0.4 * Math.sin(q2));
    vu += tw * 0.7 * (0.6 * Math.sin(q1 + 1.9) + 0.4 * Math.sin(q2 + 4.0));
    cr += tw * 0.5 * Math.sin(q2 + 2.6);
  }
  o.e = de * al - dn * cr; o.n = dn * al + de * cr; o.up = vu;
  o.set = k0 * set; o.load = load; o.I = I; o.hz = fb; o.gain = gmax; o.res = k0 * kr * Math.sqrt(rv);
  return o;
}
// The same without a number per branch (the JS twin of pcPhysBranch): whole lobes round the trunk, wood only.
// (Until P14 this took the trunk's bend (be, bn) and swung by it; the signature is kept: be, bn are no longer
// read, the branch's wind comes from cw = FloraField.crownAt(gx, gz, H).)
export function plantBranch(re, rn, h, H, gx, gz, be, bn, shake01, U, o = {}, cw = _cw0) {
  return plantCrown(re, rn, h, H, gx, gz, cw, shake01, U, -1, 0, o);
}
const _cw0 = new Float64Array(5);
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
