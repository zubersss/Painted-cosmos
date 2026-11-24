// Painted Cosmos: ONE MATERIAL THAT POSES AND PAINTS A HUNDRED ANIMALS IN ONE DRAW CALL. OWNER: PAINTER.
//
// Nothing here is loaded unless the creatures are switched on (src/data/mode.js MODE.beasts, ?beasts=1),
// exactly as no module of the powers is loaded without ?powers=1. With the flag off the live game does not
// see this file at all.
//
// WHY IT EXISTS AT ALL -- the three measured facts, each named where it came from:
//
//   1. THE DRAW CALL IS THE WHOLE COST. The owner's phone measured the far trees at 3 ms of a 9.6 ms script
//      in 28 meshes: 0.107 ms a draw (docs/HANDOVER.md, the v27 table). Forty animals drawn the explorer's
//      way -- one mesh and one uniform matrix palette apiece -- is 40 draws, 4.3 ms, nearly half the script,
//      before an animal does anything. So a herd must be ONE instanced draw.
//   2. THE GAME'S OWN RIG CANNOT BE INSTANCED. The explorer's pose is a UNIFORM matrix palette
//      (`uniform mat4 uPart[PC_PARTS]`, materials.js FIG_VERT): every instance drawn from one mesh would
//      share one pose. There is no skinning anywhere in src/ either (no SkinnedMesh, no skinIndex, no
//      AnimationMixer), and three's InstancedMesh and SkinnedMesh do not combine at all. So the pose must be
//      computed IN THE VERTEX SHADER from per-instance numbers, the way leaffall.js tumbles 80 leaves and
//      the plants' pcPhysBend bends a wood.
//   3. TRIANGLES ARE VERY NEARLY FREE on the owner's device (measured twice; cutting the far trees' triangles
//      by three quarters saved 0.1 ms). What is not free is draw calls and script. This material adds ZERO
//      script per creature per frame beyond the instance numbers the streamer writes anyway.
//
// WHAT IT DRAWS WITH -- the hand is the explorer's, not a new one. The fragment shader below is
// materials.js FIG_FRAG's oil branch with two changes and no third: the paint of a FLAT piece is worked out
// once a piece in the VERTEX shader (leaf cards already do this, materials.js PROP_VERT: it took the plants'
// paint from 23 ms of a 39 ms frame), and the wash chart is offset per instance so twenty deer are not
// twenty copies of one deer's streaks. Flat tone steps half a tone apart, thin streaks along the form, a lit
// rim where the form turns from the eye on the sun's side, no outline, no blur, no grain, no texture file.
//
// WHAT IT TAKES FROM PHYSICS -- the walk is not re-invented and not copied. gaitOf, bobAt (and the foot
// curve inside stepGait) in src/physics/explorer.js already turn speed, gravity and leg length into step
// length, cadence, duty and the hips' rise and fall, from the Froude number, so one law gives the right
// gait on every planet. Its CONSTANTS are imported and interpolated into the GLSL below, exactly as
// physics/flora.glsl.js interpolates the plants' own, so the shader and the physics cannot drift apart.
// Four legs are the explorer's two, twice, with their own phases.
//
// THE SWITCHES (the project's habit: read once from the address, folded into the shader as plain numbers,
// so each is free when it is off and the owner can be shown A and B of one still -- a reload apiece):
//   ?beastik=0    the legs go back to the plan's plain swing table. The planted foot then creeps: that is
//                 the point of the comparison.
//   ?beastbob=0   no weight: the body rides flat, no girdle bob, no pitch, no roll.
//   ?beastflat=0  a flat piece takes the full per-pixel stroke path instead of the paint worked out once a
//                 piece (what the cheap path costs, in a still).
// and one dial per species, `strideK`, which is not an address: how much of PHYSICS' step this animal
// takes. It is there because a two-bone leg that stands nearly straight cannot span its own stride --
// MEASURED on beastkit's rows, the deer's fore leg stands at 99.0 per cent of its two bones and a walk at
// 1.6 m/s asks 106 per cent, so the hoof hangs 4 cm up at each end of its stance. beastReach() below
// answers that for any plan in node, with no browser. The real mend is in the geometry, not here.
//
// WHAT IT IS HANDED, per instance, and nothing more (world/beasts.js _write already fills exactly this):
// the instance matrix (where it stands, which way it faces, its size), aInst (hue, value, seed, shade),
// aGait (stride phase in TURNS, ground speed, state, the wash clock) and aSpec (species, turn, head,
// alert). Two of those are not read here and it is worth saying why: the STATE CODE is an integer that
// can change between one frame and the next, so nothing that would be seen to snap is hung on it -- the
// gait comes from the SPEED (a Froude number), the head from aSpec.z, which the routines ease. And the
// SPECIES is for the far tier's uniform table, which is not built yet: at this stage one species is one
// mesh with its own washes baked in by the kit.
//
// WHAT THIS FILE DOES NOT DO, so nobody looks for it: no cast shadow (the shadow pass only knows materials
// with a uPart uniform, shadow.js:268, and the plain override material would draw the REST pose -- a
// standing shadow under a walking deer); no shadow-map lookup on the creature itself (the explorer has
// none either, and this keeps the same hand); no far MARK branch (that is the far tier's own step); no
// species table (at this stage one species is one mesh with its own washes baked in by the kit).
import * as THREE from 'three';
import { VERT_PARS, VERT_END, FRAG_PARS, PAINT } from './chunks.js';
import { register } from './shared.js';
import { makePaintUniforms } from './materials.js';
import { SUN_VIEW_SRC } from './chunks.js';
import { EXPLORER_BODY, gaitOf, bobAt } from '../physics/explorer.js';

// a number as GLSL must read it: always a float, never a bare integer (which is a type error there).
// Seven digits because that is what a GLSL float holds; at five, PHYSICS' own stride came out 3e-7 away
// from gaitOf's and the hips 6e-7 m away from bobAt's (measured, both now under 3e-8).
const _gf = (v) => {
  const s = (+v).toFixed(7).replace(/(\.\d*?)0+$/, '$1');
  return s.endsWith('.') ? s + '0' : s;
};
const _q = (() => { try { return new URLSearchParams(location.search); } catch (e) { return null; } })();
const _qn = (k, d) => (_q && _q.has(k) && isFinite(+_q.get(k)) ? +_q.get(k) : d);

const IK_ON = _qn('beastik', 1) > 0;          // the legs solved to a planted foot, not swung on a sine
const BOB_ON = _qn('beastbob', 1) > 0;        // the body's weight: the girdles' rise and fall, the back's pitch
const FLAT_ON = _qn('beastflat', 1) > 0;      // a flat piece painted once in the vertex shader

export const BEAST_PARTS = 16;                // matches world/beastkit.js MAX_PARTS; every species shares ONE program
export const BEAST_DEPTH = 3;                 // and MAX_DEPTH: the parent walk below is unrolled this many times
// What a part is, for the few things a part does beyond swinging. Taken from the plan's own part NAMES, so no
// file has to import another's numbering.
export const BROLE = { BODY: 0, NECK: 1, HEAD: 2, EARS: 3, TAIL: 4, LEG_U: 5, LEG_L: 6, OTHER: 7 };

const T = EXPLORER_BODY;
const PI = _gf(Math.PI), TAU = _gf(Math.PI * 2);
// PHYSICS' own stride law, as plain numbers in the shader text (explorer.js:209-219; see gaitOf at :860)
const G_WSTEP = _gf(T.walkStep), G_WSTEPE = _gf(T.walkStepExp);
const G_WDUTY = _gf(T.walkDuty), G_WDUTYF = _gf(T.walkDutyFr);
const G_RSTEP = _gf(T.runStep), G_RSTEPE = _gf(T.runStepExp);
const G_RDUTY = _gf(T.runDutyMax), G_SWEEP = _gf(Math.sin(T.gaitSweep));
const G_ROCK1 = _gf(1 - T.gaitRocker);        // the rocker: the hips vault over a leg of (1 - rocker) L
const EXPL_LEG = _gf(T.legLength);            // the leg the explorer's own lift and amplitude numbers were set for

// chunks.js declares pcUp inside PAINT (oil) and inside FRAG_PARS; a vertex shader that takes PAINT on its own
// already has it. Neither is taken on faith -- each is looked for in the chunk as it stands, as materials.js does.
const PC_UP_V = /\bpcUp\b/.test(PAINT) ? '' : 'float pcUp = 0.5;';
const PC_UP_F = /\bpcUp\b/.test(FRAG_PARS) ? '' : 'float pcUp = 0.5;';
// the one line that says which way a surface faces the sky (materials.js SKYUP, ?skyface=)
const SKYFACE = _qn('skyface', 1);
const SKYUP = (e) => (SKYFACE <= 0 ? '' : SKYFACE >= 1 ? `pcUp = ${e};` : `pcUp = mix(0.5, ${e}, ${_gf(SKYFACE)});`);

// ===================================================================================================
// THE PART TABLE, read off the plan (world/beastkit.js beastPlan). Nothing is imported from it: the field
// names below ARE the contract, written out in its header, and a caller may hand its own packed tables.
// ===================================================================================================
function roleOf(name) {
  const n = String(name || '').toLowerCase();
  if (n === 'body' || n === 'root' || n === 'trunk') return BROLE.BODY;
  if (n.startsWith('neck')) return BROLE.NECK;
  if (n.startsWith('head') || n.startsWith('skull') || n.startsWith('muzzle')) return BROLE.HEAD;
  if (n.startsWith('ear')) return BROLE.EARS;
  if (n.startsWith('tail')) return BROLE.TAIL;
  if (/^[fh][lr]_u/.test(n)) return BROLE.LEG_U;
  if (/^[fh][lr]_l/.test(n)) return BROLE.LEG_L;
  return BROLE.OTHER;
}
// which leg a part belongs to: fore-left 0, fore-right 1, hind-left 2, hind-right 3 (beastkit WP's own order)
function legOf(name) {
  const m = /^([fh])([lr])_/.exec(String(name || '').toLowerCase());
  return m ? (m[1] === 'f' ? 0 : 2) + (m[2] === 'l' ? 0 : 1) : -1;
}
// MY numbers, chosen for the drawing and not measured: what a part does when the animal is standing still.
// A plan may give its own (part.idleAmp, part.idleRate) and these are then not used.
const IDLE = {
  [BROLE.BODY]: [0, 0], [BROLE.NECK]: [0.030, 0.090], [BROLE.HEAD]: [0.050, 0.110],
  [BROLE.EARS]: [0.160, 0.370], [BROLE.TAIL]: [0.110, 0.230], [BROLE.LEG_U]: [0, 0],
  [BROLE.LEG_L]: [0, 0], [BROLE.OTHER]: [0, 0],
};

// A leg swings about the animal's own X, so every length and angle the solver wants is measured in the
// (y, z) side plane only -- which is exact, not an approximation: the leg's x never changes.
const dist2d = (a, b) => Math.hypot(a[1] - b[1], a[2] - b[2]);
// a segment's angle from straight down, forward (-Z) positive: the one convention the whole rig turns on
const angDown = (a, b) => Math.atan2(-(b[2] - a[2]), -(b[1] - a[1]));

// The four tables the vertex shader walks. Pivots are metres in the animal's rest space.
function packTables(plan) {
  const n = BEAST_PARTS;
  const pivot = new Float32Array(n * 4), axis = new Float32Array(n * 4);
  const swing = new Float32Array(n * 4), role = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const p = plan.parts && plan.parts[i];
    if (!p) { pivot[i * 4 + 3] = -1; axis[i * 4] = 1; role[i * 4] = BROLE.OTHER; continue; }
    const r = roleOf(p.name), idl = IDLE[r] || [0, 0];
    pivot[i * 4] = p.pivot[0]; pivot[i * 4 + 1] = p.pivot[1]; pivot[i * 4 + 2] = p.pivot[2];
    pivot[i * 4 + 3] = p.parent == null ? -1 : p.parent;
    const ax = p.axis || [1, 0, 0];
    axis[i * 4] = ax[0]; axis[i * 4 + 1] = ax[1]; axis[i * 4 + 2] = ax[2]; axis[i * 4 + 3] = p.lag || 0;
    swing[i * 4] = p.amp || 0; swing[i * 4 + 1] = p.phase || 0; swing[i * 4 + 2] = p.harm || 0;
    swing[i * 4 + 3] = p.gait == null ? 0 : p.gait;
    role[i * 4] = r; role[i * 4 + 1] = legOf(p.name);
    role[i * 4 + 2] = p.idleAmp == null ? idl[0] : p.idleAmp;
    role[i * 4 + 3] = p.idleRate == null ? idl[1] : p.idleRate;
  }
  // The four legs' places in the stride as the plan gives them (its table is the two-beat TROT: the
  // diagonals together). Found by each part's own name, never by its index, so this file holds no copy of
  // another file's numbering.
  const trot = [0, 0.5, 0.5, 0];
  for (let i = 0; i < n; i++) {
    const p = plan.parts && plan.parts[i];
    if (!p || roleOf(p.name) !== BROLE.LEG_U) continue;
    const k = legOf(p.name);
    if (k >= 0) trot[k] = p.phase || 0;
  }
  return { pivot, axis, swing, role, trot };
}

// THE LEGS, FOR THE SOLVER. The plan's layout is the one source of truth for where everything is
// (beastkit walkerLayout), so the lengths and the rest angles are read off it and never guessed. Returns
// null where a plan has no such layout -- the shader then falls back to the plan's plain swing table, and
// says so with uBKnee.z = 0, which is also what ?beastik=0 does.
function legsOf(plan) {
  const Y = plan && plan.layout;
  if (!Y || typeof Y.shoulder !== 'function' || typeof Y.elbow !== 'function' || typeof Y.ffoot !== 'function'
    || typeof Y.hip !== 'function' || typeof Y.stifle !== 'function' || typeof Y.hfoot !== 'function') return null;
  const sh = Y.shoulder(1), el = Y.elbow(1), ff = Y.ffoot(1);
  const hp = Y.hip(1), st = Y.stifle(1), hf = Y.hfoot(1);
  const a1 = dist2d(sh, el), b1 = dist2d(el, ff), a2 = dist2d(hp, st), b2 = dist2d(st, hf);
  if (!(a1 > 1e-4 && b1 > 1e-4 && a2 > 1e-4 && b2 > 1e-4)) return null;
  const r1 = angDown(sh, el), r2 = angDown(el, ff), r3 = angDown(hp, st), r4 = angDown(st, hf);
  // which side the knee points, from the rest pose itself: the fore elbow falls BEHIND the line from the
  // shoulder to the foot and the hind stifle in FRONT of it, which is the one thing that says animal
  // rather than dog-shaped model. Taken, not assumed, so a plan that builds its legs the other way still works.
  const kf = Math.sign(r1 - angDown(sh, ff)) || 1, kh = Math.sign(r3 - angDown(hp, hf)) || 1;
  return { seg: [a1, b1, a2, b2], rest: [r1, r2, r3, r4], knee: [kf, kh], girdle: Math.abs(hp[2] - sh[2]) };
}

// ===================================================================================================
// THE VERTEX SHADER: where a hundred animals are posed.
// ===================================================================================================
const BEAST_VERT = /* glsl */`
${VERT_PARS}
attribute vec3 color;
attribute vec3 aMat;      // (dry, wet, glow) -- models.js' own meaning; dry >= 0.985: one flat piece of paint
attribute vec4 aRig;      // x which part, y how far along it (0 pivot .. 1 tip), z the piece's seed, w flutter
attribute vec3 aPiece;    // the flat piece's centre in the rest pose (a solid form: the vertex itself)
#ifdef USE_INSTANCING
// THE PER-INSTANCE CONTRACT, as world/beasts.js _write already fills it. Everything a creature does in
// one frame is these twelve floats and its matrix; nothing is kept between frames.
attribute vec4 aInst;     // x hue, y value, z seed 0..1, w the shade it stands in (the flora's own four)
attribute vec4 aGait;     // x stride phase (TURNS, 0..1), y ground speed (m/s), z state, w when it appeared (the wash clock, s; below 0: it is being lifted out)
attribute vec4 aSpec;     // x species, y turn (rad/s, signed; see uBMove.w), z head (-1 thrown up .. +1 muzzle to the ground), w alert 0..1
#endif

uniform vec4 uBPivot[PC_BPARTS];   // xyz the hinge, w the parent part (-1: the root)
uniform vec4 uBAxis[PC_BPARTS];    // xyz the hinge's axis (unit), w how far it TRAILS its parent (turns)
uniform vec4 uBSwing[PC_BPARTS];   // x radians, y its place in the stride (turns), z the second harmonic, w how far it follows the stride at all
uniform vec4 uBRole[PC_BPARTS];    // x role, y which leg (-1 none), z its own idle swing (rad), w its own rate (Hz)
uniform vec4 uBGait;   // x leg length (m), y the Froude number it changes gait at, z gravity (m/s2), w the girdles' spacing (m)
uniform vec4 uBSeg;    // the leg bones (m): fore upper, fore lower, hind upper, hind lower
uniform vec4 uBRest;   // their rest angles from straight down (rad, forward positive), the same order
uniform vec4 uBKnee;   // x the fore knee's side, y the hind knee's, z 1 = solve the legs to a planted foot, w how much of PHYSICS' step this animal takes (1 = all of it; see beastReach)
uniform vec4 uBBody;   // x the bob's gain, y the head's counter-bob, z breath, w lean (rad per rad/s of turn; 0 until aSpec.y carries a turn)
uniform vec4 uBMove;   // x roll, y yaw, z pitch (all gains), w how far the head leads a turn (rad per rad/s; 0 as above)
uniform vec4 uBPose;   // the posture's reach, in radians: x neck, y head, z ears, w tail
uniform vec4 uBWalk;   // the four-beat WALK's leg phases (fore-left, fore-right, hind-left, hind-right)
uniform vec4 uBTrot;   // and the two-beat TROT's, as the plan's own part table gives them
uniform vec4 uBFig;    // x 1/chart (1/m), y pooling, z the finest streak (m), w the region id
uniform vec3 uOrigin;
uniform vec3 uCamLocal;
uniform vec3 uWashIn;  // x the wash clock now (s), y when this mesh was first laid, z how long a wash takes (flora.js' own)
uniform float uTime;
// (the shadow pass, PC_BSHADOW: how far from the sun this vertex is, in the square's own units. The SAME vertex
//  shader poses the animal for its shadow as for its paint -- a second copy would drift and a deer would walk in
//  the picture while standing still in its own shadow. render/shadow.js FIG_SH_FRAG writes it.)
uniform float uInv;
varying float vS;
#ifdef PC_OIL
uniform vec3 uSunDirW;
uniform vec3 uGlaze;
uniform vec3 uLight;
uniform vec3 uUpW;
uniform float uDayness;
uniform float uMoon;
uniform float uStorm;
uniform vec4 uWx;
uniform vec4 uOilA;
uniform vec4 uOilB;
uniform vec4 uOilD;
uniform vec4 uOilG;
${PC_UP_V}
${PAINT}
#ifdef PC_OIL
// (L3, one light: a flat piece is lit whole at its centre, here, so it reads the sun's shadow here too)
uniform mat4 uShV;
uniform vec3 uSunV;
uniform highp sampler2D uShTex;
uniform vec4 uShK;
${SUN_VIEW_SRC}
#endif
// (chunks.js pcWetWash, as it stands there: it lives in FRAG_PARS, which a vertex shader does not take)
vec3 pcWetWashB(vec3 c, float amt) {
  return pcDensity(c * mix(vec3(1.0), vec3(0.95, 0.96, 0.99), uWx.y * amt), 1.0 + 0.62 * uWx.y * amt);
}
#endif

varying vec3 vObj;
varying vec3 vNO;
varying vec3 vNV;
varying vec3 vView;
varying vec3 vCol;
varying vec3 vMat;
varying vec4 vFlat;    // rgb a flat piece's whole paint, worked out once here; a: 1 it is flat, 0 it is painted per pixel

// ---- PHYSICS' stride, with this animal's leg (explorer.js gaitOf, its constants interpolated above) ----
// x the step (m), y the share of the STRIDE a foot is down, z 2 a run / 1 a walk, w the Froude number
vec4 pcBGait(float v, float L, float g) {
  float gE = max(g, 0.3);
  float fr = max(v * v / (gE * L), 1e-6);
  float sW = L * ${G_WSTEP} * pow(fr, ${G_WSTEPE});
  float dW = max(0.52, ${G_WDUTY} - ${G_WDUTYF} * fr);
  float sR = L * ${G_RSTEP} * pow(fr, ${G_RSTEPE});
  float dR = min(${G_RDUTY}, L * ${G_SWEEP} / max(sR, 1e-4));
  float run = step(uBGait.y, fr);
  // uBKnee.w: SHORTER STEPS, MORE OF THEM. The step stays in step with the ground (the stride phase is
  // advanced by v / (2 step), so the planted foot still does not creep) and only the leg's reach changes.
  // It is here because a two-bone leg standing nearly straight cannot span PHYSICS' own step: MEASURED on
  // beastkit's own rows, the deer's fore leg stands at 99.0 per cent of its two bones and a walk at 1.6 m/s
  // asks 106 per cent of it, so the hoof falls 4.0 cm short at each end of its stance. The real mend is in
  // the geometry (stand the leg bent, as the badger's already is at 84 per cent); this is the dial for
  // trading that fault against a shorter, quicker step until it is mended.
  return vec4(mix(sW, sR, run) * uBKnee.w, mix(dW, dR, run), 1.0 + run, fr);
}
// The hips over their standing height (m) at the STEP phase ph (0 is a footfall): explorer.js bobAt, line
// for line. A walk is an inverted pendulum vaulting over the stance foot; a run is a ballistic flight.
float pcBBob(float ph, vec4 G, float v, float L, float g) {
  float k = ${G_ROCK1} * L, s = G.x, duty = G.y;
  if (G.z > 1.5) {
    float P = s / max(v, 1e-3), tc = max(2.0 * duty * P, 1e-4), tf = P - tc;
    float A = 0.5 * ${PI} * g * P / tc;
    float drop = k * (1.0 - cos(duty * s / L));
    float t = ph * P;
    if (t < tc) { float a = ${PI} / tc; return -drop - 0.5 * g * tf * t + A * (t - sin(a * t) / a) / a - 0.5 * g * t * t; }
    float u = t - tc; return -drop + 0.5 * g * (tf - u) * u;
  }
  float ds = 2.0 * duty - 1.0;
  float yl = -k * (1.0 - cos((ph - 0.5 * (1.0 + ds)) * s / L));
  if (ph >= ds) return yl;
  float yt = -k * (1.0 - cos((ph + 0.5 * (1.0 - ds)) * s / L));
  float w = ph / max(ds, 1e-4);
  return yt + (yl - yt) * w * w * (3.0 - 2.0 * w);
}
// Where a foot is within the stride, off its standing place: x forward (m), y lifted (m). This is
// explorer.js stepGait's own foot, taken per foot: DOWN for 'duty' of the stride and carried backward at
// exactly the ground speed (which is what stops the planted foot creeping), then a cycloid swing with a
// sin(pi sqrt(u)) lift. It only holds if the stride phase is advanced by v dt / (2 step): beastStrideRate.
vec2 pcBFoot(float p, vec4 G, float X, float lift) {
  p = fract(p);
  if (p < G.y) return vec2(X * (1.0 - 2.0 * min(1.0, p / max(G.y, 1e-4))), 0.0);
  float u = (p - G.y) / max(1.0 - G.y, 1e-4);
  return vec2(X * (2.0 * (u - sin(${TAU} * u) / ${TAU}) - 1.0), lift * sin(${PI} * sqrt(u)));
}
// Two bones from the hip to the foot, in the animal's own side plane (y, z): the ABSOLUTE angles of the
// upper and the lower bone, measured from straight down, forward positive. sgn picks the side the knee
// bends toward (taken from the rest pose in JS, never assumed).
vec2 pcBLeg(float hy, float hz, float fy, float fz, float a, float b, float sgn) {
  // (the foot is always under the hip: holding it so keeps the angle below from being asked of a point at
  // the hip itself, where it has no answer)
  float dy = min(fy - hy, -1e-4), dz = fz - hz;
  float d = clamp(sqrt(dy * dy + dz * dz), abs(a - b) + 1e-3, (a + b) * 0.995);
  float beta = atan(-dz, -dy);
  float ca = clamp((a * a + d * d - b * b) / (2.0 * a * d), -1.0, 1.0);
  float cg = clamp((a * a + b * b - d * d) / (2.0 * a * b), -1.0, 1.0);
  float t1 = beta + sgn * acos(ca);
  return vec2(t1, t1 - sgn * (${PI} - acos(cg)));
}
// Turning a vector about a part's axis. Nearly every hinge in a four-legged plan swings about the animal's
// own X (a leg, a neck, a tail's rise), which is six instructions; the few that do not (the ears fanning
// about the body's forward, a tail's swish about its up) take the general turn.
vec3 pcBSpin(vec3 q, vec3 ax, float c, float s) {
  if (ax.x > 0.999) return vec3(q.x, q.y * c - q.z * s, q.y * s + q.z * c);
  return q * c + cross(ax, q) * s + ax * (dot(ax, q) * (1.0 - c));
}
// the way a bone at angle th from straight down points (y, z), forward negative in Z
vec2 pcBDown(float th) { return vec2(-cos(th), -sin(th)); }
// blending two places in a cycle the SHORT way round: 0.75 to 0.0 must go up through 1, not down through 0.375
float pcBMixPh(float a, float b, float t) { return a + (fract(b - a + 0.5) - 0.5) * t; }

void main() {
  #ifdef USE_INSTANCING
    mat4 im = instanceMatrix;
    vec4 inst = aInst;
    vec4 gt = aGait;
    vec4 mo = aSpec;
  #else
    mat4 im = mat4(1.0);
    vec4 inst = vec4(0.0, 0.0, 0.5, 0.0);
    vec4 gt = vec4(0.0, 0.0, 0.0, 0.0);
    vec4 mo = vec4(0.0, 0.0, 0.0, 0.0);      // not instanced (the gallery, a single animal): standing, calm
  #endif
  float L = max(uBGait.x, 0.02), g = max(uBGait.z, 0.3);
  float v = max(gt.y, 0.0);
  float phi = gt.x;                       // where it is in its stride, in turns
  float seed = inst.z;
  float clk = uTime + seed * 41.0;        // its own clock, so nothing in a herd flicks an ear in step
  vec4 G = pcBGait(max(v, 0.08), L, g);
  // HOW MUCH OF THE STRIDE THERE IS: none at rest, all of it once it is walking. The explorer eases this
  // over 0.1 to 0.5 m/s on a 0.9 m leg (explorer.js stepGait, ampT); the same two speeds in leg lengths and
  // gravities, so a hare and a stag each start to stride at their own pace and so does every planet.
  float vStar = v / sqrt(g * L);
  float gA = smoothstep(0.034, 0.168, vStar);
  // the foot's lift, the explorer's own numbers at this animal's size
  float lift = (G.z > 1.5 ? 0.12 + 0.10 * min(1.0, v / 7.0) : 0.07) * (L / ${EXPL_LEG}) * gA;
  float X = G.y * G.x * gA;               // half the travel of a foot while it is down
  // THE FOUR FEET, as one number each. A walk is four-beat, a trot two-beat (diagonals together) and a
  // gallop very nearly both fore feet and then both hind: the places slide from one into the other with
  // the Froude number rather than snapping, which is what a real change of gait looks like.
  float t1 = smoothstep(0.75 * uBGait.y, 1.25 * uBGait.y, G.w);
  float t2 = smoothstep(2.0 * uBGait.y, 3.5 * uBGait.y, G.w);
  vec4 bound = vec4(0.0, 0.10, 0.50, 0.60);      // a gallop: both fore feet, then both hind
  vec4 legPh;
  legPh.x = pcBMixPh(pcBMixPh(uBWalk.x, uBTrot.x, t1), bound.x, t2);
  legPh.y = pcBMixPh(pcBMixPh(uBWalk.y, uBTrot.y, t1), bound.y, t2);
  legPh.z = pcBMixPh(pcBMixPh(uBWalk.z, uBTrot.z, t1), bound.z, t2);
  legPh.w = pcBMixPh(pcBMixPh(uBWalk.w, uBTrot.w, t1), bound.w, t2);

  // ---- the body's own weight: the two girdles rise and fall on their own feet ----
  float bob = 0.0, pitch = 0.0, roll = 0.0, yaw = 0.0;
  ${BOB_ON ? `
  {
    float bF = pcBBob(fract((phi + legPh.x) * 2.0), G, max(v, 0.08), L, g);
    float bH = pcBBob(fract((phi + legPh.z) * 2.0), G, max(v, 0.08), L, g);
    bob = 0.5 * (bF + bH) * gA * uBBody.x;
    // the back pitches because the shoulders and the hips are not falling together: the body DIPS as a
    // foot lands, which is the whole of "weight" and costs one subtraction
    pitch = (bF - bH) / max(uBGait.w, 0.05) * gA * uBMove.z;
    // a walk rolls (the unsupported side drops), a trot hardly does: the diagonal pairs hold it level
    roll = -uBMove.x * sin(${TAU} * (phi + legPh.x)) * gA * (1.0 - 0.75 * t1);
    yaw = uBMove.y * sin(${TAU} * (phi + legPh.x)) * gA;
  }` : ''}
  // leaning into a turn, as a figure does (models.js leanR), and the flinch of a startle
  roll += uBBody.w * mo.y;
  float jolt = mo.w * 0.5 * sin(clk * 23.0);
  pitch -= jolt * 0.12;

  int pi = clamp(int(aRig.x + 0.5), 0, ${BEAST_PARTS - 1});
  vec3 p = position, n = normal, pc = aPiece;
  vec3 C = uBPivot[0].xyz;                 // the barrel's middle: the root's own pivot
  // breath: the barrel alone swells, slowly, and only while the animal is still (the legs and the head do
  // not grow with it). A whole-body scale would lift the feet off the ground.
  if (uBRole[pi].x < 0.5 && uBBody.z > 0.0) {
    float br = 1.0 + uBBody.z * (1.0 - gA) * sin(clk * 1.15);
    p = C + (p - C) * br; pc = C + (pc - C) * br;
  }

  // ---- the hinges: a fixed walk up the parent chain, which GLSL unrolls ----
  for (int h = 0; h < ${BEAST_DEPTH}; h++) {
    if (pi < 0) break;
    vec4 PV = uBPivot[pi], AX = uBAxis[pi], SW = uBSwing[pi], RO = uBRole[pi];
    float role = RO.x;
    // THE ROOT DOES NOT HINGE (beastkit: the body carries the whole animal's bob, pitch, roll and yaw, and
    // those are laid on below). Leaving it out of the walk is not only cheaper: it is what lets a part
    // THREE parents deep -- an ear, whose chain is ear, head, neck -- be posed whole inside three steps.
    if (role < 0.5) break;
    float th;
    float leg = RO.y;
    bool isLeg = role > 4.5 && role < 6.5 && leg > -0.5 && uBKnee.z > 0.5;
    if (isLeg) {
      // THE LEG IS SOLVED, NOT SWUNG. Where the foot must be is PHYSICS' own answer (pcBFoot); the two
      // bones are then put through it. The planted foot stays exactly where it was put down, which is the
      // one thing a sine cannot do and the first thing to look at in a still.
      bool fore = leg < 1.5;
      float a = fore ? uBSeg.x : uBSeg.z, b = fore ? uBSeg.y : uBSeg.w;
      float r1 = fore ? uBRest.x : uBRest.z, r2 = fore ? uBRest.y : uBRest.w;
      float sgn = fore ? uBKnee.x : uBKnee.y;
      int up = role > 5.5 ? clamp(int(PV.w + 0.5), 0, ${BEAST_PARTS - 1}) : pi;
      vec3 HP = uBPivot[up].xyz;
      vec2 rest = HP.yz + a * pcBDown(r1) + b * pcBDown(r2);
      float lp = leg < 0.5 ? legPh.x : leg < 1.5 ? legPh.y : leg < 2.5 ? legPh.z : legPh.w;
      vec2 fo = pcBFoot(phi + lp, G, X, lift);
      vec2 F = vec2(rest.x + fo.y, rest.y - fo.x);      // forward is -Z, and the swing lifts it
      // the foot is put down on the GROUND, so it must be answered in the frame the body has not yet
      // bobbed and pitched in: the root's rise and tip are taken off it first (both lie in this plane)
      vec2 d = F - vec2(C.y + bob, C.z);
      float cP = cos(-pitch), sP = sin(-pitch);
      F = vec2(C.y + d.x * cP - d.y * sP, C.z + d.x * sP + d.y * cP);
      vec2 ik = pcBLeg(HP.y, HP.z, F.x, F.y, a, b, sgn);
      th = role > 5.5 ? (ik.y - r2) - (ik.x - r1) : ik.x - r1;
    } else {
      // everything that is not a leg: its own place in the stride, how far it trails its parent, and a
      // second harmonic so a limb is not a pendulum -- a pendulum is a toy
      float ph = phi + SW.y - AX.w;
      float stride = mix(sin(${TAU} * ph), sin(2.0 * ${TAU} * ph), SW.z);
      float idle = RO.z * sin(${TAU} * (clk * RO.w + seed * 7.13));
      th = SW.x * SW.w * stride * gA + idle * (1.0 - 0.65 * gA);
      // the head and the neck: the posture the routines ask for (a muzzle to the ground, a head thrown up
      // at a sound), the head held level against the body's own pitch, and a startle
      if (role > 0.5 && role < 1.5) th -= mo.z * uBPose.x + mo.w * 0.45 * uBPose.x;
      if (role > 1.5 && role < 2.5) th += uBBody.y * pitch - mo.z * uBPose.y - mo.w * 0.30 * uBPose.y + jolt * 0.3;
      // the ears flick: a sharp, rare thing on their own clock, and every ear up at a startle
      if (role > 2.5 && role < 3.5) th += uBPose.z * (pow(fract(clk * 0.31 + seed), 40.0) * 0.8 + mo.w);
      // the tail: up when startled, down and still while the muzzle is in the grass
      if (role > 3.5 && role < 4.5) th += uBPose.w * (mo.w * 0.8 - max(mo.z, 0.0) * 0.25);
    }
    float c = cos(th), s = sin(th);
    vec3 piv = PV.xyz;
    p = piv + pcBSpin(p - piv, AX.xyz, c, s);
    pc = piv + pcBSpin(pc - piv, AX.xyz, c, s);
    n = pcBSpin(n, AX.xyz, c, s);
    // THE HEAD LEADS. A neck that only pitches makes an animal that walks round a corner facing the wrong
    // way; the head turning first is most of what reads as an animal paying attention.
    if (role > 0.5 && role < 2.5 && uBMove.w != 0.0) {
      float ty = mo.y * uBMove.w, cy = cos(ty), sy = sin(ty);
      vec3 ya = vec3(0.0, 1.0, 0.0);
      p = piv + pcBSpin(p - piv, ya, cy, sy);
      pc = piv + pcBSpin(pc - piv, ya, cy, sy);
      n = pcBSpin(n, ya, cy, sy);
    }
    pi = PV.w < -0.5 ? -1 : int(PV.w + 0.5);
  }
  // THE ROOT, in the order the legs were solved for: the back's pitch about the barrel's middle, then the
  // whole animal's rise and fall. (The leg above takes exactly this off its foot's place before it solves,
  // so a planted hoof stays planted through both.)
  {
    float cR = cos(pitch), sR = sin(pitch);
    p = C + pcBSpin(p - C, uBAxis[0].xyz, cR, sR);
    pc = C + pcBSpin(pc - C, uBAxis[0].xyz, cR, sR);
    n = pcBSpin(n, uBAxis[0].xyz, cR, sR);
  }
  // then the roll and the yaw about the ground under its middle (small angles: a turn to first order,
  // which is 2 mm out at a tenth of a radian on a 0.3 m limb and saves two turns)
  p.y += bob; pc.y += bob;
  vec3 A = vec3(0.0, 0.0, C.z);
  vec3 om = vec3(0.0, yaw, roll);
  p += cross(om, p - A); pc += cross(om, pc - A); n += cross(om, n);
  // nothing appears or goes in one frame: a creature arriving in this mesh grows out of the ground it
  // stands on, and one being lifted out goes back into it. The clock is flora.js' own (uWashIn), and its
  // default (a clock of 1e6, laid at 0) reads 1 -- fully there -- so a mesh nobody drives still draws.
  float fade = clamp((uWashIn.x - max(abs(gt.w), uWashIn.y)) / max(uWashIn.z, 1e-3), 0.0, 1.0);
  if (gt.w < 0.0) fade = 1.0 - clamp((uWashIn.x + gt.w) / max(uWashIn.z, 1e-3), 0.0, 1.0);
  p = A + (p - A) * fade; pc = A + (pc - A) * fade;

  mat3 im3 = mat3(im);
  vec3 io = im[3].xyz;
  vec3 wp = (im * vec4(p, 1.0)).xyz;
  vNV = normalMatrix * (im3 * n);
  // the REST normal, which is what the stroke chart below is laid in: the posed one would turn the chart's
  // axis under a limb as it swings and the streaks would jump from one lie to the other mid-stride
  vNO = normal;
  vMat = aMat;
  // the wash chart is the REST pose, so every stroke travels with the limb and never swims -- and it is
  // moved by the instance's own number, or twenty deer would wear one deer's streaks
  vObj = position + seed * vec3(13.1, 7.7, 19.3);
  vec4 mv = modelViewMatrix * vec4(wp + pcRound(io + uOrigin), 1.0);   // (it stands where the ground is drawn)
  vView = mv.xyz;
  // its own colour: a little richer or paler, a little warmer or cooler than its neighbour (the flora's
  // own two numbers, materials.js PROP_VERT), so a herd is not a row of copies
  vec3 col = clamp(color, 0.0, 1.0);
  #ifdef PC_OIL
    col = clamp(pcDensity(col, 1.0 + inst.y * 0.35)
      * mix(vec3(1.0), mix(vec3(1.07, 0.99, 0.90), vec3(0.93, 0.99, 1.08), clamp(inst.x * 0.5 + 0.5, 0.0, 1.0)), 0.5), 0.0, 1.0);
  #endif
  vCol = col;
  vFlat = vec4(0.0);
  #if defined(PC_OIL) && defined(PC_BFLAT)
  // A FLAT PIECE IS PAINTED ONCE, HERE. A coat ribbon, an ear, an eye dab, a marking: one flat colour with
  // a crisp edge, which is both the look the owner asked for and the cheapest thing this engine can draw.
  // Everything about it is known at its centre, so the fragment shader only lays it down. This is the move
  // that took the plants' paint from 23 ms of a 39 ms frame (materials.js PROP_VERT, a leaf's paint).
  if (aMat.x > 0.985) {
    vec3 nVp = normalize(normalMatrix * (im3 * n));
    vec3 cV = (modelViewMatrix * vec4((im * vec4(pc, 1.0)).xyz + pcRound(io + uOrigin), 1.0)).xyz;
    ${SKYUP('dot(nVp, mat3(viewMatrix) * uUpW)')}
    vec3 sunVp = normalize((viewMatrix * vec4(uSunDirW, 0.0)).xyz);
    float sunF = dot(nVp, sunVp);
    float rimP = 1.0 - clamp(dot(nVp, normalize(-cV)), 0.0, 1.0);
    // the light in flat steps, half a tone each, with clean joins -- a piece shaded smoothly was a rendered
    // cylinder -- and the lit rim where the form turns from the eye on the sun's side (materials.js FIG_FRAG)
    float sunFp = uLookF.z > 0.5 ? pcSunAtView(cV, 1.4) : 1.0;      // (L3: one light, read at the piece's centre lifted past the body)
    float lvo = (uLookF.z > 0.5 ? pcLit(sunF * 0.5 + 0.5, sunFp, 0.0, 0.05) : pcLevel(sunF * 0.5 + 0.5, 0.05)) + 0.9 * smoothstep(0.50, 0.85, rimP) * smoothstep(0.0, 0.5, sunF) * uDayness * sunFp;
    lvo = floor(lvo * 2.0 + 0.5) * 0.5;
    // and the piece's own weight of pigment, by its own number: one ribbon heavier than the next
    vec3 co = pcWetWashB(pcDensity(col, 1.0 + (aRig.z - 0.5) * 0.45 * uOilB.z), 0.7);
    vFlat = vec4(pcTone(co, lvo), 1.0);
  }
  #endif
  vS = -mv.z * uInv;                 // (the shadow pass reads this; the paint pass leaves it unread)
  gl_Position = projectionMatrix * mv;
  ${VERT_END}
}
`;

// ===================================================================================================
// THE FRAGMENT SHADER: materials.js FIG_FRAG's hand, with the flat pieces taken out of the per-pixel work.
// ===================================================================================================
const BEAST_FRAG = /* glsl */`
${FRAG_PARS}
${PC_UP_F}
uniform vec4 uBFig;   // x 1/chart (1/m), y pooling, z the finest streak (m), w the region id
varying vec3 vObj;
varying vec3 vNO;
varying vec3 vNV;
varying vec3 vView;
varying vec3 vCol;
varying vec3 vMat;
varying vec4 vFlat;
void main() {
  #include <logdepthbuf_fragment>
  vec3 nV = normalize(vNV);
  if (!gl_FrontFacing) nV = -nV;
  vec3 c;
  float wet = max(vMat.y, 0.0);
  #if defined(PC_OIL) && defined(PC_BFLAT)
  if (vFlat.a > 0.5) {
    // the piece, laid as it was worked out at its centre. No noise read, no stroke chart, no derivative.
    c = vFlat.rgb;
    // (the lantern's light on it by night, the figure's own: the side toward the lantern is warm, in two flat steps)
    if (uLampV.w > 0.01) {
      vec3 toL = uLampV.xyz - vView;
      float dl = length(toL), fl = uLampV.w * (1.0 - smoothstep(0.25, 1.5, dl)) * smoothstep(-0.1, 0.5, dot(nV, toL / max(dl, 1e-3)));
      vec3 warmF = min(pcDensity(vCol, 1.1) * vec3(1.45, 0.92, 0.50) + vec3(0.12, 0.05, 0.0), vec3(1.0));
      c = fl > 0.55 ? warmF : fl > 0.22 ? mix(c, warmF, 0.5) : c;
    }
    float ff = pcFogAmount(length(vView));
    c = pcAtmosV(c, ff, vView);
    pcWrite(c, max(wet, ff * 0.8), nV, -vView.z, uBFig.w);
    return;
  }
  #endif
  #ifdef PC_OIL
    ${SKYUP('dot(nV, mat3(viewMatrix) * uUpW)')}
  #endif
  float rim = 1.0 - clamp(dot(nV, normalize(-vView)), 0.0, 1.0);
  // the slow folds of the form: the run of a flank, the hollow behind a shoulder
  float fold = texture(uNoise3D, vObj * vec3(2.6, 0.22, 2.6) * uBFig.x + 0.17).b;
  vec3 sunV = normalize((viewMatrix * vec4(uSunDirW, 0.0)).xyz);
  #ifdef PC_OIL
  {
    // the animal in strokes: thin streaks that run along the barrel and down the legs, each a little
    // lighter or darker, warmer or cooler than the next, with nothing drawn between them. The chart is the
    // animal's OWN space (materials.js FIG_FRAG), which is why it never swims as the limb swings, and it
    // obeys the rule at the head of chunks.js: no screen derivative of a planet-sized coordinate.
    vec3 fox = dFdx(vObj), foy = dFdy(vObj);
    vec3 fna = abs(normalize(vNO));
    vec2 fch, fdx, fdy;
    if (fna.x >= fna.z) { fch = vObj.yz; fdx = fox.yz; fdy = foy.yz; } else { fch = vObj.yx; fdx = fox.yx; fdy = foy.yx; }
    vec2 foc = pcStrokeOct(length(vView) * 0.8, uBFig.z);
    vec3 fr1, fr2; vec2 fds; float fown;
    pcThinLayer(fch, fdx, fdy, foc.x, 5.0, vObj, 40.0, 2.0, fr1, fds, fown, fr2);
    vec3 co = pcWetWash(pcDensity(vCol, 1.0 + (smoothstep(0.42, 0.62, fold) - 0.45) * 0.30 * (1.0 - max(vMat.z, 0.0))), 0.7);
    float sunF = dot(nV, sunV);
    float sunFg = uLookF.z > 0.5 ? pcSunAtView(vView, 1.4) : 1.0;      // (L3: one light; lifted 1.4 m toward the sun, past its own body)
    float lvo = (uLookF.z > 0.5 ? pcLit(sunF * 0.5 + 0.5, sunFg, 0.0, 0.05) : pcLevel(sunF * 0.5 + 0.5, 0.05)) + 0.9 * smoothstep(0.50, 0.85, rim) * smoothstep(0.0, 0.5, sunF) * uDayness * sunFg;
    lvo = floor(lvo * 2.0 + 0.5) * 0.5;
    vec3 t1 = pcTone(pcDabTint(co, fr1, 0.0), lvo + (fr1.z - 0.5) * 0.5), t2 = pcTone(pcDabTint(co, fr2, 0.0), lvo + (fr2.z - 0.5) * 0.5);
    c = vMat.x > 0.985 ? pcTone(co, lvo) : mix(t2, t1, fown);
    if (uLampV.w > 0.01) {
      vec3 toL = uLampV.xyz - vView;
      float dl = length(toL), fl = uLampV.w * (1.0 - smoothstep(0.25, 1.5, dl)) * smoothstep(-0.1, 0.5, dot(nV, toL / max(dl, 1e-3)));
      vec3 warmF = min(pcDensity(vCol, 1.1) * vec3(1.45, 0.92, 0.50) + vec3(0.12, 0.05, 0.0), vec3(1.0));
      c = fl > 0.55 ? warmF : fl > 0.22 ? mix(c, warmF, 0.5) : c;
    }
  }
  #else
    // the watercolour game: the wash as the figure takes it, so this material compiles and paints in either
    // look. Nothing of the creatures is loaded there, but a material that only works one way is a trap.
    vec4 n1 = texture(uNoise3D, vObj * uBFig.x);
    vec4 n2 = texture(uNoise3D, vObj * uBFig.x * 3.3 + 0.31);
    float d = 1.0 + (n1.r - 0.5) * 0.75 + (n2.g - 0.5) * 0.35 + uBFig.y * smoothstep(0.35, 0.95, rim + (n2.b - 0.5) * 0.25);
    d += (smoothstep(0.42, 0.62, fold) - 0.45) * 0.55;
    vec3 cw = pcWetWash(pcDensity(vCol, d), 0.7);
    float x = dot(nV, sunV) * 0.5 + 0.5 + (n1.g - 0.5) * 0.20 + (n2.a - 0.5) * 0.08;
    c = pcTone(cw, pcLevel(x, 0.085));
  #endif
  float f = pcFogAmount(length(vView));
  c = pcAtmosV(c, f, vView);
  pcWrite(c, max(wet, f * 0.8), nV, -vView.z, uBFig.w);
}
`;

// ===================================================================================================
// THE MATERIAL
// ===================================================================================================
// makeBeastMaterial(bodyUniforms, { plan, ... }) -> ShaderMaterial for ONE species, drawn as one
// InstancedMesh of as many animals as are near. Pass the body's uniforms (world.bodyUniforms(id)) so it
// stands in that planet's light and air.
//   plan      the part table (world/beastkit.js beastPlan): parts[], layout, body, phaseWalk
//   gravity   m/s2 on this world -- the stride is a Froude number, so this is not decoration
//   scale     the wash chart in metres (plan.body.scale by default; the explorer's is 0.42 m at 1.75 m)
//   id        the region id. 5 is the figure's own, so the picture treats a creature's edge as it treats
//             the explorer's, and 5 flat is what the explorer itself writes. If two animals overlapping
//             at 60 m ever need telling apart, the id's FRACTION is the per-object hash chunks.js pcWrite
//             allows -- but it must stay under 0.5, because post.js reads anything at 5.5 or over as
//             "in the air" and draws no line on it (post.js pcLine). Not done: a still should ask for it.
export function makeBeastMaterial(bodyU, opts = {}) {
  const plan = opts.plan;
  if (!plan || !plan.parts || !plan.parts.length) throw new Error('makeBeastMaterial: no plan');
  const B = plan.body || {};
  const Y = plan.layout || {};
  // a caller may hand its own packed tables, but only if they carry all four: beastkit's planUniforms
  // packs three (it does not know about roles), and a missing one would reach three as an empty uniform
  const given = opts.tables;
  const tb = given && given.pivot && given.axis && given.swing && given.role ? given : packTables(plan);
  const legs = IK_ON ? legsOf(plan) : null;
  const chart = opts.scale || B.scale || 0.30;
  // the leg the stride is reckoned on: the ground to the shoulder joint, which is what gaitOf's law wants
  const legLen = opts.legLength || Y.legLen || Math.max(0.1, (B.strideLen || 1) / 1.7);
  // the neck's reach: how far it must swing to put the muzzle in the grass. The kit's neck sits at neckAng
  // above the horizontal and a rotation about X adds to that angle, so the swing is the whole way down to
  // about seventy degrees below it. Taken from the plan, not guessed, so a long-necked plan still grazes.
  const neckAng = Y.neckAng == null ? 0.8 : Y.neckAng;
  const own = {
    uBPivot: { value: tb.pivot }, uBAxis: { value: tb.axis }, uBSwing: { value: tb.swing }, uBRole: { value: tb.role },
    uBGait: { value: new THREE.Vector4(legLen, opts.froude || T.gaitFr, opts.gravity == null ? 9.0 : opts.gravity, legs ? legs.girdle : Math.max(0.2, (Y.L || 1) * 0.54)) },
    uBSeg: { value: new THREE.Vector4().fromArray(legs ? legs.seg : [1, 1, 1, 1]) },
    uBRest: { value: new THREE.Vector4().fromArray(legs ? legs.rest : [0, 0, 0, 0]) },
    uBKnee: { value: new THREE.Vector4(legs ? legs.knee[0] : 1, legs ? legs.knee[1] : 1, legs ? 1 : 0, opts.strideK == null ? 1 : opts.strideK) },
    // THE TWO GAINS THAT TAKE A TURN RATE ARE 0 UNTIL ONE IS SENT. world/beasts.js writes aSpec.y as the
    // animal's SIZE today, which the instance matrix already carries, so reading it as a turn would crank
    // every head round by a quarter of a radian and leave it there. The one-line patch that frees the slot
    // is in this step's report; pass `lean` and `headLead` once it has landed.
    uBBody: { value: new THREE.Vector4(opts.bobGain == null ? 1 : opts.bobGain, B.headBob == null ? -0.6 : B.headBob, B.breath == null ? 0.012 : B.breath, opts.lean == null ? 0 : opts.lean) },
    uBMove: { value: new THREE.Vector4(opts.roll == null ? 0.045 : opts.roll, opts.yaw == null ? 0.030 : opts.yaw, opts.pitch == null ? 1 : opts.pitch, opts.headLead == null ? 0 : opts.headLead) },
    uBPose: { value: new THREE.Vector4(opts.neckPose == null ? 1.22 + neckAng : opts.neckPose, opts.headPose == null ? 0.55 : opts.headPose, opts.earPose == null ? 0.30 : opts.earPose, opts.tailPose == null ? 0.55 : opts.tailPose) },
    uBWalk: { value: new THREE.Vector4().fromArray(plan.phaseWalk || [0, 0.5, 0.25, 0.75]) },
    uBTrot: { value: new THREE.Vector4().fromArray(tb.trot || [0, 0.5, 0.5, 0]) },
    uBFig: { value: new THREE.Vector4(1 / chart, opts.pooling == null ? 0.5 : opts.pooling, opts.stroke || 0.006 * (chart / 0.42), opts.id == null ? 5 : opts.id) },
    uOrigin: { value: opts.origin || new THREE.Vector3() },
    uCamLocal: { value: opts.camLocal || new THREE.Vector3() },
    // (1e6 and 0: everything is fully laid until a streamer drives the clock -- flora.js' own default)
    uWashIn: { value: new THREE.Vector3(1e6, 0, 0.55) },
  };
  const defines = { PC_BPARTS: BEAST_PARTS };
  if (FLAT_ON) defines.PC_BFLAT = 1;
  const m = new THREE.ShaderMaterial({
    name: 'pc-beast-' + (opts.name || plan.name || ''),
    defines,
    uniforms: makePaintUniforms(bodyU, own),
    vertexShader: BEAST_VERT, fragmentShader: BEAST_FRAG,
    // the ears, the tail's brush and every coat ribbon are single-faced lozenges (beastkit stroke), so a
    // creature is drawn from both sides. No extra draw call; a few more fragments on a thing that covers
    // about 500 pixels at 90 m.
    side: opts.side == null ? THREE.DoubleSide : opts.side,
  });
  m.userData.pcPainted = true;
  // a mesh that has not been given one of these still draws: a standing animal with no colour of its own
  m.defaultAttributeValues = Object.assign({}, m.defaultAttributeValues, {
    aMat: [0.45, 0.1, 0], aRig: [0, 0, 0.5, 0], aPiece: [0, 0, 0],
    aInst: [0, 0, 0.5, 0], aGait: [0, 0, 0, 0], aSpec: [0, 0, 0, 1], color: [0.6, 0.5, 0.4],
  });
  return register(m, 'beast', opts);
}

// ===================================================================================================
// THE SAME ANIMAL, CAST FROM THE SUN. (The owner, 2026-11-23: the deer does not sit into the floor. It did
// not: render/shadow.js knew two kinds of caster -- the plain scene, drawn with one override material, and a
// FIGURE posed by a matrix palette (`uPart`) -- and an instanced creature is neither, so it cast nothing.)
//
// THE RULE THIS OBEYS: the shadow uses THE VERY SAME VERTEX SHADER as the paint, with PC_BSHADOW defined, and
// shares every pose uniform BY REFERENCE. A second copy of the posing arithmetic would drift the first time
// either was touched, and the animal would walk in the picture while standing still in its own shadow. All
// that changes is the fragment: how far from the sun this pixel is, which is what the square holds.
export function makeBeastShadowMaterial(src, uInv) {
  const u = src.uniforms, own = { uInv: uInv || { value: 1 } };
  // every uniform the vertex shader reads, by reference, so the shadow is posed on the same numbers
  for (const k of ['uBPivot', 'uBAxis', 'uBSwing', 'uBRole', 'uBGait', 'uBSeg', 'uBRest', 'uBKnee', 'uBBody',
    'uBMove', 'uBPose', 'uBWalk', 'uBTrot', 'uBFig', 'uOrigin', 'uCamLocal', 'uWashIn', 'uTime',
    'uSunDirW', 'uUpW', 'uFog', 'uOilB', 'uOilC']) if (u[k]) own[k] = u[k];
  const m = new THREE.ShaderMaterial({
    name: 'pc-shadow-beast',
    defines: Object.assign({}, src.defines, { PC_BSHADOW: 1 }),
    uniforms: own,
    vertexShader: src.vertexShader,
    fragmentShader: 'varying float vS;\nvoid main() { gl_FragColor = vec4(vS, 0.0, 0.0, 1.0); }\n',
    side: THREE.DoubleSide,
  });
  m.defaultAttributeValues = Object.assign({}, src.defaultAttributeValues);
  return m;
}

// Which way the material is built, for the log and for a test: what is on, and how many vec4 of vertex
// uniforms its own tables take (WebGL2 guarantees 256; this is counted, not assumed).
export function beastMaterialInfo() {
  // 4 tables of 16 parts = 64, plus 10 single vec4 (uBGait, uBSeg, uBRest, uBKnee, uBBody, uBMove,
  // uBPose, uBWalk, uBTrot, uBFig), plus uOrigin, uCamLocal and uTime: 77, against WebGL2's guaranteed
  // 256 and about 45 more that every painted material declares. Counted, not assumed.
  return { ik: IK_ON, bob: BOB_ON, flat: FLAT_ON, parts: BEAST_PARTS, depth: BEAST_DEPTH, ownVec4: BEAST_PARTS * 4 + 13 };
}

// ===================================================================================================
// THE SAME ARITHMETIC IN JAVASCRIPT, so node can prove it and the routines cannot get it wrong.
// Each of these calls PHYSICS' own exported function where there is one; the foot curve is the one piece
// that is a copy, because stepGait does not export it, and it is kept line for line.
// ===================================================================================================
const _body = { ...T };
function bodyFor(legLength, froude) {
  _body.legLength = legLength; _body.gaitFr = froude == null ? T.gaitFr : froude;
  return _body;
}
// The stride of an animal of this leg at this speed under this gravity: gaitOf's own result, with the
// species' own share of the step (strideK, the material's uBKnee.w) laid on it exactly as the shader does.
export function beastGait(v, g, legLength, froude, out = {}, strideK = 1) {
  const o = gaitOf(Math.max(v, 1e-3), g, bodyFor(legLength, froude), out);
  if (strideK !== 1) o.step *= strideK;
  return o;
}
// HOW FAST THE STRIDE PHASE MUST TURN, in turns a second. The routines must advance aGait.x by exactly
// this; any other rate and the planted foot creeps, which is the one thing the whole rig is built to avoid.
// (explorer.js stepGait: B.stride += v dt / (2 step), and one stride is two steps of ground.)
export function beastStrideRate(v, g, legLength, froude, out = {}, strideK = 1) {
  const o = beastGait(v, g, legLength, froude, out, strideK);
  return o.step > 1e-6 ? v / (2 * o.step) : 0;
}
// The hips over their standing height at a step phase: bobAt, with this animal's leg.
export function beastBob(stepPhase, o, g, legLength) {
  return bobAt(stepPhase, o, g, bodyFor(legLength));
}
// Where a foot is within the stride, off its standing place (m): forward, and lifted. A copy of
// stepGait's own two lines (explorer.js: the foot is down for `duty` and carried backward at exactly the
// ground speed, then swings a cycloid with a sin(pi sqrt(u)) lift). The shader's pcBFoot is this.
export function beastFoot(p, o, X, lift, out = { fwd: 0, up: 0 }) {
  p -= Math.floor(p);
  if (p < o.duty) { out.fwd = X * (1 - 2 * Math.min(1, p / Math.max(o.duty, 1e-4))); out.up = 0; return out; }
  const u = (p - o.duty) / Math.max(1 - o.duty, 1e-4);
  out.fwd = X * (2 * (u - Math.sin(2 * Math.PI * u) / (2 * Math.PI)) - 1);
  out.up = lift * Math.sin(Math.PI * Math.sqrt(u));
  return out;
}
// How much of the stride there is at this speed (0 standing, 1 striding): the shader's gA.
export function beastGaitAmount(v, g, legLength) {
  const x = v / Math.sqrt(Math.max(g, 0.3) * Math.max(legLength, 0.02));
  const t = Math.max(0, Math.min(1, (x - 0.034) / (0.168 - 0.034)));
  return t * t * (3 - 2 * t);
}
// Half the travel of a foot while it is down (m), and the lift of a swinging one: the shader's X and lift.
export function beastStep(v, g, legLength, froude, out = {}, strideK = 1) {
  const o = beastGait(Math.max(v, 0.08), g, legLength, froude, out, strideK);
  const gA = beastGaitAmount(v, g, legLength);
  const lift = (o.gait === 2 ? 0.12 + 0.10 * Math.min(1, v / 7) : 0.07) * (legLength / T.legLength) * gA;
  return { o, gA, X: o.duty * o.step * gA, lift };
}

// CAN THIS ANIMAL'S LEG REACH ITS OWN STRIDE? A two-bone leg that stands nearly straight cannot: the
// stance foot ends up further from the shoulder than the two bones can span, pcBLeg clamps, and the hoof
// hangs a few centimetres above the ground at each end of its stance. This answers it for a plan in node,
// with no browser and no still, so a new species can be checked the moment its row is written.
//   short: metres the hoof falls short at the worst phase (0 is right)
//   stand: how far the rest leg is extended, as a share of its two bones (about 0.90 is right; the
//          explorer's own leg does the same thing and models.js clamps it the same way)
//   strideK: the share of PHYSICS' step that WOULD fit, to pass to makeBeastMaterial until the geometry
//          is mended -- 1 means it already fits
export function beastReach(plan, v = 1.6, g = 9.0, opts = {}) {
  const legs = legsOf(plan);
  const Y = (plan && plan.layout) || {};
  const legLen = opts.legLength || Y.legLen || 0;
  if (!legs || !(legLen > 0)) return null;
  const out = [];
  for (const fore of [true, false]) {
    const a = fore ? legs.seg[0] : legs.seg[2], b = fore ? legs.seg[1] : legs.seg[3];
    const r1 = fore ? legs.rest[0] : legs.rest[2], r2 = fore ? legs.rest[1] : legs.rest[3];
    const hy = fore ? legLen : legLen * 1.04;      // the hind girdle sits a little higher (beastkit walkerLayout)
    const fy = hy - a * Math.cos(r1) - b * Math.cos(r2), fz = -a * Math.sin(r1) - b * Math.sin(r2);
    const d0 = Math.hypot(hy - fy, fz), reach = (a + b) * 0.995;
    const S = beastStep(v, g, legLen, opts.froude, {}, opts.strideK == null ? 1 : opts.strideK);
    const span = Math.hypot(d0 - Math.max(S.o.dip, S.o.drop), S.X);
    out.push({
      leg: fore ? 'fore' : 'hind', stand: d0 / (a + b), need: span / (a + b),
      short: Math.max(0, span - reach),
      strideK: span > reach ? Math.max(0.2, Math.sqrt(Math.max(reach * reach - (d0 - S.o.dip) * (d0 - S.o.dip), 0)) / Math.max(S.X, 1e-6)) : 1,
    });
  }
  return out;
}

export { BEAST_VERT, BEAST_FRAG };
