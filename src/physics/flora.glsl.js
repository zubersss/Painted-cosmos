// Painted Cosmos physics: the GLSL twin of FloraField.plantBend / plantDisplace (flora.js).
// OWNER: PHYSICS. A string only: no three, no DOM. PAINTER includes FLORA_GLSL in the vertex
// shader of its instanced flora and feeds it the three field textures and the uniforms from
// physics.fields.flora (see docs/notes/physics.md, "For PAINTER").
//
// The constants below are interpolated from flora.js, so the shader and the CPU model cannot
// drift apart. physics-lab.html?scene=flora draws both on top of each other as a check.
import { FLORA, WAVE_K, WAVE_ROT, WAVE_A, BRANCH_M, BRANCH_S, FLUT_D, FLUT_PH, CROWN_D, CROWN_UP, CROWN_X, CROWN_ID, CLOCK_F, CLOCK_W, CLOCK_ID, CLOCK_M } from './flora.js';

const f = (x) => (Number.isInteger(x) ? x.toFixed(1) : String(x));
const fd = (i) => `vec2(${f(FLUT_D[i][0])}, ${f(FLUT_D[i][1])})`;
const cdv = (i) => `vec2(${f(CROWN_D[i][0])}, ${f(CROWN_D[i][1])})`;
const v3 = (a) => `vec3(${a.slice(0, 3).map(f).join(', ')})`;
const v4 = (a) => `vec4(${a.slice(0, 4).map(f).join(', ')})`;
const ckv = (j) => `vec2(${f(FLORA.clockK[j][0])}, ${f(FLORA.clockK[j][1])})`;
const cm = (k) => v4([0, 1, 2, 3].map((j) => CLOCK_M[(j + k) & 3]));
const rot = (i) => `vec2(d.x * ${f(Math.cos(WAVE_ROT[i]))} - d.y * ${f(Math.sin(WAVE_ROT[i]))}, d.x * ${f(Math.sin(WAVE_ROT[i]))} + d.y * ${f(Math.cos(WAVE_ROT[i]))})`;

export const FLORA_GLSL = /* glsl */`
// ---- Painted Cosmos physics: flora bend (generated from src/physics/flora.js) ----
uniform sampler2D uPhysBend;   // RG: soft-plant load (east, north), BA: stiff-plant load
uniform sampler2D uPhysWind;   // RG: wind at 2 m (m/s), B: gust01, A: turbulence (m/s)
uniform sampler2D uPhysPush;   // RG: push load (east, north), B: flatten01, A: shake01
#ifndef PC_PHYS_FRAME
#define PC_PHYS_FRAME
uniform vec3 uPhysAnchor;      // body-local anchor of the field frame (m)
uniform vec3 uPhysEast;        // unit axes of the frame, body-local
uniform vec3 uPhysNorth;
uniform vec3 uPhysUp;
// Position of a body-local point in the field frame (metres along east and north).
// (P12: along the ray from the body's centre, the exact inverse of how the fields sample the ground; it was
// the foot of the perpendicular on the tangent plane, 1.8 m out of register 384 m from the anchor.)
vec2 pcPhysGrid(vec3 p) {
  vec3 d = p - uPhysAnchor; float r0 = dot(uPhysAnchor, uPhysUp);
  return vec2(dot(d, uPhysEast), dot(d, uPhysNorth)) * (r0 > 1.0 ? r0 / max(r0 + dot(d, uPhysUp), 0.05 * r0) : 1.0);
}
#endif
uniform vec4 uPhysWindMap;     // xy: centre of the bend/wind field (m along east/north), z: 1/size, w: texels per side
uniform vec4 uPhysNearMap;     // the same for the push field
uniform vec4 uPhysWave;        // xy: wave direction; z, w: phases of flutter trains 0 and 1 (P11)
uniform vec4 uPhysWavePhase;   // xyz: phases of the three wave trains; w: phase of flutter train 2 (P11)
uniform vec4 uPhysShape;       // soft flex, soft max angle, stiff flex, stiff max angle
uniform vec4 uPhysBranchPhase; // (P14) xyz: phases (rad) of the crown's three eddy trains, w: the twig clock (rad, wraps at 16 turns)
uniform vec4 uPhysBranch;      // x: wind speed at load 1 (m/s), y: gain, z: swing of a shaken crown (rad), w: branch length / plant height
uniform vec4 uPhysBranchClock; // (P14) phases (rad) of the four clock lines a branch rings on (FLORA.clockR x branchHz)

// Bilinear lookup that does not need float-texture filtering (define PC_PHYS_LINEAR to use the
// hardware filter instead: textures must then be LinearFilter + ClampToEdge).
vec4 pcPhysTex(sampler2D t, vec2 uv, float n) {
  #ifdef PC_PHYS_LINEAR
    return texture(t, uv);
  #else
    vec2 p = clamp(uv * n - 0.5, vec2(0.0), vec2(n - 1.0));
    vec2 i = min(floor(p), vec2(n - 2.0));
    vec2 w = p - i;
    ivec2 c = ivec2(i);
    vec4 a = texelFetch(t, c, 0), b = texelFetch(t, c + ivec2(1, 0), 0);
    vec4 e = texelFetch(t, c + ivec2(0, 1), 0), g = texelFetch(t, c + ivec2(1, 1), 0);
    return mix(mix(a, b, w.x), mix(e, g, w.x), w.y);
  #endif
}

// The bend of a plant rooted at body-local point root. stiff01: 0 grass .. 1 tree.
// Returns xy: bend (radians toward east / north), z: flatten01, w: shake01.
vec4 pcPhysBend(vec3 root, float stiff01) {
  vec2 g = pcPhysGrid(root);
  vec2 uv = (g - uPhysWindMap.xy) * uPhysWindMap.z + 0.5;
  vec4 b = pcPhysTex(uPhysBend, uv, uPhysWindMap.w);
  vec2 L = mix(b.xy, b.zw, stiff01);
  vec4 wt = pcPhysTex(uPhysWind, uv, uPhysWindMap.w);
  float gust = wt.z;
  vec2 d = uPhysWave.xy;
  float ws = ${f(WAVE_A[0])} * sin(${f(FLORA.waveK * WAVE_K[0])} * dot(${rot(0)}, g) - uPhysWavePhase.x)
           + ${f(WAVE_A[1])} * sin(${f(FLORA.waveK * WAVE_K[1])} * dot(${rot(1)}, g) - uPhysWavePhase.y)
           + ${f(WAVE_A[2])} * sin(${f(FLORA.waveK * WAVE_K[2])} * dot(${rot(2)}, g) - uPhysWavePhase.z);
  L *= 1.0 + ${f(FLORA.waveAmp)} * (1.0 - stiff01) * (0.35 + 0.65 * gust) * ws;
  // (P11) flutter: three frozen eddy trains smaller than the field can carry (flutterAt in flora.js is the twin)
  if (stiff01 < 1.0) {
    float fm = min(${f(FLORA.flutterMax)}, ${f(FLORA.flutterGain)} * wt.w / (length(wt.xy) + 0.25)) * (1.0 - stiff01);
    vec2 ub = wt.xy * ${f(FLORA.flutterBlade)};
    vec3 fk = vec3(${FLORA.flutterK.map(f).join(', ')});
    vec3 fr = fk * vec3(dot(${fd(0)}, ub), dot(${fd(1)}, ub), dot(${fd(2)}, ub)) * ${f(1 / (2 * Math.PI * FLORA.softHz))};
    vec3 fr2 = fr * fr;
    vec3 fh = vec3(${FLORA.flutterA.map(f).join(', ')}) * inversesqrt((1.0 - fr2) * (1.0 - fr2) + ${f(4 * FLORA.flutterDamp * FLORA.flutterDamp)} * fr2);
    vec3 fp = fk * vec3(dot(${fd(0)}, g), dot(${fd(1)}, g), dot(${fd(2)}, g)) - vec3(uPhysWave.z, uPhysWave.w, uPhysWavePhase.w);
    float fa = fm * dot(fh, sin(fp)), fc = fm * ${f(FLORA.flutterCross)} * dot(fh, sin(fp + vec3(${FLUT_PH.map(f).join(', ')})));
    L = L * max(0.15, 1.0 + fa) + vec2(-L.y, L.x) * fc;      // (a lull between eddies, never a wind from behind)
  }
  vec2 nuv = (g - uPhysNearMap.xy) * uPhysNearMap.z + 0.5;
  float flatten = 0.0, shake = 0.0;
  if (nuv.x > 0.0 && nuv.y > 0.0 && nuv.x < 1.0 && nuv.y < 1.0) {
    vec4 p = pcPhysTex(uPhysPush, nuv, uPhysNearMap.w);
    L += p.xy * (1.0 - 0.85 * stiff01);
    flatten = p.z * (1.0 - stiff01);
    shake = p.w;
  }
  float load = length(L);
  float flex = mix(uPhysShape.x, uPhysShape.z, stiff01);
  float amax = mix(uPhysShape.y, uPhysShape.w, stiff01);
  float ang = amax * (1.0 - exp(-flex * load));
  ang = mix(ang, ${f(FLORA.flatAngle)}, flatten);
  return vec4(L * (load > 1e-6 ? ang / load : 0.0), flatten, shake);
}

// The cheap variant: the wind response only, one lookup (four texel fetches without
// PC_PHYS_LINEAR). No travelling waves, no push field, no flatten. For the mid and far tree
// tiers and for anything beyond the 32 m near field. Returns the bend (rad, east / north).
vec2 pcPhysBendLite(vec3 root, float stiff01) {
  vec2 uv = (pcPhysGrid(root) - uPhysWindMap.xy) * uPhysWindMap.z + 0.5;
  vec4 b = pcPhysTex(uPhysBend, uv, uPhysWindMap.w);
  vec2 L = mix(b.xy, b.zw, stiff01);
  float load = length(L);
  float ang = mix(uPhysShape.y, uPhysShape.w, stiff01) * (1.0 - exp(-mix(uPhysShape.x, uPhysShape.z, stiff01) * load));
  return L * (load > 1e-6 ? ang / load : 0.0);
}

// Where a point of the plant goes. rel: the point relative to the root (body-local axes, m).
// up: the plant's own up (unit). H: the plant's height (m). bend: pcPhysBend(...).xy.
// The stem curls like a tip-loaded cantilever and keeps its length.
vec3 pcPhysDisplace(vec3 rel, vec3 up, float H, vec2 bend) {
  float h = dot(rel, up);
  float ang = length(bend);
  float s = clamp(h / max(H, 1e-3), 0.0, 1.0);
  float am = ang * (s - s * s / 3.0);
  float hor = h * sin(am);
  vec2 sh = ang > 1e-6 ? bend * (hor / ang) : vec2(0.0);
  return (rel - up * h) + uPhysEast * sh.x + uPhysNorth * sh.y + up * (h * cos(am));
}

// (P14) Branches and foliage: a crown does not sway as one piece, and a branch carries its own wind (the JS
// twin is plantCrown in flora.js; the model is written out at FLORA.branchHz there).
//   rel: the point relative to the root (body-local axes, m); up: the plant's up; H: its height (m);
//   root: the plant's root (body-local); pb: what pcPhysBend returned for this plant (only its shake, pb.w,
//   is read: the branch's wind is looked up here, at the root);
//   id: ONE NUMBER IN 0..1 FOR ALL VERTICES OF ONE BRANCH OR ONE MASS OF FOLIAGE (its own frequency and lag;
//   negative: none, the crown then moves in whole lobes round the trunk);
//   leaf01: 1 on foliage, 0 on wood (foliage trembles on top).
// Returns the offset (m) to ADD to rel BEFORE pcPhysDisplace:
//   vec3 rel = wp - io;  rel += pcPhysCrown(rel, up, H, rootB, pb, id, leaf01);  wp = io + pcPhysDisplace(rel, up, H, pb.xy);
// Nothing of the wood moves at the trunk's axis; a point streams downwind and swings about that set by
// x^2 (3 - x) / 2 of the tip's motion, x = its distance from the axis / (uPhysBranch.w * H).
// Costs two field lookups, twenty-four sines, four powers and three arctangents a vertex.
vec3 pcPhysCrown(vec3 rel, vec3 up, float H, vec3 root, vec4 pb, float id, float leaf01) {
  float h = dot(rel, up);
  vec3 q = rel - up * h;
  vec2 rd = vec2(dot(q, uPhysEast), dot(q, uPhysNorth));
  float r = length(rd);
  float Hs = max(H, 1e-3), L = uPhysBranch.w * Hs;
  float x = min(1.0, r / L), shape = x * x * (3.0 - x) * 0.5;
  vec2 g = pcPhysGrid(root);
  vec2 uv = (g - uPhysWindMap.xy) * uPhysWindMap.z + 0.5;
  vec4 b = pcPhysTex(uPhysBend, uv, uPhysWindMap.w), wt = pcPhysTex(uPhysWind, uv, uPhysWindMap.w);
  vec2 Lw = mix(b.xy, b.zw, clamp((Hs - 0.5) / 9.5, 0.0, 1.0));       // the wind load at the plant's own height
  float load = length(Lw);
  vec2 d = load > 1e-6 ? Lw / load : (r > 1e-4 ? rd / r : vec2(1.0, 0.0));
  float Uc = uPhysBranch.x * sqrt(load);
  float fb = ${f(FLORA.branchHz)} * (1.0 + ${f(FLORA.branchSpread)} * ((id >= 0.0 ? fract(id * 5.37 + 0.31) : 0.5) - 0.5));
  float z2 = 2.0 * min(${f(FLORA.branchDampMax)}, ${f(FLORA.branchDamp)} + ${f(FLORA.branchAero)} * Uc);
  vec3 ck = ${v3(FLORA.crownK)};
  vec3 cd = vec3(dot(${cdv(0)}, d), dot(${cdv(1)}, d), dot(${cdv(2)}, d));
  vec3 rr = ck * abs(cd) * (Uc / (6.2831853 * fb)), r2 = rr * rr;
  vec3 hh = ${v3(FLORA.crownA)} * inversesqrt(1.0 + r2 * r2);      // the background (the resonant peak is the clock lines')
  vec2 pt = g + rd;
  vec3 ph = ck * vec3(dot(${cdv(0)}, pt), dot(${cdv(1)}, pt), dot(${cdv(2)}, pt)) + ${f(FLORA.crownTilt)} * h - uPhysBranchPhase.xyz + atan(z2 * rr, 1.0 - r2) * sign(cd);
  float s = clamp(h / Hs, 0.0, 1.0), qs, az = 0.0;
  if (id >= 0.0) {
    ph += 6.2831853 * ${v3(CROWN_ID)} * fract(id * vec3(7.0, 11.0, 15.0) + vec3(0.0, 0.17, 0.34));
    qs = 6.2831853 * fract(id * 9.7);
  } else {
    az = r > 1e-4 ? atan(rd.y, rd.x) : 0.0;
    ph += ${v3(BRANCH_M)} * az + ${v3(BRANCH_S)} * s;
    qs = 2.0 * az;
  }
  float da = dot(hh, sin(ph)), du = dot(hh, sin(ph + ${v3(CROWN_UP)})), dc = dot(hh, sin(ph + ${v3(CROWN_X)}));
  float Io = wt.w / (length(wt.xy) + 0.25), I = min(${f(FLORA.crownImax)}, ${f(FLORA.crownI)} * Io);
  float set = ${f(FLORA.branchSetMax)} * (1.0 - exp(-${f(FLORA.branchSet / FLORA.branchSetMax)} * pow(load, ${f(FLORA.branchSetExp)})));
  float A = ${f(FLORA.branchThrash * FLORA.crownBand)} * I * set, sk = uPhysBranch.z * pb.w;
  qs += uPhysBranchPhase.w * 0.375;
  float k0 = uPhysBranch.y * L * shape;
  // the branch rings at its own frequency: four clock lines weighted by its oscillator and the turbulence at them
  vec4 fr = ${v4(CLOCK_F)} / fb, fr2 = fr * fr, nn = ${v4(CLOCK_F)} * ${f(FLORA.crownLu)} / max(Uc, 0.5);
  vec4 cc = ${f(CLOCK_W)} * I * sqrt(4.0 * nn / pow(1.0 + 70.8 * nn * nn, vec4(${f(5 / 6)}))) * inversesqrt((1.0 - fr2) * (1.0 - fr2) + z2 * z2 * fr2);
  vec4 cb = vec4(dot(${ckv(0)}, pt), dot(${ckv(1)}, pt), dot(${ckv(2)}, pt), dot(${ckv(3)}, pt)) - uPhysBranchClock;
  vec4 oa, ou, oc;
  if (id >= 0.0) {
    oa = 6.2831853 * fract(id * ${v4(CLOCK_ID[0])}); ou = 6.2831853 * fract(id * ${v4(CLOCK_ID[1])}); oc = 6.2831853 * fract(id * ${v4(CLOCK_ID[2])});
  } else {
    oa = ${cm(0)} * az + vec4(0.0, 0.9, 1.8, 2.7); ou = ${cm(1)} * az + vec4(2.3, 3.3, 4.3, 5.3); oc = ${cm(2)} * az + vec4(4.1, 5.8, 7.5, 9.2);
  }
  float kr = ${f(FLORA.branchRes)} * set;
  float al = k0 * (set + A * da + sk * sin(qs) + kr * dot(cc, sin(cb + oa)));
  float vu = k0 * (0.6 * A * du + 0.7 * sk * sin(qs + 1.9) + ${f(FLORA.branchResUp)} * kr * dot(cc, sin(cb + ou)));
  float cr = k0 * (0.5 * A * dc + ${f(FLORA.branchResX)} * kr * dot(cc, sin(cb + oc)));
  if (leaf01 > 0.0) {
    float tw = leaf01 * uPhysBranch.y * ${f(FLORA.twigMax)} * (1.0 - exp(-${f(FLORA.twigGain)} * load)) * (0.5 + Io), idp = max(id, 0.0);
    float q1 = uPhysBranchPhase.w + 3.1 * rd.x + 2.3 * rd.y + 2.7 * h + 40.0 * idp;
    float q2 = uPhysBranchPhase.w * 1.4375 - 2.2 * rd.x + 3.4 * rd.y - 1.9 * h + 71.0 * idp;
    al += tw * (0.6 * sin(q1) + 0.4 * sin(q2));
    vu += tw * 0.7 * (0.6 * sin(q1 + 1.9) + 0.4 * sin(q2 + 4.0));
    cr += tw * 0.5 * sin(q2 + 2.6);
  }
  vec2 sh = d * al + vec2(-d.y, d.x) * cr;
  return uPhysEast * sh.x + uPhysNorth * sh.y + up * vu;
}
// The same without a number per branch (P6's call, kept): whole lobes round the trunk, wood only.
//   vec3 rel = wp - io;  rel += pcPhysBranch(rel, up, H, rootB, pb);  wp = io + pcPhysDisplace(rel, up, H, pb.xy);
vec3 pcPhysBranch(vec3 rel, vec3 up, float H, vec3 root, vec4 pb) {
  return pcPhysCrown(rel, up, H, root, pb, -1.0, 0.0);
}

// Wind at 2 m above the ground at a body-local point: xy m/s (east, north), z gust01, w turbulence.
vec4 pcPhysWind(vec3 p) {
  vec2 uv = (pcPhysGrid(p) - uPhysWindMap.xy) * uPhysWindMap.z + 0.5;
  return pcPhysTex(uPhysWind, uv, uPhysWindMap.w);
}
`;
