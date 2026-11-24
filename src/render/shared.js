// Painted Cosmos: uniforms and textures shared by every painted material. OWNER: PAINTER.
import * as THREE from 'three';
import { genNoise3D, genStrokes, genPaper } from './texgen.js';
import { PAPER, hexToRgb, LOOKS } from '../data/looks.js';
import { MODE, overlayOil } from '../data/mode.js';
import { getDabTextures } from './dabtex.js';
// (the powers, fire: the lasting record of what the fire LEFT -- the scorched ground. A small module of plain numbers
// with no three in it, read here the way world/flora.js reads the felled trees. With nothing ever burnt, every reader
// in it is one comparison, and syncBurnt below keeps that promise.)
import { BURN, BURNT, MARK, scorchesOn, meltsOn } from '../data/burnt.js';

let _tex = null;
export function getTextures() {
  if (_tex) return _tex;
  const n3 = new THREE.Data3DTexture(genNoise3D(64), 64, 64, 64);
  n3.format = THREE.RGBAFormat; n3.type = THREE.UnsignedByteType;
  n3.wrapS = n3.wrapT = n3.wrapR = THREE.RepeatWrapping;
  // mipmapped, so far-away lookups average out instead of shimmering
  n3.minFilter = THREE.LinearMipmapLinearFilter; n3.magFilter = THREE.LinearFilter; n3.generateMipmaps = true;
  n3.unpackAlignment = 1; n3.needsUpdate = true;

  const st = new THREE.DataTexture(genStrokes(256), 256, 256, THREE.RGBAFormat, THREE.UnsignedByteType);
  st.wrapS = st.wrapT = THREE.RepeatWrapping;
  st.minFilter = THREE.LinearMipmapLinearFilter; st.magFilter = THREE.LinearFilter;
  st.generateMipmaps = true; st.anisotropy = 4; st.needsUpdate = true;

  const pp = new THREE.DataTexture(genPaper(512), 512, 512, THREE.RGBAFormat, THREE.UnsignedByteType);
  pp.wrapS = pp.wrapT = THREE.RepeatWrapping;
  pp.minFilter = THREE.LinearMipmapLinearFilter; pp.magFilter = THREE.LinearFilter;
  pp.generateMipmaps = true; pp.needsUpdate = true;

  _tex = { noise3D: n3, strokes: st, paper: pp };
  return _tex;
}

const paper = hexToRgb(PAPER);

// One object per uniform, shared by reference between all materials.
export const G = {
  uTime: { value: 0 },          // seconds, drives wind and drift (frozen for deterministic frames)
  uNoise3D: { value: null },
  uStrokeTex: { value: null },
  uPaperColor: { value: new THREE.Vector3(paper[0], paper[1], paper[2]) },
  uPrevTex: { value: null },    // last frame's painting (rgb) and log depth (a), half resolution
  uPrevOn: { value: 0 },
  // cast shade of the explorer and the ship on the ground (the world fills these): per caster
  // [centre body-local, half length], [axis body-local, half width]; uCastK the two strengths
  uCast: { value: [new THREE.Vector4(0, 0, 0, 1), new THREE.Vector4(1, 0, 0, 1), new THREE.Vector4(0, 0, 0, 1), new THREE.Vector4(1, 0, 0, 1)] },
  uCastK: { value: new THREE.Vector2(0, 0) },
  uNoHazeUp: { value: new THREE.Vector4(0, 0, 0, 0) }, uUpW0: { value: new THREE.Vector3(0, 1, 0) },   // (for body uniforms made before these existed)
  uMoon0: { value: 0 },
  uFogBank0: { value: new THREE.Vector2(0, 150) },     // (a material without a body: no banks)
  uRound0: { value: new THREE.Vector2(0, 4000) }, uHeart0: { value: new THREE.Vector4(0, 1, 0, 0) },
  uGroundK0: { value: new THREE.Vector4(0, 1, 0, 0) },
  // the near air (x how much of what stands at distance y metres it veils, rising as 1 - exp(-d / y)): a dust storm
  // veils the explorer at the eye's own distance, which the far washes' stacked bands cannot (the world sets it)
  uAirNear: { value: new THREE.Vector2(0, 9) },
  uAirless: { value: 0 },        // 1 on a world without air (the kits draw kicked dust as grains, not puffs)
  // the scene pass's second target (normal, log depth, region) and its size: glazes test their
  // depth against it by hand (set by the post passes)
  uSceneAux: { value: null }, uSceneRes: { value: new THREE.Vector2(2, 2) },
  // the scene pass's colour (what lies behind a glaze, before the brush): the star glaze reads
  // how dark the sky is there
  uSceneCol: { value: null },
  // 1 where the browser cannot draw into float targets (no EXT_color_buffer_float or _half_float): the scene pass's
  // second target (normal, log depth, region) and last frame's depth are then 8-bit, so they are written packed into
  // 0..1 (pcAuxEnc) and unpacked where they are read (pcAuxDec); 0 everywhere else: nothing changes (see post.js)
  uAux8: { value: 0 },
  // (the powers, move water: the parted channel. A: where it begins, FROM THE EYE, in the body's axes, and its half
  // width (m; 0: there is none). B: the way it runs (unit, the body's axes) and its length now (m). Set by the world
  // each frame from the physics' list of the explorer's wind; read only by the water compiled with PC_POWERS.)
  uPwChanA: { value: new THREE.Vector4(0, 0, 0, 0) }, uPwChanB: { value: new THREE.Vector4(0, 0, 1, 0) },
};

// THE LOOK. The default is the watercolour. `?look=oil` (docs/HANDOVER.md 4a, the owner's reference clip) paints the same
// world in opaque paint: body colour, a warm light and a cool shade, strokes laid on the surfaces themselves, no paper
// and no brush passes. It is a compile-time switch (the define PC_OIL in every painted material), so the watercolour's
// shaders are, with it off, exactly what they were. The uniforms below are the oil look's dials, shared by reference
// by every material; `&stroke=` (a multiple of the stroke's size) and painter.setLook({ oil: {...} }) turn them.
const _qs = (() => { try { return new URLSearchParams(location.search); } catch (e) { return null; } })();
const _qn = (k, d) => (_qs && _qs.has(k) && isFinite(+_qs.get(k)) ? +_qs.get(k) : d);
// THE LOOK DIRECTOR'S SWITCH (2026-11-24; the owner: "No do make it look different"). The night key (L1), the one
// foliage shade and the quiet darks (L2 + L7), one light (L3) and the sky's ceiling with the air's top (T1 reworked,
// FV1) are ON. `?light=old` turns all of them off together: the oil look exactly as it was before them (pixel-identical,
// docs/lead/LOOK-BUILD.md), for the owner to compare. Each part keeps its own switch either way
// (`?nightkey=0`, `?light=old&nightkey=1` and so on). The air from the air (L5) is not in it yet: off unless `?airfar=1`.
const _LO = !!(_qs && _qs.get('look') === 'oil' && _qs.get('light') === 'old');
const _LN = _LO ? 0 : 1;
export const LOOK = {
  oil: !!(_qs && _qs.get('look') === 'oil'),
  lightNew: _LN,      // (1 unless ?light=old)
  // HOW MANY BANDS THE AIR IS LAID IN (world/index.js, uFog.y; chunks.js pcFogAmount quantises the haze to this many
  // steps). The watercolour keeps its six. The oil look takes ten, because the oil air is thicker and the ceiling
  // below holds it to about three quarters: over a long hillside six steps of a sixth each were six ruled terraces,
  // and ten steps of a tenth are half as tall and twice as many. MEASURED on the autumn wood (visibility 259 m): the
  // haze at 10 m goes 0.005 to 0.024, at 30 m 0.167 to 0.200, at 60 m 0.468 to 0.434 -- the mean of the curve is the
  // same, the steps are finer, and the near air wobbles by at most 0.034 either way. `?bands=` turns it.
  oilBands: _qn('bands', 10),
  // THE AIR FROM THE AIR (L5, LOOK-AUDIT F2 and F6; chunks.js pcFogAmount and pcAtmosV, sky.js pcSkyAir): 1 on, 0 the
  // far air exactly as it was. OFF until it has passed the coordinator's eye: `?airfar=1` turns it on. world/index.js turns it into OIL.uLookN.w each frame: 0 on foot, rising to
  // 1 as the air's reach grows from the ground's to the air's.
  airFar: _qn('airfar', 0),
};
MODE.oil = LOOK.oil;      // (for the look data and the surface, which do not load this module: data/mode.js)
MODE.calm = LOOK.oil && !!(_qs && _qs.get('floor') === 'calm');      // (a calmer forest floor, to compare: data/looks/earth.js)
if (LOOK.oil) overlayOil(LOOKS);      // (the oil look's own kinds of plant and where they stand: data/mode.js)
export const OIL = {
  // THE STROKES ARE THE OWNER'S STYLE 5 (2026-11-15: leaf dabs lying every way, the clip's own way, a little thinner than
  // the clip's). The five other styles tried at checkpoint 1 are gone; the thin strokes are kept for bark, the tiles
  // for snow.
  // x: a stroke's width on the screen (pixels at 720 lines; it is scaled with the picture's height); a leaf dab is about
  //    uOilS.w of these to a cell   y: how much richer than a wash the body colour is (pcDensity)   z, w: the powers
  //    that turn the pale light and glaze keys of the watercolour into the oil's warm light and cool shade
  uOilA: { value: new THREE.Vector4(4.6 * _qn('stroke', 1), 1.9, 2.0, 1.15) },
  // x: the sunlit paint's gain   y: the tiles' line (a share of a tile's width)   z: how far a stroke's colour strays
  //    from its neighbours'   w: a tile's length over its width
  uOilB: { value: new THREE.Vector4(1.12, 0.07, 1.0, 2.6) },
  // x: the power on the haze key (near 1: a pale, high air, as the clip's)   y: the glow of the air toward the sun
  //    z: 0 strokes off (the colour and light only) .. 1 on   w: how much farther off the air takes a thing on the
  //    ground than in the watercolour (the wood's depth; eased to 1.6 as the eye rises and the air thins)
  // (w was 4.0 and y 0.8: a trunk thirty metres off was half gone, and toward the sun the air burnt to white: the
  // critic's "wash-out"; the clip's trunks stay dark much deeper into its haze)
  uOilC: { value: new THREE.Vector4(1.15, 0.5, _qn('strokes', 1), 2.7) },
  // the shade (chunks.js pcTone): x the cool key's gain over the body colour   y the sky's own fill in it (added)
  //    z the green left in the key (under 1: the shade leans to violet)   w the tiles' line: how light it is
  // (?shadefill= and ?shadegreen=, 2026-11-18: the art pass against the owner's twenty oil paintings. Measured on a
  // rendered still of the game's own wood, the game's DARKS ARE LURID WHERE THE REFERENCES' ARE NEUTRAL: a trunk's
  // deepest pixels came out at saturation 0.93 against the references' 0.33, the conifers 0.95 against 0.31, the grass
  // in shade 0.93 against 0.49. That one difference is most of why the references read as oil paint and the game as
  // poster paint. y is how much of the sky's own light falls into a shade, which lifts it and takes the colour out of
  // it; z is how much green is left in the cool key, so under 1 a shade leans violet. Both are left at what they were
  // until a still says what they should be.)
  uOilD: { value: new THREE.Vector4(1.0, _qn('shadefill', 0.10), _qn('shadegreen', 0.90), 1.3) },
  // x: (not in use)   y: (not in use)   z: a leaf dab's length over its width   w: a dab's cell (half its length) in
  //    stroke widths
  // (x: ?hazeblue=, 2026-11-18 - how far the far air leans to the blue-violet the owner's aerial references have
  //  instead of the warm cream it goes to now. 0 is the look as it was. See chunks.js pcOilHaze.)
  uOilS: { value: new THREE.Vector4(_qn('hazeblue', 0.35), _qn('shoulder', 0.80), 2.4, 2.6) },
  // what grows on the ground: x the share of the near ground's strokes kept (the clip's floor is a carpet of leaves
  //    with tufts of grass here and there, not a sward)   y the share of the undergrowth's blades and fronds kept
  //    z 1 while the scene pass is multisampled (set every frame)
  // (x is 0 since the overhaul plan's fifth piece: the watercolour's near strokes are shapes cut out of cards, a fan of
  // blades as one card with a notched top: in flat paint they stood on the floor as notched slabs. The oil look's floor
  // is its leaf dabs, tufts of real blades, saplings and small leafy plants.)
  // (y was 0.45 while the blades were the watercolour's stiff spikes; they are tufts now, and four in five are kept)
  // (w: how far the world the eye is on takes the look's golden hours, chunks.js pcGold: a look's `oil.gold`, set by the world)
  uOilG: { value: new THREE.Vector4(_qn('sward', 1.0), 1.0, 0, 1) },
  // THE LIGHTER PAINT, for phones (the owner's S23 Ultra, 2026-11-16: its own speed test showed the ground's paint to be
  // the one cost that follows the picture's size, 15 ms of a 36 ms frame at a third of a megapixel).
  //    x 1: the lighter paint: the ground in two layers of dabs where it has three, no noise looked up for a dab's hue or
  //         its leaf shadow under a grey sky, bark and crowns in one layer. Set by the painter from the tier and the kind
  //         of device (render/index.js); ?lite=0|1 pins it.
  //    y for the speed test only (core/bench.js): 1 the ground one flat colour, 2 the plants one flat colour
  uOilL: { value: new THREE.Vector4(0, 0, 0, 0) },
  // the cast shadows (shadow.js): the map, the body's own space to the map's square, and x how strong (0: no map this
  //    frame), y the bias, z a texel, w where the map's answer gives way to the leaf shadow's pattern
  // THE AIR'S CEILING AND THE LIGHT'S FOUR VALUES (2026-11-22, the owner: "i want things to look high quality and
  // fully rendered even from 300 yards away"). THE MEASUREMENT THAT STARTED THIS: on the autumn wood (visibility
  // 259 m) chunks.js pcFogAmount returns EXACTLY 1.000 for anything 230 m off or farther, so at the owner's 275 m
  // every pixel is one flat haze colour and nothing the ground, the trees or the water computes is ever seen. That
  // one fact is the whole complaint.
  //   x: HOW MUCH OF ITS OWN PAINT THE FAR GROUND KEEPS (`?air=`; 0 is the look as it was, the air takes everything).
  //      The ceiling it sets is 1 - x, reached with a soft knee from y, so the first sixty metres of the curve do not
  //      move at all (the near thick pale air is the owner's own reference and is not being touched). MEASURED on the
  //      autumn wood: the haze reads 0.167 at 30 m (0.167 before), 0.635 at 100 m (0.668), 0.723 at 150 m (0.836) and
  //      holds at 0.755 from 230 m out instead of 1.000, so a thing at 275 m keeps a quarter of itself. NOT done by
  //      lowering uOilC.w, which is a rejected change (see the note on uOilC above).
  //   y: the knee: the share of air below which nothing changes at all (`?airknee=`). 0.46 is where the wood's curve
  //      stands at 60 m. Held at or under 1 - 2x, which is what keeps the curve rising everywhere (above that the
  //      soft knee would dip and a far ridge would read CLEARER than a nearer one).
  //   z: THE LIGHT'S FOUR VALUES (`?litcurve=`; 0 is the remap as it was). As it stood, pcLevel's oil remap floored
  //      the light at 0.30, so the deepest paint was unreachable in daylight and the middle tone was about seven
  //      degrees of angle wide: every far form was two flat shapes with a hard join. See chunks.js pcLevel.
  //   w: LIGHT THAT KNOWS UP FROM DOWN (`?bounce=`; 0 is the shade as it was). The sky's fill scaled by how much a
  //      surface faces the sky, and a warm bounce off the ground for the downward half: chunks.js pcUp and pcTone.
  uOilAir: { value: new THREE.Vector4(_qn('air', 0.25), _qn('airknee', 0.46), _qn('litcurve', 1), _qn('bounce', 1)) },
  // the leaf dabs laid once (dabtex.js; made in ensureGlobals from uOilS.z): a texel a dab, and each texel's topmost three
  uDabP: { value: null }, uDabId: { value: null },
  uShTex: { value: null }, uShM: { value: new THREE.Matrix4() }, uShK: { value: new THREE.Vector4(0, 0, 0, 0.86) },
  // LIGHT IN THE AIR (the overhaul plan's fourth piece; post.js OIL_FRAG): the eye's own space to the shadow map's
  // square, the way to the sun in the eye's space, the lit air's colour, and x how strong the shafts are (0: none),
  // y the air's density (1/m), z how far along a line of sight the air is followed (m), w the lit share taken as the
  // air's mean (a line with more of its air in the sun is lighter than the picture as painted, one with less darker)
  uShAir: { value: null },      // (the shadow map taken down for the air: shadow.js AIR_FRAG)
  uShV: { value: new THREE.Matrix4() }, uSunV: { value: new THREE.Vector3(0, 1, 0) }, uShaftC: { value: new THREE.Vector3(1, 0.86, 0.58) },
  uShaft: { value: new THREE.Vector4(0, 0.01, 110, 0.55) },
  // the wanderer's lantern: where it is (the body's own space) and how strong its pool of light is now (0 by day):
  // laid into the ground's and the plants' strokes (chunks.js pcLamp), not a light in the scene
  uLamp: { value: new THREE.Vector4(0, 0, 0, 0) },
  uAuroraK: { value: 0 },        // how strong the aurora overhead is (0: none): the water's dashes carry its green by night (materials.js WATER_FRAG)
  uLampV: { value: new THREE.Vector4(0, 0, -1, 0) },     // the lantern in the eye's space (set every frame, render/index.js), w how strong: its light on the figure itself (materials.js FIG_FRAG; a soft glow in the air round it was tried and taken out: the one soft edge in the picture)
  uLampF: { value: new THREE.Vector4(0, 0, 0, 0) },      // where the wanderer stands (the body's space), w 1 while it does: its shadow by the lantern's light
  // x: the angle one pixel of the scene pass takes (radians)   y: the scene pass's height in pixels (both set every
  // frame)   z: the smallest stroke's width, m (nearer than where that is uOilA.x pixels, strokes keep this width on
  // the land and grow on the screen, as the clip's do)   w: THE FAR FLOOR IN MASSES (`?masses=`; 0 is the step as it
  // was). How far the leaf shadow eases from its hard step to the canopy's own lit share as the dab grows past the
  // pattern's features, which is what stops the floor at 275 m being light-and-dark confetti that flickers as the
  // eye moves: chunks.js pcDappleS. (w held 0.085 and was read nowhere.)
  uOilPx: { value: new THREE.Vector4(0.0015, 720, 0.027 * _qn('stroke', 1), _qn('masses', 1)) },
  // THE LOOK DIRECTOR'S SWITCHES (docs/lead/LOOK-BUILD.md; 2026-11-24). Uniforms, not defines, so that A and B of one
  // still come from one page and the speed test can turn each off while it runs. 1 on, 0 the picture as it was.
  //   x THE NIGHT KEY (L1, `?nightkey=`): by the moon a colour goes part of the way to its own value in the night
  //     key's hue and the moonlit paint is laid at the night's own strength (chunks.js pcTone); the last pass excuses
  //     from the night's grade only what the lantern lights and what is itself a light, not every warm pixel (post.js)
  //   y ONE FOLIAGE SHADE (L2, `?leafshade=`): the shade of leaves, blades, far crowns and green floor dabs from one
  //     function, quieted to its own value (chunks.js pcShadeLeaf)
  //   z kept for L3 (one light)
  //   w QUIET DARKS (L7, `?postdark=`): the last pass's S laid on the value only, and its colour push faded out under
  //     a value of 0.30 and measured by the real saturation (post.js OIL_FRAG)
  uLookF: { value: new THREE.Vector4(_qn('nightkey', _LN), _qn('leafshade', _LN), _qn('onelight', _LN), _qn('postdark', _LN)) },
  // THE NIGHT'S TWO NUMBERS for the world the eye is on (world/index.js sets them each frame from the world's look):
  //   x how strong the moonlit paint is against the sunlit (a look's oil.night.v; 0.60, or 0.85 where the world has a
  //     night key of its own, as Neptune's, which the owner liked as it was)
  //   y how far a colour goes toward its own value in the night key's hue (oil.night.c; 0.45, or 0.20 likewise)
  //   z THE SHADE FOLLOWS THE BODY (L6, LOOK-AUDIT F8; chunks.js pcTone): how far a green or grey thing's shade turns
  //     from the plum of the clip's orange floor toward the key with its green kept. OFF by default (seen to move almost
  //     nothing: chunks.js); ?shadehue=1 turns it on.
  //   w THE AIR FROM THE AIR (L5): how far the far air is laid as from the air -- 0 on foot, 1 from the air; set each
  //     frame by world/index.js from LOOK.airFar and the air's reach.
  uLookN: { value: new THREE.Vector4(0.60, 0.45, _qn('shadehue', 0), 0) },
};

// WHERE THE FIRE HAS BEEN, FOR THE GROUND'S OWN PAINT (the powers, fire; the paint itself is materials.js TERRAIN_FRAG).
//
// The lasting record of what the fire left is src/data/burnt.js: up to six hundred marks, each one a short CAPSULE of
// scorched ground -- two ends, how far to the side the fire reached, and how black it went. Six hundred is far more
// than a shader can try for every pixel it paints, so the painter holds a FEW of them, and this is how the few are
// chosen and how a pixel decides which of those few can matter where it stands.
//
//   WHICH FEW. The marks nearest the EYE, picked again only when the record changes, when the eye has moved a few
//   metres, or when the eye is on another world. A fire burns where the player is; ground farther off than these
//   marks reach reads clean again, which is this version's plain limit and must be told to the owner: a wood burnt
//   over hundreds of metres is not black all the way to the horizon yet.
//
//   WHICH OF THOSE CAN MATTER AT A GIVEN PLACE. They are written out in FOURS -- each four the mark next in line and
//   the three whose middles lie nearest it -- and a ball is drawn round each four, with one more ball round the
//   whole lot. A pixel tries the one big ball first: a subtraction and a dot product, and outside it nothing else is
//   done at all. Inside it, it tries each four's ball and skips all four of that four's marks behind any ball it
//   stands outside of. So a pixel in one burnt patch pays for that patch's marks and the fours' balls, not for every
//   mark the ground holds, and a pixel of clean ground pays for one ball. MEASURED with the ground holding all
//   thirty-two marks of a fire that had run over three hundred metres, at 116,000 places across it and the clean
//   ground round it: 2.7 capsule tests a place on average and 8 at worst, of the 32 held.
//
//   AND NOTHING AT ALL WHEN NOTHING HAS BURNED. syncBurnt makes ONE comparison (BURNT.scorches) and returns; the
//   shader stops on one comparison too (uBurnN); and the ground's program is compiled WITHOUT any of this unless the
//   powers and the oil look are both switched on, so the live watercolour game holds not one instruction of it.
//
// WHY A UNIFORM ARRAY AND NOT A LITTLE DATA TEXTURE. A ground pixel is already reading three textures; a handful of
// uniform numbers is cheaper to read than another sampler, costs no upload and no texture memory, and it is the way
// the game already hands the water its parted channel (uPwChanA / uPwChanB above, materials.js PC_POWERS), so there
// is one pattern to learn and not two. A texture would be the answer if all six hundred marks had to be on the
// ground at once -- and that wants a grid of cells inside the texture as well, the way the record itself has one.
// That is the next step if the owner ever asks for a wood black to the horizon.
//
// AND WHY THE PLACES ARE THE BODY'S OWN. A mark's middle is kept here BODY-ABSOLUTE, in the body's own axes, exactly
// as the record keeps it, and the shader compares it against vBody, which is body-absolute too (TERRAIN_VERT). It is
// NOT measured from the eye: a middle measured from the eye, compared with vBody, would be out by wherever the
// camera happens to stand -- kilometres -- and every burn would land nowhere near the fire that made it. A world is
// only kilometres across, so a body-absolute metre in one of these numbers is good to a fraction of a millimetre,
// which is far finer than a brush stroke: the simple way round is also the right one.
//
// HOW MANY MARKS THE GROUND HOLDS AT ONCE, in fours. This is the one number to turn, and what limits it is how many
// uniform numbers a program may ask for: a device promises at least 224 of them to a fragment program, the oil look's
// ground already asks for 57, each four of marks here costs nine more, and the dials and the big ball three in all.
// MEASURED on this working copy: at eight fours the ground's program asks for 132 of the 224, which leaves room to
// spare on the plainest device the game supports. Thirty-two marks is about one wood forty metres across burnt right
// out (data/burnt.js measured 38 to 41 marks for a wood that size); a bigger fire than that is painted black near the
// eye and reads clean farther off, which is this version's limit and is written out plainly below.
const BURN_G = 8, BURN_N = BURN_G * 4;
export const BURNPAINT = {
  slots: BURN_N, groups: BURN_G,
  near: 6,            // m: how far the eye may move before the nearest marks are picked again
  // THE SCORCH'S DIALS, so that what has not been looked at yet can be turned from the address and not from the code.
  // x: how strongly a scorch is laid at all (`?burn=`; 1 as chosen, 0 takes it out of the picture altogether, which
  //    is how a before-and-after pair of stills is taken)
  // y: the share of a mark's width that is burnt right through, TAKEN FROM THE RECORD ITSELF, so what is painted and
  //    what the play code believes about the same patch of ground cannot drift apart
  // z: how much of the ground's own colour is left under the black where a mark is blackest
  // w: how light the charcoal is mixed (`?charcoal=`; over 1 a grey scorch, under 1 a blacker one)
  // (y is held a hair under 1 whatever the record says: the shader eases from the core out to the rim with a
  //  smoothstep, which has no meaning if the two edges are the same number)
  uBurnK: { value: new THREE.Vector4(_qn('burn', 1), Math.min(0.98, BURN.core), 0.06, _qn('charcoal', 1)) },
  // HOW DEEP A MELTED WELL IS PAINTED AT ITS DARKEST, in metres of ice gone (the owner, 2026-11-19: "give the ice
  // planets more places to melt"). Where there is ground under the ice the record itself says when it is bare and
  // this is not used; where there is none -- a glacier, a shelf, a frozen sea -- the hole "just keeps melting away"
  // as far as 120 m, and a hole deeper than a person already reads as a well, so the paint is at its darkest here
  // and no darker below. A judgement about a picture, not a measurement.
  meltDeep: 4,
  uBurnN: { value: 0 },                                     // how many marks are in the arrays (0: none, and the shader stops at once)
  uBurnBall: { value: new THREE.Vector4(0, 0, 0, -1) },     // one ball round the lot: xyz its middle, w its radius (m)
  uBurnG: { value: new Float32Array(BURN_G * 4) },          // and one round each four of marks, the same way
  uBurnA: { value: new Float32Array(BURN_N * 4) },          // a mark: xyz the middle of its line (the body's axes), w how wide it burned (m)
  uBurnB: { value: new Float32Array(BURN_N * 4) },          //   and: xyz from that middle to one end of the line, w how black it went (0..1)
};

// How far a point is from a mark's line, squared. The same reading as data/burnt.js segDist2, written out again here
// because that one belongs to the record and is not handed out; off the ends it is the distance to the nearer end, so
// a mark is a capsule and not an endless tube.
function _markD2(m, x, y, z) {
  const ax = x - m.x, ay = y - m.y, az = z - m.z;
  const bx = m.x2 - m.x, by = m.y2 - m.y, bz = m.z2 - m.z;
  const bb = bx * bx + by * by + bz * bz;
  if (bb <= 1e-12) return ax * ax + ay * ay + az * az;
  let t = (ax * bx + ay * by + az * bz) / bb;
  if (t < 0) t = 0; else if (t > 1) t = 1;
  const dx = ax - bx * t, dy = ay - by * t, dz = az - bz * t;
  return dx * dx + dy * dy + dz * dz;
}
// How far apart two marks' middles are, squared (for gathering them into fours).
function _midD2(a, b) {
  const dx = (a.x + a.x2 - b.x - b.x2) * 0.5, dy = (a.y + a.y2 - b.y - b.y2) * 0.5, dz = (a.z + a.z2 - b.z - b.z2) * 0.5;
  return dx * dx + dy * dy + dz * dz;
}
let _bnV = -1, _bnBody = null, _bnEx = 1e9, _bnEy = 1e9, _bnEz = 1e9;
const _bnMarks = [], _bnMelts = [], _bnPick = [], _bnDist = [], _bnTook = new Uint8Array(BURN_N), _bnFour = new Int32Array(4);
// A MARK'S LAST NUMBER, which is also what tells the shader which kind of mark it is. See the long note over
// pcMarksAt in render/materials.js, which reads it; nowhere else knows this encoding.
//    a scorch            how black it went, 0 .. 1 (always above zero, so the sign means what it says)
//    a melt with ground   -(how far that ground is laid bare, 0 .. 1)
//    a melt without       -2 - (how deep the well has gone, 0 .. 1 of BURNPAINT.meltDeep)
function _markW(m) {
  if (m.kind !== MARK.melt) return m.c > 1e-4 ? m.c : 1e-4;
  if (m.floor >= 0) return -Math.max(0.02, m.floor > 1e-4 ? Math.min(1, m.d / m.floor) : 1);
  return -2 - Math.max(0.05, Math.min(1, m.d / BURNPAINT.meltDeep));
}
// Picks the marks the ground will paint and fills the uniforms above. The world calls this once a frame for the body
// the eye is on, before the ground is drawn: syncBurnt(bodyId, camLocal), the eye in that body's own axes.
// MEASURED in Node on the build machine (not on a device): 14 to 29 ns a frame with nothing ever burnt, 50 ns a frame
// when nothing has changed since the last one, and 17.8 us in the worst case the record allows -- its list full at six
// hundred marks AND changing every frame, which is a fire sitting on ground it is still blackening. That worst case is
// a tenth of one per cent of a sixty-a-second frame.
export function syncBurnt(bodyId, cam) {
  // NOTHING HAS EVER BURNED: one comparison and out, which is the promise data/burnt.js makes and this keeps.
  if (!BURNT.scorches && !BURNT.melts) {
    if (BURNPAINT.uBurnN.value !== 0) { BURNPAINT.uBurnN.value = 0; BURNPAINT.uBurnBall.value.w = -1; _bnV = -1; _bnBody = null; }
    return;
  }
  const ex = cam ? cam.x : 0, ey = cam ? cam.y : 0, ez = cam ? cam.z : 0;
  const mx = ex - _bnEx, my = ey - _bnEy, mz = ez - _bnEz;
  // the same marks stand until the record changes, the eye moves a few metres, or the eye is on another world
  if (BURNT.version === _bnV && bodyId === _bnBody && mx * mx + my * my + mz * mz < BURNPAINT.near * BURNPAINT.near) return;
  _bnV = BURNT.version; _bnBody = bodyId; _bnEx = ex; _bnEy = ey; _bnEz = ez;
  // THE NEAREST FEW, NEAREST FIRST. Each mark on this world is looked at once and dropped into a list of
  // BURN_N kept in order; the list is short and this happens only when something has changed, so there is no call
  // for anything cleverer than looking at each in turn.
  scorchesOn(bodyId, _bnMarks);
  // AND THE MELTED PLACES, in the same list and the same arrays: a melt is the same shape of mark and is painted by
  // the same walk (materials.js pcMarksAt), so the ice worlds cost the ground not one uniform more than the burning
  // ones. They share the thirty-two slots, nearest first, which is the honest thing: what the ground can hold at
  // once is what it can hold, whichever the fire has been doing.
  if (BURNT.melts) { meltsOn(bodyId, _bnMelts); for (let j = 0; j < _bnMelts.length; j++) _bnMarks.push(_bnMelts[j]); }
  _bnPick.length = 0; _bnDist.length = 0;
  for (let j = 0; j < _bnMarks.length; j++) {
    const m = _bnMarks[j], d = _markD2(m, ex, ey, ez);
    let at = _bnPick.length;
    if (at >= BURN_N) { if (!(d < _bnDist[BURN_N - 1])) continue; at = BURN_N - 1; } else { _bnPick.push(null); _bnDist.push(0); }
    while (at > 0 && _bnDist[at - 1] > d) { _bnDist[at] = _bnDist[at - 1]; _bnPick[at] = _bnPick[at - 1]; at--; }
    _bnDist[at] = d; _bnPick[at] = m;
  }
  const n = _bnPick.length;
  for (let i = 0; i < n; i++) _bnTook[i] = 0;
  const A = BURNPAINT.uBurnA.value, B = BURNPAINT.uBurnB.value, Gb = BURNPAINT.uBurnG.value;
  let w = 0, allX = 0, allY = 0, allZ = 0;
  // IN FOURS, EACH FOUR THE FOUR NEAREST ONE ANOTHER, with a ball round it. Only the last four can hold fewer than
  // four marks, so mark number four times g is always the first of the four the ball at g holds, and the shader needs
  // no count of its own for each four: it stops at uBurnN.
  for (let g = 0; g < BURN_G && w < n; g++) {
    let seed = -1;
    for (let i = 0; i < n; i++) if (!_bnTook[i]) { seed = i; break; }
    if (seed < 0) break;
    let cnt = 0;
    _bnTook[seed] = 1; _bnFour[cnt++] = seed;
    while (cnt < 4) {
      let best = -1, bd = Infinity;
      for (let i = 0; i < n; i++) {
        if (_bnTook[i]) continue;
        const d = _midD2(_bnPick[i], _bnPick[seed]);
        if (d < bd) { bd = d; best = i; }
      }
      if (best < 0) break;
      _bnTook[best] = 1; _bnFour[cnt++] = best;
    }
    // this four's middle (the mean of its marks' ends), then the radius that holds every end and its own width
    let cx = 0, cy = 0, cz = 0;
    for (let k = 0; k < cnt; k++) { const m = _bnPick[_bnFour[k]]; cx += m.x + m.x2; cy += m.y + m.y2; cz += m.z + m.z2; }
    const inv = 1 / (cnt * 2); cx *= inv; cy *= inv; cz *= inv;
    let rad = 0;
    for (let k = 0; k < cnt; k++) {
      const m = _bnPick[_bnFour[k]];
      rad = Math.max(rad, Math.hypot(m.x - cx, m.y - cy, m.z - cz) + m.r, Math.hypot(m.x2 - cx, m.y2 - cy, m.z2 - cz) + m.r);
      const o = w * 4;
      A[o] = (m.x + m.x2) * 0.5; A[o + 1] = (m.y + m.y2) * 0.5; A[o + 2] = (m.z + m.z2) * 0.5; A[o + 3] = m.r;
      B[o] = (m.x2 - m.x) * 0.5; B[o + 1] = (m.y2 - m.y) * 0.5; B[o + 2] = (m.z2 - m.z) * 0.5; B[o + 3] = _markW(m);
      w++;
      allX += A[o]; allY += A[o + 1]; allZ += A[o + 2];
    }
    const go = g * 4;
    Gb[go] = cx; Gb[go + 1] = cy; Gb[go + 2] = cz; Gb[go + 3] = rad;
  }
  // and one ball round the whole lot, which is the first thing a pixel asks about
  const ball = BURNPAINT.uBurnBall.value;
  if (w > 0) {
    allX /= w; allY /= w; allZ /= w;
    let rad = 0;
    for (let i = 0; i < w; i++) {
      const o = i * 4, hx = B[o], hy = B[o + 1], hz = B[o + 2], r = A[o + 3];
      const dx = A[o] - allX, dy = A[o + 1] - allY, dz = A[o + 2] - allZ;
      rad = Math.max(rad, Math.hypot(dx + hx, dy + hy, dz + hz) + r, Math.hypot(dx - hx, dy - hy, dz - hz) + r);
    }
    ball.set(allX, allY, allZ, rad);
  } else ball.set(0, 0, 0, -1);
  BURNPAINT.uBurnN.value = w;
}

// What the shadow map needs from the world each frame (shadow.js): the body the eye is on (its root in the scene), the
// way to its sun in its own space, and how strong a shadow is now (none under a closed sky or in the middle of twilight).
// (air: the density of the air on the ground, 1/m, and shaft: how strong the light in the air is, for the shafts)
export const SHADOW = { root: null, sunDirL: new THREE.Vector3(0, 1, 0), strength: 0, air: 0, shaft: 0, alt: 0 };      // (alt: the eye's height over the land, m)
// THE CROWDS THAT CAST A SHADOW OF THEIR OWN. The shadow pass draws the scene once with an override material,
// which cannot pose anything; a figure posed by a matrix palette is drawn again from `userData.pcCaster` on a
// SCENE CHILD. An instanced crowd (world/beasts.js) is neither: its meshes hang under the body's root, and
// marking THAT as a caster would walk every mesh on the world, every frame, looking for the handful that pose.
// So a crowd puts its own meshes here and takes them out when it is freed. Small, exact, and no walk.
// (Each entry: { mesh, material } -- the painted material, from which render/shadow.js builds the shadow twin.)
export const SHADOW_CROWD = new Set();
// (a tool may reach every painted material ever made: tools/lab.mjs swaps their shaders without a reload)
export const MATERIALS = new Set();
export function register(m, kind, opts) {
  m.userData.pcMake = { kind, opts: opts || null };
  if (LOOK.oil) { m.defines = m.defines || {}; m.defines.PC_OIL = 1; }
  if (typeof window !== 'undefined') { MATERIALS.add(m); window.__pcMaterials = MATERIALS; }
  return m;
}

// (R1 W2.4) whether water was drawn in this frame's scene pass (the water material says so as it is drawn), and the world
// the eye is on (index.js, from the mood): the post passes keep last frame's painting for its reflections on a world
// once its water has been drawn there (post.js finish)
export const PREV = { water: false, body: null };

// Things laid as a GLAZE over the painted scene (rain): objects whose material blends. They are
// left out of the scene pass and drawn after the abstraction pass, straight onto the brushed
// picture, so a stroke stays a stroke: transparent, darker than a light sky, lighter than a
// dark wood. Whoever makes such an object pushes it here (the world does for PHYSICS' kits).
export const GLAZES = [];

export function ensureGlobals() {
  const t = getTextures();
  G.uNoise3D.value = t.noise3D;
  G.uStrokeTex.value = t.strokes;
  if (LOOK.oil && !OIL.uDabP.value) { const d = getDabTextures(OIL.uOilS.value.z, 0.12); OIL.uDabP.value = d.par; OIL.uDabId.value = d.id; }
  return G;
}

// Per-body light and atmosphere uniforms. The world owns one of these per body and updates the
// active body's every frame; all of that body's materials share the same objects.
export function makeBodyUniforms() {
  return {
    uSunDirW: { value: new THREE.Vector3(0.4, 0.8, 0.4).normalize() },   // toward the sun, scene space
    uSunDirL: { value: new THREE.Vector3(0.4, 0.8, 0.4).normalize() },   // toward the sun, body-local
    uGlaze: { value: new THREE.Vector3(0.66, 0.69, 0.90) },              // cool shadow glaze
    uLight: { value: new THREE.Vector3(1.0, 0.985, 0.93) },              // sunlit wash tint
    uHaze: { value: new THREE.Vector3(0.93, 0.955, 0.975) },             // distance fades to this (near paper)
    uHazeUp: { value: new THREE.Vector4(0, 0, 0, 0) },                   // under a closed sky: the sky's wash overhead, and how far the far air takes it high in the view
    uUpW: { value: new THREE.Vector3(0, 1, 0) },                         // up at the eye, scene space
    uFog: { value: new THREE.Vector4(1 / 4000, 5, 1, 0) },               // 1/visibility, bands, max, altitude01
    uStorm: { value: 0 },                                                // 0 .. 1: under a storm cloud nothing is lit
    uDayness: { value: 1 },                                              // 1 day .. 0 night
    uMoon: { value: 0 },                                                 // 0 the sun is the light .. 1 night on the ground: the moon is, and uSunDir* hold its direction (chunks.js pcLevel)
    uHueA: { value: new THREE.Vector3(0.84, 0.99, 0.80) },               // the two drifts of neighbouring pigment in ground washes
    uHueB: { value: new THREE.Vector3(1.0, 0.90, 0.80) },
    uBodyR: { value: 4000 },                                             // base radius of the body (strata follow the height)
    uHeart: { value: new THREE.Vector4(0, 1, 0, 0) },                    // a world's one great pale marking seen from orbit (Pluto's heart): xyz its place (unit, body-local), w its size (0: none)
    uRound: { value: new THREE.Vector2(0, 4000) },                       // from orbit the limb closes on the mean sphere: x how far the relief is drawn in (0 on the ground .. 0.75), y the datum radius (chunks.js pcRound)
    uWx: { value: new THREE.Vector4(0, 0, 0, 0) },                       // weather: x overcast (flat cool light), y wet ground, z snow cover, w veil (rain or snow in the air)
    uFogBank: { value: new THREE.Vector2(0, 150) },                      // a thick fog lies in banks (PAINTER 19): x how much (0 none), y the drifts' measure (m); chunks.js pcFogBank
    // (w: how much of the floor under trees is fallen leaves, of what it was: a look's `oil.leaves`; 0 reads as 1)
    uGroundK: { value: new THREE.Vector4(0, 1, 0, 0) },                  // the oil look: x how this world's ground is laid: 0 leaf dabs, 1 long strokes that run with the land (ice); z 1 a world of snow: short broad strokes in the colours of ice and snow (materials.js pcIce); y the share of the oil look's blades and near strokes this world keeps (1: all of them; a look's oil.grass)
  };
}

// Weather for the picture: PHYSICS' sky numbers (docs/notes/physics.md, "For PAINTER" B), each
// 0..1 and continuous: cloud, overcast, haze, fog, dust, wet, snow, rain, snowfall, storm, flash.
// Three sources, in this order: a forced sky (gallery, tests: world.setWeather), PHYSICS' own
// numbers for this frame (world.setPhysics), what PILOT handed the painter (setMood.sky).
export const WX = { forced: null, mood: null, flash: 0, key: 0 };
export function skyNow(physics, bodyId) {
  if (WX.forced) return WX.forced;
  const h = physics && physics.here;
  if (h && h.sky && (!h.bodyId || h.bodyId === bodyId)) return h.sky;
  return WX.mood;
}

// The painter reads this to grade the sheet; the world writes it for the body the camera is on.
export const SHEET = {
  grade: new THREE.Vector3(1, 1, 1),
  valid: false,
  night: 0,      // 0 day .. 1 night on the ground: the sheet's night key (see post.js)
  nightNear: 0,  // the world's own deeper night wash over the near land (a look's nightNear, post.js; 0 on most worlds)
  laid: 1,       // 1: the picture is on the paper; 0: bare paper (an arrival: the land is being laid under it); between: it comes up as one
};

// How the picture is moving: the painter writes speed01 from the mood, the ship's model says
// when the pulse drive is on (its animate state), the world eases pulse01 and lays the streaks.
export const MOTION = { speed01: 0, space01: 0, pulse: false, pulseAt: -1, pulse01: 0, given: null };

// Quality tier (0 low, 1 medium, 2 high): set by the painter, read by the world to scale how
// far flora is drawn.
export const QUALITY = { level: 1 };
// (the full size of the picture in pixels, whatever the resolution controller is doing: the painter's resize writes it.
// The oil look sets a tree's detail by its size on the screen: src/world/flora.js)
export const SCREEN = { outW: 1920, outH: 1080 };

// PHYSICS' flora field (COORDINATOR C14): three float textures and their uniforms, shared by
// every plant material. The world fills them from physics.fields.flora each frame; until then
// uPhysOn is 0 and plants use the painter's own gentle sway.
function blank() {
  const t = new THREE.DataTexture(new Float32Array(16), 2, 2, THREE.RGBAFormat, THREE.FloatType);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
}
export const PHYS = {
  uPhysBend: { value: blank() }, uPhysWind: { value: blank() }, uPhysPush: { value: blank() },
  uPhysAnchor: { value: new THREE.Vector3() }, uPhysEast: { value: new THREE.Vector3(1, 0, 0) },
  uPhysNorth: { value: new THREE.Vector3(0, 0, -1) }, uPhysUp: { value: new THREE.Vector3(0, 1, 0) },
  uPhysWindMap: { value: new THREE.Vector4(0, 0, 1, 2) }, uPhysNearMap: { value: new THREE.Vector4(0, 0, 1, 2) },
  uPhysWave: { value: new THREE.Vector4(1, 0, 0.1, 0) }, uPhysWavePhase: { value: new THREE.Vector4() },
  uPhysShape: { value: new THREE.Vector4(1, 1, 1, 1) }, uPhysOn: { value: 0 },
  // (branches: PHYSICS' four oscillators and their gains; they were never copied, so no branch moved)
  uPhysBranchPhase: { value: new THREE.Vector4() }, uPhysBranch: { value: new THREE.Vector4(0, 0, 0, 0.3) },
  // (each branch rings on four clock lines: without this copied, every ring froze as a fixed offset)
  uPhysBranchClock: { value: new THREE.Vector4() },
  // (group D, ?farwind=1) the far field of the plants (physics flora.js FloraField.far) and where it lies; w = 0: off, never read
  uPhysFar: { value: blank() }, uPhysFarMap: { value: new THREE.Vector4(0, 0, 1, 0) },
};
let _physV = -1, _physP = -1, _physF = null, _physFV = -1;
export function syncPhysFlora(F) {
  if (!F || !F.bend) { PHYS.uPhysOn.value = 0; return; }
  if (F !== _physF) {
    _physF = F;
    const mk = (arr, n) => { const t = new THREE.DataTexture(arr, n, n, THREE.RGBAFormat, THREE.FloatType); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; };
    PHYS.uPhysBend.value = mk(F.bend, F.size); PHYS.uPhysWind.value = mk(F.wind, F.size); PHYS.uPhysPush.value = mk(F.push, F.nearSize);
    if (F.far) PHYS.uPhysFar.value = mk(F.far, F.farSize);
    _physV = _physP = _physFV = -1;
  }
  if (F.version !== _physV) { PHYS.uPhysBend.value.needsUpdate = true; PHYS.uPhysWind.value.needsUpdate = true; _physV = F.version; }
  if (F.far && F.farVersion !== _physFV) { PHYS.uPhysFar.value.needsUpdate = true; _physFV = F.farVersion; }
  if (F.pushVersion !== _physP) { PHYS.uPhysPush.value.needsUpdate = true; _physP = F.pushVersion; }
  for (const k in F.uniforms) if (PHYS[k]) PHYS[k].value.fromArray(F.uniforms[k]);
  PHYS.uPhysOn.value = 1;
}

// PHYSICS' sea (docs/notes/physics.md, "For PAINTER" D): the uniforms of its wave chunk, shared
// by every liquid material. The world copies them from physics.fields.water each frame; with
// no physics (or on a body it is not running on) the sea lies flat.
// (PHYSICS P18/P19: the sea map, `PC_PHYS_SEA_MAP` in the water material: the sea raised at every node about over
// its own fetch and depth, a 17 x 51 float texture read with texelFetch, the two levels' grids and the band where
// the inner level gives way to the outer one. With no map (uPhysSeaGrid.w 0) the chunk reads uPhysWaterSea as before.)
function seaTex(data) {
  const t = new THREE.DataTexture(data || new Float32Array(17 * 51 * 4), 17, 51, THREE.RGBAFormat, THREE.FloatType);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
}
export const PHYSW = {
  uPhysWaterDir: { value: new THREE.Vector2(1, 0) }, uPhysWaterK: { value: new THREE.Vector4(1, 1, 1, 1) },
  uPhysWaterAmp: { value: new THREE.Vector4() }, uPhysWaterPhase: { value: new THREE.Vector4() },
  uPhysWaterGroup: { value: new THREE.Vector4() }, uPhysWaterSea: { value: new THREE.Vector4(0, 1e9, 1, 0) },
  uPhysWake: { value: new Float32Array(64) }, uPhysWakeG: { value: 9.81 },
  uPhysSeaMap: { value: seaTex() }, uPhysSeaGrid: { value: new THREE.Vector4(0, 0, 16, 0) },
  uPhysSeaGrid2: { value: new THREE.Vector4(0, 0, 128, 0) }, uPhysSeaBand: { value: new THREE.Vector4(0, 0, 0, 0) },
  uWaveLod: { value: 1 },   // scales the distance over which the mesh can still carry the waves
};
const _noWake = new Float32Array(64);
let _seaV = -1;
export function syncPhysWater(W) {
  const u = W && W.uniforms;
  if (!u) {
    PHYSW.uPhysWaterAmp.value.set(0, 0, 0, 0); PHYSW.uPhysWaterSea.value.set(0, 1e9, 1, 0); PHYSW.uPhysWake.value = _noWake;
    PHYSW.uPhysSeaGrid.value.w = 0; PHYSW.uPhysSeaGrid2.value.w = 0;
    return;
  }
  PHYSW.uPhysWaterDir.value.fromArray(u.uPhysWaterDir); PHYSW.uPhysWaterK.value.fromArray(u.uPhysWaterK);
  PHYSW.uPhysWaterAmp.value.fromArray(u.uPhysWaterAmp); PHYSW.uPhysWaterPhase.value.fromArray(u.uPhysWaterPhase);
  PHYSW.uPhysWaterGroup.value.fromArray(u.uPhysWaterGroup); PHYSW.uPhysWaterSea.value.fromArray(u.uPhysWaterSea);
  PHYSW.uPhysWake.value = u.uPhysWake; PHYSW.uPhysWakeG.value = u.uPhysWakeG;
  if (u.uPhysSeaMap) {
    // (the same array every frame: the texture is made once over it, re-uploaded when the map was rewritten)
    if (PHYSW.uPhysSeaMap.value.image.data !== u.uPhysSeaMap) { PHYSW.uPhysSeaMap.value.dispose(); PHYSW.uPhysSeaMap.value = seaTex(u.uPhysSeaMap); _seaV = -1; }
    if (W.mapVersion !== _seaV) { PHYSW.uPhysSeaMap.value.needsUpdate = true; _seaV = W.mapVersion; }
    PHYSW.uPhysSeaGrid.value.fromArray(u.uPhysSeaGrid); PHYSW.uPhysSeaGrid2.value.fromArray(u.uPhysSeaGrid2);
    if (u.uPhysSeaBand) PHYSW.uPhysSeaBand.value.fromArray(u.uPhysSeaBand);
  } else { PHYSW.uPhysSeaGrid.value.w = 0; PHYSW.uPhysSeaGrid2.value.w = 0; }
}

// Things that must be brought up to date with the camera just before a frame is painted
// (PHYSICS' draw kits face the picture plane and size themselves in internal pixels):
// each hook is called as hook(camera, painter.info) at the start of painter.render.
export const FRAME_HOOKS = [];
