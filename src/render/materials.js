// Painted Cosmos: painted scene materials. OWNER: PAINTER.
// The watercolor look starts here, in the materials: washes with pigment-density turbulence,
// value-stepped light, cool glaze shadows, dry-brush sparkle, banded aerial perspective. The
// post passes (post.js) then treat the result as wet paint on paper.
import * as THREE from 'three';
// THE GROUND SEEN FROM THE AIR (group C, the far view): the canopy painted into the ground. Its shader text, its uniforms
// and its switch (?canopy=) live in render/farground.js; the hooks in the ground's shaders are all inside #ifdef PC_CANOPY, which is set
// only in the oil look with the switch on.
import { CANOPY, CANOPY_DEBUG, CANOPY_FARSHADOW, CANOPY_DAB, CANOPY_FLOOR, CANOPY_VERT_DECL, CANOPY_VERT_MAIN, CANOPY_FRAG, canopyUniforms, GROUND_SEASON, SEASON_VERT, SEASON_VERT_MAIN, SEASON_FRAG, seasonUniforms, ROCKFIELD, ROCK_FRAG, rockUniforms, ROCK_DEBUG, BLOOM_FAR, BLOOM_VERT_DECL, BLOOM_VERT_MAIN, BLOOM_FRAG, bloomUniforms, FARWATER_VERT_DECL, FARWATER_VERT_MAIN, FARWATER_FRAG, FARWATER_U } from './farground.js';
import { G, PHYS, PHYSW, PREV, OIL, LOOK, BURNPAINT, register, ensureGlobals, makeBodyUniforms } from './shared.js';
import { MODE } from '../data/mode.js';
import { FLORA_GLSL } from '../physics/flora.glsl.js';
import { WATER_GLSL } from '../physics/water.js';
import { VERT_PARS, VERT_END, FRAG_PARS, FOG_BANK, PAINT, AIR_FN } from './chunks.js';
import { SPRAY_GLSL } from './dabtex.js';
import { WATERCHUNK_GLSL, WPAINT, wpaintOn, benchWPaint, wakesOn, WAKE_U, WATER_MATS } from './waterchunk.js';      // (the water's new paint, ?wpaint=2, and the player's rings, ?wakes=2: lanes W3, W4)
import { WAKE2_GLSL } from '../physics/water.js';

// THE LOOK AT THREE HUNDRED YARDS (the owner, 2026-11-22: "better lighting ... i want things to look high quality and
// fully rendered even from 300 yards away" -- 275 m). What this file does for that is on three dials, read once from
// the address and folded into the shaders as plain numbers, so each is free when it is off and the owner can be shown
// A and B of one still:
//   ?skyface=0   no surface tells the light which way it faces the sky (chunks.js pcUp keeps its neutral 0.5)
//   ?floorvar=0  the far floor loses its leaf litter and its second pigment by raw distance again
//   ?farcrown=0  a far crown goes back to one stamp with each leaf lit or shaded by its own random number
// Every one of the three is inside #ifdef PC_OIL or on a line only the oil look reaches, so the watercolour game is
// the program it was, dial or no dial.
const _q22 = (() => { try { return new URLSearchParams(location.search); } catch (e) { return null; } })();
const _d22 = (k, d) => (_q22 && _q22.has(k) && isFinite(+_q22.get(k)) ? +_q22.get(k) : d);
const _gf = (v) => (+v).toFixed(4);      // a number as GLSL must read it: a bare integer there is a type error, not a float
const SKYFACE = _d22('skyface', 1), FLOORVAR = _gf(_d22('floorvar', 1)), FARCROWN = _gf(_d22('farcrown', 1));
// (?farfix=0: the far trees' tables at eight kinds, as before 2026-11-24; see makePropMaterial)
const FARFIX = (() => { try { return new URLSearchParams(location.search).get('farfix') !== '0'; } catch { return true; } })();
// (?pines: how many times a needle card is grown at 30 m and beyond, PROP_VERT; ?needlefill= to judge another)
const NEEDLE_FILL = (() => { try { const v = +new URLSearchParams(location.search).get('needlefill'); return v > 0 ? Math.min(4, v) : 2.2; } catch { return 2.2; } })();
// THE WATER'S PAINT KNOWS THE FALL, AND WHITE WATER WHERE IT CHURNS (the owner, 2026-11-23: the water should be
// "constantly moving the way water would be naturally", with "airration"). Until now every dash on every river ran
// at one fixed rate whatever the slope, and the only foam in the game was the sea's, raised by the wind. The mesher
// now measures the water's own speed and its churn at each vertex (world/patchgen.js, the attribute aTurb) and the
// two dials below read them, so the owner can be shown A and B of one still:
//   ?flow=0   the dashes go back to v33's fixed 0.9 to 1.4 m/s whatever the fall; ?flow=2 twice as fast
//   ?aer=0    no white water at all (v33's water exactly); ?aer=3 lays it three times as readily, which is how to
//             judge the paint until the levels themselves fall -- MEASURED on Earth's brook as it stands, the
//             Froude number is 0.35 to 0.56 and the fall a flat 1.2 %, so the only churn today is at the stony edges
// Both are inside #ifdef PC_OIL, so the watercolour game is the program it was, dial or no dial. FLOW_VMAX must
// match patchgen.js's own: it is the metres a second the speed byte runs to.
const FLOWSPD = _d22('flow', 1), AER = _d22('aer', 1);
const FLOW_VMAX = _gf(5.0 * Math.max(FLOWSPD, 0)), AER_K = _gf(Math.max(AER, 0));
// (the dash's pace, as one expression: v33's fixed rate when the dial is off or the mesher gave no number, and the
// water's own speed with a sixth of spread either way kept from v33, so two patches of dash never march in step)
const FLOW_EXPR = FLOWSPD > 0
  ? `vTurb.x > 0.002 ? vTurb.x * ${FLOW_VMAX} * (0.84 + 0.32 * hf) : (0.9 + 0.5 * hf)`
  : '0.9 + 0.5 * hf';
// Where a far tree's crown sits in its own unit shape: florakit.js farCardGeometry and farTreeGeometry both set their
// crown about V(0, 0.66, 0) (the core, the shingles and the leaf cards all take it as their middle). The far-tree
// paint below measures a piece's place in its crown from here, so if that geometry ever moves, this moves with it.
const FAR_CROWN_Y = _gf(0.66);
// (the one line a material writes to say which way it faces the sky: nothing at all when the dial is off, and the
// plain value when it is full, so neither costs an instruction it need not)
const SKYUP = (e) => (SKYFACE <= 0 ? '' : SKYFACE >= 1 ? `pcUp = ${e};` : `pcUp = mix(0.5, ${e}, ${_gf(SKYFACE)});`);
// The far air's CEILING and the sky-facing float both live in chunks.js, which is not this file's to write. Neither is
// taken on faith: each is looked for in the chunk as it stands.
//   uOilAir.x -- the ceiling. If VERT_PARS declares it, pcFogAmountV below holds the plants' air to it exactly as
//     pcFogAmount holds the ground's; if it does not, or if it is declared and not attached (which reads 0), the
//     ceiling is 1, which is no ceiling at all and folds away.
//   pcUp -- if the PAINT chunk declares it, the vertex path that takes PAINT on its own already has it; if it is
//     declared only in FRAG_PARS, that path must declare its own or it will not compile. PC_UP_V / PC_UP_F are those
//     copies, and each is empty when the chunk has one of its own.
// (copied LINE FOR LINE from chunks.js pcFogAmount, where the measurements and the reasons are written out: the soft
// knee that bends the top of the curve over so a thing at 275 m keeps a quarter of its own paint, eased off by
// pcHigh SQUARED as the eye climbs. Its own guard (uOilAir.x over 0.004) is also what keeps this safe where the
// uniform is declared and not attached, which reads 0.)
const PC_UP_V = /\bpcUp\b/.test(PAINT) ? '' : 'float pcUp = 0.5;';
const PC_UP_F = /\bpcUp\b/.test(FRAG_PARS) ? '' : 'float pcUp = 0.5;';

const FOG_VERT = /* glsl */`
#ifdef PC_OIL
uniform vec4 uOilC;
#endif
uniform vec4 uFog;
uniform vec2 uAirNear;
uniform highp sampler3D uNoise3D;
uniform vec2 uFogBank;
${FOG_BANK}
// THE PLANTS BREATHE THE SAME AIR AS THE GROUND. Since 2026-11-24 (L0) this IS chunks.js pcFogAmount, made from the same
// text (chunks.js AIR_FN), so the two cannot drift again. The history, kept: a
// tree standing in a different air from the ground under it is the most visible fault this look can have, so any
// change there belongs here in the same breath.
// (2026-11-22) It had drifted, under a comment that said the two matched: 1.6 times where the ground has 2.4, and the
// curve's shoulder laid on flat where the ground eases it off as the air's own reach grows. On Earth, whose
// visibility is 185 m, pcHigh is 0 on foot and the two did agree exactly -- which is why it went unseen. Everywhere
// the air reaches past 200 m they did not: measured at 275 m on Mercury (visibility 1400 m, so pcHigh is 1), the
// ground was 0.34 of the way into the air and the plants standing on it 0.17, half as far.
${AIR_FN('pcFogAmountV')}
`;

let _defaultBody = null;
export function defaultBodyUniforms() {
  if (!_defaultBody) _defaultBody = makeBodyUniforms();
  return _defaultBody;
}

function baseUniforms(bodyU, own) {
  ensureGlobals();
  const b = bodyU || defaultBodyUniforms();
  return Object.assign({
    uTime: G.uTime, uNoise3D: G.uNoise3D, uStrokeTex: G.uStrokeTex, uCast: G.uCast, uCastK: G.uCastK, uAirNear: G.uAirNear, uAux8: G.uAux8,
    uSunDirW: b.uSunDirW, uSunDirL: b.uSunDirL, uGlaze: b.uGlaze, uLight: b.uLight, uHaze: b.uHaze, uHazeUp: b.uHazeUp || G.uNoHazeUp, uUpW: b.uUpW || G.uUpW0,
    uFog: b.uFog, uDayness: b.uDayness, uMoon: b.uMoon || G.uMoon0, uStorm: b.uStorm, uHueA: b.uHueA, uHueB: b.uHueB, uBodyR: b.uBodyR, uWx: b.uWx, uRound: b.uRound || G.uRound0, uHeart: b.uHeart || G.uHeart0, uFogBank: b.uFogBank || G.uFogBank0,
    uGroundK: b.uGroundK || G.uGroundK0,
    ...OIL,
  }, own || {});
}

// The uniforms every painted material needs (what FRAG_PARS declares), for materials built
// outside this file: makePaintUniforms(bodyUniforms?, own?) -> uniforms object. Pass the
// body's uniforms (world.bodyUniforms(id)) to be lit and hazed like that body.
export function makePaintUniforms(bodyU, own) { return baseUniforms(bodyU, own); }

// WHAT THE FIRE LEFT, IN A MATERIAL'S PROGRAM (the powers, fire; the record is src/data/burnt.js, the few marks the
// painter holds and how they are chosen are in shared.js BURNPAINT).
// THIS IS THE GUARD THAT KEEPS THE LIVE GAME EXACTLY AS IT IS, and it is one line: a program is compiled with the
// define PC_FIRE only when the powers are switched on (`?powers=1`, which sets MODE.powers in main.js before anything
// is made) AND the oil look is on (`?look=oil`). Without BOTH, no define is set, none of the uniforms is attached, and
// every one of the shaders below is character for character the program it was -- so the watercolour game cannot
// differ by a pixel, with or without the powers flag. Everything of the scorch in the shader text sits inside
// `#ifdef PC_FIRE`.
// `marks`: true for the ground, which needs the list of burnt places; false for the plants, which are told which
// crowns burned by a number of their own instead (PROP_VERT aBurnt) and need only the dials.
function addFire(m, marks) {
  if (!(MODE.powers && LOOK.oil)) return m;
  m.defines = m.defines || {};
  m.defines.PC_FIRE = 1;
  m.uniforms.uBurnK = BURNPAINT.uBurnK;
  // (the light a fire throws on what is near it while it burns: FIREGLOW below. Both halves of a fire -- the black
  // it leaves and the light it gives -- are behind this one guard, so neither can reach the live game.)
  m.uniforms.uFireA = FIREGLOW.uFireA; m.uniforms.uFireK = FIREGLOW.uFireK;
  if (marks) {
    m.defines.PC_BURN_N = BURNPAINT.slots;      // (one number in shared.js sets both the arrays and the shader's loops)
    m.defines.PC_BURN_G = BURNPAINT.groups;
    m.uniforms.uBurnN = BURNPAINT.uBurnN; m.uniforms.uBurnBall = BURNPAINT.uBurnBall;
    m.uniforms.uBurnG = BURNPAINT.uBurnG; m.uniforms.uBurnA = BURNPAINT.uBurnA; m.uniforms.uBurnB = BURNPAINT.uBurnB;
  }
  return m;
}

// WHERE A FIRE IS BURNING NOW, AND THE LIGHT IT THROWS ON WHAT IS NEAR IT (the powers, fire).
// A flame drawn over ground that is left exactly as it was reads as a sticker stuck on the picture: a fire must
// warm what is round it. So the strokes near a fire are laid in its own warm light, and the ground inside the
// burning patch itself is given its coals. It is all of it one more pass over paint that is already being mixed:
// no new draw call, no new texture, nothing worked out for a pixel that is not in the pool.
// WHAT IS HANDED DOWN, and it is two vec4s for the ONE nearest patch that is still alight -- not a list, not a
// light for every patch. A fire is a front of up to sixty-four patches (physics/fire.js FIRE.max) and a warm pool
// round the nearest of them is the picture; a pool round each would be sixty-four distance tests in the ground's
// own program for a difference no one could point at.
// WHOSE AXES. The BODY'S own, exactly as the scorch's marks are (shared.js BURNPAINT) and as `vBody` is: a place
// measured from the eye and tested against vBody would be out by wherever the camera stands, which is kilometres.
// UNTIL SOMETHING CALLS syncFireGlow nothing is lit: uFireK.x stays 0 and every shader below stops on one
// comparison. The world calls it once a frame beside the scorch (see this session's report for the one line).
// (?fireglow=: how strongly a fire's light is laid at all. 1 as chosen; 0 takes it out of the picture altogether,
//  which is how a before-and-after pair of stills is taken -- the same courtesy the scorch has in ?burn=.)
const _fireDial = (() => { try { const q = new URLSearchParams(location.search); return q.has('fireglow') && isFinite(+q.get('fireglow')) ? +q.get('fireglow') : 1; } catch (e) { return 1; } })();
export const FIREGLOW = {
  uFireA: { value: new THREE.Vector4(0, 0, 0, 0) },      // xyz where the fire burns, in the body's own axes; w how far its light carries (m)
  uFireK: { value: new THREE.Vector4(0, 0, _fireDial, 0) },   // x how fiercely (0: nothing alight); y the burning patch's own radius (m), within which the ground has coals; z the dial above
};
// Pick it: the live fire list (physics/fire.js, as the physics hands it over in particles.fires -- or nothing at
// all while nothing burns), the body the eye is on, and the eye in that body's own axes.
// MEASURED in Node on the build machine (not on a device), per frame over four runs: 15 to 55 ns with nothing
// alight, 40 to 70 ns with one campfire, 0.4 to 0.7 microseconds with all sixty-four patches burning (the spread
// is other work sharing the machine). One pass over the list, nothing allocated.
export function syncFireGlow(fires, bodyId, cam) {
  const A = FIREGLOW.uFireA.value, K = FIREGLOW.uFireK.value;
  if (!fires || !fires.count || !bodyId || !cam) { K.x = 0; return; }
  let best = null, bd2 = Infinity, fire = 0;
  for (let i = 0; i < fires.count; i++) {
    const s = fires[i];
    if (s.bodyId !== bodyId || !(s.heat > 0.02)) continue;            // ash gives no light: it is black ground now
    const dx = s.px - cam.x, dy = s.py - cam.y, dz = s.pz - cam.z, d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > 3600) continue;                                          // a fire sixty metres off lights nothing that is in view
    fire += s.heat * s.radius * s.radius;                             // how much fire is alight near the eye (a patch's own square metres, as the physics weighs one)
    if (d2 < bd2) { bd2 = d2; best = s; }
  }
  if (!best) { K.x = 0; return; }
  // how far the light carries: a campfire two metres wide lights the ground about seven metres round it, a whole
  // burning wood about fourteen, and never more than that (a pool wider than the eye can see is no pool at all)
  // AND IT FLICKERS (the owner, 2026-11-22: "change up the fire animation it doesnt feel violent enough"). A fire
  // that lit the ground with a steady lamp was the quietest thing about it: the tongues moved and the light did
  // not. Three beats that do not divide into each other -- a tremble, a swing and a slow surge where the whole
  // fire leaps -- so the pattern does not repeat inside the time anyone watches it. The POOL breathes with it as
  // well as the light, because a fire's reach grows when it leaps. One multiply a frame; nothing in any shader.
  const t = fires.time || 0;
  const flick = 0.86 + 0.10 * Math.sin(t * 17.3) + 0.08 * Math.sin(t * 7.1 + 1.7) + 0.16 * Math.sin(t * 2.3 + 0.6);
  const f01 = flick < 0.3 ? 0.3 : flick > 1.25 ? 1.25 : flick;
  A.set(best.px, best.py, best.pz, Math.min(14, 1.6 + 1.6 * best.radius + 1.2 * Math.sqrt(fire)) * (0.90 + 0.14 * f01));
  K.x = Math.min(1, best.heat * f01);
  K.y = best.radius;
}
// The light itself, in GLSL. The ground, the plants and the near strokes each take a copy of it: the three share no
// chunk of their own, as pcSoot (below, and again in PROP_FRAG) already had to. It needs uDayness and pcDensity,
// which every painted material has (chunks.js FRAG_PARS), and the two uniforms above.
const FIRE_GLOW = /* glsl */`
uniform vec4 uFireA;
uniform vec4 uFireK;
// THE LIGHT OF A FIRE ON ONE STROKE. This is the lantern's pool over again (chunks.js pcLamp) in a fire's own
// paints: it is asked ONCE A STROKE, at the stroke's own centre, taken a little nearer or farther by the stroke's
// own number, so the edge of the warmth is made of whole strokes and is never a circle drawn on the ground.
//   paint  the stroke as the hour, the shade and the lantern have already left it
//   wash   its own colour: the warm paint is mixed FROM it, so a thing keeps its own colour in the firelight
//   body   the stroke's centre in the body's own axes       r  the stroke's own number
// By day a fire warms what is near it only a little; by night it is the light in that place.
vec3 pcFireLit(vec3 paint, vec3 wash, vec3 body, float r) {
  if (uFireK.x * uFireK.z < 0.01) return paint;                       // nothing alight (or ?fireglow=0): one comparison and out
  // and out again on one ball for every stroke that is not within reach of the fire, which while a wood burns is
  // nearly every stroke in the picture (the same first test the scorch makes, pcBurntAt above)
  vec3 q = body - uFireA.xyz;
  float lim = uFireA.w + 0.4;                                         // (0.4: the most a stroke's own number moves it below)
  if (dot(q, q) > lim * lim) return paint;
  float d = length(q) + (r - 0.5) * 0.7;
  float k = uFireK.x * uFireK.z * (1.0 - smoothstep(uFireA.w * 0.30, uFireA.w, d)) * mix(0.34, 1.0, 1.0 - uDayness);
  // THE COALS: inside the burning patch itself the ground is a bed of embers, about half its strokes glowing and
  // the rest a deep red char, so the foot of a flame is hot paint and not a black disc with flames stuck on it.
  float cr = max(uFireK.y, 0.25);
  float coal = (1.0 - smoothstep(cr * 0.45, cr * 1.05, d)) * uFireK.x * uFireK.z;
  if (k < 0.004 && coal < 0.004) return paint;
  float wl = dot(wash, vec3(0.3, 0.5, 0.2));
  // the warm paint: the stroke's own colour laid heavier, swung well over to orange and lifted at its light end.
  // Hotter and redder than the lantern's cream, and never a pure orange: everything keeps its own colour in it.
  vec3 warm = min(pcDensity(wash, 1.2) * vec3(1.62, 0.98, 0.52) + vec3(0.10, 0.035, 0.0) * (0.5 + wl), vec3(1.0));
  warm *= 0.90 + 0.17 * fract(r * 9.13);                              // no two strokes in the pool exactly alike
  float kk = clamp(k * 1.12 + (fract(r * 3.71) - 0.5) * 0.22, 0.0, 1.0);
  vec3 lit = mix(paint, warm, kk * kk * (3.0 - 2.0 * kk) * 0.92);
  if (coal > 0.004) {
    float g = fract(r * 17.31);
    lit = mix(lit, mix(vec3(0.30, 0.07, 0.05), vec3(1.0, 0.44, 0.10), smoothstep(0.42, 0.94, g)), coal * step(0.22, g) * 0.92);
  }
  return lit;
}
`;

// ------------------------------------------------------------------------------------------
// Terrain
// ------------------------------------------------------------------------------------------
const TERRAIN_VERT = /* glsl */`
${VERT_PARS}
attribute vec3 aMorph;
attribute vec4 aColor;
attribute vec4 aColor2;
attribute vec4 aParams;
attribute vec4 aColorP;   // the same vertex as the parent patch paints it (washes, parameters, normal): a patch
attribute vec4 aColor2P;  // that has just taken over from its parent shows exactly what the parent showed
attribute vec4 aParamsP;  // and slides to its own look, so the ground never changes in one frame
attribute vec3 aNormalP;
uniform vec3 uOrigin;     // patch origin, body-local metres
uniform vec3 uAnchor;     // patch origin modulo the stroke tile period
uniform vec3 uCamLocal;   // camera relative to the patch origin, body-local axes
uniform vec3 uMorph;      // xy: distance range over which this level morphs to its parent; z: how much of the parent's look it still wears (it took over a moment ago)
varying vec3 vBody;
varying vec3 vAnch;
varying vec3 vNV;
varying vec3 vNL;
varying vec3 vView;
varying vec4 vCol;
varying vec3 vCol2;
varying vec4 vPar;
varying vec3 vUpV;
#ifdef PC_OIL
varying vec3 vRel;        // the place measured from the eye, in the body's axes: small numbers, so its screen derivatives are exact (chunks.js pcGroundChartD)
#endif
${CANOPY_VERT_DECL}
${FARWATER_VERT_DECL}
${SEASON_VERT}
${BLOOM_VERT_DECL}
void main() {
  float d = distance(position, uCamLocal);
  float m = max(clamp((d - uMorph.x) / (uMorph.y - uMorph.x), 0.0, 1.0), uMorph.z);
  vec3 p = position + aMorph * m;
  vBody = p + uOrigin;
  #ifdef PC_OIL
    vRel = p - uCamLocal;
  #endif
  vAnch = p + uAnchor;
  vec3 nrm = normalize(normal + aNormalP * m);
  vNL = nrm;
  vNV = normalMatrix * nrm;
  vUpV = normalMatrix * normalize(vBody);
  vec4 mv = modelViewMatrix * vec4(p + pcRound(vBody), 1.0);
  vView = mv.xyz;
  vCol = mix(aColor, aColorP, m); vCol2 = mix(aColor2.rgb, aColor2P.rgb, m); vPar = mix(aParams, aParamsP, m);
${CANOPY_VERT_MAIN}
${FARWATER_VERT_MAIN}
${SEASON_VERT_MAIN}
${BLOOM_VERT_MAIN}
  gl_Position = projectionMatrix * mv;
  ${VERT_END}
}
`;

const TERRAIN_FRAG = /* glsl */`
${FRAG_PARS}
varying vec3 vBody;
varying vec3 vAnch;
varying vec3 vNV;
varying vec3 vNL;
varying vec3 vView;
varying vec4 vCol;
varying vec3 vCol2;
uniform vec3 uHueA;
uniform vec3 uHueB;
uniform float uBodyR;
varying vec4 vPar;
varying vec3 vUpV;
// PHYSICS' push field (what has been trodden or blown flat): the ground shows the track
${FLORA_GLSL}
uniform float uPhysOn;
uniform vec2 uRound;      // x: how far from the ground the eye is, as the relief is drawn in (0 on the ground .. 0.75 from orbit)
uniform vec4 uHeart;      // a great pale marking seen from orbit: xyz its place, w its size (0: none)
#ifdef PC_OIL
// THE GROUND IN THE OIL LOOK (chunks.js: "the oil look's strokes", "dabs"). Leaf dabs lying every way, as the clip's
// forest floor (the owner's style 5): the ground's own colour under two layers of them, an octave apart. A dab's paint
// is worked out at its own centre (the ground's washes there, the light, the leaf shadow) and laid flat, and under
// trees a share of the dabs take the canopy's colour: the leaves that have fallen.
// (Tried at checkpoint 1 and dropped by the owner's choice: thin strokes along the land, tiles; in the history.)
// (Not carried over from the watercolour yet: strata, cracks, puddles, the trodden track, a world's great marking.)
varying vec3 vRel;
vec3 gBdx, gBdy, gC2dx, gC2dy, gNvdx, gNvdy, gNldx, gNldy, gSunV, gBc;
vec3 gMark;      // (the powers, fire) what the fire has done where this stroke lies: see pcMarksAt below
vec3 gCtrB;       // a dab's own place on the body (set before pcGroundAt; x > 1e20: none, the place is carried from the pixel)
vec4 gCdx, gCdy, gPdx, gPdy;
float gMid;
// gVar: how much of a DAB'S OWN variety the floor keeps here -- its two pigments and its carpet of fallen leaves.
// It is gMid (raw distance) everywhere but under the leaf dabs, where it is the mark's own width in pixels instead:
// see where it is set in main, and ?floorvar=.
float gVar;
${PC_UP_F}
#ifdef PC_FIRE
// WHERE THE FIRE HAS BEEN (the powers, fire; the record is src/data/burnt.js, and shared.js BURNPAINT says which few
// of its marks are handed down here and why). A mark is a CAPSULE -- the line the fire crept along, as wide as its
// flame was -- and it is held as:
//   uBurnA[i]   xyz the middle of that line, IN THE BODY'S OWN AXES    w how far to the side the fire reached (m)
//   uBurnB[i]   xyz from that middle to one end of the line (m)        w how black it went (0 .. 1)
//   uBurnG[g]   a ball round each four of marks, xyz its middle, w its radius;  uBurnBall: one round the whole lot
// THE PLACES ARE THE BODY'S OWN, not the eye's, and they are compared against vBody, which is the body's own too
// (TERRAIN_VERT above). A middle measured from the eye, tested against vBody, would be out by wherever the camera
// stands -- kilometres -- and every burn would land nowhere near the fire that made it. A world is only kilometres
// across, so a metre held this way is good to a fraction of a millimetre: far finer than a brush stroke.
uniform vec4 uBurnK;
uniform float uBurnN;
uniform vec4 uBurnBall;
uniform vec4 uBurnG[PC_BURN_G];
uniform vec4 uBurnA[PC_BURN_N];
uniform vec4 uBurnB[PC_BURN_N];
// How burnt the ground is at a place: 0 clean, 1 burnt right out. Blackest along the middle of a mark and fading to
// nothing at its rim, which is the SAME reading the record itself gives (data/burnt.js fade; uBurnK.y is that file's
// own BURN.core, handed down so the two cannot drift), so what is painted and what the play code believes about a
// patch of ground are one thing.
// What it costs: with nothing burnt (or the scorch turned off), one comparison. On clean ground, one ball. Standing
// in a burn, that ball, the fours' own balls, and the four capsules of each four whose ball the place falls inside:
// MEASURED over a fire that had run three hundred metres, 2.7 capsule tests a place and 8 at worst, of 32 held.
// WHAT THE FIRE HAS DONE TO THE GROUND AT A PLACE, all three in one walk:
//     x  how burnt it is: 0 clean, 1 burnt right out
//     y  how far ICE HAS MELTED OFF IT and the ground under shows: 0 still covered, 1 bare
//     z  how deep a MELTED WELL goes where there was nothing under the ice: 0 none, 1 as deep as it is painted
// A MELT RIDES IN THE SAME ARRAYS AS A SCORCH (the owner, 2026-11-19: "give the ice planets more places to melt").
// It is the same shape of mark -- a capsule, the line the flame crept along, as wide as it reached -- so it needs no
// arrays and no uniforms of its own, and the ground's program is not one instruction dearer for the melting worlds
// than it already was for the burning ones. The two are told apart by THE SIGN of uBurnB[i].w, which for a scorch
// is how black it went:
//        w  >  0      a scorch, and w is its charcoal, 0 .. 1
//   -1 <= w <  0      a melt with ground under the ice: -w is how far that ground is laid bare, 0 .. 1
//        w <= -2      a melt with nothing under the ice: -(w + 2) is how deep the well has gone, 0 .. 1
// (render/shared.js syncBurnt writes that; this is the only other place that knows the encoding, and the two sit
//  under each other's names so they cannot drift.)
vec3 pcMarksAt(vec3 P) {
  if (uBurnN < 0.5 || uBurnK.x <= 0.0) return vec3(0.0);        // nothing has burned, or ?burn=0: one comparison and out
  vec3 q = P - uBurnBall.xyz;
  if (dot(q, q) > uBurnBall.w * uBurnBall.w) return vec3(0.0);  // nowhere near any mark: one ball and out
  vec3 most = vec3(0.0);
  for (int g = 0; g < PC_BURN_G; g++) {
    if (float(g) * 4.0 >= uBurnN) break;
    vec4 ball = uBurnG[g];
    vec3 qg = P - ball.xyz;
    if (dot(qg, qg) > ball.w * ball.w) continue;                // this four of marks is too far off: all four skipped
    for (int k = 0; k < 4; k++) {
      int i = g * 4 + k;
      if (float(i) >= uBurnN) break;
      vec4 A = uBurnA[i], B = uBurnB[i];
      vec3 a = P - A.xyz;
      // how far the place is from the mark's line: along the line where it lies beside it, and from the nearer end
      // where it lies past one. (A mark the fire never crept out of has both ends in one place: hh is then 0, the
      // clamp holds t at 0, and this is the plain distance to that place -- a circle, with no branch needed.)
      float hh = dot(B.xyz, B.xyz);
      float t = clamp(dot(a, B.xyz), -hh, hh) / max(hh, 1e-8);
      vec3 off = a - B.xyz * t;
      float d2 = dot(off, off), r = A.w;
      if (d2 >= r * r) continue;
      // the same fade from the core out to the rim for all three: it is the record's own (data/burnt.js fade)
      float f = 1.0 - smoothstep(r * uBurnK.y, r, sqrt(d2));
      float bw = B.w;
      if (bw > 0.0) most.x = max(most.x, bw * f);
      else if (bw > -1.5) most.y = max(most.y, -bw * f);
      else most.z = max(most.z, (-bw - 2.0) * f);
    }
  }
  return most * uBurnK.x;      // (uBurnK.x is 1 as chosen, so this IS the record's own reading; ?burn= turns it down)
}
// How burnt the ground is at a place, which is all most of the picture wants of the three above.
float pcBurntAt(vec3 P) { return pcMarksAt(P).x; }
// How much of the black ONE STROKE takes: the whole of it, or none, by the stroke's own number against how burnt the
// place it lies on is. That is what makes the rim of a burn a scatter of black strokes among unburnt ones -- ragged,
// as a fire really leaves it -- and not a drawn circle with a soft edge. In the middle of a mark every stroke takes it.
float pcCharTake(vec3 rnd, float burnt) { return smoothstep(-0.10, 0.10, burnt - fract(rnd.z * 4.7) * 0.9); }
// THE SCORCH, AS BLACK PAINT LAID OVER THE GROUND AND NOT AS A STAIN UNDER IT. The stroke's own paint is taken to a
// cold charcoal AT ITS OWN VALUE: the light of the place is kept, so a burn in the sun is not the same black as one in
// the shade and the land is still modelled through it, while the colour is taken out of it. The stroke stays a stroke
// -- it keeps its own weight and its own stray of value -- which is what makes a burnt patch read as paint laid on.
// A stroke here and there is the pale grey of ash, three times its neighbours' value: without them a big burn reads
// as a hole cut in the picture rather than as ground. Nothing goes to flat black; the look does not allow one.
vec3 pcSoot(vec3 paint, float stray, float ash) {
  float v = dot(paint, vec3(0.3, 0.5, 0.2));
  vec3 s = vec3(v) * vec3(0.88, 0.88, 1.12) * (0.20 + 0.16 * stray);
  s = mix(s, min(s * 3.2, vec3(0.52, 0.50, 0.50)), step(0.88, fract(ash * 7.1)));
  return clamp(s * uBurnK.w, 0.0, 1.0);
}
${FIRE_GLOW}
#endif
${CANOPY_FRAG}
${SEASON_FRAG}
${ROCK_FRAG}
${BLOOM_FRAG}
${FARWATER_FRAG}
// The ground where a stroke lies (ds: the pixels from here to its centre; w: its width, m): its wash, the light's
// level, the snow's cover, the canopy's colour and its cover there.
void pcGroundAt(vec2 ds, float w, vec3 rnd, out vec3 c, out float lvl, out float snowC, out vec3 leaf, out float canopy) {
  vec3 Bc = gCtrB.x > 1e20 ? vBody + gBdx * ds.x + gBdy * ds.y : gCtrB;
  // (the ground's washes and the way it faces are carried toward the stroke's centre by at most two dozen pixels: a
  // long stroke's centre can lie hundreds of pixels off, and on a mountain side, where both change from facet to
  // facet, what was carried that far was nonsense: strokes of cyan, black and white on Pluto's lilac mountains, the
  // survey of the worlds)
  vec2 dsA = ds * min(1.0, 24.0 / max(length(ds), 1e-3));
  #ifdef PC_ROCKF
    if (gFaceD > 0.5) dsA = vec2(0.0);      // (a dab of an upright chart takes the pixel's own washes and facing: carried, they jumped at every facet of a staircase wall, render/farground.js gFaceK)
  #endif
  vec4 colC = clamp(vCol + gCdx * dsA.x + gCdy * dsA.y, 0.0, 1.0);
  vec3 col2C = clamp(vCol2 + gC2dx * dsA.x + gC2dy * dsA.y, 0.0, 1.0);
  vec4 parC = vPar + gPdx * dsA.x + gPdy * dsA.y;
  vec3 nVc = normalize(vNV + gNvdx * dsA.x + gNvdy * dsA.y), nLc = normalize(vNL + gNldx * dsA.x + gNldy * dsA.y);
  #ifdef PC_ROCKF
    if (gFaceD > 0.5) nVc = gFaceNV;        // (a dab of an upright chart is lit as a plane along the strike, render/farground.js pcFaceLight)
  #endif
  c = mix(col2C, colC.rgb, gMid);                  // (far away the forest floor is its canopy)
  // (the lighter paint looks up no noise for a dab: its hue and weight vary by the dab's own numbers alone, pcGroundPaint)
  vec4 n1 = vec4(0.5), n2 = vec4(0.5);
  if (uOilL.x < 0.5) { n1 = pcNoiseS(Bc, 31.0, w); n2 = pcNoiseS(Bc + 0.21 * 6.3, 6.3, w); }
  c = mix(c, c * uHueA, smoothstep(0.50, 0.72, n1.b) * 0.8);
  // (the second pigment's patches are kept by the MARK'S size, not by the distance: gVar, set in main. It was gMid,
  // which fades from 120 m out -- but gMid is near 1 everywhere this 6.3 m field still has a swing to give (at 275 m
  // the dab's own footprint is 4.5 m and the lookup has averaged the field to its mean), so this changes little by
  // itself: what carries the far floor's two pigments is the dab's own number in pcGroundPaint, which never faded.)
  c = mix(c, c * uHueB, smoothstep(0.52, 0.74, n2.r) * 0.6 * gVar);
  c = pcDensity(c, 1.0 + (n1.r - 0.5) * 0.5 * uOilB.z);
  // WHICH WAY THIS DAB FACES THE SKY (chunks.js pcUp: the sky's fill in a shade, and the warm bounce off the ground
  // on what faces down). It is the ground's own normal against up AT THE DAB'S CENTRE -- the very number the snow's
  // cover is already taken from, so it costs nothing -- and being the dab's and not the pixel's, a dab is lit whole,
  // as everything else here is.
  float upN = dot(nLc, normalize(Bc));
  #ifdef PC_ROCKF
    if (gFaceD > 0.5) upN = gFaceP.x;
    c = pcRockWash(c, upN, Bc, 1.0 - colC.a, length(vView), rnd, w);      // (the far view, FV4: a rock face in its own value and beds, a cliff in the world's rock, render/farground.js)
    parC.z *= 1.0 - gRock;      // (no leaf shadow on a rock face: its pattern is laid flat and ran down a cliff in dark blocks, SEEN)
  #endif
  ${SKYUP('upN')}
  snowC = pcSnowCover(upN, rnd.z * 0.5 + n2.b * 0.3 + n1.a * 0.2, parC.z);
  #ifdef PC_FIRE
    // WHERE THE ICE HAS BEEN MELTED (the owner, 2026-11-19), asked once here at the stroke's own centre and used
    // twice: here, where the snow and the ice give way, and in pcGroundPaint, where the charcoal is laid. Melting
    // was recorded and SAVED since 2026-11-18 and never painted at all, so on the three ice worlds a cast melted a
    // hole nobody could see; this is the other half the comment in pcGroundPaint promised.
    //   The ice goes: the snow's cover goes with it (snowC), and the wash itself is taken DEEPER -- the same hue, a
    // wet dark of it -- which is what also stops pcFlowPaint painting ice strokes over the hole, because that
    // decides by how pale the wash is. A well with nothing under it goes deeper still and turns toward the cold
    // blue of a crevasse. Both are whole strokes, so the edge of a melted place is ragged by strokes as a burn's is.
    gMark = pcMarksAt(Bc);
    float gone = max(gMark.y, gMark.z);
    if (gone > 0.0) {
      snowC *= 1.0 - gone;
      c = mix(c, pcDensity(c, 1.0 + 1.6 * gone), gone);
      // (the square root: a hole two metres into a glacier is already a hole. Straight depth made a two-metre well
      //  a grey smudge that read as the shadow of a cloud -- seen, Pluto's Pale Heart Glacier, before this.)
      c = mix(c, vec3(0.07, 0.13, 0.22), sqrt(gMark.z) * 0.72);
    }
  #else
    gMark = vec3(0.0);
  #endif
  // the light, a stroke at a time: in the sun or in the leaf shadow whole
  float x = dot(nVc, gSunV) * 0.5 + 0.5;
  float sunny = min(pcSunAtSoft(Bc, parC.z * mix(0.82, 1.0, gMid), 8.0, w, fract(rnd.y * 5.7)), 1.0 - pcCast(Bc, (rnd.x - 0.5) * 0.3));
  lvl = pcLevel(mix(min(x, 0.44) - 0.10 * parC.z, x + (rnd.z - 0.5) * 0.10, sunny), 0.03);
  #ifdef PC_ROCKF
    lvl = pcRockPlanes(lvl, nVc, sunny);        // (a rock face lit in three planes by its slope's own facing, a gully in shade deeper: render/farground.js)
  #endif
  #ifdef PC_FIRE
    // AND A HOLE IS IN ITS OWN SHADOW. Nothing else in the picture tells the eye that a dark patch on flat ground
    // is a hole and not a stain; the light going out of it, as it does down a well, is what makes it one.
    lvl -= sqrt(gMark.z) * 0.95 + gMark.y * 0.35;
  #endif
  #ifdef PC_CANOPY
    // (the far view: is this dab a crown of the wood's roof seen from above, render/farground.js; asked at the dab's own
    // centre with the stand and the needle share carried there, the floor's own wash and the land's own light)
    pcCanopyAt(Bc, gCtrCh, clamp(vFarS + gSdx * dsA.x + gSdy * dsA.y, 0.0, 1.0), clamp(parC.w, 0.0, 1.0), colC.rgb, x, w, rnd, false);
    #ifdef PC_FIRE
      if (gMark.x > 0.3) gCan = 0.0;      // (no crown stands where the fire has been)
    #endif
  #endif
  #ifdef PC_BLOOMF
    pcBloomAt(dsA, rnd);                     // (the far view, FV6(b): is this dab a flower of a drift, render/farground.js)
    #ifdef PC_CANOPY
      if (gCan > 0.5) gBloom = 0.0;
    #endif
    #ifdef PC_ROCKF
      if (gRock > 0.0) gBloom = 0.0;
    #endif
    if (snowC > 0.5) gBloom = 0.0;
  #endif
  leaf = pcDensity(col2C, 1.15);
  #ifdef PC_SEASONG
    leaf = pcSeasonLeaf(leaf, colC.rgb);     // (in summer a fallen leaf is last year's, brown)
  #endif
  canopy = parC.z;
  gBc = Bc;
}
// One stroke's paint from that: its own colour (a fallen leaf's, for the share fk of the strokes), the snow, the light.
vec3 pcGroundPaint(vec3 c, vec3 leaf, float fk, vec3 rnd, float snowC, float lvl) {
  #ifdef PC_ROCKDEBUG
    // (?rockdebug=1, for looking only: a dab of an upright chart red (a cliff's rock) or orange; a dab of the ground's
    // chart on steep land blue (rock) or cyan)
    if (uRockDbg > 3.5 && gFaceD > 0.5) { float hq = (length(gBc) - uBodyR) / 5.5; float fq = fract(hq); return fq < 0.11 ? vec3(0.0) : fq > 0.88 ? vec3(1.0) : mod(floor(hq), 2.0) < 0.5 ? vec3(1.0, 0.3, 0.2) : vec3(0.2, 0.4, 1.0); }
    if (uRockDbg > 1.5 && uRockDbg < 3.5) { float uq = dot(normalize(vNL), normalize(vBody)); vec3 nF = normalize(cross(gBdx, gBdy)); float uf = abs(dot(nF, normalize(vBody))); float q = uRockDbg > 2.5 ? uf : uq; return q < 0.3 ? vec3(0.5, 0.0, 0.0) : q < 0.5 ? vec3(1.0, 0.1, 0.1) : q < 0.64 ? vec3(1.0, 0.6, 0.1) : q < 0.8 ? vec3(1.0, 1.0, 0.2) : q < 0.86 ? vec3(0.2, 0.9, 0.2) : vec3(0.3); }
    if (gFaceOn > 0.5) return (gFaceD > 0.5 ? (gCliff > 0.5 ? vec3(1.0, 0.15, 0.1) : vec3(1.0, 0.7, 0.1)) : (gCliff > 0.5 ? vec3(0.1, 0.25, 1.0) : vec3(0.1, 0.9, 1.0))) * (0.55 + 0.45 * rnd.x);
  #endif
  #ifdef PC_CANOPY
    // (a dab of the painted canopy: the crown's own wash in the crown's own light, one flat colour, render/farground.js)
    if (gCan > 0.5) return pcTone(pcDabTint(gCanC, rnd, gCanLf), gCanL);
  #endif
  #ifdef PC_BLOOMF
    if (gBloom > 0.5) return pcTone(pcDabTint(gBloomC, rnd, 0.2), lvl);      // (a flower of a drift, whole, in its own light: render/farground.js)
  #endif
  float f = step(1.0 - fk, fract(rnd.z * 13.7));
  // (bare ground and grass, where no leaf has fallen: a dab is the ground's colour or one of its two neighbouring
  // pigments, and a share of the dabs are laid a step deeper; lit grass all of one colour was a flat lemon patch,
  // in a clearing and from the air: the stills after overhauls 3 to 5)
  float gq = fract(rnd.y * 23.3);
  vec3 cg = gq > 0.72 ? c * uHueA : gq < 0.24 ? c * uHueB : c;
  #ifdef PC_ROCKF
    // (the far view, FV4: on a rock face no dab is laid a step darker by its own number, and its pigment and stray
    // are halved, so the face reads in lit and shaded planes by its own facing, render/farground.js)
    // (SNOW IS ONE PAINT: on the snowy wash, the land's own white, no dab takes a neighbouring pigment or the warm and cool
    // stray, and none is laid a step deeper: on near-white each of those read as its own pale green, peach or lilac leaf,
    // the pastel confetti on the lit snowy ridges, SEEN by the look director at the alpine meadow from 420 m. The snow keeps
    // its light and its shade, in bigger patches by the land's own snow.)
    // (snow: light and nearly without hue, so a pale cream sand or meadow keeps its pigments)
    float snW = smoothstep(0.80, 0.90, min(min(c.r, c.g), c.b)) * (1.0 - smoothstep(0.08, 0.16, max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b)));
    cg = mix(cg, c, max(max(0.5 * gRock, gCliff), snW));      // (a cliff's dab keeps its bed's tone: no stray pigment)
    lvl -= (1.0 - f) * step(0.58, fract(rnd.x * 11.1)) * 0.9 * step(1.5, lvl) * (1.0 - gRock) * (1.0 - snW);
    // (but each snow dab keeps a value step of its own, a little lighter or darker by its number, no hue: laid as one flat
    // paint the brightest lit snow ran as a smooth ramp, a fifth of its steps 0.005 to 0.03 of lightness, faintly a glow;
    // the look director by R3.7: light in steps with clean edges, white laid in flat touches)
    lvl += (floor(fract(rnd.x * 7.3) * 3.0) - 1.0) * 0.22 * snW;
    vec3 k = pcDabTint(mix(cg, leaf, f), mix(rnd, vec3(0.5), max(0.5 * gRock, snW)), f);
  #else
  lvl -= (1.0 - f) * step(0.58, fract(rnd.x * 11.1)) * 0.9 * step(1.5, lvl);
  vec3 k = pcDabTint(mix(cg, leaf, f), rnd, f);
  #endif
  k = mix(pcWetWash(k, 1.0 - snowC), mix(vec3(0.94, 0.955, 1.0), vec3(0.86, 0.90, 1.0), rnd.x * 0.6), snowC);
  #ifdef PC_ROCKF
    // (the land's snow laid in two flat paints, white or a pale blue by the dab's number: the wash under it drifts a little
    // from point to point, and dab to dab that drift was the smooth ramp the look director measured on the lit snow)
    k = mix(k, step(0.6, fract(rnd.x * 3.7)) > 0.5 ? vec3(0.88, 0.91, 1.0) : vec3(0.95, 0.96, 1.0), snW);
    k = mix(pcRockTemp(k), k, snowC);       // (a rock face warm in its lit plane, cool violet in its shade: render/farground.js)
  #endif
  // (GRASS in the shade is a deep green, its own colour laid heavier with half the cool key over it, as a leaf's shade
  // is; under the key whole a shaded meadow was a violet-brown floor: the owner's references of 2026-11-16 have the
  // shade on grass blue-green. Only where the stroke's wash is green; earth, litter, rock and snow shade as they did.)
  vec3 tn = pcTone(k, lvl);
  float grn = smoothstep(0.02, 0.10, k.g - max(k.r, k.b)) * (1.0 - snowC);
  if (grn > 0.0) tn = mix(tn, mix(pcShadeLeaf(k), tn, smoothstep(1.2, 2.0, lvl)), grn);
  #ifdef PC_FIRE
    // (the powers, fire) WHERE THE FIRE PASSED, THIS STROKE IS LAID IN CHARCOAL instead of its own colour. It is asked
    // at the STROKE'S OWN CENTRE (gBc, which is where this stroke's paint is worked out anyway), so the edge of a burn
    // follows the strokes and is ragged by whole strokes, never a circle drawn on the ground.
    // Snow and ice do not char: where there is snow the fire melts instead, which is the record's other half.
    float burnt = gMark.x * (1.0 - snowC);          // (read once in pcGroundAt, at this same stroke's centre)
    if (burnt > 0.001) {
      float take = pcCharTake(rnd, burnt) * (1.0 - uBurnK.z);     // (uBurnK.z: a breath of what burned is left under the black)
      vec3 soot = pcSoot(tn, rnd.x, rnd.y);
      tn = mix(tn, soot, take);
      k = mix(k, soot, take);                                     // (so the lantern lights the charcoal, not the green that was there)
    }
  #endif
  vec3 lamp = pcLamp(tn, k, gBc, rnd.y);
  #ifdef PC_FIRE
    // (the powers, fire) AND A FIRE'S OWN LIGHT OVER THE TOP OF THAT, which is nearer and warmer than any lantern:
    // the ground round a fire takes its warmth and the ground inside the flames is coals. Asked at the stroke's own
    // centre, as everything else here is, so the pool is made of whole strokes.
    lamp = pcFireLit(lamp, k, gBc, rnd.y);
  #endif
  return lamp;
}
// SNOW AND ICE (the owner, 2026-11-16, in three steps: "I also dont like how Bright the snow area is why is the snow
// colorful fix it and shade it the color of ice and snow"; then strokes as paint laid on, with ridges, which the owner
// read as tiles; then, with two pictures of snow, a watercolour and a pastel: "make the snow lines thinner and more
// frequent and get rid of the deep ridges between them it looks like tiles make it closer to this photo"). So: snow
// is SMOOTH. Many thin strokes lying close, each one flat colour with a clean edge, each differing only a little from
// the next, with NO ridge and no dark line between them; the shading runs slowly from drift to drift (dr: a slow field
// read at the stroke's centre), pale where the light lies and a soft blue in the hollows and the shadows. The colours
// are those of ice and snow only: one ramp, picked by the stroke's value: a deep blue leaning a little to violet, a
// slate blue, a pale blue, a blue-white. A stroke strays only a hair toward lavender or toward mint, never toward a
// warm colour: made to stray warm and cool as a floor of leaves is, near-white snow was a pastel confetti.
vec3 pcIce(vec3 t, vec3 rnd, float dr) {
  // (how far a stroke differs from the next: between the clip's snow, whose strokes stand clearly apart, and the
  // pictures', which is nearly smooth: the owner, after the pictures: "but still use the reference video as well". And
  // by night the clip's slate blue with paler strokes lying in it, not the pictures' pale sheet.)
  float l = min(dot(t, vec3(0.3, 0.5, 0.2)), 1.0) * mix(0.55, 0.72, uDayness) + (rnd.x - 0.5) * 0.17 + 0.13 * step(0.86, rnd.z) + 0.28 * dr;
  const vec3 deep = vec3(0.19, 0.22, 0.40), slate = vec3(0.42, 0.50, 0.68), pale = vec3(0.72, 0.80, 0.90), white = vec3(0.92, 0.95, 0.98);
  vec3 c = l < 0.34 ? mix(deep, slate, clamp(l / 0.34, 0.0, 1.0)) : l < 0.68 ? mix(slate, pale, (l - 0.34) / 0.34) : mix(pale, white, clamp((l - 0.68) / 0.30, 0.0, 1.0));
  float q = fract(rnd.y * 5.3);
  return c * (q > 0.84 ? vec3(1.02, 0.985, 1.025) : q < 0.16 ? vec3(0.975, 1.015, 1.0) : vec3(1.0));
}
// One long stroke's paint on a world laid in them: the ground's own, or, on a world of snow (uGroundK.z) where the
// ground's wash is pale, snow's.
vec3 pcFlowPaint(vec3 c, vec3 leaf, vec3 rnd, float snowC, float lvl) {
  vec3 p = pcGroundPaint(c, leaf, 0.0, rnd, snowC, lvl);
  if (uGroundK.z < 0.5) return p;
  float sn = smoothstep(0.60, 0.78, dot(c, vec3(0.3, 0.5, 0.2)));
  if (sn < 0.004) return p;
  vec3 k = pcDensity(c, 1.0 + (rnd.x - 0.5) * 0.4);
  // (the drifts: a slow field and a quicker one, read at the stroke's own centre)
  float dr = textureLod(uNoise3D, gBc / 34.0 + 0.41, 0.0).g * 0.7 + textureLod(uNoise3D, gBc / 11.0 + 0.17, 0.0).b * 0.3 - 0.5;
  vec3 sl = pcLamp(pcIce(pcTone(k, lvl), rnd, dr), k, gBc, rnd.y);
  #ifdef PC_FIRE
    sl = pcFireLit(sl, k, gBc, rnd.y);      // (the powers, fire: snow near a fire is lit by it, warm against its own blue)
  #endif
  return mix(p, sl, sn);
}
// SNOW'S STROKES, EACH IN ITS EXACT PLACE. A stroke of snow is lit, shaded and lamp-lit WHOLE: so all its pixels must
// agree to the millimetre on where its centre is.
// The strokes' chart is bent into slow swirls by a noise; found from each pixel by the chart's screen derivatives, a
// stroke's centre came out differently from pixel to pixel (worst near the eye, where a pixel is a fiftieth of a
// texel of that noise and the texture's own filtering moves in steps: its derivative there is noise), and the edge
// of the lantern's pool, of a shadow, of the change from one octave to the next was a stipple of dots: the first stills
// of snow as paint laid on. So here the bend is read exactly (eight texels, a smooth weight, its slope known from
// the same eight), the chart is the plain chart of the sphere (no height in it), and the centre is found by two steps
// of Newton's rule from the pixel: its place on the chart, then on the body.
#define PC_SNOW_K 830.0      // the swirl's measure: the bend's noise repeats every this many stroke widths (about twenty-six metres on the ground)
void pcBend8(vec3 q, out vec2 wn, out vec2 gx, out vec2 gy, out vec2 gz) {
  vec3 t = q * 64.0 - 0.5, i = floor(t), f = t - i;
  vec3 u = f * f * (3.0 - 2.0 * f), du = 6.0 * f * (1.0 - f);
  ivec3 a = ivec3(mod(i, 64.0)), b = ivec3(mod(i + 1.0, 64.0));
  vec2 c000 = texelFetch(uNoise3D, ivec3(a.x, a.y, a.z), 0).rg, c100 = texelFetch(uNoise3D, ivec3(b.x, a.y, a.z), 0).rg;
  vec2 c010 = texelFetch(uNoise3D, ivec3(a.x, b.y, a.z), 0).rg, c110 = texelFetch(uNoise3D, ivec3(b.x, b.y, a.z), 0).rg;
  vec2 c001 = texelFetch(uNoise3D, ivec3(a.x, a.y, b.z), 0).rg, c101 = texelFetch(uNoise3D, ivec3(b.x, a.y, b.z), 0).rg;
  vec2 c011 = texelFetch(uNoise3D, ivec3(a.x, b.y, b.z), 0).rg, c111 = texelFetch(uNoise3D, ivec3(b.x, b.y, b.z), 0).rg;
  vec2 x00 = mix(c000, c100, u.x), x10 = mix(c010, c110, u.x), x01 = mix(c001, c101, u.x), x11 = mix(c011, c111, u.x);
  vec2 y0 = mix(x00, x10, u.y), y1 = mix(x01, x11, u.y);
  wn = mix(y0, y1, u.z);
  gx = mix(mix(c100 - c000, c110 - c010, u.y), mix(c101 - c001, c111 - c011, u.y), u.z) * du.x;
  gy = mix(x10 - x00, x11 - x01, u.z) * du.y;
  gz = (y1 - y0) * du.z;
}
// where the chart point c lies among the strokes of width w (A: how far the swirl bends the chart, in stroke widths)
vec2 pcSnowP(vec2 c, float w, float A) {
  vec2 wn, gx, gy, gz;
  pcBend8(pcGroundUnchart(vBody, c, uBodyR) * (uBodyR / (w * PC_SNOW_K)) + 0.19, wn, gx, gy, gz);
  return c / w + (wn - 0.5) * A;
}
// One layer. ch: the pixel's chart; dlx, dly: its screen derivatives; hB, hD: the land's height at the pixel and its
// screen derivatives. Out as pcThinLayerUV's, and ctrB: the stroke's centre on the body.
void pcSnowLayer(vec2 ch, vec2 dlx, vec2 dly, float w, float asp, float A, float rag, float lim, float hB, vec2 hD,
                 out vec3 rnd, out vec2 ds, out float own, out vec3 rndN, out vec2 uv, out float pxW, out vec3 ctrB) {
  float sc = uBodyR / (w * PC_SNOW_K);
  vec3 sdir = pcGroundUnchart(vBody, ch, uBodyR);
  vec2 wn, gx, gy, gz;
  pcBend8(sdir * sc + 0.19, wn, gx, gy, gz);
  vec2 p = ch / w + (wn - 0.5) * A;
  // (how the noise's place moves for a pixel along the screen, in texels: the land's own derivative laid on the sphere)
  float kT = uBodyR / length(vBody) * 64.0 / (w * PC_SNOW_K);      // (texels of the noise to a metre on the sphere)
  vec3 tx = (gBdx - sdir * dot(sdir, gBdx)) * kT, ty = (gBdy - sdir * dot(sdir, gBdy)) * kT;
  vec2 dpx = dlx / w + (gx * tx.x + gy * tx.y + gz * tx.z) * A, dpy = dly / w + (gx * ty.x + gy * ty.y + gz * ty.z) * A;
  vec2 spx = vec2(length(vec2(dpx.x, dpy.x)), length(vec2(dpx.y, dpy.y)));
  vec2 ctr;
  pcThinR(p, asp, spx, rag, rnd, ctr, own, rndN, uv);
  pxW = 1.0 / max(spx.y, 1e-6);
  // (the centre among the rows' own unequal widths: pcThinR's rows are a little wider here and narrower there)
  float yc = ctr.y;
  for (int k = 0; k < 6; k++) yc = ctr.y - 0.27 * sin(1.7 * yc + 0.9 * sin(0.21 * ctr.x));
  vec2 pc = vec2(ctr.x, yc);
  vec2 s1 = pcChartToPx(pc - p, dpx, dpy, 4000.0);
  vec2 c1 = ch + dlx * s1.x + dly * s1.y;
  vec2 s2 = pcChartToPx(pc - pcSnowP(c1, w, A), dpx, dpy, 4000.0);
  vec2 c2 = c1 + dlx * s2.x + dly * s2.y;
  vec2 s3 = pcChartToPx(pc - pcSnowP(c2, w, A), dpx, dpy, 4000.0);
  vec2 c3 = c2 + dlx * s3.x + dly * s3.y;
  ds = s1 + s2 + s3;
  float l = length(ds);
  vec2 dsH = l > 96.0 ? ds * (96.0 / l) : ds;
  if (l > lim) ds *= lim / l;
  ctrB = pcGroundUnchart(vBody, c3, uBodyR) * (uBodyR + hB + dot(hD, dsH));
}
void main() {
  #include <logdepthbuf_fragment>
  float dist = length(vView);
  vec3 nV = normalize(vNV);
  gSunV = normalize((viewMatrix * vec4(uSunDirW, 0.0)).xyz);
  gMid = 1.0 - smoothstep(120.0, 420.0, dist);
  gVar = gMid;        // (the worlds laid in long strokes keep what they had: gVar is only taken off the distance under the leaf dabs, below)
  vec2 ch = pcGroundChart(vBody, uBodyR);
  gBdx = dFdx(vRel); gBdy = dFdy(vRel);
  vec2 dlx = pcGroundChartD(vBody, gBdx, uBodyR), dly = pcGroundChartD(vBody, gBdy, uBodyR);
  gCtrB = vec3(1e30);
  gCdx = dFdx(vCol); gCdy = dFdy(vCol);
  gC2dx = dFdx(vCol2); gC2dy = dFdy(vCol2);
  gPdx = dFdx(vPar); gPdy = dFdy(vPar);
  gNvdx = dFdx(vNV); gNvdy = dFdy(vNV); gNldx = dFdx(vNL); gNldy = dFdy(vNL);
  #ifdef PC_CANOPY
    gSdx = dFdx(vFarS); gSdy = dFdy(vFarS);
  #endif
  #ifdef PC_BLOOMF
    gBkdx = dFdx(vBloomK); gBkdy = dFdy(vBloomK);
  #endif
  float wpx = uOilA.x * uOilPx.y / 720.0;
  vec3 c, leaf; float lvl, snowC, canopy;
  vec3 acc;
  if (uGroundK.x > 0.5) {
    // a world of snow and ice: LONG THIN STROKES THAT RUN WITH THE LAND, as the clip's snow is laid (its night frames,
    // looked at again for the overhaul plan's night: flowing streaks of turquoise, blue and near white, no line between
    // them). The rows lie on the contours of a slope. Two layers an octave apart: a stroke of the finer one is there or
    // it is not, whole (asked at its own centre), and where it is not the coarser shows. (Before: a course of tiles
    // with a light edge, which stood as a pavement of outlined stones: the stills after overhauls 1 and 2.)
    vec3 r0, n0, r1, n1; vec2 ds0, ds1, uv0, uv1, lgT; float own0, own1, pw0, pw1;
    vec3 ctrB0 = vec3(1e30), ctrB1 = vec3(1e30);
    vec4 ot;
    if (uGroundK.z > 0.5) {
      // A WORLD OF SNOW (see pcIce): thin strokes, many and close, about eleven times as long as they are wide, slanting
      // with a slow swirl as the pastel's hatching does; each in its exact place (pcSnowLayer). Seen at a low angle they
      // are laid larger, by the root of how far the land is squeezed there: neither a hatching of slivers nor long
      // level bands. (Before: short broad slabs with a ridge and a dark far edge: tiles, the owner's word.)
      float grz = inversesqrt(max(abs(dot(nV, normalize(-vView))), 0.11));
      ot = pcStrokeOct4(dist * grz * 1.15, uOilPx.z * 1.15);
      lgT = vec2(dFdx(ot.w), dFdy(ot.w));
      float hB = length(vBody) - uBodyR; vec3 upS = normalize(vBody);
      vec2 hD = vec2(dot(upS, gBdx), dot(upS, gBdy));
      pcSnowLayer(ch, dlx, dly, ot.x, 11.0, 92.0, 0.04, 14.0 * wpx * 8.0, hB, hD, r0, ds0, own0, n0, uv0, pw0, ctrB0);
      pcSnowLayer(ch, dlx, dly, ot.x * 2.0, 11.0, 92.0, 0.04, 28.0 * wpx * 8.0, hB, hD, r1, ds1, own1, n1, uv1, pw1, ctrB1);
    } else {
    vec2 chT = vec2(ch.x, ch.y + 0.8 * (length(vBody) - uBodyR));
    vec3 upT = normalize(vBody);
    vec2 dtx = vec2(dlx.x, dlx.y + 0.8 * dot(upT, gBdx)), dty = vec2(dly.x, dly.y + 0.8 * dot(upT, gBdy));
    // (a stroke's width on the screen is taken from how fast its rows go by there, not from the distance alone: on a
    // steep face the rows crowd (the height is in the chart), and at a low angle they are squeezed; sized by distance
    // they went under the pixel and a mountain side was a speckle of single pixels: the survey of the worlds, Pluto's
    // lilac mountains and Uranus' ice shelves)
    float rowsPx = length(vec2(dtx.y, dty.y));
    ot = pcStrokeOct4(clamp(rowsPx / max(uOilPx.x, 1e-6), dist, dist * 6.0) * 2.0, uOilPx.z * 2.0);
    lgT = vec2(dFdx(ot.w), dFdy(ot.w));
    // (long strokes in slow wide arcs: laid in quick waves, flat snow read as open water: the critic, on the first night)
    pcThinLayerUV(chT, dtx, dty, ot.x, 8.0, vBody, 14.0 * wpx * 8.0, -34.0, 0.0, r0, ds0, own0, n0, uv0, pw0);
    pcThinLayerUV(chT, dtx, dty, ot.x * 2.0, 8.0, vBody, 28.0 * wpx * 8.0, -34.0, 0.0, r1, ds1, own1, n1, uv1, pw1);
    }
    float kV = 1.0 - 0.75 * uGroundK.z;      // (how far a stroke's light strays from its neighbours': on snow a quarter of what it is on ice)
    float fr0 = ot.w - ot.z;
    bool fine = r0.z >= smoothstep(0.15, 0.85, fr0 + dot(lgT, ds0));
    bool fineN = n0.z >= smoothstep(0.15, 0.85, fr0);
    vec3 pc0 = vec3(0.0), pc1 = vec3(0.0);
    if (!fine || (own0 < 0.999 && !fineN)) {
      // the coarser layer here: its stroke, and the stroke beside it over the pixel at their edge
      gCtrB = ctrB1;
      pcGroundAt(ds1, ot.x * 2.0, r1, c, lvl, snowC, leaf, canopy);
      pc1 = pcFlowPaint(c, leaf, r1, snowC, lvl + (r1.x - 0.5) * 0.9 * kV);
      if (own1 < 0.999) pc1 = mix(pcFlowPaint(c, leaf, n1, snowC, lvl + (n1.x - 0.5) * 0.9 * kV), pc1, own1);
    }
    if (fine) {
      gCtrB = ctrB0;
      pcGroundAt(ds0, ot.x, r0, c, lvl, snowC, leaf, canopy);
      pc0 = pcFlowPaint(c, leaf, r0, snowC, lvl + (r0.x - 0.5) * 0.9 * kV);
      if (own0 < 0.999) pc0 = mix(fineN ? pcFlowPaint(c, leaf, n0, snowC, lvl + (n0.x - 0.5) * 0.9 * kV) : pc1, pc0, own0);
    }
    acc = fine ? pc0 : pc1;
    gCtrB = vec3(1e30);
  } else {
  // leaf dabs (the owner's style 5), in three layers an octave apart and LAID FROM THE TOP DOWN: the finest (its dabs
  // left out one by one toward the next octave), the middle one whole, the coarsest coming in under them, so that at the
  // step of an octave nothing changes: the middle layer is then the finest, and the coarsest the middle. (Leaves of
  // many sizes, the overhaul plan's fifth piece: a third of the finest layer's dabs are never laid, so dabs twice and
  // four times the size show between them, as the big leaves among the small on the clip's floor.) A pixel
  // a dab covers whole stops there: most pixels work out one layer, where they worked out two and the ground under them
  // before (the overhaul plan's "strokes baked", chunks.js). Under the last dab the ground's own colour, the light and
  // the leaf shadow as the pixel has them.
  // (seen at a low angle a dab is squeezed flat on the screen: far across a level floor the dabs were lines a pixel
  // high, a hatching; so the dabs are laid larger the lower the angle, up to three times)
  float graze = inversesqrt(max(abs(dot(nV, normalize(-vView))), 0.11));
  vec4 o4 = pcStrokeOct4(dist * uOilS.w * graze, uOilPx.z * uOilS.w);
  vec3 ocl = vec3(o4.w - o4.z, dFdx(o4.w), dFdy(o4.w));
  // THE FLOOR KEEPS ITS VARIETY AS LONG AS ITS DABS ARE STILL MARKS (the owner, 2026-11-22: fully rendered at 300
  // yards). gMid fades by RAW DISTANCE, which is right for the floor's mean -- far off a wood's floor is its canopy --
  // but it was fading the per-dab variety with it, so beyond 420 m a floor under trees had no fallen leaf on it at
  // all. A dab does NOT shrink with distance: the octaves hold it at a few pixels wherever it lies (chunks.js
  // pcStrokeOct4), so the variety is kept by the MARK'S OWN WIDTH IN PIXELS. Measured at the default stroke size: a
  // dab of the finest layer is about 0.66 of its cell wide, which is 4 to 8 px at 720 lines and twice that at 1440,
  // AT EVERY DISTANCE -- so at 275 m a hillside keeps its light and dark leaves. Where the picture is small (a phone
  // at half scale, ?stroke= turned down) the dab falls under three pixels and the variety eases out again, which is
  // what keeps a far hillside from reading as pepper: the owner's first rule is no grain.
  // (the size a dab is AIMED at, not the size the octave happens to be holding: o4.x is constant through an octave
  // and so sweeps from the aim down to half of it and jumps back, and a threshold on that would ring the ground with
  // circles of litter and no litter as the eye moved. The aim is the same number at every distance, as the octaves
  // are built to make it -- 0.66 of a cell is the dab's width, times three quarters for the sweep -- and it needs
  // neither the distance nor the angle, both of which cancel: chunks.js pcStrokeOct4.)
  float dabPx = 0.50 * uOilS.w * uOilA.x * uOilPx.y / 720.0;
  gVar = max(gMid, ${FLOORVAR} * smoothstep(2.6, 4.2, dabPx));
  float lw = max(length(gBdx), length(gBdy));
  #ifdef PC_ROCKF
    gRockLw = lw;
  #endif
  // (a dab's own place: where its centre's chart lies on the sphere, at the ground's height carried there)
  float rB = length(vBody);
  vec3 upB = vBody / rB;
  float rdx = dot(upB, gBdx), rdy = dot(upB, gBdy);
  acc = vec3(0.0);
  float rem = 1.0;
  #ifdef PC_CANOPY
    // (the far view's canopy is carried by these dabs only: render/farground.js. The eye on the body, and the sun's way
    // along the ground's chart and its height, once a pixel)
    // (on a world with no painted canopy, and wherever the eye is not well above this place -- on foot nearly
    // everywhere -- it is off for the whole pixel at one comparison: the dabs never ask)
    gCanOn = uCanK.w * step(10.0, -dot(vRel, upB));
    if (gCanOn > 0.5) {
      gEye = vBody - vRel;
      gSunE = dot(upB, uSunDirL);
      vec2 scCan = pcGroundChartD(vBody, uSunDirL - upB * gSunE, uBodyR);
      gSunCh = scCan / max(length(scCan), 1e-6);
    }
  #endif
  #ifdef PC_ROCKF
    // (the far view, FV4: on steep land the dabs are laid on upright charts, render/farground.js pcFaceLayer; a pixel
    // under about 31 degrees never asks)
    // (the facing is the STEEPER of the smoothed one and the triangle's own: on the coast's staircase wall every
    // triangle is upright, and the smoothed facing had gentle columns every few metres, SEEN in ?rockdebug=2 and 3)
    vec3 nP = normalize(vNL);
    float upSm = dot(nP, upB);
    gFaceP = vec2(min(upSm, abs(dot(normalize(cross(gBdx, gBdy)), upB))), 0.5);
    gFaceOn = uRockK * step(gFaceP.x, 0.86);
    if (gFaceOn > 0.5) {
      gFaceP.y = pcStrikeWay(nP, upB, upSm);
      gFaceK = vec2(smoothstep(0.80, 0.64, gFaceP.x), smoothstep(0.30, 0.70, fract(gFaceP.y)));
      pcFaceFrame(nP, upB, upSm);
    }
  #endif
  // (the speed test's flat ground: no strokes at all, shared.js uOilL.y; the lighter paint: two layers, the coarsest
  // left to the ground's own colour)
  if (uOilL.y > 0.5 && uOilL.y < 1.5) rem = 0.0;
  #ifdef PC_CANOPY
    // (the far view: the wood's roof first, in its own smaller dabs; what it covers whole is finished, render/farground.js)
    pcCanopyLayers(ch, dlx, dly, o4.x, wpx, ocl, rB, rdx, rdy, acc, rem);
  #endif
  for (int L = 0; L < 3; L++) {
    if (rem < 0.004) break;
    if (L == 2 && uOilL.x > 0.5) break;
    float ws = L == 0 ? 1.0 : L == 1 ? 2.0 : 4.0, w = o4.x * ws;
    vec3 rnd, rnd2; vec2 ds, ctr; float cov, has2;
    #ifdef PC_ROCKF
      float faceD = 0.0;
      if (gFaceOn > 0.5) pcFaceLayer(ch, dlx, dly, rB - uBodyR, rdx, rdy, w, uOilS.z, 4.0 * wpx * uOilS.w * ws, ocl,
                                     L == 0 ? vec2(0.35, 0.65) : L == 1 ? vec2(0.0, 0.35) : vec2(1.0, -1.0), rnd, ctr, ds, cov, rnd2, has2, faceD);
      else
    #endif
    pcDabLayer(ch, dlx, dly, w, uOilS.z, 4.0 * wpx * uOilS.w * ws, ocl,
               L == 0 ? vec2(0.35, 0.65) : L == 1 ? vec2(0.0, 0.35) : vec2(1.0, -1.0), rnd, ctr, ds, cov, rnd2, has2);
    if (cov <= 0.0) continue;
    gCtrB = pcGroundUnchart(vBody, ctr, uBodyR) * (rB + rdx * ds.x + rdy * ds.y);
    #ifdef PC_CANOPY
      gCtrCh = ctr;
    #endif
    #ifdef PC_ROCKF
      gFaceD = faceD;
      // (a dab of an upright chart: its centre's place from its own chart, and its place on the ground's chart)
      if (faceD > 0.5) {
        gCtrB = pcFaceCentre(ch, ctr, faceD);
        pcFaceLight(ch, faceD, upB);
        #ifdef PC_CANOPY
          gCtrCh = ch + dlx * ds.x + dly * ds.y;
        #endif
      }
    #endif
    pcGroundAt(ds, w, rnd, c, lvl, snowC, leaf, canopy);
    // (under trees the floor is nearly all fallen leaves, with the earth dark between: the clip's. A world may keep
    // more of its grass there, uGroundK.w: the owner's later references have grass under the trees and leaves strewn on it)
    // (the share laid as fallen leaves is kept by the mark's size now, not by the distance: gVar above. It was gMid,
    // which took the litter off a floor under trees from 120 m and left none at all past 420 m -- the far wood's floor
    // was its canopy's colour smoothed out, where the near wood's is a carpet of whole leaves with the earth between
    // them. HONEST TRADE, to be judged in a still: the far floor's MEAN moves with it, toward the litter's own
    // colour (pcDensity of the canopy wash), because line 413 still takes the dab's ground colour toward that
    // canopy by gMid. ?floorvar=0.5 is half of it, ?floorvar=0 is exactly what shipped.)
    float fk = clamp(canopy * 1.6, 0.0, 0.88) * gVar * (uGroundK.w > 0.0 ? uGroundK.w : 1.0);
    #ifdef PC_SEASONG
      fk *= pcSeasonLeafK();                 // (a quarter of the fallen leaves in high summer, all of them in autumn)
    #endif
    #ifdef PC_ROCKF
      fk *= 1.0 - gRock;                     // (no leaf lies on a rock face)
    #endif
    acc += rem * cov * pcGroundPaint(c, leaf, fk, rnd, snowC, lvl);
    rem *= 1.0 - cov;
    if (has2 > 0.5 && rem >= 0.004) { acc += rem * pcGroundPaint(c, leaf, fk, rnd2, snowC, lvl); rem = 0.0; }
  }
  gCtrB = vec3(1e30);
  if (uOilL.y > 0.5 && uOilL.y < 1.5) acc = pcTone(pcDensity(mix(vCol2, vCol.rgb, gMid), 1.15), 2.0);
  else if (rem >= 0.004 || uOilC.z < 0.999) {
    // (the ground that shows between the dabs faces the sky as the land does, at the pixel's own place)
    ${SKYUP('dot(normalize(vNL), normalize(vBody))')}
    float x0 = dot(nV, gSunV) * 0.5 + 0.5;
    float sun0 = min(pcSunAtSoft(vBody, vPar.z * mix(0.82, 1.0, gMid), 8.0, max(lw, o4.x * 0.5), 0.5), 1.0 - pcCast(vBody, 0.0));
    vec3 bareC = pcDensity(mix(vCol2, vCol.rgb, gMid), 1.15);
    #ifdef PC_CANOPY
      // (under the painted canopy the ground between the dabs is the crowns' mean wash over the share they cover)
      vec4 canM = pcCanopyMean(vFarS, vPar.w);
      bareC = mix(bareC, canM.rgb, canM.a);
    #endif
    #ifdef PC_BLOOMF
      // (near the eye the ground between the dabs takes NONE of the drift, rising to its share by 250 m: a tint there read
      // as a milky veil from 1.8 m and 10 m, frost or fog, the look director's ruling via flora B; near, the drift is carried
      // by whole dabs in the flower's colour only)
      bareC = mix(bareC, pcBloomPal(mix(vBloomI.x, vBloomI.y, step(325.0, dist))), mix(0.45, 0.2, smoothstep(250.0, 400.0, dist)) * smoothstep(150.0, 250.0, dist) * vBloomK * uBloomOn);      // (far off a smaller share: with every drift on a slope taking the slope's kind, a whole hillside was washed in one strong red at 1 km, SEEN by flora B)      // (the ground between the dabs takes a share of the drift)
    #endif
    float lvl0 = pcLevel(mix(min(x0, 0.44) - 0.10 * vPar.z, x0, sun0), 0.05);
    #ifdef PC_ROCKF
      // (on a cliff the ground between the dabs is the cliff's rock at the pixel's own place, render/farground.js)
      float clP = smoothstep(0.66, 0.50, gFaceP.x) * smoothstep(0.05, 0.20, 1.0 - vCol.a) * gFaceOn;
      if (clP > 0.0) {
        gCliffU = 1.0;
        bareC = mix(bareC, pcCliffC(vBody, rB - uBodyR, vec3(0.5), bareC, lw), clP);
        gCliffU = 0.0;
        lvl0 = mix(lvl0, min(lvl0, 0.9), gGully * clP);
        // (and it takes the dabs' own light planes and their warm and cool lean, at the pixel's facing: in plain daylight
        // it was lighter and bluer than the planes around it, so every gap between the dabs on a far face read as a pale
        // blue-grey fleck of one or two pixels, SEEN at 1 km by the look director; ?rockdebug=1 shows those gaps grey)
        gRockP = clP; lvl0 = pcRockPlanes(lvl0, nV, sun0);
      }
    #endif
    #ifdef PC_ROCKF
      // (and between the dabs the land's snow is the snow's own white, not the wash's smooth drift: from 420 m a fifth of the
      // bright snow is these gaps, and their drift from point to point read as an airbrushed glow, R3.7)
      { float snB = smoothstep(0.80, 0.90, min(min(bareC.r, bareC.g), bareC.b)) * (1.0 - smoothstep(0.08, 0.16, max(max(bareC.r, bareC.g), bareC.b) - min(min(bareC.r, bareC.g), bareC.b)));
        bareC = mix(bareC, vec3(0.95, 0.96, 1.0), snB); }
    #endif
    vec3 bare = pcTone(bareC, lvl0);
    #ifdef PC_ROCKF
      if (clP > 0.0) bare = pcRockTemp(bare);
    #endif
    #ifdef PC_ROCKDEBUG
      if (gFaceOn > 0.5 && uRockDbg < 1.5) bare = vec3(0.5);
    #endif
    #ifdef PC_FIRE
      // (the powers, fire) The ground that shows BETWEEN the strokes is charred too, or a burnt patch would show its
      // old green through the gaps between its black strokes. This one is a smooth wash and not a stroke, so it takes
      // the black smoothly, and it is asked at the pixel's own place, which is where that ground is.
      vec3 bareM = pcMarksAt(vBody);
      if (bareM.x > 0.001) bare = mix(bare, pcSoot(bare, 0.5, 0.5), bareM.x * (1.0 - uBurnK.z));
      // and the ground between the strokes is melted where they are, or a hole in the ice would show the old
      // pale wash through the gaps between its dark strokes
      float goneB = max(bareM.y, bareM.z);
      if (goneB > 0.001) {
        bare = mix(bare, pcDensity(bare, 1.0 + 1.3 * goneB), goneB);
        bare = mix(bare, mix(bare, vec3(0.09, 0.15, 0.26), 0.62), bareM.z);
      }
    #endif
    acc = mix(bare, acc + rem * bare, uOilC.z);
  }
  }
  #ifdef PC_FARWATER
    acc = pcFarWaterLay(acc, dist);      // (the far view's water line, laid over the ground at each pixel: render/farground.js)
  #endif
  float f = pcFogAmount(dist * pcFogBank(vBody));
  vec3 cOut = pcAtmosV(acc, f, vView);
  vec3 upV = normalize(vUpV);
  float limb = pow(1.0 - clamp(dot(upV, normalize(-vView)), 0.0, 1.0), 2.5) * uFog.w;
  cOut = mix(cOut, pcOilHaze(uHaze), limb);
  pcWrite(cOut, 0.0, nV, -vView.z, 1.0);
}
#else
void main() {
  #include <logdepthbuf_fragment>
  pcFp = pcFootprint(vBody);      // (R1 W2.1: every mark below is laid as the pixel sees it, chunks.js)
  pcDist = length(vView);         // (R1 re-fix: the leaf shadow's far octaves, chunks.js)
  vec3 nV = normalize(vNV);
  vec3 nL = normalize(vNL);
  float dist = length(vView);
  float near = 1.0 - smoothstep(18.0, 80.0, dist);
  float mid = 1.0 - smoothstep(120.0, 420.0, dist);

  vec4 n1 = texture(uNoise3D, vBody / 31.0);
  vec4 n2 = texture(uNoise3D, vBody / 6.3 + 0.21);
  // Brush marks: short broken touches that keep about the same size on the sheet, so far
  // ground gets fewer, larger marks. Two octaves of a field anchored to the planet in 3D (no
  // projection axis, nothing to stretch), each thresholded on its own and cross-faded.
  float lodf = log2(max(dist / 4.0, 1.0));
  float l0 = floor(lodf);
  float lf = smoothstep(0.2, 0.8, lodf - l0);
  vec3 q = vBody * exp2(-l0);
  vec4 ma = texture(uNoise3D, q / 2.3 + 0.13), mb = texture(uNoise3D, q / 4.6 + 0.13);
  vec4 fa = texture(uNoise3D, q / 0.61 + 0.57), fb = texture(uNoise3D, q / 1.22 + 0.57);
  float markFade = 1.0 - smoothstep(150.0, 520.0, dist);
  float ms = exp2(l0);       // (the marks' octave, metres per unit of q: what of each pattern lies inside the pixel scales with it)

  // far away the forest floor reads as its canopy: one broad soft wash
  vec3 c = mix(vCol2, vCol.rgb, mid);

  // wash turbulence: the pigment load drifts, so no area is flat colour
  float d = 1.0 + (n1.r - 0.5) * 0.75 + (n2.g - 0.5) * 0.40 * near;
  // broken colour: darker touches of the brush inside the wash
  // (soft-edged and of uneven size: touches laid into a damp wash, not a pattern of dots)
  float dab = mix(pcStepF(0.50, 0.66, ma.r * 0.72 + ma.a * 0.28, 0.5184 * pcSub(2.3 * ms, PC_NRG) + 0.0784 * pcSub(2.3 * ms, PC_NA)),
                  pcStepF(0.50, 0.66, mb.r * 0.72 + mb.a * 0.28, 0.5184 * pcSub(4.6 * ms, PC_NRG) + 0.0784 * pcSub(4.6 * ms, PC_NA)), lf) * markFade;
  d += dab * 0.30 * (1.0 - vPar.x * 0.5);
  // small crisp marks: grass, twigs, grit, laid with the tip of the brush
  float flick = mix(pcStepF(0.668, 0.70, fa.g * 0.72 + ma.b * 0.28, 0.5184 * pcSub(0.61 * ms, PC_NRG) + 0.0784 * pcSub(2.3 * ms, PC_NB)),
                    pcStepF(0.668, 0.70, fb.g * 0.72 + mb.b * 0.28, 0.5184 * pcSub(1.22 * ms, PC_NRG) + 0.0784 * pcSub(4.6 * ms, PC_NB)), lf) * markFade;
  d += flick * 0.50 * (0.25 + 1.25 * vPar.x) * smoothstep(1.5, 7.0, dist);    // grit shows on rough ground, hardly at all on smooth sand or ice
  // neighbouring pigments run into each other: drifts of green and of warm earth
  vec3 hueA = c * uHueA;
  vec3 hueB = c * uHueB;
  c = mix(c, hueA, pcStepF(0.50, 0.72, n1.b, pcSub(31.0, PC_NB)) * 0.8);
  c = mix(c, hueB, pcStepF(0.52, 0.74, n2.r, pcSub(6.3, PC_NRG)) * 0.6 * mid);

  // strata: beds of unequal thickness that follow the height, strongest on steep faces
  float steep = smoothstep(0.05, 0.38, 1.0 - dot(nL, normalize(vBody)));
  if (vCol.a < 0.995) {
    float strata = 1.0 - vCol.a;
    float hgt = length(vBody) - uBodyR;
    float b1 = texture(uNoise3D, vec3(hgt / 41.0 + (n1.r - 0.5) * 0.10, 0.31, 0.77)).r;
    float b2 = texture(uNoise3D, vec3(hgt / 11.0 + (n2.g - 0.5) * 0.12, 0.13, 0.41)).g;
    float beds = (b1 - 0.5) * 1.7 + (b2 - 0.5) * 0.9;
    float sk = strata * (0.30 + 0.70 * steep);
    d += beds * 0.9 * sk;
    c = mix(c, hueB * vec3(1.0, 0.93, 0.88), smoothstep(0.05, 0.40, beds) * sk * 0.7);
    c = mix(c, mix(c, vec3(1.0), 0.45), smoothstep(0.10, 0.45, -beds) * sk * 0.8);
  }
  c = pcDensity(c, d);

  // weather on the ground. Rain: the wash goes darker and richer. Snow: up-facing forms are
  // left as bare paper, ragged at the edge of the cover and thinner under trees; steep faces
  // stay dark, so the land is drawn by what the snow could not lie on.
  float upf = dot(nL, normalize(vBody));
  float snowC = pcSnowCover(upf, mix(ma.g, mb.g, lf) * 0.45 + n2.b * 0.30 + n1.a * 0.25, vPar.z);
  // (where the trees' shade lies the wet wash is laid thinner: wet shade on a wet lawn was a
  // row of dark hard-edged holes)
  float sunny = pcDapple(vBody, vPar.z * mix(0.82, 1.0, mid));
  c = pcWetWash(c, (1.0 - snowC) * mix(0.35, 1.0, sunny));
  c = mix(c, mix(vec3(1.0), vec3(0.90, 0.93, 1.0), smoothstep(0.42, 0.70, n1.g) * 0.55), snowC);

  // cracked ground (dried basins, frost polygons, ice shelves): pigment pools in the cracks.
  // The lines wander, swell, thin and break off: drawn by hand, not tiled.
  // (a negative amount: cooled lava, whose cracks open on the glow beneath: lines of fire, not of pigment)
  if (abs(vPar.w) > 0.01) {
    vec3 wp = vAnch + (n2.rgb - 0.5) * 2.2 + (ma.rgb - 0.5) * 0.5;
    float a1 = pcTri8(wp, nL, 1.0 / 16.0).a;
    float w1 = 0.035 + 0.075 * n1.b;
    // (R1 W2.1: the atlas' cell field changes by about 17 a tile, so 1.1 a metre at 1/16 and 0.27 at 1/64; its cells
    // are 16/11 and 64/11 m; a line covers about 1.8 times its mean width of the land, texgen.js genStrokes)
    float fine = pcLineF(w1 * 0.35, w1, a1, 1.1 * pcFp, 1.45, 1.8);
    fine *= pcStepF(0.36, 0.50, n2.b + (n1.g - 0.5) * 0.7, pcSub(6.3, PC_NB) + 0.49 * pcSub(31.0, PC_NRG));
    vec3 wp2 = vAnch + (n1.rgb - 0.5) * 11.0 + (n2.rgb - 0.5) * 2.0;
    float a2 = pcTri8(wp2, nL, 1.0 / 64.0).a;
    float big = pcLineF(0.012, 0.045 + 0.05 * n2.r, a2, 0.27 * pcFp, 5.8, 1.8);
    big *= pcStepF(0.30, 0.46, n1.g + (n2.b - 0.5) * 0.5, pcSub(31.0, PC_NRG) + 0.25 * pcSub(6.3, PC_NB));
    float crack = max(fine * near * 0.75, big * mix(0.55, 1.0, near) * mid);
    if (vPar.w > 0.0) c = pcDensity(c, 1.0 + crack * vPar.w * 2.2 * (1.0 - snowC * 0.8));
    else c = mix(c, mix(vec3(0.98, 0.52, 0.20), vec3(1.0, 0.86, 0.50), fine * near), clamp(crack * -vPar.w * 1.5, 0.0, 0.92));
  }

  // light in soft value steps; shadows are glazes
  vec3 sunV = normalize((viewMatrix * vec4(uSunDirW, 0.0)).xyz);
  float x = dot(nV, sunV) * 0.5 + 0.5;
  if (near > 0.0) sunny = min(sunny, 1.0 - pcCast(vBody, (ma.g - 0.5) * 0.34 + (n2.b - 0.5) * 0.16));
  float xn = (n1.g - 0.5) * 0.10 + (mix(fa.b, fb.b, lf) - 0.5) * 0.06 * near;
  float xS = min(x, 0.44) - (1.0 - smoothstep(0.30, 0.50, n1.g)) * 0.22 * vPar.z + xn, xL = x + xn;
  // (R1 W2.1: the light's steps no sharper than the pixel; and where the leaf shadow is finer than the pixel, the shade
  // and the sunlit wash are each laid in their own share of it: the light read at the mixed value was one middle step,
  // not the floor's mean colour)
  float fwL = fwidth(xL);
  float lvl = pcLevelF(mix(xS, xL, sunny), 0.045, fwL);
  vec3 cT = pcTone(c, lvl);
  float fk = smoothstep(0.0002, 0.0016, pcDappleSub());
  if (fk > 0.001) {
    float lvL = pcLevelF(xL, 0.045, fwL);
    cT = mix(cT, mix(pcTone(c, pcLevelF(xS, 0.045, fwL)), pcTone(c, lvL), sunny), fk);
    lvl = mix(lvl, lvL, fk);
  }
  c = cT;
  c = mix(c, c * vec3(0.84, 0.83, 1.04), (1.0 - sunny) * 0.55);
  // (PAINTER 14: a sun fleck on the floor of a wood is the picture's light: where the sun gets through the canopy the
  // wash is laid thin, nearly bare paper warmed by the light. The reference forest had no paper anywhere: its flecks
  // were the meadow's sunlit green, a middle value against the wood's shade. Open ground and the thinner stands of other
  // worlds (a canopy under 0.55: fungus, kelp, groves) are not touched.)
  // (a patch of sun is laid thinner, and its heart (the same pattern read at a higher threshold) thinnest, so a fleck
  // goes from a pale sunlit green at its edge to nearly paper in its middle; the floor keeps its shade)
  // (R1 W2.1: the heart lies inside the patch, so 0.55 of the patch plus 0.45 of its heart: the same where both are
  // drawn, and the right share where they are finer than the pixel)
  float fleck = (0.55 * sunny + 0.45 * min(pcDappleL(vBody, vPar.z * 1.08, 8.0), sunny)) * smoothstep(0.55, 0.90, vPar.z) * smoothstep(2.3, 2.85, lvl) * uDayness * (1.0 - uWx.x) * (1.0 - snowC);
  c = mix(c, mix(c, vec3(1.0), 0.55) * uLight, fleck * 0.8);

  // dry brush on rough ground: the brush skips, paper sparkles through in small broken flecks
  float dryM = mix(pcStepF(0.60, 0.69, fa.b * 0.62 + fa.r * 0.38, 0.3844 * pcSub(0.61 * ms, PC_NB) + 0.1444 * pcSub(0.61 * ms, PC_NRG)),
                   pcStepF(0.60, 0.69, fb.b * 0.62 + fb.r * 0.38, 0.3844 * pcSub(1.22 * ms, PC_NB) + 0.1444 * pcSub(1.22 * ms, PC_NRG)), lf);
  c = mix(c, vec3(1.0), dryM * vPar.x * markFade * (0.24 + 0.16 * lvl));
  // standing water after rain: small pale shapes of sky lying in the flats near the eye
  // (a puddle is a pale, soft-edged piece of sky: it runs into the wet ground round it, with
  // no rim, and is palest in its middle)
  float pud = uWx.y * (1.0 - snowC) * smoothstep(0.985, 0.999, upf) * near * (1.0 - vPar.z * 0.6);
  if (pud > 0.01) {
    float pn = texture(uNoise3D, vBody / 3.1 + 0.43).r * 0.7 + n2.a * 0.3;
    pud *= smoothstep(0.63, 0.79, pn) * smoothstep(0.47, 0.65, n1.a);
    c = mix(c, mix(uHaze, vec3(1.0), 0.35), pud * 0.70);
  } else pud = 0.0;

  // Wet rock under a storm: a steep face takes a deeper wash (the pale cliffs of a storm coast stood
  // against the storm's sky as paper cut-outs with ruled edges).
  // (PAINTER 12: a wash already dark takes little more: Neptune's Payne's grey basalt under a gale went to a near-black
  // slab; nothing is black, the darks stay indigo)
  c = pcDensity(c, 1.0 + (0.80 * uStorm + 0.35 * uWx.y) * (1.0 - smoothstep(0.50, 0.92, upf)) * (1.0 - snowC) * smoothstep(0.10, 0.42, dot(c, vec3(0.3, 0.5, 0.2))));
  // A track: where a walker (or a hull's wash) has laid the growth flat the ground's wash is a tone
  // duller and deeper, as trodden grass is. PHYSICS lays the stems; the strokes standing over the
  // sward are too few to show the lane by themselves.
  if (uPhysOn > 0.5 && dist < 70.0) {
    vec2 tuv = (pcPhysGrid(vBody) - uPhysNearMap.xy) * uPhysNearMap.z + 0.5;
    if (tuv.x > 0.0 && tuv.y > 0.0 && tuv.x < 1.0 && tuv.y < 1.0) {
      float trod = clamp(pcPhysTex(uPhysPush, tuv, uPhysNearMap.w).z, 0.0, 1.0) * (1.0 - smoothstep(40.0, 70.0, dist)) * (1.0 - snowC);
      c = pcDensity(c, 1.0 + 0.42 * trod) * mix(vec3(1.0), vec3(0.95, 0.97, 0.90), trod);
    }
  }
  float f = pcFogAmount(dist * pcFogBank(vBody));      // (PAINTER 19: a thick fog lies in banks, chunks.js)
  c = pcAtmosV(c, f, vView);
  // A world's one great marking, as a painter lays it on the globe from orbit (PAINTER 17, the M4 critique's third item:
  // Pluto had no heart): one pale cream wash in the shape of a heart where the heart glacier lies, its left lobe barer
  // paper, a thin tholin-orange line pooled along its edge. It is laid only from orbit (with the relief drawn in);
  // on the ground and in low flight the land's own washes are all there is.
  if (uHeart.w > 0.0 && uRound.x > 0.004) {
    vec3 nb = normalize(vBody), hc = normalize(uHeart.xyz);
    vec3 he = normalize(cross(vec3(0.0, 1.0, 0.0), hc)), hn = cross(hc, he);
    vec2 hp = vec2(dot(nb, he), dot(nb, hn)) / uHeart.w;
    hp += (texture(uNoise3D, nb * 1.7 + 0.3).rg - 0.5) * 0.22;                     // the hand's wobble
    float hx = hp.x * 1.25, hy = hp.y * 1.25 + 0.30;
    float hq = hx * hx + hy * hy - 1.0;
    float hf = hq * hq * hq - hx * hx * hy * hy * hy;
    float hm = (1.0 - smoothstep(-0.02, 0.05, hf)) * step(0.0, dot(nb, hc)) * (uRound.x / 0.75);
    float hedge = (1.0 - smoothstep(0.0, 0.16, abs(hf + 0.02))) * step(0.0, dot(nb, hc)) * (uRound.x / 0.75);
    vec3 heartC = mix(vec3(0.985, 0.955, 0.925), vec3(0.96, 0.88, 0.87), smoothstep(-0.1, 0.5, hx));
    c = mix(c, pcDensity(heartC, 0.7 + (n1.r - 0.5) * 0.9), hm * 0.86);
    c = mix(c, c * vec3(0.93, 0.74, 0.62), hedge * 0.55 * (0.5 + n1.g));
  }
  // from space the limb of the planet thins into its haze, toward bare paper
  vec3 upV = normalize(vUpV);
  float limb = pow(1.0 - clamp(dot(upV, normalize(-vView)), 0.0, 1.0), 2.5) * uFog.w;
  c = mix(c, mix(uHaze, vec3(1.0), 0.4), limb);
  float wet = max(max(vPar.y, f * 0.9), limb);
  // wet ground and falling rain or snow: edges soften, far layers run into each other
  wet = max(wet, max(uWx.y * 0.45 * (1.0 - snowC), uWx.w * smoothstep(10.0, 90.0, dist) * 0.9));
  wet = max(wet, smoothstep(0.0, 0.25, pud));      // a puddle's edge is wet in wet
  pcWrite(c, wet, nV, -vView.z, 1.0);
}
#endif
`;

export function makeTerrainMaterial(bodyU) {
  const m = new THREE.ShaderMaterial({
    name: 'pc-terrain',
    uniforms: baseUniforms(bodyU, {
      uOrigin: { value: new THREE.Vector3() }, uAnchor: { value: new THREE.Vector3() },
      uCamLocal: { value: new THREE.Vector3() }, uMorph: { value: new THREE.Vector3(1e8, 2e8, 0) },
      ...PHYS,
    }),
    vertexShader: TERRAIN_VERT, fragmentShader: TERRAIN_FRAG,
  });
  m.userData.pcPainted = true;
  // (the far view's painted canopy: compiled in only with the oil look and ?canopy= on; a world without a painted canopy
  // keeps uCanK.w at 0 and returns before any of it is worked out. terrain.js writes the season's crowns each frame.)
  if (LOOK.oil && CANOPY > 0) {
    m.defines = m.defines || {}; m.defines.PC_CANOPY = 1; m.defines.PC_CAN_DAB = _gf(CANOPY_DAB); m.defines.PC_CAN_FLOOR = _gf(CANOPY_FLOOR); if (CANOPY_FARSHADOW) m.defines.PC_FAR_SHADOW = 1; Object.assign(m.uniforms, canopyUniforms());
    if (CANOPY_DEBUG) m.defines.PC_CANDEBUG = 1;
  }
  // (the far view, FV3: the floor and the far colour follow the year; compiled in only with the oil look and ?groundseason=)
  if (LOOK.oil && GROUND_SEASON) { m.defines = m.defines || {}; m.defines.PC_SEASONG = 1; Object.assign(m.uniforms, seasonUniforms()); }
  // (the far view, FV4: rock faces, strata and snow that read from afar; compiled in only with the oil look and ?rockfield=)
  // (the far view, FV6(b): the flower drifts from the air, with flora B; compiled in only with the oil look and ?bloomfar=1)
  if (LOOK.oil && BLOOM_FAR) { m.defines = m.defines || {}; m.defines.PC_BLOOMF = 1; Object.assign(m.uniforms, bloomUniforms()); }
  if (LOOK.oil && ROCKFIELD) { m.defines = m.defines || {}; m.defines.PC_ROCKF = 1; Object.assign(m.uniforms, rockUniforms()); if (ROCK_DEBUG) m.defines.PC_ROCKDEBUG = _gf(ROCK_DEBUG); }
  // (the far view's water line: compiled in only with the oil look and ?farwater=1; world/patchgen.js packs aFarW then)
  if (LOOK.oil && MODE.water && (MODE.water.farwater || MODE.water.benchw)) {
    m.defines = m.defines || {}; m.defines.PC_FARWATER = 1; m.uniforms.uFarWaterOn = FARWATER_U.uFarWaterOn;
    FARWATER_U.uFarWaterOn.value = MODE.water.farwater ? 1 : 0;      // (?bench=water with ?farwater=0: compiled in, laid off)
  }
  // (the powers, fire: the ground goes black where the fire passed. Only with ?powers=1 and ?look=oil; see addFire.)
  addFire(m, true);
  return register(m, 'terrain');
}

// ------------------------------------------------------------------------------------------
// Water
// ------------------------------------------------------------------------------------------
// (the new paint's base pace, ?wpaint=2: the water's own speed where the mesher measured one, else the middle of v33's
// band; each cell keeps a sixth of spread either way, render/waterchunk.js. ?flow=0 keeps v33's fixed band)
const FLOW_V0 = FLOWSPD > 0 ? `vTurb.x > 0.002 ? vTurb.x * ${FLOW_VMAX} : 1.15` : '1.15';
const WATER_VERT = /* glsl */`
${VERT_PARS}
attribute float aDepth;
attribute vec4 aLiq;      // liquid wash colour, and how much it mirrors
attribute vec4 aLiqP;     // x glow (lava), y cloud (a sea of cloud)
uniform vec3 uOrigin;
uniform vec3 uCamLocal;
uniform float uWaveLod;
varying vec3 vBody;
varying vec3 vToCam;
varying vec3 vView;
varying float vDepth;
varying vec4 vLiq;
varying vec2 vLiqP;
#ifdef PC_OIL
varying vec2 vFlow;      // the current (surface.js _riversOil), two bytes about 128/255; 0, 0: still water
// What the mesher measured of the water here (world/patchgen.js): x the current's own speed, a byte of 5 m/s, and a
// byte of 0 meaning IT GAVE NONE (a mesh made before this, or the attribute not attached: the paint then keeps the
// fixed dash rate it had); y how aerated the water is, 0 clear .. 1 the foot of a fall.
attribute vec4 aTurb;
varying vec2 vTurb;
#ifdef PC_WPAINT
// (the water's new paint, ?wpaint=2: aTurb.w is how STILL the water is here, 0 a current .. 1 a pond, a lake, the sea,
// as the mesher measured it: world/patchgen.js. A byte of 0 everywhere without the switch, and nothing reads it)
varying float vStill;
#endif
#endif
varying vec3 vWake;
#ifdef PC_POWERS
uniform vec4 uPwChanA;   // the parted channel (the powers, move water): its start from the eye (body axes), its half width (0: none)
uniform vec4 uPwChanB;   // the way it runs (unit), its length now (m)
#endif
// PHYSICS' sea: the surface rises and falls with its wave trains and wakes (C14)
#define PC_PHYS_NO_WAKE
${WATER_GLSL}
void main() {
  vec3 p = position;
  vBody = p + uOrigin;
  vec2 along;
  vec3 w = pcPhysWaterD(vBody, along);
  vWake = pcPhysWake(pcPhysGrid(vBody));
  // The mesh carries each wave only where it is fine enough for it (the rest is painted): the short
  // trains near the eye, the long one (the swell, PHYSICS' fourth train) five times as far. (The reach
  // of all of them used to be measured by the first, short train: Neptune's 2.8 m sea lay flat from 64 m out.)
  vec3 wl = pcPhysWaterLong(vBody);
  float dcam = distance(p, uCamLocal);
  float lam = 6.2831853 / max(uPhysWaterK.x, 1e-3), lamL = 6.2831853 / max(uPhysWaterK.w, 1e-3);
  float carry = 1.0 - smoothstep(2.2 * lam * uWaveLod, 6.0 * lam * uWaveLod, dcam);
  float carryL = 1.0 - smoothstep(2.2 * lamL * uWaveLod, 6.0 * lamL * uWaveLod, dcam);
  // In the shallows a wave is as high as the depth lets it be (PHYSICS: 0.78 of it), and at the edge
  // the water itself runs up the beach with each wave and drains back (pcPhysWaterRunup).
  // (PHYSICS P18: the sea that is here, from the sea map; uPhysWaterSea where there is no map)
  vec4 sea = pcPhysSeaLocal(vBody);
  float shoal = clamp(aDepth / max(1.28 * sea.x, 0.05), 0.0, 1.0);
  float runup = pcPhysWaterRunup(vBody, 0.07);
  p += normalize(vBody) * mix(runup, (w.x - wl.x + vWake.x) * carry + wl.x * carryL, shoal);
  // (in the last few centimetres of the shallows the bed's small bumps rose through the water's surface where the two
  // meshes interpolate differently: a halftone of dots along every flat shore, ARTPASS wish 9. The sheet of water is
  // laid a breath higher there, so the bed shows only through its own wash; the edge is still drawn by the discard)
  p += normalize(vBody) * 0.06 * (1.0 - smoothstep(0.05, 0.40, aDepth));
  vBody = p + uOrigin;
  vDepth = aDepth;
  #ifdef PC_POWERS
    // MOVE WATER: in the parted channel the water's face is pressed down to its bed and cut away, and heaped a
    // hand's breadth along the two walls. (Measured from the eye, exactly: a planet-sized coordinate is too coarse.
    // The shape is physics/powers.js partShape, which the explorer's footing asks too.)
    if (uPwChanA.w > 0.0 && aDepth > 0.0) {
      vec3 pr = (p - uCamLocal) - uPwChanA.xyz, pu = normalize(vBody);
      float pa = dot(pr, uPwChanB.xyz);
      vec3 ps = pr - uPwChanB.xyz * pa; ps -= pu * dot(ps, pu);
      float pc = length(ps), ph = uPwChanA.w;
      float pl = smoothstep(-1.2, 0.0, pa) * (1.0 - smoothstep(uPwChanB.w - 1.5, uPwChanB.w, pa));
      float part = (1.0 - smoothstep(ph - 0.5, ph, pc)) * pl;
      float lip = smoothstep(ph - 0.3, ph + 0.2, pc) * (1.0 - smoothstep(ph + 0.2, ph + 1.8, pc)) * pl;
      p += pu * (0.16 * lip - (aDepth + 0.05) * part);
      vDepth = mix(aDepth, -0.6, part);
      vBody = p + uOrigin;
    }
  #endif
  vToCam = uCamLocal - p;
  vLiq = aLiq; vLiqP = aLiqP.xy;
  #ifdef PC_OIL
    vFlow = aLiqP.zw;
    vTurb = aTurb.xy;
    #ifdef PC_WPAINT
      vStill = aTurb.w;
    #endif
  #endif
  vec4 mv = modelViewMatrix * vec4(p + pcRound(vBody), 1.0);
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
  ${VERT_END}
}
`;

const WATER_FRAG = /* glsl */`
${FRAG_PARS}
#ifdef PC_OIL
uniform float uBodyR;
#endif
uniform vec3 uSkyZenith;
uniform vec3 uSkyHorizon;
uniform vec3 uReflDark;
uniform vec3 uBed;
uniform float uTreeLine;
uniform highp sampler2D uPrevTex;
uniform float uPrevOn;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
varying vec3 vBody;
varying vec3 vToCam;
varying vec3 vView;
varying float vDepth;
varying vec4 vLiq;
varying vec2 vLiqP;
#ifdef PC_OIL
varying vec2 vFlow;      // the current (surface.js _riversOil), two bytes about 128/255; 0, 0: still water
varying vec2 vTurb;      // x the water's own speed (0: the mesher gave none), y how aerated it is (world/patchgen.js)
#ifdef PC_WPAINT
uniform float uWPaint;   // the water's new paint (?wpaint=2): 1 on, 0 v37's (the speed test's row); render/waterchunk.js
varying float vStill;    // how still the water is here, 0 a current .. 1 a pond, a lake, the sea (world/patchgen.js)
#endif
#endif
varying vec3 vWake;
#ifdef PC_WCUT
// THE WATER'S CUTS (?wcut=1 with the oil look; the speed test's rows: core/bench.js): render/materials.js WCUT. uWCut is a
// sum of bits. The cuts: 1 the lava's and the cloud sea's work left out where the liquid is neither (0 to the last bit
// there); 2 calm water's foam and surf left out where the sea is under 2 cm and breaks nowhere (0 there to the last bit);
// 4 the reflection's march in half its steps beyond 150 m (the same answer where it meets nothing). Rows that only PRICE
// a part, never a candidate: 8 the water one flat colour, 16 no reflection march, 32 no waves per pixel.
uniform float uWCut;
bool pcWCut(int b) { return (int(uWCut + 0.5) & b) != 0; }
bool pcWHalf = false;
#endif
#define PC_PHYS_NO_WAKE
${WATER_GLSL}
#if defined(PC_OIL) && defined(PC_WPAINT)
${WATERCHUNK_GLSL}
#endif
#ifdef PC_WWAKE
${WAKE2_GLSL}
#endif

// Mirror the painting itself: march the reflected ray through last frame's depth.
// Returns uv and a confidence.
vec3 pcReflect(vec3 P, vec3 R) {
  float t = 0.7;
  vec2 uv = vec2(0.5);
  float conf = 0.0;
  for (int i = 0; i < 12; i++) {
    #ifdef PC_WCUT
    // (cut 4: far off, only the odd steps. The march's t is the same number at each, and a ray that meets nothing ends at
    // the same last step, on the screen or off it, as the whole march does: a line leaves the screen once)
    if (pcWHalf && (i & 1) == 0) { t *= 1.7; continue; }
    #endif
    vec3 p = P + R * t;
    vec4 cp = projectionMatrix * vec4(p, 1.0);
    if (cp.w <= 0.0) break;
    vec2 q = cp.xy / cp.w * 0.5 + 0.5;
    if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) break;
    uv = q;
    float sd = exp2(texture(uPrevTex, q).a * (uAux8 > 0.5 ? 32.0 : 1.0)) - 1.0;
    float rd = -p.z;
    conf = 0.55;
    if (sd < rd && rd - sd < max(2.5, t * 0.9)) { conf = 1.0; break; }
    if (sd > 4.0e5) conf = 1.0;      // open sky behind this point
    t *= 1.7;
  }
  vec2 e = min(uv, 1.0 - uv);
  return vec3(uv, conf * smoothstep(0.0, 0.08, min(e.x, e.y)));
}

void main() {
  #include <logdepthbuf_fragment>
  // (the still depth plus the swash of the moment: under zero the bed is bare just now)
  // (and the swash reaches 0.4 m above the still waterline at most, to a ragged line: the
  // mesh ends in straight cell edges a little higher, and a sheet of foam ended there as a white slab)
  float vDep = vDepth + pcPhysWaterRunup(vBody, 0.07);
  if (vDep < 0.0 || vDepth < -0.38 + (texture(uNoise3D, vBody / 2.1).g - 0.5) * 0.14) discard;
  #ifdef PC_WCUT
  // (the row that prices the whole of the water's paint: one flat colour, nothing else worked out)
  if (pcWCut(8)) { pcWrite(pcDensity(vLiq.rgb, 1.9), 0.7, normalize(normalMatrix * normalize(vBody)), -vView.z, 2.0); return; }
  #endif
  vec3 up = normalize(vBody);
  vec3 Vd = normalize(vToCam);
  float dist = length(vView);
  vec3 drift = vec3(uTime * 0.012, uTime * 0.007, -uTime * 0.009);
  vec4 r1 = texture(uNoise3D, vBody / 4.6 + drift);
  vec4 r2 = texture(uNoise3D, vBody / 1.35 - drift * 1.7);
  vec4 r3 = texture(uNoise3D, vBody / 17.0);
  // PHYSICS' sea at this point: height, slope, crests, foam. What the brush cannot hold at
  // this distance is dropped (waves smaller than a pixel would shimmer): far water goes flat
  // and is given its whitecaps as a few anchored dabs instead.
  vec2 along;
  #ifdef PC_WCUT
  // (the row that prices the waves worked out per pixel: the mesh's own waves and wakes only)
  vec3 wv = vWake; along = vec2(1.0, 0.0);
  if (!pcWCut(32)) wv = pcPhysWaterD(vBody, along) + vWake;
  #else
  vec3 wv = pcPhysWaterD(vBody, along) + vWake;
  #endif
  #ifdef PC_WWAKE
  // THE PLAYER'S OWN SMALL WAVES, PER PIXEL (the water group, lane W4, ?wakes=2; physics/water.js WAKES2, physics/splash.js):
  // a footfall's ring, a swimmer's strokes and bow wave, a low flight's furrow. Worked out here and not at the mesh's
  // corners, where a ring a metre long between vertices a metre or more apart was mostly lost; only within 30 m of the
  // eye and only while one is alive (uWWakeN 0: the loop is not entered).
  vec3 wk2 = vec3(0.0);
  if (uWWakeN > 0.5 && dist < 32.0) wk2 = pcWake2(pcPhysGrid(vBody)) * (1.0 - smoothstep(22.0, 32.0, dist));
  wv += wk2;
  #endif
  // (PHYSICS P18: the sea that is here and the way its waves run, from the sea map: lower and fewer breaking in a bay
  // behind a spit, the crests coming round toward a beach; the reference sea where there is no map)
  vec4 sea = pcPhysSeaLocal(vBody);
  vec2 sdir = pcPhysSeaDir(vBody);
  float hs = max(sea.x, 1e-4);
  float keep = 1.0 - smoothstep(0.22, 0.75, fwidth(wv.x) / hs);
  wv *= keep;
  float wavy = smoothstep(0.04, 0.35, sea.x) * keep;      // 0 on a pond, 1 on a sea that is running
  float hN = clamp(wv.x / hs, -1.5, 1.5) * wavy;                    // -1 in the troughs .. 1 on the crests
  vec2 cf = pcPhysWaterCrestAt(wv, sea);
  vec3 n = normalize(pcPhysWaterNormal(wv, up) + (r1.xyz - 0.5) * 0.13 + (r2.xyz - 0.5) * 0.06);
  vec3 r = reflect(-Vd, n);
  float re = dot(r, up);

  // what the water mirrors when the painting cannot tell us: sky above a ragged tree line
  float line = uTreeLine + (r3.r - 0.5) * 0.30;
  float skyAmt = smoothstep(line - 0.05, line + 0.05, re + (r1.g - 0.5) * 0.18);
  vec3 skyc = mix(uSkyHorizon, uSkyZenith, clamp(re * 1.2, 0.0, 1.0));
  #ifdef PC_OIL
    // THE GOLDEN HOUR IN THE WATER (the first audit's F9, still open in the fresh-eyes audit 2: under a gold sky the
    // stream and the sea stayed ice-blue). The keys' sky colours carry no gold: the sky's own shader lays it on top
    // (sky.js, the wash and the warm glow toward the sun). So the water's mirror takes the same two, by the reflected
    // ray: the wash, strongest low down, and the glow by the ray's angle to the sun. pcGold is the sky's own gold
    // (the same sun height, day, weather and world dial). With the golden hour's sky (?goldsky=0: as it was).
    if (uLookG.x > 0.5) {
      float gW = pcGold();
      skyc = mix(skyc, vec3(0.92, 0.80, 0.58), gW * mix(0.80, 0.45, smoothstep(0.0, 0.7, re)));
      vec3 sunVw = normalize((viewMatrix * vec4(uSunDirW, 0.0)).xyz);
      vec3 RvW = reflect(normalize(vView), normalize(normalMatrix * n));
      skyc = mix(skyc, vec3(0.93, 0.87, 0.72), pow(max(dot(RvW, sunVw), 0.0), 3.0) * 0.60 * uDayness * (1.0 - uWx.x));
    }
  #endif
  #ifdef PC_WPAINT
  vec3 skyT = skyc;
  #endif
  skyc = mix(skyc, vec3(1.0), 0.30);
  #ifdef PC_WPAINT
  // (THE WATER'S NEW PAINT, lane W3, ?wpaint=2: the sky as it is, not mixed with three tenths of white. From the air
  // the reflected ray points at the zenith, and the white made every water seen from above a pale grey: the design's
  // w06, w09, w15, w16. Until the look director's sky as painted (LOOK-AUDIT L9, pcSkyAt) is in, the keys' own sky.)
  if (uWPaint > 1.5) skyc = skyT;
  #endif
  vec3 dark = pcDensity(uReflDark, 1.0 + (r3.g - 0.5) * 0.9);
  vec3 c = mix(dark, skyc, skyAmt);

  // the painting, mirrored: soft vertical reflections broken by the ripples
  vec3 nV = normalize(normalMatrix * n);
  vec3 Rv = reflect(normalize(vView), nV);
  #ifdef PC_WCUT
  pcWHalf = pcWCut(4) && dist > 150.0;
  vec3 hit = pcWCut(16) ? vec3(0.5, 0.5, 0.0) : pcReflect(vView, Rv);      // (16: the row that prices the march)
  #else
  vec3 hit = pcReflect(vView, Rv);
  #endif
  vec3 refl = texture(uPrevTex, hit.xy).rgb;
  // (a sea that is running is no mirror: it keeps its own wash and only takes a breath of the sky)
  float rough = smoothstep(0.08, 0.9, sea.x) * (1.0 - vLiqP.y) * (1.0 - vLiqP.x);
  c = mix(c, refl, hit.z * uPrevOn * (1.0 - 0.85 * rough));
  // the liquid's own wash: water takes a little of it and deepens the mirror; matte liquids
  // (lava, acid, a sea of cloud) are mostly their own colour
  float mirror = vLiq.a;
  vec3 own = pcDensity(vLiq.rgb, 1.0 + (r3.g - 0.5) * 1.3 + (r1.r - 0.5) * 0.6 - hN * 0.55);   // pigment gathers in the troughs
  #ifdef PC_WCUT
  // (cut 1: where the liquid is neither lava nor a sea of cloud every line down to the cloud sea's hollows mixes in by a
  // weight of 0: left out, four lookups and their arithmetic)
  if (!pcWCut(1) || vLiqP.x + vLiqP.y > 0.0) {
  #endif
  // lava: paper-bright where it runs hot, dark crust drifting on it
  vec4 r4 = texture(uNoise3D, vBody / 9.0 + drift * 0.4);
  // (scarlet by the banks where it cools, cadmium orange in the stream, paper-yellow only where it
  // runs deep and hot; the plates of crust gather by the banks: a crust forms on lava, not on a glowing pool)
  float hotD = smoothstep(0.30, 1.20, vDep + (r2.g - 0.5) * 0.5);
  own = mix(own, vec3(0.88, 0.25, 0.13), vLiqP.x * (1.0 - hotD) * 0.7);
  own = mix(own, vec3(1.0, 0.94, 0.64), vLiqP.x * hotD * smoothstep(0.40, 0.70, r4.r) * 0.92);
  // (PAINTER 13: the crust is plates, not spots: each blotch is cut by thin lines of fire where it has cracked, and its
  // own wash is not one flat dark but laid heavier and lighter as it cooled; at its edge it goes scarlet before the
  // orange. Dark round blotches on a flat orange read as a leopard's print)
  float crustA = smoothstep(0.75, 1.0, vLiqP.x) * smoothstep(0.58 - 0.20 * (1.0 - hotD), 0.70 - 0.18 * (1.0 - hotD), r4.g + (r2.b - 0.5) * 0.3);
  vec4 r7 = texture(uNoise3D, vBody / 3.4 + drift * 0.4 + 0.37);
  float fire = 1.0 - smoothstep(0.0, 0.030 + 0.030 * r1.r, abs(r4.b - 0.5) * 0.7 + abs(r7.r - 0.5) * 0.3);
  crustA *= 1.0 - 0.85 * fire * smoothstep(0.2, 0.6, crustA);
  // (the crust gathers in rafts and along the banks, and the deep stream runs open between them: spots of one size laid
  // evenly over the whole river were the leopard)
  vec4 r8 = texture(uNoise3D, vBody / 38.0 + drift * 0.15 + 0.53);
  crustA *= mix(smoothstep(0.44, 0.64, r8.r), 1.0, (1.0 - hotD) * 0.75);
  vec3 crustC = mix(vec3(0.20, 0.15, 0.19), vec3(0.40, 0.29, 0.29), smoothstep(0.30, 0.72, r7.g * 0.7 + r2.r * 0.3));
  own = mix(own, vec3(0.80, 0.20, 0.12), smoothstep(0.75, 1.0, vLiqP.x) * crustA * (1.0 - crustA) * 2.4);
  own = mix(own, crustC, crustA);
  // cloud sea: bare-paper billows with soft shaded hollows
  vec4 r5 = texture(uNoise3D, vBody / 47.0 + drift * 0.2);
  own = mix(own, vec3(1.0), vLiqP.y * smoothstep(0.42, 0.66, r5.r * 0.7 + r3.b * 0.3));
  own = mix(own, own * uGlaze, vLiqP.y * (1.0 - smoothstep(0.30, 0.52, r5.g)) * 0.6);
  own = mix(own, own * uGlaze, vLiqP.y * (1.0 - smoothstep(-0.9, 0.1, hN)) * 0.5);      // the hollows of a rolling cloud sea
  #ifdef PC_WCUT
  }
  #endif
  // rain stipples the surface: it mirrors less and takes the sky's value
  mirror *= (1.0 - 0.45 * uWx.w) * (1.0 - 0.6 * rough);
  c = mix(own, pcDensity(c * mix(vec3(1.0), vLiq.rgb, 0.35), 1.12 + (r3.g - 0.5) * 0.35 - hN * 0.40), mirror);

  // under a closed sky the water takes the storm: its wash is laid heavier and glazed with
  // the sky's own indigo (a sea under a thunderhead is darker than the land, never a clear blue)
  float stormy = uWx.x * (1.0 - vLiqP.y) * (1.0 - vLiqP.x);
  c = pcDensity(mix(c, c * uGlaze, stormy * 0.55), 1.0 + stormy * (0.50 + (r3.b - 0.5) * 0.5));

  // horizontal strokes of reflected sky where the surface is ruffled
  float ruf = smoothstep(0.585, 0.66, r1.b * 0.55 + r2.g * 0.45);
  c = mix(c, skyc, ruf * 0.55 * mirror);
  // a sea that is running is laid in broken strokes of unequal weight: dark in the hollows
  // between the sets, thin where the backs of the waves take the sky (the strokes are
  // anchored to the planet; seen across the water they lie flat, as strokes on a sea do)
  #ifdef PC_WCUT
  // (cut 2: CALM WATER, the sea here under 2 cm and breaking nowhere. Then rough is 0, and every white below -- the crests,
  // the caps, the white horses, the surf, the swash, the far sea's strokes, the streaks -- is 0 to the last bit: left out)
  bool calm = pcWCut(2) && sea.x <= 0.02 && sea.w <= 0.0;
  float band = calm ? 0.0 : (texture(uNoise3D, vBody / 7.3 + 0.21).g - 0.5) * 1.5 + (r3.b - 0.5) * 0.9;
  #else
  float band = (texture(uNoise3D, vBody / 7.3 + 0.21).g - 0.5) * 1.5 + (r3.b - 0.5) * 0.9;
  #endif
  c = pcDensity(c, 1.0 + rough * (band * 0.9 - hN * 0.25));

  // the bed shows through where the water is shallow or seen from above
  float fres = pow(1.0 - max(dot(Vd, up), 0.0), 2.5);
  float shallow = 1.0 - smoothstep(0.02, 0.42, vDep);
  vec3 bed = pcDensity(uBed, 1.0 + (r3.b - 0.5) * 0.8);
  float bedK = clamp((1.0 - fres) * 0.42 + shallow * 0.7, 0.0, 0.9);
  #ifdef PC_WPAINT
  // (the new paint: the bed shows through by HOW DEEP the water is, not by the angle alone. Seen from above, v37 laid
  // four tenths of the sand's colour over every water however deep, and that is most of why all water from the air was
  // grey-beige. Now two metres of water from straight above shows a twentieth of its bed, half a metre two fifths, so
  // a brook and the shallows stay light and a river's middle and a lake go deep. And the shallows' own band (under
  // 0.42 m) is let go with the distance: round a submerged bump it is a ring, and from afar a thin pale line.)
  if (uWPaint > 1.5) bedK = clamp((1.0 - fres) * 0.42 * exp(-vDep / 0.6) + shallow * 0.7 * (1.0 - 0.92 * smoothstep(30.0, 150.0, dist)), 0.0, 0.9);
  #endif
  c = mix(c, bed * mix(vec3(1.0), c, 0.45), bedK * (1.0 - vLiqP.y) * (1.0 - vLiqP.x * 0.8));
  // pigment pools at the water's edge
  float edgeK = (1.0 - smoothstep(0.0, 0.09, vDep)) * 0.35;
  #ifdef PC_WPAINT
  // (the new paint: the pigment's band at the waterline is nine centimetres wide; beyond a few tens of metres it is
  // under a pixel, and it drew every shore and every submerged bump as a dark hairline, an outline)
  if (uWPaint > 1.5) edgeK *= 1.0 - smoothstep(20.0, 80.0, dist);
  #endif
  c = pcDensity(c, 1.0 + edgeK);
  // bare-paper glints: broken dashes where ripples catch the light
  float glint = smoothstep(0.715, 0.76, r2.r * 0.62 + r1.b * 0.38) * smoothstep(0.04, 0.2, vDep) * max(uDayness, uMoon);
  glint *= (1.0 - smoothstep(40.0, 120.0, dist)) * (1.0 - vLiqP.y) * (1.0 - 0.7 * wavy);
  // (glints are the sun's: under a closed sky there are none; in a gale they were a glitter of white pixels)
  glint *= 1.0 - 0.9 * uWx.x;
  // the sea running: bare paper along the tops of the higher waves, in broken dashes that lie
  // the way the crests lie; whitecaps where it breaks, ragged; surf where it shoals at a shore
  float liq = (1.0 - vLiqP.y) * (1.0 - vLiqP.x);
  float deep = smoothstep(0.04, 0.3, vDep);
  #ifdef PC_WCUT
  // (the far sea's two screen widths are taken here, before the branch, where every pixel of a square works them out)
  vec3 wcD3 = normalize(pcPhysWaterDir(sdir));
  float wcFq = fwidth(dot(vBody, wcD3)), wcFa = fwidth(dot(vBody, normalize(cross(up, wcD3))));
  float white = 0.0, farSea = 0.0;
  if (!calm) {
  #define PC_WDECL
  #define PC_FWQ wcFq
  #define PC_FWA wcFa
  #else
  #define PC_WDECL float
  #define PC_FWQ fwidth(qd)
  #define PC_FWA fwidth(dot(vBody, A3))
  #endif
  vec4 r6 = texture(uNoise3D, vBody / 0.62 + drift * 3.0);
  float torn = r6.r * 0.55 + r2.g * 0.45;
  // (beyond the first twenty metres the torn foam is sized to the distance, in octaves that give way to one
  // another, and drawn out three to one along the crest: a 0.6 m pattern seen at 60 m was a white pixel, and the
  // gale's white horses were a glitter of specks; now each is a short torn dash lying along its wave)
  float tornW = 0.5;
  {
    vec3 Dw = normalize(pcPhysWaterDir(sdir)), Aw = normalize(cross(up, Dw));
    float lw = log2(max(dist, 20.0) / 20.0), kw = floor(lw), fw = lw - kw;
    // (and it is torn anew as it goes: a white horse forms and is gone in two or three seconds)
    vec3 qw = vec3(dot(vBody, Aw) / 1.9, dot(vBody, Dw) / 0.62, dot(vBody, up) / 0.62 + uTime * 0.3) + drift * 3.0;
    float t0 = texture(uNoise3D, qw / exp2(kw) + 0.13).r, t1 = texture(uNoise3D, qw / exp2(kw + 1.0) + 0.57).r;
    float tw = mix(t0, t1, fw);
    tw = 0.5 + (tw - 0.5) * (1.0 + 0.45 * fw * (1.0 - fw) * 4.0);      // (the blend of two octaves is flatter: restored)
    torn = mix(torn, tw * 0.75 + r2.g * 0.25, smoothstep(14.0, 28.0, dist));
    tornW = tw;
  }
  // (the crest line itself: high water where the slope along the waves' way turns over)
  float sAlong = abs(dot(wv.yz, sdir));
  float crest = smoothstep(0.25, 0.70, hN) * (1.0 - smoothstep(0.07, 0.24, sAlong)) * smoothstep(0.36, 0.50, torn) * (0.35 + 0.65 * uDayness);
  // (a whitecap is not a white sheet: torn dabs of paper on the front of the crest, with the
  // sea's own wash showing between them)
  float foam = cf.y * smoothstep(0.40, 0.90, hN) * smoothstep(0.44, 0.58, torn) * keep;
  // far off: the same share of white, as a few anchored dabs
  float capFar = sea.y < 1.0e8 ? smoothstep(0.02, 0.12, sea.w) : 0.0;
  float capTh = 0.70 - 0.55 * sea.w;
  foam = max(foam, capFar * (1.0 - keep) * smoothstep(capTh, capTh + 0.05, r3.r * 0.6 + r1.g * 0.4) * (1.0 - smoothstep(500.0, 1500.0, dist)));
  // (a sea running high breaks all over: white horses beyond the first ten metres whether or not the waves under
  // them are drawn, each a torn dash lying along its wave, sized to the distance, grouped by the sets, more on the
  // crests, forming and going. Between 30 and 150 m nothing broke at all: the near crests are dropped there as finer
  // than the brush, and the far strokes have not begun)
  // (PAINTER 12: and wherever the sea map says this water is breaking, by its own share of white, however low the
  // waves: a fresh breeze on Earth's coast whitens a twentieth of the sea with Hs half a metre, and none showed)
  float galeW = max(smoothstep(0.5, 2.0, sea.x) * (sea.y < 1.0e8 ? 1.0 : 0.6), sea.y < 1.0e8 ? 0.85 * smoothstep(0.012, 0.07, sea.w) : 0.0);
  float horseTh = 0.68 - 0.11 * galeW;      // (PAINTER 17: 0.08; Earth's coast in its 13 m/s storm, a twentieth of it white by PHYSICS, showed no white horse at 640 x 360)
  foam = max(foam, galeW * smoothstep(horseTh, horseTh + 0.06, tornW * 0.62 + r3.r * 0.38) * (0.55 + 0.45 * smoothstep(-0.3, 0.5, hN)) * smoothstep(10.0, 30.0, dist) * (1.0 - smoothstep(600.0, 1500.0, dist)));
  // (in the shallows the breaking crests are white, ragged lines; at the waterline a thin
  // broken edge of swash that can still be seen from far off)
  float sz = pcPhysWaterSurfAt(vDep, sea);
  // (beyond twenty metres the surf is torn by the pattern sized to the distance: a 0.6 m pattern there was a
  // glitter of white pixels over the shoaling bay)
  float surf = sz * sz * smoothstep(0.50, 0.85, hN + mix((r2.b - 0.5) * 0.7 + (r6.g - 0.5) * 0.5, (tornW - 0.5) * 1.3, smoothstep(14.0, 28.0, dist)));
  // (the swash runs up the shore with each wave and draws back: the depth here is the still depth plus
  // PHYSICS' run-up; and its lace is carried in with the waves, torn anew as it goes. A rim drawn from the
  // still depth and a still pattern was frozen from frame to frame)
  vec3 D3 = normalize(pcPhysWaterDir(sdir));
  vec4 rsw = texture(uNoise3D, (vBody - D3 * (uTime * 0.55)) / 1.35);
  // (PAINTER 17: a sea of half a metre and more runs further up the beach and its lace is closer: the storm's waterline
  // was a hair of white at 640 x 360, lost to the brush)
  float swK = smoothstep(0.30, 0.60, hs);
  float swash = (1.0 - smoothstep(0.03, 0.05 + (0.22 + 0.30 * swK) * hs, vDep)) * smoothstep(0.04, 0.3, sea.x);
  // (lace, not a sheet: where the run-up is a film over the sand the foam is torn wide open)
  float film = 1.0 - smoothstep(-0.25, 0.02, vDepth);
  surf = max(surf, swash * smoothstep(0.40 + 0.05 * film - 0.07 * swK, 0.60 + 0.05 * film - 0.07 * swK, rsw.g * 0.6 + r1.b * 0.4 + 0.25 * hN));
  // (PHYSICS' critique of PAINTER, item 4: no surf at the beach in a storm. The surf above is drawn on the crests of waves
  // the mesh carries; where they are finer than the brush, a few metres out already at 640 x 360, nothing broke at all.
  // There the surf zone PHYSICS gives is laid as torn foam carried in with the waves: ragged lines along the shore,
  // the sea's wash between them, never a white band)
  surf = max(surf, sz * (1.0 - keep) * smoothstep(0.50, 0.66, tornW * 0.45 + rsw.g * 0.40 + r1.b * 0.15) * smoothstep(0.10, 0.45, sea.x));
  // far off, where the waves are finer than the brush can hold: the swell as a painter lays it,
  // long broken strokes lying the way the crests lie (anchored to the planet), the hollow before
  // each one darker, and on a sea that is breaking a white horse here and there along them
  float farWhite = 0.0;
  // (seen across the water a swell 20 m long is a hair's breadth on the sheet: the strokes are
  // spaced by what the brush can hold there, a dozen pixels, in octaves that give way to one
  // another with distance, each one fixed to the planet)
  vec3 A3 = normalize(cross(up, D3));
  // (a sea running high: deeper hollows, paler backs and more white horses, so a gale reads from the shore)
  float gale = smoothstep(0.6, 2.6, sea.x);
  float qd = dot(vBody, D3);
  float lk = max(0.0, log2(max(13.0 * PC_FWQ, 1.0e-3) / 8.5) / 1.3785);
  // (far: where a pixel is wider than the brush can draw a wave in, a metre or two of sea)
  PC_WDECL farSea = smoothstep(0.35, 1.6, PC_FWQ + PC_FWA) * smoothstep(0.03, 0.22, sea.x) * liq * deep;
  if (farSea > 0.01) {
    float k0 = floor(lk), kf = lk - k0, capTh2 = 0.68 - 0.45 * sea.w - 0.13 * gale;
    float sw = 0.0, wh = 0.0, hol = 0.0;
    for (int i = 0; i < 2; i++) {
      float L = 8.5 * pow(2.6, k0 + float(i)), wgt = i == 0 ? 1.0 - kf : kf;
      float q = qd / L + (texture(uNoise3D, vBody / (L * 6.0) + 0.3).r - 0.5) * 1.6;
      float id = floor(q), s = fract(q);
      float br = texture(uNoise3D, vec3(dot(vBody, A3) / (L * 4.0), id * 0.371, id * 0.117)).r;
      float ln = smoothstep(0.70, 0.82, s) * (1.0 - smoothstep(0.92, 1.0, s));
      sw += wgt * ln * smoothstep(0.40, 0.54, br);
      // (a white horse is a dash at least two pixels deep: seen across the water the band was a tenth of a pixel tall,
      // and a long dash along its wave came out as a row of single white specks, a glitter)
      // (PAINTER 13: three pixels deep at least, and broken along the crest into dashes a few metres long: seen from a
      // beach, the eye 2 or 3 m up, a dash two pixels deep was taken by the brush (it keeps nothing under three pixels)
      // and Neptune's gale, 15 % of it white, showed hardly a white horse)
      float c0 = 0.78 - 0.05 * gale, bw = clamp(3.4 * fwidth(q), 0.07, 0.36);
      float brk = texture(uNoise3D, vec3(dot(vBody, A3) / (L * 0.9), id * 0.53 + 0.2, id * 0.29 + 0.71)).g;
      wh += wgt * smoothstep(c0 - bw * 0.5, c0, s) * (1.0 - smoothstep(c0 + bw * 0.4, c0 + bw * 0.9, s)) * smoothstep(capTh2, capTh2 + 0.05, br) * smoothstep(0.40, 0.52, brk);
      hol += wgt * smoothstep(0.28, 0.52, s) * (1.0 - smoothstep(0.66, 0.76, s)) * smoothstep(0.35, 0.60, br);
    }
    c = pcDensity(c, 1.0 + farSea * (hol * (0.75 + 0.60 * gale) - sw * 0.25));
    c = mix(c, skyc, farSea * sw * (0.50 + 0.22 * gale));
    // (the share of white sets how many dashes break (capTh2); each one that breaks is white: a fresh breeze's 5 % of
    // white drew its few dashes at a quarter strength, and none read)
    farWhite = farSea * wh * smoothstep(0.008, 0.05, sea.w) * (0.35 + 0.65 * uDayness) * (1.0 - smoothstep(900.0, 2200.0, dist));
  }
  PC_WDECL white = max(max(max(crest * 0.85, foam) * deep, surf * smoothstep(0.0, 0.03, vDep)) * liq, farWhite);
  // (PHYSICS P26: the cap on white water is lifted and the sea's white share, sea.w, runs to 1; the coordinator's ruling:
  // paint whatever share comes as broken foam, streaks and spray, never a flat white area. To 0.15 the caps above are the
  // picture, as they were. Beyond it the crests' foam is blown into streaks along the wind, drawn out twelve to one and
  // sized to the distance, the sea's own wash dark between them; from about a half the streaks close up and the whole
  // sea rises toward the paper: driven foam with the waves' own values still in it, the troughs greyer, the fronts of
  // the crests bare paper, torn everywhere. Neptune's squall, 100 % white by PHYSICS, was the same dark indigo band.)
  float wOver = sea.y < 1.0e8 ? smoothstep(0.15, 0.60, sea.w) * liq * deep : 0.0;
  if (wOver > 0.001) {
    float lsS = log2(max(dist, 12.0) / 12.0), ksS = floor(lsS), fsS = lsS - ksS;
    vec3 qS = vec3(dot(vBody, A3) / 0.9, dot(vBody, D3) / 11.0 - uTime * 0.05, dot(vBody, up) / 0.9) + drift * 2.0;
    float s0 = texture(uNoise3D, qS / exp2(ksS) + 0.31).g, s1 = texture(uNoise3D, qS / exp2(ksS + 1.0) + 0.77).g;
    float sk = mix(s0, s1, fsS);
    sk = 0.5 + (sk - 0.5) * (1.0 + 0.45 * fsS * (1.0 - fsS) * 4.0);
    float closeUp = smoothstep(0.50, 1.0, sea.w);
    float sth = mix(0.60, 0.40, closeUp);
    float streak = smoothstep(sth, sth + 0.10, sk * 0.75 + tornW * 0.25) * (0.55 + 0.45 * smoothstep(0.36, 0.60, torn));
    float form = 0.42 + 0.58 * smoothstep(-0.5, 0.6, hN);
    white = max(white, wOver * max(streak * form, closeUp * 0.46 * form * (0.75 + 0.5 * (tornW - 0.5))));
  }
  #ifdef PC_WCUT
  }
  #endif
  glint = max(glint, white);
  c = mix(c, vec3(1.0), glint);
  // (a sea running high keeps its body under the murk: in a gale the air is thick enough to
  // swallow the far water whole, strokes and all, and a storm sea painted as a pale blank is
  // no sea; the painter keeps it darker than the sky to the horizon and lets the stacks go pale)
  // (and what glows is seen through the haze: lava keeps its fire into the distance)
  float wLitN = 0.0, wMarkN = 0.0;      // (the night's pull, below: the light strokes and the sun's or moon's marks)
  #ifdef PC_OIL
  {
    // water in strokes: short thin dashes lying along the water (the world's own chart, so they stay where they are),
    // a share of them a step lighter and carrying the sky's colour, a share a step deeper, nothing drawn between two.
    // (The overhaul plan's seventh piece: toward the sun or the moon a share of the dashes are the light itself, a path
    // of broken marks; under an aurora, by night, a share are its green, as the clip's lake carries its aurora. The
    // chart's derivatives come from a position measured from the eye: chunks.js pcGroundChartD.)
    vec2 wch = pcGroundChart(vBody, uBodyR);
    vec2 wdx = pcGroundChartD(vBody, -dFdx(vToCam), uBodyR), wdy = pcGroundChartD(vBody, -dFdy(vToCam), uBodyR);
    vec3 wr1, wr2; vec2 wds; float wown;
    float wStill = 0.0;      // (how still the water is here, for the new colour below: the new paint's own, 0 in v37's)
    // (and the churn's own chart, below: it is turned to the current on a far lower floor than the dashes are,
    // because white water must MOVE even in an eddy, where the body of the water is rightly laid still)
    vec2 ach = wch, adx = wdx, ady = wdy;
    #ifdef PC_WPAINT
    // (the lace's way, pace and octave in the new paint: set below)
    vec2 aDir = vec2(1.0, 0.0); float aSpd = 0.0; vec4 ao4 = vec4(1.0, 0.0, 0.0, 0.0); vec3 aoc3 = vec3(0.0);
    if (uWPaint > 0.5) {
      // THE WATER'S NEW PAINT (lane W3, ?wpaint=2; the strokes themselves in render/waterchunk.js pcWStrokes).
      // STILL WATER LAID STILL. How still the water is here comes from the mesher (vStill: a pond, a lake, the sea,
      // and a widened pool whose "current" turns round on itself -- the junction pond that was painted as a whorl);
      // where two currents disagree across a triangle (an eddy, at a meeting of waters) it is still as well, by
      // v33's own test. Still water's strokes lie ALONG THE CRESTS OF THE WIND'S WAVES (PHYSICS' wave direction, turned
      // by the sea map toward a shore: the same way the sea's far swell is laid, below), long and level, and do not
      // run; where the water has a current they lie along it and run with it at its own pace, as v33 made them.
      vec2 fl = vFlow * (255.0 / 127.0) - (128.0 / 127.0);
      float coh = vFlow.x + vFlow.y > 0.004 ? dot(fl, fl) : 0.0;
      vec3 Uf = normalize(abs(up.y) < 0.9 ? vec3(-up.z, 0.0, up.x) : vec3(0.0, up.z, -up.y));
      vec2 fc = pcGroundChartD(vBody, Uf * fl.x + cross(up, Uf) * fl.y, uBodyR);
      fc = dot(fc, fc) > 1e-12 ? normalize(fc) : vec2(1.0, 0.0);
      vec2 kc = pcGroundChartD(vBody, cross(up, pcPhysWaterDir(sdir)), uBodyR);
      kc = dot(kc, kc) > 1e-12 ? normalize(kc) : vec2(1.0, 0.0);
      float still = max(vStill, 1.0 - smoothstep(0.30, 0.56, coh));
      wStill = still;
      vec2 dS = mix(fc, dot(kc, fc) < 0.0 ? -kc : kc, still);
      dS = dot(dS, dS) > 1e-6 ? normalize(dS) : kc;
      float v0 = ${FLOW_V0};
      // NO SIZE JUMP: two octaves, each stroke of the finer one there or not by its own number (pcWStrokes). And where
      // the rows are squeezed on the screen (seen low, the rows stacked away from the eye) the strokes are laid larger,
      // by how much the rows are squeezed, up to three times: sized by the distance alone the rows went under two
      // pixels and the finer octave's thinning strokes were dotted lines, a lattice of specks (the first stills of
      // this paint, E4 at the phone's size). The squeeze is worked out from the way the rows stack and the way the eye
      // looks, both smooth over the water: the rows' own size on the screen is a derivative, and the octave's derivative
      // taken from it was blocky from one square of pixels to the next and frayed the strokes' ends.
      vec3 f3 = Uf * fl.x + cross(up, Uf) * fl.y, k3 = cross(up, pcPhysWaterDir(sdir));
      vec3 d3 = mix(dot(f3, f3) > 1e-6 ? normalize(f3) : k3, dot(k3, f3) < 0.0 ? -k3 : k3, still);
      float rowF = length(cross(cross(up, dot(d3, d3) > 1e-6 ? normalize(d3) : k3), Vd));
      float graze = 1.0 / max(rowF, 0.333);
      vec4 wo4 = pcStrokeOct4(dist * graze * 1.1, uOilPx.z * 1.1);
      vec3 woc3 = vec3(wo4.w - wo4.z, dFdx(wo4.w), dFdy(wo4.w));
      // (with the new colour, still water's strokes are longer, as calm water is laid: the look director, on E3)
      pcWStrokes(wch, wdx, wdy, dS, v0 * (1.0 - still), wo4.x, uWPaint > 1.5 && still > 0.5 ? 10.0 : 6.0, woc3, wr1, wr2, wown);
      // (the lace: along the current wherever there is one, at the water's own pace, on its own octaves)
      aDir = coh > 0.02 ? fc : kc; aSpd = coh > 0.02 ? v0 : 0.0;
      ao4 = pcStrokeOct4(dist * graze * 1.1, uOilPx.z * 0.40);
      aoc3 = vec3(ao4.w - ao4.z, dFdx(ao4.w), dFdy(ao4.w));
    } else
    #endif
    {
    vec2 woc = pcStrokeOct(dist * 1.1, uOilPx.z * 1.1);
    // (long thin dashes, and the deep ones well deeper: short and all pale, a stream was a strip of pale flat patches,
    // "low-poly ice": the critic)
    // THE CURRENT (the owner, 2026-11-16: "the rivers should be moving with the flow of the current same for the art
    // of it"). Where the water has a current its dashes are laid ALONG it and run WITH it: the chart is turned to the
    // current's own direction about the middle of a patch some twenty-six metres across (patches with wavy bounds, each
    // with its own dashes and its own pace, 0.9 to 1.4 m a second), and slid along it with the clock. Within a patch the
    // direction is the pixel's own, so the dashes curve with a bend. Still water (a lake, the sea) is laid as before.
    // AND THE SPEED THE FALL GIVES IT (the owner, 2026-11-23: water "constantly moving the way water would be
    // naturally ... how it goes down hill"). Until v33 every dash on every river ran at the same 0.9 to 1.4 m/s: the
    // flow vector was normalised before it was packed and its magnitude thrown away. The mesher now measures the
    // water's own speed where each vertex stands, from the fall of the liquid's own surface and the depth (Manning's
    // open channel; world/patchgen.js), and hands it over in vTurb.x -- a byte of 5 m/s. A 0 there means the mesher
    // gave none (a mesh built before this, or the attribute not attached) and the old fixed rate is kept, so nothing
    // of the look moves until the number arrives.
    float flowV = 1.15;      // (never read unless a current turns the chart below; the middle of v33's band)
    vec2 sch = wch, sdx = wdx, sdy = wdy;
    if (vFlow.x + vFlow.y > 0.004) {
      vec2 fl = vFlow * (255.0 / 127.0) - (128.0 / 127.0);
      float coh = dot(fl, fl);
      if (coh > 0.02) {
        vec3 upF = normalize(vBody);
        vec3 Uf = normalize(abs(upF.y) < 0.9 ? vec3(-upF.z, 0.0, upF.x) : vec3(0.0, upF.z, -upF.y));
        vec2 fc = pcGroundChartD(vBody, Uf * fl.x + cross(upF, Uf) * fl.y, uBodyR);
        fc /= max(length(fc), 1e-6);
        vec2 nc = vec2(-fc.y, fc.x);
        vec2 cellF = floor(wch / 26.0 + 0.30 * vec2(sin(wch.y * 0.23), sin(wch.x * 0.19)) + 0.5);
        vec2 relF = wch - cellF * 26.0;
        float hf = fract(sin(dot(cellF, vec2(12.9898, 78.233))) * 43758.5453);
        flowV = ${FLOW_EXPR};
        vec2 tch = vec2(dot(relF, fc) - uTime * flowV + hf * 173.0, dot(relF, nc) + hf * 91.0);
        vec2 tdx = vec2(dot(wdx, fc), dot(wdx, nc)), tdy = vec2(dot(wdy, fc), dot(wdy, nc));
        ach = tch; adx = tdx; ady = tdy;
        // (a current is a full-length arrow at every point of the mesh; where two that disagree are blended across a
        // triangle, at a meeting of waters, the blend is short and turns from pixel to pixel: there the water is laid
        // still, as an eddy is, or its dashes would be a stipple. This is v33's own test, to the number)
        if (coh > 0.56) { sch = tch; sdx = tdx; sdy = tdy; }
      }
    }
    pcThinLayer(sch, sdx, sdy, woc.x, 11.0, vBody, 60.0, 4.0, wr1, wds, wown, wr2);
    }
    // (water is deeper and bluer than the air over it: looking toward the sun a stream took the pale sky whole and a
    // wide share of its dashes were the sun's own, and the river was a pale gravel road through the grass: the stills
    // of 2026-11-16. Its body is half the water's own wash laid heavy and blue, whatever the sky gives it, and the sun's path is a narrow run of marks.)
    float wBodyD = 1.9, wBodyK = 0.55, wSunE = 56.0, wSunK = 0.6;
    vec3 wLightC = mix(skyc, vec3(1.0), 0.25);
    #ifdef PC_WPAINT
    if (uWPaint > 1.5) {
      // THE WATER'S BODY BY ITS DEPTH (the new paint): its own wash laid heavier the deeper it is -- a brook and the
      // shallows a lighter blue, a river's middle and a lake deep (the owner's aerial river sheets: deep blue in the
      // middle, lighter at the edges); the light strokes carry the sky as it is, not whitened; and THE SUN'S PATH
      // carries far: its lobe widens with the distance (56 near, 22 from a kilometre), so a sea or a lake looked at
      // toward the sun keeps a path of broken light to the horizon, where v37's lobe shrank under a stroke.
      // (and from the air a step deeper still, as every one of the owner's aerial references lays far water darker than
      // the land's haze: measured at E3 from 150 m the water stood at median value 0.80 against the land's 0.51)
      float dk = smoothstep(0.25, 2.5, vDep), dfar = smoothstep(80.0, 450.0, dist);
      wBodyD = mix(1.45, 2.15, dk) + 0.9 * dfar; wBodyK = mix(0.42, 0.62, dk);
      wLightC = skyc;
      float fs = smoothstep(120.0, 1200.0, dist);
      wSunE = mix(56.0, 22.0, fs); wSunK = mix(0.6, 0.45, fs);
    }
    #endif
    #ifdef PC_WPAINT
    vec3 cRef = c;      // (what the water mirrors and shows here, before its own body is laid: the new paint, below)
    #endif
    c = mix(c, pcDensity(vLiq.rgb, wBodyD) * vec3(0.80, 0.95, 1.06), wBodyK * (1.0 - vLiqP.x) * (1.0 - vLiqP.y));
    vec3 cdeep = pcDensity(c, 2.1) * vec3(0.90, 0.92, 1.0), clight = mix(c, wLightC, 0.45);
    float wThL = 0.62, wThD = 0.30;
    #ifdef PC_WPAINT
    if (uWPaint > 1.5) {
      // BROKEN COLOUR, NOT A MIXTURE (the new paint). v37 mixed the water's blue body into what it mirrors, pixel by
      // pixel, and laid its strokes a step lighter and darker than that mixture: under a golden sky a blue body and a
      // cream sky mixed make GREY, and from the air every water was grey (the design's w06, w09, w15, w16). Now the
      // strokes keep the two apart, as a painter lays water: the deep strokes are the water's own body, the light ones
      // what it mirrors (the sky as it is, the land's reflection where the last frame gives it), the middle ones the
      // two in the share the angle gives (more of the mirror the lower the eye looks across the water). And the lower
      // the angle the more of the strokes are the mirror's, as far water is. Lava and a sea of cloud keep v37's way.
      // (FROM FORTY METRES OUT, all of it by two hundred: near the eye v37's strokes -- navy, the body, a step lighter --
      // are what the design found reads well from the bank, and laid as broken colour there the brook went a pale flat
      // cyan in the first stills of this paint, E2.)
      vec3 body = pcDensity(vLiq.rgb, wBodyD) * vec3(0.80, 0.95, 1.06);
      // (the mirror's share held under three fifths, and the light strokes a quarter the body's: with more, the water
      // from the air went LIGHTER than the land, median value 0.80 at E3, where the look rules hold it inside the land's)
      // STILL WATER IS THE CALMEST THING ON THE MAP (the look director on the step-1 stills, E3: the pond read as crumpled
      // foil, paler and busier than the river). So where it is still: its body a step deeper than the river's chop,
      // less of the mirror in it, its strokes in two or three close values (few light ones, few deep ones), and white
      // only where the sun's path crosses it. And all far water inside the look rules' water band (value 0.45 to 0.70,
      // the water group's lead and the look director: it stood at 0.77 to 0.80 from 150 m).
      body = pcDensity(vLiq.rgb, wBodyD + 0.45 * wStill) * vec3(0.80, 0.95, 1.06);
      float fr = clamp(0.10 + 0.40 * fres, 0.0, 0.50) * (1.0 - 0.4 * wStill), bk = smoothstep(40.0, 220.0, dist) * liq;
      vec3 cN = mix(body, cRef, fr), dN = pcDensity(body, mix(1.3, 1.12, wStill)) * vec3(0.90, 0.92, 1.0);
      vec3 lN = mix(body, mix(cRef, skyc, 0.35), mix(0.62, 0.30, wStill));
      c = mix(c, cN, bk); cdeep = mix(cdeep, dN, bk); clight = mix(clight, lN, bk);
      wThL = mix(0.62, mix(mix(0.72, 0.50, fres), 0.86, wStill), bk); wThD = mix(0.30, mix(mix(0.36, 0.22, fres), 0.16, wStill), bk);
    }
    #endif
    float wsp = pow(max(dot(reflect(-normalize(vToCam), up), uSunDirL), 0.0), wSunE) * wSunK * max(uDayness, uMoon) * (1.0 - uWx.x);
    vec3 wsun = min(mix(pcOilSunC(), vec3(1.0), 0.35) * 1.06, vec3(1.0));
    float wau = uAuroraK * (1.0 - uDayness);
    vec3 w1 = wr1.x > wThL ? clight : (wr1.x < wThD ? cdeep : c), w2 = wr2.x > wThL ? clight : (wr2.x < wThD ? cdeep : c);
    w1 = wr1.z < 0.34 * wau ? mix(vec3(0.10, 0.74, 0.60), vec3(0.24, 0.96, 0.56), step(0.5, fract(wr1.z * 31.7))) : w1;
    w2 = wr2.z < 0.34 * wau ? mix(vec3(0.10, 0.74, 0.60), vec3(0.24, 0.96, 0.56), step(0.5, fract(wr2.z * 31.7))) : w2;
    w1 = wr1.y < wsp * 1.2 ? wsun : w1; w2 = wr2.y < wsp * 1.2 ? wsun : w2;
    // (for the night's pull, at the end: which of the pixel's strokes are light ones, and which the sun's or the moon's marks)
    wLitN = mix(wr2.x > wThL ? 1.0 : 0.0, wr1.x > wThL ? 1.0 : 0.0, wown);
    wMarkN = mix(wr2.y < wsp * 1.2 ? 1.0 : 0.0, wr1.y < wsp * 1.2 ? 1.0 : 0.0, wown);
    c = mix(w2, w1, wown);
    #ifdef PC_WWAKE
    // (the player's own rings, painted: where a ring's face is steep the stroke there takes the light step, in a line
    // as thin as the ring's own crest; ?wakes=2, physics/splash.js)
    c = mix(c, clight, smoothstep(0.035, 0.12, length(wk2.yz)) * 0.75 * liq);
    #endif
    // AERATED WATER, AS PAINT (the owner, 2026-11-23: "airration" -- the white of a rapid, the lace below a fall,
    // the stirred edge where water meets rock). The foam above this is the SEA's, raised by the wind, and the game
    // had no other: nothing anywhere went white because the bed made it. The mesher measures the churn where each
    // vertex stands (vTurb.y: the Froude number of the flow, the fall of the water's own face, and how thin it runs
    // over a tilted bed -- world/patchgen.js) and it is laid in the same thin strokes the water itself is painted in,
    // on their own octave so a mark is never finer than the brush, drawn out half again as long, and carried
    // downstream at the current's own pace. Never a wash and never a grain, which the look forbids.
    float aer = min(vTurb.y * ${AER_K}, 1.0) * liq;      // (liq, from above: not lava and not a sea of cloud)
    if (aer > 0.012) {
      // the body first: churned water carries so much air that the bed and the mirror stop showing through it, and
      // its colour goes to a pale MILK of its own wash. Not to white: a flat white area is not water, it is paper.
      c = mix(c, mix(vec3(0.90, 0.94, 0.95), pcDensity(vLiq.rgb, 1.25), 0.30), aer * 0.66);
      // then the lace: a share of the fine strokes is bare white, the share growing with the churn, and the milk
      // shows between them. A smaller base width in pcStrokeOct gives finer strokes NEAR and exactly the same ones
      // far off, where it clamps to what the brush can hold -- which is why this cannot turn into a speckle.
      vec3 ar1, ar2; vec2 ads; float aown;
      #ifdef PC_WPAINT
      if (uWPaint > 0.5) pcWStrokes(wch, wdx, wdy, aDir, aSpd, ao4.x, 9.0, aoc3, ar1, ar2, aown);      // (half again as long as the body's, as v37's lace was)
      else
      #endif
      {
      vec2 aoc = pcStrokeOct(dist * 1.1, uOilPx.z * 0.40);
      pcThinLayer(ach, adx, ady, aoc.x, 16.0, vBody, 60.0, 4.0, ar1, ads, aown, ar2);
      }
      // (at full churn four strokes in five break, and they break to bare paper; a faintly stirred reach breaks a
      // few and breaks them only part of the way, or the first whisper of churn would be a sparkle of white specks)
      float ath = 1.0 - aer * 0.78;
      c = mix(c, vec3(1.0), mix(step(ath, ar2.x), step(ath, ar1.x), aown) * (0.30 + 0.70 * aer));
    }
  }
  #endif
  #ifdef PC_OIL
  // THE NIGHT (the water group's paint, lane W3; the look director's night key, L1, chunks.js pcNight). By the moon the
  // land goes part of the way to its own value in the night key's hue and is laid at the night's strength (pcTone),
  // but the water never passes through pcTone: by night the stream stayed the day's blue, laid half of its own wash
  // "whatever the sky gives it", and was the lightest, bluest thing in the wood. So the water takes the same pull and the
  // same strength as the land's lit paint (pcTone: lit * mix(1.0, uLookN.x, nk)). The lava and the sea of cloud glow or
  // are their own colour and keep it. By day uMoon is 0 and this is the colour untouched; ?nightkey=0 (uLookF.x 0) is the
  // night water as it was.
  {
    float nkW = uMoon * uLookF.x;
    // (the look director, on the night stills: the strokes that catch the sky keep a step of light over the pulled body,
    // so the river still reads as moving water, and the moon's own path is left out of the pull)
    if (nkW > 0.0) c = mix(c, pcNight(c) * mix(1.0, uLookN.x, nkW * (1.0 - 0.45 * wLitN)), liq * (1.0 - wMarkN));
  }
  #endif
  float f = pcFogAmount(dist) * (1.0 - 0.45 * farSea) * (1.0 - 0.6 * vLiqP.x);
  #ifdef PC_WPAINT
  // (the new paint: water is a glossy surface and reads darker than the land's haze at a distance in every one of the
  // owner's aerial references; from 60 m the air takes less of it, a third less from 450 m. To be agreed with the look director.)
  if (uWPaint > 1.5) f *= 1.0 - 0.35 * smoothstep(60.0, 450.0, dist) * liq;
  #endif
  c = pcAtmosV(c, f, vView);
  pcWrite(c, mix(mix(0.7, 0.22, white), 1.0, vLiqP.y), normalize(normalMatrix * up), -vView.z, 2.0);
}
`;

// THE WATER'S CUTS (?wcut= with the oil look; the coordinator, 24 Nov 21:36: the owner's phone found the water the second
// largest cost, 5.3 ms at the brook's bank and at least 4.2 ms from 400 m). Bits of one uniform, uWCut; the shader's own
// account is at WATER_FRAG's PC_WCUT. The three CUTS, candidates for the default: lava (1), calm (2), march (4); ?wcut=1
// turns all three on, any other number is its own sum of bits (so ?wcut=2 is the calm cut alone, ?wcut=8 the flat colour).
// The three PRICING bits (flat, noMarch, noWaves) are the speed test's, never a candidate. Compiled in with the switch, or
// for the speed test's water table (?bench=water) at whatever the switch says; without either, v37's program to the letter.
export const WCUT = { cuts: 7, lava: 1, calm: 2, march: 4, flat: 8, noMarch: 16, noWaves: 32 };
export const WCUT_U = { uWCut: { value: 0 } };

export function makeWaterMaterial(bodyU, skyU) {
  const m = new THREE.ShaderMaterial({
    name: 'pc-water',
    uniforms: baseUniforms(bodyU, {
      uOrigin: { value: new THREE.Vector3() }, uCamLocal: { value: new THREE.Vector3() },
      uSkyZenith: skyU.uSkyZenith, uSkyHorizon: skyU.uSkyHorizon,
      uReflDark: { value: new THREE.Vector3(0.40, 0.52, 0.42) },
      uBed: { value: new THREE.Vector3(0.80, 0.70, 0.52) },
      uTreeLine: { value: 0.30 },
      uPrevTex: G.uPrevTex, uPrevOn: G.uPrevOn,
      uPhysAnchor: PHYS.uPhysAnchor, uPhysEast: PHYS.uPhysEast, uPhysNorth: PHYS.uPhysNorth, uPhysUp: PHYS.uPhysUp,
      ...PHYSW,
    }),
    // (PHYSICS' sea map, P18/P19: the uniforms come with PHYSW; without the define the chunk is as before)
    defines: { PC_PHYS_SEA_MAP: 1 },
    vertexShader: WATER_VERT, fragmentShader: WATER_FRAG,
  });
  // (the powers, ?powers=1: the water is compiled with the parted channel; without the flag its program is as it was)
  if (MODE.powers) { m.defines.PC_POWERS = 1; m.uniforms.uPwChanA = G.uPwChanA; m.uniforms.uPwChanB = G.uPwChanB; }
  // (the player's own small waves, ?wakes=2 with the oil look: render/waterchunk.js turns physics' set on)
  if (wakesOn()) { m.defines.PC_WWAKE = 1; m.uniforms.uWWake = WAKE_U.uWWake; m.uniforms.uWWakeN = WAKE_U.uWWakeN; }
  // (the water's new paint, ?wpaint=2 with the oil look: compiled in behind one uniform the speed test can turn off;
  // without the switch the program is v37's, to the letter. render/waterchunk.js)
  if (wpaintOn()) { m.defines.PC_WPAINT = 1; m.uniforms.uWPaint = WPAINT.uWPaint; }
  // (the speed test's rows for the new paint, either way from how the run started: render/waterchunk.js benchWPaint)
  if (MODE.oil) { WATER_MATS.push(m); benchWPaint(); }
  // (the water's cuts: WCUT above)
  if (MODE.oil && MODE.water && (MODE.water.wcut || MODE.water.benchw)) {
    m.defines.PC_WCUT = 1; m.uniforms.uWCut = WCUT_U.uWCut;
    WCUT_U.uWCut.value = MODE.water.wcut === 1 ? WCUT.cuts : Math.max(0, MODE.water.wcut | 0);
  }
  m.userData.pcPainted = true;
  // (R1 W2.4: water drawn in this frame wants last frame's painting kept for the next: post.js finish)
  m.onBeforeRender = () => { PREV.water = true; };
  return register(m, 'water');
}

// ------------------------------------------------------------------------------------------
// Props: trees, undergrowth, rocks. One shader, instanced, parts selected per vertex.
//   aData.y part: 0 bark, 1 foliage mass, 2 blade / frond, 3 accent dab, 4 rock
// ------------------------------------------------------------------------------------------
// A LEAF'S SUN AND A LEAF'S SHADE, one text each, included by the plants' vertex shader (PROP_VERT, where a leaf is
// painted once a leaf) and by the cluster cards' fragment program (CARD_FRAG, where a leaf on a card is painted at its
// own centre): one recipe in two places of use, not two recipes. (The shade is R1.2b's foliage shade, to be replaced
// in both at once when the look director's shared one lands.)
const LEAF_SUN = /* glsl */`
// (chunks.js pcSunAt: the shadow map inside its square. Outside it the fragment shader reads a pattern from the noise;
// a leaf takes its own number in the pattern's place: the same share of leaves in the sun)
float pcSunAtV(vec3 bodyPos, float canopy, float r) {
  float pat = mix(step(mix(0.05, 0.585, canopy), r), 1.0 - 0.42 * canopy, uWx.x);
  if (uShK.x >= 0.004) {
    vec3 q = (uShM * vec4(bodyPos, 1.0)).xyz;
    vec2 a = abs(q.xy);
    float inside = (1.0 - smoothstep(uShK.w, 0.97, max(a.x, a.y))) * uShK.x;
    if (inside >= 0.004) return mix(pat, step(q.z - uShK.y, textureLod(uShTex, q.xy * 0.5 + 0.5, 0.0).r), inside);
  }
  return pat;
}
// (the trees lane's one leaf shade, for its own programs: since the merge with the look director's lane it IS the shared
// foliage shade, chunks.js pcShadeLeaf, whose off branch (uLookF.y 0, the default without ?light=new) is this recipe
// exactly: pcBody(pcDensity(cs, 1.35)) * mix(vec3(1.0), pcOilShadeC(), 0.5) * 0.80)
vec3 pcLeafDeep(vec3 cs) { return pcShadeLeaf(cs); }
`;

const PROP_VERT = /* glsl */`
${VERT_PARS}
${FOG_VERT}
#ifdef PC_TREE_CARD
// (?treedepth=1: the cards are drawn twice, depth first and then colour where the depth is EQUAL, by two programs
//  built from this one text; the place of every corner must come out the same to the last bit in both)
invariant gl_Position;
#endif
attribute vec4 aData;     // x sway, y part, z inner shade, w blob hash
attribute float aBranchId; // (trees) PHYSICS' crown: one number per branch and its foliage, -1 the trunk
attribute float aLeaf01;   // (trees) 1 on foliage
attribute vec3 aMass;     // soft "mass" normal of the whole crown
attribute vec4 aInst;     // per instance: x hue, y value, z seed, w canopy shade at its foot
attribute float aBorn;    // per instance: when it came into this mesh (the wash clock, s); negative: when it left (it is being lifted out)
#ifdef PC_FIRE
// (the powers, fire) PER INSTANCE: HOW FAR THIS PLANT'S CROWN HAS BURNED. 0 untouched, 1 burnt right out. A crown that
// has caught but not yet taken is kept below 0 in the record (data/burnt.js burnCrown), so it is clamped here. The
// world fills it for the trees that have burned and leaves it at 0 for every other plant (world/flora.js), and a mesh
// with no such numbers at all reads 0 (makePropMaterial sets that as its default), so nothing else is touched.
attribute float aBurnt;
varying float vBurnt;
uniform vec4 uBurnK;      // the scorch's dials (shared.js BURNPAINT): x how light the charcoal is laid, z how much of its own colour is left
#endif
#ifdef PC_OIL
attribute vec3 aCard;     // (the oil look's leaves, florakit.js leafCards: the centre of the leaf this vertex belongs to; elsewhere the vertex's own place)
varying vec3 vCardB;      // that centre on the body: a leaf is lit, shaded and lamp-lit whole
#endif
#ifdef PC_FAR
  attribute vec2 aInst2;  // species index into the far tables
  varying float vSpecies;
  uniform float uFarTaper[PC_NFAR];
  uniform float uFarTrunk[PC_NFAR];
  uniform float uFarDrop[PC_NFAR];
#endif
#ifdef PC_HOLLOW
  uniform vec4 uHollow;   // a spire's form in its own units: x girth at the foot, y height, z lean of the top along +Z (of the height)
  varying float vHollow;  // 0 the eye is clear of this one .. 1 the eye is inside it
#endif
uniform vec3 uOrigin;
uniform vec3 uCamLocal;
uniform vec4 uLod;        // min distance, max distance, jitter, fade start fraction
uniform vec3 uWashIn;     // x the wash clock now (s), y when this mesh was first laid, z how long a wash takes (s)
uniform float uWind;
uniform float uTime;
varying vec3 vBody;
varying vec3 vObj;
varying vec3 vNV;
varying vec3 vMassV;
varying vec3 vView;
varying vec2 vUv;
varying vec4 vData;
varying vec4 vInst;
varying float vWash;      // 1: fully laid; below: the strokes are still arriving (negative: being lifted out)
varying float vAbove;     // metres above the plant's foot (the sun flecks on a trunk continue the ground's)
varying float vFog;
#ifdef PC_OIL
varying vec3 vMassO;      // the crown's mass normal in the plant's own space: which way a crown's chart is laid
varying vec3 vRelO;       // the place measured from the eye, in the body's axes (its screen derivatives are exact)
// A LEAF'S PAINT, ONCE A LEAF (2026-11-16; the owner's phone, its own speed test: with the plants in one flat colour it
// drew 61 pictures a second, as set 26: the plants' paint, worked out for every pixel of every leaf, was 23 ms of a
// 39 ms frame). A leaf is one flat piece of colour, lit or shaded WHOLE: everything about it is known at its centre.
// So it is worked out here, in the vertex shader, the same at all the leaf's corners, and the fragment shader only
// lays it (and the lantern's light over it, by night). The picture is the same.
varying vec4 vLeafC;      // rgb the leaf's paint, toned to its light; a: how far the eye is from the leaf's centre (was vCardD)
varying vec4 vLeafK;      // rgb the leaf's own colour before the light (for the lantern); a: the plant's size (was vScaleO)
#define vCardD vLeafC.a
#define vScaleO vLeafK.a
#ifdef PC_TREE_CARD
// (a card of leaves, part 7: what is the same over the whole card, worked out here once and handed on unblended)
flat varying vec3 vCardC;   // its centre on the body, at rest
flat varying vec3 vCardU;   // one dab cell along the card's chart, on the body (the plant's size and the card's growth in it)
flat varying vec3 vCardV;   // one cell across it
flat varying vec3 vCardM;   // its mass normal, in the eye's space (the crown's roundness)
flat varying vec3 vCardLA;  // the tree's three leaf colours, after its own run of the wood's colours
flat varying vec3 vCardLB;
flat varying vec3 vCardLC;
flat varying vec4 vCardS;   // x its inner shade, y its number, z which way it faces the sky (pcUp), w 1 a tree of twigs
flat varying vec2 vCardR;   // x the radius of its corners (dab cells, on its chart), y the sun through it toward the eye
#endif
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
uniform float uNeedle;    // (?pines: a conifer's needles never narrower on the screen than this many pixels; 0 off, as before)
uniform float uNearLeaf;  // (?nearleaf: 1 the leaves within arm's length shrink about their centres; 0 off, as before)
uniform float uLeafGrow;  // (?leafgrow: the most a thinned broadleaf's kept leaf grows within 15 m of the eye, e.g. 1.15; 0 off, as before)
uniform float uStormLeaf; // (the share of the land's storm paint a crown takes at a full storm: 0.5 by default, ?stormleaf=0 off; flora.js)
uniform vec4 uOilPx;      // (x: the angle one pixel of the scene pass takes, radians: shared.js)
uniform mat4 uShM;
uniform highp sampler2D uShTex;
uniform vec4 uShK;
uniform vec3 uLeafA;
uniform vec3 uLeafB;
uniform vec3 uLeafC;
uniform vec4 uLeafFam;
uniform float uOilKind;
uniform float uCanopy;
#ifdef PC_FAR
  uniform vec3 uFarA[PC_NFAR];
  uniform vec3 uFarB[PC_NFAR];
  uniform vec3 uFarC[PC_NFAR];
  uniform vec4 uFarFam[PC_NFAR];
  uniform float uFarKind[PC_NFAR];
  uniform vec3 uSunDirL;    // the sun (by night the moon) in the BODY'S own axes, which is the frame a crown's pieces are measured in here. Every painted material is already handed it (baseUniforms); the far program is the only one of these that reads it.
#endif
${PC_UP_V}
${PAINT}
// (chunks.js pcDabTint and pcWetWash, as they stand there)
vec3 pcDabTintV(vec3 c, vec3 rnd, float leafy) {
  c = pcDensity(c, 1.0 + (rnd.x - 0.5) * 1.1 * uOilB.z);
  c *= mix(vec3(1.0), mix(vec3(1.10, 0.98, 0.80), vec3(0.88, 0.97, 1.10), rnd.y), 0.6 * uOilB.z);
  float odd = fract(rnd.y * 17.3);
  c *= mix(vec3(1.0), vec3(1.12, 0.66, 0.50), leafy * step(0.93, odd) * uOilB.z);
  c *= mix(vec3(1.0), vec3(0.78, 1.06, 0.52), leafy * step(odd, 0.13) * uOilB.z);
  return clamp(c, 0.0, 1.0);
}
vec3 pcWetWashV(vec3 c, float amt) {
  return pcDensity(c * mix(vec3(1.0), vec3(0.95, 0.96, 0.99), uWx.y * amt), 1.0 + 0.62 * uWx.y * amt);
}
${LEAF_SUN}
uniform vec4 uLeafLod;    // the trees' leaves by distance (flora.js): x the distance within which every leaf is drawn (0: off), y the least share kept
#endif
#if defined(PC_TREE_LEAF) || defined(PC_TREE_CARD) || defined(PC_TREE_WOOD)
uniform vec4 uFocus;      // (the trees' leaf program: the window round the explorer is cut here, whole leaves; flora.js _focus)
#endif

// MOTION. With PHYSICS' field (uPhysOn) plants bend as loaded stems: wind, gusts, things
// pushing through them (C14). Without it, this gentle sway stands in.
#ifdef PC_PHYS
${FLORA_GLSL}
uniform float uPhysOn;
uniform float uStiff;
uniform float uPlantHeight;
#endif
vec3 pcSway(float w, float phase) {
  float a = sin(uTime * 1.1 + phase) * 0.6 + sin(uTime * 2.7 + phase * 1.9) * 0.3;
  float b = cos(uTime * 0.8 + phase * 1.3) * 0.6;
  return vec3(a, 0.0, b) * w * uWind;
}

void main() {
  #ifdef USE_INSTANCING
    mat4 im = instanceMatrix;
    vec4 inst = aInst;
    // nothing snaps into being: a thing new to this mesh washes in over half a second, and one that
    // has changed tier is lifted out of its old mesh while it is laid in the new (the two patterns interlock)
    float wsh = clamp((uWashIn.x - max(abs(aBorn), uWashIn.y)) / uWashIn.z, 0.0, 1.0);
    vWash = aBorn < 0.0 ? -(1.0 - clamp((uWashIn.x + aBorn) / uWashIn.z, 0.0, 1.0)) - 1e-3 : wsh;
  #else
    mat4 im = mat4(1.0);
    vec4 inst = vec4(0.0, 0.0, 0.5, 0.7);
    vWash = 1.0;
  #endif
  #ifdef PC_FIRE
    vBurnt = clamp(aBurnt, 0.0, 1.0);      // (the powers, fire: how far this plant's crown has burned)
  #endif
  vec3 io = im[3].xyz;
  float di = distance(io, uCamLocal);
  #ifdef PC_HOLLOW
    // (the last fixes, the second blind player on Neptune: on foot the camera's boom and the landing camera pass into an
    // ice spire 17 to 27 m tall, and from inside one the eye saw only the few faces turned toward it, hard-edged dark
    // polygons at the corners of the frame. A spire the eye is in, or at the skin of, parts round it as a crown at the
    // lens does: the eye in the spire's own frame, against its girth at that height, leaning and tapering as it does)
    vec3 ce = uCamLocal - io;
    vec3 el = vec3(dot(im[0].xyz, ce) / dot(im[0].xyz, im[0].xyz), dot(im[1].xyz, ce) / dot(im[1].xyz, im[1].xyz), dot(im[2].xyz, ce) / dot(im[2].xyz, im[2].xyz));
    float hy = clamp(el.y / uHollow.y, 0.0, 1.0);
    float gr = uHollow.x * max(1.0 - 0.7 * hy, 0.6);
    float rr = length(vec2(el.x, el.z - hy * hy * uHollow.y * uHollow.z));
    vHollow = (1.0 - smoothstep(gr * 0.95, gr * 1.5 + 0.3, rr)) * step(-1.0, el.y) * (1.0 - smoothstep(uHollow.y * 1.2, uHollow.y * 1.45, el.y));
  #endif
  float j = 1.0 + (inst.z - 0.5) * uLod.z;
  // strokes at the edge of their range shrink away instead of popping
  float vis = step(uLod.x * j, di) * (1.0 - smoothstep(uLod.y * j * uLod.w, uLod.y * j, di));
  vec3 lp = position;
  #ifdef PC_OIL
    // LEAVES BY DISTANCE (flora.js, florakit.js sortLeafCards): beyond uLeafLod.x a tree keeps a share of its leaves, those
    // with the highest numbers, and each kept leaf is larger by as much as keeps the crown as full. A leaf at the edge of
    // the share shrinks into its own centre over a few metres, so none appears or goes in one frame.
    vec3 cardO = position - aCard;
    vec3 cardC = aCard;       // (the leaf's centre in the plant's own space; a far tree's is moved by its taper, below)
    float cardG = 1.0;        // (how much a leaf -- or a card of leaves, part 7 -- has been grown about its centre)
    if (uLeafLod.x > 0.0 && aData.y > 4.5 && aData.y < 7.5) {
      float keep = clamp(pow(uLeafLod.x / max(di, 0.01), 1.2), uLeafLod.y, 1.0);
      float e = (1.0 - keep) * 1.06 - 0.03;
      // (?leafgrow, 24 Nov, AN OPTION FOR THE OWNER, the look director's (C): on the phone's picture a near tree thins
      //  its leaves from about 6.5 m, and each kept leaf grows to keep the crown as full, 1.3 times at 10 m and 1.65 at
      //  15 m: the near crown's leaves read as hand-sized pieces. With the switch a broadleaf's kept leaf grows at most
      //  uLeafGrow times within 15 m of the eye, back to today's growth by 25 m (before the near tree hands over at
      //  27 m): the same leaves, smaller, the sky between them. The needle kinds are left alone (?pines). 0: as before.)
      float gMax = 2.4;
      if (uLeafGrow > 0.0 && uNeedle <= 0.0) gMax = mix(uLeafGrow, 2.4, smoothstep(15.0, 25.0, di));
      cardG = smoothstep(e - 0.03, e + 0.03, aData.w) * min(inversesqrt(keep), gMax);
      cardO *= cardG;
      lp = aCard + cardO;
    }
    // A CONIFER'S NEEDLES STAY A MASS AT RANGE (?pines, 24 Nov: the spruces and tall pines 20 to 60 m off read as bare
    // poles). The spruce's foliage is sprays of needle cards with the air left between its whorls -- some 11 square
    // metres of needles on a 16 m tree, about a fifth of its outline -- which near by is the approved look, and from 20 m
    // on is a pole with specks. So from 10 m out each needle card grows about its own centre, up to NEEDLE_FILL times at
    // 30 m and beyond, and the sprays close into the kind's dark mass; and wherever it stands a needle is kept at least
    // uNeedle pixels across, its two side corners (uv.y +-1) pushed out (a needle under a pixel wide is missed by the
    // pixels' centres more often than it is hit). Within 10 m nothing changes. 0: as before.
    if (uNeedle > 0.0 && aData.y > 4.5 && aData.y < 6.5) {
      float dN = max(distance((im * vec4(aCard, 1.0)).xyz, uCamLocal), 0.1);
      cardO *= mix(1.0, ${NEEDLE_FILL.toFixed(2)}, smoothstep(10.0, 30.0, dN));
      if (abs(uv.y) > 0.5) cardO *= clamp(0.5 * uNeedle * dN * uOilPx.x / max(length(mat3(im) * cardO), 1e-4), 1.0, 5.0);
      lp = aCard + cardO;
    }
    // NO SHARDS UNDER THE NOSE (?nearleaf, 24 Nov; the look director's audit 2, R3.6 'nothing reads as a polygon'): a
    // leaf a metre or two from the eye is a hand-sized flat kite filling a tenth of the picture, straight-edged, where
    // the references' near leaves are small dabs with the sky between them. So within 5 m of the eye each leaf shrinks
    // about its own centre, to 0.55 of its size at 1.0 m, on a gentle ramp (smoothstep from 5 m: the look director's
    // terms, 24 Nov; first 3.5 m, which missed the audit's biggest pieces, leaves 3 to 4.5 m off; so the change lies
    // mostly where the leaf would fill the frame and a leaf does not visibly shy away as the player walks into a low
    // bough -- the thing to watch on the owner's device); from 5 m out nothing changes (the owner approved the near
    // trees at 5 to 15 m as they are). Whole and crisp: no fade, its place and its paint its own (inside 5 m a leaf is
    // tens of pixels across, so the 3 px floor never binds here). 0: as before.
    if (uNearLeaf > 0.0 && aData.y > 4.5 && aData.y < 6.5) {
      cardO *= mix(0.55, 1.0, smoothstep(1.0, 5.0, distance((im * vec4(aCard, 1.0)).xyz, uCamLocal)));
      lp = aCard + cardO;
    }
  #endif
  #if defined(PC_TREE_LEAF) || defined(PC_TREE_WOOD) || defined(PC_TREE_CARD)
    // THE TREES' TWO SHORT PROGRAMS (?trees2=, 2026-11-24; docs/lead/TREES-DESIGN.md on r2, package T2). Everything the
    // one big plant program decided pixel by pixel with a discard -- the window round the lens, the window round the
    // explorer, the wash a tree arrives in, the leaves a fire has taken -- is decided here, ONCE A WHOLE LEAF OR A WHOLE
    // BRANCH, by its own number, and a piece that is not there is folded into its own centre (no area, no pixel). So the
    // two fragment programs below have no discard at all, and the graphics card may test depth before it paints.
    {
      vec3 cwT = (im * vec4(aCard, 1.0)).xyz;        // the leaf's centre (a branch: the middle of its ring), at rest
      float cdT = distance(cwT, uCamLocal);
      float hT = aData.w;
      float keepT = 1.0;
      #if defined(PC_TREE_LEAF) || defined(PC_TREE_CARD)
        if (aData.y > 4.5) {
          float aboveT = dot(cwT - io, normalize(io + uOrigin));
          // (the lens: a leaf within 2.5 to 4.5 m of the eye, by its number -- a tree of the snow at any height, the rest
          //  above head height -- and right at the lens any leaf, as the ragged window was)
          if ((uOilKind > 0.5 || aboveT > 1.7) && cdT < 2.5 + 2.0 * fract(hT * 7.3)) keepT = 0.0;
          if (cdT < 0.35 + 1.25 * fract(hT * 3.91 + 0.23)) keepT = 0.0;
          // (the window round the explorer: a leaf between the lens and the figure, near the line of sight to it)
          if (uFocus.w > 0.5) {
            vec3 cvT = (modelViewMatrix * vec4(cwT + pcRound(io + uOrigin), 1.0)).xyz;
            if (cvT.z > uFocus.z + 0.4) {
              vec3 rdT = normalize(cvT);
              float holeT = 1.0 - smoothstep(0.8, 2.0, length(uFocus.xyz - rdT * dot(uFocus.xyz, rdT)));
              if (fract(hT * 5.37 + 0.17) * 0.8 + 0.08 < holeT) keepT = 0.0;
            }
          }
          // (a wash: the leaves come, or go, one whole leaf at a time, each at its own moment)
          if (vWash < 0.999) { float wnT = fract(hT * 11.7 + 0.29) * 0.96 + 0.02; if (vWash >= 0.0 ? wnT > vWash : wnT < 1.0 + vWash) keepT = 0.0; }
          #ifdef PC_FIRE
            if (fract(hT * 3.17 + 0.41) < vBurnt * uBurnK.x) keepT = 0.0;      // (the leaves a fire has taken)
          #endif
        }
      #endif
      #ifdef PC_TREE_WOOD
        // (a branch at the lens is pinched in to its own line round the eye -- a trunk the eye passes through opens round
        //  it, a thin branch in a crown overhead from farther off -- and a wash lays the branches one by one, the stem
        //  last; kitbuild.js tube: with Builder.axis a ring's vertices carry the ring's centre in aCard)
        float twT = step(0.5, aData.z) * step(1.7, dot(cwT - io, normalize(io + uOrigin)));
        keepT = smoothstep(mix(0.35, 0.9, twT), mix(1.6, 3.6, twT), cdT);
        float bnT = aBranchId < 0.0 ? 0.985 : fract(aBranchId * 7.31 + inst.z * 3.7) * 0.94 + 0.02;
        if (vWash < 0.999 && (vWash >= 0.0 ? bnT > vWash : bnT < 1.0 + vWash)) keepT = 0.0;
        // (a trunk or a bough between the lens and the explorer is pinched in round the line of sight to the figure,
        //  as the big program cut a ragged window through it: the figure is never lost behind a tree)
        if (uFocus.w > 0.5) {
          vec3 cvT = (modelViewMatrix * vec4(cwT + pcRound(io + uOrigin), 1.0)).xyz;
          if (cvT.z > uFocus.z + 0.4) {
            vec3 rdT = normalize(cvT);
            keepT = min(keepT, smoothstep(0.5, 1.4, length(uFocus.xyz - rdT * dot(uFocus.xyz, rdT))));
          }
        }
      #endif
      if (keepT < 1.0) { cardO *= keepT; cardG *= keepT; lp = aCard + (lp - aCard) * keepT; }
    }
  #endif
  #ifdef PC_FAR
    vSpecies = aInst2.x;
    int fsi = int(aInst2.x + 0.5);
    float crown = step(0.5, aData.y);
    #ifdef PC_OIL
      // (a far tree of flat pieces, florakit.js farCardGeometry: each corner is drawn in toward the stem by the taper at
      // its own height in the crown, 0.30 to 1.02 of the tree; the piece's paint is taken at its tapered centre)
      if (aData.y > 4.5) { float tk = uFarTaper[fsi]; cardC.xz *= 1.0 - tk * clamp((aCard.y - 0.30) / 0.72, 0.0, 1.0); lp.xz *= 1.0 - tk * clamp((position.y - 0.30) / 0.72, 0.0, 1.0); }
      else lp.xz *= 1.0 - uFarTaper[fsi] * uv.y * crown;
      // NO TWO FAR CROWNS SHARE AN OUTLINE (the owner, 2026-11-22: a wood at 300 yards must not read as one stamp
      // repeated). One mesh stands for every far tree, so until now every far crown had the same silhouette. Each
      // piece is set a little further out from the crown's middle, or a little further in, by ITS TREE'S number and
      // its own: 0.80 to 1.20 of its radius, about an even mean, so a crown's size does not grow with it (it must
      // not: flora.js allows a far chunk's bounding ball chunk.size * 0.75 + 24 m, and a fatter crown would be
      // culled sooner at the edge of the screen). The piece MOVES WHOLE -- its corners keep their places about its
      // centre -- so a leaf is not stretched, and the dark core (shade 2) is left exactly where it was: that core is
      // what stops the pieces reading as confetti.
      if (aData.y > 4.5 && aData.z < 1.5) {
        vec3 puff = (cardC - vec3(0.0, ${FAR_CROWN_Y}, 0.0)) * (${FARCROWN} * 0.40 * (fract(inst.z * 7.3 + aData.w * 3.1) - 0.5));
        cardC += puff; lp += puff;
      }
    #else
    lp.xz *= 1.0 - uFarTaper[fsi] * uv.y * crown;                 // pines, spires: taper to a point
    #endif
    // rock-like kinds have no trunk: the form stands on the ground
    // (the last fixes, the second blind player on Saturn: that form was the crown's blob set down on its lowest point, a
    // spindle standing on its tip, and far off, where the tip was lost in the haze, Saturn's spires and the crystals hung
    // above the horizon. Its lower half is pressed into a broad foot, the widest girth a quarter of the way up, and it
    // stands on the ground as the near spire does; a hanging kind keeps its fall)
    float foot = crown * (1.0 - uFarTrunk[fsi]) * (1.0 - uFarDrop[fsi]);
    float yb = lp.y < 0.66 ? 0.66 - (0.66 - lp.y) * 0.3 : lp.y;
    vec3 rockP = mix(vec3(lp.x * 1.5, (lp.y - 0.30) * 1.45, lp.z * 1.5), vec3(lp.x * 1.5, (yb - 0.566) * 2.23, lp.z * 1.5), foot);
    lp = mix(lp * mix(uFarTrunk[fsi], 1.0, crown), rockP, crown * (1.0 - uFarTrunk[fsi]));
    lp.y -= uFarDrop[fsi] * 0.97;                                   // hanging kinds: the wash falls below its root
  #endif
  vec3 sw = pcSway(aData.x, inst.z * 6.283 + dot(io, vec3(0.11, 0.07, 0.13))) / max(length(im[0].xyz), 0.001);
  #ifdef PC_PHYS
    vec3 wp = (im * vec4(lp + sw * (1.0 - uPhysOn), 1.0)).xyz;
    if (uPhysOn > 0.5) {
      vec3 rootB = io + uOrigin;
      #ifdef PC_BLADE_ROOT
        // a patch of grass: every blade bends about its own root, so the sward parts
        vec3 bro = (im * vec4(aMass.x, 0.0, aMass.z, 0.0)).xyz;
        rootB += bro;
        vec2 bendB = pcPhysBend(rootB, uStiff).xy;
        wp = io + bro + pcPhysDisplace(wp - io - bro, normalize(rootB), uPlantHeight * length(im[1].xyz), bendB);
      #else
      #if defined(PC_PHYS_FULL) || defined(PC_PHYS_BRANCH)
        vec4 pbP = pcPhysBend(rootB, uStiff);
        vec2 bend = pbP.xy;
      #else
        vec2 bend = pcPhysBendLite(rootB, uStiff);
      #endif
      vec3 relP = wp - io, upP = normalize(rootB);
      float Hp = uPlantHeight * length(im[1].xyz);
      #ifdef PC_PHYS_BRANCH
        // (a crown does not sway as one piece: PHYSICS' crown, each branch loaded by its own wind and ringing at its
        // own frequency out of step with its neighbours, the foliage trembling on top, nothing moving at the trunk.
        // aBranchId: one number for a branch and the masses of foliage it carries (-1 the trunk); each tree its own)
        float bidP = aBranchId < 0.0 ? -1.0 : fract(aBranchId + inst.z * 7.31);
        relP += pcPhysCrown(relP, upP, Hp, rootB, pbP, bidP, aLeaf01);
      #endif
      wp = io + pcPhysDisplace(relP, upP, Hp, bend);
      #endif
    }
    wp = io + (wp - io) * vis;
  #else
    vec3 wp = (im * vec4((lp + sw) * vis, 1.0)).xyz;
  #endif
  vBody = wp + uOrigin;
  #ifdef PC_OIL
    vRelO = wp - uCamLocal;
  #endif
  #ifdef USE_INSTANCING
    vAbove = dot(wp - io, normalize(io + uOrigin));
  #else
    vAbove = 0.0;
  #endif
  vObj = position;
  mat3 ir = mat3(im);
  vNV = normalMatrix * (ir * normal);
  #ifdef PC_BLADE_ROOT
    vMassV = normalMatrix * (ir * vec3(aMass.x * 0.4, 1.0, aMass.z * 0.4));
  #else
    vMassV = normalMatrix * (ir * aMass);
  #endif
  vec4 mv = modelViewMatrix * vec4(wp + pcRound(io + uOrigin), 1.0);     // (a thing stands on the ground where the ground is drawn)
  vView = mv.xyz;
  vUv = uv; vData = aData; vInst = inst;
  #ifdef PC_OIL
    vMassO = aMass;
    vScaleO = length(im[0].xyz);
    vCardB = vBody - (ir * cardO) * vis;       // (the leaf moves as one piece: its centre is this far from the vertex)
    vCardD = length(vCardB - uOrigin - uCamLocal);
    vLeafC.rgb = vec3(0.0); vLeafK.rgb = vec3(0.0);
    if (aData.y > 4.5 && aData.y < 6.5) {
      // (from what is the same at every corner of the leaf: its centre at rest, its numbers, its tree)
      float hL = aData.w;
      vec3 r3 = vec3(hL, fract(hL * 13.7), fract(hL * 5.1));
      vec3 cB = (im * vec4(cardC * vis, 1.0)).xyz + uOrigin;
      vec3 cV = (modelViewMatrix * vec4(cB - uOrigin + pcRound(io + uOrigin), 1.0)).xyz;
      vec3 lA = uLeafA, lB = uLeafB, lC = uLeafC; vec4 famL = uLeafFam; float kindL = uOilKind;
      #ifdef PC_FAR
        // (far trees of every kind share one mesh: the kind's own washes, as PROP_FRAG takes them)
        lA = uFarA[fsi]; lB = uFarB[fsi]; lC = uFarC[fsi]; famL = uFarFam[fsi]; kindL = uFarKind[fsi];
      #endif
      if (famL.a > 0.0) {
        // (each tree its own colour: the same run as PROP_FRAG lays for the crowns)
        float tf = fract(inst.z * 9.73 + 0.37);
        float cF = tf < 0.4 ? tf * 0.5 : (tf < 0.8 ? 0.3 + (tf - 0.4) * 0.75 : 0.75 + (tf - 0.8) * 1.25);
        float a0 = clamp(cF - 0.13, 0.0, 1.0), b0 = clamp(cF + 0.13, 0.0, 1.0);
        vec3 pa = a0 < 0.5 ? mix(lA, lB, a0 * 2.0) : mix(lB, famL.rgb, a0 * 2.0 - 1.0);
        vec3 pb = b0 < 0.5 ? mix(lA, lB, b0 * 2.0) : mix(lB, famL.rgb, b0 * 2.0 - 1.0);
        vec3 lC0 = lC;
        lA = mix(lA, pa, famL.a); lB = mix(lB, pb, famL.a);
        lC = mix(lC0, mix(pb, lC0, 0.55) * vec3(0.92, 0.80, 0.84), famL.a);
      }
      { float tsL = fract(inst.z * 9.73 + 0.37); lA = pcSummerTree(lA, tsL, uLookG.y); lB = pcSummerTree(lB, tsL, uLookG.y); lC = pcSummerTree(lC, tsL, uLookG.y); }      // (each summer tree its own green: chunks.js)
      float twigL = step(1.5, kindL);
      float hueL = inst.x + (hL - 0.5) * 1.7;
      vec3 cs = mix(lA, lB, clamp(0.5 + hueL * 0.5, 0.0, 1.0));
      cs = mix(cs, lC, clamp(aData.z * 0.55 + (r3.y - 0.5) * 0.6, 0.0, 1.0));
      cs = pcWetWashV(pcDabTintV(pcDensity(cs, 1.0 + inst.y * 0.4), r3, 1.0 - twigL), 0.7);
      bool snowL = aData.y > 5.5;
      if (snowL) cs = mix(vec3(0.95, 0.97, 1.0), vec3(0.80, 0.87, 0.98), r3.x * 0.7);
      vec3 mVL = normalize(normalMatrix * (ir * aMass));
      vec3 sunVL = normalize((viewMatrix * vec4(uSunDirW, 0.0)).xyz);
      float xl = (dot(mVL, sunVL) * 0.5 + 0.5) * (1.0 - aData.z * 0.35);
      xl = max(xl, pow(max(dot(normalize(cV), sunVL), 0.0), 1.5) * (0.6 + 0.4 * r3.x) * (1.0 - twigL));
      if (snowL) xl = max(xl, 0.58 + 0.2 * r3.y);
      // Which way this piece faces the sky, for the sky's fill in its shade and the ground's warm bounce under it
      // (chunks.js pcUp). The crown's mass normal in the BODY'S axes against up there: the same normal the light
      // above is taken from, so a leaf's fill and a leaf's light agree, and the ground it stands on is doing the
      // same thing with its own normal.
      ${SKYUP('dot(normalize(ir * aMass), normalize(vBody))')}
      float rSunL = r3.z;
      float shLoL = 0.50;
      float flrL = 0.30 + 0.15 * r3.x;
      #ifdef PC_FAR
        // A FAR CROWN TURNS IN THE LIGHT, INSTEAD OF A COIN FLIP PER LEAF (the owner, 2026-11-22).
        // Beyond the shadow square -- which is where a far wood stands -- pcSunAtV falls back to the LEAF'S OWN
        // RANDOM NUMBER against the canopy's level, so which leaves of a crown were in shade had nothing to do with
        // where the sun was: a stand at 275 m was a uniform speckle at any hour, and the leaves thrown into the deep
        // paint were scattered through the lit side as confetti. So the number it is asked of becomes the piece's own
        // place in its crown, dotted with the sun.
        //   THE SHARE OF LEAVES IN THE SUN DOES NOT MOVE, which matters: the far wood's mean value and the pixel
        // gate's region means are measured off it. A crown's pieces lie on a ball about its middle, and a ball's
        // spread along any axis is EVEN, so 0.5 + 0.5 * dot(where it lies, the sun) is spread evenly over 0..1
        // exactly as the leaf's own number was; the leaf's number stays in as a small even jitter, which is the
        // same thing as jittering the threshold and leaves the share alone (it keeps the sun's edge broken by
        // leaves instead of ruled). Inside the shadow square pcSunAtV still reads the real map: this only changes
        // what it falls back to.
        //   The one-card far tree (?fartree=blob, an experiment) holds every piece at the crown's middle, so there
        // is no place in the crown to read: under 0.06 of a unit tree it keeps the number it had.
        vec3 offU = cardC - vec3(0.0, ${FAR_CROWN_Y}, 0.0);
        if (dot(offU, offU) > 0.0036) rSunL = mix(r3.z, 0.5 + 0.5 * dot(normalize(ir * offU), uSunDirL) - (r3.z - 0.5) * 0.22, ${FARCROWN});
        // (and the shade deepened, so a crown has a lit side AND a shaded one: half was all a shaded piece could
        // lose, and the floor under it held every piece at a middle tone. 0.50 and 0.30 + 0.15 r were set when the
        // shade was a coin flip, where a deep piece next to a lit one had to stay close to it; with a coherent side
        // the two can part. NOTE, measured: under pcLevel's oil remap as it stands (chunks.js, 0.30 + 0.62 *
        // smoothstep(-0.10, 0.30, 2x-1)) everything under xl 0.45 already lands on the same level, so the lower
        // floor changes no pixel today -- it is here for the wider remap the lighting step is bringing.)
        shLoL = mix(0.50, 0.30, ${FARCROWN});
        flrL = mix(flrL, 0.18 + 0.12 * r3.x, ${FARCROWN});
      #endif
      xl *= mix(shLoL, 1.0, pcSunAtV(cB, inst.w * uCanopy * 0.4, rSunL));
      xl += (r3.z - 0.5) * 0.25;
      xl = max(xl, flrL);
      // (a piece marked as the inside of a crown, shade 2: the core of a far tree of flat pieces, florakit.js facetCore.
      // It is laid in the deep tone whatever the sun: the dark the leaves stand on. Nothing else has a shade over 1.)
      if (aData.z > 1.5) xl = 0.2;
      float lvL = pcLevel(xl, 0.03);
      vec3 deepL = pcShadeLeaf(cs);      // (L2: the one foliage shade, chunks.js)
      // THE CROWNS UNDER A STORM (?stormleaf, 24 Nov, the coordinator after the look director's storm light, LOOK-BUILD.md
      // 'The land under a storm'). MEASURED in the gallery under wx=storm (uStorm 0.9, overcast 1.0): a lit leaf's level
      // is already about 1.4 there, so it is painted almost wholly in the foliage shade above -- and that shade is the
      // fair-weather one, a deep SATURATED red for an autumn leaf, which does not know the weather. The land at the same
      // levels takes pcTone's glaze (level 1: half way to the shade's grey, plus the sky's fill) and the deep wash under
      // it: a cool grey-green. So the red crowns glowed under the storm sky whatever the level did (a first try, the
      // level taken down a whole step, changed 10,204 pixels by at most 24 of 255). Here, under a storm, a crown is
      // painted as the land is: nothing lit (a leaf's level held to the glaze, 1, at a full storm) and the shade the
      // land's own glaze and deep wash at the leaf's level instead of the foliage shade. A level and the land's own
      // paint, never a darkening multiplied on (R1.3b); with no storm (uStorm 0) the same picture to the bit. 0: as before.
      // (uStormLeaf is the share of it at a full storm: 0.5, PASSED by the look director at half, so the reds deepen and
      //  the oranges dull but the colour families stay told apart; all of it made every crown one plum-maroon. The ramp is
      //  the far crowns' own, render/impostor.js stK, so near and far crowns step down together at the hand-over; and it
      //  follows the look director's one storm-light switch, uLookS.x: ?stormlight=0 and the crowns are as before.)
      float kSt = smoothstep(0.15, 0.6, uStorm) * uLookS.x * uStormLeaf;
      if (kSt > 0.0) {
        lvL = mix(lvL, min(lvL, 1.0), kSt);
        deepL = mix(deepL, pcTone(cs, lvL), kSt);
      }
      vLeafC.rgb = mix(deepL, pcTone(cs, lvL), smoothstep(1.2, 2.0, lvL));
      // (?pines: a conifer's needle mass from 20 m out sits at the references' deep green, about V 0.26 (#39432e), not
      //  near-black: the look director's ruling. A needle darker than that is lifted to it, its hue kept, from 12 m to
      //  20 m; a lighter one is left as it is; within 12 m nothing changes. Only trunks in shade go down to 0.08-0.18.)
      if (uNeedle > 0.0 && aData.y < 5.5) {
        float vN = max(max(vLeafC.r, vLeafC.g), vLeafC.b), tN = 0.24 * smoothstep(12.0, 20.0, length(cV));
        if (vN < tN) vLeafC.rgb *= tN / max(vN, 0.02);
      }
      vLeafK.rgb = cs;
      #ifdef PC_FIRE
        // (the powers, fire) A LEAF ON A CROWN THAT HAS BURNED GOES BLACK BEFORE IT GOES ALTOGETHER. Its paint is taken
        // to a cold charcoal at its own value, the same charcoal the ground's strokes take (TERRAIN_FRAG pcSoot), so
        // the crown and the floor under it are burnt in one colour. The leaves themselves are then dropped one WHOLE
        // leaf at a time as the burning goes on (PROP_FRAG), so a crown thins as it burns and is bare at the end.
        if (vBurnt > 0.001) {
          float sv = dot(vLeafC.rgb, vec3(0.3, 0.5, 0.2));
          vec3 soot = clamp(vec3(sv) * vec3(0.88, 0.88, 1.12) * (0.20 + 0.16 * r3.x) * uBurnK.w, 0.0, 1.0);
          float kb = vBurnt * uBurnK.x * (1.0 - uBurnK.z);
          vLeafC.rgb = mix(vLeafC.rgb, soot, kb);
          vLeafK.rgb = mix(vLeafK.rgb, soot, kb);      // (and the lantern lights the charcoal, not the leaf that was there)
        }
      #endif
    }
    #ifdef PC_TREE_CARD
    if (aData.y > 6.5) {
      // A CARD OF LEAVES (?trees2=cards; kitbuild.js clusterCard). Its whole frame from this one corner: the corner lies
      // at uv metres along the card's two axes from its centre, and the card faces along the normal, so the first axis
      // is (u d - v (n x d)) / |uv|^2 for d the corner less the centre (the cross product turns d a quarter round).
      vec3 dK = position - aCard, nK = normalize(normal);
      float q2 = max(dot(uv, uv), 1e-8);
      vec3 uK = (uv.x * dK - uv.y * cross(nK, dK)) / q2;
      vec3 vK = cross(nK, uK);
      vec3 cB = (im * vec4(cardC * vis, 1.0)).xyz + uOrigin;
      vec3 cV = (modelViewMatrix * vec4(cB - uOrigin + pcRound(io + uOrigin), 1.0)).xyz;
      vCardC = cB; vCardU = ir * uK * cardG; vCardV = ir * vK * cardG;
      vCardM = normalize(normalMatrix * (ir * aMass));
      vec3 lA = uLeafA, lB = uLeafB, lC = uLeafC; vec4 famL = uLeafFam;
      if (famL.a > 0.0) {
        float tf = fract(inst.z * 9.73 + 0.37);
        float cF = tf < 0.4 ? tf * 0.5 : (tf < 0.8 ? 0.3 + (tf - 0.4) * 0.75 : 0.75 + (tf - 0.8) * 1.25);
        float a0 = clamp(cF - 0.13, 0.0, 1.0), b0 = clamp(cF + 0.13, 0.0, 1.0);
        vec3 pa = a0 < 0.5 ? mix(lA, lB, a0 * 2.0) : mix(lB, famL.rgb, a0 * 2.0 - 1.0);
        vec3 pb = b0 < 0.5 ? mix(lA, lB, b0 * 2.0) : mix(lB, famL.rgb, b0 * 2.0 - 1.0);
        vec3 lC0 = lC;
        lA = mix(lA, pa, famL.a); lB = mix(lB, pb, famL.a);
        lC = mix(lC0, mix(pb, lC0, 0.55) * vec3(0.92, 0.80, 0.84), famL.a);
      }
      vCardLA = lA; vCardLB = lB; vCardLC = lC;
      ${SKYUP('dot(normalize(ir * aMass), normalize(vBody))')}
      vec3 sunVC = normalize((viewMatrix * vec4(uSunDirW, 0.0)).xyz);
      vCardS = vec4(aData.z, aData.w, pcUp, step(1.5, uOilKind));
      vCardR = vec2(sqrt(q2), pow(max(dot(normalize(cV), sunVC), 0.0), 1.5));
    }
    #endif
  #endif
  vFog = pcFogAmountV(di * pcFogBank(vBody));      // (PAINTER 19: a thick fog lies in banks)
  gl_Position = projectionMatrix * mv;
  ${VERT_END}
}
`;

const PROP_FRAG = /* glsl */`
${FRAG_PARS}
uniform vec3 uBarkA;
uniform vec3 uBarkB;
uniform vec4 uBarkP;   // mark threshold, 0 marks run around / 1 along, dark base height (m), dry brush
uniform vec3 uLeafA;
uniform vec3 uLeafB;
uniform vec3 uLeafC;
uniform vec4 uLeafP;   // raggedness, sky holes, dab scale, wetness
uniform vec3 uAccent;
uniform float uCanopy;
uniform float uGem;       // 1: a crystal or a splinter of ice or glass, lit through its body (PAINTER 13)
#ifdef PC_OIL
uniform vec4 uLeafFam;    // the oil look: each tree its own colour (rgb the third colour of the wood, a red; a how far each tree keeps to its own part of yellow, orange, red)
uniform float uOilKind;   // the oil look: 0 a tree in leaf; 1 a tree of the snow, its boughs loaded (snow on what faces up); 2 a bare tree: its "leaves" are twigs
#ifdef PC_FAR
  uniform float uFarKind[PC_NFAR];
  uniform vec4 uFarFam[PC_NFAR];
#endif
uniform vec4 uOilDark;    // x: the share of this kind's trees whose bark is the dark pair below (the oil look's woods)
uniform vec3 uOilDarkA;
uniform vec3 uOilDarkB;
#endif
uniform mat3 normalMatrix;
#ifdef PC_FAR
  uniform vec3 uFarA[PC_NFAR];
  uniform vec3 uFarB[PC_NFAR];
  uniform vec3 uFarC[PC_NFAR];
  uniform vec3 uFarBarkA[PC_NFAR];
  uniform vec3 uFarBarkB[PC_NFAR];
  varying float vSpecies;
#endif
#ifdef PC_HOLLOW
  varying float vHollow;
#endif
uniform vec4 uFocus;      // the explorer's figure in view space (w 1 while it is shown)
varying vec3 vBody;
varying vec3 vObj;
varying vec3 vNV;
varying vec3 vMassV;
varying vec3 vView;
varying vec2 vUv;
varying vec4 vData;
varying vec4 vInst;
varying float vWash;
varying float vAbove;
varying float vFog;
#ifdef PC_OIL
varying vec3 vMassO;
varying vec3 vRelO;
varying vec3 vCardB;
varying vec4 vLeafC;
varying vec4 vLeafK;
#define vCardD vLeafC.a
#define vScaleO vLeafK.a
${PC_UP_F}
#endif
#ifdef PC_FIRE
varying float vBurnt;     // (the powers, fire) 0 this plant is untouched .. 1 its crown has burned right out
uniform vec4 uBurnK;
// The same cold charcoal the ground's strokes are laid in (TERRAIN_FRAG pcSoot: the paint's own value kept, so the
// light of the place still reads, its colour taken out, a stroke here and there the pale grey of ash). It is written
// out again here because the ground and the plants share no chunk of their own; if a third program ever wants it, it
// belongs in chunks.js beside pcTone.
vec3 pcSoot(vec3 paint, float stray, float ash) {
  float v = dot(paint, vec3(0.3, 0.5, 0.2));
  vec3 s = vec3(v) * vec3(0.88, 0.88, 1.12) * (0.20 + 0.16 * stray);
  s = mix(s, min(s * 3.2, vec3(0.52, 0.50, 0.50)), step(0.88, fract(ash * 7.1)));
  return clamp(s * uBurnK.w, 0.0, 1.0);
}
${FIRE_GLOW}
#endif
void main() {
  #include <logdepthbuf_fragment>
  #ifdef PC_OIL
    // (THE SPEED TEST'S BISECTION OF A PLANT'S PAINT, shared.js uOilL.y, 2026-11-18. The owner's own phone says the
    //  plants' paint is 11.7 ms of a 32.9 ms frame -- the single biggest thing in it -- and no row yet says WHERE in
    //  the paint it goes. 4 writes a plant the instant its fragment starts: before the footprint, before the noise
    //  read, before every discard that breaks a crown up. The gap from 4 to 2 ("plants one flat colour", which runs
    //  all of those first) is what they cost; the gap from 2 to "as set" is the paint proper. These do nothing
    //  whatever unless the speed test sets them.)
    // (24 Nov, the trees lane with the coordinator's leave: every speed-test row that writes a plant at once (4) or in one
    //  flat colour (2) writes alpha 1, a whole cover. It wrote 0, and with alpha to coverage on a multisampled picture a
    //  0 lays nothing, so the row timed plants that were not there. The as-set paint is not touched.)
    if (uOilL.y > 3.5 && uOilL.y < 4.5) { pcWrite(vec3(0.42, 0.40, 0.32), 1.0, vec3(0.0, 0.0, 1.0), -vView.z, 3.0); return; }
  #endif
  pcFp = pcFootprint(vBody);      // (R1 W2.1, chunks.js: before any discard, where the flow is uniform)
  pcDist = length(vView);         // (R1 re-fix: the leaf shadow's far octaves, chunks.js)
  float part = vData.y;
  vec3 nV = normalize(vNV);
  if (!gl_FrontFacing) nV = -nV;
  vec3 V = normalize(-vView);
  vec3 sunV = normalize((viewMatrix * vec4(uSunDirW, 0.0)).xyz);
  #ifdef PC_OIL
    // Which way this piece of bark, crown wash, blade or stone faces the sky (chunks.js pcUp). Up AT THE EYE, turned
    // into the frame the normal is in: over 275 m of these small worlds (a radius of about 4 km) up leans by under
    // four degrees, which a fill term cannot show, and a plant has no body-axis normal to hand here. A LEAF does not
    // come through here at all -- its paint, pcUp and all, is worked out once a leaf in the vertex shader above.
    ${SKYUP('dot(nV, mat3(viewMatrix) * uUpW)')}
    // (the lighter paint: no noise for a plant's wash; and the speed test's flat plants, shared.js uOilL.y)
    vec4 n1 = uOilL.x > 0.5 ? vec4(0.5) : texture(uNoise3D, vBody / 9.0);
    // (uOilL.y 2: every plant one flat colour; 3: only the far trees, to tell their paint from their shapes)
    // (2026-11-24, trees lane: the far test was 'over 1.5', so rows 5 and 6 -- a leaf in its own colour, no air on
    //  the plants -- flattened every far tree as well and measured more than they said. Now only 2 and 3.)
    // (trees lane, 24 Nov: the far flat and the bark flat write alpha 1, a whole cover: the as-set paint writes its cover
    //  there, and a 0 laid NOTHING on a multisampled picture, alpha to coverage, so those rows measured less than they said)
    #ifdef PC_FAR
    if (uOilL.y > 1.5 && uOilL.y < 3.5) { pcWrite(vData.y > 4.5 ? uLeafA * 0.7 : uBarkB, 1.0, nV, -vView.z, 3.0); return; }
    #else
    if (uOilL.y > 1.5 && uOilL.y < 2.5) { pcWrite(vData.y > 4.5 ? uLeafA * 0.7 : uBarkB, 1.0, nV, -vView.z, 3.0); return; }
    // (7: the near trees' BARK one flat colour, every leaf and every discard as set -- trees lane T0 row c)
    if (uOilL.y > 6.5 && uOilL.y < 7.5 && vData.y < 0.5) { pcWrite(uBarkB, 1.0, nV, -vView.z, 3.0); return; }
    #endif
  #else
    vec4 n1 = texture(uNoise3D, vBody / 9.0);
  #endif
  float seed = vInst.z;
  float canopy = vInst.w * uCanopy;
  float vd = length(vView);
  float near = 1.0 - smoothstep(30.0, 110.0, vd);
  // strokes part when they are right in front of the eye (the explorer can walk through trunks)
  if (vd < 1.6 && texture(uNoise3D, vBody / 0.7).r * 0.8 + 0.1 > smoothstep(0.35, 1.6, vd)) discard;
  #ifdef PC_HOLLOW
    // a spire the eye is in parts into a few broad ragged washes (not a stipple of chips), none of it left once the eye
    // is inside its skin (vertex shader)
    if (vHollow > 0.001 && texture(uNoise3D, vBody / 3.2).g * 0.62 + texture(uNoise3D, vBody / 0.8).b * 0.26 + 0.06 < vHollow) discard;
  #endif
  // (PHYSICS' and PILOT's critiques, M4: a crown at the lens, in the jetpack's first second under the birches or as the
  // ship sets down in a wood, was one flat green slab over a third of the frame, with a black branch bar across it.
  // A crown within three and a half metres of the eye breaks into separate dabs with the picture between them, fewer
  // the nearer, and its branches thin away with it. vAbove: only what stands well over a plant's foot: the grass,
  // the ferns and the bushes at the boots are left whole)
  // (the re-fix: only the crown's own washes (part 1) and its thin branches (bark laid with a twig's shade: a trunk's is
  // 0). As first written the rule took every part: a birch's trunk 1.8 m from the eye was cut into floating white
  // blocks above eye level, and by the same reading a tall reed, a kelp ribbon, an ice needle or a fungal tower would
  // be. A trunk, a blade and a stone part only right at the lens, by the rule above, as before)
  if (vAbove > 1.7 && vd < 3.6 && ((part > 0.5 && part < 1.5) || (part < 0.5 && vData.z > 0.5))) {
    float nl = part > 0.5 ? texture(uNoise3D, vBody / 1.1).r * 0.62 + texture(uNoise3D, vBody / 0.36).g * 0.38 : texture(uNoise3D, vBody / 0.7).r * 0.8 + 0.1;
    if (nl > mix(0.20, 1.0, smoothstep(0.9, 3.6, vd))) discard;
  }
  // strokes that stand between the lens and the explorer's figure part round the line of sight to it:
  // a window in the crown, ragged like everything else, so the figure is never lost behind foliage
  if (uFocus.w > 0.5 && vView.z > uFocus.z + 0.4) {
    vec3 rd = normalize(vView);
    float off = length(uFocus.xyz - rd * dot(uFocus.xyz, rd));
    float hole = 1.0 - smoothstep(0.8, 2.0, off);
    if (hole > 0.0 && texture(uNoise3D, vBody / 0.9).r * 0.8 + 0.08 < hole) discard;
  }
  // a wash being laid (or lifted): broken strokes that fill in, anchored to the thing itself
  // (the touches are sized to the distance, in steps: about a hundredth of it and four times that, so a far
  // crown fills in by a few blotches over the half second and is never a stipple of single pixels)
  if (vWash < 0.999) {
    float ws = exp2(floor(log2(max(vd, 30.0) / 60.0) + 0.5));
    float wn = texture(uNoise3D, vBody / (2.3 * ws)).g * 0.5 + texture(uNoise3D, vBody / (0.6 * ws)).b * 0.5;
    wn = clamp((wn - 0.5) * 1.5 + 0.5, 0.02, 0.98);
    if (vWash >= 0.0 ? wn > vWash : wn < 1.0 + vWash) discard;
  }
  #ifdef PC_FIRE
    // (the powers, fire) A CROWN THAT HAS BURNED LOSES ITS LEAVES, and what is left of the tree is bare and black.
    // The leaves go one WHOLE leaf at a time, each leaf by its own number, so a crown thins as it burns rather than
    // fading as one piece; a crown laid as broad washes instead of leaves (part 1) goes in ragged patches, the way a
    // wash is laid just above. The trunk and the branches stay standing: a burnt tree is not a felled one.
    // (named apart from the "gone" the crowns' own strokes use further down, which is a different thing: no
    //  backtick is allowed in a shader comment -- it would end the text the shader is written in)
    float burnGone = vBurnt * uBurnK.x;      // (?burn=0: no sign of the fire at all, for a before-and-after pair of stills)
    if (burnGone > 0.001) {
      if (part > 4.5) { if (fract(vData.w * 3.17 + 0.41) < burnGone) discard; }
      else if (part > 0.5 && part < 1.5) {
        float bq = texture(uNoise3D, vBody / 1.7).b * 0.6 + texture(uNoise3D, vBody / 0.5).g * 0.4;
        if (bq < burnGone) discard;
      }
    }
  #endif
  vec3 leafA = uLeafA, leafB = uLeafB, leafC = uLeafC, barkA = uBarkA, barkB = uBarkB;
  #ifdef PC_FAR
    int si = int(vSpecies + 0.5);
    leafA = uFarA[si]; leafB = uFarB[si]; leafC = uFarC[si]; barkA = uFarBarkA[si]; barkB = uFarBarkB[si];
  #endif
  #ifdef PC_OIL
    float kindO = uOilKind;
    vec4 famO = uLeafFam;
    #ifdef PC_FAR
      kindO = uFarKind[si];
      famO = uFarFam[si];
    #endif
    // EACH TREE ITS OWN COLOUR (the owner's references of 2026-11-16, an autumn forest from the air and from the ground:
    // one crown yellow, the next orange, the next red; never one even gold). The wood's colours are a run from its
    // first leaf colour (yellow) through its second (orange) to a third (red, famO.rgb); each tree, by its own number,
    // keeps to a short piece of that run: four in ten in the yellows, four in the ambers and oranges, two in the reds.
    if (famO.a > 0.0) {
      float tf = fract(vInst.z * 9.73 + 0.37);
      float cF = tf < 0.4 ? tf * 0.5 : (tf < 0.8 ? 0.3 + (tf - 0.4) * 0.75 : 0.75 + (tf - 0.8) * 1.25);
      float a0 = clamp(cF - 0.13, 0.0, 1.0), b0 = clamp(cF + 0.13, 0.0, 1.0);
      vec3 pa = a0 < 0.5 ? mix(leafA, leafB, a0 * 2.0) : mix(leafB, famO.rgb, a0 * 2.0 - 1.0);
      vec3 pb = b0 < 0.5 ? mix(leafA, leafB, b0 * 2.0) : mix(leafB, famO.rgb, b0 * 2.0 - 1.0);
      leafA = mix(leafA, pa, famO.a); leafB = mix(leafB, pb, famO.a);
      leafC = mix(leafC, mix(pb, leafC, 0.55) * vec3(0.92, 0.80, 0.84), famO.a);
    }
    { float tsO = fract(vInst.z * 9.73 + 0.37); leafA = pcSummerTree(leafA, tsO, uLookG.y); leafB = pcSummerTree(leafB, tsO, uLookG.y); leafC = pcSummerTree(leafC, tsO, uLookG.y); }      // (each summer tree its own green: chunks.js)
    float snowyO = step(0.5, kindO) * step(kindO, 1.5), twigO = step(1.5, kindO);
    // (a leaf at the lens is a slab across the picture: within two and a half to four and a half metres of the eye, each
    // leaf by its own number, the leaves of a tree are not laid, whole: the eye stands in a ragged window. Of a tree of
    // the snow, whose boughs come down to the ground, at any height; of the others above head height, as their crowns'
    // washes are thinned: the eye stood inside a fir and the picture was a dozen dark shards)
    if (part > 4.5 && (kindO > 0.5 || vAbove > 1.7) && vCardD < 2.5 + 2.0 * fract(vData.w * 7.3)) discard;
  #endif
  vec3 c; float wet = 0.05; float id = 3.0; float x;
  float oilCover = 1.0;
  vec3 upV = normalize(normalMatrix * normalize(vBody));   // the planet's up, for snow lying on things

  #ifdef PC_OIL
  // THE OIL LOOK'S PLANTS (chunks.js, "the oil look's strokes"): bark and crowns in two layers of strokes, as the ground.
  // Bark: the chart is the tube's own (round it, along it), the strokes run the way the bark's marks do. A crown: the
  // chart is the mass's own space, flattened along whichever axis the face looks down most (taken from the face itself,
  // so it never turns with the eye); a dab too near the outline, or where the sky shows through, is left out whole.
  // (the clip's floor is a carpet of leaves with a tuft here and there: most blades and fronds are not laid)
  if (part > 1.5 && part < 2.5 && fract(seed * 7.77 + 0.31) > uOilG.y * uGroundK.y) discard;
  if (part > 4.5) {
    // ---- a leaf (florakit.js leafCards): one piece of flat colour, its outline the geometry's own; in the sun or in
    // the shade WHOLE (everything is asked at the leaf's centre), each leaf its own colour of the tree's three
    // (worked out once a leaf, in the vertex shader: PROP_VERT, "a leaf's paint, once a leaf"; here only the lantern's
    // light is laid over it, by night)
    float h = vData.w;
    // (the speed test, uOilL.y = 5: a leaf keeps every shape and every discard and is written in the colour its own
    //  vertex already worked out, with no lantern and no fire laid over it. The gap to "as set" is what a LEAF's own
    //  paint costs, told apart from the crowns' strokes and the bark's.)
    c = uOilL.y > 4.5 && uOilL.y < 5.5 ? vLeafC.rgb : pcLamp(vLeafC.rgb, vLeafK.rgb, vCardB, fract(h * 13.7));
    #ifdef PC_FIRE
      c = pcFireLit(c, vLeafK.rgb, vCardB, fract(h * 13.7));      // (the powers, fire: a leaf near a fire takes its light, whole)
    #endif
    wet = 0.0;
    id = 4.0 + fract(seed * 7.0 + h * 0.37) * 0.9;
  } else if (part < 1.5) {
    bool isBark = part < 0.5;
    // (some trees of a kind are dark-barked: their own pair of bark washes, and their marks run along the stem)
    float dk = step(fract(seed * 5.31 + 0.17), uOilDark.x - 0.001);
    barkA = mix(barkA, uOilDarkA, dk); barkB = mix(barkB, uOilDarkB, dk);
    bool along = uBarkP.y > 0.5 || dk > 0.5;
    float wpxP = uOilA.x * uOilPx.y / 720.0;
    vec3 odx = dFdx(vObj), ody = dFdy(vObj);
    vec2 ch, dcx, dcy;
    if (isBark) {
      // (uBarkP.y: 0 the marks run round the stem, 1 along it; the tube's own chart, in metres or near enough: along
      // it the plant's own units, round it one turn taken as 1.1 of them)
      vec2 uvm = vec2(vUv.y, vUv.x * 1.1) * vScaleO;
      ch = along ? uvm : uvm.yx;
      vec2 ux = dFdx(vUv), uy = dFdy(vUv);
      vec2 mx = vec2(ux.y, ux.x * 1.1) * vScaleO, my = vec2(uy.y, uy.x * 1.1) * vScaleO;
      dcx = along ? mx : mx.yx; dcy = along ? my : my.yx;
    } else {
      // (a crown's chart: the crown's own space in metres, laid flat along whichever axis the MASS faces most there, so
      // it is one chart over a whole side of the crown, whatever its triangles, and a leaf is the same size on a
      // sapling and on a far tree drawn large. Tried: the way the mass faces as metres round a ball of fixed size: a
      // far tree's crown, twice that ball, got leaves twice too large, a handful to a crown, and from the air every
      // crown was a few flat patches. The chart's derivatives are taken of all three layings before one is chosen.)
      vec3 po = vObj * vScaleO, pox = odx * vScaleO, poy = ody * vScaleO;
      vec3 ma = abs(normalize(vMassO));
      if (ma.x >= ma.y && ma.x >= ma.z) { ch = po.zy; dcx = pox.zy; dcy = poy.zy; }
      else if (ma.y >= ma.z) { ch = po.xz; dcx = pox.xz; dcy = poy.xz; }
      else { ch = po.xy; dcx = pox.xy; dcy = poy.xy; }
      ch += vData.w * 23.0;
    }
    // (bark's streaks are a stroke wide on the screen at every distance, as the ground's are: capped at a width on the
    // stem they shrank under the pixel a few metres off and every trunk was a flat slab. A crown's leaves are never
    // under about three and a half pixels wide: thinner, and a far crown was a stipple of single pixels)
    float dabK = max(uOilS.w * 0.9, 2.2 * uOilS.z / max(uOilA.x, 0.5));
    #ifdef PC_FAR
      // (a far tree's crown is one small mass: with dabs the size of the ground's it was four or five flat patches, a
      // faceted lump from the air; smaller leaves, so a crown is a cluster of them, as the near trees are)
      dabK *= 0.62;
    #endif
    vec4 o4c = pcStrokeOct4(vd * (0.85 + 0.3 * seed) * dabK, 0.05);
    vec3 oc = isBark ? vec3(pcStrokeOct(vd * (0.85 + 0.3 * seed), 0.004), 1.0) : vec3(o4c.xy, 1.0);
    // (a crown's dabs come and go whole, each asked at its own centre: chunks.js pcDabLayer)
    vec3 ocl = vec3(o4c.w - o4c.z, dFdx(o4c.w), dFdy(o4c.w));
    float gone = smoothstep(0.15, 0.85, oc.y), fine = oc.z;
    vec3 nvdx = dFdx(vNV), nvdy = dFdy(vNV), mvdx = dFdx(vMassV), mvdy = dFdy(vMassV);
    vec3 vwdx = dFdx(vView), vwdy = dFdy(vView), bdx = dFdx(vRelO), bdy = dFdy(vRelO);      // (the place's derivatives from a position measured from the eye: the body's own coordinates are too coarse to difference, chunks.js pcGroundChartD)
    float pale = smoothstep(0.55, 0.9, dot(barkA, vec3(0.333)));
    float xbF = dot(nV, sunV) * 0.5 + 0.5, xbS = pcSunAt(vBody, canopy * 0.8, 8.0 - vAbove, oc.x);      // (L3: one light)
    float xb0 = xbF * mix(0.55 + 0.30 * pale, 1.0, xbS);
    vec3 acc = isBark ? pcTone(mix(barkA, barkB, 0.16), uLookF.z > 0.5 ? pcLit(xbF, xbS, canopy * 0.8, 0.04) : pcLevel(xb0, 0.04)) : pcTone(pcDensity(leafC, 1.5), 0.7);
    float accA = isBark ? 1.0 : 0.0;
    for (int L = 1; L >= 0; L--) {
      float w = oc.x * (L == 1 ? 2.0 : 1.0);
      float lim = 4.0 * wpxP * (L == 1 ? 2.0 : 1.0);
      vec3 rnd, rnd2; vec2 ds, ctrD; float cov, has2;
      // (bark: long thin streaks that run with the stem or round it, nothing drawn between them; a crown: thin leaves,
      // lying every way)
      // (streaks that run with the stem are long; those that run round it are short, so the stem still turns in the light)
      if (isBark) { float ba = along ? 15.0 : 3.2; pcThinLayer(ch + seed * 37.0, dcx, dcy, w, ba, vObj + seed * 11.0, lim * ba, 2.0, rnd, ds, cov, rnd2); has2 = 1.0; }
      else pcDabLayer(ch + seed * 37.0, dcx, dcy, w, uOilS.z, lim * 3.0, ocl, L == 0 ? vec2(0.0, 1.0) : vec2(0.0), rnd, ctrD, ds, cov, rnd2, has2);
      vec3 Bc = vBody + bdx * ds.x + bdy * ds.y;
      vec3 nVc = normalize(vNV + nvdx * ds.x + nvdy * ds.y);
      if (!gl_FrontFacing) nVc = -nVc;
      vec3 Vc = normalize(-(vView + vwdx * ds.x + vwdy * ds.y));
      vec4 nA = uOilL.x > 0.5 ? vec4(0.5) : pcNoiseS(Bc, 9.0, w);
      vec3 cs; float xs_;
      if (isBark) {
        // a streak is the bark's light wash or one of its dark marks, whole; the foot of the stem and a thin branch are dark
        float markP = mix(mix(0.10, 0.42, clamp((0.72 - uBarkP.x) * 4.0, 0.0, 1.0)), 0.34, dk);
        float base = 1.0 - smoothstep(0.0, uBarkP.z, vUv.y + (rnd.y - 0.5) * 1.1 * fine);
        float twig = smoothstep(0.0, 1.0, vData.z);
        float m1 = mix(markP, step(1.0 - markP, rnd.x), fine), m2 = mix(markP, step(1.0 - markP, rnd2.x), fine);
        #ifdef PC_FAR
          base = 0.0;
        #endif
        vec3 k1 = mix(barkA, barkB, clamp(max(max(m1, base * 0.9), twig), 0.0, 1.0)), k2 = mix(barkA, barkB, clamp(max(max(m2, base * 0.9), twig), 0.0, 1.0));
        k1 = pcWetWash(pcDensity(k1, 1.0 + ((rnd.y - 0.5) * 1.5 * fine + (nA.r - 0.5) * 0.5) * uOilB.z), 0.9);
        k2 = pcWetWash(pcDensity(k2, 1.0 + ((rnd2.y - 0.5) * 1.5 * fine + (nA.r - 0.5) * 0.5) * uOilB.z), 0.9);
        k1 *= mix(vec3(1.0), mix(vec3(1.12, 0.96, 0.80), vec3(0.90, 0.90, 1.08), rnd.z), 0.7 * uOilB.z * fine);
        k2 *= mix(vec3(1.0), mix(vec3(1.12, 0.96, 0.80), vec3(0.90, 0.90, 1.08), rnd2.z), 0.7 * uOilB.z * fine);
        xs_ = dot(nVc, sunV) * 0.5 + 0.5;
        float xsF = xs_ + (rnd.x - 0.5) * 0.10 * fine, xsS = pcSunAt(Bc, canopy * 0.8, 8.0 - vAbove, w);      // (L3: one light)
        xs_ *= mix(0.55 + 0.30 * pale, 1.0, xsS);
        xs_ += (rnd.x - 0.5) * 0.10 * fine;
        float lvl = uLookF.z > 0.5 ? pcLit(xsF, xsS, canopy * 0.8, 0.03) : pcLevel(xs_, 0.03), pk = pale * 0.45 * max(uDayness, uMoon);
        vec3 l1 = mix(pcTone(k1, lvl), pcTone(k1, max(lvl, 1.0) * 0.5 + 1.0), pk), l2 = mix(pcTone(k2, lvl), pcTone(k2, max(lvl, 1.0) * 0.5 + 1.0), pk);
        l1 = pcLamp(l1, k1, Bc, rnd.y); l2 = pcLamp(l2, k2, Bc, rnd2.y);
        #ifdef PC_FIRE
          // (the powers, fire: a trunk beside a fire is lit down one side by it -- the strokes near it are laid in
          //  the fire's warm paint, stroke by stroke, as they are in the lantern's pool)
          l1 = pcFireLit(l1, k1, Bc, rnd.y); l2 = pcFireLit(l2, k2, Bc, rnd2.y);
        #endif
        vec3 lay = mix(l2, l1, cov);
        if (L == 1) acc = mix(acc, lay, fine * uOilC.z);
        else {
          float here = step(gone, rnd.x * 0.999), there = step(gone, rnd2.x * 0.999);
          lay = here > 0.5 ? mix(mix(acc, l2, there), l1, cov) : mix(mix(acc, l2, there), acc, cov);
          acc = mix(acc, lay, fine * uOilC.z);
        }
      } else {
        vec3 mVc = normalize(vMassV + mvdx * ds.x + mvdy * ds.y);
        // the outline is ragged by whole leaves, and the sky shows through where whole leaves are left out
        float rim = 1.0 - abs(dot(nVc, Vc));
        float cut = smoothstep(0.30, 0.90, rim) * uLeafP.x + uLeafP.y * (0.30 + 0.75 * smoothstep(0.46, 0.72, nA.r)) + 0.50 * twigO;      // (a bare tree far off: a thin haze of twigs, the sky through most of it)
        float there = step(cut, fract(rnd.z * 9.1) * 0.8 + 0.2 * rnd.x + 0.10);
        float hue = vInst.x + (rnd.x - 0.5) * 1.5 + (vData.w - 0.5) * 0.7 + (nA.b - 0.5) * 0.5;
        cs = mix(leafA, leafB, clamp(0.5 + hue * 0.5, 0.0, 1.0));
        cs = mix(cs, leafC, clamp(vData.z * 0.75 + (rnd.y - 0.5) * 0.5, 0.0, 1.0));
        cs = pcWetWash(pcDabTint(pcDensity(cs, 1.0 + (nA.r - 0.5) * 0.4 * uOilB.z + vInst.y * 0.5), rnd, 1.0 - twigO), 0.7);
        float snowF = pcSnowCover(dot(mVc, upV) * 0.5 + 0.5, rnd.x * 0.6 + nA.g * 0.4, vData.z * 0.8);
        // (a tree of the snow: what faces up is loaded, whatever the weather)
        snowF = max(snowF, snowyO * smoothstep(0.50, 0.62, dot(mVc, upV) * 0.5 + 0.5 + (rnd.x - 0.5) * 0.30));
        cs = mix(cs, mix(vec3(0.94, 0.955, 1.0), vec3(0.86, 0.90, 1.0), rnd.y * 0.6), snowF);
        xs_ = dot(mVc, sunV) * 0.5 + 0.5;
        xs_ = xs_ * (1.0 - vData.z * 0.42 * (1.0 - snowF));
        // (the sun behind a crown comes through its leaves: those glow)
        float through = pow(max(dot(-Vc, sunV), 0.0), 1.5);
        xs_ = max(xs_, through * (0.55 + 0.45 * rnd.x));
        float xcJ = (vData.w - 0.5) * 0.22 + (rnd.y - 0.5) * 0.20, xcF = xs_ + xcJ, xcS = pcSunAt(Bc, canopy * 0.6, 8.0 - vAbove, w), xcFl = 0.30 + 0.18 * rnd.x + (vData.w - 0.5) * 0.14;      // (L3: one light)
        xs_ *= mix(0.62, 1.0, xcS);
        xs_ += xcJ;
        xs_ = max(xs_, xcFl);
        float lvl = uLookF.z > 0.5 ? max(pcLit(xcF, xcS, canopy * 0.6, 0.03), pcLevel(xcFl, 0.03)) : pcLevel(xs_, 0.03);
        // (a crown's shade is its own colour laid heavier with half the cool key over it: the key alone over an orange
        // crown is mud; light comes through leaves)
        vec3 deepF = pcShadeLeaf(cs);      // (L2: the one foliage shade, chunks.js)
        vec3 lit = pcLamp(mix(deepF, pcTone(cs, lvl), smoothstep(1.2, 2.0, lvl)), cs, Bc, rnd.y);
        #ifdef PC_FIRE
          lit = pcFireLit(lit, cs, Bc, rnd.y);      // (the powers, fire: the leaves over a fire are lit by it, dab by dab)
        #endif
        acc = mix(acc, lit, cov * there * uOilC.z);
        accA = max(accA, there * cov);
      }
    }
    // (a crown's outline, leaf by leaf: with the scene multisampled a leaf's edge takes the share of the pixel it covers
    // (alpha to coverage: the material asks for it, makePropMaterial), which is what keeps the outline still under a
    // moving eye; with one sample a leaf is there or it is not)
    if (accA < (uOilG.z > 0.5 ? 0.06 : 0.5)) discard;
    c = acc;
    oilCover = accA;
    wet = 0.0;
    id = isBark ? 3.0 + seed * 0.9 : 4.0 + fract(seed * 7.0 + vData.w * 0.37) * 0.9;
  } else
  #endif
  if (part < 0.5) {
    // ---- bark: a pale or warm wash with dry-brushed marks
    float pale = smoothstep(0.55, 0.9, dot(barkA, vec3(0.333)));
    #ifdef PC_FAR
      c = mix(barkA, barkB, 0.22 + 0.3 * n1.b);
    #else
      vec2 tuv = mix(vec2(vUv.x * 1.5 + seed * 3.0, vUv.y * 1.15 + seed * 5.0), vec2(vUv.y * 0.30 + seed * 3.0, vUv.x * 3.0 + seed * 5.0), uBarkP.y);
      vec4 st = texture(uStrokeTex, tuv);
      vec4 stb = texture(uStrokeTex, vec2(vUv.x * 1.0 + seed * 9.0, vUv.y * 0.21 + seed * 2.0));
      // the edge of the stroke is broken: the trunk thins and swells along its length
      vec4 nb = texture(uNoise3D, vec3(vUv.y * 0.55 + seed * 7.0, seed * 3.0, vUv.x * 0.15));
      float rimB = 1.0 - abs(dot(nV, V));
      if (rimB > 0.86 - 0.42 * smoothstep(0.42, 0.72, nb.r) && vData.z < 0.5) discard;
      // dashes (lenticels), plus a few larger dark scars
      float marks = smoothstep(uBarkP.x, uBarkP.x + 0.05, st.r * 0.92 + st.b * 0.14 + (n1.b - 0.5) * 0.10);
      marks = max(marks, smoothstep(0.80, 0.86, stb.g + (st.r - 0.5) * 0.25) * (1.0 - uBarkP.y));
      float base = 1.0 - smoothstep(0.0, uBarkP.z, vUv.y + (st.b - 0.5) * 1.3);
      float twig = smoothstep(0.0, 1.0, vData.z);   // thin branches read dark
      c = mix(barkA, barkB, clamp(max(max(marks, base * 0.9), twig), 0.0, 1.0));
      // soft grey washes drift up the trunk: never one even white
      c *= mix(vec3(1.0), vec3(0.80, 0.80, 0.87), smoothstep(0.48, 0.70, nb.g) * 0.7 * pale);
      float dryM = smoothstep(0.56, 0.68, st.g * 0.5 + st.r * 0.6);
      c = mix(c, vec3(1.0), dryM * uBarkP.w * near * 0.5);
    #endif
    c = pcWetWash(pcDensity(c, 1.0 + (n1.r - 0.5) * 0.7), 0.9);     // wet bark goes dark
    x = dot(nV, sunV) * 0.5 + 0.5;
    // (PAINTER 14: a pale trunk keeps its sunlit side under the canopy's shade, so a birch wood's trunks are its paper
    // lights, the shaded side glazed: the leaf shadow laid over them whole made the reference forest's birches light
    // grey, and the frame had no paper anywhere)
    x *= mix(0.55 + 0.30 * pale, 1.0, pcDappleL(vBody, canopy * 0.8, 8.0 - vAbove));
    x += (n1.g - 0.5) * 0.12;
    float lvl = pcLevel(x, 0.06);
    // pale bark takes a thinner shadow wash: by day the trunks stay the lights of the picture
    c = mix(pcTone(c, lvl), pcTone(c, max(lvl, 1.0) * 0.5 + 1.0), pale * 0.75 * max(uDayness, uMoon));     // (and by night: birch bark is one of a nocturne's reserved lights)
    id = 3.0 + seed * 0.9;
  } else if (part < 1.5) {
    // ---- foliage mass: a few overlapping washes with a ragged, dabbed edge.
    // The dabs keep about the same size on the sheet at any distance: far crowns are fewer,
    // larger strokes (two octaves cross-faded, anchored to the tree).
    float lodf = log2(max(vd / 7.0, 1.0));
    float l0 = floor(lodf);
    float fr = smoothstep(0.25, 0.75, lodf - l0);
    float s0 = exp2(-l0);
    vec2 suv = vUv * uLeafP.z;
    vec4 st = mix(texture(uStrokeTex, suv * s0 + seed * 3.7), texture(uStrokeTex, suv * s0 * 0.5 + seed * 3.7), fr);
    vec4 n2 = mix(texture(uNoise3D, vBody * (s0 / 2.6) + 0.4), texture(uNoise3D, vBody * (s0 / 5.2) + 0.4), fr);
    float rim = 1.0 - abs(dot(nV, V));
    float cut = smoothstep(0.30, 0.92, rim) * uLeafP.x + uLeafP.y * smoothstep(0.52, 0.72, n2.r);
    // the edge of a wash is a little more broken than its inside
    float stE = texture(uStrokeTex, suv * s0 * 2.0 + seed * 1.3).g;
    if (mix(st.g, stE, 0.45) + (n2.g - 0.5) * 0.5 < cut) discard;
    vec3 mV = normalize(vMassV);
    float hue = vInst.x + (n1.b - 0.5) * 0.9 + (vData.w - 0.5) * 0.7;
    c = mix(leafA, leafB, clamp(0.5 + hue * 0.5, 0.0, 1.0));
    c = mix(c, leafC, clamp(vData.z * 0.75 + (n2.b - 0.5) * 0.3, 0.0, 1.0));
    c = pcWetWash(pcDensity(c, 1.0 + (n1.r - 0.5) * 0.9 + vInst.y * 0.5), 0.7);
    // snow lies on the tops of the masses: bare paper with a ragged lower edge
    float snowF = pcSnowCover(dot(mV, upV) * 0.5 + 0.5, st.g * 0.6 + n2.g * 0.4, vData.z * 0.8);
    c = mix(c, vec3(0.97, 0.98, 1.0), snowF);
    x = dot(mV, sunV) * 0.5 + 0.5;
    x = x * (1.0 - vData.z * 0.42 * (1.0 - snowF));
    float through = pow(max(dot(-V, sunV), 0.0), 1.5);
    x = max(x, through * (0.50 + 0.45 * st.g + (n2.r - 0.5) * 0.5));
    x *= mix(0.62, 1.0, pcDappleL(vBody, canopy * 0.6, 8.0 - vAbove));
    // each wash of the crown sits at its own value; a few dark touches inside
    x += (vData.w - 0.5) * 0.26 + (n2.g - 0.5) * 0.14 - smoothstep(0.55, 0.8, st.g) * 0.16;
    // (PAINTER 13: light comes through a crown and off the sky into it: no wash of a crown goes below one glaze, and the
    // floor itself wanders from wash to wash. The near autumn crowns overhead, their inner washes in the canopy's shade,
    // went to the deepest step and stood as flat, hard sepia masses; a forest's near crowns as one dark slate)
    x = max(x, 0.29 + 0.20 * st.g + (n2.r - 0.5) * 0.22 + (vData.w - 0.5) * 0.16);
    float lvl = min(pcLevel(x, 0.07), 2.6);
    // (and a crown's shade is its own colour laid heavier with only half the cool glaze over it: the violet glaze over an
    // orange or gold crown made mud, the autumn wood's near crowns one flat sepia; a green crown's shade goes deep green,
    // not slate)
    vec3 deepF = pcDensity(c, 1.45) * mix(vec3(1.0), uGlaze, 0.45);
    c = mix(pcTone(c, lvl), deepF, (1.0 - smoothstep(0.8, 1.7, lvl)) * 0.75 * uDayness);
    wet = max(uLeafP.w, uWx.y * 0.5);
    id = 4.0 + fract(seed * 7.0 + vData.w * 0.37) * 0.9;
  } else if (part < 2.5) {
    // ---- blades and fronds: single crisp strokes, lit like the ground under them
    // (under snow most of them are buried; the few left stand dark against the paper)
    if (seed < uWx.z * 0.9) discard;
    float hue = vInst.x + (n1.b - 0.5) * 0.8;
    c = mix(leafA, leafB, clamp(0.5 + hue * 0.5, 0.0, 1.0));
    c = mix(c, leafC, clamp(0.55 - vUv.y * 0.7, 0.0, 1.0));
    c = mix(c, vec3(0.50, 0.43, 0.40), uWx.z * 0.85);      // (what still stands out of the snow is dead stalk, not a green fleck)
    c = pcWetWash(pcDensity(c, 1.0 + (n1.r - 0.5) * 0.8 + vInst.y * 0.5), 0.6);
    x = dot(normalize(vMassV), sunV) * 0.5 + 0.5;
    x *= mix(0.42, 1.0, pcDappleL(vBody, canopy, 8.0 - vAbove));
    x += (n1.g - 0.5) * 0.14 + vUv.y * 0.10;
    float lvl = pcLevel(x, 0.06);
    c = pcTone(c, lvl);
    wet = 0.1;
    id = 4.0 + seed * 0.9;
  } else if (part < 3.5) {
    // ---- accent: one soft touch of pure pigment (none on a snowfield)
    if (seed < uWx.z * 1.2) discard;
    c = pcDensity(uAccent, 1.0 + (n1.r - 0.5) * 0.9);
    x = 0.6 * mix(0.6, 1.0, pcDappleL(vBody, canopy, 8.0 - vAbove));
    c = pcTone(c, pcLevel(x + 0.2, 0.08));
    wet = 0.35;
    id = 4.0 + seed * 0.9;
  } else {
    #ifdef PC_OIL
    // ---- a boulder in the oil look: planes of flat paint. Its cleaved faces are each one piece, a little its own colour
    // (a face's number comes from the way it looks, in the stone's own space), lit whole, in half-tone steps; no
    // nibbled edge, no grain. On a world of snow, and under snow anywhere, what faces up is snow. (As a wash it stood in
    // the oil look as a smooth-shaded lump: the critic.)
    {
      vec3 nb = normalize(vMassO);
      float fh = fract(sin(dot(floor(nb * 3.0 + 0.5), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
      c = mix(barkA, barkB, clamp(vData.z * 0.7 + (fh - 0.5) * 0.5, 0.0, 1.0));
      c = pcWetWash(pcDensity(c, 1.0 + (fh - 0.5) * 0.5), 0.8);
      float upF = dot(nV, upV);
      float snowR = max(pcSnowCover(upF * 0.5 + 0.5, fh, 0.0), uGroundK.x * step(0.55, upF));
      c = mix(c, vec3(0.92, 0.95, 0.98), snowR);
      float xrF = dot(nV, sunV) * 0.5 + 0.5, xrS = pcSunAt(vBody, canopy, 8.0 - vAbove, 0.3);      // (L3: one light)
      x = xrF * mix(0.45, 1.0, xrS);
      float lvlR = floor((uLookF.z > 0.5 ? pcLit(xrF, xrS, canopy, 0.04) : pcLevel(x, 0.04)) * 2.0 + 0.5) * 0.5;
      if (uGem > 0.5) lvlR = max(lvlR, 1.5);      // (a crystal is lit through: none of its faces goes to the deep step)
      vec3 kR = c;                                // (its own wash, kept: the lantern and the fire mix their light from it)
      c = pcLamp(pcTone(c, lvlR), kR, vBody, fh);
      #ifdef PC_FIRE
        c = pcFireLit(c, kR, vBody, fh);          // (the powers, fire: a boulder beside a fire is warm on the side the fire is on)
      #endif
      id = 3.0 + seed * 0.9;
    }
    #else
    // ---- rock: pale granulating wash, paper on top, pooled dark at the base
    // the silhouette is nibbled and the tones wander: a wash, not a faceted solid
    vec4 nr = texture(uNoise3D, vBody / 2.3 + 0.3);
    float rimR = 1.0 - abs(dot(nV, V));
    if (rimR > 0.92 - 0.20 * smoothstep(0.42, 0.74, nr.r)) discard;
    c = mix(barkA, barkB, clamp(vData.z * 0.8 + (n1.r - 0.5) * 0.5, 0.0, 1.0));
    // (the pigment gathers just inside the stone's edge, as a wash dries on a rough form)
    c = pcWetWash(pcDensity(c, 1.0 + (n1.b - 0.5) * 0.9 + (nr.b - 0.5) * 0.5 + smoothstep(0.55, 0.88, rimR + (nr.r - 0.5) * 0.2) * 0.38), 0.8);
    float snowR = pcSnowCover(dot(nV, upV) * 0.5 + 0.5, nr.g * 0.6 + n1.r * 0.4, 0.0);
    c = mix(c, vec3(0.97, 0.98, 1.0), snowR);
    x = dot(nV, sunV) * 0.5 + 0.5;
    x *= mix(0.45, 1.0, pcDappleL(vBody, canopy, 8.0 - vAbove));
    vec4 nf = texture(uNoise3D, vBody / 0.55 + 0.61);
    x += (n1.g - 0.5) * 0.22 + (nr.g - 0.5) * 0.26 + (nf.b - 0.5) * 0.1;
    // (a crystal is lit through: the middle of every facet keeps a light core of its own wash and no facet takes more than
    // one glaze; where the light passes the edge goes to paper. As stone they went to the deep step and every one was the
    // same saturated blue-violet, whatever its wash: Mercury's crystal gardens, ARTPASS weakest 3)
    if (uGem > 0.5) x = max(x + 0.04, 0.28 + 0.18 * (1.0 - rimR) + (nr.g - 0.5) * 0.20);
    float lvl = pcLevel(x, 0.12);
    c = pcTone(c, lvl);
    if (uGem > 0.5) c = mix(c, vec3(0.99, 0.985, 0.97), smoothstep(0.72, 0.92, rimR + (nr.b - 0.5) * 0.3) * smoothstep(1.6, 2.6, lvl) * 0.6);
    float dryM = pcStepF(0.60, 0.70, nf.b * 0.6 + nf.r * 0.4, 0.36 * pcSub(0.55, PC_NB) + 0.16 * pcSub(0.55, PC_NRG));
    c = mix(c, vec3(1.0), dryM * 0.5 * near * (0.3 + 0.25 * lvl));
    id = 3.0 + seed * 0.9;
    #endif
  }
  #ifdef PC_FIRE
    // (the powers, fire) WHAT THE FIRE LEFT STANDING IS SCORCHED. The trunk and the branches of a burnt tree are
    // charred -- less than the crown was, because bark chars where leaves burn away -- so the tree is left a black
    // skeleton. A leaf has its own charcoal laid once a leaf (PROP_VERT), so it is left alone here. Nothing else
    // carries a burnt number, so grass, ferns and stones are untouched.
    if (vBurnt > 0.001 && part < 4.5) {
      float kb = vBurnt * uBurnK.x * (1.0 - uBurnK.z) * (part < 0.5 ? 0.66 : 1.0);
      c = mix(c, pcSoot(c, fract(seed * 3.37), fract(vData.w * 5.9)), kb);
    }
  #endif
  // (the speed test, uOilL.y = 6: the air between is not laid on a plant at all. What that costs is a question
  //  about every pixel of every plant, which is why it is asked here and not only of the whole picture.)
  #ifdef PC_OIL
    if (!(uOilL.y > 5.5 && uOilL.y < 6.5)) c = pcAtmosV(c, vFog, vView);
  #else
    c = pcAtmosV(c, vFog, vView);
  #endif
  wet = max(max(wet, vFog * 0.85), uWx.w * smoothstep(10.0, 90.0, vd) * 0.9);
  #ifdef PC_OIL
    wet = oilCover;       // (the oil look has no wet paint: the first target's alpha is the pixel's cover, for alpha to coverage)
  #endif
  pcWrite(c, wet, nV, -vView.z, id);
}
`;

// ------------------------------------------------------------------------------------------
// THE TREES' TWO SHORT PROGRAMS (?trees2=, 2026-11-24; docs/lead/TREES-DESIGN.md on r2, package T2; the oil look only).
// A near tree was ONE program for its bark and its leaves: the bark's two layers of streaks (some two thousand
// operations a pixel, five to nine tones, three shadow reads) and the leaf's few dozen shared a program, so every leaf
// pixel was run by a program the size of the bark's, and where a twig crossed the leaves the whole group of pixels
// waited on the bark. The owner's phone measured the near trees at about 52 ms of an 89 ms frame (v37). Here a tree is
// drawn by two programs, each only as long as its own part:
//   WOOD_FRAG: the bark's streaks as before -- the same chart, the same octaves, the same two layers laid the same
//     way, each at its own light -- with only what the big program spent and threw away left out: the flat wash under
//     the layers (one tone and a shadow read, painted over whole wherever the strokes are on), and the finer layer's
//     tones and light where neither of its streaks is there. (A first cut toned only two streaks a pixel; the look
//     director saw the trunk's streaks flatter and less broken at 5 m, and the owner keeps today's, 24 Nov.)
//   LEAF_FRAG: a leaf's paint is already worked out once a leaf in the vertex shader; this only lays it, with the
//     lantern and the air. No discard and no alpha to coverage: the leaves a window or a wash leaves out are folded
//     away whole in the vertex shader (PROP_VERT, PC_TREE_LEAF), so the card can test depth before it paints.
// (Neither program has a single discard: see PROP_VERT, PC_TREE_LEAF and PC_TREE_WOOD, for where those went.)
const TREE_HEAD = /* glsl */`
${FRAG_PARS}
uniform vec3 uBarkA;
uniform vec3 uBarkB;
uniform vec4 uBarkP;
uniform vec3 uLeafA;
uniform float uCanopy;
uniform vec4 uOilDark;
uniform vec3 uOilDarkA;
uniform vec3 uOilDarkB;
uniform mat3 normalMatrix;
varying vec3 vBody;
varying vec3 vObj;
varying vec3 vNV;
varying vec3 vView;
varying vec2 vUv;
varying vec4 vData;
varying vec4 vInst;
varying float vAbove;
varying float vFog;
varying vec3 vRelO;
varying vec3 vCardB;
varying vec4 vLeafC;
varying vec4 vLeafK;
#define vScaleO vLeafK.a
${PC_UP_F}
#ifdef PC_FIRE
varying float vBurnt;
uniform vec4 uBurnK;
${FIRE_GLOW}
#endif
`;

const WOOD_FRAG = /* glsl */`
${TREE_HEAD}
// One streak of bark (PROP_FRAG's bark as it stands there): its own colour from its numbers, before the light.
vec3 pcWoodColour(vec3 rnd, vec4 nA, vec3 barkA, vec3 barkB, float markP, float twig) {
  float base = 1.0 - smoothstep(0.0, uBarkP.z, vUv.y + (rnd.y - 0.5) * 1.1);
  float m1 = step(1.0 - markP, rnd.x);
  vec3 k = mix(barkA, barkB, clamp(max(max(m1, base * 0.9), twig), 0.0, 1.0));
  k = pcWetWash(pcDensity(k, 1.0 + ((rnd.y - 0.5) * 1.5 + (nA.r - 0.5) * 0.5) * uOilB.z), 0.9);
  return k * mix(vec3(1.0), mix(vec3(1.12, 0.96, 0.80), vec3(0.90, 0.90, 1.08), rnd.z), 0.7 * uOilB.z);
}
// One layer's light, at the centre of the pixel's own streak in it (its facing there, and the shadow map there), and
// that streak's nudge by its own number: PROP_FRAG's bark lights each layer so. Out: the centre on the body, and the
// noise there (it shades the streaks' colour).
float pcWoodLevel(vec2 ds, float w, float rx, vec3 bdx, vec3 bdy, vec3 nvdx, vec3 nvdy, bool seenFront, vec3 sunV,
                  float pale, float canopy, out vec3 Bc, out vec4 nA) {
  Bc = vBody + bdx * ds.x + bdy * ds.y;
  vec3 nVc = normalize(vNV + nvdx * ds.x + nvdy * ds.y);
  if (!seenFront) nVc = -nVc;
  nA = uOilL.x > 0.5 ? vec4(0.5) : pcNoiseS(Bc, 9.0, w);
  float xf = dot(nVc, sunV) * 0.5 + 0.5, sunny = pcSunAt(Bc, canopy * 0.8, 8.0 - vAbove, w), jit = (rx - 0.5) * 0.10;
  // (the look director's one light, L3, as PROP_FRAG's bark takes it: uLookF.z picks it, chunks.js pcLit)
  return uLookF.z > 0.5 ? pcLit(xf + jit, sunny, canopy * 0.8, 0.03) : pcLevel(xf * mix(0.55 + 0.30 * pale, 1.0, sunny) + jit, 0.03);
}
// and a streak's paint at its layer's light level (the big program tones a streak and the one at its edge at the
// SAME level, the level of the pixel's own streak in that layer, so only the colour differs between the two)
vec3 pcWoodPaint(vec3 k, float lvl, float pk, vec3 Bc, float r) {
  vec3 l = pcTone(k, lvl);
  if (pk > 0.001) l = mix(l, pcTone(k, max(lvl, 1.0) * 0.5 + 1.0), pk);
  l = pcLamp(l, k, Bc, r);
  #ifdef PC_FIRE
    l = pcFireLit(l, k, Bc, r);
  #endif
  return l;
}
void main() {
  #include <logdepthbuf_fragment>
  #ifdef PC_TREE_FAIL
    pcTreeFail = 1.0;      // (?trees2fail=wood: not GLSL on purpose, the guard's test: materials.js TREE_GUARD)
  #endif
  // (the speed test's cuts, shared.js uOilL.y, as the big program honours them: 4 written at once, 2 one flat colour)
  if (uOilL.y > 3.5 && uOilL.y < 4.5) { pcWrite(vec3(0.42, 0.40, 0.32), 1.0, vec3(0.0, 0.0, 1.0), -vView.z, 3.0); return; }
  pcDist = length(vView);
  // (which way the face seen is turned. The wood is drawn BackSide (makePropMaterial), and three draws a BackSide
  //  material by turning the winding over, so the faces seen report themselves front-facing; the big program, drawing
  //  the same faces DoubleSide, saw them as back faces and turned their normals round. PC_WOOD_FLIP keeps that
  //  exactly, so the bark is lit as it always was.)
  #ifdef PC_WOOD_FLIP
    bool seenFront = !gl_FrontFacing;
  #else
    bool seenFront = gl_FrontFacing;
  #endif
  vec3 nV = normalize(vNV);
  if (!seenFront) nV = -nV;
  // (2: the plants one flat colour; 7: the near bark one flat colour -- the split's wood is all bark)
  if ((uOilL.y > 1.5 && uOilL.y < 2.5) || (uOilL.y > 6.5 && uOilL.y < 7.5)) { pcWrite(uBarkB, 1.0, nV, -vView.z, 3.0); return; }
  vec3 sunV = normalize((viewMatrix * vec4(uSunDirW, 0.0)).xyz);
  ${SKYUP('dot(nV, mat3(viewMatrix) * uUpW)')}
  float seed = vInst.z;
  float canopy = vInst.w * uCanopy;
  float vd = length(vView);
  float dk = step(fract(seed * 5.31 + 0.17), uOilDark.x - 0.001);
  vec3 barkA = mix(uBarkA, uOilDarkA, dk), barkB = mix(uBarkB, uOilDarkB, dk);
  bool along = uBarkP.y > 0.5 || dk > 0.5;
  float wpxP = uOilA.x * uOilPx.y / 720.0;
  vec2 uvm = vec2(vUv.y, vUv.x * 1.1) * vScaleO;
  vec2 ch = (along ? uvm : uvm.yx) + seed * 37.0;
  vec2 ux = dFdx(vUv), uy = dFdy(vUv);
  vec2 mx = vec2(ux.y, ux.x * 1.1) * vScaleO, my = vec2(uy.y, uy.x * 1.1) * vScaleO;
  vec2 dcx = along ? mx : mx.yx, dcy = along ? my : my.yx;
  vec2 oc = pcStrokeOct(vd * (0.85 + 0.3 * seed), 0.004);
  float gone = smoothstep(0.15, 0.85, oc.y);
  vec3 nvdx = dFdx(vNV), nvdy = dFdy(vNV), bdx = dFdx(vRelO), bdy = dFdy(vRelO);
  float pale = smoothstep(0.55, 0.9, dot(barkA, vec3(0.333)));
  float markP = mix(mix(0.10, 0.42, clamp((0.72 - uBarkP.x) * 4.0, 0.0, 1.0)), 0.34, dk);
  float twig = smoothstep(0.0, 1.0, vData.z);
  float pk = pale * 0.45 * max(uDayness, uMoon);
  float ba = along ? 15.0 : 3.2;
  // both layers' streaks, found for every pixel alike (they take screen derivatives): the finer, and the coarser it
  // gives way to toward the next octave of the distance
  vec3 rF, rF2, rC, rC2; vec2 dsF, dsC; float cF, cC;
  pcThinLayer(ch, dcx, dcy, oc.x, ba, vObj + seed * 11.0, 4.0 * wpxP * ba, 2.0, rF, dsF, cF, rF2);
  pcThinLayer(ch, dcx, dcy, oc.x * 2.0, ba, vObj + seed * 11.0, 8.0 * wpxP * ba, 2.0, rC, dsC, cC, rC2);
  // THE COARSER LAYER, whole, at its own light: its streak and the one at its edge (the big program's L == 1)
  vec3 BcC, BcF; vec4 nAC, nAF;
  float lvC = pcWoodLevel(dsC, oc.x * 2.0, rC.x, bdx, bdy, nvdx, nvdy, seenFront, sunV, pale, canopy, BcC, nAC);
  vec3 c = mix(pcWoodPaint(pcWoodColour(rC2, nAC, barkA, barkB, markP, twig), lvC, pk, BcC, rC2.y),
               pcWoodPaint(pcWoodColour(rC, nAC, barkA, barkB, markP, twig), lvC, pk, BcC, rC.y), cC);
  // (the speed test's strokes off, uOilC.z: the big program's flat wash under the layers shows through; with the
  //  strokes on, the default, the coarse layer covers it whole, so it is not painted at all)
  if (uOilC.z < 0.999) {
    float xbF = dot(nV, sunV) * 0.5 + 0.5, xbS = pcSunAt(vBody, canopy * 0.8, 8.0 - vAbove, oc.x);
    float lvW = uLookF.z > 0.5 ? pcLit(xbF, xbS, canopy * 0.8, 0.04) : pcLevel(xbF * mix(0.55 + 0.30 * pale, 1.0, xbS), 0.04);
    c = mix(pcTone(mix(barkA, barkB, 0.16), lvW), c, uOilC.z);
  }
  // THE FINER LAYER over it, at ITS own light: a fine streak still there lies on top, and at its edge the next fine
  // streak if that one is there, the coarse layer if not; where the fine streak has gone (its number under the
  // octave's share) the coarse layer shows, with the next fine streak still at the edge if it is there. Where neither
  // is there the coarse layer is the whole answer, and the finer layer's light and tones are not worked out.
  bool here = rF.x * 0.999 >= gone, there = rF2.x * 0.999 >= gone;
  if (here || there) {
    float lvF = pcWoodLevel(dsF, oc.x, rF.x, bdx, bdy, nvdx, nvdy, seenFront, sunV, pale, canopy, BcF, nAF);
    vec3 e = there ? pcWoodPaint(pcWoodColour(rF2, nAF, barkA, barkB, markP, twig), lvF, pk, BcF, rF2.y) : c;
    vec3 lay = here ? mix(e, pcWoodPaint(pcWoodColour(rF, nAF, barkA, barkB, markP, twig), lvF, pk, BcF, rF.y), cF) : mix(e, c, cF);
    c = mix(c, lay, uOilC.z);
  }
  #ifdef PC_FIRE
    if (vBurnt > 0.001) {
      // (what the fire left standing is charred, as the big program chars it: a cold charcoal at the paint's own value)
      float sv = dot(c, vec3(0.3, 0.5, 0.2));
      vec3 soot = clamp(vec3(sv) * vec3(0.88, 0.88, 1.12) * (0.20 + 0.16 * fract(seed * 3.37)) * uBurnK.w, 0.0, 1.0);
      c = mix(c, soot, vBurnt * uBurnK.x * (1.0 - uBurnK.z) * 0.66);
    }
  #endif
  if (!(uOilL.y > 5.5 && uOilL.y < 6.5)) c = pcAtmosV(c, vFog, vView);
  pcWrite(c, 1.0, nV, -vView.z, 3.0 + seed * 0.9);
}
`;

const LEAF_FRAG = /* glsl */`
${TREE_HEAD}
void main() {
  #include <logdepthbuf_fragment>
  #ifdef PC_TREE_FAIL
    pcTreeFail = 1.0;      // (?trees2fail=leaf: not GLSL on purpose, the guard's test: materials.js TREE_GUARD)
  #endif
  if (uOilL.y > 3.5 && uOilL.y < 4.5) { pcWrite(vec3(0.42, 0.40, 0.32), 1.0, vec3(0.0, 0.0, 1.0), -vView.z, 3.0); return; }
  vec3 nV = normalize(vNV);
  if (!gl_FrontFacing) nV = -nV;
  if (uOilL.y > 1.5 && uOilL.y < 2.5) { pcWrite(uLeafA * 0.7, 1.0, nV, -vView.z, 3.0); return; }
  // (a leaf: one piece of flat colour, worked out once a leaf in the vertex shader; here the lantern's light, the fire's
  //  and the air are laid over it, as the big program's leaf branch lays them)
  float h = vData.w;
  vec3 c = uOilL.y > 4.5 && uOilL.y < 5.5 ? vLeafC.rgb : pcLamp(vLeafC.rgb, vLeafK.rgb, vCardB, fract(h * 13.7));
  #ifdef PC_FIRE
    c = pcFireLit(c, vLeafK.rgb, vCardB, fract(h * 13.7));
  #endif
  if (!(uOilL.y > 5.5 && uOilL.y < 6.5)) c = pcAtmosV(c, vFog, vView);
  pcWrite(c, 1.0, nV, -vView.z, 4.0 + fract(vInst.z * 7.0 + h * 0.37) * 0.9);
}
`;

// A CARD OF LEAVES (?trees2=cards; kitbuild.js clusterCard; docs/lead/TREES-DESIGN.md on r2, package T2). The card is
// four triangles; its leaves are the baked layer of leaf dabs the ground already uses (dabtex.js), laid over the card's
// own chart in metres. For each pixel: the topmost dab there that is laid at all (a share of the dabs is left out by
// number: the sky between leaves) and that lies WHOLE inside the card (a leaf that would cross the card's edge is not
// laid, so the card's outline is the leaves' own, ragged leaf by leaf). That leaf is painted at its own exact centre,
// as a leaf card is in the vertex shader: its colour from the tree's three by its number, its light from the card's
// mass normal turned its own way, the shadow map asked once at its centre, one tone. Where no leaf lies, the sky.
const CARD_FRAG = /* glsl */`
${FRAG_PARS}
uniform float uCanopy;
varying vec3 vView;
varying vec2 vUv;
varying vec4 vInst;
varying float vFog;
flat varying vec3 vCardC;
flat varying vec3 vCardU;
flat varying vec3 vCardV;
flat varying vec3 vCardM;
flat varying vec3 vCardLA;
flat varying vec3 vCardLB;
flat varying vec3 vCardLC;
flat varying vec4 vCardS;
flat varying vec2 vCardR;
${PC_UP_F}
#ifdef PC_FIRE
varying float vBurnt;
uniform vec4 uBurnK;
${FIRE_GLOW}
#endif
${LEAF_SUN}
${SPRAY_GLSL}
void main() {
  #include <logdepthbuf_fragment>
  if (uOilL.y > 3.5 && uOilL.y < 4.5) { pcWrite(vec3(0.42, 0.40, 0.32), 1.0, vec3(0.0, 0.0, 1.0), -vView.z, 3.0); return; }
  // the card's chart, in the dab layer's own cells (kitbuild.js clusterCard), its screen derivatives for the leaf's
  // clean edge, and the topmost leaf laid there (dabtex.js SPRAY_GLSL: the shadow map finds the very same leaf)
  vec2 off = vec2(vCardS.y * 23.0);
  vec2 dpx = dFdx(vUv), dpy = dFdy(vUv);
  vec2 ipx = 1.0 / max(vec2(length(vec2(dpx.x, dpy.x)), length(vec2(dpx.y, dpy.y))), vec2(1e-6));
  vec3 rnd; vec2 ctr;
  float ePx = pcSpray(vUv + off, off, ipx, vCardR.x, uOilS.z, rnd, ctr);
  float cover = clamp(ePx, 0.0, 1.0);
  // (a leaf's edge: with the scene multisampled it takes the share of the pixel it covers, by alpha to coverage, as a
  //  crown's dab does in the big program; with one sample a leaf is there or it is not)
  // (?treedepth=1, package T5: the DEPTH PASS cuts the leaves here and writes only depth; the COLOUR pass after it,
  //  drawn where the depth is equal, never discards -- the leaf it is shading is the one the depth pass kept, so the
  //  graphics card's early depth test does the cutting and every pixel of a tree is painted once)
  #ifdef PC_TREE_DEPTH
    if (cover < 0.5) discard;
    pcWrite(vec3(0.0), 1.0, vec3(0.0, 0.0, 1.0), 0.0, 4.0);
    return;
  #endif
  #ifndef PC_TREE_EQUAL
    if (cover < (uOilG.z > 0.5 ? 0.06 : 0.5)) discard;
  #endif
  vec3 nV = vCardM;
  if (uOilL.y > 1.5 && uOilL.y < 2.5) { pcWrite(vCardLA * 0.7, 1.0, nV, -vView.z, 3.0); return; }
  pcUp = vCardS.z;
  vec3 sunV = normalize((viewMatrix * vec4(uSunDirW, 0.0)).xyz);
  float twig = vCardS.w;
  // the leaf's colour: the tree's three by its own number, and the inner leaves of a clump in the darker one
  float rr = length(ctr) / max(0.866 * vCardR.x, 1e-3);
  float shL = clamp(vCardS.x + 0.6 * (1.0 - pow(rr, 0.35)), 0.0, 1.0);
  float hueL = vInst.x + (rnd.x - 0.5) * 1.7;
  vec3 cs = mix(vCardLA, vCardLB, clamp(0.5 + hueL * 0.5, 0.0, 1.0));
  cs = mix(cs, vCardLC, clamp(shL * 0.55 + (rnd.y - 0.5) * 0.6, 0.0, 1.0));
  cs = pcWetWash(pcDabTint(pcDensity(cs, 1.0 + vInst.y * 0.4), rnd, 1.0 - twig), 0.7);
  // its light, at its centre, whole: the card's mass normal turned the leaf's own way, the sun through the leaves
  // toward the eye, the shadow map once at the leaf's own place on the body
  vec3 mL = normalize(vCardM + (rnd.yzx - 0.5) * 0.9);
  float xl = (dot(mL, sunV) * 0.5 + 0.5) * (1.0 - shL * 0.35);
  xl = max(xl, vCardR.y * (0.6 + 0.4 * rnd.x) * (1.0 - twig));
  vec3 Bc = vCardC + vCardU * ctr.x + vCardV * ctr.y;
  xl *= mix(0.50, 1.0, pcSunAtV(Bc, vInst.w * uCanopy * 0.4, rnd.z));
  xl += (rnd.z - 0.5) * 0.25;
  xl = max(xl, 0.30 + 0.15 * rnd.x);
  float lv = pcLevel(xl, 0.03);
  vec3 c = mix(pcLeafDeep(cs), pcTone(cs, lv), smoothstep(1.2, 2.0, lv));
  if (!(uOilL.y > 4.5 && uOilL.y < 5.5)) c = pcLamp(c, cs, Bc, fract(rnd.x * 13.7));
  #ifdef PC_FIRE
    c = pcFireLit(c, cs, Bc, fract(rnd.x * 13.7));
  #endif
  if (!(uOilL.y > 5.5 && uOilL.y < 6.5)) c = pcAtmosV(c, vFog, vView);
  pcWrite(c, cover, nV, -vView.z, 4.0 + fract(vInst.z * 7.0 + rnd.x * 0.37) * 0.9);
}
`;

// THE CARDS LAID IN DEPTH FIRST (?treedepth=1, package T5; render/index.js draws them, world/flora.js fills it): on
// whether the pass runs, meshes the card meshes that take part, each carrying in userData.pcDepthMats the materials it
// is drawn with in that pass (its wood hidden, its cards in depth only).
export const TREE_DEPTH = { on: false, meshes: new Set() };
// THE GUARD ON THE TREES' TWO SHORT PROGRAMS (the default since 24 Nov; flora.js TREES2). A phone's driver may refuse a
// program the desktop takes. three says so in its own words for every program it links (renderer.debug.checkShaderErrors,
// on by default: a console error with the compiler's log, and program.diagnostics.runnable false); the painter asks here
// after each frame whether any of the trees' programs is among those (render/index.js), and the first that is sets
// failed: every world's flora then puts every tree back to the one program at once (flora.js update), and the console
// says which program and why. mats: every tree program made (makePropMaterial). ?trees2fail=wood or leaf (or 1, the
// wood) breaks that program on purpose, so the guard can be seen to work.
export const TREE_GUARD = { mats: new Set(), failed: '' };
const TREE_FAIL = (() => {
  if (typeof location === 'undefined' || !location.search) return '';
  const q = new URLSearchParams(location.search).get('trees2fail');
  return q === '1' || q === 'wood' ? 'wood' : q === 'leaf' ? 'leaf' : '';
})();
export function treeGuardCheck(renderer) {
  if (TREE_GUARD.failed || !TREE_GUARD.mats.size || !renderer || !renderer.properties) return TREE_GUARD.failed;
  for (const m of TREE_GUARD.mats) {
    const progs = renderer.properties.get(m).programs;
    if (!progs) continue;
    for (const p of progs.values()) {
      const d = p && p.diagnostics;
      if (!d || d.runnable !== false) continue;
      const log = [d.fragmentShader && d.fragmentShader.log, d.vertexShader && d.vertexShader.log, d.programLog].filter(Boolean).join('\n');
      const first = (log.split('\n').find((l) => l.trim()) || 'the driver gave no log').trim().slice(0, 200);
      TREE_GUARD.failed = (m.name || 'a tree program') + ': ' + first;
      console.warn('[trees] the trees\' two short programs cannot be used on this device (' + TREE_GUARD.failed +
        '). Every tree goes back to the one program it was drawn by before (as ?trees2=0).');
      return TREE_GUARD.failed;
    }
  }
  return '';
}

export function makePropMaterial(bodyU, opts = {}) {
  const v3 = (a, d) => ({ value: new THREE.Vector3().fromArray(a || d) });
  const own = {
    uOrigin: { value: new THREE.Vector3() }, uCamLocal: { value: new THREE.Vector3() },
    uLod: { value: new THREE.Vector4(0, 1e9, 0, 0.9) },
    uWashIn: { value: new THREE.Vector3(1e6, 0, 0.55) },
    uFocus: { value: new THREE.Vector4(0, 0, 0, 0) },
    uWind: { value: opts.wind == null ? 0.06 : opts.wind },
    uBarkA: v3(opts.barkA, [0.95, 0.94, 0.92]), uBarkB: v3(opts.barkB, [0.30, 0.27, 0.27]),
    uBarkP: { value: new THREE.Vector4().fromArray(opts.barkP || [0.62, 0, 1.0, 0.5]) },
    uLeafA: v3(opts.leafA, [0.72, 0.80, 0.36]), uLeafB: v3(opts.leafB, [0.50, 0.68, 0.34]),
    uLeafC: v3(opts.leafC, [0.30, 0.48, 0.40]),
    uLeafP: { value: new THREE.Vector4().fromArray(opts.leafP || [0.8, 0.25, 1.0, 0.45]) },
    uAccent: v3(opts.accent, [0.85, 0.29, 0.17]),
    uCanopy: { value: opts.canopy == null ? 1.0 : opts.canopy },
    uGem: { value: opts.gem ? 1 : 0 },
    // (the oil look: opts.oilDark = [share, [bark light], [bark dark]])
    uOilKind: { value: opts.oilKind || 0 },
    uLeafLod: { value: new THREE.Vector4(0, 0, 0, 0) },
    uLeafFam: { value: new THREE.Vector4().fromArray(opts.oilFam || [0, 0, 0, 0]) },
    uOilDark: { value: new THREE.Vector4(opts.oilDark ? opts.oilDark[0] : 0, 0, 0, 0) },
    uNeedle: { value: opts.needle || 0 },      // (?pines: flora.js; 0 for every plant but a conifer with the switch on)
    uNearLeaf: { value: opts.nearLeaf || 0 },  // (?nearleaf: flora.js; 0 for every plant but a tree with the switch on)
    uLeafGrow: { value: opts.leafGrow || 0 },  // (?leafgrow: flora.js; 0 for every plant but a tree with the switch on)
    uStormLeaf: { value: opts.stormLeaf || 0 },  // (flora.js: 0.5 for a tall tree by default, ?stormleaf=0 off; 0 for every other plant)
    uOilDarkA: v3(opts.oilDark && opts.oilDark[1], [0.5, 0.4, 0.4]), uOilDarkB: v3(opts.oilDark && opts.oilDark[2], [0.2, 0.15, 0.2]),
  };
  const defines = {};
  if (opts.phys) {
    defines.PC_PHYS = 1;
    if (opts.phys === 'full') defines.PC_PHYS_FULL = 1;
    if (opts.bladeRoot) defines.PC_BLADE_ROOT = 1;
    if (opts.branch) defines.PC_PHYS_BRANCH = 1;
    Object.assign(own, PHYS, { uStiff: { value: opts.stiff || 0 }, uPlantHeight: { value: opts.plantHeight || 1 } });
  }
  if (opts.hollow) {
    // a spire parts round an eye inside it (PROP_VERT, PC_HOLLOW): its girth at the foot, height and lean, in its own units
    defines.PC_HOLLOW = 1;
    own.uHollow = { value: new THREE.Vector4(opts.hollow[0], opts.hollow[1], opts.hollow[2] || 0, 0) };
  }
  if (opts.far) {
    // far trees of every species share one mesh: per-instance species picks the washes
    defines.PC_FAR = 1;
    // (2026-11-24, the trees lane) THE TABLES HOLD EVERY KIND. They were eight long, and Earth in the oil look has
    // thirteen kinds of tree: the far trees of the poplar, the oak, the birch, the willow and the sapling -- five of the
    // autumn wood's six -- read past the end of every table (the graphics card clamps such a read to the last entry it
    // has, or returns nothing), so they were drawn with another kind's colours, taper and colour family. ?farfix=0
    // keeps the eight, for an A and a B.
    const nFar = FARFIX ? Math.max(8, opts.far.length) : 8;
    defines.PC_NFAR = nFar;
    const pad = (a) => { while (a.length < nFar) a.push(a[a.length - 1].clone ? a[a.length - 1].clone() : a[a.length - 1]); if (a.length > nFar) a.length = nFar; return a; };
    const arr = (k) => ({ value: pad(opts.far.map((f) => new THREE.Vector3().fromArray(f[k]))) });
    own.uFarA = arr('leafA'); own.uFarB = arr('leafB'); own.uFarC = arr('leafC');
    own.uFarBarkA = arr('barkA'); own.uFarBarkB = arr('barkB');
    own.uFarTaper = { value: pad(opts.far.map((f) => f.taper || 0)) };
    own.uFarTrunk = { value: pad(opts.far.map((f) => (f.trunk ? 1 : 0))) };
    own.uFarDrop = { value: pad(opts.far.map((f) => (f.drop ? 1 : 0))) };
    own.uFarKind = { value: pad(opts.far.map((f) => f.kind || 0)) };
    own.uFarFam = { value: pad(opts.far.map((f) => new THREE.Vector4().fromArray(f.fam || [0, 0, 0, 0]))) };
  }
  // (the trees' two short programs, ?trees2=: opts.tree 'wood' or 'leaf' -- the oil look only; see WOOD_FRAG above)
  const tree = LOOK.oil && (opts.tree === 'wood' || opts.tree === 'leaf' || opts.tree === 'card') ? opts.tree : null;
  if (tree) defines[tree === 'wood' ? 'PC_TREE_WOOD' : tree === 'leaf' ? 'PC_TREE_LEAF' : 'PC_TREE_CARD'] = 1;
  // (?treedepth=1, the cards only: opts.depth 'first' the depth pass, 'equal' the colour pass drawn after it)
  const dpass = tree === 'card' && (opts.depth === 'first' || opts.depth === 'equal') ? opts.depth : null;
  if (dpass) defines[dpass === 'first' ? 'PC_TREE_DEPTH' : 'PC_TREE_EQUAL'] = 1;
  if (tree === 'wood' && opts.doubleSide) defines.PC_WOOD_FLIP = 1;      // (drawn BackSide: see WOOD_FRAG)
  if (tree && tree === TREE_FAIL) defines.PC_TREE_FAIL = 1;      // (?trees2fail=: the guard's test, TREE_GUARD)
  const m = new THREE.ShaderMaterial({
    name: 'pc-prop-' + (opts.name || ''),
    defines,
    uniforms: baseUniforms(bodyU, own),
    vertexShader: PROP_VERT, fragmentShader: tree === 'wood' ? WOOD_FRAG : tree === 'leaf' ? LEAF_FRAG : tree === 'card' ? CARD_FRAG : PROP_FRAG,
    // (the wood program draws only the faces that are seen: a tube's triangles turn their front inward, so from outside
    //  it is their BACK that shows, and under DoubleSide the inner faces of the far side were drawn as well, only to be
    //  hidden behind the near side. The near side is what wins the depth test either way, so the picture is the same.)
    side: tree === 'wood' && opts.doubleSide ? THREE.BackSide : opts.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
  });
  m.userData.pcPainted = true;
  if (tree) TREE_GUARD.mats.add(m);
  // (the powers, fire: a crown that has burned is left bare and black. The plants need no list of burnt places -- each
  // instance carries its own number, PROP_VERT aBurnt -- so only the dials are attached. A mesh that has no such
  // numbers (grass, ferns, stones, and the trees until the world fills them) reads 0 for every instance, which is
  // "untouched": Three hands the program that 0 itself from the default below, rather than leaving it to chance.)
  addFire(m, false);
  if (m.defines && m.defines.PC_FIRE) m.defaultAttributeValues.aBurnt = [0];
  register(m, 'prop', opts);
  if (LOOK.oil) m.alphaToCoverage = !tree || (tree === 'card' && !dpass);
  if (dpass === 'first') m.colorWrite = false;
  if (dpass === 'equal') { m.depthFunc = THREE.EqualDepth; m.depthWrite = false; }      // (a crown's leaves at its outline: PROP_FRAG, the oil branch. The trees' two short programs have no cut-out edge to soften and no discard: alpha to coverage would only cost them the early depth test)
  return m;
}

// ------------------------------------------------------------------------------------------
// Wash: the general painted material (explorer, ship, Pilot's incidental objects, and the
// stand-in for any foreign Three material found in the scene).
// ------------------------------------------------------------------------------------------
const WASH_VERT = /* glsl */`
${VERT_PARS}
varying vec3 vObj;
varying vec3 vNO;
varying vec3 vNV;
varying vec3 vView;
#ifdef USE_VCOLOR
  attribute vec3 color;
  varying vec3 vVCol;
#endif
#ifdef USE_UVMAP
  varying vec2 vUv;
#endif
#ifdef PC_POINTS
  uniform float uPointSize;
#endif
void main() {
  vec3 p = position;
  vec3 n = vec3(0.0, 1.0, 0.0);
  #ifndef PC_UNLIT
    n = normal;
  #endif
  #ifdef PC_SPRITE
    vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vec2 sc = vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
    mv.xy += position.xy * sc;
    vNV = vec3(0.0, 0.0, 1.0);
  #else
    #ifdef USE_INSTANCING
      p = (instanceMatrix * vec4(p, 1.0)).xyz;
      n = mat3(instanceMatrix) * n;
    #endif
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vNV = normalMatrix * n;
  #endif
  vObj = position; vNO = n;
  vView = mv.xyz;
  #ifdef USE_VCOLOR
    vVCol = color;
  #endif
  #ifdef USE_UVMAP
    vUv = uv;
  #endif
  gl_Position = projectionMatrix * mv;
  #ifdef PC_POINTS
    gl_PointSize = uPointSize;
  #endif
  ${VERT_END}
}
`;

const WASH_FRAG = /* glsl */`
${FRAG_PARS}
#ifdef PC_OIL
${PC_UP_F}
#endif
uniform vec3 uColor;
uniform vec4 uWash;   // noise scale (1/m), dry brush, wetness, region id
uniform float uFlat;  // 1 = no light steps (pure wash)
uniform float uFade;  // 1 = all of it; less: thinned through a fixed stipple (a far world's ball giving way to the world itself)
varying vec3 vObj;
varying vec3 vNO;
varying vec3 vNV;
varying vec3 vView;
#ifdef USE_VCOLOR
  varying vec3 vVCol;
#endif
#ifdef USE_UVMAP
  uniform sampler2D uMap;
  varying vec2 vUv;
#endif
void main() {
  if (uFade < 0.999 && fract(52.9829189 * fract(dot(floor(gl_FragCoord.xy), vec2(0.06711056, 0.00583715)))) >= uFade) discard;
  #include <logdepthbuf_fragment>
  vec3 c = uColor;
  #ifdef USE_VCOLOR
    c *= vVCol;
  #endif
  #ifdef USE_UVMAP
    vec4 tx = texture(uMap, vUv);
    if (tx.a < 0.5) discard;
    c *= tx.rgb;
  #endif
  vec4 n1 = texture(uNoise3D, vObj * uWash.x);
  vec4 n2 = texture(uNoise3D, vObj * uWash.x * 3.7 + 0.31);
  c = pcDensity(c, 1.0 + (n1.r - 0.5) * 0.7 + (n2.g - 0.5) * 0.3);
  vec3 nV = vec3(0.0, 0.0, 1.0);
  float lvl = 2.0;
  #ifndef PC_UNLIT
    nV = normalize(vNV);
    if (!gl_FrontFacing) nV = -nV;
    #ifdef PC_OIL
      ${SKYUP('dot(nV, mat3(viewMatrix) * uUpW)')}      // (which way it faces the sky: chunks.js pcUp, as the ground and the plants set it)
    #endif
    vec3 sunV = normalize((viewMatrix * vec4(uSunDirW, 0.0)).xyz);
    float x = dot(nV, sunV) * 0.5 + 0.5 + (n1.g - 0.5) * 0.14;
    lvl = mix(pcLevel(x, 0.05), 2.0, uFlat);
    vec4 st = pcTri(vObj * 2.0, normalize(vNO), 0.5);
    float dryM = smoothstep(0.52, 0.66, st.r * 0.8 + st.b * 0.3);
    c = mix(c, vec3(1.0), dryM * uWash.y * (0.25 + 0.15 * lvl));
  #endif
  c = pcTone(c, lvl);
  float f = pcFogAmount(length(vView));
  c = pcAtmosV(c, f, vView);
  pcWrite(c, max(uWash.z, f * 0.8), nV, -vView.z, uWash.w);
}
`;

// makeWashMaterial({ color, wet, dry, scale, id, flat, vertexColors, side, map })
//   color: THREE.Color | hex | css string: the wash as it should look on paper
//   wet 0..1: how much it bleeds into neighbours; dry 0..1: dry-brush sparkle
//   scale: size in metres of the wash turbulence; flat: skip the light steps
export function makeWashMaterial(opts = {}) {
  const col = new THREE.Color(opts.color == null ? 0xb9b3a8 : opts.color);
  const rgb = { r: 0, g: 0, b: 0 };
  col.getRGB(rgb, THREE.SRGBColorSpace);
  const defines = {};
  if (opts.vertexColors) defines.USE_VCOLOR = 1;
  if (opts.map) defines.USE_UVMAP = 1;
  if (opts.unlit) defines.PC_UNLIT = 1;
  if (opts.points) { defines.PC_POINTS = 1; defines.PC_UNLIT = 1; }
  if (opts.sprite) { defines.PC_SPRITE = 1; defines.PC_UNLIT = 1; }
  const m = new THREE.ShaderMaterial({
    name: 'pc-wash',
    defines,
    uniforms: baseUniforms(opts.bodyUniforms, {
      uColor: { value: new THREE.Vector3(rgb.r, rgb.g, rgb.b) },
      uWash: { value: new THREE.Vector4(1 / (opts.scale || 1.6), opts.dry == null ? 0.25 : opts.dry, opts.wet == null ? 0.15 : opts.wet, opts.id == null ? 5.0 : opts.id) },
      uFlat: { value: opts.flat ? 1 : 0 }, uFade: { value: 1 },
      uMap: { value: opts.map || null },
      uPointSize: { value: opts.pointSize || 3 },
    }),
    vertexShader: WASH_VERT, fragmentShader: WASH_FRAG,
    side: opts.side == null ? THREE.FrontSide : opts.side,
  });
  m.userData.pcPainted = true;
  return register(m, 'wash', opts);
}

// ------------------------------------------------------------------------------------------
// Figure: the explorer and the ship. One mesh each; its parts (limbs, coat, gear, canopy) are
// moved by a small palette of matrices (attribute aPart), so a whole figure is one draw call.
// The local washes are vertex colours; aMat = (dry brush, wetness, glow: 1 = bare light,
// not modelled by the sun). The wash turbulence is anchored to each part's rest shape, so it
// travels with the limb and never swims.
// ------------------------------------------------------------------------------------------
const FIG_VERT = /* glsl */`
${VERT_PARS}
uniform mat4 uPart[PC_PARTS];
attribute vec3 color;
attribute vec3 aMat;
attribute float aPart;
varying vec3 vObj;
varying vec3 vNO;
varying vec3 vNV;
varying vec3 vView;
varying vec3 vCol;
varying vec3 vMat;
void main() {
  mat4 pm = uPart[int(aPart + 0.5)];
  vec4 mv = modelViewMatrix * (pm * vec4(position, 1.0));
  vNV = normalMatrix * normalize(mat3(pm) * normal);
  vObj = position; vNO = normal; vCol = color; vMat = aMat;
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
  ${VERT_END}
}
`;

const FIG_FRAG = /* glsl */`
${FRAG_PARS}
#ifdef PC_OIL
${PC_UP_F}
#endif
uniform vec4 uFig;    // wash turbulence scale (1/m), pooling inside the silhouette, dry-stroke scale, region id
varying vec3 vObj;
varying vec3 vNO;
varying vec3 vNV;
varying vec3 vView;
varying vec3 vCol;
varying vec3 vMat;
void main() {
  #include <logdepthbuf_fragment>
  vec3 nV = normalize(vNV);
  if (!gl_FrontFacing) nV = -nV;
  #ifdef PC_OIL
    // (the figure stands in the same two lights as the land: the sky's fill on its shaded side, the ground's warm
    // bounce under its chin and its arms -- chunks.js pcUp. It is a small part of the picture and the eye reads it
    // first, so the matrix here is worth it where it would not be on the floor.)
    ${SKYUP('dot(nV, mat3(viewMatrix) * uUpW)')}
  #endif
  vec4 n1 = texture(uNoise3D, vObj * uFig.x);
  vec4 n2 = texture(uNoise3D, vObj * uFig.x * 3.3 + 0.31);
  // the wash: its pigment load drifts, and pools just inside the edge of the form
  float rim = 1.0 - clamp(dot(nV, normalize(-vView)), 0.0, 1.0);
  float d = 1.0 + (n1.r - 0.5) * 0.75 + (n2.g - 0.5) * 0.35 + uFig.y * smoothstep(0.35, 0.95, rim + (n2.b - 0.5) * 0.25);
  // a few long soft strokes down the form: folds in cloth, runs of weather on a hull
  float fold = texture(uNoise3D, vObj * vec3(2.6, 0.22, 2.6) * uFig.x + 0.17).b;
  d += (smoothstep(0.42, 0.62, fold) - 0.45) * 0.55 * (1.0 - max(vMat.z, 0.0));
  vec3 c = pcWetWash(pcDensity(vCol, d), 0.7);
  // light in soft steps that run into each other inside the form; the shadow side is a glaze
  vec3 sunV = normalize((viewMatrix * vec4(uSunDirW, 0.0)).xyz);
  float x = dot(nV, sunV) * 0.5 + 0.5 + (n1.g - 0.5) * 0.20 + (n2.a - 0.5) * 0.08;
  float lvl = pcLevel(x, 0.085);
  vec3 lit = pcTone(c, lvl);
  #ifdef PC_OIL
  {
    // the figure in strokes: thin streaks that run down the cloth and along the limbs (the figure's own up), each a
    // little lighter or darker, warmer or cooler than the next, with nothing drawn between them; fine, because the
    // figure is what the eye reads first. The chart is the figure's own space, laid along whichever side the form faces.
    // (The overhaul plan's eighth piece: the colour under the streaks carries no grain of its own (the wash's drifting
    // pigment made every streak speckled), only the slow folds; a piece marked dry 1 (a strip of the cloak, models.js)
    // is one flat piece of paint with no streaks; and where the form turns from the eye on the sun's side its edge
    // takes the light: a rim.)
    vec3 fox = dFdx(vObj), foy = dFdy(vObj);
    vec3 fna = abs(normalize(vNO));
    vec2 fch, fdx, fdy;
    if (fna.x >= fna.z) { fch = vObj.yz; fdx = fox.yz; fdy = foy.yz; } else { fch = vObj.yx; fdx = fox.yx; fdy = foy.yx; }
    vec2 foc = pcStrokeOct(length(vView) * 0.8, 0.006);
    vec3 fr1, fr2; vec2 fds; float fown;
    pcThinLayer(fch, fdx, fdy, foc.x, 5.0, vObj, 40.0, 2.0, fr1, fds, fown, fr2);
    vec3 co = pcWetWash(pcDensity(vCol, 1.0 + (smoothstep(0.42, 0.62, fold) - 0.45) * 0.30 * (1.0 - max(vMat.z, 0.0))), 0.7);
    float sunF = dot(nV, sunV);
    // (L3, one light: the figure stands in the same shadow as everything else, read at its own place lifted 0.8 m
    // toward the sun so it is not shadowed by itself; its rim is the sun's, so it goes with the sun)
    float sunFg = uLookF.z > 0.5 ? pcSunAtView(vView, 0.8) : 1.0;
    float lvo = (uLookF.z > 0.5 ? pcLit(sunF * 0.5 + 0.5, sunFg, 0.0, 0.05) : pcLevel(sunF * 0.5 + 0.5, 0.05)) + 0.9 * smoothstep(0.50, 0.85, rim) * smoothstep(0.0, 0.5, sunF) * uDayness * sunFg;
    // (the light in flat steps, half a tone each, with clean edges between them: a limb shaded smoothly from light to
    // dark was a rendered cylinder, the one soft gradient on the figure)
    lvo = floor(lvo * 2.0 + 0.5) * 0.5;
    vec3 t1 = pcTone(pcDabTint(co, fr1, 0.0), lvo + (fr1.z - 0.5) * 0.5), t2 = pcTone(pcDabTint(co, fr2, 0.0), lvo + (fr2.z - 0.5) * 0.5);
    lit = vMat.x > 0.985 ? pcTone(co, lvo) : mix(t2, t1, fown);
    // (the lantern's light on the figure itself, by night: the side toward the lantern is warm, in two flat steps)
    if (uLampV.w > 0.01) {
      vec3 toL = uLampV.xyz - vView;
      float dl = length(toL), fl = uLampV.w * (1.0 - smoothstep(0.25, 1.5, dl)) * smoothstep(-0.1, 0.5, dot(nV, toL / max(dl, 1e-3)));
      vec3 warmF = min(pcDensity(vCol, 1.1) * vec3(1.45, 0.92, 0.50) + vec3(0.12, 0.05, 0.0), vec3(1.0));
      lit = fl > 0.55 ? warmF : fl > 0.22 ? mix(lit, warmF, 0.5) : lit;
    }
  }
  #else
  // dry brush: the loaded brush skips on the lit side and paper sparkles through
  vec4 st = pcTri(vObj * uFig.z, normalize(vNO), 0.5);
  float dryM = smoothstep(0.56, 0.70, st.r * 0.8 + st.b * 0.3) * smoothstep(0.45, 0.60, n2.r);
  lit = mix(lit, vec3(1.0), dryM * vMat.x * 0.16 * clamp(lvl - 1.0, 0.0, 1.5));
  #endif
  // (aMat.z: 0..1 a light of its own, a flame or a lantern, not modelled by the sun; below 0: glass that is lit from
  // within when the light goes: a cabin lamp, warm paper with a touch of quinacridone gold, the one warm thing in a night)
  float lampN = max(-vMat.z, 0.0) * (1.0 - uDayness);
  float glowK = max(vMat.z, 0.0);
  c = mix(lit, vCol, glowK);
  vec3 cabin = mix(vec3(1.0, 0.90, 0.62), vec3(1.0, 0.97, 0.84), smoothstep(0.35, 0.75, n1.b + (n2.r - 0.5) * 0.4));
  c = mix(c, cabin, lampN * (0.80 + 0.20 * n1.r));
  float f = pcFogAmount(length(vView));
  c = pcAtmosV(c, f, vView);
  pcWrite(c, max(vMat.y, f * 0.8), nV, -vView.z, max(glowK, lampN) > 0.5 ? 8.0 : uFig.w);
}
`;

// makeFigureMaterial({ parts, scale, pooling, stroke, id }) -> ShaderMaterial; its
// uniforms.uPart.value is an array of `parts` Matrix4 (identity until the model's rig fills it).
export function makeFigureMaterial(opts = {}) {
  const n = Math.max(1, opts.parts | 0 || 1);
  const mats = [];
  for (let i = 0; i < n; i++) mats.push(new THREE.Matrix4());
  const m = new THREE.ShaderMaterial({
    name: 'pc-figure',
    defines: { PC_PARTS: n },
    uniforms: baseUniforms(opts.bodyUniforms, {
      uPart: { value: mats },
      uFig: { value: new THREE.Vector4(1 / (opts.scale || 0.6), opts.pooling == null ? 0.5 : opts.pooling, opts.stroke || 2.0, opts.id == null ? 5.0 : opts.id) },
    }),
    vertexShader: FIG_VERT, fragmentShader: FIG_FRAG,
    side: opts.side == null ? THREE.FrontSide : opts.side,
  });
  m.userData.pcPainted = true;
  return register(m, 'figure', opts);
}

// ------------------------------------------------------------------------------------------
// The near ground: one instanced layer of brush strokes round the eye (src/world/nearground.js):
// grass blades, reed stubble, frost needles, pebbles, drift ripples. Each stroke is a tapering
// flick that faces the picture plane about its own axis, takes the light of the ground it
// stands on, is bent blade by blade by PHYSICS' push field, shrinks away at the end of its
// range (far strokes are fewer) and is never thinner than the brush can hold.
// ------------------------------------------------------------------------------------------
const NEAR_VERT = /* glsl */`
${VERT_PARS}
${FOG_VERT}
${FLORA_GLSL}
uniform float uPhysOn;
attribute vec3 iRoot;   // root relative to uOrigin (body-local metres)
attribute vec4 iAxis;   // xyz the way the stroke grows (unit), w its length (0 = an empty slot)
attribute vec4 iPar;    // x width (m), y kind (under 1.5: a plain stroke, its width at half length; 2 a grass flick, 3 a flick left crisp, 4 a fan-brush touch, 5 a round touch facing the eye, 6 a touch laid flat; +0.25 left crisp), z hash, w born (s)
attribute vec4 iCol;    // wash; a: curl of the tip (share of the length); a round touch: how high it is held (m); a flat one: its turn (radians)
attribute vec2 iExt;    // x canopy shade at the root, y how much it gives to a push (0 rigid .. 1 grass)
uniform vec3 uOrigin;
uniform vec3 uCamLocal;
uniform vec4 uNear;     // x full density out to here (m), y nothing beyond here, z now (s), w one pixel at 1 m (tangent)
uniform vec4 uNear2;    // x, y the ring fades in between these distances (m), z how soft its marks are left
uniform float uNearCut; // (the speed test only, core/bench.js: the share of the marks folded away whole, by number; 0 none)
uniform float uTime;
uniform vec4 uWx;
#ifdef PC_OIL
// (the flora lane, docs/lead/FLORA-DESIGN.md) x 1: a mark the eye cannot see is dropped at once (G1); z 1: the flowers'
// heads are not drawn (the speed test's row; 0 in play); y, w: spare
uniform vec4 uNearK;    // x 1: marks out of view are dropped (G1); y the year now (SEASON.t, the flowers' windows); z 1: no flower heads; w a flower head's least size on screen, a share (0: 1)
uniform vec4 uNearL;    // x 1: the grass package's paint (G4), y how strong the gusts' sheen is, z w the bend (rad) it grows over
varying float vSheen;   // (G4) how far the gust bends this blade away from the eye, as a step of light: 0 none
varying float vTeeth;   // (G3) how many blades a fan-brush touch is cut into, from its size on the screen: 0 as it was
                        // (F2) a flower's head: how many pixels tall it stands on the screen
attribute float iTone;  // (F2) a mark's second colour, packed (world/nearground.js packTone): 0 none
varying vec3 vTone;     // ... unpacked; x < 0: none, the second tone is the mark's own colour, deeper or paler
#endif
varying vec3 vBody;
varying vec3 vNV;
varying vec3 vView;
varying vec3 vCol;
varying vec4 vS;        // x along the stroke 0..1, y across -1..1, z hash, w canopy
varying float vFog;
varying float vFlat;
varying float vAcc;
varying float vLoad;
varying float vKind;
#ifdef PC_OIL
varying vec3 vRootB;   // the stroke's root on the body: the oil look lights a stroke whole, from there
#endif
void main() {
  float t = position.y, side = position.x, h = iPar.z, kind = iPar.y;
  bool flick = kind > 1.5 && kind < 3.5;
  bool broad = kind > 3.5;
  bool fan = broad && kind < 4.5;
  bool lying = kind > 5.5 && kind < 6.5;      // (kinds 7 to 12 are the oil look's flower heads, facing the eye as a round touch)
  bool dab = broad && !fan && !lying;
  vKind = kind;
  vLoad = flick ? 0.4 : (broad ? 0.6 : 1.0);
  vAcc = flick ? kind - 2.0 : (broad ? step(0.1, fract(kind)) : step(fract(h * 13.7), 0.5));
  vec3 root = iRoot;
  vec3 toCam = uCamLocal - root;
  float di = length(toCam);
  // every stroke has its own range (so the sward thins with distance) and grows in after it is laid
  float range = mix(uNear.x, uNear.y, fract(h * 7.31));
  float vis = (1.0 - smoothstep(range * 0.72, range, di)) * smoothstep(0.0, 0.7, uNear.z - iPar.w) * smoothstep(uNear2.x, uNear2.y, di);
  // (the speed test's 'half the near grass': a share of the marks folded to nothing here, before any is rasterised, so
  //  the row prices a mark whole. By PLACE, in half-metre cells of the ground, so that a plant of several marks -- a
  //  stalk, its leaf, its heads, which stand within a few centimetres of one root -- goes whole, but for the rare one
  //  that straddles a cell's edge (the flora lane's ask). At 0, the default, nothing here is worked out at all.)
  if (uNearCut > 0.0) {
    vec3 cq = floor(iRoot * 2.0);
    vis *= step(uNearCut, fract(sin(dot(cq, vec3(12.9898, 78.233, 37.719))) * 43758.5453));
  }
  #ifdef PC_OIL
  // G1, THE MARKS THE EYE CANNOT SEE (2026-11-24, docs/lead/FLORA-DESIGN.md 6.1). A ring is one draw of every mark round
  // the eye, and every mark used to be shaded whole -- the bend field read three times a vertex, the air -- in view or
  // not, in range or not: COUNTED at the autumn landing, two thirds of 23,305 marks lay outside the picture, and a mark
  // past its range was only shrunk to nothing at the end. Here such a mark is sent outside the clip volume before any
  // of that, and its triangles are dropped, in the phone's binning pass too. Nothing that could reach the picture goes:
  // the margin is the mark's own reach (its length, its width twice, the height a round touch is held at, a few pixels
  // for the floor on a far mark's size, and the lean of a bend). A mark with no size (vis 0) drew nothing before either.
  // uNearK.x 0 (the speed test's row, ?nearcull=0, ?grass2=0) is the ring as it was.
  if (uNearK.z > 0.5 && kind > 6.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }   // (the speed test's 'no flower heads')
  // THE YEAR (the flora lane, docs/lead/FLORA-DESIGN.md 5.1, ?bloomyear=0 off): a flower's window on the year rides in
  // iTone's top six bits (world/nearground.js packYear: when it comes into flower and when it is over, in sevenths of
  // SEASON.t, 0 high summer to 1 deep autumn), and uNearK.y is the year now. Out of its window a kind's heads thin out one
  // by one (each head by its own hash) and shrink before they go, over a seventh of the year, so nothing pops; a cushion
  // keeps its leaves and its flowers go back into them. A mark with no window (every blade, stalk and leaf) is untouched.
  float tn = iTone, yrF = 1.0, yrS = 1.0;
  if (iTone > 262143.5) {
    float yw = floor(iTone / 262144.0);
    tn = iTone - yw * 262144.0;
    float ya = floor(yw / 8.0) / 7.0, yb = 1.0 - mod(yw, 8.0) / 7.0;
    yrF = smoothstep(ya - 0.143, ya, uNearK.y) * (1.0 - smoothstep(yb, yb + 0.143, uNearK.y));
    if (kind < 11.5) {
      float yq = fract(h * 5.37);
      if (yq >= yrF) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
      yrS = mix(0.45, 1.0, smoothstep(0.0, 0.18, yrF - yq));
    }
  }
  if (uNearK.x > 0.5) {
    vec4 rv = modelViewMatrix * vec4(root, 1.0);
    float ext = iAxis.w * 1.2 + 2.0 * iPar.x + (dab ? iCol.a : 0.0) + 0.3 + uNear.w * di * 4.0;
    vec4 rc = projectionMatrix * rv;
    float kx = ext * sqrt(projectionMatrix[0][0] * projectionMatrix[0][0] + 1.0);
    float ky = ext * sqrt(projectionMatrix[1][1] * projectionMatrix[1][1] + 1.0);
    if (vis <= 0.0 || rv.z > ext || abs(rc.x) - rc.w > kx || abs(rc.y) - rc.w > ky) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  }
  #endif
  float flex = iExt.y;
  // fresh snow buries what is short: no stroke stands on a snowfield but the tall stubble
  float snowK = 1.0 - smoothstep(0.12, 0.50, uWx.z) * (1.0 - 0.30 * smoothstep(0.62, 0.95, iAxis.w));
  if (broad) vis *= kind > 4.5 ? step(0.5, snowK) * snowK : snowK;        // (what lies on the ground is under the snow altogether)
  float len = iAxis.w * vis * (broad ? 1.0 : snowK);
  vec3 ax = iAxis.xyz;
  vec3 up = normalize(root + uOrigin);
  // what has pushed through here: a blade leans with the load, and where it was trodden or
  // blown flat it lies over the way it already leaned, and stays down for a while
  vec4 pb = vec4(0.0);
  if (flex > 0.01 && uPhysOn > 0.5) {
    pb = pcPhysBend(root + uOrigin, 0.0);
    float fl = clamp(pb.z, 0.0, 1.0) * flex;
    vec3 axh = ax - up * dot(ax, up);
    ax = normalize(mix(ax, axh / max(length(axh), 0.05) + up * 0.16, fl * 0.92));
    vFlat = fl;
  } else vFlat = 0.0;
  #ifdef PC_OIL
  vTeeth = 0.0;
  if (tn > 0.5) { float pk = tn - 1.0; vTone = vec3(floor(pk / 4096.0), mod(floor(pk / 64.0), 64.0), mod(pk, 64.0)) / 63.0; }
  else vTone = vec3(-1.0);
  if (kind > 11.5 && yrF < 1.0 && vTone.x >= 0.0) vTone = mix(iCol.rgb, vTone, yrF);
  // (G4, THE GUSTS' SHEEN, 2026-11-24) PHYSICS' bend carries the wind's travelling waves (physics/flora.glsl.js: the gust
  // and the wave train in pcPhysBend), so where a gust presses the sward the blades lean over together and, leaning away
  // from the eye, show their lit backs: bands of paler grass sweep across a meadow as the gusts pass. Asked at the root,
  // so a blade is lit WHOLE as everything in the look is.
  vSheen = 0.0;
  if (uNearL.y > 0.0 && flex > 0.01 && uPhysOn > 0.5) {
    vec3 bd = uPhysEast * pb.x + uPhysNorth * pb.y;
    float ba = length(bd);
    vec3 th = toCam - up * dot(toCam, up);
    float away = ba > 1e-4 ? -dot(bd / ba, th / max(length(th), 1e-3)) : 0.0;
    vSheen = uNearL.y * smoothstep(uNearL.z, uNearL.w, ba) * (0.35 + 0.65 * away);
  }
  #endif
  vec3 sd = cross(ax, toCam / max(di, 0.001));
  sd /= max(length(sd), 0.05);
  float wPx = uNear.w * di;                                       // metres across one pixel here
  vec3 rel;
  float grow = min(1.0, vis * 3.0);
  if (broad) {
    t = min(1.0, t * 2.0);                                        // (the whole quad; the tip triangle closes to nothing)
    if (lying) {
      // laid on the ground's own plane, turned as it fell
      vec3 t1 = normalize(cross(ax, vec3(0.3126, 0.8271, 0.4671)));
      vec3 t2 = cross(ax, t1);
      vec3 da = t1 * cos(iCol.a) + t2 * sin(iCol.a), db = cross(ax, da);
      rel = da * (max(len, wPx * 1.2 * grow) * (t * 2.0 - 1.0)) + db * (side * max(iPar.x, wPx * 0.9) * grow);
    } else if (dab) {
      float dl = len, dw = iPar.x;
      #ifdef PC_OIL
      // (a flower's head never shrinks under a few pixels across, so a poppy six metres off still reads as a poppy and
      // not a speck -- the coordinator on the level meadow, 24 Nov: the old flowers were bold dabs, the new heads 3-6 px.
      // The whole head grows, its shape kept: half-width 2.6 px for a daisy, cup or poppy, 2.0 for a bell (they hang
      // several to a stalk), 1.4 for a spike or froth, which are tall already. Only the oil look's heads, kinds 7-12.)
      if (kind > 6.5) {
        float hf = (kind > 9.5 && kind < 11.5 ? 1.4 : (kind > 8.5 && kind < 9.5 ? 2.0 : 2.6)) * (uNearK.w > 0.0 ? uNearK.w : 1.0);
        float fk = max(1.0, wPx * hf * grow / max(dw, 1e-5));
        dl *= fk * yrS; dw *= fk * yrS;     // (yrS: a head about to go out of flower shrinks first, the year above)
      }
      // (audit 2, nearground.js PATCH: a drift's patch in the middle and far rings comes in only past 11-16 m, where the
      // near ring's flowers end; nearer than that it would be a blob of colour over the flowers themselves)
      if (kind > 5.35 && kind < 5.45) {
        float pk = smoothstep(11.0, 16.0, di) * yrS;
        if (pk < 0.02) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
        dl *= pk; dw *= pk;
        vTeeth = max(dw, wPx * 1.3) / max(wPx, 1e-5);      // (its half-width in pixels: the poppy's centre below)
      }
      #endif
      rel = ax * (iCol.a * (len / max(iAxis.w, 1e-4)) + max(dl, wPx * 1.3 * grow) * t) + sd * (side * max(dw, wPx * 1.3) * grow);
      #ifdef PC_OIL
      if (kind > 6.5) vTeeth = max(dl, wPx * 1.3) / max(wPx, 1e-5);
      #endif
    } else {
      // a fan-brush touch: broad at the foot, spreading a little, its top cut into blades by the fragment shader
      float wk = 1.0;
      #ifdef PC_OIL
      // (G3, THE MIDDLE BAND, 2026-11-24, docs/lead/FLORA-DESIGN.md 6.3, ?grass2=0 off) A touch was cut into five to ten
      // blades whatever its size, so at 20 m (5.6 cm a pixel) a 20 cm touch had blades under a pixel wide: the yellow
      // speckle of the stills from 10 m. Now it is cut into as many as leave each blade about two pixels, never under
      // two; and since the ring thins past 25 m (nearground.js: each touch's own range), a touch grows a little as the
      // ring thins, up to 1.4 times by 40 m, so the band keeps its cover with fewer, larger touches.
      if (uNearL.x > 0.5) {
        wk = mix(1.0, 1.4, smoothstep(15.0, 40.0, di));
        vTeeth = clamp(floor(2.4 * iPar.x * wk / max(wPx * 2.2, 1e-5)), 2.0, 9.0);
      }
      #endif
      rel = ax * (len * t) + sd * (side * iPar.x * wk * (1.0 + 0.4 * t) * grow + iCol.a * len * t * t);
    }
  } else {
    // (close to the eye a blade is as slender as a blade is; farther off it is as broad as the brush must be)
    // (a flick is narrow where the brush touched down, full a third of the way up, and runs out
    // to a point: a lancet, not a tooth)
    float prof = flick ? (t < 0.25 ? 0.40 : (t < 0.75 ? 1.0 : 0.0)) : (t < 0.25 ? 1.0 : (t < 0.75 ? iPar.y : 0.0));
    float wid = max(iPar.x * mix(0.42, 1.0, smoothstep(2.0, 7.5, di)), wPx * (flick ? 1.7 : 2.3)) * prof * (1.0 + 0.25 * vFlat);
    if (flick && t > 0.25 && t < 0.75) t = 0.34;
    rel = ax * (len * t) + sd * (side * wid * grow + iCol.a * len * t * t);
  }
  if (flex > 0.01 && len > 0.0 && !lying) {
    if (uPhysOn > 0.5) {
      rel = mix(rel, pcPhysDisplace(rel, up, max(iAxis.w + (dab ? iCol.a : 0.0), 0.05), pb.xy * (1.0 - vFlat)), flex);
    } else {
      float tt = dab ? 1.0 : t;
      rel += sd * (sin(uTime * 1.3 + h * 40.0) * 0.05 * (dab ? iCol.a : len) * tt * tt * flex);
    }
  }
  vec3 wp = root + rel;
  vBody = wp + uOrigin;
  vNV = normalMatrix * normalize(mix(up, ax, 0.35));
  vec4 mv = modelViewMatrix * vec4(wp, 1.0);
  vView = mv.xyz;
  vCol = iCol.rgb; vS = vec4(t, side, h, iExt.x);
  #ifdef PC_OIL
    vRootB = root + uOrigin;
  #endif
  vFog = pcFogAmountV(di * pcFogBank(vBody));      // (PAINTER 19: a thick fog lies in banks)
  gl_Position = projectionMatrix * mv;
  ${VERT_END}
}
`;

const NEAR_FRAG = /* glsl */`
${FRAG_PARS}
uniform vec4 uNear2;
varying vec3 vBody;
varying vec3 vNV;
varying vec3 vView;
varying vec3 vCol;
varying vec4 vS;
varying float vFog;
varying float vFlat;
varying float vAcc;
varying float vLoad;
varying float vKind;
#ifdef PC_OIL
varying vec3 vRootB;
uniform vec4 uNearL;
varying float vSheen;
varying float vTeeth;
varying vec3 vTone;
${PC_UP_F}
#endif
#ifdef PC_FIRE
${FIRE_GLOW}
#endif
void main() {
  #include <logdepthbuf_fragment>
  pcFp = pcFootprint(vBody);      // (R1 W2.1, chunks.js)
  #ifdef PC_OIL
    // THE OIL LOOK'S SWARD (the owner's references of 2026-11-16: the wood's floor is GRASS, fine upright strokes, deep
    // green in the shade and bright yellow-green where the sun lies, with flowers and fallen leaves as small dabs).
    // The near ground's strokes stand on the world as they do in the watercolour (nearground.js); here each is ONE flat
    // piece of paint with a clean edge: a blade a lancet, a tuft a comb of blades, a flower's head a round touch, a
    // fallen leaf a pointed oval; in the sun or in the shade WHOLE (the light is asked at its root), and a share of
    // the blades a step lighter toward the tip, where the light catches them. Nothing broken, nothing dry-brushed.
    // (uOilG.x: the share of the strokes laid, by each one's number; uGroundK.y: a world's own share)
    if (fract(vS.z * 13.37 + 0.11) > uOilG.x * uGroundK.y) discard;
    {
      vec3 r3o = vec3(vS.z, fract(vS.z * 13.7), fract(vS.z * 5.1));
      bool second = false;
      if (vKind > 6.5) {
        // (F2, THE FLOWERS' HEADS, 2026-11-24, docs/lead/FLORA-DESIGN.md 7.2; world/bloom.js, nearground.js layBlooms.) Each
        // cut from one quad that faces the eye, as the round touch is: a clean flat piece, no outline, and at most two
        // flat colours -- its own and a second (the eye, the light in a cup, the shadow of a bell's mouth, a cushion's
        // flowers), the second set as data (vTone) or the mark's own colour deeper or paler, never a hue of the shader's
        // (LOOK-RULES R2.1). Lit WHOLE at its root like every near mark. Fine detail -- petals, scallops, florets -- is cut
        // only where the head is big enough on the screen for each piece to be about two pixels (vTeeth: its height in
        // pixels), so nothing finer than a pixel is ever drawn (R4.5); smaller, a head is its plain shape in its two tones.
        vec2 q = vec2(vS.y, vS.x * 2.0 - 1.0);
        float px = vTeeth, rq = length(q);
        if (vKind < 7.5) {                          // rayed: petals round an eye (daisy, aster, campion)
          if (rq > 0.96) discard;
          float np = floor(clamp(px * 1.1, 0.0, 12.0));
          if (np >= 5.0) {
            float pa = fract(atan(q.y, q.x) / 6.2832 * np + vS.z * 7.0);
            if (rq > 0.40 && abs(pa - 0.5) * 2.0 > 1.0 - 0.75 * (rq - 0.40)) discard;
          }
          second = rq < (px < 5.0 ? 0.45 : 0.36);
        } else if (vKind < 8.5) {                   // cup: a round head, the light in the cup a step paler (buttercup, gentian, poppy)
          if (rq > 0.95) discard;
          if (px > 7.0 && rq > 0.80 && abs(fract(atan(q.y, q.x) / 6.2832 * 5.0 + vS.z * 3.0) - 0.5) > 0.38) discard;
          second = q.y > 0.15 - 0.15 * q.x * q.x;
        } else if (vKind < 9.5) {                   // bell: a hanging cup from the side, its mouth in shadow (harebell, bluebell)
          float bw = 0.55 + 0.32 * smoothstep(0.3, -0.9, q.y);
          if (abs(q.x) > bw || q.y > 0.82 - 0.40 * q.x * q.x || q.y < -0.94) discard;
          if (px > 7.0 && q.y < -0.72 && abs(fract(q.x * 1.6 + 0.5) - 0.5) < 0.16) discard;
          second = q.y < -0.60;
        } else if (vKind < 10.5) {                  // spike: florets stacked up the stem, smaller to the top (foxglove, loosestrife)
          float nf = clamp(floor(px / 3.0), 3.0, 9.0);
          float yy = (q.y + 1.0) * 0.5 * nf, cl = floor(yy), fy = fract(yy) - 0.5;
          float sx = mod(cl, 2.0) < 1.0 ? -0.22 : 0.22;
          if (length(vec2((q.x - sx) * 0.75, fy)) > 0.48 * (1.0 - 0.5 * cl / nf)) discard;
          second = cl > nf - 1.5;
        } else if (vKind < 11.5) {                  // froth: a loose head of small dabs (meadowsweet, cotton grass)
          float nd = clamp(floor(px / 2.5), 1.0, 7.0);
          bool hit = nd < 1.5 && rq < 0.9;
          for (int k = 0; k < 7; k++) {
            if (float(k) >= nd) break;
            vec2 cc = vec2(fract(sin(float(k) * 12.9898 + vS.z * 78.233) * 43758.5), fract(sin(float(k) * 39.346 + vS.z * 11.135) * 24634.6)) * 1.2 - 0.6;
            if (length(q - cc) < 0.40) hit = true;
          }
          if (!hit) discard;
        } else {                                    // cushion: a low dome of leaves, its flowers on top (thrift, alpine pink)
          float topY = -1.0 + 1.75 * sqrt(max(0.0, 1.0 - q.x * q.x));
          if (q.y > topY) discard;
          second = q.y > topY - 0.42;
          if (second && px > 10.0 && abs(fract(q.x * 2.2 + vS.z * 5.0) - 0.5) > 0.36) second = false;
        }
      } else if (vKind > 4.5) {
        vec2 q = vec2(vS.y, vS.x * 2.0 - 1.0);
        if (vKind > 5.5 ? abs(q.x) > (1.0 - q.y * q.y) * 0.92 : dot(q, q) > 0.94) discard;
        // (a drift's patch, nearground.js PATCH: on a touch over about 6 px across, one dot of the flower's second colour at
        // its heart, about 1.3 px, so a far red touch reads as a poppy and a violet one as an aster -- the look director,
        // 24 Nov; smaller, the touch is its one colour, nothing under a pixel and a half is drawn, R4.5)
        if (vKind > 5.35 && vKind < 5.45 && vTeeth > 3.0) second = length(vec2(q.x, q.y * 0.85) * vTeeth) < 1.3;
      } else if (vKind > 3.5) {
        float u = vS.y * 0.5 + 0.5, hz = vS.z;
        float nb = 5.0 + floor(fract(hz * 5.37) * 5.0);
        if (vTeeth > 0.5) nb = min(nb, vTeeth);      // (G3: never a blade under two pixels)
        float b1 = u * nb + hz * 7.0 + 0.4 * sin(u * 9.0 + hz * 30.0), b2 = u * nb * 0.37 + hz * 3.0;
        float h1 = 0.30 + 0.70 * fract(sin(floor(b1) * 12.9898 + hz * 78.233) * 43758.5453);
        float h2 = 0.55 + 0.45 * fract(sin(floor(b2) * 39.3468 + hz * 11.135) * 24634.6345);
        // (a tuft is its blades, each a lancet from the foot to its own height, lower at the tuft's sides, with a little
        // air between them: laid as one body with a notched top, a tuft in flat paint was a notched slab on the floor)
        float hi = (0.34 + 0.66 * h1 * h2) * (1.0 - 0.5 * vS.y * vS.y);
        if (vS.x > hi || abs(fract(b1) - 0.5) > 0.43 * pow(max(1.0 - vS.x / hi, 0.0), 0.6)) discard;
        r3o = fract(r3o + h1 * vec3(0.37, 0.61, 0.83));      // (each blade of the tuft its own number: its own tone)
      }
      vec3 nVo = normalize(vNV);
      // (the speed test's 'near grass one flat colour', shared.js uOilL.y 8: every mark keeps its shape, its light and
      //  paint are not worked out -- the gap to 'as set' is what the sward's paint costs a pixel)
      if (uOilL.y > 7.5 && uOilL.y < 8.5) { pcWrite(vCol, 0.0, nVo, -vView.z, 4.0 + vS.z * 0.9); return; }
      // (a blade, a pebble, a frost needle faces the sky its own way: chunks.js pcUp, as the ground under it does.
      // A blade stands up, so it sees about half the sky and takes the ground's warm bounce on its side; the floor
      // it stands on faces the sky whole. That is the difference this term is for.)
      ${SKYUP('dot(nVo, mat3(viewMatrix) * uUpW)')}
      vec3 sunVo = normalize((viewMatrix * vec4(uSunDirW, 0.0)).xyz);
      float xo = dot(nVo, sunVo) * 0.5 + 0.5;
      float sunO = min(pcSunAt(vRootB, vS.w * 0.8, 8.0, 0.3), 1.0 - pcCast(vRootB, (r3o.x - 0.5) * 0.3));
      float lv = pcLevel(mix(min(xo, 0.44) - 0.10 * vS.w, xo + (r3o.z - 0.5) * 0.12, sunO), 0.03);
      // (a third of the strokes a step deeper, and a blade's upper part a step lighter in the sun: a sward all of one
      // tone is a flat patch)
      lv -= step(0.66, fract(r3o.x * 11.1)) * 0.6 * step(1.5, lv);
      if (vKind < 4.5 && vS.x > 0.42 + 0.3 * r3o.y) lv += 0.8 * sunO;
      // (G4, the flora lane, ?grass2=0 off: the gusts' sheen lifts the blades they lean away from the eye, WHOLE, asked at
      // the root. A step deeper at a blade's root was tried and taken out: LOOK-RULES R3.1, a stroke is one flat colour.
      // The sward's dark roots are the ground's paint under it instead: world/bloom.js bloomTint.)
      if (uNearL.x > 0.5 && vKind > 1.5 && vKind < 3.5) lv += 0.7 * vSheen;
      // (a stroke's wash is never darker than a middle one: the watercolour's deep washes, laid as flat paint in the
      // shade, were black thorns all over the wood's floor; in the shade a blade is a deep green)
      vec3 kc = vCol;
      if (second) kc = vTone.x >= 0.0 ? vTone : pcDensity(vCol, vKind > 7.5 && vKind < 8.5 ? 0.72 : 1.45);
      float kl = dot(kc, vec3(0.3, 0.5, 0.2));
      kc = mix(kc, kc * (0.52 / max(kl, 0.08)), smoothstep(0.52, 0.30, kl) * 0.85);
      vec3 ko = pcDabTint(pcDensity(kc, 1.0 + (r3o.x - 0.5) * 0.25), r3o, 0.0);
      ko = mix(ko, vec3(1.0), uWx.z * smoothstep(0.35, 0.9, vS.x) * 0.8);
      // (in the shade a stroke is its own colour laid heavier with half the cool key over it, as a leaf's is: the key
      // whole made the grass of a shaded bank a violet brown)
      vec3 deepO = pcShadeLeaf(ko);      // (L2: the one foliage shade, chunks.js)
      vec3 co = pcLamp(mix(deepO, pcTone(ko, lv), smoothstep(1.2, 2.0, lv)), ko, vRootB, r3o.y);
      #ifdef PC_FIRE
        // (the powers, fire: the grass at the foot of a fire is lit by it, blade by blade, and the blades standing
        //  in the flames are embers: asked at the stroke's root, which is where its light is asked anyway)
        co = pcFireLit(co, ko, vRootB, r3o.y);
      #endif
      co = pcAtmosV(co, vFog, vView);
      pcWrite(co, 0.0, nVo, -vView.z, 4.0 + vS.z * 0.9);
      return;
    }
  #endif
  vec4 n1 = texture(uNoise3D, vBody / 2.9 + 0.11);
  // the loaded brush: pigment pools where the stroke starts, the tip is drier and breaks
  vec4 n2 = texture(uNoise3D, vBody * vec3(7.0, 2.0, 7.0) + vS.z * 3.0);
  if (vKind > 4.5) {
    // a round touch: the brush pressed down once, its edge a little ragged
    // (seen close it must not be a disc: the outline is lobed by the hairs of the brush, each touch its own way,
    // and toward the edge the brush has run dry and the paper shows in flecks)
    vec2 q = vec2(vS.y, vS.x * 2.0 - 1.0);
    float qa = atan(q.y, abs(q.x) + abs(q.y) > 0.0 ? q.x : 1.0), qs = vS.z * 6.283, qr = dot(q, q);
    float lim = 0.64 + 0.17 * sin(qa * 3.0 + qs) + 0.11 * sin(qa * 5.0 - qs * 1.7) + 0.08 * sin(qa * 8.0 + qs * 2.3) + 0.24 * n2.g;
    if (qr > lim) discard;
    if (qr > lim * 0.40 && texture(uNoise3D, vec3(q * 2.1, vS.z * 7.0)).r > 0.86 - 0.34 * (qr / lim)) discard;
  } else {
    if (vKind > 3.5) {
      // a fan brush: a handful of blades of unequal height from one foot, lower at the sides
      // (two combs of different pitch, so no two touches are cut alike and none is a crown)
      float u = vS.y * 0.5 + 0.5, hz = vS.z;
      float nb = 5.0 + floor(fract(hz * 5.37) * 5.0);
      float b1 = u * nb + hz * 7.0 + 0.4 * sin(u * 9.0 + hz * 30.0), b2 = u * nb * 0.37 + hz * 3.0;
      float h1 = 0.30 + 0.70 * fract(sin(floor(b1) * 12.9898 + hz * 78.233) * 43758.5453);
      float h2 = 0.55 + 0.45 * fract(sin(floor(b2) * 39.3468 + hz * 11.135) * 24634.6345);
      // (the lower part is one body of wash; only its top is broken into blades)
      float blades = h1 * h2 * pow(max(1.0 - abs(fract(b1 + (n2.b - 0.5) * 0.8) - 0.5) * 2.0, 0.0), 0.45);
      float top = mix(0.40, 1.0, blades) * (1.0 - 0.66 * vS.y * vS.y) + (n2.g - 0.5) * 0.22;
      if (vS.x > top) discard;
    }
    if (vS.x > 0.5 && n2.r > 1.18 - vS.x * 0.62) discard;
  }
  // (a flick carries little more pigment than the ground it stands on: a loaded, crisp, wet
  // mark pooled by the sheet as well was a black comma)
  float d = 1.0 + (0.55 - vS.x) * (vKind > 4.5 && vKind < 5.5 ? 1.5 : 0.7) * vLoad + (vS.z - 0.5) * 0.5 * vLoad + (n1.r - 0.5) * 0.5;
  vec3 c = pcWetWash(pcDensity(vCol, d), mix(1.0, 0.4, 1.0 - vLoad));
  c = mix(c, vec3(1.0), max(uWx.z * smoothstep(0.35, 0.9, vS.x) * 0.8, vFlat * 0.16));     // snow on the tips; trodden grass shows its pale side
  vec3 nV = normalize(vNV);
  vec3 sunV = normalize((viewMatrix * vec4(uSunDirW, 0.0)).xyz);
  float x = dot(nV, sunV) * 0.5 + 0.5;
  float sunny = min(pcDapple(vBody, vS.w), 1.0 - pcCast(vBody, (n1.g - 0.5) * 0.3));
  x = mix(min(x, 0.44), x, sunny) + (n1.g - 0.5) * 0.10;
  float lvl = pcLevel(x, 0.05);
  c = pcTone(c, lvl);
  #ifndef PC_OIL
  c = mix(c, c * vec3(0.84, 0.83, 1.04), (1.0 - sunny) * 0.55);
  #endif
  c = pcAtmosV(c, vFog, vView);
  // the accents are left as the brush drew them; the rest belong to the ground's wash, and
  // the farther rings' touches are softer still
  pcWrite(c, max(max(vAcc > 0.5 ? 0.2 : 0.45, uNear2.z), vFog * 0.9), nV, -vView.z, (vAcc > 0.5 ? 6.0 : 4.0) + vS.z * 0.9);
}
`;

export function makeNearMaterial(bodyU) {
  const m = new THREE.ShaderMaterial({
    name: 'pc-near',
    uniforms: baseUniforms(bodyU, Object.assign({
      uOrigin: { value: new THREE.Vector3() }, uCamLocal: { value: new THREE.Vector3() },
      uNear: { value: new THREE.Vector4(5, 13, 0, 0.002) }, uNear2: { value: new THREE.Vector4(0.8, 2.6, 0, 0) },
      // (the flora lane: nearground.js FLORA sets them; 0 is each package off, the ring as it was. Read only in the oil look)
      uNearK: { value: new THREE.Vector4(0, 0, 0, 0) }, uNearL: { value: new THREE.Vector4(0, 0, 0, 0) },
      uNearCut: { value: 0 },
    }, PHYS)),
    vertexShader: NEAR_VERT, fragmentShader: NEAR_FRAG,
    side: THREE.DoubleSide,
  });
  m.userData.pcPainted = true;
  // (the powers, fire: the near strokes -- the grass and the fallen leaves at the feet -- are lit by a fire beside
  //  them, as the ground under them is. They have no scorch of their own: what is burnt is the ground's to paint.)
  addFire(m, false);
  return register(m, 'near');
}

// Re-point a material's light uniforms at a body's (so an object standing on a planet is lit
// and hazed like the planet around it).
export function bindBodyUniforms(material, bodyU) {
  if (!material || !material.uniforms || !bodyU) return;
  for (const k of Object.keys(bodyU)) if (material.uniforms[k]) material.uniforms[k] = bodyU[k];
  material.uniformsNeedUpdate = true;
}

// ------------------------------------------------------------------------------------------
// Stand-ins for foreign materials (COORDINATOR C9)
// ------------------------------------------------------------------------------------------
const standIns = new WeakMap();
export function standInFor(object, material) {
  let s = standIns.get(material);
  if (s) return s;
  const color = material.color ? material.color : new THREE.Color(0xb9b3a8);
  const c = color.clone();
  if (material.transparent && material.opacity < 1) c.lerp(new THREE.Color(1, 1, 1), 1 - material.opacity);
  const o = { color: c, side: material.side, vertexColors: !!material.vertexColors && !!(object.geometry && object.geometry.attributes.color) };
  if (object.isPoints) { o.points = true; o.pointSize = Math.max(2, (material.size || 1) * 2); }
  else if (object.isLine) o.unlit = true;
  else if (object.isSprite) { o.sprite = true; o.side = THREE.DoubleSide; if (material.map) o.map = material.map; }
  else if (!object.geometry || !object.geometry.attributes.normal) o.unlit = true;
  if (material.isMeshBasicMaterial) o.flat = true;
  s = makeWashMaterial(o);
  standIns.set(material, s);
  return s;
}

// (the far impostors, render/impostor.js, take the plants' own air, the sky-facing line and the pcUp stand-in from here)
export { FOG_VERT, SKYUP, PC_UP_F, FARCROWN };
