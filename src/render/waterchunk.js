// Painted Cosmos: THE WATER'S OWN PAINT, the GLSL the water's materials share. OWNER: PAINTER (the water group, lane W3).
//
// docs/lead/WATER-DESIGN.md 3.4 and 5.3. Everything here is the water's NEW paint, asked for in the address with
// ?wpaint=2 (data/mode.js MODE.water.wpaint). Without it nothing of this file is compiled into any shader and the
// water is v37's paint exactly. With it the paint is compiled in behind ONE UNIFORM (uWPaint), so the speed test can
// time v37's paint against the new one without rebuilding a shader (core/bench.js, the rows registered below).
//
// What the water's materials include from here (render/materials.js WATER_FRAG; the falls' material of the bodies of
// water, render/fallmat.js, may include WATERCHUNK_GLSL for its plunge pool: the functions' names and arguments below
// are its interface and stay as they are):
//   pcWStrokes(ch, wdx, wdy, d, spd, w0, asp, oc, out rnd, out rndN, out own)  the water's strokes at a pixel
// It needs chunks.js' pcThinR, pcChartToPx and uTime (in every painted fragment shader's FRAG_PARS).
import { MODE } from '../data/mode.js';
import { WATER_BENCH } from '../world/waterhooks.js';
import { WAKES2 } from '../physics/water.js';
import { SPLASHES } from '../physics/splash.js';

// The new paint is compiled in with the oil look unless ?wpaint=0 (read at use: MODE is set after this module runs). Its
// level is the uniform: 1 the new strokes (the default since 24 Nov), 2 and the new colour (steps 2-3, under review).
export function wpaintOn() {
  const on = !!(MODE.oil && MODE.water && MODE.water.wpaint >= 1);
  if (on) WPAINT.uWPaint.value = Math.min(2, MODE.water.wpaint);
  return on;
}

// THE PLAYER'S OWN SMALL WAVES (lane W4, ?wakes=2) and SPLASHES (?splash=1), with the oil look. Physics keeps their sources
// (physics/water.js WAKES2, physics/splash.js) but never turns them on itself: the paint does, here, when a water material
// is made with the switch. The uniforms are physics' own array and live count, read every frame.
export function wakesOn() {
  const on = !!(MODE.oil && MODE.water && MODE.water.wakes >= 2);
  if (on) WAKES2.on = true;
  if (MODE.oil && MODE.water && MODE.water.splash >= 1) SPLASHES.on = true;
  return on;
}
export const WAKE_U = { uWWake: { value: WAKES2.buf }, uWWakeN: { get value() { return WAKES2.live; }, set value(v) { /* (physics owns it) */ } } };

// 1: the new strokes, 2: and the new colour, 0: v37's. The same object in every water material, so one write switches them all.
export const WPAINT = { uWPaint: { value: 1 } };

// The speed test's rows for the new paint (WATER-DESIGN.md 6): at the bank and at the shore, v37's paint against the
// new one, each against its own view's "as set" row. Registered once, and only when the new paint is compiled in.
let benched = false;
export function benchWPaint() {
  if (benched || !wpaintOn()) return;
  benched = true;
  for (const view of ['bank', 'shore']) {
    WATER_BENCH.push({ name: 'v37 water paint', view, on: () => { WPAINT.uWPaint.value = 0; }, off: () => { WPAINT.uWPaint.value = Math.min(2, MODE.water.wpaint); } });
  }
}

export const WATERCHUNK_GLSL = /* glsl */`
// ---- THE WATER'S STROKES (lane W3, ?wpaint=2; render/waterchunk.js) ---------------------------------------------
// v37's water was ONE layer of thin strokes whose width was the distance's octave: at fixed distances every stroke
// doubled at once (a hard circle round the eye from above, a line across a river from its bank: the design's w20 and
// w05). And where the water has a current its strokes were laid in cells some 26 m across, each turned its own way and
// each with its own strokes, so a wide river was a patchwork with an edge round every cell (wood grain, w09), and in a
// widened pool the current's direction ran round the field's closed contours (a whorl, w06).
// Here: TWO OCTAVES, and each stroke of the finer one is there or not by its own number against how far the distance
// has gone toward the next octave, asked at the stroke's own centre, so strokes come and go whole and the coarser layer
// shows where they have gone (the ground's snow and dabs do the same: chunks.js pcDabLayer, materials.js pcSnowLayer).
// And A STROKE BELONGS TO ONE CELL: the cell its centre lies in (or lies just past the edge of). Near the edge of a cell
// the pixel asks its own cell and the cell across the edge, and draws whichever of their strokes is real there (on top:
// the higher number), so no edge is drawn between two cells and no stroke is cut. The cells grow with the strokes (some sixty strokes' widths), so a far stroke is never
// longer than its cell. Still water is turned to the wind (the caller's d), which needs no cell edge either.
// Nothing here takes a screen derivative or reads a texture: it may run inside a branch.
float pcWHash(vec2 c) { return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
// (the cells' edges waver a little, so no ruled grid shows even where two cells' strokes meet)
vec2 pcWWob(vec2 ch, float C) { return 0.10 * vec2(sin(ch.y * (6.0 / C)), sin(ch.x * (4.9 / C))); }
vec2 pcWCellOf(vec2 ch, float C) { return floor(ch / C + pcWWob(ch, C) + 0.5); }
// a cell for strokes wL wide (m): 26 m near the eye, as v37's, and never under sixty-six strokes' widths
float pcWCellC(float wL) { return max(26.0, 66.0 * wL); }
// One cell's stroke over the pixel. ch: the pixel's chart (m); cell, C: the cell and its size; mC: how far past its edge
// (in cells, along each axis) a stroke's centre may lie and the stroke still be the cell's; d, n: the way its strokes
// run and across it (chart, unit); tdx, tdy: the turned chart's screen derivatives and wdx, wdy the chart's own (m a
// pixel); wL: a stroke's width (m); asp: its length over its width; spd: how fast the strokes run along d (m/s; 0
// still); oc: how far toward the next octave at the pixel, and its screen derivatives; fine: the finer layer (its
// strokes thin out toward the next octave). Returns 1 where the stroke is real here (its centre in this cell, and
// present); pri: its place in the pile.
float pcWCand(vec2 ch, vec2 cell, float C, vec2 mC, vec2 d, vec2 n, vec2 tdx, vec2 tdy, vec2 wdx, vec2 wdy, float wL, float asp,
              float spd, vec3 oc, bool fine, out vec3 rnd, out vec3 rndN, out float own, out float pri) {
  float hf = pcWHash(cell + C * 0.0137);
  vec2 rel = ch - cell * C;
  // (each cell its own pace, a sixth either way, so two cells' strokes never march in step: v33's spread)
  float slide = uTime * spd * (0.84 + 0.32 * hf);
  vec2 p0 = vec2(dot(rel, d) - slide + hf * 173.0, dot(rel, n) + hf * 91.0) / wL;
  // (the rows sway, as water does: a bend that is a function of the run alone, so a stroke's centre is known exactly)
  float bph = hf * 6.2831853;
  vec2 p = vec2(p0.x, p0.y + 0.9 * sin(p0.x * 0.11 + bph));
  vec2 dpx = tdx / wL, dpy = tdy / wL;
  float bc = 0.099 * cos(p0.x * 0.11 + bph);
  dpx.y += bc * dpx.x; dpy.y += bc * dpy.x;
  vec2 spx = vec2(length(vec2(dpx.x, dpy.x)), length(vec2(dpx.y, dpy.y)));
  vec2 ctr, uv;
  pcThinR(p, asp, spx, 0.0, rnd, ctr, own, rndN, uv);
  pri = fract(rnd.x * 7.13 + rnd.z * 3.71);
  // where its centre lies on the water: pcThinR's own sway of the rows undone, then the bend above
  float yc = ctr.y;
  for (int k = 0; k < 4; k++) yc = ctr.y - 0.27 * sin(1.7 * yc + 0.9 * sin(0.21 * ctr.x));
  yc -= 0.9 * sin(ctr.x * 0.11 + bph);
  vec2 v = (vec2(ctr.x, yc) - p0) * wL;
  vec2 dv = d * v.x + n * v.y;
  // (its centre in this cell or within mC of it: see pcWStrokes)
  vec2 fc = (ch + dv) / C + pcWWob(ch + dv, C) + 0.5 - cell;
  if (any(lessThan(fc, -mC)) || any(greaterThan(fc, 1.0 + mC))) return 0.0;
  if (fine) {
    vec2 ds = pcChartToPx(dv, wdx, wdy, 1.0e4);
    if (rnd.z < smoothstep(0.15, 0.85, oc.x + dot(oc.yz, ds))) return 0.0;
  }
  return 1.0;
}
// The water's stroke at a pixel. ch, wdx, wdy: the water's chart and its screen derivatives (chunks.js pcGroundChart,
// pcGroundChartD from a position measured from the eye); d: the way the strokes run here (chart, unit); spd: how fast
// they run (m/s); w0: the finer octave's stroke width (pcStrokeOct4's x); asp: length over width; oc: (pcStrokeOct4's
// w - z, and the screen derivatives of its w). Out as pcThinLayer's: the top stroke's numbers, the numbers of the stroke
// that has the rest of the pixel at its edge, how much of the pixel is its own. Returns 0 where no stroke is real (a
// gap where two cells meet): the numbers are then the middle ones, and the water's own body shows.
float pcWStrokes(vec2 ch, vec2 wdx, vec2 wdy, vec2 d, float spd, float w0, float asp, vec3 oc, out vec3 rnd, out vec3 rndN, out float own) {
  vec2 n = vec2(-d.y, d.x);
  vec2 tdx = vec2(dot(wdx, d), dot(wdx, n)), tdy = vec2(dot(wdy, d), dot(wdy, n));
  float best = -1.0;
  rnd = vec3(0.5, 0.99, 0.99); rndN = rnd; own = 1.0;
  for (int L = 0; L < 2; L++) {
    bool fine = L == 0;
    if (fine && oc.x > 0.93) continue;      // (every stroke of the finer octave has gone)
    float wL = fine ? w0 : 2.0 * w0, C = pcWCellC(wL);
    vec2 f = ch / C + pcWWob(ch, C) + 0.5, cA = floor(f), fr = f - cA;
    // (half a stroke's reach along each axis of the chart, in cells: half its length along d, a row and its sway
    // across. A cell's strokes are the strokes whose centres lie in it OR WITHIN THAT OF ITS EDGE: so every stroke over
    // a pixel of a cell is that cell's, and nowhere is a pixel left with no stroke -- with the centre alone, a quarter
    // of the pixels along every cell's edge had none, and the water's own body showed there as a lattice of pale lines
    // (the first stills, E4). Two cells' strokes overlap along their edge instead, laid one over another by their
    // numbers, as strokes are; none is cut. A pixel asks the cell across an edge when a stroke of that cell can reach
    // it: twice the half reach, with a margin for the wavering edge.)
    vec2 mC = (0.82 * asp * wL * abs(d) + 1.8 * wL * abs(n)) / C;
    vec2 reach = mC * 2.3;
    vec2 nearE = min(fr, 1.0 - fr);
    vec2 side = vec2(fr.x < 0.5 ? -1.0 : 1.0, fr.y < 0.5 ? -1.0 : 1.0);
    for (int k = 0; k < 3; k++) {
      vec2 cell = cA;
      if (k == 1) { if (nearE.x >= reach.x) continue; cell.x += side.x; }
      if (k == 2) { if (nearE.y >= reach.y) continue; cell.y += side.y; }
      vec3 r, rN; float o, pr;
      if (pcWCand(ch, cell, C, mC, d, n, tdx, tdy, wdx, wdy, wL, asp, spd, oc, fine, r, rN, o, pr) > 0.5 && pr > best) {
        best = pr; rnd = r; rndN = rN; own = o;
      }
    }
    if (best >= 0.0) return 1.0;            // (a stroke of the finer octave lies over every coarser one)
  }
  return 0.0;
}
`;

// THE FAR WATER (WATER-DESIGN 5.6, FARVIEW FV5), for a ground that draws water too thin for the water's own mesh (group
// C's far ground: a coarse patch keeps its water only at level 5 or over 8 % of the patch, and surface.js draws a river
// into the far wash as wide as the samples lie apart). So that a river looks the same where it passes from the water's
// mesh to the ground's far colour, the ground lays this over its own paint by the share of the sample that is water.
// Interface (kept stable; included under PC_OIL by whoever draws far water; needs chunks.js pcDensity, pcOilSunC):
//   vec3 pcWaterFarC(vec3 own, vec3 skyRefl, float shine)        the far water's own paint
//   vec3 pcWaterFar(vec3 ground, vec3 own, vec3 skyRefl, float shine, float frac)   laid over the ground by frac
// own: the liquid's wash there (the body's liquid colour); skyRefl: the sky mirrored there (uSkyHorizon to uSkyZenith by
// the reflected ray's height, NOT whitened: the new paint's rule); shine: the sun's path there, 0..1 (pcWaterShine);
// frac: 0..1. The same recipe the water mesh's new paint lays from the air: its body laid heavy as a deep water's,
// two fifths of the sky in it, the sun's broken light on the path.
export const WATERCHUNK_FAR_GLSL = /* glsl */`
// the sun's path on far water: the reflected ray against the sun, the lobe widened as the water mesh's is from a kilometre
float pcWaterShine(vec3 up, vec3 toEye, vec3 sunDir) {
  return pow(max(dot(reflect(-normalize(toEye), up), sunDir), 0.0), 22.0) * 0.45 * max(uDayness, uMoon) * (1.0 - uWx.x);
}
vec3 pcWaterFarC(vec3 own, vec3 skyRefl, float shine) {
  vec3 c = mix(pcDensity(own, 2.15) * vec3(0.80, 0.95, 1.06), skyRefl, 0.40);
  return mix(c, min(mix(pcOilSunC(), vec3(1.0), 0.35) * 1.06, vec3(1.0)), clamp(shine, 0.0, 1.0));
}
vec3 pcWaterFar(vec3 ground, vec3 own, vec3 skyRefl, float shine, float frac) {
  return mix(ground, pcWaterFarC(own, skyRefl, shine), clamp(frac, 0.0, 1.0));
}
`;
