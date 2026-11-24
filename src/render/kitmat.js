// Painted Cosmos: the painter's materials for PHYSICS' draw kits (rain, snow, dust, sand, ash,
// spores, leaves, spray, hail, splash rings, prints). OWNER: PAINTER.
// PHYSICS decides where every particle and mark is (src/physics/three/, one vertex chunk per
// kind giving pcKitPosition() and three varyings); how each is drawn is decided here.
//   rain    a few broad slanted strokes of the sky's own wet wash (they bleed in the post pass)
//   snow    flecks of bare paper with a ragged edge
//   dust, sand, ash   ragged dry-brush drifts in the ink of the ground they were raised from
//   prints, pads, scour   the ground's own wash laid darker, a paler rim on loose ground
//   rings   crisp broken circles (region 6: the post pass keeps its hands off them)
//   leaves  a thin tumbling lens; with the powers on, the same crowd also carries the explorer's
//           strokes of air and A FIRE'S FLAME, SMOKE AND EMBERS (see SHAPES.fire, far below)
import * as THREE from 'three';
import { makePaintUniforms } from './materials.js';
import { G } from './shared.js';
import { VERT_PARS, VERT_END, FRAG_PARS } from './chunks.js';
// (group D, ?rainlook=1 or ?wx2=1, physics/wx2.js; read from the address here and not imported, so this shared file
//  never needs the weather's modules: the look director's contract for the storms' hook. The look director's review of
//  W3.3: a downpour's streaks were laid near paper white; with the switch they are laid at the sky's own pale value,
//  never over V 0.85, so in front of dark trees they read as rain and not as scratches.)
const RAINLOOK = (() => {
  if (typeof location === 'undefined' || !location) return 0;
  const q = new URLSearchParams(location.search || ''), on = (k) => q.has(k) && q.get(k) !== '0' && q.get(k) !== 'false';
  if (q.has('rainlook')) return on('rainlook') ? 1 : 0;
  if (q.get('weather') === 'old') return 0;
  return q.has('wx2') ? (on('wx2') ? 1 : 0) : (q.get('look') === 'oil' ? 1 : 0);   // (the new weather is the oil look's default: physics/wx2.js)
})();

// what a kind is drawn with when it did not come from the ground (updated by the world: rain
// takes the sky's wash, spray the liquid's)
export const KIT_INK = {
  rain: new THREE.Vector3(0.74, 0.79, 0.86), hail: new THREE.Vector3(0.94, 0.95, 0.96), spray: new THREE.Vector3(0.90, 0.93, 0.95),
  snow: new THREE.Vector3(0.985, 0.985, 0.98), dust: new THREE.Vector3(0.78, 0.66, 0.50), sand: new THREE.Vector3(0.84, 0.72, 0.52),
  ash: new THREE.Vector3(0.52, 0.50, 0.50), spores: new THREE.Vector3(0.78, 0.82, 0.50), leaves: new THREE.Vector3(0.80, 0.42, 0.24),
  ring: new THREE.Vector3(0.90, 0.93, 0.96), mark: new THREE.Vector3(0.56, 0.47, 0.40),
};
// the ink of each ground material (index = PHYSICS' MATERIAL_IDS), blended over the biomes
// under the camera by the world every frame
export const KIT_PALETTE = [];
for (let i = 0; i < 16; i++) KIT_PALETTE.push(new THREE.Vector3(0.72, 0.64, 0.52));
// (the powers, fire) THE SEVENTEENTH SLOT IS THE EMBERS', and it is the one slot the world does not blend.
// The world mixes the first sixteen over the biomes under the camera every frame (world/index.js kitInks counts to
// sixteen, the number of things the ground is made of plus the flame's); this one is set here, once, because a fire
// is the same fire on every world. A spark must be told from a flame tongue SOMEHOW, and nothing else about a grain
// can tell them apart: both are thrown out of the same patch, both are grains of the leaf kind, and the painter is
// given a grain's ink and nothing else -- not its size, not its speed, not its age. So the embers are given an ink
// of their own. (The physics must hand it over: until it does, an ember carries the flame's ink and is painted as a
// tongue. The one-line change is in this session's report.)
KIT_PALETTE.push(new THREE.Vector3(1.0, 0.96, 0.80));

// The palette of one biome: 16 washes, by PHYSICS' material names. `pal` is the biome's
// prepared ground washes (surface.pal: low, mid, high), `liquid` its liquid colour if any.
// (the powers, fire) 'flame' is the sixteenth slot: the ground is made of fifteen things and the spare one is the
// flame's own ink (physics/loose.js I_FLAME). The embers have the seventeenth, which this blend does not reach (see
// KIT_PALETTE above). Both are the same in every biome, so the world's blend across the biomes under the camera
// leaves them alone.
const MATS = ['grass', 'soil', 'litter', 'mud', 'sand', 'dust', 'gravel', 'rock', 'snow', 'ice', 'ash', 'glass', 'crystal', 'moss', 'bed', 'flame'];
// (the powers, fire) The three inks a fire's grains carry, by their place in the table above: the flame's own slot,
// the embers' slot after the end of it (the paragraph at KIT_PALETTE says why they need one), and the ash the smoke
// borrows -- in the crowd of leaves nothing but a fire's smoke ever carries the ash ink.
const I_FLAME = MATS.indexOf('flame'), I_EMBER = MATS.length, I_SMOKE = MATS.indexOf('ash');
// ... and the world hands those two on to PHYSICS' ribbon maker (three/expand.js D.fireMat / D.smokeMat), so that a
// tongue and a puff of smoke are laid WIDER than a strand of air. See world/index.js draw.leaves.
export const FIRE_MATS = Object.freeze({ flame: I_FLAME, ember: I_EMBER, smoke: I_SMOKE });
const INK_SLOTS = I_EMBER + 1;
const mx = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export function biomeInks(pal, liquid) {
  const earth = mx(pal.mid, pal.high, 0.45), stone = mx(pal.high, [0.78, 0.78, 0.82], 0.35), paper = [0.975, 0.98, 0.985];
  const of = {
    grass: pal.low, moss: mx(pal.low, pal.high, 0.3), soil: earth, litter: mx(pal.mid, pal.high, 0.25),
    mud: mx(earth, [0.34, 0.29, 0.28], 0.4), sand: mx(pal.mid, [1, 1, 1], 0.18), dust: mx(pal.mid, [1, 1, 1], 0.12),
    gravel: stone, rock: stone, glass: mx(stone, [0.40, 0.42, 0.52], 0.4), crystal: mx(stone, [1, 1, 1], 0.3),
    snow: paper, ice: mx(paper, [0.84, 0.90, 0.96], 0.5), ash: mx(earth, [0.50, 0.49, 0.50], 0.65),
    bed: liquid ? mx(liquid, [1, 1, 1], 0.45) : mx(earth, [0.34, 0.29, 0.28], 0.4),
    // (the powers, fire) THE FLAME'S BODY COLOUR, the one paint a fire's whole ramp is mixed from (SHAPES.fire takes
    // the root's red-brown and the tip's red off this orange, and the white-hot heart off the embers' slot above). It
    // is the same in every biome, so the world's blend across the biomes under the camera leaves it as it is. Change
    // the fire's hue here and the root, the body and the tip all move together.
    flame: [1.0, 0.49, 0.09],
  };
  const out = [];
  for (let i = 0; i < 16; i++) out.push(of[MATS[i]] || earth);
  return out;
}

// one line of GLSL a shape: cuts the hole (discard), sets vec3 c (the wash), float w (wetness)
// and float lv (light level for pcTone: 2 local colour)
const SHAPES = {
  // rain: a broad stroke, full at the head and thinning to its tail, laid wet
  // (nothing right in front of the lens: a drop a metre away would be a stick across the sheet)
  // (a glaze: see GLAZE below; `ga` is how much of the stroke's wash is laid over what is behind it)
  // (PAINTER 16, the M4 critiques: the heaviest rain could not be seen against the land: a stroke in one middle wash is lost
  // on every middle value. A stroke of rain is a mark LIFTED out of a dark passage with a damp brush, pale against the wood
  // and the wet meadow, and the sky's wet wash drawn down, darker, against a light sky: it reads what lies behind it
  // (the scene's colour before the brush) and is laid a step lighter or a step darker; over a middle value it is fainter)
  // (PAINTER 13: each stroke its own length, tapering to its tail and broken where the brush skipped: in Neptune's gale every
  // stroke lay level, one length, one weight, and the storm sky carried rows of ruled dashes. `rh` is the drop's own number:
  // the world draws rain with vary 0.35, so vPcData.x is 0.65..1 and stays with the drop)
  rain: 'float tpr = abs(vPcUv.x - 0.5) * 2.0; float rh = clamp((1.0 - vPcData.x) / 0.35, 0.0, 1.0); float rl = 0.38 + 0.62 * fract(rh * 7.31 + 0.13); if (tpr > 1.0 || vPcUv.y > rl || length(vView) < 3.2) discard; float yy = vPcUv.y / rl; float brk = smoothstep(0.28, 0.60, texture(uNoise3D, vec3(yy * 1.7 + rh * 13.0, rh * 5.3 + 0.21, 0.37)).r); vec3 bg = texture(uSceneCol, gl_FragCoord.xy / uSceneRes).rgb; float bl = dot(bg, vec3(0.3, 0.5, 0.2)); vec3 c = mix(mix(bg, ' + (RAINLOOK ? 'uHaze * min(1.0, 0.85 / max(max(uHaze.r, uHaze.g), max(uHaze.b, 1e-3)))' : 'vec3(0.94, 0.955, 0.97)') + ', 0.60), bg * ink * (0.95 + 0.05 * rh), smoothstep(0.50, 0.74, bl)); float w = 0.95; float ga = (1.0 - smoothstep(0.25, 1.0, tpr)) * (1.0 - smoothstep(0.30, 1.0, yy)) * smoothstep(0.0, 0.12, yy) * mix(0.35, 1.0, brk) * 0.70 * (1.0 - 0.45 * smoothstep(0.42, 0.56, bl) * (1.0 - smoothstep(0.62, 0.76, bl)));',
  streak: 'float tpr = abs(vPcUv.x - 0.5) * 2.0; if (tpr > 1.0 - 0.8 * vPcUv.y) discard; vec3 c = ink * vPcData.x; float w = 0.55;',
  dab: 'if (length(vPcUv - 0.5) > 0.5) discard; vec3 c = ink * vPcData.x; float w = 0.35;',
  // a flake: a speck of bare paper with a ragged edge (drawn out along its motion by the kit)
  flake: 'float rr = length((vPcUv - 0.5) * vec2(1.0, 1.25)) * 2.0; if (rr > 0.42 + 0.75 * texture(uNoise3D, vec3(vPcUv * 1.7, vPcData.x * 7.0)).r) discard; vec3 c = ink; float w = 0.05;',
  // (PAINTER 12, PHYSICS P20: where there is no air a kicked grain flies alone on its arc and falls: a small crisp touch of
  // the ground's own dust, not a soft puff; the fan keeps its shape)
  // dust: a ragged dry-brush patch thinning toward its edge; the pattern travels with the puff
  // (a glaze, like the rain: a soft veil of the ground's own dust, densest at its middle, running
  // out to nothing, broken softly where the brush was dry; never a hard pale blot)
  puff: 'float rr = length(vPcUv - 0.5) * 2.0; if (rr > 1.0 || length(vView) < 1.6) discard; float nz = 0.62 * texture(uNoise3D, vec3(vPcUv * 1.3, vPcData.x * 5.0)).r + 0.38 * texture(uNoise3D, vec3(vPcUv * vec2(3.0, 7.0), vPcData.x * 9.0)).g; vec3 c = mix(uHaze * 0.97, pcDensity(ink, 1.25), 0.42 + 0.10 * vPcData.x); float w = 0.95; float ga = (1.0 - smoothstep(0.10, 1.0, rr)) * smoothstep(0.22, 0.70, nz + 0.30 * (1.0 - rr)) * 0.52 * smoothstep(1.6, 3.6, length(vView)); if (uAirless > 0.5) { if (rr > 0.30) discard; c = pcDensity(ink, 1.30 + 0.25 * vPcData.x); ga = 0.88 * (1.0 - smoothstep(0.16, 0.30, rr + (nz - 0.5) * 0.12)); }',
  // a veil of dust (or of blown snow, or sand) as PHYSICS hands it over: vPcData.y its opacity,
  // .z how soft its ends are, .w 1 a long level streamer, 0 a round puff. A streamer is laid in
  // one level drag of a soft brush: densest just above its foot, thinning to nothing at its top
  // and toward its ends (which come down), broken along its length where the brush ran dry (the
  // breaks travel with the veil). Its wash is the ground's own dust thinned with the air, and a
  // streamer is lifted toward the paper: a pale skim snaking over the ground, never a blot.
  veil: 'vec2 p = (vPcUv - 0.5) * 2.0; if (length(vView) < 1.6) discard; float soft = clamp(vPcData.z, 0.08, 1.0), strm = clamp(vPcData.w, 0.0, 1.0);'
    + ' float ends = 1.0 - smoothstep(1.0 - max(soft, 0.8), 1.0, abs(p.x)); float up = (p.y + 1.0) * 0.5 / (0.3 + 0.7 * (1.0 - p.x * p.x));'
    + ' float prof = smoothstep(0.0, 0.12 + 0.2 * soft, up) * exp(-2.6 * up) * (1.0 - smoothstep(0.75, 1.0, up));'
    + ' float nz = 0.6 * texture(uNoise3D, vec3(vPcUv.x * 1.1 + vPcData.x * 3.7, vPcUv.y * 2.6, vPcData.x * 5.0)).r + 0.4 * texture(uNoise3D, vec3(vPcUv.x * 3.1, vPcUv.y * 8.0, vPcData.x * 9.0)).g;'
    + ' float ga = mix((1.0 - smoothstep(1.0 - soft, 1.0, length(p))) * 0.85, ends * prof * 2.0, strm) * (0.50 + 0.50 * smoothstep(0.22, 0.72, nz)) * clamp(vPcData.y * 2.6, 0.0, 1.0) * smoothstep(1.6, 3.6, length(vView)); ga = min(ga, 0.86);'
    // (seen in the game: a veil in the dust's own middle tone is lost against the hazy dune behind it. A veil
    // is the paper coming through: it is lifted toward the paper AFTER the air has been laid over it, so that
    // veils stand pale at every depth; less so after dark)
    + ' vec3 c = mix(uHaze * 0.97, pcDensity(ink, 1.25), 0.42 + 0.10 * fract(vPcData.x * 7.0)); float w = 0.95; float lift = (0.42 + 0.26 * strm) * (0.35 + 0.65 * uDayness);'
    // (PAINTER 13: where there is no air the kicked dust is grains, not a veil: the dust kind is drawn with this shape (the
    // painter's draw table makes it a veil), so PAINTER 12's grains in the puff never showed and a run on the Moon put up a
    // soft white puff of smoke at the boot. Each particle is one small crisp touch of the ground's own dust, darker than the
    // paper and not lifted toward it: a fan of grains that keeps its shape on its arcs and falls)
    // (a grain is a fleck two or three pixels across at the middle of its quad wherever it is, measured in pixels along each
    // side of the quad: a grain a quarter of the half-metre quad wide was a soft grey blot 40 px across as it flew past the
    // lens, and one drawn out by the quad's exposure was a thin pale scratch; laid a little darker than its ground)
    + ' if (uAirless > 0.5) { float gpx = length(vec2(p.x / max(fwidth(p.x), 1e-4), p.y / max(fwidth(p.y), 1e-4))); if (gpx > 1.9 || length(p) > 1.0) discard; c = pcDensity(ink, 1.65 + 0.25 * fract(vPcData.x * 7.0)); ga = 0.92 * (1.0 - smoothstep(1.0, 1.9, gpx + (nz - 0.5) * 0.4)) * clamp(vPcData.y * 3.0, 0.0, 1.0); lift = 0.0; }',
  // blown sand: a drag of the dune's own wash lifted toward the paper (a pale skim, heavier than
  // it was: scattered specks did not read), thinning to its tail
  // (PAINTER 13: with no air there is no skim: a kicked grain there is a fleck of the ground's own dust at the head of its
  // stroke, a little darker than its ground; the pale drags ran from the Moon walker's boots as thin white scratches)
  sandStreak: 'float tpr = abs(vPcUv.x - 0.5) * 2.0; if (tpr > 1.0 || length(vView) < 1.6) discard; vec3 c = mix(vec3(0.985, 0.972, 0.95), mix(uHaze, ink, 0.55), 0.58); float w = 0.9; float ga = (1.0 - tpr * tpr) * (1.0 - 0.8 * vPcUv.y) * smoothstep(0.0, 0.08, vPcUv.y) * 0.66 * smoothstep(1.6, 3.6, length(vView));'
    + ' if (uAirless > 0.5) { float gpx = length(vec2((vPcUv.x - 0.5) / max(fwidth(vPcUv.x), 1e-4), (vPcUv.y - 0.12) / max(fwidth(vPcUv.y), 1e-4))); if (gpx > 1.9) discard; c = pcDensity(ink, 1.65); ga = 0.9 * (1.0 - smoothstep(1.0, 1.9, gpx)) * smoothstep(1.6, 3.6, length(vView)); }',
  // (PAINTER 12, PHYSICS P20: and thinner as it comes to the lens, gone at 1.6 m: drops crossing near the eye in Neptune's
  // gale were large soft white blots over the picture)
  // spume and surf spray: a soft pale blot broken where the brush lifted (the drops off one crest run together
  // into a wisp of lifted paper; a fleck of 4 px was a glitter; the rain is a long grey stroke), laid after the brush
  spume: 'vec2 sp = (vPcUv - 0.5) * 2.0; float rr = length(sp * vec2(1.0, 1.3)); if (rr > 1.0 || length(vView) < 1.6) discard; float nz = texture(uNoise3D, vec3(vPcUv * 1.6, vPcData.x * 7.0)).r * 0.7 + texture(uNoise3D, vec3(vPcUv * 4.1, vPcData.x * 3.0)).g * 0.3; vec3 c = mix(ink, vec3(0.995, 0.995, 0.985), 0.86); float w = 0.08; float ga = (1.0 - smoothstep(0.10, 1.0, rr)) * smoothstep(0.30, 0.62, nz + 0.30 * (1.0 - rr)) * 0.46 * smoothstep(1.6, 7.0, length(vView));',
  // a leaf in the wind: a lens with pointed ends on the thin quad the kit lays (a line when it is
  // edge-on); laid as a glaze after the brush pass, so a mark two pixels wide is not brushed away
  // (two tones: half the leaves dark, to be seen against the sky and the meadow, half pale ochre, against the
  // wood; a leaf that turns over shows the other: it flickers as it tumbles)
  // (it ASSIGNS c, ga and w instead of declaring them: with the powers on the leaves' one program paints the
  // fire as well (SHAPES.fire), and two branches of the same program cannot each declare the same three names.
  // The arithmetic is exactly what it was.)
  leaf: 'vec2 lp = (vPcUv - 0.5) * 2.0; ga = (1.0 - smoothstep(0.7, 1.0, abs(lp.y) / max(1e-3, 1.0 - lp.x * lp.x))) * 0.94; if (ga < 0.02 || length(vView) < 1.2) discard; float lt = abs(step(0.5, fract(vPcData.x * 7.31)) - (gl_FrontFacing ? 0.0 : 1.0)); c = mix(pcDensity(ink, 1.5 + 0.4 * vPcData.x), mix(ink, vec3(0.97, 0.86, 0.52), 0.6), lt); w = 0.4;',
  // (the powers, fire) A FIRE, PAINTED. The physics throws three sorts of grain out of a burning patch
  // (physics/loose.js FLAME): short TONGUES rooted in the fire and gone in half a second, SMOKE sprinkled all the way
  // up a leaning column, and a few heavy EMBERS thrown up and carried off. All three are grains of the leaf kind
  // carrying a ground material's ink, so the kit lays each one as a RIBBON ALONG ITS OWN FLIGHT (expand.js, its wisp
  // option) -- and that ribbon is what lets a flame be painted as a RAMP of paint without one new number anywhere:
  //   vPcUv.x runs from 0 at the ribbon's TAIL -- where the grain was a tenth of a second ago -- to 1 at its HEAD,
  //     where the grain is now. For a rising tongue, 0 is down in the fuel and 1 is the tip; for an ember, 1 is the
  //     spark and 0 the end of its trail. So the paint can be ramped from root to tip along one mark.
  //   vPcUv.y runs across the ribbon, 0.5 along its spine. So the heart of a flame can be kept to the spine.
  //   vPcData.x is the grain's own number and stays with it for all its life, so a torn edge and a lean belong to
  //     the mark and travel with it instead of boiling.
  // WHAT A PAINTER DOES WITH FIRE, and what is laid here:
  //   A FLAME IS NOT ONE ORANGE. The dark goes down first -- a deep red-brown where the tongue leaves the fuel --
  //   then the orange body; then, LAST AND SMALLEST, the yellow-white heart, a little way up the tongue and only
  //   along its spine. The tip tears away red and is broken into licks, each tongue its own way, and the tongue
  //   licks over as it rises.
  //   SMOKE IS NOT GREY. It is warm and heavy where it leaves the fire and cool violet where it thins, and far more
  //   transparent at its edges than in its middle. Here the mark's own thickness swings it between the two, so the
  //   thin ends and the torn edges of every stroke are the violet ones; a crowd of them is the plume.
  //   AN EMBER IS TINY AND VERY BRIGHT, with a short tail of its own flight: white-hot at the head, deep red behind.
  // All four paints come from two inks: the flame's body orange and the embers' white-hot (biomeInks above).
  // WHAT IS MISSING, and it is one number the painter is not given: HOW OLD A GRAIN IS. The leaf kit hands the
  // fragment no age and no size (the unused instanced path has both; the game's does not), so a tongue cannot be
  // made to die down into smoke over its own life, and an ember cannot cool from white to red as it falls -- it
  // cools along its trail instead. It is missed less than it sounds: a grain's mark SHRINKS as it fades in and out
  // (expand.js scales the ribbon's length and its width together), so a tongue already licks up out of the fire and
  // dies back, and the crowd is renewed a hundred times a second.
  fire: /* glsl */`
    float fu = vPcUv.x, fv = (vPcUv.y - 0.5) * 2.0;                 // along the stroke (0 tail .. 1 head), across it (-1 .. 1)
    float fh1 = fract(vPcData.x * 7.31), fh2 = fract(vPcData.x * 23.17);      // two numbers of this grain's own
    // how many pixels wide and long this ribbon is. The painter takes away any mark much under two pixels, and a
    // crowd of marks taken away BLINKS as it flies, so nothing below cuts a mark thinner than that: far off, a
    // tongue and a spark are each one small bright touch, which is what they should be.
    float fpw = 1.0 / max(fwidth(vPcUv.y), 1e-5), fpl = 1.0 / max(fwidth(vPcUv.x), 1e-5);
    vec3 fBody = uPcInk[${I_FLAME}], fHot = uPcInk[${I_EMBER}];
    vec3 fRoot = fBody * vec3(0.34, 0.20, 0.26), fTip = fBody * vec3(0.82, 0.38, 0.30);
    if (length(vView) < 0.8) discard;                               // nothing right against the lens (you may stand close to a campfire)
    if (fm == ${I_SMOKE}) {
      // SMOKE. A torn stroke, thick along its middle and dissolving at both ends; the tear travels with it.
      float sb = smoothstep(0.0, 0.26, fu) * (1.0 - smoothstep(0.52, 1.0, fu));
      float snz = texture(uNoise3D, vec3(fu * 1.7 + fh1 * 31.0, vPcUv.y * 2.3, fh2 * 9.0)).r;
      float sw = min(sb * (0.42 + 1.05 * snz), 1.0);
      sw = max(sw, min(1.0, 1.8 / fpw) * step(0.06, sb));
      if (abs(fv) > sw) discard;
      float dens = (1.0 - smoothstep(0.30, 1.0, abs(fv) / max(sw, 1e-3))) * sb;
      c = mix(mix(ink, vec3(0.42, 0.40, 0.54), 0.58), ink * vec3(1.16, 1.00, 0.86) + fRoot * 0.10, dens);
      // (a plume of middle grey over a wood of middle browns is not in the picture at all. As the rain does, the
      // smoke reads what lies behind it and is laid paler where that is dark, keeping its own grey against a light sky.)
      vec3 sbg = texture(uSceneCol, gl_FragCoord.xy / uSceneRes).rgb;
      // ... BY DAY. (SEEN, 2026-11-22, a fire burning in the gallery at nine at night: 181 puffs of smoke against a
      // dark wood were every one of them laid 45 % toward pale lavender, and the fire -- 310 tongues of it -- was
      // hidden INSIDE a thicket of pale standing strokes. It read as a field of straws, and that is most of why the
      // owner says the fire does not feel violent. A night fire's smoke is dark and takes the fire's own red from
      // below; only a daylit plume needs lifting off a dark wood to be seen at all.)
      c = mix(mix(c, vec3(0.80, 0.78, 0.82), 0.45 * uDayness), c, smoothstep(0.16, 0.44, dot(sbg, vec3(0.3, 0.5, 0.2))));
      c = mix(c, mix(c, fRoot, 0.55) * 0.72, (1.0 - uDayness) * dens);
      ga = 0.34 * dens;
      w = 0.5;
    } else if (fm == ${I_EMBER}) {
      // AN EMBER. Only the head of the ribbon is kept: the whole stroke would read as a flame flying through the
      // air. Never less than a few pixels of it, so a far spark is a touch and not a blink.
      // (SEEN, 2026-11-22, in the painter's own gallery with a fire burning: at a phone's picture size the whole
      //  ribbon was being kept -- 6 / fpl came out over 1 -- and a spark an inch long became a PALE STRAW a second
      //  and a half long. A crowd of them standing on a burning bank read as reeds, not as fire. A spark is a
      //  spark: never more than this share of its own flight, however small the picture.)
      float keep = clamp(6.0 / fpl, 0.10, 0.40);
      if (fu < 1.0 - keep) discard;
      float et = (fu - (1.0 - keep)) / keep;                        // 0 the end of the tail .. 1 the spark itself
      float ew = max(0.16 + 0.42 * et * et, min(1.0, 1.5 / fpw));
      if (abs(fv) > ew) discard;
      c = mix(mix(fRoot, fTip, smoothstep(0.05, 0.55, et)), fHot, smoothstep(0.60, 1.0, et * et));
      ga = (0.34 + 0.64 * et) * (1.0 - smoothstep(0.72, 1.0, abs(fv) / max(ew, 1e-3)));
      w = 0.0;
      own = 1.0;
    } else {
      // A TONGUE: narrow where it leaves the fuel, fattest a quarter of the way up, torn into licks at its tip.
      // IT WHIPS (the owner, 2026-11-22: "change up the fire animation it doesnt feel violent enough"). One slow
      // sine read as a flag waving in a breeze. A tongue of fire snaps over, tears, and snaps back, so there are
      // two beats now that do not divide into each other -- a fast one a tongue lives through about once, and a
      // slower one it only sees part of -- each with this grain's own phase, and both growing toward the tip so
      // that the root stays rooted in the fuel and only the free end is thrown about.
      float lick = (sin(fu * 3.4 + fh2 * 6.2831853 + uTime * 15.0) * 0.44
                  + sin(fu * 1.7 + fh1 * 6.2831853 + uTime * 6.3) * 0.33) * fu * fu;
      float across = abs(fv - lick);
      float profT = smoothstep(0.0, 0.22, fu) * (1.0 - 0.90 * smoothstep(0.34, 1.0, fu));
      // and it tears into separate licks, in two sizes: the big tear that breaks the tip into tongues of its own,
      // and a finer one that ragges their edges. (It was one tear beginning at 0.42, which left the top half of
      // every tongue a smooth leaf shape -- the thing that made a crowd of them read as decoration.)
      profT -= smoothstep(0.22, 1.0, fu) * 0.82 * texture(uNoise3D, vec3(fu * 5.3 + fh1 * 37.0, fh2 * 11.0, 0.21 + uTime * 0.9)).r;
      profT -= smoothstep(0.42, 1.0, fu) * 0.40 * texture(uNoise3D, vec3(fu * 14.0 + fh2 * 13.0, fh1 * 29.0, 0.63 + uTime * 1.9)).g;
      // the painter keeps no mark under about two pixels, so a far tongue is widened to that. HOW FAR IT HAD TO BE
      // WIDENED is what thin says: 1 where the tongue is its own width, 0 where it is only the thinnest mark that
      // will be kept. (SEEN, 2026-11-22: without this the heart -- the white-hot core -- was laid at full strength
      // on a tongue two pixels wide, so the centre pixel of every far flame was WHITE. A burning bank read as a
      // field of pale straws. The heart belongs to a tongue wide enough to have one.)
      float prof = max(profT, min(1.0, 1.8 / fpw) * step(0.04, fu));
      float thin = clamp(profT / max(prof, 1e-4), 0.0, 1.0);
      if (across > prof) discard;
      float fe = across / max(prof, 1e-3);                          // 0 on the spine .. 1 at the tongue's edge
      // the heart: SHORT along the tongue -- a fifth of its length, low down -- and most of the spine's width
      // across it, because the whole mark is only a hand's breadth wide and a heart kept to a tenth of that
      // would be a third of a pixel at ten metres and would not be in the picture at all
      // (SEEN, 2026-11-22: with the tongue widened to a flame's own proportions the heart, which had been a white
      //  pixel in a thin stick, became a WHITE BODY with an orange rim -- a crowd of candle flames. It is the
      //  hottest INCH of a tongue, not the whole of it: lower, shorter and kept to the spine.)
      float hot = smoothstep(0.02, 0.11, fu) * (1.0 - smoothstep(0.13, 0.40, fu)) * (1.0 - smoothstep(0.22, 0.62, fe)) * thin;
      c = mix(fRoot, fBody, smoothstep(0.0, 0.26, fu));             // the dark root into the orange body
      c = mix(c, fTip, smoothstep(0.32, 1.0, fu) * 0.95);           // the body tearing away red at the tip
      c = mix(c, fTip, 0.45 * smoothstep(0.50, 1.0, fe));           // and cooler at the outside of the tongue
      c = mix(c, fHot, hot * hot * 0.82);                           // the heart, laid last and smallest
      ga = (0.60 + 0.38 * hot) * (1.0 - smoothstep(0.78, 1.0, fe));
      w = 0.0;
      own = 1.0;
    }
  `,
  // a splash ring: a broken circle of paper, a little wider than the physics draws it so that
  // it is a mark and not a hairline
  // (a glaze: a soft pale arc of paper colour, broken where the brush lifted, never a white wire)
  // (PAINTER 12, PHYSICS P20: a faint glaze a step lighter than the water, softer and a third as strong: in PHYSICS' float
  // strips the rings in the rain were crisp white ellipses all over the sea)
  // ((P21) a flake settling (kind 2) and a hailstone's bounce (3) leave no ring)
  ring: 'if (vPcData.x > 1.5) discard; float cov = pcPhysRingCover(vPcUv, vPcData.z) * (0.4 + 0.6 * vPcData.y); float brk = texture(uNoise3D, vec3(vPcUv * 2.1, vPcData.w * 37.0)).r; float ga = smoothstep(0.0, 0.34, cov) * smoothstep(0.30, 0.58, brk) * 0.22; if (ga < 0.02) discard; vec3 c = vec3(0.96, 0.965, 0.95); float w = 0.0;',
  // a print: this ground, darker; a paler rim on loose ground; fading thins it through the
  // noise (fixed in the mark, so it never boils)
  mark: 'float scour = step(3.5, vPcData.z); float cover = pcPhysMarkCover(vPcUv, vPcData.z) * (1.0 - scour), rim = pcPhysMarkRim(vPcUv, vPcData.z) * step(1e-4, vPcData.y); float a = max(cover * clamp(vPcData.x * 12.0, 0.15, 0.9), rim * mix(0.6, 0.22, scour)) * min(1.0, vPcData.w * 3.0); a = min(a, 0.62); if (a < texture(uNoise3D, vec3(vPcUv * 1.7, vPcData.z * 0.37 + vPcData.x)).g) discard; vec3 c = mix(pcWetWash(ink, 1.0) * 0.66, mix(ink, vec3(1.0), 0.45), rim * (1.0 - cover)); float w = 0.2;',
};
function shapeOf(kind, info) {
  if (kind === 'rain') return SHAPES.rain;
  if (kind === 'snow') return SHAPES.flake;
  if (kind === 'dust' || kind === 'ash' || kind === 'sand') return info.veil ? SHAPES.veil : kind === 'sand' ? SHAPES.sandStreak : SHAPES.puff;
  // (the powers: with the leaves' kit inked, a grain in a ground material's ink is a stroke of air, pale and of one tone)
  // (a grain of the leaf kind that carries a ground material's ink: the powers' strokes of air, in the pale inks of
  // snow and ice, and the dark pieces of a snapped branch, in the ground's brown. The pale go paler and softer; the dark
  // keep their own colour, or a branch would be a white stroke.)
  // (the powers, fire: and three of those inks are a fire's -- the flame's, the embers' and the ash the smoke
  // borrows. Those are painted as fire (SHAPES.fire); every other grain of the crowd is the leaf it always was.
  // `own` is 1 for a mark that is its own light, which main() below keeps out of the night's key.)
  if (kind === 'leaves') {
    if (!info.inked) return 'vec3 c; float ga; float w;\n' + SHAPES.leaf;
    return 'vec3 c; float ga; float w; float own = 0.0;\n'
      + `int fm = vPcMat < 200.0 ? int(vPcMat + 0.5) : -1;\n`
      + `if (fm == ${I_FLAME} || fm == ${I_EMBER} || fm == ${I_SMOKE}) {${SHAPES.fire}} else {\n`
      + SHAPES.leaf
      + ' if (vPcMat < 200.0) { float pale = smoothstep(0.42, 0.78, dot(ink, vec3(0.33))); c = mix(ink, vec3(1.0, 1.0, 0.98), 0.4 * pale); ga *= mix(1.0, 0.86, pale); }\n}';
  }
  if (kind === 'spray') return SHAPES.spume;
  return SHAPES[info.shape] || SHAPES.dab;
}
// region ids: prints belong to the ground (1); splash rings are 6 (kept crisp by the post
// pass); everything in the air is 7 (no graphite line is drawn round a raindrop or a puff)
// Kinds that are laid as a GLAZE: a transparent stroke over whatever is behind it (darker than
// a light sky, lighter than a dark wood), instead of an opaque mark. They are drawn after the
// abstraction pass, onto the brushed picture (shared.js GLAZES; the painter does it), testing
// their depth by hand against the scene's, so the post passes still see the thing behind them.
const GLAZE = { rain: 1, dust: 1, ash: 1, sand: 1, leaves: 1, spray: 1 };
function regionOf(kind, info) {
  if (kind === 'ring' || info.shape === 'ring') return 6.0;
  if (kind === 'mark' || info.shape === 'mark') return 1.0;
  return 7.0;
}

// makeKitMaterial(kind, info, { bodyUniforms, shapeGlsl }): PHYSICS' reference factory with the
// painter's shapes, inks and regions. `shapeGlsl` is PHYSICS' SHAPE_GLSL (ring and mark covers).
export function makeKitMaterial(kind, info, opts) {
  const glaze = !!GLAZE[kind] || kind === 'ring' || info.shape === 'ring';      // (a splash ring is a glaze too)
  const m = new THREE.ShaderMaterial({
    name: 'pc-kit-' + kind,
    uniforms: makePaintUniforms(opts.bodyUniforms || undefined, { uColor: { value: KIT_INK[kind] || KIT_INK.dust }, uPcInk: { value: KIT_PALETTE }, uSceneAux: G.uSceneAux, uSceneRes: G.uSceneRes, uSceneCol: G.uSceneCol, uAirless: G.uAirless, ...info.uniforms }),
    vertexShader: `${VERT_PARS}
${info.vertexChunk}
varying vec3 vView;
void main() {
  vec4 mv = modelViewMatrix * vec4(pcKitPosition(), 1.0);
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
  ${VERT_END}
}`,
    fragmentShader: `${FRAG_PARS}
${opts.shapeGlsl || ''}
uniform vec3 uColor;
uniform vec3 uPcInk[${INK_SLOTS}];      // the ground's fifteen, the flame's and the embers' (KIT_PALETTE above)
uniform highp sampler2D uSceneAux;
uniform sampler2D uSceneCol;
uniform vec2 uSceneRes;
uniform float uAirless;
varying vec2 vPcUv; varying vec4 vPcData; varying vec3 vView; varying float vPcMat;
void main() {
  #include <logdepthbuf_fragment>
  // the ink: that of the ground the thing came from, where it came from the ground
  vec3 ink = vPcMat < 200.0 ? uPcInk[int(vPcMat + 0.5)] : uColor;
  ${shapeOf(kind, info)}
  ${kind === 'rain' ? ''
    // (the powers, fire: a flame and an ember are LIGHTS. They are not taken down to the light of the hour as a
    // leaf is -- a fire by night is the one warm thing in the picture -- only hazed by the air between. `own` is 1
    // for those marks and 0 for every other grain of the crowd, which is painted exactly as it was.)
    : kind === 'leaves' && info.inked ? 'c = pcAtmosV(mix(pcTone(c, 2.0), c, own), pcFogAmount(length(vView)), vView);'
      : 'c = pcAtmosV(pcTone(c, 2.0), pcFogAmount(length(vView)), vView);'}
  ${info.veil && (kind === 'dust' || kind === 'ash' || kind === 'sand') ? 'c = mix(c, vec3(0.985, 0.975, 0.955), lift);' : ''}
  ${glaze ? 'if (log2(1.0 + max(-vView.z, 0.0)) > pcAuxDec(texture(uSceneAux, gl_FragCoord.xy / uSceneRes)).z + 0.01) discard; gl_FragColor = vec4(clamp(c, 0.0, 1.0), ga);' : `pcWrite(c, w, vec3(0.0, 0.0, 1.0), -vView.z, ${regionOf(kind, info).toFixed(1)});`}
}`,
    side: THREE.DoubleSide, transparent: glaze, depthWrite: !glaze, depthTest: !glaze,
    polygonOffset: info.shape === 'mark' || info.shape === 'ring', polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  m.userData.pcPainted = true;
  m.userData.pcGlaze = glaze;
  return m;
}
